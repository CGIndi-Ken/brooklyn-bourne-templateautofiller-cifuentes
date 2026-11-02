const assert = require('node:assert/strict');
const path = require('node:path');
const {launchBrowser} = require('./browser-test-helper.cjs');

async function main() {
  const {browser, pageURL} = await launchBrowser();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/tag-picker-fixture*', route => route.fulfill({contentType:'text/html', body:'<!doctype html><html><body><button id="outside">Outside</button></body></html>'}));
    await page.goto(pageURL('tag-picker-fixture'));
    for (const file of ['brand-picker.js', 'tag-picker.js']) await page.addScriptTag({path:path.join(__dirname,file)});
    await page.evaluate(() => {
      window.options = ['Calming', 'Happy', 'Sleepy']; window.changes = [];
      window.tags = createTagPicker(' Calming, calming , Happy, ', () => window.options, value => changes.push(value));
      window.otherTags = createTagPicker('', () => [], () => {});
      tags.element.id='first'; otherTags.element.id='second'; document.body.append(tags.element, otherTags.element);
    });
    const first = page.locator('#first'), input = first.getByRole('combobox', {name:'Tags'}), second = page.locator('#second');
    assert.equal(await first.locator('.selected-brand').count(),2);
    assert.equal(await page.evaluate(() => tags.value()),'calming, Happy');
    await input.fill('Sleepy'); await first.getByRole('option', {name:'+ Sleepy', exact:true}).click();
    assert.equal(await page.evaluate(() => tags.value()),'calming, Happy, Sleepy');
    assert.equal(await page.evaluate(() => changes.at(-1)),'calming, Happy, Sleepy');
    await first.getByRole('button', {name:'Remove Happy', exact:true}).click();
    assert.equal(await page.evaluate(() => tags.value()),'calming, Sleepy');
    await page.evaluate(() => {window.roundTrip=tags.value();tags.set(roundTrip);});
    assert.equal(await page.evaluate(() => tags.value()),'calming, Sleepy');
    await page.evaluate(() => {window.options=['Energetic', 'Focused'];tags.refresh();});
    assert.equal(await page.evaluate(() => tags.value()),'calming, Sleepy');
    await input.fill('Focused');await input.press('ArrowDown');
    const active = await input.getAttribute('aria-activedescendant');
    assert.equal(await page.locator(`[id="${active}"]`).getAttribute('role'),'option');
    await input.press('Enter'); assert.equal(await page.evaluate(() => tags.value()),'calming, Sleepy, Focused');
    await input.press('Escape');assert.equal(await input.getAttribute('aria-expanded'),'false');
    await input.fill('');await input.press('Backspace');
    assert.equal(await page.evaluate(() => tags.value()),'calming, Sleepy');

    // Multiple row controls have separate combobox targets and active option IDs.
    await input.fill('');
    const otherInput = second.getByRole('combobox', {name:'Tags'});
    await otherInput.focus();
    assert.equal(await input.getAttribute('aria-expanded'),'false');
    assert.match(await second.locator('.sub').textContent(), /exact tag name/);
    await otherInput.fill('Handmade');await otherInput.press('ArrowDown');await otherInput.press('Enter');
    assert.equal(await page.evaluate(() => otherTags.value()),'Handmade');
    assert.equal(await first.locator('.selected-brand').count(),2);
    assert.equal(await page.evaluate(() => {
      const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);
      return ids.length===new Set(ids).size;
    }),true);
    await page.locator('#outside').click();assert.equal(await otherInput.getAttribute('aria-expanded'),'false');
    await page.evaluate(() => otherTags.set(' Second , second , Third '));
    assert.equal(await page.evaluate(() => otherTags.value()),'second, Third');
    await page.evaluate(() => otherTags.set(''));assert.equal(await second.locator('.selected-brand').count(),0);
    assert.equal(await otherInput.getAttribute('placeholder'),'Search tags…');

    // Existing brand-directory callers keep their six-argument API and wording.
    await page.evaluate(() => {
      const container=document.createElement('div'), input=document.createElement('input'), list=document.createElement('div'), chips=document.createElement('div');
      container.id='legacy';container.append(input,list,chips);document.body.append(container);
      const picker=createBrandPicker(container,input,list,chips,()=>['Brand One'],()=>{});picker.set([]);
    });
    const brand = page.locator('#legacy input');assert.equal(await brand.getAttribute('placeholder'),'Search brands…');
    await brand.focus();await page.locator('#legacy').getByRole('option', {name:'+ Brand One', exact:true}).click();
    assert.equal(await brand.getAttribute('placeholder'),'Search or add another brand…');

    // The real popup embeds a 660px workspace: options must fit above its footer.
    await page.setViewportSize({width:440,height:900});
    await page.evaluate(url => {
      const frame=document.createElement('iframe');frame.id='narrow';frame.src=url;
      frame.style.cssText='width:440px;height:660px;border:0';document.body.replaceChildren(frame);
    }, pageURL('tag-picker-fixture?embedded=1'));
    const embedded=await (await page.locator('#narrow').elementHandle()).contentFrame();
    await embedded.waitForLoadState();
    await embedded.addStyleTag({path:path.join(__dirname,'workspace.css')});
    for (const file of ['brand-picker.js','tag-picker.js']) await embedded.addScriptTag({path:path.join(__dirname,file)});
    await embedded.evaluate(() => {
      const footer=document.createElement('footer');footer.className='workspace-footer';footer.style.height='60px';document.body.append(footer);
      window.picker=createTagPicker('',()=>Array.from({length:20},(_,i)=>`Tag ${i}`),()=>{});
      picker.element.style.cssText='position:fixed;top:460px;left:16px;width:390px';document.body.append(picker.element);
    });
    const embeddedInput=embedded.getByRole('combobox',{name:'Tags'});
    await embeddedInput.focus();
    assert.equal(await embedded.locator('.brand-options').evaluate(list=>{
      const menu=list.getBoundingClientRect(), anchor=list.parentElement.getBoundingClientRect(), footer=document.querySelector('footer').getBoundingClientRect();
      return menu.top>=0 && menu.bottom<anchor.top && menu.bottom<=footer.top;
    }),true);
    // A shorter viewport constrains the menu instead of letting it overflow.
    await page.locator('#narrow').evaluate(frame=>{frame.style.height='300px';});
    await embedded.waitForFunction(()=>innerHeight===300);
    await embedded.evaluate(()=>{picker.element.style.top='100px';dispatchEvent(new Event('resize'));});
    assert.equal(await embedded.locator('.brand-options').evaluate(list=>{
      const menu=list.getBoundingClientRect(), footer=document.querySelector('footer').getBoundingClientRect();
      return menu.top>=0 && menu.bottom<=footer.top && menu.height<220;
    }),true);
    assert.deepEqual(errors,[]);
    console.log('Passed tag multi-selection/removal, comma round trip, refresh retention, keyboard controls, unique IDs, manual fallback, legacy brand behavior and narrow iframe dropdown bounds.');
  } finally { await browser.close(); }
}
main().catch(error => {console.error(error);process.exitCode=1;});
