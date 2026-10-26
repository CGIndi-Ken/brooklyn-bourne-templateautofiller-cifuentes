// Keep the single-template editor lightweight; load each workspace only when opened.
function showPopupView(view, batchId = "") {
  for (const id of ["template","bulk","directory"]) document.getElementById(`${id}View`).hidden = view !== id;
  document.querySelectorAll("[data-popup-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.popupView === view)));
  if (view !== "template") {
    const frame = document.getElementById(view === "bulk" ? "bulkWorkspace" : "directoryWorkspace");
    if (!frame.getAttribute("src") || batchId) frame.src = `workspace.html?embedded=1&view=${view === "bulk" ? "products" : "directory"}${batchId ? `&batch=${encodeURIComponent(batchId)}` : ""}`;
  }
}
document.querySelector(".popup-view-tabs").addEventListener("click", (event) => { if (event.target.dataset.popupView) showPopupView(event.target.dataset.popupView); });

let popupDirectory = [], directoryHintsReady = false;
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
  vendor.setAttribute("list", list("directoryVendorHints",[...popupDirectory.map((entry) => entry.vendor),...(learned.vendor || [])]));
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
chrome.storage.local.get("brandDirectory").then(({brandDirectory}) => { popupDirectory = brandDirectory || []; updateDirectoryHints(); });
chrome.storage.onChanged.addListener((changes,area) => {
  if (area === "local" && changes.brandDirectory) { popupDirectory = changes.brandDirectory.newValue || []; updateDirectoryHints(); }
});
