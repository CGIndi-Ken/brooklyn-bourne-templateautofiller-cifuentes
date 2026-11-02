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
    assert.equal(await popup.locator('#themeSelect').inputValue(),'black-gold','Existing default remains unchanged');
    assert.equal(await popup.locator('#themeSelect option').count(),8,'Standard palettes and four Deluxe variants are available');
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
    fs.mkdirSync(path.join(__dirname,'previews'),{recursive:true});
    for(const classic of classics){
      await popup.locator('#themeSelect').selectOption(classic);await waitTheme(classic);await assertFinish('standard');
      const before=await Promise.all([signature(popup,'.card'),signature(popup,'#saveBtn'),signature(panel,'.card'),signature(workspace,'.card')]);
      const deluxe=`${classic}-deluxe-v2`;
      await popup.locator('#themeSelect').selectOption(deluxe);await waitTheme(deluxe);await assertFinish('deluxe');
      for(const target of [popup,workspace])assert.equal(await target.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Deluxe theme does not introduce horizontal scrolling');
      assert.equal(await panel.locator('#box').evaluate(element=>element.scrollWidth>element.clientWidth),false,'Panel fits a narrow viewport');
      assert.notEqual(await popup.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
      assert.equal(await popup.locator('.card > summary').first().evaluate(element=>getComputedStyle(element).borderInlineStartWidth),'3px','Direct card headings receive the accent rule');
      assert.equal(await popup.locator('.card .help > summary').first().evaluate(element=>getComputedStyle(element).borderInlineStartWidth),'0px','Nested Help summaries stay free of decorative rules');
      assert.deepEqual(await signature(popup,'#saveBtn'),await signature(panel,'#all'),'Popup and Autofiller primary actions match');
      await assertContrast(popup,'body','#saveBtn','#f_name');
      await assertContrast(panel,'#box','#all','#panelTheme');
      await assertContrast(workspace,'body','#saveProducts','#entrySearch');
      for(const selector of ['body','.head','.card','#saveBtn','#f_name']){
        const motion=await popup.locator(selector).first().evaluate(element=>{const style=getComputedStyle(element);return [style.backgroundImage,style.animationName];});
        assert.equal(motion[1],'none',`Deluxe remains static: ${selector}`);
      }
      await popup.evaluate(()=>window.scrollTo(0,0));
      await popup.screenshot({path:path.join(__dirname,'previews',`deluxe-${classic}.png`),clip:{x:0,y:0,width:440,height:850}});
      // Every surface follows changes in the other direction, and persistence
      // restores a Deluxe finish before the user interacts with the editor.
      await panel.getByLabel('Theme',{exact:true}).selectOption(classic);await waitTheme(classic);await assertFinish('standard');
      assert.deepEqual(await Promise.all([signature(popup,'.card'),signature(popup,'#saveBtn'),signature(panel,'.card'),signature(workspace,'.card')]),before,'Returning to Standard removes Deluxe styling completely');
      await workspace.locator('#workspaceTheme').selectOption(deluxe);await waitTheme(deluxe);
      await popup.reload();await popup.waitForFunction(theme=>document.documentElement.dataset.autofillTheme===theme,deluxe);
      // Reloading destroys the popup's lazy iframe; recreate it for the next
      // synchronization assertion, using the persisted theme as its start state.
      await popup.evaluate(()=>showPopupView('bulk'));await embedded.locator('#workspaceStatus').waitFor({state:'visible'});
      await popup.evaluate(()=>showPopupView('template'));await assertFinish('deluxe');
    }
    await popup.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await popup.locator('#saveBtn').evaluate(element=>getComputedStyle(element).transitionDuration),'0s','Reduced motion still disables transitions');
    assert.deepEqual(requests,[],'Themes use no external assets or network requests');
    assert.deepEqual(errors,[]);
    const galleryPalettes=await popup.evaluate(()=>Object.fromEntries(Object.entries(AUTOFILL_PALETTES).filter(([,theme])=>theme.deluxe).map(([id,theme])=>[id,{label:theme.label,accent:theme.accent,surface:theme.surface,edge:theme.edge}])));
    const sheet=await browser.newPage({viewport:{width:1536,height:930},deviceScaleFactor:1});
    await sheet.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#0c0e12;color:#f3f1ec;font:14px/1.5 'Segoe UI',Arial,sans-serif}header{margin-bottom:24px}small{font-size:11px;font-weight:700;letter-spacing:2.5px;color:#b0bac9}h1{font-size:34px;line-height:1.2;letter-spacing:-.8px;margin:8px 0 5px}header p{margin:0;color:#b0bac9}.collection{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}article{border:1px solid var(--edge);border-radius:14px;overflow:hidden;background:var(--surface)}h2{margin:0;padding:14px 15px;font-size:14px;font-weight:700;color:var(--accent);border-bottom:1px solid var(--edge)}img{display:block;width:100%;height:auto}footer{margin-top:18px;color:#a6afbd;font-size:12px}</style></head><body><header><small>BROOKLYN BOURNE AUTOFILLER</small><h1>The Deluxe collection</h1><p>Four familiar palettes with richer surfaces and bolder accents.</p></header><section class="collection">${classics.map(classic=>{
      const palette=galleryPalettes[`${classic}-deluxe-v2`], image=fs.readFileSync(path.join(__dirname,'previews',`deluxe-${classic}.png`)).toString('base64');
      return `<article style="--accent:${palette.accent};--surface:${palette.surface};--edge:${palette.edge}"><h2>${palette.label}</h2><img src="data:image/png;base64,${image}"></article>`;
    }).join('')}</section><footer>Actual extension previews · Available from the Theme menu under Deluxe</footer></body></html>`);
    await sheet.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
    await sheet.screenshot({path:path.join(__dirname,'previews','deluxe-collection.png')});
    await sheet.close();
    console.log('Passed four Deluxe palettes, promoted Standards/default, contrast, popup/panel/workspace/iframe synchronization, persistence, clean static styling and narrow layouts.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
