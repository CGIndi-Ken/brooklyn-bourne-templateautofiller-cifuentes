const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {launchBrowser} = require('./browser-test-helper.cjs');

const classics = ['black-gold','black-yellow','grey-maroon','forest-mint'];
function luminance(color) {
  const channels = color.match(/[\d.]+/g).slice(0,3).map(Number).map(value => {
    const channel=value/255;return channel<=0.04045 ? channel/12.92 : ((channel+0.055)/1.055)**2.4;
  });
  return channels[0]*0.2126 + channels[1]*0.7152 + channels[2]*0.0722;
}
function contrast(foreground, background) {
  const values=[luminance(foreground),luminance(background)].sort((a,b)=>a-b);
  return (values[1]+0.05)/(values[0]+0.05);
}

async function main() {
  const {browser,pageURL}=await launchBrowser();
  try {
    const context=await browser.newContext({viewport:{width:440,height:1000},reducedMotion:'reduce'}), errors=[], requests=[];
    const origin=new URL(pageURL('popup.html')).origin;
    context.on('request',request=>{if(!request.url().startsWith(origin+'/'))requests.push(request.url());});
    let storage={};
    await context.exposeBinding('readStore',(_,key)=>({[key]:storage[key]}));
    await context.exposeBinding('writeStore',async(_,data)=>{
      const changes=Object.fromEntries(Object.entries(data).map(([key,value])=>[key,{oldValue:storage[key],newValue:value}]));
      Object.assign(storage,data);
      await Promise.all(context.pages().flatMap(page=>page.frames()).map(frame=>frame.evaluate(changes=>{
        for(const listener of window.testListeners || [])listener(changes,'local');
      },changes).catch(()=>{})));
    });
    await context.exposeBinding('removeStore',(_,key)=>{delete storage[key];});
    await context.addInitScript(()=>{
      window.testListeners=[];
      window.chrome={storage:{local:{get:key=>window.readStore(key),set:data=>window.writeStore(data),remove:key=>window.removeStore(key)},onChanged:{addListener:listener=>window.testListeners.push(listener)}},
        runtime:{onMessage:{addListener(){}},getURL:file=>new URL(file,location.href).href},windows:{create:async()=>({id:1})}};
    });
    const popup=await context.newPage();popup.on('pageerror',error=>errors.push(error.message));
    await popup.goto(pageURL('popup.html'));
    await popup.waitForFunction(()=>document.querySelector('#learnedInfo').textContent);
    assert.equal(await popup.locator('#themeSelect').inputValue(),'black-gold-deluxe-v2','Default uses the patterned finish');
    assert.deepEqual(await popup.locator('#themeSelect optgroup').evaluateAll(groups=>groups.map(group=>[group.label,group.children.length])),[['Patterned',10],['Effects',10]]);
    assert.equal(await popup.locator('#themeSelect').evaluate(select=>/solid|deluxe/i.test(select.textContent)),false);
    const ids=await popup.locator('#themeSelect option').evaluateAll(options=>options.map(option=>option.value));assert.equal(ids.length,20);
    await popup.locator('#templateName').fill('Runtz · Flower');
    await popup.locator('#f_name').fill('Brooklyn Bourne | Runtz | 3.5g (H)');
    await popup.locator('#f_vendor').fill('Brooklyn Distribution');
    await popup.locator('#f_brand').fill('Brooklyn Bourne');

    const panel=await context.newPage();panel.on('pageerror',error=>errors.push(error.message));
    await panel.goto('about:blank');
    await panel.setContent('<body style="margin:0;background:#292a2c"><div data-testid="product-detail-preview"></div></body>');
    for(const file of ['fields.js','dom-utils.js','fillers.js','engine.js','learn.js','theme.js','template-picker-style.js','template-picker.js','panel.js'])
      await panel.addScriptTag({path:path.join(__dirname,file)});
    await panel.locator('#box').waitFor({state:'visible'});
    const workspace=await context.newPage();workspace.on('pageerror',error=>errors.push(error.message));
    await workspace.goto(pageURL('workspace.html'));await workspace.waitForFunction(()=>initialized);
    await popup.evaluate(()=>showPopupView('bulk'));
    const embedded=popup.frameLocator('#bulkWorkspace');
    await embedded.locator('#workspaceStatus').waitFor({state:'visible'});
    await popup.evaluate(()=>showPopupView('template'));

    const signature=async(target,selector)=>target.locator(selector).first().evaluate(element=>{
      const style=getComputedStyle(element);
      return ['backgroundColor','backgroundImage','color','borderColor','borderRadius','boxShadow'].map(key=>style[key]);
    });
    const waitTheme=async theme=>{
      await popup.waitForFunction(theme=>document.documentElement.dataset.autofillTheme===theme,theme);
      await workspace.waitForFunction(theme=>document.documentElement.dataset.autofillTheme===theme,theme);
      await panel.waitForFunction(theme=>[...document.querySelectorAll('div')].some(element=>element.shadowRoot && element.dataset.autofillTheme===theme),theme);
      await embedded.locator(`html[data-autofill-theme="${theme}"]`).waitFor({state:'attached'});
      assert.equal(await embedded.locator('html').getAttribute('data-autofill-theme'),theme);
    };
    const assertFinish=async finish=>{
      assert.equal(await popup.locator('html').getAttribute('data-autofill-finish'),finish);
      assert.equal(await workspace.locator('html').getAttribute('data-autofill-finish'),finish);
      assert.equal(await embedded.locator('html').getAttribute('data-autofill-finish'),finish);
      assert.equal(await panel.locator('#box').evaluate(element=>element.getRootNode().host.getAttribute('data-autofill-finish')),finish);
    };
    const assertContrast=async(target,rootSelector,buttonSelector,inputSelector)=>{
      const colors=await target.locator(rootSelector).evaluate(element=>{
        const style=getComputedStyle(element), sample=document.createElement('span');element.append(sample);
        const resolve=variable=>{sample.style.color=style.getPropertyValue(variable);return getComputedStyle(sample).color;};
        const result={text:resolve('--text'),surface:resolve('--surface'),muted:resolve('--muted'),card:resolve('--card-bg'),section:resolve('--section-top')};sample.remove();return result;
      });
      for(const surface of ['surface','card','section'])assert.ok(contrast(colors.muted,colors[surface])>=4.5,`Muted text contrast on ${surface}: ${JSON.stringify(colors)}`);
      assert.ok(contrast(colors.text,colors.surface)>=4.5,'Body text stays readable');
      for(const selector of [buttonSelector,inputSelector]){
        const pair=await target.locator(selector).evaluate(element=>{const style=getComputedStyle(element);return [style.color,style.backgroundColor];});
        assert.ok(contrast(...pair)>=4.5,`${selector} contrast ${contrast(...pair).toFixed(2)}: ${pair.join(' / ')}`);
      }
    };
    for(const id of ids){
      await popup.locator('#themeSelect').selectOption(id);await waitTheme(id);await assertFinish(id.endsWith('-effects')?'effects':'patterned');
      for(const target of [popup,workspace])assert.equal(await target.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await panel.locator('#box').evaluate(element=>element.scrollWidth>element.clientWidth),false);
      assert.notEqual(await popup.locator('body').evaluate(element=>getComputedStyle(element).backgroundImage),'none');
      assert.equal(await popup.locator('#f_name').evaluate(element=>getComputedStyle(element).backgroundImage),'none');
      assert.deepEqual(await signature(popup,'#saveBtn'),await signature(panel,'#all'));
      await assertContrast(popup,'body','#saveBtn','#f_name');await assertContrast(panel,'#box','#all','#panelTheme');await assertContrast(workspace,'body','#saveProducts','#entrySearch');
      assert.equal(await popup.locator('body').evaluate(element=>getComputedStyle(element).animationName),'none');
    }
    for(const old of classics)for(const id of [old,old+'-deluxe']){
      await popup.evaluate(id=>chrome.storage.local.set({theme:id}),id);await waitTheme(old+'-deluxe-v2');
    }
    const effects='teal-seafoam-effects';await workspace.locator('#workspaceTheme').selectOption(effects);await waitTheme(effects);
    await popup.reload();await popup.waitForFunction(id=>document.documentElement.dataset.autofillTheme===id,effects);
    await popup.locator('#f_name').focus();assert.notEqual(await popup.locator('#f_name').evaluate(element=>getComputedStyle(element).boxShadow),'none');
    await popup.locator('#saveBtn').hover();assert.equal(await popup.locator('#saveBtn').evaluate(element=>getComputedStyle(element).transform),'none');
    assert.equal(await popup.locator('#saveBtn').evaluate(element=>getComputedStyle(element).transitionDuration),'0s');
    await popup.emulateMedia({reducedMotion:'no-preference'});await popup.locator('#saveBtn').hover();await popup.waitForFunction(()=>getComputedStyle(document.getElementById('saveBtn')).transform!=='none');
    assert.notEqual(await popup.locator('.card').first().evaluate(element=>getComputedStyle(element).boxShadow),'none');
    await popup.locator('#themeSelect').selectOption('teal-seafoam');assert.equal(await popup.locator('#f_name').evaluate(element=>getComputedStyle(element).boxShadow),'none');
    assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
    console.log('Passed 20 patterned/effects choices, removed-solid migration, contrast, synchronized surfaces, saved selections, narrow layouts and reduced motion.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
