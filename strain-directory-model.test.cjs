const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(storage={}) {
  let writes=0;
  const context=vm.createContext({chrome:{storage:{local:{get:async key=>({[key]:storage[key]}),set:async data=>{writes++;Object.assign(storage,plain(data));}}}}});
  for(const file of ['description.js','strain-directory.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
  return {context,storage,writes:()=>writes};
}
async function main() {
 const {context:c}=fixture();
 assert.deepEqual(plain(c.strainIdentity({name:'Brand | Runtz | 3.5g (H)',strain:'Hybrid'})),{name:'Runtz',type:'H'});
 assert.deepEqual(plain(c.strainIdentity({name:'Brand | Runtz | 3.5g'})),{name:'Runtz',type:''});
 assert.deepEqual(plain(c.strainIdentity({name:'Runtz (I/H)'})),{name:'Runtz',type:'I/H'});
 assert.equal(c.strainIdentity({name:'Legacy product',strain:'Sativa-dominant hybrid'}),null);
 assert.equal(c.strainIdentity({name:'Brand | Hybrid | 1g (H)',strain:'Hybrid'}),null);
 assert.deepEqual(plain(c.strainIdentity({name:'Legacy product',strain:'Blue Dream'})),{name:'Blue Dream',type:''});
 assert.equal(c.strainIdentity({name:'Brand | Runtz | 1g (S) (I)',strain:'Runtz'}),null,'Conflicting markers cannot fall back to a guessed directory identity');
 assert.deepEqual(plain(c.strainIdentity({name:'Brand | Runtz | 1g (S/H) (SH)'})),{name:'Runtz',type:'S/H'},'Equivalent markers remain compatible');
 assert.equal(c.poolStrainDescriptions([],{Ambiguous:{name:'Brand | Runtz | 1g (S) (I)',onlineDescription:'Do not pool.'}}).added,0);
 const entry={name:'Runtz',type:'H',description:'Sweet citrus aroma.'};
 assert.equal(c.strainDirectoryKey('  RUNTZ  ','H'),c.strainDirectoryKey('Runtz','H'));
 assert.throws(()=>c.validateStrainDirectory({}),/Invalid/);
 for(const bad of [{...entry,name:''},{...entry,type:'Hybrid'},{...entry,description:'x'.repeat(2501)}])assert.throws(()=>c.validateStrainDirectory([bad]));
 assert.throws(()=>c.validateStrainDirectory([entry,{...entry,name:' RUNTZ ' }]),/Duplicate/);
 const templates={A:{name:'Brand | Runtz | 1g (H)',onlineDescription:entry.description},B:{name:'Other | Runtz | 3.5g (H)',onlineDescription:entry.description},C:{name:'Brand | Blue Dream | 3.5g (S)',onlineDescription:'Herbal berry aroma.'},D:{name:'Legacy',strain:'Hybrid',onlineDescription:'Do not pool a type name.'}};
 const pooled=c.poolStrainDescriptions([],templates);assert.equal(pooled.added,2);assert.equal(pooled.conflicts,0);assert.equal(pooled.directory.length,2);
 const filled=c.poolStrainDescriptions([{...entry,description:''}],templates);assert.equal(filled.filled,1);
 const curated=c.poolStrainDescriptions([{...entry,description:'Reviewed paragraph.'}],templates);assert.equal(curated.directory[0].description,'Reviewed paragraph.');assert.equal(curated.conflicts,1);
 const conflicting=c.poolStrainDescriptions([],{...templates,E:{...templates.A,onlineDescription:'Different description.'}});assert.equal(conflicting.conflicts,1);assert.equal(conflicting.directory.some(row=>row.name==='Runtz'),false);
 assert.equal(c.findStrainDescription(templates.A,pooled.directory).description,entry.description);
 assert.equal(c.findStrainDescription({name:'Brand | Runtz | 1g (I)'},pooled.directory),null);
 assert.equal(c.findStrainDescription({name:'Brand | Runtz | 1g (I)'},[{...entry,type:''}]).description,entry.description);
 assert.equal(c.findStrainDescription({name:'Brand | Runtz | 1g'},[entry,{...entry,type:'I',description:'Different.'}]),null);
 assert.equal(c.findStrainDescription({name:'Brand | Runtz | 1g'},[entry,{...entry,type:'I'}]).description,entry.description);
 const f=fixture({templates});await Promise.all([f.context.ensureStrainDirectory(),f.context.ensureStrainDirectory()]);assert.equal(f.storage.strainDirectory.length,2);assert.equal(f.writes(),1);
 f.storage.strainDirectory=[];await f.context.ensureStrainDirectory();assert.equal(f.storage.strainDirectory.length,0,'Deleted entries are never silently reseeded');
 await Promise.all([
   f.context.mutateStrainDirectory(async current=>{await Promise.resolve();return [...current,entry];}),
   f.context.mutateStrainDirectory(current=>[...current,{name:'Blue Dream',type:'S',description:'Berry.'}])
 ]);assert.equal(f.storage.strainDirectory.length,2,'Concurrent same-context changes merge from latest storage');
 const count=f.writes();await f.context.mutateStrainDirectory(current=>current);assert.equal(f.writes(),count,'No-op changes avoid storage writes');
 await f.context.mutateStrainDirectory(current=>{current[0].description='Updated in place.';return current;});assert.equal(f.storage.strainDirectory[0].description,'Updated in place.');
 await assert.rejects(f.context.mutateStrainDirectory(()=>[entry,entry]),/Duplicate/);assert.equal(f.storage.strainDirectory.length,2,'Invalid changes cannot partially replace storage');
 const raced=fixture({templates});const original=raced.context.chrome.storage.local.get;raced.context.chrome.storage.local.get=async key=>{if(key==='templates')raced.storage.strainDirectory=[{...entry,description:'Saved in another window.'}];return await original(key);};
 await raced.context.ensureStrainDirectory();assert.equal(raced.storage.strainDirectory[0].description,'Saved in another window.');assert.equal(raced.writes(),0);
 let lockCalls=0;const locked=fixture({strainDirectory:[]});locked.context.navigator={locks:{request:async(name,task)=>{assert.equal(name,'brooklyn-bourne-strain-directory');lockCalls++;return await task();}}};await locked.context.mutateStrainDirectory(()=>[entry]);assert.equal(lockCalls,1);
 console.log('Passed strain identities, validation, safe pooling, ambiguous variants, curated preservation, one-time seeding, atomic mutations and concurrent initialization.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
