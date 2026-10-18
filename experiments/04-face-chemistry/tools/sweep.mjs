// Runs many worlds headlessly with face chemistry. The control is experiment 3's sweep, which used
// the same laws and starts (only the face rule differs), and experiment 2 (geometry 0). Records
// what shapes the bonded groups take, whether identical patterned groups repeat, and whether any
// group splits into two identical halves. FACES sets how different the faces are (default 1).
// Usage: node tools/sweep.mjs > sweep-results.json
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import { Sim } from '../sim.js';

const TICKS = Number(process.env.TICKS) || 4000;
const N = 1500;
const LAWS = Array.from({ length: Number(process.env.LAWS) || 12 }, (_, i) => i + 1);
const WORLDS = [1, 2, 3, 4];
const GEOMETRY = [1];
const FACES = process.env.FACES ? Number(process.env.FACES) : 1;
const CHECK = 20;      // ticks between energy-books checks
const WATCH = 25;      // ticks between looks at the groups, for splits
const SERIES = 500;    // ticks between points of the repeat count over time
const MIN = 5;         // smallest group counted as a structure

const round = (x, d = 3) => +x.toFixed(d);

// Groups of at least MIN particles with at least two elements carry a pattern; count how many of
// them share a signature with another one right now.
function repeats(groups) {
  const by = new Map();
  for (const g of groups) if (g.size >= MIN && g.kinds >= 2) by.set(g.sig, (by.get(g.sig) || 0) + 1);
  let kinds = 0, members = 0, top = 0;
  for (const c of by.values()) if (c >= 2) { kinds++; members += c; top = Math.max(top, c); }
  return { kinds, members, top, patterned: [...by.values()].reduce((a, b) => a + b, 0) };
}

if (isMainThread) {
  const jobs = [];
  for (const geometry of GEOMETRY) for (const lawSeed of LAWS) for (const worldSeed of WORLDS) jobs.push({ lawSeed, worldSeed, geometry });
  // PARTIAL names a file where each finished world is saved as it lands, so a stopped run can
  // pick up where it left off.
  const partial = process.env.PARTIAL;
  const results = partial && fs.existsSync(partial) ? fs.readFileSync(partial, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const done = new Set(results.map((r) => JSON.stringify([r.lawSeed, r.worldSeed, r.geometry ?? null])));
  const todo = jobs.filter((j) => !done.has(JSON.stringify([j.lawSeed, j.worldSeed, j.geometry ?? null])));
  jobs.length = 0; jobs.push(...todo);
  const total = results.length + jobs.length;
  let next = 0;
  const threads = Math.max(1, os.cpus().length);
  await Promise.all(Array.from({ length: threads }, () => new Promise((done) => {
    const w = new Worker(new URL(import.meta.url));
    const feed = () => (next < jobs.length ? w.postMessage(jobs[next++]) : (w.terminate(), done()));
    w.on('message', (r) => { results.push(r); if (partial) fs.appendFileSync(partial, JSON.stringify(r) + '\n'); process.stderr.write(`${results.length}/${total}\n`); feed(); });
    feed();
  })));
  results.sort((a, b) => b.geometry - a.geometry || a.lawSeed - b.lawSeed || a.worldSeed - b.worldSeed);
  const laws = {};
  for (const r of results) {
    if (!laws[r.lawSeed]) laws[r.lawSeed] = { elements: r.elements };
    delete r.elements;
  }
  process.stdout.write(JSON.stringify({ ticks: TICKS, n: N, faces: FACES, worlds: WORLDS, min: MIN, laws, results }, null, 1));
} else {
  parentPort.on('message', (job) => {
    const sim = new Sim({ ...job, n: N, faces: FACES });
    let last = null, worstExcess = -Infinity, splits = 0, splitSize = 0;
    let prevRoot = null;
    const series = [];
    for (let t = 1; t <= TICKS; t++) {
      sim.step();
      if (t % CHECK === 0) {
        const e = sim.energy;
        if (last) worstExcess = Math.max(worstExcess, (e.total - last.total) - (e.lightIn - last.lightIn));
        last = e;
      }
      if (t % 100 === 0) sim.census();
      if (t % WATCH === 0 && t > TICKS / 4) {
        // A split into identical halves: two patterned groups with the same signature now, whose
        // members were mostly together in one group a moment ago.
        const groups = sim.shapes(MIN);
        const root = new Int32Array(sim.n).fill(-1);
        for (const g of groups) for (const i of g.members) root[i] = g.root;
        if (prevRoot) {
          const by = new Map();
          for (const g of groups) {
            if (g.kinds < 2) continue;
            const votes = new Map();
            for (const i of g.members) if (prevRoot[i] >= 0) votes.set(prevRoot[i], (votes.get(prevRoot[i]) || 0) + 1);
            let best = -1, bv = 0;
            for (const [r, v] of votes) if (v > bv) { bv = v; best = r; }
            if (best < 0 || bv * 2 < g.size) continue;
            const key = g.sig + '@' + best;
            by.set(key, (by.get(key) || 0) + 1);
          }
          for (const [key, c] of by) if (c >= 2) { splits++; splitSize = Math.max(splitSize, groups.find((g) => key.startsWith(g.sig + '@')).size); }
        }
        prevRoot = root;
        if (t % SERIES === 0) series.push(repeats(groups).members);
      }
    }
    sim.census();
    const groups = sim.shapes(3);
    const c = sim.clusters();
    const byShape = { chain: 0, ring: 0, tree: 0, sheet: 0, blob: 0 };
    for (const g of groups) byShape[g.cls] += g.size;
    const big = groups.filter((g) => g.size >= MIN);
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const rep = repeats(groups);
    // The most repeated patterned structure, for the record.
    const counts = new Map();
    for (const g of big) if (g.kinds >= 2) counts.set(g.sig, (counts.get(g.sig) || 0) + 1);
    let topSig = null, topCount = 0;
    for (const [sg, n] of counts) if (n > topCount) { topCount = n; topSig = sg; }
    const example = topSig ? big.find((g) => g.sig === topSig) : null;
    parentPort.postMessage({
      ...job,
      elements: sim.elements.map((x) => ({ g: x.g.map((v) => round(v)), basin: round(x.basin) })),
      temperature: round(sim.temperature(), 4),
      bondedShare: round(c.bondedShare), groups: groups.length, largest: c.largest,
      shapes: Object.fromEntries(Object.entries(byShape).map(([k, v]) => [k, round(v / N)])),
      chainLength: round(mean(groups.filter((g) => g.cls === 'chain' || g.cls === 'ring').map((g) => g.size)) || 0, 2),
      elongation: mean(big.map((g) => g.elong)) === null ? null : round(mean(big.map((g) => g.elong))),
      flatness: mean(big.map((g) => g.flat)) === null ? null : round(mean(big.map((g) => g.flat))),
      structures: big.length,
      patterned: rep.patterned,
      repeatKinds: rep.kinds, repeatMembers: rep.members, repeatTop: rep.top,
      topRepeat: example ? { count: topCount, size: example.size, kinds: example.kinds, cls: example.cls } : null,
      repeatSeries: series,
      splits, splitSize,
      worstExcess: round(worstExcess, 3),
      hash: sim.hash(),
    });
  });
}
