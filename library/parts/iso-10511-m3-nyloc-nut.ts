/**
 * ISO 10511 (DIN 985) M3 nylon-insert lock nut, Type T (thin), A2 stainless
 * (Westfield Fasteners WF1288) — datasheet-honest UHD part.
 *
 * Sources (see ./iso-10511-m3-nyloc-nut/sources.json):
 *   - src_product: Westfield Fasteners WF1288 product page — https://www.westfieldfasteners.co.uk/Metric-Nuts/Nyloc-Nut-Type-T-Thin-M3-A2-Stainless.html
 *   - src_spec:    Westfield DIN 985 nyloc nut specification (dimension table) — https://www.westfieldfasteners.co.uk/Standards/Nut-HexNy-M.pdf
 *
 * Modelling notes:
 *   - Generic standard part. manufacturer = the supplier whose specification
 *     is cited (Westfield Fasteners, a stockist); any ISO 10511 / DIN 985 M3
 *     A2 nyloc nut is equivalent.
 *   - One interface, `thread`: the M3x0.5 internal thread, protocol "custom"
 *     role "peer" with fastener_diameter and `length` (= nut height, 4 mm max)
 *     parameters. No fastener protocol exists in the vocabulary (gap in
 *     .research/gaps.json).
 *   - Dimensions are the DIN 985 M3 column of the Westfield specification.
 *     The s (across flats) max prints as "5." in the table; with s min 5.32
 *     and e min 6.01 it is read as 5.5 mm (source_discrepancy trait).
 *   - The spec says DIN 985 is superseded by ISO 10511 "with revised nut
 *     heights and across the flats dimensions on certain sizes, but otherwise
 *     interchangeable"; the stocked part is made to DIN 985, so DIN 985
 *     dimensions are used.
 *   - Role in the 5-inch quadcopter: 4 per flight stack, locking the
 *     iso-4762-m3x30 screws on top of the FC (stack-up in usage_note).
 *   - No mass or nylon-insert temperature limit in the sources (data_gap);
 *     the verify "coverage" thermal warning is expected.
 */
import type { ModuleDef } from "../../src/types/index.js";
import { connectorTrait, defineModule, fastenerDiameterMm } from "../../src/protocols/index.js";

const SRC = {
  product: "https://www.westfieldfasteners.co.uk/Metric-Nuts/Nyloc-Nut-Type-T-Thin-M3-A2-Stainless.html",
  spec: "https://www.westfieldfasteners.co.uk/Standards/Nut-HexNy-M.pdf",
} as const;

export const ISO_10511_M3_NYLOC_NUT: ModuleDef = defineModule({
  id: "iso-10511-m3-nyloc-nut",
  name: "M3 nyloc nut, ISO 10511 / DIN 985 Type T, A2 stainless",
  version: "1.0.0",
  manufacturer: "Generic (ISO 10511 / DIN 985)",
  part_number: "WF1288",
  description:
    "Prevailing-torque hexagon nut with nylon insert, thin Type T, M3 x 0.5, A2 stainless, made to DIN 985 (superseded by ISO 10511). 5.5 mm across flats, 4.0 mm max height. Used 4 per quadcopter flight stack to lock the stack screws above the flight controller.",
  tags: ["standard-part", "fastener", "nut", "nyloc", "lock-nut", "m3", "iso-10511", "din-985", "stainless", "fpv-stack"],
  categories: ["hardware"],

  interfaces: [
    {
      id: "thread",
      name: "M3 x 0.5 internal thread with nylon insert",
      domain: "mechanical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "custom", roles: ["peer"] }],
      capabilities: ["fastener", "internal_thread", "prevailing_torque_lock"],
      parameters: [fastenerDiameterMm(3), { id: "length", unit: "mm", value: 4, range: [3.7, 4] }],
      traits: [
        connectorTrait("metric_thread_internal", {
          gender: "female",
          note: "M3 x 0.5 internal thread; nylon insert at the top resists loosening. `length` is the overall nut height h (DIN 985 M3: max/nom 4, min 3.7). Mates with iso-4762-m3x30-socket-head-cap-screw; the screw should protrude at least ~1 mm past the insert.",
        }),
        {
          type: "pin_functions",
          params: {
            description:
              "DIN 985 M3: p 0.5; da min 3 / max 3.45; dw min 4.6; e min 6.01; h max/nom 4, min 3.7; m min 2.4; s max 5.5 (printed '5.'), min 5.32 (mm).",
            source: SRC.spec,
          },
        },
      ],
    },
  ],

  domains: [
    {
      domain: "mechanical",
      dimensions_mm: { length: 6.01, width: 5.5, height: 4 },
      metadata: {
        thread: "M3 x 0.5",
        height_h_mm: { max: 4, min: 3.7 },
        wrench_height_m_min_mm: 2.4,
        across_flats_s_mm: { max: 5.5, min: 5.32 },
        across_corners_e_min_mm: 6.01,
        bearing_face_dw_min_mm: 4.6,
        standard: "DIN 985 (superseded by ISO 10511)",
        material: "A2 stainless steel",
        source: [SRC.product, SRC.spec],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "fastener",
        fastener_type: "prevailing-torque hexagon nut, nylon insert, Type T (thin)",
        standard: "ISO 10511 (DIN 985)",
        thread: "M3 x 0.5",
        material: "A2 stainless steel",
        source: [SRC.product, SRC.spec],
      },
    },
    {
      type: "usage_note",
      params: {
        note:
          "5-inch quadcopter flight stack, per post: screw from under the 5.0 mm bottom plate → 6 mm spacer → ESC + grommet (4.0 mm, assumed) → 6 mm spacer → FC + grommet (4.0 mm, assumed) → this nut. Nut bearing face at 25.0 mm and top at 29.0 mm above the screw head; the M3 x 30 screw protrudes 1.0 mm (2 pitches) past the insert. Per stack: 4 nuts. Nylon-insert nuts are commonly treated as single-use; re-use is not addressed by the source.",
        quantity_per_stack: 4,
        source: [SRC.product, SRC.spec],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "across flats s max",
        values: ["5. (as printed)", "5.5"],
        sources: [SRC.spec],
        resolution: "Read as 5.5 mm: the same column gives s min 5.32 and e min 6.01, which only fit s = 5.5.",
      },
    },
    {
      type: "assumption",
      params: {
        field: "stack-up inputs",
        value: "bottom plate 5.0 mm carbon; grommeted board clamp height 4.0 mm each (ESC and FC)",
        reason:
          "Custom frame has no plate thickness yet (quadcopter-5in-frame data_gap); DolphinRC gives the grommets only as 'M3*8mm' / 'M3*8.1mm' with no height, so the clamped board+grommet height is estimated.",
      },
    },
    {
      type: "data_gap",
      params: {
        fields: ["mass", "nylon insert temperature limit", "prevailing torque values"],
        note: "Not stated in the Westfield sources.",
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "Westfield WF1288 M3 A2 nyloc nut", type: "documentation", url: SRC.product },
    { id: "art_spec", name: "Westfield DIN 985 nyloc nut specification", type: "datasheet", url: SRC.spec },
  ],
});
