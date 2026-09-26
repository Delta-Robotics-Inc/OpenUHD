/**
 * Espressif ESP32-C3-DevKitM-1 (ESP32-C3-MINI-1-N4X module) — datasheet-honest UHD part.
 *
 * Sources (see ./espressif-esp32-c3-devkitm-1-n4x/sources.json):
 *   - src_user_guide:       ESP32-C3-DevKitM-1 user guide — https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html
 *   - src_schematic:        ESP32-C3-DevKitM-1 schematic V1.0 — https://dl.espressif.com/dl/schematics/SCH_ESP32-C3-DEVKITM-1_V1_20200915A.pdf
 *   - src_dimensions:       dimensions drawing (PDF) — https://dl.espressif.com/dl/schematics/DIMENSION_ESP32-C3-DEVKITM-1_V1_20200915AA.pdf
 *   - src_dimensions_dxf:   dimensions source file (DXF) — https://dl.espressif.com/dl/schematics/DIMENSION_ESP32-C3-DEVKITM-1_V1_20200915AA.dxf
 *   - src_module_datasheet: ESP32-C3-MINI-1 datasheet — https://www.espressif.com/sites/default/files/documentation/esp32-c3-mini-1_datasheet_en.pdf
 *   - src_chip_datasheet:   ESP32-C3 datasheet — https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf
 *   - src_protopart:        ProtoPart espressif-esp32-c3-devkitm-1-n4x definition (starting point only)
 *
 * Modelling notes:
 *   - Board-level part (mirrors esp32-devkitc-v4.ts in scope, not verbosity):
 *     one leaf per header pin, J1-1..J1-15 then J3-1..J3-15, with the user
 *     guide's name as `name`, "J1-n"/"J3-n" as `pin`, and the guide's Function
 *     column verbatim in a `pin_functions` trait. The Micro-USB receptacle is
 *     one more leaf (`micro_usb`). Ids follow the ProtoPart resource ids.
 *   - Variant: N4X = ESP32-C3-MINI-1-N4X (4 MB flash in the chip package,
 *     -40..85 °C, PCB antenna). The -1U board (external antenna) is a
 *     different part.
 *   - GPIO capabilities: every header GPIO is digital I/O with interrupts
 *     ("Input GPIOs can also be set to generate edge-triggered or
 *     level-triggered CPU interrupts") and, through the GPIO matrix, LED PWM,
 *     I2C and UART1 ("peripheral output signals can be configured to any IO
 *     pins"), so each carries pwm/interrupt and i2c_sda/i2c_scl/uart_rx/uart_tx
 *     capability tags. ADC only on the pins the guide lists (GPIO0-5).
 *     Logic level 3.0-3.6 V (module VDD33); IOH 40 mA / IOL 28 mA typical
 *     are in a usage_note (no drive_current parameter: they are typicals).
 *   - Composed: `uart0` (GPIO21 TX / GPIO20 RX, the U0TXD/U0RXD pins, also
 *     wired to the CP2102N), `fspi` (IO MUX pins FSPICLK GPIO6, FSPID GPIO7,
 *     FSPIQ GPIO2, FSPICS0 GPIO10), `jtag` (MTMS 4, MTDI 5, MTCK 6, MTDO 7;
 *     custom type), `usb_serial_jtag` (GPIO18 D- / GPIO19 D+; custom), and
 *     `wifi` / `bluetooth` on the module's PCB antenna. I2C has no board
 *     default pins, so no composed I2C is declared (the pins carry the tags).
 *   - Power: `usb_5v` (Micro-USB), the 5V pins and the 3V3 pins are the three
 *     mutually exclusive supply options (interfaceGroup `supply_select`,
 *     one_of). The 3V3 and 5V pins are bidirectional (input or output
 *     depending on the supply option). No current budget is stated for the
 *     SGM2212-3.3 LDO in the Espressif sources (data_gap).
 *   - Strapping pins GPIO2/8/9 carry usage_note traits; GPIO8 also drives the
 *     SK68XXMINI-HS RGB LED.
 *   - ProtoPart discrepancies (source_discrepancy): ProtoPart lists GPIO11-17
 *     as board resources, but the headers expose none of them (flash SPI /
 *     not broken out: "All available GPIO pins (except for the SPI bus for
 *     flash) are broken out"). They are omitted.
 *   - No mounting holes (dimensions drawing), so no BoltPattern.
 *   - Geometry: generated from the Espressif DXF by
 *     library/cad/py/catalog/espressif-esp32-c3-devkitm-1-n4x.py (board centre
 *     at the origin, PCB bottom z = 0, USB toward -Y, headers pins-down).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { Ground, Pin, SPI, UART, defineModule, voltageRangeV, voltageV } from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, withGeometry } from "../cad/artifacts.js";

const SRC = {
  guide: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html",
  schematic: "https://dl.espressif.com/dl/schematics/SCH_ESP32-C3-DEVKITM-1_V1_20200915A.pdf",
  dimensions: "https://dl.espressif.com/dl/schematics/DIMENSION_ESP32-C3-DEVKITM-1_V1_20200915AA.pdf",
  dxf: "https://dl.espressif.com/dl/schematics/DIMENSION_ESP32-C3-DEVKITM-1_V1_20200915AA.dxf",
  pcb: "https://dl.espressif.com/dl/schematics/PCB_ESP32-C3-DEVKITM-1_V1_20200915AA.pdf",
  module: "https://www.espressif.com/sites/default/files/documentation/esp32-c3-mini-1_datasheet_en.pdf",
  chip: "https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/espressif-esp32-c3-devkitm-1-n4x/definition.json",
} as const;

const IO_V: [number, number] = [3.0, 3.6];

const fn = (description: string, extra: TraitDef[] = []): TraitDef[] => [
  { type: "pin_functions", params: { description, source: SRC.guide } },
  ...extra,
];
const strap = (gpio: number): TraitDef => ({
  type: "usage_note",
  params: {
    note: `GPIO${gpio} is a strapping pin: its level at power-up/reset selects chip functions (ESP32-C3 datasheet, Boot Configurations). Do not force a conflicting level during reset.`,
    source: [SRC.guide, SRC.chip],
  },
});

// ---------------------------------------------------------------------------
// Header pins
// ---------------------------------------------------------------------------

interface GpioSpec {
  gpio: number;
  pin: string;
  name: string;
  functions: string;
  adc?: boolean;
  spi?: "mosi" | "miso" | "sck" | "ss";
  traits?: TraitDef[];
}

function gpio(s: GpioSpec): InterfaceDef {
  const base = Pin({
    id: `gpio${s.gpio}`,
    name: s.name,
    pin: s.pin,
    voltageV: IO_V,
    capabilities: {
      pwm: true,
      interrupt: true,
      analogIn: s.adc,
      i2cSda: true,
      i2cScl: true,
      uartRx: true,
      uartTx: true,
      spiMosi: s.spi === "mosi",
      spiMiso: s.spi === "miso",
      spiSck: s.spi === "sck",
      spiSs: s.spi === "ss",
    },
  });
  return { ...base, capabilities: [...(base.capabilities ?? []), `gpio${s.gpio}`], traits: fn(s.functions, s.traits) };
}

const gnd = (n: number, pin: string): InterfaceDef => ({ ...Ground({ id: `gnd_${n}`, name: "GND", pin }), traits: fn("Ground") });

const power = (id: string, name: string, pin: string, v: number, range: [number, number] | undefined, description: string, extra: TraitDef[] = []): InterfaceDef => ({
  id,
  name,
  pin,
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "power", roles: ["input", "output"] }],
  capabilities: [id.startsWith("pin_5v") ? "power_5v" : "power_3v3"],
  parameters: [range ? voltageRangeV(range[0], range[1], v) : voltageV(v)],
  traits: fn(description, extra),
});

const V3_NOTE: TraitDef = {
  type: "usage_note",
  params: {
    note: "3V3 is the SGM2212-3.3 LDO output when powered from USB/5V, or the supply input when powering from the 3V3 pins (mutually exclusive options). Range 3.0-3.6 V from the module's VDD33 rating.",
    source: [SRC.guide, SRC.schematic, SRC.module],
  },
};

const J1: InterfaceDef[] = [
  gnd(1, "J1-1"),
  power("pin_3v3_1", "3V3", "J1-2", 3.3, IO_V, "3.3 V power supply", [V3_NOTE]),
  power("pin_3v3_2", "3V3", "J1-3", 3.3, IO_V, "3.3 V power supply", [V3_NOTE]),
  gpio({ gpio: 2, pin: "J1-4", name: "IO2", functions: "GPIO2, ADC1_CH2, FSPIQ (strapping pin)", adc: true, spi: "miso", traits: [strap(2)] }),
  gpio({ gpio: 3, pin: "J1-5", name: "IO3", functions: "GPIO3, ADC1_CH3", adc: true }),
  gnd(2, "J1-6"),
  {
    ...Pin({ id: "rst", name: "RST", pin: "J1-7", voltageV: IO_V, capabilities: { inputOnly: true } }),
    capabilities: ["reset", "chip_pu"],
    traits: fn("CHIP_PU (type I). Also driven by the Reset button and the CP2102N auto-reset circuit.", [
      { type: "usage_note", params: { note: "Pulling RST low resets the chip; the Reset button does the same.", source: SRC.guide } },
    ]),
  },
  gnd(3, "J1-8"),
  gpio({ gpio: 0, pin: "J1-9", name: "IO0", functions: "GPIO0, ADC1_CH0, XTAL_32K_P", adc: true }),
  gpio({ gpio: 1, pin: "J1-10", name: "IO1", functions: "GPIO1, ADC1_CH1, XTAL_32K_N", adc: true }),
  gpio({ gpio: 10, pin: "J1-11", name: "IO10", functions: "GPIO10, FSPICS0", spi: "ss" }),
  gnd(4, "J1-12"),
  power("pin_5v_1", "5V", "J1-13", 5, undefined, "5 V power supply"),
  power("pin_5v_2", "5V", "J1-14", 5, undefined, "5 V power supply"),
  gnd(5, "J1-15"),
];

const J3: InterfaceDef[] = [
  gnd(6, "J3-1"),
  gpio({ gpio: 21, pin: "J3-2", name: "TX", functions: "GPIO21, U0TXD" }),
  gpio({ gpio: 20, pin: "J3-3", name: "RX", functions: "GPIO20, U0RXD" }),
  gnd(7, "J3-4"),
  gpio({ gpio: 9, pin: "J3-5", name: "IO9", functions: "GPIO9 (strapping pin; Boot button)", traits: [strap(9)] }),
  gpio({ gpio: 8, pin: "J3-6", name: "IO8", functions: "GPIO8 (strapping pin), RGB LED", traits: [strap(8)] }),
  gnd(8, "J3-7"),
  gpio({ gpio: 7, pin: "J3-8", name: "IO7", functions: "GPIO7, FSPID, MTDO", spi: "mosi" }),
  gpio({ gpio: 6, pin: "J3-9", name: "IO6", functions: "GPIO6, FSPICLK, MTCK", spi: "sck" }),
  gpio({ gpio: 5, pin: "J3-10", name: "IO5", functions: "GPIO5, ADC2_CH0, FSPIWP, MTDI", adc: true }),
  gpio({ gpio: 4, pin: "J3-11", name: "IO4", functions: "GPIO4, ADC1_CH4, FSPIHD, MTMS", adc: true }),
  gnd(9, "J3-12"),
  gpio({ gpio: 18, pin: "J3-13", name: "IO18", functions: "GPIO18, USB_D-" }),
  gpio({ gpio: 19, pin: "J3-14", name: "IO19", functions: "GPIO19, USB_D+" }),
  gnd(10, "J3-15"),
];

const withCaps = (iface: InterfaceDef, caps: string[]): InterfaceDef => ({ ...iface, capabilities: [...(iface.capabilities ?? []), ...caps] });
const JTAG_CAPS: Record<string, string[]> = { gpio4: ["jtag_tms"], gpio5: ["jtag_tdi"], gpio6: ["jtag_tck"], gpio7: ["jtag_tdo"], gpio18: ["usb_dm"], gpio19: ["usb_dp"] };
const headerPins = [...J1, ...J3].map((i) => (JTAG_CAPS[i.id] ? withCaps(i, JTAG_CAPS[i.id]) : i));

const microUsb: InterfaceDef = {
  id: "micro_usb",
  name: "Micro-USB (USB-to-UART, 5 V power)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [
    { type: "usb", roles: ["device"] },
    { type: "power", roles: ["input"] },
  ],
  capabilities: ["usb_5v_in"],
  parameters: [voltageV(5)],
  traits: [
    { type: "connector", params: { connector_type: "micro_usb_b", gender: "receptacle", note: "Micro-USB port J2: board power and the CP2102N USB-to-UART bridge (up to 3 Mbps) to UART0. Use a data-capable cable.", source: [SRC.guide, SRC.schematic] } },
    { type: "pin_functions", params: { description: "USB interface. Power supply for the board as well as the communication interface between a computer and the ESP32-C3 (via the USB-to-UART bridge).", source: SRC.guide } },
  ],
};

// ---------------------------------------------------------------------------
// Composed interfaces
// ---------------------------------------------------------------------------

const uart0 = UART({ id: "uart0", name: "UART0 (U0TXD GPIO21 / U0RXD GPIO20)", tx: "gpio21", rx: "gpio20" }).map((i) =>
  i.id === "uart0"
    ? {
        ...i,
        traits: [
          ...(i.traits ?? []),
          { type: "usage_note", params: { note: "UART0 is also connected to the CP2102N USB-to-UART bridge (Micro-USB) for flashing and the console; avoid driving TX/RX externally while USB is connected. UART controllers run up to 5 Mbps (chip datasheet).", source: [SRC.guide, SRC.schematic, SRC.chip] } },
        ],
      }
    : i,
);

const fspi = SPI({ id: "fspi", name: "FSPI (SPI2) IO MUX pins", roles: ["master"], mosi: "gpio7", miso: "gpio2", sck: "gpio6", ss: "gpio10" });

const custom = (id: string, name: string, role: string, slots: [string, string][], note: string, domain: InterfaceDef["domain"] = "electrical"): InterfaceDef => ({
  id,
  name,
  domain,
  exposed: true,
  default_active: false,
  protocols: [{ type: "custom", roles: [role] }],
  slots: slots.map(([slot, cap]) => ({ id: slot, required: true, match: { protocol: "digital", capability: cap } })),
  profiles: [{ id: "default", bindings: Object.fromEntries(slots.map(([slot]) => [slot, slot === "dm" ? "gpio18" : slot === "dp" ? "gpio19" : { tms: "gpio4", tdi: "gpio5", tck: "gpio6", tdo: "gpio7" }[slot]!])) }],
  max_instances: 1,
  traits: [{ type: "usage_note", params: { note, source: [SRC.guide, SRC.chip] } }],
});

const jtag = custom("jtag", "JTAG (MTMS/MTDI/MTCK/MTDO)", "device", [["tms", "jtag_tms"], ["tdi", "jtag_tdi"], ["tck", "jtag_tck"], ["tdo", "jtag_tdo"]], "JTAG on GPIO4 MTMS, GPIO5 MTDI, GPIO6 MTCK, GPIO7 MTDO (header table). Custom type: no JTAG builder.");
const usbSerialJtag = custom("usb_serial_jtag", "USB Serial/JTAG (GPIO18 D- / GPIO19 D+)", "device", [["dm", "usb_dm"], ["dp", "usb_dp"]], "The chip's USB Serial/JTAG controller is on GPIO18 (USB_D-) / GPIO19 (USB_D+), exposed on J3-13/14. The Micro-USB port is NOT wired to it (it goes to the CP2102N); an external USB connector is needed. Custom type.");

const wifi: InterfaceDef = {
  id: "wifi",
  name: "Wi-Fi 802.11 b/g/n (2.4 GHz), PCB antenna",
  domain: "network",
  exposed: true,
  default_active: true,
  protocols: [{ type: "wifi", roles: ["client", "access_point"] }],
  traits: [{ type: "usage_note", params: { note: "Integrated Wi-Fi on the ESP32-C3-MINI-1 module's on-board PCB antenna; keep the antenna overhang clear of metal.", source: [SRC.guide, SRC.module] } }],
};
const bluetooth: InterfaceDef = {
  id: "bluetooth",
  name: "Bluetooth LE, PCB antenna",
  domain: "network",
  exposed: true,
  default_active: true,
  protocols: [{ type: "bluetooth", roles: ["peer"] }],
  traits: [{ type: "usage_note", params: { note: "Bluetooth Low Energy on the module's PCB antenna.", source: [SRC.guide, SRC.module] } }],
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const ESPRESSIF_ESP32_C3_DEVKITM_1_N4X_BASE: ModuleDef = defineModule({
  id: "espressif-esp32-c3-devkitm-1-n4x",
  name: "Espressif ESP32-C3-DevKitM-1 (N4X)",
  version: "1.0.0",
  manufacturer: "Espressif Systems",
  part_number: "ESP32-C3-DevKitM-1 (ESP32-C3-MINI-1-N4X)",
  description:
    "Entry-level ESP32-C3 (RISC-V) development board on the ESP32-C3-MINI-1-N4X module (4 MB flash, PCB antenna): Wi-Fi + Bluetooth LE, 2 x 15-pin 2.54 mm headers (22.86 mm apart), Micro-USB via a CP2102N USB-to-UART bridge, SGM2212 5 V to 3.3 V LDO, RGB LED on GPIO8, Boot and Reset buttons. 25.4 x 38.9 mm, no mounting holes.",
  tags: ["esp32", "esp32-c3", "risc-v", "wifi", "ble", "devkit", "microcontroller", "breadboard"],
  categories: ["microcontroller", "dev-board"],

  interfaces: [...headerPins, microUsb, ...uart0, ...fspi, jtag, usbSerialJtag, wifi, bluetooth],

  interfaceGroups: [
    { id: "supply_select", label: "Power supply options (mutually exclusive)", members: ["micro_usb", "pin_5v_1", "pin_3v3_1"], policy: "one_of" },
    { id: "j1_header", label: "J1 (15 pins, 2.54 mm)", members: J1.map((i) => i.id), policy: "any_of" },
    { id: "j3_header", label: "J3 (15 pins, 2.54 mm)", members: J3.map((i) => i.id), policy: "any_of" },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "usb_5v", name: "5 V (Micro-USB or 5V pins)", voltage_range_V: [5, 5] },
        { id: "io_3v3", name: "3.3 V (LDO output / 3V3 pins)", voltage_range_V: IO_V },
      ],
      metadata: { ldo: "SGM2212-3.3", usb_uart_bridge: "CP2102N-A02-GQFN28", rgb_led: "SK68XXMINI-HS on GPIO8", source: [SRC.schematic, SRC.guide] },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 25.4, width: 38.91, height: 1.6 },
      metadata: {
        header_row_spacing_mm: 22.86,
        header_pitch_mm: 2.54,
        pins_per_row: 15,
        mounting_holes: 0,
        antenna_overhang: "module PCB antenna overhangs the top edge",
        source: [SRC.dimensions, SRC.dxf],
      },
    },
    { domain: "thermal", metadata: { operating_ambient_C: [-40, 85], note: "ESP32-C3-MINI-1-N4X module rating", source: SRC.module } },
    { domain: "network", metadata: { wifi: "802.11 b/g/n 2.4 GHz", bluetooth: "Bluetooth LE", antenna: "PCB (module)", source: [SRC.guide, SRC.module] } },
  ],

  traits: [
    { type: "operating_conditions", params: { ambient_temperature_C: [-40, 85], vdd33_V: IO_V, note: "Module ESP32-C3-MINI-1-N4X ratings.", source: SRC.module } },
    { type: "usage_note", params: { note: "Three mutually exclusive power options: Micro-USB (default), 5V and GND pins, or 3V3 and GND pins. All GPIO are 3.3 V logic (VIH 0.75 x VDD, VIL 0.25 x VDD; IOH 40 mA / IOL 28 mA typical). Holding Boot then pressing Reset enters firmware download mode.", source: [SRC.guide, SRC.module] } },
    {
      type: "source_discrepancy",
      params: {
        field: "exposed GPIOs",
        values: ["GPIO11-17 listed as board resources (ProtoPart)", "headers expose GPIO0-10, 18-21 only (user guide J1/J3 tables)"],
        sources: [SRC.protopart, SRC.guide],
        resolution: "User guide used: GPIO11-17 are not on the headers (flash SPI / not broken out) and are omitted.",
      },
    },
    { type: "data_gap", params: { fields: ["LDO / 3V3 pin current budget", "5 V pin tolerance range", "PCB thickness"], note: "Not stated in the Espressif board sources." } },
    {
      type: "data_gap",
      params: {
        field: "manufacturer CAD",
        note: "No 3D model: the user guide's Related Documents give only the schematic, PCB layout PDF, and 2D dimensions (PDF + DXF). Geometry is generated from the DXF outline and pad centres.",
        source: [SRC.guide, SRC.dxf],
      },
    },
    {
      type: "assumption",
      params: {
        field: "generated geometry",
        value: "1.6 mm PCB; male headers soldered pins-down (2.5 mm plastic, 6 mm pins); Micro-B receptacle 7.5 x 5.5 x 2.6 mm; module top edge 5.5 mm past the board edge",
        reason: "The drawing gives the outline, header positions and pitch but not these.",
      },
    },
  ],

  artifacts: [
    { id: "art_user_guide", name: "ESP32-C3-DevKitM-1 user guide", type: "documentation", url: SRC.guide },
    { id: "art_schematic", name: "ESP32-C3-DevKitM-1 schematic", type: "schematic", url: SRC.schematic },
    { id: "art_dimensions", name: "ESP32-C3-DevKitM-1 dimensions", type: "datasheet", url: SRC.dimensions },
    { id: "art_dimensions_dxf", name: "ESP32-C3-DevKitM-1 dimensions (DXF)", type: "cad", url: SRC.dxf },
    { id: "art_pcb", name: "ESP32-C3-DevKitM-1 PCB layout", type: "pcb", url: SRC.pcb },
    { id: "art_module_datasheet", name: "ESP32-C3-MINI-1 datasheet", type: "datasheet", url: SRC.module },
    { id: "art_chip_datasheet", name: "ESP32-C3 datasheet", type: "datasheet", url: SRC.chip },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): representative CAD from the Espressif DXF,
// library/cad/py/catalog/espressif-esp32-c3-devkitm-1-n4x.py (mm; board centre
// at the origin, PCB bottom z = 0, USB toward -Y, J1 at x = -11.43).
// ---------------------------------------------------------------------------

const J1_REF = feature("header_j1", { area_mm2: 96.774, centroid: [-11.43, -0.386, -2.5], normal: [0.0, 0.0, -1.0] });
const J3_REF = feature("header_j3", { area_mm2: 96.774, centroid: [11.43, -0.386, -2.5], normal: [0.0, 0.0, -1.0] });
const USB_REF = feature("usb", { area_mm2: 19.5, centroid: [0.0, -20.256, 2.9], normal: [0.0, -1.0, 0.0] });

const headerGeometry = Object.fromEntries([
  ...J1.map((i) => [i.id, { refs: [J1_REF, own("header_j1")] }]),
  ...J3.map((i) => [i.id, { refs: [J3_REF, own("header_j3")] }]),
]);

export const ESPRESSIF_ESP32_C3_DEVKITM_1_N4X: ModuleDef = withGeometry(
  ESPRESSIF_ESP32_C3_DEVKITM_1_N4X_BASE,
  {
    ...headerGeometry,
    // Micro-USB: the cable plugs in from -Y.
    micro_usb: { frame: { origin: [0, -20.256, 2.9], normal: [0, -1, 0], xAxis: [1, 0, 0] }, refs: [USB_REF, own("usb")] },
    uart0: { refs: [J3_REF] },
    fspi: { refs: [J1_REF, J3_REF] },
    jtag: { refs: [J3_REF] },
    usb_serial_jtag: { refs: [J3_REF] },
    wifi: { logical: true },
    bluetooth: { logical: true },
  },
  cadArtifacts({
    dir: "library/parts/espressif-esp32-c3-devkitm-1-n4x/artifacts/cad",
    name: "esp32-c3-devkitm-1",
    generator: "library/cad/py/catalog/espressif-esp32-c3-devkitm-1-n4x.py",
    tool: "build123d 0.13.0",
    interfaces: ["usb", "header_j1", "header_j3"],
  }),
);
