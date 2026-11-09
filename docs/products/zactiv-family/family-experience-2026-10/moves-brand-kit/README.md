# School Moves + Family Moves

Brand starter kit · 3 October 2026

## The relationship

Two sibling brands with one movement identity. School Moves helps teachers deliver practical PE. Family Moves helps households enjoy movement and wellbeing together. Use the shared three-stroke movement symbol, consistent wordmark construction and the same palette. The names distinguish the audiences; no additional umbrella brand is needed initially.

School line: **Confident teaching. Active schools.**

Family line: **Move together. Feel good together.**

Connecting line: **From school moves to family moves.**

## Palette and UI roles

| Colour | Hex | Use |
|---|---|---|
| Plum purple | #482C53 | Wordmarks, primary buttons, headings and strong backgrounds |
| Lavender | #DED5EB | Quiet panels, selected filters and supporting illustrations |
| Citron | #D5E75A | Highlights and secondary actions with dark text |
| Cloud | #F6F5FA | Main page background and text on purple |
| Charcoal | #302A38 | Body text and text on citron |

Avoid white text on citron and citron body text on cloud. Use purple or charcoal text on pale surfaces. Confirm contrast for final component states and sizes. Do not rely on colour alone for navigation, status or the school/family distinction.

School layouts: predominantly cloud and lavender, structured grids, purple headings and actions, citron used sparingly to highlight the next useful step. Family layouts: warmer illustration, larger activity cards, purple anchors and more playful citron highlights. The palette stays identical.

## Included assets

- school-moves-primary.svg and family-moves-primary.svg: purple horizontal logos.
- school-moves-reverse.svg and family-moves-reverse.svg: cloud logos for purple backgrounds.
- school-moves-citron.svg and family-moves-citron.svg: citron logos for dark purple backgrounds.
- school-moves-app-icon.svg and family-moves-app-icon.svg: shared icon with S/F badges so they remain distinguishable when installed together.
- moves-symbol.svg: shared editable symbol.
- tokens.css and tokens.json: framework-neutral colours, radii and motion tokens.
- brand-board.png: generated visual direction, separate from the deterministic starter SVG artwork.
- image-prompt.json: exact prompt for the generated board.
- index.html: preview of the real SVG assets, palette and board.

The SVG wordmarks contain editable live text using Arial/Helvetica/system sans. No font files are included. For consistent final production rendering, choose a suitably licensed font, refine lettering, and convert a final delivery copy to outlines while retaining editable masters. The raster board may show different letterforms or mark details; the included SVGs and colour tokens are the starter implementation reference.

## Logo use

Keep at least one stroke-width of clear space around the mark, and generous space around the full lockup. Do not stretch, rotate or add shadows. Use the full name whenever audience ambiguity is possible. Use the symbol alone only beside the name or within an established branded context. Check the logo at small sizes; use the icon instead of squeezing a horizontal wordmark into a square.

## Voice and imagery

School: practical, credible and encouraging. Example: “Ready for your next PE lesson?”

Family: friendly, flexible and specific. Example: “A little movement, together.”

Movement stays central, with room for food and emotional wellbeing. Show diverse ages and participation choices, including chair-based movement. Avoid elite-only sports imagery, weight-loss messaging, streak pressure and unsupported health claims.

## Using this in a new project

Copy the SVGs into the new project's public/brand directory and import tokens.css into its stylesheet. Map these colours into the project's existing theme rather than adding a second component system. For the existing React mobile monorepo, use its DaisyUI theme and native app icon pipeline. The app-icon SVGs are concept masters, not complete App Store/Android export sets.

Example markup:

```html
<img src="/brand/family-moves-primary.svg" alt="Family Moves" width="256" height="48">
```

Example token use:

```css
.brand-action {
  background: var(--moves-purple);
  color: var(--moves-cloud);
  border-radius: var(--moves-radius-button);
}
```

These are original initial design proposals. Name/trademark/domain availability has not been checked. The board uses the built-in imagegen tool; editable starter SVGs were created directly. No production app or existing brand assets were replaced.
