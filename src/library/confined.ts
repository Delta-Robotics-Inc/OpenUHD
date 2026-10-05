/**
 * Confined evaluation of definition source (docs/library-protocol.md
 * § 4.6.3): `@deltarobotics/uhd/library/confined`, for Node.js.
 *
 * The lint of § 4.6.2 is lexical: it keeps library source to declarative
 * definition code, but it cannot see what a computed member access
 * (`x[key]`) reaches. So source a consumer did not write is never imported
 * into the consumer's own process. It is evaluated here instead, in a child
 * Node.js process that:
 *
 * - runs under Node's permission model (`--permission`): it may read only
 *   the laid-out closure and the UHD package's built modules, and may not write files, start
 *   processes or worker threads, load addons, use WASI or the inspector;
 * - cannot generate code from strings (`--disallow-code-generation-from-strings`):
 *   `eval` and the `Function` constructor throw, however they are reached;
 * - has an empty environment (no credentials, no tokens);
 * - is killed after a time limit, with a memory limit.
 *
 * The TypeScript is turned into JavaScript in the calling process, by the
 * transpiler the caller passes (types erased only, as § 4.6.3 step 3 says);
 * the child imports plain ES modules and never runs a loader or compiler.
 *
 * What the child returns is data: each entry's export as JSON. A caller
 * takes the definition digest of it (`definitionDigest`) and compares it
 * with the pinned one. A module that escapes nothing but tampers with the
 * child's own output can only make its result disagree with the pin.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { definitionDigest } from "./envelope.js";
import { resolveSourceImport, sourceImports, SOURCE_PACKAGE } from "./source.js";

/** One closure to evaluate. */
export interface ConfinedSource {
  /** The caller's name for it, returned with its result. */
  key: string;
  files: { path: string; text: string }[];
  entry: string;
  /** The entry's export that holds the definition. */
  export: string;
}

export type ConfinedResult = { key: string; definition: Record<string, unknown>; digest: string } | { key: string; error: string };

export interface ConfinedOptions {
  /** TypeScript to JavaScript (an ES module), types erased: esbuild's `transform`, TypeScript's `transpileModule`, … */
  transpile: (text: string, path: string) => string | Promise<string>;
  /** The `@deltarobotics/uhd` package the source imports (its root folder). Default: this package. */
  uhdPackageDir?: string;
  /** Wall-clock limit for the whole batch. Default 60 s. */
  timeoutMs?: number;
  /** Heap limit of the child, in MB. Default 1024. */
  maxHeapMb?: number;
  /** Where the work folder goes. Default: the OS temporary folder. */
  workDir?: string;
}

/** This package's root: dist/library/confined.js → ../.. */
const ownPackageDir = (): string => join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const jsPath = (tsPath: string) => tsPath.replace(/\.(m|c)?ts$/, (_, m: string | undefined) => `.${m ?? ""}js`);

/** Relative import specifiers of transpiled JavaScript rewritten to the closure's `.js` files. */
function rewriteImports(js: string, from: string, paths: Set<string>): string {
  let out = js;
  for (const imp of [...sourceImports(js)].reverse()) {
    if (imp.specifier === SOURCE_PACKAGE || !imp.specifier.startsWith(".")) continue;
    const target = resolveSourceImport(from, imp.specifier, paths);
    if (!target) continue; // left as written: the import fails in the child
    let rel = posix.relative(posix.dirname(jsPath(from)), jsPath(target));
    if (!rel.startsWith(".")) rel = `./${rel}`;
    out = out.slice(0, imp.start) + JSON.stringify(rel) + out.slice(imp.end);
  }
  return out;
}

const RESULT_MARK = "\n@@uhd-confined-result@@";

/** The child's program: import each entry and write its export as JSON, one result at a time. */
const RUNNER = `import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const stringify = JSON.stringify, parse = JSON.parse, write = process.stdout.write.bind(process.stdout);
const jobs = parse(readFileSync(process.argv[2], "utf8"));
for (const j of jobs) {
  let r;
  try {
    const ns = await import(pathToFileURL(j.entry).href);
    const v = ns[j.export];
    r = !v || typeof v !== "object" ? { key: j.key, error: "the entry has no export " + j.export } : { key: j.key, value: parse(stringify(v)) };
  } catch (e) {
    r = { key: j.key, error: String((e && e.message) || e).split("\\n")[0] };
  }
  write(${JSON.stringify(RESULT_MARK)} + stringify(r) + "\\n");
}
`;

type Job = { key: string; entry: string; export: string };
type Raw = { key: string; value?: unknown; error?: string };

/**
 * Evaluate source closures in a confined child process (see the module
 * comment) and take the definition digest of each export. Closures should
 * pass `lintSource` first; this does not lint. Never throws for a closure
 * that fails: its result carries the error.
 */
export async function evaluateSourceConfined(sources: ConfinedSource[], options: ConfinedOptions): Promise<ConfinedResult[]> {
  if (!sources.length) return [];
  const uhd = realpathSync(options.uhdPackageDir ?? ownPackageDir());
  const work = realpathSync(mkdtempSync(join(options.workDir ?? tmpdir(), "uhd-confined-")));
  try {
    writeFileSync(join(work, "package.json"), JSON.stringify({ private: true, type: "module" }) + "\n");
    mkdirSync(join(work, "node_modules", "@deltarobotics"), { recursive: true });
    symlinkSync(uhd, join(work, "node_modules", ...SOURCE_PACKAGE.split("/")), "dir");
    const jobs: Job[] = [];
    const early: ConfinedResult[] = [];
    for (const [i, s] of sources.entries()) {
      const at = join(work, `s${i}`);
      const paths = new Set(s.files.map((f) => f.path));
      try {
        for (const f of s.files) {
          const js = rewriteImports(await options.transpile(f.text, f.path), f.path, paths);
          const target = join(at, ...jsPath(f.path).split("/"));
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, js);
        }
        jobs.push({ key: s.key, entry: join(at, ...jsPath(s.entry).split("/")), export: s.export });
      } catch (e) {
        early.push({ key: s.key, error: `does not compile: ${(e as Error).message.split("\n")[0]}` });
      }
    }
    writeFileSync(join(work, "runner.mjs"), RUNNER);
    // a closure that does not finish (or kills its process) fails alone: the ones after it run again
    const raw = new Map<string, Raw>();
    let pending = jobs;
    for (let run = 0; pending.length; run++) {
      writeFileSync(join(work, `jobs-${run}.json`), JSON.stringify(pending));
      const r = await runChild(work, uhd, `jobs-${run}.json`, options);
      for (const x of r.results) raw.set(x.key, x);
      const rest = pending.filter((j) => !raw.has(j.key));
      if (rest.length && r.stopped) raw.set(rest[0].key, { key: rest[0].key, error: r.stopped });
      pending = rest.slice(r.stopped ? 1 : rest.length);
    }
    const byKey = new Map<string, ConfinedResult>(early.map((r) => [r.key, r]));
    for (const j of jobs) {
      const r = raw.get(j.key);
      if (!r) byKey.set(j.key, { key: j.key, error: "the evaluation returned nothing for it" });
      else if (r.error !== undefined || !r.value || typeof r.value !== "object") byKey.set(j.key, { key: j.key, error: String(r.error ?? "no value") });
      else {
        const def = r.value as Record<string, unknown>;
        if (typeof def.id !== "string" || !Array.isArray(def.interfaces)) byKey.set(j.key, { key: j.key, error: `export ${j.export} is not a UHD ModuleDef` });
        else byKey.set(j.key, { key: j.key, definition: def, digest: await definitionDigest(def as never) });
      }
    }
    return sources.map((s) => byKey.get(s.key)!);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** One child process over a jobs file: the results it wrote, and why it stopped early, if it did. */
function runChild(work: string, uhd: string, jobsFile: string, options: ConfinedOptions): Promise<{ results: Raw[]; stopped?: string }> {
  const limit = options.timeoutMs ?? 60_000;
  const args = [
    "--permission",
    `--allow-fs-read=${work}`,
    // of UHD, its manifest and its built modules only
    `--allow-fs-read=${join(uhd, "package.json")}`,
    `--allow-fs-read=${join(uhd, "dist")}`,
    "--disallow-code-generation-from-strings",
    `--max-old-space-size=${options.maxHeapMb ?? 1024}`,
    "--no-warnings",
    join(work, "runner.mjs"),
    join(work, jobsFile),
  ];
  // nothing of the caller's environment: no credentials reach the source
  const env: Record<string, string> = process.platform === "win32" && process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {};
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, args, { cwd: work, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, limit);
    child.stdout.on("data", (b: Buffer) => stdout.push(b));
    child.stderr.on("data", (b: Buffer) => stderr.push(b));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolveRun({ results: [], stopped: `could not start the confined evaluation: ${e.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const results: Raw[] = [];
      for (const chunk of Buffer.concat(stdout).toString("utf8").split(RESULT_MARK).slice(1)) {
        try {
          const r = JSON.parse(chunk.split("\n")[0]) as Raw;
          if (r && typeof r.key === "string") results.push(r);
        } catch {
          // a line that is not a result: ignore
        }
      }
      if (timedOut) return resolveRun({ results, stopped: `its evaluation took longer than ${limit} ms` });
      if (code !== 0) {
        const why = Buffer.concat(stderr).toString("utf8").split("\n").find((l) => /Error|denied|heap/i.test(l))?.trim() ?? `exit code ${code}`;
        return resolveRun({ results, stopped: `its evaluation stopped: ${why}` });
      }
      resolveRun({ results });
    });
  });
}
