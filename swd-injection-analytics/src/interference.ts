// #8 (ANA-E07) interference screening: rank user-listed offset wells by the pressure each adds at the subject well (#7).
// Display only: reads the disposal case through #7 and never feeds back into it. Never decides connectivity.
// Rock and fluid are the subject's (#7). Offsets use the plain line source at the typed distance: no skin, no wellbore guard.
// Reported bbl/day is treated as STB/day with Bw from the subject's fluid.
// Time base: one absolute calendar clock (hours = calendar days x 24 since 1970-01-01 UTC, exact integers). The subject's
// month ends are its #7 endHours shifted to that clock; every value is evaluated at a month end.
// An offset schedule is never evaluated past its throughMonth (riseFromSteps would hold the last rate forever).
import {type Rock,lineSourceRise,riseFromSteps,radiusOfInvestigation,TRANSIENT_MODEL_VERSION} from './transientModel.js';
import {buildTransientCase,TRANSIENT_CASE_VERSION,PVT_BLOCK,type TransientInput,type TransientResult} from './transientCase.js';
import {offsetSchedule,OFFSET_HISTORY_VERSION,type OffsetChoices,type OffsetSchedule} from './offsetHistory.js';
import {joinedHistory,uics,HISTORY_PACKAGES_VERSION,type PackageSet} from './historyPackages.js';
import type {DisposalCase} from './disposalCase.js';
import {fmtNumber} from './caseSummary.js';

export const INTERFERENCE_VERSION='interference-screening/1';
export const CLOSING_8='Screening ranking from assumed reservoir properties and typed distances; closeness is not connectivity.';
export const RANKING_LABEL='screening ranking under the stated assumptions; not a pressure forecast';
export const EXCLUDED='excluded by assumption';
/** A row in the "none" view: the subject alone, so no offset is counted (not the user's choice, so never EXCLUDED). */
export const NOT_COUNTED='not counted in this view (subject alone)';
export const PARTIAL_NOTE_DIRECTION='includes partial-history wells; direction unknown';
export const PARTIAL_NOTE_LOWER='includes partial-history wells; lower bound';
export const SHARE_NOTE='share not shown: mixed signs';
export const REMOVAL_LABEL='limit month with each offset removed: one at a time; not additive';
export const INDISTINGUISHABLE='order not distinguishable';
export const NO_EDGE_WARNING='interference uses the no-edge assumption';
export const CONNECTED_LABEL='connected (assumed)';
export const PVT_HIGH_PSIA=10000;
export const BBL_AS_STB='reported bbl/day treated as STB/day; Bw from the subject\'s fluid';
export const MAX_OFFSETS=10;
export type InterferenceInput={subject:TransientInput;tRef:string|null;rankingMonth:string;offsets:OffsetChoices[];
  sensitivity:{k?:{low:number;high:number};cf?:{low:number;high:number};distance?:Record<string,{low:number;high:number}>}};
export type OffsetRow={uic:string;status:'complete'|'incomplete'|'partial-history'|'not-felt-yet'|'excluded'|'not-counted';addedPsi:number|null;share:number|null;
  distanceFt:number;directionUnknown:boolean;lowerBound:boolean;labels:string[]};
export type View={name:'all-connected'|'your-selection'|'none';status:'complete'|'incomplete';rows:OffsetRow[];totalPsi:number|null;shareNote:string|null;
  limitMonth:string|null;removalEffects:{uic:string;limitMonth:string|null;note:string|null}[];notes:string[];
  monthly:{month:string;ownRisePsi:number|null;offsetsPsi:number|null;bottomholePsia:number|null;blocked:string|null}[]};
export type InterferenceResult={inputs:InterferenceInput;mode:'since-t-ref'|'rise-above-undisturbed';views:View[];
  sensitivity:{factor:string;rankChanged:boolean;rangeByUic:Record<string,{low:number|null;high:number|null}>}[];
  indistinguishable:[string,string][];warnings:string[];labels:string[];assumptions:string[];closing:string;versions:Record<string,string>};

const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
const DIST_MAX=264000;
const K_BOUND={min:0.01,max:10000,text:'0.01 and 10,000 md'},CF_BOUND={min:1e-7,max:1e-4,text:'1e-7 and 1e-4 /psi'};
const index=(m:string)=>Number(m.slice(0,4))*12+Number(m.slice(5,7))-1;
const fromIndex=(i:number)=>`${String(Math.floor(i/12)).padStart(4,'0')}-${String(i%12+1).padStart(2,'0')}`;
/** Hours from 1970-01-01 UTC to the start of the month (calendar days x 24; exact integer). */
const startHours=(m:string)=>Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7))-1,1)/3600000;
const endHours=(m:string)=>startHours(fromIndex(index(m)+1));
const isNum=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const isObj=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const msgOf=(e:unknown)=>e instanceof Error?e.message:String(e);
const ftText=(v:number)=>fmtNumber(v,v<10?2:0);
const distanceLabel=(d:number)=>`distance ${ftText(d)} ft (assumed, typed)`;

/** The last month covered by every loaded package (the earliest joined-window end across UICs). */
export function defaultRankingMonth(set:PackageSet):string{
  const ends=uics(set).map(u=>joinedHistory(set,u).window.endMonth).sort();
  if(!ends.length) throw new Error('No packages are loaded');
  return ends[0];
}

/** The pre-run t_ref checks (the panel lists the same words before Run): the subject's schedule starts the month after t_ref,
 * and the ranking month is after t_ref. [] without t_ref or with a malformed month (validate reports those itself). */
export function tRefMessages(tRef:string|null,firstMonth:string|null|undefined,rankingMonth:string|null|undefined):string[]{
  if(typeof tRef!=='string'||!MONTH.test(tRef)) return [];
  const out:string[]=[],want=fromIndex(index(tRef)+1);
  if(firstMonth!==want) out.push(`The subject's rate schedule must start the month after the pressure-as-of month t_ref (${tRef}): expected ${want}, got ${String(firstMonth)}`);
  if(typeof rankingMonth==='string'&&MONTH.test(rankingMonth)&&index(rankingMonth)<=index(tRef)) out.push(`Ranking month ${rankingMonth} must be after the pressure-as-of month t_ref (${tRef})`);
  return out;
}

type AbsStep={startHours:number;rateStbd:number};
type Offset={c:OffsetChoices;rank:OffsetSchedule|null;rankError:string|null;steps:AbsStep[];
  seriesSteps:AbsStep[]|null;seriesNote:string|null};

function riseAt(rock:Rock,d:number,steps:readonly AbsStep[],T:number):number{
  return riseFromSteps(t=>lineSourceRise(rock,d,t),steps,T);
}

function validate(result:DisposalCase,set:PackageSet,input:InterferenceInput):{messages:string[];tr:TransientResult|null}{
  const out:string[]=[];
  if(!isObj(input)) return {messages:['Interference inputs are required'],tr:null};
  let tr:TransientResult|null=null;
  try{tr=buildTransientCase(result,input.subject);}catch(e){out.push(`Subject well: ${msgOf(e)}`);}
  const rw=isObj(input.subject)&&isObj(input.subject.rock)&&isNum(input.subject.rock.rw)?input.subject.rock.rw:null;
  const floor=rw===null?null:100*rw;
  const distOk=(v:unknown)=>isNum(v)&&v<=DIST_MAX&&(floor===null||v>=floor);
  const distText=floor===null?`at most ${fmtNumber(DIST_MAX)} ft`:`between 100 · r_w (${ftText(floor)} ft) and ${fmtNumber(DIST_MAX)} ft (50 miles)`;
  const rankOk=typeof input.rankingMonth==='string'&&MONTH.test(input.rankingMonth);
  if(!rankOk) out.push(`Ranking month must be a YYYY-MM month, got ${String(input.rankingMonth)}`);
  const tRefOk=input.tRef===null||(typeof input.tRef==='string'&&MONTH.test(input.tRef));
  if(!tRefOk) out.push(`Pressure-as-of month (t_ref) must be a YYYY-MM month or empty, got ${String(input.tRef)}`);
  if(tRefOk&&input.tRef!==null){
    const first=isObj(input.subject)&&isObj(input.subject.schedule)&&Array.isArray(input.subject.schedule.months)?input.subject.schedule.months[0]?.month:undefined;
    out.push(...tRefMessages(input.tRef,first,rankOk?input.rankingMonth:null));
  }
  const loaded=uics(set);
  if(!Array.isArray(input.offsets)||input.offsets.length<1||input.offsets.length>MAX_OFFSETS) out.push(`Choose 1–${MAX_OFFSETS} offset wells`);
  const seen=new Set<string>();
  for(const c of Array.isArray(input.offsets)?input.offsets:[]){
    const uic=isObj(c)&&typeof c.uic==='string'?c.uic:String(isObj(c)?c.uic:c);
    if(seen.has(uic)){out.push(`UIC ${uic} is listed more than once`);continue;}
    seen.add(uic);
    if(!loaded.includes(uic)) out.push(`UIC ${uic} has no loaded package`);
    if(!isObj(c)||typeof c.connected!=='boolean') out.push(`UIC ${uic}: choose connected or not connected (there is no default)`);
    if(!isObj(c)||!distOk(c.distanceFt)) out.push(`UIC ${uic}: typed distance must be a number ${distText}`);
  }
  for(const u of loaded) if(!seen.has(u)) out.push(`UIC ${u} is loaded but has no choices (distance; connected or not connected)`);
  // Sensitivity
  const s=input.sensitivity;
  if(!isObj(s)) out.push('Sensitivity must be an object (it may be empty)');
  else for(const [key,value] of Object.entries(s)){
    if(key==='k'||key==='cf'){
      const b=key==='k'?K_BOUND:CF_BOUND,label=key==='k'?'Permeability k':'Formation compressibility c_f';
      for(const side of ['low','high'] as const){
        const v=isObj(value)?value[side]:undefined;
        if(!isNum(v)||v<b.min||v>b.max) out.push(`Sensitivity ${label} ${side} must be a number between ${b.text}`);
      }
      if(isObj(value)&&isNum(value.low)&&isNum(value.high)&&value.low>value.high) out.push(`Sensitivity ${label}: low must not exceed high`);
    }
    else if(key==='distance'){
      if(!isObj(value)){out.push('Sensitivity distance must map UICs to low and high values');continue;}
      for(const [uic,lh] of Object.entries(value)){
        if(!seen.has(uic)){out.push(`Sensitivity distance for UIC ${uic}: that UIC is not an offset well here`);continue;}
        for(const side of ['low','high'] as const){
          const v=isObj(lh)?lh[side]:undefined;
          if(!distOk(v)) out.push(`Sensitivity distance for UIC ${uic} ${side} must be a number ${distText}`);
        }
        if(isObj(lh)&&isNum(lh.low)&&isNum(lh.high)&&lh.low>lh.high) out.push(`Sensitivity distance for UIC ${uic}: low must not exceed high`);
      }
    }
    else out.push(`Sensitivity ${key} is not a supported factor (k, c_f, distance)`);
  }
  return {messages:out,tr};
}

/** Throws Error(messages.join('; ')) when the run is refused. Pure and deterministic; inputs are not modified. */
export function buildInterference(result:DisposalCase,set:PackageSet,input:InterferenceInput):InterferenceResult{
  const v=validate(result,set,input);
  if(v.messages.length) throw new Error(v.messages.join('; '));
  const tr=v.tr!,inputs=structuredClone(input);
  const tRef=inputs.tRef,rank=inputs.rankingMonth,withRef=tRef!==null;
  const rock:Rock={k:inputs.subject.rock.k,h:inputs.subject.rock.h,phi:inputs.subject.rock.phi,ct:tr.fluid.ct,mu:tr.fluid.mu,B:tr.fluid.B};
  const subjMonths=inputs.subject.schedule.months.map(m=>m.month),subjEnd=subjMonths[subjMonths.length-1];
  const T=endHours(rank),R=withRef?endHours(tRef):0;
  const toAbs=(s:OffsetSchedule):AbsStep[]=>s.steps.map(x=>({startHours:startHours(x.month),rateStbd:x.rateStbd}));
  const choices=[...inputs.offsets].sort((a,b)=>a.uic<b.uic?-1:a.uic>b.uic?1:0);

  // Ranking schedules, each built as connected (the all-connected view counts every well).
  const refusals:string[]=[];
  const offsets:Offset[]=choices.map(c=>{
    const asConnected={...c,connected:true};
    let rankSched:OffsetSchedule|null=null,rankError:string|null=null;
    try{rankSched=offsetSchedule(set,asConnected,rank);}
    catch(e){if(c.connected===true) refusals.push(`UIC ${c.uic}: ${msgOf(e)}`);else rankError=msgOf(e);}
    let seriesSteps:AbsStep[]|null=null,seriesNote:string|null=null;
    if(rankSched){
      const wStart=rankSched.windowStart,through=index(subjEnd)<index(wStart)?wStart:subjEnd;
      try{
        const ls=offsetSchedule(set,asConnected,through);
        // When the subject ends before the window starts, only steps before the subject's end matter (none can be gaps).
        if(ls.status==='complete'||through!==subjEnd) seriesSteps=toAbs(ls);
        else seriesNote=`UIC ${c.uic} has no complete schedule through ${subjEnd} (${limitReason(ls,c,subjEnd)})`;
      }catch(e){seriesNote=`UIC ${c.uic}: ${msgOf(e)}`;}
    }
    else seriesNote=`UIC ${c.uic} has no schedule (${rankError})`;
    return {c,rank:rankSched,rankError,steps:rankSched&&rankSched.status==='complete'?toAbs(rankSched):[],seriesSteps,seriesNote};
  });
  if(refusals.length) throw new Error(refusals.join('; '));

  const addedFor=(o:Offset,rk:Rock,d:number)=>riseAt(rk,d,o.steps,T)-(withRef?riseAt(rk,d,o.steps,R):0);
  const numbered=offsets.filter(o=>o.rank?.status==='complete');
  const base=new Map(numbered.map(o=>[o.c.uic,addedFor(o,rock,o.c.distanceFt)]));

  // Rows as connected.
  const asConnectedRow=(o:Offset):OffsetRow=>{
    const d=o.c.distanceFt,labels=[distanceLabel(d)];
    const empty={uic:o.c.uic,distanceFt:d,directionUnknown:false,lowerBound:false,share:null,addedPsi:null};
    if(!o.rank) return {...empty,status:'incomplete',labels:[...labels,`incomplete: ${o.rankError}`]};
    if(o.rank.status!=='complete') return {...empty,status:'incomplete',labels:[...labels,...o.rank.labels,...incompleteLabels(o.rank,o.c,rank)]};
    const partial=o.rank.partialHistory;
    const first=o.rank.steps.find(x=>x.rateStbd>0);
    const t0=first?startHours(first.month):Infinity;
    let felt:string|null=null;
    if(!(t0<T)) felt=`not felt yet: no injection before the end of ${rank}`;
    else{const rinv=radiusOfInvestigation(rock,T-t0);if(d>rinv) felt=`not felt yet: the distance exceeds the radius of investigation (${ftText(rinv)} ft) from first injection to the end of ${rank}`;}
    const out:string[]=[...labels,...o.rank.labels,withRef?`added pressure since ${tRef} (calculated)`:'added rise above undisturbed pressure (calculated)'];
    if(partial) out.push(withRef?'partial history: injection before the window start not included; direction unknown':'partial history: injection before the window start not included; the shown rise is a lower bound');
    if(felt) out.push(felt);
    return {uic:o.c.uic,distanceFt:d,status:partial?'partial-history':felt?'not-felt-yet':'complete',addedPsi:base.get(o.c.uic)!,share:null,
      directionUnknown:partial&&withRef,lowerBound:partial&&!withRef,labels:out};
  };
  const excludedRow=(o:Offset):OffsetRow=>({uic:o.c.uic,status:'excluded',addedPsi:null,share:null,distanceFt:o.c.distanceFt,directionUnknown:false,lowerBound:false,labels:[distanceLabel(o.c.distanceFt),EXCLUDED]});
  const notCountedRow=(o:Offset):OffsetRow=>({...excludedRow(o),status:'not-counted',labels:[distanceLabel(o.c.distanceFt),NOT_COUNTED]});
  const connectedRows=new Map(offsets.map(o=>[o.c.uic,asConnectedRow(o)]));

  // Limit search (t_ref only): P_i + own rise + counted offsets' rise since t_ref, at each subject month end.
  const pi=tr.well.reservoirPsia,limit=tr.well.limitPsia;
  const subjStart=startHours(subjMonths[0]);
  const contrib=new Map<string,number[]>();
  const contribOf=(o:Offset)=>{
    let c=contrib.get(o.c.uic);
    if(!c){
      const steps=o.seriesSteps!,d=o.c.distanceFt,atRef=withRef?riseAt(rock,d,steps,R):0;
      c=tr.monthly.map(m=>riseAt(rock,d,steps,subjStart+m.endHours)-atRef);
      contrib.set(o.c.uic,c);
    }
    return c;
  };
  // With no counted offset the subject is alone, so the answer is #7's own (including a PVT-high block that #7 counts as reached).
  const ownBlock=tr.monthly.find(m=>m.blocked!==null);
  const ownNote=ownBlock?`limit month not determined: the subject's own result is not shown from ${ownBlock.month} (${ownBlock.blocked})`:null;
  const limitSearch=(counted:Offset[]):{month:string|null;note:string|null}=>{
    if(!counted.length) return {month:tr.firstMonthAtLimit,note:tr.limitStatus==='not-determined'?ownNote:null};
    const missing=counted.find(o=>!o.seriesSteps);
    if(missing) return {month:null,note:`limit month not determined: ${missing.seriesNote}`};
    const cs=counted.map(contribOf);
    for(let i=0;i<tr.monthly.length;i++){
      const m=tr.monthly[i];
      if(m.risePsi===null){
        // #7 marks a blocked row as reached only for a block above 10,000 psia (P_subject > 10,000 >= limit there).
        // The total then also reaches the limit when the counted offsets add at least limit - 10,000 (a lower bound on the total).
        if(m.month===tr.firstMonthAtLimit&&cs.reduce((s,c)=>s+c[i],0)>=limit-PVT_HIGH_PSIA) return {month:m.month,note:null};
        return {month:null,note:`limit month not determined: the subject's own result is not shown from ${m.month} (${m.blocked})`};
      }
      const p=pi+m.risePsi+cs.reduce((s,c)=>s+c[i],0);
      if(p>=limit) return {month:m.month,note:null};
      // As #7: below 100 psia the fluid model does not apply, so no later month is read (a low-side block does not cross the limit).
      if(p<100) return {month:null,note:`limit month not determined: the bottomhole pressure with the counted offsets is ${PVT_BLOCK} from ${m.month}`};
    }
    return {month:null,note:null};
  };

  const warnings:string[]=[];
  const makeView=(name:View['name'],counted:Offset[]):View=>{
    const countedSet=new Set(counted.map(o=>o.c.uic));
    const rows=offsets.map(o=>countedSet.has(o.c.uic)?{...connectedRows.get(o.c.uic)!,labels:[CONNECTED_LABEL,...connectedRows.get(o.c.uic)!.labels]}:name==='none'?notCountedRow(o):excludedRow(o));
    const countedRows=rows.filter(r=>r.status!=='excluded'&&r.status!=='not-counted');
    const complete=countedRows.every(r=>r.addedPsi!==null);
    const totalPsi=complete&&countedRows.length?countedRows.reduce((s,r)=>s+(r.addedPsi as number),0):null;
    let shareNote:string|null=null;
    if(complete&&countedRows.length){
      if(countedRows.every(r=>(r.addedPsi as number)>=0)&&(totalPsi as number)>0) for(const r of countedRows) r.share=(r.addedPsi as number)/(totalPsi as number);
      else shareNote=SHARE_NOTE;
    }
    rows.sort(rowOrder);
    let limitMonth:string|null=null,removalEffects:View['removalEffects']=[];
    if(withRef){
      const l=limitSearch(counted);limitMonth=l.month;
      if(l.note) warnings.push(`${name}: ${l.note}`);
      removalEffects=counted.map(o=>{const x=limitSearch(counted.filter(y=>y!==o));return {uic:o.c.uic,limitMonth:x.month,note:x.note===null?null:x.note.replace(/^limit month not determined: /,'')};});
    }
    const notes=countedRows.some(r=>r.directionUnknown)?[PARTIAL_NOTE_DIRECTION]:countedRows.some(r=>r.lowerBound)?[PARTIAL_NOTE_LOWER]:[];
    // Monthly series at each subject month end. Null is never 0: no counted offset or an incomplete one gives offsetsPsi null.
    const seriesOk=counted.every(o=>o.seriesSteps);
    const cs=seriesOk?counted.map(contribOf):null;
    // As #7: from the first month the absolute pressure leaves 100–10,000 psia, it is not shown for that month and every later one.
    let pvtBlocked=false;
    const monthly=tr.monthly.map((m,i)=>{
      let offsetsPsi=counted.length&&cs?cs.reduce((s,c)=>s+c[i],0):null;
      let bottomholePsia=withRef&&m.risePsi!==null&&seriesOk?pi+m.risePsi+(offsetsPsi===null?0:offsetsPsi):null;
      if(bottomholePsia!==null&&(bottomholePsia<100||bottomholePsia>PVT_HIGH_PSIA)) pvtBlocked=true;
      // A view-blocked month shows no offsets rise either, so the hidden absolute value cannot be recovered from the row.
      if(pvtBlocked){bottomholePsia=null;if(m.blocked===null)offsetsPsi=null;}
      return {month:m.month,ownRisePsi:m.risePsi,offsetsPsi,bottomholePsia,blocked:m.blocked??(pvtBlocked?PVT_BLOCK:null)};
    });
    return {name,status:complete?'complete':'incomplete',rows,totalPsi,shareNote,limitMonth,removalEffects,notes,monthly};
  };
  const views=[makeView('all-connected',offsets),makeView('your-selection',offsets.filter(o=>o.c.connected===true)),makeView('none',[])];

  // Sensitivity: one at a time over the numbered (complete, as-connected) wells.
  const orderOf=(m:Map<string,number>)=>[...m.entries()].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0)).map(e=>e[0]).join(',');
  const baseOrder=orderOf(base);
  const factors:{factor:string;at:(v:number)=>Map<string,number>;low:number;high:number}[]=[];
  const sens=inputs.sensitivity;
  if(sens.k) factors.push({factor:'k',low:sens.k.low,high:sens.k.high,at:k=>new Map(numbered.map(o=>[o.c.uic,addedFor(o,{...rock,k},o.c.distanceFt)]))});
  if(sens.cf) factors.push({factor:'cf',low:sens.cf.low,high:sens.cf.high,at:cf=>new Map(numbered.map(o=>[o.c.uic,addedFor(o,{...rock,ct:tr.fluid.cw+cf},o.c.distanceFt)]))});
  for(const uic of Object.keys(sens.distance??{}).sort()){
    const lh=sens.distance![uic];
    factors.push({factor:`distance:${uic}`,low:lh.low,high:lh.high,at:d=>new Map(numbered.map(o=>[o.c.uic,o.c.uic===uic?addedFor(o,rock,d):base.get(o.c.uic)!]))});
  }
  const pairs=new Set<string>();
  const sensitivity=factors.map(f=>{
    const lo=f.at(f.low),hi=f.at(f.high);
    const rangeByUic:Record<string,{low:number|null;high:number|null}>={};
    for(const o of offsets){
      const u=o.c.uic;
      rangeByUic[u]=base.has(u)?{low:Math.min(base.get(u)!,lo.get(u)!,hi.get(u)!),high:Math.max(base.get(u)!,lo.get(u)!,hi.get(u)!)}:{low:null,high:null};
    }
    const nums=numbered.map(o=>o.c.uic);
    for(let i=0;i<nums.length;i++)for(let j=i+1;j<nums.length;j++){
      const a=rangeByUic[nums[i]],b=rangeByUic[nums[j]];
      if((a.low as number)<=(b.high as number)&&(b.low as number)<=(a.high as number)) pairs.add(`${nums[i]}|${nums[j]}`);
    }
    return {factor:f.factor,rankChanged:orderOf(lo)!==baseOrder||orderOf(hi)!==baseOrder,rangeByUic};
  });
  const indistinguishable=[...pairs].sort().map(p=>p.split('|') as [string,string]);

  // Warnings
  const head:string[]=[];
  if(inputs.subject.boundary.kind==='closed') head.push(NO_EDGE_WARNING);
  const b=inputs.subject.boundary;
  if(b.kind==='infinite'&&b.statedExtentFt!==null){
    for(const o of offsets){
      if(!o.rank) continue;
      const first=o.rank.steps.find(x=>x.rateStbd>0);
      if(!first||!(startHours(first.month)<T)) continue;
      if(radiusOfInvestigation(rock,T-startHours(first.month))>=b.statedExtentFt)
        head.push(`UIC ${o.c.uic}: results assume no edge, but pressure from this well has reached the extent you stated (${fmtNumber(b.statedExtentFt)} ft) by the end of ${rank}${o.c.connected?'':' (counted in all-connected only)'}`);
    }
  }
  for(const [a,c] of indistinguishable) head.push(`UICs ${a} and ${c}: ${INDISTINGUISHABLE} (their added-psi ranges overlap under the sensitivity values)`);

  const labels=[
    RANKING_LABEL,
    withRef?`added pressure since the end of ${tRef} (calculated); absolute pressures psia bottomhole-absolute at the subject's declared datum`
      :'rise above undisturbed pressure (calculated); no absolute pressure, limit line or limit month without a pressure-as-of month',
    ...(withRef?[`pressure as of ${tRef} (assumed)`,REMOVAL_LABEL]:[]),
  ];
  const assumptions=[
    'One shared, homogeneous, infinite-acting layer, with the subject\'s (#7) k, h, φ and c_f.',
    'Fluid properties from the subject well\'s disposal case.',
    'Every connected well injects into that same layer.',
    'Single-phase, slightly compressible flow.',
    'Linear superposition in space and time.',
    BBL_AS_STB,
    'Offset contributions use the plain line source at the typed distance, with no skin and no wellbore time guard; skin applies at the subject wellbore only.',
    'Distances and connected or not connected are the user\'s assumptions; the tool does not decide connectivity.',
    ...(withRef?[`The subject's reservoir pressure is taken as of ${tRef} (t_ref); offset rises are counted since the end of that month, so injection already inside that pressure is not counted again.`,
      'The subject\'s own injection before t_ref is not modelled.']:[]),
  ];
  return {inputs,mode:withRef?'since-t-ref':'rise-above-undisturbed',views,sensitivity,indistinguishable,warnings:[...head,...warnings],labels,assumptions,closing:CLOSING_8,
    versions:{interference:INTERFERENCE_VERSION,transientCase:TRANSIENT_CASE_VERSION,transientModel:TRANSIENT_MODEL_VERSION,offsetHistory:OFFSET_HISTORY_VERSION,
      historyPackages:HISTORY_PACKAGES_VERSION,disposalCase:result.methodVersion}};
}

const STATUS_ORDER:Record<OffsetRow['status'],number>={complete:0,'partial-history':0,'not-felt-yet':0,incomplete:1,excluded:2,'not-counted':2};
function rowOrder(a:OffsetRow,b:OffsetRow):number{
  const an=a.addedPsi!==null,bn=b.addedPsi!==null;
  if(an&&bn) return (b.addedPsi as number)-(a.addedPsi as number)||(a.uic<b.uic?-1:a.uic>b.uic?1:0);
  if(an!==bn) return an?-1:1;
  return STATUS_ORDER[a.status]-STATUS_ORDER[b.status]||(a.uic<b.uic?-1:a.uic>b.uic?1:0);
}
function unfilledGaps(s:OffsetSchedule,c:OffsetChoices):string[]{return s.gapMonths.filter(m=>typeof c.gapRates[m]!=='number');}
function incompleteLabels(s:OffsetSchedule,c:OffsetChoices,through:string):string[]{
  const out:string[]=[];
  const n=unfilledGaps(s,c).length;
  if(n) out.push(`incomplete: ${n} gap month${n===1?'':'s'} without a typed rate`);
  if(index(through)>index(s.windowEnd)&&!s.steps.some(x=>x.origin==='assumed-after'))
    out.push(c.after?`incomplete: the choice for after last report (${s.windowEnd}) cannot be applied (too few reported months to average)`:`incomplete: no choice for after last report (${s.windowEnd})`);
  return out.length?out:['incomplete'];
}
function limitReason(s:OffsetSchedule,c:OffsetChoices,through:string):string{
  return incompleteLabels(s,c,through).map(l=>l.replace(/^incomplete: /,'')).join('; ');
}
