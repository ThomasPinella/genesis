# Experiment 1: Freeze-out

**Question:** do distinct kinds and bonds freeze out of a hot, uniform world?

Particles in a 3D wrap-around box interact by attention. Every particle uses the same law (shared
query, key, value and update matrices) and differs only in its 8-number state: 4 fast numbers that
change every tick, and 4 slow numbers (the genome) that stay fixed in this experiment.

- **Balanced forces:** each pair gets one symmetric match score. Positive pulls together, negative
  pushes apart, and both particles feel equal and opposite forces, so total momentum stays at zero.
- **Attention can be lopsided:** what a particle hears (its message) comes from its own query
  against its neighbors' keys.
- **Drag** is the only heat sink. The world starts hot (fast particles) and cools on its own.
- **Deterministic:** the law seed picks the physics, the world seed picks the starting conditions.
  The simulation uses only operations IEEE 754 defines exactly (exp and tanh are computed from
  them), so the same seeds and settings give a bit-identical world. "Verify replay" re-runs the
  universe from its seeds, including any live slider changes at the ticks they happened, and
  compares fingerprints.

## Run it

```sh
python3 -m http.server 8000   # from this folder, then open http://localhost:8000
```

`sim.js` has no dependencies and also runs in Node for headless sweeps.

## Findings so far

- **Bonds freeze out, kinds need diverse genomes.** With nearly identical starting genomes, every
  pair has nearly the same match, so a world either all sticks or all stays a gas. Raising genome
  spread gives picky matches: in a sweep of 120 worlds (12 laws, 5 spreads, 2 starts), spread 0 gave
  separate groups in 3 of 24 worlds and spread 1 in 22 of 24. See `sweep-results.json` or the World
  map panel.
- **Groups sort by kind at high spread.** The sorting score (share of genome variation among grouped
  particles that lies between groups) averages 0.15 at spread 1, against roughly 0.04 for random
  mixing. Law 8 is strongest (0.44 with 20 groups), so it's the default.
- **Energy leak fixed.** The first version let forces depend on the fast state, so a particle
  changing its state reshaped the forces around it and created motion energy for free. Forces now
  read only the slow state (what a particle is, not what it's doing). With drag on, total energy
  (kinetic plus potential) now falls at every check; with drag off it drifts up by about 1% per
  150 ticks from integration error.
- No world in the sweep collapsed into a single blob.

Rerun the sweep with `node tools/sweep.mjs > sweep-results.json` (about 25 minutes on 4 cores).
