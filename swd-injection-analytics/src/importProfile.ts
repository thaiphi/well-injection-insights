/** SWD-13 input boundary. No workbook binary parsing or formula evaluation. */
export type Profile = 'history' | 'schedule' | 'injector';
export type ContentKind = 'synthetic' | 'public-reported' | 'measured' | 'literature' | 'assumed';
export type Source = {
  name:string; sha256:string; origin:'user'|'synthetic'|'public'|'literature'|'assumed';
  assertedKind:ContentKind; reference:string; verified:false;
};
/** Error cells stay typed; their codes must never become producer IDs or values. */
export type Cell = string | number | boolean | null | {formula:string; cached?:unknown} | {spreadsheetError:string|number|null};
export type Table = {format:'csv'|'parsed-sheet';sheet:string|null;headerRow:number;headers:string[];rows:{originalRow:number;values:Cell[]}[]};
export type Mapping = {profile:Profile;version:string;confirmed:boolean;columns:Record<string,string>;units:Record<string,string>;timeBasis?:string};
export const PROFILE_FIELDS:Record<Profile,readonly string[]> = {
  history:['producerId','groupId','month','water'],
  schedule:['producerId','groupId','startDate','initialRate','monthlyDecline','availability'],
  injector:['id','injectivity','reservoirPressure','limitPressure','reservoirBasis','limitBasis','reservoirDatum','limitDatum','operatingCeiling','availability'],
};
/** Acquisition origin and asserted content are independent; neither establishes verification. */
export async function createSource(bytes:Uint8Array,name:string,details:Pick<Source,'origin'|'assertedKind'|'reference'>):Promise<Source> {
  if(!name.trim() || !details.reference.trim()) throw new Error('File name and source reference are required');
  const hash=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes));
  return {...details,name,sha256:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''),verified:false};
}
function table(format:Table['format'],sheet:string|null,headerRow:number,records:Table['rows']):Table {
  const header=records[0];
  if(!header || header.values.some(v=>typeof v!=='string'||!v.trim())) throw new Error('Header must contain nonempty text');
  const headers=header.values as string[];
  if(new Set(headers).size!==headers.length) throw new Error('Duplicate headers require explicit resolution');
  const rows=records.slice(1);
  if(rows.some(r=>r.values.length!==headers.length)) throw new Error('Row width differs from selected header');
  if(rows.length>100000 || headers.length>100) throw new Error('Input exceeds 100000 rows or 100 columns');
  return {format,sheet,headerRow,headers:[...headers],rows};
}
/** Strict comma-separated UTF-8 text with RFC-style quoting; blank records are not silently dropped. */
export function parseCsv(input:string):Table {
  if(new TextEncoder().encode(input).length>10*1024*1024) throw new Error('CSV exceeds 10 MiB');
  const text=input.replace(/^\uFEFF/,'');
  const records:Table['rows']=[];let values:string[]=[],cell='',quoted=false,closed=false,line=1,startLine=1;
  const finishCell=()=>{values.push(cell);cell='';closed=false;};
  const finishRow=()=>{finishCell();records.push({originalRow:startLine,values});values=[];};
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {
      if(c==='"') {if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}
      else {cell+=c;if(c==='\n')line++;else if(c==='\r'&&text[i+1]!=='\n')line++;}
      continue;
    }
    if(closed && c!==',' && c!=='\r' && c!=='\n') throw new Error('Unexpected text after quoted cell');
    if(c==='"') {if(cell || closed)throw new Error('Quote in unquoted cell');quoted=true;}
    else if(c===',') finishCell();
    else if(c==='\n'||c==='\r') {finishRow();if(c==='\r'&&text[i+1]==='\n')i++;line++;startLine=line;}
    else cell+=c;
  }
  if(quoted) throw new Error('Unterminated quoted cell');
  if(cell || values.length || closed) finishRow();
  return table('csv',null,1,records);
}
/** Future XLSX adapter must supply cells without executing formulas/macros, preserving original row numbers.
 * This boundary does NOT prove that any .xlsx binary can be decoded. */
export function selectSheet(sheets:readonly {name:string;rows:Cell[][]}[],name:string|undefined,headerRow:number):Table {
  if(!name || sheets.filter(s=>s.name===name).length!==1 || !Number.isInteger(headerRow)||headerRow<1) throw new Error('Select one named sheet and a one-based header row');
  const sheet=sheets.find(s=>s.name===name)!;
  return table('parsed-sheet',name,headerRow,sheet.rows.slice(headerRow-1).map((values,i)=>({originalRow:headerRow+i,values:[...values]})));
}
