// The floating on-page panel (UI only). Fill logic lives in engine.js / fillers.js / learn.js.

// ---------- Build the panel (Shadow DOM so the site's CSS can't affect it) ----------
const host = document.createElement("div");
host.style.cssText = "position:fixed;right:22px;bottom:22px;z-index:2147483647;display:none;";
const shadow = host.attachShadow({ mode: "open" });
shadow.innerHTML = `
  <style>
    ${AUTOFILL_THEME}
    ${AUTOFILL_LAYOUT}
    .box { max-width:calc(100vw - 44px); max-height:80vh; overflow:auto; border:1px solid var(--line); border-radius:10px; box-shadow:0 6px 20px #0004; }
    .head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .hide { color:var(--gold); }
    .pill { padding:12px 20px; border:1px solid var(--line); border-radius:12px; color:var(--gold);
      background:var(--surface); font:700 13px/1.5 "Segoe UI",Arial,sans-serif; }
    .tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin-top:9px; }
    .tabs button { padding:8px 0; }
    .tabs button.on { color:var(--gold); border-color:var(--gold); background:var(--section-top); }
    .primary { padding:11px 20px; font-size:14px; margin-top:13px; }
    .wide { width:100%; margin-top:9px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:13px; max-height:300px; overflow:auto; }
    .row { display:grid; grid-template-columns:2fr 1fr 1fr; gap:7px; margin-top:13px; }
    #next { margin-top:13px; color:var(--text); }
    #statusToggle { width:100%; margin-top:13px; text-align:left; color:var(--gold); }
    #status { margin-top:9px; padding:12px 14px; max-height:150px; overflow:auto; white-space:pre-wrap;
      background:var(--input); color:var(--text); border:1px solid var(--line); border-radius:8px; }
    #status:empty { display:none; }
  </style>
  <button class="pill" id="pill" hidden>Autofiller</button>
  <div class="box app-surface" id="box">
    <div class="head"><div><span class="brand">Brooklyn Bourne</span><span class="brand-sub">Autofiller</span></div><button class="hide" id="hideBtn">Hide</button></div>
    <div class="stripe"></div>
    <div class="bar">
      <div class="theme-picker"><label for="panelTheme">Theme</label><select id="panelTheme" aria-label="Theme"></select></div>
      <select id="tpl" aria-label="Template"></select>
      <div class="tabs" id="tabs"></div>
    </div>
    <div class="body">
      <div class="tab" id="tab-fill">
        <section class="card">
          <div class="section-heading">Fill product</div>
          <div class="fields">
            <button class="primary gold-button" id="all">Fill all</button>
            <p class="sub">Fills this product using your template. Shortcut: Alt+Shift+A</p>
          </div>
        </section>
        <section class="card">
          <div class="section-heading">All open Dutchie tabs</div>
          <div class="fields">
            <label class="field" for="batchTpl">Template for all tabs</label>
            <select id="batchTpl" aria-label="Template for all tabs"></select>
            <button class="wide" id="allTabs">Fill every tab, one by one</button>
            <p class="sub">Switches to each product tab in this window, fills it, then comes back here. Shortcut: Alt+Shift+Z</p>
          </div>
        </section>
      </div>
      <section class="tab card" id="tab-steps" hidden>
        <div class="section-heading">Step by step</div>
        <div class="fields">
          <div id="next"></div>
          <div class="row" id="stepRow"></div>
          <p class="sub">One field at a time. Open a dropdown first to use it for the next step. Next: Alt+Shift+N</p>
        </div>
      </section>
      <section class="tab card" id="tab-fields" hidden>
        <div class="section-heading">Single fields</div>
        <div class="fields"><div class="grid" id="grid"></div></div>
      </section>
      <section class="tab card" id="tab-lists" hidden>
        <div class="section-heading">Learn dropdown lists</div>
        <div class="fields">
          <div class="grid" id="learnGrid"></div>
          <p class="sub">Reads this page's lists for the template maker. Pick a Category first so Regulatory category loads correctly.</p>
        </div>
      </section>
      <div id="statusArea" hidden>
        <button id="statusToggle" aria-expanded="true" aria-controls="status">Hide status updates</button>
        <div id="status" role="status"></div>
      </div>
    </div>
  </div>`;
document.documentElement.appendChild(host);

const $s = (id) => shadow.getElementById(id);
initThemeSelector($s("panelTheme"), host);
const tplSelect = $s("tpl");
const batchTpl = $s("batchTpl");
const statusEl = $s("status");
const nextEl = $s("next");
const box = $s("box");
const pill = $s("pill");

let statusMinimized = false;
function renderStatus() {
  $s("statusArea").hidden = !statusEl.textContent;
  statusEl.hidden = statusMinimized;
  $s("statusToggle").textContent = statusMinimized ? "Show status updates" : "Hide status updates";
  $s("statusToggle").setAttribute("aria-expanded", String(!statusMinimized));
}
const setStatus = (text) => { statusEl.textContent = text; renderStatus(); };
status.set = setStatus;
chrome.storage.local.get("statusMin").then((r) => {
  statusMinimized = !!r.statusMin;
  renderStatus();
});
$s("statusToggle").__onPress = () => {
  statusMinimized = !statusMinimized;
  renderStatus();
  chrome.storage.local.set({ statusMin: statusMinimized });
};

let templates = {};
let stepIdx = 0;
let steps = [];
let minimized = false;
let forced = false; // Alt+Shift+D shows the panel on any page

// ---------- Buttons ----------
// Panel buttons run through __onPress: the page never sees the click (it would close any
// open dropdown) and focus stays where it was.
function makeButton(text, onPress, parent, cls) {
  const b = document.createElement("button");
  b.textContent = text;
  if (cls) b.className = cls;
  b.__onPress = onPress;
  parent.appendChild(b);
  return b;
}

["pointerdown", "pointerup", "mousedown", "mouseup", "click"].forEach((type) => {
  window.addEventListener(
    type,
    (e) => {
      if (e.target !== host) return;
      const path = e.composedPath();
      const btn = path.find((n) => n.tagName === "BUTTON");
      if (!btn) return; // let the <select>s behave normally
      e.stopPropagation();
      e.preventDefault();
      if (type === "click" && btn.__onPress) btn.__onPress();
    },
    true
  );
});

// ---------- Minimize to a pill (remembered between visits) ----------
function setMinimized(value) {
  minimized = value;
  box.hidden = value;
  pill.hidden = !value;
  chrome.storage.local.set({ panelMin: value });
}
chrome.storage.local.get("panelMin").then((r) => {
  minimized = !!r.panelMin;
  box.hidden = minimized;
  pill.hidden = !minimized;
});
$s("hideBtn").__onPress = () => setMinimized(true);
pill.__onPress = () => setMinimized(false);

// ---------- Tabs: Fill / Steps / Fields / Lists ----------
const TABS = [["fill", "Fill"], ["steps", "Steps"], ["fields", "Fields"], ["lists", "Lists"]];
const tabButtons = {};
function showTab(id) {
  TABS.forEach(([t]) => {
    $s(`tab-${t}`).hidden = t !== id;
    tabButtons[t].classList.toggle("on", t === id);
  });
}
TABS.forEach(([id, label]) => { tabButtons[id] = makeButton(label, () => showTab(id), $s("tabs")); });
showTab("fill");

// ---------- Templates ----------
const currentTemplate = () => templates[tplSelect.value];

function fillSelectOptions(select, names, firstLabel) {
  const current = select.value;
  select.innerHTML = "";
  if (firstLabel) select.appendChild(new Option(firstLabel, ""));
  names.forEach((name) => select.appendChild(new Option(name, name)));
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function renderTemplates() {
  const names = Object.keys(templates);
  fillSelectOptions(tplSelect, names);
  fillSelectOptions(batchTpl, names, "Each tab's own template");
  resetSteps();
  renderStep();
}

async function loadTemplates() {
  if (typeof categoryPairingsReady !== "undefined") await categoryPairingsReady;
  const stored = await chrome.storage.local.get("templates");
  templates = stored.templates || {};
  renderTemplates();
}
loadTemplates();
document.addEventListener("categoryPairingsChanged",() => {resetSteps();renderStep();});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.templates) {
    templates = changes.templates.newValue || {};
    renderTemplates();
  }
});
tplSelect.addEventListener("change", () => { resetSteps(); renderStep(); });

// ---------- Running fills ----------
function showResult(r) {
  if (r.busy) return setStatus("Busy with another run.");
  if (r.empty) return setStatus("Nothing to fill for that in this template.");
  setStatus(`Filled ${r.filled}/${r.total}.` + (r.problems.length ? "\n" + r.problems.join("\n") : ""));
}

async function run(defs, opts) {
  const template = currentTemplate();
  if (!template) {
    setStatus("Create a template in the extension popup first.");
    return null;
  }
  const result = await runFields(defs, template, opts);
  showResult(result);
  return result;
}

async function learn(defs) {
  const r = await learnLists(defs);
  if (!r) return setStatus("Busy with another run.");
  setStatus(
    `Learned: ${r.done.join(", ") || "nothing"}.` +
      (r.failed.length ? `\nCouldn't read: ${r.failed.join(", ")}` : "") +
      "\nOpen the extension popup to see the lists."
  );
}

// ---------- Fill tab ----------
$s("all").__onPress = () => run(FIELD_DEFS, { reuseOpen: false });
$s("allTabs").__onPress = async () => {
  setStatus("Starting. Switching through your open Dutchie tabs...");
  try {
    await chrome.runtime.sendMessage({ type: "fillAllTabs", template: batchTpl.value || null });
  } catch (e) {
    setStatus("Couldn't reach the extension. Reload this tab and try again.");
  }
};

// ---------- Steps tab ----------
function resetSteps() {
  const template = currentTemplate();
  steps = template ? buildSteps(template) : [];
  stepIdx = 0;
}
function renderStep() {
  nextEl.textContent = !steps.length
    ? "No values in this template"
    : stepIdx >= steps.length
    ? "All steps done"
    : `Next (${stepIdx + 1}/${steps.length}): ${steps[stepIdx].label}`;
}

async function doNext() {
  if (stepIdx >= steps.length) return renderStep();
  const step = steps[stepIdx];
  const result = await run(step.defs, { reuseOpen: true });
  if (steps[stepIdx] === step && result && !result.busy && !result.problems.length) stepIdx++; // stay on this step if a run is already active or failed
  renderStep();
}

const stepRow = $s("stepRow");
makeButton("Next (Alt+Shift+N)", doNext, stepRow);
makeButton("Skip", () => { stepIdx++; renderStep(); }, stepRow);
makeButton("Restart", () => { stepIdx = 0; renderStep(); }, stepRow);

// ---------- Fields tab ----------
const grid = $s("grid");
makeButton("Text fields", () => run(FIELD_DEFS.filter((d) => d.type === "text"), { reuseOpen: true }), grid);
FIELD_DEFS.filter((d) => d.type !== "text").forEach((def) =>
  makeButton(def.label, () => run([def], { reuseOpen: true }), grid)
);

// ---------- Lists tab ----------
const learnGrid = $s("learnGrid");
makeButton("Learn dropdowns", () => learn(FIELD_DEFS.filter((d) => d.type === "select" && !d.fixed && !d.copyOf)), learnGrid);
makeButton("Learn long lists (about a minute)", () => learn(FIELD_DEFS.filter((d) => d.type === "autocomplete")), learnGrid);

// ---------- Messages from the background worker (multi-tab runs) ----------
// Fills this tab. `templateName` null means "use whatever this tab's panel has selected".
async function fillThisTab(templateName) {
  if (!document.querySelector(SELECTORS.productFormMarker)) return { skipped: "No product form on this tab" };
  const name = templateName || tplSelect.value;
  const template = templates[name];
  if (!template) return { skipped: templateName ? `Template "${templateName}" not found` : "No template selected" };

  tplSelect.value = name;
  resetSteps();
  renderStep();
  const r = await runFields(FIELD_DEFS, template, { reuseOpen: false });
  showResult(r);
  return { template: name, filled: r.filled, total: r.total, problems: r.problems, busy: !!r.busy };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "fill") {
    fillThisTab(msg.template)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message }));
    return true; // keep the channel open for the async reply
  }
  if (msg.type === "batchStatus") setStatus(msg.text);
});

// ---------- Keyboard shortcuts (focus never leaves the page) ----------
const SHORTCUTS = { KeyA: "all", KeyN: "next", KeyS: "strain", KeyV: "vendor", KeyB: "brand", KeyT: "taxCategories" };
document.addEventListener(
  "keydown",
  (e) => {
    if (!(e.altKey && e.shiftKey)) return;
    if (e.code === "KeyD") { forced = !forced; updatePanelVisibility(); return; }
    const key = SHORTCUTS[e.code];
    if (!key) return;
    e.preventDefault();
    if (key === "all") run(FIELD_DEFS, { reuseOpen: false });
    else if (key === "next") doNext();
    else run(FIELD_DEFS.filter((d) => d.key === key), { reuseOpen: true });
  },
  true
);

// React to form mounting/unmounting instead of polling every second while idle.
let productForm = null;
function updatePanelVisibility() {
  if (!productForm?.isConnected || !productForm.matches(SELECTORS.productFormMarker)) productForm = document.querySelector(SELECTORS.productFormMarker);
  const display = forced || productForm ? "block" : "none";
  if (host.style.display !== display) host.style.display = display;
}
const formObserver = new MutationObserver((records) => {
  if (productForm?.isConnected && productForm.matches(SELECTORS.productFormMarker)) return;
  const relevant = productForm || records.some((record) =>
    record.type === "attributes" || [...record.addedNodes].some((node) =>
      node.nodeType === 1 && (node.matches(SELECTORS.productFormMarker) || node.querySelector(SELECTORS.productFormMarker))
    )
  );
  if (relevant) updatePanelVisibility();
});
formObserver.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:["data-testid"]});
updatePanelVisibility();
