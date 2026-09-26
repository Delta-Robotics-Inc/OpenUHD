# Changelog

All notable changes to **Universal Hardware Description (UHD)** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Drone protocol vocabulary: `BrushlessPhases`, `EscSignal`, `FcEscPort`, `CRSF`, `SBUS`, `BoltPattern`, `Shaft`, `connectorTrait`, and parameters for cell count, capacity, hole spacing, fastener and shaft diameter, burst current, and ESC signal rate.
- Module kinds (`module`, `group`, `harness`), `exports` (child interfaces on a parent boundary; groups export implicitly), stored `links` (`InterfaceLink` with explicit `EndpointTarget`s and optional stored `childLinks`), and `display` hints on `ModuleDef`. Harness endpoints gain topology roles; harnesses gain parameters, artifacts, and traits.
- `src/system`: canonical paths, `primaryInterfaces`, `resolveExports`, `boundaryInterfaces`, `resolveEndpoint`, and `validateLink`/`validateLinks` (per-link DRC on sliced modules, with stored child links overriding derived ones).
- Part pipeline skills (`skills/`) and `scripts/verify-part.ts`.
- Eight quadcopter parts and the `library/systems/quadcopter-5in` reference system.

### Changed

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
