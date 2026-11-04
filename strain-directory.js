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
