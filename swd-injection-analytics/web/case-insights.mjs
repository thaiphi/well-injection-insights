import {buildCaseInsights,sealCaseInsights,unsupportedPressureMonths} from '../dist/caseInsights.js';
import {fmtNumber} from '../dist/caseSummary.js';
import {validateFactors,NEUTRAL_FACTORS,CASE_LABEL,FLAT_NOTE,FLUID_NOTE,ATTRIBUTION_NOTE} from '../dist/performanceCases.js';
import {confirmBasisValue} from '../dist/wellAssumptions.js';
import {checkWellHistory} from '../dist/wellHistoryCheck.js';
import {packageFromVerified,addPackage,removePackage as dropPackage,joinedHistory,uics,EMPTY_PACKAGE_SET} from '../dist/historyPackages.js';
import {setLink as linkWell,pruneLinks,historyLinksFor,wellsCompared,UNLINKED,J_SOURCE_ASSUMED,EVIDENCE_ONLY} from '../dist/caseHistoryLinks.js';
import {CLASS_LABELS} from '../dist/sampleCase.js';
import {verifyExplorerPackage} from './explorer-package.mjs';

/** "What the case says": deterministic summary, history vs forecast and assumed well-performance cases.
 * Pure at import time (no DOM access), so node:test imports it. Mounted only by import-ui.mjs. */

const msg=e=>e instanceof Error?e.message:String(e);

/** User and demo cases link their own loaded packages; the sample keeps getLinks; public (or no source) feeds no links. */
const ownCase=src=>src==='user'||src==='demo';
const NO_SOURCE=Symbol('no case result yet');

/** DOM-free state machine. `generation` changes on every case result and invalidation; work started under an older generation is ignored.
 * Without `getSource` the session behaves as in E05 (getLinks feeds the check). Links and packages are evidence only: the case input is never read for or changed by them. */
export function createInsightsSession({getLinks,getSource,getCaseOrigin,runPerformance,onChange=()=>{}}){
 let status='idle',result=null,insights=null,error=null,generation=0,performance=null,perfSeq=0;
 let set=EMPTY_PACKAGE_SET,wellLinks={},compared=null,coverage=new Map(),lastSource=NO_SOURCE,lastOrigin=null,withdrawn=0;
 const bases=new Map(),key=(wellId,uic)=>wellId+'|'+uic;
 const sourceNow=()=>getSource?getSource():undefined;
 const caseSource=()=>result?lastSource:sourceNow();
 /** A source switch, or a new case origin (the user's injector profile re-imported), withdraws the links and their confirmed bases; loaded packages are kept. */
 const followSource=(src,origin=lastOrigin)=>{if(lastSource!==NO_SOURCE&&(src!==lastSource||origin!==lastOrigin)){wellLinks={};bases.clear();withdrawn++;}lastSource=src;lastOrigin=origin;};
 /** Replace the links; a well whose link is removed or changed loses the basis confirmed for its old UIC. */
 const replaceLinks=next=>{for(const [w,u] of Object.entries(wellLinks))if(next[w]!==u)bases.delete(key(w,u));wellLinks=next;};
 const caseWellIds=()=>result.base.wells.map(bw=>bw.well.id);
 const sampleLinkRows=()=>(getLinks()??[]).map(l=>({wellId:l.wellId,label:l.label,uic:l.uic,monthly:l.monthly,surfaceBasis:bases.get(key(l.wellId,l.uic))??null}));
 /** Sample rows: coverage from each link's own reported rows (window source 'rows'); no package provenance is invented.
  * J source: the sample's injectivity input class (getLinks item jClass), labelled as in sampleCase; never from H-10. */
 function sampleCompared(links,history){
  const withRows=links.filter(l=>l.monthly?.length),packages=withRows.map(l=>{const ms=l.monthly.map(r=>String(r.period_start).slice(0,7)).sort();
   return {artifactId:'',manifestSha256:'',uic:l.uic,window:{startMonth:ms[0],endMonth:ms[ms.length-1],source:'rows'},monthly:l.monthly};});
  const tmp={packages};coverage=new Map(withRows.map(l=>[l.wellId,joinedHistory(tmp,l.uic).months]));
  const jClass=new Map((getLinks()??[]).map(l=>[l.wellId,l.jClass]));
  return wellsCompared(result,Object.fromEntries(withRows.map(l=>[l.wellId,l.uic])),tmp,history,id=>CLASS_LABELS[jClass.get(id)]??J_SOURCE_ASSUMED).map(r=>({...r,packages:[]}));
 }
 function rebuild(){
  const src=caseSource();
  if(ownCase(src)){
   const wells=result.base.wells.map(bw=>({id:bw.well.id,label:bw.well.label??bw.well.id}));
   const links=historyLinksFor(wells,wellLinks,set,Object.fromEntries(Object.entries(wellLinks).map(([w,u])=>[w,bases.get(key(w,u))??null])));
   compared=wellsCompared(result,wellLinks,set,checkWellHistory(result.base,links),()=>J_SOURCE_ASSUMED);
   coverage=new Map(Object.entries(wellLinks).map(([w,u])=>[w,joinedHistory(set,u).months]));
   insights=buildCaseInsights(result,links,performance,compared);
  }else if(src==='public'||src===null){compared=null;coverage=new Map();insights=buildCaseInsights(result,[],performance);}
  else{
   const links=sampleLinkRows();
   insights=buildCaseInsights(result,links,performance);
   if(src==='sample')compared=sampleCompared(links,insights.history);else{compared=null;coverage=new Map();}
  }
 }
 const refresh=()=>{if(result){rebuild();onChange();}};
 const linkedUic=wellId=>ownCase(caseSource())?wellLinks[wellId]:caseSource()==='public'||caseSource()===null?undefined:(getLinks()??[]).find(l=>l.wellId===wellId)?.uic;
 const session={
  onCaseResult(next){
   generation++;perfSeq++;result=next;performance=null;error=null;
   try{
    const src=sourceNow();
    followSource(src,getCaseOrigin?getCaseOrigin()??null:null);replaceLinks(pruneLinks(wellLinks,caseWellIds(),set));
    rebuild();status='ready';
   }catch(e){insights=null;compared=null;status='error';error=msg(e);}
   onChange();
  },
  onInvalidated(){if(getSource&&lastSource!==NO_SOURCE)followSource(sourceNow());generation++;perfSeq++;result=null;insights=null;compared=null;performance=null;error=null;status='idle';onChange();},
  setBasis(wellId,value,reason){
   const uic=linkedUic(wellId);if(uic===undefined)throw new Error(`No H-10 history is linked to ${wellId}.`);
   const confirmed=confirmBasisValue(value,reason,`Surface basis (${wellId})`);
   bases.set(key(wellId,uic),confirmed);
   if(result){rebuild();onChange();}
   return confirmed;
  },
  /** Verified Explorer package → package set. A refusal returns {error} and leaves every state unchanged. */
  loadPackage(verified){
   if(!ownCase(sourceNow()))return {error:'History packages can be loaded only for a user or demo case.'};
   let p;try{p=packageFromVerified(verified);set=addPackage(set,p);}catch(e){return {error:msg(e)};}
   refresh();return {package:p};
  },
  removePackage(artifactId){
   set=dropPackage(set,artifactId);
   replaceLinks(pruneLinks(wellLinks,result?caseWellIds():Object.keys(wellLinks),set));
   refresh();
  },
  setLink(wellId,uic){
   if(!ownCase(sourceNow()))throw new Error('H-10 history can be linked only in a user or demo case.');
   if(uic!==null&&!uics(set).includes(uic))throw new Error(`UIC ${uic} is not loaded.`);
   if(result&&!caseWellIds().includes(wellId))throw new Error(`Well ${wellId} is not in the case.`);
   replaceLinks(linkWell(wellLinks,wellId,uic));
   refresh();
  },
  packages(){return [...set.packages];},
  links(){return {...wellLinks};},
  compared(){return compared;},
  /** Month states of a linked well's joined window (reported, reported-zero, gap), or null. */
  coverageMonths(wellId){return coverage.get(wellId)??null;},
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
  /** `withdrawn` counts link withdrawals by a source or origin switch. */
  snapshot(){return {status,insights,error,generation,withdrawn};},
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

/** History heading: the link label (or well ID), plus " · UIC <uic>" only when the label does not already carry the UIC digits. */
export function historyHeading(h){
 const name=h.label??h.wellId;if(!h.uic)return name;
 const digits=String(h.uic).replace(/\D/g,'');
 return digits&&name.replace(/\D/g,'').includes(digits)?name:`${name} · UIC ${h.uic}`;
}
/** Part C case table (pure): headers and one row per case, including offset as % of headroom and unsupported-pressure months. */
export const performanceCaseHeaders=()=>['Case','First unplaced month','Unplaced (bbl)','Limiting constraints','Capped availability','No headroom','Offset (% of headroom, assumed)','Unsupported-pressure months'];
export function performanceCaseRows(p){
 return p.cases.map(c=>{
  const unsupported=unsupportedPressureMonths(c).filter(u=>u.count>0);
  return [c.label,c.summary.firstShortfallMonth??'None',c.summary.totalShortfallBbl,c.summary.wells.map(w=>`${w.wellId}: ${w.limitingConstraints.join(' + ')}`).join('; '),c.cappedWells.join(', ')||'None',c.noHeadroomWells.join(', ')||'None',
   c.offsetPercentOfHeadroom.map(o=>`${o.wellId}: ${o.percent===null?'no headroom':fmtNumber(o.percent,1)+'%'}`).join('; '),
   unsupported.length?unsupported.map(u=>`${u.wellId}: ${fmtNumber(u.count)} month${u.count===1?'':'s'} (first ${u.firstMonth})`).join('; '):'None'];
 });
}

// ---- DOM wiring (only runs when import-ui.mjs calls mountCaseInsights) ----
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function table(headers,rows,caption){const t=el('table');t.append(el('caption',caption));const h=el('thead'),r=el('tr');for(const label of headers){const th=el('th',label);th.scope='col';r.append(th);}h.append(r);t.append(h);const b=el('tbody');for(const row of rows){const tr=el('tr');for(const v of row)tr.append(el('td',fmt(v)));b.append(tr);}t.append(b);return t;}
function scroll(child,label){const d=el('div',undefined,'table-scroll');d.tabIndex=0;d.setAttribute('role','region');d.setAttribute('aria-label',label);d.append(child);return d;}
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('History chart could not be parsed.');return document.importNode(doc.documentElement,true);}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const FACTOR_FIELDS=[['injectivityMultiplier','Injectivity multiplier (×)'],['reservoirOffsetPsi','Reservoir pressure offset (psi)'],['availabilityMultiplier','Availability multiplier (×)']];
const STATUS_TEXT={within:'Within reported history','above':'Above reported history','cannot-check':'Cannot be checked','no-injection':'No injection reported'};

const COMPARED_HEADERS=['Well','Linked UIC','Coverage','Rate check','Pressure check','J source','Status'];
const MONTH_TEXT={reported:'reported','reported-zero':'reported zero',gap:'gap: no H-10 row (never zero)'};
const wellName=r=>r.label===r.wellId?r.wellId:`${r.label} (${r.wellId})`;
/** Coverage cell and detail text: the window (marked when it comes from reported rows: every sample row, and any legacy package), then the gap sentence once. */
export function coverageLines(r,sample=false){
 if(!r.coverage)return [UNLINKED];
 const c=r.coverage,fromRows=sample||r.packages.some(p=>p.window.source==='rows');
 return [`${c.startMonth} to ${c.endMonth} · ${fmtNumber(c.reported)} months with reported injection · ${fmtNumber(c.reportedZero)} reported zero${fromRows?' · window from reported rows':''}`,r.gapLabel??'No gap months in the window.'];
}

export function mountCaseInsights(root,{getLinks,getSource,getCaseOrigin}){
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
 const session=createInsightsSession({getLinks,getSource,getCaseOrigin,runPerformance:async({caseInput,spec})=>(await request('calculate',{caseInput,spec})).result,onChange:()=>render()});

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
 // Wells compared: loader (user/demo only), table, evidence note and one well's detail. Built once; only their contents are replaced.
 const fileLabel=el('label','Load history packages (Explorer .tar)'),fileInput=el('input');fileInput.type='file';fileInput.accept='.tar,application/x-tar';fileInput.multiple=true;fileLabel.append(fileInput);
 const loadError=el('p','');loadError.setAttribute('role','alert');const linkError=el('p','');linkError.setAttribute('role','alert');
 const packageList=el('ul',undefined,'small'),loader=el('div');loader.append(fileLabel,loadError,packageList);
 const comparedTable=el('div'),detail=el('div');detail.id='wells-compared-detail';detail.hidden=true;
 const compareSection=el('section');compareSection.append(el('h4','Wells compared'),loader,linkError,comparedTable,el('p',EVIDENCE_ONLY,'small'),detail);compareSection.hidden=true;
 root.replaceChildren(title,status,summary,compareSection,historySection,perf,downloads);root.hidden=true;
 let exporting=false,rendered=null,openWell=null,seenWithdrawn=0;
 const openDetails=new Set(),basisButtons=new Map(),linkSelects=new Map(),rowButtons=new Map();

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
   const box=el('div');box.append(el('h5',`${historyHeading(h)} — ${STATUS_TEXT[h.status]??h.status}`),el('p',h.reason));
   if(h.onstreamNote)box.append(el('p',h.onstreamNote,'small'));
   box.append(el('p',`Pressure: ${h.pressure.note}`,'small'));
   const rows=[...h.series.reported.map(r=>[r.month,'Reported H-10',r.gap?null:r.bbl,r.gap?'Gap: no H-10 row':r.included?'Reported, included':'Reported, not included']),...h.series.forecast.map(f=>[f.month,'Forecast',f.bbl,'Calculated'])];
   box.append(scroll(table(['Month','Series','Volume (bbl)','Label'],rows,rows.length?`${h.wellId}: reported H-10 months and calculated forecast months`:`${h.wellId}: no series — ${h.reason}`),`${h.wellId} history vs forecast`));
   const link=links.get(h.wellId);
   if(link){box.append(basisForm(link,h));try{const c=el('div',undefined,'pvt-plot');c.append(svgNode(historyTimelineSvg(h,matchMedia('(max-width:700px)').matches?360:600)));box.append(c);}catch(x){box.append(el('p',msg(x)));}}
   history.append(box);
  }
 }
 function renderPackages(){
  packageList.replaceChildren();
  for(const p of session.packages()){
   const li=el('li',`UIC ${p.uic} · ${p.window.startMonth} to ${p.window.endMonth} · ${p.artifactId}${p.window.source==='rows'?' · window from reported rows (legacy package)':''} `);
   const rm=el('button','Remove');rm.type='button';rm.setAttribute('aria-label',`Remove ${p.artifactId}`);
   rm.onclick=()=>{session.removePackage(p.artifactId);fileInput.focus();};li.append(rm);packageList.append(li);
  }
  if(!packageList.children.length)packageList.append(el('li','No history packages loaded.'));
 }
 function renderCompared(ins){
  const rows=session.compared(),own=ownCase(getSource?.());
  linkSelects.clear();rowButtons.clear();comparedTable.replaceChildren();
  compareSection.hidden=!rows;loader.hidden=!own;if(own)renderPackages();
  if(!rows){openWell=null;renderDetail(ins);return;}
  const links=session.links(),loaded=own?uics({packages:session.packages()}):[];
  const t=el('table');t.append(el('caption','Wells compared: one row per case well, in case order'));
  const h=el('thead'),hr=el('tr');for(const label of COMPARED_HEADERS){const th=el('th',label);th.scope='col';hr.append(th);}h.append(hr);t.append(h);
  const b=el('tbody');
  for(const r of rows){
   const tr=el('tr'),well=el('td'),btn=el('button',wellName(r));btn.type='button';btn.setAttribute('aria-expanded',String(openWell===r.wellId));btn.setAttribute('aria-controls',detail.id);
   btn.onclick=()=>{openWell=openWell===r.wellId?null:r.wellId;for(const [id,x] of rowButtons)x.setAttribute('aria-expanded',String(openWell===id));renderDetail(session.snapshot().insights);};
   well.append(btn);rowButtons.set(r.wellId,btn);
   const uicCell=el('td');
   if(own){
    const sel=el('select');sel.setAttribute('aria-label',`Linked UIC for ${wellName(r)}`);
    const none=el('option','No history');none.value='';sel.append(none);
    for(const u of loaded){const o=el('option',u);o.value=u;o.disabled=Object.entries(links).some(([id,x])=>x===u&&id!==r.wellId);sel.append(o);}
    sel.value=r.uic??'';linkSelects.set(r.wellId,sel);
    sel.addEventListener('change',()=>{linkError.textContent='';
     try{session.setLink(r.wellId,sel.value||null);}catch(x){linkError.textContent=msg(x);sel.value=r.uic??'';}
     linkSelects.get(r.wellId)?.focus();});
    uicCell.append(sel);
   }else uicCell.textContent=r.uic??UNLINKED;
   const cov=el('td');
   coverageLines(r,!own).forEach((line,i)=>{if(i)cov.append(el('br'));cov.append(i?el('small',line):el('span',line));});
   tr.append(well,uicCell,cov,el('td',r.check?.reason??''),el('td',r.check?r.check.pressure.note:''),el('td',r.jSource),el('td',r.check?STATUS_TEXT[r.check.status]??r.check.status:''));
   b.append(tr);
  }
  t.append(b);comparedTable.append(scroll(t,'Wells compared'));
  if(openWell&&!rows.some(r=>r.wellId===openWell))openWell=null;
  renderDetail(ins);
 }
 /** One well at a time; switching rows replaces the whole detail, and an unlinked well shows only UNLINKED. */
 function renderDetail(ins){
  detail.replaceChildren();const r=openWell?(session.compared()??[]).find(x=>x.wellId===openWell):null;
  detail.hidden=!r;if(!r)return;
  if(!r.uic||!r.check){detail.append(el('p',UNLINKED));return;}
  detail.append(el('h5',`${wellName(r)} · UIC ${r.uic}`));
  try{const c=el('div',undefined,'pvt-plot');c.append(svgNode(historyTimelineSvg(r.check,matchMedia('(max-width:700px)').matches?360:600)));detail.append(c);}catch(x){detail.append(el('p',msg(x)));}
  detail.append(el('p',`Rate check: ${r.check.reason}`),el('p',`Pressure: ${r.check.pressure.note}`,'small'));
  detail.append(el('p',`Coverage: ${coverageLines(r,!ownCase(getSource?.())).join(' ')}`,'small'));
  const months=session.coverageMonths(r.wellId)??[],gaps=months.filter(m=>m.state==='gap').map(m=>m.month);
  detail.append(el('p',gaps.length?`Gap months (no H-10 row; never zero): ${gaps.join(', ')}`:'Gap months: none.','small'));
  const ml=el('ul',undefined,'small');for(const m of months)ml.append(el('li',`${m.month}: ${MONTH_TEXT[m.state]??m.state}`));detail.append(ml);
  if(r.packages.length){const pl=el('ul',undefined,'small');
   for(const p of r.packages)pl.append(el('li',`${p.artifactId} · manifest SHA-256 ${p.manifestSha256.slice(0,12)} · ${p.window.startMonth} to ${p.window.endMonth}${p.window.source==='rows'?' · window from reported rows (legacy package)':''}`));
   detail.append(el('h6','Packages'),pl);}
  else detail.append(el('p','Packages: the sample case’s pinned TRRC records (see Data & sources); no history package is loaded here.','small'));
  const link=ins?.links.find(l=>l.wellId===r.wellId);if(link)detail.append(basisForm(link,r.check));
 }
 // Runs after basisForm's own submit handler. A successful confirm rebuilds the panel synchronously, so the submitted form is detached by the re-render
 // and focus moves to the new form's Confirm; a refused confirm leaves the form in place and focus where it was.
 detail.addEventListener('submit',e=>{if(!detail.contains(e.target))detail.querySelector('form button[type="submit"]')?.focus();});
 fileInput.addEventListener('change',async()=>{
  const files=[...fileInput.files],errors=[];loadError.textContent='';
  for(const f of files){
   try{const out=session.loadPackage(await verifyExplorerPackage(new Uint8Array(await f.arrayBuffer())));if(out.error)errors.push(`${f.name}: ${out.error}`);}
   catch(x){errors.push(`${f.name}: ${msg(x)}`);}
  }
  loadError.textContent=errors.join(' ');fileInput.value='';fileInput.focus();
 });
 function renderPerformance(ins){
  headroomSlot.replaceChildren(scroll(table(['Well','Reservoir (psia, assumed)','Limit (psia, assumed)','Headroom (psi, calculated)'],ins.caseInputs.wells.map(w=>[w.id,w.reservoirPsia,w.limitPsia,w.limitPsia-w.reservoirPsia]),'Pressure headroom before any well-performance factor'),'Pressure headroom'));
  perfTables.replaceChildren();
  const p=ins.performance;if(!p)return;
  perfTables.append(scroll(table(performanceCaseHeaders(),performanceCaseRows(p),CASE_LABEL+' · '+FLAT_NOTE),'Well-performance case results'));
  perfTables.append(scroll(table(['Case','Factor changed alone','Unplaced (bbl)','Change from base (bbl)'],p.cases.flatMap(c=>c.attribution.map(a=>[c.label,a.factor,a.totalShortfallBbl,a.changeBbl])),ATTRIBUTION_NOTE),'Single-factor attribution'));
 }
 function render(){
  const snap=session.snapshot(),ins=snap.insights;
  if(snap.withdrawn!==seenWithdrawn){seenWithdrawn=snap.withdrawn;loadError.textContent='';linkError.textContent='';}
  if(!ins){rendered=null;openDetails.clear();basisButtons.clear();openWell=null;linkSelects.clear();rowButtons.clear();comparedTable.replaceChildren();detail.replaceChildren();detail.hidden=compareSection.hidden=true;summary.replaceChildren();history.replaceChildren();perfTables.replaceChildren();headroomSlot.replaceChildren();calc.disabled=true;jsonBtn.disabled=csvBtn.disabled=true;
   if(snap.status==='error'){root.hidden=false;status.textContent='Case insights unavailable: '+snap.error;}else{root.hidden=true;status.textContent='Calculate the disposal case first.';}return;}
  root.hidden=false;
  status.textContent=snap.status==='calculating'?'Calculating well-performance cases…':`${ins.summary.length} summary lines from the calculated case${ins.performance?' with well-performance cases':''}. Screening estimate from assumed inputs.`;
  perfError.textContent=snap.error??'';
  // Rebuild sections only when the insights object changes; a status-only change keeps forms, focus and open details.
  if(ins!==rendered){rendered=ins;renderSummary(ins);renderCompared(ins);renderHistory(ins);renderPerformance(ins);}
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
