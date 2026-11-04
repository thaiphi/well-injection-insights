import {BASIS_STATEMENT,LABEL_J,type Estimate} from './injectivityEstimate.js';

/** Pure SVG; escaped text only. J per qualifying test at its date; the bar spans the basis and tubing sensitivities. */
export type ChartSvg={svg:string;height:number};
const W=960,L=78,R=40,PW=W-L-R,PH=260,TOP=58,DAY=86_400_000;
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const n=(v:number)=>v.toFixed(2),fmt=(v:number)=>Number(v.toPrecision(4)).toLocaleString('en-US');
const day=(d:string)=>Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7))-1,Number(d.slice(8,10)));
function niceMax(max:number){if(!(max>0))return 1;const pow=10**Math.floor(Math.log10(max));return [1,2,2.5,5,10].map(s=>s*pow).find(s=>s>=max)!;}
const NOTES=[BASIS_STATEMENT.split('; ').slice(0,2).join('; ')+';',BASIS_STATEMENT.split('; ').slice(2).join('; '),'Bars span J under the other basis reading and the tubing sizes 3.958, 4.892 and 6.276 in.'];
function frame(title:string,lines:string[],body:string,bodyHeight:number):ChartSvg{
  const notesY=TOP+bodyHeight+40,height=notesY+lines.length*18+16;
  const notes=lines.map((t,i)=>`<text x="${L}" y="${notesY+i*18}" font-size="12" fill="#37474f">${esc(t)}</text>`).join('');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" role="img" aria-label="${esc(title)}" font-family="system-ui, sans-serif"><rect width="${W}" height="${height}" fill="#ffffff"/><text x="${L}" y="26" font-size="16" font-weight="600">${esc(title)}</text>${body}${notes}</svg>`,height};
}
export function jEstimateSvg(est:Estimate):ChartSvg{
  const title=`${LABEL_J} by test date`,q=est.qualifying.map(k=>est.tests.find(t=>t.key===k)!);
  if(!q.length)return frame(title,NOTES,`<text x="${L}" y="${TOP+40}" font-size="14">${esc(`No ${LABEL_J} to chart. ${est.readiness}`)}</text>`,60);
  const spans=q.map(t=>{const all=[t.j!,t.jAlternateBasis,...t.jByTubing.map(x=>x.j)].filter((v):v is number=>v!==null);return {t,lo:Math.min(...all),hi:Math.max(...all)};});
  const t0=day(q[0].date!)-30*DAY,t1=day(q[q.length-1].date!)+30*DAY,yMax=niceMax(Math.max(...spans.map(s=>s.hi)));
  const x=(d:string)=>L+PW*(day(d)-t0)/(t1-t0),y=(v:number)=>TOP+PH-PH*v/yMax;
  let body=`<line x1="${L}" y1="${TOP}" x2="${L}" y2="${TOP+PH}" stroke="#90a4ae"/><line x1="${L}" y1="${TOP+PH}" x2="${L+PW}" y2="${TOP+PH}" stroke="#90a4ae"/>`;
  for(let i=0;i<=4;i++){const v=yMax*i/4,yy=TOP+PH-PH*i/4;body+=`<line x1="${L}" y1="${n(yy)}" x2="${L+PW}" y2="${n(yy)}" stroke="#eceff1"/><text x="${L-8}" y="${n(yy+4)}" font-size="11" text-anchor="end">${esc(fmt(v))}</text>`;}
  body+=`<text x="16" y="${TOP+PH/2}" font-size="12" transform="rotate(-90 16 ${TOP+PH/2})" text-anchor="middle">${esc('J (STB/day/psi), estimate')}</text>`;
  for(const {t,lo,hi} of spans){const cx=n(x(t.date!)),chosen=t.key===est.chosenKey;
    body+=`<line x1="${cx}" y1="${n(y(lo))}" x2="${cx}" y2="${n(y(hi))}" stroke="#8e24aa" stroke-width="2"/><circle cx="${cx}" cy="${n(y(t.j!))}" r="${chosen?6:4}" fill="${chosen?'#4a148c':'#ab47bc'}"><title>${esc(`${t.date}: J ${fmt(t.j!)} STB/day/psi (estimate), H-10 ${t.month}${chosen?', chosen':''}`)}</title></circle><text x="${cx}" y="${n(y(hi)-9)}" font-size="11" text-anchor="middle">${esc(fmt(t.j!))}</text>`;}
  body+=`<text x="${L}" y="${TOP+PH+16}" font-size="11">${esc(q[0].date)}</text><text x="${L+PW}" y="${TOP+PH+16}" font-size="11" text-anchor="end">${esc(q[q.length-1].date)}</text>`;
  return frame(title,[`Points: ${q.length} qualifying tests; the larger point is the chosen J.`,...NOTES],body,PH);
}
