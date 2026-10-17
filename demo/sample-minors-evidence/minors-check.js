@go http://127.0.0.1:4174/
---
@wait document.readyState==='complete'&&document.getElementById('sample-tour-start-home')
---
document.getElementById('sample-tour-start-home').click();return 'tour start clicked';
---
@wait !document.getElementById('sample-tour').hidden&&/Step 1/.test(document.getElementById('sample-tour-count').textContent)
---
const $=id=>document.getElementById(id);$('sample-tour-next').click();$('sample-tour-next').click();return {tourAt:$('sample-tour-count').textContent,view:$('main').dataset.view};
---
const $=id=>document.getElementById(id);$('sample-load').click();await new Promise(r=>setTimeout(r,400));return {M8_loading:!$('sample-progress').hidden,M8_tourPanelVisible:!$('sample-tour').hidden,M8_tourCount:$('sample-tour').hidden?null:$('sample-tour-count').textContent,view:$('main').dataset.view};
---
@wait /all 7 loading steps done/.test(document.getElementById('sample-banner-detail').textContent)
---
const $=id=>document.getElementById(id);[...document.querySelectorAll('[data-view="publicTrends"]')].find(b=>b.getClientRects().length)?.click();await new Promise(r=>setTimeout(r,500));return {M11_view:$('main').dataset.view,M11_label:$('active-dataset-label').textContent};
---
const $=id=>document.getElementById(id);$('sample-load').click();const t0=Date.now();while(Date.now()-t0<20000){const li=$('sample-progress').children[1];if(li&&li.dataset.status==='running'){$('sample-cancel').click();break;}await new Promise(r=>setTimeout(r,5));}await new Promise(r=>setTimeout(r,800));return {M6_banner:$('sample-banner-detail').textContent,M6_cancelledAt:[...$('sample-progress').children].map(li=>li.dataset.status)};
---
const $=id=>document.getElementById(id);const nav=await import('/navigation.mjs');history.pushState(null,'',nav.routeFor('comparison'));dispatchEvent(new PopStateEvent('popstate'));await new Promise(r=>setTimeout(r,3000));const txt=$('disposal-workspace').innerText;return {M6_view:$('main').dataset.view,M6_workspaceVisible:!$('disposal-workspace').hidden,M6_source:$('disposal-source').textContent.slice(0,160),M6_scheduleChangedBlock:/schedule changed/.test(txt)};
