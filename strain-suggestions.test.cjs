const assert=require('node:assert/strict');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
  const {browser,pageURL}=await launchBrowser();
  try{
    const context=await browser.newContext(),errors=[];
    const storage={options:{strain:['Runtz','Cake']},templates:{Saved:{name:'Saved',strain:'Chemdog'}}};
    await context.exposeBinding('readStore',(_,key)=>({[key]:storage[key]}));
    await context.exposeBinding('writeStore',async(_,data)=>{
      Object.assign(storage,data);const changes=Object.fromEntries(Object.entries(data).map(([key,newValue])=>[key,{newValue}]));
      await Promise.all(context.pages().flatMap(page=>page.frames()).map(frame=>frame.evaluate(changes=>{for(const fn of window.listeners || [])fn(changes,'local');},changes)));
    });
    await context.addInitScript(()=>{window.listeners=[];window.chrome={storage:{local:{get:key=>readStore(key),set:data=>writeStore(data),remove:async()=>{}},onChanged:{addListener:fn=>listeners.push(fn)}}};});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);
    await page.locator('#addEntry').click();
    const strain=page.locator('.entry-card [data-field="strain"]');
    assert.deepEqual(await strain.evaluate(input=>[...input.list.options].map(o=>o.value)),['Runtz','Cake','Chemdog']);
    await strain.fill('Runtz');await page.locator('.entry-card [data-field="name"]').fill('New product');
    await page.locator('#saveProducts').click();await page.waitForFunction(()=>!saving);
    assert.equal(storage.templates['New product'].strain,'Runtz');
    const popup=await context.newPage();popup.on('pageerror',e=>errors.push(e.message));
    await popup.goto(pageURL('popup.html'));await popup.waitForFunction(()=>document.getElementById('f_strain')?.list?.options.length===3);
    assert.deepEqual(await popup.locator('#f_strain').evaluate(input=>[...input.list.options].map(o=>o.value)),['Runtz','Cake','Chemdog']);
    await page.evaluate(()=>chrome.storage.local.set({options:{strain:['Fresh Strain']}}));
    assert.equal(await strain.inputValue(),'Runtz','Live suggestions must not overwrite chosen strains');
    assert.deepEqual(await strain.evaluate(input=>[...input.list.options].map(o=>o.value)),['Fresh Strain','Chemdog','Runtz']);
    assert.deepEqual(await popup.locator('#f_strain').evaluate(input=>[...input.list.options].map(o=>o.value)),['Fresh Strain','Chemdog','Runtz']);
    await page.locator('#applyField').selectOption('strain');
    assert.deepEqual(await page.locator('#applyChoices option').evaluateAll(options=>options.map(o=>o.value)),['Fresh Strain','Chemdog','Runtz']);
    await strain.fill('Exact manual strain');await page.locator('#saveProducts').click();await page.waitForFunction(()=>!saving);
    assert.equal(storage.templates['New product'].strain,'Exact manual strain');
    await page.reload();await page.waitForFunction(()=>initialized);
    assert.equal(await page.locator('.entry-card [data-field="strain"]').inputValue(),'Exact manual strain');
    assert.deepEqual(errors,[]);
    console.log('Passed learned/saved strain dropdowns in both editors, live updates, shared apply choices, manual values and save/reload.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
