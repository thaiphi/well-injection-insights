// Reads results-<tag>.json and downloads/<tag>/ ; checks (vi) 1a export bytes identical across marker states and (vii) sealed test-records JSON.
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const mod=await import(pathToFileURL(resolve(here,'../../swd-injection-analytics/dist/testRecordsExport.js')).href);
for(const tag of ['desktop','mobile']){
 const r=JSON.parse(readFileSync(join(here,`results-${tag}.json`),'utf8'));
 const stages=Object.keys(r).filter(k=>/^d_1a_/.test(k));
 const byName={};
 for(const s of stages)for(const d of r[s]){const key=d.name.replace(/^swd-selected-analysis/,'legacy').replace(/^h10-diagnostics-\d+-[0-9a-f]+/,'h10');(byName[key]??=[]).push(`${s.split('_')[2]}:${d.sha256.slice(0,12)}`);}
 console.log(tag,'1a downloads per stage (sha256 prefix):');
 for(const [k,v] of Object.entries(byName))console.log(' ',k,new Set(v.map(x=>x.split(':')[1])).size===1&&v.length===stages.length?'IDENTICAL':'DIFFERENT',v.join(' '));
 const markerCounts=['c1_markers0','c4_markers_none','c4_markers_restored','c5_markers_after_upload'].map(k=>`${k}=${r[k].count}`);
 console.log(' marker counts at the stages:',markerCounts.join(' '));
 const dir=join(here,'downloads',tag);
 for(const f of readdirSync(dir)){
  const p=join(dir,f);
  if(/\.svg$/.test(f)&&/^S\d__(h10|swd)/.test(f))console.log(' ',f,'contains test marker element:',/data-test-marker/.test(readFileSync(p,'utf8')));
  if(/^S\d__test-records.*\.json$/.test(f)){const o=JSON.parse(readFileSync(p,'utf8'));console.log(' ',f,'verifyTestRecordsSealed =',await mod.verifyTestRecordsSealed(o),'records',o.records?.length,'method',o.method??o.methodVersion);}
 }
}
