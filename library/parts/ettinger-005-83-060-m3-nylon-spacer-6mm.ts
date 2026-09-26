/**
 * ETTINGER 005.83.060 round spacer Ø3.4/6.0 x 6.0 mm, PA6 GF25 black (for M3)
 * — datasheet-honest UHD part.
 *
 * Sources (see ./ettinger-005-83-060-m3-nylon-spacer-6mm/sources.json):
 *   - src_product:   ETTINGER product page — https://www.ettinger.de/en/p/round-spacer-oe3.4-6.0-x-6.0-pa-gf-black/005.83.060
 *   - src_datasheet: ETTINGER article datasheet — https://www.ettinger.de/en/product-datasheet/ee1a856488fea31e9380d958040040b8/create
 *   - src_drawing:   ETTINGER technical sketch — https://www.ettinger.de/media/26/33/c4/1747222703/Z00583060_8fa8bd.JPG
 *
 * Modelling notes:
 *   - Unthreaded smooth-end round spacer: Φ3.4 mm bore (M3 clearance),
 *     Φ6.0 mm OD, 6.0 mm long, glass-filled polyamide 6 (nylon), 0.15 g.
 *   - One interface, `bore`: clearance for an M3 screw, protocol "custom"
 *     role "peer" with fastener_diameter 3 and `length` 6 mm. No fastener
 *     protocol exists in the vocabulary (gap in .research/gaps.json).
 *   - Role in the 5-inch quadcopter: 8 per flight stack, 2 per post — one
 *     between the frame bottom plate and the ESC, one between the ESC and the
 *     FC — on the iso-4762-m3x30 screws (stack-up in usage_note). The 6 mm OD
 *     bears on the boards' rubber grommets, not on bare PCB.
 *   - No operating temperature in the sources (data_gap); the verify
 *     "coverage" thermal warning is expected.
 */
import type { ModuleDef } from "../../src/types/index.js";
import { connectorTrait, defineModule, fastenerDiameterMm } from "../../src/protocols/index.js";

const SRC = {
  product: "https://www.ettinger.de/en/p/round-spacer-oe3.4-6.0-x-6.0-pa-gf-black/005.83.060",
  datasheet: "https://www.ettinger.de/en/product-datasheet/ee1a856488fea31e9380d958040040b8/create",
  drawing: "https://www.ettinger.de/media/26/33/c4/1747222703/Z00583060_8fa8bd.JPG",
} as const;

export const ETTINGER_005_83_060_M3_NYLON_SPACER_6MM: ModuleDef = defineModule({
  id: "ettinger-005-83-060-m3-nylon-spacer-6mm",
  name: "ETTINGER 005.83.060 M3 round spacer 6 mm, PA6 GF25",
  version: "1.0.0",
  manufacturer: "ETTINGER",
  part_number: "005.83.060",
  description:
    "Unthreaded round spacer with smooth ends for M3: Φ3.4 mm bore, Φ6.0 mm OD, 6.0 mm long, black PA 6.0 25% GF (UL94-HB), 0.15 g. Used 8 per quadcopter flight stack to space the ESC above the frame plate and the FC above the ESC.",
  tags: ["fastener", "spacer", "nylon", "polyamide", "m3", "fpv-stack"],
  categories: ["hardware"],

  interfaces: [
    {
      id: "bore",
      name: "Φ3.4 mm M3 clearance bore, 6 mm long",
      domain: "mechanical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "custom", roles: ["peer"] }],
      capabilities: ["fastener", "clearance_bore", "spacer"],
      parameters: [fastenerDiameterMm(3), { id: "length", unit: "mm", value: 6 }],
      traits: [
        connectorTrait("clearance_bore", {
          note: "Plain Φ3.4 mm through bore for an M3 screw (unthreaded, smooth ends); 6.0 mm long, Φ6.0 mm OD.",
        }),
        {
          type: "pin_functions",
          params: {
            description:
              "For Thread Size M3; Inner Diameter 3.4 mm; Outer Diameter 6 mm; Length 6 mm; Material PA 6.0 25% GF; UL94-HB; black. Drawing: 6,0 long, Ø6,0, Ø3,4.",
            source: [SRC.product, SRC.datasheet, SRC.drawing],
          },
        },
      ],
    },
  ],

  domains: [
    {
      domain: "mechanical",
      dimensions_mm: { length: 6, width: 6, height: 6 },
      weight_g: 0.15,
      metadata: {
        inner_diameter_mm: 3.4,
        outer_diameter_mm: 6,
        length_mm: 6,
        material: "PA 6.0 25% GF (glass-filled polyamide 6 / nylon)",
        flammability: "UL94-HB",
        color: "black",
        ends: "smooth (unthreaded)",
        source: [SRC.product, SRC.datasheet, SRC.drawing],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "fastener",
        fastener_type: "round spacer, unthreaded, smooth ends",
        for_thread: "M3",
        length_mm: 6,
        material: "PA 6.0 25% GF",
        flammability: "UL94-HB",
        conformities: ["REACh 1907/2006", "RoHS 2011/65/EU + 2015/863/EU"],
        source: [SRC.product, SRC.datasheet],
      },
    },
    {
      type: "usage_note",
      params: {
        note:
          "5-inch quadcopter flight stack, per post (bottom to top): M3 x 30 screw head under the 5.0 mm bottom plate → this spacer (6.0) → AM32 ESC in grommet (4.0, assumed) → this spacer (6.0) → F405 V3 FC in grommet (4.0, assumed) → M3 nyloc (4.0 max). 5 + 6 + 4 + 6 + 4 = 25 mm to the nut face, 29 mm to the nut top, 1 mm screw protrusion. The lower spacer keeps the ESC's underside 6 mm off the (conductive) carbon plate; the upper one gives 6 mm between ESC and FC for the 50 mm 8-pin FC-ESC cable. Per stack: 8 spacers.",
        quantity_per_stack: 8,
        source: [SRC.product, SRC.datasheet],
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
        fields: ["operating temperature", "compressive load rating"],
        note: "Not stated in the ETTINGER sources.",
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "ETTINGER 005.83.060 product page", type: "documentation", url: SRC.product },
    { id: "art_datasheet", name: "ETTINGER 005.83.060 article datasheet", type: "datasheet", url: SRC.datasheet },
    { id: "art_drawing", name: "ETTINGER 005.83.060 technical sketch", type: "cad", url: SRC.drawing },
  ],
});
