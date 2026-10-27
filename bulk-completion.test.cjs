const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser-test-helper.cjs');

async function main() {
  const {browser, pageURL} = await launchBrowser();
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1100}});
    const errors = [];
    const base = {category:'Flower (New Category)',regulatoryCategory:'Cannabis Flower Products',externalCategory:'Bud/Flower - Each',categoryPresetUnlocked:false,onlineDescription:'Reviewed paragraph.',gramsConcentration:'',vendor:'Vendor',brand:'Brand'};
    const original = {
      'Target missing':{...base,name:'Target missing',tags:'Medical',thc:'',cost:'',medBasePrice:''},
      'Target kept':{...base,name:'Target kept',tags:'',thc:'20',thcUnit:'mg',cost:'7',medBasePrice:'40'},
      Hidden:{...base,name:'Hidden',tags:'Legacy',thc:'',cost:'',medBasePrice:''},
      'Target unchecked':{...base,name:'Target unchecked',tags:'',thc:'',cost:'',medBasePrice:''},
      Complete:{...base,name:'Complete',tags:'Legacy',thc:'0',thcUnit:'%',cost:'0',medBasePrice:'0'},
    };
    const storage = {templates:structuredClone(original),options:{tags:['Medical','Relaxed']}};
    await context.exposeBinding('readStore', (_,key) => ({[key]:storage[key]}));
    await context.exposeBinding('writeStore', async (_,data) => {
      const changes = Object.fromEntries(Object.entries(data).map(([key,value]) => [key,{oldValue:storage[key],newValue:value}]));
      Object.assign(storage,data);
      await Promise.all(context.pages().flatMap(page=>page.frames()).map(frame=>frame.evaluate(changes=>{
        for (const listener of window.testListeners || []) listener(changes,'local');
      },changes).catch(()=>{})));
    });
    await context.exposeBinding('removeStore', (_,key) => {delete storage[key];});
    await context.addInitScript(()=>{
      window.testListeners=[];
      window.chrome={storage:{local:{get:key=>window.readStore(key),set:data=>window.writeStore(data),remove:key=>window.removeStore(key)},onChanged:{addListener:fn=>window.testListeners.push(fn)}},runtime:{getURL:name=>new URL(name,location.href).href}};
    });
    const page = await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    const url = `${pageURL('workspace.html')}?batch=completion-test`;
    const draftKey = 'productWorkspace:completion-test';
    await page.goto(url);
    await page.locator('#bulkCompletion').waitFor({state:'visible'});
    await page.waitForFunction(()=>initialized);
    await page.locator('#loadIncomplete').click();
    await page.waitForFunction(()=>document.querySelectorAll('.entry-card').length===4);
    await page.locator('#loadIncomplete').click();
    assert.equal(await page.locator('.entry-card').count(),4,'Repeated loading must not duplicate rows; complete zero-valued templates are excluded');
    const row = name => page.locator('.entry-card').filter({has:page.locator('[data-title]',{hasText:new RegExp(`^${name}$`)})});
    const missing = row('Target missing'), kept = row('Target kept'), hidden = row('Hidden'), unchecked = row('Target unchecked');
    const value = (card,key) => card.locator(`[data-field="${key}"]`).inputValue();
    const tags = card => card.locator('[data-field="tags"] .selected-brands button').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-label').slice(7)));
    const pickTag = async (container,tag) => {
      await container.getByRole('combobox',{name:'Tags',exact:true}).fill(tag);
      await container.getByRole('option',{name:`+ ${tag}`,exact:true}).click();
    };
    const allValues = () => page.locator('.entry-card').evaluateAll(cards=>cards.map(card=>({
      name:card.querySelector('[data-field="name"]').value,
      values:[...card.querySelectorAll('[data-field]')].map(field=>field.dataset.field==='tags' ? ['tags',[...field.querySelectorAll('.selected-brands button')].map(button=>button.getAttribute('aria-label'))] : [field.dataset.field,field.value]),
    })));
    assert.equal(await page.locator('#bulkFillBlanks').isChecked(),true);
    assert.equal(await page.locator('#bulkThcUnit').inputValue(),'%');
    await unchecked.getByRole('checkbox',{name:'Select entry',exact:true}).uncheck();
    await page.locator('#entrySearch').fill('Target');
    assert.equal(await page.locator('.entry-card:visible').count(),3);
    await page.locator('#bulkThc').fill('25');
    await page.locator('#bulkCost').fill('10');
    await page.locator('#bulkPrice').fill('30');
    await pickTag(page.locator('#bulkTags'),'Medical');
    await pickTag(page.locator('#bulkTags'),'Relaxed');
    // Each independent action ignores the other populated inputs and selected tags.
    await page.locator('#applyBulkCost').click();
    assert.equal(await value(missing,'cost'),'10');
    assert.equal(await value(missing,'thc'),'');
    assert.equal(await value(missing,'medBasePrice'),'');
    assert.deepEqual(await tags(missing),['Medical']);
    await page.locator('#applyBulkPrice').click();
    assert.equal(await value(missing,'medBasePrice'),'30');
    assert.equal(await value(missing,'thc'),'');
    assert.deepEqual(await tags(kept),[]);
    await page.locator('#applyBulkThc').click();
    assert.equal(await value(missing,'thc'),'25');
    assert.equal(await value(missing,'thcUnit'),'','THC value action must not set its unit');
    await page.locator('#applyBulkThcUnit').click();
    assert.equal(await value(missing,'thcUnit'),'%');
    assert.deepEqual(await tags(kept),[]);
    await page.locator('#applyBulkTags').click();
    assert.deepEqual(await tags(kept),['Medical','Relaxed']);
    await page.locator('#applyCompletion').click();
    assert.equal(await value(missing,'thc'),'25');
    assert.equal(await value(missing,'thcUnit'),'%');
    assert.equal(await value(missing,'cost'),'10');
    assert.equal(await value(missing,'medBasePrice'),'30');
    assert.equal(await value(kept,'thc'),'20');
    assert.equal(await value(kept,'thcUnit'),'mg','Skipped THC must preserve its unit');
    assert.equal(await value(kept,'cost'),'7');
    assert.equal(await value(kept,'medBasePrice'),'40');
    assert.deepEqual(await tags(missing),['Medical','Relaxed'],'Existing tags are deduplicated during additive updates');
    assert.deepEqual(await tags(kept),['Medical','Relaxed']);
    for (const card of [hidden,unchecked]) {
      for (const key of ['thc','cost','medBasePrice']) assert.equal(await value(card,key),'','Hidden/unchecked entries must remain untouched');
    }
    assert.deepEqual(await tags(hidden),['Legacy']);
    assert.deepEqual(await tags(unchecked),[]);
    // Completion settings, unsaved row edits, selection and filtering survive reload.
    await page.evaluate(()=>persistDraft());
    assert.deepEqual(storage[draftKey].completion,{thc:'25',thcUnit:'%',cost:'10',medBasePrice:'30',tags:'Medical, Relaxed',fillBlanks:true});
    await page.reload();
    await page.waitForFunction(()=>document.querySelectorAll('.entry-card').length===4);
    assert.equal(await value(missing,'thc'),'25');
    assert.equal(await page.locator('#entrySearch').inputValue(),'Target');
    assert.equal(await unchecked.getByRole('checkbox',{name:'Select entry',exact:true}).isChecked(),false);
    assert.equal(await page.locator('#bulkThc').inputValue(),'25');
    assert.equal(await page.locator('#bulkTags .selected-brands button').count(),2);
    await page.locator('#bulkFillBlanks').uncheck();
    await page.locator('#bulkThcUnit').selectOption('mg');
    for (const id of ['bulkThc','bulkCost','bulkPrice']) await page.locator(`#${id}`).fill('0');
    await page.locator('#applyCompletion').click();
    for (const card of [missing,kept]) {
      for (const key of ['thc','cost','medBasePrice']) assert.equal(await value(card,key),'0','Override accepts zero');
      assert.equal(await value(card,'thcUnit'),'mg');
    }
    const zeros = await allValues();
    for (const id of ['bulkThc','bulkCost','bulkPrice']) await page.locator(`#${id}`).fill('');
    await page.locator('#applyCompletion').click();
    assert.deepEqual(await allValues(),zeros,'Blank inputs must not erase existing values');
    // Validate the whole request before applying any entered field or tag.
    await page.locator('#bulkThc').fill('42');
    await page.locator('#bulkCost').fill('-1');
    await page.locator('#bulkPrice').fill('19');
    await page.locator('#applyCompletion').click();
    await page.waitForFunction(()=>document.getElementById('workspaceStatus').classList.contains('error'));
    assert.deepEqual(await allValues(),zeros,'An invalid cost must prevent the otherwise valid THC and price updates too');
    // An unrelated invalid cost must not block a THC-only update (including mg).
    await page.locator('#applyBulkThc').click();
    assert.equal(await value(missing,'thc'),'42');
    assert.equal(await value(missing,'thcUnit'),'mg');
    assert.equal(await value(missing,'cost'),'0');
    assert.equal(await value(missing,'medBasePrice'),'0');
    await page.locator('#bulkThc').fill('0');
    await page.locator('#applyBulkThc').click();
    assert.deepEqual(await allValues(),zeros);
    await page.locator('#bulkThc').fill('');
    await page.locator('#applyBulkThc').click();
    assert.deepEqual(await allValues(),zeros,'Empty individual actions must not erase values');
    for (const id of ['bulkThc','bulkCost','bulkPrice']) await page.locator(`#${id}`).fill('');
    // Saved-template tags and live learned options appear in both row/shared pickers.
    await pickTag(missing.locator('[data-field="tags"]'),'Legacy');
    assert.deepEqual(await tags(missing),['Medical','Relaxed','Legacy']);
    await missing.getByRole('button',{name:'Changes',exact:true}).click();
    const tagDiff = missing.getByRole('row').filter({has:page.getByRole('cell',{name:'Tags',exact:true})});
    assert.equal(await tagDiff.getByRole('cell').nth(2).innerText(),'Medical, Relaxed, Legacy');
    await missing.getByRole('button',{name:'Remove Medical',exact:true}).click();
    assert.equal(await missing.locator('.diff-table').isVisible(),true);
    assert.equal(await tagDiff.getByRole('cell').nth(2).innerText(),'Relaxed, Legacy','Visible Changes must refresh after a row chip is removed');
    const rowTags = missing.locator('[data-field="tags"]');
    const rowTagSearch = rowTags.getByRole('combobox',{name:'Tags',exact:true});
    await rowTagSearch.fill('Relax');
    const originalChip = await rowTags.getByRole('button',{name:'Remove Relaxed',exact:true}).elementHandle();
    await missing.locator('[data-field="vendor"]').fill('Different vendor');
    assert.equal(await originalChip.evaluate(chip=>chip.isConnected),true,'Unrelated field refresh must retain tag chip DOM nodes');
    assert.equal(await rowTagSearch.inputValue(),'Relax','Editing another field must preserve the unfinished tag query');
    await missing.locator('[data-field="vendor"]').fill('Vendor');
    await originalChip.dispose();
    await missing.locator('[data-field="thc"]').fill('18.5');
    await missing.locator('[data-field="cost"]').fill('6.75');
    await missing.locator('[data-field="medBasePrice"]').fill('22');
    await page.evaluate(async()=>{await chrome.storage.local.set({options:{tags:['Fresh']}});});
    await pickTag(missing.locator('[data-field="tags"]'),'Fresh');
    assert.deepEqual(await tags(missing),['Relaxed','Legacy','Fresh']);
    await page.locator('#applyField').selectOption('tags');
    await pickTag(page.locator('#applyTagsValue'),'Fresh');
    await page.locator('#applySelected').click();
    assert.deepEqual(await tags(missing),['Fresh'],'Generic shared tag application replaces');
    assert.deepEqual(await tags(kept),['Fresh']);
    await page.locator('#clearValue').check();
    await page.locator('#applySelected').click();
    assert.deepEqual(await tags(missing),[],'Explicit clear removes tags');
    assert.deepEqual(await tags(kept),[]);
    await page.locator('#clearValue').uncheck();
    await page.locator('#applySelected').click();
    assert.deepEqual(await tags(missing),['Fresh']);
    assert.deepEqual(await tags(kept),['Fresh']);
    await page.locator('#saveProducts').click();
    await page.waitForFunction(()=>document.getElementById('workspaceStatus').textContent.startsWith('Saved 2 templates'));
    assert.equal(storage.templates['Target missing'].thc,'18.5');
    assert.equal(storage.templates['Target missing'].cost,'6.75');
    assert.equal(storage.templates['Target missing'].medBasePrice,'22');
    assert.equal(storage.templates['Target missing'].tags,'Fresh');
    assert.equal(storage.templates['Target kept'].thc,'0');
    assert.equal(storage.templates['Target kept'].tags,'Fresh');
    for (const name of ['Hidden','Target unchecked','Complete']) assert.deepEqual(storage.templates[name],original[name],'Unrelated saved templates must stay identical');
    for (const name of ['Target missing','Target kept']) {
      assert.equal(storage.templates[name].category,base.category);
      assert.equal(storage.templates[name].onlineDescription,base.onlineDescription);
      assert.equal(storage.templates[name].gramsConcentration,'','Partial templates remain saveable');
    }
    // A template write that changes no tags must keep the active picker intact.
    await rowTagSearch.fill('Fresh');
    const savedChip = await rowTags.getByRole('button',{name:'Remove Fresh',exact:true}).elementHandle();
    const savedOption = await rowTags.getByRole('option',{name:'✓ Fresh',exact:true}).elementHandle();
    await page.evaluate(async()=>{
      const {templates}=await chrome.storage.local.get('templates');
      templates.Complete.medBasePrice='55';
      await chrome.storage.local.set({templates});
    });
    assert.equal(await savedChip.evaluate(chip=>chip.isConnected),true,'Price-only storage changes must retain tag chips');
    assert.equal(await savedOption.evaluate(option=>option.isConnected),true,'Price-only storage changes must not rebuild tag options');
    assert.equal(await rowTagSearch.inputValue(),'Fresh');
    assert.equal(await rowTagSearch.getAttribute('aria-expanded'),'true');
    await page.evaluate(async()=>{
      const {templates}=await chrome.storage.local.get('templates');
      templates.Complete.medBasePrice='0';
      await chrome.storage.local.set({templates});
    });
    await savedChip.dispose();await savedOption.dispose();
    await page.reload();
    await page.waitForFunction(()=>document.querySelectorAll('.entry-card').length===4);
    assert.equal(await value(missing,'thc'),'18.5');
    assert.deepEqual(await tags(missing),['Fresh']);
    assert.equal(await page.locator('#bulkFillBlanks').isChecked(),false);
    assert.equal(await page.locator('#bulkThcUnit').inputValue(),'mg');
    // All independent apply/clear actions use exactly the checked, visible scope.
    await page.locator('#entrySearch').fill('Target');
    await kept.getByRole('checkbox',{name:'Select entry',exact:true}).uncheck();
    assert.match(await page.locator('#completionSelection').textContent(),/^1 shown product selected/);
    const protectedRows=await Promise.all([kept,hidden,unchecked].map(card=>card.locator('[data-field]').evaluateAll(fields=>fields.map(el=>[el.dataset.field,el.value ?? el.textContent]))));
    await page.locator('#bulkFillBlanks').check();
    for(const [button,key] of [['clearBulkThc','thc'],['clearBulkThcUnit','thcUnit'],['clearBulkCost','cost'],['clearBulkPrice','medBasePrice']]) {
      const before=await Promise.all(['thc','thcUnit','cost','medBasePrice'].map(field=>value(missing,field)));
      await page.locator(`#${button}`).click();
      assert.equal(await value(missing,key),'','Clear works even with only-fill-blank checked');
      for(const [index,field] of ['thc','thcUnit','cost','medBasePrice'].entries()) if(field!==key) assert.equal(await value(missing,field),before[index]);
    }
    await page.locator('#bulkThc').fill('12');await page.locator('#bulkCost').fill('7');await page.locator('#bulkPrice').fill('14');
    for(const [button,key,expected] of [['applyBulkThc','thc','12'],['applyBulkThcUnit','thcUnit','mg'],['applyBulkCost','cost','7'],['applyBulkPrice','medBasePrice','14']]) {
      const before=await Promise.all(['thc','thcUnit','cost','medBasePrice'].map(field=>value(missing,field)));
      await page.locator(`#${button}`).click();assert.equal(await value(missing,key),expected);
      for(const [index,field] of ['thc','thcUnit','cost','medBasePrice'].entries()) if(field!==key) assert.equal(await value(missing,field),before[index]);
    }
    assert.deepEqual(await Promise.all([kept,hidden,unchecked].map(card=>card.locator('[data-field]').evaluateAll(fields=>fields.map(el=>[el.dataset.field,el.value ?? el.textContent])))),protectedRows);
    await page.locator('#saveProducts').click();await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    await page.locator('#clearBulkThc').click();await page.locator('#clearBulkThcUnit').click();await page.locator('#clearBulkCost').click();await page.locator('#clearBulkPrice').click();
    await page.locator('#saveProducts').click();await page.waitForFunction(()=>!document.getElementById('saveProducts').disabled);
    for(const key of ['thc','thcUnit','cost','medBasePrice']) assert.equal(storage.templates['Target missing'][key],'');
    await missing.getByRole('checkbox',{name:'Select entry',exact:true}).uncheck();
    assert.match(await page.locator('#completionSelection').textContent(),/^0 shown products selected/);
    for(const id of ['applyBulkThc','applyBulkThcUnit','applyBulkCost','applyBulkPrice','clearBulkThc','clearBulkThcUnit','clearBulkCost','clearBulkPrice']) assert.equal(await page.locator(`#${id}`).isDisabled(),true);
    assert.deepEqual(errors,[]);
    console.log('Passed bulk completion loading, scoped updates, additive/replaced/cleared tags, live suggestions, numeric blanks/zero/override/validation, individual edits, live Changes, picker DOM/query preservation, partial saves and draft/reload preservation.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
