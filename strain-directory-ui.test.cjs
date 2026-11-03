const assert=require('node:assert/strict');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
 const descriptions={runtz:'Sweet citrus and earthy notes with a mellow finish.',indica:'Earthy herbs and a deep relaxing finish.',dream:'Bright berry and herbal aromas.'};
 const templates={
  Runtz:{name:'Brand | Runtz | 3.5g (H)',strain:'Hybrid',onlineDescription:descriptions.runtz},
  RuntzCopy:{name:'Other | Runtz | 7g (H)',onlineDescription:descriptions.runtz},
  RuntzIndica:{name:'Brand | Runtz | 3.5g (I)',onlineDescription:descriptions.indica},
  BlueDream:{name:'Brand | Blue Dream | 3.5g (S)',onlineDescription:descriptions.dream},
  ConflictOne:{name:'Brand | Sour Diesel | 3.5g (S)',onlineDescription:'First paragraph.'},
  ConflictTwo:{name:'Other | Sour Diesel | 7g (S)',onlineDescription:'Another paragraph.'},
  TypeOnly:{name:'Legacy product',strain:'Hybrid',onlineDescription:'Do not save a strain type as its name.'}
 };
 const storage={templates:structuredClone(templates)},errors=[];let directoryWriteGate=null;
 const {browser,pageURL}=await launchBrowser();
 try {
  const context=await browser.newContext({viewport:{width:1280,height:1000}});
  await context.exposeBinding('readStrainTestStorage',(_,key)=>({[key]:storage[key]}));
  await context.exposeBinding('writeStrainTestStorage',async(_,data)=>{
    if(data.strainDirectory && directoryWriteGate){const gate=directoryWriteGate;directoryWriteGate=null;gate.started();await gate.promise;}
    const changes=Object.fromEntries(Object.entries(data).map(([key,newValue])=>[key,{oldValue:storage[key],newValue}]));
    Object.assign(storage,structuredClone(data));
    await Promise.all(context.pages().flatMap(page=>page.frames()).map(frame=>frame.evaluate(changes=>{for(const listener of window.strainTestListeners||[])listener(changes,'local');},changes).catch(()=>{})));
  });
  await context.exposeBinding('removeStrainTestStorage',(_,key)=>{delete storage[key];});
  await context.addInitScript(()=>{
    window.strainTestListeners=[];window.chrome={storage:{local:{get:key=>readStrainTestStorage(key),set:data=>writeStrainTestStorage(data),remove:key=>removeStrainTestStorage(key)},onChanged:{addListener:listener=>strainTestListeners.push(listener)}},runtime:{getURL:file=>new URL(file,location.href).href},windows:{create:async()=>({id:1})}};
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto(pageURL('workspace.html')+'?view=strains');await page.waitForFunction(()=>initialized);
  await page.locator('.strain-directory-item').nth(2).waitFor();
  assert.equal(storage.strainDirectory.length,3,'Initial pool deduplicates descriptions and avoids conflicting or type-only strain names');
  assert.equal(await page.locator('#productsView').isHidden(),true);
  assert.equal(await page.locator('#directoryStrainDescription').getAttribute('maxlength'),'2500');
  await page.locator('#strainDirectorySearch').fill('Runtz');assert.equal(await page.locator('.strain-directory-item').count(),2);
  const hybrid=page.locator('.strain-directory-item').filter({hasText:'Runtz'}).filter({hasText:'Hybrid'});
  await hybrid.click();assert.equal(await page.locator('#directoryStrainType').inputValue(),'H');assert.equal(await page.locator('#directoryStrainDescription').inputValue(),descriptions.runtz);
  const curated='Reviewed Runtz paragraph with citrus, herbs and a calm finish.';
  await page.locator('#directoryStrainDescription').fill(curated);await page.locator('#saveStrain').click();await page.waitForFunction(()=>document.getElementById('strainDirectoryStatus').textContent==='Saved Runtz.');
  await page.locator('#collectStrains').click();await page.waitForFunction(()=>document.getElementById('strainDirectoryStatus').textContent.startsWith('Collected'));
  assert.equal(storage.strainDirectory.find(record=>record.name==='Runtz'&&record.type==='H').description,curated,'Collect preserves curated entries');
  assert.match(await page.locator('#strainDirectoryStatus').textContent(),/2 conflicting/);
  await page.locator('#newStrain').click();await page.locator('#directoryStrainName').fill('Gelato');await page.locator('#directoryStrainType').selectOption('H');await page.locator('#directoryStrainDescription').fill('Sweet creamy aroma.');await page.locator('#saveStrain').click();await page.waitForFunction(()=>document.getElementById('strainDirectoryStatus').textContent==='Saved Gelato.');
  assert.equal(storage.strainDirectory.length,4);
  await page.locator('#newStrain').click();await page.locator('#directoryStrainName').fill(' RUNTZ ');await page.locator('#directoryStrainType').selectOption('H');await page.locator('#saveStrain').click();await page.waitForFunction(()=>document.getElementById('strainDirectoryStatus').textContent.includes('already exist'));assert.equal(storage.strainDirectory.length,4);
  await page.locator('#strainDirectorySearch').fill('Gelato');await page.locator('.strain-directory-item').click();await page.locator('#deleteStrain').click();await page.waitForFunction(()=>document.getElementById('strainDirectoryStatus').textContent.startsWith('Strain deleted'));assert.equal(storage.strainDirectory.length,3);
  await page.locator('#strainDirectorySearch').fill('Blue Dream');await page.locator('.strain-directory-item').click();await page.locator('#deleteStrain').click();await page.waitForFunction(()=>document.getElementById('strainDirectoryStatus').textContent.startsWith('Strain deleted'));
  await page.reload();await page.waitForFunction(()=>initialized);await page.locator('#strainDirectorySearch').fill('Blue Dream');assert.equal(await page.locator('.strain-directory-item').count(),0,'Deleted seeded records stay deleted on reopen');
  await page.locator('#collectStrains').click();await page.waitForFunction(()=>document.getElementById('strainDirectoryStatus').textContent.startsWith('Collected'));assert.equal(storage.strainDirectory.some(record=>record.name==='Blue Dream'),true,'Explicit collect may restore a saved-template strain');
  assert.deepEqual(storage.templates,templates,'Directory operations do not rewrite saved templates');

  const popup=await context.newPage();popup.on('pageerror',error=>errors.push(error.message));await popup.goto(pageURL('popup.html'));await popup.waitForFunction(()=>templateEditorInitialized);
  await popup.locator('[data-popup-view="strains"]').click();const frame=popup.frameLocator('#strainsWorkspace');await frame.locator('#strainDirectorySearch').waitFor();
  assert.equal(await frame.locator('.strain-directory-item').count(),3);
  await popup.locator('[data-popup-view="template"]').click();await popup.locator('#f_name').fill('Brand | Runtz | 1g (H)');
  assert.equal(await popup.locator('#f_onlineDescription').inputValue(),'','Matching a title alone never overwrites or silently adds descriptions');
  await popup.getByRole('button',{name:'Use saved strain description',exact:true}).click();await popup.waitForFunction(()=>document.getElementById('f_onlineDescription').value.startsWith('Reviewed Runtz'));
  assert.equal(await popup.locator('#f_onlineDescription').inputValue(),curated);
  await popup.locator('#f_name').fill('Brand | Unknown strain | 3.5g (H)');await popup.getByRole('button',{name:'Use saved strain description',exact:true}).click();await popup.waitForFunction(()=>document.getElementById('descriptionStatus').textContent.includes('No unambiguous'));assert.equal(await popup.locator('#f_onlineDescription').inputValue(),curated,'Missing directory matches leave existing descriptions intact');
  await popup.locator('#f_name').fill('Brand | Runtz | 3.5g (S)');await popup.getByRole('button',{name:'Use saved strain description',exact:true}).click();await popup.waitForFunction(()=>document.getElementById('descriptionStatus').textContent.includes('No unambiguous'));assert.equal(await popup.locator('#f_onlineDescription').inputValue(),curated,'Lookup never substitutes a different known strain type');
  await popup.locator('#f_name').fill('Brand | Runtz | 1g (H)');
  await popup.locator('#f_onlineDescription').fill('Different manual text.');await popup.getByRole('button',{name:'Remember strain description',exact:true}).click();await popup.waitForFunction(()=>document.getElementById('descriptionStatus').textContent.includes('different description'));assert.equal(storage.strainDirectory.find(record=>record.name==='Runtz'&&record.type==='H').description,curated);
  await popup.locator('#f_name').fill('Brand | Jealousy | 3.5g (I)');await popup.locator('#f_onlineDescription').fill('Rich floral and earthy aroma.');await popup.getByRole('button',{name:'Remember strain description',exact:true}).click();await popup.waitForFunction(()=>document.getElementById('descriptionStatus').textContent.startsWith('Remembered Jealousy'));
  assert.equal(storage.strainDirectory.find(record=>record.name==='Jealousy').type,'I');
  await popup.evaluate(()=>saveDraft());await popup.reload();await popup.waitForFunction(()=>templateEditorInitialized);assert.equal(await popup.locator('#f_onlineDescription').inputValue(),'Rich floral and earthy aroma.');
  await popup.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){};URL.createObjectURL=blob=>{blob.text().then(text=>window.strainBackup=text);return 'blob:test';};});
  await popup.locator('#exportBtn').click();await popup.waitForFunction(()=>window.strainBackup);const backup=JSON.parse(await popup.evaluate(()=>window.strainBackup));assert.equal(backup.strainDirectory.length,4);assert.equal(backup.strainDirectory.find(record=>record.name==='Jealousy').description,'Rich floral and earthy aroma.');
  const incoming={...backup,strainDirectory:[...backup.strainDirectory,{name:'Imported Strain',type:'S/H',description:'Imported paragraph.'}].map(record=>record.name==='Runtz'&&record.type==='H'?{...record,description:'Do not overwrite curated text.'}:record)};
  await popup.locator('#importFile').setInputFiles({name:'strain-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});await popup.waitForFunction(()=>document.getElementById('transferStatus').textContent.startsWith('Imported'));
  assert.equal(storage.strainDirectory.find(record=>record.name==='Runtz'&&record.type==='H').description,curated);assert.equal(storage.strainDirectory.find(record=>record.name==='Imported Strain').description,'Imported paragraph.');
  const beforeInvalid=structuredClone(storage.strainDirectory);await popup.locator('#importFile').setInputFiles({name:'bad-strains.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...backup,strainDirectory:[{name:'Bad',type:'Unknown',description:'Invalid'}]}))});await popup.waitForFunction(()=>document.getElementById('transferStatus').textContent.includes('valid type'));assert.deepEqual(storage.strainDirectory,beforeInvalid);

  await page.locator('[data-view="products"]').click();
  const names=['Shown A | Runtz | 1g (H)','Shown B | Blue Dream | 3.5g (S)','Shown C | Jealousy | 3.5g (I)','Hidden | Runtz | 3.5g (I)','Shown D | Runtz | 7g (H)'];
  await page.locator('#quickNames').fill(names.join('\n'));await page.locator('#addNames').click();assert.equal(await page.locator('.entry-card').count(),5);
  await page.evaluate(()=>{const items=[...rows.values()];items[2].values.onlineDescription='Keep manual paragraph.';refreshValues(items[2]);items[4].selected=false;items[4].element.querySelector('[data-action="select"]').checked=false;updateMetrics();});
  await page.locator('#entrySearch').fill('Shown');await page.locator('#fillDirectoryDescriptions').click();await page.waitForFunction(()=>document.getElementById('workspaceStatus').textContent.includes('2 descriptions filled'));
  assert.deepEqual(await page.evaluate(()=>[...rows.values()].map(row=>row.values.onlineDescription)),[curated,descriptions.dream,'Keep manual paragraph.','','']);
  await page.locator('#undoBulk').click();assert.deepEqual(await page.evaluate(()=>[...rows.values()].map(row=>row.values.onlineDescription)),['','','Keep manual paragraph.','','']);
  const first=page.locator('.entry-card').first();await first.locator('[data-tab="description"]').click();await first.getByRole('button',{name:'Use saved strain description',exact:true}).click();await page.waitForFunction(()=>[...rows.values()][0].values.onlineDescription.startsWith('Reviewed Runtz'));
  await page.locator('#fillDirectoryDescriptions').click();await page.waitForFunction(()=>document.getElementById('workspaceStatus').textContent.includes('1 descriptions filled'));
  await page.evaluate(()=>persistDraft());await page.reload();await page.waitForFunction(()=>initialized);assert.equal(await page.evaluate(()=>[...rows.values()][0].values.onlineDescription),curated);await page.locator('[data-view="products"]').click();
  await page.locator('#saveSelected').click();await page.waitForFunction(()=>!saving && document.getElementById('workspaceStatus').textContent.startsWith('Saved'));
  assert.equal(storage.templates[names[0]].onlineDescription,curated);assert.equal(storage.templates[names[1]].onlineDescription,descriptions.dream);assert.equal(storage.templates[names[2]].onlineDescription,'Keep manual paragraph.');assert.equal(storage.templates[names[3]],undefined);assert.equal(storage.templates[names[4]],undefined);
  await page.locator('[data-view="strains"]').click();
  await page.locator('#newStrain').click();await page.locator('#directoryStrainName').fill('Pending save strain');await page.locator('#directoryStrainType').selectOption('H');await page.locator('#directoryStrainDescription').fill('Submitted paragraph.');
  let releaseWrite,writeStarted;const started=new Promise(resolve=>writeStarted=resolve);directoryWriteGate={started:writeStarted,promise:new Promise(resolve=>releaseWrite=resolve)};
  await page.locator('#saveStrain').click();await started;await page.locator('#directoryStrainDescription').fill('Newer unsaved paragraph.');releaseWrite();
  await page.waitForFunction(()=>document.getElementById('strainDirectoryStatus').textContent.includes('newer edits'));
  assert.equal(storage.strainDirectory.find(record=>record.name==='Pending save strain').description,'Submitted paragraph.');assert.equal(await page.locator('#directoryStrainDescription').inputValue(),'Newer unsaved paragraph.','A delayed save preserves edits made while writing');
  await page.locator('#saveStrain').click();await page.waitForFunction(()=>document.getElementById('strainDirectoryStatus').textContent==='Saved Pending save strain.');assert.equal(storage.strainDirectory.find(record=>record.name==='Pending save strain').description,'Newer unsaved paragraph.');
  await page.locator('#newStrain').click();await page.locator('#directoryStrainName').fill('First queued strain');await page.locator('#directoryStrainDescription').fill('First queued paragraph.');
  let releaseQueued,startedQueued;const queuedStarted=new Promise(resolve=>startedQueued=resolve);directoryWriteGate={started:startedQueued,promise:new Promise(resolve=>releaseQueued=resolve)};
  await page.locator('#saveStrain').click();await queuedStarted;
  await page.locator('#newStrain').click();await page.locator('#directoryStrainName').fill('Second queued strain');await page.locator('#directoryStrainDescription').fill('Second queued paragraph.');releaseQueued();
  await page.waitForFunction(()=>!document.getElementById('saveStrain').disabled);assert.equal(await page.locator('#directoryStrainName').inputValue(),'Second queued strain');
  await page.locator('#saveStrain').click();await page.waitForFunction(()=>document.getElementById('strainDirectoryStatus').textContent==='Saved Second queued strain.');
  assert.equal(storage.strainDirectory.find(record=>record.name==='First queued strain').description,'First queued paragraph.','Starting a new form during a pending create must not rename or replace that submitted record');
  assert.equal(storage.strainDirectory.find(record=>record.name==='Second queued strain').description,'Second queued paragraph.');
  await page.locator('#strainDirectorySearch').fill('Runtz');await page.locator('.strain-directory-item').filter({hasText:'Hybrid'}).click();
  await page.evaluate(async()=>{const directory=(await chrome.storage.local.get('strainDirectory')).strainDirectory;await chrome.storage.local.set({strainDirectory:directory.map(record=>record.name==='Runtz'&&record.type==='H'?{...record,description:'Saved by another window.'}:record)});});
  await page.locator('#directoryStrainDescription').fill('Stale local edit.');await page.locator('#saveStrain').click();await page.waitForFunction(()=>document.getElementById('strainDirectoryStatus').textContent.includes('changed in another window'));assert.equal(storage.strainDirectory.find(record=>record.name==='Runtz'&&record.type==='H').description,'Saved by another window.');
  await page.setViewportSize({width:430,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(errors,[]);
  console.log('Passed strain directory auto-pooling, typed search and CRUD, curated preservation, popup/iframe and bulk reuse, scoped blank fills, Undo, drafts/saving, backup transfer and narrow layouts.');
 } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
