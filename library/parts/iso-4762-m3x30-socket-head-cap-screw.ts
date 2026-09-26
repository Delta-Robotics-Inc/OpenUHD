/**
 * ISO 4762 (DIN 912) M3 x 30 mm socket head cap screw, A2 stainless
 * (Westfield Fasteners WF2352) — datasheet-honest UHD part.
 *
 * Sources (see ./iso-4762-m3x30-socket-head-cap-screw/sources.json):
 *   - src_product: Westfield Fasteners WF2352 product page — https://www.westfieldfasteners.co.uk/Bolts-Screws-Metric/Socket-Head-Cap-Allen-Screw-M3x30-A2-Stainless.html
 *   - src_spec:    Westfield socket head cap screw specification (DIN 912 / ISO 4762 table) — https://www.westfieldfasteners.co.uk/Datasheets/ScrewBolt_SHCap_M.pdf
 *
 * Modelling notes:
 *   - Generic standard part. manufacturer = the supplier whose specification
 *     is cited (Westfield Fasteners, a stockist); any ISO 4762 M3x30 A2 screw
 *     is equivalent. sources.json marks Westfield as the manufacturer
 *     authority on that basis and says so in each row's note.
 *   - One interface, `thread`: the M3x0.5 external thread and 30 mm
 *     under-head length. There is no fastener/threaded-joint protocol in the
 *     vocabulary, so it uses protocol "custom", role "peer", with the
 *     canonical fastener_diameter parameter plus a `length` parameter
 *     (vocabulary gap in .research/gaps.json). BoltPattern is a hole pattern
 *     on a plate, not a single screw, so it is not used here.
 *   - Role in the 5-inch quadcopter: one of the 4 screws that join the frame
 *     bottom plate, the DolphinRC AM32 ESC and the DolphinRC F405 V3 FC on the
 *     30.5 x 30.5 mm stack pattern. Stack-up arithmetic is in the module
 *     usage_note; the plate thickness and grommet clamp height are
 *     assumptions (assumption traits).
 *   - Motor screws are NOT this part: the MEPS NEON 2207 V2 ships with its
 *     own M3 socket-head mounting screws (meps-neon-2207-v2-1950kv src_package_photo).
 *   - No mass or temperature rating in the sources (data_gap); the verify
 *     "coverage" thermal warning is expected.
 */
import type { ModuleDef } from "../../src/types/index.js";
import { connectorTrait, defineModule, fastenerDiameterMm } from "../../src/protocols/index.js";

const SRC = {
  product:
    "https://www.westfieldfasteners.co.uk/Bolts-Screws-Metric/Socket-Head-Cap-Allen-Screw-M3x30-A2-Stainless.html",
  spec: "https://www.westfieldfasteners.co.uk/Datasheets/ScrewBolt_SHCap_M.pdf",
} as const;

export const ISO_4762_M3X30_SOCKET_HEAD_CAP_SCREW: ModuleDef = defineModule({
  id: "iso-4762-m3x30-socket-head-cap-screw",
  name: "M3 x 30 mm socket head cap screw, ISO 4762, A2 stainless",
  version: "1.0.0",
  manufacturer: "Generic (ISO 4762 / DIN 912)",
  part_number: "WF2352",
  description:
    "ISO 4762 (DIN 912) socket head cap screw, M3 x 0.5 x 30 mm, A2 stainless steel. Head Ø5.5 mm max x 3.0 mm max, 2.5 mm hex socket, 18 mm minimum thread length. Used 4 per quadcopter flight stack (frame plate + ESC + FC on 30.5 x 30.5 mm).",
  tags: ["standard-part", "fastener", "screw", "socket-head-cap-screw", "m3", "iso-4762", "din-912", "stainless", "fpv-stack"],
  categories: ["hardware"],

  interfaces: [
    {
      id: "thread",
      name: "M3 x 0.5 external thread, 30 mm",
      domain: "mechanical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "custom", roles: ["peer"] }],
      capabilities: ["fastener", "external_thread"],
      parameters: [fastenerDiameterMm(3), { id: "length", unit: "mm", value: 30 }],
      traits: [
        connectorTrait("metric_thread_external", {
          gender: "male",
          note: "M3 x 0.5 coarse thread; nominal length 30 mm measured under the head; minimum thread length b = 18 mm (so up to 12 mm of the shank next to the head may be unthreaded). Mates with an M3 nut (iso-10511-m3-nyloc-nut) or a tapped M3 hole; passes Φ3.4 spacers and Φ4 grommeted board holes.",
        }),
        {
          type: "pin_functions",
          params: {
            description:
              "d M3, thread pitch 0.50, dk max 5.5, k max 3.0, s (drive) 2.5, b (min thread length) 18, t (recess depth) 1.3; all dimensions in mm. Standard ISO 4762 (DIN 912). Material A2 Stainless Steel.",
            source: [SRC.product, SRC.spec],
          },
        },
      ],
    },
  ],

  domains: [
    {
      domain: "mechanical",
      dimensions_mm: { length: 33, width: 5.5, height: 5.5 },
      metadata: {
        thread: "M3 x 0.5",
        nominal_length_mm: 30,
        head_diameter_max_mm: 5.5,
        head_height_max_mm: 3.0,
        hex_socket_mm: 2.5,
        socket_depth_mm: 1.3,
        min_thread_length_mm: 18,
        standard: "ISO 4762 (DIN 912)",
        material: "A2 stainless steel",
        dimensions_note: "Envelope = 30 mm length + 3.0 mm max head height; width = 5.5 mm max head diameter.",
        source: [SRC.product, SRC.spec],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "fastener",
        fastener_type: "socket head cap screw",
        standard: "ISO 4762 (DIN 912)",
        thread: "M3 x 0.5",
        length_mm: 30,
        material: "A2 stainless steel",
        source: [SRC.product, SRC.spec],
      },
    },
    {
      type: "usage_note",
      params: {
        note:
          "5-inch quadcopter flight stack, per post (4 posts on the 30.5 x 30.5 mm pattern), bottom to top: this screw inserted from under the frame bottom plate (5.0 mm) → ettinger-005-83-060 spacer (6.0 mm) → AM32 ESC in its M3x8.1 grommet (4.0 mm clamped, assumed) → spacer (6.0 mm) → F405 V3 FC in its M3x8 grommet (4.0 mm clamped, assumed) → iso-10511 nyloc nut (4.0 mm max). Stack below nut = 5 + 6 + 4 + 6 + 4 = 25.0 mm; nut top at 29.0 mm; screw 30 mm → 1.0 mm (2 pitches) protrudes past the nylon insert. The nut sits 25–29 mm from the head, inside the threaded zone (≥ 30 − 18 = 12 mm from the head). If the grommets clamp thicker than ~4.25 mm each (the nylon insert would no longer fully engage), use M3 x 35. Per stack: 4 screws, 8 spacers, 4 nyloc nuts.",
        quantity_per_stack: 4,
        source: [SRC.product, SRC.spec],
      },
    },
    {
      type: "assumption",
      params: {
        field: "stack-up inputs",
        value: "bottom plate 5.0 mm carbon; grommeted board clamp height 4.0 mm each (ESC and FC)",
        reason:
          "The frame is custom with no CAD or plate thickness yet (quadcopter-5in-frame data_gap). DolphinRC gives the grommets only as 'M3*8mm' (FC) and 'M3*8.1mm' (ESC) with no height drawing, so the clamped board+grommet height is estimated.",
      },
    },
    {
      type: "data_gap",
      params: {
        fields: ["mass", "operating temperature", "tightening torque"],
        note: "Not stated in the Westfield sources.",
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "Westfield WF2352 M3x30 A2 socket head cap screw", type: "documentation", url: SRC.product },
    { id: "art_spec", name: "Westfield socket head cap screw specification (DIN 912 / ISO 4762)", type: "datasheet", url: SRC.spec },
  ],
});
