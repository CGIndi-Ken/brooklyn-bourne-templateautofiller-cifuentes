const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {launchBrowser} = require('./browser-test-helper.cjs');

const RAW = 'Raw Pre-Roll - Each';
const INFUSED = 'Infused Pre-Roll - Each';
const REGULATORY = 'Cannabis Flower Products';
const pair = (externalCategory, regulatoryCategory = REGULATORY) => ({regulatoryCategory,externalCategory});
const plain = value => JSON.parse(JSON.stringify(value));

async function verifyModel() {
  const legacy = {'preroll packs':pair(''),prerolls:pair('')};
  const storage = {categoryPairings:structuredClone(legacy)};
  const calls = [];
  const fixture = vm.createContext({
    chrome:{storage:{local:{get:async key=>({[key]:storage[key]}),set:async data=>Object.assign(storage,plain(data))},onChanged:{addListener(){}}}},
    status:{set(){}},ensureTab:async()=>true,
    fillField:async(def,value)=>{calls.push([def.key,value]);return '';},
  });
  for (const file of ['fields.js','category-pairings.js','engine.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),fixture);
  fixture.categoryPresetFor = vm.runInContext('categoryPresetFor',fixture);
  await vm.runInContext('categoryPairingsReady',fixture);
  assert.deepEqual(plain(fixture.validateCategoryPairings(legacy)),legacy,'Legacy category-pair backups remain valid');

  for (const category of ['Preroll Packs (New Category)','Prerolls (New Category)']) {
    const key = category.startsWith('Preroll Packs') ? 'preroll packs' : 'prerolls';
    const products = [
      {name:'Brand | First | 1g',category,...pair(RAW)},
      {name:'Brand | Second | 1g',category,...pair(INFUSED)},
    ];
    assert.equal(await fixture.rememberCategoryPairings(products),2,'Each infusion variant counts as a remembered pair');
    assert.deepEqual(storage.categoryPairings[key],{...legacy[key],variants:{uninfused:pair(RAW),infused:pair(INFUSED)}},'Remembering a mixed selection preserves the generic default');
    assert.equal(await fixture.rememberCategoryPairings([{...products[0],category:key.toUpperCase()+' (New Categories)',regulatoryCategory:'Raw regulatory'}]),1);
    assert.deepEqual(storage.categoryPairings[key].variants.infused,pair(INFUSED),'Updating raw products retains infused pairings');
    assert.deepEqual(storage.categoryPairings[key].variants.uninfused,pair(RAW,'Raw regulatory'));
    const before = structuredClone(storage);
    await assert.rejects(fixture.rememberCategoryPairings([
      {...products[0],regulatoryCategory:'First choice'},
      {...products[0],regulatoryCategory:'Other choice'},
    ]),/different|conflict|matching/i);
    assert.deepEqual(storage,before,'Conflicting choices in the same variant cannot partially save');
  }

  const configs = {
    'preroll packs':{...pair(''),variants:{infused:pair(INFUSED,'Infused regulatory'),uninfused:pair(RAW,'Raw regulatory')}},
    prerolls:{...pair(''),variants:{infused:pair(INFUSED,'Single infused regulatory'),uninfused:pair(RAW,'Single raw regulatory')}},
  };
  assert.deepEqual(plain(fixture.validateCategoryPairings(configs)),configs);
  const merged = plain(fixture.mergeCategoryPairings(configs,{'preroll packs':{...pair(''),variants:{infused:pair(INFUSED,'Updated infused')}}}));
  assert.deepEqual(merged['preroll packs'].variants.uninfused,configs['preroll packs'].variants.uninfused,'Import merging preserves the other variant');
  assert.equal(merged['preroll packs'].variants.infused.regulatoryCategory,'Updated infused');
  assert.deepEqual(merged.prerolls,configs.prerolls);
  assert.deepEqual(plain(fixture.mergeCategoryPairings(configs,legacy)),configs,'An older backup cannot erase the known variants');
  for (const invalid of [
    {flower:{...pair(''),variants:{infused:pair(INFUSED)}}},
    {'preroll packs':{...pair(''),variants:{unknown:pair(RAW)}}},
    {'preroll packs':{...pair(''),variants:{infused:{regulatoryCategory:3,externalCategory:INFUSED}}}},
    {'preroll packs':{...pair(''),variants:{uninfused:null}}},
    {'preroll packs':{...pair(''),variants:[]}},
  ]) assert.throws(()=>fixture.validateCategoryPairings(invalid),/invalid|variant|pair/i);

  for (const [category,key] of [['Preroll Packs (New Category)','preroll packs'],['Prerolls (New Category)','prerolls']]) {
    for (const variant of ['infused','uninfused']) {
      const expected = configs[key].variants[variant];
      const explicit = {name:`Brand | Strain | 1g ${variant === 'infused' ? 'non-infused' : 'infused'} pre-roll`,externalCategory:expected.externalCategory};
      assert.deepEqual(plain(fixture.categoryPresetFor(category,explicit,configs)),expected,'An explicit known external value selects its own variant before title text');
      const suffix = category.startsWith('Preroll Packs') ? 'pre-roll packs' : 'pre-roll';
      assert.deepEqual(plain(fixture.categoryPresetFor(category,{name:`Brand | Strain | 1g ${variant === 'infused' ? 'infused' : 'non-infused'} ${suffix}`},configs)),expected);
    }
    assert.equal(fixture.categoryPresetFor(category,{name:'Infused Brand | Infused Strain | 1g unknown product'},configs).externalCategory,'','Brand, strain and unknown designations do not choose an infusion variant');
    assert.equal(fixture.categoryPresetFor(category,{name:'Unformatted infused pre-roll'},configs).externalCategory,'','A title without a recognized final weight does not select a variant');
  }
  for (const [designation,category,external] of [
    ['infused pre-roll','Prerolls (New Category)',INFUSED],
    ['infused prerolls','Prerolls (New Category)',INFUSED],
    ['non-infused pre-roll','Prerolls (New Category)',RAW],
    ['uninfused prerolls','Prerolls (New Category)',RAW],
    ['raw pre-rolls','Prerolls (New Category)',RAW],
    ['pre-rolls','Prerolls (New Category)',RAW],
    ['infused pre-roll packs','Preroll Packs (New Category)',INFUSED],
    ['non-infused preroll packs','Preroll Packs (New Category)',RAW],
    ['uninfused pre-roll packs','Preroll Packs (New Category)',RAW],
    ['raw preroll packs','Preroll Packs (New Category)',RAW],
    ['pre-roll packs','Preroll Packs (New Category)',RAW],
  ]) {
    const result = fixture.categoryFromTitle(`Brand | Strain | 1g ${designation} (H)`);
    assert.equal(result?.category,category,`${designation} uses the right single/pack category`);
    assert.equal(result?.externalCategory,external,`${designation} uses the right infusion variant`);
  }
  const manual = {name:'Brand | Strain | 1g infused pre-roll packs',category:'Preroll Packs (New Category)',...pair('Manual external','Manual regulatory'),categoryPresetUnlocked:true,inferCategoryFromTitle:false};
  assert.equal(fixture.applyTemplatePreset({...manual}).externalCategory,'Manual external');
  assert.equal(fixture.valueFor({key:'externalCategory'},manual),'Manual external');
  assert.equal(fixture.valueFor({copyOf:'externalCategory'},manual),'Manual external');
  fixture.variantConfigs=configs;
  vm.runInContext('rememberedCategoryPairings = variantConfigs',fixture);
  const product = {name:'Brand | Strain | 1g infused pre-roll packs',category:'Preroll Packs (New Category)',externalCategory:INFUSED};
  await fixture.runFields([{key:'externalCategory',type:'select'},{key:'locExternalCategory',copyOf:'externalCategory',type:'select',tab:'location'}],product);
  assert.deepEqual(calls,[['externalCategory',INFUSED],['locExternalCategory',INFUSED]],'Details and Location use the same contextual variant');
  assert.equal(fixture.valueFor({key:'regulatoryCategory'},product),'Infused regulatory');
  assert.equal(fixture.valueFor({key:'externalCategory'},{...product,externalCategory:RAW}),RAW);
  vm.runInContext('rememberedTitleRules = {"custom pack":{category:"Preroll Packs (New Category)",regulatoryCategory:"Custom regulatory",externalCategory:"Custom external"}}',fixture);
  const automatic = {name:'Brand | Strain | 1g custom pack',inferCategoryFromTitle:true,category:'Preroll Packs (New Category)',externalCategory:RAW};
  assert.equal(fixture.applyTemplatePreset({...automatic}).externalCategory,'Custom external','Explicit automatic title rules retain their full chosen triple');
  assert.equal(fixture.valueFor({copyOf:'externalCategory'},automatic),'Custom external');
}

async function verifyEditors() {
  const {browser,pageURL} = await launchBrowser();
  try {
    const context = await browser.newContext();
    const products = {
      Raw:{name:'Brand | First | 1g raw pre-roll packs',category:'Preroll Packs (New Category)',...pair(RAW),categoryPresetUnlocked:true},
      Infused:{name:'Brand | Second | 1g infused pre-roll packs',category:'Preroll Packs (New Category)',...pair(INFUSED),categoryPresetUnlocked:true},
    };
    const storage = {templates:structuredClone(products),lastBulkBatch:{keys:Object.keys(products),shared:{}},categoryPairings:{'preroll packs':pair('')}};
    const errors = [];
    await context.exposeBinding('readVariantStore',(_,key)=>({[key]:storage[key]}));
    await context.exposeBinding('writeVariantStore',async(_,data)=>{
      Object.assign(storage,data);
      const changes = Object.fromEntries(Object.entries(data).map(([key,newValue])=>[key,{newValue}]));
      await Promise.all(context.pages().flatMap(page=>page.frames()).map(frame=>frame.evaluate(changes=>{
        for(const listener of window.variantListeners || []) listener(changes,'local');
      },changes).catch(()=>{})));
    });
    await context.exposeBinding('removeVariantStore',(_,key)=>{delete storage[key];});
    await context.addInitScript(()=>{
      window.variantListeners=[];
      window.chrome={storage:{local:{get:key=>readVariantStore(key),set:data=>writeVariantStore(data),remove:key=>removeVariantStore(key)},onChanged:{addListener:listener=>variantListeners.push(listener)}}};
    });
    const page = await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pageURL('workspace.html?batch=variants'));
    await page.waitForFunction(()=>initialized);
    await page.locator('#rememberCategoryPairs').click();
    await page.waitForFunction(()=>document.getElementById('workspaceStatus').textContent.startsWith('Remembered 2'));
    assert.deepEqual(storage.templates,products,'Remembering variants never rewrites saved products');
    assert.deepEqual(storage.categoryPairings['preroll packs'].variants,{uninfused:pair(RAW),infused:pair(INFUSED)});
    await page.locator('.entry-card').nth(0).locator('[data-field="cost"]').fill('7');
    await page.locator('.entry-card').nth(1).locator('[data-field="cost"]').fill('9');
    await page.locator('#saveProducts').click();
    await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    await page.reload();
    await page.waitForFunction(()=>initialized);
    assert.deepEqual(await page.evaluate(()=>[...rows.values()].map(row=>row.values.externalCategory)),[RAW,INFUSED],'Both pairings survive saving and reopening a mixed workspace');

    const popup = await context.newPage();
    popup.on('pageerror',error=>errors.push(error.message));
    await popup.goto(pageURL('popup.html'));
    await popup.waitForFunction(()=>templateEditorInitialized);
    await popup.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){};URL.createObjectURL=blob=>{window.variantBackup=blob;return 'blob:variants';};});
    await popup.locator('#exportBtn').click();
    await popup.waitForFunction(()=>window.variantBackup);
    const backup = await popup.evaluate(async()=>JSON.parse(await variantBackup.text()));
    assert.equal(backup.version,1,'Adding optional variants retains the existing backup format');
    assert.deepEqual(backup.categoryPairings,storage.categoryPairings);
    const originalRaw = structuredClone(storage.categoryPairings['preroll packs'].variants.uninfused);
    const partial = {...backup,templates:{},categoryPairings:{'preroll packs':{...pair(''),variants:{infused:pair(INFUSED,'Imported infused regulatory')}}}};
    await popup.evaluate(()=>{document.getElementById('transferStatus').textContent='';});
    await popup.locator('#importFile').setInputFiles({name:'variant.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(partial))});
    await popup.waitForFunction(()=>document.getElementById('transferStatus').textContent.startsWith('Imported'));
    assert.deepEqual(storage.categoryPairings['preroll packs'].variants.uninfused,originalRaw,'Importing an infused variant retains the remembered raw variant');
    assert.equal(storage.categoryPairings['preroll packs'].variants.infused.regulatoryCategory,'Imported infused regulatory');
    const beforeLegacy = structuredClone(storage.categoryPairings);
    const oldBackup = {format:'brooklyn-bourne-templates',version:1,templates:{},categoryPairings:{'preroll packs':pair('')}};
    await popup.evaluate(()=>{document.getElementById('transferStatus').textContent='';});
    await popup.locator('#importFile').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(oldBackup))});
    await popup.waitForFunction(()=>document.getElementById('transferStatus').textContent.startsWith('Imported'));
    assert.deepEqual(storage.categoryPairings,beforeLegacy,'Importing an older backup preserves both new variants');
    const beforeInvalid = structuredClone(storage);
    const invalid = {...oldBackup,categoryPairings:{'preroll packs':{...pair(''),variants:{unknown:pair(RAW)}}}};
    await popup.evaluate(()=>{document.getElementById('transferStatus').textContent='';});
    await popup.locator('#importFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
    await popup.waitForFunction(()=>document.getElementById('transferStatus').textContent.startsWith('Import failed'));
    assert.deepEqual(storage,beforeInvalid,'Malformed variant backups fail before any storage mutation');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
}

(async()=>{
  await verifyModel();
  await verifyEditors();
  console.log('Passed mixed preroll variants, contextual lookup, title specificity, manual overrides, Details/Location agreement, atomic conflicts, save/reload and legacy/partial backup merging.');
})().catch(error=>{console.error(error);process.exitCode=1;});
