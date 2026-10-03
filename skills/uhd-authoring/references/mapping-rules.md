# Mapping rules: evidence → ModuleDef

| Evidence | UHD |
| --- | --- |
| A physical pad, pin, lead, or terminal | A leaf `InterfaceDef` with `pin` set to the silkscreen or pad label and a `pin_functions` trait holding the verbatim description. |
| A chip's pin table | `pinTable([...rows], { source, logicV })`: one leaf per row, ids `pin_<n>`, every pin including NC/reserved (`nc`) and the exposed pad. |
| Package name, pin count, pitch, exposed pad (datasheet package section) | `domains[].package` on the mechanical domain (`PackageSpec`), with `source`; the overall size in `dimensions_mm`. Never a footprint or land-pattern name. |
| A resistor, capacitor, inductor or ferrite bead | `Passive({ kind, value, unit, tolerance, package })`: two `passive` terminals and a `passive` trait. |
| A manufacturer series sold at many values (a chip-resistor or MLCC range) | One definition whose `passive` trait states the default instance and the series fields (`parameters` with ranges, `choices`, `overridable`, `tolerances` with ordering codes, `values` for a table series, `part_number` rule), each cited. Placements set their value in `ChildModuleRef.overrides`. |
| A bus or port made of several pads | A composed interface (builder) whose default profile binds the leaves. |
| A pad with several selectable functions | One leaf with every capability the source states, plus an `interfaceGroups` entry when functions exclude each other. |
| A connector with several positions (JST-SH 8, XT60, a DJI socket, a GH-6P) | A connector composite: `Connector({ id, connector, gender, pins: [[label, leafId], …], note })`, positions in pin-1-first (or printed) order, each bound to the pad it shares; unused positions have no leaf. The pads keep only their own `solder_pad` trait. See [connectors and harnesses](../../../docs/connectors-and-harnesses.md). |
| A connector carrying exactly one functional interface (USB-C, MMCX/U.FL antenna, a balance lead) | `connectorTrait` on that interface. |
| Two identical sockets in parallel | Two connector composites binding the same leaves (`gh6p_1`, `gh6p_2`). |
| A supply input range ("2–6S", "3.7–13.2 V") | `PowerIn` with a `voltage` range; add `cellCount([min, max])` when the source states it in cells. |
| A regulated output ("5 V 2 A BEC") | `PowerOut` with `voltage` and `max_current`. |
| Continuous vs burst current | `max_current` = continuous and `burst_current` = burst, with the burst duration in a trait. |
| Mounting holes | `BoltPattern`: role `component` on parts and `structure` on frames; `spacingMm`, `holeCount`, `fastener`, `fastenerDiameterMm`; grommets or soft mounts in `note`. |
| A motor shaft / prop hub | `Shaft`: `output` on the motor, `input` on the propeller; the thread goes in `thread`. |
| Motor wires | `BrushlessPhases({ role: "input", termination: "bare_wire_lead" })`; lead gauge and length go in a trait. |
| ESC outputs | `BrushlessPhases({ id: "motor_1", role: "output", ... })`, one per channel, with per-channel current ratings. |
| FC motor pads M1–M8 | `EscSignal` leaves with `motorIndex`; the functional FC↔ESC port is `FcEscPort` with the leaves passed in (no connector/pinout on it), and the physical socket is a separate connector composite. |
| Brushed motor terminals, H-bridge outputs | `BrushedMotorTerminals({ role: "input" })` on the motor, `role: "output"` per driver channel with its current rating. |
| Stepper motor leads | `StepperPhases({ role: "input", winding, leads })` with the lead colours as leaf names; `bipolarCapable` when a unipolar motor has a tap per winding. |
| Stepper driver | `StepperPhases({ role: "output", winding })` for the motor terminals and `StepDir({ role: "input", step, dir, enable, stepReturn, … })` for the command inputs, with the step rate and timing. |
| Encoder outputs or an encoder input | `QuadratureEncoder` (`output` on the encoder, `input` on the reader), with counts per revolution, the absolute PWM output and the supply where present. |
| Servo lead or servo channel | `ServoPort` with the pulse range, frame rate and connector pinout; the supply goes through `power` and `ground`. |
| CAN bus pins or connectors | `CAN({ canH, canL, ground, bitRateBps, fd, termination })`; an MCU's CAN peripheral and a transceiver's logic pins are `CANLogic`. |
| Shield or HAT pins | `ShieldHeader({ form, role: "accessory", pins: { label: leafId } })` on the shield; the host board declares the same form with `role: "host"`. |
| Pneumatic or hydraulic port | `FluidPort({ medium, role, joint, pressureBar })`; one per physical port, with the thread or tube size as the source prints it. |
| Dimensions, mass | `domains[].dimensions_mm` (overall, leads included), `domains[].weight_g` (mechanical). |
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
| Manufacturer CAD | A body artifact (`role: "body"`) with its feature manifest; the CAD's licence recorded with the source. |
| No usable CAD | Representative geometry from the drawing dimensions, and a `data_gap` trait "manufacturer CAD" saying where you looked. |
| Mounting holes in the CAD | `frame` at the pattern centre on the mounting face, normal outward, xAxis along the pattern; `feature` ref to the holes plus `procedural("bolt_pattern")`. |
| Irregular hole pattern (e.g. Arduino UNO) | The largest square/rectangle subset as the `BoltPattern`, the remaining holes in its `note`, and an `assumption` trait saying which holes were modelled. |
| Shaft | `frame` on the axis at the mounting face, normal along the shaft; feature ref plus `procedural("shaft")`. |
| Connector | A feature on the connector body, on the connector composite (one ref per socket). Functional interfaces carried by it may also ref it. |
| Electrical-only interface | No geometry, or `logical: true`. |
