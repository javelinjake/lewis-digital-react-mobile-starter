# Version 2: Family Pick

Specification only · 2 October 2026

Visual companion: [initial design board](designs/02-family-pick.png) and [comparison gallery](designs/index.html).

**Promise:** “Choose something everyone can join.”

Zactiv is a tiny shared decision tool: the parent establishes what is practical, children get a meaningful choice, and the family tries the chosen activity together. The distinguishing idea is participation in choosing, rather than an app-selected daily recommendation or a progress goal.

This is a complete alternative product direction, not a voting feature to add to every other proposal. “Vote” language is deliberately avoided: preferences should not create winners and losers within the family.

## Family need and reason to return

The hypothesis is that the parent has ideas but struggles to get agreement or interest. A limited, suitable choice may give children ownership and let the adult stop being the sole activity organiser.

Initial audience hypothesis: families with children around 5–11 who enjoy choosing or taking turns leading. A parent with one child works just as well as a larger household. The app runs on a shared phone; no child accounts, remote notifications or individual scoring are needed.

The reason to return is “let's choose our thing”, with favourite ideas ready to use. Every choice is optional. A child can pass, an adult can change the practical constraints, and stopping without selecting anything has no penalty.

## Product loop

Set practical boundaries → show two or three suitable choices → ask the family → try one → optionally keep it as a favourite.

The parent first selects time and setting. The app produces up to three ideas that satisfy those constraints. The family points, says a preference, gestures or taps. One person leads the chosen idea; leading can change during play. No digital ballot or participant register is necessary.

If there is disagreement, the adult can suggest trying one briefly, switching, or leaving it for another day. Do not implement a tie-breaking roulette wheel or automatically overrule someone. A turn-taking prompt can say “Would someone else like to choose this time?” without keeping an obligation ledger.

## Navigation and screen specification

Two primary destinations: **Choose together** and **Our favourites**. Adult settings and existing content links sit behind the header/library controls.

Home asks “What fits today?” Default controls: 5 / 10 / 20 minutes and Indoors / Outdoors. An optional “Move / Make / Chat” filter sits behind “Change the kind of idea”; default Move should not accidentally suggest a cooking task without ingredients.

Once set, show two large cards, with a third only when the catalogue provides a genuinely different suitable option. Each has a readable title, small original illustration, actual duration, kit and adaptation availability. Keep each option equal in visual weight.

Copy: “Which would you like to try?” Buttons: “Choose this” and “Show other ideas”. Another small action says “Just choose for us” for parents who prefer a default. Do not force a choice among three unsuitable activities simply to fill a layout.

Activity screen: “Someone can lead” plus the short steps, adaptations and optional timer. Finishing early is available throughout. Completion asks “Keep this for another day?”; Save and Done are the primary outcomes. A private list of tried ideas can be secondary, without a target or ranking.

## Concrete journeys

**Two children want different things:** the adult chooses five minutes indoors with no kit. Cards offer Animal parade and Mirror moves. One child suggests the animals; the other leads the second turn. If they still disagree, the parent can end the selection or try another pair. The app does not declare which child won.

**One child is reluctant:** the parent offers a choice between gentle Shape makers and Freeze-frame stories. Their child points to Shape makers and chooses the first shape. A small amount of participation is enough; no minimum duration unlocks a reward.

**A grandparent joins:** the adult sets a seated requirement. Every presented choice has reviewed seated instructions. If the library has only one suitable idea, the app shows one and says “Here's something that fits”, instead of relaxing the requirement.

## Design and motion specification

Use the existing brand colours with bold, readable activity names and simple distinct illustrations. This version feels like two physical cards laid on a table. At narrow widths cards stack; no hidden horizontal carousel or rapid flipping.

A selected card gains a clear border and text state immediately. A 120–180ms scale/opacity response may reinforce selection, but avoid spinning wheels, animated shuffling, gambling-like reveal effects or unequal celebratory treatment of one person's choice.

Turn changes use a brief “Swap leaders when you like” message. Optional demonstration clips can be opened on demand. The interface is fully understandable with animation disabled and without sound.

## Minimum useful release

Ship constrained two-card choice, twelve reviewed activities, adaptations, an adult override/default and favourites. Do not ship digital family voting, assigned child avatars, a winner system or per-child preference history.

App-local data needs: the existing idea metadata plus presentation grouping and household favourites. A selection is temporary UI state. No durable record of who chose or refused is needed. If an attempt is recorded for evaluation, use a stable operation ID and the existing outbox; keep personal family interaction out of analytics.

Reuse existing recipes/workouts when appropriate, but screen for suitability and practical setup before presenting choices. Preserve old journals/records. Cached choices must remain available, and the app must explain when fewer ideas fit.

## Free and paid model

Always free: useful choices, unlimited play/replay, favourites, adaptations and enough reviewed content to offer genuine alternatives for common situations. Never sell extra votes, the right to choose, another child's participation or access to a fair selection.

Paid hypothesis: themed printable/digital **Family game decks**, such as Animal antics or Adventure indoors. Illustrative price test: £4.99–£7.99 for a coherent original deck with replay variations. Physical cards are a later option if families find that phones get in the way. Proposed prices require actual purchase testing.

A school/community licence could fund take-home game decks, but it should not track which child participated or send named family behaviour back to school. Avoid building a school dashboard for the first commercial test.

## Validation and decision gates

Observe six to eight families choosing one activity from the same constrained pair versus receiving a single suitable recommendation. Counterbalance order and do not frame choice as the desirable outcome.

Measure whether an activity starts, time spent negotiating, explanations needed, spontaneous willingness to lead and the adult's reported effort. Ask whether the child experienced real choice. Count sibling disagreement or pressure as a negative result, not successful engagement.

Working proceed signal: most households find the choice easier than negotiating without it, and no recurring conflict pattern appears. In a two-week small pilot, look for voluntary reuse of Choose together and favourite replay; report exact household counts. Do not claim causal retention improvements from a small self-selected sample.

If choices increase friction, reduce to two, improve suitability or return to the original single-recommendation model. If children love choosing but adults rarely open the app, test printable cards as the delivery format.

## Principal tradeoff

This gives children the strongest ownership with a small feature set. It also creates the biggest risk of slowing down the decision or making sibling disagreement worse. Choose it when research identifies buy-in and negotiation as the main barrier, rather than lack of time or lack of ideas.
