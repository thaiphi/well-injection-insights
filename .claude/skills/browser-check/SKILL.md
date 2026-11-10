---
name: browser-check
description: Use when a change to the Analytics app needs browser evidence - a visible panel, a download, a refusal message, or desktop and mobile layout - before QA sign-off or a preservation layer.
---

# Browser-check the Analytics app

Drive the real app in headless Chrome over the DevTools protocol with a small Node script. This works without the Chrome extension or the DevTools MCP, which other sessions may hold.

## Steps

1. **Build and serve** from `swd-injection-analytics/`:
   - `node ../node_modules/typescript/bin/tsc -p tsconfig.json`
   - `PORT=4174 node scripts/serve.mjs` (run in the background). Avoid browser-blocked ports such as 4190.
2. **Start Chrome** headless with an isolated profile in the scratchpad:
   `"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 --user-data-dir=<scratchpad>/chrome-profile about:blank`
3. **Write a driver** in `demo/<feature>-evidence/`. Copy the pattern of `demo/h10-diagnostics-evidence/h10-check.mjs`:
   - open a tab via `PUT http://127.0.0.1:9333/json/new`, talk CDP over its WebSocket;
   - set the viewport with `Emulation.setDeviceMetricsOverride`;
   - capture downloads by wrapping `URL.createObjectURL` and `HTMLAnchorElement.prototype.click`;
   - save screenshots with `Page.captureScreenshot` and collect console errors.
4. **Run at both widths:** `node <driver> 1280 900 0 desktop` and `node <driver> 390 844 1 mobile`.
5. **Verify downloads** independently: recompute or verify sealed JSON with the app's own `dist/*Export.js` verifier, and compare CSV and SVG with what the page showed.
6. **Clean up:** stop the server and Chrome, and confirm ports 4174 and 9333 are free.

## Record

In `demo/<FEATURE>-VERIFICATION.md`, record the commands, the Chrome version, each acceptance criterion with its screenshot or download, and any console errors (expected: none). Use synthetic data only (fictional UIC `000000417`).
