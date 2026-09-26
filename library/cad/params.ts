/**
 * UHD → CAD parameters (PB-775).
 *
 *   npx tsx library/cad/params.ts
 *
 * Reads the quadcopter's part and interface definitions and writes the
 * dimensions every CAD generator needs, so geometry follows the model:
 *   library/cad/params.json   — build123d generators (library/cad/py)
 *   library/cad/kcl/params.kcl — KCL sources (library/cad/kcl)
 *
 * Values not stated by any part are marked `design` with a reason; they are
 * design choices for the custom frame, not facts about purchased parts.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { InterfaceDef, ModuleDef } from "../../src/types/index.js";
import { lookup } from "../systems/quadcopter-5in/index.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));

function part(id: string): ModuleDef {
  const def = lookup(id);
  if (!def) throw new Error(`unknown part ${id}`);
  return def;
}
function iface(def: ModuleDef, id: string): InterfaceDef {
  const i = def.interfaces.find((x) => x.id === id);
  if (!i) throw new Error(`${def.id} has no interface ${id}`);
  return i;
}
function p(i: InterfaceDef, id: string): number {
  const v = i.parameters?.find((x) => x.id === id);
  const n = v?.value ?? v?.range?.[0];
  if (n === undefined) throw new Error(`${i.id} has no parameter ${id}`);
  return n;
}
function mech(def: ModuleDef): Record<string, unknown> {
  return ((def.domains ?? []).find((d) => d.domain === "mechanical")?.metadata ?? {}) as Record<string, unknown>;
}
function dims(def: ModuleDef): { length: number; width: number; height: number } {
  const d = (def.domains ?? []).find((x) => x.domain === "mechanical")?.dimensions_mm;
  if (!d) throw new Error(`${def.id} has no dimensions`);
  return d as { length: number; width: number; height: number };
}

const motor = part("meps-neon-2207-v2-1950kv");
const prop = part("hqprop-ethix-s5");
const frame = part("quadcopter-5in-frame");
const esc = part("dolphinrc-am32-60a-4in1-esc");
const fc = part("dolphinrc-f405-v3-flight-controller");
const gnss = part("matek-m9n-5883");
const o4 = part("dji-o4-air-unit");
const battery = part("cnhl-black-series-1100mah-6s-100c");
const screw = part("iso-4762-m3x30-socket-head-cap-screw");
const nut = part("iso-10511-m3-nyloc-nut");
const spacer = part("ettinger-005-83-060-m3-nylon-spacer-6mm");

const mm = mech(motor);
const pm = mech(prop);
const o4m = mech(o4) as { transmission_module_mm: { length: number; width: number; height: number; hole_spacing: number; hole_diameter: number }; camera_module_mm: { length: number; width: number; height: number } };

const propDiameter = Number(pm.prop_diameter_in) * 25.4;
const wheelbase = 225; // design: diagonal motor-to-motor distance
const motorSide = wheelbase / Math.SQRT2;

const params = {
  source: "UHD library (library/parts, library/systems/quadcopter-5in) via library/cad/params.ts",
  motor: {
    diameter: Number(mm.diameter_mm),
    body_height: Number(mm.body_height_mm),
    overall_height: Number(mm.overall_height_mm),
    shaft_diameter: p(iface(motor, "shaft"), "shaft_diameter"),
    shaft_thread_length: Number(mm.shaft_thread_dimension_mm),
    base_bolt_circle: p(iface(motor, "base_mount"), "hole_spacing"),
    base_holes: p(iface(motor, "base_mount"), "hole_count"),
    base_fastener: p(iface(motor, "base_mount"), "fastener_diameter"),
  },
  prop: {
    diameter: propDiameter,
    hub_diameter: Number(pm.hub_diameter_mm),
    hub_thickness: Number(pm.hub_thickness_mm),
    bore: p(iface(prop, "hub_bore"), "shaft_diameter"),
    blades: Number(pm.blade_count),
  },
  frame: {
    wheelbase,
    plate_thickness: 5, // design: matches the fastener stack-up assumption (iso-4762 usage note)
    arm_width: 14, // design
    motor_bolt_circle: p(iface(frame, "motor_mount_fl"), "hole_spacing"),
    motor_fastener: p(iface(frame, "motor_mount_fl"), "fastener_diameter"),
    stack_spacing: p(iface(frame, "stack_mount"), "hole_spacing"),
    stack_fastener: p(iface(frame, "stack_mount"), "fastener_diameter"),
    gps_spacing: p(iface(frame, "gps_mount"), "hole_spacing"),
    gps_fastener: p(iface(frame, "gps_mount"), "fastener_diameter"),
    vtx_spacing: p(iface(frame, "vtx_mount"), "hole_spacing"),
    vtx_fastener: p(iface(frame, "vtx_mount"), "fastener_diameter"),
    camera_spacing: p(iface(frame, "camera_mount"), "hole_spacing"),
    camera_width: p(iface(frame, "camera_mount"), "hole_spacing_y"),
    camera_fastener: p(iface(frame, "camera_mount"), "fastener_diameter"),
    prop_clearance: motorSide - propDiameter,
  },
  esc: { ...dims(esc), hole_spacing: p(iface(esc, "stack_mount"), "hole_spacing"), hole_diameter: 4 },
  fc: { ...dims(fc), hole_spacing: p(iface(fc, "stack_mount"), "hole_spacing"), hole_diameter: 4 },
  gnss: { ...dims(gnss), hole_spacing: p(iface(gnss, "mount"), "hole_spacing") },
  o4: { module: o4m.transmission_module_mm, camera: o4m.camera_module_mm },
  battery: dims(battery),
  fasteners: {
    screw_length: p(iface(screw, screw.interfaces[0].id), "length"),
    screw_diameter: p(iface(screw, screw.interfaces[0].id), "fastener_diameter"),
    nut_height: 4,
    nut_across_flats: 5.5,
    spacer_length: p(iface(spacer, spacer.interfaces[0].id), "length"),
    spacer_od: 6,
    spacer_id: 3.4,
  },
};

if (params.frame.prop_clearance < 5) {
  throw new Error(`wheelbase ${wheelbase} mm leaves ${params.frame.prop_clearance.toFixed(1)} mm prop clearance (< 5 mm)`);
}

writeFileSync(join(HERE, "params.json"), JSON.stringify(params, null, 2) + "\n");

// KCL constants (flat lowerCamelCase names, mm): motor.base_bolt_circle -> motorBaseBoltCircle
const camel = (...parts: string[]) =>
  parts
    .join("_")
    .split("_")
    .map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w))
    .join("");
const kcl: string[] = [
  "// Generated from UHD by library/cad/params.ts. Do not edit by hand.",
  "@settings(defaultLengthUnit = mm)",
  "",
];
for (const [group, values] of Object.entries(params)) {
  if (typeof values !== "object") continue;
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    if (typeof v === "number") kcl.push(`export ${camel(group, k)} = ${Number(v.toFixed(4))}`);
  }
}
writeFileSync(join(HERE, "kcl", "params.kcl"), kcl.join("\n") + "\n");
console.log(`params.json + kcl/params.kcl written (prop clearance ${params.frame.prop_clearance.toFixed(1)} mm)`);
