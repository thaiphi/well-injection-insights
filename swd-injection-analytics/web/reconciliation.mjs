import {reconcile,reportDepth,LABEL_RECON,SCREENING_TEXT,FORMATION_TEXT,DIFFERENTIAL_LABEL,PERMIT_EQ_LABEL,NEGATIVE_FLAG,ABOVE_PERMIT_FLAG} from '../dist/pressureReconciliation.js';
import {validateDeclaredLimit,DEFAULT_WELL_ASSUMPTIONS,SURFACE_BASIS_PROMPT} from '../dist/wellAssumptions.js';
import {reconciliationSvg} from '../dist/pressureReconciliationChart.js';
import {sealReconciliation,reconciliationJson,reconciliationCsv,reconciliationSvgExport} from '../dist/pressureReconciliationExport.js';

const FORMATS={json:['application/json',s=>reconciliationJson(s)],csv:['text/csv;charset=utf-8',s=>reconciliationCsv(s)],svg:['image/svg+xml',(s,rec)=>reconciliationSvgExport(s,rec)]};
const copyUploads=list=>(Array.isArray(list)?list:[]).map(u=>({kind:u.kind,fileName:u.fileName,sha256:u.sha256}));
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;

/** DOM-free session over the live 1a/1b states, the shared well assumptions and the J estimate; memoised per revision; stale refusal. */
export function createReconciliationSession({selection,gate,h10,tests,uploads=[],well=DEFAULT_WELL_ASSUMPTIONS,j=null}){
 const artifact=selection.artifact,inv=artifact.inventory?.[0]??{},uic=String(artifact.injectionMonthly?.[0]?.uic_number??inv.uic_number??'');
 const permit={surfacePsi:num(inv.permit_liquid_pressure_limit_psi),topDepthFt:num(inv.permitted_top_depth_ft)};
 let inputs={h10,tests,well,j},limit=null,revision=0,alive=true,uploadList=copyUploads(uploads),memo=null,computations=0;
 const compute=()=>{if(memo&&memo.revision===revision)return memo.result;const result=reconcile({...inputs,permit,declaredLimit:limit});computations++;memo={revision,result};return result;};
 const sealSource=rec=>{
  if(inputs.tests.records.some(r=>r.origin==='upload')&&!uploadList.length)throw new Error('Sealing refused: uploaded test records are present but their upload provenance (file name and SHA-256) was not supplied.');
  return {uic,artifactId:String(artifact.artifactId),normalizedSha256:selection.pin?.normalizedSha256??null,manifestSha256:selection.pin?.manifestSha256??null,
   h10Decisions:Object.fromEntries(Object.entries(inputs.h10?.decisions??{}).map(([k,d])=>[k,{include:d.include,reason:d.reason,byUser:d.byUser}])),
   tests:{packageFiles:{...(selection.tests?.sha256??{})},uploads:uploadList.map(u=>({...u})),inclusions:Object.fromEntries(Object.entries(inputs.tests.decisions).map(([k,d])=>[k,d.include]))},
   jMatches:Object.fromEntries((inputs.j?.tests??[]).map(t=>[t.key,t.month]))};
 };
 const session={
  get result(){return compute();},get revision(){return revision;},get computations(){return computations;},get declaredLimit(){return limit;},gate,uic,permit,
  get reportDepth(){return reportDepth(inputs.tests,permit.topDepthFt);},
  update(next){inputs={h10:next.h10,tests:next.tests,well:next.well??inputs.well,j:'j' in next?next.j:inputs.j};if(next.uploads!==undefined)uploadList=copyUploads(next.uploads);revision++;},
  setLimit(raw){const next=raw===null?null:validateDeclaredLimit(raw);limit=next;revision++;},
  dispose(){alive=false;revision++;},
  isCurrent(r){return alive&&r===revision;},
  async exportRequest(format){
   const kind=FORMATS[format];if(!kind)throw new Error('Unsupported export format: '+format);
   if(!gate.ready)throw new Error('Exports blocked: '+gate.reasons.join(' '));
   if(!inputs.well.surfaceBasis)throw new Error('Downloads need the confirmed H-10 and permit pressure basis.');
   const r=revision,rec=compute(),src=sealSource(rec);if(!session.isCurrent(r))return null;
   const sealed=await sealReconciliation(rec,src);if(!session.isCurrent(r))return null;
   return {filename:`pressure-reconciliation-${uic||'well'}-${sealed.contentSha256.slice(0,12)}.${format}`,mime:kind[0],text:kind[1](sealed,rec)};
  }};
 return session;
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=v=>v===null||v===undefined?'—':typeof v==='number'?Number(v.toPrecision(5)).toLocaleString('en-US'):String(v);
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('Generated reconciliation chart could not be parsed.');return document.importNode(doc.documentElement,true);}
const cellOf=(v,reason)=>v===null||v===undefined?(reason??'—'):fmt(v);

/** Panel inside Injector history, below the J panel. import-ui disposes it whenever results are cleared. */
export function mountReconciliation(root,{selection,gate,download,h10,tests,uploads,well,j,onLimitChange=()=>{}}){
 const session=createReconciliationSession({selection,gate,h10,tests,uploads,well,j}),section=el('section',undefined,'panel');section.setAttribute('aria-labelledby','reconciliation-title');
 const h=el('h2',LABEL_RECON);h.id='reconciliation-title';const statusEl=el('p');statusEl.setAttribute('role','status');const body=el('div');
 section.append(h,statusEl,body);root.replaceChildren(section);
 let disposed=false,focusKey=null;const drafts=new Map();
 const setStatus=t=>{statusEl.textContent=t;};
 const draft=(key,input,persisted)=>{input.dataset.focusKey=key;input.value=drafts.has(key)?drafts.get(key):(persisted??'');input.addEventListener?.('input',()=>drafts.set(key,input.value));return input;};
 const act=(key,fn,ok)=>{let changed=false;try{fn();for(const k of [...drafts.keys()])if(k.startsWith('limit:'))drafts.delete(k);setStatus(ok);changed=true;}catch(e){setStatus(e.message);}focusKey=key;render();
  if(changed){try{onLimitChange(session.declaredLimit);}catch(e){console.error(e);}}};
 function render(){
  if(disposed)return;
  const page=el('div'),top=el('div'),tail=el('div');
  // The limit form is built from session state alone, outside the try that computes the reconciliation, so a failure never removes it.
  const lim=session.declaredLimit;let depthNow=null;try{depthNow=session.reportDepth.depthFt;}catch{}
  const form=el('fieldset');form.append(el('legend','Declared bottomhole limit (optional; your declaration, not evidence)'));
  const pv=el('input');pv.type='number';pv.step='any';draft('limit:psia',pv,lim?String(lim.psia):'');pv.setAttribute('aria-label','Declared bottomhole limit (psia)');
  const dv=el('input');dv.type='number';dv.step='any';draft('limit:depth',dv,lim?String(lim.depthFt):depthNow===null?'':String(depthNow));dv.setAttribute('aria-label','Depth of the declared limit (ft)');
  const rv=el('input');rv.type='text';rv.maxLength=200;draft('limit:reason',rv,lim?.reason);rv.placeholder='reason (required)';rv.setAttribute('aria-label','Reason for the declared limit');
  const set=el('button',lim?'Change limit':'Set limit');set.type='button';set.dataset.focusKey='limit';set.onclick=()=>act('limit',()=>session.setLimit({psia:pv.value,depthFt:dv.value,reason:rv.value}),'Declared bottomhole limit set.');
  const clear=el('button','Clear limit');clear.type='button';clear.dataset.focusKey='limit-clear';clear.disabled=!lim;clear.onclick=()=>act('limit-clear',()=>session.setLimit(null),'Declared bottomhole limit cleared.');
  form.append(el('label','Limit (psia) '),pv,el('label','Depth (ft) '),dv,rv,set,clear);
  page.append(top,form,tail);
  try{
   const rec=session.result,c=rec.counts;
   if(rec.surfaceBasis)top.append(el('p',`Months in range: ${c.months} · included: ${c.included} · modelled: ${c.modelled} · refused: ${Object.values(c.refused).reduce((a,b)=>a+b,0)} · test months: ${c.testMonths} · negative differentials: ${c.negativeDifferentials} · months above the permit: ${c.abovePermit}`),
    el('p',rec.readiness));
   if(rec.surfaceBasis){
   if(rec.surfaceBasis&&!rec.bhpBasis&&c.testMonths)top.append(el('p','Confirm the BHP basis in the J panel.'));
   if(Object.keys(c.refused).length)top.append(el('p','Refused: '+Object.entries(c.refused).map(([k,v])=>`${k} (${v})`).join('; ')));
   const sum=el('ul');for(const t of [`Regulatory margin (smallest): ${cellOf(rec.summary.minRegulatoryPsi,'unavailable')} psi`,
     `Permit-equivalent margin (smallest): ${cellOf(rec.summary.minPermitEquivalentPsi,'unavailable')} psi — ${PERMIT_EQ_LABEL}`,
     `Declared limit margin (smallest): ${rec.declaredLimit?cellOf(rec.summary.minDeclaredPsi,'unavailable')+' psi':'No limit declared'}`,`Formation margin: ${FORMATION_TEXT}`])sum.append(el('li',t));
   top.append(sum);for(const n of rec.notes)top.append(el('p',n));
   }
   if(rec.rows.length){
    const wrap=el('div',undefined,'table-scroll');wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Monthly reconciliation');wrap.tabIndex=0;
    const table=el('table'),head=el('tr');for(const t of ['Month','Rate (bbl/day)','Average (psi)','Maximum (psi)','Regulatory margin (psi)','Modelled BHP (psia)','Hydrostatic (psi)','Friction (psi)',
      'Permit-equivalent BHP (psia)','Permit-equivalent margin (psi)','Declared margin (psi)',`Differential (psi), ${DIFFERENTIAL_LABEL}`,'Test gradient (psi/ft)','Column gradient (psi/ft)','Status'])
     {const th=el('th',t);th.scope='col';head.append(th);}
    table.append(el('thead'));table.tHead.append(head);const tb=el('tbody');
    for(const r of rec.rows){const tr=el('tr');
     for(const v of [r.month,r.rateBpd,r.avgPsi,r.maxPsi])tr.append(el('td',fmt(v)));
     tr.append(el('td',cellOf(r.regulatory.marginPsi,r.regulatory.reason)+(r.regulatory.abovePermit?` — ${ABOVE_PERMIT_FLAG}`:'')));
     for(const v of [r.modelled.pwfPsia,r.modelled.hydroPsi,r.modelled.frictionPsi,r.permitEquivalent.pwfPsia])tr.append(el('td',fmt(v)));
     tr.append(el('td',cellOf(r.permitEquivalent.marginPsi,r.permitEquivalent.reason)),el('td',cellOf(r.declared.marginPsi,r.declared.reason)));
     const dc=el('td');if(r.tests.length){for(const t of r.tests){dc.append(el('p',`${t.date}: ${cellOf(t.differentialPsi,t.reason)}${t.negative?` — ${NEGATIVE_FLAG}`:''}`));if(t.checklist.length){const ul=el('ul');for(const x of t.checklist)ul.append(el('li',x));dc.append(ul);}}}else dc.textContent='—';tr.append(dc);
     const perTest=f=>r.tests.length?r.tests.map(t=>`${t.date}: ${fmt(f(t))}`).join('; '):'—';
     tr.append(el('td',perTest(t=>t.testGradientPsiFt)),el('td',perTest(t=>t.columnGradientPsiFt)),el('td',r.status==='included'?(r.modelled.reason??'modelled'):r.modelled.reason));
     tb.append(tr);}
    table.append(tb);wrap.append(table);tail.append(wrap);
    if(gate.ready){const box=el('div',undefined,'analysis-chart-scroll');box.append(svgNode(reconciliationSvg(rec).svg));tail.append(box);}
   }
   if(!gate.ready)tail.append(el('p','Exports are blocked. '+gate.reasons.join(' ')));
   else{
    const dlBlock=rec.surfaceBasis?'':'Downloads need the confirmed H-10 and permit pressure basis.';
    const actions=el('div',undefined,'import-actions');
    for(const [format,label] of [['json','Download reconciliation JSON'],['csv','Download reconciliation CSV'],['svg','Download reconciliation SVG']]){const b=el('button',label);b.type='button';b.disabled=!!dlBlock;b.dataset.focusKey='dl:'+format;
     b.onclick=async()=>{try{const r=await session.exportRequest(format);if(!r){setStatus('The selection changed while preparing this export. Download again.');return;}download(r.text,r.filename,r.mime);setStatus(`Downloaded ${r.filename}.`);}catch(e){setStatus(e.message);}};actions.append(b);}
    tail.append(actions);if(dlBlock)tail.append(el('p',dlBlock));
   }
  }catch(e){
   top.replaceChildren();tail.replaceChildren(el('p','The reconciliation panel could not render: '+(e&&e.message?e.message:String(e))));
  }
  tail.append(el('p',SCREENING_TEXT));
  try{if(!session.result.surfaceBasis&&!top.children.length)top.append(el('p',SURFACE_BASIS_PROMPT));}catch{}
  body.replaceChildren(...page.childNodes);
  if(focusKey){const t=section.querySelector(`[data-focus-key="${focusKey}"]`);if(t)t.focus();focusKey=null;}
 }
 render();
 return {get declaredLimit(){return session.declaredLimit;},dispose(){disposed=true;session.dispose();root.replaceChildren();},
  update(inputs){if(disposed)return;try{session.update(inputs);setStatus('Recalculated after a change.');}catch(e){setStatus(e&&e.message?e.message:String(e));}render();}};
}
