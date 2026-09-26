---
name: uhd-part-research
description: Gather and record the evidence needed to author a UHD library part — identity, pinout, electrical/mechanical/thermal facts — with every source logged in sources.json. Use after a brief names a purchased part and before authoring its ModuleDef.
---

# UHD part research

Produce a complete, cited evidence set for one part. Downloads and working
notes go in `library/parts/<id>/.research/` (gitignored); the committed record
is `library/parts/<id>/sources.json`.

## 1. Lock identity

- Resolve the **exact** product: manufacturer, product name, part number or
  SKU, hardware revision, and variant (KV rating, cell count, capacity,
  version). Record it in `.research/identity.md`.
- Choose the part id: kebab-case `<manufacturer>-<product>-<variant>`, e.g.
  `matek-m10q-5883`, `cnhl-black-6s-1100mah-100c`. It must not collide with
  an existing file in `library/parts/`.
- If the brief's product can't be confirmed from manufacturer documentation
  (it's discontinued, only exists as an unbranded listing, or the name is
  ambiguous), stop and report the problem together with the closest
  documented alternative. Don't author a part whose identity is guesswork.

## 2. Collect sources (pass 1)

Look for these source types in order of authority:

1. The manufacturer's datasheet, manual, or spec sheet (PDF or page).
2. The manufacturer's product page (specs table, pinout image, dimensions
   drawing).
3. The manufacturer's wiring guides, firmware target files (for example
   Betaflight/INAV target definitions for a flight controller's pins and
   UARTs), and dimension drawings.
4. Distributor pages (GetFPV, RaceDayQuads, DigiKey, Mouser), used only to
   corroborate or fill gaps, and cited as such.

For each source:

- fetch it and save the bytes, or the extracted text for web pages, under
  `.research/downloads/`;
- append a row to `library/parts/<id>/sources.json`:

```json
{
  "id": "src_datasheet",
  "title": "Matek M10Q-5883 manual",
  "url": "https://www.mateksys.com/?portfolio=m10q-5883",
  "type": "datasheet",
  "authority": "manufacturer",
  "fetched_at": "2026-09-26T18:00:00Z",
  "sha256": "<of downloaded bytes, or null for text-only captures>",
  "supports": ["pinout", "supply voltage", "dimensions", "I2C compass address"]
}
```

`type` uses UHD `ArtifactType` values: `datasheet | schematic | pcb | 3d_model
| firmware | simulation | documentation | cad | custom` (CAD downloads are
`cad`, with a `licence` field; see step 2b). `authority` is one of
`manufacturer`, `distributor`, `community`.

Standard parts (ISO/DIN fasteners and similar) are defined by the standard,
not a manufacturer. Set `manufacturer` to `Generic (<standard>)`, tag the part
`standard-part`, keep the supplier's SKU as `part_number`, and mark the
supplier's drawing `authority: "distributor"`.

The datasheet or manual blocks the pipeline. If no manufacturer technical
source exists, escalate instead of authoring from distributor listings
alone.

## 2b. Find CAD

Every part gets 3D geometry (the author binds its interfaces to it), so
look for manufacturer CAD while collecting sources. In order:

1. The manufacturer's product or downloads page (a "STEP", "3D model" or
   "CAD" link; REV, CTRE, Raspberry Pi, Arduino and Pololu publish one per
   product).
2. The manufacturer's GitHub (Adafruit `Adafruit_CAD_Parts`, SparkFun
   product repos, Pololu): the licence file in the repo is the licence.
3. The distributor "3D model" link (Digi-Key, Mouser), SnapEDA or Ultra
   Librarian, for ICs and connectors. These are usually package models
   (the IC body), which is fine for a chip-level part.
4. Third-party models (GrabCAD, Printables) only with a clear licence
   stated on the page. Otherwise skip them.

Save the download under `.research/cad/` (gitignored) and add a row to
`sources.json` with `type: "cad"`, the sha256 of the downloaded bytes (the
archive if it was zipped), and a `licence` field quoting the terms:

```json
{
  "id": "src_cad",
  "title": "<Manufacturer> <product> STEP model",
  "url": "<the download link, not the page it is on>",
  "type": "cad",
  "authority": "manufacturer",
  "fetched_at": "2026-09-26T18:00:00Z",
  "sha256": "<of the downloaded bytes>",
  "licence": "No licence stated on the download page; not redistributed.",
  "supports": ["overall dimensions", "mounting hole positions", "named components"]
}
```

Write `licence` exactly as the source states it, or "not stated". Only a
licence that clearly permits redistribution (MIT, CC-BY, CC-BY-SA, CERN-OHL)
lets the author commit the file; say so in the row.

Treat the CAD as evidence: measure the hole pattern, overall size and
connector positions (`.venv-cad/bin/python library/cad/py/vendor_step.py
<id> <file.step>` prints the component tree, bounding box and cylinder
diameters) and record agreements and conflicts with the drawing in the
mechanical extract, like any other source.

If no CAD with usable terms exists, write down where you looked in
`.research/gaps.json` (`type: "data"`, field "manufacturer CAD"). The author
then generates representative geometry from the drawing dimensions.

## 3. Extract by domain (pass 2)

Consider every domain and write `.research/extract-<domain>.json` for each:
`electrical`, `mechanical`, `thermal`, `network`, `pneumatic`, `hydraulic`.
A domain with nothing in the sources gets `{ "domain", "relevant": false,
"reason" }`.

For a relevant domain:

```json
{
  "domain": "electrical",
  "relevant": true,
  "facts": [
    { "field": "supply voltage", "value": "4.5-5.5 V", "source": "src_datasheet", "where": "Specifications table" }
  ]
}
```

What to extract:

| Domain | Extract |
| --- | --- |
| Electrical | Pin or pad table **first** (label, function, voltage level); supply rails, with input range and current; outputs (BEC voltage and current); signal protocols (UART numbers, I2C address, DShot support, bidirectional DShot); connectors and their pin order; current and voltage ratings (continuous vs burst, and burst duration). |
| Mechanical | Mounting pattern (spacing, hole count, fastener size, threaded vs through, grommets); dimensions; mass; shaft or bore diameter and thread; connector and lead types; lead length. |
| Thermal | Operating and storage temperature; derating and cooling requirements. |
| Network / RF | Radio band, protocol, antenna connector, output power. |
| Performance | Anything specific to the part type: motor KV, stator size, thrust tables; battery cell count, capacity, and C rating; propeller diameter, pitch, and blades. |

Record conflicts between sources as
`{ "field", "values": [...], "sources": [...], "resolution" }`. Record facts
that are missing everywhere in `.research/gaps.json` as `type: "data"`.

## 4. Summarise

Write `.research/summary.md`: identity, the chosen part id, bullet facts with
source ids, conflicts, gaps, the CAD found (file, licence, coordinate
system, where the mounting holes, shaft and connectors are in it) or where
you looked, and the mating parts this part should connect to (for example
the ESC and frame for a motor). The author skill works from this
file and the extract files, not from raw documents.

## Hard rules

1. Every fact has a source id and a location.
2. Keep variants distinct. A spec for the 1950KV motor isn't evidence for the
   2550KV one.
3. Don't infer: "Typical for this class" is not a source.
4. Drop raw documents from context once the facts are extracted, and work
   from the files.
5. Don't touch other parts' directories or shared code.
