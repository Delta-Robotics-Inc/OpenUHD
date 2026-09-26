/**
 * Build technical documents for a UHD system (skills/uhd-tech-docs):
 *
 *   npx tsx scripts/docs/build.ts library/systems/quadcopter-5in [--only datasheet|assembly] [--no-pdf] [--no-standins]
 *
 * Writes into <system>/docs/:
 *   <system-id>-datasheet.html / .pdf / .values.json
 *   <system-id>-assembly-guide.html / .pdf / .values.json
 *   images/            figures rendered from the GLB artifacts (cached by content)
 *   test-data/         stand-in (and measured) test data
 *   .review/<doc>/     page PNGs for visual review (not committed)
 *
 * Every value is a query into the model (lib/values.ts); run
 * scripts/docs/verify.ts afterwards.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { homedir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { buildContext, type BuiltContext } from "./lib/context.js";
import { Doc, shell, type DocMeta } from "./lib/html.js";
import { FigureRenderer } from "./lib/render/renderer.js";
import { buildDatasheet, provenanceSection } from "./lib/docs/datasheet.js";
import { buildAssemblyGuide, assemblyProvenance } from "./lib/docs/assembly.js";
import { imgPath, type BuildEnv } from "./lib/docs/common.js";
import { writeStandins } from "./standin.js";

export const DOC_TYPES = {
  datasheet: { suffix: "datasheet", title: "Datasheet", code: "DS" },
  assembly: { suffix: "assembly-guide", title: "Assembly guide", code: "AG" },
} as const;
export type DocType = keyof typeof DOC_TYPES;

/** Fonts are resolved at build time and copied next to the documents (not committed: ProtoMono is a licensed webfont). */
function copyFonts(docDir: string): void {
  const src = process.env.UHD_DOC_FONTS ?? join(homedir(), "repos/Protoboard/next-alpha/public/fonts");
  const dst = join(docDir, "assets", "fonts");
  mkdirSync(dst, { recursive: true });
  writeFileSync(join(docDir, "assets", ".gitignore"), "# Fonts are copied in at build time (UHD_DOC_FONTS); ProtoMono is a licensed webfont.\nfonts/\n");
  if (!existsSync(src)) {
    console.warn(`fonts: ${src} not found; documents fall back to system monospace (set UHD_DOC_FONTS)`);
    return;
  }
  for (const f of readdirSync(src)) if (/^(KodeMono-.*\.ttf|proto-mono-regular\.(woff2|ttf))$/.test(f)) copyFileSync(join(src, f), join(dst, f));
}

export async function buildDocs(systemDir: string, opts: { only?: DocType; pdf?: boolean; standins?: boolean } = {}) {
  if (opts.standins !== false) {
    const s = await writeStandins(systemDir);
    if (s.written.length || s.kept.length) console.log(`test data: stand-ins ${s.written.join(", ") || "none"}; measured ${s.kept.join(", ") || "none"}`);
  }
  const ctx: BuiltContext = await buildContext(systemDir);
  if (ctx.testErrors.length) throw new Error(`test data invalid:\n  ${ctx.testErrors.join("\n  ")}`);
  const docDir = join(ctx.sys.absDir, "docs");
  const docRepoDir = `${ctx.sys.dir}/docs`;
  const imgDir = join(docDir, "images");
  mkdirSync(imgDir, { recursive: true });
  writeFileSync(join(docDir, ".gitignore"), "# build byproducts (scripts/docs)\n.review/\nimages/.render-cache.json\n");
  copyFonts(docDir);
  const r = new FigureRenderer(imgDir);
  const date = new Date().toISOString().slice(0, 10);
  const results: { type: DocType; html: string; pdf?: string; pages: number; overflow: number[]; values: number }[] = [];
  try {
    for (const type of Object.keys(DOC_TYPES) as DocType[]) {
      if (opts.only && opts.only !== type) continue;
      const t = DOC_TYPES[type];
      const meta: DocMeta = {
        title: ctx.sys.config.title ?? ctx.sys.system.name,
        docType: t.title,
        docId: `${ctx.sys.config.docId ?? ctx.sys.system.id.toUpperCase()}-${t.code}`,
        revision: ctx.sys.config.revision ?? "A",
        date,
        system: ctx.sys.dir,
      };
      const doc = new Doc(ctx, meta);
      const env: BuildEnv = { ctx, doc, r, docDir, docRepoDir, img: imgPath(docDir), counters: { fig: 0 } };
      const body = type === "datasheet" ? (await buildDatasheet(env)) + provenanceSection(env) : (await buildAssemblyGuide(env)) + assemblyProvenance(env);
      const name = `${ctx.sys.system.id}-${t.suffix}`;
      const html = doc.fillLegends(shell(meta, body, { fontsHref: "assets/fonts" }));
      const htmlPath = join(docDir, `${name}.html`);
      writeFileSync(htmlPath, html);
      const pag = await r.paginate(`${docRepoDir}/${name}.html`);
      writeFileSync(htmlPath, pag.html);
      writeFileSync(
        join(docDir, `${name}.values.json`),
        JSON.stringify(
          {
            document: `${name}.html`,
            system: ctx.sys.dir,
            docId: meta.docId,
            generated: date,
            values: [...doc.values.values()].map((v) => ({ q: v.q, f: v.f, text: v.text, status: v.status, unit: v.unit, source: v.source, formula: v.formula, inputs: v.inputs, note: v.note })),
          },
          null,
          1,
        ) + "\n",
      );
      let pdfPath: string | undefined;
      if (opts.pdf !== false) {
        pdfPath = join(docDir, `${name}.pdf`);
        writeFileSync(pdfPath, await r.printPdf(`${docRepoDir}/${name}.html`));
        const review = join(docDir, ".review", name);
        rmSync(review, { recursive: true, force: true });
        mkdirSync(review, { recursive: true });
        try {
          execFileSync("pdftoppm", ["-r", "70", "-png", pdfPath, join(review, "page")]);
        } catch {
          console.warn("pdftoppm not available: no review PNGs");
        }
      }
      results.push({ type, html: htmlPath, pdf: pdfPath, pages: pag.pages, overflow: pag.overflow, values: doc.values.size });
      console.log(`${name}: ${pag.pages} pages, ${doc.values.size} bound values${pag.overflow.length ? `, OVERFLOW on pages ${pag.overflow.join(", ")}` : ""}`);
    }
  } finally {
    console.log(`figures: ${r.rendered} rendered, ${r.reused} reused`);
    await r.close();
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) throw new Error("usage: npx tsx scripts/docs/build.ts <system-dir> [--only datasheet|assembly] [--no-pdf] [--no-standins]");
  const only = args.includes("--only") ? (args[args.indexOf("--only") + 1] as DocType) : undefined;
  await buildDocs(dir, { only, pdf: !args.includes("--no-pdf"), standins: !args.includes("--no-standins") });
}
