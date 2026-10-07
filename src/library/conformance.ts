/**
 * Conformance kit for `uhd-library/v1` (docs/library-protocol.md § 9): runs
 * the protocol's checks against a library by URL and reports each one. Reads
 * only; never publishes. Needs only `fetch` and Web Crypto.
 *
 *   const report = await runConformance("http://localhost:8787");
 *   if (!report.ok) console.log(report.checks.filter((c) => c.status === "fail"));
 */
import { canonicalJson, closureProblems, envelopeProblems, isRedistributable, sha256Hex, taxonomyAncestors, underTaxonomyPath } from "./envelope.js";
import { validateShape } from "./json-schema.js";
import { evaluatedDefinitionDigest, hasDefinitionSource, lintSource, verifySourceFiles } from "./source.js";
import type { LibrarySchemaDef } from "./schema.js";
import {
  LIBRARY_PROTOCOL,
  type Closure,
  type DiscoveryDocument,
  type PartDetail,
  type PartRevisionEnvelope,
  type PartSummary,
  type RevisionList,
  type SearchResponse,
} from "./types.js";

/** The part of `fetch` the kit uses; global `fetch` fits. */
export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<ResponseLike>;

export interface ResponseLike {
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ConformanceOptions {
  /** Replaces global fetch (an in-process library, a proxy). */
  fetch?: FetchLike;
  /** Bearer token, for a library whose reads need one. Never logged or reported. */
  token?: string;
  /** The part examined in depth (detail, envelope, closure, files). Default: the first search result. */
  partId?: string;
  /** Most search pages the pagination check walks. Default 25. */
  maxPages?: number;
  /** Most files downloaded and hashed. Default 6. */
  maxFiles?: number;
  /** Most further parts whose closures are checked, looking for dependencies. Default 8. */
  maxClosures?: number;
  /** Most further parts whose revisions are fetched, looking for one that ships definition source. Default 25. */
  maxSourceParts?: number;
  /**
   * Evaluates a revision's definition source (§ 4.6.3): import `entry` from
   * `files` laid out under one directory, with `@deltarobotics/uhd`
   * resolvable, and return the module namespace (or `{ [export]: definition }`).
   * The library's source is not the caller's own code, so evaluate it
   * confined (§ 4.6.3), as `evaluateSourceConfined` from
   * `@deltarobotics/uhd/library/confined` does. The kit has no TypeScript
   * loader of its own; without this the source check stops at the lint.
   */
  evaluateSource?: (source: { files: { path: string; text: string }[]; entry: string; export: string; requires: { uhd: string; typescript: string } }) => Promise<Record<string, unknown>>;
}

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export interface ConformanceCheck {
  id: string;
  title: string;
  status: CheckStatus;
  /** Why it failed, warned or was skipped; a summary when it passed. */
  message?: string;
  /** Every problem found, for a failure or warning. */
  problems?: string[];
}

export interface ConformanceReport {
  protocol: typeof LIBRARY_PROTOCOL;
  library: string;
  /** The API root the discovery document named. */
  api?: string;
  discovery?: DiscoveryDocument;
  /** Nothing failed (warnings and skips allowed). */
  ok: boolean;
  counts: Record<CheckStatus, number>;
  checks: ConformanceCheck[];
}

interface Reply {
  url: string;
  status: number;
  headers: ResponseLike["headers"];
  bytes: Uint8Array;
  text: string;
  json?: unknown;
}

class Skip extends Error {}

/** Collects the problems and warnings of one check. */
class Probe {
  problems: string[] = [];
  warnings: string[] = [];
  note?: string;
  expect(ok: unknown, message: string): boolean {
    if (!ok) this.problems.push(message);
    return !!ok;
  }
  warn(ok: unknown, message: string): boolean {
    if (!ok) this.warnings.push(message);
    return !!ok;
  }
  shape(def: LibrarySchemaDef, value: unknown, what: string): boolean {
    const p = validateShape(def, value);
    for (const x of p.slice(0, 10)) this.problems.push(`${what}: ${x.at} ${x.message}`);
    if (p.length > 10) this.problems.push(`${what}: ${p.length - 10} more shape problem(s)`);
    return p.length === 0;
  }
  skip(message: string): never {
    throw new Skip(message);
  }
}

const random = () => Math.random().toString(36).slice(2, 10);
const enc = encodeURIComponent;

/**
 * Run every check against the library at `libraryUrl`. Never throws for a
 * library's failure: everything ends up in the report.
 */
export async function runConformance(libraryUrl: string, options: ConformanceOptions = {}): Promise<ConformanceReport> {
  const doFetch: FetchLike = options.fetch ?? ((url, init) => fetch(url, init));
  const maxPages = options.maxPages ?? 25;
  const maxFiles = options.maxFiles ?? 6;
  const maxClosures = options.maxClosures ?? 8;
  const maxSourceParts = options.maxSourceParts ?? 25;
  const library = libraryUrl.replace(/\/+$/, "");
  const checks: ConformanceCheck[] = [];
  let api = "";
  let discovery: DiscoveryDocument | undefined;
  let auth = false;

  const request = async (url: string, opts: { method?: string; auth?: boolean } = {}): Promise<Reply> => {
    const headers: Record<string, string> = { accept: "application/json" };
    if ((opts.auth ?? auth) && options.token) headers.authorization = `Bearer ${options.token}`;
    const res = await doFetch(url, { method: opts.method ?? "GET", headers });
    const bytes = new Uint8Array(await res.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    return { url, status: res.status, headers: res.headers, bytes, text, json };
  };
  const get = (path: string, opts: { method?: string; auth?: boolean } = {}) => request(`${api}${path}`, opts);

  const run = async (id: string, title: string, body: (p: Probe) => Promise<void>, blocked?: string) => {
    if (blocked) {
      checks.push({ id, title, status: "skip", message: blocked });
      return;
    }
    const p = new Probe();
    try {
      await body(p);
    } catch (e) {
      if (e instanceof Skip) {
        checks.push({ id, title, status: "skip", message: e.message });
        return;
      }
      p.problems.push(`${(e as Error).message ?? e}`);
    }
    if (p.problems.length) checks.push({ id, title, status: "fail", message: p.problems[0], problems: [...p.problems, ...p.warnings] });
    else if (p.warnings.length) checks.push({ id, title, status: "warn", message: p.warnings[0], problems: p.warnings });
    else checks.push({ id, title, status: "pass", ...(p.note ? { message: p.note } : {}) });
  };

  /** An error response as § 5 describes it. */
  const errorReply = (p: Probe, r: Reply, status: number, code: string | undefined, what: string) => {
    p.expect(r.status === status, `${what}: status ${r.status}, expected ${status}`);
    if (p.shape("error", r.json, `${what} body`) && code) p.expect((r.json as { error: { code: string } }).error.code === code, `${what}: code ${(r.json as { error: { code: string } }).error.code}, expected ${code}`);
  };
  const ok = (p: Probe, r: Reply, what: string): boolean => p.expect(r.status === 200, `${what}: status ${r.status}${r.json && typeof r.json === "object" && "error" in r.json ? ` (${JSON.stringify((r.json as { error: unknown }).error)})` : ""}`);

  // ---- discovery
  await run("discovery", "Discovery document at /.well-known/uhd-library or /v1", async (p) => {
    const wellKnown = await request(`${library}/.well-known/uhd-library`, { auth: false });
    let found: Reply | undefined;
    if (wellKnown.status === 200 && (wellKnown.json as { protocol?: unknown })?.protocol === LIBRARY_PROTOCOL) found = wellKnown;
    else {
      const atOrigin = new URL(library).pathname.replace(/\/+$/, "") === "";
      p.warn(!atOrigin, `no discovery document at ${library}/.well-known/uhd-library (status ${wellKnown.status}); a library at an origin's root SHOULD serve one`);
      const v1 = await request(`${library}/v1`, { auth: false });
      if (v1.status === 200) found = v1;
    }
    if (!found) throw new Error(`no discovery document at ${library}/.well-known/uhd-library or ${library}/v1`);
    if (!p.shape("discovery", found.json, "discovery document")) return;
    discovery = found.json as DiscoveryDocument;
    api = new URL(discovery.api ?? found.url, found.url).href.replace(/\/+$/, "");
    auth = discovery.auth.read === "bearer";
    p.warn(
      discovery.envelopeSchemas.includes("uhd.part-revision/v1"),
      `envelopeSchemas does not list uhd.part-revision/v1 (${discovery.envelopeSchemas.join(", ")}); only libraries whose every envelope predates the protocol may omit it`,
    );
    p.note = `${discovery.name} ${discovery.version}, API at ${api}`;
  });
  const noDiscovery = discovery ? undefined : "no discovery document";

  await run(
    "discovery.api-root",
    "The API root serves the discovery document",
    async (p) => {
      const r = await get("", { auth: false });
      if (!ok(p, r, `GET ${api}`)) return;
      p.shape("discovery", r.json, "API root document");
      p.expect((r.json as DiscoveryDocument)?.name === discovery!.name, "the API root's discovery document names a different library");
    },
    noDiscovery,
  );

  // ---- authentication
  let authBlocked: string | undefined = noDiscovery;
  await run(
    "auth",
    "Bearer authentication when the library requires it",
    async (p) => {
      if (!auth) {
        p.note = "reads are open";
        return;
      }
      const r = await get("/parts?limit=1", { auth: false });
      errorReply(p, r, 401, "AUTH_REQUIRED", "search without a token");
      p.expect(/^bearer/i.test(r.headers.get("www-authenticate") ?? ""), "a 401 needs WWW-Authenticate: Bearer");
      if (!options.token) {
        authBlocked = "the library requires a bearer token; pass options.token";
        p.note = authBlocked;
      }
    },
    noDiscovery,
  );

  // ---- search
  let first: SearchResponse | undefined;
  await run(
    "search.shape",
    "Search returns the documented shape",
    async (p) => {
      const r = await get("/parts?limit=5");
      if (!ok(p, r, "search") || !p.shape("searchResponse", r.json, "search")) return;
      first = r.json as SearchResponse;
      p.expect(first.parts.length <= 5, `limit=5 returned ${first.parts.length} parts`);
      p.expect(first.total >= first.parts.length, `total ${first.total} is less than the ${first.parts.length} parts returned`);
      if (first.total > first.parts.length) p.expect(first.nextCursor !== null, "more parts match than were returned, but nextCursor is null");
      else p.expect(first.nextCursor === null, "every match was returned, but nextCursor is not null");
      p.warn(first.total > 0, "the library is empty; most checks are skipped");
      p.note = `${first.total} part(s)`;
    },
    authBlocked,
  );
  const empty = authBlocked ?? (!first ? "search failed" : first.total === 0 ? "the library is empty" : undefined);

  // every summary, walked through pages
  const all: PartSummary[] = [];
  await run(
    "search.pagination",
    "Cursors walk every match exactly once",
    async (p) => {
      const total = first!.total;
      const pages = Math.max(1, Math.min(maxPages - 1, total));
      let limit = Math.max(1, Math.ceil(total / pages));
      if (discovery!.limits?.maxPageSize) limit = Math.min(limit, discovery!.limits.maxPageSize);
      const seen = new Set<string>();
      let cursor: string | null = null;
      let walked = 0;
      do {
        const r = await get(`/parts?limit=${limit}${cursor !== null ? `&cursor=${enc(cursor)}` : ""}`);
        if (!ok(p, r, `page ${walked + 1}`) || !p.shape("searchResponse", r.json, `page ${walked + 1}`)) return;
        const page = r.json as SearchResponse;
        walked++;
        p.expect(page.parts.length <= limit, `page ${walked} has ${page.parts.length} parts, limit ${limit}`);
        p.expect(page.total === total, `page ${walked} says total ${page.total}, the first said ${total}`);
        p.expect(page.nextCursor === null || page.parts.length > 0, `page ${walked} is empty but has a nextCursor`);
        for (const s of page.parts) {
          p.expect(!seen.has(s.partId), `${s.partId} appears on two pages`);
          seen.add(s.partId);
          all.push(s);
        }
        cursor = page.nextCursor;
      } while (cursor !== null && walked < maxPages);
      if (cursor === null) p.expect(seen.size === total, `the pages hold ${seen.size} distinct parts, total says ${total}`);
      else p.warn(false, `stopped after ${walked} pages of ${limit}; ${seen.size} of ${total} parts seen`);
      const max = discovery!.limits?.maxPageSize;
      if (max) {
        const big = await get(`/parts?limit=${max + 1}`);
        if (ok(p, big, "search above maxPageSize")) p.expect((big.json as SearchResponse).parts.length <= max, `limit=${max + 1} returned more than maxPageSize ${max}`);
      }
      p.note = `${walked} page(s) of ${limit}`;
    },
    empty,
  );

  const sample = options.partId ? undefined : all[0] ?? first?.parts[0];
  const samplePartId = options.partId ?? sample?.partId;
  const noSample = empty ?? (samplePartId ? undefined : "no part to examine");

  await run(
    "search.q",
    "Words match the part id; unknown words match nothing",
    async (p) => {
      const r = await get(`/parts?q=${enc(samplePartId!)}&limit=${discovery!.limits?.maxPageSize ?? 50}`);
      if (ok(p, r, "search by id") && p.shape("searchResponse", r.json, "search by id")) p.expect((r.json as SearchResponse).parts.some((x) => x.partId === samplePartId), `q=${samplePartId} does not find it`);
      const none = await get(`/parts?q=${enc(`zzq${random()}nomatch`)}`);
      if (ok(p, none, "search for nonsense")) p.expect((none.json as SearchResponse).total === 0, "a nonsense word matched parts");
    },
    noSample,
  );

  const summaryOf = async (id: string): Promise<PartSummary | undefined> =>
    all.find((x) => x.partId === id) ?? ((await get(`/parts/${enc(id)}`)).json as PartDetail | undefined)?.part;

  await run(
    "search.filters",
    "Domain, protocol and tag filters return only matching parts",
    async (p) => {
      const s = await summaryOf(samplePartId!);
      if (!s) p.skip(`cannot read ${samplePartId}`);
      let tried = 0;
      for (const [param, field] of [["domain", "domains"], ["protocol", "protocols"], ["tag", "tags"]] as const) {
        const value = s![field][0];
        if (value === undefined) continue;
        tried++;
        const r = await get(`/parts?${param}=${enc(value)}&limit=${discovery!.limits?.maxPageSize ?? 50}`);
        if (!ok(p, r, `${param}=${value}`) || !p.shape("searchResponse", r.json, `${param}=${value}`)) continue;
        for (const x of (r.json as SearchResponse).parts) p.expect(x[field].includes(value), `${param}=${value} returned ${x.partId}, whose ${field} are ${x[field].join(", ")}`);
        const mine = await get(`/parts?q=${enc(samplePartId!)}&${param}=${enc(value)}`);
        if (ok(p, mine, `q and ${param}`)) p.expect((mine.json as SearchResponse).parts.some((x) => x.partId === samplePartId), `${param}=${value} with q=${samplePartId} does not find it`);
        const none = await get(`/parts?${param}=${enc(`zz-${random()}`)}`);
        if (ok(p, none, `${param} nonsense`)) p.expect((none.json as SearchResponse).total === 0, `an unknown ${param} matched parts`);
      }
      if (!tried) p.skip(`${samplePartId} has no domains, protocols or tags to filter by`);
    },
    noSample,
  );

  const hasCapability = (c: string) => discovery?.capabilities.includes(c);
  const categorised = all.find((x) => x.categories.length) ?? (sample?.categories.length ? sample : undefined);

  await run(
    "search.taxonomy",
    "Taxonomy filter matches a path and everything below it",
    async (p) => {
      if (!hasCapability("taxonomy")) p.skip("capability taxonomy not declared");
      if (!categorised) p.skip("no part with categories found");
      const path = categorised!.categories[0];
      const root = path.split(".")[0];
      for (const filter of new Set([root, path])) {
        const r = await get(`/parts?taxonomy=${enc(filter)}&limit=${discovery!.limits?.maxPageSize ?? 50}`);
        if (!ok(p, r, `taxonomy=${filter}`) || !p.shape("searchResponse", r.json, `taxonomy=${filter}`)) continue;
        for (const x of (r.json as SearchResponse).parts)
          p.expect(x.categories.some((c) => underTaxonomyPath(c, filter)), `taxonomy=${filter} returned ${x.partId}, filed under ${x.categories.join(", ") || "nothing"}`);
        const mine = await get(`/parts?q=${enc(categorised!.partId)}&taxonomy=${enc(filter)}`);
        if (ok(p, mine, "q and taxonomy")) p.expect((mine.json as SearchResponse).parts.some((x) => x.partId === categorised!.partId), `taxonomy=${filter} does not find ${categorised!.partId} (filed under ${path})`);
      }
      // a path is matched by whole segments, not as a string prefix
      const partial = root.length > 1 ? root.slice(0, -1) : undefined;
      if (partial && !all.some((x) => x.categories.some((c) => underTaxonomyPath(c, partial)))) {
        const r = await get(`/parts?taxonomy=${enc(partial)}`);
        if (ok(p, r, `taxonomy=${partial}`)) p.expect((r.json as SearchResponse).total === 0, `taxonomy=${partial} matched parts filed under ${root}: paths match by whole segments`);
      }
    },
    noSample,
  );

  await run(
    "search.facets",
    "Facet counts agree with filtered searches",
    async (p) => {
      if (!hasCapability("facets")) p.skip("capability facets not declared");
      const r = await get("/parts?facets=true&limit=1");
      if (!ok(p, r, "facets") || !p.shape("searchResponse", r.json, "facets")) return;
      const res = r.json as SearchResponse;
      if (!p.expect(res.facets, "facets=true returned no facets")) return;
      const f = res.facets!;
      for (const [kind, counts] of Object.entries(f) as [string, Record<string, number>][]) for (const [v, n] of Object.entries(counts)) p.expect(n <= res.total, `facets.${kind}[${v}] = ${n} exceeds total ${res.total}`);
      for (const [path, n] of Object.entries(f.taxonomy))
        for (const a of taxonomyAncestors(path)) p.expect((f.taxonomy[a] ?? 0) >= n, `facets.taxonomy[${a}] = ${f.taxonomy[a] ?? 0} is less than its descendant ${path} (${n})`);
      const pick = (o: Record<string, number>) => Object.keys(o).sort()[0];
      const probes: [string, string | undefined][] = [["domain", pick(f.domain)], ["protocol", pick(f.protocol)], ["tag", pick(f.tag)]];
      if (hasCapability("taxonomy")) probes.push(["taxonomy", pick(f.taxonomy)]);
      for (const [kind, value] of probes) {
        if (value === undefined) continue;
        const q = await get(`/parts?${kind}=${enc(value)}&limit=1`);
        if (ok(p, q, `${kind}=${value}`)) p.expect((q.json as SearchResponse).total === f[kind as keyof typeof f][value], `facets.${kind}[${value}] = ${f[kind as keyof typeof f][value]}, but ${kind}=${value} matches ${(q.json as SearchResponse).total}`);
      }
      if (categorised && hasCapability("taxonomy")) {
        for (const a of taxonomyAncestors(categorised.categories[0])) p.expect((f.taxonomy[a] ?? 0) >= 1, `facets.taxonomy has no count for ${a}, an ancestor of ${categorised.partId}'s category`);
      }
    },
    empty,
  );

  await run(
    "search.deprecated",
    "includeDeprecated never finds fewer parts",
    async (p) => {
      const r = await get("/parts?includeDeprecated=true&limit=1");
      if (ok(p, r, "includeDeprecated") && p.shape("searchResponse", r.json, "includeDeprecated")) p.expect((r.json as SearchResponse).total >= first!.total, "includeDeprecated=true found fewer parts than the default");
    },
    empty,
  );

  // ---- one part in depth
  let detail: PartDetail | undefined;
  await run(
    "part.detail",
    "Part detail: summary and every revision in order",
    async (p) => {
      const r = await get(`/parts/${enc(samplePartId!)}`);
      if (!ok(p, r, "part detail") || !p.shape("partDetail", r.json, "part detail")) return;
      detail = r.json as PartDetail;
      const { part, revisions } = detail;
      p.expect(part.partId === samplePartId, `asked for ${samplePartId}, got ${part.partId}`);
      revisions.forEach((row, i) => {
        p.expect(row.revision === i + 1, `revisions are not 1..n in order (position ${i + 1} holds ${row.revision})`);
        p.expect(row.partId === samplePartId, `revision row ${row.revision} names ${row.partId}`);
      });
      p.expect(part.latestRevision === revisions.length, `latestRevision ${part.latestRevision}, but ${revisions.length} revision(s) listed`);
      const current = [...revisions].reverse().find((x) => !x.deprecated);
      p.expect(part.recommendedRevision === current?.revision, `recommendedRevision ${part.recommendedRevision}, the newest revision not deprecated is ${current?.revision}`);
      const listed = all.find((x) => x.partId === samplePartId);
      if (listed) p.expect(canonicalJson(listed) === canonicalJson(part), "the part detail's summary differs from the search result's");
    },
    noSample,
  );

  await run(
    "part.revisions",
    "Revision list matches the part detail",
    async (p) => {
      const r = await get(`/parts/${enc(samplePartId!)}/revisions`);
      if (!ok(p, r, "revision list") || !p.shape("revisionList", r.json, "revision list")) return;
      const list = r.json as RevisionList;
      p.expect(list.partId === samplePartId, `revision list names ${list.partId}`);
      p.expect(canonicalJson(list.revisions) === canonicalJson(detail!.revisions), "the revision list differs from the part detail's revisions");
    },
    noSample ?? (detail ? undefined : "part detail failed"),
  );

  const chosen = detail ? (detail.part.recommendedRevision ?? detail.part.latestRevision) : undefined;
  let envelope: PartRevisionEnvelope | undefined;
  const schemas = () => [...new Set(["uhd.part-revision/v1", ...(discovery?.envelopeSchemas ?? [])])];
  const verifyEnvelope = async (p: Probe, env: unknown, what: string, expect?: { partId: string; revision: number; digest?: string }) => {
    if (!p.shape("envelope", env, what)) return false;
    const problems = await envelopeProblems(env as PartRevisionEnvelope, { schemas: schemas(), ...(expect ? { expect } : {}) });
    for (const x of problems) p.problems.push(`${what}: ${x.code}${x.at ? ` at ${x.at}` : ""}: ${x.message}`);
    return problems.length === 0;
  };

  await run(
    "revision.envelope",
    "Exact revision: a valid envelope with matching digests, ETag and immutable caching",
    async (p) => {
      const row = detail!.revisions.find((x) => x.revision === chosen)!;
      const r = await get(`/parts/${enc(samplePartId!)}/revisions/${chosen}`);
      if (!ok(p, r, "envelope")) return;
      if (!(await verifyEnvelope(p, r.json, `${samplePartId}@${chosen}`, { partId: samplePartId!, revision: chosen!, digest: row.digest }))) return;
      envelope = r.json as PartRevisionEnvelope;
      p.expect(envelope.definitionDigest === row.definitionDigest, "definitionDigest differs from the revision list's");
      p.expect(envelope.uhdSchema === row.uhdSchema, "uhdSchema differs from the revision list's");
      p.expect(r.headers.get("etag") === `"${envelope.digest}"`, `ETag is ${r.headers.get("etag")}, expected "${envelope.digest}"`);
      p.warn(/immutable/.test(r.headers.get("cache-control") ?? ""), `Cache-Control is ${r.headers.get("cache-control")}; an envelope SHOULD be cached as immutable`);
      const again = await get(`/parts/${enc(samplePartId!)}/revisions/${chosen}`);
      p.expect(again.text === r.text, "the same revision came back with different bytes");
      p.note = `${samplePartId}@${chosen}, ${envelope.artifacts.length} file(s), ${envelope.dependencies.length} dependenc(ies)`;
    },
    noSample ?? (detail ? undefined : "part detail failed"),
  );

  await run(
    "revision.definition",
    "Definition file: the bytes definitionDigest names",
    async (p) => {
      if (!hasCapability("definition")) p.skip("capability definition not declared");
      const r = await get(`/parts/${enc(samplePartId!)}/revisions/${chosen}/definition`);
      if (!ok(p, r, "definition")) return;
      p.expect(`sha256:${await sha256Hex(r.bytes)}` === envelope!.definitionDigest, "the definition file does not hash to definitionDigest");
      p.expect(r.headers.get("etag") === `"${envelope!.definitionDigest}"`, `ETag is ${r.headers.get("etag")}, expected "${envelope!.definitionDigest}"`);
    },
    noSample ?? (envelope ? undefined : "no envelope"),
  );

  await run(
    "revision.closure",
    "Closures: complete, dependencies first, each envelope valid",
    async (p) => {
      const targets: [string, number][] = [[samplePartId!, chosen!]];
      for (const s of all) {
        if (targets.length > maxClosures) break;
        if (s.partId !== samplePartId && s.recommendedRevision !== undefined) targets.push([s.partId, s.recommendedRevision]);
      }
      let deepest = 0;
      for (const [id, rev] of targets) {
        const r = await get(`/parts/${enc(id)}/revisions/${rev}/closure`);
        if (!ok(p, r, `closure of ${id}@${rev}`) || !p.shape("closure", r.json, `closure of ${id}@${rev}`)) continue;
        const c = r.json as Closure;
        const { problems, conflicts } = closureProblems(c, { partId: id, revision: rev });
        for (const x of problems) p.problems.push(`closure of ${id}@${rev}: ${x.message}`);
        const norm = (list: Closure["conflicts"]) => canonicalJson(list.map((x) => ({ partId: x.partId, revisions: [...x.revisions].sort((a, b) => a - b) })).sort((a, b) => a.partId.localeCompare(b.partId)));
        p.expect(norm(conflicts) === norm(c.conflicts), `closure of ${id}@${rev}: conflicts ${JSON.stringify(c.conflicts)}, recomputed ${JSON.stringify(conflicts)}`);
        for (const env of c.revisions) await verifyEnvelope(p, env, `closure of ${id}@${rev}: ${env.partId}@${env.revision}`);
        if (id === samplePartId && envelope) p.expect(c.revisions.some((e) => e.partId === id && e.digest === envelope!.digest), "the closure's root envelope differs from the exact revision");
        deepest = Math.max(deepest, c.revisions.length);
      }
      p.note = `${targets.length} closure(s), largest ${deepest} revision(s)`;
    },
    noSample ?? (envelope ? undefined : "no envelope"),
  );

  await run(
    "blobs",
    "Files: bytes by SHA-256, with ETag and HEAD",
    async (p) => {
      const files: { sha256: string; size: number; redistributable: boolean }[] = [...envelope!.artifacts, ...envelope!.evidence.filter((e) => e.path && e.sha256)].map((f) => ({ sha256: f.sha256!, size: f.size!, redistributable: isRedistributable(f) }));
      const thumb = all.find((x) => x.thumbnail)?.thumbnail;
      if (thumb) files.push({ sha256: thumb.sha256, size: thumb.size, redistributable: true });
      if (!files.length) p.skip("the examined revision carries no files");
      const picked = [...new Map(files.map((f) => [f.sha256, f])).values()].sort((a, b) => a.size - b.size).slice(0, maxFiles);
      let withheld = 0;
      for (const f of picked) {
        const r = await get(`/blobs/${f.sha256}`);
        // § 4.5: a library may decline a file whose terms are not redistributable
        if (r.status === 403 && !f.redistributable && (r.json as { error?: { code?: string } } | undefined)?.error?.code === "NOT_DISTRIBUTABLE") {
          withheld++;
          continue;
        }
        if (!ok(p, r, `blob ${f.sha256}`)) continue;
        p.expect((await sha256Hex(r.bytes)) === f.sha256, `blob ${f.sha256} does not hash to its address`);
        p.expect(r.bytes.length === f.size, `blob ${f.sha256} is ${r.bytes.length} bytes, the envelope says ${f.size}`);
        p.expect(r.headers.get("etag") === `"sha256:${f.sha256}"`, `blob ETag is ${r.headers.get("etag")}, expected "sha256:${f.sha256}"`);
        p.warn(/immutable/.test(r.headers.get("cache-control") ?? ""), `blob Cache-Control is ${r.headers.get("cache-control")}; files SHOULD be cached as immutable`);
        const head = await get(`/blobs/${f.sha256}`, { method: "HEAD" });
        p.expect(head.status === 200, `HEAD blob ${f.sha256}: status ${head.status}`);
        p.expect(head.bytes.length === 0, "HEAD returned a body");
      }
      p.note = `${picked.length - withheld} file(s) verified${withheld ? `, ${withheld} withheld as not redistributable` : ""}`;
    },
    noSample ?? (envelope ? undefined : "no envelope"),
  );

  // ---- definition source (§ 4.6)
  await run(
    "revision.source",
    "Definition source: files by SHA-256, the lint, and (with evaluateSource) the definition digest",
    async (p) => {
      // the examined revision first, then the others search found, until one ships source
      let env: PartRevisionEnvelope | undefined = hasDefinitionSource(envelope!.source) ? envelope : undefined;
      let examined = 1;
      for (const s of all) {
        if (env || !hasCapability("source") || examined > maxSourceParts) break;
        if (s.partId === samplePartId) continue;
        examined++;
        const r = await get(`/parts/${enc(s.partId)}/revisions/${s.recommendedRevision ?? s.latestRevision}`);
        if (r.status === 200 && hasDefinitionSource((r.json as PartRevisionEnvelope).source)) env = r.json as PartRevisionEnvelope;
      }
      if (!env) {
        // source is optional per revision (§ 4.6.1): nothing to check is not a failure
        if (!hasCapability("source")) p.skip("capability source not declared and the examined revision ships no source");
        p.note = `none of the ${examined} revision(s) examined ships source`;
        return;
      }
      const src = env.source!;
      const { files, problems } = await verifySourceFiles(src.files!, async (f) => {
        const r = await get(`/blobs/${f.sha256}`);
        if (r.status !== 200) throw new Error(`source file ${f.path} (blob ${f.sha256}): status ${r.status}`);
        return r.bytes;
      });
      for (const x of problems) p.problems.push(`${env.partId}@${env.revision}: ${x.message}`);
      for (const x of lintSource(files, src.entry!)) p.problems.push(`${env.partId}@${env.revision}: ${x.code}${x.path ? ` ${x.path}${x.line ? `:${x.line}` : ""}` : ""}: ${x.message}`);
      if (options.evaluateSource && !p.problems.length) {
        const ns = await options.evaluateSource({ files, entry: src.entry!, export: src.export!, requires: src.requires! });
        const digest = await evaluatedDefinitionDigest(ns, src.export!);
        p.expect(digest === env.definitionDigest, `${env.partId}@${env.revision}: the source evaluates to ${digest}, the envelope's definitionDigest is ${env.definitionDigest}`);
      }
      p.note = `${env.partId}@${env.revision}: ${files.length} source file(s)${options.evaluateSource ? ", evaluated to definitionDigest" : ", not evaluated (no evaluateSource)"}`;
    },
    noSample ?? (envelope ? undefined : "no envelope"),
  );

  // ---- errors
  await run(
    "errors",
    "Errors: status, { error: { code, message } } and the documented codes",
    async (p) => {
      const ghost = `zz-no-such-part-${random()}`;
      errorReply(p, await get(`/parts/${ghost}`), 404, "PART_NOT_FOUND", "unknown part");
      errorReply(p, await get(`/parts/${ghost}/revisions`), 404, "PART_NOT_FOUND", "revisions of an unknown part");
      errorReply(p, await get(`/parts/${ghost}/revisions/1`), 404, "PART_NOT_FOUND", "revision of an unknown part");
      errorReply(p, await get(`/parts/${ghost}/revisions/1/closure`), 404, "PART_NOT_FOUND", "closure of an unknown part");
      if (samplePartId && detail) {
        errorReply(p, await get(`/parts/${enc(samplePartId)}/revisions/${detail.part.latestRevision + 1000}`), 404, "REVISION_NOT_FOUND", "unknown revision");
        errorReply(p, await get(`/parts/${enc(samplePartId)}/revisions/0`), 400, "REVISION_INVALID", "revision 0");
        errorReply(p, await get(`/parts/${enc(samplePartId)}/revisions/one`), 400, "REVISION_INVALID", "revision \"one\"");
      }
      errorReply(p, await get(`/blobs/${"0".repeat(64)}`), 404, "BLOB_NOT_FOUND", "unknown blob");
      errorReply(p, await get("/blobs/not-a-digest"), 400, "SHA256_INVALID", "malformed blob address");
      errorReply(p, await get(`/parts?cursor=${enc(`!${random()}!`)}`), 400, "CURSOR_INVALID", "unreadable cursor");
      errorReply(p, await get("/parts?limit=many"), 400, "QUERY_INVALID", "limit=many");
      errorReply(p, await get(`/no-such-endpoint-${random()}`), 404, undefined, "unknown path");
    },
    authBlocked,
  );

  const counts: Record<CheckStatus, number> = { pass: 0, fail: 0, warn: 0, skip: 0 };
  for (const c of checks) counts[c.status]++;
  return { protocol: LIBRARY_PROTOCOL, library, ...(api ? { api } : {}), ...(discovery ? { discovery } : {}), ok: counts.fail === 0, counts, checks };
}

/** A report as lines for people: one per check, failures with their problems. */
export function formatConformance(report: ConformanceReport): string {
  const mark = { pass: "pass", fail: "FAIL", warn: "warn", skip: "skip" } as const;
  const lines = [`${report.protocol} conformance of ${report.library}: ${report.ok ? "ok" : "FAILED"} (${report.counts.pass} pass, ${report.counts.fail} fail, ${report.counts.warn} warn, ${report.counts.skip} skip)`];
  for (const c of report.checks) {
    lines.push(`  ${mark[c.status]}  ${c.id.padEnd(20)} ${c.message ?? c.title}`);
    if (c.status === "fail") for (const x of c.problems?.slice(1, 8) ?? []) lines.push(`        ${x}`);
  }
  return lines.join("\n");
}
