// Runs soups under day/night cycles and under steady baths, and records at the end of every day and
// every night what the soup holds: how many kinds of small group, how many kinds repeat, the biggest
// group, which groups survive the day (or the night) intact, and how old the oldest group is.
// Usage: node tools/sweep.mjs > sweep-results.json   (PARTIAL=file saves each world as it lands)
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import { Sim, TICK } from '../sim.js';

const N = Number(process.env.N) || 1000;
const TIME = Number(process.env.TIME) || 1200; // time units per world
const round = (x, d = 3) => +x.toFixed(d);

if (isMainThread) {
  const jobs = [];
  for (const seed of [1, 2]) {
    for (const day of [0.15, 0.2]) for (const period of [50, 100, 200]) jobs.push({ mix: 'random', density: 0.05, seed, day, night: 0.06, period });
    for (const t of [0.06, 0.12, 0.2]) jobs.push({ mix: 'random', density: 0.05, seed, day: t, night: t, period: 100 });
    jobs.push({ mix: 'random', density: 0.3, seed, day: 0.2, night: 0.06, period: 100 });
    jobs.push({ mix: 'water', density: 0.05, seed, day: 0.2, night: 0.06, period: 100 });
  }
  const partial = process.env.PARTIAL;
  const key = (j) => JSON.stringify([j.mix, j.density, j.seed, j.day, j.night, j.period]);
  const results = partial && fs.existsSync(partial) ? fs.readFileSync(partial, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const done = new Set(results.map(key));
  const todo = jobs.filter((j) => !done.has(key(j))).sort((a, b) => b.density - a.density);
  const total = results.length + todo.length;
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, os.cpus().length) }, () => new Promise((fin) => {
    const w = new Worker(new URL(import.meta.url));
    const feed = () => (next < todo.length ? w.postMessage(todo[next++]) : (w.terminate(), fin()));
    w.on('message', (r) => { results.push(r); if (partial) fs.appendFileSync(partial, JSON.stringify(r) + '\n'); process.stderr.write(`${results.length}/${total}\n`); feed(); });
    feed();
  })));
  results.sort((a, b) => (key(a) < key(b) ? -1 : 1));
  process.stdout.write(JSON.stringify({ n: N, time: TIME, results }, null, 1));
} else {
  parentPort.on('message', (job) => parentPort.postMessage(run(job)));
}

function run(job) {
  const sim = new Sim({ n: N, ...job });
  const E0 = sim.energy();
  const half = Math.round(job.period / 2 / TICK);
  const total = Math.round(TIME / TICK);
  const key = (g) => g.members.join(',');
  const born = new Map(); // group (by its members) -> time first seen intact
  let prev = null;
  const looks = [];
  while (sim.tick < total) {
    sim.step();
    if (sim.tick % half) continue;
    const c = sim.census();
    // Dawn is at half a period, so a look at a whole number of periods ends a day, otherwise a night.
    const ends = Math.round(sim.time / job.period * 2) % 2 === 0 ? 'day' : 'night';
    const small = c.groups.filter((g) => g.size >= 3 && g.size <= 40);
    const now = new Set(c.groups.map(key));
    let kept = null, keptOpen = null, allOpen = null;
    if (prev) {
      const was = prev.filter((g) => g.size >= 3 && g.size <= 40);
      const stayed = was.filter((g) => now.has(key(g)));
      kept = was.length ? round(stayed.length / was.length) : null;
      const openShare = (gs) => gs.length ? round(gs.reduce((s, g) => s + (g.openPlus + g.openMinus) / (4 * g.size), 0) / gs.length) : null;
      keptOpen = openShare(stayed);
      allOpen = openShare(was);
    }
    for (const k of [...born.keys()]) if (!now.has(k)) born.delete(k);
    for (const g of small) if (!born.has(key(g))) born.set(key(g), sim.time);
    let oldest = null;
    for (const g of small) {
      const age = sim.time - born.get(key(g));
      if (!oldest || age > oldest.age) oldest = { age: round(age, 1), size: g.size, shape: g.shape, open: g.openPlus + g.openMinus };
    }
    const lasting = small.filter((g) => sim.time - born.get(key(g)) >= job.period).length;
    looks.push({
      time: round(sim.time, 1), ends, temperature: round(c.temperature, 4), bondsPerParticle: round(c.bondsPerParticle),
      largest: round(c.largest), singles: round(c.singles), clusterKinds: c.clusterKinds, repeatedKinds: c.repeatedKinds,
      inRepeats: c.inRepeats, shapes: c.shapes, spotsDoubled: round(c.spotsDoubled, 4),
      kept, keptOpen, allOpen, lasting, oldest,
      books: round((c.energy + c.heatLost - E0) / Math.abs(E0), 5),
    });
    prev = c.groups;
  }
  return { ...job, looks };
}
