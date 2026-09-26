/**
 * Shared document blocks: headings, tables, figures with vector callouts,
 * admonitions, and the 2D pad-to-pad wiring diagram.
 */
import { relative } from "path";
import type { ModuleDef } from "../../../src/types/index.js";
import { resolveLeafEndpoint } from "../../../src/system/geometry.js";
import type { WiringStep } from "../../../src/system/wiring.js";
import { esc } from "./html.js";
import type { RenderResult } from "./render/renderer.js";

export const sec = (num: string, title: string, aside = "", attrs = "") =>
  `<h1 class="sec" data-num="${esc(num)}" data-toc="${esc(title)}"${attrs}><span class="num">${esc(num)}</span>${esc(title)}${aside ? `<span class="aside">${aside}</span>` : ""}</h1>`;

export const sub = (title: string) => `<h2 class="sub">${esc(title)}</h2>`;

export interface Col {
  h: string;
  cls?: string;
}

export function table(cols: Col[], rows: (string | { group: string })[][] | string[][], opts: { cls?: string; split?: boolean; caption?: string; foot?: string } = {}): string {
  const head = `<thead><tr>${cols.map((c) => `<th class="${c.cls ?? ""}">${c.h}</th>`).join("")}</tr></thead>`;
  const body = (rows as any[])
    .map((r) => {
      if (!Array.isArray(r) && r.group) return `<tr class="group"><td colspan="${cols.length}">${esc(r.group)}</td></tr>`;
      return `<tr>${(r as string[]).map((c, i) => `<td class="${cols[i]?.cls ?? ""}">${c}</td>`).join("")}</tr>`;
    })
    .join("");
  const cls = [opts.cls, opts.split ? "split" : ""].filter(Boolean).join(" ");
  return `<div class="tblock block"><div class="cont-note">${esc(opts.caption ?? "")} (continued)</div><table class="${cls}">${head}<tbody>${body}</tbody></table>${opts.foot ? `<div class="fn">${opts.foot}</div>` : ""}</div>`;
}

export const groupRow = (group: string) => ({ group });

/** Image path relative to the document. */
export const rel = (docDir: string, file: string) => relative(docDir, file);

export function figure(o: { src: string; w: number; h: number; overlay?: string; caption?: string; num?: string; unit?: string; cls?: string; maxHeightMm?: number; widthPct?: number }): string {
  const style = o.widthPct ? ` style="width:${o.widthPct}%;margin:0 auto"` : "";
  return `<figure class="block ${o.cls ?? ""}"><div class="figwrap"${style}><img src="${esc(o.src)}" width="${o.w}" height="${o.h}" alt="${esc(o.caption ?? "")}">${
    o.overlay ? `<svg class="overlay" viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="none">${o.overlay}</svg>` : ""
  }</div>${o.caption ? `<figcaption>${o.num ? `<b>Figure ${esc(o.num)}</b>` : ""}<span>${o.caption}</span>${o.unit ? `<span class="unit">(unit: ${esc(o.unit)})</span>` : ""}</figcaption>` : ""}</figure>`;
}

export interface CalloutItem {
  anchor: string;
  label: string;
  accent?: boolean;
  /** Text beside the bubble (named label); omit for number-only bubbles. */
  text?: string;
}

/**
 * Callout bubbles in columns at the figure's left and right edges, straight
 * 0.5 pt leaders ending in a dot on the part. Sizes are in figure pixels,
 * scaled from millimetres of the printed figure width.
 */
export function callouts(fig: RenderResult, items: CalloutItem[], displayWidthMm: number, opts: { edge?: number; side?: "auto" | "left" | "right" } = {}): string {
  const k = fig.width / displayWidthMm; // px per printed mm
  const R = 2.25 * k;
  const edge = (opts.edge ?? 3) * k + R;
  const placed = items
    .map((it) => ({ it, a: fig.anchors[it.anchor] }))
    .filter((x) => x.a)
    .map((x) => ({ ...x, side: opts.side && opts.side !== "auto" ? opts.side : x.a.x < fig.width / 2 ? "left" : "right" }));
  const out: string[] = [];
  for (const side of ["left", "right"] as const) {
    const col = placed.filter((p) => p.side === side).sort((a, b) => a.a.y - b.a.y);
    const gap = 2.9 * R;
    const ys = col.map((p) => Math.min(Math.max(p.a.y, R + 2), fig.height - R - 2));
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < gap) ys[i] = ys[i - 1] + gap;
    const over = ys.length ? ys[ys.length - 1] - (fig.height - R - 2) : 0;
    if (over > 0) for (let i = 0; i < ys.length; i++) ys[i] -= over;
    col.forEach((p, i) => {
      const bx = side === "left" ? edge : fig.width - edge;
      const by = ys[i];
      const dx = p.a.x - bx;
      const dy = p.a.y - by;
      const len = Math.hypot(dx, dy) || 1;
      const sx = bx + (dx / len) * R;
      const sy = by + (dy / len) * R;
      out.push(`<line class="co-leader" x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${p.a.x.toFixed(1)}" y2="${p.a.y.toFixed(1)}" stroke-width="${(0.18 * k).toFixed(2)}"/>`);
      out.push(`<circle class="co-dot" cx="${p.a.x.toFixed(1)}" cy="${p.a.y.toFixed(1)}" r="${(0.55 * k).toFixed(1)}"/>`);
      out.push(`<circle class="co-bubble${p.it.accent ? " acc" : ""}" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${R.toFixed(1)}" stroke-width="${(0.18 * k).toFixed(2)}"/>`);
      out.push(`<text class="co-num${p.it.accent ? " acc" : ""}" x="${bx.toFixed(1)}" y="${(by + 0.95 * k).toFixed(1)}" text-anchor="middle" font-size="${(2.6 * k).toFixed(1)}">${esc(p.it.label)}</text>`);
      if (p.it.text) {
        const tx = side === "left" ? bx + R + 1.2 * k : bx - R - 1.2 * k;
        out.push(`<text class="co-label" x="${tx.toFixed(1)}" y="${(by - 1.4 * k).toFixed(1)}" text-anchor="${side === "left" ? "start" : "end"}" font-size="${(2.3 * k).toFixed(1)}">${esc(p.it.text)}</text>`);
      }
    });
  }
  return out.join("");
}

/** A dimension line between two anchors, offset perpendicular by `offsetMm` (printed mm), label bound to a query. */
export function dimension(fig: RenderResult, a: string, b: string, labelSvg: (x: number, y: number, size: number, rot: number) => string, displayWidthMm: number, offsetMm = 6): string {
  const A = fig.anchors[a];
  const B = fig.anchors[b];
  if (!A || !B) return "";
  const k = fig.width / displayWidthMm;
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const o = offsetMm * k;
  const a2 = { x: A.x + nx * o, y: A.y + ny * o };
  const b2 = { x: B.x + nx * o, y: B.y + ny * o };
  const sw = (0.15 * k).toFixed(2);
  const arrow = (p: { x: number; y: number }, dir: number) => {
    const ux = (dx / len) * dir;
    const uy = (dy / len) * dir;
    const s = 1.6 * k;
    const w = 0.55 * k;
    return `<path d="M${p.x},${p.y} L${p.x + ux * s - uy * w},${p.y + uy * s + ux * w} L${p.x + ux * s + uy * w},${p.y + uy * s - ux * w} Z" fill="#d94e00"/>`;
  };
  let rot = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (rot > 90) rot -= 180;
  if (rot < -90) rot += 180;
  const mx = (a2.x + b2.x) / 2 + nx * 1.4 * k;
  const my = (a2.y + b2.y) / 2 + ny * 1.4 * k;
  return [
    `<line x1="${A.x}" y1="${A.y}" x2="${a2.x + nx * 1.2 * k}" y2="${a2.y + ny * 1.2 * k}" stroke="#d94e00" stroke-width="${sw}"/>`,
    `<line x1="${B.x}" y1="${B.y}" x2="${b2.x + nx * 1.2 * k}" y2="${b2.y + ny * 1.2 * k}" stroke="#d94e00" stroke-width="${sw}"/>`,
    `<line x1="${a2.x}" y1="${a2.y}" x2="${b2.x}" y2="${b2.y}" stroke="#d94e00" stroke-width="${sw}"/>`,
    arrow(a2, 1),
    arrow(b2, -1),
    labelSvg(mx, my, 2.5 * k, rot),
  ].join("");
}

// ---------------------------------------------------------------------------
// Admonitions
// ---------------------------------------------------------------------------

const ICON = {
  warning: `<svg viewBox="0 0 24 24"><path d="M12 2.5 1.8 21h20.4L12 2.5z" fill="none" stroke="#c62828" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v5.5" stroke="#c62828" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.2" fill="#c62828"/></svg>`,
  caution: `<svg viewBox="0 0 24 24"><path d="M12 2.5 1.8 21h20.4L12 2.5z" fill="none" stroke="#d94e00" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v5.5" stroke="#d94e00" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.2" fill="#d94e00"/></svg>`,
  tip: `<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="6.2" fill="none" stroke="#1b1b1b" stroke-width="1.7"/><path d="M9.3 17.5h5.4M10 21h4" stroke="#1b1b1b" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  info: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="#1b1b1b" stroke-width="1.7"/><path d="M12 10.5V17" stroke="#1b1b1b" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.4" r="1.2" fill="#1b1b1b"/></svg>`,
};
const NOTE_LABEL = { warning: "WARNING", caution: "CAUTION", tip: "TIP", info: "NOTE" };

export function note(kind: keyof typeof ICON, html: string): string {
  return `<div class="note ${kind}">${ICON[kind]}<div><b>${NOTE_LABEL[kind]}</b> ${html}</div></div>`;
}

// ---------------------------------------------------------------------------
// Wiring diagram (pad to pad), for links without 3D geometry
// ---------------------------------------------------------------------------

export interface WireEnd {
  module: string;
  pad: string;
  detail: string;
}

/** Split "stack:uart1 TX1" into module path, interface and pad label. */
export function parseEnd(s: string): { path: string; iface: string; pad: string } {
  const sp = s.indexOf(" ");
  const head = sp < 0 ? s : s.slice(0, sp);
  const pad = sp < 0 ? "" : s.slice(sp + 1);
  const c = head.lastIndexOf(":");
  return { path: head.slice(0, c), iface: head.slice(c + 1), pad };
}

/** Leaf module and pad label for a wiring end (follows exports through assemblies). */
export function leafOf(system: ModuleDef, lookup: (id: string) => ModuleDef | undefined, path: string, iface: string) {
  const segs = path.split("/");
  let owner = system;
  for (const s of segs.slice(0, -1)) {
    const ref = owner.children?.find((c) => c.id === s);
    const d = ref && lookup(ref.moduleDefId);
    if (!d) break;
    owner = d;
  }
  const leaf = resolveLeafEndpoint(owner, { child: segs[segs.length - 1], interfaceId: iface }, lookup);
  return leaf;
}

export interface WireRow {
  a: string;
  b: string;
  aDetail?: string;
  bDetail?: string;
  crossover?: boolean;
  signal: string;
}

/** Two module columns with pad rows and straight wires; crossovers in accent. */
export function wiringDiagram(o: { aTitle: string; bTitle: string; aSub?: string; bSub?: string; rows: WireRow[]; harness?: string }): string {
  const W = 520;
  const rowH = 17;
  const head = 30;
  const top = 8 + head + 6;
  const H = top + o.rows.length * rowH + 18;
  const boxW = 176;
  const ax = 2;
  const bx = W - 2 - boxW;
  const parts: string[] = [];
  const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
  const box = (x: number, title: string, subt?: string) =>
    `<rect x="${x}" y="8" width="${boxW}" height="${H - 20}" fill="#fff" stroke="#1b1b1b" stroke-width="0.8"/>` +
    `<rect x="${x}" y="8" width="${boxW}" height="${head}" fill="#1b1b1b"/>` +
    `<text x="${x + 8}" y="22" font-size="9" font-weight="600" fill="#fff">${esc(clip(title, 30))}</text>` +
    (subt ? `<text x="${x + 8}" y="33" font-size="6.4" fill="#bdbdbd">${esc(clip(subt, 44))}</text>` : "");
  parts.push(box(ax, o.aTitle, o.aSub), box(bx, o.bTitle, o.bSub));
  o.rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    const col = r.crossover ? "#ff5c00" : "#1b1b1b";
    parts.push(`<rect x="${ax + boxW - 8}" y="${y - 3.5}" width="8" height="7" fill="${col}"/>`);
    parts.push(`<rect x="${bx}" y="${y - 3.5}" width="8" height="7" fill="${col}"/>`);
    parts.push(`<text x="${ax + boxW - 13}" y="${y + 3}" font-size="8" font-weight="600" text-anchor="end" fill="#1b1b1b">${esc(r.a)}</text>`);
    if (r.aDetail) parts.push(`<text x="${ax + 8}" y="${y + 3}" font-size="6.4" fill="#6f6f6f">${esc(clip(r.aDetail, 30))}</text>`);
    parts.push(`<text x="${bx + 13}" y="${y + 3}" font-size="8" font-weight="600" fill="#1b1b1b">${esc(r.b)}</text>`);
    if (r.bDetail) parts.push(`<text x="${bx + boxW - 8}" y="${y + 3}" font-size="6.4" text-anchor="end" fill="#6f6f6f">${esc(clip(r.bDetail, 30))}</text>`);
    parts.push(`<line x1="${ax + boxW}" y1="${y}" x2="${bx}" y2="${y}" stroke="${col}" stroke-width="${r.crossover ? 1.6 : 1.2}"/>`);
    parts.push(`<text x="${W / 2}" y="${y - 3}" font-size="6.4" text-anchor="middle" fill="${r.crossover ? "#d94e00" : "#6f6f6f"}">${esc(r.signal)}${r.crossover ? " · crossover" : ""}</text>`);
  });
  if (o.harness) parts.push(`<text x="${W / 2}" y="${H - 4}" font-size="6.6" text-anchor="middle" fill="#6f6f6f">via ${esc(o.harness)}</text>`);
  return `<svg class="wiring" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="inherit">${parts.join("")}</svg>`;
}

export function wiringRows(system: ModuleDef, lookup: (id: string) => ModuleDef | undefined, steps: WiringStep[]) {
  // group by the pair of leaf modules
  const groups = new Map<string, { a: ModuleDef; b: ModuleDef; aPath: string; bPath: string; rows: WireRow[]; harness?: string; links: string[] }>();
  for (const s of steps) {
    const ea = parseEnd(s.a);
    const eb = parseEnd(s.b);
    const la = leafOf(system, lookup, ea.path, ea.iface);
    const lb = leafOf(system, lookup, eb.path, eb.iface);
    if (!la || !lb) continue;
    const key = `${la.path.join("/")}|${lb.path.join("/")}`;
    const g = groups.get(key) ?? { a: la.def, b: lb.def, aPath: la.path.join("/"), bPath: lb.path.join("/"), rows: [], harness: s.harness, links: [] };
    g.links.push(s.linkId);
    if (s.connections.length) {
      for (const c of s.connections) {
        const pa = parseEnd(c.from);
        const pb = parseEnd(c.to);
        g.rows.push({ a: pa.pad || pa.iface, b: pb.pad || pb.iface, signal: s.name, crossover: c.crossover, aDetail: la.iface.name, bDetail: lb.iface.name });
      }
    } else {
      g.rows.push({ a: String(la.iface.pin ?? la.iface.id), b: String(lb.iface.pin ?? lb.iface.id), signal: s.name, aDetail: la.iface.name, bDetail: lb.iface.name });
    }
    groups.set(key, g);
  }
  return [...groups.values()];
}
