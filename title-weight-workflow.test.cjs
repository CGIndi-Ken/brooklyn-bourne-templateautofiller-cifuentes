const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser-test-helper.cjs');

async function main() {
  const {browser,pageURL}=await launchBrowser();
  try {
    const context=await browser.newContext({viewport:{width:1280,height:1000}}), errors=[];
    const storage={templates:{
      Legacy:{name:'Legacy flower | 3.5g',gramsConcentration:'9'},
      'Legacy blank':{name:'Legacy blank | 7g',gramsConcentration:''},
    }};
    let templatesGate;
    await context.exposeBinding('readStore',(_,key)=>({[key]:storage[key]}));
    await context.exposeBinding('writeStore',async(_,data)=>{
      if(data.templates && templatesGate){const gate=templatesGate;templatesGate=null;gate.started();await gate.promise;}
      const changes=Object.fromEntries(Object.entries(data).map(([key,value])=>[key,{oldValue:storage[key],newValue:value}]));
      Object.assign(storage,data);
      await Promise.all(context.pages().flatMap(page=>page.frames()).map(frame=>frame.evaluate(changes=>{
        for(const listener of window.testListeners || [])listener(changes,'local');
      },changes).catch(()=>{})));
    });
    await context.exposeBinding('removeStore',(_,key)=>{delete storage[key];});
    await context.addInitScript(()=>{
      window.testListeners=[];
      window.chrome={storage:{local:{get:key=>window.readStore(key),set:data=>window.writeStore(data),remove:key=>window.removeStore(key)},
        onChanged:{addListener:listener=>window.testListeners.push(listener)}},runtime:{getURL:file=>new URL(file,location.href).href}};
    });
    const open=async file=>{const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(pageURL(file));return page;};
    const popup=await open('popup.html');
    await popup.waitForSelector('#useTitleWeight');
    const title=popup.locator('#f_name'), grams=popup.locator('#f_gramsConcentration');
    for(const [name,expected] of [['Flower | 3.5g (H)','3.5'],['Gummy | 100mg (I)','0.1'],['Prerolls | 1g 2pk (S)','1']]) {
      await title.fill(name);assert.equal(await grams.inputValue(),expected);
    }
    await title.fill('Flower | 7g');assert.equal(await grams.inputValue(),'7');
    await title.fill('No product size');assert.equal(await grams.inputValue(),'');
    assert.equal(await popup.locator('#useTitleWeight').isDisabled(),true);
    await title.fill('Flower | 3.5g');await grams.fill('3.5');await grams.dispatchEvent('input');
    await title.fill('Flower | 7g');assert.equal(await grams.inputValue(),'3.5');
    await popup.evaluate(()=>saveDraft());await popup.reload();
    await popup.waitForFunction(()=>document.getElementById('f_name')?.value==='Flower | 7g');
    await title.fill('Flower | 14g');assert.equal(await grams.inputValue(),'3.5');
    await grams.fill('');await title.fill('Flower | 28g');assert.equal(await grams.inputValue(),'');
    await popup.evaluate(()=>saveDraft());await popup.reload();
    await popup.waitForFunction(()=>document.getElementById('f_name')?.value==='Flower | 28g');
    await title.fill('Flower | 7g');assert.equal(await grams.inputValue(),'');
    await popup.locator('#useTitleWeight').click();assert.equal(await grams.inputValue(),'7');
    await title.fill('Flower | 14g');assert.equal(await grams.inputValue(),'14');
    await popup.locator('#templateName').fill('Inferred saved');await popup.locator('#saveBtn').click();
    await popup.waitForFunction(()=>document.getElementById('templateName').value==='');
    assert.equal(storage.templates['Inferred saved'].gramsConcentration,'14');
    assert.equal(storage.templates['Inferred saved'].inferGramsFromTitle,true);
    await popup.locator('#templateSelect').selectOption('Inferred saved',{force:true});
    await popup.waitForFunction(()=>document.getElementById('f_name').value==='Flower | 14g');
    await title.fill('Flower | 7g');assert.equal(await grams.inputValue(),'7');

    // Loading a legacy value does not infer or persist a replacement behind the scenes.
    const legacyBefore=JSON.stringify(storage.templates.Legacy);
    await popup.locator('#templateSelect').selectOption('Legacy',{force:true});
    await popup.waitForFunction(()=>document.getElementById('f_name').value==='Legacy flower | 3.5g');
    assert.equal(await grams.inputValue(),'9');assert.equal(JSON.stringify(storage.templates.Legacy),legacyBefore);
    await title.fill('Legacy flower | 7g');assert.equal(await grams.inputValue(),'9');
    await popup.locator('#templateSelect').selectOption('Legacy blank',{force:true});
    await popup.waitForFunction(()=>document.getElementById('f_name').value==='Legacy blank | 7g');
    assert.equal(await grams.inputValue(),'');
    await title.fill('Legacy blank | 14g');assert.equal(await grams.inputValue(),'');
    await popup.locator('#useTitleWeight').click();assert.equal(await grams.inputValue(),'14');

    await popup.locator('#templateSelect').selectOption('Legacy',{force:true});
    await popup.waitForFunction(()=>document.getElementById('f_name').value==='Legacy flower | 3.5g');
    await popup.locator('#copyBtn').click();assert.equal(await grams.inputValue(),'3.5');
    await title.fill('Copied flower | 7g');assert.equal(await grams.inputValue(),'7');

    // Per-product weights come from each pasted title, not the shared editor field.
    await popup.locator('#newBtn').click();await title.fill('Shared source | 99g');
    await grams.fill('99');await popup.locator('#bulkCard').evaluate(card=>{card.open=true;});
    const bulkNames=['Bulk flower | 3.5g','Bulk gummies | 100mg\tFruit\tReviewed description','Bulk prerolls | 1g 2pk'];
    await popup.locator('#bulkNames').fill(bulkNames.join('\n'));await popup.locator('#bulkPreviewBtn').click();await popup.locator('#bulkCreateBtn').click();
    await popup.waitForFunction(()=>document.getElementById('bulkStatus').textContent.startsWith('Created 3 templates'));
    for(const [key,weight] of [['Bulk flower | 3.5g','3.5'],['Bulk gummies | 100mg','0.1'],['Bulk prerolls | 1g 2pk','1']]) {
      assert.equal(storage.templates[key].gramsConcentration,weight);assert.equal(storage.templates[key].inferGramsFromTitle,true);
    }
    assert.equal(storage.templates['Bulk gummies | 100mg'].strain,'Fruit');
    assert.equal(storage.templates['Bulk gummies | 100mg'].onlineDescription,'Reviewed description');

    // Import/export retain provenance and saved values; imports never recalculate them.
    await popup.getByRole('button',{name:'Templates',exact:true}).click();
    const backup={format:'brooklyn-bourne-templates',version:1,templates:{Imported:{name:'Imported | 1g',gramsConcentration:'9',inferGramsFromTitle:true}}};
    await popup.locator('#importFile').setInputFiles({name:'weights.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    await popup.waitForFunction(()=>document.getElementById('transferStatus').textContent.startsWith('Imported 1 templates'));
    assert.equal(storage.templates.Imported.gramsConcentration,'9');assert.equal(storage.templates.Imported.inferGramsFromTitle,true);
    await popup.locator('#templateSelect').selectOption('Imported',{force:true});
    await popup.waitForFunction(()=>document.getElementById('f_name').value==='Imported | 1g');assert.equal(await grams.inputValue(),'9');
    await title.fill('Imported | 2g');assert.equal(await grams.inputValue(),'2');
    await popup.evaluate(()=>{const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.exportedBackup=blob;return create(blob);};});
    await popup.locator('#exportBtn').click();await popup.waitForFunction(()=>!!window.exportedBackup);
    const exported=await popup.evaluate(async()=>JSON.parse(await window.exportedBackup.text()));
    assert.equal(exported.templates['Inferred saved'].inferGramsFromTitle,true);
    assert.equal(exported.templates.Imported.gramsConcentration,'9');

    // Editing during a pending save retains the manual-override provenance in the draft.
    let started, release;
    const pending=new Promise(resolve=>{started=resolve;});templatesGate={started,promise:new Promise(resolve=>{release=resolve;})};
    await popup.locator('#templateName').fill('Async inferred');await popup.locator('#saveBtn').click();await pending;
    await grams.fill('2');await grams.dispatchEvent('input');release();
    await popup.waitForFunction(()=>!document.getElementById('saveBtn').disabled);
    assert.equal(await popup.locator('#templateName').inputValue(),'Async inferred');
    await title.fill('Imported | 7g');assert.equal(await grams.inputValue(),'2');

    storage['productWorkspace:title-weights']={rows:[]};
    const workspace=await open('workspace.html?batch=title-weights');await workspace.waitForFunction(()=>initialized);
    await workspace.locator('#quickNames').fill('Workspace flower | 3.5g\nWorkspace gummy | 100mg\nWorkspace prerolls | 1g 2pk');
    await workspace.locator('#addNames').click();
    const cards=workspace.locator('.entry-card'), first=cards.nth(0), second=cards.nth(1), third=cards.nth(2);
    const rowGrams=card=>card.locator('[data-field="gramsConcentration"]'), rowName=card=>card.locator('[data-field="name"]');
    assert.deepEqual(await cards.locator('[data-field="gramsConcentration"]').evaluateAll(inputs=>inputs.map(input=>input.value)),['3.5','0.1','1']);
    await rowName(first).fill('Workspace flower | 7g');assert.equal(await rowGrams(first).inputValue(),'7');
    await rowGrams(first).fill('7');await rowGrams(first).dispatchEvent('input');await rowName(first).fill('Workspace flower | 14g');assert.equal(await rowGrams(first).inputValue(),'7');
    await rowGrams(first).fill('');await rowName(first).fill('Workspace flower | 28g');assert.equal(await rowGrams(first).inputValue(),'');
    await first.locator('[data-action="titleWeight"]').click();assert.equal(await rowGrams(first).inputValue(),'28');
    await first.getByRole('button',{name:'Duplicate settings',exact:true}).click();
    const duplicate=cards.nth(3);assert.equal(await rowName(duplicate).inputValue(),'');assert.equal(await rowGrams(duplicate).inputValue(),'');
    await rowName(duplicate).fill('Duplicated flower | 7g');assert.equal(await rowGrams(duplicate).inputValue(),'7');
    await second.getByLabel('Select entry',{exact:true}).uncheck();await third.getByLabel('Select entry',{exact:true}).uncheck();
    await duplicate.getByLabel('Select entry',{exact:true}).uncheck();
    await workspace.locator('#applyField').selectOption('gramsConcentration');await workspace.locator('#applyValue').fill('5');await workspace.locator('#applySelected').click();
    await rowName(first).fill('Workspace flower | 14g');assert.equal(await rowGrams(first).inputValue(),'5');
    await workspace.locator('#clearValue').check();await workspace.locator('#applySelected').click();
    await rowName(first).fill('Workspace flower | 3.5g');assert.equal(await rowGrams(first).inputValue(),'');
    assert.equal(await rowGrams(second).inputValue(),'0.1');
    await workspace.evaluate(()=>persistDraft());await workspace.reload();await workspace.waitForFunction(()=>initialized);
    await rowName(first).fill('Workspace flower | 7g');assert.equal(await rowGrams(first).inputValue(),'');
    await first.locator('[data-action="titleWeight"]').click();
    await workspace.locator('#saveProducts').click();await workspace.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    assert.equal(storage.templates['Workspace flower | 7g'].inferGramsFromTitle,true);
    await rowGrams(first).fill('7');await rowGrams(first).dispatchEvent('input');
    assert.equal(await workspace.locator('#metrics .metric').nth(1).locator('strong').textContent(),'1');
    await workspace.locator('#saveProducts').click();await workspace.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    assert.equal(storage.templates['Workspace flower | 7g'].inferGramsFromTitle,false);
    assert.deepEqual(errors,[]);
    console.log('Passed title-derived grams across popup/workspace creation, live title changes, manual same-value/clear overrides, drafts, helpers, mixed bulk TSV, saved legacy values, provenance import/export and pending saves.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
