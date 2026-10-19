# Experiment 5: Shaking light

**Question:** if light warms what absorbs it, so that every place warms by day and cools by night,
can a template's partners sort themselves out and a copy let go?

This is the world of [experiment 4](../04-face-chemistry/), changed in one place. Until now, light
that a particle absorbed went into its store and nowhere else, so the world cooled until nothing
moved. Experiment 4's template probe found that the cold freezes wrong partners in, and that the
optional noise, warm enough to free them, also breaks the template. The cheap checks there found
that bonds make neighbors complementary rather than alike, which rules out recruiting but fits
templating (as with DNA, where the copy of a copy is the original). What templating lacked was a
way to let go.

- **Light shakes bonds.** A share of the light a bonded particle absorbs (`shake`, default 0.25)
  goes into its bonds instead of its store. Each bond gets an equal and opposite push along the
  bond, apart, carrying exactly that energy. A bond the push carries past its depth breaks; a
  stronger one rings and holds.
- **Nothing else changes.** The pushes add no momentum and no turning (sideways momentum stays at
  zero to rounding), total energy still never rises by more than the light absorbed, and nothing is
  random. With `shake` at 0 the world is experiment 4 bit for bit, which is the ablation.
- Since the sun sweeps across the world, each place gets its days and nights.

## Run it

```sh
python3 -m http.server 8000   # from this folder, then open http://localhost:8000
```

The new slider is under Sun and energy. **Drop in a template chain** works as in experiment 4.

## Findings

From the template probe on the eight laws whose lenses allow a two-letter code (laws 5, 62, 74,
76, 116, 155, 193 and 294; law 180 has none under the probe's test), 2 starts each, at shake 0,
0.25, 0.5 and 1, with 120 building blocks freed beside the chain and watched for 4,000 ticks (four
days). Results are in `template-results.json`.

- **No copy forms.** At every shake level, partners beside the chain link into at most 4 to 7 in a
  row, as in experiment 4.
- **Partners don't sort themselves out.** The share of partners that are the matching letter stays
  at chance, 41 to 53% at every level.
- **Where the template absorbs light, the light breaks it.** In laws 74, 116, 193 and 294 the
  chain's own members absorb light, and the share of its spine still intact falls from 19% without
  shaking to 9%, 7% and 0% as the shake rises. Where the template barely absorbs (laws 5, 62, 76 and
  155), the light lands on its neighbors and the chain holds about as well as without (49 to 63%
  intact).
- **Why, as far as this shows:** the push goes into every bond of a particle that absorbs, the
  spine as much as the sides, so it frees right and wrong partners alike and weakens the template
  too. The heat it adds is selective only through bond strength, and in these laws a right
  partner's bond is barely stronger than a wrong one's (the code margins are small), so warming
  gives selection almost nothing to work with. Copying would need a much larger gap between the
  right side bond and the wrong one, and a spine much stronger than both.

WORLD_SWEEP

Rerun the probe with `CODE=1 FEED=120 WATCH=4000 SHAKES=0,0.25,0.5,1 LAWLIST=5,62,74,76,116,155,180,193,294 node tools/template.mjs > template-results.json`
and the sweep with `SHAKES=0,0.25 WORLDS=1,2 node tools/sweep.mjs > sweep-results.json`. Both take
`PARTIAL=file.jsonl` to save each world as it finishes.
