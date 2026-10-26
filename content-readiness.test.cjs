const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const load = (context, ...files) => files.forEach(file => vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context));

async function main() {
  const values = vm.createContext({});
  load(values, 'fields.js', 'engine.js');
  const copy = {copyOf:'externalCategory'};
  assert.equal(values.valueFor(copy, {category:'Flower (New Category)'}), '', 'Location copies must respect their checkbox');
  assert.equal(values.valueFor(copy, {category:'Flower (New Category)',copyToLocation:true}), 'Bud/Flower - Each');
  assert.equal(values.valueFor({copyOf:'name',alwaysCopy:true}, {name:'Title'}), 'Title');
  assert.equal(values.valueFor({key:'thc'}, {thc:0}), 0, 'Numeric zero is a valid field value');

  for (const initiallySelected of [true, false]) {
    let now = 0, clicks = 0, selected = initiallySelected;
    const button = {hasAttribute:()=>true, getAttribute:()=>String(selected)};
    const context = vm.createContext({
      byTestId:()=>button,
      elFor:()=>now >= 500 ? {offsetParent:{}} : null,
      openElement:()=>{clicks++;selected=true;},
      waitFor:async(fn, timeout)=>{const end=now+timeout;while(now<end){if(fn())return true;now+=100;}return null;},
    });
    load(context, 'fillers.js');
    assert.equal(await context.ensureTab('details',{}), true);
    assert.equal(now, 500, 'Wait until fields mount, even when aria-selected is already true');
    assert.equal(clicks, initiallySelected ? 0 : 1);
  }
  const missing = vm.createContext({
    byTestId:()=>({hasAttribute:()=>true,getAttribute:()=> 'true'}),
    elFor:()=>null, openElement:()=>assert.fail('Do not click an already selected tab'),
    waitFor:async fn=>fn() || null,
  });
  load(missing, 'fillers.js');
  assert.equal(await missing.ensureTab('online',{}), false, 'Selected tabs with missing fields are not ready');

  let opens = 0;
  const select = vm.createContext({
    elFor:()=>({textContent:'Quantity',querySelector:()=>null}),pickTrigger:el=>el,
    anyOptionsOpen:()=>false,openElement:()=>{opens++;},
  });
  load(select, 'fillers.js');
  assert.equal(await select.fillSelect({key:'type'},'Weight'), '');
  assert.equal(opens, 0, 'Already-correct Quantity must not reopen the menu');

  let fills = 0;
  const engine = vm.createContext({ensureTab:async()=>false,fillField:()=>{fills++;},status:{set(){}}});
  load(engine, 'fields.js', 'engine.js');
  const result = await engine.runFields([{key:'name',type:'text'}], {name:'A'});
  assert.equal(fills, 0, 'Do not fill stale fields when Details fails to open');
  assert.equal(result.problems.length, 1);
  assert.equal(result.filled, 0);
  console.log('Passed content readiness, selected-tab mounting, missing-field failure, location copy opt-out, numeric zero, and redundant Quantity selection checks.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
