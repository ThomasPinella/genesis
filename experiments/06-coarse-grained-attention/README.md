# Experiment 6: Coarse-grained attention

**Question:** if attention reaches far and sees what is far away blended, do groups start acting
as units, and does what a group looks like from afar depend on how it is arranged?

This is the world of [experiment 5](../05-shaking-light/), changed in one place. Until now nothing
farther than one unit was felt. Here, up close, a particle still attends to each neighbor on its
own. Farther out, up to the `far` setting (default 3), it attends to each cell of the world's grid
as one blended thing: the members' average key and average value, from their middle, counted once
per member and weighted by how much of the view each member fills, `(CONTACT / R)^2`. Nothing
looks for groups. A cell whose members agree has a strong average key, so it stands out; a random
mix averages toward nothing. This is the design doc's composition rule, and the shape-signatures
proposal (`/mnt/project-files/genesis/proposal-shape-signatures-and-multiplying.md`) was its
required input: a blend can only tell a chain from a ring of the same members if the members'
fast states differ by where they sit.

- **Far attention moves nothing for free.** Like near attention, it reaches only the fast state and
  the direction a particle would push itself, which costs stored energy. It is not part of the
  energy, so the books still balance, and only neighbors can be eaten. Attention has one budget, so
  what a particle spends far away it does not spend nearby.
- **`coarse` 0 is experiment 5 bit for bit**, which is the ablation.
- **Two tests from the proposal, off by default:** `listen` makes a particle attend more to what it
  bonds with (each pair's attention times `e^(listen * beta * match)`, the bond energy's own
  factor), and `space` gives empty space a share of attention, as the 1s in the bond energy do, so
  that how many neighbors a particle has changes what it hears and not only what they say.
- The grid's cells are about one unit wide, so the far field starts two cells out. Particles one
  to two units away in a neighboring cell are not heard at all; that gap is the price of a cheap
  grid. The world is only about seven cells across, so there is one level of blending; blends of
  blends need a bigger world.

## Run it

```sh
python3 -m http.server 8000   # from this folder, then open http://localhost:8000
```

The new sliders are under Attention.

## Findings

From 12 laws × 2 starts, 4,000 ticks, 1,500 particles, with far attention on (`coarse` 1) and off
(experiment 5) on the same laws and starts (`units-results.json`, and the World map panel). Then,
on start 1 of every law: far attention four times as strong, and each test at two strengths.

- **About a tenth of attention goes far** (29% when four times as strong), and **the world hardly
  changes:** 72% of particles bonded against 71% without, the same temperature, the same number of
  groups (134 against 133), and groups sharing an exact arrangement stay rare (8 particles' worth
  per world against 7). Identical splits stay under one per world.
- **Groups don't act as units any more than before.** A group's members share one fast state (74%
  of its spread within an element, against 43% by chance), but they did just as much without far
  attention. A cell held by one bonded group agrees with itself barely more than a cell of loose
  particles (0.47 against 0.44 on the agreement score, 0.46 against 0.43 without), so groups don't
  stand out from afar.
- **What a group looks like from afar doesn't depend on its arrangement.** Where a member sits
  explains little of its fast state: chain end or middle 3% (1.5% by chance), bond count 4%
  (1%), the group's shape class 9% (2%), the same as without far attention. For groups with the
  same members, two arranged differently are as far apart in average key as two arranged alike
  (median ratio 1.04; 0.94 without). The test can see shape when it is there: the members' bond
  counts, which do follow the arrangement, differ between different arrangements (0.3 to 0.5) and
  not at all between the same ones.
- **The two tests don't change that.** With `listen` at 1 and 3, `space` at 1 and 5, and far
  attention four times as strong, shape class explains 6 to 12% and the ratio stays at 1.0 to 1.1.
- **The books balance.** In every world, total energy never rose by more than the light that came
  in over any 20-tick check.
- **Not run:** the frozen-fast-state ablation (no mode showed any shape to take away), and the
  template probe (far attention never touches the bond energy, so it cannot change who sticks to a
  template; it can only steer movers).

**Why, as far as this shows:** members of a bonded group listen mostly to each other, so over many
ticks they settle into one shared state, the way repeated averaging in a graph network washes out
where each node sits. That shared state remembers the group's history, not its arrangement.
Listening harder along bonds only speeds the agreement up, and room for empty space makes bond
counts audible but the agreement still swamps them. Far attention then adds the same far signal to
every member. And even a blend that did carry shape would have nothing to act on: bonds read only
genomes, so far attention can change where a particle pushes itself, but never what it sticks to.

Rerun with `PARTIAL=units.jsonl node tools/units.mjs > units-results.json` (modes coarse and off),
and `MODES=strong,listen,listen3,space,space5 WORLDS=1 node tools/units.mjs` for the rest. Each far
world takes about two and a half times as long as an experiment 5 world.
