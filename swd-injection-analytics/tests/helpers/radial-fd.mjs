// Independent implicit radial finite-difference solver for benchmark 7 (#7). Test-only; it imports nothing from the model.
// Dimensionless single-phase radial diffusion dp/dtD = (1/rD) d/drD (rD dp/drD) on 1 <= rD <= reD,
// constant unit rate at the wellbore (-rD dp/drD = 1 at rD = 1), no flow at rD = reD, p = 0 initially.
// Finite volumes: cell faces log-spaced from 1 to reD; cell centres at the geometric mean of their faces.
// Transmissibility between centres i and i+1 is 1/ln(r_{i+1}/r_i) (exact for steady radial flow); cell volume (f_{i+1}^2 - f_i^2)/2.
// The wellbore pressure adds the steady radial drop across the first half cell: p_w = p_0 + ln(r_0/1).
// Time: implicit, first step backward Euler then variable-step BDF2 (second order); geometric steps dt = ratio * t,
// each output time hit exactly. Tridiagonal (Thomas) solve.
export function radialFdWellbore({reD,cells,outputs,stepRatio=2e-3,tStart=1e-6}){
 if(!(reD>1)||!(cells>=2))throw Error('radial FD: reD>1 and cells>=2 required');
 const n=cells,faces=new Float64Array(n+1),lr=Math.log(reD);
 for(let i=0;i<=n;i++)faces[i]=Math.exp(lr*i/n);
 const rc=new Float64Array(n),V=new Float64Array(n),T=new Float64Array(n-1);
 for(let i=0;i<n;i++){rc[i]=Math.sqrt(faces[i]*faces[i+1]);V[i]=(faces[i+1]**2-faces[i]**2)/2;}
 for(let i=0;i<n-1;i++)T[i]=1/Math.log(rc[i+1]/rc[i]);
 const p=new Float64Array(n),pOld=new Float64Array(n),a=new Float64Array(n),b=new Float64Array(n),c=new Float64Array(n),d=new Float64Array(n),cp=new Float64Array(n),dp=new Float64Array(n);
 let dtPrev=0;
 const step=dt=>{
  // BDF2 with step ratio w = dt/dtPrev: [(1+2w)/(1+w) p1 - (1+w) p0 + w^2/(1+w) pm] V/dt = flux terms; Euler when dtPrev = 0.
  const w=dtPrev>0?dt/dtPrev:0,c1=(1+2*w)/(1+w),c0=1+w,cm=w*w/(1+w);
  for(let i=0;i<n;i++){const W=i>0?T[i-1]:0,E=i<n-1?T[i]:0,v=V[i]/dt;a[i]=-W;c[i]=-E;b[i]=c1*v+W+E;d[i]=v*(c0*p[i]-cm*pOld[i])+(i===0?1:0);}
  pOld.set(p);dtPrev=dt;
  cp[0]=c[0]/b[0];dp[0]=d[0]/b[0];
  for(let i=1;i<n;i++){const m=b[i]-a[i]*cp[i-1];cp[i]=c[i]/m;dp[i]=(d[i]-a[i]*dp[i-1])/m;}
  p[n-1]=dp[n-1];for(let i=n-2;i>=0;i--)p[i]=dp[i]-cp[i]*p[i+1];
 };
 const targets=[...outputs].sort((x,y)=>x-y),result=new Map();let t=0;
 for(const target of targets){
  // Near an output time the remaining interval is split so no step is below half the nominal one (keeps the BDF2 step ratio <= 2).
  while(t<target){const nominal=Math.max(t*stepRatio,tStart),left=target-t,dt=left<=nominal?left:left<2*nominal?left/2:nominal;
   step(dt);t=left-dt<=0?target:t+dt;}
  result.set(target,p[0]+Math.log(rc[0]));
 }
 return outputs.map(x=>result.get(x));
}
