---
name: uhd-tech-docs
description: Produce presentation-grade technical documents (datasheet, assembly guide; later wiring guide, quick start, test report) for any UHD module or system, with every value queried from the live UHD model, figures rendered from the CAD artifacts, stand-in test data watermarked until measured data replaces it. Use when asked for a datasheet, assembly/build guide, or other printed documentation of a UHD system; follow with uhd-tech-docs-verify.
---

# UHD technical documents

Generate HTML + PDF documents from a UHD system. The model is the only source of
values: the document is a *presentation* of queries into it. Nothing numeric is
typed into a document by hand.

```
docspec.ts ──► scripts/docs/build.ts ──► <system>/docs/*.html, *.pdf, *.values.json, images/
   (presentation)      │  model: SYSTEM + lookup, assemble(), wiringChecklist, checkSystem, generated/bom.json
                       │  test data: <system>/docs/test-data/<test-id>.json (standin | measured)
                       ▼
               scripts/docs/verify.ts  (skill: uhd-tech-docs-verify) + visual review of page PNGs
```

## Run it

```bash
npx tsx library/systems/<id>/generate.ts                  # refresh generated/ (BOM, wiring) first
npx tsx scripts/docs/build.ts library/systems/<id>        # stand-ins, figures, HTML, PDF, page PNGs
npx tsx scripts/docs/build.ts library/systems/<id> --only datasheet --no-pdf   # fast iteration
npx tsx scripts/docs/verify.ts library/systems/<id>       # must exit 0
```

Requirements: `google-chrome` (headless, SwiftShader WebGL), `pdftoppm`/`pdfinfo`/`pdffonts`
(poppler), three.js (resolved from `$UHD_THREE_DIR`, `node_modules/three`, or the sibling
`uhd-viewer` checkout), fonts from `$UHD_DOC_FONTS` (default
`~/repos/Protoboard/next-alpha/public/fonts`; copied to `docs/assets/fonts/`, git-ignored because
ProtoMono is a licensed webfont). Figures are cached by content hash in
`docs/images/.render-cache.json`, so a rebuild only re-renders what changed.

## 1. Before writing anything

1. Read the system: `index.ts` (children, links, mates, harnesses), `hardware.ts`,
   `harnesses.ts` (`fastenerStack`), `scenarios.ts`, `generated/`.
2. Dump what the documents will draw on:
   `assemble(SYSTEM, lookup, { root })` — placements, mates, `hardware`, routes, unrouted, issues;
   `wiringChecklist` (and sub-assemblies' links); `checkSystem`; each part's
   `verification.json` / `sources.json`.
3. Read [style-study](references/style-study.md) ("Rules we adopt") and
   [house style](references/house-style.md).
4. Note what the model **does not** say that the document type needs (torque, frame mass,
   motor direction, thermal limits...). These become gap markers in the document and a list
   for the model author — never invented values.

## 2. Write the doc spec

`<system>/docs/docspec.ts` default-exports a `DocConfig` (`scripts/docs/lib/types.ts`). It holds
presentation only — see [docspec reference](references/docspec.md):

- `title`, `docId`, `revision`, `root` (assembly root), `camera` (house iso direction);
- `placementHints`: placements for strapped/free parts, from model constants (e.g. the frame's
  `BATTERY_PAD`), never from typed coordinates;
- `datasheet.keyFigures` / `specGroups`: labels + value queries + format;
  `mechanicalCallouts` (`<instance>.<interface>`), `hub` (module whose pinout is tabulated);
- `assembly.steps`: ordered groups of mate ids / wiring link ids (wildcards), `place` for
  unlinked parts, camera/explode per step, authored notes (may embed `{{query|format}}`);
- `testData.standins`: the stand-in recipe (`scripts/docs/lib/standins/<name>.ts`).

Anything the spec leaves out still appears: the builder appends automatic steps for uncovered
mates and links, and the verifier warns so you can order them.

## 3. Values: queries, formats, markers

Every value goes through `doc.v(query, format)` and renders as
`<span class="v" data-q="…" data-f="…" data-s="status">`. The verifier re-resolves each one.
Query forms ([value-queries](references/value-queries.md)):

| Query | Example |
| --- | --- |
| `def:<moduleId>:<path>` | `def:cnhl-black-series-1100mah-6s-100c:domains[domain=mechanical].weight_g` |
| `inst:<instance path>:<path>` | `inst:stack/fc:interfaces[id=bec_5v].parameters[id=voltage].value` |
| `sys:<path>` | `sys:checks.diagnostics[rule=propulsion_current].details.totalPeak`, `sys:bom[line=3].quantity` |
| `derived:<name>` / `derived:<fn>(args)` | `derived:mass.known_total`, `derived:frameDistance(frame.motor_mount_fl,frame.motor_mount_fr)` |
| `ver:<partId>:<path>` | `ver:meps-neon-2207-v2-1950kv:audit.confirmed` |
| `test:<test-id>:<path>` | `test:hover-current:summary[id=hover_current_A].value` |

Formats (`scripts/docs/lib/format.ts`): `d1` decimals, `s3` significant digits, `si` SI prefix,
`u=<unit>` unit override, `hex`, `pct`, `nounit`. Always value, space, unit (`22.2 V`);
ranges `3.7–13.2 V`; thousands grouped `30 342 rpm`.

Status markers (superscripts, legend auto-inserted): none = cited source or model design value;
**D** derived (formula listed in the provenance appendix); **A** the model marks it an
assumption; **S** stand-in data; **M** measured; **—** not in model (gap). Add a derivation in
`scripts/docs/lib/derived.ts` (with its input queries) rather than computing in a builder.

## 4. Figures from the CAD

`scripts/docs/lib/render/` renders GLB artifacts placed by `assemble()` matrices in headless
Chrome (three.js), returning a PNG plus projected anchor points; callouts, leaders and
dimensions are drawn as vector SVG over the image (`blocks.ts: callouts, dimension`).

- **Modes:** `lineart` (flat light fills + screen-space outlines from object id, depth and
  normal edges — assembly steps and drawings), `shaded` (PBR + soft outlines — covers).
- **Styles per body:** `normal` (fitted in this step), `context` (already assembled, grey),
  `accent` (hardware / interface features to find, orange), `ghost`, `hidden`;
  `accentNodes` highlights named GLB nodes (interface feature sub-shapes such as
  `motor_mount_fr`, pad groups such as `motor_2_pads`).
- **Exploded views** (`figures.ts: explode`): mates sharing a structure interface form a joint;
  every part on it (mounted modules at their mate gap, hardware at its `fastenerStack.atMm`) is
  ranked by position along the structure normal and offset by rank × distance, so the explosion
  order *is* the stacking order. Dashed accent axes run through each hole. Nested joints carry
  their parent's offset.
- **Cameras:** orthographic, fitted to the projected geometry; one house iso direction held
  across steps; top (`dir [0,0,1], up [1,0,0]`) and side views for drawings.
- Thumbnails of every part for the kit page and parts strips (`common.ts: thumbnail`).

## 5. Test data and graphs

Convention: `<system>/docs/test-data/<test-id>.json`, one file per test, schema
[`templates/test-data.schema.json`](templates/test-data.schema.json), guide
[test-data](references/test-data.md). `status: "standin"` files are generated from the model by
the stand-in recipe (they list `provenance.derivedFrom` queries and every `assumption`) and are
drawn with a **STAND-IN DATA — NOT MEASURED** watermark and S markers. Drop in a file with
`status: "measured"` (same id, same columns) and the next build uses it unmarked; stand-in
generation never overwrites a measured file. Charts are inline SVG (`charts.ts`: line, bar,
meter) following the style rules; a chart records `data-test` and `data-status` for the verifier.

## 6. Document types

| Type | Builder | Sections |
| --- | --- | --- |
| Datasheet | `lib/docs/datasheet.ts` | cover (shaded hero, key figures) · overview + architecture diagram from links · specifications · mechanical (top/side drawings with dimensions, interface callouts + table with D1/D2/D3 binding) · interfaces and pinout (hub allocation pad to pad) · electrical (rails, supply budget, propulsion vs battery) · performance (maker data + test-data charts) · design checks per scenario · BOM (generated/bom.json) · evidence and assumptions · value provenance |
| Assembly guide | `lib/docs/assembly.ts` | cover (exploded) · before you begin (contents, tools from hardware tags, figure key, safety) · kit (thumbnails, BOM qty) · hardware (fastener stack sections to scale) · steps (parts strip with letters + ×qty, exploded figure with callouts, generated actions in stacking order, wiring tables/diagrams, torque line, model notes) · coverage appendix |
| Later | add `lib/docs/<type>.ts` + an entry in `build.ts DOC_TYPES` | **wiring guide** (from `wiringRows`/`wiringDiagram` per harness), **quick start** (key figures, battery/props steps, safety), **test report** (one page per test-data file, table + chart + conditions + provenance) |

Assembly steps are *derived*: parts = bodies the step's mates place + hardware on those mates +
wiring ends not yet introduced + cables; actions come from joints (see `jointActions`), wiring
tables from `wiringChecklist` connections (crossovers flagged), notes from harness
`usage_note`s, `operating_conditions.cooling`, mounting metadata, plus authored spec notes.

## 7. Layout and pagination

The builder emits a flow of blocks; `templates/flow.js` paginates them into A4 frames in the
browser (keep-with-next headings, table splitting with repeated header, cover/full pages,
page numbers, contents), then the paginated DOM is saved as the final HTML and printed to PDF
with `preferCSSPageSize`. Theme: `templates/doc.css` (light pages, dark cover, Kode Mono body,
ProtoMono display, orange accent, one type scale). Glyphs the fonts lack are mapped in
`format.ts: glyphSafe`.

## 8. Finish

Run **uhd-tech-docs-verify**, fix every error, do the visual review of the page PNGs in
`docs/.review/<doc>/`, iterate. Report the model gaps the documents exposed (gap markers,
stand-in assumptions) to the model author. Keep everything local: no pushing or publishing.
