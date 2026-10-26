const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const context = vm.createContext({});
for (const file of ['fields.js','bulk.js','engine.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context);
const shared = {category:'Flower (New Category)',medBasePrice:'30',vendor:'Vendor',type:'Weight',defaultUnit:'Grams',strain:'Old',onlineDescription:'Old description',upc:'123',externalId:'ID',copyToLocation:true};
const existing = {Existing:{name:'Keep'}};
const result = context.buildBulkTemplates('\nRuntz (H)\nGrape Gas (I)\tGrape Gas\tReviewed grape description\nExisting\nRuntz (H)\n',shared,existing);
assert.equal(result.created.length,2);
assert.equal(result.skipped.length,2);
assert.equal(result.templates.Existing.name,'Keep');
assert.equal(Object.keys(existing).length,1);
const manual=context.buildBulkTemplates('Manual',{...shared,categoryPresetUnlocked:true,regulatoryCategory:'Manual regulatory',externalCategory:'Manual external'},{}).templates.Manual;
assert.equal(manual.regulatoryCategory,'Manual regulatory');
assert.equal(manual.externalCategory,'Manual external');
const edibles=context.buildBulkTemplates('Edible',{category:'Edibles (New Category)'},{}).templates.Edible;
assert.equal(edibles.regulatoryCategory,'Gel-based foods');
assert.equal(edibles.externalCategory,'Infused Edible - Each');
assert.equal(result.templates['Runtz (H)'].onlineDescription,'');
assert.equal(result.templates['Runtz (H)'].strain,'');
assert.equal(result.templates['Grape Gas (I)'].onlineDescription,'Reviewed grape description');
assert.equal(result.templates['Grape Gas (I)'].strain,'Grape Gas');
assert.equal(result.templates['Runtz (H)'].medBasePrice,'30');
assert.equal(result.templates['Runtz (H)'].copyToLocation,true);
assert.equal(Object.hasOwn(result.templates['Runtz (H)'],'upc'),false);
assert.equal(result.templates['Runtz (H)'].externalId,'');
assert.equal(result.templates['Runtz (H)'].regulatoryCategory,'Cannabis Flower Products');
assert.equal(context.buildBulkTemplates(' \n',shared,existing).created.length,0);
assert.throws(()=>context.buildBulkTemplates('Good\nBad\tStrain\t'+'x'.repeat(2501),shared,existing),/Line 2/);
assert.throws(()=>context.buildBulkTemplates('Name\tStrain\tDescription\textra',shared,existing),/Line 1/);
assert.equal(Object.keys(existing).length,1);
assert.equal(vm.runInContext(`valueFor(FIELD_DEFS.find(d=>d.key==='type'),{type:'Weight'})`,context),'Quantity');
assert.equal(vm.runInContext(`valueFor(FIELD_DEFS.find(d=>d.key==='defaultUnit'),{defaultUnit:'Grams'})`,context),'Quantity');

async function checkSelection(key,succeedOn) {
  let value='Weight',clicks=0,now=0;
  const field={get textContent(){return value;},querySelector:()=>null};
  const fixture=vm.createContext({
    elFor:()=>field, pickTrigger:e=>e, anyOptionsOpen:()=>false, openElement(){},
    pressEscape:async()=>{}, sleep:async(ms)=>{now+=ms;},
    waitFor:async(fn,timeout=4000)=>{const end=now+timeout;while(now<end){const r=fn();if(r)return r;now+=100;}return null;},
    findExactOption:requested=>{assert.equal(requested,'Quantity');return {click(){clicks++;if(clicks>=succeedOn)value='Quantity';}};},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'fillers.js'),'utf8'),fixture);
  const error=await fixture.fillSelect({key,label:key},'Weight',{reuseOpen:false});
  return {error,clicks};
}
(async()=>{
  for(const key of ['type','defaultUnit']) {
    assert.deepEqual(await checkSelection(key,1),{error:'',clicks:1});
    assert.deepEqual(await checkSelection(key,2),{error:'',clicks:2});
    const fail=await checkSelection(key,Infinity);
    assert.equal(fail.clicks,2);
    assert.match(fail.error,/couldn't confirm Quantity/);
  }
  console.log('Passed bulk creation, duplicate preservation, row validation, per-product isolation, regulatory defaults, fixed Quantity, select retry and error checks.');
})().catch(e=>{console.error(e);process.exitCode=1;});
