const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser-test-helper.cjs');

async function main() {
  const {browser, pageURL} = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const read = () => JSON.parse(localStorage.getItem('store') || '{}');
      window.writeStarts = [];
      window.chrome = {storage:{onChanged:{addListener(){}},local:{
        get: async key => ({[key]:read()[key]}),
        set: async data => {
          window.writeStarts.push(Object.keys(data));
          if (window.holdKind && Object.hasOwn(data, window.holdKind)) {
            window.holdKind = null;
            window.writeHeld = true;
            await new Promise(resolve => {window.releaseWrite = resolve;});
          }
          localStorage.setItem('store', JSON.stringify({...read(),...data}));
        },
        remove: async key => {const data=read(); delete data[key]; localStorage.setItem('store',JSON.stringify(data));},
      }}};
    });
    await page.goto(pageURL('popup.html'));
    await page.waitForFunction(() => document.getElementById('learnedInfo').textContent);
    await page.evaluate(() => {
      window.holdKind = 'templateDraft';
      document.getElementById('f_name').value = 'First';
      window.firstWrite = saveDraft();
    });
    await page.waitForFunction(() => window.writeHeld);
    await page.evaluate(() => {
      document.getElementById('f_name').value = 'Second';
      window.secondWrite = saveDraft();
      window.resetDraft = clearTemplateForm();
    });
    assert.equal(await page.evaluate(() => writeStarts.length), 1, 'Draft writes must wait for earlier writes');
    await page.evaluate(async () => {releaseWrite(); await Promise.all([firstWrite,secondWrite,resetDraft]);});
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.store).templateDraft), undefined, 'New must not resurrect a pending draft');
    await page.evaluate(async () => {document.getElementById('f_name').value='After reset'; await saveDraft();});
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.store).templateDraft.values.name), 'After reset');

    await page.locator('#templateName').fill('Original template');
    await page.locator('#f_name').fill('Original product');
    await page.evaluate(() => {window.holdKind='templates'; window.writeHeld=false;});
    await page.locator('#saveBtn').click();
    await page.waitForFunction(() => window.writeHeld);
    await page.locator('#f_name').fill('Edited while saving');
    await page.evaluate(() => releaseWrite());
    await page.waitForFunction(() => !document.getElementById('saveBtn').disabled);
    assert.equal(await page.locator('#f_name').inputValue(), 'Edited while saving');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.store).templates['Original template'].name), 'Original product');
    await page.locator('#templateName').fill('__proto__');
    await page.locator('#saveBtn').click();
    await page.waitForFunction(() => Object.hasOwn(JSON.parse(localStorage.store).templates,'__proto__'));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.store).templates.__proto__.name), 'Edited while saving');

    // Hints update after the async selection load, and unchanged lists reuse their nodes.
    await page.evaluate(async () => {
      popupDirectory = [{vendor:'Vendor A',brands:['A']},{vendor:'Vendor B',brands:['B']}];
      const templates = {'Vendor A':{vendor:'Vendor A'},'Vendor B':{vendor:'Vendor B'}};
      await chrome.storage.local.set({templates});
      await refresh();
    });
    await page.locator('#templateSelect').selectOption('Vendor A',{force:true});
    await page.waitForFunction(() => document.getElementById('f_vendor').value==='Vendor A');
    assert.deepEqual(await page.locator('#directoryBrandHints option').allTextContents(), ['A']);
    await page.locator('#templateSelect').selectOption('Vendor B',{force:true});
    await page.waitForFunction(() => document.getElementById('f_vendor').value==='Vendor B');
    assert.deepEqual(await page.locator('#directoryBrandHints option').allTextContents(), ['B']);
    assert.equal(await page.evaluate(() => {
      const option = document.querySelector('#directoryVendorHints option');
      updateDirectoryHints(); updateDirectoryHints();
      return option === document.querySelector('#directoryVendorHints option');
    }), true, 'Unchanged hints must reuse option nodes');
    assert.deepEqual(errors, []);
    console.log('Passed queued draft writes/reset, edits during save, reserved template names, async vendor hints and hint DOM reuse.');
  } finally {await browser.close();}
}
main().catch(error => {console.error(error); process.exitCode=1;});
