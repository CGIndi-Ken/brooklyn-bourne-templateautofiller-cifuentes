const workspaceStyle = document.createElement("style");
workspaceStyle.textContent = AUTOFILL_THEME + AUTOFILL_LAYOUT;
document.head.prepend(workspaceStyle);
const $w = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const embedded = params.has("embedded");
document.body.classList.toggle("embedded", embedded);
initThemeSelector($w("workspaceTheme"), document.documentElement);
const draftKey = `productWorkspace:${params.get("launch") || params.get("batch") || (embedded ? "embedded" : "main")}`;
const TOP_FIELDS = ["name", "vendor", "brand", "gramsConcentration", "thc", "thcUnit", "cost", "medBasePrice", "strain", "tags"];
const FIELD_MAP = Object.fromEntries(WORKSPACE_FIELDS.map((def) => [def.key, def]));
const rows = new Map();
let templates = {}, directory = [], learned = {}, shared = {}, recent = null;
let tagOptions = [];
let deletingVendor = false;
let activeVendor = "", saveTimer, saving = false, initialized = false, workspaceDirty = false, lastWorkspaceDraft = "";
const read = async (key) => (await chrome.storage.local.get(key))[key];
const clone = (value) => structuredClone(value);
function node(tag, text = "", cls = "") { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; return el; }
function setWorkspaceStatus(text, error = false) { $w("workspaceStatus").textContent = text; $w("workspaceStatus").classList.toggle("error", error); }
const brandPicker = createBrandPicker($w("brandPicker"),$w("vendorBrands"),$w("brandOptions"),$w("selectedBrands"),
  () => [...(learned.brand || []),...directory.flatMap((entry)=>entry.brands),...Object.values(templates).map((template)=>template.brand).filter(Boolean)],
  () => { $w("createBrandBatch").disabled=true;setWorkspaceStatus("Save this pairing to use the updated brand selection in a batch."); });
const bulkTagPicker = createTagPicker("", () => tagOptions, scheduleSave);
$w("bulkTags").append(bulkTagPicker.element);
const applyTagPicker = createTagPicker("", () => tagOptions, () => {});
$w("applyTagsValue").append(applyTagPicker.element);
function refreshTagOptions() {
  const next = [...new Set([...(learned.tags || []), ...Object.values(templates).flatMap((template) => String(template.tags || "").split(","))].map((tag) => tag.trim()).filter(Boolean))];
  if (JSON.stringify(next) === JSON.stringify(tagOptions)) return;
  tagOptions=next;
  bulkTagPicker.refresh();applyTagPicker.refresh();
  for (const row of rows.values()) row.tagPicker?.refresh();
}
function completionDraft() {
  return {thc:$w("bulkThc").value, thcUnit:$w("bulkThcUnit").value, cost:$w("bulkCost").value, medBasePrice:$w("bulkPrice").value, tags:bulkTagPicker.value(), fillBlanks:$w("bulkFillBlanks").checked};
}
function restoreCompletion(draft) {
  if (!draft) return;
  for (const [id,key] of [["bulkThc","thc"],["bulkCost","cost"],["bulkPrice","medBasePrice"]]) $w(id).value=draft[key] ?? "";
  $w("bulkThcUnit").value=draft.thcUnit === "mg" ? "mg" : "%";
  $w("bulkFillBlanks").checked=draft.fillBlanks !== false;
  bulkTagPicker.set(draft.tags || "");
}
for (const id of ["bulkThc","bulkThcUnit","bulkCost","bulkPrice","bulkFillBlanks"]) $w(id).addEventListener("input",scheduleSave);
$w("loadIncomplete").addEventListener("click",() => {
  const keys=Object.keys(templates).filter((key)=>["thc","cost","medBasePrice","tags"].some((field)=>!String(templates[key][field] ?? "").trim()));
  const before=rows.size;loadKeys(keys);scheduleSave();
  setWorkspaceStatus(`Loaded ${rows.size-before} unfinished templates. Select the entries to update, then Save all templates.`);
});
function applyCompletion(field = "all", clear = false) {
  const changes={};
  for (const [id,key,label] of [["bulkThc","thc","THC"],["bulkCost","cost","Cost"],["bulkPrice","medBasePrice","Base price"]]) {
    if (clear || (field !== "all" && field !== key)) continue;
    const input=$w(id), value=input.value.trim();
    if (!input.checkValidity() || (value && !Number.isFinite(Number(value)))) return setWorkspaceStatus(`${label} must be a non-negative number.`,true);
    if (value) changes[key]=value;
  }
  if (field === "thcUnit") changes.thcUnit=$w("bulkThcUnit").value;
  if (clear) changes[field]="";
  const tags=!clear && (field === "all" || field === "tags") ? bulkTagPicker.value().split(",").map((tag)=>tag.trim()).filter(Boolean) : [];
  if (!Object.keys(changes).length && !tags.length) {
    const label={thc:"a THC value",cost:"a cost",medBasePrice:"a price",tags:"tags"}[field];
    return setWorkspaceStatus(label ? `Enter or select ${label} first.` : "Enter THC, cost, price or choose tags first.",true);
  }
  let count=0;
  for (const row of rows.values()) if (row.selected && !row.element.hidden) {
    for (const [key,value] of Object.entries(changes)) {
      if (!clear && $w("bulkFillBlanks").checked && row.values[key].trim()) continue;
      row.values[key]=value;
      if (key === "thc" && field === "all") row.values.thcUnit=$w("bulkThcUnit").value;
    }
    if (tags.length) {
      const merged=new Map();
      for (const tag of [...row.values.tags.split(","),...tags].map((tag)=>tag.trim()).filter(Boolean)) if(!merged.has(tag.toLowerCase())) merged.set(tag.toLowerCase(),tag);
      row.values.tags=[...merged.values()].join(", ");
    }
    refreshValues(row);if(row.tab === "changes") renderPanel(row);count++;
  }
  const label={thc:"THC value",thcUnit:"THC unit",cost:"cost",medBasePrice:"price",tags:"tags",all:"details"}[field];
  updateMetrics();scheduleSave();setWorkspaceStatus(`${clear ? "Cleared" : "Applied"} ${label} ${clear ? "on" : "to"} ${count} shown selected entries. Review them, then Save all templates.`);
}
for (const [id,field] of [["applyCompletion","all"],["applyBulkThc","thc"],["applyBulkThcUnit","thcUnit"],["applyBulkCost","cost"],["applyBulkPrice","medBasePrice"],["applyBulkTags","tags"]]) $w(id).addEventListener("click",() => applyCompletion(field));
for (const [id,field] of [["clearBulkThc","thc"],["clearBulkThcUnit","thcUnit"],["clearBulkCost","cost"],["clearBulkPrice","medBasePrice"]]) $w(id).addEventListener("click",() => applyCompletion(field,true));

function showView(view) {
  $w("productsView").hidden = view !== "products";
  $w("directoryView").hidden = view !== "directory";
  $w("saveProducts").hidden = view !== "products";
  document.querySelectorAll("[data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
}
document.querySelector(".workspace-nav").addEventListener("click", (event) => { if (event.target.dataset.view) showView(event.target.dataset.view); });
$w("toggleTools").addEventListener("click",()=>{const open=document.body.classList.toggle("tools-open");$w("toggleTools").setAttribute("aria-expanded",String(open));});

function serializeWorkspace() { return {shared, completion:completionDraft(), rows:[...rows.values()].map(({id,key,values,baseline,stored,selected,tab,collapsed}) => ({id,key,values,baseline,stored,selected,tab,collapsed})), quickNames:$w("quickNames").value, search:$w("entrySearch").value}; }
function scheduleSave() { workspaceDirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(() => persistDraft().catch((e) => setWorkspaceStatus(`Draft could not be saved: ${e.message}`, true)), 250); }
let draftWrite = Promise.resolve();
function persistDraft() {
  clearTimeout(saveTimer);
  // Focus changes and debounce flushes can overlap; keep storage writes ordered.
  const pending = draftWrite.then(writeDraft);
  draftWrite = pending.catch(() => {});
  return pending;
}
async function writeDraft() {
  if (!initialized || !workspaceDirty) return;
  const draft = serializeWorkspace(), serialized = JSON.stringify(draft);
  if (serialized === lastWorkspaceDraft) {workspaceDirty=false;return;}
  await chrome.storage.local.set({[draftKey]:draft});
  lastWorkspaceDraft=serialized;
  if (JSON.stringify(serializeWorkspace())===serialized) workspaceDirty=false;
}
window.addEventListener("pagehide", () => { persistDraft().catch(() => {}); });
document.addEventListener("visibilitychange", () => { if (document.hidden) persistDraft().catch(() => {}); });
document.addEventListener("focusout", () => { if (initialized) persistDraft().catch(() => {}); });

function addRow(values, {key = "", baseline = values, stored = null, id = crypto.randomUUID(), selected = true, tab = "", collapsed = false} = {}) {
  if (key && [...rows.values()].some((row) => row.key === key)) return;
  const row = {id, key, values:productValues(values), baseline:clone(baseline), stored:stored && clone(stored), selected, tab, collapsed:!!collapsed};
  rows.set(id, row);
  renderRow(row);
  updateRow(row);
}
function loadKeys(keys, baseline, collapsed = false) {
  for (const key of keys) if (Object.hasOwn(templates,key)) addRow(templates[key], {key, stored:templates[key], baseline:baseline || templates[key], collapsed});
  updateMetrics();
}
function choicesFor(def) { return [...new Set([...(learned[def.key] || []), ...(def.options || []),...(def.key === "strain" ? Object.values(templates).map((template)=>template.strain).filter(Boolean) : [])])].filter((value)=>def.key !== "vendor" || isSelectableVendor(value)); }
function fieldControl(def, values, row) {
  const label = node(def.key === "tags" ? "div" : "label", def.label + (def.required ? " *" : ""));
  if (def.key === "tags") {
    label.className="tag-field";
    row.tagPicker=createTagPicker(values.tags, () => tagOptions, (value) => {
      row.values.tags=value;updateRow(row);if(row.tab === "changes") renderPanel(row);updateMetrics();scheduleSave();
    });
    row.tagPicker.element.dataset.field="tags";
    label.append(row.tagPicker.element,node("span","","field-state"));
    return label;
  }
  let input;
  if (def.type === "select" && choicesFor(def).length) {
    input = document.createElement("select");
    for (const value of [...new Set(["", ...choicesFor(def), values[def.key] || ""])]) input.add(new Option(value || "Skip", value));
  } else {
    input = document.createElement(def.input === "textarea" ? "textarea" : "input");
    if (def.input === "number") { input.type = "number"; input.step = "any"; }
    if (def.maxLength) input.maxLength = def.maxLength;
  }
  input.dataset.field = def.key;
  input.value = values[def.key] || "";
  if (["regulatoryCategory","externalCategory"].includes(def.key)) input.disabled = !values.categoryPresetUnlocked;
  if (def.key === "strain") input.setAttribute("list", "strainsList");
  if (def.key === "vendor") input.setAttribute("list", "vendorsList");
  if (def.key === "brand") input.setAttribute("list", brandListId(values.vendor));
  label.append(input, node("span", "", "field-state"));
  if (def.key === "name") label.classList.add("name-field");
  return label;
}
function brandListId(vendor) { const index = directory.findIndex((entry) => entry.vendor === vendor); return index < 0 ? "allBrandsList" : `vendorBrands-${index}`; }
function renderRow(row) {
  const card = node("article", "", "entry-card"); card.dataset.row = row.id;
  const header = node("div", "", "entry-head");
  const select = document.createElement("input"); select.type = "checkbox"; select.checked = row.selected; select.dataset.action = "select"; select.setAttribute("aria-label", "Select entry");
  const title = node("strong"); title.dataset.title = "";
  const badge = node("span", "", "entry-state"); badge.dataset.badge = "";
  const collapse = node("button"); collapse.dataset.action="collapse";collapse.setAttribute("aria-controls",`entry-content-${row.id}`);
  const duplicate = node("button", "Duplicate settings"); duplicate.dataset.action = "duplicate";
  const reload = node("button", "Reload"); reload.dataset.action="reload";reload.hidden=!row.key;reload.title="Reload the saved template and discard local changes";
  const remove = node("button", "Remove"); remove.dataset.action = "remove"; remove.title = "Remove from this workspace; saved templates are kept";
  header.append(select,title,badge,collapse,duplicate,reload,remove);
  const content = node("div", "", "entry-content");content.id=`entry-content-${row.id}`; const grid = node("div", "", "product-grid");
  for (const key of TOP_FIELDS) grid.append(fieldControl(FIELD_MAP[key], row.values,row));
  const tabs = node("div", "", "editor-tabs");
  for (const [id,label] of [["details","Details"],["description","Online description"],["changes","Changes"]]) {
    const button = node("button",label); button.dataset.action = "tab"; button.dataset.tab = id; button.setAttribute("aria-expanded", String(row.tab === id)); tabs.append(button);
  }
  const panel = node("div", "", "entry-panel"); content.append(grid,tabs,panel); card.append(header,content);
  row.element = card; $w("entries").append(card); renderPanel(row);setCollapsed(row,row.collapsed);
}
function setCollapsed(row,collapsed) {
  row.collapsed=collapsed;
  row.element.querySelector(".entry-content").hidden=collapsed;
  const button=row.element.querySelector('[data-action="collapse"]');button.textContent=collapsed?"Expand":"Minimize";button.setAttribute("aria-expanded",String(!collapsed));
}
for(const [id,collapsed] of [["collapseAll",true],["expandAll",false]]) $w(id).addEventListener("click",()=>{for(const row of rows.values())setCollapsed(row,collapsed);scheduleSave();});
function filterEntries() {
  const terms=$w("entrySearch").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let visible=0, selected=0;
  for(const row of rows.values()) {const matches=terms.every((term)=>row.searchText.includes(term));row.element.hidden=!matches;if(matches){visible++;if(row.selected)selected++;}}
  $w("completionSelection").textContent=`${selected} shown ${selected === 1 ? "product" : "products"} selected.`;
  $w("bulkCompletion").querySelectorAll("[data-completion-action]").forEach((button)=>button.disabled=selected===0);
  $w("entrySearchStatus").textContent=`Showing ${visible} of ${rows.size} entries`;
  $w("noEntryMatches").hidden=!rows.size || visible>0;
  $w("selectAll").checked=visible>0 && selected===visible;
  $w("selectAll").indeterminate=selected>0 && selected<visible;
}
$w("entrySearch").addEventListener("input",()=>{filterEntries();scheduleSave();});
function renderPanel(row) {
  const panel = row.element.querySelector(".entry-panel"); panel.replaceChildren();
  row.element.querySelectorAll("[data-tab]").forEach((button) => {button.setAttribute("aria-pressed", String(button.dataset.tab === row.tab));button.setAttribute("aria-expanded",String(button.dataset.tab === row.tab));});
  if (row.tab === "details") {
    panel.append(node("p", "Quantity · automatic SKU", "sub"));
    for (const [key,label] of [["categoryPresetUnlocked","Unlock category presets"],["copyToLocation","Copy repeated fields to Location details"]]) {
      const wrapper = node("label", "", "check"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.dataset.field = key; checkbox.checked = !!row.values[key]; wrapper.append(checkbox,document.createTextNode(label)); panel.append(wrapper);
    }
    const grid = node("div", "", "product-grid");
    for (const def of WORKSPACE_FIELDS.filter((def) => !TOP_FIELDS.includes(def.key) && def.key !== "onlineDescription")) grid.append(fieldControl(def,row.values));
    panel.append(grid);
  } else if (row.tab === "description") {
    const copy = node("button", "Copy strain name + type"); copy.dataset.action = "copy";
    panel.append(copy, node("p", "Paste the reviewed description.", "sub"), fieldControl(FIELD_MAP.onlineDescription,row.values));
    panel.append(node("div", `${row.values.onlineDescription.length}/2500 characters`, "description-count sub"));
  } else if (row.tab === "changes") {
    panel.append(node("p", "Compared with starting values. Blank fields are skipped during autofill.", "sub"));
    const table = node("table", "", "diff-table"); const head = table.createTHead().insertRow();
    for (const label of ["Field","Before","Now","Status"]) head.append(node("th",label));
    const body = table.createTBody();
    const order={changed:0,kept:1,blank:2};
    for (const diff of [...(row.diff || productDiff(row.values,row.baseline))].sort((a,b)=>order[a.state]-order[b.state])) {
      const tr = body.insertRow(); tr.dataset.state = diff.state;
      for (const text of [diff.label,diff.before || "—",diff.after || "—",diff.state === "changed" ? (diff.after ? "Changed" : "Cleared") : diff.state === "kept" ? "Kept" : "Blank"]) tr.append(node("td",text));
    }
    const scroll=node("div","","diff-scroll");scroll.append(table);panel.append(scroll);
  }
}
function updateRow(row) {
  row.diff = productDiff(row.values,row.baseline);
  row.dirty = !row.stored || !sameProduct(row.values,row.stored);
  row.searchText=[row.key,row.values.name,row.values.vendor,row.values.brand,row.values.strain].filter(Boolean).join(" ").toLowerCase();
  row.element.querySelector("[data-title]").textContent = row.values.name || row.key || "Untitled product";
  const missing = WORKSPACE_FIELDS.filter((def) => def.required && !row.values[def.key].trim()).length;
  row.element.querySelector("[data-badge]").textContent = missing ? `${missing} required blank` : row.dirty ? "Unsaved" : "Saved";
  for (const input of row.element.querySelectorAll("[data-field]")) {
    const def = FIELD_MAP[input.dataset.field]; if (!def) continue;
    const diff = row.diff.find((item) => item.key === def.key);
    const hint = input.parentElement.querySelector(".field-state");
    if (hint) { hint.dataset.state = diff.state; hint.textContent = diff.state === "changed" ? (diff.after ? "Changed" : "Cleared · will skip") : diff.state === "kept" ? "Kept" : "Blank · will skip"; }
  }
  const counter = row.element.querySelector(".description-count"); if (counter) counter.textContent = `${row.values.onlineDescription.length}/2500 characters`;
}
const metricValues = ["Products", "Unsaved entries", "Fields changed", "Fields left blank"].map((label) => {
  const el = node("div", "", "metric"), value = node("strong", "0");
  el.append(value, node("span", label)); $w("metrics").append(el); return value;
});
function updateMetrics() {
  let dirty = 0, changed = 0, blank = 0;
  for (const row of rows.values()) {
    if (row.dirty) dirty++;
    for (const diff of row.diff || []) {
      if (diff.state === "changed") changed++;
      else if (diff.state === "blank") blank++;
    }
  }
  [rows.size, dirty, changed, blank].forEach((value, index) => {
    if (metricValues[index].textContent !== String(value)) metricValues[index].textContent = String(value);
  });
  $w("emptyState").hidden = !!rows.size;
  filterEntries();
}
function refreshValues(row) {
  for (const input of row.element.querySelectorAll("[data-field]")) {
    const key = input.dataset.field;
    if (key === "tags") {if(row.tagPicker.value() !== row.values.tags) row.tagPicker.set(row.values.tags);continue;}
    if (input.type === "checkbox") input.checked = !!row.values[key];
    else {
      const value = row.values[key] || "";
      if (input.tagName === "SELECT" && ![...input.options].some((o) => o.value === value)) input.add(new Option(value,value));
      input.value = value;
    }
    if (["regulatoryCategory","externalCategory"].includes(key)) input.disabled = !row.values.categoryPresetUnlocked;
    if (key === "brand") input.setAttribute("list",brandListId(row.values.vendor));
  }
  updateRow(row);
}
function editRow(event) {
  const input = event.target; const key = input.dataset.field;
  if (!key) return;
  const selection = input.tagName === "SELECT" || input.type === "checkbox";
  if ((event.type === "input" && selection) || (event.type === "change" && !selection)) return;
  const row = rows.get(input.closest("[data-row]").dataset.row);
  row.values[key] = input.type === "checkbox" ? input.checked : input.value;
  if (key === "category" || key === "categoryPresetUnlocked") applyTemplatePreset(row.values);
  if (["category","categoryPresetUnlocked","vendor"].includes(key)) refreshValues(row); else updateRow(row);
  if (row.tab === "changes") renderPanel(row);
  updateMetrics(); scheduleSave();
}
$w("entries").addEventListener("input",editRow); $w("entries").addEventListener("change",editRow);
$w("entries").addEventListener("change",(event) => {
  if (event.target.dataset.action === "select") { rows.get(event.target.closest("[data-row]").dataset.row).selected = event.target.checked; updateMetrics(); scheduleSave(); }
});
$w("entries").addEventListener("click",async(event) => {
  const button = event.target.closest("button[data-action]"); if (!button) return;
  const row = rows.get(button.closest("[data-row]").dataset.row);
  if (button.dataset.action === "collapse") {setCollapsed(row,!row.collapsed);scheduleSave();}
  if (button.dataset.action === "tab") { row.tab = row.tab === button.dataset.tab ? "" : button.dataset.tab; renderPanel(row); updateRow(row); scheduleSave(); }
  if (button.dataset.action === "duplicate") { addRow(newProduct(row.values),{baseline:row.values}); updateMetrics(); scheduleSave(); }
  if (button.dataset.action === "reload") {
    try {
      if(row.dirty && !confirm("Reload this saved template and discard its local changes?")) return;
      const latest=(await read("templates") || {})[row.key];
      if(!latest) throw new Error("This template is no longer saved. Remove this entry and add a new one.");
      row.values=productValues(latest);row.baseline=clone(latest);row.stored=clone(latest);renderPanel(row);refreshValues(row);updateMetrics();scheduleSave();setWorkspaceStatus("Reloaded the saved template.");
    }catch(e){setWorkspaceStatus(e.message,true);}
  }
  if (button.dataset.action === "remove") { if (row.dirty && !confirm("Discard this entry's unsaved changes? Saved templates will be kept.")) return; rows.delete(row.id); row.element.remove(); updateMetrics(); scheduleSave(); }
  if (button.dataset.action === "copy") {
    try { await navigator.clipboard.writeText(descriptionPrompt(row.values.name)); setWorkspaceStatus(`Copied ${descriptionPrompt(row.values.name)}.`); }
    catch(e) { try { setWorkspaceStatus(`Copy into ChatGPT: ${descriptionPrompt(row.values.name)}`); } catch(error) { setWorkspaceStatus(error.message,true); } }
  }
});
$w("selectAll").addEventListener("change",() => { for (const row of rows.values()) if(!row.element.hidden) { row.selected = $w("selectAll").checked; row.element.querySelector('[data-action="select"]').checked = row.selected; } updateMetrics(); scheduleSave(); });

function addForBrand(name = "") {
  const vendor = $w("entryVendor").value || shared.vendor || "";
  const brand = $w("entryBrand").value || (vendor === shared.vendor ? shared.brand : "") || "";
  addRow(newProduct(shared,{name,vendor,brand}),{baseline:shared});
}
$w("addEntry").addEventListener("click",() => { addForBrand(); updateMetrics(); scheduleSave(); });
$w("addNames").addEventListener("click",() => {
  const names = $w("quickNames").value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const name of names) addForBrand(name);
  $w("quickNames").value = ""; updateMetrics(); scheduleSave(); setWorkspaceStatus(`Added ${names.length} entries.`);
});
$w("quickNames").addEventListener("input",scheduleSave);
$w("useSource").addEventListener("click",() => { const key = $w("sharedSource").value; shared = key ? productValues(templates[key]) : {}; refreshVendorSelectors(shared.vendor,shared.brand); scheduleSave(); setWorkspaceStatus("Shared settings selected for new entries. Existing entries kept."); });
for (const def of WORKSPACE_FIELDS.filter((def) => def.key !== "name" && def.key !== "onlineDescription")) $w("applyField").add(new Option(def.label,def.key));
for (const [key,label] of [["copyToLocation","Copy to Location details"],["categoryPresetUnlocked","Unlock category presets"]]) $w("applyField").add(new Option(label,key));
function updateApplyChoices() {
  const key = $w("applyField").value; const def = FIELD_MAP[key];
  const options = WORKSPACE_FLAGS.includes(key) ? ["Yes","No"] : def ? choicesFor(def) : [];
  const isTags=key === "tags";
  $w("applyValue").hidden=isTags;$w("applyTagsValue").hidden=!isTags;
  $w("applyValueLabel").htmlFor=isTags ? applyTagPicker.element.querySelector("input").id : "applyValue";
  applyTagPicker.set("");
  $w("applyChoices").replaceChildren(...options.map((value) => new Option(value,value)));
  $w("applyValue").value = ""; $w("applyValue").placeholder = WORKSPACE_FLAGS.includes(key) ? "Yes or No" : "Value for selected entries";
}
$w("applyField").addEventListener("change",updateApplyChoices);
$w("applySelected").addEventListener("click",() => {
  const key = $w("applyField").value; let value = $w("clearValue").checked ? "" : key === "tags" ? applyTagPicker.value() : $w("applyValue").value.trim();
  if (WORKSPACE_FLAGS.includes(key)) {
    if (!/^(yes|no)$/i.test(value)) return setWorkspaceStatus("Enter Yes or No for this setting.",true);
    value = /^yes$/i.test(value);
  } else if (!value && !$w("clearValue").checked) return setWorkspaceStatus("Enter a value or choose Clear this field.",true);
  let count = 0;
  for (const row of rows.values()) if (row.selected && !row.element.hidden) { row.values[key] = value; if(["regulatoryCategory","externalCategory"].includes(key)) row.values.categoryPresetUnlocked=true; applyTemplatePreset(row.values); refreshValues(row); if (row.tab === "changes") renderPanel(row); count++; }
  updateMetrics(); scheduleSave(); setWorkspaceStatus(`Applied to ${count} shown selected entries. Other fields kept.`);
});
$w("rememberCategoryPairs").addEventListener("click",async () => {
  const selected=[...rows.values()].filter((row)=>row.selected && !row.element.hidden).map((row)=>clone(row.values));
  try {
    const count=await rememberCategoryPairings(selected);
    setWorkspaceStatus(`Remembered ${count} category pairings. Matching products will use them automatically; existing entries were kept.`);
  } catch(e) {setWorkspaceStatus(e.message,true);}
});

const savedSelection = new Set();
function updateSavedSelectionCount() {
  $w("savedSelectedCount").textContent=savedSelection.size ? `${savedSelection.size} selected` : "";
}
function renderSavedChoices(refreshSource = true) {
  for (const key of savedSelection) if (!Object.hasOwn(templates,key)) savedSelection.delete(key);
  const query=$w("savedSearch").value.trim().toLowerCase(), fragment=document.createDocumentFragment();
  let count=0;
  for (const key of Object.keys(templates)) {
    if (!key.toLowerCase().includes(query)) continue;
    const label=node("label","","check");label.title=key;
    const input=document.createElement("input");input.type="checkbox";input.value=key;input.checked=savedSelection.has(key);input.setAttribute("aria-label",key);
    label.append(input,node("span",key));fragment.append(label);count++;
  }
  $w("savedChoices").replaceChildren(fragment);
  $w("savedSearchStatus").textContent=count ? `${count} matches` : "No matching templates.";
  updateSavedSelectionCount();
  if (refreshSource) {
    const source=$w("sharedSource").value;
    $w("sharedSource").replaceChildren(new Option("Blank shared settings",""),...Object.keys(templates).map((key)=>new Option(key,key)));
    $w("sharedSource").value=source;
  }
}
$w("savedChoices").addEventListener("change",event=>{
  if (!event.target.matches('input[type="checkbox"]')) return;
  if(event.target.checked) savedSelection.add(event.target.value);else savedSelection.delete(event.target.value);
  updateSavedSelectionCount();
});
$w("toggleSavedCompact").addEventListener("click",()=>{
  const compact=$w("savedChoices").classList.toggle("compact-list");
  $w("toggleSavedCompact").setAttribute("aria-pressed",String(compact));
  $w("toggleSavedCompact").textContent=compact ? "Show full names" : "Condense all templates";
});
$w("savedSearch").addEventListener("input",()=>renderSavedChoices(false));
$w("loadSelected").addEventListener("click",()=>{
  if(!savedSelection.size) return setWorkspaceStatus("Select saved templates to load first.",true);
  loadKeys([...savedSelection],undefined,true);scheduleSave();
  $w("savedTemplatePicker").open=false;
  setWorkspaceStatus(`Loaded selected templates as compact cards. Use Expand on a product to edit its fields.`);
});
$w("loadRecent").addEventListener("click",() => { loadKeys(Array.isArray(recent) ? recent : recent?.keys || [], recent?.shared); scheduleSave(); });

$w("removeAll").addEventListener("click",async () => {
  if (!initialized || saving) return;
  if (!confirm(`Remove all ${rows.size} entries from this bulk workspace, including hidden and unchecked entries? Unsaved edits will be discarded. Saved templates and vendor pairings will be kept.`)) return;
  saving=true;$w("saveProducts").disabled=true;$w("removeAll").disabled=true;
  try {
    clearTimeout(saveTimer);
    rows.clear();$w("entries").replaceChildren();shared={};
    $w("quickNames").value="";$w("entrySearch").value="";$w("savedSearch").value="";
    savedSelection.clear();$w("sharedSource").value="";$w("clearValue").checked=false;
    restoreCompletion({});updateApplyChoices();refreshVendorSelectors("","");renderSavedChoices();
    $w("savedTemplatePicker").open=false;
    updateMetrics();workspaceDirty=true;
    // Retain an empty draft; deleting it would auto-load the last bulk batch on reopen.
    await persistDraft();
    setWorkspaceStatus("Bulk workspace cleared. Saved templates were kept. Add products to start a fresh batch.");
  } catch(e) {setWorkspaceStatus(`Workspace cleared, but its empty draft could not be saved: ${e.message}`,true);}
  finally {saving=false;$w("saveProducts").disabled=false;$w("removeAll").disabled=false;}
});

$w("saveProducts").addEventListener("click",async() => {
  if (saving) return;
  const dirty = [...rows.values()].filter((row) => row.dirty);
  if (!dirty.length) return setWorkspaceStatus("Everything is already saved.");
  saving = true; $w("saveProducts").disabled = true;$w("removeAll").disabled=true;
  try {
    const latest = await read("templates") || {}; const keys = new Set(); const changes = [];
    for (const row of rows.values()) {
      const key = row.key || row.values.name.trim();
      if (!key || !row.values.name.trim()) throw new Error("Every entry needs a product name before saving.");
      if (keys.has(key)) throw new Error(`Duplicate template name: ${key}`); keys.add(key);
      if (!row.dirty) continue;
      if (!row.key && Object.hasOwn(latest,key)) throw new Error(`"${key}" already exists. Load it to edit it, or use another name.`);
      if (row.key && JSON.stringify(latest[key]) !== JSON.stringify(row.stored)) throw new Error(`"${key}" changed in another window. Use Reload on that entry before saving.`);
      const values = productValues(row.values);
      for (const def of WORKSPACE_FIELDS) { values[def.key] = values[def.key].trim(); if (def.maxLength && values[def.key].length > def.maxLength) throw new Error(`${key}: ${def.label} exceeds ${def.maxLength} characters.`); }
      changes.push({row,key,values,submitted:clone(row.values)});
    }
    for (const {key,values} of changes) Object.defineProperty(latest,key,{value:values,enumerable:true,writable:true,configurable:true});
    await chrome.storage.local.set({templates:latest,lastBulkBatch:{keys:changes.map((change) => change.key),shared}});
    templates = latest;
    for (const {row,key,values,submitted} of changes) {
      row.key=key; row.stored=clone(values);
      // Storage is asynchronous: edits made while saving must remain unsaved.
      if (sameProduct(row.values,submitted)) row.values=values;
      row.element.querySelector('[data-action="reload"]').hidden=false; refreshValues(row);
    }
    updateMetrics(); renderSavedChoices(); workspaceDirty=true;await persistDraft(); setWorkspaceStatus(`Saved ${changes.length} templates. Your changes and blank fields are still visible.`);
  } catch(e) { setWorkspaceStatus(e.message,true); } finally { saving=false; $w("saveProducts").disabled=false;$w("removeAll").disabled=false; }
});

function renderDirectoryLists() {
  let container = $w("directoryLists"); if (!container) { container=node("div");container.id="directoryLists";document.body.append(container); }
  const list = (id,values) => { const dl=document.createElement("datalist");dl.id=id;dl.append(...[...new Set(values)].map((value)=>new Option(value,value)));return dl; };
  container.replaceChildren(list("vendorsList",[...directory.map((entry)=>entry.vendor),...(learned.vendor || []),...Object.values(templates).map((template)=>template.vendor).filter(Boolean)].filter(isSelectableVendor)),list("allBrandsList",[...directory.flatMap((entry)=>entry.brands),...(learned.brand || [])]),list("strainsList",[...(learned.strain || []),...Object.values(templates).map((template)=>template.strain).filter(Boolean)]),...directory.map((entry,index)=>list(`vendorBrands-${index}`,entry.brands)));
  // Directory sorting can move vendor indices; keep existing inputs paired correctly.
  for (const row of rows.values()) {
    const input = row.element.querySelector('[data-field="brand"]');
    if (input) input.setAttribute("list",brandListId(row.values.vendor));
  }
  brandPicker.refresh();
}
function refreshVendorSelectors(vendor = $w("entryVendor").value, brand = $w("entryBrand").value) {
  $w("entryVendor").replaceChildren(new Option("Choose vendor",""),...[...new Set([...directory.map((entry)=>entry.vendor),vendor].filter((value)=>value && isSelectableVendor(value)))].map((value)=>new Option(value,value)));
  $w("entryVendor").value=vendor || "";
  const brands=directory.find((entry)=>entry.vendor===vendor)?.brands || [];
  $w("entryBrand").replaceChildren(new Option("Choose brand",""),...[...new Set([...brands,brand].filter(Boolean))].map((value)=>new Option(value,value)));
  $w("entryBrand").value=brand || "";
}
$w("entryVendor").addEventListener("change",()=>refreshVendorSelectors($w("entryVendor").value,""));
function selectVendor(vendor) {
  const entry=directory.find((item)=>item.vendor.toLowerCase()===vendor.toLowerCase());
  activeVendor=entry?.vendor || "";
  $w("vendorName").value=entry?.vendor || ""; brandPicker.set(entry?.brands || []);
  $w("deleteVendor").disabled=!entry || deletingVendor;
  $w("editVendorTemplates").disabled=!entry;
  $w("createBrandBatch").disabled=!entry;
  $w("brandChoices").replaceChildren(...(entry?.brands || []).map((brand)=>{const label=node("label","","brand-choice");const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.value=brand;checkbox.checked=true;label.append(checkbox,document.createTextNode(brand));return label;}));
}
function renderDirectory() {
  directory=directory.filter((entry)=>isSelectableVendor(entry.vendor));
  if(activeVendor && !directory.some((entry)=>entry.vendor.toLowerCase()===activeVendor.toLowerCase())) selectVendor("");
  $w("vendorList").replaceChildren(...directory.map((entry)=>{const button=node("button",entry.vendor,"vendor-item");button.append(node("small",`${entry.brands.length} brand${entry.brands.length===1?"":"s"}`));button.addEventListener("click",()=>selectVendor(entry.vendor));return button;}));
  renderDirectoryLists(); refreshVendorSelectors();
}
$w("newVendor").addEventListener("click",()=>selectVendor(""));
$w("vendorName").addEventListener("change",()=>{
  const vendor=$w("vendorName").value.trim();
  if(directory.some((entry)=>entry.vendor.toLowerCase()===vendor.toLowerCase())) selectVendor(vendor);
  else {activeVendor="";$w("editVendorTemplates").disabled=true;$w("deleteVendor").disabled=true;$w("brandChoices").replaceChildren();$w("createBrandBatch").disabled=true;}
});
$w("saveVendor").addEventListener("click",async()=>{
  try {
    const vendor=$w("vendorName").value.trim();
    if(activeVendor && vendor.toLowerCase()!==activeVendor.toLowerCase()) throw new Error("Choose New vendor to save a different vendor name.");
    directory=mergeVendor((await read("brandDirectory") || []).filter((entry)=>isSelectableVendor(entry.vendor)),vendor,brandPicker.values());
    await chrome.storage.local.set({brandDirectory:directory}); renderDirectory();selectVendor(vendor);setWorkspaceStatus(`Saved ${vendor} and its brands.`);
  } catch(e) {setWorkspaceStatus(e.message,true);}
});
$w("deleteVendor").addEventListener("click",async()=>{
  const vendor=activeVendor;
  if(!vendor || deletingVendor) return;
  if(!confirm(`Delete "${vendor}" and its brand pairings from the directory? Saved product templates will be kept.`)) return;
  deletingVendor=true; $w("deleteVendor").disabled=true;
  try {
    const latest=await read("brandDirectory") || [];
    const next=latest.filter((entry)=>entry.vendor.toLowerCase()!==vendor.toLowerCase());
    await chrome.storage.local.set({brandDirectory:next});
    directory=next;renderDirectory();
    setWorkspaceStatus(`Deleted ${vendor} from the directory. Saved templates were kept.`);
  } catch(e) {setWorkspaceStatus(`Could not delete vendor: ${e.message}`,true);}
  finally {deletingVendor=false;$w("deleteVendor").disabled=!activeVendor;}
});
$w("learnPairs").addEventListener("click",async()=>{
  try {
    let next=(await read("brandDirectory") || []).filter((entry)=>isSelectableVendor(entry.vendor));
    for(const template of Object.values(await read("templates") || {})) if(template.vendor?.trim() && isSelectableVendor(template.vendor) && template.brand?.trim()) {
      const entry=next.find((item)=>item.vendor.toLowerCase()===template.vendor.trim().toLowerCase());
      next=mergeVendor(next,template.vendor,[...(entry?.brands || []),template.brand]);
    }
    directory=next;await chrome.storage.local.set({brandDirectory:directory});renderDirectory();setWorkspaceStatus("Remembered vendor and brand pairs from saved templates.");
  } catch(e) {setWorkspaceStatus(e.message,true);}
});
function currentShared() { return embedded && typeof parent.readTemplateForm === "function" ? parent.readTemplateForm() : shared; }
$w("createBrandBatch").addEventListener("click",async()=>{
  try {
    const brands=[...$w("brandChoices").querySelectorAll("input:checked")].map((input)=>input.value);
    if(!activeVendor || !brands.length) throw new Error("Save or select a vendor and choose at least one brand.");
    await openProductWorkspace({vendor:activeVendor,brands,shared:currentShared()});setWorkspaceStatus("Opened a new bulk window with an entry for each selected brand.");
  } catch(e) {setWorkspaceStatus(e.message,true);}
});
$w("editVendorTemplates").addEventListener("click",async()=>{
  templates=await read("templates") || {};
  const keys=Object.keys(templates).filter((key)=>templates[key].vendor===activeVendor);
  if(embedded && typeof parent.showPopupView === "function") {
    const id=crypto.randomUUID();await chrome.storage.local.set({lastBulkBatch:{id,keys,shared:currentShared()}});parent.showPopupView("bulk",id);
  } else {loadKeys(keys);showView("products");scheduleSave();}
});
$w("emptyDirectory").addEventListener("click",()=>showView("directory"));
$w("openFull").addEventListener("click",async()=>{try{await openProductWorkspace({workspace:serializeWorkspace()});setWorkspaceStatus("Opened this batch in a separate window.");}catch(e){setWorkspaceStatus(e.message,true);}});

async function boot() {
  await categoryPairingsReady;
  [templates,directory,learned,recent]=await Promise.all([read("templates"),read("brandDirectory"),read("options"),read("lastBulkBatch")]);
  templates ||= {};directory=(directory || []).filter((entry)=>isSelectableVendor(entry.vendor));learned ||= {};
  renderDirectory();renderSavedChoices();refreshTagOptions();updateApplyChoices();
  const launchId=params.get("launch"); const launch=launchId ? await read(`workspaceLaunch:${launchId}`) : null;
  const draft=launch?.workspace || await read(draftKey);
  if(draft) {
    shared=draft.shared || {}; restoreCompletion(draft.completion); $w("quickNames").value=draft.quickNames || "";
    $w("entrySearch").value=draft.search || "";
    for(const row of draft.rows || []) addRow(row.values,row);
  } else if(launch?.brands) {
    shared=launch.shared || {};
    for(const brand of launch.brands) addRow(newProduct(shared,{vendor:launch.vendor,brand}),{baseline:shared});
    refreshVendorSelectors(launch.vendor,launch.brands[0]);
  } else if(recent) { shared=recent.shared || {};loadKeys(Array.isArray(recent)?recent:recent.keys || [],recent.shared); }
  if(embedded && !draft && !recent) { try {shared=currentShared();}catch(e){} }
  if(!launch?.brands) refreshVendorSelectors(shared.vendor,shared.brand);
  updateMetrics();showView(params.get("view") || "products");initialized=true;
  if(launchId && launch) { workspaceDirty=true;await persistDraft();await chrome.storage.local.remove(`workspaceLaunch:${launchId}`); }
}
boot().catch((e)=>setWorkspaceStatus(`Workspace could not load: ${e.message}`,true));
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=="local" || !initialized) return;
  if(changes.brandDirectory) {directory=(changes.brandDirectory.newValue || []).filter((entry)=>isSelectableVendor(entry.vendor));renderDirectory();}
  if(changes.templates) {templates=changes.templates.newValue || {};renderSavedChoices();renderDirectoryLists();refreshTagOptions();}
  if(changes.options) {learned=changes.options.newValue || {};renderDirectoryLists();refreshTagOptions();}
  if(changes.lastBulkBatch) recent=changes.lastBulkBatch.newValue;
});
