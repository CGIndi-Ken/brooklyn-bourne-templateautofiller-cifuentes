// Reusable descriptions are keyed by actual strain name and optional strain type.
// The Dutchie Strain field may contain only a type; it is never used as a name.
const STRAIN_DIRECTORY_TYPES = ["", "S", "H", "I", "S/H", "I/H"];
const normalizeStrainName = name => String(name || "").normalize("NFKC").trim().replace(/\s+/g," ");
function strainDirectoryKey(name, type="") {
  return JSON.stringify([normalizeStrainName(name).toLowerCase(),String(type || "").toUpperCase().replace(/\s/g,"")]);
}
function validateStrainDirectory(value) {
  if(!Array.isArray(value)) throw new Error("Invalid strain directory.");
  const keys=new Set();
  return value.map(entry=>{
    if(!entry || typeof entry.name!=="string" || typeof entry.type!=="string" || typeof entry.description!=="string") throw new Error("Invalid strain directory entry.");
    const name=normalizeStrainName(entry.name),type=entry.type.trim().toUpperCase(),description=entry.description.trim();
    if(!name || !STRAIN_DIRECTORY_TYPES.includes(type) || description.length>2500) throw new Error("Strain entries need a name, valid type, and a description of at most 2500 characters.");
    const key=strainDirectoryKey(name,type);
    if(keys.has(key)) throw new Error("Duplicate strain name and type in directory.");
    keys.add(key);
    return {name,type,description};
  });
}
function isStrainTypeName(name) {
  const normalized=normalizeStrainName(name).toLowerCase().replace(/[-/]/g," ").replace(/\s+/g," ");
  return ["sativa","hybrid","indica","sativa dominant hybrid","indica dominant hybrid","s","h","i","s h","i h"].includes(normalized);
}
function parseStrainList(text) {
  const lines=String(text || "").replace(/^\uFEFF/,"").replace(/\r\n?/g,"\n").split("\n"),entries=[];
  let current=null;
  function finish(){
    if(!current)return;
    const description=current.parts.join("\n").trim();
    if(!description)throw new Error(`Line ${current.line}: add a description for ${current.name}.`);
    if(description.length>2500)throw new Error(`Line ${current.line}: ${current.name} exceeds 2500 description characters.`);
    entries.push(validateStrainDirectory([{name:current.name,type:current.type,description}])[0]);
  }
  lines.forEach((raw,index)=>{
    const line=raw.trim(),header=line.replace(/^(?:[-*•]|\d+[.)])\s+/,"");
    const match=header.match(/^(.+?)\s*\(\s*(S|H|I|[SI]\s*\/?\s*H)\s*\)\s*[-–—]\s*(.*)$/i);
    if(match){
      finish();current={name:match[1].trim(),type:match[2].toUpperCase().replace(/\s/g,"").replace(/^([SI])H$/,"$1/H"),parts:[match[3]],line:index+1};
    }else {
      if(line && (!current || /^.*\([^)]*\)\s*[-–—]/.test(header) || /^.*\(\s*(S|H|I|[SI]\s*\/?\s*H)\s*\)/i.test(header))) throw new Error(`Line ${index+1}: use Strain name (S, H, I, S/H or I/H) - description.`);
      if(current)current.parts.push(raw.trim());
    }
  });
  finish();if(!entries.length)throw new Error("Paste at least one strain with its type and description.");
  const unique=new Map();let duplicates=0;
  for(const entry of entries){
    const key=strainDirectoryKey(entry.name,entry.type),previous=unique.get(key);
    if(previous && previous.description!==entry.description)throw new Error(`The list contains different descriptions for ${entry.name} (${entry.type}). Keep one before adding strains.`);
    if(previous)duplicates++;else unique.set(key,entry);
  }
  return {entries:[...unique.values()],duplicates};
}
function planStrainList(text,directory=[],replaceExisting=false) {
  const parsed=parseStrainList(text),next=validateStrainDirectory(directory),saved=new Map(next.map(entry=>[strainDirectoryKey(entry.name,entry.type),entry]));
  const items=[];let added=0,updated=0,skipped=parsed.duplicates,conflicts=0;
  for(const entry of parsed.entries){
    const key=strainDirectoryKey(entry.name,entry.type),existing=saved.get(key);let action;
    if(!existing){next.push({...entry});saved.set(key,next[next.length-1]);added++;action="Add";}
    else if(existing.description===entry.description){skipped++;action="Already saved";}
    else if(!existing.description || replaceExisting){existing.description=entry.description;updated++;action="Update";}
    else {conflicts++;action="Keep existing · different description";}
    items.push({...entry,action});
  }
  return {directory:next,items,added,updated,skipped,conflicts};
}
function strainIdentity(template={}) {
  const title=String(template.name || "").trim();
  const markers=[...title.matchAll(/\(\s*(S|H|I|[SI]\s*\/?\s*H)\s*\)/gi)].map(match=>match[1].toUpperCase().replace(/\s/g,"").replace(/^([SI])H$/,"$1/H"));
  if(new Set(markers).size>1) return null;
  let identity=null;
  try {
    const parsed=strainFromTitle(title);
    identity={name:normalizeStrainName(parsed.strain),type:parsed.code};
  } catch {
    const parts=title.split("|").map(part=>part.trim());
    if(parts.length>=3 && parts[parts.length-2]) identity={name:normalizeStrainName(parts[parts.length-2]),type:""};
  }
  if(identity && identity.name && !isStrainTypeName(identity.name)) return identity;
  const legacy=typeof template.strain==="string" ? normalizeStrainName(template.strain) : "";
  return legacy && !isStrainTypeName(legacy) ? {name:legacy,type:""} : null;
}
function poolStrainDescriptions(directory, templates={}) {
  const result=validateStrainDirectory(directory),saved=new Map(result.map(entry=>[strainDirectoryKey(entry.name,entry.type),entry])),groups=new Map();
  for(const template of Object.values(templates || {})) {
    if(!template || typeof template.onlineDescription!=="string") continue;
    const description=template.onlineDescription.trim(),identity=strainIdentity(template);
    if(!description || description.length>2500 || !identity) continue;
    const key=strainDirectoryKey(identity.name,identity.type);
    if(!groups.has(key)) groups.set(key,{...identity,descriptions:new Set()});
    groups.get(key).descriptions.add(description);
  }
  let added=0,filled=0,conflicts=0;
  for(const [key,group] of groups) {
    const existing=saved.get(key);
    if(group.descriptions.size>1 || (existing?.description && !group.descriptions.has(existing.description))) {conflicts++;continue;}
    if(existing?.description) continue;
    const description=[...group.descriptions][0];
    if(existing) {existing.description=description;filled++;}
    else {const entry={name:group.name,type:group.type,description};result.push(entry);saved.set(key,entry);added++;}
  }
  return {directory:result,added,filled,conflicts};
}
function findStrainDescription(template, directory) {
  const identity=strainIdentity(template);
  if(!identity) return null;
  const nameKey=strainDirectoryKey(identity.name),candidates=directory.filter(entry=>entry.description.trim() && strainDirectoryKey(entry.name)===nameKey);
  const exact=candidates.find(entry=>entry.type===identity.type);
  if(exact) return exact;
  const compatible=identity.type ? candidates.filter(entry=>!entry.type) : candidates;
  return compatible.length && new Set(compatible.map(entry=>entry.description)).size===1 ? compatible[0] : null;
}
let cachedStrainDirectory=[],strainDescriptionCacheLoaded=false;
function setStrainDirectoryCache(directory) {cachedStrainDirectory=validateStrainDirectory(directory);strainDescriptionCacheLoaded=true;}
function updateDescriptionFromDirectory(template) {
  if(template.inferDescriptionFromDirectory && strainDescriptionCacheLoaded) template.onlineDescription=findStrainDescription(template,cachedStrainDirectory)?.description || "";
}

// Web Locks coordinate separate extension windows. The queue also serializes
// callers in environments without that API, including older browser fixtures.
let strainDirectoryWriteQueue=Promise.resolve(),strainDirectoryInitialization=null;
async function withStrainDirectoryLock(task) {
  if(globalThis.navigator?.locks?.request) return await navigator.locks.request("brooklyn-bourne-strain-directory",task);
  const previous=strainDirectoryWriteQueue;
  let release;
  strainDirectoryWriteQueue=new Promise(resolve=>{release=resolve;});
  await previous;
  try {return await task();} finally {release();}
}
async function readOrCreateStrainDirectory() {
  const stored=(await chrome.storage.local.get("strainDirectory")).strainDirectory;
  if(stored!==undefined) return validateStrainDirectory(stored);
  const templates=(await chrome.storage.local.get("templates")).templates || {};
  const pooled=poolStrainDescriptions([],templates).directory;
  // A second page may have initialized while the template read was pending.
  const latest=(await chrome.storage.local.get("strainDirectory")).strainDirectory;
  if(latest!==undefined) return validateStrainDirectory(latest);
  await chrome.storage.local.set({strainDirectory:pooled});
  return pooled;
}
async function ensureStrainDirectory() {
  if(strainDirectoryInitialization) return await strainDirectoryInitialization;
  strainDirectoryInitialization=withStrainDirectoryLock(readOrCreateStrainDirectory);
  try {return await strainDirectoryInitialization;} finally {strainDirectoryInitialization=null;}
}
async function mutateStrainDirectory(transform) {
  return await withStrainDirectoryLock(async()=>{
    const current=await readOrCreateStrainDirectory();
    const before=JSON.stringify(current);
    const next=validateStrainDirectory(await transform(current));
    if(JSON.stringify(next)!==before) await chrome.storage.local.set({strainDirectory:next});
    return next;
  });
}
