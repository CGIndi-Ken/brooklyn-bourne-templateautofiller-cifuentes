const assert = require('node:assert/strict');
const path = require('node:path');
const {launchBrowser} = require('./browser-test-helper.cjs');

async function main() {
  const {browser} = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.addInitScript(()=>{
      window.chrome = {
        storage:{local:{get:async()=>({templates:{A:{name:'A'}}}),set:async()=>{}},onChanged:{addListener(){}}},
        runtime:{onMessage:{addListener(){}}},
      };
    });
    await page.goto('about:blank');
    for (const file of ['fields.js','dom-utils.js','fillers.js','engine.js','learn.js','theme.js','template-picker-style.js','template-picker.js','panel.js']) await page.addScriptTag({path:path.join(__dirname,file)});
    await page.waitForFunction(()=>steps.length > 0);
    // Mimic a slow fill while the user skips, restarts, or chooses another template.
    for (const action of ['skip','restart','template','unchanged']) {
      const index = await page.evaluate(async action=>{
        resetSteps();
        run = () => new Promise(resolve=>{window.finishStep=resolve;});
        const pending = doNext();
        if (action === 'skip') stepIdx++;
        if (action === 'restart') resetSteps();
        if (action === 'template') {templates.B={name:'B'};templates={B:templates.B};renderTemplates();}
        window.finishStep({problems:[]});
        await pending;
        return stepIdx;
      }, action);
      assert.equal(index, action === 'restart' || action === 'template' ? 0 : 1, action);
    }
    console.log('Passed step completion races with Skip, Restart, template changes, and normal advancement.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
