# Category taxonomy

UHD has a standard tree of hardware categories. A module says where it
belongs by listing taxonomy paths in `ModuleDef.categories`; tools use the
tree to browse, filter and count modules the same way whichever library they
come from.

| File | What |
| --- | --- |
| [`src/taxonomy/uhd-taxonomy.json`](../src/taxonomy/uhd-taxonomy.json) | The taxonomy: version, provenance, and the tree |
| [`src/taxonomy/uhd-taxonomy.schema.json`](../src/taxonomy/uhd-taxonomy.schema.json) | JSON schema of a taxonomy file |
| [`src/taxonomy/taxonomy-extension.schema.json`](../src/taxonomy/taxonomy-extension.schema.json) | JSON schema of a library's taxonomy declaration and extension |
| [`src/taxonomy/index.ts`](../src/taxonomy/index.ts) | Types and helpers, exported from `@deltarobotics/uhd` and `@deltarobotics/uhd/taxonomy` |
| `src/taxonomy/uhd-taxonomy.data.ts` | Generated copy of the JSON the code loads (`npm run build:taxonomy` after editing the JSON; the tests fail when they differ) |

The JSON files are also package exports
(`@deltarobotics/uhd/taxonomy/uhd-taxonomy.json` and the two schemas), so a
tool that does not run TypeScript can read them directly.

## Nodes and paths

A node has an `id` (lower case, digits and underscores), a `name`, a
`description`, and optionally `docs_url`, `links`, `agent_notes` (short
guidance for agents, at most 600 characters) and, on kit nodes, a `kit`
block (`sku`, `vendor`). Children are listed by id under `children`.

A node is addressed by its **path**: the ids from the root, joined by dots.

```
actuator                      Actuators
actuator.motor                Motors
actuator.motor.servo          Servo Motors
component.passive.capacitor   Capacitors
kit.freenove_fnk0082          Freenove Ultimate Starter Kit for ESP32-S3 (FNK0082)
```

Version 1.1.0 has 103 nodes under 11 roots: `microcontroller`, `sensor`,
`actuator`, `power`, `connectivity`, `robotics`, `mechanical`, `connector`,
`expansion`, `component`, `kit`.

## Categorising a module

```ts
export const SG90: ModuleDef = defineModule({
  id: "towerpro-sg90",
  name: "Tower Pro SG90",
  categories: ["actuator.motor.servo", "robotics.rc"],
  tags: ["sg90", "micro-servo", "9g", "pwm"],
  // ...
});
```

- `categories` holds taxonomy paths, at any depth. Give a part **every
  category that fits**, not just the one that names what it is. List the
  most specific ones: `actuator.motor.servo` already places the servo under
  `actuator.motor` and `actuator`.
- A path can describe what the part is (`sensor.distance`), the platform it
  belongs to (`robotics.frc`, `robotics.drone`) or a form it comes in
  (`expansion.breakout`, `microcontroller.module`). A time-of-flight
  breakout is `["sensor.distance", "expansion.breakout"]`; an Arduino motor
  shield is `["actuator.motor_controller", "expansion.arduino_shield"]`; an
  FRC smart motor controller is `["actuator.motor_controller", "robotics.frc"]`;
  a flight controller is `["microcontroller.flight_controller", "robotics.drone"]`.
- Some forms are easy to miss. A bare packaged IC that is not a
  microcontroller (a regulator, a charger, a driver, a sensor chip) is also
  `component.ic`, so an LDO is `["power.regulator", "component.ic"]`; a
  microcontroller or SoC chip is `microcontroller.chip` instead. A
  microcontroller board programmed over USB with its pins on headers is also
  `microcontroller.development_board`, next to its brand family.
- A part filed under one category when others plainly fit is incomplete.
  Part-authoring tools should warn about it.
- Kit membership is a category: a part in a kit lists the kit's path.
- `tags` stay free-form keywords (vendor, chip, package code, use case). They
  are not validated and are not a second taxonomy.
- `Passive()` sets `component.passive.<kind>` (resistor, capacitor, inductor,
  ferrite_bead).

### Validation

`validateCategories(categories, taxonomy?)` returns each path that is
malformed (`syntax`) or not in the taxonomy (`unknown`), with suggestions
when the path is a legacy alias (see below), exists under another parent
(`passive.capacitor` → `component.passive.capacitor`) or its last id is a
known node (`motor` → `actuator.motor`).

### Legacy aliases

The taxonomy file publishes `aliases`: category paths that parts have used
but that are not nodes, each mapped to the node paths that hold the same
parts. Version 1.1.0 maps the paths that ProtoPart 2.1.0 parts used outside
the ProtoPart taxonomy:

| Legacy path | Node paths |
| --- | --- |
| `actuator.compressor` | `mechanical.pneumatic` |
| `actuator.pneumatic_controller` | `mechanical.pneumatic` |
| `computer.single_board` | `microcontroller.single_board_computer` |
| `discrete.transistor.mosfet` | `component.discrete.transistor` |
| `networking` | `connectivity.networking` |
| `networking.wireless` | `connectivity.wireless` |
| `sensor.imu` | `sensor.motion` |
| `sensor.light` | `sensor.color` |

ProtoPart parts also used `power.distribution`, which has been a UHD node
since 1.0.0 and so needs no alias.

For an alias, `validateCategories` reports an `unknown` issue with
`alias: true` and the targets as `suggestions`. `resolveCategoryAlias(path)`
returns an alias's targets, and `migrateCategories(paths)` rewrites a part's
categories with every alias replaced by its targets. An alias never names a
node, and every target must be a node; `validateTaxonomyDocument` checks
both.

`checkSystem` runs this on the root and every child definition as the
`unknown_category` rule: one **warning** per definition and unknown path,
naming the instances that use it. Pass `{ taxonomy }` to check against a
taxonomy built with a library's extension; by default it is UHD's alone.
Part-authoring tools should call `validateCategories` on each part they
verify.

## Subtree filtering and counts

Filtering by a category means "this node or anything under it". Prefix
matching on whole ids does this (`categoryMatches(categories, path)`), but an
index can do it with exact matches if each module also stores the
**ancestors** of its paths:

```ts
categoryAncestors(["actuator.motor.servo", "robotics.rc"]);
// ["actuator", "actuator.motor", "actuator.motor.servo", "robotics", "robotics.rc"]
```

Store that list next to the module (sorted, each path once); selecting
`actuator` is then an exact match on one of its elements. `countCategories`
counts modules per path the same way (a module counts once per path), and
`taxonomyTree(taxonomy, counts)` gives the tree as plain JSON with a `count`
on every node, for an API or a drill-down filter.

## Helpers

| Helper | Does |
| --- | --- |
| `UHD_TAXONOMY`, `UHD_TAXONOMY_DOCUMENT` | The built taxonomy and the file's data |
| `buildTaxonomy(doc, extensions?)` | Builds and validates a taxonomy with library extensions; throws `TaxonomyError` |
| `taxonomy.node(path)`, `.has(path)` | Lookup by path |
| `taxonomy.children(path?)` | Direct children; the roots for no path |
| `taxonomy.breadcrumbs(path)` | Nodes from the root down to the path (unknown segments skipped) |
| `taxonomy.nodes()` | Every node, depth first |
| `categoryAncestors(paths)` | Paths and all their ancestors, sorted, once each |
| `categoryMatches(categories, path)` | Is a module at or under the path |
| `countCategories(items, paths?)` | Items per path |
| `categoryParent(path)`, `isCategoryPath(path)` | Path arithmetic and syntax |
| `validateCategories(paths, taxonomy?)` | Unknown and malformed paths, with suggestions |
| `resolveCategoryAlias(path, taxonomy?)`, `migrateCategories(paths, taxonomy?)` | Legacy aliases and their node paths |
| `validateTaxonomyDocument(doc)`, `validateTaxonomyExtension(ext, base?)` | Problems with a file |
| `compareTaxonomyVersions(declared, available)` | `same`, `compatible`, `newer` or `incompatible` |
| `taxonomyTree(taxonomy, counts?)` | JSON tree for display |

## Libraries: declaring the version and adding nodes

A part library declares which taxonomy version its parts are categorised
against, and may add nodes of its own, in one **taxonomy extension** file
(schema `taxonomy-extension.schema.json`). Where the library keeps it is up
to the library; `taxonomy.json` at the library root is the suggested name.

```json
{
  "$schema": "https://raw.githubusercontent.com/Delta-Robotics-Inc/uhd/main/src/taxonomy/taxonomy-extension.schema.json",
  "library": "acme",
  "taxonomy": { "id": "uhd", "version": "1.0.0" },
  "categories": {
    "x-acme": {
      "name": "Acme lab",
      "children": {
        "fixtures": { "name": "Test fixtures", "description": "Bed-of-nails and pogo fixtures" },
        "starter": { "name": "Acme starter kit", "kit": { "sku": "ACME-1", "vendor": "acme", "manifest": "kits/acme-1.json" } }
      }
    }
  }
}
```

Rules:

- **Namespace.** A library's nodes live under one root, `x-<library>`, where
  `<library>` is the declaration's `library` (lower-case kebab). Its paths are
  `x-acme.fixtures`, `x-acme.starter`. A library cannot add nodes under a
  standard root or under another library's; the `x-` prefix keeps library
  paths from ever colliding with a future standard node.
- **Version.** `taxonomy.version` is the version the library was categorised
  against. Within a major version paths are only added, never renamed or
  removed, so a library on 1.0.0 is valid against any 1.x. A declaration of
  another major version is refused by `buildTaxonomy`; one newer than the
  available taxonomy builds, and any path it uses that is missing shows up as
  an unknown category.
- **Kits.** A library that holds a kit's contents list puts the kit under its
  own root and may state `manifest` (library-relative path or URL) and
  `controller_part_id` on the kit block. The standard `kit.*` nodes carry
  only `sku` and `vendor`.
- **Promotion.** A library node that would serve hardware in general is a
  candidate for the standard tree: propose it as a UHD change, and once it is
  released, move the library's parts to the standard path.

```ts
import { buildTaxonomy, UHD_TAXONOMY_DOCUMENT, validateCategories } from "@deltarobotics/uhd";
const taxonomy = buildTaxonomy(UHD_TAXONOMY_DOCUMENT, [acmeExtension]);
validateCategories(part.categories, taxonomy);       // x-acme.* paths are now known
checkSystem(system, lookup, { taxonomy });
```

## Versioning

The taxonomy's version is its own, separate from the package version.

- **Patch:** names, descriptions, links and notes.
- **Minor:** new nodes or aliases.
- **Major:** a path renamed, moved or removed. The change is listed in the
  file's `provenance` so tools can migrate categories.

## Provenance

The taxonomy is derived from the ProtoPart category taxonomy 2.1.0 (Delta
Robotics, 77 nodes, 11 roots). The file's `provenance` records how:

- **The source's nodes are kept exactly.** Each of the 77 nodes has the same
  id, the same position among its siblings, and the same name, description,
  `docs_url`, `links` and `agent_notes`, byte for byte. A part categorised
  against ProtoPart 2.1.0 is valid against UHD unchanged.
  `test/taxonomy.test.ts` compares the nodes with an unchanged copy of the
  ProtoPart file in `test/fixtures/protopart/`. Only the taxonomy is copied
  there, not any ProtoPart parts.
- **26 nodes are added** for hardware the source did not cover, after the
  source's own children of each parent: MCU chips and modules,
  single-board computers, flight controllers, GNSS, magnetic and force
  sensors, haptics, solenoids, power monitors and distribution, wireless
  video, drones, seals, enclosures, motion components, hydraulics, screws,
  nuts, inserts, USB and RF connectors, ferrite beads, crystals, circuit
  protection and relays. Their names and descriptions follow the source's
  style: short lists of the parts in the category, with examples in
  parentheses.
- **Kit fields.** The kit node `kit.freenove_fnk0082` keeps the source's
  `sku` and `vendor`. The source's kit block also names a
  `controller_part_id` and a `manifest`; both point into ProtoPart's own
  parts library and contribution folder, which are not part of UHD, so they
  are not carried. A library that holds a kit's manifest states it in its own
  extension. The kit agent notes are the source's text; where they mention a
  library search parameter or the manifest, read them as "filter by the
  kit's category path" and "the kit's contents list from the library that
  publishes it".
- **Aliases** map the paths ProtoPart parts used outside the ProtoPart
  taxonomy, as listed above.

### History

- **1.1.0** restores the source's text for the 77 ProtoPart nodes (1.0.0
  had reworded 45 names, descriptions and agent notes on 41 of them),
  rewrites the 26 added
  nodes in the source's style, and adds the legacy aliases. No path was
  added, renamed or removed.
- **1.0.0** was the first version: the 77 ProtoPart paths and 26 additions.
