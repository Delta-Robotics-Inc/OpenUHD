# Documents — 5-inch 6S quadcopter

Generated from the UHD model by `scripts/docs` (skill: `skills/uhd-tech-docs`). Do not edit the
HTML or PDF by hand: change the model, the doc spec or the builders, and rebuild.

| File | What |
| --- | --- |
| `quadcopter-5in-datasheet.html` / `.pdf` | Datasheet: specifications, mechanical drawings with interface geometry, pinout, electrical, performance, design checks, BOM, evidence, value provenance |
| `quadcopter-5in-assembly-guide.html` / `.pdf` | Assembly guide: kit, fastener stack-ups, 11 steps from the model's mates, fastener stacks and wiring, coverage appendix |
| `*.values.json` | Every value each document shows: query, formatted text, status, source / formula |
| `docspec.ts` | Presentation spec: key figures, spec rows, callouts, step order, cameras, notes |
| `images/` | Figures rendered from the CAD artifacts (content-hash cached) |
| `test-data/` | Test data, one JSON per test (`status: standin` until measured) |
| `assets/fonts/` | Fonts copied in at build time (git-ignored; ProtoMono is licensed) |
| `.review/` | Page PNGs and `verify-report.json` (git-ignored) |

## Regenerate

```bash
npx tsx library/systems/quadcopter-5in/generate.ts            # BOM, wiring, checks (generated/)
npx tsx scripts/docs/build.ts library/systems/quadcopter-5in  # stand-ins, figures, HTML, PDF
npx tsx scripts/docs/verify.ts library/systems/quadcopter-5in # must exit 0
```

Needs Google Chrome, poppler (`pdftoppm`, `pdfinfo`, `pdffonts`), three.js (from
`$UHD_THREE_DIR` or the sibling `uhd-viewer` checkout) and the brand fonts (`$UHD_DOC_FONTS`,
default `~/repos/Protoboard/next-alpha/public/fonts`). `--only datasheet|assembly` and `--no-pdf`
speed up iteration.

## Test data

All six datasets are **stand-ins** derived from the model (the motor maker's 50 %/100 % thrust
points, battery voltage and capacity, stated masses, O4/GNSS supply figures) with the assumptions
listed in each file; the documents watermark them "STAND-IN DATA — NOT MEASURED".

To use real results, replace `test-data/<test-id>.json` with a file of the same id and columns
and `"status": "measured"` plus `provenance.date` and `operator`/`instruments`
(schema and example: `skills/uhd-tech-docs/templates/`), then rebuild. Measured files are never
overwritten; the watermark disappears and values get the M marker.

| Test id | Content |
| --- | --- |
| `throttle-sweep` | thrust and current per motor and in total, 0–100 % throttle |
| `hover-current` | hover current and power vs all-up weight |
| `flight-time` | average current and flight time for hover, cruise, freestyle mix, full throttle |
| `thrust-to-weight` | static thrust and TWR at 4.2 / 3.7 / 3.5 V per cell |
| `esc-temp-punchout` | ESC board temperature over a 4 s full-throttle punch-out |
| `battery-discharge` | pack voltage vs capacity used, at rest, hover and freestyle average |
