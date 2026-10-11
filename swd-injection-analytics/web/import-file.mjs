import * as XLSX from './vendor/xlsx.mjs';
import {createSource,parseCsv,selectSheet} from '../dist/importProfile.js';
import {validateImport} from '../dist/importValidation.js';
const crcTable=Uint32Array.from({length:256},(_,byte)=>{
 let value=byte;for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;
});
function updateCrc32(value,bytes){for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return value;}
function crc32(bytes){return (updateCrc32(0xffffffff,bytes)^0xffffffff)>>>0;}
const maxExpansion=40*1024*1024;
async function validateDeflate(bytes,declared,actualTotal){
 let decoder;
 try{decoder=new DecompressionStream('deflate-raw');}catch{throw Error('XLSX DEFLATE validation is unsupported; requires native raw-DEFLATE decompression');}
 const reader=new Blob([bytes]).stream().pipeThrough(decoder).getReader();let count=0,crc=0xffffffff;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   if(value.byteLength>maxExpansion-actualTotal-count)throw Error('Workbook actual expansion exceeds 40 MiB');
   if(value.byteLength>declared-count)throw Error('Invalid workbook ZIP expanded size exceeds declared size');
   count+=value.byteLength;crc=updateCrc32(crc,value);
  }
  if(count!==declared)throw Error('Invalid workbook ZIP expanded size does not match declared size');
  return {count,crc:(crc^0xffffffff)>>>0};
 }catch(error){
  try{await reader.cancel(error);}catch{/* Preserve the original validation failure. */}
  if(error instanceof Error&&/^(Invalid workbook ZIP|Workbook actual expansion)/.test(error.message))throw error;
  throw Error(`Invalid workbook ZIP DEFLATE payload: ${error instanceof Error?error.message:String(error)}`);
 }finally{reader.releaseLock();}
}
/** Reconcile the complete single-disk ZIP directory before workbook decompression.
 * The pinned parser reads the per-disk count and local sizes, so both copies of
 * every count/size must be checked; a smaller total count cannot skip entries. */
async function checkArchive(bytes) {
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(view.getUint32(p,true)===0x06054b50&&p+22+view.getUint16(p+20,true)===bytes.length){end=p;break;}
 if(end<0)throw Error('XLSX must be a valid ZIP workbook');
 const invalid=()=>{throw Error('Invalid workbook ZIP directory or local metadata');};
 const count=view.getUint16(end+10,true),diskCount=view.getUint16(end+8,true),size=view.getUint32(end+12,true),offset=view.getUint32(end+16,true);
 if(view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0||count!==diskCount||!count||count>2048||size===0xffffffff||offset===0xffffffff)throw Error('Unsupported or inconsistent workbook archive directory');
 if(offset+size!==end)invalid();
 // SheetJS searches backward for the signature without validating its comment.
 // Reject an ambiguous embedded signature rather than let it select another EOCD.
 for(let p=end+22;p+4<=bytes.length;p++)if(view.getUint32(p,true)===0x06054b50)invalid();
 const extra=(start,length)=>{
  const stop=start+length;let p=start;
  while(p<stop){
   if(p+4>stop)invalid();
   const kind=view.getUint16(p,true),length=view.getUint16(p+2,true);
   if(kind===1)throw Error('ZIP64 workbook archives are unsupported');
   p+=4+length;if(p>stop)invalid();
  }
 };
 let p=offset,total=0;
 const names=new Set(),parserNames=new Set(),localRanges=[],members=[];
 for(let i=0;i<count;i++) {
  if(p+46>end||view.getUint32(p,true)!==0x02014b50)invalid();
  const flags=view.getUint16(p+8,true),method=view.getUint16(p+10,true),crc=view.getUint32(p+16,true),compressed=view.getUint32(p+20,true),expanded=view.getUint32(p+24,true),nameLength=view.getUint16(p+28,true),extraLength=view.getUint16(p+30,true),commentLength=view.getUint16(p+32,true),local=view.getUint32(p+42,true);
  const next=p+46+nameLength+extraLength+commentLength;
  if(next>end||!nameLength||view.getUint16(p+34,true)!==0||compressed===0xffffffff||expanded===0xffffffff||local===0xffffffff)invalid();
  if(flags&0x2041)throw Error('Encrypted workbooks are unsupported');
  if(method!==0&&method!==8)throw Error('Unsupported workbook archive compression');
  total+=expanded;if(total>maxExpansion)throw Error('Workbook declared expansion exceeds 40 MiB');
  const name=bytes.subarray(p+46,p+46+nameLength),key=Array.from(name).join(',');
  if(names.has(key))invalid();names.add(key);
  // Match the pinned parser's byte-to-character names, root-prefix handling
  // and case/separator-insensitive workbook lookup before it selects a member.
  const rawName=Array.from(name,byte=>String.fromCharCode(byte)).join('');
  const parserPath=(rawName.startsWith('Root Entry/')?rawName:`Root Entry/${rawName}`.replace('//','/')).replace(/^Root Entry[\\/]/,'').toLowerCase().replace(/\\/g,'/');
  if(parserNames.has(parserPath))throw Error('Invalid workbook ZIP ambiguous member identity');parserNames.add(parserPath);
  extra(p+46+nameLength,extraLength);
  if(local+30>offset||view.getUint32(local,true)!==0x04034b50)invalid();
  const localNameLength=view.getUint16(local+26,true),localExtraLength=view.getUint16(local+28,true),data=local+30+localNameLength+localExtraLength;
  if(data+compressed>offset||localNameLength!==nameLength||name.some((byte,index)=>byte!==bytes[local+30+index])||view.getUint16(local+6,true)!==flags||view.getUint16(local+8,true)!==method)invalid();
  extra(local+30+localNameLength,localExtraLength);
  const localCrc=view.getUint32(local+14,true),localCompressed=view.getUint32(local+18,true),localExpanded=view.getUint32(local+22,true);
  let localEnd=data+compressed;
  if(flags&8){
   // Streaming ZIP writers may leave these local fields zero and use a descriptor.
   if((localCrc!==0&&localCrc!==crc)||(localCompressed!==0&&localCompressed!==compressed)||(localExpanded!==0&&localExpanded!==expanded))invalid();
   if(localEnd+12>offset)invalid();
   const descriptor=localEnd+(view.getUint32(localEnd,true)===0x08074b50?4:0);
   if(descriptor+12>offset||view.getUint32(descriptor,true)!==crc||view.getUint32(descriptor+4,true)!==compressed||view.getUint32(descriptor+8,true)!==expanded)invalid();
   localEnd=descriptor+12;
  }else if(localCrc!==crc||localCompressed!==compressed||localExpanded!==expanded)invalid();
  if(localRanges.some(([start,stop])=>local<stop&&localEnd>start))invalid();
  members.push({local,data,compressed,expanded,crc,method,streaming:!!(flags&8)});
  localRanges.push([local,localEnd]);p=next;
 }
 if(p!==end)invalid();
 // Validate all payloads only after the complete metadata/overlap guard.
 // The native pass streams output without retaining expanded buffers. The
 // subsequent pinned-inflater boundary probe allocates expanded output briefly.
 let actualTotal=0;
 for(const entry of members){
  const payload=bytes.subarray(entry.data,entry.data+entry.compressed);
  if(entry.method===0){
   if(entry.compressed!==entry.expanded)invalid();
   if(crc32(payload)!==entry.crc)throw Error('Invalid workbook ZIP CRC32 for stored entry');
   actualTotal+=entry.expanded;if(actualTotal>maxExpansion)throw Error('Workbook actual expansion exceeds 40 MiB');
  }else{
   const result=await validateDeflate(payload,entry.expanded,actualTotal);actualTotal+=result.count;
   if(result.crc!==entry.crc)throw Error('Invalid workbook ZIP CRC32 for DEFLATE entry');
   // Native streams do not expose consumed input and may ignore trailing bytes.
   // Only after their CRC/size validation, reuse the pinned inflater's read head
   // on a private copy. Never expose unchecked streams to its permissive decoder.
   const probe=payload.slice();probe.l=0;
   XLSX.CFB.utils._inflateRaw(probe,entry.expanded);
   if(probe.l!==payload.length)throw Error('Invalid workbook ZIP DEFLATE trailing or unconsumed compressed bytes');
  }
 }
 // Normalize only a private parser copy, after all validation has succeeded.
 // Keep descriptors, flags, payloads and offsets intact; original upload bytes
 // remain the sole source of file hashes and row lineage.
 let normalized=null;
 for(const entry of members)if(entry.method===0&&entry.streaming){
  normalized??=bytes.slice();const target=new DataView(normalized.buffer,normalized.byteOffset,normalized.byteLength);
  target.setUint32(entry.local+14,entry.crc,true);target.setUint32(entry.local+18,entry.compressed,true);target.setUint32(entry.local+22,entry.expanded,true);
 }
 return normalized??bytes;
}
export async function readInputFile(input,name,assertedKind) {
 const bytes=new Uint8Array(input);
 if(bytes.length>10*1024*1024)throw Error('Files must be at most 10 MiB');
 const source=await createSource(bytes,name,{origin:'user',assertedKind,reference:`User-selected file: ${name}; content assertion unverified`});
 if(/\.csv$/i.test(name))return {source,table:parseCsv(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),sheets:[]};
 if(!/\.xlsx$/i.test(name))throw Error('Select a UTF-8 CSV or XLSX file');
 const parserBytes=await checkArchive(bytes);
 // Derive worksheet bounds from actual cells. A stale or forged dimension
 // must neither hide data rows nor bypass the adapter's row/column limits.
 const book=XLSX.read(parserBytes,{type:'array',cellFormula:true,cellDates:false,cellHTML:false,bookVBA:true,sheetStubs:true,nodim:true});
 if(book.vbaraw)throw Error('Macro-bearing workbooks are unsupported');
 if(book.SheetNames.length>50)throw Error('Workbook exceeds 50 sheets');
 const sheets=book.SheetNames.map(name=>{
  const sheet=book.Sheets[name],range=sheet['!ref']?XLSX.utils.decode_range(sheet['!ref']):null;
  // nodim uses A1 for a sheet with no actual cells; retain an empty table.
  if(!range||(range.e.r===0&&range.e.c===0&&!sheet.A1))return {name,rows:[]};
  if(range.e.r>100000||range.e.c>=100)throw Error('Sheet exceeds 100000 data rows or 100 columns');
  const rows=Array.from({length:range.e.r+1},(_,r)=>Array.from({length:range.e.c+1},(_,c)=>{
   const cell=sheet[XLSX.utils.encode_cell({r,c})];
   if(!cell)return null;
   if(cell.f!==undefined)return {formula:String(cell.f),cached:cell.v??null};
   if(cell.t==='e')return {spreadsheetError:cell.v??null};
   return cell.v??null;
  }));
  return {name,rows};
 });
 return {source,sheets,table:null};
}
export function selectedTable(parsed,sheet,headerRow) {
 if(parsed.table){if(headerRow!==1)throw Error('CSV uses its first row as the header');return parsed.table;}
 return selectSheet(parsed.sheets,sheet,headerRow);
}
export function validateSelected(parsed,sheet,headerRow,mapping) {
 return validateImport(selectedTable(parsed,sheet,headerRow),parsed.source,mapping);
}
