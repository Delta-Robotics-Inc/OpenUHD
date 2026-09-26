/**
 * DJI O4 Air Unit (standard / "Lite", model DF3L2904 — NOT the O4 Air Unit Pro)
 * — datasheet-honest UHD part.
 *
 * Sources (see ./dji-o4-air-unit/sources.json):
 *   - src_specs:        DJI O4 Air Unit Series specs page (O4 Air Unit column) —
 *                       https://www.dji.com/o4-air-unit/specs
 *   - src_manual:       DJI O4 Air Unit Series User Manual v1.0 (2025.01) —
 *                       https://dl.djicdn.com/downloads/DJI_O4_Air_Unit_Series/UM/DJI_O4_Air_Unit_Series_User_Manual_v1.0_en.pdf
 *   - src_faq:          DJI O4 Air Unit Series FAQ — https://www.dji.com/o4-air-unit/faq
 *   - src_product_info: DJI O4 Air Unit Series Product Information v1.0 —
 *                       https://dl.djicdn.com/downloads/DJI_O4_Air_Unit_Series/PI/20250422/DJI_O4_Air_Unit_Series_Product_Information_v1.0.pdf
 *   - src_rdq:          RaceDayQuads listing (distributor; package contents only) —
 *                       https://www.racedayquads.com/products/dji-o4-air-unit
 *
 * Modelling notes:
 *   - Variant lock: this is the STANDARD O4 Air Unit. Its supply input is
 *     3.7-13.2 V (src_specs "Input Voltage"; src_manual p.10 VCC row). The Pro
 *     (7.4-26.4 V, DF3P2904) is a different part. Raw 6S VBAT (up to 25.2 V)
 *     therefore fails DRC against `vcc`; feed it from an FC 5 V or 9 V BEC
 *     rated >= 10 W (src_manual p.11). DJI never writes "1-3S", so no
 *     cell_count parameter is set; that reading is left to DRC on voltage.
 *   - One module = the retail kit (transmission module + camera module on its
 *     factory coax + removable 3-in-1 cable + antenna; src_rdq Includes). DJI
 *     sells the transmission module, camera module and antenna as replacement
 *     accessories (src_faq), but they are non-shared spares for this kit only
 *     and the camera works with nothing else ("connect to cameras of other
 *     brands? No."), so they are not separate modules. Per-piece mass,
 *     dimensions and mounting are kept separate in `domains` and interfaces.
 *   - The camera-to-transmission-module coax is internal to the module and is
 *     NOT exposed: there is no video-link protocol (gaps.json, vocabulary).
 *   - FC-facing 3-in-1 cable: every wire is a leaf (`vcc`, `gnd`, `uart_osd_rx`,
 *     `uart_osd_tx`, `gnd_signal`, `sbus`) with its verbatim DJI description
 *     in `pin_functions`. `uart_osd` (role device, 115200 baud, 0-3.3 V) carries
 *     the connector trait with the full pinout. DJI shows the wire order
 *     (VCC, GND, RX, TX, GND, S.Bus) but does not mark pin 1 or name the
 *     connector family, so the connector type is a data_gap.
 *   - S.Bus wire is DJI HDL to the FC's S.Bus input: modelled with the SBUS
 *     builder as role `output` (the air unit forwards DJI FPV RC data). The
 *     100000 baud parameter comes from the builder, not DJI.
 *   - MSP DisplayPort OSD (DJI "Canvas Mode") runs over `uart_osd`; see the
 *     usage_note trait. No msp protocol type exists; per the vocabulary it
 *     stays UART.
 *   - `antenna` is an `rf` transceiver (1T1R, 5.1/5.8 GHz). The antenna ships
 *     in the kit and is removable, but DJI does not name the connector
 *     (U.FL vs MMCX): `connector_type` is "unspecified_rf_coax" plus a
 *     data_gap. Vocabulary gap logged for RF connectors.
 *   - Mounting: `tx_module_mount` is a BoltPattern (25.5 x 25.5 mm, 4 x d2.6
 *     through holes, M2; src_manual p.6/p.11). src_faq says "mounting hole
 *     distance of 30 x 30 mm": that is the board outline, see the
 *     source_discrepancy trait. `camera_mount` models the lens-mount side
 *     holes (2 per side, 16.00 mm apart, faces 14.00 mm apart) as a 16 x 14
 *     rectangle; the M2 designation is an `assumption` (DJI draws d1.65
 *     tapped holes and a 2.0 mm screw but does not write "M2"). Vocabulary
 *     gap logged for side-mounted cameras.
 *   - USB-C (activation / firmware via DJI Assistant 2) is modelled as a usb
 *     device port. Link button and status LED are user controls, not
 *     interfaces (noted in a usage_note).
 *   - Power consumption / max current: no DJI figure. Only the BEC sizing
 *     (>= 10 W, e.g. 5 V/2 A) is stated; no max_current parameter is set
 *     (data_gap).
 *   - Thermal: -10 to 40 C operating (src_specs); strong airflow requirement
 *     in operating_conditions. No storage temperature (data_gap).
 *   - No pneumatic/hydraulic domains (no fluid ports).
 *   - Expected verify warnings: none beyond vocabulary items recorded in
 *     .research/gaps.json.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  BoltPattern,
  Ground,
  PowerIn,
  SBUS,
  UART,
  connectorTrait,
  defineModule,
} from "../../src/protocols/index.js";

const SRC = {
  specs: "https://www.dji.com/o4-air-unit/specs",
  manual:
    "https://dl.djicdn.com/downloads/DJI_O4_Air_Unit_Series/UM/DJI_O4_Air_Unit_Series_User_Manual_v1.0_en.pdf",
  faq: "https://www.dji.com/o4-air-unit/faq",
  productInfo:
    "https://dl.djicdn.com/downloads/DJI_O4_Air_Unit_Series/PI/20250422/DJI_O4_Air_Unit_Series_Product_Information_v1.0.pdf",
  rdq: "https://www.racedayquads.com/products/dji-o4-air-unit",
} as const;

// ---------------------------------------------------------------------------
// Constants (each with its source)
// ---------------------------------------------------------------------------

/** "Input Voltage 3.7-13.2 V" — src_specs; VCC row, src_manual p.10. */
const VCC_RANGE_V: [number, number] = [3.7, 13.2];
/** "UART_RX ... 0-3.3 V" etc. — src_manual p.10. */
const LOGIC_V = 3.3;
/** Canvas Mode: "set baud rate to 115200" — src_manual p.18. */
const MSP_BAUD = 115_200;

/** 3-in-1 cable wire order as drawn — src_manual p.10. */
const FC_CABLE_PINOUT = ["VCC", "GND", "RX", "TX", "GND", "S.Bus"];

const pinFn = (description: string, colour: string): TraitDef => ({
  type: "pin_functions",
  params: { description, wire_colour: colour, source: SRC.manual, where: "p.10 wiring table" },
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

// ---------------------------------------------------------------------------
// FC-facing 3-in-1 cable
// ---------------------------------------------------------------------------

const vcc = withTraits(
  PowerIn({
    id: "vcc",
    name: "VCC (3-in-1 cable, red)",
    pin: "VCC",
    voltageV: VCC_RANGE_V,
  }),
  [
    pinFn("Power. DJI O4 Air Unit: 3.7-13.2 V", "red"),
    {
      type: "usage_note",
      params: {
        note:
          "Standard O4 Air Unit only accepts 3.7-13.2 V: do NOT wire to raw 6S (or 4S) VBAT. Power from an FC BEC with output power >= 10 W (e.g. 5 V/2 A; a 9 V BEC is also within range). On 1S keep the port voltage above 3.7 V with short leads. Do not short VCC to power GND and do not hot-plug the cable.",
        source: [SRC.specs, SRC.manual],
        where: "src_manual p.10, p.11, p.15",
      },
    },
  ],
);

const gnd = withTraits(Ground({ id: "gnd", name: "GND — power (3-in-1 cable, black)", pin: "GND" }), [
  pinFn("Power GND", "black"),
]);

const gndSignal = withTraits(
  Ground({ id: "gnd_signal", name: "GND — signal (3-in-1 cable, brown)", pin: "GND" }),
  [pinFn("Signal GND", "brown")],
);

const uartOsd = UART({
  id: "uart_osd",
  name: "UART (MSP DisplayPort / Canvas OSD)",
  roles: ["device"],
  baudRate: MSP_BAUD,
  voltageV: LOGIC_V,
  rx: { pin: "RX", name: "RX (white)", voltageV: [0, LOGIC_V] },
  tx: { pin: "TX", name: "TX (grey)", voltageV: [0, LOGIC_V] },
}).map((iface): InterfaceDef => {
  if (iface.id === "uart_osd_rx") {
    return withTraits(iface, [pinFn("UART_RX (Connects to flight controller OSD TX, 0-3.3 V)", "white")]);
  }
  if (iface.id === "uart_osd_tx") {
    return withTraits(iface, [pinFn("UART_TX (Connects to flight controller OSD RX, 0-3.3 V)", "grey")]);
  }
  if (iface.id === "uart_osd") {
    return withTraits(iface, [
      connectorTrait("dji_3in1_cable_6pin", {
        positions: 6,
        pinout: FC_CABLE_PINOUT,
        note:
          "Removable 50 mm 3-in-1 cable (src_specs, src_manual p.6). Order is the wire order DJI draws (VCC red, GND black, RX white, TX grey, GND brown, S.Bus yellow; src_manual p.10); DJI does not mark pin 1 or name the FC-side connector family. Wiring sequence is the same as the DJI O3 Air Unit (src_faq), so FC 'DJI/HD' connectors wired for O3 match. Solder-to-pad wiring is also allowed (src_manual p.9).",
      }),
      {
        type: "usage_note",
        params: {
          note:
            "MSP DisplayPort OSD (DJI 'Canvas Mode'): connect air-unit RX to an FC UART TX (and air-unit TX to that UART's RX). Betaflight Ports: enable MSP on that UART at 115200 baud. Betaflight Configurator 4.4.0+: set Peripherals to MSP+Displayport. Older: CLI 'set osd_displayport_device = MSP' and 'set displayport_msp_serial = <UART number - 1>', then save. Supported FC firmware: Betaflight 4.3.0+ and INAV 8.0.1+.",
          source: [SRC.manual, SRC.faq, SRC.specs],
          where: "src_manual p.18-19; src_faq firmware answer",
        },
      },
    ]);
  }
  return iface;
});

const sbus = withTraits(
  SBUS({
    interfaceId: "sbus",
    pin: "S.Bus",
    name: "S.Bus / DJI HDL (3-in-1 cable, yellow)",
    role: "output",
    voltageV: [0, LOGIC_V],
  }),
  [
    pinFn("DJI HDL (Connects to flight controller S.Bus, 0-3.3 V)", "yellow"),
    {
      type: "usage_note",
      params: {
        note:
          "Only needed when flying with a DJI FPV Remote Controller 2/3 linked through the goggles; the FC receiver protocol must be set to SBUS. With a separate receiver (e.g. ELRS) leave it unconnected. Direction (air unit -> FC) follows DJI's 'connects to flight controller S.Bus'; the 100000 baud parameter is the SBUS builder's, not a DJI figure.",
        source: [SRC.manual, SRC.specs, SRC.faq],
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// USB-C, RF
// ---------------------------------------------------------------------------

const usbC: InterfaceDef = {
  id: "usb_c",
  name: "USB-C port (transmission module)",
  domain: "electrical",
  exposed: true,
  default_active: false,
  protocols: [{ type: "usb", roles: ["device"] }],
  traits: [
    connectorTrait("usb_c", { gender: "receptacle", note: "src_manual p.5 item 4 'USB-C Port'." }),
    {
      type: "usage_note",
      params: {
        note:
          "Used with the module powered from the FC/battery to connect a computer running DJI Assistant 2 (Consumer Drones Series) for activation and firmware updates. Before activation, transmit power is limited to <= 20 mW. DJI does not state that USB-C can power the unit.",
        source: [SRC.manual, SRC.faq],
        where: "src_manual p.12; src_faq activation answer",
      },
    },
  ],
};

const antenna: InterfaceDef = {
  id: "antenna",
  name: "Video transmission antenna (1T1R, included)",
  domain: "network",
  exposed: true,
  default_active: true,
  protocols: [{ type: "rf", roles: ["transceiver"] }],
  traits: [
    connectorTrait("unspecified_rf_coax", {
      positions: 1,
      note:
        "One antenna, 1T1R, 80 mm long, approx. 0.75 g, included and removable (src_specs, src_manual p.6, src_faq). DJI does not name the connector family.",
    }),
    {
      type: "usage_note",
      params: {
        note:
          "Mount the antenna so it extends out of the frame, unobstructed and visible from front and rear, at least 5 cm from the transmission and camera modules and as far as possible from metal and carbon-fibre parts. Do not obstruct or twist it.",
        source: SRC.manual,
        where: "p.9, p.15",
      },
    },
    {
      type: "data_gap",
      params: { field: "antenna connector family", note: "Not stated in DJI specs, manual or FAQ.", source: SRC.specs },
    },
  ],
};

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const txModuleMount = withTraits(
  BoltPattern({
    id: "tx_module_mount",
    name: "Transmission module mount (25.5 x 25.5, M2)",
    role: "component",
    shape: "square",
    spacingMm: 25.5,
    holeCount: 4,
    fastener: "M2",
    fastenerDiameterMm: 2,
    threaded: false,
    note:
      "4 x d2.6 through holes at 25.5 x 25.5 mm on the 30 x 30 x 6 mm board (src_manual p.6). DJI recommends M2 flight-controller damping balls in these holes (src_manual p.11). Mount on the stack/top plate in airflow.",
  }),
  [
    {
      type: "source_discrepancy",
      params: {
        field: "transmission module mounting hole distance",
        values: ["30 x 30 mm", "25.5 x 25.5 mm"],
        sources: [SRC.faq, SRC.manual],
        resolution:
          "Use 25.5 x 25.5 mm from the dimensioned drawing (src_manual p.6). The FAQ's 30 x 30 mm matches the board outline (src_specs 30x30x6 mm), not the hole centres.",
      },
    },
  ],
);

const cameraMount = withTraits(
  BoltPattern({
    id: "camera_mount",
    name: "Camera side mount (14 mm wide lens mount, 2 holes per side)",
    role: "component",
    shape: "rectangle",
    spacingMm: 16,
    spacingYmm: 14,
    holeCount: 4,
    fastener: "M2",
    fastenerDiameterMm: 2,
    threaded: true,
    note:
      "Side-mounted camera: lens mount is 14.00 mm wide x 20.00 mm tall (13.98 mm deep), with 2 tapped holes per side face (4 x d1.65, thread depth 2.0 mm, max screw engagement 3.10 mm) 16.00 mm apart (src_manual p.6). spacingMm = 16.00 hole spacing along each side; spacingYmm = 14.00 is the distance between the two side faces (camera width between the frame's camera plates), not a coplanar hole spacing. Included camera screws suit only frames thicker than 2 mm. Observe the 'this way up' orientation mark (src_manual p.11).",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "camera_mount fastener",
        value: "M2",
        reason:
          "DJI draws d1.65 tapped holes (the standard M2 tap drill) and an included screw with a 2.0 mm thread dimension, but never writes 'M2' for the camera.",
      },
    },
    {
      type: "usage_note",
      params: {
        note:
          "Isolate the camera from vibration: RockSteady EIS can resonate with ESC PWM at 24 kHz (camera IMU ~24-30 kHz). DJI suggests ESC PWM 48/96 kHz or a softer damping structure; the light O4 Air Unit needs softer damping than the Pro. Do not bend the coax base more than 90 degrees.",
        source: [SRC.manual, SRC.faq],
        where: "src_manual p.8, p.19-21",
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export const DJI_O4_AIR_UNIT: ModuleDef = defineModule({
  id: "dji-o4-air-unit",
  name: "DJI O4 Air Unit",
  version: "1.0.0",
  manufacturer: "DJI",
  part_number: "DF3L2904",
  description:
    "DJI O4 digital HD FPV video system (standard, not Pro): 1/2-inch camera module on a factory coax + 30x30 mm transmission module (25.5 mm M2 holes), 3.7-13.2 V input, UART for MSP DisplayPort OSD, S.Bus/DJI HDL, one 5.1/5.8 GHz antenna, 4K60 onboard recording to 23 GB. 8.2 g with camera.",
  tags: ["fpv", "digital-video", "hd-vtx", "dji", "o4", "air-unit", "camera", "msp-displayport", "5.8ghz"],
  categories: ["drone.video", "rf.video_transmitter", "sensor.camera"],

  interfaces: [vcc, gnd, ...uartOsd, gndSignal, sbus, usbC, antenna, txModuleMount, cameraMount],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        {
          id: "vcc",
          name: "Air unit supply (3-in-1 cable VCC)",
          voltage_range_V: VCC_RANGE_V,
        },
      ],
      metadata: { logic_level_V: LOGIC_V, bec_min_power_W: 10, source: [SRC.specs, SRC.manual] },
    },
    {
      domain: "mechanical",
      weight_g: 8.2,
      dimensions_mm: { length: 30, width: 30, height: 6 },
      metadata: {
        note:
          "weight_g and dimensions_mm describe the transmission module; weight_g = air unit with camera module, excluding lens mount and antenna.",
        weight_breakdown_g: {
          air_unit_without_camera: 5.1,
          air_unit_with_camera: 8.2,
          air_unit_with_camera_and_lens_mount: 9.2,
          antenna: 0.75,
        },
        transmission_module_mm: { length: 30, width: 30, height: 6, hole_spacing: 25.5, hole_diameter: 2.6 },
        camera_module_mm: { length: 13.44, width: 12.36, height: 16.5, face_width: 13.1, lens_diameter: 8.5 },
        lens_mount_mm: { width: 14.0, height: 20.0, depth: 13.98, lens_diameter: 9.1, side_hole_spacing: 16.0 },
        cable_lengths_mm: { camera_coax: 50, three_in_one: 50, antenna: 80 },
        source: [SRC.specs, SRC.manual],
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: [-10, 40],
      metadata: { standby_from_cold_start_min: 2.5, source: [SRC.specs, SRC.manual] },
    },
    {
      domain: "network",
      metadata: {
        frequency_bands_GHz: [
          [5.17, 5.25],
          [5.725, 5.85],
        ],
        antennas: "1 antenna, 1T1R",
        max_bandwidth_MHz: 60,
        source: SRC.specs,
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "video",
        system: "DJI O4",
        image_sensor: "1/2-inch CMOS",
        fov_deg: 117.6,
        equivalent_focal_length_mm: 14,
        aperture: "f/2.8",
        focus: "0.6 m to infinity",
        iso: { auto: "100-6400", manual: "100-12800" },
        recording_modes: [
          "4K (4:3) 3840x2880 @ 30/50/60 fps",
          "4K (16:9) 3840x2160 @ 30/50/60 fps",
          "1080p (4:3) 1440x1080 @ 30/50/60/100/120 fps",
          "1080p (16:9) 1920x1080 @ 30/50/60/100/120 fps",
        ],
        live_view: "1080p @ 30/50/60/100 fps",
        video_format: "MP4",
        max_bitrate_Mbps: 100,
        eis: "RockSteady 3.0+ (or off, Gyroflow supported)",
        camera_fov_modes: ["Standard", "Wide-Angle"],
        lowest_latency_ms: { goggles_3: 20, goggles_n3: 24, goggles_2_or_integra: "< 35" },
        latency_condition: "1080p/100fps, racing mode (Goggles 3/N3)",
        frequency_bands_GHz: ["5.170-5.250", "5.725-5.850"],
        eirp: {
          "5.1GHz": "<23 dBm (CE)",
          "5.8GHz": "<30 dBm (FCC), <14 dBm (CE), <30 dBm (SRRC)",
        },
        tx_power_levels_mW: [25, 50, 100, 200, 400, 700],
        max_range_km: { fcc: 10, ce: 6, srrc: 6 },
        max_bandwidth_MHz: 60,
        storage: { built_in_GB: 23, microsd: false },
        power_consumption: "not stated by DJI (BEC must supply >= 10 W)",
        compatible_goggles: [
          "DJI Goggles 3 + FPV Remote Controller 3",
          "DJI Goggles N3 + FPV Remote Controller 3",
          "DJI Goggles 2 / Goggles Integra + FPV Remote Controller 2",
        ],
        source: [SRC.specs, SRC.manual],
      },
    },
    {
      type: "operating_conditions",
      params: {
        operating_temperature_C: [-10, 40],
        supply_voltage_V: VCC_RANGE_V,
        cooling:
          "Needs airflow. Install inside the frame in a well-ventilated spot (near air intake/exhaust), within ~1 cm of the propellers to use downwash, and not in an enclosed area; a heat-conductive pad to the carbon frame extends run time. Ground standby from cold start about 2.5 min at 25 C (ground low-power mode on); above 25 C ambient use external cooling. Over-temperature: on the ground it shuts down; in flight recording stops, then transmission bitrate is reduced to at most 50 Mbps. The metal shell gets hot: keep it out of reach.",
        source: [SRC.specs, SRC.manual, SRC.faq],
      },
    },
    {
      type: "usage_note",
      params: {
        note:
          "Kit contents: transmission module, camera module (on factory coax), 3-in-1 cable, antenna (src_rdq). Controls on the transmission module: link button and linking status LED (red -> blinking red while pairing -> solid green when linked). Activate with DJI Assistant 2 before use. Transmission module, camera module and antenna are sold as replacement spares but are not interchangeable with O3 parts; the 3-in-1 cable is shared with O3.",
        source: [SRC.manual, SRC.faq, SRC.rdq],
      },
    },
    {
      type: "data_gap",
      params: {
        field: "power consumption, max input current, storage temperature, FC-side connector family, lens mount in box",
        note: "No DJI source states these; see .research/gaps.json.",
        source: [SRC.specs, SRC.manual],
      },
    },
  ],

  artifacts: [
    { id: "art_specs", name: "DJI O4 Air Unit Series specs", type: "datasheet", url: SRC.specs },
    { id: "art_manual", name: "DJI O4 Air Unit Series User Manual v1.0", type: "datasheet", url: SRC.manual },
    { id: "art_faq", name: "DJI O4 Air Unit Series FAQ", type: "documentation", url: SRC.faq },
    { id: "art_product_info", name: "DJI O4 Air Unit Series Product Information v1.0", type: "documentation", url: SRC.productInfo },
    { id: "art_rdq", name: "RaceDayQuads listing (distributor)", type: "documentation", url: SRC.rdq },
  ],
});
