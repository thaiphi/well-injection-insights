import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as sc from '../dist/sampleCase.js';
import {disposalContext} from '../web/disposal-context.mjs';
import {planningFixture} from '../dist/planningFixture.js';
import {freezeForecast,planningCase} from '../dist/planning.js';
import {INJECTORS} from '../dist/engineering.js';
import {buildExhibit} from '../dist/exhibit.js';

const app=new URL('../',import.meta.url),json=async p=>JSON.parse(await readFile(new URL(p,app)));
const sample=await json('data/sample-case/sample-case.json'),pin=await json('data/sample-case/pin.json');
async function demoEvidence(){const fixture=planningFixture(),frozen=freezeForecast(fixture.actuals);return buildExhibit({frozen,rows:planningCase(frozen,fixture.actuals,INJECTORS),injectors:INJECTORS,controls:{newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000},planningFixture:fixture});}
const sessionFor=demo=>({caseId:sample.caseId,sha256:pin.sha256,sample,injectors:sample.wells.map(sc.sampleInjector),producerFixtureSha256:demo.inputs.planningFixtureSha256});

test('M10: sample capacity evidence names every derived input and its assumption',async()=>{
 const c=disposalContext({source:'sample',demo:await demoEvidence(),sample:sessionFor(await demoEvidence())});
 assert.equal(c.ready,true,c.reasons.join(' '));
 const listed=c.demand.evidence.derivedInputs;
 const expected=sample.wells.flatMap(w=>w.inputs.filter(i=>i.class==='derived-with-assumption').map(i=>({well:w.label,key:i.key,input:i.label,value:i.value,unit:i.unit,assumption:i.assumption,derivedFrom:i.derivedFrom??[]})));
 assert.ok(expected.length>=2,'sample has derived inputs');
 assert.deepEqual(listed,expected);
 const surface=listed.filter(i=>i.key==='surfaceLimitPsia');
 assert.equal(surface.length,sample.wells.length);
 for(const s of surface)assert.match(s.assumption,/surface gauge|permit/i);
 assert.match(c.demand.evidence.derivedInputsNote,/as loaded/i);
});
test('M10: a session without the sample document states the gap instead of omitting it',async()=>{
 const demo=await demoEvidence(),{sample:_,...bare}=sessionFor(demo);
 const c=disposalContext({source:'sample',demo,sample:bare});
 assert.equal(c.ready,true,c.reasons.join(' '));
 assert.equal(c.demand.evidence.derivedInputs,null);
});
