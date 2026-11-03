const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
  const calls=[],c=vm.createContext({ensureTab:async()=>true,fillField:async(def,value)=>{calls.push([def.key,value]);return '';},status:{set(){}}});
  for(const file of ['fields.js','workspace-model.js','bulk.js','engine.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
  const old={name:'Legacy',taxCategories:'Other',lowInventoryThreshold:'99',copyToLocation:false,cost:'12',medBasePrice:'24'};
  for(const product of [c.newProduct(old),c.productValues(old),c.buildBulkTemplates('New',old,{}).templates.New]){
    assert.equal(product.taxCategories,'Cannabis');assert.equal(product.lowInventoryThreshold,'0');assert.equal(product.copyToLocation,true);
  }
  await vm.runInContext('runFields(FIELD_DEFS, '+JSON.stringify(old)+')',c);
  for(const [key,value] of [['taxCategories','Cannabis'],['lowInventoryThreshold','0'],['locLowStock','0'],['locCost','12'],['locBasePrice','24']])assert.ok(calls.some(call=>call[0]===key && call[1]===value),`${key} must be applied even for legacy templates`);
  assert.equal(c.valueFor({copyOf:'externalId'},old),'','Blank copies remain skipped');
  const {browser,pageURL}=await launchBrowser();
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{const read=()=>JSON.parse(localStorage.store || '{}');window.chrome={storage:{local:{get:async key=>({[key]:read()[key]}),set:async data=>{localStorage.store=JSON.stringify({...read(),...data});},remove:async key=>{const s=read();delete s[key];localStorage.store=JSON.stringify(s);}},onChanged:{addListener(){}}}};});
    await page.goto(pageURL('popup.html'));await page.waitForFunction(()=>templateEditorInitialized);
    for(const [id,value] of [['f_taxCategories','Cannabis'],['f_lowInventoryThreshold','0']]){assert.equal(await page.locator('#'+id).inputValue(),value);assert.equal(await page.locator('#'+id).isDisabled(),true);}
    assert.equal(await page.locator('#copyLoc').isChecked(),true);assert.equal(await page.locator('#copyLoc').isDisabled(),true);
    await page.evaluate(async old=>{await chrome.storage.local.set({templates:{Old:old}});await refresh();},old);
    await page.locator('#templateSelect').selectOption('Old',{force:true});await page.waitForFunction(()=>document.getElementById('f_name').value==='Legacy');
    assert.equal(await page.locator('#f_taxCategories').inputValue(),'Cannabis');assert.equal(await page.locator('#copyLoc').isChecked(),true);
    await page.locator('#saveBtn').click();await page.waitForFunction(()=>!document.getElementById('saveBtn').disabled);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.store).templates.Old.copyToLocation),true);
    await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);
    await page.evaluate(()=>{loadKeys(['Old']);});
    assert.equal(await page.evaluate(()=>[...rows.values()][0].values.lowInventoryThreshold),'0');
    assert.equal(await page.locator('#applyField option[value="copyToLocation"]').count(),0);
    assert.equal(await page.locator('#applyField option[value="taxCategories"]').count(),0);
    assert.equal(await page.locator('#applyField option[value="lowInventoryThreshold"]').count(),0);
    assert.deepEqual(errors,[]);console.log('Passed required Cannabis tax, zero thresholds on both tabs, always-on copies, legacy normalization, locked popup controls and bulk defaults.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
