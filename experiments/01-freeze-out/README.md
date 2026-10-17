# Experiment 1: Freeze-out

**Question:** do distinct elements and bonds freeze out of a hot world with random genomes?

Particles in a 3D wrap-around box interact by attention. Every particle uses the same law (shared
query, key, value and update matrices) and differs only in its 8-number state: 4 fast numbers that
change every tick, and 4 slow numbers (the genome).

- **One energy.** The world's total energy is motion, plus a term for every pair in range (a wall at
  contact and a well whose depth is how well the two genomes match), plus a term for every genome
  on its own. Positions roll down it (those are the forces) and genomes drift slowly down it with
  their own drag. Nothing climbs it, so total energy can only fall, and drag is where it goes.
- **Elements are the law's memories.** A genome's own term is a modern Hopfield energy: the genome
  attends to the law's keys and is comfortable when one answers it strongly. Its valleys are the
  elements. The page finds them by rolling many genomes downhill on that term alone; nobody lists
  them, and each law seed gives its own set.
- **Attention has a budget.** A particle's bond energy is a soft maximum of its matches with its
  neighbors (a log-sum-exp, like attention's softmax), with empty space counted as one more option.
  It stays bounded however many neighbors crowd in, so bonds saturate. An earlier version summed
  every pair instead, and once genomes could move they all learned to attract each other and dense
  clumps collapsed into themselves.
- **Balanced forces:** each pair's force is the slope of the shared energy, so both particles feel
  equal and opposite forces and total momentum stays at zero.
- **Attention can be lopsided:** what a particle hears (its message) comes from its own query
  against its neighbors' keys. It moves only the fast state, which is outside the energy, so it
  can't create motion.
- **Drag** cools the world from a hot start.
- **Deterministic:** the law seed picks the physics, the world seed picks the starting conditions.
  The simulation uses only operations IEEE 754 defines exactly (exp, tanh and log are computed from
  them), so the same seeds and settings give a bit-identical world. "Verify replay" re-runs the
  universe from its seeds, including any live slider changes at the ticks they happened, and
  compares fingerprints.

## Run it

```sh
python3 -m http.server 8000   # from this folder, then open http://localhost:8000
```

`sim.js` has no dependencies and also runs in Node for headless sweeps.

## Findings so far

From a sweep of 48 worlds (12 laws, 4 starts each, 1,600 ticks, 1,500 particles); see
`sweep-results.json` or the World map panel.

- **Elements freeze out, and they belong to the law.** Every law has 3 or 4 possible elements.
  Worlds start with random genomes, and by the end about 91% of particles have settled into one.
  39 of the 41 possible elements appear in every start of their law, in similar proportions, so
  at this scale the starting conditions barely change the mix.
- **Some elements exist only in company.** Five of the 12 laws grow one or two extra elements
  that are not valleys for a lone genome; clusters hold their members there. They are far from
  every law element (1 to 4.6 units away in genome space) and recur in every start. In laws 9 and
  12 one law element never shows up on its own: clusters pull it into a company-only form instead.
- **Groups sort by element.** Sorting averages 0.43, against 0.15 for the old fixed-genome version
  and about 0.04 for random mixing. Laws 3 and 7 reach 0.7 to 0.96. Seven of 48 worlds end as one
  dominant cluster (laws 5 and 7), the rest as many separate groups.
- **Energy never rose.** Total energy (motion, bonds, wall and genome terms) was checked every 20
  ticks in every world and only fell. With drag off and genomes frozen, so nothing removes energy,
  it stays within about 0.02% per 150 ticks.

Rerun the sweep with `node tools/sweep.mjs > sweep-results.json` (about 5 minutes on 4 cores).
