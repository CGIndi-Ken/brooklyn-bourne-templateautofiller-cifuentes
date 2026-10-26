// Background worker: runs the autofill across several Chrome tabs, one after another.
// Content scripts can't switch Chrome tabs themselves, so the panel asks this worker to do it.

const DUTCHIE_TABS = "https://delta.backoffice.dutchie.com/*";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let batchRunning = false;

// Tabs must be on screen while they fill (Chrome slows hidden tabs right down)
async function showTab(tab) {
  await chrome.windows.update(tab.windowId, { focused: true });
  await chrome.tabs.update(tab.id, { active: true });
  await wait(600); // let the tab render
}

async function fillTab(tab, template) {
  await showTab(tab);
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: "fill", template });
  } catch (e) {
    return { error: "Couldn't reach this tab. Reload it and try again." };
  }
}

function describe(result) {
  if (result.skipped) return `skipped (${result.skipped})`;
  if (result.error) return result.error;
  if (result.busy) return "skipped (still busy with another run)";
  const issues = result.problems.length ? `, ${result.problems.length} issue${result.problems.length > 1 ? "s" : ""}` : "";
  return `${result.template}: ${result.filled}/${result.total} filled${issues}`;
}

function summarize(results) {
  const lines = [`Finished ${results.length} tab${results.length === 1 ? "" : "s"}.`];
  results.forEach((r, i) => {
    lines.push(`Tab ${i + 1}: ${describe(r)}`);
    (r.problems || []).slice(0, 3).forEach((p) => lines.push(`   ${p}`));
  });
  return lines.join("\n");
}

const tellOrigin = (tab, text) => chrome.tabs.sendMessage(tab.id, { type: "batchStatus", text }).catch(() => {});

// Fills every Dutchie tab in the origin tab's window, left to right, then returns to the origin tab.
// template: a template name, or null to use each tab's own selection.
async function runBatch(origin, template) {
  if (batchRunning) return tellOrigin(origin, "A multi-tab run is already in progress.");
  batchRunning = true;
  // Long runs: a harmless API call every 20s stops Chrome from putting this worker to sleep
  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  try {
    const tabs = (await chrome.tabs.query({ url: DUTCHIE_TABS, windowId: origin.windowId })).sort((a, b) => a.index - b.index);
    const results = [];
    for (const [i, tab] of tabs.entries()) {
      await tellOrigin(origin, `Filling tab ${i + 1} of ${tabs.length}...`);
      results.push(await fillTab(tab, template));
    }
    await showTab(origin);
    await tellOrigin(origin, summarize(results));
  } catch (e) {
    await tellOrigin(origin, `Multi-tab run stopped: ${e.message}`);
  } finally {
    clearInterval(keepAlive);
    batchRunning = false;
  }
}

// The panel's "Fill every tab" button
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "fillAllTabs" && sender.tab) runBatch(sender.tab, msg.template);
});

// The keyboard shortcut (works from any tab; see chrome://extensions/shortcuts)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-all-tabs") return;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active) runBatch(active, null);
});
