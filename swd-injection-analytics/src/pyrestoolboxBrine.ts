/** Gas-free browser adaptation of the owner's installed pyResToolbox snapshot.
 * Copyright (C) 2022 Mark Burgoyne; adaptation 2026 SWD Analytics contributors.
 * GPL-3.0-or-later. Full license and exact original sources/hashes are retained
 * in reference/pyrestoolbox-pvt/. No methane/CO2 or gas-Z code is included.
 * Source brine.py equations 4.1–4.12, 4.43–4.48; IAPWS-IF97 Region 1 density.
 * Preserve source conventions including 273 K viscosity offset, 145.038 psi/MPa
 * and the 0.1015 MPa saline standard integral (freshwater uses 0.1013 MPa).
 */
const coefficients=[
 [0,-2,0.14632971213167],[0,-1,-0.84548187389013],[0,0,-3.756360367204],[0,1,3.3855169168385],
 [0,2,-0.95791963387872],[0,3,0.15772038513228],[0,4,-0.016616417199501],[0,5,0.00081214629983568],
 [1,-9,0.00028319080123804],[1,-7,-0.00060706301565874],[1,-1,-0.018990068218419],[1,0,-0.032529748770505],
 [1,1,-0.021841717175414],[1,3,-0.00005283835796993],[2,-3,-0.00047184321073267],[2,0,-0.00030001780793026],
 [2,1,0.000047661393906987],[2,3,-0.0000044141845330846],[2,17,-7.2694996297594e-16],
 [3,-4,-0.000031679644845054],[3,0,-0.0000028270797985312],[3,6,-8.5205128120103e-10],
 [4,-5,-0.0000022425281908],[4,-2,-0.00000065171222895601],[4,10,-1.4341729937924e-13],
 [5,-8,-4.0516996860117e-7],[8,-11,-1.2734301741682e-9],[8,-6,-1.7424871230634e-10],
 [21,-29,-6.8762131295531e-19],[23,-31,1.4478307828521e-20],[29,-38,2.6335781662795e-23],
 [30,-39,-1.1947622640071e-23],[31,-40,1.8228094581404e-24],[32,-41,-9.3537087292458e-26],
];
function waterDensity(temperatureK:number,pressureMPa:number):number{
 const a=7.1-pressureMPa/16.53,b=1386/temperatureK-1.222;
 let derivative=0;for(const [i,j,n]of coefficients)if(i!==0)derivative+=-n*i*a**(i-1)*b**j;
 return 16.53/(461.526e-6*temperatureK*derivative)/1000;
}
const tables=[
 [-0.127213,0.645486,1.03265,-0.070291,0.639589],
 [4.221,-3.478,6.221,0.5182,-0.4405],[-11.403,29.932,27.952,0.20684,0.3768],
 [-0.00011149,0.000175105,-0.00043766,0,0],[-0.0008878,-0.0001388,-0.00296318,0,0.51103],
 [0.0021466,0.012427,0.042648,-0.081009,0.525417],[0.0002356,-0.0003636,-0.0002278,0,0],
 [0,0,0.1249,0,0],[-0.617,-0.747,-0.4339,0,10.26],[0,9.917,5.1128,0,3.892],[0.0365,-0.0369,0,0,0],
];
function spivey(temperatureC:number,pressureMPa:number,molality:number){
 const t=temperatureC/100,m=molality;
 const [water70,ew,fw,dm2,dm32,dm1,dm12,em,fm32,fm1,fm12]=tables.map(([a,b,c,d,e])=>(a*t*t+b*t+c)/(d*t*t+e*t+1));
 const waterSpivey=water70*Math.exp((Math.log(Math.abs(ew*pressureMPa/70+fw))-Math.log(Math.abs(ew+fw)))/ew);
 const brine70=water70+dm2*m*m+dm32*m**1.5+dm1*m+dm12*m**0.5;
 const eb=ew+em*m,fb=fw+fm32*m**1.5+fm1*m+fm12*m**0.5;
 const brineSpivey=brine70*Math.exp((Math.log(Math.abs(eb*pressureMPa/70+fb))-Math.log(Math.abs(eb+fb)))/eb);
 return {waterSpivey,brineSpivey,compressibilityMPa:1/(70*(eb*pressureMPa/70+fb))};
}
/** Internal port boundary; caller enforces the application's liquid-only range. */
export function gasFreeBrine(pressurePsia:number,temperatureF:number,salinityWtPercent:number){
 const p=pressurePsia*0.00689476,t=(temperatureF-32)/1.8,k=t+273;
 const m=1000*(salinityWtPercent/100)/(58.4428*(1-salinityWtPercent/100));
 const state=spivey(t,p,m),pure=waterDensity(t+273.15,p);
 const density=pure*(m>0?state.brineSpivey/state.waterSpivey:1);
 const standardWater=spivey(15,0.1013,m),standardBrine=spivey(15,0.1015,m);
 const standardDensity=waterDensity(288.15,0.1013)*(m>0?standardBrine.brineSpivey/standardWater.waterSpivey:1);
 const d=[0,2885310,-11072.577,-9.0834095,0.030925651,-0.0000274071,-1928385.1,5621.6046,13.82725,-0.047609523,0.000035545041];
 let logWaterViscosity=0;for(let i=1;i<=5;i++)logWaterViscosity+=d[i]*k**(i-3);for(let i=6;i<=10;i++)logWaterViscosity+=pure*d[i]*k**(i-8);
 const aa=-0.21319213+0.0013651589*k-0.0000012191756*k*k;
 const bb=0.069161945-0.00027292263*k+0.0000002085244*k*k;
 const cc=-0.0025988855+0.0000077989227*k;
 return {bwRbPerStb:standardDensity/density,densityGPerCm3:density,viscosityCp:Math.exp(logWaterViscosity)*Math.exp(aa*m+bb*m*m+cc*m*m*m)*1000,compressibilityPerPsi:state.compressibilityMPa/145.038};
}
