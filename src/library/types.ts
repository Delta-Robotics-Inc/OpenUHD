/**
 * The UHD library protocol, `uhd-library/v1` (docs/library-protocol.md):
 * response shapes and the revision envelope. Types only.
 */
import type { ModuleDef } from "../types/module.js";

export const LIBRARY_PROTOCOL = "uhd-library/v1";
export const ENVELOPE_SCHEMA = "uhd.part-revision/v1";

/** Part ids: lower-case letters, digits, `.`, `_`, `-`; at most 128 characters. */
export const PART_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

/** UHD schema versions, `min` inclusive, `below` exclusive. */
export interface UhdSchemaRange {
  min: string;
  below: string;
}

/** Optional features a library declares in `capabilities`. */
export type LibraryCapability = "facets" | "taxonomy" | "definition" | (string & {});

/** `GET {library}/.well-known/uhd-library` and `GET {api root}`. */
export interface DiscoveryDocument {
  protocol: typeof LIBRARY_PROTOCOL;
  name: string;
  /** A short id clients may suggest for the library. */
  id?: string;
  description?: string;
  /** The library implementation's version. */
  version: string;
  /** API root, resolved against the URL the document was fetched from. */
  api?: string;
  /** Envelope `schema` values the library serves. */
  envelopeSchemas: string[];
  uhdSchema: UhdSchemaRange;
  /** Taxonomy the parts' categories come from, or null when they carry none. */
  taxonomy: { version: string; namespaces?: string[] } | null;
  capabilities: LibraryCapability[];
  auth: { read: "none" } | { read: "bearer"; realm?: string; documentation?: string };
  limits?: { defaultPageSize?: number; maxPageSize?: number };
  [extra: string]: unknown;
}

/** An exact revision of a part. */
export interface PartRef {
  partId: string;
  revision: number;
}

export interface Deprecation {
  reason: string;
  at: string;
  replacedBy?: PartRef;
}

/** A file by content address. */
export interface BlobRef {
  /** Lower-case hex SHA-256 of the bytes. */
  sha256: string;
  size: number;
  mediaType: string;
}

/** A part as search and part detail describe it: by its recommended revision. */
export interface PartSummary {
  partId: string;
  name: string;
  description?: string;
  manufacturer?: string;
  partNumber?: string;
  /** Taxonomy paths (the definition's categories). */
  categories: string[];
  tags: string[];
  /** Protocol types of exposed interfaces. */
  protocols: string[];
  domains: string[];
  latestRevision: number;
  /** Newest revision that is not deprecated; absent when all are. */
  recommendedRevision?: number;
  deprecated?: Deprecation;
  thumbnail?: BlobRef;
}

export interface SearchQuery {
  q?: string;
  /** Taxonomy path: parts filed at it or below it. */
  taxonomy?: string;
  domain?: string;
  protocol?: string;
  tag?: string;
  includeDeprecated?: boolean;
  limit?: number;
  cursor?: string;
  facets?: boolean;
}

/** Counts of matching parts per value, over every page. */
export interface SearchFacets {
  /** Each path and every ancestor of it. */
  taxonomy: Record<string, number>;
  domain: Record<string, number>;
  protocol: Record<string, number>;
  tag: Record<string, number>;
}

export interface SearchResponse {
  total: number;
  parts: PartSummary[];
  nextCursor: string | null;
  facets?: SearchFacets;
}

export interface RevisionRow {
  partId: string;
  revision: number;
  digest: string;
  definitionDigest: string;
  uhdSchema: string;
  createdAt: string;
  publisher?: string;
  deprecated?: Deprecation;
}

export interface PartDetail {
  part: PartSummary;
  revisions: RevisionRow[];
}

export interface RevisionList {
  partId: string;
  revisions: RevisionRow[];
}

export const ARTIFACT_ROLES = ["body", "interface", "source", "drawing", "thumbnail", "license", "attachment"] as const;
export type ArtifactRole = (typeof ARTIFACT_ROLES)[number];

export const EVIDENCE_KINDS = ["sources", "verification", "datasheet", "document", "other"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface EnvelopeArtifact extends BlobRef {
  /** The definition's `filePath`, relative to the revision's artifact base. */
  path: string;
  role: ArtifactRole;
  /** The `ArtifactDef.id` this file backs. */
  artifactId?: string;
}

export interface MissingArtifact {
  path: string;
  artifactId: string;
  reason: string;
}

/** A carried file (path, sha256, size, mediaType) or an http(s) url. */
export interface EvidenceRef {
  kind: EvidenceKind;
  title?: string;
  path?: string;
  sha256?: string;
  size?: number;
  mediaType?: string;
  url?: string;
}

export interface RevisionSource {
  repository: string;
  commit?: string;
  path?: string;
  dirty?: boolean;
}

/**
 * One immutable revision of one part (docs/library-protocol.md § 4). The
 * definition is typed loosely: a library carries it as published.
 */
export interface PartRevisionEnvelope {
  schema: string;
  uhdSchema: string;
  partId: string;
  revision: number;
  definition: ModuleDef | (Record<string, unknown> & { id: string; name: string; interfaces: unknown[] });
  definitionDigest: string;
  dependencies: PartRef[];
  artifacts: EnvelopeArtifact[];
  missingArtifacts: MissingArtifact[];
  evidence: EvidenceRef[];
  derivedFrom: PartRef | null;
  digest: string;
  /** Where the definition was authored; outside the digest. */
  source?: RevisionSource;
  /** Who published it; outside the digest. */
  publisher?: { name: string };
  /** When it was published; outside the digest. */
  createdAt: string;
}

/** `GET /parts/{id}/revisions/{n}/closure`. */
export interface Closure {
  root: PartRef;
  /** The root and every transitive dependency at its pinned revision; dependencies first. */
  revisions: PartRevisionEnvelope[];
  conflicts: { partId: string; revisions: number[] }[];
}

/** Every error response: `{ error: LibraryError }`. */
export interface LibraryError {
  code: string;
  message: string;
  [detail: string]: unknown;
}

export const ERROR_CODES = [
  "QUERY_INVALID",
  "CURSOR_INVALID",
  "REVISION_INVALID",
  "SHA256_INVALID",
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "PART_NOT_FOUND",
  "REVISION_NOT_FOUND",
  "BLOB_NOT_FOUND",
  "NOT_FOUND",
  "RATE_LIMITED",
  "INTERNAL",
] as const;
