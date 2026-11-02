const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
  const {browser}=await launchBrowser();
  try{
    const page=await browser.newPage({viewport:{width:480,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const templates={
        'Brooklyn Bourne | Cake':{name:'Cake',vendor:'Supplier A',strain:'Cake'},
        'Brooklyn Bourne | Runtz (imported 1)':{name:'Runtz',vendor:'Supplier A',strain:'Runtz'},
        'Dank | Chemdog':{name:'Chemdog',vendor:'Supplier B'},
      };
      window.listeners=[];window.store={templates};
      window.chrome={storage:{local:{get:async key=>({[key]:store[key]}),set:async data=>{Object.assign(store,data);for(const listener of listeners)listener(Object.fromEntries(Object.entries(data).map(([key,newValue])=>[key,{newValue}])),'local');}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{onMessage:{addListener(){}}}};
    });
    await page.goto('about:blank');
    await page.setContent('<body><button id="outside">Site button</button><div id="templatePickerPanel">Unrelated site content</div><div data-testid="product-detail-probe"></div></body>');
    const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
    for(const file of manifest.content_scripts[0].js)await page.addScriptTag({path:path.join(__dirname,file)});
    const box=page.locator('#box'),toggle=box.locator('#templatePickerToggle'),panel=box.locator('#templatePickerPanel'),search=box.locator('#templatePickerSearch');
    await box.waitFor({state:'visible'});await page.waitForFunction(()=>steps.length>0);
    assert.equal(await toggle.textContent(),'Brooklyn Bourne | Cake');
    await toggle.click();assert.equal(await panel.isVisible(),true);
    assert.equal(await box.locator('.template-group').count(),2);
    assert.equal(await box.locator('.template-choice').count(),0);
    await search.fill('supplier a runtz');
    assert.equal(await box.locator('.template-choice').count(),1);
    await box.getByRole('button',{name:'Condense all',exact:true}).click();
    assert.equal(await search.inputValue(),'supplier a runtz');assert.equal(await box.locator('.template-choice').count(),0);
    await box.getByRole('button',{name:'Expand all',exact:true}).click();
    await box.getByRole('button',{name:'Brooklyn Bourne | Runtz (imported 1)',exact:true}).click();
    assert.equal(await panel.isVisible(),false);
    assert.equal(await page.evaluate(()=>tplSelect.value),'Brooklyn Bourne | Runtz (imported 1)');
    assert.equal(await toggle.textContent(),'Brooklyn Bourne | Runtz (imported 1)');
    await page.evaluate(()=>{window.filled=[];runFields=async(defs,template)=>{window.filled.push(template.name);return {filled:1,total:1,problems:[]};};});
    await box.getByRole('button',{name:'Fill all',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>filled),['Runtz'],'Existing fill button must use the selected template');
    await page.evaluate(()=>fillThisTab('Dank | Chemdog'));
    assert.equal(await toggle.textContent(),'Dank | Chemdog','Programmatic batch selection must update chooser');
    await toggle.click();await search.fill('');await box.locator('#templatePickerSort').selectOption('desc');
    assert.match(await box.locator('.template-group summary').first().textContent(),/Dank/);
    await search.press('Escape');assert.equal(await panel.isVisible(),false);
    assert.equal(await toggle.evaluate(el=>el.getRootNode().activeElement===el),true);
    await toggle.click();await page.locator('#outside').click();assert.equal(await panel.isVisible(),false);
    await toggle.click();await search.fill('Cake');
    await page.evaluate(()=>chrome.storage.local.set({templates:{'New Brand | Product':{name:'Product'}}}));
    assert.match(await box.locator('#templatePickerStatus').textContent(),/No matching/);
    assert.equal(await toggle.textContent(),'New Brand | Product');
    await search.fill('');assert.equal(await box.locator('.template-group').count(),1);
    assert.equal(await box.locator('#templatePickerResults').evaluate(el=>el.getBoundingClientRect().height<=265),true);
    assert.equal(await box.evaluate(el=>el.scrollWidth>el.clientWidth),false);
    await search.press('Escape');
    await box.getByRole('button',{name:'Hide',exact:true}).click();await page.getByRole('button',{name:'Autofiller',exact:true}).click();
    await box.getByRole('button',{name:'Steps',exact:true}).click();await box.getByRole('button',{name:'Fill',exact:true}).click();
    assert.deepEqual(errors,[]);
    console.log('Passed on-page grouped chooser, Shadow DOM isolation, real click interception, search/sort/condense, exact fills, batch sync, storage updates, outside/Escape dismissal and existing panel controls.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
