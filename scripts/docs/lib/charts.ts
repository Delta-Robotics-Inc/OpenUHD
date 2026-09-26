/**
 * Print charts as inline SVG: hairline grid, direct labels, one accent
 * series, greys for context. Data drawn from test-data files carries the
 * file's status; stand-in data is watermarked "STAND-IN DATA — not measured".
 */
import { formatNumber } from "./format.js";
import { esc } from "./html.js";

export const INK = "#1b1b1b";
export const MUTED = "#6f6f6f";
export const GRID = "#e4e4e4";
export const ACCENT = "#ff5c00";
export const SERIES = [ACCENT, "#1b1b1b", "#8c8c8c", "#c46a2c", "#4a6fa5"];

export interface Axis {
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  ticks?: number;
}

export interface Series {
  label: string;
  points: [number, number][];
  color?: string;
  dashed?: boolean;
  markers?: boolean;
  /** Draw only markers (measured/source points). */
  markersOnly?: boolean;
  axis?: "y" | "y2";
  /** Label placed at the last point (direct labelling). */
  endLabel?: boolean;
}

export interface ChartBase {
  width?: number;
  height?: number;
  /** "standin" | "measured" | "source" | "derived" — standin draws the watermark. */
  status?: string;
  /** Test id(s) the chart draws, for the verifier. */
  testIds?: string[];
  title?: string;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 0.5) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

const axisTitle = (a: Axis) => esc(a.unit ? `${a.label} (${a.unit})` : a.label);

function watermark(w: number, h: number, status?: string): string {
  if (status !== "standin") return "";
  const cx = w / 2;
  const cy = h / 2;
  return `<g class="standin-mark" pointer-events="none">
    <text x="${cx}" y="${cy}" transform="rotate(-18 ${cx} ${cy})" text-anchor="middle" dominant-baseline="middle"
      font-size="${Math.min(22, w / 22)}" font-weight="700" fill="${ACCENT}" fill-opacity="0.13" letter-spacing="1.5">STAND-IN DATA — NOT MEASURED</text>
    <rect x="${w / 2 - 58}" y="1" width="116" height="14" rx="2" fill="#fff" stroke="${ACCENT}" stroke-width="0.8"/>
    <text x="${w / 2}" y="10.8" text-anchor="middle" font-size="7.2" font-weight="700" fill="${ACCENT}" letter-spacing="0.6">STAND-IN · NOT MEASURED</text>
  </g>`;
}

function frame(w: number, h: number, body: string, base: ChartBase): string {
  const data = base.testIds?.length ? ` data-test="${esc(base.testIds.join(" "))}"` : "";
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" data-status="${esc(base.status ?? "source")}"${data} xmlns="http://www.w3.org/2000/svg" font-family="inherit">${body}${watermark(w, h, base.status)}</svg>`;
}

export function lineChart(o: ChartBase & { x: Axis; y: Axis; y2?: Axis; series: Series[]; legend?: boolean; annotations?: { x: number; y: number; label: string; axis?: "y" | "y2" }[] }): string {
  const W = o.width ?? 330;
  const H = o.height ?? 190;
  const m = { l: 40, r: o.y2 ? 40 : 14, t: 20, b: o.legend ? 44 : 32 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const all = (ax: "y" | "y2") => o.series.filter((s) => (s.axis ?? "y") === ax).flatMap((s) => s.points);
  const xs = o.series.flatMap((s) => s.points.map((p) => p[0]));
  const xmin = o.x.min ?? Math.min(...xs);
  const xmax = o.x.max ?? Math.max(...xs);
  const range = (a: Axis, pts: [number, number][]) => [a.min ?? Math.min(0, ...pts.map((p) => p[1])), a.max ?? niceMax(Math.max(...pts.map((p) => p[1])))];
  const [ymin, ymax] = range(o.y, all("y"));
  const [y2min, y2max] = o.y2 ? range(o.y2, all("y2")) : [0, 1];
  const sx = (v: number) => m.l + ((v - xmin) / (xmax - xmin || 1)) * pw;
  const sy = (v: number, ax: "y" | "y2" = "y") => {
    const [a, b] = ax === "y" ? [ymin, ymax] : [y2min, y2max];
    return m.t + ph - ((v - a) / (b - a || 1)) * ph;
  };
  const parts: string[] = [];
  // grid + ticks
  for (const t of niceTicks(ymin, ymax, o.y.ticks ?? 5)) {
    parts.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${sy(t)}" y2="${sy(t)}" stroke="${GRID}" stroke-width="0.5"/>`);
    parts.push(`<text x="${m.l - 5}" y="${sy(t) + 2.6}" text-anchor="end" font-size="7" fill="${MUTED}">${formatNumber(t)}</text>`);
  }
  if (o.y2) {
    for (const t of niceTicks(y2min, y2max, o.y2.ticks ?? 5)) {
      parts.push(`<text x="${m.l + pw + 5}" y="${sy(t, "y2") + 2.6}" font-size="7" fill="${MUTED}">${formatNumber(t)}</text>`);
    }
  }
  for (const t of niceTicks(xmin, xmax, o.x.ticks ?? 6)) {
    parts.push(`<line x1="${sx(t)}" x2="${sx(t)}" y1="${m.t + ph}" y2="${m.t + ph + 3}" stroke="${MUTED}" stroke-width="0.5"/>`);
    parts.push(`<text x="${sx(t)}" y="${m.t + ph + 12}" text-anchor="middle" font-size="7" fill="${MUTED}">${formatNumber(t)}</text>`);
  }
  parts.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${m.t + ph}" y2="${m.t + ph}" stroke="${INK}" stroke-width="0.7"/>`);
  parts.push(`<text x="${m.l + pw / 2}" y="${m.t + ph + 24}" text-anchor="middle" font-size="7.2" fill="${INK}">${axisTitle(o.x)}</text>`);
  parts.push(`<text x="${m.l - 34}" y="${m.t - 8}" font-size="7.2" fill="${INK}">${axisTitle(o.y)}</text>`);
  if (o.y2) parts.push(`<text x="${m.l + pw + 34}" y="${m.t - 8}" text-anchor="end" font-size="7.2" fill="${INK}">${axisTitle(o.y2)}</text>`);
  // series
  const labels: { x: number; y: number; anchor: string; color: string; text: string }[] = [];
  o.series.forEach((s, i) => {
    const color = s.color ?? SERIES[i % SERIES.length];
    const ax = s.axis ?? "y";
    const pts = s.points.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y, ax).toFixed(1)}`);
    if (!s.markersOnly && pts.length > 1) {
      parts.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="${i === 0 ? 1.6 : 1.2}" stroke-linejoin="round"${s.dashed ? ' stroke-dasharray="4 2.5"' : ""}/>`);
    }
    if (s.markers || s.markersOnly) {
      for (const [x, y] of s.points) parts.push(`<circle cx="${sx(x)}" cy="${sy(y, ax)}" r="2.4" fill="#fff" stroke="${color}" stroke-width="1.2"/>`);
    }
    if (!o.legend && s.endLabel !== false && s.points.length && s.label) {
      const [x, y] = s.points[s.points.length - 1];
      const px = sx(x);
      const anchorEnd = px > m.l + pw - 60;
      labels.push({ x: anchorEnd ? px - 4 : px + 4, y: sy(y, ax) - 5, anchor: anchorEnd ? "end" : "start", color, text: s.label });
    }
  });
  if (o.legend) {
    let lx = m.l;
    o.series.forEach((s, i) => {
      if (!s.label) return;
      const color = s.color ?? SERIES[i % SERIES.length];
      const y = H - 5;
      parts.push(s.markersOnly ? `<circle cx="${lx + 5}" cy="${y - 2.5}" r="2.4" fill="#fff" stroke="${color}" stroke-width="1.2"/>` : `<line x1="${lx}" x2="${lx + 12}" y1="${y - 2.5}" y2="${y - 2.5}" stroke="${color}" stroke-width="1.6"${s.dashed ? ' stroke-dasharray="4 2.5"' : ""}/>`);
      parts.push(`<text x="${lx + 16}" y="${y}" font-size="6.8" fill="${INK}">${esc(s.label)}</text>`);
      lx += 26 + s.label.length * 4.3;
    });
  }
  // direct labels, pushed apart vertically so they never overlap
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 9) labels[i].y = labels[i - 1].y + 9;
  for (const l of labels) parts.push(`<text x="${l.x}" y="${l.y}" text-anchor="${l.anchor}" font-size="7" font-weight="600" fill="${l.color}">${esc(l.text)}</text>`);
  for (const a of o.annotations ?? []) {
    const x = sx(a.x);
    const y = sy(a.y, a.axis ?? "y");
    parts.push(`<circle cx="${x}" cy="${y}" r="2" fill="${INK}"/><text x="${x + 5}" y="${y + 10}" font-size="6.8" fill="${INK}">${esc(a.label)}</text>`);
  }
  return frame(W, H, parts.join(""), o);
}

export function barChart(
  o: ChartBase & {
    categories: string[];
    series: { label: string; values: number[]; color?: string }[];
    y: Axis;
    stacked?: boolean;
    /** Horizontal reference lines, e.g. a rating. */
    refs?: { value: number; label: string }[];
    valueLabels?: boolean;
    decimals?: number;
  },
): string {
  const W = o.width ?? 330;
  const H = o.height ?? 190;
  const legendH = o.series.length > 1 ? 14 : 0;
  const m = { l: 40, r: 12, t: 20 + legendH, b: 34 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const totals = o.categories.map((_, i) => (o.stacked ? o.series.reduce((s, x) => s + x.values[i], 0) : Math.max(...o.series.map((x) => x.values[i]))));
  const ymax = o.y.max ?? niceMax(Math.max(...totals, ...(o.refs ?? []).map((r) => r.value)) * 1.08);
  const sy = (v: number) => m.t + ph - (v / ymax) * ph;
  const band = pw / o.categories.length;
  const bw = o.stacked ? Math.min(34, band * 0.55) : Math.min(22, (band * 0.7) / o.series.length);
  const parts: string[] = [];
  for (const t of niceTicks(0, ymax, o.y.ticks ?? 5)) {
    parts.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${sy(t)}" y2="${sy(t)}" stroke="${GRID}" stroke-width="0.5"/>`);
    parts.push(`<text x="${m.l - 5}" y="${sy(t) + 2.6}" text-anchor="end" font-size="7" fill="${MUTED}">${formatNumber(t)}</text>`);
  }
  o.categories.forEach((c, i) => {
    const cx = m.l + band * i + band / 2;
    let base = 0;
    o.series.forEach((s, k) => {
      const v = s.values[i];
      const color = s.color ?? SERIES[k % SERIES.length];
      const x = o.stacked ? cx - bw / 2 : cx - (bw * o.series.length) / 2 + k * bw;
      const y0 = o.stacked ? base : 0;
      parts.push(`<rect x="${x.toFixed(1)}" y="${sy(y0 + v).toFixed(1)}" width="${(bw - (o.stacked ? 0 : 1.5)).toFixed(1)}" height="${Math.max(0, sy(y0) - sy(y0 + v)).toFixed(1)}" fill="${color}"/>`);
      if (o.valueLabels && !o.stacked) parts.push(`<text x="${x + bw / 2}" y="${sy(v) - 3}" text-anchor="middle" font-size="6.6" fill="${INK}">${formatNumber(v, { d: o.decimals })}</text>`);
      if (o.stacked) base += v;
    });
    if (o.valueLabels && o.stacked) parts.push(`<text x="${cx}" y="${sy(totals[i]) - 3}" text-anchor="middle" font-size="6.8" font-weight="600" fill="${INK}">${formatNumber(totals[i], { d: o.decimals })}</text>`);
    const words = c.split(" ");
    const lines = words.length > 1 && c.length > 12 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [c];
    lines.forEach((ln, j) => parts.push(`<text x="${cx}" y="${m.t + ph + 11 + j * 8}" text-anchor="middle" font-size="7" fill="${INK}">${esc(ln)}</text>`));
  });
  for (const r of o.refs ?? []) {
    parts.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${sy(r.value)}" y2="${sy(r.value)}" stroke="${INK}" stroke-width="0.8" stroke-dasharray="3 2"/>`);
    parts.push(`<text x="${m.l + pw}" y="${sy(r.value) - 3}" text-anchor="end" font-size="6.8" fill="${INK}">${esc(r.label)}</text>`);
  }
  parts.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${m.t + ph}" y2="${m.t + ph}" stroke="${INK}" stroke-width="0.7"/>`);
  parts.push(`<text x="${m.l - 34}" y="${m.t - 8}" font-size="7.2" fill="${INK}">${axisTitle(o.y)}</text>`);
  if (o.series.length > 1) {
    let lx = m.l;
    o.series.forEach((s, k) => {
      const color = s.color ?? SERIES[k % SERIES.length];
      parts.push(`<rect x="${lx}" y="6" width="8" height="8" fill="${color}"/><text x="${lx + 11}" y="13" font-size="7" fill="${INK}">${esc(s.label)}</text>`);
      lx += 18 + s.label.length * 4.6;
    });
  }
  return frame(W, H, parts.join(""), o);
}

/** Horizontal utilisation bars (rails, budgets): value of capacity with a percentage. */
export function meterChart(o: ChartBase & { rows: { label: string; value: number; capacity: number; unit: string; note?: string }[] }): string {
  const W = o.width ?? 330;
  const rowH = 36;
  const H = o.rows.length * rowH + 4;
  const bw = W - 44;
  const parts: string[] = [];
  o.rows.forEach((r, i) => {
    const y = 4 + i * rowH;
    const frac = r.capacity ? Math.min(1, r.value / r.capacity) : 0;
    parts.push(`<text x="0" y="${y + 8}" font-size="7.6" font-weight="600" fill="${INK}">${esc(r.label)}</text>`);
    parts.push(`<text x="${bw}" y="${y + 8}" font-size="6.8" text-anchor="end" fill="${MUTED}">${formatNumber(r.value)} of ${formatNumber(r.capacity)} ${esc(r.unit)}</text>`);
    parts.push(`<rect x="0" y="${y + 12}" width="${bw}" height="8" fill="#efefef"/>`);
    parts.push(`<rect x="0" y="${y + 12}" width="${(bw * frac).toFixed(1)}" height="8" fill="${frac > 0.8 ? "#c62828" : ACCENT}"/>`);
    parts.push(`<text x="${bw + 5}" y="${y + 18.6}" font-size="7.4" font-weight="600" fill="${INK}">${r.capacity ? Math.round(frac * 100) + " %" : "n/a"}</text>`);
    if (r.note) parts.push(`<text x="0" y="${y + 29}" font-size="6.4" fill="${MUTED}">${esc(r.note)}</text>`);
  });
  return frame(W, H, parts.join(""), o);
}
