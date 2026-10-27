// Run with Node.js. Optional browser checks use Playwright when PLAYWRIGHT_MODULE is set.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser-test-helper.cjs');
const path = require('node:path');
const calls = [];
const context = vm.createContext({
  status: { set() {} },
  ensureTab: async (tab) => { calls.push(['tab', tab]); return true; },
  fillField: async (def, value) => { calls.push(['field', def.key, value]); return ''; },
});
for (const file of ['fields.js', 'description.js', 'engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
}
async function main() {
  for (const [code, type] of Object.entries({S:'Sativa', H:'Hybrid', I:'Indica', 'I/H':'Indica-dominant hybrid', 'S/H':'Sativa-dominant hybrid', IH:'Indica-dominant hybrid', SH:'Sativa-dominant hybrid'})) {
    const result = context.strainFromTitle(`Product name | Runtz | 3.5g (${code})`);
    assert.equal(result.strain, 'Runtz');
    assert.equal(result.type, type);
    assert.equal(context.descriptionPrompt(`Product name | Runtz | 3.5g (${code})`), `Runtz (${({IH:'I/H',SH:'S/H'})[code] || code})`);
  }
  assert.equal(context.strainFromTitle('Runtz (h)').strain, 'Runtz');
  assert.equal(context.strainFromTitle('Runtz | 3.5g (H)').strain, 'Runtz');
  assert.equal(context.descriptionPrompt('  Runtz (H)  '), 'Runtz (H)');
  assert.throws(() => context.strainFromTitle('Runtz'), /strain type/);
  const prompt = context.descriptionPrompt('Product name | Runtz | 3.5g (H)');
  assert.equal(prompt, 'Runtz (H)');
  await vm.runInContext(`runFields(FIELD_DEFS, {name:'Runtz (H)', onlineDescription:'Reviewed description', copyToLocation:false}, {reuseOpen:false})`, context);
  assert.deepEqual(calls.filter(c => c[0] === 'field').slice(-2), [['field','onlineTitle','Runtz (H)'], ['field','onlineDescription','Reviewed description']]);
  assert.deepEqual(calls.at(-1), ['tab','details']);
  assert.equal(vm.runInContext(`buildSteps({onlineDescription:'Reviewed description'}).at(-1).defs[0].key`, context), 'onlineDescription');
  assert.equal(vm.runInContext(`valueFor(FIELD_DEFS.find(d=>d.key==='onlineDescription'), {})`, context), '');
  for (const file of fs.readdirSync(__dirname).filter(f => f.endsWith('.js'))) new vm.Script(fs.readFileSync(path.join(__dirname,file),'utf8'), {filename:file});
  console.log('Passed parser, prompt, fill order, blank-description compatibility, steps, and JavaScript syntax checks.');

  if (!process.env.PLAYWRIGHT_MODULE) return;
  const {browser, pageURL} = await launchBrowser();
  try {
    const page = await browser.newPage({viewport:{width:440,height:900}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const read = () => JSON.parse(localStorage.getItem('testStorage') || '{}');
      window.chrome = {storage:{onChanged:{addListener(){}},local:{
        get: async key => ({[key]:read()[key]}),
        set: async data => localStorage.setItem('testStorage', JSON.stringify({...read(),...data})),
        remove: async key => {const data=read();delete data[key];localStorage.setItem('testStorage',JSON.stringify(data));},
      }}};
      Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText: async text => {window.copiedPrompt=text;}}});
    });
    await page.goto(pageURL('popup.html'));
    await page.locator('#f_name').fill('Product name | Runtz | 3.5g (H)');
    await page.locator('#templateName').fill('Runtz test');
    await page.getByRole('button',{name:'Copy strain name + type'}).click();
    await page.waitForFunction(() => window.copiedPrompt === 'Runtz (H)');
    await page.reload();
    await page.waitForFunction(() => document.getElementById('f_name')?.value.includes('Runtz'));
    assert.equal(await page.locator('#templateName').inputValue(),'Runtz test');
    await page.locator('#f_onlineDescription').fill('Reviewed description');
    await page.getByRole('button',{name:'Save template',exact:true}).click();
    await page.waitForFunction(() => JSON.parse(localStorage.testStorage).templates?.['Runtz test']?.onlineDescription === 'Reviewed description');
    await page.reload();
    await page.locator('#templateSelect').selectOption('Runtz test');
    await page.waitForFunction(() => document.getElementById('f_onlineDescription').value === 'Reviewed description');
    assert.equal(await page.locator('#f_onlineDescription').getAttribute('maxlength'),'2500');
    await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied');}}, configurable:true}));
    await page.getByRole('button',{name:'Copy strain name + type'}).click();
    await page.waitForFunction(() => document.getElementById('descriptionStatus').textContent.includes('Ctrl+C'));
    assert.equal(await page.locator('#descriptionPrompt').inputValue(),prompt);
    for (const id of ['type','defaultUnit']) {
      assert.equal(await page.locator(`#f_${id}`).inputValue(),'Quantity');
      assert.equal(await page.locator(`#f_${id}`).isDisabled(),true);
    }
    await page.locator('#f_medBasePrice').fill('30');
    await page.locator('#bulkCard').evaluate(el=>{el.open=true;});
    await page.locator('#bulkNames').fill('Bulk Runtz (H)\nBulk Grape (I)\tGrape Gas\tGrape description\nRuntz test');
    await page.reload();
    await page.waitForFunction(()=>document.getElementById('bulkNames').value.includes('Bulk Runtz'));
    await page.locator('#bulkCard').evaluate(el=>{el.open=true;});
    await page.getByRole('button',{name:'Preview templates',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('bulkStatus').textContent.includes('2 to create; 1'));
    await page.getByRole('button',{name:'Create templates',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('bulkStatus').textContent.includes('Created 2 templates; skipped 1'));
    const stored=await page.evaluate(()=>JSON.parse(localStorage.testStorage).templates);
    assert.equal(stored['Bulk Runtz (H)'].medBasePrice,'');
    assert.equal(stored['Bulk Runtz (H)'].onlineDescription,'');
    assert.equal(stored['Bulk Grape (I)'].onlineDescription,'Grape description');
    assert.equal(stored['Runtz test'].onlineDescription,'Reviewed description');
    assert.deepEqual(errors,[]);
    console.log('Passed headless popup checks: copy, reopen draft, saved description, clipboard fallback, locked Quantity, bulk draft/preview/create and duplicates.');
  } finally { await browser.close(); }
}
main().catch(e => {console.error(e);process.exitCode=1;});
