// Runs many worlds headlessly in several modes on the same laws and starts: coarse (far attention
// on), off (coarse 0, which is experiment 5), strong (far attention four times as strong), listen
// and listen3 (far attention on, and particles attend more to bond partners), space and space5 (far
// attention on, and empty space takes a share of attention). frozen (fast states frozen at their
// random start) is there too but was not run, since no mode showed shape to take away.
// Asks whether groups act as units:
//   sync:     how much of the fast-state spread within an element is shared by a group's members
//   shape:    how much of it follows a member's place (chain end or middle, bond count) or its
//             group's shape class
//   blend:    for groups with the same members, how far apart their average key is when the
//             arrangement differs, against when it is the same (keys are what others see from afar)
//   standout: how much a cell's members agree (|average key|^2 over average |key|^2), for cells
//             held by one bonded group against cells of loose particles
// and records the world as experiment 5's sweep did: bonds, shapes, repeats, identical splits,
// and the energy books. Usage: node tools/units.mjs > units-results.json
// MODES, LAWS (count), WORLDS, TICKS and PARTIAL (resume file) can be set from the environment.
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import { Sim, D, FAST, S, rng } from '../sim.js';

const TICKS = Number(process.env.TICKS) || 4000;
const N = Number(process.env.N) || 1500;
const LAWS = Array.from({ length: Number(process.env.LAWS) || 12 }, (_, i) => i + 1);
const WORLDS = process.env.WORLDS ? process.env.WORLDS.split(',').map(Number) : [1, 2];
const MODES = process.env.MODES ? process.env.MODES.split(',') : ['coarse', 'off'];
const SETTINGS = { coarse: { coarse: 1 }, off: { coarse: 0 }, frozen: { coarse: 1, stateRate: 0 }, strong: { coarse: 4 }, listen: { coarse: 1, listen: 1 }, space: { coarse: 1, space: 1 }, listen3: { coarse: 1, listen: 3 }, space5: { coarse: 1, space: 5 } };
const CHECK = 20, WATCH = 25, SERIES = 500, MIN = 5;

const round = (x, d = 3) => (x === null || x === undefined || Number.isNaN(x) ? null : +x.toFixed(d));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

function repeats(groups) {
  const by = new Map();
  for (const g of groups) if (g.size >= MIN && g.kinds >= 2) by.set(g.sig, (by.get(g.sig) || 0) + 1);
  let kinds = 0, members = 0, top = 0;
  for (const c of by.values()) if (c >= 2) { kinds++; members += c; top = Math.max(top, c); }
  return { kinds, members, top, patterned: [...by.values()].reduce((a, b) => a + b, 0) };
}

if (isMainThread) {
  const jobs = [];
  for (const mode of MODES) for (const lawSeed of LAWS) for (const worldSeed of WORLDS) jobs.push({ lawSeed, worldSeed, mode });
  const partial = process.env.PARTIAL;
  const results = partial && fs.existsSync(partial) ? fs.readFileSync(partial, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const done = new Set(results.map((r) => [r.lawSeed, r.worldSeed, r.mode].join()));
  const todo = jobs.filter((j) => !done.has([j.lawSeed, j.worldSeed, j.mode].join()));
  const total = results.length + todo.length;
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, os.cpus().length) }, () => new Promise((fin) => {
    const w = new Worker(new URL(import.meta.url));
    const feed = () => (next < todo.length ? w.postMessage(todo[next++]) : (w.terminate(), fin()));
    w.on('message', (r) => { results.push(r); if (partial) fs.appendFileSync(partial, JSON.stringify(r) + '\n'); process.stderr.write(`${results.length}/${total}\n`); feed(); });
    feed();
  })));
  results.sort((a, b) => MODES.indexOf(a.mode) - MODES.indexOf(b.mode) || a.lawSeed - b.lawSeed || a.worldSeed - b.worldSeed);
  process.stdout.write(JSON.stringify({ ticks: TICKS, n: N, worlds: WORLDS, modes: MODES, settings: SETTINGS, results }, null, 1));
} else {
  parentPort.on('message', (job) => {
    const sim = new Sim({ lawSeed: job.lawSeed, worldSeed: job.worldSeed, n: N, ...SETTINGS[job.mode] });
    const r = rng(job.lawSeed * 7919 + job.worldSeed);
    let last = null, worstExcess = -Infinity, splits = 0, prevRoot = null, farShare = 0, farN = 0;
    const series = [];
    for (let t = 1; t <= TICKS; t++) {
      sim.step();
      if (t > TICKS * 3 / 4 && t % 10 === 0) {
        let s = 0;
        for (let i = 0; i < sim.n; i++) s += sim.farW[i] / sim.wsum[i];
        farShare += s / sim.n; farN++;
      }
      if (t % CHECK === 0) {
        const e = sim.energy;
        if (last) worstExcess = Math.max(worstExcess, (e.total - last.total) - (e.lightIn - last.lightIn));
        last = e;
      }
      if (t % 100 === 0) sim.census();
      if (t % WATCH === 0 && t > TICKS / 4) {
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
            for (const [rr, v] of votes) if (v > bv) { bv = v; best = rr; }
            if (best < 0 || bv * 2 < g.size) continue;
            by.set(g.sig + '@' + best, (by.get(g.sig + '@' + best) || 0) + 1);
          }
          for (const c of by.values()) if (c >= 2) splits++;
        }
        prevRoot = root;
        if (t % SERIES === 0) series.push(repeats(groups).members);
      }
    }
    sim.census();
    sim.project();
    const groups = sim.shapes(3);
    const c = sim.clusters();
    const groupOf = new Int32Array(N).fill(-1), sizeOf = new Int32Array(N);
    for (const g of groups) for (const i of g.members) { groupOf[i] = g.root; sizeOf[i] = g.size; }
    const deg = new Int32Array(N);
    for (let b = 0; b < sim.bondCount; b++) { deg[sim.bondA[b]]++; deg[sim.bondB[b]]++; }
    const fast = (i) => Array.from(sim.s.subarray(i * D, i * D + FAST));
    const key = (i) => Array.from(sim.k.subarray(i * D, i * D + D));
    const slow = (i) => Array.from(sim.s.subarray(i * D + FAST, i * D + D));

    // Share of fast-state spread, within each element, explained by a label, against the same
    // labels shuffled within the element.
    const explained = (rows, label) => {
      const byKind = new Map();
      for (const x of rows) { if (!byKind.has(x.kind)) byKind.set(x.kind, []); byKind.get(x.kind).push(x); }
      const share = (labels) => {
        let tot = 0, within = 0;
        for (const [, list] of byKind) {
          if (list.length < 10) continue;
          const m = new Float64Array(FAST);
          for (const x of list) for (let a = 0; a < FAST; a++) m[a] += x.f[a] / list.length;
          const sums = new Map();
          list.forEach((x, k) => { const l = labels(x, k); if (!sums.has(l)) sums.set(l, { n: 0, s: new Float64Array(FAST) }); const e = sums.get(l); e.n++; for (let a = 0; a < FAST; a++) e.s[a] += x.f[a]; });
          list.forEach((x, k) => { const e = sums.get(labels(x, k)); for (let a = 0; a < FAST; a++) { tot += (x.f[a] - m[a]) ** 2; within += (x.f[a] - e.s[a] / e.n) ** 2; } });
        }
        return tot > 0 ? 1 - within / tot : null;
      };
      const real = share((x) => label(x));
      const shuffled = [];
      for (let rep = 0; rep < 20; rep++) {
        const perm = new Map();
        for (const [kk, list] of byKind) { const ls = list.map(label); for (let x = ls.length - 1; x > 0; x--) { const y = Math.floor(r() * (x + 1)); [ls[x], ls[y]] = [ls[y], ls[x]]; } perm.set(kk, ls); }
        shuffled.push(share((x, k) => perm.get(x.kind)[k]));
      }
      return { real: round(real), chance: round(mean(shuffled.filter((v) => v !== null))) };
    };
    const cls = new Map(groups.map((g) => [g.root, g.cls]));
    const rows = [];
    for (let i = 0; i < N; i++) rows.push({ kind: sim.kind[i], f: fast(i), deg: Math.min(deg[i], 3), group: groupOf[i], cls: groupOf[i] >= 0 ? cls.get(groupOf[i]) : 'loose' });
    const grouped = rows.filter((x) => x.group >= 0);
    const units = {
      sync: explained(grouped, (x) => x.group),
      byChainPlace: explained(grouped.filter((x) => x.cls === 'chain'), (x) => x.deg),
      byBonds: explained(grouped, (x) => x.deg),
      byShape: explained(grouped, (x) => x.cls),
    };

    // Same members, different arrangement.
    const avg = (ids, get, len) => { const m = new Float64Array(len); for (const i of ids) { const v = get(i); for (let a = 0; a < len; a++) m[a] += v[a] / ids.length; } return m; };
    const dist = (a, b) => { let d = 0; for (let k = 0; k < a.length; k++) d += (a[k] - b[k]) ** 2; return Math.sqrt(d); };
    const byMakeup = new Map();
    for (const g of groups) {
      if (g.size < 4) continue;
      const mk = g.members.map((i) => sim.kind[i]).sort((x, y) => x - y).join(',');
      if (!byMakeup.has(mk)) byMakeup.set(mk, []);
      byMakeup.get(mk).push({ sig: g.sig, k: avg(g.members, key, D), f: avg(g.members, fast, FAST), g: avg(g.members, slow, S) });
    }
    const pr = { kSame: [], kDiff: [], fSame: [], fDiff: [], gSame: [], gDiff: [] };
    for (const [, list] of byMakeup) for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const tag = list[x].sig === list[y].sig ? 'Same' : 'Diff';
      pr['k' + tag].push(dist(list[x].k, list[y].k)); pr['f' + tag].push(dist(list[x].f, list[y].f)); pr['g' + tag].push(dist(list[x].g, list[y].g));
    }
    const blend = { pairsSame: pr.kSame.length, pairsDiff: pr.kDiff.length };
    for (const [k, v] of Object.entries(pr)) blend[k] = round(mean(v));

    // Standing out: how much a cell's members agree, for cells held by one bonded group and cells
    // of loose particles.
    sim.buildGrid();
    const coh = { group: [], loose: [], mixed: [] };
    for (let cc = 0; cc < sim.G ** 3; cc++) {
      const ids = Array.from(sim.cellItems.subarray(sim.cellStart[cc], sim.cellStart[cc + 1]));
      if (ids.length < 3) continue;
      const m = avg(ids, key, D);
      let mm = 0, kk = 0;
      for (let a = 0; a < D; a++) mm += m[a] * m[a];
      for (const i of ids) for (let a = 0; a < D; a++) kk += sim.k[i * D + a] ** 2 / ids.length;
      const votes = new Map();
      for (const i of ids) if (groupOf[i] >= 0 && sizeOf[i] >= 4) votes.set(groupOf[i], (votes.get(groupOf[i]) || 0) + 1);
      const top = Math.max(0, ...votes.values());
      const loose = ids.filter((i) => deg[i] === 0).length;
      (top >= 0.75 * ids.length ? coh.group : loose >= 0.75 * ids.length ? coh.loose : coh.mixed).push(mm / kk);
    }
    const standout = Object.fromEntries(Object.entries(coh).map(([k, v]) => [k, { cells: v.length, agree: round(mean(v)) }]));

    const byShape = { chain: 0, ring: 0, tree: 0, sheet: 0, blob: 0 };
    for (const g of groups) byShape[g.cls] += g.size;
    const rep = repeats(groups);
    parentPort.postMessage({
      ...job,
      farShare: farN ? round(farShare / farN, 4) : 0,
      temperature: round(sim.temperature(), 4),
      bondedShare: round(c.bondedShare), groups: groups.length, largest: c.largest, sorting: round(c.sorting),
      shapes: Object.fromEntries(Object.entries(byShape).map(([k, v]) => [k, round(v / N)])),
      structures: groups.filter((g) => g.size >= MIN).length,
      repeatKinds: rep.kinds, repeatMembers: rep.members, repeatSeries: series, splits,
      units, blend, standout,
      worstExcess: round(worstExcess, 3),
      hash: sim.hash(),
    });
  });
}
