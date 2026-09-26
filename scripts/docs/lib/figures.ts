/**
 * Figures from the assembly: hero, orthographic views, interface callouts,
 * part thumbnails and exploded assembly steps. All placement comes from
 * assemble(); explosion runs along each joint's structure-side normal, with
 * parts ranked by where they sit on the joint (the fastenerStack positions and
 * the mate gaps), so the exploded order is the stacking order.
 */
import type { InterfaceDef, ModuleDef } from "../../../src/types/index.js";
import { applyMat4, bodyKey, IDENTITY, type MateEdge } from "../../../src/system/geometry.js";
import type { RenderBody, RenderSpec } from "./render/renderer.js";
import { matTranslation, offsetMatrix, worldFrame, type SceneBody, type SceneModel } from "./model.js";
import type { CameraSpec } from "./types.js";

export const ISO: number[] = [1, -1.18, 0.82];

export type Style = RenderBody["style"];

export function renderBody(b: SceneBody, style: Style, extra: Partial<RenderBody> = {}): RenderBody {
  return {
    key: b.key,
    glb: b.glb,
    matrix: b.matrix,
    style,
    category: b.category,
    hide: b.features,
    vendor: b.vendor,
    ...extra,
  };
}

const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: number[], b: number[]) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: number[], s: number) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const isStructure = (iface: InterfaceDef) => iface.protocols?.some((p) => p.type === "bolt_pattern" && p.roles?.includes("structure"));

/** Structure end and moving end of a mate (the moving end is the one the mate placed). */
export function mateEnds(scene: SceneModel, e: MateEdge) {
  const kb = bodyKey(e.b.path, e.b.frame.artifact);
  const placedB = scene.byKey.get(kb)?.via === e.linkId;
  const moving = placedB ? e.b : e.a;
  const fixed = placedB ? e.a : e.b;
  // fastener stacks are measured from the structure-side frame
  const structure = isStructure(e.b.iface) && !isStructure(e.a.iface) ? e.b : e.a;
  return { moving, fixed, structure };
}

export interface Explosion {
  offsets: Map<string, number[]>;
  guides: { from: number[]; to: number[] }[];
  /** Hardware keys in this explosion, grouped by harness child (for callouts). */
  hardwareGroups: Map<string, SceneBody[]>;
  moving: SceneBody[];
}

/**
 * Explode the mates `links` (assemble linkIds). Bodies placed by those mates
 * and the hardware on them move along the joint normal by stacking rank.
 */
export function explode(scene: SceneModel, links: string[], dist: number, dirOverride?: number[]): Explosion {
  const offsets = new Map<string, number[]>();
  const guides: Explosion["guides"] = [];
  const hardwareGroups = new Map<string, SceneBody[]>();
  const moving: SceneBody[] = [];
  const mates = scene.assembly.mates.filter((m) => links.includes(m.linkId));

  // group mates by structure frame (one joint = one structure pattern)
  const joints = new Map<string, { mates: MateEdge[]; origin: number[]; normal: number[] }>();
  for (const e of mates) {
    const { structure } = mateEnds(scene, e);
    const sKey = bodyKey(structure.path, structure.frame.artifact);
    const sBody = scene.byKey.get(sKey);
    if (!sBody) continue;
    const wf = worldFrame(sBody.matrix, structure.frame);
    const k = `${sKey}.${structure.iface.id}`;
    const j = joints.get(k) ?? { mates: [], ...wf };
    j.mates.push(e);
    joints.set(k, j);
  }

  // parents first, so a joint on a body that itself moved carries that body's offset
  const order = (k: string) => scene.bodies.findIndex((b) => k.startsWith(b.key + "."));
  const sorted = [...joints.entries()].sort((a, b) => order(a[0]) - order(b[0]));
  for (const [jk, j] of sorted) {
    const structureKey = jk.slice(0, jk.lastIndexOf("."));
    const base = offsets.get(structureKey) ?? [0, 0, 0];
    const items: { body: SceneBody; pos: number; override?: boolean }[] = [];
    for (const e of j.mates) {
      const { moving: mv } = mateEnds(scene, e);
      const key = bodyKey(mv.path, mv.frame.artifact);
      const body = scene.byKey.get(key);
      if (body && body.via === e.linkId) {
        const wf = worldFrame(body.matrix, mv.frame);
        items.push({ body, pos: dot(sub(wf.origin, j.origin), j.normal), override: Boolean(dirOverride) });
        moving.push(body);
      }
      for (const h of scene.hardware.filter((x) => x.linkId === e.linkId)) {
        items.push({ body: h, pos: dot(sub(matTranslation(h.matrix), j.origin), j.normal) });
        const g = `${h.harness}/${h.child}`;
        hardwareGroups.set(g, [...(hardwareGroups.get(g) ?? []), h]);
      }
    }
    const ranked = items.filter((i) => !i.override);
    const round = (x: number) => Math.round(x * 100) / 100;
    const below = [...new Set(ranked.filter((i) => i.pos < -0.01).map((i) => round(i.pos)))].sort((a, b) => b - a);
    const above = [...new Set(ranked.filter((i) => i.pos >= -0.01).map((i) => round(i.pos)))].sort((a, b) => a - b);
    for (const it of items) {
      let off: number[];
      if (it.override) off = mul(dirOverride!, dist * 1.6);
      else {
        const p = round(it.pos);
        const rank = p < -0.01 ? -(below.indexOf(p) + 1) : above.indexOf(p) + 1;
        off = mul(j.normal, rank * dist);
      }
      offsets.set(it.body.key, add(base, off));
    }
    // guides: one dashed axis per hole through the exploded column
    const holes = new Map<string, { base: number[]; ts: number[] }>();
    for (const it of items) {
      if (!it.body.harness) continue;
      const p0 = matTranslation(it.body.matrix);
      const t0 = dot(sub(p0, j.origin), j.normal);
      const inPlane = sub(p0, mul(j.normal, t0));
      const k = inPlane.map((x) => x.toFixed(1)).join(",");
      const h = holes.get(k) ?? { base: add(inPlane, base), ts: [0] };
      const off = sub(offsets.get(it.body.key) ?? [0, 0, 0], base);
      h.ts.push(t0, t0 + dot(off, j.normal));
      holes.set(k, h);
    }
    // the axis runs on to the exploded seat of the part the hardware holds
    for (const it of items.filter((i) => !i.body.harness && !i.override)) {
      const off = sub(offsets.get(it.body.key) ?? [0, 0, 0], base);
      const t = it.pos + dot(off, j.normal);
      for (const h of holes.values()) h.ts.push(t);
    }
    for (const h of holes.values()) {
      const lo = Math.min(...h.ts) - 3;
      const hi = Math.max(...h.ts) + 3;
      guides.push({ from: add(h.base, mul(j.normal, lo)), to: add(h.base, mul(j.normal, hi)) });
    }
    // bodies without hardware (a prop on a shaft): axis from seat to exploded seat
    for (const it of items.filter((i) => !i.body.harness)) {
      const hasHw = items.some((i) => i.body.harness);
      if (hasHw && !it.override) continue;
      const e = j.mates.find((m) => scene.byKey.get(bodyKey(mateEnds(scene, m).moving.path, mateEnds(scene, m).moving.frame.artifact)) === it.body);
      if (!e) continue;
      const wf = worldFrame(it.body.matrix, mateEnds(scene, e).moving.frame);
      const off = sub(offsets.get(it.body.key)!, base);
      guides.push({ from: add(wf.origin, base), to: add(add(wf.origin, off), base) });
    }
  }
  return { offsets, guides, hardwareGroups, moving };
}

export function withOffset(b: RenderBody, off?: number[]): RenderBody {
  return off ? { ...b, matrix: offsetMatrix(b.matrix, off) } : b;
}

export function cameraOf(c: CameraSpec | undefined, fallback: CameraSpec): RenderSpec["camera"] {
  return { ...fallback, ...(c ?? {}) } as RenderSpec["camera"];
}

/** Everything assembled, one style. */
export function allBodies(scene: SceneModel, style: Style, hardwareStyle: Style = style): RenderBody[] {
  return [...scene.bodies.map((b) => renderBody(b, style)), ...scene.hardware.map((h) => renderBody(h, hardwareStyle))];
}

/** A module on its own at its CAD origin (kit thumbnails). */
export function isolated(def: ModuleDef, glb: string, features: string[], category: string, vendor: boolean): RenderBody[] {
  return [{ key: def.id, glb, matrix: IDENTITY, style: "normal", category, hide: features, vendor }];
}

/** World origin of an interface frame on a placed instance ("frame.motor_mount_fl"). */
export function interfaceAnchor(scene: SceneModel, spec: string): { p: number[]; body: SceneBody; iface: InterfaceDef } | undefined {
  const dot = spec.lastIndexOf(".");
  const path = spec.slice(0, dot);
  const id = spec.slice(dot + 1);
  for (const b of scene.bodies) {
    if (b.path.join("/") !== path) continue;
    const iface = b.def.interfaces.find((i) => i.id === id);
    const frame = iface?.geometry?.frame;
    if (!iface || !frame) continue;
    if ((frame.artifact ?? undefined) !== (b.key.includes("#") ? b.key.split("#")[1] : frame.artifact)) continue;
    return { p: applyMat4(b.matrix, frame.origin), body: b, iface };
  }
  return undefined;
}
