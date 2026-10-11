// Whole-version transport describes retained evidence, not an accepted-row projection.
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const month=value=>typeof value==='string'&&/^(?!0000)\d{4}-(0[1-9]|1[0-2])-01$/.test(value);
const uics=value=>Array.isArray(value)&&value.length<=1000&&Array.from(value).every((uic,index)=>typeof uic==='string'&&/^\d{9}$/.test(uic)&&(index===0||value[index-1]<uic));
export function validExplorerScope(scope){
  if(!record(scope)||Object.keys(scope).length!==5||!['kind','inventoryUics','historyUics','periodStart','periodEnd'].every(key=>Object.hasOwn(scope,key))||scope.kind!=='whole-version'||!uics(scope.inventoryUics)||!uics(scope.historyUics))return false;
  return scope.historyUics.length===0?scope.periodStart===null&&scope.periodEnd===null:month(scope.periodStart)&&month(scope.periodEnd)&&scope.periodStart<=scope.periodEnd;
}
export function explorerWholeVersionScope(artifact){
  const collect=rows=>{
    if(!Array.isArray(rows)||rows.length>1000)throw Error('Whole-version records exceed the supported sender contract');
    const values=[];
    for(let index=0;index<rows.length;index++){
      const row=rows[index];
      if(!Object.hasOwn(rows,index)||!record(row)||!Object.hasOwn(row,'uic_number')||typeof row.uic_number!=='string'||!/^\d{9}$/.test(row.uic_number))throw Error('Whole-version well identifiers are unavailable');
      values.push(row.uic_number);
    }
    return [...new Set(values)].sort();
  };
  const inventoryUics=collect(artifact.inventory),historyUics=collect(artifact.injectionMonthly),periods=artifact.injectionMonthly.map(row=>row.period_start);
  if(periods.some(value=>!month(value)))throw Error('Whole-version monthly reporting coverage is unavailable');
  periods.sort();
  return {kind:'whole-version',inventoryUics,historyUics,periodStart:periods[0]??null,periodEnd:periods.at(-1)??null};
}
