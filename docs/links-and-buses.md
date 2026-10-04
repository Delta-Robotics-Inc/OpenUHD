# Links, buses and radios

UHD's builders for high-speed links, camera and display buses, audio ports,
Ethernet, memory cards and radios (PB-866), and the traits for LEDs, relays
and storage. Every builder lives in `src/protocols` and is exported from the
package root. Each section says what to call, what it emits, what pairs with
what, and what the pair check (`checkPairLinks`, `src/drc/link-check.ts`)
reports.

The link builders share one pattern (`src/protocols/link.ts`):

- **Pins are optional.** Give them on a chip or a connector whose pinout you
  model: each signal is an inline `SignalSpec` (`{ pin, name?, voltageV? }`)
  that becomes a leaf, or the id of a leaf you declared already. A port
  without pins is a logical port and pairs as a whole.
- **Each conductor is a slot with its own sub-role** under the link's
  protocol (`tx_p` ↔ `rx_p`, `bclk_out` ↔ `bclk_in`), so two ports pair
  conductor by conductor and never cross a clock with a data line. Slots of
  one direction pair in declaration order, which the builders keep the same
  on both sides (lane 0 first, + before −).
- **Negotiated parameters are not range-checked.** Lane counts and PCIe
  generations are stated as `[1, n]` so they always overlap; link speeds,
  lane rates, bus widths, PoE power and fibre wavelengths are compared by
  `checkPairLinks` instead (`LINK_CHECKED_PARAMS`).

Every protocol below has its own role table in `src/matching/roles.ts`
with no generic fallback: only the pairs listed pair.

## PCIe

```ts
PCIe({
  role: "root",                    // or "endpoint"
  lanes: 1, generation: 2,         // x1, highest generation 2
  laneSignals: [{ tx: [{ pin: 3 }, { pin: 4 }], rx: [{ pin: 6 }, { pin: 7 }] }],
  refclk: [{ pin: 9 }, { pin: 10 }],
  perst: { pin: 12 }, clkreq: { pin: 13 }, wake: { pin: 14 },
  sidebandVoltageV: 3.3,
})
```

- Protocol `pcie`, role `root` (a root port, a switch's downstream port, the
  host side of a slot, socket or FFC) or `endpoint` (a card, an SSD, a
  switch's upstream port). Root pairs with endpoint only.
- Parameters `lane_count` [1, lanes] and `pcie_generation` [1, highest];
  capabilities `pcie`, `pcie_gen<g>`, `pcie_x<n>`.
- Lane pairs are named from this side: `tx` is what it transmits (PETp/PETn),
  `rx` what it receives (PERp/PERn). Leaves are `pcie_lane`
  transmitter/receiver; REFCLK is `pcie_refclk` source/sink (the root sends
  it unless `refclkFrom: "endpoint"`); PERST# runs from the root, CLKREQ# and
  WAKE# from the endpoint, as `digital` leaves.
- Check: `link_width` (info) states what the link trains at when it is
  narrower or older than either end.
- A PCIe switch (on a two-SSD adapter, say) is an endpoint toward its host and a
  root on each downstream port.

## M.2

```ts
M2({ role: "socket", key: "M", sizes: ["2230", "2242", "2280"], carries: ["pcie"], pcie: { lanes: 1, generation: 2 }, socket: 3 })
M2({ role: "card", key: "M", sizes: ["2280"], carries: ["pcie"], pcie: { lanes: 4, generation: 3 } })
M2({ role: "card", key: ["B", "M"], sizes: ["2280"], carries: ["sata"] })
```

- Protocol `m2`, role `socket` or `card`; trait `m2` (`key`, `sizes`,
  `carries`, `socket`). A socket has one key; a card lists the notches it is
  cut for. `sizes` is width and length in mm: the card's own, or every
  length the socket has a standoff for.
- Checks: `m2_key` (the card's keys do not include the socket's), `m2_size`
  (no standoff for the card's length), `m2_interface` (nothing carried in
  common: a SATA SSD in an NVMe-only socket), `link_width` (info) when both
  carry PCIe.
- The socket's pins, where a part routes them, are a `PCIe` (or `I2S`,
  `UART`...) composite on the same leaves. The screw that holds the card is a
  `BoltPattern`.

## MIPI CSI-2 and DSI

```ts
CSI2({ role: "transmitter", lanes: 2, laneRateMbps: 1500, clock: [{ pin: 4 }, { pin: 5 }], data: [[{ pin: 1 }, { pin: 2 }], [{ pin: 7 }, { pin: 8 }]] }) // a camera
CSI2({ role: "receiver", lanes: 4, laneRateMbps: 1500 })                                    // a host's camera port, no pins
DSI({ role: "transmitter", lanes: 2 })                                                       // a host's display port
```

- Protocols `mipi_csi2` and `mipi_dsi`, role `transmitter` or `receiver`
  (camera → host on CSI-2, host → display on DSI). CSI-2 and DSI never pair
  with each other.
- `lane_count`: a receiver runs [1, lanes]; a transmitter runs the counts in
  `laneModes` (default exactly `lanes`). The parameter check refuses a
  4-lane-only camera on a 2-lane port; give `laneModes: [2, 4]` when the
  sensor has a 2-lane mode. `link_width` (info) says how many lanes run.
- `lane_rate` (Mbit/s per lane): a transmitter faster than the receiver is a
  warning (`lane_rate`).
- D-PHY pins are a clock pair and data pairs, lane 0 first (leaves
  `mipi_dphy`). C-PHY ports (`phy: "c-phy"`) take no pins; `lanes` counts
  trios.
- A camera's control bus (CCI) is its own `I2C` interface. A connector that
  is camera or display (Raspberry Pi 5) declares a `CSI2` receiver and a
  `DSI` transmitter over the same leaves: build the first, then pass its leaf
  ids as the second's pins.

## Ethernet, PoE and SFP

```ts
Ethernet({
  speedsMbps: [10, 100, 1000],
  pairs: { a: [{ pin: 1 }, { pin: 2 }], b: [{ pin: 3 }, { pin: 6 }], c: [{ pin: 4 }, { pin: 5 }], d: [{ pin: 7 }, { pin: 8 }] },
  poe: { role: "pd", standard: "802.3at", class: 4, powerW: 25.5, voltageV: [42.5, 57], required: true },
})
Ethernet({ id: "fiber", speedsMbps: [1000], medium: "fiber", fiber: { mode: "single_mode", txNm: 1310, reachM: 20000 } })
SFP({ role: "cage", form: "sfp", speedsMbps: [1000] })
```

- Protocol `ethernet`, role `port`: any two ports pair (auto MDI-X or the
  cable crosses the pairs). Trait `ethernet` (`medium`, `speeds_mbps`,
  `auto_mdix`, `fiber`); parameter `link_speed` [slowest, fastest].
- Copper MDI pairs: `a` and `b` (TD±, RD± on 10/100), plus `c` and `d` at
  1000BASE-T and faster (BI_DA … BI_DD; the builder requires them). Leaves
  are `ethernet_mdi`. The RJ45 is a `connectorTrait` on the port. The MAC
  side of a PHY (RMII, RGMII) is not modelled.
- PoE: `poe` adds a `poe` trait, `poe_power` (W: what a PSE gives per port,
  what a PD draws at most) and the port `voltage`. `required: true` on a PD
  that has no other supply.
- Fibre: `medium: "fiber"` with `fiber` (mode, transmit and receive
  wavelengths, strands, reach); the LC duplex connector is a
  `connectorTrait`. A media converter has a copper port and a fibre port.
- `SFP`: protocol `sfp`, role `cage` or `module`, trait `sfp` (`form`,
  `speeds_mbps`). A module's line side (its optics or RJ45) is an `Ethernet`
  port of its own.
- Checks: `ethernet_speed` (no speed in common: error; the speed they link
  at, when lower than either end's fastest: info), `ethernet_medium` (copper
  against fibre), `fiber_mismatch` (mode, strands, or wavelengths that do
  not cross over: a 1310/1550 BiDi needs a 1550/1310 partner), `poe_power`
  (a PD drawing more than the PSE gives: error; passive PoE against an 802.3
  end: warning; a PoE-only PD on a port with no PoE: warning), `sfp_form`
  (an SFP-family module in a QSFP cage).

## I2S and PCM

```ts
I2S({ clockRole: ["controller", "target"], direction: "duplex", bclk: "gpio_26", ws: "gpio_25", dout: "gpio_22", din: "gpio_35", sampleRateHz: [8000, 96000], bitDepth: [16, 32] }) // an MCU
I2S({ clockRole: "target", direction: "in", bclk: { pin: 16 }, ws: { pin: 1 }, din: { pin: 14 }, sampleRateHz: [8000, 96000], bitDepth: [16, 32] })                  // an I2S amplifier
PCM({ clockRole: "controller", direction: "duplex", formats: ["pcm_short_frame"] })                                                                                   // a Bluetooth module's PCM port
```

- Protocol `i2s` for I2S, left/right-justified, TDM and PCM. Roles are clock
  roles: `controller` drives BCLK and WS, `target` takes them; a port that
  can be either lists both (its clock pins become bidirectional). The older
  `master` / `slave` roles pair with them.
- `direction` is the audio data direction: `out` sends (MCU → DAC), `in`
  receives (microphone → MCU), `duplex` both. Slots pair BCLK and WS out to
  in, DOUT to DIN, MCLK out to in.
- Trait `audio_port` (`direction`, `formats`); parameters `sample_rate`,
  `bit_depth`, `channel_count` must overlap.
- Checks: `audio_format` (no frame format in common, e.g. PCM against I2S),
  `audio_direction` (both only send or both only receive).
- PDM microphones are not I2S and are not covered yet.

## DVP (parallel camera bus)

```ts
DVP({
  role: "camera", dataWidth: 10,
  data: [{ pin: "Y9" }, { pin: "Y8" }, /* … MSB first … */ { pin: "Y0" }],
  pclk: { pin: "PCLK" }, vsync: { pin: "VSYNC" }, href: { pin: "HREF" }, xclk: { pin: "XCLK" },
  pclkHz: [6e6, 36e6],
})
```

- Protocol `dvp`, role `camera` or `host`. The camera drives data, PCLK,
  VSYNC and HREF; the host drives XCLK. PWDN and RESET are ordinary `Pin`s;
  SCCB is an `I2C` interface.
- **Data pins are given MSB first.** Slots pair in that order, so a 10-bit
  camera on an 8-bit host lands D9..D2 on D7..D0 (the usual wiring). The top
  eight data slots are required.
- Parameters `bus_width` and `clock_freq` (pixel clock, must overlap).
  Check `dvp_width`: a narrower host is a warning (it takes the upper bits),
  a wider one info.

## SD cards and SDIO

```ts
SDCard({ role: "host", form: "microsd", modes: ["spi", "sd_1bit", "sd_4bit"], capacityClasses: ["sdsc", "sdhc", "sdxc"], clk: { pin: 5 }, cmd: { pin: 3 }, dat: [{ pin: 7 }, { pin: 8 }, { pin: 1 }, { pin: 2 }], cd: { pin: 9 } })
SDCard({ role: "card", form: "microsd", modes: ["spi", "sd_4bit", "uhs_i"], capacityClasses: ["sdhc"] })
```

- Protocol `sd_card`, role `host` (a slot on a board, an MCU's SDMMC
  peripheral) or `card` (a memory card, an SDIO device). Trait `sd_card`
  (`form`, `modes`, `capacity_classes`).
- Slots: CLK from the host, CMD and DAT0..3 both ways; CD is the slot's
  card-detect switch. In SPI mode CMD is MOSI, DAT0 MISO, DAT3 CS.
- Checks: `sd_form` (microSD against SD), `sd_mode` (no bus mode in common),
  `sd_capacity` (a card class the host does not read: SDXC in an SDHC-only
  slot).

## USB

```ts
USB({ role: "device", speeds: ["full"], dp: { pin: "D+" }, dm: { pin: "D-" } })
USB({ role: "dual_role", speeds: ["low", "full", "high", "super"], dp: "pin_a6", dm: "pin_a7", superSpeed: [{ tx: ["pin_a2", "pin_a3"], rx: ["pin_b11", "pin_b10"] }], cc: ["pin_a5", "pin_b5"] })
```

- Protocol `usb` (the type parts already used), role `host`, `device` or
  `dual_role`; parts that used `bidirectional` keep pairing with all three.
  Trait `usb` (`speeds`).
- Slots: D+ to D+, D− to D−, SuperSpeed TX to RX, CC to CC. VBUS is a
  `PowerIn` / `PowerOut`; the receptacle is a `connectorTrait`.
- Check `usb_speed`: no speed in common is an error; the fallback speed,
  when below either end's fastest, is info.

## Wireless

```ts
WiFi({ standards: ["b", "g", "n"], bands: ["2.4GHz"], roles: ["client", "access_point"], radio: "antenna" })
Bluetooth({ version: "5.0", modes: ["le"], roles: ["central", "peripheral"] })
IEEE802154({ stacks: ["zigbee", "thread", "matter"], zigbeeRoles: ["coordinator", "router", "end_device"], threadRoles: ["router", "end_device"] })
```

- Domain `network`, protocols `wifi` (`client` ↔ `access_point`, `peer` ↔
  `peer`), `bluetooth` (`central` ↔ `peripheral`, `broadcaster` ↔
  `observer`, `peer` with central, peripheral and peer) and `ieee802154`
  (`node` ↔ `node`). Trait `wireless` (`standard`, `bands`, `stacks`,
  `radio`, `tx_power_dbm`, `sensitivity_dbm`, `version`, Zigbee and Thread
  roles). Bands are `WIRELESS_BANDS` keys; Wi-Fi bands default from b/g
  (2.4 GHz) and a/ac (5 GHz); give them for n, ax and be.
- The antenna or antenna connector is an `rf` interface with a
  `connectorTrait` (U.FL, SMA); name it in `radio`.
- Checks: `wireless_band` (no band in common), `wireless_stack` (Bluetooth
  Classic against LE-only, Zigbee against Thread), `zigbee_roles` (two
  end-device-only Zigbee radios: warning).

## LEDs

```ts
Led({ id: "red-0603-led", name: "Red LED, 0603", emitter: { color: "red", wavelength_nm: 625, wavelength_kind: "dominant", forward_voltage_V: [1.8, 2.4], test_current_mA: 20, max_current_mA: 30 }, pins: { anode: 2, cathode: 1 }, viewing_angle_deg: 120 })
LedDrive({ role: "driver", mode: "sink", output: "pin_led1_drv", currentmA: [0, 124] })                 // an LED driver channel
traits: [ledTrait({ kind: "rgb", common: "anode", emitters: [{ color: "red", … }, { color: "green", … }, { color: "blue", … }] })]
```

- `Led()` builds a two-terminal LED: `anode` and `cathode` passive
  terminals (they sit on board nets), the drive composites `led_anode` and
  `led_cathode`, the `led` trait and category `component.led`.
- `LedDrive`: protocol `led_drive`. On an LED, one composite per terminal
  (roles `anode`, `cathode`), because a driver reaches one side and the
  other goes to a supply. On a driver channel, one composite with role
  `sink` (pulls the cathode) or `source` (feeds the anode). `sink` pairs with
  `cathode`, `source` with `anode`, on boards over nets too.
- `led_current` (mA): [0, max] on the LED, the settable range on the
  driver; they must overlap, and a driver settable above the LED's maximum
  is a warning (`led_drive_current`).
- Multi-emitter packages, addressable LEDs and displays use `ledTrait` with
  one emitter per colour or segment colour (`kind` `rgb`, `rgbw`,
  `bicolor`, `addressable` with `driver: "WS2812B"`, `seven_segment`,
  `matrix`...), and their pins through `pinTable` plus `LedDrive({ role:
  "led", … })` per terminal a driver reaches. An addressable LED's data in
  and out are digital pins.

## Relays

```ts
traits: [relayTrait({ kind: "electromechanical", form: "1C", coil: { voltage_V: 5, resistance_ohm: 70, must_operate_V: 3.75, must_release_V: 0.5 }, contacts: { ratings: [{ voltage_V: 250, current_A: 10, current: "ac", load: "resistive" }, { voltage_V: 30, current_A: 10, current: "dc" }] }, operate_time_ms: 10, isolation_V: 1500 })]
interfaces: [...RelayCoil({ plus: 1, minus: 5 }), ...RelayContacts({ pole: 1, com: 2, no: 4, nc: 3 })]
```

- `relayTrait` reads poles and throws from `form` ("1A" SPST-NO, "1B"
  SPST-NC, "1C" SPDT, "2C" DPDT); a solid-state relay is form A or B. The
  coil holds the nominal voltage (an SSR's input range), resistance,
  must-operate and must-release voltages; `contacts.ratings` holds every
  rating row the datasheet prints (voltage, current, AC or DC, load kind).
- `RelayCoil` and `RelayContacts` declare passive terminals with
  capabilities `relay_coil_plus`, `relay_coil_minus`, `relay_com`,
  `relay_no`, `relay_nc` (ids `coil_plus`, `p1_com`, `p1_no`...). A relay
  module adds its logic input as a `Pin` and its supply as `PowerIn`, and
  its screw terminals are the contact terminals with a `connectorTrait`.
- Category `component.relay`.

## Storage

```ts
traits: [storageTrait({ medium: "fram", capacity_bytes: 32768, organization: "32K × 8", interfaces: ["i2c"] })]
traits: [storageTrait({ medium: "ssd", capacity_bytes: 500e9, interfaces: ["nvme"], form_factor: "M.2 2280", endurance: { tbw: 300 } })]
```

- `storageTrait` checks a positive whole `capacity_bytes` (a 256 Kbit chip
  is 32768) and at least one interface; `volatile` follows the medium
  (SRAM, PSRAM, DRAM) unless given.
- The interfaces themselves are the part's builders: `SPI` / `I2C` on a
  memory chip, `SDCard` on a card, `M2` (with `PCIe`) on an SSD.
- Categories `component.storage.memory`, `.memory_card`, `.ssd` (taxonomy
  1.2.0).

## Serial links: RS-485, RS-232, SWD, PPM

`src/protocols/serial.ts`; pair checks in `checkPairSignals`
(`src/drc/signal-check.ts`). They follow the link pattern above: optional
pins, one slot per conductor with its own sub-role.

**RS-485.** `RS485({ duplex, a, b, y, z, ground, bitRateBps, termination,
failSafeBias, carries })`: protocol `rs485`, role `node` (every node pairs
with every other). Half duplex (the default) has slots `a` and `b`, which
pair A to A and B to B; full duplex has the driver pair Y/Z as `tx_p`/`tx_n`
and the receiver pair A/B as `rx_p`/`rx_n`, which pair one side's driver
with the other's receiver. Leaves have protocol `rs485_signal` and
capabilities `rs485_a`, `rs485_b`, `rs485_y`, `rs485_z`. Manufacturers
disagree on which line is "A": follow the part's labels and say so in
`note`. `carries` names the protocol on top (Modbus RTU, REV's expansion
bus). The pair check `rs485_duplex` (error) refuses half duplex against full
duplex.

**RS-232.** `RS232({ role, txd, rxd, rts, cts, dtr, dsr, dcd, ri, ground,
baudRate, levelsV, connector })`: protocol `rs232`, role `dte` (a computer
or controller port) or `dce` (a modem, most DB9-female devices). Signals
are named from the DTE's side on both, as the standard does, so each slot's
sub-role says which side drives it (`txd_out` on a DTE, `txd_in` on a DCE).
A DTE and a DCE pair straight through; two DTEs or two DCEs pair crossed
(TXD to RXD, RTS to CTS, DTR to DSR), and `rs232_null_modem` (warning) says
the cable must be a null modem. RS-232 does not pair with a logic-level
`UART`: put a level shifter (MAX3232) between them.

**SWD.** `SWD({ role, swdio, swclk, swo, nreset, vtref, ground, voltageV,
connector })`: protocol `swd`, role `target` (the chip or board) or `probe`
(the debugger). Slots `swdio` (both ways), `swclk` and `nreset` (probe out,
target in), `swo` (target out) and `vtref` (the target's reference, sensed
by the probe). The logic level is a `voltage` parameter: a 5 V target and a
1.2–3.6 V probe do not overlap. Older parts that gave SWD pins protocol
`swd` role `target` still pair with a probe.

**PPM.** `PPM({ role, signal, channels, frameRateHz, polarity, voltageV })`:
protocol `ppm`, role `output` (a receiver's PPM pin) or `input` (a flight
controller's PPM input), one `signal` slot. An output states how many
channels it sends, an input the range it decodes. `ppm_channels` (warning):
the input decodes fewer channels than the output sends. `ppm_polarity`
(error): positive pulses into an input that takes only negative ones, or the
reverse (`either` takes both).

## Infrared remotes

`InfraredRemote({ role, carrierKHz, protocols, wavelengthNm, rangeM,
electrical })` (`src/protocols/actuation.ts`): protocol `ir_remote`, role
`transmitter` (a remote, an IR LED driver) or `receiver` (a demodulating
receiver such as the VS1838B), network domain like the radios. Parameters
`ir_carrier` (kHz; a receiver states its centre or its pass band) and
`wavelength` (nm; a receiver states its sensitive band). `protocols` names
the coding (NEC, RC5, Sony SIRC); a demodulating receiver decodes none
itself, so it leaves them out. `electrical` names the leaf that carries the
demodulated output or drive input.

The pair check `ir_link`: a carrier outside the receiver's band by up to
10 % is a warning (it works at a shorter range), further off an error; an
emitter wavelength outside the receiver's band is a warning; coding
protocols with none in common, when both state them, an error.

## AC mains

`AcPower({ role, voltageV, frequencyHz, maxCurrentA, powerW, phases, earth,
plug, line, neutral, protectiveEarth })`: protocol `ac_power`, role `input`
(a mains inlet, a plug on a cord) or `output` (an outlet, a strip, a UPS),
separate from DC `power` so a mains inlet never pairs with a DC rail.
Parameters `voltage` (V RMS), `line_frequency` (Hz), `max_current` and, on
an input, `min_supply_power` (its rated input power, which the supply
budget counts). Voltage and frequency are compared as parameters
(100–240 V, 50/60 Hz against a 120 V, 60 Hz outlet overlaps; 400 V does
not). The trait has `phases`, `earth` and `plug`.

The pair check `ac_power`: a plug that does not go into the socket (error),
from the IEC 60320 pairs (a C14 inlet takes C13 and C15, C6 takes C5, C8
takes C7, C20 takes C19) and the NEMA ones (5-15R takes 1-15P and 5-15P);
an input that needs protective earth on an outlet without it (error).

## Switched inductive loads

`InductiveLoad({ kind, plus, minus, ratedVoltageV, coilCurrentA,
coilResistanceOhm, powerW, suppression, polarized, duty })`: a solenoid, a
pneumatic valve's coil, a brake or a clutch: protocol `inductive_load`,
role `load`, with `voltage`, `coil_current` (derived from the resistance
when only that is given; the trait says so) and `coil_resistance`, slots
`coil_plus` and `coil_minus`. `InductiveDrive({ switching, toPlus,
toMinus, voltageV, maxCurrentA, flyback, pwm })`: the channel that switches
it (a pneumatic hub's solenoid output, a valve driver), role `driver`, with
`voltage` and `max_current`, slots `to_plus` and `to_minus`; `switching` is
`low_side`, `high_side`, `h_bridge` or `relay`.

The pair check `inductive_load`: a coil that draws more than the channel
is rated for (error); a coil without suppression on a channel without a
flyback clamp (warning), or a channel that does not say (info); a polarised
coil (its diode or LED) on an H-bridge channel that can reverse it
(warning). The voltage is compared as a parameter.
