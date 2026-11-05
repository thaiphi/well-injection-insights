import test from 'node:test';import assert from 'node:assert/strict';
import {reconcile} from '../dist/pressureReconciliation.js';
import {reconciliationSvg} from '../dist/pressureReconciliationChart.js';
import {sealReconciliation,verifyReconciliationSealed,reconciliationJson,reconciliationCsv,reconciliationSvgExport} from '../dist/pressureReconciliationExport.js';
import {createEstimateState,confirmBasis,setSurfaceBasis,estimate} from '../dist/injectivityEstimate.js';
import {DEFAULT_WELL_ASSUMPTIONS} from '../dist/wellAssumptions.js';
import {fixtureInputs,monthlyRow,bhpRow} from './helpers/injectivity-fixture.mjs';

const WELL={...DEFAULT_WELL_ASSUMPTIONS,surfaceBasis:{value:'psig',reason:'RRC H-10 reports gauge pressure'}};
const banned=new RegExp('calib'+'rated','i');
const recFor=(inputs=fixtureInputs(),extra={})=>reconcile({h10:inputs.h10,tests:inputs.tests,well:WELL,j:estimate(confirmBasis(setSurfaceBasis(createEstimateState(inputs),WELL.surfaceBasis),'psig','RRC')),
 permit:{surfacePsi:1176,topDepthFt:3000},declaredLimit:null,...extra});
const source={uic:'000000417',artifactId:'synthetic',normalizedSha256:null,manifestSha256:null,h10Decisions:{},tests:{packageFiles:{},uploads:[],inclusions:{}},jMatches:{}};

test('sealed export verifies and records method, screening text, assumptions, formulas and limitations',async()=>{
 const s=await sealReconciliation(recFor(),source);
 assert.equal(s.schemaVersion,'pressure-reconciliation-export/1');assert.equal(s.method,'pressure-reconciliation/1');assert.equal(s.label,'WHP/BHP reconciliation (screening)');
 assert.equal(s.screening,'Screening only: not a regulatory approval, compliance finding or safe-operating determination.');assert.deepEqual(s.surfaceBasis,WELL.surfaceBasis);
 assert.ok(s.formulas.length>=5);assert.ok(s.limitations.length>=8);assert.equal(s.units.pressure,'psia unless named psi (as reported, on the confirmed basis)');
 assert.equal(await verifyReconciliationSealed(JSON.parse(reconciliationJson(s))),true);
});
test('tampering is detected',async()=>{
 const s=JSON.parse(reconciliationJson(await sealReconciliation(recFor(),source)));s.rows[1].regulatory.marginPsi=9999;assert.equal(await verifyReconciliationSealed(s),false);
});
test('CSV escapes formula-like text, marks missing values "unavailable" and carries the screening text',async()=>{
 const csv=reconciliationCsv(await sealReconciliation(recFor(),{...source,artifactId:'=HYPERLINK("x")'}));
 assert.match(csv,/"'=HYPERLINK\(""x""\)"/);assert.match(csv,/"unavailable"/);assert.match(csv,/Screening only: not a regulatory approval/);assert.ok(csv.endsWith('\r\n'));
});
test('no produced text uses the banned word',async()=>{
 const rec=recFor(),s=await sealReconciliation(rec,source);
 assert.doesNotMatch(reconciliationJson(s),banned);assert.doesNotMatch(reconciliationCsv(s),banned);assert.doesNotMatch(reconciliationSvgExport(s,rec),banned);
});
test('chart: title, one diamond per test with a measured-static label, a break at a gap, negative bars marked',()=>{
 const c=reconciliationSvg(recFor());assert.match(c.svg,/WHP\/BHP reconciliation \(screening\) by month/);
 assert.equal((c.svg.match(/data-series="test"/g)??[]).length,2);assert.match(c.svg,/measured static/);
 assert.match(c.svg,/Pressure basis: H-10 and permit pressures read as psig \(RRC H-10 reports gauge pressure\); BHP tests read as psig\./);
 const gap=fixtureInputs({monthly:[monthlyRow('2024-01',10000,900),monthlyRow('2024-02',10000,900),monthlyRow('2024-04',10000,900),monthlyRow('2024-05',10000,900)]});
 const d=reconciliationSvg(recFor(gap)).svg.match(/data-series="modelled" d="([^"]+)"/)[1];assert.equal((d.match(/M/g)??[]).length,2,'the line breaks at the 2024-03 gap');
 const neg=reconciliationSvg(recFor(fixtureInputs(),{permit:{surfacePsi:900,topDepthFt:null}})).svg;assert.ok((neg.match(/data-negative="true"/g)??[]).length>=1);
 const empty=reconciliationSvg(reconcile({h10:null,tests:fixtureInputs().tests,well:WELL,j:null,permit:{surfacePsi:null,topDepthFt:null},declaredLimit:null}));assert.match(empty.svg,/No months to chart/);assert.match(empty.svg,/BHP tests read as not confirmed/);
});
test('export SVG embeds the sealed JSON as metadata around the chart',async()=>{
 const rec=recFor(),s=await sealReconciliation(rec,source),svg=reconciliationSvgExport(s,rec);
 assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.match(svg,/<metadata>/);assert.match(svg,new RegExp(s.contentSha256));
});
test('sealing is refused before the surface basis is confirmed',async()=>{
 const inputs=fixtureInputs();const rec=reconcile({h10:inputs.h10,tests:inputs.tests,well:DEFAULT_WELL_ASSUMPTIONS,j:null,permit:{surfacePsi:1176,topDepthFt:null},declaredLimit:null});
 await assert.rejects(sealReconciliation(rec,source),/Confirm the H-10 and permit pressure basis/);
});
