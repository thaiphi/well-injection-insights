import {sampleInput} from '../dist/sampleCase.js';
import {annotateInput,markEdited} from './sample-case.mjs';

const aborted=signal=>signal?.reason instanceof Error&&signal.reason.name==='AbortError'?signal.reason:new DOMException('Sample loading cancelled.','AbortError');

/** Runs existing workspace actions in order; stops at the first failure and names it. */
export async function runSampleSteps(steps,{signal,onProgress=()=>{}}={}){
 const done=[];
 for(const [index,step] of steps.entries()){
  if(signal?.aborted)throw aborted(signal);
  onProgress({index,total:steps.length,label:step.label,status:'running'});
  try{await step.run({signal});}
  catch(error){
   if(error?.name==='AbortError'||signal?.aborted)throw aborted(signal);
   onProgress({index,total:steps.length,label:step.label,status:'failed'});
   const failure=new Error(`Step ${index+1} of ${steps.length} failed — ${step.label}: ${error.message}`);failure.step=step.label;failure.completed=done.slice();throw failure;
  }
  done.push(step.label);onProgress({index,total:steps.length,label:step.label,status:'done'});
 }
 return done;
}
export function waitFor(check,{signal,timeoutMs=20000,intervalMs=50,label='the expected result'}={}){
 return new Promise((resolve,reject)=>{const started=Date.now();const tick=()=>{if(signal?.aborted){reject(aborted(signal));return;}let value;try{value=check();}catch(error){reject(error);return;}if(value){resolve(value);return;}if(Date.now()-started>timeoutMs){reject(new Error(`Timed out waiting for ${label}`));return;}setTimeout(tick,intervalMs);};tick();});
}
export function waitForEvent(target,name,{signal,timeoutMs=60000,failWhen=()=>null}={}){
 return new Promise((resolve,reject)=>{let timer=null,poll=null;const finish=fn=>value=>{target.removeEventListener(name,onEvent);clearTimeout(timer);clearInterval(poll);fn(value);};const onEvent=finish(resolve);const fail=finish(reject);
  target.addEventListener(name,onEvent,{once:true});timer=setTimeout(()=>fail(new Error(`Timed out waiting for ${name}`)),timeoutMs);
  poll=setInterval(()=>{if(signal?.aborted)fail(aborted(signal));else{const message=failWhen();if(message)fail(new Error(message));}},50);});
}
/** Restores the demo producer controls to the page defaults so the sample's producers are reproducible. */
export function resetDemoControls(doc=document){
 const form=doc.getElementById('controls');
 for(const control of form.querySelectorAll('input,select')){if(control.tagName==='SELECT'){const d=[...control.options].find(o=>o.defaultSelected)??control.options[0];if(d)control.value=d.value;}else control.value=control.defaultValue;}
 form.querySelector('input,select')?.dispatchEvent(new Event('input',{bubbles:true}));
}
const touched=new Set();
function setValue(input,value){if(!input)throw new Error('A required sample field is missing from the page.');touched.add(input);input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
/** Leaving the sample: every field the sample filled returns to its page default and every sample label is removed,
 * so no sample value or provenance claim reaches another source's case. */
export function restoreSampleInputs(doc=document){
 for(const input of touched){if(!input.isConnected)continue;if(input.tagName==='SELECT'){const d=[...input.options].find(o=>o.defaultSelected)??input.options[0];if(d)input.value=d.value;}else input.value=input.defaultValue;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
 touched.clear();for(const note of doc.querySelectorAll('.sample-class'))note.remove();
}
const text=el=>el?.textContent.trim()??'';

export function sampleSteps({verify,select,navigate,session,doc=document}){
 const $=id=>doc.getElementById(id);
 const fill=(input,wellIndex,key)=>{const s=session(),meta=sampleInput(s.sample,wellIndex,key);setValue(input,meta.value);annotateInput(input,meta,doc);};
 return [
  {label:'Verify the sample and both TRRC records',run:verify},
  {label:'Select the sample as the planning source',run:select},
  {label:'Load and calculate the pressure-support example',run:async({signal})=>{
   navigate('pressureSupport');const root=$('pressure-support-workspace');
   const load=[...root.querySelectorAll('button')].find(b=>/synthetic example$|^Retry load$/.test(text(b)));
   if(!load)throw new Error('The pressure-support load button was not found.');
   if(!/^Reload/.test(text(load))){load.click();await waitFor(()=>{const e=[...root.querySelectorAll('.error')].map(text).find(Boolean);if(e)throw new Error(e);return /Verified pinned example loaded/.test(root.textContent);},{signal,label:'the pressure-support example to load'});}
   const form=root.querySelector('form');if(!form)throw new Error('The pressure-support form was not found.');form.requestSubmit();
   await waitFor(()=>$('pressure-support-json')&&!$('pressure-support-json').disabled,{signal,label:'the pressure-support result'});
  }},
  {label:'Calculate the capacity assessment',run:async({signal})=>{
   navigate('comparison');const s=session();
   await waitFor(()=>doc.querySelectorAll('#disposal-wells [data-well]').length>=s.injectors.length*5,{signal,label:'the sample wells in Capacity assessment'});
   setValue($('disposal-name'),'Sample case · UIC 000020838 + SAND BEND 2D');
   if($('disposal-model').value!=='segmented-brine')setValue($('disposal-model'),'segmented-brine');
   fill($('disposal-pressure'),'shared','referencePressurePsia');fill($('disposal-temperature'),'shared','temperatureF');fill($('disposal-salinity'),'shared','salinityWtPercent');
   if($('disposal-surface-temperature'))fill($('disposal-surface-temperature'),'shared','surfaceTemperatureF');
   const fields={tvdFt:'datumTvdFt',measuredDepthFt:'measuredDepthFt',innerDiameterInches:'innerDiameterInches',roughnessInches:'roughnessInches',surfaceLimitPsia:'surfaceLimitPsia'};
   s.injectors.forEach((_,i)=>{for(const [field,key] of Object.entries(fields))fill(doc.querySelector(`#disposal-wells [data-well="${i}"][data-field="${field}"]`),i,key);});
   // Re-select the target so the page's own resetComparison() copies the filled tubing ID and availability.
   setValue($('disposal-target'),s.injectors[0].id);
   $('disposal-illustrative').addEventListener('click',()=>markEdited($('disposal-wells'),'Illustrative default applied — not the sample value'),{once:true});
   const result=waitForEvent(doc,'disposal-case-result',{signal,failWhen:()=>text($('disposal-error'))});
   $('disposal-form').requestSubmit();await result;
  }},
  {label:'Run the default parameter sweep',run:async({signal})=>{
   navigate('sensitivity');await waitFor(()=>$('sensitivity-calculate')&&!$('sensitivity-calculate').disabled,{signal,label:'the parameter sweep to be ready'});
   $('sensitivity-form').requestSubmit();
   await waitFor(()=>{const e=text($('sensitivity-error'));if(e)throw new Error(e);return $('sensitivity-json')&&!$('sensitivity-json').disabled;},{signal,timeoutMs:120000,label:'the parameter sweep'});
  }},
  {label:'Calculate brine PVT',run:async()=>{
   navigate('pvt');setValue($('pvt-name'),'Sample case brine');fill($('pvt-temperature'),'shared','temperatureF');fill($('pvt-salinity'),'shared','salinityWtPercent');setValue($('pvt-min'),1000);setValue($('pvt-max'),4000);
   $('pvt-form').requestSubmit();const e=text($('pvt-error'));if(e)throw new Error(e);if(!$('pvt-status').classList.contains('calculated'))throw new Error(text($('pvt-status'))||'Brine PVT did not calculate.');
  }},
  {label:'Calculate hydraulics',run:async({signal})=>{
   navigate('hydraulics');const form=await waitFor(()=>$('hyd-form'),{signal,label:'the hydraulics form'});const at=name=>form.elements.namedItem(name);
   setValue(at('caseName'),'Sample case · UIC 000020838');setValue(at('datum'),session().injectors[0].datum);
   const map={reservoirPsia:'reservoirPsia',limitPsia:'limitPsia',surfaceLimitPsia:'surfaceLimitPsia',injectivityStbdPerPsi:'injectivityStbdPerPsi',operatingCeilingStbd:'operatingCeilingStbd',tvdFt:'datumTvdFt',measuredDepthFt:'measuredDepthFt',innerDiameterInches:'innerDiameterInches',roughnessInches:'roughnessInches',referencePressurePsia:'referencePressurePsia',temperatureF:'temperatureF',surfaceTemperatureF:'surfaceTemperatureF',salinityWtPercent:'salinityWtPercent'};
   for(const [name,key] of Object.entries(map))fill(at(name),0,key);
   $('hyd-reset').addEventListener('click',()=>markEdited(form,'Assumed default restored — not the sample value'),{once:true});
   form.requestSubmit();const e=text($('hyd-error'));if(e)throw new Error(e);
  }},
 ];
}
