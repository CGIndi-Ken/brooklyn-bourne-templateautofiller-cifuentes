const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main() {
  const {browser,pageURL}=await launchBrowser();
  try {
    const ctx=await browser.newContext(),errors=[];
    const source={name:'Cart A',category:'Carts (New Category)',regulatoryCategory:'Oil for Vaporization',externalCategory:'Vape Cartridge - Each'};
    const storage={templates:{'Cart A':source,'Cart B':{...source,name:'Cart B'},Flower:{name:'Flower',category:'Flower (New Category)'}}};
    const savedTemplates=structuredClone(storage.templates);
    let fail=false;
    await ctx.exposeBinding('readStore',(_,key)=>({[key]:storage[key]}));
    await ctx.exposeBinding('writeStore',async(_,data)=>{
      if(fail && data.categoryPairings) throw Error('Storage unavailable');
      Object.assign(storage,data);
      const changes=Object.fromEntries(Object.entries(data).map(([key,newValue])=>[key,{newValue}]));
      await Promise.all(ctx.pages().flatMap(page=>page.frames()).map(frame=>frame.evaluate(changes=>{
        for(const listener of window.listeners || [])listener(changes,'local');
      },changes)));
    });
    await ctx.addInitScript(()=>{
      window.listeners=[];
      window.chrome={storage:{local:{get:key=>readStore(key),set:data=>writeStore(data),remove:async()=>{}},onChanged:{addListener:listener=>listeners.push(listener)}}};
    });
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pageURL('workspace.html'));
    await page.waitForFunction(()=>initialized);
    await page.evaluate(()=>loadKeys(Object.keys(templates)));
    const first=page.locator('.entry-card').nth(0),second=page.locator('.entry-card').nth(1);
    await page.locator('#entrySearch').fill('Cart');
    await second.getByLabel('Select entry',{exact:true}).uncheck();
    await page.locator('#applyField').selectOption('externalCategory');
    await page.locator('#applyValue').fill('Variety Pack');await page.locator('#applySelected').click();
    const values=()=>page.evaluate(()=>[...rows.values()].map(row=>row.values));
    assert.equal((await values())[0].externalCategory,'Variety Pack','Locked defaults must not discard explicit bulk category edits');
    assert.equal((await values())[1].externalCategory,'Vape Cartridge - Each');
    await page.locator('#rememberCategoryPairs').click();
    await page.waitForFunction(()=>document.getElementById('workspaceStatus').textContent.startsWith('Remembered 1'));
    assert.deepEqual(storage.categoryPairings,{carts:{regulatoryCategory:'Oil for Vaporization',externalCategory:'Variety Pack'}});
    assert.deepEqual(storage.templates,savedTemplates,'Remember does not rewrite any product templates');
    await page.locator('#sharedSource').selectOption('Cart A');await page.locator('#useSource').click();await page.locator('#addEntry').click();
    assert.equal((await values()).at(-1).externalCategory,'Variety Pack');
    assert.equal((await values()).at(-1).cost,'');
    const popup=await ctx.newPage();popup.on('pageerror',e=>errors.push(e.message));
    await popup.goto(pageURL('popup.html'));await popup.waitForSelector('#f_category');
    await popup.locator('#f_category').selectOption('Carts (New Categories)');
    assert.equal(await popup.locator('#f_externalCategory').inputValue(),'Variety Pack');
    await popup.locator('#unlockCategoryPreset').check();
    await popup.locator('#f_regulatoryCategory').selectOption('Cannabis Flower Products');
    await popup.locator('#f_externalCategory').selectOption('Tincture - Each');
    await popup.locator('#rememberCategoryPair').click();
    await popup.waitForFunction(()=>document.getElementById('toast').textContent.startsWith('Category pairings remembered'));
    assert.equal(storage.categoryPairings.carts.externalCategory,'Tincture - Each');
    await page.reload();await page.waitForFunction(()=>initialized);
    assert.equal(await page.evaluate(()=>categoryPresetFor('  CARTS (New Category) ').externalCategory),'Tincture - Each');
    assert.equal(await page.evaluate(()=>categoryPresetFor('Flower').externalCategory),'Bud/Flower - Each');
    // Conflicting pairings never save; one-off unlocked products keep their own values.
    const pairs=structuredClone(storage.categoryPairings);
    await assert.rejects(page.evaluate(()=>rememberCategoryPairings([{category:'Carts',regulatoryCategory:'A',externalCategory:'A'},{category:'Carts (New Categories)',regulatoryCategory:'A',externalCategory:'B'}])),/different pairings/);
    assert.deepEqual(storage.categoryPairings,pairs);
    assert.equal(await page.evaluate(()=>productValues({category:'Carts',categoryPresetUnlocked:true,externalCategory:'Kief - Each'}).externalCategory),'Kief - Each');
    fail=true;
    await assert.rejects(page.evaluate(()=>rememberCategoryPairings([{category:'Carts',regulatoryCategory:'A',externalCategory:'B'}])),/Storage unavailable/);
    assert.equal(await page.evaluate(()=>categoryPresetFor('Carts').externalCategory),'Tincture - Each');fail=false;
    // Export and import restore pairings along with locked product data.
    await popup.evaluate(()=>{const original=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.backupBlob=blob;return original(blob);};});
    await popup.locator('#exportBtn').click();await popup.waitForFunction(()=>!!window.backupBlob);
    const backup=await popup.evaluate(async()=>JSON.parse(await backupBlob.text()));
    assert.deepEqual(backup.categoryPairings,pairs);
    backup.templates={Imported:{name:'Imported',category:'Carts',regulatoryCategory:'Cannabis Flower Products',externalCategory:'Tincture - Each'}};
    await popup.evaluate(()=>chrome.storage.local.set({categoryPairings:{}}));
    await popup.locator('#importFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    await popup.waitForFunction(()=>document.getElementById('transferStatus').textContent.startsWith('Imported'));
    assert.deepEqual(storage.categoryPairings,pairs);
    assert.equal(storage.templates.Imported.externalCategory,'Tincture - Each');
    const storeBefore=structuredClone(storage);
    backup.categoryPairings={carts:{regulatoryCategory:3,externalCategory:'bad'}};
    await popup.locator('#importFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    await popup.waitForFunction(()=>document.getElementById('transferStatus').textContent.startsWith('Import failed'));
    assert.deepEqual(storage,storeBefore);
    // Real fill engine waits for storage and uses remembered pairs, respecting unlock/location scope.
    const calls=[];let release;
    const gate=new Promise(resolve=>release=resolve);
    const fixture=vm.createContext({chrome:{storage:{local:{get:async()=>{await gate;return {categoryPairings:pairs};}},onChanged:{addListener(){}}}},status:{set(){}},ensureTab:async()=>true,fillField:async(def,value)=>{calls.push([def.key,value]);return '';}});
    for(const file of ['fields.js','category-pairings.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),fixture);
    const filling=fixture.runFields([{key:'externalCategory',type:'select'}],{category:'Carts'});
    await Promise.resolve();assert.equal(calls.length,0);release();await filling;
    assert.deepEqual(calls,[['externalCategory','Tincture - Each']]);
    assert.equal(fixture.valueFor({copyOf:'externalCategory'},{category:'Carts'}),'');
    assert.equal(fixture.valueFor({key:'externalCategory'},{category:'Carts',categoryPresetUnlocked:true,externalCategory:'Manual'}),'Manual');
    assert.deepEqual(errors,[]);
    console.log('Passed persistent normalized category pairings, selected-only overrides, cross-editor reuse, conflicts/failures, defaults/unlocks, export/import validation and startup-safe autofill.');
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
