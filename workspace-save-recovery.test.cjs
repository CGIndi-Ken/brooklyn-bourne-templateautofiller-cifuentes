const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser-test-helper.cjs');

// Storage does not promise to preserve object insertion order across processes.
const roundTrip = value => JSON.parse(JSON.stringify(value, (_,item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item));

async function main() {
  const {browser,pageURL}=await launchBrowser();
  try {
    const context=await browser.newContext({viewport:{width:1400,height:1000}}), errors=[];
    const storage={};let templateWrites=0, templatesGate, scenario=0;
    await context.exposeBinding('readStore',(_,key)=>({[key]:roundTrip(storage[key] ?? null)}));
    await context.exposeBinding('writeStore',async(_,data)=>{
      if(data.templates && templatesGate){const gate=templatesGate;templatesGate=null;gate.started();await gate.promise;}
      const changes=Object.fromEntries(Object.entries(data).map(([key,value])=>[key,{oldValue:storage[key],newValue:roundTrip(value)}]));
      for(const [key,value] of Object.entries(data))storage[key]=roundTrip(value);
      if(data.templates)templateWrites++;
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
    const product=name=>({name:`${name} | 3.5g`,category:'Flower (New Category)',regulatoryCategory:'Cannabis Flower Products',externalCategory:'Bud/Flower - Each',
      gramsConcentration:'3.5',cost:'10',medBasePrice:'20',strain:'Original strain',vendor:'Vendor',inferGramsFromTitle:false});
    const open=async(keys=['Alpha'])=>{
      storage.templates=Object.fromEntries(keys.map(key=>[key,product(key)]));storage.lastBulkBatch={keys,shared:{}};
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.goto(pageURL(`workspace.html?batch=save-recovery-${++scenario}`));await page.waitForFunction(()=>initialized);
      assert.equal(await page.locator('.entry-card').count(),keys.length);return page;
    };
    const field=(card,key)=>card.locator(`[data-field="${key}"]`);
    const save=async page=>{await page.locator('#saveProducts').click();await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);};
    const remote=async(page,key,patch)=>page.evaluate(async({key,patch})=>{
      const {templates}=await chrome.storage.local.get('templates');Object.assign(templates[key],patch);await chrome.storage.local.set({templates});
    },{key,patch});

    // A normal second save must survive reordered keys and non-editable metadata changes.
    let page=await open(), alpha=page.locator('.entry-card').first();
    await field(alpha,'cost').fill('11');await save(page);assert.equal(storage.templates.Alpha.cost,'11');
    await remote(page,'Alpha',{lastViewed:'today',extraMetadata:{revision:2}});
    await field(alpha,'medBasePrice').fill('21');await save(page);
    assert.equal(storage.templates.Alpha.medBasePrice,'21');assert.equal(storage.templates.Alpha.cost,'11');
    assert.equal(storage.templates.Alpha.lastViewed,'today');
    assert.equal(await alpha.locator('[data-save-conflict]:visible').count(),0);
    await page.close();

    // Disjoint editable changes from another window merge without a review step.
    page=await open();alpha=page.locator('.entry-card').first();
    await field(alpha,'cost').fill('12');await remote(page,'Alpha',{medBasePrice:'22'});await save(page);
    assert.equal(storage.templates.Alpha.cost,'12');assert.equal(storage.templates.Alpha.medBasePrice,'22');
    assert.equal(await field(alpha,'medBasePrice').inputValue(),'22');
    assert.equal(await alpha.locator('[data-save-conflict]:visible').count(),0);
    await page.close();

    // Conflicts retain local edits, allow other rows to save, and survive draft restore.
    page=await open(['Alpha','Beta']);alpha=page.locator('.entry-card').nth(0);
    const beta=page.locator('.entry-card').nth(1);
    await field(alpha,'cost').fill('12');await field(alpha,'strain').fill('Local strain');
    await field(beta,'medBasePrice').fill('25');await remote(page,'Alpha',{cost:'19',medBasePrice:'23'});
    await alpha.getByRole('button',{name:'Minimize',exact:true}).click();await save(page);
    assert.match(await page.locator('#workspaceStatus').textContent(),/needs? review/i);
    assert.equal(storage.templates.Beta.medBasePrice,'25');assert.equal(storage.templates.Alpha.cost,'19');
    assert.equal(await alpha.locator('[data-save-conflict]:visible').count(),1,'Conflict controls remain reachable on a collapsed row');
    assert.equal(await field(alpha,'cost').inputValue(),'12');assert.equal(await field(alpha,'strain').inputValue(),'Local strain');
    await page.evaluate(()=>persistDraft());await page.reload();await page.waitForFunction(()=>initialized);
    alpha=page.locator('.entry-card').nth(0);
    assert.equal(await field(alpha,'cost').inputValue(),'12');assert.equal(await field(alpha,'strain').inputValue(),'Local strain');
    await save(page);await alpha.locator('[data-save-conflict]').waitFor({state:'visible'});
    await remote(page,'Alpha',{cost:'21',medBasePrice:'24'});
    const beforeKeep=templateWrites;
    await alpha.getByRole('button',{name:'Keep my edits',exact:true}).click();
    await alpha.locator('[data-save-conflict]:visible').waitFor({state:'hidden'});
    assert.equal(templateWrites,beforeKeep,'Resolving a conflict requires an explicit subsequent Save all');
    assert.equal(storage.templates.Alpha.cost,'21');
    assert.equal(await field(alpha,'cost').inputValue(),'12');assert.equal(await field(alpha,'medBasePrice').inputValue(),'24');
    await save(page);assert.equal(storage.templates.Alpha.cost,'12');assert.equal(storage.templates.Alpha.medBasePrice,'24');
    assert.equal(storage.templates.Alpha.strain,'Local strain');await page.close();

    // Use saved values accepts conflicting fields while retaining unrelated local work.
    page=await open();alpha=page.locator('.entry-card').first();
    await field(alpha,'cost').fill('12');await field(alpha,'strain').fill('Local strain');
    await remote(page,'Alpha',{cost:'19',medBasePrice:'23'});await save(page);
    await remote(page,'Alpha',{cost:'20',medBasePrice:'24',brand:'New remote brand'});
    const beforeSaved=templateWrites;
    await alpha.getByRole('button',{name:'Use saved values',exact:true}).click();
    await alpha.locator('[data-save-conflict]:visible').waitFor({state:'hidden'});
    assert.equal(templateWrites,beforeSaved);
    assert.equal(await field(alpha,'cost').inputValue(),'20');assert.equal(await field(alpha,'medBasePrice').inputValue(),'24');
    assert.equal(await field(alpha,'strain').inputValue(),'Local strain');assert.equal(await field(alpha,'brand').inputValue(),'New remote brand');
    await save(page);assert.equal(storage.templates.Alpha.cost,'20');assert.equal(storage.templates.Alpha.medBasePrice,'24');
    assert.equal(storage.templates.Alpha.brand,'New remote brand');
    assert.equal(storage.templates.Alpha.strain,'Local strain');await page.close();

    // Further edits during a pending save retain both new local and merged remote fields.
    page=await open();alpha=page.locator('.entry-card').first();
    await field(alpha,'cost').fill('12');await remote(page,'Alpha',{medBasePrice:'23'});
    let started,release;const pending=new Promise(resolve=>{started=resolve;});
    templatesGate={started,promise:new Promise(resolve=>{release=resolve;})};
    await page.locator('#saveProducts').click();await pending;await field(alpha,'strain').fill('Typed during save');release();
    await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    assert.equal(await field(alpha,'strain').inputValue(),'Typed during save');
    assert.equal(await field(alpha,'medBasePrice').inputValue(),'23');
    await save(page);assert.equal(storage.templates.Alpha.strain,'Typed during save');
    assert.equal(storage.templates.Alpha.medBasePrice,'23');assert.equal(storage.templates.Alpha.cost,'12');
    assert.equal(await alpha.locator('[data-save-conflict]:visible').count(),0);
    await page.close();

    // A remotely deleted template requires an explicit restore or local-row removal.
    page=await open(['Alpha','Beta']);alpha=page.locator('.entry-card').first();
    const deleteAlpha=()=>page.evaluate(async()=>{
      const {templates}=await chrome.storage.local.get('templates');delete templates.Alpha;await chrome.storage.local.set({templates});
    });
    await field(alpha,'cost').fill('12');await deleteAlpha();await save(page);
    assert.equal(Object.hasOwn(storage.templates,'Alpha'),false);
    assert.equal(await field(alpha,'cost').inputValue(),'12');
    assert.match(await alpha.locator('[data-save-conflict]').textContent(),/deleted/i);
    const beforeRestore=templateWrites;
    await alpha.getByRole('button',{name:'Restore template',exact:true}).click();
    await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    assert.equal(templateWrites,beforeRestore);assert.equal(Object.hasOwn(storage.templates,'Alpha'),false);
    await save(page);assert.equal(storage.templates.Alpha.cost,'12');
    await field(alpha,'cost').fill('13');await deleteAlpha();await save(page);
    const beforeRemove=templateWrites, betaBefore=JSON.stringify(storage.templates.Beta);
    await alpha.getByRole('button',{name:'Remove entry',exact:true}).click();
    await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    assert.equal(await page.locator('.entry-card').count(),1);assert.equal(templateWrites,beforeRemove);
    assert.equal(Object.hasOwn(storage.templates,'Alpha'),false);assert.equal(JSON.stringify(storage.templates.Beta),betaBefore);
    await page.reload();await page.waitForFunction(()=>initialized);
    assert.equal(await page.locator('.entry-card').count(),1);
    assert.equal(await field(page.locator('.entry-card').first(),'name').inputValue(),'Beta | 3.5g');
    await page.close();

    // An old keyed draft with no baseline must not silently undo an intentional clear.
    storage.templates={Alpha:{...product('Alpha'),cost:'12'}};
    const legacyBatch=`save-recovery-${++scenario}`;
    storage[`productWorkspace:${legacyBatch}`]={rows:[{id:'legacy-unbased',key:'Alpha',values:{...product('Alpha'),cost:''},
      baseline:product('Alpha'),stored:null,selected:true,tab:'',collapsed:false}]};
    page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pageURL(`workspace.html?batch=${legacyBatch}`));await page.waitForFunction(()=>initialized);
    alpha=page.locator('.entry-card').first();assert.equal(await field(alpha,'cost').inputValue(),'');
    await save(page);assert.equal(await alpha.locator('[data-save-conflict]:visible').count(),1);
    assert.equal(storage.templates.Alpha.cost,'12');assert.equal(await field(alpha,'cost').inputValue(),'');
    await alpha.getByRole('button',{name:'Keep my edits',exact:true}).click();
    await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    assert.equal(storage.templates.Alpha.cost,'12');await save(page);assert.equal(storage.templates.Alpha.cost,'');
    await page.close();

    // Reserved names remain ordinary own template keys during deletion/recovery.
    page=await open(['constructor']);alpha=page.locator('.entry-card').first();
    await field(alpha,'cost').fill('12');
    await page.evaluate(async()=>{const {templates}=await chrome.storage.local.get('templates');delete templates['constructor'];await chrome.storage.local.set({templates});});
    await save(page);assert.equal(Object.hasOwn(storage.templates,'constructor'),false);
    assert.match(await alpha.locator('[data-save-conflict]').textContent(),/deleted/i);
    await alpha.getByRole('button',{name:'Restore template',exact:true}).click();
    await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    assert.equal(Object.hasOwn(storage.templates,'constructor'),false);
    await save(page);assert.equal(Object.hasOwn(storage.templates,'constructor'),true);
    assert.equal(storage.templates['constructor'].cost,'12');
    assert.equal(Object.getPrototypeOf(storage.templates),Object.prototype);
    assert.deepEqual(errors,[]);
    console.log('Passed workspace repeated saves with sorted storage, metadata changes, disjoint merges, partial conflict saves, stale drafts, fresh conflict-choice reads, explicit keep/use-saved and deletion recovery, unbased legacy clears, reserved keys, and edits during pending merged saves.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
