// Shared field list (used by both the popup and the page script).
// type: "text"         -> plain <input> / <textarea>
//       "autocomplete" -> closed field that opens a searchable list
//       "select"       -> MUI Select shown as a <div> that opens a menu
//       "click"        -> a plain button that gets clicked
// fixed: not stored in templates; applied on every fill
// options: starting dropdown choices for the template designer (replaced by lists learned from Dutchie)
// New products never inherit another product's pricing or weight.
const NEW_TEMPLATE_DEFAULTS = Object.freeze({cost:"", medBasePrice:"", gramsConcentration:""});
function brandFromTitle(name) {
  return typeof name === "string" && name.includes("|") ? name.slice(0,name.indexOf("|")).trim() : "";
}
function updateBrandFromTitle(template) {
  if(template.inferBrandFromTitle) template.brand=brandFromTitle(template.name);
}
const REQUIRED_TEMPLATE_VALUES=Object.freeze({taxCategories:"Cannabis",lowInventoryThreshold:"0",copyToLocation:true});
function applyRequiredDefaults(template) {return Object.assign(template,REQUIRED_TEMPLATE_VALUES);}


// Infer only the stated size at the start of the final formatted title section.
// Pack counts stay separate from mass; dosage breakdowns and multipliers are ambiguous.
function gramsFromTitle(title) {
  if (typeof title !== "string" || !title.includes("|")) return "";
  const section = title.slice(title.lastIndexOf("|") + 1).trim();
  const match = section.match(/^(\d+(?:\.\d+)?|\.\d+)\s*(mg|g)(?=$|[\s,(])/i);
  if (!match) return "";
  let suffix = section.slice(match[0].length).trim();
  if (/\b(?:THC[A-V]?|CBD[A-V]?|CBG[A-V]?|CBN|CBC|mg|g|kg|mcg|ug|oz|lb|ml)\b/i.test(suffix)) return "";
  // Remove recognized strain-type markers before checking category/count labels.
  suffix = suffix.replace(/\(\s*(?:S|H|I|I\s*\/?\s*H|S\s*\/?\s*H)\s*\)/gi, " ").trim();
  const labels = suffix.split(",").map((label) => label.trim()).filter(Boolean);
  const count = /^(?:\d+\s*(?:-?\s*(?:packs?|pk|ct|count|pcs|pieces|units?))?|(?:qty|quantity|count|pack)\s*[:=-]?\s*\d+)$/i;
  const category = /^[a-z]+(?:[\s/-]+[a-z]+)*(?:\s*\([a-z]+(?:\s+[a-z]+)*\))?$/i;
  if (labels.some((label) => {
    if (count.test(label) || category.test(label)) return false;
    // A count and category may share a comma section: "1g 2pk Prerolls (H)".
    const words = label.split(/\s+/);
    return !words.some((_, index) => index > 0 && count.test(words.slice(0, index).join(" ")) && category.test(words.slice(index).join(" ")));
  })) return "";
  // Shift decimal digits rather than dividing floats (e.g. 0.123mg -> 0.000123g).
  const [whole = "", fraction = ""] = match[1].split(".");
  const places = fraction.length + (match[2].toLowerCase() === "mg" ? 3 : 0);
  const digits = (whole + fraction).padStart(places + 1, "0");
  const integer = (places ? digits.slice(0, -places) : digits).replace(/^0+(?=\d)/, "");
  const decimal = places ? digits.slice(-places).replace(/0+$/, "") : "";
  const grams = integer + (decimal ? `.${decimal}` : "");
  return Number.isFinite(Number(grams)) && Number(grams) > 0 ? grams : "";
}

const CATEGORY_PRESETS = {
  "flower": { regulatoryCategory: "Cannabis Flower Products", externalCategory: "Bud/Flower - Each" },
  "ground flower": { regulatoryCategory: "Cannabis Flower Products", externalCategory: "Bud/Flower - Each" },
  "carts": { regulatoryCategory: "Oil for Vaporization", externalCategory: "Vape Cartridge - Each" },
  "disposable vapes": { regulatoryCategory: "Oil for Vaporization", externalCategory: "Vape Cartridge - Each" },
  "edibles": { regulatoryCategory: "Gel-based foods", externalCategory: "Infused Edible - Each" },
  "drinks": { regulatoryCategory: "Beverages", externalCategory: "Infused Edible - Each" },
  "concentrate": { regulatoryCategory: "Resin", externalCategory: "Concentrate/Extract - Each" },
  "preroll packs": { regulatoryCategory: "Cannabis Flower Products", externalCategory: "" },
  "prerolls": { regulatoryCategory: "Cannabis Flower Products", externalCategory: "" },
};
const categoryKey = (category) => String(category || "").trim().toLowerCase().replace(/\s*\(new categor(?:y|ies)\)\s*$/, "").trim().replace(/^concentrates$/,"concentrate");
const canonicalCategoryName = category => categoryKey(category)==="concentrate" ? "Concentrate" : /^carts\s*\(new categories\)$/i.test(String(category || "").trim()) ? "Carts (New Category)" : String(category || "");
const titleRuleKey = text => String(text || "").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const PREROLL_EXTERNALS = {infused:"Infused Pre-Roll - Each",uninfused:"Raw Pre-Roll - Each"};
const isPrerollCategory = category => ["prerolls","preroll packs"].includes(categoryKey(category));
function prerollExternalVariant(external) {
  const key=titleRuleKey(external).replace(/\bpreroll\b/g,"pre roll");
  if(key === "infused pre roll each") return "infused";
  if(key === "raw pre roll each") return "uninfused";
  return "";
}
function titleDesignation(name) {
  if(!gramsFromTitle(name)) return "";
  return name.slice(name.lastIndexOf("|")+1)
    .replace(/^\s*(?:\d+(?:\.\d+)?|\.\d+)\s*(?:mg|g)\b/i,"")
    .replace(/\(\s*(?:S|H|I|I\s*\/?\s*H|S\s*\/?\s*H)\s*\)/gi," ").trim();
}
function prerollVariantFor(product = {}) {
  const explicit=prerollExternalVariant(product.externalCategory);
  if(explicit) return explicit;
  const suffix=titleRuleKey(titleDesignation(product.name));
  if(/\b(?:uninfused|non infused|raw) (?:pre rolls?|prerolls?)\b/.test(suffix)) return "uninfused";
  if(/\binfused (?:pre rolls?|prerolls?)\b/.test(suffix)) return "infused";
  if(/\b(?:pre rolls?|prerolls?)\b/.test(suffix)) return "uninfused";
  return "";
}
const CONCENTRATE_TITLE_PHRASES = ["cured resin","live resin","resin","sugar","honeycomb","badder","budder","diamond","diamonds","hash","rso","concentrate","concentrates"];
const BUILTIN_TITLE_RULES = Object.fromEntries([
  ...CONCENTRATE_TITLE_PHRASES.map(key=>[key,{category:"Concentrate",...CATEGORY_PRESETS.concentrate}]),
  ...["flower","infused flower"].map(key=>[key,{category:"Flower (New Category)",...CATEGORY_PRESETS.flower}]),
  ["ground flower",{category:"Ground flower (New Category)",...CATEGORY_PRESETS["ground flower"]}],
  ...["cart","carts","cartridge","cartridges"].map(key=>[key,{category:"Carts (New Category)",...CATEGORY_PRESETS.carts}]),
  ...["gummy","gummies"].map(key=>[key,{category:"Edibles (New Category)",...CATEGORY_PRESETS.edibles}]),
  ...["chocolate","chocolates"].map(key=>[key,{category:"Edibles (New Category)",regulatoryCategory:"Solid chocolates",externalCategory:"Infused Edible - Each"}]),
  ...["beverage","beverages"].map(key=>[key,{category:"Drinks (New Category)",...CATEGORY_PRESETS.drinks}]),
  ...["aio","all in one","disposable vape","disposable vapes"].map(key=>[key,{category:"Disposable Vapes (New Category)",regulatoryCategory:"Oil for Vaporization",externalCategory:"Vape Cartridge - Each"}]),
]);
for(const roll of ["pre roll","pre rolls","preroll","prerolls"]) {
  for(const prefix of ["","raw ","uninfused ","non infused ","infused "]) {
    for(const pack of [""," pack"," packs"]) {
      const variant=prefix === "infused " ? "infused" : "uninfused";
      BUILTIN_TITLE_RULES[prefix+roll+pack]={category:pack ? "Preroll Packs (New Category)" : "Prerolls (New Category)",regulatoryCategory:"Cannabis Flower Products",externalCategory:PREROLL_EXTERNALS[variant]};
    }
  }
}
let rememberedTitleRules = {};
function categoryFromTitle(name) {
  if(!gramsFromTitle(name)) return null;
  const designation=titleDesignation(name);
  const parts=designation.split(",").map(part=>part.trim()).filter(Boolean);
  const countOnly=/^(?:\d+\s*(?:-?\s*(?:packs?|pk|ct|count|pcs|pieces|units?))?|(?:qty|quantity|count|pack)\s*[:=-]?\s*\d+)$/i;
  // No category wording means Flower. Strain markers and pack counts are not categories.
  if(parts.every(part=>countOnly.test(part))) return {category:"Flower (New Category)",regulatoryCategory:"Cannabis Flower Products",externalCategory:"Bud/Flower - Each"};
  const suffix=titleRuleKey(designation);
  let matches=Object.entries({...BUILTIN_TITLE_RULES,...rememberedTitleRules}).filter(([key])=>(` ${suffix} `).includes(` ${key} `));
  if(!matches.length) return null;
  // Resin can describe a cart or infused pre-roll rather than a loose concentrate.
  const productMatches=matches.filter(([key])=>!CONCENTRATE_TITLE_PHRASES.includes(key) || Object.hasOwn(rememberedTitleRules,key));
  if(productMatches.length)matches=productMatches;
  // Prefer the most specific phrase; conflicting equally specific rules need manual review.
  const longest=Math.max(...matches.map(([key])=>key.length));
  const best=matches.filter(([key])=>key.length===longest);
  if(best.some(([,pair])=>JSON.stringify(pair)!==JSON.stringify(best[0][1]))) return null;
  const [key,pair]=best[0];
  if(!Object.hasOwn(rememberedTitleRules,key) && isPrerollCategory(pair.category)) {
    const count=designation.match(/\b(\d+)\s*-?\s*(?:pk|packs?|ct|count|pcs|pieces|units?)\b/i);
    const category=count && Number(count[1])>1 ? "Preroll Packs (New Category)" : pair.category;
    return {...pair,category,...categoryPresetFor(category,pair)};
  }
  return {...pair,category:canonicalCategoryName(pair.category)};
}
const TITLE_STRAIN_TYPES=Object.freeze({S:"Sativa",H:"Hybrid",I:"Indica","S/H":"Sativa dominant hybrid","I/H":"Indica dominant hybrid"});
function strainTypeFromTitle(name) {
  const markers=[...String(name || "").matchAll(/\(\s*(S|H|I|[SI]\s*\/?\s*H)\s*\)/gi)]
    .map(match=>match[1].toUpperCase().replace(/\s/g,"").replace(/^([SI])H$/,"$1/H"));
  const types=[...new Set(markers.map(key=>TITLE_STRAIN_TYPES[key]))];
  return types.length===1 ? types[0] : "";
}
function updateStrainFromTitle(template, previousName="") {
  const type=strainTypeFromTitle(template.name), previous=strainTypeFromTitle(previousName);
  if(template.inferStrainFromTitle) template.strain=type;
  if(template.inferTagsFromTitle) {
    const tags=String(template.tags || "").split(",").map(tag=>tag.trim()).filter(Boolean)
      .filter(tag=>!previous || previous===type || tag.toLowerCase()!==previous.toLowerCase());
    if(type && !tags.some(tag=>tag.toLowerCase()===type.toLowerCase())) tags.push(type);
    template.tags=tags.join(", ");
  }
}
function updateCategoryFromTitle(template, previousName = "") {
  if(!template.inferCategoryFromTitle) return;
  const pair=categoryFromTitle(template.name);
  if(pair) Object.assign(template,pair);
  else if(categoryFromTitle(previousName)) Object.assign(template,{category:"",regulatoryCategory:"",externalCategory:""});
}
let rememberedCategoryPairings = {};
const categoryPresetFor = (category, product = {}, pairs = rememberedCategoryPairings) => {
  const name = categoryKey(category);
  const preset=Object.hasOwn(pairs,name) ? pairs[name] : (Object.hasOwn(CATEGORY_PRESETS,name) ? CATEGORY_PRESETS[name] : null);
  if(isPrerollCategory(category)) {
    const variant=prerollVariantFor(product);
    if(variant) {
      const pair=preset?.variants?.[variant];
      return pair ? {regulatoryCategory:pair.regulatoryCategory,externalCategory:pair.externalCategory} : {regulatoryCategory:"Cannabis Flower Products",externalCategory:PREROLL_EXTERNALS[variant]};
    }
    // Mixed variant rules must never choose an arbitrary external category.
    if(preset?.variants) return {regulatoryCategory:preset.regulatoryCategory,externalCategory:""};
  }
  return preset ? {regulatoryCategory:preset.regulatoryCategory,externalCategory:preset.externalCategory} : null;
};

const RETIRED_FIELD_KEYS = ["abbreviation", "upc", "alternateName", "lowStockThreshold", "maxPerTransaction", "allergens", "ingredients", "locMaxPerTransaction", "locReplenishment"];
function removeRetiredFields(template) {
  for (const key of RETIRED_FIELD_KEYS) delete template[key];
  return template;
}
function applyTemplatePreset(template) {
  removeRetiredFields(template);
  if(template.category) template.category=canonicalCategoryName(template.category);
  applyRequiredDefaults(template);
  if(typeof updateDescriptionFromDirectory === "function") updateDescriptionFromDirectory(template);
  updateBrandFromTitle(template);
  updateStrainFromTitle(template);
  if(template.inferCategoryFromTitle && categoryFromTitle(template.name)) {
    updateCategoryFromTitle(template);return template;
  }
  const preset = !template.categoryPresetUnlocked && categoryPresetFor(template.category,template);
  if (preset) Object.assign(template, preset);
  return template;
}

const FIELD_DEFS = [
  // ---- Select-style dropdowns ----
  { key: "category",           label: "Category",            type: "select", testid: "product-detail_sr_category", required: true,
    options: ["Flower (New Category)", "Ground flower (New Category)", "Preroll Packs (New Category)", "Prerolls (New Category)",
              "Carts (New Category)", "Disposable Vapes (New Category)", "Edibles (New Category)", "Drinks (New Category)", "Concentrate"] },
  { key: "regulatoryCategory", label: "Regulatory category", type: "select", testid: "product-detail_regulatory_category", required: true,
    options: ["Cannabis Flower Products", "Oil for Vaporization", "Gel-based foods", "Solid chocolates", "Beverages", "Resin"] },
  { key: "type",               label: "Type",                type: "select", testid: "product-detail_sr_type", required: true, fixed: "Quantity" },
  { key: "defaultUnit",        label: "Default unit",        type: "select", testid: "product-detail_sr_default-unit", required: true, fixed: "Quantity" },
  { key: "thcUnit",            label: "THC unit",            type: "select", options: ["mg", "%"], inlineWith: "thc",
    // the unit menu lives inside the THC input's wrapper and has no test id of its own
    find: () => {
      const input = document.querySelector('[data-testid="product-detail_sr_thc-content"]');
      return input && input.parentElement.querySelector('[role="button"][aria-haspopup="listbox"]');
    } },
  { key: "externalCategory",   label: "External category",   type: "select", testid: "product-detail_external_category",
    options: ["Bud/Flower - Each", "Concentrate/Extract (Non Solvent) - Each", "Concentrate/Extract - Each", "Infused Edible - Each",
              "Infused Non-Edible - Each", "Infused Pre-Roll - Each", "Kief - Each", "Raw Pre-Roll - Each", "Tincture - Each",
              "Topical - Each", "Vape Cartridge - Each", "Variety Pack"] },
  { key: "syncToMetrc",        label: "Sync to METRC item",  type: "select", testid: "product-detail_sync_to_metrc_item", fixed: "Yes" },

  // ---- Searchable dropdowns ----
  { key: "tags",          label: "Tags",           type: "autocomplete", testid: "product-detail_catalog-tags", multi: true, hint: "Comma-separated, exact names" },
  { key: "taxCategories", label: "Tax categories", type: "autocomplete", testid: "product-detail_catalog-tax-categories", fixed: "Cannabis" },
  { key: "strain",        label: "Strain",         type: "autocomplete", testid: "product-detail_sr_strain", pick: "scroll" },
  { key: "vendor",        label: "Vendor",         type: "autocomplete", testid: "product-detail_sr_vendor" },
  { key: "brand",         label: "Brand",          type: "autocomplete", testid: "product-detail_sr_brand" },

  // ---- Button clicked on every fill (skipped if the SKU box already has a value) ----
  { key: "generateSku", label: "Generate SKU", type: "click", testid: "create-product-generate-sku-button", fixed: "click" },

  // ---- Location details tab (clicked into automatically) ----
  // fixed values always apply. copyOf always copies a nonblank template value.
  { key: "locPosAvailable",    label: "Location: Available on POS", type: "select", testid: "product-detail-location_sr_pos-available", tab: "location", fixed: "Yes" },
  { key: "locOnlineAvailable", label: "Location: Available online", type: "select", testid: "product-detail-location_sr_online-available", tab: "location", fixed: "Yes" },
  { key: "locExternalCategory", label: "Location: External category", type: "select", testid: "product-detail-location_sr_external-category-new", tab: "location", copyOf: "externalCategory" },
  { key: "locBasePrice",   label: "Location: Base price",   type: "text", testid: "product-detail_med_base_price", tab: "location", copyOf: "medBasePrice" },
  // this Cost box has no test id on the Location tab, only an id
  { key: "locCost",        label: "Location: Cost",        type: "text", find: () => document.getElementById("input-input_Cost:"), tab: "location", copyOf: "cost" },
  { key: "locLowStock",    label: "Location: Low stock threshold", type: "text", testid: "product-detail-location_sr_low-inventory-threshold", tab: "location", copyOf: "lowInventoryThreshold", fixed: "0" },
  { key: "locExternalId",  label: "Location: External ID",  type: "text", testid: "product-detail-location_sr_external-id", tab: "location", copyOf: "externalId" },

  // ---- Online details: always copy Name when present, independent of location copies ----
  { key: "onlineTitle", label: "Online: Online title", type: "text", testid: "product-detail-online_sr_online-title", tab: "online", copyOf: "name", alwaysCopy: true },
  { key: "onlineDescription", label: "Online description", type: "text", testid: "product-detail-online_sr_online-description", tab: "online", input: "textarea", maxLength: 2500 },

  // ---- Text fields ----
  { key: "name",               label: "Name",                  type: "text", testid: "product-detail_sr_product-name", required: true },
  { key: "gramsConcentration", label: "Grams / concentration", type: "text", testid: "product-detail_sr_grams-concentration", input: "number", required: true },
  { key: "thc",                label: "THC content",           type: "text", testid: "product-detail_sr_thc-content", input: "number" },
  { key: "medBasePrice",       label: "Base price",            type: "text", testid: "product-detail_med_base_price", input: "number", prefix: "$" },
  { key: "cost",               label: "Cost",                  type: "text", testid: "product-detail_sr_cost", input: "number", prefix: "$" },
  { key: "lowInventoryThreshold", label: "Low stock threshold", type: "text", testid: "product-detail_sr_low-inventory-threshold", input: "number", fixed: "0" },
  { key: "externalId",         label: "External ID",           type: "text", testid: "product-detail_external_id" },
  { key: "expirationDays",     label: "Expiration days",       type: "text", testid: "product-detail_sr_expiration_days", input: "number" },
];

// Sections of the template designer, in the order the fields appear on the Dutchie form
const FORM_SECTIONS = [
  { title: "Basics", keys: ["name"] },
  { title: "Categories", keys: ["category", "regulatoryCategory", "externalCategory", "tags", "type", "defaultUnit"] },
  { title: "Measurements and pricing", keys: ["gramsConcentration", "thc", "thcUnit", "medBasePrice", "cost"] },
  { title: "Tax, strain, vendor and brand", keys: ["taxCategories", "strain", "vendor", "brand"] },
  { title: "Details and inventory", collapsed: true,
    keys: ["lowInventoryThreshold", "externalId", "expirationDays"] },
  { title: "Online description", keys: ["onlineDescription"] },
];
