import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildExhibit,exhibitCsv} from '../dist/exhibit.js';
import {exhibitSvg} from '../dist/exhibitSvg.js';
import {exhibitPdf} from '../web/exhibit-pdf.mjs';
import {INJECTORS} from '../dist/engineering.js';
import {syntheticActuals,freezeForecast,planningCase} from '../dist/planning.js';
import {sha256Text} from '../dist/exhibitIntegrity.js';
async function exhibit(){const actuals=syntheticActuals(),frozen=freezeForecast(actuals);return buildExhibit({frozen,rows:planningCase(frozen,actuals,INJECTORS),injectors:INJECTORS,controls:{newWellStart:'2026-04',expansionMonth:'2026-08',expansionStbd:2000}});}
const rehash=e=>{const {contentSha256,...body}=e;e.contentSha256=createHash('sha256').update(JSON.stringify(body)).digest('hex');};
test('CSV and SVG reject post-build changes to values, provenance and hash',async()=>{
 const original=await exhibit();
 for(const serialize of [exhibitCsv,exhibitSvg])for(const change of [e=>e.outputs.monthly[0].demandBbl++,e=>e.provenance.injectors='measured',e=>e.contentSha256='0'.repeat(64)]){
  const e=structuredClone(original);change(e);assert.throws(()=>serialize(e),/SHA-256 mismatch/i);
 }
 assert.equal(exhibitCsv(original),exhibitCsv(JSON.parse(JSON.stringify(original))));
 assert.equal(exhibitSvg(original),exhibitSvg(JSON.parse(JSON.stringify(original))));
});
test('all serializers reject evidence that JSON serialization would erase, even with its matching JSON hash',async()=>{
 const original=await exhibit();
 for(const change of [e=>e.inputs.extra=undefined,e=>e.inputs.extra=NaN,e=>e.inputs.extra=Array(2),e=>e.inputs.extra=new Date('2026-01-01')]){
  const e=structuredClone(original);change(e);rehash(e);
  assert.throws(()=>exhibitCsv(e),/JSON evidence|plain JSON/i);assert.throws(()=>exhibitSvg(e),/JSON evidence|plain JSON/i);await assert.rejects(exhibitPdf(e),/JSON evidence|plain JSON/i);
 }
 let reads=0;const e=structuredClone(original);Object.defineProperty(e.inputs,'extra',{enumerable:true,get(){reads++;return 1;}});
 assert.throws(()=>exhibitCsv(e),/JSON evidence/i);assert.throws(()=>exhibitSvg(e),/JSON evidence/i);await assert.rejects(exhibitPdf(e),/JSON evidence/i);assert.equal(reads,0);
});
test('synchronous UTF-8 SHA-256 agrees with independent Node and WebCrypto across padding and Unicode boundaries',async()=>{
 const strings=['','abc','abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq','é𝄞水\ud800',...Array.from({length:140},(_,n)=>'a'.repeat(n)),'a'.repeat(1000000)];
 for(const text of strings){const expected=createHash('sha256').update(text).digest('hex');assert.equal(sha256Text(text),expected);const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));assert.equal(sha256Text(text),Buffer.from(bytes).toString('hex'));}
 assert.equal(sha256Text('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('custom array prototypes cannot execute inherited serialization behavior',async()=>{
 const e=await exhibit();let calls=0;const prototype=Object.create(Array.prototype);prototype.toJSON=()=>{calls++;return [];};Object.setPrototypeOf(e.outputs.monthly,prototype);
 assert.throws(()=>exhibitCsv(e),/plain JSON evidence/);assert.throws(()=>exhibitSvg(e),/plain JSON evidence/);await assert.rejects(exhibitPdf(e),/plain JSON evidence/);assert.equal(calls,0);
});
