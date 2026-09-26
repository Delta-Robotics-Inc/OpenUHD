/**
 * Matek Systems GNSS & Compass M10Q-5883 (u-blox M10 GNSS + QST QMC5883L
 * compass) — datasheet-honest UHD part.
 *
 * Sources (see ./matek-m10q-5883/sources.json):
 *   - src_product:      Matek M10Q-5883 product page (Specifications, Wiring
 *                       and settings, Tips and Notes) — https://www.mateksys.com/?portfolio=m10q-5883
 *   - src_img_dims:     Matek gallery image 2 (bottom silkscreen, dimensions) —
 *                       https://www.mateksys.com/wp-content/uploads/2023/03/M10Q-5883_2.jpg
 *   - src_img_compare:  Matek gallery image 4 (M10/M10Q/M8Q comparison) —
 *                       https://www.mateksys.com/wp-content/uploads/2023/03/M10Q-5883_4.jpg
 *   - src_img_features: Matek gallery image 1 (feature summary) —
 *                       https://www.mateksys.com/wp-content/uploads/2023/03/M10Q-5883_1.jpg
 *   - src_qmc5883l:     QST QMC5883L datasheet Rev B (component datasheet, for
 *                       the compass I2C address and bus speed) —
 *                       https://www.qstcorp.com/upload/pdf/202512/13-52-04%20QMC5883L%20Datasheet%20Rev.%20B.pdf
 *
 * Modelling notes:
 *   - The manufacturer page marks the product "(EOL)" (checked 2026-09-26).
 *     Identity is still fully documented by Matek, so the part is authored;
 *     the EOL status is recorded in a usage_note.
 *   - Leaves: one per signal on the JST-GH-6P connectors (5V, G, TX, RX, DA,
 *     CL) plus the documented bottom "Rst" pad. The board carries TWO
 *     JST-GH-6P connectors with the same silkscreen order (5V RX TX CL DA G);
 *     they are wired in parallel, so each signal is one leaf and the
 *     connector trait records both positions. Matek does not mark pin 1; the
 *     pinout is given in silkscreen order (data gap).
 *   - The bottom "3.3" pad (and its adjacent "G" pad) appear only in the
 *     gallery image with no stated function, so "3.3" is omitted rather than
 *     guessed at (data gap). The adjacent G pad is the same ground net as the
 *     connector G and is not a separate leaf.
 *   - UART: role device, 9600 baud default (Matek). The FC UART is the host.
 *     Matek states only the default; FC firmware reconfigures the receiver
 *     over UBX, so a mate that declares a single fixed baud other than 9600
 *     (e.g. arduino-nano's 2 Mbaud max) reports a baud_rate mismatch. No
 *     wider range is claimed because no source states one.
 *   - I2C: role slave, 7-bit address 0x0D and 100/400 kHz standard/fast modes
 *     from the QMC5883L component datasheet (Matek names the IC but not its
 *     address). Matek labels the pads DA/CL.
 *   - No logic-level voltage is set on TX/RX/DA/CL: Matek does not state it
 *     (data gap). No I2C pull-up information is given either.
 *   - GNSS sensitivity, TTFF and accuracy are not stated by Matek, and the
 *     exact u-blox M10 module is not named, so the performance trait only
 *     carries what Matek states (data_gap trait records the rest).
 *   - Mounting: no holes are shown or specified; the module is 20 x 20 mm
 *     with R3 corners and is typically mounted by adhesive/printed mount, so
 *     no BoltPattern is emitted. The "no mechanical interfaces" verify warning
 *     is therefore intentional.
 *   - The green PPS LED has no interface vocabulary; it is a usage_note
 *     (gaps.json vocabulary entry).
 *   - No assumption traits: every modelled value is stated by a source.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  defineModule,
  PowerIn,
  Ground,
  UART,
  I2C,
  Pin,
  connectorTrait,
} from "../../src/protocols/index.js";

const SRC = {
  product: "https://www.mateksys.com/?portfolio=m10q-5883",
  imgDims: "https://www.mateksys.com/wp-content/uploads/2023/03/M10Q-5883_2.jpg",
  imgCompare: "https://www.mateksys.com/wp-content/uploads/2023/03/M10Q-5883_4.jpg",
  imgFeatures: "https://www.mateksys.com/wp-content/uploads/2023/03/M10Q-5883_1.jpg",
  qmc5883l:
    "https://www.qstcorp.com/upload/pdf/202512/13-52-04%20QMC5883L%20Datasheet%20Rev.%20B.pdf",
} as const;

/** Two parallel JST-GH-6P sockets, same silkscreen order. */
const JST_GH_6P = connectorTrait("jst_gh_6", {
  gender: "receptacle",
  positions: 6,
  pinout: ["5V", "RX", "TX", "CL", "DA", "G"],
  note:
    "JST-GH-6P (SM06B-GHS-TB), 1.27 mm pitch. Two connectors are fitted on the underside, both silkscreened 5V RX TX CL DA G; pin 1 is not marked by the source, so the order is silkscreen order. A 20 cm JST-GH-6P to JST-GH-6P silicone lead is included.",
});

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
  PowerIn({ id: "vin_5v", name: "5V", pin: "5V", voltageV: [4, 9], nominalV: 5 }),
  [
    padFunction(
      "5V — module supply input, 4~9 V (\"Input voltage range: 4~9V (5V pad/pin)\"); power consumption 13 mA. Wire to flight controller 4~9 V.",
      [SRC.product, SRC.imgDims],
    ),
    JST_GH_6P,
  ],
);

const gnd = withTraits(Ground({ id: "gnd", name: "G", pin: "G" }), [
  padFunction("G — ground. Wire to flight controller GND.", [SRC.product, SRC.imgDims]),
  JST_GH_6P,
]);

const uart = amend(
  amend(
    amend(
      UART({
        id: "uart_gnss",
        name: "GNSS UART",
        roles: ["device"],
        baudRate: 9600,
        tx: { pin: "TX", name: "TX" },
        rx: { pin: "RX", name: "RX" },
      }),
      "uart_gnss_tx",
      [
        padFunction("TX — GNSS UART transmit. Wire to flight controller UART_RX.", [SRC.product, SRC.imgDims]),
        JST_GH_6P,
      ],
    ),
    "uart_gnss_rx",
    [
      padFunction("RX — GNSS UART receive. Wire to flight controller UART_TX.", [SRC.product, SRC.imgDims]),
      JST_GH_6P,
    ],
  ),
  "uart_gnss",
  [
    {
      type: "usage_note",
      params: {
        note: "UART (TX, RX) interface for GNSS, 9600 baud default. Protocol UBX (u-blox) at 5 Hz with GPS+GAL+BDS B1C+GLO, or NMEA at 1 Hz. UBX is bidirectional: flight controller firmware configures the receiver over UBX, so no u-center setup is needed. Requires INAV 5.0.0, Betaflight 4.3.0, ArduPilot 4.3 or newer.",
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
        name: "Compass I2C (QMC5883L)",
        roles: ["slave"],
        address: 0x0d,
        clockFreqHz: [100_000, 400_000],
        sda: { pin: "DA", name: "DA" },
        scl: { pin: "CL", name: "CL" },
        maxInstances: 1,
      }),
      "i2c_compass_sda",
      [
        padFunction("DA — I2C data for the QMC5883L compass. Wire to flight controller I2C_SDA.", [SRC.product, SRC.imgDims]),
        JST_GH_6P,
      ],
    ),
    "i2c_compass_scl",
    [
      padFunction("CL — I2C clock for the QMC5883L compass. Wire to flight controller I2C_SCL.", [SRC.product, SRC.imgDims]),
      JST_GH_6P,
    ],
  ),
  "i2c_compass",
  [
    {
      type: "usage_note",
      params: {
        note: "I2C (DA, CL) interface for compass QMC5883L. QMC5883L default 7-bit address 0x0D; supports standard (100 kHz) and fast (400 kHz) modes; external pull-up resistors are required on the bus (QMC5883L datasheet §5.4). Matek does not state whether pull-ups are fitted on the module.",
        source: [SRC.product, SRC.qmc5883l],
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Leaves — bottom service pad
// ---------------------------------------------------------------------------

const rst = withTraits(
  Pin({ id: "rst", name: "Rst", pin: "Rst", capabilities: { inputOnly: true }, defaultActive: false }),
  [
    padFunction(
      "Rst — receiver reset pad. Bridging RST to ground for at least 100 ms triggers a cold start and deletes all stored information; recovery use only (e.g. when the FC cannot detect the GNSS module).",
      [SRC.product, SRC.imgDims],
    ),
    connectorTrait("solder_pad", { note: "Bottom-side pad labelled \"Rst\", next to \"G\" and \"3.3\" pads." }),
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export const MATEK_M10Q_5883: ModuleDef = defineModule({
  id: "matek-m10q-5883",
  name: "Matek M10Q-5883 GNSS & Compass",
  version: "1.0.0",
  manufacturer: "Matek Systems",
  part_number: "M10Q-5883",
  description:
    "Matek Systems M10Q-5883 GNSS and compass module (EOL): u-blox M10 series multi-constellation receiver (GPS, GLONASS, Galileo, BeiDou) with a 15x15x4 mm patch antenna, plus a QMC5883L magnetometer on I2C (0x0D). 4-9 V input, 13 mA, UART at 9600 baud default, two JST-GH-6P connectors, 20x20x12.4 mm, 8 g.",
  tags: ["gnss", "gps", "compass", "magnetometer", "u-blox", "m10", "qmc5883l", "uart", "i2c", "jst-gh", "fpv", "matek"],
  categories: ["sensor", "sensor.gnss", "drone.gnss"],

  interfaces: [vin, gnd, ...uart, ...i2c, rst],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vin_5v", name: "5V input", nominal_voltage_V: 5, voltage_range_V: [4, 9], max_current_mA: 13 },
      ],
      metadata: {
        supply_current_mA: 13,
        supply_current_note: "\"Power consumption: 13mA\" (Matek Specifications).",
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 20, width: 20, height: 12.4 },
      weight_g: 8,
      metadata: {
        corner_radius_mm: 3,
        mounting_holes: "none",
        patch_antenna_mm: [15, 15, 4],
        cad: "M10Q-5883_step.zip (STEP model linked from the Matek product page)",
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: [-20, 80],
    },
    {
      domain: "network",
      metadata: {
        gnss_receiver: "u-blox M10 series",
        constellations: ["GPS", "GLONASS", "Galileo", "BeiDou"],
        antenna: "integrated 15x15x4 mm patch, no external antenna connector",
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "gnss",
        receiver: "u-blox M10 series (standard precision GNSS platform, all L1 GNSS signals, Super-S)",
        constellations: ["GPS", "GLONASS", "Galileo", "BeiDou"],
        augmentation_default: "QZSS and SBAS enabled (u-blox FW 5.1 default configuration)",
        update_rate: "UBX 5 Hz @ GPS+GAL+BDS B1C+GLO, or NMEA 1 Hz",
        antenna: "15 x 15 x 4 mm high-gain patch, omnidirectional",
        compass: "QST QMC5883L 3-axis magnetometer",
        source: [SRC.product, SRC.qmc5883l],
      },
    },
    {
      type: "data_gap",
      params: {
        field: "GNSS sensitivity, TTFF, position accuracy",
        note: "Not stated by Matek; the exact u-blox M10 module is not named, so no u-blox figures are attributed.",
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
      type: "operating_conditions",
      params: {
        operating_temperature_C: [-20, 80],
        supply_voltage_V: [4, 9],
        supply_current_mA: 13,
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
        note: "No dataflash on the u-blox receiver: settings are held only while powered or by the on-board supercapacitor, and revert to default once it runs out. Capacity/backup time not stated.",
        source: [SRC.product, SRC.imgDims],
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "status LED",
        note: "GNSS PPS LED, green: solid on after power-on, blinking 1 Hz when GNSS has a 3D fix. From u-blox FW 3.01 the timepulse is UTC-aligned and valid only after the leap second is downloaded (up to 12.5 min), so the LED may not blink immediately after the 3D fix.",
        source: SRC.product,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "wiring",
        note: "5V → FC 4~9 V; RX → FC UART_TX; TX → FC UART_RX; CL → FC I2C_SCL; DA → FC I2C_SDA; G → FC GND.",
        source: SRC.product,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "mounting",
        note: "No mounting holes; 20 x 20 mm board with R3 mm corners, 12.4 mm tall. Mount antenna-up with the arrow aligned to the airframe (see compass alignment).",
        source: [SRC.product, SRC.imgDims],
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "lifecycle",
        note: "Matek lists this product as (EOL) and warns that counterfeit M10Q-5883 units are circulating.",
        source: SRC.product,
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "Matek M10Q-5883 product page", type: "datasheet", url: SRC.product },
    { id: "art_img_dims", name: "M10Q-5883 dimensions / silkscreen image", type: "documentation", url: SRC.imgDims },
    { id: "art_img_compare", name: "M10-5883 / M10Q-5883 / M8Q-5883 comparison image", type: "documentation", url: SRC.imgCompare },
    { id: "art_img_features", name: "M10Q-5883 feature summary image", type: "documentation", url: SRC.imgFeatures },
    { id: "art_qmc5883l", name: "QST QMC5883L datasheet Rev B", type: "datasheet", url: SRC.qmc5883l },
  ],
});
