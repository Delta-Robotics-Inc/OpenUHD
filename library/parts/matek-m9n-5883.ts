/**
 * Matek Systems GNSS & Compass M9N-5883 (u-blox NEO-M9N GNSS + QST
 * QMC5883L/QMC5883P compass) — datasheet-honest UHD part.
 *
 * Current-production replacement for the EOL matek-m10q-5883. Matek names no
 * successor; all its M10 GNSS modules are EOL and the M9N-5883 is its only
 * active UART GNSS + I2C compass module (see ./matek-m9n-5883/.research/identity.md).
 *
 * Sources (see ./matek-m9n-5883/sources.json):
 *   - src_product:      Matek M9N-5883 product page (Specifications, Wiring and
 *                       settings, Tips and Notes) — https://www.mateksys.com/?portfolio=m9n-5883
 *   - src_img_features: Matek gallery image 1 (feature summary) —
 *                       https://www.mateksys.com/wp-content/uploads/2020/10/M9N-5883_1.jpg
 *   - src_img_dims:     Matek gallery image 2 (silkscreen, dimensions) —
 *                       https://www.mateksys.com/wp-content/uploads/2020/10/M9N-5883_2.jpg
 *   - src_qmc5883l:     QST QMC5883L datasheet Rev B (I2C address 0x0D) —
 *                       https://www.qstcorp.com/upload/pdf/202512/13-52-04%20QMC5883L%20Datasheet%20Rev.%20B.pdf
 *   - src_qmc5883p:     QST QMC5883P datasheet Rev E (I2C address 0x2C) —
 *                       https://www.qstcorp.com/upload/pdf/202512/2C939E5AA0704285BC3BE71132B8629B.pdf
 *   - src_bf_qmc5883 / src_inav_qmc5883p: Betaflight and INAV QMC5883P driver
 *                       sources (community, firmware support only).
 *
 * Modelling notes:
 *   - Interface ids match matek-m10q-5883 (vin_5v, gnd, uart_gnss,
 *     i2c_compass, rst) so a system swaps parts by changing moduleDefId.
 *     The connector silkscreen (5V RX TX CL DA G) is also the same.
 *   - Leaves: one per signal on the two JST-GH-6P connectors (wired in
 *     parallel, same silkscreen order) plus the RST pad. Each socket is a
 *     connector composite (`gh6p_1`, `gh6p_2`, PB-805) binding the six
 *     leaves, with its own vendor-CAD feature. The DA/CL/TX/RX/5V/G edge pads
 *     repeat the connector signals and are recorded in the connector note. The VBus, D-, D+, Bt edge pads and the V-USB jumper are
 *     silkscreen only with no stated function, so they are omitted (data gap).
 *   - Supply: 4~5.5 V on the 5V pad/pin, 50 mA (Matek). Covers the FC's
 *     4.5-5 V GPS rail.
 *   - UART: role device, 38400 baud default (Matek). FC firmware reconfigures
 *     the receiver over UBX; only the default is claimed.
 *   - I2C: role slave. Matek: "As of January 2026, the QMC5883L has been
 *     replaced by the QMC5883P." The address parameter is 0x2C (QMC5883P,
 *     current production); units built before then carry a QMC5883L at 0x0D.
 *     Recorded as a source_discrepancy trait. 100/400 kHz from both QST
 *     datasheets.
 *   - Mounting: BoltPattern from the dimension image (26 mm spacing, Φ2 mm
 *     holes, 4 corners). The square shape is confirmed by Matek's STEP
 *     (PB-775); no fastener is named, so the 2 mm fastener diameter is an
 *     `assumption` trait.
 *   - No logic-level voltage on TX/RX/DA/CL and no pull-up claim: not stated
 *     (data gap).
 *   - LEDs have no interface vocabulary; they are usage_notes (gaps.json).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  currentDrawA,
  defineModule,
  PowerIn,
  Ground,
  UART,
  I2C,
  Pin,
  BoltPattern,
  Connector,
  connectorTrait,
} from "../../src/protocols/index.js";
import { feature, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.mateksys.com/?portfolio=m9n-5883",
  imgFeatures: "https://www.mateksys.com/wp-content/uploads/2020/10/M9N-5883_1.jpg",
  imgDims: "https://www.mateksys.com/wp-content/uploads/2020/10/M9N-5883_2.jpg",
  gnssList: "https://www.mateksys.com/?page_id=2849",
  discontinued: "https://www.mateksys.com/?page_id=2853",
  step: "https://www.mateksys.com/Downloads/other/M9N-5883_step.zip",
  qmc5883l:
    "https://www.qstcorp.com/upload/pdf/202512/13-52-04%20QMC5883L%20Datasheet%20Rev.%20B.pdf",
  qmc5883p: "https://www.qstcorp.com/upload/pdf/202512/2C939E5AA0704285BC3BE71132B8629B.pdf",
  bfQmc5883:
    "https://github.com/betaflight/betaflight/blob/master/src/main/drivers/compass/compass_qmc5883.c",
  inavQmc5883p: "https://github.com/iNavFlight/inav/pull/10994",
} as const;

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function amend(ifaces: InterfaceDef[], id: string, traits: TraitDef[]): InterfaceDef[] {
  return ifaces.map((i) => (i.id === id ? withTraits(i, traits) : i));
}

function padFunction(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

// ---------------------------------------------------------------------------
// Leaves — connector pads
// ---------------------------------------------------------------------------

const vin = withTraits(
  PowerIn({ id: "vin_5v", name: "5V", pin: "5V", voltageV: [4, 5.5], nominalV: 5, parameters: [currentDrawA(0.05)] }),
  [
    padFunction(
      "5V — module supply input, 4~5.5 V (\"Input voltage range: 4~5.5V (5V pad/pin)\"); power consumption 50 mA. Wire to flight controller 4~5.5 V.",
      [SRC.product, SRC.imgDims],
    ),
  ],
);

const gnd = withTraits(Ground({ id: "gnd", name: "G", pin: "G" }), [
  padFunction("G — ground. Wire to flight controller GND.", [SRC.product, SRC.imgDims]),
]);

const uart = amend(
  amend(
    amend(
      UART({
        id: "uart_gnss",
        name: "GNSS UART (NEO-M9N)",
        roles: ["device"],
        baudRate: 38400,
        tx: { pin: "TX", name: "TX" },
        rx: { pin: "RX", name: "RX" },
      }),
      "uart_gnss_tx",
      [
        padFunction("TX — GNSS UART transmit. Wire to flight controller UART_RX.", [SRC.product, SRC.imgDims]),
      ],
    ),
    "uart_gnss_rx",
    [
      padFunction("RX — GNSS UART receive. Wire to flight controller UART_TX.", [SRC.product, SRC.imgDims]),
    ],
  ),
  "uart_gnss",
  [
    {
      type: "usage_note",
      params: {
        note: "UART (TX, RX) interface for GNSS NEO-M9N, 38400 baud default. UBX protocol is bidirectional: flight controller firmware changes GNSS settings over UBX, so no u-center setup is needed. Requires INAV 5.0.0, Betaflight 4.3.0, ArduPilot 4.3 or newer.",
        source: SRC.product,
      },
    },
  ],
);

const i2c = amend(
  amend(
    amend(
      I2C({
        id: "i2c_compass",
        name: "Compass I2C (QMC5883P / QMC5883L)",
        roles: ["slave"],
        address: 0x2c,
        clockFreqHz: [100_000, 400_000],
        sda: { pin: "DA", name: "DA" },
        scl: { pin: "CL", name: "CL" },
        maxInstances: 1,
      }),
      "i2c_compass_sda",
      [
        padFunction("DA — I2C data for the compass. Wire to flight controller I2C_SDA.", [SRC.product, SRC.imgDims]),
      ],
    ),
    "i2c_compass_scl",
    [
      padFunction("CL — I2C clock for the compass. Wire to flight controller I2C_SCL.", [SRC.product, SRC.imgDims]),
    ],
  ),
  "i2c_compass",
  [
    {
      type: "usage_note",
      params: {
        note: "I2C (DA, CL) interface for compass QMC5883L/QMC5883P. QMC5883P default 7-bit address 0x2C; QMC5883L default 0x0D. Both support 100 kHz and 400 kHz and require external pull-up resistors on the bus (QST datasheets §5.4). Matek does not state whether pull-ups are fitted on the module.",
        source: [SRC.product, SRC.qmc5883p, SRC.qmc5883l],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "compass IC / I2C address",
        values: ["QMC5883L, 0x0D (units built before January 2026)", "QMC5883P, 0x2C (from January 2026)"],
        sources: [SRC.product, SRC.imgFeatures, SRC.qmc5883l, SRC.qmc5883p],
        resolution:
          "Same SKU, compass changed in production (\"As of January 2026, the QMC5883L has been replaced by the QMC5883P\"). Modelled as QMC5883P / 0x2C (current production). Check the unit: a pre-2026 unit answers at 0x0D.",
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "compass firmware support",
        note: "QMC5883P needs newer firmware than Matek's stated minimums: Betaflight's unified QMC5883 driver (src/main/drivers/compass/compass_qmc5883.c) detects QMC5883L (0x0D) and QMC5883P (0x2C). QMC5883P units need Betaflight >= 2025.12.1, INAV >= 9.0.0 (compass_qmc5883p.c), ArduPilot >= 4.5.0 (AP_Compass_QMC5883P.cpp), per the release tags checked in the independent audit.",
        source: [SRC.bfQmc5883, SRC.inavQmc5883p],
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Leaves — service pad
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sockets (PB-805): two parallel JST-GH-6P, same silkscreen order
// ---------------------------------------------------------------------------

const GH6P_PINS: [string, string][] = [["5V", "vin_5v"], ["RX", "uart_gnss_rx"], ["TX", "uart_gnss_tx"], ["CL", "i2c_compass_scl"], ["DA", "i2c_compass_sda"], ["G", "gnd"]];
const GH6P_NOTE =
  "JST-GH-6P, two connectors fitted, both silkscreened 5V RX TX CL DA G (same order as the M10Q-5883). Pin 1 is not marked by the source, so the order is silkscreen order. The same signals are also on edge pads (G DA CL TX RX 5V). A 20 cm JST-GH-6P to JST-GH-6P silicone lead is included.";
const gh6p = (n: 1 | 2) =>
  Connector({ id: `gh6p_${n}`, name: `GH6P-${n} socket`, connector: "jst_gh_6", gender: "receptacle", pins: GH6P_PINS, note: GH6P_NOTE });

const rst = withTraits(
  Pin({ id: "rst", name: "RST", pin: "RST", capabilities: { inputOnly: true }, defaultActive: false }),
  [
    padFunction(
      "RST — receiver reset pad. Bridging RST to ground for at least 100 ms triggers a cold start and deletes all stored information; recovery use only (e.g. when the FC cannot detect the GNSS module).",
      [SRC.product, SRC.imgDims],
    ),
    connectorTrait("solder_pad", { note: "Pad labelled \"RST\" beside the NEO-M9N module on the component side." }),
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
    shape: "square",
    spacingMm: 26,
    holeCount: 4,
    fastener: "Φ2 mm hole (fastener not named)",
    fastenerDiameterMm: 2,
    threaded: false,
    note: "Four corner holes, Φ2 mm, 26 mm spacing on a 32 x 32 mm board with R3 mm corners.",
  }),
  [
    {
      type: "usage_note",
      params: {
        note: "Hole pattern confirmed by Matek's STEP (PB-775): four Φ2.1 mm holes at (±13, ±13) mm, a 26 x 26 mm square centred on the 32 x 32 mm board. Previously an assumption from the single 26 mm dimension on the drawing.",
        source: SRC.step,
      },
    },
    {
      type: "assumption",
      params: {
        field: "fastener diameter",
        value: "2 mm",
        reason: "Matek gives the hole diameter (Φ2 mm) but names no fastener; the hole diameter is used as the fastener upper bound.",
        source: SRC.imgDims,
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const MATEK_M9N_5883_BASE: ModuleDef = defineModule({
  id: "matek-m9n-5883",
  name: "Matek M9N-5883 GNSS & Compass",
  version: "1.0.0",
  manufacturer: "Matek Systems",
  part_number: "M9N-5883",
  description:
    "Matek Systems M9N-5883 GNSS and compass module: u-blox NEO-M9N concurrent receiver (GPS, GLONASS, Galileo, BeiDou) with a 25x25x4 mm patch antenna, plus a QMC5883P (0x2C; QMC5883L 0x0D on pre-2026 units) magnetometer on I2C. 4-5.5 V input, 50 mA, UART at 38400 baud default, two JST-GH-6P connectors, 32x32x10 mm, 14.5 g. Matek's current replacement for the EOL M10Q-5883.",
  tags: ["gnss", "gps", "compass", "magnetometer", "u-blox", "neo-m9n", "qmc5883p", "qmc5883l", "uart", "i2c", "jst-gh", "fpv", "matek"],
  categories: ["sensor", "sensor.gnss", "drone.gnss"],

  interfaces: [vin, gnd, ...uart, ...i2c, gh6p(1), gh6p(2), rst, mount],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vin_5v", name: "5V input", nominal_voltage_V: 5, voltage_range_V: [4, 5.5], max_current_mA: 50 },
      ],
      metadata: {
        supply_current_mA: 50,
        supply_current_note: "\"Power consumption: 50mA\" (Matek Specifications).",
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 32, width: 32, height: 10 },
      weight_g: 14.5,
      metadata: {
        corner_radius_mm: 3,
        mounting_holes: "4x Φ2 mm, 26 mm spacing",
        patch_antenna_mm: [25, 25, 4],
        cad: "M9N-5883_step.zip (STEP model linked from the Matek product page)",
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: [-20, 80],
    },
    {
      domain: "network",
      metadata: {
        gnss_receiver: "u-blox NEO-M9N",
        constellations: ["GPS", "GLONASS", "Galileo", "BeiDou"],
        antenna: "integrated 25x25x4 mm patch (Cirocomm PA025AZ0009, formerly Taoglas), no external antenna connector",
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "gnss",
        receiver: "u-blox NEO-M9N (concurrent reception of GPS, Galileo, GLONASS, BeiDou)",
        constellations: ["GPS", "GLONASS", "Galileo", "BeiDou"],
        antenna: "25 x 25 x 4 mm patch; Taoglas replaced by Cirocomm PA025AZ0009 (\"Both antennas perform the same\")",
        compass: "QST QMC5883P (from January 2026) or QMC5883L 3-axis magnetometer",
        source: [SRC.product, SRC.imgFeatures],
      },
    },
    {
      type: "data_gap",
      params: {
        field: "GNSS update rate, sensitivity, TTFF, position accuracy",
        note: "Not stated by Matek for the M9N-5883.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "UART / I2C logic level and I2C pull-ups on the connector",
        note: "Not stated by Matek.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "edge pads VBus, D-, D+, Bt and V-USB jumper",
        note: "Silkscreened on the board (gallery image 2) but Matek states no function, so they are not modelled.",
      },
    },
    {
      type: "operating_conditions",
      params: {
        operating_temperature_C: [-20, 80],
        supply_voltage_V: [4, 5.5],
        supply_current_mA: 50,
        source: SRC.product,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "compass alignment",
        note: "Mount flat; tilting the magnetometer is strongly discouraged. INAV/Betaflight: compass arrow forward → set CW 270° Flip (with FC arrow forward); compass arrow backward → CW 90° Flip. ArduPilot/Mission Planner: Rotation None. Keep the compass 10 cm away from power lines, ESC, motors and iron-based material.",
        source: SRC.product,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "backup / settings retention",
        note: "NEO-M9N has no dataflash: settings are held only while powered or by the on-board supercapacitor, and revert to default once it runs out.",
        source: SRC.product,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "status LEDs",
        note: "3.3V power LED, red. GNSS PPS LED, green, blinking 1 Hz when GNSS has a 3D fix. From u-blox FW 3.01 the timepulse is UTC-aligned and valid only after the leap second is downloaded (up to 12.5 min), so the LED may not blink immediately after the 3D fix.",
        source: SRC.product,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "wiring",
        note: "5V → FC 4~5.5 V; RX → FC UART_TX; TX → FC UART_RX; CL → FC I2C_SCL; DA → FC I2C_SDA; G → FC GND.",
        source: SRC.product,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "lifecycle / replacement",
        note: "Listed as an active product on Matek's GNSS page. Matek names no successor for the EOL M10Q-5883 (all its M10 GNSS modules are on the Discontinued page); this is its only current UART GNSS + I2C compass module. Versus the M10Q-5883: same connector silkscreen and wiring, but 32x32x10 mm / 14.5 g (vs 20x20x12.4 mm / 8 g), 50 mA (vs 13 mA), 38400 default baud (vs 9600), and adds mounting holes.",
        source: [SRC.gnssList, SRC.discontinued, SRC.product],
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "Matek M9N-5883 product page", type: "datasheet", url: SRC.product },
    { id: "art_img_features", name: "M9N-5883 feature summary image", type: "documentation", url: SRC.imgFeatures },
    { id: "art_img_dims", name: "M9N-5883 dimensions / silkscreen image", type: "documentation", url: SRC.imgDims },
    { id: "art_qmc5883p", name: "QST QMC5883P datasheet Rev E", type: "datasheet", url: SRC.qmc5883p },
    { id: "art_qmc5883l", name: "QST QMC5883L datasheet Rev B", type: "datasheet", url: SRC.qmc5883l },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-775), direction "vendor": bound to the manufacturer's own STEP
// by the names Matek gave its components. Nothing is modelled here; the
// STEP is not committed (redistribution terms not stated) and is fetched by
// the part research into .research/cad. library/cad/py/gnss_vendor.py
// converts it for viewers and writes the committed manifest, so bindings can
// be checked without the vendor file.
//
// Vendor CAD evidence (M9N-5883_step.zip): 32 x 32 x 0.62 mm board, 4 x Φ2.1
// holes on a 26 x 26 mm square centred on the board, R3 corners; patch
// antenna on the underside (-Z), components and both JST-GH-6P sockets on
// +Z reaching 4.35 mm. So the module mounts component side down, antenna up,
// on >= 4.5 mm standoffs.
// ---------------------------------------------------------------------------

export const MATEK_M9N_5883: ModuleDef = withGeometry(
  MATEK_M9N_5883_BASE,
  {
    // Normal +Z is the component side facing the frame. No symmetryDeg: the
    // hole square repeats every 90° but the compass does not — rotating the
    // module changes Betaflight align_mag.
    mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      refs: [
        feature("mount", { area_mm2: 16.46, centroid: [0.0, 0.0, -0.312] }, "cad_vendor_step"),
        { kind: "artifact", artifact: "cad_vendor_if_mount" },
        procedural("bolt_pattern"),
      ],
    },
    // Each socket is its own connector at its own place in the vendor STEP.
    gh6p_1: { refs: [feature("GH6P-1", { area_mm2: 333.419, centroid: [13.362, 0.0, 2.213] }, "cad_vendor_step")] },
    gh6p_2: { refs: [feature("GH6P-2", { area_mm2: 333.419, centroid: [-13.362, 0.0, 2.213] }, "cad_vendor_step")] },
    // Both sockets carry the same six signals (5V RX TX CL DA G), so each
    // interface on them has two alternative physical locations.
    uart_gnss: { refs: [feature("GH6P-1", { area_mm2: 333.419, centroid: [13.362, 0.0, 2.213] }, "cad_vendor_step"), feature("GH6P-2", { area_mm2: 333.419, centroid: [-13.362, 0.0, 2.213] }, "cad_vendor_step")] },
    i2c_compass: { refs: [feature("GH6P-1", { area_mm2: 333.419, centroid: [13.362, 0.0, 2.213] }, "cad_vendor_step"), feature("GH6P-2", { area_mm2: 333.419, centroid: [-13.362, 0.0, 2.213] }, "cad_vendor_step")] },
    vin_5v: { refs: [feature("GH6P-1", { area_mm2: 333.419, centroid: [13.362, 0.0, 2.213] }, "cad_vendor_step"), feature("GH6P-2", { area_mm2: 333.419, centroid: [-13.362, 0.0, 2.213] }, "cad_vendor_step")] },
    gnd: { refs: [feature("GH6P-1", { area_mm2: 333.419, centroid: [13.362, 0.0, 2.213] }, "cad_vendor_step"), feature("GH6P-2", { area_mm2: 333.419, centroid: [-13.362, 0.0, 2.213] }, "cad_vendor_step")] },
  },
  [
    {
      id: "cad_vendor_step",
      name: "M9N-5883 STEP (Matek)",
      type: "3d_model",
      role: "source",
      format: "step",
      units: "mm",
      url: SRC.step,
      filePath: "library/parts/matek-m9n-5883/.research/cad/M9N-5883.step",
      description: "Manufacturer STEP with named components (Board, GH6P-1, GH6P-2, MAG, ANTENNA, GPS, …). Not committed.",
      provenance: { tool: "manufacturer", sourceDigest: "0b3cb5cd696a2982639e4c7bc7bd24bb720b7a4fc0e2f60d088e5903134e5272" },
    },
    {
      id: "cad_vendor_glb",
      name: "M9N-5883 (GLB)",
      type: "3d_model",
      role: "body",
      format: "glb",
      units: "m",
      filePath: "library/parts/matek-m9n-5883/artifacts/cad/vendor/M9N-5883.glb",
      description: "Converted locally from the vendor STEP by library/cad/py/gnss_vendor.py (gitignored).",
      provenance: { generatedFrom: "cad_vendor_step", tool: "build123d 0.13.0" },
    },
    {
      id: "cad_vendor_manifest",
      name: "M9N-5883 vendor component manifest",
      type: "cad",
      role: "source",
      format: "json",
      filePath: "library/parts/matek-m9n-5883/artifacts/cad/matek-m9n-5883-vendor.manifest.json",
      provenance: { generatedFrom: "cad_vendor_step", tool: "build123d 0.13.0" },
    },
    {
      id: "cad_vendor_if_mount",
      name: "mount geometry",
      type: "3d_model",
      role: "interface",
      interfaceId: "mount",
      format: "glb",
      units: "m",
      filePath: "library/parts/matek-m9n-5883/artifacts/cad/vendor/interfaces/mount.glb",
      provenance: { generatedFrom: "cad_vendor_step", tool: "build123d 0.13.0" },
    },
  ],
);
