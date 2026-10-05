/**
 * Definition source (docs/library-protocol.md § 4.6): the TypeScript a
 * revision's definition is written in, shipped beside the definition the
 * way an npm package ships its code.
 *
 * Pure: no file system, no TypeScript compiler. The rules here are judged
 * from the text alone with a small tokenizer, so any library, client or
 * conformance run applies the same ones. Evaluating the source is the
 * consumer's job (it needs a TypeScript loader); `evaluatedDefinition` turns
 * what the evaluation produced into the definition the digest is taken of.
 */
import { definitionDigest, isSafePath, sha256Hex } from "./envelope.js";
import type { PartRevisionEnvelope, RevisionSource, SourceFile } from "./types.js";

/** The one package definition source may import (§ 4.6.2). */
export const SOURCE_PACKAGE = "@deltarobotics/uhd";

/** The media type of a source file. */
export const SOURCE_MEDIA_TYPE = "text/typescript";

// ---------------------------------------------------------------------------
// Versions and ranges: the npm range subset § 4.6.1 allows
// ---------------------------------------------------------------------------

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

type Version = [number, number, number, string | undefined];

function parseVersion(v: string): Version | undefined {
  const m = VERSION.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4]] : undefined;
}

function compare(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return (a[i] as number) - (b[i] as number);
  if (a[3] === b[3]) return 0;
  if (a[3] === undefined) return 1;
  if (b[3] === undefined) return -1;
  return a[3] < b[3] ? -1 : 1;
}

type Comparator = { op: "<" | "<=" | ">" | ">=" | "="; v: Version };

/** A partial version (`1`, `1.2`, `1.2.x`, `*`) as [major, minor, patch] with undefined for wildcards. */
function partial(s: string): (number | undefined)[] | undefined {
  if (s === "*" || s === "x" || s === "X" || s === "") return [undefined, undefined, undefined];
  const m = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/.exec(s);
  if (!m) return undefined;
  const n = (x: string | undefined) => (x === undefined || /^[xX*]$/.test(x) ? undefined : Number(x));
  return [n(m[1]), n(m[2]), n(m[3])];
}

/** One space-separated set of comparators; undefined when it does not parse. */
function comparators(set: string): Comparator[] | undefined {
  const out: Comparator[] = [];
  const s = set.trim();
  // hyphen range: 1.2.3 - 2.3.4
  const hy = /^(\S+)\s+-\s+(\S+)$/.exec(s);
  if (hy) {
    const lo = parseVersion(hy[1]);
    const hi = parseVersion(hy[2]);
    return lo && hi ? [{ op: ">=", v: lo }, { op: "<=", v: hi }] : undefined;
  }
  for (const raw of s.split(/\s+/).filter(Boolean)) {
    const m = /^(\^|~|>=|<=|>|<|=)?(.*)$/.exec(raw)!;
    const op = m[1] ?? "";
    const exact = parseVersion(m[2]);
    const p = exact ? [exact[0], exact[1], exact[2]] : partial(m[2]);
    if (!p) return undefined;
    const [M, mi, pa] = p;
    const v = (a: number, b: number, c: number, pre?: string): Version => [a, b, c, pre];
    const pre = exact?.[3];
    if (op === "^") {
      if (M === undefined) continue;
      const lo = v(M, mi ?? 0, pa ?? 0, pre);
      const hi = M > 0 || mi === undefined ? v(M + 1, 0, 0) : mi > 0 || pa === undefined ? v(0, mi + 1, 0) : v(0, 0, pa + 1);
      out.push({ op: ">=", v: lo }, { op: "<", v: hi });
    } else if (op === "~") {
      if (M === undefined) continue;
      out.push({ op: ">=", v: v(M, mi ?? 0, pa ?? 0, pre) }, { op: "<", v: mi === undefined ? v(M + 1, 0, 0) : v(M, mi + 1, 0) });
    } else if (op === "" || op === "=") {
      if (M === undefined) continue;
      if (mi === undefined) out.push({ op: ">=", v: v(M, 0, 0) }, { op: "<", v: v(M + 1, 0, 0) });
      else if (pa === undefined) out.push({ op: ">=", v: v(M, mi, 0) }, { op: "<", v: v(M, mi + 1, 0) });
      else out.push({ op: "=", v: v(M, mi, pa, pre) });
    } else {
      if (M === undefined) {
        if (op === "<" || op === ">") out.push({ op: "<", v: v(0, 0, 0) }); // matches nothing
        continue;
      }
      out.push({ op: op as Comparator["op"], v: v(M, mi ?? 0, pa ?? 0, pre) });
    }
  }
  return out;
}

function parseRange(range: string): Comparator[][] | undefined {
  if (typeof range !== "string" || range.trim() === "" || range.length > 256) return undefined;
  const sets = range.split("||").map(comparators);
  return sets.every((s) => s !== undefined) ? (sets as Comparator[][]) : undefined;
}

/** Whether `range` is a version range in the subset § 4.6.1 allows (npm syntax: `^`, `~`, comparators, `x`, hyphen ranges, `||`). */
export const isVersionRange = (range: string): boolean => parseRange(range) !== undefined;

/**
 * Whether `version` satisfies `range` (npm semantics, without npm's
 * pre-release opt-in rule: a pre-release counts by its order alone).
 * False for a version or range that does not parse.
 */
export function satisfiesRange(version: string, range: string): boolean {
  const v = parseVersion(version);
  const sets = parseRange(range);
  if (!v || !sets) return false;
  return sets.some((set) =>
    set.every(({ op, v: c }) => {
      const d = compare(v, c);
      return op === "<" ? d < 0 : op === "<=" ? d <= 0 : op === ">" ? d > 0 : op === ">=" ? d >= 0 : d === 0;
    }),
  );
}

/** The lowest version a range admits, when it has a lower bound (`^0.2.0` → `0.2.0`). */
export function minVersion(range: string): string | undefined {
  const sets = parseRange(range);
  if (!sets) return undefined;
  const lows = sets
    .map((set) => set.filter((c) => c.op === ">=" || c.op === "=").map((c) => c.v))
    .map((l) => l.sort(compare).at(-1))
    .filter((x): x is Version => !!x)
    .sort(compare);
  const lo = lows[0];
  return lo ? `${lo[0]}.${lo[1]}.${lo[2]}${lo[3] ? `-${lo[3]}` : ""}` : undefined;
}

// ---------------------------------------------------------------------------
// Tokenizer: enough of TypeScript's lexical grammar to tell code from
// comments, strings and template text
// ---------------------------------------------------------------------------

export interface SourceToken {
  type: "ident" | "string" | "template" | "number" | "punct" | "regex";
  /** Identifier name, punctuator, or a string's value (escapes kept as written). */
  value: string;
  /** Offsets in the text; for a string, of the whole literal including its quotes. */
  start: number;
  end: number;
}

const ID_START = /[A-Za-z_$À-￿]/;
const ID_PART = /[A-Za-z0-9_$À-￿]/;
const PUNCT3 = ["...", "===", "!==", "**=", "<<=", ">>=", ">>>", "&&=", "||=", "??="];
const PUNCT2 = ["=>", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "**", "<<", ">>"];
/** After these keywords a `/` starts a regular expression. */
const REGEX_AFTER_KEYWORD = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);

/** Tokens of a TypeScript module; throws on an unterminated string, comment or template. */
export function tokenizeSource(text: string): SourceToken[] {
  const out: SourceToken[] = [];
  /** Open braces: "{" for code, "${" for a template substitution. */
  const braces: string[] = [];
  let i = 0;
  const n = text.length;
  const regexAllowed = () => {
    const prev = out.at(-1);
    if (!prev) return true;
    if (prev.type === "punct") return ![")", "]", "}"].includes(prev.value);
    if (prev.type === "ident") return REGEX_AFTER_KEYWORD.has(prev.value);
    return false;
  };
  /** Scan template text from i (just after "`" or "}"); stops after "`" or "${". */
  const templateText = (start: number) => {
    let j = i;
    for (;;) {
      if (j >= n) throw new Error(`unterminated template literal at offset ${start}`);
      const c = text[j];
      if (c === "\\") j += 2;
      else if (c === "`") {
        out.push({ type: "template", value: text.slice(start, j + 1), start, end: j + 1 });
        i = j + 1;
        return;
      } else if (c === "$" && text[j + 1] === "{") {
        out.push({ type: "template", value: text.slice(start, j + 2), start, end: j + 2 });
        braces.push("${");
        i = j + 2;
        return;
      } else j++;
    }
  };
  while (i < n) {
    const c = text[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v" || c === "﻿" || c === " " || c === " " || c === " ") {
      i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) throw new Error(`unterminated comment at offset ${i}`);
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const start = i;
      let j = i + 1;
      while (j < n && text[j] !== c) {
        if (text[j] === "\\") j++;
        else if (text[j] === "\n") throw new Error(`unterminated string at offset ${start}`);
        j++;
      }
      if (j >= n) throw new Error(`unterminated string at offset ${start}`);
      out.push({ type: "string", value: text.slice(start + 1, j), start, end: j + 1 });
      i = j + 1;
      continue;
    }
    if (c === "`") {
      const start = i;
      i++;
      templateText(start);
      continue;
    }
    if (c === "}" && braces.at(-1) === "${") {
      braces.pop();
      const start = i;
      i++;
      templateText(start);
      continue;
    }
    if (ID_START.test(c) || (c === "\\" && text[i + 1] === "u")) {
      const start = i;
      while (i < n && (ID_PART.test(text[i]) || (text[i] === "\\" && text[i + 1] === "u"))) i += text[i] === "\\" ? 2 : 1;
      // a unicode escape in an identifier spells a name the rules below cannot see: refuse it
      const value = text.slice(start, i);
      if (value.includes("\\")) throw new Error(`escaped identifier at offset ${start}`);
      out.push({ type: "ident", value, start, end: i });
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(text[i + 1] ?? ""))) {
      const start = i;
      i++;
      while (i < n && /[0-9A-Za-z_.]/.test(text[i])) {
        if ((text[i] === "e" || text[i] === "E") && (text[i + 1] === "+" || text[i + 1] === "-")) i++;
        i++;
      }
      out.push({ type: "number", value: text.slice(start, i), start, end: i });
      continue;
    }
    if (c === "/" && regexAllowed()) {
      const start = i;
      let j = i + 1;
      let cls = false;
      while (j < n) {
        const d = text[j];
        if (d === "\\") j++;
        else if (d === "[") cls = true;
        else if (d === "]") cls = false;
        else if (d === "/" && !cls) break;
        else if (d === "\n") throw new Error(`unterminated regular expression at offset ${start}`);
        j++;
      }
      if (j >= n) throw new Error(`unterminated regular expression at offset ${start}`);
      j++;
      while (j < n && /[a-z]/.test(text[j])) j++;
      out.push({ type: "regex", value: text.slice(start, j), start, end: j });
      i = j;
      continue;
    }
    const three = text.slice(i, i + 4) === ">>>=" ? ">>>=" : PUNCT3.find((p) => text.startsWith(p, i));
    const p = three ?? PUNCT2.find((q) => text.startsWith(q, i)) ?? c;
    // `?.` followed by a digit is a conditional, not optional chaining
    const value = p === "?." && /[0-9]/.test(text[i + 2] ?? "") ? "?" : p;
    if (value === "{") braces.push("{");
    else if (value === "}") braces.pop();
    out.push({ type: "punct", value, start: i, end: i + value.length });
    i += value.length;
  }
  if (braces.includes("${")) throw new Error("unterminated template substitution");
  return out;
}

// ---------------------------------------------------------------------------
// Imports and the source closure
// ---------------------------------------------------------------------------

export interface SourceImport {
  specifier: string;
  /** Offsets of the string literal (quotes included), for rewriting. */
  start: number;
  end: number;
  /** `import("…")`: never allowed, reported by the lint. */
  dynamic?: boolean;
}

/** Module specifiers a source file imports or re-exports, in order. */
export function sourceImports(text: string, tokens: SourceToken[] = tokenizeSource(text)): SourceImport[] {
  const out: SourceImport[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    const prev = tokens[k - 1];
    if (t.type !== "string") continue;
    const memberOrKey = (x?: SourceToken) => x?.type === "punct" && (x.value === "." || x.value === "?.");
    // import "x" | import x from "x" | export … from "x" | import x = require("x") (reported by the lint)
    if (prev?.type === "ident" && prev.value === "from" && !memberOrKey(tokens[k - 2])) out.push({ specifier: t.value, start: t.start, end: t.end });
    else if (prev?.type === "ident" && prev.value === "import" && !memberOrKey(tokens[k - 2])) out.push({ specifier: t.value, start: t.start, end: t.end });
    else if (prev?.type === "punct" && prev.value === "(" && tokens[k - 2]?.type === "ident" && tokens[k - 2].value === "import" && !memberOrKey(tokens[k - 3]))
      out.push({ specifier: t.value, start: t.start, end: t.end, dynamic: true });
  }
  return out;
}

/** Normalise `a/./b/../c` to `a/c`; undefined when it climbs above the root. */
function normalise(path: string): string | undefined {
  const parts: string[] = [];
  for (const s of path.split("/")) {
    if (s === "" || s === ".") continue;
    if (s === "..") {
      if (!parts.length) return undefined;
      parts.pop();
    } else parts.push(s);
  }
  return parts.join("/");
}

/**
 * The closure path a relative specifier names, from the file `from`: the
 * TypeScript file it resolves to (`./x.js` → `x.ts`, `./x` → `x.ts` or
 * `x/index.ts`, `./x.ts` → `x.ts`), when it is one of `paths`. Undefined for
 * a bare specifier or one that names no file of the closure.
 */
export function resolveSourceImport(from: string, specifier: string, paths: Iterable<string>): string | undefined {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return undefined;
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const joined = normalise(dir ? `${dir}/${specifier}` : specifier);
  if (joined === undefined || joined === "") return undefined;
  const set = paths instanceof Set ? (paths as Set<string>) : new Set(paths);
  const candidates = /\.(m|c)?js$/.test(joined)
    ? [joined.replace(/\.(m|c)?js$/, (_, m: string | undefined) => `.${m ?? ""}ts`)]
    : /\.(m|c)?ts$/.test(joined)
      ? [joined]
      : [`${joined}.ts`, `${joined}/index.ts`];
  return candidates.find((c) => set.has(c));
}

// ---------------------------------------------------------------------------
// The lint (§ 4.6.2)
// ---------------------------------------------------------------------------

/**
 * Names definition source may not use as a variable (not as a property
 * name or object key): ways out to the host (process, modules, network,
 * timers, the global object) and ways to run code that is not in the file.
 */
export const SOURCE_FORBIDDEN_NAMES = [
  "process", "require", "module", "exports", "__dirname", "__filename",
  "eval", "Function", "AsyncFunction", "GeneratorFunction",
  "globalThis", "global", "window", "self", "Deno", "Bun",
  "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "navigator", "importScripts",
  "Worker", "SharedWorker", "WebAssembly", "SharedArrayBuffer", "Atomics",
  "setTimeout", "setInterval", "setImmediate", "queueMicrotask", "clearTimeout", "clearInterval",
  "localStorage", "sessionStorage", "indexedDB", "caches", "document", "crypto", "performance",
] as const;

/** Names forbidden even as a property: the escape hatches to `Function` through any object. */
export const SOURCE_FORBIDDEN_PROPERTIES = ["constructor", "__proto__", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"] as const;

export interface SourceProblem {
  code: string;
  message: string;
  /** The file (a closure path) and 1-based line, when the problem is in one. */
  path?: string;
  line?: number;
}

const lineAt = (text: string, offset: number) => text.slice(0, offset).split("\n").length;

/**
 * The lint of § 4.6.2 over a source closure: each file is a TypeScript ES
 * module whose imports are static and name either `@deltarobotics/uhd`
 * (`packages`) or another file of the closure; it uses none of
 * SOURCE_FORBIDDEN_NAMES as a variable and none of
 * SOURCE_FORBIDDEN_PROPERTIES at all, nor `import.meta`, dynamic `import()`,
 * `with`, or `debugger`; and every file is reached from `entry`.
 *
 * This keeps library source to declarative definition code. It is a gate,
 * not a sandbox: the source still runs with the consumer's privileges when
 * evaluated, as any package code does.
 */
export function lintSource(files: { path: string; text: string }[], entry: string, options: { packages?: string[] } = {}): SourceProblem[] {
  const packages = options.packages ?? [SOURCE_PACKAGE];
  const out: SourceProblem[] = [];
  const paths = new Set(files.map((f) => f.path));
  if (!paths.has(entry)) out.push({ code: "SOURCE_ENTRY_MISSING", message: `the entry ${entry} is not among the source files` });
  const edges = new Map<string, string[]>();
  const forbidden = new Set<string>(SOURCE_FORBIDDEN_NAMES);
  const forbiddenProps = new Set<string>(SOURCE_FORBIDDEN_PROPERTIES);
  for (const f of files) {
    const add = (code: string, message: string, offset?: number) => out.push({ code, message, path: f.path, ...(offset !== undefined ? { line: lineAt(f.text, offset) } : {}) });
    if (!isSafePath(f.path)) add("SOURCE_PATH", `${f.path} is not a normalised relative path`);
    if (!/\.(m|c)?ts$/.test(f.path) || /\.d\.(m|c)?ts$/.test(f.path)) add("SOURCE_NOT_TYPESCRIPT", `${f.path} is not a TypeScript module (.ts)`);
    let tokens: SourceToken[];
    try {
      tokens = tokenizeSource(f.text);
    } catch (e) {
      add("SOURCE_SYNTAX", `${f.path}: ${(e as Error).message}`);
      edges.set(f.path, []);
      continue;
    }
    const next: string[] = [];
    for (const imp of sourceImports(f.text, tokens)) {
      if (imp.dynamic) {
        add("SOURCE_DYNAMIC_IMPORT", `dynamic import("${imp.specifier}")`, imp.start);
        continue;
      }
      if (packages.includes(imp.specifier)) continue;
      const target = resolveSourceImport(f.path, imp.specifier, paths);
      if (target) next.push(target);
      else if (imp.specifier.startsWith(".")) add("SOURCE_IMPORT_UNRESOLVED", `"${imp.specifier}" names no file of the source closure`, imp.start);
      else add("SOURCE_IMPORT_FORBIDDEN", `imports "${imp.specifier}"; library source imports only ${packages.join(", ")} and its own closure`, imp.start);
    }
    edges.set(f.path, next);
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k];
      if (t.type !== "ident") continue;
      const prev = tokens[k - 1];
      const after = tokens[k + 1];
      const member = prev?.type === "punct" && (prev.value === "." || prev.value === "?.");
      if (forbiddenProps.has(t.value)) {
        add("SOURCE_FORBIDDEN", `uses ${t.value}`, t.start);
        continue;
      }
      if (t.value === "import" && !member) {
        // import("literal") is reported with its specifier above
        if (after?.type === "punct" && after.value === "(") tokens[k + 2]?.type !== "string" && add("SOURCE_DYNAMIC_IMPORT", "dynamic import()", t.start);
        else if (after?.type === "punct" && after.value === ".") add("SOURCE_FORBIDDEN", "uses import.meta", t.start);
        continue;
      }
      if ((t.value === "with" || t.value === "debugger") && !member && !(after?.type === "punct" && after.value === ":")) {
        // `with` is also an import attribute keyword: `import x from "y" with { type: "json" }`
        if (t.value === "with" && prev?.type === "string") add("SOURCE_FORBIDDEN", "import attributes", t.start);
        else add("SOURCE_FORBIDDEN", `uses ${t.value}`, t.start);
        continue;
      }
      if (!forbidden.has(t.value) || member) continue;
      // an object key (`{ process: 1 }`, `, fetch: …`) or a property signature names a property, not the global
      const key = after?.type === "punct" && (after.value === ":" || (after.value === "?" && tokens[k + 2]?.value === ":")) && prev?.type === "punct" && (prev.value === "{" || prev.value === ",");
      if (key) continue;
      add("SOURCE_FORBIDDEN", `uses ${t.value}`, t.start);
    }
  }
  // the closure is exact: every file is reached from the entry
  if (paths.has(entry)) {
    const reached = new Set<string>();
    const walk = (p: string) => {
      if (reached.has(p)) return;
      reached.add(p);
      for (const q of edges.get(p) ?? []) walk(q);
    };
    walk(entry);
    for (const p of paths) if (!reached.has(p)) out.push({ code: "SOURCE_UNREACHABLE", message: `${p} is not imported from ${entry}, directly or through other files`, path: p });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The record and the evaluation (§ 4.6)
// ---------------------------------------------------------------------------

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** Whether an envelope's `source` carries definition source (§ 4.6). */
export const hasDefinitionSource = (source: RevisionSource | undefined): source is RevisionSource & Required<Pick<RevisionSource, "entry" | "export" | "files" | "requires">> =>
  !!source && Array.isArray(source.files) && source.files.length > 0;

/**
 * The rules of § 4.6.1 that the JSON Schema cannot state, for an envelope
 * whose `source` carries files: the entry among them, paths normalised,
 * unique and apart from the revision's other files, requirements that parse
 * and admit the envelope's `uhdSchema`. The lint needs the bytes
 * (`lintSource`); evaluating needs a TypeScript loader.
 */
export function sourceProblems(env: Pick<PartRevisionEnvelope, "uhdSchema" | "artifacts" | "evidence" | "source">): SourceProblem[] {
  const out: SourceProblem[] = [];
  const s = env.source;
  if (!s || s.files === undefined) {
    for (const k of ["entry", "export", "requires"] as const) if (s?.[k] !== undefined) out.push({ code: "SOURCE_INCOMPLETE", message: `source.${k} without source.files` });
    return out;
  }
  const add = (code: string, message: string) => out.push({ code, message });
  if (!Array.isArray(s.files) || s.files.length === 0) add("SOURCE_INCOMPLETE", "source.files is empty");
  if (typeof s.entry !== "string") add("SOURCE_INCOMPLETE", "source.files without source.entry");
  if (typeof s.export !== "string" || !(s.export === "default" || IDENTIFIER.test(s.export))) add("SOURCE_EXPORT", "source.export must be an export name");
  const others = new Set([...env.artifacts.map((a) => a.path), ...env.evidence.flatMap((e) => (e.path !== undefined ? [e.path] : []))]);
  const seen = new Set<string>();
  for (const f of s.files ?? []) {
    if (!isSafePath(f.path)) add("SOURCE_PATH", `${f.path} is not a normalised relative path`);
    else if (seen.has(f.path)) add("SOURCE_PATH_DUPLICATE", `${f.path} listed twice`);
    else if (others.has(f.path)) add("SOURCE_PATH_DUPLICATE", `${f.path} is also an artifact or evidence path`);
    seen.add(f.path);
    if (!HEX64.test(f.sha256 ?? "")) add("SOURCE_FILE", `${f.path}: sha256 must be 64 lower-case hex digits`);
    if (!Number.isInteger(f.size) || f.size < 0) add("SOURCE_FILE", `${f.path}: size must be a non-negative integer`);
  }
  if (typeof s.entry === "string" && !seen.has(s.entry)) add("SOURCE_ENTRY_MISSING", `source.entry ${s.entry} is not among source.files`);
  const req = s.requires;
  if (!req || typeof req !== "object") add("SOURCE_REQUIRES", "source.files without source.requires");
  else {
    if (!isVersionRange(req.uhd)) add("SOURCE_REQUIRES", `requires.uhd ${JSON.stringify(req.uhd)} is not a version range`);
    else if (!satisfiesRange(env.uhdSchema, req.uhd)) add("SOURCE_REQUIRES", `requires.uhd ${req.uhd} does not admit the envelope's uhdSchema ${env.uhdSchema}`);
    if (!isVersionRange(req.typescript)) add("SOURCE_REQUIRES", `requires.typescript ${JSON.stringify(req.typescript)} is not a version range`);
  }
  return out;
}

/**
 * The definition an evaluated source module produced (§ 4.6.3): the export
 * `source.export` of the entry module, as JSON keeps it. Throws when the
 * export is missing or is not a definition.
 */
export function evaluatedDefinition(namespace: Record<string, unknown>, exportName: string): Record<string, unknown> {
  const value = namespace[exportName];
  if (!value || typeof value !== "object") throw new Error(`the entry module has no export ${exportName}`);
  const json = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  if (typeof json.id !== "string" || !Array.isArray(json.interfaces)) throw new Error(`export ${exportName} is not a UHD ModuleDef`);
  return json;
}

/** `definitionDigest` of what an evaluated source module produced: equal to the envelope's when the source is the revision's (§ 4.6.3). */
export const evaluatedDefinitionDigest = async (namespace: Record<string, unknown>, exportName: string): Promise<string> => definitionDigest(evaluatedDefinition(namespace, exportName));

/** Source files by path, from their bytes; checks each against its SHA-256 and size. */
export async function verifySourceFiles(files: SourceFile[], bytesOf: (f: SourceFile) => Promise<Uint8Array>): Promise<{ files: { path: string; text: string }[]; problems: SourceProblem[] }> {
  const out: { path: string; text: string }[] = [];
  const problems: SourceProblem[] = [];
  for (const f of files) {
    const bytes = await bytesOf(f);
    if ((await sha256Hex(bytes)) !== f.sha256 || bytes.length !== f.size) problems.push({ code: "SOURCE_FILE_DIGEST", message: `${f.path} does not match its sha256 and size`, path: f.path });
    out.push({ path: f.path, text: new TextDecoder().decode(bytes) });
  }
  return { files: out, problems };
}
