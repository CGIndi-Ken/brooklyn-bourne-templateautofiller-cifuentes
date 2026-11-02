const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser-test-helper.cjs');
async function main() {
  const {browser,pageURL}=await launchBrowser();
  try {
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      const read=()=>JSON.parse(localStorage.getItem('store') || '{}');
      window.chrome={storage:{onChanged:{addListener(){}},local:{
        get:async key=>({[key]:read()[key]}),
        set:async data=>localStorage.setItem('store',JSON.stringify({...read(),...data})),
        remove:async key=>{const data=read();delete data[key];localStorage.setItem('store',JSON.stringify(data));},
      }}};
    });
    const fields=['cost','medBasePrice','gramsConcentration'];
    await page.goto(pageURL('popup.html'));
    await page.waitForFunction(()=>document.getElementById('learnedInfo').textContent);
    for(const key of fields) assert.equal(await page.locator(`#f_${key}`).inputValue(),'');
    const source={name:'Saved product',cost:'7',medBasePrice:'14',gramsConcentration:'1.5',vendor:'Vendor',brand:'Brand'};
    await page.evaluate(async source=>{await chrome.storage.local.set({templates:{Saved:source}});await refresh();},source);
    await page.locator('#templateSelect').selectOption('Saved',{force:true});
    await page.waitForFunction(()=>document.getElementById('f_cost').value==='7');
    for(const [key,value] of Object.entries(source).filter(([key])=>fields.includes(key))) assert.equal(await page.locator(`#f_${key}`).inputValue(),value);
    await page.locator('#newBtn').click();
    for(const key of fields) assert.equal(await page.locator(`#f_${key}`).inputValue(),'');
    await page.locator('#templateSelect').selectOption('Saved',{force:true});
    await page.waitForFunction(()=>document.getElementById('f_cost').value==='7');
    await page.locator('#copyBtn').click();
    for(const key of fields) assert.equal(await page.locator(`#f_${key}`).inputValue(),'');
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.store).templates.Saved),source);
    await page.evaluate(async source=>chrome.storage.local.set({'workspaceLaunch:defaults':{vendor:'Vendor',brands:['Brand'],shared:source}}),source);
    await page.goto(pageURL('workspace.html?launch=defaults'));
    await page.waitForFunction(()=>initialized);
    const card=page.locator('.entry-card').first();
    for(const key of fields) assert.equal(await card.locator(`[data-field="${key}"]`).inputValue(),'');
    for(const key of fields) await card.locator(`[data-field="${key}"]`).fill(source[key]);
    await card.getByRole('button',{name:'Duplicate settings',exact:true}).click();
    for(const key of fields) {
      assert.equal(await card.locator(`[data-field="${key}"]`).inputValue(),source[key]);
      assert.equal(await page.locator('.entry-card').nth(1).locator(`[data-field="${key}"]`).inputValue(),'');
    }
    await page.locator('#addEntry').click();
    for(const key of fields) assert.equal(await page.locator('.entry-card').nth(2).locator(`[data-field="${key}"]`).inputValue(),'');
    await page.locator('#quickNames').fill('New product');await page.locator('#addNames').click();
    for(const key of fields) assert.equal(await page.locator('.entry-card').nth(3).locator(`[data-field="${key}"]`).inputValue(),'');
    await page.locator('details.card').evaluate(el=>el.open=true);
    await page.locator('#savedChoices input[value="Saved"]').check();await page.locator('#loadSelected').click();
    for(const key of fields) assert.equal(await page.locator('.entry-card').nth(4).locator(`[data-field="${key}"]`).inputValue(),source[key]);
    assert.deepEqual(errors,[]);
    console.log('Passed blank defaults for popup New/Copy, brand launch, add product, pasted names and duplicate; saved templates and edited source rows preserved.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
