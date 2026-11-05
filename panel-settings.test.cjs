const assert=require('node:assert/strict'),path=require('node:path');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
 const {browser}=await launchBrowser();
 try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('about:blank');await page.setContent('<div data-testid="product-detail-preview"></div>');
  await page.evaluate(()=>{
    window.saved={},window.writeOrder=[],window.readResolvers={};window.failureMode='',window.delayReads=true;
    window.chrome={storage:{local:{get:async key=>{
      if(delayReads && ['panelMin','statusMin'].includes(key))return await new Promise(resolve=>readResolvers[key]=resolve);
      return {[key]:key==='templates'?{A:{name:'A'}}:saved[key]};
    },set(data){
      if(failureMode==='throw')throw new Error('Extension context invalidated.');
      if(failureMode==='reject')return Promise.reject(new Error('Storage unavailable'));
      writeOrder.push(data);if(window.holdWrite){window.holdWrite=false;return new Promise(resolve=>window.finishWrite=()=>{Object.assign(saved,data);resolve();});}
      Object.assign(saved,data);return Promise.resolve();
    }},onChanged:{addListener(){}}},runtime:{onMessage:{addListener(){}}}};
  });
  for(const file of ['fields.js','dom-utils.js','fillers.js','engine.js','learn.js','theme.js','template-picker-style.js','template-picker.js','panel.js'])await page.addScriptTag({path:path.join(__dirname,file)});
  await page.waitForFunction(()=>steps.length>0);
  await page.evaluate(async()=>{setMinimized(true);$s('statusToggle').__onPress();await panelSettingWrites;readResolvers.panelMin({panelMin:false});readResolvers.statusMin({statusMin:false});});
  assert.equal(await page.evaluate(()=>minimized),true,'Slow startup read must not reopen a just-minimized panel');assert.equal(await page.evaluate(()=>statusMinimized),true);
  await page.evaluate(async()=>{failureMode='throw';setMinimized(false);await panelSettingWrites;});
  assert.equal(await page.evaluate(()=>minimized),false,'Local minimize/restore still works when persistence fails');
  assert.match(await page.evaluate(()=>statusEl.textContent),/Refresh this Dutchie tab/);
  assert.match(await page.evaluate(()=>pill.title),/Refresh this Dutchie tab/);
  await page.evaluate(async()=>{failureMode='reject';setMinimized(true);$s('statusToggle').__onPress();await panelSettingWrites;});
  assert.match(await page.evaluate(()=>statusEl.textContent),/preference could not be saved/);
  await page.evaluate(async()=>{failureMode='';writeOrder=[];window.holdWrite=true;setMinimized(false);setMinimized(true);setMinimized(false);await Promise.resolve();});
  assert.equal(await page.evaluate(()=>writeOrder.length),1,'Later writes wait for the pending first save');
  await page.evaluate(async()=>{finishWrite();await panelSettingWrites;});
  assert.deepEqual(await page.evaluate(()=>writeOrder.map(data=>data.panelMin)),[false,true,false]);assert.equal(await page.evaluate(()=>saved.panelMin),false);
  await page.evaluate(async()=>{const original=chrome.storage.local.get;chrome.storage.local.get=()=>{throw new Error('Extension context invalidated.');};await restorePanelPreference('panelMin',()=>{});await loadTemplates().catch(panelStorageFailure);chrome.storage.local.get=original;});
  assert.match(await page.evaluate(()=>statusEl.textContent),/Refresh this Dutchie tab/);
  assert.deepEqual(errors,[],'Storage failures must not cause uncaught errors or unhandled rejections');
  console.log('Passed panel preference synchronous/rejected failures, invalidated-context feedback, local controls, ordered writes and late-read protection.');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
