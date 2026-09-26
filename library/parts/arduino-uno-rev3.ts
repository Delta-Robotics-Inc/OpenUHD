/**
 * Arduino UNO R3 (A000066) — datasheet-honest UHD part.
 *
 * Sources (see ./arduino-uno-rev3/sources.json):
 *   - src_datasheet: Arduino UNO R3 datasheet — https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf
 *   - src_pinout:    Arduino UNO R3 full pinout (CC BY-SA 4.0) — https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf
 *   - src_schematic: Arduino UNO R3 schematic — https://docs.arduino.cc/resources/schematics/A000066-schematics.pdf
 *   - src_product:   docs.arduino.cc UNO R3 page — https://docs.arduino.cc/hardware/uno-rev3/
 *   - src_cad:       Eagle CAD files UNO-TH_Rev3e (CC BY-SA 4.0) — https://docs.arduino.cc/static/6bb7a3ca51ebee82a252f60c0b418787/A000066-cad-files.zip
 *   - src_protopart: ProtoPart arduino-uno-rev3 definition (starting point only)
 *
 * Modelling notes:
 *   - Leaves follow the datasheet connector tables: JANALOG 2-14 (pin 1 is
 *     "NC — Not connected" and has no leaf) and JDIGITAL 1-18, `pin` =
 *     "JANALOG-n" / "JDIGITAL-n", the table's Description verbatim in
 *     `pin_functions`. JDIGITAL 17/18 (SDA/SCL, "duplicated") are their own
 *     leaves, electrically the same nets as A4/A5. The USB-B receptacle and
 *     the 2.1 x 5.5 mm DC jack are leaves too. The two 2x3 ICSP headers
 *     (ATmega328P and ATmega16U2 programming) are not modelled.
 *   - Logic level is 5 V (IOREF "connected to 5V"); max 20 mA per I/O pin and
 *     50 mA on the 3.3 V pin (full pinout). PWM on D3/5/6/9/10/11, INT0 D2,
 *     INT1 D3 (pinout); every header I/O also has a pin-change interrupt.
 *   - Composed: `uart0` (D0 RX / D1 TX, shared with the ATmega16U2 USB
 *     bridge), `i2c` (A4 SDA / A5 SCL; alternative profile on the duplicated
 *     SDA/SCL pins), `spi` (D11 COPI, D12 CIPO, D13 SCK, D10 SS).
 *   - Power: VIN 6-20 V ("Maximum input voltage from VIN pad"), USB 5 V (max
 *     5.5 V, 500 mA polyfuse MF-MSMF050-2), 5 V from an NCP1117ST50T3G
 *     regulator (schematic), automatic USB/VIN switchover (LMV358 + FDN340P).
 *     The DC jack feeds VIN through the D1 rectifier.
 *   - Mounting (irregular 4-hole pattern): the BoltPattern `mount` follows the
 *     library's UNO R3 shield convention (adafruit-1438-motor-shield-v2,
 *     adafruit-1411-16ch-pwm-servo-shield): the diagonal pair (13.97, 2.54) and
 *     (66.04, 35.56) in the Eagle board, 61.657 mm apart, as a `rectangle` with
 *     spacingYmm 0; frame at the pair midpoint on the board top, normal +Z (a
 *     shield mates onto it), xAxis toward (66.04, 35.56). The other two holes,
 *     (15.24, 50.8) and (66.04, 7.62), are in the note and an assumption
 *     trait. `mount` has role "structure" (shields stack onto it); `mount_bottom`
 *     is the same pair framed on the bottom face (normal -Z, role "component")
 *     for mounting the UNO onto standoffs. All are Ø3.2 mm through holes (M3
 *     clearance).
 *   - ProtoPart discrepancies (source_discrepancy traits): corner-rectangle
 *     holes, VIN 7-12 V, 40 mA per I/O, "USB and external power should not
 *     be used simultaneously", and a 25 g weight none of the Arduino sources
 *     give. The datasheet BOM names an SPX1117M3-L-5 regulator while the
 *     schematic/board file say NCP1117ST50T3G.
 *   - Geometry: Arduino publishes no STEP (the CAD download is Eagle), so the
 *     board is generated from the .brd by library/cad/py/catalog/arduino-uno-rev3.py
 *     (board centre at the origin, PCB bottom z = 0, USB/jack toward -X).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  BoltPattern,
  Ground,
  I2C,
  Pin,
  PowerIn,
  PowerOut,
  SPI,
  UART,
  defineModule,
  maxCurrentA,
  voltageRangeV,
  voltageV,
} from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  datasheet: "https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf",
  pinout: "https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf",
  schematic: "https://docs.arduino.cc/resources/schematics/A000066-schematics.pdf",
  product: "https://docs.arduino.cc/hardware/uno-rev3/",
  cad: "https://docs.arduino.cc/static/6bb7a3ca51ebee82a252f60c0b418787/A000066-cad-files.zip",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/arduino-uno-rev3/definition.json",
} as const;

const fn = (description: string, extra: TraitDef[] = []): TraitDef[] => [
  { type: "pin_functions", params: { description, source: [SRC.datasheet, SRC.pinout] } },
  ...extra,
];

// ---------------------------------------------------------------------------
// Header leaves
// ---------------------------------------------------------------------------

interface IoSpec {
  id: string;
  name: string;
  pin: string;
  description: string;
  pwm?: boolean;
  int?: boolean;
  analog?: boolean;
  uart?: "rx" | "tx";
  i2c?: "sda" | "scl";
  spi?: "mosi" | "miso" | "sck" | "ss";
  extra?: TraitDef[];
}

function io(s: IoSpec): InterfaceDef {
  const base = Pin({
    id: s.id,
    name: s.name,
    pin: s.pin,
    voltageV: 5,
    driveCurrentmA: 20,
    capabilities: {
      pwm: s.pwm,
      interrupt: true, // PCINT on every header I/O (pinout); INT0/INT1 noted on D2/D3
      analogIn: s.analog,
      uartRx: s.uart === "rx",
      uartTx: s.uart === "tx",
      i2cSda: s.i2c === "sda",
      i2cScl: s.i2c === "scl",
      spiMosi: s.spi === "mosi",
      spiMiso: s.spi === "miso",
      spiSck: s.spi === "sck",
      spiSs: s.spi === "ss",
    },
  });
  return { ...base, traits: fn(s.description, s.extra) };
}

const note = (text: string, source: string | string[] = SRC.pinout): TraitDef => ({ type: "usage_note", params: { note: text, source } });

const JANALOG: InterfaceDef[] = [
  { ...PowerOut({ id: "ioref", name: "IOREF", pin: "JANALOG-2", voltageV: 5 }), traits: fn("Reference for digital logic V - connected to 5V") },
  {
    ...Pin({ id: "reset", name: "RESET", pin: "JANALOG-3", voltageV: 5, capabilities: { inputOnly: true } }),
    capabilities: ["reset"],
    traits: fn("Reset", [note("Active-low reset of the ATmega328P (PC6/RESET), shared with the reset button.")]),
  },
  { ...PowerOut({ id: "3v3", name: "+3V3", pin: "JANALOG-4", voltageV: 3.3, maxCurrentA: 0.05 }), traits: fn("+3V3 Power Rail", [note("MAXIMUM current per +3.3V pin is 50mA.")]) },
  {
    id: "5v",
    name: "+5V",
    pin: "JANALOG-5",
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "power", roles: ["output"] }],
    parameters: [voltageV(5)],
    traits: fn("+5V Power Rail", [
      note("5 V from the NCP1117ST50T3G regulator (VIN) or from USB (after the 500 mA polyfuse), selected automatically. No current budget is stated.", [SRC.schematic, SRC.datasheet]),
    ]),
  },
  { ...Ground({ id: "gnd_1", name: "GND", pin: "JANALOG-6" }), traits: fn("Ground") },
  { ...Ground({ id: "gnd_2", name: "GND", pin: "JANALOG-7" }), traits: fn("Ground") },
  {
    ...PowerIn({ id: "vin", name: "VIN", pin: "JANALOG-8", voltageV: [6, 20] }),
    traits: fn("Voltage Input", [
      {
        type: "source_discrepancy",
        params: {
          field: "VIN range",
          values: ["6-20 V (datasheet 'Maximum input voltage from VIN pad'; pinout 'VIN 6-20V input')", "7-12 V (ProtoPart)"],
          sources: [SRC.datasheet, SRC.pinout, SRC.protopart],
          resolution: "Arduino's 6-20 V used; 7-12 V is not stated in the current Arduino sources.",
        },
      },
    ]),
  },
  io({ id: "a0", name: "A0", pin: "JANALOG-9", description: "Analog input 0 /GPIO (ADC[0], PC0, D14)", analog: true }),
  io({ id: "a1", name: "A1", pin: "JANALOG-10", description: "Analog input 1 /GPIO (ADC[1], PC1, D15)", analog: true }),
  io({ id: "a2", name: "A2", pin: "JANALOG-11", description: "Analog input 2 /GPIO (ADC[2], PC2, D16)", analog: true }),
  io({ id: "a3", name: "A3", pin: "JANALOG-12", description: "Analog input 3 /GPIO (ADC[3], PC3, D17)", analog: true }),
  io({ id: "a4", name: "A4/SDA", pin: "JANALOG-13", description: "Analog input 4/I2C Data line (ADC[4], PC4, D18)", analog: true, i2c: "sda" }),
  io({ id: "a5", name: "A5/SCL", pin: "JANALOG-14", description: "Analog input 5/I2C Clock line (ADC[5], PC5, D19)", analog: true, i2c: "scl" }),
];

const JDIGITAL: InterfaceDef[] = [
  io({ id: "d0", name: "D0/RX", pin: "JDIGITAL-1", description: "Digital pin 0/GPIO (PD0, RXD)", uart: "rx" }),
  io({ id: "d1", name: "D1/TX", pin: "JDIGITAL-2", description: "Digital pin 1/GPIO (PD1, TXD)", uart: "tx" }),
  io({ id: "d2", name: "D2", pin: "JDIGITAL-3", description: "Digital pin 2/GPIO (PD2, INT[0])", extra: [note("External interrupt INT0.")] }),
  io({ id: "d3", name: "~D3", pin: "JDIGITAL-4", description: "Digital pin 3/GPIO (PD3, INT[1], OC2B PWM)", pwm: true, extra: [note("External interrupt INT1; PWM (OC2B).")] }),
  io({ id: "d4", name: "D4", pin: "JDIGITAL-5", description: "Digital pin 4/GPIO (PD4)" }),
  io({ id: "d5", name: "~D5", pin: "JDIGITAL-6", description: "Digital pin 5/GPIO (PD5, OC0B PWM)", pwm: true }),
  io({ id: "d6", name: "~D6", pin: "JDIGITAL-7", description: "Digital pin 6/GPIO (PD6, OC0A PWM)", pwm: true }),
  io({ id: "d7", name: "D7", pin: "JDIGITAL-8", description: "Digital pin 7/GPIO (PD7)" }),
  io({ id: "d8", name: "D8", pin: "JDIGITAL-9", description: "Digital pin 8/GPIO (PB0)" }),
  io({ id: "d9", name: "~D9", pin: "JDIGITAL-10", description: "Digital pin 9/GPIO (PB1, OC1A PWM)", pwm: true }),
  io({ id: "d10", name: "~D10/SS", pin: "JDIGITAL-11", description: "SPI Chip Select (D10, PB2, OC1B PWM)", pwm: true, spi: "ss" }),
  io({ id: "d11", name: "~D11/COPI", pin: "JDIGITAL-12", description: "SPI1 Main Out Secondary In (D11, PB3, OC2A PWM)", pwm: true, spi: "mosi" }),
  io({ id: "d12", name: "D12/CIPO", pin: "JDIGITAL-13", description: "SPI Main In Secondary Out (D12, PB4)", spi: "miso" }),
  io({ id: "d13", name: "D13/SCK", pin: "JDIGITAL-14", description: "SPI serial clock output (D13, PB5, LED_BUILTIN)", spi: "sck", extra: [note("LED_BUILTIN is on D13 (PB5).")] }),
  { ...Ground({ id: "gnd_3", name: "GND", pin: "JDIGITAL-15" }), traits: fn("Ground") },
  {
    id: "aref",
    name: "AREF",
    pin: "JDIGITAL-16",
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "analog", roles: ["input"] }],
    capabilities: ["analog_reference"],
    traits: fn("Analog reference voltage"),
  },
  io({ id: "sda", name: "SDA", pin: "JDIGITAL-17", description: "Analog input 4/I2C Data line (duplicated)", i2c: "sda", extra: [note("Same net as A4 (PC4).")] }),
  io({ id: "scl", name: "SCL", pin: "JDIGITAL-18", description: "Analog input 5/I2C Clock line (duplicated)", i2c: "scl", extra: [note("Same net as A5 (PC5).")] }),
];

const usb: InterfaceDef = {
  id: "usb",
  name: "USB-B (ATmega16U2 bridge, 5 V power)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [
    { type: "usb", roles: ["device"] },
    { type: "power", roles: ["input"] },
  ],
  capabilities: ["usb_5v_in"],
  parameters: [voltageRangeV(4.5, 5.5, 5), maxCurrentA(0.5)],
  traits: [
    { type: "connector", params: { connector_type: "usb_b", gender: "receptacle", note: "X2 USB B Connector (datasheet topology). Programming and power; ATmega16U2 USB-to-serial bridge on UART0.", source: SRC.datasheet } },
    { type: "usage_note", params: { note: "VUSBMax 5.5 V (datasheet). USB supply passes a 500 mA resettable fuse (MF-MSMF050-2); max_current 0.5 A is that fuse rating. The lower bound of 4.5 V is an assumption (see module assumption trait).", source: [SRC.datasheet, SRC.schematic] } },
  ],
};

const dcJack: InterfaceDef = {
  ...PowerIn({ id: "dc_jack", name: "DC power jack 2.1 x 5.5 mm", voltageV: [6, 20] }),
  traits: [
    { type: "connector", params: { connector_type: "barrel_2_1x5_5mm", gender: "receptacle", note: "X1 Power jack 2.1x5.5mm (datasheet topology).", source: SRC.datasheet } },
    note("Feeds VIN through the D1 rectifier (schematic), so the VIN 6-20 V limits apply.", [SRC.schematic, SRC.datasheet]),
  ],
};

// ---------------------------------------------------------------------------
// Composed buses
// ---------------------------------------------------------------------------

const uart0 = UART({ id: "uart0", name: "Serial (D0 RX / D1 TX)", rx: "d0", tx: "d1" }).map((i) =>
  i.id === "uart0" ? { ...i, traits: [...(i.traits ?? []), note("Shared with the ATmega16U2 USB bridge (RX/TX LEDs on its PD4/PD5).", [SRC.pinout, SRC.schematic])] } : i,
);
const i2c = I2C({
  id: "i2c",
  name: "I2C (A4 SDA / A5 SCL)",
  roles: ["master", "slave"],
  sda: "a4",
  scl: "a5",
  profiles: [{ id: "i2c_dup_header", label: "Duplicated SDA/SCL pins by AREF", sda: "sda", scl: "scl", defaultActive: false }],
  maxInstances: 1,
}).map((i) => (i.id === "i2c" ? { ...i, parameters: (i.parameters ?? []).filter((q) => q.id !== "clock_freq") } : i)); // no I2C clock is stated in the Arduino sources; drop the builder's 400 kHz default
const spi = SPI({ id: "spi", name: "SPI (D11 COPI, D12 CIPO, D13 SCK, D10 SS)", roles: ["master", "slave"], mosi: "d11", miso: "d12", sck: "d13", ss: "d10" });

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const mountBase = BoltPattern({
  id: "mount",
  name: "Mounting holes, top (UNO R3 shield diagonal pair, 61.657 mm)",
  role: "structure",
  shape: "rectangle",
  spacingMm: 61.657,
  spacingYmm: 0,
  holeCount: 2,
  fastener: "M3",
  fastenerDiameterMm: 3,
  threaded: false,
  note: "UNO R3 shield convention (shared with adafruit-1438-motor-shield-v2 and adafruit-1411-16ch-pwm-servo-shield): 2-hole pattern on the diagonal pair (13.97, 2.54) and (66.04, 35.56) mm in the Eagle board (origin = board lower-left, USB/jack edge at x = 0), 61.657 mm apart, as a rectangle with spacingYmm 0; frame origin at the pair midpoint (40.005, 19.05) on the board top, normal +Z toward a stacked shield, xAxis from (13.97, 2.54) toward (66.04, 35.56). Role structure: a shield (role component) stacks onto it; the same holes mounted onto standoffs are `mount_bottom`. The other two Ø3.2 holes are at (15.24, 50.8) and (66.04, 7.62) mm. All 4 x Ø3.20 mm (datasheet 5.4).",
});
const mount: InterfaceDef = {
  ...mountBase,
  traits: [
    ...(mountBase.traits ?? []),
    {
      type: "assumption",
      params: {
        field: "modelled mounting holes",
        value: "2 of 4: the diagonal pair (13.97, 2.54) / (66.04, 35.56), a rectangle 61.657 x 0 mm",
        reason: "The 4 holes contain no square or rectangle. Library convention for UNO R3 boards and shields: the diagonal pair present on every UNO R3 shield is the pattern, so a shield's mount frame coincides with the UNO's. The holes (15.24, 50.8) and (66.04, 7.62) are listed in the note and in the CAD feature mount_all.",
        source: [SRC.cad, SRC.datasheet],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "mounting hole positions",
        values: ["(13.97, 2.54) (15.24, 50.8) (66.04, 7.62) (66.04, 35.56), Ø3.2 (Arduino .brd, datasheet 5.4)", "rectangle (3.2, 3.2) (65.4, 3.2) (3.2, 50.2) (65.4, 50.2) (ProtoPart)"],
        sources: [SRC.cad, SRC.datasheet, SRC.protopart],
        resolution: "Arduino board file and datasheet drawing used.",
      },
    },
  ],
};

// The same two holes seen from below, for mounting the UNO itself onto
// standoffs or a chassis (role "component", frame normal -Z).
const mountBottom: InterfaceDef = {
  ...BoltPattern({
    id: "mount_bottom",
    name: "Mounting holes, bottom (same diagonal pair, onto standoffs)",
    role: "component",
    shape: "rectangle",
    spacingMm: 61.657,
    spacingYmm: 0,
    holeCount: 2,
    fastener: "M3",
    fastenerDiameterMm: 3,
    threaded: false,
    note: "Same Ø3.2 diagonal pair (13.97, 2.54) / (66.04, 35.56) as `mount`, framed on the board bottom (normal -Z) for mounting the UNO onto standoffs; see `mount` for the other two holes.",
  }),
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const ARDUINO_UNO_REV3_BASE: ModuleDef = defineModule({
  id: "arduino-uno-rev3",
  name: "Arduino UNO R3",
  version: "1.0.0",
  manufacturer: "Arduino",
  part_number: "A000066",
  description:
    "ATmega328P (16 MHz, socketed) board with 14 digital I/O (6 PWM), 6 analog inputs, 5 V logic, ATmega16U2 USB-B bridge, 2.1 x 5.5 mm DC jack (VIN 6-20 V), 3.3 V / 5 V outputs, shield headers and ICSP. 68.6 x 53.3 mm, 4 x Ø3.2 mm holes (irregular).",
  tags: ["arduino", "uno", "atmega328p", "microcontroller", "5v-logic", "shield"],
  categories: ["microcontroller", "dev-board"],

  interfaces: [...JANALOG, ...JDIGITAL, usb, dcJack, ...uart0, ...i2c, ...spi, mount, mountBottom],

  interfaceGroups: [
    { id: "janalog", label: "JANALOG (POWER + A0-A5)", members: JANALOG.map((i) => i.id), policy: "any_of" },
    { id: "jdigital", label: "JDIGITAL (D0-D13, GND, AREF, SDA, SCL)", members: JDIGITAL.map((i) => i.id), policy: "any_of" },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vin", name: "VIN / DC jack", voltage_range_V: [6, 20] },
        { id: "5v", name: "+5V (regulator or USB)", voltage_range_V: [5, 5] },
        { id: "3v3", name: "+3V3", voltage_range_V: [3.3, 3.3] },
      ],
      metadata: { mcu: "ATmega328P-PU", clock_hz: 16_000_000, usb_bridge: "ATmega16U2", regulator_5v: "NCP1117ST50T3G", usb_fuse: "MF-MSMF050-2 500 mA", source: [SRC.schematic, SRC.product] },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 68.58, width: 53.34 },
      metadata: { holes: [[13.97, 2.54], [15.24, 50.8], [66.04, 7.62], [66.04, 35.56]], hole_diameter_mm: 3.2, header_height_mm: 8.5, source: [SRC.cad, SRC.datasheet] },
    },
    { domain: "thermal", metadata: { operating_C: [-40, 85], note: "Conservative thermal limits for the whole board", source: SRC.datasheet } },
  ],

  traits: [
    { type: "operating_conditions", params: { temperature_C: [-40, 85], note: "Conservative thermal limits for the whole board; EEPROM, regulator and oscillator may misbehave at the extremes.", source: SRC.datasheet } },
    note("5 V logic: do not drive the I/O above 5 V; 3.3 V peripherals may need level shifting. Max 20 mA per I/O pin, 50 mA on the 3.3 V pin.", [SRC.pinout, SRC.datasheet]),
    {
      type: "source_discrepancy",
      params: {
        field: "I/O current and power-source rules",
        values: [
          "20 mA per I/O pin; USB and VIN switched automatically (LMV358 + FDN340P)",
          "40 mA per I/O pin; 'USB and external power should not be used simultaneously' (ProtoPart)",
        ],
        sources: [SRC.pinout, SRC.schematic, SRC.protopart],
        resolution: "Arduino pinout and schematic used.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "5 V regulator",
        values: ["SPX1117M3-L-5 (datasheet topology table)", "NCP1117ST50T3G (schematic and board file)"],
        sources: [SRC.datasheet, SRC.schematic, SRC.cad],
        resolution: "Recorded only; both are 1117-type 5 V LDOs and no rating depends on it here.",
      },
    },
    { type: "data_gap", params: { fields: ["maximum power consumption (datasheet 'xx mA')", "5V pin current budget", "weight"], note: "Not stated in the Arduino sources (ProtoPart's 25 g is unverified)." } },
    {
      type: "data_gap",
      params: {
        field: "manufacturer CAD",
        note: "No STEP: the docs.arduino.cc CAD download (A000066-cad-files.zip, CC BY-SA 4.0) holds only the Eagle .brd/.sch. Geometry is generated from the .brd outline, holes and component positions.",
        source: [SRC.product, SRC.cad],
      },
    },
    {
      type: "assumption",
      params: {
        field: "generated geometry and USB lower bound",
        value: "1.6 mm PCB; chamfered 1 mm corners; USB-B body 16 x 12 x 10.9 mm, DC jack 14.2 x 9 x 11 mm; USB supply lower bound 4.5 V",
        reason: "Arduino gives positions but not connector body sizes, PCB thickness, or a minimum USB voltage.",
      },
    },
  ],

  artifacts: [
    { id: "art_datasheet", name: "Arduino UNO R3 datasheet", type: "datasheet", url: SRC.datasheet },
    { id: "art_pinout", name: "Arduino UNO R3 full pinout", type: "documentation", url: SRC.pinout },
    { id: "art_schematic", name: "Arduino UNO R3 schematic", type: "schematic", url: SRC.schematic },
    { id: "art_cad_files", name: "Arduino UNO R3 Eagle CAD files (CC BY-SA 4.0)", type: "pcb", url: SRC.cad },
    { id: "art_product", name: "Arduino UNO R3 documentation", type: "documentation", url: SRC.product },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): representative CAD from the Arduino Eagle board,
// library/cad/py/catalog/arduino-uno-rev3.py (mm; board centre at the origin,
// .brd (x, y) -> (x - 34.29, y - 26.67); PCB bottom z = 0).
// ---------------------------------------------------------------------------

const HDR = {
  iol: feature("header_iol", { area_mm2: 51.613, centroid: [20.32, 24.13, 10.1], normal: [0.0, 0.0, 1.0] }),
  ioh: feature("header_ioh", { area_mm2: 64.516, centroid: [-4.064, 24.13, 10.1], normal: [0.0, 0.0, 1.0] }),
  power: feature("header_power", { area_mm2: 51.613, centroid: [2.54, -24.13, 10.1], normal: [0.0, 0.0, 1.0] }),
  ad: feature("header_ad", { area_mm2: 38.71, centroid: [22.86, -24.13, 10.1], normal: [0.0, 0.0, 1.0] }),
};
const on = (h: keyof typeof HDR) => ({ refs: [HDR[h], own(`header_${h}`)] });
const headerOf = (id: string): keyof typeof HDR => {
  if (JANALOG.some((i) => i.id === id)) return ["a0", "a1", "a2", "a3", "a4", "a5"].includes(id) ? "ad" : "power";
  return ["d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7"].includes(id) ? "iol" : "ioh";
};

export const ARDUINO_UNO_REV3: ModuleDef = withGeometry(
  ARDUINO_UNO_REV3_BASE,
  {
    ...Object.fromEntries([...JANALOG, ...JDIGITAL].map((i) => [i.id, on(headerOf(i.id))])),
    // Shield convention: origin at the midpoint of the diagonal pair (brd
    // (40.005, 19.05) -> (5.715, -7.62)) on the board top, normal +Z out of the
    // top face toward a stacked shield, xAxis from (13.97, 2.54) to (66.04, 35.56).
    mount: {
      frame: { origin: [5.715, -7.62, 1.6], normal: [0, 0, 1], xAxis: [0.844509, 0.535542, 0] },
      refs: [feature("mount", { area_mm2: 32.17, centroid: [5.715, -7.62, 0.8] }), own("mount"), procedural("bolt_pattern")],
    },
    mount_bottom: {
      frame: { origin: [5.715, -7.62, 0], normal: [0, 0, -1], xAxis: [0.844509, 0.535542, 0] },
      refs: [feature("mount", { area_mm2: 32.17, centroid: [5.715, -7.62, 0.8] }), own("mount"), procedural("bolt_pattern")],
    },
    usb: {
      frame: { origin: [-40.64, 11.43, 7.05], normal: [-1, 0, 0], xAxis: [0, 1, 0] },
      refs: [feature("usb", { area_mm2: 130.8, centroid: [-40.64, 11.43, 7.05], normal: [-1.0, 0.0, 0.0] }), own("usb")],
    },
    dc_jack: {
      frame: { origin: [-36.09, -18.288, 7.1], normal: [-1, 0, 0], xAxis: [0, 1, 0] },
      refs: [feature("dc_jack", { area_mm2: 99.0, centroid: [-36.09, -18.288, 7.1], normal: [-1.0, 0.0, 0.0] }), own("dc_jack")],
    },
    uart0: on("iol"),
    i2c: { refs: [HDR.ad, HDR.ioh] },
    spi: on("ioh"),
  },
  cadArtifacts({
    dir: "library/parts/arduino-uno-rev3/artifacts/cad",
    name: "arduino-uno-r3",
    generator: "library/cad/py/catalog/arduino-uno-rev3.py",
    tool: "build123d 0.13.0",
    interfaces: ["mount", "usb", "dc_jack", "header_iol", "header_ioh", "header_power", "header_ad"],
  }),
);
