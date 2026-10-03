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

Version 1.0.0 has 103 nodes under 11 roots: `microcontroller`, `sensor`,
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

- `categories` holds taxonomy paths, at any depth, as many as apply. List the
  most specific ones: `actuator.motor.servo` already places the servo under
  `actuator.motor` and `actuator`.
- A path can describe what the part is (`sensor.distance`), the platform it
  belongs to (`robotics.frc`, `robotics.drone`) or a form it comes in
  (`expansion.breakout`, `microcontroller.module`). A time-of-flight
  breakout is `["sensor.distance", "expansion.breakout"]`.
- Kit membership is a category: a part in a kit lists the kit's path.
- `tags` stay free-form keywords (vendor, chip, package code, use case). They
  are not validated and are not a second taxonomy.
- `Passive()` sets `component.passive.<kind>` (resistor, capacitor, inductor,
  ferrite_bead).

### Validation

`validateCategories(categories, taxonomy?)` returns each path that is
malformed (`syntax`) or not in the taxonomy (`unknown`), with suggestions
when the path exists under another parent (`passive.capacitor` →
`component.passive.capacitor`) or its last id is a known node (`motor` →
`actuator.motor`).

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
- **Minor:** new nodes.
- **Major:** a path renamed, moved or removed. The change is listed in the
  file's `provenance` so tools can migrate categories.

## Provenance

Version 1.0.0 is derived from the ProtoPart category taxonomy 2.1.0 (Delta
Robotics, 77 nodes, 11 roots), recorded in the file's `provenance`:

- Every 2.1.0 path is kept with the same id, so a part categorised against
  2.1.0 is valid against UHD 1.0.0 unchanged.
- Names and descriptions were reviewed for hardware in general rather than
  one catalogue: `microcontroller` covers chips, modules, flight controllers
  and single-board computers; `robotics` covers platforms including drones;
  `component.display` covers OLED and TFT modules;
  `actuator.motor_controller` names ESCs.
- 26 nodes were added for hardware the source did not cover (listed in the
  file and checked by `test/taxonomy.test.ts`): MCU chips and modules,
  single-board computers, flight controllers, GNSS, magnetic and force
  sensors, haptics, solenoids, power monitors and distribution, wireless
  video, drones, seals, enclosures, motion components, hydraulics, screws,
  nuts, inserts, USB and RF connectors, ferrite beads, crystals, circuit
  protection and relays.
- The kit node keeps its SKU and vendor; the source's `controller_part_id`
  and `manifest` pointed into ProtoPart's own library and are not carried.
- Agent notes that named one application's tools were reworded to be
  tool-neutral.
