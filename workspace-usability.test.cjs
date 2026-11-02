const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {launchBrowser} = require('./browser-test-helper.cjs');

async function main() {
  const {browser, pageURL} = await launchBrowser();
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1100}});
    const errors = [];
    const base = {category:'Flower (New Category)', regulatoryCategory:'Cannabis Flower Products', externalCategory:'Bud/Flower - Each',
      categoryPresetUnlocked:false, gramsConcentration:'3.5', thc:'20', thcUnit:'%', cost:'7', medBasePrice:'20', tags:'Retail',
      onlineDescription:'Reviewed paragraph.', vendor:'Vendor', brand:'Brand', inferGramsFromTitle:false};
    const original = {
      'Target Alpha':{...base,name:'Target Alpha',gramsConcentration:'',thc:'',cost:'',tags:'',onlineDescription:''},
      'Target Bravo':{...base,name:'Target Bravo',thc:'0',cost:'0',medBasePrice:'0',onlineDescription:''},
      Hidden:{...base,name:'Hidden',cost:''},
      'Target unchecked':{...base,name:'Target unchecked',cost:''},
      'Target Charlie':{...base,name:'Target Charlie',thc:''},
    };
    const storage = {templates:structuredClone(original),lastBulkBatch:{keys:Object.keys(original),shared:{}}};
    let templateWrites = 0;
    await context.exposeBinding('readStore', (_,key) => ({[key]:storage[key]}));
    await context.exposeBinding('writeStore', async (_,data) => {
      if (data.templates) templateWrites++;
      const changes = Object.fromEntries(Object.entries(data).map(([key,value]) => [key,{oldValue:storage[key],newValue:value}]));
      Object.assign(storage,data);
      await Promise.all(context.pages().flatMap(page=>page.frames()).map(frame=>frame.evaluate(changes=>{
        for (const listener of window.testListeners || []) listener(changes,'local');
      },changes).catch(()=>{})));
    });
    await context.exposeBinding('removeStore', (_,key) => {delete storage[key];});
    await context.addInitScript(()=>{
      window.testListeners=[];
      window.chrome={storage:{local:{get:key=>window.readStore(key),set:data=>window.writeStore(data),remove:key=>window.removeStore(key)},
        onChanged:{addListener:listener=>window.testListeners.push(listener)}},runtime:{getURL:file=>new URL(file,location.href).href}};
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pageURL('workspace.html?batch=usability'));
    await page.waitForFunction(()=>initialized);
    await page.locator("#bulkCompletion > summary").click();
    const row = name => page.locator('.entry-card').filter({has:page.locator('[data-title]',{hasText:new RegExp(`^${name}$`)})});
    const field = (name,key) => row(name).locator(`[data-field="${key}"]`);
    const value = (name,key) => field(name,key).inputValue();
    const shown = () => page.locator('.entry-card:visible [data-title]').allTextContents();
    const filter = async (value, expected) => {
      await page.locator('#entryFilter').selectOption(value);
      assert.deepEqual(await shown(),expected,`Filter ${value} should include only its matching products`);
    };
    assert.equal(await page.locator('#undoBulk').isDisabled(),true);
    await filter('unsaved',[]);
    await filter('required',['Target Alpha']);
    await filter('thc',['Target Alpha','Target Charlie']);
    await filter('tags',['Target Alpha']);
    await filter('cost',['Target Alpha','Hidden','Target unchecked']);
    await filter('medBasePrice',[]);
    await filter('onlineDescription',['Target Alpha','Target Bravo']);
    await filter('unfinished',['Target Alpha','Hidden','Target unchecked','Target Charlie']);
    await filter('cost',['Target Alpha','Hidden','Target unchecked']);
    await page.locator('#entrySearch').fill('Target');
    assert.deepEqual(await shown(),['Target Alpha','Target unchecked'],'Search and missing-detail filters combine');

    await field('Target Alpha','cost').fill('11');
    assert.equal(await row('Target Alpha').isVisible(),true,'Finishing a missing value must not hide the focused product during typing');
    await page.locator('#entrySearch').focus();
    await row('Target Alpha').waitFor({state:'hidden'});
    assert.deepEqual(await shown(),['Target unchecked'],'Completed products leave the filter after focus leaves their card');
    await page.locator('#clearEntryFilters').click();
    assert.equal(await page.locator('#entrySearch').inputValue(),'');
    assert.equal(await page.locator('#entryFilter').inputValue(),'all');
    assert.deepEqual(await shown(),Object.keys(original));

    await page.locator('#entryFilter').selectOption('thc');
    await page.locator('#entrySearch').fill('Target');
    await page.evaluate(()=>persistDraft());
    await page.reload();
    await page.waitForFunction(()=>initialized);
    await page.locator("#bulkCompletion > summary").click();
    assert.equal(await page.locator('#entryFilter').inputValue(),'thc','The selected filter survives a draft reload');
    assert.equal(await page.locator('#entrySearch').inputValue(),'Target');
    assert.deepEqual(await shown(),['Target Alpha','Target Charlie']);
    assert.equal(await page.locator('#undoBulk').isDisabled(),true,'Undo history is local to the open workspace');
    await page.locator('#clearEntryFilters').click();

    await row('Target unchecked').getByRole('checkbox',{name:'Select entry',exact:true}).uncheck();
    await page.locator('#entrySearch').fill('Target');
    await page.locator('#bulkFillBlanks').uncheck();
    await page.locator('#bulkCost').fill('25');
    await page.locator('#applyBulkCost').click();
    assert.equal(await value('Target Alpha','cost'),'25');
    assert.equal(await value('Target Bravo','cost'),'25');
    assert.equal(await value('Target Charlie','cost'),'25');
    assert.equal(await value('Hidden','cost'),'','Hidden products are not edited');
    assert.equal(await value('Target unchecked','cost'),'','Unchecked products are not edited');
    assert.equal(await page.locator('#undoBulk').isEnabled(),true);
    await page.locator('#applyBulkCost').click();
    assert.equal(await page.locator('#undoBulk').isEnabled(),true,'A repeated no-op action must retain the previous effective Undo');
    await field('Target Bravo','cost').fill('26');
    await page.locator('#undoBulk').click();
    assert.equal(await value('Target Alpha','cost'),'11');
    assert.equal(await value('Target Bravo','cost'),'26','Undo keeps a product edited after the bulk action');
    assert.equal(await value('Target Charlie','cost'),'7');
    assert.equal(await page.locator('#undoBulk').isDisabled(),true);

    await page.locator('#applyField').selectOption('category');
    await page.locator('#applyValue').fill('Carts (New Category)');
    await page.locator('#applySelected').click();
    let state = await page.evaluate(()=>[...rows.values()].map(row=>({name:row.values.name,category:row.values.category,regulatory:row.values.regulatoryCategory,external:row.values.externalCategory,unlocked:row.values.categoryPresetUnlocked})));
    assert.equal(state.find(row=>row.name==='Target Alpha').regulatory,'Oil for Vaporization');
    assert.equal(state.find(row=>row.name==='Target Alpha').external,'Vape Cartridge - Each');
    await page.locator('#undoBulk').click();
    state = await page.evaluate(()=>[...rows.values()].map(row=>({name:row.values.name,category:row.values.category,regulatory:row.values.regulatoryCategory,external:row.values.externalCategory,unlocked:row.values.categoryPresetUnlocked})));
    for (const product of state) {
      assert.equal(product.category,base.category,'Undo restores category-dependent values together');
      assert.equal(product.regulatory,base.regulatoryCategory);
      assert.equal(product.external,base.externalCategory);
      assert.equal(product.unlocked,false);
    }
    await page.locator('#applyField').selectOption('regulatoryCategory');
    await page.locator('#applyValue').fill('Manual pairing');
    await page.locator('#applySelected').click();
    assert.equal(await page.evaluate(()=>[...rows.values()].find(row=>row.values.name==='Target Alpha').values.categoryPresetUnlocked),true);
    await page.locator('#undoBulk').click();
    assert.equal(await page.evaluate(()=>[...rows.values()].find(row=>row.values.name==='Target Alpha').values.categoryPresetUnlocked),false,'Undo also restores the per-template category override flag');

    await page.locator('#bulkPrice').fill('35');
    await page.locator('#applyBulkPrice').click();
    await field('Target Alpha','name').focus();
    await page.keyboard.press('Control+s');
    await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    assert.equal(templateWrites,1,'Ctrl+S saves using the existing workspace save action');
    assert.equal(storage.templates['Target Alpha'].medBasePrice,'35');
    assert.equal(await page.locator('#undoBulk').isDisabled(),true,'Successful saving clears the previous bulk Undo');
    assert.equal(storage.templates.Hidden.cost,'');
    assert.equal(storage.templates['Target unchecked'].medBasePrice,'20');
    await page.locator('#entryFilter').selectOption('unsaved');
    assert.deepEqual(await shown(),[],'Saved entries immediately leave the unsaved filter');
    await page.locator('#clearEntryFilters').click();

    const syntheticShortcut = options => page.evaluate(options=>{
      const event = new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true,...options});
      document.dispatchEvent(event);return event.defaultPrevented;
    },options);
    assert.equal(await syntheticShortcut({repeat:true}),false,'Repeated key events are ignored');
    assert.equal(await syntheticShortcut({isComposing:true}),false,'Composition key events are ignored');
    assert.equal(templateWrites,1);
    await field('Target Alpha','cost').fill('12');
    assert.equal(await syntheticShortcut({ctrlKey:false,metaKey:true}),true,'Cmd+S is supported too');
    await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    assert.equal(storage.templates['Target Alpha'].cost,'12');
    await page.locator('#entryFilter').selectOption('onlineDescription');
    await page.locator('#collapseAll').click();
    fs.mkdirSync(path.join(__dirname,'previews'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'previews','usability-workspace.png'),fullPage:true});
    await page.setViewportSize({width:440,height:1000});
    await page.locator('#entrySearch').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(__dirname,'previews','usability-workspace-narrow.png')});
    const assertFooterFits = async target => {
      const layout = await target.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:innerHeight,
        buttons:['undoBulk','saveProducts'].map(id=>{const {left,right,top,bottom}=document.getElementById(id).getBoundingClientRect();return {id,left,right,top,bottom};})}));
      assert.ok(layout.scrollWidth<=layout.width,`Workspace must not overflow horizontally: ${JSON.stringify(layout)}`);
      for (const button of layout.buttons) assert.ok(button.left>=0 && button.right<=layout.width && button.top>=0 && button.bottom<=layout.height,`Footer action must remain visible: ${JSON.stringify(layout)}`);
      return layout;
    };
    await assertFooterFits(page);

    await page.locator('#entrySearch').fill('Target');
    await page.locator('#addEntry').click();
    assert.equal(await page.locator('#entryFilter').inputValue(),'all','Adding a product reveals it through active filters');
    assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#entries .entry-card:last-child [data-field="name"]')),true,'Add product focuses the new name immediately');
    await page.locator('.entry-card').last().locator('[data-field="name"]').fill('New product');
    await row('New product').getByRole('button',{name:'Duplicate settings',exact:true}).click();
    assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#entries .entry-card:last-child [data-field="name"]')),true,'Duplicate settings focuses the new name immediately');
    const unnamed = page.locator('.entry-card').last();
    await unnamed.getByRole('button',{name:'Minimize',exact:true}).click();
    await page.locator('#entrySearch').fill('no matching product');
    assert.deepEqual(await shown(),[]);
    await page.locator('#saveProducts').click();
    await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    assert.match(await page.locator('#workspaceStatus').textContent(),/needs a product name/);
    assert.equal(await unnamed.isVisible(),true,'Save errors reveal entries hidden by search');
    assert.equal(await unnamed.locator('.entry-content').isVisible(),true,'Save errors expand collapsed entries');
    assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#entries .entry-card:last-child [data-field="name"]')),true,'Save errors focus the missing name');
    await unnamed.locator('[data-field="name"]').fill('New product');
    await page.locator('#entryFilter').selectOption('unsaved');
    await page.locator('#saveProducts').click();
    await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    assert.match(await page.locator('#workspaceStatus').textContent(),/Duplicate template name/);
    assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#entries .entry-card:last-child [data-field="name"]')),true,'Duplicate-name errors focus the product that must be renamed');

    const embeddedPage = await context.newPage();
    embeddedPage.on('pageerror', error=>errors.push(error.message));
    await embeddedPage.setViewportSize({width:440,height:800});
    await embeddedPage.goto(pageURL('workspace.html?embedded=1&view=products'));
    await embeddedPage.waitForFunction(()=>initialized);
    await embeddedPage.locator('#entryFilter').selectOption('onlineDescription');
    await embeddedPage.locator('#collapseAll').click();
    await embeddedPage.locator('#entrySearch').scrollIntoViewIfNeeded();
    await assertFooterFits(embeddedPage);
    await embeddedPage.screenshot({path:path.join(__dirname,'previews','usability-workspace-embedded.png')});
    await embeddedPage.close();
    await page.locator('[data-view="directory"]').click();
    assert.equal(await syntheticShortcut({}),false,'Save shortcut is not intercepted in the directory');
    assert.deepEqual(errors,[]);
    console.log('Passed missing-detail filters, combined search, typing visibility, draft restoration, bulk Undo with newer edits protected, dependent category values, hidden/unchecked preservation and save shortcuts.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
