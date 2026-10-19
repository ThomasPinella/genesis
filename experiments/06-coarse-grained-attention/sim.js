// Genesis, experiment 6: coarse-grained attention. The world of experiment 5, where attention now
// also reaches far, and sees what is far away blended.
//
// Until now nothing farther than one unit was felt at all. Here, up close, a particle still attends
// to each neighbor on its own, exactly as before. Farther out (beyond its own and the neighboring
// cells of the world's grid, up to the far setting), it attends to each cell of the world as one
// blended thing: the cell's average key, average value and middle, counted once per member.
//
//   w_ic = coarse * N_c * (CONTACT / R_ic)^2 * (1 - R_ic^2 / far^2)^2 * e^(sharpness * q_i . K_c / sqrt(D))
//
// N_c is how many particles the cell holds, K_c their average key, R_ic the distance to their
// middle. (CONTACT / R)^2 is how much of a particle's view one member fills, so far things count
// less as they get smaller in view; the last bracket fades the far field out at the far setting.
// What a particle hears from a cell is the cell's average value, and the direction it attends is
// toward the cell's middle, seen through its faces as up close. A cell whose members agree has a
// strong average key, so it stands out from afar as one thing; a random mix averages toward nothing.
// Nothing looks for groups: every cell is blended the same way, whatever is in it.
//
// Far attention only reaches the fast state and the direction a particle would push itself, as
// near attention does; it is not part of the energy, so it moves nothing for free. A particle's
// attention budget is shared, so what it spends far away it does not spend on neighbors (and only
// neighbors can be eaten). coarse 0 gives back experiment 5 exactly, which is the ablation.
//
// Two optional settings, both off by default, test ways a group's fast state might come to show its
// arrangement: listen makes a particle attend more to what it bonds with (each pair's attention is
// multiplied by e^(listen * beta * match), the same factor the bond energy uses), and space gives
// empty space a share of every particle's attention, as the 1s in the bond energy do, so that what
// a particle hears depends on how many neighbors it has and not only on what they say.
//
// Experiment 5's description of the world follows.
//
// Experiment 5, shaking light: the world of experiment 4, where absorbed light can now
// also shake the bonds of whatever absorbs it.
//
// In experiments 2 to 4, light that a particle absorbs goes into its store and nowhere else, so
// the day barely warms anything; the world cools until nothing moves. A template and the partners
// it gathers then freeze in place, and warmth from the optional noise, enough to free wrong
// partners, also breaks the template. Real light warms what absorbs it. Here a share of the light
// a bonded particle absorbs (the shake setting) goes into its bonds instead of its store: each of
// its bonds gets an equal and opposite push along the bond, apart, carrying exactly that energy.
//
//   E_b = shake * (light_i / bonds_i + light_j / bonds_j)     for each bond b between i and j
//   v_i -= a u,  v_j += a u,  with a chosen so the pair's kinetic energy rises by exactly E_b
//
// u is the direction from i to j. A pair's pushes are equal and opposite and along the line
// between them, so they add no momentum and no turning. A bond that the push carries past its
// depth breaks; a stronger one rings and holds. Since the sun sweeps across the world, each place
// warms by day and cools by night. Nothing is random: the push is set by the light and the bond.
// An unbonded particle stores all its light, as before, and shake 0 gives back experiment 4
// exactly, which is the ablation.
//
// Experiment 4's description of the world follows.
//
// Experiment 4, face chemistry: The world of experiment 3, where each face of a particle
// now has its own chemistry.
//
// In experiment 3 every particle has an orientation and six faces, and a face's stickiness came
// from the genome. But who a particle bonds with came from one genome match per pair, the same
// through every face, so a bond along a chain and a bond at its side were the same bond. Real
// molecules have sites with different chemistry, built from the same atoms; here each face shows
// the genome through its own lens:
//
//   h_i(d) = sum_k bump_k(d) * (I + faces * T_k) g_i       what particle i presents toward d
//   match_ij = (1 - geometry) * g_i . M g_j + geometry * near(r) * h_i(d_ij) . M h_j(d_ji)
//
// bump_k is a narrow bump around face k, d_ij is the direction to j in i's own frame, and M is the
// same symmetric match as before. Every face shares the genome as it is (I), plus its own twist
// T_k, a matrix in the law; the faces setting scales the twists. At 0 all faces are alike; as it
// grows they become distinct sites, so one face can like a particle's own kind while another likes
// only a partner. How strongly each face reads the genome also sets how much a particle attends
// through it and how much light it sees through its top. Nobody lists faces; the law's random
// lenses decide.
//
// Forces, torques and genome changes are still the slopes of one energy, and the match is the same
// from either side and unchanged when the world turns, so momentum and angular momentum are kept.
// Setting geometry to 0 gives back experiment 2 exactly; that is the ablation.
//
// Determinism: step() uses only +, -, *, /, Math.sqrt, Math.floor and Math.round, which IEEE 754
// defines exactly. exp, tanh, log and cos are computed here from those operations. Randomness
// comes from two integer PRNG streams: the law seed (the physics) and the world seed (the starting
// conditions).

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
  geometry: 1,      // how much direction matters in a match; 0 makes bonds and attention direction-blind
  faces: 1,         // how different a particle's faces are from each other; 0 makes them all alike
  shake: 0.25,      // share of a bonded particle's absorbed light that shakes its bonds instead of being stored
  coarse: 1,        // how strongly attention reaches far, to blended cells; 0 is experiment 5
  far: 3,           // how far attention reaches; the far field fades out here
  listen: 0,        // how much more a particle attends to what it bonds with (0: not at all)
  space: 0,         // how much attention goes to empty space, which says nothing (0: none)
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
const INERTIA = 0.1;    // moment of inertia of a particle (its mass is 1)
const PATCHES = 6;      // one possible patch on each face: +x, -x, +y, -y, +z, -z of the body frame
const PATCH_WIDTH = 4;  // how narrow a face is: its reach falls to half about 34 degrees off its center
const NEAR = 0.15;      // direction fades in below this distance, where it stops being well defined

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

// A particle's faces seen from direction (x, y, z) in its own frame: the sum over faces of
// w_k exp(PATCH_WIDTH (d . e_k - 1)). Writes each face's bump into sv and the slope of the sum on
// the sphere into gr; returns the sum. With w the faces' openness it gives how much a particle
// attends that way; with w each face's share of a match it gives the match and its slope.
const PATCH_FLOOR = Math.exp(-PATCH_WIDTH);
function patchAt(x, y, z, w, o, sv, gr) {
  const ex = dexp(PATCH_WIDTH * x), ey = dexp(PATCH_WIDTH * y), ez = dexp(PATCH_WIDTH * z);
  sv[0] = ex * PATCH_FLOOR; sv[1] = PATCH_FLOOR / ex;
  sv[2] = ey * PATCH_FLOOR; sv[3] = PATCH_FLOOR / ey;
  sv[4] = ez * PATCH_FLOOR; sv[5] = PATCH_FLOOR / ez;
  gr[0] = PATCH_WIDTH * (w[o] * sv[0] - w[o + 1] * sv[1]);
  gr[1] = PATCH_WIDTH * (w[o + 2] * sv[2] - w[o + 3] * sv[3]);
  gr[2] = PATCH_WIDTH * (w[o + 4] * sv[4] - w[o + 5] * sv[5]);
  return w[o] * sv[0] + w[o + 1] * sv[1] + w[o + 2] * sv[2] + w[o + 3] * sv[3] + w[o + 4] * sv[4] + w[o + 5] * sv[5];
}

// Eigenvalues of a symmetric 3x3 matrix [xx, yy, zz, xy, yz, xz], largest first (measuring only).
export function eig3(T) {
  const [a, b, c, d, e, f] = T;
  const p1 = d * d + e * e + f * f;
  if (p1 < 1e-18) return [a, b, c].sort((x, y) => y - x);
  const q = (a + b + c) / 3;
  const p2 = (a - q) ** 2 + (b - q) ** 2 + (c - q) ** 2 + 2 * p1;
  const p = Math.sqrt(p2 / 6);
  const B = [(a - q) / p, (b - q) / p, (c - q) / p, d / p, e / p, f / p];
  const det = B[0] * (B[1] * B[2] - B[4] * B[4]) - B[3] * (B[3] * B[2] - B[4] * B[5]) + B[5] * (B[3] * B[4] - B[1] * B[5]);
  const r = Math.max(-1, Math.min(1, det / 2));
  const phi = Math.acos(r) / 3;
  const e1 = q + 2 * p * Math.cos(phi), e3 = q + 2 * p * Math.cos(phi + 2 * Math.PI / 3);
  return [e1, 3 * q - e1 - e3, e3];
}

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
    // Geometry is part of the law too: face k shows the genome through its own lens, the genome
    // as it is plus the face's own twist T_k.
    this.T = new Float64Array(PATCHES * S * S).map(() => uni(Math.sqrt(3 / S)));
    this.lens = new Float64Array(PATCHES * S * S);

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
    // Orientation as a unit quaternion (w, x, y, z), random; spin (world frame) as hot as motion.
    this.rot = new Float64Array(n * 4);
    this.spin = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) {
      let w = gauss(wr), x = gauss(wr), y = gauss(wr), z = gauss(wr);
      const l = Math.sqrt(w * w + x * x + y * y + z * z) || 1;
      this.rot[i * 4] = w / l; this.rot[i * 4 + 1] = x / l; this.rot[i * 4 + 2] = y / l; this.rot[i * 4 + 3] = z / l;
    }
    for (let i = 0; i < n * 3; i++) this.spin[i] = gauss(wr) * this.p.heat / SQRT3 / Math.sqrt(INERTIA);

    this.q = new Float64Array(n * D);
    this.k = new Float64Array(n * D);
    this.v = new Float64Array(n * D);
    this.Mg = new Float64Array(n * S);
    this.gradG = new Float64Array(n * S);
    this.force = new Float64Array(n * 3);
    this.torque = new Float64Array(n * 3);
    this.R = new Float64Array(n * 9);    // rotation matrices, rows are the world axes in the body frame
    this.H = new Float64Array(n * PATCHES * S);  // each face's view of the genome, P_k g
    this.patch = new Float64Array(n * PATCHES);  // how open each face is, between 0 and 1
    this.fh = new Float64Array(4 * S);           // scratch for a pair: h_i, h_j, M h_i, M h_j
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
    // Each face's lens: P_k = I + faces * T_k.
    for (let f = 0; f < PATCHES; f++) for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
      const o = (f * S + a) * S + b;
      this.lens[o] = (a === b ? 1 : 0) + this.p.faces * this.T[o];
    }
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
      // Each face's view of the genome, and how open the face is: how strongly its lens reads
      // the genome, against the genome itself.
      let gg = 0;
      for (let b = 0; b < S; b++) gg += s[o + FAST + b] * s[o + FAST + b];
      for (let f = 0; f < PATCHES; f++) {
        let hh = 0;
        for (let a = 0; a < S; a++) {
          let x = 0;
          for (let b = 0; b < S; b++) x += this.lens[(f * S + a) * S + b] * s[o + FAST + b];
          this.H[(i * PATCHES + f) * S + a] = x;
          hh += x * x;
        }
        this.patch[i * PATCHES + f] = hh / (hh + gg + 1e-12);
      }
      // R maps body to world: column c is the body's axis c in world coordinates. A world
      // direction u seen in the body frame is R^T u.
      const w = this.rot[i * 4], x = this.rot[i * 4 + 1], y = this.rot[i * 4 + 2], z = this.rot[i * 4 + 3], R = this.R, r = i * 9;
      R[r] = 1 - 2 * (y * y + z * z); R[r + 1] = 2 * (x * y - w * z); R[r + 2] = 2 * (x * z + w * y);
      R[r + 3] = 2 * (x * y + w * z); R[r + 4] = 1 - 2 * (x * x + z * z); R[r + 5] = 2 * (y * z - w * x);
      R[r + 6] = 2 * (x * z - w * y); R[r + 7] = 2 * (y * z + w * x); R[r + 8] = 1 - 2 * (x * x + y * y);
    }
  }

  // A world direction (ux, uy, uz) seen in particle i's own frame, written into out.
  toBody(i, ux, uy, uz, out) {
    const R = this.R, r = i * 9;
    out[0] = R[r] * ux + R[r + 3] * uy + R[r + 6] * uz;
    out[1] = R[r + 1] * ux + R[r + 4] * uy + R[r + 7] * uz;
    out[2] = R[r + 2] * ux + R[r + 5] * uy + R[r + 8] * uz;
  }
  // A body-frame vector of particle i in world coordinates, written into out.
  toWorld(i, bx, by, bz, out) {
    const R = this.R, r = i * 9;
    out[0] = R[r] * bx + R[r + 1] * by + R[r + 2] * bz;
    out[1] = R[r + 3] * bx + R[r + 4] * by + R[r + 5] * bz;
    out[2] = R[r + 6] * bx + R[r + 7] * by + R[r + 8] * bz;
  }

  // The face part of a pair's match, h_i . M h_j, from each particle's face bumps toward the other
  // (si, sj). Leaves h_i, h_j, M h_i and M h_j in fh for the slopes.
  faceMatch(i, j, si, sj) {
    const { H, M, fh } = this;
    for (let a = 0; a < S; a++) {
      let x = 0, y = 0;
      for (let f = 0; f < PATCHES; f++) { x += si[f] * H[(i * PATCHES + f) * S + a]; y += sj[f] * H[(j * PATCHES + f) * S + a]; }
      fh[a] = x; fh[S + a] = y;
    }
    let X = 0;
    for (let a = 0; a < S; a++) {
      let mi = 0, mj = 0;
      for (let b = 0; b < S; b++) { mi += M[a * S + b] * fh[b]; mj += M[a * S + b] * fh[S + b]; }
      fh[2 * S + a] = mi; fh[3 * S + a] = mj;
      X += fh[a] * mj;
    }
    return X;
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
    const { attraction, sharpness, stateRate, drag, noise, depth, genomeRate, listen, space } = this.p;
    const { en, gotEat, lostEat, spent, lightAt, dir, demand, lightKey, lightVal, Wh } = this;
    const { sun, eatRate, eatGain, leak, thrust, efficiency, geometry } = this.p;
    const { R, H, lens, patch, fh, torque, rot, spin } = this;
    const ci6 = this._ci6 || (this._ci6 = new Float64Array(PATCHES)), cj6 = this._cj6 || (this._cj6 = new Float64Array(PATCHES));
    const tv = this._tv || (this._tv = new Float64Array(PATCHES));
    const open = 1 - geometry;
    const half = L / 2;
    const di = this._di || (this._di = new Float64Array(3)), dj = this._dj || (this._dj = new Float64Array(3));
    const gi3 = this._gi || (this._gi = new Float64Array(3)), gj3 = this._gj || (this._gj = new Float64Array(3));
    const wi3 = this._wi || (this._wi = new Float64Array(3)), wj3 = this._wj || (this._wj = new Float64Array(3));
    const si = this._si || (this._si = new Float64Array(PATCHES)), sj = this._sj || (this._sj = new Float64Array(PATCHES));
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
      wsum[i] = w + space;
      for (let a = 0; a < D; a++) msg[oi + a] = w * v[oi + a];
      // Light is attendable: it enters attention like one more neighbor, overhead, carrying the
      // light key, weighted by how bright it is here.
      dir[i * 3] = 0; dir[i * 3 + 1] = 0; dir[i * 3 + 2] = 0;
      if (lightAt[i] > 0) {
        let ml = 0;
        for (let a = 0; a < D; a++) ml += q[oi + a] * lightKey[a];
        let al = sharpness * ml * invSqrtD;
        // Light comes from straight up, seen in the particle's own frame.
        let wl = dexp(al) * (lightAt[i] / sun);
        if (geometry !== 0) wl *= open + geometry * patchAt(R[i * 9 + 6], R[i * 9 + 7], R[i * 9 + 8], patch, i * PATCHES, si, gi3);
        wsum[i] += wl;
        for (let a = 0; a < D; a++) msg[oi + a] += wl * lightVal[a];
        dir[i * 3 + 2] = wl;
      }
      selfE += this.selfTerm(s, oi + FAST, gradG, i * S);
      for (let a = 0; a < S; a++) gradG[i * S + a] *= depth;
    }
    selfE *= depth;
    force.fill(0);
    torque.fill(0);
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
              const r = Math.sqrt(r2);
              // Direction: where j sits in i's frame and where i sits in j's. Each shows the other
              // its genome through the faces turned that way, so the match is the same seen from
              // either side; attention is scaled by how open each particle's faces are that way.
              let ai = 1, aj = 1;
              if (geometry !== 0 && r > 1e-9) {
                const ux = ddx / r, uy = ddy / r, uz = ddz / r;
                this.toBody(i, ux, uy, uz, di);
                this.toBody(j, -ux, -uy, -uz, dj);
                const pi_ = patchAt(di[0], di[1], di[2], patch, i * PATCHES, si, gi3);
                const pj_ = patchAt(dj[0], dj[1], dj[2], patch, j * PATCHES, sj, gj3);
                gm = open * gm + geometry * (r2 / (r2 + NEAR * NEAR)) * this.faceMatch(i, j, si, sj);
                ai = open + geometry * pi_; aj = open + geometry * pj_;
              }
              const sym = dtanh(gm);
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
              let wij = dexp(sharpness * mij) * fall;
              let wji = dexp(sharpness * mji) * fall;
              if (geometry !== 0) { wij *= ai; wji *= aj; }
              if (listen !== 0) { const lb = dexp(listen * beta * sym); wij *= lb; wji *= lb; }
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

    this.np = np;

    // Pass 1b, coarse-grained attention: beyond its own and the neighboring cells, a particle hears
    // each cell as one blended thing, its members' average key and value, from their middle.
    const farW = this.farW || (this.farW = new Float64Array(n));
    farW.fill(0);
    const { coarse, far } = this.p;
    if (coarse > 0) {
      const nc = G * G * G;
      const bN = this.bN || (this.bN = new Int32Array(nc));
      const bX = this.bX || (this.bX = new Float64Array(nc * 3));
      const bK = this.bK || (this.bK = new Float64Array(nc * D));
      const bV = this.bV || (this.bV = new Float64Array(nc * D));
      for (let c = 0; c < nc; c++) {
        const m = cellStart[c + 1] - cellStart[c];
        bN[c] = m;
        for (let a = 0; a < 3; a++) bX[c * 3 + a] = 0;
        for (let a = 0; a < D; a++) { bK[c * D + a] = 0; bV[c * D + a] = 0; }
        if (m === 0) continue;
        for (let t = cellStart[c]; t < cellStart[c + 1]; t++) {
          const j = cellItems[t];
          for (let a = 0; a < 3; a++) bX[c * 3 + a] += pos[j * 3 + a];
          for (let a = 0; a < D; a++) { bK[c * D + a] += k[j * D + a]; bV[c * D + a] += v[j * D + a]; }
        }
        for (let a = 0; a < 3; a++) bX[c * 3 + a] /= m;
        for (let a = 0; a < D; a++) { bK[c * D + a] /= m; bV[c * D + a] /= m; }
      }
      const far2 = far * far, view = CONTACT * CONTACT;
      for (let i = 0; i < n; i++) {
        const oi = i * D, ci = cellOf[i];
        const cx = ci % G, cy = Math.floor(ci / G) % G, cz = Math.floor(ci / (G * G));
        const xi = pos[i * 3], yi = pos[i * 3 + 1], zi = pos[i * 3 + 2];
        for (let c = 0; c < nc; c++) {
          if (bN[c] === 0) continue;
          let ex = (c % G) - cx, ey = Math.floor(c / G) % G - cy;
          const ez = Math.floor(c / (G * G)) - cz;
          if (ex > G / 2) ex -= G; else if (ex < -G / 2) ex += G;
          if (ey > G / 2) ey -= G; else if (ey < -G / 2) ey += G;
          if (ex <= 1 && ex >= -1 && ey <= 1 && ey >= -1 && ez <= 1 && ez >= -1) continue; // heard one by one
          let ddx = bX[c * 3] - xi, ddy = bX[c * 3 + 1] - yi;
          const ddz = bX[c * 3 + 2] - zi;
          if (ddx > half) ddx -= L; else if (ddx < -half) ddx += L;
          if (ddy > half) ddy -= L; else if (ddy < -half) ddy += L;
          const r2 = ddx * ddx + ddy * ddy + ddz * ddz;
          if (r2 >= far2) continue;
          let m = 0;
          for (let a = 0; a < D; a++) m += q[oi + a] * bK[c * D + a];
          const fade = (1 - r2 / far2) * (1 - r2 / far2);
          let w = coarse * bN[c] * (view / r2) * fade * dexp(sharpness * m * invSqrtD);
          const r = Math.sqrt(r2), ux = ddx / r, uy = ddy / r, uz = ddz / r;
          if (geometry !== 0) {
            this.toBody(i, ux, uy, uz, di);
            w *= open + geometry * patchAt(di[0], di[1], di[2], patch, i * PATCHES, si, gi3);
          }
          wsum[i] += w; farW[i] += w;
          for (let a = 0; a < D; a++) msg[oi + a] += w * bV[c * D + a];
          dir[i * 3] += w * ux; dir[i * 3 + 1] += w * uy; dir[i * 3 + 2] += w * uz;
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
      // pull is the slope of the energy in the pair's match.
      const pull = -attraction * fall * e * (1 / P[i] + 1 / P[j]) * (1 - sym * sym);
      const gi = i * S, gj = j * S;
      if (geometry === 0 || r <= 1e-9) {
        for (let a = 0; a < S; a++) { gradG[gi + a] += pull * Mg[gj + a]; gradG[gj + a] += pull * Mg[gi + a]; }
        continue;
      }
      // With faces the match is open * (genome match) + geometry * near(r) * X, X = h_i . M h_j.
      const ux = ddx / r, uy = ddy / r, uz = ddz / r;
      const a2 = NEAR * NEAR, near = r * r / (r * r + a2), dnear = 2 * r * a2 / ((r * r + a2) * (r * r + a2));
      this.toBody(i, ux, uy, uz, di);
      this.toBody(j, -ux, -uy, -uz, dj);
      patchAt(di[0], di[1], di[2], patch, i * PATCHES, si, gi3);
      patchAt(dj[0], dj[1], dj[2], patch, j * PATCHES, sj, gj3);
      const X = this.faceMatch(i, j, si, sj);
      const kq = pull * geometry * near;
      // Genomes: through the plain match, and through each face's view, d(h_i . M h_j)/dg_i =
      // sum_k bump_k P_k^T (M h_j).
      for (let a = 0; a < S; a++) { gradG[gi + a] += pull * open * Mg[gj + a]; gradG[gj + a] += pull * open * Mg[gi + a]; }
      for (let f = 0; f < PATCHES; f++) {
        const wI = kq * si[f], wJ = kq * sj[f];
        for (let a = 0; a < S; a++) {
          const mJ = fh[3 * S + a], mI = fh[2 * S + a], row = (f * S + a) * S;
          for (let b = 0; b < S; b++) { gradG[gi + b] += wI * lens[row + b] * mJ; gradG[gj + b] += wJ * lens[row + b] * mI; }
        }
      }
      // Each face's share of the match: c_k = H_k . (M h_other). Its sum over the bumps is X, and
      // its slope on the sphere is how turning or moving changes X.
      for (let f = 0; f < PATCHES; f++) {
        let x = 0, y = 0;
        for (let a = 0; a < S; a++) { x += H[(i * PATCHES + f) * S + a] * fh[3 * S + a]; y += H[(j * PATCHES + f) * S + a] * fh[2 * S + a]; }
        ci6[f] = x; cj6[f] = y;
      }
      patchAt(di[0], di[1], di[2], ci6, 0, tv, gi3);
      patchAt(dj[0], dj[1], dj[2], cj6, 0, tv, gj3);
      const kg = pull * geometry;
      // The fade-in with distance pulls along the line between them, equal and opposite.
      const fr2 = kg * dnear * X;
      force[i * 3] += fr2 * ux; force[i * 3 + 1] += fr2 * uy; force[i * 3 + 2] += fr2 * uz;
      force[j * 3] -= fr2 * ux; force[j * 3 + 1] -= fr2 * uy; force[j * 3 + 2] -= fr2 * uz;
      // Each match slope on the sphere, in world coordinates.
      this.toWorld(i, gi3[0], gi3[1], gi3[2], wi3);
      this.toWorld(j, gj3[0], gj3[1], gj3[2], wj3);
      const cI = kq, cJ = kq;
      // Moving j sideways around i changes what both see; that slope, across the line between
      // them, is a force on each, equal and opposite.
      let Gx = cI * wi3[0] - cJ * wj3[0], Gy = cI * wi3[1] - cJ * wj3[1], Gz = cI * wi3[2] - cJ * wj3[2];
      const Gu = Gx * ux + Gy * uy + Gz * uz;
      Gx = (Gx - Gu * ux) / r; Gy = (Gy - Gu * uy) / r; Gz = (Gz - Gu * uz) / r;
      force[i * 3] += Gx; force[i * 3 + 1] += Gy; force[i * 3 + 2] += Gz;
      force[j * 3] -= Gx; force[j * 3 + 1] -= Gy; force[j * 3 + 2] -= Gz;
      // Turning either particle changes what it sees; those are the torques. Together with the
      // sideways forces they add up to no net twist on the world.
      torque[i * 3] += cI * (uy * wi3[2] - uz * wi3[1]);
      torque[i * 3 + 1] += cI * (uz * wi3[0] - ux * wi3[2]);
      torque[i * 3 + 2] += cI * (ux * wi3[1] - uy * wi3[0]);
      torque[j * 3] -= cJ * (uy * wj3[2] - uz * wj3[1]);
      torque[j * 3 + 1] -= cJ * (uz * wj3[0] - ux * wj3[2]);
      torque[j * 3 + 2] -= cJ * (ux * wj3[1] - uy * wj3[0]);
    }

    let kin = 0;
    for (let i = 0; i < n * 3; i++) kin += vel[i] * vel[i] + INERTIA * spin[i] * spin[i];
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
    // Shaking light: a bonded particle keeps 1 - shake of its light, and the rest goes into its bonds.
    const shake = this.p.shake;
    const bonds = this.bondDeg || (this.bondDeg = new Int32Array(n));
    if (shake > 0) {
      bonds.fill(0);
      for (let b = 0; b < this.bondCount; b++) { bonds[this.bondA[b]]++; bonds[this.bondB[b]]++; }
    }
    for (let i = 0; i < n; i++) en[i] += shake > 0 && bonds[i] > 0 ? (1 - shake) * this.gotLight[i] : this.gotLight[i];
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

    // Each bond gets its share of the shaken light as a push apart along the bond. The pair's
    // kinetic energy rises by exactly E: with w the speed at which they already separate, the push
    // a solves a^2 + a w = E (each has mass 1, so the pair's energy changes by a w + a^2).
    let shaken = 0;
    if (shake > 0) {
      for (let b = 0; b < this.bondCount; b++) {
        const i = this.bondA[b], j = this.bondB[b];
        const E = shake * (this.gotLight[i] / bonds[i] + this.gotLight[j] / bonds[j]);
        if (E <= 0) continue;
        let dx = pos[j * 3] - pos[i * 3], dy = pos[j * 3 + 1] - pos[i * 3 + 1], dz = pos[j * 3 + 2] - pos[i * 3 + 2];
        if (dx > half) dx -= L; else if (dx < -half) dx += L;
        if (dy > half) dy -= L; else if (dy < -half) dy += L;
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (r < 1e-12) continue;
        const ux = dx / r, uy = dy / r, uz = dz / r;
        const w = (vel[j * 3] - vel[i * 3]) * ux + (vel[j * 3 + 1] - vel[i * 3 + 1]) * uy + (vel[j * 3 + 2] - vel[i * 3 + 2]) * uz;
        const a = (Math.sqrt(w * w + 4 * E) - w) / 2;
        vel[i * 3] -= a * ux; vel[i * 3 + 1] -= a * uy; vel[i * 3 + 2] -= a * uz;
        vel[j * 3] += a * ux; vel[j * 3 + 1] += a * uy; vel[j * 3 + 2] += a * uz;
        shaken += E;
      }
    }
    this.shaken = shaken;

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
    // Turn: spin follows the torque with the same drag, then the orientation turns by the spin.
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const wx = (spin[o] + DT * torque[o] / INERTIA) * damp;
      const wy = (spin[o + 1] + DT * torque[o + 1] / INERTIA) * damp;
      const wz = (spin[o + 2] + DT * torque[o + 2] / INERTIA) * damp;
      spin[o] = wx; spin[o + 1] = wy; spin[o + 2] = wz;
      const r = i * 4, qw = rot[r], qx = rot[r + 1], qy = rot[r + 2], qz = rot[r + 3], h2 = DT / 2;
      let nw = qw - h2 * (wx * qx + wy * qy + wz * qz);
      let nx = qx + h2 * (qw * wx + wy * qz - wz * qy);
      let ny = qy + h2 * (qw * wy + wz * qx - wx * qz);
      let nz = qz + h2 * (qw * wz + wx * qy - wy * qx);
      const l = Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz);
      rot[r] = nw / l; rot[r + 1] = nx / l; rot[r + 2] = ny / l; rot[r + 3] = nz / l;
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

  // Total angular momentum (orbital about the box's center plus spin), for checking that the
  // forces and torques are balanced. Only meaningful while nothing crosses the wrap.
  angularMomentum() {
    const c = this.L / 2, L = [0, 0, 0];
    for (let i = 0; i < this.n; i++) {
      const x = this.pos[i * 3] - c, y = this.pos[i * 3 + 1] - c, z = this.pos[i * 3 + 2] - c;
      const vx = this.vel[i * 3], vy = this.vel[i * 3 + 1], vz = this.vel[i * 3 + 2];
      L[0] += y * vz - z * vy + INERTIA * this.spin[i * 3];
      L[1] += z * vx - x * vz + INERTIA * this.spin[i * 3 + 1];
      L[2] += x * vy - y * vx + INERTIA * this.spin[i * 3 + 2];
    }
    return L;
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

  // The shape of every bonded group: its bond graph and how it fills space. Run census() first so
  // kinds are current. Measuring only; nothing here feeds back into the world.
  //   chain: no branches and no loops; ring: one loop and no branches; tree: branches, no loops;
  //   sheet: loops, and flat (its thinnest extent is small next to the other two); blob: the rest.
  // A group's signature is a hash of its bond graph labeled by element (three rounds of
  // Weisfeiler-Lehman refinement), so two groups with the same arrangement of the same elements
  // share a signature wherever they are and however they are turned.
  shapes(minSize = 3) {
    const { n, pos, L, kind } = this, half = L / 2;
    const parent = new Int32Array(n);
    for (let i = 0; i < n; i++) parent[i] = i;
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const adj = Array.from({ length: n }, () => []);
    for (let b = 0; b < this.bondCount; b++) {
      const a = this.bondA[b], c = this.bondB[b];
      adj[a].push(c); adj[c].push(a);
      const ra = find(a), rc = find(c);
      if (ra !== rc) parent[ra < rc ? rc : ra] = ra < rc ? ra : rc;
    }
    const members = new Map();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      if (!members.has(r)) members.set(r, []);
      members.get(r).push(i);
    }
    const fnv = (str) => { let h = 0x811c9dc5; for (let k = 0; k < str.length; k++) h = Math.imul(h ^ str.charCodeAt(k), 16777619); return (h >>> 0).toString(36); };
    const out = [];
    const ux = new Float64Array(n), uy = new Float64Array(n), uz = new Float64Array(n), seen = new Uint8Array(n);
    for (const [, m] of members) {
      if (m.length < minSize) continue;
      let edges = 0, maxDeg = 0, branch = 0;
      for (const i of m) { edges += adj[i].length; maxDeg = Math.max(maxDeg, adj[i].length); if (adj[i].length >= 3) branch++; }
      edges /= 2;
      const loops = edges - m.length + 1;
      // Lay the group out without the wrap by walking its bonds, then its spread along three axes.
      const stack = [m[0]]; seen[m[0]] = 1; ux[m[0]] = pos[m[0] * 3]; uy[m[0]] = pos[m[0] * 3 + 1]; uz[m[0]] = pos[m[0] * 3 + 2];
      while (stack.length) {
        const i = stack.pop();
        for (const j of adj[i]) {
          if (seen[j]) continue;
          seen[j] = 1;
          let dx = pos[j * 3] - pos[i * 3], dy = pos[j * 3 + 1] - pos[i * 3 + 1];
          if (dx > half) dx -= L; else if (dx < -half) dx += L;
          if (dy > half) dy -= L; else if (dy < -half) dy += L;
          ux[j] = ux[i] + dx; uy[j] = uy[i] + dy; uz[j] = pos[j * 3 + 2];
          stack.push(j);
        }
      }
      let cx = 0, cy = 0, cz = 0;
      for (const i of m) { cx += ux[i]; cy += uy[i]; cz += uz[i]; seen[i] = 0; }
      cx /= m.length; cy /= m.length; cz /= m.length;
      const T = [0, 0, 0, 0, 0, 0];
      for (const i of m) {
        const x = ux[i] - cx, y = uy[i] - cy, z = uz[i] - cz;
        T[0] += x * x; T[1] += y * y; T[2] += z * z; T[3] += x * y; T[4] += y * z; T[5] += x * z;
      }
      const ev = eig3(T.map((v) => v / m.length));
      const elong = ev[0] > 1e-12 ? 1 - ev[1] / ev[0] : 0;
      const flat = ev[1] > 1e-12 ? 1 - ev[2] / ev[1] : 0;
      let cls;
      if (maxDeg <= 2) cls = loops === 0 ? 'chain' : 'ring';
      else if (loops === 0) cls = 'tree';
      else cls = m.length >= 6 && flat > 0.85 ? 'sheet' : 'blob';
      // Signature: refine element labels by neighbors' labels three times.
      let lab = new Map();
      for (const i of m) lab.set(i, String(kind[i]));
      for (let it = 0; it < 3; it++) {
        const next = new Map();
        for (const i of m) next.set(i, fnv(lab.get(i) + '|' + adj[i].map((j) => lab.get(j)).sort().join(',')));
        lab = next;
      }
      const sig = fnv(m.length + ':' + [...lab.values()].sort().join(','));
      const kinds = new Set(m.map((i) => kind[i])).size;
      out.push({ root: m[0], members: m, size: m.length, edges, loops, maxDeg, branch, cls, elong, flat, sig, kinds });
    }
    return out;
  }

  // A fingerprint of the whole world: identical worlds give identical hashes.
  hash() {
    let h = 0x811c9dc5;
    for (const arr of [this.pos, this.vel, this.s, this.en, this.rot, this.spin]) {
      const words = new Uint32Array(arr.buffer, arr.byteOffset, arr.length * 2);
      for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i], 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}
