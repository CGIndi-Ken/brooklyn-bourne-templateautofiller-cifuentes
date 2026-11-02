// A compact grouped chooser; the hidden select remains the editor's selection model.
function createTemplatePicker(select, root = document) {
  const toggle=root.getElementById('templatePickerToggle'), panel=root.getElementById('templatePickerPanel');
  const search=root.getElementById('templatePickerSearch'), sort=root.getElementById('templatePickerSort');
  const results=root.getElementById('templatePickerResults'), status=root.getElementById('templatePickerStatus');
  toggle.classList.add("template-picker-ui");panel.classList.add("template-picker-ui");
  const expanded=new Set(), compare=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'}).compare;
  let entries=[], expandMatches=true;
  function close(focus=false) {panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus();}
  function option(entry) {
    const button=document.createElement('button');button.type='button';button.className='template-choice';button.title=entry.name;
    button.textContent=entry.shortName;button.setAttribute('aria-label',entry.name);
    if(select.value===entry.name)button.setAttribute('aria-current','true');
    button.addEventListener('click',()=>{select.value=entry.name;select.dispatchEvent(new Event('change',{bubbles:true}));close(true);});
    return button;
  }
  function render() {
    const terms=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean), direction=sort.value==='desc'?-1:1;
    const matches=entries.filter(entry=>terms.every(term=>entry.searchText.includes(term)));
    const groups=new Map();
    for(const entry of matches) {
      const key=entry.group.toLowerCase();
      if(!groups.has(key))groups.set(key,{name:entry.group,entries:[]});
      groups.get(key).entries.push(entry);
    }
    const fragment=document.createDocumentFragment();
    for(const [key,group] of [...groups].sort((a,b)=>direction*compare(a[1].name,b[1].name))) {
      const details=document.createElement('details'), summary=document.createElement('summary'), list=document.createElement('div');
      details.className='template-group';details.open=(terms.length>0 && expandMatches) || expanded.has(key);
      summary.textContent=`${group.name} (${group.entries.length})`;list.className='template-group-choices';
      let paintedOpen;
      const fill=()=>{if(paintedOpen===details.open)return;list.replaceChildren(...(details.open ? group.entries.map(option) : []));paintedOpen=details.open;};
      group.entries.sort((a,b)=>direction*compare(a.shortName,b.shortName));
      details.append(summary,list);fill();
      details.addEventListener('toggle',()=>{
        if(!details.isConnected)return;
        if(!search.value.trim()) {if(details.open)expanded.add(key);else expanded.delete(key);}
        fill();
      });
      fragment.append(details);
    }
    results.replaceChildren(fragment);
    status.textContent=matches.length ? `${matches.length} templates in ${groups.size} groups` : 'No matching templates.';
  }
  function sync() {
    toggle.textContent=select.value || 'Choose a saved template…';toggle.title=select.value;
    if(!panel.hidden)render();
  }
  toggle.addEventListener('click',()=>{
    if(!panel.hidden){close();return;}
    panel.hidden=false;toggle.setAttribute('aria-expanded','true');render();search.focus();
  });
  search.addEventListener('input',()=>{expandMatches=true;render();});sort.addEventListener('change',render);
  root.getElementById('templatePickerCollapse').addEventListener('click',()=>{
    expanded.clear();expandMatches=false;render();
  });
  root.getElementById('templatePickerExpand').addEventListener('click',()=>{
    for(const entry of entries)expanded.add(entry.group.toLowerCase());render();
  });
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close(true);}
    if(event.key==='ArrowDown' && event.target===search){event.preventDefault();results.querySelector('summary')?.focus();}
  });
  document.addEventListener('pointerdown',event=>{if(!event.composedPath().includes(panel) && !event.composedPath().includes(toggle))close();});
  document.addEventListener('focusin',event=>{if(!event.composedPath().includes(panel) && !event.composedPath().includes(toggle))close();});
  select.addEventListener('change',sync);
  return {sync,update(templates){
    entries=Object.entries(templates).map(([name,template])=>{
      const prefix=name.includes('|') ? name.split('|')[0].trim() : '';
      const group=String(template.brand || prefix || 'Other templates').trim() || 'Other templates';
      const shortName=prefix && prefix.toLowerCase()===group.toLowerCase() ? name.slice(name.indexOf('|')+1).trim() : name;
      return {name,group,shortName:shortName || name,searchText:[name,template.name,template.brand,template.vendor,template.category,template.strain].filter(Boolean).join(' ').toLowerCase()};
    });
    sync();
  }};
}
