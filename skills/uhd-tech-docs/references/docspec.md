# Doc spec (`<system>/docs/docspec.ts`)

Type: `DocConfig` in `scripts/docs/lib/types.ts`. Presentation only. Worked example:
`library/systems/quadcopter-5in/docs/docspec.ts`.

```ts
import type { DocConfig } from "../../../../scripts/docs/lib/types.js";
import { BATTERY_PAD } from "../frame.js";              // model constants are fine

const config: DocConfig = {
  title: "5-inch 6S Quadcopter", docId: "UHD-QUAD5", revision: "A",
  root: ["frame"],                                       // assemble() root
  camera: { dir: [1, -1.18, 0.82] },                     // house iso: front-right-above (X forward, Z up)
  placementHints: [{ path: ["battery"], matrix: [/* from BATTERY_PAD */], note: "frame BATTERY_PAD" }],
  datasheet: {
    keyFigures: [{ label: "Static thrust", q: "derived:propulsion.thrust_full_total", f: "si|d1", sub: "…" }],
    specGroups: [{ title: "Power", rows: [{ label: "Capacity", q: "def:…:interfaces[id=battery_out].parameters[id=capacity].value" }] }],
    mechanicalCallouts: ["frame.stack_mount", "top_plate.gps_mount"],
    hub: "stack/fc",
  },
  assembly: {
    explode: 16,
    steps: [
      { id: "motors", title: "Mount the motors", mates: ["arm_*_mount"], camera: { dir: [1, -1.3, 0.42] } },
      { id: "stack", title: "Build the FC and ESC stack", mates: ["stack_mount", "fc_mount"], wiring: ["stack/*"] },
      { id: "power", title: "Solder the battery lead and capacitor", wiring: ["battery_*", "bulk_cap_*"], figure: "wiring" },
      { id: "battery", title: "Strap on the battery", place: ["battery", "strap"] },
      { id: "props", title: "Fit the propellers", mates: ["arm_*/prop_on_shaft"],
        notes: [{ kind: "caution", text: "A pack holds {{def:hqprop-ethix-s5:traits[type=performance].params.pack_split.cw}} CW …" }] },
    ],
  },
  testData: { standins: "multirotor" },
};
export default config;
```

## Step rules

- `mates` match `assemble().mates[].linkId` (sub-assembly mates are prefixed: `arm_fl/prop_on_shaft`).
- `wiring` match `wiringChecklist` link ids; sub-assembly links are prefixed with the instance
  (`stack/fc_esc_cable`).
- A mate or link is used by the first step that matches it. Leftovers become automatic steps
  (the verifier warns).
- Order steps the way a person builds: structure first, parts that later parts cover early,
  wiring right after the parts it joins are fixed, props last.
- `figure: "wiring"` uses a 3D route figure when every link in the step has geometry on both
  ends (assemble().routes), else pad-to-pad diagrams.
- Notes are for guidance the model cannot express (safety, order); any value in a note goes in
  `{{query|format}}`. Model notes (harness `usage_note`, `operating_conditions.cooling`,
  mounting metadata) are added automatically.

## Cameras

Directions are from the target toward the camera, world Z up. Keep one direction for
consecutive steps; change only when the step's parts are hidden (e.g. a low angle for screws
from below: `[1, -1.3, 0.42]`). Top view: `{ dir: [0,0,1], up: [1,0,0] }` (front up).
