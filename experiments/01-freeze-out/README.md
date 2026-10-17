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

## First observations (law seed 2, world seed 1, 2,000 particles)

- Bonds freeze out: within about 600 ticks roughly half the particles are bonded into about 10-12
  groups of 100-300 particles.
- Kinds don't visibly sort yet: groups are mixed colors.
- Changing states pump energy into motion. With the state change rate at 0 the world cools steadily;
  above 0 the temperature climbs back up once groups form. Changing a particle's state changes the
  forces it feels, which does work for free. Experiment 2's energy bookkeeping should charge for it.
- Whether anything bonds depends heavily on the law: in a 30-world sweep about a third of law/world
  pairs bonded and the rest stayed a cooling gas.
