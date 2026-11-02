const assert = require('node:assert/strict');
const {launchBrowser} = require('./browser-test-helper.cjs');

async function main() {
  const {browser, pageURL} = await launchBrowser();
  try {
    const context = await browser.newContext();
    const storage = {
      brandDirectory: [{vendor:'Alpha',brands:['A']},{vendor:'Beta',brands:['B']}],
      templates: {Product:{name:'Product',vendor:'Alpha',brand:'A'}},
    };
    const savedTemplates = structuredClone(storage.templates);
    let failWrite = false;
    await context.exposeBinding('readStore', (_,key) => ({[key]:storage[key]}));
    await context.exposeBinding('writeStore', async (_,data) => {
      if (failWrite && data.brandDirectory) throw Error('Storage unavailable');
      const changes = Object.fromEntries(Object.entries(data).map(([key,newValue]) => [key,{newValue}]));
      Object.assign(storage,data);
      await Promise.all(context.pages().flatMap(page => page.frames()).map(frame => frame.evaluate(changes => {
        for (const listener of window.storeListeners || []) listener(changes,'local');
      },changes)));
    });
    await context.addInitScript(() => {
      window.storeListeners = [];
      window.chrome = {storage:{local:{get:key=>readStore(key),set:data=>writeStore(data),remove:async()=>{}},
        onChanged:{addListener:listener=>storeListeners.push(listener)}}};
    });
    const errors = [];
    const page = await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pageURL('workspace.html?view=directory'));
    await page.waitForFunction(()=>initialized);
    const remove = page.getByRole('button',{name:'Delete vendor',exact:true});
    assert.equal(await remove.isDisabled(),true);
    await page.locator('#vendorList button').filter({hasText:'Alpha'}).click();
    assert.equal(await remove.isEnabled(),true);
    page.once('dialog',dialog=>dialog.dismiss());
    await remove.click();
    assert.equal(storage.brandDirectory.length,2,'Cancel must preserve the directory');
    failWrite=true;
    page.once('dialog',dialog=>dialog.accept());
    await remove.click();
    await page.waitForFunction(()=>document.getElementById('workspaceStatus').textContent.includes('Could not delete vendor'));
    assert.equal(storage.brandDirectory.length,2,'Failed writes must preserve the directory');
    assert.equal(await remove.isEnabled(),true);
    failWrite=false;

    const popup = await context.newPage();popup.on('pageerror',error=>errors.push(error.message));
    await popup.goto(pageURL('popup.html'));
    await popup.waitForSelector('#directoryVendorHints',{state:'attached'});
    await popup.getByRole('button',{name:'Brand directory',exact:true}).click();
    const embedded = popup.frameLocator('#directoryWorkspace');
    await embedded.locator('#vendorList button').filter({hasText:'Alpha'}).click();
    // A newer unrelated entry must survive even if this window hasn't seen it yet.
    storage.brandDirectory.push({vendor:'Gamma',brands:['G']});
    page.once('dialog',async dialog=>{
      assert.match(dialog.message(),/Saved product templates will be kept/);
      await dialog.accept();
    });
    await remove.click();
    await page.waitForFunction(()=>document.getElementById('workspaceStatus').textContent.startsWith('Deleted Alpha'));
    assert.deepEqual(storage.brandDirectory.map(entry=>entry.vendor),['Beta','Gamma']);
    assert.deepEqual(storage.templates,savedTemplates);
    assert.equal(await page.locator('#vendorName').inputValue(),'');
    assert.equal(await remove.isDisabled(),true);
    assert.equal(await page.locator('#selectedBrands button').count(),0);
    assert.equal(await page.locator('#createBrandBatch').isDisabled(),true);
    assert.equal(await embedded.locator('#vendorName').inputValue(),'','Other open views must clear deleted selections');
    assert.equal(await embedded.locator('#deleteVendor').isDisabled(),true);
    assert.deepEqual(await popup.locator('#directoryVendorHints option').allTextContents(),['Beta','Gamma']);

    // Deleting through the popup uses the same persisted directory.
    await page.locator('#vendorList button').filter({hasText:'Beta'}).click();
    await embedded.locator('#vendorList button').filter({hasText:'Beta'}).click();
    popup.once('dialog',dialog=>dialog.accept());
    await embedded.getByRole('button',{name:'Delete vendor',exact:true}).click();
    await embedded.locator('#workspaceStatus').filter({hasText:'Deleted Beta'}).waitFor();
    assert.equal(await page.locator('#vendorName').inputValue(),'');
    await page.reload();await page.waitForFunction(()=>initialized);
    assert.equal(await page.locator('#vendorList button').count(),1);
    assert.match(await page.locator('#vendorList').innerText(),/Gamma/);
    assert.deepEqual(storage.templates,savedTemplates);
    assert.deepEqual(errors,[]);
    console.log('Passed vendor deletion/cancel/failure, latest directory preservation, template preservation, cross-view cleanup, popup deletion and reload persistence.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
