/** Reproducible samples from existing sources. Run from owning root with Node >=24. */
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {syntheticActuals,FIXTURE_ID} from '../../../dist/planning.js';
import {INJECTORS} from '../../../dist/engineering.js';
const dir=new URL('./',import.meta.url);
const rows=syntheticActuals();
const header=['Producer','Group','Month','Water'];
const cells=rows.map(r=>[r.producerId,'FICTIONAL-GROUP',r.month,r.rateStbd]);
writeFileSync(new URL('seed417-history.csv',dir),header.join(',')+'\n'+cells.map(r=>r.join(',')).join('\n')+'\n');
writeFileSync(new URL('parsed-sheet-contract.json',dir),JSON.stringify({format:'parsed-sheet-contract-only; NOT an XLSX binary',source:FIXTURE_ID,sheets:[{name:'Notes',rows:[['Synthetic demonstration; no calibration']]},{name:'History',rows:[header,...cells]},{name:'Invalid formula',rows:[header,['FICTIONAL-P','FICTIONAL-GROUP','2025-01',{formula:'1+1'}]]}]},null,2)+'\n');
writeFileSync(new URL('assumed-injectors.csv',dir),'id,j,pres,limit,rb,lb,rd,ld,ceiling,availability\n'+INJECTORS.map(i=>`${i.id},${i.injectivityStbdPerPsi},${i.reservoirPsia},${i.limitPsia},bottomhole-absolute,bottomhole-absolute,${i.datum},${i.datum},${i.operatingCeilingStbd},${i.availability}`).join('\n')+'\n');
const publicBytes=readFileSync(new URL('../../../data/explorer/injection_monthly.csv',import.meta.url));
writeFileSync(new URL('public-reported-observations.csv',dir),publicBytes);
writeFileSync(new URL('provenance.json',dir),JSON.stringify({schemaVersion:1,synthetic:{reference:FIXTURE_ID,seed:417,source:'src/planning.ts/syntheticActuals',kind:'synthetic'},injectors:{source:'src/engineering.ts/INJECTORS',kind:'assumed'},public:{source:'data/explorer/injection_monthly.csv',kind:'public-reported',sha256:createHash('sha256').update(publicBytes).digest('hex'),note:'Observation-only sample; never assign these UICs a fictional scenario or convert reported surface pressure to BHP. A user reimport retains user acquisition and unverified assertion.'}},null,2)+'\n');
