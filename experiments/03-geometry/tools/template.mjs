// The template probe: build a long chain by hand, drop it into a settled soup, and watch whether
// loose particles stick along its sides in order and link up into a second chain.
//
// For each law, the strongest chain the law allows is found by search: a repeat of one or two
// elements, each using one face to bond backward and one to bond forward. Opposite faces make a
// straight run; perpendicular faces make a right-angle zigzag. The world runs for SETTLE ticks so
// genomes settle and the soup cools, then the chain replaces CHAIN particles (their genomes set to
// the elements, at rest, faces turned to bond) and anything in its way is moved aside. Nothing
// else is changed: the law runs as usual. Measuring only.
//
// Usage: node tools/template.mjs > template-results.json
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import { Sim, S, D, FAST, dtanh, rng } from '../sim.js';

const SETTLE = Number(process.env.SETTLE) || 1500;
const WATCH = Number(process.env.WATCH) || 3000;
const EVERY = 100;
const CHAIN = 14;
const SPACING = 0.4;
const N = 1500;
const LAWS = process.env.LAWLIST ? process.env.LAWLIST.split(',').map(Number) : Array.from({ length: Number(process.env.LAWS) || 12 }, (_, i) => i + 1);
// LADDER=1 builds, instead of the strongest chain, a straight run of the element best placed to
// hold a partner strand: one that bonds to itself, with two opposite sticky faces and a third.
const LADDER = process.env.LADDER === '1';
// ISOLATE=1 turns every other particle into the element that bonds least with the chain, to see
// whether the chain falls apart on its own (heat) or because the soup pulls it apart.
const ISOLATE = process.env.ISOLATE === '1';
const WORLDS = [1, 2];
const FACE = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const NU = (SPACING * SPACING) / (SPACING * SPACING + 0.15 * 0.15);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Each element's face stickiness and every pair's genome match, as the sim computes them.
function chemistry(sim) {
  const els = sim.elements.map((e, idx) => ({ ...e, idx })).filter((e) => e.basin >= 0.02);
  const w = els.map((e) => FACE.map((_, k) => {
    let x = 0;
    for (let b = 0; b < S; b++) x += sim.A[k * S + b] * e.g[b];
    return (1 + dtanh(x)) / 2;
  }));
  const gm = els.map((a) => els.map((b) => {
    let x = 0;
    for (let p = 0; p < S; p++) for (let q = 0; q < S; q++) x += a.g[p] * sim.M[p * S + q] * b.g[q];
    return x;
  }));
  return { els, w, gm };
}

// The strongest chain: a repeat of one element, or of two alternating, each with a back face and
// a forward face. Scored by its weakest bond.
function bestChain({ els, w, gm }) {
  const faces = [];
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) if (a !== b) faces.push([a, b]);
  const bond = (x, fx, y, fy) => dtanh(gm[x][y] * w[x][fx[1]] * w[y][fy[0]] * NU);
  let best = null;
  const K = els.length;
  for (let x = 0; x < K; x++) for (let y = x; y < K; y++) {
    for (const fx of faces) for (const fy of x === y ? [fx] : faces) {
      const s = x === y ? bond(x, fx, x, fx) : Math.min(bond(x, fx, y, fy), bond(y, fy, x, fx));
      if (!best || s > best.score) best = { score: s, pattern: x === y ? [x] : [x, y], faces: x === y ? [fx] : [fx, fy] };
    }
  }
  return best;
}

// A straight run of one element with a sticky side face, the simplest chain that could hold a
// copy of itself alongside: the same element can stick to the side and link up the same way.
function ladderChain({ els, w, gm }) {
  let best = null;
  for (let a = 0; a < els.length; a++) {
    for (const [p, q] of [[0, 1], [2, 3], [4, 5]]) {
      const side = Math.max(...[0, 1, 2, 3, 4, 5].filter((k) => k !== p && k !== q).map((k) => w[a][k]));
      const s = Math.min(dtanh(gm[a][a] * w[a][p] * w[a][q] * NU), dtanh(gm[a][a] * side * side * NU));
      if (!best || s > best.score) best = { score: s, pattern: [a], faces: [[q, p]] };
    }
  }
  return best;
}

// Rotation (body to world) sending body axes b1, b2 to world axes w1, w2; as a quaternion.
function orient(b1, b2, w1, w2) {
  const b3 = cross(b1, b2), w3 = cross(w1, w2);
  const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) R[r][c] = w1[r] * b1[c] + w2[r] * b2[c] + w3[r] * b3[c];
  const tr = R[0][0] + R[1][1] + R[2][2];
  let qw, qx, qy, qz;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    qw = s / 4; qx = (R[2][1] - R[1][2]) / s; qy = (R[0][2] - R[2][0]) / s; qz = (R[1][0] - R[0][1]) / s;
  } else if (R[0][0] > R[1][1] && R[0][0] > R[2][2]) {
    const s = Math.sqrt(1 + R[0][0] - R[1][1] - R[2][2]) * 2;
    qw = (R[2][1] - R[1][2]) / s; qx = s / 4; qy = (R[0][1] + R[1][0]) / s; qz = (R[0][2] + R[2][0]) / s;
  } else if (R[1][1] > R[2][2]) {
    const s = Math.sqrt(1 + R[1][1] - R[0][0] - R[2][2]) * 2;
    qw = (R[0][2] - R[2][0]) / s; qx = (R[0][1] + R[1][0]) / s; qy = s / 4; qz = (R[1][2] + R[2][1]) / s;
  } else {
    const s = Math.sqrt(1 + R[2][2] - R[0][0] - R[1][1]) * 2;
    qw = (R[1][0] - R[0][1]) / s; qx = (R[0][2] + R[2][0]) / s; qy = (R[1][2] + R[2][1]) / s; qz = s / 4;
  }
  const l = Math.hypot(qw, qx, qy, qz);
  return [qw / l, qx / l, qy / l, qz / l];
}

// Lay the chain out: a turtle walking in the x-y plane. A particle whose back and forward faces
// are opposite carries straight on; perpendicular faces turn it 90 degrees, alternating left and
// right so the chain keeps heading the same way overall (a zigzag).
function layout(chain, sim) {
  const out = [];
  const bent = chain.faces.some(([b, fw]) => dot(FACE[b], FACE[fw]) > -0.5);
  const r45 = Math.SQRT1_2;
  let u = bent ? [r45, -r45, 0] : [1, 0, 0], turn = 1;
  const c = sim.L / 2;
  let p = [0, 0, 0];
  for (let t = 0; t < CHAIN; t++) {
    const e = chain.pattern[t % chain.pattern.length];
    const [fb, ff] = chain.faces[t % chain.pattern.length];
    const back = FACE[fb], fwd = FACE[ff];
    const opposite = dot(back, fwd) < -0.5;
    // Straight on, or a right-angle turn in the x-y plane, alternating left and right.
    const next = opposite ? u : [-turn * u[1], turn * u[0], 0];
    if (!opposite) turn = -turn;
    let q;
    if (opposite) {
      // Roll is free: send a body axis perpendicular to the bond to world +z.
      const side = FACE.find((f) => Math.abs(dot(f, fwd)) < 0.5);
      q = orient(fwd, side, next, [0, 0, 1]);
    } else {
      // Back face toward the previous particle, forward face toward the next.
      q = orient(back, fwd, [-u[0], -u[1], -u[2]], next);
    }
    out.push({ e, pos: p.slice(), rot: q });
    p = [p[0] + SPACING * next[0], p[1] + SPACING * next[1], 0];
    u = next;
  }
  // Center it in the box.
  const m = [0, 0];
  for (const o of out) { m[0] += o.pos[0]; m[1] += o.pos[1]; }
  for (const o of out) { o.pos[0] += c - m[0] / CHAIN; o.pos[1] += c - m[1] / CHAIN; o.pos[2] = c; }
  return out;
}

function wrapD(sim, i, j) {
  const L = sim.L, h = L / 2;
  let dx = sim.pos[j * 3] - sim.pos[i * 3], dy = sim.pos[j * 3 + 1] - sim.pos[i * 3 + 1];
  const dz = sim.pos[j * 3 + 2] - sim.pos[i * 3 + 2];
  if (dx > h) dx -= L; else if (dx < -h) dx += L;
  if (dy > h) dy -= L; else if (dy < -h) dy += L;
  return [dx, dy, dz];
}

// Drop the chain in: CHAIN particles become it; anything within CLEAR of it moves elsewhere.
function insert(sim, laid, els, seed) {
  const r = rng(seed);
  const ids = [];
  for (let t = 0; t < CHAIN; t++) ids.push(t * Math.floor(sim.n / CHAIN));
  const CLEAR = 0.6;
  const near = (x, y, z) => laid.some((o) => {
    let dx = x - o.pos[0], dy = y - o.pos[1];
    const dz = z - o.pos[2], h = sim.L / 2;
    if (dx > h) dx -= sim.L; else if (dx < -h) dx += sim.L;
    if (dy > h) dy -= sim.L; else if (dy < -h) dy += sim.L;
    return dx * dx + dy * dy + dz * dz < CLEAR * CLEAR;
  });
  ids.forEach((i, t) => {
    const o = laid[t];
    for (let a = 0; a < 3; a++) { sim.pos[i * 3 + a] = o.pos[a]; sim.vel[i * 3 + a] = 0; sim.spin[i * 3 + a] = 0; }
    for (let a = 0; a < 4; a++) sim.rot[i * 4 + a] = o.rot[a];
    for (let b = 0; b < S; b++) sim.s[i * D + FAST + b] = els[o.e].g[b];
  });
  const isChain = new Uint8Array(sim.n);
  for (const i of ids) isChain[i] = 1;
  for (let i = 0; i < sim.n; i++) {
    if (isChain[i]) continue;
    while (near(sim.pos[i * 3], sim.pos[i * 3 + 1], sim.pos[i * 3 + 2])) {
      sim.pos[i * 3] = r() * sim.L; sim.pos[i * 3 + 1] = r() * sim.L; sim.pos[i * 3 + 2] = 0.2 + r() * (sim.L - 0.4);
    }
  }
  return ids;
}

// What is stuck to the chain right now.
function look(sim, ids, els) {
  sim.census();
  const adj = Array.from({ length: sim.n }, () => new Set());
  for (let b = 0; b < sim.bondCount; b++) { adj[sim.bondA[b]].add(sim.bondB[b]); adj[sim.bondB[b]].add(sim.bondA[b]); }
  const inChain = new Set(ids);
  let intact = 0;
  for (let t = 0; t + 1 < ids.length; t++) if (adj[ids[t]].has(ids[t + 1])) intact++;
  // Side partners: bonded to a chain member, not part of the chain.
  const partners = ids.map((i) => [...adj[i]].filter((j) => !inChain.has(j)));
  const occupied = partners.filter((p) => p.length).length;
  // A copy: a run of consecutive chain members whose partners are bonded to each other in turn.
  // A clean copy also requires each partner to be chain-like itself (at most two bonds to
  // anything but the template), so a blob stuck to the side does not count.
  const loose = (a) => [...adj[a]].filter((j) => !inChain.has(j)).length <= 2;
  const longest = (ok) => {
    let run = 0, best = 0;
    for (let t = 0; t + 1 < ids.length; t++) {
      const linked = partners[t].some((a) => ok(a) && partners[t + 1].some((b) => a !== b && ok(b) && adj[a].has(b)));
      run = linked ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best ? best + 1 : 0;
  };
  const copy = longest(() => true), clean = longest(loose);
  // Which element sits beside which: template element -> partner element counts.
  const pairs = {};
  ids.forEach((i, t) => {
    for (const j of partners[t]) {
      const key = `${sim.kind[i]}>${sim.kind[j]}`;
      pairs[key] = (pairs[key] || 0) + 1;
    }
  });
  // For comparison: the longest chain the soup made on its own, away from the template.
  let soupChain = 0;
  for (const g of sim.shapes(2)) {
    if (g.cls !== 'chain' || g.members.some((i) => inChain.has(i))) continue;
    soupChain = Math.max(soupChain, g.size);
  }
  return { intact: +(intact / (ids.length - 1)).toFixed(2), occupied, copy, clean, pairs, soupChain, temperature: +sim.temperature().toFixed(4) };
}

if (isMainThread) {
  const jobs = [];
  for (const lawSeed of LAWS) for (const worldSeed of WORLDS) jobs.push({ lawSeed, worldSeed });
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, os.cpus().length) }, () => new Promise((done) => {
    const w = new Worker(new URL(import.meta.url));
    const feed = () => (next < jobs.length ? w.postMessage(jobs[next++]) : (w.terminate(), done()));
    w.on('message', (r) => { results.push(r); process.stderr.write(`${results.length}/${jobs.length}\n`); feed(); });
    feed();
  })));
  results.sort((a, b) => a.lawSeed - b.lawSeed || a.worldSeed - b.worldSeed);
  process.stdout.write(JSON.stringify({ settle: SETTLE, watch: WATCH, chain: CHAIN, results }, null, 1));
} else {
  parentPort.on('message', (job) => {
    const sim = new Sim({ ...job, n: N });
    const chem = chemistry(sim);
    const chain = LADDER ? ladderChain(chem) : bestChain(chem);
    for (let t = 0; t < SETTLE; t++) sim.step();
    const laid = layout(chain, sim);
    // Element indices in the chain refer to chem.els; census kinds refer to sim.elements.
    const ids = insert(sim, laid, chem.els, job.lawSeed * 7919 + job.worldSeed);
    if (ISOLATE) {
      let inert = 0, low = Infinity;
      chem.els.forEach((_, x) => { const m = Math.max(...chain.pattern.map((y) => chem.gm[x][y])); if (m < low) { low = m; inert = x; } });
      const keep = new Set(ids);
      for (let i = 0; i < sim.n; i++) if (!keep.has(i)) for (let b = 0; b < S; b++) sim.s[i * D + FAST + b] = chem.els[inert].g[b];
    }
    const series = [];
    for (let t = 1; t <= WATCH; t++) {
      sim.step();
      if (t === 1 || t % EVERY === 0) series.push({ t, ...look(sim, ids, chem.els) });
    }
    const f = FACE.map((v) => (v[0] ? (v[0] > 0 ? '+x' : '-x') : v[1] ? (v[1] > 0 ? '+y' : '-y') : v[2] > 0 ? '+z' : '-z'));
    parentPort.postMessage({
      ...job,
      chain: {
        elements: chain.pattern.map((x) => chem.els[x].idx),
        faces: chain.faces.map(([b, fw]) => `${f[b]}/${f[fw]}`),
        bond: +chain.score.toFixed(3),
      },
      faces: chem.els.map((e, a) => ({ el: e.idx, w: chem.w[a].map((x) => +x.toFixed(2)) })),
      match: chem.gm.map((r) => r.map((x) => +x.toFixed(2))),
      series,
    });
  });
}
