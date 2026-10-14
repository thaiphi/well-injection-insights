import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validatePressureContext,buildPressureContext,loadPressureContext,CONTEXT_INPUT_VERSION,CONTEXT_METHOD_VERSION} from '../dist/pressureSupport.js';
import {daysInMonth} from '../dist/planning.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const bytes=readFileSync(join(root,'data/pressure-support/example.json'));
const pin=JSON.parse(readFileSync(join(root,'data/pressure-support/pin.json'),'utf8'));
const example=()=>JSON.parse(bytes.toString('utf8'));
const P1='PS-DEMO-P01',P2='PS-DEMO-P02',I1='PS-DEMO-I01',I2='PS-DEMO-I02';
const ALL={producerId:P1,injectorIds:[I1,I2],firstMonth:'2024-01',lastMonth:'2025-12'};
const SHA='0'.repeat(64);
const build=(raw,selection=ALL)=>buildPressureContext(validatePressureContext(raw,{sha256:SHA}),selection);
const month=(result,m)=>result.monthly.find(r=>r.month===m);
const blocked=(result)=>{assert.equal(result.ready,false);assert.ok(result.reasons.length>0);assert.deepEqual(result.monthly,[]);};
/** Minimal independent dataset built from literal values; no mocks of calculation code. */
function small() {
  const src='S1',p=(rowId,producerId,month,oil,water)=>({rowId,sourceId:src,producerId,month,oilVolumeBbl:oil,waterVolumeBbl:water,volumeUnit:'STB',basis:'calendar-month',classification:'synthetic'});
  const i=(rowId,injectorId,month,volume)=>({rowId,sourceId:src,injectorId,month,volumeBbl:volume,volumeUnit:'bbl',basis:'calendar-month',classification:'synthetic'});
  return {version:'pressure-support-input/1',fixtureVersion:1,datasetId:'test/small',name:'Small',classification:'synthetic',
    coverage:{firstMonth:'2025-01',lastMonth:'2025-02'},
    sources:[{sourceId:src,classification:'synthetic',description:'Test literals'}],
    producers:[{producerId:'A',name:'A',classification:'synthetic'},{producerId:'B',name:'B',classification:'synthetic'}],
    injectors:[{injectorId:'X',name:'X',classification:'synthetic'},{injectorId:'Y',name:'Y',classification:'synthetic'}],
    producerMonthly:[p('pa1','A','2025-01',31000,0),p('pa2','A','2025-02',28000,0),p('pb1','B','2025-01',3100,3100),p('pb2','B','2025-02',2800,null)],
    injectorMonthly:[i('ix1','X','2025-01',1000),i('ix2','X','2025-02',2000),i('iy1','Y','2025-01',10),i('iy2','Y','2025-02',20)],
    associations:[{rowId:'a1',sourceId:src,producerId:'A',injectorId:'X',distance:1,distanceUnit:'mi',origin:'assumed',classification:'synthetic'},
      {rowId:'a2',sourceId:src,producerId:'A',injectorId:'Y',distance:2,distanceUnit:'mi',origin:'assumed',classification:'synthetic'},
      {rowId:'a3',sourceId:src,producerId:'B',injectorId:'X',distance:2,distanceUnit:'mi',origin:'assumed',classification:'synthetic'}],
    events:[{rowId:'e1',sourceId:src,eventId:'EV1',producerId:'A',date:'2025-02-10',kind:'frac',citation:'Test',classification:'synthetic'}]};
}
const SA={producerId:'A',injectorIds:['X','Y'],firstMonth:'2025-01',lastMonth:'2025-02'};

test('Fixture bytes match the exact pin and validate cleanly',async()=>{
  assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256);
  assert.equal(bytes.length,pin.bytes);
  const raw=example();
  assert.equal(raw.version,CONTEXT_INPUT_VERSION);assert.equal(pin.version,CONTEXT_INPUT_VERSION);
  assert.deepEqual([raw.fixtureVersion,raw.seed,pin.fixtureVersion,pin.seed],[1,20261012,1,20261012]);
  assert.deepEqual(raw.coverage,{firstMonth:'2024-01',lastMonth:'2025-12'});assert.deepEqual(pin.coverage,raw.coverage);
  assert.deepEqual(pin.counts,{producers:2,injectors:2,producerMonthly:48,injectorMonthly:48,associations:4,events:3});
  assert.deepEqual(pin.units,{producerVolume:'STB',injectorVolume:'bbl',distance:'mi',basis:'calendar-month'});
  assert.equal(raw.classification,'synthetic');
  assert.deepEqual(pin.classifications,{dataset:'synthetic',observations:'synthetic',events:'synthetic',associationOrigin:'assumed'});
  for(const r of [...raw.producerMonthly,...raw.injectorMonthly,...raw.events,...raw.associations]) assert.equal(r.classification,'synthetic');
  assert.ok(raw.associations.every(a=>a.origin==='assumed'&&a.distanceUnit==='mi'));
  const v=await loadPressureContext(new Uint8Array(bytes));
  assert.equal(v.sha256,pin.sha256);assert.deepEqual(v.issues,[]);assert.equal(v.datasetBlocked,false);
  for(const id of [P1,P2]) assert.deepEqual(v.producers[id],{ready:true,reasons:[]});
  for(const id of [I1,I2]) assert.deepEqual(v.injectors[id],{ready:true,reasons:[]});
});

test('Fictional identities never reuse planning producers, APIs or UICs',()=>{
  const raw=example(),text=bytes.toString('utf8');
  assert.deepEqual(raw.producers.map(p=>p.producerId),[P1,P2]);assert.deepEqual(raw.injectors.map(i=>i.injectorId),[I1,I2]);
  assert.ok(!/FICTIONAL-PROD|UIC\d|\b42-?\d{3}-?\d{5}\b|\b\d{9,}\b/.test(text));
  assert.deepEqual(raw.associations.map(a=>[a.producerId,a.injectorId,a.distance]),[[P1,I1,1.5],[P1,I2,3],[P2,I1,3],[P2,I2,1.5]]);
  assert.deepEqual(raw.events.map(e=>[e.producerId,e.date]),[[P1,'2024-04-15'],[P2,'2025-03-09'],[P1,'2026-01-10']]);
});

test('February 2024 rates and water cut',async()=>{
  const result=buildPressureContext(await loadPressureContext(new Uint8Array(bytes)),ALL);
  assert.equal(result.ready,true);assert.equal(daysInMonth('2024-02'),29);
  const feb=month(result,'2024-02');
  assert.deepEqual([feb.oilRateStbd,feb.waterRateStbd,feb.liquidRateStbd,feb.waterCutPct,feb.completeInjectionVolumeBbl],[1000,250,1250,20,145000]);
  assert.deepEqual(Object.entries(feb.injectorVolumesBbl),[[I1,87000],[I2,58000]]);assert.deepEqual(feb.missingReasons,[]);
  assert.deepEqual(Object.keys(feb).sort(),['completeInjectionVolumeBbl','injectorVolumesBbl','liquidRateStbd','missingReasons','month','oilRateStbd','waterCutPct','waterRateStbd']);
  assert.equal(result.monthly.length,24);assert.equal(result.method.version,CONTEXT_METHOD_VERSION);
  assert.deepEqual(result.source,{datasetId:example().datasetId,sha256:pin.sha256});
  assert.deepEqual(result.selection,ALL);assert.equal(result.classification,'synthetic');assert.ok(result.assumptions.length>0);
});

test('January 31-day and February 2025 28-day conversions are independent',()=>{
  assert.deepEqual([daysInMonth('2025-01'),daysInMonth('2025-02')],[31,28]);
  const r=build(small(),SA);assert.equal(r.ready,true);
  assert.deepEqual(r.monthly.map(m=>[m.month,m.oilRateStbd,m.waterRateStbd,m.liquidRateStbd,m.waterCutPct,m.completeInjectionVolumeBbl]),
    [['2025-01',1000,0,1000,0,1010],['2025-02',1000,0,1000,0,2020]]);
});

test('Zero total liquid keeps zero rates but no water cut',()=>{
  const r=build(example(),{producerId:P2,injectorIds:[I1,I2],firstMonth:'2024-01',lastMonth:'2025-12'});
  const sep=month(r,'2024-09');
  assert.deepEqual([sep.oilRateStbd,sep.waterRateStbd,sep.liquidRateStbd,sep.waterCutPct],[0,0,0,null]);
  assert.ok(sep.missingReasons.some(s=>s.includes('Zero total liquid')&&s.includes(P2)&&s.includes('2024-09')));
});

test('Missing water stays missing while oil remains inspectable',()=>{
  const raw=example(),row=raw.producerMonthly.find(r=>r.producerId===P1&&r.month==='2024-06');
  assert.equal(row.waterVolumeBbl,null);assert.equal(typeof row.oilVolumeBbl,'number');
  const jun=month(build(raw),'2024-06');
  assert.equal(jun.oilRateStbd,row.oilVolumeBbl/30);
  assert.deepEqual([jun.waterRateStbd,jun.liquidRateStbd,jun.waterCutPct],[null,null,null]);
  assert.ok(jun.missingReasons.some(s=>s.includes('Water volume missing')&&s.includes(P1)&&s.includes('2024-06')));
  const b=build(small(),{producerId:'B',injectorIds:['X'],firstMonth:'2025-01',lastMonth:'2025-02'});
  assert.equal(b.ready,true);assert.equal(month(b,'2025-01').waterCutPct,50);assert.equal(month(b,'2025-02').oilRateStbd,100);
});

test('A missing selected injector period yields no total and names the injector/month',()=>{
  const raw=example(),aug=month(build(raw),'2024-08');
  const i1=raw.injectorMonthly.find(r=>r.injectorId===I1&&r.month==='2024-08').volumeBbl;
  assert.deepEqual(Object.entries(aug.injectorVolumesBbl),[[I1,i1],[I2,null]]);assert.equal(aug.completeInjectionVolumeBbl,null);
  assert.ok(aug.missingReasons.some(s=>s.includes(I2)&&s.includes('2024-08')));
  const only=month(build(raw,{...ALL,injectorIds:[I1]}),'2024-08');assert.equal(only.completeInjectionVolumeBbl,i1);
  const gap=small();gap.injectorMonthly=gap.injectorMonthly.filter(r=>r.rowId!=='iy2');
  const feb=month(build(gap,SA),'2025-02');
  assert.equal(feb.completeInjectionVolumeBbl,null);assert.deepEqual(Object.entries(feb.injectorVolumesBbl),[['X',2000],['Y',null]]);
  assert.ok(feb.missingReasons.some(s=>s.includes('No injection record')&&s.includes('Y')&&s.includes('2025-02')));
  const absent=small();absent.producerMonthly=absent.producerMonthly.filter(r=>r.rowId!=='pa2');
  const a=month(build(absent,SA),'2025-02');assert.equal(a.oilRateStbd,null);assert.ok(a.missingReasons.some(s=>s.includes('No producer record')));
});

test('Empty injector selection asks for an injector and never reports zero',()=>{
  const r=build(example(),{...ALL,injectorIds:[]});
  assert.equal(r.ready,true);assert.ok(r.reasons.includes('Select an associated injector'));
  assert.ok(r.monthly.every(m=>m.completeInjectionVolumeBbl===null&&m.missingReasons.includes('Select an associated injector')));
  assert.equal(month(r,'2024-02').oilRateStbd,1000);
});

test('Invalid selections are rejected, never dropped',()=>{
  const raw=small();raw.injectors.push({injectorId:'Z',name:'Z',classification:'synthetic'});
  for(const [selection,needle] of [
    [{...SA,injectorIds:['X','Q']},'Unknown injector Q'],
    [{...SA,injectorIds:['X','Z']},'Z is not associated'],
    [{...SA,producerId:'B',injectorIds:['X','Y']},'Y is not associated'],
    [{...SA,injectorIds:['Y','X']},'sorted'],[{...SA,injectorIds:['X','X']},'distinct'],
    [{...SA,producerId:'Q'},'Unknown producer Q'],
    [{...SA,firstMonth:'2024-12'},'coverage'],[{...SA,lastMonth:'2025-03'},'coverage'],
    [{...SA,firstMonth:'2025-02',lastMonth:'2025-01'},'order'],[{...SA,firstMonth:'2025-13'},'month'],[{...SA,lastMonth:'2025-2'},'month'],
    [{...SA,injectorIds:'X'},'injector'],[null,'Selection'],
  ]) {const r=build(raw,selection);blocked(r);assert.ok(r.reasons.some(s=>s.includes(needle)),`${needle}: ${r.reasons}`);}
});

test('Dataset blockers: malformed root/version, unsupported units and bases',()=>{
  const cases=[[null,'object'],[[],'object'],[{...small(),version:'pressure-support-input/2'},'version'],[{...small(),coverage:{firstMonth:'2025-02',lastMonth:'2025-01'}},'coverage'],[{...small(),events:undefined},'events']];
  const unit=small();unit.producerMonthly[2].volumeUnit='m3';cases.push([unit,'unit']);
  const basis=small();basis.injectorMonthly[0].basis='onstream-days';cases.push([basis,'basis']);
  const dist=small();dist.associations[0].distanceUnit='km';cases.push([dist,'unit']);
  const cls=small();cls.classification='public';cases.push([cls,'classification']);
  for(const [raw,needle] of cases) {
    const v=validatePressureContext(raw,{sha256:SHA});assert.equal(v.datasetBlocked,true);
    assert.ok(v.issues.some(i=>i.scope==='dataset'&&i.message.toLowerCase().includes(needle)),`${needle}: ${JSON.stringify(v.issues)}`);
    blocked(buildPressureContext(v,SA));
  }
  blocked(buildPressureContext(validatePressureContext(small()),SA));
  assert.ok(buildPressureContext(validatePressureContext(small()),SA).reasons.some(s=>s.includes('hash')));
});

test('Row defects block only affected producers or injectors',()=>{
  const independent=(raw,blockedSel,needle,okSel={producerId:'B',injectorIds:['X'],firstMonth:'2025-01',lastMonth:'2025-02'})=>{
    const r=build(raw,blockedSel);blocked(r);assert.ok(r.reasons.some(s=>s.includes(needle)),`${needle}: ${r.reasons}`);
    const ok=build(raw,okSel);assert.equal(ok.ready,true,`${needle} leaked: ${ok.reasons}`);assert.equal(ok.monthly.length,2);
  };
  let raw=small();raw.producerMonthly.push({...raw.producerMonthly[0],rowId:'pa1b',oilVolumeBbl:1});independent(raw,SA,'Conflicting');
  raw=small();raw.producerMonthly[0].oilVolumeBbl=-1;independent(raw,SA,'pa1');
  raw=small();raw.producerMonthly[0].oilVolumeBbl=Infinity;independent(raw,SA,'pa1');
  raw=small();raw.producerMonthly[0].oilVolumeBbl=NaN;independent(raw,SA,'pa1');
  raw=small();raw.producerMonthly[0].oilVolumeBbl='31000';independent(raw,SA,'pa1');
  raw=small();raw.producerMonthly[0].waterVolumeBbl=undefined;independent(raw,SA,'pa1');
  raw=small();raw.producerMonthly[1].month='2025-13';independent(raw,SA,'pa2');
  raw=small();raw.producerMonthly[1].month='2024-12';independent(raw,SA,'coverage');
  raw=small();raw.producerMonthly[1].sourceId='S9';independent(raw,SA,'S9');
  raw=small();raw.producerMonthly[1].rowId='pa1';independent(raw,SA,'Duplicate row');
  raw=small();raw.producers.push({producerId:'A',name:'A again',classification:'synthetic'});independent(raw,SA,'Duplicate producer');
  raw=small();raw.events.push({...raw.events[0],rowId:'e2'});independent(raw,SA,'Duplicate event');
  raw=small();raw.events[0].date='2025-02-29';independent(raw,SA,'2025-02-29');
  raw=small();raw.events[0].date='2025-2-10';independent(raw,SA,'2025-2-10');
  raw=small();raw.events[0].kind='refrac';independent(raw,SA,'kind');
  raw=small();raw.associations.push({...raw.associations[0],rowId:'a9'});independent(raw,SA,'Duplicate association');
  raw=small();raw.associations[1].distance=-2;independent(raw,SA,'a2',{...SA,injectorIds:['X']});
  // Injector defects block every selection containing it, not producers without it.
  raw=small();raw.injectorMonthly.push({...raw.injectorMonthly[2],rowId:'iy9',volumeBbl:11});independent(raw,SA,'Conflicting',{...SA,injectorIds:['X']});
  raw=small();raw.injectorMonthly[3].volumeBbl=-20;independent(raw,SA,'iy2',{...SA,injectorIds:['X']});
  raw=small();raw.injectors.push({injectorId:'Y',name:'Y again',classification:'synthetic'});independent(raw,SA,'Duplicate injector',{...SA,injectorIds:['X']});
  // Producer and injector IDs are separate namespaces.
  raw=small();raw.injectors[1].injectorId='A';for(const r of raw.injectorMonthly) if(r.injectorId==='Y') r.injectorId='A';raw.associations[1].injectorId='A';
  assert.equal(build(raw,{...SA,injectorIds:['A','X']}).ready,true);
  const v=validatePressureContext((()=>{const r=small();r.producerMonthly[0].oilVolumeBbl=-1;return r;})(),{sha256:SHA});
  assert.equal(v.producers.A.ready,false);assert.equal(v.producers.B.ready,true);assert.ok(v.issues.some(i=>i.rowId==='pa1'));
});

test('Arithmetic overflow never yields a plausible rate, percentage or total',()=>{
  let raw=small();raw.producerMonthly[0].oilVolumeBbl=Number.MAX_VALUE;raw.producerMonthly[0].waterVolumeBbl=Number.MAX_VALUE;
  let r=build(raw,SA);blocked(r);assert.ok(r.reasons.some(s=>s.includes('overflow')&&s.includes('2025-01')));
  raw=small();raw.injectorMonthly[0].volumeBbl=Number.MAX_VALUE;raw.injectorMonthly[2].volumeBbl=Number.MAX_VALUE;
  r=build(raw,SA);blocked(r);assert.ok(r.reasons.some(s=>s.includes('overflow')));
  assert.equal(build(raw,{...SA,injectorIds:['X']}).ready,true);
});

test('Events include every selected-producer event, inside or outside coverage',()=>{
  const r=build(example());
  assert.deepEqual(r.events.map(e=>[e.producerId,e.date,e.kind,e.withinCoverage,e.withinSelection]),[[P1,'2024-04-15','frac',true,true],[P1,'2026-01-10','frac',false,false]]);
  assert.ok(r.events.every(e=>e.rowId&&e.sourceId&&e.citation&&e.classification==='synthetic'));
  const late=build(example(),{...ALL,lastMonth:'2024-03'});assert.equal(late.events[0].withinSelection,false);assert.equal(late.events[0].withinCoverage,true);
  assert.deepEqual(build(example(),{...ALL,producerId:P2}).events.map(e=>e.date),['2025-03-09']);
});

test('Source rows retain original values and inputs stay unmodified',()=>{
  const raw=example(),before=JSON.stringify(raw),r=build(raw,{...ALL,injectorIds:[I2],lastMonth:'2024-02'});
  assert.equal(JSON.stringify(raw),before);
  assert.deepEqual(r.sourceRows.producerMonthly,raw.producerMonthly.filter(x=>x.producerId===P1&&x.month<='2024-02'));
  assert.deepEqual(r.sourceRows.injectorMonthly,raw.injectorMonthly.filter(x=>x.injectorId===I2&&x.month<='2024-02'));
  assert.deepEqual(r.sourceRows.associations,raw.associations.filter(x=>x.producerId===P1&&x.injectorId===I2));
  assert.deepEqual(r.sourceRows.events,raw.events.filter(x=>x.producerId===P1));
  assert.ok(Object.isFrozen(r.monthly[0]));
});

test('Generator reproduces the fixture and pin bytes exactly',()=>{
  const out=mkdtempSync(join(tmpdir(),'pressure-support-'));
  try {
    const run=spawnSync(process.execPath,[join(root,'scripts/create-pressure-support-example.mjs'),'--out',out],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    assert.ok(readFileSync(join(out,'example.json')).equals(bytes));
    assert.ok(readFileSync(join(out,'pin.json')).equals(readFileSync(join(root,'data/pressure-support/pin.json'))));
  } finally {rmSync(out,{recursive:true,force:true});}
});

test('Injector IDs such as __proto__ stay ordinary keys in monthly volumes',()=>{
  const raw=small();raw.injectors[1].injectorId='__proto__';for(const r of raw.injectorMonthly) if(r.injectorId==='Y') r.injectorId='__proto__';raw.associations[1].injectorId='__proto__';
  const r=build(raw,{...SA,injectorIds:['X','__proto__'].sort()});assert.equal(r.ready,true,String(r.reasons));
  const jan=month(r,'2025-01');
  assert.ok(Object.hasOwn(jan.injectorVolumesBbl,'__proto__'));assert.equal(jan.injectorVolumesBbl['__proto__'],10);
  assert.deepEqual(Object.keys(jan.injectorVolumesBbl).sort(),['X','__proto__'].sort());assert.equal(jan.completeInjectionVolumeBbl,1010);
  assert.equal(JSON.parse(JSON.stringify(jan.injectorVolumesBbl))['__proto__'],10);
  for(const id of ['constructor','toString']) {const v=small();v.injectors[1].injectorId=id;for(const x of v.injectorMonthly) if(x.injectorId==='Y') x.injectorId=id;v.associations[1].injectorId=id;
    const m=month(build(v,{...SA,injectorIds:['X',id].sort()}),'2025-02');assert.equal(m.injectorVolumesBbl[id],20);assert.equal(m.completeInjectionVolumeBbl,2020);}
});
