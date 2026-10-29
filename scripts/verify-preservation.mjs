import {readFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const PARENT_SHA='8e7ef57c763817a3ab77ea1baf7e2ddf5687d51c753b33e4245f47f580ea237b';
const UI=['web/navigation.mjs','web/index.html','web/import-ui.mjs','web/workspace-views.mjs'];
const NEW=['src/pressureSupport.ts','src/pressureSupportChart.ts','src/pressureSupportExport.ts','data/pressure-support/example.json','data/pressure-support/pin.json','scripts/create-pressure-support-example.mjs','web/pressure-support.mjs','web/pressure-support-chart.mjs','web/pressure-support.css','tests/pressure-support.test.mjs','tests/pressure-support-state.test.mjs','tests/pressure-support-export.test.mjs'];
const ROOT=['scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs','tests/transfer.test.mjs','.gitattributes'];
const PS_BASELINE='migration/pressure-support-baseline.json',ST_BASELINE='migration/sample-tour-baseline.json';
const ST_UI=['web/index.html','web/import-ui.mjs','web/workspace-views.mjs','web/disposal-context.mjs','web/disposal-case.mjs'];
const ST_NEW=['src/sampleCase.ts','scripts/create-sample-case.mjs','data/sample-case/sample-case.json','data/sample-case/pin.json','data/sample-case/public-uic000056484.tar','data/samples/README.md','data/samples/seed417-history.csv','data/samples/seed417-history.xlsx','data/samples/assumed-injectors.csv','data/samples/invalid-history.csv','web/sample-case.mjs','web/sample-steps.mjs','web/sample-tour.mjs','web/sample-tour.css','web/tour-steps.mjs','tests/sample-case.test.mjs','tests/sample-steps.test.mjs','tests/sample-tour.test.mjs'];
const ST_ROOT=['scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs'];
const ST_ARCHIVE='migration/baselines/sample-tour-before/swd-injection-analytics/';
const ST_DOCS=[['docs/superpowers/specs/2026-10-14-sample-case-guided-tour-design.md','approvedSpecSha256'],['docs/superpowers/plans/2026-10-14-sample-case-guided-tour.md','approvedPlanSha256']];
const EOL_BASELINE='migration/eol-baseline.json',EOL_ROOT=['.gitattributes','scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs'];
const SM_BASELINE='migration/sample-minors-baseline.json',SM_UI=['web/disposal-context.mjs','web/import-ui.mjs','web/sample-tour.css'],SM_NEW=['tests/sample-minors.test.mjs'];
const SM_ROOT=['scripts/verify-preservation.mjs','tests/preservation-baseline.test.mjs'],SM_ARCHIVE='migration/baselines/sample-minors-before/swd-injection-analytics/';
const SM_DOCS=[['docs/superpowers/plans/2026-10-16-sample-tour-minors.md','approvedPlanSha256']];
const INDEX='migration/layers/index.json',LAYER_DIR='migration/layers',TREES=['src','data','web','tests','scripts','reference','exhibits'],NAME=/^[a-z0-9]+(-[a-z0-9]+)*$/;
const HASH=/^[a-f0-9]{64}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
// Approved documents are hashed with CRLF normalized to LF: docs/ has no -text rule, so checkouts may differ by platform.
const docSha=b=>sha(Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'),'utf8'));
const safe=p=>typeof p==='string'&&p.length>0&&!p.includes('\\')&&!p.startsWith('/')&&!p.includes(':')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..');
async function bytesAt(root,p){
 if(!safe(p))throw Error('Unsafe relative path: '+p);
 let q=root;for(const part of p.split('/')){q=join(q,part);if((await lstat(q)).isSymbolicLink())throw Error('Symlink/junction path rejected: '+p);}
 const full=resolve(root,p);if(!full.startsWith(root+sep))throw Error('Path escapes root: '+p);return readFile(full);
}
async function listFiles(root,relative,violations){
 const out=[];
 async function walk(p){
  try{for(const e of await readdir(join(root,p),{withFileTypes:true})){const name=p+'/'+e.name;if(e.isSymbolicLink()){violations.push('Symlink/junction in inventory: '+name);continue;}if(e.isDirectory())await walk(name);else if(e.isFile())out.push(name);else violations.push('Unsupported path in inventory: '+name);}}
  catch(e){if(e.code!=='ENOENT')violations.push('Cannot scan '+p+': '+e.message);}
 }
 try{const stat=await lstat(join(root,relative));if(stat.isSymbolicLink()){violations.push('Symlink/junction in inventory: '+relative);return out;}if(!stat.isDirectory()){violations.push('Inventory directory is not a directory: '+relative);return out;}}catch(e){if(e.code==='ENOENT')return out;violations.push('Cannot inspect '+relative+': '+e.message);return out;}
 await walk(relative);return out;
}
function exactEntries(entries,allowed,label,violations){
 if(!Array.isArray(entries)){violations.push(label+' inventory missing');return new Map();}
 const m=new Map();for(const e of entries){if(!e||!safe(e.path)||!allowed.includes(e.path)){violations.push(label+' unapproved/unsafe allowlist path: '+String(e?.path));continue;}if(m.has(e.path))violations.push(label+' duplicate path: '+e.path);else m.set(e.path,e);}
 if(entries.length!==allowed.length||allowed.some(p=>!m.has(p)))violations.push(label+' must equal the exact '+allowed.length+'-file allowlist');return m;
}
/** Verify the data-driven layers listed in migration/layers/index.json. Each record chains on the previous one (the first on the sample-minors baseline) and carries its own reviewed allowlists, so a new layer needs no checker change. */
async function verifyRegistry(root,{sm,priorApp},violations){
 const app=new Map(),pins=new Map(),listed=new Set([INDEX]),names=new Set();let index=null;
 try{index=JSON.parse(await bytesAt(root,INDEX));}catch(e){if(e.code!=='ENOENT')violations.push('Cannot read layer index: '+e.message);}
 const entries=Array.isArray(index?.layers)?index.layers:[];
 if(index!==null){
  if(!sm)violations.push('Layer registry requires the accepted sample-minors baseline');
  if(index?.version!=='swd-preservation-layer-index/1')violations.push('Unsupported layer index version');
  if(!entries.length)violations.push('Layer index must list at least one layer');
 }
 for(const x of entries){if(typeof x?.name!=='string'||!NAME.test(x.name)||names.has(x.name)||x.baseline!==LAYER_DIR+'/'+x.name+'.json')violations.push('Invalid or duplicate layer index entry: '+JSON.stringify(x));else{names.add(x.name);listed.add(x.baseline);}}
 for(const p of await listFiles(root,LAYER_DIR,violations))if(!listed.has(p))violations.push('Unlisted layer file: '+p);
 if(names.size!==entries.length)return {app,pins};
 let parent=SM_BASELINE,indexPinned=false;
 for(const {name,baseline} of entries){
  const label='Layer '+name,archive='migration/baselines/'+name+'-before/swd-injection-analytics/';let L;
  try{L=JSON.parse(await bytesAt(root,baseline));}catch(e){violations.push(label+' baseline unavailable: '+e.message);return {app,pins};}
  if(L?.version!=='swd-preservation-layer/1')violations.push(label+': unsupported version');
  if(L?.name!==name)violations.push(label+': name does not match the index');
  if(L?.status!=='accepted')violations.push(label+' baseline is pending/not accepted after independent review');
  try{if(!HASH.test(L?.parentBaselineSha256??'')||sha(await bytesAt(root,parent))!==L.parentBaselineSha256)violations.push(label+' parent baseline SHA mismatch');}catch(e){violations.push(label+' parent baseline unavailable: '+e.message);}
  parent=baseline;
  const list=k=>Array.isArray(L?.[k])?L[k]:(violations.push(label+': '+k+' must be a list'),[]);
  const fresh=(seen,p)=>{if(!safe(p)){violations.push(label+' unsafe path: '+String(p));return false;}if(seen.has(p)){violations.push(label+' duplicate path: '+p);return false;}seen.add(p);return true;};
  const docs=list('approvedDocs');if(!docs.length)violations.push(label+': at least one approved document is required');
  for(const d of docs){try{if(!safe(d?.path)||!HASH.test(d.sha256??'')||docSha(await bytesAt(root,d.path))!==d.sha256)violations.push('Approved document hash mismatch: '+String(d?.path));}catch(e){violations.push('Approved document unavailable: '+String(d?.path)+' '+e.message);}}
  const appSeen=new Set(),rootSeen=new Set(),archives=new Set(),next=new Map();
  // A change moves an already-pinned product file from its prior accepted state to a reviewed after-state.
  for(const c of list('changes')){
   if(!fresh(appSeen,c?.path))continue;const p=c.path,before=app.get(p)??priorApp(p);archives.add(archive+p);
   if(c.archive!==archive+p)violations.push(label+' unsafe/unapproved archive path: '+String(c.archive));
   if(!before||c.beforeSha256!==before.sha256||c.beforeBytes!==before.bytes)violations.push(label+' before hash/bytes must equal the prior accepted state: '+p);
   try{const b=await bytesAt(root,archive+p);if(!before||b.length!==before.bytes||sha(b)!==before.sha256)violations.push(label+' archive hash/bytes mismatch: '+p);}catch(e){violations.push(label+' archive missing/unsafe: '+p+' '+e.message);}
   if(!HASH.test(c.afterSha256??'')||!Number.isSafeInteger(c.afterBytes)||c.afterBytes<0)violations.push(label+' unreviewed after hash/bytes: '+p);else next.set(p,{sha256:c.afterSha256,bytes:c.afterBytes});
  }
  for(const n of list('newFiles')){
   if(!fresh(appSeen,n?.path))continue;const p=n.path,parts=p.split('/');
   if(parts.length<2||!TREES.includes(parts[0])||app.has(p)||priorApp(p))violations.push(label+' new file must be a new path in a permitted product tree: '+p);
   else next.set(p,{sha256:n.sha256,bytes:n.bytes});
  }
  for(const p of await listFiles(root,'migration/baselines/'+name+'-before',violations))if(!archives.has(p))violations.push(label+' unlisted archive: '+p);
  for(const [p,e] of next)app.set(p,e);
  indexPinned=false;
  for(const r of list('rootFiles')){
   if(!fresh(rootSeen,r?.path))continue;const p=r.path;
   if(p.startsWith('swd-injection-analytics/')||(p.startsWith('migration/')&&p!==INDEX))violations.push(label+' root file must be outside the product and migration trees: '+p);
   else{pins.set(p,{sha256:r.sha256,bytes:r.bytes});if(p===INDEX)indexPinned=true;}
  }
 }
 if(entries.length&&!indexPinned)violations.push('Layer index must be pinned by the latest layer');
 return {app,pins};
}
/** Verify original transfer bytes, the reviewed pressure-context delta, the chained sample-tour, line-ending and sample-minors baselines, and the data-driven registry layers when present. */
export async function verifyPreservation(root){
 root=resolve(root);const violations=[];let checked=0,manifestBytes,manifest;
 try{manifestBytes=await bytesAt(root,'migration/source-manifest.json');if(sha(manifestBytes)!==PARENT_SHA)violations.push('Original manifest SHA pin mismatch');manifest=JSON.parse(manifestBytes);}catch(e){return {checked,violations:['Cannot read immutable manifest: '+e.message]};}
 if(!Array.isArray(manifest.files)||manifest.files.length!==182||sha(manifestBytes)!==PARENT_SHA)return {checked,violations:[...violations,'Original manifest file count/hash invalid; expected 182 pinned originals']};
 const originals=new Map(manifest.files.map(e=>[e.path,e]));let baseline=null;
 try{baseline=JSON.parse(await bytesAt(root,PS_BASELINE));}catch(e){if(e.code!=='ENOENT')violations.push('Cannot read baseline: '+e.message);}
 let changes=new Map(),added=new Map(),rootAdded=new Map();
 if(baseline){
  if(baseline.version!=='swd-pressure-preservation/1')violations.push('Unsupported preservation baseline version');
  if(baseline.status!=='accepted')violations.push('Baseline is pending/not accepted after independent review');
  if(baseline.originalCount!==182)violations.push('Baseline originalCount must be 182');
  if(baseline.parentManifestSha256!==PARENT_SHA||baseline.parentManifestSha256!==sha(manifestBytes))violations.push('Baseline parent manifest SHA pin mismatch');
  changes=exactEntries(baseline.changes,UI,'UI changes',violations);added=exactEntries(baseline.newFiles,NEW,'New product files',violations);rootAdded=exactEntries(baseline.rootFiles,ROOT,'Root files',violations);
  for(const [p,key]of [['demo/PRESSURE-SUPPORT-DESIGN.md','approvedDesignSha256'],['docs/superpowers/plans/2026-10-12-pressure-support-context.md','approvedPlanSha256']]){
   try{if(!HASH.test(baseline[key]??'')||sha(await bytesAt(root,p))!==baseline[key])violations.push('Approved document hash mismatch: '+p);}catch(e){violations.push('Approved document unavailable: '+p+' '+e.message);}
  }
  const archiveFiles=await listFiles(root,'migration/baselines/pressure-support-before',violations),archives=new Set(UI.map(p=>'migration/baselines/pressure-support-before/swd-injection-analytics/'+p));
  for(const p of archiveFiles)if(!archives.has(p))violations.push('Unlisted original archive: '+p);
  for(const [p,c]of changes){
   const original=originals.get(p),archive='migration/baselines/pressure-support-before/swd-injection-analytics/'+p;
   if(c.archive!==archive)violations.push('Unsafe/unapproved archive path: '+String(c.archive));
   if(c.beforeSha256!==original.sha256||c.beforeBytes!==original.bytes)violations.push('Original before hash/bytes mismatch: '+p);
   if(!HASH.test(c.afterSha256??'')||!Number.isSafeInteger(c.afterBytes)||c.afterBytes<0)violations.push('Unreviewed after hash/bytes: '+p);
   try{const b=await bytesAt(root,archive);if(b.length!==original.bytes||sha(b)!==original.sha256)violations.push('Original archive hash/bytes mismatch: '+p);}catch(e){violations.push('Original archive missing/unsafe: '+p+' '+e.message);}
  }
 }
 let st=null,stChanges=new Map(),stAdded=new Map(),stRoot=new Map();
 try{st=JSON.parse(await bytesAt(root,ST_BASELINE));}catch(e){if(e.code!=='ENOENT')violations.push('Cannot read sample-tour baseline: '+e.message);}
 if(st){
  if(!baseline)violations.push('Sample-tour baseline requires the accepted pressure-support baseline');
  if(st.version!=='swd-sample-tour-preservation/1')violations.push('Unsupported sample-tour baseline version');
  if(st.status!=='accepted')violations.push('Sample-tour baseline is pending/not accepted after independent review');
  try{if(!HASH.test(st.parentBaselineSha256??'')||sha(await bytesAt(root,PS_BASELINE))!==st.parentBaselineSha256)violations.push('Sample-tour parent baseline SHA mismatch');}catch(e){violations.push('Sample-tour parent baseline unavailable: '+e.message);}
  stChanges=exactEntries(st.changes,ST_UI,'Sample-tour UI changes',violations);stAdded=exactEntries(st.newFiles,ST_NEW,'Sample-tour new files',violations);stRoot=exactEntries(st.rootFiles,ST_ROOT,'Sample-tour root files',violations);
  for(const [p,key]of ST_DOCS){try{if(!HASH.test(st[key]??'')||docSha(await bytesAt(root,p))!==st[key])violations.push('Approved document hash mismatch: '+p);}catch(e){violations.push('Approved document unavailable: '+p+' '+e.message);}}
  const stArchives=new Set(ST_UI.map(p=>ST_ARCHIVE+p));
  for(const p of await listFiles(root,'migration/baselines/sample-tour-before',violations))if(!stArchives.has(p))violations.push('Unlisted sample-tour archive: '+p);
  for(const [p,c]of stChanges){
   const prior=changes.get(p),original=originals.get(p),before=prior?{sha256:prior.afterSha256,bytes:prior.afterBytes}:original?{sha256:original.sha256,bytes:original.bytes}:null;
   if(c.archive!==ST_ARCHIVE+p)violations.push('Unsafe/unapproved sample-tour archive path: '+String(c.archive));
   if(!before||c.beforeSha256!==before.sha256||c.beforeBytes!==before.bytes)violations.push('Sample-tour before hash/bytes must equal the prior accepted state: '+p);
   if(!HASH.test(c.afterSha256??'')||!Number.isSafeInteger(c.afterBytes)||c.afterBytes<0)violations.push('Unreviewed sample-tour after hash/bytes: '+p);
   try{const b=await bytesAt(root,ST_ARCHIVE+p);if(!before||b.length!==before.bytes||sha(b)!==before.sha256)violations.push('Sample-tour archive hash/bytes mismatch: '+p);}catch(e){violations.push('Sample-tour archive missing/unsafe: '+p+' '+e.message);}
  }
 }
 let eol=null,eolRoot=new Map();
 try{eol=JSON.parse(await bytesAt(root,EOL_BASELINE));}catch(e){if(e.code!=='ENOENT')violations.push('Cannot read line-ending baseline: '+e.message);}
 if(eol){
  if(!st)violations.push('Line-ending baseline requires the accepted sample-tour baseline');
  if(eol.version!=='swd-eol-preservation/1')violations.push('Unsupported line-ending baseline version');
  if(eol.status!=='accepted')violations.push('Line-ending baseline is pending/not accepted');
  try{if(!HASH.test(eol.parentBaselineSha256??'')||sha(await bytesAt(root,ST_BASELINE))!==eol.parentBaselineSha256)violations.push('Line-ending parent baseline SHA mismatch');}catch(e){violations.push('Line-ending parent baseline unavailable: '+e.message);}
  eolRoot=exactEntries(eol.rootFiles,EOL_ROOT,'Line-ending root files',violations);
 }
 let sm=null,smChanges=new Map(),smAdded=new Map(),smRoot=new Map();
 try{sm=JSON.parse(await bytesAt(root,SM_BASELINE));}catch(e){if(e.code!=='ENOENT')violations.push('Cannot read sample-minors baseline: '+e.message);}
 if(sm){
  if(!eol)violations.push('Sample-minors baseline requires the accepted line-ending baseline');
  if(sm.version!=='swd-sample-minors-preservation/1')violations.push('Unsupported sample-minors baseline version');
  if(sm.status!=='accepted')violations.push('Sample-minors baseline is pending/not accepted after independent review');
  try{if(!HASH.test(sm.parentBaselineSha256??'')||sha(await bytesAt(root,EOL_BASELINE))!==sm.parentBaselineSha256)violations.push('Sample-minors parent baseline SHA mismatch');}catch(e){violations.push('Sample-minors parent baseline unavailable: '+e.message);}
  smChanges=exactEntries(sm.changes,SM_UI,'Sample-minors UI changes',violations);smAdded=exactEntries(sm.newFiles,SM_NEW,'Sample-minors new files',violations);smRoot=exactEntries(sm.rootFiles,SM_ROOT,'Sample-minors root files',violations);
  for(const [p,key]of SM_DOCS){try{if(!HASH.test(sm[key]??'')||docSha(await bytesAt(root,p))!==sm[key])violations.push('Approved document hash mismatch: '+p);}catch(e){violations.push('Approved document unavailable: '+p+' '+e.message);}}
  const smArchives=new Set(SM_UI.map(p=>SM_ARCHIVE+p));
  for(const p of await listFiles(root,'migration/baselines/sample-minors-before',violations))if(!smArchives.has(p))violations.push('Unlisted sample-minors archive: '+p);
  for(const [p,c]of smChanges){
   // The prior accepted state is the latest earlier layer's after-state, a sample-tour new-file pin, or the original.
   const stc=stChanges.get(p),psc=changes.get(p),sta=stAdded.get(p),original=originals.get(p);
   const before=stc?{sha256:stc.afterSha256,bytes:stc.afterBytes}:psc?{sha256:psc.afterSha256,bytes:psc.afterBytes}:sta?{sha256:sta.sha256,bytes:sta.bytes}:original?{sha256:original.sha256,bytes:original.bytes}:null;
   if(c.archive!==SM_ARCHIVE+p)violations.push('Unsafe/unapproved sample-minors archive path: '+String(c.archive));
   if(!before||c.beforeSha256!==before.sha256||c.beforeBytes!==before.bytes)violations.push('Sample-minors before hash/bytes must equal the prior accepted state: '+p);
   if(!HASH.test(c.afterSha256??'')||!Number.isSafeInteger(c.afterBytes)||c.afterBytes<0)violations.push('Unreviewed sample-minors after hash/bytes: '+p);
   try{const b=await bytesAt(root,SM_ARCHIVE+p);if(!before||b.length!==before.bytes||sha(b)!==before.sha256)violations.push('Sample-minors archive hash/bytes mismatch: '+p);}catch(e){violations.push('Sample-minors archive missing/unsafe: '+p+' '+e.message);}
  }
 }
 // Prior accepted state of a product path after the hand-written layers: latest layer first, then the original.
 const after=c=>c&&{sha256:c.afterSha256,bytes:c.afterBytes};
 const priorApp=p=>after(smChanges.get(p))??smAdded.get(p)??after(stChanges.get(p))??stAdded.get(p)??after(changes.get(p))??added.get(p)??originals.get(p)??null;
 const reg=await verifyRegistry(root,{sm,priorApp},violations);
 for(const e of manifest.files){
  checked++;try{const b=await bytesAt(root,'swd-injection-analytics/'+e.path),change=smChanges.get(e.path)??stChanges.get(e.path)??changes.get(e.path),expected=reg.app.get(e.path)??(change&&HASH.test(change.afterSha256??'')&&Number.isSafeInteger(change.afterBytes)?{sha256:change.afterSha256,bytes:change.afterBytes}:e);if(b.length!==expected.bytes||sha(b)!==expected.sha256)violations.push('Unapproved original file bytes/hash: '+e.path);}catch(err){violations.push('Original file missing/unsafe: '+e.path+' '+err.message);}
 }
 const bySm=p=>sm&&SM_ROOT.includes(p),byEol=p=>(eol&&EOL_ROOT.includes(p))||bySm(p),superseded=p=>(st&&ST_ROOT.includes(p))||byEol(p);
 const psRoot=new Map([...rootAdded].filter(([p])=>!superseded(p))),stRootLive=new Map([...stRoot].filter(([p])=>!byEol(p))),eolRootLive=new Map([...eolRoot].filter(([p])=>!bySm(p)));
 // A sample-tour new file re-listed as a sample-minors change is checked against its reviewed after-state instead.
 const stAddedLive=new Map([...stAdded].filter(([p])=>!smChanges.has(p))),smChangedNew=new Map([...smChanges].filter(([p])=>!originals.has(p)).map(([p,c])=>[p,{sha256:c.afterSha256,bytes:c.afterBytes}]));
 // Registry after-states and root pins supersede every hand-written pin of the same path.
 const notApp=m=>new Map([...m].filter(([p])=>!reg.app.has(p))),notRoot=m=>new Map([...m].filter(([p])=>!reg.pins.has(p))),regNew=new Map([...reg.app].filter(([p])=>!originals.has(p)));
 for(const [prefix,inventory]of [['swd-injection-analytics/',notApp(added)],['swd-injection-analytics/',notApp(stAddedLive)],['swd-injection-analytics/',notApp(smChangedNew)],['swd-injection-analytics/',notApp(smAdded)],['swd-injection-analytics/',regNew],['',notRoot(psRoot)],['',notRoot(stRootLive)],['',notRoot(eolRootLive)],['',notRoot(smRoot)],['',reg.pins]])for(const [p,e]of inventory){
  if(!HASH.test(e.sha256??'')||!Number.isSafeInteger(e.bytes)||e.bytes<0){violations.push('Invalid reviewed file entry: '+p);continue;}
  try{const b=await bytesAt(root,prefix+p);if(b.length!==e.bytes||sha(b)!==e.sha256)violations.push('Reviewed added file hash/bytes mismatch: '+p);}catch(err){violations.push('Reviewed added file missing/unsafe: '+p+' '+err.message);}
 }
 for(const dir of ['src','data','web','tests','scripts','reference','exhibits'])for(const p of await listFiles(root,'swd-injection-analytics/'+dir,violations)){const appPath=p.slice('swd-injection-analytics/'.length);if(!originals.has(appPath)&&!added.has(appPath)&&!stAdded.has(appPath)&&!smAdded.has(appPath)&&!reg.app.has(appPath))violations.push('Unlisted new product path: '+appPath);}
 try{for(const e of await readdir(join(root,'swd-injection-analytics'),{withFileTypes:true})){if(e.isFile()&&!originals.has(e.name))violations.push('New product file outside permitted trees: '+e.name);if(e.isSymbolicLink())violations.push('Symlink/junction at application root: '+e.name);}}catch(e){violations.push('Cannot inspect application root: '+e.message);}
 return {checked,violations};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const r=await verifyPreservation(process.argv[2]??'.');console.log(JSON.stringify(r,null,2));if(r.violations.length)process.exitCode=1;
}


