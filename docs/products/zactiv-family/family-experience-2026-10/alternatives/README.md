# Three alternative Zactiv Family specifications

Specification-only comparison · 2 October 2026

These are three different product directions, alongside the original [Little Adventures proposal](../README.md). They share its relaxed approach, but change the reason a family opens and returns to the app. They are alternatives to choose between, not a plan to ship all four experiences together.

The alternatives were first written as specifications only. [Initial design boards and a comparison gallery](designs/index.html) have now been added, with [design notes](designs/DESIGN-NOTES.md). The boards are visual concepts; no production feature or interaction prototype was created for these alternatives. Business models, audience assumptions, pricing and return mechanisms are proposals to validate; they are not findings from new interviews or market research.

## Compare the core ideas

| | Original: Little Adventures | [1. Everyday Moments](01-EVERYDAY-MOMENTS.md) | [2. Family Pick](02-FAMILY-PICK.md) | [3. Story Trails](03-STORY-TRAILS.md) |
|---|---|---|---|---|
| Parent's question | “What can we do in five minutes?” | “How can we enjoy this moment we already have?” | “How do we choose something everyone wants to join?” | “What could our next family adventure be?” |
| Main value | A good default and shared recognition | Less planning; fits real routines | Child ownership and easier agreement | Imagination and continuity |
| Starting screen | One suitable activity | Choose A little gap / Out and about / Winding down | Two suitable cards after practical constraints | Continue a saved chapter or start a story |
| Reason to return | Relevant new ideas and a shared trail | Familiar situations and favourite variations | Enjoyable shared choosing and favourite games | Curiosity about the next chapter |
| Visible progress | Optional three-day weekly trail | None required | Favourites; tried history secondary | Permanent story bookmark, no deadline |
| Main content unit | Short standalone activity | Short situational invitation | Small set of contrasting suitable games | Three-to-five-chapter authored story |
| Best purchase hypothesis | Optional adventure pack | Themed everyday/printable collection | Original family game deck | Complete illustrated story pack |
| Relative MVP effort* | Medium | Lower | Lower to medium | Higher |
| Main risk | Even gentle targets can feel like tracking | Families learn games and need the app less | Choices increase negotiation/conflict | Content cost and unfinished-story pressure |

*Relative estimates assume the same reliable household/auth/offline foundations. A simple interface does not remove backend correctness, migration or content-review work. Story production effort is additional to the common technical foundation.

## The no-pressure rules in every version

- No broken daily streaks, lost points, decaying pets, public comparisons or deadlines.
- Families can finish early, skip, decline or leave. No explanation is required.
- Saved history and earned keepsakes remain available. Accessibility is part of the free core.
- Reminders are absent initially; any later reminder is adult-requested and easy to turn off.
- Children can lead, pass or participate differently. No separate child login is required.
- Cooking, conversation and movement are labelled honestly; family engagement is not proof of exercise.
- A public sample demonstrates value before adult registration. Private data requires scoped account access.
- The free experience remains satisfying indefinitely. Paid content adds authored variety, not relief from pressure created by the product.

## Which would I choose?

The original Little Adventures direction remains my first recommendation from the source review: it addresses starting friction with a useful default and gives the family a simple shared record. Your positive response to its relaxed feel is a reason to preserve those principles, not evidence that families will prefer it.

**Everyday Moments** is the strongest alternative if family interviews say “we don't have time for another thing”. It is also the calmest option if even a weekly trail feels unnecessary. It would be my first concept to compare directly with the original.

**Family Pick** is the strongest alternative if parents say “the children never agree” or “they don't want to do what I suggest”. Test it carefully with siblings: meaningful choice is useful only if it lowers the effort of getting started.

**Story Trails** is the strongest alternative if children like pretend play and families want something prepared for weekends/holidays. It gives you a clearer paid product, but I would test one small story before making it the whole app.

## A small comparison study

Give eight to twelve households the same realistic situation: five minutes indoors, an adult and a child, no equipment. Present each direction as a simple written screen sequence with comparable activity quality. Counterbalance order; do not explain which concept you prefer.

Ask them to explain what they would do, what makes it worth opening, what would bring them back and what feels like a chore. Then repeat with a weekend and a reluctant child. Obtain the family's reasons before asking for a ranking; a theme preference alone is not product validation.

Choose one primary direction based on the recurring barrier and observed comprehension. Borrow at most one compatible idea from another direction after testing: an everyday-context label could improve Little Adventures, or a paid story could sit inside its Ideas library. Do not merge all navigation systems, tracking rules and loops into one app.

Detailed specifications use the same structure: family need, product loop, screen requirements, real journeys, motion/design intent, minimum release, free/paid model, validation and principal tradeoff. Common engineering/privacy/reliability requirements remain in the original [engineering specification](../ENGINEERING.md).
