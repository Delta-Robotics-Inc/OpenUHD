import { readFileSync } from "fs";
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
import { manifestLookup } from "../library/cad/manifests.js";
import { QUADCOPTER_5IN_FRAME, SYSTEM, lookup } from "../library/systems/quadcopter-5in/index.js";

const part = (id: string) => lookup(id)!;
const MOTOR = "meps-neon-2207-v2-1950kv";
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe("interfaceGeometry", () => {
  it("returns an interface's own frame and refs (the motor face)", () => {
    const g = interfaceGeometry(part(MOTOR), "base_mount");
    expect(g.sources).toEqual(["base_mount"]);
    expect(g.frames[0].frame.normal).toEqual([0, 0, -1]);
    expect(g.refs.map((r) => r.ref.kind)).toEqual(["feature", "artifact", "feature", "artifact", "procedural"]);
  });

  it("resolves a parent port without geometry to its children's", () => {
    const g = interfaceGeometry(part(MOTOR), "phases");
    expect(g.sources.sort()).toEqual(["phases_a", "phases_b", "phases_c"]);
    expect(g.frames).toHaveLength(3);
  });

  it("reports interfaces with no geometry as unmapped, not invented", () => {
    const g = interfaceGeometry(part("dolphinrc-f405-v3-flight-controller"), "uart1");
    expect(g.frames).toHaveLength(0);
    expect(g.refs).toHaveLength(0);
  });

  it("gives a connector-borne interface every physical alternative", () => {
    const g = interfaceGeometry(part("matek-m9n-5883"), "i2c_compass");
    expect(g.refs.map((r) => (r.ref.kind === "feature" ? r.ref.name : ""))).toEqual(["GH6P-1", "GH6P-2"]);
  });
});

describe("mateTransform", () => {
  const frameFl = QUADCOPTER_5IN_FRAME.interfaces.find((i) => i.id === "motor_mount_fl")!.geometry!.frame!;
  const motorFace = part(MOTOR).interfaces.find((i) => i.id === "base_mount")!.geometry!.frame!;

  it("puts the motor face on the arm pad, bell up", () => {
    const m = mateTransform(frameFl, motorFace);
    close(applyMat4(m, [0, 0, 0]), frameFl.origin);
    close(applyMat4(m, [0, 0, 10]), [frameFl.origin[0], frameFl.origin[1], frameFl.origin[2] + 10]);
  });

  it("applies gap along the placed side's normal and rotation about it", () => {
    const m = mateTransform(frameFl, motorFace, 90, 2);
    close(applyMat4(m, [0, 0, 0]), [frameFl.origin[0], frameFl.origin[1], frameFl.origin[2] + 2]);
    const x = applyMat4(m, [1, 0, 0]);
    close([x[0] - frameFl.origin[0], x[1] - frameFl.origin[1]], [0, 1]);
  });
});

describe("checkGeometryBindings", () => {
  const withGeometry = [
    MOTOR,
    "hqprop-ethix-s5",
    "dolphinrc-am32-60a-4in1-esc",
    "dolphinrc-f405-v3-flight-controller",
    "dji-o4-air-unit",
    "quadcopter-5in-frame",
    "iso-4762-m3x30-socket-head-cap-screw",
    "iso-10511-m3-nyloc-nut",
    "ettinger-005-83-060-m3-nylon-spacer-6mm",
    "matek-m9n-5883",
  ];

  it.each(withGeometry)("%s: every feature ref matches its generator manifest", (id) => {
    const def = part(id);
    const issues = checkGeometryBindings(def, manifestLookup(def)).filter((i) => i.severity === "error");
    // KCL features are resolved by running the KCL (no manifest until exported)
    expect(issues).toEqual([]);
  });

  it("flags a feature whose geometry changed since it was bound", () => {
    const def = part(MOTOR);
    const real = manifestLookup(def);
    const stale = (id: string): GeometryManifest | undefined => {
      const m = real(id);
      if (!m) return m;
      return { ...m, features: { ...m.features, base_mount: { ...m.features.base_mount, area_mm2: 480 } } };
    };
    const issues = checkGeometryBindings(def, stale).filter((i) => i.severity === "error");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ interfaceId: "base_mount", severity: "error" });
    expect(issues[0].message).toMatch(/changed since binding/);
  });

  it("says which refs it could not check (KCL tags resolve only by running the KCL)", () => {
    const def = part(MOTOR);
    const warnings = checkGeometryBindings(def, manifestLookup(def)).filter((i) => i.severity === "warning");
    expect(warnings.map((w) => w.message)).toEqual(['no manifest for artifact "cad_kcl"; binding not checked']);
  });

  it("flags a feature renamed or removed in the CAD", () => {
    const def = part(MOTOR);
    const real = manifestLookup(def);
    const renamed = (id: string): GeometryManifest | undefined => {
      const m = real(id);
      if (!m) return m;
      const { shaft: _gone, ...rest } = m.features;
      return { ...m, features: rest };
    };
    const errors = checkGeometryBindings(def, renamed).filter((i) => i.severity === "error");
    expect(errors.map((i) => i.interfaceId)).toEqual(["shaft"]);
  });
});

describe("frame geometry follows the generator", () => {
  it("UHD frames equal the frames the build123d generator placed the features at", () => {
    const generated = JSON.parse(
      readFileSync(new URL("../library/systems/quadcopter-5in/artifacts/cad/quadcopter-5in-frame.frames.json", import.meta.url), "utf8"),
    ) as Record<string, { origin: number[]; normal: number[] }>;
    for (const iface of QUADCOPTER_5IN_FRAME.interfaces) {
      const f = iface.geometry?.frame;
      expect(f, iface.id).toBeDefined();
      close(f!.origin, generated[iface.id].origin);
      close(f!.normal, generated[iface.id].normal);
    }
  });
});

describe("assemble", () => {
  const asm = assemble(SYSTEM, lookup, { root: ["frame"] });
  const at = (key: string) => {
    const p = asm.placements.find((x) => x.key === key);
    return p && applyMat4(p.matrix, [0, 0, 0]);
  };

  it("places every mechanically linked module from the links alone", () => {
    close(at("arm_fl/motor")!, [79.55, 79.55, 5.5]);
    close(at("arm_fl/prop")!, [79.55, 79.55, 5.5 + 19.3]);
    close(at("stack/esc")!, [0, 0, 11]);
    close(at("stack/fc")!, [0, 0, 5 + 13.6]);
    close(at("gnss")!, [-52, 0, 42]);
    close(at("video#cad_camera_step")!, [50, 0, 15]);
    expect(asm.placements).toHaveLength(14);
  });

  it("flips the GNSS antenna up: its component side faces the frame", () => {
    const p = asm.placements.find((x) => x.key === "gnss")!;
    const up = applyMat4(p.matrix, [0, 0, 1]);
    expect(up[2] - at("gnss")![2]).toBeCloseTo(-1, 6);
  });

  it("routes motor phases from the ESC pads to each lead, and lists links without geometry", () => {
    expect(asm.routes.map((r) => r.linkId).sort()).toEqual(["m1_phases", "m2_phases", "m3_phases", "m4_phases"]);
    expect(asm.routes[0].b.frames).toHaveLength(3);
    expect(asm.unrouted.map((u) => u.linkId)).toContain("gnss_i2c");
  });

  it("reports modules no mate reaches instead of guessing", () => {
    expect(asm.issues.filter((i) => i.severity === "info").map((i) => i.subject).sort()).toEqual(["battery", "bulk_cap", "receiver", "strap"]);
  });

  it("rejects a rotation outside the bolt pattern's symmetry", () => {
    const rotated: ModuleDef = {
      ...SYSTEM,
      links: SYSTEM.links!.map((l) => (l.id === "arm_fl_mount" ? { ...l, mate: { rotationDeg: 45 } } : l)),
    };
    const issues = assemble(rotated, lookup, { root: ["frame"] }).issues.filter((i) => i.severity === "error");
    expect(issues).toHaveLength(2);
    expect(issues[0].message).toMatch(/not a multiple of .* 90° symmetry/);
  });

  it("detects an over-constrained mate", () => {
    const shifted: ModuleDef = {
      ...SYSTEM,
      links: SYSTEM.links!.concat({
        id: "fc_again",
        a: { child: "stack", interfaceId: "fc_stack_mount" },
        b: { child: "frame", interfaceId: "stack_mount" },
        mate: { gapMm: 11.6 },
      }),
    };
    const issues = assemble(shifted, lookup, { root: ["frame"] }).issues.filter((i) => i.severity === "error");
    expect(issues.map((i) => i.subject)).toEqual(["fc_again"]);
    expect(issues[0].message).toMatch(/over-constrained: .* 2\.0 mm/);
  });
});
