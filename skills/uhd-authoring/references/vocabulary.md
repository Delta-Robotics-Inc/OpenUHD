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
| `BoltPattern` | `bolt_pattern: structure/component` | Mounting hole patterns (frame side = structure); shape `square`, `rectangle`, `circle`, `cross` (two diagonals, e.g. a 16 × 19 motor base), `row` (holes in a line on a pitch: bracket legs, a line of a hole grid), `slot` (a T-slot or a through slot that takes fasteners anywhere along its length), `grid` (a rectangular or triangular hole lattice, rows × columns or a disc) or `arc` (a partial bolt circle: count, angular pitch, start angle) |
| `Shaft` | `shaft: output/input/bidirectional` | Motor shafts and hollow outputs (output), hubs, pulleys, wheels and gearbox inputs (input), loose shafts, spacers and couplers (bidirectional); `gender` shaft or bore, `profile` round, hex, rounded_hex, d_cut, double_d, keyed, spline or square; `clampsOn` for a round bore that goes over another profile and clamps on it (a collar on a hex shaft) |
| `Gear` | `gear_mesh: mesh` | Gear teeth: `kind` spur, helical, internal, rack, bevel, worm, worm_wheel; `moduleMm` or `diametralPitch`, `pressureAngleDeg`, `teeth`, `faceWidthMm`; the bore is a `Shaft` |
| `Bearing` / `BearingSeat` | `bearing_fit: bearing/seat` (+ a `Shaft` bore) | Ball, roller, needle, thrust and plain bearings (bore, OD, width, flange, ratings) and the housing bores that hold them (OD, depth, retention) |
| `Thread` | `thread: external/internal` | Screws, bolts, set screws, studs, threaded rod (external); nuts, tapped holes, heat-set inserts (internal); designation, diameter, pitch or TPI, length, hand, lock |
| `TSlot` | `t_slot: track/insert` | An extrusion's or rail's undercut slot (opening, channel, length) and the T-nut, screw head or carriage foot that slides in it (neck, head) |
| `AxialFace` | `axial_stop: face` | The end faces of spacers, collars, hubs and bearing rings along a shaft (face OD and ID, what it turns with) |
| `Wheel` / `RollingSurface` | `rolling_contact: wheel/surface` | Traction, omni, mecanum, caster, pneumatic wheels and rollers (diameter, tread, rollers, hand, load); floors, tiles, rails |
| `LinearMotion` | `linear_motion: output/input` | The moving member of a linear actuator, lead screw or slide (output) and the load it drives (input), with stroke, lead, thread pitch, force and speed |
| `PCIe` | `pcie_lane`, `pcie_refclk`, `digital` leaves + `pcie: root/endpoint` | PCIe ports: root ports, slots, sockets and FFCs (root), cards, SSDs and switch upstream ports (endpoint); `lanes`, `generation`, optional lane, REFCLK, PERST#, CLKREQ#, WAKE# pins |
| `M2` | `m2: socket/card` | M.2 sockets and card edges; `key`, `sizes`, `carries` (pcie, sata, usb2, usb3, sdio, uart, i2c, i2s, pcm, cnvi...), `pcie` lanes and generation |
| `CSI2` / `DSI` | `mipi_dphy` leaves + `mipi_csi2` / `mipi_dsi: transmitter/receiver` | Cameras (CSI-2 transmitter) and host camera ports (receiver); host display ports (DSI transmitter) and displays (receiver); `lanes`, `laneModes`, `laneRateMbps`, D-PHY clock and data pairs |
| `Ethernet` | `ethernet_mdi` leaves + `ethernet: port` | RJ45 jacks, PHY MDI pins, fibre ports; `speedsMbps`, `medium`, MDI pairs a–d, `poe` (PSE or PD, 802.3af/at/bt or passive, power, class), `fiber` (mode, wavelengths) |
| `SFP` | `sfp: cage/module` | SFP / SFP+ / QSFP cages and module edges; the module's line side is an `Ethernet` port |
| `I2S` / `PCM` | `digital` leaves + `i2s: controller/target` | Digital audio ports: `clockRole`, `direction` (out, in, duplex), `formats`, BCLK, WS, DOUT, DIN, MCLK, sample rate, bit depth, channels |
| `DVP` | `digital` leaves + `dvp: camera/host` | Parallel camera bus (OV2640 and kin); data pins MSB first, PCLK, VSYNC, HREF, XCLK |
| `SDCard` | `digital` leaves + `sd_card: host/card` | SD and microSD slots, SDMMC peripherals (host), memory cards and SDIO devices (card); `form`, `modes`, `capacityClasses` |
| `USB` | `usb_signal` leaves + `usb: host/device/dual_role` | USB data ports: `speeds`, D+/D−, SuperSpeed pairs, CC; VBUS is `PowerIn`/`PowerOut` |
| `WiFi` / `Bluetooth` / `IEEE802154` | `wifi: client/access_point/peer`, `bluetooth: central/peripheral/peer/broadcaster/observer`, `ieee802154: node` (network domain) | Radios: `bands`, Wi-Fi `standards`, Bluetooth `version` and `modes` (classic, le), 802.15.4 `stacks` (zigbee, thread, matter, raw) and Zigbee/Thread roles; `radio` names the `rf` antenna interface |
| `Led` / `LedDrive` / `ledTrait` | `passive` terminals + `led_drive: anode/cathode/sink/source` | Two-terminal LEDs (`Led`), LED driver channels (`LedDrive` role driver, mode sink or source), the `led` trait on any LED part or display |
| `RelayCoil` / `RelayContacts` / `relayTrait` | `passive` terminals | Relay coil and contact pins (capabilities `relay_coil_plus`, `relay_com`, `relay_no`, `relay_nc`) and the `relay` trait (form, coil, contact ratings) |
| `storageTrait` | trait | Memory chips, eMMC, memory cards, SSDs: medium, `capacity_bytes`, interfaces, endurance |
| `RS485` | `rs485_signal` leaves + `rs485: node` | RS-485 ports, half duplex (A/B) or full duplex (Y/Z driver, A/B receiver), bit rate, termination, the protocol carried |
| `RS232` | `rs232_signal` leaves + `rs232: dte/dce` | RS-232 ports at line levels (TXD, RXD, RTS, CTS, DTR, DSR, DCD, RI named from the DTE) |
| `SWD` | `digital` leaves + `swd: target/probe` | Arm debug ports: SWDIO, SWCLK, SWO, nRESET, VTref |
| `PPM` | `digital` leaf + `ppm: output/input` | CPPM streams from receivers and into flight controllers: channels, frame rate, polarity |
| `InfraredRemote` | `ir_remote: transmitter/receiver` (network domain) | IR remotes and demodulating receivers: carrier kHz, wavelength, coding protocols |
| `AcPower` | `ac_power: input/output` | Mains inlets and plugs (input), outlets and UPS outputs (output): V RMS, line frequency, current, power, plug, earth |
| `InductiveLoad` / `InductiveDrive` | `inductive_load: load/driver` | Solenoid, valve, brake and clutch coils (rated voltage, coil current or resistance, suppression) and the channels that switch them (low side, high side, H-bridge, relay; current; flyback) |
| `Connector` | `connector: mate` + `p1…pN` slots | A physical connector with several positions (PB-805); binds each position to a pad |
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
input: the least current its source must be rated for), `lane_count`,
`pcie_generation`, `lane_rate` (Mbit/s per lane), `link_speed` (Mbit/s),
`poe_power` (W), `sample_rate` (Hz), `bit_depth`, `channel_count`,
`bus_width`, `rf_band` (MHz, on `rf` interfaces), `wavelength` (nm),
`led_current` (mA), `forward_voltage` (V), `hole_pitch_y` (mm),
`angular_pitch` (deg), `gear_module` (mm), `pressure_angle` (deg),
`tooth_count`, `face_width` (mm), `bearing_od`, `bearing_bore`,
`bearing_width` and `seat_depth` (mm), `thread_length` (mm),
`slot_opening`, `channel_width`, `channel_depth`, `neck_width`,
`head_width` and `head_height` (mm), `face_od`, `face_id` and
`axial_length` (mm), `wheel_diameter` and `tread_width` (mm),
`load_rating` (N), `line_frequency` (Hz), `ir_carrier` (kHz),
`coil_current` (A), `coil_resistance` (Ω).

The drive and signal checks compare their own parameters, so the overlap
check skips them for those pairs (`driveCheckedParams`,
`signalCheckedParams`): two gears' modules and tooth counts, a bearing's and
a seat's diameters, two threads, a track and an insert, two faces, a wheel
and a surface, PPM channel counts, IR carriers and wavelengths, coil
currents. `load_rating` and `coil_current` are capacities.

`link_speed`, `lane_rate`, `bus_width`, `poe_power` and `wavelength` are
not range-checked either: `checkPairLinks` compares them (see below).

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
- `pcie` root ↔ endpoint; `m2` socket ↔ card; `mipi_csi2` and `mipi_dsi`
  transmitter ↔ receiver; `ethernet` port ↔ port; `sfp` cage ↔ module;
  `i2s` controller ↔ target (and the older master ↔ slave); `dvp` camera ↔
  host; `sd_card` host ↔ card; `usb` host ↔ device, dual_role with either,
  the older bidirectional with all; `led_drive` sink ↔ cathode, source ↔
  anode; `wifi` client ↔ access_point, peer ↔ peer; `bluetooth` central ↔
  peripheral, broadcaster ↔ observer, peer with central, peripheral and
  peer; `ieee802154` node ↔ node.
- `gear_mesh` mesh ↔ mesh; `bearing_fit` bearing ↔ seat; `thread` external
  ↔ internal; `t_slot` track ↔ insert; `axial_stop` face ↔ face;
  `rolling_contact` wheel ↔ surface; `rs485` node ↔ node (slots `a`/`b`, or
  `tx_p`/`tx_n` ↔ `rx_p`/`rx_n`); `rs232` dte and dce with either (straight
  or crossed by sub-role); `swd` probe ↔ target (generic fallback kept for
  older target leaves); `ppm` output ↔ input; `ir_remote` transmitter ↔
  receiver; `ac_power` input ↔ output; `inductive_load` driver ↔ load
  (`drive_plus` ↔ `coil_plus`, `drive_minus` ↔ `coil_minus`). Each composite's slots carry per-conductor
  sub-roles (`tx_p` ↔ `rx_p`, `bclk_out` ↔ `bclk_in`, `data_out` ↔
  `data_in`). None of these fall back to the generic pairs.

## Existing types in use

`power`, `digital`, `i2c`, `spi`, `uart`, `usb`, `analog`, `pwm`,
`interrupt`, `can`, `bluetooth`, `wifi`, `rf`, `i2s`, `jtag`, `swd`,
`pcie`, `m2`, `mipi_csi2`, `mipi_dsi`, `ethernet`, `sfp`, `dvp`, `sd_card`,
`led_drive`, `ieee802154`, `gear_mesh`, `bearing_fit`, `thread`, `t_slot`,
`axial_stop`, `rolling_contact`, `rs485`, `rs232`, `ppm`, `ir_remote`,
`ac_power`, `inductive_load`,
`mechanical_connection`, `mechanical_drive`, `mechanical_mount`,
`threaded_connection`, `thermal_connection`, `custom`, and a
few part-specific types. The older mechanical types
(`mechanical_connection`, `mechanical_mount`, `threaded_connection`) predate
`bolt_pattern`, `shaft` and `thread`. Use the new builders for new parts.

## Pair checks beyond parameters

`checkPairJoints` (`src/drc/joint-check.ts`) reports `fluid_joint_mismatch`,
`bolt_pattern_shape` (a cross against another shape), `bolt_pattern_line`
(rows and slots), `bolt_pattern_holes` (grids and arcs: the holes of one on
the other's), `shaft_fit` (shaft and bore genders and profiles, a clamped
bore), `linear_motion_capacity` and `supply_current_rating`.
`checkPairDrive` (`src/drc/drive-check.ts`) reports `gear_mesh`,
`bearing_fit`, `thread_fit`, `t_slot_fit`, `axial_face` and
`rolling_contact`. `checkPairSignals` (`src/drc/signal-check.ts`) reports
`rs485_duplex`, `rs232_null_modem`, `ppm_channels`, `ppm_polarity`,
`ir_link`, `ac_power` and `inductive_load`. See
[mechanical interfaces](../../../docs/mechanical-interfaces.md) and
[fluid ports](../../../docs/fluid-ports.md).

`checkPairLinks` (`src/drc/link-check.ts`) reports `link_width` (info),
`lane_rate`, `m2_key`, `m2_size`, `m2_interface`, `ethernet_speed`,
`ethernet_medium`, `fiber_mismatch`, `poe_power`, `sfp_form`,
`audio_format`, `audio_direction`, `dvp_width`, `sd_form`, `sd_mode`,
`sd_capacity`, `usb_speed`, `led_drive_current`, `wireless_band`,
`wireless_stack` and `zigbee_roles`. See
[links, buses and radios](../../../docs/links-and-buses.md).

## Not yet covered

Use `custom` with a trait, and log a `vocabulary` gap, for:

- video transmission links (e.g. a DJI camera-to-air-unit cable);
- RF antenna connectors (MMCX, U.FL): use `connectorTrait` on an `rf`
  interface;
- battery straps and zip-tie points;
- MSP / DisplayPort OSD: it runs over UART, so model it as `UART` and note
  the protocol in a `usage_note` trait;
- PDM microphones, S/PDIF, MQS and other audio outside I2S / PCM;
- Ethernet MAC-to-PHY buses (RMII, RGMII, MDIO) and NFC antennas;
- I3C, 3-wire SPI, PIO and peripherals routed through a GPIO matrix (no
  per-instance pin assignment);
- buzzers, speakers and other transducer drives; keypad matrices; push,
  slide and thumbstick actuators; optical apertures and gas inlets; seals and
  gaskets; battery charge ports (charge output on the cell's terminal);
- crystals as a `Passive` kind (use passive terminals and a `performance`
  trait);
- a part that holds two mated connectors together (a cable clip), strap and
  hook-and-loop joints, an adjustable offset inside one part (an indexable
  bracket), docking interfaces that carry phases, sensors and alignment
  together, and proprietary RC radio links (an `rf` interface with a
  `wireless` trait).
