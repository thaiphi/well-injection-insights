import { LABEL_BHP, bhpSeries, type TestState } from './testRecords.js';

/** Pure SVG strings; escaped text only; no script, links or external references. */
export type ChartSvg={svg:string;height:number};
const W=960,L=78,R=40,PW=W-L-R,PH=260,TOP=58,DAY=86_400_000;
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const n=(v:number)=>v.toFixed(2);
const fmt=(v:number)=>Number(v.toPrecision(4)).toLocaleString('en-US');
function niceMax(max:number) {if(!(max>0)) return 1;const pow=10**Math.floor(Math.log10(max));return [1,2,2.5,5,10].map(s=>s*pow).find(s=>s>=max)!;}
const day=(d:string)=>Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7))-1,Number(d.slice(8,10)));
const labelLines=LABEL_BHP.split('. ').map((s,i,a)=>i<a.length-1?s+'.':s);
function frame(title:string,lines:string[],body:string,bodyHeight:number):ChartSvg {
  const notesY=TOP+bodyHeight+40,height=notesY+lines.length*18+16;
  const notes=lines.map((t,i)=>`<text x="${L}" y="${notesY+i*18}" font-size="12" fill="#37474f">${esc(t)}</text>`).join('');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" role="img" aria-label="${esc(title)}" font-family="system-ui, sans-serif"><rect width="${W}" height="${height}" fill="#ffffff"/><text x="${L}" y="26" font-size="16" font-weight="600">${esc(title)}</text><text x="${L}" y="46" font-size="12" fill="#455a64">${esc('Test records as reported; points are separate tests, not a series.')}</text>${body}${notes}</svg>`,height};
}

/** Reported BHP at each included comparable test's actual date, labelled with its depth. */
export function testPressureSvg(state:TestState):ChartSvg {
  const title='Reported bottomhole pressure by test date',s=bhpSeries(state);
  const ref=state.referenceTie?'Reference depth: none (no single most-common depth)':state.referenceDepthFt===null?'Reference depth: none (no test depth reported)':`Reference depth: ${state.referenceDepthFt} ft`;
  if(!s.enough) return frame(title,[ref,...labelLines],`<text x="${L}" y="${TOP+40}" font-size="14">${esc(`Not enough comparable tests (${s.points.length} of ${s.needed} needed)`)}</text>`,60);
  const t0=day(s.points[0].date)-30*DAY,t1=day(s.points[s.points.length-1].date)+30*DAY,yMax=niceMax(Math.max(...s.points.map(p=>p.psia)));
  const x=(d:string)=>L+PW*(day(d)-t0)/(t1-t0),y=(v:number)=>TOP+PH-PH*v/yMax;
  let body=`<line x1="${L}" y1="${TOP}" x2="${L}" y2="${TOP+PH}" stroke="#90a4ae"/><line x1="${L}" y1="${TOP+PH}" x2="${L+PW}" y2="${TOP+PH}" stroke="#90a4ae"/>`;
  for(let i=0;i<=4;i++) {const v=yMax*i/4,yy=TOP+PH-PH*i/4;body+=`<line x1="${L}" y1="${n(yy)}" x2="${L+PW}" y2="${n(yy)}" stroke="#eceff1"/><text x="${L-8}" y="${n(yy+4)}" font-size="11" text-anchor="end">${esc(fmt(v))}</text>`;}
  body+=`<text x="16" y="${TOP+PH/2}" font-size="12" transform="rotate(-90 16 ${TOP+PH/2})" text-anchor="middle">${esc('Reported BHP (source field named psia)')}</text>`;
  for(const p of s.points) body+=`<circle cx="${n(x(p.date))}" cy="${n(y(p.psia))}" r="4" fill="#6a1b9a"><title>${esc(`${p.date}: ${fmt(p.psia)} (source field named psia) at ${p.depthFt} ft`)}</title></circle><text x="${n(x(p.date))}" y="${n(y(p.psia)-9)}" font-size="11" text-anchor="middle">${esc(`${p.depthFt} ft`)}</text>`;
  body+=`<text x="${L}" y="${TOP+PH+16}" font-size="11">${esc(s.points[0].date)}</text><text x="${L+PW}" y="${TOP+PH+16}" font-size="11" text-anchor="end">${esc(s.points[s.points.length-1].date)}</text>`;
  return frame(title,[`Points: ${s.points.length} included comparable tests.`,ref,...labelLines],body,PH);
}
