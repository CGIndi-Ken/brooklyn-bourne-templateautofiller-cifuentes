// Retired duplicate vendor; keep existing template values but omit it from choices.
const isSelectableVendor = (vendor) => String(vendor ?? "").trim().toLowerCase() !== "nys distribution";
const WORKSPACE_FIELDS = FIELD_DEFS.filter((def) => !def.fixed && !def.copyOf);
const WORKSPACE_FLAGS = ["copyToLocation", "categoryPresetUnlocked"];

function productValues(template = {}) {
  const values = { ...template };
  for (const def of WORKSPACE_FIELDS) values[def.key] = String(template[def.key] ?? "");
  for (const key of WORKSPACE_FLAGS) values[key] = !!template[key];
  return applyTemplatePreset(values);
}

function newProduct(shared = {}, overrides = {}) {
  return productValues({ ...shared, ...NEW_TEMPLATE_DEFAULTS, name: "", strain: "", onlineDescription: "", externalId: "", ...overrides });
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
