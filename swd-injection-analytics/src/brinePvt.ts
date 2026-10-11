import {gasFreeBrine} from './pyrestoolboxBrine.js';
export type BrineSweepInput={caseName:string;minPressurePsia:number;maxPressurePsia:number;temperatureF:number;salinityWtPercent:number;points:number};
const limits=(value:number,min:number,max:number,label:string)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`${label} must be between ${min} and ${max}`);};
export function brineAtPressure(pressurePsia:number,temperatureF:number,salinityWtPercent:number){
 limits(pressurePsia,100,10000,'Absolute pressure (psia)');limits(temperatureF,60,250,'Temperature (°F)');limits(salinityWtPercent,0,20,'NaCl salinity (wt%)');
 const r=gasFreeBrine(pressurePsia,temperatureF,salinityWtPercent);
 const row={pressurePsia,bwRbPerStb:r.bwRbPerStb,densityKgPerM3:r.densityGPerCm3*1000,densityLbPerFt3:r.densityGPerCm3*1000/16.01846337396014,viscosityCp:r.viscosityCp,compressibilityPerPsi:r.compressibilityPerPsi};
 if(Object.values(row).some(v=>!Number.isFinite(v)||v<=0))throw Error('Brine correlation returned an invalid property; no result is available');
 return row;
}
export function buildBrineSweep(input:BrineSweepInput){
 if(typeof input.caseName!=='string'||!input.caseName.trim()||input.caseName.length>100)throw Error('Enter a case name (1–100 characters)');
 limits(input.minPressurePsia,100,10000,'Minimum absolute pressure (psia)');limits(input.maxPressurePsia,100,10000,'Maximum absolute pressure (psia)');
 if(input.minPressurePsia>=input.maxPressurePsia)throw Error('Maximum pressure must exceed minimum pressure');
 limits(input.points,2,101,'Number of pressure points');if(!Number.isInteger(input.points))throw Error('Number of pressure points must be an integer');
 const rows=Array.from({length:input.points},(_,i)=>brineAtPressure(i===input.points-1?input.maxPressurePsia:input.minPressurePsia+(input.maxPressurePsia-input.minPressurePsia)*i/(input.points-1),input.temperatureF,input.salinityWtPercent));
 return {schemaVersion:'brine-pvt/1',methodVersion:'pyrestoolbox-gas-free-browser/1',inputs:structuredClone(input),rows,
  units:{pressure:'psia',temperature:'°F',salinity:'NaCl wt%',bw:'rb/STB',density:'kg/m³ and lb/ft³',viscosity:'cP',compressibility:'1/psi'},
  methods:{density:'IAPWS-IF97 Region 1 freshwater density × modified Spivey salt-density ratio',bw:'Source standard brine density / brine density at selected pressure and temperature',viscosity:'Source brine viscosity equations 4.43–4.48; original 273 K offset retained',compressibility:'Modified Spivey gas-free brine compressibility; source 145.038 psi/MPa conversion'},
  provenance:{inputOrigin:'user-entered assumptions',outputs:'calculated',library:'pyResToolbox local source snapshot',packageMetadataVersion:'2.5.0',liveMcpCall:false,reference:'45 fresh direct-library cases; 3 temperatures × 3 NaCl concentrations × 5 pressures; four properties checked',referenceFixture:{name:'oracles.json',sha256:'ad36d7988fb1828fd5507fcc682050792fb3ee0fad7929d83ef54ed4bfe23672',recordedAt:'2026-10-10T04:55:58.157Z'},files:[
   {name:'brine.py',sha256:'2325c6ae8879c49b8d7fac189d0011fe7656dec13758c199ffc2cc015aae8294'},
   {name:'iapws_if97.py',sha256:'57161a48170edf580d42d7e862bbb895663a9f223461c7bd067fc6f81e1723ed'},
   {name:'LICENSE',sha256:'63fcc3314a2c239e9d7bde465609690b5f468a50e0ff4aaee64826cb85e2c0a1'},
  ],license:'GPL-3.0-or-later',upstream:'https://github.com/mwburgoyne/pyResToolbox',standardReference:'15 °C (59 °F), freshwater 0.1013 MPa; saline standard integral uses source 0.1015 MPa',
   validation:{sourceAgreement:'45 recorded source-library cases; four properties checked.',physicalAcceptance:'Bounded physical screening only; full independent fluid-domain validation remains open.',legacyNexusWaterFvf:'Historical evidence only; incorrect retained Nexus water-FVF is excluded from live calculations.'}},
  limitations:['Gas-free NaCl brine only: methane saturation is zero; no dissolved CO2 or mixed-ion chemistry.','Application limits 100–10000 psia, 60–250 °F and 0–20 wt% are bounded demonstration limits, not a full correlation-domain validation.','Salinity is NaCl mass percent, not mg/L total dissolved solids; no automatic conversion from a measured TDS value.','Compressibility follows the source modified Spivey equation; it is not a numerical derivative of the IAPWS-adjusted density.','Exact source hashes identify the installed snapshot; package metadata alone does not establish an unmodified published release.','Independent fluid case: not derived from RRC pressures or active producer datasets and not coupled to constant-J capacity.'],
 };
}
export type BrineSweep=ReturnType<typeof buildBrineSweep>;
const cell=(value:unknown)=>'"'+String(typeof value==='object'?JSON.stringify(value):value).replaceAll('"','""')+'"';
// Quoted CSV fields still execute as formulas in spreadsheet applications.
// Keep the exact raw label in serialized inputs, but make its text cell safe.
const spreadsheetText=(value:string)=>/^[\s]*[=+\-@]|^[\t\r\n]/.test(value)?"'"+value:value;
export function brineSweepCsv(result:BrineSweep):string{
 if(result.rows.some(r=>Object.values(r).some(v=>!Number.isFinite(v))))throw Error('Cannot export non-finite brine properties');
 const rows:unknown[][]=[['section','field','value'],['metadata','case',spreadsheetText(result.inputs.caseName)],['metadata','method',result.methodVersion],['metadata','inputs',result.inputs],['metadata','units',result.units],['metadata','methods',result.methods],['metadata','provenance',result.provenance],['metadata','limitations',result.limitations],[],['Pressure (psia)','Bw (rb/STB)','Density (kg/m³)','Density (lb/ft³)','Viscosity (cP)','Compressibility (1/psi)'],...result.rows.map(r=>[r.pressurePsia,r.bwRbPerStb,r.densityKgPerM3,r.densityLbPerFt3,r.viscosityCp,r.compressibilityPerPsi])];
 return rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
