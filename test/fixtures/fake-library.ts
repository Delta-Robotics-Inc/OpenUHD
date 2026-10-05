/**
 * An in-process `uhd-library/v1` library for the conformance kit's tests: a
 * `fetch` function over a few hand-written parts, written from
 * docs/library-protocol.md alone. `faults` breaks one rule at a time so the
 * tests can see the kit catch it.
 */
import { definitionFile, sealEnvelope, sha256Hex, taxonomyAncestors, underTaxonomyPath } from "../../src/library/envelope.js";
import type { DiscoveryDocument, EnvelopeArtifact, FileTerms, PartRef, PartRevisionEnvelope, PartSummary, RevisionRow } from "../../src/library/types.js";
import type { FetchLike } from "../../src/library/conformance.js";

export type Fault =
  | "no-discovery"
  | "tampered-envelope"
  | "duplicate-page"
  | "bad-blob"
  | "facet-counts"
  | "plain-errors"
  | "taxonomy-string-prefix"
  | "closure-order"
  | "mutable-envelope"
  | "withholds-redistributable";

export interface FakeLibraryOptions {
  faults?: Fault[];
  /** Reads need `Authorization: Bearer <token>`. */
  token?: string;
  /** Refuse files whose terms are not redistributable (`403 NOT_DISTRIBUTABLE`, § 4.5), as a public view would. */
  withhold?: boolean;
}

interface Revision {
  env: PartRevisionEnvelope;
  deprecated?: { reason: string; at: string };
}

const text = (s: string) => new TextEncoder().encode(s);

type Def = { id: string; name: string; interfaces: { id: string; domain: string; exposed?: boolean; protocols?: { type: string }[] }[]; [k: string]: unknown };

const def = (id: string, extra: Partial<Def> = {}): Def => ({
  id,
  name: `Acme ${id}`,
  manufacturer: "Acme",
  interfaces: [{ id: "mount", domain: "mechanical", exposed: true, protocols: [{ type: "bolt_pattern" }] }],
  ...extra,
});

/** The parts: a screw, an IMU, a gimbal containing the screw (two revisions), a deprecated sensor. */
export async function fakeLibrary(options: FakeLibraryOptions = {}): Promise<{ url: string; fetch: FetchLike; envelopes: PartRevisionEnvelope[] }> {
  const faults = new Set(options.faults ?? []);
  const blobs = new Map<string, Uint8Array>();
  const redistributable = new Set<string>();
  const file = async (path: string, content: string, role: EnvelopeArtifact["role"], artifactId?: string, terms?: FileTerms): Promise<EnvelopeArtifact> => {
    const bytes = text(content);
    const sha256 = await sha256Hex(bytes);
    blobs.set(sha256, bytes);
    if (terms?.distribution === "redistributable") redistributable.add(sha256);
    return { path, sha256, size: bytes.length, mediaType: path.endsWith(".png") ? "image/png" : path.endsWith(".txt") ? "text/plain" : "model/gltf-binary", role, ...(artifactId ? { artifactId } : {}), ...(terms ? { terms } : {}) };
  };
  const seal = (d: Def, revision: number, rest: { dependencies?: PartRef[]; artifacts?: EnvelopeArtifact[]; derivedFrom?: PartRef | null } = {}) =>
    sealEnvelope({
      schema: "uhd.part-revision/v1",
      uhdSchema: "0.2.0",
      partId: d.id,
      revision,
      definition: d,
      dependencies: rest.dependencies ?? [],
      artifacts: rest.artifacts ?? [],
      missingArtifacts: [],
      evidence: [{ kind: "datasheet", url: `https://example.com/${d.id}.pdf` }],
      derivedFrom: rest.derivedFrom ?? (revision > 1 ? { partId: d.id, revision: revision - 1 } : null),
      publisher: { name: "acme" },
      createdAt: `2026-09-0${revision}T00:00:00.000Z`,
    }) as Promise<PartRevisionEnvelope>;

  const screwDef = def("acme-m2-screw", { categories: ["hardware.fastener.screw"], tags: ["screw"], artifacts: [{ id: "body", filePath: "parts/acme-m2-screw/body.glb" }] });
  const imuDef = def("acme-imu", {
    categories: ["sensor.motion"],
    tags: ["imu"],
    interfaces: [
      { id: "i2c", domain: "electrical", exposed: true, protocols: [{ type: "i2c" }] },
      { id: "vin", domain: "electrical", exposed: true, protocols: [{ type: "power" }] },
    ],
  });
  const gimbal = (description: string) => def("acme-gimbal", { description, categories: ["actuator.gimbal"], children: [{ id: "screw", moduleDefId: "acme-m2-screw" }], artifacts: [{ id: "body", filePath: "parts/acme-gimbal/body.glb" }] });
  const oldDef = def("acme-old-sensor", { categories: ["sensor.distance"], tags: ["tof"] });

  const parts = new Map<string, Revision[]>();
  const add = (r: Revision) => parts.set(r.env.partId, [...(parts.get(r.env.partId) ?? []), r]);
  const mit: FileTerms = { distribution: "redistributable", license: "MIT", licensePath: "parts/acme-m2-screw/LICENSE.txt", attribution: "Copyright (c) 2026 Acme", sourceUrl: "https://acme.example/cad/m2.step", retrieved: "2026-10-03" };
  add({
    env: await seal(screwDef, 1, {
      artifacts: [
        await file("parts/acme-m2-screw/body.glb", "screw body", "body", "body", mit),
        await file("parts/acme-m2-screw/LICENSE.txt", "MIT licence text", "license", undefined, { distribution: "redistributable", license: "MIT" }),
        await file("parts/acme-m2-screw/thumbnail.png", "png", "thumbnail", undefined, { distribution: "unknown", summary: "product photo; terms not found" }),
      ],
    }),
  });
  add({ env: await seal(imuDef, 1) });
  const gimbalBody = await file("parts/acme-gimbal/body.glb", "gimbal body", "body", "body");
  add({ env: await seal(gimbal("first"), 1, { dependencies: [{ partId: "acme-m2-screw", revision: 1 }], artifacts: [gimbalBody] }) });
  add({ env: await seal(gimbal("second"), 2, { dependencies: [{ partId: "acme-m2-screw", revision: 1 }], artifacts: [gimbalBody] }) });
  add({ env: await seal(oldDef, 1), deprecated: { reason: "end of life", at: "2026-09-20T00:00:00.000Z" } });
  const partDeprecated = new Set(["acme-old-sensor"]);

  const url = "https://library.test";
  const discovery: DiscoveryDocument = {
    protocol: "uhd-library/v1",
    name: "Acme test library",
    id: "acme",
    version: "0.0.1",
    api: "/v1",
    envelopeSchemas: ["uhd.part-revision/v1"],
    uhdSchema: { min: "0.2.0", below: "0.3.0" },
    taxonomy: { version: "2.1.0" },
    capabilities: ["facets", "taxonomy", "definition"],
    auth: options.token ? { read: "bearer", realm: "acme" } : { read: "none" },
    limits: { defaultPageSize: 2, maxPageSize: 3 },
  };

  const rows = (id: string): RevisionRow[] =>
    parts.get(id)!.map(({ env, deprecated }) => ({
      partId: id,
      revision: env.revision,
      digest: env.digest,
      definitionDigest: env.definitionDigest,
      uhdSchema: env.uhdSchema,
      createdAt: env.createdAt,
      publisher: env.publisher!.name,
      ...(deprecated ? { deprecated } : {}),
    }));
  const summary = (id: string): PartSummary => {
    const revs = parts.get(id)!;
    const current = [...revs].reverse().find((r) => !r.deprecated);
    const shown = (current ?? revs[revs.length - 1]).env;
    const d = shown.definition as Def;
    const thumb = shown.artifacts.find((a) => a.role === "thumbnail" && (!options.withhold || redistributable.has(a.sha256)));
    return {
      partId: id,
      name: d.name,
      ...(d.description ? { description: d.description as string } : {}),
      manufacturer: d.manufacturer as string,
      categories: (d.categories as string[]) ?? [],
      tags: (d.tags as string[]) ?? [],
      protocols: [...new Set(d.interfaces.filter((i) => i.exposed).flatMap((i) => (i.protocols ?? []).map((p) => p.type)))].sort(),
      domains: [...new Set(d.interfaces.map((i) => i.domain))].sort(),
      latestRevision: revs.length,
      ...(current ? { recommendedRevision: current.env.revision } : {}),
      ...(partDeprecated.has(id) ? { deprecated: revs[0].deprecated } : {}),
      ...(thumb ? { thumbnail: { sha256: thumb.sha256, size: thumb.size, mediaType: thumb.mediaType } } : {}),
    };
  };

  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  const error = (status: number, code: string, message: string, headers: Record<string, string> = {}) =>
    faults.has("plain-errors") ? new Response(message, { status, headers }) : json({ error: { code, message } }, status, headers);
  const IMMUTABLE = { "cache-control": "public, max-age=31536000, immutable" };

  const search = (q: URLSearchParams): Response => {
    for (const k of ["includeDeprecated", "facets"]) if (q.has(k) && !["true", "false"].includes(q.get(k)!)) return error(400, "QUERY_INVALID", `${k} is true or false`);
    const limitText = q.get("limit");
    if (limitText !== null && !/^[1-9]\d*$/.test(limitText)) return error(400, "QUERY_INVALID", "limit is an integer >= 1");
    const limit = Math.min(Number(limitText ?? discovery.limits!.defaultPageSize), discovery.limits!.maxPageSize!);
    let offset = 0;
    const cursor = q.get("cursor");
    if (cursor !== null) {
      if (!/^o\d+$/.test(cursor)) return error(400, "CURSOR_INVALID", "unreadable cursor");
      offset = Number(cursor.slice(1));
    }
    const words = (q.get("q") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const tax = q.get("taxonomy");
    const matches = [...parts.keys()]
      .sort()
      .filter((id) => q.get("includeDeprecated") === "true" || !partDeprecated.has(id))
      .map(summary)
      .filter((s) => {
        const hay = [s.partId, s.name, s.description, s.manufacturer, s.partNumber, ...s.tags].filter(Boolean).join(" ").toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
        if (q.get("domain") && !s.domains.includes(q.get("domain")!)) return false;
        if (q.get("protocol") && !s.protocols.includes(q.get("protocol")!)) return false;
        if (q.get("tag") && !s.tags.includes(q.get("tag")!)) return false;
        if (tax && !s.categories.some((c) => (faults.has("taxonomy-string-prefix") ? c.startsWith(tax) : underTaxonomyPath(c, tax)))) return false;
        return true;
      });
    const page = matches.slice(offset, offset + limit);
    if (faults.has("duplicate-page") && offset > 0) page.unshift(matches[offset - 1]);
    const next = offset + limit < matches.length ? `o${offset + limit}` : null;
    const body: Record<string, unknown> = { total: matches.length, parts: page, nextCursor: next };
    if (q.get("facets") === "true") {
      const facets = { taxonomy: {} as Record<string, number>, domain: {} as Record<string, number>, protocol: {} as Record<string, number>, tag: {} as Record<string, number> };
      const bump = (o: Record<string, number>, v: string) => (o[v] = (o[v] ?? 0) + 1 + (faults.has("facet-counts") ? 1 : 0));
      for (const s of matches) {
        for (const path of new Set(s.categories.flatMap(taxonomyAncestors))) bump(facets.taxonomy, path);
        s.domains.forEach((v) => bump(facets.domain, v));
        s.protocols.forEach((v) => bump(facets.protocol, v));
        s.tags.forEach((v) => bump(facets.tag, v));
      }
      body.facets = facets;
    }
    return json(body);
  };

  const closure = (root: PartRef) => {
    const order: PartRevisionEnvelope[] = [];
    const seen = new Set<string>();
    const visit = (r: PartRef) => {
      const key = `${r.partId}@${r.revision}`;
      if (seen.has(key)) return;
      seen.add(key);
      const env = parts.get(r.partId)![r.revision - 1].env;
      for (const d of env.dependencies) visit(d);
      order.push(env);
    };
    visit(root);
    if (faults.has("closure-order")) order.reverse();
    return { root, revisions: order, conflicts: [] };
  };

  let served = 0;
  const handle = (method: string, u: URL, headers: Record<string, string>): Response => {
    const path = u.pathname;
    if (path === "/.well-known/uhd-library" || path === "/v1") return faults.has("no-discovery") ? new Response("not here", { status: 404 }) : json(discovery);
    if (!path.startsWith("/v1/")) return error(404, "NOT_FOUND", `no route ${path}`);
    if (options.token && headers.authorization !== `Bearer ${options.token}`) return error(401, "AUTH_REQUIRED", "a bearer token is required", { "www-authenticate": 'Bearer realm="acme"' });
    const rest = path.slice(3);
    if (rest === "/parts") return search(u.searchParams);
    let m = /^\/blobs\/([^/]+)$/.exec(rest);
    if (m) {
      if (!/^[0-9a-f]{64}$/.test(m[1])) return error(400, "SHA256_INVALID", "malformed address");
      let bytes = blobs.get(m[1]);
      if (!bytes) return error(404, "BLOB_NOT_FOUND", `no blob ${m[1]}`);
      if ((options.withhold && !redistributable.has(m[1])) || (faults.has("withholds-redistributable") && redistributable.has(m[1]))) return error(403, "NOT_DISTRIBUTABLE", `${m[1]} is not redistributable`);
      if (faults.has("bad-blob")) bytes = text(new TextDecoder().decode(bytes).toUpperCase());
      return new Response(method === "HEAD" ? null : (bytes as Uint8Array<ArrayBuffer>), { headers: { "content-type": "application/octet-stream", etag: `"sha256:${m[1]}"`, ...IMMUTABLE } });
    }
    m = /^\/parts\/([^/]+)(\/revisions(?:\/([^/]+)(\/closure|\/definition)?)?)?$/.exec(rest);
    if (!m) return error(404, "NOT_FOUND", `no route ${path}`);
    const id = decodeURIComponent(m[1]);
    const revs = parts.get(id);
    if (!revs) return error(404, "PART_NOT_FOUND", `no part ${id}`);
    if (!m[2]) return json({ part: summary(id), revisions: rows(id) });
    if (m[3] === undefined) return json({ partId: id, revisions: rows(id) });
    if (!/^[1-9]\d*$/.test(m[3])) return error(400, "REVISION_INVALID", "revision is an integer >= 1");
    const n = Number(m[3]);
    if (n > revs.length) return error(404, "REVISION_NOT_FOUND", `${id} has no revision ${n}`);
    const env = revs[n - 1].env;
    if (m[4] === "/closure") return json(closure({ partId: id, revision: n }));
    if (m[4] === "/definition") return new Response(definitionFile(env.definition), { headers: { "content-type": "application/json", etag: `"${env.definitionDigest}"`, ...IMMUTABLE } });
    let body = env;
    if (faults.has("tampered-envelope")) body = { ...env, definition: { ...env.definition, name: "Renamed after publishing" } };
    if (faults.has("mutable-envelope")) body = { ...env, createdAt: `2026-09-0${(served++ % 9) + 1}T00:00:00.000Z` };
    return json(body, 200, { etag: `"${env.digest}"`, ...(faults.has("mutable-envelope") ? {} : IMMUTABLE) });
  };

  const doFetch: FetchLike = async (input, init) => {
    const u = new URL(input);
    if (u.origin !== url) throw new Error(`fake library: no host ${u.origin}`);
    const headers = Object.fromEntries(Object.entries(init?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    return handle(init?.method ?? "GET", u, headers);
  };
  return { url, fetch: doFetch, envelopes: [...parts.values()].flatMap((r) => r.map((x) => x.env)) };
}
