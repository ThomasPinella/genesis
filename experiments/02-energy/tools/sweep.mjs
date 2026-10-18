// Runs many worlds headlessly for several days and records how energy moves through each one:
// which elements live on light, which live on each other, what moves, and whether the energy
// books ever show more energy than the light that came in.
// Usage: node tools/sweep.mjs > sweep-results.json
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import { Sim } from '../sim.js';

const TICKS = 4000;    // four days
const WINDOW = 2000;   // roles are judged over the last two days
const N = 1500;
const LAWS = Array.from({ length: 12 }, (_, i) => i + 1);
const WORLDS = [1, 2, 3, 4];
const CHECK = 20;

const round = (x, d = 3) => +x.toFixed(d);

// What an element lives on, judged by its income over the window.
export function role(r, avgIncome) {
  const inc = r.light + r.eat;
  if (!r.count || inc / r.count < 0.05 * avgIncome) return 'inert';
  if (r.light / inc > 0.7) return 'absorber';
  if (r.eat / inc > 0.7) return 'eater';
  return 'mixed';
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
  const laws = {};
  for (const r of results) {
    if (!laws[r.lawSeed]) laws[r.lawSeed] = { elements: r.elements };
    delete r.elements;
  }
  process.stdout.write(JSON.stringify({ ticks: TICKS, window: WINDOW, n: N, worlds: WORLDS, laws, results }, null, 1));
} else {
  parentPort.on('message', (job) => {
    const sim = new Sim({ ...job, n: N });
    const K1 = sim.elements.length + 1;
    sim.flow = new Float64Array(K1 * K1);
    let last = null, worstExcess = -Infinity;
    const temps = [], z = new Float64Array(K1), follow = new Float64Array(K1), seen = new Float64Array(K1);
    for (let t = 1; t <= TICKS; t++) {
      sim.step();
      if (t % CHECK === 0) {
        const e = sim.energy;
        if (last) worstExcess = Math.max(worstExcess, (e.total - last.total) - (e.lightIn - last.lightIn));
        last = e;
      }
      if (t % 100 === 0) sim.census();
      if (t === TICKS - WINDOW) sim.resetTotals();
      if (t > TICKS - WINDOW && t % 25 === 0) {
        temps.push(sim.temperature());
        for (let i = 0; i < sim.n; i++) {
          const k = sim.kind[i];
          z[k] += sim.pos[i * 3 + 2] / sim.L;
          // +1 when the particle sits under noon, -1 at midnight; 0 on average if it ignores the sun.
          follow[k] += Math.cos(2 * Math.PI * (sim.pos[i * 3] / sim.L - t / sim.p.day));
          seen[k]++;
        }
      }
    }
    const eco = sim.ecology(), c = sim.clusters(), cen = sim.census();
    let tot = 0, cnt = 0;
    for (const r of eco.rows) { tot += r.light + r.eat; cnt += r.count; }
    const avg = tot / cnt;
    const mean = temps.reduce((a, b) => a + b, 0) / temps.length;
    const sd = Math.sqrt(temps.reduce((a, b) => a + (b - mean) ** 2, 0) / temps.length);
    const kinds = eco.rows.map((r, k) => ({
      count: r.count,
      role: role(r, avg),
      light: r.count ? round(r.light / r.count) : 0,
      eat: r.count ? round(r.eat / r.count) : 0,
      eaten: r.count ? round(r.eaten / r.count) : 0,
      move: r.count ? round(r.move / r.count) : 0,
      height: seen[k] ? round(z[k] / seen[k]) : null,
      follow: seen[k] ? round(follow[k] / seen[k]) : null,
    }));
    parentPort.postMessage({
      ...job,
      elements: sim.elements.map((x) => ({ g: x.g.map((v) => round(v)), basin: round(x.basin) })),
      kinds,
      flow: eco.flow.map((x) => round(x, 1)),
      present: cen.present, company: cen.company.length, shares: cen.shares.map((x) => round(x)),
      temperature: round(mean, 4), tempSwing: round(sd, 4),
      bondedShare: round(c.bondedShare), groups: c.groups, largest: c.largest, sorting: round(c.sorting),
      lightIn: round(sim.energy.lightIn, 1), worstExcess: round(worstExcess, 3),
      hash: sim.hash(),
    });
  });
}
