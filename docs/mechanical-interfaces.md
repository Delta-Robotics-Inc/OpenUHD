# Mechanical interfaces: bolt patterns, shafts, linear motion, drive train

Status: implemented. Code: `src/protocols/mechanical.ts`
(`BoltPattern`, `Shaft`, `LinearMotion`), `src/protocols/drive.ts` (`Gear`,
`Bearing`, `BearingSeat`, `Thread`, `TSlot`, `AxialFace`, `Wheel`,
`RollingSurface`), `src/drc/joint-check.ts` (`bolt_pattern_shape`,
`bolt_pattern_line`, `bolt_pattern_holes`, `shaft_fit`,
`linear_motion_capacity`), `src/drc/drive-check.ts` (`gear_mesh`,
`bearing_fit`, `thread_fit`, `t_slot_fit`, `axial_face`,
`rolling_contact`), hole positions in `src/system/geometry.ts`
(`boltPatternHoles`). Tests: `test/vocabulary.test.ts` (cross patterns),
`test/mechanical-vocabulary.test.ts` and `test/drive-vocabulary.test.ts`.

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
| `grid` | `pitchMm`, `lattice` (`rectangular`, with optional `pitchYmm`, or `triangular`), and `rows` × `columns` or a disc (`withinDiameterMm`, optional `minDiameterMm`); `holeCount` is derived and, when given, checked | Every lattice point of the extent: rows × columns centred on the frame, or every point within the disc around the origin (a lattice point) and outside `minDiameterMm`. Rows run along x; a triangular lattice offsets every other row by half a pitch, rows pitch × √3/2 apart |
| `arc` | `spacingMm` (the circle's diameter), `holeCount`, `angularPitchDeg`, `startAngleDeg` (default 0) | A partial bolt circle: the first hole at the start angle from x, counter-clockwise about the normal, the others a pitch apart |

Parameters: `hole_spacing`, `hole_spacing_y`, `hole_count`,
`fastener_diameter`, plus `hole_pitch` on a row and a grid, `hole_pitch_y`
on a rectangular grid, `angular_pitch` (degrees) on an arc and
`slot_length` on a slot. A grid's lattice and extent and an arc's start
angle are in the `bolt_pattern` trait.

**Grids.** Use a grid for a plate, channel or web drilled on a hole grid:
a moulded gear with M3 holes on every point of an 8 mm triangular lattice
out to Ø32 except the bore
(`lattice: "triangular", pitchMm: 8, withinDiameterMm: 32, minDiameterMm: 1`);
a 2 × 6 plate on a 16 mm pitch is `rows: 2, columns: 6, pitchMm: 16`. A grid
of one row is a `row`.

**Partial circles.** Use an arc when only some positions of a bolt circle
are drilled: a gearbox bracket with five of six positions on Ø32 (the
sixth falls in a notch) is `holeCount: 5, angularPitchDeg: 60,
startAngleDeg: -30`; a bent motor bracket with four of six positions on
Ø16 is `holeCount: 4, angularPitchDeg: 60`. A full `circle`
spaces its holes evenly round the whole circle, so it cannot say which
positions are missing.

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
| Grid or arc ↔ any pattern with fixed holes | The pattern with fewer holes lands on the other's holes under one rotation and shift, or their mirror image, within 0.05 mm (a 5-hole row along a grid line; a 6-hole Ø16 circle on an 8 mm triangular grid; five of six positions on the full circle) | `bolt_pattern_holes` |
| Grid ↔ slot | Always: fasteners go through one line of the grid's holes (info) | |
| Arc ↔ slot | Never | `bolt_pattern_holes` |

For a pair with a grid or an arc the hole rule compares the holes
themselves (`holesFitOn`, `patternHoles`) and the overlap check skips the
spacings, counts and pitches.

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

- two shafts, or two bores, do not mate: `validatePair` does not connect
  them on its own (they stay potentials, so two gears' hub bores do not
  make a gear pair incompatible), and a link someone makes between them is
  an error (`validatePair(a, b, { explicit: true })`, which
  `validateLink` uses);
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
- A round bore with `clampsOn` (an adapter: a shaft collar's Ø6 bore
  that goes over a 5 mm hex shaft and is held by a set screw on a flat)
  fits a shaft of that profile and size (a rounded hex for a hex), with an
  info saying what holds it; the diameters are not compared as parameters.
  The builder refuses `clampsOn` on anything but a round bore, and a bore
  that does not clear the shaft's corners (5 mm hex: 5.77 mm across
  corners).
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

## Gears

`Gear` is a gear's teeth: protocol `gear_mesh`, role `mesh` (gears pair
with gears only). The bore or hub that carries the gear is a separate
`Shaft`; its bolt holes are `BoltPattern`s.

| Field | Parameter or trait | Meaning |
| --- | --- | --- |
| `moduleMm` or `diametralPitch` | `gear_module` (mm) | Module (pitch Ø ÷ teeth; the normal module of a helical gear). A diametral pitch P is stored as 25.4 / P, and the trait says which the source gave |
| `pressureAngleDeg` | `pressure_angle` (deg) | 20°, 14.5°, 25° |
| `teeth` | `tooth_count` | A worm's starts; a rack's teeth along its length |
| `faceWidthMm` | `face_width` (mm) | Axial width of the teeth |
| `kind` | trait | `spur` (default), `helical` (needs `helixAngleDeg` and `hand`), `internal`, `rack`, `bevel`, `worm`, `worm_wheel` |
| | trait | `pitch_diameter_mm`, and `outside_diameter_mm` (or `inside_diameter_mm` for an internal gear), computed |

The pair check `gear_mesh`:

- an error for a different module (within 0.1 %) or pressure angle (within
  0.01°): a 0.75 module gear does not mesh with a 0.8 module gear;
- an error for kinds that do not mesh: spur and helical each mesh with
  their own kind, an internal gear and a rack; an internal gear with spur
  or helical; bevel with bevel; a worm with a worm wheel. Two helical gears
  on parallel shafts need the same helix angle and opposite hands. An
  internal gear needs a pinion with fewer teeth;
- otherwise an info with the ratio and the centre distance
  (m (z1 + z2) / 2, divided by cos β for helical gears; m (z2 − z1) / 2 with
  an internal gear), or for a rack the pinion axis's height over the pitch
  line and the travel per turn, and the engaged face width.

`gear_module`, `pressure_angle`, `tooth_count` and `face_width` are not
compared as parameters between two gears (two gears of different sizes
mesh).

```ts
Gear({ moduleMm: 0.75, pressureAngleDeg: 20, teeth: 72, faceWidthMm: 11, material: "acetal" });
Shaft({ id: "hub", role: "bidirectional", gender: "bore", profile: "hex", diameterMm: 5 });
```

## Bearings and bearing seats

`Bearing` returns two interfaces: its outside, protocol `bearing_fit` role
`bearing` (parameters `bearing_od`, `bearing_width`, `bearing_bore`, and
`load_rating` from the dynamic rating), and its bore as a `Shaft` bore
(role `bidirectional`, round unless `bore.profile` says otherwise: a
through-bore bearing for a hex shaft has a hex bore). `kind` is `ball`, `roller`,
`needle`, `tapered_roller`, `thrust` or `plain` (a bushing or sleeve
bearing); the trait carries the designation, flange, seals, material,
static and dynamic ratings and speed.

`BearingSeat` is the housing bore that holds one: protocol `bearing_fit`
role `seat`, with `bearing_od` (a single size, or a range for a seat made
for several) and `seat_depth`, and in its trait `through`, `retention`
(`press`, `slip`, `shoulder`, `snap_ring`, `flange`) and the `kinds` it is
for.

The pair check `bearing_fit`: an error when the bearing's outside diameter
is not the seat's (0.05 mm tolerance); a warning when the seat names the
kinds it is for and this is not one; an info when the bearing is wider than
a blind seat is deep (it stands proud; a flanged bearing's flange sits
outside).

```ts
BearingSeat({ id: "bearing_seat", odMm: 9, depthMm: 3, kinds: ["ball"], retention: "flange" });
Bearing({ kind: "ball", boreMm: 5, odMm: 9, widthMm: 4, flange: { odMm: 10.2, widthMm: 0.6 }, bore: { profile: "hex" } });
```

## Threads

`Thread` is a screw thread: protocol `thread`, role `external` (a screw, a
bolt, a set screw, a stud, threaded rod, a standoff's male end) or
`internal` (a nut, a tapped hole, a heat-set insert, a standoff's female
end). Parameters `fastener_diameter` (nominal), `thread_pitch` (from
`pitchMm`, or `tpi` as 25.4 / tpi; left out when the source states no
pitch, and then not compared) and `thread_length` (an external
thread's length, an internal thread's depth or a nut's height). The trait
has the designation as the source writes it, the hand (default right),
`kind`, `through` (internal, open both ends) and `lock` (`nylon_insert`,
`nylon_patch`, `adhesive_patch`, `all_metal`).

The pair check `thread_fit`: an error for a different diameter, pitch or
hand; otherwise an info with the length of thread engaged. A `length`
parameter on a thread (a screw's length under the head, an insert's
length: what fastener stacks read) is not compared between the two. A head, a hex
or a drive recess is not a thread: describe it in metadata, or as a
`TSlot` insert when it slides in a track.

```ts
Thread({ gender: "external", designation: "M3 x 0.5", diameterMm: 3, pitchMm: 0.5, lengthMm: 8, kind: "screw" });
Thread({ gender: "internal", designation: "M3 x 0.5", diameterMm: 3, pitchMm: 0.5, lengthMm: 4, through: true, kind: "nut", lock: "nylon_insert" });
```

## T-slot and linear-track mounts

`TSlot` is an undercut track and what slides in it: protocol `t_slot`, role
`track` (an extrusion's slot, a slotted rail) or `insert` (a T-nut, a
screw head, a carriage foot). A track states `profile`, `openingMm`
(between the lips), `channelWidthMm` and `channelDepthMm` (under the lips),
`lengthMm` and `entry` (`end`, `drop_in`); an insert its `neckWidthMm`,
`headWidthMm`, `headHeightMm` and `entry`. Parameters `slot_opening`,
`channel_width`, `channel_depth`, `slot_length`, `neck_width`,
`head_width`, `head_height`.

The pair check `t_slot_fit`: errors for a neck that does not pass the
opening, a head no wider than the opening (the lips do not hold it), a head
wider or taller than the channel, and no entry in common; a warning for two
different named profiles with nothing to compare. A slot that is also a
place to bolt a bracket keeps its `BoltPattern` slot as well: that pairs
with hole patterns, the `TSlot` with the hardware in the slot.

```ts
TSlot({ role: "track", profile: "15 mm extrusion", openingMm: 3.2, channelWidthMm: 6.2, channelDepthMm: 2.2, lengthMm: 120, entry: ["end"] });
TSlot({ role: "insert", profile: "15 mm extrusion", neckWidthMm: 3, headWidthMm: 5.5, headHeightMm: 1.8, entry: ["end"] });
```

## Axial faces: spacers, collars, hubs

`AxialFace` is an annular face that spaces or stops parts along a shaft:
protocol `axial_stop`, role `face` (faces pair with faces), with `face_od`,
`face_id` and optionally `axial_length`. The trait has `kind` (`spacer`,
`collar`, `hub`, `bearing_inner`, `bearing_outer`, `shoulder`, `washer`,
`housing`), `turns_with` (`shaft` or `housing`) and `clamps` (a collar
that takes axial load). A spacer has two faces, one per end.

The pair check `axial_face`: an error when the annuli do not overlap (one
face passes inside the other's bore); a warning when one face turns with
the shaft and the other with the housing (they rub: touch only a bearing's
inner ring, or use a thrust washer).

## Wheels

`Wheel` is a wheel's rolling contact: protocol `rolling_contact`, role
`wheel`, with `wheel_diameter`, `tread_width` and `load_rating`, and in its
trait `kind` (`traction`, `omni`, `mecanum`, `caster`, `pneumatic`,
`roller`), `tread`, `rollers` (omni and mecanum) and `hand` (mecanum,
required). It pairs with a `RollingSurface` (role `surface`: a floor, a
field tile, a rail, a belt), which may state `min_wheel_diameter`; the pair
check `rolling_contact` refuses a smaller wheel. The hub is a `Shaft`, the
bolt holes `BoltPattern`s.

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
