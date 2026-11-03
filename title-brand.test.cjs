const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
 const c=vm.createContext({});for(const file of ['fields.js','workspace-model.js','bulk.js','engine.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 const name='STIIIZY | Purple Haze | 1g AIO';
 assert.equal(c.brandFromTitle(name),'STIIIZY');assert.equal(c.brandFromTitle('  Ben’s Best & Co.  | Strain | 3.5g'),'Ben’s Best & Co.');
 for(const value of ['',null,'Unformatted name',' | Strain | 3.5g'])assert.equal(c.brandFromTitle(value),'');
 const p=c.newProduct({}, {name});assert.equal(p.brand,'STIIIZY');assert.equal(p.inferBrandFromTitle,true);
 c.editProductField(p,'name','Dank | Runtz | 3.5g (H)');assert.equal(p.brand,'Dank');
 c.editProductField(p,'brand','Manual');c.editProductField(p,'name',name);assert.equal(p.brand,'Manual');
 c.editProductField(p,'brand','');c.editProductField(p,'name','Another | Strain | 1g');assert.equal(p.brand,'');
 assert.equal(c.newProduct({brand:'Chosen'}, {name}).brand,'Chosen');
 assert.equal(c.newProduct({brand:'Old',inferBrandFromTitle:true}, {name}).brand,'STIIIZY');
 assert.equal(c.newProduct({}, {name,brand:'Directory choice'}).brand,'Directory choice');
 assert.equal(c.productValues({name,brand:'Legacy'}).brand,'Legacy');
 assert.equal(c.valueFor({key:'brand'},{name,brand:'Stale',inferBrandFromTitle:true}),'STIIIZY');
 const batch=c.buildBulkTemplates(name+'\nDank | Runtz | 3.5g (H)',{},{}).templates;assert.equal(batch[name].brand,'STIIIZY');assert.equal(batch['Dank | Runtz | 3.5g (H)'].brand,'Dank');
 assert.equal(c.buildBulkTemplates(name,{brand:'Chosen'},{}).templates[name].brand,'Chosen');
 const base=c.newProduct({}, {name}),local={...base};c.editProductField(local,'name','Dank | Runtz | 3.5g (H)');
 const merged=c.mergeProductChanges(base,local,{...base,cost:'12'});assert.equal(merged.values.brand,'Dank');assert.equal(merged.values.cost,'12');assert.equal(merged.conflicts.length,0);
 const conflict=c.mergeProductChanges(base,local,{...base,brand:'Manual',inferBrandFromTitle:false});assert.ok(conflict.conflicts.includes('brand'));assert.equal(conflict.values.name,local.name);assert.equal(conflict.values.brand,'Dank');
 const {browser,pageURL}=await launchBrowser();
 try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{const read=()=>JSON.parse(localStorage.store||'{}');window.chrome={storage:{local:{get:async key=>({[key]:read()[key]}),set:async data=>{localStorage.store=JSON.stringify({...read(),...data});},remove:async()=>{}},onChanged:{addListener(){}}}};});
  await page.goto(pageURL('popup.html'));await page.waitForFunction(()=>templateEditorInitialized);
  await page.locator('#f_name').fill(name);assert.equal(await page.locator('#f_brand').inputValue(),'STIIIZY');
  await page.locator('#f_brand').fill('Manual');await page.locator('#f_name').fill('Dank | Runtz | 3.5g (H)');assert.equal(await page.locator('#f_brand').inputValue(),'Manual');
  await page.locator('#useTitleBrand').click();assert.equal(await page.locator('#f_brand').inputValue(),'Dank');
  await page.evaluate(()=>saveDraft());await page.reload();await page.waitForFunction(()=>templateEditorInitialized);
  await page.locator('#f_name').fill(name);assert.equal(await page.locator('#f_brand').inputValue(),'STIIIZY');
  await page.locator('#templateName').fill('Brand test');await page.locator('#saveBtn').click();await page.waitForFunction(()=>JSON.parse(localStorage.store).templates?.['Brand test']);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.store).templates['Brand test'].inferBrandFromTitle),true);
  await page.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){};URL.createObjectURL=blob=>{blob.text().then(text=>window.brandBackup=text);return 'blob:test';};});
  await page.locator('#exportBtn').click();await page.waitForFunction(()=>window.brandBackup);const backup=JSON.parse(await page.evaluate(()=>window.brandBackup));assert.equal(backup.templates['Brand test'].inferBrandFromTitle,true);
  await page.locator('#importFile').setInputFiles({name:'brands.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.waitForFunction(()=>document.getElementById('transferStatus').textContent.startsWith('Imported'));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.store).templates['Brand test'].inferBrandFromTitle),true);
  await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);
  await page.locator('#quickNames').fill('Alpha | One | 1g\nBeta | Two | 3.5g');await page.locator('#addNames').click();
  const first=page.locator('.entry-card').first();assert.deepEqual(await page.evaluate(()=>[...rows.values()].map(row=>row.values.brand)),['Alpha','Beta']);
  await first.locator('[data-field="name"]').fill(name);assert.equal(await first.locator('[data-field="brand"]').inputValue(),'STIIIZY');
  await first.locator('[data-field="brand"]').fill('Manual');await first.locator('[data-field="name"]').fill('New | Strain | 1g');assert.equal(await first.locator('[data-field="brand"]').inputValue(),'Manual');
  await first.getByRole('button',{name:'Brand from title',exact:true}).click();assert.equal(await first.locator('[data-field="brand"]').inputValue(),'New');
  await page.evaluate(()=>persistDraft());await page.reload();await page.waitForFunction(()=>initialized);assert.equal(await page.evaluate(()=>[...rows.values()][0].values.inferBrandFromTitle),true);
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
 console.log('Passed brand extraction, bulk defaults, manual/directory/legacy preservation, coherent merging, instant editor updates, drafts and backup transfers.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
