import {readFileSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const mod=await import(pathToFileURL(resolve('../../swd-injection-analytics/dist/h10DiagnosticsExport.js')).href);
for(const tag of ['desktop','mobile'])for(const f of readdirSync('downloads/'+tag).filter(f=>/^h10-diagnostics.*\.json$/.test(f))){
 const o=JSON.parse(readFileSync(`downloads/${tag}/${f}`,'utf8'));
 const ok=await mod.verifySealed(o);
 const ex=(o.months||[]).filter(m=>m.include===false).map(m=>m.month+': '+m.reason);
 console.log(tag,f,'verifySealed=',JSON.stringify(ok),'keys=',Object.keys(o).slice(0,8).join(','),'excluded=',ex.join(' | ')||'none');
}
