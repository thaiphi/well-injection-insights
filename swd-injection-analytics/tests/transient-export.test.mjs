import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDisposalCase} from '../dist/disposalCase.js';
import {buildTransientCase,CLOSING_7} from '../dist/transientCase.js';
import {buildInterference,CLOSING_8} from '../dist/interference.js';
import {addPackage,packageFromVerified,EMPTY_PACKAGE_SET} from '../dist/historyPackages.js';
const tx=await import('../dist/transientExport.js').catch(()=>({}));

// Fictional data only: fictional subject FICTIONAL-A and fictional offset UICs 000000418..000000420 (fixtures as in tests/interference.test.mjs).
const WELL={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:2470,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const CASE_INPUTS={caseName:'Fictional export case',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-01',demandBbl:60000}],evidence:{fixture:'fictional'}},
 wells:[WELL],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8}};
const CASE=buildDisposalCase(CASE_INPUTS);
const mi=m=>Number(m.slice(0,4))*12+Number(m.slice(5,7))-1;
const ma=i=>`${Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`;
const span=(a,b)=>{const out=[];for(let i=mi(a);i<=mi(b);i++)out.push(ma(i));return out;};
const row=(month,bbl,uic)=>({source_row_key:month+uic,parent_key:'fictional-parent',parent_join_status:'joined',uic_number:uic,reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:500,reported_max_injection_pressure_psi:900,calendar_days:30,calculated_calendar_day_avg_bpd:bbl===null?null:bbl/30});
const pkg=({id,uic,start,end,def})=>packageFromVerified({
 artifact:{schemaVersion:1,artifactId:id,inventory:[{source_record_key:'inv-'+id,uic_number:uic,api_no:'00000000000000'}],
  injectionMonthly:span(start,end).map(m=>row(m,def,uic)),manifest:{scope:{uic_number:uic,start:start+'-01',end:end+'-28'}},qualityReport:{},dataDictionary:{}},
 pin:{artifactId:id,manifestSha256:'sha-'+id},calculationEligibility:{ready:true,reasons:[]}});
const A='000000418',B='000000419',Cw='000000420';
const PA=pkg({id:'pa',uic:A,start:'2027-06',end:'2028-06',def:90000});
const PB=pkg({id:'pb',uic:B,start:'2027-01',end:'2027-12',def:60000});
const PC=pkg({id:'pc',uic:Cw,start:'2026-11',end:'2028-03',def:30000});
const SET=[PA,PB,PC].reduce(addPackage,EMPTY_PACKAGE_SET);
const ch=(uic,o={})=>({uic,distanceFt:2000,connected:true,zerosAreShutIn:false,gapRates:{},prior:null,after:null,...o});
const OFFSETS=[ch(A,{distanceFt:1500,after:{kind:'typed',rateStbd:3000}}),ch(B,{distanceFt:2500,after:{kind:'shut-in'}}),ch(Cw,{distanceFt:4000,connected:false,after:{kind:'hold-average',lastN:3}})];
const ROCK={k:50,h:100,phi:0.15,cf:4e-6,rw:0.35,skin:2};
const sched=(first,rates)=>({months:rates.map((rateStbd,i)=>({month:ma(mi(first)+i),rateStbd})),origin:'typed'});
const subject=(o={})=>({wellId:'FICTIONAL-A',rock:{...ROCK},boundary:{kind:'infinite',statedExtentFt:null},schedule:sched('2028-01',Array(24).fill(3000)),profileMonths:['2028-06'],sensitivity:{k:{low:25,high:100}},...o});
const iinp=(o={})=>({subject:subject(),tRef:'2027-12',rankingMonth:'2028-06',offsets:OFFSETS,sensitivity:{k:{low:25,high:100}},...o});
const PACKAGES=SET.packages.map(p=>({uic:p.uic,artifactId:p.artifactId,manifestSha256:p.manifestSha256,window:{...p.window},monthly:p.monthly.map(r=>({...r}))}));
const makeExport=(withInterference=true,subj=subject())=>({caseInputs:CASE_INPUTS,transient:buildTransientCase(CASE,subj),
 interference:withInterference?buildInterference(CASE,SET,iinp({subject:subj})):null,packages:withInterference?PACKAGES:[]});
const clone=v=>JSON.parse(JSON.stringify(v));
const reseal=s=>{const {contentSha256,schemaVersion,versions,...rest}=clone(s);return tx.sealTransient(rest);};
const forgedVerify=async s=>tx.verifyTransient(await reseal(s));
const STALE=/Result changed or stale/;
// Minimal CSV parser (quoted fields, doubled quotes, CRLF records).
function parseCsv(text){
 const rows=[];let r=[],f='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
  else if(c==='"')q=true;else if(c===','){r.push(f);f='';}
  else if(c==='\r'){}else if(c==='\n'){r.push(f);rows.push(r);r=[];f='';}else f+=c;}
 return rows;
}
// A subject whose later months pass 10,000 psia (blocked rows: rise, skin and bottomhole are null).
const BLOCKED=subject({rock:{...ROCK,k:1},schedule:sched('2028-01',Array(12).fill(100000)),profileMonths:[],sensitivity:{}});

test('module exists with the schema string',()=>{
 assert.equal(typeof tx.sealTransient,'function');assert.equal(typeof tx.verifyTransient,'function');
 assert.equal(typeof tx.transientJson,'function');assert.equal(typeof tx.transientCsv,'function');
 assert.equal(tx.TRANSIENT_EXPORT_SCHEMA,'transient-interference-export/1');
});

test('round trip verifies with and without interference',async()=>{
 const a=await tx.sealTransient(makeExport(true));
 assert.equal(a.schemaVersion,'transient-interference-export/1');assert.match(a.contentSha256,/^[a-f0-9]{64}$/);
 assert.equal(await tx.verifyTransient(a),a);
 const b=await tx.sealTransient(makeExport(false));
 assert.equal(b.interference,null);assert.deepEqual(b.packages,[]);
 assert.equal(await tx.verifyTransient(b),b);
 // Through JSON text (what a user would load back).
 assert.equal((await tx.verifyTransient(JSON.parse(tx.transientJson(a)))).contentSha256,a.contentSha256);
 assert.ok(tx.transientJson(a).endsWith('}\n'));
 // Blocked months (nulls) also round-trip.
 const c=await tx.sealTransient(makeExport(false,BLOCKED));
 assert.ok(c.transient.monthly.some(m=>m.blocked!==null&&m.risePsi===null));
 await tx.verifyTransient(JSON.parse(tx.transientJson(c)));
});

test('rejected: a tampered rise without a reseal (hash mismatch)',async()=>{
 const s=clone(await tx.sealTransient(makeExport(true)));
 s.transient.monthly[3].risePsi+=1;
 await assert.rejects(()=>tx.verifyTransient(s),STALE);
 const t=clone(await tx.sealTransient(makeExport(true)));
 t.interference.views[0].monthly[2].ownRisePsi+=1;
 await assert.rejects(()=>tx.verifyTransient(t),STALE);
});

test('rejected: a resealed tampered rise (recomputation differs)',async()=>{
 const s=clone(await tx.sealTransient(makeExport(true)));
 s.transient.monthly[3].risePsi+=1;
 const forged=await reseal(s);
 assert.notEqual(forged.contentSha256,(await tx.sealTransient(makeExport(true))).contentSha256);
 await assert.rejects(()=>tx.verifyTransient(forged),STALE);
 // Tampered interference row, resealed.
 const t=clone(await tx.sealTransient(makeExport(true)));
 t.interference.views[0].rows[0].addedPsi+=0.5;
 await assert.rejects(()=>forgedVerify(t),STALE);
 // A blocked month turned from null into 0 is rejected, with and without a reseal.
 const c=clone(await tx.sealTransient(makeExport(false,BLOCKED)));
 const k=c.transient.monthly.findIndex(m=>m.blocked!==null);
 c.transient.monthly[k].risePsi=0;
 await assert.rejects(()=>tx.verifyTransient(c),STALE);
 await assert.rejects(()=>forgedVerify(c),STALE);
});

test('rejected: an edited distance, with and without a reseal',async()=>{
 const s=clone(await tx.sealTransient(makeExport(true)));
 s.interference.inputs.offsets[0].distanceFt+=100;
 await assert.rejects(()=>tx.verifyTransient(s),STALE);
 await assert.rejects(()=>forgedVerify(s),STALE);
 // A distance edited only in a result row.
 const t=clone(await tx.sealTransient(makeExport(true)));
 t.interference.views[0].rows[0].distanceFt+=100;
 await assert.rejects(()=>forgedVerify(t),STALE);
});

test('rejected: an edited package monthly row, with and without a reseal',async()=>{
 const s=clone(await tx.sealTransient(makeExport(true)));
 s.packages[0].monthly[0].calculated_calendar_day_avg_bpd*=2;
 await assert.rejects(()=>tx.verifyTransient(s),STALE);
 await assert.rejects(()=>forgedVerify(s),STALE);
 // The reported volume edited without a reseal is caught by the digest.
 const v=clone(await tx.sealTransient(makeExport(true)));
 v.packages[0].monthly[0].injected_liquid_bbl*=2;
 await assert.rejects(()=>tx.verifyTransient(v),STALE);
});

test('rejected: a wrong schema string, an unsealed or short digest',async()=>{
 const base=await tx.sealTransient(makeExport(true));
 const s=clone(base);s.schemaVersion='transient-interference-export/2';
 await assert.rejects(()=>tx.verifyTransient(s),STALE);
 const d=clone(base);d.contentSha256='abc';
 await assert.rejects(()=>tx.verifyTransient(d),STALE);
 const e=clone(base);delete e.contentSha256;
 await assert.rejects(()=>tx.verifyTransient(e),STALE);
 await assert.rejects(()=>tx.verifyTransient(null),STALE);
});

test('rejected: interference with empty or inconsistent packages (resealed so only the check can refuse)',async()=>{
 const base=await tx.sealTransient(makeExport(true));
 const empty=clone(base);empty.packages=[];
 await assert.rejects(()=>forgedVerify(empty),/Result changed or stale: .*no packages/);
 const missing=clone(base);missing.packages=missing.packages.filter(p=>p.uic!==Cw);
 await assert.rejects(()=>forgedVerify(missing),STALE);
 const dup=clone(base);dup.packages.push(clone(dup.packages[0]));
 await assert.rejects(()=>forgedVerify(dup),STALE);
 const extra=clone(await tx.sealTransient(makeExport(false)));extra.packages=clone(PACKAGES);
 await assert.rejects(()=>forgedVerify(extra),/stale: .*without an interference/);
});

test('rejected: the interference subject differs from the transient inputs',async()=>{
 const x=makeExport(true);
 x.transient=buildTransientCase(CASE,subject({rock:{...ROCK,k:60}}));
 await assert.rejects(async()=>tx.verifyTransient(await tx.sealTransient(x)),STALE);
});

test('numbers compare within 1e-9 relative: a 1e-12 change verifies, a 1e-6 change does not',async()=>{
 const base=clone(await tx.sealTransient(makeExport(true)));
 const near=clone(base);near.transient.monthly[3].risePsi*=1+1e-12;
 assert.ok(await forgedVerify(near));
 const far=clone(base);far.transient.monthly[3].risePsi*=1+1e-6;
 await assert.rejects(()=>forgedVerify(far),STALE);
});

test('determinism: two seals of the same input are byte-identical (JSON and CSV)',async()=>{
 const a=await tx.sealTransient(makeExport(true)),b=await tx.sealTransient(makeExport(true));
 assert.equal(tx.transientJson(a),tx.transientJson(b));assert.equal(tx.transientCsv(a),tx.transientCsv(b));
 assert.equal(a.contentSha256,b.contentSha256);
 const keyed=await tx.sealTransient({packages:PACKAGES,interference:buildInterference(CASE,SET,iinp()),transient:buildTransientCase(CASE,subject()),caseInputs:CASE_INPUTS});
 assert.equal(keyed.contentSha256,a.contentSha256);
});

test('CSV: every line has exactly 4 fields, the header is fixed and both closing lines appear',async()=>{
 const s=await tx.sealTransient(makeExport(true));
 const rows=parseCsv(tx.transientCsv(s));
 assert.deepEqual(rows[0],['section','rule_or_well','field','value']);
 assert.ok(rows.length>100);
 for(const r of rows)assert.equal(r.length,4,JSON.stringify(r));
 const closing=rows.filter(r=>r[0]==='closing').map(r=>r[3]);
 assert.deepEqual(closing,[CLOSING_7,CLOSING_8]);
 const sections=new Set(rows.map(r=>r[0]));
 for(const sec of ['labels','assumptions','transient-monthly','transient-profile','sensitivity','interference-all-connected','interference-your-selection','interference-none','closing','metadata'])assert.ok(sections.has(sec),sec);
 assert.ok(rows.some(r=>r[0]==='interference-all-connected'&&r[1]===A&&r[2]==='distance_ft'&&r[3]==='1500'));
 assert.ok(rows.some(r=>r[0]==='interference-all-connected'&&r[1]==='2028-03'&&r[2]==='own_rise_psi'));
 assert.ok(rows.some(r=>r[0]==='metadata'&&r[2]==='contentSha256'&&r[3]===s.contentSha256));
 // Warnings appear in their own section (a blocked month warns).
 const w=parseCsv(tx.transientCsv(await tx.sealTransient(makeExport(false,BLOCKED))));
 assert.ok(w.some(r=>r[0]==='warnings'&&/not shown/.test(r[3])));
 // Without interference: transient sections and the one closing line only.
 const t=parseCsv(tx.transientCsv(await tx.sealTransient(makeExport(false))));
 for(const r of t)assert.equal(r.length,4);
 assert.deepEqual(t.filter(r=>r[0]==='closing').map(r=>r[3]),[CLOSING_7]);
 assert.ok(!t.some(r=>r[0].startsWith('interference-')));
});

test('CSV: a null is "unavailable", never 0',async()=>{
 const s=await tx.sealTransient(makeExport(false,BLOCKED));
 const rows=parseCsv(tx.transientCsv(s));
 const blocked=s.transient.monthly.filter(m=>m.blocked!==null);
 assert.ok(blocked.length>0);
 for(const m of blocked)for(const f of ['rise_psi','skin_psi','bottomhole_psia']){
  const r=rows.find(x=>x[0]==='transient-monthly'&&x[1]===m.month&&x[2]===f);
  assert.equal(r[3],'unavailable',`${m.month} ${f}`);
 }
 assert.ok(rows.some(r=>r[2]==='blocked'&&r[3]!=='unavailable'));
 // Interference: the none view has no counted offset, so offsets_psi is null.
 const i=parseCsv(tx.transientCsv(await tx.sealTransient(makeExport(true))));
 const none=i.filter(r=>r[0]==='interference-none'&&r[2]==='offsets_psi');
 assert.ok(none.length>0);assert.ok(none.every(r=>r[3]==='unavailable'));
 assert.ok(!rows.some(r=>r[2]==='first_month_at_limit'&&r[3]==='0'));
});

test('CSV: an injected formula in a text cell is neutralised',async()=>{
 const x=makeExport(false);x.transient.warnings=['=HYPERLINK("http://x")'];
 const rows=parseCsv(tx.transientCsv(await tx.sealTransient(x)));
 assert.ok(rows.some(r=>r[0]==='warnings'&&r[3]==='\'=HYPERLINK("http://x")'));
});

// ---- Task 8 fix round 1: the permitted interval in exports (evidence only; not a calculation input) ----
const INTERVAL={permitted_top_depth_ft:4000,permitted_bottom_depth_ft:4500,label:'as reported; depth basis unknown'};
const withIntervals=(list)=>({...makeExport(true),packages:PACKAGES.map((p,i)=>({...p,permittedInterval:list[i]??null}))});
test('fix 1: the permitted interval round-trips with and without a value; the label is fixed',async()=>{
 assert.equal(tx.PERMITTED_INTERVAL_LABEL,'as reported; depth basis unknown');
 const s=await tx.sealTransient(withIntervals([INTERVAL,{...INTERVAL,permitted_top_depth_ft:null},null]));
 assert.deepEqual(s.packages[0].permittedInterval,INTERVAL);assert.equal(s.packages[2].permittedInterval,null);
 const back=JSON.parse(tx.transientJson(s));
 assert.equal((await tx.verifyTransient(back)).contentSha256,s.contentSha256);
 assert.deepEqual(back.packages.map(p=>p.permittedInterval),[INTERVAL,{...INTERVAL,permitted_top_depth_ft:null},null]);
 // Older exports without the field still verify.
 const old=await tx.sealTransient(makeExport(true));assert.equal(await tx.verifyTransient(old),old);
 // CSV: one 4-column row per package in a packages section; null reads "unavailable", never 0.
 const rows=parseCsv(tx.transientCsv(s)).filter(r=>r[0]==='packages');
 assert.deepEqual(rows,[['packages',A,'permitted_interval pa','top 4,000 ft; bottom 4,500 ft; as reported; depth basis unknown'],
  ['packages',B,'permitted_interval pb','top not reported; bottom 4,500 ft; as reported; depth basis unknown'],['packages',Cw,'permitted_interval pc','unavailable']]);
 assert.ok(!parseCsv(tx.transientCsv(await tx.sealTransient(makeExport(false)))).some(r=>r[0]==='packages'));
});
test('fix 1: a resealed interval edit verifies (stored evidence, like other unread fields); an unsealed edit fails on the digest; a malformed one is refused',async()=>{
 const s=clone(await tx.sealTransient(withIntervals([INTERVAL])));
 s.packages[0].permittedInterval.permitted_top_depth_ft=4100;
 await assert.rejects(()=>tx.verifyTransient(s),/content digest does not match/);
 const resealed=await reseal(s);
 assert.equal((await tx.verifyTransient(resealed)).packages[0].permittedInterval.permitted_top_depth_ft,4100);
 for(const bad of [{...INTERVAL,label:'calibrated depth'},{...INTERVAL,permitted_top_depth_ft:'4000'},{...INTERVAL,extra:1},'4000-4500'])
  await assert.rejects(async()=>tx.verifyTransient(await reseal({...clone(s),packages:s.packages.map((p,i)=>i===0?{...p,permittedInterval:bad}:p)})),STALE,JSON.stringify(bad));
});
