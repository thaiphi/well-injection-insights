import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {exhibitSvg} from '../dist/exhibitSvg.js';
import {buildExhibit} from '../dist/exhibit.js';
import {INJECTORS} from '../dist/engineering.js';
import {syntheticActuals,freezeForecast,planningCase} from '../dist/planning.js';

const unescape = value => value.replace(/&(amp|lt|gt|quot|apos);/g, (_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key]));
async function fixture(controls = {newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000}, publicArtifact = null) {
  const actuals=syntheticActuals(), frozen=freezeForecast(actuals);
  const injectors=INJECTORS.map(i=>({...i}));
  return buildExhibit({frozen,rows:planningCase(frozen,actuals,injectors,controls.newWellStart,controls.expansionMonth,controls.expansionStbd),injectors,controls,publicArtifact});
}
test('Standalone SVG is deterministic and retains exact exhibit including all curve and monthly values',async()=>{
  const e=await fixture(), svg=exhibitSvg(e);
  assert.equal(svg,exhibitSvg(e));
  const embedded=JSON.parse(unescape(svg.match(/<metadata id="technical-exhibit">([\s\S]*?)<\/metadata>/)[1]));
  assert.deepEqual(embedded,e);
  assert.match(svg,/Public history not loaded/);
  assert.match(svg,/Fictional assumed injectors/);
  assert.match(svg,/Bottomhole pressure \(psia\)/);
  assert.match(svg,/source-reported psi/);
  assert.ok(svg.includes(e.contentSha256));
  const series=[...svg.matchAll(/data-series="([^"]*)" data-values="([^"]*)"/g)].map(m=>({label:unescape(m[1]),values:JSON.parse(unescape(m[2]))}));
  assert.deepEqual(series[0].values,e.outputs.monthly.map((r,i)=>({x:i,y:r.demandBbl})));
  assert.deepEqual(series[1].values,e.outputs.monthly.map((r,i)=>({x:i,y:r.capacityBbl})));
  assert.deepEqual(series[2].values,e.outputs.monthly.map((r,i)=>({x:i,y:r.forecastBbl})));
  assert.deepEqual(series[3].values,e.outputs.monthly.map((r,i)=>({x:i,y:r.actualBbl})));
  e.outputs.injectors.forEach(i=>assert.deepEqual(series.find(s=>s.label===i.id).values,i.curve.map(p=>({x:p.rateStbd,y:p.bottomholePsia}))));
  assert.doesNotMatch(svg,/<script|<foreignObject|href=|NaN|Infinity/);
  for(const m of svg.matchAll(/points="([^"]+)"/g)) for(const p of m[1].split(' ')) { const [x,y]=p.split(',').map(Number);assert.ok(x>=0&&x<=1120&&y>=0&&y<=290); }
});
test('Changed displayed case produces changed metadata and chart series',async()=>{
  const original=await fixture(), changed=await fixture({newWellStart:'2026-12',expansionMonth:'2026-01',expansionStbd:20000});
  assert.notEqual(exhibitSvg(changed),exhibitSvg(original));
  assert.ok(exhibitSvg(changed).includes(changed.contentSha256));
});
test('Every XML label and metadata value escapes markup without losing original content',async()=>{
  const e=await fixture(), malicious=`A<&"'><script>alert('x')</script>`;
  e.inputs.injectors[0].id=malicious;
  e.outputs.injectors[0].id=malicious;
  e.inputs.controls.note=malicious;
  const {contentSha256,...body}=e;
  e.contentSha256=createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const svg=exhibitSvg(e);
  assert.doesNotMatch(svg,/<script>/);
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.deepEqual(JSON.parse(unescape(svg.match(/<metadata id="technical-exhibit">([\s\S]*?)<\/metadata>/)[1])),e);
});
test('Public evidence carries artifact, parent identity, raw source hashes and pressure separation',async()=>{
  const artifact=JSON.parse(await readFile('data/explorer/normalized.json','utf8')), e=await fixture(undefined,artifact),svg=exhibitSvg(e);
  assert.ok(svg.includes(artifact.artifactId));
  assert.match(svg,/Acquired-history parent/);
  assert.match(svg,/never used as bottomhole pressure/);
  for(const source of artifact.manifest.sources) if(source.sha256) assert.ok(svg.includes(source.sha256));
  assert.doesNotMatch(svg,/Public history not loaded/);
});
