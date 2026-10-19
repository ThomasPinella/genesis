// The template probe's parts, shared by tools/template.mjs and the page: read a law's face
// chemistry, pick a chain worth testing, lay it out with its faces turned to bond, drop it into a
// world, free building blocks around it, and look at what has stuck to it. Measuring only; the
// law itself is never changed.
import { S, D, FAST, dtanh, rng } from './sim.js';

export const CHAIN = 14;
export const SPACING = 0.4;
export const FACE = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const OPP = [[0, 1], [2, 3], [4, 5]];
const NU = (SPACING * SPACING) / (SPACING * SPACING + 0.15 * 0.15);
const STRONG = 0.5;  // a face-to-face match this high counts as a bond for the chain searches

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Each element's view through each face, and the match between any two faces of any two elements,
// as the sim computes them when the faces point straight at each other.
export function chemistry(sim) {
  sim.project();
  const els = sim.elements.map((e, idx) => ({ ...e, idx })).filter((e) => e.basin >= 0.02);
  const h = els.map((e) => FACE.map((_, f) => {
    const o = [];
    for (let a = 0; a < S; a++) { let x = 0; for (let b = 0; b < S; b++) x += sim.lens[(f * S + a) * S + b] * e.g[b]; o.push(x); }
    return o;
  }));
  const mt = (x, f, y, g) => { let v = 0; for (let p = 0; p < S; p++) for (let q = 0; q < S; q++) v += h[x][f][p] * sim.M[p * S + q] * h[y][g][q]; return v; };
  const K = els.length;
  const m = [];
  for (let x = 0; x < K; x++) { m.push([]); for (let f = 0; f < 6; f++) { m[x].push([]); for (let y = 0; y < K; y++) { m[x][f].push([]); for (let g = 0; g < 6; g++) m[x][f][y].push(mt(x, f, y, g)); } } }
  const best = els.map((_, x) => els.map((_, y) => { let b = -Infinity; for (let f = 0; f < 6; f++) for (let g = 0; g < 6; g++) b = Math.max(b, m[x][f][y][g]); return b; }));
  return { els, m, best };
}

// The strongest chain: one element, or two alternating, each with a back face and a forward face.
// Scored by its weakest bond.
export function bestChain({ els, m }) {
  const pairs = [];
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) if (a !== b) pairs.push([a, b]);
  const bond = (x, fx, y, fy) => dtanh(m[x][fx[1]][y][fy[0]] * NU);
  let best = null;
  for (let x = 0; x < els.length; x++) for (let y = x; y < els.length; y++) {
    for (const fx of pairs) for (const fy of x === y ? [fx] : pairs) {
      const sc = x === y ? bond(x, fx, x, fx) : Math.min(bond(x, fx, y, fy), bond(y, fy, x, fx));
      if (!best || sc > best.score) best = { score: sc, seq: x === y ? [x] : [x, y], faces: { [x]: fx, [y]: fy } };
    }
  }
  return best;
}

// A straight run of one element whose spine bonds to its own kind and whose side face (turned up)
// also bonds to its own kind, more weakly, so a copy alongside could let go.
export function ladderChain({ els, m }) {
  let best = null;
  for (let a = 0; a < els.length; a++) for (const [p, q] of OPP) for (const [b, f] of [[p, q], [q, p]]) {
    const spine = m[a][f][a][b];
    for (let sd = 0; sd < 6; sd++) {
      if (sd === p || sd === q) continue;
      const side = m[a][sd][a][sd];
      if (side <= 0.25 || side >= spine) continue;
      const sc = Math.min(dtanh(spine * NU), dtanh(side * NU));
      if (!best || sc > best.score) best = { score: sc, seq: [a], faces: { [a]: [b, f, sd] } };
    }
  }
  return best;
}

// Two letters a, b sharing a straight spine (all four spine bonds strong), whose side faces prefer
// each other over their own kind: a b sits beside an a and an a beside a b. Laid in a fixed random
// order, so a faithful copy would carry the complementary order.
export function codeChain({ els, m }) {
  let best = null;
  for (let a = 0; a < els.length; a++) for (let b = a + 1; b < els.length; b++) {
    for (const [p, q] of OPP) for (const [bk, fw] of [[p, q], [q, p]]) {
      const spine = Math.min(m[a][fw][a][bk], m[a][fw][b][bk], m[b][fw][a][bk], m[b][fw][b][bk]);
      if (spine < STRONG) continue;
      for (let sd = 0; sd < 6; sd++) {
        if (sd === p || sd === q) continue;
        const ab = m[a][sd][b][sd], self = Math.max(m[a][sd][a][sd], m[b][sd][b][sd]);
        const sc = Math.min(spine - ab, ab - self);
        if (ab <= 0.25 || sc <= 0) continue;
        if (!best || sc > best.score) best = { score: sc, letters: [a, b], faces: { [a]: [bk, fw, sd], [b]: [bk, fw, sd] }, spine, ab, self };
      }
    }
  }
  if (!best) return null;
  const r = rng(12345);
  best.seq = Array.from({ length: CHAIN }, () => best.letters[r() < 0.5 ? 0 : 1]);
  best.full = true;
  return best;
}

// The strongest code by a stricter test (experiment 5's law search): the spine must beat the right
// side bond, and the right side bond must beat any wrong one, where wrong is the same letter at that
// side face through any of its faces. The gap is the smaller of the two margins.
export function strictCode({ els, m }) {
  let best = null;
  for (let a = 0; a < els.length; a++) for (let b = a + 1; b < els.length; b++) {
    for (const [p, q] of OPP) for (const [bk, fw] of [[p, q], [q, p]]) {
      const spine = Math.min(m[a][fw][a][bk], m[a][fw][b][bk], m[b][fw][a][bk], m[b][fw][b][bk]);
      for (let sd = 0; sd < 6; sd++) {
        if (sd === p || sd === q) continue;
        const right = m[a][sd][b][sd];
        let wrong = -Infinity;
        for (let g = 0; g < 6; g++) wrong = Math.max(wrong, m[a][sd][a][g], m[b][sd][b][g]);
        const gap = Math.min(spine - right, right - wrong);
        if (!best || gap > best.gap) best = { gap, score: gap, spine, right, wrong, letters: [a, b], faces: { [a]: [bk, fw, sd], [b]: [bk, fw, sd] } };
      }
    }
  }
  if (!best) return null;
  const r = rng(12345);
  best.seq = Array.from({ length: CHAIN }, () => best.letters[r() < 0.5 ? 0 : 1]);
  best.full = true;
  return best;
}

// Rotation (body to world) sending body axes b1, b2 to world axes w1, w2; as a quaternion.
export function orient(b1, b2, w1, w2) {
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
// are opposite carries straight on, its side face (if it has one) turned up; perpendicular faces
// turn it 90 degrees, alternating left and right so the chain keeps heading the same way (a
// zigzag).
export function layout(chain, sim) {
  const out = [];
  const at = (t) => (chain.full ? chain.seq[t] : chain.seq[t % chain.seq.length]);
  const bent = Object.values(chain.faces).some(([b, fw]) => dot(FACE[b], FACE[fw]) > -0.5);
  const r45 = Math.SQRT1_2;
  let u = bent ? [r45, -r45, 0] : [1, 0, 0], turn = 1;
  const c = sim.L / 2;
  let p = [0, 0, 0];
  for (let t = 0; t < CHAIN; t++) {
    const e = at(t);
    const [fb, ff, fs] = chain.faces[e];
    const back = FACE[fb], fwd = FACE[ff];
    const opposite = dot(back, fwd) < -0.5;
    const next = opposite ? u : [-turn * u[1], turn * u[0], 0];
    if (!opposite) turn = -turn;
    let q;
    if (opposite) {
      const side = fs !== undefined ? FACE[fs] : FACE.find((f) => Math.abs(dot(f, fwd)) < 0.5);
      q = orient(fwd, side, next, [0, 0, 1]);
    } else {
      q = orient(back, fwd, [-u[0], -u[1], -u[2]], next);
    }
    out.push({ e, pos: p.slice(), rot: q });
    p = [p[0] + SPACING * next[0], p[1] + SPACING * next[1], 0];
    u = next;
  }
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
export function insert(sim, laid, els, seed) {
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
export function look(sim, ids, els, chain) {
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
  // For a code chain: partners that are the complement of the letter they sit beside, and those
  // that are not.
  let right = 0, wrong = 0;
  if (chain.letters) {
    const [A, B] = chain.letters.map((x) => els[x].idx);
    ids.forEach((i, t) => {
      const want = sim.kind[i] === A ? B : sim.kind[i] === B ? A : -1;
      for (const j of partners[t]) { if (sim.kind[j] === want) right++; else wrong++; }
    });
  }
  return { intact: +(intact / (ids.length - 1)).toFixed(2), occupied, copy, clean, right, wrong, pairs, soupChain, temperature: +sim.temperature().toFixed(4) };
}

// Free n building blocks: particles turned into the chain's elements and set loose, at rest and
// facing every which way, in a slab around the chain. In a settled soup almost everything is
// already bonded, so a chain otherwise has nothing to copy itself from.
export function feed(sim, laid, ids, els, n, seed) {
  const r = rng(seed);
  const letters = [...new Set(laid.map((o) => o.e))];
  const keep = new Set(ids);
  let cx = 0, cy = 0, cz = 0;
  for (const o of laid) { cx += o.pos[0]; cy += o.pos[1]; cz += o.pos[2]; }
  cx /= laid.length; cy /= laid.length; cz /= laid.length;
  let fed = 0;
  for (let i = sim.n - 1; i >= 0 && fed < n; i -= 7) {
    if (keep.has(i)) continue;
    const e = letters[Math.floor(r() * letters.length)];
    for (let b = 0; b < S; b++) sim.s[i * D + FAST + b] = els[e].g[b];
    let x, y, z;
    do { x = cx + (r() * 2 - 1) * 3; y = cy + (r() * 2 - 1) * 2; z = cz + (r() * 2 - 1) * 1.5; }
    while (laid.some((o) => (x - o.pos[0]) ** 2 + (y - o.pos[1]) ** 2 + (z - o.pos[2]) ** 2 < 0.36));
    sim.pos[i * 3] = x - sim.L * Math.floor(x / sim.L); sim.pos[i * 3 + 1] = y - sim.L * Math.floor(y / sim.L);
    sim.pos[i * 3 + 2] = Math.min(sim.L * 0.999, Math.max(0, z));
    for (let a = 0; a < 3; a++) { sim.vel[i * 3 + a] = 0; sim.spin[i * 3 + a] = 0; }
    let w = r() * 2 - 1, qx = r() * 2 - 1, qy = r() * 2 - 1, qz = r() * 2 - 1;
    const l = Math.hypot(w, qx, qy, qz) || 1;
    sim.rot.set([w / l, qx / l, qy / l, qz / l], i * 4);
    fed++;
  }
}
