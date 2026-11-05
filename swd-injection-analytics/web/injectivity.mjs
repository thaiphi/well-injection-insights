import {createEstimateState,withInputs,confirmBasis,setSurfaceBasis,setAssumptions,moveMatch,chooseJ,estimate,handoff,LABEL_J,BASIS_STATEMENT} from '../dist/injectivityEstimate.js';
import {DEFAULT_WELL_ASSUMPTIONS} from '../dist/wellAssumptions.js';
import {jEstimateSvg} from '../dist/injectivityEstimateChart.js';
import {sealEstimate,estimateJson,estimateCsv,estimateSvg} from '../dist/injectivityEstimateExport.js';

const FORMATS={json:['application/json',s=>estimateJson(s)],csv:['text/csv;charset=utf-8',s=>estimateCsv(s)],svg:['image/svg+xml',(s,est)=>estimateSvg(s,est)]};
const copyUploads=list=>(Array.isArray(list)?list:[]).map(u=>({kind:u.kind,fileName:u.fileName,sha256:u.sha256}));
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;

/** DOM-free session: BHP basis, moved matches and the chosen J over the live 1a/1b states and the shared well assumptions; revision counter and stale refusal. */
export function createInjectivitySession({selection,gate,h10,tests,uploads=[],well=DEFAULT_WELL_ASSUMPTIONS,declaredLimit=null}){
 const artifact=selection.artifact,inv=artifact.inventory?.[0]??{},uic=String(artifact.injectionMonthly?.[0]?.uic_number??inv.uic_number??'');
 const permit={surfacePsi:num(inv.permit_liquid_pressure_limit_psi),volumeBpd:num(inv.permit_liquid_volume_limit_bpd)};
 const source={uic,artifactId:String(artifact.artifactId),normalizedSha256:selection.pin?.normalizedSha256??null,manifestSha256:selection.pin?.manifestSha256??null,tests:{packageFiles:{...(selection.tests?.sha256??{})},uploads:[]}};
 const applyWell=(s,w)=>setSurfaceBasis(setAssumptions(s,w),w.surfaceBasis??null);
 let state=applyWell(createEstimateState({h10,tests}),well),revision=0,alive=true,uploadList=copyUploads(uploads),limit=declaredLimit;
 // Compute the estimate before committing: a failing recomputation rejects with its message and leaves state and revision unchanged.
 const change=next=>{estimate(next);state=next;revision++;};
 const sealSource=()=>{
  if(state.inputs.tests.records.some(r=>r.origin==='upload')&&!uploadList.length)throw new Error('Sealing refused: uploaded test records are present but their upload provenance (file name and SHA-256) was not supplied.');
  return {...source,tests:{packageFiles:{...source.tests.packageFiles},uploads:uploadList.map(u=>({...u}))}};
 };
 const session={
  get state(){return state;},get estimate(){return estimate(state);},get revision(){return revision;},get uploads(){return uploadList.map(u=>({...u}));},get declaredLimit(){return limit;},gate,uic,
  update(inputs){let next=withInputs(state,{h10:inputs.h10,tests:inputs.tests});if(inputs.well!==undefined)next=applyWell(next,inputs.well);change(next);
   if(inputs.uploads!==undefined)uploadList=copyUploads(inputs.uploads);if(inputs.declaredLimit!==undefined)limit=inputs.declaredLimit;},
  confirmBasis(value,reason){change(confirmBasis(state,value,reason));},
  setAssumptions(partial){change(setAssumptions(state,partial));},
  move(key,shift,reason){change(moveMatch(state,key,shift,reason));},
  choose(key,reason){change(chooseJ(state,key,reason));},
  dispose(){alive=false;revision++;},
  isCurrent(r){return alive&&r===revision;},
  async exportRequest(format){
   const kind=FORMATS[format];if(!kind)throw new Error('Unsupported export format: '+format);
   if(!gate.ready)throw new Error('Exports blocked: '+gate.reasons.join(' '));
   const r=revision,est=estimate(state),src=sealSource();if(!session.isCurrent(r))return null;
   const sealed=await sealEstimate(est,src);if(!session.isCurrent(r))return null;
   return {filename:`test-referenced-j-${uic||'well'}-${sealed.contentSha256.slice(0,12)}.${format}`,mime:kind[0],text:kind[1](sealed,est)};
  },
  async handoffRequest(){
   if(!gate.ready)throw new Error('Hand-off blocked: '+gate.reasons.join(' '));
   const r=revision,snapshot=state,est=estimate(snapshot),src=sealSource();const sealed=await sealEstimate(est,src);if(!session.isCurrent(r))return null;
   return handoff(snapshot,est,permit,sealed.contentSha256,limit);
  }};
 return session;
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=v=>v===null||v===undefined?'—':typeof v==='number'?Number(v.toPrecision(5)).toLocaleString('en-US'):String(v);
function svgNode(svg){const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='svg')throw new Error('Generated J chart could not be parsed.');return document.importNode(doc.documentElement,true);}

/** Counts for the status line. matched = has a month and is not unmatched; qualifying = status 'qualifies'. */
export function statusCounts(est){
 const t=est.tests;
 return {bhp:t.length,matched:t.filter(x=>x.month!==null&&x.status!=='unmatched').length,unmatched:t.filter(x=>x.status==='unmatched').length,notUsable:t.filter(x=>x.month===null&&x.status!=='unmatched').length,qualifying:t.filter(x=>x.status==='qualifies').length};
}

/** Panel inside Injector history, below Test records. import-ui disposes it whenever results are cleared. */
export function mountInjectivity(root,{selection,gate,download,h10,tests,uploads,well,declaredLimit=null,onHandoff,onChange=()=>{}}){
 const session=createInjectivitySession({selection,gate,h10,tests,uploads,well,declaredLimit}),section=el('section',undefined,'panel');section.setAttribute('aria-labelledby','injectivity-title');
 const statusEl=el('p');statusEl.setAttribute('role','status');
 const body=el('div');
 const h=el('h2',LABEL_J);h.id='injectivity-title';
 section.append(h,statusEl,body);
 root.replaceChildren(section);
 let disposed=false,focusKey=null;const drafts=new Map();
 const setStatus=t=>{statusEl.textContent=t;};
 const draft=(key,input,persisted)=>{input.dataset.focusKey=key;input.value=drafts.has(key)?drafts.get(key):(persisted??'');input.addEventListener('input',()=>drafts.set(key,input.value));return input;};
 const act=(key,fn,ok)=>{let done=false;try{fn();drafts.delete(key+':reason');setStatus(ok);done=true;}catch(e){setStatus(e.message);}focusKey=key;render();if(done){try{onChange();}catch(e){console.error(e);}}};
 function render(){
  if(disposed)return;
  const page=el('div'),top=el('div'),tail=el('div');
  // The controls are built from session state alone, outside the try that computes the estimate, so a failed estimate never removes them.
  // 1. basis
   const basis=el('fieldset');basis.append(el('legend','Pressure basis of the BHP field (required before any J)'));
   const radios={};for(const [v,label] of [['psig','psig (RRC Permian guidance, default)'],['psia','psia (as the source field is named)']]){const l=el('label'),r=el('input');r.type='radio';r.name='j-basis';r.value=v;r.checked=(session.state.basis?.value??'psig')===v;r.dataset.focusKey='basis:'+v;radios[v]=r;l.append(r,document.createTextNode(' '+label));basis.append(l);}
   const why=el('input');why.type='text';why.maxLength=200;draft('basis:reason',why,session.state.basis?.reason);why.placeholder='reason (required)';why.setAttribute('aria-label','Reason for the basis');
   const confirm=el('button',session.state.basis?'Change basis':'Confirm basis');confirm.type='button';confirm.dataset.focusKey='basis';confirm.onclick=()=>act('basis',()=>session.confirmBasis(radios.psia.checked?'psia':'psig',why.value),'Basis confirmed.');
   basis.append(why,confirm);
   // 2. assumptions live in Well assumptions above
   const form=el('p','Tubing, fluid and the H-10 and permit pressure basis are declared in Well assumptions above.');
  page.append(top,basis,form,tail);
  try{
   const est=session.estimate;
   const out=tail;
   const c=statusCounts(est);
   top.append(el('p',`BHP tests: ${c.bhp} · matched: ${c.matched} · unmatched: ${c.unmatched} · not usable: ${c.notUsable} · qualifying: ${c.qualifying}`),el('p',est.readiness),el('p',BASIS_STATEMENT));
   // 3. match table
   const wrap=el('div',undefined,'table-scroll');wrap.setAttribute('role','region');wrap.setAttribute('aria-label','BHP test matches');wrap.tabIndex=0;
   const table=el('table'),head=el('tr');for(const t of ['Test date','Depth (ft)','Matched month','Move','Rate (bbl/day)','Surface (psi)','Reported BHP (psi, as reported)','P_res (psia)','Hydrostatic (psi)','Friction (psi)','P_wf (psia)','Δp (psi)','J','J no-friction','J other basis','J by tubing','Status','Use this J']){const th=el('th',t);th.scope='col';head.append(th);}
   table.append(el('thead'));table.tHead.append(head);const tb=el('tbody');
   for(const t of est.tests){const tr=el('tr');
    for(const v of [t.date,t.depthFt,t.month])tr.append(el('td',fmt(v)));
    const mv=el('td');if(t.month){
     mv.append(el('p',t.shift===0?'containing month (default)':`moved to ${t.shift<0?'previous':'next'} month: ${t.shiftReason??''}`));
     const mr=el('input');mr.type='text';mr.maxLength=200;draft('move:'+t.key+':reason',mr,t.shiftReason);mr.placeholder='reason to move';mr.setAttribute('aria-label',`Reason to move the match for ${t.date}`);
     const sel=el('select');sel.setAttribute('aria-label',`Move the match for ${t.date}`);sel.dataset.focusKey='move:'+t.key;for(const [v,l] of [['-1','previous month'],['0','containing month'],['1','next month']]){const o=el('option',l);o.value=v;o.selected=Number(v)===t.shift;sel.append(o);}
     sel.onchange=()=>act('move:'+t.key,()=>session.move(t.key,Number(sel.value),mr.value),`Match for ${t.date} moved.`);mv.append(mr,sel);}tr.append(mv);
    for(const v of [t.rateStbd,t.surfacePsi,t.reportedPsi,t.pResPsia,t.hydrostaticPsi,t.frictionPsi,t.pWfPsia,t.deltaPsi,t.j,t.jNoFriction,t.jAlternateBasis])tr.append(el('td',fmt(v)));
    tr.append(el('td',t.jByTubing.length?t.jByTubing.map(x=>`${x.innerDiameterInches} in: ${x.j===null?x.reason:fmt(x.j)}`).join('; '):'—'));
    tr.append(el('td',t.status==='qualifies'?'qualifies':`${t.status}: ${t.reason}`));
    const use=el('td');if(t.status==='qualifies'){
     const cr=el('input');cr.type='text';cr.maxLength=200;draft('choose:'+t.key+':reason',cr,'');cr.placeholder='reason';cr.setAttribute('aria-label',`Reason to use the J from ${t.date}`);
     const r=el('input');r.type='radio';r.name='j-choice';r.checked=t.key===est.chosenKey;r.setAttribute('aria-label',`Use the J from ${t.date}`);r.dataset.focusKey='choose:'+t.key;
     r.onchange=()=>act('choose:'+t.key,()=>session.choose(t.key,cr.value),`J from ${t.date} chosen.`);use.append(cr,r);}tr.append(use);tb.append(tr);}
   table.append(tb);wrap.append(table);out.append(wrap);
   if(est.choiceDropped)out.append(el('p','Your chosen test no longer qualifies; the latest qualifying test is used.'));
   if(est.chosenKey)out.append(el('p',`Chosen: ${est.chosenKey} (${est.choiceBy==='user'?'your choice: '+est.choiceReason:'latest qualifying test, default'}).${est.range?` J range across matched tests: ${fmt(est.range.min)} to ${fmt(est.range.max)} STB/day/psi.`:''}${est.trend?' Trend shown: tests share depth, basis and assumptions.':''}`));
   // 4. chart and round trip
   if(gate.ready){const box=el('div',undefined,'analysis-chart-scroll');box.append(svgNode(jEstimateSvg(est).svg));out.append(box);}
   if(est.roundTrip.length){const rw=el('div',undefined,'table-scroll');rw.setAttribute('role','region');rw.setAttribute('aria-label','Round trip');rw.tabIndex=0;const rt=el('table'),rh=el('tr');
    for(const t of ['Month','Rate (bbl/day)','Observed surface (psia)','Reproduced (psia)','Residual (psi)','Chosen']){const th=el('th',t);th.scope='col';rh.append(th);}rt.append(el('thead'));rt.tHead.append(rh);const rb=el('tbody');
    for(const r of est.roundTrip){const tr=el('tr');for(const v of [r.month,r.rateStbd,r.observedSurfacePsia,r.reproducedSurfacePsia,r.residualPsi===null?r.reason:r.residualPsi,r.chosen?'yes':'no'])tr.append(el('td',fmt(v)));rb.append(tr);}
    rt.append(rb);rw.append(rt);out.append(rw,el('p',est.roundTripOk?'Round trip: the scenario reproduces the chosen month within 0.5 psi.':'Round trip failed for the chosen month; exports and the hand-off are refused.'));}
   // 5. actions
   if(!gate.ready){out.append(el('p','Exports and the hand-off are blocked. '+gate.reasons.join(' ')));}
   else{
    const dlBlock=!est.basis?'Downloads need a confirmed pressure basis.':(est.chosenKey&&!est.roundTripOk)?'Downloads are blocked: the round trip failed for the chosen month.':'';
    const actions=el('div',undefined,'import-actions');
    for(const [format,label] of [['json','Download J estimate JSON'],['csv','Download J estimate CSV'],['svg','Download J estimate SVG']]){const b=el('button',label);b.type='button';b.disabled=!!dlBlock;b.dataset.focusKey='dl:'+format;
     b.onclick=async()=>{try{const r=await session.exportRequest(format);if(!r){setStatus('The selection changed while preparing this export. Download again.');return;}download(r.text,r.filename,r.mime);setStatus(`Downloaded ${r.filename}.`);}catch(e){setStatus(e.message);}};actions.append(b);}
    const use=el('button','Use in scenario (Hydraulics)');use.type='button';use.disabled=!est.chosenKey||!est.roundTripOk;use.dataset.focusKey='handoff';
    use.onclick=async()=>{try{const hd=await session.handoffRequest();if(!hd){setStatus('The selection changed while preparing the hand-off. Try again.');return;}onHandoff(hd);}catch(e){setStatus(e.message);}};
    actions.append(use);out.append(actions,el('p',"Download the J estimate JSON first: opening Hydraulics clears this review, and the hand-off cites the sealed estimate's hash."));if(dlBlock)out.append(el('p',dlBlock));
   }
  }catch(e){
   top.replaceChildren();tail.replaceChildren(el('p','The J panel could not render the estimate: '+(e&&e.message?e.message:String(e))));
  }
  body.replaceChildren(...page.childNodes);
  if(focusKey){const t=section.querySelector(`[data-focus-key="${focusKey}"]`);if(t)t.focus();focusKey=null;}
 }
 render();
 return {dispose(){disposed=true;session.dispose();root.replaceChildren();},get estimate(){try{return session.estimate;}catch{return null;}},
  update(inputs){if(disposed)return;try{session.update(inputs);setStatus('Recalculated after a review change.');}catch(e){setStatus(e&&e.message?e.message:String(e));}render();}};
}
