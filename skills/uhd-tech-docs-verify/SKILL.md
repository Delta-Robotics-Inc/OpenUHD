---
name: uhd-tech-docs-verify
description: Verify UHD technical documents (datasheet, assembly guide) against the live model — re-resolve every bound value, check units/format, placeholders, stand-in watermarks, images, pagination and overflow, typography, BOM against generated/bom, and assembly coverage of every mate, hardware placement and wiring link — then run a visual review of the page renders. Use after uhd-tech-docs builds, and before handing documents to anyone.
---

# UHD technical documents — verify

Two stages: the automated verifier, then a visual review of every page. Loop with
**uhd-tech-docs** until both pass.

## Stage 1: automated

```bash
npx tsx scripts/docs/verify.ts library/systems/<id>              # all documents
npx tsx scripts/docs/verify.ts library/systems/<id> --doc assembly --json
```

It loads each paginated HTML in headless Chrome, re-imports the model, and writes
`docs/.review/verify-report.json` plus fresh page PNGs (`docs/.review/<doc>/page-NN.png`, from the
PDF with pdftoppm). Exit 1 on any error.

| Check | Fails when |
| --- | --- |
| values | a `[data-q]` element's text differs from the query re-resolved and re-formatted with its `data-f`, or its status changed (model edited since the build: rebuild) |
| format | a numeric value lacks the space before its unit; a unit is spelled two ways (warning) |
| placeholders | visible text contains NaN, undefined, null, `[object Object]`, TODO, TBD, `{{ }}`, Infinity |
| standin | a stand-in value lacks its S marker; a chart drawn from stand-in data lacks the watermark, or a measured chart still has one; a chart names a missing test file; the legend is missing |
| images | an `<img>` is missing, fails to decode, or is blank (ink < 0.4 %, flat luminance) |
| layout | a page body overflows; a table/figure/list is wider than the body; a heading or keep-with-next block is last on a page; a table continuation has < 2 rows; PDF page count ≠ HTML pages; a PDF page is blank |
| typography | text in a font other than Kode Mono / ProtoMono, fonts not loaded or not embedded, text below 5 pt, more than 16 sizes (warning), system-font fallback in the PDF (warning) |
| bom | a generated/bom.json line is missing from the datasheet, the line count differs, or generated/bom.json is stale against `buildBom()` of the live model |
| coverage | a mate from `assemble().mates`, a hardware placement from `assemble().hardware`, or a wiring link is in no step (steps record them in `data-mates / data-hardware / data-wiring`); a step lists hardware the model no longer places; automatic steps remain (warning) |

Fix the cause, not the symptom: a value mismatch means rebuild (or a builder computing a value
outside `values.ts`); a stale BOM means run the system's `generate.ts`; coverage gaps mean the
doc spec's step patterns miss something.

## Stage 2: visual review

Open every PNG in `docs/.review/<doc>/` (an agent can read them as images; use a higher
`pdftoppm -r 110` render for detail) and walk [the checklist](references/visual-review.md).
Record findings as `{ doc, page, issue, fix }`, fix them in the builder / CSS / doc spec, rebuild,
re-verify, and look again. Do not accept a page that only passes the automated checks.

## Report

Summarise: errors fixed, remaining warnings with reasons, the model gaps the documents expose
(gap markers "—", stand-in assumptions, missing torque/mass/direction data) for the model author.
