const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const model=vm.createContext({});
for(const file of ['fields.js','workspace-model.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),model);
const merge=(base,local,latest)=>JSON.parse(JSON.stringify(model.mergeProductChanges(base,local,latest)));
const name='Cheevo | Blueberry Diesel | 7g ground flower (S)';
const base={name,cost:'12',medBasePrice:'24',gramsConcentration:'7'};

let result=merge(base,{...base,cost:'13'},{gramsConcentration:'7',medBasePrice:'24',cost:'12',name,thc:'',copyToLocation:false,inferGramsFromTitle:false});
assert.deepEqual(result.conflicts,[],'Property order, missing blanks and false metadata do not create conflicts');
assert.equal(result.values.cost,'13');
assert.equal(result.values.inferGramsFromTitle,false);
assert.equal(result.values.thc,'');

result=merge(null,{...base,cost:''},{...base,customMetadata:'Keep this'});
assert.deepEqual(result.conflicts,['cost'],'Missing draft snapshots require review instead of guessing away explicit blanks');
assert.equal(result.values.cost,'');
assert.equal(result.values.customMetadata,'Keep this');
result=merge(null,base,{cost:'12',gramsConcentration:'7',medBasePrice:'24',name,inferGramsFromTitle:false,thc:''});
assert.deepEqual(result.conflicts,[],'Equivalent known values are safe even when the draft lacks a snapshot');

result=merge(base,{...base,cost:'13'},{...base,medBasePrice:'26',customMetadata:{source:'saved'},upc:'retired'});
assert.deepEqual(result.conflicts,[]);
assert.equal(result.values.cost,'13','Local-only changes are kept');
assert.equal(result.values.medBasePrice,'26','Saved-only changes are kept');
assert.deepEqual(result.values.customMetadata,{source:'saved'},'Unknown latest data is preserved');
assert.equal(Object.hasOwn(result.values,'upc'),false,'Retired fields stay removed');
assert.equal(Object.hasOwn(base,'thc'),false,'Merging does not mutate inputs');

result=merge(base,{...base,cost:'13'},{...base,cost:'13'});
assert.deepEqual(result.conflicts,[],'Matching edits are already resolved');
result=merge(base,{...base,cost:''},{...base,cost:'14'});
assert.deepEqual(result.conflicts,['cost']);
assert.equal(result.values.cost,'','Explicit local clears survive conflicts');
result=merge(base,{...base,cost:'13'},{...base,cost:''});
assert.deepEqual(result.conflicts,['cost']);
assert.equal(result.values.cost,'13');
result=merge({...base,cost:0},{...base,cost:'0'},{...base,cost:'0'});
assert.deepEqual(result.conflicts,[],'Numeric/string zero has the same saved meaning');
assert.equal(result.values.cost,'0');
result=merge({...base,copyToLocation:true},{...base,copyToLocation:false},{...base,copyToLocation:true,medBasePrice:'26'});
assert.deepEqual(result.conflicts,[]);
assert.equal(result.values.copyToLocation,true);
assert.equal(result.values.medBasePrice,'26');

const category={...base,category:'Flower (New Category)',regulatoryCategory:'Flower regulatory',externalCategory:'Flower external',categoryPresetUnlocked:true};
result=merge(category,{...category,regulatoryCategory:'Local regulatory'},{...category,externalCategory:'Saved external'});
assert.deepEqual(result.conflicts,[],'Independent pairings in the same unlocked category can merge');
assert.equal(result.values.regulatoryCategory,'Local regulatory');
assert.equal(result.values.externalCategory,'Saved external');
result=merge(category,{...category,category:'Carts (New Category)',regulatoryCategory:'Oil',externalCategory:'Vape'}, {...category,externalCategory:'Saved flower external'});
assert.deepEqual(new Set(result.conflicts),new Set(['category','regulatoryCategory','externalCategory']));
assert.equal(result.values.category,'Carts (New Category)');
assert.equal(result.values.externalCategory,'Vape','Category-dependent conflicts retain a coherent local group');
for(const key of result.conflicts)result.values[key]=({...category,externalCategory:'Saved flower external'})[key];
assert.equal(result.values.category,category.category);
assert.equal(result.values.externalCategory,'Saved flower external','Choosing saved conflicts restores the coherent saved group');
const locked={...category,categoryPresetUnlocked:false};
result=merge(locked,{...locked,categoryPresetUnlocked:true},{...locked,externalCategory:'New saved preset'});
assert.deepEqual(new Set(result.conflicts),new Set(['categoryPresetUnlocked','externalCategory']));
assert.equal(result.values.categoryPresetUnlocked,true);
assert.equal(result.values.externalCategory,locked.externalCategory);

const auto={...base,name:'Brand | Strain | 1g (H)',gramsConcentration:'1',inferGramsFromTitle:true};
const localAuto={...auto,name:'Brand | Strain | 2g (H)',gramsConcentration:'2'};
const savedAuto={...auto,name:'Brand | Strain | 3g (H)',gramsConcentration:'3'};
result=merge(auto,localAuto,savedAuto);
assert.deepEqual(new Set(result.conflicts),new Set(['name','gramsConcentration']));
assert.equal(result.values.name,localAuto.name);
assert.equal(result.values.gramsConcentration,'2');
result=merge(auto,{...auto,inferGramsFromTitle:false},savedAuto);
assert.deepEqual(new Set(result.conflicts),new Set(['name','gramsConcentration','inferGramsFromTitle']));
assert.equal(result.values.gramsConcentration,'1','Same-value manual edits protect their chosen weight');
assert.equal(result.values.inferGramsFromTitle,false);
result=merge(auto,localAuto,{...auto,cost:'13'});
assert.deepEqual(result.conflicts,[],'Pricing does not interfere with automatic weights');
assert.equal(result.values.gramsConcentration,'2');
assert.equal(result.values.cost,'13');
const manual={...auto,inferGramsFromTitle:false};
result=merge(manual,{...manual,name:'Renamed manual product'},{...manual,gramsConcentration:'3'});
assert.deepEqual(result.conflicts,[],'Manual names and weights are independent');
assert.equal(result.values.name,'Renamed manual product');
assert.equal(result.values.gramsConcentration,'3');

// Comparison/merge must never apply the currently remembered category presets.
result=merge({...base,category:'Flower (New Category)',regulatoryCategory:'Custom old value'},
  {...base,category:'Flower (New Category)',regulatoryCategory:'Custom old value',cost:'13'},
  {...base,category:'Flower (New Category)',regulatoryCategory:'Custom old value'});
assert.deepEqual(result.conflicts,[]);
assert.equal(result.values.regulatoryCategory,'Custom old value');
console.log('Passed semantic workspace merging, independent edits, clears, flags, preserved metadata and coherent category/automatic-weight conflicts.');
