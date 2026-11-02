const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {launchBrowser}=require('./browser-test-helper.cjs');
async function main(){
  const model=vm.createContext({});
  for(const file of ['fields.js','bulk.js'])vm.runInContext(fs.readFileSync(file,'utf8'),model);
  const parse=text=>JSON.parse(JSON.stringify(model.parseProductRows(text)));
  assert.deepEqual(parse('Name\tStrain\tDescription\r\n"New | Runtz | 3.5g (H)"\tRuntz\t"Rich, herbal\nwith ""sweet"" notes\tand spice"'),[
    {name:'New | Runtz | 3.5g (H)',strain:'Runtz',onlineDescription:'Rich, herbal\nwith "sweet" notes\tand spice'}]);
  assert.deepEqual(parse('Name'),[{name:'Name',strain:'',onlineDescription:''}],'A single product called Name is preserved');
  assert.equal(parse('\uFEFFName\tStrain\nA\tRuntz').length,1);
  assert.equal(parse('\n\t\t\n').length,0);
  assert.throws(()=>parse('Good\nBad\tStrain\tDescription\tExtra'),/Line 2/);
  assert.throws(()=>parse('Good\n"Unclosed'),/Line 2/);
  assert.throws(()=>parse('"Name"oops'),/unexpected text/);
  assert.throws(()=>parse('A\tRuntz\t'+'x'.repeat(2501)),/2500/);
  const existing={A:{name:'Keep',cost:'9'}};
  assert.throws(()=>model.buildBulkTemplates('New\nBad\tS\tD\tExtra',{},existing));
  assert.deepEqual(existing,{A:{name:'Keep',cost:'9'}},'Validation failure cannot partially mutate saved data');
  assert.equal(model.planProductRows('__proto__\n__proto__\nA',['A']).created.length,1);
  const {browser,pageURL}=await launchBrowser();
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const read=()=>JSON.parse(localStorage.store || '{}');
      window.chrome={storage:{local:{get:async key=>({[key]:read()[key]}),set:async data=>{localStorage.store=JSON.stringify({...read(),...data});},remove:async()=>{}},onChanged:{addListener(){}}}};
    });
    await page.goto(pageURL('workspace.html'));await page.waitForFunction(()=>initialized);
    await page.evaluate(()=>{
      templates={'Stored key':{name:'Saved Product',vendor:'Acme',brand:'Peak',strain:'Runtz',category:'Flower'}};
      shared={cost:'99',medBasePrice:'199',onlineDescription:'Do not copy',strain:'Do not copy'};
      addRow(newProduct({}, {name:'Local',cost:'17'}));renderSavedChoices();updateMetrics();
    });
    const source='Name\tStrain\tDescription\nNew | Runtz | 3.5g (H)\tRuntz\t"Aroma\nflavor"\nSaved Product\nLocal\nNew | Runtz | 3.5g (H)';
    await page.locator('#quickNames').fill(source);await page.locator('#previewNames').click();
    assert.match(await page.locator('#quickNamesStatus').textContent(),/1 new products; 3 existing/);
    assert.equal(await page.locator('.entry-card').count(),1,'Preview does not create products');
    await page.locator('#entrySearch').fill('no match');
    await page.locator('#addNames').click();
    assert.equal(await page.locator('.entry-card:visible').count(),2,'New entries are shown after adding');
    const added=await page.evaluate(()=>[...rows.values()][1].values);
    assert.equal(added.strain,'Runtz');assert.equal(added.onlineDescription,'Aroma\nflavor');
    assert.equal(added.gramsConcentration,'3.5');assert.equal(added.cost,'');assert.equal(added.medBasePrice,'');
    assert.equal(await page.evaluate(()=>[...rows.values()][0].values.cost),'17');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.store || '{}').templates),undefined,'Added entries are drafts');
    await page.locator('#quickNames').fill('Good\nBad\tS\tD\tExtra');await page.locator('#addNames').click();
    assert.equal(await page.locator('.entry-card').count(),2);
    assert.equal(await page.locator('#quickNames').inputValue(),'Good\nBad\tS\tD\tExtra');
    assert.match(await page.locator('#quickNamesStatus').textContent(),/Line 2/);
    await page.locator('#savedTemplatePicker > summary').click();
    await page.locator('#savedSearch').fill('Acme Runtz');
    assert.equal(await page.locator('#savedChoices input').count(),1);
    await page.locator('#savedChoices input').check();
    await page.locator('#savedSearch').fill('Missing');assert.equal(await page.locator('#savedChoices input').count(),0);
    await page.locator('#savedSearch').fill('Peak Flower');assert.equal(await page.locator('#savedChoices input').isChecked(),true);
    await page.locator('#clearSavedSelection').click();
    assert.equal(await page.locator('#savedChoices input').isChecked(),false);
    await page.locator('#selectSavedMatches').click();
    await page.locator('#savedSearch').fill('Missing');
    assert.equal(await page.locator('#savedSelectedCount').textContent(),'1 selected');
    await page.locator('#clearSavedSelection').click();
    assert.equal(await page.locator('#savedSelectedCount').textContent(),'');
    assert.deepEqual(errors,[]);
    console.log('Passed shared spreadsheet parsing, quoted multiline cells, optional headers, atomic validation, preview, duplicate protection, isolated product defaults and metadata search.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
