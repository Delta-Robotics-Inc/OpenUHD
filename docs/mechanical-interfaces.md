# Mechanical interfaces: bolt patterns, shafts, linear motion

Status: implemented. Code: `src/protocols/mechanical.ts`
(`BoltPattern`, `Shaft`, `LinearMotion`), `src/drc/joint-check.ts`
(`bolt_pattern_shape`, `bolt_pattern_line`, `shaft_fit`,
`linear_motion_capacity`), hole positions in `src/system/geometry.ts`
(`boltPatternHoles`). Tests: `test/vocabulary.test.ts` (cross patterns) and
`test/mechanical-vocabulary.test.ts`.

The minimum supply current is at the end of this page, because it is
checked the same way: the source's rating against what the input states it
needs.

Two features mate when their protocols pair by role and every parameter
both sides state overlaps (`hole_spacing`, `fastener_diameter`,
`shaft_diameter`, `lead`, and so on). The pair checks below compare what
parameters cannot: where the holes are, how a shaft fits its bore, and
whether an output covers what a load needs.

## Bolt patterns

`BoltPattern` has protocol `bolt_pattern` with role `structure` (the frame,
plate or extrusion that provides the holes) or `component` (the part fixed
to it). Every shape states the fastener (`fastener`, `fastenerDiameterMm`)
and whether the holes are threaded.

| Shape | Fields | Holes (in the frame's x/y) |
| --- | --- | --- |
| `square` | `spacingMm` (side), `holeCount` | Corners of a square centred on the frame |
| `rectangle` | `spacingMm` (x), `spacingYmm` (y), `holeCount` | Corners of a rectangle |
| `circle` | `spacingMm` (bolt-circle diameter), `holeCount` | Evenly spaced, hole 1 on the frame's xAxis |
| `cross` | `spacingMm` and `spacingYmm` (the two diagonals), four holes | One pair on x, the other on y (a "16 × 19" motor base) |
| `row` | `pitchMm`, `holeCount` (two or more) | In a line on x, centred, `pitchMm` apart; `hole_spacing` is the span, first to last |
| `slot` | `slotLengthMm`, `slotKind` (`t_slot` or `through`), optional `holeCount` | None fixed: a fastener sits anywhere along the slot |

Parameters: `hole_spacing`, `hole_spacing_y`, `hole_count`,
`fastener_diameter`, plus `hole_pitch` on a row and `slot_length` on a slot.

**Rows.** Use a row for holes on a pitch in one line: a bracket leg with
five M3 holes on an 8 mm pitch, one line of a channel's hole grid, a
servo bracket's mounting row. A grid of several rows is several row
interfaces, one per line the mating part uses.

**Slots.** Use a slot for an extrusion's T-slot (`t_slot`: the nut or
screw head is held in the channel) or for a slotted bracket or plate
(`through`). Holes that are slotted so the spacing between them can vary
(a motor plate with slotted holes for belt tension) are not a slot: keep the
pattern's shape and give `spacingMm` a `[min, max]` range.

### How they pair

| Pair | Mates when | Otherwise |
| --- | --- | --- |
| Same shape (square, rectangle, circle, cross) | The parameters overlap | `param_range_disjoint` |
| Cross ↔ circle or square | The cross's diagonals are equal and match the circle's diameter or the square's diagonal (same four holes) | `bolt_pattern_shape` |
| Row ↔ row | The holes of one land on the other's: its pitch is the other's or a whole multiple of it, and it is no longer (two holes 16 mm apart land on an 8 mm row of three or more) | `bolt_pattern_line` |
| Row ↔ slot | The row's span fits in the slot's length | `bolt_pattern_line` |
| Slot ↔ slot | At least one is a through slot | `bolt_pattern_line` (two T-slots: neither has a hole for the fastener) |
| Row or slot ↔ square, circle, cross, rectangle with a y spacing | Never: those holes are not on one line | `bolt_pattern_line` |

For a pair with a row or a slot the line rule compares the spans, counts,
pitches and lengths itself, and the parameter overlap check skips them
(`pairCheckedParams`). The fastener is still compared as a parameter.

Older definitions wrote a row as a `rectangle` with `spacingYmm: 0`, and a
slot as such a rectangle with a `spacingMm` range from 0. Against a row or a
slot those read as a two-hole row (the end holes) and as a slot of that
length. Two old-style patterns are still compared by their parameters only,
so re-author them as rows and slots.

A slot has no fixed holes, so `boltPatternHoles` returns none for it: a
fastener stack mounted on a slot gives its `positions`, and a CAD hole check
has nothing to compare.

```ts
BoltPattern({ id: "leg_a", role: "component", shape: "row", pitchMm: 8, holeCount: 5, fastener: "M3", fastenerDiameterMm: 3, threaded: false });
BoltPattern({ id: "slot_px", role: "structure", shape: "slot", slotLengthMm: 120, slotKind: "t_slot", fastener: "M3", fastenerDiameterMm: 3 });
```

## Shafts and bores

`Shaft` has protocol `shaft` with a role for which way torque flows, and a
`shaft` trait for the physical fit.

| Field | Values |
| --- | --- |
| `role` | `output` (drives: a motor shaft or a motor's hollow output), `input` (driven: a propeller hub, a wheel, a gearbox or actuator input), `bidirectional` (carries torque from a driver to a load: a loose shaft, a spacer, a coupler) |
| `gender` | `shaft` (male) or `bore` (female). Independent of the role: a motor with a hollow hex output is an `output` `bore`. |
| `profile` | `round`, `hex`, `rounded_hex`, `d_cut`, `double_d`, `keyed`, `spline`, `square` |
| `diameterMm` | `shaft_diameter`: across flats for hex, rounded hex and square; the nominal diameter for round, D-cut, double-D and keyed; the major diameter for a spline |
| `keyWidthMm` | Keyed only: `key_width`, the key or keyway width |
| `spline` | Spline only: the standard as the source writes it ("25T", "MAXSpline") |
| `thread` | A threaded shaft end or a tapped hole in it ("M5", "10-32 UNF") |

The pair check `shaft_fit`:

- two shafts, or two bores, do not mate (an error);
- a shaft fits a bore of these profiles (the diameter must also overlap):

  | Shaft | Bore |
  | --- | --- |
  | round | round; keyed (warning: the keyway is unused) |
  | hex | hex |
  | rounded hex | hex, rounded hex |
  | D-cut | D-cut, round |
  | double-D | double-D, D-cut, round |
  | keyed | keyed (key widths must overlap); round (warning: fits without its key) |
  | spline | spline, with the same `spline` when both state one |
  | square | square |

  Anything else is an error ("a hex shaft does not fit a round bore").
- When neither side states a gender, profiles are compared either way
  round. A side that states no profile is compared by diameter only, as
  before this vocabulary.

Torque flows from an `output` to an `input`; a `bidirectional` shaft pairs
with both. A loose 5 mm hex shaft is therefore `bidirectional`: the motor's
hex bore (`output`) drives it and it drives a wheel's hex bore (`input`).

```ts
Shaft({ id: "hex_bore", role: "output", gender: "bore", profile: "hex", diameterMm: 5 });
Shaft({ id: "shaft", role: "bidirectional", gender: "shaft", profile: "hex", diameterMm: 5 });
```

## Linear motion

`LinearMotion` has protocol `linear_motion` with role `output` (the moving
member that pushes or pulls: an actuator's rod or inner tube, a lead screw
nut's carriage) or `input` (the load or slide it drives). A lead screw
actuator usually also has a `Shaft` input for the motor.

| Field | Parameter | Meaning |
| --- | --- | --- |
| `strokeMm` | `stroke` (mm) | Travel the output gives; on an input, the travel the load needs |
| `leadMm` | `lead` (mm) | Travel per input revolution (pitch × starts) |
| `threadPitchMm` | `thread_pitch` (mm) | The screw's thread pitch |
| `forceN` | `force` (N) | Rated force of the output (say in `note` whether dynamic, static or peak); on an input, the force the load needs |
| `speedMmS` | `linear_speed` (mm/s) | Rated speed |
| `starts`, `mechanism`, `backdrivable`, `note` | `linear_motion` trait | `mechanism`: `lead_screw`, `ball_screw`, `belt`, `rack_and_pinion`, `pneumatic`, `hydraulic`, `solenoid`, `linear_motor`, `other` |

The builder refuses a lead that is not pitch × starts when all three are
given. `stroke` and `force` are capacities: the pair check
`linear_motion_capacity` reports an error when the output gives less than
the load states it needs, and an info when the load states a need the
output does not rate. `lead` and `thread_pitch` must overlap when both sides
state them (a screw and its nut).

```ts
LinearMotion({ id: "output", role: "output", strokeMm: 304.8, leadMm: 12, threadPitchMm: 2, starts: 6, forceN: 667, mechanism: "lead_screw", backdrivable: true, note: "Minimum dynamic load rating 150 lbf." });
```

## Minimum supply current

Some inputs need a source rated for at least a given current, whatever
they draw: a motor controller that the manufacturer says to feed from a
40 A distribution channel, or a motor whose stall current its controller
channel must carry. `PowerIn`, and `BrushedMotorTerminals` and
`BrushlessPhases` with role `input`, take `minSupplyCurrentA`, the
`min_supply_current` parameter (A). The builders refuse it on an output: a
source states `maxCurrentA`.

The pair check `supply_current_rating` compares it with the `max_current`
of the side whose role is `output` or `source`: an error when the source is
rated lower, an info when the source states no rating. Like `max_current`
it is a capacity parameter, so it is not compared by range overlap.
`min_supply_current` is a rating requirement, not a draw: the supply budget
still adds up `current_draw` and `min_supply_power`.

```ts
PowerIn({ id: "vin", voltageV: [5.5, 24], nominalV: 12, maxCurrentA: 60, minSupplyCurrentA: 40 });
```
