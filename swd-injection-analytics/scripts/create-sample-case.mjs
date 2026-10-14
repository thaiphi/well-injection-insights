// Writes the pinned sample case (two real TRRC injectors + labelled synthetic gaps), a byte-exact copy of the
// verified SAND BEND 2D package, and the case's byte pin. Never edits the source fixtures.
// Usage (after compiling): node scripts/create-sample-case.mjs [--out <dir>]  (default data/sample-case)
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {verifyExplorerPackage} from '../web/explorer-package.mjs';
import {SAMPLE_CASE_VERSION,deriveSurfaceLimitPsia,deriveDatumTvdFt,validateSampleCase,checkTrrcValues,checkDerivedValues,sourceValue} from '../dist/sampleCase.js';

const app=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,app));
const args=process.argv.slice(2),outAt=args.indexOf('--out');
const out=outAt>=0?args[outAt+1]:fileURLToPath(new URL('data/sample-case/',app));
if(!out)throw new Error('--out requires a directory');
const sha=b=>createHash('sha256').update(b).digest('hex');

const pinA=JSON.parse(read('data/explorer-pin.json')),artifactA=JSON.parse(read('data/explorer/normalized.json'));
const tar=read('tests/fixtures/explorer-packages/public-uic000056484.tar'),provenance=JSON.parse(read('tests/fixtures/explorer-packages/provenance.json'));
if(sha(tar)!==provenance.packageSha256||tar.length!==provenance.packageBytes)throw new Error('SAND BEND 2D package does not match its recorded provenance');
const pkg=await verifyExplorerPackage(new Uint8Array(tar));
const INVENTORY='TRRC UIC inventory givw-z9t4',MONTHLY='TRRC H-10 monthly reports qq2j-f2zm';
const ENGINEERING=['comparison','sensitivity','hydraulics'];

function trrc(artifact,key,label,field,unit,tools,dataset=INVENTORY){return {key,label,value:sourceValue(artifact,field),unit,class:'trrc-public-record',source:`${dataset} (${artifact.artifactId})`,trrcField:field,tools};}
function synthetic(key,label,value,unit,tools){return {key,label,value,unit,class:'synthetic',source:'Synthetic sample value — you gather',tools};}
function well({id,label,artifact,pin,origin,packagePin,eng}){
 const months=artifact.injectionMonthly.map(r=>r.period_start).sort();
 const permit=sourceValue(artifact,'permit_liquid_pressure_limit_psi'),top=sourceValue(artifact,'permitted_top_depth_ft');
 return {id,label,trrc:{origin,artifactId:artifact.artifactId,manifestSha256:pin.manifestSha256,normalizedSha256:pin.normalizedSha256,firstMonth:months[0].slice(0,7),lastMonth:months.at(-1).slice(0,7),...(packagePin?{package:packagePin}:{})},inputs:[
  trrc(artifact,'uicNumber','UIC number','uic_number',null,['publicTrends']),
  trrc(artifact,'apiNo','API number','api_no',null,['publicTrends']),
  trrc(artifact,'operatorNumber','Operator number','operator_number',null,['publicTrends']),
  trrc(artifact,'districtCode','District','district_code',null,['publicTrends']),
  trrc(artifact,'leaseName','Lease name','lease_name',null,['publicTrends']),
  trrc(artifact,'wellNoDisplay','Well number','well_no_display',null,['publicTrends']),
  trrc(artifact,'county','County (from the API prefix)','county',null,['publicTrends']),
  trrc(artifact,'permitPressurePsi','Permit maximum injection pressure','permit_liquid_pressure_limit_psi','psi, as permitted (basis not stated)',['publicTrends',...ENGINEERING]),
  trrc(artifact,'permitVolumeBpd','Permit maximum injection volume (for comparison; not a model limit)','permit_liquid_volume_limit_bpd','bbl/day',['publicTrends']),
  trrc(artifact,'permittedTopFt','Permitted interval top','permitted_top_depth_ft','ft',['publicTrends','comparison','hydraulics']),
  trrc(artifact,'permittedBottomFt','Permitted interval bottom','permitted_bottom_depth_ft','ft',['publicTrends']),
  trrc(artifact,'monthlyRows','Monthly injected liquid and reported injection pressure','injectionMonthly.length','months of H-10 reports; bbl and psi (basis unspecified)',['publicTrends'],MONTHLY),
  {key:'surfaceLimitPsia',label:'Surface pressure limit (absolute)',value:deriveSurfaceLimitPsia(permit),unit:'psia at wellhead',class:'derived-with-assumption',source:'Derived from the TRRC permit maximum injection pressure',derivedFrom:['permitPressurePsi'],assumption:'The permit limit is gauge pressure at the surface, and atmospheric pressure is 14.7 psi.',tools:ENGINEERING},
  {key:'datumTvdFt',label:'Formation datum true vertical depth',value:deriveDatumTvdFt(top),unit:'ft TVD below wellhead',class:'derived-with-assumption',source:'Derived from the TRRC permitted interval top',derivedFrom:['permittedTopFt'],assumption:'The top of the permitted interval is the datum, and the well is vertical to the datum.',tools:ENGINEERING},
  synthetic('reservoirPsia','Reservoir pressure at datum',eng.reservoirPsia,'psia, bottomhole at datum',ENGINEERING),
  synthetic('limitPsia','Bottomhole pressure limit at datum',eng.limitPsia,'psia, bottomhole at datum',ENGINEERING),
  synthetic('injectivityStbdPerPsi','Injectivity index J',eng.j,'STB/day/psi',ENGINEERING),
  synthetic('operatingCeilingStbd','Operating rate ceiling',eng.ceiling,'STB/day',ENGINEERING),
  synthetic('availability','Availability',0.9,'fraction of calendar time',['comparison','sensitivity']),
  synthetic('measuredDepthFt','Measured depth to datum',eng.md,'ft',['comparison','hydraulics']),
  synthetic('innerDiameterInches','Tubing inner diameter',eng.tubingId,'in',ENGINEERING),
  synthetic('roughnessInches','Tubing absolute roughness',0.0006,'in',['comparison','hydraulics']),
 ]};
}
const sample={version:SAMPLE_CASE_VERSION,caseId:'swd-sample-case/uic000020838+uic000056484/v1',name:'Sample case — TRRC record + synthetic gaps',
 producers:{fixtureId:'synthetic-water/seed-417/v1',class:'synthetic'},
 wells:[
  well({id:'UIC-000020838',label:'UIC 000020838',artifact:artifactA,pin:pinA,origin:'pinned-explorer',eng:{reservoirPsia:2400,limitPsia:3600,j:5,ceiling:9000,md:5200,tubingId:3.958}}),
  well({id:'UIC-000056484',label:'SAND BEND 2D · UIC 000056484',artifact:pkg.artifact,pin:pkg.pin,origin:'explorer-package',packagePin:{path:'public-uic000056484.tar',sha256:provenance.packageSha256,bytes:provenance.packageBytes},eng:{reservoirPsia:1400,limitPsia:2100,j:0.5,ceiling:1000,md:3028,tubingId:2.441}}),
 ],
 shared:[
  {key:'producerHistories',label:'Monthly producer water (and oil) volumes',value:'synthetic-water/seed-417/v1',unit:'STB/day, calendar-day basis',class:'synthetic',source:'Synthetic seed-417 producers — you gather',tools:['history','forecast','comparison']},
  {key:'producerSchedules',label:'New-producer schedule (start, ramp, availability)',value:'Seed-417 demo defaults',unit:'date; months; fraction',class:'synthetic',source:'Synthetic schedule — you gather',tools:['comparison','sensitivity']},
  synthetic('referencePressurePsia','Brine reference pressure',2400,'psia',['comparison','pvt','hydraulics']),
  synthetic('temperatureF','Bottomhole temperature',150,'°F',['comparison','pvt','hydraulics']),
  synthetic('surfaceTemperatureF','Surface temperature',80,'°F',['comparison','hydraulics']),
  synthetic('salinityWtPercent','Brine salinity (NaCl)',8,'wt%',['comparison','pvt','hydraulics']),
 ],
 gatherOnly:[
  {key:'pressureBasis',label:'Basis and datum of reported injection pressure',why:'TRRC reports injection pressure without a stated basis; it is never treated as bottomhole pressure',tools:['publicTrends']},
  {key:'bottomholePressure',label:'Measured bottomhole pressure and well tests (step-rate, falloff)',why:'Needed to calibrate J and reservoir pressure',tools:['comparison','sensitivity']},
  {key:'annulusData',label:'Annulus pressure records',why:'Not in the TRRC data the Explorer reads; no annulus values are synthesized',tools:['publicTrends']},
  {key:'fracDates',label:'Frac and treatment dates',why:'Used by the pressure-support context view',tools:['pressureSupport']},
  {key:'associations',label:'Producer–injector associations and distances',why:'Not built in the Explorer yet (planned, RRC-07)',tools:['pressureSupport']},
 ]};
const issues=[...validateSampleCase(sample),...checkTrrcValues(sample.wells[0],artifactA,pinA),...checkTrrcValues(sample.wells[1],pkg.artifact,pkg.pin),...sample.wells.flatMap(checkDerivedValues)];
if(issues.length)throw new Error('Sample case rejected:\n'+issues.join('\n'));
const bytes=Buffer.from(JSON.stringify(sample,null,2)+'\n','utf8');
const pin={file:'sample-case.json',caseId:sample.caseId,version:SAMPLE_CASE_VERSION,sha256:sha(bytes),bytes:bytes.length,
 wells:sample.wells.map(w=>({id:w.id,artifactId:w.trrc.artifactId,origin:w.trrc.origin,...(w.trrc.package?{packageSha256:w.trrc.package.sha256}:{})}))};
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'sample-case.json'),bytes);writeFileSync(join(out,'public-uic000056484.tar'),tar);writeFileSync(join(out,'pin.json'),JSON.stringify(pin,null,2)+'\n');
console.log(`${pin.caseId} ${pin.sha256} ${pin.bytes} bytes`);
