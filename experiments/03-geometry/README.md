# Experiment 3: Geometry

**Question:** once bonds have direction, do shapes form (chains, rings, sheets, cages), and does any
shape assemble copies of itself?

This is the world of [experiment 2](../02-energy/), with the same law, sun, eating and
self-propulsion. Particles now also have a facing.

- **Orientation.** Each particle has an orientation and a spin, with a moment of inertia of 0.1
  and the same drag as its motion. It starts facing a random way, drawn from the world seed.
- **Face patches.** Each particle has six faces (±x, ±y, ±z in its own frame). How sticky each face
  is comes from its genome through a 6-row matrix that is part of the law, so elements differ in
  which faces they bond with. Each face's reach is a narrow bump about 70° across.
- **One energy, still.** A bond's match is multiplied by how well each particle's sticky faces
  point at the other, so bonding needs two facing patches. Attention is weighted the same way:
  a particle attends through its faces, and sees light through whichever faces point up. Forces, torques and
  genome changes all descend the same energy, and angular momentum is conserved between pairs.
  Nothing says "make a chain".
- **A dial for direction.** The `geometry` setting blends between round particles (0) and full
  patches (1). At 0 the world is experiment 2, bit for bit, which makes it the control.
- **Measuring shape.** Bonded groups are sorted by their bond graph and their spread in space:
  **chain** (no branches, no loops), **ring** (a single loop), **tree** (branched, no loops),
  **sheet** (loops, at least 6 particles, and flat), and **blob** (everything else). Each group
  also gets a fingerprint of which element sits where in its bond graph, so two groups with the
  same arrangement are recognized as copies.
- **Deterministic**, as before: "Verify replay" proves a bit-identical rerun.

## Run it

```sh
python3 -m http.server 8000   # from this folder, then open http://localhost:8000
```

Color by "Shape of its group" to see the classes, and turn on "Show patches" to see which faces of
each particle are sticky. `sim.js` has no dependencies and also runs in Node.

## Findings so far

From a sweep of 96 worlds: 12 laws × 4 starts, each run with patches and without, 4,000 ticks,
1,500 particles. Shares are of all particles, at the end. See `sweep-results.json` or the World
map panel.

- **Direction changes what forms, and the law decides how.** Without patches, 9 of 12 laws end
  in giant blobs of 200 to 1,200 particles. With patches, no group grows past 90.
- **Chains and rings.** Law 5 puts 28% of its particles in chains and 23% in rings, against 5%
  and 0% without patches. Law 9 puts 41% in chains and 8% in rings, and law 2 makes short chains
  (29%). Rings appear in no law without patches.
- **Sheets.** Law 8 makes flat sheets of 60 to 90 particles, one or two per world. Law 10 makes
  small, very flat sheets and rings (flatness 0.92 to 0.98, where 1 is a plane).
- **Some laws stop bonding.** In laws 1, 6, 7, 11 and 12, the patches rarely line up, and the
  world stays a warm gas with under 15% bonded. Making bonding harder is the price of making it
  specific.
- **The same structures keep turning up.** In law 5, the number of particles in groups that
  share an exact arrangement with another group rises steadily, from 10 to about 90 per world over
  the run, in every start. Law 9 rises from 0 to about 27. Without patches the same count stays
  flat at 0 to 24.
- **But no copying yet.** If a structure were assembling copies of itself, we would expect groups
  that split into two identical pieces. That is no more common with patches than without (law 9:
  0 to 2 splits with patches, 17 to 21 without). The repeats are small motifs of about five
  particles that the law makes again and again from scratch, the way salt makes the same crystal
  everywhere, rather than one structure acting as a mold for the next.
- **The books balance.** In all 96 worlds, total energy never rose by more than the light that
  came in over any 20-tick check.

The next question is what a shape would need in order to template: probably longer, rigid
chains whose free faces can hold loose particles in order. That is the open question for the next
experiment.

Rerun the sweep with `node tools/sweep.mjs > sweep-results.json`.
