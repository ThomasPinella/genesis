// Template probe: a straight chain of blocks carrying a chosen word, in a soup of free blocks under
// day and night. Each look records how many template links hold, how many template letters have a
// partner, runs of partners that are linked to each other along the backbone (a copy in the making),
// and copies that were on the template at the last look and have since come off whole.
// Usage: node tools/template.mjs T=800 backboneReach=0.2 letter=1.5 day=0.25 night=0.1 heat=0.1 [pin=1]
// pin=1 holds the template still (a diagnostic, not physics).
import { Sim } from '../sim.js';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')).map(([k, v]) => [k, isNaN(+v) ? v : +v]));
const word = args.word || '++-+--+-+-';
const p = { n: 600, density: 0.05, mix: 'blocks', backbone: 2, caps: 0, day: 0.15, night: 0.06, period: 100, heat: 0.06, template: word, ...args };
delete p.T; delete p.word;
const sim = new Sim(p);
const K = word.length;
function look() {
  const bonds = sim.bonds(), N = sim.n;
  const parent = Int32Array.from({ length: N }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const next = new Int32Array(N).fill(-1), partner = new Int32Array(N).fill(-1);
  for (const [i, a, j, b] of bonds) {
    if (sim.kind[i * 4 + a]) { partner[i] = j; partner[j] = i; continue; }
    parent[find(i)] = find(j);
    if (a === 0) next[i] = j; else next[j] = i; // + spot (corner 0) of i holds the - spot of j: j follows i
  }
  let spine = 0;
  for (let i = 0; i + 1 < K; i++) if (next[i] === i + 1) spine++;
  const paired = [];
  for (let i = 0; i < K; i++) paired.push(partner[i]);
  // copy segments: consecutive template blocks whose partners are backbone neighbours
  const segs = [];
  let cur = [];
  for (let i = 0; i < K; i++) {
    const pi = partner[i];
    const linked = cur.length && pi >= 0 && (next[cur[cur.length - 1]] === pi || next[pi] === cur[cur.length - 1]);
    if (pi >= 0 && pi >= K && (linked || !cur.length)) cur.push(pi);
    else { if (cur.length) segs.push(cur); cur = pi >= K ? [pi] : []; }
  }
  if (cur.length) segs.push(cur);
  return { find, partner, next, spine, nPaired: paired.filter((x) => x >= K).length, segs };
}
let prevSegs = [];
const half = Math.round(p.period / 2 / 0.005);
let released = 0, releasedLen = [], best = 0;
while (sim.time < (args.T || 1000)) {
  for (let k = 0; k < half; k++) { sim.step(); if (args.pin) { for (let i = 0; i < K; i++) { const o = i * 3; sim.vel[o] = sim.vel[o + 1] = sim.vel[o + 2] = 0; sim.L3[o] = sim.L3[o + 1] = sim.L3[o + 2] = 0; } } }
  const L = look();
  const ends = Math.round(sim.time / p.period * 2) % 2 === 0 ? 'day' : 'night';
  const longest = Math.max(0, ...L.segs.map((s) => s.length));
  best = Math.max(best, longest);
  let rel = [];
  for (const s of prevSegs) {
    if (s.length < 2) continue;
    const r0 = L.find(s[0]);
    const together = s.every((x) => L.find(x) === r0);
    const free = s.every((x) => L.partner[x] < 0 || L.partner[x] >= K) && L.find(0) !== r0;
    if (together && free) rel.push(s.length);
  }
  released += rel.length; releasedLen.push(...rel);
  console.log(sim.time.toFixed(0), ends, 'spine', L.spine + '/' + (K - 1), 'paired', L.nPaired, 'segs', JSON.stringify(L.segs.map((s) => s.length).filter((x) => x > 1)), 'released', JSON.stringify(rel));
  prevSegs = L.segs;
}
console.log('best', best, 'released total', released, JSON.stringify(releasedLen));
