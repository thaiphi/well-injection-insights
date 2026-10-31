import {validatePublicArtifact} from '../dist/publicArtifact.js';
import {inventoryColumns,monthlyColumns,normalizeExplorerRows,createExplorerDictionary,sameExplorerValue,verifyRecordedExplorerEvidence} from './explorer-evidence.mjs';
import {normalizeExplorerTests,explorerCsv,testColumns,testReportOrder,TESTS_DICTIONARY_SHA256} from './explorer-tests.mjs';

// The producer emits bounded regular-file USTAR only. No extraction, network,
// server writes, or execution of archived HTML/PDF/JavaScript takes place here.
export const EXPLORER_PACKAGE_LIMITS=Object.freeze({fileBytes:10_000_000,totalBytes:80_000_000,files:103,packageBytes:80_106_496,jsonDepth:64,jsonNodes:250_000});
const trustedLegacy=Object.freeze({artifactId:'rrc-2026-10-09-uic000020838-v1',manifestSha256:'3a523cadca4c7a35d667ccd53629d63e5afc6de382be670cba1d61743baef61f',normalizedSha256:'4f243138c833f09a5be6a970e85f76f3f73e95040c69677a10b8c3b2fe03ca5b'});
const textDecoder=new TextDecoder('utf-8',{fatal:true}),textEncoder=new TextEncoder();
const hashPattern=/^[a-f0-9]{64}$/;
const payloadHashMethod='SHA256 of UTF-8 JSON.stringify({schemaVersion,artifactId,inventory,injectionMonthly,qualityReport,dataDictionary}), in this key order, excluding manifest to avoid circularity';
const fail=message=>{throw Object.assign(Error(message),{code:'EXPLORER_PACKAGE_INVALID'});};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const same=(left,right,message)=>{if(!sameExplorerValue(left,right))fail(message);};
const zero=bytes=>bytes.every(byte=>byte===0);
function pathName(name){
 if(typeof name!=='string'||name.length>100||!/^[a-zA-Z0-9_.\/-]+$/.test(name)||name.split('/').some(part=>!part||part==='.'||part==='..'))fail('Unsafe Explorer package path');
 return name;
}
function headerString(bytes){
 const end=bytes.indexOf(0),value=end<0?bytes:bytes.subarray(0,end);
 if((end>=0&&!zero(bytes.subarray(end)))||value.some(byte=>byte<32||byte>126))fail('Invalid TAR text field');
 return String.fromCharCode(...value);
}
function octal(bytes,label){
 const value=String.fromCharCode(...bytes);
 if(!/^[0-7]+[\0 ]*$/.test(value))fail(`Invalid TAR ${label}`);
 const number=parseInt(value,8);if(!Number.isSafeInteger(number)||number<0)fail(`Invalid TAR ${label}`);return number;
}
function readTar(bytes){
 if(bytes.length<1024||bytes.length%512)fail('Truncated or unaligned TAR package');
 const files=new Map(),folded=new Set();let offset=0,total=0;
 while(offset+512<=bytes.length){
  const header=bytes.subarray(offset,offset+512);
  if(zero(header)){
   if(offset+1024>bytes.length||!zero(bytes.subarray(offset)))fail('Invalid TAR end marker or trailing data');
   if(!files.size)fail('Empty Explorer package');return files;
  }
  const stored=octal(header.subarray(148,156),'checksum');let checksum=0;
  for(let i=0;i<512;i++)checksum+=i>=148&&i<156?32:header[i];
  if(stored!==checksum)fail('TAR header checksum mismatch');
  if(header[156]!==48||!zero(header.subarray(157,257))||headerString(header.subarray(257,263))!=='ustar'||headerString(header.subarray(263,265))!=='00'||!zero(header.subarray(345)))fail('Only regular-file Explorer USTAR entries are supported; links and extensions refused');
  for(const [start,width,label] of [[100,8,'mode'],[108,8,'owner'],[116,8,'group'],[136,12,'time']])octal(header.subarray(start,start+width),label);
  const name=pathName(headerString(header.subarray(0,100))),size=octal(header.subarray(124,136),'size');
  if(folded.has(name.toLowerCase()))fail('Duplicate Explorer package path');
  if(files.size>=EXPLORER_PACKAGE_LIMITS.files||size>EXPLORER_PACKAGE_LIMITS.fileBytes||total+size>EXPLORER_PACKAGE_LIMITS.totalBytes)fail('Explorer package file or byte limit exceeded');
  const start=offset+512,end=start+size,next=start+Math.ceil(size/512)*512;
  if(next>bytes.length||!zero(bytes.subarray(end,next)))fail('Truncated TAR payload or nonzero padding');
  files.set(name,bytes.subarray(start,end));folded.add(name.toLowerCase());total+=size;offset=next;
 }
 fail('TAR package is missing its end marker');
}

// Strict RFC-style CSV parsing, retaining quoted newlines and leading zeros.
// Header completeness is checked against the exact producer column contract.
function parseCsv(text,columns){
 const records=[];let row=[],cell='',quoted=false,closed=false;
 const finishCell=()=>{row.push(cell);cell='';closed=false;};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else cell+=c;continue;}
  if(c===','){finishCell();continue;}
  if(c==='\r'||c==='\n'){
   if(c==='\r'){if(text[i+1]!=='\n')fail('Invalid CSV line ending');i++;}
   finishCell();records.push(row);row=[];continue;
  }
  if(closed)fail('Invalid character after CSV quote');
  if(c==='"'){if(cell)fail('Invalid CSV quote');quoted=true;}else cell+=c;
 }
 if(quoted)fail('Unterminated CSV quote');
 if(row.length||cell||closed){finishCell();records.push(row);}
 const header=records.shift();same(header,columns,'Explorer CSV header is missing, reordered or unsupported');
 for(const row of records)if(row.length!==columns.length)fail('Explorer CSV row width mismatch');
 return records;
}
const csvCell=value=>Array.isArray(value)?value.join('|'):String(value??'');
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function rejectDuplicateJsonKeys(text){
 const stack=[];
 for(let i=0;i<text.length;i++){
  const c=text[i],parent=stack.at(-1);
  if(c==='"'){
   const start=i;for(i++;i<text.length;i++){if(text[i]==='\\'){i++;continue;}if(text[i]==='"')break;}
   if(parent?.keys&&parent.expectKey){const key=JSON.parse(text.slice(start,i+1));if(parent.keys.has(key))fail('Duplicate JSON evidence key');parent.keys.add(key);parent.expectKey=false;}
  }else if(c==='{'){stack.push({keys:new Set(),expectKey:true});}
  else if(c==='['){stack.push({});}
  else if(c==='}'||c===']'){stack.pop();}
  else if(c===','&&parent?.keys){parent.expectKey=true;}
  if(stack.length>EXPLORER_PACKAGE_LIMITS.jsonDepth)fail('Explorer JSON structure exceeds bounded limits');
 }
}

/** Verify a complete Explorer download without changing the current selection.
 * Input is ArrayBuffer/Uint8Array (including Node Buffer). The caller previews
 * the returned immutable candidate and adopts it only on a separate user action.
 * Dynamic packages prove internal recorded-evidence consistency, not independent
 * authentication of their public-source acquisition. No package-provided hash is
 * accepted as a trust anchor. The known legacy pin has an external digest anchor.
 */
export async function verifyExplorerPackage(input,{signal}={}){
 const view=input instanceof Uint8Array?input:input instanceof ArrayBuffer?new Uint8Array(input):null;
 if(!view)fail('Explorer package must contain TAR bytes');
 if(view.byteLength>EXPLORER_PACKAGE_LIMITS.packageBytes)fail('Explorer package exceeds the byte limit');
 if(!globalThis.crypto?.subtle)fail('SHA-256 verification is unavailable in this browser context');
 signal?.throwIfAborted();
 // Own the bytes before the first await; caller mutation cannot race verification.
 const bytes=new Uint8Array(view),files=readTar(bytes),hashes=new Map(),parsed=new Map();
 const read=name=>{const body=files.get(pathName(name));if(!body)fail(`Explorer package is missing ${name}`);return body;};
 const sha256=async body=>{signal?.throwIfAborted();const digest=await globalThis.crypto.subtle.digest('SHA-256',body);signal?.throwIfAborted();return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');};
 const hash=async name=>{if(!hashes.has(name))hashes.set(name,await sha256(read(name)));return hashes.get(name);};
 const decode=name=>{try{return textDecoder.decode(read(name));}catch{fail(`Invalid UTF-8 evidence: ${name}`);}};
 const json=name=>{
  if(parsed.has(name))return parsed.get(name);
  let value;try{const text=decode(name);rejectDuplicateJsonKeys(text);value=JSON.parse(text);}catch(error){if(error.code==='EXPLORER_PACKAGE_INVALID')throw error;fail(`Invalid JSON evidence: ${name}`);}
  const stack=[[value,0]];let nodes=0;
  while(stack.length){
   const [node,depth]=stack.pop();if(++nodes>EXPLORER_PACKAGE_LIMITS.jsonNodes||depth>EXPLORER_PACKAGE_LIMITS.jsonDepth)fail('Explorer JSON structure exceeds bounded limits');
   if(node&&typeof node==='object'){
    if(node.testFixture===true||node.classification==='test_fixture')fail(`Fixture evidence cannot be adopted as public history: ${name}`);
    for(const child of Object.values(node))stack.push([child,depth+1]);
   }
  }
  parsed.set(name,value);return value;
 };
 const manifest=json('manifest.json'),normalized=json('normalized.json');
 if(!object(manifest)||manifest.schema_version!==1||typeof manifest.artifact_id!=='string'||!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(manifest.artifact_id)||!object(manifest.files)||!Array.isArray(manifest.sources)||manifest.sources.length>100)fail('Unsupported Explorer manifest schema');
 if(!object(normalized))fail('Invalid normalized Explorer document');
 same(Object.keys(normalized).sort(),['artifactId','dataDictionary','injectionMonthly','inventory','manifest','qualityReport','schemaVersion'],'Unsupported normalized Explorer schema');
 if(normalized.schemaVersion!==1)fail('Unsupported normalized Explorer schema version');
 if(normalized.artifactId!==manifest.artifact_id)fail('Normalized artifact identity mismatch');
 same(normalized.manifest,manifest,'Normalized manifest identity mismatch');
 const manifestSha256=await hash('manifest.json'),normalizedSha256=await hash('normalized.json');
 const legacy=manifest.artifact_id===trustedLegacy.artifactId&&manifestSha256===trustedLegacy.manifestSha256&&normalizedSha256===trustedLegacy.normalizedSha256;
 const queryVersion=manifest.scope?.query_version,dynamic=queryVersion===2||queryVersion===4;
 if(!legacy&&queryVersion!==undefined&&!dynamic)fail(`Unsupported Explorer query version: ${queryVersion}`);
 if(!legacy&&!dynamic)fail('Public source proof unavailable: unrecognized legacy artifact');
 const expected=new Map();
 const add=(name,entry)=>{
  pathName(name);if(['manifest.json','normalized.json','version-pins.json'].includes(name)||!object(entry)||!hashPattern.test(entry.sha256)||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||entry.bytes>EXPLORER_PACKAGE_LIMITS.fileBytes)fail('Invalid manifest evidence entry');
  if(expected.has(name)&&(expected.get(name).sha256!==entry.sha256||expected.get(name).bytes!==entry.bytes))fail('Conflicting manifest source hash or byte inventories');
  expected.set(name,{sha256:entry.sha256,bytes:entry.bytes});
 };
 for(const [name,entry] of Object.entries(manifest.files))add(name,entry);
 for(const source of manifest.sources){if(!object(source))fail('Invalid manifest source');add(source.raw_file,source);}
 if(expected.size>100)fail('Manifest evidence file cap exceeded');
 const allowed=new Set(['manifest.json','normalized.json',...expected.keys(),...(dynamic?['version-pins.json']:[])]);
 if(files.size!==allowed.size||[...files.keys()].some(name=>!allowed.has(name)))fail('Explorer package has missing or undeclared files');
 for(const [name,entry] of expected)if(read(name).length!==entry.bytes||await hash(name)!==entry.sha256)fail(`Explorer evidence hash or byte count mismatch: ${name}`);
 let evidence;
 if(dynamic){
  const publication=json('version-pins.json');
  same(publication,{schemaVersion:1,artifactId:manifest.artifact_id,path:`/artifacts/${manifest.artifact_id}/`,manifestSha256,normalizedSha256,classification:'public_reported',realHistoryStatus:manifest.real_history_status},'Package publication pins contradict manifest identity or hashes');
  evidence=await verifyRecordedExplorerEvidence(manifest,{json,read,hash});
 }else{
  evidence={scope:{apiPrefix:'389',injectionType:'1',monthlyUic:'000020838',monthlyStart:'2024-01-01T00:00:00'},sourceIds:{inventory:`givw-z9t4:${(await hash('sources/candidate-inventory.json')).slice(0,16)}`,monthly:`qq2j-f2zm:${(await hash('sources/candidate-monthly.json')).slice(0,16)}`},rawInventory:json('sources/candidate-inventory.json'),rawMonthly:json('sources/candidate-monthly.json')};
 }
 const canonical=normalizeExplorerRows(evidence.rawInventory,evidence.rawMonthly,evidence.sourceIds,evidence.scope);
 // Match the producer's status rule independently of package-provided status.
 // Incomplete history can be verified evidence without becoming calculable.
 const historyStatus=canonical.monthly.length&&canonical.quality.inventory.accepted===canonical.inventory.length&&canonical.quality.monthly.accepted===canonical.monthly.length&&canonical.quality.parent_join.matched===canonical.monthly.length?'verified_bounded_linkage':'incomplete';
 if(manifest.real_history_status!==historyStatus)fail('Manifest history status contradicts canonical source dispositions');
 same(normalized.inventory,canonical.inventory,'Normalized inventory contradicts preserved source rows');
 same(normalized.injectionMonthly,canonical.monthly,'Normalized monthly values or identity contradict preserved source rows');
 same(normalized.qualityReport,canonical.quality,'Quality report contradicts canonical source dispositions');
 same(normalized.dataDictionary,createExplorerDictionary(canonical,dynamic),'Data dictionary does not preserve Explorer units, provenance or pressure semantics');
 for(const [name,value] of [['quality_report.json',normalized.qualityReport],['data_dictionary.json',normalized.dataDictionary]])same(json(name),value,`Normalized ${name} mismatch`);
 for(const [name,columns,rows] of [['inventory.csv',inventoryColumns,normalized.inventory],['injection_monthly.csv',monthlyColumns,normalized.injectionMonthly]]){
  const csv=parseCsv(decode(name),columns);
  if(csv.length!==rows.length)fail(`${name} record count mismatch`);
  for(let i=0;i<csv.length;i++)for(let j=0;j<columns.length;j++)if(csv[i][j]!==csvCell(rows[i][columns[j]]))fail(`${name} normalized value mismatch at ${i+1}:${columns[j]}`);
 }
 // Query version 4: re-derive Explorer's test sidecars from the hashed raw rows and compare bytes (V4 §6).
 let tests=null;
 if(queryVersion===4&&!legacy){
  for(const name of ['tests.json','tests_bhp.csv','tests_srt.csv','tests_dictionary.json'])if(!Object.hasOwn(manifest.files,name))fail(`Explorer package is missing ${name}`);
  const testRows=normalizeExplorerTests(evidence.rawTests,evidence.sourceIds,canonical.inventory,evidence.scope);
  if([...testRows.bhp,...testRows.srt].some(row=>row.quality_flags.some(flag=>flag.startsWith('source_scope:'))))fail('Test-report rows contradict the exact-UIC query');
  const status=rows=>rows.length?'returned_below_cap':'confirmed_empty';
  const expectedTests={schemaVersion:1,artifactId:manifest.artifact_id,scope:{query_version:4,uic_number:evidence.scope.monthlyUic,test_report_limit:1000,order:`BHP ${testReportOrder.bhp}; SRT ${testReportOrder.srt}`,bhp_returned:testRows.bhp.length,srt_returned:testRows.srt.length,bhp_status:status(testRows.bhp),srt_status:status(testRows.srt),window:'exact uic_no; not limited to reporting period'},bhp:testRows.bhp,srt:testRows.srt,quality:testRows.quality};
  if(decode('tests.json')!==JSON.stringify(expectedTests,null,2)+'\n')fail('tests.json contradicts preserved BHP/SRT source rows');
  for(const kind of ['bhp','srt'])if(decode(`tests_${kind}.csv`)!==explorerCsv(testRows[kind],testColumns[kind]))fail(`tests_${kind}.csv contradicts preserved ${kind.toUpperCase()} source rows`);
  if(await hash('tests_dictionary.json')!==TESTS_DICTIONARY_SHA256)fail("tests_dictionary.json is not Explorer's public test dictionary");
  tests={bhp:testRows.bhp,srt:testRows.srt,quality:testRows.quality,sha256:{'tests.json':await hash('tests.json'),'tests_bhp.csv':await hash('tests_bhp.csv'),'tests_srt.csv':await hash('tests_srt.csv'),'tests_dictionary.json':await hash('tests_dictionary.json')}};
 }
 const payload={schemaVersion:normalized.schemaVersion,artifactId:normalized.artifactId,inventory:normalized.inventory,injectionMonthly:normalized.injectionMonthly,qualityReport:normalized.qualityReport,dataDictionary:normalized.dataDictionary};
 if(manifest.normalized_payload_hash_method!==payloadHashMethod||manifest.normalized_payload_sha256!==await sha256(textEncoder.encode(JSON.stringify(payload))))fail('Normalized payload hash contract mismatch');
 // The unchanged strict validator remains the sole calculation eligibility
 // gate. Preserve every verified row, including quarantine and revisions.
 const artifact=normalized,calculationEligibility={ready:true,reasons:[]};
 try{await validatePublicArtifact(artifact);}catch(error){
  calculationEligibility.ready=false;
  calculationEligibility.reasons.push(error.message);
  if(!canonical.monthly.length)calculationEligibility.reasons.push('No monthly history is available.');
  for(const [issue,count] of Object.entries(canonical.quality.issue_counts))if(/^(parse_failure|invalid|inconsistent|duplicate|unmatched|ambiguous|source_scope)/.test(issue))calculationEligibility.reasons.push(`${issue}: ${count} retained row(s).`);
 }
 signal?.throwIfAborted();
 const pin={artifactId:artifact.artifactId,manifestSha256,normalizedSha256,filesVerified:expected.size,packageSha256:await sha256(bytes)};
 const provenance={acquisitionOrigin:'user_upload',contentKind:'public_reported',basis:legacy?'trusted_legacy_pinned_digests':'recorded_official_acquisition_v2',authentication:legacy?'trusted_pinned_digest':'not_established'};
 const periods=artifact.injectionMonthly.map(row=>row.period_start).sort();
 const preview={artifactId:artifact.artifactId,inventoryCount:artifact.inventory.length,monthlyCount:artifact.injectionMonthly.length,periodStart:periods[0]??null,periodEnd:periods.at(-1)??null,uicNumbers:[...new Set(artifact.injectionMonthly.map(row=>row.uic_number))],filesVerified:expected.size,packageFileCount:files.size,packageBytes:bytes.length,provenance,warnings:[...(legacy?[]:['Recorded acquisition evidence reconciles internally; independent source authenticity is not established.']),'Public monthly reported pressures are not BHP, reservoir pressure or controlled injection tests.','Monthly barrels/calendar days are calculated calendar-day averages, not measured daily operating rates.',...(tests?['BHP test values are as published: the source field is named psia but RRC Permian guidance says PSIG (Source field named psia; RRC Permian guidance says PSIG; unresolved, not converted). Test records are report rows, not pressure series.']:[])]};
 return freeze({artifact,pin,preview,calculationEligibility,files:[...files.keys()].sort(),tests});
}
