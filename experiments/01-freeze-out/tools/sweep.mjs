// Runs many worlds headlessly and records how each one ends up.
// Usage: node tools/sweep.mjs > sweep-results.json
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { Sim } from '../sim.js';

const TICKS = 800;
const N = 1500;
const LAWS = Array.from({ length: 12 }, (_, i) => i + 1);
const SPREADS = [0, 0.25, 0.5, 0.75, 1];
const WORLDS = [1, 2];

function classify(r) {
  if (r.bondedShare < 0.05) return 'gas';
  if (r.largest > 0.3 * N) return 'blob';
  return 'chemistry';
}

if (isMainThread) {
  const jobs = [];
  for (const lawSeed of LAWS) for (const spread of SPREADS) for (const worldSeed of WORLDS) jobs.push({ lawSeed, spread, worldSeed });
  const results = [];
  let next = 0;
  const threads = Math.max(1, os.cpus().length);
  await Promise.all(Array.from({ length: threads }, () => new Promise((done) => {
    const w = new Worker(new URL(import.meta.url), { workerData: null });
    const feed = () => (next < jobs.length ? w.postMessage(jobs[next++]) : (w.terminate(), done()));
    w.on('message', (r) => { results.push(r); process.stderr.write(`${results.length}/${jobs.length}\r`); feed(); });
    feed();
  })));
  results.sort((a, b) => a.lawSeed - b.lawSeed || a.spread - b.spread || a.worldSeed - b.worldSeed);
  process.stdout.write(JSON.stringify({ ticks: TICKS, n: N, results }, null, 1));
} else {
  parentPort.on('message', (job) => {
    const sim = new Sim({ ...job, n: N });
    for (let t = 0; t < TICKS; t++) sim.step();
    const c = sim.clusters();
    const r = { ...job, temperature: +sim.temperature().toFixed(4), bondedShare: +c.bondedShare.toFixed(3), groups: c.groups, largest: c.largest, sorting: +c.sorting.toFixed(3) };
    r.outcome = classify(r);
    parentPort.postMessage(r);
  });
}
