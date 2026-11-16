import test from 'node:test';
import assert from 'node:assert/strict';
import {TRANSIENT_MATH_VERSION,C,DISPLAY,deriveConstants,e1,_e1Series,_e1Cf,besselI0,besselI1,besselK0,besselK1,besselI0e,besselI1e,besselK0e,besselK1e,stehfest} from '../dist/transientMath.js';

const rel=(a,b)=>Math.abs(a-b)/Math.abs(b);
const GAMMA=0.5772156649015329;

// Independent high-precision reference for E1 at rational x=p/q: BigInt fixed-point alternating series,
// E1(x) = -gamma - ln x - sum_{k>=1} (-x)^k/(k k!). 80 decimal digits survive the x=20 cancellation (terms ~1e7, result ~1e-10).
const SCALE=10n**80n;
const GAMMA_FIXED=BigInt('57721566490153286060651209008240243104215933593992359880576723488486772677766467');
function lnFixed(p,q){ // ln(p/q) = 2 atanh((p-q)/(p+q)), fixed point
 const n=BigInt(p-q),d=BigInt(p+q);let term=n*SCALE/d,sum=0n;const z2n=n*n,z2d=d*d;
 for(let k=1n;term!==0n;k+=2n){sum+=term/k;term=term*z2n/z2d;}
 return 2n*sum;
}
function e1Reference(p,q){
 let term=SCALE,sum=0n;const P=BigInt(p),Q=BigInt(q);
 for(let k=1n;;k++){term=-term*P/(Q*k);if(term===0n)break;sum+=term/k;}
 const v=-GAMMA_FIXED-lnFixed(p,q)-sum;
 return Number(v*10n**30n/SCALE)/1e30;
}
// Independent quadrature oracles for the Bessel functions (exponentially convergent trapezoid rules).
function kOracle(nu,x){let s=0.5*Math.exp(-x);const h=0.05;for(let t=h;;t+=h){const v=Math.exp(-x*Math.cosh(t))*Math.cosh(nu*t);s+=v;if(v<1e-30*s)break;}return s*h;}
function iOracle(n,x){const m=2000;let s=0;for(let j=0;j<=m;j++){const th=Math.PI*j/m,w=j===0||j===m?0.5:1;s+=w*Math.exp(x*Math.cos(th)-x)*Math.cos(n*th);}return s/m*Math.exp(x);}
const logGrid=[];for(let e=-3;e<=2.0000001;e+=0.125)logGrid.push(10**e);

test('version string',()=>{assert.equal(TRANSIENT_MATH_VERSION,'transient-math/1');});

test('E1 small-x limit approaches -gamma - ln x within 1e-3',()=>{
 for(const x of [1e-6,1e-4,1e-3,0.002,0.0039]){const v=e1(x);assert.ok(rel(-GAMMA-Math.log(x),v)<1e-3,`x=${x}`);}
});

test('E1 series and continued fraction agree to 1e-10 where the double-precision series is valid',()=>{
 for(const x of [0.5,0.99,1,1.01,2,5])assert.ok(rel(_e1Series(x),_e1Cf(x))<1e-10,`x=${x} rel=${rel(_e1Series(x),_e1Cf(x))}`);
});

test('E1 matches an 80-digit series reference to 1e-10 across {0.5,0.99,1,1.01,2,5,20}',()=>{
 for(const [p,q] of [[1,2],[99,100],[1,1],[101,100],[2,1],[5,1],[20,1]]){const x=p/q,ref=e1Reference(p,q);
  assert.ok(rel(e1(x),ref)<1e-10,`x=${x} rel=${rel(e1(x),ref)}`);assert.ok(rel(_e1Cf(x),ref)<1e-10,`cf x=${x}`);}
 // x=20 is checked only against the reference: the double-precision alternating series is destroyed by cancellation there.
});

test('Bessel Wronskian I0 K1 + I1 K0 = 1/x to 1e-10',()=>{
 for(const x of [1e-3,0.1,1,5,20,100]){const w=besselI0(x)*besselK1(x)+besselI1(x)*besselK0(x);assert.ok(Math.abs(x*w-1)<1e-10,`x=${x} err=${Math.abs(x*w-1)}`);}
});

test('Bessel functions match independent quadrature to 1e-10 on a log grid from 1e-3 to 100',()=>{
 for(const x of logGrid){
  assert.ok(rel(besselK0(x),kOracle(0,x))<1e-10,`K0 x=${x}`);assert.ok(rel(besselK1(x),kOracle(1,x))<1e-10,`K1 x=${x}`);
  assert.ok(rel(besselI0(x),iOracle(0,x))<1e-10,`I0 x=${x}`);assert.ok(rel(besselI1(x),iOracle(1,x))<1e-10,`I1 x=${x}`);
 }
});

test('Bessel functions match tabulated values at x=1',()=>{
 assert.ok(rel(besselI0(1),1.2660658777520082)<1e-12);assert.ok(rel(besselI1(1),0.5651591039924851)<1e-12);
 assert.ok(rel(besselK0(1),0.42102443824070834)<1e-12);assert.ok(rel(besselK1(1),0.6019072301972346)<1e-12);
});

test('Bessel branches are continuous across internal switch points',()=>{
 for(const b of [2,30])for(const f of [besselI0,besselI1,besselK0,besselK1])assert.ok(rel(f(b*(1-1e-13)),f(b*(1+1e-13)))<1e-10,`${f.name} at ${b}`);
});

test('K0 and K1 are positive and decreasing',()=>{
 let p0=Infinity,p1=Infinity;
 for(const x of logGrid){const k0=besselK0(x),k1=besselK1(x);assert.ok(k0>0&&k1>0);assert.ok(k0<p0&&k1<p1,`x=${x}`);assert.ok(k1>k0);p0=k0;p1=k1;}
});

test('Stehfest inverts known transforms to 1e-5',()=>{
 for(const t of [1,2,5])assert.ok(rel(stehfest(s=>1/(s*s),t),t)<1e-5,`1/s^2 t=${t}`);
 // DEVIATION FROM BRIEF (reported to Main): exp(-t) cannot reach 1e-5 at the default N=12 in double precision
 // (measured 2.7e-5 at t=1, 4.3e-4 at t=2; a known Stehfest limitation for functions with a finite-s pole).
 // The default-N check pins the measured limit; N=18 shows the same implementation converges to the brief's 1e-5.
 for(const t of [1,2])assert.ok(rel(stehfest(s=>1/(s+1),t),Math.exp(-t))<5e-4,`1/(s+1) N=12 t=${t}`);
 for(const t of [1,2])assert.ok(rel(stehfest(s=>1/(s+1),t,18),Math.exp(-t))<1e-5,`1/(s+1) N=18 t=${t}`);
 for(const t of [1,10,100]){const v=stehfest(s=>besselK0(Math.sqrt(s))/s,t),ref=0.5*e1(1/(4*t));assert.ok(rel(v,ref)<1e-5,`line source t=${t} rel=${rel(v,ref)}`);}
 assert.equal(stehfest(s=>1/(s*s),3,12),stehfest(s=>1/(s*s),3));
});

test('derived constants reproduce C to 1e-4 and DISPLAY values are within 0.1%',()=>{
 const d=deriveConstants();assert.notEqual(d,C);
 for(const k of Object.keys(C)){assert.ok(rel(d[k],C[k])<1e-4,`${k}: ${d[k]} vs ${C[k]}`);assert.ok(rel(DISPLAY[k],C[k])<1e-3,`display ${k}`);}
 assert.deepEqual(Object.keys(DISPLAY).sort(),Object.keys(C).sort());
});

test('guards reject invalid arguments',()=>{
 for(const x of [0,-1,NaN,Infinity])assert.throws(()=>e1(x));
 assert.throws(()=>besselK0(0));assert.throws(()=>besselK1(0));assert.throws(()=>besselK0(-1));assert.throws(()=>besselI0(NaN));
 assert.throws(()=>stehfest(s=>1/s,1,11));assert.throws(()=>stehfest(s=>1/s,0));assert.throws(()=>stehfest(s=>1/s,1,0));
});

// Fix round 1: exponentially scaled Bessel functions for large arguments.
function kOracleScaled(nu,x){const h=Math.min(0.05,0.05/Math.sqrt(x));let s=0.5;for(let t=h;;t+=h){const v=Math.exp(-x*(Math.cosh(t)-1))*Math.cosh(nu*t);s+=v;if(v<1e-30*s)break;}return s*h;}

test('scaled Bessel Wronskian I0e K1e + I1e K0e = 1/x to 1e-10 for large x',()=>{
 for(const x of [1e3,1e4,1e6,1e8]){const w=besselI0e(x)*besselK1e(x)+besselI1e(x)*besselK0e(x);assert.ok(Number.isFinite(w));assert.ok(Math.abs(x*w-1)<1e-10,`x=${x} err=${Math.abs(x*w-1)}`);}
});

test('scaled Bessel functions are finite and accurate to 1e-10 up to x=1e8',()=>{
 for(const x of [1e3,1e4,1e6]){assert.ok(rel(besselK0e(x),kOracleScaled(0,x))<1e-10,`K0e x=${x}`);assert.ok(rel(besselK1e(x),kOracleScaled(1,x))<1e-10,`K1e x=${x}`);}
 for(const x of [1e3,1e4,1e6,1e8]){const a=1/Math.sqrt(2*Math.PI*x),k=Math.sqrt(Math.PI/(2*x)),z=8*x;
  // Four-term asymptotic references; the omitted terms are below 1e-10 relative for x>=1e3.
  assert.ok(rel(besselI0e(x),a*(1+1/z+9/(2*z*z)+75/(2*z**3)))<1e-10,`I0e x=${x}`);assert.ok(rel(besselI1e(x),a*(1-3/z-15/(2*z*z)-105/(2*z**3)))<1e-10,`I1e x=${x}`);
  assert.ok(rel(besselK0e(x),k*(1-1/z+9/(2*z*z)-75/(2*z**3)))<1e-10,`K0e asym x=${x}`);assert.ok(rel(besselK1e(x),k*(1+3/z-15/(2*z*z)+105/(2*z**3)))<1e-10,`K1e asym x=${x}`);
  for(const f of [besselI0e,besselI1e,besselK0e,besselK1e])assert.ok(Number.isFinite(f(x))&&f(x)>0);}
 assert.equal(besselI0e(0),1);assert.equal(besselI1e(0),0);assert.throws(()=>besselK0e(0));assert.throws(()=>besselK1e(-1));assert.throws(()=>besselI0e(NaN));
});

test('scaled forms equal the unscaled functions times exp(-/+x)',()=>{
 for(const x of [0.1,1,5,50]){
  assert.ok(rel(besselI0e(x),besselI0(x)*Math.exp(-x))<1e-10);assert.ok(rel(besselI1e(x),besselI1(x)*Math.exp(-x))<1e-10);
  assert.ok(rel(besselK0e(x),besselK0(x)*Math.exp(x))<1e-10);assert.ok(rel(besselK1e(x),besselK1(x)*Math.exp(x))<1e-10);
 }
});

// Closed outer circle, finite wellbore: pwD(s) = [K0(a)I1(b)+I0(a)K1(b)] / (s a [I1(b)K1(a)-K1(b)I1(a)]), a=sqrt(s), b=reD a.
// Ratio form from scaled functions: divide numerator and denominator by e^(b-a) so no exponential overflows.
function pwDClosedCircle(s,reD){const a=Math.sqrt(s),b=reD*a,r=Math.exp(-2*(b-a));
 const num=besselK0e(a)*besselI1e(b)+besselI0e(a)*besselK1e(b)*r,den=s*a*(besselI1e(b)*besselK1e(a)-besselK1e(b)*besselI1e(a)*r);return num/den;}
test('closed-circle pwD with reD=1e4 inverts to finite positive values',()=>{
 for(const tD of [1,100,1e4]){const v=stehfest(s=>pwDClosedCircle(s,1e4),tD);assert.ok(Number.isFinite(v)&&v>0,`tD=${tD} v=${v}`);}
 const a=stehfest(s=>pwDClosedCircle(s,1e4),1),b=stehfest(s=>pwDClosedCircle(s,1e5),1);assert.ok(rel(a,b)<1e-6,`reD 1e4 vs 1e5 rel=${rel(a,b)}`);
});
