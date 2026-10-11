import test from 'node:test';
import assert from 'node:assert/strict';
import {explorerWholeVersionScope,validExplorerScope} from '../web/explorer-scope.mjs';
import {explorerCalculationGate,explorerRowDisposition} from '../web/explorer-eligibility.mjs';
const row=(uic,date='2025-01-01')=>({uic_number:uic,period_start:date});
test('whole-version evidence retains unmatched identities without silently filtering scope',()=>{
 const scope=explorerWholeVersionScope({inventory:[row('000000001')],injectionMonthly:[row('000000002','2025-02-01'),row('000000002')]});
 assert.deepEqual(scope,{kind:'whole-version',inventoryUics:['000000001'],historyUics:['000000002'],periodStart:'2025-01-01',periodEnd:'2025-02-01'});assert.equal(validExplorerScope(scope),true);
});
test('empty acquired history uses paired null coverage; fabricated or half-empty coverage rejects',()=>{
 const scope=explorerWholeVersionScope({inventory:[row('000000001')],injectionMonthly:[]});
 assert.deepEqual(scope.historyUics,[]);assert.equal(scope.periodStart,null);assert.equal(scope.periodEnd,null);assert.equal(validExplorerScope(scope),true);
 for(const changed of [{periodStart:'2025-01-01'},{periodEnd:'2025-01-01'},{historyUics:['000000001']}])assert.equal(validExplorerScope({...scope,...changed}),false);
});
test('sender-ineligible identifiers and dates remain rejected rather than rewritten',()=>{
 for(const bad of [null,{},row('bad'),Object.assign([],row('000000001'))])assert.throws(()=>explorerWholeVersionScope({inventory:[bad],injectionMonthly:[]}));
 assert.throws(()=>explorerWholeVersionScope({inventory:new Array(1),injectionMonthly:[]}));
 for(const date of ['0000-01-01','2025-13-01','2025-01-02',null])assert.throws(()=>explorerWholeVersionScope({inventory:[],injectionMonthly:[row('000000001',date)]}));
});
test('imported evidence fails closed independently of artifact presence and pin fallback',()=>{
 const artifact={artifactId:'evidence-only'};
 for(const calculationEligibility of [undefined,{ready:false,reasons:['duplicate monthly source rows']},{ready:true,reasons:['contradiction']}])assert.equal(explorerCalculationGate({artifact,calculationEligibility},{imported:true}).ready,false);
 assert.equal(explorerCalculationGate({artifact,calculationEligibility:{ready:true,reasons:[]}},{imported:true}).ready,true);
 assert.equal(explorerCalculationGate({artifact},{imported:false}).ready,true);
 assert.equal(explorerCalculationGate(null).ready,false);
});
test('raw-row labels expose canonical quarantine reasons and keep missing disposition explicit',()=>{
 const artifact={qualityReport:{dispositions:[{source_row_key:'row1',disposition:'quarantined',reasons:['invalid:volume']}]}};
 assert.equal(explorerRowDisposition(artifact,{source_row_key:'row1'}),'quarantined: invalid:volume');
 assert.equal(explorerRowDisposition(artifact,{source_row_key:'other'}),'See quality report');
});
