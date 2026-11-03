// Retired duplicate vendor; keep existing template values but omit it from choices.
const isSelectableVendor = (vendor) => String(vendor ?? "").trim().toLowerCase() !== "nys distribution";
const WORKSPACE_FIELDS = FIELD_DEFS.filter((def) => !def.fixed && !def.copyOf);
const WORKSPACE_FLAGS = ["categoryPresetUnlocked", "inferGramsFromTitle", "inferCategoryFromTitle", "inferStrainFromTitle", "inferTagsFromTitle", "inferBrandFromTitle"];

function productValues(template = {}) {
  const values = { ...template };
  for (const def of WORKSPACE_FIELDS) values[def.key] = String(template[def.key] ?? "");
  for (const key of WORKSPACE_FLAGS) values[key] = !!template[key];
  return applyTemplatePreset(values);
}

function newProduct(shared = {}, overrides = {}) {
  const values={ ...shared, ...NEW_TEMPLATE_DEFAULTS, name: "", strain: "", onlineDescription: "", externalId: "", ...overrides };
  values.inferGramsFromTitle=!Object.hasOwn(overrides,"gramsConcentration");
  if (values.inferGramsFromTitle) values.gramsConcentration=gramsFromTitle(values.name);
  values.inferCategoryFromTitle=!Object.hasOwn(overrides,"category");
  values.inferStrainFromTitle=!String(overrides.strain || "").trim();
  values.inferTagsFromTitle=!Object.hasOwn(overrides,"tags");
  const manualBrand=String(overrides.brand ?? (shared.inferBrandFromTitle ? "" : shared.brand) ?? "").trim();
  values.inferBrandFromTitle=overrides.inferBrandFromTitle === undefined ? !manualBrand : overrides.inferBrandFromTitle === true;
  updateStrainFromTitle(values,shared.name);
  return productValues(values);
}

// Individual and bulk edits share the same rules for stopping title inference.
function editProductField(values, key, value) {
  const oldName=values.name;
  values[key]=value;
  const manualFlags={gramsConcentration:"inferGramsFromTitle",strain:"inferStrainFromTitle",tags:"inferTagsFromTitle",brand:"inferBrandFromTitle"};
  if(Object.hasOwn(manualFlags,key)) values[manualFlags[key]]=false;
  if(["category","regulatoryCategory","externalCategory","categoryPresetUnlocked"].includes(key)) values.inferCategoryFromTitle=false;
  if(key === "name") {
    if(values.inferGramsFromTitle) values.gramsConcentration=gramsFromTitle(value);
    updateCategoryFromTitle(values,oldName);
    updateStrainFromTitle(values,oldName);
    updateBrandFromTitle(values);
  }
}

function productDiff(values, baseline = {}) {
  return WORKSPACE_FIELDS.map((def) => {
    const before = String(baseline[def.key] ?? "");
    const after = String(values[def.key] ?? "");
    return { key: def.key, label: def.label, before, after, state: after !== before ? "changed" : after ? "kept" : "blank" };
  });
}

function sameProduct(a, b) {
  return WORKSPACE_FIELDS.every((def) => String(a[def.key] ?? "") === String(b[def.key] ?? "")) &&
    WORKSPACE_FLAGS.every((key) => !!a[key] === !!b[key]);
}

// Compare editable values rather than object serialization: old templates can
// omit blank fields/false flags, and property order has no product meaning.
function mergeProductChanges(base = {}, local = {}, latest = {}) {
  const fields = [...WORKSPACE_FIELDS.map((def) => def.key), ...WORKSPACE_FLAGS];
  const flags = new Set(WORKSPACE_FLAGS);
  const value = (product, key) => flags.has(key) ? !!product[key] : String(product[key] ?? "");
  const changed = (product, keys) => keys.some((key) => value(product, key) !== value(base, key));
  const values = { ...latest }, conflicts = new Set();
  if (base === null) {
    // A legacy draft without a saved snapshot cannot distinguish an untouched
    // blank from an intentional clear. Let the user resolve every difference.
    for (const key of fields) {
      values[key]=value(local,key);
      if (value(local,key) !== value(latest,key)) conflicts.add(key);
    }
    removeRetiredFields(values);
    return {values:applyRequiredDefaults(values),conflicts:[...conflicts]};
  }
  for (const key of fields) {
    const before=value(base,key), ours=value(local,key), saved=value(latest,key);
    values[key] = ours === before ? saved : ours;
    if (ours !== before && saved !== before && ours !== saved) conflicts.add(key);
  }
  function keepGroupTogether(keys) {
    for (const key of keys) {
      values[key]=value(local,key);
      if (value(local,key) !== value(latest,key)) conflicts.add(key);
    }
  }
  const categoryFields=["category","regulatoryCategory","externalCategory","categoryPresetUnlocked","inferCategoryFromTitle"];
  if(local.inferCategoryFromTitle || latest.inferCategoryFromTitle) categoryFields.push("name", "gramsConcentration", "inferGramsFromTitle");
  if (changed(local,categoryFields) && changed(latest,categoryFields) &&
      (value(local,"category") !== value(latest,"category") ||
       value(local,"categoryPresetUnlocked") !== value(latest,"categoryPresetUnlocked") ||
       value(local,"inferCategoryFromTitle") !== value(latest,"inferCategoryFromTitle") ||
       ((local.inferCategoryFromTitle || latest.inferCategoryFromTitle) && value(local,"name") !== value(latest,"name")))) {
    keepGroupTogether(categoryFields);
  }
  const weightFields=["name","gramsConcentration","inferGramsFromTitle"];
  if (changed(local,weightFields) && changed(latest,weightFields) &&
      (((value(local,"inferGramsFromTitle") || value(latest,"inferGramsFromTitle")) && value(local,"name") !== value(latest,"name")) ||
       (value(local,"inferGramsFromTitle") !== value(latest,"inferGramsFromTitle") && value(local,"gramsConcentration") !== value(latest,"gramsConcentration")))) {
    // Automatic grams belong to their name. A manual-mode change also owns
    // that side's grams, even when the user typed the same numeric value.
    keepGroupTogether((local.inferCategoryFromTitle || latest.inferCategoryFromTitle) ? [...new Set([...weightFields,...categoryFields])] : weightFields);
  }
  const strainFields=["name","strain","tags","inferStrainFromTitle","inferTagsFromTitle"];
  if((local.inferStrainFromTitle || latest.inferStrainFromTitle || local.inferTagsFromTitle || latest.inferTagsFromTitle) &&
      changed(local,strainFields) && changed(latest,strainFields) && strainFields.some(key=>value(local,key)!==value(latest,key))) {
    keepGroupTogether([...new Set([...strainFields,...((local.inferCategoryFromTitle || latest.inferCategoryFromTitle) ? categoryFields : []),...((local.inferGramsFromTitle || latest.inferGramsFromTitle) ? weightFields : [])])]);
  }
  const brandFields=["name","brand","inferBrandFromTitle"];
  if((local.inferBrandFromTitle || latest.inferBrandFromTitle) && changed(local,brandFields) && changed(latest,brandFields) && brandFields.some(key=>value(local,key)!==value(latest,key))) {
    keepGroupTogether([...new Set([...brandFields,...((local.inferCategoryFromTitle || latest.inferCategoryFromTitle) ? categoryFields : []),...((local.inferGramsFromTitle || latest.inferGramsFromTitle) ? weightFields : []),...((local.inferStrainFromTitle || latest.inferStrainFromTitle || local.inferTagsFromTitle || latest.inferTagsFromTitle) ? strainFields : [])])]);
  }
  removeRetiredFields(values);
  return {values:applyRequiredDefaults(values),conflicts:[...conflicts]};
}

function mergeVendor(directory, vendor, brands) {
  vendor = vendor.trim();
  if (!isSelectableVendor(vendor)) throw new Error("Choose the correct saved vendor instead of NYS Distribution.");
  const names = [...new Map(brands.map((brand) => brand.trim()).filter(Boolean).map((brand) => [brand.toLowerCase(), brand])).values()];
  if (!vendor || !names.length) throw new Error("Enter a vendor and at least one brand.");
  const next = directory.map((entry) => ({vendor:entry.vendor, brands:[...entry.brands]}));
  const index = next.findIndex((entry) => entry.vendor.toLowerCase() === vendor.toLowerCase());
  const entry = {vendor, brands:names};
  if (index < 0) next.push(entry); else next[index] = entry;
  return next.sort((a,b) => a.vendor.localeCompare(b.vendor));
}

async function openProductWorkspace(launch = {}) {
  const id = crypto.randomUUID();
  await chrome.storage.local.set({[`workspaceLaunch:${id}`]:launch});
  try {
    await chrome.windows.create({url:`${chrome.runtime.getURL("workspace.html")}?launch=${id}`, type:"popup", width:1280, height:900});
  } catch (e) {
    await chrome.storage.local.remove(`workspaceLaunch:${id}`);
    throw e;
  }
}
