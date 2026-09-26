/**
 * Panasonic EEU-FR1V471 (FR series, 35 V 470 µF, ø10 x 16 mm radial, low
 * ESR aluminium electrolytic) — datasheet-honest UHD part. Stands in for the
 * unbranded "35V 470μF Low ESR Capacitor" bundled with the DolphinRC F405 V3
 * 50A/60A stack.
 *
 * Sources (see ./panasonic-eeu-fr1v471/sources.json):
 *   - src_datasheet:         Panasonic FR(-A) series datasheet, rev. 01-Sep-25 —
 *     https://industrial.panasonic.com/cdbs/www-data/pdf/RDF0000/ABA0000C1259.pdf
 *   - src_series_page:       Panasonic NA EEU-FR series page (datasheet link
 *     redirects to ABA0000C1259.pdf) —
 *     https://na.industrial.panasonic.com/products/capacitors/aluminum-electrolytic-capacitors/lineup/aluminum-electrolytic-capacitors-radial-lead-type/series/83367
 *   - src_dolphinrc_product: DolphinRC F405 V3 50A 60A STACK product page
 *     ("Includes: 1x 35V 470μF Low ESR Capacitor") —
 *     https://dolphinrc.com/products/dolphinrc-f405-v3-50a-60a-stack
 *
 * Modelling notes:
 *   - Identity: DolphinRC names no brand, series or MPN for the bundled
 *     capacitor, and no product photo shows its sleeve. This part is a
 *     documented equivalent with the same 35 V / 470 µF rating, chosen because
 *     Panasonic publishes a full datasheet. Exact row locked: EEUFR1V471( )
 *     (ø10 x 16, bulk straight leads), not the ø8 x 20 EEUFR1V471L. The
 *     stand-in status is recorded in a usage_note and an assumption trait.
 *   - The datasheet page header says "FR-A series"; the PDF title and the
 *     NA series page say "FR". Part numbers are EEUFR…; treated as one series.
 *   - `pos` (PowerIn, role input) is the + lead. voltage range [0, 35] V: the
 *     rated voltage is the ceiling the rail must stay under (6S LiPo full
 *     charge 25.2 V < 35 V). It carries ripple_current = 1.79 A rms
 *     (100 kHz / +105 °C). `neg` (Ground) is the − lead.
 *   - ESR: Panasonic specifies impedance at 100 kHz (0.028 Ω max, +20 °C),
 *     not ESR. Since |Z| ≥ ESR it is an upper bound on ESR at 100 kHz; the
 *     performance trait states it as impedance. The 120 Hz ESR bound from
 *     tan δ is labelled derived.
 *   - Lead polarity marking (negative stripe on the sleeve) is not stated in
 *     the datasheet pages read: assumption trait.
 *   - Verify warning "no mechanical interfaces" is intentional: the part has
 *     no mounting feature; it hangs on its soldered leads. Dimensions live in
 *     the mechanical domain. Mass is not stated (data_gap).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { Ground, PowerIn, connectorTrait, defineModule } from "../../src/protocols/index.js";

const SRC = {
  datasheet: "https://industrial.panasonic.com/cdbs/www-data/pdf/RDF0000/ABA0000C1259.pdf",
  seriesPage:
    "https://na.industrial.panasonic.com/products/capacitors/aluminum-electrolytic-capacitors/lineup/aluminum-electrolytic-capacitors-radial-lead-type/series/83367",
  dolphinrc: "https://dolphinrc.com/products/dolphinrc-f405-v3-50a-60a-stack",
} as const;

// ---------------------------------------------------------------------------
// Datasheet constants — src_datasheet, "Characteristics list", 35 V block,
// row EEUFR1V471( ) unless noted
// ---------------------------------------------------------------------------

const RATED_V = 35;
const CAPACITANCE_UF = 470;
const RIPPLE_A = 1.79; // 1790 mA rms, 100 kHz / +105 °C (footnote *1)
const Z_100K_20C_OHM = 0.028; // impedance, 100 kHz / +20 °C (footnote *2)
const Z_100K_M10C_OHM = 0.078; // "Case size / Impedance / Ripple current", 10 x 16, -10 °C
const TAN_DELTA = 0.12; // Specifications: 35 V, 120 Hz / +20 °C
const ENDURANCE_H = 8000; // Endurance: "ø8×15, ø10×16 : 8000 h"
const DIA_MM = 10.0;
const LEN_MM = 16.0;
const LEAD_DIA_MM = 0.6;
const LEAD_SPACE_MM = 5.0;
const TEMP_C: [number, number] = [-40, 105];

// Derived (labelled as such where used)
const LEAKAGE_UA = +(0.01 * CAPACITANCE_UF * RATED_V).toFixed(1); // 0.01 CV = 164.5 µA
const ESR_120HZ_MAX_OHM = +(TAN_DELTA / (2 * Math.PI * 120 * CAPACITANCE_UF * 1e-6)).toFixed(3); // ≈ 0.339 Ω

const LEAD_NOTE =
  `Radial lead, straight (bulk) form: lead ø${LEAD_DIA_MM}±0.05 mm, lead space F=${LEAD_SPACE_MM}±0.5 mm; ` +
  "dimension drawing gives lead lengths '14min.' / '3min.' (src_datasheet). Soldered by the builder through the holes " +
  "in the ESC's + / − battery pads (DolphinRC).";

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

const pos = withTraits(
  PowerIn({
    id: "pos",
    name: "+ lead",
    pin: "+",
    voltageV: [0, RATED_V],
    parameters: [
      { id: "ripple_current", name: "Rated ripple current (100 kHz, +105 °C)", value: RIPPLE_A, unit: "A" },
    ],
  }),
  [
    {
      type: "pin_functions",
      params: {
        description: `Positive (anode) lead. Rated voltage ${RATED_V} V DC; the sum of DC and ripple peak voltage shall not exceed the rated voltage.`,
        source: SRC.datasheet,
      },
    },
    connectorTrait("radial_lead", { positions: 2, pinout: ["+", "-"], note: LEAD_NOTE }),
    {
      type: "usage_note",
      params: {
        note:
          `Ripple rating ${RIPPLE_A} A rms is at 100 kHz / +105 °C. Frequency correction (390–1000 µF): ` +
          "60 Hz ×0.65, 120 Hz ×0.75, 1 kHz ×0.90, 10 kHz ×0.98, 100 kHz ×1.00.",
        source: SRC.datasheet,
      },
    },
  ],
);

const neg = withTraits(Ground({ id: "neg", name: "− lead", pin: "-" }), [
  {
    type: "pin_functions",
    params: { description: "Negative (cathode) lead.", source: SRC.datasheet },
  },
  connectorTrait("radial_lead", { positions: 2, pinout: ["+", "-"], note: LEAD_NOTE }),
]);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export const PANASONIC_EEU_FR1V471: ModuleDef = defineModule({
  id: "panasonic-eeu-fr1v471",
  name: "Panasonic EEU-FR1V471 470 µF 35 V low-ESR electrolytic capacitor",
  version: "1.0.0",
  manufacturer: "Panasonic Industry",
  part_number: "EEU-FR1V471",
  description:
    "Aluminium electrolytic capacitor, FR series, 470 µF ±20 %, 35 V, ø10 x 16 mm radial, 5 mm lead space, " +
    "1.79 A rms ripple (100 kHz/105 °C), 0.028 Ω impedance (100 kHz/20 °C), 8000 h at 105 °C. " +
    "Used as the ESC battery-pad bulk capacitor, standing in for the unbranded 35 V 470 µF low-ESR capacitor bundled with the DolphinRC F405 V3 stack.",
  tags: ["capacitor", "electrolytic", "low-esr", "470uf", "35v", "radial", "bulk-capacitor", "esc", "fpv", "drone"],
  categories: ["passive", "capacitor"],
  interfaces: [pos, neg],
  artifacts: [
    { id: "datasheet", name: "Panasonic FR(-A) series datasheet (01-Sep-25)", type: "datasheet", url: SRC.datasheet },
    { id: "series_page", name: "Panasonic NA EEU-FR series page", type: "documentation", url: SRC.seriesPage },
    { id: "dolphinrc_product", name: "DolphinRC F405 V3 50A 60A STACK product page", type: "documentation", url: SRC.dolphinrc },
  ],
  domains: [
    {
      domain: "electrical",
      power_domains: [{ id: "bulk", name: "Battery rail (across + / −)", voltage_range_V: [0, RATED_V] }],
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: LEN_MM, width: DIA_MM, height: DIA_MM },
      metadata: {
        form: "cylindrical can, radial leads",
        case_diameter_mm: DIA_MM,
        case_diameter_tolerance_mm: 0.5,
        case_length_mm: LEN_MM,
        case_length_tolerance_mm: 1.5,
        lead_diameter_mm: LEAD_DIA_MM,
        lead_spacing_mm: LEAD_SPACE_MM,
        lead_spacing_tolerance_mm: 0.5,
        pressure_relief: "vent on the can top (ø ≥ 6.3 mm)",
        dimensions_note: "dimensions_mm.length = can length L; width/height = can diameter øD",
        source: SRC.datasheet,
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: TEMP_C,
      metadata: { endurance_h_at_105C: ENDURANCE_H, shelf_life: "1000 h at +105 °C, no voltage", source: SRC.datasheet },
    },
  ],
  traits: [
    {
      type: "performance",
      params: {
        kind: "capacitor",
        dielectric: "aluminium electrolytic, low ESR (\"Same as FM Series\")",
        capacitance_uF: CAPACITANCE_UF,
        tolerance_pct: 20,
        tolerance_conditions: "120 Hz / +20 °C",
        rated_voltage_V: RATED_V,
        ripple_current_A_rms: RIPPLE_A,
        ripple_conditions: "100 kHz / +105 °C",
        esr_ohm: Z_100K_20C_OHM,
        esr_note:
          "Datasheet specifies impedance, not ESR: 0.028 Ω max at 100 kHz / +20 °C and 0.078 Ω at 100 kHz / -10 °C; |Z| ≥ ESR, so these bound ESR at 100 kHz.",
        impedance_100kHz_minus10C_ohm: Z_100K_M10C_OHM,
        tan_delta_120Hz: TAN_DELTA,
        esr_120Hz_max_ohm_derived: ESR_120HZ_MAX_OHM,
        leakage_current_uA_derived: LEAKAGE_UA,
        leakage_note: "I ≤ 0.01 CV (µA) 2 minutes after reaching rated voltage, +20 °C; 0.01 × 470 × 35 = 164.5 µA (derived).",
        endurance_h: ENDURANCE_H,
        endurance_temp_C: 105,
        endurance_conditions: "rated DC + rated ripple at +105 °C; after test ΔC within ±25 %, tan δ ≤ 200 % of initial limit, leakage within initial limit",
        source: SRC.datasheet,
      },
    },
    {
      type: "operating_conditions",
      params: {
        category_temperature_C: TEMP_C,
        max_voltage_V: RATED_V,
        note: "Sum of DC and ripple peak voltage shall not exceed the rated voltage.",
        source: SRC.datasheet,
      },
    },
    {
      type: "usage_note",
      params: {
        note:
          "Stand-in for the bundled capacitor: DolphinRC's F405 V3 50A/60A stack includes '1x 35V 470μF Low ESR Capacitor' " +
          "with no brand, series or part number. Solder it across the AM32 ESC's + / − battery pads, + lead to +, " +
          "as close to the pads as possible. A 6S LiPo peaks at 25.2 V, under the 35 V rating.",
        source: [SRC.dolphinrc, SRC.datasheet],
      },
    },
    {
      type: "assumption",
      params: {
        field: "identity",
        value: "Panasonic EEU-FR1V471 (ø10 x 16 mm)",
        reason:
          "The bundled capacitor is unbranded and unidentifiable from DolphinRC's page, manual or photos. EEU-FR1V471 matches its " +
          "35 V / 470 µF / low-ESR spec and has a manufacturer datasheet; the real bundled part's ESR, ripple rating, size and life may differ.",
      },
    },
    {
      type: "assumption",
      params: {
        field: "lead polarity identification",
        value: "negative lead marked by the sleeve stripe",
        reason: "Standard aluminium electrolytic marking; the datasheet pages read do not state it. Check the sleeve before soldering.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "series name",
        values: ["FR-A series (datasheet page header)", "FR series (PDF title, NA series page)"],
        sources: [SRC.datasheet, SRC.seriesPage],
        resolution: "Same document: the NA EEU-FR series page's datasheet link redirects to ABA0000C1259.pdf; part numbers are EEUFR….",
      },
    },
    {
      type: "data_gap",
      params: {
        fields: ["mass", "bundled capacitor's real brand / MPN", "ESR as a separate spec (only impedance and tan δ given)"],
        note: "Not stated by any source.",
      },
    },
  ],
});
