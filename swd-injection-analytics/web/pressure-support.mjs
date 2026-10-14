import {loadPressureContext,buildPressureContext} from '../dist/pressureSupport.js';
import {renderPressureContextChart} from './pressure-support-chart.mjs';
import {sealPressureContext,pressureContextJson,pressureContextCsv,pressureContextSvg} from '../dist/pressureSupportExport.js';

/** Separate synthetic context tool: never adopts the planning source, confirmed inputs, forecasts or capacity results. */
export const PINNED_EXAMPLE=Object.freeze({url:'/data/pressure-support/example.json',sha256:'dfb32bed82341a78f54490754e13d01784b2e9ac670b9218160ea5af0a3b75ab',version:'pressure-support-input/1',bytes:30351});
export const MAX_EXAMPLE_BYTES=1024*1024;
const hex=buffer=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');

/** Fetch only the pinned local example; size is checked before hashing and bytes are verified before decoding. */
export async function loadPinnedExample(options={}){return (await loadPinnedExampleEvidence(options)).validation;}
/** Same verified load, also retaining the exact original bytes and pin for sealed exports. */
export async function loadPinnedExampleEvidence({fetch=globalThis.fetch,signal,pinned=PINNED_EXAMPLE}={}){
 const response=await fetch(pinned.url,{signal,cache:'no-store'});
 if(!response.ok)throw new Error(`Synthetic context example unavailable (HTTP ${response.status}).`);
 const buffer=await response.arrayBuffer();signal?.throwIfAborted();
 if(buffer.byteLength>MAX_EXAMPLE_BYTES)throw new Error(`Synthetic context example exceeds 1 MiB (${buffer.byteLength} bytes); it was not hashed or decoded.`);
 const bytes=new Uint8Array(buffer),sha256=hex(await crypto.subtle.digest('SHA-256',bytes));signal?.throwIfAborted();
 if(sha256!==pinned.sha256)throw new Error(`SHA-256 mismatch: expected ${pinned.sha256}, received ${sha256}. The example was not decoded.`);
 const validation=await loadPressureContext(bytes);signal?.throwIfAborted();
 if(validation.sha256!==pinned.sha256)throw new Error('Verified bytes and validated hash disagree.');
 if(validation.datasetBlocked)throw new Error(`Synthetic context example rejected: ${validation.issues.map(i=>i.message).join('; ')}`);
 if(validation.dataset.version!==pinned.version)throw new Error(`Unexpected context version ${validation.dataset.version}.`);
 return {validation,originalBytes:bytes,pin:pinned};
}

/** First declared producer with every explicitly associated injector over the full declared coverage. */
export function defaultSelection(validation){
 const d=validation.dataset,producerId=d.producers[0]?.producerId??'';
 return {producerId,injectorIds:associatedInjectors(validation,producerId).map(a=>a.injectorId),firstMonth:d.coverage.firstMonth,lastMonth:d.coverage.lastMonth};
}
export function associatedInjectors(validation,producerId){
 const seen=new Set();
 return validation.dataset.associations.filter(a=>a.producerId===producerId&&!seen.has(a.injectorId)&&seen.add(a.injectorId)).sort((a,b)=>a.injectorId<b.injectorId?-1:a.injectorId>b.injectorId?1:0);
}

/** Revisioned state: only the current revision may accept async work; every edit clears dependent results synchronously. */
export function createPressureContextState(){
 let revision=0,controller=null,pending=false,failed=false,input=null,evidence=null,selection=null,result=null,reasons=[];
 const stale=()=>{revision++;controller?.abort();controller=null;pending=false;};
 return {
  beginLoad(){stale();controller=new AbortController();pending=true;failed=false;input=null;evidence=null;selection=null;result=null;reasons=[];return {revision,signal:controller.signal};},
  acceptLoad(rev,validation,source=null){
   if(rev!==revision||!pending)return false;
   controller=null;pending=false;
   if(!validation||validation.datasetBlocked||!validation.dataset){failed=true;reasons=['Synthetic context example rejected.'];return false;}
   input=validation;evidence=source?{originalBytes:new Uint8Array(source.originalBytes),pin:source.pin}:null;selection=defaultSelection(validation);result=null;reasons=[];failed=false;return true;
  },
  failLoad(rev,message){if(rev!==revision||!pending)return false;controller=null;pending=false;failed=true;reasons=[message];return true;},
  cancel(){stale();input=null;evidence=null;selection=null;result=null;failed=false;reasons=['Load cancelled; reload the synthetic example explicitly to continue.'];},
  abortPending(reason){if(!pending)return false;stale();reasons=[reason];return true;},
  changeSelection(next){stale();selection=structuredClone(next);result=null;},
  invalidate(reason){stale();result=null;reasons=[reason];},
  calculate(){if(!input||!selection)return null;result=buildPressureContext(input,selection);reasons=result.ready?[]:[...result.reasons];return result;},
  /** Immutable request for the current ready result; null when stale, blocked or lacking retained source bytes. */
  exportRequest(){if(result?.ready!==true||!evidence)return null;return {revision,result,evidence:{originalBytes:evidence.originalBytes,sha256:input.sha256,pin:evidence.pin}};},
  isCurrent(request){return !!request&&request.revision===revision&&request.result===result&&result?.ready===true;},
  snapshot(){
   const d=input?.dataset;
   return {revision,pending,failed,selection:selection&&structuredClone(selection),result,reasons:[...reasons],exportReady:result?.ready===true,
    input:d?{datasetId:d.datasetId,name:d.name,sha256:input.sha256,classification:d.classification,coverage:{...d.coverage}}:null,validation:input};
  },
 };
}

const sealed=new WeakMap();
const FORMATS={json:['application/json',pressureContextJson],csv:['text/csv;charset=utf-8',pressureContextCsv],svg:['image/svg+xml',pressureContextSvg]};
/** Seal once per current result, then recheck the revision before returning any download; stale work returns null. */
export async function exportCurrentContext(state,format,{seal}={}){
 const request=state.exportRequest();if(!request||!FORMATS[format])return null;
 let artifact;
 if(seal)artifact=await seal(request.result,request.evidence);
 else{if(!sealed.has(request.result))sealed.set(request.result,sealPressureContext(request.result,request.evidence));artifact=await sealed.get(request.result);}
 if(!state.isCurrent(request))return null;
 const [mime,serialize]=FORMATS[format];
 return {artifact,mime,filename:`pressure-support-context-${artifact.resultSha256.slice(0,16)}.${format}`,text:serialize(artifact)};
}

/** Public/customer composition stays blocked; lists what is missing without offering a synthetic fallback. */
export function realDataAvailability(source){
 const notes={public:'Public injector history remains available under Injection & capacity → Injector history; it is not composed with this synthetic context.',
  user:'Confirmed water-only user histories remain usable in Histories; no synthetic values are substituted.',
  demo:'The synthetic planning demo is a different fixture and is not substituted into this context.'}[source]??'No planning source is selected; the synthetic context example stays separate.';
 return {ready:false,missing:[
  'Matched producer oil/water monthly stock-tank series with a declared calendar basis',
  'Producer/injector association evidence (identities, distance and units); no GIS inference is made',
  'Dated frac event inputs with citations and source rows',
  'A reviewed source composition contract (pressure-support-input/1 accepts synthetic context only)'],notes:[notes]};
}

const fmt=v=>v===null||v===undefined?'Unavailable':typeof v==='number'?v.toLocaleString('en-US',{maximumFractionDigits:2}):String(v);
export function mountPressureContext(root,{fetch=(...args)=>globalThis.fetch(...args)}={}){
 const state=createPressureContextState();let planningSource=null;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,cls)=>{const b=el('button',text,cls);b.type='button';return b;};
 const region=(label)=>{const r=el('div',undefined,'ps-scroll');r.setAttribute('role','region');r.setAttribute('aria-label',label);r.tabIndex=0;return r;};
 const table=(caption,headers,rows)=>{const t=el('table');t.append(el('caption',caption));const head=el('tr');for(const h of headers){const th=el('th',h);th.scope='col';head.append(th);}t.append(el('thead'));t.tHead.append(head);const body=el('tbody');for(const row of rows){const tr=el('tr');for(const cell of row)tr.append(el('td',fmt(cell)));body.append(tr);}t.append(body);return t;};
 const title=el('div',undefined,'workspace-title'),h1=el('h1','Pressure-support context');h1.id='pressure-support-title';h1.tabIndex=-1;
 title.append(h1,el('p','Inspect producer oil/water rates, water cut, selected nearby injection volumes and frac dates on one calendar axis.'));
 const notice=el('p','Synthetic investigation view only — not a determination of pressure support, causation or interwell connectivity. Separate from the active planning dataset: it never changes confirmed inputs, forecasts, schedules or capacity results.','ps-notice');
 const identity=el('section',undefined,'panel ps-identity');identity.setAttribute('aria-labelledby','ps-identity-title');const identityTitle=el('h2','Context dataset');identityTitle.id='ps-identity-title';const identityList=el('dl');identity.append(identityTitle,identityList);
 const loadPanel=el('section',undefined,'panel');loadPanel.setAttribute('aria-label','Load synthetic context');
 const load=button('Load synthetic example','primary-action'),cancel=button('Cancel load'),loadStatus=el('p');loadStatus.setAttribute('role','status');const loadError=el('p',undefined,'error');loadError.setAttribute('role','alert');
 const loadActions=el('div',undefined,'ps-actions');loadActions.append(load,cancel);loadPanel.append(el('h2','1. Load the pinned example'),el('p','Loads only the local fictional example after its exact bytes match the pinned SHA-256. Nothing loads automatically.','small'),loadActions,loadStatus,loadError);
 const form=el('form',undefined,'panel ps-selection');form.noValidate=true;form.setAttribute('aria-label','Context selection');
 const fields=el('fieldset');fields.disabled=true;fields.append(el('legend','2. Choose producer, injectors and period'));
 const producerLabel=el('label','Producer'),producer=el('select');producer.id='ps-producer';producerLabel.append(producer);
 const injectorSet=el('fieldset',undefined,'ps-injectors');const injectorLegend=el('legend','Declared associated injectors (assumed distance)');
 const firstLabel=el('label','First month'),first=el('input');first.type='month';firstLabel.append(first);
 const lastLabel=el('label','Last month'),last=el('input');last.type='month';lastLabel.append(last);
 const calculate=el('button','Calculate context');calculate.type='submit';calculate.className='primary-action';
 const controls=el('div',undefined,'ps-controls');controls.append(producerLabel,firstLabel,lastLabel);
 fields.append(controls,injectorSet,calculate);form.append(fields);
 const results=el('section',undefined,'ps-results');results.setAttribute('aria-labelledby','ps-results-title');const resultsTitle=el('h2','3. Context result');resultsTitle.id='ps-results-title';
 const resultStatus=el('div');resultStatus.setAttribute('role','status');const resultBody=el('div');
 const exportBar=el('div',undefined,'ps-actions'),exportStatus=el('p',undefined,'small');exportStatus.setAttribute('role','status');const exportButtons={};
 for(const [format,label]of [['json','Download context evidence JSON'],['csv','Download context table CSV'],['svg','Download context chart SVG']]){const b=button(label);b.id=`pressure-support-${format}`;b.disabled=true;b.onclick=()=>download(format);exportButtons[format]=b;exportBar.append(b);}
 results.append(resultsTitle,resultStatus,resultBody,exportBar,exportStatus);
 const availability=el('section',undefined,'panel ps-availability');availability.setAttribute('aria-labelledby','ps-real-title');
 root.replaceChildren(title,notice,identity,loadPanel,form,results,availability);

 function renderIdentity(){
  const s=state.snapshot(),rows=s.input?[['Context dataset',s.input.name],['Dataset ID',s.input.datasetId],['SHA-256 (verified bytes)',s.input.sha256],['Classification',s.input.classification],['Declared coverage',`${s.input.coverage.firstMonth} to ${s.input.coverage.lastMonth}`]]:[['Context dataset','Not loaded']];
  rows.push(['Active planning dataset',`${planningSource??'none selected'} · separate from the active planning dataset; never substituted`]);
  identityList.replaceChildren();for(const [k,v]of rows)identityList.append(el('dt',k),el('dd',v));
 }
 function renderLoad(){
  const s=state.snapshot();cancel.disabled=!s.pending;load.disabled=s.pending;load.textContent=s.failed?'Retry load':s.input?'Reload synthetic example':'Load synthetic example';
  loadStatus.textContent=s.pending?'Loading and verifying the pinned example…':s.input?'Verified pinned example loaded. Choose a selection, then Calculate.':s.failed?'':'Not loaded.';
  loadError.textContent=s.failed||(!s.input&&!s.pending&&s.reasons.length)?s.reasons.join(' '):'';
 }
 function renderSelection(){
  const s=state.snapshot();fields.disabled=!s.input;producer.replaceChildren();injectorSet.replaceChildren(injectorLegend);
  if(!s.input)return;
  const v=s.validation,sel=s.selection;
  for(const p of v.dataset.producers){const o=el('option',`${p.producerId}${v.producers[p.producerId]?.ready===false?' (blocked input)':''}`);o.value=p.producerId;producer.append(o);}
  producer.value=sel.producerId;first.min=last.min=v.dataset.coverage.firstMonth;first.max=last.max=v.dataset.coverage.lastMonth;first.value=sel.firstMonth;last.value=sel.lastMonth;
  for(const a of associatedInjectors(v,sel.producerId)){const label=el('label',undefined,'ps-check'),box=el('input');box.type='checkbox';box.value=a.injectorId;box.checked=sel.injectorIds.includes(a.injectorId);box.onchange=edit;label.append(box,document.createTextNode(` ${a.injectorId} · ${a.distance} ${a.distanceUnit} (${a.origin})`));injectorSet.append(label);}
 }
 function syncExports(){const ready=state.snapshot().exportReady&&!!state.exportRequest();for(const b of Object.values(exportButtons))b.disabled=!ready;}
 function clearResults(message){resultBody.replaceChildren();resultStatus.textContent=message;exportStatus.textContent='';syncExports();}
 async function download(format){
  if(!state.exportRequest()){syncExports();return;}
  exportStatus.textContent='Preparing sealed context export…';
  let out;try{out=await exportCurrentContext(state,format);}catch(error){exportStatus.textContent=`Export failed: ${error.message}`;return;}
  if(!out){exportStatus.textContent='Context changed during export; nothing was downloaded. Calculate again to export the current context.';syncExports();return;}
  const url=URL.createObjectURL(new Blob([out.text],{type:out.mime})),a=document.createElement('a');a.href=url;a.download=out.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  exportStatus.textContent=`Downloaded ${out.filename} · artifact ${out.artifact.evidence.artifactId}`;
 }
 function readSelection(){return {producerId:producer.value,injectorIds:[...injectorSet.querySelectorAll('input[type=checkbox]')].filter(b=>b.checked).map(b=>b.value).sort(),firstMonth:first.value,lastMonth:last.value};}
 function edit(){state.changeSelection(readSelection());clearResults('Selection changed. Previous results and exports are cleared; Calculate to refresh.');renderLoad();}
 producer.onchange=()=>{const v=state.snapshot().validation;state.changeSelection({...readSelection(),producerId:producer.value,injectorIds:associatedInjectors(v,producer.value).map(a=>a.injectorId)});renderSelection();clearResults('Producer changed. All of its declared injectors are selected; Calculate to refresh.');};
 first.onchange=edit;last.onchange=edit;
 form.onsubmit=event=>{event.preventDefault();renderResult(state.calculate());};
 function renderResult(result){
  resultBody.replaceChildren();resultStatus.replaceChildren();
  if(!result){resultStatus.textContent='Load the synthetic example before calculating.';return;}
  if(!result.ready){resultStatus.append(el('p','Context blocked — no partial values are shown.','error'));const list=el('ul');for(const r of result.reasons)list.append(el('li',r));resultStatus.append(list);return;}
  const partial=result.monthly.filter(m=>m.missingReasons.length);
  resultStatus.append(el('p',`Ready for inspection over ${result.monthly.length} months. Context readiness is not engineering or product acceptance.`));
  for(const r of result.reasons)resultStatus.append(el('p',r,'warning'));
  if(partial.length)resultStatus.append(el('p',`${partial.length} of ${result.monthly.length} months have missing observations or an unavailable aggregate; they are shown as gaps, never as zero.`,'warning'));
  const chart=region('Pressure-support context chart');
  try{chart.append(renderPressureContextChart(result));}catch(error){chart.append(el('p',error.message,'error'));}
  const ids=result.selection.injectorIds;
  const monthly=region('Monthly context values');monthly.append(table('Plotted monthly values (rates STB/day; injection bbl/month)',['Month','Oil rate (STB/day)','Water rate (STB/day)','Liquid rate (STB/day)','Water cut (%)',...ids.map(id=>`${id} (bbl/month)`),'Complete selected total (bbl/month)','Missing / unavailable'],
   result.monthly.map(m=>[m.month,m.oilRateStbd,m.waterRateStbd,m.liquidRateStbd,m.waterCutPct,...ids.map(id=>m.injectorVolumesBbl[id]),m.completeInjectionVolumeBbl,m.missingReasons.join('; ')||'—'])));
  const events=el('section');events.append(el('h3','Frac events (annotations only)'));const eventList=el('ul');
  for(const e of result.events)eventList.append(el('li',`${e.date} · ${e.kind} ${e.eventId} · ${e.classification} · ${e.withinSelection?'plotted':'listed only — outside the selected period'}${e.withinCoverage?'':' · outside declared coverage'} · ${e.citation}${e.uncertainty?` · ${e.uncertainty}`:''}`));
  if(!result.events.length)eventList.append(el('li','No events declared for this producer.'));events.append(eventList);
  const sources=el('details');sources.append(el('summary','Selected source rows (original values)'));const rows=result.sourceRows;
  for(const [label,list,cols]of [['Producer monthly rows',rows.producerMonthly,['rowId','sourceId','producerId','month','oilVolumeBbl','waterVolumeBbl','volumeUnit','basis','classification']],['Injector monthly rows',rows.injectorMonthly,['rowId','sourceId','injectorId','month','volumeBbl','volumeUnit','basis','classification']],['Associations',rows.associations,['rowId','sourceId','producerId','injectorId','distance','distanceUnit','origin','classification']],['Events',rows.events,['rowId','sourceId','eventId','producerId','date','kind','citation','uncertainty','classification']]]){
   const r=region(label);r.append(table(`${label} (${list.length})`,cols,list.map(row=>cols.map(c=>row[c]??null))));sources.append(r);
  }
  const method=el('details');method.append(el('summary','Method, assumptions & limitations'));const ml=el('ul');for(const f of [...result.method.formulas,...result.assumptions])ml.append(el('li',f));method.append(el('p',`Method ${result.method.version} · dataset ${result.source.datasetId} · SHA-256 ${result.source.sha256}`),ml);
  resultBody.append(chart,monthly,events,sources,method);syncExports();
 }
 function renderAvailability(){
  const a=realDataAvailability(planningSource),h=el('h2','Real-data availability');h.id='ps-real-title';const list=el('ul');for(const m of a.missing)list.append(el('li',m));
  const link=el('a','Open public injector history');link.href='#injection/publicTrends';
  availability.replaceChildren(h,el('p','Unavailable for public or customer sources: each input below must pass explicit checks under a separately reviewed contract.'),list,...a.notes.map(n=>el('p',n,'small')),link);
 }
 const renderAll=()=>{renderIdentity();renderLoad();renderSelection();renderAvailability();syncExports();};
 load.onclick=async()=>{
  const {revision,signal}=state.beginLoad();clearResults('');renderAll();
  try{const loaded=await loadPinnedExampleEvidence({fetch,signal});if(state.acceptLoad(revision,loaded.validation,loaded)){renderAll();clearResults('Calculate to view results.');}}
  catch(error){if(error?.name==='AbortError')return;if(state.failLoad(revision,error?.message??String(error)))renderAll();}
 };
 cancel.onclick=()=>{state.cancel();clearResults('');renderAll();};
 document.addEventListener('workspace-source',event=>{planningSource=event.detail??null;if(state.abortPending('Planning source changed while loading; reload the synthetic example explicitly.'))clearResults('');renderAll();});
 renderAll();clearResults('Load the synthetic example to begin.');
 return {
  open(){renderAll();},
  invalidate(reason){state.invalidate(reason);clearResults(reason);renderAll();},
  exportSnapshot(){const s=state.snapshot();return s.exportReady?s.result:null;},
 };
}
