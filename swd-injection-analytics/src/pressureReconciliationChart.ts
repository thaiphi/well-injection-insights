import {LABEL_RECON,RATE_NOTE,PERMIT_EQ_LABEL,SCREENING_TEXT,type Reconciliation} from './pressureReconciliation.js';

/** Pure SVG; escaped text only. Top: modelled flowing BHP with its sensitivity band, permit-equivalent (dashed), declared limit and BHP tests. Bottom: regulatory margin bars. No thinning; gaps break the lines. */
export type ChartSvg={svg:string;height:number};
const W=960,L=78,R=40,PW=W-L-R,TOP=58,PH1=240,GAP=56,PH2=140;
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const n=(v:number)=>v.toFixed(2),fmt=(v:number)=>Number(v.toPrecision(4)).toLocaleString('en-US');
const num=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
function niceMax(max:number){if(!(max>0))return 1;const pow=10**Math.floor(Math.log10(max));return [1,2,2.5,5,10].map(s=>s*pow).find(s=>s>=max)!;}
function frame(title:string,lines:string[],body:string,bodyHeight:number):ChartSvg{
  const notesY=TOP+bodyHeight+40,height=notesY+lines.length*18+16;
  const notes=lines.map((t,i)=>`<text x="${L}" y="${notesY+i*18}" font-size="12" fill="#37474f">${esc(t)}</text>`).join('');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" role="img" aria-label="${esc(title)}" font-family="system-ui, sans-serif"><rect width="${W}" height="${height}" fill="#ffffff"/><text x="${L}" y="26" font-size="16" font-weight="600">${esc(title)}</text>${body}${notes}</svg>`,height};
}
function path(series:string,points:(number|null)[],x:(i:number)=>number,y:(v:number)=>number,style:string){
  let d='',open=false;points.forEach((v,i)=>{if(v===null){open=false;return;}d+=`${open?'L':'M'}${n(x(i))} ${n(y(v))} `;open=true;});
  return d?`<path data-series="${series}" d="${d.trim()}" fill="none" ${style}/>`:'';
}
export function reconciliationSvg(rec:Reconciliation):ChartSvg{
  const title=`${LABEL_RECON} by month`,depth=rec.reportDepth;
  const notes=['Line: modelled flowing BHP; band: tubing and basis sensitivity; diamonds: BHP test (measured static); bars: permit minus reported maximum.',
    `Pressure basis: H-10 and permit pressures read as ${rec.surfaceBasis?`${rec.surfaceBasis.value} (${rec.surfaceBasis.reason})`:'not confirmed'}; BHP tests read as ${rec.bhpBasis?rec.bhpBasis.value:'not confirmed'}.`,
    `Report depth: ${depth.depthFt===null?'none':`${depth.depthFt} ft`} (${depth.source}).`,RATE_NOTE,`Dashed: permit-equivalent bottomhole pressure (${PERMIT_EQ_LABEL}).`,SCREENING_TEXT];
  const rows=rec.rows;
  if(!rows.length)return frame(title,notes,`<text x="${L}" y="${TOP+40}" font-size="14">${esc(`No months to chart. ${rec.readiness}`)}</text>`,60);
  const x=(i:number)=>L+PW*(i+0.5)/rows.length;
  const tops=rows.flatMap(r=>[r.modelled.band?.max??null,r.modelled.pwfPsia,r.permitEquivalent.pwfPsia,...r.tests.map(t=>t.pResPsia)]).filter(num);
  if(rec.declaredLimit)tops.push(rec.declaredLimit.psia);
  const yMax=niceMax(Math.max(1,...tops)),y=(v:number)=>TOP+PH1-PH1*v/yMax;
  let body=`<line x1="${L}" y1="${TOP}" x2="${L}" y2="${TOP+PH1}" stroke="#90a4ae"/><line x1="${L}" y1="${TOP+PH1}" x2="${L+PW}" y2="${TOP+PH1}" stroke="#90a4ae"/>`;
  for(let i=0;i<=4;i++){const v=yMax*i/4,yy=TOP+PH1-PH1*i/4;body+=`<line x1="${L}" y1="${n(yy)}" x2="${L+PW}" y2="${n(yy)}" stroke="#eceff1"/><text x="${L-8}" y="${n(yy+4)}" font-size="11" text-anchor="end">${esc(fmt(v))}</text>`;}
  body+=`<text x="16" y="${TOP+PH1/2}" font-size="12" transform="rotate(-90 16 ${TOP+PH1/2})" text-anchor="middle">${esc('Bottomhole pressure (psia), modelled')}</text>`;
  rows.forEach((r,i)=>{const b=r.modelled.band;if(b)body+=`<line data-series="band" x1="${n(x(i))}" y1="${n(y(b.min))}" x2="${n(x(i))}" y2="${n(y(b.max))}" stroke="#90caf9" stroke-width="6" stroke-linecap="round"/>`;});
  body+=path('modelled',rows.map(r=>r.modelled.pwfPsia),x,y,'stroke="#1565c0" stroke-width="2"');
  body+=path('permit-equivalent',rows.map(r=>r.permitEquivalent.pwfPsia),x,y,'stroke="#6d4c41" stroke-width="1.5" stroke-dasharray="6 4"');
  if(rec.declaredLimit)body+=`<line data-series="declared" x1="${L}" y1="${n(y(rec.declaredLimit.psia))}" x2="${L+PW}" y2="${n(y(rec.declaredLimit.psia))}" stroke="#c62828" stroke-dasharray="2 3"/><text x="${L+PW}" y="${n(y(rec.declaredLimit.psia)-5)}" font-size="11" text-anchor="end">${esc(`Declared limit ${fmt(rec.declaredLimit.psia)} psia`)}</text>`;
  rows.forEach((r,i)=>{for(const t of r.tests){if(t.pResPsia===null)continue;const cx=x(i),cy=y(t.pResPsia);
    body+=`<path data-series="test" d="M${n(cx)} ${n(cy-6)} L${n(cx+6)} ${n(cy)} L${n(cx)} ${n(cy+6)} L${n(cx-6)} ${n(cy)} Z" fill="${t.negative?'#c62828':'#2e7d32'}"><title>${esc(`${t.date}: BHP test ${fmt(t.pResPsia)} psia (measured static)${t.negative?'; model below measured static pressure':''}`)}</title></path>`;}});
  const top2=TOP+PH1+GAP,margins=rows.map(r=>r.regulatory.marginPsi),mMax=niceMax(Math.max(1,...margins.filter(num).map(Math.abs))),zero=top2+PH2/2,bw=Math.max(2,PW/rows.length*0.6);
  body+=`<line x1="${L}" y1="${top2}" x2="${L}" y2="${top2+PH2}" stroke="#90a4ae"/><line x1="${L}" y1="${zero}" x2="${L+PW}" y2="${zero}" stroke="#90a4ae"/>`;
  body+=`<text x="${L-8}" y="${top2+4}" font-size="11" text-anchor="end">${esc(fmt(mMax))}</text><text x="${L-8}" y="${top2+PH2+4}" font-size="11" text-anchor="end">${esc(fmt(-mMax))}</text>`;
  body+=`<text x="16" y="${top2+PH2/2}" font-size="12" transform="rotate(-90 16 ${top2+PH2/2})" text-anchor="middle">${esc('Regulatory margin (psi)')}</text>`;
  margins.forEach((v,i)=>{if(v===null)return;const h=(PH2/2)*Math.abs(v)/mMax,yy=v>=0?zero-h:zero;
    body+=`<rect data-series="regulatory"${v<0?' data-negative="true"':''} x="${n(x(i)-bw/2)}" y="${n(yy)}" width="${n(bw)}" height="${n(Math.max(h,0.5))}" fill="${v<0?'#c62828':'#2e7d32'}"><title>${esc(`${rows[i].month}: ${fmt(v)} psi${v<0?' (reported maximum above permit limit)':''}`)}</title></rect>`;});
  body+=`<text x="${L}" y="${top2+PH2+16}" font-size="11">${esc(rows[0].month)}</text><text x="${L+PW}" y="${top2+PH2+16}" font-size="11" text-anchor="end">${esc(rows[rows.length-1].month)}</text>`;
  return frame(title,notes,body,PH1+GAP+PH2);
}
