# Experiment 2: Energy

**Question:** once energy flows through the world, do absorbers, eaters, foraging and driven
patterns appear?

This is the world of [experiment 1](../01-freeze-out/), with the same law, the same elements and the
same single energy for motion, bonds and genomes, plus a way for energy to come in and more ways
for it to go out.

- **A sun.** Light comes down from the ceiling in columns. A cosine band of it sweeps across the
  world once a day (1,000 ticks by default), so every place gets dawn, noon, dusk and night.
  The wall-to-wall average is the same at every moment; the rhythm is local.
- **Absorbing by color.** The light has a key, drawn from the law seed. A particle takes a share of
  the light in its column by how well its query matches that key, and what it takes is gone for
  everything below it, so absorbers shade what is underneath.
- **An energy store.** Each particle carries stored energy, which starts at zero. It leaks a little
  every tick, so existing costs something. Particles glow brighter on the page when they hold more.
- **Eating along attention.** Stored energy flows from a particle to whoever attends to it, in
  proportion to how much attention each one pays. The eater keeps half and the rest becomes heat.
  Nobody is told what to eat; it follows from the same attention that makes bonds.
- **Light is attendable.** Light enters attention as one more neighbor, above the particle, so
  moving toward light and moving toward food are the same rule.
- **Self-propulsion.** A particle can spend stored energy to push itself toward what its attention
  favors. How hard is read from its fast state, which now also hears how full the particle is
  (hunger). Pushing costs the work done divided by an efficiency of 0.7, and a particle can only
  spend what it has. This is the only lopsided motion; it pushes off the medium, as swimming does.
- **The books still balance.** Total energy is experiment 1's energy plus everything stored. It can
  rise only by the light absorbed, and drag, leak and the heat of eating take it out. The page
  checks this every tick ("Books") and the sweep checks it every 20 ticks.
- **Deterministic**, as in experiment 1: the same seeds and settings give a bit-identical world,
  and "Verify replay" proves it.

## Run it

```sh
python3 -m http.server 8000   # from this folder, then open http://localhost:8000
```

`sim.js` has no dependencies and also runs in Node for headless sweeps.

## Findings so far

From a sweep of 48 worlds (12 laws, 4 starts each, 4,000 ticks or four days, 1,500 particles).
Roles are judged over the last two days by where each element's income came from: an
**absorber** gets over 70% of it from light, an **eater** over 70% from eating others, **mixed**
is in between, and **inert** elements earn under 5% of the average. See `sweep-results.json` or
the World map panel.

- **Absorbers appear in 11 of 12 laws, and eaters in 10** (in laws 11 and 12, only in some starts). The likeliest failure, a world where
  every element is either an absorber or starving, did not happen: every law has at least two
  different roles, and inert elements, which neither absorb nor eat, show up in five laws.
- **Food webs nobody wrote.** In 34 of 48 worlds (every start of laws 2, 4 to 10, and two starts
  of law 12) one element lives on light and another lives on others. Most of the eating runs from
  absorbers to eaters: about 80% of all eating in law 8, 68% in law 5 and 57% in law 9. In law 3
  the mixed element mostly eats its own kind instead.
- **Movers earn more, even after paying for the motion.** In the elements that move (law 1 and
  law 10 absorbers, law 8 eaters), the quarter that spend most on pushing earn two to three times
  the income of the half that spend least, and keep two to three times as much after paying for
  it (law 1 absorbers: income 79 against 27, kept 29 against 9). This is a correlation: since a
  particle can only push with energy it has, the rich may move because they can afford to. The
  test that separates the two (turn propulsion off for one element and compare) is not run yet.
- **The world stays warm.** Average temperature at the end is 0.083, about six times experiment
  1's 0.013, and 10 of the 12 laws end warmer than any experiment 1 world. Law 11 still freezes
  (0.001) while energy flows through its motionless absorbers.
- **The day shows up in where elements sit, not in the world's temperature.** The temperature has
  little power at the day's period (at most 13% in the worlds checked), because the sun lights
  the same amount of the world at every moment. But some elements hold a fixed place relative to
  the sun: in law 3 both absorbers lean toward the night side in every start, and in law
  12 a small light-living element crowds toward noon while the others sit away from it. Law 3
  also has the largest temperature swings, two to ten times the other laws.
- **Layers.** Some laws stack their elements vertically: in law 10 the absorbers sit high (0.65
  of the height) and the inert element on the floor (0.15); in law 3 the mixed element that eats
  its own kind lives at the bottom (0.13 to 0.16), under the absorbers.
- **History still matters little.** In 8 of 12 laws every start ends with the same roles; in the
  other four the differences are an element on the border between mixed and a pure role, or a
  company element near the 2% cut. The law, not the start, decides the ecology. Starts do differ
  in how things clump: in law 3, sorting ranges from 0.07 to 0.89.
- **The books balance.** In all 48 worlds, total energy never rose by more than the light that
  came in over any 20-tick check.

Rerun the sweep with `node tools/sweep.mjs > sweep-results.json` (about 15 minutes on 4 cores).
