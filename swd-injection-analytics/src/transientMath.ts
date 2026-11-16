// Shared numerical kernels for the transient (E06) and interference (E07) pressure models.
// Every function is double precision and deterministic; accuracy is established by tests/transient-math.test.mjs.
// Valid ranges: e1 for x>0 (underflows above x~708: subnormal, then exactly 0 above x~745). Scaled Bessel I0e, I1e, K0e and K1e are finite and
// tested to 1e-10 for x up to 1e8 (I0e/I1e also at x=0). Unscaled I0/I1 overflow to Infinity above x~709 and unscaled
// K0/K1 underflow to 0 above x~745; use the scaled forms (ratio form) when arguments can be large.
// Stehfest: even N from 2 to 20, default 12.
export const TRANSIENT_MATH_VERSION='transient-math/1';
export const C={pressure:141.2055,lineSource:70.603,tD:0.00026368,rinv:948.12,pss:0.074466,ft3PerBbl:5.6146} as const; // SI-derived
export const DISPLAY={pressure:141.2,lineSource:70.6,tD:0.0002637,rinv:948,pss:0.0744,ft3PerBbl:5.615} as const;

const SI={md:9.869233e-16,ft:0.3048,cP:1e-3,bbl:0.158987294928,day:86400,h:3600,psi:6894.757293168};
// Recomputes each oilfield-unit constant from SI conversion factors (never returns C itself).
export function deriveConstants():typeof C{
 const pressure=(SI.bbl/SI.day)*SI.cP/(2*Math.PI*SI.md*SI.ft*SI.psi); // q[bbl/d] B mu[cP] / (2 pi k[md] h[ft]) -> psi
 const tD=SI.md*SI.h*SI.psi/(SI.cP*SI.ft*SI.ft);                     // k[md] t[h] / (phi mu[cP] ct[1/psi] r[ft]^2)
 const ft3PerBbl=SI.bbl/SI.ft**3;
 return {pressure,lineSource:pressure/2,tD,rinv:1/(4*tD),pss:ft3PerBbl/(24*Math.PI),ft3PerBbl} as unknown as typeof C;
}

const EULER_GAMMA=0.5772156649015329;
const EPS=1e-16;
const MAXIT=10000;
const positive=(x:number,label:string)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<=0)throw Error(`${label} requires a finite positive argument`);};
const nonNegative=(x:number,label:string)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<0)throw Error(`${label} requires a finite non-negative argument`);};

// E1 power series: -gamma - ln x - sum_{k>=1} (-x)^k/(k k!). Accurate for small x; cancellation grows like e^x/x.
export function _e1Series(x:number):number{
 let term=1,sum=0;
 for(let k=1;k<MAXIT;k++){term*=-x/k;const d=term/k;sum+=d;if(Math.abs(d)<EPS*Math.abs(sum))break;}
 return -EULER_GAMMA-Math.log(x)-sum;
}
// E1 continued fraction (modified Lentz): e^-x / (x+1- 1/(x+3- 4/(x+5- ...))).
export function _e1Cf(x:number):number{
 const tiny=1e-300;let b=x+1,c=1/tiny,d=1/b,h=d;
 for(let i=1;i<MAXIT;i++){const a=-i*i;b+=2;d=1/(a*d+b);c=b+a/c;const del=c*d;h*=del;if(Math.abs(del-1)<EPS)return h*Math.exp(-x);}
 throw Error('E1 continued fraction did not converge');
}
// Intended: above x~708 e^-x underflows, so e1 returns subnormal (reduced-precision) values and exactly 0 above x~745.
export function e1(x:number):number{positive(x,'E1');return x<=1?_e1Series(x):_e1Cf(x);}

const I_SWITCH=30;
// I_n power series (all terms positive): sum (x/2)^(2k+n) / (k! (k+n)!).
function iSeries(n:0|1,x:number):number{
 const y=x*x/4;let term=n===0?1:x/2,sum=term;
 for(let k=1;k<MAXIT;k++){term*=y/(k*(k+n));sum+=term;if(term<EPS*sum)break;}
 return sum;
}
// Large-x asymptotic expansion, scaled: e^-x I_n(x) ~ 1/sqrt(2 pi x) sum_k (-1)^k prod_{j<=k}(mu-(2j-1)^2) / (k! (8x)^k), mu=4n^2.
function iAsymptoticScaled(n:0|1,x:number):number{
 const mu=4*n*n;let term=1,sum=1;
 for(let k=1;k<200;k++){const next=-term*(mu-(2*k-1)**2)/(k*8*x);if(Math.abs(next)>=Math.abs(term))break;term=next;sum+=term;if(Math.abs(term)<EPS*Math.abs(sum))break;}
 return sum/Math.sqrt(2*Math.PI*x);
}
const iScaled=(n:0|1,x:number)=>x<=I_SWITCH?iSeries(n,x)*Math.exp(-x):iAsymptoticScaled(n,x);
export function besselI0e(x:number):number{nonNegative(x,'I0e');return iScaled(0,x);}
export function besselI1e(x:number):number{nonNegative(x,'I1e');return iScaled(1,x);}
export function besselI0(x:number):number{return besselI0e(x)*Math.exp(x);}
export function besselI1(x:number):number{return besselI1e(x)*Math.exp(x);}

const K_SWITCH=2;
// Small-x series (A&S 9.6.13 and 9.6.11 with n=1).
function kSeries(x:number):[number,number]{
 const y=x*x/4,lg=Math.log(x/2);
 // K0 = -(ln(x/2)+gamma) I0 + sum y^k/(k!)^2 H_k
 let t=1,hk=0,s0=0;
 for(let k=1;k<MAXIT;k++){t*=y/(k*k);hk+=1/k;const d=t*hk;s0+=d;if(d<EPS*Math.abs(s0))break;}
 const k0=-(lg+EULER_GAMMA)*iSeries(0,x)+s0;
 // K1 = 1/x + ln(x/2) I1 - (x/4) sum y^k/(k!(k+1)!) (psi(k+1)+psi(k+2)), psi(m+1) = -gamma + H_m
 let u=1,hA=0,hB=1,s1=-2*EULER_GAMMA+1;
 for(let k=1;k<MAXIT;k++){u*=y/(k*(k+1));hA+=1/k;hB+=1/(k+1);const d=u*(hA+hB-2*EULER_GAMMA);s1+=d;if(Math.abs(d)<EPS*Math.abs(s1))break;}
 const k1=1/x+lg*iSeries(1,x)-(x/4)*s1;
 return [k0,k1];
}
// Steed's continued-fraction method (Temme CF2 form) for x >= 2, order 0, giving scaled e^x K0 and e^x K1 together.
function kSteedScaled(x:number):[number,number]{
 let b=2*(1+x),d=1/b,h=d,delh=d,q1=0,q2=1;const a1=0.25;let q=a1,c=a1,a=-a1,s=1+q*delh;
 for(let i=1;i<MAXIT;i++){
  a-=2*i;c=-a*c/(i+1);const qnew=(q1-b*q2)/a;q1=q2;q2=qnew;q+=c*qnew;b+=2;d=1/(b+a*d);delh=(b*d-1)*delh;h+=delh;
  const dels=q*delh;s+=dels;if(Math.abs(dels/s)<EPS){const k0e=Math.sqrt(Math.PI/(2*x))/s;return [k0e,k0e*(x+0.5-a1*h)/x];}
 }
 throw Error('Bessel K continued fraction did not converge');
}
function kScaledPair(x:number):[number,number]{
 if(x>=K_SWITCH)return kSteedScaled(x);
 const [k0,k1]=kSeries(x),ex=Math.exp(x);return [k0*ex,k1*ex];
}
export function besselK0e(x:number):number{positive(x,'K0e');return kScaledPair(x)[0];}
export function besselK1e(x:number):number{positive(x,'K1e');return kScaledPair(x)[1];}
export function besselK0(x:number):number{return besselK0e(x)*Math.exp(-x);}
export function besselK1(x:number):number{return besselK1e(x)*Math.exp(-x);}

// Gaver-Stehfest numerical Laplace inversion: f(t) ~ ln2/t sum_i V_i F(i ln2/t).
const stehfestCache=new Map<number,number[]>();
function stehfestWeights(N:number):number[]{
 const cached=stehfestCache.get(N);if(cached)return cached;
 const fact=(n:number)=>{let r=1;for(let i=2;i<=n;i++)r*=i;return r;};const half=N/2,V:number[]=[];
 for(let i=1;i<=N;i++){
  let sum=0;for(let k=Math.floor((i+1)/2);k<=Math.min(i,half);k++)sum+=k**half*fact(2*k)/(fact(half-k)*fact(k)*fact(k-1)*fact(i-k)*fact(2*k-i));
  V.push(((i+half)%2===0?1:-1)*sum);
 }
 stehfestCache.set(N,V);return V;
}
export function stehfest(F:(s:number)=>number,t:number,N=12):number{
 positive(t,'Stehfest time');
 if(!Number.isInteger(N)||N<2||N>20||N%2!==0)throw Error('Stehfest N must be an even integer from 2 to 20');
 const V=stehfestWeights(N),ln2t=Math.LN2/t;let sum=0;
 for(let i=1;i<=N;i++)sum+=V[i-1]*F(i*ln2t);
 return ln2t*sum;
}
