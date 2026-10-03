# UHD part vocabulary

The protocol types, roles, and builders to use when authoring parts. Types
and roles pair through `src/matching/roles.ts`: generic pairs are input ↔
output, host ↔ device, master ↔ slave, transmitter ↔ receiver, and peer ↔
peer.

## Builders (`src/protocols`)

| Builder | Emits (protocol type: roles) | Use for |
| --- | --- | --- |
| `Pin` | `digital`, `pwm`, `analog`, `interrupt` leaves | GPIO / MCU pins |
| `PowerIn` / `PowerOut` | `power: input/output` | Supply rails, BEC outputs, battery leads (pass `parameters: [cellCount(...)]` where a cell count applies) |
| `Ground` | `power: ground` | Ground returns |
| `I2C` | `i2c: master/slave` + `sda`/`scl` slots | I2C buses; `address` for fixed device addresses |
| `SPI` | `spi` | SPI buses |
| `UART` | `uart: host/device` + `rx`/`tx` slots | Serial ports (on a flight controller, UARTn with its pads) |
| `PWM` | `pwm: output` | Dedicated PWM units |
| `ADC` / `DAC` | `analog` | Analog inputs/outputs (e.g. current sense, RSSI) |
| `BrushlessPhases` | `bldc_phase` leaves + `bldc_3phase: output/input` | ESC motor outputs (output), motor windings (input) |
| `EscSignal` | `dshot` / `oneshot125` / `oneshot42` / `multishot` / `pwm_esc`: output/input | FC motor outputs (output), ESC signal inputs (input) |
| `FcEscPort` | `fc_esc_connector: host/device` | FC ↔ 4-in-1 ESC harness connector |
| `CRSF` | `uart` + `crsf: device` | ExpressLRS / Crossfire receiver serial link |
| `SBUS` | `sbus: output/input` | SBUS receivers |
| `BrushedMotorTerminals` | `dc_motor_terminal` leaves + `dc_motor: output/input` | H-bridge and motor controller channels (output), brushed motor terminals (input) |
| `StepperPhases` | `stepper_phase` leaves + `bipolar_stepper_phases` / `unipolar_stepper_phases: output/input` | Stepper driver outputs (output), stepper windings (input); `bipolarCapable` on six- and eight-wire unipolar motors |
| `StepDir` | `digital` leaves + `step_dir: output/input` | Step/direction command: controller pins (output), driver inputs with optional opto returns (input) |
| `QuadratureEncoder` | `digital` (A, B, index) and `pwm` (absolute) leaves + `quadrature_encoder: output/input` | Encoders (output), encoder inputs on motor controllers and MCUs (input) |
| `ServoPort` | `pwm` signal leaf + `rc_servo: output/input` | Hobby servos (input), servo controller, shield and receiver channels (output) |
| `CAN` | `can_signal` leaves + `can: node` | CAN bus side (CANH, CANL, optional ground), with bit rate, FD and termination |
| `CANLogic` | `digital` leaves + `can_logic: controller/transceiver` | An MCU's CAN TX/RX (controller) and a transceiver's TXD/RXD (transceiver) |
| `ShieldHeader` | `connector: mate` (a `Connector` with a standard layout) | Arduino UNO R3 shield headers, the Arduino ICSP header, the Raspberry Pi 40-pin header; role `host` or `accessory` |
| `FluidPort` | `pneumatic` / `hydraulic: source/sink/bidirectional/sensing` | Cylinder, valve, compressor, regulator and sensor ports, fittings and tube ends, with a `fluid_joint` (thread, push-to-connect, tube, barb, quick coupler) |
| `BoltPattern` | `bolt_pattern: structure/component` | Mounting hole patterns (frame side = structure); shape `square`, `rectangle`, `circle`, `cross` (two diagonals, e.g. a 16 × 19 motor base), `row` (holes in a line on a pitch: bracket legs, a line of a hole grid) or `slot` (a T-slot or a through slot that takes fasteners anywhere along its length) |
| `Shaft` | `shaft: output/input/bidirectional` | Motor shafts and hollow outputs (output), hubs, pulleys, wheels and gearbox inputs (input), loose shafts, spacers and couplers (bidirectional); `gender` shaft or bore, `profile` round, hex, rounded_hex, d_cut, double_d, keyed, spline or square |
| `LinearMotion` | `linear_motion: output/input` | The moving member of a linear actuator, lead screw or slide (output) and the load it drives (input), with stroke, lead, thread pitch, force and speed |
| `Connector` | `connector: mate` + `p1…pN` slots | A physical connector with several positions; binds each position to a pad |
| `connectorTrait` | trait | Connector detail on an interface that is the only thing a connector carries, or a termination (`solder_pad`) |
| `pinTable` | `power`, `digital`, `analog`, `passive`, `custom: no_connect` leaves with `pin` | A chip's datasheet pin table (types `power_in`, `power_out`, `ground`, `io`, `input`, `output`, `analog_in`, `analog_out`, `passive`, `nc`) |
| `Passive` | module with `passive: terminal` leaves | Resistors, capacitors, inductors, ferrite beads |
| `Net` / `netLinks` | `net: node` on a board | Board nets (boards only, never on a part; see docs/boards-and-nets.md) |

## Canonical parameter ids

`voltage` (V), `max_current` (A), `burst_current` (A), `drive_current` (mA),
`cell_count`, `capacity` (mAh), `baud_rate` (Hz), `clock_freq` (Hz),
`i2c_address`, `esc_signal_rate` (kbit/s), `motor_index`, `hole_spacing` /
`hole_spacing_y` (mm), `hole_count`, `fastener_diameter` (mm),
`shaft_diameter` (mm), `resolution`, `max_frequency` (Hz, also a step
rate), `pulse_width` (us), `frame_rate` (Hz), `counts_per_rev`, `bit_rate`
(bit/s), `pressure` (bar), `tube_od` and `tube_id` (mm), `hole_pitch` and
`slot_length` (mm), `key_width` (mm), `stroke`, `lead` and `thread_pitch`
(mm), `force` (N), `linear_speed` (mm/s), `min_supply_current` (A, on an
input: the least current its source must be rated for).

Capacity parameters are not compared by range overlap: `max_current`,
`burst_current`, `drive_current`, `current_draw`, `min_supply_power`,
`min_supply_current`, `stroke`, `force`, `linear_speed`. Pair checks
compare `min_supply_current` with the source's `max_current`, and a load's
`stroke` and `force` with the output's.

## Role families with their own table

`src/matching/roles.ts` overrides the generic pairs for:

- `bipolar_stepper_phases`: output ↔ input, and the older driver ↔ motor.
- `can`: node, transceiver and peer all pair with each other (one bus).
- `can_logic`: controller ↔ transceiver only.
- `pneumatic` and `hydraulic`: source ↔ sink, bidirectional with everything
  but another sensor, sensing ↔ source or bidirectional. Generic pairs such
  as input ↔ output do not apply.

## Existing types in use

`power`, `digital`, `i2c`, `spi`, `uart`, `usb`, `analog`, `pwm`,
`interrupt`, `can`, `bluetooth`, `wifi`, `rf`, `i2s`, `jtag`, `swd`,
`mechanical_connection`, `mechanical_drive`, `mechanical_mount`,
`threaded_connection`, `thermal_connection`, `custom`, and a
few part-specific types. The older mechanical types
(`mechanical_connection`, `mechanical_mount`, `threaded_connection`) predate
`bolt_pattern` and `shaft`. Use the new builders for new parts; converging
the older ones is tracked as a vocabulary gap.

## Pair checks beyond parameters

`checkPairJoints` (`src/drc/joint-check.ts`) reports `fluid_joint_mismatch`,
`bolt_pattern_shape` (a cross against another shape), `bolt_pattern_line`
(rows and slots), `shaft_fit` (shaft and bore genders and profiles),
`linear_motion_capacity` and `supply_current_rating`. See
[mechanical interfaces](../../../docs/mechanical-interfaces.md) and
[fluid ports](../../../docs/fluid-ports.md).

## Not yet covered

Use `custom` with a trait, and log a `vocabulary` gap, for:

- video transmission links (e.g. a DJI camera-to-air-unit cable);
- RF antenna connectors (MMCX, U.FL): use `connectorTrait` on an `rf`
  interface;
- battery straps and zip-tie points;
- MSP / DisplayPort OSD: it runs over UART, so model it as `UART` and note
  the protocol in a `usage_note` trait.
