# Test data

## Convention

```
<system>/docs/test-data/<test-id>.json      one file per test; id == file name
```

Schema: [`../templates/test-data.schema.json`](../templates/test-data.schema.json).
Example of a measured file: [`../templates/test-data.example.json`](../templates/test-data.example.json).

| Field | Meaning |
| --- | --- |
| `id`, `title` | stable test id (used by documents), human title |
| `status` | `"standin"` (derived from the model, watermarked) or `"measured"` |
| `subject` | `{ system, modules[] }` — what was tested |
| `conditions[]` | `{ name, value, unit }` — supply voltage, ambient, propeller, firmware… (`unit: ""` for text) |
| `provenance` | `method` (always); stand-in: `derivedFrom[]` (value queries), `assumptions[]`, `generator`, `generatedAt`; measured: `date`, `operator` and/or `instruments[]`, `rawFiles[]` |
| `columns[]` | `{ id, label, unit }` |
| `rows[][]` | one value per column |
| `summary[]` | `{ id, label, value, unit }` — headline figures documents quote |

## Stand-in data

`npx tsx scripts/docs/standin.ts <system-dir>` (also run by `build.ts`) writes the recipe named in
`docspec.testData.standins` (e.g. `scripts/docs/lib/standins/multirotor.ts`). A recipe derives
plausible data from model values, lists each input query in `provenance.derivedFrom`, and states
every value the model could not supply in `provenance.assumptions`. Documents draw stand-in data
with the **STAND-IN DATA — NOT MEASURED** watermark, an in-chart badge, a `stand-in` tag on the
chart title and the **S** marker on every value.

Quadcopter stand-ins (from the MEPS motor's 50 %/100 % thrust points, battery V/capacity, masses,
O4/GNSS supply figures): `throttle-sweep`, `hover-current`, `flight-time`, `thrust-to-weight`,
`esc-temp-punchout`, `battery-discharge`.

## Dropping in real results

1. Run the test; keep raw logs (thrust stand CSV, Blackbox, thermocouple log) next to the file or
   in a data store, and list them in `provenance.rawFiles`.
2. Write `<test-id>.json` with the **same id and column ids** as the stand-in it replaces,
   `status: "measured"`, real `conditions`, and `provenance.method`, `date`, `operator` or
   `instruments`. Units must match the columns.
3. Rebuild: `npx tsx scripts/docs/build.ts <system-dir>`. The stand-in generator skips measured
   files; charts lose the watermark, values get the **M** marker.
4. Verify: `npx tsx scripts/docs/verify.ts <system-dir>` fails if a measured chart still carries
   a watermark, or a stand-in chart lacks one, or a file is malformed.

To add a *new* test, give it a new id and add a chart or table for it in the builder (or a
test-report document); a file no document reads is still validated.
