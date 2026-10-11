import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {crc32,deflateRawSync,inflateRawSync,constants} from 'node:zlib';
import * as XLSX from '../web/vendor/xlsx.mjs';
import {readInputFile} from '../web/import-file.mjs';

const rows=[['Producer','Group','Month','Water'],['P','G','2025-10',100]];
function workbookMembers(){
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'Water data');
 const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx',compression:false}),end=bytes.length-22;
 let p=bytes.readUInt32LE(end+16);const result=[];
 for(let i=0;i<bytes.readUInt16LE(end+10);i++){
  const local=bytes.readUInt32LE(p+42),nameLength=bytes.readUInt16LE(p+28),length=bytes.readUInt32LE(p+20);
  const data=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28),method=bytes.readUInt16LE(p+10);
  const payload=bytes.subarray(data,data+length);
  result.push({name:bytes.subarray(p+46,p+46+nameLength).toString('latin1'),plain:method===8?inflateRawSync(payload):Buffer.from(payload)});
  p+=46+nameLength+bytes.readUInt16LE(p+30)+bytes.readUInt16LE(p+32);
 }
 return result;
}
// Independent ZIP construction keeps malformed payload lengths coherent in
// every header/descriptor. No reference/vendor fixtures are read or rewritten.
function zip(members,{method=8,streaming=false,signed=true,deflateOptions={}}={}){
 const locals=[],directory=[];let offset=0;
 for(const entry of members){
  const name=Buffer.from(entry.name,'latin1'),plain=entry.plain;
  const compressed=entry.compressed??(method===8?deflateRawSync(plain,deflateOptions):plain),crc=crc32(plain);
  const local=Buffer.alloc(30),central=Buffer.alloc(46),flags=streaming?8:0;
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(flags,6);local.writeUInt16LE(method,8);local.writeUInt16LE(name.length,26);
  if(!streaming){local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(plain.length,22);}
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(flags,8);central.writeUInt16LE(method,10);
  central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(plain.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
  const descriptor=Buffer.alloc(streaming?(signed?16:12):0);
  if(streaming){const base=signed?4:0;if(signed)descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(crc,base);descriptor.writeUInt32LE(compressed.length,base+4);descriptor.writeUInt32LE(plain.length,base+8);}
  const member=Buffer.concat([local,name,compressed,descriptor]);locals.push(member);directory.push(central,name);offset+=member.length;
 }
 const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(members.length,8);end.writeUInt16LE(members.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,central,end]);
}

test('normal ZIP members reject trailing compressed bytes despite matching expanded size and CRC',async()=>{
 const members=workbookMembers(),entry=members[0];entry.compressed=Buffer.concat([deflateRawSync(entry.plain),Buffer.from([1,2,3])]);
 await assert.rejects(readInputFile(zip(members),'trailing.xlsx','synthetic'),/ZIP.*DEFLATE.*(trailing|consum)/i);
});

test('unused empty DEFLATE members reject trailing compressed bytes',async()=>{
 const empty=Buffer.alloc(0),compressed=Buffer.concat([deflateRawSync(empty),Buffer.from([0])]);
 const bytes=zip([...workbookMembers(),{name:'unused.bin',plain:empty,compressed}]);
 await assert.rejects(readInputFile(bytes,'unused-trailing.xlsx','synthetic'),/ZIP.*DEFLATE.*(trailing|consum)/i);
});

test('concatenated DEFLATE streams cannot hide a second stream inside one ZIP member',async()=>{
 const members=workbookMembers(),entry=members[0];entry.compressed=Buffer.concat([deflateRawSync(entry.plain),deflateRawSync(Buffer.from('hidden second stream'))]);
 await assert.rejects(readInputFile(zip(members),'concatenated.xlsx','synthetic'),/ZIP.*DEFLATE.*(trailing|consum)/i);
});

test('signed and unsigned streaming members reject trailing data before descriptor interpretation',async()=>{
 for(const signed of [true,false]){
  const members=workbookMembers(),entry=members[0];entry.compressed=Buffer.concat([deflateRawSync(entry.plain),Buffer.from([1,2,3])]);
  await assert.rejects(readInputFile(zip(members,{streaming:true,signed}),'stream-trailing.xlsx','synthetic'),/ZIP.*DEFLATE.*(trailing|consum)/i);
 }
});

test('workbook lookup rejects duplicate member identities through case, separator and parser-root aliases',async()=>{
 for(const rename of [name=>name.toUpperCase(),name=>name.replaceAll('/','\\'),name=>`/${name}`,name=>`Root Entry/${name}`,name=>name.replace('/','//')]){
  const members=workbookMembers(),sheet=members.find(entry=>entry.name==='xl/worksheets/sheet1.xml');
  assert.ok(sheet);members.push({...sheet,name:rename(sheet.name)});
  await assert.rejects(readInputFile(zip(members),'alias.xlsx','synthetic'),/ZIP.*(ambiguous|duplicate|identity)/i);
 }
});

test('valid stored, fixed, dynamic and level-zero DEFLATE workbooks preserve rows, hashes and upload bytes',async()=>{
 for(const options of [{method:0},{deflateOptions:{strategy:constants.Z_FIXED}},{deflateOptions:{level:6}},{deflateOptions:{level:0}}]){
  const bytes=zip(workbookMembers(),options),original=Buffer.from(bytes),parsed=await readInputFile(bytes,'valid.xlsx','synthetic');
  assert.deepEqual(parsed.sheets,[{name:'Water data',rows}]);assert.deepEqual(bytes,original);
  assert.equal(parsed.source.sha256,createHash('sha256').update(original).digest('hex'));
 }
});

test('valid signed and unsigned stored and DEFLATE descriptors preserve rows and source identity',async()=>{
 for(const signed of [true,false])for(const method of [0,8]){
  const bytes=zip(workbookMembers(),{method,streaming:true,signed}),original=Buffer.from(bytes),parsed=await readInputFile(bytes,'stream.xlsx','measured');
  assert.deepEqual(parsed.sheets,[{name:'Water data',rows}]);assert.deepEqual(bytes,original);
  assert.equal(parsed.source.sha256,createHash('sha256').update(original).digest('hex'));assert.equal(parsed.source.assertedKind,'measured');
 }
});

test('valid empty DEFLATE members preserve workbook values in normal and streaming ZIP forms',async()=>{
 for(const streaming of [false,true])for(const signed of [false,true]){
  const bytes=zip([...workbookMembers(),{name:'unused.bin',plain:Buffer.alloc(0)}],{streaming,signed});
  const parsed=await readInputFile(bytes,'empty.xlsx','synthetic');assert.deepEqual(parsed.sheets,[{name:'Water data',rows}]);
 }
});

test('valid mixed and multiple stored DEFLATE blocks retain exact member boundaries',async()=>{
 for(const mixed of [false,true]){
  const plain=Buffer.alloc(131072,65);
  const compressed=mixed?Buffer.concat([Buffer.from([0,1,0,254,255]),plain.subarray(0,1),deflateRawSync(plain.subarray(1))]):deflateRawSync(plain,{level:0});
  const bytes=zip([...workbookMembers(),{name:'unused-large.bin',plain,compressed}]);
  const parsed=await readInputFile(bytes,'multi-block.xlsx','synthetic');assert.deepEqual(parsed.sheets,[{name:'Water data',rows}]);
 }
});

test('worksheet dimensions cannot silently hide existing data cells',async()=>{
 const members=workbookMembers(),sheet=members.find(entry=>entry.name==='xl/worksheets/sheet1.xml');
 const xml=sheet.plain.toString('utf8');assert.match(xml,/<dimension ref="A1:D2"\/>/);
 sheet.plain=Buffer.from(xml.replace('<dimension ref="A1:D2"/>','<dimension ref="A1:D1"/>'));
 const parsed=await readInputFile(zip(members),'understated-range.xlsx','synthetic');
 assert.deepEqual(parsed.sheets,[{name:'Water data',rows}]);
});

test('understated worksheet dimensions cannot bypass actual column and row limits',async()=>{
 for(const address of ['CW2','A100002']){
  const members=workbookMembers(),sheet=members.find(entry=>entry.name==='xl/worksheets/sheet1.xml');
  sheet.plain=Buffer.from(sheet.plain.toString('utf8').replace('</sheetData>',`<row><c r="${address}"><v>999</v></c></row></sheetData>`));
  await assert.rejects(readInputFile(zip(members),'hidden-overflow.xlsx','synthetic'),/Sheet exceeds.*rows.*columns/);
 }
});

test('sparse worksheet rows preserve physical positions despite an inaccurate declared range',async()=>{
 const members=workbookMembers(),sheet=members.find(entry=>entry.name==='xl/worksheets/sheet1.xml');
 sheet.plain=Buffer.from(sheet.plain.toString('utf8').replace('ref="A1:D2"','ref="A1:D1"').replace('<row r="2">','<row r="10">').replaceAll(/r="([A-D])2"/g,'r="$110"'));
 const bytes=zip(members),original=Buffer.from(bytes),parsed=await readInputFile(bytes,'sparse.xlsx','synthetic');
 assert.equal(parsed.sheets[0].rows.length,10);assert.deepEqual(parsed.sheets[0].rows[0],rows[0]);assert.deepEqual(parsed.sheets[0].rows[9],rows[1]);
 assert.ok(parsed.sheets[0].rows.slice(1,9).every(row=>row.every(cell=>cell===null)));assert.deepEqual(bytes,original);
 assert.equal(parsed.source.sha256,createHash('sha256').update(original).digest('hex'));
});

test('an empty worksheet remains empty when its declared range claims occupied cells',async()=>{
 const members=workbookMembers(),sheet=members.find(entry=>entry.name==='xl/worksheets/sheet1.xml');
 sheet.plain=Buffer.from(sheet.plain.toString('utf8').replace(/<sheetData>[\s\S]*?<\/sheetData>/,'<sheetData/>'));
 const parsed=await readInputFile(zip(members),'empty-sheet.xlsx','synthetic');
 assert.deepEqual(parsed.sheets,[{name:'Water data',rows:[]}]);
});
