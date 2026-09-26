/**
 * Assembly guide: kit, hardware index with fastener stack-ups, then one step
 * per group of mates (from assemble()) and wiring links (wiringChecklist),
 * with the hardware each step consumes, exploded figures, generated actions,
 * model notes, and a coverage appendix proving every mate, hardware placement
 * and wiring link appears in a step.
 */
import type { ModuleDef } from "../../../../src/types/index.js";
import { bodyKey, type HardwarePlacement, type MateEdge } from "../../../../src/system/geometry.js";
import type { WiringStep } from "../../../../src/system/wiring.js";
import { callouts, figure, leafOf, note, parseEnd, sec, sub, table, wiringDiagram, wiringRows } from "../blocks.js";
import { esc } from "../html.js";
import { explode, mateEnds, renderBody, withOffset, ISO } from "../figures.js";
import { matTranslation, worldFrame, type SceneBody } from "../model.js";
import type { RenderBody } from "../render/renderer.js";
import type { StepGroupSpec } from "../types.js";
import { coverPage, figNum, thumbnail, type BuildEnv } from "./common.js";

const W = 178;

const wild = (pattern: string) => new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
const matches = (patterns: string[] | undefined, id: string) => (patterns ?? []).some((p) => wild(p).test(id));

export interface StepPlan {
  n: number;
  spec: StepGroupSpec;
  mates: MateEdge[];
  wiring: WiringStep[];
  moving: SceneBody[];
  placed: SceneBody[];
  hardware: SceneBody[];
  /** Unplaced instances introduced here (strap, receiver). */
  extras: { path: string; def: ModuleDef }[];
}

/** Steps from the doc spec, plus automatic steps for anything the spec leaves out. */
export function planSteps(env: BuildEnv): StepPlan[] {
  const { ctx } = env;
  const scene = ctx.scene;
  const specs = [...(ctx.sys.config.assembly?.steps ?? [])];
  const usedMates = new Set<string>();
  const usedWires = new Set<string>();
  const plans: StepPlan[] = [];
  const introduced = new Set<string>();
  const root = bodyKey(ctx.sys.config.root ?? []);
  introduced.add(root);

  const make = (spec: StepGroupSpec): StepPlan => {
    const mates = scene.assembly.mates.filter((m) => !usedMates.has(m.linkId) && matches(spec.mates, m.linkId));
    const wiring = ctx.wiring.filter((w) => w.domain !== "mechanical" && !usedWires.has(w.linkId) && matches(spec.wiring, w.linkId));
    mates.forEach((m) => usedMates.add(m.linkId));
    wiring.forEach((w) => usedWires.add(w.linkId));
    const moving = scene.bodies.filter((b) => mates.some((m) => m.linkId === b.via));
    const placed = scene.bodies.filter((b) => (spec.place ?? []).includes(b.path.join("/")));
    const hardware = scene.hardware.filter((h) => mates.some((m) => m.linkId === h.linkId));
    const extras: StepPlan["extras"] = [];
    for (const p of spec.place ?? []) {
      if (placed.some((b) => b.path.join("/") === p)) continue;
      const def = ctx.instances.get(p);
      if (def) extras.push({ path: p, def });
    }
    // wiring ends not yet introduced (a receiver with no mechanical interface)
    for (const w of wiring) {
      const prefix = w.linkId.includes("/") ? w.linkId.split("/").slice(0, -1).join("/") + "/" : "";
      for (const end of [w.a, w.b]) {
        const e = parseEnd(end);
        const leaf = leafOf(ctx.sys.system, ctx.sys.lookup, e.path, e.iface);
        if (!leaf) continue;
        const p = prefix && !leaf.path.join("/").startsWith(prefix) ? prefix + leaf.path.join("/") : leaf.path.join("/");
        const isBody = scene.bodies.some((b) => b.path.join("/") === p);
        if (!isBody && !introduced.has(p) && !extras.some((x) => x.path === p)) extras.push({ path: p, def: leaf.def });
      }
    }
    for (const b of [...moving, ...placed]) introduced.add(b.key);
    for (const x of extras) introduced.add(x.path);
    return { n: plans.length + 1, spec, mates, wiring, moving, placed, hardware, extras };
  };

  for (const s of specs) plans.push(make(s));
  // anything left: one step per harness (mates), then per harness (wiring)
  const leftMates = scene.assembly.mates.filter((m) => !usedMates.has(m.linkId));
  const byHarness = new Map<string, string[]>();
  for (const m of leftMates) byHarness.set(m.harness ?? m.linkId, [...(byHarness.get(m.harness ?? m.linkId) ?? []), m.linkId]);
  for (const [h, ids] of byHarness) plans.push(make({ id: `auto-${h}`, title: `Assemble ${h}`, mates: ids }));
  const leftWires = ctx.wiring.filter((w) => w.domain !== "mechanical" && !usedWires.has(w.linkId));
  const wByH = new Map<string, string[]>();
  for (const w of leftWires) wByH.set(w.harness ?? "direct", [...(wByH.get(w.harness ?? "direct") ?? []), w.linkId]);
  for (const [h, ids] of wByH) plans.push(make({ id: `auto-wire-${h}`, title: `Wire ${h}`, wiring: ids, figure: "wiring" }));
  return plans;
}

// ---------------------------------------------------------------------------

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}

const shortName = (d: ModuleDef) => d.name.replace(/\s*\((included[^)]*|custom)\)/gi, "").replace(/, ISO 4762.*$/, "").replace(/ socket head cap screw/, " SHCS");

function connectorOf(def: ModuleDef, ifaceId: string): string | undefined {
  const i = def.interfaces.find((x) => x.id === ifaceId);
  const t = i?.traits?.find((x) => x.type === "connector");
  return t?.params?.connector_type as string | undefined;
}

export async function buildAssemblyGuide(env: BuildEnv): Promise<string> {
  const { ctx, doc } = env;
  const scene = ctx.scene;
  const cfg = ctx.sys.config;
  const iso = cfg.camera?.dir ?? ISO;
  const plans = planSteps(env);
  const out: string[] = [];
  const E0 = cfg.assembly?.explode ?? 16;

  // ---------------------------------------------------------------- cover: whole-system explosion
  const allMates = scene.assembly.mates.map((m) => m.linkId);
  const ex = explode(scene, allMates, 11);
  const batt = scene.bodies.filter((b) => b.via?.startsWith("hint:"));
  const coverBodies: RenderBody[] = [
    ...scene.bodies.map((b) => withOffset(renderBody(b, "normal"), ex.offsets.get(b.key) ?? (b.via?.startsWith("hint:") ? [0, 0, 40] : undefined))),
    ...scene.hardware.map((h) => withOffset(renderBody(h, "normal"), ex.offsets.get(h.key))),
  ];
  const hero = await env.r.render("ag-hero", { width: 2000, height: 1180, mode: "shaded", bodies: coverBodies, camera: { dir: iso, margin: 0.02 } });
  const partCount = ctx.bom.reduce((s: number, b: any) => s + b.quantity, 0);
  out.push(
    coverPage(env, {
      kicker: "Assembly guide",
      hero,
      heroCaption: `Exploded along each joint's axis in fastener-stack order (${scene.assembly.mates.length} mates, ${scene.hardware.length} hardware parts${batt.length ? ", battery by placement hint" : ""}).`,
      bottom: `<div class="kpis">
        <div class="kpi"><div class="k-label">Steps</div><div class="k-value">${plans.length}</div><div class="k-sub">mechanical and wiring</div></div>
        <div class="kpi"><div class="k-label">Mates</div><div class="k-value">${doc.v("sys:assembly.mates", undefined, { marker: false })}</div><div class="k-sub">from assemble()</div></div>
        <div class="kpi"><div class="k-label">Hardware</div><div class="k-value">${doc.v("derived:mech.hardware_count", undefined, { marker: false })}</div><div class="k-sub">screws, spacers, standoffs, nuts</div></div>
        <div class="kpi"><div class="k-label">Parts</div><div class="k-value">${partCount}</div><div class="k-sub">${ctx.bom.length} BOM lines</div></div></div>
        <div class="cover-grid"><div><h2 class="sub">How this guide is made</h2><p class="small">Steps, parts and hardware come from the UHD model: mates and fastener stacks from <code>assemble()</code>, wiring from <code>wiringChecklist</code>. The coverage table at the end lists where every mate, fastener and wire appears.</p></div><div>${doc.legendPlaceholder()}</div></div>`,
    }),
  );

  // ---------------------------------------------------------------- 01 before you begin
  const tools = new Set<string>();
  for (const h of scene.hardware) {
    const tags = new Set(h.def.tags ?? []);
    const size = [...tags].find((t) => /^m\d$/.test(t))?.toUpperCase();
    if (tags.has("screw")) tools.add(`Hex key for ${size} socket head (ISO 4762)`);
    if (tags.has("nut")) tools.add(`Nut driver or spanner for ${size} nyloc`);
  }
  const solder = ctx.wiring.some((w) => {
    const e = parseEnd(w.a);
    const l = leafOf(ctx.sys.system, ctx.sys.lookup, e.path, e.iface);
    return (l && /solder|bare_wire/.test(connectorOf(l.def, l.iface.id) ?? "")) || Boolean(w.harness && /xt60/.test(w.harness));
  });
  if (solder) tools.add("Soldering iron, solder, heat-shrink");
  out.push(`<div class="block">${sec("01", "Before you begin")}<div class="cols-60"><div>
    ${sub("Contents")}<ol class="toc">${["Before you begin", "Kit contents", "Hardware", ...plans.map((p) => p.spec.title), "Coverage"].map((t, i) => `<li><span class="toc-n">${String(i + 1).padStart(2, "0")}</span><span class="toc-t">${esc(t)}</span><span class="toc-dots"></span><span class="toc-p">00</span></li>`).join("")}</ol>
  </div><div>
    ${sub("Tools")}<ul class="plain">${[...tools].map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <p class="small muted">Derived from the hardware in the model (thread size and head type). Key sizes and tightening torques are not in the model.</p>
    ${sub("Reading the figures")}
    <div class="keyrow"><span class="sw sw-ctx"></span>Already assembled</div>
    <div class="keyrow"><span class="sw sw-new"></span>Fitted in this step</div>
    <div class="keyrow"><span class="sw sw-acc"></span>Hardware for this step</div>
    <div class="keyrow"><span class="sw sw-guide"></span>Assembly axis</div>
    <p class="small muted">Parts are drawn exploded along each joint's axis in stacking order, from the model's fastener stacks and mate gaps.</p>
  </div></div>
  ${note("warning", "Remove the propellers for any work with the battery connected. Fit them last (step " + (plans.findIndex((p) => p.spec.id.includes("prop")) + 1 || plans.length) + ").")}
  ${note("info", "Tightening torques are <b>not in the model</b> for any joint; the torque line of each step says so. Use thread-locker on metal-to-metal threads only.")}</div>`);

  // ---------------------------------------------------------------- 02 kit
  const kitItems: string[] = [];
  for (const b of ctx.bom as any[]) {
    const def = ctx.sys.lookup(b.partId);
    const th = def ? await thumbnail(env, def) : undefined;
    kitItems.push(`<div class="kit-item${th ? "" : " noimg"}">${th ? `<img src="${esc(env.img(th.file))}" alt="">` : `<div class="ph">${esc(def?.kind === "harness" ? "cable / lead" : "no CAD")}</div>`}<div class="k-qty">×${doc.v(`sys:bom[line=${b.line}].quantity`, undefined, { marker: false })}</div><div class="k-name">${esc(def ? shortName(def) : b.name)}</div><div class="k-id">${esc(b.partId)}</div></div>`);
  }
  out.push(`<div class="block" data-break="before">${sec("02", "Kit contents", "generated/bom.json")}<div class="kit">${kitItems.join("")}</div><p class="fn">Quantities from the generated BOM; drawings are the parts' CAD artifacts, not to scale.</p></div>`);

  // ---------------------------------------------------------------- 03 hardware and stack-ups
  const byDef = groupBy(scene.hardware, (h) => ctx.instances.get(h.harness!)?.id ?? h.harness!);
  const hwRows: string[][] = [];
  const stackSvgs: string[] = [];
  for (const [hid, items] of byDef) {
    const hpaths = [...new Set(items.map((h) => h.harness!))];
    const hdef = ctx.instances.get(hpaths[0]);
    if (!hdef) continue;
    const byChild = groupBy(items, (h) => h.child!);
    const steps = [...new Set(plans.filter((p) => p.hardware.some((h) => hpaths.includes(h.harness!))).map((p) => p.n))];
    hwRows.push([
      `<b>${esc(hdef.name)}</b>${hpaths.length > 1 ? ` <span class="accent-q">×${hpaths.length}</span>` : ""}<br><span class="muted small">joint ${esc([...new Set(items.map((h) => h.linkId))].join(", "))}</span>`,
      [...byChild.values()].map((hs) => `${hs.length} × ${esc(shortName(hs[0].def))}`).join("<br>"),
      steps.length ? steps.map((n) => `Step ${n}`).join(", ") : '<span class="x-flag">none</span>',
    ]);
    if (hdef.fastenerStack?.length) stackSvgs.push(stackDiagram(env, hdef, items.filter((h) => h.harness === hpaths[0])));
    void hid;
  }
  out.push(`<div class="block" data-break="before">${sec("03", "Hardware", "fastener stacks")}<p class="prose">Every screw, spacer, standoff and nut is placed by a harness's <code>fastenerStack</code>. The sections below are drawn from those positions and the mate gaps: one hole of each joint, to one scale, millimetres from the structure face.</p></div>`);
  out.push(table([{ h: "Harness" }, { h: "Parts placed" }, { h: "Used in" }], hwRows, { split: true, caption: "Hardware by harness", cls: "dense hwtable" }));
  for (let i = 0; i < stackSvgs.length; i += 2) out.push(`<div class="block keep"><div class="cols">${stackSvgs.slice(i, i + 2).join("")}</div></div>`);

  // ---------------------------------------------------------------- steps
  const before = new Set<string>([bodyKey(cfg.root ?? [])]);
  const hwBefore = new Set<string>();
  for (const p of plans) {
    out.push(await stepBlock(env, p, before, hwBefore, E0, iso, plans.length));
    for (const b of [...p.moving, ...p.placed]) before.add(b.key);
    for (const h of p.hardware) hwBefore.add(h.key);
  }
  return out.join("\n");
}

async function stepBlock(env: BuildEnv, p: StepPlan, before: Set<string>, hwBefore: Set<string>, E0: number, iso: number[], total: number): Promise<string> {
  const { ctx, doc } = env;
  const scene = ctx.scene;
  const s = p.spec;
  const E = s.explode ?? E0;
  const letters = "ABCDEFGHJKLMNP";
  const parts: { key: string; def: ModuleDef; count: number; letter: string; anchor?: string; accent: boolean }[] = [];

  // parts: moving modules, placed modules, extras, hardware by child, cables of the wiring
  for (const [id, bs] of groupBy([...p.moving, ...p.placed], (b) => b.def.id)) {
    const main = bs.find((b) => !b.key.includes("#")) ?? bs[0];
    parts.push({ key: id, def: bs[0].def, count: new Set(bs.map((b) => b.path.join("/"))).size, letter: "", anchor: `body:${main.key}`, accent: false });
  }
  for (const x of p.extras) parts.push({ key: x.path, def: x.def, count: 1, letter: "", accent: false });
  for (const [, hs] of groupBy(p.hardware, (h) => h.def.id)) parts.push({ key: hs[0].def.id, def: hs[0].def, count: hs.length, letter: "", anchor: `hw:${hs[0].key}`, accent: true });
  for (const [h] of groupBy(p.wiring.filter((w) => w.harness), (w) => w.harness!)) {
    const def = ctx.instances.get(h);
    if (def && !parts.some((x) => x.def.id === def.id)) parts.push({ key: h, def, count: 1, letter: "", accent: false });
  }
  parts.forEach((x, i) => (x.letter = letters[i] ?? String(i + 1)));

  // ---- figure
  let fig = "";
  const figKind = s.figure ?? (p.mates.length || p.placed.length ? "assembly" : "wiring");
  const ctxBodies = (exclude: Set<string>) => [
    ...scene.bodies.filter((b) => before.has(b.key) && !exclude.has(b.key)).map((b) => renderBody(b, "context")),
    ...scene.hardware.filter((h) => hwBefore.has(h.key)).map((h) => renderBody(h, "context")),
  ];
  if (figKind === "assembly" && (p.mates.length || p.placed.length)) {
    const ex = explode(scene, p.mates.map((m) => m.linkId), E);
    const bodies: RenderBody[] = ctxBodies(new Set());
    const anchors: { id: string; p: number[] }[] = [];
    for (const b of p.moving) {
      const off = ex.offsets.get(b.key);
      bodies.push(withOffset(renderBody(b, "normal"), off));
      anchors.push({ id: `body:${b.key}`, p: centerOf(b, off) });
    }
    for (const b of p.placed) {
      const off = [0, 0, E * 1.6];
      bodies.push(withOffset(renderBody(b, "normal"), off));
      anchors.push({ id: `body:${b.key}`, p: centerOf(b, off) });
    }
    for (const h of p.hardware) {
      const off = ex.offsets.get(h.key);
      bodies.push(withOffset(renderBody(h, "accent"), off));
      anchors.push({ id: `hw:${h.key}`, p: centerOf(h, off) });
    }
    const guides = [...ex.guides];
    for (const b of p.placed) {
      const c = matTranslation(b.matrix);
      guides.push({ from: c, to: [c[0], c[1], c[2] + E * 1.6] });
    }
    const r = await env.r.render(`ag-step-${String(p.n).padStart(2, "0")}-${s.id}`, {
      width: 1900,
      height: 1000,
      mode: "lineart",
      bodies,
      guides,
      anchors,
      camera: { dir: s.camera?.dir ?? iso, up: s.camera?.up, margin: s.camera?.margin ?? 0.1 },
    });
    const overlay = callouts(r, parts.filter((x) => x.anchor).map((x) => ({ anchor: x.anchor!, label: x.letter, accent: x.accent })), W);
    fig = figure({ src: env.img(r.file), w: r.width, h: r.height, overlay, num: figNum(env), caption: p.mates.length ? `${esc(s.title)}: parts exploded along each joint's axis in stacking order; lettered as in the parts strip.` : `${esc(s.title)}: shown lifted above its seat.` });
  } else if (p.wiring.length) {
    // 3D when every link has geometry on both ends (routes), otherwise a pad diagram
    const routes = scene.assembly.routes.filter((rt) => p.wiring.some((w) => w.linkId === rt.linkId));
    if (routes.length === p.wiring.length && routes.length) {
      const guides: { from: number[]; to: number[] }[] = [];
      const anchors: { id: string; p: number[] }[] = [];
      const accent = new Map<string, string[]>();
      for (const rt of routes) {
        const ba = scene.bodies.find((b) => b.path.join("/") === rt.a.path.join("/"));
        const bb = scene.bodies.find((b) => b.path.join("/") === rt.b.path.join("/"));
        if (!ba || !bb) continue;
        const pa = rt.a.frames.map((f) => worldFrame(ba.matrix, f.frame).origin);
        const pb = rt.b.frames.map((f) => worldFrame(bb.matrix, f.frame).origin);
        for (const q of pb) guides.push({ from: q, to: pa[0] });
        anchors.push({ id: `route:${rt.linkId}`, p: pb[Math.floor(pb.length / 2)] });
        accent.set(ba.key, [...(accent.get(ba.key) ?? []), ...(ba.def.interfaces.find((i) => i.id === rt.a.iface.id) ? [`${rt.a.iface.id}_pads`] : [])]);
        accent.set(bb.key, [...(accent.get(bb.key) ?? []), "lead_a", "lead_b", "lead_c"]);
      }
      const bodies = scene.bodies.filter((b) => before.has(b.key)).map((b) => renderBody(b, accent.has(b.key) ? "normal" : "context", { accentNodes: accent.get(b.key) ?? [] }));
      bodies.push(...scene.hardware.filter((h) => hwBefore.has(h.key)).map((h) => renderBody(h, "context")));
      const r = await env.r.render(`ag-step-${String(p.n).padStart(2, "0")}-${s.id}`, { width: 1900, height: 1000, mode: "lineart", bodies, guides, anchors, camera: { dir: s.camera?.dir ?? [0.35, -0.5, 1.4], margin: 0.08 } });
      const overlay = callouts(r, routes.map((rt) => ({ anchor: `route:${rt.linkId}`, label: (p.wiring.find((w) => w.linkId === rt.linkId)?.name ?? rt.linkId).replace(/^Motor /, "M"), accent: true })), W);
      fig = figure({ src: env.img(r.file), w: r.width, h: r.height, overlay, num: figNum(env), caption: "Each motor's three leads run to its ESC channel pads (accent); routes from the interfaces' geometry frames." });
    }
    const groups = wiringRows(ctx.sys.system, ctx.sys.lookup, p.wiring);
    const label = (path: string) => {
      const w = p.wiring.find((x) => parseEnd(x.a).path.split("/")[0] === path.split("/")[0]) ?? p.wiring[0];
      const prefix = w.linkId.includes("/") ? w.linkId.split("/").slice(0, -1) : [];
      let owner = ctx.sys.system;
      let name = path;
      for (const id of [...prefix, ...path.split("/")]) {
        const ref = owner.children?.find((c) => c.id === id);
        if (!ref) break;
        name = ref.name ?? ref.moduleDefId;
        const d = ctx.sys.lookup(ref.moduleDefId);
        if (!d) break;
        owner = d;
      }
      return name;
    };
    const diagrams = groups.map((g) => wiringDiagram({ aTitle: label(g.aPath), bTitle: label(g.bPath), aSub: shortName(g.a), bSub: shortName(g.b), rows: g.rows, harness: g.harness ? ctx.instances.get(g.harness)?.name ?? g.harness : undefined }));
    if (!fig) fig = `<figure class="block wiringfig">${diagrams.join("")}<figcaption><b>Figure ${figNum(env)}</b><span>Pad-to-pad connections from the stored links (wiringChecklist); crossovers in accent.</span></figcaption></figure>`;
  }

  // ---- actions (generated), per joint in stacking order: parts behind the structure face first, then outward
  const actions: string[] = jointActions(env, p);
  if (p.placed.length) for (const b of p.placed) actions.push(`Place the ${esc(shortName(b.def))} as shown. It has no mechanical interface in the model; the figure places it by ${esc(b.via?.replace(/^hint:/, "") ?? "a hint")}.`);
  for (const x of p.extras.filter((x) => !p.wiring.length)) actions.push(`Fit the ${esc(shortName(x.def))}.`);
  const wireTable: string[][] = [];
  for (const w of p.wiring) {
    const ea = parseEnd(w.a);
    const eb = parseEnd(w.b);
    const la = leafOf(ctx.sys.system, ctx.sys.lookup, ea.path, ea.iface);
    const lb = leafOf(ctx.sys.system, ctx.sys.lookup, eb.path, eb.iface);
    const conn = [la && connectorOf(la.def, la.iface.id), lb && connectorOf(lb.def, lb.iface.id)].filter(Boolean).join(" / ");
    const rows = w.connections.length ? w.connections : [{ from: `${w.a} ${la?.iface.pin ?? ""}`, to: `${w.b} ${lb?.iface.pin ?? ""}`, crossover: false }];
    const pads = (sel: (c: { from: string; to: string }) => string) => rows.map((c) => `<b>${esc(parseEnd(sel(c)).pad || parseEnd(sel(c)).iface)}</b>`).join(" · ");
    const cross = rows.some((c) => c.crossover);
    wireTable.push([
      `<b>${esc(w.name)}</b>`,
      `${esc(la ? instanceLabelOf(env, w, "a") : ea.path)}<br>${pads((c) => c.from)}`,
      `${esc(lb ? instanceLabelOf(env, w, "b") : eb.path)}<br>${pads((c) => c.to)}`,
      cross ? '<span class="x-flag">× crossover</span>' : "",
      esc(conn || w.protocol),
      `<span class="tag ${w.state === "configured" ? "ok" : "err"}">${esc(w.state)}</span>`,
    ]);
  }
  if (p.wiring.length) {
    const byH = groupBy(p.wiring, (w) => w.harness ?? "");
    for (const [h, ws] of byH) {
      const hdef = h ? ctx.instances.get(h) : undefined;
      actions.push(`${hdef ? `Using the ${esc(shortName(hdef))}, connect` : "Connect"} ${ws.map((w) => esc(w.name)).join(", ")} as in the table (${ws.reduce((s2, w) => s2 + Math.max(1, w.connections.length), 0)} connections).`);
    }
  }

  // ---- notes: doc spec + model usage notes of the step's harnesses and modules
  const notes: string[] = [];
  const fill = (t: string) => esc(t).replace(/\{\{([^|}]+)(?:\|([^}]+))?\}\}/g, (_m, q: string, f?: string) => doc.v(q.replace(/&quot;/g, '"').trim(), f?.trim()));
  for (const n of s.notes ?? []) notes.push(note(n.kind, fill(n.text)));
  const noteDefs = new Map<string, ModuleDef>();
  for (const h of new Set([...p.hardware.map((x) => x.harness!), ...p.wiring.map((w) => w.harness).filter(Boolean)] as string[])) {
    const d = ctx.instances.get(h);
    if (d) noteDefs.set(d.id, d);
  }
  for (const b of [...p.moving, ...p.placed]) noteDefs.set(b.def.id, b.def);
  for (const x of p.extras) noteDefs.set(x.def.id, x.def);
  for (const d of noteDefs.values()) {
    const un = (d.traits ?? []).filter((t) => t.type === "usage_note" && d.kind === "harness").slice(0, 1);
    for (const t of un) notes.push(note("info", `${esc(String(t.params?.note ?? ""))} <span class="muted small">— ${esc(d.id)}</span>`));
    const cooling = (d.traits ?? []).find((t) => t.type === "operating_conditions")?.params?.cooling;
    if (cooling) notes.push(note("caution", `${esc(String(cooling).split(". ").slice(0, 3).join(". "))}. <span class="muted small">— ${esc(d.id)}</span>`));
    const mounting = (d.domains?.find((x) => x.domain === "mechanical")?.metadata as any)?.mounting;
    if (mounting && !d.interfaces.some((i) => i.domain === "mechanical")) notes.push(note("info", `Mounting: ${esc(String(mounting))}. <span class="muted small">— ${esc(d.id)}</span>`));
  }

  // ---- parts strip
  const strip: string[] = [];
  for (const x of parts) {
    const th = await thumbnail(env, x.def);
    strip.push(`<div class="part">${th ? `<img src="${esc(env.img(th.file))}" alt="">` : `<span class="ph-s"></span>`}<div class="p-qty"><span class="letter${x.accent ? " acc" : ""}">${x.letter}</span>×${x.count}</div><div class="p-name">${esc(shortName(x.def))}</div></div>`);
  }
  const trace = [
    p.mates.length ? `mates: ${p.mates.map((m) => m.linkId).join(", ")}` : "",
    p.wiring.length ? `links: ${p.wiring.map((w) => w.linkId).join(", ")}` : "",
  ].filter(Boolean).join(" · ");
  const hasHw = p.hardware.length > 0;
  const attrs = `data-step="${esc(s.id)}" data-mates="${esc(p.mates.map((m) => m.linkId).join(" "))}" data-wiring="${esc(p.wiring.map((w) => w.linkId).join(" "))}" data-hardware="${esc(p.hardware.map((h) => h.key).join(" "))}"`;
  const blocks = [
    `<div class="step step-top block keep-next"${p.n === 1 ? ' data-break="before"' : ""} ${attrs}>
  <div class="step-head"><div class="step-no">${p.n}</div><h2 data-num="${String(p.n + 3).padStart(2, "0")}" data-toc="${esc(s.title)}">${esc(s.title)}</h2><div class="trace">${esc(trace)}</div></div>
  <div class="parts">${strip.join("")}</div>
  ${fig}</div>`,
    `<div class="step-cont block"><ol class="actions">${actions.map((a) => `<li>${a}</li>`).join("")}</ol></div>`,
    wireTable.length ? table([{ h: "Link" }, { h: "From" }, { h: "To" }, { h: "" }, { h: "Termination" }, { h: "DRC" }], wireTable, { cls: "dense wiretable split", caption: s.title }) : "",
    `<div class="step-cont block"><div class="step-meta">${hasHw ? `<span><b>Torque</b> <span class="v st-gap">—</span><sup class="mk mk-gap">—</sup> not in model</span>` : ""}<span><b>Step</b> ${p.n} of ${total}</span></div></div>`,
    ...notes.map((n, i) => `<div class="step-cont block${i === notes.length - 1 ? " step-end" : ""}">${n}</div>`),
  ];
  if (!notes.length) blocks[blocks.length - 1] = blocks[blocks.length - 1].replace('class="step-cont block"', 'class="step-cont block step-end"');
  return blocks.filter(Boolean).join("\n");
}

/**
 * Actions for the mates of a step. Mates sharing a structure interface form a
 * joint; identical joints (four motor mounts) are described once with "each".
 * Within a joint, hardware (fastenerStack) and mounted modules (mate gap) are
 * sorted by their position along the joint normal.
 */
function jointActions(env: BuildEnv, p: StepPlan): string[] {
  const { ctx, doc } = env;
  const scene = ctx.scene;
  const joints = groupBy(p.mates, (m) => {
    const { structure } = mateEnds(scene, m);
    return `${bodyKey(structure.path, structure.frame.artifact)}.${structure.iface.id}`;
  });
  const signature = (ms: MateEdge[]) => {
    const { structure } = mateEnds(scene, ms[0]);
    const movers = ms.map((m) => mateEnds(scene, m).moving.def.id).sort().join("+");
    const h = ms[0].harnessPath ? ctx.instances.get(ms[0].harnessPath.join("/"))?.id : "";
    return `${structure.def.id}|${structure.iface.protocols?.[0]?.type}|${structure.iface.parameters?.map((x) => x.value).join(",")}|${movers}|${h}`;
  };
  const groups = groupBy([...joints.values()], signature);
  const out: string[] = [];
  const lowerFirst = (x: string) => (/^[A-Z][a-z]/.test(x) ? x[0].toLowerCase() + x.slice(1) : x);
  const generic = (x: string) => lowerFirst(x.replace(/^(Front|Rear)-(left|right) /i, ""));
  for (const js of groups.values()) {
    const n = js.length;
    const ms = js[0];
    const { structure } = mateEnds(scene, ms[0]);
    const sName = esc(n > 1 ? generic(structure.iface.name ?? structure.iface.id) : lowerFirst(structure.iface.name ?? structure.iface.id));
    const sBody = scene.byKey.get(bodyKey(structure.path, structure.frame.artifact));
    const vertical = sBody ? Math.abs(worldFrame(sBody.matrix, structure.frame).normal[2]) > 0.7 : true;
    type Item = { pos: number; text: string };
    const items: Item[] = [];
    const rots = [...new Set(js.flatMap((j) => j.map((m) => m.mate?.rotationDeg).filter((x): x is number => Boolean(x))))];
    for (const m of ms) {
      const { moving } = mateEnds(scene, m);
      const gap = m.mate?.gapMm;
      const gapText = gap ? ` (${doc.v(`sys:system.links[id=${m.linkId}].mate.gapMm`, "u=mm")} gap)` : "";
      const rotText = rots.length && n > 1 ? ` (turned ${rots.map((r) => `${r}°`).join(" / ")} by corner, per the mates)` : "";
      items.push({ pos: gap ?? 0.001, text: `${gap ? "Lower" : "Seat"} ${n > 1 ? "a" : "the"} ${esc(shortName(moving.def))} onto ${n > 1 ? `each ${sName}` : `the ${sName}`}${gapText}${rotText}.` });
    }
    const hw = p.hardware.filter((h) => ms.some((m) => m.linkId === h.linkId));
    const hd = hw[0] && ctx.instances.get(hw[0].harness!);
    const through = new Set<string>();
    for (const it of hd?.fastenerStack ?? []) {
      const hs = hw.filter((h) => h.child === it.child);
      if (!hs.length) continue;
      const count = Math.round(hs.length / hd!.fastenerStack!.filter((x) => x.child === it.child).length);
      const def = hs[0].def;
      const name = `${count} × ${esc(shortName(def))}`;
      const kind = def.tags?.includes("screw") ? "screw" : def.tags?.includes("nut") ? "nut" : def.tags?.includes("standoff") ? "standoff" : "spacer";
      const dir = it.direction ?? 1;
      let text: string;
      if (kind === "screw" && it.atMm < 0 && dir > 0) {
        text = vertical ? `Insert ${name} from below, up through the ${sName}.` : `Insert ${name} through the ${sName} from one side.`;
        through.add("screw");
      } else if (kind === "screw" && dir < 0) text = vertical ? `Drive ${name} from above, head down.` : `Insert ${name} from the opposite side.`;
      else if (kind === "nut" && it.atMm < 0) text = `Hold ${name} under the ${sName}.`;
      else if (kind === "nut") text = `Finish with ${name}; tighten until snug.`;
      else if (kind === "spacer" || kind === "standoff") {
        const threaded = def.interfaces.some((i) => i.capabilities?.includes("internal_thread"));
        text = through.has("screw") ? (threaded ? `Thread ${name} onto the screws.` : `Slide ${name} over the screws.`) : `Fit ${name} on the ${sName}.`;
      }
      else text = `Fit ${name}.`;
      items.push({ pos: it.atMm, text });
    }
    const below = items.filter((i) => i.pos < 0).sort((a, b) => b.pos - a.pos);
    const above = items.filter((i) => i.pos >= 0).sort((a, b) => a.pos - b.pos);
    const seq = [...below, ...above].map((i) => i.text);
    if (n > 1 && seq.length) seq[seq.length - 1] += ` Repeat on all ${n}.`;
    out.push(...seq);
  }
  return out;
}

/** Instance label for one end of a wiring step ("Flight controller", "ELRS receiver"). */
function instanceLabelOf(env: BuildEnv, w: WiringStep, end: "a" | "b"): string {
  const e = parseEnd(end === "a" ? w.a : w.b);
  const prefix = w.linkId.includes("/") ? w.linkId.split("/").slice(0, -1) : [];
  const leaf = leafOf(env.ctx.sys.system, env.ctx.sys.lookup, e.path, e.iface);
  const path = [...prefix, ...(leaf?.path ?? e.path.split("/"))];
  let owner = env.ctx.sys.system;
  let name = path.join("/");
  for (const id of path) {
    const ref = owner.children?.find((c) => c.id === id);
    if (!ref) break;
    name = ref.name ?? ref.moduleDefId;
    const d = env.ctx.sys.lookup(ref.moduleDefId);
    if (!d) break;
    owner = d;
  }
  return name;
}

function centerOf(b: SceneBody, off?: number[]): number[] {
  const t = matTranslation(b.matrix);
  const d = b.def.domains?.find((x) => x.domain === "mechanical")?.dimensions_mm;
  const lift = b.category === "screw" || b.category === "nut" || b.category === "spacer" || b.category === "standoff" ? 0 : Math.min(8, (d?.height ?? 0) / 2);
  const o = off ?? [0, 0, 0];
  return [t[0] + o[0], t[1] + o[1], t[2] + o[2] + lift];
}

/** One-hole section of a fastener harness: structure face at 0, parts at their atMm, mounted modules at their gaps. Fixed scale across harnesses. */
function stackDiagram(env: BuildEnv, hdef: ModuleDef, items: SceneBody[]): string {
  const { ctx } = env;
  const len = (d: ModuleDef) => d.interfaces.map((i) => i.parameters?.find((x) => x.id === "length")?.value).find((v) => v !== undefined) as number | undefined;
  const dia = (d: ModuleDef) => d.interfaces.map((i) => i.parameters?.find((x) => x.id === "fastener_diameter")?.value).find((v) => v !== undefined) as number | undefined;
  const linkIds = [...new Set(items.map((h) => h.linkId!))];
  const mates = ctx.scene.assembly.mates.filter((m) => linkIds.includes(m.linkId));
  type El = { kind: string; name: string; from: number; to: number; w: number };
  const els: El[] = [];
  for (const it of hdef.fastenerStack ?? []) {
    const ref = hdef.children?.find((c) => c.id === it.child);
    const d = ref && ctx.sys.lookup(ref.moduleDefId);
    if (!d) continue;
    const L = len(d) ?? 2;
    const dir = it.direction ?? 1;
    const md = d.domains?.find((x) => x.domain === "mechanical")?.metadata as any;
    const kind = d.tags?.includes("screw") ? "screw" : d.tags?.includes("nut") ? "nut" : d.tags?.includes("standoff") ? "standoff" : "spacer";
    const w = kind === "screw" ? dia(d) ?? 3 : md?.outer_mm ?? (dia(d) ?? 3) * 2;
    if (kind === "screw") {
      const hk = md?.head_height_mm ?? 2;
      const hd = md?.head_diameter_mm ?? (dia(d) ?? 3) * 1.8;
      els.push({ kind: "shaft", name: "", from: Math.min(it.atMm, it.atMm + dir * L), to: Math.max(it.atMm, it.atMm + dir * L), w });
      els.push({ kind: "head", name: shortName(d), from: dir > 0 ? it.atMm - hk : it.atMm, to: dir > 0 ? it.atMm : it.atMm + hk, w: hd });
    } else els.push({ kind, name: shortName(d), from: Math.min(it.atMm, it.atMm + dir * L), to: Math.max(it.atMm, it.atMm + dir * L), w });
  }
  const mounted = mates.map((m) => {
    const { moving } = mateEnds(ctx.scene, m);
    return { name: shortName(moving.def), at: m.mate?.gapMm ?? 0 };
  });
  // structure thickness: the part nearest behind the face sits on its far side (screw head, nut)
  const behind = (hdef.fastenerStack ?? []).filter((x) => x.atMm < 0).map((x) => -x.atMm);
  const plateT = behind.length ? Math.min(...behind) : 0;
  const lo = Math.min(...els.map((e) => e.from), -plateT) - 1;
  const hi = Math.max(...els.map((e) => e.to), ...mounted.map((m) => m.at + 1.6)) + 1;
  const k = 2.5; // units per mm, same for every harness
  const y = (v: number) => 6 + (hi - v) * k;
  const cx = 44;
  const colX = 100;
  const H = y(lo) + 6;
  const parts: string[] = [];
  parts.push(`<rect x="8" y="${y(0)}" width="${cx * 2 - 16}" height="${Math.max(1.5, plateT * k)}" fill="#cfcfd1" stroke="#1b1b1b" stroke-width="0.6"/>`);
  const labels: { y: number; ty: number; x0: number; text: string; sub: string; accent: boolean }[] = [];
  labels.push({ y: y(-plateT / 2), ty: 0, x0: cx * 2 - 8, text: "structure", sub: plateT ? `${plateT} mm` : "face", accent: false });
  for (const m of mounted) {
    parts.push(`<rect x="12" y="${y(m.at + 1.6)}" width="${cx * 2 - 24}" height="${1.6 * k}" fill="#dfe8f2" stroke="#1b1b1b" stroke-width="0.6"/>`);
    labels.push({ y: y(m.at + 0.8), ty: 0, x0: cx * 2 - 12, text: m.name, sub: `at ${m.at} mm`, accent: false });
  }
  for (const e of els) {
    const fill = e.kind === "spacer" ? "#ffffff" : e.kind === "standoff" ? "#e6ebf1" : "#ffc9a3";
    const stroke = e.kind === "shaft" || e.kind === "head" || e.kind === "nut" ? "#d24a00" : "#1b1b1b";
    parts.push(`<rect x="${cx - (e.w * k) / 2}" y="${y(e.to)}" width="${e.w * k}" height="${(e.to - e.from) * k}" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/>`);
    if (e.name) labels.push({ y: y((e.from + e.to) / 2), ty: 0, x0: cx + (e.w * k) / 2, text: e.name, sub: `${e.from}…${e.to} mm`, accent: e.kind !== "spacer" && e.kind !== "standoff" });
  }
  // label column, spread so they never overlap
  labels.sort((a, b) => a.y - b.y);
  labels.forEach((l, i) => (l.ty = Math.max(l.y, i ? labels[i - 1].ty + 14 : 8)));
  const height = Math.max(H, (labels.at(-1)?.ty ?? 0) + 12);
  for (const l of labels) {
    parts.push(`<polyline points="${l.x0},${l.y} ${colX - 6},${l.y} ${colX - 2},${l.ty}" fill="none" stroke="#a3a3a3" stroke-width="0.4"/>`);
    parts.push(`<text x="${colX}" y="${l.ty + 2}" font-size="7" fill="${l.accent ? "#d24a00" : "#1b1b1b"}" font-weight="600">${esc(l.text.length > 34 ? l.text.slice(0, 33) + "…" : l.text)}</text>`);
    parts.push(`<text x="${colX}" y="${l.ty + 9}" font-size="5.8" fill="#6f6f6f">${esc(l.sub)}</text>`);
  }
  return `<div class="stackfig"><div class="st-title">${esc(hdef.name)} <span class="muted small">${esc(hdef.id)}</span></div><svg viewBox="0 0 240 ${height}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="inherit">${parts.join("")}</svg></div>`;
}

/** Coverage appendix: every mate, hardware placement and wiring link, and the step that covers it. */
export function assemblyProvenance(env: BuildEnv): string {
  const { ctx } = env;
  const plans = planSteps(env);
  const stepOf = (pred: (p: StepPlan) => boolean) => {
    const p = plans.find(pred);
    return p ? `${p.n} · ${esc(p.spec.title)}` : '<span class="x-flag">not covered</span>';
  };
  const mateRows = ctx.scene.assembly.mates.map((m) => [`<code>${esc(m.linkId)}</code>`, esc(`${m.a.path.join("/")}.${m.a.iface.id} ↔ ${m.b.path.join("/")}.${m.b.iface.id}`), esc(m.harness ?? "—"), stepOf((p) => p.mates.includes(m))]);
  const hwGroups = groupBy(ctx.scene.hardware, (h) => `${h.harness}/${h.child}`);
  const hwRows = [...hwGroups.entries()].map(([k, hs]) => [`<code>${esc(k)}</code>`, `${hs.length} × ${esc(shortName(hs[0].def))}`, `<code>${esc(hs[0].linkId ?? "")}</code>`, stepOf((p) => hs.every((h) => p.hardware.includes(h)))]);
  const wRows = ctx.wiring.filter((w) => w.domain !== "mechanical").map((w) => [`<code>${esc(w.linkId)}</code>`, esc(w.name), esc(w.harness ?? "—"), stepOf((p) => p.wiring.includes(w))]);
  return `${sec(String(plans.length + 4).padStart(2, "0"), "Coverage", "assemble() · wiringChecklist", ' data-break="before"')}
  <p class="prose">Every rigid mate, every hardware placement and every electrical link in the model, and the step that covers it. The verifier fails the guide if any row is not covered.</p>
  ${sub("Mates")}${table([{ h: "Mate" }, { h: "Interfaces" }, { h: "Harness" }, { h: "Step" }], mateRows, { split: true, caption: "Mates", cls: "dense covtable" })}
  ${sub("Hardware placements")}${table([{ h: "Harness / child" }, { h: "Parts" }, { h: "Joint" }, { h: "Step" }], hwRows, { split: true, caption: "Hardware", cls: "dense covtable" })}
  ${sub("Wiring links")}${table([{ h: "Link" }, { h: "Name" }, { h: "Harness" }, { h: "Step" }], wRows, { split: true, caption: "Wiring", cls: "dense covtable" })}`;
}

export type { HardwarePlacement };
