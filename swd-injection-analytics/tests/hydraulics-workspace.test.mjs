import test from 'node:test';
import assert from 'node:assert/strict';
import {caseHydraulicPoint} from '../dist/disposalCase.js';
import {brineAtPressure} from '../dist/brinePvt.js';
import {parseCsv} from '../dist/importProfile.js';
import {HYDRAULICS_DEFAULTS,validateHydraulicsInputs,calculateHydraulics,hydraulicsCsv,hydraulicsSvg,pressureCurveSvg,depthProfileSvg,mountHydraulicsWorkspace} from '../web/hydraulics.mjs';

const inputs=overrides=>({...HYDRAULICS_DEFAULTS,curvePoints:5,...overrides});
const near=(actual,want,tolerance=1e-8)=>assert.ok(Math.abs(actual-want)<=tolerance*Math.max(1,Math.abs(want)),`${actual} != ${want}`);

test('standalone hydraulics requires no document, selected dataset, demand or forecast',()=>{
  assert.equal(mountHydraulicsWorkspace(),null);
  const result=calculateHydraulics(inputs());
  assert.equal(result.provenance.planningDatasetUsed,false);
  assert.equal(result.provenance.forecastUsed,false);
  assert.equal(result.inputs.demand,undefined);
  assert.equal(result.point.operatingFeasible,true);
  assert.match(result.provenance.inputs,/assumptions/);
  assert.equal(result.well.reservoirDatum,result.well.limitDatum);
  assert.equal(result.well.datum,result.inputs.datum);
  assert.match(result.provenance.pressureReferences.wellhead,/0 ft/);
});

test('both modes preserve exactly the backend point and pressure-grid results',()=>{
  for(const model of ['uniform-brine','segmented-brine']) {
    const result=calculateHydraulics(inputs({model}));
    assert.deepEqual(result.point,caseHydraulicPoint(result.backendInputs,result.well,result.inputs.rateStbd));
    assert.deepEqual(result.fluidProperties,brineAtPressure(2000,180,5));
    assert.equal(result.curve.length,5);
    for(const point of result.curve)assert.deepEqual(point,caseHydraulicPoint(result.backendInputs,result.well,point.rateStbd));
    near(result.point.bottomholePsia,3000);
    near(result.point.requiredSurfacePsia,result.point.bottomholePsia-result.point.hydrostaticPsi+result.point.frictionPsi);
  }
});

test('uniform MD changes friction without changing TVD gravity or constant-J BHP',()=>{
  const base=calculateHydraulics(inputs({model:'uniform-brine'}));
  const longer=calculateHydraulics(inputs({model:'uniform-brine',measuredDepthFt:6600}));
  near(longer.point.hydrostaticPsi,base.point.hydrostaticPsi);
  near(longer.point.frictionPsi,2*base.point.frictionPsi);
  near(longer.point.bottomholePsia,base.point.bottomholePsia);
  const reducedJ=calculateHydraulics(inputs({model:'uniform-brine',injectivityStbdPerPsi:2.5}));
  near(reducedJ.point.bottomholePsia,4000);
  assert.equal(reducedJ.point.operatingFeasible,false);
  assert.match(reducedJ.point.reasons.join(' '),/bottomhole maximum/);
});

test('segmented profiles retain endpoint pressure, local properties and solver diagnostics',()=>{
  const result=calculateHydraulics(inputs());
  const traverse=result.point.traverse;
  assert.ok(traverse);
  near(traverse.points[0].pressurePsia,result.point.requiredSurfacePsia);
  near(traverse.points.at(-1).pressurePsia,result.point.bottomholePsia);
  near(traverse.points.at(-1).measuredDepthFt,result.inputs.measuredDepthFt);
  near(traverse.points.at(-1).tvdFt,result.inputs.tvdFt);
  assert.equal(traverse.points[0].temperatureF,80);
  assert.equal(traverse.points.at(-1).temperatureF,180);
  assert.ok(traverse.convergenceResidualPsi<=0.001);
  assert.ok(traverse.maximumVelocityMPerSecond<5);
  for(const node of traverse.points) {
    near(node.massFlowKgPerSecond,node.densityKgPerM3*node.localFlowM3PerSecond);
    for(const key of ['bwRbPerStb','densityKgPerM3','viscosityCp','reynolds','darcyFrictionFactor']) assert.ok(Number.isFinite(node[key])&&node[key]>0,key);
  }
  assert.equal(calculateHydraulics(inputs({model:'uniform-brine'})).point.traverse,undefined);
});

test('zero rate retains the backend shut-in nulls rather than inventing a profile',()=>{
  for(const model of ['uniform-brine','segmented-brine']) {
    const result=calculateHydraulics(inputs({model,rateStbd:0}));
    assert.equal(result.point.status,'shut-in');
    assert.equal(result.point.bottomholePsia,null);
    assert.equal(result.point.requiredSurfacePsia,null);
    assert.equal(result.point.traverse,undefined);
  }
});

test('declared limits and unsupported traverse states survive without pressure clamping',()=>{
  const constrained=calculateHydraulics(inputs({surfaceLimitPsia:1000}));
  assert.equal(constrained.point.operatingFeasible,false);
  assert.ok(constrained.point.requiredSurfacePsia>1000);
  assert.match(constrained.point.reasons.join(' '),/surface maximum/);
  const unsupported=calculateHydraulics(inputs({innerDiameterInches:0.25,curvePoints:2}));
  assert.equal(unsupported.point.status,'unsupported');
  assert.equal(unsupported.point.requiredSurfacePsia,null);
  assert.equal(unsupported.point.traverse,undefined);
  assert.match(unsupported.point.reasons.join(' '),/5 m\/s/);
  assert.doesNotMatch(pressureCurveSvg(unsupported),/NaN|Infinity|undefined/);
});

test('input bounds reject blanks, nonfinite values, invalid geometry and mixed datum absence',()=>{
  for(const edit of [
    {rateStbd:''},{rateStbd:NaN},{rateStbd:Infinity},{injectivityStbdPerPsi:0},
    {tvdFt:4000,measuredDepthFt:3300},{roughnessInches:0.1,innerDiameterInches:0.25},
    {salinityWtPercent:20.1},{temperatureF:59},{referencePressurePsia:99},
    {surfaceLimitPsia:10001},{segments:8.5},{curvePoints:42},{curveMaximumStbd:0},
    {datum:' '},{caseName:''},{model:'new-physics'},
    {tvdFt:0,surfaceTemperatureF:80,temperatureF:180},
  ]) assert.throws(()=>validateHydraulicsInputs(inputs(edit)),undefined,JSON.stringify(edit));
  assert.doesNotThrow(()=>validateHydraulicsInputs(inputs({model:'uniform-brine',tvdFt:0})));
  assert.doesNotThrow(()=>validateHydraulicsInputs(inputs({model:'uniform-brine',segments:NaN,surfaceTemperatureF:''})));
});

test('technical exports retain exact inputs, units, provenance, local values and unsupported flags',()=>{
  const result=calculateHydraulics(inputs({caseName:'=Assumed, "case"',surfaceLimitPsia:1000}));
  const csv=hydraulicsCsv(result),parsed=parseCsv(csv);
  assert.ok(parsed.rows.length>100);
  assert.match(csv,/'=Assumed/);
  assert.match(csv,/source standard|stock-tank|STB\/day/);
  assert.match(csv,/depth-profile/);
  assert.match(csv,/massFlowKgPerSecond/);
  assert.match(csv,/convergenceResidualPsi/);
  assert.match(csv,/surface maximum/);
  assert.match(csv,/2325c6ae8879c49b8d7fac189d0011fe7656dec13758c199ffc2cc015aae8294/);
  const svg=hydraulicsSvg(result),metadata=svg.match(/<metadata>([\s\S]*?)<\/metadata>/)[1];
  const unescape=text=>text.replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
  assert.deepEqual(JSON.parse(unescape(metadata)),result);
  assert.match(svg,/Measured depth below wellhead/);
  assert.match(svg,/No field calibration/);
  assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
  assert.throws(()=>depthProfileSvg(result,'invented'),/Unsupported profile/);
});

// Minimal DOM harness exercises the real event handlers and lifecycle. Browser layout is a Main gate.
class Element extends EventTarget {
  constructor(){super();this.hidden=false;this.disabled=false;this.value='';this.dataset={};this.attributes={};this.children=[];this.classList={add(){}};}
  setAttribute(key,value){this.attributes[key]=value;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];this.innerHTML='';}
  focus(){this.focused=true;}
}
function fakeWorkspace(hash='') {
  const doc=new EventTarget();doc.createElement=()=>new Element();doc.createTextNode=text=>({textContent:text});
  doc.defaultView={location:{hash}};
  const root=new Element();root.ownerDocument=doc;
  const nodes=new Map(),exportButtons=['json','csv','svg'].map(kind=>{const button=new Element();button.dataset.hydExport=kind;button.disabled=true;return button;});
  const tabs=['hydraulics','profiles'].map(view=>{const button=new Element();button.dataset.hydTab=view;nodes.set('hyd-tab-'+view,button);return button;});
  root.querySelector=selector=>{const id=selector.slice(1);if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  root.querySelectorAll=selector=>selector==='[data-hyd-export]'?exportButtons:selector==='[data-hyd-tab]'?tabs:[];
  const form=root.querySelector('#hyd-form');form.elements={namedItem:name=>root.querySelector('#hyd-'+name)};
  for(const [key,value] of Object.entries(HYDRAULICS_DEFAULTS))form.elements.namedItem(key).value=String(value);
  root.querySelector('#hyd-profile-property').value='pressurePsia';
  return {root,doc,form,nodes,exportButtons};
}
function submit(form){form.dispatchEvent(new Event('submit',{cancelable:true}));}

test('direct route reload initializes the matching tab before any navigation event or calculation',()=>{
  for(const [hash,tab] of [['#fluid/profiles','profiles'],['#fluid/hydraulics','hydraulics'],['#fluid/pvt','hydraulics'],['','hydraulics']]) {
    const f=fakeWorkspace(hash),api=mountHydraulicsWorkspace(f.root),other=tab==='profiles'?'hydraulics':'profiles';
    assert.equal(f.nodes.get('hyd-tab-'+tab).attributes['aria-selected'],'true');
    assert.equal(f.nodes.get('hyd-tab-'+other).attributes['aria-selected'],'false');
    assert.equal(f.nodes.get('hyd-panel-'+tab).hidden,false);
    assert.equal(f.nodes.get('hyd-panel-'+other).hidden,true);
    assert.equal(api.getResult(),null);
    assert.ok(f.exportButtons.every(button=>button.disabled));
    submit(f.form);
    assert.ok(api.getResult());
    assert.equal(f.nodes.get('hyd-panel-'+tab).hidden,false);
    api.destroy();
  }
});

test('mount guards absence, avoids double mounting, switches tabs and clears stale results on input/change',()=>{
  const f=fakeWorkspace(),api=mountHydraulicsWorkspace(f.root);
  assert.equal(mountHydraulicsWorkspace(f.root),api);
  submit(f.form);assert.ok(api.getResult());assert.ok(f.exportButtons.every(button=>!button.disabled));
  const detached=api.getResult();detached.inputs.rateStbd=0;assert.equal(api.getResult().inputs.rateStbd,5000);
  const navigation=new Event('workspace-navigation');navigation.detail={view:'profiles'};f.doc.dispatchEvent(navigation);
  assert.equal(f.nodes.get('hyd-panel-profiles').hidden,false);
  assert.equal(f.nodes.get('hyd-panel-hydraulics').hidden,true);
  f.form.elements.namedItem('rateStbd').value='6000';f.form.dispatchEvent(new Event('input'));
  assert.equal(api.getResult(),null);assert.ok(f.exportButtons.every(button=>button.disabled));
  assert.equal(f.nodes.get('hyd-results').hidden,true);
  assert.equal(f.nodes.get('hyd-pressure-chart').children.length,0);
  submit(f.form);assert.equal(api.getResult().inputs.rateStbd,6000);
  f.form.elements.namedItem('model').value='uniform-brine';f.form.dispatchEvent(new Event('change'));
  assert.equal(api.getResult(),null);assert.equal(f.nodes.get('hyd-segmented-inputs').hidden,true);
  f.form.elements.namedItem('segments').value='';submit(f.form);assert.ok(api.getResult());
  assert.equal(api.getResult().inputs.segments,undefined);
  api.destroy();assert.equal(f.root.hydraulicsWorkspace,undefined);
});

test('blank edited inputs block calculation and leave all downloads disabled',()=>{
  const f=fakeWorkspace(),api=mountHydraulicsWorkspace(f.root);
  submit(f.form);assert.ok(api.getResult());
  f.form.elements.namedItem('reservoirPsia').value='';f.form.dispatchEvent(new Event('input'));submit(f.form);
  assert.equal(api.getResult(),null);
  assert.match(f.nodes.get('hyd-error').textContent,/reservoir pressure/);
  assert.ok(f.exportButtons.every(button=>button.disabled));
});
