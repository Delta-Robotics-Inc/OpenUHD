---
name: uhd-part-author
description: Write a UHD library part (library/parts/<id>.ts) from researched evidence using the src/protocols builders and defineModule, with a citation header, typed parameters, and explicit assumption traits. Use after uhd-part-research, and in repair mode when uhd-part-verify reports failures.
---

# UHD part author

Turn `library/parts/<id>/.research/` into `library/parts/<id>.ts`, a single
exported `ModuleDef` wrapped in `defineModule`.

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

## Hard rules

1. No value without a source unless it's in an `assumption` trait.
2. No new protocol type or role without an entry in `.research/gaps.json`
   (`type: "vocabulary"`) explaining why no existing one fits. Prefer
   `custom` plus a trait over inventing vocabulary.
3. Don't edit `src/`, `library/parts/index.ts`, or other parts. Vocabulary
   changes are escalated to the integrator.
4. In repair mode, change only what verify flagged and keep everything else.

## Handoff

Run the automated verify (see `uhd-part-verify`) until it passes, then hand
off for the evidence audit.
