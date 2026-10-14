import { daysInMonth, monthIndex, monthsBetween } from './planning.js';

/** Synthetic producer/injector context: an investigation view, not a pressure-support, causation or connectivity determination. */
export const CONTEXT_INPUT_VERSION='pressure-support-input/1';
export const CONTEXT_METHOD_VERSION='pressure-support-context/1';
export const PRODUCER_VOLUME_UNIT='STB';
export const INJECTOR_VOLUME_UNIT='bbl';
export const VOLUME_BASIS='calendar-month';
export const DISTANCE_UNIT='mi';

export type ContextClassification='synthetic';
export type SourceDeclaration={sourceId:string;classification:'synthetic'|'assumed';description:string};
export type ProducerRecord={producerId:string;name:string;classification:ContextClassification};
export type InjectorRecord={injectorId:string;name:string;classification:ContextClassification};
export type ProducerMonthRow={rowId:string;sourceId:string;producerId:string;month:string;oilVolumeBbl:number|null;waterVolumeBbl:number|null;volumeUnit:'STB';basis:'calendar-month';classification:ContextClassification};
export type InjectorMonthRow={rowId:string;sourceId:string;injectorId:string;month:string;volumeBbl:number|null;volumeUnit:'bbl';basis:'calendar-month';classification:ContextClassification};
export type AssociationRow={rowId:string;sourceId:string;producerId:string;injectorId:string;distance:number;distanceUnit:'mi';origin:'assumed';classification:ContextClassification};
export type EventRow={rowId:string;sourceId:string;eventId:string;producerId:string;date:string;kind:'frac';citation:string;classification:ContextClassification;uncertainty?:string};
export type ContextDataset={version:typeof CONTEXT_INPUT_VERSION;fixtureVersion:number;seed?:number;datasetId:string;name:string;classification:ContextClassification;
  coverage:{firstMonth:string;lastMonth:string};sources:SourceDeclaration[];producers:ProducerRecord[];injectors:InjectorRecord[];
  producerMonthly:ProducerMonthRow[];injectorMonthly:InjectorMonthRow[];associations:AssociationRow[];events:EventRow[]};
export type ContextIssue={scope:'dataset'|'row';section?:string;rowId?:string;message:string};
export type Readiness={ready:boolean;reasons:string[]};
export type ContextValidation={datasetBlocked:boolean;issues:ContextIssue[];dataset:ContextDataset|null;sha256:string|null;
  producers:Record<string,Readiness>;injectors:Record<string,Readiness>;associations:Record<string,Readiness>};
export type ContextSelection={producerId:string;injectorIds:string[];firstMonth:string;lastMonth:string};
export type ContextMonth={month:string;oilRateStbd:number|null;waterRateStbd:number|null;liquidRateStbd:number|null;waterCutPct:number|null;
  injectorVolumesBbl:Record<string,number|null>;completeInjectionVolumeBbl:number|null;missingReasons:string[]};
export type ContextEvent=EventRow&{withinCoverage:boolean;withinSelection:boolean};
export type ContextResult={ready:boolean;reasons:string[];monthly:ContextMonth[];events:ContextEvent[];
  sourceRows:{producerMonthly:ProducerMonthRow[];injectorMonthly:InjectorMonthRow[];associations:AssociationRow[];events:EventRow[]};
  method:{version:typeof CONTEXT_METHOD_VERSION;formulas:string[]};source:{datasetId:string;sha256:string}|null;
  selection:unknown;classification:ContextClassification|null;assumptions:string[]};

const FORMULAS=Object.freeze([
  'rate (STB/day) = monthly stock-tank volume / calendar days in the UTC month',
  'liquid rate = (oil + water) / calendar days; gas excluded',
  'water cut (%) = water / (oil + water) x 100; unavailable when either input is missing or total liquid is zero',
  'complete injection (bbl/month) = sum of selected injector volumes, only when every selected contribution is present']);
const ASSUMPTIONS=Object.freeze([
  'All observations and events are synthetic; no actual API, UIC or public producer is represented.',
  'Producer/injector associations and distances are declared assumptions, not GIS proximity or hydraulic connectivity.',
  'Injection bbl/month and producer STB/day are different quantities on separate scales.',
  'Frac events are annotations only; they do not change fits, cutoffs, forecasts or capacity.',
  'This is an investigation view, not a determination of pressure support, causation or interwell connectivity.']);

const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const isId=(v:unknown):v is string=>typeof v==='string'&&v.trim()!==''&&v===v.trim();
const isMonth=(v:unknown):v is string=>{if(typeof v!=='string') return false;try {monthIndex(v);return true;} catch {return false;}};
const isVolume=(v:unknown)=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0);
function isDate(v:unknown):v is string {
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!isMonth(v.slice(0,7))) return false;
  const day=Number(v.slice(8));return day>=1&&day<=daysInMonth(v.slice(0,7));
}
function deepFreeze<T>(value:T):T {if(typeof value==='object'&&value!==null&&!Object.isFrozen(value)) {Object.freeze(value);for(const v of Object.values(value)) deepFreeze(v);}return value;}
const pairKey=(producerId:string,injectorId:string)=>JSON.stringify([producerId,injectorId]);
const ARRAYS=['sources','producers','injectors','producerMonthly','injectorMonthly','associations','events'] as const;

/** Validate an untrusted context document without repairing it; missing observations (null) remain valid. */
export function validatePressureContext(raw:unknown,provenance:{sha256?:string}={}):ContextValidation {
  const issues:ContextIssue[]=[];
  const sha256=typeof provenance.sha256==='string'&&/^[0-9a-f]{64}$/.test(provenance.sha256)?provenance.sha256:null;
  const fail=(message:string):ContextValidation=>({datasetBlocked:true,issues:[...issues,{scope:'dataset',message}],dataset:null,sha256,producers:{},injectors:{},associations:{}});
  if(!isObject(raw)) return fail('Dataset root must be an object');
  if(raw.version!==CONTEXT_INPUT_VERSION) return fail(`Unsupported dataset version ${JSON.stringify(raw.version)}; expected ${CONTEXT_INPUT_VERSION}`);
  if(!isId(raw.datasetId)||typeof raw.name!=='string') return fail('Dataset datasetId and name are required');
  if(!Number.isSafeInteger(raw.fixtureVersion)||(raw.fixtureVersion as number)<1) return fail('Dataset fixtureVersion must be a positive integer');
  if(raw.classification!=='synthetic') return fail(`Unsupported dataset classification ${JSON.stringify(raw.classification)}; only synthetic context is supported`);
  const coverage=raw.coverage;
  if(!isObject(coverage)||!isMonth(coverage.firstMonth)||!isMonth(coverage.lastMonth)||coverage.lastMonth<coverage.firstMonth)
    return fail('Declared coverage must be ordered YYYY-MM months');
  for(const key of ARRAYS) if(!Array.isArray(raw[key])) return fail(`Dataset ${key} must be an array`);
  for(const key of ARRAYS) for(const row of raw[key] as unknown[]) if(!isObject(row)) return fail(`Every ${key} entry must be an object`);
  const rowsOf=(key:typeof ARRAYS[number])=>raw[key] as Record<string,unknown>[];
  // Unsupported units or bases change the meaning of every series, so they block the whole dataset.
  for(const r of rowsOf('producerMonthly')) {
    if(r.volumeUnit!==PRODUCER_VOLUME_UNIT) return fail(`Unsupported producer volume unit ${JSON.stringify(r.volumeUnit)} in row ${String(r.rowId)}`);
    if(r.basis!==VOLUME_BASIS) return fail(`Unsupported producer volume basis ${JSON.stringify(r.basis)} in row ${String(r.rowId)}`);
  }
  for(const r of rowsOf('injectorMonthly')) {
    if(r.volumeUnit!==INJECTOR_VOLUME_UNIT) return fail(`Unsupported injector volume unit ${JSON.stringify(r.volumeUnit)} in row ${String(r.rowId)}`);
    if(r.basis!==VOLUME_BASIS) return fail(`Unsupported injector volume basis ${JSON.stringify(r.basis)} in row ${String(r.rowId)}`);
  }
  for(const r of rowsOf('associations')) if(r.distanceUnit!==DISTANCE_UNIT) return fail(`Unsupported distance unit ${JSON.stringify(r.distanceUnit)} in row ${String(r.rowId)}`);
  const sources=new Map<string,unknown>();
  for(const s of rowsOf('sources')) {
    if(!isId(s.sourceId)||!['synthetic','assumed'].includes(s.classification as string)) return fail(`Invalid source declaration ${JSON.stringify(s.sourceId)}`);
    if(sources.has(s.sourceId)) return fail(`Duplicate source declaration ${s.sourceId}`);
    sources.set(s.sourceId,s);
  }

  const producerReasons=new Map<string,string[]>(),injectorReasons=new Map<string,string[]>(),associationReasons=new Map<string,string[]>();
  const declare=(records:Record<string,unknown>[],key:'producerId'|'injectorId',reasons:Map<string,string[]>,label:string)=>{
    for(const r of records) {
      const id=r[key];
      if(!isId(id)) {issues.push({scope:'row',section:`${label}s`,message:`Invalid ${label} identity ${JSON.stringify(id)}`});continue;}
      if(reasons.has(id)) reasons.get(id)!.push(`Duplicate ${label} identity ${id}`);else reasons.set(id,[]);
      if(r.classification!=='synthetic') reasons.get(id)!.push(`${label} ${id} classification must be synthetic`);
    }
  };
  declare(rowsOf('producers'),'producerId',producerReasons,'producer');
  declare(rowsOf('injectors'),'injectorId',injectorReasons,'injector');
  for(const [id,reasons] of [...producerReasons,...injectorReasons]) for(const message of reasons) issues.push({scope:'row',message:`${message} (${id})`});

  const blockProducer=(id:unknown,message:string)=>{if(isId(id)&&producerReasons.has(id)) producerReasons.get(id)!.push(message);};
  const blockInjector=(id:unknown,message:string)=>{if(isId(id)&&injectorReasons.has(id)) injectorReasons.get(id)!.push(message);};
  type Owner=(message:string)=>void;
  const rowOwners:[string,Record<string,unknown>,Owner][]=[
    ...rowsOf('producerMonthly').map(r=>['producerMonthly',r,(m:string)=>blockProducer(r.producerId,m)] as [string,Record<string,unknown>,Owner]),
    ...rowsOf('injectorMonthly').map(r=>['injectorMonthly',r,(m:string)=>blockInjector(r.injectorId,m)] as [string,Record<string,unknown>,Owner]),
    ...rowsOf('associations').map(r=>['associations',r,(m:string)=>{
      if(isId(r.producerId)&&isId(r.injectorId)) {const k=pairKey(r.producerId,r.injectorId);associationReasons.set(k,[...(associationReasons.get(k)??[]),m]);}
    }] as [string,Record<string,unknown>,Owner]),
    ...rowsOf('events').map(r=>['events',r,(m:string)=>blockProducer(r.producerId,m)] as [string,Record<string,unknown>,Owner]),
  ];
  const report=(section:string,row:Record<string,unknown>,owner:Owner,message:string)=>{
    issues.push({scope:'row',section,...(isId(row.rowId)?{rowId:row.rowId}:{}),message});owner(message);
  };
  const seenRows=new Map<string,number>();
  for(const [,row] of rowOwners) if(isId(row.rowId)) seenRows.set(row.rowId,(seenRows.get(row.rowId)??0)+1);
  for(const [section,row,owner] of rowOwners) {
    const id=String(row.rowId);
    if(!isId(row.rowId)) report(section,row,owner,`Invalid rowId ${JSON.stringify(row.rowId)} in ${section}`);
    else if(seenRows.get(row.rowId)!>1) report(section,row,owner,`Duplicate row identity ${id}`);
    if(!isId(row.sourceId)||!sources.has(row.sourceId)) report(section,row,owner,`Row ${id} cites undeclared source ${JSON.stringify(row.sourceId)}`);
    if(row.classification!=='synthetic') report(section,row,owner,`Row ${id} classification must be synthetic`);
  }

  const inCoverage=(month:string)=>month>=(coverage.firstMonth as string)&&month<=(coverage.lastMonth as string);
  const monthlyChecks=(section:'producerMonthly'|'injectorMonthly',key:'producerId'|'injectorId',known:Map<string,string[]>,block:(id:unknown,m:string)=>void,fields:string[])=>{
    const seen=new Map<string,string>();
    for(const r of rowsOf(section)) {
      const id=String(r.rowId),owner:Owner=m=>block(r[key],m);
      if(!isId(r[key])||!known.has(r[key] as string)) {report(section,r,owner,`Row ${id} references unknown ${key} ${JSON.stringify(r[key])}`);continue;}
      if(!isMonth(r.month)) {report(section,r,owner,`Row ${id} has invalid month ${JSON.stringify(r.month)}`);continue;}
      if(!inCoverage(r.month)) report(section,r,owner,`Row ${id} month ${r.month} is outside declared coverage`);
      for(const f of fields) if(!isVolume(r[f])) report(section,r,owner,`Row ${id} ${f} must be a finite non-negative number or null`);
      const k=JSON.stringify([r[key],r.month]),prior=seen.get(k);
      if(prior!==undefined) report(section,r,owner,`Conflicting records for ${r[key]} ${r.month} (rows ${prior}, ${id})`);else seen.set(k,id);
    }
  };
  monthlyChecks('producerMonthly','producerId',producerReasons,blockProducer,['oilVolumeBbl','waterVolumeBbl']);
  monthlyChecks('injectorMonthly','injectorId',injectorReasons,blockInjector,['volumeBbl']);

  const seenPairs=new Map<string,string>();
  for(const r of rowsOf('associations')) {
    const id=String(r.rowId),k=isId(r.producerId)&&isId(r.injectorId)?pairKey(r.producerId,r.injectorId):null;
    const owner:Owner=m=>{if(k) associationReasons.set(k,[...(associationReasons.get(k)??[]),m]);};
    if(!isId(r.producerId)||!producerReasons.has(r.producerId)) report('associations',r,owner,`Association ${id} references unknown producer ${JSON.stringify(r.producerId)}`);
    if(!isId(r.injectorId)||!injectorReasons.has(r.injectorId)) report('associations',r,owner,`Association ${id} references unknown injector ${JSON.stringify(r.injectorId)}`);
    if(!(typeof r.distance==='number'&&Number.isFinite(r.distance)&&r.distance>0)) report('associations',r,owner,`Association ${id} distance must be a finite positive number`);
    if(r.origin!=='assumed') report('associations',r,owner,`Association ${id} origin must be assumed`);
    if(k) {const prior=seenPairs.get(k);if(prior!==undefined) report('associations',r,owner,`Duplicate association ${r.producerId}/${r.injectorId} (rows ${prior}, ${id})`);else {seenPairs.set(k,id);associationReasons.set(k,associationReasons.get(k)??[]);}}
  }

  const seenEvents=new Map<string,Record<string,unknown>>();
  for(const r of rowsOf('events')) {
    const id=String(r.rowId),owner:Owner=m=>blockProducer(r.producerId,m);
    if(!isId(r.producerId)||!producerReasons.has(r.producerId)) report('events',r,owner,`Event row ${id} references unknown producer ${JSON.stringify(r.producerId)}`);
    if(!isDate(r.date)) report('events',r,owner,`Event row ${id} has invalid calendar date ${JSON.stringify(r.date)}`);
    if(r.kind!=='frac') report('events',r,owner,`Event row ${id} has unsupported kind ${JSON.stringify(r.kind)}`);
    if(typeof r.citation!=='string'||r.citation.trim()==='') report('events',r,owner,`Event row ${id} requires a citation`);
    if(r.uncertainty!==undefined&&typeof r.uncertainty!=='string') report('events',r,owner,`Event row ${id} uncertainty must be text`);
    if(!isId(r.eventId)) {report('events',r,owner,`Event row ${id} has invalid eventId`);continue;}
    const prior=seenEvents.get(r.eventId);
    if(prior) {const m=`Duplicate event identity ${r.eventId} (rows ${String(prior.rowId)}, ${id})`;report('events',r,owner,m);blockProducer(prior.producerId,m);}
    else seenEvents.set(r.eventId,r);
  }

  const readiness=(map:Map<string,string[]>)=>Object.fromEntries([...map].map(([id,reasons])=>[id,{ready:reasons.length===0,reasons:[...new Set(reasons)]}]));
  return deepFreeze({datasetBlocked:false,issues,dataset:structuredClone(raw) as unknown as ContextDataset,sha256,
    producers:readiness(producerReasons),injectors:readiness(injectorReasons),associations:readiness(associationReasons)});
}

/** Hash the exact fixture bytes, then parse and validate them; the hash is never derived from normalized values. */
export async function loadPressureContext(bytes:Uint8Array):Promise<ContextValidation> {
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)));
  const sha256=[...digest].map(b=>b.toString(16).padStart(2,'0')).join('');
  let raw:unknown;
  try {raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch {return {datasetBlocked:true,issues:[{scope:'dataset',message:'Dataset bytes are not valid UTF-8 JSON'}],dataset:null,sha256,producers:{},injectors:{},associations:{}};}
  return validatePressureContext(raw,{sha256});
}

function selectionReasons(v:ContextValidation,selection:unknown):string[] {
  if(v.datasetBlocked||!v.dataset) return ['Dataset is blocked: '+v.issues.filter(i=>i.scope==='dataset').map(i=>i.message).join('; ')];
  const reasons:string[]=[];
  if(!v.sha256) reasons.push('Dataset bytes are not hash-verified');
  if(!isObject(selection)) return [...reasons,'Selection must be an object'];
  const {producerId,injectorIds,firstMonth,lastMonth}=selection,{coverage}=v.dataset;
  const has=(o:Record<string,Readiness>,id:string)=>Object.hasOwn(o,id);
  if(!isId(producerId)||!has(v.producers,producerId)) reasons.push(`Unknown producer ${String(producerId)}`);
  else if(!v.producers[producerId].ready) reasons.push(...v.producers[producerId].reasons.map(r=>`Producer ${producerId} blocked: ${r}`));
  if(!Array.isArray(injectorIds)||!injectorIds.every(isId)) reasons.push('Selection injectorIds must be an array of injector IDs');
  else {
    if(new Set(injectorIds).size!==injectorIds.length) reasons.push('Selected injector IDs must be distinct');
    else if(injectorIds.some((id,i)=>i>0&&injectorIds[i-1]>id)) reasons.push('Selected injector IDs must be sorted');
    for(const id of injectorIds) {
      if(!has(v.injectors,id)) {reasons.push(`Unknown injector ${id}`);continue;}
      if(!v.injectors[id].ready) reasons.push(...v.injectors[id].reasons.map(r=>`Injector ${id} blocked: ${r}`));
      if(!isId(producerId)) continue;
      const k=pairKey(producerId,id);
      if(!has(v.associations,k)) reasons.push(`Injector ${id} is not associated with producer ${producerId}`);
      else if(!v.associations[k].ready) reasons.push(...v.associations[k].reasons.map(r=>`Association ${producerId}/${id} blocked: ${r}`));
    }
  }
  if(!isMonth(firstMonth)) reasons.push(`Invalid first month ${JSON.stringify(firstMonth)}`);
  if(!isMonth(lastMonth)) reasons.push(`Invalid last month ${JSON.stringify(lastMonth)}`);
  if(isMonth(firstMonth)&&isMonth(lastMonth)) {
    if(lastMonth<firstMonth) reasons.push(`Selection months out of order: ${firstMonth} after ${lastMonth}`);
    if(firstMonth<coverage.firstMonth||lastMonth>coverage.lastMonth) reasons.push(`Selection ${firstMonth}..${lastMonth} is outside declared coverage ${coverage.firstMonth}..${coverage.lastMonth}`);
  }
  return reasons;
}

/** Pure monthly context for one producer and its declared associated injectors; invalid selections return no partial numbers. */
export function buildPressureContext(v:ContextValidation,selection:ContextSelection):ContextResult {
  const empty=(reasons:string[]):ContextResult=>deepFreeze({ready:false,reasons,monthly:[],events:[],
    sourceRows:{producerMonthly:[],injectorMonthly:[],associations:[],events:[]},method:{version:CONTEXT_METHOD_VERSION,formulas:[...FORMULAS]},
    source:v.dataset&&v.sha256?{datasetId:v.dataset.datasetId,sha256:v.sha256}:null,selection:structuredClone(selection) as unknown,
    classification:v.dataset?.classification??null,assumptions:[...ASSUMPTIONS]});
  const blockers=selectionReasons(v,selection);
  if(blockers.length) return empty(blockers);
  const d=v.dataset!,{producerId,injectorIds,firstMonth,lastMonth}=selection;
  const months=monthsBetween(firstMonth,lastMonth),inRange=(m:string)=>m>=firstMonth&&m<=lastMonth;
  const producerRows=d.producerMonthly.filter(r=>r.producerId===producerId&&inRange(r.month));
  const injectorRows=d.injectorMonthly.filter(r=>injectorIds.includes(r.injectorId)&&inRange(r.month));
  const byProducerMonth=new Map(producerRows.map(r=>[r.month,r]));
  const byInjectorMonth=new Map(injectorRows.map(r=>[JSON.stringify([r.injectorId,r.month]),r]));
  const overflow:string[]=[],notices=injectorIds.length?[]:['Select an associated injector'];
  const monthly=months.map((month):ContextMonth=>{
    const days=daysInMonth(month),missingReasons:string[]=[],row=byProducerMonth.get(month);
    if(!row) missingReasons.push(`No producer record for ${producerId} ${month}`);
    const oil=row?.oilVolumeBbl??null,water=row?.waterVolumeBbl??null;
    if(row&&oil===null) missingReasons.push(`Oil volume missing for ${producerId} ${month}`);
    if(row&&water===null) missingReasons.push(`Water volume missing for ${producerId} ${month}`);
    let liquidRateStbd:number|null=null,waterCutPct:number|null=null;
    if(oil!==null&&water!==null) {
      const total=oil+water;
      if(!Number.isFinite(total)) overflow.push(`Liquid volume overflow for ${producerId} ${month}`);
      else {
        liquidRateStbd=total/days;
        if(total===0) missingReasons.push(`Zero total liquid for ${producerId} ${month}; water cut unavailable`);
        else waterCutPct=water/total*100;
      }
    }
    const injectorVolumesBbl:Record<string,number|null>=Object.create(null);
    for(const id of injectorIds) {
      const r=byInjectorMonth.get(JSON.stringify([id,month]));
      injectorVolumesBbl[id]=r?.volumeBbl??null;
      if(!r) missingReasons.push(`No injection record for ${id} ${month}`);
      else if(r.volumeBbl===null) missingReasons.push(`Injection volume missing for ${id} ${month}`);
    }
    let completeInjectionVolumeBbl:number|null=null;
    if(!injectorIds.length) missingReasons.push('Select an associated injector');
    else if(injectorIds.every(id=>injectorVolumesBbl[id]!==null)) {
      const total=injectorIds.reduce((sum,id)=>sum+injectorVolumesBbl[id]!,0);
      if(!Number.isFinite(total)) overflow.push(`Injection total overflow for ${month}`);else completeInjectionVolumeBbl=total;
    }
    return {month,oilRateStbd:oil===null?null:oil/days,waterRateStbd:water===null?null:water/days,liquidRateStbd,waterCutPct,
      injectorVolumesBbl,completeInjectionVolumeBbl,missingReasons};
  });
  if(overflow.length) return empty(overflow);
  const producerEvents=d.events.filter(e=>e.producerId===producerId);
  const events=producerEvents.map(e=>({...e,withinCoverage:e.date.slice(0,7)>=d.coverage.firstMonth&&e.date.slice(0,7)<=d.coverage.lastMonth,withinSelection:inRange(e.date.slice(0,7))}))
    .sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.eventId<b.eventId?-1:a.eventId>b.eventId?1:0);
  return deepFreeze({ready:true,reasons:notices,monthly,events,
    sourceRows:structuredClone({producerMonthly:producerRows,injectorMonthly:injectorRows,
      associations:d.associations.filter(a=>a.producerId===producerId&&injectorIds.includes(a.injectorId)),events:producerEvents}),
    method:{version:CONTEXT_METHOD_VERSION,formulas:[...FORMULAS]},source:{datasetId:d.datasetId,sha256:v.sha256!},
    selection:{producerId,injectorIds:[...injectorIds],firstMonth,lastMonth},classification:d.classification,assumptions:[...ASSUMPTIONS]});
}
