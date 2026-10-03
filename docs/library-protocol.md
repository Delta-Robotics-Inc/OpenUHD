# UHD library protocol: `uhd-library/v1`

Status: draft 1, 2026-10-03. Types, the JSON Schema and a conformance kit:
`src/library/` (`@deltarobotics/uhd/library`), `schemas/uhd-library-v1.schema.json`.
Tests: `test/library-protocol.test.ts`.

A **UHD library** serves module definitions (parts) over HTTP as immutable,
content-addressed revisions. Any host can run one and any tool can read from
several. This document is the read protocol: how a client finds a library,
searches it, and downloads an exact revision with everything it depends on,
verifying every byte. How parts get into a library (publishing, review,
accounts) is the library's own business and is not specified here.

The key words MUST, SHOULD and MAY are used as in RFC 2119.

## 1. Model

- A **part** is a UHD `ModuleDef` that a library publishes under a **part id**
  (the definition's `id`): lower-case letters, digits, `.`, `_` and `-`,
  starting with a letter or digit, at most 128 characters
  (`^[a-z0-9][a-z0-9._-]{0,127}$`).
- A part has **revisions** numbered 1, 2, 3, … in order. A revision never
  changes once published. A newer revision is a deliberate update; a client
  never moves to one without being asked.
- A revision is served as a **revision envelope** (section 4): the
  definition, the exact revisions of the definitions it contains, every file
  that comes with it by content digest, and its lineage. The envelope is the
  data contract of this protocol.
- **Files** (CAD, images, evidence) are addressed by the SHA-256 of their
  bytes and served from one place (section 3.7).
- A revision or a whole part may be **deprecated**. It still downloads, so
  pinned consumers keep working; it leaves search unless asked for, and the
  **recommended revision** is the newest revision that is not deprecated.
- **Categories** are taxonomy paths: dotted strings such as
  `sensor.environmental`. This protocol treats them as opaque strings with
  one rule: a path matches itself and every path that starts with it followed
  by `.`. The taxonomy itself (its nodes, names and versions) is described in
  its own UHD document; a library names the taxonomy version it uses in its
  discovery document.

## 2. Finding a library

A library is configured by a **library URL**, for example
`https://parts.example.com` or `http://localhost:8787`. Its **API root** is
where the endpoints of section 3 live.

1. A client first requests `GET {library URL}/.well-known/uhd-library`.
2. If that is not found (404) or is not a discovery document, it requests
   `GET {library URL}/v1`.

Both return the **discovery document**. The API root is the document's `api`
member, a URL reference resolved against the URL the document was fetched
from (RFC 3986); when `api` is absent it is the URL the document came from.
A library MUST serve the discovery document at its API root. A library
served at the root of an origin SHOULD also serve it at
`/.well-known/uhd-library` (RFC 8615). The discovery document never needs
credentials.

```jsonc
{
  "protocol": "uhd-library/v1",              // required
  "name": "Acme parts",                      // required: for people
  "id": "acme",                              // optional: a short id clients may suggest for the library
  "description": "Purchased parts used by Acme projects",
  "version": "1.4.0",                        // required: the library implementation's version
  "api": "/v1",                              // optional: the API root (see above)
  "envelopeSchemas": ["uhd.part-revision/v1"],   // required: envelope `schema` values this library serves
  "uhdSchema": { "min": "0.2.0", "below": "0.3.0" },  // required: UHD versions the definitions are written against
  "taxonomy": { "version": "2.1.0", "namespaces": ["acme"] },  // or null when parts carry no taxonomy paths
  "capabilities": ["facets", "taxonomy", "definition"],
  "auth": { "read": "none" },                // or { "read": "bearer", "realm": "…", "documentation": "https://…" }
  "limits": { "defaultPageSize": 50, "maxPageSize": 200 }
}
```

- `envelopeSchemas` MUST contain `uhd.part-revision/v1`, unless every
  envelope the library serves uses another identifier under the migration
  rule of section 4.4.
- `taxonomy.version` is the version of the UHD taxonomy the library's paths
  come from; `taxonomy.namespaces` lists the root segments of nodes the
  library adds on its own, as the taxonomy document allows.
- `capabilities` lists optional features. Defined here: `facets` (search
  returns facet counts, section 3.2), `taxonomy` (search filters by taxonomy
  path), `definition` (section 3.5). Clients MUST ignore capabilities they do
  not know. Names a library adds on its own SHOULD start with `x-`.
- Members a client does not know MUST be ignored. A library MAY add members
  (a service may report counts, say).

## 3. Endpoints

All paths are relative to the API root. Responses are JSON
(`application/json`) unless stated. Part ids and revision numbers appear in
paths as they are; a client percent-encodes a part id when building a path.

| Method and path | Result |
| --- | --- |
| `GET /parts` | Search (3.2) |
| `GET /parts/{partId}` | Part detail (3.3) |
| `GET /parts/{partId}/revisions` | Revision list (3.3) |
| `GET /parts/{partId}/revisions/{revision}` | The revision envelope (3.4) |
| `GET /parts/{partId}/revisions/{revision}/definition` | The definition file, with capability `definition` (3.5) |
| `GET /parts/{partId}/revisions/{revision}/closure` | The dependency closure (3.6) |
| `GET`, `HEAD /blobs/{sha256}` | File bytes by address (3.7) |

### 3.1 Part summary

Search and part detail describe a part by its recommended revision (its latest
revision when every revision is deprecated):

```jsonc
{
  "partId": "acme-imu-6dof",
  "name": "Acme 6-DoF IMU",
  "description": "…",                     // optional
  "manufacturer": "Acme",                 // optional
  "partNumber": "AIMU-6",                 // optional (the definition's part_number)
  "categories": ["sensor.motion"],        // taxonomy paths, from the definition's categories
  "tags": ["imu"],                        // a library MAY include categories here too
  "protocols": ["i2c", "power"],          // protocol types of exposed interfaces
  "domains": ["electrical", "mechanical"],
  "latestRevision": 3,
  "recommendedRevision": 3,               // absent when every revision is deprecated
  "deprecated": { "reason": "…", "at": "2026-10-01T00:00:00Z", "replacedBy": { "partId": "…", "revision": 1 } },  // part-level, optional
  "thumbnail": { "sha256": "…", "size": 5120, "mediaType": "image/png" }   // optional, a blob
}
```

### 3.2 Search

`GET /parts?q=&taxonomy=&domain=&protocol=&tag=&includeDeprecated=&limit=&cursor=&facets=`

| Parameter | Meaning |
| --- | --- |
| `q` | Words. Every word MUST appear, case-insensitively, in at least one of: part id, name, description, manufacturer, part number, tags. A library MAY search more fields. |
| `taxonomy` | A taxonomy path: parts with a category equal to it or below it. Capability `taxonomy`. |
| `domain`, `protocol`, `tag` | Exact match against the summary's `domains`, `protocols`, `tags`. |
| `includeDeprecated` | `true` to include deprecated parts. Default `false`. |
| `limit` | Page size, 1 or more. Larger than `limits.maxPageSize` is reduced to it. Default `limits.defaultPageSize`. |
| `cursor` | The `nextCursor` of the previous page, unchanged. |
| `facets` | `true` to return facet counts. Capability `facets`. |

Filters combine with AND. Unknown parameters are ignored.

```jsonc
{
  "total": 37,                  // matching parts, across all pages
  "parts": [ /* PartSummary, at most `limit` */ ],
  "nextCursor": "eyJvIjo1MH0",  // null on the last page
  "facets": {                   // only with facets=true
    "taxonomy": { "sensor": 12, "sensor.motion": 5 },
    "domain": { "electrical": 30 },
    "protocol": { "i2c": 9 },
    "tag": { "imu": 4 }
  }
}
```

- **Order** is the library's choice but MUST be stable: following
  `nextCursor` from the first page to the last, while the library does not
  change, returns every matching part exactly once.
- A **cursor** is opaque to clients. A cursor the library cannot read is
  `400 CURSOR_INVALID`. A malformed `limit` or boolean is `400 QUERY_INVALID`.
- **Facets** count the parts matching the whole query (all pages, every
  filter applied). `taxonomy` counts each path and every ancestor of it, so
  `facets.taxonomy["sensor"]` is the number of matching parts filed anywhere
  under `sensor`; a part counts once per path even when several of its
  categories fall under it. A client drills a category tree one level at a
  time from these counts.

### 3.3 Part detail and revision list

`GET /parts/{partId}` returns `{ "part": PartSummary, "revisions": RevisionRow[] }`.
`GET /parts/{partId}/revisions` returns `{ "partId", "revisions": RevisionRow[] }`.
Revisions are in ascending order, from 1 to `latestRevision` without gaps.

```jsonc
{
  "partId": "acme-imu-6dof",
  "revision": 2,
  "digest": "sha256:…",             // the envelope digest (4.2)
  "definitionDigest": "sha256:…",
  "uhdSchema": "0.2.0",
  "createdAt": "2026-09-30T12:00:00Z",
  "publisher": "acme",              // optional
  "deprecated": { "reason": "…", "at": "…" }   // optional
}
```

Deprecated parts are found here whatever `includeDeprecated` says.

### 3.4 Exact revision

`GET /parts/{partId}/revisions/{revision}` returns the envelope (section 4)
as stored, byte for byte the same on every request. It MUST carry
`ETag: "<digest>"` (the envelope digest in quotes). A `revision` that is not
an integer of 1 or more is `400 REVISION_INVALID`.

### 3.5 Definition file (capability `definition`)

`GET /parts/{partId}/revisions/{revision}/definition` returns the definition
in its file form (4.2), so its SHA-256 is the envelope's `definitionDigest`,
with `ETag: "<definitionDigest>"`. Clients can also produce these bytes from
the envelope themselves; this endpoint saves the download of the rest.

### 3.6 Dependency closure

`GET /parts/{partId}/revisions/{revision}/closure`:

```jsonc
{
  "root": { "partId": "acme-gimbal", "revision": 2 },
  "revisions": [ /* envelopes: the root and every transitive dependency at its pinned revision, dependencies first */ ],
  "conflicts": [ { "partId": "acme-m2-screw", "revisions": [1, 3] } ]   // parts reached at more than one revision
}
```

Each revision appears once, every dependency appears before the revisions
that pin it, and nothing is listed that the root does not reach. A consumer
can hold one definition per id, so it MUST treat a non-empty `conflicts` as
something to resolve, not pick a revision silently. Clients recompute
`conflicts` from `revisions` rather than trusting it.

### 3.7 Files

`GET /blobs/{sha256}` returns the bytes whose SHA-256 is `sha256` (64
lower-case hex digits), as `application/octet-stream`, with
`ETag: "sha256:<sha256>"`. `HEAD` returns the same headers without a body.
A malformed address is `400 SHA256_INVALID`; an unknown one
`404 BLOB_NOT_FOUND`. A client MUST check the SHA-256 (and the size the
envelope states) of every file it downloads.

## 4. The revision envelope: `uhd.part-revision/v1`

The JSON Schema is `#/$defs/envelope` in `schemas/uhd-library-v1.schema.json`.

```jsonc
{
  "schema": "uhd.part-revision/v1",
  "uhdSchema": "0.2.0",                    // UHD version the definition is written against
  "partId": "acme-gimbal",                 // = definition.id
  "revision": 2,
  "definition": { /* the UHD ModuleDef, unchanged */ },
  "definitionDigest": "sha256:…",          // 4.2
  "dependencies": [{ "partId": "acme-m2-screw", "revision": 1 }],   // exactly the definition's children, once each
  "artifacts": [
    { "path": "parts/acme-gimbal/body.glb", "sha256": "…", "size": 287084,
      "mediaType": "model/gltf-binary", "role": "body", "artifactId": "cad_glb" }
  ],
  "missingArtifacts": [{ "path": "…", "artifactId": "…", "reason": "…" }],
  "evidence": [
    { "kind": "sources", "path": "parts/acme-gimbal/sources.json", "sha256": "…", "size": 4123, "mediaType": "application/json" },
    { "kind": "datasheet", "url": "https://…", "title": "…" }
  ],
  "derivedFrom": { "partId": "acme-gimbal", "revision": 1 },   // null only for a first revision made from scratch
  "digest": "sha256:…",                    // 4.2
  "source": { "repository": "…", "commit": "…", "path": "…", "dirty": false },   // optional, outside the digest
  "publisher": { "name": "acme" },         // optional, outside the digest
  "createdAt": "2026-09-30T12:00:00Z"      // outside the digest
}
```

### 4.1 Fields

- **`dependencies`** pins, for every distinct `moduleDefId` among the
  definition's children, one revision of that part. Nothing else is listed,
  nothing twice, never the part itself.
- **`artifacts`**: every file that comes with the revision. `path` is the
  definition's `filePath` as written, relative to the revision's **artifact
  base** (wherever the consumer puts the revision's files); paths are
  normalised (forward slashes, no empty, `.` or `..` segments, no leading
  slash) and unique across `artifacts` and `evidence`. `role` is one of
  `body`, `interface`, `source`, `drawing` (as `ArtifactDef.role`),
  `thumbnail`, `license`, `attachment` (anything else). `artifactId` names the
  `ArtifactDef` the file backs, when one does.
- **`missingArtifacts`**: every file the definition references (an
  `ArtifactDef.filePath` on the module or one of its harnesses) is either
  carried in `artifacts` or listed here with the reason, never silently
  absent.
- **`evidence`**: what the definition's facts rest on, each a carried file
  (`path`, `sha256`, `size`, `mediaType`) or an `http(s)` `url`. Kinds:
  `sources`, `verification`, `datasheet`, `document`, `other`.
- **`derivedFrom`**: the revision this one was made from (the previous
  revision of the same part for an update, another part's revision for a
  variant). Every revision after the first names one; a part's own revision
  it derives from is lower than this one.
- **`source`**, **`publisher`**, **`createdAt`** record the publish, not the
  content (4.2).

No other top-level members are allowed: an envelope with an unknown member is
invalid.

### 4.2 Digests

- **Canonical JSON**: object members sorted by key (UTF-16 code units) at
  every depth, members whose value is undefined dropped, no whitespace,
  numbers and strings as ECMAScript `JSON.stringify` writes them. For JSON
  without non-finite numbers this is RFC 8785 (JCS).
- **Definition file form**: the definition with members sorted the same way,
  indented by two spaces as `JSON.stringify(value, null, 2)` writes it, and a
  final line feed. A consumer that stores a definition stores these bytes.
- **`definitionDigest`** = `"sha256:"` + hex SHA-256 of the definition file
  form (UTF-8).
- **`digest`** = `"sha256:"` + hex SHA-256 of the canonical JSON of the
  envelope without `digest`, `source`, `publisher` and `createdAt`. It
  identifies the content: the same content published twice has the same
  digest, whoever published it and when.

A client MUST check both digests of every envelope it receives, check that it
is the part and revision it asked for, and, when it pinned a revision before,
that the digest is the one it pinned.

### 4.3 UHD version

`uhdSchema` is a version of the UHD schema (`@deltarobotics/uhd`), such as
`0.2.0`. Before UHD 1.0 a minor version may change the schema, so a client
states the range it reads and refuses envelopes outside it rather than
guessing.

### 4.4 Libraries older than this protocol

The envelope's `schema` member is inside its digest and revisions never
change, so a library that published revisions under another identifier before
adopting this protocol keeps serving them as they are. Such an envelope MUST
otherwise follow this section exactly (members, rules and digests), and the
library lists its identifier in `envelopeSchemas`. Clients accept an
envelope whose `schema` is `uhd.part-revision/v1` or one of the identifiers
the library's discovery document lists.

## 5. Errors

Every error response has a JSON body:

```json
{ "error": { "code": "PART_NOT_FOUND", "message": "no part acme-imu-9", "...": "details" } }
```

`code` is stable and meant for programs; `message` is for people. Further
members carry details. Codes defined here:

| Status | Code | When |
| --- | --- | --- |
| 400 | `QUERY_INVALID` | A malformed search parameter |
| 400 | `CURSOR_INVALID` | A cursor the library cannot read |
| 400 | `REVISION_INVALID` | A revision that is not an integer of 1 or more |
| 400 | `SHA256_INVALID` | A malformed blob address |
| 401 | `AUTH_REQUIRED` | Credentials missing or not accepted (with `WWW-Authenticate: Bearer`) |
| 403 | `FORBIDDEN` | Credentials accepted, access refused |
| 404 | `PART_NOT_FOUND` | No such part |
| 404 | `REVISION_NOT_FOUND` | The part exists, the revision does not |
| 404 | `BLOB_NOT_FOUND` | No such file |
| 404 | `NOT_FOUND` | Any other unknown path |
| 429 | `RATE_LIMITED` | Too many requests (`Retry-After` SHOULD be set) |
| 500 | `INTERNAL` | The library failed |

Clients MUST treat an unknown code by its HTTP status.

## 6. Caching and immutability

- An envelope, a definition file and a blob never change. Their responses
  SHOULD carry `Cache-Control: public, max-age=31536000, immutable`
  (`private` instead of `public` when reads need credentials) and MUST carry
  their `ETag`. A library MAY answer `If-None-Match` with `304`.
- A part's summary, its revision list, search results and the discovery
  document change (new revisions, deprecations). They MAY be cached briefly
  and SHOULD NOT be marked immutable.
- Deprecation never changes an envelope, so pinned consumers are never
  affected by it.
- Because every response that matters is verified by digest, a client MAY
  fetch files and envelopes from any cache or mirror that returns the same
  bytes.

## 7. Authentication

Reads are open unless the discovery document says
`"auth": { "read": "bearer" }`. Then every request except the discovery
document carries `Authorization: Bearer <token>`. How a token is obtained is
the library's business (`auth.documentation` may say where). Clients keep
tokens outside project data and outside anything they publish: in the
environment or the operating system's credential store. Envelopes, origin
records and configuration files never contain credentials.

## 8. Out of scope

- **Publishing**: how revisions are created, uploaded, reviewed and
  deprecated, and who may do it, is implementation-specific. Whatever the
  mechanism, what it produces is served as specified here.
- Accounts, organisations and access control beyond the bearer token.
- Commercial data (prices, stock, suppliers): not facts about a part, never
  in an envelope. A library may serve them on its own endpoints.
- The taxonomy itself: see the UHD taxonomy document.
- Signed envelopes and mirrors' trust: digests make content verifiable;
  establishing who published it is left to a later version.

## 9. Conformance

`runConformance(libraryUrl, options)` in `@deltarobotics/uhd/library` runs the
protocol's checks against a running library: discovery, the shapes of every
response against the JSON Schema, search filters, pagination with cursors,
facets, part detail and revision lists, envelope digests and `ETag`,
closures, blob addresses and HEAD, error shapes and codes, and bearer
authentication when the library asks for it. It reads only; it never
publishes. It reports each check as pass, fail, warn (a SHOULD not met) or
skip (an optional capability the library does not declare), and `ok` when
nothing failed.

```ts
import { runConformance } from "@deltarobotics/uhd/library";

const report = await runConformance("http://localhost:8787", { token: process.env.LIBRARY_TOKEN });
for (const c of report.checks) console.log(c.status, c.id, c.message ?? "");
```

A library's own test suite should run the kit against a test instance.
