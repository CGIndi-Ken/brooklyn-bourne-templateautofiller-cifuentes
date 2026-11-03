// Shared by the editors and content scripts; stored separately from product templates.
function validateCategoryPairings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid category pairings.");
  const pairs = {};
  for (const [category,pair] of Object.entries(value)) {
    const key=categoryKey(category);
    if (!key || !pair || typeof pair.regulatoryCategory !== "string" || typeof pair.externalCategory !== "string") throw new Error("Invalid category pairing.");
    const clean={regulatoryCategory:pair.regulatoryCategory.trim(),externalCategory:pair.externalCategory.trim()};
    if(pair.variants !== undefined) {
      if(!isPrerollCategory(key) || !pair.variants || typeof pair.variants!=="object" || Array.isArray(pair.variants)) throw new Error("Invalid pre-roll variants.");
      clean.variants={};
      for(const [variant,values] of Object.entries(pair.variants)) {
        if(!Object.hasOwn(PREROLL_EXTERNALS,variant) || !values || typeof values.regulatoryCategory!=="string" || !values.regulatoryCategory.trim() || typeof values.externalCategory!=="string" || prerollExternalVariant(values.externalCategory)!==variant) throw new Error("Invalid pre-roll variant pairing.");
        clean.variants[variant]={regulatoryCategory:values.regulatoryCategory.trim(),externalCategory:values.externalCategory.trim()};
      }
    }
    Object.defineProperty(pairs,key,{value:clean,enumerable:true,writable:true,configurable:true});
  }
  return pairs;
}
function mergeCategoryPairings(current, incoming) {
  const next=validateCategoryPairings(current),updates=validateCategoryPairings(incoming);
  for(const [key,pair] of Object.entries(updates)) {
    const variants={...(next[key]?.variants || {}),...(pair.variants || {})};
    Object.defineProperty(next,key,{value:{...pair,...(Object.keys(variants).length ? {variants} : {})},enumerable:true,writable:true,configurable:true});
  }
  return next;
}
function validateTitleRules(value) {
  if(!value || typeof value!=="object" || Array.isArray(value)) throw new Error("Invalid title category rules.");
  const rules={};
  for(const [phrase,pair] of Object.entries(value)) {
    const key=titleRuleKey(phrase);
    if(!key || !pair || !["category","regulatoryCategory","externalCategory"].every(field=>typeof pair[field]==="string" && pair[field].trim())) throw new Error("Every title rule needs a phrase and all three categories.");
    Object.defineProperty(rules,key,{value:Object.fromEntries(["category","regulatoryCategory","externalCategory"].map(field=>[field,pair[field].trim()])),enumerable:true,configurable:true,writable:true});
  }
  return rules;
}
const categoryPairingsReady = Promise.all([chrome.storage.local.get("categoryPairings"),chrome.storage.local.get("titleCategoryRules")]).then(([{categoryPairings},{titleCategoryRules}]) => {
  rememberedCategoryPairings=validateCategoryPairings(categoryPairings || {});
  rememberedTitleRules=validateTitleRules(titleCategoryRules || {});
});
chrome.storage.onChanged.addListener((changes,area) => {
  if(area !== "local") return;
  if(changes.titleCategoryRules) {
    rememberedTitleRules=validateTitleRules(changes.titleCategoryRules.newValue || {});
    document.dispatchEvent(new Event("titleCategoryRulesChanged"));
  }
  if (!changes.categoryPairings) return;
  rememberedCategoryPairings=validateCategoryPairings(changes.categoryPairings.newValue || {});
  document.dispatchEvent(new Event("categoryPairingsChanged"));
});
function createTitleRuleEditor(container, getProducts, report) {
  const help=document.createElement("details");help.className="help";
  const summary=document.createElement("summary");summary.textContent="Remember title category rules";
  const hint=document.createElement("p");hint.textContent="Choose all three categories, enter a phrase from after the title's weight, then remember it. Examples: AIO or infused pre-roll. Applies to future automatic matches; existing edits stay as they are.";
  const phrase=document.createElement("input");phrase.placeholder="Title phrase, e.g. infused pre-roll";phrase.setAttribute("aria-label","Title category phrase");
  const save=document.createElement("button");save.type="button";save.textContent="Remember title pairing";
  const list=document.createElement("select");list.setAttribute("aria-label","Remembered title category rules");
  const remove=document.createElement("button");remove.type="button";remove.textContent="Remove custom rule";
  const refresh=()=>{list.replaceChildren(new Option("Custom title rules",""),...Object.entries(rememberedTitleRules).map(([key,pair])=>new Option(`${key} → ${pair.category}`,key)));remove.disabled=!list.value;};
  list.addEventListener("change",()=>{remove.disabled=!list.value;});
  save.addEventListener("click",async()=>{
    try {
      const key=titleRuleKey(phrase.value),products=getProducts();
      if(!key || !products.length) throw new Error("Enter a title phrase and select a product with all three categories.");
      const pair=validateTitleRules({[key]:products[0]})[key];
      if(products.some(product=>["category","regulatoryCategory","externalCategory"].some(field=>String(product[field] || "").trim()!==pair[field]))) throw new Error("Select products with the same three categories to remember this phrase.");
      const latest=validateTitleRules((await chrome.storage.local.get("titleCategoryRules")).titleCategoryRules || {});
      const next={...latest,[key]:pair};await chrome.storage.local.set({titleCategoryRules:next});rememberedTitleRules=next;refresh();report(`Remembered title phrase "${key}".`);
    }catch(e){report(e.message,true);}
  });
  remove.addEventListener("click",async()=>{
    try {const key=list.value;if(!key)return;const latest=validateTitleRules((await chrome.storage.local.get("titleCategoryRules")).titleCategoryRules || {});delete latest[key];await chrome.storage.local.set({titleCategoryRules:latest});rememberedTitleRules=latest;refresh();report("Removed custom rule. Built-in defaults still apply.");}catch(e){report(e.message,true);}
  });
  help.append(summary,hint,phrase,save,list,remove);container.append(help);refresh();document.addEventListener("titleCategoryRulesChanged",refresh);
}
async function rememberCategoryPairings(products) {
  await categoryPairingsReady;
  const groups=new Map();
  if (!products.length) throw new Error("Select at least one shown product to remember its category pairings.");
  for (const product of products) {
    const key=categoryKey(product.category);
    if (!key) throw new Error("Every selected product needs a category before remembering pairings.");
    const pair={regulatoryCategory:String(product.regulatoryCategory || "").trim(),externalCategory:String(product.externalCategory || "").trim()};
    if (!pair.regulatoryCategory) throw new Error(`Choose a regulatory category for ${product.category} first.`);
    const variant=isPrerollCategory(key) ? prerollExternalVariant(pair.externalCategory) : "";
    if(!groups.has(key)) groups.set(key,new Map());
    const group=groups.get(key),slot=variant || "base";
    if(group.has(slot) && JSON.stringify(group.get(slot)) !== JSON.stringify(pair)) throw new Error(`Selected products have different pairings for ${product.category}${variant ? ` (${variant})` : ""}. Select matching pairings and try again.`);
    group.set(slot,pair);
  }
  const {categoryPairings={}}=await chrome.storage.local.get("categoryPairings");
  const current=validateCategoryPairings(categoryPairings),updates={};let count=0;
  for(const [key,group] of groups) {
    const base=group.get("base") || current[key] || CATEGORY_PRESETS[key];
    const pair={regulatoryCategory:base.regulatoryCategory,externalCategory:base.externalCategory};
    const variants=Object.fromEntries([...group].filter(([slot])=>slot!=="base"));
    if(Object.keys(variants).length) pair.variants=variants;
    Object.defineProperty(updates,key,{value:pair,enumerable:true});count+=group.size;
  }
  const next=mergeCategoryPairings(current,updates);
  await chrome.storage.local.set({categoryPairings:next});
  rememberedCategoryPairings=next;
  return count;
}
