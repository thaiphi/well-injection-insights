import {PROFILE_FIELDS,type Cell,type Mapping,type Source,type Table,type Profile} from './importProfile.js';
import {daysInMonth} from './planning.js';
export type HistoryInput={profile:'history';producerId:string;groupId:string;month:string;rateStbd:number|null;volumeBbl:number|null};
export type ScheduleInput={profile:'schedule';producerId:string;groupId:string;startDate:string;initialRateStbd:number;monthlyDecline:number;availability:number};
export type InjectorInput={profile:'injector';id:string;reservoirPsia:number;limitPsia:number;injectivityStbdPerPsi:number;operatingCeilingStbd:number;availability:number;datum:string;reservoirDatum:string;limitDatum:string;reservoirPressureBasis:'bottomhole-absolute';limitPressureBasis:'bottomhole-absolute';pressureBasis:'bottomhole-absolute'};
export type NormalizedInput=HistoryInput|ScheduleInput|InjectorInput;
export type ImportError={code:string;field:string;message:string};
export type ValidatedRow={id:string;disposition:'accepted'|'quarantined';value:NormalizedInput|null;errors:ImportError[];lineage:{source:Source;sheet:string|null;headerRow:number;originalRow:number;originalValues:Cell[];originalHeaders:string[];mapping:Mapping;transformations:string[];calculatedFields:string[];normalizationVersion:'swd-import/1'}};
export type ImportResult={profile:Profile;id:string;version:'swd-import/1';errors:ImportError[];rows:ValidatedRow[];counts:{accepted:number;quarantined:number;excluded:number}};
export function validMonth(value:string):boolean {return /^(?:[1-9]\d{3})-(?:0[1-9]|1[0-2])$/.test(value);}
function validDate(value:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!validMonth(value.slice(0,7)))return false;
  const day=Number(value.slice(8));return day>=1&&day<=daysInMonth(value.slice(0,7));
}
const spreadsheetErrorLabels:Record<string,string>={'0':'#NULL!','7':'#DIV/0!','15':'#VALUE!','23':'#REF!','29':'#NAME?','36':'#NUM!','42':'#N/A','43':'#GETTING_DATA'};
/** Mapping is explicit and confirmed by the caller. Invalid rows remain inspectable, never coerced/dropped. */
export function validateImport(table:Table,source:Source,mapping:Mapping):ImportResult {
  const errors:ImportError[]=[];
  const error=(code:string,field:string,message:string)=>({code,field,message});
  const fields=PROFILE_FIELDS[mapping.profile];
  if(!fields)throw new Error('Unsupported import profile');
  if(!mapping.confirmed || !mapping.version?.trim()) errors.push(error('mapping','mapping','Confirm a versioned mapping before normalization'));
  const selected=fields.map(f=>mapping.columns[f]);
  if(selected.some(c=>!c || !table.headers.includes(c)) || new Set(selected).size!==fields.length) errors.push(error('mapping','columns','Map each required field to a distinct existing column'));
  const expected=mapping.profile==='history'?{water:mapping.units.water}:mapping.profile==='schedule'?{initialRate:'STB/day',monthlyDecline:'fraction/month',availability:'fraction'}:{injectivity:'STB/day/psi',reservoirPressure:'psia',limitPressure:'psia',operatingCeiling:'STB/day',availability:'fraction'};
  for(const [field,unit] of Object.entries(expected)) if(!unit || mapping.units[field]!==unit)errors.push(error('unit',field,'Unsupported or ambiguous declared unit'));
  if(mapping.profile==='history') {
    const basis:Record<string,string>={'STB/day':'calendar-day','STB/hour':'calendar-hour','STB':'calendar-month'};
    if(!basis[mapping.units.water] || basis[mapping.units.water]!==mapping.timeBasis)errors.push(error('unit','water','Declare stock-tank rate or calendar-month volume with compatible time basis'));
  }
  if(!source.name || !/^[a-f0-9]{64}$/.test(source.sha256) || !source.reference)errors.push(error('source','source','Missing file hash/name/source reference'));
  const mappingCopy=structuredClone(mapping),sourceCopy=structuredClone(source);
  // A content-addressed source alone is insufficient: mapping and selected-sheet identity
  // must distinguish normalization runs even if a caller reuses a mapping version.
  const normalizationId=JSON.stringify(['swd-import/1',source.sha256,table.format,table.sheet,table.headerRow,{
    profile:mapping.profile,version:mapping.version,confirmed:mapping.confirmed,
    columns:Object.entries(mapping.columns).sort(([a],[b])=>a.localeCompare(b)),
    units:Object.entries(mapping.units).sort(([a],[b])=>a.localeCompare(b)),timeBasis:mapping.timeBasis??null,
  }]);
  const rows:ValidatedRow[]=table.rows.map(row=>{
    const rowErrors=[...errors],transformations:string[]=[],calculatedFields:string[]=[];
    const add=(code:string,field:string,message:string)=>rowErrors.push(error(code,field,message));
    // Invalid spreadsheet cells anywhere in a selected row remain inspectable,
    // including unmapped columns; neither error codes nor caches are substituted.
    if(row.values.some(v=>v!==null&&typeof v==='object'&&!('spreadsheetError' in v))) add('formula','row','Formula cells are unsupported; cached values are not substituted');
    row.values.forEach((v,index)=>{
      if(v!==null&&typeof v==='object'&&'spreadsheetError' in v){
        const field=fields.find(f=>mapping.columns[f]===table.headers[index])??table.headers[index]??'row';
        const code=v.spreadsheetError??'unknown code',label=spreadsheetErrorLabels[String(code)];
        add('spreadsheet-error',field,`Spreadsheet error cell ${label?`${label} (code ${code})`:String(code)}; correct the source workbook`);
      }
    });
    const get=(f:string):Cell|undefined=>row.values[table.headers.indexOf(mapping.columns[f])];
    const text=(f:string):string=>{const v=get(f);if(typeof v!=='string'||!v.trim()||v!==v.trim()){add('identity',f,'Explicit nonempty text without outer whitespace required');return '';}return v;};
    const number=(f:string,optional=false):number|null=>{
      const v=get(f);
      if(v===null||v==='') {if(!optional)add('missing',f,'Value is missing');return null;}
      if(typeof v!=='number' && (typeof v!=='string'||! /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v))) {add('number',f,'Expected a finite decimal; no locale or boolean coercion');return null;}
      const n=Number(v);if(!Number.isFinite(n)||n<0){add('number',f,'Expected finite nonnegative value');return null;}return n;
    };
    const fraction=(f:string):number=>{const n=number(f);if(n!==null&&n>1)add('range',f,'Expected fraction from zero to one');return n??NaN;};
    let value:NormalizedInput|null=null;
    if(!rowErrors.length) {
      if(mapping.profile==='history') {
        const producerId=text('producerId'),groupId=text('groupId'),month=text('month'),water=number('water',true);
        if(!validMonth(month))add('month','month','Expected YYYY-MM reporting month');
        if(!rowErrors.length) {
          const days=daysInMonth(month),unit=mapping.units.water;
          const rateStbd=water===null?null:unit==='STB'?water/days:unit==='STB/hour'?water*24:water;
          const volumeBbl=water===null?null:unit==='STB'?water:rateStbd!*days;
          transformations.push(`water ${unit} -> STB/day and STB; ${days} actual calendar days; ${mapping.timeBasis}`);
          if(water!==null)calculatedFields.push(...(unit==='STB'?['rateStbd']:unit==='STB/hour'?['rateStbd','volumeBbl']:['volumeBbl']));
          value={profile:'history',producerId,groupId,month,rateStbd,volumeBbl};
        }
      } else if(mapping.profile==='schedule') {
        const producerId=text('producerId'),groupId=text('groupId'),startDate=text('startDate'),initialRateStbd=number('initialRate'),monthlyDecline=number('monthlyDecline'),availability=fraction('availability');
        if(!validDate(startDate))add('date','startDate','Expected valid YYYY-MM-DD calendar date');
        value={profile:'schedule',producerId,groupId,startDate,initialRateStbd:initialRateStbd??NaN,monthlyDecline:monthlyDecline??NaN,availability};
      } else {
        const id=text('id'),reservoirPsia=number('reservoirPressure'),limitPsia=number('limitPressure'),injectivityStbdPerPsi=number('injectivity'),operatingCeilingStbd=number('operatingCeiling'),availability=fraction('availability');
        const rb=text('reservoirBasis'),lb=text('limitBasis'),rd=text('reservoirDatum'),ld=text('limitDatum');
        if(rb!=='bottomhole-absolute'||lb!==rb||rd!==ld)add('pressure','pressureBasis','Require compatible absolute bottomhole pressures at the same datum within this injector');
        if(reservoirPsia===0||limitPsia===0||injectivityStbdPerPsi===0)add('range','injector','Pressures and injectivity must be positive');
        value={profile:'injector',id,reservoirPsia:reservoirPsia??NaN,limitPsia:limitPsia??NaN,injectivityStbdPerPsi:injectivityStbdPerPsi??NaN,operatingCeilingStbd:operatingCeilingStbd??NaN,availability,datum:rd,reservoirDatum:rd,limitDatum:ld,reservoirPressureBasis:'bottomhole-absolute',limitPressureBasis:'bottomhole-absolute',pressureBasis:'bottomhole-absolute'};
      }
      if(value && Object.values(value).some(v=>typeof v==='number'&&!Number.isFinite(v))) add('number','row','Conversion overflow or missing numeric value');
    }
    return {id:JSON.stringify([normalizationId,row.originalRow]),disposition:rowErrors.length?'quarantined':'accepted',value:rowErrors.length?null:value,errors:rowErrors,lineage:{source:sourceCopy,sheet:table.sheet,headerRow:table.headerRow,originalRow:row.originalRow,originalValues:structuredClone(row.values),originalHeaders:[...table.headers],mapping:mappingCopy,transformations,calculatedFields,normalizationVersion:'swd-import/1'}};
  });
  // Compare raw mapped identities as well: an invalid duplicate cannot hide behind quarantine.
  const groups=new Map<string,ValidatedRow[]>();
  for(const row of rows) {
    const f=mapping.profile==='history'?['producerId','month']:mapping.profile==='schedule'?['producerId']:['id'];
    const parts=f.map(k=>row.lineage.originalValues[table.headers.indexOf(mapping.columns[k])]);
    if(parts.some(x=>typeof x!=='string'||!x))continue;
    const key=JSON.stringify(parts);groups.set(key,[...(groups.get(key)??[]),row]);
  }
  for(const group of groups.values())if(group.length>1)for(const row of group){row.errors.push(error('duplicate','identity','Duplicate/conflicting identity requires explicit resolution'));row.disposition='quarantined';row.value=null;}
  const accepted=rows.filter(r=>r.disposition==='accepted').length;
  return {profile:mapping.profile,id:normalizationId,version:'swd-import/1',errors,rows,counts:{accepted,quarantined:rows.length-accepted,excluded:0}};
}



