import {cp,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {verifyArtifact} from './artifact-files.mjs';
const source=resolve(process.argv[2]??'../texas-rrc-explorer/artifacts/rrc-2026-10-09-uic000020838-v1');
const {pin}=await verifyArtifact(source);
await mkdir('data/explorer',{recursive:true});
await cp(source,'data/explorer',{recursive:true});
await writeFile('data/explorer-pin.json',JSON.stringify(pin,null,2)+'\n');
await verifyArtifact('data/explorer');
console.log(`Pinned ${pin.artifactId}: ${pin.filesVerified} source/export checksums and normalized CSV parity verified`);
