// One outside-click handler also serves pickers created and removed with product rows.
let openBrandPicker = null, brandPickerSequence = 0;
document.addEventListener("pointerdown", (event) => {
  if (openBrandPicker && !openBrandPicker.container.contains(event.target)) openBrandPicker.close();
});
window.addEventListener("resize", () => openBrandPicker?.place());
document.addEventListener("scroll", (event) => {
  if (openBrandPicker && !openBrandPicker.list.contains(event.target)) openBrandPicker.place();
}, true);

// Searchable multi-select. Suggestions are supplied from local learned/saved lists.
function createBrandPicker(container, input, list, chips, getOptions, onChange, config = {}) {
  const singular = config.singular || "brand";
  const idPrefix = config.idPrefix || `brand-picker-${++brandPickerSequence}`;
  const picker = {container, list, close, place};
  let footer = null;
  const clean = (values) => [...new Map(values.map((value) => String(value ?? "").trim()).filter(Boolean).map((value) => [value.toLowerCase(), value])).values()];
  let selected = [], options = [], visible = [], active = -1;
  const selectedHas = (value) => selected.some((brand) => brand.toLowerCase() === value.toLowerCase());
  function refreshOptions() {options=clean([...(getOptions() || []),...selected]).sort((a,b)=>a.localeCompare(b));}
  function close() { if(openBrandPicker===picker)openBrandPicker=null;list.hidden = true; input.setAttribute("aria-expanded","false"); input.removeAttribute("aria-activedescendant"); active=-1; }
  function place() {
    const anchor = container.getBoundingClientRect(), gap = 5;
    let viewportBottom = window.innerHeight;
    if (footer && getComputedStyle(footer).position === "fixed") {
      const bounds = footer.getBoundingClientRect();
      if (bounds.height && bounds.top < viewportBottom && bounds.bottom > 0) viewportBottom = Math.max(0, bounds.top);
    }
    const above = Math.max(0, anchor.top - gap), below = Math.max(0, viewportBottom - anchor.bottom - gap);
    const desired = Math.min(220, list.scrollHeight + list.offsetHeight - list.clientHeight);
    const upward = below < desired && above > below;
    list.style.top = upward ? "auto" : "100%";
    list.style.bottom = upward ? "100%" : "auto";
    list.style.marginTop = upward ? "0" : `${gap}px`;
    list.style.marginBottom = upward ? `${gap}px` : "0";
    list.style.boxSizing = "border-box";
    list.style.maxHeight = `${Math.min(desired, upward ? above : below)}px`;
  }
  function renderChips() {
    chips.replaceChildren(...selected.map((brand) => {
      const chip=document.createElement("button");chip.type="button";chip.className="selected-brand";chip.textContent=`${brand} ×`;chip.setAttribute("aria-label",`Remove ${brand}`);
      chip.addEventListener("click",()=>toggle(brand));return chip;
    }));
    input.placeholder=selected.length ? (config.selectedPlaceholder || `Search or add another ${singular}…`) : (config.placeholder || `Search ${singular}s…`);
  }
  function renderOptions() {
    if(openBrandPicker && openBrandPicker!==picker)openBrandPicker.close();
    if(openBrandPicker!==picker) footer=document.querySelector(".workspace-footer");
    openBrandPicker=picker;
    const query=input.value.trim(), normalizedQuery=query.toLowerCase();
    visible=options.filter((brand)=>brand.toLowerCase().includes(normalizedQuery)).slice(0,80).map((brand)=>({brand,add:false}));
    if(query && !options.some((brand)=>brand.toLowerCase()===normalizedQuery)) visible.push({brand:query,add:true});
    active=-1;input.removeAttribute("aria-activedescendant");
    list.replaceChildren(...visible.map(({brand,add},index)=>{
      const option=document.createElement("button");option.type="button";option.id=`${idPrefix}-option-${index}`;option.className="brand-option";option.setAttribute("role","option");option.setAttribute("aria-selected",String(selectedHas(brand)));
      option.textContent=add ? `+ Add “${brand}”` : `${selectedHas(brand) ? "✓" : "+"}  ${brand}`;
      option.addEventListener("mousedown",event=>event.preventDefault());
      option.addEventListener("click",()=>{toggle(brand);input.focus();});return option;
    }));
    if(!visible.length) {const hint=document.createElement("p");hint.className="sub";hint.textContent=config.emptyHint || `No saved suggestions yet. Type an exact ${singular} name and press Enter to add it.`;list.append(hint);}
    list.hidden=false;input.setAttribute("aria-expanded","true");place();
  }
  function toggle(brand) {
    if(selectedHas(brand)) selected=selected.filter((item)=>item.toLowerCase()!==brand.toLowerCase());else selected.push(brand.trim());
    refreshOptions();renderChips();renderOptions();onChange([...selected]);
  }
  input.addEventListener("focus",renderOptions);
  input.addEventListener("input",renderOptions);
  input.addEventListener("keydown",event=>{
    if(event.key==="Escape") {event.preventDefault();close();return;}
    if(event.key==="Backspace" && !input.value && selected.length) {event.preventDefault();toggle(selected.at(-1));return;}
    if(event.key==="ArrowDown" || event.key==="ArrowUp") {
      event.preventDefault();if(list.hidden)renderOptions();if(!visible.length)return;
      active=active<0 ? (event.key==="ArrowDown"?0:visible.length-1) : (active+(event.key==="ArrowDown"?1:-1)+visible.length)%visible.length;
      [...list.querySelectorAll('[role="option"]')].forEach((option,index)=>option.classList.toggle("active-option",index===active));
      const option=list.querySelectorAll('[role="option"]')[active];input.setAttribute("aria-activedescendant",option.id);option.scrollIntoView({block:"nearest"});
    }
    if(event.key==="Enter") {
      event.preventDefault();if(list.hidden)renderOptions();
      const choice=visible[active] || visible[0];if(choice)toggle(choice.brand);
    }
  });
  container.addEventListener("focusout",()=>queueMicrotask(()=>{if(!container.contains(document.activeElement))close();}));
  return {
    values:()=>[...selected],
    set(values) {selected=clean(values);refreshOptions();input.value="";renderChips();close();},
    refresh() {refreshOptions();if(!list.hidden)renderOptions();},
  };
}
