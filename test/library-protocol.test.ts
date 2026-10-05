/**
 * The library protocol `uhd-library/v1` (docs/library-protocol.md): envelope
 * digests and rules, the JSON Schema and its published file, and the
 * conformance kit against an in-process library, clean and with one fault at
 * a time.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LIBRARY_SCHEMA,
  canonicalJson,
  closureProblems,
  definitionDigest,
  definitionFile,
  envelopeDigest,
  envelopeProblems,
  formatConformance,
  isRedistributable,
  revisionDistribution,
  runConformance,
  sealEnvelope,
  sha256Hex,
  taxonomyAncestors,
  underTaxonomyPath,
  uhdSchemaInRange,
  validateShape,
  evaluatedDefinitionDigest,
  isVersionRange,
  lintSource,
  minVersion,
  resolveSourceImport,
  satisfiesRange,
  sourceImports,
  sourceProblems,
  type PartRevisionEnvelope,
} from "../src/library/index.js";
import { fakeLibrary, gimbalSource, type Fault } from "./fixtures/fake-library.js";

/** Evaluate a source closure the way a TypeScript consumer does: lay it out in a directory and import the entry. */
const evaluate = async (source: { files: { path: string; text: string }[]; entry: string }): Promise<Record<string, unknown>> => {
  const dir = mkdtempSync(join(tmpdir(), "uhd-source-"));
  try {
    for (const f of source.files) {
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.text);
    }
    return (await import(/* @vite-ignore */ pathToFileURL(join(dir, source.entry)).href)) as Record<string, unknown>;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const statusOf = (r: Awaited<ReturnType<typeof runConformance>>) => Object.fromEntries(r.checks.map((c) => [c.id, c.status]));

describe("digests", () => {
  it("canonical JSON sorts members at every depth and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: undefined, x: 2 }], c: "é" } })).toBe('{"a":{"c":"é","d":[3,{"x":2,"z":1}]},"b":1}');
  });

  it("the definition file form is sorted, two-space indented, with a final line feed", async () => {
    expect(definitionFile({ name: "N", id: "x" })).toBe('{\n  "id": "x",\n  "name": "N"\n}\n');
    expect(await definitionDigest({ name: "N", id: "x" })).toBe(`sha256:${await sha256Hex('{\n  "id": "x",\n  "name": "N"\n}\n')}`);
    // a known vector: SHA-256 of "abc"
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("the envelope digest leaves out the publish record", async () => {
    const { envelopes } = await fakeLibrary();
    const env = envelopes[0];
    const other = { ...env, publisher: { name: "someone else" }, createdAt: "2030-01-01T00:00:00Z", source: { repository: "elsewhere" } };
    expect(await envelopeDigest(other)).toBe(env.digest);
    expect(await envelopeDigest({ ...env, revision: 7 })).not.toBe(env.digest);
  });

  it("taxonomy paths match by whole segments", () => {
    expect(underTaxonomyPath("sensor.motion", "sensor")).toBe(true);
    expect(underTaxonomyPath("sensor", "sensor")).toBe(true);
    expect(underTaxonomyPath("sensors.motion", "sensor")).toBe(false);
    expect(taxonomyAncestors("a.b.c")).toEqual(["a", "a.b", "a.b.c"]);
  });

  it("UHD versions are compared within a range", () => {
    expect(uhdSchemaInRange("0.2.5", { min: "0.2.0", below: "0.3.0" })).toBe(true);
    expect(uhdSchemaInRange("0.3.0", { min: "0.2.0", below: "0.3.0" })).toBe(false);
    expect(uhdSchemaInRange("banana", { min: "0.2.0", below: "0.3.0" })).toBe(false);
  });
});

describe("envelope rules", () => {
  const base = async (): Promise<PartRevisionEnvelope> => (await fakeLibrary()).envelopes.find((e) => e.partId === "acme-gimbal" && e.revision === 2)!;

  it("a sealed envelope has no problems and the right shape", async () => {
    const env = await base();
    expect(validateShape("envelope", env)).toEqual([]);
    expect(await envelopeProblems(env)).toEqual([]);
    expect(await envelopeProblems(env, { expect: { partId: "acme-gimbal", revision: 2, digest: env.digest } })).toEqual([]);
  });

  it("finds edited content, unpinned children, unaccounted files and broken lineage", async () => {
    const env = await base();
    const codes = async (e: PartRevisionEnvelope, schemas?: string[]) => (await envelopeProblems(e, schemas ? { schemas } : {})).map((p) => p.code);
    expect(await codes({ ...env, definition: { ...env.definition, name: "edited" } })).toEqual(["DEFINITION_DIGEST", "DIGEST"]);
    expect(await codes(await sealEnvelope({ ...env, dependencies: [] }))).toEqual(["DEPENDENCY_MISSING"]);
    expect(await codes(await sealEnvelope({ ...env, artifacts: [] }))).toEqual(["ARTIFACT_UNACCOUNTED"]);
    expect(await codes(await sealEnvelope({ ...env, derivedFrom: null }))).toEqual(["DERIVED_FROM_REQUIRED"]);
    expect(await codes(await sealEnvelope({ ...env, derivedFrom: { partId: "acme-gimbal", revision: 2 } }))).toEqual(["DERIVED_FROM_ORDER"]);
    expect(await codes(await sealEnvelope({ ...env, artifacts: [...env.artifacts, { ...env.artifacts[0], path: "../escape.glb" }] }))).toEqual(["PATH_INVALID"]);
    // another identifier is accepted only when the library lists it
    const legacy = await sealEnvelope({ ...env, schema: "acme.part-revision/v1" });
    expect(await codes(legacy)).toEqual(["ENVELOPE_SCHEMA"]);
    expect(await codes(legacy, ["uhd.part-revision/v1", "acme.part-revision/v1"])).toEqual([]);
  });

  it("the schema rejects unknown envelope members", async () => {
    const env = await base();
    expect(validateShape("envelope", { ...env, price: 3 }).map((p) => p.at)).toEqual(["/price"]);
    expect(validateShape("envelope", { ...env, artifacts: [{ ...env.artifacts[0], role: "pcb" }] })[0]).toMatchObject({ at: "/artifacts/0/role" });
  });

  it("file terms: shape, licence file present, and which files block redistribution (§ 4.5)", async () => {
    const { envelopes } = await fakeLibrary();
    const screw = envelopes.find((e) => e.partId === "acme-m2-screw")!;
    expect(validateShape("envelope", screw)).toEqual([]);
    expect(await envelopeProblems(screw)).toEqual([]);
    expect(screw.artifacts.map((a) => [a.path, isRedistributable(a)])).toEqual([
      ["parts/acme-m2-screw/body.glb", true],
      ["parts/acme-m2-screw/LICENSE.txt", true],
      ["parts/acme-m2-screw/thumbnail.png", false],
    ]);
    // the thumbnail is optional: the revision is redistributable without it
    expect(revisionDistribution(screw)).toEqual({ redistributable: true, blocking: [], withheld: ["parts/acme-m2-screw/thumbnail.png"] });
    const internal = await sealEnvelope({ ...screw, artifacts: screw.artifacts.map((a) => (a.artifactId ? { ...a, terms: { distribution: "internal" as const, summary: "vendor terms forbid redistribution" } } : a)) });
    expect(revisionDistribution(internal)).toMatchObject({ redistributable: false, blocking: ["parts/acme-m2-screw/body.glb"] });
    // a file without terms is unknown
    expect(revisionDistribution({ artifacts: [{ ...screw.artifacts[0], terms: undefined }], evidence: [] }).redistributable).toBe(false);
    // terms are content: changing them changes the digest
    expect(internal.digest).not.toBe(screw.digest);
    const lost = await sealEnvelope({ ...screw, artifacts: screw.artifacts.filter((a) => a.role !== "license") });
    expect((await envelopeProblems(lost)).map((p) => p.code)).toEqual(["LICENSE_PATH"]);
    const bad = { ...screw, artifacts: [{ ...screw.artifacts[0], terms: { distribution: "public", price: 1 } }] };
    expect(validateShape("envelope", bad).map((p) => p.at)).toEqual(["/artifacts/0/terms/distribution", "/artifacts/0/terms/price"]);
  });

  it("closures: dependencies first, nothing missing, conflicts recomputed", async () => {
    const { envelopes } = await fakeLibrary();
    const screw = envelopes.find((e) => e.partId === "acme-m2-screw")!;
    const gimbal = envelopes.find((e) => e.partId === "acme-gimbal" && e.revision === 2)!;
    const root = { partId: "acme-gimbal", revision: 2 };
    expect(closureProblems({ root, revisions: [screw, gimbal], conflicts: [] }, root).problems).toEqual([]);
    expect(closureProblems({ root, revisions: [gimbal, screw], conflicts: [] }, root).problems.map((p) => p.code)).toEqual(["CLOSURE_ORDER"]);
    expect(closureProblems({ root, revisions: [gimbal], conflicts: [] }, root).problems.map((p) => p.code)).toEqual(["CLOSURE_INCOMPLETE"]);
    const imu = envelopes.find((e) => e.partId === "acme-imu")!;
    expect(closureProblems({ root, revisions: [screw, imu, gimbal], conflicts: [] }, root).problems.map((p) => p.code)).toEqual(["CLOSURE_UNREACHABLE"]);
  });
});

describe("the published JSON Schema", () => {
  it("schemas/uhd-library-v1.schema.json is the schema in src/library/schema.ts (npm run build:schemas)", () => {
    const file = JSON.parse(readFileSync(join(__dirname, "..", "schemas", "uhd-library-v1.schema.json"), "utf8"));
    expect(file).toEqual(JSON.parse(JSON.stringify(LIBRARY_SCHEMA)));
  });

  it("uses only the keywords the bundled checker implements", () => {
    const known = new Set(["$schema", "$id", "title", "description", "$defs", "type", "const", "enum", "properties", "required", "additionalProperties", "items", "minItems", "minLength", "minimum", "pattern", "anyOf", "$ref", "x-error-codes"]);
    const used = new Set<string>();
    const walk = (s: unknown, inProps = false) => {
      if (!s || typeof s !== "object") return;
      if (Array.isArray(s)) return s.forEach((x) => walk(x));
      for (const [k, v] of Object.entries(s)) {
        if (!inProps) used.add(k);
        walk(v, !inProps && (k === "properties" || k === "$defs"));
      }
    };
    walk(LIBRARY_SCHEMA);
    expect([...used].filter((k) => !known.has(k))).toEqual([]);
  });
});

describe("conformance kit", () => {
  it("passes a conforming library, every check run", async () => {
    const lib = await fakeLibrary();
    const report = await runConformance(lib.url, { fetch: lib.fetch });
    expect(report.checks.filter((c) => c.status !== "pass"), formatConformance(report)).toEqual([]);
    expect(report).toMatchObject({ ok: true, api: "https://library.test/v1", discovery: { name: "Acme test library" } });
    expect(report.checks.map((c) => c.id)).toEqual([
      "discovery",
      "discovery.api-root",
      "auth",
      "search.shape",
      "search.pagination",
      "search.q",
      "search.filters",
      "search.taxonomy",
      "search.facets",
      "search.deprecated",
      "part.detail",
      "part.revisions",
      "revision.envelope",
      "revision.definition",
      "revision.closure",
      "blobs",
      "revision.source",
      "errors",
    ]);
    expect(formatConformance(report)).toMatch(/^uhd-library\/v1 conformance of https:\/\/library\.test: ok \(18 pass, 0 fail, 0 warn, 0 skip\)/);
  });

  it("examines a named part in depth", async () => {
    const lib = await fakeLibrary();
    const report = await runConformance(lib.url, { fetch: lib.fetch, partId: "acme-gimbal" });
    expect(report.ok).toBe(true);
    expect(report.checks.find((c) => c.id === "revision.envelope")!.message).toMatch(/^acme-gimbal@2, 1 file\(s\), 1 dependenc/);
  });

  it("with bearer auth: checks the 401, then needs the token for the rest", async () => {
    const lib = await fakeLibrary({ token: "s3cret" });
    const without = await runConformance(lib.url, { fetch: lib.fetch });
    expect(statusOf(without)).toMatchObject({ discovery: "pass", auth: "pass", "search.shape": "skip", errors: "skip" });
    expect(without.checks.find((c) => c.id === "search.shape")!.message).toMatch(/requires a bearer token; pass options.token/);
    const withToken = await runConformance(lib.url, { fetch: lib.fetch, token: "s3cret" });
    expect(withToken.checks.filter((c) => c.status !== "pass").map((c) => c.id)).toEqual([]);
    expect(JSON.stringify(withToken)).not.toContain("s3cret");
  });

  it("accepts a library that withholds files whose terms are not redistributable, and only those", async () => {
    const lib = await fakeLibrary({ withhold: true });
    const report = await runConformance(lib.url, { fetch: lib.fetch, partId: "acme-m2-screw" });
    expect(report.checks.filter((c) => c.status !== "pass"), formatConformance(report)).toEqual([]);
    expect(report.checks.find((c) => c.id === "blobs")!.message).toBe("2 file(s) verified, 1 withheld as not redistributable");
    const wrong = await fakeLibrary({ faults: ["withholds-redistributable"] });
    const failed = await runConformance(wrong.url, { fetch: wrong.fetch, partId: "acme-m2-screw" });
    expect(failed.checks.find((c) => c.id === "blobs")!.status).toBe("fail");
  });

  const cases: [Fault, string, RegExp][] = [
    ["no-discovery", "discovery", /no discovery document/],
    ["tampered-envelope", "revision.envelope", /DEFINITION_DIGEST/],
    ["duplicate-page", "search.pagination", /appears on two pages/],
    ["bad-blob", "blobs", /does not hash to its address/],
    ["facet-counts", "search.facets", /but domain=\w+ matches|exceeds total/],
    ["plain-errors", "errors", /unknown part body: \/ expected object/],
    ["taxonomy-string-prefix", "search.taxonomy", /paths match by whole segments/],
    ["closure-order", "revision.closure", /is listed after/],
    ["mutable-envelope", "revision.envelope", /different bytes/],
    ["source-forbidden", "revision.source", /SOURCE_FORBIDDEN acme\/common\.ts:3: uses process/],
  ];
  for (const [fault, check, message] of cases) {
    it(`catches ${fault}`, async () => {
      const lib = await fakeLibrary({ faults: [fault] });
      const report = await runConformance(lib.url, { fetch: lib.fetch });
      expect(report.ok).toBe(false);
      const c = report.checks.find((x) => x.id === check)!;
      expect(c.status, formatConformance(report)).toBe("fail");
      expect(c.problems!.join("\n")).toMatch(message);
      // one fault fails its own check (and, without discovery, nothing else runs)
      const failed = report.checks.filter((x) => x.status === "fail").map((x) => x.id);
      if (fault === "no-discovery") expect(report.checks.filter((x) => x.status !== "skip").map((x) => x.id)).toEqual(["discovery"]);
      else if (fault !== "tampered-envelope") expect(failed).toEqual([check]);
    });
  }

  it("evaluates definition source with evaluateSource, and catches source that drifted from the definition", async () => {
    const lib = await fakeLibrary();
    const report = await runConformance(lib.url, { fetch: lib.fetch, evaluateSource: evaluate });
    expect(report.checks.find((c) => c.id === "revision.source"), formatConformance(report)).toMatchObject({ status: "pass", message: "acme-gimbal@2: 2 source file(s), evaluated to definitionDigest" });
    const drift = await fakeLibrary({ faults: ["source-drift"] });
    // without an evaluator the drift is invisible: the lint passes
    expect(statusOf(await runConformance(drift.url, { fetch: drift.fetch }))["revision.source"]).toBe("pass");
    const caught = await runConformance(drift.url, { fetch: drift.fetch, evaluateSource: evaluate });
    expect(caught.checks.find((c) => c.id === "revision.source")).toMatchObject({ status: "fail", message: expect.stringMatching(/the source evaluates to sha256:\w+, the envelope's definitionDigest is/) });
  });

  it("never throws when the library is unreachable", async () => {
    const report = await runConformance("http://127.0.0.1:9", { fetch: () => Promise.reject(new Error("connection refused")) });
    expect(report.ok).toBe(false);
    expect(report.checks[0]).toMatchObject({ id: "discovery", status: "fail", message: "connection refused" });
  });
});

describe("definition source (§ 4.6)", () => {
  it("version ranges: npm's caret, tilde, comparators, x-ranges, hyphens and alternatives", () => {
    const yes: [string, string][] = [["0.2.0", "^0.2.0"], ["0.2.9", "^0.2.0"], ["5.9.3", "^5.9.0"], ["5.10.0", "~5"], ["7.0.2", ">=5.9 <8"], ["1.2.3", "1.2.x"], ["2.0.0", "1.x || 2.x"], ["1.5.0", "1.0.0 - 2.0.0"], ["3.1.4", "*"]];
    const no: [string, string][] = [["0.3.0", "^0.2.0"], ["0.1.9", "^0.2.0"], ["6.0.0", "^5.9.0"], ["5.10.0", "~5.9.0"], ["8.0.0", ">=5.9 <8"], ["0.2.0", "banana"], ["x", "^0.2.0"]];
    for (const [v, r] of yes) expect(satisfiesRange(v, r), `${v} in ${r}`).toBe(true);
    for (const [v, r] of no) expect(satisfiesRange(v, r), `${v} in ${r}`).toBe(false);
    expect(isVersionRange("^0.2.0")).toBe(true);
    expect(isVersionRange("")).toBe(false);
    expect(minVersion("^0.2.0")).toBe("0.2.0");
    expect(minVersion(">=5.9 <8 || ^7.0.2")).toBe("5.9.0");
  });

  it("imports: static specifiers with their offsets; relative ones resolve inside the closure", () => {
    const text = `import type { A } from "@deltarobotics/uhd";\nimport { b } from "./b.js";\nexport * from "../c";\nimport "./side.js";\nconst x = { from: "not an import" };\n`;
    const imports = sourceImports(text);
    expect(imports.map((i) => i.specifier)).toEqual(["@deltarobotics/uhd", "./b.js", "../c", "./side.js"]);
    expect(text.slice(imports[1].start, imports[1].end)).toBe('"./b.js"');
    const paths = ["p/a.ts", "p/b.ts", "c/index.ts", "p/side.ts"];
    expect(resolveSourceImport("p/a.ts", "./b.js", paths)).toBe("p/b.ts");
    expect(resolveSourceImport("p/a.ts", "../c", paths)).toBe("c/index.ts");
    expect(resolveSourceImport("p/a.ts", "../../outside.js", paths)).toBeUndefined();
    expect(resolveSourceImport("p/a.ts", "@deltarobotics/uhd", paths)).toBeUndefined();
  });

  const lint = (helper: string, extra: Record<string, string> = {}) => {
    const files = { ...gimbalSource(), "acme/common.ts": helper, ...extra };
    return lintSource(Object.entries(files).map(([path, text]) => ({ path, text })), "acme-gimbal.uhd.ts").map((p) => `${p.code} ${p.path ?? ""}${p.line ? `:${p.line}` : ""} ${p.message}`);
  };
  const helper = gimbalSource()["acme/common.ts"];

  it("the lint passes declarative definition code", () => {
    expect(lint(helper)).toEqual([]);
    // property names, object keys, strings, comments and template text are not the globals
    expect(lint(`${helper}\n// process.exit()\nexport const t = { process: "x", fetch: 1 };\nexport const s = "eval(require('fs'))";\nexport const u = \`fetch \${t.process}\`;\nexport const r = /process/g.test("x") ? t.fetch : 2;\n`)).toEqual([]);
  });

  it("the lint refuses host access, other packages, dynamic code and stray files", () => {
    expect(lint(`import { readFileSync } from "node:fs";\n${helper}`)).toEqual([`SOURCE_IMPORT_FORBIDDEN acme/common.ts:1 imports "node:fs"; library source imports only @deltarobotics/uhd and its own closure`]);
    expect(lint(`${helper}export const e = process.env.HOME;\n`)).toEqual(["SOURCE_FORBIDDEN acme/common.ts:4 uses process"]);
    expect(lint(`${helper}export const e = \`\${globalThis.fetch}\`;\n`)).toEqual(["SOURCE_FORBIDDEN acme/common.ts:4 uses globalThis"]);
    expect(lint(`${helper}export const m = import("./x.js");\n`)).toEqual(['SOURCE_DYNAMIC_IMPORT acme/common.ts:4 dynamic import("./x.js")']);
    expect(lint(`${helper}export const u = import.meta.url;\n`)).toEqual(["SOURCE_FORBIDDEN acme/common.ts:4 uses import.meta"]);
    expect(lint(`${helper}export const f = [].map.constructor("return 1");\n`)).toEqual(["SOURCE_FORBIDDEN acme/common.ts:4 uses constructor"]);
    expect(lint(`${helper}export const k = eval("1");\n`)).toEqual(["SOURCE_FORBIDDEN acme/common.ts:4 uses eval"]);
    expect(lint(`import { x } from "./missing.js";\n${helper}`)).toEqual(['SOURCE_IMPORT_UNRESOLVED acme/common.ts:1 "./missing.js" names no file of the source closure']);
    expect(lint(helper, { "stray.ts": "export const a = 1;\n" })).toEqual(["SOURCE_UNREACHABLE stray.ts stray.ts is not imported from acme-gimbal.uhd.ts, directly or through other files"]);
    expect(lint(`export const s = "unterminated;\n`)[0]).toMatch(/^SOURCE_SYNTAX acme\/common.ts/);
  });

  it("the record: entry among the files, paths apart from the revision's files, requirements that admit uhdSchema", async () => {
    const env = (await fakeLibrary()).envelopes.find((e) => e.partId === "acme-gimbal" && e.revision === 2)!;
    expect(validateShape("envelope", env)).toEqual([]);
    expect(sourceProblems(env)).toEqual([]);
    expect(await envelopeProblems(env)).toEqual([]);
    const src = env.source!;
    const codes = (source: typeof src) => sourceProblems({ ...env, source }).map((p) => p.code);
    expect(codes({ ...src, entry: "nope.uhd.ts" })).toEqual(["SOURCE_ENTRY_MISSING"]);
    expect(codes({ ...src, files: [...src.files!, { ...src.files![0], path: "parts/acme-gimbal/body.glb" }] })).toEqual(["SOURCE_PATH_DUPLICATE"]);
    expect(codes({ ...src, requires: { uhd: "^0.3.0", typescript: "^5.9.0" } })).toEqual(["SOURCE_REQUIRES"]);
    expect(codes({ repository: "x", entry: "a.ts" })).toEqual(["SOURCE_INCOMPLETE"]);
    // outside the digest: a revision without source and with it are the same revision
    expect(await envelopeDigest({ ...env, source: undefined })).toBe(env.digest);
    expect(validateShape("envelope", { ...env, source: { ...src, files: [{ ...src.files![0], path: "a.js" }] } })[0]).toMatchObject({ at: "/source/files/0/path" });
  });

  it("source evaluates to the definition digest; an edit that changes the definition does not", async () => {
    const env = (await fakeLibrary()).envelopes.find((e) => e.partId === "acme-gimbal" && e.revision === 2)!;
    const files = (o?: { drift?: boolean }) => Object.entries(gimbalSource(o)).map(([path, text]) => ({ path, text }));
    expect(await evaluatedDefinitionDigest(await evaluate({ files: files(), entry: "acme-gimbal.uhd.ts" }), "ACME_GIMBAL")).toBe(env.definitionDigest);
    expect(await evaluatedDefinitionDigest(await evaluate({ files: files({ drift: true }), entry: "acme-gimbal.uhd.ts" }), "ACME_GIMBAL")).not.toBe(env.definitionDigest);
    await expect(evaluatedDefinitionDigest({}, "ACME_GIMBAL")).rejects.toThrow(/no export ACME_GIMBAL/);
  });
});
