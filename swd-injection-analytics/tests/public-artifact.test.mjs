import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {verifyArtifact,sha256,parseCsv,normalizedCsvCell} from '../scripts/artifact-files.mjs';import {validatePublicArtifact} from '../dist/publicArtifact.js';
test('Pinned real Explorer export matches all source checksums, CSV values and explicit UIC parent identity',async()=>{
  const {artifact,pin}=await verifyArtifact('data/explorer'),stored=JSON.parse(await readFile('data/explorer-pin.json','utf8'));
  assert.deepEqual(pin,stored);assert.equal(artifact.inventory.length,5);assert.equal(artifact.injectionMonthly.length,28);
  const jan=artifact.injectionMonthly.find(r=>r.period_start==='2024-01-01'),feb=artifact.injectionMonthly.find(r=>r.period_start==='2024-02-01');
  assert.equal(jan.uic_number,'000020838');assert.equal(jan.injected_liquid_bbl,17173);assert.equal(jan.reported_avg_injection_pressure_psi,900);assert.equal(jan.reported_max_injection_pressure_psi,900);
  assert.equal(feb.injected_liquid_bbl,17927);assert.equal(feb.calendar_days,29);assert.equal(feb.calculated_calendar_day_avg_bpd,17927/29);
  assert.equal(artifact.inventory.find(r=>r.source_record_key===jan.parent_key).api_no,'38910201');
});
test('Consumer rejects broken identity, duplicate rows, incorrect unit-period arithmetic and missing history',async()=>{
  const original=JSON.parse(await readFile('data/explorer/normalized.json','utf8'));
  for(const change of [a=>a.injectionMonthly[0].parent_key='invented',a=>a.injectionMonthly.push(a.injectionMonthly[0]),a=>a.injectionMonthly[1].calendar_days=28,a=>a.injectionMonthly[0].calculated_calendar_day_avg_bpd=999,a=>a.injectionMonthly=[],a=>a.qualityReport.monthly.quarantined=1,a=>a.manifest.real_history_status='incomplete',a=>a.qualityReport.dispositions[0].disposition='quarantined',a=>{a.injectionMonthly[1].reporting_month=1;}]){
    const a=structuredClone(original);change(a);await assert.rejects(validatePublicArtifact(a));
  }
});
test('CSV parser retains quoted lease names and string leading zeros',()=>{
  assert.deepEqual(parseCsv('uic,lease\r\n000020838,"TREES, ET AL"\r\n'),[{uic:'000020838',lease:'TREES, ET AL'}]);
  assert.throws(()=>parseCsv('a,b\n1\n'));assert.throws(()=>parseCsv('a\n"broken'));
  assert.equal(sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(normalizedCsvCell(['missing:vol_liq','missing:vol_gas']),'missing:vol_liq|missing:vol_gas');
  assert.equal(normalizedCsvCell(null),'');assert.equal(normalizedCsvCell(0),'0');
});
