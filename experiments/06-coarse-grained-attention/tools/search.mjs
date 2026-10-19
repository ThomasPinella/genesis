// Searches many laws for the strongest two-letter code, with no change to any rule. A code is two
// elements a and b that share a straight spine (both bond either way along one axis) and pair up at
// a side face, each preferring the other there. For copying, the spine should be much stronger than
// the right side bond, and the right side bond much stronger than any wrong one: the same letter at
// that side face, through any of its faces. The gap is the smaller of the two margins.
//
// The all-sites gap is stricter still, and closer to what a template meets in the soup: the right
// partner at the side face must beat every other attachment at every face a chain member leaves
// open (all but its two spine faces), to any element of the law, through any face.
//
// Usage: LAWS=5000 node tools/search.mjs > search-results.json   (FACES sets how distinct faces are)
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import os from 'node:os';
import { Sim } from '../sim.js';
import { chemistry, strictCode } from '../probe.js';

const LAWS = Number(process.env.LAWS) || 5000;
const FACES = process.env.FACES ? Number(process.env.FACES) : 1;
const TOP = 25;

function bestCode(lawSeed) {
  const sim = new Sim({ lawSeed, n: 2, faces: FACES });
  const chem = chemistry(sim);
  const c = strictCode(chem);
  if (!c) return null;
  const r3 = (x) => +x.toFixed(3);
  const [a, b] = c.letters;
  return { lawSeed, gap: r3(c.gap), spine: r3(c.spine), right: r3(c.right), wrong: r3(c.wrong), letters: [chem.els[a].idx, chem.els[b].idx], faces: c.faces[a], allSites: r3(allSites(chem)) };
}

// The best all-sites gap over every pair of letters, spine axis and side face.
function allSites({ els, m }) {
  const K = els.length;
  let best = -Infinity;
  for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) for (const [p, q] of [[0, 1], [2, 3], [4, 5]]) for (const [bk, fw] of [[p, q], [q, p]]) {
    const spine = Math.min(m[a][fw][a][bk], m[a][fw][b][bk], m[b][fw][a][bk], m[b][fw][b][bk]);
    for (let sd = 0; sd < 6; sd++) {
      if (sd === p || sd === q) continue;
      const right = m[a][sd][b][sd];
      let wrong = -Infinity;
      for (const [x, comp] of [[a, b], [b, a]]) for (let f = 0; f < 6; f++) {
        if (f === p || f === q) continue;
        for (let y = 0; y < K; y++) for (let g = 0; g < 6; g++) if (!(f === sd && y === comp && g === sd)) wrong = Math.max(wrong, m[x][f][y][g]);
      }
      best = Math.max(best, Math.min(spine - right, right - wrong));
    }
  }
  return best;
}

if (isMainThread) {
  const out = [];
  let next = 1;
  await Promise.all(Array.from({ length: Math.max(1, os.cpus().length) }, () => new Promise((done) => {
    const w = new Worker(new URL(import.meta.url));
    const feed = () => (next <= LAWS ? w.postMessage(next++) : (w.terminate(), done()));
    w.on('message', (r) => { if (r) out.push(r); if (out.length % 500 === 0) process.stderr.write(`${out.length}/${LAWS}\n`); feed(); });
    feed();
  })));
  out.sort((x, y) => y.gap - x.gap);
  const gaps = out.map((r) => r.gap);
  const share = (t) => +(gaps.filter((g) => g > t).length / LAWS).toFixed(4);
  const all = out.map((r) => r.allSites).sort((x, y) => y - x);
  process.stdout.write(JSON.stringify({ laws: LAWS, faces: FACES, withCode: out.length, positive: share(0), above: { '0.25': share(0.25), '0.5': share(0.5), '1': share(1) },
    allSites: { positive: all.filter((g) => g > 0).length, best: all[0] }, top: out.slice(0, TOP) }, null, 1));
} else {
  parentPort.on('message', (law) => parentPort.postMessage(bestCode(law)));
}
