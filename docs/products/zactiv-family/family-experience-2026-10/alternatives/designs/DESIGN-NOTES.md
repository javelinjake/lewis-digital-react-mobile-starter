# Initial designs for the three alternatives

2 October 2026 · Visual concepts, not production UI or interaction prototypes

Open the [comparison gallery](index.html). Each direction has three mobile screens showing a start, an activity and a return/saving experience. The boards use the same Zactiv colour and typography direction, so the comparison is about the experience rather than three unrelated brands.

## 1. Everyday Moments

[Full-size design board](01-everyday-moments.png) · [Specification](../01-EVERYDAY-MOMENTS.md)

The quietest layout: situational cards replace activity categories, and favourites replace progress. The illustrated contexts help a parent recognise their current situation without reading a catalogue.

The middle screen uses a short seated shapes activity to demonstrate that accessible participation is part of the default experience. The important action is All done; saving a favourite is optional. The favourite screen should stay small and useful rather than turning into a scrapbook management task.

Motion intent: a 160–200ms suggestion fade, an immediate save check, and no reward sequence. The static boards do not demonstrate animation.

Review question: would the moment choices help a tired parent find an idea faster, or add an unnecessary first decision? Test whether the labels fit actual family situations before expanding them.

## 2. Family Pick

[Full-size design board](02-family-pick.png) · [Specification](../02-FAMILY-PICK.md)

Two clear activity choices are the central visual. Both must have equal prominence and satisfy the parent's constraints. The selected activity should support different ways of joining without registering individual children or creating a voting system.

The activity's child-leader invitation makes ownership visible; a seated adult can join on the same terms. Completion offers Save and Done, with no family score or prompt to choose another activity.

Motion intent: immediate selected state, with an optional 120–180ms card response. No animated shuffling or wheel. Screen text and selected states must remain clear with motion disabled.

Review question: do two choices make starting easier for this family, or create another negotiation? If the latter, retain the Just choose for us escape and compare with the original single recommendation.

## 3. Story Trails

[Full-size design board](03-story-trails.png) · [Specification](../03-STORY-TRAILS.md)

The garden motif carries a simple family story, The Missing Colours. A readable chapter list communicates continuity without a game world, inventory or locked steps. A standalone short idea stays available when a story chapter does not fit the moment.

The chapter screen shows an indoor alternative to an outdoor spotting activity, with a wheelchair-using child joining the same family scene. The selected setting and instructions are explicit. Production imagery should continue to match the active setting and adaptation. This first concept is for discussing layout/art direction, not a final content-state implementation.

The return screen says Your story can wait. Tried and ready states should not imply debt or mandatory order. Families can skip chapters and still keep the story memory.

Motion intent: a small optional 300–450ms illustration reveal between chapters; no waiting for an animation to finish before leaving. Narration stays opt-in and text remains available.

Review question: does the story add a reason to play and return, or create too much reading before the activity? Start by testing one short chapter.

## Shared design intent

- Existing cream, navy, electric blue and orange identity; original illustration direction and spacious geometric typography.
- Two primary destinations in each alternative, as specified. Settings remain secondary.
- One clear next action, with an easy exit and optional saving.
- No daily quota, broken streak, pressured mascot, points shop, locked reward or comparison between children.
- Text instructions remain independent of artwork. Adaptations are visible and core accessibility stays free.
- Production controls need 44–48px targets, proper semantics, measured contrast, responsive layouts and reduced-motion support. Raster concepts do not verify these requirements.

## Scope and provenance

The three boards were generated with the built-in `image_gen.imagegen` tool. Exact final prompts are recorded in [image-prompts.json](image-prompts.json). The gallery is a standalone document; no production app code, shared packages, backend records, paid products or working animation was changed.

Generated lettering and UI proportions are initial concept material. Treat the written specs as the source for exact interaction requirements. Move a selected direction into deterministic UI design and observed family testing before implementation.
