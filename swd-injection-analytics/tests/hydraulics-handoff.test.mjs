import test from 'node:test';import assert from 'node:assert/strict';
import {HYDRAULICS_DEFAULTS,calculateHydraulics,applyHandoff,markOverride,mountHydraulicsWorkspace} from '../web/hydraulics.mjs';

const h={values:{model:'segmented-brine',caseName:'Test-referenced J (estimate)',datum:'Top of completed interval at 3310 ft TVD (RRC guidance), from BHP test 2024-07-22',injectivityStbdPerPsi:15.05,reservoirPsia:1745.7,referencePressurePsia:1745.7,tvdFt:3310,measuredDepthFt:3310,
 innerDiameterInches:3.958,roughnessInches:0.0006,temperatureF:100,surfaceTemperatureF:70,salinityWtPercent:10,segments:32,rateStbd:10000,curveMaximumStbd:15000,surfaceLimitPsia:1190.7,operatingCeilingStbd:30000,limitPsia:null},
 origins:{injectivityStbdPerPsi:'Test-referenced J (estimate) from BHP test 2024-07-22 and H-10 2024-07; sealed estimate abcdefabcdef',limitPsia:'Not set from evidence; declare it.'},sweep:{min:14.9,max:15.1},notes:['J range for sweeps: 14.90 to 15.10 STB/day/psi (enter it in Parameter sweeps).']};

test('applyHandoff maps every value to a form string and leaves null fields empty',()=>{
 const r=applyHandoff(h);assert.equal(r.fields.limitPsia,'');assert.equal(r.fields.injectivityStbdPerPsi,'15.05');assert.equal(r.fields.model,'segmented-brine');assert.equal(r.fields.datum,h.values.datum);
 assert.deepEqual(r.origins,h.origins);assert.deepEqual(r.notes,h.notes);
 assert.throws(()=>applyHandoff({values:{notAField:1},origins:{},notes:[]}),/Unknown hand-off field: notAField/);
});
test('markOverride labels an edited prefilled field once',()=>{
 const o=markOverride(h.origins,'injectivityStbdPerPsi');assert.match(o.injectivityStbdPerPsi,/^User override \(was: Test-referenced J/);
 assert.equal(markOverride(o,'injectivityStbdPerPsi').injectivityStbdPerPsi,o.injectivityStbdPerPsi);assert.deepEqual(markOverride(h.origins,'tvdFt'),h.origins);
});
test('calculateHydraulics carries inputOrigins only when supplied; existing output unchanged otherwise',()=>{
 const base=calculateHydraulics({...HYDRAULICS_DEFAULTS,curvePoints:5});assert.equal('inputOrigins' in base.provenance,false);
 const withO=calculateHydraulics({...HYDRAULICS_DEFAULTS,curvePoints:5,inputOrigins:{injectivityStbdPerPsi:'x'}});assert.deepEqual(withO.provenance.inputOrigins,{injectivityStbdPerPsi:'x'});
 const {handoffNote:_,...refs}=withO.provenance.pressureReferences;// the clarification is the only other change when origins are present (final review M-6)
 assert.deepEqual({...withO,provenance:{...withO.provenance,inputOrigins:undefined,pressureReferences:refs}},{...base,provenance:{...base.provenance,inputOrigins:undefined}});
 assert.throws(()=>calculateHydraulics({...HYDRAULICS_DEFAULTS,inputOrigins:{bogus:'x'}}),/input origin/);
 assert.throws(()=>calculateHydraulics({...HYDRAULICS_DEFAULTS,inputOrigins:{tvdFt:'x'.repeat(401)}}),/input origin/);
});
test('a prefilled case with the bottomhole limit still empty cannot calculate until it is declared',()=>{
 const fields=applyHandoff(h).fields;const raw=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,['caseName','datum','model'].includes(k)?v:v===''?NaN:Number(v)]));
 assert.throws(()=>calculateHydraulics({...HYDRAULICS_DEFAULTS,...raw,curvePoints:5}),/Bottomhole pressure limit/);
 const r=calculateHydraulics({...HYDRAULICS_DEFAULTS,...raw,limitPsia:4000,curvePoints:5});assert.equal(r.inputs.tvdFt,3310);
});

test('markOverride labels a declared-from-empty field as declared, not overridden',()=>{
 const o=markOverride(h.origins,'limitPsia');assert.equal(o.limitPsia,'Declared by the user');
 assert.equal(markOverride(o,'limitPsia'),o);
});
test('markOverride keeps the labelled origin within the 400-character limit',()=>{
 const long={tvdFt:'y'.repeat(400)};const o=markOverride(long,'tvdFt');
 assert.ok(o.tvdFt.length<=400);assert.match(o.tvdFt,/^User override \(was: y+…\)$/);
 assert.doesNotThrow(()=>calculateHydraulics({...HYDRAULICS_DEFAULTS,inputOrigins:o}));
 const edge={tvdFt:'z'.repeat(379)};assert.equal(markOverride(edge,'tvdFt').tvdFt.length,400);
});

// Workspace behaviour through a minimal fake DOM (adapted from hydraulics-workspace.test.mjs, which stays unedited).
class Element extends EventTarget {
 constructor(tag=''){super();this.tag=tag;this.hidden=false;this.disabled=false;this.value='';this.dataset={};this.attributes={};this.children=[];this.classList={add(){}};this.textContent='';}
 setAttribute(key,value){this.attributes[key]=value;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];this.innerHTML='';}
 focus(){}
 remove(){this.removed=true;this.onRemove?.();}
}
function fakeWorkspace(){
 const created=[];const doc=new EventTarget();doc.createElement=tag=>{const e=new Element(tag);created.push(e);return e;};doc.createTextNode=text=>({textContent:text});
 doc.defaultView={location:{hash:''}};
 const root=new Element();root.ownerDocument=doc;
 const nodes=new Map(),exportButtons=['json','csv','svg'].map(kind=>{const b=new Element();b.dataset.hydExport=kind;b.disabled=true;return b;});
 const tabs=['hydraulics','profiles'].map(view=>{const b=new Element();b.dataset.hydTab=view;nodes.set('hyd-tab-'+view,b);return b;});
 root.querySelector=selector=>{const id=selector.slice(1);if(id==='hyd-origins')return nodes.get(id)??null;if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 root.querySelectorAll=selector=>selector==='[data-hyd-export]'?exportButtons:selector==='[data-hyd-tab]'?tabs:[];
 const form=root.querySelector('#hyd-form');form.elements={namedItem:name=>{const e=root.querySelector('#hyd-'+name);e.name=name;return e;}};
 form.prepend=box=>{nodes.set('hyd-origins',box);box.onRemove=()=>nodes.delete('hyd-origins');};
 for(const [key,value] of Object.entries(HYDRAULICS_DEFAULTS))form.elements.namedItem(key).value=String(value);
 root.querySelector('#hyd-profile-property').value='pressurePsia';
 return {root,doc,form,nodes,created};
}
function edit(f,key,value){const input=f.form.elements.namedItem(key);input.value=value;const ev=new Event('input');Object.defineProperty(ev,'target',{value:input});f.form.dispatchEvent(ev);}
const boxText=f=>{const box=f.nodes.get('hyd-origins');const out=[];const walk=n=>{if(n.textContent)out.push(n.textContent);for(const c of n.children??[])walk(c);};if(box)walk(box);return out;};
const submit=form=>form.dispatchEvent(new Event('submit',{cancelable:true}));

test('prefill sets every handed-off field, renders every origin line and the notes',()=>{
 const f=fakeWorkspace(),api=mountHydraulicsWorkspace(f.root);api.prefill(h);
 for(const [key,value] of Object.entries(h.values))assert.equal(f.form.elements.namedItem(key).value,value===null?'':String(value),key);
 assert.equal(f.form.elements.namedItem('limitPsia').value,'');
 const lines=boxText(f);
 for(const text of Object.values(h.origins))assert.ok(lines.some(l=>l.endsWith(': '+text)),text);
 assert.ok(lines.includes(h.notes[0]));
 assert.equal(api.getResult(),null);
});
test('editing a prefilled field labels the override and keeps the notes',()=>{
 const f=fakeWorkspace(),api=mountHydraulicsWorkspace(f.root);api.prefill(h);
 edit(f,'injectivityStbdPerPsi','20');
 assert.ok(boxText(f).some(l=>l.includes('User override (was: Test-referenced J')));
 assert.ok(boxText(f).includes(h.notes[0]));
 edit(f,'limitPsia','4000');assert.ok(boxText(f).some(l=>l.endsWith('Declared by the user')));
 assert.ok(boxText(f).includes(h.notes[0]));
 f.form.elements.namedItem('injectivityStbdPerPsi').value='15.05';
 submit(f.form);assert.ok(api.getResult().provenance.inputOrigins.injectivityStbdPerPsi.startsWith('User override'));
});
test('reset removes the origins box and the origins; later calculation has no inputOrigins',()=>{
 const f=fakeWorkspace(),api=mountHydraulicsWorkspace(f.root);api.prefill(h);
 f.form.elements.namedItem('limitPsia').value='4000';submit(f.form);assert.ok('inputOrigins' in api.getResult().provenance);
 f.root.querySelector('#hyd-reset').dispatchEvent(new Event('click'));
 assert.equal(f.nodes.has('hyd-origins'),false);
 submit(f.form);assert.equal('inputOrigins' in api.getResult().provenance,false);
 edit(f,'injectivityStbdPerPsi','20');assert.equal(f.nodes.has('hyd-origins'),false);
});
test('the origins box is written as text only',()=>{
 const f=fakeWorkspace(),api=mountHydraulicsWorkspace(f.root);
 api.prefill({...h,origins:{...h.origins,tvdFt:'<img src=x onerror=alert(1)>'},notes:['<b>note</b>']});
 assert.ok(boxText(f).some(l=>l.includes('<img src=x onerror=alert(1)>')));assert.ok(boxText(f).includes('<b>note</b>'));
 assert.ok(f.created.every(e=>['div','h3','ul','li','p'].includes(e.tag)));
 assert.ok(f.created.every(e=>!e.innerHTML));
});
test('final review M-6: the hand-off clarification appears only when input origins are present',()=>{
 const base=calculateHydraulics({...HYDRAULICS_DEFAULTS,curvePoints:5}),withO=calculateHydraulics({...HYDRAULICS_DEFAULTS,curvePoints:5,inputOrigins:{injectivityStbdPerPsi:'x'}});
 assert.equal('handoffNote' in base.provenance.pressureReferences,false);
 assert.equal(withO.provenance.pressureReferences.handoffNote,'Prefilled values were converted to psia by the J estimate as their origins state; this workspace itself applies no gauge conversion.');
 assert.equal(withO.provenance.pressureReferences.basis,base.provenance.pressureReferences.basis);
});
