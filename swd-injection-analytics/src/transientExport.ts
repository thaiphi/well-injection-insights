// Sealed JSON and CSV export for #7 (transient buildup) and #8 (interference screening).
// Same approach as caseInsights.ts (E05): canonical JSON, SHA-256 seal, verify = integrity hash + full recomputation from the stored inputs.
// The helpers are private there, so the pattern is copied here. A null (blocked month, unavailable value) is never exported as 0.
import {buildDisposalCase,type DisposalCase} from './disposalCase.js';
import {buildTransientCase,type TransientResult} from './transientCase.js';
import {buildInterference,type InterferenceResult} from './interference.js';
import {addPackage,EMPTY_PACKAGE_SET,type LoadedPackage,type PackageSet} from './historyPackages.js';
import type {PublicMonthly} from './publicArtifact.js';

export const TRANSIENT_EXPORT_SCHEMA='transient-interference-export/1';
export const TRANSIENT_EXPORT_VERSION='transient-export/1';
export type ExportPackage={uic:string;artifactId:string;manifestSha256:string;window:{startMonth:string;endMonth:string;source:string};monthly:PublicMonthly[]};
export type TransientExport={caseInputs:DisposalCase['inputs'];transient:TransientResult;interference:InterferenceResult|null;packages:ExportPackage[]};
export type SealedTransient=TransientExport&{schemaVersion:typeof TRANSIENT_EXPORT_SCHEMA;versions:Record<string,string>;contentSha256:string};

const STALE='Result changed or stale: ';
function canonical(v:unknown):string{
  if(v===undefined)return 'null';
  if(v===null||typeof v!=='object')return JSON.stringify(v)??'null';
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  return '{'+Object.entries(v as Record<string,unknown>).filter(([,x])=>x!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}';
}
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
async function sha256(text:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');}
const body=(s:SealedTransient|Omit<SealedTransient,'contentSha256'>)=>{const {contentSha256:_,...rest}={contentSha256:'',...s};return canonical(rest);};

/** Relative tolerance for numbers when the stored export is compared with a recomputation: JS engines may differ in the last digit. */
export const TRANSIENT_VERIFY_RELATIVE_TOLERANCE=1e-9;
/** Structural equality: strings, booleans, null, keys and array lengths exact; finite numbers equal within the relative tolerance. */
function sameWithin(a:unknown,b:unknown):boolean{
  if(typeof a==='number'&&typeof b==='number'){
    if(!Number.isFinite(a)||!Number.isFinite(b))return Object.is(a,b);
    return Math.abs(a-b)<=TRANSIENT_VERIFY_RELATIVE_TOLERANCE*Math.max(1,Math.abs(a),Math.abs(b));
  }
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  if(Array.isArray(a)){const y=b as unknown[];return a.length===y.length&&a.every((x,i)=>sameWithin(x,y[i]));}
  const ka=Object.keys(a).filter(k=>(a as Record<string,unknown>)[k]!==undefined).sort(),kb=Object.keys(b).filter(k=>(b as Record<string,unknown>)[k]!==undefined).sort();
  return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&sameWithin((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}

const versionsOf=(x:TransientExport)=>({transientExport:TRANSIENT_EXPORT_VERSION,...x.transient.versions,...(x.interference?x.interference.versions:{})});
export async function sealTransient(x:TransientExport):Promise<SealedTransient>{
  const unsealed={...clone(x),schemaVersion:TRANSIENT_EXPORT_SCHEMA as typeof TRANSIENT_EXPORT_SCHEMA,versions:versionsOf(x)};
  return {...unsealed,contentSha256:await sha256(body(unsealed))};
}
/** Rebuild the package set from the exported packages through addPackage (which refuses duplicates, overlaps and over-limit sets). */
function setFromPackages(packages:readonly ExportPackage[]):PackageSet{
  return packages.reduce<PackageSet>((set,p)=>addPackage(set,{artifactId:p.artifactId,manifestSha256:p.manifestSha256,uic:p.uic,window:p.window as LoadedPackage['window'],monthly:p.monthly}),EMPTY_PACKAGE_SET);
}
export async function verifyTransient(s:SealedTransient):Promise<SealedTransient>{
  const fail=(why='recompute before export')=>new Error(STALE+why);
  try{
    if(!/^[a-f0-9]{64}$/.test(s?.contentSha256??'')||s.schemaVersion!==TRANSIENT_EXPORT_SCHEMA)throw fail('unknown schema or missing digest; recompute before export');
    // Integrity: the stored body must hash exactly to the stored digest.
    if(await sha256(body(s))!==s.contentSha256)throw fail('content digest does not match; recompute before export');
    if(!Array.isArray(s.packages))throw fail('packages are missing');
    if(s.interference!==null&&s.packages.length===0)throw fail('interference result has no packages to recompute it from');
    if(s.interference===null&&s.packages.length>0)throw fail('packages are stored without an interference result');
    const result=buildDisposalCase(s.caseInputs);
    const transient=buildTransientCase(result,s.transient.inputs);
    let interference:InterferenceResult|null=null;
    if(s.interference!==null){
      if(!sameWithin(clone(s.interference.inputs.subject),clone(s.transient.inputs)))throw fail('interference subject differs from the transient inputs');
      interference=buildInterference(result,setFromPackages(s.packages),s.interference.inputs);
    }
    const rebuilt=await sealTransient({caseInputs:s.caseInputs,transient,interference,packages:s.packages});
    // Recomputation: structural match, numbers within relative tolerance (the digests may differ across engines).
    const {contentSha256:_a,...storedBody}=s,{contentSha256:_b,...rebuiltBody}=rebuilt;
    if(!sameWithin(clone(rebuiltBody),clone(storedBody)))throw fail();
    return s;
  }catch(e){
    if(e instanceof Error&&e.message.startsWith(STALE))throw e;
    throw fail();
  }
}
export const transientJson=(s:SealedTransient)=>JSON.stringify(s,null,2)+'\n';

const cell=(v:unknown)=>{
  if(v===null||v===undefined)return '"unavailable"';
  if(typeof v==='number')return `"${v}"`;
  let s=typeof v==='object'?JSON.stringify(v):String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
};
export function transientCsv(s:SealedTransient):string{
  const rows:unknown[][]=[['section','rule_or_well','field','value']];
  const t=s.transient,w=t.well.id,tm='transient-monthly';
  for(const [k,v] of Object.entries(t.labels))rows.push(['labels',w,`label ${k}`,v]);
  t.assumptions.forEach((a,n)=>rows.push(['assumptions',w,`assumption ${n+1}`,a]));
  rows.push([tm,w,'limit_status',t.limitStatus],[tm,w,'first_month_at_limit',t.firstMonthAtLimit],[tm,w,'end_bottomhole_psia',t.endBottomholePsia],
    [tm,w,'reservoir_psia',t.well.reservoirPsia],[tm,w,'limit_psia',t.well.limitPsia],[tm,w,'datum',t.well.datum]);
  for(const m of t.monthly)rows.push([tm,m.month,'end_hours',m.endHours],[tm,m.month,'rise_psi',m.risePsi],[tm,m.month,'skin_psi',m.skinPsi],
    [tm,m.month,'bottomhole_psia',m.bottomholePsia],[tm,m.month,'blocked',m.blocked]);
  for(const a of t.averageRise??[])rows.push([tm,a.month,'average_rise_psi',a.psi]);
  if(t.handoff)rows.push([tm,t.handoff.month,'handoff_psi',t.handoff.psi],[tm,t.handoff.month,'handoff_note',t.handoff.note]);
  for(const p of t.profiles){
    if(!p.points.length)rows.push(['transient-profile',p.month,'points',null]);
    for(const pt of p.points)rows.push(['transient-profile',p.month,`rise_psi at ${pt.rFt} ft`,pt.risePsi]);
  }
  for(const f of t.sensitivity)for(const side of ['low','high'] as const){
    const o=f[side];
    rows.push(['sensitivity',f.factor,`${side} limit_status`,o.limitStatus],['sensitivity',f.factor,`${side} first_month_at_limit`,o.firstMonthAtLimit],
      ['sensitivity',f.factor,`${side} end_bottomhole_psia`,o.endBottomholePsia]);
  }
  const i=s.interference;
  if(i){
    rows.push(['assumptions','interference','mode',i.mode],['assumptions','interference','t_ref',i.inputs.tRef],['assumptions','interference','ranking_month',i.inputs.rankingMonth]);
    i.labels.forEach((l,n)=>rows.push(['labels','interference',`label ${n+1}`,l]));
    i.assumptions.forEach((a,n)=>rows.push(['assumptions','interference',`assumption ${n+1}`,a]));
    for(const f of i.sensitivity){
      const rule=`interference ${f.factor}`;
      rows.push(['sensitivity',rule,'rank_changed',f.rankChanged]);
      for(const [uic,r] of Object.entries(f.rangeByUic))rows.push(['sensitivity',rule,`added_psi_low ${uic}`,r.low],['sensitivity',rule,`added_psi_high ${uic}`,r.high]);
    }
    for(const [a,b] of i.indistinguishable)rows.push(['sensitivity','interference','indistinguishable',`${a} and ${b}`]);
    for(const v of i.views){
      const sec=`interference-${v.name}`;
      rows.push([sec,'view','status',v.status],[sec,'view','total_psi',v.totalPsi],[sec,'view','share_note',v.shareNote],[sec,'view','limit_month',v.limitMonth]);
      for(const r of v.removalEffects)rows.push([sec,'view',`limit_month_without ${r.uic}`,r.limitMonth]);
      for(const r of v.rows){
        rows.push([sec,r.uic,'status',r.status],[sec,r.uic,'distance_ft',r.distanceFt],[sec,r.uic,'added_psi',r.addedPsi],[sec,r.uic,'share',r.share],
          [sec,r.uic,'direction_unknown',r.directionUnknown],[sec,r.uic,'lower_bound',r.lowerBound]);
        r.labels.forEach((l,n)=>rows.push([sec,r.uic,`label ${n+1}`,l]));
      }
      for(const m of v.monthly)rows.push([sec,m.month,'own_rise_psi',m.ownRisePsi],[sec,m.month,'offsets_psi',m.offsetsPsi],[sec,m.month,'bottomhole_psia',m.bottomholePsia]);
    }
  }
  t.warnings.forEach((x,n)=>rows.push(['warnings',w,`warning ${n+1}`,x]));
  (i?.warnings??[]).forEach((x,n)=>rows.push(['warnings','interference',`warning ${n+1}`,x]));
  rows.push(['closing',w,'closing',t.closing]);
  if(i)rows.push(['closing','interference','closing',i.closing]);
  rows.push(['metadata','export','schema',s.schemaVersion],...Object.entries(s.versions).map(([k,v])=>['metadata','export',`version ${k}`,v]),['metadata','export','contentSha256',s.contentSha256]);
  return rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
