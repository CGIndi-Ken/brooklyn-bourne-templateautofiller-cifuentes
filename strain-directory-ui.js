// Shared directory controls for the template maker and bulk workspace.
function strainNode(tag,text="",className="") {
  const element=document.createElement(tag);element.textContent=text;if(className)element.className=className;return element;
}
const STRAIN_DIRECTORY_TYPE_LABELS={"":"Unspecified",S:"Sativa",H:"Hybrid",I:"Indica","S/H":"Sativa dominant hybrid","I/H":"Indica dominant hybrid"};
async function loadStrainDirectory() {
  await ensureStrainDirectory();
  return validateStrainDirectory((await chrome.storage.local.get("strainDirectory")).strainDirectory || []);
}
function announceStrainDirectoryChange() {document.dispatchEvent(new Event("strainDirectoryUpdated"));}
function createStrainDescriptionControls(container,getProduct,applyDescription,report) {
  const actions=strainNode("div","","strain-description-actions");
  const use=strainNode("button","Use saved strain description"),remember=strainNode("button","Remember strain description");
  use.type=remember.type="button";actions.append(use,remember);container.append(actions);
  use.addEventListener("click",async()=>{
    use.disabled=true;
    try {
      const before=getProduct(),identity=strainIdentity(before);
      if(!identity) throw new Error("Use a product name with a strain, such as Brand | Runtz | 3.5g (H).");
      const directory=await loadStrainDirectory(),current=getProduct(),now=strainIdentity(current);
      if(!now || strainDirectoryKey(now.name,now.type)!==strainDirectoryKey(identity.name,identity.type) || current.onlineDescription!==before.onlineDescription) throw new Error("The product or description changed. Try again.");
      const match=findStrainDescription(current,directory);
      if(!match) throw new Error("No unambiguous saved description for this strain and type. Add one in Strain directory.");
      applyDescription(match.description);report(`Used saved description for ${match.name}.`);
    }catch(error){report(error.message,true);}finally{use.disabled=false;}
  });
  remember.addEventListener("click",async()=>{
    remember.disabled=true;
    try {
      const product=getProduct(),identity=strainIdentity(product);
      if(!identity) throw new Error("Enter a product title with a strain name first.");
      if(!String(product.onlineDescription || "").trim()) throw new Error("Add a description before remembering this strain.");
      const record=validateStrainDirectory([{...identity,description:product.onlineDescription}])[0];
      await mutateStrainDirectory(latest=>{
        const key=strainDirectoryKey(record.name,record.type),existing=latest.find(item=>strainDirectoryKey(item.name,item.type)===key);
        if(existing?.description && existing.description!==record.description) throw new Error("A different description is already saved. Edit it in Strain directory.");
        return [...latest.filter(item=>strainDirectoryKey(item.name,item.type)!==key),record];
      });
      announceStrainDirectoryChange();report(`Remembered ${record.name} in Strain directory.`);
    }catch(error){report(error.message,true);}finally{remember.disabled=false;}
  });
}

function createStrainDirectoryEditor(root) {
  let records=[],editingKey=null,baseline=null,loading=false,formGeneration=0;
  const heading=strainNode("div","","page-heading");heading.append(strainNode("h1","Strain directory"));
  const intro=strainNode("p","Save reusable strain descriptions. Existing template descriptions are collected the first time this directory is used.","sub");
  const grid=strainNode("div","","strain-directory-grid"),catalog=strainNode("section","","card"),editor=strainNode("section","","card");
  catalog.append(strainNode("div","Saved strains","section-heading"));editor.append(strainNode("div","Strain details","section-heading"));
  const catalogBody=strainNode("div","","fields"),editorBody=strainNode("div","","fields");catalog.append(catalogBody);editor.append(editorBody);grid.append(catalog,editor);
  const searchLabel=strainNode("label","Search strains");searchLabel.htmlFor="strainDirectorySearch";
  const search=strainNode("input");search.id="strainDirectorySearch";search.type="search";search.placeholder="Name or strain type…";
  const count=strainNode("p","","sub"),list=strainNode("div","","strain-directory-list");count.setAttribute("role","status");
  const add=strainNode("button","+ New strain"),collect=strainNode("button","Collect descriptions from saved templates");add.id="newStrain";collect.id="collectStrains";
  catalogBody.append(add,searchLabel,search,count,list,collect);
  const makeField=(labelText,element,id)=>{const label=strainNode("label",labelText);label.htmlFor=id;element.id=id;editorBody.append(label,element);return element;};
  const name=makeField("Strain name",strainNode("input"),"directoryStrainName");name.autocomplete="off";
  const type=makeField("Strain type",strainNode("select"),"directoryStrainType");for(const [code,label] of Object.entries(STRAIN_DIRECTORY_TYPE_LABELS)) type.add(new Option(label,code));
  const description=makeField("Description",strainNode("textarea"),"directoryStrainDescription");description.rows=9;description.maxLength=2500;
  const length=strainNode("p","0/2500 characters","sub");description.setAttribute("aria-describedby","directoryStrainLength");length.id="directoryStrainLength";editorBody.append(length);
  const actions=strainNode("div","","field-actions"),save=strainNode("button","Save strain","gold-button"),remove=strainNode("button","Delete strain");save.id="saveStrain";remove.id="deleteStrain";remove.disabled=true;actions.append(save,remove);editorBody.append(actions);
  const status=strainNode("p","","sub");status.id="strainDirectoryStatus";status.setAttribute("role","status");root.append(heading,intro,grid,status);
  function report(message,error=false){status.textContent=message;status.dataset.error=String(error);}
  function select(record=null) {
    formGeneration++;
    editingKey=record ? strainDirectoryKey(record.name,record.type) : null;baseline=record ? {...record} : null;
    name.value=record?.name || "";type.value=record?.type || "";description.value=record?.description || "";
    length.textContent=`${description.value.length}/2500 characters`;remove.disabled=!record;render();
  }
  function render() {
    const terms=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean),matches=records.filter(record=>terms.every(term=>`${record.name} ${STRAIN_DIRECTORY_TYPE_LABELS[record.type]} ${record.type}`.toLowerCase().includes(term)));
    count.textContent=`${matches.length} of ${records.length} strains`;
    list.replaceChildren(...matches.sort((a,b)=>a.name.localeCompare(b.name)||a.type.localeCompare(b.type)).map(record=>{
      const button=strainNode("button","","strain-directory-item");button.type="button";
      button.append(strainNode("strong",record.name),strainNode("span",`${STRAIN_DIRECTORY_TYPE_LABELS[record.type]} · ${record.description ? "Description saved" : "Description blank"}`,"sub"));
      button.setAttribute("aria-pressed",String(editingKey===strainDirectoryKey(record.name,record.type)));button.addEventListener("click",()=>select(record));return button;
    }));
  }
  async function reload(){records=await loadStrainDirectory();render();}
  search.addEventListener("input",render);add.addEventListener("click",()=>{select();name.focus();});description.addEventListener("input",()=>{length.textContent=`${description.value.length}/2500 characters`;});
  save.addEventListener("click",async()=>{
    if(loading)return;loading=true;save.disabled=true;report("Saving strain…");
    try {
      const submitted={name:name.value,type:type.value,description:description.value},record=validateStrainDirectory([submitted])[0],key=strainDirectoryKey(record.name,record.type),originalKey=editingKey,originalBaseline=baseline,generation=formGeneration;
      records=await mutateStrainDirectory(latest=>{
        const existing=latest.find(item=>strainDirectoryKey(item.name,item.type)===originalKey);
        if(originalKey && JSON.stringify(existing)!==JSON.stringify(originalBaseline)) throw new Error("This entry changed in another window. Select it again before saving.");
        if(latest.some(item=>strainDirectoryKey(item.name,item.type)===key && key!==originalKey)) throw new Error("This strain and type already exist. Select that entry to edit it.");
        return [...latest.filter(item=>strainDirectoryKey(item.name,item.type)!==originalKey),record];
      });
      const sameForm=formGeneration===generation && editingKey===originalKey && name.value===submitted.name && type.value===submitted.type && description.value===submitted.description;
      if(sameForm)select(record);
      else {if(formGeneration===generation && editingKey===originalKey){editingKey=key;baseline={...record};remove.disabled=false;}render();}
      announceStrainDirectoryChange();report(`Saved ${record.name}.${sameForm ? "" : " Your newer edits are still in the form."}`);
    }catch(error){report(error.message,true);}finally{loading=false;save.disabled=false;}
  });
  remove.addEventListener("click",async()=>{
    if(loading || !editingKey || !confirm(`Delete ${baseline.name} from Strain directory? Saved templates are kept.`))return;
    loading=true;remove.disabled=true;report("Deleting strain…");
    try {
      const originalKey=editingKey,originalBaseline=baseline,generation=formGeneration;
      records=await mutateStrainDirectory(latest=>{
        const existing=latest.find(item=>strainDirectoryKey(item.name,item.type)===originalKey);
        if(JSON.stringify(existing)!==JSON.stringify(originalBaseline))throw new Error("This entry changed in another window. Select it again before deleting.");
        return latest.filter(item=>strainDirectoryKey(item.name,item.type)!==originalKey);
      });
      if(formGeneration===generation && editingKey===originalKey)select();else render();announceStrainDirectoryChange();report("Strain deleted. Saved templates were kept.");
    }catch(error){remove.disabled=false;report(error.message,true);}finally{loading=false;}
  });
  collect.addEventListener("click",async()=>{
    if(loading)return;loading=true;collect.disabled=true;report("Collecting descriptions…");
    try {
      const templates=(await chrome.storage.local.get("templates")).templates || {};let result;
      records=await mutateStrainDirectory(latest=>{result=poolStrainDescriptions(latest,templates);return result.directory;});
      render();announceStrainDirectoryChange();report(`Collected ${result.added} new strains; filled ${result.filled} blank descriptions; ${result.conflicts} conflicting descriptions left for review. Saved descriptions were preserved.`);
    }catch(error){report(error.message,true);}finally{loading=false;collect.disabled=false;}
  });
  document.addEventListener("strainDirectoryUpdated",()=>reload().catch(error=>report(error.message,true)));
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local" && changes.strainDirectory)reload().catch(error=>report(error.message,true));});
  reload().catch(error=>report(`Directory could not load: ${error.message}`,true));
}

// Seed once from saved template memory, without delaying editor startup.
ensureStrainDirectory().catch(()=>{});
