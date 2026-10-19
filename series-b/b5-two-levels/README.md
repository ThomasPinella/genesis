# B5: Two levels

B4 let groups finish, and finished molecules outlasted the days, but a finished molecule has nothing
left to offer, so it can't build anything further. B5 asks for molecules that last but still show
spots to the outside, so a second level can be built from what the first leaves over.

## The new ingredient
Each spot has a size as well as a sign. Spots on four-spot balls have size 1; a cap's spot has size
`capStrength`. Two spots pull (or push) with the product of their sizes, so a cap holds its partner
`capStrength` times harder than two four-spot balls hold each other. Every cap is +, so caps cover
− spots. That makes two kinds of bond without naming either:

- **Molecules**: a four-spot ball and the caps it wears, held by strong cap bonds.
- **Clumps**: molecules joined by weak bonds, one ball's leftover + to another ball's leftover −.

A clump is **complete** when every spot in it is bonded. `capStrength` 1 is B4 with all caps +. The
time step is half of B4's, because the deeper cap bonds need finer steps to keep the energy books.

## Question
Do molecules last through the days while clumps form and break, a second level built from what the
first leaves over?

## What the sweep found
26 crowded worlds (density 0.3) of 1000 balls for 1200 time units (`tools/sweep.mjs`, results in
`sweep-results.json`): cap grip 1 or 2, caps at 50%, 60% or 70% of the balls, days at 0.15 or 0.2,
nights at 0.06, a day and night last 100, two seeds. Two more at grip 3. Averages over the second half
of each run.

- **Molecules last.** With grip 2, 87-96% of molecules get through a day intact and 98-100% of caps are
  worn. With grip 1 (the control) only 11-41% get through a day and caps keep changing hands.
- **A second level forms every night and melts every day, with no net.** At night 58-85% of molecules
  sit in clumps (30% with many caps and hot days); by day 10-68%. The biggest clump never holds more than
  8% of the molecules. There are 27-80 kinds of clump at night, 5-13 of them seen more than once.
- **Complete clumps last; open ones don't.** Open clumps rarely get through a day: 0-8% with half the
  balls as caps, 7-46% with 70%. Complete clumps get through 86-100% of days of 0.15 (25-67% at 0.2,
  where they are few). They are few with fewer caps (about 1 at a time) and more with more caps (4-12
  at a time at 70%). In all but one grip-2 run the oldest clump is a complete pair of molecules, and two of
  them lasted 1100 time units, the whole run after the first look.
- **What a complete clump is.** In one world (70% caps, days 0.15), 66 of the 76 complete clumps seen
  were the same pair: a ball with four − spots wearing three caps (one − left over) joined to a ball
  with one + and three − spots wearing three caps (one + left over). The rest were small chains
  and branches of three to five molecules.
- **Checks.** Grip 3 gives the same picture, but 2.6% of spots hold two partners: the bond limit starts
  to fail, so grip 2 is the default. At grip 1-2 at most 0.4% of spots ever held two partners and the
  books drift by under 0.1%.

## What it means
The second level is real, and it repeats the first. A molecule with one leftover spot plays the part
a cap played in B4, and what survives at the second level is again what is complete: the commonest
lasting clump is the second-level twin of B4's cap pair. That is renormalization working as hoped:
each level is made of what the level below leaves over, and the same rule (complete things last)
sorts it. But it also repeats B4's dead end one level up: the clumps that last are finished, so they
offer nothing to a third level, and open clumps that could grow are exactly the ones that melt. Adding
a third spot size would just stack a third copy. To go further, something has to let open structures
last, or let a lasting structure make more of itself.

## Running
Open `index.html` through any static server (it imports `sim.js`). `node tools/sweep.mjs > sweep-results.json`
reruns the sweep (about an hour on 4 cores; `PARTIAL=file` resumes).
