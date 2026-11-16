/** E11 depth-evidence profile: strict parse and validation of a user-uploaded CSV.
 * No unit stripping, no thousands separators, no guessing. Depths are ft. */
import {parseCsv} from './importProfile.js';

export const DEPTH_PROFILE_VERSION='depth-profile/1';
export const PROFILE_COLUMNS=['well_id','kind','top_depth_ft','bottom_depth_ft','depth_basis','md_ft','tvd_ft','reference','wellhead_below_reference_ft','size_in','label','pressure_psi','pressure_basis','test_date','test_type','source_ref','bottom_source_ref','content_class'] as const;
export type DepthBasis='MD'|'TVD'|'unknown';
export type ProfileKind='depth-reference'|'survey'|'casing'|'packer'|'permitted-interval'|'perforated-interval'|'formation-top'|'test-point';
export type ContentClass='public-reported'|'measured'|'assumed'|'literature';
export const CONTENT_CLASS_LABELS:Readonly<Record<ContentClass,string>>=Object.freeze({
  'public-reported':'Public, as reported','measured':'Measured (user, not verified)','assumed':'Assumed','literature':'Literature',
});
export type ProfileRow={row:number;wellId:string;kind:ProfileKind;topFt:number|null;bottomFt:number|null;basis:DepthBasis|null;mdFt:number|null;tvdFt:number|null;reference:string|null;wellheadBelowReferenceFt:number|null;sizeIn:number|null;label:string|null;pressurePsi:number|null;pressureBasis:'psia'|'psig'|null;testDate:string|null;testType:'static'|'flowing'|'step-rate'|'other'|null;sourceRef:string;bottomSourceRef:string|null;contentClass:ContentClass;raw:Readonly<Record<string,string>>};
export type Profile={version:typeof DEPTH_PROFILE_VERSION;rows:ProfileRow[]};
export type ProfileProblem={row:number|null;reason:string};
export class ProfileError extends Error {
  readonly problems:readonly ProfileProblem[];
  constructor(problems:readonly ProfileProblem[]) {
    super(`Depth profile refused: ${problems.map(p=>p.row===null?p.reason:`row ${p.row}: ${p.reason}`).join('; ')}`);
    this.name='ProfileError';this.problems=problems;
  }
}

const MAX_ROWS=2000,MAX_WELLS=20,MAX_REF=200,EPS=1e-6;
const KINDS:readonly ProfileKind[]=['depth-reference','survey','casing','packer','permitted-interval','perforated-interval','formation-top','test-point'];
const CLASSES:readonly ContentClass[]=['public-reported','measured','assumed','literature'];
const BASES:readonly DepthBasis[]=['MD','TVD','unknown'];
const TEST_TYPES=['static','flowing','step-rate','other'] as const;
const NUMBER=/^-?\d+(\.\d+)?$/;
const DATE=/^(\d{4})-(\d{2})-(\d{2})$/;

/** Fields each kind needs besides well_id, kind, source_ref and content_class. */
const REQUIRED:Record<ProfileKind,readonly (typeof PROFILE_COLUMNS)[number][]>={
  'depth-reference':['reference','wellhead_below_reference_ft'],
  'survey':['md_ft','tvd_ft'],
  'casing':['bottom_depth_ft','depth_basis'],
  'packer':['top_depth_ft','depth_basis'],
  'permitted-interval':['top_depth_ft','bottom_depth_ft','depth_basis'],
  'perforated-interval':['top_depth_ft','bottom_depth_ft','depth_basis'],
  'formation-top':['top_depth_ft','depth_basis','label'],
  'test-point':['top_depth_ft','depth_basis','pressure_psi','test_date','test_type'],
};

function realDate(s:string):boolean {
  const m=DATE.exec(s);if(!m)return false;
  const y=+m[1],mo=+m[2],d=+m[3];
  const dt=new Date(Date.UTC(y,mo-1,d));
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d;
}

export function parseDepthProfile(text:string):Profile {
  let table:ReturnType<typeof parseCsv>;
  try {table=parseCsv(text);}
  catch(e) {throw new ProfileError([{row:null,reason:`unreadable CSV: ${(e as Error).message}`}]);}
  const expected=new Set<string>(PROFILE_COLUMNS);
  const missing=PROFILE_COLUMNS.filter(c=>!table.headers.includes(c));
  const extra=table.headers.filter(h=>!expected.has(h));
  if(missing.length||extra.length) {
    const parts:string[]=[];
    if(missing.length)parts.push(`missing column(s) ${missing.join(', ')}`);
    if(extra.length)parts.push(`unexpected column(s) ${extra.join(', ')}`);
    throw new ProfileError([{row:null,reason:`columns must equal the profile columns exactly: ${parts.join('; ')}`}]);
  }
  if(table.rows.length===0) throw new ProfileError([{row:null,reason:'the profile has no data rows'}]);
  if(table.rows.length>MAX_ROWS) throw new ProfileError([{row:null,reason:`more than ${MAX_ROWS} rows (${table.rows.length})`}]);
  const wellCol=table.headers.indexOf('well_id');
  const wells=new Set(table.rows.map(r=>String(r.values[wellCol]??'').trim()).filter(Boolean));
  if(wells.size>MAX_WELLS) throw new ProfileError([{row:null,reason:`more than ${MAX_WELLS} wells (${wells.size})`}]);

  const problems:ProfileProblem[]=[];
  const rows:ProfileRow[]=[];
  table.rows.forEach((rec,i)=>{
    const row=i+1;
    const raw:Record<string,string>={};
    table.headers.forEach((h,j)=>{raw[h]=String(rec.values[j]??'');});
    const cell=(c:string):string|null=>{const v=raw[c].trim();return v===''?null:v;};
    const bad=(reason:string)=>{problems.push({row,reason});};
    const num=(c:string):number|null=>{
      const v=cell(c);if(v===null)return null;
      if(!NUMBER.test(v)||!Number.isFinite(Number(v))){bad(`${c} is not a plain number ("${v}")`);return null;}
      return Number(v);
    };
    const wellId=cell('well_id');
    if(wellId===null)bad('well_id is required');
    const kindRaw=cell('kind');
    const kind=KINDS.find(k=>k===kindRaw);
    if(!kind)bad(`unknown kind "${kindRaw??''}"`);
    const classRaw=cell('content_class');
    const contentClass=CLASSES.find(k=>k===classRaw);
    if(!contentClass)bad(`unknown content_class "${classRaw??''}"`);
    const sourceRef=cell('source_ref');
    if(sourceRef===null)bad('source_ref is required');
    else if(sourceRef.length>MAX_REF)bad(`source_ref is longer than ${MAX_REF} characters`);
    const bottomSourceRef=cell('bottom_source_ref');
    if(bottomSourceRef!==null&&bottomSourceRef.length>MAX_REF)bad(`bottom_source_ref is longer than ${MAX_REF} characters`);

    const topFt=num('top_depth_ft'),bottomFt=num('bottom_depth_ft'),mdFt=num('md_ft'),tvdFt=num('tvd_ft');
    const whFt=num('wellhead_below_reference_ft'),sizeIn=num('size_in'),pressurePsi=num('pressure_psi');
    for(const [c,v] of [['top_depth_ft',topFt],['bottom_depth_ft',bottomFt],['md_ft',mdFt],['tvd_ft',tvdFt],['wellhead_below_reference_ft',whFt]] as const) {
      if(v!==null&&v<0)bad(`${c} is negative`);
    }
    if(topFt!==null&&bottomFt!==null&&topFt>bottomFt)bad('top_depth_ft is deeper than bottom_depth_ft');
    if(sizeIn!==null&&sizeIn<=0)bad('size_in must be greater than 0');
    if(pressurePsi!==null&&pressurePsi<=0)bad('pressure_psi must be greater than 0');

    const basisRaw=cell('depth_basis');
    const basis=BASES.find(b=>b===basisRaw)??null;
    if(basisRaw!==null&&basis===null)bad(`depth_basis must be MD, TVD or unknown ("${basisRaw}")`);
    const pbRaw=cell('pressure_basis');
    const pressureBasis=pbRaw==='psia'||pbRaw==='psig'?pbRaw:null;
    if(pbRaw!==null&&pressureBasis===null)bad(`pressure_basis must be psia or psig ("${pbRaw}")`);
    const dateRaw=cell('test_date');
    if(dateRaw!==null&&!realDate(dateRaw))bad(`test_date must be a real YYYY-MM-DD date ("${dateRaw}")`);
    const ttRaw=cell('test_type');
    const testType=TEST_TYPES.find(t=>t===ttRaw)??null;
    if(ttRaw!==null&&testType===null)bad(`test_type must be static, flowing, step-rate or other ("${ttRaw}")`);

    if(kind) {
      for(const c of REQUIRED[kind]) {
        if(cell(c)===null)bad(`${kind} requires ${c}`);
      }
      if(kind==='formation-top'&&bottomFt!==null&&bottomSourceRef===null)bad('formation-top with bottom_depth_ft requires bottom_source_ref');
    }
    if(!wellId||!kind||!contentClass||sourceRef===null)return;
    rows.push({row,wellId,kind,topFt,bottomFt,basis,mdFt,tvdFt,reference:cell('reference'),wellheadBelowReferenceFt:whFt,sizeIn,label:cell('label'),pressurePsi,pressureBasis,testDate:dateRaw,testType,sourceRef,bottomSourceRef,contentClass,raw});
  });

  // Per-well rules, reported against the row at fault.
  const byWell=new Map<string,ProfileRow[]>();
  for(const r of rows){const l=byWell.get(r.wellId)??[];l.push(r);byWell.set(r.wellId,l);}
  for(const [wellId,list] of byWell) {
    for(const r of list.filter(x=>x.kind==='depth-reference').slice(1))problems.push({row:r.row,reason:`more than one depth-reference for well ${wellId}`});
    const stations=list.filter(r=>r.kind==='survey'&&r.mdFt!==null&&r.tvdFt!==null)
      .sort((a,b)=>a.mdFt!-b.mdFt!||a.row-b.row);
    for(const s of stations) {
      if(s.tvdFt!>s.mdFt!+EPS)problems.push({row:s.row,reason:`survey TVD is deeper than its MD for well ${wellId}`});
    }
    for(let k=1;k<stations.length;k++) {
      const p=stations[k-1],c=stations[k];
      if(c.mdFt===p.mdFt)problems.push({row:c.row,reason:`survey has a duplicate MD (${c.mdFt}) for well ${wellId}`});
      else if(c.tvdFt!<p.tvdFt!)problems.push({row:c.row,reason:`survey TVD falls as MD increases for well ${wellId}`});
    }
  }
  if(problems.length) {
    problems.sort((a,b)=>(a.row??0)-(b.row??0));
    throw new ProfileError(problems);
  }
  return {version:DEPTH_PROFILE_VERSION,rows};
}

/** Drops rows of wells that are no longer case wells; the rest keep their original row numbers. */
export function pruneProfile(p:Profile,caseWellIds:readonly string[]):{profile:Profile;dropped:{row:number;wellId:string}[]} {
  const keep=new Set(caseWellIds);
  const rows:ProfileRow[]=[],dropped:{row:number;wellId:string}[]=[];
  for(const r of p.rows) {
    if(keep.has(r.wellId))rows.push(r);else dropped.push({row:r.row,wellId:r.wellId});
  }
  dropped.sort((a,b)=>a.row-b.row);
  return {profile:{version:p.version,rows},dropped};
}

const A='FICTIONAL-INJ-A',B='FICTIONAL-INJ-B';
const csvRow=(f:Partial<Record<(typeof PROFILE_COLUMNS)[number],string|number>>)=>PROFILE_COLUMNS.map(c=>String(f[c]??'')).join(',');
/** Fictional example for the demo case only. Not typical values. */
export const FICTIONAL_DEPTH_PROFILE_CSV:string=[PROFILE_COLUMNS.join(','),
  csvRow({well_id:A,kind:'depth-reference',reference:'KB',wellhead_below_reference_ft:18,source_ref:'fictional example: depth reference',content_class:'assumed'}),
  csvRow({well_id:A,kind:'survey',md_ft:0,tvd_ft:0,source_ref:'fictional example: survey station',content_class:'assumed'}),
  csvRow({well_id:A,kind:'survey',md_ft:1000,tvd_ft:1000,source_ref:'fictional example: survey station',content_class:'assumed'}),
  csvRow({well_id:A,kind:'survey',md_ft:3318,tvd_ft:3018,source_ref:'fictional example: survey station',content_class:'assumed'}),
  csvRow({well_id:A,kind:'casing',top_depth_ft:0,bottom_depth_ft:2800,depth_basis:'MD',size_in:9.625,source_ref:'fictional example: casing record',content_class:'assumed'}),
  csvRow({well_id:A,kind:'packer',top_depth_ft:2950,depth_basis:'MD',source_ref:'fictional example: packer record',content_class:'assumed'}),
  csvRow({well_id:A,kind:'perforated-interval',top_depth_ft:3050,bottom_depth_ft:3250,depth_basis:'MD',source_ref:'fictional example: perforation record',content_class:'assumed'}),
  csvRow({well_id:A,kind:'formation-top',top_depth_ft:3000,bottom_depth_ft:3100,depth_basis:'TVD',label:'Fictional Sand A',source_ref:'fictional example: formation top',bottom_source_ref:'fictional example: formation base',content_class:'literature'}),
  csvRow({well_id:A,kind:'formation-top',top_depth_ft:2400,depth_basis:'TVD',label:'Fictional Shale B',source_ref:'fictional example: formation top',content_class:'literature'}),
  csvRow({well_id:A,kind:'test-point',top_depth_ft:3100,depth_basis:'MD',pressure_psi:1450,pressure_basis:'psig',test_date:'2028-01-15',test_type:'static',source_ref:'fictional example: gauge test',content_class:'measured'}),
  csvRow({well_id:A,kind:'test-point',top_depth_ft:3150,depth_basis:'MD',pressure_psi:1500,pressure_basis:'psia',test_date:'2028-02-10',test_type:'flowing',source_ref:'fictional example: gauge test',content_class:'measured'}),
  csvRow({well_id:B,kind:'depth-reference',reference:'KB',wellhead_below_reference_ft:18,source_ref:'fictional example: depth reference',content_class:'assumed'}),
  csvRow({well_id:B,kind:'casing',bottom_depth_ft:2600,depth_basis:'MD',size_in:7,source_ref:'fictional example: casing record',content_class:'assumed'}),
  csvRow({well_id:B,kind:'permitted-interval',top_depth_ft:2900,bottom_depth_ft:3200,depth_basis:'TVD',source_ref:'fictional example: permit record',content_class:'public-reported'}),
  csvRow({well_id:B,kind:'packer',top_depth_ft:2850,depth_basis:'unknown',source_ref:'fictional example: packer record',content_class:'assumed'}),
  csvRow({well_id:B,kind:'test-point',top_depth_ft:3000,depth_basis:'TVD',pressure_psi:1380,test_date:'2028-01-20',test_type:'static',source_ref:'fictional example: gauge test',content_class:'measured'}),
].join('\n')+'\n';
