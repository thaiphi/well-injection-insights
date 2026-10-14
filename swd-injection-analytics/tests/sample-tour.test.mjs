import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TOUR_STEPS} from '../web/tour-steps.mjs';
import {createTourState} from '../web/sample-tour.mjs';
import {WORKSPACES,routeFor} from '../web/navigation.mjs';

const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
test('seven stops in the spec order and routes',()=>{assert.deepEqual(TOUR_STEPS.map(s=>routeFor(s.view)),['#injection/publicTrends','#production/history','#production/forecast','#injection/comparison','#injection/sensitivity','#production/pressureSupport','#reports/reports']);for(const s of TOUR_STEPS)assert.ok(WORKSPACES.some(w=>w.id===s.view),s.view);});
test('every highlight target exists in index.html',()=>{for(const s of TOUR_STEPS)assert.match(html,new RegExp(`id="${s.target}"`),s.target);});
test('every stop has a heading, plain sentences and a From TRRC / You\'d gather box',()=>{for(const s of TOUR_STEPS){assert.ok(s.heading);assert.ok(s.body.length>=1&&s.body.length<=3,s.heading);assert.ok(s.fromTrrc.length,s.heading);assert.ok(s.gather.length,s.heading);}});
test('stop copy keeps the TRRC rules',()=>{const all=JSON.stringify(TOUR_STEPS);assert.match(TOUR_STEPS[0].body.join(' '),/never treated as bottomhole pressure/);assert.match(TOUR_STEPS[1].fromTrrc[0],/no producer data/);assert.match(TOUR_STEPS[5].body.join(' '),/synthetic/);assert.match(TOUR_STEPS[6].body.join(' '),/checklist/);assert.doesNotMatch(all,/annulus pressure (was|is) (synthesized|estimated)/i);});
test('tour state moves within bounds and exits cleanly',()=>{const t=createTourState(TOUR_STEPS);assert.equal(t.active,false);assert.equal(t.start().number,1);assert.equal(t.back().number,1);for(let i=0;i<10;i++)t.next();assert.equal(t.current().number,7);assert.equal(t.current().last,true);assert.equal(t.exit(),null);assert.equal(t.active,false);});
