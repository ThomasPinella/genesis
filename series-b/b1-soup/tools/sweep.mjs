// Cools many soups headlessly and records what they build along the way: how many bonds, how big
// the biggest group is, how many different kinds of small group exist and how many of those kinds
// appear more than once, what shapes they take, and whether bonds and groups last.
// Usage: node tools/sweep.mjs > sweep-results.json   (PARTIAL=file saves each world as it lands)
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import { Sim } from '../sim.js';

const N = Number(process.env.N) || 1000;
const POINTS = 30;   // looks per world
const LAG = 500;     // ticks between the two looks used to ask whether bonds and groups last
const round = (x, d = 3) => +x.toFixed(d);

if (isMainThread) {
  const jobs = [];
  for (const mix of ['random', 'water', 'pairs']) for (const density of [0.3, 0.05]) for (const seed of [1, 2]) {
    for (const drag of [0.01, 0.002]) jobs.push({ mix, density, seed, drag, ticks: (drag === 0.01 ? 30000 : 150000) * (density < 0.1 ? 2 : 1) });
  }
  // Control: an isolated box (no drag) never cools, so whatever it builds is what heat allows.
  for (const mix of ['random', 'water', 'pairs']) jobs.push({ mix, density: 0.3, seed: 1, drag: 0, ticks: 30000 });
  const partial = process.env.PARTIAL;
  const key = (j) => JSON.stringify([j.mix, j.density, j.seed, j.drag]);
  const results = partial && fs.existsSync(partial) ? fs.readFileSync(partial, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const done = new Set(results.map(key));
  const todo = jobs.filter((j) => !done.has(key(j))).sort((a, b) => b.ticks - a.ticks);
  const total = results.length + todo.length;
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, os.cpus().length) }, () => new Promise((fin) => {
    const w = new Worker(new URL(import.meta.url));
    const feed = () => (next < todo.length ? w.postMessage(todo[next++]) : (w.terminate(), fin()));
    w.on('message', (r) => { results.push(r); if (partial) fs.appendFileSync(partial, JSON.stringify(r) + '\n'); process.stderr.write(`${results.length}/${total}\n`); feed(); });
    feed();
  })));
  results.sort((a, b) => key(a) < key(b) ? -1 : 1);
  process.stdout.write(JSON.stringify({ n: N, lag: LAG, results }, null, 1));
} else {
  parentPort.on('message', (job) => parentPort.postMessage(run(job)));
}

// The small groups of a census as named kinds with how many copies exist.
function kinds(c) {
  const by = new Map();
  for (const g of c.groups) {
    if (g.size < 2 || g.size > 40) continue;
    const k = by.get(g.sig) || { size: g.size, bonds: g.bonds, shape: g.shape, charge: g.charge, openPlus: g.openPlus, openMinus: g.openMinus, copies: 0 };
    k.copies++;
    by.set(g.sig, k);
  }
  return [...by.values()].sort((a, b) => b.copies - a.copies || b.size - a.size);
}

function run({ mix, density, seed, drag, ticks }) {
  const sim = new Sim({ n: N, mix, density, seed, drag });
  const E0 = sim.energy();
  const every = ticks / POINTS;
  const series = [];
  let peak = null;
  const bondKey = (b) => `${b[0] * 4 + b[1]}-${b[2] * 4 + b[3]}`;
  const groupKey = (g) => g.members.join(',');
  let before = null;
  while (sim.tick < ticks) {
    sim.step();
    const t = sim.tick;
    if (t % every === every - LAG) before = sim.census();
    if (t % every === 0) {
      const c = sim.census();
      const bondsThen = new Set(before.bondList.map(bondKey));
      const bondsNow = new Set(c.bondList.map(bondKey));
      let kept = 0;
      for (const k of bondsThen) if (bondsNow.has(k)) kept++;
      const smallThen = before.groups.filter((g) => g.size >= 2 && g.size <= 40);
      const now = new Set(c.groups.map(groupKey));
      const groupsKept = smallThen.filter((g) => now.has(groupKey(g))).length;
      const point = {
        tick: t, temperature: round(c.temperature, 4), bondsPerParticle: round(c.bondsPerParticle), spotsDoubled: round(c.spotsDoubled, 4),
        largest: round(c.largest), singles: round(c.singles), clusters: c.clusters, clusterKinds: c.clusterKinds,
        repeatedKinds: c.repeatedKinds, inRepeats: c.inRepeats, shapes: c.shapes,
        bondsLast: bondsThen.size ? round(kept / bondsThen.size) : null,
        groupsLast: smallThen.length ? round(groupsKept / smallThen.length) : null,
        books: round((c.energy + c.heatLost - E0) / Math.abs(E0), 5),
      };
      series.push(point);
      if (!peak || c.clusterKinds > peak.clusterKinds) peak = { tick: t, temperature: point.temperature, clusterKinds: c.clusterKinds, kinds: kinds(c).slice(0, 12) };
    }
  }
  const last = sim.census();
  return { mix, density, seed, drag, ticks, series, peak, final: { kinds: kinds(last).slice(0, 12), largest: round(last.largest), shapes: last.shapes } };
}
