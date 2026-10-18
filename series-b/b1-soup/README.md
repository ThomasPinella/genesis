# B1: The polar soup

Series B starts over with polarity and nothing else: no attention, no genome, no single energy for
the world to slide down. Design and reasoning: the series proposal agreed with Thomas
(`/mnt/project-files/genesis/series-b/proposal-series-b.md` in the project folder).

## The laws
- Each particle is a ball 1 across with four spots at the corners of a tetrahedron. Each spot is + or −,
  fixed for life.
- Opposite spots closer than 0.3 pull together, like spots push apart: `U = strength * s_a * s_b * (1 - d²/0.3²)²`.
  The reach is short enough that a spot holds one partner (the bond limit).
- Balls cannot overlap: `U = 60/2 * (1 - r)²` when centers are closer than 1.
- Continuous 3D in a box that wraps on every side; velocity Verlet for moving and turning.
  Deterministic: a seed only sets the start.
- Drag slowly carries heat away, so the soup starts hot and cools. Drag 0 seals the box.

Kinds (`mix`): `random` flips a coin per spot (all five kinds, 1:4:6:4:1), `water` makes every ball
two + and two −, `pairs` makes half the balls three + and half three −. Every mix has equal + and −.

## Question
As the soup cools, does it build many small shapes that repeat and last, one big tangled net, or a crystal?

## What the sweep found
27 worlds of 1000 balls (`tools/sweep.mjs`, results in `sweep-results.json`): 3 mixes x crowded (0.3)
or sparse (0.05) x 2 seeds x fast (0.01) or slow (0.002) cooling, plus a sealed box per mix.

- **One big tangled net.** Every crowded soup, and every sparse soup cooled slowly, ends with 65-100%
  of balls in one group. Balls use 1.5-1.65 of their 2 possible bonds, so it is a loose, irregular
  net (a gel), not a crystal.
- **A short window of variety.** In crowded soups the number of distinct small groups (2-40 balls,
  told apart by their bond pattern) peaks near temperature 0.12: 95-101 with all five kinds, 58-69 with
  the three-and-one mix, 38-44 with water balls only. Shapes include pairs, chains, branches and groups with loops.
- **Nothing in the window lasts.** At the peak only 22-36% of small groups are unchanged 500 ticks
  later (70-82% of bonds). Groups churn until the net swallows them.
- **Leftover polarity is real.** Small groups carry net charge and open spots, for example a pair with
  four open + and two open − spots. They behave like bigger spotted balls, the level-stacking idea,
  but they also end up in the net.
- **Fast freezing keeps variety, frozen.** Sparse soups cooled fast stop near temperature 0.015 with
  about 50-90 kinds of small group (8-15 seen more than once) and 18-23% of balls alone, including
  dozens of groups with loops. 98-100% of groups last, only because nothing moves.
- **Sealed box: nothing.** With no drag the soup stays near temperature 0.49 and 94% of balls stay alone.
- **Checks.** At most 0.2% of spots ever held two partners. Energy plus heat removed stays within 0.4%
  of the start (step error).

## What it means
Polarity with a bond limit gives a hot soup where nothing lasts or a cold net where everything sticks.
The rich middle exists but slips past. That is the job for flow in B2: hold the world in the middle,
breaking weak bonds while strong structures survive, instead of letting it cool into the net.

## Running
Open `index.html` through any static server (it imports `sim.js`). `node tools/sweep.mjs > sweep-results.json`
reruns the sweep (about 25 minutes on 4 cores; `PARTIAL=file` resumes).
