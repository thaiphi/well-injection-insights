import {PDFDocument, StandardFonts, rgb} from './vendor/pdf-lib-1.17.1.mjs';
import {verifiedExhibit} from '../dist/exhibitIntegrity.js';

const INK=rgb(0.09,0.24,0.33), STEEL=rgb(0.20,0.47,0.61), SAND=rgb(0.66,0.55,0.30), RUST=rgb(0.61,0.26,0.18), RULE=rgb(0.82,0.87,0.90), PALE=rgb(0.92,0.95,0.97);
const FIXED_DATE=new Date('2000-01-01T00:00:00.000Z');
const fmt=(value, digits=0)=>value===null||value===undefined?'Not reported':new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(value);

/** Browser/Node vector export. Only presentation, aggregation and axis placement occur here. */
export async function exhibitPdf(input) {
  // Snapshot before the first await so a caller cannot swap case values during export.
  const e=verifiedExhibit(input);
  const {contentSha256,...body}=e;
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body))));
  const actualHash=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(contentSha256!==actualHash) throw new Error('Technical exhibit SHA-256 mismatch');
  if(![1,2].includes(e.schemaVersion)||!Array.isArray(e.outputs?.monthly)||!e.outputs.monthly.length||!Array.isArray(e.outputs?.injectors)||!Array.isArray(e.inputs?.injectors)) throw new Error('Unsupported technical exhibit schema');
  const original=JSON.stringify(e,null,2)+'\n';
  const pdf=await PDFDocument.create();
  pdf.setTitle('SWD water planning technical exhibit');pdf.setAuthor('SWD Analytics');
  pdf.setSubject(`Technical exhibit SHA-256 ${contentSha256}`);
  pdf.setCreator('SWD Analytics browser PDF export');pdf.setProducer('SWD Analytics / pdf-lib 1.17.1');
  pdf.setCreationDate(FIXED_DATE);pdf.setModificationDate(FIXED_DATE);
  const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  // Standard PDF fonts cannot encode all Unicode. The original stays lossless in the attachment.
  let displaySubstituted=false;
  const safe=value=>Array.from(String(value??'')).map(c=>{
    if(c==='\n'||c==='\r'||c==='\t') return ' ';
    if(c==='−'||c==='–'||c==='—'||c==='‑') {displaySubstituted=true;return '-';}
    try {regular.encodeText(c);return c;} catch {displaySubstituted=true;return '?';}
  }).join('');
  const wrap=(value,width,size=9,font=regular)=>{
    const result=[];let line='';
    for(const char of safe(value)) {
      if(font.widthOfTextAtSize(line+char,size)>width&&line) {
        const space=line.lastIndexOf(' ');
        if(char===' ') {result.push(line.trimEnd());line='';}
        else if(space>0) {result.push(line.slice(0,space));line=line.slice(space+1)+char;}
        else {result.push(line);line=char;}
      }
      else line+=char;
    }
    result.push(line.trimEnd());return result;
  };
  let page,y,section;
  const draw=(value,x,at,size=9,font=regular,color=INK)=>page.drawText(safe(value),{x,y:at,size,font,color});
  const newPage=(title,subtitle='')=>{
    section=title;page=pdf.addPage([792,612]);y=574;
    draw(title,36,y,21,bold);y-=25;
    if(subtitle) for(const line of wrap(subtitle,720,9)) {draw(line,36,y);y-=12;}
    y-=8;
  };
  const ensure=height=>{if(y-height<48)newPage(`${section.replace(/ - continued$/,'')} - continued`);};
  const paragraph=(value,{size=8.5,font=regular,gap=5}={})=>{
    for(const line of wrap(value,720,size,font)) {ensure(size+3);draw(line,36,y,size,font);y-=size+3;}
    y-=gap;
  };
  const subheading=value=>{ensure(30);paragraph(value,{size:11,font:bold,gap:5});};
  const table=(headers,rows,widths,{size=8,line=11,padding=4}={})=>{
    const cells=row=>row.map((v,i)=>wrap(v,widths[i]-padding*2,size));
    const heights=c=>Math.max(...c.map(v=>v.length))*line+padding*2;
    const paint=(c,height,isHeader=false)=>{
      page.drawRectangle({x:36,y:y-height+3,width:720,height,color:isHeader?PALE:rgb(1,1,1)});
      let x=36;
      c.forEach((lines,i)=>{lines.forEach((v,n)=>draw(v,x+padding,y-padding-n*line,size,isHeader?bold:regular));x+=widths[i];});
      page.drawLine({start:{x:36,y:y-height+3},end:{x:756,y:y-height+3},thickness:0.4,color:RULE});
      y-=height;
    };
    const header=cells(headers),headerHeight=heights(header);
    ensure(headerHeight+30);paint(header,headerHeight,true);
    for(const row of rows) {
      const c=cells(row);let offset=0;
      // A very long cell can span readable continuation pages, retaining all text.
      while(offset<Math.max(...c.map(v=>v.length))) {
        if(y-line-padding*2<48) {newPage(`${section.replace(/ - continued$/,'')} - continued`);paint(header,headerHeight,true);}
        const count=Math.max(1,Math.floor((y-48-padding*2)/line));
        const chunk=c.map(v=>v.slice(offset,offset+count));
        const height=heights(chunk);
        paint(chunk,height);offset+=count;
      }
    }
    y-=9;
  };
  const chart=(x,top,width,height,title,unit,xlabels,series,xMax)=>{
    const left=49,right=11,bottom=48,plotTop=top-36,plotBottom=top-height+bottom;
    const peak=Math.max(1,...series.flatMap(s=>s.points.map(p=>p.y))),padded=peak*1.10,max=Number.isFinite(padded)?padded:peak;
    const px=v=>x+left+(xMax?v/xMax:0.5)*(width-left-right),py=v=>plotBottom+v/max*(plotTop-plotBottom);
    draw(title,x,top-11,10,bold);draw(unit,x+left,top-25,7);
    for(let n=0;n<=4;n++) {
      const value=max*(n/4),at=py(value),label=fmt(value);
      page.drawLine({start:{x:x+left,y:at},end:{x:x+width-right,y:at},thickness:0.5,color:RULE});
      draw(label,x+left-6-regular.widthOfTextAtSize(label,7),at-2,7);
    }
    xlabels.forEach((label,i)=>{const at=px(xlabels.length>1?(i/(xlabels.length-1))*xMax:0),s=safe(label);draw(s,at-regular.widthOfTextAtSize(s,7)/2,plotBottom-12,7);});
    series.forEach(s=>{
      for(let i=1;i<s.points.length;i++)page.drawLine({start:{x:px(s.points[i-1].x),y:py(s.points[i-1].y)},end:{x:px(s.points[i].x),y:py(s.points[i].y)},color:s.color,thickness:1.6,...(s.dashed?{dashArray:[4,3]}:{})});
    });
    // Compact fixed legends keep long user/source identifiers in the wrapping tables.
    let lx=x+left,ly=top-height+13;
    series.forEach(s=>{
      const length=regular.widthOfTextAtSize(safe(s.label),7)+31;
      if(lx+length>x+width){lx=x+left;ly-=10;}
      page.drawLine({start:{x:lx,y:ly+3},end:{x:lx+14,y:ly+3},color:s.color,thickness:1.8,...(s.dashed?{dashArray:[4,3]}:{})});
      draw(s.label,lx+19,ly,7);lx+=length;
    });
  };
  const rows=e.outputs.monthly,inputs=e.inputs.injectors,controls=e.inputs.controls,fixtureBacked=e.schemaVersion===2;
  const annualShortfall=rows.reduce((sum,row)=>sum+row.shortfallBbl,0);
  if(!Number.isFinite(annualShortfall))throw Error('Annual unmet planned volume cannot be represented as a finite number');
  const labels=rows.length<=12?rows.map(r=>r.month.slice(5)):rows.filter((_,i)=>i===0||i===rows.length-1).map(r=>r.month);
  const points=key=>rows.map((r,i)=>({x:i,y:r[key]}));
  newPage('SWD water planning exhibit',`${fixtureBacked?'Synthetic production':'Declared actuals; raw history unverified'} and fictional assumed injectors; public evidence remains separate.`);
  paragraph(`Frozen cutoff ${e.inputs.cutoff}. Producer starts ${controls.newWellStart}; available expansion ${fmt(controls.expansionStbd)} STB/d from ${controls.expansionMonth}.`,{size:10,font:bold});
  paragraph(`Capacity shortfall: ${rows.filter(r=>r.shortfallBbl>0).length} of ${rows.length} months. Annual unmet planned volume: ${fmt(annualShortfall)} bbl. Peak planned demand: ${fmt(Math.max(...rows.map(r=>r.demandStbd)))} STB/d.`,{size:10,font:bold});
  ensure(220);chart(36,y,720,210,'Available capacity against planned demand','Monthly stock-tank volume (bbl); x: month, 2026',labels,[{label:'Available capacity',color:STEEL,points:points('capacityBbl')},{label:'Forecast + assumed producer',color:SAND,points:points('demandBbl')}],rows.length-1);y-=222;
  table(['Assumed injector','Reservoir / limit psia','J STB/d/psi','Availability','Available STB/d'],inputs.map(i=>[i.id,`${fmt(i.reservoirPsia)} / ${fmt(i.limitPsia)}`,fmt(i.injectivityStbdPerPsi,2),`${fmt(i.availability*100,1)}%`,fmt(e.outputs.injectors.find(o=>o.id===i.id)?.availableStbd)]),[160,170,130,110,150]);
  paragraph('All engineering pressures are bottomhole psia at a common formation reference depth. Constant injectivity and pressure limits are assumed; no actual-well calibration or sustainable-capacity claim is made.');

  newPage('Reconciliation and injector response',`${fixtureBacked?'Synthetic':'Declared'} actual minus frozen forecast, original producers only; planned demand includes the assumed new producer.`);
  ensure(190);
  chart(36,y,350,180,'Frozen forecast / actual','Monthly water (bbl); x: month, 2026',labels,[{label:'Frozen forecast',color:STEEL,dashed:true,points:points('forecastBbl')},{label:fixtureBacked?'Synthetic actual':'Declared actual',color:INK,points:points('actualBbl')}],rows.length-1);
  const rateMax=Math.max(1,...e.outputs.injectors.flatMap(i=>i.curve.map(p=>p.rateStbd)));
  const curves=e.outputs.injectors.map((i,n)=>({label:`Injector ${n+1}`,color:n%2===0?STEEL:SAND,points:i.curve.map(p=>({x:p.rateStbd,y:p.bottomholePsia}))}));
  [...new Set(inputs.map(i=>i.limitPsia))].forEach(limit=>curves.push({label:`Limit ${fmt(limit)} psia`,color:RUST,dashed:true,points:[{x:0,y:limit},{x:rateMax,y:limit}]}));
  chart(406,y,350,180,'Pressure required to inject','Bottomhole psia; x: injection rate STB/d',[0,rateMax/4,rateMax/2,rateMax*0.75,rateMax].map(v=>fmt(v)),curves,rateMax);y-=195;
  table(['Month','Days','Forecast bbl','Actual bbl','Variance %','Demand bbl','Capacity bbl','Headroom bbl'],rows.map(r=>[r.month,r.days,fmt(r.forecastBbl),fmt(r.actualBbl),r.variancePct===null?'Undefined':fmt(r.variancePct,1)+'%',fmt(r.demandBbl),fmt(r.capacityBbl),fmt(r.headroomBbl)]),[72,35,103,103,78,110,110,109],{size:7.5,line:10,padding:3});
  paragraph('Pressure = reservoir pressure + rate / J. Dashed lines: assumed pressure limits; curve points above them are excluded rates. Injector numbers follow the first-page table. Calendar volumes use actual month lengths. Exact unrounded values are attached.',{size:7.5});

  newPage('Public reported injection history','Public liquid injection is separate from producer planning and fictional injector calculations.');
  const history=e.publicHistory;
  if(!history)paragraph('Public history not loaded. No public observations are represented by this exhibit.');
  else {
    const publicRows=[...history.injectionMonthly].sort((a,b)=>a.period_start.localeCompare(b.period_start)||a.source_row_key.localeCompare(b.source_row_key));
    const used=new Set(publicRows.map(r=>r.parent_key));
    history.inventory.filter(p=>used.has(p.source_record_key)).forEach(p=>paragraph(`UIC ${p.uic_number} / API ${p.api_no} / well ${p.well_no_display??'Not reported'}; parent ${p.source_record_key}`,{size:9,font:bold,gap:3}));
    paragraph(`Artifact: ${history.artifactId}. ${publicRows.length} acquired source reports. Average and maximum pressure are separate reported psi fields; pressure basis is unspecified.`,{size:7.5,gap:4});
    table(['Month','Liquid bbl','Avg pressure psi','Max pressure psi','Calculated bbl/day','Source report ID'],publicRows.map(r=>[r.period_start.slice(0,7),fmt(r.injected_liquid_bbl),fmt(r.reported_avg_injection_pressure_psi),fmt(r.reported_max_injection_pressure_psi),fmt(r.calculated_calendar_day_avg_bpd,2),r.source_report_id??'Not reported']),[75,100,115,115,125,190],{size:7,line:8,padding:2});
    paragraph('Not reported means missing, never zero. Calendar-day average = reported monthly liquid / calendar days. Monthly pressures do not establish bottomhole pressure or injectivity. Other inventory candidates have no acquired history here; no zero injection is inferred.',{size:7.5});
  }

  newPage('Method, assumptions and source lineage','The attached swd-technical-exhibit.json preserves the exact unrounded case, Unicode, public rows and full source metadata.');
  paragraph(`Technical exhibit SHA-256: ${contentSha256}`,{size:7.5});
  paragraph(e.inputs.forecastEvidence??'Historical exhibit: raw-history verification status was not recorded',{size:7.5});
  paragraph(`Nexus local main ${e.inputs.nexusSourceCommit}. Fixture ${e.inputs.fixtureId}. Engineering ${e.modelVersions.engineering}; forecast ${e.modelVersions.forecast}.`,{size:7.5});
  Object.entries(e.formulas).forEach(([name,value])=>paragraph(`${name}: ${value}`,{size:7.5,gap:2}));
  subheading('Assumptions and limitations');
  e.assumptions.forEach(value=>paragraph(value,{size:7.5,gap:2}));
  const b=e.outputs.brine;
  paragraph(`Calculated brine reference: ${b.pressurePsia} psia, ${b.temperatureF} F, ${b.salinityPpm} ppm (${b.salinityBasis??'original declared salinity basis; see retained source'}); Bw ${fmt(b.bwRbPerStb,4)} rb/STB; density ${fmt(b.densityLbPerFt3,2)} lb/ft3; viscosity ${fmt(b.viscosityCp,3)} cP; compressibility ${b.compressibilityPerPsi} 1/psi. ${b.source}`,{size:7.5,gap:3});
  if(history) {
    subheading('Official source queries and preserved snapshots');
    for(const source of history.manifest.sources??[]) {
      if(source.kind!=='inventory'&&source.kind!=='monthly')continue;
      paragraph(`${source.kind}: ${source.title??source.name??'Source'}; retrieved ${source.retrieved_at??'Not supplied'}`,{size:7.5,gap:1});
      paragraph(source.url??'Source URL not supplied',{size:7.5,gap:1});
      paragraph(`Snapshot SHA-256: ${source.sha256??'Not supplied'}`,{size:7.5,gap:4});
    }
  }
  if(e.inputs.planningFixture) {
    const fixture=e.inputs.planningFixture;
    newPage('Raw synthetic producer history',`Fixture ${fixture.id}; independent actuals ${fixture.actualsId}; seed ${fixture.generator.seed}. Input SHA256 ${e.inputs.planningFixtureSha256}`);
    table(['Producer','Month','Rate STB/day','Volume STB','Content'],fixture.actuals.map(r=>[r.producerId,r.month,fmt(r.rateStbd,3),fmt(r.volumeBbl,3),r.kind]),[220,90,145,145,120]);
    subheading('Producer and group identities');
    fixture.producers.forEach(p=>paragraph(JSON.stringify(p),{size:7.5}));
    subheading('Assumed development schedules');
    fixture.schedules.forEach(s=>paragraph(JSON.stringify(s),{size:7.5}));
    newPage('Producer and grouped planning contributions','Calculated stock-tank month volumes; independent actuals are not rewritten by schedules.');
    table(['Producer / group','Month','Demand STB','Independent actual STB'],e.outputs.planningDetails.producerMonths.map(r=>[`${r.producerId} / ${r.groupId}`,r.month,fmt(r.volumeBbl,3),fmt(r.actualBbl,3)]),[340,90,145,145]);
    table(['Group','Month','Demand STB'],e.outputs.planningDetails.groups.map(r=>[r.groupId,r.month,fmt(r.volumeBbl,3)]),[340,190,190]);
  }
  pdf.getPages().forEach((p,i)=>{
    p.drawLine({start:{x:36,y:34},end:{x:756,y:34},color:STEEL,thickness:0.7});
    p.drawText(`SWD Analytics | ${contentSha256.slice(0,16)} | Educational demonstration | Page ${i+1} of ${pdf.getPageCount()}`,{x:36,y:23,size:7,font:regular,color:INK});
    if(displaySubstituted)p.drawText('Display: unsupported glyphs become ?; Unicode dashes become hyphens. Attached JSON preserves original Unicode.',{x:36,y:12,size:6.5,font:regular,color:INK});
  });
  await pdf.attach(new TextEncoder().encode(original),'swd-technical-exhibit.json',{mimeType:'application/json',description:'Exact technical exhibit including original Unicode and unrounded outputs',creationDate:FIXED_DATE,modificationDate:FIXED_DATE});
  return pdf.save({useObjectStreams:false,addDefaultPage:false});
}

