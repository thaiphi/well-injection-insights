import { LABEL_SCREENING, LABEL_SURFACE, screening, type DiagnosticsState } from './h10Diagnostics.js';

/** Pure SVG strings for display and export alike: escaped text only, no script, links or external references; no decimation. */
export type ChartSvg={svg:string;height:number};
const W=960,L=78,R=40,PW=W-L-R,PH=260,TOP=58;
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const n=(v:number)=>v.toFixed(2);
const fmt=(v:number)=>Number(v.toPrecision(4)).toLocaleString('en-US');
function niceMax(max:number) {if(!(max>0)) return 1;const pow=10**Math.floor(Math.log10(max));return [1,2,2.5,5,10].map(s=>s*pow).find(s=>s>=max)!;}
const monthStart=(m:string)=>Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7))-1,1);
const nextMonth=(m:string)=>Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),1);
function frame(title:string,lines:string[],body:string,bodyHeight:number):ChartSvg {
  const notesY=TOP+bodyHeight+40,height=notesY+lines.length*18+16;
  const notes=lines.map((t,i)=>`<text x="${L}" y="${notesY+i*18}" font-size="12" fill="#37474f">${esc(t)}</text>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" role="img" aria-label="${esc(title)}" font-family="system-ui, sans-serif"><rect width="${W}" height="${height}" fill="#ffffff"/><text x="${L}" y="26" font-size="16" font-weight="600">${esc(title)}</text><text x="${L}" y="46" font-size="12" fill="#455a64">${esc(LABEL_SURFACE)}. ${esc(LABEL_SCREENING)}.</text>${body}${notes}</svg>`;
  return {svg,height};
}
function notEnough(title:string,count:number,needed:number):ChartSvg {
  return frame(title,[LABEL_SURFACE,LABEL_SCREENING],`<text x="${L}" y="${TOP+40}" font-size="14">${esc(`Not enough comparable months (${count} of ${needed} needed)`)}</text>`,60);
}
function yAxis(max:number,label:string) {
  let s=`<line x1="${L}" y1="${TOP}" x2="${L}" y2="${TOP+PH}" stroke="#90a4ae"/>`;
  for(let i=0;i<=4;i++) {const v=max*i/4,y=TOP+PH-PH*i/4;s+=`<line x1="${L}" y1="${n(y)}" x2="${L+PW}" y2="${n(y)}" stroke="#eceff1"/><text x="${L-8}" y="${n(y+4)}" font-size="11" text-anchor="end">${esc(fmt(v))}</text>`;}
  return s+`<text x="16" y="${TOP+PH/2}" font-size="12" transform="rotate(-90 16 ${TOP+PH/2})" text-anchor="middle">${esc(label)}</text>`;
}

/** Reported average pressure against calendar-day rate for included comparable months. */
export function pressureRateSvg(state:DiagnosticsState):ChartSvg {
  const title='Reported average pressure vs calendar-day rate',sc=screening(state);
  if(!sc.enough) return notEnough(title,sc.points.length,sc.needed);
  const xMax=niceMax(Math.max(...sc.points.map(p=>p.rateBpd))),yMax=niceMax(Math.max(...sc.points.map(p=>p.avgPsi)));
  let body=yAxis(yMax,'Reported average pressure (psi)')+`<line x1="${L}" y1="${TOP+PH}" x2="${L+PW}" y2="${TOP+PH}" stroke="#90a4ae"/>`;
  for(let i=0;i<=4;i++) {const v=xMax*i/4,x=L+PW*i/4;body+=`<text x="${n(x)}" y="${TOP+PH+16}" font-size="11" text-anchor="middle">${esc(fmt(v))}</text>`;}
  body+=`<text x="${L+PW/2}" y="${TOP+PH+32}" font-size="12" text-anchor="middle">Calendar-day rate (bbl/day)</text>`;
  for(const p of sc.points) body+=`<circle cx="${n(L+PW*p.rateBpd/xMax)}" cy="${n(TOP+PH-PH*p.avgPsi/yMax)}" r="4" fill="#1262b5"><title>${esc(`${p.month}: ${fmt(p.rateBpd)} bbl/day, ${fmt(p.avgPsi)} psi`)}</title></circle>`;
  return frame(title,[`Points: ${sc.points.length} included comparable months.`],body,PH);
}

/** Screening ratio over a real time axis; gaps and excluded months break the line and are marked. */
export function ratioOverTimeSvg(state:DiagnosticsState):ChartSvg {
  const title='Reported pressure per unit rate over time (psi per bbl/day)',sc=screening(state);
  if(!sc.enough) return notEnough(title,sc.points.length,sc.needed);
  const first=state.months[0].month,last=state.months[state.months.length-1].month,t0=monthStart(first),t1=nextMonth(last);
  const x=(m:string)=>L+PW*((monthStart(m)+nextMonth(m))/2-t0)/(t1-t0);
  const byMonth=new Map(sc.points.map(p=>[p.month,p])),yMax=niceMax(Math.max(...sc.points.map(p=>p.ratio)));
  let body=yAxis(yMax,'psi per bbl/day')+`<line x1="${L}" y1="${TOP+PH}" x2="${L+PW}" y2="${TOP+PH}" stroke="#90a4ae"/>`;
  let d='',open=false;const gaps:string[]=[],excluded:string[]=[];
  for(const m of state.months) {
    const p=byMonth.get(m.month);
    if(p) {d+=`${open?' L':(d?' M':'M')}${n(x(m.month))} ${n(TOP+PH-PH*p.ratio/yMax)}`;open=true;continue;}
    open=false;
    const x0=L+PW*(monthStart(m.month)-t0)/(t1-t0),w=PW*(nextMonth(m.month)-monthStart(m.month))/(t1-t0);
    if(m.gap) {gaps.push(m.month);body+=`<rect data-gap="${esc(m.month)}" x="${n(x0)}" y="${TOP}" width="${n(w)}" height="${PH}" fill="#ffe0b2" opacity="0.6"><title>${esc(m.month)}: no report (gap)</title></rect>`;}
    else if(!state.decisions[m.month]?.include) {excluded.push(m.month);body+=`<text data-excluded="${esc(m.month)}" x="${n(x0+w/2)}" y="${TOP+PH-4}" font-size="11" text-anchor="middle" fill="#78909c">×<title>${esc(`${m.month}: excluded — ${state.decisions[m.month]?.reason??m.flags.join(', ')}`)}</title></text>`;}
  }
  body+=`<path d="${d}" fill="none" stroke="#1262b5" stroke-width="2"/>`;
  for(const p of sc.points) body+=`<circle cx="${n(x(p.month))}" cy="${n(TOP+PH-PH*p.ratio/yMax)}" r="3" fill="#1262b5"><title>${esc(`${p.month}: ${fmt(p.ratio)} psi per bbl/day`)}</title></circle>`;
  body+=`<text x="${L}" y="${TOP+PH+16}" font-size="11">${esc(first)}</text><text x="${L+PW}" y="${TOP+PH+16}" font-size="11" text-anchor="end">${esc(last)}</text>`;
  const lines=[`Gap months (no report): ${gaps.length?gaps.join(', '):'none'}`,`Excluded months: ${excluded.length?excluded.join(', '):'none'}`,'Lines are not drawn across gaps or excluded months; nothing is interpolated.'];
  return frame(title,lines,body,PH);
}
