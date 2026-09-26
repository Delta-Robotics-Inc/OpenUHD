/**
 * CAD checks for a library part (PB-796), shared by scripts/verify-part.ts
 * and the tests:
 *
 *   - the part has a CAD body (vendor or generated);
 *   - every feature/artifact ref resolves against its manifest with an
 *     unchanged signature (checkGeometryBindings);
 *   - every bolt pattern and shaft has a mating frame, with a unit normal
 *     and an x-axis perpendicular to it;
 *   - frames are plausible against the CAD: the bolt pattern's holes (from
 *     its UHD parameters, placed by the frame) land on hole axes the
 *     manifest recorded, and a shaft frame sits on the shaft axis.
 */
import type { InterfaceDef, ModuleDef, Vec3 } from "../../src/types/index.js";
import {
  applyMat4,
  boltPatternHoles,
  checkGeometryBindings,
  frameMatrix,
  type GeometryManifest,
} from "../../src/system/geometry.js";

export interface CadIssue {
  interfaceId?: string;
  severity: "error" | "warning";
  message: string;
}

/** Manifest feature with the hole/shaft axes vendor_step.py and partkit.py record. */
interface AxisFeature {
  centres?: Vec3[];
  diameter_mm?: number | null;
}

const hasType = (i: InterfaceDef, t: string) => i.protocols.some((p) => p.type === t);
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: Vec3) => Math.hypot(...a);

/** Distance between two points ignoring the component along `n` (unit). */
function inPlane(a: Vec3, b: Vec3, n: Vec3): number {
  const d = sub(a, b);
  const along = dot(d, n);
  return norm([d[0] - along * n[0], d[1] - along * n[1], d[2] - along * n[2]]);
}

function axisFeatures(iface: InterfaceDef, manifestFor: (id: string) => GeometryManifest | undefined): AxisFeature[] {
  const out: AxisFeature[] = [];
  for (const ref of iface.geometry?.refs ?? []) {
    if (ref.kind !== "feature") continue;
    const f = manifestFor(ref.artifact)?.features[ref.name] as AxisFeature | undefined;
    if (f?.centres?.length) out.push(f);
  }
  return out;
}

export function checkCad(
  def: ModuleDef,
  manifestFor: (artifactId: string) => GeometryManifest | undefined,
  tolMm = 0.5,
): CadIssue[] {
  const issues: CadIssue[] = [];
  const bodies = (def.artifacts ?? []).filter((a) => a.role === "body");
  if (!bodies.length) {
    issues.push({ severity: "error", message: "no CAD body artifact: bind manufacturer CAD (vendor_step.py) or generate representative geometry (partkit.py)" });
  }
  issues.push(...checkGeometryBindings(def, manifestFor));

  for (const iface of def.interfaces) {
    const mechanical = hasType(iface, "bolt_pattern") || hasType(iface, "shaft");
    const frame = iface.geometry?.frame;
    if (!frame) {
      if (mechanical) issues.push({ interfaceId: iface.id, severity: "error", message: "bolt pattern / shaft has no mating frame" });
      continue;
    }
    const n = frame.normal;
    if (Math.abs(norm(n) - 1) > 1e-3) issues.push({ interfaceId: iface.id, severity: "error", message: "frame normal is not a unit vector" });
    if (frame.xAxis && Math.abs(dot(frame.xAxis, n)) > 1e-3) {
      issues.push({ interfaceId: iface.id, severity: "error", message: "frame xAxis is not perpendicular to the normal" });
    }
    const feats = axisFeatures(iface, manifestFor);
    if (!feats.length) continue;
    const centres = feats.flatMap((f) => f.centres ?? []);

    if (hasType(iface, "bolt_pattern")) {
      const m = frameMatrix(frame);
      const expected = boltPatternHoles(iface).map(([x, y]) => applyMat4(m, [x, y, 0]));
      for (const [k, p] of expected.entries()) {
        const best = Math.min(...centres.map((c) => inPlane(p, c, n)));
        if (best > tolMm) {
          issues.push({
            interfaceId: iface.id,
            severity: "error",
            message: `hole ${k + 1} of the bolt pattern (frame + parameters) is ${best.toFixed(2)} mm from the nearest CAD hole axis`,
          });
        }
      }
      const d = iface.parameters?.find((p) => p.id === "fastener_diameter")?.value;
      const hole = feats[0].diameter_mm;
      if (d !== undefined && hole && hole < d - 0.05 && !iface.traits?.some((t) => t.type === "bolt_pattern" && t.params?.threaded)) {
        issues.push({ interfaceId: iface.id, severity: "warning", message: `CAD hole Φ${hole} mm is smaller than the fastener Φ${d} mm (threaded?)` });
      }
    } else if (hasType(iface, "shaft")) {
      const best = Math.min(...centres.map((c) => inPlane(frame.origin, c, n)));
      if (best > tolMm) {
        issues.push({ interfaceId: iface.id, severity: "error", message: `shaft frame origin is ${best.toFixed(2)} mm off the CAD shaft axis` });
      }
      const d = iface.parameters?.find((p) => p.id === "shaft_diameter")?.value;
      const cad = feats[0].diameter_mm;
      if (d !== undefined && cad && Math.abs(cad - d) > 0.2) {
        issues.push({ interfaceId: iface.id, severity: "warning", message: `CAD shaft Φ${cad} mm differs from shaft_diameter ${d} mm` });
      }
    }
  }
  return issues;
}
