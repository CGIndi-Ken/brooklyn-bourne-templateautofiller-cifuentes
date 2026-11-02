const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser-test-helper.cjs');

async function main() {
  const {browser, pageURL} = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const read = () => JSON.parse(localStorage.getItem('shortcutStore') || '{}');
      window.saveClicks = 0;
      document.addEventListener('click', event => {if (event.target.id === 'saveBtn') window.saveClicks++;});
      document.addEventListener('templateEditorReady', () => {window.editorReady = true;});
      window.chrome = {storage:{onChanged:{addListener(){}},local:{
        get: async key => {
          if (key === 'templateDraft' && !window.initialReadReleased) {
            window.initialReadHeld = true;
            await new Promise(resolve => {window.releaseInitialRead = () => {window.initialReadReleased = true; resolve();};});
          }
          return {[key]:read()[key]};
        },
        set: async data => localStorage.setItem('shortcutStore', JSON.stringify({...read(),...data})),
        remove: async key => {const data=read(); delete data[key]; localStorage.setItem('shortcutStore',JSON.stringify(data));},
      }}};
    });
    await page.goto(pageURL('popup.html'));
    const shortcut = (options = {}) => page.evaluate(options => {
      const event = new KeyboardEvent('keydown', {key:'s',ctrlKey:true,bubbles:true,cancelable:true,...options});
      document.activeElement.dispatchEvent(event);
      return event.defaultPrevented;
    }, options);
    await page.waitForFunction(() => window.initialReadHeld);
    assert.equal(await shortcut(), false, 'Loading the editor must not trigger a partial save');
    assert.equal(await page.evaluate(() => saveClicks), 0);
    await page.evaluate(() => releaseInitialRead());
    await page.waitForFunction(() => window.editorReady);

    await page.locator('#templateName').fill('Keyboard template');
    await page.locator('#f_name').fill('Brand | Runtz | 3.5g (H)');
    await page.locator('#f_onlineDescription').fill('Reviewed strain description.');
    await page.keyboard.press('Control+s');
    await page.waitForFunction(() => JSON.parse(localStorage.shortcutStore).templates?.['Keyboard template']);
    await page.waitForFunction(() => !document.getElementById('saveBtn').disabled);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.shortcutStore).templates['Keyboard template'].onlineDescription), 'Reviewed strain description.');
    assert.equal(await page.locator('#f_name').inputValue(), '', 'Keyboard save uses the existing save and reset workflow');

    await page.locator('#templateName').fill('Mac keyboard template');
    await page.locator('#f_name').fill('Mac product');
    assert.equal(await shortcut({ctrlKey:false,metaKey:true,key:'S'}), true);
    await page.waitForFunction(() => JSON.parse(localStorage.shortcutStore).templates?.['Mac keyboard template']);
    await page.waitForFunction(() => !document.getElementById('saveBtn').disabled);
    const savedClicks = await page.evaluate(() => saveClicks);

    for (const options of [{ctrlKey:false},{repeat:true},{isComposing:true},{altKey:true},{shiftKey:true},{key:'x'}]) {
      assert.equal(await shortcut(options), false, `Unrelated key gesture remains unhandled: ${JSON.stringify(options)}`);
    }
    await page.evaluate(() => {document.getElementById('saveBtn').disabled = true;});
    assert.equal(await shortcut(), false, 'A disabled save action must not consume the shortcut');
    await page.evaluate(() => {document.getElementById('saveBtn').disabled = false; document.getElementById('templateView').hidden = true;});
    assert.equal(await shortcut(), false, 'Hidden Templates view must not save');
    assert.equal(await shortcut({ctrlKey:false,metaKey:true}), false);
    await page.evaluate(() => {document.getElementById('templateView').hidden = false;});
    assert.equal(await page.evaluate(() => saveClicks), savedClicks);
    assert.deepEqual(errors, []);
    console.log('Passed Ctrl/Cmd+S template saving, textarea focus, existing save workflow, initialization/visibility/disabled guards, and ignored repeat/composition/unrelated gestures.');
  } finally {await browser.close();}
}
main().catch(error => {console.error(error); process.exitCode=1;});
