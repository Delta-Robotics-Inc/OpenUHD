/**
 * Verify generated documents against the live UHD model (skills/uhd-tech-docs-verify):
 *
 *   npx tsx scripts/docs/verify.ts library/systems/quadcopter-5in [--doc datasheet|assembly] [--json]
 *
 * Checks (error unless noted):
 *   values        every [data-q] element re-resolved and re-formatted equals its text; status unchanged
 *   format        numeric values are "value unit" with a space; one spelling per unit (warning)
 *   placeholders  no NaN / undefined / null / [object Object] / raw JSON / TODO / TBD / {{ }} in visible text
 *   standin       stand-in values carry the S marker; charts from stand-in data carry the watermark
 *   images        every <img> exists, decodes, and is not blank
 *   layout        no page overflow, nothing wider than the page body, no heading stranded at a page
 *                 end, no table continuation with fewer than 2 rows, PDF page count = HTML pages
 *   typography    only the document fonts, fonts loaded, embedded in the PDF, sizes within range
 *   bom           the datasheet BOM rows are generated/bom.json's, and generated/bom.json matches the model
 *   coverage      the assembly steps cover every mate, hardware placement and wiring link
 *
 * Writes <system>/docs/.review/verify-report.json and page PNGs in .review/<doc>/ for the
 * visual review (skills/uhd-tech-docs-verify/references/visual-review.md).
 */
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { buildContext, type BuiltContext } from "./lib/context.js";
import { formatValue } from "./lib/format.js";
import { launchBrowser } from "./lib/render/cdp.js";
import { startServer } from "./lib/render/server.js";
import { decodePng, inkStats } from "./lib/png.js";
import { planSteps } from "./lib/docs/assembly.js";
import { DOC_TYPES, type DocType } from "./build.js";

export interface Finding {
  doc: string;
  check: string;
  severity: "error" | "warning" | "info";
  message: string;
  page?: number;
}

interface DomReport {
  pages: number;
  values: { q: string; f: string | null; s: string | null; text: string; tag: string; marker: string | null; page: number }[];
  overflow: number[];
  wide: { page: number; what: string; by: number }[];
  stranded: { page: number; what: string }[];
  thinTables: { page: number; rows: number }[];
  charts: { page: number; status: string; tests: string; mark: boolean }[];
  images: { src: string; w: number; h: number; ok: boolean; page: number }[];
  fonts: { family: string; count: number }[];
  sizes: number[];
  fontsLoaded: Record<string, boolean>;
  text: string;
  steps: { mates: string; wiring: string; hardware: string }[];
  standinTags: number;
}

const DOM_PROBE = `(() => {
  const pageOf = (el) => { const p = el.closest('.page'); return p ? Number(p.dataset.page) : 0; };
  const pages = [...document.querySelectorAll('.page')];
  const out = { pages: pages.length, values: [], overflow: [], wide: [], stranded: [], thinTables: [], charts: [], images: [], fonts: [], sizes: [], fontsLoaded: {}, text: '', steps: [], standinTags: document.querySelectorAll('.standin-tag').length };
  for (const e of document.querySelectorAll('[data-q]')) {
    const n = e.nextElementSibling;
    out.values.push({ q: e.dataset.q, f: e.getAttribute('data-f'), s: e.getAttribute('data-s'), text: e.textContent, tag: e.tagName.toLowerCase(), marker: n && n.matches('sup.mk') ? n.className : null, page: pageOf(e) });
  }
  pages.forEach((p, i) => {
    const body = p.querySelector('.pg-body');
    if (body.scrollHeight > body.clientHeight + 1) out.overflow.push(i + 1);
    const br = body.getBoundingClientRect();
    for (const el of body.querySelectorAll('table, figure, .kpis, .kit, svg.chart, svg.wiring, svg.sysdiag, .parts, p, ol, ul')) {
      const r = el.getBoundingClientRect();
      const by = Math.max(r.right - br.right, br.left - r.left);
      if (by > 1.5) out.wide.push({ page: i + 1, what: el.tagName.toLowerCase() + '.' + (el.className.baseVal ?? el.className), by: Math.round(by) });
    }
    for (const t of body.querySelectorAll('table')) {
      if (t.scrollWidth > t.parentElement.clientWidth + 1) out.wide.push({ page: i + 1, what: 'table content', by: t.scrollWidth - t.parentElement.clientWidth });
      const rows = t.tBodies[0] ? t.tBodies[0].rows.length : 0;
      if (t.closest('.continued') && rows < 2) out.thinTables.push({ page: i + 1, rows });
    }
    const last = body.lastElementChild;
    if (last && i < pages.length - 1 && (last.matches('h1.sec, h2.sub, .keep-next') || (last.lastElementChild && last.lastElementChild.matches && last.lastElementChild.matches('h1.sec, h2.sub')))) out.stranded.push({ page: i + 1, what: last.className });
  });
  for (const c of document.querySelectorAll('svg.chart')) out.charts.push({ page: pageOf(c), status: c.dataset.status, tests: c.dataset.test || '', mark: Boolean(c.querySelector('.standin-mark')) });
  for (const im of document.images) out.images.push({ src: im.getAttribute('src'), w: im.naturalWidth, h: im.naturalHeight, ok: im.complete && im.naturalWidth > 0, page: pageOf(im) });
  const fam = new Map(); const sizes = new Set();
  const walker = document.createTreeWalker(document.querySelector('#pages'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; const cs = getComputedStyle(el);
    if (cs.display === 'none' || el.closest('svg')) continue;
    const f = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    fam.set(f, (fam.get(f) || 0) + 1);
    sizes.add(Math.round(parseFloat(cs.fontSize) * 0.75 * 10) / 10);
  }
  out.fonts = [...fam].map(([family, count]) => ({ family, count }));
  out.sizes = [...sizes].sort((a, b) => a - b);
  out.fontsLoaded = { 'Kode Mono': document.fonts.check("12px 'Kode Mono'") && [...document.fonts].some(f => f.family.includes('Kode Mono') && f.status === 'loaded'), ProtoMono: [...document.fonts].some(f => f.family.includes('ProtoMono') && f.status === 'loaded') };
  out.text = document.querySelector('#pages').innerText;
  out.steps = [...document.querySelectorAll('.step[data-step]')].map(s => ({ mates: s.dataset.mates || '', wiring: s.dataset.wiring || '', hardware: s.dataset.hardware || '' }));
  return out;
})()`;

const unescapeText = (s: string) => s.replace(/\s+/g, " ").trim();

export async function verifyDocs(systemDir: string, opts: { only?: DocType } = {}): Promise<Finding[]> {
  const ctx: BuiltContext = await buildContext(systemDir);
  const docDir = join(ctx.sys.absDir, "docs");
  const docRepoDir = `${ctx.sys.dir}/docs`;
  const findings: Finding[] = [];
  const server = await startServer();
  const browser = await launchBrowser();
  try {
    for (const type of Object.keys(DOC_TYPES) as DocType[]) {
      if (opts.only && opts.only !== type) continue;
      const name = `${ctx.sys.system.id}-${DOC_TYPES[type].suffix}`;
      const add = (check: string, severity: Finding["severity"], message: string, page?: number) => findings.push({ doc: name, check, severity, message, page });
      const html = join(docDir, `${name}.html`);
      if (!existsSync(html)) {
        add("exists", "error", `${name}.html not found; run scripts/docs/build.ts`);
        continue;
      }
      await browser.setViewport(1200, 1600);
      await browser.navigate(`${server.url}/repo/${docRepoDir}/${name}.html`);
      await browser.evaluate("document.fonts.ready.then(() => true)");
      await browser.evaluate("Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))");
      const dom = await browser.evaluate<DomReport>(DOM_PROBE);

      // ---- values
      let checked = 0;
      const unitSpellings = new Map<string, Set<string>>();
      for (const v of dom.values) {
        const r = ctx.resolve(v.q);
        const expected = r.status === "gap" && (r.value === undefined || r.value === null) ? "—" : formatValue(r.value, r.unit, v.f ?? undefined);
        checked++;
        if (unescapeText(expected) !== unescapeText(v.text)) add("values", "error", `${v.q}${v.f ? ` [${v.f}]` : ""}: document shows "${v.text}", model gives "${expected}"`, v.page);
        if (v.s && v.s !== r.status) add("values", "error", `${v.q}: status in document "${v.s}", model now "${r.status}"`, v.page);
        // format: numbers with units need a space; collect unit spellings
        const numeric = !(v.f ?? "").includes("hex") && typeof r.value === "number" || (Array.isArray(r.value) && r.value.every((x) => typeof x === "number"));
        const m = numeric ? v.text.match(/^[−-]?\d[\d.]*(?:\u00a0\d{3})*(?:–[−-]?\d[\d.]*(?:\u00a0\d{3})*)?(\s?)([^\d\s].*)?$/) : null;
        if (m && m[2] && !m[2].startsWith(":") && m[2] !== "°" && !m[1]) add("format", "error", `${v.q}: "${v.text}" has no space between value and unit`, v.page);
        if (m && m[2]) {
          const key = m[2].toLowerCase();
          unitSpellings.set(key, new Set([...(unitSpellings.get(key) ?? []), m[2]]));
        }
        // stand-in marker
        if (v.s === "standin" && v.tag === "span" && !(v.marker ?? "").includes("mk-standin") && !v.q.startsWith("derived:diagCount")) add("standin", "error", `${v.q}: stand-in value without the S marker`, v.page);
        if (/^(NaN|undefined|null|Infinity)$/.test(v.text.trim())) add("placeholders", "error", `${v.q}: renders "${v.text}"`, v.page);
      }
      for (const [k, spellings] of unitSpellings) if (spellings.size > 1) add("format", "warning", `unit spelled ${[...spellings].map((x) => `"${x}"`).join(" and ")} (${k})`);
      add("values", "info", `${checked} bound values re-resolved against the model`);

      // ---- placeholders in visible text
      for (const pat of [/\bNaN\b/, /\bundefined\b/, /\[object Object\]/, /\{"\w+":/, /\bTODO\b/, /\bTBD\b/, /\{\{|\}\}/, /\bInfinity\b/, /\bnull\b/]) {
        const m = dom.text.match(pat);
        if (m) add("placeholders", "error", `visible text contains "${m[0]}" near "${dom.text.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 40).replace(/\s+/g, " ")}"`);
      }

      // ---- stand-in charts
      for (const c of dom.charts) {
        const ids = c.tests.split(" ").filter(Boolean);
        const statuses = ids.map((id) => ctx.tests.get(id)?.status);
        if (ids.some((id) => !ctx.tests.get(id))) add("standin", "error", `chart draws missing test data ${c.tests}`, c.page);
        const standin = statuses.includes("standin");
        if (standin && (!c.mark || c.status !== "standin")) add("standin", "error", `chart from stand-in data (${c.tests}) has no STAND-IN watermark`, c.page);
        if (!standin && ids.length && c.mark) add("standin", "error", `chart from measured data (${c.tests}) still carries the stand-in watermark; rebuild`, c.page);
      }
      if (dom.values.some((v) => v.s === "standin") && !/Stand-in/.test(dom.text)) add("standin", "error", "stand-in values are shown but the marker legend is missing");

      // ---- images
      for (const im of dom.images) {
        const file = join(docDir, im.src);
        if (!im.ok || !existsSync(file)) {
          add("images", "error", `image ${im.src} missing or failed to load`, im.page);
          continue;
        }
        try {
          const st = inkStats(decodePng(file));
          if (st.ink < 0.004 || st.spread < 3) add("images", "error", `image ${im.src} looks blank (ink ${(st.ink * 100).toFixed(2)} %, spread ${st.spread.toFixed(1)})`, im.page);
        } catch (e) {
          add("images", "error", `image ${im.src}: ${(e as Error).message}`, im.page);
        }
      }
      add("images", "info", `${dom.images.length} images checked`);

      // ---- layout
      for (const p of dom.overflow) add("layout", "error", "page body overflows (content cut off)", p);
      for (const w of dom.wide) add("layout", "error", `${w.what} is ${w.by}px wider than the page body`, w.page);
      for (const s of dom.stranded) add("layout", "error", `heading or keep-with-next block stranded at the end of the page (${s.what})`, s.page);
      for (const t of dom.thinTables) add("layout", "error", `table continuation with only ${t.rows} row(s)`, t.page);
      const pdf = join(docDir, `${name}.pdf`);
      if (existsSync(pdf)) {
        const pages = Number(execFileSync("pdfinfo", [pdf]).toString().match(/Pages:\s+(\d+)/)?.[1]);
        if (pages !== dom.pages) add("layout", "error", `PDF has ${pages} pages, HTML has ${dom.pages} (print CSS is breaking pages)`);
        const fonts = execFileSync("pdffonts", [pdf]).toString().split("\n").slice(2).filter(Boolean);
        for (const l of fonts) {
          const cols = l.trim().split(/\s+/);
          const fontName = cols[0];
          const emb = cols[cols.length - 5];
          if (emb !== "yes") add("typography", "error", `PDF font ${fontName} is not embedded`);
          if (/DejaVu|Liberation|Noto|Arial|Helvetica|Times|Courier|FreeMono|Ubuntu/i.test(fontName)) add("typography", "warning", `PDF falls back to ${fontName.replace(/^[A-Z]{6}\+/, "")} for glyphs the document fonts lack`);
        }
        // page images for the visual review
        const review = join(docDir, ".review", name);
        rmSync(review, { recursive: true, force: true });
        mkdirSync(review, { recursive: true });
        try {
          execFileSync("pdftoppm", ["-r", "70", "-png", pdf, join(review, "page")]);
          const pngs = readdirSync(review).filter((f) => f.endsWith(".png"));
          for (const f of pngs) {
            const st = inkStats(decodePng(join(review, f)));
            if (st.ink < 0.003) add("layout", "error", `PDF ${f} is blank`, Number(f.match(/(\d+)/)?.[1]));
          }
          add("review", "info", `${pngs.length} page PNGs in ${docRepoDir}/.review/${name}/ for the visual checklist`);
        } catch {
          add("review", "warning", "pdftoppm not available: no page PNGs for the visual review");
        }
      } else add("layout", "error", `${name}.pdf missing`);

      // ---- typography
      const allowed = new Set(["Kode Mono", "ProtoMono"]);
      for (const f of dom.fonts) if (!allowed.has(f.family)) add("typography", "error", `text in font "${f.family}" (${f.count} runs)`);
      for (const [f, ok] of Object.entries(dom.fontsLoaded)) if (!ok) add("typography", "warning", `font ${f} did not load (UHD_DOC_FONTS?)`);
      const small = dom.sizes.filter((s) => s < 5);
      if (small.length) add("typography", "error", `text below 5 pt: ${small.join(", ")} pt`);
      if (dom.sizes.length > 16) add("typography", "warning", `${dom.sizes.length} distinct text sizes (${dom.sizes.join(", ")} pt): tighten the type scale`);
      add("typography", "info", `text sizes ${dom.sizes.join(", ")} pt; fonts ${dom.fonts.map((f) => f.family).join(", ")}`);

      // ---- BOM
      if (type === "datasheet") {
        const bom = ctx.generatedBom;
        if (!bom) add("bom", "error", "generated/bom.json missing");
        else {
          const key = (rows: any[]) => JSON.stringify(rows.map((r) => [r.partId, r.quantity, r.buy]));
          if (key(bom) !== key(ctx.liveBom)) add("bom", "error", "generated/bom.json is stale against the model: run the system's generate.ts");
          for (const row of bom) {
            const qs = dom.values.filter((v) => v.q.startsWith(`sys:bom[line=${row.line}].`));
            const qty = qs.find((v) => v.q.endsWith(".quantity"));
            const nm = qs.find((v) => v.q.endsWith(".name"));
            if (!qty || !nm) add("bom", "error", `BOM line ${row.line} (${row.partId}) is not in the document`);
          }
          const lines = new Set(dom.values.filter((v) => /^sys:bom\[line=\d+\]\.line$/.test(v.q)).map((v) => v.q));
          if (lines.size !== bom.length) add("bom", "error", `document lists ${lines.size} BOM lines, generated/bom.json has ${bom.length}`);
          else add("bom", "info", `${bom.length} BOM lines match generated/bom.json`);
        }
      }

      // ---- assembly coverage
      if (type === "assembly") {
        const mates = new Set(dom.steps.flatMap((s) => s.mates.split(" ").filter(Boolean)));
        const wires = new Set(dom.steps.flatMap((s) => s.wiring.split(" ").filter(Boolean)));
        const hw = new Set(dom.steps.flatMap((s) => s.hardware.split(" ").filter(Boolean)));
        for (const m of ctx.scene.assembly.mates) if (!mates.has(m.linkId)) add("coverage", "error", `mate ${m.linkId} is in no step`);
        for (const h of ctx.scene.hardware) if (!hw.has(h.key)) add("coverage", "error", `hardware ${h.key} (${h.def.id}) is in no step`);
        for (const w of ctx.wiring.filter((x) => x.domain !== "mechanical")) if (!wires.has(w.linkId)) add("coverage", "error", `wiring link ${w.linkId} is in no step`);
        const known = new Set(ctx.scene.hardware.map((h) => h.key));
        for (const k of hw) if (!known.has(k)) add("coverage", "error", `step lists hardware ${k}, which the model no longer places`);
        const placedModules = ctx.scene.bodies.filter((b) => b.via && !b.via.startsWith("hint:"));
        add("coverage", "info", `${mates.size}/${ctx.scene.assembly.mates.length} mates, ${hw.size}/${ctx.scene.hardware.length} hardware placements, ${wires.size}/${ctx.wiring.filter((x) => x.domain !== "mechanical").length} wiring links covered; ${placedModules.length} bodies placed by mates`);
        const plans = planSteps({ ctx } as any);
        if (plans.some((p) => p.spec.id.startsWith("auto-"))) add("coverage", "warning", `doc spec leaves ${plans.filter((p) => p.spec.id.startsWith("auto-")).length} automatic step(s); order them in docspec.ts`);
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  const reportDir = join(docDir, ".review");
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, "verify-report.json"), JSON.stringify({ system: ctx.sys.dir, at: new Date().toISOString(), findings }, null, 1) + "\n");
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) throw new Error("usage: npx tsx scripts/docs/verify.ts <system-dir> [--doc datasheet|assembly] [--json]");
  const only = args.includes("--doc") ? (args[args.indexOf("--doc") + 1] as DocType) : undefined;
  const findings = await verifyDocs(dir, { only });
  if (args.includes("--json")) console.log(JSON.stringify(findings, null, 1));
  else {
    for (const sev of ["error", "warning", "info"] as const) {
      for (const f of findings.filter((x) => x.severity === sev)) console.log(`${sev.toUpperCase().padEnd(7)} ${f.doc} · ${f.check}${f.page ? ` · p${f.page}` : ""} — ${f.message}`);
    }
    const e = findings.filter((f) => f.severity === "error").length;
    const w = findings.filter((f) => f.severity === "warning").length;
    console.log(`\n${e} error(s), ${w} warning(s)`);
  }
  process.exit(findings.some((f) => f.severity === "error") ? 1 : 0);
}
