import {validateTransientInput,scheduleFromForecast,buildTransientCase,FICTIONAL_EXAMPLE,FICTIONAL_EXAMPLE_LABEL,CLOSING_7,HANDOFF_NOTE,GUARD_TOO_SHORT,PVT_BLOCK} from '../dist/transientCase.js';
import {fmtNumber} from '../dist/caseSummary.js';
import {monthIndex,monthAt} from '../dist/planning.js';
import {buildDisposalCase} from '../dist/disposalCase.js';
import {sealTransient,PERMITTED_INTERVAL_LABEL} from '../dist/transientExport.js';
import {buildInterference,defaultRankingMonth,CLOSING_8,RANKING_LABEL,EXCLUDED,REMOVAL_LABEL,INDISTINGUISHABLE} from '../dist/interference.js';
import {packageFromVerified,addPackage,removePackage as dropPackage,joinedHistory,uics,EMPTY_PACKAGE_SET} from '../dist/historyPackages.js';
import {verifyExplorerPackage} from './explorer-package.mjs';

/** #7 (ANA-E06) "Pressure buildup over time (assumed rock)": one case well, assumed rock, a monthly rate schedule.
 * Pure at import time (no DOM access), so node:test imports it. Mounted only by import-ui.mjs.
 * Display only: it reads the disposal case result and never changes it. The panel is built as a list of sections so a later
 * "Nearby wells" section can be appended after the pressure buildup section. */

export const PANEL_TITLE='Pressure buildup over time (assumed rock)';
export const NO_CASE='Load or calculate a disposal case to choose a well';
export const MISSING_LABEL='not in the disposal case: enter a rate (0 = shut in)';
export const NO_INJECTION='no injection yet in this month';
export const EXAMPLE_PARTIAL_LABEL='partly from the fictional example — not typical values';
const NOT_REACHED='not reached within the schedule';
const NEGATIVE_SKIN_NOTE='Negative skin: the distance profiles exclude the effective-radius effect, so values near the well can differ from the bottomhole rise.';
// A sensitivity outcome carries no block reason; name both possible blocks with the core's own words.
const SENSITIVITY_BLOCK=`a month in this run is blocked (${GUARD_TOO_SHORT}; or bottomhole pressure is ${PVT_BLOCK})`;
const ROCK_KEYS=['k','h','phi','cf','rw','skin'];
const FACTORS=['k','h','cf','skin','re'];
const MAX_MONTHS=120;

const msg=e=>e instanceof Error?e.message:String(e);
const clone=v=>structuredClone(v);
/** Blank text is null (never 0); anything else is Number(text), so a typo is NaN and is refused by validation. */
export function parseNumber(text){if(text===null||text===undefined)return null;const t=String(text).trim();return t===''?null:Number(t);}

/** First month at the limit, or why there is none. A block never reads as "not reached". */
export function limitText(status,firstMonth,blockReason){
 if(status==='reached')return firstMonth;
 if(status==='not-reached')return NOT_REACHED;
 return 'not determined: '+(blockReason??SENSITIVITY_BLOCK);
}
/** "of which skin: N psi" only for a number; negative skin is stated plainly. */
export function skinText(skinPsi){
 if(typeof skinPsi!=='number'||!Number.isFinite(skinPsi))return null;
 return `of which skin: ${fmtNumber(skinPsi)} psi${skinPsi<0?' (negative skin)':''}`;
}
/** The first blocked month of a result as "<month>: <message>", or null. */
export function blockReason(t){const b=t.monthly.find(m=>m.blocked);return b?`${b.month}: ${b.blocked}`:null;}
/** A profile month's state, decided from the schedule and the monthly rows (not from the shape of the points). */
export function profileState(t,month){
 const row=t.monthly.find(m=>m.month===month);
 if(row?.blocked)return {kind:'blocked',text:row.blocked};
 const rows=t.inputs.schedule.months,i=rows.findIndex(r=>r.month===month);
 if(i>=0&&rows.slice(0,i+1).every(r=>!(r.rateStbd>0)))return {kind:'no-injection',text:NO_INJECTION};
 const p=t.profiles.find(x=>x.month===month);
 if(!p||!p.points.length)return {kind:'empty',text:'no distance points for this month'};
 return {kind:'points',points:p.points};
}

/** Only after loadExample has run since the last reset: 'full' while every rock and boundary field equals FICTIONAL_EXAMPLE,
 * 'partial' while any does, otherwise null. Typed values that happen to match are never labelled as the example. */
function exampleState(d,loaded){
 if(!loaded)return null;
 const same=[...ROCK_KEYS.map(k=>d.rock[k]===FICTIONAL_EXAMPLE[k]),d.boundary.kind==='closed'&&d.boundary.re===FICTIONAL_EXAMPLE.re];
 return same.every(Boolean)?'full':same.some(Boolean)?'partial':null;
}
export const exampleLabel=snap=>snap.example==='full'?FICTIONAL_EXAMPLE_LABEL:snap.example==='partial'?EXAMPLE_PARTIAL_LABEL:null;
/** Input DOM is rebuilt only when this key changes. `revision` is bumped by every programmatic change (example, copy, typed set-up,
 * source switch, reset, well change that clears a schedule); typing never bumps it, so a field being typed in is never replaced. */
export function shapeKey(snap){return JSON.stringify([snap.revision,snap.wells,snap.draft.wellId,snap.draft.boundary.kind,snap.draft.schedule.months.map(m=>m.month),snap.missingMonths]);}
const emptyDraft=()=>({wellId:null,rock:{k:null,h:null,phi:null,cf:null,rw:null,skin:null},boundary:{kind:null,re:null,statedExtentFt:null},
 schedule:{months:[],origin:'typed'},profileMonths:[null,null,null],sensitivity:Object.fromEntries(FACTORS.map(f=>[f,{low:null,high:null}]))});
const NO_SOURCE=Symbol('no source seen yet');

// ---- #8 (ANA-E07) "Nearby wells (interference screening)": pure helpers ----
export const NEARBY_TITLE='Nearby wells (interference screening)';
export const SETUP_FIRST="Set up the subject well's buildup first";
const NO_PACKAGES='Load at least one offset well package (Explorer .tar)';
export const VIEW_TITLE={'all-connected':'All offsets counted as connected (assumed)','your-selection':'Your selection (connected as you chose)','none':'No offsets (the subject well alone)'};
const ROW_STATUS={complete:'complete','partial-history':'partial history','not-felt-yet':'not felt yet',incomplete:'incomplete',excluded:EXCLUDED};
const AFTER_KINDS=['shut-in','hold-average','typed'];
const OFFSET_KEYS=['distanceFt','connected','zerosAreShutIn','priorStart','priorRate','afterKind','afterLastN','afterRate','sensLow','sensHigh'];
const emptyChoice=()=>({distanceFt:null,connected:null,zerosAreShutIn:null,gapRates:{},priorStart:null,priorRate:null,afterKind:null,afterLastN:null,afterRate:null,sensLow:null,sensHigh:null});
const emptyNearbySens=()=>({k:{low:null,high:null},cf:{low:null,high:null}});
const distText=d=>`${fmtNumber(d,d<10?2:0)} ft (assumed)`;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
/** Ranking-table cells: UIC, status, added psi, share, distance. Null is never 0: an incomplete row reads its status and "no number";
 * an excluded row reads EXCLUDED. Numbers are only the core's own values, never summed here. */
export function rankingCells(row){
 const dist=distText(row.distanceFt);
 if(row.status==='excluded')return [row.uic,EXCLUDED,EXCLUDED,'—',dist];
 if(row.addedPsi===null)return [row.uic,row.labels.find(l=>l.startsWith('incomplete'))??ROW_STATUS.incomplete,'no number','—',dist];
 const status=ROW_STATUS[row.status]+(row.lowerBound?' (lower bound)':'')+(row.directionUnknown?' (direction unknown)':'');
 return [row.uic,status,fmtNumber(row.addedPsi,1),row.share===null?'—':fmtNumber(row.share*100,1)+'%',dist];
}
/** Every row's own labels, in table order (reported/assumed/calculated sources, partial history, not felt yet, each incomplete reason). */
export const rowLabelLines=view=>view.rows.filter(r=>r.status!=='excluded').map(r=>`UIC ${r.uic}: ${r.labels.join('; ')}`);
/** The view total, or why there is none. */
export function totalText(view){
 if(view.totalPsi!==null)return `${fmtNumber(view.totalPsi,1)} psi (calculated)`;
 return view.rows.some(r=>r.status!=='excluded')?'incomplete: no total while a counted offset has no number':'no offsets counted';
}
/** First month at the limit for a view, or null without a pressure-as-of month (rise-only mode shows no limit month).
 * A null limit month reads "not determined" when the core noted it, otherwise "not reached"; the "none" view is #7's own answer. */
export function limitMonthText(r,view,transient){
 if(!r||r.mode!=='since-t-ref')return null;
 if(view.limitMonth)return view.limitMonth;
 if(view.name==='none'&&transient)return limitText(transient.limitStatus,transient.firstMonthAtLimit,blockReason(transient));
 const note=r.warnings.find(w=>w.startsWith(`${view.name}: limit month not determined`));
 return note?note.slice(view.name.length+2):NOT_REACHED;
}
/** Removal effect: the limit month with one offset removed (one at a time; not additive). A null carries no reason, so none is invented. */
export const removalText=e=>`Without UIC ${e.uic}: ${e.limitMonth??'no limit month found within the schedule'}`;
/** Nearby inputs are rebuilt only when this key changes (packages, gap-month lists, after-window kind, subject readiness, programmatic resets). */
export function nearbyShapeKey(snap){
 const n=snap.nearby;
 return JSON.stringify([n.revision,n.messages[0]===SETUP_FIRST,n.packages.map(p=>p.artifactId),n.offsets.map(o=>[o.uic,o.needsZeros,o.gapMonths,o.choice.afterKind])]);
}
/** The plain package as stored in the export: identity, window, only the monthly fields the screening reads, and the permitted
 * interval as reported (evidence only, or null). */
const exportPackage=(p,permittedInterval)=>({uic:p.uic,artifactId:p.artifactId,manifestSha256:p.manifestSha256,window:{...p.window},
 monthly:p.monthly.map(r=>({period_start:r.period_start,injected_liquid_bbl:r.injected_liquid_bbl,calculated_calendar_day_avg_bpd:r.calculated_calendar_day_avg_bpd})),
 permittedInterval:permittedInterval?{...permittedInterval}:null});
/** The worker's interference action (also run in Node by the tests): rebuild the disposal case, build #7 from the same subject input,
 * rebuild the package set through addPackage, build the screening and seal it with the packages it was built from. */
export async function runInterferenceCore({caseInput,input,packages}){
 const result=buildDisposalCase(caseInput);
 const transient=buildTransientCase(result,input.subject);
 const set=packages.reduce((s,p)=>addPackage(s,{artifactId:p.artifactId,manifestSha256:p.manifestSha256,uic:p.uic,window:p.window,monthly:p.monthly}),EMPTY_PACKAGE_SET);
 const interference=buildInterference(result,set,input);
 return sealTransient({caseInputs:caseInput,transient,interference,packages});
}
/** The permitted interval of each inventory row, as reported, or nothing (never 0). `raw` is the first one, in the export's shape. */
function intervalsOf(verified){
 const lines=[];let raw=null;
 for(const r of verified?.artifact?.inventory??[]){
  const num=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
  const top=num(r.permitted_top_depth_ft),bottom=num(r.permitted_bottom_depth_ft);
  if(top===null&&bottom===null)continue;
  raw??={permitted_top_depth_ft:top,permitted_bottom_depth_ft:bottom,label:PERMITTED_INTERVAL_LABEL};
  lines.push(`${top===null?'top not reported':fmtNumber(top)}–${bottom===null?'bottom not reported':fmtNumber(bottom)} ft, ${PERMITTED_INTERVAL_LABEL}`);
 }
 return {lines,raw};
}

/** DOM-free state machine. `generation` changes on every case result and invalidation; `seq` on every input edit.
 * Work started under an older generation or seq is ignored. `runCalculate({caseInput,input})` returns the sealed export (the worker in the browser). */
export function createTransientSession({getSource,runCalculate,runInterference,today=()=>new Date().toISOString().slice(0,10),onChange=()=>{}}){
 let result=null,draft=emptyDraft(),sealed=null,status='idle',error=null,generation=0,seq=0,revision=0,lastSource=NO_SOURCE,setup={start:'',count:''};
 let missing=[],copiedRates=new Map(),exampleLoaded=false;
 // #8 nearby wells: its own package set (separate from case insights), per-UIC choices and its own result slot.
 let pkgSet=EMPTY_PACKAGE_SET,intervals=new Map(),choices=new Map(),tRef=null,rankTyped=null,nearbySens=emptyNearbySens();
 let iSealed=null,iStatus='idle',iError=null,iSeq=0,nearbyRevision=0;
 const sourceNow=()=>getSource?getSource():undefined;
 /** A reset (source switch): every input of the panel is cleared, including the offset choices; loaded packages are kept. */
 const clearInputs=()=>{draft=emptyDraft();missing=[];copiedRates=new Map();setup={start:'',count:''};revision++;exampleLoaded=false;
  choices=new Map(uics(pkgSet).map(u=>[u,emptyChoice()]));tRef=null;rankTyped=null;nearbySens=emptyNearbySens();nearbyRevision++;};
 const followSource=()=>{const src=sourceNow();if(lastSource!==NO_SOURCE&&src!==lastSource)clearInputs();lastSource=src;};
 const wellIds=()=>result?result.inputs.wells.map(w=>w.id):[];
 const clearSchedule=()=>{draft.schedule={months:[],origin:'typed'};missing=[];copiedRates=new Map();draft.profileMonths=[null,null,null];setup={start:'',count:''};revision++;};
 /** A copied schedule, or one derived from a copy (copiedRates kept after an edit relabels it typed), belongs to its well. */
 const fromCopy=()=>typeof draft.schedule.origin==='object'||copiedRates.size>0;
 const setupFromSchedule=()=>{const ms=draft.schedule.months;setup={start:ms[0]?.month??'',count:ms.length?String(ms.length):''};};
 const pruneProfiles=()=>{const ms=new Set(draft.schedule.months.map(m=>m.month));draft.profileMonths=draft.profileMonths.map(m=>m!==null&&ms.has(m)?m:null);};
 /** Any input edit: the result and downloads are withdrawn and an in-flight calculation is ignored. */
 const withdraw=()=>{seq++;sealed=null;error=null;status=result?'ready':'idle';dropNearby();onChange();};
 /** Interference results and downloads are withdrawn by any offset, package, subject or case change; an in-flight run is ignored. */
 const dropNearby=()=>{iSeq++;iSealed=null;iError=null;iStatus='idle';};
 const withdrawNearby=()=>{dropNearby();onChange();};
 function buildInput(){
  const b=draft.boundary,closed=b.kind==='closed';
  const boundary=closed?{kind:'closed',re:b.re}:b.kind==='infinite'?{kind:'infinite',statedExtentFt:b.statedExtentFt}:{kind:null};
  const sensitivity={};
  for(const f of FACTORS){const v=draft.sensitivity[f];if(f==='re'&&!closed)continue;if(v.low!==null||v.high!==null)sensitivity[f]={low:v.low,high:v.high};}
  return {wellId:draft.wellId,rock:{...draft.rock},boundary,schedule:clone(draft.schedule),profileMonths:draft.profileMonths.filter(m=>m!==null),sensitivity};
 }
 function messages(){
  if(!result)return [NO_CASE];
  if(draft.wellId===null)return ['Choose a well'];
  return validateTransientInput(result,buildInput());
 }
 // ---- #8 nearby wells ----
 const loaded=uic=>{if(!choices.has(uic))throw new Error(`UIC ${uic} has no loaded package`);return choices.get(uic);};
 /** Window, month states and the months the core treats as gaps for these choices (reported zero is a gap unless confirmed shut in).
  * Only months the core reads are listed: through the ranking month, or through the subject's last schedule month when that is later. */
 function offsetInfo(uic){
  const jh=joinedHistory(pkgSet,uic),c=choices.get(uic);
  const rank=rankingMonth(),subjEnd=draft.schedule.months[draft.schedule.months.length-1]?.month??null,through=subjEnd!==null&&subjEnd>rank?subjEnd:rank;
  const rate=new Map(jh.monthly.map(r=>[String(r.period_start).slice(0,7),r.calculated_calendar_day_avg_bpd]));
  const zeroMonths=jh.months.filter(m=>m.state==='reported-zero').map(m=>m.month);
  const gapMonths=jh.months.filter(m=>m.state==='gap'||(m.state==='reported-zero'&&c.zerosAreShutIn!==true)||(m.state==='reported'&&!finite(rate.get(m.month)))).map(m=>m.month).filter(m=>m<=through);
  const ids=jh.packages.map(p=>p.artifactId);
  return {uic,window:{...jh.window},counts:{...jh.counts},packages:ids,intervals:[...new Set(ids.flatMap(id=>intervals.get(id)?.lines??[]))],zeroMonths,gapMonths,
   unfilled:gapMonths.filter(m=>!finite(c.gapRates[m])).length,needsZeros:zeroMonths.length>0,choice:clone(c)};
 }
 const rankingMonth=()=>rankTyped??(uics(pkgSet).length?defaultRankingMonth(pkgSet):null);
 function afterOf(c){
  if(c.afterKind==='shut-in')return {kind:'shut-in'};
  if(c.afterKind==='hold-average')return {kind:'hold-average',lastN:c.afterLastN};
  if(c.afterKind==='typed')return {kind:'typed',rateStbd:c.afterRate};
  return null;
 }
 function nearbyMessages(){
  if(!result||messages().length)return [SETUP_FIRST];
  const list=uics(pkgSet);if(!list.length)return [NO_PACKAGES];
  const out=[],pair=(a,b,what)=>{if((a===null)!==(b===null))out.push(`${what}: fill low and high, or neither`);else if(a!==null&&!(finite(a)&&finite(b)))out.push(`${what}: low and high must be numbers`);};
  for(const u of list){
   const c=choices.get(u),info=offsetInfo(u),p=`UIC ${u}`;
   if(c.connected===null)out.push(`${p}: choose connected or not connected (there is no default)`);
   if(c.distanceFt===null)out.push(`${p}: type the distance (ft, assumed)`);else if(!finite(c.distanceFt))out.push(`${p}: distance must be a number`);
   if(info.needsZeros&&c.zerosAreShutIn===null)out.push(`${p}: answer whether reported zero months are treated as shut in (there is no default)`);
   for(const m of info.gapMonths)if(c.gapRates[m]!==undefined&&!finite(c.gapRates[m]))out.push(`${p}: gap rate for ${m} must be a number`);
   if((c.priorStart===null)!==(c.priorRate===null))out.push(`${p}: prior rate and start month go together; fill both or neither`);
   else if(c.priorRate!==null&&!finite(c.priorRate))out.push(`${p}: prior rate must be a number`);
   if(c.afterKind==='hold-average'&&!finite(c.afterLastN))out.push(`${p}: type N, the number of last reported months to average`);
   if(c.afterKind==='typed'&&!finite(c.afterRate))out.push(`${p}: type the rate after last report (STB/day, assumed)`);
   pair(c.sensLow,c.sensHigh,`Sensitivity distance for ${p}`);
  }
  for(const [f,label] of [['k','k'],['cf','c_f']]){
   const v=nearbySens[f];
   for(const side of ['low','high'])if(v[side]===null&&v[side==='low'?'high':'low']!==null)out.push(`Sensitivity ${label} ${side} is not entered (fill low and high, or neither)`);
   if(v.low!==null&&v.high!==null&&!(finite(v.low)&&finite(v.high)))out.push(`Sensitivity ${label}: low and high must be numbers`);
  }
  return out;
 }
 function interferenceInput(){
  const sensitivity={};
  for(const f of ['k','cf']){const v=nearbySens[f];if(v.low!==null&&v.high!==null)sensitivity[f]={low:v.low,high:v.high};}
  const offsets=uics(pkgSet).map(u=>{
   const c=choices.get(u),info=offsetInfo(u),gapRates={};
   for(const m of info.gapMonths)if(typeof c.gapRates[m]==='number')gapRates[m]=c.gapRates[m];
   if(c.sensLow!==null&&c.sensHigh!==null)(sensitivity.distance??={})[u]={low:c.sensLow,high:c.sensHigh};
   // zerosAreShutIn is passed as false only for a well with no reported zero months (where it has no effect); otherwise the run waits for the answer.
   return {uic:u,distanceFt:c.distanceFt,connected:c.connected,zerosAreShutIn:c.zerosAreShutIn===true,gapRates,
    prior:c.priorStart!==null&&c.priorRate!==null?{startMonth:c.priorStart,rateStbd:c.priorRate}:null,after:afterOf(c)};
  });
  return {subject:buildInput(),tRef,rankingMonth:rankingMonth(),offsets,sensitivity};
 }
 function nearbySnapshot(){
  const nm=nearbyMessages();
  return {status:iStatus,messages:nm,canRun:nm.length===0&&iStatus!=='running',revision:nearbyRevision,
   packages:pkgSet.packages.map(p=>({artifactId:p.artifactId,uic:p.uic,window:{...p.window},manifestSha256:p.manifestSha256})),
   offsets:uics(pkgSet).map(offsetInfo),tRef,rankingMonth:rankingMonth(),rankingTyped:rankTyped!==null,sensitivity:clone(nearbySens),
   output:iSealed?iSealed.interference:null,transient:iSealed?iSealed.transient:null,contentSha256:iSealed?iSealed.contentSha256:null,error:iError};
 }
 const session={
  onCaseResult(next){
   generation++;followSource();result=next;
   const ids=wellIds();
   if(!ids.includes(draft.wellId)){draft.wellId=ids[0]??null;if(fromCopy())clearSchedule();revision++;}
   withdraw();
  },
  onInvalidated(){generation++;followSource();result=null;withdraw();},
  /** The workspace-source event: the panel's inputs are cleared. */
  onSourceSwitch(){lastSource=sourceNow();clearInputs();if(result)draft.wellId=wellIds()[0]??null;withdraw();},
  selectWell(id){
   if(!wellIds().includes(id))throw new Error(`Well ${id} is not in the disposal case`);
   if(id!==draft.wellId&&fromCopy())clearSchedule();
   draft.wellId=id;withdraw();
  },
  setRock(key,value){if(!ROCK_KEYS.includes(key))throw new Error('Unknown rock input '+key);draft.rock[key]=value;withdraw();},
  loadExample(){
   const {re,...rock}=FICTIONAL_EXAMPLE;draft.rock={...rock};draft.boundary={kind:'closed',re,statedExtentFt:null};exampleLoaded=true;revision++;withdraw();
  },
  setBoundaryKind(kind){if(kind!=='closed'&&kind!=='infinite'&&kind!==null)throw new Error('Unknown boundary '+kind);draft.boundary.kind=kind;withdraw();},
  setBoundaryValue(key,value){if(key!=='re'&&key!=='statedExtentFt')throw new Error('Unknown boundary value '+key);draft.boundary[key]=value;withdraw();},
  /** Typed schedule: `count` consecutive months from `start`, every rate empty until typed. */
  setScheduleMonths(start,count){
   const n=Number(count);if(!Number.isInteger(n)||n<1||n>MAX_MONTHS)throw new Error(`Number of months must be a whole number from 1 to ${MAX_MONTHS}`);
   let first;try{first=monthIndex(start);}catch{throw new Error('Start month must be a YYYY-MM month');}
   const old=new Map(draft.schedule.months.map(m=>[m.month,m.rateStbd]));
   draft.schedule={months:Array.from({length:n},(_,i)=>{const month=monthAt(first+i);return {month,rateStbd:typeof draft.schedule.origin==='string'&&old.has(month)?old.get(month):null};}),origin:'typed'};
   missing=[];copiedRates=new Map();setupFromSchedule();revision++;pruneProfiles();withdraw();
  },
  /** The typed set-up fields (start month, month count) as text; not a calculation input, so nothing is withdrawn. */
  setScheduleSetup(key,value){if(key!=='start'&&key!=='count')throw new Error('Unknown schedule set-up field '+key);setup={...setup,[key]:String(value??'')};},
  setRate(month,value){
   const row=draft.schedule.months.find(m=>m.month===month);if(!row)throw new Error(`Month ${month} is not in the rate schedule`);
   row.rateStbd=value;
   // A copied (non-missing) rate overwritten with a different value is no longer the forecast: the schedule becomes typed.
   if(typeof draft.schedule.origin==='object'&&copiedRates.has(month)&&!Object.is(copiedRates.get(month),value))draft.schedule.origin='typed';
   withdraw();
  },
  /** One-way copy of the selected well's Base forecast allocation. Returns null, or the refusal message (state unchanged). */
  copyForecast(){
   if(!result)return NO_CASE;
   let s;try{s=scheduleFromForecast(result,draft.wellId,today());}catch(e){return msg(e);}
   draft.schedule=s;missing=s.months.filter(m=>m.rateStbd===null).map(m=>m.month);
   copiedRates=new Map(s.months.filter(m=>m.rateStbd!==null).map(m=>[m.month,m.rateStbd]));setupFromSchedule();revision++;pruneProfiles();withdraw();return null;
  },
  setProfileMonth(slot,month){if(!(slot>=0&&slot<3))throw new Error('Profile slot must be 0, 1 or 2');draft.profileMonths[slot]=month||null;withdraw();},
  setSensitivity(factor,side,value){if(!FACTORS.includes(factor)||(side!=='low'&&side!=='high'))throw new Error('Unknown sensitivity input');draft.sensitivity[factor][side]=value;withdraw();},
  /** The built result, or null when it was overtaken by an edit or a new case. Throws the validation messages. */
  async calculate(){
   const m=messages();if(m.length)throw new Error(m.join('; '));
   const gen=generation,mine=++seq,caseInput=clone(result.inputs),input=buildInput();
   sealed=null;error=null;status='calculating';onChange();
   const current=()=>gen===generation&&mine===seq;
   try{
    const out=await runCalculate({caseInput,input});
    if(!current())return null;
    sealed=out;status='calculated';onChange();return out.transient;
   }catch(e){
    if(!current())return null;
    status='ready';error=msg(e);onChange();throw e;
   }
  },
  /** Re-verify the shown result through `verify(sealed,format)` (the worker in the browser). `{cancelled:true}` when it changed meanwhile. */
  async exportTransient(format,verify){
   if(format!=='json'&&format!=='csv')throw new Error('Unsupported pressure buildup export format: '+format);
   if(status==='calculating')throw new Error('Wait for the calculation to finish before downloading.');
   if(!sealed)throw new Error('Calculate the pressure buildup first.');
   const shown=sealed,changed=()=>sealed!==shown;
   try{
    const text=await verify(shown,format);if(changed())return {cancelled:true};
    return {cancelled:false,text,filename:`swd-transient-buildup-${shown.contentSha256.slice(0,12)}.${format}`,mime:format==='json'?'application/json':'text/csv;charset=utf-8'};
   }catch(e){if(changed())return {cancelled:true};throw e;}
  },
  /** Verified Explorer package -> this panel's own package set. A refusal returns {error} and leaves every state unchanged. */
  loadPackage(verified){
   let p,next;try{p=packageFromVerified(verified);next=addPackage(pkgSet,p);}catch(e){return {error:msg(e)};}
   pkgSet=next;intervals.set(p.artifactId,intervalsOf(verified));if(!choices.has(p.uic))choices.set(p.uic,emptyChoice());
   withdrawNearby();return {package:p};
  },
  /** Removing a package withdraws that UIC's row inputs (a UIC with another package left starts again with no choices). */
  removePackage(artifactId){
   const p=pkgSet.packages.find(x=>x.artifactId===artifactId);if(!p)return;
   pkgSet=dropPackage(pkgSet,artifactId);intervals.delete(artifactId);choices.delete(p.uic);
   if(uics(pkgSet).includes(p.uic))choices.set(p.uic,emptyChoice());
   if(rankTyped!==null&&!uics(pkgSet).length)rankTyped=null;
   nearbyRevision++;withdrawNearby();
  },
  setOffset(uic,key,value){
   const c=loaded(uic);if(!OFFSET_KEYS.includes(key))throw new Error('Unknown offset input '+key);
   if((key==='connected'||key==='zerosAreShutIn')&&value!==true&&value!==false&&value!==null)throw new Error(`${key} must be true, false or unanswered`);
   if(key==='afterKind'&&value!==null&&!AFTER_KINDS.includes(value))throw new Error('Unknown after-window choice '+value);
   if(key==='priorStart')value=value||null;
   c[key]=value;withdrawNearby();
  },
  /** A typed rate for a gap month (0 = shut in); null clears it (the month is then unfilled, never 0). */
  setGapRate(uic,month,value){
   const c=loaded(uic);if(!offsetInfo(uic).gapMonths.includes(month))throw new Error(`${month} is not a gap month for UIC ${uic}`);
   if(value===null)delete c.gapRates[month];else c.gapRates[month]=value;withdrawNearby();
  },
  setTRef(month){tRef=month||null;withdrawNearby();},
  /** Empty returns to the default: the last month covered by every loaded package. */
  setRankingMonth(month){rankTyped=month||null;withdrawNearby();},
  setNearbySensitivity(factor,side,value){if((factor!=='k'&&factor!=='cf')||(side!=='low'&&side!=='high'))throw new Error('Unknown sensitivity input');nearbySens[factor][side]=value;withdrawNearby();},
  interferenceInput,
  /** The worker payload: the case inputs, the screening input (its subject is the same #7 input) and the plain packages. */
  interferencePayload(){return {caseInput:clone(result.inputs),input:interferenceInput(),packages:pkgSet.packages.map(p=>exportPackage(p,intervals.get(p.artifactId)?.raw??null))};},
  /** The screening result, or null when overtaken by an edit or a new case. Throws the input messages, or the core's refusal. */
  async runInterference(){
   const nm=nearbyMessages();if(nm.length)throw new Error(nm.join('; '));
   const gen=generation,mine=++iSeq,payload=session.interferencePayload();
   iSealed=null;iError=null;iStatus='running';onChange();
   const current=()=>gen===generation&&mine===iSeq;
   try{
    const out=await runInterference(payload);
    if(!current())return null;
    iSealed=out;iStatus='done';onChange();return out.interference;
   }catch(e){
    if(!current())return null;
    iStatus='idle';iError=msg(e);onChange();throw e;
   }
  },
  /** Re-verify the shown screening export (the worker's verify action in the browser). */
  async exportInterference(format,verify){
   if(format!=='json'&&format!=='csv')throw new Error('Unsupported interference export format: '+format);
   if(iStatus==='running')throw new Error('Wait for the interference screening to finish before downloading.');
   if(!iSealed)throw new Error('Run the interference screening first.');
   const shown=iSealed,changed=()=>iSealed!==shown;
   try{
    const text=await verify(shown,format);if(changed())return {cancelled:true};
    return {cancelled:false,text,filename:`swd-interference-screening-${shown.contentSha256.slice(0,12)}.${format}`,mime:format==='json'?'application/json':'text/csv;charset=utf-8'};
   }catch(e){if(changed())return {cancelled:true};throw e;}
  },
  snapshot(){
   const m=messages();
   return {status,ready:result!==null,wells:wellIds(),draft:clone(draft),missingMonths:[...missing],example:exampleState(draft,exampleLoaded),setup:{...setup},revision,messages:m,
    canCalculate:result!==null&&m.length===0&&status!=='calculating',output:sealed?sealed.transient:null,contentSha256:sealed?sealed.contentSha256:null,error,generation,nearby:nearbySnapshot()};
  },
 };
 return session;
}

// ---- Bottomhole pressure chart (pure SVG string) ----
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
/** Bottomhole pressure (psia, calculated) against month with the limit line. Every month has a tick (no thinning, D16); a blocked month has no point and breaks the line. */
export function buildupChartSvg(t,width=600){
 const height=260,left=64,right=12,top=34,bottom=44,plotH=height-top-bottom,months=t.monthly.map(m=>m.month);
 const values=t.monthly.map(m=>m.bottomholePsia).filter(v=>typeof v==='number');
 const lo=Math.min(t.well.reservoirPsia,t.well.limitPsia,...values),hi=Math.max(t.well.reservoirPsia,t.well.limitPsia,...values),span=hi-lo||1;
 const slot=(width-left-right)/Math.max(1,months.length),x=i=>left+i*slot+slot/2,y=v=>top+plotH-(v-lo)/span*plotH;
 const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t.well.id)} bottomhole pressure against time with the limit">`,
  `<title>${esc(t.well.id)}: bottomhole pressure (psia, calculated, at ${esc(t.well.datum)}) by month, with the limit ${esc(fmtNumber(t.well.limitPsia))} psia</title>`,
  `<rect width="${width}" height="${height}" fill="white"/>`,
  `<text x="${left}" y="14" font-size="11">Bottomhole psia, calculated (blue) · limit (dashed) · a blocked month has no point</text>`,
  `<line x1="${left}" y1="${top+plotH}" x2="${width-right}" y2="${top+plotH}" stroke="#555"/>`,
  `<line x1="${left}" y1="${top}" x2="${left}" y2="${top+plotH}" stroke="#555"/>`,
  `<text x="${left-4}" y="${top+4}" font-size="10" text-anchor="end">${esc(fmtNumber(hi))}</text>`,
  `<text x="${left-4}" y="${top+plotH}" font-size="10" text-anchor="end">${esc(fmtNumber(lo))}</text>`,
  `<line class="limit" x1="${left}" y1="${y(t.well.limitPsia)}" x2="${width-right}" y2="${y(t.well.limitPsia)}" stroke="#bb7830" stroke-dasharray="5 3"/>`,
  `<text x="${width-right}" y="${y(t.well.limitPsia)-4}" font-size="10" text-anchor="end" fill="#8a5410">Limit ${esc(fmtNumber(t.well.limitPsia))} psia</text>`];
 months.forEach((m,i)=>{parts.push(`<line class="month" x1="${x(i)}" y1="${top+plotH}" x2="${x(i)}" y2="${top+plotH+3}" stroke="#555"/>`);
  if(i===0||i===months.length-1||m.endsWith('-01'))parts.push(`<text x="${x(i)}" y="${top+plotH+16}" font-size="9" text-anchor="middle">${esc(m)}</text>`);});
 let d='',joined=false;
 t.monthly.forEach((m,i)=>{if(typeof m.bottomholePsia!=='number'){joined=false;return;}d+=(joined?'L':'M')+x(i)+','+y(m.bottomholePsia)+' ';joined=true;});
 if(d)parts.push(`<path d="${d.trim()}" fill="none" stroke="#1262b5" stroke-width="2"/>`);
 t.monthly.forEach((m,i)=>{if(typeof m.bottomholePsia==='number')parts.push(`<circle class="point" cx="${x(i)}" cy="${y(m.bottomholePsia)}" r="2.5" fill="#1262b5"><title>${esc(m.month)}: ${esc(fmtNumber(m.bottomholePsia))} psia (calculated)</title></circle>`);});
 parts.push(`<text x="${left}" y="${height-4}" font-size="10">Month (every month drawn)</text></svg>`);
 return parts.join('');
}

// ---- DOM wiring (only runs when import-ui.mjs calls mountTransientBuildup) ----
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const num=(v,digits=0)=>typeof v==='number'&&Number.isFinite(v)?fmtNumber(v,digits):'—';
function table(headers,rows,caption){const t=el('table');t.append(el('caption',caption));const h=el('thead'),r=el('tr');for(const label of headers){const th=el('th',label);th.scope='col';r.append(th);}h.append(r);t.append(h);const b=el('tbody');
 for(const row of rows){const tr=el('tr');for(const c of row){if(c&&typeof c==='object'){const td=el('td',c.text);if(c.span)td.colSpan=c.span;tr.append(td);}else tr.append(el('td',c===null||c===undefined?'—':String(c)));}b.append(tr);}t.append(b);return t;}
function scroll(child,label){const d=el('div',undefined,'table-scroll');d.tabIndex=0;d.setAttribute('role','region');d.setAttribute('aria-label',label);d.append(child);return d;}
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('Pressure chart could not be parsed.');return document.importNode(doc.documentElement,true);}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const ROCK_FIELDS=[['k','Permeability k (md, assumed)'],['h','Thickness h (ft, assumed)'],['phi','Porosity φ (fraction, assumed)'],['cf','Formation compressibility c_f (1/psi, assumed)'],['rw','Wellbore radius r_w (ft, assumed)'],['skin','Skin s (dimensionless, assumed)']];
const FACTOR_LABEL={k:'k (md)',h:'h (ft)',cf:'c_f (1/psi)',skin:'s',re:'r_e (ft)'};
const numberInput=(label,value)=>{const l=el('label',label),i=el('input');i.type='number';i.step='any';i.value=value===null||value===undefined?'':String(value);l.append(i);return [l,i];};

export function mountTransientBuildup(root,{getSource}){
 // One worker slot per kind, so typing an offset distance never stops the buildup calculation and a download never stops a run.
 const workers={buildup:null,nearby:null,verify:null,nearbyVerify:null};
 /** No slot named: a subject change stops the buildup calculation and the screening run (both are withdrawn by the session). */
 function cancel(name){for(const k of name?[name]:['buildup','nearby']){const w=workers[k];if(w){w.worker.terminate();w.reject(new Error('Calculation replaced by newer inputs'));workers[k]=null;}}}
 function request(name,action,payload){
  cancel(name);
  return new Promise((resolve,reject)=>{
   const w=new Worker('/transient-worker.mjs',{type:'module'}),slot={worker:w,reject};workers[name]=slot;
   const finish=()=>{w.terminate();if(workers[name]===slot)workers[name]=null;};
   w.onmessage=event=>{const data=event.data;finish();if(data.error)reject(new Error(data.error));else resolve(data);};
   w.onerror=()=>{finish();reject(new Error('Pressure buildup calculation could not load. Reload the app and try again.'));};
   w.onmessageerror=()=>{finish();reject(new Error('Pressure buildup calculation returned a message that could not be read. Try again.'));};
   w.postMessage({action,...payload});
  });
 }
 const session=createTransientSession({getSource,runCalculate:async payload=>(await request('buildup','calculate',payload)).sealed,
  runInterference:async payload=>(await request('nearby','interference',payload)).sealed,onChange:()=>render()});

 const title=el('h3',PANEL_TITLE);title.id='transient-buildup-title';
 const status=el('p',NO_CASE);status.setAttribute('role','status');
 // Sections are appended in order; a later section (nearby wells) goes after `buildup`.
 const buildup=el('section');buildup.className='transient-buildup-section';
 const form=el('form');form.noValidate=true;
 const inputsBox=el('div'),scheduleBox=el('div'),sensBox=el('div'),errors=el('ul',undefined,'small');errors.setAttribute('aria-label','Inputs still needed or refused');
 const calc=el('button','Calculate pressure buildup');calc.type='submit';calc.disabled=true;
 form.append(inputsBox,scheduleBox,sensBox,errors,calc);
 const results=el('div'),jsonBtn=el('button','Download pressure buildup JSON'),csvBtn=el('button','Download pressure buildup CSV');jsonBtn.type=csvBtn.type='button';jsonBtn.disabled=csvBtn.disabled=true;
 const downloads=el('div',undefined,'import-actions');downloads.append(jsonBtn,csvBtn);
 buildup.append(form,results,downloads);
 // Nearby wells (interference screening, #8): after the buildup section.
 const nearby=el('section');nearby.className='transient-nearby-section';
 const nSetup=el('p',SETUP_FIRST),nBody=el('div');
 const nFileLabel=el('label','Load offset well packages (Explorer .tar, one UIC each)'),nFile=el('input');nFile.type='file';nFile.accept='.tar,application/x-tar';nFile.multiple=true;nFileLabel.append(nFile);
 const nLoadError=el('p','');nLoadError.setAttribute('role','alert');
 const nPackages=el('ul',undefined,'small');nPackages.setAttribute('aria-label','Loaded offset well packages');
 const nForm=el('form');nForm.noValidate=true;
 const nControls=el('div'),nOffsets=el('div'),nSensBox=el('div'),nErrors=el('ul',undefined,'small');nErrors.setAttribute('aria-label','Nearby wells inputs still needed or refused');
 const nRun=el('button','Run interference screening');nRun.type='submit';nRun.disabled=true;
 nForm.append(nControls,nOffsets,nSensBox,nErrors,nRun);
 const nStatus=el('p','');nStatus.setAttribute('role','status');
 const nResults=el('div'),nJson=el('button','Download interference JSON'),nCsv=el('button','Download interference CSV');nJson.type=nCsv.type='button';nJson.disabled=nCsv.disabled=true;
 const nDownloads=el('div',undefined,'import-actions');nDownloads.append(nJson,nCsv);
 nBody.append(nFileLabel,nLoadError,nPackages,nForm,nStatus,nResults,nDownloads);
 nearby.append(el('h4',NEARBY_TITLE),el('p','Offset wells you load are ranked by the pressure each adds at the subject well, using the assumed rock of the buildup above. Distances and connected or not connected are your assumptions; nothing here decides them.','small'),nSetup,nBody);
 root.replaceChildren(title,status,buildup,nearby);root.hidden=true;
 let nExporting=false,renderedNearby=null,renderedNearbyOutput=undefined;
 const nNotes=new Map();
 let exporting=false,renderedDraft=null,renderedOutput=undefined,actionError='';
 const exampleNote=el('p','','case-warning'),originNote=el('p','','small');
 function renderNotes(snap){
  const label=exampleLabel(snap);exampleNote.hidden=!label;exampleNote.textContent=label??'';const origin=snap.draft.schedule.origin;
  originNote.textContent=typeof origin==='object'?`Forecast (copied from disposal case "${origin.copiedFrom}", ${origin.copiedAt}). The copy is one-way; changing a copied rate makes the schedule typed.`:'Synthetic/assumed (typed). Empty months must be typed; nothing defaults to 0.';
 }

 const refocus=key=>{if(key)root.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();};
 /** Inputs are rebuilt only when the draft shape changes (well list, schedule months, boundary kind), so typing keeps focus. */
 function bind(input,key,set){input.dataset.key=key;input.addEventListener('input',()=>{cancel();actionError='';set(parseNumber(input.value));refocus(key);});}
 function renderInputs(snap){
  const d=snap.draft;inputsBox.replaceChildren();scheduleBox.replaceChildren();sensBox.replaceChildren();
  const top=el('div',undefined,'disposal-controls');
  const wl=el('label','Well (from the disposal case)'),ws=el('select');ws.dataset.key='well';
  for(const id of snap.wells){const o=el('option',id);o.value=id;ws.append(o);}ws.value=d.wellId??'';wl.append(ws);
  ws.addEventListener('change',()=>{cancel();session.selectWell(ws.value);refocus('well');});
  const ex=el('button','Load fictional example');ex.type='button';ex.dataset.key='example';ex.onclick=()=>{cancel();session.loadExample();refocus('example');};
  top.append(wl,ex);inputsBox.append(top);
  inputsBox.append(el('p','Initial pressure, limit and datum come from the selected case well (read-only here). Rock and boundary values are assumed; none is filled in for you.','small'));
  inputsBox.append(exampleNote);
  const rock=el('fieldset');rock.style.minWidth='0';rock.append(el('legend','Rock (assumed)'));const rc=el('div',undefined,'disposal-controls');
  for(const [k,label] of ROCK_FIELDS){const [l,i]=numberInput(label,d.rock[k]);bind(i,'rock.'+k,v=>session.setRock(k,v));rc.append(l);}
  rock.append(rc);inputsBox.append(rock);
  const bd=el('fieldset');bd.style.minWidth='0';bd.append(el('legend','Boundary (assumed)'));const bc=el('div',undefined,'disposal-controls');
  const bl=el('label','Boundary'),bs=el('select');bs.dataset.key='boundary';
  for(const [v,t] of [['','Choose…'],['closed','Closed circle (radius r_e)'],['infinite','No edge (infinite-acting)']]){const o=el('option',t);o.value=v;bs.append(o);}
  bs.value=d.boundary.kind??'';bl.append(bs);bs.addEventListener('change',()=>{cancel();session.setBoundaryKind(bs.value||null);refocus('boundary');});bc.append(bl);
  if(d.boundary.kind==='closed'){const [l,i]=numberInput('Boundary radius r_e (ft, assumed)',d.boundary.re);bind(i,'re',v=>session.setBoundaryValue('re',v));bc.append(l);}
  if(d.boundary.kind==='infinite'){const [l,i]=numberInput('Stated extent (ft, assumed, optional)',d.boundary.statedExtentFt);bind(i,'extent',v=>session.setBoundaryValue('statedExtentFt',v));bc.append(l);}
  bd.append(bc);inputsBox.append(bd);
  // Schedule
  const sf=el('fieldset');sf.style.minWidth='0';sf.append(el('legend','Rate schedule (STB/day, calendar-day average per month)'));
  const sc=el('div',undefined,'disposal-controls');
  const sl=el('label','Start month'),start=el('input');start.type='month';start.dataset.key='start';start.value=snap.setup.start;sl.append(start);
  start.addEventListener('input',()=>session.setScheduleSetup('start',start.value));
  const [cl,count]=numberInput('Number of months (1–120)',snap.setup.count);count.dataset.key='count';
  count.addEventListener('input',()=>session.setScheduleSetup('count',count.value));
  const setup=el('button','Set up typed months');setup.type='button';setup.dataset.key='setup';
  setup.onclick=()=>{actionError='';try{session.setScheduleMonths(start.value,count.value);cancel();}catch(x){actionError=msg(x);render();}refocus('setup');};
  const copy=el('button',"Copy this well's Base forecast allocation");copy.type='button';copy.dataset.key='copy';
  copy.onclick=()=>{const refused=session.copyForecast();if(refused===null)cancel();actionError=refused??'';render();refocus('copy');};
  sc.append(sl,cl,setup,copy);sf.append(sc);
  sf.append(originNote);
  if(d.schedule.months.length){
   const t=el('table');t.append(el('caption','Monthly injection rate; 0 = shut in'));
   const h=el('thead'),hr=el('tr');for(const label of ['Month','Rate (STB/day)']){const th=el('th',label);th.scope='col';hr.append(th);}h.append(hr);t.append(h);
   const b=el('tbody');
   for(const m of d.schedule.months){
    const tr=el('tr'),td=el('td'),i=el('input');i.type='number';i.step='any';i.min='0';i.required=true;i.value=m.rateStbd===null?'':String(m.rateStbd);
    const isMissing=snap.missingMonths.includes(m.month);i.setAttribute('aria-label',`Rate for ${m.month}${isMissing?' ('+MISSING_LABEL+')':''}`);
    if(isMissing)i.placeholder='required';bind(i,'rate.'+m.month,v=>session.setRate(m.month,v));td.append(i);
    if(isMissing)td.append(el('small',' '+MISSING_LABEL));
    tr.append(el('td',m.month),td);b.append(tr);
   }
   t.append(b);sf.append(scroll(t,'Rate schedule'));
   const pc=el('div',undefined,'disposal-controls');
   for(let slot=0;slot<3;slot++){
    const l=el('label',`Profile month ${slot+1} (optional)`),s=el('select');s.dataset.key='profile.'+slot;
    const none=el('option','None');none.value='';s.append(none);
    for(const m of d.schedule.months){const o=el('option',m.month);o.value=m.month;s.append(o);}
    s.value=d.profileMonths[slot]??'';s.addEventListener('change',()=>{cancel();session.setProfileMonth(slot,s.value||null);refocus('profile.'+slot);});l.append(s);pc.append(l);
   }
   sf.append(el('p','Pressure against distance: choose up to 3 months.','small'),pc);
  }
  scheduleBox.append(sf);
  // Sensitivity
  const sv=el('fieldset');sv.style.minWidth='0';sv.append(el('legend','Sensitivity low/high (assumed; one at a time; optional)'));
  const st=el('table');st.append(el('caption','Each factor is changed alone; c_t is recomputed from c_f. Leave a row empty to skip it.'));
  const sh=el('thead'),shr=el('tr');for(const label of ['Factor','Low','High']){const th=el('th',label);th.scope='col';shr.append(th);}sh.append(shr);st.append(sh);
  const sb=el('tbody');
  for(const f of ['k','h','cf','skin','re']){
   if(f==='re'&&d.boundary.kind!=='closed')continue;
   const tr=el('tr');tr.append(el('td',FACTOR_LABEL[f]));
   for(const side of ['low','high']){const td=el('td'),i=el('input');i.type='number';i.step='any';i.value=d.sensitivity[f][side]===null?'':String(d.sensitivity[f][side]);i.setAttribute('aria-label',`Sensitivity ${FACTOR_LABEL[f]} ${side}`);bind(i,`sens.${f}.${side}`,v=>session.setSensitivity(f,side,v));td.append(i);tr.append(td);}
   sb.append(tr);
  }
  st.append(sb);sv.append(scroll(st,'Sensitivity inputs'));sensBox.append(sv);
 }
 function renderResults(t){
  results.replaceChildren();if(!t)return;
  const w=t.well,reason=blockReason(t);
  results.append(el('h4','Bottomhole pressure (calculated)'));
  results.append(el('p',`${w.id}: initial ${num(w.reservoirPsia)} psia, limit ${num(w.limitPsia)} psia, datum ${w.datum} (from the case well). Pressures are psia, bottomhole-absolute.`,'small'));
  try{const c=el('div',undefined,'pvt-plot');c.append(svgNode(buildupChartSvg(t,matchMedia('(max-width:700px)').matches?360:600)));results.append(c);}catch(x){results.append(el('p',msg(x)));}
  results.append(el('p',`First month at the limit: ${limitText(t.limitStatus,t.firstMonthAtLimit,reason)}`));
  const last=t.monthly[t.monthly.length-1];
  if(typeof t.endBottomholePsia==='number'){
   results.append(el('p',`Bottomhole pressure at the end of the schedule (${last.month}): ${num(t.endBottomholePsia)} psia`));
   const sk=skinText(last.skinPsi);if(sk)results.append(el('p',sk,'small'));
  }else results.append(el('p',`End of the schedule (${last.month}): ${last.blocked??'not shown'}`));
  const rows=t.monthly.map(m=>m.blocked?[m.month,{text:m.blocked,span:4}]:[m.month,num(m.risePsi,1),skinText(m.skinPsi)?num(m.skinPsi,1):'—',num(m.bottomholePsia,1),m.bottomholePsia>=w.limitPsia?'at or above the limit':'']);
  results.append(scroll(table(['Month','Rise above initial (psi)','Of which skin (psi)','Bottomhole (psia)','Note'],rows,`${w.id}: calculated monthly pressure; a blocked month shows why it is not shown`),'Monthly bottomhole pressure'));
  results.append(el('p',`Fluid: c_w ${t.fluid.cw.toExponential(3)} 1/psi (brine model) · c_f ${t.fluid.cf.toExponential(3)} 1/psi (assumed) · c_t ${t.fluid.ct.toExponential(3)} 1/psi · viscosity ${num(t.fluid.mu,3)} cP · Bw ${num(t.fluid.B,4)} rb/STB · ${num(t.fluid.temperatureF)} °F · ${num(t.fluid.salinityWtPercent,1)} wt% NaCl.`,'small'));
  // Profiles
  if(t.inputs.profileMonths.length){
   results.append(el('h4',`Pressure against distance (${t.labels.profiles})`));
   if(t.inputs.rock.skin<0)results.append(el('p',NEGATIVE_SKIN_NOTE,'small'));
   for(const month of t.inputs.profileMonths){
    const p=profileState(t,month);
    if(p.kind!=='points'){results.append(el('p',`${month}: ${p.text}`));continue;}
    results.append(scroll(table(['Distance from the well (ft)','Rise above initial (psi)'],p.points.map(x=>[num(x.rFt,x.rFt<10?2:0),num(x.risePsi,2)]),`${month}: ${t.labels.profiles}`),`Pressure against distance, ${month}`));
   }
  }
  // Average rise and the manual hand-off (closed boundary)
  if(t.averageRise?.length){
   results.append(el('h4','Average pressure rise (closed boundary; excludes skin)'));
   results.append(scroll(table(['Month','Average rise (psi)'],t.averageRise.map(a=>[a.month,num(a.psi,1)]),'Average rise above initial, material balance in the closed circle'),'Average pressure rise'));
   if(t.handoff)results.append(el('p',`Average rise at month ${t.handoff.month}: ${num(t.handoff.psi,1)} psi (closed boundary)`),el('p',HANDOFF_NOTE,'small'));
   else if(reason)results.append(el('p',`Average rise at the end of the schedule: not shown (${reason})`,'small'));
  }else if(t.averageRise&&reason)results.append(el('p',`Average pressure rise: not shown (${reason})`,'small'));
  if(t.warnings.length){results.append(el('h4','Warnings'));const ul=el('ul');for(const x of t.warnings)ul.append(el('li',x));results.append(ul);}
  if(t.sensitivity.length){
   const v=t.inputs.sensitivity;
   const srows=t.sensitivity.flatMap(s=>['low','high'].map(side=>[FACTOR_LABEL[s.factor],side,String(v[s.factor][side]),limitText(s[side].limitStatus,s[side].firstMonthAtLimit,null),typeof s[side].endBottomholePsia==='number'?num(s[side].endBottomholePsia,1):'not shown (a month is blocked)']));
   results.append(el('h4','Sensitivity'));
   results.append(scroll(table(['Factor','Side','Value (assumed)','First month at the limit','End bottomhole (psia)'],srows,t.labels.sensitivity),'Sensitivity results'));
  }
  results.append(el('h4','Assumptions'));const al=el('ul',undefined,'small');for(const a of t.assumptions)al.append(el('li',a));results.append(al);
  results.append(el('p',`Labels: rock ${t.labels.rock} · boundary ${t.labels.boundary} · schedule ${t.labels.schedule} · pressures ${t.labels.pressures}.`,'small'));
  results.append(el('p',CLOSING_7,'small'));
 }
 function render(){
  const snap=session.snapshot();
  if(!snap.ready){root.hidden=true;status.textContent=NO_CASE;results.replaceChildren();inputsBox.replaceChildren();scheduleBox.replaceChildren();sensBox.replaceChildren();errors.replaceChildren();renderedDraft=null;renderedOutput=undefined;calc.disabled=true;jsonBtn.disabled=csvBtn.disabled=true;
   nControls.replaceChildren();nOffsets.replaceChildren();nSensBox.replaceChildren();nResults.replaceChildren();nErrors.replaceChildren();nNotes.clear();renderedNearby=null;renderedNearbyOutput=undefined;nRun.disabled=true;nJson.disabled=nCsv.disabled=true;return;}
  root.hidden=false;
  const key=shapeKey(snap);if(key!==renderedDraft){renderedDraft=key;renderInputs(snap);}
  renderNotes(snap);
  if(snap.output!==renderedOutput){renderedOutput=snap.output;renderResults(snap.output);}
  errors.replaceChildren();
  const list=[...(actionError?[actionError]:[]),...(snap.error?[snap.error]:[]),...snap.messages];for(const m of list)errors.append(el('li',m));
  status.textContent=snap.status==='calculating'?'Calculating the pressure buildup…':snap.output?'Calculated from assumed rock and the rate schedule. Editing any input withdraws the result.':snap.messages.length?'Complete the inputs listed below to calculate.':'Ready to calculate.';
  calc.disabled=!snap.canCalculate;jsonBtn.disabled=csvBtn.disabled=exporting||!snap.output;
  renderNearby(snap);
 }
 // ---- Nearby wells DOM ----
 function nBind(input,key,set){input.dataset.key=key;input.addEventListener('input',()=>{cancel('nearby');set(parseNumber(input.value));refocus(key);});}
 function radioPair(legend,name,key,value,options,set){
  const fs=el('fieldset');fs.style.minWidth='0';fs.append(el('legend',legend));
  for(const [v,label] of options){const l=el('label'),r=el('input');r.type='radio';r.name=name;r.value=String(v);r.checked=value===v;r.dataset.key=key+'.'+v;
   r.addEventListener('change',()=>{if(r.checked){cancel('nearby');set(v);refocus(key+'.'+v);}});l.append(r,document.createTextNode(' '+label));fs.append(l);}
  return fs;
 }
 function renderNearbyInputs(snap){
  const n=snap.nearby;nControls.replaceChildren();nOffsets.replaceChildren();nSensBox.replaceChildren();nPackages.replaceChildren();nNotes.clear();
  for(const p of n.packages){
   const li=el('li',`UIC ${p.uic} · ${p.window.startMonth} to ${p.window.endMonth} · ${p.artifactId}${p.window.source==='rows'?' · window from reported rows (legacy package)':''} `);
   const rm=el('button','Remove');rm.type='button';rm.setAttribute('aria-label',`Remove ${p.artifactId}`);
   rm.onclick=()=>{cancel('nearby');session.removePackage(p.artifactId);nFile.focus();};li.append(rm);nPackages.append(li);
  }
  if(!n.packages.length){nPackages.append(el('li','No offset well packages loaded.'));return;}
  const top=el('div',undefined,'disposal-controls');
  const tl=el('label','Pressure as of (t_ref, month, assumed, optional)'),tr=el('input');tr.type='month';tr.value=n.tRef??'';tr.dataset.key='n.tref';tl.append(tr);
  tr.addEventListener('input',()=>{cancel('nearby');session.setTRef(tr.value||null);refocus('n.tref');});
  const rl=el('label','Ranking month (optional)'),rk=el('input');rk.type='month';rk.value=n.rankingTyped?n.rankingMonth:'';rk.dataset.key='n.rank';rl.append(rk);
  // Applied on change (not while typing): the gap-month lists follow the ranking month and are rebuilt with it.
  rk.addEventListener('change',()=>{cancel('nearby');session.setRankingMonth(rk.value||null);refocus('n.rank');});
  top.append(tl,rl);nControls.append(top);
  const rankNote=el('p','','small');nNotes.set('rank',rankNote);
  nControls.append(el('p','With a pressure-as-of month, the subject well\'s rate schedule must start the month after it; without one, results are rise above undisturbed pressure only.','small'),rankNote);
  for(const o of n.offsets){
   const c=o.choice,u=o.uic,k=x=>`n.${u}.${x}`;
   const fs=el('fieldset');fs.style.minWidth='0';fs.append(el('legend',`UIC ${u}`));
   const ev=el('ul',undefined,'small');ev.setAttribute('aria-label',`Evidence for UIC ${u} (display only)`);
   ev.append(el('li',`Window: ${o.window.startMonth} to ${o.window.endMonth} (${fmtNumber(o.counts.reported)} reported, ${fmtNumber(o.counts.reportedZero)} reported zero, ${fmtNumber(o.counts.gap)} with no H-10 row)`));
   for(const x of o.intervals)ev.append(el('li',`Permitted interval: ${x}`));
   const dn=el('li','');ev.append(dn);nNotes.set(k('dist'),dn);
   fs.append(ev);
   const row=el('div',undefined,'disposal-controls');
   const [dl,di]=numberInput('Distance to the subject well (ft, assumed)',c.distanceFt);nBind(di,k('distanceFt'),v=>session.setOffset(u,'distanceFt',v));row.append(dl);
   fs.append(row);
   fs.append(radioPair('Connected to the subject well\'s layer? (assumed; no default)',`n-conn-${u}`,k('connected'),c.connected,[[true,'connected (assumed)'],[false,'not connected ('+EXCLUDED+')']],v=>session.setOffset(u,'connected',v)));
   if(o.needsZeros)fs.append(radioPair(`Treat reported zero months (${o.zeroMonths.join(', ')}) as shut in? (no default)`,`n-zero-${u}`,k('zeros'),c.zerosAreShutIn,[[true,'yes, shut in (0 STB/day)'],[false,'no, they are gap months to fill']],v=>session.setOffset(u,'zerosAreShutIn',v)));
   const gn=el('p','','small');nNotes.set(k('gaps'),gn);fs.append(gn);
   if(o.gapMonths.length){
    const t=el('table');t.append(el('caption','Gap months: type an assumed rate (0 = shut in); an empty month stays unfilled, never 0'));
    const h=el('thead'),hr=el('tr');for(const label of ['Month','Rate (STB/day, assumed)']){const th=el('th',label);th.scope='col';hr.append(th);}h.append(hr);t.append(h);
    const b=el('tbody');
    for(const m of o.gapMonths){const tr2=el('tr'),td=el('td'),i=el('input');i.type='number';i.step='any';i.min='0';i.value=c.gapRates[m]===undefined||c.gapRates[m]===null?'':String(c.gapRates[m]);i.setAttribute('aria-label',`UIC ${u} gap rate for ${m}`);
     nBind(i,k('gap.'+m),v=>session.setGapRate(u,m,v));td.append(i);tr2.append(el('td',m),td);b.append(tr2);}
    t.append(b);fs.append(scroll(t,`UIC ${u} gap months`));
   }
   const pr=el('div',undefined,'disposal-controls');
   const pl=el('label','Prior rate start month (assumed, optional)'),ps=el('input');ps.type='month';ps.value=c.priorStart??'';ps.dataset.key=k('priorStart');pl.append(ps);
   ps.addEventListener('input',()=>{cancel('nearby');session.setOffset(u,'priorStart',ps.value||null);refocus(k('priorStart'));});
   const [ql,qi]=numberInput('Prior rate before the window (STB/day, assumed, optional)',c.priorRate);nBind(qi,k('priorRate'),v=>session.setOffset(u,'priorRate',v));
   const al=el('label','After last report'),as=el('select');as.dataset.key=k('after');
   for(const [v,t] of [['','Choose… (no default)'],['shut-in','Shut in after last report'],['hold-average','Hold the average of the last N reported months'],['typed','Typed rate']]){const op=el('option',t);op.value=v;as.append(op);}
   as.value=c.afterKind??'';al.append(as);as.addEventListener('change',()=>{cancel('nearby');session.setOffset(u,'afterKind',as.value||null);refocus(k('after'));});
   pr.append(pl,ql,al);
   if(c.afterKind==='hold-average'){const [l,i]=numberInput('N (reported months to average)',c.afterLastN);nBind(i,k('afterLastN'),v=>session.setOffset(u,'afterLastN',v));pr.append(l);}
   if(c.afterKind==='typed'){const [l,i]=numberInput('Rate after last report (STB/day, assumed)',c.afterRate);nBind(i,k('afterRate'),v=>session.setOffset(u,'afterRate',v));pr.append(l);}
   const [sl,si]=numberInput('Sensitivity distance low (ft, optional)',c.sensLow);nBind(si,k('sensLow'),v=>session.setOffset(u,'sensLow',v));
   const [hl,hi]=numberInput('Sensitivity distance high (ft, optional)',c.sensHigh);nBind(hi,k('sensHigh'),v=>session.setOffset(u,'sensHigh',v));
   pr.append(sl,hl);fs.append(pr);nOffsets.append(fs);
  }
  const sv=el('fieldset');sv.style.minWidth='0';sv.append(el('legend','Sensitivity low/high (assumed; one at a time; optional)'));
  const sc=el('div',undefined,'disposal-controls');
  for(const [f,label] of [['k','k (md)'],['cf','c_f (1/psi)']])for(const side of ['low','high']){const [l,i]=numberInput(`Sensitivity ${label} ${side}`,n.sensitivity[f][side]);nBind(i,`n.sens.${f}.${side}`,v=>session.setNearbySensitivity(f,side,v));sc.append(l);}
  sv.append(sc);nSensBox.append(sv);
 }
 /** Text that changes while typing (distance evidence, gap count, ranking month used) is updated in place, without rebuilding inputs. */
 function updateNearbyNotes(n){
  nNotes.get('rank')&&(nNotes.get('rank').textContent=n.rankingMonth?`Ranking month used: ${n.rankingMonth}${n.rankingTyped?' (typed)':' (default: the last month covered by every loaded package)'}`:'');
  for(const o of n.offsets){
   const d=nNotes.get(`n.${o.uic}.dist`);if(d)d.textContent=finite(o.choice.distanceFt)?`Distance: ${distText(o.choice.distanceFt)}, typed`:'Distance: not typed';
   const g=nNotes.get(`n.${o.uic}.gaps`);if(g)g.textContent=o.gapMonths.length?`${fmtNumber(o.unfilled)} of ${fmtNumber(o.gapMonths.length)} gap month${o.gapMonths.length===1?'':'s'} to fill (an unfilled month leaves this well incomplete, with no number)`:'No gap months to fill.';
  }
 }
 const SENS_FACTOR=f=>f==='k'?'k (md)':f==='cf'?'c_f (1/psi)':`distance, UIC ${f.slice('distance:'.length)} (ft)`;
 function renderNearbyResults(r,tr){
  nResults.replaceChildren();if(!r)return;
  const withRef=r.mode==='since-t-ref',cell=v=>v===null?'not shown':fmtNumber(v,1);
  nResults.append(el('h4','Interference screening (calculated)'),el('p',RANKING_LABEL,'case-warning'));
  const ll=el('ul',undefined,'small');for(const l of r.labels)ll.append(el('li',l));nResults.append(ll);
  nResults.append(el('p',`Ranking month: ${r.inputs.rankingMonth}${withRef?` · pressure as of ${r.inputs.tRef} (assumed)`:''}`,'small'));
  const grid=el('div');grid.style.display='flex';grid.style.flexWrap='wrap';grid.style.gap='1rem';grid.style.alignItems='flex-start';
  for(const v of r.views){
   const box=el('div');box.style.flex='1 1 280px';box.style.minWidth='0';const name=VIEW_TITLE[v.name];
   box.append(el('h5',`${name}: ${v.status}`));
   box.append(scroll(table(['UIC','Status','Added psi','Share','Distance'],v.rows.map(rankingCells),`${name}: ${RANKING_LABEL}`),`Ranking, ${name}`));
   const lines=rowLabelLines(v);
   if(lines.length){const ul=el('ul',undefined,'small');ul.setAttribute('aria-label',`Row labels, ${name}`);for(const x of lines)ul.append(el('li',x));box.append(ul);}
   box.append(el('p',`Total added at the subject well: ${totalText(v)}`));
   if(v.shareNote)box.append(el('p',v.shareNote,'small'));
   const lm=limitMonthText(r,v,tr);if(lm!==null)box.append(el('p',`First month at the limit: ${lm}`));
   if(withRef&&v.removalEffects.length){box.append(el('p',REMOVAL_LABEL,'small'));const ul=el('ul',undefined,'small');for(const e of v.removalEffects)ul.append(el('li',removalText(e)));box.append(ul);}
   const counted=v.rows.some(x=>x.status!=='excluded');
   const d=el('details');d.append(el('summary','Monthly at the subject well'));
   d.append(scroll(table(['Month','Own rise (psi, calculated)','Offsets added (psi, calculated)',...(withRef?['Bottomhole (psia, calculated)']:[])],
    v.monthly.map(m=>[m.month,cell(m.ownRisePsi),m.offsetsPsi===null&&!counted?'no offsets counted':cell(m.offsetsPsi),...(withRef?[cell(m.bottomholePsia)]:[])]),`${name}: monthly values at the subject well; not shown means unavailable, never 0`),`Monthly, ${name}`));
   box.append(d);grid.append(box);
  }
  nResults.append(grid);
  if(r.sensitivity.length){
   const us=Object.keys(r.sensitivity[0].rangeByUic);
   nResults.append(el('h4','Sensitivity (one at a time)'));
   nResults.append(scroll(table(['Factor','Rank order',...us.map(u=>`UIC ${u} added psi range`)],r.sensitivity.map(x=>[SENS_FACTOR(x.factor),x.rankChanged?'rank changes':'rank unchanged',...us.map(u=>{const g=x.rangeByUic[u];return g.low===null?'no number':`${fmtNumber(g.low,1)} to ${fmtNumber(g.high,1)}`;})]),'Added psi range per offset under each factor\'s low and high values'),'Interference sensitivity'));
  }
  if(r.indistinguishable.length){const ul=el('ul',undefined,'small');for(const [a,b] of r.indistinguishable)ul.append(el('li',`UICs ${a} and ${b}: ${INDISTINGUISHABLE}`));nResults.append(ul);}
  if(r.warnings.length){nResults.append(el('h4','Warnings'));const ul=el('ul');for(const x of r.warnings)ul.append(el('li',x));nResults.append(ul);}
  nResults.append(el('h4','Assumptions'));const al=el('ul',undefined,'small');for(const a of r.assumptions)al.append(el('li',a));nResults.append(al);
  nResults.append(el('p',CLOSING_8,'small'));
 }
 function renderNearby(snap){
  const n=snap.nearby,first=n.messages[0]===SETUP_FIRST;
  nSetup.hidden=!first;nBody.hidden=first;
  const key=nearbyShapeKey(snap);if(key!==renderedNearby){renderedNearby=key;renderNearbyInputs(snap);}
  updateNearbyNotes(n);
  if(n.output!==renderedNearbyOutput){renderedNearbyOutput=n.output;renderNearbyResults(n.output,n.transient);}
  nErrors.replaceChildren();for(const m of [...(n.error?[n.error]:[]),...(first?[]:n.messages)])nErrors.append(el('li',m));
  nStatus.textContent=n.status==='running'?'Running the interference screening…':n.output?'Screening calculated from assumed rock, typed distances and your choices. Changing any input withdraws it.':n.messages.length?'Complete the inputs listed above to run.':'Ready to run.';
  nRun.disabled=!n.canRun;nJson.disabled=nCsv.disabled=nExporting||!n.output;
 }
 nFile.addEventListener('change',async()=>{
  const files=[...nFile.files],errs=[];nLoadError.textContent='';
  for(const f of files){
   try{const v=await verifyExplorerPackage(new Uint8Array(await f.arrayBuffer()));const out=session.loadPackage(v);if(out.error)errs.push(`${f.name}: ${out.error}`);else cancel('nearby');}
   catch(x){errs.push(`${f.name}: ${msg(x)}`);}
  }
  nLoadError.textContent=errs.join(' ');nFile.value='';nFile.focus();
 });
 nForm.addEventListener('submit',async e=>{e.preventDefault();
  // Input messages are listed live and a refusal is kept in the session snapshot, so nothing more is shown here.
  try{await session.runInterference();}catch{render();}});
 async function exportNearby(format){
  if(nExporting||!session.snapshot().nearby.output)return;
  nExporting=true;nJson.disabled=nCsv.disabled=true;const prior=nStatus.textContent;nStatus.textContent='Re-verifying the interference screening before download…';
  try{
   const out=await session.exportInterference(format,async(sealed,f)=>(await request('nearbyVerify','verify',{sealed,format:f})).text);
   if(out.cancelled)nStatus.textContent='Export cancelled: results changed. Download again.';
   else{download(out.text,out.filename,out.mime);nStatus.textContent=prior;}
  }catch(x){nStatus.textContent='Export blocked: '+msg(x);}
  finally{nExporting=false;const s=session.snapshot().nearby;nJson.disabled=nCsv.disabled=!s.output;}
 }
 nJson.onclick=()=>exportNearby('json');nCsv.onclick=()=>exportNearby('csv');
 form.addEventListener('submit',async e=>{e.preventDefault();actionError='';
  // Validation messages are listed live and a worker error is kept in the session snapshot, so nothing more is shown here.
  try{await session.calculate();}catch{render();}});
 async function exportResult(format){
  if(exporting||!session.snapshot().output)return;
  exporting=true;jsonBtn.disabled=csvBtn.disabled=true;const prior=status.textContent;status.textContent='Re-verifying the pressure buildup before download…';
  try{
   const out=await session.exportTransient(format,async(sealed,f)=>(await request('verify','verify',{sealed,format:f})).text);
   if(out.cancelled)status.textContent='Export cancelled: results changed. Download again.';
   else{download(out.text,out.filename,out.mime);status.textContent=prior;}
  }catch(x){status.textContent='Export blocked: '+msg(x);}
  finally{exporting=false;const s=session.snapshot();jsonBtn.disabled=csvBtn.disabled=!s.output;}
 }
 jsonBtn.onclick=()=>exportResult('json');csvBtn.onclick=()=>exportResult('csv');
 document.addEventListener('disposal-case-result',event=>{cancel();session.onCaseResult(event.detail.result);});
 document.addEventListener('disposal-case-invalidated',()=>{cancel();session.onInvalidated();});
 document.addEventListener('workspace-source',()=>{cancel();session.onSourceSwitch();});
 return session;
}
