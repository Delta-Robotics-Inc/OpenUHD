/**
 * Node side of the figure renderer: one server + one headless Chrome for a
 * whole build, figures cached by content hash (spec + GLB bytes' mtime/size)
 * so re-running a build only re-renders what changed.
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { launchBrowser, type Browser } from "./cdp.js";
import { REPO_ROOT, startServer, type StaticServer } from "./server.js";

export interface RenderBody {
  key: string;
  /** Repo-relative GLB path. */
  glb?: string;
  /** Row-major 4x4, mm, assembly root coordinates. */
  matrix: number[];
  style: "normal" | "context" | "accent" | "ghost" | "hidden";
  category: string;
  /** GLB node names not drawn (interface feature sub-shapes). */
  hide?: string[];
  /** GLB node names drawn in the accent style (interface features to call out). */
  accentNodes?: string[];
  vendor?: boolean;
  /** Excluded from the camera fit when false. */
  fit?: boolean;
}

export interface RenderSpec {
  width: number;
  height: number;
  mode: "lineart" | "shaded";
  ssaa?: number;
  lineScale?: number;
  bodies: RenderBody[];
  guides?: { from: number[]; to: number[]; dash?: [number, number]; radius?: number }[];
  anchors?: { id: string; p: number[]; fit?: boolean }[];
  camera?: { dir?: number[]; up?: number[]; margin?: number; shiftX?: number; shiftY?: number; scaleMmPerPx?: number };
}

export interface RenderResult {
  file: string;
  width: number;
  height: number;
  anchors: Record<string, { x: number; y: number }>;
  mmPerPx: number;
}

export class FigureRenderer {
  private browser?: Browser;
  private server?: StaticServer;
  private ready = false;
  private cacheFile: string;
  private cache: Record<string, Omit<RenderResult, "file"> & { file: string }>;
  rendered = 0;
  reused = 0;

  constructor(private outDir: string) {
    mkdirSync(outDir, { recursive: true });
    this.cacheFile = join(outDir, ".render-cache.json");
    this.cache = existsSync(this.cacheFile) ? JSON.parse(readFileSync(this.cacheFile, "utf8")) : {};
  }

  private async init() {
    if (this.ready) return;
    this.server ??= await startServer();
    this.browser ??= await launchBrowser();
    await this.browser.setViewport(800, 600);
    await this.browser.navigate(`${this.server.url}/page/render.html`);
    for (let i = 0; i < 100; i++) {
      if (await this.browser.evaluate<boolean>("Boolean(window.__ready)")) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    this.ready = true;
  }

  private hash(spec: RenderSpec): string {
    const h = createHash("sha256");
    h.update(JSON.stringify(spec));
    h.update(readFileSync(new URL("./page/render.js", import.meta.url)));
    for (const b of spec.bodies) {
      if (!b.glb) continue;
      const p = join(REPO_ROOT, b.glb);
      if (existsSync(p)) {
        const s = statSync(p);
        h.update(`${b.glb}:${s.size}:${s.mtimeMs}`);
      }
    }
    return h.digest("hex").slice(0, 16);
  }

  /** Render `spec` to `<outDir>/<name>.png`; reuses the previous result when nothing changed. */
  async render(name: string, spec: RenderSpec): Promise<RenderResult> {
    const file = join(this.outDir, `${name}.png`);
    const key = this.hash(spec);
    const hit = this.cache[name];
    if (hit && hit.file === key && existsSync(file)) {
      this.reused++;
      return { ...hit, file };
    }
    await this.init();
    const r = await this.browser!.evaluate<{ png: string; anchors: { id: string; x: number; y: number }[]; mmPerPx: number }>(
      `window.renderScene(${JSON.stringify(spec)})`,
    );
    writeFileSync(file, Buffer.from(r.png.split(",")[1], "base64"));
    const result = {
      width: spec.width,
      height: spec.height,
      anchors: Object.fromEntries(r.anchors.map((a) => [a.id, { x: a.x, y: a.y }])),
      mmPerPx: r.mmPerPx,
    };
    this.cache[name] = { ...result, file: key };
    writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 1));
    this.rendered++;
    return { ...result, file };
  }

  /**
   * Load a draft document (served from the repo), let its flow script
   * paginate it, and return the paginated HTML with the script removed.
   */
  async paginate(htmlRepoPath: string): Promise<{ html: string; pages: number; overflow: number[] }> {
    await this.init();
    const b = this.browser!;
    await b.setViewport(1200, 1600);
    await b.navigate(`${this.server!.url}/repo/${htmlRepoPath}`);
    this.ready = false; // the render page is no longer loaded
    for (let i = 0; i < 200; i++) {
      if (await b.evaluate<boolean>("Boolean(window.__flowDone)")) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const r = await b.evaluate<{ html: string; pages: number; overflow: number[] }>(`(() => {
      document.getElementById("flow-script")?.remove();
      const pages = [...document.querySelectorAll(".page")];
      return {
        html: "<!doctype html>\\n" + document.documentElement.outerHTML,
        pages: pages.length,
        overflow: pages.map((p, i) => p.classList.contains("overflow") ? i + 1 : 0).filter(Boolean),
      };
    })()`);
    return r;
  }

  /** Print an HTML file (served from the repo) to PDF. */
  async printPdf(htmlRepoPath: string): Promise<Buffer> {
    await this.init();
    this.ready = false;
    return this.browser!.printToPdf(`${this.server!.url}/repo/${htmlRepoPath}`);
  }

  async close() {
    await this.browser?.close();
    await this.server?.close();
  }
}
