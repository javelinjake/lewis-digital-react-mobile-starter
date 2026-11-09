# Version 1: Everyday Moments

Specification only · 2 October 2026

Visual companion: [initial design board](designs/01-everyday-moments.png) and [comparison gallery](designs/index.html).

**Promise:** “A little togetherness in the day you already have.”

The app helps families make ordinary transitions more enjoyable: getting home, waiting for dinner, taking a familiar walk or winding down. The parent chooses the situation; Zactiv offers a small activity that fits it. There is no weekly target or completion trail.

This is an alternative to the original Little Adventures proposal, not an additional module to bolt onto it. The distinguishing idea is using existing moments in the day rather than finding a separate activity slot. Audience and retention effects remain hypotheses to test.

## Family need and reason to return

For a tired parent, “make time for family activities” can sound like another job. This version aims to help when the family is already together. The useful trigger is a familiar situation: “We're waiting for dinner; what could we do?”

Initial audience hypothesis: adults with children roughly 4–11 who want very little preparation and do not value tracking. One shared phone is enough. Family arrangements, movement ability and communication styles should not change the value of the core experience.

The return mechanism is familiarity: a few games become family favourites, and new variations keep them useful. Opening every day is not a requirement. A family learning a game and playing it later without opening the app can be a successful outcome.

## Product loop

Choose the moment → see one suitable invitation → play from a short instruction → optionally save it as a favourite.

The activity's final screen says “Keep this one?” with Save and “All done”. It does not count days, minutes or success. A replay can offer an optional variation, such as a new animal or a different person leading, without making the old version unavailable.

## Navigation and screen specification

Two primary destinations: **For this moment** and **Our favourites**. Adult account/settings live behind a small header control. Existing workouts, recipes and journal entries remain reachable through “More ideas”; preserve existing deep links and records during any migration.

Home heading: “What does your day look like?” Display three simple choices:

- “A little gap” — a short game while waiting, including after school or before dinner.
- “Out and about” — an idea for a familiar walk or outdoor pause.
- “Winding down” — slower movement or a short conversation.

After choosing, show one recommendation with actual length, setting, equipment and adaptations. The default suggestion lasts about 2–5 minutes. Offer “Another idea” and a clear setting change. Do not assume that a family waiting for dinner can safely play next to a cooker, or that an outdoor moment suits everyone's access needs.

The activity screen contains a single instruction and two optional variations. Longer games can expand into up to three steps. No compulsory timer, registration or note. A seated/low-impact version is visible wherever relevant.

Our favourites is a small, searchable list only when its size warrants search. Do not build a playlist editor, a routine planner or a family calendar. Save a favourite through an explicit adult account if it must follow the household between devices; explain temporary guest saving honestly.

## Concrete journeys

**Before dinner:** a parent chooses A little gap. “Kitchen-side shapes” suggests moving to a clear safe area and taking turns making gentle shapes with arms. Everyone copies for two minutes. They tap All done and go back to dinner. No target remains unfinished.

**Walking home:** a grandparent chooses Out and about. “Spot a circle” turns a familiar accessible route into a spotting game. They can walk, roll or play from a safe seated outdoor location. The adult determines the route; the app requests no location access.

**A tired evening:** Winding down offers “Slow-motion mirrors”. A child leads a slow hand movement and the parent copies. If nobody wants movement, Another idea offers a conversation prompt. Chat is labelled as connection, not counted as exercise.

## Design and motion specification

Keep the existing cream, navy, blue and orange identity, with quiet editorial illustrations and generous space. The main visual is a small scene of the situation, not a progress dashboard. Labels describe the family's moment rather than fitness categories.

Use a 160–200ms fade for changing suggestions. An optional short illustration can demonstrate a gesture when the parent taps Play demonstration; keep a static text instruction available. Save feedback is a simple check and “Saved”, not a points celebration. Honour reduced motion and keep sound off until requested.

Do not use clock imagery that suggests being late, countdowns on offers, streak flames or unfinished task counters. Winding down must not automatically play stimulating media.

## Minimum useful release

Ship three moment choices, twelve reviewed ideas, an alternative suggestion and favourites. At least two short indoor no-kit Move ideas should fit each relevant everyday situation; include explicit adaptations. Reuse existing content only when its duration and suitability actually fit.

Small app-local data needs: idea, context labels, steps, adaptations, version, editorial order and household favourite. Optional attempts can support product evaluation, but do not expose an activity target to the family. Recording a favourite and syncing it must use the existing durable outbox; cached instructions need a clear offline state.

Leave reminders out initially. If parents ask for them, add one adult-selected optional prompt tied to a named situation, with a clear off switch. No escalating reminders after nonuse.

## Free and paid model

Always free: the three everyday contexts, a maintained starter library, unlimited replay, favourites, adaptations and core offline instructions. Refresh selections using the available reviewed catalogue, with a manageable schedule for genuinely new content.

Paid hypothesis: one-off **Rainy afternoons**, **School-holiday gaps** or **Gentle evenings** collections with original scripts and printable cards. Illustrative price test: £3.99–£5.99 per collection. Each pack is an optional source of variety, not the only source of a suitable activity. These are proposed test prices, not market evidence.

Community-funded printable/activity collections could support free household use. Avoid an annual subscription until parents show a recurring need for authored collections. Financial viability depends on low content-production cost and actual repeat purchases.

## Validation and decision gates

Ask eight households about an actual recent transition that was difficult. Give six households three situational cards and observe whether they can choose a fitting idea without explanation. Then pilot the twelve ideas for two weeks.

Measure self-reported use in ordinary situations, “easy to fit in” responses, saved/replayed favourites and reasons for abandoning a suggestion. Track Move attempts separately from Make/Chat. Include interviews about games played without reopening Zactiv; app opens alone would miss part of the benefit.

Working proceed signal: at least six of ten fully observed pilot households use an idea in an existing routine on two separate occasions, and most can explain when they would use it again. This is a provisional small-study decision rule, not a statistical benchmark.

If parents still say it feels like an extra task, simplify the instruction or change the situations. If they learn all the games and stop needing the app, test printable packs and occasional content purchases rather than manufacturing a daily dependency.

## Principal tradeoff

This is the simplest and calmest alternative. It may fit real family life well, but it has the weakest visible progress and potentially the weakest subscription case. Choose it if interviews show that parents want less planning and less tracking more than an ongoing adventure.
