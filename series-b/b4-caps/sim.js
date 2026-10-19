// Genesis series B, experiment B4: caps. The day/night soup of B2 and B3, where some balls carry
// a single spot instead of four.
//
// B2 and B3 showed that groups never finish: with four spots on every ball, nearly every group keeps
// open spots and keeps growing until it joins the net, and anything that makes groups sturdier makes
// the net sturdier too. A ball with one spot (a cap, like hydrogen in real chemistry) ends a branch:
// once it is bonded it has nothing left to offer. With enough caps a group can use up all its open
// spots and become complete, a molecule that has no reason to stick to anything. CAPS is the share of
// balls that are caps; the law is unchanged. A cap keeps its one spot at a corner of the same
// tetrahedron; the other three corners are bare (sign 0) and feel nothing.
//
// From B3 (TEAMWORK defaults to 0 here, so the bonds are B2's plain bonds unless it is turned up):
//
// Genesis series B, experiment B3: teamwork bonds. The day/night soup of B2, where a ball holds
// each partner harder the more partners it has.
//
// B2 showed that with every bond equally strong, heat cannot tell a well-built group from a loose
// one: a day hot enough to melt the net melts everything. B3 adds one term to the energy:
//
//   U_team = - TEAMWORK/2 * sum over balls of h_i^2,   h_i = sum over ball i's bonds of (1 - d^2/RC^2)^2
//
// h_i counts how bonded ball i is (a full bond counts 1, a stretched one less). Because the term
// grows as the square, each extra bond on a ball deepens all of that ball's bonds by TEAMWORK: a bond
// between two balls that each hold two other partners is stronger than a lone bond. Rings and cages,
// where every ball holds several partners, should outlast loose chains. It is still one energy, so
// forces and torques are its slopes. TEAMWORK 0 gives B2's physics (the forces are added up in a
// different order, so runs drift apart in the last digits and then diverge).
//
// From B2:
//
// B1 showed that cooling alone ends in one tangled net, and that a sealed box stays too hot to build
// anything. Here every ball touches a bath whose temperature swings between a warm day and a cool
// night. Each ball, on its own, is nudged toward the bath's temperature: sped up when it is slower,
// slowed down when it is faster. Nothing is random and nothing reaches beyond the ball itself.
// Energy comes in when the bath is warmer than the soup and leaves when it is cooler, so the books
// are: energy now + heat taken out = energy at the start.
//
// The rest is B1 unchanged:
//
// Each particle is a ball with four spots at the corners of a tetrahedron, and each spot is + or -.
// That is the whole chemistry:
//
//   U = sum over pairs of bodies closer than 1:   K/2 (1 - r)^2                 nothing overlaps
//     + sum over pairs of spots closer than RC:   STRENGTH * s_a * s_b * (1 - d^2/RC^2)^2
//
// Opposite spots (s_a s_b = -1) pull together, like spots push apart, and the pull is short enough
// that a spot can hold only one partner: that is the bond limit. There is no attention, no genome
// and no list of molecules; a particle's kind (how many of its spots are +) is fixed at the start.
// Spots exert forces at the surface, so they also turn the bodies.
//
// The world is a box that wraps on every side. Translation and rotation use a velocity Verlet step; the body is a uniform ball, so its
// inertia is the same about every axis.
//
// Determinism: step() uses only +, -, *, /, Math.sqrt, Math.floor and Math.round, which IEEE 754
// defines exactly. Randomness only sets the starting conditions, from one integer PRNG stream.

export const SPOTS = 4;
export const DEFAULTS = {
  seed: 1,
  n: 1500,          // particle count (fixed: matter is conserved)
  density: 0.3,     // particles per unit volume (a body is 1 across)
  mix: 'random',    // which kinds exist: 'random' (every spot a coin flip, all five kinds),
                    // 'water' (all two + and two -), 'pairs' (half three +, half three -)
  heat: 0.5,        // starting temperature (bonds start to hold below about 0.2)
  day: 0.2,         // bath temperature by day
  night: 0.06,      // bath temperature by night
  period: 100,      // time from one dawn to the next; half is day, half is night
  dawn: 0.5,        // time of the first dawn, as a share of a period (the world starts at night)
  coupling: 1,      // how fast a ball follows the bath, per unit time
  teamwork: 0,      // how much each bond on a ball strengthens that ball's other bonds (B3)
  caps: 0.5,        // share of balls that carry a single spot
  capSign: 'both',  // 'both': half the caps are + and half -; 'plus': every cap is +, and the
                    // four-spot balls carry the matching extra - spots, so + and - still balance
  strength: 1,      // how strongly spots pull or push
};

export const RADIUS = 0.5;  // a body is 1 across; spots sit on its surface
export const RC = 0.3;      // spot reach
const K = 60;               // stiffness of the no-overlap push
const DT = 0.01;
const INERTIA = 0.1;        // a uniform ball of mass 1 and radius 0.5: 2/5 m r^2
const REACH = 2 * RADIUS + RC; // farther apart than this, two bodies cannot feel each other
export const BOND = 0.6 * RC;  // opposite spots this close count as bonded (measuring only)
export const TICK = DT;

const S3 = 1 / Math.sqrt(3);
// Corners of a tetrahedron in the body's own frame.
export const BODY = [S3, S3, S3, S3, -S3, -S3, -S3, S3, -S3, -S3, -S3, S3];

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
const SQRT3 = Math.sqrt(3);
function gauss(r) { return (r() + r() + r() + r() - 2) * SQRT3; }

function dcbrt(v) {
  let x = v > 1 ? v / 3 : 1;
  for (let i = 0; i < 60; i++) x = x - (x * x * x - v) / (3 * x * x);
  return x;
}

export class Sim {
  constructor(params = {}) {
    this.p = { ...DEFAULTS, ...params };
    const { n, density, seed, mix, heat } = this.p;
    this.n = n;
    this.L = dcbrt(n / density);
    this.G = Math.max(3, Math.floor(this.L / REACH));
    this.cell = this.L / this.G;
    this.tick = 0;
    this.time = 0;
    this.heatLost = 0; // net energy taken away by the bath, so the books can be checked

    this.pos = new Float64Array(n * 3);
    this.vel = new Float64Array(n * 3);
    this.q = new Float64Array(n * 4);    // orientation quaternion (w, x, y, z)
    this.L3 = new Float64Array(n * 3);   // angular momentum
    this.spot = new Float64Array(n * SPOTS * 3); // spot offsets from the center, in the world frame
    this.sign = new Int8Array(n * SPOTS);
    this.force = new Float64Array(n * 3);
    this.torque = new Float64Array(n * 3);
    this.cellStart = new Int32Array(this.G * this.G * this.G + 1);
    this.cellItems = new Int32Array(n);
    this.cellOf = new Int32Array(n);
    this.potential = 0;
    this.hold = new Float64Array(n);              // how bonded each ball is (the h of the teamwork term)
    this.spotPairs = new Float64Array(n * 32);    // spot pairs in reach, found in the first pass of forces()

    const r = rng(seed * 2654435761 + 12345);
    // Signs. Every mix has as many + spots as - spots.
    if (mix === 'water') {
      for (let i = 0; i < n; i++) this.sign.set([1, 1, -1, -1], i * SPOTS);
    } else if (mix === 'pairs') {
      const kinds = Array.from({ length: n }, (_, i) => (i % 2 ? 3 : 1));
      shuffle(kinds, r);
      for (let i = 0; i < n; i++) for (let a = 0; a < SPOTS; a++) this.sign[i * SPOTS + a] = a < kinds[i] ? 1 : -1;
    } else {
      // Caps: an even number of balls with one spot, half + and half -. The rest are B1's random
      // four-spot balls, with as many + spots as - spots.
      const nc = 2 * Math.round(this.p.caps * n / 2);
      const plusOnly = this.p.capSign === 'plus';
      const isCap = Array.from({ length: n }, (_, i) => (i < nc ? (plusOnly || i % 2 ? 1 : -1) : 0));
      shuffle(isCap, r);
      const nf = (n - nc) * SPOTS, extra = plusOnly ? nc : 0; // - spots the four-spot balls carry beyond half
      const four = Array.from({ length: nf }, (_, k) => (k < extra ? -1 : (k - extra) % 2 ? 1 : -1));
      shuffle(four, r);
      let t = 0;
      for (let i = 0; i < n; i++) {
        if (isCap[i]) { this.sign[i * SPOTS] = isCap[i]; for (let a = 1; a < SPOTS; a++) this.sign[i * SPOTS + a] = 0; }
        else for (let a = 0; a < SPOTS; a++) this.sign[i * SPOTS + a] = four[t++];
      }
    }
    // Positions: random, with no two bodies overlapping.
    for (let i = 0; i < n; i++) {
      for (let tries = 0; ; tries++) {
        const x = r() * this.L, y = r() * this.L, z = r() * this.L;
        let ok = true;
        for (let j = 0; j < i && ok; j++) {
          const dx = this.wrap(x - this.pos[j * 3]), dy = this.wrap(y - this.pos[j * 3 + 1]), dz = this.wrap(z - this.pos[j * 3 + 2]);
          if (dx * dx + dy * dy + dz * dz < 1.1 * 1.1) ok = false;
        }
        if (ok || tries > 1000) { this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; break; }
      }
      let w = gauss(r), a = gauss(r), b = gauss(r), c = gauss(r);
      const m = Math.sqrt(w * w + a * a + b * b + c * c);
      this.q.set([w / m, a / m, b / m, c / m], i * 4);
      const sv = Math.sqrt(heat), sw = Math.sqrt(heat * INERTIA);
      for (let d = 0; d < 3; d++) { this.vel[i * 3 + d] = gauss(r) * sv; this.L3[i * 3 + d] = gauss(r) * sw; }
    }
    // No drift of the whole box.
    for (let d = 0; d < 3; d++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += this.vel[i * 3 + d];
      s /= n;
      for (let i = 0; i < n; i++) this.vel[i * 3 + d] -= s;
    }
    this.orient();
    this.forces();
  }

  wrap(d) { return d - this.L * Math.round(d / this.L); }

  // Spot offsets in the world frame from each orientation.
  orient() {
    const { n, q, spot } = this;
    for (let i = 0; i < n; i++) {
      const w = q[i * 4], x = q[i * 4 + 1], y = q[i * 4 + 2], z = q[i * 4 + 3];
      const r00 = 1 - 2 * (y * y + z * z), r01 = 2 * (x * y - w * z), r02 = 2 * (x * z + w * y);
      const r10 = 2 * (x * y + w * z), r11 = 1 - 2 * (x * x + z * z), r12 = 2 * (y * z - w * x);
      const r20 = 2 * (x * z - w * y), r21 = 2 * (y * z + w * x), r22 = 1 - 2 * (x * x + y * y);
      for (let a = 0; a < SPOTS; a++) {
        const bx = BODY[a * 3] * RADIUS, by = BODY[a * 3 + 1] * RADIUS, bz = BODY[a * 3 + 2] * RADIUS;
        const o = (i * SPOTS + a) * 3;
        spot[o] = r00 * bx + r01 * by + r02 * bz;
        spot[o + 1] = r10 * bx + r11 * by + r12 * bz;
        spot[o + 2] = r20 * bx + r21 * by + r22 * bz;
      }
    }
  }

  grid() {
    const { n, G, cell, pos, cellStart, cellItems, cellOf } = this;
    cellStart.fill(0);
    for (let i = 0; i < n; i++) {
      let cx = Math.floor(pos[i * 3] / cell), cy = Math.floor(pos[i * 3 + 1] / cell), cz = Math.floor(pos[i * 3 + 2] / cell);
      if (cx >= G) cx = G - 1; if (cy >= G) cy = G - 1; if (cz >= G) cz = G - 1;
      const c = (cx * G + cy) * G + cz;
      cellOf[i] = c;
      cellStart[c + 1]++;
    }
    for (let c = 0; c < G * G * G; c++) cellStart[c + 1] += cellStart[c];
    const fill = cellStart.slice(0, G * G * G);
    for (let i = 0; i < n; i++) cellItems[fill[cellOf[i]]++] = i;
  }

  // Calls fn(i, j, dx, dy, dz, r2) once for every pair of bodies close enough to feel each other,
  // with (dx, dy, dz) the shortest way from i to j.
  pairs(fn) {
    const { n, G, pos, cellStart, cellItems, cellOf } = this;
    this.grid();
    const R2 = REACH * REACH;
    for (let i = 0; i < n; i++) {
      const c = cellOf[i];
      const cx = Math.floor(c / (G * G)), cy = Math.floor(c / G) % G, cz = c % G;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
        const cc = ((((cx + ox + G) % G) * G + ((cy + oy + G) % G)) * G) + ((cz + oz + G) % G);
        for (let t = cellStart[cc], end = cellStart[cc + 1]; t < end; t++) {
          const j = cellItems[t];
          if (j <= i) continue;
          const dx = this.wrap(pos[j * 3] - pos[i * 3]), dy = this.wrap(pos[j * 3 + 1] - pos[i * 3 + 1]), dz = this.wrap(pos[j * 3 + 2] - pos[i * 3 + 2]);
          const r2 = dx * dx + dy * dy + dz * dz;
          if (r2 < R2) fn(i, j, dx, dy, dz, r2);
        }
      }
    }
  }

  forces() {
    const { n, force, torque, spot, sign, hold } = this;
    const eps = this.p.strength, team = this.p.teamwork, RC2 = RC * RC;
    force.fill(0);
    torque.fill(0);
    let U = 0;
    // First pass: the no-overlap push, and every pair of spots in reach, kept for the second pass.
    let sp = this.spotPairs;
    let m = 0;
    hold.fill(0);
    this.pairs((i, j, dx, dy, dz, r2) => {
      if (r2 < 1) {
        const r = Math.sqrt(r2), over = 1 - r;
        U += 0.5 * K * over * over;
        const f = K * over / r; // push j away from i
        force[i * 3] -= f * dx; force[i * 3 + 1] -= f * dy; force[i * 3 + 2] -= f * dz;
        force[j * 3] += f * dx; force[j * 3 + 1] += f * dy; force[j * 3 + 2] += f * dz;
      }
      for (let a = 0; a < SPOTS; a++) {
        if (!sign[i * SPOTS + a]) continue;
        const oa = (i * SPOTS + a) * 3;
        for (let b = 0; b < SPOTS; b++) {
          if (!sign[j * SPOTS + b]) continue;
          const ob = (j * SPOTS + b) * 3;
          const ex = dx + spot[ob] - spot[oa], ey = dy + spot[ob + 1] - spot[oa + 1], ez = dz + spot[ob + 2] - spot[oa + 2];
          const d2 = ex * ex + ey * ey + ez * ez;
          if (d2 >= RC2) continue;
          if (m * 8 >= sp.length) { const g = new Float64Array(sp.length * 2); g.set(sp); sp = this.spotPairs = g; }
          const u = 1 - d2 / RC2;
          const o = m * 8;
          sp[o] = i; sp[o + 1] = a; sp[o + 2] = j; sp[o + 3] = b; sp[o + 4] = ex; sp[o + 5] = ey; sp[o + 6] = ez; sp[o + 7] = u;
          m++;
          if (sign[i * SPOTS + a] !== sign[j * SPOTS + b]) { hold[i] += u * u; hold[j] += u * u; }
        }
      }
    });
    // Second pass: each spot pair's energy and force. For opposite spots the depth is the base
    // strength plus teamwork from both balls' other bonds: dU/d(u^2) = -(eps + team (h_i + h_j)).
    for (let i = 0; i < n; i++) U -= 0.5 * team * hold[i] * hold[i];
    for (let t = 0; t < m; t++) {
      const o = t * 8;
      const i = sp[o], a = sp[o + 1], j = sp[o + 2], b = sp[o + 3], ex = sp[o + 4], ey = sp[o + 5], ez = sp[o + 6], u = sp[o + 7];
      const like = sign[i * SPOTS + a] === sign[j * SPOTS + b];
      if (like) U += eps * u * u; else U -= eps * u * u;
      const ss = like ? eps : -(eps + team * (hold[i] + hold[j]));
      // Force on spot b of j is -dU/d(e) = 4 ss u / RC2 * e; spot a of i gets the opposite.
      const g = 4 * ss * u / RC2;
      const fx = g * ex, fy = g * ey, fz = g * ez;
      force[j * 3] += fx; force[j * 3 + 1] += fy; force[j * 3 + 2] += fz;
      force[i * 3] -= fx; force[i * 3 + 1] -= fy; force[i * 3 + 2] -= fz;
      const oa = (i * SPOTS + a) * 3, ob = (j * SPOTS + b) * 3;
      const ax = spot[oa], ay = spot[oa + 1], az = spot[oa + 2], bx = spot[ob], by = spot[ob + 1], bz = spot[ob + 2];
      torque[j * 3] += by * fz - bz * fy; torque[j * 3 + 1] += bz * fx - bx * fz; torque[j * 3 + 2] += bx * fy - by * fx;
      torque[i * 3] -= ay * fz - az * fy; torque[i * 3 + 1] -= az * fx - ax * fz; torque[i * 3 + 2] -= ax * fy - ay * fx;
    }
    this.potential = U;
  }

  step() {
    const { n, pos, vel, q, L3, force, torque, L } = this;
    const h = DT / 2;
    for (let k = 0; k < n * 3; k++) { vel[k] += h * force[k]; L3[k] += h * torque[k]; }
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < 3; d++) {
        let x = pos[i * 3 + d] + DT * vel[i * 3 + d];
        x -= L * Math.floor(x / L);
        if (x >= L) x -= L;
        pos[i * 3 + d] = x;
      }
      // Turn by the angle omega * DT: multiply q by the unit quaternion (1, omega DT / 2), normalized.
      const hx = L3[i * 3] / INERTIA * h, hy = L3[i * 3 + 1] / INERTIA * h, hz = L3[i * 3 + 2] / INERTIA * h;
      const w = q[i * 4], x = q[i * 4 + 1], y = q[i * 4 + 2], z = q[i * 4 + 3];
      let nw = w - hx * x - hy * y - hz * z;
      let nx = x + hx * w + hy * z - hz * y;
      let ny = y + hy * w + hz * x - hx * z;
      let nz = z + hz * w + hx * y - hy * x;
      const m = Math.sqrt(nw * nw + nx * nx + ny * ny + nz * nz);
      q[i * 4] = nw / m; q[i * 4 + 1] = nx / m; q[i * 4 + 2] = ny / m; q[i * 4 + 3] = nz / m;
    }
    this.orient();
    this.forces();
    for (let k = 0; k < n * 3; k++) { vel[k] += h * force[k]; L3[k] += h * torque[k]; }
    this.bathe();
    this.tick++;
    this.time += DT;
  }

  // The bath's temperature now: day for the first half of each period after dawn, night otherwise.
  bath(time = this.time) {
    const { period, dawn, day, night } = this.p;
    const phase = time / period + 1 - dawn;
    return phase - Math.floor(phase) < 0.5 ? day : night;
  }

  // Each ball is nudged toward the bath temperature by scaling its own motion.
  bathe() {
    const { n, vel, L3 } = this;
    const target = this.bath(), rate = this.p.coupling * DT;
    let added = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const k = 0.5 * (vel[o] * vel[o] + vel[o + 1] * vel[o + 1] + vel[o + 2] * vel[o + 2])
        + 0.5 * (L3[o] * L3[o] + L3[o + 1] * L3[o + 1] + L3[o + 2] * L3[o + 2]) / INERTIA;
      const t = k / 3;
      let f = 1 + rate * (target / (t > 1e-6 ? t : 1e-6) - 1);
      if (f > 1.2) f = 1.2;
      const s = Math.sqrt(f);
      for (let d = 0; d < 3; d++) { vel[o + d] *= s; L3[o + d] *= s; }
      added += k * (f - 1);
    }
    this.heatLost -= added;
  }

  kinetic() {
    const { n, vel, L3 } = this;
    let t = 0, r = 0;
    for (let k = 0; k < n * 3; k++) { t += vel[k] * vel[k]; r += L3[k] * L3[k]; }
    return 0.5 * t + 0.5 * r / INERTIA;
  }
  // Six ways to move per particle, so the kinetic energy is 3 n T.
  temperature() { return this.kinetic() / (3 * this.n); }
  energy() { return this.kinetic() + this.potential; }
  // A ball's kind: how many + and how many - spots it has (a cap is 1+0- or 0+1-).
  kindOf(i) { let p = 0, m = 0; for (let a = 0; a < SPOTS; a++) { const v = this.sign[i * SPOTS + a]; if (v > 0) p++; else if (v < 0) m++; } return `${p}${m}`; }

  // ---------- measuring (none of this feeds back into the physics) ----------

  // Every pair of opposite spots closer than BOND: [i, a, j, b].
  bonds() {
    const { spot, sign } = this;
    const out = [], B2 = BOND * BOND;
    this.pairs((i, j, dx, dy, dz) => {
      for (let a = 0; a < SPOTS; a++) for (let b = 0; b < SPOTS; b++) {
        if (sign[i * SPOTS + a] + sign[j * SPOTS + b] !== 0 || !sign[i * SPOTS + a]) continue;
        const oa = (i * SPOTS + a) * 3, ob = (j * SPOTS + b) * 3;
        const ex = dx + spot[ob] - spot[oa], ey = dy + spot[ob + 1] - spot[oa + 1], ez = dz + spot[ob + 2] - spot[oa + 2];
        if (ex * ex + ey * ey + ez * ez < B2) out.push([i, a, j, b]);
      }
    });
    return out;
  }

  // Groups of particles joined by bonds, with what each one looks like.
  groups(bonds = this.bonds()) {
    const n = this.n;
    const parent = Int32Array.from({ length: n }, (_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const spotUse = new Uint8Array(n * SPOTS);
    const nbr = Array.from({ length: n }, () => []);
    for (const [i, a, j, b] of bonds) {
      spotUse[i * SPOTS + a]++; spotUse[j * SPOTS + b]++;
      nbr[i].push(j); nbr[j].push(i);
      parent[find(i)] = find(j);
    }
    const byRoot = new Map();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      if (!byRoot.has(r)) byRoot.set(r, []);
      byRoot.get(r).push(i);
    }
    const out = [];
    for (const members of byRoot.values()) {
      let nb = 0, charge = 0, openPlus = 0, openMinus = 0, maxDeg = 0;
      for (const i of members) {
        nb += nbr[i].length;
        maxDeg = Math.max(maxDeg, nbr[i].length);
        for (let a = 0; a < SPOTS; a++) {
          const s = this.sign[i * SPOTS + a];
          charge += s;
          if (s && !spotUse[i * SPOTS + a]) { if (s > 0) openPlus++; else openMinus++; }
        }
      }
      nb /= 2;
      const size = members.length;
      const loops = nb - size + 1;
      const shape = size === 1 ? 'single' : size === 2 ? 'pair' : loops > 0 ? (loops === 1 && maxDeg <= 2 ? 'ring' : 'cage') : maxDeg <= 2 ? 'chain' : 'branched';
      out.push({ members, size, bonds: nb, loops, charge, openPlus, openMinus, shape, closed: size > 1 && openPlus + openMinus === 0, sig: size <= 40 ? this.signature(members, nbr) : `big${size}` });
    }
    out.sort((a, b) => b.size - a.size);
    return { groups: out, spotUse };
  }

  // A name for a group's bond pattern that two groups share when they are built the same way: each
  // particle starts with its kind and is relabeled three times by its neighbors' labels.
  signature(members, nbr) {
    let lab = new Map(members.map((i) => [i, `${this.kindOf(i)}`]));
    for (let round = 0; round < 3; round++) {
      const next = new Map();
      for (const i of members) next.set(i, lab.get(i) + '(' + nbr[i].map((j) => lab.get(j)).sort().join(',') + ')');
      // Shorten labels so they do not grow without bound.
      const names = new Map();
      for (const v of [...new Set(next.values())].sort()) names.set(v, hash(v));
      for (const i of members) next.set(i, names.get(next.get(i)));
      lab = next;
    }
    return members.length + ':' + hash([...lab.values()].sort().join('|'));
  }

  // Everything the page and the sweep report about the present moment.
  census() {
    const bonds = this.bonds();
    const { groups, spotUse } = this.groups(bonds);
    let used = 0, doubled = 0;
    for (const u of spotUse) { if (u) used++; if (u > 1) doubled++; }
    const counts = new Map();
    for (const g of groups) if (g.size >= 2 && g.size <= 40) counts.set(g.sig, (counts.get(g.sig) || 0) + 1);
    let repeatedKinds = 0, inRepeats = 0, clusters = 0;
    for (const c of counts.values()) { clusters += c; if (c >= 2) { repeatedKinds++; inRepeats += c; } }
    const shapes = {};
    for (const g of groups) if (g.size >= 2) shapes[g.shape] = (shapes[g.shape] || 0) + 1;
    // Complete groups: every spot used, nothing left to stick with.
    const closedCounts = new Map();
    let inClosed = 0;
    for (const g of groups) if (g.closed) { inClosed += g.size; closedCounts.set(g.sig, (closedCounts.get(g.sig) || 0) + 1); }
    let closedRepeated = 0, closedGroups = 0;
    for (const c of closedCounts.values()) { closedGroups += c; if (c >= 2) closedRepeated++; }
    return {
      tick: this.tick,
      temperature: this.temperature(),
      energy: this.energy(),
      heatLost: this.heatLost,
      bondsPerParticle: bonds.length / this.n,
      spotsUsed: used / (this.n * SPOTS),
      spotsDoubled: doubled / (this.n * SPOTS),
      largest: groups[0].size / this.n,
      singles: groups.filter((g) => g.size === 1).length / this.n,
      clusters,
      clusterKinds: counts.size,
      repeatedKinds,
      inRepeats,
      shapes,
      closedGroups,
      closedKinds: closedCounts.size,
      closedRepeated,
      inClosed: inClosed / this.n,
      groups,
      bondList: bonds,
    };
  }
}

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
