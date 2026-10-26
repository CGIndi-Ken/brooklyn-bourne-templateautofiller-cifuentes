// Low-level helpers: find, click and type into elements on the Dutchie page.
// Loaded before the other content scripts, which share these globals.

const SELECTORS = {
  // Search box inside an OPEN searchable list (its id is auto-generated, so match on role + placeholder)
  openSearchInput: 'input[role="combobox"][placeholder="Search..."]',
  // Present on every tab of the product form
  productFormMarker: '[data-testid^="product-detail"]',
};

// The panel plugs its status line in here so fill code can report progress.
const status = { set: () => {} };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(fn, timeout = 4000, interval = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = fn();
    if (result) return result;
    await sleep(interval);
  }
  return null;
}

// ---------- Finding elements ----------
const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
const elFor = (def) => (def.find ? def.find() : byTestId(def.testid));

// A MUI Select is a wrapper div; the clickable part is the inner role="button"
const pickTrigger = (el) =>
  el.matches('[role="button"], [role="combobox"]')
    ? el
    : el.querySelector('[role="combobox"], [role="button"]') || el;

// ---------- Typing and clicking ----------
// React ignores plain `el.value = ...`, so go through the native setter and fire an input event.
function setNativeValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// Simulates a real click so React/MUI handlers (which listen for mousedown/pointerdown) fire.
function openElement(el) {
  el.focus && el.focus();
  ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
    const Ctor = type.startsWith("pointer") ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  });
}

async function pressEscape() {
  const target = document.activeElement || document.body;
  ["keydown", "keyup"].forEach((type) =>
    target.dispatchEvent(new KeyboardEvent(type, { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }))
  );
  await sleep(250);
}

// Closes a menu without choosing anything: Escape first, then a click on the backdrop if needed.
async function closeMenu() {
  await pressEscape();
  if (anyOptionsOpen()) {
    const backdrop = document.querySelector(".MuiBackdrop-root");
    if (backdrop) {
      openElement(backdrop);
      await sleep(300);
    }
  }
}

// ---------- Open dropdown lists ----------
const getOpenSearch = () =>
  [...document.querySelectorAll(SELECTORS.openSearchInput)].find(
    (input) => input.getAttribute("aria-expanded") === "true"
  ) || null;

const anyOptionsOpen = () => !!document.querySelector('[role="option"]');

const rawLabelOf = (option) => (option.getAttribute("title") || option.textContent || "").trim();
const labelOf = (option) => rawLabelOf(option).toLowerCase();

// Match the option's exact title/text so "Animal" never picks "Animal House".
function findExactOption(value) {
  const target = value.trim().toLowerCase();
  for (const option of document.querySelectorAll('[role="option"]')) {
    if (labelOf(option) === target) return option;
  }
  return null;
}

// The big lists are virtualized: only ~16 rows exist in the page at once, in index order.
const optionsIn = (box) =>
  [...box.querySelectorAll('[role="option"]')].sort(
    (a, b) => Number(a.dataset.optionIndex) - Number(b.dataset.optionIndex)
  );

function getListbox(search) {
  const id = search && search.getAttribute("aria-controls");
  return (id && document.getElementById(id)) || document.querySelector('[role="listbox"]');
}

// The lists are alphabetical, so binary-search the scroll position: jump to the middle,
// read which names are on screen, and move up or down. Falls back to a top-to-bottom scan.
async function scrollToOption(box, value) {
  const target = value.trim().toLowerCase();
  const find = () => optionsIn(box).find((o) => labelOf(o) === target);
  const settle = () => sleep(160); // give the list time to render the new rows

  box.scrollTop = 0;
  await settle();
  let found = find();
  if (found) return found;

  let lo = 0;
  let hi = Math.max(0, box.scrollHeight - box.clientHeight);
  for (let i = 0; i < 18 && hi - lo > 4; i++) {
    const mid = Math.floor((lo + hi) / 2);
    box.scrollTop = mid;
    await settle();
    found = find();
    if (found) return found;

    const visible = optionsIn(box);
    if (!visible.length) break;
    const first = labelOf(visible[0]);
    const last = labelOf(visible[visible.length - 1]);
    if (target < first) hi = mid;
    else if (target > last) lo = mid;
    else return null; // it would be on screen if it existed, so it isn't in this list
  }

  // Ordering didn't behave as expected: scan from top to bottom
  const step = Math.max(40, box.clientHeight - 80);
  for (let y = 0; y <= box.scrollHeight; y += step) {
    box.scrollTop = y;
    await settle();
    found = find();
    if (found) return found;
  }
  return null;
}
