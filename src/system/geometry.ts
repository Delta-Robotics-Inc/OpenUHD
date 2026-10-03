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
import { resolveBelow, resolveExports, type ModuleLookup } from "./index.js";
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
  /** Solid volume of the body, feature pads excluded (PB-797): mass = volume × material density. */
  volume_mm3?: number;
  /** Volume of each named body in the artifact (mm³). */
  bodies?: Record<string, number>;
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
  /** Path of the harness instance carrying the link. */
  harnessPath?: string[];
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

/** One hardware part placed by a fastener harness (world = the assembly root's coordinates). */
export interface HardwarePlacement {
  /** Harness instance path, e.g. "arm_fl_hardware". */
  harness: string;
  /** Harness child id and its definition. */
  child: string;
  def: ModuleDef;
  /** Link (joint) the stack was applied to. */
  linkId: string;
  matrix: Mat4;
  /** Body the stack is measured from (the structure side) and the one it holds. */
  structure: string;
  mounted: string;
  /** Position along the structure normal (mm) and orientation, from the stack item. */
  atMm: number;
  direction: 1 | -1;
}

/**
 * One end of a routed harness (PB-805 harness geometry): the harness's end
 * interface, the link it takes part in, and how well the routed geometry
 * still meets the part it lands on.
 */
export interface HarnessEndCheck {
  interfaceId: string;
  linkId: string;
  /** The part interface (or link-scoped composition) the end lands on, e.g. "stack/esc.motor_1_a". */
  counterpart: string;
  /**
   * anchor: this end placed the harness; matches: the routed end meets its
   * counterpart; stale: it no longer does (the part moved, or the route was
   * generated from another assembly); unplaced: the counterpart is not
   * placed; no_geometry: one side has no frame.
   */
  status: "anchor" | "matches" | "stale" | "unplaced" | "no_geometry";
  /** Distance between the routed end and the counterpart's frame (mm). */
  offsetMm?: number;
  /** Angle between the routed end's normal and the reversed counterpart normal (degrees). */
  angleDeg?: number;
}

/**
 * A harness whose ends carry frames in its own (routed) geometry, placed by
 * the first end whose counterpart is placed. Harnesses never place modules:
 * a cable follows the parts it connects. Every other end is checked against
 * its counterpart.
 */
export interface HarnessPlacement {
  key: string;
  path: string[];
  def: ModuleDef;
  /** Harness coordinates -> assembly root coordinates. */
  matrix: Mat4;
  /** Link that anchored it. */
  via: string;
  ends: HarnessEndCheck[];
}

export interface Assembly {
  instances: GeometryInstance[];
  placements: Placement[];
  /** Rigid mates: links between mechanical interfaces that both have frames. */
  mates: MateEdge[];
  routes: RouteEdge[];
  /** Hardware placed from fastener harnesses (`ModuleDef.fastenerStack`). */
  hardware: HardwarePlacement[];
  /** Routed wire harnesses (harness ends with frames), placed by the parts they connect. */
  harnesses: HarnessPlacement[];
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
    const routedHarnessEnd = [a, b].some((e) => e.def.kind === "harness" && e.iface.geometry?.frame);
    if (!mechanical && routedHarnessEnd) continue; // a routed harness end: checked by placeHarnesses
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
    mates.push({
      linkId,
      harness: link.harness,
      harnessPath: link.harness ? [...prefix, link.harness] : undefined,
      a: { ...a, frame: fa },
      b: { ...b, frame: fb },
      mate: link.mate,
    });

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

  const hardware = placeHardware(instances, mates, placed, lookup, issues);
  const harnesses = placeHarnesses(instances, links, placed, lookup, issues);
  return { instances, placements: [...placed.values()], mates, routes, unrouted, hardware, harnesses, issues };
}

// ---------------------------------------------------------------------------
// Bolt patterns and fastener stacks
// ---------------------------------------------------------------------------

const paramValue = (iface: InterfaceDef, id: string) => {
  const p = iface.parameters?.find((x) => x.id === id);
  return p?.value ?? p?.range?.[0];
};

/**
 * Hole centres of a bolt-pattern interface in its frame's x/y (mm). Circles
 * start at the frame's xAxis (the frame's xAxis points at hole 1); squares
 * and rectangles are centred, sides along x and y; a cross has one diagonal
 * pair on x and the other on y; a row is centred on x, first hole at -x. A
 * slot has no fixed holes (none are returned): a fastener stack on a slot
 * gives its `positions`.
 */
export function boltPatternHoles(iface: InterfaceDef): [number, number][] {
  const shape = iface.traits?.find((t) => t.type === "bolt_pattern")?.params?.shape;
  if (shape === "slot") return [];
  const spacing = paramValue(iface, "hole_spacing");
  if (spacing === undefined) return [];
  const count = paramValue(iface, "hole_count") ?? 4;
  if (shape === "row") {
    const pitch = paramValue(iface, "hole_pitch") ?? (count > 1 ? spacing / (count - 1) : 0);
    return Array.from({ length: count }, (_, k) => [-spacing / 2 + k * pitch, 0] as [number, number]);
  }
  if (shape === "circle") {
    return Array.from({ length: count }, (_, k) => {
      const a = (2 * Math.PI * k) / count;
      return [(Math.cos(a) * spacing) / 2, (Math.sin(a) * spacing) / 2] as [number, number];
    });
  }
  const sy = paramValue(iface, "hole_spacing_y") ?? spacing;
  if (shape === "cross") {
    return [
      [-spacing / 2, 0],
      [spacing / 2, 0],
      [0, -sy / 2],
      [0, sy / 2],
    ];
  }
  return [
    [-spacing / 2, -sy / 2],
    [spacing / 2, -sy / 2],
    [spacing / 2, sy / 2],
    [-spacing / 2, sy / 2],
  ];
}

/** A shaft interface whose `shaft` trait states a thread (e.g. "M5"): what a nut on it engages. */
function threadedShaft(iface: InterfaceDef): { thread: string; length?: number } | undefined {
  if (!iface.protocols?.some((p) => p.type === "shaft")) return undefined;
  const thread = iface.traits?.find((t) => t.type === "shaft" && typeof t.params?.thread === "string")?.params?.thread as string | undefined;
  if (!thread) return undefined;
  const length = paramValue(iface, "length");
  return { thread, ...(length !== undefined ? { length } : {}) };
}

/** Frame as a Mat4 (columns x, y, z = normal; translation = origin). */
export function frameMatrix(frame: GeometryFrame): Mat4 {
  const [x, y, z] = basis(frame);
  const o = frame.origin;
  return [x[0], y[0], z[0], o[0], x[1], y[1], z[1], o[1], x[2], y[2], z[2], o[2], 0, 0, 0, 1];
}

const translate = (x: number, y: number, z: number): Mat4 => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
const FLIP: Mat4 = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1];

function placeHardware(
  instances: GeometryInstance[],
  mates: MateEdge[],
  placed: Map<string, Placement>,
  lookup: ModuleLookup,
  issues: AssemblyIssue[],
): HardwarePlacement[] {
  const out: HardwarePlacement[] = [];
  const done = new Set<string>();
  for (const e of mates) {
    if (!e.harnessPath) continue;
    const key = e.harnessPath.join("/");
    if (done.has(key)) continue;
    const harness = instances.find((i) => i.path.join("/") === key)?.def;
    if (!harness?.fastenerStack?.length) continue;
    done.add(key);

    const isStructure = (end: MateEdge["a"]) => end.iface.protocols?.some((p) => p.type === "bolt_pattern" && p.roles?.includes("structure"));
    const s = isStructure(e.b) && !isStructure(e.a) ? e.b : e.a;
    const m = s === e.a ? e.b : e.a;
    const at = placed.get(bodyKey(s.path, s.frame.artifact));
    if (!at) continue;
    const base = multiplyMat4(at.matrix, frameMatrix(s.frame));
    const holes = boltPatternHoles(s.iface);
    // A nut on a threaded shaft (a prop nut on a motor shaft): the structure end is a shaft whose `shaft`
    // trait states a thread, so the shaft is the threaded member, from its frame outward along the normal
    // (to its `length` parameter when it states one).
    const shaftThread = threadedShaft(s.iface);

    const counts = new Map<string, number>();
    const spans = new Map<string, { kind: string; child: string; from: number; to: number }[]>();
    for (const item of harness.fastenerStack) {
      const ref = harness.children?.find((c) => c.id === item.child);
      const def = ref && lookup(ref.moduleDefId);
      if (!def) {
        issues.push({ severity: "error", subject: key, message: `fastener stack names "${item.child}", which is not a child of ${harness.id}` });
        continue;
      }
      const dir = item.direction ?? 1;
      const len = def.interfaces.map((i) => paramValue(i, "length")).find((v) => v !== undefined) ?? 0;
      const kind = def.tags?.includes("nut") ? "nut" : def.tags?.includes("screw") ? "screw" : "part";
      for (const [x, y] of item.positions ?? holes) {
        const local = multiplyMat4(translate(x, y, item.atMm), dir === 1 ? IDENTITY : FLIP);
        out.push({
          harness: key,
          child: item.child,
          def,
          linkId: e.linkId,
          matrix: multiplyMat4(base, local),
          structure: bodyKey(s.path, s.frame.artifact),
          mounted: bodyKey(m.path, m.frame.artifact),
          atMm: item.atMm,
          direction: dir,
        });
        counts.set(item.child, (counts.get(item.child) ?? 0) + 1);
        const hole = `${x.toFixed(2)},${y.toFixed(2)}`;
        const list = spans.get(hole) ?? [];
        list.push({ kind, child: item.child, from: Math.min(item.atMm, item.atMm + dir * len), to: Math.max(item.atMm, item.atMm + dir * len) });
        spans.set(hole, list);
      }
    }
    for (const ref of harness.children ?? []) {
      const n = counts.get(ref.id) ?? 0;
      if (n !== (ref.quantity ?? 1)) {
        issues.push({ severity: "warning", subject: key, message: `${ref.id}: the harness lists ${ref.quantity ?? 1}, its fastener stack places ${n}` });
      }
    }
    // every nut must sit on thread
    const reported = new Set<string>();
    for (const list of spans.values()) {
      for (const nut of list.filter((x) => x.kind === "nut")) {
        const screw =
          list.find((x) => x.kind === "screw" && x.from <= nut.to && x.to >= nut.from) ??
          (shaftThread && nut.from >= 0 ? { child: `the threaded shaft ${s.iface.id}`, from: 0, to: shaftThread.length ?? Infinity } : undefined);
        const msg = !screw
          ? `${nut.child}: no screw passes through it`
          : screw.to < nut.to && screw.from <= nut.from
            ? `${screw.child} ends ${(nut.to - screw.to).toFixed(1)} mm short of the far face of ${nut.child}`
            : screw.from > nut.from && screw.to >= nut.to
              ? `${screw.child} ends ${(screw.from - nut.from).toFixed(1)} mm short of the far face of ${nut.child}`
              : undefined;
        if (msg && !reported.has(msg)) {
          reported.add(msg);
          issues.push({ severity: "error", subject: key, message: msg });
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Routed harnesses (PB-805): harness geometry bound to the frames it lands on
// ---------------------------------------------------------------------------

/** Tolerances for a routed end meeting its counterpart. */
export const HARNESS_END_TOLERANCE = { mm: 0.5, deg: 5 };

const transformFrame = (m: Mat4, f: GeometryFrame): GeometryFrame => {
  const o = applyMat4(m, f.origin);
  const dir = (v: Vec3): Vec3 => sub(applyMat4(m, v), applyMat4(m, [0, 0, 0]));
  return { origin: o, normal: norm(dir(f.normal)), ...(f.xAxis ? { xAxis: norm(dir(f.xAxis)) } : {}) };
};

/**
 * One frame for several: the mean origin and normal, and (when the origins
 * are spread out) an xAxis from the first to the last, i.e. pin 1 to pin N
 * of a composed end. A single frame is returned as is.
 */
export function combineFrames(frames: GeometryFrame[]): GeometryFrame | undefined {
  if (!frames.length) return undefined;
  if (frames.length === 1) return frames[0];
  const n = frames.length;
  const origin: Vec3 = [0, 1, 2].map((k) => frames.reduce((s, f) => s + f.origin[k], 0) / n) as Vec3;
  const normal = norm([0, 1, 2].map((k) => frames.reduce((s, f) => s + norm(f.normal)[k], 0)) as Vec3);
  const span = sub(frames[n - 1].origin, frames[0].origin);
  const inPlane = sub(span, scale(normal, dot(span, normal)));
  return Math.hypot(...inPlane) > 1e-6 ? { origin, normal, xAxis: norm(inPlane) } : { origin, normal };
}

/** Numeric order of connector slots: p1, p2, …, p10. */
const slotOrder = (a: string, b: string) => (parseInt(a.replace(/\D+/g, ""), 10) || 0) - (parseInt(b.replace(/\D+/g, ""), 10) || 0) || a.localeCompare(b);

/**
 * World frames of a link end on the part side: per position for a
 * link-scoped composition (in slot order), else the interface's own frame or
 * its children's. Also returns the combined frame and whether every body is
 * placed.
 */
export function linkEndFrames(
  owner: ModuleDef,
  end: EndpointTarget,
  lookup: ModuleLookup,
  prefix: string[],
  placed: Map<string, { matrix: Mat4 }>,
): { label: string; frames: { slot?: string; interfaceId: string; frame: GeometryFrame }[]; combined?: GeometryFrame; placed: boolean } | undefined {
  const out: { slot?: string; interfaceId: string; frame: GeometryFrame }[] = [];
  let allPlaced = true;
  const add = (path: string[], def: ModuleDef, interfaceId: string, slot?: string) => {
    const g = interfaceGeometry(def, interfaceId).frames;
    const world: GeometryFrame[] = [];
    for (const { frame } of g) {
      const p = placed.get(bodyKey(path, frame.artifact));
      if (!p) {
        allPlaced = false;
        continue;
      }
      world.push(transformFrame(p.matrix, frame));
    }
    if (slot !== undefined) {
      const c = combineFrames(world);
      if (c) out.push({ slot, interfaceId, frame: c });
    } else for (const f of world) out.push({ interfaceId, frame: f });
    return g.length > 0;
  };
  if ("child" in end && end.compose) {
    let any = false;
    for (const slot of Object.keys(end.compose).sort(slotOrder)) {
      let r;
      try {
        r = resolveBelow(owner, end.child, end.compose[slot], lookup);
      } catch {
        return undefined;
      }
      any = add([...prefix, ...r.ownerPath], r.owner, r.iface.id, slot) || any;
    }
    if (!any) return { label: `${[...prefix, end.child].join("/")}.${end.interfaceId}`, frames: [], placed: allPlaced };
    return { label: `${[...prefix, end.child].join("/")}.${end.interfaceId}`, frames: out, combined: combineFrames(out.map((f) => f.frame)), placed: allPlaced };
  }
  const r = resolveLeafEndpoint(owner, end, lookup, prefix);
  if (!r) return undefined;
  add(r.path, r.def, r.iface.id);
  return { label: `${r.path.join("/")}.${r.iface.id}`, frames: out, combined: combineFrames(out.map((f) => f.frame)), placed: allPlaced };
}

function placeHarnesses(
  instances: GeometryInstance[],
  links: { owner: ModuleDef; prefix: string[]; link: Link }[],
  placed: Map<string, Placement>,
  lookup: ModuleLookup,
  issues: AssemblyIssue[],
): HarnessPlacement[] {
  const out: HarnessPlacement[] = [];
  for (const inst of instances) {
    if (inst.kind !== "harness") continue;
    const routed = inst.def.interfaces.filter((i) => i.geometry?.frame);
    if (!routed.length) continue;
    const key = inst.path.join("/");
    const parent = inst.path.slice(0, -1);
    const childId = inst.path[inst.path.length - 1];
    // links (declared by the harness's parent) with one end on this harness
    const ends: { link: Link; linkId: string; own: InterfaceDef; other: NonNullable<ReturnType<typeof linkEndFrames>> | undefined; owner: ModuleDef; prefix: string[] }[] = [];
    for (const { owner, prefix, link } of links) {
      if (prefix.join("/") !== parent.join("/")) continue;
      for (const [mine, theirs] of [[link.a, link.b], [link.b, link.a]] as const) {
        if (!("child" in mine) || mine.child !== childId) continue;
        const own = inst.def.interfaces.find((i) => i.id === mine.interfaceId);
        if (!own) continue;
        ends.push({ link, linkId: [...prefix, link.id].join("/"), own, other: linkEndFrames(owner, theirs, lookup, prefix, placed), owner, prefix });
      }
    }
    const checks: HarnessEndCheck[] = [];
    const anchor = ends.find((e) => e.own.geometry?.frame && e.other?.combined && e.other.placed);
    if (!anchor) {
      issues.push({ severity: "info", subject: key, message: "routed harness: no end lands on a placed part with a frame, so it is not placed" });
      continue;
    }
    const matrix = mateTransform(anchor.other!.combined!, anchor.own.geometry!.frame!);
    for (const e of ends) {
      const counterpart = e.other?.label ?? "?";
      const base = { interfaceId: e.own.id, linkId: e.linkId, counterpart };
      if (e === anchor) {
        checks.push({ ...base, status: "anchor", offsetMm: 0, angleDeg: 0 });
        continue;
      }
      const f = e.own.geometry?.frame;
      if (!f || !e.other?.frames.length) {
        checks.push({ ...base, status: "no_geometry" });
        continue;
      }
      if (!e.other.placed || !e.other.combined) {
        checks.push({ ...base, status: "unplaced" });
        continue;
      }
      const w = transformFrame(matrix, f);
      const c = e.other.combined;
      const offsetMm = Math.hypot(...sub(w.origin, c.origin));
      const angleDeg = (Math.acos(Math.max(-1, Math.min(1, -dot(w.normal, c.normal)))) * 180) / Math.PI;
      const stale = offsetMm > HARNESS_END_TOLERANCE.mm || angleDeg > HARNESS_END_TOLERANCE.deg;
      checks.push({ ...base, status: stale ? "stale" : "matches", offsetMm: +offsetMm.toFixed(3), angleDeg: +angleDeg.toFixed(2) });
      if (stale) {
        issues.push({
          severity: "warning",
          subject: key,
          message: `routed harness end ${e.own.id} is ${offsetMm.toFixed(1)} mm / ${angleDeg.toFixed(0)}° from ${counterpart} (link ${e.linkId}): the route was generated for another assembly; regenerate it`,
        });
      }
    }
    out.push({ key, path: inst.path, def: inst.def, matrix, via: anchor.linkId, ends: checks });
  }
  return out;
}
