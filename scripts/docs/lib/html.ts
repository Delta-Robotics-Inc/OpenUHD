/**
 * HTML building blocks for documents: escaping, value spans bound to model
 * queries, markers, the page shell (CSS + pagination script).
 *
 * Every model value in a document is emitted by `doc.v(query, format)`:
 *
 *   <span class="v" data-q="def:…" data-f="d1" data-s="source">22.2 V</span><sup class="mk">A</sup>
 *
 * The verifier re-resolves each data-q against the live model, re-formats
 * it with data-f and compares the text.
 */
import { readFileSync } from "fs";
import { formatValue, glyphSafe } from "./format.js";
import type { DocContext, ResolvedValue, ValueStatus } from "./values.js";

export const esc = (s: unknown) =>
  glyphSafe(String(s ?? ""))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const MARKERS: Record<ValueStatus, { mark: string; label: string; help: string } | undefined> = {
  source: undefined,
  model: undefined,
  measured: { mark: "M", label: "Measured", help: "from a test-data file with status measured" },
  assumption: { mark: "A", label: "Assumption", help: "the model marks this value as an assumption (assumption trait)" },
  derived: { mark: "D", label: "Derived", help: "computed from model values; formula in the provenance appendix" },
  standin: { mark: "S", label: "Stand-in", help: "stand-in data derived from the model, not measured" },
  gap: { mark: "—", label: "Not in model", help: "the model does not state this value (data gap)" },
};

export interface DocMeta {
  title: string;
  docType: string;
  docId: string;
  revision: string;
  date: string;
  system: string;
}

export interface RenderedValue extends ResolvedValue {
  f?: string;
  text: string;
}

export class Doc {
  values = new Map<string, RenderedValue>();
  statuses = new Set<ValueStatus>();
  constructor(
    public ctx: DocContext,
    public meta: DocMeta,
  ) {}

  /** Resolve and format a value; records it for the provenance appendix and the verifier. */
  text(q: string, f?: string): { text: string; r: ResolvedValue } {
    const r = this.ctx.resolve(q);
    const text = r.status === "gap" && (r.value === undefined || r.value === null) ? "—" : formatValue(r.value, r.unit, f);
    const key = `${q}|${f ?? ""}`;
    if (!this.values.has(key)) this.values.set(key, { ...r, f, text });
    this.statuses.add(r.status);
    return { text, r };
  }

  /** Inline value span with its status marker. */
  v(q: string, f?: string, opts: { marker?: boolean; cls?: string } = {}): string {
    const { text, r } = this.text(q, f);
    const mk = MARKERS[r.status];
    const title = [r.source && `Source: ${r.source}`, r.formula && `Formula: ${r.formula}`, r.note].filter(Boolean).join(" · ");
    // number and unit in separate spans so display type can set the unit in the text face (textContent unchanged)
    const nu = text.match(/^(.*\d)\u00a0([^\d]+)$/);
    const inner = nu ? `<span class="n">${esc(nu[1])}</span>\u00a0<span class="u">${esc(nu[2])}</span>` : esc(text);
    const span = `<span class="v${opts.cls ? " " + opts.cls : ""} st-${r.status}" data-q="${esc(q)}"${f ? ` data-f="${esc(f)}"` : ""} data-s="${r.status}"${title ? ` title="${esc(title)}"` : ""}>${inner}</span>`;
    return opts.marker === false || !mk ? span : `${span}<sup class="mk mk-${r.status}">${mk.mark}</sup>`;
  }

  /** SVG <text> bound to a query (figures, callouts). */
  svgText(q: string, f: string | undefined, attrs: string): string {
    const { text, r } = this.text(q, f);
    return `<text ${attrs} data-q="${esc(q)}"${f ? ` data-f="${esc(f)}"` : ""} data-s="${r.status}">${esc(text)}</text>`;
  }

  /** Where the marker legend goes; filled in once every value is known (fillLegends). */
  legendPlaceholder(): string {
    return `<div class="legend-slot"></div>`;
  }

  fillLegends(html: string): string {
    return html.replace(/<div class="legend-slot"><\/div>/g, this.legend());
  }

  legend(): string {
    const used = (Object.keys(MARKERS) as ValueStatus[]).filter((s) => MARKERS[s] && this.statuses.has(s));
    if (!used.length) return "";
    return `<div class="legend">${used
      .map((s) => `<span><sup class="mk mk-${s}">${MARKERS[s]!.mark}</sup> ${esc(MARKERS[s]!.label)}: ${esc(MARKERS[s]!.help)}</span>`)
      .join("")}<span>Unmarked values are cited from the part's sources (sources.json) or are design values of the model.</span></div>`;
  }
}

const TEMPLATES = new URL("./templates/", import.meta.url);
export const readTemplate = (name: string) => readFileSync(new URL(name, TEMPLATES), "utf8");

/** Full HTML document around the flow blocks; `flow.js` paginates it in the browser. */
export function shell(meta: DocMeta, body: string, opts: { fontsHref: string; extraCss?: string }): string {
  const css = readTemplate("doc.css").replace(/__FONTS__/g, opts.fontsHref);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="generator" content="uhd-tech-docs (scripts/docs)">
<meta name="uhd-system" content="${esc(meta.system)}">
<meta name="uhd-doc-type" content="${esc(meta.docType)}">
<meta name="uhd-doc-id" content="${esc(meta.docId)}">
<title>${esc(meta.title)} — ${esc(meta.docType)}</title>
<style>${css}${opts.extraCss ?? ""}</style>
</head>
<body>
<template id="page-template">
  <div class="page">
    <header class="pg-head"><span class="pg-mark"></span><span class="pg-title">${esc(meta.title)}</span><span class="pg-type">${esc(meta.docType)}</span><span class="pg-id">${esc(meta.docId)}</span></header>
    <main class="pg-body"></main>
    <footer class="pg-foot"><span class="pg-brand">PR<b>0</b>TOBOARD · UHD</span><span class="pg-rev">${esc(meta.docId)} · Rev ${esc(meta.revision)} · ${esc(meta.date)}</span><span class="pg-num"></span></footer>
  </div>
</template>
<div id="pages"></div>
<section id="flow">
${body}
</section>
<script id="flow-script">${readTemplate("flow.js")}</script>
</body>
</html>
`;
}
