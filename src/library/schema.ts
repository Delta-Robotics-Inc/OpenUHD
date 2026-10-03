/**
 * The JSON Schema of `uhd-library/v1` (docs/library-protocol.md): every
 * response body and the revision envelope, under `$defs`. Published as
 * `schemas/uhd-library-v1.schema.json` (written from this constant by
 * `npm run build:schemas`; a test keeps the two equal).
 *
 * Only the keywords `validateShape` (json-schema.ts) implements are used, so
 * the conformance kit checks responses against this very schema.
 */
import { ARTIFACT_ROLES, DISTRIBUTION_CLASSES, ENVELOPE_SCHEMA, ERROR_CODES, EVIDENCE_KINDS, LIBRARY_PROTOCOL } from "./types.js";

const str = { type: "string" } as const;
const nonEmpty = { type: "string", minLength: 1 } as const;
const count = { type: "integer", minimum: 0 } as const;
const revision = { type: "integer", minimum: 1 } as const;
const sha256 = { type: "string", pattern: "^[0-9a-f]{64}$" } as const;
const digest = { type: "string", pattern: "^sha256:[0-9a-f]{64}$" } as const;
const semver = { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.-]+)?$" } as const;
const partId = { type: "string", pattern: "^[a-z0-9][a-z0-9._-]{0,127}$" } as const;
const strings = { type: "array", items: str } as const;
const counts = { type: "object", additionalProperties: count } as const;
const url = { type: "string", pattern: "^https?://" } as const;
const ref = (name: string) => ({ $ref: `#/$defs/${name}` });

export const LIBRARY_SCHEMA_ID = "https://raw.githubusercontent.com/Delta-Robotics-Inc/uhd/main/schemas/uhd-library-v1.schema.json";

export const LIBRARY_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: LIBRARY_SCHEMA_ID,
  title: "UHD library protocol uhd-library/v1",
  description: "Response bodies of the UHD library protocol and the revision envelope uhd.part-revision/v1 (docs/library-protocol.md).",
  $defs: {
    discovery: {
      type: "object",
      required: ["protocol", "name", "version", "envelopeSchemas", "uhdSchema", "taxonomy", "capabilities", "auth"],
      properties: {
        protocol: { const: LIBRARY_PROTOCOL },
        name: nonEmpty,
        id: partId,
        description: str,
        version: nonEmpty,
        api: nonEmpty,
        envelopeSchemas: { type: "array", items: nonEmpty, minItems: 1 },
        uhdSchema: ref("uhdSchemaRange"),
        taxonomy: {
          anyOf: [
            { type: "null" },
            { type: "object", required: ["version"], properties: { version: nonEmpty, namespaces: strings } },
          ],
        },
        capabilities: strings,
        auth: {
          type: "object",
          required: ["read"],
          properties: { read: { enum: ["none", "bearer"] }, realm: str, documentation: str },
        },
        limits: {
          type: "object",
          properties: { defaultPageSize: { type: "integer", minimum: 1 }, maxPageSize: { type: "integer", minimum: 1 } },
        },
      },
    },
    uhdSchemaRange: {
      type: "object",
      required: ["min", "below"],
      properties: { min: semver, below: semver },
      additionalProperties: false,
    },
    partRef: {
      type: "object",
      required: ["partId", "revision"],
      properties: { partId, revision },
      additionalProperties: false,
    },
    deprecation: {
      type: "object",
      required: ["reason", "at"],
      properties: { reason: str, at: nonEmpty, replacedBy: ref("partRef") },
    },
    blobRef: {
      type: "object",
      required: ["sha256", "size", "mediaType"],
      properties: { sha256, size: count, mediaType: nonEmpty },
    },
    partSummary: {
      type: "object",
      required: ["partId", "name", "categories", "tags", "protocols", "domains", "latestRevision"],
      properties: {
        partId,
        name: str,
        description: str,
        manufacturer: str,
        partNumber: str,
        categories: strings,
        tags: strings,
        protocols: strings,
        domains: strings,
        latestRevision: revision,
        recommendedRevision: revision,
        deprecated: ref("deprecation"),
        thumbnail: ref("blobRef"),
      },
    },
    searchResponse: {
      type: "object",
      required: ["total", "parts", "nextCursor"],
      properties: {
        total: count,
        parts: { type: "array", items: ref("partSummary") },
        nextCursor: { type: ["string", "null"] },
        facets: {
          type: "object",
          required: ["taxonomy", "domain", "protocol", "tag"],
          properties: { taxonomy: counts, domain: counts, protocol: counts, tag: counts },
        },
      },
    },
    revisionRow: {
      type: "object",
      required: ["partId", "revision", "digest", "definitionDigest", "uhdSchema", "createdAt"],
      properties: {
        partId,
        revision,
        digest,
        definitionDigest: digest,
        uhdSchema: semver,
        createdAt: nonEmpty,
        publisher: str,
        deprecated: ref("deprecation"),
      },
    },
    partDetail: {
      type: "object",
      required: ["part", "revisions"],
      properties: { part: ref("partSummary"), revisions: { type: "array", items: ref("revisionRow"), minItems: 1 } },
    },
    revisionList: {
      type: "object",
      required: ["partId", "revisions"],
      properties: { partId, revisions: { type: "array", items: ref("revisionRow"), minItems: 1 } },
    },
    moduleDef: {
      description: "A UHD ModuleDef; the envelope checks only what the protocol reads.",
      type: "object",
      required: ["id", "name", "interfaces"],
      properties: {
        id: str,
        name: str,
        interfaces: { type: "array", items: { type: "object", required: ["id", "domain"], properties: { id: str, domain: str } } },
        categories: strings,
        tags: strings,
        children: { type: "array", items: { type: "object", required: ["moduleDefId"], properties: { moduleDefId: str } } },
        artifacts: { type: "array", items: { type: "object", required: ["id"], properties: { id: str, filePath: str } } },
      },
    },
    fileTerms: {
      type: "object",
      required: ["distribution"],
      properties: {
        distribution: { enum: [...DISTRIBUTION_CLASSES] },
        license: nonEmpty,
        licenseUrl: url,
        licensePath: nonEmpty,
        attribution: str,
        summary: str,
        sourceUrl: url,
        sourceSha256: sha256,
        retrieved: nonEmpty,
      },
      additionalProperties: false,
    },
    envelopeArtifact: {
      type: "object",
      required: ["path", "sha256", "size", "mediaType", "role"],
      properties: { path: nonEmpty, sha256, size: count, mediaType: nonEmpty, role: { enum: [...ARTIFACT_ROLES] }, artifactId: str, terms: ref("fileTerms") },
      additionalProperties: false,
    },
    missingArtifact: {
      type: "object",
      required: ["path", "artifactId", "reason"],
      properties: { path: nonEmpty, artifactId: str, reason: nonEmpty },
      additionalProperties: false,
    },
    evidenceRef: {
      type: "object",
      required: ["kind"],
      properties: { kind: { enum: [...EVIDENCE_KINDS] }, title: str, path: nonEmpty, sha256, size: count, mediaType: nonEmpty, url, terms: ref("fileTerms") },
      additionalProperties: false,
    },
    revisionSource: {
      type: "object",
      required: ["repository"],
      properties: { repository: str, commit: str, path: str, dirty: { type: "boolean" } },
      additionalProperties: false,
    },
    envelope: {
      description: `The revision envelope. The standard schema identifier is ${ENVELOPE_SCHEMA}; a library may serve envelopes published before it adopted the protocol under the identifiers its discovery document lists.`,
      type: "object",
      required: ["schema", "uhdSchema", "partId", "revision", "definition", "definitionDigest", "dependencies", "artifacts", "missingArtifacts", "evidence", "derivedFrom", "digest", "createdAt"],
      properties: {
        schema: nonEmpty,
        uhdSchema: semver,
        partId,
        revision,
        definition: ref("moduleDef"),
        definitionDigest: digest,
        dependencies: { type: "array", items: ref("partRef") },
        artifacts: { type: "array", items: ref("envelopeArtifact") },
        missingArtifacts: { type: "array", items: ref("missingArtifact") },
        evidence: { type: "array", items: ref("evidenceRef") },
        derivedFrom: { anyOf: [{ type: "null" }, ref("partRef")] },
        digest,
        source: ref("revisionSource"),
        publisher: { type: "object", required: ["name"], properties: { name: str } },
        createdAt: nonEmpty,
      },
      additionalProperties: false,
    },
    closure: {
      type: "object",
      required: ["root", "revisions", "conflicts"],
      properties: {
        root: ref("partRef"),
        revisions: { type: "array", items: ref("envelope"), minItems: 1 },
        conflicts: {
          type: "array",
          items: { type: "object", required: ["partId", "revisions"], properties: { partId, revisions: { type: "array", items: revision } } },
        },
      },
    },
    error: {
      type: "object",
      required: ["error"],
      properties: {
        error: {
          type: "object",
          required: ["code", "message"],
          properties: { code: { type: "string", pattern: "^[A-Z][A-Z0-9_]*$" }, message: str },
        },
      },
    },
  },
  /** Codes defined by the protocol, for reference; libraries may add their own. */
  "x-error-codes": [...ERROR_CODES],
} as const;

export type LibrarySchemaDef = keyof typeof LIBRARY_SCHEMA.$defs;
