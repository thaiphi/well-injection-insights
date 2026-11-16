import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const engineDir=process.env.DISPOSAL_ENGINE_DIR??'dist';
const load=f=>import(pathToFileURL(resolve(engineDir,f)));
const dc=await load('depthContext.js');
const dp=await load('depthProfile.js');
const disposal=await load('disposalCase.js');
const summary=await load('caseSummary.js');
const wa=await load('wellAssumptions.js');
const {parseDepthProfile,FICTIONAL_DEPTH_PROFILE_CSV,PROFILE_COLUMNS}=dp;
const {buildDepthContext,placeRow,curveSources,scenarioWell}=dc;

const A='FICTIONAL-INJ-A',B='FICTIONAL-INJ-B';
const well={id:A,reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3300,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const caseInput=(over={})=>({caseName:'Fictional depth context',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:300000},{month:'2028-03',demandBbl:0}],evidence:{fixture:'seed-417/v1'}},wells:[well,{...well,id:B,injectivityStbdPerPsi:2.5}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:A,injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8},...over});
const segmented={model:'segmented-brine',surfaceTemperatureF:80,segments:16};
const uniformCase=(over)=>disposal.buildDisposalCase(caseInput(over));
const segmentedCase=(over)=>disposal.buildDisposalCase(caseInput({hydraulics:segmented,...over}));
const profile=parseDepthProfile(FICTIONAL_DEPTH_PROFILE_CSV);
const sel=(over={})=>({wellIds:[A,B],basis:'TVD',scenario:'base',month:'2028-02',referenceDepthFt:null,referencePressurePsia:null,...over});
const ctx=(result,over={},prof=profile)=>{const s=sel(over);return buildDepthContext(prof,curveSources(result,s.scenario,s.month,s.wellIds),s);};
const track=(c,id)=>c.tracks.find(t=>t.wellId===id);
const item=(t,kind)=>t.items.filter(i=>i.row.kind===kind);
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const csv=(...rows)=>[PROFILE_COLUMNS.join(','),...rows.map(r=>PROFILE_COLUMNS.map(c=>r[c]??'').join(','))].join('\n')+'\n';
const base={well_id:A,source_ref:'fictional test',content_class:'assumed'};
const ref={...base,kind:'depth-reference',reference:'KB',wellhead_below_reference_ft:18};
const sv=(md,tvd)=>({...base,kind:'survey',md_ft:md,tvd_ft:tvd});
const rowOf=(text,kind)=>parseDepthProfile(text).rows.filter(r=>r.kind===kind);

test('constants carry the fixed copy verbatim',()=>{
  assert.equal(dc.DEPTH_CONTEXT_VERSION,'depth-context/1');
  assert.equal(dc.REVIEW_AID,'Review aid: user-supplied depth evidence beside modelled pressure. Not a calibrated correlation or a regulatory cross-section.');
  assert.equal(dc.GAP_NO_REFERENCE,'wellhead depth below the depth reference not declared');
  assert.equal(dc.gapNoSurvey('MD','TVD'),'no survey for this well; cannot convert MD to TVD');
  assert.equal(dc.gapNoSurvey('TVD','MD'),'no survey for this well; cannot convert TVD to MD');
  assert.equal(dc.GAP_OUTSIDE_SURVEY,'outside the survey range');
  assert.equal(dc.GAP_HORIZONTAL,'the survey is horizontal here; this TVD has more than one MD');
  assert.equal(dc.GAP_BASIS_UNKNOWN,'depth basis not stated');
  assert.equal(dc.GAP_PRESSURE_BASIS,'pressure basis not stated');
  assert.equal(dc.GAP_NO_TRAVERSE,'modelled traverse not available for this month');
  assert.equal(dc.GAP_NO_PRESSURE,'modelled pressure not available for this month');
  assert.equal(dc.GAP_SHUT_IN,'shut in this month; no modelled curve');
  assert.equal(dc.DROPPED,'dropped: well no longer in the case');
  assert.equal(dc.LIMIT_LABEL,'declared bottomhole maximum at the pressure datum (case input)');
  assert.equal(dc.CURVE_DEPTH_NOTE,"modelled depths follow the case's declared MD and TVD, not the survey");
  assert.equal(dc.UNIFORM_NOTE,'uniform brine model: a straight line from the required wellhead pressure to the bottomhole pressure at the declared pressure datum, exact for this model under the straight-slope assumption');
  assert.equal(dc.TEST_DATE_NOTE,'test dates differ from the modelled month; a test is evidence, not a check of the curve');
  assert.equal(dc.surveyNote(20.4),"survey TVD at the case's pressure datum differs from the case TVD by 20 ft; the curve is not moved");
  assert.equal(dc.EXAMPLE_LABEL,'fictional example — not typical values');
  assert.equal(dc.EXAMPLE_ONLY_DEMO,'The fictional example is only for the demo case.');
});

test('well A on TVD: MD casing converted with its stations, psig test point +14.7',()=>{
  const t=track(ctx(uniformCase()),A);
  const casing=item(t,'casing')[0].placement;
  assert.equal(casing.status,'placed');
  near(casing.bottomFt,1000+(1800/2318)*2018);
  assert.equal(casing.topFt,0);
  assert.equal(casing.conversion.from,'MD');
  assert.deepEqual(casing.conversion.stations,[{mdFt:1000,tvdFt:1000},{mdFt:3318,tvdFt:3018}]);
  assert.deepEqual(casing.conversion.topStations,[{mdFt:0,tvdFt:0},{mdFt:1000,tvdFt:1000}]);
  const packer=item(t,'packer')[0].placement;
  near(packer.topFt,1000+(1950/2318)*2018);
  const tps=item(t,'test-point');
  assert.equal(tps[0].placement.status,'placed');
  near(tps[0].placement.pressurePsia,1450+14.7);
  assert.equal(tps[1].placement.pressurePsia,1500);
  // Same basis rows are placed as entered, without a conversion.
  const sand=item(t,'formation-top')[0].placement;
  assert.deepEqual([sand.topFt,sand.bottomFt,sand.conversion],[3000,3100,null]);
  assert.deepEqual(item(t,'formation-top')[1].placement,{status:'placed',topFt:2400,bottomFt:null,conversion:null});
  assert.deepEqual(t.reference,{name:'KB',wellheadBelowReferenceFt:18});
  // Survey and depth-reference rows are inputs, not items.
  assert.ok(t.items.every(i=>i.row.kind!=='survey'&&i.row.kind!=='depth-reference'));
});

test('well B on TVD: no-survey MD gap, unknown basis, pressure basis gap, TVD interval placed',()=>{
  const t=track(ctx(uniformCase()),B);
  assert.deepEqual(item(t,'casing')[0].placement,{status:'gap',reason:dc.gapNoSurvey('MD','TVD')});
  assert.deepEqual(item(t,'packer')[0].placement,{status:'gap',reason:dc.GAP_BASIS_UNKNOWN});
  assert.deepEqual(item(t,'test-point')[0].placement,{status:'gap',reason:dc.GAP_PRESSURE_BASIS});
  assert.deepEqual(item(t,'permitted-interval')[0].placement,{status:'placed',topFt:2900,bottomFt:3200,conversion:null});
  const m=track(ctx(uniformCase(),{basis:'MD'}),B);
  assert.deepEqual(item(m,'permitted-interval')[0].placement,{status:'gap',reason:dc.gapNoSurvey('TVD','MD')});
  assert.deepEqual(item(m,'casing')[0].placement,{status:'placed',topFt:0,bottomFt:2600,conversion:null});
});

test('segmented curve: every traverse node, first node at the 18 ft offset',()=>{
  const r=segmentedCase();
  const src=curveSources(r,'base','2028-02',[A])[0];
  assert.ok(src.point.traverse.points.length>2);
  const c=track(ctx(r,{wellIds:[A]}),A).curve;
  assert.equal(c.status,'drawn');assert.equal(c.model,'segmented');
  assert.equal(c.nodes.length,src.point.traverse.points.length);
  assert.equal(c.nodes[0].depthFt,18);
  src.point.traverse.points.forEach((p,i)=>{
    near(c.nodes[i].tvdFt,p.tvdFt+18);near(c.nodes[i].mdFt,p.measuredDepthFt+18);near(c.nodes[i].depthFt,p.tvdFt+18);near(c.nodes[i].pressurePsia,p.pressurePsia);
  });
  const last=c.nodes.at(-1);near(last.depthFt,3018);near(last.mdFt,3318);
  const md=track(ctx(r,{wellIds:[A],basis:'MD'}),A).curve;
  near(md.nodes.at(-1).depthFt,3318);assert.equal(md.nodes.length,c.nodes.length);
  assert.deepEqual(c.notes,[dc.CURVE_DEPTH_NOTE]);
  assert.equal(c.flagged,false);assert.deepEqual(c.reasons,[]);
  assert.deepEqual(c.limitMarker,{depthFt:3018,pressurePsia:3500,label:dc.LIMIT_LABEL});
  near(md.limitMarker.depthFt,3318);
  near(c.rateStbd,src.onstreamStbd);
});

test('uniform curve: exactly two nodes and the uniform note',()=>{
  const r=uniformCase();
  const src=curveSources(r,'base','2028-02',[A])[0];
  const c=track(ctx(r,{wellIds:[A]}),A).curve;
  assert.equal(c.status,'drawn');assert.equal(c.model,'uniform');assert.equal(c.nodes.length,2);
  assert.deepEqual(c.nodes[0],{mdFt:18,tvdFt:18,depthFt:18,pressurePsia:src.point.requiredSurfacePsia});
  assert.deepEqual(c.nodes[1],{mdFt:3318,tvdFt:3018,depthFt:3018,pressurePsia:src.point.bottomholePsia});
  assert.deepEqual(c.notes,[dc.CURVE_DEPTH_NOTE,dc.UNIFORM_NOTE]);
  near(track(ctx(r,{wellIds:[A],basis:'MD'}),A).curve.nodes[1].depthFt,3318);
});

test('curve sources reproduce the case point, including the compared well',()=>{
  for(const r of [uniformCase(),segmentedCase()])for(const scenario of ['base','compared'])for(const s of curveSources(r,scenario,'2028-02',[A,B])){
    assert.deepEqual(disposal.caseHydraulicPoint({fluid:s.fluid,hydraulics:s.hydraulics??undefined},s.well,s.onstreamStbd),s.point);
    assert.deepEqual(s.well,scenarioWell(r,scenario,s.wellId));
  }
  const r=uniformCase();
  assert.deepEqual(scenarioWell(r,'base',A),r.inputs.wells[0]);
  const cw=scenarioWell(r,'compared',A);
  assert.equal(cw.injectivityStbdPerPsi,2.5);assert.equal(cw.availability,0.8);assert.equal(cw.innerDiameterInches,5);
  assert.deepEqual(scenarioWell(r,'compared',B),r.compared.wells[1].well);
  assert.deepEqual(cw,r.compared.wells[0].well);
  assert.throws(()=>scenarioWell(r,'compared','NOPE'));
  assert.equal(curveSources(segmentedCase(),'base','2028-02',[A])[0].hydraulics.model,'segmented-brine');
  assert.equal(curveSources(r,'base','2028-02',[A])[0].hydraulics,null);
});

test('a point that breaks a case limit is still drawn, flagged, with the case reason',()=>{
  const r=uniformCase({wells:[{...well,tvdFt:5000,measuredDepthFt:5500}],demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:29}],evidence:{fixture:'seed-417/v1'}}});
  const c=track(ctx(r,{wellIds:[A]}),A).curve;
  assert.equal(c.status,'drawn');assert.equal(c.flagged,true);
  assert.equal(c.reasons.length,1);assert.match(c.reasons[0],/below 100 psia/);
  assert.equal(c.nodes.length,2);
});

test('Review Focus 4: availability 0 on one scenario gives GAP_SHUT_IN there while the other is drawn',()=>{
  const r=uniformCase({comparison:{wellId:A,injectivityMultiplier:0.5,innerDiameterInches:5,availability:0}});
  const base=track(ctx(r,{scenario:'base'}),A).curve,cmp=track(ctx(r,{scenario:'compared'}),A).curve;
  assert.equal(base.status,'drawn');
  assert.deepEqual(cmp,{status:'gap',reason:dc.GAP_SHUT_IN});
  assert.equal(track(ctx(r,{scenario:'compared'}),B).curve.status,'drawn');
  // A month with no demand is also shut in, never a zero-pressure line.
  assert.deepEqual(track(ctx(uniformCase(),{month:'2028-03'}),A).curve,{status:'gap',reason:dc.GAP_SHUT_IN});
});

test('an unsupported point is a gap carrying the case reasons',()=>{
  const r=segmentedCase({wells:[{...well,tvdFt:5000,measuredDepthFt:5500}],demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:29}],evidence:{fixture:'seed-417/v1'}}});
  const src=curveSources(r,'base','2028-02',[A])[0];
  assert.equal(src.point.status,'unsupported');
  assert.deepEqual(track(ctx(r,{wellIds:[A]}),A).curve,{status:'gap',reason:src.point.reasons.join(' ')});
});

test('Review Focus 2: a TVD row on an MD display inside a flat survey stretch is GAP_HORIZONTAL',()=>{
  const text=csv(ref,sv(0,0),sv(1000,1000),sv(2000,1000),sv(3000,2000),
    {...base,kind:'formation-top',top_depth_ft:500,depth_basis:'TVD',label:'below',content_class:'literature'},
    {...base,kind:'formation-top',top_depth_ft:1000,depth_basis:'TVD',label:'flat edge',content_class:'literature'},
    {...base,kind:'formation-top',top_depth_ft:1500,depth_basis:'TVD',label:'after',content_class:'literature'},
    {...base,kind:'formation-top',top_depth_ft:1000,bottom_depth_ft:1500,depth_basis:'TVD',label:'band',bottom_source_ref:'fictional base',content_class:'literature'});
  const rows=parseDepthProfile(text).rows,wr=rows;
  const p=l=>placeRow(rows.find(r=>r.label===l),'MD',wr);
  assert.deepEqual(p('below'),{status:'placed',topFt:500,bottomFt:null,conversion:{from:'TVD',stations:[{mdFt:0,tvdFt:0},{mdFt:1000,tvdFt:1000}],topStations:[{mdFt:0,tvdFt:0},{mdFt:1000,tvdFt:1000}]}});
  assert.deepEqual(p('flat edge'),{status:'gap',reason:dc.GAP_HORIZONTAL});
  assert.deepEqual(p('band'),{status:'gap',reason:dc.GAP_HORIZONTAL});
  assert.deepEqual(p('after'),{status:'placed',topFt:2500,bottomFt:null,conversion:{from:'TVD',stations:[{mdFt:2000,tvdFt:1000},{mdFt:3000,tvdFt:2000}],topStations:[{mdFt:2000,tvdFt:1000},{mdFt:3000,tvdFt:2000}]}});
  // MD to TVD across the same flat stretch is unambiguous.
  const md=rowOf(csv(ref,sv(0,0),sv(1000,1000),sv(2000,1000),sv(3000,2000),{...base,kind:'packer',top_depth_ft:1500,depth_basis:'MD'}),'packer')[0];
  assert.deepEqual(placeRow(md,'TVD',parseDepthProfile(csv(ref,sv(0,0),sv(1000,1000),sv(2000,1000),sv(3000,2000),{...base,kind:'packer',top_depth_ft:1500,depth_basis:'MD'})).rows).topFt,1000);
});

test('an interval keeps the bracket of its top and of its bottom; an implicit casing top has none',()=>{
  const rows=parseDepthProfile(csv(ref,sv(0,0),sv(1000,1000),sv(3318,3018),
    {...base,kind:'perforated-interval',top_depth_ft:500,bottom_depth_ft:2000,depth_basis:'MD'},
    {...base,kind:'casing',bottom_depth_ft:2000,depth_basis:'MD'},
    {...base,kind:'packer',top_depth_ft:2000,depth_basis:'MD'})).rows;
  const lo=[{mdFt:0,tvdFt:0},{mdFt:1000,tvdFt:1000}],hi=[{mdFt:1000,tvdFt:1000},{mdFt:3318,tvdFt:3018}];
  const perf=placeRow(rows.find(r=>r.kind==='perforated-interval'),'TVD',rows);
  assert.deepEqual(perf.conversion,{from:'MD',stations:hi,topStations:lo});
  const casing=placeRow(rows.find(r=>r.kind==='casing'),'TVD',rows);
  assert.equal(casing.topFt,0);assert.deepEqual(casing.conversion,{from:'MD',stations:hi,topStations:null});
  const packer=placeRow(rows.find(r=>r.kind==='packer'),'TVD',rows);
  assert.deepEqual(packer.conversion,{from:'MD',stations:hi,topStations:hi});
  assert.deepEqual(placeRow(rows.find(r=>r.kind==='perforated-interval'),'MD',rows).conversion,null);
  const empty={...rows.find(r=>r.kind==='perforated-interval'),topFt:null,bottomFt:null,kind:'packer'};
  assert.throws(()=>placeRow(empty,'TVD',rows),/no depth/);
});

test('station depths and range ends are placed; 1e-6 ft beyond the end is outside',()=>{
  const mk=(v,b)=>{const rows=parseDepthProfile(csv(ref,sv(0,0),sv(1000,1000),sv(3318,3018),{...base,kind:'packer',top_depth_ft:v,depth_basis:b})).rows;return placeRow(rows.at(-1),b==='MD'?'TVD':'MD',rows);};
  assert.equal(mk('0','MD').topFt,0);assert.equal(mk('1000','MD').topFt,1000);assert.equal(mk('3318','MD').topFt,3018);
  assert.equal(mk('3318.000001','MD').reason,dc.GAP_OUTSIDE_SURVEY);
  assert.equal(mk('3018','TVD').topFt,3318);assert.equal(mk('0','TVD').topFt,0);assert.equal(mk('1000','TVD').topFt,1000);
  assert.equal(mk('3018.000001','TVD').reason,dc.GAP_OUTSIDE_SURVEY);
  assert.equal(mk('2','MD').status,'placed');
  // The station recorded for an interior station depth brackets it.
  const s=mk('1000','MD');assert.equal(s.conversion.stations.length,2);
});

test('removing a well depth-reference makes its items and curve GAP_NO_REFERENCE',()=>{
  const lines=FICTIONAL_DEPTH_PROFILE_CSV.split('\n').filter(l=>!(l.startsWith(B+',depth-reference')));
  assert.equal(lines.length,FICTIONAL_DEPTH_PROFILE_CSV.split('\n').length-1);
  const p=parseDepthProfile(lines.join('\n'));
  for(const basis of ['MD','TVD']){
    const c=ctx(uniformCase(),{basis},p),t=track(c,B);
    assert.equal(t.reference,null);assert.equal(t.surveyNote,null);
    assert.ok(t.items.length>0);
    for(const i of t.items)assert.deepEqual(i.placement,{status:'gap',reason:dc.GAP_NO_REFERENCE});
    assert.deepEqual(t.curve,{status:'gap',reason:dc.GAP_NO_REFERENCE});
    assert.equal(track(c,A).curve.status,'drawn');
  }
  // A well with no rows at all behaves the same.
  assert.deepEqual(track(ctx(uniformCase(),{},parseDepthProfile(csv(ref))),B).curve,{status:'gap',reason:dc.GAP_NO_REFERENCE});
});

test('the survey note appears only when the survey TVD at the case depth differs by more than 10 ft',()=>{
  assert.equal(track(ctx(uniformCase()),A).surveyNote,null);
  assert.equal(track(ctx(uniformCase()),B).surveyNote,null);
  const r=uniformCase({wells:[{...well,tvdFt:2980},{...well,id:B,tvdFt:2980}]});
  assert.equal(track(ctx(r),A).surveyNote,dc.surveyNote(20));
  assert.match(track(ctx(r),A).surveyNote,/by 20 ft/);
  assert.equal(track(ctx(r),B).surveyNote,null);
  const edge=uniformCase({wells:[{...well,tvdFt:2990}]});
  assert.equal(track(ctx(edge,{wellIds:[A]}),A).surveyNote,null);
  const over=uniformCase({wells:[{...well,tvdFt:2989}]});
  assert.equal(track(ctx(over,{wellIds:[A]}),A).surveyNote,dc.surveyNote(11));
  // The curve is not moved by the survey.
  near(track(ctx(r,{wellIds:[A]}),A).curve.nodes.at(-1).depthFt,2998);
  // A case MD beyond the survey gives no note.
  const deep=uniformCase({wells:[{...well,measuredDepthFt:3400,tvdFt:3100}]});
  assert.equal(track(ctx(deep,{wellIds:[A]}),A).surveyNote,null);
});

test('selection limits and tracks follow the selected order',()=>{
  const r=uniformCase();
  const wells=['a','b','c','d','e'].map(x=>({...well,id:'W-'+x}));
  const r5=uniformCase({wells,comparison:{wellId:'W-a',injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8}});
  assert.throws(()=>curveSources(r,'base','2029-01',[A]),/2029-01/);
  assert.throws(()=>ctx(r5,{wellIds:wells.map(w=>w.id)}));
  assert.equal(ctx(r5,{wellIds:wells.slice(0,4).map(w=>w.id)},profile).tracks.length,4);
  assert.throws(()=>buildDepthContext(profile,[],sel({wellIds:[]})));
  assert.throws(()=>buildDepthContext(profile,curveSources(r,'base','2028-02',[A]),sel({wellIds:[A,B]})),/FICTIONAL-INJ-B/);
  assert.throws(()=>ctx(r,{basis:'ft'}));assert.throws(()=>ctx(r,{scenario:'other'}));
  assert.throws(()=>ctx(r,{wellIds:[A,A]}));
  assert.deepEqual(ctx(r,{wellIds:[B,A]}).tracks.map(t=>t.wellId),[B,A]);
  assert.throws(()=>curveSources(r,'base','2028-02',['NOPE']));
});

test('the result carries version, selection, review aid and the axis maximum',()=>{
  const r=uniformCase(),c=ctx(r,{referenceDepthFt:3000,referencePressurePsia:2500});
  assert.equal(c.version,'depth-context/1');assert.equal(c.reviewAid,dc.REVIEW_AID);assert.equal(c.testDateNote,dc.TEST_DATE_NOTE);
  assert.deepEqual(c.selection,sel({referenceDepthFt:3000,referencePressurePsia:2500}));
  const all=[];
  for(const t of c.tracks){
    for(const i of t.items)if(i.placement.status==='placed')all.push(i.placement.topFt,i.placement.bottomFt??0);
    if(t.curve.status==='drawn')all.push(...t.curve.nodes.map(n=>n.depthFt));
  }
  near(c.axisMaxFt,Math.max(...all));
  assert.ok(c.axisMaxFt>=3018);
  // Nothing drawn or placed: the axis maximum is 0.
  const shut=uniformCase({comparison:{wellId:B,injectivityMultiplier:1,innerDiameterInches:5,availability:0}});
  assert.equal(ctx(shut,{wellIds:[B],scenario:'compared'},parseDepthProfile(csv({...ref,well_id:B}))).axisMaxFt,0);
  const same=ctx(r,{wellIds:[A,B]});assert.deepEqual(same,ctx(r,{wellIds:[A,B]}));
});

test('banned words appear in no generated string other than REVIEW_AID',()=>{
  const strings=[];
  const walk=v=>{if(typeof v==='string')strings.push(v);else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};
  const skipRows=c=>{for(const t of c.tracks){walk(t.curve);walk(t.surveyNote);t.items.forEach(i=>walk(i.placement));}walk(c.testDateNote);};
  for(const r of [uniformCase(),segmentedCase(),uniformCase({wells:[{...well,tvdFt:2980}],comparison:{wellId:A,injectivityMultiplier:0.5,innerDiameterInches:5,availability:0}})])
    for(const basis of ['MD','TVD'])for(const scenario of ['base','compared'])skipRows(ctx(r,{basis,scenario,wellIds:[A]}));
  const lowSurface=uniformCase({wells:[{...well,tvdFt:5000,measuredDepthFt:5500}],demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:29}],evidence:{fixture:'seed-417/v1'}}});
  skipRows(ctx(lowSurface,{wellIds:[A]}));
  for(const [k,v] of Object.entries(dc))if(k!=='REVIEW_AID'){if(typeof v==='string')strings.push(v);}
  strings.push(dc.gapNoSurvey('MD','TVD'),dc.gapNoSurvey('TVD','MD'),dc.surveyNote(20));
  assert.ok(strings.length>20);
  for(const s of strings)assert.ok(!summary.BANNED.test(s),`banned word in: ${s}`);
  assert.ok(summary.BANNED.test(dc.REVIEW_AID));
});

test('toAbsolute is the only pressure conversion used for test points',()=>{
  const rows=profile.rows.filter(r=>r.kind==='test-point'&&r.wellId===A);
  const t=track(ctx(uniformCase()),A).items.filter(i=>i.row.kind==='test-point');
  rows.forEach((r,i)=>assert.equal(t[i].placement.pressurePsia,wa.toAbsolute(r.pressurePsi,r.pressureBasis)));
});

test('module source and test file contain no CR bytes',async()=>{
  const fs=await import('node:fs');
  for(const f of ['src/depthContext.ts','tests/depth-context.test.mjs'])assert.ok(!fs.readFileSync(f).includes(13),f);
});
