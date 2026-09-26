/**
 * HGLRC Kevlar battery strap, 20x250mm variant (SKU F.ZD.02.00010) —
 * datasheet-honest UHD part.
 *
 * Sources (see ./hglrc-kevlar-battery-strap-20x250mm/sources.json):
 *   - src_product:      HGLRC product page (Name / Material / Size / Weight) —
 *     https://www.hglrc.com/products/hglrc-kevlar-battery-strap-15x250mm-20x250mm
 *   - src_product_json: HGLRC Shopify JSON for the same listing (variant SKUs) —
 *     https://www.hglrc.com/products/hglrc-kevlar-battery-strap-15x250mm-20x250mm.json
 *   - src_epicfpv:      EpicFPV listing (distributor; package contents) —
 *     https://epicfpv.ca/products/hglrc-kevlar-battery-strap-20x250mm
 *
 * Modelling notes:
 *   - Variant lock: the HGLRC listing offers 15x250mm (F.ZD.02.00009, 6 g) and
 *     20x250mm (F.ZD.02.00010, 8.3 g). Only the 20x250mm strap is modelled.
 *   - `strap_loop` is the strap itself as one mechanical interface. There is
 *     no strap protocol or builder, so it is `custom` / `peer` with
 *     parameters strap_width (20 mm) and strap_length (250 mm); vocabulary
 *     gap recorded in .research/gaps.json. The mating features are the
 *     quadcopter-5in-frame battery strap slots (described there only in
 *     text, no interface yet) and the cnhl-black-series-1100mah-6s-100c
 *     pack body (no interface). Nothing pairs in DRC today; the fit check is
 *     arithmetic in a usage_note.
 *   - The fit check assumes a 3 mm frame top plate (the frame lists plate
 *     thickness as a data gap) — see the `assumption` trait.
 *   - No electrical/thermal/network domains: a passive textile strap; HGLRC
 *     states no temperature range (data_gap). This justifies verify's
 *     "no thermal domain" warning.
 *   - Thickness, tensile rating and buckle dimensions are not stated
 *     (data_gap).
 */
import type { ModuleDef } from "../../src/types/index.js";
import { defineModule } from "../../src/protocols/index.js";

const SRC = {
  product: "https://www.hglrc.com/products/hglrc-kevlar-battery-strap-15x250mm-20x250mm",
  productJson: "https://www.hglrc.com/products/hglrc-kevlar-battery-strap-15x250mm-20x250mm.json",
  epicfpv: "https://epicfpv.ca/products/hglrc-kevlar-battery-strap-20x250mm",
} as const;

// src_product "Size: 20x250mm", "Weight: 20x250mm: 8.3g (single)"
const WIDTH_MM = 20;
const LENGTH_MM = 250;
const MASS_G = 8.3;

// Fit check against cnhl-black-series-1100mah-6s-100c (75 x 39.5 x 35 mm,
// dimension tolerance "1-5mm") strapped across its long axis to the frame top plate.
const PACK_W_MM = 39.5;
const PACK_H_MM = 35;
const PACK_TOL_MM = 5;
const PLATE_T_MM_ASSUMED = 3; // assumption — frame plate thickness is a data gap
const LOOP_MM = 2 * (PACK_W_MM + PACK_H_MM) + 2 * PLATE_T_MM_ASSUMED; // 155 mm
const LOOP_WORST_MM = 2 * (PACK_W_MM + PACK_TOL_MM + PACK_H_MM + PACK_TOL_MM) + 2 * PLATE_T_MM_ASSUMED; // 175 mm
const SPARE_MM = LENGTH_MM - LOOP_MM; // 95 mm
const SPARE_WORST_MM = LENGTH_MM - LOOP_WORST_MM; // 75 mm

const strapLoop = {
  id: "strap_loop",
  name: "Battery strap loop (20 x 250 mm, metal buckle, hook and loop)",
  domain: "mechanical" as const,
  exposed: true,
  default_active: true,
  protocols: [{ type: "custom", roles: ["peer"] }],
  capabilities: ["battery_retention"],
  parameters: [
    { id: "strap_width", name: "Strap width", unit: "mm", value: WIDTH_MM },
    { id: "strap_length", name: "Strap length", unit: "mm", value: LENGTH_MM },
  ],
  traits: [
    {
      type: "usage_note",
      params: {
        source: [SRC.product, SRC.epicfpv],
        note:
          "Construction per HGLRC: 'Material: Aramid fiber'; 'High-strength metal buckle'; 'Battery strap comes with anti-slip " +
          "adhesive'; 'The hook and loop are tightly attached to each other and can be used repeatedly'. " +
          "Pack quantity: sold as a single strap ('8.3g (single)'; EpicFPV 'Package Includes: 1x'). A quad normally uses one " +
          "strap per pack; order a second as a spare.",
      },
    },
    {
      type: "usage_note",
      params: {
        source: [SRC.product],
        note:
          "Mating feature: the quadcopter-5in-frame battery strap slots in the top plate (frame requirement 'Carry a " +
          "75 x 39.5 x 35 mm, 211 g 6S 1100 mAh pack on a top-mounted strap'). The strap passes down through one slot, " +
          `under the plate, up through the other, and around the pack. Slots must be at least ${WIDTH_MM} mm long ` +
          "(strap width) — frame slot geometry is not yet defined. No strap protocol exists, so this pairing is not DRC-checked.",
      },
    },
    {
      type: "usage_note",
      params: {
        source: [SRC.product],
        note:
          "Fit check vs cnhl-black-series-1100mah-6s-100c (75 x 39.5 x 35 mm), strap around the 39.5 x 35 mm cross-section " +
          `plus a ${PLATE_T_MM_ASSUMED} mm top plate: loop = 2 x (39.5 + 35) + 2 x ${PLATE_T_MM_ASSUMED} = 149 + 6 = ${LOOP_MM} mm. ` +
          `${LENGTH_MM} - ${LOOP_MM} = ${SPARE_MM} mm left for the buckle pass-through and hook-and-loop overlap. ` +
          `Worst case with CNHL's +5 mm dimension tolerance on both sides: 2 x (44.5 + 40) + 6 = ${LOOP_WORST_MM} mm, ` +
          `leaving ${SPARE_WORST_MM} mm. FITS. Width 20 mm spans about 27% of the 75 mm pack length.`,
      },
    },
    {
      type: "assumption",
      params: {
        field: "frame top-plate thickness in the fit check",
        value: `${PLATE_T_MM_ASSUMED} mm`,
        reason:
          "quadcopter-5in-frame lists plate thickness as a data gap (no CAD yet); 3 mm is a common 5-inch top-plate " +
          "thickness. Each extra mm of plate adds 2 mm to the loop, so the loop only reaches the full 250 mm at a ~50 mm plate; allowing for the buckle and hook-and-loop overlap, keep the plate well under ~40 mm.",
      },
    },
  ],
};

export const HGLRC_KEVLAR_BATTERY_STRAP_20X250MM: ModuleDef = defineModule({
  id: "hglrc-kevlar-battery-strap-20x250mm",
  name: "HGLRC Kevlar battery strap 20x250mm",
  version: "1.0.0",
  manufacturer: "HGLRC",
  part_number: "F.ZD.02.00010",
  description:
    "20 mm x 250 mm aramid-fiber (Kevlar) LiPo strap with high-strength metal buckle, anti-slip adhesive, and reusable hook and loop; 8.3 g, sold singly.",
  tags: ["battery strap", "kevlar", "aramid", "lipo", "fpv", "5-inch"],
  categories: ["structure", "accessory"],

  interfaces: [strapLoop],

  artifacts: [
    { id: "product_page", name: "HGLRC product page", type: "documentation", url: SRC.product },
    { id: "product_json", name: "HGLRC product JSON (variant SKUs)", type: "documentation", url: SRC.productJson },
  ],

  domains: [
    {
      domain: "mechanical",
      dimensions_mm: { length: LENGTH_MM, width: WIDTH_MM },
      weight_g: MASS_G,
      metadata: {
        material: "aramid fiber (Kevlar)",
        buckle: "metal",
        closure: "hook and loop (reusable)",
        anti_slip: "anti-slip adhesive",
        pack_quantity: 1,
        thickness_mm: null,
        source: [SRC.product, SRC.epicfpv],
      },
    },
  ],

  traits: [
    {
      type: "data_gap",
      params: {
        fields: ["strap thickness", "tensile strength / load rating", "buckle dimensions", "anti-slip strip length", "temperature range"],
        note: "Not stated by HGLRC for F.ZD.02.00010; see .research/gaps.json.",
      },
    },
  ],
});
