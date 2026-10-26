// One filler per field type. Each returns "" on success or an error message.
// opts.reuseOpen: if a dropdown is ALREADY open (you opened it), use it instead of clicking;
// a click on an open dropdown's field would close it.

function fillText(def, value) {
  if (def.maxLength && value.length > def.maxLength) return `${def.label}: exceeds ${def.maxLength} characters`;
  const el = elFor(def);
  if (!el) return `${def.label}: field not found`;
  if (el.value === String(value)) return "";
  el.focus();
  setNativeValue(el, value);
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.blur();
  return "";
}

// Searchable list: type to filter, falling back to scrolling the full list.
async function fillAutocomplete(def, value, opts) {
  const field = elFor(def);
  if (!field) return `${def.label}: field not found`;

  let search = getOpenSearch();
  if (search && !opts.reuseOpen) {
    await pressEscape();
    search = null;
  }
  if (!search) {
    openElement(field);
    // Usually a separate search box appears; if not, type into the field itself.
    search = await waitFor(getOpenSearch, 1500);
  }
  let option = null;

  // 1) Type into the search box (skipped for fields marked pick: "scroll")
  if (def.pick !== "scroll") {
    const target = search || field;
    target.focus();
    setNativeValue(target, value);
    await sleep(300);
    option = await waitFor(() => findExactOption(value), 2500);
    if (!option && search) {
      setNativeValue(search, ""); // search didn't find it: clear it to get the full list back
      await sleep(500);
    }
  }

  // 2) Scroll the list and click the matching row
  if (!option) {
    const box = await waitFor(() => getListbox(search), 2000);
    if (box) {
      status.set(`Scrolling to "${value}"...`);
      option = await scrollToOption(box, value);
    }
  }

  if (!option) return `${def.label}: couldn't find "${value}" in the list (list left open)`;
  option.click();
  await sleep(300);

  if (getOpenSearch()) await pressEscape(); // close it if it stayed open (e.g. multi-select)
  return "";
}

// Several values separated by commas (e.g. Tags): pick each one in turn.
async function fillMultiAutocomplete(def, value, opts) {
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const err = await fillAutocomplete(def, parts[i], i === 0 ? opts : { ...opts, reuseOpen: false });
    if (err) return err;
  }
  return "";
}

// MUI Select shown as a <div> that opens a menu of <li role="option"> rows.
async function fillSelect(def, value, opts) {
  const enforceQuantity = def.key === "type" || def.key === "defaultUnit";
  if (enforceQuantity) value = "Quantity";
  for (let attempt = 0; attempt < (enforceQuantity ? 2 : 1); attempt++) {
    const el = elFor(def);
    if (!el) return `${def.label}: field not found`;

    let open = anyOptionsOpen();
    if (open && (!opts.reuseOpen || attempt > 0)) {
      await pressEscape();
      open = false;
    }
    if (!open) openElement(pickTrigger(el));

    const option = await waitFor(() => findExactOption(value), 2500);
    if (!option) return `${def.label}: no option "${value}" found (dropdown may work differently)`;
    option.click();
    await sleep(300);
    if (!enforceQuantity) return "";
    const selected = () => {
      const current = elFor(def);
      if (!current) return false;
      const trigger = pickTrigger(current);
      const text = (trigger.textContent || "").replace(/\u200b/g, "").trim();
      const input = current.querySelector("input");
      return text === "Quantity" || current.value === "Quantity" || input?.value === "Quantity";
    };
    if (await waitFor(selected, 2000)) return "";
  }
  return `${def.label}: couldn't confirm Quantity after two attempts`;
}

// Plain button. The SKU "Generate" button is skipped if the SKU box already has a value.
async function fillClick(def) {
  if (def.key !== "generateSku") {
    const btn = elFor(def);
    if (!btn) return `${def.label}: button not found`;
    btn.click();
    return "";
  }
  // Re-find the box each time: the page may redraw it after the click
  const skuBox = () => document.getElementById("input-input_SKU:");
  const skuValue = () => {
    const box = skuBox();
    return box ? box.value.trim() : "";
  };
  if (skuValue()) return "";
  if (!(await waitFor(skuBox, 5000))) return `${def.label}: SKU field not found on Details`;
  if (anyOptionsOpen()) await closeMenu();

  const readyButton = () => {
    const btn = elFor(def);
    return btn && btn.isConnected !== false && btn.offsetParent !== null &&
      !btn.disabled && btn.getAttribute("aria-disabled") !== "true" ? btn : null;
  };
  for (let attempt = 1; attempt <= 2; attempt++) {
    // A blur or previous dropdown selection may temporarily disable or replace Generate.
    status.set(`Generating SKU${attempt > 1 ? " (retry)" : ""}...`);
    const ready = await waitFor(() => skuValue() || readyButton(), 5000);
    if (skuValue()) return "";
    if (!ready) return `${def.label}: Generate button missing, hidden, or disabled`;
    const btn = readyButton();
    if (btn) btn.click();
    // Slow server responses must finish before switching away from Details.
    if (await waitFor(skuValue, 8000)) {
      await sleep(200);
      if (skuValue()) return "";
    }
  }
  return `${def.label}: SKU still empty after two attempts. Check Dutchie's validation or try Generate manually.`;
}

async function fillField(def, value, opts) {
  switch (def.type) {
    case "click": return fillClick(def);
    case "text": return fillText(def, value);
    case "autocomplete": return def.multi ? fillMultiAutocomplete(def, value, opts) : fillAutocomplete(def, value, opts);
    default: return fillSelect(def, value, opts);
  }
}

// ---------- Page tabs (Details / Location details / Online details) ----------
const TAB_IDS = {
  details: "product-detail_tab_product-details",
  location: "product-detail_tab_location-specific-product-details",
  online: "product-detail_tab_online-product-details",
};

// Makes sure the tab holding `probe` is showing, clicking the tab if needed.
// Uses the tab's own selected state when the page exposes it, otherwise checks that the field is visible.
// Elements are looked up fresh each time because the page may redraw them when tabs change.
async function ensureTab(tab, probe) {
  const tabButton = () => byTestId(TAB_IDS[tab]);
  const visible = () => {
    const el = elFor(probe);
    return !!(el && el.offsetParent !== null);
  };
  const ready = () => {
    const btn = tabButton();
    return btn && btn.hasAttribute("aria-selected") ? btn.getAttribute("aria-selected") === "true" : visible();
  };

  if (ready()) return true;
  const btn = tabButton();
  if (!btn) return false;
  openElement(btn);
  const ok = await waitFor(ready, 3000);
  if (ok) {
    await waitFor(visible, 2000);
    await sleep(300); // let the tab's fields appear
  }
  return !!ok;
}
