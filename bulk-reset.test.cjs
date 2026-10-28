const assert=require('node:assert/strict');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
  const {browser,pageURL}=await launchBrowser();
  try{
    const context=await browser.newContext(),errors=[];
    const oldVendor='NYS Distribution',correct='Correct Distribution';
    const templates={Old:{name:'Old',vendor:oldVendor,brand:'Brand'},Keep:{name:'Keep',vendor:correct,brand:'Brand'}};
    const storage={templates:structuredClone(templates),brandDirectory:[{vendor:oldVendor,brands:['Old Brand']},{vendor:correct,brands:['Brand']}],options:{vendor:[oldVendor,correct]},categoryPairings:{carts:{regulatoryCategory:'Oil for Vaporization',externalCategory:'Vape Cartridge - Each'}},lastBulkBatch:{keys:['Old','Keep'],shared:{vendor:correct,cost:'7'}}};
    const retained=structuredClone(storage);
    let gate,started,release;
    await context.exposeBinding('readStore',(_,key)=>({[key]:storage[key]}));
    await context.exposeBinding('writeStore',async(_,data)=>{
      if(gate && Object.keys(data).some(key=>key.startsWith('productWorkspace:'))){gate=false;started();await new Promise(resolve=>release=resolve);}
      Object.assign(storage,data);
      const changes=Object.fromEntries(Object.entries(data).map(([key,newValue])=>[key,{newValue}]));
      await Promise.all(context.pages().flatMap(page=>page.frames()).map(frame=>frame.evaluate(changes=>{for(const fn of window.listeners || [])fn(changes,'local');},changes)));
    });
    await context.addInitScript(()=>{window.listeners=[];window.chrome={storage:{local:{get:key=>readStore(key),set:data=>writeStore(data),remove:async()=>{}},onChanged:{addListener:fn=>listeners.push(fn)}}};});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);
    assert.equal(await page.locator('.entry-card').count(),2);
    assert.equal(await page.locator('#vendorsList option').evaluateAll(options=>options.some(option=>option.value.toLowerCase()==='nys distribution')),false);
    assert.deepEqual(await page.locator('#vendorList button').allTextContents(),[`${correct}1 brand`]);
    await page.locator('#entrySearch').fill('Keep');
    await page.locator('.entry-card:visible [data-action="select"]').uncheck();
    await page.locator('#bulkCost').fill('99');await page.locator('#quickNames').fill('Unfinished names');
    page.once('dialog',dialog=>dialog.dismiss());await page.locator('#removeAll').click();
    assert.equal(await page.locator('.entry-card').count(),2);
    assert.equal(await page.locator('#quickNames').inputValue(),'Unfinished names');
    // Queue an old write before reset, then ensure it cannot resurrect removed rows.
    gate=true;
    const didStart=new Promise(resolve=>started=resolve);
    await page.evaluate(()=>{$w("quickNames").value="Draft queued before reset";$w("quickNames").value="Draft queued before reset";workspaceDirty=true;window.pendingDraft=persistDraft();});await didStart;
    page.once('dialog',async dialog=>{assert.match(dialog.message(),/hidden and unchecked/);await dialog.accept();});
    await page.locator('#removeAll').click();
    await page.waitForFunction(()=>rows.size===0);
    assert.equal(await page.locator('#removeAll').isDisabled(),true);
    release();
    await page.waitForFunction(()=>document.getElementById('workspaceStatus').textContent.startsWith('Bulk workspace cleared'));
    assert.equal(await page.locator('.entry-card').count(),0);
    for(const id of ['quickNames','entrySearch','savedSearch','bulkCost','bulkPrice','bulkThc','entryVendor','entryBrand','sharedSource']) assert.equal(await page.locator(`#${id}`).inputValue(),'');
    assert.equal(await page.locator('#bulkTags .selected-brand').count(),0);
    assert.deepEqual(storage['productWorkspace:main'].rows,[]);
    assert.deepEqual(storage['productWorkspace:main'].shared,{});
    for(const key of ['templates','brandDirectory','options','categoryPairings','lastBulkBatch'])assert.deepEqual(storage[key],retained[key]);
    await page.reload();await page.waitForFunction(()=>initialized);
    assert.equal(await page.locator('.entry-card').count(),0,'Empty draft must not repopulate the last batch');
    await page.locator('#addEntry').click();
    assert.equal(await page.locator('.entry-card [data-field="cost"]').inputValue(),'');
    await page.locator('#savedTemplatePicker summary').click();await page.locator('#loadRecent').click();assert.equal(await page.locator('.entry-card').count(),3,'Previous saved batch remains available on explicit request');
    await page.getByRole('button',{name:'Brand directory',exact:true}).click();
    await page.locator('#learnPairs').click();
    await page.waitForFunction(()=>document.getElementById('workspaceStatus').textContent.startsWith('Remembered vendor'));
    assert.equal(storage.brandDirectory.some(entry=>entry.vendor===oldVendor),false,'Remember pairs must not restore retired alias');
    assert.equal(storage.brandDirectory.some(entry=>entry.vendor===correct),true);
    const popup=await context.newPage();popup.on('pageerror',e=>errors.push(e.message));
    await popup.goto(pageURL('popup.html'));await popup.waitForSelector('#f_vendor');
    assert.equal(await popup.locator('#directoryVendorHints option').evaluateAll(options=>options.some(option=>option.value==='NYS Distribution')),false);
    assert.equal(await popup.locator('#directoryVendorHints option').evaluateAll(options=>options.some(option=>option.value==='Correct Distribution')),true);
    assert.deepEqual(storage.templates,templates);
    assert.deepEqual(errors,[]);
    console.log('Passed Remove all/cancel, hidden and unchecked cleanup, input/reset defaults, queued-write/reopen safety, saved-data preservation and retired vendor suppression across learned/template/directory/popup sources.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
