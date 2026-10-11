import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {brineAtPressure,buildBrineSweep,brineSweepCsv} from '../dist/brinePvt.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const input={caseName:'Physical screening',minPressurePsia:100,maxPressurePsia:10000,temperatureF:180,salinityWtPercent:5,points:5};

test('live brine conserves reference mass and compresses across bounded temperature/salinity corners',()=>{
 for(const temperature of [60,100,180,250])for(const salinity of [0,5,20]){
  const rows=[100,1000,3000,6000,10000].map(p=>brineAtPressure(p,temperature,salinity));
  const standardMass=rows[0].densityKgPerM3*rows[0].bwRbPerStb;
  for(const [i,row]of rows.entries()){
   assert.ok(Math.abs(row.densityKgPerM3*row.bwRbPerStb/standardMass-1)<1e-12,`mass at ${temperature} F / ${salinity} wt% / ${row.pressurePsia} psia`);
   assert.ok(row.compressibilityPerPsi>0);
   if(i){assert.ok(row.bwRbPerStb<rows[i-1].bwRbPerStb);assert.ok(row.densityKgPerM3>rows[i-1].densityKgPerM3);}
  }
 }
});

test('results and exports distinguish source agreement, physical screening and historical-only evidence',()=>{
 const result=buildBrineSweep(input),status=result.provenance.validation;
 assert.match(status.sourceAgreement,/45.*source.*cases/i);
 assert.match(status.physicalAcceptance,/bounded.*screening.*full.*open/i);
 assert.match(status.legacyNexusWaterFvf,/historical.*excluded.*live/i);
 const csv=brineSweepCsv(result),json=JSON.stringify(result);
 for(const value of Object.values(status)){assert.ok(csv.includes(value));assert.ok(json.includes(value));}
});

async function sourceFiles(directory){
 const files=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=resolve(directory,entry.name);
  if(relative(root,path).replaceAll('\\','/').startsWith('src/vendor/nexus'))continue;
  if(entry.isDirectory())files.push(...await sourceFiles(path));
  else if(/\.(?:ts|mjs|js)$/.test(entry.name))files.push(path);
 }
 return files;
}
function moduleReferences(source,path){
 const refs=[];
 const tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,path.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
 function visit(node){
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteralLike(node.moduleSpecifier))refs.push(node.moduleSpecifier.text);
  if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')&&node.arguments[0]&&ts.isStringLiteralLike(node.arguments[0]))refs.push(node.arguments[0].text);
  ts.forEachChild(node,visit);
 }
 visit(tree);return refs;
}
function historicalImport(specifier,path){
 const normalized=specifier.replaceAll('\\','/');
 const target=normalized.startsWith('/')?resolve(root,'.'+normalized):resolve(dirname(path),normalized);
 return /^(?:src|dist)\/vendor\/nexus(?:\/|$)/i.test(relative(root,target).replaceAll('\\','/'));
}
test('production modules cannot import historical Nexus engineering directly or transitively',async()=>{
 const violations=[];
 for(const path of [...await sourceFiles(resolve(root,'src')),...await sourceFiles(resolve(root,'web'))]){
  for(const specifier of moduleReferences(await readFile(path,'utf8'),path))if(historicalImport(specifier,path))violations.push(`${relative(root,path)} -> ${specifier}`);
 }
 assert.deepEqual(violations,[],'Historical evidence must not become an executable production dependency');
 // Guard controls exercise static, re-export and dynamic paths without changing source evidence.
 const probe=resolve(root,'src/probe.ts');
 for(const text of ["import {x} from './vendor/nexus/x.js';","export {x} from './vendor/nexus/x.js';","import('./vendor/nexus/x.js');"]){
  assert.ok(moduleReferences(text,probe).some(ref=>historicalImport(ref,probe)));
 }
 assert.ok(historicalImport('/dist/vendor/nexus/x.js',resolve(root,'web/probe.mjs')));
 assert.equal(historicalImport('./brinePvt.js',probe),false);
});
