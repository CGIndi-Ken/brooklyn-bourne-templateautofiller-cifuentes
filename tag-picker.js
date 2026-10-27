let tagPickerSequence = 0;

// Templates retain Dutchie's comma-separated tag format; the editor uses chips.
function createTagPicker(initialValue, getOptions, onChange) {
  const id = `tag-picker-${++tagPickerSequence}`;
  const element = document.createElement("div"); element.className = "brand-picker tag-picker";
  const chips = document.createElement("div"); chips.className = "selected-brands"; chips.setAttribute("aria-label", "Selected tags");
  const input = document.createElement("input"); input.type = "text"; input.id = `${id}-input`; input.autocomplete = "off";
  input.setAttribute("role", "combobox"); input.setAttribute("aria-label", "Tags"); input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false"); input.setAttribute("aria-controls", `${id}-options`);
  const list = document.createElement("div"); list.id = `${id}-options`; list.className = "brand-options"; list.hidden = true;
  list.setAttribute("role", "listbox"); list.setAttribute("aria-label", "Tag suggestions"); list.setAttribute("aria-multiselectable", "true");
  element.append(chips, input, list);
  const parse = (value) => String(value ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
  const picker = createBrandPicker(element, input, list, chips,
    () => (getOptions() || []).flatMap(parse),
    (values) => onChange(values.join(", ")),
    {idPrefix:id, singular:"tag"});
  picker.set(parse(initialValue));
  return {
    element,
    value: () => picker.values().join(", "),
    set(value) { picker.set(parse(value)); },
    refresh() { picker.refresh(); },
  };
}
