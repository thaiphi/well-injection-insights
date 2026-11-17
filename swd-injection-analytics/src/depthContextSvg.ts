/** E11 depth view (review aid): the deterministic SVG drawing of a DepthContext.
 * No clock, no random ids, fixed number formatting. Every curve node and every placed row is drawn (no decimation, D16).
 * Gaps are not drawn; the panel and the exports list them. User text is XML-escaped. */
import {CONTENT_CLASS_LABELS,type ProfileRow} from './depthProfile.js';
import {LIMIT_LABEL,type DepthContext,type Track} from './depthContext.js';

export const CURVE_LABEL='modelled (case, assumed inputs)';
export const TEST_LABEL='measured (as entered, with source)';

const SW=120,PW=170,PGAP=10,TRACK_W=SW+PGAP+PW,TRACK_GAP=34,LEFT=64,RIGHT=24,TOP=78,PLOT_H=420;
const RED='#c62828',BLUE='#1f4e8c',GRAY='#555',LIGHT='#d9d9d9';

/** Fixed two-decimal formatting; -0 prints as 0. */
const n=(v:number):string=>String(+v.toFixed(2));
// Characters XML 1.0 cannot carry are replaced by U+FFFD in drawn text.
const ILLEGAL=/[^\t\n\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;
const esc=(s:string):string=>s.replace(ILLEGAL,'\uFFFD').replace(/[&<>"']/g,c=>c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c==='"'?'&quot;':'&apos;');
/** The JSON goes in <metadata>: only & < > " ' are escaped (verifyDepthSvg reverses exactly those). A character XML cannot carry can only sit inside a JSON string, so it is written as a JSON \\u escape, which parses back to the same character. */
export const escapeMetadata=(json:string):string=>json.replace(ILLEGAL,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).replace(/[&<>"']/g,c=>c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c==='"'?'&quot;':'&apos;');
export const unescapeMetadata=(s:string):string=>s.replace(/&(amp|lt|gt|quot|apos);/g,(_,k:string)=>k==='amp'?'&':k==='lt'?'<':k==='gt'?'>':k==='quot'?'"':"'");

function wrap(text:string,max:number):string[] {
  const out:string[]=[];let cur='';
  for(const w of text.split(/\s+/).filter(Boolean)) {
    if(cur&&cur.length+1+w.length>max){out.push(cur);cur=w;}
    else cur=cur?cur+' '+w:w;
  }
  if(cur)out.push(cur);
  return out.length?out:[''];
}
/** Smallest step of the form 10^k x {1,2,5} (k >= 0) with at most `target` steps across `max`: the tick count stays bounded for any finite value. */
export function niceStep(max:number,target:number):number {
  if(!Number.isFinite(max))throw Error('Depth view axis is not finite');
  if(!(max>0))return 1;
  for(let k=0;;k++) {
    for(const m of [1,2,5]) {const s=m*10**k;if(max/s<=target)return s;}
  }
}
const niceCeil=(v:number):number=>{if(!(v>0))return 1;const s=niceStep(v,4);return Math.ceil(v/s)*s;};

const KIND_NAME:Record<ProfileRow['kind'],string>={'depth-reference':'depth reference','survey':'survey','casing':'casing','packer':'packer','permitted-interval':'permitted interval','perforated-interval':'perforated interval','formation-top':'formation top','test-point':'test'};
function itemLabel(r:ProfileRow):string {
  const cls=CONTENT_CLASS_LABELS[r.contentClass];
  switch(r.kind) {
    case 'casing':return `casing${r.sizeIn!==null?` ${n(r.sizeIn)} in`:''} · ${cls}`;
    case 'formation-top':return `${r.label??'formation top'} · ${cls}`;
    case 'test-point':return `${r.testDate??''} ${r.testType??''} · ${cls}`.trim();
    default:return `${KIND_NAME[r.kind]} · ${cls}`;
  }
}
const titleOf=(r:ProfileRow,extra?:string):string=>`<title>${esc(`${itemLabel(r)}; source: ${r.sourceRef}${extra?`; ${extra}`:''}`)}</title>`;

function pressureMax(ctx:DepthContext):number {
  let m=0;
  for(const t of ctx.tracks) {
    if(t.curve.status==='drawn'){for(const p of t.curve.nodes)m=Math.max(m,p.pressurePsia);m=Math.max(m,t.curve.limitMarker.pressurePsia);}
    for(const i of t.items)if(i.placement.status==='placed'&&i.placement.pressurePsia!==undefined)m=Math.max(m,i.placement.pressurePsia);
  }
  if(ctx.selection.referencePressurePsia!==null)m=Math.max(m,ctx.selection.referencePressurePsia);
  return niceCeil(m);
}

export function depthContextSvg(ctx:DepthContext,metadataJson:string|null):string {
  const count=ctx.tracks.length;
  const width=Math.max(660,LEFT+count*TRACK_W+(count-1)*TRACK_GAP+RIGHT);
  const axisMax=ctx.axisMaxFt>0?ctx.axisMaxFt:1,pMax=pressureMax(ctx);
  const y=(d:number)=>TOP+d/axisMax*PLOT_H;
  const px=(p:number)=>SW+PGAP+p/pMax*PW;
  const sel=ctx.selection;
  const body:string[]=[];
  // Shared depth axis (depth increases downwards) and light grid across every track.
  const dStep=niceStep(axisMax,8);
  body.push(`<g class="depth-axis" font-size="10" fill="${GRAY}" text-anchor="end">`);
  body.push(`<line x1="${LEFT-6}" y1="${n(y(0))}" x2="${LEFT-6}" y2="${n(y(axisMax))}" stroke="${GRAY}"/>`);
  for(let d=0;d<=axisMax+1e-9;d+=dStep) {
    body.push(`<line x1="${LEFT-10}" y1="${n(y(d))}" x2="${LEFT-6}" y2="${n(y(d))}" stroke="${GRAY}"/>`);
    body.push(`<text x="${LEFT-12}" y="${n(y(d)+3)}">${n(d)}</text>`);
  }
  body.push(`<text transform="translate(12,${TOP+PLOT_H/2}) rotate(-90)" text-anchor="middle">${esc(`${sel.basis} depth below the depth reference (ft)`)}</text>`);
  body.push('</g>');
  const notes:string[]=[];
  ctx.tracks.forEach((t:Track,i:number)=>{
    const x0=LEFT+i*(TRACK_W+TRACK_GAP);
    const g:string[]=[`<g data-well="${esc(t.wellId)}" transform="translate(${n(x0)},0)">`];
    g.push(`<text x="0" y="${TOP-44}" font-size="12" font-weight="bold" fill="#111">${esc(t.wellId)}</text>`);
    g.push(`<text x="0" y="${TOP-30}" font-size="9" fill="${GRAY}">${esc(t.reference?`depth reference ${t.reference.name||'(unnamed)'}; wellhead ${n(t.reference.wellheadBelowReferenceFt)} ft below it`:'depth reference not declared')}</text>`);
    g.push(`<rect x="0" y="${TOP}" width="${SW}" height="${PLOT_H}" fill="none" stroke="${LIGHT}"/>`);
    g.push(`<rect x="${SW+PGAP}" y="${TOP}" width="${PW}" height="${PLOT_H}" fill="none" stroke="${LIGHT}"/>`);
    // Pressure axis ticks (psia).
    const pStep=niceStep(pMax,4);
    for(let p=0;p<=pMax+1e-9;p+=pStep) {
      g.push(`<line x1="${n(px(p))}" y1="${TOP}" x2="${n(px(p))}" y2="${TOP+PLOT_H}" stroke="#eee"/>`);
      g.push(`<text x="${n(px(p))}" y="${TOP-4}" font-size="9" fill="${GRAY}" text-anchor="middle">${n(p)}</text>`);
    }
    g.push(`<text x="${SW+PGAP}" y="${TOP-16}" font-size="9" fill="${GRAY}">pressure (psia)</text>`);
    // Schematic column: casing, packer, intervals and formation tops.
    const ordered=t.items.filter(it=>it.placement.status==='placed');
    for(const {row:r,placement:p} of ordered) {
      if(p.status!=='placed')continue;
      const top=y(p.topFt),bot=p.bottomFt===null?null:y(p.bottomFt);
      const conv=p.conversion?`converted from ${p.conversion.from} with a survey`:'';
      if(r.kind==='casing') {
        if(bot!==null)g.push(`<rect class="casing" data-row="${r.row}" x="34" y="${n(top)}" width="10" height="${n(bot-top)}" fill="#bdbdbd" stroke="#616161">${titleOf(r,conv)}</rect>`);
        else g.push(`<line class="casing" data-row="${r.row}" x1="30" y1="${n(top)}" x2="48" y2="${n(top)}" stroke="#616161">${titleOf(r,conv)}</line>`);
        g.push(`<text x="48" y="${n((bot??top)-2)}" font-size="8" fill="#333">${esc(itemLabel(r))}</text>`);
      } else if(r.kind==='packer') {
        g.push(`<rect class="packer" data-row="${r.row}" x="22" y="${n(top-2.5)}" width="34" height="5" fill="#424242">${titleOf(r,conv)}</rect>`);
        g.push(`<text x="58" y="${n(top+3)}" font-size="8" fill="#333">${esc(itemLabel(r))}</text>`);
      } else if(r.kind==='permitted-interval'||r.kind==='perforated-interval') {
        const perf=r.kind==='perforated-interval',xx=perf?66:6,ww=perf?14:50,h=bot===null?0:bot-top;
        if(bot!==null)g.push(`<rect class="${r.kind}" data-row="${r.row}" x="${xx}" y="${n(top)}" width="${ww}" height="${n(h)}" fill="${perf?'#ef6c00':'#90caf9'}" fill-opacity="${perf?'0.7':'0.4'}" stroke="${perf?'#e65100':BLUE}"${perf?'':' stroke-dasharray="3 2"'}>${titleOf(r,conv)}</rect>`);
        else g.push(`<line class="${r.kind}" data-row="${r.row}" x1="${xx}" y1="${n(top)}" x2="${xx+ww}" y2="${n(top)}" stroke="${BLUE}">${titleOf(r,conv)}</line>`);
        g.push(`<text x="${xx+ww+2}" y="${n(top+8)}" font-size="8" fill="#333">${esc(itemLabel(r))}</text>`);
      } else if(r.kind==='formation-top') {
        // A band only when a sourced bottom was entered; otherwise a tick.
        if(bot!==null)g.push(`<rect class="formation-band" data-row="${r.row}" x="0" y="${n(top)}" width="${SW}" height="${n(bot-top)}" fill="#a1887f" fill-opacity="0.25">${titleOf(r,`bottom source: ${r.bottomSourceRef??''}`)}</rect>`);
        g.push(`<line class="formation-top" data-row="${r.row}" x1="0" y1="${n(top)}" x2="${SW}" y2="${n(top)}" stroke="#6d4c41" stroke-width="1.5">${titleOf(r,conv)}</line>`);
        g.push(`<text x="2" y="${n(top-2)}" font-size="8" fill="#4e342e">${esc(itemLabel(r))}</text>`);
      }
    }
    // Pressure column: the modelled curve, the limit marker and the test points.
    const c=t.curve;
    if(c.status==='drawn') {
      const pts=c.nodes.map(p=>`${n(px(p.pressurePsia))},${n(y(p.depthFt))}`).join(' ');
      g.push(`<polyline class="curve" data-model="${c.model}" fill="none" stroke="${c.flagged?RED:BLUE}" stroke-width="2"${c.flagged?' stroke-dasharray="6 4"':''} points="${pts}"><title>${esc(`${CURVE_LABEL}${c.flagged?`; ${c.reasons.join(' ')}`:''}`)}</title></polyline>`);
      const lx=px(c.limitMarker.pressurePsia),ly=y(c.limitMarker.depthFt);
      g.push(`<polygon class="limit" points="${n(lx)},${n(ly-6)} ${n(lx+6)},${n(ly)} ${n(lx)},${n(ly+6)} ${n(lx-6)},${n(ly)}" fill="#fff" stroke="#111"><title>${esc(LIMIT_LABEL)}</title></polygon>`);
      for(const x of c.notes)if(!notes.includes(x))notes.push(x);
    } else {
      // A curve that cannot be drawn says why, in its own track (the reason is part of the drawing, not only of the JSON).
      wrap(`no modelled curve: ${c.reason}`,30).forEach((s,k)=>g.push(`<text class="curve-gap" x="${SW+PGAP+6}" y="${TOP+18+k*11}" font-size="9" fill="${GRAY}">${esc(s)}</text>`));
    }
    for(const {row:r,placement:p} of ordered) {
      if(p.status!=='placed'||r.kind!=='test-point'||p.pressurePsia===undefined)continue;
      const cx=px(p.pressurePsia),cy=y(p.topFt);
      g.push(`<circle class="test-point" data-row="${r.row}" cx="${n(cx)}" cy="${n(cy)}" r="4" fill="#2e7d32" stroke="#1b5e20">${titleOf(r,`${n(p.pressurePsia)} psia${p.conversion?`; converted from ${p.conversion.from} with a survey`:''}`)}</circle>`);
      g.push(`<text x="${n(cx+6)}" y="${n(cy+3)}" font-size="8" fill="#1b5e20">${esc(itemLabel(r))}</text>`);
    }
    // Optional reference lines across the track.
    if(sel.referenceDepthFt!==null&&sel.referenceDepthFt>=0&&sel.referenceDepthFt<=axisMax) {
      const ry=y(sel.referenceDepthFt);
      g.push(`<line class="ref-depth" x1="0" y1="${n(ry)}" x2="${TRACK_W}" y2="${n(ry)}" stroke="#7b1fa2" stroke-dasharray="2 3"/>`);
    }
    if(sel.referencePressurePsia!==null&&sel.referencePressurePsia>=0&&sel.referencePressurePsia<=pMax) {
      const rx=px(sel.referencePressurePsia);
      g.push(`<line class="ref-pressure" x1="${n(rx)}" y1="${TOP}" x2="${n(rx)}" y2="${TOP+PLOT_H}" stroke="#7b1fa2" stroke-dasharray="2 3"/>`);
    }
    if(t.surveyNote)notes.push(`${t.wellId}: ${t.surveyNote}`);
    g.push('</g>');
    body.push(...g);
  });
  // Legend and notes.
  const maxChars=Math.floor((width-LEFT-RIGHT)/5.4);
  const ly0=TOP+PLOT_H+34;
  const lg:string[]=[];let ly=ly0;
  const line=(t:string,x=LEFT,size=10)=>{for(const s of wrap(t,maxChars)){lg.push(`<text x="${x}" y="${ly}" font-size="${size}" fill="#222">${esc(s)}</text>`);ly+=14;}};
  lg.push(`<g class="legend">`);
  lg.push(`<line x1="${LEFT}" y1="${ly-4}" x2="${LEFT+24}" y2="${ly-4}" stroke="${BLUE}" stroke-width="2"/>`);line(`${CURVE_LABEL} (dashed red: the point breaks a case limit)`,LEFT+30);
  lg.push(`<circle cx="${LEFT+12}" cy="${ly-4}" r="4" fill="#2e7d32" stroke="#1b5e20"/>`);line(TEST_LABEL,LEFT+30);
  lg.push(`<polygon points="${LEFT+12},${ly-10} ${LEFT+18},${ly-4} ${LEFT+12},${ly+2} ${LEFT+6},${ly-4}" fill="#fff" stroke="#111"/>`);line(LIMIT_LABEL,LEFT+30);
  line(ctx.testDateNote);
  for(const x of notes)line(x);
  if(sel.referenceDepthFt!==null&&!(sel.referenceDepthFt>=0&&sel.referenceDepthFt<=axisMax))line(`reference depth ${n(sel.referenceDepthFt)} ft is outside the drawn depth axis`);
  if(sel.referencePressurePsia!==null&&!(sel.referencePressurePsia>=0&&sel.referencePressurePsia<=pMax))line(`reference pressure ${n(sel.referencePressurePsia)} psia is outside the drawn pressure axis`);
  line(ctx.reviewAid);
  lg.push('</g>');
  const height=ly+10;
  const head=`${esc(`Depth view (review aid) · ${sel.month} · ${sel.scenario} scenario · ${sel.basis} basis`)}`;
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Arial, Helvetica, sans-serif" role="img">`,
    `<title>Depth view (review aid)</title>`,
    `<desc>${esc(ctx.reviewAid)}</desc>`,
    ...(metadataJson===null?[]:[`<metadata>${escapeMetadata(metadataJson)}</metadata>`]),
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>`,
    `<text x="${LEFT}" y="18" font-size="13" font-weight="bold" fill="#111">${head}</text>`,
    ...body,...lg,'</svg>'].join('\n')+'\n';
}
