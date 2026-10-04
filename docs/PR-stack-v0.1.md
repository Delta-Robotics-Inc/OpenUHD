<!--
Draft of the pull request description for merging this branch into main.
Paste everything below the line into the PR, then delete this file before
merging (package.json keeps docs/PR-*.md out of the npm package).
Taxonomy 1.2.0 is on a separate branch and is not in this branch yet; if it
merges first, add it under "Category taxonomy" (1.0.0, 1.1.0, 1.2.0).
-->

---

# UHD 0.2.x: taxonomy, library protocol, boards and nets, and system rules

This branch brings `main` from 0.1.0 to 0.2.0 and beyond. It adds a category
taxonomy, an open protocol for serving part libraries, vocabulary for more
kinds of hardware, boards and nets, series passives, intentionally
unconnected interfaces, and system-level design rules. It also removes the
part library from this repository, so the repository holds the description
language, its pure helpers and its tests.

The package stays dependency-free at runtime. Every change is listed in
`CHANGELOG.md` under "Unreleased" and "0.2.0".

## What is added

### Category taxonomy (`docs/taxonomy.md`)

- A versioned tree of hardware categories, `src/taxonomy/uhd-taxonomy.json`
  (1.1.0, 103 nodes under 11 roots), with its JSON Schema.
  `ModuleDef.categories` holds taxonomy paths at any depth; `tags` stay
  free-form.
- 1.0.0 is the first version. 1.1.0 keeps the source taxonomy's 77 nodes
  byte for byte (checked against a vendored copy in a test fixture), rewords
  the 26 UHD additions in the same style, and publishes `aliases` for paths
  that older parts used outside the tree.
- Helpers: `UHD_TAXONOMY`, `buildTaxonomy`, `categoryAncestors`,
  `categoryMatches`, `countCategories`, `categoryParent`, `isCategoryPath`,
  `validateCategories` (with suggestions and aliases), `resolveCategoryAlias`,
  `migrateCategories`, `taxonomyTree`, `validateTaxonomyDocument`,
  `compareTaxonomyVersions`. Exported as `@deltarobotics/uhd/taxonomy`, with
  the JSON files as package exports.
- Library extensions (`taxonomy-extension.schema.json`): a library declares
  the taxonomy version its parts use and may add nodes under its own
  `x-<library>` root.
- System rule `unknown_category`.

### Library protocol `uhd-library/v1` (`docs/library-protocol.md`)

- An open HTTP protocol for serving libraries of parts: discovery
  (`/.well-known/uhd-library`), search with taxonomy, domain, protocol and
  tag filters, facets and cursor pagination, part detail and revision lists,
  exact immutable revisions, dependency closures, content-addressed files,
  error codes, caching and optional bearer auth. Publishing is out of scope.
- The revision envelope `uhd.part-revision/v1`: canonical JSON, definition
  and envelope digests, dependencies, files, evidence and lineage.
- File terms (draft 2, § 4.5): each file of a revision may state its
  distribution class (`redistributable`, `internal`, `unknown`), licence,
  attribution and source. A revision is redistributable when every file
  backing its definition is.
- `@deltarobotics/uhd/library`: the types, the JSON Schema
  (`schemas/uhd-library-v1.schema.json`), a dependency-free schema checker,
  envelope and closure checks, and the conformance kit
  `runConformance(url, { fetch?, token? })` that any library can run against
  itself.

### Vocabulary

- Drone and propulsion: `BrushlessPhases`, `EscSignal`, `FcEscPort`, `CRSF`,
  `SBUS`, `BoltPattern`, `Shaft`, and their parameters.
- Motion: `StepperPhases`, `StepDir`, `BrushedMotorTerminals`,
  `QuadratureEncoder`, `ServoPort`, `LinearMotion`.
- Buses and headers: `CAN` and `CANLogic`, `ShieldHeader` (Arduino UNO R3,
  Arduino ICSP and Raspberry Pi 40-pin layouts as connector composites),
  I2C addresses other than a device's own (`otherAddresses`).
- Mechanical: bolt-pattern rows, slots and crosses, shaft profiles and
  genders, keys and splines, with pair checks (`bolt_pattern_line`,
  `bolt_pattern_shape`, `shaft_fit`, `linear_motion_capacity`,
  `supply_current_rating`) (`docs/mechanical-interfaces.md`).
- Fluid power: `FluidPort` for pneumatic and hydraulic ports, with
  `fluid_joint_mismatch` (`docs/fluid-ports.md`).
- Connectors and physical harnesses (`docs/connectors-and-harnesses.md`):
  connector composites, link-scoped composition, harness conductors, derived
  links through cables, routed harness geometry, connectors that ship loose.
- Geometry bindings (`docs/geometry-artifacts.md`): named features and
  frames on CAD artifacts, assembly placement, mass from geometry, fastener
  torques, tools, spin direction.
- `skills/uhd-authoring`: a reference for writing UHD definitions by hand,
  with the vocabulary and the evidence-to-UHD mapping rules.

### Boards and nets (`docs/boards-and-nets.md`)

- A custom PCB is a module: its components are children, its nets are `Net`
  interfaces joined by one membership link per pin (`netLinks`), and its
  edge is its exports.
- `deriveLinks` walks nets like harness conductors and lifts pad pairs to the
  interfaces that pair by protocol; over a rail only power pins pair.
- Package facts: `PackageSpec`, `partPackage`, `pinTable` and
  `pinDesignatorIssues`. Nothing tool-specific (footprints, land patterns,
  symbols) is part of UHD.
- Board rules: `net` (members, shorts, several supplies, design voltages,
  drive levels, a part's own pins: shorted passives, an output tied to its
  own input, straps on signals), `bus_pullup`, `design_envelope`.

### Passive series (`docs/boards-and-nets.md`, "Series passives")

- `Passive()`, `PassiveTrait` and the series fields: a part declares its
  series (values, tolerances, part-number rule, overridable parameters) and
  each placement states its value in `ChildModuleRef.overrides`.
- `passiveInstance`, `passiveOf`, `overridableKeys`, `rkmCode`, `rkmValue`,
  `eia3Code`; system rule `passive_override`.

### Unconnected marks

- `ChildModuleRef.unconnected` lists interfaces an instance leaves open on
  purpose, each with a reason, like a no-connect flag on a schematic.
  `unpowered` reports a marked input as info; the system rule `unconnected`
  warns when a marked interface is linked or a mark names no interface.

### Rules

- System checks over a whole module (`checkSystem`): supply budgets, bus
  addresses, interface reuse, unpowered inputs, link states, harness
  connectors, the board rules above, `unknown_category`, `passive_override`
  and `unconnected`.
- Pair checks over joints (`checkPairJoints`) for the mechanical, fluid and
  current-rating vocabulary.
- Module kinds (`module`, `group`, `harness`), exports, stored links and
  per-link validation (`validateLink`, `validateLinks`).

## What is removed

- The part library (`library/`) and `scripts/build-library.ts`; the package
  no longer ships `library/`, and `prepack` only builds. Parts come from
  libraries served over the library protocol; `npm run build:library` only
  says so.
- `docs/showcase-plan.md`, the planning document for that library.
- The tests use synthetic parts where they need chips: `test/fixtures/parts/`
  holds an invented microcontroller, IMU and buck-boost regulator that
  exercise the board rules.

## Compatibility

- `ChildModuleRef.exposedInterfaces` is deprecated (it was never read); use
  `ModuleDef.exports`.
- New package exports: `@deltarobotics/uhd/taxonomy` (with the taxonomy JSON
  files), `@deltarobotics/uhd/library` and
  `schemas/uhd-library-v1.schema.json`. The package also ships `schemas/` and
  `skills/`.
- `package.json` names no registry.

## Testing

- `npm test`: 29 test files, 375 tests.
- `npm run type-check`.
