const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
 const c=vm.createContext({});for(const file of ['fields.js','workspace-model.js','bulk.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 const examples=[
 ['3.5g','Flower','Cannabis Flower Products','Bud/Flower - Each'],
 ['3.5g ground flower','Ground flower','Cannabis Flower Products','Bud/Flower - Each'],
 ['3.5g infused flower','Flower','Cannabis Flower Products','Bud/Flower - Each'],
 ['1g pre-roll','Prerolls','Cannabis Flower Products','Raw Pre-Roll - Each'],
 ['1g 2pk pre-rolls','Preroll Packs','Cannabis Flower Products','Raw Pre-Roll - Each'],
 ['1g infused pre-roll','Prerolls','Cannabis Flower Products','Infused Pre-Roll - Each'],
 ['1g 2pk infused pre-rolls','Preroll Packs','Cannabis Flower Products','Infused Pre-Roll - Each'],
 ['1g AIO','Disposable Vapes','Oil for Vaporization','Vape Cartridge - Each'],
 ['1g cart','Carts','Oil for Vaporization','Vape Cartridge - Each'],
 ['100mg 10pk gummies','Edibles','Gel-based foods','Infused Edible - Each'],
 ['100mg 10pk chocolate','Edibles','Solid chocolates','Infused Edible - Each'],
 ['10mg beverage','Drinks','Beverages','Infused Edible - Each']];
 const types={S:'Sativa',H:'Hybrid',I:'Indica','S/H':'Sativa dominant hybrid','I/H':'Indica dominant hybrid'};
 for(const [suffix,category,reg,ext] of examples) for(const [marker,type] of Object.entries(types)) {
   const name=`Brand | Strain | ${suffix} (${marker})`,p=c.newProduct({}, {name});
   assert.equal(p.category,`${category} (New Category)`,name);assert.equal(p.regulatoryCategory,reg,name);assert.equal(p.externalCategory,ext,name);
   assert.equal(p.strain,type);assert.equal(p.tags,type);
   assert.equal(p.gramsConcentration,suffix.startsWith('100mg')?'0.1':suffix.startsWith('10mg')?'0.01':suffix.startsWith('3.5g')?'3.5':'1');
 }
 const p=c.newProduct({tags:'Limited'},{name:'B | Strain | 1g (H)'}),old=p.name;p.name='B | Strain | 1g (I/H)';c.updateStrainFromTitle(p,old);
 assert.equal(p.tags,'Limited, Indica dominant hybrid');assert.equal(p.strain,'Indica dominant hybrid');
 p.inferTagsFromTitle=false;p.tags='Manual, Hybrid';p.inferStrainFromTitle=false;p.strain='Manual';p.name='B | Strain | 1g (S)';c.updateStrainFromTitle(p,old);assert.equal(p.strain,'Manual');assert.equal(p.tags,'Manual, Hybrid');
 const pasted=c.buildBulkTemplates('B | Strain | 100mg 10pk chocolate (H)\nB | Other | 1g (I)\tManual',{},{}).templates;
 assert.equal(pasted['B | Strain | 100mg 10pk chocolate (H)'].strain,'Hybrid');assert.equal(pasted['B | Other | 1g (I)'].strain,'Manual');assert.equal(pasted['B | Other | 1g (I)'].tags,'Indica');
 assert.equal(c.strainTypeFromTitle('B | Strain | 1g (S) (I)'),'', 'Conflicting markers are ambiguous');
 assert.equal(c.categoryFromTitle('B | Chocolate | 3.5g').category,'Flower (New Category)');
 const {browser,pageURL}=await launchBrowser();
 try {
  const page=await browser.newPage();await page.addInitScript(()=>{const read=()=>JSON.parse(localStorage.store||'{}');window.chrome={storage:{local:{get:async key=>({[key]:read()[key]}),set:async data=>{localStorage.store=JSON.stringify({...read(),...data});},remove:async()=>{}},onChanged:{addListener(){}}}};});
  await page.goto(pageURL('popup.html'));await page.waitForFunction(()=>templateEditorInitialized);
  for(const [suffix,category,reg] of examples){await page.locator('#f_name').fill(`Brand | Strain | ${suffix} (S/H)`);assert.equal(await page.locator('#f_category').inputValue(),`${category} (New Category)`);assert.equal(await page.locator('#f_regulatoryCategory').inputValue(),reg);assert.equal(await page.locator('#f_strain').inputValue(),'Sativa dominant hybrid');}
  await page.locator('#f_name').fill('B | Runtz | 3.5g (H)');assert.equal(await page.locator('#f_tags').inputValue(),'Hybrid');
  await page.locator('#f_strain').fill('Manual');await page.locator('#f_tags').fill('Custom');await page.locator('#f_name').fill('B | Strain | 1g (I)');assert.equal(await page.locator('#f_strain').inputValue(),'Manual');assert.equal(await page.locator('#f_tags').inputValue(),'Custom');
  await page.locator('#useTitleStrain').click();assert.equal(await page.locator('#f_strain').inputValue(),'Indica');assert.equal(await page.locator('#f_tags').inputValue(),'Custom, Indica');
  await page.evaluate(()=>saveDraft());await page.reload();await page.waitForFunction(()=>templateEditorInitialized);await page.locator('#f_name').fill('B | Strain | 1g (S)');assert.equal(await page.locator('#f_tags').inputValue(),'Custom, Sativa');
  await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);await page.locator('#quickNames').fill('B | Strain | 1g 2pk infused pre-rolls (I/H)');await page.locator('#addNames').click();
  const row=page.locator('.entry-card').first();assert.equal(await row.locator('[data-field="strain"]').inputValue(),'Indica dominant hybrid');
  await row.locator('[data-field="name"]').fill('B | Runtz | 100mg 10pk chocolate (H)');
  assert.equal(await row.locator('[data-field="strain"]').inputValue(),'Hybrid');assert.equal(await page.evaluate(()=>[...rows.values()][0].values.tags),'Hybrid');assert.equal(await page.evaluate(()=>[...rows.values()][0].values.regulatoryCategory),'Solid chocolates');
  await row.locator('[data-field="strain"]').fill('Manual');await row.locator('[data-field="name"]').fill('B | Runtz | 10mg beverage (S)');assert.equal(await row.locator('[data-field="strain"]').inputValue(),'Manual');
  await row.getByRole('button',{name:'Strain + tag from title',exact:true}).click();assert.equal(await row.locator('[data-field="strain"]').inputValue(),'Sativa');
  await page.evaluate(()=>applyCompletion('tags',true));assert.equal(await page.evaluate(()=>[...rows.values()][0].values.inferTagsFromTitle),false);
  assert.equal(await page.evaluate(()=>productValues([...rows.values()][0].values).tags),'','An explicit tag clear survives normalization');
  await page.locator('#undoBulk').click();assert.equal(await page.evaluate(()=>[...rows.values()][0].values.inferTagsFromTitle),true);
  await page.goto(pageURL('popup.html'));await page.waitForFunction(()=>templateEditorInitialized);await page.locator('#newBtn').click();
  await page.locator('#f_name').fill('B | Runtz | 3.5g (H)');await page.locator('#templateName').fill('Title test');await page.locator('#saveBtn').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.store).templates?.['Title test']);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.store).templates['Title test']);assert.equal(saved.inferStrainFromTitle,true);assert.equal(saved.inferTagsFromTitle,true);
  await page.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){};URL.createObjectURL=blob=>{blob.text().then(text=>window.testBackup=text);return 'blob:test';};});
  await page.locator('#exportBtn').click();await page.waitForFunction(()=>window.testBackup);const backup=JSON.parse(await page.evaluate(()=>window.testBackup));
  assert.equal(backup.templates['Title test'].inferTagsFromTitle,true);
  await page.locator('#importFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.waitForFunction(()=>document.getElementById('transferStatus').textContent.startsWith('Imported'));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.store).templates['Title test'].inferStrainFromTitle),true);
 } finally {await browser.close();}
 console.log('Passed all 60 title/type combinations, instant popup and bulk updates, manual overrides, tag replacement and draft restoration.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
