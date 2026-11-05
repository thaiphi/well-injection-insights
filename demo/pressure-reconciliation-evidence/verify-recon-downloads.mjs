// Usage: node verify-recon-downloads.mjs <tag>  (from the repo root) — verifies the sealed reconciliation JSON and a tampered copy.
import {readdirSync,readFileSync} from 'node:fs';
import {verifyReconciliationSealed} from '../../swd-injection-analytics/dist/pressureReconciliationExport.js';
const dir=new URL(`./downloads/${process.argv[2]}/`,import.meta.url);
for(const f of readdirSync(dir).filter(n=>n.endsWith('.json'))){const s=JSON.parse(readFileSync(new URL(f,dir),'utf8'));const t=structuredClone(s);t.rows[0].regulatory.marginPsi=(t.rows[0].regulatory.marginPsi??0)+1;
 console.log(f,{verified:await verifyReconciliationSealed(s),tampered:await verifyReconciliationSealed(t),schema:s.schemaVersion,method:s.method,months:s.counts.months,testMonths:s.counts.testMonths});}
