const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
 const directory=[{name:'Runtz',type:'H',description:'Sweet citrus and earthy notes.'},{name:'Blue Dream',type:'S',description:'Bright berry and herbal aromas.'},{name:'Runtz',type:'I',description:'Earthy and relaxing.'}];
 const runtz='Brand | Runtz | 3.5g (H)',dream='Brand | Blue Dream | 3.5g (S)';
 const c=vm.createContext({});for(const file of ['fields.js','description.js','strain-directory.js','workspace-model.js','bulk.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 c.setStrainDirectoryCache(directory);const p=c.newProduct({}, {name:runtz});assert.equal(p.onlineDescription,directory[0].description);
 c.editProductField(p,'name',dream);assert.equal(p.onlineDescription,directory[1].description);
 c.editProductField(p,'onlineDescription','Manual');c.editProductField(p,'name',runtz);assert.equal(p.onlineDescription,'Manual');
 c.editProductField(p,'onlineDescription','');c.editProductField(p,'name',dream);assert.equal(p.onlineDescription,'');
 assert.equal(c.newProduct({}, {name:runtz,onlineDescription:'Pasted'}).onlineDescription,'Pasted');
 assert.equal(c.buildBulkTemplates(runtz,{},{}).templates[runtz].onlineDescription,directory[0].description);
 assert.equal(c.productValues({name:runtz,onlineDescription:'Legacy manual'}).onlineDescription,'Legacy manual');
 const base=c.newProduct({}, {name:runtz}),local={...base};c.editProductField(local,'name',dream);const latest={...base};c.editProductField(latest,'onlineDescription','Other edit');
 const merged=c.mergeProductChanges(base,local,latest);assert.ok(merged.conflicts.includes('onlineDescription'));assert.equal(merged.values.name,dream);assert.equal(merged.values.onlineDescription,directory[1].description);
 const {browser,pageURL}=await launchBrowser();
 try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(initial=>{const read=()=>JSON.parse(localStorage.store||JSON.stringify(initial));window.listeners=[];window.chrome={storage:{local:{get:async key=>({[key]:read()[key]}),set:async data=>{const before=read();localStorage.store=JSON.stringify({...before,...data});const changes=Object.fromEntries(Object.entries(data).map(([key,newValue])=>[key,{newValue}]));for(const listener of listeners)listener(changes,'local');},remove:async key=>{const data=read();delete data[key];localStorage.store=JSON.stringify(data);}},onChanged:{addListener:fn=>listeners.push(fn)}}};},{strainDirectory:directory});
  await page.goto(pageURL('popup.html'));await page.waitForFunction(()=>templateEditorInitialized);
  const description=page.locator('#f_onlineDescription');await page.locator('#f_name').fill(runtz);assert.equal(await description.inputValue(),directory[0].description);
  await page.locator('#f_name').fill(dream);assert.equal(await description.inputValue(),directory[1].description);
  await page.locator('#f_name').fill('Brand | Unknown | 1g (H)');assert.equal(await description.inputValue(),'');
  await page.locator('#f_name').fill('Brand | Runtz | 1g (I)');assert.equal(await description.inputValue(),directory[2].description);
  await description.fill('My reviewed paragraph');await page.locator('#f_name').fill(dream);assert.equal(await description.inputValue(),'My reviewed paragraph');
  await description.fill('');await page.locator('#f_name').fill(runtz);assert.equal(await description.inputValue(),'');
  await page.getByRole('button',{name:'Use saved strain description',exact:true}).click();await page.waitForFunction(()=>document.getElementById('f_onlineDescription').value.length>0);
  await page.evaluate(()=>saveDraft());await page.reload();await page.waitForFunction(()=>templateEditorInitialized);await page.locator('#f_name').fill(dream);assert.equal(await description.inputValue(),directory[1].description);
  await page.locator('#templateName').fill('Auto description');await page.locator('#saveBtn').click();await page.waitForFunction(()=>JSON.parse(localStorage.store).templates?.['Auto description']);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.store).templates['Auto description'].inferDescriptionFromDirectory),true);
  await page.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){};URL.createObjectURL=blob=>{blob.text().then(text=>window.backup=text);return 'blob:test';};});await page.locator('#exportBtn').click();await page.waitForFunction(()=>window.backup);const backup=JSON.parse(await page.evaluate(()=>window.backup));assert.equal(backup.templates['Auto description'].inferDescriptionFromDirectory,true);
  await page.locator('#importFile').setInputFiles({name:'auto.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.waitForFunction(()=>document.getElementById('transferStatus').textContent.startsWith('Imported'));assert.equal(await page.evaluate(()=>JSON.parse(localStorage.store).templates['Auto description (imported 1)'].inferDescriptionFromDirectory),true);
  await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);await page.locator('#quickNames').fill(runtz+'\nOther | Blue Dream | 3.5g (S)\t\tPasted custom description');await page.locator('#addNames').click();
  assert.deepEqual(await page.evaluate(()=>[...rows.values()].map(row=>row.values.onlineDescription)),[directory[0].description,'Pasted custom description']);
  const first=page.locator('.entry-card').first();await first.locator('[data-field="name"]').fill(dream);assert.equal(await page.evaluate(()=>[...rows.values()][0].values.onlineDescription),directory[1].description);
  await first.locator('[data-tab="description"]').click();await first.locator('[data-field="onlineDescription"]').fill('Manual in bulk');await first.locator('[data-field="name"]').fill(runtz);assert.equal(await page.evaluate(()=>[...rows.values()][0].values.onlineDescription),'Manual in bulk');
  await first.getByRole('button',{name:'Use saved strain description',exact:true}).click();await page.waitForFunction(()=>[...rows.values()][0].values.onlineDescription.startsWith('Sweet citrus'));
  await page.evaluate(async()=>{const directory=(await chrome.storage.local.get('strainDirectory')).strainDirectory;await chrome.storage.local.set({strainDirectory:directory.map(record=>record.name==='Runtz'&&record.type==='H'?{...record,description:'Updated saved description'}:record)});});await page.waitForFunction(()=>[...rows.values()][0].values.onlineDescription==='Updated saved description');
  await page.evaluate(()=>persistDraft());await page.reload();await page.waitForFunction(()=>initialized);assert.equal(await page.evaluate(()=>[...rows.values()][0].values.inferDescriptionFromDirectory),true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 console.log('Passed immediate directory descriptions, matching types, unknown titles, manual edits/clears, pasted text, drafts, transfer, live directory updates and coherent merging.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
