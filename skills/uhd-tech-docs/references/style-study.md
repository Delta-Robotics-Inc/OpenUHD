# Style study: Bambu Lab and DJI hardware documentation

Purpose: extract the *visual system* behind two companies whose hardware docs read as clean and
trustworthy, so we can build a CSS print template for UHD datasheets and assembly guides.

**We learn the style only.** We do not copy their text, illustrations, icons, color identity,
typefaces that are proprietary (Dji-Book/Dji-Demi), logos, or layouts verbatim. Our docs use our
own content, our own renders, and our own brand.

## Sources (downloaded 2026-09-26, stored git-ignored in `docs/reference-docs/`)

| # | Document | URL |
|---|---|---|
| B1 | Bambu Lab A1 Quick Start (24 pp) | https://cdn1.bambulab.com/documentation/quick-start-f507128172bdf/Quick%20start%20guide%20-%20A1-EN.pdf |
| B2 | Bambu Lab AMS Quick Start Guide (10 pp) | https://cdn1.bambulab.com/documentation/quick-start-0fa3c8ddd3d3f/AMS/English%20version-Quick%20Start%20Guide%20for%20AMS.pdf |
| B3 | Bambu Lab Wiki, P1S Quick Start (web page printed to PDF) | https://wiki.bambulab.com/en/p1/manual/p1s-quick-start-guide |
| D1 | DJI O4 Air Unit Series User Manual v1.0 2025.01 (23 pp) | https://dl.djicdn.com/downloads/DJI_O4_Air_Unit_Series/UM/DJI_O4_Air_Unit_Series_User_Manual_v1.0_en.pdf |
| D2 | DJI O4 Air Unit Series Product Information v1.0 (2 pp fold-out) | https://dl.djicdn.com/downloads/DJI_O4_Air_Unit_Series/PI/20250422/DJI_O4_Air_Unit_Series_Product_Information_v1.0.pdf |

Observations below come from rendered pages in `docs/reference-docs/pages/` (e.g. `hi-a1-03.png`,
`hi-a1-12.png`, `hi-a1-22.png`, `hi-djium-05.png`, `hi-djium-06.png`, `djium-10.png`,
`crop-djipi-1.png`).

---

## 1. Two archetypes

The two vendors represent the two documents we need:

- **Bambu quick start = assembly guide archetype.** Picture-first. One full-bleed-ish line drawing
  per page, one to four numbered sentences underneath. Almost no prose.
- **DJI user manual = datasheet / reference archetype.** Text-first with numbered chapters,
  gray section bars, callout-numbered product overview, fully dimensioned drawings, pinout table.

UHD should ship both from one template: shared tokens, two page layouts.

## 2. Page size, margins, grid

| | Bambu B1/B2 | DJI D1 | DJI D2 |
|---|---|---|---|
| Trim | 120 x 120 mm square | ~138 x 205 mm (A5-ish, narrow) | 390 x 240 mm fold-out |
| Outer margin | ~9 mm | ~12 mm | ~8 mm |
| Columns | 1 | 1 (2 for callout legend lists) | 4-5 narrow language columns |

- **Single column dominates.** DJI switches to 2 columns only for short enumerations (the
  numbered part legend under the overview drawing: 1-4 left, 5-8 right).
- **Bambu page anatomy** (fixed, every step page): title top-left -> thin full-width hairline
  rule -> illustration zone (~65% of page height, centered) -> instruction text zone anchored
  to the bottom (~20%). The text never floats up to meet the drawing; empty space sits between.
- **DJI page anatomy:** running header at top right/left (alternating, mirrored for recto/verso)
  with a 0.5 pt rule under it; body; folio + copyright at the bottom outside corner.
- Figures are centered on the text column; text is left-aligned (ragged right, no justify, no
  hyphenation) in both.
- Our target: A4 / US Letter print with a 1-col text measure of ~110-120 mm (DJI's measure) is
  the readable width; on A4 use 20 mm margins and let figures span the full text block.

## 3. Typography

- **Families:** both use a single humanist/geometric sans for everything (Bambu: HarmonyOS Sans
  in Regular/Medium/Bold; DJI: Open Sans + Semibold with a house display face for titles). No
  serif, no second family. We use one open-licensed sans (e.g. Inter, Open Sans, or IBM Plex Sans)
  plus its tabular-figure feature.
- **Scale (relative to body = 1.0):**
  - Chapter number + title (DJI "1  Product Overview"): ~1.6x, semibold, number set in the
    margin gutter with a wide tab before the title.
  - Section bar (DJI "1.1 Overview"): ~1.3x, semibold, dark text on a mid-gray (~#BDBDBD) full
    width bar, ~1.6x line height tall, text inset ~2 mm.
  - Sub-heading (DJI "DJI O4 Air Unit" above a drawing): ~1.1x semibold, no bar.
  - Page/step title (Bambu "Install Purge Wiper"): ~1.15x bold, on a hairline rule.
  - Body: ~9 pt DJI, ~7.5 pt Bambu (small trim); leading ~1.45.
  - Captions/labels in drawings: ~0.8x body, regular weight, gray (~#555) not black.
- **Weights:** only two in running text: regular and semibold/bold. Emphasis is by weight, never
  italic, never underline (links are color only, DJI uses light blue #1FA5E0-ish).
- **Numbers & units:**
  - DJI dimension drawings: one decimal consistently (`25.5`, `30.0`, `13.98` only where the
    tolerance warrants), units stated once in the caption: "(unit: mm)". No unit on each dimension.
  - Ranges use en-dash-like hyphen: `3.7-13.2 V`, `-10°C to 40°C (14° to 104°F)`.
  - Diameter uses Ø; thread callouts `4-M2.0` (quantity-thread) with depth `▽MAX3.0`.
  - **Anti-pattern observed (B1 spec table):** inconsistent unit spacing ("8.3kg" vs "300 ℃"
    vs "256*256*256 mm³", "*" used as multiplication sign). We fix this: always a thin/normal
    space between value and unit, `×` for multiplication, `°C` as two glyphs.
- Part-quantity notation (B1 accessory page): `ST3-23 Screw (×13)` with the `(×13)` in the
  accent color; the part's purpose in a second line in parentheses: `(For Base Housing)`.

## 4. Illustrations: renders, line art, exploded views

- **Style: monochrome line art, not photoreal renders.** Both vendors draw products as clean
  vector outlines: ~0.5-0.75 pt dark gray (#333-#444) outer silhouette, ~0.25 pt internal edges,
  no gradients, no shadows, white fill. DJI adds a flat light-gray fill on some faces; Bambu
  stays pure white.
- **Highlight by flat accent fill.** Bambu fills the *part being acted on* (build plate, table
  area, screw holes, zip-tied regions) with a flat semi-transparent brand green (~#8FD19E fill,
  darker green outline). Everything else stays neutral line art. This is the single most
  effective device in the set: the eye goes to the colored region instantly.
- **Context parts** are never removed: the whole printer is drawn, only the target is colored.
  There is no ghosting via transparency; context is conveyed by keeping it uncolored and
  equally thin-lined. (For our exploded views: context parts at 40% gray lines, active part at
  full weight + accent fill.)
- **Camera angles:** a consistent 3/4 isometric-ish view from front-right-above for full
  assemblies (B1 p12, B2 AMS pages); pure orthographic front/top/side for dimensioned views
  (D1 p6). The same product is shown from the same angle across consecutive steps so the reader
  does not re-orient.
- **Detail insets:** Bambu uses rounded-rectangle inset boxes (thin gray border, ~2 mm radius)
  with a zoomed detail, connected to the main drawing by a thin leader to the area, each inset
  tagged with a circled step number (1), (2) at its lower right. DJI uses similar insets with
  a circular magnifier.
- **Motion arrows:** broad, solid, flat accent-colored arrows (Bambu green block arrows for
  "slide in", "lift out"); DJI uses thin black arrows plus a numbered black disc for sequence.
  Arrows are the only filled, heavy shapes in the drawing.
- **Background:** white page, no backdrop, no floor shadow. Bambu B2 sometimes places the
  drawing on a very light gray (#F3F3F3) rounded panel; that is the only tint behind art.
- **Dimension drawings (D1 p6):** orthographic views, dimensions and extension lines in a light
  blue accent (not black) at ~0.35 pt, values in the same blue, so dimensions read as an overlay
  on the gray part geometry. Grouped per variant under a semibold sub-heading.

## 5. Callouts and leader lines

- **DJI numbered callouts (D1 p5):** plain numerals (no bubble) at the end of a straight leader,
  leader and number both in light blue, leader ~0.35 pt ending in a small dot on the part.
  Leaders are horizontal or vertical only, never diagonal; numbers sit outside the part
  silhouette, aligned in columns left and right of the drawing. The legend is a 2-column
  numbered list directly under the figure.
- **Bambu labeled callouts (B1 p4, B2 p4, B3):** text label directly at the end of a thin
  horizontal leader, no number indirection. Label text is ~0.8x body; leader in the same gray
  as the label (or accent green when naming the highlighted part). Labels align to a common
  left or right edge outside the art (B3 "Component Introduction": all left labels flush left,
  all right labels flush right).
- **Circled step numbers** (①②) are used in Bambu for linking an inset to its instruction line;
  ~4 mm circle, 0.5 pt stroke, regular-weight numeral, accent green when the step is on screen.
- Never more than ~8 callouts per figure; if more are needed they split the figure.

## 6. Steps and step layout (assembly archetype)

- **One page = one operation**, titled with a verb phrase in Title Case ("Install Build Plate",
  "Unlock Toolhead", "Lock Base Housing", "Place On Table").
- Under the art, 1-4 **circled-number instructions**, each one sentence, each one action.
  Sub-notes in parentheses indented under the sentence. Numbered markers are ①② glyphs, not
  "1." decimals, to distinguish steps from list items.
- **Quantity + fastener spec inline in the step:** "Install 2*ST3-23 Screws (For Base
  Housing) in the holes highlighted in green." The holes are colored in the drawing, so text
  and art cross-reference by color. (Use "2 × ST3-23" in ours.)
- **Parts-in-box pages first:** "What's In The Box" and "Accessory Box" pages show every item as
  a small isolated line drawing on a loose grid (3-4 per row), name centered underneath, quantity
  `(×n)` in accent. Items at consistent visual scale per row, not true scale.
- Tools needed appear as parts on the accessory page (Allen key H2, H1.5) rather than as icons;
  the step text names the tool. No torque values are given in either vendor's consumer docs;
  DJI covers it with "DO NOT overtighten the screws to avoid stripping." We will add explicit
  torque (N·m) since our audience builds from parts.
- Emphasized safety-relevant step line (B1 p12) is set entirely in accent green, below the
  numbered steps, not in a box.

## 7. Spec tables

- **D2 (DJI product info):** 3 columns (parameter | variant A | variant B), header row on
  a light gray fill, rows separated by 0.25 pt light-gray horizontal rules only, **no vertical
  rules**, no zebra striping. Parameter column is regular weight, left aligned, wraps to two
  lines ("Operating Temperature"). Values carry their own units. Footnotes marked `[1]` in the
  cell, explained in small gray text under the table.
- **D1 pinout table (p10):** 3 columns (signal | wire color | function), subtle alternate row
  tinting (#EFEFEF) as the only grouping device, multi-line values stacked in one cell.
- **B1 spec table:** grouped rows: a merged left "group" cell (Body, Toolhead, Heatbed, Speed...)
  spanning its item rows, then Item | Specification. Full grid in thin accent-green rules, header
  text in accent green, everything centered. Grouping is excellent; the full grid and centered
  numbers are busier than DJI's rules-only style. We take the grouping, drop the full grid.
- Neither uses a separate units column; we will (right-aligned value, left-aligned unit column)
  for datasheet electrical tables where numbers must compare vertically.

## 8. Iconography

- DJI defines a **legend on page 3** before content: three outline icons: triangle-! (Important),
  light bulb (Hints and Tips), open book (Reference). Monochrome, stroke ~0.75 pt, ~4 mm,
  same line style as the illustrations. Every later admonition uses one of these three only.
- Bambu uses almost no icons: a circle-slash "prohibited" overlay (TPU, damp PVA) in red on the
  AMS warning page, and QR codes. Color and the drawings do the work.
- Takeaway: a tiny closed icon set (3-5), outline style, declared in a legend.

## 9. Warnings, cautions, notes

- **DJI:** icon at left margin, text indented to a hanging position, bullets inside. Hint blocks
  get a hairline rule above and below spanning the text width (p5 note under the legend list).
  No colored boxes, no fills. "DO NOT" is set in capitals inline as the emphasis.
- **Bambu B2 p2:** heading "*Warning:" in bold, then small bulleted lines; the critical line is
  set in red text. No box.
- Both avoid heavy colored callout boxes. Severity is carried by icon + a single color of text.

## 10. Headers, footers, page numbers, revision

- **DJI running header:** product name in semibold + doc type in regular ("**DJI O4 Air Unit**
  User Manual"), outside-aligned, 0.5 pt rule beneath running the full text width.
- **DJI footer:** page number at the outside corner (~1.1x body, regular), copyright line in
  ~6 pt gray immediately inboard of it.
- **Revision:** cover shows a boxed version tag `v1.0` next to the date `2025.01`; the same
  appears on the cover's text layer and the filename (`..._v1.0_en.pdf`). Bambu prints a small
  document code on the cover bottom (e.g. part number with revision letter "-A").
- Bambu step pages carry no header/footer at all; the title rule is the only chrome.
- Back cover (both): logo, URL, "content subject to change", nothing else.

## 11. What makes them clean

1. **One idea per page / section.** Bambu literally one operation per page.
2. **Color restraint:** exactly one accent (Bambu green, DJI blue) plus grays; accent is
   reserved for "look here" (highlighted part, dimension overlay, quantity, link). Red only for
   prohibitions.
3. **Line art over photos:** uniform stroke weights make every figure look like one family.
4. **Consistent alignment:** titles, rules, body text, and table edges share the same left edge;
   figures are centered; callout labels align to vertical columns.
5. **Generous whitespace:** illustration zones are ~40-60% empty; text never crowds art.
6. **Predictable page anatomy:** same title/rule/figure/text positions on every page.
7. **Units stated once** (DJI "unit: mm") rather than repeated on every value.
8. Weak spots to avoid: B1's inconsistent unit spacing and full-grid tables; D1's reliance on
   external URLs for specs.

---

## Rules we adopt

Style is learned, not copied: our content, drawings, colors, fonts, and branding are our own.

1. **Page:** A4 / Letter, 20 mm margins, single text column max 120 mm measure; 2 columns only
   for callout legends and short lists.
2. **One sans family**, two weights in text (400, 600); headings 600-700. No italics, no
   underlines; tabular figures in tables.
3. **Type scale:** body 9.5 pt / 1.45; captions & drawing labels 7.5 pt in #555; section title
   12 pt; chapter title 16 pt with number hung in the gutter.
4. **Section headers:** full-width light-gray bar (#D9D9D9), 600 weight, 2 mm inset, or a
   0.5 pt hairline under the title for step pages. Pick per doc type; never both on one page.
5. **One accent color** (UHD accent) used only for: highlighted active part, dimensions,
   quantities, links, and step markers. Red only for prohibitions/danger.
6. **Illustrations are line art:** 0.6 pt silhouette, 0.25 pt internal edges, #333, white
   fill, no shadows/gradients/backdrops.
7. **Active part = flat accent fill at ~45% opacity + accent outline;** context parts drawn in
   full but in 40% gray lines. Never delete context.
8. **Consistent camera:** one iso 3/4 front-right-above view per assembly, held across
   consecutive steps; orthographic views only for dimensioned drawings.
9. **Callout numbers:** 5 mm circle, 0.5 pt stroke, 7 pt bold numeral; leader 0.5 pt, straight,
   horizontal/vertical only, ending in a 1 mm dot on the part; bubbles aligned in columns
   outside the silhouette; max 8 per figure.
10. **Named labels** instead of numbers when there are 5 or fewer parts; labels flush to a
    shared left/right edge outside the art.
11. **Dimensions:** accent color 0.35 pt, one decimal consistently, units once in the caption
    "(unit: mm)"; Ø, `4 × M2` thread notation, depth as "▽ 3.0".
12. **Assembly step page:** verb-phrase title -> figure zone (~65% height) -> 1-4 numbered
    one-action sentences anchored to the bottom. One operation per page/step block.
13. **Step markers** are circled numerals (① style, 4 mm) distinct from decimal list numbers;
    insets tagged with the same marker.
14. **Parts strip** at the top of every step: small isolated line drawings of consumed parts,
    name beneath, quantity as bold accent `×4`; tool icons in the same strip, right-aligned.
15. **Fasteners in text:** `4 × M3×8 SHCS`, with torque in N·m where applicable
    (`0.6 N·m`), always value-space-unit.
16. **Opening "In the box / BOM" page** laid out as a 3-4 up grid, items at consistent visual
    scale, quantities in accent.
17. **Spec tables:** header row on #F0F0F0, 0.25 pt horizontal rules only, no vertical rules,
    no zebra (optional light tint only for pinout tables); left-aligned labels, right/decimal-
    aligned numbers, separate unit column, grouped with a merged left group cell.
18. **Footnotes** as `[1]` in-cell, explained in 7 pt gray beneath the table.
19. **Admonitions:** three icons max (Warning triangle, Tip bulb, Reference book) declared in a
    legend on page 2-3; icon in margin, hanging-indented text, hairline rules above/below; no
    filled colored boxes. "DO NOT" in caps as emphasis.
20. **Units & numbers:** always a space between value and unit (`8.3 kg`, `300 °C`), `×` for
    dimensions (`256 × 256 × 256 mm`), ranges `3.7-13.2 V`, dual units in parentheses when
    needed.
21. **Running header:** product name 600 + doc type 400, outside-aligned, 0.5 pt rule; footer
    has page number at outside corner and doc ID + revision + date in 6.5 pt gray.
22. **Revision identity** on the cover as a boxed tag `Rev A` + ISO date, repeated in footer
    and filename.
23. **Whitespace budget:** figures may occupy at most ~60% of their zone; never shrink art to
    fit extra text, add a page instead.
24. **Alignment:** titles, rules, body, and table edges share one left edge; figures centered.
25. **No copying:** no vendor text, drawings, icons, colors, fonts, or layouts reproduced;
    reference PDFs stay git-ignored and are used only for visual comparison.
