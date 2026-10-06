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
 * Each closure gets a child process of its own. Modules in one process share
 * its globals, its module instances and its output, so a closure evaluated
 * beside another could alter the other's result, or write a result in its
 * name; a process of its own leaves it nothing to reach but its own result.
 *
 * What the child returns is data: the entry's export as JSON. A caller
 * takes the definition digest of it (`definitionDigest`) and compares it
 * with the pinned one. A module that escapes nothing but tampers with the
 * child's own output can only make its own result disagree with the pin.
 * The parent keeps a bounded amount of that output (`maxOutputBytes`) and
 * stops a child that writes more.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
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
  /** Wall-clock limit for one closure. Default 60 s. */
  timeoutMs?: number;
  /** Heap limit of a closure's child process, in MB. Default 1024. */
  maxHeapMb?: number;
  /** The most a closure's child may write to its output (the result and anything the source logs), in bytes; past it the child is stopped. Default 16 MiB. */
  maxOutputBytes?: number;
  /** Child processes at a time. Default: the available parallelism, at most 4. */
  concurrency?: number;
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

/** The child's program: import the entry and write its export as JSON. */
const RUNNER = `import { pathToFileURL } from "node:url";
const stringify = JSON.stringify, parse = JSON.parse, write = process.stdout.write.bind(process.stdout);
const [entry, name] = process.argv.slice(2);
let r;
try {
  const ns = await import(pathToFileURL(entry).href);
  const v = ns[name];
  r = !v || typeof v !== "object" ? { error: "the entry has no export " + name } : { value: parse(stringify(v)) };
} catch (e) {
  r = { error: String((e && e.message) || e).split("\\n")[0] };
}
write(${JSON.stringify(RESULT_MARK)} + stringify(r) + "\\n");
`;

type Job = { key: string; dir: string; entry: string; export: string };
type Raw = { value?: unknown; error?: string };

/**
 * Evaluate source closures, each in a confined child process of its own (see
 * the module comment), and take the definition digest of each export. Closures should
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
        jobs.push({ key: s.key, dir: at, entry: join(at, ...jsPath(s.entry).split("/")), export: s.export });
      } catch (e) {
        early.push({ key: s.key, error: `does not compile: ${(e as Error).message.split("\n")[0]}` });
      }
    }
    writeFileSync(join(work, "runner.mjs"), RUNNER);
    // one child per closure, a few at a time: nothing a closure does reaches another's result
    const raw = new Map<string, Raw>();
    let next = 0;
    const lane = async () => {
      while (next < jobs.length) {
        const j = jobs[next++];
        raw.set(j.key, await runChild(work, uhd, j, options));
      }
    };
    const lanes = Math.max(1, Math.min(jobs.length, Math.floor(options.concurrency ?? Math.min(4, availableParallelism()))));
    await Promise.all(Array.from({ length: lanes }, lane));
    const byKey = new Map<string, ConfinedResult>(early.map((r) => [r.key, r]));
    for (const j of jobs) {
      const r = raw.get(j.key)!;
      if (r.error !== undefined || !r.value || typeof r.value !== "object") byKey.set(j.key, { key: j.key, error: String(r.error ?? "no value") });
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

/** What is kept of a child's error output: enough for the line that says why it stopped. */
const STDERR_KEPT = 64 * 1024;

/** One closure in a child process of its own: the result its runner wrote, or why there is none. */
function runChild(work: string, uhd: string, job: Job, options: ConfinedOptions): Promise<Raw> {
  const limit = options.timeoutMs ?? 60_000;
  const maxOutput = options.maxOutputBytes ?? 16 * 1024 * 1024;
  const args = [
    "--permission",
    // of the work folder, this closure and what resolves the runner and UHD: not the other closures
    `--allow-fs-read=${job.dir}`,
    `--allow-fs-read=${join(work, "runner.mjs")}`,
    `--allow-fs-read=${join(work, "package.json")}`,
    `--allow-fs-read=${join(work, "node_modules")}`,
    // of UHD, its manifest and its built modules only
    `--allow-fs-read=${join(uhd, "package.json")}`,
    `--allow-fs-read=${join(uhd, "dist")}`,
    "--disallow-code-generation-from-strings",
    `--max-old-space-size=${options.maxHeapMb ?? 1024}`,
    "--no-warnings",
    join(work, "runner.mjs"),
    job.entry,
    job.export,
  ];
  // nothing of the caller's environment: no credentials reach the source
  const env: Record<string, string> = process.platform === "win32" && process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {};
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, args, { cwd: work, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let written = 0;
    let kept = 0;
    let killed: string | undefined;
    const stop = (why: string) => {
      killed ??= why;
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => stop(`its evaluation took longer than ${limit} ms`), limit);
    // what the source writes is the source's to choose: count it all, keep none past the limit
    const over = (b: Buffer): boolean => {
      if (killed) return true;
      written += b.length;
      if (written > maxOutput) stop(`its evaluation wrote more than ${maxOutput} bytes of output`);
      return !!killed;
    };
    child.stdout.on("data", (b: Buffer) => {
      if (!over(b)) stdout.push(b);
    });
    child.stderr.on("data", (b: Buffer) => {
      if (over(b) || kept >= STDERR_KEPT) return;
      stderr.push(b.subarray(0, STDERR_KEPT - kept));
      kept += b.length;
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolveRun({ error: `could not start the confined evaluation: ${e.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return resolveRun({ error: killed });
      if (code !== 0) {
        const why = Buffer.concat(stderr).toString("utf8").split("\n").find((l) => /Error|denied|heap/i.test(l))?.trim() ?? `exit code ${code}`;
        return resolveRun({ error: `its evaluation stopped: ${why}` });
      }
      // the runner writes its result last
      const out = Buffer.concat(stdout).toString("utf8");
      const at = out.lastIndexOf(RESULT_MARK);
      try {
        const r = at < 0 ? undefined : (JSON.parse(out.slice(at + RESULT_MARK.length).split("\n")[0]) as Raw | null);
        if (r && typeof r === "object") return resolveRun(r);
      } catch {
        // not a result
      }
      resolveRun({ error: "the evaluation returned nothing for it" });
    });
  });
}
