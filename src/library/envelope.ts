/**
 * Digests and checks of the revision envelope (docs/library-protocol.md § 4).
 * Pure apart from SHA-256, which comes from Web Crypto (`globalThis.crypto`,
 * in Node 20+ and browsers), so the functions that hash are async.
 */
import { ENVELOPE_SCHEMA, type Closure, type PartRef, type PartRevisionEnvelope, type UhdSchemaRange } from "./types.js";

/** Fields that record the publish rather than the content; outside `digest`. */
export const RECORD_FIELDS = ["digest", "source", "publisher", "createdAt"] as const;

const sorted = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .filter((k) => o[k] !== undefined)
        .map((k) => [k, sorted(o[k])]),
    );
  }
  return v;
};

/** Canonical JSON: members sorted by key (UTF-16 code units), undefined dropped, no whitespace (RFC 8785 for finite numbers). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sorted(value));
}

/** The definition file form: sorted members, two-space indent, final line feed. Its SHA-256 is `definitionDigest`. */
export function definitionFile(definition: unknown): string {
  return JSON.stringify(sorted(definition), null, 2) + "\n";
}

/** Lower-case hex SHA-256 of bytes or of a string's UTF-8. */
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const definitionDigest = async (definition: unknown): Promise<string> => "sha256:" + (await sha256Hex(definitionFile(definition)));

/** Digest of an envelope: everything except `digest`, `source`, `publisher` and `createdAt`. */
export async function envelopeDigest(envelope: object): Promise<string> {
  const content = Object.fromEntries(Object.entries(envelope).filter(([k]) => !(RECORD_FIELDS as readonly string[]).includes(k)));
  return "sha256:" + (await sha256Hex(canonicalJson(content)));
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;

function compareVersions(a: string, b: string): number {
  const pa = SEMVER.exec(a)!.slice(1, 4).map(Number);
  const pb = SEMVER.exec(b)!.slice(1, 4).map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** Whether a UHD version lies in a range (`min` inclusive, `below` exclusive). */
export function uhdSchemaInRange(version: string, range: UhdSchemaRange): boolean {
  return SEMVER.test(version) && SEMVER.test(range.min) && SEMVER.test(range.below) && compareVersions(version, range.min) >= 0 && compareVersions(version, range.below) < 0;
}

/** A normalised relative path: forward slashes, no empty, `.` or `..` segments, no leading slash. */
export function isSafePath(path: string): boolean {
  if (path === "" || path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((s) => s !== "" && s !== "." && s !== "..");
}

/** Whether a taxonomy path is `filter` or lies below it (segment-wise prefix). */
export const underTaxonomyPath = (path: string, filter: string): boolean => path === filter || path.startsWith(filter + ".");

/** A path and every ancestor of it: `a.b.c` → `a`, `a.b`, `a.b.c`. */
export const taxonomyAncestors = (path: string): string[] => path.split(".").map((_, i, parts) => parts.slice(0, i + 1).join("."));

/** Every distinct child `moduleDefId` of a definition, sorted. */
export function referencedDefinitions(definition: { children?: { moduleDefId?: unknown }[] }): string[] {
  return [...new Set((definition.children ?? []).map((c) => c?.moduleDefId).filter((id): id is string => typeof id === "string"))].sort();
}

/** Every `filePath` the definition's artifacts (and its harnesses' artifacts) reference. */
export function referencedFiles(definition: { artifacts?: unknown[]; harnesses?: { artifacts?: unknown[] }[] }): { path: string; artifactId: string }[] {
  const all = [...(definition.artifacts ?? []), ...(definition.harnesses ?? []).flatMap((h) => h?.artifacts ?? [])] as { id?: unknown; filePath?: unknown }[];
  return all.filter((a) => typeof a?.filePath === "string" && a.filePath !== "").map((a) => ({ path: a.filePath as string, artifactId: String(a.id) }));
}

export interface EnvelopeProblem {
  code: string;
  message: string;
  at?: string;
}

/**
 * The rules of § 4 that a schema cannot state: digests, dependencies equal to
 * the children, every referenced file accounted for, unique paths, lineage.
 * `schemas` are the identifiers accepted for `schema` (default the standard
 * one). Shape is the JSON Schema's job (`validateEnvelopeShape`).
 */
export async function envelopeProblems(env: PartRevisionEnvelope, options: { schemas?: string[]; expect?: PartRef & { digest?: string } } = {}): Promise<EnvelopeProblem[]> {
  const out: EnvelopeProblem[] = [];
  const add = (code: string, message: string, at?: string) => out.push({ code, message, ...(at ? { at } : {}) });
  const schemas = options.schemas ?? [ENVELOPE_SCHEMA];
  if (!schemas.includes(env.schema)) add("ENVELOPE_SCHEMA", `schema is ${JSON.stringify(env.schema)}, expected ${schemas.join(" or ")}`, "schema");
  if (options.expect && (env.partId !== options.expect.partId || env.revision !== options.expect.revision)) add("NOT_ASKED_FOR", `is ${env.partId}@${env.revision}, asked for ${options.expect.partId}@${options.expect.revision}`);
  if (env.definition?.id !== env.partId) add("DEFINITION_ID", `definition.id ${JSON.stringify(env.definition?.id)} differs from partId`, "definition.id");
  if ((await definitionDigest(env.definition)) !== env.definitionDigest) add("DEFINITION_DIGEST", "definitionDigest does not match the definition", "definitionDigest");
  if ((await envelopeDigest(env)) !== env.digest) add("DIGEST", "digest does not match the envelope", "digest");
  if (options.expect?.digest !== undefined && env.digest !== options.expect.digest) add("DIGEST_PINNED", `digest is ${env.digest}, pinned ${options.expect.digest}`, "digest");

  const ids = env.dependencies.map((d) => d.partId);
  const want = referencedDefinitions(env.definition as { children?: { moduleDefId?: unknown }[] });
  if (new Set(ids).size !== ids.length) add("DEPENDENCY_DUPLICATE", "each dependency appears once", "dependencies");
  if (ids.includes(env.partId)) add("DEPENDENCY_SELF", "a part cannot depend on itself", "dependencies");
  const missing = want.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !want.includes(id));
  if (missing.length) add("DEPENDENCY_MISSING", `children reference ${missing.join(", ")} with no pinned revision`, "dependencies");
  if (extra.length) add("DEPENDENCY_UNUSED", `${extra.join(", ")} not referenced by the definition`, "dependencies");

  const paths = new Set<string>();
  const files = [...env.artifacts.map((a, i) => [a.path, `artifacts[${i}].path`] as const), ...env.evidence.flatMap((e, i) => (e.path !== undefined ? [[e.path, `evidence[${i}].path`] as const] : []))];
  for (const [path, at] of files) {
    if (!isSafePath(path)) add("PATH_INVALID", `${path} is not a normalised relative path`, at);
    else if (paths.has(path)) add("PATH_DUPLICATE", `${path} listed twice`, at);
    paths.add(path);
  }
  env.evidence.forEach((e, i) => {
    if (e.path === undefined && !(typeof e.url === "string" && /^https?:\/\//.test(e.url))) add("EVIDENCE_REF", "evidence needs a carried file or an http(s) url", `evidence[${i}]`);
    if (e.path !== undefined && (e.sha256 === undefined || e.size === undefined || e.mediaType === undefined)) add("EVIDENCE_FILE", "a carried evidence file needs sha256, size and mediaType", `evidence[${i}]`);
  });
  const carried = new Set(env.artifacts.map((a) => a.path));
  const declared = new Set(env.missingArtifacts.map((m) => m.path));
  for (const { path, artifactId } of referencedFiles(env.definition as { artifacts?: unknown[] })) {
    if (!carried.has(path) && !declared.has(path)) add("ARTIFACT_UNACCOUNTED", `artifact ${artifactId} references ${path}, neither carried nor listed missing`, "artifacts");
  }
  env.missingArtifacts.forEach((m, i) => carried.has(m.path) && add("MISSING_ARTIFACT_CARRIED", `${m.path} is carried and listed missing`, `missingArtifacts[${i}]`));

  const d = env.derivedFrom;
  if (d && d.partId === env.partId && d.revision >= env.revision) add("DERIVED_FROM_ORDER", "a revision derives from an earlier revision of its part", "derivedFrom");
  if (env.revision > 1 && !d) add("DERIVED_FROM_REQUIRED", "a revision after the first names the revision it was derived from", "derivedFrom");
  return out;
}

/**
 * The rules of § 3.6 for a closure: the root present, each revision once,
 * every dependency present at its pinned revision and before it, nothing
 * unreachable. Returns the problems and the conflicts recomputed from the
 * revisions.
 */
export function closureProblems(c: Closure, root: PartRef): { problems: EnvelopeProblem[]; conflicts: Closure["conflicts"] } {
  const problems: EnvelopeProblem[] = [];
  const add = (code: string, message: string) => problems.push({ code, message });
  const key = (r: PartRef) => `${r.partId}@${r.revision}`;
  if (c.root?.partId !== root.partId || c.root?.revision !== root.revision) add("CLOSURE_ROOT", `root is ${c.root?.partId}@${c.root?.revision}, asked for ${key(root)}`);
  const position = new Map<string, number>();
  c.revisions.forEach((env, i) => {
    if (position.has(key(env))) add("CLOSURE_DUPLICATE", `${key(env)} listed twice`);
    position.set(key(env), i);
  });
  if (!position.has(key(root))) add("CLOSURE_ROOT_MISSING", "the root revision is not listed");
  for (const [i, env] of c.revisions.entries())
    for (const d of env.dependencies) {
      const at = position.get(key(d));
      if (at === undefined) add("CLOSURE_INCOMPLETE", `${key(env)} pins ${key(d)}, which is missing`);
      else if (at >= i) add("CLOSURE_ORDER", `${key(d)} is listed after ${key(env)}, which pins it`);
    }
  const byKey = new Map(c.revisions.map((env) => [key(env), env]));
  const reached = new Set<string>();
  const walk = (k: string) => {
    if (reached.has(k) || !byKey.has(k)) return;
    reached.add(k);
    for (const d of byKey.get(k)!.dependencies) walk(key(d));
  };
  walk(key(root));
  const extra = [...byKey.keys()].filter((k) => !reached.has(k));
  if (extra.length) add("CLOSURE_UNREACHABLE", `${extra.join(", ")} not reachable from the root`);
  const revisionsOf = new Map<string, number[]>();
  for (const env of c.revisions) revisionsOf.set(env.partId, [...(revisionsOf.get(env.partId) ?? []), env.revision]);
  const conflicts = [...revisionsOf.entries()].filter(([, r]) => r.length > 1).map(([partId, r]) => ({ partId, revisions: [...r].sort((a, b) => a - b) }));
  return { problems, conflicts };
}

/** Fill in `definitionDigest` and `digest` of an envelope whose content is complete. */
export async function sealEnvelope<T extends Omit<PartRevisionEnvelope, "definitionDigest" | "digest">>(envelope: T): Promise<T & { definitionDigest: string; digest: string }> {
  const withDefinition = { ...envelope, definitionDigest: await definitionDigest(envelope.definition) };
  return { ...withDefinition, digest: await envelopeDigest(withDefinition) };
}
