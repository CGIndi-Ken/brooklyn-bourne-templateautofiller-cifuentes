// The fill engine: decides what to fill, in what order, on which page tab. No UI in here.

// Only one run (fill or learn) at a time per page
let busy = false;
async function exclusive(task) {
  if (busy) return null;
  busy = true;
  try {
    return await task();
  } finally {
    busy = false;
  }
}

// Dropdowns first (they can trigger defaults), text fields last, SKU button very last
const ORDER = { select: 0, autocomplete: 1, text: 2, click: 3 };
const TAB_ORDER = ["details", "location", "online"];
const tabOf = (def) => def.tab || "details";
const sortKey = (def) => TAB_ORDER.indexOf(tabOf(def)) * 10 + ORDER[def.type];

// What a field should be filled with for this template ("" = skip it)
function valueFor(def, template) {
  if (def.fixed) return def.fixed;
  if (def.copyOf && !def.alwaysCopy && !template.copyToLocation) return "";
  if (def.copyOf === "externalCategory" && !template.categoryPresetUnlocked) {
    const preset = categoryPresetFor(template.category);
    if (preset) return preset.externalCategory || "";
  }
  if (def.copyOf) return template[def.copyOf] ?? "";
  if ((def.key === "regulatoryCategory" || def.key === "externalCategory") && !template.categoryPresetUnlocked) {
    const preset = categoryPresetFor(template.category);
    if (preset) return preset[def.key] || "";
  }
  return template[def.key] ?? "";
}

// Fills `defs` from `template`. Returns { filled, total, problems, empty?, busy? }.
async function runFields(defs, template, opts = {}) {
  const result = await exclusive(async () => {
    if (typeof categoryPairingsReady !== "undefined") await categoryPairingsReady;
    const todo = defs.filter((d) => valueFor(d, template) !== "").sort((a, b) => sortKey(a) - sortKey(b));
    if (!todo.length) return { filled: 0, total: 0, problems: [], empty: true };

    const byTab = {};
    todo.forEach((d) => (byTab[tabOf(d)] = byTab[tabOf(d)] || []).push(d));
    const tabsUsed = TAB_ORDER.filter((tab) => byTab[tab]);

    const problems = [];
    let filled = 0;
    let done = 0;
    for (const tab of tabsUsed) {
      const group = byTab[tab];
      const opened = await ensureTab(tab, group[0]);
      if (!opened) {
        problems.push(`Couldn't open the "${tab}" tab`);
        done += group.length;
        continue;
      }
      for (const def of group) {
        status.set(`Filling ${def.label}... (${done + 1}/${todo.length})`);
        let err;
        try {
          err = await fillField(def, valueFor(def, template), opts);
        } catch (e) {
          err = `${def.label}: ${e.message}`;
        }
        if (err) problems.push(err);
        else filled++;
        done++;
      }
    }
    // Leave the page on the Details tab, where Save and the required fields are
    if (tabsUsed.some((tab) => tab !== "details")) {
      await ensureTab("details", FIELD_DEFS.find((d) => d.key === "name"));
    }
    return { filled, total: todo.length, problems };
  });
  return result || { filled: 0, total: 0, problems: [], busy: true };
}

// Step-by-step mode follows the same Details / Location / Online ordering as a full fill.
function buildSteps(template) {
  const wanted = FIELD_DEFS.filter((d) => valueFor(d, template) !== "").sort((a, b) => sortKey(a) - sortKey(b));
  const steps = wanted
    .filter((d) => d.type !== "text")
    .map((d) => ({ label: d.label, defs: [d], order: sortKey(d) }));

  const texts = (tab) => wanted.filter((d) => d.type === "text" && tabOf(d) === tab);
  if (texts("details").length) steps.push({ label: "Text fields", defs: texts("details"), order: ORDER.text });
  if (texts("location").length) {
    steps.push({ label: "Location: text fields", defs: texts("location"), order: 10 + ORDER.text });
  }
  if (texts("online").length) {
    steps.push({ label: "Online: text fields", defs: texts("online"), order: 20 + ORDER.text });
  }
  return steps.sort((a, b) => a.order - b.order);
}
