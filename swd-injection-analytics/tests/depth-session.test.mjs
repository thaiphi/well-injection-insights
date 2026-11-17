import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDisposalCase} from '../dist/disposalCase.js';
import {BANNED} from '../dist/caseSummary.js';
import {FICTIONAL_DEPTH_PROFILE_CSV} from '../dist/depthProfile.js';
import {REVIEW_AID,EXAMPLE_LABEL,EXAMPLE_ONLY_DEMO,DROPPED,GAP_SHUT_IN} from '../dist/depthContext.js';
import {verifyDepth,verifyDepthSvg} from '../dist/depthContextExport.js';
const panel=await import('../web/depth-context.mjs').catch(e=>({loadError:e}));
const {createDepthSession,reviewLists,PANEL_TITLE,NO_CASE,NOT_IN_CASE}=panel;

// Fictional data only (FICTIONAL-INJ-A/B).
const A='FICTIONAL-INJ-A',B='FICTIONAL-INJ-B';
const WELL={id:A,reservoirPsia:2000,limitPsia:3500,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3300,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const caseInput=(wells,over={})=>({caseName:'Fictional depth case',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-02',demandBbl:300000},{month:'2028-03',demandBbl:0}],evidence:{fixture:'seed-417/v1'}},wells,fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:wells[0].id,injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8},...over});
const two=[WELL,{...WELL,id:B,injectivityStbdPerPsi:2.5}];
const CASE=buildDisposalCase(caseInput(two));
const CASE_A_ONLY=buildDisposalCase(caseInput([WELL]));
const SHA='a'.repeat(64);
const make=(source='demo')=>{let src=source;const s=createDepthSession({getSource:()=>src});s.setSource=v=>{src=v;};return s;};
const ready=(source='demo')=>{const s=make(source);s.onCaseResult(CASE,SHA);return s;};
const drawn=()=>{const s=ready();s.loadExample();s.select({wellIds:[A,B],basis:'TVD'});s.draw();return s;};

test('module loads with the panel copy',()=>{
  assert.equal(panel.loadError,undefined,String(panel.loadError));
  assert.equal(PANEL_TITLE,'Depth view (review aid)');
  assert.equal(typeof NO_CASE,'string');
});

test('no case result: the session is not ready and nothing loads or draws',async()=>{
  const s=make();const snap=s.snapshot();
  assert.equal(snap.ready,false);assert.equal(snap.profile,null);assert.equal(snap.context,null);assert.deepEqual(snap.caseWellIds,[]);
  s.loadExample();assert.equal(s.snapshot().profile,null);
  s.loadProfileText(FICTIONAL_DEPTH_PROFILE_CSV);assert.equal(s.snapshot().profile,null);
  s.draw();assert.equal(s.snapshot().context,null);
  await assert.rejects(()=>s.exportDepth('json'),/Draw the depth view first/);
});

test('case result sets the wells, months and defaults (Base, first month, no wells, no basis)',()=>{
  const s=ready();const snap=s.snapshot();
  assert.equal(snap.ready,true);assert.deepEqual(snap.caseWellIds,[A,B]);assert.deepEqual(snap.months,['2028-02','2028-03']);
  assert.deepEqual(snap.selection.wellIds,[]);assert.equal(snap.selection.basis,undefined);
  assert.equal(snap.selection.scenario,'base');assert.equal(snap.selection.month,'2028-02');
});

test('loadExample: refused on a user source with EXAMPLE_ONLY_DEMO, loads the 2 wells on the demo source',()=>{
  for(const src of ['user','sample','public']){const x=ready(src);x.loadExample();assert.equal(x.snapshot().profile,null);assert.equal(x.snapshot().message,EXAMPLE_ONLY_DEMO);}
  const d=ready('demo');d.loadExample();
  const snap=d.snapshot();assert.equal(snap.message,null);
  assert.deepEqual([...new Set(snap.profile.rows.map(r=>r.wellId))].sort(),[A,B]);assert.deepEqual(snap.dropped,[]);
  assert.equal(EXAMPLE_LABEL,'fictional example — not typical values');
});

test('a user may upload a profile; a refused upload lists row-numbered problems and loads nothing',()=>{
  const s=ready('user');s.loadProfileText(FICTIONAL_DEPTH_PROFILE_CSV);
  assert.ok(s.snapshot().profile);assert.deepEqual(s.snapshot().problems,[]);
  s.loadProfileText(FICTIONAL_DEPTH_PROFILE_CSV.replace('1000,1000','1000,1000x'));
  const snap=s.snapshot();assert.equal(snap.profile,null);assert.ok(snap.problems.length>0);assert.ok(snap.problems.some(p=>Number.isInteger(p.row)));
  s.loadProfileText(FICTIONAL_DEPTH_PROFILE_CSV);assert.deepEqual(s.snapshot().problems,[]);
  s.clearProfile();assert.equal(s.snapshot().profile,null);assert.deepEqual(s.snapshot().dropped,[]);
});

test('draw is refused without a profile, a well, or a basis; nothing is drawn',()=>{
  const s=ready();
  s.select({wellIds:[A],basis:'MD'});s.draw();assert.equal(s.snapshot().context,null);assert.match(s.snapshot().message,/profile/i);
  s.loadExample();s.select({wellIds:[]});s.draw();assert.equal(s.snapshot().context,null);assert.match(s.snapshot().message,/1 to 4 wells/);
  const t=ready();t.loadExample();t.select({wellIds:[A]});t.draw();
  assert.equal(t.snapshot().context,null);assert.match(t.snapshot().message,/MD or TVD/);
  assert.equal(t.snapshot().selection.basis,undefined);
});

test('a 5th well is refused with a message and the selection is unchanged',()=>{
  const wells=['W1','W2','W3','W4','W5'].map(id=>({...WELL,id}));
  const s=make();s.onCaseResult(buildDisposalCase(caseInput(wells)),null);s.loadProfileText(FICTIONAL_DEPTH_PROFILE_CSV);
  s.select({wellIds:['W1','W2','W3','W4']});assert.deepEqual(s.snapshot().selection.wellIds,['W1','W2','W3','W4']);
  s.select({wellIds:['W1','W2','W3','W4','W5']});
  assert.deepEqual(s.snapshot().selection.wellIds,['W1','W2','W3','W4']);assert.match(s.snapshot().message,/at most 4/i);
  s.select({wellIds:['W1','W1']});assert.deepEqual(s.snapshot().selection.wellIds,['W1','W2','W3','W4']);
  s.select({wellIds:['NOT-A-CASE-WELL']});assert.deepEqual(s.snapshot().selection.wellIds,['W1','W2','W3','W4']);
});

test('select validates basis, scenario, month and the reference inputs',()=>{
  const s=ready();
  s.select({basis:'XYZ'});assert.equal(s.snapshot().selection.basis,undefined);
  s.select({scenario:'both'});assert.equal(s.snapshot().selection.scenario,'base');
  s.select({month:'1999-01'});assert.equal(s.snapshot().selection.month,'2028-02');
  s.select({referenceDepthFt:Number.NaN});assert.equal(s.snapshot().selection.referenceDepthFt,null);
  s.select({basis:'MD',scenario:'compared',month:'2028-03',referenceDepthFt:3000,referencePressurePsia:2500});
  assert.deepEqual(s.snapshot().selection,{wellIds:[],basis:'MD',scenario:'compared',month:'2028-03',referenceDepthFt:3000,referencePressurePsia:2500});
  assert.equal(s.snapshot().message,null);
});

test('draw builds the context for the chosen wells; every select withdraws it',()=>{
  const s=drawn();const ctx=s.snapshot().context;
  assert.ok(ctx);assert.deepEqual(ctx.tracks.map(t=>t.wellId),[A,B]);assert.equal(ctx.selection.basis,'TVD');assert.equal(ctx.reviewAid,REVIEW_AID);
  assert.equal(s.snapshot().sources.length,2);
  for(const change of [{wellIds:[A]},{basis:'MD'},{scenario:'compared'},{month:'2028-03'},{referenceDepthFt:3000},{referencePressurePsia:2000}]){
    s.select({wellIds:[A,B],basis:'TVD',scenario:'base',month:'2028-02',referenceDepthFt:null,referencePressurePsia:null});s.draw();
    assert.ok(s.snapshot().context,'redrawn');
    s.select(change);assert.equal(s.snapshot().context,null,JSON.stringify(change));
  }
});

test('each select change cancels an in-flight export',async()=>{
  for(const change of [{wellIds:[A]},{basis:'MD'},{scenario:'compared'},{month:'2028-03'},{referenceDepthFt:3000}]){
    const s=drawn();const p=s.exportDepth('json');s.select(change);
    assert.deepEqual(await p,{cancelled:true},JSON.stringify(change));
  }
});

test('case result, invalidation, profile change and source switch cancel an in-flight export',async()=>{
  let s=drawn();let p=s.exportDepth('csv');s.onCaseResult(CASE,SHA);assert.deepEqual(await p,{cancelled:true});assert.equal(s.snapshot().context,null);
  s=drawn();p=s.exportDepth('svg');s.onInvalidated();assert.deepEqual(await p,{cancelled:true});assert.equal(s.snapshot().ready,false);assert.equal(s.snapshot().context,null);
  s=drawn();p=s.exportDepth('json');s.loadExample();assert.deepEqual(await p,{cancelled:true});
  s=drawn();p=s.exportDepth('json');s.clearProfile();assert.deepEqual(await p,{cancelled:true});
  s=drawn();p=s.exportDepth('json');s.onSourceSwitch();assert.deepEqual(await p,{cancelled:true});
});

test('Review Focus 3: a case without well B lists only B rows as dropped, keeps A rows and A ticked',()=>{
  const s=drawn();
  const bRows=s.snapshot().profile.rows.filter(r=>r.wellId===B).map(r=>r.row),aRows=s.snapshot().profile.rows.filter(r=>r.wellId===A).map(r=>r.row);
  assert.ok(bRows.length>0&&aRows.length>0);
  s.onCaseResult(CASE_A_ONLY,null);
  const snap=s.snapshot();
  assert.deepEqual(snap.dropped.map(d=>d.row),bRows);assert.ok(snap.dropped.every(d=>d.wellId===B));
  assert.deepEqual(snap.profile.rows.map(r=>r.row),aRows);
  assert.deepEqual(snap.selection.wellIds,[A]);assert.equal(snap.selection.basis,'TVD');assert.equal(snap.context,null);
  assert.deepEqual(snap.caseWellIds,[A]);
  // Dropped rows accumulate across recalculations; clearing the profile clears them.
  s.onCaseResult(CASE_A_ONLY,null);assert.equal(s.snapshot().dropped.length,bRows.length);
  s.clearProfile();assert.deepEqual(s.snapshot().dropped,[]);
  assert.equal(DROPPED,'dropped: well no longer in the case');
});

test('a recalculation that keeps every well keeps the profile, the ticks and the month',()=>{
  const s=drawn();s.select({month:'2028-03'});s.onCaseResult(CASE,SHA);
  const snap=s.snapshot();assert.deepEqual(snap.dropped,[]);assert.deepEqual(snap.selection.wellIds,[A,B]);assert.equal(snap.selection.month,'2028-03');
  assert.equal(snap.context,null);assert.ok(snap.profile);
});

test('onInvalidated keeps the profile for the next result but hides the panel',()=>{
  const s=drawn();s.onInvalidated();
  const snap=s.snapshot();assert.equal(snap.ready,false);assert.ok(snap.profile);assert.deepEqual(snap.caseWellIds,[]);
  s.onCaseResult(CASE,null);assert.equal(s.snapshot().ready,true);assert.ok(s.snapshot().profile);
});

test('onSourceSwitch clears the profile, the dropped rows, the selection and the drawing',()=>{
  const s=drawn();s.onCaseResult(CASE_A_ONLY,null);s.select({basis:'MD'});
  s.onSourceSwitch();
  const snap=s.snapshot();assert.equal(snap.profile,null);assert.deepEqual(snap.dropped,[]);assert.deepEqual(snap.problems,[]);
  assert.deepEqual(snap.selection.wellIds,[]);assert.equal(snap.selection.basis,undefined);assert.equal(snap.context,null);
});

test('a source change noticed on the next case result clears the profile too',()=>{
  const s=ready('demo');s.loadExample();s.setSource('user');
  s.onCaseResult(CASE,null);assert.equal(s.snapshot().profile,null);
});

test('export round trip: JSON and CSV verify, SVG verifies, all carry the same digest and case reference',async()=>{
  const s=drawn();
  const json=await s.exportDepth('json'),csv=await s.exportDepth('csv'),svg=await s.exportDepth('svg');
  for(const o of [json,csv,svg])assert.equal(o.cancelled,undefined);
  assert.equal(json.mime,'application/json');assert.equal(csv.mime,'text/csv;charset=utf-8');assert.equal(svg.mime,'image/svg+xml');
  const sealed=JSON.parse(json.text);
  assert.equal(sealed.schemaVersion,'depth-context-export/1');
  assert.equal(sealed.caseRef.schemaVersion,CASE.schemaVersion);assert.equal(sealed.caseRef.methodVersion,CASE.methodVersion);assert.equal(sealed.caseRef.contentSha256,SHA);
  assert.deepEqual(sealed.selection.wellIds,[A,B]);assert.deepEqual(sealed.dropped,[]);assert.equal(sealed.sources.length,2);
  const hash=sealed.contentSha256;
  for(const [o,ext] of [[json,'json'],[csv,'csv'],[svg,'svg']])assert.equal(o.filename,`swd-depth-context-${hash.slice(0,12)}.${ext}`);
  assert.equal((await verifyDepth(structuredClone(sealed))).contentSha256,hash);
  assert.equal((await verifyDepthSvg(svg.text)).contentSha256,hash);
  assert.ok(csv.text.includes(hash));
  // Tampering is refused by the same verifiers the download uses.
  const bad=structuredClone(sealed);bad.profile.rows[3].raw.md_ft='999';
  await assert.rejects(()=>verifyDepth(bad),/Result changed or stale/);
  await assert.rejects(()=>verifyDepthSvg(svg.text.replace('<rect x="0" y="0"','<rect x="1" y="0"')),/Result changed or stale/);
});

test('export without a case digest stores null; the dropped rows travel with the export',async()=>{
  const s=drawn();s.onCaseResult(CASE_A_ONLY,null);s.select({basis:'TVD'});s.draw();
  const out=await s.exportDepth('json');const sealed=JSON.parse(out.text);
  assert.equal(sealed.caseRef.contentSha256,null);assert.ok(sealed.dropped.length>0);assert.deepEqual(sealed.selection.wellIds,[A]);
  await assert.rejects(()=>s.exportDepth('pdf'),/Unsupported/);
});

test('a shut-in well shows GAP_SHUT_IN, never a zero-pressure line',()=>{
  const wells=[{...WELL,availability:0},{...WELL,id:B}];
  const s=make();s.onCaseResult(buildDisposalCase(caseInput(wells)),null);s.loadExample();
  s.select({wellIds:[A],basis:'TVD'});s.draw();
  const c=s.snapshot().context.tracks[0].curve;
  assert.equal(c.status,'gap');assert.equal(c.reason,GAP_SHUT_IN);
});

test('generated copy has no banned word (REVIEW_AID negates "calibrated")',async()=>{
  const s=drawn();
  for(const t of [PANEL_TITLE,NO_CASE,EXAMPLE_LABEL,EXAMPLE_ONLY_DEMO,...panel.MESSAGES])assert.ok(!BANNED.test(t),`banned word in "${t}"`);
  const src=await readFile(new URL('../web/depth-context.mjs',import.meta.url),'utf8');
  for(const m of src.matchAll(/'([^'\\\n]{8,})'/g))assert.ok(!BANNED.test(m[1]),`banned word in literal "${m[1]}"`);
  assert.equal(s.snapshot().message,null);
});

test('after Draw, a recalculation without well B keeps B rows in the dropped list with DROPPED',()=>{
  const s=drawn();
  const bRows=s.snapshot().profile.rows.filter(r=>r.wellId===B).map(r=>r.row);
  s.onCaseResult(CASE_A_ONLY,null);s.select({basis:'TVD'});s.draw();
  const snap=s.snapshot();assert.ok(snap.context);assert.deepEqual(snap.context.tracks.map(t=>t.wellId),[A]);
  const lists=reviewLists(snap);
  assert.deepEqual(lists.dropped.map(d=>d.row),bRows);
  assert.ok(lists.dropped.every(d=>d.wellId===B&&d.reason===DROPPED));
  assert.deepEqual(lists.gaps.map(g=>g.wellId),[A]);
});

test('reviewLists: gaps carry row, kind and reason per shown well; the curve gap is listed too',()=>{
  const wells=[{...WELL,availability:0},{...WELL,id:B}];
  const s=make();s.onCaseResult(buildDisposalCase(caseInput(wells)),null);s.loadExample();
  s.select({wellIds:[A,B],basis:'MD'});s.draw();
  const lists=reviewLists(s.snapshot());
  const a=lists.gaps.find(g=>g.wellId===A);
  assert.ok(a.items.some(i=>i.row===null&&i.kind==='modelled curve'&&i.reason===GAP_SHUT_IN));
  const b=lists.gaps.find(g=>g.wellId===B);
  assert.ok(b.items.some(i=>Number.isInteger(i.row)&&i.kind&&i.reason));
  assert.deepEqual(reviewLists(ready().snapshot()),{gaps:[],dropped:[]});
});

test('a well that was never in the case is NOT_IN_CASE at upload; only DROPPED rows travel in the export',async()=>{
  assert.equal(NOT_IN_CASE,'not a well in this case');
  const s=make();s.onCaseResult(CASE_A_ONLY,null);s.loadExample();
  let snap=s.snapshot();
  assert.ok(snap.dropped.length>0);assert.ok(snap.dropped.every(d=>d.wellId===B&&d.reason===NOT_IN_CASE));
  assert.ok(snap.profile.rows.every(r=>r.wellId===A));
  s.select({wellIds:[A],basis:'TVD'});s.draw();
  const sealed=JSON.parse((await s.exportDepth('json')).text);
  assert.deepEqual(sealed.dropped,[]);
  // A later recalculation that removes a well the profile had still uses DROPPED.
  const t=drawn();t.onCaseResult(CASE_A_ONLY,null);
  assert.ok(t.snapshot().dropped.every(d=>d.reason===DROPPED));
});

test('CR byte counts: import-ui.mjs 4, index.html 3, redesign.css 0, new files 0',async()=>{
  const cr=async f=>{const b=await readFile(new URL(f,import.meta.url));let n=0;for(const x of b)if(x===13)n++;return n;};
  assert.equal(await cr('../web/import-ui.mjs'),4);
  assert.equal(await cr('../web/index.html'),3);
  assert.equal(await cr('../web/redesign.css'),0);
  assert.equal(await cr('../web/depth-context.mjs'),0);
  assert.equal(await cr('./depth-session.test.mjs'),0);
});

test('protected-file wiring: one import, one mount call, the sensitivity hide rule',async()=>{
  const ui=await readFile(new URL('../web/import-ui.mjs',import.meta.url),'utf8');
  assert.equal(ui.split("import {mountDepthContext} from './depth-context.mjs';").length-1,1);
  assert.equal(ui.split("mountDepthContext($('transient-buildup'),{getSource:()=>source});").length-1,1);
  const css=await readFile(new URL('../web/redesign.css',import.meta.url),'utf8');
  assert.ok(css.includes('main[data-view="sensitivity"] #depth-context'));
});

test('reference inputs above the limits are refused with a message and the old value stays',()=>{
  const s=drawn();
  s.select({referenceDepthFt:3000,referencePressurePsia:2500});
  s.select({referenceDepthFt:50001});
  assert.match(s.snapshot().message,/Reference depth must be at most 50000 ft/);
  assert.equal(s.snapshot().selection.referenceDepthFt,3000);
  s.select({referencePressurePsia:50001});
  assert.match(s.snapshot().message,/Reference pressure must be at most 50000 psia/);
  assert.equal(s.snapshot().selection.referencePressurePsia,2500);
  s.select({referenceDepthFt:50000,referencePressurePsia:50000});
  assert.equal(s.snapshot().message,null);assert.equal(s.snapshot().selection.referenceDepthFt,50000);
});

test('a bad entry in a reference input is refused visibly, not cleared (referenceValue + session)',()=>{
  assert.ok(Number.isNaN(panel.referenceValue('',true)));
  assert.equal(panel.referenceValue('  ',false),null);
  assert.equal(panel.referenceValue('3000.5',false),3000.5);
  const s=drawn();s.select({referenceDepthFt:3000});
  s.select({referenceDepthFt:panel.referenceValue('',true)});
  assert.match(s.snapshot().message,/must be numbers/);
  assert.equal(s.snapshot().selection.referenceDepthFt,3000);
  s.select({referencePressurePsia:Infinity});
  assert.match(s.snapshot().message,/must be numbers/);
});

test('a well removed by a recalculation and added back is no longer listed as dropped; its rows stay gone',()=>{
  const s=drawn();
  s.onCaseResult(CASE_A_ONLY,null);
  assert.ok(s.snapshot().dropped.length>0&&s.snapshot().dropped.every(d=>d.wellId===B));
  s.onCaseResult(CASE,null);
  const snap=s.snapshot();
  assert.deepEqual(snap.dropped,[]);
  assert.ok(snap.profile.rows.every(r=>r.wellId===A));
  assert.deepEqual(reviewLists(snap).dropped,[]);
  // The same for a well that was NOT_IN_CASE at upload and joins later.
  const t=make();t.onCaseResult(CASE_A_ONLY,null);t.loadExample();
  assert.ok(t.snapshot().dropped.every(d=>d.reason===NOT_IN_CASE)&&t.snapshot().dropped.length>0);
  t.onCaseResult(CASE,null);assert.deepEqual(t.snapshot().dropped,[]);
});

test('rows not placed carry the same evidence detail as placed rows (values, source, class label, basis, depth reference, reason)',()=>{
  const s=ready();s.loadExample();s.select({wellIds:[B],basis:'MD'});s.draw();
  const snap=s.snapshot();
  const gaps=reviewLists(snap).gaps.find(g=>g.wellId===B).items;
  const permit=gaps.find(g=>g.kind==='permitted-interval');
  assert.ok(permit,JSON.stringify(gaps));
  const f=Object.fromEntries(permit.facts);
  assert.equal(f['Content class'],'Public, as reported');
  assert.equal(f['Source reference'],'fictional example: permit record');
  assert.equal(f['Declared depth basis'],'TVD');
  assert.match(f['Depth reference'],/KB; wellhead 18.0 ft below it/);
  assert.equal(f['As entered: top_depth_ft'],'2900');assert.equal(f['As entered: bottom_depth_ft'],'3200');
  assert.equal(f['Not placed'],permit.reason);
  // The unknown-basis packer is listed with its value too.
  const pk=gaps.find(g=>g.kind==='packer');
  assert.equal(Object.fromEntries(pk.facts)['As entered: top_depth_ft'],'2850');
  assert.equal(Object.fromEntries(pk.facts)['Declared depth basis'],'unknown');
});

test('profileInputs lists the depth-reference row and survey stations of each shown well with source and class label',()=>{
  const s=ready();s.loadExample();s.select({wellIds:[A,B],basis:'MD'});s.draw();
  const inputs=panel.profileInputs(s.snapshot());
  assert.deepEqual(inputs.map(x=>x.wellId),[A,B]);
  const a=inputs[0].rows,b=inputs[1].rows;
  assert.deepEqual(a.map(r=>r.kind),['depth-reference','survey','survey','survey']);
  assert.deepEqual(b.map(r=>r.kind),['depth-reference']);
  assert.ok(a.every(r=>r.sourceRef.startsWith('fictional example')&&r.contentClass==='Assumed'));
  const st=Object.fromEntries(a[3].facts);
  assert.equal(st['As entered: md_ft'],'3318');assert.equal(st['As entered: tvd_ft'],'3018');assert.equal(st['Source reference'],'fictional example: survey station');
  assert.deepEqual(panel.profileInputs(ready().snapshot()),[]);
});

test('the panel sets textContent only and makes the drawing scroller keyboard-reachable',async()=>{
  const src=await readFile(new URL('../web/depth-context.mjs',import.meta.url),'utf8');
  assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(src));
  assert.ok(src.includes("w.tabIndex=0;w.setAttribute('role','region');w.setAttribute('aria-label'"));
  assert.ok(src.includes('Profile inputs'));
});
