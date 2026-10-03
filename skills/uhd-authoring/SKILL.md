---
name: uhd-authoring
description: Reference for writing a UHD ModuleDef by hand — leaf interfaces with pin designators, pin tables, composed buses and connectors, canonical parameters and traits, domains and package facts, and binding physical interfaces to geometry with frames and refs — using the @deltarobotics/uhd builders and defineModule. Use whenever you author or review a UHD module definition (a purchased part, a custom module, a board), and from any part-authoring workflow built on UHD.
---

# Authoring UHD modules

How to express hardware facts as a UHD `ModuleDef`. This is the schema
reference: it does not say where files live, how evidence is gathered, or
which tool makes the CAD; workflows built on UHD add that. The
[vocabulary](references/vocabulary.md) lists the builders, protocol types and
canonical parameters; the [mapping rules](references/mapping-rules.md) map
common evidence to UHD.

## The file

A definition is a TypeScript module exporting one `ModuleDef`, wrapped in
`defineModule` (which validates ids, profile bindings and groups when the
file is imported) and, when it has geometry, `withGeometry`:

```ts
/**
 * <Manufacturer> <Product> (<part number / variant>).
 *
 * Sources: <id>: <title> — <url>, …
 *
 * Modelling notes: what each interface represents and why; what was
 * omitted, and why; assumptions and conflicts, each pointing at an
 * `assumption` or `source_discrepancy` trait.
 */
import type { ModuleDef } from "@deltarobotics/uhd";
import { defineModule, PowerIn, Ground, UART /* ... */ } from "@deltarobotics/uhd";

const SRC = { datasheet: "<url>", product: "<url>" } as const;

// leaves → composed interfaces → module
export const <CONST_NAME>: ModuleDef = defineModule({ ... });
```

- `id` is stable kebab-case (`<manufacturer>-<product>-<variant>` for a
  purchased part); the export name is the id in SCREAMING_SNAKE_CASE.
- Set `name`, `version` (`"1.0.0"` for a new definition), `manufacturer`,
  `part_number`, `description`, `tags`, `categories`.
- `categories` are paths in the UHD taxonomy (`docs/taxonomy.md`,
  `src/taxonomy/uhd-taxonomy.json`), the most specific that apply, e.g.
  `["sensor.distance", "expansion.breakout"]`; check them with
  `validateCategories`. `tags` are free-form keywords.
- `artifacts[]` references the primary sources (`id`, `name`, `type`, `url`)
  and any files that describe the hardware (format, role, units,
  provenance). An artifact is a reference, not proof that the file agrees
  with the model.

## Interfaces

1. **Leaves first:** one leaf per physical pad, pin, lead, terminal, or hole
   pattern, using builders wherever one fits (`Pin`, `PowerIn`, `PowerOut`,
   `Ground`, `EscSignal`, `BoltPattern`, `Shaft`), or the inline signal specs
   of bus builders. Set `pin` to the silkscreen or pad label. For a chip (any
   component soldered to a PCB), declare the datasheet pin table with
   `pinTable` (ids `pin_<n>`, the datasheet name, a cited `pin_functions`
   trait per row). Every pin and the exposed pad gets a leaf with its
   designator, including NC and reserved pins (type `nc`). A peripheral
   function that is not a pin (a PWM block, a PIO) is marked
   `geometry: { logical: true }`. See
   [boards and nets](../../docs/boards-and-nets.md).
2. **Composed interfaces next:** buses and bundles (`UART`, `I2C`, `CRSF`,
   `BrushlessPhases`, `FcEscPort`) bind the leaves through profiles. Every
   slot sets `match.protocol`; capability-only slots don't pair in DRC.
3. **Connectors:** a physical connector with several positions is a
   connector composite, `Connector({ id, connector, gender, pins: [[label,
   leafId], …] })`, positions in pin-1-first order, each bound to the pad it
   shares. A connector that carries exactly one functional interface is a
   `connectorTrait` on that interface. See
   [connectors and harnesses](../../docs/connectors-and-harnesses.md).
4. **Group alternatives** with `interfaceGroups` when a pin has several
   functions but can serve only one at a time.
5. Set `domain` on every interface. Interface ids are `snake_case`, unique
   and stable: systems refer to them, so don't rename them casually.

## Parameters and traits

- Use the canonical parameter builders (`voltage`, `max_current`,
  `burst_current`, `cell_count`, `capacity`, `hole_spacing`,
  `fastener_diameter`, `shaft_diameter`, `esc_signal_rate`, `baud_rate`,
  `clock_freq`, `i2c_address`, `hole_pitch`, `slot_length`, `stroke`,
  `lead`, `force`, `min_supply_current`; the full list is in the
  vocabulary reference). Parameters with the same id are range-checked
  against each other by DRC, so use the canonical id rather than a new one.
- Use the canonical traits; don't invent module-specific trait types:

| Trait `type` | Use for |
| --- | --- |
| `pin_functions` | The verbatim pad or pin description from the source, on a leaf. |
| `connector` | Connector or termination (`Connector()` for a multi-position connector, `connectorTrait` for a termination or a single-interface connector). |
| `operating_conditions` | Temperature, supply limits, and environment at module level. |
| `absolute_maximum` | Absolute maximum ratings. |
| `performance` | Type-specific performance: motor KV and thrust, battery C rating, prop geometry, radio power. `params.kind` names the kind. |
| `assumption` | A value no source states but the model needs: `{ field, value, reason }`. |
| `source_discrepancy` | Sources disagree: `{ field, values, sources, resolution }`. |
| `data_gap` | A fact the model would want but no source gives. |
| `usage_note` | Wiring, firmware, or configuration notes from the source. |
| `supplied_from` | A power output that branches from another output on the same module (e.g. 4.5 V pads behind the 5 V BEC): `{ interfaceId, via?, source? \| assumption? }` (`SuppliedFromTrait`). Its loads are budgeted on the parent. |
| `handedness` | A part sold in rotation-handed variants (propellers): `{ variants: ["cw", "ccw"], pack?, source }` (`HandednessTrait`). The fitted variant is chosen per instance with `ChildModuleRef.spin`. |
| `passive` | The value of a resistor, capacitor, inductor or ferrite bead: `{ kind, value, unit, tolerance?, source? }` (`PassiveTrait`, written by `Passive()`). |

- Every trait that states a fact carries `source` (a URL, or a URL with a
  section). A value no source states is either omitted or carried in an
  `assumption` trait that says why.

## Domains and package

Add a `domains[]` entry for each relevant domain, using the fields that exist
(`dimensions_mm`, `weight_g`, `power_domains`, `material`, `package`) and
`metadata` for the rest. Thermal is present whenever a source gives an
operating temperature.

A chip states its **package** on the mechanical domain, from the datasheet's
package section, with `dimensions_mm` as the overall size:

```ts
{
  domain: "mechanical",
  dimensions_mm: { length: 3.0, width: 2.5, height: 0.83 },
  package: { name: "LGA-14", pin_count: 14, pitch_mm: 0.5, exposed_pad: false, source: `${SRC.datasheet} (§8.1)` },
}
```

Use the manufacturer's package name and code (`"VSON-14"`, code
`"DSJ (R-PVSON-N14)"`); with an exposed pad set `exposed_pad: true` and
`exposed_pad_pin` to its leaf's designator. `pinDesignatorIssues` reports a
pin without a designator, a repeated designator, or a package pin no leaf
carries.

**Never in UHD:** footprint or land-pattern names, symbol or library
references, layer stacks, routing, CAD feature trees or document ids, or any
field named after a tool. Those belong to the tool that needs them.

## Geometry

Physical interfaces bind to 3D geometry
([geometry artifacts](../../docs/geometry-artifacts.md)): a `frame` (origin,
outward normal, x-axis, optional `symmetryDeg`) where a mating part attaches,
and `refs` into the module's artifacts. `withGeometry(def, geometry,
artifacts)` attaches both and rejects an unknown interface id. Three kinds of
ref, best first:

- `feature(name, signature?, artifact = "cad_step")` — D1: a named sub-shape
  in a body artifact, with the area / centroid / normal signature it had when
  it was bound, so a regenerated body whose faces moved is reported
  (`checkGeometryBindings`) instead of silently accepted;
- `own(interfaceId)` — D2: the interface's own artifact (`cad_if_<id>`);
- `procedural(generator)` — D3: derived from the interface's parameters
  (`"bolt_pattern"`, `"shaft"`); no file.

| Interface | Geometry |
| --- | --- |
| Mounting holes (`BoltPattern`) | `frame` required: `origin` = pattern centre on the mounting face, `normal` = outward from that face (the direction the mating part comes from), `xAxis` = pattern x (hole 1 for a circle), `symmetryDeg` only if the whole part may rotate (90 for a square pattern, unless a sensor axis or connector makes the orientation matter). Refs: the hole feature, then `procedural("bolt_pattern")`. |
| Shaft (`Shaft`) | `frame` on the shaft axis at the mounting face, `normal` along the shaft outward. Refs: the shaft feature, then `procedural("shaft")`. |
| Row or slot (`BoltPattern` shape `row`, `slot`) | `frame` at the middle of the row or slot on the mounting face, `normal` outward, `xAxis` along the row or slot. A slot has no hole axes to check, so ref its face. |
| Linear output (`LinearMotion`) | `frame` on the moving member's end face (retracted), `normal` along the direction of extension. Refs: that face. |
| Connector composite (`Connector`) | Refs to its connector body (a `frame` on its mating face if a cable plugs in). One composite per socket, so two identical sockets give two composites with one ref each. |
| Connector-borne bus or supply | Optionally the same connector-body refs; two identical connectors give two refs. |
| Solder pads, pins, headers | The header or pad-row feature, or no geometry. |
| Electrical-only (a pin function, an internal rail) | Nothing, or `logical: true` when there is deliberately no physical form. |

Frames are in the body file's own coordinates (mm, Z up). Take the numbers
from the body's feature manifest (the signature, and the hole and shaft axes
it records), not by eye. A rectangle pattern repeats every 180°, but a part
whose connectors don't must not declare `symmetryDeg`.

## Rules

1. No value without a source unless it's in an `assumption` trait.
2. Keep variants distinct: a spec for one variant is not evidence for another.
3. Prefer `custom` plus a trait over inventing a protocol type or role; new
   vocabulary is a change to UHD, proposed separately.
4. Every bolt pattern and shaft has a frame and a ref, and
   `checkGeometryBindings` reports no errors.
