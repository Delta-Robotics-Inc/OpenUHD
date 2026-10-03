/**
 * Texas Instruments TPS63020DSJR buck-boost converter (adjustable output,
 * VSON-14 DSJ, 3000-unit reel) — datasheet-honest UHD part.
 *
 * Sources (see ./ti-tps63020dsjr/sources.json):
 *   - src_datasheet: TPS6302x datasheet SLVS916I —
 *     https://www.ti.com/lit/ds/symlink/tps63020.pdf
 *     (§5 pin functions, §6.1-6.5 ratings and electrical characteristics,
 *     §8.2 application, pp.31-32 DSJ mechanical / exposed pad data)
 *   - src_package_drawing: TI MPSS014A DSJ (R-PVSON-N14) drawing 4208212-3/C —
 *     https://www.ti.com/lit/pdf/MPSS014A
 *   - src_product: TI part details page —
 *     https://www.ti.com/product/TPS63020/part-details/TPS63020DSJR
 *   - src_product_folder: TI product folder (CAD symbols, footprints & 3D
 *     models tab -> Ultra Librarian) — https://www.ti.com/product/TPS63020
 *   - src_protopart: ProtoPart tps63020dsjr definition (community starting
 *     point; every value re-verified against TI documents).
 *
 * Modelling notes:
 *   - Variant lock: TPS63020 = adjustable output (1.2-5.5 V via VOUT-FB-GND
 *     divider, VFB 500 mV). The fixed 3.3 V TPS63021 is a different part.
 *     DSJR = large tape-and-reel (3000); electrically identical to DSJT.
 *   - All 14 pins are leaves `pin_1`..`pin_14`; the exposed thermal pad is
 *     `pgnd` (the only PGND connection, §5). Doubled pins (VOUT 4/5, L2 6/7,
 *     L1 8/9, VIN 10/11) are separate leaves: both pads of each pair must be
 *     connected.
 *   - `vin` and `vout` are composed power interfaces over the doubled pins plus
 *     PGND. `vout` carries max_current 2 A: the datasheet figure for VIN > 2.5 V
 *     at VOUT = 3.3 V. Up to 4 A in buck mode (§8.2) is recorded in a trait,
 *     not the parameter, because it depends on the operating point.
 *   - L1/L2 inductor pads have no fitting protocol: `custom` / peer with
 *     usage notes (1.5 uH recommended). Recorded as a vocabulary gap.
 *   - FB is an analog input (the divider's tap). EN and PS/SYNC are digital
 *     inputs (must not float); PS/SYNC also accepts a 2.2-2.6 MHz sync clock.
 *     PG is an open-drain digital output.
 *   - Package facts (VSON-14 DSJ, 14 pins, 0.5 mm pitch, exposed pad
 *     2.85 x 1.58 mm labelled "EP": TI gives it no number) are the mechanical
 *     domain's `package`.
 *   - `pcb_mount` (14 lead pads) and `thermal_pad` (exposed pad) are bound to
 *     the generated package geometry; a bare IC has no bolt pattern, so the
 *     frames are the seating plane (normal -Z).
 *   - Geometry is generated from TI drawings 4208212-3/C and 4208549-3/G (no
 *     manufacturer CAD downloaded: data_gap). Height 0.9 mm (midpoint of
 *     0.80-1.00) and nominal lead size are assumption traits.
 *   - ProtoPart put max_current 4 A on the input rail (the switch current
 *     limit); that is a switch limit, not an input-current rating, so `vin`
 *     carries no max_current (source_discrepancy trait).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { Ground, PowerIn, PowerOut, defineModule, voltageRangeV } from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, withGeometry } from "../cad/artifacts.js";

const SRC = {
  datasheet: "https://www.ti.com/lit/ds/symlink/tps63020.pdf",
  drawing: "https://www.ti.com/lit/pdf/MPSS014A",
  product: "https://www.ti.com/product/TPS63020/part-details/TPS63020DSJR",
  productFolder: "https://www.ti.com/product/TPS63020",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/tps63020dsjr/definition.json",
} as const;

const VIN: [number, number] = [1.8, 5.5]; // §6.3
const VOUT: [number, number] = [1.2, 5.5]; // §6.5

function fn(description: string): TraitDef {
  return { type: "pin_functions", params: { description, source: `${SRC.datasheet} (§5 Pin Functions)` } };
}

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function leaf(n: number, name: string, protocols: InterfaceDef["protocols"], capabilities: string[], traits: TraitDef[], voltage?: [number, number]): InterfaceDef {
  return {
    id: `pin_${n}`,
    name,
    pin: n,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols,
    capabilities,
    ...(voltage ? { parameters: [voltageRangeV(voltage[0], voltage[1])] } : {}),
    traits,
  };
}

// ---------------------------------------------------------------------------
// Pins — §5 Pin Functions
// ---------------------------------------------------------------------------

const inductorNote = (node: string): TraitDef => ({
  type: "usage_note",
  params: {
    note: `${node}: connect the single external inductor between L1 (pins 8, 9) and L2 (pins 6, 7); 1 uH or 1.5 uH recommended for 1.5-2 A output (e.g. Coilcraft XFL4020-152ML, 1.5 uH).`,
    source: `${SRC.datasheet} (§8.2.2.2, Table 2 BOM)`,
  },
});

const pins: InterfaceDef[] = [
  withTraits(PowerIn({ id: "pin_1", name: "VINA", pin: 1, voltageV: VIN }), [
    fn("VINA — supply voltage for control stage."),
    { type: "usage_note", params: { note: "0.1 uF ceramic from VINA to GND recommended; must not be higher than 0.22 uF.", source: `${SRC.datasheet} (§8.2.2.4)` } },
  ]),
  withTraits(Ground({ id: "pin_2", name: "GND", pin: 2 }), [fn("GND — control / logic ground.")]),
  leaf(3, "FB", [{ type: "analog", roles: ["input"] }], ["analog_in"], [
    fn("FB — voltage feedback of adjustable versions, must be connected to VOUT on fixed output voltage versions."),
    {
      type: "usage_note",
      params: { note: "Divider VOUT-FB-GND, VFB = 500 mV; R2 (FB to GND) about 200 kOhm; R1 = R2 x (VOUT/VFB - 1). Table 3: 3.3 V = 1 MOhm / 180 kOhm.", source: `${SRC.datasheet} (§8.2.3)` },
    },
  ]),
  withTraits(PowerOut({ id: "pin_4", name: "VOUT", pin: 4, voltageV: VOUT }), [fn("VOUT — buck-boost converter output (pins 4, 5).")]),
  withTraits(PowerOut({ id: "pin_5", name: "VOUT", pin: 5, voltageV: VOUT }), [fn("VOUT — buck-boost converter output (pins 4, 5).")]),
  leaf(6, "L2", [{ type: "custom", roles: ["peer"] }], ["inductor_l2"], [fn("L2 — connection for inductor (pins 6, 7)."), inductorNote("L2")]),
  leaf(7, "L2", [{ type: "custom", roles: ["peer"] }], ["inductor_l2"], [fn("L2 — connection for inductor (pins 6, 7)."), inductorNote("L2")]),
  leaf(8, "L1", [{ type: "custom", roles: ["peer"] }], ["inductor_l1"], [fn("L1 — connection for inductor (pins 8, 9)."), inductorNote("L1")]),
  leaf(9, "L1", [{ type: "custom", roles: ["peer"] }], ["inductor_l1"], [fn("L1 — connection for inductor (pins 8, 9)."), inductorNote("L1")]),
  withTraits(PowerIn({ id: "pin_10", name: "VIN", pin: 10, voltageV: VIN }), [fn("VIN — supply voltage for power stage (pins 10, 11).")]),
  withTraits(PowerIn({ id: "pin_11", name: "VIN", pin: 11, voltageV: VIN }), [fn("VIN — supply voltage for power stage (pins 10, 11).")]),
  leaf(12, "EN", [{ type: "digital", roles: ["input"] }], ["digital_io", "enable"], [
    fn("EN — enable input (1 enabled, 0 disabled), must not be left open. VIL <= 0.4 V, VIH >= 1.2 V."),
  ], [0, 5.5]),
  leaf(13, "PS/SYNC", [{ type: "digital", roles: ["input"] }], ["digital_io", "clock_in"], [
    fn("PS/SYNC — enable / disable power save mode (1 disabled, 0 enabled, clock signal for synchronization), must not be left open. Sync range 2200-2600 kHz."),
  ], [0, 5.5]),
  leaf(14, "PG", [{ type: "digital", roles: ["output"] }], ["digital_io", "open_drain", "power_good"], [
    fn("PG — output power good (1 good, 0 failure; open-drain), can be left open. VOL 0.04 V typ / 0.4 V max at 10 uA."),
  ]),
];

const pgnd = withTraits(Ground({ id: "pgnd", name: "PGND (exposed thermal pad)", pin: "EP" }), [
  fn("PGND — power ground. The exposed thermal pad is connected to PGND."),
  { type: "usage_note", params: { note: "Solder the exposed pad to the PCB ground plane (thermal and mechanical); place output capacitors close to VOUT and PGND.", source: [`${SRC.datasheet} (§8.2.2.3)`, SRC.drawing] } },
]);

// ---------------------------------------------------------------------------
// Composed supply interfaces
// ---------------------------------------------------------------------------

const vin: InterfaceDef = {
  ...PowerIn({ id: "vin", name: "Input supply (VIN + VINA)", voltageV: VIN, nominalV: 3.6 }),
  slots: [
    { id: "vin_a", required: true, match: { protocol: "power", role: "input" } },
    { id: "vin_b", required: true, match: { protocol: "power", role: "input" } },
    { id: "vina", required: true, match: { protocol: "power", role: "input" } },
    { id: "gnd", required: true, match: { protocol: "power", role: "ground", capability: "ground" } },
  ],
  profiles: [{ id: "vin_pins", label: "VIN 10/11, VINA 1, PGND", default_active: true, bindings: { vin_a: "pin_10", vin_b: "pin_11", vina: "pin_1", gnd: "pgnd" } }],
  traits: [
    {
      type: "usage_note",
      params: {
        note: "1.8-5.5 V (2-3 cell alkaline/NiMH, 1-cell Li-ion/LiPo, supercap). Minimum start-up input 1.8 V typ (1.9 V max 0-85 C, 2.0 V max full range). UVLO 1.5 V falling, 200 mV hysteresis. 10 uF input capacitor recommended. Quiescent 25 uA typ (VIN+VINA), shutdown 0.1 uA typ.",
        source: `${SRC.datasheet} (§6.5, §8.2.2.4)`,
      },
    },
  ],
};

const vout: InterfaceDef = {
  ...PowerOut({ id: "vout", name: "Regulated output (VOUT)", voltageV: VOUT, maxCurrentA: 2 }),
  slots: [
    { id: "vout_a", required: true, match: { protocol: "power", role: "output" } },
    { id: "vout_b", required: true, match: { protocol: "power", role: "output" } },
    { id: "gnd", required: true, match: { protocol: "power", role: "ground", capability: "ground" } },
  ],
  profiles: [{ id: "vout_pins", label: "VOUT 4/5, PGND", default_active: true, bindings: { vout_a: "pin_4", vout_b: "pin_5", gnd: "pgnd" } }],
  traits: [
    {
      type: "usage_note",
      params: {
        note: "Adjustable 1.2-5.5 V set by the FB divider. 2 A output for VIN > 2.5 V at VOUT = 3.3 V; 'as high as 2 A in boost mode and as high as 4 A in buck mode' (see Figures 1-2 for the operating-point limit). 2.4 MHz fixed frequency; power-save mode at light load unless PS/SYNC is high. Recommended output capacitance 3 x 22 uF ceramic. Load disconnected in shutdown.",
        source: `${SRC.datasheet} (Features, §6.5, §8.2)`,
      },
    },
  ],
};

const pcbMount: InterfaceDef = {
  id: "pcb_mount",
  name: "VSON-14 (DSJ) leads (SMD)",
  domain: "mechanical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "mechanical_connection", roles: ["mounting_point"] }],
  capabilities: ["surface_mount", "vson14_dsj_4x3_0p5mm"],
  traits: [
    {
      type: "connector",
      params: {
        connector_type: "vson_14_dsj",
        note: "14 leads, pitch 0.50 mm, lead width 0.18-0.30, length 0.30-0.50; body 3.85-4.15 x 2.85-3.15 x 0.80-1.00 mm; exposed pad 2.85 x 1.58 mm. MSL Level-1-260C-UNLIM, NIPDAU finish.",
        source: [SRC.drawing, `${SRC.datasheet} (p.27 package option addendum, pp.31-32)`],
      },
    },
  ],
};

const thermalPad: InterfaceDef = {
  id: "thermal_pad",
  name: "Exposed thermal pad (heat path to PCB)",
  domain: "thermal",
  exposed: true,
  default_active: true,
  protocols: [{ type: "thermal_connection", roles: ["thermal_source"] }],
  capabilities: ["exposed_pad"],
  traits: [
    {
      type: "performance",
      params: {
        kind: "thermal",
        theta_ja_C_per_W: 41.8,
        theta_jc_top_C_per_W: 47,
        theta_jb_C_per_W: 17,
        psi_jt_C_per_W: 0.9,
        psi_jb_C_per_W: 16.8,
        theta_jc_bottom_C_per_W: 3.6,
        pad_mm: [2.85, 1.58],
        source: [`${SRC.datasheet} (§6.4, p.32)`],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const TI_TPS63020DSJR_BASE: ModuleDef = defineModule({
  id: "ti-tps63020dsjr",
  name: "TI TPS63020DSJR buck-boost converter",
  version: "1.1.0",
  manufacturer: "Texas Instruments",
  part_number: "TPS63020DSJR",
  description:
    "Single-inductor buck-boost converter with 4 A switches: VIN 1.8-5.5 V, adjustable VOUT 1.2-5.5 V (500 mV feedback), 2 A at VOUT 3.3 V for VIN > 2.5 V, 2.4 MHz, 25 uA quiescent, power-good output, VSON-14 (DSJ) 4 x 3 mm with exposed pad.",
  tags: ["tps63020", "ti", "buck-boost", "dc-dc", "regulator", "adjustable", "vson-14", "li-ion"],
  categories: ["power", "power.regulator"],
  interfaces: [...pins, pgnd, vin, vout, pcbMount, thermalPad],
  interfaceGroups: [
    { id: "vin_pair", label: "VIN pins 10 and 11 (both must be connected)", members: ["pin_10", "pin_11"], policy: "all_of" },
    { id: "vout_pair", label: "VOUT pins 4 and 5 (both must be connected)", members: ["pin_4", "pin_5"], policy: "all_of" },
    { id: "inductor_pads", label: "Inductor pads L1 (8, 9) and L2 (6, 7)", members: ["pin_6", "pin_7", "pin_8", "pin_9"], policy: "all_of" },
  ],
  artifacts: [
    { id: "datasheet", name: "TPS6302x datasheet SLVS916I", type: "datasheet", url: SRC.datasheet },
    { id: "package_drawing", name: "DSJ (R-PVSON-N14) mechanical data MPSS014A", type: "documentation", url: SRC.drawing },
    { id: "product", name: "TPS63020DSJR part details", type: "documentation", url: SRC.product },
  ],
  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vin", name: "Input (VIN/VINA)", nominal_voltage_V: 3.6, voltage_range_V: VIN },
        { id: "vout", name: "Output (VOUT, adjustable)", voltage_range_V: VOUT, max_current_mA: 2000, regulation_type: "regulated" },
      ],
      metadata: {
        switching_frequency_kHz: [2200, 2400, 2600],
        switch_current_limit_mA: [3500, 4000, 4500],
        feedback_voltage_mV: [495, 500, 505],
        switch_rds_on_mOhm: 50,
        output_ovp_V: [5.5, 7],
        source: `${SRC.datasheet} (§6.5)`,
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 4.0, width: 3.0, height: 0.9 },
      package: {
        name: "VSON-14",
        code: "DSJ (R-PVSON-N14)",
        pin_count: 14,
        pitch_mm: 0.5,
        exposed_pad: true,
        exposed_pad_pin: "EP",
        exposed_pad_mm: [2.85, 1.58],
        source: `${SRC.datasheet} (§5: "DSJ Package, 14-Pin VSON with Exposed Thermal Pad"; p.32 exposed pad 2.85 x 1.58 mm); ${SRC.drawing} (body 3.85-4.15 x 2.85-3.15 x 0.80-1.00 mm, pitch 0.50)`,
        assumption: "TI numbers no exposed pad; \"EP\" is this part's label for it. Height 0.9 mm is the midpoint of 0.80-1.00 mm (see the assumption trait).",
      },
      metadata: { height_range_mm: [0.8, 1.0], source: SRC.drawing },
    },
    {
      domain: "thermal",
      operating_temperature_C: [-40, 85],
      metadata: { junction_C: [-40, 125], overtemperature_protection_C: 140, hysteresis_C: 20, theta_ja_C_per_W: 41.8, source: `${SRC.datasheet} (§6.3-6.5)` },
    },
  ],
  traits: [
    {
      type: "operating_conditions",
      params: { vin_V: VIN, ambient_C: [-40, 85], junction_C: [-40, 125], source: `${SRC.datasheet} (§6.3)` },
    },
    {
      type: "absolute_maximum",
      params: {
        vin_vina_vout_ps_en_fb_pg_V: [-0.3, 7],
        l1_l2_dc_V: [-0.3, 7],
        l1_l2_ac_10ns_V: [-3, 10],
        junction_C: [-40, 150],
        storage_C: [-65, 150],
        esd: "HBM ±500 V (VIN, VINA, L1), ±2000 V other pins; CDM ±1500 V",
        source: `${SRC.datasheet} (§6.1-6.2)`,
      },
    },
    {
      type: "performance",
      params: {
        kind: "regulator",
        topology: "single-inductor buck-boost, average current mode, synchronous",
        output_current_A: "2 A (VIN > 2.5 V, VOUT 3.3 V); up to 4 A in buck mode, 2 A in boost mode",
        quiescent_current_uA: 25,
        shutdown_current_uA: 0.1,
        switching_frequency_MHz: 2.4,
        source: `${SRC.datasheet} (Features, §6.5, §8.2)`,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "input max current",
        values: ["4000 mA on the VIN rail (ProtoPart, from the switch current limit)", "average switch current limit 3.5/4.0/4.5 A; no input-current rating (datasheet §6.5)"],
        sources: [SRC.protopart, SRC.datasheet],
        resolution: "vin carries no max_current; the switch limit is in electrical metadata.",
      },
    },
    {
      type: "assumption",
      params: { field: "package height (CAD, dimensions)", value: "0.9 mm", reason: "Drawing gives 0.80-1.00 mm; midpoint used." },
    },
    {
      type: "assumption",
      params: { field: "CAD lead size and pad thickness", value: "0.24 x 0.40 mm leads, 0.02 mm pads", reason: "Drawing gives ranges (0.18-0.30 x 0.30-0.50); pad thickness is not dimensioned. PGND tie bars (4 x 0.20 mm) not modelled." },
    },
    {
      type: "data_gap",
      params: {
        fields: ["manufacturer CAD"],
        note: "TI product folder (www.ti.com/product/TPS63020, 'CAD symbols, footprints & 3D models' tab) offers CAD/3D models (STEP etc.) only through Ultra Librarian, whose download requires accepting its terms as a registered user (not redistributable here); the Digi-Key model page (digikey.com/en/models/2353761) returned HTTP 403. Geometry generated from TI drawings 4208212-3/C and 4208549-3/G (library/cad/py/catalog/ti-tps63020dsjr.py).",
        source: [SRC.productFolder, "https://vendor.ultralibrarian.com/TI/embedded/?gpn=TPS63020&package=DSJ&pin=14"],
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Geometry: generated from the TI DSJ drawings (not manufacturer CAD).
// Body centred, seating plane z = 0, x along 4.0 mm; pins 1-7 on the -y edge.
// ---------------------------------------------------------------------------

export const TI_TPS63020DSJR: ModuleDef = withGeometry(
  TI_TPS63020DSJR_BASE,
  {
    pcb_mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0] },
      refs: [feature("pcb_mount", { area_mm2: 1.344, centroid: [0.0, 0.0, 0.0], normal: [0.0, 0.0, -1.0] }), own("pcb_mount")],
    },
    thermal_pad: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0] },
      refs: [feature("thermal_pad", { area_mm2: 4.503, centroid: [0.0, 0.0, 0.0], normal: [0.0, 0.0, -1.0] }), own("thermal_pad")],
    },
    pgnd: { refs: [feature("thermal_pad", { area_mm2: 4.503, centroid: [0.0, 0.0, 0.0], normal: [0.0, 0.0, -1.0] })] },
  },
  cadArtifacts({
    dir: "library/parts/ti-tps63020dsjr/artifacts/cad",
    name: "ti-tps63020-dsj14",
    generator: "library/cad/py/catalog/ti-tps63020dsjr.py",
    tool: "build123d 0.13.0",
    interfaces: ["pcb_mount", "thermal_pad"],
  }),
);
