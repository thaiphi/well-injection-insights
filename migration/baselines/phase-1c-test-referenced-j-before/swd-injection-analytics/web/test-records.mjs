import {parseCsv} from '../dist/importProfile.js';
import {buildTestState,applyTestDecision,rowsFromTable,bhpSeries,outOfRange,timelineMarkers,testCoverage,ORIGIN_LABELS,LABEL_SRT,LABEL_BHP_BASIS,J_READINESS,hasMarker,rangePosition} from '../dist/testRecords.js';
import {testPressureSvg} from '../dist/testRecordsChart.js';
import {sealTestRecords,testRecordsJson,testRecordsCsv,testRecordsSvg} from '../dist/testRecordsExport.js';

export const MAX_UPLOAD_BYTES=2_000_000;
const FORMATS={json:['application/json',s=>testRecordsJson(s)],csv:['text/csv;charset=utf-8',s=>testRecordsCsv(s)],svg:['image/svg+xml',(s,state)=>testRecordsSvg(s,state)]};
async function sha256(bytes){const d=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('');}

/** DOM-free session: package and uploaded test records, the user's decisions, a revision counter and stale-export refusal. Nothing runs at import time. */
export function createTestRecordsSession({selection,gate,range}){
 const artifact=selection.artifact,uic=String(artifact.injectionMonthly?.[0]?.uic_number??artifact.inventory?.[0]?.uic_number??'');
 const pkg=selection.tests?{bhp:selection.tests.bhp,srt:selection.tests.srt}:null,uploads={bhp:null,srt:null};
 const build=()=>buildTestState({package:pkg,upload:{bhp:uploads.bhp?.rows??[],srt:uploads.srt?.rows??[]}},range);
 let state=build(),revision=0,alive=true;
 const source=()=>({uic,package:selection.tests?{artifactId:String(artifact.artifactId),normalizedSha256:selection.pin?.normalizedSha256??null,manifestSha256:selection.pin?.manifestSha256??null,files:{...selection.tests.sha256}}:null,
  uploads:['bhp','srt'].filter(k=>uploads[k]).map(k=>({kind:k,fileName:uploads[k].fileName,sha256:uploads[k].sha256}))});
 const session={
  get state(){return state;},get revision(){return revision;},gate,uic,
  decide(key,include,reason){state=applyTestDecision(state,key,include,reason);revision++;},
  async upload(fileName,bytes){
   if(!(bytes instanceof Uint8Array))throw new Error('Upload must be file bytes.');
   if(!/\.csv$/i.test(String(fileName)))throw new Error("Only CSV files in Explorer's BHP or SRT test column layout are accepted.");
   if(bytes.length>MAX_UPLOAD_BYTES)throw new Error('The file is larger than 2 MB.');
   let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('The file is not valid UTF-8 text.');}
   const {kind,rows}=rowsFromTable(parseCsv(text),uic),digest=await sha256(bytes);
   if(!alive)return null;
   uploads[kind]={rows,fileName:String(fileName),sha256:digest};state=build();revision++;
   return {kind,count:rows.length};
  },
  dispose(){alive=false;revision++;},
  isCurrent(r){return alive&&r===revision;},
  async exportRequest(format){
   const kind=FORMATS[format];if(!kind)throw new Error('Unsupported export format: '+format);
   if(!gate.ready)throw new Error('Exports blocked: '+gate.reasons.join(' '));
   const r=revision,snapshot=state,src=source();if(!session.isCurrent(r))return null;
   const sealed=await sealTestRecords(snapshot,src);
   if(!session.isCurrent(r))return null;
   return {filename:`test-records-${uic||'well'}-${sealed.contentSha256.slice(0,12)}.${format}`,mime:kind[0],text:kind[1](sealed,snapshot)};
  }};
 return session;
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const perfs=(a,b)=>(a===null||a===undefined)&&(b===null||b===undefined)?null:`${fmt(a)} to ${fmt(b)}`;
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('Generated test chart could not be parsed.');return document.importNode(doc.documentElement,true);}
const fmt=v=>v===null||v===undefined||v===''?'not reported':typeof v==='number'?Number(v.toPrecision(6)).toLocaleString('en-US'):String(v);

/** Panel inside Injector history, below the H-10 panel. import-ui disposes it whenever results are cleared. */
export function mountTestRecords(root,{selection,gate,download,range,onMarkers=()=>{}}){
 const session=createTestRecordsSession({selection,gate,range}),section=el('section',undefined,'panel');section.setAttribute('aria-labelledby','test-records-title');
 root.replaceChildren(section);
 let message='',focusKey=null;
 function controls(r,st,status){
  const d=st.decisions[r.key],box=el('input'),reason=el('input');
  box.type='checkbox';box.checked=d.include;box.setAttribute('aria-label',`Include ${r.kind.toUpperCase()} ${r.date??r.dateText}`);box.dataset.focusKey='box:'+r.key;
  reason.type='text';reason.maxLength=200;reason.value=d.reason??'';reason.placeholder=r.flags.length?'optional':'required to exclude';reason.setAttribute('aria-label',`Reason for ${r.kind.toUpperCase()} ${r.date??r.dateText}`);reason.dataset.focusKey='reason:'+r.key;
  box.onchange=()=>{try{session.decide(r.key,box.checked,reason.value);focusKey='box:'+r.key;message=`${r.kind.toUpperCase()} ${r.date??r.dateText} ${box.checked?'included':'excluded'}.`;render();}catch(e){box.checked=!box.checked;status.textContent=e.message;reason.focus();}};
  reason.onchange=()=>{if(session.state.decisions[r.key].include)return;try{session.decide(r.key,false,reason.value);message=status.textContent=`Reason saved.`;}catch(e){reason.value=session.state.decisions[r.key].reason??'';status.textContent=e.message;}};
  const inc=el('td');inc.append(box);if(d.include){const pr=r.pressures.some(p=>p.value!==null),point=r.kind==='bhp'&&r.date!==null&&pr&&r.depthFt!==null;
   if(!point&&!hasMarker(session.state,r))inc.append(el('small',r.kind==='bhp'&&r.date!==null&&pr&&r.depthFt===null?' Included, but no test-pressure chart point (no depth); shown as a timeline marker only if dated inside the H-10 range.':(pr&&r.date!==null&&rangePosition(r.date,session.state.range)==='before'?' Included; dated before the reported H-10 range, so no timeline marker.':pr&&r.date!==null&&rangePosition(r.date,session.state.range)==='after'?' Included; dated after the reported H-10 range, so no timeline marker.':' Included, but contributes to no chart (missing date or pressure).')));
   else if(r.kind==='bhp'&&r.date!==null&&pr&&r.depthFt===null)inc.append(el('small',' Included, but no test-pressure chart point (no depth); shown as a timeline marker only if dated inside the H-10 range.'));}
  const rs=el('td');rs.append(reason);return [inc,rs];
 }
 function tableOf(label,heads,records,cells,st,status){
  const wrap=el('div',undefined,'table-scroll');wrap.setAttribute('role','region');wrap.setAttribute('aria-label',label);wrap.tabIndex=0;
  const table=el('table'),head=el('tr');for(const t of [...heads,'Source','Flags','Include','Reason'])head.append(el('th',t));table.append(el('thead'));table.tHead.append(head);
  const body=el('tbody');
  for(const r of records){const tr=el('tr');for(const v of cells(r))tr.append(el('td',fmt(v)));tr.append(el('td',ORIGIN_LABELS[r.origin]));
   tr.append(el('td',[...r.reasons,...r.notes.map(n=>`Note: ${n}`)].join(' ')||'none'));tr.append(...controls(r,st,status));body.append(tr);}
  table.append(body);wrap.append(table);return wrap;
 }
 function render(){
  const st=session.state,cov=testCoverage(st),series=bhpSeries(st),o=outOfRange(st);section.replaceChildren();
  const h=el('h2','Test records: choose comparable tests');h.id='test-records-title';section.append(h);
  section.append(el('p',J_READINESS));
  const ref=st.referenceTie?'no single most-common depth':st.referenceDepthFt===null?'none':`${st.referenceDepthFt} ft`;
  section.append(el('p',`Records: ${cov.bhpRecords} BHP, ${cov.srtRecords} step-rate · ${cov.packageRecords} ${ORIGIN_LABELS.package.toLowerCase()} · ${cov.uploadRecords} ${ORIGIN_LABELS.upload.toLowerCase()} · ${cov.flagged} flagged · ${cov.included} included · reference depth ${ref}.`));
  const status=el('p',message);status.setAttribute('role','status');section.append(status);
  const up=el('label','Add test records (CSV in Explorer\'s BHP or SRT column layout): ');const input=el('input');input.type='file';input.accept='.csv,text/csv';up.append(input);section.append(up);
  input.dataset.focusKey='upload';input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{if(f.size>MAX_UPLOAD_BYTES)throw new Error('The file is larger than 2 MB.');const r=await session.upload(f.name,new Uint8Array(await f.arrayBuffer()));if(!r)return;message=`Added ${r.count} ${r.kind.toUpperCase()} records from ${f.name} (not verified).`;focusKey='upload';render();}catch(e){status.textContent=e.message;input.value='';input.focus();}};
  if(!st.records.length)section.append(el('p','No test records for this well.'));
  const bhp=st.records.filter(r=>r.kind==='bhp'),srt=st.records.filter(r=>r.kind==='srt');
  if(bhp.length)section.append(tableOf('BHP test review',['Test date','Date as published','BHP (source field named psia)','Depth (ft)','Gradient (psi/ft)','Formation'],bhp,r=>[r.date,r.dateText,r.bhpPsia,r.depthFt,r.values.gradient_psi_ft??null,r.values.tested_formation??''],st,status));
  if(bhp.length)section.append(el('p',LABEL_BHP_BASIS+'.'));
  if(srt.length)section.append(tableOf('Step-rate test review',['Test date','Date as published','Satisfactory code (meaning undocumented)','Perforations (ft)','Rate range (bbl/min)','ISIP (psig, as reported)','Frac pressure (psig, as reported)','FIRC surface pressure (psig, as reported)','Fracture gradient (psi/ft)','FIRC rate (bbl/day)','Comments'],srt,
   r=>[r.date,r.dateText,r.values.satisfactory_test_code??'',perfs(r.values.top_perf_ft,r.values.bottom_perf_ft),`${fmt(r.values.min_inj_rate_bpm)} to ${fmt(r.values.max_inj_rate_bpm)}`,r.values.isip_psig??null,r.values.formation_frac_press_psig??null,r.values.surface_pressure_firc_psig??null,r.values.fracture_gradient_psi_ft??null,r.values.frac_inj_rate_capacity_bpd??null,r.values.comments??''],st,status));
  for(const [list,label] of [[o.before,'Before the reported H-10 range (no timeline marker)'],[o.after,'After the reported H-10 range (no timeline marker)']])
   if(list.length)section.append(el('p',`${label}: ${list.map(r=>`${r.kind.toUpperCase()} ${r.date}`).join(', ')}.`));
  if(!gate.ready){section.append(el('p','The test chart, timeline markers and exports are blocked. '+gate.reasons.join(' ')));onMarkers([]);}
  else{
   if(bhp.length){const box=el('div',undefined,'analysis-chart-scroll');box.append(svgNode(testPressureSvg(st).svg));section.append(box);}
   const actions=el('div',undefined,'import-actions');
   for(const [format,label] of [['json','Download test records JSON'],['csv','Download test records CSV'],['svg','Download test records SVG']]){
    const b=el('button',label);b.type='button';
    b.onclick=async()=>{try{const r=await session.exportRequest(format);if(!r){status.textContent='The selection changed while preparing this export. Download again.';return;}download(r.text,r.filename,r.mime);status.textContent=`Downloaded ${r.filename}.`;}catch(e){status.textContent=e.message;}};
    actions.append(b);
   }
   section.append(actions);
   section.append(el('p',bhp.length?(series.enough?`${series.points.length} BHP tests contribute to the chart.`:`Not enough comparable tests (${series.points.length} of ${series.needed} needed).`):'No BHP tests to chart.'));
   onMarkers(timelineMarkers(st));
  }
  if(srt.length)section.append(el('p',LABEL_SRT));
  if(focusKey){const t=section.querySelector(`[data-focus-key="${focusKey}"]`);if(t)t.focus();focusKey=null;}
 }
 render();
 return {dispose(){try{onMarkers([]);}catch{}session.dispose();root.replaceChildren();}};
}
