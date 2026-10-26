// "Learn" the real dropdown lists from the Dutchie page so the template designer can offer them.

async function saveLearned(key, labels) {
  const { options } = await chrome.storage.local.get("options");
  await chrome.storage.local.set({ options: { ...(options || {}), [key]: labels } });
}

async function learnSelect(def) {
  const el = elFor(def);
  if (!el) return null;
  if (anyOptionsOpen()) await closeMenu();
  openElement(pickTrigger(el));
  if (!(await waitFor(anyOptionsOpen, 2500))) return null;
  const labels = [...document.querySelectorAll('[role="option"]')].map(rawLabelOf).filter(Boolean);
  await closeMenu(); // close without choosing anything
  return [...new Set(labels)];
}

// Scrolls the whole (virtualized) list top to bottom, collecting every name.
async function learnAutocomplete(def) {
  const field = elFor(def);
  if (!field) return null;
  if (getOpenSearch()) await pressEscape();
  openElement(field);
  const search = await waitFor(getOpenSearch, 1500);
  const box = await waitFor(() => getListbox(search), 2000);
  if (!box) {
    await pressEscape();
    return null;
  }

  const labels = new Set();
  const grab = () => optionsIn(box).forEach((o) => { const l = rawLabelOf(o); if (l) labels.add(l); });

  box.scrollTop = 0;
  await sleep(200);
  grab();
  const step = Math.max(40, box.clientHeight - 30); // rows overlap a little so none are missed
  for (let y = step; y <= box.scrollHeight + step; y += step) {
    box.scrollTop = y;
    await sleep(150);
    grab();
  }
  await pressEscape();
  return [...labels];
}

// Returns { done: ["Category (12)", ...], failed: ["Tags", ...] } or null if busy.
async function learnLists(defs) {
  return exclusive(async () => {
    const done = [];
    const failed = [];
    for (const def of defs) {
      status.set(`Learning ${def.label}...` + (done.length ? `\nDone: ${done.join(", ")}` : ""));
      let labels = null;
      try {
        labels = def.type === "select" ? await learnSelect(def) : await learnAutocomplete(def);
      } catch (e) { /* counted as failed */ }
      if (labels && labels.length) {
        await saveLearned(def.key, labels);
        done.push(`${def.label} (${labels.length})`);
      } else {
        failed.push(def.label);
      }
    }
    return { done, failed };
  });
}
