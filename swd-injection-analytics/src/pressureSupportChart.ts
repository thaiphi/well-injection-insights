import type { ContextResult } from './pressureSupport.js';

/** Pure, self-contained SVG for live display and exports alike: escaped text only, no script, links or external references. */
const W=960,L=78,R=96,PW=W-L-R,A_H=250,B_H=120,PANEL_GAP=44,TEXT_W=W-L-12;
/** Conservative average glyph width (em) for system-ui; used only to wrap text inside the 960-unit viewBox. */
const GLYPH_EM=0.62;
const INJECTOR_COLOURS=['#ef6c00','#8e24aa','#c62828','#00695c','#5d4037'];
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const n=(v:number)=>v.toFixed(2);
const fmt=(v:number)=>Number(v.toPrecision(6)).toLocaleString('en-US');
function niceMax(max:number) {
  if(!(max>0)) return 1;
  const pow=10**Math.floor(Math.log10(max));
  return [1,2,2.5,5,10].map(s=>s*pow).find(s=>s>=max)!;
}
const monthStart=(month:string)=>Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1);
const nextMonthStart=(month:string)=>Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1);
function path(points:[number,number|null][]) {
  let d='',open=false;
  for(const [x,y] of points) {if(y===null) {open=false;continue;}d+=`${open?'L':'M'}${n(x)} ${n(y)}`;open=true;}
  return d;
}
/** Approximate wide glyphs (CJK, Hangul, full-width forms, emoji); an estimate for wrapping only, not a font model. */
const WIDE=/\p{Extended_Pictographic}|[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3FFFD}]/u;
const segmenter=typeof Intl!=='undefined'&&'Segmenter' in Intl?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
/** Grapheme clusters (code points as fallback), so a break never falls inside a surrogate pair or combined character. */
const clusters=(text:string)=>segmenter?Array.from(segmenter.segment(text),s=>s.segment):Array.from(text);
/** Width in narrow-glyph units: ASCII counts its code units (same as before), wide glyphs 2, other clusters 1. */
const units=(g:string)=>/^[\x00-\x7F]+$/.test(g)?g.length:WIDE.test(g)?2:1;
/** Split into contiguous pieces (break after a space when possible, else between clusters) whose concatenation is exactly the input. */
export function wrapText(text:string,size:number,width=TEXT_W):string[] {
  const max=Math.max(8,Math.floor(width/(size*GLYPH_EM))),parts=clusters(text),w=parts.map(units),pieces:string[]=[];
  let i=0,remaining=w.reduce((a,b)=>a+b,0);
  while(remaining>max) {
    let end=i,sum=0;
    while(end<parts.length&&sum+w[end]<=max) {sum+=w[end];end++;}
    let space=-1;
    for(let k=Math.min(end,parts.length-1);k>i;k--) if(parts[k]===' ') {space=k;break;}
    const stop=space>i?space+1:Math.max(end,i+1);
    pieces.push(parts.slice(i,stop).join(''));
    for(let k=i;k<stop;k++) remaining-=w[k];
    i=stop;
  }
  pieces.push(parts.slice(i).join(''));return pieces;
}
/** One <text> per logical line; wrapped pieces are tspans, so the element's text content equals the original string. */
function textBlock(lines:string[],y:number,{size=12,lineHeight=18,attrs=''}:{size?:number;lineHeight?:number;attrs?:string}={}):{svg:string;next:number} {
  let svg='',row=0;
  for(const line of lines) {
    const pieces=wrapText(line,size);
    svg+=`<text x="${L}" y="${y+row*lineHeight}" font-size="${size}"${attrs}>${pieces.map((p,i)=>`<tspan x="${L}"${i?` dy="${lineHeight}"`:''}>${esc(p)}</tspan>`).join('')}</text>`;
    row+=pieces.length;
  }
  return {svg,next:y+row*lineHeight};
}

export function pressureContextChartSvg(result:ContextResult):string {
  const head=(height:number,title:string,desc:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" role="img" aria-labelledby="ps-title ps-desc" font-family="system-ui, sans-serif"><title id="ps-title">${esc(title)}</title><desc id="ps-desc">${esc(desc)}</desc><rect width="${W}" height="${height}" fill="#ffffff"/>`;
  if(!result.ready||!result.monthly.length) {
    const block=textBlock(['Context unavailable',...result.reasons],32);const height=block.next+10;
    return `${head(height,'Pressure-support context unavailable',result.reasons.join(' '))}${block.svg}</svg>`;
  }
  const sel=result.selection as {producerId:string;injectorIds:string[];firstMonth:string;lastMonth:string};
  // Header: title, identity, complete SHA-256 and the limitation each on their own wrapped lines; panels move down by one uniform offset.
  const title=textBlock([`Pressure-support context · ${sel.producerId} · ${sel.firstMonth} to ${sel.lastMonth}`],20,{size:15,lineHeight:20,attrs:' font-weight="600"'});
  const identity=textBlock([`${result.classification} · dataset ${result.source?.datasetId}`,`sha256 ${result.source?.sha256}`,'investigation view, not a pressure-support determination'],title.next-2,{size:11,lineHeight:15,attrs:' fill="#555"'});
  const A_TOP=identity.next+7,B_TOP=A_TOP+A_H+PANEL_GAP,AXIS_Y=B_TOP+B_H;
  const months=result.monthly,t0=monthStart(sel.firstMonth),t1=nextMonthStart(sel.lastMonth);
  const xAt=(t:number)=>L+(t-t0)/(t1-t0)*PW,mid=(m:string)=>xAt((monthStart(m)+nextMonthStart(m))/2);
  const rateMax=niceMax(Math.max(0,...months.flatMap(m=>[m.oilRateStbd,m.waterRateStbd,m.liquidRateStbd]).filter((v):v is number=>v!==null)));
  const injMax=niceMax(Math.max(0,...months.flatMap(m=>[...Object.values(m.injectorVolumesBbl),m.completeInjectionVolumeBbl]).filter((v):v is number=>v!==null)));
  const yRate=(v:number|null)=>v===null?null:A_TOP+A_H-v/rateMax*A_H,yInj=(v:number|null)=>v===null?null:A_TOP+A_H-v/injMax*A_H;
  const yCut=(v:number|null)=>v===null?null:B_TOP+B_H-v/100*B_H;
  const series:{id:string;label:string;colour:string;dash?:string;points:[number,number|null][]}[]=[
    {id:'oil-rate',label:'Oil rate (STB/day, left axis)',colour:'#2e7d32',points:months.map(m=>[mid(m.month),yRate(m.oilRateStbd)])},
    {id:'water-rate',label:'Water rate (STB/day, left axis)',colour:'#1565c0',points:months.map(m=>[mid(m.month),yRate(m.waterRateStbd)])},
    {id:'liquid-rate',label:'Liquid rate (STB/day, left axis)',colour:'#6d4c41',dash:'2 3',points:months.map(m=>[mid(m.month),yRate(m.liquidRateStbd)])},
    ...sel.injectorIds.map((id,i)=>({id:`injector-${id}`,label:`Injection ${id} (bbl/month, right axis)`,colour:INJECTOR_COLOURS[i%INJECTOR_COLOURS.length],dash:'6 3',
      points:months.map(m=>[mid(m.month),yInj(m.injectorVolumesBbl[id]??null)] as [number,number|null])})),
    ...(sel.injectorIds.length>1?[{id:'injection-total',label:'Complete selected injection total (bbl/month, right axis)',colour:'#424242',dash:'10 4',
      points:months.map(m=>[mid(m.month),yInj(m.completeInjectionVolumeBbl)] as [number,number|null])}]:[]),
  ];
  const cut={id:'water-cut',colour:'#00838f',points:months.map(m=>[mid(m.month),yCut(m.waterCutPct)] as [number,number|null])};
  const out:string[]=[];
  out.push(title.svg,identity.svg);
  for(const [top,h] of [[A_TOP,A_H],[B_TOP,B_H]]) out.push(`<rect x="${L}" y="${top}" width="${PW}" height="${h}" fill="none" stroke="#bbb"/>`);
  for(let i=0;i<=5;i++) {
    const y=A_TOP+A_H-i/5*A_H;
    out.push(`<line x1="${L}" x2="${L+PW}" y1="${n(y)}" y2="${n(y)}" stroke="#eee"/><text x="${L-6}" y="${n(y+4)}" font-size="10" text-anchor="end">${esc(fmt(rateMax*i/5))}</text><text x="${L+PW+6}" y="${n(y+4)}" font-size="10">${esc(fmt(injMax*i/5))}</text>`);
  }
  for(const pct of [0,25,50,75,100]) {const y=yCut(pct)!;out.push(`<line x1="${L}" x2="${L+PW}" y1="${n(y)}" y2="${n(y)}" stroke="#eee"/><text x="${L-6}" y="${n(y+4)}" font-size="10" text-anchor="end">${pct}</text>`);}
  out.push(`<text transform="translate(16 ${A_TOP+A_H/2}) rotate(-90)" font-size="11" text-anchor="middle">Producer rate (STB/day)</text>`);
  out.push(`<text transform="translate(${W-14} ${A_TOP+A_H/2}) rotate(90)" font-size="11" text-anchor="middle">Injection (bbl/month)</text>`);
  out.push(`<text transform="translate(16 ${B_TOP+B_H/2}) rotate(-90)" font-size="11" text-anchor="middle">Water cut (%)</text>`);
  out.push(`<text x="${L+4}" y="${B_TOP-6}" font-size="11">Water cut (%) = water / (oil + water); gaps are unavailable months</text>`);
  for(const m of months) {
    const x=xAt(monthStart(m.month));
    out.push(`<rect data-month-start="${esc(m.month)}" x="${n(x)}" y="${AXIS_Y}" width="0.6" height="5" fill="#888"/>`);
    if(m.month.endsWith('-01')||m.month.endsWith('-07')||m.month===sel.firstMonth) out.push(`<text x="${n(x)}" y="${AXIS_Y+18}" font-size="10">${esc(m.month)}</text>`);
  }
  for(const s of series) {const d=path(s.points);if(d) out.push(`<path data-series="${esc(s.id)}" fill="none" stroke="${s.colour}" stroke-width="2"${s.dash?` stroke-dasharray="${s.dash}"`:''} d="${d}"/>`);}
  const cutPath=path(cut.points);if(cutPath) out.push(`<path data-series="${cut.id}" fill="none" stroke="${cut.colour}" stroke-width="2" d="${cutPath}"/>`);
  for(const s of [...series,cut]) for(const [x,y] of s.points) if(y!==null) out.push(`<circle cx="${n(x)}" cy="${n(y)}" r="2" fill="${s.colour}"/>`);
  const inside=result.events.filter(e=>e.withinSelection),outside=result.events.filter(e=>!e.withinSelection);
  for(const e of inside) {
    const [y,mo,d]=e.date.split('-').map(Number),x=xAt(Date.UTC(y,mo-1,d)+43200000);
    const label=`${e.kind} ${e.eventId}`,flip=x+3+label.length*10*GLYPH_EM>W-4;
    out.push(`<line data-event-date="${esc(e.date)}" x1="${n(x)}" x2="${n(x)}" y1="${A_TOP}" y2="${AXIS_Y}" stroke="#d81b60" stroke-dasharray="3 3"/><text x="${n(flip?x-3:x+3)}" y="${A_TOP+12}" font-size="10" fill="#d81b60"${flip?' text-anchor="end"':''}>${esc(label)}</text>`);
  }
  const legend=[...series.map(s=>s.label),'Water cut (%) (lower panel)','Dashed vertical lines: dated frac annotations (not a fitted or calibrated response)'];
  const eventLines=[...inside.map(e=>`Frac event ${e.eventId} on ${e.date} (${e.classification}): ${e.citation}${e.uncertainty?` — ${e.uncertainty}`:''}`),
    ...(outside.length?['Events outside the selected period (listed, not plotted):',...outside.map(e=>`${e.eventId} on ${e.date}${e.withinCoverage?'':' (outside declared coverage)'}: ${e.citation}`)]:[])];
  const missing=months.filter(m=>m.missingReasons.length).map(m=>`${m.month}: ${m.missingReasons.join('; ')}`);
  const notes=[...legend,...eventLines,...(missing.length?['Missing observations / unavailable values (not interpolated):',...missing]:[])];
  const noteBlock=textBlock(notes,AXIS_Y+40),height=noteBlock.next+10;
  return `${head(height,`Pressure-support context for ${sel.producerId}`,`Synthetic producer rates (STB/day), selected injection volumes (bbl/month, separate axis), water cut and frac annotations, ${sel.firstMonth} to ${sel.lastMonth}.`)}${out.join('')}${noteBlock.svg}</svg>`;
}
