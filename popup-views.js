// Keep the single-template editor lightweight; load each workspace only when opened.
function showPopupView(view, batchId = "") {
  for (const id of ["template","bulk","directory","strains"]) document.getElementById(`${id}View`).hidden = view !== id;
  document.querySelectorAll("[data-popup-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.popupView === view)));
  if (view !== "template") {
    const frame = document.getElementById(view === "bulk" ? "bulkWorkspace" : view === "strains" ? "strainsWorkspace" : "directoryWorkspace");
    if (!frame.getAttribute("src") || batchId) frame.src = `workspace.html?embedded=1&view=${view === "bulk" ? "products" : view === "strains" ? "strains" : "directory"}${batchId ? `&batch=${encodeURIComponent(batchId)}` : ""}`;
  }
}
document.querySelector(".popup-view-tabs").addEventListener("click", (event) => { if (event.target.dataset.popupView) showPopupView(event.target.dataset.popupView); });

let popupDirectory = [], popupStrains = [], directoryHintsReady = false;
const directoryHintValues = new Map();
function updateDirectoryHints() {
  const vendor = document.getElementById("f_vendor"), brand = document.getElementById("f_brand");
  if (!vendor || !brand) return;
  const list = (id, values) => {
    let dl = document.getElementById(id);
    if (!dl) { dl = document.createElement("datalist"); dl.id = id; document.body.append(dl); }
    const unique = [...new Set(values)], serialized = JSON.stringify(unique);
    if (directoryHintValues.get(id) !== serialized) {
      dl.replaceChildren(...unique.map((value) => new Option(value,value)));
      directoryHintValues.set(id, serialized);
    }
    return id;
  };
  const strain=document.getElementById("f_strain");
  if(strain) strain.setAttribute("list",list("strainHints",[...(learned.strain || []),...popupStrains]));
  vendor.setAttribute("list", list("directoryVendorHints",[...popupDirectory.map((entry) => entry.vendor),...(learned.vendor || [])].filter(isSelectableVendor)));
  const entry = popupDirectory.find((item) => item.vendor.toLowerCase() === vendor.value.trim().toLowerCase());
  brand.setAttribute("list",list("directoryBrandHints",entry ? entry.brands : learned.brand || []));
}
function installDirectoryHints() {
  if (directoryHintsReady) return;
  directoryHintsReady = true;
  document.getElementById("f_vendor").addEventListener("input",updateDirectoryHints);
  document.addEventListener("templateFormLoaded", updateDirectoryHints);
  updateDirectoryHints();
}
document.addEventListener("templateEditorReady",installDirectoryHints,{once:true});
if (document.getElementById("f_vendor")) installDirectoryHints();
chrome.storage.local.get("brandDirectory").then(({brandDirectory}) => { popupDirectory = (brandDirectory || []).filter((entry)=>isSelectableVendor(entry.vendor)); updateDirectoryHints(); });
chrome.storage.onChanged.addListener((changes,area) => {
  if (area === "local" && changes.brandDirectory) { popupDirectory = (changes.brandDirectory.newValue || []).filter((entry)=>isSelectableVendor(entry.vendor)); updateDirectoryHints(); }
});

function updateSavedStrains(templates) {
  popupStrains=Object.values(templates || {}).map((template)=>template.strain).filter(Boolean);updateDirectoryHints();
}
chrome.storage.local.get("templates").then(({templates})=>updateSavedStrains(templates));
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=="local") return;
  if(changes.templates) updateSavedStrains(changes.templates.newValue);
  if(changes.options) {learned=changes.options.newValue || {};updateDirectoryHints();}
});
