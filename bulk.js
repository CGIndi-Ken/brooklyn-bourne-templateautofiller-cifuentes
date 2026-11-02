// Parse spreadsheet TSV without losing quoted tabs, newlines or escaped quotes.
// Validate the entire paste before either editor creates anything.
function parseProductRows(text) {
  text=String(text).replace(/^\uFEFF/, "").replace(/\r\n?/g,"\n");
  const records=[];let cells=[],cell="",quoted=false,closed=false,line=1,start=1;
  const finishCell=()=>{cells.push(cell.trim());cell="";closed=false;};
  const finishRow=()=>{finishCell();if(cells.some(Boolean))records.push({line:start,cells});cells=[];start=line+1;};
  for(let index=0;index<text.length;index++) {
    const char=text[index];
    if(quoted) {
      if(char==='"') {if(text[index+1]==='"'){cell+='"';index++;}else{quoted=false;closed=true;}}
      else {cell+=char;if(char==='\n')line++;}
    } else if(char==='\t') finishCell();
    else if(char==='\n') {finishRow();line++;}
    else if(char==='"' && !cell && !closed) quoted=true;
    else {
      if(closed && char.trim()) throw new Error(`Line ${start}: unexpected text after a quoted cell.`);
      cell+=char;
    }
  }
  if(quoted) throw new Error(`Line ${start}: close the quoted cell before adding products.`);
  if(cell || cells.length || closed) finishRow();
  if(records[0]?.cells.length>=2 && /^name$/i.test(records[0].cells[0]) && /^strain$/i.test(records[0].cells[1]) &&
      (records[0].cells.length===2 || (records[0].cells.length===3 && /^(online )?description$/i.test(records[0].cells[2])))) records.shift();
  return records.map(({line,cells})=>{
    if(cells.length>3 || !cells[0]) throw new Error(`Line ${line}: use Name, optional Strain, optional Description separated by tabs.`);
    const [name,strain="",onlineDescription=""]=cells;
    if(onlineDescription.length>2500) throw new Error(`Line ${line}: description exceeds 2500 characters.`);
    return {name,strain,onlineDescription};
  });
}
function planProductRows(text, existingNames = []) {
  const seen=new Set(existingNames), created=[],skipped=[];
  for(const row of parseProductRows(text)) {
    if(seen.has(row.name)) {skipped.push(row.name);continue;}
    seen.add(row.name);created.push(row);
  }
  return {created,skipped};
}

function buildBulkTemplates(text, shared, existing) {
  const templates = { ...existing };
  const created = [];
  const plan=planProductRows(text,Object.keys(existing));
  const skipped = plan.skipped;
  for (const {name,strain,onlineDescription} of plan.created) {
    // These are product-specific and must not leak from the shared template.
    const data = { ...shared, ...NEW_TEMPLATE_DEFAULTS, name, strain, onlineDescription, externalId: "", gramsConcentration:gramsFromTitle(name), inferGramsFromTitle:true };
    applyTemplatePreset(data);
    delete data.type;
    delete data.defaultUnit;
    Object.defineProperty(templates, name, {value:data, enumerable:true, writable:true, configurable:true});
    created.push(name);
  }
  return { templates, created, skipped };
}
