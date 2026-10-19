// Runs day/night soups of capped molecules and records at the end of every day and every night what
// both levels hold. Level one, molecules (a four-spot ball and the caps it wears): how many, how many
// caps are worn, and which survive the day or night intact. Level two, clumps (molecules joined by the
// weak bonds between four-spot balls): how many molecules sit in them, the biggest, how many kinds and
// how many repeat, which survive (complete clumps, with every spot used, apart from open ones), and how
// old the oldest is.
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
    for (const capStrength of [1, 2]) for (const caps of [0.5, 0.6, 0.7]) for (const day of [0.15, 0.2]) jobs.push({ density: 0.3, seed, day, night: 0.06, period: 100, caps, capStrength });
    // Past the bond limit: caps strong enough to hold two partners.
    jobs.push({ density: 0.3, seed, day: 0.15, night: 0.06, period: 100, caps: 0.6, capStrength: 3 });
  }
  const partial = process.env.PARTIAL;
  const key = (j) => JSON.stringify([j.capStrength, j.caps, j.day, j.seed]);
  const results = partial && fs.existsSync(partial) ? fs.readFileSync(partial, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const done = new Set(results.map(key));
  const todo = jobs.filter((j) => !done.has(key(j)));
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
  const born = new Map(); // clump (by its balls) -> time first seen intact
  let prevMols = null, prevClumps = null;
  const looks = [];
  while (sim.tick < total) {
    sim.step();
    if (sim.tick % half) continue;
    const c = sim.census();
    const ends = Math.round(sim.time / job.period * 2) % 2 === 0 ? 'day' : 'night';
    // Level one: molecules that wear at least one cap.
    const mols = c.mols.filter((m) => m.core >= 0 && m.caps > 0).map((m) => [...m.members].sort((a, b) => a - b).join(','));
    let molsKept = null;
    if (prevMols) { const now = new Set(mols); molsKept = prevMols.length ? round(prevMols.filter((k) => now.has(k)).length / prevMols.length) : null; }
    // Level two: clumps of two or more molecules, named by their balls, with whether every spot is used.
    const used = new Set();
    for (const [i, a, j, b] of c.bondList) { used.add(i * 4 + a); used.add(j * 4 + b); }
    const clumps = c.clumpList.filter((k) => k.size >= 2).map((k) => {
      const balls = k.members.flatMap((u) => c.mols[u].members).sort((a, b) => a - b);
      let open = 0;
      for (const i of balls) for (let a = 0; a < 4; a++) if (sim.sign[i * 4 + a] && !used.has(i * 4 + a)) open++;
      const shape = k.loops > 0 ? 'looped' : k.size === 2 ? 'pair' : 'tree';
      return { key: balls.join(','), size: k.size, open, shape, sig: k.sig };
    });
    const now = new Set(clumps.map((k) => k.key));
    let kept = null;
    if (prevClumps) {
      kept = {};
      for (const k of prevClumps) {
        for (const label of [k.open ? 'open' : 'complete', k.shape, 'all']) {
          const b = kept[label] || (kept[label] = [0, 0]);
          b[1]++;
          if (now.has(k.key)) b[0]++;
        }
      }
    }
    for (const k of [...born.keys()]) if (!now.has(k)) born.delete(k);
    for (const k of clumps) if (!born.has(k.key)) born.set(k.key, sim.time);
    let oldest = null;
    for (const k of clumps) {
      const age = sim.time - born.get(k.key);
      if (!oldest || age > oldest.age) oldest = { age: round(age, 1), size: k.size, open: k.open, shape: k.shape };
    }
    const sizes = {};
    for (const k of clumps) sizes[k.size] = (sizes[k.size] || 0) + 1;
    looks.push({
      time: round(sim.time, 1), ends, temperature: round(c.temperature, 4),
      molecules: mols.length, capsWorn: round(c.capsWorn), molKinds: Object.keys(c.molNames).length, molsKept,
      clumps: clumps.length, complete: clumps.filter((k) => !k.open).length, inClumps: round(c.inClumps), largestClump: round(c.largestClump),
      clumpKinds: c.clumpKinds, clumpRepeated: c.clumpRepeated, sizes, kept,
      lasting: clumps.filter((k) => sim.time - born.get(k.key) >= job.period).length, oldest,
      largest: round(c.largest), spotsDoubled: round(c.spotsDoubled, 4),
      books: round((c.energy + c.heatLost - E0) / Math.abs(E0), 5),
    });
    prevMols = mols;
    prevClumps = clumps;
  }
  return { ...job, looks };
}
