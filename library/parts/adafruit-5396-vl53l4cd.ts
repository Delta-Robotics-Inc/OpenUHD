/**
 * Adafruit VL53L4CD Time of Flight Distance Sensor breakout (product 5396,
 * STEMMA QT / Qwiic) — datasheet-honest UHD part.
 *
 * Sources (see ./adafruit-5396-vl53l4cd/sources.json):
 *   - src_learn_guide:   Adafruit Learn guide PDF (Overview, Pinouts, Downloads) —
 *                        https://learn.adafruit.com/adafruit-vl53l4cd-time-of-flight-distance-sensor.pdf
 *   - src_learn_pinouts: the guide's Pinouts page —
 *                        https://learn.adafruit.com/adafruit-vl53l4cd-time-of-flight-distance-sensor/pinouts
 *   - src_product:       Adafruit product page 5396 (technical details, dimensions, weight) —
 *                        https://www.adafruit.com/product/5396
 *   - src_pcb:           Adafruit-VL53L4CD-PCB EagleCAD schematic + board (CC BY-SA 3.0) —
 *                        https://github.com/adafruit/Adafruit-VL53L4CD-PCB
 *   - src_st_datasheet:  ST VL53L4CD datasheet DS13812 Rev 8 —
 *                        https://www.st.com/resource/en/datasheet/vl53l4cd.pdf
 *   - src_cad:           Adafruit_CAD_Parts STEP (MIT, committed) —
 *                        https://raw.githubusercontent.com/adafruit/Adafruit_CAD_Parts/main/5396%20VL53L4CD%20Sensor/5396%20Adafruit%20VL53L4CD.step
 *   - src_protopart:     ProtoPart adafruit-vl53l4cd-breakout (community starting
 *                        point; every value re-verified against the sources above).
 *
 * Modelling notes:
 *   - Leaves: one per header pin, in the Eagle JP2 order 1 VIN, 2 GND, 3 SCL,
 *     4 SDA, 5 GPIO, 6 XSHUT (schematic). The two STEMMA QT (JST-SH-4)
 *     sockets are wired in parallel with VIN/GND/SDA/SCL (schematic nets), so
 *     they are recorded as connector traits on those leaves and as two
 *     alternative geometry refs, like the Matek M9N-5883's two GH sockets.
 *   - Supply: VIN 3-5 V (Adafruit: "any 3-5V power or logic"), feeding an
 *     LP5907-2.8 regulator for the 2.8 V sensor rail (schematic). Current is
 *     the sensor's: 22 mA typ / 24 mA max ranging, 40 mA peak (ST Table 14);
 *     the LED and regulator quiescent current are not stated (data gap).
 *   - I2C: slave at 0x29 (Adafruit; ST gives the 8-bit form 0x52), up to
 *     1 MHz (ST). The breakout adds a BSS138 level shifter with 10K pull-ups
 *     to VIN on the header side (Adafruit + schematic), so the bus runs at the
 *     VIN level. Adafruit does not state a maximum clock for the shifted bus:
 *     the 1 MHz is the sensor's, recorded as an assumption.
 *   - GPIO: the sensor's open-drain interrupt (ST), pulled up to 2.8 V on the
 *     board (R2 10K) and not level shifted: 2.8 V logic (Adafruit).
 *   - XSHUT: active low, through a 1N4148 diode with a 10K pull-up to 2.8 V
 *     (schematic), so 3 V or 5 V logic may drive it low and leaving it
 *     unconnected keeps the sensor enabled.
 *   - Mounting: four Φ2.5 mm plated holes (Eagle .brd and STEP agree) on a
 *     20.32 x 12.7 mm rectangle centred on the 25.4 x 17.78 mm board. No
 *     fastener is named: fastener diameter 2.5 mm is an `assumption` trait.
 *   - Geometry: Adafruit's own STEP (MIT) is committed and bound by vendor
 *     component names / hole diameters; the mount frame is on the board's
 *     bottom face with the normal pointing away from the sensor side.
 *   - The LED-cut jumper on the back is a usage note only (no interface).
 *   - ProtoPart vs sources: dimensions 25.5 x 17.7 x 4.6 mm match the product
 *     page (the board file gives 25.4 x 17.78 mm); range 1-1200 mm is ST's
 *     full-FoV figure, while Adafruit's title says ~1 to 1300 mm (ST Table 16
 *     at 50 % detection). ProtoPart's "vdd_sensor 2.6-3.5 V" is the sensor
 *     AVDD range; on this board it is a fixed 2.8 V regulator output.
 *     See the source_discrepancy traits.
 *   - verify-part warnings: none expected beyond those justified here.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  BoltPattern,
  Ground,
  I2C,
  Pin,
  PowerIn,
  connectorTrait,
  defineModule,
} from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  learnGuide: "https://learn.adafruit.com/adafruit-vl53l4cd-time-of-flight-distance-sensor.pdf",
  learnPinouts: "https://learn.adafruit.com/adafruit-vl53l4cd-time-of-flight-distance-sensor/pinouts",
  product: "https://www.adafruit.com/product/5396",
  pcb: "https://github.com/adafruit/Adafruit-VL53L4CD-PCB",
  stDatasheet: "https://www.st.com/resource/en/datasheet/vl53l4cd.pdf",
  cad: "https://raw.githubusercontent.com/adafruit/Adafruit_CAD_Parts/main/5396%20VL53L4CD%20Sensor/5396%20Adafruit%20VL53L4CD.step",
  protopart:
    "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/adafruit-vl53l4cd-breakout/definition.json",
} as const;

const VIN_RANGE: [number, number] = [3, 5];

const HEADER = (pin: number, label: string): TraitDef =>
  connectorTrait("pin_header_2.54mm", {
    positions: 6,
    pinout: ["VIN", "GND", "SCL", "SDA", "GPIO", "XSHUT"],
    note: `Header pin ${pin} (${label}); 1x6 0.1 in through-hole pads, header not soldered on (Eagle JP2).`,
  });

/** Two STEMMA QT sockets in parallel (CONN3, CONN4). */
const STEMMA_QT = connectorTrait("jst_sh_4", {
  gender: "receptacle",
  positions: 4,
  pinout: ["GND", "V+", "SDA", "SCL"],
  note: "Two STEMMA QT / Qwiic JST-SH-4 sockets (one on each short edge), wired in parallel with the header's VIN, GND, SDA and SCL (pad 1 GND, 2 V+, 3 SDA, 4 SCL: Eagle STEMMA_I2C _QT device). Black or tan housings, same function (product page).",
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function amend(ifaces: InterfaceDef[], id: string, traits: TraitDef[]): InterfaceDef[] {
  return ifaces.map((i) => (i.id === id ? withTraits(i, traits) : i));
}

function pinFunction(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

// ---------------------------------------------------------------------------
// Leaves — header pins (and STEMMA QT)
// ---------------------------------------------------------------------------

const vin = withTraits(
  PowerIn({ id: "vin", name: "VIN", pin: "VIN", voltageV: VIN_RANGE, nominalV: 3.3 }),
  [
    pinFunction(
      "VIN — \"This is the power pin. To power the board, give it the same power as the logic level of your microcontroller - e.g. for a 3V microcontroller like a Feather M4, use 3V, or for a 5V microcontroller like Arduino, use 5V.\" Feeds the LP5907-2.8 regulator (2.8 V sensor rail) and the I2C pull-ups; also V+ on both STEMMA QT sockets.",
      [SRC.learnGuide, SRC.pcb],
    ),
    HEADER(1, "VIN"),
    STEMMA_QT,
  ],
);

const gnd = withTraits(Ground({ id: "gnd", name: "GND", pin: "GND" }), [
  pinFunction("GND — \"common ground for power and logic.\" Also GND on both STEMMA QT sockets.", [SRC.learnGuide, SRC.pcb]),
  HEADER(2, "GND"),
  STEMMA_QT,
]);

const i2c = amend(
  amend(
    amend(
      I2C({
        id: "i2c",
        name: "I2C (VL53L4CD, level shifted)",
        roles: ["slave"],
        address: 0x29,
        clockFreqHz: [100_000, 1_000_000],
        sda: { pin: "SDA", name: "SDA", voltageV: VIN_RANGE },
        scl: { pin: "SCL", name: "SCL", voltageV: VIN_RANGE },
        maxInstances: 1,
      }),
      "i2c_sda",
      [
        pinFunction("SDA — \"I2C data pin, connect to your microcontroller I2C data line. There's a 10K pullup on this pin.\" (pull-up to VIN; BSS138 level shifter to the 2.8 V sensor side).", [SRC.learnGuide, SRC.pcb]),
        HEADER(4, "SDA"),
        STEMMA_QT,
      ],
    ),
    "i2c_scl",
    [
      pinFunction("SCL — \"I2C clock pin, connect to your microcontroller I2C clock line. There's a 10K pullup on this pin.\" (pull-up to VIN; BSS138 level shifter to the 2.8 V sensor side).", [SRC.learnGuide, SRC.pcb]),
      HEADER(3, "SCL"),
      STEMMA_QT,
    ],
  ),
  "i2c",
  [
    {
      type: "usage_note",
      params: {
        note: "Default 7-bit address 0x29 (Adafruit); ST writes it as 0x52/0x53 (8-bit write/read). The address can be changed in firmware; to put several sensors on one bus, hold the others in XSHUT while re-addressing (ST API). Fast mode 400 kHz and fast mode plus 1 MHz (ST §2.4, Tables 5-6).",
        source: [SRC.learnGuide, SRC.stDatasheet],
      },
    },
    {
      type: "assumption",
      params: {
        field: "I2C clock on the breakout",
        value: "up to 1 MHz",
        reason: "1 MHz is the VL53L4CD's own limit (ST). Adafruit states no maximum for the board's BSS138 level shifter with 10K pull-ups, which may not reach 1 MHz on a loaded bus.",
        source: [SRC.stDatasheet, SRC.pcb],
      },
    },
  ],
);

const gpio: InterfaceDef = {
  id: "gpio",
  name: "GPIO (interrupt out)",
  pin: "GPIO",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "digital", roles: ["output"] }],
  capabilities: ["interrupt_out"],
  parameters: [{ id: "voltage", unit: "V", value: 2.8 }],
  traits: [
    pinFunction(
      "GPIO — \"This is the interrupt output pin, it is 2.8V logic level output - it can be read by 3.3V and most 5V logic microcontrollers.\" The sensor's GPIO1 is an open-drain interrupt output (ST Table 4), pulled up to the 2.8 V rail by R2 10K on the board, with no level shifter.",
      [SRC.learnGuide, SRC.stDatasheet, SRC.pcb],
    ),
    HEADER(5, "GPIO"),
  ],
};

const xshut = withTraits(
  Pin({ id: "xshut", name: "XSHUT", pin: "XSHUT", voltageV: VIN_RANGE, capabilities: { inputOnly: true } }),
  [
    pinFunction(
      "XSHUT — \"This is the shutdown pin. It is active low, and is logic-level shifted so you can use 3V or 5V logic.\" On the board it reaches the sensor through a 1N4148 diode (cathode to the pin) with a 10K pull-up to 2.8 V, so the pin only pulls XSHUT low; unconnected, the sensor stays enabled. Low = hardware standby (ST §3.3).",
      [SRC.learnGuide, SRC.pcb, SRC.stDatasheet],
    ),
    HEADER(6, "XSHUT"),
  ],
);

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const mount = withTraits(
  BoltPattern({
    id: "mount",
    name: "Mounting holes",
    role: "component",
    shape: "rectangle",
    spacingMm: 20.32,
    spacingYmm: 12.7,
    holeCount: 4,
    fastener: "Φ2.5 mm plated hole (fastener not named)",
    fastenerDiameterMm: 2.5,
    threaded: false,
    note: "Four Φ2.5 mm plated holes at (2.54, 2.54), (22.86, 2.54), (2.54, 15.24), (22.86, 15.24) mm on the 25.4 x 17.78 mm board (Eagle .brd and Adafruit STEP agree): a 20.32 x 12.7 mm rectangle centred on the sensor.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "fastener diameter",
        value: "2.5 mm",
        reason: "Adafruit gives the drill (2.5 mm, Eagle MOUNTINGHOLE_2.5_PLATED) but names no fastener; the hole diameter is used as the fastener upper bound (M2 fits; M2.5 is a tight fit).",
        source: [SRC.pcb, SRC.cad],
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const ADAFRUIT_5396_VL53L4CD_BASE: ModuleDef = defineModule({
  id: "adafruit-5396-vl53l4cd",
  name: "Adafruit VL53L4CD Time of Flight Distance Sensor (STEMMA QT)",
  version: "1.0.0",
  manufacturer: "Adafruit Industries",
  part_number: "5396",
  description:
    "Adafruit breakout (product 5396) for the ST VL53L4CD time-of-flight proximity sensor: 940 nm Class 1 VCSEL, 0-1200 mm with full 18° diagonal FoV (1300 mm typical at 50 % detection on a white target), linear from 1 mm, up to 100 Hz. 3-5 V supply and logic via an LP5907-2.8 regulator and BSS138 I2C level shifter; I2C at 0x29 on a 6-pin header and two STEMMA QT / Qwiic sockets; 2.8 V open-drain interrupt (GPIO) and active-low XSHUT. 25.4 x 17.78 mm board, four Φ2.5 mm holes, 1.8 g.",
  tags: ["vl53l4cd", "tof", "time-of-flight", "distance", "proximity", "i2c", "0x29", "stemma-qt", "qwiic", "interrupt", "xshut", "adafruit", "breakout"],
  categories: ["sensor", "sensor.distance", "expansion.breakout"],

  interfaces: [vin, gnd, ...i2c, gpio, xshut, mount],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vin", name: "VIN (3-5 V)", nominal_voltage_V: 3.3, voltage_range_V: VIN_RANGE, max_current_mA: 40 },
        { id: "vdd_2v8", name: "2.8 V sensor rail (LP5907-2.8 output, internal)", nominal_voltage_V: 2.8 },
      ],
      metadata: {
        regulator: "LP5907-2.8 (U3), VIN to 2.8 V",
        level_shifter: "BSS138 dual N-MOSFET (Q3) on SDA/SCL, 10K pull-ups both sides (R7)",
        sensor_current_mA: { hw_standby_uA_typ: 5, ranging_avg_typ: 22, ranging_avg_max: 24, peak: 40 },
        current_note: "Sensor figures only (ST Table 14, 2.8 V, 23 °C, AVDD + AVDDVCSEL); the power LED and regulator quiescent current are not stated.",
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 25.4, width: 17.78, height: 4.53 },
      weight_g: 1.8,
      metadata: {
        product_page_dimensions_mm: [25.5, 17.7, 4.6],
        board_thickness_mm: 1.6,
        corner_radius_mm: 2.54,
        mounting_holes: "4x Φ2.5 mm plated, 20.32 x 12.7 mm rectangle",
        sensor_position: "VL53L4CD at the board centre on the top face, facing +Z",
        cad: "Adafruit_CAD_Parts 5396 STEP (MIT), committed",
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: [-30, 85],
      metadata: { note: "Sensor ambient operating range (ST Table 10); Adafruit gives no board-level rating." },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "distance_sensor",
        sensor: "ST VL53L4CD",
        emitter: "940 nm VCSEL, Class 1",
        range_mm: "0 to 1200 mm with full FoV; linear from 1 mm; typical max 1200 mm @ 90 % / 1300 mm @ 50 % detection, white 88 % target indoors, 33 ms budget (outdoor overcast 550 / 600 mm)",
        fov_deg: 18,
        max_ranging_frequency_Hz: 100,
        source: [SRC.stDatasheet, SRC.product],
      },
    },
    {
      type: "operating_conditions",
      params: {
        operating_temperature_C: [-30, 85],
        supply_voltage_V: VIN_RANGE,
        note: "Temperature is the sensor's (ST Table 10); supply is the board's VIN (Adafruit).",
        source: [SRC.stDatasheet, SRC.learnGuide],
      },
    },
    {
      type: "absolute_maximum",
      params: {
        note: "Sensor pins AVDD, SCL, SDA, XSHUT, GPIO1: -0.5 to 3.6 V (ST Table 11). On the breakout, VIN/SDA/SCL/XSHUT are buffered (regulator, level shifter, diode) for 3-5 V; GPIO connects straight to the sensor pin, so do not pull it above 3.6 V. Storage -40 to 125 °C.",
        source: [SRC.stDatasheet, SRC.pcb],
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "LED jumper",
        note: "\"This jumper is located on the back of the board. Cut the trace on this jumper to cut power to the 'on' LED.\"",
        source: SRC.learnGuide,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "laser safety and aperture",
        note: "The 940 nm emitter is Class 1 (ST). Keep the sensor aperture clear; the sensor can work behind a cover window (ST features).",
        source: SRC.stDatasheet,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "board revision",
        note: "From 20 Nov 2023 the PCB has the Pinguin silkscreen; boards with the older vector-font silkscreen are otherwise identical, and the STEMMA QT sockets may be black or tan.",
        source: SRC.product,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "ranging distance",
        values: ["1-1200 mm (ProtoPart)", "0 to 1200 mm full FoV, linear from 1 mm (ST features, §6.2)", "~1 to 1300 mm (Adafruit product title)", "1300 mm typical @ 50 % detection (ST Table 16)"],
        sources: [SRC.protopart, SRC.stDatasheet, SRC.product],
        resolution: "No conflict of substance: 1200 mm is the full-FoV figure at 90 % detection and 1300 mm the typical at 50 % detection (white target, indoors). Both recorded in the performance trait.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "board dimensions",
        values: ["25.5 x 17.7 x 4.6 mm (product page, ProtoPart)", "25.4 x 17.78 mm board, 4.53 mm over the STEMMA QT sockets (Eagle .brd, STEP)"],
        sources: [SRC.product, SRC.protopart, SRC.pcb, SRC.cad],
        resolution: "Product page rounds the 1.0 x 0.7 in board; the board file and STEP are used for geometry.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "sensor supply",
        values: ["vdd_sensor 2.6-3.5 V (ProtoPart)", "AVDD 2.6-3.5 V (ST Table 12)", "fixed 2.8 V from the LP5907-2.8 (schematic)"],
        sources: [SRC.protopart, SRC.stDatasheet, SRC.pcb],
        resolution: "ProtoPart quoted the bare sensor's range. On the breakout the sensor rail is the regulator's fixed 2.8 V and is not exposed on a pin; modelled as an internal power domain only.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "board supply current",
        note: "Adafruit states no total current; only the sensor's (ST Table 14) is known. LED and LP5907 quiescent current are not given on the product page or guide.",
      },
    },
  ],

  artifacts: [
    { id: "art_learn_guide", name: "Adafruit VL53L4CD Learn guide (PDF)", type: "documentation", url: SRC.learnGuide },
    { id: "art_product_page", name: "Adafruit product 5396", type: "documentation", url: SRC.product },
    { id: "art_pcb", name: "Adafruit-VL53L4CD-PCB (EagleCAD, CC BY-SA 3.0)", type: "schematic", url: SRC.pcb },
    { id: "art_st_datasheet", name: "ST VL53L4CD datasheet DS13812 Rev 8", type: "datasheet", url: SRC.stDatasheet },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796), vendor CAD: Adafruit's STEP (MIT), committed. Same
// coordinates as the Eagle board: origin at the lower-left board corner,
// board bottom z = 0, top z = 1.6, sensor facing +Z. Numbers from the
// manifest (artifacts/cad/adafruit-5396-vl53l4cd-vendor.manifest.json).
// ---------------------------------------------------------------------------

const QT_1 = vendorFeature("stemma_qt_1", { area_mm2: 163.833, centroid: [2.352, 8.89, 3.078] });
const QT_2 = vendorFeature("stemma_qt_2", { area_mm2: 163.833, centroid: [23.048, 8.89, 3.078] });
const HEADER_HOLES = vendorFeature("header", { area_mm2: 29.594, centroid: [12.7, 2.54, 0.785] });

export const ADAFRUIT_5396_VL53L4CD: ModuleDef = withGeometry(
  ADAFRUIT_5396_VL53L4CD_BASE,
  {
    // Holes at (12.7 ± 10.16, 8.89 ± 6.35, z). Frame on the bottom face,
    // normal -Z (the side a mounting plate comes from; the sensor looks +Z).
    // symmetryDeg 180: turning the board end-for-end keeps the sensing axis
    // and hole rectangle; only the connector sides swap.
    mount: {
      frame: { origin: [12.7, 8.89, 0], normal: [0, 0, -1], xAxis: [1, 0, 0], symmetryDeg: 180 },
      refs: [vendorFeature("mount", { area_mm2: 49.323, centroid: [12.7, 8.89, 0.785] }), vendorOwn("mount"), procedural("bolt_pattern")],
    },
    // Header-and-socket signals: header row plus either STEMMA QT socket.
    vin: { refs: [HEADER_HOLES, QT_1, QT_2] },
    gnd: { refs: [HEADER_HOLES, QT_1, QT_2] },
    i2c: { refs: [HEADER_HOLES, QT_1, QT_2] },
    i2c_sda: { refs: [HEADER_HOLES, QT_1, QT_2] },
    i2c_scl: { refs: [HEADER_HOLES, QT_1, QT_2] },
    // Header only.
    gpio: { refs: [HEADER_HOLES] },
    xshut: { refs: [HEADER_HOLES] },
  },
  vendorCadArtifacts({
    partId: "adafruit-5396-vl53l4cd",
    name: "5396-Adafruit-VL53L4CD",
    url: SRC.cad,
    stepFile: "5396-Adafruit-VL53L4CD.step",
    sha256: "cc5d1703c2866f5ae976983377cd6242deacab597ac12354c698209f2d79880f",
    licence: "MIT (Copyright (c) 2016 Adafruit Industries); committed with the licence text",
    committedStep: "library/parts/adafruit-5396-vl53l4cd/artifacts/cad/5396-Adafruit-VL53L4CD.step",
    interfaces: ["mount", "stemma_qt_1", "stemma_qt_2"],
  }),
);
