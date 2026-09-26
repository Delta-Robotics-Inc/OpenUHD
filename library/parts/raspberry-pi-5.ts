/**
 * Raspberry Pi 5 (Raspberry Pi Ltd) — datasheet-honest UHD part.
 *
 * Sources (see ./raspberry-pi-5/sources.json):
 *   - src_brief:         Raspberry Pi 5 product brief — https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-product-brief.pdf
 *   - src_drawing:       Raspberry Pi 5 mechanical drawing — https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-mechanical-drawing.pdf
 *   - src_schematic:     Raspberry Pi 5 reduced schematics (RP-008345-DS) — https://pip.raspberrypi.com/documents/RP-008345-DS
 *   - src_gpio_doc:      Raspberry Pi docs, GPIO and the 40-pin header — https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/gpio-on-raspberry-pi.adoc
 *   - src_pinout_image:  Raspberry Pi docs GPIO pinout diagram — https://raw.githubusercontent.com/raspberrypi/documentation/master/documentation/asciidoc/computers/raspberry-pi/images/GPIO-Pinout-Diagram-2.png
 *   - src_power_doc:     Raspberry Pi docs, power supplies — https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/power-supplies.adoc
 *   - src_cad:           Raspberry Pi 5 STEP (MIT) — https://datasheets.raspberrypi.com/rpi5/RaspberryPi5-step.zip
 *   - src_protopart:     ProtoPart raspberry-pi-5 definition (starting point only)
 *
 * Modelling notes:
 *   - One part for every RAM option (1/2/4/8/16 GB): same board and interfaces.
 *   - 40 leaves for the J8 header, pin 1 first (`pin` "J8-n"), mapped from
 *     the docs pinout diagram and the schematic's J8 labels (J2 in the
 *     schematic is the RUN / GLOBAL_EN power-button header, not modelled). GPIO are 3.3 V
 *     and not 5 V tolerant. `drive_current` 16 mA and the 50 mA combined limit
 *     are the docs' power-supply figures (not an RP1 datasheet table:
 *     data_gap). Every GPIO has edge/level interrupts; hardware PWM only on
 *     GPIO12/13/18/19 (software PWM on all pins, usage_note).
 *   - Composed: `i2c1` (GPIO2 SDA / GPIO3 SCL, fixed pull-ups), `id_eeprom`
 *     (GPIO0/1, reserved for HAT ID EEPROM), `uart0` (GPIO14 TX / GPIO15 RX),
 *     `spi0` (MOSI 10, MISO 9, SCLK 11, CE0 8; CE1 7 noted), `spi1` (MOSI 20,
 *     MISO 19, SCLK 21, CE0 18; CE1 17, CE2 16 noted). The I2C builder's
 *     default 400 kHz clock is dropped (no source states one).
 *   - Board ports from the product brief: USB-C power (5 V / 5 A with PD),
 *     2 x USB 3.0, 2 x USB 2.0 (host), Gigabit Ethernet (PoE+ with a HAT),
 *     2 x micro-HDMI, 2 x 4-lane MIPI camera/display, PCIe 2.0 x1, microSD,
 *     RTC battery, Wi-Fi 802.11ac, Bluetooth 5.0/BLE. Types with no builder
 *     (Ethernet, HDMI, MIPI, PCIe, microSD, RTC battery) are `custom` with a
 *     usage_note (vocabulary gap). Fan, UART debug, PoE and power-button
 *     (J2 RUN / GLOBAL_EN) connectors are not modelled (no usable pinout
 *     in the fetched sources).
 *   - Mounting: BoltPattern `mount`, 4 x M2.5 in Ø2.7 holes on 58 x 49 mm,
 *     3.5 mm from the edges (drawing + STEP). Rectangle, symmetryDeg omitted
 *     (the board cannot be rotated 180° in a HAT-standard stack).
 *   - ProtoPart discrepancies: no voltages, no mounting pattern, pins named
 *     only by function; manufacturer given as "Raspberry Pi Foundation" (the
 *     product is from Raspberry Pi Ltd). Corrected here (source_discrepancy).
 *   - Geometry: manufacturer STEP (MIT) bound by
 *     library/cad/py/catalog/raspberry-pi-5.py, used as published (no
 *     transform; PCB 0..85 x 0..56, bottom z ~ 0.03). The 77.6 MB STEP is
 *     not committed (> 5 MB). Which USB stack carries USB 3.0 is not
 *     established, so each USB port refs both stack faces (data_gap).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, Ground, I2C, Pin, PowerIn, SPI, UART, defineModule, maxCurrentA, voltageV } from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  brief: "https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-product-brief.pdf",
  drawing: "https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-mechanical-drawing.pdf",
  schematic: "https://pip.raspberrypi.com/documents/RP-008345-DS",
  gpio: "https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/gpio-on-raspberry-pi.adoc",
  pinout: "https://raw.githubusercontent.com/raspberrypi/documentation/master/documentation/asciidoc/computers/raspberry-pi/images/GPIO-Pinout-Diagram-2.png",
  power: "https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/power-supplies.adoc",
  cad: "https://datasheets.raspberrypi.com/rpi5/RaspberryPi5-step.zip",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/raspberry-pi-5/definition.json",
} as const;

const note = (text: string, source: string | string[]): TraitDef => ({ type: "usage_note", params: { note: text, source } });
const fn = (description: string, extra: TraitDef[] = []): TraitDef[] => [
  { type: "pin_functions", params: { description, source: [SRC.pinout, SRC.schematic, SRC.gpio] } },
  ...extra,
];

// ---------------------------------------------------------------------------
// J8 40-pin header, pin 1 first
// ---------------------------------------------------------------------------

type Row = ["3v3" | "5v" | "gnd"] | [number, string?];
const HEADER: Row[] = [
  ["3v3"], ["5v"], [2, "SDA"], ["5v"], [3, "SCL"], ["gnd"], [4, "GPCLK0"], [14, "TXD"], ["gnd"], [15, "RXD"],
  [17], [18, "PCM_CLK"], [27], ["gnd"], [22], [23], ["3v3"], [24], [10, "MOSI"], ["gnd"],
  [9, "MISO"], [25], [11, "SCLK"], [8, "CE0"], ["gnd"], [7, "CE1"], [0, "ID_SD"], [1, "ID_SC"], [5], ["gnd"],
  [6], [12, "PWM0"], [13, "PWM1"], ["gnd"], [19, "PCM_FS"], [16], [26], [20, "PCM_DIN"], ["gnd"], [21, "PCM_DOUT"],
];
const HW_PWM = new Set([12, 13, 18, 19]);
const CAPS: Record<number, Parameters<typeof Pin>[0]["capabilities"]> = {
  2: { i2cSda: true }, 3: { i2cScl: true }, 0: { i2cSda: true }, 1: { i2cScl: true },
  14: { uartTx: true }, 15: { uartRx: true },
  10: { spiMosi: true }, 9: { spiMiso: true }, 11: { spiSck: true }, 8: { spiSs: true }, 7: { spiSs: true },
  20: { spiMosi: true }, 19: { spiMiso: true }, 21: { spiSck: true }, 18: { spiSs: true }, 17: { spiSs: true }, 16: { spiSs: true },
};

let n3v3 = 0;
let n5v = 0;
let ngnd = 0;
const headerPins: InterfaceDef[] = HEADER.map((row, k) => {
  const pin = `J8-${k + 1}`;
  if (row[0] === "3v3") {
    n3v3 += 1;
    return { ...PowerIn({ id: `3v3_${n3v3}`, name: "3V3 power", pin, voltageV: 3.3 }), protocols: [{ type: "power", roles: ["output"] }], traits: fn("3V3 power") };
  }
  if (row[0] === "5v") {
    n5v += 1;
    return {
      ...PowerIn({ id: `5v_${n5v}`, name: "5V power", pin, voltageV: 5 }),
      protocols: [{ type: "power", roles: ["input", "output"] }],
      traits: fn("5V power", [note("Connected to the 5 V supply rail; usable as a 5 V output or (with care) as a supply input. No current budget is stated for Pi 5.", [SRC.pinout, SRC.power])]),
    };
  }
  if (row[0] === "gnd") {
    ngnd += 1;
    return { ...Ground({ id: `gnd_${ngnd}`, name: "Ground", pin }), traits: fn("Ground") };
  }
  const [gpio, alt] = row as [number, string?];
  const base = Pin({
    id: `gpio${gpio}`,
    name: alt ? `GPIO ${gpio} (${alt})` : `GPIO ${gpio}`,
    pin,
    voltageV: 3.3,
    driveCurrentmA: 16,
    capabilities: { interrupt: true, pwm: HW_PWM.has(gpio), ...(CAPS[gpio] ?? {}) },
  });
  const extra: TraitDef[] = [];
  if (gpio === 2 || gpio === 3) extra.push(note("GPIO2 and GPIO3 have fixed pull-up resistors.", SRC.gpio));
  if (gpio === 0 || gpio === 1) extra.push(note("Reserved for the HAT ID EEPROM (EEPROM Data GPIO0, Clock GPIO1).", SRC.gpio));
  return { ...base, capabilities: [...(base.capabilities ?? []), `gpio${gpio}`], traits: fn(alt ? `GPIO ${gpio} (${alt})` : `GPIO ${gpio}`, extra) };
});

// ---------------------------------------------------------------------------
// Board ports
// ---------------------------------------------------------------------------

const port = (id: string, name: string, type: string, roles: string[], description: string, extra: Partial<InterfaceDef> = {}): InterfaceDef => ({
  id,
  name,
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type, roles }],
  traits: [note(description, SRC.brief)],
  ...extra,
});

const usbC: InterfaceDef = {
  ...PowerIn({ id: "usb_c_power", name: "USB-C power (5 V / 5 A, PD)", voltageV: 5.1, maxCurrentA: 5 }),
  traits: [
    { type: "connector", params: { connector_type: "usb_c", gender: "receptacle", note: "5V/5A DC power via USB-C, with Power Delivery support (brief).", source: SRC.brief } },
    note("Use a 5.1 V supply; 5.0 A (27 W USB-C PSU) is recommended. With a 5 A supply the board allows 1.6 A to downstream USB, otherwise 600 mA. Typical bare-board active current 800 mA.", SRC.power),
  ],
};

const usbHost = (id: string, name: string, gen: string): InterfaceDef =>
  port(id, name, "usb", ["host"], `${gen} host port (brief: '2 × USB 3.0 ports, supporting simultaneous 5Gbps operation', '2 × USB 2.0 ports').`, {
    parameters: [voltageV(5)],
    traits: [
      note(`${gen} host port (brief). Downstream USB current is 1.6 A total with a 5 A supply, 600 mA otherwise.`, [SRC.brief, SRC.power]),
      { type: "connector", params: { connector_type: "usb_a", gender: "receptacle" } },
    ],
  });

const ports: InterfaceDef[] = [
  usbC,
  usbHost("usb3_0", "USB 3.0 port 0", "USB 3.0"),
  usbHost("usb3_1", "USB 3.0 port 1", "USB 3.0"),
  usbHost("usb2_0", "USB 2.0 port 0", "USB 2.0"),
  usbHost("usb2_1", "USB 2.0 port 1", "USB 2.0"),
  port("ethernet", "Gigabit Ethernet (RJ45)", "custom", ["peer"], "Gigabit Ethernet, with PoE+ support (requires separate PoE+ HAT); PoE+ is IEEE 802.3at. Custom type: no Ethernet vocabulary.", {
    traits: [note("Gigabit Ethernet, with PoE+ support (requires separate PoE+ HAT); PoE+ is IEEE 802.3at. Custom type: no Ethernet vocabulary.", [SRC.brief, SRC.power]), { type: "connector", params: { connector_type: "rj45", gender: "receptacle" } }],
  }),
  port("hdmi0", "micro-HDMI 0", "custom", ["source"], "Dual 4Kp60 HDMI display output with HDR support (micro-HDMI). Custom type."),
  port("hdmi1", "micro-HDMI 1", "custom", ["source"], "Dual 4Kp60 HDMI display output with HDR support (micro-HDMI). Custom type."),
  port("mipi0", "MIPI camera/display 0 (4-lane)", "custom", ["peer"], "4-lane 1.5 Gbps MIPI transceiver, camera or display. Custom type; connector pinout not modelled."),
  port("mipi1", "MIPI camera/display 1 (4-lane)", "custom", ["peer"], "4-lane 1.5 Gbps MIPI transceiver, camera or display. Custom type; connector pinout not modelled."),
  port("pcie", "PCIe 2.0 x1", "custom", ["host"], "Single-lane PCI Express 2.0 (requires separate M.2 HAT or other adapter). Custom type."),
  port("microsd", "microSD card slot", "custom", ["host"], "microSD card slot, with support for high-speed SDR104 mode. Custom type."),
  port("rtc_battery", "RTC battery connector", "custom", ["input"], "Real-time clock (RTC), powered from external battery. Custom type; battery spec not in the fetched sources."),
  { ...port("wifi", "Wi-Fi 802.11ac (dual-band)", "wifi", ["client", "access_point"], "Dual-band 802.11ac Wi-Fi."), domain: "network" },
  { ...port("bluetooth", "Bluetooth 5.0 / BLE", "bluetooth", ["peer"], "Bluetooth 5.0 / Bluetooth Low Energy (BLE)."), domain: "network" },
];

// ---------------------------------------------------------------------------
// Composed buses
// ---------------------------------------------------------------------------

const noClock = (list: InterfaceDef[]) => list.map((i) => ({ ...i, parameters: (i.parameters ?? []).filter((p) => p.id !== "clock_freq") }));
const i2c1 = noClock(I2C({ id: "i2c1", name: "I2C (GPIO2 SDA / GPIO3 SCL)", roles: ["master"], sda: "gpio2", scl: "gpio3", maxInstances: 1 }));
const idEeprom = noClock(I2C({ id: "id_eeprom", name: "HAT ID EEPROM I2C (GPIO0 / GPIO1)", roles: ["master"], sda: "gpio0", scl: "gpio1", maxInstances: 1 })).map((i) =>
  i.id === "id_eeprom" ? { ...i, default_active: false, traits: [...(i.traits ?? []), note("Reserved for the HAT ID EEPROM.", SRC.gpio)] } : i,
);
const uart0 = UART({ id: "uart0", name: "Serial (GPIO14 TX / GPIO15 RX)", tx: "gpio14", rx: "gpio15" });
const spi0 = SPI({ id: "spi0", name: "SPI0 (MOSI 10, MISO 9, SCLK 11, CE0 8)", roles: ["master"], mosi: "gpio10", miso: "gpio9", sck: "gpio11", ss: "gpio8" }).map((i) =>
  i.id === "spi0" ? { ...i, traits: [...(i.traits ?? []), note("CE1 on GPIO7.", SRC.gpio)] } : i,
);
const spi1 = SPI({ id: "spi1", name: "SPI1 (MOSI 20, MISO 19, SCLK 21, CE0 18)", roles: ["master"], mosi: "gpio20", miso: "gpio19", sck: "gpio21", ss: "gpio18" }).map((i) =>
  i.id === "spi1" ? { ...i, traits: [...(i.traits ?? []), note("CE1 on GPIO17, CE2 on GPIO16.", SRC.gpio)] } : i,
);

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const mountBase = BoltPattern({
  id: "mount",
  name: "Mounting holes 4x M2.5 on 58 x 49 mm",
  role: "component",
  shape: "rectangle",
  spacingMm: 58,
  spacingYmm: 49,
  holeCount: 4,
  fastener: "M2.5",
  fastenerDiameterMm: 2.5,
  threaded: false,
  note: "Drawing: holes 58 x 49 mm, 3.5 mm from the board edges, Ø2.7 (M2.5 clearance). Same pattern as the HAT standard.",
});
const mount: InterfaceDef = {
  ...mountBase,
  traits: [
    ...(mountBase.traits ?? []),
    { type: "assumption", params: { field: "fastener", value: "M2.5", reason: "The drawing gives Ø2.7 holes but names no fastener; Ø2.7 is M2.5 clearance." } },
  ],
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const RASPBERRY_PI_5_BASE: ModuleDef = defineModule({
  id: "raspberry-pi-5",
  name: "Raspberry Pi 5",
  version: "1.0.0",
  manufacturer: "Raspberry Pi Ltd",
  part_number: "Raspberry Pi 5 (1/2/4/8/16 GB)",
  description:
    "Single-board computer: BCM2712 2.4 GHz quad-core Cortex-A76, VideoCore VII, LPDDR4X (1-16 GB), dual 4Kp60 micro-HDMI, 2 x USB 3.0 + 2 x USB 2.0, Gigabit Ethernet (PoE+ via HAT), 802.11ac Wi-Fi + Bluetooth 5.0, 2 x 4-lane MIPI, PCIe 2.0 x1, microSD, RTC, 40-pin 3.3 V GPIO header, 5 V / 5 A USB-C PD power. 85 x 56 mm, 4 x M2.5 on 58 x 49 mm.",
  tags: ["raspberry-pi", "sbc", "linux", "bcm2712", "gpio", "hat", "wifi", "ble"],
  categories: ["computer", "dev-board"],

  interfaces: [...headerPins, ...ports, ...i2c1, ...idEeprom, ...uart0, ...spi0, ...spi1, mount],

  interfaceGroups: [{ id: "j8_header", label: "J8 40-pin GPIO header", members: headerPins.map((i) => i.id), policy: "any_of" }],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "5v", name: "5 V (USB-C)", voltage_range_V: [5.1, 5.1] },
        { id: "3v3", name: "3.3 V GPIO", voltage_range_V: [3.3, 3.3] },
      ],
      metadata: { soc: "BCM2712", io_controller: "RP1", recommended_supply: "5.1 V, 5.0 A", typical_active_current_mA: 800, source: [SRC.brief, SRC.power] },
    },
    { domain: "mechanical", dimensions_mm: { length: 85, width: 56 }, metadata: { hole_pattern_mm: [58, 49], hole_diameter_mm: 2.7, hole_edge_offset_mm: 3.5, source: [SRC.drawing, SRC.cad] } },
    { domain: "thermal", metadata: { operating_C: [0, 70], source: SRC.brief } },
    { domain: "network", metadata: { wifi: "dual-band 802.11ac", bluetooth: "5.0 / BLE", ethernet: "Gigabit, PoE+ with HAT", source: SRC.brief } },
  ],

  traits: [
    { type: "operating_conditions", params: { temperature_C: [0, 70], source: SRC.brief } },
    note("GPIO are 3.3 V: do not apply 5 V. Combined, the GPIO pins can draw 50 mA safely; each pin up to 16 mA (docs, generic figure). Software PWM on all pins; hardware PWM on GPIO12/13/18/19. I2C can be routed to at least three locations via alternate functions.", [SRC.gpio, SRC.power]),
    {
      type: "source_discrepancy",
      params: {
        field: "manufacturer and header detail",
        values: ["Raspberry Pi Ltd; 3.3 V GPIO, 58 x 49 mounting (manufacturer)", "'Raspberry Pi Foundation', pins named by function only, no voltages or mounting (ProtoPart)"],
        sources: [SRC.brief, SRC.drawing, SRC.protopart],
        resolution: "Manufacturer sources used.",
      },
    },
    { type: "data_gap", params: { fields: ["RP1 GPIO VIH/VIL/drive table", "3V3/5V header pin current budget", "which USB stack is USB 3.0", "MIPI/PCIe/fan/UART/RTC connector pinouts"], note: "Not in the fetched Raspberry Pi sources." } },
  ],

  artifacts: [
    { id: "art_brief", name: "Raspberry Pi 5 product brief", type: "datasheet", url: SRC.brief },
    { id: "art_drawing", name: "Raspberry Pi 5 mechanical drawing", type: "datasheet", url: SRC.drawing },
    { id: "art_schematic", name: "Raspberry Pi 5 reduced schematics", type: "schematic", url: SRC.schematic },
    { id: "art_gpio_doc", name: "GPIO and the 40-pin header", type: "documentation", url: SRC.gpio },
    { id: "art_power_doc", name: "Raspberry Pi power supplies", type: "documentation", url: SRC.power },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): Raspberry Pi 5 STEP (MIT), bound by
// library/cad/py/catalog/raspberry-pi-5.py. STEP coordinates (mm, Z up, PCB
// 0..85 x 0..56, bottom z ~ 0.03); the STEP itself is not committed.
// ---------------------------------------------------------------------------

const HDR = vendorFeature("gpio_header", { area_mm2: 2.304, centroid: [32.5, 52.5, 9.876], normal: [0.0, 0.0, 1.0] });
const STACKS = [vendorFeature("usb_stack_a", { area_mm2: 57.083, centroid: [87.892, 29.0, 9.716], normal: [1.0, 0.0, 0.0] }), vendorFeature("usb_stack_b", { area_mm2: 55.699, centroid: [87.662, 47.0, 9.637], normal: [1.0, 0.0, 0.0] })];

export const RASPBERRY_PI_5: ModuleDef = withGeometry(
  RASPBERRY_PI_5_BASE,
  {
    ...Object.fromEntries(headerPins.map((i) => [i.id, { refs: [HDR, vendorOwn("gpio_header")] }])),
    // Board bottom onto standoffs: pattern centre (32.5, 28), normal out of the bottom face.
    mount: {
      frame: { origin: [32.5, 28, 0.03], normal: [0, 0, -1], xAxis: [1, 0, 0] },
      refs: [vendorFeature("mount", { area_mm2: 43.294, centroid: [32.5, 28.0, 0.668] }), vendorOwn("mount"), procedural("bolt_pattern")],
    },
    usb_c_power: { frame: { origin: [11.2, -1.2, 3.016], normal: [0, -1, 0], xAxis: [1, 0, 0] }, refs: [vendorFeature("usb_c", { area_mm2: 6.344, centroid: [11.2, -1.2, 3.016], normal: [0.0, -1.0, 0.0] }), vendorOwn("usb_c")] },
    hdmi0: { refs: [vendorFeature("hdmi0", { area_mm2: 1.647, centroid: [25.8, -0.83, 2.703], normal: [0.0, -1.0, 0.0] })] },
    hdmi1: { refs: [vendorFeature("hdmi1", { area_mm2: 1.647, centroid: [39.2, -0.83, 2.703], normal: [0.0, -1.0, 0.0] })] },
    ethernet: { refs: [vendorFeature("ethernet", { area_mm2: 155.125, centroid: [87.952, 10.25, 9.025], normal: [1.0, 0.0, 0.0] })] },
    usb3_0: { refs: STACKS },
    usb3_1: { refs: STACKS },
    usb2_0: { refs: STACKS },
    usb2_1: { refs: STACKS },
    i2c1: { refs: [HDR] },
    id_eeprom: { refs: [HDR] },
    uart0: { refs: [HDR] },
    spi0: { refs: [HDR] },
    spi1: { refs: [HDR] },
    wifi: { logical: true },
    bluetooth: { logical: true },
  },
  vendorCadArtifacts({
    partId: "raspberry-pi-5",
    name: "raspberry-pi-5",
    url: SRC.cad,
    stepFile: "rpi-5b_no_graphics.step",
    sha256: "6841637b4cfa97637bf34b529bfe896f24d9634b2c40b57a156781f55d88f06f",
    licence: "MIT (LICENSE.txt in the archive); not committed: 77.6 MB exceeds the 5 MB limit",
    interfaces: ["mount", "gpio_header", "usb_c"],
  }),
);
