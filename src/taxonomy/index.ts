/**
 * The UHD category taxonomy (docs/taxonomy.md).
 *
 * A versioned tree of hardware categories, defined in `uhd-taxonomy.json`
 * (schema `uhd-taxonomy.schema.json`). A node is addressed by its dotted
 * path of ids from the root: `sensor.distance`, `actuator.motor.servo`. A
 * module lists the paths it belongs to in `ModuleDef.categories`, at any
 * depth; `tags` stay free-form keywords.
 *
 * Subtree filtering works on ancestors: a module in `actuator.motor.servo`
 * is also in `actuator.motor` and `actuator`. `categoryAncestors` expands a
 * module's paths into every ancestor once, which an index can match exactly
 * (selecting `actuator` matches the servo without prefix queries).
 *
 * Libraries extend the tree with their own nodes under one root named
 * `x-<library>` (`x-acme.lab_fixtures`), declared in a taxonomy extension
 * file (`taxonomy-extension.schema.json`) that also names the taxonomy
 * version the library is categorised against.
 *
 * A taxonomy may also publish `aliases`: paths that are not nodes but that
 * parts have used, each mapped to the node paths that hold the same parts.
 * `validateCategories` suggests an alias's targets, and `migrateCategories`
 * rewrites a part's categories to them.
 *
 * Everything here is pure data and computation: no file or network access.
 * `uhd-taxonomy.data.ts` is generated from the JSON file
 * (`npm run build:taxonomy`); the test suite checks they agree.
 */
import { UHD_TAXONOMY_DATA } from "./uhd-taxonomy.data.js";

export interface TaxonomyLink {
  label: string;
  url: string;
}

/** A node as written in a taxonomy or extension file (snake_case keys, children by id). */
export interface TaxonomyNodeData {
  name: string;
  description?: string;
  /** Canonical documentation for this category (vendor docs, tutorial index). */
  docs_url?: string;
  /** Further reference links. */
  links?: TaxonomyLink[];
  /** Short guidance for agents working with parts in this category. */
  agent_notes?: string;
  /** Present only on kit nodes (children of `kit`, or kit nodes in an extension). */
  kit?: {
    sku: string;
    vendor: string;
    /** Id of the kit's main controller part in the declaring library. */
    controller_part_id?: string;
    /** Where the declaring library keeps the kit's contents list (library-relative path or URL). */
    manifest?: string;
  };
  children?: Record<string, TaxonomyNodeData>;
}

/** A taxonomy file: `uhd-taxonomy.json` or any document with the same shape. */
export interface TaxonomyDocument {
  $schema?: string;
  /** Taxonomy identifier: "uhd" for UHD's own. */
  id: string;
  /** Semantic version. Within one major version paths are only added, never renamed or removed. */
  version: string;
  description?: string;
  delimiter: ".";
  /** Where the taxonomy comes from and what changed on the way (free-form record). */
  provenance?: Record<string, unknown>;
  /**
   * Legacy paths that are not nodes, each mapped to the node paths that
   * replace it (for example category paths an older library used).
   */
  aliases?: Record<string, string[]>;
  categories: Record<string, TaxonomyNodeData>;
}

/**
 * A library's taxonomy declaration: the taxonomy version its parts are
 * categorised against, and optionally its own nodes under one root,
 * `x-<library>`.
 */
export interface TaxonomyExtension {
  $schema?: string;
  /** Library name, lower-case kebab: the extension root is `x-<library>`. */
  library: string;
  /** The taxonomy the library uses, by id and version. */
  taxonomy: { id: string; version: string };
  description?: string;
  /** At most one key, `x-<library>`. */
  categories?: Record<string, TaxonomyNodeData>;
}

export interface TaxonomyKit {
  sku: string;
  vendor: string;
  controllerPartId?: string;
  manifest?: string;
}

/** A node of a built taxonomy. */
export interface TaxonomyNode {
  /** Local id, e.g. "distance". */
  id: string;
  /** Full dotted path from the root, e.g. "sensor.distance". */
  path: string;
  name: string;
  description?: string;
  docsUrl?: string;
  links: TaxonomyLink[];
  agentNotes?: string;
  kit?: TaxonomyKit;
  /** 0 for a root. */
  depth: number;
  /** Parent path; absent on roots. */
  parent?: string;
  /** Who defined the node: the taxonomy id ("uhd") or the extension's library name. */
  source: string;
  /** Direct children, in declaration order. */
  children: TaxonomyNode[];
}

/** A taxonomy built from a document and any library extensions. */
export interface Taxonomy {
  id: string;
  version: string;
  delimiter: string;
  /** Root nodes in declaration order; extension roots come last. */
  roots: TaxonomyNode[];
  /** The extensions merged in. */
  extensions: { library: string; root: string; taxonomyVersion: string }[];
  /** Every node, depth-first in declaration order. */
  nodes(): TaxonomyNode[];
  node(path: string): TaxonomyNode | undefined;
  has(path: string): boolean;
  /** Direct children of a path; the roots for null, undefined or "". Unknown paths have none. */
  children(path?: string | null): TaxonomyNode[];
  /** Nodes from the root down to the path, skipping unknown segments. Empty for no path. */
  breadcrumbs(path: string | null | undefined): TaxonomyNode[];
  /** Legacy alias paths and the node paths each maps to (from the document's `aliases`). */
  aliases: ReadonlyMap<string, readonly string[]>;
}

export interface TaxonomyProblem {
  code: string;
  message: string;
  /** Where in the document, e.g. "categories.sensor.children.distance". */
  at?: string;
}

/** A category path a module lists that the taxonomy does not have, or cannot have. */
export interface CategoryIssue {
  path: string;
  /** `syntax`: not a dotted path of ids. `unknown`: well-formed but not in the taxonomy. */
  code: "syntax" | "unknown";
  message: string;
  /** Known paths the author probably meant: an alias's targets, the same last id, or the path under another root. */
  suggestions: string[];
  /** Set when the path is one of the taxonomy's legacy aliases; `suggestions` are then its targets. */
  alias?: true;
}

export class TaxonomyError extends Error {
  constructor(readonly problems: TaxonomyProblem[]) {
    super(`invalid taxonomy: ${problems.map((p) => `${p.at ? p.at + ": " : ""}${p.message}`).join("; ")}`);
    this.name = "TaxonomyError";
  }
}

export const TAXONOMY_DELIMITER = ".";
/** A core node id. */
export const TAXONOMY_NODE_ID = /^[a-z][a-z0-9_]*$/;
/** A library name, which makes its extension root `x-<library>`. */
export const TAXONOMY_LIBRARY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** An extension root id: `x-` and a library name. */
export const TAXONOMY_EXTENSION_ROOT = /^x-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const HTTP_URL = /^https?:\/\/\S+$/;

// ---------------------------------------------------------------------------
// Paths (no taxonomy needed)
// ---------------------------------------------------------------------------

/** A well-formed path: ids joined by dots, the first may be an extension root (`x-acme`). */
export function isCategoryPath(path: string): boolean {
  if (typeof path !== "string" || path === "") return false;
  const ids = path.split(TAXONOMY_DELIMITER);
  return ids.every((id, i) => TAXONOMY_NODE_ID.test(id) || (i === 0 && TAXONOMY_EXTENSION_ROOT.test(id)));
}

/** Parent path, or undefined for a root. */
export function categoryParent(path: string): string | undefined {
  const i = path.lastIndexOf(TAXONOMY_DELIMITER);
  return i < 0 ? undefined : path.slice(0, i);
}

/**
 * Every path and every ancestor of each, once, sorted. For
 * `["actuator.motor.servo", "robotics.rc"]`:
 * `["actuator", "actuator.motor", "actuator.motor.servo", "robotics", "robotics.rc"]`.
 * Empty segments (stray dots) are dropped rather than failing.
 */
export function categoryAncestors(paths: readonly string[] | undefined): string[] {
  const out = new Set<string>();
  for (const raw of paths ?? []) {
    if (typeof raw !== "string") continue;
    const ids = raw.split(TAXONOMY_DELIMITER).filter((s) => s.length > 0);
    for (let i = 1; i <= ids.length; i++) out.add(ids.slice(0, i).join(TAXONOMY_DELIMITER));
  }
  return [...out].sort();
}

/** Does a module with these categories sit at or under `path`? No path (null, "") matches everything. */
export function categoryMatches(categories: readonly string[] | undefined, path: string | null | undefined): boolean {
  if (!path) return true;
  const prefix = path + TAXONOMY_DELIMITER;
  return (categories ?? []).some((c) => c === path || c.startsWith(prefix));
}

/**
 * How many items sit at or under each path (an item counts once per path,
 * however many of its categories fall under it). With `paths`, only those
 * are counted (zero included); without, every ancestor of every item's
 * categories.
 */
export function countCategories(items: ReadonlyArray<{ categories?: readonly string[] }>, paths?: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of paths ?? []) counts.set(p, 0);
  for (const item of items) {
    for (const a of categoryAncestors(item.categories)) {
      if (paths && !counts.has(a)) continue;
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Compare a declared taxonomy version with the one available.
 * `same`; `compatible` (same major, the available one is newer: every
 * declared path exists); `newer` (same major, the declaration is newer: paths
 * it uses may be missing here); `incompatible` (another major: paths may have
 * been renamed or removed).
 */
export function compareTaxonomyVersions(declared: string, available: string): "same" | "compatible" | "newer" | "incompatible" {
  const d = SEMVER.exec(declared);
  const a = SEMVER.exec(available);
  if (!d || !a || d[1] !== a[1]) return "incompatible";
  for (let i = 2; i <= 3; i++) {
    if (Number(d[i]) < Number(a[i])) return "compatible";
    if (Number(d[i]) > Number(a[i])) return "newer";
  }
  return "same";
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const NODE_KEYS = new Set(["name", "description", "docs_url", "links", "agent_notes", "kit", "children"]);

function nodeProblems(node: unknown, at: string, out: TaxonomyProblem[]): void {
  const add = (message: string, where = at): void => {
    out.push({ code: "NODE_INVALID", message, at: where });
  };
  if (!isObject(node)) return add("node must be an object");
  for (const k of Object.keys(node)) if (!NODE_KEYS.has(k)) add(`unknown field "${k}"`);
  if (typeof node.name !== "string" || node.name.trim() === "") add("name must be a non-empty string");
  if (node.description !== undefined && typeof node.description !== "string") add("description must be a string");
  if (node.docs_url !== undefined && !(typeof node.docs_url === "string" && HTTP_URL.test(node.docs_url))) add("docs_url must be an http(s) URL");
  if (node.agent_notes !== undefined && !(typeof node.agent_notes === "string" && node.agent_notes.length <= 600)) add("agent_notes must be a string of at most 600 characters");
  if (node.links !== undefined) {
    if (!Array.isArray(node.links)) add("links must be an array");
    else
      node.links.forEach((l, i) => {
        if (!isObject(l) || typeof l.label !== "string" || l.label === "" || typeof l.url !== "string" || !HTTP_URL.test(l.url)) add("a link is { label, url (http/https) }", `${at}.links[${i}]`);
      });
  }
  if (node.kit !== undefined) {
    const k = node.kit;
    if (!isObject(k) || typeof k.sku !== "string" || k.sku === "" || typeof k.vendor !== "string" || k.vendor === "") add("kit needs a sku and a vendor", `${at}.kit`);
    else
      for (const f of ["controller_part_id", "manifest"]) if (k[f] !== undefined && typeof k[f] !== "string") add(`${f} must be a string`, `${at}.kit`);
  }
  if (node.children !== undefined) {
    if (!isObject(node.children)) return add("children must be an object of nodes by id");
    for (const [id, child] of Object.entries(node.children)) {
      if (!TAXONOMY_NODE_ID.test(id)) add(`node id "${id}" must match ${TAXONOMY_NODE_ID}`, `${at}.children`);
      nodeProblems(child, `${at}.children.${id}`, out);
    }
  }
}

/** Problems with a taxonomy document; empty when it is valid. */
export function validateTaxonomyDocument(doc: unknown): TaxonomyProblem[] {
  const out: TaxonomyProblem[] = [];
  if (!isObject(doc)) return [{ code: "DOCUMENT_INVALID", message: "a taxonomy is an object" }];
  const allowed = new Set(["$schema", "id", "version", "description", "delimiter", "provenance", "aliases", "categories"]);
  for (const k of Object.keys(doc)) if (!allowed.has(k)) out.push({ code: "DOCUMENT_INVALID", message: `unknown field "${k}"`, at: k });
  if (typeof doc.id !== "string" || !TAXONOMY_NODE_ID.test(doc.id)) out.push({ code: "DOCUMENT_INVALID", message: "id must be a lower-case identifier", at: "id" });
  if (typeof doc.version !== "string" || !SEMVER.test(doc.version)) out.push({ code: "DOCUMENT_INVALID", message: "version must be MAJOR.MINOR.PATCH", at: "version" });
  if (doc.delimiter !== TAXONOMY_DELIMITER) out.push({ code: "DOCUMENT_INVALID", message: 'delimiter must be "."', at: "delimiter" });
  if (doc.provenance !== undefined && !isObject(doc.provenance)) out.push({ code: "DOCUMENT_INVALID", message: "provenance must be an object", at: "provenance" });
  if (!isObject(doc.categories)) out.push({ code: "DOCUMENT_INVALID", message: "categories must be an object of root nodes by id", at: "categories" });
  else
    for (const [id, node] of Object.entries(doc.categories)) {
      if (!TAXONOMY_NODE_ID.test(id)) out.push({ code: "NODE_INVALID", message: `root id "${id}" must match ${TAXONOMY_NODE_ID} (x- roots belong in an extension)`, at: "categories" });
      nodeProblems(node, `categories.${id}`, out);
    }
  if (doc.aliases !== undefined) {
    if (!isObject(doc.aliases)) out.push({ code: "ALIAS_INVALID", message: "aliases must be an object of target path lists by legacy path", at: "aliases" });
    else {
      const known = new Set<string>();
      const walk = (nodes: unknown, prefix: string): void => {
        if (!isObject(nodes)) return;
        for (const [id, n] of Object.entries(nodes)) {
          known.add(prefix + id);
          if (isObject(n)) walk(n.children, `${prefix}${id}${TAXONOMY_DELIMITER}`);
        }
      };
      walk(doc.categories, "");
      for (const [from, to] of Object.entries(doc.aliases)) {
        const at = `aliases.${from}`;
        if (!isCategoryPath(from)) out.push({ code: "ALIAS_INVALID", message: `alias "${from}" is not a category path`, at });
        else if (known.has(from)) out.push({ code: "ALIAS_INVALID", message: `alias "${from}" is a node of the taxonomy; an alias names a path that is not one`, at });
        if (!Array.isArray(to) || to.length === 0) out.push({ code: "ALIAS_INVALID", message: `alias "${from}" must map to a non-empty list of node paths`, at });
        else for (const t of to) if (typeof t !== "string" || !known.has(t)) out.push({ code: "ALIAS_INVALID", message: `alias "${from}" maps to "${String(t)}", which is not a node of the taxonomy`, at });
      }
    }
  }
  return out;
}

/**
 * Problems with a library's taxonomy extension; empty when it is valid. With
 * `base`, the declared taxonomy must be that one and of a compatible version.
 */
export function validateTaxonomyExtension(ext: unknown, base?: { id: string; version: string }): TaxonomyProblem[] {
  const out: TaxonomyProblem[] = [];
  const add = (code: string, message: string, at?: string): void => {
    out.push({ code, message, ...(at ? { at } : {}) });
  };
  if (!isObject(ext)) return [{ code: "EXTENSION_INVALID", message: "a taxonomy extension is an object" }];
  const allowed = new Set(["$schema", "library", "taxonomy", "description", "categories"]);
  for (const k of Object.keys(ext)) if (!allowed.has(k)) add("EXTENSION_INVALID", `unknown field "${k}"`, k);
  const library = typeof ext.library === "string" && TAXONOMY_LIBRARY_NAME.test(ext.library) ? ext.library : undefined;
  if (!library) add("EXTENSION_INVALID", "library must be a lower-case kebab name", "library");
  const t = ext.taxonomy;
  if (!isObject(t) || typeof t.id !== "string" || typeof t.version !== "string" || !SEMVER.test(t.version)) add("EXTENSION_INVALID", "taxonomy must be { id, version (MAJOR.MINOR.PATCH) }", "taxonomy");
  else if (base) {
    if (t.id !== base.id) add("TAXONOMY_MISMATCH", `the library is categorised against taxonomy "${t.id}", not "${base.id}"`, "taxonomy.id");
    else {
      const v = compareTaxonomyVersions(t.version, base.version);
      if (v === "incompatible") add("TAXONOMY_VERSION_INCOMPATIBLE", `the library uses ${t.id} ${t.version}; ${base.version} is another major version`, "taxonomy.version");
      if (v === "newer") add("TAXONOMY_VERSION_NEWER", `the library uses ${t.id} ${t.version}, newer than the ${base.version} available`, "taxonomy.version");
    }
  }
  if (ext.categories !== undefined) {
    if (!isObject(ext.categories)) add("EXTENSION_INVALID", "categories must be an object", "categories");
    else
      for (const [id, node] of Object.entries(ext.categories)) {
        if (library && id !== `x-${library}`) add("EXTENSION_NAMESPACE", `an extension of library "${library}" adds nodes under x-${library} only, not "${id}"`, "categories");
        else if (!library && !TAXONOMY_EXTENSION_ROOT.test(id)) add("EXTENSION_NAMESPACE", `extension root "${id}" must be x-<library>`, "categories");
        nodeProblems(node, `categories.${id}`, out);
      }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

function buildNode(id: string, raw: TaxonomyNodeData, parent: TaxonomyNode | undefined, source: string): TaxonomyNode {
  const path = parent ? `${parent.path}${TAXONOMY_DELIMITER}${id}` : id;
  const node: TaxonomyNode = {
    id,
    path,
    name: raw.name,
    ...(raw.description !== undefined ? { description: raw.description } : {}),
    ...(raw.docs_url !== undefined ? { docsUrl: raw.docs_url } : {}),
    links: (raw.links ?? []).map((l) => ({ label: l.label, url: l.url })),
    ...(raw.agent_notes !== undefined ? { agentNotes: raw.agent_notes } : {}),
    ...(raw.kit
      ? {
          kit: {
            sku: raw.kit.sku,
            vendor: raw.kit.vendor,
            ...(raw.kit.controller_part_id !== undefined ? { controllerPartId: raw.kit.controller_part_id } : {}),
            ...(raw.kit.manifest !== undefined ? { manifest: raw.kit.manifest } : {}),
          },
        }
      : {}),
    depth: parent ? parent.depth + 1 : 0,
    ...(parent ? { parent: parent.path } : {}),
    source,
    children: [],
  };
  node.children = Object.entries(raw.children ?? {}).map(([cid, c]) => buildNode(cid, c, node, source));
  return node;
}

/**
 * Build a taxonomy from a document and library extensions. Throws a
 * `TaxonomyError` when the document or an extension is invalid, an
 * extension declares another taxonomy or an incompatible version, or two
 * extensions claim the same library.
 */
export function buildTaxonomy(doc: TaxonomyDocument, extensions: readonly TaxonomyExtension[] = []): Taxonomy {
  const problems = validateTaxonomyDocument(doc);
  const seen = new Set<string>();
  extensions.forEach((ext, i) => {
    for (const p of validateTaxonomyExtension(ext, doc)) {
      if (p.code !== "TAXONOMY_VERSION_NEWER") problems.push({ ...p, at: `extensions[${i}]${p.at ? "." + p.at : ""}` });
    }
    if (seen.has(ext.library)) problems.push({ code: "EXTENSION_DUPLICATE", message: `two extensions for library "${ext.library}"`, at: `extensions[${i}]` });
    seen.add(ext.library);
  });
  if (problems.length) throw new TaxonomyError(problems);

  const roots = Object.entries(doc.categories).map(([id, raw]) => buildNode(id, raw, undefined, doc.id));
  for (const ext of extensions) for (const [id, raw] of Object.entries(ext.categories ?? {})) roots.push(buildNode(id, raw, undefined, ext.library));
  const byPath = new Map<string, TaxonomyNode>();
  const walk = (n: TaxonomyNode) => {
    byPath.set(n.path, n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  const aliases = new Map(Object.entries(doc.aliases ?? {}).map(([from, to]) => [from, Object.freeze([...to])] as const));

  return {
    id: doc.id,
    version: doc.version,
    delimiter: doc.delimiter,
    roots,
    extensions: extensions.map((e) => ({ library: e.library, root: `x-${e.library}`, taxonomyVersion: e.taxonomy.version })),
    nodes: () => [...byPath.values()],
    node: (path) => byPath.get(path),
    has: (path) => byPath.has(path),
    children: (path) => (path ? byPath.get(path)?.children ?? [] : roots),
    breadcrumbs: (path) => {
      if (!path) return [];
      const ids = path.split(TAXONOMY_DELIMITER);
      return ids.map((_, i) => byPath.get(ids.slice(0, i + 1).join(TAXONOMY_DELIMITER))).filter((n): n is TaxonomyNode => !!n);
    },
    aliases,
  };
}

/** UHD's taxonomy file, as data. */
export const UHD_TAXONOMY_DOCUMENT: TaxonomyDocument = UHD_TAXONOMY_DATA as TaxonomyDocument;

/** UHD's taxonomy, built, with no extensions. */
export const UHD_TAXONOMY: Taxonomy = buildTaxonomy(UHD_TAXONOMY_DOCUMENT);

// ---------------------------------------------------------------------------
// Validating a module's categories
// ---------------------------------------------------------------------------

/** Known paths an unknown one probably meant: the same tail under another parent, then the same last id. */
function suggestions(path: string, taxonomy: Taxonomy): string[] {
  const all = taxonomy.nodes();
  const tail = all.filter((n) => n.path.endsWith(TAXONOMY_DELIMITER + path)).map((n) => n.path);
  if (tail.length) return tail;
  const last = path.split(TAXONOMY_DELIMITER).pop()!;
  return all.filter((n) => n.id === last).map((n) => n.path);
}

/** The node paths a legacy alias maps to, or undefined when the path is not an alias. */
export function resolveCategoryAlias(path: string, taxonomy: Taxonomy = UHD_TAXONOMY): readonly string[] | undefined {
  return taxonomy.has(path) ? undefined : taxonomy.aliases.get(path);
}

/**
 * A part's categories with every legacy alias replaced by its targets, each
 * path once, in first-seen order. Paths that are neither nodes nor aliases
 * are kept, so `validateCategories` still reports them.
 */
export function migrateCategories(categories: readonly string[] | undefined, taxonomy: Taxonomy = UHD_TAXONOMY): string[] {
  const out = new Set<string>();
  for (const path of categories ?? []) for (const p of resolveCategoryAlias(path, taxonomy) ?? [path]) out.add(p);
  return [...out];
}

/** Category paths that are malformed or not in the taxonomy (default: UHD's). */
export function validateCategories(categories: readonly string[] | undefined, taxonomy: Taxonomy = UHD_TAXONOMY): CategoryIssue[] {
  const out: CategoryIssue[] = [];
  for (const path of new Set(categories ?? [])) {
    if (!isCategoryPath(path)) {
      out.push({ path, code: "syntax", message: `"${path}" is not a category path (dotted ids such as sensor.distance)`, suggestions: [] });
    } else if (!taxonomy.has(path) && taxonomy.aliases.has(path)) {
      const s = [...taxonomy.aliases.get(path)!];
      out.push({ path, code: "unknown", message: `"${path}" is a legacy category path, not in the ${taxonomy.id} taxonomy ${taxonomy.version}; use ${s.join(" and ")}`, suggestions: s, alias: true });
    } else if (!taxonomy.has(path)) {
      const s = suggestions(path, taxonomy);
      const root = path.split(TAXONOMY_DELIMITER)[0];
      const why = TAXONOMY_EXTENSION_ROOT.test(root) && !taxonomy.roots.some((r) => r.id === root) ? ` (the ${root} extension is not loaded)` : "";
      out.push({ path, code: "unknown", message: `"${path}" is not in the ${taxonomy.id} taxonomy ${taxonomy.version}${why}${s.length ? `; did you mean ${s.join(" or ")}?` : ""}`, suggestions: s });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Trees for display and APIs
// ---------------------------------------------------------------------------

/** A JSON-ready node with an optional count (items at or under it). */
export interface TaxonomyTreeNode {
  id: string;
  path: string;
  name: string;
  description?: string;
  docsUrl?: string;
  links?: TaxonomyLink[];
  agentNotes?: string;
  kit?: TaxonomyKit;
  source: string;
  count?: number;
  children: TaxonomyTreeNode[];
}

/** The taxonomy as plain JSON, with each node's count from `counts` (e.g. `countCategories`). */
export function taxonomyTree(taxonomy: Taxonomy, counts?: ReadonlyMap<string, number>): TaxonomyTreeNode[] {
  const convert = (n: TaxonomyNode): TaxonomyTreeNode => ({
    id: n.id,
    path: n.path,
    name: n.name,
    ...(n.description !== undefined ? { description: n.description } : {}),
    ...(n.docsUrl !== undefined ? { docsUrl: n.docsUrl } : {}),
    ...(n.links.length ? { links: n.links } : {}),
    ...(n.agentNotes !== undefined ? { agentNotes: n.agentNotes } : {}),
    ...(n.kit ? { kit: n.kit } : {}),
    source: n.source,
    ...(counts ? { count: counts.get(n.path) ?? 0 } : {}),
    children: n.children.map(convert),
  });
  return taxonomy.roots.map(convert);
}
