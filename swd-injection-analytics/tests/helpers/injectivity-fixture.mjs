import {diagnoseMonthly} from '../../dist/h10Diagnostics.js';
import {buildTestState} from '../../dist/testRecords.js';

/** Fictional UIC 000000417. Values are synthetic; no real well's test values appear here. */
export const SYNTHETIC_UIC='000000417';
const days=m=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0)).getUTCDate();
export function monthlyRow(month,rate,avg){const d=days(month);
 return {source_row_key:`m:${month}`,parent_key:'p',parent_join_status:'matched',uic_number:SYNTHETIC_UIC,reporting_year:Number(month.slice(0,4)),reporting_month:Number(month.slice(5,7)),period_start:`${month}-01`,
  injected_liquid_bbl:rate===null?null:rate*d,reported_avg_injection_pressure_psi:avg,reported_max_injection_pressure_psi:avg===null?null:avg+50,calendar_days:d,calculated_calendar_day_avg_bpd:rate};}
export function bhpRow(id,date,psi,depth){
 return Object.freeze({source_row_key:`b${id}`,parent_key:'p',parent_join_status:'matched',uic_number:SYNTHETIC_UIC,source_report_id:String(id),tracking_no:'9',test_sequence_no:'1',
  report_conducted_date:date,report_conducted_date_text:date,report_received_date:null,report_received_date_text:'',bhp_psia:psi,test_depth_ft:depth,gradient_psi_ft:null,tested_formation:'SYNTHETIC',source_snapshot_id:'s',quality_flags:Object.freeze([])});}
const MONTHS=['2024-01','2024-02','2024-03','2024-04','2024-05','2024-06','2024-07','2024-08'];
/** Default: 8 months at 10000 bbl/day and 900 psi; 2024-05 has no average pressure (flagged, excluded by default).
 * Tests: T1 2024-02-12 1705 psi @3310 ft; T2 2024-07-22 1731 @3310; T3 2023-11-07 1500 @3100 (off depth, excluded by default); T4 2024-05-10 1720 @3310. */
export function fixtureInputs({avg=900,rate=10000,monthly=null,bhp=null}={}){
 const rows=monthly??MONTHS.map(m=>monthlyRow(m,rate,m==='2024-05'?null:avg));
 const h10=rows.length?diagnoseMonthly(rows):null;
 const tests=buildTestState({package:{bhp:bhp??[bhpRow(1,'2024-02-12',1705,3310),bhpRow(2,'2024-07-22',1731,3310),bhpRow(3,'2023-11-07',1500,3100),bhpRow(4,'2024-05-10',1720,3310)],srt:[]}},
  h10?{first:h10.months[0].month,last:h10.months[h10.months.length-1].month}:null);
 return {h10,tests};
}
