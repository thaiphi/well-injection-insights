import test from 'node:test';import assert from 'node:assert/strict';
import {createEstimateState,confirmBasis,estimate} from '../dist/injectivityEstimate.js';
import {jEstimateSvg} from '../dist/injectivityEstimateChart.js';
import {sealEstimate,verifyEstimateSealed,estimateJson,estimateCsv,estimateSvg} from '../dist/injectivityEstimateExport.js';
import {fixtureInputs,bhpRow} from './helpers/injectivity-fixture.mjs';

const source={uic:'000000417',artifactId:'synthetic',normalizedSha256:null,manifestSha256:null,tests:{packageFiles:{},uploads:[]}};
const ready=()=>estimate(confirmBasis(createEstimateState(fixtureInputs()),'psig','RRC Permian guidance'));
const banned=new RegExp('calib'+'rated','i');

test('sealed export verifies, records method, basis, assumptions, units and limitations',async()=>{
 const s=await sealEstimate(ready(),source);
 assert.equal(s.schemaVersion,'test-referenced-j-export/1');assert.equal(s.method,'test-referenced-j/1');assert.equal(s.label,'Test-referenced J (estimate)');
 assert.equal(s.basis.value,'psig');assert.equal(s.assumptions.innerDiameterInches,3.958);assert.equal(s.units.j,'STB/day/psi');assert.ok(s.limitations.length>=8);
 assert.equal(await verifyEstimateSealed(JSON.parse(estimateJson(s))),true);
});
test('tampering is detected',async()=>{
 const s=JSON.parse(estimateJson(await sealEstimate(ready(),source)));s.tests[0].j=999;assert.equal(await verifyEstimateSealed(s),false);
});
test('a failed round trip refuses the export; a state with no J still exports its reasons',async()=>{
 await assert.rejects(sealEstimate({...ready(),roundTripOk:false},source),/Round trip failed: export refused\./);
 const none=estimate(confirmBasis(createEstimateState(fixtureInputs({avg:50})),'psig','x'));const s=await sealEstimate(none,source);
 assert.equal(s.chosenKey,null);assert.ok(s.tests.every(t=>t.reason));
});
test('CSV escapes formula-like text and marks missing values',async()=>{
 const csv=estimateCsv(await sealEstimate(ready(),{...source,artifactId:'=HYPERLINK("x")'}));
 assert.match(csv,/"'=HYPERLINK\(""x""\)"/);assert.match(csv,/"unavailable"/);assert.ok(csv.endsWith('\r\n'));
});
test('chart: estimate wording, one point per qualifying test, no banned wording',()=>{
 const c=jEstimateSvg(ready());assert.match(c.svg,/Test-referenced J \(estimate\)/);assert.equal((c.svg.match(/<circle /g)??[]).length,2);assert.doesNotMatch(c.svg,banned);
 const empty=jEstimateSvg(estimate(createEstimateState(fixtureInputs({bhp:[bhpRow(1,'2024-02-12',1705,3310)]}))));assert.match(empty.svg,/No Test-referenced J \(estimate\) to chart/);
});
test('export SVG embeds the sealed JSON as metadata around the chart',async()=>{
 const est=ready(),s=await sealEstimate(est,source),svg=estimateSvg(s,est);
 assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.match(svg,/<metadata>/);assert.match(svg,new RegExp(s.contentSha256));
});
test('final review I-1: the chart follows date order whatever the record order',()=>{
 const est=estimate(confirmBasis(createEstimateState(fixtureInputs({bhp:[bhpRow(1,'2024-07-22',1731,3310),bhpRow(2,'2024-02-12',1705,3310)]})),'psig','x'));
 const svg=jEstimateSvg(est).svg,cx=[...svg.matchAll(/<circle cx="([\d.]+)"/g)].map(m=>Number(m[1]));
 assert.equal(cx.length,2);assert.ok(cx.every(v=>v>=78&&v<=920),String(cx));
 const first=svg.indexOf('>2024-02-12</text>'),last=svg.indexOf('>2024-07-22</text>');assert.ok(first>0&&last>first,'axis labels run first date then last date');
});
