# skills/ — UHD part pipeline

Agent skills for adding a purchased part to the UHD library
(`library/parts/`) as a datasheet-honest `ModuleDef`. Adapted from the
ProtoPart pipeline (`Delta-Robotics-Inc/ProtoPart/skills`) for UHD: the output
is a TypeScript `ModuleDef` built with `src/protocols` builders instead of a
ProtoPart `definition.json`, and there is no Firestore/deploy or affiliate
step. They work in any agent harness that has a shell, web search, and web
fetch.

## Pipeline

```
brief → research → author ↻ verify → audit → register
                      (repair loop, max 5)
```

| Skill | When | Reads | Writes |
| --- | --- | --- | --- |
| [`uhd-part-research`](uhd-part-research/SKILL.md) | After a brief names the part | brief | `library/parts/<id>/sources.json`, `.research/` notes |
| [`uhd-part-author`](uhd-part-author/SKILL.md) | After research | research notes, vocabulary | `library/parts/<id>.ts` |
| [`uhd-part-verify`](uhd-part-verify/SKILL.md) | After authoring; loops with author | part file, sources | `.research/acceptance.json`, `.research/gaps.json` |

**Register** (done by whoever integrates, not the per-part agent): export the
part from `library/parts/index.ts`, run `npm test`, `npm run type-check`, and
`npm run build:library`.

## Files per part

| Path | Committed | Contents |
| --- | --- | --- |
| `library/parts/<id>.ts` | yes | The `ModuleDef`, with a citation header. |
| `library/parts/<id>/sources.json` | yes | Every source used: URL, type, what it supported, fetch time, sha256 of downloaded bytes. |
| `library/parts/<id>/verification.json` | yes | Committed evidence record: audit counts, repairs, assumptions, open data and vocabulary gaps (`npx tsx scripts/record-verification.ts <id>`). |
| `library/parts/<id>/artifacts/thumbnail.png` | optional | Product thumbnail, if its licence allows redistribution. |
| `library/parts/<id>/.research/` | no (gitignored) | Downloads, extracted notes, gaps, acceptance report. Working memory. |

Datasheet PDFs are **not** committed (redistribution rights vary). The part
links them through `artifacts[].url`, and `sources.json` records the sha256
of the bytes that were read, so a later reader can tell if the document
changed.

## Principles carried over from ProtoPart

- **Every value traces to a source.** A value no source states is either
  omitted or marked with an `assumption` trait that says why.
- **Variant lock.** Keep the exact product, revision, and variant (KV, cell
  count, V2 vs V3) end to end. Never merge variants.
- **Pin table first.** Extract pinouts and pad labels before anything else.
- **No inferred capabilities.** Don't claim a pin can do something the
  source doesn't say.
- **Check every domain.** Electrical, mechanical, thermal, network, and the
  fluid domains are each considered, and a domain is only omitted with a
  reason.
- **Vocabulary is not invented silently.** New protocol types or roles go to
  `gaps.json` and are escalated, not quietly added to a part.
- **State lives on disk,** so work survives context compaction.

## Differences from ProtoPart

- The output is a TypeScript `ModuleDef` that `defineModule` validates when
  the file is imported. It is not JSON schema validated.
- The protocol vocabulary is whatever the `src/protocols` builders emit, plus
  what the existing library uses (see
  [vocabulary](uhd-part-author/references/vocabulary.md)).
- Purchase and pricing data is out of scope: supplier offers are kept separate
  from technical facts (architecture decision). Vendor pages may still be
  sources for technical facts.
- Verification runs `scripts/verify-part.ts` for the structural checks and
  pair DRC against mating parts, then an **independent evidence audit** by a
  fresh agent that re-checks facts against the sources.
