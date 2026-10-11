import {readFile} from 'node:fs/promises';import {resolve,sep} from 'node:path';import {createHash} from 'node:crypto';
import {validatePublicArtifact} from '../dist/publicArtifact.js';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const normalizedCsvCell=value=>Array.isArray(value)?value.join('|'):String(value??'');
export function parseCsv(text) {
  const records=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"'){if(cell)throw new Error('Invalid CSV quote');quoted=true;}
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\n'){row.push(cell.replace(/\r$/,''));records.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Unterminated CSV quote');
  if(row.length||cell){row.push(cell);records.push(row);}
  const [header,...body]=records;
  if(!header || new Set(header).size!==header.length)throw new Error('Invalid CSV header');
  return body.filter(row=>row.some(Boolean)).map(row=>{if(row.length!==header.length)throw new Error('CSV row width mismatch');return Object.fromEntries(header.map((name,i)=>[name,row[i]]));});
}
export async function verifyArtifact(directory) {
  const root=resolve(directory);
  const manifestBytes=await readFile(resolve(root,'manifest.json'));
  const manifest=JSON.parse(manifestBytes);
  if(manifest.schema_version!==1 || !manifest.artifact_id)throw new Error('Manifest schema mismatch');
  const entries=[...Object.entries(manifest.files),...manifest.sources.map(s=>[s.raw_file,s])];
  for(const [filename,metadata] of entries){
    const path=resolve(root,filename);
    if(!path.startsWith(root+sep))throw new Error('Invalid artifact file path');
    const bytes=await readFile(path);
    if(bytes.length!==metadata.bytes||sha256(bytes)!==metadata.sha256)throw new Error(`Artifact checksum mismatch: ${filename}`);
  }
  const normalizedBytes=await readFile(resolve(root,'normalized.json'));
  const artifact=await validatePublicArtifact(JSON.parse(normalizedBytes));
  if(artifact.artifactId!==manifest.artifact_id||JSON.stringify(artifact.manifest)!==JSON.stringify(manifest))throw new Error('Normalized manifest identity mismatch');
  for(const [file,records] of [['inventory.csv',artifact.inventory],['injection_monthly.csv',artifact.injectionMonthly]]){
    const csv=parseCsv(await readFile(resolve(root,file),'utf8'));
    if(csv.length!==records.length)throw new Error(`${file} record count mismatch`);
    for(let i=0;i<csv.length;i++)for(const [key,value] of Object.entries(csv[i]))if(value!==normalizedCsvCell(records[i][key]))throw new Error(`${file} normalized value mismatch at ${i+1}:${key}`);
  }
  for(const [file,value] of [['quality_report.json',artifact.qualityReport],['data_dictionary.json',artifact.dataDictionary]])if(JSON.stringify(JSON.parse(await readFile(resolve(root,file),'utf8')))!==JSON.stringify(value))throw new Error(`Normalized ${file} mismatch`);
  return {artifact,pin:{artifactId:artifact.artifactId,manifestSha256:sha256(manifestBytes),normalizedSha256:sha256(normalizedBytes),filesVerified:entries.length}};
}
