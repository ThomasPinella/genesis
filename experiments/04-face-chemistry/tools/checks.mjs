// Three cheap checks toward multiplying, run on ordinary face-chemistry worlds. Nothing here
// changes the world; it only watches.
//
//   splits:   when a group breaks in two, does each half keep the parent's mix of elements, more
//             than a group picked at random would? And do the halves then grow back?
//   convert:  when a particle joins a group of another element, does its genome turn into the
//             group's element (the group recruiting it), or does it leave or stay as it was?
//   shape:    does the fast state (the part of the state that listens to neighbors every tick)
//             differ by where a particle sits in its group, and does a group's average state tell
//             apart two groups with the same members arranged differently? If so, a coarse-grained
//             blend would see shape, not just makeup.
//
// Usage: PARTIAL=partial.jsonl node tools/checks.mjs > checks-results.json
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import { Sim, D, FAST, S } from '../sim.js';

const TICKS = Number(process.env.TICKS) || 4000;
const N = 1500;
const LAWS = process.env.LAWLIST ? process.env.LAWLIST.split(',').map(Number) : Array.from({ length: 12 }, (_, i) => i + 1);
const WORLDS = process.env.WORLDS ? process.env.WORLDS.split(',').map(Number) : [1, 2];
const START = 500;    // ticks before watching, so the first rush of bonding is over
const LOOK = 25;      // ticks between looks
const HOLD = 100;     // a split counts only if the halves are still apart this long after
const LATER = 500;    // ticks after a split to see whether the halves grew back
const SETTLE = 200;   // ticks after joining to see what became of a joiner
const PARENT = 8;     // smallest group whose splits count
const HALF = 3;       // smallest half

const round = (x, d = 3) => (x === null || Number.isNaN(x) ? null : +x.toFixed(d));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

// A group's mix: the share of its members of each kind (the last kind is "unsettled").
function mix(ids, kind, kinds) {
  const m = new Float64Array(kinds);
  for (const i of ids) m[kind[i]] += 1 / ids.length;
  return m;
}
// How alike two mixes are: 1 when the same, 0 when they share no kind.
const alike = (a, b) => { let d = 0; for (let k = 0; k < a.length; k++) d += Math.abs(a[k] - b[k]); return 1 - d / 2; };

function rngLocal(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function watch(job) {
  const sim = new Sim({ ...job, n: N });
  const kinds = sim.elements.length + 1;
  const r = rngLocal(job.lawSeed * 1000 + job.worldSeed);
  const groupOf = new Int32Array(N).fill(-1);
  let prev = null;             // last look: groupOf copy and groups by root
  const pendingSplits = [];    // splits waiting to be confirmed, then followed up
  const splits = [];
  const pendingJoins = [];
  const joins = [];
  const joining = new Set();

  const look = (t) => {
    sim.census();
    const groups = sim.shapes(3);
    groupOf.fill(-1);
    const byRoot = new Map();
    for (const g of groups) { for (const i of g.members) groupOf[i] = g.root; byRoot.set(g.root, g); }
    const now = { groupOf: Int32Array.from(groupOf), byRoot, groups };

    // Confirm or follow up earlier splits.
    for (let s = pendingSplits.length - 1; s >= 0; s--) {
      const e = pendingSplits[s];
      const home = (ids) => { const v = new Map(); for (const i of ids) if (groupOf[i] >= 0) v.set(groupOf[i], (v.get(groupOf[i]) || 0) + 1); let b = -1, bv = 0; for (const [k, c] of v) if (c > bv) { bv = c; b = k; } return bv * 2 >= ids.length ? b : -1; };
      if (!e.confirmed && t >= e.t + HOLD) {
        const ha = home(e.a), hb = home(e.b);
        if (ha < 0 || hb < 0 || ha === hb) { pendingSplits.splice(s, 1); continue; }
        e.confirmed = true;
      }
      if (e.confirmed && t >= e.t + LATER) {
        const grow = [];
        const homes = [home(e.a), home(e.b)];
        // Halves back in one group have only joined up again, which is not multiplying.
        e.rejoined = homes[0] >= 0 && homes[0] === homes[1];
        [e.a, e.b].forEach((half, k) => {
          const h = homes[k];
          if (h < 0) { grow.push({ size: 0, alike: null, ofParent: 0 }); return; }
          const g = byRoot.get(h);
          grow.push({ size: g.size / half.length, ofParent: g.size / e.parent, alike: alike(mix(g.members, sim.kind, kinds), e.parentMix) });
        });
        e.later = grow;
        splits.push(e);
        pendingSplits.splice(s, 1);
      }
    }
    // Follow up joiners.
    for (let s = pendingJoins.length - 1; s >= 0; s--) {
      const e = pendingJoins[s];
      if (t < e.t + SETTLE) continue;
      const g = groupOf[e.i] >= 0 ? byRoot.get(groupOf[e.i]) : null;
      // Still with the group it joined: most of that group's old members are in its group now.
      let stayed = false;
      if (g) { let c = 0; for (const j of e.hosts) if (groupOf[j] === groupOf[e.i]) c++; stayed = c * 2 >= e.hosts.length; }
      const after = sim.kind[e.i];
      let dist = 0;
      for (let a = 0; a < S; a++) dist += (sim.s[e.i * D + FAST + a] - e.hostG[a]) ** 2;
      joining.delete(e.i);
      joins.push({ from: e.from, host: e.host, to: after, stayed, d0: e.d0, d1: Math.sqrt(dist), hostSize: e.hostSize });
      pendingJoins.splice(s, 1);
    }

    if (prev && t > START) {
      // Splits: two or more groups now, each mostly made of one group from the last look.
      const children = new Map();
      for (const g of groups) {
        if (g.size < HALF) continue;
        const v = new Map();
        for (const i of g.members) if (prev.groupOf[i] >= 0) v.set(prev.groupOf[i], (v.get(prev.groupOf[i]) || 0) + 1);
        let b = -1, bv = 0;
        for (const [k, c] of v) if (c > bv) { bv = c; b = k; }
        if (b < 0 || bv * 2 < g.size) continue;
        if (!children.has(b)) children.set(b, []);
        children.get(b).push(g);
      }
      for (const [root, kids] of children) {
        const p = prev.byRoot.get(root);
        if (!p || p.size < PARENT || kids.length < 2) continue;
        kids.sort((x, y) => y.size - x.size);
        const [a, b] = kids;
        const pm = prev.mix.get(root);
        // Chance: a group of the same size picked from all grouped particles at random, and a half
        // drawn at random from the parent itself (which keeps the mix only by sampling).
        const pool = [];
        for (const g of groups) for (const i of g.members) pool.push(i);
        const pick = (from, k) => { const c = from.slice(); for (let x = 0; x < k; x++) { const y = x + Math.floor(r() * (c.length - x)); [c[x], c[y]] = [c[y], c[x]]; } return c.slice(0, k); };
        const randWorld = [], randParent = [];
        for (const kid of [a, b]) for (let rep = 0; rep < 20; rep++) {
          randWorld.push(alike(mix(pick(pool, kid.size), sim.kind, kinds), pm));
          randParent.push(alike(mix(pick(p.membersAtLook, kid.size), prev.kindAtLook, kinds), pm));
        }
        pendingSplits.push({
          t, parent: p.size, sizes: [a.size, b.size], cls: p.cls,
          a: a.members.slice(), b: b.members.slice(), parentMix: pm,
          alike: [alike(mix(a.members, sim.kind, kinds), pm), alike(mix(b.members, sim.kind, kinds), pm)],
          chanceWorld: mean(randWorld), chanceParent: mean(randParent),
          // Identical halves: same arrangement of elements.
          same: a.sig === b.sig,
        });
      }
      // Joiners: a particle in a group of at least 4 now, most of whose other members were
      // together at the last look, when this particle was not with them.
      for (const g of groups) {
        if (g.size < 4) continue;
        const v = new Map();
        for (const i of g.members) if (prev.groupOf[i] >= 0) v.set(prev.groupOf[i], (v.get(prev.groupOf[i]) || 0) + 1);
        let core = -1, cv = 0;
        for (const [k, c] of v) if (c > cv) { cv = c; core = k; }
        if (core < 0 || cv < 3) continue;
        const hosts = g.members.filter((j) => prev.groupOf[j] === core);
        for (const i of g.members) {
          if (prev.groupOf[i] === core || joining.has(i)) continue;
          const hm = mix(hosts, sim.kind, kinds);
          let host = 0;
          for (let k = 1; k < kinds; k++) if (hm[k] > hm[host]) host = k;
          const hostG = new Float64Array(S);
          for (const j of hosts) for (let a = 0; a < S; a++) hostG[a] += sim.s[j * D + FAST + a] / hosts.length;
          let d0 = 0;
          for (let a = 0; a < S; a++) d0 += (sim.s[i * D + FAST + a] - hostG[a]) ** 2;
          joining.add(i);
          pendingJoins.push({ t, i, from: sim.kind[i], host, hosts, hostG, d0: Math.sqrt(d0), hostSize: g.size });
        }
      }
    }
    const mixes = new Map();
    for (const g of groups) { mixes.set(g.root, mix(g.members, sim.kind, kinds)); g.membersAtLook = g.members; }
    now.mix = mixes;
    now.kindAtLook = Int16Array.from(sim.kind);
    prev = now;
    return groups;
  };

  for (let t = 1; t <= TICKS; t++) {
    sim.step();
    if (t % LOOK === 0 && t >= START - LOOK) look(t);
  }
  const groups = look(TICKS + LOOK);

  // ---- shape in the fast state, at the end ----
  const deg = new Int32Array(N);
  for (let b = 0; b < sim.bondCount; b++) { deg[sim.bondA[b]]++; deg[sim.bondB[b]]++; }
  const fast = (i) => Array.from(sim.s.subarray(i * D, i * D + FAST));
  const slow = (i) => Array.from(sim.s.subarray(i * D + FAST, i * D + D));
  // Share of fast-state spread, within each element, explained by a label; against the same
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
  const rows = [];
  const cls = new Map(groups.map((g) => [g.root, g.cls]));
  for (let i = 0; i < N; i++) {
    rows.push({ kind: sim.kind[i], f: fast(i), deg: Math.min(deg[i], 3), group: groupOf[i], cls: groupOf[i] >= 0 ? cls.get(groupOf[i]) : 'loose' });
  }
  const grouped = rows.filter((x) => x.group >= 0);
  const chainish = grouped.filter((x) => x.cls === 'chain');
  const shape = {
    byBonds: explained(grouped, (x) => x.deg),            // ends vs middles vs branch points
    byChainPlace: explained(chainish, (x) => x.deg),       // chain ends vs chain middles
    byShape: explained(grouped, (x) => x.cls),
    byGroup: explained(grouped, (x) => x.group),
    loose: explained(rows, (x) => (x.group >= 0 ? 1 : 0)),
  };
  // Same members, different arrangement: pairs of groups with the same multiset of elements.
  // Compare how far apart their average fast states are when the arrangement is the same versus
  // when it differs, and the same for average genomes.
  const avg = (ids, get, len) => { const m = new Float64Array(len); for (const i of ids) { const v = get(i); for (let a = 0; a < len; a++) m[a] += v[a] / ids.length; } return m; };
  const dist = (a, b) => { let d = 0; for (let k = 0; k < a.length; k++) d += (a[k] - b[k]) ** 2; return Math.sqrt(d); };
  const byMakeup = new Map();
  for (const g of groups) {
    if (g.size < 4) continue;
    const key = g.members.map((i) => sim.kind[i]).sort((x, y) => x - y).join(',');
    if (!byMakeup.has(key)) byMakeup.set(key, []);
    byMakeup.get(key).push({ sig: g.sig, f: avg(g.members, fast, FAST), g: avg(g.members, slow, S) });
  }
  const sameF = [], diffF = [], sameG = [], diffG = [];
  for (const [, list] of byMakeup) for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
    const same = list[x].sig === list[y].sig;
    (same ? sameF : diffF).push(dist(list[x].f, list[y].f));
    (same ? sameG : diffG).push(dist(list[x].g, list[y].g));
  }
  const blend = { pairsSame: sameF.length, pairsDiff: diffF.length, fastSame: round(mean(sameF)), fastDiff: round(mean(diffF)), genomeSame: round(mean(sameG)), genomeDiff: round(mean(diffG)) };

  // ---- summaries ----
  const confirmed = splits;
  const big = confirmed.filter((e) => e.sizes[1] >= 0.3 * e.parent);
  const sumSplits = (list) => ({
    count: list.length,
    parent: round(mean(list.map((e) => e.parent)), 1),
    halves: round(mean(list.flatMap((e) => e.sizes)), 1),
    alike: round(mean(list.flatMap((e) => e.alike))),
    chanceWorld: round(mean(list.map((e) => e.chanceWorld))),
    chanceParent: round(mean(list.map((e) => e.chanceParent))),
    identical: list.filter((e) => e.same).length,
    // LATER ticks on: halves back in one group; halves apart and each in a group at least 1.5
    // times its size with a mix still close to the parent's; and splits where both halves did
    // that and each is now at least three quarters of the parent's size, so one group like the
    // parent became two.
    rejoined: list.filter((e) => e.rejoined).length,
    grewBack: list.reduce((c, e) => c + (e.rejoined ? 0 : e.later.filter((h) => h.size >= 1.5 && h.alike !== null && h.alike >= 0.8).length), 0),
    multiplied: list.filter((e) => !e.rejoined && e.later.every((h) => h.ofParent >= 0.75 && h.alike !== null && h.alike >= 0.8)).length,
    halvesFollowed: list.length * 2,
    gone: list.reduce((c, e) => c + e.later.filter((h) => h.size === 0).length, 0),
  });
  const unsettled = kinds - 1;
  const foreign = joins.filter((e) => e.from !== e.host && e.host !== unsettled);
  const stayedForeign = foreign.filter((e) => e.stayed);
  const native = joins.filter((e) => e.from === e.host);
  const convert = {
    joins: joins.length,
    foreign: foreign.length,
    foreignStayed: stayedForeign.length,
    // Of foreign joiners that stayed, how many turned into the host's element, stayed what they
    // were, or became something else (unsettled included).
    turned: stayedForeign.filter((e) => e.to === e.host).length,
    kept: stayedForeign.filter((e) => e.to === e.from).length,
    other: stayedForeign.filter((e) => e.to !== e.host && e.to !== e.from).length,
    // Did genomes move toward the host's average genome?
    closer: round(mean(stayedForeign.map((e) => e.d1 - e.d0))),
    nativeStayed: native.filter((e) => e.stayed).length,
    nativeLost: native.filter((e) => e.stayed && e.to !== e.host).length,
    fromUnsettled: joins.filter((e) => e.from === unsettled && e.stayed).length,
    unsettledTurned: joins.filter((e) => e.from === unsettled && e.stayed && e.to === e.host && e.host !== unsettled).length,
  };
  return {
    ...job, ticks: TICKS, elements: sim.elements.length,
    splits: sumSplits(confirmed), bigSplits: sumSplits(big),
    convert, shape, blend,
    examples: big.slice(0, 5).map((e) => ({ t: e.t, parent: e.parent, sizes: e.sizes, cls: e.cls, alike: e.alike.map((v) => round(v)), rejoined: e.rejoined, later: e.later.map((h) => ({ size: round(h.size, 2), alike: round(h.alike) })) })),
    hash: sim.hash(),
  };
}

if (isMainThread) {
  const jobs = [];
  for (const lawSeed of LAWS) for (const worldSeed of WORLDS) jobs.push({ lawSeed, worldSeed });
  const partial = process.env.PARTIAL;
  const results = partial && fs.existsSync(partial) ? fs.readFileSync(partial, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const done = new Set(results.map((x) => x.lawSeed + '/' + x.worldSeed));
  const todo = jobs.filter((j) => !done.has(j.lawSeed + '/' + j.worldSeed));
  const total = results.length + todo.length;
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, os.cpus().length) }, () => new Promise((fin) => {
    const w = new Worker(new URL(import.meta.url));
    const feed = () => (next < todo.length ? w.postMessage(todo[next++]) : (w.terminate(), fin()));
    w.on('message', (x) => { results.push(x); if (partial) fs.appendFileSync(partial, JSON.stringify(x) + '\n'); process.stderr.write(`${results.length}/${total}\n`); feed(); });
    feed();
  })));
  results.sort((a, b) => a.lawSeed - b.lawSeed || a.worldSeed - b.worldSeed);
  process.stdout.write(JSON.stringify({ ticks: TICKS, n: N, worlds: WORLDS, results }, null, 1));
} else {
  parentPort.on('message', (job) => parentPort.postMessage(watch(job)));
}
