// Usage: node verify-j-downloads.mjs <tag>  -- verifies the downloaded J estimate JSON with verifyEstimateSealed (read-only).
import {readFileSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const N='C:/Users/thai.phi/Downloads/python/portfolio/swd-injection-analytics/tmp/lovable-transfer/well-injection-insights/swd-injection-analytics';
const {verifyEstimateSealed}=await import(pathToFileURL(N+'/dist/injectivityEstimateExport.js').href);
const tag=process.argv[2]||'desktop',dir=join(here,'downloads',tag);
const f=readdirSync(dir).find(n=>n.startsWith('c5__')&&n.endsWith('.json'));
const j=JSON.parse(readFileSync(join(dir,f),'utf8'));
const tampered=structuredClone(j);tampered.tests[0].j=999;
const csv=readFileSync(join(dir,readdirSync(dir).find(n=>n.startsWith('c5__')&&n.endsWith('.csv'))),'utf8'),svg=readFileSync(join(dir,readdirSync(dir).find(n=>n.startsWith('c5__')&&n.endsWith('.svg'))),'utf8');
console.log(JSON.stringify({tag,file:f,schema:j.schema??j.schemaVersion,method:j.method,verifies:await verifyEstimateSealed(j),tamperedVerifies:await verifyEstimateSealed(tampered),calibratedInJson:/calibrated/i.test(JSON.stringify(j)),calibratedCsv:/calibrated/i.test(csv),calibratedSvg:/calibrated/i.test(svg),topKeys:Object.keys(j)}));
