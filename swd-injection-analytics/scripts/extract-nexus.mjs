import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, posix } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const source = resolve(process.argv[2] ?? '../..', process.argv[2] ? '' : 'mclaren/esp-nexus');
const branch = execFileSync('git', ['-C', source, 'branch', '--show-current'], {encoding:'utf8'}).trim();
if (branch !== 'main') throw new Error(`Expected owner-selected local main; found ${branch}`);
const head = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const files = [
  'utils/constants.ts', 'utils/pvt/correlations.ts', 'utils/pvt/types.ts', 'utils/pvt/constants.ts',
  'utils/pvt/sourGasCorrections.ts', 'utils/multiphaseFlow/types.ts',
  'components/black-oil-tables/types.ts', 'components/black-oil-tables/engine/generateBlackOilTable.ts',
  'components/black-oil-tables/engine/pressureArray.ts', 'components/black-oil-tables/engine/pbRsbReconciliation.ts',
];
const hash = s => createHash('sha256').update(s).digest('hex');
const manifest = {schemaVersion:1, source:'Owner-authorized ESP Nexus local main extraction', branch, head, extractedAt:new Date().toISOString(), transformations:['Import aliases rewritten to relative ESM .js paths; calculation bodies unchanged','Only ZFactorCalculation and TraverseWarning are extracted from wellbore.ts; no pump/UI/private case dependencies'], files:[]};
function save(path, content) {mkdirSync(dirname(path), {recursive:true}); writeFileSync(path, content);}
for (const path of files) {
  const raw = readFileSync(resolve(source, 'src', path));
  const text = raw.toString().replace(/(['"])(@\/[^'"]+|\.{1,2}\/[^'"]+)\1/g, (match, quote, imported) => {
    let destination = imported;
    if (imported.startsWith('@/')) destination = posix.relative(posix.dirname(path), imported.slice(2));
    if (!destination.startsWith('.')) destination = './' + destination;
    return quote + destination + (destination.endsWith('.js') ? '' : '.js') + quote;
  });
  save(resolve('src/vendor/nexus', path), text);
  manifest.files.push({source:'src/'+path, destination:'src/vendor/nexus/'+path, sourceSha256:hash(raw), destinationSha256:hash(text)});
}
const wellbore = readFileSync(resolve(source,'src/types/wellbore.ts'),'utf8');
const selected = ['ZFactorCalculation','TraverseWarning'].map(name => {
  const start = wellbore.indexOf(`export type ${name} = {`);
  if (start < 0) throw new Error(`Missing source type ${name}`);
  const end = wellbore.indexOf('\n};', start);
  if(end<0) throw new Error(`Cannot delimit source type ${name}`);
  return wellbore.slice(start,end+3);
}).join('\n\n')+'\n';
save('src/vendor/nexus/types/wellbore.ts',selected);
manifest.files.push({source:'src/types/wellbore.ts',destination:'src/vendor/nexus/types/wellbore.ts',sourceSha256:hash(wellbore),destinationSha256:hash(selected),selectedTypes:['ZFactorCalculation','TraverseWarning']});
for (const path of ['utils/pvt/__tests__/correlations.test.ts','components/black-oil-tables/engine/__tests__/pyrtValidation.test.ts','components/black-oil-tables/engine/generateBlackOilTable.test.ts','components/black-oil-tables/engine/pressureArray.test.ts','components/black-oil-tables/engine/pbRsbReconciliation.test.ts']) {
  const raw=readFileSync(resolve(source,'src',path));
  const destination='reference/nexus/'+path;
  save(destination,raw);
  manifest.files.push({source:'src/'+path,destination,sourceSha256:hash(raw),destinationSha256:hash(raw),purpose:'Unmodified upstream reference test; not a claim that Vitest was run'});
}
save('reference/nexus-source-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Extracted ${manifest.files.length} source/reference files from local ${branch}@${head}`);
