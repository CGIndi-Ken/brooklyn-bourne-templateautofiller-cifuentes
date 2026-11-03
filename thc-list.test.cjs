const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
 const model=vm.createContext({});vm.runInContext(fs.readFileSync('bulk.js','utf8'),model);
 const values=['86.96','78.53','84.85','84.03','82.13','87.96','84.77','81.59','82.33','85.66'];
 const products=values.map(()=>({thc:''}));const plan=model.planThcList(values.join('\r\n'),products);
 assert.deepEqual(Array.from(plan,item=>item.value),values);
 assert.equal(model.planThcList('0\t.5%',products.slice(0,2))[0].value,'0');
 assert.equal(model.planThcList('250',products.slice(0,1),'mg')[0].value,'250');
 for(const text of ['86\n\n85','86\nNaN\n85','-1','Infinity','1e2','101','86,96']) assert.throws(()=>model.planThcList(text,products),/Value/);
 assert.throws(()=>model.planThcList('86',products),/1 THC values for 10/);
 assert.throws(()=>model.planThcList('86',[]),/Select/);
 const protectedPlan=model.planThcList('1\n2',[{thc:'0'},{thc:''}]);assert.equal(protectedPlan[0].keep,true);assert.equal(protectedPlan[1].value,'2');
 const {browser,pageURL}=await launchBrowser();
 try {
  const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const read=()=>JSON.parse(localStorage.store||'{}');window.chrome={storage:{local:{get:async key=>({[key]:read()[key]}),set:async data=>{localStorage.store=JSON.stringify({...read(),...data});},remove:async()=>{}},onChanged:{addListener(){}}}};});
  await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);
  await page.evaluate(()=>{
    for(let i=0;i<12;i++) addRow(newProduct({}, {name:`Product ${i+1} | 1g`,thc:i===0?'50':'',thcUnit:i===0?'mg':''}));
    const items=[...rows.values()];items[10].selected=false;items[10].element.querySelector('[data-action="select"]').checked=false;
    editProductField(items[11].values,'name','Hidden | 1g');refreshValues(items[11]);document.getElementById('entrySearch').value='Product';updateMetrics();
    for(const element of document.querySelectorAll('details'))element.open=true;
  });
  await page.locator('#thcList').fill(values.join('\n'));await page.locator('#previewThcList').click();assert.equal(await page.locator('#thcListPreview li').count(),10);
  assert.match(await page.locator('#thcListPreview li').first().textContent(),/50 mg kept \(pasted 86.96 %\)/);
  assert.equal(await page.evaluate(()=>[...rows.values()][1].values.thc),'','Preview never writes values');
  await page.locator('#applyThcList').click();
  assert.deepEqual(await page.evaluate(()=>[...rows.values()].slice(0,10).map(row=>row.values.thc)),['50',...values.slice(1)]);
  assert.equal(await page.evaluate(()=>[...rows.values()][0].values.thcUnit),'mg');assert.equal(await page.evaluate(()=>[...rows.values()][1].values.thcUnit),'%');
  assert.deepEqual(await page.evaluate(()=>[...rows.values()].slice(10).map(row=>row.values.thc)),['','']);
  await page.locator('#undoBulk').click();assert.equal(await page.evaluate(()=>[...rows.values()][1].values.thc),'');
  await page.locator('#bulkFillBlanks').uncheck();await page.locator('#previewThcList').click();
  await page.locator('.entry-card').nth(1).locator('[data-action="select"]').uncheck();assert.equal(await page.locator('#applyThcList').isDisabled(),true);
  await page.locator('#previewThcList').click();assert.match(await page.locator('#thcListStatus').textContent(),/10 THC values for 9/);
  await page.locator('.entry-card').nth(1).locator('[data-action="select"]').check();
  await page.locator('#thcList').fill('86.96\nBAD\n'+values.slice(2).join('\n'));await page.locator('#previewThcList').click();assert.match(await page.locator('#thcListStatus').textContent(),/Value 2/);assert.equal(await page.evaluate(()=>[...rows.values()][0].values.thc),'50');
  await page.locator('#thcList').fill(values.join('\n'));await page.locator('#previewThcList').click();
  // A DOM reorder must never silently change an already reviewed assignment.
  await page.evaluate(()=>{const entries=document.getElementById('entries');entries.prepend(entries.children[1]);});
  await page.locator('#applyThcList').click();assert.match(await page.locator('#thcListStatus').textContent(),/Preview the list again/);
  await page.locator('#previewThcList').click();await page.locator('#applyThcList').click();
  assert.deepEqual(await page.evaluate(()=>[...document.getElementById('entries').children].map(el=>rows.get(el.dataset.row)).filter(row=>row.selected&&!row.element.hidden).map(row=>row.values.thc)),values);
  await page.evaluate(()=>persistDraft());await page.reload();await page.waitForFunction(()=>initialized);
  assert.equal(await page.locator('#thcList').inputValue(),values.join('\n'));assert.equal(await page.locator('#applyThcList').isDisabled(),true);
  // Narrow layouts stay within the workspace, including long preview names.
  await page.setViewportSize({width:430,height:850});await page.evaluate(()=>{for(const element of document.querySelectorAll('details'))element.open=true;});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
 console.log('Passed THC list parsing, exact counts, units, protected alignment, scoped display order, preview atomicity, stale previews, undo, draft recovery and narrow layout.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
