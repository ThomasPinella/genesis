// Genesis, experiment 2: energy flowing through the world of experiment 1.
//
// Experiment 1's world has a single energy: motion, a wall at contact, each particle's bonds (a
// soft maximum of how well its genome matches its neighbors'), and a term for every genome on its
// own whose valleys are the elements. Positions and genomes roll down it, so on its own it only
// falls. Experiment 2 adds a way in and more ways out:
//
//   - Light shines down from the ceiling in a band that sweeps across the world (day and night).
//     A particle takes a share of the light in its column by how well its query matches the
//     light's key, and shades everything below it. What it takes goes into its energy store.
//   - Stored energy flows along attention: what a particle attends to, it eats from.
//   - A particle can spend stored energy to push itself toward what it attends to, light
//     included. This is the only lopsided motion; it pushes off the medium, as swimming does.
//   - Stored energy leaks a little every tick: existing costs something.
//
// So total energy (experiment 1's energy plus everything stored) can rise only by the light that
// was absorbed. The books are kept and checked.
//
// Determinism: step() uses only +, -, *, /, Math.sqrt, Math.floor and Math.round, which IEEE 754
// defines exactly. exp, tanh and log are computed here from those operations instead of Math.exp,
// Math.tanh and Math.log, whose last bits can differ between browsers. Randomness comes from two
// integer PRNG streams: the law seed (the physics) and the world seed (the starting conditions).

export const D = 8;     // numbers in each particle's state
export const FAST = 4;  // state[0..3] is the fast state; state[4..7] is the slow state (the genome)
export const S = D - FAST;

export const DEFAULTS = {
  worldSeed: 1,
  lawSeed: 8,
  n: 1500,          // particle count (fixed: matter is conserved)
  density: 4,       // particles per unit volume; sets the size of the box
  heat: 2.0,        // starting speed of every particle
  drag: 0.08,       // fraction of velocity lost per unit time; the world's only heat sink
  attraction: 1.5,  // strength of the match-based pull (or push, when the match is negative)
  sharpness: 1.5,   // how selective attention is; sharper attention gives more, crisper elements
  depth: 2,         // how deep the law's genome valleys are, against the pull of neighbors
  genomeRate: 0.2,  // how fast genomes drift downhill (positions move much faster)
  stateRate: 0.1,   // how fast the fast state follows its update
  spread: 2.5,      // starting genomes are random within this range on every axis
  noise: 0,         // optional jitter per tick; off by default, and seeded when on
  sun: 12,          // light per column per unit time at noon
  day: 1000,        // ticks from one noon to the next at any place
  absorb: 0.5,      // the largest share of the light in its column one particle can take
  eatRate: 0.5,     // how fast stored energy flows to whoever attends to it
  eatGain: 0.5,     // the share of eaten energy that is kept; the rest is lost as heat
  leak: 0.05,       // fraction of stored energy lost per unit time
  thrust: 2,        // the strongest push a particle can give itself
  efficiency: 0.7,  // the share of energy spent on pushing that becomes motion
};

const RANGE = 1.0;      // interaction range: nothing farther than this is felt
const CONTACT = 0.35;    // closer than this, particles push apart
const REPULSION = 8;
const DT = 0.025;
const LAW_GAIN = 1.6;   // gain of the state update; above 1 it allows several stable states
const MEMORY_GAIN = 3;  // scale of the law's keys when a genome attends to them
const BOND_DIST = CONTACT * 1.4;
const BOND_MATCH = 0.25;
const SETTLED = 0.75;   // a genome this close to a valley has settled into that element
const ELEMENT_SHARE = 0.02;
const COLUMN = 0.5;     // width of a column of light
const FULL = 1;         // stored energy at which a particle feels full

export const TICK = DT;

function wall(r) {
  return r < CONTACT ? REPULSION * ((CONTACT - r) - (CONTACT * CONTACT - r * r) / (2 * CONTACT)) : 0;
}

// ---------- exact-everywhere math ----------

const LN2 = 0.6931471805599453;
const POW2 = new Float64Array(121); // 2^-60 .. 2^60, built by exact doubling and halving
{
  POW2[60] = 1;
  let p = 1;
  for (let k = 1; k <= 60; k++) { p *= 2; POW2[60 + k] = p; }
  p = 1;
  for (let k = 1; k <= 60; k++) { p /= 2; POW2[60 - k] = p; }
}

export function dexp(x) {
  if (x > 40) x = 40; else if (x < -40) x = -40;
  const k = Math.round(x / LN2);
  const r = x - k * LN2;
  let t = 1;
  for (let i = 10; i >= 1; i--) t = 1 + (r * t) / i;
  return t * POW2[60 + k];
}

export function dtanh(x) {
  if (x > 20) return 1;
  if (x < -20) return -1;
  const e = dexp(2 * x);
  return (e - 1) / (e + 1);
}

// cos: reduce to [-pi, pi] with an exact rounding, then a series.
const TWO_PI = 6.283185307179586;
export function dcos(x) {
  x -= TWO_PI * Math.round(x / TWO_PI);
  const x2 = x * x;
  let t = 1;
  for (let i = 22; i >= 2; i -= 2) t = 1 - (x2 * t) / (i * (i - 1));
  return t;
}

// Natural log for x > 0: scale into [1, 2) by exact powers of two, then a series for atanh.
export function dlog(x) {
  let k = 0;
  while (x >= 2 && k < 60) { x /= 2; k++; }
  while (x < 1 && k > -60) { x *= 2; k--; }
  const z = (x - 1) / (x + 1), z2 = z * z;
  let t = 0;
  for (let i = 39; i >= 1; i -= 2) t = 1 / i + z2 * t;
  return 2 * z * t + k * LN2;
}

function dcbrt(v) {
  let x = v > 1 ? v / 3 : 1;
  for (let i = 0; i < 60; i++) x = x - (x * x * x - v) / (3 * x * x);
  return x;
}

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SQRT3 = 1.7320508075688772;
function gauss(r) { return (r() + r() + r() + r() - 2) * SQRT3; }

// ---------- the simulation ----------

export class Sim {
  constructor(params = {}) {
    this.p = { ...DEFAULTS, ...params };
    const { n, density, lawSeed, worldSeed } = this.p;
    this.n = n;
    this.L = dcbrt(n / density);
    this.G = Math.max(3, Math.floor(this.L / RANGE));
    this.cell = this.L / this.G;
    this.tick = 0;

    // The universal law: one set of matrices shared by every particle.
    const lr = rng(lawSeed * 2654435761);
    const uni = (scale) => (lr() * 2 - 1) * scale;
    const qkScale = SQRT3 / Math.sqrt(D);
    this.Wq = new Float64Array(D * D).map(() => uni(qkScale));
    this.Wk = new Float64Array(D * D).map(() => uni(qkScale));
    this.Wv = new Float64Array(D * D).map(() => uni(qkScale));
    const uScale = (LAW_GAIN * SQRT3) / Math.sqrt(2 * D);
    this.Wu = new Float64Array(FAST * 2 * D).map(() => uni(uScale));
    this.bu = new Float64Array(FAST).map(() => uni(0.2));
    // Light is part of the law too: its key (its color, what it offers) and its value (what a
    // particle hears when it attends to light). Hunger is one more input to the fast state.
    this.lightKey = new Float64Array(D).map(() => uni(2 * qkScale));
    this.lightVal = new Float64Array(D).map(() => uni(qkScale));
    this.Wh = new Float64Array(FAST).map(() => uni(uScale));

    // How well two genomes match: g_i . M g_j, with M the symmetric part of (query . key) read
    // from the genome part of the state. Symmetric, so the pair's pull is the same both ways.
    this.M = new Float64Array(S * S);
    for (let a = 0; a < S; a++) {
      for (let b = 0; b < S; b++) {
        let x = 0;
        for (let c = 0; c < D; c++) {
          x += this.Wq[c * D + FAST + a] * this.Wk[c * D + FAST + b] + this.Wk[c * D + FAST + a] * this.Wq[c * D + FAST + b];
        }
        this.M[a * S + b] = x / (4 * Math.sqrt(S));
      }
    }
    // The genome's own term is a modern Hopfield energy: the genome attends to the law's keys
    // (each row of Wk, read from the genome part), and is comfortable when one key answers it
    // strongly. Its valleys are the law's memories, and those are the elements.
    this.X = new Float64Array(D * S);
    for (let m = 0; m < D; m++) for (let a = 0; a < S; a++) this.X[m * S + a] = MEMORY_GAIN * this.Wk[m * D + FAST + a];
    this.findElements();

    // Starting conditions: even scatter, fast random motion, random genomes.
    const wr = rng(worldSeed * 2246822519 + 1);
    this.noiseRng = rng(worldSeed * 3266489917 + 7);
    this.pos = new Float64Array(n * 3);
    this.vel = new Float64Array(n * 3);
    this.s = new Float64Array(n * D);
    this.s2 = new Float64Array(n * D);
    for (let i = 0; i < n * 3; i++) this.pos[i] = wr() * this.L;
    for (let i = 0; i < n * 3; i++) this.vel[i] = gauss(wr) * this.p.heat / SQRT3;
    for (let a = 0; a < 3; a++) {
      // Start with zero total momentum; balanced forces and uniform drag keep it there.
      let m = 0;
      for (let i = 0; i < n; i++) m += this.vel[i * 3 + a];
      m /= n;
      for (let i = 0; i < n; i++) this.vel[i * 3 + a] -= m;
    }
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < FAST; a++) this.s[i * D + a] = (wr() * 2 - 1) * 0.5;
      for (let a = FAST; a < D; a++) this.s[i * D + a] = (wr() * 2 - 1) * this.p.spread;
    }

    this.q = new Float64Array(n * D);
    this.k = new Float64Array(n * D);
    this.v = new Float64Array(n * D);
    this.Mg = new Float64Array(n * S);
    this.gradG = new Float64Array(n * S);
    this.force = new Float64Array(n * 3);
    this.msg = new Float64Array(n * D);
    this.wsum = new Float64Array(n);
    this.cellStart = new Int32Array(this.G * this.G * this.G + 1);
    this.cellItems = new Int32Array(n);
    this.cellOf = new Int32Array(n);
    this.maxBonds = n * 24;
    this.bondA = new Int32Array(this.maxBonds);
    this.bondB = new Int32Array(this.maxBonds);
    this.bondCount = 0;
    this.energy = null;
    this.P = new Float64Array(n);
    this.Q = new Float64Array(n);
    this.pairCap = 0;
    this.growPairs();

    // Energy: the store, what came in and went out this step, and running totals.
    this.en = new Float64Array(n);
    this.gotLight = new Float64Array(n);
    this.gotEat = new Float64Array(n);
    this.lostEat = new Float64Array(n);
    this.spent = new Float64Array(n);
    this.lightAt = new Float64Array(n);
    this.dir = new Float64Array(n * 3);
    this.demand = new Float64Array(n);
    this.CG = Math.max(1, Math.floor(this.L / COLUMN));
    this.colW = this.L / this.CG;
    this.colStart = new Int32Array(this.CG * this.CG + 1);
    this.colItems = new Int32Array(n);
    this.colOf = new Int32Array(n);
    this.lightIn = 0;   // all light ever absorbed
    this.kind = new Int16Array(n).fill(this.elements.length);
    this.flow = null; // set to a (K+1)^2 array to record who eats whom, by element
    this.acc = { light: new Float64Array(n), eat: new Float64Array(n), eaten: new Float64Array(n), move: new Float64Array(n), since: 0 };
  }

  // Noon passes x = L * tick / day; light falls off as cos of the distance from noon.
  sunAt(x, tick = this.tick) {
    const c = dcos(TWO_PI * (x / this.L - tick / this.p.day));
    return c > 0 ? this.p.sun * c : 0;
  }

  growPairs() {
    const cap = this.pairCap ? this.pairCap * 2 : this.n * 32;
    const grow = (old, size) => { const a = new old.constructor(size); a.set(old); return a; };
    if (!this.pairCap) {
      this.pi = new Int32Array(cap); this.pj = new Int32Array(cap);
      this.pd = new Float64Array(cap * 4); this.pf = new Float64Array(cap * 2); this.pw = new Float64Array(cap * 2);
    } else {
      this.pi = grow(this.pi, cap); this.pj = grow(this.pj, cap);
      this.pd = grow(this.pd, cap * 4); this.pf = grow(this.pf, cap * 2); this.pw = grow(this.pw, cap * 2);
    }
    this.pairCap = cap;
  }

  set(name, value) {
    this.p[name] = value;
    if (name === 'sharpness') this.findElements();
  }

  // The genome's own energy, and its slope written into out (both scaled by depth later).
  selfTerm(g, go, out, oo) {
    const { X } = this, beta = Math.max(this.p.sharpness, 0.05);
    const a = this._a || (this._a = new Float64Array(D));
    let amax = -Infinity;
    for (let m = 0; m < D; m++) {
      let x = 0;
      for (let b = 0; b < S; b++) x += X[m * S + b] * g[go + b];
      a[m] = beta * x;
      if (a[m] > amax) amax = a[m];
    }
    let Z = 0;
    for (let m = 0; m < D; m++) { a[m] = dexp(a[m] - amax); Z += a[m]; }
    let sq = 0;
    for (let b = 0; b < S; b++) {
      let pull = 0;
      for (let m = 0; m < D; m++) pull += a[m] * X[m * S + b];
      out[oo + b] = g[go + b] - pull / Z;
      sq += g[go + b] * g[go + b];
    }
    return sq / 2 - (amax + dlog(Z)) / beta;
  }

  // The law's elements: roll many genomes downhill on the genome term alone and keep each
  // distinct place they come to rest. Uses its own fixed starts, so it depends only on the law.
  findElements() {
    const r = rng(0x9e3779b9);
    const g = new Float64Array(S), grad = new Float64Array(S);
    const found = [];
    const starts = 256;
    for (let t = 0; t < starts; t++) {
      for (let b = 0; b < S; b++) g[b] = (r() * 2 - 1) * 3;
      for (let it = 0; it < 4000; it++) {
        this.selfTerm(g, 0, grad, 0);
        let d = 0;
        for (let b = 0; b < S; b++) { g[b] -= 0.5 * grad[b]; d += grad[b] * grad[b]; }
        if (d < 1e-16) break;
      }
      let hit = null;
      for (const e of found) {
        let d = 0;
        for (let b = 0; b < S; b++) d += (e.g[b] - g[b]) ** 2;
        if (d < 0.01) { hit = e; break; }
      }
      if (hit) hit.basin++;
      else found.push({ g: Array.from(g), basin: 1 });
    }
    found.sort((x, y) => y.basin - x.basin);
    this.elements = found.map((e) => ({ g: e.g, basin: e.basin / starts, energy: this.selfTerm(e.g, 0, grad, 0) }));
    // How close a genome must be to count as settled: SETTLED, or less when valleys are close.
    let gap = Infinity;
    for (const a of this.elements) for (const b of this.elements) {
      if (a === b) continue;
      let d = 0;
      for (let c = 0; c < S; c++) d += (a.g[c] - b.g[c]) ** 2;
      gap = Math.min(gap, Math.sqrt(d));
    }
    this.settleRadius = Math.min(SETTLED, 0.4 * gap);
  }

  project() {
    const { n, s, q, k, v, Wq, Wk, Wv, M, Mg } = this;
    for (let i = 0; i < n; i++) {
      const o = i * D;
      for (let a = 0; a < D; a++) {
        let sq = 0, sk = 0, sv = 0;
        const w = a * D;
        for (let b = 0; b < D; b++) {
          const x = s[o + b];
          sq += Wq[w + b] * x; sk += Wk[w + b] * x; sv += Wv[w + b] * x;
        }
        q[o + a] = sq; k[o + a] = sk; v[o + a] = sv;
      }
      for (let a = 0; a < S; a++) {
        let x = 0;
        for (let b = 0; b < S; b++) x += M[a * S + b] * s[o + FAST + b];
        Mg[i * S + a] = x;
      }
    }
  }

  buildGrid() {
    const { n, G, cell, pos, cellStart, cellItems, cellOf } = this;
    cellStart.fill(0);
    for (let i = 0; i < n; i++) {
      let cx = Math.floor(pos[i * 3] / cell), cy = Math.floor(pos[i * 3 + 1] / cell), cz = Math.floor(pos[i * 3 + 2] / cell);
      if (cx >= G) cx = G - 1; if (cy >= G) cy = G - 1; if (cz >= G) cz = G - 1;
      const c = (cz * G + cy) * G + cx;
      cellOf[i] = c;
      cellStart[c + 1]++;
    }
    for (let c = 0; c < G * G * G; c++) cellStart[c + 1] += cellStart[c];
    const fill = cellStart.slice(0, G * G * G);
    for (let i = 0; i < n; i++) cellItems[fill[cellOf[i]]++] = i;
  }

  // Light comes down each column from the ceiling. Each particle, from the top down, takes its
  // share and leaves the rest for those below.
  shine() {
    const { n, pos, q, CG, colW, colStart, colItems, colOf, lightKey, lightAt, gotLight, L } = this;
    const { absorb, sharpness } = this.p;
    const invSqrtD = 1 / Math.sqrt(D);
    colStart.fill(0);
    for (let i = 0; i < n; i++) {
      let cx = Math.floor(pos[i * 3] / colW), cy = Math.floor(pos[i * 3 + 1] / colW);
      if (cx >= CG) cx = CG - 1; if (cy >= CG) cy = CG - 1;
      colOf[i] = cy * CG + cx;
      colStart[colOf[i] + 1]++;
    }
    for (let c = 0; c < CG * CG; c++) colStart[c + 1] += colStart[c];
    const fill = colStart.slice(0, CG * CG);
    for (let i = 0; i < n; i++) colItems[fill[colOf[i]]++] = i;
    let total = 0;
    for (let c = 0; c < CG * CG; c++) {
      const a = colStart[c], b = colStart[c + 1];
      // Highest first; ties by index, so the order never depends on anything else.
      for (let t = a + 1; t < b; t++) {
        const it = colItems[t];
        let u = t - 1;
        while (u >= a) {
          const iu = colItems[u];
          if (pos[iu * 3 + 2] > pos[it * 3 + 2] || (pos[iu * 3 + 2] === pos[it * 3 + 2] && iu < it)) break;
          colItems[u + 1] = iu; u--;
        }
        colItems[u + 1] = it;
      }
      let I = this.sunAt(((c % CG) + 0.5) * colW);
      for (let t = a; t < b; t++) {
        const i = colItems[t];
        lightAt[i] = I;
        let m = 0;
        for (let x = 0; x < D; x++) m += q[i * D + x] * lightKey[x];
        const share = m > 0 ? absorb * dtanh(sharpness * m * invSqrtD) : 0;
        const took = I * share;
        gotLight[i] = took * DT;
        total += took * DT;
        I -= took;
      }
    }
    return total;
  }

  step() {
    const { n, L, G, pos, vel, s, s2, q, k, v, Mg, gradG, force, msg, wsum, cellStart, cellItems, cellOf, Wu, bu } = this;
    const { attraction, sharpness, stateRate, drag, noise, depth, genomeRate } = this.p;
    const { en, gotEat, lostEat, spent, lightAt, dir, demand, lightKey, lightVal, Wh } = this;
    const { sun, eatRate, eatGain, leak, thrust, efficiency } = this.p;
    const half = L / 2;
    const invSqrtD = 1 / Math.sqrt(D);
    const rc2 = RANGE * RANGE;
    const x16 = new Float64Array(2 * D);

    this.project();
    this.buildGrid();
    this.bondCount = 0;
    let stored = 0;
    for (let i = 0; i < n; i++) stored += en[i];
    const lightBefore = this.lightIn;
    const absorbed = this.shine();

    // Attention always includes yourself, so an isolated particle still updates. Each genome
    // also starts with the slope of its own term.
    let selfE = 0;
    for (let i = 0; i < n; i++) {
      const oi = i * D;
      let selfDot = 0;
      for (let a = 0; a < D; a++) selfDot += q[oi + a] * k[oi + a];
      const w = dexp(sharpness * selfDot * invSqrtD);
      wsum[i] = w;
      for (let a = 0; a < D; a++) msg[oi + a] = w * v[oi + a];
      // Light is attendable: it enters attention like one more neighbor, overhead, carrying the
      // light key, weighted by how bright it is here.
      dir[i * 3] = 0; dir[i * 3 + 1] = 0; dir[i * 3 + 2] = 0;
      if (lightAt[i] > 0) {
        let ml = 0;
        for (let a = 0; a < D; a++) ml += q[oi + a] * lightKey[a];
        const wl = dexp(sharpness * ml * invSqrtD) * (lightAt[i] / sun);
        wsum[i] += wl;
        for (let a = 0; a < D; a++) msg[oi + a] += wl * lightVal[a];
        dir[i * 3 + 2] = wl;
      }
      selfE += this.selfTerm(s, oi + FAST, gradG, i * S);
      for (let a = 0; a < S; a++) gradG[i * S + a] *= depth;
    }
    selfE *= depth;
    force.fill(0);
    let wallE = 0;
    const beta = Math.max(sharpness, 0.05);
    const P = this.P, Q = this.Q;
    P.fill(1); Q.fill(1);
    let np = 0;

    // Pass 1. Every pair within range is visited once, always from its lower index, in a fixed
    // order. It records the pair, applies the wall, and gathers what each particle hears.
    for (let i = 0; i < n; i++) {
      const oi = i * D;
      const xi = pos[i * 3], yi = pos[i * 3 + 1], zi = pos[i * 3 + 2];
      const c = cellOf[i];
      const cx = c % G, cy = Math.floor(c / G) % G, cz = Math.floor(c / (G * G));
      for (let dz = -1; dz <= 1; dz++) {
        const zz = cz + dz;
        if (zz < 0 || zz >= G) continue; // floor and ceiling: no wrap in height
        for (let dy = -1; dy <= 1; dy++) {
          const yy = (cy + dy + G) % G;
          for (let dx = -1; dx <= 1; dx++) {
            const cc = (zz * G + yy) * G + ((cx + dx + G) % G);
            for (let t = cellStart[cc], end = cellStart[cc + 1]; t < end; t++) {
              const j = cellItems[t];
              if (j <= i) continue;
              let ddx = pos[j * 3] - xi, ddy = pos[j * 3 + 1] - yi, ddz = pos[j * 3 + 2] - zi;
              if (ddx > half) ddx -= L; else if (ddx < -half) ddx += L;
              if (ddy > half) ddy -= L; else if (ddy < -half) ddy += L;
              const r2 = ddx * ddx + ddy * ddy + ddz * ddz;
              if (r2 >= rc2) continue;

              const oj = j * D, gj = j * S;
              let mij = 0, mji = 0, gm = 0;
              for (let a = 0; a < D; a++) { mij += q[oi + a] * k[oj + a]; mji += q[oj + a] * k[oi + a]; }
              for (let a = 0; a < S; a++) gm += s[oi + FAST + a] * Mg[gj + a];
              mij *= invSqrtD; mji *= invSqrtD;
              const sym = dtanh(gm);
              const r = Math.sqrt(r2);
              const fall = (1 - r2 / rc2) * (1 - r2 / rc2);

              // The wall at contact: its own energy, equal and opposite push.
              if (r < CONTACT && r > 1e-9) {
                wallE += wall(r);
                const fr = -REPULSION * (1 - r / CONTACT) / r;
                force[i * 3] += fr * ddx; force[i * 3 + 1] += fr * ddy; force[i * 3 + 2] += fr * ddz;
                force[j * 3] -= fr * ddx; force[j * 3 + 1] -= fr * ddy; force[j * 3 + 2] -= fr * ddz;
              }

              // The genome match, seen through the same distance fade as attention.
              const e = dexp(beta * sym);
              P[i] += fall * e; P[j] += fall * e;
              Q[i] += fall; Q[j] += fall;
              if (np === this.pairCap) this.growPairs();
              this.pi[np] = i; this.pj[np] = j; this.pd[np * 4] = ddx; this.pd[np * 4 + 1] = ddy; this.pd[np * 4 + 2] = ddz;
              this.pd[np * 4 + 3] = r; this.pf[np * 2] = fall; this.pf[np * 2 + 1] = sym;
              np++;

              // Attention may be lopsided: i listens to j by how well i's query matches j's key,
              // and j listens to i by how well j's query matches i's key. Both fade to zero at
              // the edge of the range. What a particle hears moves only its fast state, which
              // is not part of the energy, so it cannot create motion.
              const wij = dexp(sharpness * mij) * fall;
              const wji = dexp(sharpness * mji) * fall;
              wsum[i] += wij; wsum[j] += wji;
              for (let a = 0; a < D; a++) { msg[oi + a] += wij * v[oj + a]; msg[oj + a] += wji * v[oi + a]; }
              this.pw[(np - 1) * 2] = wij; this.pw[(np - 1) * 2 + 1] = wji;
              if (r > 1e-9) {
                const ux = ddx / r, uy = ddy / r, uz = ddz / r;
                dir[i * 3] += wij * ux; dir[i * 3 + 1] += wij * uy; dir[i * 3 + 2] += wij * uz;
                dir[j * 3] -= wji * ux; dir[j * 3 + 1] -= wji * uy; dir[j * 3 + 2] -= wji * uz;
              }

              if (r < BOND_DIST && sym > BOND_MATCH && this.bondCount < this.maxBonds) {
                this.bondA[this.bondCount] = i; this.bondB[this.bondCount] = j; this.bondCount++;
              }
            }
          }
        }
      }
    }

    // Each particle's bond energy is a soft maximum of its matches, like attention's softmax:
    //   E_i = -(attraction / beta) * log( (1 + sum_j fade_ij e^(beta match_ij)) / (1 + sum_j fade_ij) )
    // The 1s stand for empty space. It is bounded however many neighbors crowd in, so attention
    // has a fixed budget and bonds saturate (without that, dense clumps collapse into themselves).
    let bondE = 0;
    const scale = attraction / beta;
    for (let i = 0; i < n; i++) bondE -= scale * (dlog(P[i]) - dlog(Q[i]));

    // Pass 2: the slopes of that energy. In distance they are the forces, equal and opposite for
    // each pair; in each genome they are how it would like to change for its neighbors.
    for (let t = 0; t < np; t++) {
      const i = this.pi[t], j = this.pj[t];
      const ddx = this.pd[t * 4], ddy = this.pd[t * 4 + 1], ddz = this.pd[t * 4 + 2], r = this.pd[t * 4 + 3];
      const fall = this.pf[t * 2], sym = this.pf[t * 2 + 1];
      const e = dexp(beta * sym);
      const ci = e / P[i] - 1 / Q[i], cj = e / P[j] - 1 / Q[j];
      if (r > 1e-9) {
        const dfall = -4 * r / rc2 * (1 - r * r / rc2);
        const fr = -scale * dfall * (ci + cj) / r;
        force[i * 3] += fr * ddx; force[i * 3 + 1] += fr * ddy; force[i * 3 + 2] += fr * ddz;
        force[j * 3] -= fr * ddx; force[j * 3 + 1] -= fr * ddy; force[j * 3 + 2] -= fr * ddz;
      }
      const pull = -attraction * fall * e * (1 / P[i] + 1 / P[j]) * (1 - sym * sym);
      const gi = i * S, gj = j * S;
      for (let a = 0; a < S; a++) { gradG[gi + a] += pull * Mg[gj + a]; gradG[gj + a] += pull * Mg[gi + a]; }
    }

    let kin = 0;
    for (let i = 0; i < n * 3; i++) kin += vel[i] * vel[i];
    const pairE = wallE + bondE;
    const mech = kin / 2 + pairE + selfE;
    // Everything is measured at the start of the step, before this step's light arrives.
    this.energy = { kinetic: kin / 2, pair: pairE, self: selfE, mech, stored, total: mech + stored, lightIn: lightBefore, tick: this.tick };
    this.lightIn += absorbed;

    // Eating: i attends to j with share w_ij / wsum_i, and that much of j's demand is i's. A
    // particle loses 1 - e^(-eatRate * dt * demand) of its store this step, split between those
    // attending to it; the eaters keep eatGain of it and the rest is heat.
    demand.fill(0);
    for (let t = 0; t < np; t++) {
      const i = this.pi[t], j = this.pj[t];
      demand[j] += this.pw[t * 2] / wsum[i];
      demand[i] += this.pw[t * 2 + 1] / wsum[j];
    }
    gotEat.fill(0); lostEat.fill(0);
    const { flow, kind } = this, K1 = this.elements.length + 1;
    for (let i = 0; i < n; i++) en[i] += this.gotLight[i];
    for (let t = 0; t < np; t++) {
      const i = this.pi[t], j = this.pj[t];
      const aij = this.pw[t * 2] / wsum[i], aji = this.pw[t * 2 + 1] / wsum[j];
      if (aij > 0 && en[j] > 0) {
        const f = en[j] * (1 - dexp(-eatRate * DT * demand[j])) * aij / demand[j];
        gotEat[i] += eatGain * f; lostEat[j] += f;
        if (flow) flow[kind[j] * K1 + kind[i]] += f;
      }
      if (aji > 0 && en[i] > 0) {
        const f = en[i] * (1 - dexp(-eatRate * DT * demand[i])) * aji / demand[i];
        gotEat[j] += eatGain * f; lostEat[i] += f;
        if (flow) flow[kind[i] * K1 + kind[j]] += f;
      }
    }
    const keep = 1 - leak * DT;
    for (let i = 0; i < n; i++) en[i] = (en[i] - lostEat[i] + gotEat[i]) * keep;

    // Self-propulsion: push toward what attention favors, as hard as the fast state's first number
    // says (none if it is negative). It costs the work done divided by the efficiency, paid from
    // the store; with too little stored, the push shrinks to what can be paid.
    for (let i = 0; i < n; i++) {
      spent[i] = 0;
      const motor = s[i * D];
      if (motor <= 0 || en[i] <= 0) continue;
      const dx = dir[i * 3], dy = dir[i * 3 + 1], dz = dir[i * 3 + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-12) continue;
      let F = thrust * motor / len;
      // The push's own work this step: F.(v + F dt / 2) dt, which counts the speed it adds too.
      const fv = dx * vel[i * 3] + dy * vel[i * 3 + 1] + dz * vel[i * 3 + 2];
      let work = F * (fv + F * len * len * DT / 2) * DT;
      let cost = (work < 0 ? -work : work) / efficiency;
      if (cost > en[i]) {
        // Shrink the push until it can be paid for (|work| grows with F, so halving converges).
        let lo = 0, hi = F;
        for (let it = 0; it < 30; it++) {
          const mid = (lo + hi) / 2, w = mid * (fv + mid * len * len * DT / 2) * DT;
          if ((w < 0 ? -w : w) / efficiency > en[i]) hi = mid; else lo = mid;
        }
        F = lo;
        work = F * (fv + F * len * len * DT / 2) * DT;
        cost = (work < 0 ? -work : work) / efficiency;
      }
      en[i] -= cost;
      spent[i] = cost;
      force[i * 3] += F * dx; force[i * 3 + 1] += F * dy; force[i * 3 + 2] += F * dz;
    }

    const a = this.acc;
    for (let i = 0; i < n; i++) { a.light[i] += this.gotLight[i]; a.eat[i] += gotEat[i]; a.eaten[i] += lostEat[i]; a.move[i] += spent[i]; }

    const gstep = DT * genomeRate;
    for (let i = 0; i < n; i++) {
      const oi = i * D;
      // Fast state follows a nonlinear update of (own state, what it heard).
      const inv = 1 / wsum[i];
      for (let a = 0; a < D; a++) { x16[a] = s[oi + a]; x16[D + a] = msg[oi + a] * inv; }
      for (let a = 0; a < FAST; a++) {
        let z = bu[a];
        const w0 = a * 2 * D;
        for (let b = 0; b < 2 * D; b++) z += Wu[w0 + b] * x16[b];
        z += Wh[a] * dtanh(en[i] / FULL);
        s2[oi + a] = s[oi + a] + stateRate * (dtanh(z) - s[oi + a]);
      }
      // The genome drifts slowly downhill: it only changes when that releases energy.
      for (let a = 0; a < S; a++) s2[oi + FAST + a] = s[oi + FAST + a] - gstep * gradG[i * S + a];
    }

    // Integrate: forces, optional seeded noise, drag (the sink), then move. Sideways the world
    // wraps around; in height it has a floor and a ceiling that bounce particles back.
    const damp = 1 - drag * DT;
    const kick = noise > 0 ? noise * Math.sqrt(DT) : 0;
    for (let i = 0; i < n * 3; i++) {
      let vv = vel[i] + DT * force[i];
      if (kick > 0) vv += kick * gauss(this.noiseRng);
      vv *= damp;
      let x = pos[i] + DT * vv;
      if (i % 3 === 2) {
        if (x < 0) { x = -x; vv = -vv; }
        if (x > L) { x = 2 * L - x; vv = -vv; }
        if (x >= L) x = L * 0.999999;
      } else {
        x -= L * Math.floor(x / L);
        if (x >= L) x = 0;
      }
      vel[i] = vv;
      pos[i] = x;
    }
    this.s = s2; this.s2 = s;
    this.tick++;
  }

  momentum() {
    const m = [0, 0, 0];
    for (let i = 0; i < this.n; i++) for (let a = 0; a < 3; a++) m[a] += this.vel[i * 3 + a];
    return Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]) / this.n;
  }

  temperature() {
    let e = 0;
    for (let i = 0; i < this.n * 3; i++) e += this.vel[i] * this.vel[i];
    return e / (this.n * 3);
  }

  // Where each element's energy comes from and goes, from the running totals since the last
  // reset. Kinds come from the last census; the last kind lumps together everything unsettled.
  ecology() {
    const K1 = this.elements.length + 1, { acc, kind, en, n } = this;
    const rows = Array.from({ length: K1 }, () => ({ count: 0, light: 0, eat: 0, eaten: 0, move: 0, stored: 0 }));
    for (let i = 0; i < n; i++) {
      const r = rows[kind[i]];
      r.count++; r.light += acc.light[i]; r.eat += acc.eat[i]; r.eaten += acc.eaten[i]; r.move += acc.move[i]; r.stored += en[i];
    }
    return { rows, ticks: this.tick - acc.since, flow: this.flow ? Array.from(this.flow) : null };
  }

  resetTotals() {
    const a = this.acc;
    a.light.fill(0); a.eat.fill(0); a.eaten.fill(0); a.move.fill(0); a.since = this.tick;
    if (this.flow) this.flow.fill(0);
  }

  // Which elements the world has settled into. A particle has settled when its genome sits
  // close to one of the law's valleys (neighbors may hold it a little off the exact bottom). Genomes that have gathered somewhere else, in numbers,
  // are elements that exist only in company: their neighbors hold them there.
  census() {
    const { n, s, elements } = this;
    const count = new Int32Array(elements.length);
    const loose = [];
    for (let i = 0; i < n; i++) {
      let best = -1, bd = this.settleRadius * this.settleRadius;
      for (let e = 0; e < elements.length; e++) {
        let d = 0;
        for (let b = 0; b < S; b++) d += (s[i * D + FAST + b] - elements[e].g[b]) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (best >= 0) count[best]++; else loose.push(i);
      this.kind[i] = best >= 0 ? best : elements.length;
    }
    // Group the unsettled genomes: each joins the first group whose centre is close enough.
    const groups = [];
    for (const i of loose) {
      let hit = null;
      for (const gr of groups) {
        let d = 0;
        for (let b = 0; b < S; b++) d += (s[i * D + FAST + b] - gr.c[b]) ** 2;
        if (d < this.settleRadius * this.settleRadius) { hit = gr; break; }
      }
      if (!hit) { hit = { c: Array.from(s.subarray(i * D + FAST, i * D + D)), sum: new Array(S).fill(0), size: 0 }; groups.push(hit); }
      for (let b = 0; b < S; b++) hit.sum[b] += s[i * D + FAST + b];
      hit.size++;
    }
    const min = ELEMENT_SHARE * n;
    const present = [];
    for (let e = 0; e < elements.length; e++) if (count[e] >= min) present.push(e);
    const company = groups.filter((gr) => gr.size >= min)
      .map((gr) => ({ g: gr.sum.map((x) => x / gr.size), share: gr.size / n }))
      .sort((x, y) => y.share - x.share);
    let settled = 0;
    for (let e = 0; e < elements.length; e++) settled += count[e];
    return {
      possible: elements.length,
      shares: Array.from(count, (c) => c / n),
      present,
      company,
      distinct: present.length + company.length,
      settled: settled / n,
    };
  }

  // Bonds from the last step, grouped into clusters with union-find.
  clusters() {
    const parent = new Int32Array(this.n);
    for (let i = 0; i < this.n; i++) parent[i] = i;
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const bonded = new Uint8Array(this.n);
    for (let b = 0; b < this.bondCount; b++) {
      const a = this.bondA[b], c = this.bondB[b];
      bonded[a] = 1; bonded[c] = 1;
      const ra = find(a), rb = find(c);
      if (ra !== rb) parent[ra < rb ? rb : ra] = ra < rb ? ra : rb;
    }
    const size = new Int32Array(this.n);
    for (let i = 0; i < this.n; i++) size[find(i)]++;
    let groups = 0, largest = 0, nBonded = 0;
    for (let i = 0; i < this.n; i++) {
      if (size[i] >= 3) groups++;
      if (size[i] > largest) largest = size[i];
      nBonded += bonded[i];
    }
    // Sorting: how much of the genome variation among grouped particles lies between groups
    // rather than within them (0 = every group is a random mix, 1 = every group is one kind).
    const root = new Int32Array(this.n);
    for (let i = 0; i < this.n; i++) root[i] = find(i);
    const sum = new Float64Array(this.n * S), all = new Float64Array(S);
    let members = 0;
    for (let i = 0; i < this.n; i++) {
      if (size[root[i]] < 3) continue;
      members++;
      for (let a = 0; a < S; a++) { const x = this.s[i * D + FAST + a]; sum[root[i] * S + a] += x; all[a] += x; }
    }
    let total = 0, within = 0;
    for (let i = 0; i < this.n; i++) {
      const r = root[i];
      if (size[r] < 3) continue;
      for (let a = 0; a < S; a++) {
        const x = this.s[i * D + FAST + a];
        total += (x - all[a] / members) ** 2;
        within += (x - sum[r * S + a] / size[r]) ** 2;
      }
    }
    const sorting = total > 1e-12 ? 1 - within / total : 0;
    return { groups, largest, bondedShare: nBonded / this.n, bonds: this.bondCount, sorting };
  }

  // A fingerprint of the whole world: identical worlds give identical hashes.
  hash() {
    let h = 0x811c9dc5;
    for (const arr of [this.pos, this.vel, this.s, this.en]) {
      const words = new Uint32Array(arr.buffer, arr.byteOffset, arr.length * 2);
      for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i], 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}
