/**
 * The library protocol `uhd-library/v1` (docs/library-protocol.md): envelope
 * digests and rules, the JSON Schema and its published file, and the
 * conformance kit against an in-process library, clean and with one fault at
 * a time.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  runConformance,
  sealEnvelope,
  sha256Hex,
  taxonomyAncestors,
  underTaxonomyPath,
  uhdSchemaInRange,
  validateShape,
  type PartRevisionEnvelope,
} from "../src/library/index.js";
import { fakeLibrary, type Fault } from "./fixtures/fake-library.js";

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
      "errors",
    ]);
    expect(formatConformance(report)).toMatch(/^uhd-library\/v1 conformance of https:\/\/library\.test: ok \(17 pass, 0 fail, 0 warn, 0 skip\)/);
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

  it("never throws when the library is unreachable", async () => {
    const report = await runConformance("http://127.0.0.1:9", { fetch: () => Promise.reject(new Error("connection refused")) });
    expect(report.ok).toBe(false);
    expect(report.checks[0]).toMatchObject({ id: "discovery", status: "fail", message: "connection refused" });
  });
});
