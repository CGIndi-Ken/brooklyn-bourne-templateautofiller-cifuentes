const assert=require('node:assert/strict');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
  const {browser,pageURL}=await launchBrowser();
  try{
    const page=await browser.newPage({viewport:{width:440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const read=()=>JSON.parse(localStorage.store || '{}');
      window.chrome={storage:{local:{get:async key=>({[key]:read()[key]}),set:async data=>{localStorage.store=JSON.stringify({...read(),...data});},remove:async()=>{}},onChanged:{addListener(){}}}};
    });
    await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);
    await page.evaluate(()=>{
      for(const name of ['Ready','Hidden','Unchecked','']) addRow(newProduct({}, {name}));
      updateMetrics();
    });
    const cards=page.locator('.entry-card');
    await cards.nth(2).locator('[data-action="select"]').uncheck();
    await page.locator('#entrySearch').fill('Ready');
    assert.equal(await page.locator('#saveSelected').textContent(),'Save selected (1)');
    await page.locator('#saveSelected').click();
    await page.waitForFunction(()=>!saving);
    assert.deepEqual(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.store).templates)),['Ready']);
    assert.equal(await page.locator('#saveSelected').isDisabled(),true);
    assert.equal(await page.evaluate(()=>[...rows.values()].filter(r=>r.dirty).length),3);
    await page.evaluate(()=>persistDraft());await page.reload();await page.waitForFunction(()=>initialized);
    assert.equal(await cards.count(),4,'Unselected and unfinished products survive draft reload');
    await page.locator('#clearEntryFilters').click();
    await page.locator('#saveProducts').click();await page.waitForFunction(()=>!saving);
    assert.match(await page.locator('#workspaceStatus').textContent(),/needs a product name/);
    await cards.nth(3).locator('[data-action="select"]').uncheck();
    await page.locator('#saveSelected').click();await page.waitForFunction(()=>!saving);
    assert.deepEqual(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.store).templates).sort()),['Hidden','Ready']);
    assert.equal(await page.evaluate(()=>[...rows.values()][2].dirty),true,'Unchecked changes remain unsaved');
    await page.evaluate(()=>chrome.storage.local.set({theme:'forest-mint-deluxe'}));
    await page.reload();await page.waitForFunction(()=>initialized);
    assert.equal(await page.locator('html').getAttribute('data-autofill-theme'),'forest-mint','Old Deluxe choice migrates to Standard');
    assert.equal(await page.locator('html').getAttribute('data-autofill-finish'),'standard');
    assert.deepEqual(errors,[]);
    console.log('Passed scoped saves, unfinished/unchecked protection, draft recovery, all-save validation and saved-theme migration.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
