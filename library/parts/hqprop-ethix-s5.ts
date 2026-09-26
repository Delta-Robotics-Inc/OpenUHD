/**
 * HQProp Ethix S5 (5x4x3, polycarbonate; SKU EthixS5-GR-PC) — datasheet-honest UHD part.
 *
 * Sources (see ./hqprop-ethix-s5/sources.json):
 *   - src_product: HQProp product page, Ethix S5 Light Grey (2CW+2CCW) —
 *     https://www.hqprop.com/ethix-s5-light-grey-2cw2ccw-poly-carbonate-p0206.html
 *   - src_rdq:     RaceDayQuads listing (distributor, corroboration only) —
 *     https://www.racedayquads.com/products/hq-prop-ethix-s5-5x4x3-tri-blade-5-prop-4-pack-light-grey
 *
 * Modelling notes:
 *   - One module is ONE propeller. The retail pack holds 4 (2 CW + 2 CCW);
 *     that is carried in the performance trait and a usage_note, not as
 *     separate modules. The colour of the cited SKU (light grey) is cosmetic;
 *     the geometry is the same spec table.
 *   - `hub_bore` is a Shaft input with a 5 mm bore (manufacturer "Shaft: 5mm",
 *     "Adaptor Rings: NO"), so it pairs with a 5 mm motor shaft output. No
 *     `thread` is set: the bore is plain and the M5 thread belongs to the
 *     motor shaft. The sources do not say whether the hub is nut-retained or
 *     T-mount, so that is a `data_gap`, not a claim.
 *   - Handedness (CW vs CCW) has no parameter on the Shaft protocol, so it is
 *     a performance field + usage_note; recorded as a vocabulary gap in
 *     .research/gaps.json. No protocol was invented.
 *   - No electrical domain (passive part). No network/fluid domains.
 *   - Thermal: neither source gives an operating or storage temperature, so
 *     there is no thermal domain or operating_conditions trait. verify-part's
 *     "coverage: no thermal domain" warning is expected and justified here.
 *   - Recommended motor / cell count: the manufacturer page states none.
 *     Some resellers mention 4S/6S in marketing copy; that is not modelled
 *     (data_gap). No thrust data exists in the sources.
 *   - Prop diameter is kept in inches as the source states it; no mm
 *     envelope is put in dimensions_mm (would be a derived value).
 */
import type { ModuleDef } from "../../src/types/index.js";
import { defineModule, Shaft } from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.hqprop.com/ethix-s5-light-grey-2cw2ccw-poly-carbonate-p0206.html",
  rdq: "https://www.racedayquads.com/products/hq-prop-ethix-s5-5x4x3-tri-blade-5-prop-4-pack-light-grey",
} as const;

/** "Shaft :5mm" — src_product. */
const BORE_MM = 5;
/** "Hub Diameter :12.8mm", "Hub Thickness:6mm" — src_product. */
const HUB_DIAMETER_MM = 12.8;
const HUB_THICKNESS_MM = 6;
/** "Weight :3.7g" — src_product (per propeller). */
const WEIGHT_G = 3.7;

const hubBore = {
  ...Shaft({
    id: "hub_bore",
    name: "Hub bore (5 mm)",
    role: "input",
    diameterMm: BORE_MM,
    note:
      "Plain 5 mm hub bore, no adaptor rings (src_product). Hub Ø12.8 mm x 6 mm thick. Retention method (prop nut vs T-mount) is not stated by the source. Sold as CW and CCW variants; mount the handedness that matches the motor's rotation direction.",
  }),
};
hubBore.traits = [
  ...(hubBore.traits ?? []),
  {
    type: "data_gap",
    params: {
      field: "hub retention style",
      note: "Source gives bore and hub size only; it does not say nut-retained or T-mount, nor a prop nut thread.",
      source: SRC.product,
    },
  },
];

const HQPROP_ETHIX_S5_BASE: ModuleDef = defineModule({
  id: "hqprop-ethix-s5",
  name: "HQProp Ethix S5 5x4x3 Propeller",
  version: "1.0.0",
  manufacturer: "HQProp",
  part_number: "EthixS5-GR-PC",
  description:
    "5-inch tri-blade polycarbonate multirotor propeller, 5x4x3 (5 in diameter, 4 in pitch), 3.7 g, 5 mm bore. One module = one propeller; retail pack is 2 CW + 2 CCW.",
  tags: ["propeller", "5-inch", "tri-blade", "5x4x3", "5040", "ethix", "fpv", "polycarbonate"],
  categories: ["mechanical.propeller", "drone.propulsion"],

  interfaces: [hubBore],

  domains: [
    {
      domain: "mechanical",
      weight_g: WEIGHT_G,
      metadata: {
        prop_diameter_in: 5,
        pitch_in: 4,
        blade_count: 3,
        hub_diameter_mm: HUB_DIAMETER_MM,
        hub_thickness_mm: HUB_THICKNESS_MM,
        bore_mm: BORE_MM,
        adaptor_rings: false,
        material: "polycarbonate",
        source: SRC.product,
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "propeller",
        diameter_in: 5,
        pitch_in: 4,
        blades: 3,
        material: "Poly Carbonate",
        weight_g: WEIGHT_G,
        handedness: ["CW", "CCW"],
        pack_quantity: 4,
        pack_split: { cw: 2, ccw: 2 },
        source: [SRC.product, SRC.rdq],
      },
    },
    {
      type: "usage_note",
      params: {
        note: "Pack includes 2 x CW and 2 x CCW Ethix S5 propellers. On a quad, fit the CW and CCW props to the motors spinning in the matching direction (one module per motor position).",
        source: SRC.product,
      },
    },
    {
      type: "data_gap",
      params: {
        field: "recommended motor / cell count, thrust data, operating temperature",
        note: "The manufacturer page gives none of these.",
        source: SRC.product,
      },
    },
  ],

  artifacts: [
    { id: "art_product", name: "HQProp Ethix S5 product page", type: "datasheet", url: SRC.product },
    { id: "art_rdq", name: "RaceDayQuads listing (distributor)", type: "documentation", url: SRC.rdq },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-775): representative CAD generated from this definition's own
// dimensions by library/cad/py/parts.py — not manufacturer CAD. Frames are in
// the body's coordinates (mm); refs list D1 feature, D2 own artifact, D3
// procedural, in that order. See docs/geometry-artifacts.md.
// ---------------------------------------------------------------------------

export const HQPROP_ETHIX_S5: ModuleDef = withGeometry(
  HQPROP_ETHIX_S5_BASE,
  {
    hub_bore: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0], symmetryDeg: 120 },
      refs: [feature("hub_bore", { area_mm2: 94.248, centroid: [0.0, 0.0, 3.0] }), own("hub_bore"), procedural("shaft")],
    },
  },
  cadArtifacts({
    dir: "library/parts/hqprop-ethix-s5/artifacts/cad",
    name: "hqprop-ethix-s5",
    generator: "library/cad/py/parts.py",
    tool: "build123d 0.13.0",
    interfaces: ["hub_bore"],
  }),
);
