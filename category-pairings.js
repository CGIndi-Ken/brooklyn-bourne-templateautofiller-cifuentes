// Shared by the editors and content scripts; stored separately from product templates.
function validateCategoryPairings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid category pairings.");
  const pairs = {};
  for (const [category,pair] of Object.entries(value)) {
    const key=categoryKey(category);
    if (!key || !pair || typeof pair.regulatoryCategory !== "string" || typeof pair.externalCategory !== "string") throw new Error("Invalid category pairing.");
    Object.defineProperty(pairs,key,{value:{regulatoryCategory:pair.regulatoryCategory.trim(),externalCategory:pair.externalCategory.trim()},enumerable:true,writable:true,configurable:true});
  }
  return pairs;
}
const categoryPairingsReady = chrome.storage.local.get("categoryPairings").then(({categoryPairings}) => {
  rememberedCategoryPairings=validateCategoryPairings(categoryPairings || {});
});
chrome.storage.onChanged.addListener((changes,area) => {
  if (area !== "local" || !changes.categoryPairings) return;
  rememberedCategoryPairings=validateCategoryPairings(changes.categoryPairings.newValue || {});
  document.dispatchEvent(new Event("categoryPairingsChanged"));
});
async function rememberCategoryPairings(products) {
  await categoryPairingsReady;
  const updates={};
  if (!products.length) throw new Error("Select at least one shown product to remember its category pairings.");
  for (const product of products) {
    const key=categoryKey(product.category);
    if (!key) throw new Error("Every selected product needs a category before remembering pairings.");
    const pair={regulatoryCategory:String(product.regulatoryCategory || "").trim(),externalCategory:String(product.externalCategory || "").trim()};
    if (!pair.regulatoryCategory) throw new Error(`Choose a regulatory category for ${product.category} first.`);
    if (Object.hasOwn(updates,key) && JSON.stringify(updates[key]) !== JSON.stringify(pair)) throw new Error(`Selected products have different pairings for ${product.category}. Select matching pairings and try again.`);
    Object.defineProperty(updates,key,{value:pair,enumerable:true,writable:true,configurable:true});
  }
  const {categoryPairings={}}=await chrome.storage.local.get("categoryPairings");
  const next={...validateCategoryPairings(categoryPairings),...updates};
  await chrome.storage.local.set({categoryPairings:next});
  rememberedCategoryPairings=next;
  return Object.keys(updates).length;
}
