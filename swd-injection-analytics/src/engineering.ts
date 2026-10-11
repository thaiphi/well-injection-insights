import {brineAtPressure} from './brinePvt.js';

export const ENGINEERING_VERSION = 'constant-j-pyrestoolbox-brine/2';
export type Injector = {
  id: string; reservoirPsia: number; limitPsia: number; injectivityStbdPerPsi: number;
  operatingCeilingStbd: number; availability: number; datum: string; reservoirDatum:string; limitDatum:string; reservoirPressureBasis:'bottomhole-absolute'; limitPressureBasis:'bottomhole-absolute';
};
export const INJECTORS: readonly Injector[] = [
  {id:'FICTIONAL-INJ-A', reservoirPsia:2000, limitPsia:3500, injectivityStbdPerPsi:5, operatingCeilingStbd:9000, availability:0.9, datum:'Formation reference depth; all pressures bottomhole psia', reservoirDatum:'Formation reference depth; all pressures bottomhole psia', limitDatum:'Formation reference depth; all pressures bottomhole psia', reservoirPressureBasis:'bottomhole-absolute', limitPressureBasis:'bottomhole-absolute'},
  {id:'FICTIONAL-INJ-B', reservoirPsia:2000, limitPsia:3500, injectivityStbdPerPsi:2.5, operatingCeilingStbd:5000, availability:0.9, datum:'Formation reference depth; all pressures bottomhole psia', reservoirDatum:'Formation reference depth; all pressures bottomhole psia', limitDatum:'Formation reference depth; all pressures bottomhole psia', reservoirPressureBasis:'bottomhole-absolute', limitPressureBasis:'bottomhole-absolute'},
];
function finite(value:number, name:string) { if(!Number.isFinite(value)) throw new Error(`${name} must be finite`); }
function calculated(value:number,name:string){if(!Number.isFinite(value))throw new Error(`${name} cannot be represented as a finite number`);return value;}
export function validateInjector(input:Injector) {
  if(input.reservoirPressureBasis!=='bottomhole-absolute'||input.limitPressureBasis!=='bottomhole-absolute'||!input.reservoirDatum?.trim()||input.reservoirDatum!==input.limitDatum||input.datum!==input.reservoirDatum) throw new Error('Require absolute bottomhole reservoir/limit pressures at the same declared datum within each injector; display datum must agree');
  for(const key of ['reservoirPsia','limitPsia','injectivityStbdPerPsi','operatingCeilingStbd','availability'] as const) finite(input[key],key);
  if(input.reservoirPsia<=0 || input.limitPsia<=0 || input.injectivityStbdPerPsi<=0 || input.operatingCeilingStbd<0 || input.availability<0 || input.availability>1 || !input.datum) throw new Error('Invalid injector input or missing pressure datum');
}
/** Constant injectivity referenced to stock-tank water rate; no production IPR inversion. */
export function bottomholePressure(input:Injector, rateStbd:number) {
  validateInjector(input); finite(rateStbd,'rate'); if(rateStbd<0) throw new Error('Injection rate cannot be negative');
  return calculated(input.reservoirPsia + rateStbd / input.injectivityStbdPerPsi,'Required bottomhole pressure (psia)');
}
export function capacity(input:Injector) {
  validateInjector(input);
  const pressureDifference=input.limitPsia-input.reservoirPsia;
  const pressureLimitedStbd = pressureDifference<=0?0:calculated(input.injectivityStbdPerPsi*pressureDifference,'Pressure-limited capacity (STB/day)');
  const operatingStbd = Math.min(pressureLimitedStbd,input.operatingCeilingStbd);
  return {pressureLimitedStbd,operatingStbd,availableStbd:calculated(operatingStbd*input.availability,'Available capacity (STB/day)')};
}
export function pressureRateCurve(input:Injector, maxRateStbd=10000, steps=40) {
  finite(maxRateStbd,'maximum rate');
  if(maxRateStbd<=0 || !Number.isInteger(steps) || steps<1 || steps>1000) throw new Error('Invalid curve grid');
  return Array.from({length:steps+1},(_,i)=>{
    const numerator=maxRateStbd*i,rateStbd=calculated(Number.isFinite(numerator)?numerator/steps:maxRateStbd*(i/steps),'Curve rate (STB/day)');
    return {rateStbd,bottomholePsia:bottomholePressure(input,rateStbd)};
  });
}
/** Source-checked gas-free NaCl adapter. Salinity is mass ppm, not mg/L TDS;
 * 10000 mass ppm = 1 wt%. Absolute pressure is passed through without conversion.
 * brineAtPressure enforces the shared 100–10000 psia and 60–250 °F demo bounds. */
export function brineProperties(pressurePsia:number, temperatureF:number, salinityPpm:number) {
  for(const [name,value] of Object.entries({pressurePsia,temperatureF,salinityPpm})) finite(value,name);
  if(salinityPpm<0 || salinityPpm>200000) throw new Error('NaCl salinity must be 0–200000 mass ppm (0–20 wt%); not mg/L TDS');
  const salinityWtPercent=salinityPpm/10000,brine=brineAtPressure(pressurePsia,temperatureF,salinityWtPercent);
  return {
    pressurePsia,temperatureF,salinityPpm,
    bwRbPerStb:brine.bwRbPerStb,densityLbPerFt3:brine.densityLbPerFt3,viscosityCp:brine.viscosityCp,compressibilityPerPsi:brine.compressibilityPerPsi,
    salinityWtPercent,salinityBasis:'NaCl mass ppm (mass/mass); 50000 ppm = 5 wt%; not mg/L TDS',
    source:'pyResToolbox gas-free NaCl source snapshot; brineAtPressure browser port; brine.py SHA-256 2325c6ae8879c49b8d7fac189d0011fe7656dec13758c199ffc2cc015aae8294; iapws_if97.py SHA-256 57161a48170edf580d42d7e862bbb895663a9f223461c7bd067fc6f81e1723ed; no field calibration',
  };
}

