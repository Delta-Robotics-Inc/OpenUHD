/**
 * REV Robotics Power Distribution Hub (REV-11-1850) — datasheet-honest UHD part.
 *
 * Sources (see ./rev-power-distribution-hub/sources.json):
 *   - src_product:         REV-11-1850 product page — https://www.revrobotics.com/rev-11-1850/
 *   - src_specs:           PDH Specifications — https://docs.revrobotics.com/ion-control/pdh/specs
 *   - src_overview:        PDH Overview — https://docs.revrobotics.com/ion-control/pdh/overview
 *   - src_wiring:          Wiring the PDH — https://docs.revrobotics.com/ion-control/pdh/gs/wiring
 *   - src_troubleshooting: PDH Troubleshooting (channel numbering) — https://docs.revrobotics.com/ion-control/pdh/troubleshooting
 *   - src_gs:              Getting Started with the PDH (RS485 ports unused) — https://docs.revrobotics.com/ion-control/pdh/gs
 *   - src_wpilib:          WPILib PowerDistribution API (default REV CAN ID 1) — https://github.wpilib.org/allwpilib/docs/release/java/edu/wpi/first/wpilibj/PowerDistribution.html
 *   - src_drawing:         REV-11-1850 drawing — https://www.revrobotics.com/content/docs/REV-11-1850-DR.pdf
 *   - src_cad:             REV-11-1850 STEP — https://www.revrobotics.com/content/cad/REV-11-1850.STEP
 *   - src_protopart:       ProtoPart rev-pdh definition (community starting point only)
 *
 * Modelling notes:
 *   - Battery input: latching WAGO 2616 pair, `battery_in` PowerIn 4.7-18 V
 *     (12 V typ) + `battery_gnd`. The product page says 4.75 V minimum, the
 *     specs table 4.7 V (source_discrepancy; specs table used). No input
 *     current rating is published (the 120 A main breaker is external).
 *   - Outputs, one PowerOut + Ground pair per channel, numbered as REV numbers
 *     them (troubleshooting page: low-current channels 20-23; drawing
 *     silkscreen 0/1 and 18/19):
 *       hc_0 .. hc_19  high-current, WAGO 2606, ATO/ATC breaker or fuse up to
 *                      40 A (max_current 40 A = the largest supported breaker);
 *       lc_20 .. lc_22 low-current, WAGO 2601, ATM/APM fuse, 15 A continuous,
 *                      20 A peak for 5 min;
 *       sw_23          switchable low-current, 15 A continuous (thermally
 *                      limited), on/off control, 10 Hz max switching.
 *     Output voltage is the battery bus (4.7-18 V operating range).
 *   - CAN: WAGO 2601 4-pole block; `can_bus` is the existing `can` type (role
 *     transceiver) with can_h/can_l leaf conductors (leaf protocol `can`, role
 *     `peer`, the library CAN convention shared with ctre-talon-srx), slots
 *     matched by capability like the other REV parts. The
 *     drawing silkscreen labels the four poles H L H L (bus in / bus out),
 *     modelled as one CANH and one CANL conductor. 120 ohm termination is
 *     switch-configurable (TERM ON/OFF slide switch on the drawing).
 *   - USB-C: USB-to-CAN bridge for the REV Hardware Client.
 *   - Omitted: the two 3-pin RS485 headers (drawing silkscreen "RS485"); REV
 *     says they are not used in FRC and are for future use (Getting Started
 *     page) and gives no pinout (data_gap). The STATUS LED and MODE button
 *     are not interfaces.
 *   - ProtoPart listed only 6 high-current channels, a dedicated "roboRIO
 *     power output" and 6-14 V / 120 A; none of that is in REV's sources
 *     (source_discrepancy). The roboRIO is fed from an ordinary channel.
 *   - Mount: BoltPattern rectangle, 4 x #10-clearance Φ5.0 holes at
 *     101.6 x 215.9 mm (drawing; the STEP agrees). REV calls the holes a
 *     "0.5 in grid pitch" pattern.
 *   - No operating temperature in any REV PDH page or the drawing (re-checked
 *     in the PB-796 audit; data_gap); justifies the
 *     verify "coverage" warning.
 *   - Geometry: manufacturer STEP (69.5 MB, not committed), bound by
 *     library/cad/py/catalog/rev-power-distribution-hub.py after a transform
 *     to Z-up, bottom at z = 0, battery end at -Y. Terminal blocks are one
 *     feature per group (the STEP carries no channel labels): hc_0..9 on the
 *     +X column, hc_10..19 on the -X column, per the drawing silkscreen.
 */
import type { InterfaceDef, InterfaceGeometry, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, Ground, PowerIn, PowerOut, burstCurrentA, connectorTrait, defineModule } from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.revrobotics.com/rev-11-1850/",
  specs: "https://docs.revrobotics.com/ion-control/pdh/specs",
  overview: "https://docs.revrobotics.com/ion-control/pdh/overview",
  wiring: "https://docs.revrobotics.com/ion-control/pdh/gs/wiring",
  troubleshooting: "https://docs.revrobotics.com/ion-control/pdh/troubleshooting",
  drawing: "https://www.revrobotics.com/content/docs/REV-11-1850-DR.pdf",
  cad: "https://www.revrobotics.com/content/cad/REV-11-1850.STEP",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/rev-pdh/definition.json",
  gs: "https://docs.revrobotics.com/ion-control/pdh/gs",
  wpilib: "https://github.wpilib.org/allwpilib/docs/release/java/edu/wpi/first/wpilibj/PowerDistribution.html",
} as const;

type Vec3 = [number, number, number];

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function pinFn(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

const BUS_V: [number, number] = [4.7, 18];

// ---------------------------------------------------------------------------
// Battery input (latching WAGO 2616)
// ---------------------------------------------------------------------------

const WAGO_2616 = connectorTrait("wago_2616_lever", {
  positions: 2,
  pinout: ["+", "-"],
  note: "Latching WAGO 2616-series lever terminals labelled BATTERY INPUT + / -. 18-4 AWG bare stranded (18-6 AWG solid or ferruled), strip 0.72-0.79 in (~0.75 in / 20 mm).",
});

const batteryIn = withTraits(PowerIn({ id: "battery_in", name: "Battery input +", pin: "BAT+", voltageV: BUS_V, nominalV: 12 }), [
  pinFn("BATTERY INPUT + — main 12 V battery input (via the robot main breaker). Operating 4.7-18 V, 12 V typ.", [SRC.specs, SRC.drawing]),
  WAGO_2616,
  {
    type: "source_discrepancy",
    params: {
      field: "input voltage range",
      values: ["4.7-18 V, 12 V typ (docs specs table)", "4.75-18 V (product page)", "6-14 V, 120 A (ProtoPart 12v-main)"],
      sources: [SRC.specs, SRC.product, SRC.protopart],
      resolution: "REV specs table used (4.7-18 V). No REV source gives an input current rating; the ProtoPart 120 A is not modelled.",
    },
  },
  {
    type: "usage_note",
    params: {
      note: "Reverse polarity protection covers only the PDH control circuitry; downstream devices are NOT protected. Verify polarity on all power wires. Disconnect power before changing connections.",
      source: [SRC.specs, SRC.product, SRC.wiring],
    },
  },
]);

const batteryGnd = withTraits(Ground({ id: "battery_gnd", name: "Battery input -", pin: "BAT-" }), [
  pinFn("BATTERY INPUT - — battery return.", [SRC.drawing, SRC.specs]),
  WAGO_2616,
]);

// ---------------------------------------------------------------------------
// Output channels
// ---------------------------------------------------------------------------

const WAGO_2606 = connectorTrait("wago_2606_lever", {
  positions: 2,
  pinout: ["+", "-"],
  note: "Latching WAGO 2606-series lever terminals (red +, black -). 24-8 AWG bare (24-10 AWG ferruled), strip 0.43-0.51 in (~0.5 in / 12 mm).",
});
const WAGO_2601_LC = connectorTrait("wago_2601", {
  positions: 2,
  pinout: ["+", "-"],
  note: "WAGO 2601-series terminals (latching on units shipped from 01/04/2024, push-button before). Latching: 26-14 AWG bare, 22-18 AWG ferruled, strip 0.31-0.35 in. Push-button: 24-18 AWG bare, strip ~0.35 in (8 mm).",
});

function channel(
  kind: "hc" | "lc" | "sw",
  n: number,
  opts: { maxA: number; burstA?: number; connector: TraitDef; description: string; notes: TraitDef[] },
): InterfaceDef[] {
  const id = `${kind}_${n}`;
  const out = withTraits(
    PowerOut({
      id,
      name: `Channel ${n} +`,
      pin: `${n}+`,
      voltageV: BUS_V,
      nominalV: 12,
      maxCurrentA: opts.maxA,
      ...(opts.burstA !== undefined ? { parameters: [burstCurrentA(opts.burstA)] } : {}),
    }),
    [pinFn(opts.description, [SRC.specs, SRC.overview]), opts.connector, ...opts.notes],
  );
  const gnd = withTraits(Ground({ id: `${id}_gnd`, name: `Channel ${n} -`, pin: `${n}-` }), [
    pinFn(`Channel ${n} return (-).`, SRC.specs),
    opts.connector,
  ]);
  return [out, gnd];
}

const HC_NOTE: TraitDef = {
  type: "usage_note",
  params: {
    note: "High-current channel: ATO/ATC breaker or fuse, 40 A maximum supported rating (max_current is that 40 A limit; the fitted breaker sets the real limit). Current telemetry 0-127.9 A at 125 mA resolution over CAN/USB. Status LED per channel.",
    source: [SRC.specs, SRC.product],
  },
};
const LC_NOTE: TraitDef = {
  type: "usage_note",
  params: {
    note: "Low-current channel: ATM/APM fuse, 15 A continuous, 20 A peak sustained for up to 5 min (burst_current 20 A); a 20 A fuse is allowed for a single Pneumatic Hub / PCM with a high-draw compressor. Current telemetry 0-31.94 A at 62.5 mA. Firmware issue: low-current channels (20-23) wrap to 0 A above 15.9375 A.",
    burst_duration_s: 300,
    source: [SRC.specs, SRC.overview, SRC.troubleshooting],
  },
};
const SW_NOTE: TraitDef = {
  type: "usage_note",
  params: {
    note: "Switchable low-current channel: on/off controlled over CAN (useful for LEDs and indicators), 10 Hz maximum switching, ATM/APM fuse up to 15 A. Continuous current is thermally limited; the channel may shut off at its thermal limit.",
    source: [SRC.specs, SRC.product],
  },
};

const hcChannels = Array.from({ length: 20 }, (_, n) =>
  channel("hc", n, {
    maxA: 40,
    connector: WAGO_2606,
    description: `High-current channel ${n} (+), battery-bus voltage, ATO/ATC breaker up to 40 A.`,
    notes: [HC_NOTE],
  }),
).flat();

const lcChannels = [20, 21, 22]
  .map((n) =>
    channel("lc", n, {
      maxA: 15,
      burstA: 20,
      connector: WAGO_2601_LC,
      description: `Low-current channel ${n} (+), battery-bus voltage, ATM/APM fuse, 15 A continuous / 20 A peak.`,
      notes: [LC_NOTE],
    }),
  )
  .flat();

const swChannel = channel("sw", 23, {
  maxA: 15,
  connector: WAGO_2601_LC,
  description: "Switchable low-current channel 23 (+), labelled SWITCHABLE; on/off control over CAN, 15 A continuous.",
  notes: [SW_NOTE],
});

// ---------------------------------------------------------------------------
// CAN (WAGO 2601 4-pole block) and USB-C
// ---------------------------------------------------------------------------

const CAN_BLOCK = connectorTrait("wago_2601", {
  positions: 4,
  pinout: ["H", "L", "H", "L"],
  note: "WAGO 2601-series 4-pole block labelled CAN, poles silkscreened H L H L (drawing; bus in / bus out). Latching from 01/04/2024: 26-14 AWG bare, 22-18 AWG ferruled, strip 0.31-0.35 in; push-button before: 24-18 AWG, strip ~0.35 in. Termination slide switch labelled TERM ON/OFF beside it.",
});

function canLeaf(id: "can_h" | "can_l", name: string, description: string): InterfaceDef {
  return {
    id,
    name,
    pin: id === "can_h" ? "CANH" : "CANL",
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "can", roles: ["peer"] }],
    capabilities: [id],
    traits: [pinFn(description, [SRC.drawing, SRC.specs, SRC.product]), CAN_BLOCK],
  };
}

const canH = canLeaf("can_h", "CAN High", "CAN High: the two poles silkscreened H on the CAN WAGO block (1st and 3rd poles; bus in / bus out).");
const canL = canLeaf("can_l", "CAN Low", "CAN Low: the two poles silkscreened L on the CAN WAGO block (2nd and 4th poles; bus in / bus out).");

const canBus: InterfaceDef = {
  id: "can_bus",
  name: "CAN bus",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "can", roles: ["transceiver"] }],
  slots: [
    { id: "can_h", required: true, label: "CANH", match: { protocol: "can", capability: "can_h" } },
    { id: "can_l", required: true, label: "CANL", match: { protocol: "can", capability: "can_l" } },
  ],
  profiles: [{ id: "can_block", label: "CAN WAGO block", default_active: true, bindings: { can_h: "can_h", can_l: "can_l" } }],
  max_instances: 1,
  traits: [
    CAN_BLOCK,
    {
      type: "usage_note",
      params: {
        note: "CAN telemetry to the robot controller (per-channel currents, bus voltage, faults), switchable-channel control and firmware updates over CAN. Configurable on-board 120 ohm termination (TERM ON/OFF switch). WPILib's default PowerDistribution constructor uses CAN ID 1 for a REV PDH.",
        termination_ohm: 120,
        source: [SRC.specs, SRC.overview, SRC.product, SRC.drawing, SRC.wpilib],
      },
    },
  ],
};

const usb: InterfaceDef = {
  id: "usb_c",
  name: "USB-C (USB-to-CAN)",
  domain: "electrical",
  exposed: true,
  default_active: false,
  protocols: [{ type: "usb", roles: ["device"] }],
  traits: [
    connectorTrait("usb_c", { gender: "receptacle", note: "USB-C beside the CAN block; USB cable REV-11-1232 included." }),
    {
      type: "usage_note",
      params: {
        note: "USB-to-CAN device: monitor and update devices on the CAN bus and diagnose faults with the REV Hardware Client.",
        source: [SRC.product, SRC.overview],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const mount = BoltPattern({
  id: "mount",
  name: "4 x #10 clearance, 101.6 x 215.9 mm",
  role: "component",
  shape: "rectangle",
  spacingMm: 101.6,
  spacingYmm: 215.9,
  holeCount: 4,
  fastener: "#10 screw (clearance hole Φ5.0 mm / 0.197 in)",
  fastenerDiameterMm: 4.83,
  threaded: false,
  note: "Four corner holes, Φ5.0 mm, 4.00 x 8.50 in (101.6 x 215.9 mm) centres, 4.8 mm in from the sides (drawing); on REV's 0.5 in hole-grid pitch. Do NOT use thread-locking fluid: it damages the ABS case.",
});

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const REV_POWER_DISTRIBUTION_HUB_BASE: ModuleDef = defineModule({
  id: "rev-power-distribution-hub",
  name: "REV Power Distribution Hub",
  version: "1.0.0",
  manufacturer: "REV Robotics",
  part_number: "REV-11-1850",
  description:
    "FRC power distribution hub: 20 high-current channels (ATO/ATC breakers up to 40 A, WAGO 2606), 3 low-current channels (ATM/APM, 15 A continuous / 20 A peak) and 1 switchable low-current channel (WAGO 2601), latching WAGO 2616 battery input, 4.7-18 V. Per-channel current and bus-voltage telemetry over CAN (configurable 120 ohm termination) or USB-C (USB-to-CAN), LED voltage display, channel status LEDs. 225.4 x 111.1 x 39.7 mm, 517 g, 4 x #10 holes.",
  tags: ["frc", "rev-ion", "power-distribution", "pdh", "can", "usb-c", "wago", "breaker"],
  categories: ["power", "power.distribution"],

  interfaces: [batteryIn, batteryGnd, ...hcChannels, ...lcChannels, ...swChannel, canH, canL, canBus, usb, mount],

  domains: [
    {
      domain: "electrical",
      power_domains: [{ id: "battery_bus", name: "Battery bus (all channels)", nominal_voltage_V: 12, voltage_range_V: BUS_V }],
      metadata: {
        high_current_channels: 20,
        low_current_channels: 3,
        switchable_channels: 1,
        channel_numbering: "0-19 high-current, 20-22 low-current, 23 switchable",
        input_voltage_measurement_resolution_mV: 7.81,
        source: [SRC.specs, SRC.overview, SRC.troubleshooting],
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 225.4, width: 111.1, height: 39.7 },
      weight_g: 517,
      metadata: {
        body_in: [8.875, 4.375, 1.563],
        mounting_holes: "4 x Φ5.0 (#10 clearance), 101.6 x 215.9 mm",
        case_material: "ABS",
        source: [SRC.specs, SRC.drawing, SRC.product],
      },
    },
    {
      domain: "network",
      metadata: { bus: "CAN", termination_ohm: 120, usb: "USB-C USB-to-CAN", source: [SRC.specs, SRC.overview] },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "power_distribution",
        high_current_channels: { count: 20, breaker: "ATO/ATC", max_rating_A: 40, telemetry_range_A: [0, 127.9], telemetry_resolution_mA: 125 },
        low_current_channels: { count: 3, fuse: "ATM/APM", continuous_A: 15, peak_A: 20, peak_duration_min: 5, telemetry_range_A: [0, 31.94], telemetry_resolution_mA: 62.5 },
        switchable_channel: { count: 1, fuse: "ATM/APM", continuous_A: 15, switching_max_Hz: 10 },
        kit: "PDH, USB cable (REV-11-1232), 2 x 10 A and 4 x 15 A ATM fuses",
        source: [SRC.specs, SRC.overview, SRC.product],
      },
    },
    {
      type: "data_gap",
      params: {
        fields: ["operating / storage temperature", "total input current rating", "RS485 port pinout (ports not used in FRC; omitted)"],
        note: "Not stated in the REV sources read (product page, specs, overview, getting started, wiring, troubleshooting, status LED, ATO breaker page, drawing).",
        source: [SRC.product, SRC.specs, SRC.gs],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "channel set (ProtoPart vs REV)",
        values: [
          "ProtoPart: 6 high-current (40 A) + 3 low-current (15 A) resources, max_instances 20; a dedicated roboRIO power output; 6-14 V",
          "REV: 20 high-current channels (0-19), 3 low-current (20-22), 1 switchable (23); no dedicated roboRIO output; 4.7-18 V",
        ],
        sources: [SRC.protopart, SRC.overview, SRC.specs, SRC.troubleshooting],
        resolution: "REV channel set modelled; the roboRIO is powered from an ordinary channel.",
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "Power Distribution Hub product page", type: "datasheet", url: SRC.product },
    { id: "art_specs", name: "PDH Specifications", type: "datasheet", url: SRC.specs },
    { id: "art_overview", name: "PDH Overview", type: "documentation", url: SRC.overview },
    { id: "art_drawing", name: "REV-11-1850 drawing", type: "datasheet", url: SRC.drawing },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): manufacturer STEP, bound by
// library/cad/py/catalog/rev-power-distribution-hub.py after its transform:
// bottom face z = 0, top +Z, battery / CAN / USB end at -Y.
// ---------------------------------------------------------------------------

const F_HC_0_9 = vendorFeature("hc_terminals_0_9", { area_mm2: 44660.538, centroid: [43.464, 21.994, 18.872] });
const F_HC_10_19 = vendorFeature("hc_terminals_10_19", { area_mm2: 44642.442, centroid: [-43.459, 22.88, 18.878] });
const F_LC = vendorFeature("lc_terminals", { area_mm2: 3808.93, centroid: [-46.625, -71.602, 12.11] });
const F_CAN = vendorFeature("can_terminals", { area_mm2: 2059.076, centroid: [-22.701, -101.268, 17.093] });
const F_USB = vendorFeature("usb_c", { area_mm2: 396.637, centroid: [-38.305, -101.695, 14.73] });
const F_BAT = vendorFeature("battery_terminals", { area_mm2: 12371.846, centroid: [27.904, -96.381, 23.552] });

const UP: Vec3 = [0, 0, 1];
const geometry: Record<string, InterfaceGeometry> = {
  // Bottom face, pattern centre; the mounting plate approaches from -Z. Holes at (±50.8, ±107.95).
  mount: {
    frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0], symmetryDeg: 180 },
    refs: [vendorFeature("mount", { area_mm2: 398.982, centroid: [0.0, 0.0, 3.175] }), vendorOwn("mount"), procedural("bolt_pattern")],
  },
  battery_in: { frame: { origin: [18, -98, 39.7], normal: UP }, refs: [F_BAT] },
  battery_gnd: { frame: { origin: [33, -98, 39.7], normal: UP }, refs: [F_BAT] },
  can_bus: { frame: { origin: [-22.7, -101.3, 24.7], normal: UP }, refs: [F_CAN] },
  can_h: { refs: [F_CAN] },
  can_l: { refs: [F_CAN] },
  usb_c: { frame: { origin: [-38.3, -101.7, 18.2], normal: UP }, refs: [F_USB] },
};
for (let n = 0; n < 20; n++) {
  const f = n < 10 ? F_HC_0_9 : F_HC_10_19;
  geometry[`hc_${n}`] = { refs: [f] };
  geometry[`hc_${n}_gnd`] = { refs: [f] };
}
for (const id of ["lc_20", "lc_21", "lc_22", "sw_23"]) {
  geometry[id] = { refs: [F_LC] };
  geometry[`${id}_gnd`] = { refs: [F_LC] };
}

export const REV_POWER_DISTRIBUTION_HUB: ModuleDef = withGeometry(
  REV_POWER_DISTRIBUTION_HUB_BASE,
  geometry,
  vendorCadArtifacts({
    partId: "rev-power-distribution-hub",
    name: "REV-11-1850",
    url: SRC.cad,
    stepFile: "REV-11-1850.STEP",
    sha256: "bb14d12b33e8b21bb49f85166f9fb55e358d3044f85580321a291e3a7b9a1fa9",
    licence: "not stated by REV Robotics; not redistributed",
    interfaces: ["mount"],
  }),
);
