const themeStyle = document.createElement("style");
themeStyle.textContent = AUTOFILL_THEME + AUTOFILL_LAYOUT;
document.head.prepend(themeStyle);
const $ = (id) => document.getElementById(id);
initThemeSelector($("themeSelect"), document.documentElement);
const DEFS = Object.fromEntries(FIELD_DEFS.map((d) => [d.key, d]));
const STORED_DEFS = FIELD_DEFS.filter((d) => !d.fixed && !d.copyOf);
let learned = {};
let sections = []; // { keys, countEl }
let storedControls = [];

async function getTemplates() {
  const { templates } = await chrome.storage.local.get("templates");
  return templates || {};
}
async function getLearned() {
  const { options } = await chrome.storage.local.get("options");
  return options || {};
}

// Lists learned from the real Dutchie page win over the built-in starting lists
const optionsFor = (def) => {
  const l = learned[def.key];
  if (l && l.length && def.options) return [...new Set([...l, ...def.options])];
  return l && l.length ? l : def.options || null;
};

function applyCategoryDefaults(clearUnknown = false) {
  if ($("unlockCategoryPreset")?.checked) return;
  const category = $("f_category")?.value;
  const preset = categoryPresetFor(category);
  if (preset) {
    setValue(DEFS.regulatoryCategory, preset.regulatoryCategory);
    setValue(DEFS.externalCategory, preset.externalCategory);
  } else if (clearUnknown) {
    setValue(DEFS.regulatoryCategory, "");
    setValue(DEFS.externalCategory, "");
  }
}

function setCategoryPresetUnlocked(unlocked) {
  const toggle = $("unlockCategoryPreset");
  if (!toggle) return;
  toggle.checked = !!unlocked;
  ["regulatoryCategory", "externalCategory"].forEach((key) => {
    const field = $(`f_${key}`);
    if (field) field.disabled = !toggle.checked;
  });
}

function makeControl(def) {
  const opts = optionsFor(def);
  const frag = document.createDocumentFragment();
  let el;

  if (def.type === "select" && (opts || def.fixed)) {
    el = document.createElement("select");
    el.appendChild(new Option("(skip)", ""));
    (opts || []).forEach((o) => el.appendChild(new Option(o, o)));
  } else if (def.input === "textarea") {
    el = document.createElement("textarea");
    el.rows = 2;
  } else {
    el = document.createElement("input");
    el.type = def.input === "number" ? "number" : "text";
    if (def.input === "number") el.step = "any";
    el.placeholder = def.hint || (def.type === "text" ? "" : "Exact name from Dutchie");
  }
  el.id = `f_${def.key}`;
  if (def.fixed) {
    el.replaceChildren(new Option(def.fixed, def.fixed));
    el.value = def.fixed;
    el.disabled = true;
    el.title = "Always applied automatically";
  }
  if (def.maxLength) el.maxLength = def.maxLength;
  if (def.key === "onlineDescription") el.rows = 6;

  if (def.type === "autocomplete" && opts && !def.multi && !["vendor", "brand"].includes(def.key)) {
    const dl = document.createElement("datalist");
    dl.id = `dl_${def.key}`;
    opts.forEach((o) => dl.appendChild(new Option(o)));
    el.setAttribute("list", dl.id);
    frag.appendChild(dl);
  }

  if (def.prefix) {
    const wrap = document.createElement("div");
    wrap.className = "money";
    const span = document.createElement("span");
    span.textContent = def.prefix;
    wrap.append(span, el);
    frag.appendChild(wrap);
  } else {
    frag.appendChild(el);
  }
  return frag;
}

function buildForm() {
  const form = $("form");
  form.innerHTML = "";
  sections = [];
  const pairs = {}; // key -> container, so inline fields (THC unit) can join their partner

  FORM_SECTIONS.forEach((sec) => {
    const card = document.createElement("details");
    card.className = "card";
    card.open = !sec.collapsed;

    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.textContent = sec.title;
    const countEl = document.createElement("span");
    countEl.className = "count";
    summary.append(title, countEl);

    const body = document.createElement("div");
    body.className = "fields";

    sec.keys.forEach((key) => {
      const def = DEFS[key];
      if (!def) return;
      const ctl = makeControl(def);
      if (def.inlineWith && pairs[def.inlineWith]) { // e.g. the THC unit sits beside the THC amount, like on the site
        pairs[def.inlineWith].appendChild(ctl);
        return;
      }
      const row = document.createElement("div");
      row.className = "field";
      const label = document.createElement("label");
      label.textContent = def.label;
      label.htmlFor = `f_${def.key}`;
      if (def.required) {
        const star = document.createElement("span");
        star.className = "req";
        star.textContent = " *";
        label.appendChild(star);
      }
      const pair = document.createElement("div");
      pair.className = "pair";
      pair.appendChild(ctl);
      pairs[key] = pair;
      row.append(label, pair);
      if (key === "onlineDescription") {
        const instructions = document.createElement("p");
        instructions.className = "sub";
        instructions.textContent = "1. Enter Name above. 2. Copy the prompt and paste it into ChatGPT. 3. Paste only the description paragraph here, review it, and Save template. Your draft is remembered when you close this popup.";
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Copy strain name + type";
        button.addEventListener("click", copyDescriptionPrompt);
        const prompt = document.createElement("textarea");
        prompt.id = "descriptionPrompt";
        prompt.readOnly = true;
        prompt.hidden = true;
        prompt.rows = 2;
        prompt.setAttribute("aria-label", "Prompt to copy into ChatGPT");
        const feedback = document.createElement("div");
        feedback.id = "descriptionStatus";
        feedback.className = "sub";
        feedback.setAttribute("role", "status");
        const count = document.createElement("div");
        count.id = "descriptionCount";
        count.className = "sub";
        row.prepend(instructions, button, prompt, feedback);
        row.appendChild(count);
      }
      body.appendChild(row);
      if (key === "category") {
        const presetRow = document.createElement("div");
        presetRow.className = "field preset-lock-row";
        const toggleLabel = document.createElement("label");
        toggleLabel.className = "check";
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.id = "unlockCategoryPreset";
        toggleLabel.append(toggle, document.createTextNode("Unlock regulatory and external category presets"));
        const hint = document.createElement("p");
        hint.className = "sub";
        hint.textContent = "These values follow the selected category unless unlocked.";
        presetRow.append(toggleLabel, hint);
        body.appendChild(presetRow);
      }
    });

    card.append(summary, body);
    form.appendChild(card);
    sections.push({ controls: sec.keys.map((key) => $(`f_${key}`)).filter(Boolean), countEl });
  });
  storedControls = STORED_DEFS.map((def) => ({ def, el: $(`f_${def.key}`) }));
  Object.entries(NEW_TEMPLATE_DEFAULTS).forEach(([key,value]) => setValue(DEFS[key],value));
  setCategoryPresetUnlocked(false);
  updateCounts();
}

// "3/6" badge on each section so you can see at a glance what a template fills
function updateCounts() {
  const description = $("f_onlineDescription");
  if (description && $("descriptionCount")) $("descriptionCount").textContent = `${description.value.length}/2500 characters`;
  sections.forEach((s) => {
    const filled = s.controls.filter((el) => el.value.trim()).length;
    s.countEl.textContent = `${filled}/${s.controls.length}`;
  });
}

function setValue(def, value) {
  const el = $(`f_${def.key}`);
  if (!el) return;
  if (el.tagName === "SELECT" && value && ![...el.options].some((o) => o.value === value)) {
    el.appendChild(new Option(value, value)); // keep a saved value even if it isn't in the list
  }
  el.value = value ?? "";
}

function loadSelected(templates) {
  const name = $("templateSelect").value;
  const t = templates[name];
  if (!t) return;
  $("templateName").value = name;
  STORED_DEFS.forEach((d) => setValue(d, t[d.key]));
  $("copyLoc").checked = !!t.copyToLocation;
  setCategoryPresetUnlocked(!!t.categoryPresetUnlocked);
  applyCategoryDefaults();
  updateCounts();
  resetDescriptionPrompt();
  document.dispatchEvent(new Event("templateFormLoaded"));
  saveDraft().catch(() => toast("Couldn't save draft."));
}

function resetDescriptionPrompt() {
  $("descriptionPrompt").hidden = true;
  $("descriptionPrompt").value = "";
  $("descriptionStatus").textContent = "";
}

let draftTimer;
let draftDirty = false;
let lastDraft = "";
let draftWrite = Promise.resolve();
function queueDraftWrite(write) {
  const pending = draftWrite.then(write);
  draftWrite = pending.catch(() => {});
  return pending;
}
function scheduleDraft() {
  draftDirty = true;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(flushDraft, 150);
}
function flushDraft() {
  if (draftDirty) saveDraft().catch(() => toast("Couldn't save draft. Save your template before closing."));
}
function templateDraftState() {
  const values = Object.fromEntries(storedControls.map(({ def, el }) => [def.key, el.value]));
  return { values, name: $("templateName").value, selected: $("templateSelect").value, copyToLocation: $("copyLoc").checked, categoryPresetUnlocked: $("unlockCategoryPreset").checked, bulkNames: $("bulkNames").value };
}
async function saveDraft() {
  clearTimeout(draftTimer);
  draftDirty = false;
  const templateDraft = templateDraftState();
  const serialized = JSON.stringify(templateDraft);
  return queueDraftWrite(async () => {
    if (serialized === lastDraft) return;
    try {
      await chrome.storage.local.set({ templateDraft });
      lastDraft = serialized;
    } catch (e) { draftDirty = true; throw e; }
  });
}
window.addEventListener("pagehide", flushDraft);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushDraft(); });
document.addEventListener("focusout", flushDraft);

async function copyDescriptionPrompt() {
  try {
    const prompt = descriptionPrompt($("f_name").value);
    const output = $("descriptionPrompt");
    output.value = prompt;
    output.hidden = false;
    await saveDraft();
    try {
      await navigator.clipboard.writeText(prompt);
      $("descriptionStatus").textContent = `Copied ${prompt}. Paste into ChatGPT, then return here with the paragraph.`;
    } catch (e) {
      output.focus();
      output.select();
      $("descriptionStatus").textContent = "Prompt ready. Press Ctrl+C to copy it, then paste into ChatGPT.";
    }
  } catch (e) {
    $("descriptionStatus").textContent = e.message;
  }
}

function clearTemplateForm() {
  clearTimeout(draftTimer);
  draftDirty = false;
  STORED_DEFS.forEach((d) => setValue(d, NEW_TEMPLATE_DEFAULTS[d.key] ?? ""));
  $("copyLoc").checked = false;
  setCategoryPresetUnlocked(false);
  $("templateName").value = "";
  $("templateSelect").value = "";
  updateCounts();
  resetDescriptionPrompt();
  $("bulkNames").value = "";
  invalidateBulk();
  document.dispatchEvent(new Event("templateFormLoaded"));
  return queueDraftWrite(async () => {
    await chrome.storage.local.remove("templateDraft");
    lastDraft = "";
  });
}

let toastTimer;
function toast(msg) {
  $("toast").textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").textContent = ""), 2500);
}

async function refresh() {
  const templates = await getTemplates();
  const select = $("templateSelect");
  const selected = select.value;
  select.replaceChildren(new Option("Select a saved template", ""),
    ...Object.keys(templates).map((name) => new Option(name, name)));
  select.value = Object.hasOwn(templates, selected) ? selected : "";
}

$("templateSelect").addEventListener("change", async () => loadSelected(await getTemplates()));
function onFormEdit(event) {
  const selection = event.target.matches('select, input[type="checkbox"]');
  if ((event.type === "input" && selection) || (event.type === "change" && !selection)) return;
  if (event.target.id === "f_category") applyCategoryDefaults(true);
  if (event.target.id === "unlockCategoryPreset") {
    setCategoryPresetUnlocked(event.target.checked);
    applyCategoryDefaults();
  }
  updateCounts();
  invalidateBulk();
  scheduleDraft();
}
$("form").addEventListener("input", onFormEdit);
$("form").addEventListener("change", onFormEdit);
$("templateName").addEventListener("input", scheduleDraft);
$("copyLoc").addEventListener("change", () => { invalidateBulk(); scheduleDraft(); });

$("newBtn").addEventListener("click", () => {
  clearTemplateForm().catch(() => toast("Couldn't clear draft."));
  $("templateName").focus();
});

$("copyBtn").addEventListener("click", () => {
  const name = $("templateName").value.trim();
  if (!name) return toast("Nothing to copy yet.");
  Object.entries(NEW_TEMPLATE_DEFAULTS).forEach(([key,value]) => setValue(DEFS[key],value));
  updateCounts();
  invalidateBulk();
  $("templateName").value = `${name} copy`;
  $("templateName").focus();
  $("templateName").select();
  saveDraft().catch(() => toast("Couldn't save draft."));
  toast("Rename it, then click Save.");
});

function readTemplateForm() {
  const data = {};
  storedControls.forEach(({ def, el }) => {
    data[def.key] = el.value.trim();
  });
  data.categoryPresetUnlocked = $("unlockCategoryPreset").checked;
  applyTemplatePreset(data);
  data.copyToLocation = $("copyLoc").checked;
  if (data.onlineDescription.length > 2500) throw new Error("Description exceeds 2500 characters.");
  return data;
}

$("saveBtn").addEventListener("click", async () => {
  if ($("saveBtn").disabled) return;
  const name = $("templateName").value.trim();
  if (!name) { $("templateName").focus(); return toast("Enter a template name."); }
  let data;
  try { data = readTemplateForm(); } catch (e) { return toast(e.message); }
  const original = JSON.stringify(templateDraftState());
  $("saveBtn").disabled = true;
  try {
    const templates = await getTemplates();
    Object.defineProperty(templates, name, {value:data, enumerable:true, writable:true, configurable:true});
    await chrome.storage.local.set({ templates });
    await refresh();
    // Keep edits made while storage was busy instead of resetting the newer form.
    if (JSON.stringify(templateDraftState()) === original) {
      await clearTemplateForm();
    }
    toast(`Saved "${name}"`);
  } catch (e) { toast(`Save failed: ${e.message}`); }
  finally { $("saveBtn").disabled = false; }
});

function invalidateBulk() {
  $("bulkCreateBtn").disabled = true;
  $("bulkStatus").textContent = "";
}
$("bulkNames").addEventListener("input", () => { invalidateBulk(); scheduleDraft(); });
$("templateSelect").addEventListener("change", invalidateBulk);
$("bulkPreviewBtn").addEventListener("click", async () => {
  invalidateBulk();
  try {
    const result = buildBulkTemplates($("bulkNames").value, readTemplateForm(), await getTemplates());
    $("bulkStatus").textContent = `${result.created.length} to create; ${result.skipped.length} existing or duplicate names skipped.` +
      (result.created.length ? "\n" + result.created.join("\n") : "\nPaste new product names to begin.");
    $("bulkCreateBtn").disabled = !result.created.length;
  } catch (e) { $("bulkStatus").textContent = e.message; }
});
$("bulkCreateBtn").addEventListener("click", async () => {
  $("bulkCreateBtn").disabled = true;
  try {
    const result = buildBulkTemplates($("bulkNames").value, readTemplateForm(), await getTemplates());
    const batchId = crypto.randomUUID();
    if (result.created.length) await chrome.storage.local.set({ templates: result.templates, lastBulkBatch: {id:batchId,keys:result.created,shared:readTemplateForm()} });
    await refresh();
    $("bulkNames").value = "";
    await saveDraft();
    $("bulkStatus").textContent = `Created ${result.created.length} templates; skipped ${result.skipped.length}. Shared settings are kept above.`;
    if (result.created.length) showPopupView("bulk",batchId);
  } catch (e) { $("bulkStatus").textContent = `Bulk creation failed: ${e.message}`; }
});

$("deleteBtn").addEventListener("click", async () => {
  const name = $("templateSelect").value;
  if (!name) return;
  if (!confirm(`Delete the template "${name}"?`)) return;
  const templates = await getTemplates();
  delete templates[name];
  await chrome.storage.local.set({ templates });
  await refresh();
  toast("Deleted.");
});

$("exportBtn").addEventListener("click", async () => {
  try {
    const templates = await getTemplates();
    const {brandDirectory = []} = await chrome.storage.local.get("brandDirectory");
    const exportedTemplates = Object.fromEntries(Object.entries(templates).map(([name,template]) => [name,removeRetiredFields({...template})]));
    const blob = new Blob([JSON.stringify({ format: "brooklyn-bourne-templates", version: 1, templates:exportedTemplates, brandDirectory }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "brooklyn-bourne-templates.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    $("transferStatus").textContent = `Exported ${Object.keys(templates).length} saved templates.`;
  } catch (e) {
    $("transferStatus").textContent = `Export failed: ${e.message}`;
  }
});

$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async () => {
  const file = $("importFile").files[0];
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
    if (!isObject(backup) || backup.format !== "brooklyn-bourne-templates" || backup.version !== 1 || !isObject(backup.templates)) {
      throw new Error("Choose a template export from this extension.");
    }
    // Validate every entry before saving anything; accept only known editable fields.
    const entries = Object.entries(backup.templates).map(([name, template]) => {
      if (!name.trim() || !isObject(template)) throw new Error("Invalid template in file.");
      const clean = {};
      for (const def of STORED_DEFS) {
        const value = template[def.key];
        if (value !== undefined && typeof value !== "string") throw new Error(`Invalid value in "${name}".`);
        if (def.maxLength && value && value.length > def.maxLength) throw new Error(`Description in "${name}" exceeds ${def.maxLength} characters.`);
        clean[def.key] = value || "";
      }
      if (template.copyToLocation !== undefined && typeof template.copyToLocation !== "boolean") throw new Error(`Invalid location setting in "${name}".`);
      if (template.categoryPresetUnlocked !== undefined && typeof template.categoryPresetUnlocked !== "boolean") throw new Error(`Invalid category preset setting in "${name}".`);
      clean.copyToLocation = !!template.copyToLocation;
      clean.categoryPresetUnlocked = template.categoryPresetUnlocked === true;
      applyTemplatePreset(clean);
      return [name.trim(), clean];
    });
    const templates = await getTemplates();
    let brandDirectory;
    if (backup.brandDirectory !== undefined) {
      if (!Array.isArray(backup.brandDirectory)) throw new Error("Invalid brand directory in file.");
      brandDirectory = (await chrome.storage.local.get("brandDirectory")).brandDirectory || [];
      for (const entry of backup.brandDirectory) {
        if (!isObject(entry) || typeof entry.vendor !== "string" || !Array.isArray(entry.brands) || !entry.brands.every((brand) => typeof brand === "string")) throw new Error("Invalid vendor/brand pair in file.");
        const existing = brandDirectory.find((item) => item.vendor.toLowerCase() === entry.vendor.trim().toLowerCase());
        brandDirectory = mergeVendor(brandDirectory,entry.vendor,[...(existing?.brands || []),...entry.brands]);
      }
    }
    for (const [name, template] of entries) {
      let target = name;
      let count = 1;
      while (Object.hasOwn(templates, target)) target = `${name} (imported ${count++})`;
      Object.defineProperty(templates, target, { value: template, enumerable: true, writable: true, configurable: true });
    }
    await chrome.storage.local.set({ templates, ...(brandDirectory ? {brandDirectory} : {}) });
    await refresh();
    $("transferStatus").textContent = `Imported ${entries.length} templates. Existing templates were preserved.`;
  } catch (e) {
    $("transferStatus").textContent = `Import failed: ${e.message}`;
  } finally {
    $("importFile").value = "";
  }
});

(async () => {
  learned = await getLearned();
  buildForm();
  const count = Object.keys(learned).length;
  $("learnedInfo").textContent = count
    ? `${count} dropdown lists learned from Dutchie. To refresh them, use the Lists tab in the on-page panel.`
    : `Dropdown lists appear here after you click "Learn dropdowns" on the Lists tab of the on-page panel. Until then, those fields are plain text boxes.`;
  await refresh();
  const { templateDraft } = await chrome.storage.local.get("templateDraft");
  if (templateDraft && templateDraft.values) {
    STORED_DEFS.forEach((d) => setValue(d, templateDraft.values[d.key]));
    $("templateName").value = templateDraft.name || "";
    $("templateSelect").value = templateDraft.selected || "";
    $("copyLoc").checked = !!templateDraft.copyToLocation;
    setCategoryPresetUnlocked(!!templateDraft.categoryPresetUnlocked);
    applyCategoryDefaults();
    $("bulkNames").value = templateDraft.bulkNames || "";
    updateCounts();
  }
  document.dispatchEvent(new Event("templateEditorReady"));
})();
