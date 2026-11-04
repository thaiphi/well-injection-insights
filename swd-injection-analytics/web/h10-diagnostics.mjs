import {diagnoseMonthly,applyDecision,screening,coverage,FLAG_REASONS,CHECKLIST,LABEL_SURFACE,LABEL_SCREENING} from '../dist/h10Diagnostics.js';
import {pressureRateSvg,ratioOverTimeSvg} from '../dist/h10DiagnosticsChart.js';
import {sealDiagnostics,diagnosticsJson,diagnosticsCsv,diagnosticsSvg} from '../dist/h10DiagnosticsExport.js';

const FORMATS={json:['application/json',s=>diagnosticsJson(s)],csv:['text/csv;charset=utf-8',s=>diagnosticsCsv(s)],svg:['image/svg+xml',(s,state)=>diagnosticsSvg(s,state)]};
/** False when the selection has no H-10 monthly rows; diagnoseMonthly would throw, so no 1a panel is mounted. */
export const h10Available=selection=>Array.isArray(selection?.artifact?.injectionMonthly)&&selection.artifact.injectionMonthly.length>0;

/** DOM-free session: the user's month decisions, a revision counter and stale-export refusal. Nothing runs at import time. */
export function createDiagnosticsSession(selection,gate){
 let state=diagnoseMonthly(selection.artifact.injectionMonthly),revision=0,alive=true;
 const source=Object.freeze({artifactId:String(selection.artifact.artifactId),uic:selection.artifact.injectionMonthly[0]?.uic_number??null,normalizedSha256:selection.pin?.normalizedSha256??null,manifestSha256:selection.pin?.manifestSha256??null});
 const session={
  get state(){return state;},get revision(){return revision;},gate,source,
  decide(month,include,reason){state=applyDecision(state,month,include,reason);revision++;},
  dispose(){alive=false;revision++;},
  isCurrent(r){return alive&&r===revision;},
  async exportRequest(format){
   const kind=FORMATS[format];if(!kind)throw new Error('Unsupported export format: '+format);
   if(!gate.ready)throw new Error('Exports blocked: '+gate.reasons.join(' '));
   const r=revision,snapshot=state;if(!session.isCurrent(r))return null;
   const sealed=await sealDiagnostics(snapshot,source);
   if(!session.isCurrent(r))return null;
   return {filename:`h10-diagnostics-${source.uic??'well'}-${sealed.contentSha256.slice(0,12)}.${format}`,mime:kind[0],text:kind[1](sealed,snapshot)};
  }};
 return session;
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('Generated diagnostics chart could not be parsed.');return document.importNode(doc.documentElement,true);}
const fmt=v=>v===null||v===undefined?'not reported':Number(Number(v).toPrecision(6)).toLocaleString('en-US');

/** Panel inside Injector history. import-ui disposes it whenever results are cleared, so a well or source change always starts fresh. */
export function mountH10Diagnostics(root,{selection,gate,download,onChange=()=>{}}){
 const session=createDiagnosticsSession(selection,gate),section=el('section',undefined,'panel');section.setAttribute('aria-labelledby','h10-diagnostics-title');
 root.replaceChildren(section);
 let reviewOpen=null,focusKey=null,message='',markers=[],disposed=false;
 function render(){
  const st=session.state,cov=coverage(st),sc=screening(st);section.replaceChildren();
  const h=el('h2','H-10 diagnostics: choose comparable months');h.id='h10-diagnostics-title';section.append(h);
  section.append(el('p',`${LABEL_SURFACE}. ${LABEL_SCREENING}.`));
  section.append(el('p',`Coverage: ${cov.firstMonth} to ${cov.lastMonth} · ${cov.spanMonths} months in span · ${cov.reportedMonths} reported · ${cov.gapMonths.length} gap months${cov.gapMonths.length?' ('+cov.gapMonths.join(', ')+')':''} · ${cov.flaggedMonths} flagged · ${cov.includedMonths} included · ${cov.comparableMonths} comparable.${cov.lowRateEvaluated?'':' Low-rate check not evaluated: no month has a positive rate.'}`));
  const status=el('p',message,'');status.setAttribute('role','status');section.append(status);
  const review=el('details');review.open=reviewOpen??true;review.addEventListener('toggle',()=>{reviewOpen=review.open;});review.append(el('summary',`Month review (${cov.flaggedMonths} flagged by the system; you decide)`));
  const wrap=el('div',undefined,'table-scroll');wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Month review');wrap.tabIndex=0;
  const table=el('table'),head=el('tr');for(const t of ['Month','Injected (bbl)','Rate (bbl/day)','Avg psi','Max psi','Flags','Include','Reason'])head.append(el('th',t));table.append(el('thead'));table.tHead.append(head);
  const body=el('tbody');
  for(const m of st.months){
   const tr=el('tr'),d=st.decisions[m.month];tr.append(el('th',m.month));
   if(m.gap){const td=el('td','No report (gap): not zero, not interpolated');td.colSpan=7;tr.append(td);body.append(tr);continue;}
   for(const v of [m.injectedBbl,m.rateBpd,m.avgPsi,m.maxPsi])tr.append(el('td',fmt(v)));
   tr.append(el('td',m.flags.length?m.flags.map(f=>FLAG_REASONS[f]).join(' '):'none'));
   const box=el('input');box.type='checkbox';box.checked=d.include;box.setAttribute('aria-label',`Include ${m.month}`);
   const reason=el('input');reason.type='text';reason.maxLength=200;reason.value=d.reason??'';reason.placeholder=m.flags.length?'optional':'required to exclude';reason.setAttribute('aria-label',`Reason for ${m.month}`);
   box.dataset.focusKey='box:'+m.month;reason.dataset.focusKey='reason:'+m.month;
   box.onchange=()=>{try{session.decide(m.month,box.checked,reason.value);onChange();focusKey='box:'+m.month;message=`${m.month} ${box.checked?'included':'excluded'}.`;render();}catch(e){box.checked=!box.checked;status.textContent=e.message;reason.focus();}};
   reason.onchange=()=>{if(session.state.decisions[m.month].include)return;try{session.decide(m.month,false,reason.value);onChange();message=status.textContent=`Reason for ${m.month} saved.`;}catch(e){reason.value=session.state.decisions[m.month].reason??'';status.textContent=e.message;}};
   const inc=el('td');inc.append(box);if(d.include&&!m.usable)inc.append(el('small',' included, but its values cannot be compared'));tr.append(inc);
   const rs=el('td');rs.append(reason);tr.append(rs);body.append(tr);
  }
  table.append(body);wrap.append(table);review.append(wrap);section.append(review);
  if(!gate.ready){section.append(el('p','Screening views and exports are blocked. '+gate.reasons.join(' ')));}
  else{
   for(const chart of [pressureRateSvg(st),ratioOverTimeSvg(st,markers)]){const box=el('div',undefined,'analysis-chart-scroll');box.append(svgNode(chart.svg));section.append(box);}
   const actions=el('div',undefined,'import-actions');
   for(const [format,label] of [['json','Download diagnostics JSON'],['csv','Download diagnostics CSV'],['svg','Download diagnostics SVG']]){
    const b=el('button',label);b.type='button';
    b.onclick=async()=>{try{const r=await session.exportRequest(format);if(!r){status.textContent='The selection changed while preparing this export. Download again.';return;}download(r.text,r.filename,r.mime);status.textContent=`Downloaded ${r.filename}.`;}catch(e){status.textContent=e.message;}};
    actions.append(b);
   }
   section.append(actions);
  }
  const check=el('details');check.append(el('summary','Possible causes: questions to investigate, not conclusions'));const ul=el('ul');
  for(const c of CHECKLIST)ul.append(el('li',`${c.cause}: check ${c.evidence.charAt(0).toLowerCase()+c.evidence.slice(1)}.`));check.append(ul);section.append(check);
  if(gate.ready)section.append(el('p',sc.enough?`${sc.points.length} months contribute to the screening views.`:`Not enough comparable months (${sc.points.length} of ${sc.needed} needed).`));
 if(focusKey){const t=section.querySelector(`[data-focus-key="${focusKey}"]`);if(t)t.focus();focusKey=null;}
 }
 render();
 const months=session.state.months;
 return {get state(){return session.state;},dispose(){disposed=true;session.dispose();root.replaceChildren();},setMarkers(next){markers=Array.isArray(next)?[...next]:[];if(!disposed)render();},range:months.length?{first:months[0].month,last:months[months.length-1].month}:null};
}
