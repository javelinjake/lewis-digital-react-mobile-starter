# School Moves: lesson webpage and generated PDF

Design prototype · 3 October 2026

## View the designs

- index.html: responsive lesson webpage, section navigation, teaching view and enlarged diagram dialog.
- pdf-preview.html: five-page printable design gallery.
- output/pdf/school-moves-year-3-football-week-1.pdf: generated A4 example.

School Moves identity: purple #482C53, lavender #DED5EB, citron #D5E75A, cloud #F6F5FA, charcoal #302A38. The browser prototype is isolated documentation, not a second production UI library. Adapt this design to the original school platform's components and theme when implementing.

## Changes from the supplied screenshots

The lesson title and purpose lead the page. Four compact facts show class, equipment, space and activity time. Learning objectives and whole-child goals are visible together. The session timeline and side navigation link directly to activities. Each activity pairs numbered instructions with a large schematic diagram; teaching cues remain visible, and progression can be collapsed. Teaching view reduces surrounding navigation and increases instruction text size. Reflection and after-teaching prompts finish the page.

The PDF is a reading layout with a deliberate page boundary per activity, repeated identity and lesson metadata, page numbers, embedded fonts, vector diagrams and printable teacher-note lines. Restrained colour and a white page background reduce ink coverage. A first-page overview helps preparation; the activity pages can be taken outside individually. No compulsory video, login, purchase or family feature has been added.

## Shared data, separate layouts

`data/lesson.json` is the single example content record. The webpage fetches it. `generate-pdf.py` reads it, draws the three shared SVG diagrams and produces the PDF. The builder does not overwrite the content record. Edit the JSON and run the builder to regenerate the PDF; refresh the webpage to see the same update.

This demonstrates the required direction: application data becomes the authoritative content, and the PDF becomes an output. The download in this prototype points to a generated example snapshot; it is not a live server-side export endpoint.

## Production integration with the original school platform

1. Inspect its actual CMS collections, content relations and permissions. Map existing fields to a normalised lesson model rather than introducing a competing content store.
2. Store reviewed structured activities, timings, instructions, progressions, cues, reflection and diagram assets where the original architecture supports them. Preserve the source PDF for provenance during migration. Do not continue parsing a PDF at every page load.
3. Use one validated lesson snapshot for both renderers. Include content revision, review status, asset references and export-template version. Web and PDF should retain the same wording and ordering while using different layouts.
4. Add an authorised PDF export endpoint/job in the existing backend. Validate access server-side, load the lesson snapshot, render it, and return the PDF. Reuse the original application's auth; a hidden URL is not permission control.
5. Cache exports by lesson ID + content revision + template version. Regenerate when any input changes. Avoid filenames or cache keys that contain pupil/teacher personal data.
6. Use actual diagram assets with text descriptions. Do not let missing assets silently produce broken boxes. Show draft/review status consistently; missing fields remain missing rather than being invented.
7. Handle long lessons with content-aware pagination and continuation headings. Keep headings with their first paragraph and numbered steps intact where practical. Never shrink an entire page to tiny type or clip overflow to force one activity per page.
8. Test short and long lessons, absent progressions, long equipment lists, missing images, special characters, page boundaries, grayscale and print margins. Verify export text against the loaded snapshot.

The included Python renderer is a reproducible design example. Production can use the existing backend's preferred PDF engine or a dedicated HTML print template if that fits better. A separate print template should still consume the same lesson model; avoid screenshotting the interactive webpage into a PDF.

## Example lesson-model shape

```ts
type Activity = {
  id: string;
  phase: string;
  title: string;
  minutes: { min: number; max: number };
  setup: string;
  steps: string[];
  progression: string[];
  cues: string[];
  diagram: string; // In production: asset reference + descriptive text.
};

type Lesson = {
  id: string;
  revision: string;
  reviewStatus: string;
  title: string;
  year: string;
  unit: string;
  week: number;
  weeks: number;
  category: string;
  space: string;
  children: number;
  equipment: string;
  summary: string;
  objectives: string[];
  wholeChild: string[];
  tip: string;
  activities: Activity[];
  reflectionIntro: string;
  reflection: string[];
  afterTeach: string[];
};
```

## Content and diagram boundaries

Content was transcribed from the four supplied screenshots. The original PDF was not supplied. Only minor punctuation normalisation has been applied; field labels and section titles have been adapted for presentation. Activity minutes total 45-50; reflection and transitions have no specified duration. The source does not state distance units for its 30 x 30 and 20 x 10 setups, so no units have been inferred.

The original green diagrams have been replaced with schematic vector redraws, not a verified reconstruction of every player or arrow. Repeated player symbols represent an illustrative arrangement, not exact class count. The warm-up diagram represents the initial no-ball setup; the written progression adds the ball. Review diagrams, setup and lesson content before classroom use. No new differentiation, inclusion or safety instructions have been fabricated.

Teacher notes in the PDF are ordinary writing lines, not PDF form fields. The browser does not pretend to save teaching feedback. No video or home card appears because none was supplied for this lesson.

## Generation and checks

Run `generate-pdf.py` with Python and ReportLab installed. Output is regenerated from JSON. Use a local web server to open index.html; fetching JSON from a file URL is not supported.

The five PDF pages were rendered and visually reviewed. `verify-design.mjs` checks the example browser interactions and captures desktop/mobile previews. Runtime paths in that verification script are local to this workstation; adjust them for another project.

The prototype's browser-print CSS is a fallback. Use the generated PDF for the designed paginated handout. The example PDF is not tagged for PDF/UA; establish accessible export requirements before production.
