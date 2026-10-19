// The template probe, for face chemistry: build a long chain by hand, drop it into a settled soup,
// and watch whether loose particles stick along its sides in order and link up into a second chain.
//
// Three kinds of chain:
//   default   the strongest chain each law allows: a repeat of one or two elements, each bonding
//             back through one face and forward through another (opposite faces make a straight
//             run, perpendicular ones a right-angle zigzag);
//   LADDER=1  a straight run of one element whose spine faces bond to its own kind and whose side
//             face also does, more weakly: the simplest chain that could hold a copy that lets go;
//   CODE=1    a straight run of two letters in a fixed random order, for laws where both letters
//             share a spine and each prefers the other at its side: a chain that could pass on a
//             sequence, read as the complement.
// The world runs for SETTLE ticks so genomes settle and the soup cools, then the chain replaces
// CHAIN particles (genomes set to the elements, at rest, faces turned to bond, side faces up) and
// anything in its way is moved aside. Nothing else changes: the law runs as usual. Measuring only.
//
// Usage: node tools/template.mjs > template-results.json
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import { Sim, S, D, FAST, rng } from '../sim.js';
import { CHAIN, FACE, chemistry, bestChain, ladderChain, codeChain, strictCode, layout, insert, feed, look } from '../probe.js';

const SETTLE = Number(process.env.SETTLE) || 1500;
const WATCH = Number(process.env.WATCH) || 3000;
const EVERY = 100;
const N = 1500;
const FACES = process.env.FACES ? Number(process.env.FACES) : 1;
const LAWS = process.env.LAWLIST ? process.env.LAWLIST.split(',').map(Number) : Array.from({ length: Number(process.env.LAWS) || 12 }, (_, i) => i + 1);
const LADDER = process.env.LADDER === '1';
const CODE = process.env.CODE === '1';
// STRICT picks the code by the law search's stricter test (strictCode) instead of codeChain.
const STRICT = process.env.STRICT === '1';
// ISOLATE=1 turns every other particle into the element that bonds least with the chain, to see
// whether the chain falls apart on its own (heat) or because the soup pulls it apart.
const ISOLATE = process.env.ISOLATE === '1';
// FEED=n also frees n building blocks: particles turned into the chain's elements and set loose,
// at rest, around the chain. In a settled soup almost everything is already bonded, so a chain
// has nothing to copy itself from; this supplies the raw material.
const FEED = Number(process.env.FEED) || 0;
// NOISE turns on the sim's optional seeded jitter, which with drag acts as a heat bath that keeps
// the soup warm instead of letting it freeze (off by default, as in every experiment).
const NOISE = Number(process.env.NOISE) || 0;
const WORLDS = [1, 2];
// SHAKES lists the shares of absorbed light that shake bonds (experiment 5); each runs separately.
const SHAKES = process.env.SHAKES ? process.env.SHAKES.split(',').map(Number) : [0.25];


if (isMainThread) {
  const jobs = [];
  for (const shake of SHAKES) for (const lawSeed of LAWS) for (const worldSeed of WORLDS) jobs.push({ lawSeed, worldSeed, shake });
  // PARTIAL names a file where each finished world is saved as it lands, so a stopped run can
  // pick up where it left off.
  const partial = process.env.PARTIAL;
  const results = partial && fs.existsSync(partial) ? fs.readFileSync(partial, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const done = new Set(results.map((r) => JSON.stringify([r.lawSeed, r.worldSeed, r.shake ?? null])));
  const todo = jobs.filter((j) => !done.has(JSON.stringify([j.lawSeed, j.worldSeed, j.shake ?? null])));
  jobs.length = 0; jobs.push(...todo);
  const total = results.length + jobs.length;
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, os.cpus().length) }, () => new Promise((done) => {
    const w = new Worker(new URL(import.meta.url));
    const feed = () => (next < jobs.length ? w.postMessage(jobs[next++]) : (w.terminate(), done()));
    w.on('message', (r) => { results.push(r); if (partial) fs.appendFileSync(partial, JSON.stringify(r) + '\n'); process.stderr.write(`${results.length}/${total}\n`); feed(); });
    feed();
  })));
  results.sort((a, b) => a.shake - b.shake || a.lawSeed - b.lawSeed || a.worldSeed - b.worldSeed);
  process.stdout.write(JSON.stringify({ settle: SETTLE, watch: WATCH, chain: CHAIN, faces: FACES, noise: NOISE, feed: FEED, mode: STRICT ? 'strict' : CODE ? 'code' : LADDER ? 'ladder' : 'strongest', results }, null, 1));
} else {
  parentPort.on('message', (job) => {
    const sim = new Sim({ ...job, n: N, faces: FACES, noise: NOISE });
    const chem = chemistry(sim);
    const chain = STRICT ? strictCode(chem) : CODE ? codeChain(chem) : LADDER ? ladderChain(chem) : bestChain(chem);
    if (!chain) { parentPort.postMessage({ ...job, chain: null }); return; }
    for (let t = 0; t < SETTLE; t++) sim.step();
    const laid = layout(chain, sim);
    // Element indices in the chain refer to chem.els; census kinds refer to sim.elements.
    const ids = insert(sim, laid, chem.els, job.lawSeed * 7919 + job.worldSeed);
    if (ISOLATE) {
      const used = [...new Set(laid.map((o) => o.e))];
      let inert = 0, low = Infinity;
      chem.els.forEach((_, x) => { const v = Math.max(...used.map((y) => chem.best[x][y])); if (v < low) { low = v; inert = x; } });
      const keep = new Set(ids);
      for (let i = 0; i < sim.n; i++) if (!keep.has(i)) for (let b = 0; b < S; b++) sim.s[i * D + FAST + b] = chem.els[inert].g[b];
    }
    if (FEED) feed(sim, laid, ids, chem.els, FEED, job.lawSeed * 104729 + job.worldSeed);
    const series = [];
    // Light the chain's members absorb, and light shaken into bonds anywhere, over each stretch.
    let chainLight = 0, shaken = 0, light = 0;
    for (let t = 1; t <= WATCH; t++) {
      sim.step();
      for (const i of ids) chainLight += sim.gotLight[i];
      shaken += sim.shaken || 0;
      for (let i = 0; i < sim.n; i++) light += sim.gotLight[i];
      if (t === 1 || t % EVERY === 0) {
        series.push({ t, ...look(sim, ids, chem.els, chain), chainLight: +chainLight.toFixed(3), shaken: +shaken.toFixed(3), light: +light.toFixed(2) });
        chainLight = 0; shaken = 0; light = 0;
      }
    }
    const f = FACE.map((v) => (v[0] ? (v[0] > 0 ? '+x' : '-x') : v[1] ? (v[1] > 0 ? '+y' : '-y') : v[2] > 0 ? '+z' : '-z'));
    parentPort.postMessage({
      ...job,
      chain: {
        sequence: laid.map((o) => chem.els[o.e].idx),
        faces: Object.fromEntries(Object.entries(chain.faces).map(([e, fs]) => [chem.els[e].idx, fs.map((x) => f[x]).join('/')])),
        score: +chain.score.toFixed(3),
      },
      series,
    });
  });
}
