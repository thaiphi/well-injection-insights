import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDisposalCase} from '../dist/disposalCase.js';
import {BANNED} from '../dist/caseSummary.js';
import {lineSourceRise} from '../dist/transientModel.js';
import {buildTransientCase,PVT_BLOCK} from '../dist/transientCase.js';
import {addPackage,packageFromVerified,EMPTY_PACKAGE_SET} from '../dist/historyPackages.js';
const ix=await import('../dist/interference.js').catch(()=>({}));

// Fictional data only: fictional subject well FICTIONAL-A and fictional offset UICs 000000418..000000425.
const WELL={id:'FICTIONAL-A',reservoirPsia:2000,limitPsia:2470,injectivityStbdPerPsi:5,operatingCeilingStbd:10000,availability:0.9,datum:'formation',reservoirDatum:'formation',limitDatum:'formation',reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',tvdFt:3000,measuredDepthFt:3500,innerDiameterInches:5,roughnessInches:0.0006,surfaceLimitPsia:5000};
const mkCase=(limitPsia=2470)=>buildDisposalCase({caseName:'Fictional interference case',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-01',demandBbl:60000}],evidence:{fixture:'fictional'}},
 wells:[{...WELL,limitPsia}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8}});
const CASE=mkCase();

// Calendar helpers (test-local; hours are calendar days x 24 summed from a fixed origin month).
const mi=m=>Number(m.slice(0,4))*12+Number(m.slice(5,7))-1;
const ma=i=>`${Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`;
const dim=m=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0)).getUTCDate();
const span=(a,b)=>{const out=[];for(let i=mi(a);i<=mi(b);i++)out.push(ma(i));return out;};
const ORIGIN='2020-01';
const startH=m=>{if(mi(m)<mi(ORIGIN))throw new Error('test helper: month before ORIGIN');let h=0;for(let i=mi(ORIGIN);i<mi(m);i++)h+=dim(ma(i))*24;return h;};
const endH=m=>startH(ma(mi(m)+1));
// Hand superposition with lineSourceRise: steps [{month,rate}] in order, each held for its month.
const hand=(rock,r,steps,T)=>{let prev=0,s=0;for(const {month,rate} of steps){const t0=startH(month);if(T>t0&&rate!==prev)s+=(rate-prev)*lineSourceRise(rock,r,T-t0);prev=rate;}return s;};
const sch=(first,lastWin,rate,afterRate,through)=>span(first,through).map(month=>({month,rate:mi(month)<=mi(lastWin)?rate:afterRate}));
const rockOf=tr=>({k:tr.inputs.rock.k,h:tr.inputs.rock.h,phi:tr.inputs.rock.phi,ct:tr.fluid.ct,mu:tr.fluid.mu,B:tr.fluid.B});
const rel=(a,b)=>Math.abs(a-b)/Math.max(1e-9,Math.abs(b));

// Fictional packages (calculated rate = bbl/30, as in tests/offset-history.test.mjs).
const row=(month,bbl,uic)=>({source_row_key:month+uic,parent_key:'fictional-parent',parent_join_status:'joined',uic_number:uic,reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:month+'-01',injected_liquid_bbl:bbl,reported_avg_injection_pressure_psi:500,reported_max_injection_pressure_psi:900,calendar_days:30,calculated_calendar_day_avg_bpd:bbl===null?null:bbl/30});
const pkg=({id,uic,start,end,vol={},def})=>packageFromVerified({
 artifact:{schemaVersion:1,artifactId:id,inventory:[{source_record_key:'inv-'+id,uic_number:uic,api_no:'00000000000000'}],
  injectionMonthly:span(start,end).map(m=>row(m,vol[m]!==undefined?vol[m]:def,uic)),
  manifest:{scope:{uic_number:uic,start:start+'-01',end:end+'-28'}},qualityReport:{},dataDictionary:{}},
 pin:{artifactId:id,manifestSha256:'sha-'+id},calculationEligibility:{ready:true,reasons:[]}});
const setOf=(...ps)=>ps.reduce(addPackage,EMPTY_PACKAGE_SET);
const A='000000418',B='000000419',Cw='000000420',D='000000421',E='000000422',X='000000423',Y='000000424',Z='000000425';
const PA=pkg({id:'pa',uic:A,start:'2027-06',end:'2028-06',def:90000});          // 3000 bpd; starts before the subject, spans Feb 2028
const PB=pkg({id:'pb',uic:B,start:'2027-01',end:'2027-12',def:60000});          // 2000 bpd; spans Feb 2027
const PC=pkg({id:'pc',uic:Cw,start:'2026-11',end:'2028-03',def:30000});         // 1000 bpd
const SET=setOf(PA,PB,PC);
const ch=(uic,o={})=>({uic,distanceFt:2000,connected:true,zerosAreShutIn:false,gapRates:{},prior:null,after:null,...o});
const chA=(o={})=>ch(A,{distanceFt:1500,after:{kind:'typed',rateStbd:3000},...o});
const chB=(o={})=>ch(B,{distanceFt:2500,after:{kind:'shut-in'},...o});
const chC=(o={})=>ch(Cw,{distanceFt:4000,after:{kind:'hold-average',lastN:3},...o});
// Expected schedules (hand-written from the packages and choices above).
const sA=through=>sch('2027-06','2028-06',3000,3000,through);
const sB=through=>sch('2027-01','2027-12',2000,0,through);
const sC=through=>sch('2026-11','2028-03',1000,1000,through);
const ROCK={k:50,h:100,phi:0.15,cf:4e-6,rw:0.35,skin:2};
const months=(first,n)=>Array.from({length:n},(_,i)=>ma(mi(first)+i));
const sched=(first,rates)=>({months:months(first,rates.length).map((month,i)=>({month,rateStbd:rates[i]})),origin:'typed'});
const subject=(o={})=>({wellId:'FICTIONAL-A',rock:{...ROCK},boundary:{kind:'infinite',statedExtentFt:null},schedule:sched('2028-01',Array(24).fill(3000)),profileMonths:[],sensitivity:{},...o});
const inp=(o={})=>({subject:subject(),tRef:null,rankingMonth:'2028-03',offsets:[chA(),chB(),chC()],sensitivity:{},...o});
const run=(i,set=SET,c=CASE)=>ix.buildInterference(c,set,i);
const view=(r,name)=>r.views.find(v=>v.name===name);
const rowOf=(v,uic)=>v.rows.find(x=>x.uic===uic);
const refused=(fn,pattern)=>assert.throws(fn,pattern);

test('module exists with fixed copy',()=>{
 assert.equal(typeof ix.buildInterference,'function');
 assert.equal(ix.INTERFERENCE_VERSION,'interference-screening/1');
 assert.equal(ix.CLOSING_8,'Screening ranking from assumed reservoir properties and typed distances; closeness is not connectivity.');
 assert.equal(ix.RANKING_LABEL,'screening ranking under the stated assumptions; not a pressure forecast');
 assert.equal(ix.EXCLUDED,'excluded by assumption');
 const r=run(inp());
 assert.equal(r.closing,ix.CLOSING_8);
 assert.equal(r.mode,'rise-above-undisturbed');
 assert.deepEqual(r.views.map(v=>v.name),['all-connected','your-selection','none']);
 assert.ok(r.assumptions.includes('reported bbl/day treated as STB/day; Bw from the subject\'s fluid'));
 assert.ok(r.labels.includes(ix.RANKING_LABEL));assert.ok(!r.assumptions.includes(ix.RANKING_LABEL));
 assert.ok(r.labels.some(l=>/rise above undisturbed/.test(l)));assert.ok(!r.labels.some(l=>/pressure as of/.test(l)));
 const t=run(inp({tRef:'2027-12',rankingMonth:'2028-06'}));
 assert.ok(t.labels.includes('pressure as of 2027-12 (assumed)'));assert.ok(t.labels.includes(ix.REMOVAL_LABEL));
 assert.equal(r.versions.interference,'interference-screening/1');
});

test('B1: one offset at distance r equals lineSourceRise superposed over its schedule (offset starts before the subject, spans February)',()=>{
 const set=setOf(PA),tr=buildTransientCase(CASE,subject()),rock=rockOf(tr);
 for(const rank of ['2028-01','2028-03','2028-06','2028-09']){
  const r=run(inp({offsets:[chA()],rankingMonth:rank}),set);
  const got=rowOf(view(r,'all-connected'),A).addedPsi,want=hand(rock,1500,sA(rank),endH(rank));
  assert.ok(want>0);assert.ok(rel(got,want)<1e-12,`${rank}: ${got} vs ${want}`);
 }
});

test('B2: N offsets equal the hand sum and do not depend on order',()=>{
 const tr=buildTransientCase(CASE,subject()),rock=rockOf(tr),T=endH('2028-03');
 const r=run(inp());
 const v=view(r,'all-connected');
 const want={[A]:hand(rock,1500,sA('2028-03'),T),[B]:hand(rock,2500,sB('2028-03'),T),[Cw]:hand(rock,4000,sC('2028-03'),T)};
 for(const [u,w] of Object.entries(want))assert.ok(rel(rowOf(v,u).addedPsi,w)<1e-12,u);
 assert.ok(rel(v.totalPsi,want[A]+want[B]+want[Cw])<1e-12);
 const p=run(inp({offsets:[chC(),chA(),chB()]}));
 assert.deepEqual(p.views,r.views);assert.deepEqual(p.sensitivity,r.sensitivity);assert.deepEqual(p.warnings,r.warnings);
});

test('B7 / Review Focus 4: gaps, unconfirmed zeros and no after-choice past the window are incomplete, never a number',()=>{
 const PD=pkg({id:'pd',uic:D,start:'2027-06',end:'2027-12',def:30000,vol:{'2027-08':null,'2027-09':0}});
 const set=setOf(PA,PD);
 const r=run(inp({offsets:[chA(),ch(D)],rankingMonth:'2028-03'}),set);
 for(const name of ['all-connected','your-selection']){
  const v=view(r,name),d=rowOf(v,D);
  assert.equal(d.status,'incomplete');assert.equal(d.addedPsi,null);assert.equal(d.share,null);
  assert.ok(d.labels.some(l=>/incomplete: 2 gap months/.test(l)),JSON.stringify(d.labels));
  assert.ok(d.labels.some(l=>/after last report/.test(l)),JSON.stringify(d.labels));
  assert.equal(v.status,'incomplete');assert.equal(v.totalPsi,null);
  assert.equal(v.rows[v.rows.length-1].uic,D);           // no rank: after the numbered rows
  assert.equal(typeof rowOf(v,A).addedPsi,'number');
 }
 // Filling the gaps, confirming the zero and choosing an after-window rate gives a number.
 const f=run(inp({offsets:[chA(),ch(D,{gapRates:{'2027-08':1000},zerosAreShutIn:true,after:{kind:'shut-in'}})]}),set);
 assert.equal(typeof rowOf(view(f,'all-connected'),D).addedPsi,'number');assert.equal(view(f,'all-connected').status,'complete');
 // With t_ref, an incomplete counted offset leaves the limit month undetermined.
 const t=run(inp({offsets:[chA(),ch(D)],tRef:'2027-12',rankingMonth:'2028-03'}),set);
 assert.equal(view(t,'all-connected').limitMonth,null);
 assert.ok(t.warnings.some(w=>w.includes(D)),JSON.stringify(t.warnings));
 assert.ok(view(t,'all-connected').monthly.every(m=>m.offsetsPsi===null&&m.bottomholePsia===null&&typeof m.ownRisePsi==='number'));
});

test('B7: connected:null is refused, naming the UIC',()=>{
 refused(()=>run(inp({offsets:[chA(),chB({connected:null}),chC()]})),new RegExp(`${B}.*connected|connected.*${B}`));
});

test('B7: a reported zero is a gap until confirmed; confirmed, it gives a falloff',()=>{
 const zeros=Object.fromEntries(span('2028-01','2028-06').map(m=>[m,0]));
 const PE=pkg({id:'pe',uic:E,start:'2027-06',end:'2028-06',def:90000,vol:zeros});
 const set=setOf(PE);
 const base={offsets:[ch(E,{after:{kind:'shut-in'}})],tRef:'2027-12',rankingMonth:'2028-06'};
 const u=run(inp(base),set);
 assert.equal(rowOf(view(u,'all-connected'),E).status,'incomplete');assert.equal(rowOf(view(u,'all-connected'),E).addedPsi,null);
 const c=run(inp({...base,offsets:[ch(E,{zerosAreShutIn:true,after:{kind:'shut-in'}})]}),set);
 const e=rowOf(view(c,'all-connected'),E);
 assert.ok(e.addedPsi<0,String(e.addedPsi));
 const tr=buildTransientCase(CASE,subject()),rock=rockOf(tr),s=sch('2027-06','2027-12',3000,0,'2028-06');
 assert.ok(rel(e.addedPsi,hand(rock,2000,s,endH('2028-06'))-hand(rock,2000,s,endH('2027-12')))<1e-12);
});

test('B8: a not-connected offset changes nothing; none equals #7 alone',()=>{
 const c=mkCase(2420),tr=buildTransientCase(c,subject());
 assert.notEqual(tr.firstMonthAtLimit,null);
 const withB=run(inp({offsets:[chA(),chB({connected:false}),chC()],tRef:'2027-12',rankingMonth:'2028-06'}),SET,c);
 const without=run(inp({offsets:[chA(),chC()],tRef:'2027-12',rankingMonth:'2028-06'}),setOf(PA,PC),c);
 const vs=view(withB,'your-selection'),vw=view(without,'your-selection');
 assert.deepEqual(vs.rows.filter(x=>x.uic!==B),vw.rows);
 assert.equal(vs.totalPsi,vw.totalPsi);assert.equal(vs.limitMonth,vw.limitMonth);assert.deepEqual(vs.removalEffects,vw.removalEffects);
 assert.equal(vs.status,'complete');
 const b=rowOf(vs,B);
 assert.equal(b.status,'excluded');assert.equal(b.addedPsi,null);assert.equal(b.share,null);assert.ok(b.labels.includes(ix.EXCLUDED));
 assert.equal(typeof rowOf(view(withB,'all-connected'),B).addedPsi,'number');
 for(const r of [withB,without]){
  const n=view(r,'none');
  assert.equal(n.limitMonth,tr.firstMonthAtLimit);assert.deepEqual(n.removalEffects,[]);assert.equal(n.totalPsi,null);assert.equal(n.status,'complete');
  assert.deepEqual(n.monthly.map(m=>m.ownRisePsi),tr.monthly.map(m=>m.risePsi));
  assert.deepEqual(n.monthly.map(m=>m.bottomholePsia),tr.monthly.map(m=>m.bottomholePsia));
  assert.ok(n.monthly.every(m=>m.offsetsPsi===null));
  assert.ok(n.rows.every(x=>x.status==='not-counted'&&x.addedPsi===null&&x.labels.includes(ix.NOT_COUNTED)&&!x.labels.includes(ix.EXCLUDED)));
 }
});

test('B9: since t_ref equals rise(t) minus rise(t_ref); t_ref before every offset equals the undisturbed rise; no t_ref gives no limit month',()=>{
 const tr=buildTransientCase(CASE,subject()),rock=rockOf(tr);
 const r=run(inp({tRef:'2027-12',rankingMonth:'2028-06'}));
 assert.equal(r.mode,'since-t-ref');
 const v=view(r,'all-connected'),T=endH('2028-06'),R=endH('2027-12');
 for(const [u,d,s] of [[A,1500,sA],[B,2500,sB],[Cw,4000,sC]])
  assert.ok(rel(rowOf(v,u).addedPsi,hand(rock,d,s('2028-06'),T)-hand(rock,d,s('2028-06'),R))<1e-12,u);
 // t_ref before every offset's first month.
 const early=subject({schedule:sched('2026-01',Array(24).fill(3000))});
 const a=run(inp({subject:early,tRef:'2025-12',rankingMonth:'2027-12'})),b=run(inp({subject:early,tRef:null,rankingMonth:'2027-12'}));
 for(const u of [A,B,Cw])assert.equal(rowOf(view(a,'all-connected'),u).addedPsi,rowOf(view(b,'all-connected'),u).addedPsi);
 // No t_ref: no limit month and no removal effects anywhere.
 for(const x of view(b,'all-connected')?[b,run(inp())]:[])for(const vv of x.views){assert.equal(vv.limitMonth,null);assert.deepEqual(vv.removalEffects,[]);}
});

test('B9: t_ref must be the month before the subject schedule; ranking month must follow t_ref',()=>{
 refused(()=>run(inp({tRef:'2027-11'})),/month after/);
 refused(()=>run(inp({tRef:'2028-01'})),/month after/);
 refused(()=>run(inp({tRef:'2027-12',rankingMonth:'2027-12'})),/ranking month/i);
});

test('B10: the subject skin changes only its own term; offsets unchanged',()=>{
 const a=run(inp({tRef:'2027-12',rankingMonth:'2028-06'})),b=run(inp({tRef:'2027-12',rankingMonth:'2028-06',subject:subject({rock:{...ROCK,skin:10}})}));
 for(const name of ['all-connected','your-selection'])assert.deepEqual(view(a,name).rows,view(b,name).rows);
 assert.deepEqual(a.sensitivity,b.sensitivity);
});

test('limit month with t_ref: first month P_i + own + counted offsets since t_ref reaches the limit; removal one at a time',()=>{
 for(const limit of [2420,2470]){
  const c=mkCase(limit),tr=buildTransientCase(c,subject()),rock=rockOf(tr),R=endH('2027-12'),end='2029-12';
  const off={[A]:[1500,sA(end)],[B]:[2500,sB(end)],[Cw]:[4000,sC(end)]};
  const firstAt=uics=>{
   for(const m of tr.monthly){
    const p=2000+m.risePsi+uics.reduce((s,u)=>s+hand(rock,off[u][0],off[u][1],endH(m.month))-hand(rock,off[u][0],off[u][1],R),0);
    if(p>=limit)return m.month;
   }
   return null;
  };
  const r=run(inp({tRef:'2027-12',rankingMonth:'2028-06'}),SET,c),v=view(r,'all-connected');
  assert.equal(v.limitMonth,firstAt([A,B,Cw]),`limit ${limit}`);
  assert.deepEqual(v.removalEffects,[A,B,Cw].map(u=>({uic:u,limitMonth:firstAt([A,B,Cw].filter(x=>x!==u)),note:null})));
  if(limit===2420){assert.notEqual(v.limitMonth,null);assert.ok(v.removalEffects.some(e=>e.limitMonth!==v.limitMonth));}
 }
 // Monthly series: offsets since t_ref equal the hand sum; bottomhole = P_i + own + offsets.
 const c=mkCase(2420),tr=buildTransientCase(c,subject()),rock=rockOf(tr),R=endH('2027-12');
 const v=view(run(inp({tRef:'2027-12',rankingMonth:'2028-06'}),SET,c),'all-connected');
 assert.equal(v.monthly.length,24);
 v.monthly.forEach((m,i)=>{
  const off=[[1500,sA('2029-12')],[2500,sB('2029-12')],[4000,sC('2029-12')]].reduce((s,[d,sc])=>s+hand(rock,d,sc,endH(m.month))-hand(rock,d,sc,R),0);
  assert.equal(m.month,tr.monthly[i].month);assert.equal(m.ownRisePsi,tr.monthly[i].risePsi);
  assert.ok(Math.abs(m.offsetsPsi-off)<1e-9*Math.max(1,Math.abs(off)),m.month);
  assert.ok(Math.abs(m.bottomholePsia-(2000+m.ownRisePsi+m.offsetsPsi))<1e-9);
 });
 // Without t_ref: offsets are the rise above undisturbed; no absolute pressure.
 const n=view(run(inp({rankingMonth:'2028-06'}),SET,c),'all-connected');
 n.monthly.forEach(m=>{
  const off=[[1500,sA('2029-12')],[2500,sB('2029-12')],[4000,sC('2029-12')]].reduce((s,[d,sc])=>s+hand(rock,d,sc,endH(m.month)),0);
  assert.equal(m.bottomholePsia,null);assert.ok(Math.abs(m.offsetsPsi-off)<1e-9*Math.max(1,off));
 });
});

test('limit month: a blocked subject month gives no number for that or later months (never treated as 0)',()=>{
 // Fictional low-k rock: t_D at r_w over 31 days just passes 100, over 28 days it does not, so the subject's first rate change
 // (February 2029, from 0) is blocked. Its shown own rise is 0 before that; one offset at the 200 ft floor keeps injecting.
 const rk={...ROCK,k:0.034,phi:0.4,rw:2,cf:1e-4};
 const s=subject({rock:rk,schedule:sched('2028-01',months('2028-01',24).map((_,i)=>i<13?0:30))});
 const tr0=buildTransientCase(CASE,s),bi=tr0.monthly.findIndex(m=>m.blocked!==null);
 assert.equal(tr0.monthly[bi]?.month,'2029-02','fixture must block from February 2029');
 assert.ok(tr0.monthly.slice(0,bi).every(m=>m.risePsi===0));
 const PF=pkg({id:'pf',uic:X,start:'2027-06',end:'2028-06',def:3000}),choice=ch(X,{distanceFt:200,after:{kind:'typed',rateStbd:100}});
 const rock=rockOf(tr0),sf=sch('2027-06','2028-06',100,100,'2029-12'),R=endH('2027-12');
 const P=m=>2000+hand(rock,200,sf,endH(m))-hand(rock,200,sf,R);
 // A limit between the last shown month and the next month: a skip-or-zero implementation would report 2029-02 or later.
 const limit=(P('2029-01')+P('2029-03'))/2;
 assert.ok(P('2029-01')<limit&&limit<P('2029-03')&&limit<=10000,String([P('2029-01'),limit,P('2029-03')]));
 const c=mkCase(limit),tr=buildTransientCase(c,s);
 const r=run(inp({subject:s,offsets:[choice],tRef:'2027-12',rankingMonth:'2028-06'}),setOf(PF),c);
 for(const name of ['all-connected','your-selection'])assert.equal(view(r,name).limitMonth,null,name);
 assert.equal(view(r,'none').limitMonth,tr.firstMonthAtLimit);assert.equal(tr.limitStatus,'not-determined');
 assert.deepEqual(view(r,'all-connected').removalEffects,[{uic:X,limitMonth:tr.firstMonthAtLimit,note:`the subject's own result is not shown from 2029-02 (${tr.monthly[bi].blocked})`}]);
 assert.ok(r.warnings.some(w=>/not determined/.test(w)&&/2029-02/.test(w)),JSON.stringify(r.warnings));
 for(const name of ['all-connected','none'])view(r,name).monthly.forEach((m,i)=>{
  if(i>=bi){assert.equal(m.ownRisePsi,null);assert.equal(m.bottomholePsia,null);}
  else{assert.equal(m.ownRisePsi,0);assert.equal(typeof m.bottomholePsia,'number');}
 });
});

test('no counted offset: the subject alone matches #7, including a month blocked above 10,000 psia that #7 counts as reached',()=>{
 const c=mkCase(10000),s=subject({rock:{...ROCK,k:2.7},schedule:sched('2028-01',months('2028-01',24).map((_,i)=>1000+i*250))});
 const tr=buildTransientCase(c,s);
 assert.ok(tr.monthly.some(m=>m.blocked!==null)&&tr.firstMonthAtLimit!==null,'fixture must block above 10,000 psia');
 const r=run(inp({subject:s,offsets:[chA({connected:false})],tRef:'2027-12',rankingMonth:'2028-06'}),setOf(PA),c);
 assert.equal(view(r,'your-selection').limitMonth,tr.firstMonthAtLimit);
 assert.equal(view(r,'none').limitMonth,tr.firstMonthAtLimit);
 assert.deepEqual(view(r,'all-connected').removalEffects,[{uic:A,limitMonth:tr.firstMonthAtLimit,note:null}]);
});

test('limit month: a #7 block above 10,000 psia counted as reached stays reached when counted offsets add at least limit - 10,000',()=>{
 const c=mkCase(10000),s=subject({rock:{...ROCK,k:0.5},schedule:sched('2028-01',[20,20,20,...Array(21).fill(100000)])});
 const tr=buildTransientCase(c,s);
 assert.equal(tr.firstMonthAtLimit,'2028-04');assert.notEqual(tr.monthly[3].blocked,null);
 const rock=rockOf(tr),R=endH('2027-12'),T4=endH('2028-04');
 // Positive offset (A keeps injecting): views agree with none and with #7; removal effects consistent.
 assert.ok(hand(rock,1500,sA('2028-04'),T4)-hand(rock,1500,sA('2028-04'),R)>0);
 const r=run(inp({subject:s,offsets:[chA()],tRef:'2027-12',rankingMonth:'2028-03'}),setOf(PA),c);
 for(const name of ['all-connected','your-selection','none'])assert.equal(view(r,name).limitMonth,'2028-04',name);
 assert.deepEqual(view(r,'all-connected').removalEffects,[{uic:A,limitMonth:'2028-04',note:null}]);
 assert.ok(!r.warnings.some(w=>/not determined/.test(w)),JSON.stringify(r.warnings));
 // Negative offset (B shut in, close by): the sum is below limit - 10,000, so the month stays undetermined.
 const nb=hand(rock,100,sB('2028-04'),T4)-hand(rock,100,sB('2028-04'),R);
 assert.ok(nb<0,String(nb));
 const q=run(inp({subject:s,offsets:[chB({distanceFt:100})],tRef:'2027-12',rankingMonth:'2028-03'}),setOf(PB),c);
 assert.equal(view(q,'all-connected').limitMonth,null);assert.equal(view(q,'none').limitMonth,'2028-04');
 assert.deepEqual(view(q,'all-connected').removalEffects,[{uic:B,limitMonth:'2028-04',note:null}]);
 assert.ok(q.warnings.some(w=>/all-connected: limit month not determined/.test(w)),JSON.stringify(q.warnings));
});

test('fix round 1 minors: connected label, null total when nothing counted, low > high refused, stated-extent note',()=>{
 const r=run(inp({offsets:[chA(),chB({connected:false}),chC()]}));
 assert.ok(rowOf(view(r,'your-selection'),A).labels.includes('connected (assumed)'));
 assert.ok(!rowOf(view(r,'your-selection'),B).labels.includes('connected (assumed)'));
 assert.ok(rowOf(view(r,'all-connected'),B).labels.includes('connected (assumed)'));
 const none=run(inp({offsets:[chA({connected:false}),chB({connected:false}),chC({connected:false})]}));
 assert.equal(view(none,'your-selection').totalPsi,null);assert.equal(view(none,'none').totalPsi,null);
 assert.equal(view(none,'your-selection').shareNote,null);
 refused(()=>run(inp({sensitivity:{k:{low:100,high:25}}})),/Sensitivity Permeability k: low must not exceed high/);
 refused(()=>run(inp({sensitivity:{cf:{low:1e-5,high:1e-6}}})),/c_f: low must not exceed high/);
 refused(()=>run(inp({sensitivity:{distance:{[A]:{low:1800,high:1200}}}})),new RegExp('distance for UIC '+A+': low must not exceed high'));
 const w=run(inp({offsets:[chA({connected:false}),chB(),chC()],subject:subject({boundary:{kind:'infinite',statedExtentFt:5000}})})).warnings;
 assert.ok(w.some(x=>x.includes(A)&&x.endsWith(' (counted in all-connected only)')),JSON.stringify(w));
 assert.ok(w.some(x=>x.includes(B)&&!x.includes('counted in all-connected only')),JSON.stringify(w));
 assert.throws(()=>startH('2019-12'),/before ORIGIN/);
});

test('Review Focus 5: t_ref, partial history and shut-in after the window give negative psi, direction unknown, mixed signs',()=>{
 const r=run(inp({tRef:'2027-12',rankingMonth:'2028-06'})),v=view(r,'all-connected'),b=rowOf(v,B);
 assert.ok(b.addedPsi<0,String(b.addedPsi));
 assert.equal(b.status,'partial-history');assert.equal(b.directionUnknown,true);assert.equal(b.lowerBound,false);
 assert.ok(b.labels.some(l=>/direction unknown/.test(l)));
 assert.equal(v.shareNote,'share not shown: mixed signs');assert.ok(v.rows.every(x=>x.share===null));
 assert.ok(rowOf(v,A).addedPsi>0);
 // Without t_ref, partial history is a lower bound and shares are shown.
 const n=run(inp()),nv=view(n,'all-connected'),nb=rowOf(nv,B);
 assert.equal(nb.lowerBound,true);assert.equal(nb.directionUnknown,false);assert.ok(nb.labels.some(l=>/lower bound/.test(l)));
 assert.equal(nv.shareNote,null);
 assert.ok(Math.abs(nv.rows.reduce((s,x)=>s+x.share,0)-1)<1e-12);
 for(const x of nv.rows)assert.ok(rel(x.share,x.addedPsi/nv.totalPsi)<1e-12);
});

test('labels and order: excluded reads EXCLUDED with null psi; numbered rows by signed psi, highest first',()=>{
 const r=run(inp({offsets:[chA({connected:false}),chB(),chC()],tRef:'2027-12',rankingMonth:'2028-06'}));
 const all=view(r,'all-connected').rows.map(x=>x.addedPsi);
 assert.deepEqual(all,[...all].sort((a,b)=>b-a));
 assert.ok(all.some(x=>x<0));
 const sel=view(r,'your-selection').rows;
 assert.equal(sel[sel.length-1].uic,A);assert.equal(sel[sel.length-1].addedPsi,null);assert.equal(sel[sel.length-1].status,'excluded');
 assert.ok(sel[sel.length-1].labels.includes(ix.EXCLUDED));
 const nums=sel.filter(x=>x.addedPsi!==null).map(x=>x.addedPsi);assert.deepEqual(nums,[...nums].sort((a,b)=>b-a));
 for(const x of sel)assert.ok(x.labels.some(l=>/distance.*assumed/.test(l)),JSON.stringify(x.labels));
});

test('excluded well with invalid choices: incomplete only in all-connected; your-selection unaffected',()=>{
 const r=run(inp({offsets:[chA(),chB({connected:false,after:{kind:'hold-average',lastN:0}}),chC()]}));
 const b=rowOf(view(r,'all-connected'),B);
 assert.equal(b.status,'incomplete');assert.equal(b.addedPsi,null);assert.equal(view(r,'all-connected').status,'incomplete');
 assert.equal(view(r,'your-selection').status,'complete');assert.equal(rowOf(view(r,'your-selection'),B).status,'excluded');
});

test('not felt yet: distance beyond the radius of investigation is information only; the number is still shown',()=>{
 const PZ=pkg({id:'pz',uic:Z,start:'2028-01',end:'2028-03',def:30000});
 const r=run(inp({offsets:[ch(Z,{distanceFt:200000,prior:{startMonth:'2027-12',rateStbd:1000}})],rankingMonth:'2028-03'}),setOf(PZ));
 const z=rowOf(view(r,'all-connected'),Z);
 assert.equal(z.status,'not-felt-yet');assert.equal(typeof z.addedPsi,'number');assert.ok(z.labels.some(l=>/not felt yet/.test(l)));
});

test('indistinguishable: two offsets at 1,000 and 1,050 ft with distance ±20%',()=>{
 const PX=pkg({id:'px',uic:X,start:'2027-06',end:'2028-06',def:60000}),PY=pkg({id:'py',uic:Y,start:'2027-06',end:'2028-06',def:60000}),PZ=pkg({id:'pz',uic:Z,start:'2027-06',end:'2028-06',def:60000});
 const r=run(inp({offsets:[ch(X,{distanceFt:1000}),ch(Y,{distanceFt:1050}),ch(Z,{distanceFt:20000})],rankingMonth:'2028-03',
  sensitivity:{distance:{[X]:{low:800,high:1200},[Y]:{low:840,high:1260}}}}),setOf(PX,PY,PZ));
 assert.deepEqual(r.indistinguishable,[[X,Y]]);
 const dx=r.sensitivity.find(s=>s.factor===`distance:${X}`);
 assert.ok(dx);assert.equal(dx.rankChanged,true);
 const base=rowOf(view(r,'all-connected'),X).addedPsi;
 assert.ok(dx.rangeByUic[X].low<=base&&base<=dx.rangeByUic[X].high);
 assert.ok(r.warnings.some(w=>/order not distinguishable/.test(w)));
 // k and c_f ranges: reported for each numbered well, low <= high.
 const k=run(inp({sensitivity:{k:{low:25,high:100},cf:{low:1e-6,high:1e-5}}}));
 assert.deepEqual(k.sensitivity.map(s=>s.factor),['k','cf']);
 for(const s of k.sensitivity)for(const u of [A,B,Cw])assert.ok(s.rangeByUic[u].low<=s.rangeByUic[u].high);
 refused(()=>run(inp({sensitivity:{k:{low:0.001,high:100}}})),/k/);
 refused(()=>run(inp({sensitivity:{distance:{'000000999':{low:800,high:1200}}}})),/000000999/);
});

test('distance floor and ceiling are refused, naming the UIC',()=>{
 refused(()=>run(inp({offsets:[chA({distanceFt:30}),chB(),chC()]})),new RegExp(`${A}.*100 · r_w`));
 refused(()=>run(inp({offsets:[chA({distanceFt:264001}),chB(),chC()]})),new RegExp(A));
 refused(()=>run(inp({sensitivity:{distance:{[A]:{low:10,high:2000}}}})),new RegExp(A));
 assert.doesNotThrow(()=>run(inp({offsets:[chA({distanceFt:35}),chB(),chC()]})));
});

test('other refusals: duplicate, unknown or unanswered UICs; ranking month before a connected window',()=>{
 refused(()=>run(inp({offsets:[chA(),chA(),chB(),chC()]})),new RegExp(A));
 refused(()=>run(inp({offsets:[chA(),chB(),chC(),ch('000000999')]})),/000000999/);
 refused(()=>run(inp({offsets:[chA(),chB()]})),new RegExp(Cw));
 refused(()=>run(inp({rankingMonth:'2027-03'})),new RegExp(A));
 refused(()=>run(inp({rankingMonth:'2028-3'})),/ranking month/i);
});

test('warnings: closed subject boundary and stated extent',()=>{
 const r=run(inp({subject:subject({boundary:{kind:'closed',re:3000}})}));
 assert.ok(r.warnings.includes('interference uses the no-edge assumption'));
 const s=run(inp({subject:subject({boundary:{kind:'infinite',statedExtentFt:5000}})}));
 assert.ok(s.warnings.some(w=>w.includes(A)&&/5,000 ft/.test(w)),JSON.stringify(s.warnings));
 assert.ok(!run(inp()).warnings.some(w=>/no-edge|extent/.test(w)));
});

test('defaultRankingMonth is the last month covered by every loaded package',()=>{
 assert.equal(ix.defaultRankingMonth(SET),'2027-12');
});

test('banned words absent from all text; deterministic; inputs not mutated',()=>{
 const i=inp({tRef:'2027-12',rankingMonth:'2028-06',offsets:[chA(),chB({connected:false}),chC()],sensitivity:{k:{low:25,high:100},distance:{[A]:{low:1200,high:1800}}}});
 const before=structuredClone(i);
 const a=run(i),b=run(i);
 assert.deepEqual(a,b);assert.deepEqual(i,before);
 const texts=[];const walk=v=>{if(typeof v==='string')texts.push(v);else if(v&&typeof v==='object')for(const x of Object.values(v))walk(x);};
 const {inputs,...rest}=a;walk(rest);
 assert.ok(texts.length>20);
 for(const t of texts)assert.doesNotMatch(t,BANNED);
 for(const t of [ix.CLOSING_8,ix.RANKING_LABEL,ix.EXCLUDED,ix.REMOVAL_LABEL])assert.doesNotMatch(t,BANNED);
});

// ---- Final fix wave (fictional data only) ----
const caseAt=(reservoirPsia,limitPsia)=>buildDisposalCase({caseName:'Fictional interference case',demand:{id:'synthetic-demand/1',origin:'synthetic',content:'fictional',monthly:[{month:'2028-01',demandBbl:60000}],evidence:{fixture:'fictional'}},
 wells:[{...WELL,reservoirPsia,limitPsia}],fluid:{referencePressurePsia:2000,temperatureF:180,salinityWtPercent:5},comparison:{wellId:'FICTIONAL-A',injectivityMultiplier:0.5,innerDiameterInches:5,availability:0.8}});
const LOW_K={k:5,h:20,phi:0.15,cf:4e-6,rw:0.35,skin:0};
// The reviewer's probe1 inputs: P_i 9,000, limit 9,900, two connected offsets, t_ref 2027-12.
const probe1=(endB='2030-06',afterB={kind:'shut-in'})=>{
 const c=caseAt(9000,9900),s=subject({rock:{...LOW_K},schedule:sched('2028-01',Array(24).fill(100))});
 const set=setOf(pkg({id:'pa',uic:A,start:'2027-06',end:'2030-06',def:360000}),pkg({id:'pb',uic:B,start:'2027-06',end:endB,def:30000}));
 const i=inp({subject:s,tRef:'2027-12',rankingMonth:'2028-06',offsets:[ch(A,{distanceFt:500,after:{kind:'shut-in'}}),ch(B,{distanceFt:3000,after:afterB})]});
 return {c,s,set,i,tr:buildTransientCase(c,s),r:run(i,set,c)};
};

test('I1: a view bottomhole outside 100–10,000 psia is not shown from that month on, with the #7 block reason; the limit month is unchanged',()=>{
 const {r,tr}=probe1();
 assert.equal(tr.limitStatus,'not-reached');assert.ok(tr.monthly.every(m=>m.blocked===null));
 for(const name of ['all-connected','your-selection']){
  const v=view(r,name),bi=v.monthly.findIndex(m=>m.blocked!==null);
  assert.ok(bi>0,name+': fixture must leave the range');
  v.monthly.forEach((m,i)=>{
   if(i>=bi){assert.equal(m.bottomholePsia,null,m.month);assert.equal(m.blocked,PVT_BLOCK,m.month);assert.equal(m.offsetsPsi,null,m.month);}
   else{assert.equal(m.blocked,null,m.month);assert.ok(m.bottomholePsia>=100&&m.bottomholePsia<=10000,`${m.month} ${m.bottomholePsia}`);}
   if(i<bi)assert.equal(typeof m.offsetsPsi,'number');assert.equal(typeof m.ownRisePsi,'number');
  });
  assert.equal(v.limitMonth,'2028-01',name);
 }
 // The subject alone mirrors #7, row for row, including its block field.
 const n=view(r,'none');
 assert.deepEqual(n.monthly.map(m=>[m.bottomholePsia,m.blocked]),tr.monthly.map(m=>[m.bottomholePsia,m.blocked]));
});

test('I1: a combined falloff below 100 psia before any crossing blocks the view and leaves the limit month not determined (as #7)',()=>{
 const c=caseAt(400,1500),s=subject({rock:{...LOW_K},schedule:sched('2028-01',months('2028-01',24).map((_,i)=>i<12?0:300))});
 const tr=buildTransientCase(c,s);
 assert.equal(tr.limitStatus,'reached');assert.ok(tr.monthly.every(m=>m.blocked===null));
 const set=setOf(pkg({id:'pa',uic:A,start:'2027-06',end:'2027-12',def:9000}));
 const r=run(inp({subject:s,tRef:'2027-12',rankingMonth:'2028-01',offsets:[ch(A,{distanceFt:500,after:{kind:'shut-in'}})]}),set,c);
 const v=view(r,'all-connected'),bi=v.monthly.findIndex(m=>m.blocked!==null);
 assert.equal(v.monthly[bi]?.month,'2028-03','fixture: the combined pressure drops below 100 psia in 2028-03');
 assert.ok(v.monthly.slice(bi).every(m=>m.bottomholePsia===null&&m.blocked===PVT_BLOCK));
 // A search that walked past the block would report a 2029 month from hidden pressures.
 assert.equal(v.limitMonth,null);
 assert.ok(r.warnings.some(w=>w.startsWith('all-connected: limit month not determined')&&w.includes('2028-03')&&w.includes(PVT_BLOCK)),JSON.stringify(r.warnings));
 assert.equal(view(r,'none').limitMonth,tr.firstMonthAtLimit);
});

test('I2: a removal effect carries the not-determined reason; null with no note only when the search completed',()=>{
 // probe1b: UIC B has no after-window choice past its window, so any search that counts B is not determined.
 const {r}=probe1('2028-12',null);
 const v=view(r,'all-connected');
 const noA=v.removalEffects.find(e=>e.uic===A),noB=v.removalEffects.find(e=>e.uic===B);
 assert.equal(noA.limitMonth,null);assert.equal(typeof noA.note,'string');
 assert.match(noA.note,/^UIC 000000419 has no complete schedule through 2029-12/);
 assert.doesNotMatch(noA.note,/^limit month not determined/);
 assert.deepEqual(noB,{uic:B,limitMonth:'2028-01',note:null});
 // Removing the only counted offset leaves the subject alone: #7's own not-determined reason is carried.
 const rk={...ROCK,k:0.034,phi:0.4,rw:2,cf:1e-4};
 const s=subject({rock:rk,schedule:sched('2028-01',months('2028-01',24).map((_,i)=>i<13?0:30))});
 const PF=pkg({id:'pf',uic:X,start:'2027-06',end:'2028-06',def:3000});
 const q=run(inp({subject:s,offsets:[ch(X,{distanceFt:200,after:{kind:'typed',rateStbd:100}})],tRef:'2027-12',rankingMonth:'2028-06'}),setOf(PF),caseAt(2000,9000));
 const e=view(q,'all-connected').removalEffects[0];
 assert.equal(e.limitMonth,null);assert.match(e.note,/the subject's own result is not shown from 2029-02/);
 // A completed search with no crossing: null and no note.
 const z=run(inp({tRef:'2027-12',rankingMonth:'2028-06'}),SET,caseAt(2000,9000));
 for(const x of view(z,'all-connected').removalEffects){assert.equal(x.limitMonth,null);assert.equal(x.note,null);}
});

test('M1: a view counting a partial-history well has a note: direction unknown with t_ref, lower bound without',()=>{
 const w=run(inp({tRef:'2027-12',rankingMonth:'2028-06'}));
 assert.ok(rowOf(view(w,'all-connected'),B).directionUnknown);
 assert.deepEqual(view(w,'all-connected').notes,[ix.PARTIAL_NOTE_DIRECTION]);
 assert.equal(ix.PARTIAL_NOTE_DIRECTION,'includes partial-history wells; direction unknown');
 const n=run(inp());
 assert.deepEqual(view(n,'all-connected').notes,[ix.PARTIAL_NOTE_LOWER]);
 assert.equal(ix.PARTIAL_NOTE_LOWER,'includes partial-history wells; lower bound');
 // The partial-history well not counted (the others have a prior rate, so are not partial): no note.
 const prior={startMonth:'2026-01',rateStbd:1000};
 const sel=run(inp({tRef:'2027-12',rankingMonth:'2028-06',offsets:[chA({prior}),chB({connected:false}),chC({prior})]}));
 assert.ok(view(sel,'your-selection').rows.every(x=>!x.directionUnknown&&!x.lowerBound));
 assert.deepEqual(view(sel,'all-connected').notes,[ix.PARTIAL_NOTE_DIRECTION]);
 assert.deepEqual(view(sel,'your-selection').notes,[]);assert.deepEqual(view(sel,'none').notes,[]);
});

test('ruling: rows in the none view read "not counted in this view (subject alone)", never EXCLUDED',()=>{
 assert.equal(ix.NOT_COUNTED,'not counted in this view (subject alone)');
 const r=run(inp({offsets:[chA(),chB({connected:false}),chC()],tRef:'2027-12',rankingMonth:'2028-06'}));
 for(const x of view(r,'none').rows){
  assert.equal(x.status,'not-counted');assert.equal(x.addedPsi,null);assert.equal(x.share,null);
  assert.ok(x.labels.includes(ix.NOT_COUNTED));assert.ok(!x.labels.includes(ix.EXCLUDED));
 }
 // EXCLUDED stays for the user's not-connected well in your-selection.
 const b=rowOf(view(r,'your-selection'),B);assert.equal(b.status,'excluded');assert.ok(b.labels.includes(ix.EXCLUDED));
});

test('M3: tRefMessages is the core\'s own pre-run wording for t_ref and the ranking month',()=>{
 assert.equal(typeof ix.tRefMessages,'function');
 assert.deepEqual(ix.tRefMessages(null,'2028-01','2028-03'),[]);
 assert.deepEqual(ix.tRefMessages('2027-12','2028-01','2028-03'),[]);
 const m=ix.tRefMessages('2027-11','2028-01','2027-11');
 assert.equal(m.length,2);
 assert.equal(m[0],'The subject\'s rate schedule must start the month after the pressure-as-of month t_ref (2027-11): expected 2027-12, got 2028-01');
 assert.equal(m[1],'Ranking month 2027-11 must be after the pressure-as-of month t_ref (2027-11)');
 assert.throws(()=>run(inp({tRef:'2027-11'})),e=>e.message.includes(m[0]));
});
