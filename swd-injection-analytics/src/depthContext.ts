/** E11 depth view (review aid): places user-supplied depth evidence on an MD or TVD axis
 * and takes each well's modelled pressure curve from the disposal case result.
 * No new pressure calculation, no test-point movement, no guessing across bases. */
import type {DisposalCase,DisposalWell,HydraulicPoint} from './disposalCase.js';
import {toAbsolute} from './wellAssumptions.js';
import type {Profile,ProfileRow} from './depthProfile.js';

export const DEPTH_CONTEXT_VERSION='depth-context/1';
export const REVIEW_AID='Review aid: user-supplied depth evidence beside modelled pressure. Not a calibrated correlation or a regulatory cross-section.';
export const GAP_NO_REFERENCE='wellhead depth below the depth reference not declared';
export const gapNoSurvey=(from:'MD'|'TVD',to:'MD'|'TVD'):string=>`no survey for this well; cannot convert ${from} to ${to}`;
export const GAP_OUTSIDE_SURVEY='outside the survey range';
export const GAP_HORIZONTAL='the survey is horizontal here; this TVD has more than one MD';
export const GAP_BASIS_UNKNOWN='depth basis not stated';
export const GAP_PRESSURE_BASIS='pressure basis not stated';
export const GAP_SHUT_IN='shut in this month; no modelled curve';
export const DROPPED='dropped: well no longer in the case';
export const LIMIT_LABEL='declared bottomhole maximum at the pressure datum (case input)';
export const CURVE_DEPTH_NOTE="modelled depths follow the case's declared MD and TVD, not the survey";
export const UNIFORM_NOTE='uniform brine model: a straight line from the required wellhead pressure to the bottomhole pressure at the declared pressure datum, exact for this model under the straight-slope assumption';
export const TEST_DATE_NOTE='test dates differ from the modelled month; a test is evidence, not a check of the curve';
export const surveyNote=(n:number):string=>`survey TVD at the case's pressure datum differs from the case TVD by ${Math.round(n)} ft; the curve is not moved`;
export const EXAMPLE_LABEL='fictional example — not typical values';
export const EXAMPLE_ONLY_DEMO='The fictional example is only for the demo case.';
const SURVEY_NOTE_THRESHOLD_FT=10;
const MAX_SELECTED_WELLS=4;

export type Scenario='base'|'compared';
export type CurveSource={wellId:string;well:DisposalWell;fluid:DisposalCase['inputs']['fluid'];hydraulics:DisposalCase['inputs']['hydraulics']|null;onstreamStbd:number;point:HydraulicPoint};
type Basis='MD'|'TVD';
type Station={mdFt:number;tvdFt:number};
type Conversion=null|{from:Basis;stations:[Station,Station]};
export type Placement={status:'placed';topFt:number;bottomFt:number|null;conversion:Conversion;pressurePsia?:number}|{status:'gap';reason:string};
export type CurveNode={mdFt:number;tvdFt:number;depthFt:number;pressurePsia:number};
export type Curve={status:'drawn';model:'segmented'|'uniform';nodes:CurveNode[];flagged:boolean;reasons:string[];rateStbd:number;limitMarker:{depthFt:number;pressurePsia:number;label:string};notes:string[]}|{status:'gap';reason:string};
export type Track={wellId:string;reference:{name:string;wellheadBelowReferenceFt:number}|null;items:{row:ProfileRow;placement:Placement}[];curve:Curve;surveyNote:string|null};
export type DepthSelection={wellIds:string[];basis:Basis;scenario:Scenario;month:string;referenceDepthFt:number|null;referencePressurePsia:number|null};
export type DepthContext={version:typeof DEPTH_CONTEXT_VERSION;selection:DepthSelection;tracks:Track[];axisMaxFt:number;reviewAid:typeof REVIEW_AID;testDateNote:typeof TEST_DATE_NOTE};

function checkScenario(scenario:string):void {
  if(scenario!=='base'&&scenario!=='compared')throw Error(`Unknown scenario "${String(scenario)}"`);
}

/** The well as one scenario evaluates it; the compared scenario applies the comparison exactly as buildDisposalCase does. */
export function scenarioWell(result:DisposalCase,scenario:Scenario,wellId:string):DisposalWell {
  checkScenario(scenario);
  const w=result.inputs.wells.find(x=>x.id===wellId);
  if(!w)throw Error(`Well ${wellId} is not in the case`);
  const c=result.inputs.comparison;
  if(scenario==='compared'&&c.wellId===wellId)return {...w,injectivityStbdPerPsi:w.injectivityStbdPerPsi*c.injectivityMultiplier,innerDiameterInches:c.innerDiameterInches,availability:c.availability};
  return {...w};
}

export function curveSources(result:DisposalCase,scenario:Scenario,month:string,wellIds:readonly string[]):CurveSource[] {
  checkScenario(scenario);
  const m=result[scenario].monthly.find(x=>x.month===month);
  if(!m)throw Error(`Month ${month} is not in the case`);
  return wellIds.map(wellId=>{
    const a=m.allocations.find(x=>x.wellId===wellId);
    if(!a)throw Error(`Well ${wellId} is not in the case`);
    return {wellId,well:scenarioWell(result,scenario,wellId),fluid:result.inputs.fluid,hydraulics:result.inputs.hydraulics??null,onstreamStbd:a.onstreamStbd,point:a.hydraulics};
  });
}

function stationsOf(wellRows:readonly ProfileRow[],wellId:string):Station[] {
  return wellRows.filter(r=>r.wellId===wellId&&r.kind==='survey'&&r.mdFt!==null&&r.tvdFt!==null)
    .map(r=>({mdFt:r.mdFt!,tvdFt:r.tvdFt!})).sort((a,b)=>a.mdFt-b.mdFt);
}

/** Converts one depth value between bases; a string is the gap reason. */
function convert(value:number,from:Basis,st:readonly Station[]):{value:number;stations:[Station,Station]}|string {
  const get=(s:Station)=>from==='MD'?s.mdFt:s.tvdFt,out=(s:Station)=>from==='MD'?s.tvdFt:s.mdFt;
  if(value<get(st[0])||value>get(st[st.length-1]))return GAP_OUTSIDE_SURVEY;
  let hit:[Station,Station]|null=null;
  for(let i=0;i+1<st.length;i++) {
    const lo=st[i],hi=st[i+1];
    if(value<get(lo)||value>get(hi))continue;
    // A TVD inside (or on the edge of) a flat stretch has more than one MD: never pick the first.
    if(from==='TVD'&&lo.tvdFt===hi.tvdFt)return GAP_HORIZONTAL;
    if(hit===null)hit=[lo,hi];
  }
  if(hit===null)return GAP_OUTSIDE_SURVEY;
  const [lo,hi]=hit;
  if(value===get(lo))return {value:out(lo),stations:hit};
  if(value===get(hi))return {value:out(hi),stations:hit};
  return {value:out(lo)+(value-get(lo))/(get(hi)-get(lo))*(out(hi)-out(lo)),stations:hit};
}

/** Places one evidence row on the display basis, or gives the reason it cannot be placed.
 * A casing runs from its top (the depth reference when none is given) to its shoe. A recorded
 * conversion holds the stations that bracket the deepest converted value of the row. */
export function placeRow(row:ProfileRow,basis:Basis,wellRows:readonly ProfileRow[]):Placement {
  if(basis!=='MD'&&basis!=='TVD')throw Error(`Unknown depth basis "${String(basis)}"`);
  if(!wellRows.some(r=>r.wellId===row.wellId&&r.kind==='depth-reference'&&r.wellheadBelowReferenceFt!==null))return {status:'gap',reason:GAP_NO_REFERENCE};
  const rb=row.basis??'unknown';
  if(rb==='unknown')return {status:'gap',reason:GAP_BASIS_UNKNOWN};
  const implicitTop=row.kind==='casing'&&row.topFt===null;
  const top=implicitTop?0:row.topFt,bottom=row.bottomFt;
  if(top===null&&bottom===null)return {status:'gap',reason:GAP_OUTSIDE_SURVEY};
  let topFt:number,bottomFt:number|null,conversion:Conversion=null;
  if(rb===basis) {
    topFt=top??bottom!;bottomFt=top===null?null:bottom;
  } else {
    const st=stationsOf(wellRows,row.wellId);
    if(st.length<2)return {status:'gap',reason:gapNoSurvey(rb,basis)};
    // The depth reference itself (implicit casing top) needs no conversion.
    const t=top===null?null:implicitTop?{value:0,stations:null}:convert(top,rb,st);
    const b=bottom===null?null:convert(bottom,rb,st);
    if(typeof t==='string')return {status:'gap',reason:t};
    if(typeof b==='string')return {status:'gap',reason:b};
    topFt=t?t.value:b!.value;bottomFt=t&&b?b.value:null;
    const stations=(b??t)?.stations??t?.stations??null;
    if(stations)conversion={from:rb,stations};
  }
  const p:Placement={status:'placed',topFt,bottomFt,conversion};
  if(row.kind==='test-point') {
    if(row.pressureBasis===null||row.pressurePsi===null)return {status:'gap',reason:GAP_PRESSURE_BASIS};
    p.pressurePsia=toAbsolute(row.pressurePsi,row.pressureBasis);
  }
  return p;
}

function buildCurve(src:CurveSource,basis:Basis,offset:number|null):Curve {
  if(offset===null)return {status:'gap',reason:GAP_NO_REFERENCE};
  const pt=src.point;
  if(pt.status==='shut-in')return {status:'gap',reason:GAP_SHUT_IN};
  if(pt.status==='unsupported')return {status:'gap',reason:pt.reasons.join(' ')};
  const depthOf=(md:number,tvd:number)=>(basis==='MD'?md:tvd)+offset;
  const notes:string[]=[CURVE_DEPTH_NOTE];
  let nodes:CurveNode[],model:'segmented'|'uniform';
  if(src.hydraulics!==null) {
    if(!pt.traverse)return {status:'gap',reason:'modelled traverse not available for this month'};
    model='segmented';
    nodes=pt.traverse.points.map(n=>({mdFt:n.measuredDepthFt+offset,tvdFt:n.tvdFt+offset,depthFt:depthOf(n.measuredDepthFt,n.tvdFt),pressurePsia:n.pressurePsia}));
  } else {
    if(pt.requiredSurfacePsia===null||pt.bottomholePsia===null)return {status:'gap',reason:'modelled pressure not available for this month'};
    model='uniform';notes.push(UNIFORM_NOTE);
    const w=src.well;
    nodes=[{mdFt:offset,tvdFt:offset,depthFt:offset,pressurePsia:pt.requiredSurfacePsia},
      {mdFt:w.measuredDepthFt+offset,tvdFt:w.tvdFt+offset,depthFt:depthOf(w.measuredDepthFt,w.tvdFt),pressurePsia:pt.bottomholePsia}];
  }
  return {status:'drawn',model,nodes,flagged:!pt.operatingFeasible,reasons:[...pt.reasons],rateStbd:pt.rateStbd,
    limitMarker:{depthFt:depthOf(src.well.measuredDepthFt,src.well.tvdFt),pressurePsia:src.well.limitPsia,label:LIMIT_LABEL},notes};
}

function buildSurveyNote(src:CurveSource,offset:number|null,st:readonly Station[]):string|null {
  if(offset===null||st.length<2)return null;
  const c=convert(src.well.measuredDepthFt+offset,'MD',st);
  if(typeof c==='string')return null;
  const diff=Math.abs(c.value-(src.well.tvdFt+offset));
  return diff>SURVEY_NOTE_THRESHOLD_FT?surveyNote(diff):null;
}

export function buildDepthContext(profile:Profile,sources:readonly CurveSource[],selection:DepthSelection):DepthContext {
  const ids=selection.wellIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>MAX_SELECTED_WELLS)throw Error(`Select 1–${MAX_SELECTED_WELLS} wells`);
  if(new Set(ids).size!==ids.length)throw Error('Selected wells must be distinct');
  if(selection.basis!=='MD'&&selection.basis!=='TVD')throw Error(`Unknown depth basis "${String(selection.basis)}"`);
  checkScenario(selection.scenario);
  for(const v of [selection.referenceDepthFt,selection.referencePressurePsia])if(v!==null&&!Number.isFinite(v))throw Error('Reference depth and pressure must be finite or null');
  const tracks:Track[]=ids.map(wellId=>{
    const src=sources.find(s=>s.wellId===wellId);
    if(!src)throw Error(`No curve source for well ${wellId}`);
    const wellRows=profile.rows.filter(r=>r.wellId===wellId);
    const ref=wellRows.find(r=>r.kind==='depth-reference'&&r.wellheadBelowReferenceFt!==null);
    const offset=ref?ref.wellheadBelowReferenceFt:null;
    const items=wellRows.filter(r=>r.kind!=='survey'&&r.kind!=='depth-reference').map(row=>({row,placement:placeRow(row,selection.basis,wellRows)}));
    return {wellId,reference:ref?{name:ref.reference??'',wellheadBelowReferenceFt:ref.wellheadBelowReferenceFt!}:null,items,
      curve:buildCurve(src,selection.basis,offset),surveyNote:buildSurveyNote(src,offset,stationsOf(wellRows,wellId))};
  });
  let axisMaxFt=0;
  for(const t of tracks) {
    for(const {placement:p} of t.items)if(p.status==='placed')axisMaxFt=Math.max(axisMaxFt,p.topFt,p.bottomFt??0);
    if(t.curve.status==='drawn')for(const n of t.curve.nodes)axisMaxFt=Math.max(axisMaxFt,n.depthFt);
  }
  return {version:DEPTH_CONTEXT_VERSION,selection:{...selection,wellIds:[...ids]},tracks,axisMaxFt,reviewAid:REVIEW_AID,testDateNote:TEST_DATE_NOTE};
}
