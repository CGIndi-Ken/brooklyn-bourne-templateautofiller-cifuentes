// Operation-count regressions, not a claim about live Dutchie completion time.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser-test-helper.cjs');

async function main() {
  let textEvents = 0;
  const field = {value:'Same value', focus(){textEvents++;}, blur(){textEvents++;}, dispatchEvent(){textEvents++;}};
  const fixture = vm.createContext({elFor:()=>field, setNativeValue:()=>{textEvents++;}, Event:class {}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'fillers.js'),'utf8'),fixture);
  assert.equal(fixture.fillText({label:'Name'},'Same value'),'');
  assert.equal(textEvents,0);
  assert.equal(fixture.fillText({label:'Name'},'New value'),'');
  assert.equal(textEvents,4);

  const {browser, pageURL} = await launchBrowser();
  try {
    const context = await browser.newContext();
    const storage = {};
    let draftWrites = 0;
    await context.exposeBinding('readStorage',(_,key)=>({[key]:storage[key]}));
    await context.exposeBinding('writeStorage',(_,data)=>{if(data.templateDraft)draftWrites++;Object.assign(storage,data);});
    await context.exposeBinding('removeStorage',(_,key)=>{delete storage[key];});
    await context.addInitScript(()=>{
      window.chrome={storage:{local:{get:key=>window.readStorage(key),set:data=>window.writeStorage(data),remove:key=>window.removeStorage(key)},onChanged:{addListener(){}}},runtime:{onMessage:{addListener(){}}}};
    });
    const page = await context.newPage();
    await page.goto(pageURL('popup.html'));
    await page.waitForSelector('#f_name');
    await page.evaluate(()=>{
      const el=document.getElementById('f_name');
      for(let i=0;i<50;i++){el.value+='x';el.dispatchEvent(new Event('input',{bubbles:true}));}
    });
    await new Promise(resolve=>setTimeout(resolve,250));
    assert.equal(storage.templateDraft?.values.name.length,50);
    assert.equal(draftWrites,1,'A burst of input should create one draft write');
    await page.evaluate(()=>document.getElementById('f_name').dispatchEvent(new Event('input',{bubbles:true})));
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    assert.equal(draftWrites,1,'Unchanged drafts should not be written again');
    await page.evaluate(()=>{
      const el=document.getElementById('f_name');el.value='Final edit';el.dispatchEvent(new Event('input',{bubbles:true}));
      window.dispatchEvent(new Event('pagehide'));
    });
    assert.equal(storage.templateDraft?.values.name,'Final edit');
    await page.reload();
    await page.waitForFunction(()=>document.getElementById('f_name')?.value==='Final edit');
    await page.getByRole('button',{name:'New',exact:true}).click();
    await page.reload();
    await page.waitForSelector('#f_name');
    assert.equal(await page.locator('#f_name').inputValue(),'','New must clear pending drafts');

    const panel = await context.newPage();
    await panel.goto('about:blank');
    await panel.setContent('<body><main id="route"></main></body>');
    await panel.evaluate(()=>{
      window.formQueries=0;window.intervals=0;
      const query=document.querySelector.bind(document),interval=window.setInterval.bind(window);
      document.querySelector=(selector)=>{if(selector==='[data-testid^="product-detail"]')window.formQueries++;return query(selector);};
      window.setInterval=(...args)=>{window.intervals++;return interval(...args);};
    });
    for(const file of ['fields.js','dom-utils.js','fillers.js','engine.js','learn.js','theme.js','template-picker-style.js','template-picker.js','panel.js']) await panel.addScriptTag({path:path.join(__dirname,file)});
    const visible=()=>panel.locator('#box').isVisible();
    assert.equal(await visible(),false);
    await panel.evaluate(()=>{const el=document.createElement('div');el.id='probe';el.dataset.testid='product-detail-preview';document.getElementById('route').append(el);});
    await panel.locator('#box').waitFor({state:'visible'});
    const before=await panel.evaluate(()=>window.formQueries);
    await new Promise(resolve=>setTimeout(resolve,1200));
    assert.equal(await panel.evaluate(()=>window.formQueries),before,'Idle panel must not scan for forms');
    assert.equal(await panel.evaluate(()=>window.intervals),0,'Panel must not start polling timers');
    await panel.evaluate(()=>document.getElementById('probe').removeAttribute('data-testid'));
    await panel.locator('#box').waitFor({state:'hidden'});
    await panel.keyboard.press('Alt+Shift+D');
    await panel.locator('#box').waitFor({state:'visible'});
    await panel.keyboard.press('Alt+Shift+D');
    await panel.locator('#box').waitFor({state:'hidden'});
    await panel.evaluate(()=>document.getElementById('probe').dataset.testid='product-detail-preview');
    await panel.locator('#box').waitFor({state:'visible'});
    await panel.evaluate(()=>document.getElementById('route').replaceChildren());
    await panel.locator('#box').waitFor({state:'hidden'});
    console.log('Passed: 50 rapid inputs -> 1 draft write, duplicate suppression, final-edit recovery, draft reset, zero idle form scans/timers, form lifecycle/shortcut, and zero events for unchanged text.');
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
