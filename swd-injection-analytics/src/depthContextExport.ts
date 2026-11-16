// Sealed JSON, CSV and SVG export for E11 (depth view, review aid).
// Same approach as transientExport.ts: canonical JSON, SHA-256 seal, verify = integrity hash + full recomputation from the stored inputs.
// Verification never trusts a stored derived value: the profile is re-parsed from each row's raw text, each curve source point is
// re-evaluated with caseHydraulicPoint, and the context is rebuilt with buildDepthContext.
import {caseHydraulicPoint} from './disposalCase.js';
import {buildDepthContext,DEPTH_CONTEXT_VERSION,DROPPED,type CurveSource,type DepthContext,type DepthSelection} from './depthContext.js';
import {DEPTH_PROFILE_VERSION,parseDepthProfile,PROFILE_COLUMNS,type Profile} from './depthProfile.js';
import {CURVE_LABEL,depthContextSvg,TEST_LABEL,unescapeMetadata} from './depthContextSvg.js';

export const DEPTH_EXPORT_SCHEMA='depth-context-export/1';
export const DEPTH_EXPORT_VERSION='depth-export/1';
/** Relative tolerance for numbers when the stored export is compared with a recomputation: JS engines may differ in the last digit. */
export const DEPTH_VERIFY_RELATIVE_TOLERANCE=1e-9;
export type DepthExport={profile:Profile;dropped:{row:number;wellId:string}[];sources:CurveSource[];selection:DepthSelection;caseRef:{schemaVersion:string;methodVersion:string;contentSha256:string|null};context:DepthContext};
export type SealedDepth=DepthExport&{schemaVersion:typeof DEPTH_EXPORT_SCHEMA;versions:Record<string,string>;contentSha256:string};

const STALE='Result changed or stale: ';
function canonical(v:unknown):string{
  if(v===undefined)return 'null';
  if(v===null||typeof v!=='object')return JSON.stringify(v)??'null';
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  return '{'+Object.entries(v as Record<string,unknown>).filter(([,x])=>x!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}';
}
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
async function sha256(text:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');}
const body=(s:SealedDepth|Omit<SealedDepth,'contentSha256'>)=>{const {contentSha256:_,...rest}={contentSha256:'',...s};return canonical(rest);};

/** Structural equality: strings, booleans, null, keys and array lengths exact; finite numbers equal within the relative tolerance. */
function sameWithin(a:unknown,b:unknown):boolean{
  if(typeof a==='number'&&typeof b==='number'){
    if(!Number.isFinite(a)||!Number.isFinite(b))return Object.is(a,b);
    return Math.abs(a-b)<=DEPTH_VERIFY_RELATIVE_TOLERANCE*Math.max(1,Math.abs(a),Math.abs(b));
  }
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  if(Array.isArray(a)){const y=b as unknown[];return a.length===y.length&&a.every((x,i)=>sameWithin(x,y[i]));}
  const ka=Object.keys(a).filter(k=>(a as Record<string,unknown>)[k]!==undefined).sort(),kb=Object.keys(b).filter(k=>(b as Record<string,unknown>)[k]!==undefined).sort();
  return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&sameWithin((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}

const versionsOf=():Record<string,string>=>({depthExport:DEPTH_EXPORT_VERSION,depthProfile:DEPTH_PROFILE_VERSION,depthContext:DEPTH_CONTEXT_VERSION});
export async function sealDepth(x:DepthExport):Promise<SealedDepth>{
  const unsealed={...clone(x),schemaVersion:DEPTH_EXPORT_SCHEMA as typeof DEPTH_EXPORT_SCHEMA,versions:versionsOf()};
  return {...unsealed,contentSha256:await sha256(body(unsealed))};
}

const isObj=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
/** The profile as the user's CSV text, rebuilt from each row's raw cells in the profile column order. */
function profileText(p:Profile):string{
  const q=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`;
  return [PROFILE_COLUMNS.join(','),...p.rows.map(r=>PROFILE_COLUMNS.map(c=>q(r.raw?.[c])).join(','))].join('\n')+'\n';
}

export async function verifyDepth(s:SealedDepth):Promise<SealedDepth>{
  const fail=(why='recompute before export')=>new Error(STALE+why);
  try{
    if(!/^[a-f0-9]{64}$/.test(s?.contentSha256??'')||s.schemaVersion!==DEPTH_EXPORT_SCHEMA)throw fail('unknown schema or missing digest; recompute before export');
    // Integrity: the stored body must hash exactly to the stored digest.
    if(await sha256(body(s))!==s.contentSha256)throw fail('content digest does not match; recompute before export');
    if(!isObj(s.profile)||!Array.isArray(s.profile.rows)||s.profile.version!==DEPTH_PROFILE_VERSION)throw fail('profile is missing');
    if(!Array.isArray(s.dropped)||!s.dropped.every(d=>isObj(d)&&Number.isInteger(d.row)&&typeof d.wellId==='string'&&Object.keys(d).length===2))throw fail('the dropped list is malformed');
    const c=s.caseRef;
    if(!isObj(c)||Object.keys(c).sort().join(',')!=='contentSha256,methodVersion,schemaVersion'||typeof c.schemaVersion!=='string'||typeof c.methodVersion!=='string'||!(c.contentSha256===null||/^[a-f0-9]{64}$/.test(String(c.contentSha256))))throw fail('the case reference is malformed');
    if(!Array.isArray(s.sources)||!isObj(s.selection)||!Array.isArray(s.selection.wellIds)||s.sources.length!==s.selection.wellIds.length)throw fail('sources do not match the selected wells');

    // Profile: re-run the row validation by re-serialising each row's raw cells through parseDepthProfile; the stored fields must match.
    const rows=s.profile.rows;
    let reparsed:Profile={version:DEPTH_PROFILE_VERSION,rows:[]};
    if(rows.length>0){
      reparsed=parseDepthProfile(profileText(s.profile));
      if(reparsed.rows.length!==rows.length)throw fail('profile rows differ from their raw text');
    }
    let last=0;
    rows.forEach((r,i)=>{
      if(!Number.isInteger(r.row)||r.row<=last)throw fail('profile row numbers are not increasing');
      last=r.row;
      if(!sameWithin(clone({...r,row:0}),clone({...reparsed.rows[i],row:0})))throw fail('a profile row differs from its raw text');
    });

    // Sources: every curve point is recomputed for that well only; the stored point is never trusted.
    for(const src of s.sources){
      if(!isObj(src)||typeof src.wellId!=='string'||!isObj(src.well)||src.well.id!==src.wellId||!isObj(src.fluid)||!Number.isFinite(src.onstreamStbd))throw fail('a curve source is malformed');
      const point=caseHydraulicPoint({fluid:src.fluid,hydraulics:src.hydraulics??undefined},src.well,src.onstreamStbd);
      if(!sameWithin(clone(point),clone(src.point)))throw fail('a curve source point differs from its recomputation');
    }

    // Context: rebuilt from the verified profile, the verified sources and the selection.
    const context=buildDepthContext(s.profile,s.sources,s.selection);
    const rebuilt=await sealDepth({profile:s.profile,dropped:s.dropped,sources:s.sources,selection:s.selection,caseRef:s.caseRef,context});
    // Recomputation: structural match, numbers within relative tolerance (the digests may differ across engines).
    const {contentSha256:_a,...storedBody}=s,{contentSha256:_b,...rebuiltBody}=rebuilt;
    if(!sameWithin(clone(rebuiltBody),clone(storedBody)))throw fail();
    return s;
  }catch(e){
    if(e instanceof Error&&e.message.startsWith(STALE))throw e;
    throw fail();
  }
}
export const depthJson=(s:SealedDepth)=>JSON.stringify(s,null,2)+'\n';
export const depthSvg=(s:SealedDepth):string=>depthContextSvg(s.context,depthJson(s));

/** Verifies the JSON embedded in <metadata>, regenerates the drawing from it and requires byte equality with the given SVG. */
export async function verifyDepthSvg(svg:string):Promise<SealedDepth>{
  const fail=(why='recompute before export')=>new Error(STALE+why);
  try{
    if(typeof svg!=='string')throw fail('the drawing is not text');
    const m=/<metadata>([\s\S]*?)<\/metadata>/.exec(svg);
    if(!m)throw fail('the drawing carries no export data');
    const s=await verifyDepth(JSON.parse(unescapeMetadata(m[1])) as SealedDepth);
    if(depthSvg(s)!==svg)throw fail('the drawing differs from the one regenerated from its export data');
    return s;
  }catch(e){
    if(e instanceof Error&&e.message.startsWith(STALE))throw e;
    throw fail();
  }
}

const cell=(v:unknown)=>{
  if(v===null||v===undefined)return '"unavailable"';
  if(typeof v==='number')return `"${v}"`;
  let s=typeof v==='object'?JSON.stringify(v):String(v);
  s=s.replace(/\r\n|\r|\n/g,' ');
  if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
};
const stations=(v:unknown)=>v===null||v===undefined?null:(v as {mdFt:number;tvdFt:number}[]).map(p=>`MD ${p.mdFt} / TVD ${p.tvdFt}`).join(' to ');
/** The 4-column long format. A null is "unavailable", never 0. Every row of the profile is listed with its placement or gap reason. */
export function depthCsv(s:SealedDepth):string{
  const rows:unknown[][]=[['section','rule_or_well','field','value']];
  const sel=s.selection,sec='selection';
  rows.push([sec,'view','month',sel.month],[sec,'view','scenario',sel.scenario],[sec,'view','display_basis',sel.basis],
    [sec,'view','reference_depth_ft',sel.referenceDepthFt],[sec,'view','reference_pressure_psia',sel.referencePressurePsia]);
  sel.wellIds.forEach((w,i)=>rows.push([sec,'view',`well ${i+1}`,w]));
  for(const src of s.sources){
    rows.push([sec,src.wellId,'onstream_stbd',src.onstreamStbd],[sec,src.wellId,'hydraulics',src.hydraulics??'not set (uniform brine model)'],
      [sec,src.wellId,'fluid',src.fluid],[sec,src.wellId,'case_well',src.well]);
  }
  rows.push(['case-ref','case','schema_version',s.caseRef.schemaVersion],['case-ref','case','method_version',s.caseRef.methodVersion],['case-ref','case','content_sha256',s.caseRef.contentSha256]);
  const placed=new Map<number,{wellId:string;placement:DepthContext['tracks'][number]['items'][number]['placement']}>();
  for(const t of s.context.tracks)for(const i of t.items)placed.set(i.row.row,{wellId:t.wellId,placement:i.placement});
  for(const r of s.profile.rows){
    const f=(k:string,v:unknown)=>{if(v!==null&&v!==undefined)rows.push(['rows',r.wellId,`row ${r.row} ${k}`,v]);};
    f('kind',r.kind);f('content_class',r.contentClass);f('source_ref',r.sourceRef);f('depth_basis',r.basis);f('top_depth_ft',r.topFt);f('bottom_depth_ft',r.bottomFt);
    f('md_ft',r.mdFt);f('tvd_ft',r.tvdFt);f('reference',r.reference);f('wellhead_below_reference_ft',r.wellheadBelowReferenceFt);f('size_in',r.sizeIn);f('label',r.label);
    f('pressure_psi',r.pressurePsi);f('pressure_basis',r.pressureBasis);f('test_date',r.testDate);f('test_type',r.testType);f('bottom_source_ref',r.bottomSourceRef);
    const p=placed.get(r.row);
    if(r.kind==='survey'||r.kind==='depth-reference')f('placement','input, not placed');
    else if(!p||!sel.wellIds.includes(r.wellId))f('placement','well not selected');
    else if(p.placement.status==='gap')rows.push(['rows',r.wellId,`row ${r.row} placement`,'gap'],['rows',r.wellId,`row ${r.row} gap_reason`,p.placement.reason]);
    else{
      const pl=p.placement;
      rows.push(['rows',r.wellId,`row ${r.row} placement`,'placed'],['rows',r.wellId,`row ${r.row} placed_top_ft`,pl.topFt],['rows',r.wellId,`row ${r.row} placed_bottom_ft`,pl.bottomFt]);
      if(pl.pressurePsia!==undefined)rows.push(['rows',r.wellId,`row ${r.row} pressure_psia`,pl.pressurePsia]);
      if(pl.conversion)rows.push(['rows',r.wellId,`row ${r.row} conversion_from`,pl.conversion.from],['rows',r.wellId,`row ${r.row} conversion_stations`,stations(pl.conversion.stations)],
        ['rows',r.wellId,`row ${r.row} conversion_top_stations`,stations(pl.conversion.topStations)]);
    }
  }
  for(const t of s.context.tracks){
    const cn='curve-nodes',cs='curve-notes',w=t.wellId,c=t.curve;
    if(t.reference)rows.push([cn,w,'depth_reference',t.reference.name],[cn,w,'wellhead_below_reference_ft',t.reference.wellheadBelowReferenceFt]);
    if(c.status==='gap'){rows.push([cn,w,'status','gap'],[cn,w,'gap_reason',c.reason]);}
    else{
      rows.push([cn,w,'status','drawn'],[cn,w,'label',CURVE_LABEL],[cn,w,'model',c.model],[cn,w,'flagged',c.flagged],[cn,w,'rate_stbd',c.rateStbd],
        [cn,w,'limit_depth_ft',c.limitMarker.depthFt],[cn,w,'limit_pressure_psia',c.limitMarker.pressurePsia],[cn,w,'limit_label',c.limitMarker.label]);
      c.nodes.forEach((nd,i)=>rows.push([cn,w,`node ${i+1} md_ft`,nd.mdFt],[cn,w,`node ${i+1} tvd_ft`,nd.tvdFt],[cn,w,`node ${i+1} depth_ft`,nd.depthFt],[cn,w,`node ${i+1} pressure_psia`,nd.pressurePsia]));
      c.reasons.forEach((x,i)=>rows.push([cs,w,`reason ${i+1}`,x]));
      c.notes.forEach((x,i)=>rows.push([cs,w,`note ${i+1}`,x]));
    }
    rows.push([cs,w,'survey_note',t.surveyNote]);
  }
  for(const d of s.dropped)rows.push(['dropped',d.wellId,`row ${d.row}`,DROPPED]);
  rows.push(['review-aid','export','review_aid',s.context.reviewAid],['review-aid','export','test_label',TEST_LABEL],['review-aid','export','test_date_note',s.context.testDateNote]);
  rows.push(['metadata','export','schema',s.schemaVersion],...Object.entries(s.versions).map(([k,v])=>['metadata','export',`version ${k}`,v]),['metadata','export','contentSha256',s.contentSha256]);
  return rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
