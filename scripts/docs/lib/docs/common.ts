/**
 * Shared pieces of the document builders: build environment, cover page,
 * thumbnails, test-data helpers.
 */
import { join } from "path";
import type { ModuleDef } from "../../../../src/types/index.js";
import { esc, type Doc } from "../html.js";
import type { FigureRenderer, RenderResult } from "../render/renderer.js";
import type { BuiltContext } from "../context.js";
import { category, featureNames, glbFor } from "../model.js";
import { isolated, ISO } from "../figures.js";
import type { TestData } from "../testdata.js";

export interface BuildEnv {
  ctx: BuiltContext;
  doc: Doc;
  r: FigureRenderer;
  /** Absolute docs directory (the HTML's directory). */
  docDir: string;
  /** Repo-relative docs directory. */
  docRepoDir: string;
  /** Image path prefix relative to the HTML. */
  img: (name: string) => string;
  counters: { fig: number };
}

export const figNum = (env: BuildEnv) => String(++env.counters.fig);

/** Thumbnail of a module on its own; undefined when it has no body GLB. */
export async function thumbnail(env: BuildEnv, def: ModuleDef, size = 360): Promise<RenderResult | undefined> {
  const glb = glbFor(def);
  if (!glb?.filePath) return undefined;
  return env.r.render(`part-${def.id}`, {
    width: size,
    height: size,
    mode: "lineart",
    lineScale: 1.25,
    bodies: isolated(def, glb.filePath, featureNames(def, glb), category(def), Boolean(glb.id.startsWith("cad_vendor"))),
    camera: { dir: category(def) === "prop" || category(def) === "frame" || category(def) === "top_plate" ? [0.8, -1, 1.4] : ISO, margin: 0.08 },
  });
}

export function coverPage(env: BuildEnv, o: { kicker: string; hero: RenderResult; heroCaption: string; bottom: string }): string {
  const m = env.doc.meta;
  const words = m.title.split(" ");
  const last = words.pop();
  return `<div class="coverpage" data-page="cover">
  <div class="cover-top"><div class="grid-bg"></div>
    <div class="cover-brand">PR<b>0</b>TOBOARD <span class="muted">·</span> UHD</div>
    <div class="cover-rev"><span>Rev ${esc(m.revision)}</span><span>${esc(m.date)}</span><span>${esc(m.docId)}</span></div>
    <div class="cover-kicker">${esc(o.kicker)}</div>
    <div class="cover-title">${esc(words.join(" "))} <span class="accent">${esc(last)}</span></div>
    <div class="cover-sub">${env.doc.v("sys:system.description", undefined, { cls: "wrap" })}</div>
    <div class="cover-hero"><img src="${esc(env.img(o.hero.file))}" width="${o.hero.width}" height="${o.hero.height}" alt="${esc(o.heroCaption)}"></div>
    <div class="cover-herocap">${esc(o.heroCaption)}</div>
  </div>
  <div class="cover-bottom">${o.bottom}</div>
  <div class="cover-foot"><span class="pg-brand">PR<b>0</b>TOBOARD · UHD</span><span>Generated from the UHD model <code>${esc(env.ctx.sys.dir)}</code> by scripts/docs</span><span class="right">${esc(m.docId)} · Rev ${esc(m.revision)} · ${esc(m.date)}</span></div>
</div>`;
}

export function testOf(env: BuildEnv, id: string): TestData | undefined {
  return env.ctx.tests.get(id);
}

/** "STAND-IN" / "MEASURED" tag for a test-data block. */
export function testTag(t: TestData | undefined): string {
  if (!t) return `<span class="tag err">no data</span>`;
  return t.status === "measured" ? `<span class="tag ok">measured</span>` : `<span class="tag warn standin-tag">stand-in · not measured</span>`;
}

export const imgPath = (docDir: string) => (file: string) => file.startsWith(docDir) ? file.slice(docDir.length + 1) : join("images", file);
