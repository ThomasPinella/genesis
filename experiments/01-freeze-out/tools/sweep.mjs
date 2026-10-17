// Runs many worlds headlessly and records how each one ends up: which elements it settled into,
// how it clumped, and whether its total energy ever rose.
// Usage: node tools/sweep.mjs > sweep-results.json
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import { Sim } from '../sim.js';

const TICKS = 1600;
const N = 1500;
const LAWS = Array.from({ length: 12 }, (_, i) => i + 1);
const WORLDS = [1, 2, 3, 4];
const CHECK = 20; // ticks between energy checks

const round = (x, d = 3) => +x.toFixed(d);
const vec = (g) => g.map((x) => round(x));

function classify(r) {
  if (r.bondedShare < 0.05) return 'gas';
  if (r.largest > 0.3 * N) return 'blob';
  return 'chemistry';
}

if (isMainThread) {
  const jobs = [];
  for (const lawSeed of LAWS) for (const worldSeed of WORLDS) jobs.push({ lawSeed, worldSeed });
  const results = [];
  let next = 0;
  const threads = Math.max(1, os.cpus().length);
  await Promise.all(Array.from({ length: threads }, () => new Promise((done) => {
    const w = new Worker(new URL(import.meta.url));
    const feed = () => (next < jobs.length ? w.postMessage(jobs[next++]) : (w.terminate(), done()));
    w.on('message', (r) => { results.push(r); process.stderr.write(`${results.length}/${jobs.length}\r`); feed(); });
    feed();
  })));
  results.sort((a, b) => a.lawSeed - b.lawSeed || a.worldSeed - b.worldSeed);

  // The law's possible elements are the same for every start, so keep them once per law.
  const laws = {};
  for (const r of results) {
    if (!laws[r.lawSeed]) laws[r.lawSeed] = { elements: r.elements };
    delete r.elements;
  }
  process.stdout.write(JSON.stringify({ ticks: TICKS, n: N, worlds: WORLDS, laws, results }, null, 1));
} else {
  parentPort.on('message', (job) => {
    const sim = new Sim({ ...job, n: N });
    let last = null, maxRise = 0, first = null;
    for (let t = 1; t <= TICKS; t++) {
      sim.step();
      if (first === null) first = sim.energy.total;
      if (t % CHECK === 0) {
        if (last !== null && sim.energy.total > last) maxRise = Math.max(maxRise, sim.energy.total - last);
        last = sim.energy.total;
      }
    }
    const c = sim.clusters();
    const e = sim.census();
    const r = {
      ...job,
      temperature: round(sim.temperature(), 4),
      bondedShare: round(c.bondedShare), groups: c.groups, largest: c.largest, sorting: round(c.sorting),
      elements: sim.elements.map((x) => ({ g: vec(x.g), basin: round(x.basin) })),
      shares: e.shares.map((x) => round(x)),
      present: e.present,
      company: e.company.map((x) => ({ g: vec(x.g), share: round(x.share) })),
      distinct: e.distinct,
      settled: round(e.settled),
      energyStart: round(first, 1), energyEnd: round(sim.energy.total, 1), energyMaxRise: round(maxRise, 3),
      hash: sim.hash(),
    };
    r.outcome = classify(r);
    parentPort.postMessage(r);
  });
}
