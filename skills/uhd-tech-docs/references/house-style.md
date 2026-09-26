# House style (as implemented)

Applies the adopted rules in [style-study](style-study.md) to the ProtoBoard brand. Source of
truth: `scripts/docs/lib/templates/doc.css`, `charts.ts`, `render/page/render.js`.

## Page

- A4 portrait, printed with `preferCSSPageSize`. Frame: header band at 9 mm (accent square,
  product name in ProtoMono, doc type, doc id), body 20–280 mm, 16 mm side margins (178 mm
  measure), footer at 8 mm (brand, doc id · Rev · date, page `NN / NN`).
- Cover: dark top (#111, 8 mm grid), kicker in accent caps, title in ProtoMono with the last word
  in accent, rev/date/id tags, shaded hero render; light bottom with key figures and the legend.
- Sections: `NN TITLE` in ProtoMono 13.5 pt with a 0.5 pt rule; sub-heads 7.6 pt caps with an
  accent square; each major section starts a page.

## Type

Kode Mono for text and numbers (tabular), ProtoMono for display. One scale:
5.5 (markers) · 5.8 (micro) · 6.4 (small, captions) · 6.9 (tables) · 7.6 (body) · 8.6 (lead) ·
12 (step titles) · 13.5 (section) · 15 (key figures) · 25 pt (cover). The verifier warns above 16
sizes and fails below 5 pt. Glyphs the fonts lack are mapped (`glyphSafe`: µ → μ, Φ → Ø, Ω → ohm).

## Colour

Ink #1b1b1b, muted #6f6f6f, rules #d6d6d6, tint #f3f3f3, accent #ff5c00 (fills, bubbles, axes,
highlights) and #d94e00 for small accent text; red #c62828 only for warnings and errors.

## Figures

- Line art (`lineart`): flat light fills, 1.5 px-equivalent silhouettes, lighter creases;
  context parts grey (#f5f5f5 fill, #a8a8a8 lines); new parts natural tints with dark lines;
  hardware and interface features accent (#ffb584 fill, #d24a00 lines); dashed accent axes.
- Shaded (`shaded`) for covers only.
- Orthographic cameras, fitted to the geometry; transparent background.
- Callouts: 4.5 mm bubbles in columns at the figure edges, 0.5 pt straight leaders ending in a
  dot; letters in steps (match the parts strip), numbers in drawings (match the table); accent
  bubbles for hardware / interfaces.
- Dimensions: accent 0.4 pt lines with arrowheads, value from a query, `(unit: mm)` in the caption.

## Tables and charts

Header row on tint with a 0.5 pt ink rule, 0.25 pt row rules, no vertical rules, numbers right
aligned, groups as caps rows. Charts: hairline grid, one accent series, ink/grey for others,
legend row under the axis, stand-in watermark + badge.

## Markers and notes

Status superscripts in accent (A, D, S, M) or grey (—), legend on the cover and spec page.
Admonitions: WARNING (red triangle), CAUTION (accent triangle), TIP (bulb), NOTE (info); hairline
above and below, no filled boxes.
