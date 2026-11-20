# Version 3: Story Trails

Specification only · 2 October 2026

Visual companion: [initial design board](designs/03-story-trails.png) and [comparison gallery](designs/index.html).

**Promise:** “A family story you can step into whenever you like.”

Zactiv provides short, authored adventures made of a few real-world activities. Families can follow a playful story over an afternoon or several weeks, with no deadline and no requirement to finish every part. A story bookmark replaces a weekly goal.

This is an alternative organised around continuity and imagination. It is more than a cosmetic map for the original Today screen: the reason to return is curiosity about the next small chapter. It must remain an activity app, not become a screen-based game.

## Family need and reason to return

The hypothesis is that families need a compelling premise, not more isolated activities. Children may want to return to a story they started, while adults may value having a few related ideas prepared for a weekend or holiday.

Initial audience hypothesis: adults with children roughly 4–10 who like pretend play and occasional shared adventures. Test whether older children find the treatment too young. One household can have one active story initially; do not begin with multiple saves, quests and inventory systems.

The return mechanism is a saved chapter and memorable theme. Progress waits indefinitely. Nothing deteriorates when the family is away, no characters need feeding, and no chapter expires. Stories remain replayable.

## Product loop

Choose a story → try one small chapter → keep a bookmark → continue when the family wants to.

Each story has three to five chapters. Each chapter is independently enjoyable, normally 5–15 minutes, and consists of an invitation, a real-world activity and a short ending. The family can finish early, skip a chapter, choose an adaptation or restart.

“Continue our story” is the default return action. “A quick standalone idea” remains available for a busy day without advancing the story. Standalone use is not displayed as a failure to make progress.

## Navigation and screen specification

Two primary destinations: **Our story** and **Choose a story**. Settings and existing content history remain behind adult controls; old content links continue working.

First use shows one free starter story and two clearly explained alternatives or upcoming themes. Metadata states number of chapters, typical chapter length, equipment and indoor/outdoor variants. Families try the first free chapter before adult registration. An account is offered to save the household bookmark across devices.

Our story shows a readable current chapter card and a simple illustrated list of chapters. States are “Ready”, “Tried” and “Skipped”, never locked behind completing an exercise quota. No 3D world, zoomable map or branching dialogue tree.

Chapter screen begins with one or two sentences of story. The Start action opens short real-world instructions, adaptations and adult guidance. The phone can be put down. At the end: “Keep our place” and “Done for today”. A short private note is optional.

Choosing another story offers to keep or replace the bookmark; never silently discard it. For the MVP, one active bookmark plus read-only history is enough. If paused stories become a real need, add a small saved-story list later.

## Concrete journey: The Missing Colours

The premise: “Our imaginary garden has lost its colours. Let's discover some together.” No character is distressed or dependent on the family returning.

Chapter 1, **Wake up the garden:** five minutes indoors. Take turns showing gentle growing/shrinking shapes. Seated hand/arm versions are equally valid. The family chooses a colour they imagine finding.

Chapter 2, **Colour explorers:** ten minutes on an adult-chosen familiar accessible route, or an indoor spotting version. Walk or roll and point out colours. No GPS, photo proof or collecting unsafe objects.

Chapter 3, **Make a colour pattern:** arrange safe familiar objects at a table. An adult selects appropriate materials; small-object/choking suitability matters. This is creative connection rather than verified exercise.

Chapter 4, **Tell our garden story:** each person contributes a word, sign, gesture or sentence. The final illustration becomes a free saved story keepsake, whether the family tried all chapters or skipped some.

**Busy-family example:** they try chapter 1 on Sunday and return two weeks later. The app says “Your next little chapter”, with the same bookmark. No catch-up message or lost streak.

## Design and motion specification

Keep existing brand colours but let each story have a consistent original illustration motif. Use a small linear chapter path or illustrated list, not a giant game world. Chapter text and actions remain readable independently of art.

A chapter transition may reveal one illustration element in 300–450ms, with text state updated immediately. A final keepsake can use a small one-shot stamp. Optional narration starts only after a tap and includes text/captions. Reduced motion uses static illustrations and the same controls.

Avoid currency, collectible rarity, random loot, scarce lives and “your character misses you” messages. No autoplay story clips or required watching before playing. The narrative should invite activity rather than make the app the centre of the family experience.

## Minimum useful release

Ship one complete free four-chapter story, a standalone short-idea fallback, reviewed adaptations, a durable bookmark and a simple chapter history. Add a second free story during the pilot to test whether families want another authored experience.

App-local data needs: story, ordered versioned chapters, activity references, illustrations, household bookmark and tried/skipped state. Store a snapshot/version reference so an editorial change does not corrupt an unfinished story. Bookmark and attempt writes use the existing outbox with conflict rules; cached text/illustrations should support planned offline play.

Reusing existing activity/recipe/video content can lower production effort, but each chapter needs editorial coherence and reviewed instructions. Do not change a fitness routine merely to fit a story. Preserve existing family notes and Zactivs commitments separately from the new narrative.

## Free and paid model

Always free: complete starter stories, unlimited replay, the standalone library, bookmarks/history, core offline instructions and adaptations. Earned keepsakes remain accessible after cancellation. Free stories must have satisfying endings; no paywall after a cliffhanger.

Paid hypothesis: buy an entire authored story, such as Space explorers or Rainy-day detectives. Illustrative price test: £5.99–£9.99 for four to six chapters, original art and printable materials. State equipment needs and preview a chapter before purchase. An optional collection bundle can follow if individual stories sell.

This direction has the clearest authored-content purchase, but also the largest content cost. Writing, review, illustration and maintenance all matter. Start with one pack; do not promise monthly releases or an annual subscription until production capacity and demand are demonstrated. Proposed prices are hypotheses, not verified willingness to pay.

## Validation and decision gates

Observe six families trying chapter 1, then ask them to explain what the app is for. Check whether the activity is understandable without the story and whether the narrative improves willingness to join.

Run a three-week pilot with ten to twenty households. Measure voluntary continuation to another chapter, chapter suitability, unfinished-story sentiment, replay, standalone use and demand for a second story. Separate Move attempts from nonmovement chapters; chapter completion is not proof of physical activity.

Working proceed signal: at least half of fully observed households voluntarily try another chapter, and those who pause feel no obligation or guilt. Ask parents whether having a prepared story reduced planning effort. Count and report nonresponders, and do not equate a story finished in one sitting with long-term retention.

If children watch more than they play, shorten the narrative and remove media. If chapters often do not fit a family's setting, improve alternatives rather than adding complicated branching. If the first story is liked but there is no demand for another, test a printable product before maintaining an expensive app catalogue.

## Principal tradeoff

This offers the strongest continuity and most tangible paid content. It carries the highest editorial/art workload and risks making families feel they have unfinished work. Choose it when children show real interest in continuing a story and parents value prepared weekend or holiday activities.
