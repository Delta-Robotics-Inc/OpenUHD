/**
 * Geometry resolution for interfaces and assemblies (PB-775).
 *
 * - interfaceGeometry: an interface's own geometry, or — for a parent
 *   interface without its own (I2C, a 3-phase port) — the geometry of the
 *   child leaves its profile binds, deduplicated, with unmapped children
 *   reported rather than invented.
 * - mateTransform: the rigid transform that places module B so its
 *   interface frame meets module A's frame (origins coincide, normals
 *   oppose, x-axes aligned).
 * - checkGeometryBindings: compares feature/artifact refs with the
 *   manifests the CAD generators write, reporting missing or stale refs.
 */
import type { InterfaceDef } from "../types/interface.js";
import type { EndpointTarget, InterfaceLink as Link, ModuleDef } from "../types/module.js";
import { resolveExports, type ModuleLookup } from "./index.js";
import type { GeometryFrame, GeometryRef, GeometrySignature, Vec3 } from "../types/geometry.js";

export interface ResolvedInterfaceGeometry {
  /** Interface ids whose geometry is used (the interface itself, or its children). */
  sources: string[];
  frames: { interfaceId: string; frame: GeometryFrame }[];
  refs: { interfaceId: string; ref: GeometryRef }[];
  /** Children that exist but have no geometry. */
  unmapped: string[];
  /** The interface is declared logical (no physical representation). */
  logical: boolean;
}

const hasGeometry = (i: InterfaceDef) => Boolean(i.geometry?.frame || i.geometry?.refs?.length);

export function interfaceGeometry(def: ModuleDef, interfaceId: string): ResolvedInterfaceGeometry {
  const byId = new Map(def.interfaces.map((i) => [i.id, i]));
  const root = byId.get(interfaceId);
  const empty: ResolvedInterfaceGeometry = { sources: [], frames: [], refs: [], unmapped: [], logical: false };
  if (!root) return empty;
  if (root.geometry?.logical) return { ...empty, logical: true };

  const out: ResolvedInterfaceGeometry = { ...empty };
  const seen = new Set<string>();
  const visit = (iface: InterfaceDef, depth: number) => {
    if (seen.has(iface.id) || depth > 8) return;
    seen.add(iface.id);
    if (hasGeometry(iface)) {
      out.sources.push(iface.id);
      if (iface.geometry?.frame) out.frames.push({ interfaceId: iface.id, frame: iface.geometry.frame });
      for (const ref of iface.geometry?.refs ?? []) out.refs.push({ interfaceId: iface.id, ref });
      if (iface !== root) return; // a child with its own geometry stands for itself
    }
    const bound = new Set<string>();
    for (const profile of iface.profiles ?? []) {
      for (const v of Object.values(profile.bindings)) for (const id of Array.isArray(v) ? v : [v]) bound.add(id);
    }
    if (iface === root && hasGeometry(root)) return;
    if (iface !== root && !bound.size) {
      out.unmapped.push(iface.id);
      return;
    }
    for (const id of bound) {
      const child = byId.get(id);
      if (child && child !== iface) visit(child, depth + 1);
    }
  };
  visit(root, 0);
  if (!hasGeometry(root) && !root.profiles?.length) out.unmapped.push(root.id);
  return out;
}

// ---------------------------------------------------------------------------
// Frames and mating
// ---------------------------------------------------------------------------

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];

/** Orthonormal basis [x, y, z] of a frame, z = normal. */
function basis(frame: GeometryFrame): [Vec3, Vec3, Vec3] {
  const z = norm(frame.normal);
  let x = frame.xAxis ? norm(frame.xAxis) : Math.abs(z[0]) < 0.9 ? ([1, 0, 0] as Vec3) : ([0, 1, 0] as Vec3);
  x = norm(sub(x, scale(z, dot(x, z))));
  const y = cross(z, x);
  return [x, y, z];
}

/** Row-major 4x4 homogeneous transform. */
export type Mat4 = number[];

/**
 * Transform that places module B (in its own coordinates) into module A's
 * coordinates so that B's frame meets A's frame: origins coincide, B's
 * normal opposes A's, and B's x-axis aligns with A's (rotated by
 * `rotationDeg` about the shared normal, for symmetric patterns).
 */
export function mateTransform(a: GeometryFrame, b: GeometryFrame, rotationDeg = 0, gapMm = 0): Mat4 {
  if (gapMm) a = { ...a, origin: [a.origin[0] + norm(a.normal)[0] * gapMm, a.origin[1] + norm(a.normal)[1] * gapMm, a.origin[2] + norm(a.normal)[2] * gapMm] };
  const [ax, ay, az] = basis(a);
  // target basis for B: z opposite A's normal, x = A's x rotated about A's normal
  const t = (rotationDeg * Math.PI) / 180;
  const tx = norm([ax[0] * Math.cos(t) + ay[0] * Math.sin(t), ax[1] * Math.cos(t) + ay[1] * Math.sin(t), ax[2] * Math.cos(t) + ay[2] * Math.sin(t)]);
  const tz = scale(az, -1);
  const ty = cross(tz, tx);
  const [bx, by, bz] = basis(b);
  // R maps B's basis onto the target basis: R = T · Bᵀ
  const T = [tx, ty, tz];
  const B = [bx, by, bz];
  const R: number[][] = [0, 1, 2].map((i) => [0, 1, 2].map((j) => T[0][i] * B[0][j] + T[1][i] * B[1][j] + T[2][i] * B[2][j]));
  const rb: Vec3 = [
    R[0][0] * b.origin[0] + R[0][1] * b.origin[1] + R[0][2] * b.origin[2],
    R[1][0] * b.origin[0] + R[1][1] * b.origin[1] + R[1][2] * b.origin[2],
    R[2][0] * b.origin[0] + R[2][1] * b.origin[1] + R[2][2] * b.origin[2],
  ];
  const tr = sub(a.origin, rb);
  return [R[0][0], R[0][1], R[0][2], tr[0], R[1][0], R[1][1], R[1][2], tr[1], R[2][0], R[2][1], R[2][2], tr[2], 0, 0, 0, 1];
}

export function applyMat4(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
    m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
    m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
  ];
}

export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) out[r * 4 + c] += a[r * 4 + k] * b[k * 4 + c];
  return out;
}

export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// ---------------------------------------------------------------------------
// Binding checks against generator manifests
// ---------------------------------------------------------------------------

/** What a CAD generator writes next to each artifact (<artifact>.manifest.json). */
export interface GeometryManifest {
  artifact: string;
  tool?: string;
  toolVersion?: string;
  sourceDigest?: string;
  units: "mm";
  features: Record<string, GeometrySignature & { faces?: number }>;
}

export interface GeometryBindingIssue {
  interfaceId: string;
  severity: "error" | "warning";
  message: string;
}

function close(a: GeometrySignature, b: GeometrySignature): boolean {
  const tol = a.tolerance ?? 0.01;
  const areaOk = Math.abs(a.area_mm2 - b.area_mm2) <= tol * Math.max(a.area_mm2, b.area_mm2, 1);
  const centroidOk = Math.hypot(...sub(a.centroid, b.centroid)) <= Math.max(0.05, tol * 10);
  return areaOk && centroidOk;
}

function describeChange(was: GeometrySignature, now: GeometrySignature): string {
  const parts: string[] = [];
  if (Math.abs(was.area_mm2 - now.area_mm2) > 0.005) parts.push(`area ${was.area_mm2.toFixed(1)} → ${now.area_mm2.toFixed(1)} mm²`);
  const moved = Math.hypot(...sub(was.centroid, now.centroid));
  if (moved > 0.005) parts.push(`centroid moved ${moved.toFixed(1)} mm`);
  return parts.join(", ");
}

/**
 * Check every feature/artifact ref on a module against the manifests of its
 * artifacts: the artifact must exist on the module, the named feature must
 * exist in the manifest, and a stored signature must still match.
 */
export function checkGeometryBindings(
  def: ModuleDef,
  manifestFor: (artifactId: string) => GeometryManifest | undefined,
): GeometryBindingIssue[] {
  const issues: GeometryBindingIssue[] = [];
  const artifacts = new Map((def.artifacts ?? []).map((a) => [a.id, a]));
  for (const iface of def.interfaces) {
    for (const ref of iface.geometry?.refs ?? []) {
      if (ref.kind === "procedural") continue;
      if (!artifacts.has(ref.artifact)) {
        issues.push({ interfaceId: iface.id, severity: "error", message: `artifact "${ref.artifact}" is not on ${def.id}` });
        continue;
      }
      // a whole-artifact ref is its own geometry: only checked when it carries a signature
      if (ref.kind === "artifact" && !ref.signature) continue;
      const manifest = manifestFor(ref.artifact);
      if (!manifest) {
        issues.push({ interfaceId: iface.id, severity: "warning", message: `no manifest for artifact "${ref.artifact}"; binding not checked` });
        continue;
      }
      const key = ref.kind === "feature" ? ref.name : "*";
      const found = manifest.features[key];
      if (!found) {
        issues.push({ interfaceId: iface.id, severity: "error", message: `"${key}" not found in ${ref.artifact} (renamed or removed in the CAD?)` });
        continue;
      }
      if (ref.signature && !close(ref.signature, found)) {
        issues.push({
          interfaceId: iface.id,
          severity: "error",
          message: `"${key}" in ${ref.artifact} changed since binding (${describeChange(ref.signature, found)}); re-bind explicitly`,
        });
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Assembly from links
// ---------------------------------------------------------------------------


/** A leaf module instance: its path of child ids from the root, e.g. ["arm_fl", "motor"]. */
export interface GeometryInstance {
  path: string[];
  def: ModuleDef;
  kind: "module" | "harness";
}

export interface ResolvedLeafEndpoint {
  path: string[];
  def: ModuleDef;
  iface: InterfaceDef;
}

/** Follow an endpoint through exports down to the leaf instance that owns the interface. */
export function resolveLeafEndpoint(
  def: ModuleDef,
  end: EndpointTarget,
  lookup: ModuleLookup,
  prefix: string[] = [],
): ResolvedLeafEndpoint | undefined {
  let path = [...prefix];
  let owner = def;
  if ("child" in end) {
    const ref = def.children?.find((c) => c.id === end.child);
    const child = ref && lookup(ref.moduleDefId);
    if (!child) return undefined;
    path.push(end.child);
    owner = child;
  }
  let interfaceId = end.interfaceId;
  for (let depth = 0; depth < 16; depth++) {
    const own = owner.interfaces.find((i) => i.id === interfaceId);
    if (own) return { path, def: owner, iface: own };
    const ex = resolveExports(owner, lookup).find((e) => e.id === interfaceId);
    if (!ex) return undefined;
    path = [...path, ex.from.child];
    owner = ex.childDef;
    interfaceId = ex.from.interfaceId;
  }
  return undefined;
}

export interface MateEdge {
  /** Link id, prefixed with the path of the module that declares it. */
  linkId: string;
  harness?: string;
  a: ResolvedLeafEndpoint & { frame: GeometryFrame };
  b: ResolvedLeafEndpoint & { frame: GeometryFrame };
  mate?: Link["mate"];
}

/** Instance key: path, plus the body artifact for multi-body modules ("video#cad_camera_step"). */
export const bodyKey = (path: string[], artifact?: string) => path.join("/") + (artifact ? `#${artifact}` : "");

export interface Placement {
  key: string;
  path: string[];
  /** Body artifact the placement applies to (undefined = the module's main body). */
  body?: string;
  matrix: Mat4;
  /** Link that placed it (undefined for the root and fixed placements). */
  via?: string;
}

export interface AssemblyIssue {
  severity: "error" | "warning" | "info";
  subject: string;
  message: string;
}

/** A non-mechanical link with geometry on both ends: a viewer draws it as a wire or cable. */
export interface RouteEdge {
  linkId: string;
  harness?: string;
  /** Frames per end: the interface's own, or its children's (a parent port resolves to its pins). */
  a: ResolvedLeafEndpoint & { frames: { interfaceId: string; frame: GeometryFrame }[] };
  b: ResolvedLeafEndpoint & { frames: { interfaceId: string; frame: GeometryFrame }[] };
}

export interface Assembly {
  instances: GeometryInstance[];
  placements: Placement[];
  /** Rigid mates: links between mechanical interfaces that both have frames. */
  mates: MateEdge[];
  routes: RouteEdge[];
  /** Non-mechanical links where at least one end has no geometry (not drawable yet). */
  unrouted: { linkId: string; missing: string[] }[];
  issues: AssemblyIssue[];
}

/** Every leaf instance and every link (with its declaring module's path) below `def`. */
function flatten(def: ModuleDef, lookup: ModuleLookup) {
  const instances: GeometryInstance[] = [];
  const links: { owner: ModuleDef; prefix: string[]; link: Link }[] = [];
  const walk = (d: ModuleDef, prefix: string[]) => {
    for (const link of d.links ?? []) links.push({ owner: d, prefix, link });
    for (const ref of d.children ?? []) {
      const child = lookup(ref.moduleDefId);
      if (!child) continue;
      const path = [...prefix, ref.id];
      if (child.kind === "harness") instances.push({ path, def: child, kind: "harness" });
      else if (child.children?.length) walk(child, path);
      else instances.push({ path, def: child, kind: "module" });
    }
  };
  walk(def, []);
  return { instances, links };
}

/**
 * Place every module reachable from `root` through rigid mates.
 *
 * Mechanical links whose interfaces both carry frames are mates: the unplaced
 * side is transformed so its frame meets the placed side's (mateTransform,
 * with the link's gap and rotation). Electrical and other links never move
 * anything; when both ends have geometry (own or their children's) they are
 * routes a viewer draws as wires, otherwise they are listed as unrouted. Modules that no mate
 * reaches are reported, not guessed; `fixed` can place them explicitly.
 */
export function assemble(
  def: ModuleDef,
  lookup: ModuleLookup,
  options: { root: string[]; fixed?: Record<string, Mat4> } = { root: [] },
): Assembly {
  const { instances, links } = flatten(def, lookup);
  const issues: AssemblyIssue[] = [];
  const mates: MateEdge[] = [];
  const routes: RouteEdge[] = [];
  const unrouted: Assembly["unrouted"] = [];

  for (const { owner, prefix, link } of links) {
    const a = resolveLeafEndpoint(owner, link.a, lookup, prefix);
    const b = resolveLeafEndpoint(owner, link.b, lookup, prefix);
    if (!a || !b) continue;
    const fa = a.iface.geometry?.frame;
    const fb = b.iface.geometry?.frame;
    const linkId = [...prefix, link.id].join("/");
    const mechanical = a.iface.domain === "mechanical" || b.iface.domain === "mechanical";
    if (!mechanical) {
      const ga = interfaceGeometry(a.def, a.iface.id).frames;
      const gb = interfaceGeometry(b.def, b.iface.id).frames;
      if (ga.length && gb.length) routes.push({ linkId, harness: link.harness, a: { ...a, frames: ga }, b: { ...b, frames: gb } });
      else {
        const missing = [!ga.length && `${a.path.join("/")}.${a.iface.id}`, !gb.length && `${b.path.join("/")}.${b.iface.id}`].filter(Boolean) as string[];
        unrouted.push({ linkId, missing });
      }
      continue;
    }
    if (!fa || !fb) {
      {
        const missing = [!fa && `${a.path.join("/")}.${a.iface.id}`, !fb && `${b.path.join("/")}.${b.iface.id}`].filter(Boolean);
        issues.push({ severity: "warning", subject: linkId, message: `mechanical link has no frame on ${missing.join(" and ")}; it cannot place anything` });
      }
      continue;
    }
    mates.push({ linkId, harness: link.harness, a: { ...a, frame: fa }, b: { ...b, frame: fb }, mate: link.mate });

    const rot = link.mate?.rotationDeg ?? 0;
    for (const [end, f] of [[a, fa], [b, fb]] as const) {
      if (rot && f.symmetryDeg && rot % f.symmetryDeg !== 0) {
        issues.push({
          severity: "error",
          subject: linkId,
          message: `rotation ${rot}° is not a multiple of ${end.path.join("/")}.${end.iface.id}'s ${f.symmetryDeg}° symmetry: the holes will not line up`,
        });
      }
    }
  }

  const placed = new Map<string, Placement>();
  const rootKey = bodyKey(options.root);
  placed.set(rootKey, { key: rootKey, path: options.root, matrix: IDENTITY });
  for (const [key, matrix] of Object.entries(options.fixed ?? {})) {
    const [p, body] = key.split("#");
    placed.set(key, { key, path: p.split("/"), body, matrix });
  }

  // Propagate until nothing changes; then check the mates that closed loops.
  let progress = true;
  const used = new Set<MateEdge>();
  while (progress) {
    progress = false;
    for (const e of mates) {
      if (used.has(e)) continue;
      const ka = bodyKey(e.a.path, e.a.frame.artifact);
      const kb = bodyKey(e.b.path, e.b.frame.artifact);
      const pa = placed.get(ka);
      const pb = placed.get(kb);
      if (pa && !pb) {
        const m = multiplyMat4(pa.matrix, mateTransform(e.a.frame, e.b.frame, e.mate?.rotationDeg, e.mate?.gapMm));
        placed.set(kb, { key: kb, path: e.b.path, body: e.b.frame.artifact, matrix: m, via: e.linkId });
      } else if (pb && !pa) {
        const m = multiplyMat4(pb.matrix, mateTransform(e.b.frame, e.a.frame, -(e.mate?.rotationDeg ?? 0), e.mate?.gapMm));
        placed.set(ka, { key: ka, path: e.a.path, body: e.a.frame.artifact, matrix: m, via: e.linkId });
      } else if (!pa && !pb) continue;
      else {
        // both placed: the mate must agree with the placements
        const wa = applyMat4(pa!.matrix, e.a.frame.origin);
        const n = norm(e.a.frame.normal);
        const gap = e.mate?.gapMm ?? 0;
        const expected: Vec3 = applyMat4(pa!.matrix, [e.a.frame.origin[0] + n[0] * gap, e.a.frame.origin[1] + n[1] * gap, e.a.frame.origin[2] + n[2] * gap]);
        const wb = applyMat4(pb!.matrix, e.b.frame.origin);
        const off = Math.hypot(...sub(expected, wb));
        if (off > 0.1) {
          issues.push({
            severity: "error",
            subject: e.linkId,
            message: `over-constrained: ${e.b.path.join("/")}.${e.b.iface.id} is ${off.toFixed(1)} mm from where ${e.a.path.join("/")}.${e.a.iface.id} puts it (at ${wa.map((v) => v.toFixed(1)).join(", ")})`,
          });
        }
      }
      used.add(e);
      progress = true;
    }
  }

  for (const inst of instances) {
    if (inst.kind === "harness") continue;
    if (placed.has(bodyKey(inst.path))) continue;
    const hasMate = mates.some((e) => bodyKey(e.a.path) === bodyKey(inst.path) || bodyKey(e.b.path) === bodyKey(inst.path));
    const hasFrame = inst.def.interfaces.some((i) => i.geometry?.frame);
    issues.push({
      severity: "info",
      subject: inst.path.join("/"),
      message: hasMate
        ? "mated only to modules that are not placed"
        : hasFrame
          ? "has interface frames but no mechanical link: not placed"
          : "no mechanical interface: not placed (strapped, glued or free)",
    });
  }

  return { instances, placements: [...placed.values()], mates, routes, unrouted, issues };
}
