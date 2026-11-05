const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
 const c=vm.createContext({});for(const file of ['fields.js','workspace-model.js','bulk.js','engine.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 const words=['cured resin','live resin','resin','sugar','honeycomb','badder','budder','diamonds','diamond','hash','RSO','concentrate','concentrates'];
 for(const word of words){const name=`Dank | Runtz | 1g ${word}`,product=c.newProduct({}, {name});assert.equal(product.category,'Concentrate',word);assert.equal(product.regulatoryCategory,'Resin');assert.equal(product.externalCategory,'Concentrate/Extract - Each');assert.equal(product.gramsConcentration,'1');assert.equal(c.valueFor({copyOf:'externalCategory'},product),'Concentrate/Extract - Each');}
 for(const [suffix,category,external] of [['live resin cart','Carts (New Category)','Vape Cartridge - Each'],['live resin AIO','Disposable Vapes (New Category)','Vape Cartridge - Each'],['diamonds infused pre-roll','Prerolls (New Category)','Infused Pre-Roll - Each'],['2pk live resin infused pre-rolls','Preroll Packs (New Category)','Infused Pre-Roll - Each'],['RSO gummies','Edibles (New Category)','Infused Edible - Each']]){const pair=c.categoryFromTitle(`Dank | Runtz | 1g ${suffix}`);assert.equal(pair.category,category);assert.equal(pair.externalCategory,external);}
 assert.equal(c.categoryFromTitle('Sugar | Hash Runtz | 3.5g (H)').category,'Flower (New Category)');
 for(const word of ['sugary','honeycombed','hashish','rsol','diamondback'])assert.equal(c.categoryFromTitle(`Brand | Strain | 1g ${word}`),null);
 assert.equal(c.productValues({category:'Concentrate'}).regulatoryCategory,'Resin');
 assert.equal(c.productValues({category:'Concentrates'}).category,'Concentrate');assert.equal(c.valueFor({key:'category'},{category:'Concentrates'}),'Concentrate');
 assert.equal(c.productValues({name:'Brand | Runtz | 1g badder',category:'Manual',categoryPresetUnlocked:true,inferCategoryFromTitle:false}).category,'Manual');
 const text='Dank | Runtz | 1g cured resin\nDank | Another | 1g LIVE-RESIN (H)';for(const product of Object.values(c.buildBulkTemplates(text,{},{}).templates))assert.equal(product.category,'Concentrate');
 vm.runInContext(`rememberedTitleRules={'live resin':{category:'Custom',regulatoryCategory:'Custom reg',externalCategory:'Custom external'}}`,c);assert.equal(c.categoryFromTitle('B | S | 1g live resin').category,'Custom');
 const {browser,pageURL}=await launchBrowser();
 try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{const read=()=>JSON.parse(localStorage.store||'{}');window.chrome={storage:{local:{get:async key=>({[key]:read()[key]}),set:async data=>{localStorage.store=JSON.stringify({...read(),...data});},remove:async()=>{}},onChanged:{addListener(){}}}};});
  await page.goto(pageURL('popup.html'));await page.waitForFunction(()=>templateEditorInitialized);
  for(const word of words){await page.locator('#f_name').fill(`Dank | Runtz | 1g ${word}`);assert.equal(await page.locator('#f_category').inputValue(),'Concentrate');assert.equal(await page.locator('#f_regulatoryCategory').inputValue(),'Resin');assert.equal(await page.locator('#f_externalCategory').inputValue(),'Concentrate/Extract - Each');}
  await page.locator('#f_name').fill('Dank | Runtz | 1g live resin cart');assert.equal(await page.locator('#f_category').inputValue(),'Carts (New Category)');
  await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);await page.locator('#quickNames').fill(text);await page.locator('#addNames').click();
  assert.deepEqual(await page.evaluate(()=>[...rows.values()].map(row=>[row.values.category,row.values.regulatoryCategory,row.values.externalCategory])),[['Concentrate','Resin','Concentrate/Extract - Each'],['Concentrate','Resin','Concentrate/Extract - Each']]);
  await page.locator('.entry-card').first().locator('[data-field="name"]').fill('Brand | Strain | 1g AIO');assert.equal(await page.evaluate(()=>[...rows.values()][0].values.category),'Disposable Vapes (New Category)');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 console.log('Passed concentrate keywords, exact pairings, weight/Location agreement, product-type precedence, word/section boundaries, manual/custom overrides, popup and bulk creation.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
