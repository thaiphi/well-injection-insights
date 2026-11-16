// Sealed JSON and CSV export for #7 (transient buildup) and #8 (interference screening).
// Same approach as caseInsights.ts (E05): canonical JSON, SHA-256 seal, verify = integrity hash + full recomputation from the stored inputs.
// The helpers are private there, so the pattern is copied here. A null (blocked month, unavailable value) is never exported as 0.
import {buildDisposalCase,type DisposalCase} from './disposalCase.js';
import {buildTransientCase,scheduleFromForecast,type TransientResult} from './transientCase.js';
import {buildInterference,type InterferenceResult} from './interference.js';
import {addPackage,EMPTY_PACKAGE_SET,type LoadedPackage,type PackageSet} from './historyPackages.js';
import type {PublicMonthly} from './publicArtifact.js';
import {fmtNumber} from './caseSummary.js';

export const TRANSIENT_EXPORT_SCHEMA='transient-interference-export/1';
export const TRANSIENT_EXPORT_VERSION='transient-export/1';
/** The package's permitted injection interval as reported (evidence only; never a calculation input; the depth basis is unknown). */
export const PERMITTED_INTERVAL_LABEL='as reported; depth basis unknown';
export type PermittedInterval={permitted_top_depth_ft:number|null;permitted_bottom_depth_ft:number|null;label:typeof PERMITTED_INTERVAL_LABEL};
export type ExportPackage={uic:string;artifactId:string;manifestSha256:string;window:{startMonth:string;endMonth:string;source:string};monthly:PublicMonthly[];
  permittedInterval?:PermittedInterval|null};
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
function validInterval(v:unknown):boolean{
  if(typeof v!=='object'||v===null||Array.isArray(v))return false;
  const keys=Object.keys(v).sort(),o=v as Record<string,unknown>,depth=(x:unknown)=>x===null||(typeof x==='number'&&Number.isFinite(x));
  return keys.join(',')==='label,permitted_bottom_depth_ft,permitted_top_depth_ft'&&o.label===PERMITTED_INTERVAL_LABEL&&depth(o.permitted_top_depth_ft)&&depth(o.permitted_bottom_depth_ft);
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
    // The permitted interval is stored evidence: verify checks its shape and carries it as stored (it is not recomputed).
    if(!s.packages.every(p=>p.permittedInterval===undefined||p.permittedInterval===null||validInterval(p.permittedInterval)))throw fail('a package permitted interval is malformed');
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
/** Months of a copied schedule that the disposal case had (forecast); the others were typed. Null when not copied or not derivable. */
function forecastMonths(s:SealedTransient):Set<string>|null{
  const o=s.transient.inputs.schedule.origin;
  if(typeof o!=='object'||o===null)return null;
  try{return new Set(scheduleFromForecast(buildDisposalCase(s.caseInputs),s.transient.inputs.wellId,o.copiedAt).months.filter(m=>m.rateStbd!==null).map(m=>m.month));}
  catch{return null;}
}
/** The stored inputs and choices, each field name carrying its label. A null is "unavailable", never 0. */
function inputRows(s:SealedTransient):unknown[][]{
  const rows:unknown[][]=[],t=s.transient,x=t.inputs,w=t.well.id,sec='inputs';
  const r=x.rock;
  rows.push([sec,w,'rock k_md (assumed)',r.k],[sec,w,'rock h_ft (assumed)',r.h],[sec,w,'rock phi_fraction (assumed)',r.phi],[sec,w,'rock cf_per_psi (assumed)',r.cf],
    [sec,w,'rock rw_ft (assumed)',r.rw],[sec,w,'rock skin (assumed)',r.skin],[sec,w,'boundary_kind (assumed)',x.boundary.kind]);
  if(x.boundary.kind==='closed')rows.push([sec,w,'re_ft (assumed)',x.boundary.re]);
  else rows.push([sec,w,'stated_extent_ft (assumed)',x.boundary.statedExtentFt]);
  const fm=forecastMonths(s);
  for(const m of x.schedule.months){
    const label=fm===null?t.labels.schedule:fm.has(m.month)?t.labels.schedule:'synthetic/assumed; typed, not in the disposal case';
    rows.push([sec,m.month,`rate_stbd (${label})`,m.rateStbd]);
  }
  x.profileMonths.forEach((m,n)=>rows.push([sec,w,`profile_month ${n+1}`,m]));
  for(const [f,v] of Object.entries(x.sensitivity))if(v)rows.push([sec,w,`sensitivity ${f} low (assumed)`,v.low],[sec,w,`sensitivity ${f} high (assumed)`,v.high]);
  const i=s.interference;
  if(i){
    const o='offset-inputs',ii=i.inputs;
    for(const c of [...ii.offsets].sort((a,b)=>a.uic<b.uic?-1:a.uic>b.uic?1:0)){
      const u=c.uic;
      rows.push([o,u,'distance_ft (assumed)',c.distanceFt],[o,u,'connected (assumed)',c.connected],[o,u,'zeros_are_shut_in (assumed)',c.zerosAreShutIn]);
      for(const m of Object.keys(c.gapRates??{}).sort())rows.push([o,u,`gap_rate_stbd ${m} (assumed)`,c.gapRates[m]]);
      rows.push([o,u,'prior_start_month (assumed)',c.prior?c.prior.startMonth:null],[o,u,'prior_rate_stbd (assumed)',c.prior?c.prior.rateStbd:null],
        [o,u,'after_last_report (assumed)',c.after?c.after.kind:null]);
      if(c.after?.kind==='hold-average')rows.push([o,u,'after_last_n (assumed)',c.after.lastN]);
      if(c.after?.kind==='typed')rows.push([o,u,'after_rate_stbd (assumed)',c.after.rateStbd]);
      const d=ii.sensitivity.distance?.[u];
      if(d)rows.push([o,u,'sensitivity distance_ft low (assumed)',d.low],[o,u,'sensitivity distance_ft high (assumed)',d.high]);
    }
    rows.push([o,'interference','t_ref (assumed)',ii.tRef],[o,'interference','ranking_month',ii.rankingMonth]);
    for(const f of ['k','cf'] as const){const v=ii.sensitivity[f];if(v)rows.push([o,'interference',`sensitivity ${f} low (assumed)`,v.low],[o,'interference',`sensitivity ${f} high (assumed)`,v.high]);}
  }
  return rows;
}
export function transientCsv(s:SealedTransient):string{
  const rows:unknown[][]=[['section','rule_or_well','field','value']];
  const t=s.transient,w=t.well.id,tm='transient-monthly';
  rows.push(...inputRows(s));
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
      v.notes.forEach((x,n)=>rows.push([sec,'view',`note ${n+1}`,x]));
      for(const r of v.removalEffects)rows.push([sec,'view',`limit_month_without ${r.uic}`,r.limitMonth],[sec,'view',`limit_month_without_note ${r.uic}`,r.note]);
      for(const r of v.rows){
        rows.push([sec,r.uic,'status',r.status],[sec,r.uic,'distance_ft',r.distanceFt],[sec,r.uic,'added_psi',r.addedPsi],[sec,r.uic,'share',r.share],
          [sec,r.uic,'direction_unknown',r.directionUnknown],[sec,r.uic,'lower_bound',r.lowerBound]);
        r.labels.forEach((l,n)=>rows.push([sec,r.uic,`label ${n+1}`,l]));
      }
      for(const m of v.monthly)rows.push([sec,m.month,'own_rise_psi',m.ownRisePsi],[sec,m.month,'offsets_psi',m.offsetsPsi],[sec,m.month,'bottomhole_psia',m.bottomholePsia],[sec,m.month,'blocked',m.blocked]);
    }
  }
  for(const p of s.packages){
    const v=p.permittedInterval,d=(x:number|null)=>x===null?'not reported':`${fmtNumber(x)} ft`,a=p.artifactId;
    rows.push(['packages',p.uic,`artifact_id ${a}`,a],['packages',p.uic,`manifest_sha256 ${a}`,p.manifestSha256],['packages',p.uic,`window_start ${a}`,p.window.startMonth],
      ['packages',p.uic,`window_end ${a}`,p.window.endMonth],['packages',p.uic,`window_source ${a}`,p.window.source]);
    rows.push(['packages',p.uic,`permitted_interval ${p.artifactId}`,v?`top ${d(v.permitted_top_depth_ft)}; bottom ${d(v.permitted_bottom_depth_ft)}; ${v.label}`:null]);
  }
  t.warnings.forEach((x,n)=>rows.push(['warnings',w,`warning ${n+1}`,x]));
  (i?.warnings??[]).forEach((x,n)=>rows.push(['warnings','interference',`warning ${n+1}`,x]));
  rows.push(['closing',w,'closing',t.closing]);
  if(i)rows.push(['closing','interference','closing',i.closing]);
  rows.push(['metadata','export','schema',s.schemaVersion],...Object.entries(s.versions).map(([k,v])=>['metadata','export',`version ${k}`,v]),['metadata','export','contentSha256',s.contentSha256]);
  return rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
