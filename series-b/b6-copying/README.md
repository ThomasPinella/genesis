# B6 (probe): Copying

B5 gave two strengths of bond: a strong one that holds through the days and a weak one that forms at
night and melts by day. That is the piece the copying plan in the series B proposal was missing: a
backbone that holds while the pairing lets go. B6 is a probe of that plan, not a full experiment.

## The ingredient
A new kind of ball, the **block**: a big + and a big − backbone spot at two corners, so blocks chain
head to tail, one **letter** spot (+ or −) at a third corner, and a bare fourth corner. Thomas chose
(2026-10-19) to give letters a **second kind of charge**: letters feel only letters, backbone spots
feel only backbone spots. With one kind of charge, a letter was pulled harder by a big backbone spot
than by another letter, and letters stuck to backbones about 8 times as often as to letters.

The hoped-for cycle: at night a chain's letters gather free blocks with the opposite letter; gathered
neighbors link along their backbones into a strand; the day melts the letter pairs but not the
backbone, and the strand comes off as a copy (a complement, which copies back to the original).

## What the probes found
Template probe (`tools/template.mjs`): a chain of 10 blocks with a chosen word, laid out straight, in
a soup of 590 free blocks, days and nights as in B5. Short runs of 600-1000 time units, many settings.

- **Two kinds of charge work as intended.** Letters bond only to letters.
- **Free blocks chain on their own, fast.** Backbone bonds are stronger and easier to make than
  letter bonds, so most free blocks are in random chains before they meet the template. Narrowing the
  backbone spots (reach 0.15-0.2 instead of 0.3) slows this a lot (at reach 0.15, 550 of 590 blocks
  were still free after 110 time units, against 355 at full reach).
- **The template holds and gathers partners.** With bigger letter spots (1.5) up to 9 of its 10
  letters have a partner at night.
- **But neighbors on the template almost never link.** In every setting the longest run of partners
  linked to each other was 2 blocks, and only once did a run of 2 come off whole. Even with the
  template held perfectly straight and still (a diagnostic), runs never passed 2.
- **Why.** A bond here is a single point of contact, so a block held by its letter can still turn
  freely about that point. Its backbone spots point in a random direction, and two neighbors rarely
  line up their backbone spots at the same time. Most partners that do arrive are already in random
  chains, whose backbone spots are taken. And letter spots big enough to hold partners through the
  night also hold them through the day.
- Chains in the open soup show the same thing: letter pairs between chains rarely stack more than
  two in a row.

## What it means
Copying needs the partner's backbone to be lined up for it, and a single-contact bond doesn't do
that. Ideas that could: a block held at two points (two letter spots, the three-letter alphabet in the
proposal, where a partner bridges two template blocks and can't turn), stiffer backbones, or a
backbone bond that forms slowly unless held in place. Each is a change to the blocks, so the next
step is Thomas's call.
