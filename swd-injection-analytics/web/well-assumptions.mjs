import {DEFAULT_WELL_ASSUMPTIONS,DEFAULT_ASSUMPTIONS,DEPTH_STATEMENT,confirmSurfaceBasis,setWellAssumptions} from '../dist/wellAssumptions.js';
import {TUBING_SENSITIVITY_IN} from '../dist/injectivityEstimate.js';

export const ASSUMPTION_FIELDS=[['innerDiameterInches','Tubing inner diameter (in)'],['roughnessInches','Absolute roughness (in)'],['surfaceTemperatureF','Surface temperature (°F)'],['bottomholeTemperatureF','Bottomhole temperature (°F)'],['salinityWtPercent','NaCl salinity (wt%)'],['segments','Traverse segments']];

/** DOM-free session: one declared set of well assumptions and the H-10 and permit pressure basis, shared by the J estimate and the reconciliation. */
export function createWellAssumptionsSession(initial=DEFAULT_WELL_ASSUMPTIONS){
 let state={...initial},revision=0;
 return {get state(){return state;},get revision(){return revision;},
  confirmBasis(value,reason){state=confirmSurfaceBasis(state,value,reason);revision++;},
  set(partial){state=setWellAssumptions(state,partial);revision++;}};
}

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};

/** Panel inside Injector history, between Test records and the J panel. import-ui disposes it whenever results are cleared. */
export function mountWellAssumptions(root,{onChange=()=>{}}={}){
 const session=createWellAssumptionsSession(),section=el('section',undefined,'panel');section.setAttribute('aria-labelledby','well-assumptions-title');
 const h=el('h2','Well assumptions');h.id='well-assumptions-title';
 const statusEl=el('p');statusEl.setAttribute('role','status');const body=el('div');
 section.append(h,statusEl,body);root.replaceChildren(section);
 let disposed=false,focusKey=null;const drafts=new Map();
 const setStatus=t=>{statusEl.textContent=t;};
 const draft=(key,input,persisted)=>{input.dataset.focusKey=key;input.value=drafts.has(key)?drafts.get(key):(persisted??'');input.addEventListener('input',()=>drafts.set(key,input.value));return input;};
 const act=(key,fn,ok)=>{let changed=false;try{fn();drafts.delete(key+':reason');setStatus(ok);changed=true;}catch(e){setStatus(e.message);}focusKey=key;render();
  if(changed){try{onChange(session.state);}catch(e){console.error(e);}}};
 function render(){
  if(disposed)return;
  const s=session.state,page=el('div');
  page.append(el('p','One declared set for the test-referenced J estimate and the WHP/BHP reconciliation below.'));
  const basis=el('fieldset');basis.append(el('legend','Pressure basis of H-10 and permit pressures (required before any calculation)'));
  const radios={};for(const [v,label] of [['psig','psig (RRC reports gauge pressure, default)'],['psia','psia']]){const l=el('label'),r=el('input');r.type='radio';r.name='surface-basis';r.value=v;r.checked=(s.surfaceBasis?.value??'psig')===v;r.dataset.focusKey='surface-basis:'+v;radios[v]=r;l.append(r,document.createTextNode(' '+label));basis.append(l);}
  const why=el('input');why.type='text';why.maxLength=200;draft('surface-basis:reason',why,s.surfaceBasis?.reason);why.placeholder='reason (required)';why.setAttribute('aria-label','Reason for the H-10 and permit basis');
  const confirm=el('button',s.surfaceBasis?'Change basis':'Confirm basis');confirm.type='button';confirm.dataset.focusKey='surface-basis';
  confirm.onclick=()=>act('surface-basis',()=>session.confirmBasis(radios.psia.checked?'psia':'psig',why.value),'H-10 and permit basis confirmed.');
  basis.append(why,confirm,el('p',s.surfaceBasis?`Confirmed: ${s.surfaceBasis.value} (${s.surfaceBasis.reason}).`:'Not confirmed: nothing is calculated until you confirm.'));
  const form=el('fieldset');form.append(el('legend','Declared assumptions (not public records)'));
  for(const [key,label] of ASSUMPTION_FIELDS){const l=el('label',label+' — declared assumption '),i=el('input');i.type='number';i.step='any';i.value=String(s[key]);i.setAttribute('aria-label',`${label}, declared assumption`);i.dataset.focusKey='assump:'+key;
   i.onchange=()=>act('assump:'+key,()=>session.set({[key]:Number(i.value)}),`${label} updated.`);l.append(i);form.append(l);}
  form.append(el('p',`Defaults: ${Object.entries(DEFAULT_ASSUMPTIONS).map(([k,v])=>`${k} ${v}`).join(', ')}. ${DEPTH_STATEMENT} Tubing sensitivity always runs ${TUBING_SENSITIVITY_IN.join(', ')} in.`));
  page.append(basis,form);
  body.replaceChildren(...page.childNodes);
  if(focusKey){const t=section.querySelector(`[data-focus-key="${focusKey}"]`);if(t)t.focus();focusKey=null;}
 }
 render();
 return {get state(){return session.state;},dispose(){disposed=true;root.replaceChildren();}};
}
