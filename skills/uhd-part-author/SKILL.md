---
name: uhd-part-author
description: Write a UHD library part (library/parts/<id>.ts) from researched evidence using the src/protocols builders and defineModule, with a citation header, typed parameters, and explicit assumption traits. Use after uhd-part-research, and in repair mode when uhd-part-verify reports failures.
---

# UHD part author

Turn `library/parts/<id>/.research/` into `library/parts/<id>.ts`, a single
exported `ModuleDef` wrapped in `defineModule` (and `withGeometry`, see
[Geometry](#geometry-cad)), plus the part's CAD script
`library/cad/py/catalog/<id>.py`.

## Before writing

- Read `.research/summary.md` and the `extract-*.json` files.
- Read [vocabulary](references/vocabulary.md) and
  [mapping rules](references/mapping-rules.md).
- Open one or two peer parts in `library/parts/` with a similar category and
  mirror their structure and naming (for example
  `rev-21-1652-neo-vortex-brushless-motor.ts` for motors, `bme280.ts` for I2C
  sensors, `esp32-devkitc-v4.ts` for boards).

## File layout

```ts
/**
 * <Manufacturer> <Product> (<part number / variant>) — datasheet-honest UHD part.
 *
 * Sources (see ./<id>/sources.json):
 *   - src_datasheet: <title> — <url>
 *   - src_product:   <title> — <url>
 *
 * Modelling notes:
 *   - <what each interface represents and why>
 *   - <what was omitted, and why>
 *   - <assumptions and conflicts, each pointing at an `assumption` or
 *     `source_discrepancy` trait>
 */
import type { ModuleDef } from "../../src/types/index.js";
import { defineModule, PowerIn, Ground, UART /* ... */ } from "../../src/protocols/index.js";

const SRC = { datasheet: "<url>", product: "<url>" } as const;

// leaves → composed interfaces → module
export const <CONST_NAME>: ModuleDef = defineModule({ ... });
```

- The export name is the id in SCREAMING_SNAKE_CASE (`MATEK_M10Q_5883`).
- `id` equals the file name. Also set `name`, `version: "1.0.0"`,
  `manufacturer`, `part_number`, `description`, `tags`, and `categories`.
- `artifacts[]` lists the primary sources, each with an `id`, `name`, `type`,
  and `url`. Every artifact URL must also appear in `sources.json`.

## Interfaces

1. **Leaves first:** one leaf per physical pad, pin, lead, terminal, or hole
   pattern, using builders wherever one fits (`Pin`, `PowerIn`, `PowerOut`,
   `Ground`, `EscSignal`, `BoltPattern`, `Shaft`), or the inline signal specs
   of bus builders. Set `pin` to the silkscreen or pad label.
2. **Composed interfaces next:** buses and bundles (`UART`, `I2C`, `CRSF`,
   `BrushlessPhases`, `FcEscPort`) bind the leaves through profiles. Every
   slot must set `match.protocol`; capability-only slots don't pair in DRC.
3. **Group alternatives** with `interfaceGroups` when a pin has several
   functions but can only serve one at a time.
4. Set `domain` on every interface. Each interface id is `snake_case`,
   unique, and stable. Ids are how saved systems refer to interfaces, so don't
   rename them casually.

## Parameters and traits

- Parameters use the canonical builders in `src/protocols/params.ts`
  (`voltage`, `max_current`, `burst_current`, `cell_count`, `capacity`,
  `hole_spacing`, `fastener_diameter`, `shaft_diameter`, `esc_signal_rate`,
  `baud_rate`, `clock_freq`, `i2c_address`). Parameters with the same id are
  range-checked against each other by DRC, so use the canonical id rather
  than a new one.
- Use these canonical traits; don't invent part-specific trait types:

| Trait `type` | Use for |
| --- | --- |
| `pin_functions` | The verbatim pad or pin description from the source, on a leaf. |
| `connector` | Connector or termination (use `connectorTrait`). |
| `operating_conditions` | Temperature, supply limits, and environment at module level. |
| `absolute_maximum` | Absolute maximum ratings. |
| `performance` | Part-type performance: motor KV and thrust, battery C rating, prop geometry, radio power. `params.kind` names the kind. |
| `assumption` | A value no source states but the model needs: `{ field, value, reason }`. |
| `source_discrepancy` | Sources disagree: `{ field, values, sources, resolution }`. |
| `data_gap` | A fact the model would want but no source gives. |
| `usage_note` | Wiring, firmware, or configuration notes from the source. |

- Every trait that states a fact carries `source: SRC.<key>` (or several).

## Domains metadata

Add a `domains[]` entry for each relevant domain, using the fields that exist
(`dimensions_mm`, `weight_g`, `power_domains`) and `metadata` for the rest.
Thermal is present whenever a source gives an operating temperature.

## Geometry (CAD)

Every part binds its physical interfaces to 3D geometry
([docs/geometry-artifacts.md](../../docs/geometry-artifacts.md)). There are
two paths, and both are a per-part script in `library/cad/py/catalog/<id>.py`
with a `build()` function, run with
`.venv-cad/bin/python library/cad/py/build_all.py <id>`:

- **Vendor CAD** (research found a STEP): configure
  `library/cad/py/vendor_step.py`. It converts the STEP to GLB under
  `artifacts/cad/vendor/` (gitignored) and writes the committed manifest
  `artifacts/cad/<id>-vendor.manifest.json`. Select features by the
  vendor's own component names (`label("J1")`) or by geometry
  (`holes(3.2)`, `planar((0, 0, 1))`, `within_box(...)`), because vendor
  names are often generic.
- **Generated** (no usable CAD): model the outline, holes, shaft and
  connector bodies from the drawing dimensions with `library/cad/py/partkit.py`
  (`GeneratedPart`, `board`, `block`, `cylinders`), committed under
  `artifacts/cad/`. Add a `data_gap` trait for field "manufacturer CAD" that
  says where research looked, and an `assumption` trait for any dimension
  the drawing doesn't give.

Pass `axis=` for holes and shafts (vendor `holes(...)` does this itself):
the manifest then records each hole axis, and verify checks the frame
against it.

Then, in the part file, wrap the base definition with `withGeometry`:

| Interface | Geometry |
| --- | --- |
| Mounting holes (`BoltPattern`) | `frame` required: `origin` = pattern centre on the mounting face, `normal` = outward from that face (the direction the mating part comes from), `xAxis` = pattern x (hole 1 for a circle), `symmetryDeg` only if the whole part may rotate (90 for a square pattern, unless a sensor axis or connector makes the orientation matter). Refs: the hole feature, then `procedural("bolt_pattern")`. |
| Shaft (`Shaft`) | `frame` on the shaft axis at the mounting face, `normal` along the shaft outward. Refs: the shaft feature, then `procedural("shaft")`. |
| Connector-borne bus or supply | Refs to the connector body (a `frame` on its mating face if a cable plugs in). Every interface carried by the connector points at the same feature; two identical connectors give two refs. |
| Solder pads, pins, headers | The header or pad-row feature, or no geometry. |
| Electrical-only (a pin function, an internal rail) | Nothing, or `logical: true` when there is deliberately no physical form. |

Frames are in the CAD file's own coordinates (mm, Z up after any vendor
`transform`). Take the numbers from the manifest, not by eye:

For example, `raspberry-pi-5` (vendor CAD). The catalog script selects
features by geometry, because the vendor's component labels are generic:

```python
build_vendor(VendorStep(
    part_id="raspberry-pi-5", step="rpi-5b_no_graphics.step", archive="RaspberryPi5-step.zip",
    name="raspberry-pi-5", url="https://datasheets.raspberrypi.com/rpi5/RaspberryPi5-step.zip", licence=LICENCE,
    features={
        # 4 x Φ2.7 mounting holes on 58 x 49 (the box excludes the Ethernet jack's Φ2.7 pegs)
        "mount": within_box(holes(2.7, tol=0.05), (0, 0, -5), (65, 56, 5)),
        "usb_c": front((0, -1, 0), (5, -3, 0), (17, 3, 6)),  # connector mating face
        ...
    },
    interfaces=["mount", "gpio_header", "usb_c"],
))
```

and the part binds the interfaces to the manifest's features:

```ts
export const RASPBERRY_PI_5: ModuleDef = withGeometry(
  RASPBERRY_PI_5_BASE,
  {
    // board bottom onto standoffs: pattern centre (32.5, 28), normal out of the bottom face
    mount: {
      frame: { origin: [32.5, 28, 0.03], normal: [0, 0, -1], xAxis: [1, 0, 0] },
      refs: [vendorFeature("mount", { area_mm2: 43.294, centroid: [32.5, 28.0, 0.668] }), vendorOwn("mount"), procedural("bolt_pattern")],
    },
    // a cable plugs in here: frame on the mating face
    usb_c_power: {
      frame: { origin: [11.2, -1.2, 3.016], normal: [0, -1, 0], xAxis: [1, 0, 0] },
      refs: [vendorFeature("usb_c", { area_mm2: 6.344, centroid: [11.2, -1.2, 3.016], normal: [0.0, -1.0, 0.0] }), vendorOwn("usb_c")],
    },
    i2c1: { refs: [HDR] },     // electrical interface on the 40-pin header feature
    wifi: { logical: true },   // no physical form
  },
  vendorCadArtifacts({
    partId: "raspberry-pi-5", name: "raspberry-pi-5", url: SRC.cad, stepFile: "rpi-5b_no_graphics.step",
    sha256: "6841637b…", licence: "MIT (LICENSE.txt in the archive); not committed: 77.6 MB",
    interfaces: ["mount", "gpio_header", "usb_c"],
  }),
);
```

No `symmetryDeg` on the Pi mount: the rectangle repeats every 180°, but the
connectors don't. Generated examples: `ti-drv8871` (a package from the
drawing), `emax-rs2205-2300kv` (a motor with shaft and base holes).

For generated geometry use `cadArtifacts({ dir, name, generator:
"library/cad/py/catalog/<id>.py", tool: "build123d" })` and `feature(...)`
instead of the vendor helpers. Copy signatures from the
manifest with `python library/cad/rebind.py library/parts/<id>.ts <manifest>`
rather than by hand. Commit a vendor STEP (as `committedStep`) only when its
licence clearly permits redistribution and it is under 5 MB (larger files
stay in `.research/cad/`).

## Hard rules

1. No value without a source unless it's in an `assumption` trait.
2. No new protocol type or role without an entry in `.research/gaps.json`
   (`type: "vocabulary"`) explaining why no existing one fits. Prefer
   `custom` plus a trait over inventing vocabulary.
3. Don't edit `src/`, `library/parts/index.ts`, shared CAD code, or other parts. Vocabulary
   changes are escalated to the integrator.
4. In repair mode, change only what verify flagged and keep everything else.
5. No part without geometry: every bolt pattern and shaft has a frame and a
   ref, and `checkGeometryBindings` reports no errors.

## Handoff

Run the automated verify (see `uhd-part-verify`) until it passes, then hand
off for the evidence audit.
