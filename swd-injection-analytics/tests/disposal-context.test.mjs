import test from 'node:test';
import assert from 'node:assert/strict';
import {planningFixture,planningDetails} from '../dist/planningFixture.js';
import {freezeForecast,planningCase} from '../dist/planning.js';
import {INJECTORS} from '../dist/engineering.js';
import {buildExhibit} from '../dist/exhibit.js';
import {analyzeImports} from '../dist/importAnalysis.js';
import {parseCsv,createSource} from '../dist/importProfile.js';
import {validateImport} from '../dist/importValidation.js';
let api;try{api=await import('../web/disposal-context.mjs');}catch{}
test('connected context module is available',()=>assert.equal(typeof api?.disposalContext,'function'));
const skip=!api;
async function history(){const text='p,g,m,q\nOLD,G,2025-10,100\nOLD,G,2025-11,100\nOLD,G,2025-12,100';return validateImport(parseCsv(text),await createSource(new TextEncoder().encode(text),'history.csv',{origin:'user',assertedKind:'synthetic',reference:'fixture only'}),{profile:'history',version:'1',confirmed:true,columns:{producerId:'p',groupId:'g',month:'m',water:'q'},units:{water:'STB/day'},timeBasis:'calendar-day'});}
async function injector(){const text='id,j,p,l,b,c,d,e,q,a\nI,5,2000,3500,bottomhole-absolute,bottomhole-absolute,datum,datum,9000,0.9';return validateImport(parseCsv(text),await createSource(new TextEncoder().encode(text),'well.csv',{origin:'user',assertedKind:'assumed',reference:'fixture only'}),{profile:'injector',version:'1',confirmed:true,columns:{id:'id',injectivity:'j',reservoirPressure:'p',limitPressure:'l',reservoirBasis:'b',limitBasis:'c',reservoirDatum:'d',limitDatum:'e',operatingCeiling:'q',availability:'a'},units:{injectivity:'STB/day/psi',reservoirPressure:'psia',limitPressure:'psia',operatingCeiling:'STB/day',availability:'fraction'}});}
test('public injection histories and pending profiles cannot become producer demand',{skip},()=>{
 for(const source of [null,'public','user','demo']){const c=api.disposalContext({source});assert.equal(c.ready,false);assert.ok(c.reasons.length);assert.equal(c.demand,null);}
});
test('synthetic case uses all actual calculated producer demand and retains exact evidence',{skip},async()=>{
 const fixture=planningFixture(),frozen=freezeForecast(fixture.actuals),demo=await buildExhibit({frozen,rows:planningCase(frozen,fixture.actuals,INJECTORS),injectors:INJECTORS,controls:{newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000},planningFixture:fixture});
 const c=api.disposalContext({source:'demo',demo});assert.equal(c.ready,true);assert.equal(c.demand.origin,'synthetic');assert.equal(c.demand.monthly[0].demandBbl,180697.6360618436);assert.equal(c.demand.monthly[3].demandBbl,346068.8130260831);assert.equal(c.demand.evidence.contentSha256,demo.contentSha256);assert.deepEqual(c.wells,INJECTORS);
 c.demand.evidence.inputs.planningFixture.actuals[0].volumeBbl=0;assert.notEqual(demo.inputs.planningFixture.actuals[0].volumeBbl,0);
});
test('confirmed imports preserve user AND synthetic classification, hashes and contribution lineage',{skip},async()=>{
 const h=await history(),i=await injector(),bundle=analyzeImports({history:h,injectors:i,producerIds:['OLD'],injectorIds:['I'],cutoff:'2025-12',first:'2026-01',last:'2026-02',model:'exponential-log-fit/1'});
 const c=api.disposalContext({source:'user',imported:bundle});assert.equal(c.ready,true);assert.equal(c.demand.origin,'user');assert.equal(c.demand.content,'synthetic + assumed');assert.ok(Math.abs(c.demand.monthly[0].demandBbl-3100)<1e-8);assert.equal(c.demand.evidence.inputs.history.rows[0].lineage.source.sha256,h.rows[0].lineage.source.sha256);assert.equal(c.wells[0].id,'I');
 const stale=structuredClone(bundle);stale.producerMonths=[];assert.equal(api.disposalContext({source:'user',imported:stale}).ready,false);
});
test('missing history or injector profiles state precise blocking reason',{skip},async()=>{
 const h=await history();const bundle=analyzeImports({history:h,producerIds:['OLD'],cutoff:'2025-12',first:'2026-01',last:'2026-02',model:'exponential-log-fit/1'});const c=api.disposalContext({source:'user',imported:bundle});assert.equal(c.ready,false);assert.match(c.reasons.join(' '),/injector/i);
});

