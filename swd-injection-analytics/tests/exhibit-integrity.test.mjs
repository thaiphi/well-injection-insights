import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildExhibit,exhibitCsv} from '../dist/exhibit.js';
import {exhibitSvg} from '../dist/exhibitSvg.js';
import {exhibitPdf} from '../web/exhibit-pdf.mjs';
import {INJECTORS} from '../dist/engineering.js';
import {syntheticActuals,freezeForecast,planningCase} from '../dist/planning.js';
import {planningFixture,planningDetails} from '../dist/planningFixture.js';
function input(fixtureBacked=false){const actuals=syntheticActuals(),frozen=freezeForecast(actuals),controls={newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000};return {frozen,controls,injectors:structuredClone(INJECTORS),rows:planningCase(frozen,actuals,INJECTORS),...(fixtureBacked?{planningFixture:planningFixture()}: {})};}
test('exhibit rejects controls that contradict the monthly calculation',async()=>{
 for(const change of [x=>x.controls.expansionStbd=1000,x=>x.controls.newWellStart='2026-08',x=>x.injectors[0].availability=0.5]){const x=input();change(x);await assert.rejects(buildExhibit(x),/contradict|match|inconsistent/i);}
});
test('exhibit rejects changed, missing, duplicate and reordered calculated rows',async()=>{
 for(const change of [x=>x.rows[0].forecastBbl+=100,x=>x.rows[0].variancePct=0,x=>x.rows[0].days=28,x=>x.rows.pop(),x=>x.rows[1]=x.rows[0],x=>x.rows.reverse()]){const x=input();change(x);await assert.rejects(buildExhibit(x),/contradict|match|calendar|monthly|inconsistent/i);}
});
test('raw fixture and frozen forecast must identify the same training calculation',async()=>{
 for(const change of [x=>x.planningFixture.cutoff='2025-11',x=>x.frozen={...x.frozen,id:'invented-forecast'},x=>x.frozen={...x.frozen,models:x.frozen.models.map((m,i)=>i?m:{...m,logRate:m.logRate+0.01})},x=>x.frozen={...x.frozen,trainingMonths:['2025-01']},x=>x.planningFixture.actuals[12].volumeBbl+=100]){const x=input(true);change(x);await assert.rejects(buildExhibit(x),/forecast|actual|contradict|match|inconsistent/i);}
});
test('known controls must agree with injector and schedule inputs',async()=>{
 for(const change of [x=>x.controls.availability=0.7,x=>x.controls.injectorAInjectivity=2.5,x=>x.controls.newWellRamp=2,x=>x.controls.newWellAvailability=0.5,x=>x.planningFixture.schedules[0].startMonth='2026-05']){const x=input(true);change(x);await assert.rejects(buildExhibit(x),/control|schedule|contradict|match|inconsistent/i);}
});
test('exhibit rejects non-JSON and non-finite evidence before hashing',async()=>{
 for(const value of [NaN,Infinity,-Infinity,()=>1,1n,new Date('2026-01-01')]){const x=input();x.controls.extra=value;await assert.rejects(buildExhibit(x));}
 const cycle=input();cycle.controls.extra=cycle.controls;await assert.rejects(buildExhibit(cycle));
 const publicInput=input();publicInput.publicArtifact={hidden:{numeric:NaN}};await assert.rejects(buildExhibit(publicInput));
 const sparse=input();sparse.controls.extra=Array(2);await assert.rejects(buildExhibit(sparse));
 const symbolic=input();symbolic.controls[Symbol('discarded evidence')]='hidden';await assert.rejects(buildExhibit(symbolic));
 const extended=input();extended.controls.extra=Array(1);extended.controls.extra.note='hidden';await assert.rejects(buildExhibit(extended));
 const hidden=input();Object.defineProperty(hidden.controls,'hidden',{value:'discarded evidence'});await assert.rejects(buildExhibit(hidden));
});
test('legacy monthly actuals remain explicit declared inputs without a false raw-history verification',async()=>{
 const x=input(),e=await buildExhibit(x);
 assert.deepEqual(e.inputs.declaredMonthlyActuals,x.rows.map(r=>({month:r.month,volumeBbl:r.actualBbl})));
 assert.match(e.inputs.forecastEvidence,/supplied|unverified/i);
 assert.doesNotMatch(e.provenance.producedWater,/seeded histories/i);
 assert.match(exhibitCsv(e),/calculated from declared inputs/);
 assert.match(exhibitSvg(e),/unverified against absent raw training history/);
 assert.doesNotMatch(exhibitSvg(e),/Synthetic actual|Frozen synthetic producer fit/);
});
test('valid ramp and downtime fixture rows agree with reconstructed exhibit',async()=>{
 const x=input(true);x.planningFixture.schedules[0].rampMonths=2;x.planningFixture.schedules[0].availabilityByMonth={'2026-05':0.5};x.controls.newWellRamp=2;
 const detail=planningDetails(x.planningFixture,x.frozen);
 x.rows=x.rows.map(row=>{const newDemandStbd=detail.producerMonths.filter(r=>r.month===row.month&&r.contribution==='assumed-schedule').reduce((sum,r)=>sum+r.rateStbd,0),demandStbd=row.forecastStbd+newDemandStbd,demandBbl=demandStbd*row.days;return {...row,newDemandStbd,demandStbd,demandBbl,headroomBbl:row.capacityBbl-demandBbl,shortfallBbl:Math.max(0,demandBbl-row.capacityBbl)};});
 const e=await buildExhibit(x);assert.deepEqual(e.outputs.monthly,x.rows);assert.deepEqual(e.outputs.planningDetails,detail);assert.match(e.inputs.forecastEvidence,/verified|refit/i);
 assert.equal(e.outputs.monthly[3].newDemandStbd,3000);
});
test('exhibit clones inputs before asynchronous hashing',async()=>{
 const x=input(true),pending=buildExhibit(x);x.controls.expansionStbd=0;x.rows[0].demandBbl=0;x.planningFixture.actuals[0].volumeBbl=0;
 const e=await pending;assert.equal(e.inputs.controls.expansionStbd,2000);assert.notEqual(e.outputs.monthly[0].demandBbl,0);assert.notEqual(e.inputs.planningFixture.actuals[0].volumeBbl,0);
 const {contentSha256,...body}=e;assert.equal(contentSha256,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
});
test('charts safely scale a representable maximum volume and reject an overflowing annual PDF summary',async()=>{
 const extreme=async rate=>{const x=input();x.frozen={...x.frozen,models:[{producerId:'P',logRate:Math.log(rate),monthlySlope:0}]};const actuals=x.rows.map(r=>({producerId:'P',month:r.month,rateStbd:Number.MAX_VALUE/r.days,volumeBbl:Number.MAX_VALUE,kind:'synthetic'}));x.rows=planningCase(x.frozen,actuals,x.injectors);return buildExhibit(x);};
 const e=await extreme(1e300);assert.doesNotMatch(exhibitSvg(e),/NaN|Infinity/);assert.ok((await exhibitPdf(e)).length>0);
 await assert.rejects(exhibitPdf(await extreme(1e306)),/annual.*finite|annual.*overflow/i);
});
test('historical artifacts without forecast verification metadata remain renderable and explicitly unverified',async()=>{
 for(const fixtureBacked of [false,true]){const e=await buildExhibit(input(fixtureBacked));delete e.inputs.forecastEvidence;const {contentSha256,...body}=e;e.contentSha256=createHash('sha256').update(JSON.stringify(body)).digest('hex');assert.match(exhibitSvg(e),/raw-history verification status was not recorded/);assert.ok((await exhibitPdf(e)).length>0);}
});
