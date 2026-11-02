const assert=require('node:assert/strict');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
  const {browser,pageURL}=await launchBrowser();
  try{
    const page=await browser.newPage({viewport:{width:440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const templates=Object.fromEntries(Array.from({length:60},(_,i)=>[`Product ${i} — ${'Long product name '.repeat(8)}`,{name:`Product ${i}`} ]));
      window.chrome={storage:{local:{get:async key=>({[key]:key==='templates'?templates:undefined}),set:async()=>{}},onChanged:{addListener(){}}}};
    });
    await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);
    await page.locator('#savedTemplatePicker summary').click();
    assert.equal(await page.locator('#savedChoices').evaluate(el=>el.classList.contains('compact-list')),true);
    assert.equal(await page.locator('#savedChoices').evaluate(el=>el.getBoundingClientRect().height<=175),true);
    assert.equal(await page.locator('#savedChoices label span').first().evaluate(el=>getComputedStyle(el).whiteSpace),'nowrap');
    await page.locator('#savedSearch').fill('Product 1 —');
    const firstName=await page.locator('#savedChoices input').first().getAttribute('value');
    await page.locator('#savedChoices input').first().check();
    await page.locator('#savedSearch').fill('Product 2 —');
    const secondName=await page.locator('#savedChoices input').first().getAttribute('value');
    await page.locator('#savedChoices input').first().check();
    assert.equal(await page.locator('#savedSelectedCount').textContent(),'2 selected');
    await page.locator('#toggleSavedCompact').click();
    assert.equal(await page.locator('#savedChoices').evaluate(el=>el.classList.contains('compact-list')),false);
    await page.getByRole('button',{name:'Condense all templates',exact:true}).click();
    await page.locator('#savedSearch').fill('Product 1 —');
    assert.equal(await page.locator('#savedChoices input').first().isChecked(),true);
    assert.equal(await page.locator('#savedChoices label').first().getAttribute('title'),firstName);
    await page.locator('#loadSelected').click();
    assert.equal(await page.locator('#savedTemplatePicker').evaluate(el=>el.open),false);
    assert.equal(await page.locator('.entry-card').count(),2);
    assert.equal(await page.locator('.entry-content:visible').count(),0);
    assert.deepEqual(await page.evaluate(()=>[...rows.values()].map(row=>row.key)),[firstName,secondName]);
    await page.locator('.entry-card').first().getByRole('button',{name:'Expand',exact:true}).click();
    assert.equal(await page.locator('.entry-content:visible').count(),1);
    await page.locator('#savedTemplatePicker summary').click();
    await page.locator('#savedSearch').fill('does not exist');
    assert.match(await page.locator('#savedSearchStatus').textContent(),/No matching/);
    assert.equal(await page.locator('#savedSelectedCount').textContent(),'2 selected');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
    console.log('Passed bounded compact template search, full-name toggle, search selection retention, chooser collapse, minimized loaded cards and narrow layout.');
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
