#!/usr/bin/env bash
# Browser regression checks for the final-review findings. Prints PASS/FAIL per finding.
cd "$(dirname "$0")"; export VIEW=1536x1024; URL="http://127.0.0.1:4290/analytics/index.html#start/start"
ready='const $=id=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<40&&!$("sample-load");i++)await wait(250);await wait(800);'
done_wait='for(let i=0;i<240;i++){if($("sample-cancel").hidden)break;await wait(500);}'

# F1: choosing another source during a load cancels the load and keeps the visitor's choice.
node cdp.mjs goto "$URL" >/dev/null
node cdp.mjs eval "$ready \$('sample-load').click();await wait(30);\$('source-demo').click();await wait(12000);const a=\$('active-dataset').textContent;return (a.includes('seed-417')&&!a.includes('swd-sample-case')&&\$('sample-banner').hidden&&location.hash==='#data/data')?'F1 PASS':'F1 FAIL '+a+' '+location.hash"

# F2: leaving the sample restores the capacity form and removes sample labels.
node cdp.mjs goto "$URL" >/dev/null
node cdp.mjs eval "$ready \$('sample-load').click();await wait(800);$done_wait \$('source-user').click();await wait(500);const n=\$('disposal-name'),bad=[n.value.startsWith('Sample case')&&'name',document.querySelectorAll('#disposal-form .sample-class, #hyd-form .sample-class, #pvt-form .sample-class').length&&'labels',\$('disposal-salinity').value==='8'&&'salinity',\$('disposal-pressure').value==='2400'&&'pressure'].filter(Boolean);return bad.length?'F2 FAIL '+bad.join(','):'F2 PASS'"

# F3: hydraulics reset removes TRRC/sample claims.
node cdp.mjs goto "$URL" >/dev/null
node cdp.mjs eval "$ready \$('sample-load').click();await wait(800);$done_wait location.hash='#fluid/hydraulics';await wait(800);\$('hyd-reset').click();await wait(300);const c=[...document.querySelectorAll('#hyd-form .sample-class')].map(n=>n.dataset.class).filter(c=>c!=='edited');return c.length?'F3 FAIL '+c.join(','):'F3 PASS'"

# F4: sample-mode producer exports carry no fictional injectors.
node cdp.mjs eval "window.__dl=[];const o=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.__dl.push(fetch(this.href).then(r=>r.text()));return;}return o.call(this);};const out=[];for(const r of ['production/history','production/forecast','production/reconciliation','production/groupedPlanning']){location.hash='#'+r;await new Promise(x=>setTimeout(x,900));document.getElementById('import-download').click();const t=await window.__dl.at(-1);if(/FICTIONAL-INJ|fictional assumed constant-J/.test(t))out.push(r);}return out.length?'F4 FAIL '+out.join(','):'F4 PASS'"

# F5: a failed first load stays visible and names the failed step.
node cdp.mjs goto "$URL" "const f=window.fetch;window.fetch=(u,...a)=>String(u).includes('sample-case.json')?Promise.resolve(new Response('x',{status:503})):f(u,...a);" >/dev/null
node cdp.mjs eval "$ready \$('sample-load').click();await wait(3000);const e=\$('sample-error').textContent;return (!\$('sample-banner').hidden&&/Step 1 of 7 failed/.test(e))?'F5 PASS':'F5 FAIL banner hidden='+\$('sample-banner').hidden+' err='+e"

# F7: changing wells by keyboard keeps focus on the well switch.
node cdp.mjs goto "$URL" >/dev/null
node cdp.mjs eval "$ready \$('sample-load').click();await wait(800);$done_wait location.hash='#injection/publicTrends';await wait(700);const r=document.querySelector('input[name=sample-well][value=\"1\"]');r.focus();r.click();await wait(700);return document.activeElement===r?'F7 PASS':'F7 FAIL focus='+document.activeElement.id+document.activeElement.tagName"
