import {TOUR_STEPS} from './tour-steps.mjs';

/** Bounded tour position; no stored visit state (session-only). */
export function createTourState(steps=TOUR_STEPS){
 let index=-1;
 const current=()=>index<0?null:{...steps[index],number:index+1,total:steps.length,first:index===0,last:index===steps.length-1};
 return {start(){index=0;return current();},next(){if(index>=0&&index<steps.length-1)index++;return current();},back(){if(index>0)index--;return current();},exit(){index=-1;return null;},current,get active(){return index>=0;}};
}
/** Non-modal step panel: never traps focus; Escape exits; exiting keeps the sample loaded. */
export function mountSampleTour({navigate,ensureSample,doc=document,steps=TOUR_STEPS}){
 const $=id=>doc.getElementById(id),panel=$('sample-tour'),state=createTourState(steps);let highlighted=null;
 const items=(id,list)=>$(id).replaceChildren(...list.map(t=>{const li=doc.createElement('li');li.textContent=t;return li;}));
 const clear=()=>{highlighted?.classList.remove('tour-highlight');highlighted=null;};
 function render(step){
  clear();
  if(!step){const hadFocus=panel.contains(doc.activeElement);panel.hidden=true;$('sample-tour-live').textContent='Tour closed. The sample stays loaded.';if(hadFocus)$('sample-tour-start')?.focus({preventScroll:true});return;}
  navigate(step.view);
  panel.hidden=false;$('sample-tour-count').textContent=`Step ${step.number} of ${step.total}`;$('sample-tour-heading').textContent=step.heading;
  $('sample-tour-body').replaceChildren(...step.body.map(t=>{const p=doc.createElement('p');p.textContent=t;return p;}));
  items('sample-tour-trrc',step.fromTrrc);items('sample-tour-gather',step.gather);
  $('sample-tour-back').disabled=step.first;$('sample-tour-next').textContent=step.last?'Finish':'Next';
  $('sample-tour-live').textContent=`Step ${step.number} of ${step.total}: ${step.heading}`;
  // After navigate()'s own heading focus (queued microtask), so the panel heading wins.
  setTimeout(()=>{const target=$(step.target);if(target&&target.getClientRects().length){target.classList.add('tour-highlight');highlighted=target;}$('sample-tour-heading').focus({preventScroll:true});},0);
 }
 $('sample-tour-next').onclick=()=>render(state.current()?.last?state.exit():state.next());
 $('sample-tour-back').onclick=()=>render(state.back());
 $('sample-tour-exit').onclick=()=>render(state.exit());
 doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.active){event.preventDefault();render(state.exit());}});
 return {async start(){await ensureSample();render(state.start());},exit(){if(state.active)render(state.exit());},get active(){return state.active;}};
}
