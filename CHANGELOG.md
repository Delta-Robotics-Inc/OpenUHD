# Changelog

All notable changes to **Universal Hardware Description (UHD)** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Boards and nets (PB-824, `docs/boards-and-nets.md`): a custom PCB is a module whose children are its components, whose nets are `Net` interfaces on the board (protocol `net`, not exposed, optional design `voltage`), and whose edge is its exports. `netLinks` writes one membership link per pin (`<net>.<child>.<interface>`); `validateLink` checks them (`net_to_net`, `net_member_composite`, `net_not_own`). `deriveLinks` walks nets like harness conductors and keeps only pad pairs whose lifted interfaces pair by protocol, so supply budgets, bus addresses, interface reuse and unpowered inputs work over boards. `LinkResult.derived` gains `nets`. New system rules `net` (fewer than two pins, a pin on two nets, several supplies on one net, ground joined to a supply, a pin outside the net's design voltage), `bus_pullup` (I2C over nets with no pull-up to a supply) and `design_envelope`.
- Package facts (PB-824): `PackageSpec` on the mechanical domain (`package`: manufacturer name and code, pin count, pitch, exposed pad and its designator); `partPackage` reads it with the overall size. `pinTable` declares a chip's pin table (every pin with its designator and a cited `pin_functions` trait); `pinDesignatorIssues` reports missing, repeated and uncovered designators, and `scripts/verify-part.ts` runs it as `[pins]` warnings. Nothing tool-specific (footprints, land patterns, symbols) is part of UHD.
- `Passive()` (two `passive` terminals and a `passive` trait), `PassiveTrait`, and `DesignEnvelopeTrait` (largest outline and keep-outs a custom module must meet).
- Package facts on BMI270, ICM-42688-P, LSM6DS3TR-C, TPS63020, DRV8871, L293DNE and RP2040 (minor version bumps), cited to the datasheets already in their evidence.
- Example board fixture (`test/fixtures/imu-board.ts`: RP2040 + BMI270 + TPS63020) with seeded faults.
- Routed harness geometry (`docs/connectors-and-harnesses.md`, "Routed harness geometry"): harness end interfaces may carry frames in the harness's own coordinates; `assemble` places such a harness from the part its first end lands on (`Assembly.harnesses`, `HarnessPlacement`) and checks every other end against its counterpart (stale route → warning). `linkEndFrames` (world frames of a link end, per composed position) and `combineFrames` are exported.
- Pad and socket geometry for harness routing: FC edge pads and underside sockets, ESC phase pads (per leaf), battery pads and FC socket, O4 cable socket, CNHL discharge lead and XT60, RP1 V2 CAD (new) with its four pads; the motor's leads now end at their 10 mm heat-shrink sleeve.
- Connectors and physical harnesses (PB-805, `docs/connectors-and-harnesses.md`): `Connector()` connector composites (protocol `connector`, positions `p1…pN` bound to pads); link-scoped composition on a link end (`compose`) for pads with no grouping interface; harness conductors as internal `self` links; `deriveLinks`/`systemLinks` trace conductors to functional links, and `checkSystem` runs on stored + derived links. New link diagnostics `connector_mismatch`, `connector_gender`, `connector_positions`, `compose_unknown_slot`, `harness_wiring`. `ResolvedEndpoint` gains `ownerPath` and `composed`; `LinkResult` gains `derived`; `resolveBelow`, `validateResolved` are exported.
- Drone protocol vocabulary: `BrushlessPhases`, `EscSignal`, `FcEscPort`, `CRSF`, `SBUS`, `BoltPattern`, `Shaft`, `connectorTrait`, and parameters for cell count, capacity, hole spacing, fastener and shaft diameter, burst current, and ESC signal rate.
- Module kinds (`module`, `group`, `harness`), `exports` (child interfaces on a parent boundary; groups export implicitly), stored `links` (`InterfaceLink` with explicit `EndpointTarget`s and optional stored `childLinks`), and `display` hints on `ModuleDef`. Harness endpoints gain topology roles; harnesses gain parameters, artifacts, and traits.
- `src/system`: canonical paths, `primaryInterfaces`, `resolveExports`, `boundaryInterfaces`, `resolveEndpoint`, and `validateLink`/`validateLinks` (per-link DRC on sliced modules, with stored child links overriding derived ones).
- Part pipeline skills (`skills/`) and `scripts/verify-part.ts`.
- Eight quadcopter parts and the `library/systems/quadcopter-5in` reference system.

### Changed

- Derived links (PB-824): a pad pair lifts to the largest pair of interfaces that pair by protocol, composite with composite or pad with pad; with no such pair a cable still links the largest candidates as before. The quadcopter's links are unchanged.
- `supply_budget` totals the pins of one power-output port together (a regulator's doubled VOUT pins), counts each load once, groups supplies by instance path rather than definition id (two identical regulators no longer share a budget), and uses a board net's design voltage when the net states one.
- `unpowered` counts the pads a link to a composite carries as supplied (the FC's VBAT input fed through the FC/ESC socket is no longer reported), and does not report inputs supplied through the checked module's edge (an exported input, or any pin on a net with one).
- `defineModule` rejects an export whose id repeats an interface id or another export (it would be shadowed).
- The BMI270, LSM6DS3TR-C and TPS63020 mounting interfaces are named after their pads, not a land pattern.

- Part-authoring rule: every multi-position connector is a connector composite. The FC, ESC, O4, M9N and CNHL parts declare their sockets (`esc_socket`, `rc_socket`, `gps_socket`, `vtx_socket`, `dji_socket`, `cam_socket`, `fc_socket`, `fc_cable_socket`, `gh6p_1`/`gh6p_2`, `xt60`); socket traits moved off pads and `FcEscPort` no longer carries a pinout. `harness_connector` also finds connector composites that bind a link end's pads. `verify-part.ts` checks connectors and warns on sockets left on pads.
- DRC treats `burst_current` and `drive_current` as capacity parameters (no pairwise range overlap).

### Deprecated

- `ChildModuleRef.exposedInterfaces` (never read); use `ModuleDef.exports`.

## [0.2.0] — 2026-09-26

Pinned baseline for the ProtoBoard Stack quadcopter reference project (PB-778).

### Added

- Standardized protocol interface builders in `src/protocols` (`Pin`, `GPIO`, `PowerIn`/`PowerOut`/`Ground`, `I2C`, `SPI`, `UART`, `PWM`, `ADC`/`DAC`) with inline signal specs, pin numbers, and multi-instance support.
- `defineModule` validating constructor (unique interface ids, profile bindings, interface-group members).
- Audited parts library in `library/parts` and the manifest build (`npm run build:library`, run on `prepack`).
- DRC phases 0–2: export surface, result model, and `validatePair` at the protocol tier.
- Validator/parts-library plan, visualizer spec, DRC plan, and pair-visualizer designs under `docs/` and `design/`.

## [0.1.0] — 2026-05-02

### Added

- Initial public release of UHD as an open-source project under Apache License 2.0.
- Three-primitive data model: **Module**, **Interface**, **Harness**.
- Protocol matching engine with role compatibility (input/output, master/slave, etc.).
- Slot composition: build complex interfaces from leaf interfaces (e.g. I2C from GPIO + pull-ups).
- Capability-based intra-module slot binding.
- Typed parameters with units, ranges, and tolerances.
- Trait system for composable behaviors.
- ASCII and HTML visualizers for module / harness topology.
- Design Rule Check (DRC) specification (see [docs/drc-spec.md](docs/drc-spec.md)).
- Domain examples under `test/fixtures/`: Arduino Nano, L298N motor driver, VL53L0X sensor, DC motor, robot car.
- Architecture documentation: [docs/architecture.md](docs/architecture.md).

### Notes

- Schemas may evolve before 1.0; pin a version if you build on it.
