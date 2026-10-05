import { describe, expect, it } from "vitest";
import {
  applyMat4,
  assemble,
  checkGeometryBindings,
  interfaceGeometry,
  mateTransform,
  type GeometryManifest,
} from "../src/index.js";
import type { ModuleDef } from "../src/types/index.js";
import { ARM, DRONE, FC, FRAME, GNSS, GPS_HARDWARE, MOTOR, PROP, lookup, manifestLookup } from "./fixtures/drone.js";

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe("interfaceGeometry", () => {
  it("returns an interface's own frame and refs (the motor face)", () => {
    const g = interfaceGeometry(MOTOR, "base_mount");
    expect(g.sources).toEqual(["base_mount"]);
    expect(g.frames[0].frame.normal).toEqual([0, 0, -1]);
    expect(g.refs.map((r) => r.ref.kind)).toEqual(["feature", "artifact", "feature", "procedural"]);
  });

  it("resolves a parent port without geometry to its children's", () => {
    const g = interfaceGeometry(MOTOR, "phases");
    expect(g.sources.sort()).toEqual(["phases_a", "phases_b", "phases_c"]);
    expect(g.frames).toHaveLength(3);
  });

  it("reports interfaces with no geometry as unmapped, not invented", () => {
    const g = interfaceGeometry(FC, "uart3");
    expect(g.frames).toHaveLength(0);
    expect(g.refs).toHaveLength(0);
  });

  it("gives a connector-borne interface every physical alternative", () => {
    const g = interfaceGeometry(GNSS, "i2c_compass");
    expect(g.refs.map((r) => (r.ref.kind === "feature" ? r.ref.name : ""))).toEqual(["GH6P-1", "GH6P-2"]);
  });
});

describe("mateTransform", () => {
  const pad = FRAME.interfaces.find((i) => i.id === "motor_mount_fl")!.geometry!.frame!;
  const motorFace = MOTOR.interfaces.find((i) => i.id === "base_mount")!.geometry!.frame!;

  it("puts the motor face on the arm pad, bell up", () => {
    const m = mateTransform(pad, motorFace);
    close(applyMat4(m, [0, 0, 0]), pad.origin);
    close(applyMat4(m, [0, 0, 10]), [pad.origin[0], pad.origin[1], pad.origin[2] + 10]);
    // the motor's x-axis lands on the pad's
    close(applyMat4(m, [1, 0, 0]), [pad.origin[0] + Math.SQRT1_2, pad.origin[1] + Math.SQRT1_2, pad.origin[2]]);
  });

  it("applies gap along the placed side's normal and rotation about it", () => {
    const m = mateTransform(pad, motorFace, 90, 2);
    close(applyMat4(m, [0, 0, 0]), [pad.origin[0], pad.origin[1], pad.origin[2] + 2]);
    // the motor's x-axis lands on the pad's x-axis turned 90° about the pad normal
    close(applyMat4(m, [1, 0, 0]), [pad.origin[0] - Math.SQRT1_2, pad.origin[1] + Math.SQRT1_2, pad.origin[2] + 2]);
  });
});

describe("checkGeometryBindings", () => {
  it.each([MOTOR, PROP, GNSS])("$id: every feature ref matches its manifest", (def) => {
    expect(checkGeometryBindings(def, manifestLookup(def)).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("flags a feature whose geometry changed since it was bound", () => {
    const real = manifestLookup(MOTOR);
    const stale = (id: string): GeometryManifest | undefined => {
      const m = real(id);
      return m && { ...m, features: { ...m.features, base_mount: { ...m.features.base_mount, area_mm2: 480 } } };
    };
    const issues = checkGeometryBindings(MOTOR, stale).filter((i) => i.severity === "error");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ interfaceId: "base_mount", severity: "error" });
    expect(issues[0].message).toMatch(/changed since binding/);
  });

  it("says which refs it could not check (no manifest for an artifact)", () => {
    const warnings = checkGeometryBindings(MOTOR, manifestLookup(MOTOR)).filter((i) => i.severity === "warning");
    expect(warnings.map((w) => w.message)).toEqual(['no manifest for artifact "cad_kcl"; binding not checked']);
  });

  it("flags a feature renamed or removed in the CAD", () => {
    const real = manifestLookup(MOTOR);
    const renamed = (id: string): GeometryManifest | undefined => {
      const m = real(id);
      if (!m) return m;
      const { shaft: _gone, ...rest } = m.features;
      return { ...m, features: rest };
    };
    expect(checkGeometryBindings(MOTOR, renamed).filter((i) => i.severity === "error").map((i) => i.interfaceId)).toEqual(["shaft"]);
  });

  it("flags a ref to an artifact the module does not declare", () => {
    const def: ModuleDef = { ...MOTOR, artifacts: MOTOR.artifacts!.filter((a) => a.id !== "cad_step") };
    expect(checkGeometryBindings(def, manifestLookup(MOTOR)).filter((i) => i.severity === "error").map((i) => i.message)).toContain('artifact "cad_step" is not on fixture-motor-2207');
  });
});

describe("assemble", () => {
  const asm = assemble(DRONE, lookup, { root: ["frame"] });
  const at = (key: string) => {
    const p = asm.placements.find((x) => x.key === key);
    return p && applyMat4(p.matrix, [0, 0, 0]);
  };

  it("places every mechanically linked module from the links alone", () => {
    close(at("arm_fl/motor")!, [80, 80, 4]);
    close(at("arm_fl/prop")!, [80, 80, 4 + 20]);
    close(at("stack/esc")!, [0, 0, 4 + 8]);
    close(at("stack/fc")!, [0, 0, 4 + 18]);
    close(at("top_plate")!, [0, 0, 34]);
    close(at("gnss")!, [-50, 0, 34 + 2 + 5]);
    close(at("video")!, [-40, 0, 4 + 3]);
    // a second body of one module, placed by its own frame
    close(at("video#cad_camera_step")!, [50, 0, 15]);
    expect(asm.placements).toHaveLength(15);
  });

  it("flips the GNSS antenna up: its component side faces the plate", () => {
    const p = asm.placements.find((x) => x.key === "gnss")!;
    expect(applyMat4(p.matrix, [0, 0, 1])[2] - at("gnss")![2]).toBeCloseTo(-1, 6);
  });

  it("routes motor phases from the ESC pads to each lead, and lists links without geometry", () => {
    expect(asm.routes.map((r) => r.linkId).sort()).toEqual(["m1_phases", "m2_phases", "m3_phases", "m4_phases"]);
    expect(asm.routes[0].b.frames).toHaveLength(3);
    expect(asm.unrouted.map((u) => u.linkId)).toContain("gnss_i2c");
  });

  it("reports modules no mate reaches instead of guessing", () => {
    expect(asm.issues.filter((i) => i.severity === "info").map((i) => i.subject).sort()).toEqual(["battery", "receiver"]);
  });

  it("places every fastener of every mounting harness, and every nut sits on thread", () => {
    const byHarness = new Map<string, number>();
    for (const h of asm.hardware) byHarness.set(h.harness, (byHarness.get(h.harness) ?? 0) + 1);
    expect(Object.fromEntries(byHarness)).toEqual({
      arm_fr_hardware: 4,
      arm_rr_hardware: 4,
      arm_rl_hardware: 4,
      arm_fl_hardware: 4,
      stack_hardware: 16,
      plate_hardware: 12,
      gps_hardware: 12,
    });
    expect(asm.issues.filter((i) => i.severity !== "info")).toEqual([]);
    // motor screws: heads under the 4 mm arm, on the pad's 16 mm circle
    const head = applyMat4(asm.hardware.find((h) => h.harness === "arm_fl_hardware")!.matrix, [0, 0, 0]);
    expect(head[2]).toBeCloseTo(0, 6);
    expect(Math.hypot(head[0] - 80, head[1] - 80)).toBeCloseTo(8, 6);
  });

  it("flags a screw too short for its nut", () => {
    const short: ModuleDef = { ...GPS_HARDWARE, fastenerStack: [{ child: "nuts", atMm: -2, direction: -1 }, { child: "spacers", atMm: 0 }, { child: "screws", atMm: 8, direction: -1 }] };
    const errors = assemble(DRONE, (id) => (id === short.id ? short : lookup(id)), { root: ["frame"] }).issues.filter((i) => i.severity === "error");
    expect(errors[0]).toMatchObject({ subject: "gps_hardware" });
    expect(errors[0].message).toMatch(/screws ends 0\.8 mm short of the far face of nuts/);
  });

  it("flags a harness that places a different number of parts than it lists", () => {
    const miscounted: ModuleDef = { ...GPS_HARDWARE, children: GPS_HARDWARE.children!.map((c) => (c.id === "spacers" ? { ...c, quantity: 8 } : c)) };
    const warnings = assemble(DRONE, (id) => (id === miscounted.id ? miscounted : lookup(id)), { root: ["frame"] }).issues.filter((i) => i.severity === "warning");
    expect(warnings.map((w) => w.message)).toContain("spacers: the harness lists 8, its fastener stack places 4");
  });

  it("takes a threaded shaft as the screw for a nut on it (a prop nut)", () => {
    const nut: ModuleDef = {
      id: "test-m5-prop-nut",
      name: "M5 prop nut",
      kind: "module",
      tags: ["fastener", "nut"],
      interfaces: [{ id: "thread", domain: "mechanical", exposed: true, protocols: [{ type: "custom", roles: ["peer"] }], parameters: [{ id: "fastener_diameter", unit: "mm", value: 5 }, { id: "length", unit: "mm", value: 5 }] }],
    };
    const propHardware: ModuleDef = {
      id: "test-prop-hardware",
      name: "Prop nut",
      kind: "harness",
      interfaces: [],
      children: [{ id: "nut", moduleDefId: nut.id }],
      // hub 0–6 mm on the shaft, nut on top of it
      fastenerStack: [{ child: "nut", atMm: 6, positions: [[0, 0]] }],
    };
    const arm: ModuleDef = {
      ...ARM,
      children: [...ARM.children!, { id: "prop_hardware", moduleDefId: propHardware.id }],
      links: ARM.links!.map((l) => (l.id === "prop_on_shaft" ? { ...l, harness: "prop_hardware" } : l)),
    };
    const extra = new Map([nut, propHardware, arm].map((d) => [d.id, d]));
    const run = (threaded: boolean) => {
      const motor: ModuleDef = threaded ? MOTOR : { ...MOTOR, interfaces: MOTOR.interfaces.map((i) => (i.id === "shaft" ? { ...i, traits: [] } : i)) };
      return assemble(DRONE, (id) => (id === MOTOR.id ? motor : extra.get(id) ?? lookup(id)), { root: ["frame"] });
    };
    const ok = run(true);
    const placed = ok.hardware.filter((h) => h.child === "nut" && h.harness.endsWith("prop_hardware"));
    expect(placed).toHaveLength(4);
    expect(ok.issues.filter((i) => i.severity === "error")).toEqual([]);
    close(applyMat4(placed.find((h) => h.harness === "arm_fl/prop_hardware")!.matrix, [0, 0, 0]), [80, 80, 4 + 20 + 6]);
    // without a stated thread the shaft is not a screw
    expect(run(false).issues.filter((i) => i.severity === "error").map((i) => i.message)).toContain("nut: no screw passes through it");
  });

  it("points every motor's leads down its arm", () => {
    for (const arm of ["arm_fl", "arm_fr", "arm_rl", "arm_rr"]) {
      const p = asm.placements.find((x) => x.key === `${arm}/motor`)!;
      const c = applyMat4(p.matrix, [0, 0, 0]);
      const lead = applyMat4(p.matrix, [22, 0, 1.5]);
      expect(Math.cos(Math.atan2(lead[1] - c[1], lead[0] - c[0]) - Math.atan2(-c[1], -c[0]))).toBeCloseTo(1, 6);
    }
  });

  it("rejects a rotation outside the bolt pattern's symmetry", () => {
    const rotated: ModuleDef = { ...DRONE, links: DRONE.links!.map((l) => (l.id === "arm_fl_mount" ? { ...l, mate: { rotationDeg: 45 } } : l)) };
    const issues = assemble(rotated, lookup, { root: ["frame"] }).issues.filter((i) => i.severity === "error");
    expect(issues).toHaveLength(2);
    expect(issues[0].message).toMatch(/not a multiple of .* 90° symmetry/);
  });

  it("detects an over-constrained mate", () => {
    const shifted: ModuleDef = {
      ...DRONE,
      links: DRONE.links!.concat({ id: "fc_again", a: { child: "stack", interfaceId: "fc_stack_mount" }, b: { child: "frame", interfaceId: "stack_mount" }, mate: { gapMm: 16 } }),
    };
    const issues = assemble(shifted, lookup, { root: ["frame"] }).issues.filter((i) => i.severity === "error");
    expect(issues.map((i) => i.subject)).toEqual(["fc_again"]);
    expect(issues[0].message).toMatch(/over-constrained: .* 2\.0 mm/);
  });
});
