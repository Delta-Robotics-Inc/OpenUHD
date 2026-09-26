/**
 * Ovonic 120C 14.8V 1300mAh 4S LiPo with XT60 plug (SKU family
 * O-120C-1300-4S1P-XT60) — datasheet-honest UHD part.
 *
 * Sources (see ./ovonic-4s-1300mah-120c-xt60/sources.json):
 *   - src_product: Ovonic product page (specification list, Notice) —
 *     https://www.ovonicshop.com/products/ovonic-120c-14-8v-1300mah-4s-lipo-battery-xt60-plug
 *   - src_protopart: ProtoPart ovonic-4s-1300mah-120c-xt60 definition
 *     (community starting point; every value re-verified).
 *
 * Modelling notes (mirrors cnhl-black-series-1100mah-6s-100c):
 *   - Variant lock: the 120C pack only. Ovonic also sells a 100C 4S 1300mAh
 *     pack (the page calls the 120C "the update version of 100C 4S 1300mAh");
 *     it is not merged. Ovonic sells the SKU as 2-pack / 4-pack combos; this
 *     part is ONE pack (the page gives 156 g for one pack).
 *   - `battery_out` (PowerOut) is the + conductor of the XT60 discharge lead:
 *     14.8 V nominal, 156 A continuous (1.3 Ah x 120C), 312 A burst
 *     (1.3 Ah x 240C), cell_count 4, capacity 1300 mAh. The currents are
 *     derived (capacity x C rating), not stated in amps. Voltage range
 *     12.0-16.8 V: 16.8 V is sourced (4.2 V/cell charge stop); 12.0 V is a
 *     3.0 V/cell `assumption` (no discharge cut-off is stated).
 *   - `battery_gnd` (Ground) is the − conductor of the same XT60 plug; the
 *     `xt60_main_lead` all_of group ties them together.
 *   - `balance_lead` is the JST-XH cell-tap lead. No protocol builder fits a
 *     balance lead (vocabulary gap, as on the CNHL pack): `custom` / peer.
 *     5 positions and pin order are the standard 4S XH layout (assumption).
 *   - XT60 gender is not stated ("XT60 Plug"): battery-side female is an
 *     assumption trait, as on the CNHL pack.
 *   - No mechanical interface: the pack is strapped (no strap vocabulary).
 *     This justifies verify's "no mechanical interfaces" warning.
 *   - No thermal domain: no Ovonic source gives an operating/charge/storage
 *     temperature (data_gap). The charge limit 4.2 V/cell is in
 *     `operating_conditions`; no max charge rate is stated for this pack.
 *   - Geometry: generated box 76 x 35 x 30 mm from the spec list (no
 *     manufacturer CAD: data_gap). The leads are flexible and their length
 *     is not stated, so connectors are not drawn; the three lead interfaces
 *     ref the `lead_exit` end face (which end is an assumption).
 *   - ProtoPart gave a 100 ms burst duration and a 3.3 V/cell discharge rule;
 *     neither is on the Ovonic page (source_discrepancy trait).
 */
import type { ModuleDef } from "../../src/types/index.js";
import { Ground, PowerOut, burstCurrentA, capacitymAh, cellCount, connectorTrait, defineModule } from "../../src/protocols/index.js";
import { cadArtifacts, feature, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.ovonicshop.com/products/ovonic-120c-14-8v-1300mah-4s-lipo-battery-xt60-plug",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/ovonic-4s-1300mah-120c-xt60/definition.json",
} as const;

// src_product specification list
const CELLS = 4; // "Configuration：4S1P"
const CAPACITY_MAH = 1300; // "Capacity(mAh)：1300mAh"
const NOMINAL_V = 14.8; // "Voltage(V)：14.8V"
const C_CONT = 120; // "Discharge Rate: 120C"
const C_BURST = 240; // "Max Burst Discharge Rate: 240C"
const CELL_MAX_V = 4.2; // Notice: "stop charging ... when the cell voltage been charged to 4.2V"
const CELL_MIN_V_ASSUMED = 3.0; // assumption — not stated by Ovonic

const CONT_A = Math.round((CAPACITY_MAH * C_CONT) / 1000); // 156 A
const BURST_A = Math.round((CAPACITY_MAH * C_BURST) / 1000); // 312 A
const PACK_MAX_V = +(CELLS * CELL_MAX_V).toFixed(2); // 16.8 V
const PACK_MIN_V = +(CELLS * CELL_MIN_V_ASSUMED).toFixed(2); // 12.0 V

const XT60_NOTE = "Connector Type: XT60 Plug (src_product). Wire gauge and lead length not stated. Gender not stated — see assumption trait.";

const batteryOut = PowerOut({
  id: "battery_out",
  name: "XT60 discharge lead (+)",
  pin: "+",
  voltageV: [PACK_MIN_V, PACK_MAX_V],
  nominalV: NOMINAL_V,
  maxCurrentA: CONT_A,
  parameters: [burstCurrentA(BURST_A), cellCount(CELLS), capacitymAh(CAPACITY_MAH)],
});
batteryOut.traits = [
  { type: "pin_functions", params: { source: SRC.product, functions: [{ name: "BAT+" }], description: "Positive conductor of the XT60 discharge lead." } },
  connectorTrait("xt60", { positions: 2, pinout: ["BAT+", "BAT-"], note: XT60_NOTE }),
  {
    type: "usage_note",
    params: {
      source: SRC.product,
      note:
        `max_current derivation: 'Discharge Rate: ${C_CONT}C' / 'Max Burst Discharge Rate: ${C_BURST}C' x 1300 mAh → ` +
        `${CONT_A} A continuous, ${BURST_A} A burst. Ovonic states C ratings only; the amp figures and the burst duration are not stated.`,
    },
  },
  {
    type: "assumption",
    params: {
      field: "voltage.range[0] (pack minimum)",
      value: `${PACK_MIN_V} V (${CELL_MIN_V_ASSUMED} V/cell x ${CELLS})`,
      reason: "Ovonic states only 'Normal cell voltage is between 3.7V~4.2V' and no discharge cut-off; 3.0 V/cell is the usual LiPo floor (same convention as the CNHL pack). 16.8 V maximum is sourced (4.2 V/cell).",
    },
  },
  {
    type: "assumption",
    params: {
      field: "connector gender",
      value: "female (sockets) on the battery lead",
      reason: "Source says only 'XT60 Plug'. Battery-side female XT60 is the hobby convention so the pack mates with the male XT60 on an ESC/FC lead.",
    },
  },
];

const batteryGnd = Ground({ id: "battery_gnd", name: "XT60 discharge lead (−)", pin: "-" });
batteryGnd.traits = [
  { type: "pin_functions", params: { source: SRC.product, functions: [{ name: "BAT-" }], description: "Negative conductor of the XT60 discharge lead; carries the full pack return current." } },
  connectorTrait("xt60", { positions: 2, pinout: ["BAT+", "BAT-"], note: XT60_NOTE }),
];

const balanceLead = {
  id: "balance_lead",
  name: "JST-XH balance lead (4S cell taps)",
  domain: "electrical" as const,
  exposed: true,
  default_active: true,
  protocols: [{ type: "custom", roles: ["peer"] }],
  capabilities: ["battery_balance"],
  parameters: [cellCount(CELLS)],
  traits: [
    connectorTrait("jst_xh_5", {
      positions: 5,
      pinout: ["BAT-", "C1+", "C2+", "C3+", "C4+ (BAT+)"],
      note: "Charge Plug: JST-XH (src_product). Position count and order per the standard 4S XH layout — see assumption.",
    }),
    {
      type: "usage_note",
      params: {
        source: SRC.product,
        note: "Connect with the main lead to a LiPo balance charger; stop charging at 4.2 V per cell. Not a flight-power path.",
      },
    },
    {
      type: "assumption",
      params: {
        field: "balance connector positions and pinout",
        value: "5 positions: BAT-, C1+..C4+",
        reason: "Source states only 'JST-XH'; a 4S XH balance plug has cells+1 positions in this order by convention.",
      },
    },
  ],
};

const OVONIC_4S_1300MAH_120C_XT60_BASE: ModuleDef = defineModule({
  id: "ovonic-4s-1300mah-120c-xt60",
  name: "Ovonic 120C 4S 1300mAh 14.8V LiPo (XT60)",
  version: "1.0.0",
  manufacturer: "Ovonic",
  part_number: "O-120C-1300-4S1P-XT60",
  description:
    "4S1P 14.8 V 1300 mAh LiPo pack, 120C continuous / 240C burst, XT60 discharge plug, JST-XH balance plug, 76 x 35 x 30 mm, 156 g per pack (sold as 2- or 4-pack).",
  tags: ["lipo", "battery", "4s", "xt60", "fpv", "5-inch", "1300mah", "120c"],
  categories: ["power", "battery"],
  interfaces: [batteryOut, batteryGnd, balanceLead],
  interfaceGroups: [
    { id: "xt60_main_lead", label: "XT60 discharge plug (+ and − mate together)", members: ["battery_out", "battery_gnd"], policy: "all_of" },
  ],
  artifacts: [{ id: "product_page", name: "Ovonic product page (specification list)", type: "documentation", url: SRC.product }],
  domains: [
    {
      domain: "electrical",
      power_domains: [
        {
          id: "pack",
          name: "4S pack (XT60)",
          nominal_voltage_V: NOMINAL_V,
          voltage_range_V: [PACK_MIN_V, PACK_MAX_V],
          max_current_mA: CONT_A * 1000,
          regulation_type: "unregulated",
        },
      ],
      metadata: { chemistry: "Li-Polymer (LiPo)", configuration: "4S1P", source: SRC.product },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 76, width: 35, height: 30 },
      weight_g: 156,
      metadata: {
        tolerance_mm: { length: 5, width: 2, height: 2 },
        weight_tolerance_g: 20,
        weight_note: "Net Weight (dev.20g) 312g (156g for one pack)",
        mounting: "none — strapped around the body (no strap interface vocabulary)",
        lead_length_mm: null,
        source: SRC.product,
      },
    },
  ],
  traits: [
    {
      type: "performance",
      params: {
        kind: "battery",
        source: SRC.product,
        chemistry: "LiPo",
        cells: CELLS,
        configuration: "4S1P",
        capacity_mAh: CAPACITY_MAH,
        nominal_voltage_V: NOMINAL_V,
        c_rating_continuous: C_CONT,
        c_rating_burst: C_BURST,
        continuous_current_A_derived: CONT_A,
        burst_current_A_derived: BURST_A,
        burst_duration_s: null,
        energy_Wh_derived: +(NOMINAL_V * (CAPACITY_MAH / 1000)).toFixed(2),
      },
    },
    {
      type: "operating_conditions",
      params: {
        source: SRC.product,
        charge_cutoff_V_per_cell: CELL_MAX_V,
        charge_cutoff_V_pack: PACK_MAX_V,
        normal_cell_voltage_V: [3.7, 4.2],
        charge_method: "LiPo balance charger (main lead + balance plug)",
        max_charge_rate_C: null,
        operating_temperature_C: null,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "burst duration and discharge floor",
        values: ["peak_duration 100 ms; 'do not discharge below 3.3V per cell' (ProtoPart)", "no burst duration and no discharge floor stated (Ovonic product page)"],
        sources: [SRC.protopart, SRC.product],
        resolution: "Burst duration left null (data_gap); minimum voltage is an explicit 3.0 V/cell assumption.",
      },
    },
    {
      type: "assumption",
      params: { field: "CAD lead exit face", value: "+X end face (35 x 30 mm)", reason: "The page does not say where the leads exit; connectors are not drawn because lead length is not stated." },
    },
    {
      type: "data_gap",
      params: {
        fields: [
          "manufacturer CAD",
          "discharge cut-off voltage",
          "operating / charge / storage temperature",
          "max charge rate",
          "burst duration",
          "main and balance lead length and wire gauge",
          "XT60 gender",
          "balance connector pinout",
        ],
        note: "No manufacturer CAD or drawing: ovonicshop.com product page offers none (checked 2026-09-26); geometry generated from the spec-list dimensions (library/cad/py/catalog/ovonic-4s-1300mah-120c-xt60.py). Other fields not stated by Ovonic.",
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Geometry: generated box from the spec-list dimensions (not manufacturer CAD).
// Pack centred in x/y, bottom at z = 0, x along 76 mm. Leads bound to the
// +X end face; no frames (flexible leads; the pack is strapped, not bolted).
// ---------------------------------------------------------------------------

export const OVONIC_4S_1300MAH_120C_XT60: ModuleDef = withGeometry(
  OVONIC_4S_1300MAH_120C_XT60_BASE,
  {
    battery_out: { refs: [feature("lead_exit", { area_mm2: 1050.0, centroid: [38.0, 0.0, 15.0], normal: [1.0, 0.0, 0.0] })] },
    battery_gnd: { refs: [feature("lead_exit", { area_mm2: 1050.0, centroid: [38.0, 0.0, 15.0], normal: [1.0, 0.0, 0.0] })] },
    balance_lead: { refs: [feature("lead_exit", { area_mm2: 1050.0, centroid: [38.0, 0.0, 15.0], normal: [1.0, 0.0, 0.0] })] },
  },
  cadArtifacts({
    dir: "library/parts/ovonic-4s-1300mah-120c-xt60/artifacts/cad",
    name: "ovonic-4s-1300",
    generator: "library/cad/py/catalog/ovonic-4s-1300mah-120c-xt60.py",
    tool: "build123d 0.13.0",
    interfaces: [],
  }),
);
