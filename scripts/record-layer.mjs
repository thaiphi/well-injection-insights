// Record a data-driven preservation layer from migration/layer-specs/<name>.json.
//   node scripts/record-layer.mjs <name> archive            copy each listed change's current bytes to its before-archive; run BEFORE editing
//   node scripts/record-layer.mjs <name>                    write the pending-review record and list it in the index
//   node scripts/record-layer.mjs <name> accept "<owner>"   the same record, marked accepted (owner only)
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {dirname} from 'node:path';import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),r=p=>readFileSync(p);
const docSha=b=>sha(Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'),'utf8'));
const put=(p,b)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b);};
const [name,mode,by]=process.argv.slice(2);
if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name??''))throw Error('Usage: node scripts/record-layer.mjs <name> [archive | accept "<owner>"]');
if(mode&&mode!=='archive'&&mode!=='accept')throw Error('Unknown mode: '+mode);
if(mode==='accept'&&!by)throw Error('accept needs the accepting owner name');
const spec=JSON.parse(r('migration/layer-specs/'+name+'.json')),APP='swd-injection-analytics/',ARCH='migration/baselines/'+name+'-before/'+APP,INDEX='migration/layers/index.json';
if(mode==='archive'){for(const p of spec.changes){if(existsSync(ARCH+p))throw Error('Archive exists; refusing to overwrite: '+ARCH+p);put(ARCH+p,r(APP+p));}console.log('archived '+spec.changes.length);process.exit(0);}
const RECORD='migration/layers/'+name+'.json',reviewed=existsSync(RECORD)?JSON.parse(r(RECORD)):null;
// Accept only flips the status of the reviewed pending record; it never pins bytes that changed after review.
if(mode==='accept'&&reviewed?.status!=='pending-review')throw Error('accept needs a reviewed pending record: no reviewed pending record for '+name);
const index=existsSync(INDEX)?JSON.parse(r(INDEX)):{version:'swd-preservation-layer-index/1',layers:[]};
const at=index.layers.findIndex(x=>x.name===name);
if(at===-1)index.layers.push({name,baseline:'migration/layers/'+name+'.json'});else if(at!==index.layers.length-1)throw Error('Only the latest layer can be re-recorded: '+name);
put(INDEX,JSON.stringify(index,null,2)+'\n');
const prev=index.layers.length>1?index.layers.at(-2).baseline:'migration/sample-minors-baseline.json',accept=mode==='accept';
const layer={version:'swd-preservation-layer/1',name,status:accept?'accepted':'pending-review',
 ...(accept?{acceptedAt:new Date().toISOString().slice(0,10),acceptedBy:by,acceptanceEvidence:spec.acceptanceEvidence}:{}),
 purpose:spec.purpose,parentBaselineSha256:sha(r(prev)),
 approvedDocs:spec.approvedDocs.map(p=>({path:p,sha256:docSha(r(p))})),
 changes:spec.changes.map(p=>{const b=r(ARCH+p),a=r(APP+p);return {path:p,archive:ARCH+p,beforeSha256:sha(b),beforeBytes:b.length,afterSha256:sha(a),afterBytes:a.length};}),
 newFiles:spec.newFiles.map(p=>{const b=r(APP+p);return {path:p,sha256:sha(b),bytes:b.length};}),
 rootFiles:spec.rootFiles.map(p=>{const b=r(p);return {path:p,sha256:sha(b),bytes:b.length};})};
const pinned=({status,acceptedAt,acceptedBy,acceptanceEvidence,...rest})=>JSON.stringify(rest);
if(accept&&pinned(layer)!==pinned(reviewed))throw Error('Live bytes differ from the reviewed pending record; re-record pending and review again');
put(RECORD,JSON.stringify(layer,null,2)+'\n');console.log(layer.status);
