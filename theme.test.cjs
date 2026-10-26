// Headless UI check with extension storage mocked across popup and content-script pages.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser-test-helper.cjs');
async function main() {
  for (const file of fs.readdirSync(__dirname).filter(f=>f.endsWith('.js'))) new vm.Script(fs.readFileSync(path.join(__dirname,file),'utf8'),{filename:file});
  const {browser, pageURL} = await launchBrowser();
  try {
    const ctx = await browser.newContext({viewport:{width:800,height:1100}});
    let storage={};
    await ctx.exposeBinding('readMockStorage',(_,key)=>({[key]:storage[key]}));
    await ctx.exposeBinding('writeMockStorage',async(_,data)=>{
      const changes=Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{oldValue:storage[k],newValue:v}]));
      Object.assign(storage,data);
      await Promise.all(ctx.pages().map(p=>p.evaluate(changes=>{for(const fn of window.mockListeners || []) fn(changes,'local');},changes)));
    });
    await ctx.addInitScript(()=>{
      window.mockListeners=[];
      window.chrome={storage:{local:{get:key=>window.readMockStorage(key),set:data=>window.writeMockStorage(data),remove:async()=>{}},onChanged:{addListener:fn=>window.mockListeners.push(fn)}},runtime:{onMessage:{addListener(){}}}};
    });
    const errors=[];
    const popup=await ctx.newPage();popup.on('pageerror',e=>errors.push(e.message));
    await popup.goto(pageURL('popup.html'));
    await popup.waitForSelector('#f_name');
    assert.equal(await popup.locator('#themeSelect').inputValue(),'black-gold');
    const panel=await ctx.newPage();panel.on('pageerror',e=>errors.push(e.message));
    await panel.goto('about:blank');
    await panel.setContent('<body style="background:#292a2c"><div data-testid="product-detail-preview"></div></body>');
    for(const file of ['fields.js','dom-utils.js','fillers.js','engine.js','learn.js','theme.js','panel.js']) await panel.addScriptTag({path:path.join(__dirname,file)});
    await panel.locator('#box').waitFor({state:'visible'});
    fs.mkdirSync(path.join(__dirname,'previews'),{recursive:true});
    const colors = {'black-gold':'rgb(16, 16, 16)','black-yellow':'rgb(16, 16, 16)','grey-maroon':'rgb(40, 40, 44)','forest-mint':'rgb(16, 39, 30)'};
    for(const [theme,bg] of Object.entries(colors)) {
      await popup.getByLabel('Theme',{exact:true}).selectOption(theme);
      await panel.waitForFunction(t=>[...document.querySelectorAll('div')].some(el=>el.shadowRoot && el.getAttribute('data-autofill-theme')===t),theme);
      assert.equal(await panel.getByLabel('Theme',{exact:true}).inputValue(),theme);
      assert.equal(await popup.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),bg);
      assert.equal(await panel.locator('#box').evaluate(el=>getComputedStyle(el).backgroundColor),bg);
      const selectStyle=async(p,sel)=>p.locator(sel).evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.color,s.borderColor];});
      assert.deepEqual(await selectStyle(popup,'#templateSelect'),await selectStyle(panel,'#tpl'));
      const buttonStyle=async(p,sel)=>p.locator(sel).evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundImage,s.color];});
      assert.deepEqual(await buttonStyle(popup,'#saveBtn'),await buttonStyle(panel,'#all'));
      assert.equal(await popup.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await panel.locator('#box').evaluate(el=>el.scrollWidth>el.clientWidth),false);
      await panel.locator('#box').screenshot({path:path.join(__dirname,'previews',`panel-${theme}.png`)});
    }
    // Reverse direction, and then confirm persistence after reopening the popup.
    await panel.getByLabel('Theme',{exact:true}).selectOption('grey-maroon');
    await popup.waitForFunction(()=>document.documentElement.dataset.autofillTheme==='grey-maroon');
    await popup.reload();
    await popup.waitForFunction(()=>document.documentElement.dataset.autofillTheme==='grey-maroon');
    await popup.evaluate(()=>chrome.storage.local.set({theme:'unknown-theme'}));
    await popup.waitForFunction(()=>document.documentElement.dataset.autofillTheme==='black-gold');
    assert.equal(await panel.getByLabel('Theme',{exact:true}).inputValue(),'black-gold');
    await panel.getByRole('button',{name:'Hide',exact:true}).click();
    await panel.getByRole('button',{name:'Autofiller',exact:true}).click();
    for(const tab of ['Steps','Fields','Lists','Fill']) await panel.getByRole('button',{name:tab,exact:true}).click();
    assert.deepEqual(errors,[]);
    console.log('Passed four palettes, popup/panel style matching, live two-way synchronization, saved-theme reload, invalid-theme fallback, layout and panel controls.');
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
