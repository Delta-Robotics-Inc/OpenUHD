# Visual review checklist

For each page PNG in `docs/.review/<doc>/`. Mark each item pass / fix.

## Every page

- [ ] Header band and footer present (not on the cover); page number `NN / NN` matches the
      contents table.
- [ ] Nothing cut at the body edge or bottom; no half-empty page caused by a block that could have
      split (whitespace is fine when a section starts a new page).
- [ ] One left edge: headings, rules, tables and text align; figures centred or full width.
- [ ] No text overlapping art, other text, bubbles or leaders; no clipped labels in SVGs.
- [ ] Type: only the house sizes; no bold/italic fallbacks; no tofu boxes or odd glyphs (µ, Ø, ×, →).
- [ ] Accent used for highlights only (not body text); red only for warnings/errors.

## Figures (3D)

- [ ] The part(s) of the step are obvious: new parts in dark lines, hardware in accent, context grey.
- [ ] Exploded parts follow their axis in stacking order and do not collide or hide each other;
      dashed axes visible through the holes.
- [ ] Camera matches the previous step unless the step needs another view; nothing important is
      behind a context part.
- [ ] Callout bubbles sit outside the silhouette, leaders do not cross each other or pass through
      other callouts, every bubble matches a letter in the parts strip or a number in the table.
- [ ] Line weights consistent between figures (similar output width); no aliasing or noise.
- [ ] Dimensions point at the right features, text readable and bound to a value.

## Tables and charts

- [ ] Header row on tint, numbers right aligned, units consistent, no wrapped one-word columns.
- [ ] Continued tables repeat their header; no group row orphaned at a page end.
- [ ] Charts: axes titled with units, ticks readable, legend or labels not overlapping the data.
- [ ] Every chart from stand-in data shows the watermark and the badge; measured charts show none.

## Content sense

- [ ] Values are plausible (orders of magnitude, units) and identical where repeated.
- [ ] Assembly steps are in a buildable order, actions are one operation each, quantities match
      the strip, hardware counts match the hardware page and the coverage appendix.
- [ ] Wiring tables read pad-to-pad in the right direction; crossovers flagged.
- [ ] Gap markers (—) and assumptions (A) are visible where the model lacks data, not papered over.
- [ ] Safety notes present where the model or the doc spec calls for them (props, battery,
      cooling).
