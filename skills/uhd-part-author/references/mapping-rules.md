# Mapping rules: evidence → ModuleDef

| Evidence | UHD |
| --- | --- |
| A physical pad, pin, lead, or terminal | A leaf `InterfaceDef` with `pin` set to the silkscreen or pad label and a `pin_functions` trait holding the verbatim description. |
| A bus or port made of several pads | A composed interface (builder) whose default profile binds the leaves. |
| A pad with several selectable functions | One leaf with every capability the source states, plus an `interfaceGroups` entry when functions exclude each other. |
| A connector (JST-SH 8, XT60, MMCX) | `connectorTrait` on the interface it carries, with `pinout` in pin-1-first order. |
| A supply input range ("2–6S", "3.7–13.2 V") | `PowerIn` with a `voltage` range; add `cellCount([min, max])` when the source states it in cells. |
| A regulated output ("5 V 2 A BEC") | `PowerOut` with `voltage` and `max_current`. |
| Continuous vs burst current | `max_current` = continuous and `burst_current` = burst, with the burst duration in a trait. |
| Mounting holes | `BoltPattern`: role `component` on parts and `structure` on frames; `spacingMm`, `holeCount`, `fastener`, `fastenerDiameterMm`; grommets or soft mounts in `note`. |
| A motor shaft / prop hub | `Shaft`: `output` on the motor, `input` on the propeller; the thread goes in `thread`. |
| Motor wires | `BrushlessPhases({ role: "input", termination: "bare_wire_lead" })`; lead gauge and length go in a trait. |
| ESC outputs | `BrushlessPhases({ id: "motor_1", role: "output", ... })`, one per channel, with per-channel current ratings. |
| FC motor pads M1–M8 | `EscSignal` leaves with `motorIndex`; the connector to the ESC is `FcEscPort` with the leaves passed in. |
| Dimensions, mass | `domains[].dimensions_mm`, `domains[].weight_g` (mechanical). |
| Operating temperature | A `thermal` domain entry, plus an `operating_conditions` trait. |
| KV, thrust, C rating, prop pitch | A `performance` trait with `kind` (`motor`, `battery`, `propeller`, `radio`, `video`). |
| A value the source doesn't give but DRC needs | An `assumption` trait `{ field, value, reason }`. Leave the parameter out unless the assumption is conservative and explicit. |
| Two sources disagree | A `source_discrepancy` trait, using the manufacturer's value unless it's clearly a typo. |

## Versions

New parts start at `version: "1.0.0"`. Bump the minor version for additive
evidence, and the major version for changes that break an interface id,
protocol, role, or connector pinout.

## Geometry

| Evidence | UHD |
| --- | --- |
| Manufacturer STEP | `library/cad/py/catalog/<id>.py` using `vendor_step.py`; `vendorCadArtifacts(...)` on the part. |
| No usable CAD | `catalog/<id>.py` using `partkit.py` from the drawing; `cadArtifacts(...)`; a `data_gap` trait "manufacturer CAD". |
| Mounting holes in the CAD | `frame` at the pattern centre on the mounting face, normal outward, xAxis along the pattern; `feature`/`vendorFeature` ref to the holes plus `procedural("bolt_pattern")`. |
| Irregular hole pattern (e.g. Arduino UNO) | The largest square/rectangle subset as the `BoltPattern`, the remaining holes in its `note`, and an `assumption` trait saying which holes were modelled. |
| Shaft | `frame` on the axis at the mounting face, normal along the shaft; feature ref plus `procedural("shaft")`. |
| Connector | A feature on the connector body; every interface it carries refs it. |
| Electrical-only interface | No geometry, or `logical: true`. |
