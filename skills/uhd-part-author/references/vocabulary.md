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
| `BoltPattern` | `bolt_pattern: structure/component` | Mounting hole patterns (frame side = structure) |
| `Shaft` | `shaft: output/input` | Motor shafts (output), propeller hubs and pulleys (input) |
| `connectorTrait` | trait | Connector or termination detail and pin order |

## Canonical parameter ids

`voltage` (V), `max_current` (A), `burst_current` (A), `drive_current` (mA),
`cell_count`, `capacity` (mAh), `baud_rate` (Hz), `clock_freq` (Hz),
`i2c_address`, `esc_signal_rate` (kbit/s), `motor_index`, `hole_spacing` /
`hole_spacing_y` (mm), `hole_count`, `fastener_diameter` (mm),
`shaft_diameter` (mm), `resolution`, `max_frequency` (Hz).

## Existing types in the library

`power`, `digital`, `i2c`, `spi`, `uart`, `usb`, `analog`, `pwm`,
`interrupt`, `can`, `bluetooth`, `wifi`, `rf`, `i2s`, `jtag`, `swd`,
`mechanical_connection`, `mechanical_drive`, `mechanical_mount`,
`threaded_connection`, `thermal_connection`, `pneumatic`, `custom`, and a
few part-specific types. The older mechanical types
(`mechanical_connection`, `mechanical_mount`, `threaded_connection`) predate
`bolt_pattern` and `shaft`. Use the new builders for new parts; converging
the older ones is tracked as a vocabulary gap.

## Not yet covered

Use `custom` with a trait, and log a `vocabulary` gap, for:

- video transmission links (e.g. a DJI camera-to-air-unit cable);
- RF antenna connectors (MMCX, U.FL): use `connectorTrait` on an `rf`
  interface;
- battery straps and zip-tie points;
- MSP / DisplayPort OSD: it runs over UART, so model it as `UART` and note
  the protocol in a `usage_note` trait.
