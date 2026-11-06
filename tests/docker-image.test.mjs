import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Static checks of the repo-root Dockerfile (ZC-02). Root tests run in place in CI; the app suite runs in an isolated copy without the repo root.
test('Repo-root Dockerfile serves on 0.0.0.0:4290 as a non-root user with a health check',()=>{
  const docker=readFileSync('Dockerfile','utf8').replace(/\r\n/g,'\n');
  assert.equal(docker.match(/^FROM node:24\.13\.0-alpine\b/gm)?.length,2);
  assert.match(docker,/^ENV .*\bHOST=0\.0\.0\.0\b/m);
  assert.match(docker,/^ENV .*\bPORT=4290\b/m);
  assert.match(docker,/^USER node$/m);
  assert.match(docker,/^EXPOSE 4290$/m);
  assert.match(docker,/^COPY swd-injection-analytics\/output\/pdf \.\/output\/pdf$/m);
  assert.match(docker,/^HEALTHCHECK .*\n\s+CMD .*http:\/\/127\.0\.0\.1:'\+\(process\.env\.PORT\|\|4290\)/m);
  assert.match(docker,/^CMD \["node", "scripts\/serve\.mjs"\]$/m);
  assert.doesNotMatch(docker,/\bnpx\b/);
});
