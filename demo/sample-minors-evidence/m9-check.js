@go http://127.0.0.1:4174/
---
@wait document.readyState==='complete'&&document.getElementById('sample-tour-start-home')
---
document.getElementById('sample-tour-start-home').click();return 'tour start clicked';
---
@wait !document.getElementById('sample-tour').hidden&&/Step 1/.test(document.getElementById('sample-tour-count').textContent)
---
await new Promise(r=>setTimeout(r,800));window.scrollTo(0,document.documentElement.scrollHeight);await new Promise(r=>setTimeout(r,300));const sheet=document.getElementById('sample-tour').getBoundingClientRect();const blocks=[...document.body.children].filter(e=>e.id!=='sample-tour'&&e.getClientRects().length&&getComputedStyle(e).position!=='fixed');const bottom=Math.max(...blocks.map(e=>e.getBoundingClientRect().bottom));return {M9_viewport:innerHeight,M9_sheetTop:Math.round(sheet.top),M9_contentBottom:Math.round(bottom),M9_coveredPx:Math.max(0,Math.round(bottom-sheet.top)),bodyPadBottom:getComputedStyle(document.body).paddingBottom,blocks:blocks.map(e=>e.tagName+'#'+e.id)};
