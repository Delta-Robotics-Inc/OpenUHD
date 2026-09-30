/**
 * CNHL Black Series 1100mAh 22.2V 6S 100C LiPo with XT60 (stock 1101006BK,
 * Black Series V1.0) — datasheet-honest UHD part.
 *
 * Sources (see ./cnhl-black-series-1100mah-6s-100c/sources.json):
 *   - src_product:        CNHL product page (spec table, Notice) —
 *     https://chinahobbyline.com/products/cnhl-black-series-1100mah-22-2v-6s-100c-lipo-battery-with-xt60-plug
 *   - src_c_rating_guide: CNHL blog, C rating → current formula —
 *     https://chinahobbyline.com/blogs/news/30c-vs-100c-vs-130c-rc-battery-guide
 *   - src_charge_guide:   CNHL blog, LiPo per-cell / 6S full-charge voltage —
 *     https://chinahobbyline.com/blogs/news/how-to-charge-a-lipo-battery-safely
 *   - src_pilotshq:       Pilots HQ listing (distributor corroboration) —
 *     https://www.pilotshq.com/products/cnhl-black-series-1100mah-22-2v-6s-100c-lipo-battery-with-xt60-plug
 *
 * Modelling notes:
 *   - Variant lock: the CNHL listing offers a 100C (V1.0, 1101006BK) and a
 *     130C (V2.0, 1101306BK) "Discharge Rate" variant. Only the 100C pack is
 *     modelled; distributor pages that now show the V2 130C/260C pack at the
 *     old 100C URL were not used as evidence. CNHL ships this SKU as a
 *     two-pack combo; the spec table and this part describe ONE pack.
 *   - `battery_out` (PowerOut) is the + conductor of the XT60 discharge lead:
 *     22.2 V nominal, 110 A continuous (1.1 Ah × 100C), 220 A burst
 *     (1.1 Ah × 200C), cell_count 6, capacity 1100 mAh. Voltage range
 *     18.0–25.2 V: the 25.2 V top is sourced (4.2 V/cell charge stop); the
 *     18.0 V bottom is a 3.0 V/cell `assumption` because CNHL states no
 *     discharge cut-off.
 *   - `battery_gnd` (Ground) is the − conductor of the same XT60 plug. The
 *     `xt60` connector composite (PB-805) is the plug itself, binding both;
 *     the `xt60_main_lead` all_of group says they are used together.
 *   - `balance_lead` is the JST-XH cell-tap connector. No protocol builder
 *     fits a balance lead, so it is `custom` / `peer` with a connector trait
 *     and usage note (vocabulary gap recorded). Position count (7) and pin
 *     order are the standard 6S XH layout, marked as an `assumption`.
 *   - XT60 gender is not stated by the source; battery-side female is an
 *     `assumption` trait, not a connector-trait fact.
 *   - No mechanical interface: the pack has no mounting feature and is held
 *     by a strap around its body. No strap builder exists (vocabulary gap),
 *     so dimensions and mass live in the mechanical domain metadata. This
 *     justifies verify's "no mechanical interfaces" warning.
 *   - No thermal domain: no CNHL source states operating, charge, or storage
 *     temperature (data_gap). Charge limits (5C max, 4.2 V/cell) are in the
 *     module `operating_conditions` trait.
 *   - Energy (24.42 Wh) is derived (22.2 V × 1.1 Ah), not stated, and is
 *     labelled derived in the performance trait.
 *   - burst_current is a canonical parameter; the burst duration is not
 *     stated (data_gap). Caveat: pair DRC range-overlaps burst_current (it
 *     is not a capacity-semantics param), so a mate whose PowerIn declares
 *     its own burst_current will report a false disjoint range. Escalated
 *     in .research/gaps.json.
 */
import type { ModuleDef } from "../../src/types/index.js";
import {
  Ground,
  PowerOut,
  burstCurrentA,
  capacitymAh,
  cellCount,
  Connector,
  connectorTrait,
  defineModule,
} from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product:
    "https://chinahobbyline.com/products/cnhl-black-series-1100mah-22-2v-6s-100c-lipo-battery-with-xt60-plug",
  cRatingGuide: "https://chinahobbyline.com/blogs/news/30c-vs-100c-vs-130c-rc-battery-guide",
  chargeGuide: "https://chinahobbyline.com/blogs/news/how-to-charge-a-lipo-battery-safely",
  pilotshq:
    "https://www.pilotshq.com/products/cnhl-black-series-1100mah-22-2v-6s-100c-lipo-battery-with-xt60-plug",
} as const;

// ---------------------------------------------------------------------------
// Pack constants — src_product "Specifications" unless noted
// ---------------------------------------------------------------------------

const CELLS = 6; // "22.2V / 6-Cell / 6S1P"
const CAPACITY_MAH = 1100; // "Capacity: 1100mAh"
const NOMINAL_V = 22.2; // "Voltage: 22.2V"
const C_CONT = 100; // "100C Continual"
const C_BURST = 200; // "200C Burst"
const CELL_MAX_V = 4.2; // Notice: "stop charging ... when the cell voltage has been charged to 4.2V"
const CELL_MIN_V_ASSUMED = 3.0; // assumption — not stated by CNHL

const CONT_A = Math.round((CAPACITY_MAH * C_CONT) / 1000); // 110 A
const BURST_A = Math.round((CAPACITY_MAH * C_BURST) / 1000); // 220 A
const PACK_MAX_V = +(CELLS * CELL_MAX_V).toFixed(2); // 25.2 V
const PACK_MIN_V = +(CELLS * CELL_MIN_V_ASSUMED).toFixed(2); // 18.0 V

const XT60_NOTE =
  "Output Connector: XT60; Wire (AWG): 12# (src_product). Gender not stated — see assumption trait.";

// ---------------------------------------------------------------------------
// XT60 main discharge lead: + and − conductors
// ---------------------------------------------------------------------------

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
  {
    type: "pin_functions",
    params: {
      source: SRC.product,
      functions: [{ name: "BAT+" }],
      description: "Positive conductor of the XT60 output (discharge) lead, 12 AWG.",
    },
  },
  {
    type: "usage_note",
    params: {
      source: [SRC.product, SRC.cRatingGuide],
      note:
        "max_current derivation: 'Discharge Rate: 100C Continual / 200C Burst' × 1100 mAh; " +
        "CNHL: 'Capacity (Ah) × C Rating = Theoretical Maximum Continuous Current' → " +
        `1.1 Ah × ${C_CONT}C = ${CONT_A} A continuous, 1.1 Ah × ${C_BURST}C = ${BURST_A} A burst. ` +
        "CNHL calls this a theoretical figure; the burst rating is a short-duration ceiling (duration not stated).",
    },
  },
  {
    type: "assumption",
    params: {
      field: "voltage.range[0] (pack minimum)",
      value: `${PACK_MIN_V} V (${CELL_MIN_V_ASSUMED} V/cell × ${CELLS})`,
      reason:
        "CNHL states only 'normal cell voltage is between 3.7V~4.2V' and gives no discharge cut-off; " +
        "3.0 V/cell is the standard LiPo absolute discharge floor. The 25.2 V maximum is sourced (4.2 V/cell).",
    },
  },
];

const batteryGnd = Ground({ id: "battery_gnd", name: "XT60 discharge lead (−)", pin: "-" });
batteryGnd.traits = [
  {
    type: "pin_functions",
    params: {
      source: SRC.product,
      functions: [{ name: "BAT-" }],
      description: "Negative conductor of the XT60 output (discharge) lead, 12 AWG; carries the full pack return current.",
    },
  },
];

// ---------------------------------------------------------------------------
// JST-XH balance lead (cell taps) — no fitting protocol builder
// ---------------------------------------------------------------------------

/** The XT60 plug itself (PB-805): the two conductors mate as one connector. */
const xt60 = Connector({
  id: "xt60",
  name: "XT60 discharge plug",
  connector: "xt60",
  pins: [["BAT+", "battery_out"], ["BAT-", "battery_gnd"]],
  note: XT60_NOTE,
  traits: [
    {
      type: "assumption",
      params: {
        field: "connector gender",
        value: "female (sockets) on the battery lead",
        reason:
          "Source says only 'XT60'. Battery-side female XT60 is the hobby convention so the pack mates with the male XT60 on an ESC/FC lead.",
      },
    },
  ],
});

const balanceLead = {
  id: "balance_lead",
  name: "JST-XH balance lead (6S cell taps)",
  domain: "electrical" as const,
  exposed: true,
  default_active: true,
  protocols: [{ type: "custom", roles: ["peer"] }],
  capabilities: ["battery_balance"],
  parameters: [cellCount(CELLS)],
  traits: [
    connectorTrait("jst_xh_7", {
      positions: 7,
      pinout: ["BAT-", "C1+", "C2+", "C3+", "C4+", "C5+", "C6+ (BAT+)"],
      note: "Balance Connector: JST / XH (src_product). Position count and order per standard 6S XH layout — see assumption.",
    }),
    {
      type: "usage_note",
      params: {
        source: [SRC.product, SRC.chargeGuide],
        note:
          "Connect together with the main lead to a LiPo balance charger (LiPo program, 6S, stop at 4.2 V/cell; " +
          "5C max = 5.5 A per src_product). Also used by cell checkers. Not a flight-power path.",
      },
    },
    {
      type: "assumption",
      params: {
        field: "balance connector positions and pinout",
        value: "7 positions: BAT-, C1+..C6+",
        reason: "Source states only 'JST / XH'; a 6S XH balance plug has cells+1 positions in this order by convention.",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const CNHL_BLACK_SERIES_1100MAH_6S_100C_BASE: ModuleDef = defineModule({
  id: "cnhl-black-series-1100mah-6s-100c",
  name: "CNHL Black Series 1100mAh 6S 22.2V 100C LiPo (XT60)",
  version: "1.0.0",
  manufacturer: "CNHL (China Hobby Line)",
  part_number: "1101006BK",
  description:
    "6S1P 22.2 V 1100 mAh LiPo pack, 100C continual / 200C burst, XT60 discharge lead (12 AWG), JST-XH balance lead. Black Series V1.0.",
  tags: ["lipo", "battery", "6s", "xt60", "fpv", "5-inch", "freestyle"],
  categories: ["power", "battery"],

  interfaces: [batteryOut, batteryGnd, xt60, balanceLead],

  interfaceGroups: [
    {
      id: "xt60_main_lead",
      label: "XT60 discharge plug (+ and − mate together)",
      members: ["battery_out", "battery_gnd"],
      policy: "all_of",
    },
  ],

  artifacts: [
    { id: "product_page", name: "CNHL product page (spec table)", type: "documentation", url: SRC.product },
    { id: "c_rating_guide", name: "CNHL C rating guide", type: "documentation", url: SRC.cRatingGuide },
    { id: "charge_guide", name: "CNHL LiPo charging guide", type: "documentation", url: SRC.chargeGuide },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        {
          id: "pack",
          name: "6S pack (XT60)",
          nominal_voltage_V: NOMINAL_V,
          voltage_range_V: [PACK_MIN_V, PACK_MAX_V],
          max_current_mA: CONT_A * 1000,
          regulation_type: "unregulated",
        },
      ],
      metadata: { chemistry: "LiPo", configuration: "6S1P", lead_gauge_awg: 12, source: SRC.product },
    },
    {
      domain: "mechanical",
      // Source order "39.5X35X75mm", tolerance "1-5mm difference"; longest axis taken as length.
      dimensions_mm: { length: 75, width: 39.5, height: 35 },
      weight_g: 211,
      metadata: {
        weight_tolerance_g: 5,
        weight_includes: "wire and connector (src_pilotshq)",
        dimension_tolerance_mm: "1-5",
        mounting: "none — strapped around the body (no strap interface vocabulary)",
        lead_length_mm: null,
        source: [SRC.product, SRC.pilotshq],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "battery",
        source: [SRC.product, SRC.cRatingGuide],
        chemistry: "LiPo",
        cells: CELLS,
        configuration: "6S1P",
        capacity_mAh: CAPACITY_MAH,
        nominal_voltage_V: NOMINAL_V,
        c_rating_continuous: C_CONT,
        c_rating_burst: C_BURST,
        continuous_current_A: CONT_A,
        burst_current_A: BURST_A,
        burst_duration_s: null,
        energy_Wh_derived: +(NOMINAL_V * (CAPACITY_MAH / 1000)).toFixed(2),
        energy_note: "Not stated by CNHL; derived as 22.2 V × 1.1 Ah.",
      },
    },
    {
      type: "operating_conditions",
      params: {
        source: [SRC.product, SRC.chargeGuide],
        max_charge_rate_C: 5,
        max_charge_current_A: (CAPACITY_MAH * 5) / 1000,
        charge_cutoff_V_per_cell: CELL_MAX_V,
        charge_cutoff_V_pack: PACK_MAX_V,
        normal_cell_voltage_V: [3.7, 4.2],
        charge_method: "LiPo balance charge (main lead + balance plug)",
        operating_temperature_C: null,
        charge_temperature_C: null,
        storage_temperature_C: null,
      },
    },
    {
      type: "data_gap",
      params: {
        fields: [
          "discharge cut-off voltage",
          "operating / charge / storage temperature",
          "burst duration",
          "main and balance lead length",
          "XT60 gender",
          "balance connector pinout",
        ],
        note: "Not stated by CNHL for 1101006BK; see .research/gaps.json. The generated CAD draws the discharge lead about 101 mm long, looped down behind the pack (design values for the reference build, marked in library/cad/params.ts).",
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-775): representative CAD generated from this definition's own
// dimensions by library/cad/py/parts.py — not manufacturer CAD. Frames are in
// the body's coordinates (mm); refs list D1 feature, D2 own artifact, D3
// procedural, in that order. See docs/geometry-artifacts.md.
// ---------------------------------------------------------------------------

export const CNHL_BLACK_SERIES_1100MAH_6S_100C: ModuleDef = withGeometry(
  CNHL_BLACK_SERIES_1100MAH_6S_100C_BASE,
  {
    // The XT60 at the end of the discharge lead: its mating face, facing
    // forward (+X) after the lead loops down behind the pack (a design choice
    // for this build, see library/cad/params.ts); xAxis from BAT+ to BAT-.
    xt60: {
      frame: { origin: [-71.0, 0.0, -18.0], normal: [1.0, 0.0, 0.0], xAxis: [0.0, 1.0, 0.0] },
      refs: [feature("xt60", { area_mm2: 150.88, centroid: [-71.0, 0.0, -18.0], normal: [1.0, 0.0, 0.0] }), own("xt60")],
    },
  },
  // The pack has no mechanical interface (it is strapped), so it cannot be
  // placed from links — see "unlinked modules" in the spec.
  cadArtifacts({
    dir: "library/parts/cnhl-black-series-1100mah-6s-100c/artifacts/cad",
    name: "cnhl-1100-6s",
    generator: "library/cad/py/parts.py",
    tool: "build123d 0.13.0",
    interfaces: ["xt60"],
  }),
);
