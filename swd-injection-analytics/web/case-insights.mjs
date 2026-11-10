import {buildCaseInsights,sealCaseInsights} from '../dist/caseInsights.js';
import {validateFactors,NEUTRAL_FACTORS,CASE_LABEL,FLAT_NOTE,FLUID_NOTE,ATTRIBUTION_NOTE} from '../dist/performanceCases.js';
import {confirmBasisValue} from '../dist/wellAssumptions.js';

/** "What the case says": deterministic summary, history vs forecast and assumed well-performance cases.
 * Pure at import time (no DOM access), so node:test imports it. Mounted only by import-ui.mjs. */

const msg=e=>e instanceof Error?e.message:String(e);

/** DOM-free state machine. `generation` changes on every case result and invalidation; work started under an older generation is ignored. */
export function createInsightsSession({getLinks,runPerformance,onChange=()=>{}}){
 let status='idle',result=null,insights=null,error=null,generation=0,performance=null,perfSeq=0;
 const bases=new Map(),key=(wellId,uic)=>wellId+'|'+uic;
 function rebuild(){
  const links=(getLinks()??[]).map(l=>({wellId:l.wellId,label:l.label,uic:l.uic,monthly:l.monthly,surfaceBasis:bases.get(key(l.wellId,l.uic))??null}));
  insights=buildCaseInsights(result,links,performance);
 }
 const session={
  onCaseResult(next){
   generation++;perfSeq++;result=next;performance=null;error=null;
   try{rebuild();status='ready';}catch(e){insights=null;status='error';error=msg(e);}
   onChange();
  },
  onInvalidated(){generation++;perfSeq++;result=null;insights=null;performance=null;error=null;status='idle';onChange();},
  setBasis(wellId,value,reason){
   const link=(getLinks()??[]).find(l=>l.wellId===wellId);if(!link)throw new Error(`No H-10 history is linked to ${wellId}.`);
   const confirmed=confirmBasisValue(value,reason,`Surface basis (${wellId})`);
   bases.set(key(link.wellId,link.uic),confirmed);
   if(result){rebuild();onChange();}
   return confirmed;
  },
  clearPerformance(){
   perfSeq++;if(!result)return;const had=performance!==null||status==='calculating';performance=null;error=null;
   if(had){rebuild();status='ready';onChange();}
  },
  async requestPerformance(spec){
   if(!result)throw new Error('Calculate the disposal case first.');
   const checked={pessimistic:validateFactors(spec?.pessimistic,'Pessimistic'),optimistic:validateFactors(spec?.optimistic,'Optimistic')};
   const gen=generation,seq=++perfSeq,caseInput=structuredClone(result.inputs);
   performance=null;error=null;rebuild();status='calculating';onChange();
   const current=()=>gen===generation&&seq===perfSeq;
   try{
    const computed=await runPerformance({caseInput,spec:checked});
    if(!current())return null;
    performance=computed;rebuild();status='ready';onChange();return insights;
   }catch(e){
    if(!current())return null;
    performance=null;rebuild();status='ready';error=msg(e);onChange();throw e;
   }
  },
  /** Seal the shown insights and re-verify them through `verify(sealed,format)` (the worker in the browser).
   * Refused while a performance calculation runs; `{cancelled:true}` when the insights changed before the text came back. */
  async exportInsights(format,verify){
   if(format!=='json'&&format!=='csv')throw new Error('Unsupported case insights export format: '+format);
   if(!insights)throw new Error('Calculate the disposal case first.');
   if(status==='calculating')throw new Error('Wait for the well-performance calculation to finish before downloading.');
   const shown=insights,changed=()=>insights!==shown;
   try{
    const sealed=await sealCaseInsights(shown);if(changed())return {cancelled:true};
    const text=await verify(sealed,format);if(changed())return {cancelled:true};
    return {cancelled:false,text,filename:`swd-case-insights-${sealed.contentSha256.slice(0,12)}.${format}`,mime:format==='json'?'application/json':'text/csv;charset=utf-8'};
   }catch(e){if(changed())return {cancelled:true};throw e;}
  },
  snapshot(){return {status,insights,error,generation};},
 };
 return session;
}

// ---- History timeline (pure SVG string) ----
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const nextMonth=m=>{let y=Number(m.slice(0,4)),n=Number(m.slice(5,7))+1;if(n>12){n=1;y++;}return `${y}-${String(n).padStart(2,'0')}`;};
const fmt=v=>v===null||v===undefined?'not reported':typeof v==='number'?(v!==0&&Math.abs(v)<0.01?v.toLocaleString('en-US',{maximumSignificantDigits:6}):v.toLocaleString('en-US',{maximumFractionDigits:3})):String(v);

/** Every month on a continuous axis (no decimation, D16). Reported H-10 bars and calculated forecast bars; gaps stay empty; a dashed line marks where the forecast starts. */
export function historyTimelineSvg(check,width=600){
 const {reported,forecast}=check.series,all=[...reported.map(r=>r.month),...forecast.map(f=>f.month)].sort();
 const height=220,left=64,right=12,top=28,bottom=40;
 if(!all.length)return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="60" viewBox="0 0 ${width} 60" role="img"><title>${esc(check.wellId)}: no series to chart</title><text x="8" y="30" font-size="12">No reported or forecast months.</text></svg>`;
 const months=[];for(let m=all[0];m<=all[all.length-1];m=nextMonth(m))months.push(m);
 const index=new Map(months.map((m,i)=>[m,i])),slot=(width-left-right)/months.length,plotH=height-top-bottom;
 const max=Math.max(1,...reported.map(r=>r.bbl??0),...forecast.map(f=>f.bbl));
 const y=v=>top+plotH-(v/max)*plotH,x=m=>left+index.get(m)*slot,bw=Math.max(1,slot*0.8);
 const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(check.wellId)} reported H-10 and forecast monthly volumes">`,
  `<title>${esc(check.wellId)}: reported H-10 (bbl/month) and calculated forecast (bbl/month)</title>`,
  `<rect width="${width}" height="${height}" fill="white"/>`,
  `<text x="${left}" y="14" font-size="11">Reported H-10 bbl/month (blue) · forecast bbl/month, calculated (purple) · empty month = no H-10 row</text>`,
  `<line x1="${left}" y1="${top+plotH}" x2="${width-right}" y2="${top+plotH}" stroke="#555"/>`,
  `<line x1="${left}" y1="${top}" x2="${left}" y2="${top+plotH}" stroke="#555"/>`,
  `<text x="${left-4}" y="${top+4}" font-size="10" text-anchor="end">${esc(fmt(max))}</text>`,
  `<text x="${left-4}" y="${top+plotH}" font-size="10" text-anchor="end">0</text>`];
 months.forEach((m,i)=>{const cx=left+i*slot+slot/2;parts.push(`<line class="month" x1="${cx}" y1="${top+plotH}" x2="${cx}" y2="${top+plotH+3}" stroke="#555"/>`);
  if(i===0||i===months.length-1||m.endsWith('-01'))parts.push(`<text x="${cx}" y="${top+plotH+16}" font-size="9" text-anchor="middle">${esc(m)}</text>`);});
 for(const r of reported){if(r.gap||r.bbl===null)continue;const top0=y(r.bbl);
  parts.push(`<rect class="reported" x="${x(r.month)+(slot-bw)/2}" y="${top0}" width="${bw}" height="${top+plotH-top0}" fill="#1262b5"${r.included?'':' fill-opacity="0.35"'}><title>${esc(r.month)} reported ${esc(fmt(r.bbl))} bbl${r.included?'':' (not included)'}</title></rect>`);}
 for(const f of forecast){const top0=y(f.bbl);
  parts.push(`<rect class="forecast" x="${x(f.month)+(slot-bw)/2}" y="${top0}" width="${bw}" height="${top+plotH-top0}" fill="#8b5aab"><title>${esc(f.month)} forecast ${esc(fmt(f.bbl))} bbl (calculated)</title></rect>`);}
 if(forecast.length){const bx=x([...forecast].sort((a,b)=>a.month<b.month?-1:1)[0].month);
  parts.push(`<line x1="${bx}" y1="${top}" x2="${bx}" y2="${top+plotH}" stroke="#333" stroke-dasharray="4 3"/>`,`<text x="${bx+3}" y="${top+10}" font-size="10">Forecast starts</text>`);}
 parts.push(`<text x="${left}" y="${height-4}" font-size="10">Month (every month drawn)</text></svg>`);
 return parts.join('');
}

// ---- DOM wiring (only runs when import-ui.mjs calls mountCaseInsights) ----
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function table(headers,rows,caption){const t=el('table');t.append(el('caption',caption));const h=el('thead'),r=el('tr');for(const label of headers){const th=el('th',label);th.scope='col';r.append(th);}h.append(r);t.append(h);const b=el('tbody');for(const row of rows){const tr=el('tr');for(const v of row)tr.append(el('td',fmt(v)));b.append(tr);}t.append(b);return t;}
function scroll(child,label){const d=el('div',undefined,'table-scroll');d.tabIndex=0;d.setAttribute('role','region');d.setAttribute('aria-label',label);d.append(child);return d;}
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('History chart could not be parsed.');return document.importNode(doc.documentElement,true);}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const FACTOR_FIELDS=[['injectivityMultiplier','Injectivity multiplier (×)'],['reservoirOffsetPsi','Reservoir pressure offset (psi)'],['availabilityMultiplier','Availability multiplier (×)']];
const STATUS_TEXT={within:'Within reported history','above':'Above reported history','cannot-check':'Cannot be checked','no-injection':'No injection reported'};

export function mountCaseInsights(root,{getLinks}){
 const workers={calculate:null,verify:null};
 function cancel(action){const w=workers[action];if(w){w.worker.terminate();w.reject(new Error('Calculation replaced by newer inputs'));workers[action]=null;}}
 function request(action,payload){
  cancel(action);
  return new Promise((resolve,reject)=>{
   const worker=new Worker('/performance-worker.mjs',{type:'module'}),slot={worker,reject};workers[action]=slot;
   const finish=()=>{worker.terminate();if(workers[action]===slot)workers[action]=null;};
   worker.onmessage=event=>{const data=event.data;finish();if(data.error)reject(new Error(data.error));else resolve(data);};
   worker.onerror=()=>{finish();reject(new Error('Case insights calculation could not load. Reload the app and try again.'));};
   worker.postMessage({action,...payload});
  });
 }
 const session=createInsightsSession({getLinks,runPerformance:async({caseInput,spec})=>(await request('calculate',{caseInput,spec})).result,onChange:()=>render()});

 const title=el('h3','What the case says');title.id='case-insights-title';
 const status=el('p','Calculate the disposal case first.');status.setAttribute('role','status');
 const summary=el('div'),history=el('div'),perfTables=el('div'),perfError=el('p','');perfError.setAttribute('role','alert');
 const form=el('form');form.noValidate=true;const inputs={};
 const controls=el('div',undefined,'disposal-controls');
 for(const [c,label] of [['pessimistic','Pessimistic'],['optimistic','Optimistic']])for(const [f,flabel] of FACTOR_FIELDS){
  const l=el('label',`${label} ${flabel.charAt(0).toLowerCase()+flabel.slice(1)}`),i=el('input');i.type='number';i.step='any';i.value=String(NEUTRAL_FACTORS[f]);i.dataset.case=c;i.dataset.factor=f;l.append(i);controls.append(l);inputs[c+'.'+f]=i;}
 const calc=el('button','Calculate well-performance cases');calc.type='submit';calc.disabled=true;
 form.append(el('p','Base uses the case as entered (neutral factors). Each case applies its factors to every well.','small'),controls,calc);
 const notes=el('ul',undefined,'small');for(const n of [CASE_LABEL,FLAT_NOTE,FLUID_NOTE,ATTRIBUTION_NOTE])notes.append(el('li',n));
 const perf=el('section');perf.append(el('h4','Assumed well-performance cases'),el('div'),form,perfError,perfTables,notes);const headroomSlot=perf.children[1];
 const jsonBtn=el('button','Download insights JSON'),csvBtn=el('button','Download insights CSV');jsonBtn.disabled=csvBtn.disabled=true;
 const downloads=el('div',undefined,'import-actions');downloads.append(jsonBtn,csvBtn);
 const historySection=el('section');historySection.append(el('h4','Reported history vs forecast'),history);
 root.replaceChildren(title,status,summary,historySection,perf,downloads);root.hidden=true;
 let exporting=false,rendered=null;
 const openDetails=new Set(),basisButtons=new Map();

 function renderSummary(ins){
  summary.replaceChildren();const seen={};
  for(const line of ins.summary){
   const key=line.rule+'#'+(seen[line.rule]=(seen[line.rule]??0)+1);
   const d=el('details'),s=el('summary',line.text);d.append(s);d.open=openDetails.has(key);
   d.addEventListener('toggle',()=>{if(d.open)openDetails.add(key);else openDetails.delete(key);});
   const ul=el('ul',undefined,'small');for(const c of line.cites)ul.append(el('li',`${c.label}: ${fmt(c.value)} ${c.unit}`));
   if(!line.cites.length)ul.append(el('li','No numeric cites.'));
   d.append(ul,el('p',`Rule ${line.rule} · method: ${line.method??'case result'}`,'small'));summary.append(d);
  }
 }
 function basisForm(link,check){
  const f=el('form',undefined,'disposal-controls');f.noValidate=true;
  const sl=el('label',`H-10 pressure basis for ${link.wellId}`),sel=el('select');for(const [v,t] of [['','Choose…'],['psig','psig (gauge)'],['psia','psia (absolute)']]){const o=el('option',t);o.value=v;sel.append(o);}
  if(check.pressure.basis)sel.value=check.pressure.basis;sl.append(sel);
  const rl=el('label','Reason'),reason=el('input');reason.maxLength=200;rl.append(reason);
  const ok=el('button','Confirm');ok.type='submit';const err=el('p','');err.setAttribute('role','alert');
  const confirmed=el('p',link.surfaceBasis?`Confirmed: ${link.surfaceBasis.value} — ${link.surfaceBasis.reason}`:'Not confirmed: pressure is not compared until a basis is confirmed.','small disposal-wide');
  f.append(sl,rl,ok,confirmed,err);basisButtons.set(link.wellId,ok);
  f.addEventListener('submit',e=>{e.preventDefault();
   try{session.setBasis(link.wellId,sel.value,reason.value);basisButtons.get(link.wellId)?.focus();}catch(x){err.textContent=msg(x);}});
  return f;
 }
 function renderHistory(ins){
  history.replaceChildren();basisButtons.clear();const links=new Map(ins.links.map(l=>[l.wellId,l]));
  for(const h of ins.history){
   const box=el('div');box.append(el('h5',`${h.wellId}${h.uic?' · UIC '+h.uic:''} — ${STATUS_TEXT[h.status]??h.status}`),el('p',h.reason));
   if(h.onstreamNote)box.append(el('p',h.onstreamNote,'small'));
   box.append(el('p',`Pressure: ${h.pressure.note}`,'small'));
   const rows=[...h.series.reported.map(r=>[r.month,'Reported H-10',r.gap?null:r.bbl,r.gap?'Gap: no H-10 row':r.included?'Reported, included':'Reported, not included']),...h.series.forecast.map(f=>[f.month,'Forecast',f.bbl,'Calculated'])];
   box.append(scroll(table(['Month','Series','Volume (bbl)','Label'],rows,rows.length?`${h.wellId}: reported H-10 months and calculated forecast months`:`${h.wellId}: no series — ${h.reason}`),`${h.wellId} history vs forecast`));
   const link=links.get(h.wellId);
   if(link){box.append(basisForm(link,h));try{const c=el('div',undefined,'pvt-plot');c.append(svgNode(historyTimelineSvg(h,matchMedia('(max-width:700px)').matches?360:600)));box.append(c);}catch(x){box.append(el('p',msg(x)));}}
   history.append(box);
  }
 }
 function renderPerformance(ins){
  headroomSlot.replaceChildren(scroll(table(['Well','Reservoir (psia, assumed)','Limit (psia, assumed)','Headroom (psi, calculated)'],ins.caseInputs.wells.map(w=>[w.id,w.reservoirPsia,w.limitPsia,w.limitPsia-w.reservoirPsia]),'Pressure headroom before any well-performance factor'),'Pressure headroom'));
  perfTables.replaceChildren();
  const p=ins.performance;if(!p)return;
  perfTables.append(scroll(table(['Case','First unplaced month','Unplaced (bbl)','Limiting constraints','Capped availability','No headroom'],p.cases.map(c=>[c.label,c.summary.firstShortfallMonth??'None',c.summary.totalShortfallBbl,c.summary.wells.map(w=>`${w.wellId}: ${w.limitingConstraints.join(' + ')}`).join('; '),c.cappedWells.join(', ')||'None',c.noHeadroomWells.join(', ')||'None']),CASE_LABEL+' · '+FLAT_NOTE),'Well-performance case results'));
  perfTables.append(scroll(table(['Case','Factor changed alone','Unplaced (bbl)','Change from base (bbl)'],p.cases.flatMap(c=>c.attribution.map(a=>[c.label,a.factor,a.totalShortfallBbl,a.changeBbl])),ATTRIBUTION_NOTE),'Single-factor attribution'));
 }
 function render(){
  const snap=session.snapshot(),ins=snap.insights;
  if(!ins){rendered=null;openDetails.clear();basisButtons.clear();summary.replaceChildren();history.replaceChildren();perfTables.replaceChildren();headroomSlot.replaceChildren();calc.disabled=true;jsonBtn.disabled=csvBtn.disabled=true;
   if(snap.status==='error'){root.hidden=false;status.textContent='Case insights unavailable: '+snap.error;}else{root.hidden=true;status.textContent='Calculate the disposal case first.';}return;}
  root.hidden=false;
  status.textContent=snap.status==='calculating'?'Calculating well-performance cases…':`${ins.summary.length} summary lines from the calculated case${ins.performance?' with well-performance cases':''}. Screening estimate from assumed inputs.`;
  perfError.textContent=snap.error??'';
  // Rebuild sections only when the insights object changes; a status-only change keeps forms, focus and open details.
  if(ins!==rendered){rendered=ins;renderSummary(ins);renderHistory(ins);renderPerformance(ins);}
  calc.disabled=snap.status==='calculating';jsonBtn.disabled=csvBtn.disabled=exporting||snap.status==='calculating';
 }
 function readSpec(){
  const out={pessimistic:{},optimistic:{}};
  for(const [k,i] of Object.entries(inputs)){const [c,f]=k.split('.');if(!i.value.trim())throw new Error(`Declare ${i.closest('label').textContent.trim()}.`);out[c][f]=Number(i.value);}
  return out;
 }
 form.addEventListener('input',()=>{cancel('calculate');session.clearPerformance();perfError.textContent='';});
 form.addEventListener('submit',async e=>{e.preventDefault();perfError.textContent='';
  try{await session.requestPerformance(readSpec());}catch(x){if(!/replaced by newer inputs/.test(msg(x)))perfError.textContent=msg(x);}});
 async function exportInsights(format){
  if(exporting||!session.snapshot().insights)return;
  exporting=true;jsonBtn.disabled=csvBtn.disabled=true;const prior=status.textContent;status.textContent='Re-verifying the insights against the engine before download…';
  try{
   const out=await session.exportInsights(format,async(sealed,f)=>(await request('verify',{sealed,format:f})).text);
   if(out.cancelled)status.textContent='Export cancelled: results changed. Download again.';
   else{download(out.text,out.filename,out.mime);status.textContent=prior;}
  }catch(x){status.textContent='Export blocked: '+msg(x);}
  finally{exporting=false;const s=session.snapshot();jsonBtn.disabled=csvBtn.disabled=!s.insights||s.status==='calculating';}
 }
 jsonBtn.onclick=()=>exportInsights('json');csvBtn.onclick=()=>exportInsights('csv');
 document.addEventListener('disposal-case-result',event=>{cancel('calculate');cancel('verify');session.onCaseResult(event.detail.result);});
 document.addEventListener('disposal-case-invalidated',()=>{cancel('calculate');cancel('verify');session.onInvalidated();});
 return session;
}
