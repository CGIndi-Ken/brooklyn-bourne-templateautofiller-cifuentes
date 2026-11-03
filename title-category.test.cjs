const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
 const c=vm.createContext({});for(const file of ['fields.js','workspace-model.js','bulk.js','engine.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 const aio='STIIIZY | Purple Haze | 1g AIO', infused='STIIIZY | Strawberry Mango | 1g infused pre-roll';
 const p=c.newProduct({}, {name:aio});assert.equal(p.gramsConcentration,'1');assert.equal(p.category,'Disposable Vapes (New Category)');
 assert.equal(c.productValues({category:'Carts (New Categories)'}).category,'Carts (New Category)');
 assert.equal(c.valueFor({key:'category'},{category:'Carts (New Categories)'}),'Carts (New Category)');
 const q=c.newProduct({}, {name:infused});assert.equal(q.regulatoryCategory,'Cannabis Flower Products');assert.equal(q.externalCategory,'Infused Pre-Roll - Each');
 assert.equal(c.valueFor({key:'externalCategory'},q),'Infused Pre-Roll - Each');
 assert.equal(c.valueFor({copyOf:'externalCategory'},{...q,copyToLocation:true}),'Infused Pre-Roll - Each');
 assert.equal(c.valueFor({copyOf:'externalCategory'},q),'Infused Pre-Roll - Each');
 assert.equal(c.categoryFromTitle('AIO | Infused pre-roll | 1g').category,'Flower (New Category)');assert.equal(c.categoryFromTitle('Brand | Strain | 1g AIOLOGY'),null);
 assert.equal(c.categoryFromTitle('Brand | Strain | 1g INFUSED PREROLL (H)').category,q.category);
 assert.equal(c.buildBulkTemplates(aio+'\n'+infused,{},{}).templates[infused].externalCategory,q.externalCategory);
 assert.equal(c.productValues({...q,inferCategoryFromTitle:false,categoryPresetUnlocked:true,externalCategory:'Manual'}).externalCategory,'Manual');
 const oldName=q.name;q.name='Brand | Strain | 1g';c.updateCategoryFromTitle(q,oldName);assert.equal(q.category,'Flower (New Category)');
 q.name='Brand | Strain | 1g unknown type';c.updateCategoryFromTitle(q,'Brand | Strain | 1g');assert.equal(q.category,'');
 const flower='Dank | Cheese & Chong | 28g (H)';
 for(const name of [flower,'Dank | Cheese & Chong | 28g','Brand | AIO | 28g (I/H)','Brand | Strain | 1g 2pk (S/H)','Brand | Strain | 1g, Qty 2 (H)']) {
   const product=c.newProduct({}, {name});assert.equal(product.category,'Flower (New Category)');assert.equal(product.regulatoryCategory,'Cannabis Flower Products');assert.equal(product.externalCategory,'Bud/Flower - Each');
   assert.equal(c.valueFor({copyOf:'externalCategory'},product),'Bud/Flower - Each');
 }
 assert.equal(c.categoryFromTitle('Dank | Strain | 28g mystery type (H)'),null,'An unknown designation is not absent');
 assert.equal(c.categoryFromTitle('Dank | Strain | (H)'),null,'Keep requiring a recognized weight');
 assert.equal(c.newProduct({}, {name:flower}).gramsConcentration,'28');
 assert.equal(c.buildBulkTemplates(flower,{},{}).templates[flower].externalCategory,'Bud/Flower - Each');
 const {browser,pageURL}=await launchBrowser();
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const read=()=>JSON.parse(localStorage.store || '{}');window.chrome={storage:{local:{get:async key=>({[key]:read()[key]}),set:async data=>{localStorage.store=JSON.stringify({...read(),...data});},remove:async key=>{const s=read();delete s[key];localStorage.store=JSON.stringify(s);}},onChanged:{addListener(){}}}};});
  await page.goto(pageURL('popup.html'));await page.waitForFunction(()=>templateEditorInitialized);
  assert.equal(await page.evaluate(()=>optionsFor({key:'category',options:['Carts (New Categories)','Carts (New Category)']}).filter(value=>value==='Carts (New Category)').length),1);
  await page.locator('#f_name').fill(flower);assert.equal(await page.locator('#f_category').inputValue(),'Flower (New Category)');assert.equal(await page.locator('#f_externalCategory').inputValue(),'Bud/Flower - Each');assert.equal(await page.locator('#f_gramsConcentration').inputValue(),'28');
  await page.locator('#f_name').fill(aio);assert.equal(await page.locator('#f_gramsConcentration').inputValue(),'1');assert.equal(await page.locator('#f_category').inputValue(),p.category);
  await page.locator('#f_name').fill(infused);assert.equal(await page.locator('#f_externalCategory').inputValue(),'Infused Pre-Roll - Each');
  await page.locator('#f_category').selectOption('Flower (New Category)');await page.locator('#f_name').fill(aio);assert.equal(await page.locator('#f_category').inputValue(),'Flower (New Category)');
  await page.locator('#useTitleCategory').click();assert.equal(await page.locator('#f_category').inputValue(),p.category);
  await page.locator('#templateName').fill('AIO');await page.locator('#saveBtn').click();await page.waitForFunction(()=>!document.getElementById('saveBtn').disabled);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.store).templates.AIO.inferCategoryFromTitle),true);
  await page.locator('#f_name').fill(infused);
  const phrase=page.getByRole('textbox',{name:'Title category phrase'});await page.getByText('Remember title category rules',{exact:true}).click();await phrase.fill('resin stick');
  await page.getByRole('button',{name:'Remember title pairing',exact:true}).click();await page.waitForFunction(()=>rememberedTitleRules['resin stick']);
  await page.locator('#f_name').fill('Brand | Strain | 1g resin stick');assert.equal(await page.locator('#f_externalCategory').inputValue(),'Infused Pre-Roll - Each');
  await page.evaluate(()=>saveDraft());await page.reload();await page.waitForFunction(()=>templateEditorInitialized);assert.equal(await page.locator('#f_category').inputValue(),'Prerolls (New Category)');
  await page.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){};URL.createObjectURL=blob=>{blob.text().then(text=>window.ruleBackup=text);return 'blob:test';};});
  await page.locator('#exportBtn').click();await page.waitForFunction(()=>window.ruleBackup);
  const backup=JSON.parse(await page.evaluate(()=>window.ruleBackup));assert.equal(backup.titleCategoryRules['resin stick'].externalCategory,'Infused Pre-Roll - Each');assert.equal(backup.templates.AIO.inferCategoryFromTitle,true);
  await page.getByText('Remember title category rules',{exact:true}).click();
  await page.getByRole('combobox',{name:'Remembered title category rules'}).selectOption('resin stick');
  await page.getByRole('button',{name:'Remove custom rule',exact:true}).click();await page.waitForFunction(()=>!rememberedTitleRules['resin stick']);
  await page.locator('#importFile').setInputFiles({name:'rules.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.waitForFunction(()=>document.getElementById('transferStatus').textContent.startsWith('Imported'));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.store).titleCategoryRules['resin stick'].category),'Prerolls (New Category)');
  await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);await page.locator('#quickNames').fill(aio.replace('Purple Haze','Blue Dream')+'\n'+infused);await page.locator('#addNames').click();
  const cards=page.locator('.entry-card');assert.equal(await cards.count(),2);
  assert.equal(await page.evaluate(()=>[...rows.values()][1].values.externalCategory),'Infused Pre-Roll - Each');
  await cards.nth(0).locator('[data-field="name"]').fill(infused);assert.equal(await page.evaluate(()=>[...rows.values()][0].values.externalCategory),'Infused Pre-Roll - Each');
  await cards.nth(0).locator('[data-field="name"]').fill(flower);assert.equal(await page.evaluate(()=>[...rows.values()][0].values.externalCategory),'Bud/Flower - Each');assert.equal(await cards.nth(0).locator('[data-field="gramsConcentration"]').inputValue(),'28');
  assert.deepEqual(errors,[]);console.log('Passed title categories, paired autofill, suffix boundaries, independent manual mode, clearing, custom rules, saved drafts and bulk entry.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
