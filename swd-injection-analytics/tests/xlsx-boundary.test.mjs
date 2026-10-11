import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {crc32 as referenceCrc32,deflateRawSync} from 'node:zlib';
import * as XLSX from '../web/vendor/xlsx.mjs';
import {readInputFile,validateSelected} from '../web/import-file.mjs';
import {analysisReadiness} from '../dist/analysisReadiness.js';
import {parseCsv,selectSheet,createSource} from '../dist/importProfile.js';
import {validateImport} from '../dist/importValidation.js';

const mapping={profile:'history',version:'xlsx-boundary/1',confirmed:true,columns:{producerId:'Producer',groupId:'Group',month:'Month',water:'Water'},units:{water:'STB/day'},timeBasis:'calendar-day'};
const rows=[['Producer','Group','Month','Water','Comment'],['P','G','2025-10',100,''],['P','G','2025-11',100,''],['P','G','2025-12',100,'']];
function workbook(change=()=>{},options={}){
 const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet(rows);
 change(sheet);XLSX.utils.book_append_sheet(book,sheet,'Water data');
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Unrelated note']]),'Notes');
 return XLSX.write(book,{type:'buffer',bookType:'xlsx',compression:true,...options});
}
function archive(bytes){
 const copy=Buffer.from(bytes),end=copy.length-22,offset=copy.readUInt32LE(end+16),size=copy.readUInt32LE(end+12),count=copy.readUInt16LE(end+10);
 assert.equal(copy.readUInt32LE(end),0x06054b50);
 const entries=[];let p=offset;
 for(let i=0;i<count;i++){
  assert.equal(copy.readUInt32LE(p),0x02014b50);entries.push(p);
  p+=46+copy.readUInt16LE(p+28)+copy.readUInt16LE(p+30)+copy.readUInt16LE(p+32);
 }
 return {copy,end,offset,size,count,entries};
}
// Repack actual workbook members with streaming-writer data descriptors. All
// payloads stay byte-for-byte unchanged; only ZIP headers/offsets are rebuilt.
function streamingWorkbook(signed=true,options={},change=()=>{}){
 const a=archive(workbook(change,options)),locals=[],directory=[];let offset=0;
 for(const [i,p]of a.entries.entries()){
  const next=a.entries[i+1]??a.end,record=Buffer.from(a.copy.subarray(p,next)),oldLocal=a.copy.readUInt32LE(p+42);
  const headerLength=30+a.copy.readUInt16LE(oldLocal+26)+a.copy.readUInt16LE(oldLocal+28),header=Buffer.from(a.copy.subarray(oldLocal,oldLocal+headerLength));
  const flags=a.copy.readUInt16LE(p+8)|8,compressed=a.copy.readUInt32LE(p+20),expanded=a.copy.readUInt32LE(p+24),crc=a.copy.readUInt32LE(p+16);
  header.writeUInt16LE(flags,6);header.fill(0,14,26);record.writeUInt16LE(flags,8);record.writeUInt32LE(offset,42);
  const descriptor=Buffer.alloc(signed?16:12),base=signed?4:0;
  if(signed)descriptor.writeUInt32LE(0x08074b50,0);
  descriptor.writeUInt32LE(crc,base);descriptor.writeUInt32LE(compressed,base+4);descriptor.writeUInt32LE(expanded,base+8);
  const member=Buffer.concat([header,a.copy.subarray(oldLocal+headerLength,oldLocal+headerLength+compressed),descriptor]);
  locals.push(member);directory.push(record);offset+=member.length;
 }
 const central=Buffer.concat(directory),end=Buffer.from(a.copy.subarray(a.end));end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,central,end]);
}
function member(a,p,signed=true){
 const local=a.copy.readUInt32LE(p+42),data=local+30+a.copy.readUInt16LE(local+26)+a.copy.readUInt16LE(local+28),compressed=a.copy.readUInt32LE(p+20),descriptor=data+compressed;
 return {local,data,compressed,descriptor,fields:descriptor+(signed?4:0),end:descriptor+(signed?16:12)};
}
// Independent native zlib produces controlled raw streams for boundary checks.
function payloadArchive(payload,declaredSize=payload.length,compressed=deflateRawSync(payload)){
 const name=Buffer.from('validation.bin'),crc=referenceCrc32(payload),local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(declaredSize,22);local.writeUInt16LE(name.length,26);
 central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(declaredSize,24);central.writeUInt16LE(name.length,28);
 const directory=Buffer.concat([central,name]);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(local.length+name.length+compressed.length,16);
 return Buffer.concat([local,name,compressed,directory,end]);
}
function appendEmptyMember(compressed=deflateRawSync(Buffer.alloc(0))){
 const a=archive(workbook()),b=archive(payloadArchive(Buffer.alloc(0),0,compressed)),entry=Buffer.from(b.copy.subarray(b.offset,b.end)),end=Buffer.from(a.copy.subarray(a.end));
 entry.writeUInt32LE(a.offset,42);end.writeUInt16LE(a.count+1,8);end.writeUInt16LE(a.count+1,10);end.writeUInt32LE(a.size+b.size,12);end.writeUInt32LE(a.offset+b.offset,16);
 return Buffer.concat([a.copy.subarray(0,a.offset),b.copy.subarray(0,b.offset),a.copy.subarray(a.offset,a.end),entry,end]);
}

test('Excel error identities are quarantined with original error code and cannot train a forecast',async()=>{
 const bytes=workbook(sheet=>{for(const a of ['A2','A3','A4'])sheet[a]={t:'e',v:7};});
 const parsed=await readInputFile(bytes,'errors.xlsx','synthetic'),result=validateSelected(parsed,'Water data',1,mapping);
 assert.equal(result.counts.accepted,0);assert.equal(result.counts.quarantined,3);
 assert.deepEqual(result.rows[0].lineage.originalValues[0],{spreadsheetError:7});
 assert.ok(result.rows.every(r=>r.value===null&&r.errors.some(e=>e.code==='spreadsheet-error'&&e.field==='producerId')));
 assert.match(result.rows[0].errors[0].message,/#DIV\/0!/);
 assert.equal(analysisReadiness({history:result,producerIds:['Spreadsheet error: 7'],cutoff:'2025-12',model:'exponential-log-fit/1'}).forecast.ready,false);
});

test('Excel error cells in numeric and unmapped columns quarantine the row without hiding valid rows',async()=>{
 const parsed=await readInputFile(workbook(sheet=>{sheet.D2={t:'e',v:23};sheet.E3={t:'e',v:42};}),'errors.xlsx','measured');
 const result=validateSelected(parsed,'Water data',1,mapping);
 assert.equal(result.counts.accepted,1);assert.equal(result.counts.quarantined,2);
 assert.ok(result.rows[0].errors.some(e=>e.code==='spreadsheet-error'&&e.field==='water'));
 assert.ok(result.rows[1].errors.some(e=>e.code==='spreadsheet-error'&&e.field==='Comment'));
 assert.match(result.rows[0].errors[0].message,/#REF!/);assert.match(result.rows[1].errors[0].message,/#N\/A/);
 assert.equal(result.rows[2].value.rateStbd,100);
 assert.equal(result.rows[0].lineage.source.origin,'user');assert.equal(result.rows[0].lineage.source.assertedKind,'measured');
});

test('typed error cells remain invalid through the direct parsed-sheet validator and headers',async()=>{
 const source=await createSource(new Uint8Array([1]),'errors.xlsx',{origin:'user',assertedKind:'synthetic',reference:'Controlled typed-cell boundary'});
 const table=selectSheet([{name:'Water data',rows:[rows[0],[{spreadsheetError:7},'G','2025-10',100,'']]}],'Water data',1);
 const result=validateImport(table,source,mapping);
 assert.equal(result.counts.quarantined,1);assert.equal(result.rows[0].errors[0].code,'spreadsheet-error');
 assert.throws(()=>selectSheet([{name:'Water data',rows:[[{spreadsheetError:7},'Group','Month','Water']]}],'Water data',1),/Header/);
});

test('literal CSV spreadsheet-error text remains ordinary text and zero and missing stay distinct',async()=>{
 const parsed=await readInputFile(new TextEncoder().encode('Producer,Group,Month,Water\nSpreadsheet error: 7,G,2025-10,0\nSpreadsheet error: 7,G,2025-11,'),'literal.csv','synthetic');
 const result=validateSelected(parsed,null,1,mapping);
 assert.equal(result.counts.accepted,2);assert.equal(result.rows[0].value.producerId,'Spreadsheet error: 7');
 assert.equal(result.rows[0].value.rateStbd,0);assert.equal(result.rows[1].value.rateStbd,null);
});

test('ZIP guard rejects inconsistent per-disk and total entry counts before workbook parsing',async()=>{
 for(const field of [8,10]){
  const {copy,end}=archive(workbook());copy.writeUInt16LE(0,end+field);
  await assert.rejects(readInputFile(copy,'counts.xlsx','synthetic'),/directory|archive|entries/i);
 }
});

test('ZIP guard rejects omitted directory records even when both declared counts agree',async()=>{
 const {copy,end,count}=archive(workbook());copy.writeUInt16LE(count-1,end+8);copy.writeUInt16LE(count-1,end+10);
 await assert.rejects(readInputFile(copy,'omitted.xlsx','synthetic'),/directory|archive|entries/i);
});

test('ZIP guard validates directory size, disk numbers and variable entry lengths',async()=>{
 for(const mutate of [
  a=>a.copy.writeUInt32LE(a.size-1,a.end+12),
  a=>a.copy.writeUInt16LE(1,a.end+4),
  a=>a.copy.writeUInt16LE(1,a.end+6),
  a=>a.copy.writeUInt16LE(65535,a.entries.at(-1)+28),
 ]){
  const a=archive(workbook());mutate(a);
  await assert.rejects(readInputFile(a.copy,'directory.xlsx','synthetic'),/directory|archive|entries/i);
 }
});

test('ZIP guard checks metadata for entries beyond a forged total count',async()=>{
 for(const mutate of [
  a=>a.copy.writeUInt16LE(1,a.entries.at(-1)+8),
  a=>a.copy.writeUInt32LE(41*1024*1024,a.entries.at(-1)+24),
 ]){
  const a=archive(workbook());a.copy.writeUInt16LE(1,a.end+10);mutate(a);
  await assert.rejects(readInputFile(a.copy,'unchecked.xlsx','synthetic'),/directory|archive|entries|encrypted|expands/i);
 }
});

test('ZIP guard rejects inconsistent local expansion sizes before decompression',async()=>{
 const a=archive(workbook()),local=a.copy.readUInt32LE(a.entries[0]+42);
 a.copy.writeUInt32LE(41*1024*1024,local+22);
 await assert.rejects(readInputFile(a.copy,'local-size.xlsx','synthetic'),/directory|archive|sizes|metadata|expands/i);
});

test('normal compressed and stored workbooks retain worksheet selection, values and lineage',async()=>{
 for(const compression of [true,false]){
  const bytes=workbook(()=>{},{compression});
  const parsed=await readInputFile(bytes,'normal.xlsx','synthetic');
  assert.deepEqual(parsed.sheets.map(s=>s.name),['Water data','Notes']);
  const result=validateSelected(parsed,'Water data',1,mapping);
  assert.equal(result.counts.accepted,3);assert.equal(result.rows[0].value.volumeBbl,3100);
  assert.equal(result.rows[0].lineage.sheet,'Water data');assert.equal(result.rows[0].lineage.originalRow,2);
  assert.equal(result.rows[0].lineage.mapping.units.water,'STB/day');
  const csv=validateImport(parseCsv('Producer,Group,Month,Water\nP,G,2025-10,100\nP,G,2025-11,100\nP,G,2025-12,100'),parsed.source,mapping);
  assert.deepEqual(result.rows.map(r=>r.value),csv.rows.map(r=>r.value));
 }
});

test('deflated streaming ZIP descriptors with or without signatures preserve valid workbook values',async()=>{
 for(const signed of [true,false]){
  const parsed=await readInputFile(streamingWorkbook(signed),'streaming.xlsx','synthetic');
  assert.equal(validateSelected(parsed,'Water data',1,mapping).counts.accepted,3);
 }
});

test('ZIP guard rejects forged data descriptors instead of letting the parser warn and continue',async()=>{
 const a=archive(streamingWorkbook()),p=a.entries[0],local=a.copy.readUInt32LE(p+42);
 const data=local+30+a.copy.readUInt16LE(local+26)+a.copy.readUInt16LE(local+28),descriptor=data+a.copy.readUInt32LE(p+20);
 a.copy.writeUInt32LE(1,descriptor+12);
 await assert.rejects(readInputFile(a.copy,'bad-descriptor.xlsx','synthetic'),/directory|archive|metadata/i);
});

test('ZIP comments are allowed but an embedded end signature cannot redirect the pinned parser',async()=>{
 const bytes=workbook(),comment=Buffer.from('Review note'),commented=Buffer.concat([bytes,comment]);commented.writeUInt16LE(comment.length,bytes.length-2);
 const parsed=await readInputFile(commented,'comment.xlsx','synthetic');assert.equal(validateSelected(parsed,'Water data',1,mapping).counts.accepted,3);
 const fakeComment=Buffer.alloc(22);fakeComment.writeUInt32LE(0x06054b50,0);const ambiguous=Buffer.concat([bytes,fakeComment]);ambiguous.writeUInt16LE(fakeComment.length,bytes.length-2);
 await assert.rejects(readInputFile(ambiguous,'ambiguous.xlsx','synthetic'),/directory|archive|ZIP/i);
});

test('stored streaming descriptors preserve worksheets, original upload bytes and original source hashes',async()=>{
 const normal=await readInputFile(workbook(()=>{},{compression:false}),'normal.xlsx','synthetic');
 for(const signed of [true,false]){
  const bytes=streamingWorkbook(signed,{compression:false}),original=Buffer.from(bytes),a=archive(bytes),first=member(a,a.entries[0],signed);
  assert.equal(bytes.readUInt16LE(first.local+8),0);assert.equal(bytes.readUInt32LE(first.local+18),0);assert.equal(bytes.readUInt32LE(first.local+22),0);
  const parsed=await readInputFile(bytes,'stored-stream.xlsx','synthetic'),result=validateSelected(parsed,'Water data',1,mapping);
  assert.deepEqual(parsed.sheets,normal.sheets);assert.equal(result.counts.accepted,3);assert.equal(result.rows[0].value.volumeBbl,3100);
  const hash=createHash('sha256').update(original).digest('hex');assert.equal(parsed.source.sha256,hash);assert.equal(result.rows[0].lineage.source.sha256,hash);assert.equal(parsed.source.name,'stored-stream.xlsx');assert.equal(parsed.source.origin,'user');assert.equal(parsed.source.verified,false);
  assert.equal(result.rows[0].lineage.sheet,'Water data');assert.equal(result.rows[0].lineage.originalRow,2);assert.deepEqual(bytes,original);
 }
});

test('stored and deflated streaming workbooks preserve formula and typed-error quarantine semantics',async()=>{
 const change=sheet=>{sheet.D2={t:'n',f:'1+1',v:2};sheet.E3={t:'e',v:42};};
 const normal=await readInputFile(workbook(change),'normal-errors.xlsx','measured');
 for(const signed of [true,false])for(const compression of [true,false]){
  const bytes=streamingWorkbook(signed,{compression},change),original=Buffer.from(bytes),parsed=await readInputFile(bytes,'stream-errors.xlsx','measured');
  assert.deepEqual(parsed.sheets,normal.sheets);const result=validateSelected(parsed,'Water data',1,mapping);
  assert.equal(result.counts.accepted,1);assert.equal(result.counts.quarantined,2);assert.ok(result.rows[0].errors.some(e=>e.code==='formula'));assert.ok(result.rows[1].errors.some(e=>e.code==='spreadsheet-error'));
  assert.deepEqual(result.rows[0].lineage.originalValues[3],{formula:'1+1',cached:2});assert.deepEqual(result.rows[1].lineage.originalValues[4],{spreadsheetError:42});assert.equal(result.rows[2].value.rateStbd,100);
  assert.equal(result.rows[0].lineage.source.sha256,createHash('sha256').update(original).digest('hex'));assert.equal(result.rows[0].lineage.source.assertedKind,'measured');assert.deepEqual(bytes,original);
 }
});

test('stored entries reject corrupted payload CRC even when descriptor and directory agree',async()=>{
 for(const signed of [true,false])for(const streaming of [true,false]){
  const a=archive(streaming?streamingWorkbook(signed,{compression:false}):workbook(()=>{},{compression:false})),m=member(a,a.entries[0],signed);
  a.copy[m.data+Math.min(10,m.compressed-1)]^=1;
  await assert.rejects(readInputFile(a.copy,'payload-crc.xlsx','synthetic'),/ZIP.*CRC|CRC.*ZIP/i);
 }
});

test('stored streaming CRC and size metadata must match both payload and descriptor',async()=>{
 for(const signed of [true,false])for(const mutate of [
  (a,p,m)=>a.copy.writeUInt32LE((a.copy.readUInt32LE(p+16)^1)>>>0,m.fields),
  (a,p,m)=>{const forged=(a.copy.readUInt32LE(p+16)^1)>>>0;a.copy.writeUInt32LE(forged,p+16);a.copy.writeUInt32LE(forged,m.local+14);a.copy.writeUInt32LE(forged,m.fields);},
  (a,p,m)=>a.copy.writeUInt32LE(m.compressed+1,m.fields+4),
  (a,p,m)=>a.copy.writeUInt32LE(m.compressed+1,m.fields+8),
  (a,p,m)=>{a.copy.writeUInt32LE(m.compressed+1,p+24);a.copy.writeUInt32LE(m.compressed+1,m.fields+8);}
 ]){
  const a=archive(streamingWorkbook(signed,{compression:false})),p=a.entries[0],m=member(a,p,signed);mutate(a,p,m);
  await assert.rejects(readInputFile(a.copy,'stored-metadata.xlsx','synthetic'),/ZIP|directory|archive|metadata/i);
 }
});

test('stored streaming normalization cannot bypass omitted directory records or overlapping local entries',async()=>{
 for(const signed of [true,false]){
  const omitted=archive(streamingWorkbook(signed,{compression:false}));omitted.copy.writeUInt16LE(omitted.count-1,omitted.end+8);omitted.copy.writeUInt16LE(omitted.count-1,omitted.end+10);
  await assert.rejects(readInputFile(omitted.copy,'omitted-stream.xlsx','synthetic'),/directory|archive|metadata/i);
  const a=archive(streamingWorkbook(signed,{compression:false})),members=a.entries.map(p=>({p,...member(a,p,signed)})),largest=[...members].sort((x,y)=>y.compressed-x.compressed)[0],smallest=[...members].sort((x,y)=>(x.end-x.local)-(y.end-y.local))[0];
  assert.notEqual(largest.p,smallest.p);assert.ok(smallest.end-smallest.local<largest.compressed);
  const nested=Buffer.from(a.copy.subarray(smallest.local,smallest.end));nested.copy(a.copy,largest.data);a.copy.writeUInt32LE(largest.data,smallest.p+42);
  await assert.rejects(readInputFile(a.copy,'overlapping-stream.xlsx','synthetic'),/directory|local metadata/i);
 }
});

test('DEFLATE payload CRC rejects coherent forged local, directory and descriptor checksums',async()=>{
 for(const mode of ['normal','signed','unsigned']){
  const signed=mode!=='unsigned',a=archive(mode==='normal'?workbook():streamingWorkbook(signed)),p=a.entries[0],m=member(a,p,signed),crc=(a.copy.readUInt32LE(p+16)^1)>>>0;
  a.copy.writeUInt32LE(crc,p+16);a.copy.writeUInt32LE(crc,m.local+14);if(mode!=='normal')a.copy.writeUInt32LE(crc,m.fields);
  const original=Buffer.from(a.copy);await assert.rejects(readInputFile(a.copy,'forged-crc.xlsx','synthetic'),/ZIP.*CRC/i);assert.deepEqual(a.copy,original);
 }
});

test('DEFLATE actual size must equal coherent declared sizes for normal and streaming members',async()=>{
 for(const mode of ['normal','signed','unsigned'])for(const difference of [-1,1]){
  const signed=mode!=='unsigned',a=archive(mode==='normal'?workbook():streamingWorkbook(signed)),p=a.entries[0],m=member(a,p,signed),expanded=a.copy.readUInt32LE(p+24)+difference;
  a.copy.writeUInt32LE(expanded,p+24);a.copy.writeUInt32LE(expanded,m.local+22);if(mode!=='normal')a.copy.writeUInt32LE(expanded,m.fields+8);
  await assert.rejects(readInputFile(a.copy,'forged-size.xlsx','synthetic'),/ZIP.*expanded|actual expansion|declared.*size/i);
 }
});

test('invalid and truncated DEFLATE payloads fail before SheetJS reads the workbook',async()=>{
 const payload=Buffer.from('Independent raw-DEFLATE validation payload'),valid=deflateRawSync(payload);
 for(const compressed of [Buffer.from([0xff,0xff,0xff]),valid.subarray(0,valid.length-2)]){
  const bytes=payloadArchive(payload,payload.length,compressed);await assert.rejects(readInputFile(bytes,'corrupt-deflate.xlsx','synthetic'),/ZIP.*DEFLATE/i);
 }
});

test('DEFLATE validation cancels streaming output immediately when actual expansion exceeds the budget',async t=>{
 const cancel=ReadableStreamDefaultReader.prototype.cancel;let cancellations=0;
 t.mock.method(ReadableStreamDefaultReader.prototype,'cancel',function(reason){cancellations++;return cancel.call(this,reason);});
 const bytes=payloadArchive(Buffer.alloc(40*1024*1024+65536,65),40*1024*1024);
 await assert.rejects(readInputFile(bytes,'expansion.xlsx','synthetic'),/actual expansion exceeds 40 MiB/i);assert.ok(cancellations>0);
});

test('unsupported native raw-DEFLATE decoding fails explicitly while STORED workbooks still work',async t=>{
 t.mock.method(globalThis,'DecompressionStream',function(){throw new TypeError('Unsupported compression format');});
 await assert.rejects(readInputFile(workbook(),'unsupported.xlsx','synthetic'),/DEFLATE.*unsupported|requires.*DEFLATE/i);
 assert.equal(validateSelected(await readInputFile(workbook(()=>{},{compression:false}),'stored.xlsx','synthetic'),'Water data',1,mapping).counts.accepted,3);
});

test('native DEFLATE trailing-data observation remains a documented decoder compatibility limit',async()=>{
 // Node's standard decoder exposes no consumed compressed-input count and
 // accepts trailing bytes. CRC/size validation does not prove canonical streams.
 const payload=Buffer.from('Trailing-data observation'),compressed=Buffer.concat([deflateRawSync(payload),Buffer.from([1,2,3])]);
 const decoded=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
 assert.deepEqual(Buffer.from(decoded),payload);
});

test('zero-expanded unused DEFLATE members are validated instead of silently skipped',async()=>{
 const valid=appendEmptyMember(),parsed=await readInputFile(valid,'empty-member.xlsx','synthetic');assert.equal(validateSelected(parsed,'Water data',1,mapping).counts.accepted,3);
 assert.equal(parsed.source.sha256,createHash('sha256').update(valid).digest('hex'));
 await assert.rejects(readInputFile(appendEmptyMember(Buffer.from([0xff])),'corrupt-empty.xlsx','synthetic'),/ZIP.*DEFLATE/i);
});

test('stream cancellation failures preserve the primary expanded-size rejection',async t=>{
 const cancel=ReadableStreamDefaultReader.prototype.cancel;
 t.mock.method(ReadableStreamDefaultReader.prototype,'cancel',async function(reason){await cancel.call(this,reason);throw Error('Cancellation cleanup failed');});
 await assert.rejects(readInputFile(payloadArchive(Buffer.from('actual output'),0),'cancel-failure.xlsx','synthetic'),/ZIP expanded size exceeds declared size/i);
});
