# Zactiv Family: a smaller app with a stronger reason to return

Product and design proposal · 2 October 2026 · Prepared from the React app in this repository

**Recommendation:** turn the home screen into an answer to “What can we do together in the next five minutes?” Keep one suggested activity, one alternative, and a shared trail of moments. Preserve cooking and conversation as optional ways to spend time together. Make the free experience complete; sell curated adventures and funded access later.

This is a specification and an isolated design experiment, not a production release. No production routes, authentication, data, or shared packages were changed. Statements about existing behaviour come from the source. Explanations for low usage are hypotheses: no production analytics, family interviews, or live CMS catalogue were available.

## Open these first

- [Three alternative specifications](alternatives/README.md): Everyday Moments, Family Pick and Story Trails, compared with this original direction. These are specs only and retain the same no-pressure principles.
- [Interactive design studio](prototype.html): a working mobile flow, alternative activities, seated adaptations, a shared trail, a sticker collection, free/paid comparison, and animation experiments. Open directly or serve this folder locally. It uses fictional data in memory and resets on reload.
- [Design gallery](design-gallery.html): six implemented prototype screens, three current-app screens rendered with fictional API fixtures, and two generated art-direction boards.
- [Engineering specification](ENGINEERING.md): architecture, data model, offline writes, instrumentation, implementation steps and acceptance criteria.
- [Activity and research workbook](ACTIVITIES-AND-EXPERIMENTS.md): original activity scripts, recruitment, interview prompts, pilot design and decision gates.
- [Example code](examples/README.md): a deterministic activity selector, shared trail React component and motion CSS. These are reference examples, outside the production source tree.
- [Visual assets](assets/): concept artwork and exact screenshots of the working prototype. The generated concept board is artistic direction; screenshots show the implemented prototype.

The two generated mockup boards are [Little adventures](assets/little-adventures-concept.png) and [Scrapbook + paid pack](assets/scrapbook-and-pack-concept.png). Both were created with the built-in imagegen tool; exact final prompts are saved in [image-prompts.json](image-prompts.json). Fonts in the standalone studio are copies of the existing bundled Futura assets; this work did not acquire or assess a new font licence.

## 1. What the current app does well, and where it gets in its own way

The useful foundation is already here. Families can follow a warm-up, use countdown/EMOM/Tabata timers, check recipe ingredients, watch videos, save daily notes and earn Zactivs. Media and rich-text content come from Directus. There is a native shell, PWA support, React Query and an existing shared outbox package. You do not need to rebuild the whole app to find a stronger product.

| Source evidence | Family consequence to investigate | Proposed response |
|---|---|---|
| `src/components/shell.tsx`: Home, Workouts, Recipes, Videos and Journal are five primary tabs. | The parent has to choose a content type before choosing something suitable for now. | Three destinations: Today, Ideas, Our family. Organise Ideas by time and setting; retain old deep links. |
| `src/features/home/HomeScreen.tsx`: recommendation is the first workout/recipe; home video is `showOnHome` or the first video. Three numbered cards are stacked vertically. | Reopening may feel repetitive; the numbered sequence suggests three jobs to finish. | One relevant, curated invitation. “One is enough.” Rotation should be deliberate and suitable, not random. |
| Home's latest active log can be a recipe/video; the workout CTA uses the latest log's type and can point at a workout detail rather than the session. | “Continue” may be inconsistent with what the family was doing. | Resume the specific unfinished activity before suggesting new content; link to its actual session. |
| `src/routes/guards.tsx`: activity routes require authentication; welcome comes after registration/login. `RegisterScreen.tsx` requires email verification. | New families must invest before experiencing any benefit. | A public five-minute sample, then optional adult account to save a trail. Public access requires an explicit public content subset and permissions. |
| `WorkoutDetailScreen.tsx` and `WorkoutSessionScreen.tsx`: long written workout content, warm-up and exercise-oriented timers. | Some families may hear “fitness homework”; reading is difficult with an impatient child next to you. | Short game scripts with one instruction at a time. Keep existing fitness sessions in Ideas for families who like them. |
| `WorkoutCompleteScreen.tsx`: tick, rounds/time, Zactivs, feeling choice, note and two onward CTAs. | Reward lacks an obvious shared meaning; the end asks for more work. Feelings only offer positive answers. | “You made time together.” Add one trail marker; optional “Again / Not for us”. Prominent “Done for today”. |
| `src/lib/family-data.ts`: family name, members, journal, preferences and feelings use per-user localStorage. Family screen lists members but provides no add/invite journey. | “Your family” is mostly a profile, and records do not follow the household between devices. | Shared household records; start with one adult account and household trail. Defer invitations until parents need them. |
| `src/lib/activity-log.ts`: creation, linked event and completion use live Directus requests. Errors can return false; completion effect is guarded from repeating during the mount. | An offline completion can fail with no clear pending save, and partial writes can leave incomplete records. | One durable operation per completion through the existing outbox; clear local/save/sync status. |
| `SettingsScreen.tsx`: reminders is a boolean stored locally. No scheduling consumer found in the app source. | “Choose when” promises more than this control delivers. | Hide the setting until scheduling exists, or implement a simple day/time preference with clear permission and delivery behaviour. |
| `src/lib/family-data.ts` stores pending registration email/password with `btoa` in localStorage; auth store uses them after verification. | Base64 is reversible and leaves a password in persistent browser storage. | Before a wider pilot, remove password persistence and ask the adult to sign in after verification; clear legacy storage. |

The registration credential issue is a concrete finding, not a proposed engagement feature. Keep it in the first engineering increment. This proposal does not claim a complete security audit.

## 2. The product promise

**“A little adventure, together.”** Help a parent start a small, enjoyable family activity without planning, equipment or pressure. The useful outcome is family time outside the app. Measure repeated real-world attempts, not longer screen sessions.

Initial audience assumption: adults with children aged roughly 4–11, using one shared phone, often indoors after school. Validate this in interviews. A two-adult household is not the default: a parent and child, grandparent and child, siblings with an adult, and a seated participant should all work. Older children may prefer “challenge” or “mission”; do not add a separate teen product before evidence supports it.

The loop is **choose a moment → try something together → keep a small memory → return when it suits you**. Each step should take very little interaction:

1. Open Today and see an idea that fits five minutes, indoors and little preparation.
2. Start with one instruction; give a child the role of leader. Put the phone down when possible.
3. Tap “We tried it”, even if the activity was shortened. Honest self-report is enough.
4. See one shared marker and an optional feeling or memory. Leave with “Done for today”.

Three distinct techniques support that loop: a useful default reduces the parent's planning effort, turn-taking gives children ownership, and a permanent shared record recognises the effort. These are design hypotheses, not guaranteed retention effects. Self-determination theory identifies autonomy, competence and relatedness as important motivational needs; that motivates testing choice, attainable tasks and cooperation here. [Theory overview](https://selfdeterminationtheory.org/theory/).

## 3. Keep the product to three jobs

### Today: help us start

Above the fold: greeting, “How much time have you got?”, 5 / 10 / 20 minute choices, one illustrated card, clear practical metadata and “Let's play”. Under that: “Try another” and a small shared trail. A brand mark links home; account settings sit behind Our family. Remove the currency badge from the main header until a clear use exists.

Default is five minutes indoors. Remember a parent's choice for this session. Setting can be changed with Indoors / Outdoors; this is not a weather or GPS permission flow. Show activity length, equipment, age guidance and available adaptations before starting. An activity that requires ingredients should never silently replace a no-kit game.

Do not claim the first suggestion is personal until it really uses preferences. Label an editorial pick “A good place to start”. Change the featured content twice weekly, keep favourites repeatable, and avoid the last few completed suggestions when alternatives fit. If nothing fits, explain and offer to widen time/setting; never break a constraint just to fill the card.

**Busy Tuesday example:** a parent has five minutes before dinner. Animal parade is shown: “5 min · Indoors · No kit”. Their child chooses a penguin. Everyone copies, swaps leader, then stops early when dinner is ready. “We tried it” still adds a family moment. No stopwatch is required.

### Ideas: give us a little choice

Move, Make and Chat are filters inside one library. Move contains short games, outdoor missions and existing workouts. Make contains existing recipes with explicit child roles. Chat contains short conversation prompts. Videos are a medium attached to an idea, rather than a separate reason to navigate.

Use a compact list: title, practical metadata, small image and favourite toggle. Default ordering: a few curated suggestions followed by saved favourites. Keep existing search for a larger catalogue, but avoid building an elaborate filter drawer. Time and setting should cover the first release; adaptations are available on the activity.

**Rainy Sunday example:** choose 10 minutes indoors. Mirror moves appears. The child leads gentle shapes, the parent copies, and everyone switches. On another day they pick a favourite recipe and let the child wash and arrange vegetables while the adult handles heat and knives. Cooking and talking are family-time activities; do not mislabel them as equivalent physical exercise.

### Our family: show what we did

A three-marker weekly trail is the starting design. The goal is optional, no marker disappears, and no daily streak breaks. Weekly view starts fresh each Monday in the household's chosen timezone; lifetime memories stay. Offer “No weekly target” before a larger target configurator. A second moment on the same day may go into the memory collection, but only the first qualifying moment fills a weekly marker, so one long logging session does not look like sustained use.

After the third participating day: “Three little moments together”. The family can choose a free printable reward such as “You pick our next adventure”. This is a household ritual, not a voucher economy. Never paywall old memories, export, adaptations or restoring the family record.

For the first pilot, trial one illustrated trail and simple stickers; do not simultaneously ship a garden, pet, points shop, badge tiers and leagues. The prototype lets you compare trail and sticker visuals to decide which is clearest.

**Grandparent example:** an activity has a seated variant by default. The grandparent describes an animal using arm movements, their grandchild mirrors it, and the same family marker is awarded. No speed comparison, fitness level or calorie estimate.

## 4. Three visual directions to test

| Direction | What families see | Example interaction | Strength | Risk and recommendation |
|---|---|---|---|---|
| **Little adventures — recommended** | Warm cream, electric blue, orange detail, simple cut-paper illustrations, one idea per card. | A three-stop trail fills after an attempt. | Clear purpose and shared progress; fits existing brand colours. | Test whether illustrations feel too young for 9–11s. Use confident typography and activity photos for older variants. |
| **Family scrapbook** | Activity stickers and short private memories. | Animal parade becomes a small fox sticker; optional one-line note. | Emotional value and a family-owned record; works for movement, cooking and chat. | Photos and elaborate editing add effort. First version uses original stickers and text only. Compare as the progress view, not a fourth destination. |
| **Your weekend mission** | One themed card with a short optional three-part sequence. | “Colour explorers”: find colours, take a short walk, make a pattern. | Useful paid content format and a reason to plan a weekend. | A giant adventure map creates navigation and content debt. Introduce as a themed pack inside Ideas only after the simple loop works. |

The [prototype](prototype.html) implements the recommended flow, trail/sticker comparison and a paid-pack example. The concept board illustrates art direction; the interactive screens determine actual layout and copy. Exact screenshots are provided in `assets/`.

### Visual contract

- Retain cream `#f6f1e7`, navy `#091d39`, blue `#0000ff` and orange `#ffa500`. Use white/cream cards and blue primary actions. Orange is a decorative/reward accent; navy text on orange. Do not use orange text on cream for small labels.
- Use the bundled Futura for brand continuity. Headings around 30–36px on phones, body 16–18px with generous leading; no essential 10px metadata.
- One clear primary action per screen; secondary actions are plain text or restrained outlines. Minimum target 44px, preferably 48px; adequate spacing for a parent holding a child.
- Cards use 20–28px corners and light borders. Avoid multiple shadow layers, dense dashboards and autoplay media.
- Every illustrated activity also has a text title and instructions. Do not put instructions only inside a generated image. Optional audio/captions can be added when actual content supports them.
- Use the existing app components and DaisyUI as prescribed by the repository for production. The static studio is an isolated research artifact, not a second production component kit.
- At 320px width, 200% text zoom, keyboard use and reduced motion, the start and exit actions must still work. Use explicit text with selected states, not colour alone.

## 5. Animate meaning, not waiting

The prototype's Motion tab contains working experiments. Choose one completion treatment, rather than stacking them.

| Technique | Use | Concrete implementation | Timing and limits |
|---|---|---|---|
| CSS transform and opacity | A new idea appears after Try another. | A single card enters 6px from below; press feedback scales a button subtly. | 160–220ms; no carousel spin, no layout animation. |
| SVG trail reveal | Show one new shared marker. | Update accessible progress text immediately; animate only the connecting line using `stroke-dashoffset`. | Around 450ms; previous markers remain visible. |
| Web Animations API sticker stamp | Recognise one completed activity. | One sticker scales 0.92 → 1.03 → 1 and fades in. | Around 360ms; cancel on unmount and skip for reduced motion. |
| SVG timer ring | Optional turn-taking timer, rather than competition. | Numeric remaining time is the source of truth; an SVG arc derives from it. | No pulsing; start/pause/reset and a static reduced-motion state. |
| Short authored demonstration | Teach an unfamiliar movement. | A 6–12 second clip started by the parent, captioned, followed by a static instruction. | No autoplay; loading or muted sound must not prevent playing the game. Future content experiment, not required for MVP. |
| Rive or Lottie illustration | Future branded celebration if families value it. | Small one-shot asset behind an accessible text state. | Defer the dependency until CSS/SVG proves insufficient; no full-screen mascot loops. |

Use `prefers-reduced-motion` in both CSS and JavaScript, including when the setting changes during a session. Avoid forced sound, flashing, continuous confetti and vibration on every step. Optional success haptics should use the existing `@ld/native` wrapper only. Do not keep a family on the completion screen to finish watching an animation. [MDN animate API](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate), [web.dev reduced-motion guidance](https://web.dev/articles/prefers-reduced-motion).

## 6. A free version worth keeping

The free promise must survive a subscription cancellation. Basic use should work indefinitely:

| Always free | Optional paid depth |
|---|---|
| A maintained library of at least 12 good starter activities, with unlimited replay. | Curated themed packs: Space explorers, Rainy-day rescue, Holiday adventures. |
| At least two suitable no-kit five-minute indoor ideas, including seated/low-impact versions; fresh editorial picks twice a week from maintained content. | Longer authored adventure sequences with original art, clips and printable props. |
| Short activities across Move, Make and Chat; favourite saving. | Convenience: a prebuilt holiday/weekend collection to reduce planning. |
| Family trail, sticker memories, device sync, basic offline instructions, export and deleting data. | An optional annual pass to all published paid packs and future releases described accurately. |
| Core accessibility, captions where available, adaptations and parent controls. | Family gift purchases after entitlement/account support exists. |

No energy limits, “come back tomorrow”, lost streak penalties, paid accessibility or forced referral. Do not paywall the very feature that makes the family return. If free content is static forever and the good activities all become paid, the free promise is not credible.

### Recommended revenue sequence

**First test a one-off pack, not a subscription.** An original six-activity holiday pack at an illustrative £4.99–£7.99 is a tangible purchase with low commitment. Show it in Ideas after the parent has used several free activities, not between “We tried it” and their earned marker. The prototype shows a £5.99 pack with three free preview missions and transparent ownership language. Price is a test hypothesis, not market evidence.

If a pack converts and families want regular releases, test **£29.99/year** against **£3.99/month** for one household. Both are proposed prices. Keep single packs available. Subscriptions require a release cadence that you can fund; do not sell an annual promise before you know your content costs. Offer an adult-facing preview and clear renewal/cancellation details. Read current platform billing requirements before implementation; no billing policy or fee assumptions in this document should be treated as verified platform guidance.

**School or community licensing** could be the stronger model if schools already bring families in. The app carries school-slug registration/linking code, so this is an existing acquisition clue, not evidence that schools will buy. Pilot a £500–£1,500/year institution licence for content, parent invitation materials and aggregate outcomes, with free household access included. Schools should not see named child rankings or private journals. Start with a simple content licence and an aggregate report you can produce manually, not a school dashboard build.

**Sponsored free packs** are another option, using fixed-fee grants or sponsorship from community organisations. Keep branding adult-facing and identify the funding. Maintain editorial control, no behavioural targeting, no child-product shopping links and no selling family data. Signed agreements, local relevance and ongoing delivery cost determine viability.

Physical printable kits or books are a later adjacent sale if digital packs sell. Affiliate offers, family leagues, advertising inventory and a rewards marketplace increase operational complexity; leave them out of the first plan.

### Illustrative unit economics: useful bounds, not a forecast

At 2,000 monthly active households, 4% paying for a £29.99 annual pass means 80 paying households and £2,399.20 annual gross revenue, approximately £200/month before fees, refunds, tax treatment, content, support and acquisition. At 10,000 active households with 5% paying, the same calculation is £14,995/year gross. These are small sums relative to regular custom video production.

Twenty institutional licences at £750/year would produce £15,000/year gross, but sales, training, contracting and renewals may consume much of it. Fifty £5.99 packs sold in a month produce £299.50 gross, not recurring income. For a pack with £1,000 production cost, gross-revenue break-even is 167 purchases; actual break-even is higher after deductions. Build a sensitivity sheet when actual costs are known; do not justify production with assumed viral growth.

Test revenue without damaging free usage: measure parent purchase intent after a concrete preview, then a real paid pilot when billing is ready. The studio's pack button only records an in-memory expression of interest; it does not charge or send a message.

## 7. Inspiration to borrow carefully

| Reference | Verified observation | Application to Zactiv |
|---|---|---|
| [NHS Healthier Families](https://www.nhs.uk/healthier-families/activities/sports-and-activities/) | Presents active games and sports with a family-friendly starting point. | Lead with play and attainable starts. Five minutes is an entry point, not a claim to meet a child's daily activity needs. |
| [NHS accessible activities](https://www.nhs.uk/healthier-families/activities/accessible-activities/) | Offers inclusive activity ideas for disabled children and families. | Make adaptations a normal visible option in the core library. Have scripts reviewed for their intended audience. |
| [GoNoodle](https://support.gonoodle.com/article/192-is-gonoodle-really-free) | Offers free GoNoodle access and a separate paid school curriculum product. | Free household value can coexist with funded institutional value. Zactiv still needs its own customer and cost validation. |
| [National Trust 50 things](https://www.nationaltrust.org.uk/visit/50-things) | Uses concrete outdoor tasks and themed seasonal/rainy-day suggestions. | Give activities memorable real-world names and collect experiences rather than exercise statistics. Create original content; do not copy their list or art. |
| [Geocaching Premium](https://payments.geocaching.com/) | Sells a deeper adventure offering through premium membership. | Paid depth can build on a useful core activity. Avoid location tracking and cache infrastructure in this MVP. |

An adult-led design is still likely to be encountered by children. Keep progress private, location collection absent, and unnecessary child information out of the model. The ICO's guidance puts children's best interests and high privacy defaults at the centre; review applicability before launch rather than treating a parent login as sufficient. [ICO best-interests guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/best-interests-self-assessment/best-interests-of-the-child-overview/). This is product guidance, not a completed legal assessment.

## 8. A concrete six-week validation plan

These durations are planning estimates for a small team with existing infrastructure, not delivery guarantees. See the engineering document for build dependencies and the workbook for scripts.

| Stage | Deliverable | Decision |
|---|---|---|
| Days 1–3: diagnose | Interview 8–10 households: recent users, lapsed users and nonusers. Observe finding and starting one activity. Baseline the current funnel. | Is the real barrier content suitability, starting friction, device use, reminders, or trust? Adjust the proposition before coding the whole feature. |
| Days 4–7: test designs | Put the existing home and prototype in front of 6–8 adults/children. Counterbalance the order. Compare trail with scrapbook. | Proceed if most can start unaided within 30 seconds and explain the value. Investigate every “I wouldn't open this again”. |
| Week 2: build the smallest loop | Public sample, curated Today, short activity, completion, shared trail. Remove persisted password. Deliver minimum offline/data correctness and instrumentation. | No lost attempt after restart, no duplicate reward, no cross-household leak. Only then recruit the usage pilot. |
| Weeks 3–4: family pilot | 20–30 opt-in households, 12 edited activities, two editorial refreshes per week. Short weekly adult interviews. | Look for repeated activity on separate days without prompting. Use qualitative reasons and exact counts; this is too small to claim statistical certainty. |
| Week 5: focused iteration | Fix the largest observed obstacle; test one change, such as first-use before registration or a child-leader script. | Keep changes that improve repeated use and suitability, not just clicks. |
| Week 6: test willingness to pay | Preview one finished pack to returning parents; talk to 3–5 schools/community buyers. | Decide between packs, institution funding or further free-product work. Build billing only after credible demand. |

Suggested provisional pilot gates: 60% of invited/opted-in households try an activity in their first seven days; 40% of activated households attempt activities on at least two distinct days in the next seven-day window; at least 70% of respondents call their latest idea easy to fit in. Report numerators, denominators, survey response rate and missing data. These are internal targets to revisit after the baseline, not industry benchmarks. For a pilot of 25 activated households, “40% returned” is ten households, and three changes in behaviour move the percentage considerably.

Do not add social features to compensate for unsuitable content. If families say “we don't have the energy”, fix the starting activity. If they say “we keep forgetting but love it”, test one requested reminder. If they say “the kids found it boring”, improve scripts and child choice. If they say “we'd rather just remember the games”, that can be a successful family outcome; the business needs content families want renewed, not friction forcing app dependence.

## 9. Scope boundaries

Ship the chosen default, short play scripts and shared recognition. Preserve old workouts/recipes through the Ideas library and existing links. Avoid doing all of the following at once: custom avatars, public leaderboards, AI coaching, chat between children, GPS quests, wearable data, nutrition tracking, rewards stores, household competitions, complex planners or a dozen badge currencies.

Deferred ideas can be valuable later, but each must earn its complexity. A parent who gets one good activity and leaves smiling is a better first outcome than a parent who understands a large dashboard and never starts.

## 10. Open decisions and review questions

The proposal assumes 4–11 year olds, a UK audience, one adult account initially and an app intended to support movement plus family connection. Confirm the actual age mix, source of signups, size/quality of the CMS catalogue, available production budget, existing Zactivs commitments and how many families need multiple adults/devices. In particular, a promised real-world reward attached to Zactivs must be honoured or migrated transparently. Do not remove its value based only on this concept.

The artefacts include working design experiments, example source, and test evidence in [VALIDATION.md](VALIDATION.md). They do not establish that this redesign will improve retention. The next useful step is a short observed family test, followed by the smallest production pilot that makes those hypotheses measurable.
