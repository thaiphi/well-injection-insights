// Writes the fictional pressure-support context example and its exact byte pin. Never touches other fixtures.
// Usage: node scripts/create-pressure-support-example.mjs [--out <dir>]  (default data/pressure-support)
import {mkdirSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {join} from 'node:path';import {fileURLToPath} from 'node:url';

const SEED=20261012,FIXTURE_VERSION=1,VERSION='pressure-support-input/1';
const args=process.argv.slice(2),outAt=args.indexOf('--out');
const out=outAt>=0?args[outAt+1]:fileURLToPath(new URL('../data/pressure-support/',import.meta.url));
if(!out) throw new Error('--out requires a directory');
function random(seed) {let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
const rng=random(SEED);
const months=Array.from({length:24},(_,i)=>`${2024+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`);
const OBS='PS-DEMO-SYN',ASSUMED='PS-DEMO-ASSUMED';
// Explicit pinned cases; every other value is an illustrative deterministic sequence, not a response prediction.
const overrides={
  'PS-DEMO-P01|2024-02':{oil:29000,water:7250},'PS-DEMO-P01|2024-06':{water:null},'PS-DEMO-P02|2024-09':{oil:0,water:0},
  'PS-DEMO-I01|2024-02':{volume:87000},'PS-DEMO-I02|2024-02':{volume:58000},'PS-DEMO-I02|2024-08':{volume:null}};
const pick=(value,override,key)=>override&&key in override?override[key]:value;

const producerMonthly=[['PS-DEMO-P01',30500,0.02,0.22,0.010],['PS-DEMO-P02',21000,0.015,0.35,0.008]].flatMap(([producerId,base,decline,cut,cutStep])=>
  months.map((month,i)=>{
    const o=overrides[`${producerId}|${month}`];
    const oil=Math.round(base*Math.exp(-decline*i)*(1+(rng()-0.5)*0.08));
    const water=Math.round(oil*(cut+cutStep*i)*(1+(rng()-0.5)*0.1));
    return {rowId:`PM-${producerId.slice(8)}-${month}`,sourceId:OBS,producerId,month,oilVolumeBbl:pick(oil,o,'oil'),waterVolumeBbl:pick(water,o,'water'),
      volumeUnit:'STB',basis:'calendar-month',classification:'synthetic'};
  }));
const injectorMonthly=[['PS-DEMO-I01',90000],['PS-DEMO-I02',60000]].flatMap(([injectorId,base])=>months.map(month=>{
  const o=overrides[`${injectorId}|${month}`],volume=Math.round(base*(1+(rng()-0.5)*0.1));
  return {rowId:`IM-${injectorId.slice(8)}-${month}`,sourceId:OBS,injectorId,month,volumeBbl:pick(volume,o,'volume'),
    volumeUnit:'bbl',basis:'calendar-month',classification:'synthetic'};
}));
const associations=[['PS-DEMO-P01','PS-DEMO-I01',1.5],['PS-DEMO-P01','PS-DEMO-I02',3],['PS-DEMO-P02','PS-DEMO-I01',3],['PS-DEMO-P02','PS-DEMO-I02',1.5]]
  .map(([producerId,injectorId,distance])=>({rowId:`AS-${producerId.slice(8)}-${injectorId.slice(8)}`,sourceId:ASSUMED,producerId,injectorId,
    distance,distanceUnit:'mi',origin:'assumed',classification:'synthetic'}));
const events=[['PS-DEMO-F01','PS-DEMO-P01','2024-04-15'],['PS-DEMO-F02','PS-DEMO-P02','2025-03-09',],['PS-DEMO-F03','PS-DEMO-P01','2026-01-10']]
  .map(([eventId,producerId,date])=>({rowId:`EV-${eventId.slice(8)}`,sourceId:OBS,eventId,producerId,date,kind:'frac',
    citation:`Synthetic example event ${eventId}; not a public or customer record`,classification:'synthetic',
    uncertainty:'Fictional date for demonstration; no treatment response is implied'}));
const dataset={version:VERSION,fixtureVersion:FIXTURE_VERSION,seed:SEED,datasetId:`pressure-support-demo/seed-${SEED}/v${FIXTURE_VERSION}`,
  name:'Synthetic pressure-support context example',classification:'synthetic',coverage:{firstMonth:months[0],lastMonth:months.at(-1)},
  sources:[{sourceId:OBS,classification:'synthetic',description:'Fictional producer, injector and frac-event observations generated for the demo'},
    {sourceId:ASSUMED,classification:'assumed',description:'Declared fictional producer/injector associations and assumed distances; not GIS or hydraulic evidence'}],
  producers:[{producerId:'PS-DEMO-P01',name:'Fictional producer P01',classification:'synthetic'},{producerId:'PS-DEMO-P02',name:'Fictional producer P02',classification:'synthetic'}],
  injectors:[{injectorId:'PS-DEMO-I01',name:'Fictional injector I01',classification:'synthetic'},{injectorId:'PS-DEMO-I02',name:'Fictional injector I02',classification:'synthetic'}],
  producerMonthly,injectorMonthly,associations,events};
const bytes=Buffer.from(JSON.stringify(dataset,null,2)+'\n','utf8');
const pin={file:'example.json',datasetId:dataset.datasetId,version:VERSION,fixtureVersion:FIXTURE_VERSION,seed:SEED,
  sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,coverage:dataset.coverage,
  classifications:{dataset:'synthetic',observations:'synthetic',events:'synthetic',associationOrigin:'assumed'},
  counts:Object.fromEntries(['producers','injectors','producerMonthly','injectorMonthly','associations','events'].map(k=>[k,dataset[k].length])),
  units:{producerVolume:'STB',injectorVolume:'bbl',distance:'mi',basis:'calendar-month'}};
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'example.json'),bytes);writeFileSync(join(out,'pin.json'),JSON.stringify(pin,null,2)+'\n');
console.log(`${pin.datasetId} ${pin.sha256} ${pin.bytes} bytes`);
