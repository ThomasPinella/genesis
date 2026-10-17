// Genesis, experiment 1: particles that interact by attention, with balanced forces and drag.
//
// Determinism: step() uses only +, -, *, /, Math.sqrt, Math.floor and Math.round, which IEEE 754
// defines exactly. exp and tanh are computed here from those operations instead of Math.exp and
// Math.tanh, whose last bits can differ between browsers. Randomness comes from two integer
// PRNG streams: the law seed (the physics) and the world seed (the starting conditions).

export const D = 8;     // numbers in each particle's state
export const FAST = 4;  // state[0..3] is the fast state; state[4..7] is the slow state (the genome)

export const DEFAULTS = {
  worldSeed: 1,
  lawSeed: 2,
  n: 3000,          // particle count (fixed: matter is conserved)
  density: 4,       // particles per unit volume; sets the size of the box
  heat: 2.0,        // starting speed of every particle
  drag: 0.08,       // fraction of velocity lost per unit time; the world's only heat sink
  attraction: 1.5,  // strength of the match-based pull (or push, when the match is negative)
  sharpness: 1.5,   // how selective attention is
  stateRate: 0.1,   // how fast the fast state follows its update
  spread: 0.4,      // how different the starting genomes are (0 = identical)
  noise: 0,         // optional jitter per tick; off by default, and seeded when on
};

const RANGE = 1.0;      // interaction range: nothing farther than this is felt
const CONTACT = 0.35;    // closer than this, particles push apart
const REPULSION = 8;
const DT = 0.05;
const LAW_GAIN = 1.6;   // gain of the state update; above 1 it allows several stable states
const BOND_DIST = CONTACT * 1.4;
const BOND_MATCH = 0.25;

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

    // Starting conditions: even scatter, fast random motion, nearly shared genome.
    const wr = rng(worldSeed * 2246822519 + 1);
    const genome = new Float64Array(D - FAST).map(() => wr() * 2 - 1);
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
      for (let a = FAST; a < D; a++) this.s[i * D + a] = genome[a - FAST] + (wr() * 2 - 1) * this.p.spread;
    }

    this.q = new Float64Array(n * D);
    this.k = new Float64Array(n * D);
    this.v = new Float64Array(n * D);
    this.qSlow = new Float64Array(n * D);
    this.kSlow = new Float64Array(n * D);
    this.force = new Float64Array(n * 3);
    this.msg = new Float64Array(n * D);
    this.wsum = new Float64Array(n);
    this.cellStart = new Int32Array(this.G * this.G * this.G + 1);
    this.cellItems = new Int32Array(n);
    this.cellOf = new Int32Array(n);
    this.maxBonds = n * 6;
    this.bondA = new Int32Array(this.maxBonds);
    this.bondB = new Int32Array(this.maxBonds);
    this.bondCount = 0;
  }

  set(name, value) { this.p[name] = value; }

  project() {
    const { n, s, q, k, v, Wq, Wk, Wv } = this;
    const sq_ = this.qSlow, sk_ = this.kSlow;
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
        // The same query and key, read from the slow state alone. Passive forces use these, so
        // what pulls on a particle depends on what it is, not on what it is currently doing.
        let gq = 0, gk = 0;
        for (let b = FAST; b < D; b++) { const x = s[o + b]; gq += Wq[w + b] * x; gk += Wk[w + b] * x; }
        sq_[o + a] = gq; sk_[o + a] = gk;
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

  step() {
    const { n, L, G, pos, vel, s, s2, q, k, v, force, msg, wsum, cellStart, cellItems, cellOf, Wu, bu } = this;
    const { attraction, sharpness, stateRate, drag, noise } = this.p;
    const half = L / 2;
    const invSqrtD = 1 / Math.sqrt(D);
    const invSqrtSlow = 1 / Math.sqrt(D - FAST);
    const { qSlow, kSlow } = this;
    const rc2 = RANGE * RANGE;
    const x16 = new Float64Array(2 * D);

    this.project();
    this.buildGrid();
    this.bondCount = 0;

    // Attention always includes yourself, so an isolated particle still updates.
    for (let i = 0; i < n; i++) {
      const oi = i * D;
      let selfDot = 0;
      for (let a = 0; a < D; a++) selfDot += q[oi + a] * k[oi + a];
      const w = dexp(sharpness * selfDot * invSqrtD);
      wsum[i] = w;
      for (let a = 0; a < D; a++) msg[oi + a] = w * v[oi + a];
    }
    force.fill(0);

    // Every pair within range is visited once, always from its lower index, in a fixed order.
    for (let i = 0; i < n; i++) {
      const oi = i * D;
      const xi = pos[i * 3], yi = pos[i * 3 + 1], zi = pos[i * 3 + 2];
      let fx = 0, fy = 0, fz = 0;
      const c = cellOf[i];
      const cx = c % G, cy = Math.floor(c / G) % G, cz = Math.floor(c / (G * G));
      for (let dz = -1; dz <= 1; dz++) {
        const zz = (cz + dz + G) % G;
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
              if (ddz > half) ddz -= L; else if (ddz < -half) ddz += L;
              const r2 = ddx * ddx + ddy * ddy + ddz * ddz;
              if (r2 >= rc2) continue;

              const oj = j * D;
              let mij = 0, mji = 0, gij = 0, gji = 0;
              for (let a = 0; a < D; a++) {
                mij += q[oi + a] * k[oj + a]; mji += q[oj + a] * k[oi + a];
                gij += qSlow[oi + a] * kSlow[oj + a]; gji += qSlow[oj + a] * kSlow[oi + a];
              }
              mij *= invSqrtD; mji *= invSqrtD;

              // Balanced force: one symmetric match per pair, applied equal and opposite.
              // Positive match pulls together, negative pushes apart. It reads only the slow
              // state: if changing your fast state reshaped the forces, it would create motion
              // energy for free. Doing that has to be paid for (experiment 2).
              const sym = dtanh(0.5 * (gij + gji) * invSqrtSlow);
              const r = Math.sqrt(r2);
              if (r > 1e-9) {
                let f;
                if (r < CONTACT) f = -REPULSION * (1 - r / CONTACT);
                else { const u = (r - CONTACT) / (RANGE - CONTACT); f = attraction * sym * 4 * u * (1 - u); }
                const fr = f / r;
                fx += fr * ddx; fy += fr * ddy; fz += fr * ddz;
                force[j * 3] -= fr * ddx; force[j * 3 + 1] -= fr * ddy; force[j * 3 + 2] -= fr * ddz;
              }

              // Attention may be lopsided: i listens to j by how well i's query matches j's key,
              // and j listens to i by how well j's query matches i's key. Both fade to zero at
              // the edge of the range.
              const fall = (1 - r2 / rc2) * (1 - r2 / rc2);
              const wij = dexp(sharpness * mij) * fall;
              const wji = dexp(sharpness * mji) * fall;
              wsum[i] += wij; wsum[j] += wji;
              for (let a = 0; a < D; a++) { msg[oi + a] += wij * v[oj + a]; msg[oj + a] += wji * v[oi + a]; }

              if (r < BOND_DIST && sym > BOND_MATCH && this.bondCount < this.maxBonds) {
                this.bondA[this.bondCount] = i; this.bondB[this.bondCount] = j; this.bondCount++;
              }
            }
          }
        }
      }
      force[i * 3] += fx; force[i * 3 + 1] += fy; force[i * 3 + 2] += fz;
    }

    for (let i = 0; i < n; i++) {
      const oi = i * D;
      // Fast state follows a nonlinear update of (own state, what it heard). Slow state is fixed
      // in this experiment: imprinting arrives in experiment 3.
      const inv = 1 / wsum[i];
      for (let a = 0; a < D; a++) { x16[a] = s[oi + a]; x16[D + a] = msg[oi + a] * inv; }
      for (let a = 0; a < FAST; a++) {
        let z = bu[a];
        const w0 = a * 2 * D;
        for (let b = 0; b < 2 * D; b++) z += Wu[w0 + b] * x16[b];
        s2[oi + a] = s[oi + a] + stateRate * (dtanh(z) - s[oi + a]);
      }
      for (let a = FAST; a < D; a++) s2[oi + a] = s[oi + a];
    }

    // Integrate: forces, optional seeded noise, drag (the sink), then move and wrap around.
    const damp = 1 - drag * DT;
    const kick = noise > 0 ? noise * Math.sqrt(DT) : 0;
    for (let i = 0; i < n * 3; i++) {
      let vv = vel[i] + DT * force[i];
      if (kick > 0) vv += kick * gauss(this.noiseRng);
      vv *= damp;
      vel[i] = vv;
      let x = pos[i] + DT * vv;
      x -= L * Math.floor(x / L);
      if (x >= L) x = 0;
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
    const S = D - FAST, sum = new Float64Array(this.n * S), all = new Float64Array(S);
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
    for (const arr of [this.pos, this.vel, this.s]) {
      const words = new Uint32Array(arr.buffer, arr.byteOffset, arr.length * 2);
      for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i], 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}
