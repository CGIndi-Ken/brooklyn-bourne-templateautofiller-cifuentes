// Searchable multi-select. Suggestions are supplied from local learned/saved lists.
function createBrandPicker(container, input, list, chips, getOptions, onChange) {
  let selected = [], options = [], visible = [], active = -1;
  const selectedHas = (value) => selected.some((brand) => brand.toLowerCase() === value.toLowerCase());
  function refreshOptions() {options=[...new Map([...getOptions(),...selected].map((brand)=>[brand.toLowerCase(),brand])).values()].sort((a,b)=>a.localeCompare(b));}
  function close() { list.hidden = true; input.setAttribute("aria-expanded","false"); input.removeAttribute("aria-activedescendant"); active=-1; }
  function renderChips() {
    chips.replaceChildren(...selected.map((brand) => {
      const chip=document.createElement("button");chip.type="button";chip.className="selected-brand";chip.textContent=`${brand} ×`;chip.setAttribute("aria-label",`Remove ${brand}`);
      chip.addEventListener("click",()=>toggle(brand));return chip;
    }));
    input.placeholder=selected.length ? "Search or add another brand…" : "Search brands…";
  }
  function renderOptions() {
    const query=input.value.trim();
    visible=options.filter((brand)=>brand.toLowerCase().includes(query.toLowerCase())).slice(0,80).map((brand)=>({brand,add:false}));
    if(query && !options.some((brand)=>brand.toLowerCase()===query.toLowerCase())) visible.push({brand:query,add:true});
    active=-1;input.removeAttribute("aria-activedescendant");
    list.replaceChildren(...visible.map(({brand,add},index)=>{
      const option=document.createElement("button");option.type="button";option.id=`brand-option-${index}`;option.className="brand-option";option.setAttribute("role","option");option.setAttribute("aria-selected",String(selectedHas(brand)));
      option.textContent=add ? `+ Add “${brand}”` : `${selectedHas(brand) ? "✓" : "+"}  ${brand}`;
      option.addEventListener("mousedown",event=>event.preventDefault());
      option.addEventListener("click",()=>{toggle(brand);input.focus();});return option;
    }));
    if(!visible.length) {const hint=document.createElement("p");hint.className="sub";hint.textContent="No saved suggestions yet. Type an exact brand name and press Enter to add it.";list.append(hint);}
    list.hidden=false;input.setAttribute("aria-expanded","true");
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
  document.addEventListener("pointerdown",event=>{if(!container.contains(event.target))close();});
  return {
    values:()=>[...selected],
    set(values) {selected=[...new Map(values.map((brand)=>[brand.toLowerCase(),brand])).values()];refreshOptions();input.value="";renderChips();close();},
    refresh() {refreshOptions();if(!list.hidden)renderOptions();},
  };
}
