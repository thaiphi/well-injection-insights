@go http://127.0.0.1:4174/
---
@wait document.readyState==='complete'&&document.getElementById('sample-tour-start-home')
---
return {width:innerWidth,tourHidden:document.getElementById('sample-tour').hidden,bodyPadBottom:getComputedStyle(document.body).paddingBottom};
---
document.getElementById('sample-tour-start-home').click();return 'tour start clicked';
---
@wait !document.getElementById('sample-tour').hidden&&/Step 1/.test(document.getElementById('sample-tour-count').textContent)
---
await new Promise(r=>setTimeout(r,500));return {width:innerWidth,tourHidden:document.getElementById('sample-tour').hidden,bodyPadBottom:getComputedStyle(document.body).paddingBottom};
---
document.getElementById('sample-tour-exit').click();await new Promise(r=>setTimeout(r,300));return {width:innerWidth,afterExit_tourHidden:document.getElementById('sample-tour').hidden,bodyPadBottom:getComputedStyle(document.body).paddingBottom};
