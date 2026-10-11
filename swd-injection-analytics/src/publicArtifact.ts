export type PublicInventory = {source_record_key:string;uic_number:string;api_no:string;[key:string]:unknown};
export type PublicMonthly = {
  source_row_key:string;parent_key:string;parent_join_status:string;uic_number:string;
  reporting_year:number;reporting_month:number;period_start:string;injected_liquid_bbl:number|null;
  reported_avg_injection_pressure_psi:number|null;reported_max_injection_pressure_psi:number|null;
  calendar_days:number;calculated_calendar_day_avg_bpd:number|null;[key:string]:unknown;
};
export type PublicArtifact = {
  schemaVersion:1;artifactId:string;inventory:PublicInventory[];injectionMonthly:PublicMonthly[];
  manifest:Record<string,unknown>;qualityReport:Record<string,unknown>;dataDictionary:Record<string,unknown>;
};
/** Structural/identity check, separate from producer acquisition and snapshot hash verification. */
export async function validatePublicArtifact(value:unknown):Promise<PublicArtifact> {
  if(!value || typeof value!=='object') throw new Error('Public artifact is missing');
  const a=value as PublicArtifact;
  if(a.schemaVersion!==1 || typeof a.artifactId!=='string' || !a.artifactId || !Array.isArray(a.inventory) || !Array.isArray(a.injectionMonthly) || !a.manifest || !a.qualityReport || !a.dataDictionary) throw new Error('Unsupported or incomplete Explorer artifact');
  if(a.manifest.artifact_id!==a.artifactId || a.manifest.schema_version!==1 || a.manifest.real_history_status!=='verified_bounded_linkage') throw new Error('Explorer history is not a verified bounded artifact');
  for(const [name,records] of [['inventory',a.inventory],['monthly',a.injectionMonthly]] as const) {
    const report=a.qualityReport[name] as Record<string,unknown>|undefined;
    if(!report || report.accepted!==records.length || report.quarantined!==0 || report.excluded!==0 || report.raw!==records.length || report.parsed!==records.length) throw new Error('Explorer contains incomplete or unresolved source dispositions');
  }
  const join=a.qualityReport.parent_join as Record<string,unknown>|undefined;
  if(!join || join.matched!==a.injectionMonthly.length || join.unmatched!==0 || join.ambiguous!==0) throw new Error('Explorer parent joins are unresolved');
  const dispositions=a.qualityReport.dispositions as {source_row_key:string;disposition:string}[]|undefined;
  if(!Array.isArray(dispositions) || dispositions.length!==a.injectionMonthly.length || new Set(dispositions.map(d=>d.source_row_key)).size!==dispositions.length || dispositions.some(d=>d.disposition!=='accepted')) throw new Error('Explorer monthly row dispositions are incomplete');
  const acceptedKeys=new Set(dispositions.map(d=>d.source_row_key));
  const parents=new Map<string,PublicInventory>();
  for(const row of a.inventory) {
    if(typeof row.source_record_key!=='string' || typeof row.uic_number!=='string' || typeof row.api_no!=='string' || parents.has(row.source_record_key)) throw new Error('Invalid or duplicate public parent identity');
    parents.set(row.source_record_key,row);
  }
  const keys=new Set<string>();
  const periods=new Set<string>();
  const reportIds=new Set<string>();
  for(const row of a.injectionMonthly) {
    if(typeof row.source_row_key!=='string' || keys.has(row.source_row_key) || !acceptedKeys.has(row.source_row_key)) throw new Error('Duplicate/missing/unaccepted monthly source row key');
    keys.add(row.source_row_key);
    const parent=parents.get(row.parent_key);
    if(row.parent_join_status!=='matched' || !parent || parent.uic_number!==row.uic_number) throw new Error('Monthly report has unresolved or inconsistent UIC parent');
    if(!Number.isInteger(row.reporting_year)||!Number.isInteger(row.reporting_month)||row.reporting_month<1||row.reporting_month>12) throw new Error('Invalid public reporting month');
    const period=`${row.uic_number}:${row.reporting_year}:${row.reporting_month}`;
    const reportId=String(row.source_report_id??'');
    if(periods.has(period) || !reportId || reportIds.has(reportId)) throw new Error('Unresolved duplicate public reporting period/revision');
    periods.add(period);reportIds.add(reportId);
    const expectedDays=new Date(Date.UTC(row.reporting_year,row.reporting_month,0)).getUTCDate();
    if(row.calendar_days!==expectedDays) throw new Error('Public calendar-day divisor is inconsistent');
    for(const field of ['injected_liquid_bbl','reported_avg_injection_pressure_psi','reported_max_injection_pressure_psi','calculated_calendar_day_avg_bpd'] as const) {
      if(row[field]!==null && (typeof row[field]!=='number'||!Number.isFinite(row[field])||row[field]!<0)) throw new Error(`Invalid public numeric field ${field}`);
    }
    if(row.injected_liquid_bbl===null ? row.calculated_calendar_day_avg_bpd!==null : row.calculated_calendar_day_avg_bpd===null || Math.abs(row.injected_liquid_bbl/expectedDays-row.calculated_calendar_day_avg_bpd)>0.000001) throw new Error('Public calculated daily average does not reconcile to monthly barrels');
  }
  if(!a.injectionMonthly.length) throw new Error('Public monthly history is incomplete');
  return a;
}
