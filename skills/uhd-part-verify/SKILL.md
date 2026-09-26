---
name: uhd-part-verify
description: Verify a UHD library part — automated structural checks and pair DRC via scripts/verify-part.ts, then an independent evidence audit that re-checks facts against the cited sources. Loops with uhd-part-author (max 5 repairs) and writes an acceptance report. Use after authoring and before registering the part.
---

# UHD part verify

This is the quality gate between authoring and registration. It has two
stages: automated checks, then an evidence audit by an agent that did not
author the part.

## Stage 1: automated checks (the author runs these)

```bash
npx tsx scripts/verify-part.ts <id>                      # structure, vocabulary, sources
npx tsx scripts/verify-part.ts <id> --mate <other-id>    # plus pair DRC against a mating part
npx tsc --noEmit                                         # type-check
```

`verify-part.ts` checks:

- **Identity:** it imports cleanly, so `defineModule` passed (unique ids,
  profile bindings, groups). The exported `ModuleDef.id` equals the file name,
  and metadata is complete.
- **Citation:** the file header cites sources, `sources.json` exists and is
  well formed, and every artifact URL is listed in it.
- **Structure:** every interface has a domain, `snake_case` ids, and at least
  one protocol. Every slot sets `match.protocol`, and every composed interface
  has a profile.
- **Parameters:** units are present, each has a value or a range, and every
  range is ordered.
- **Vocabulary:** protocol types are known (from the builders and the existing
  library). An unknown type is a warning unless `.research/gaps.json` records
  it.
- **Traits:** part-specific trait types trigger a warning to use the
  canonical set. Assumption traits are counted in the report.
- **Hygiene:** the file contains no `TODO` or `TBD`.
- **Mates:** `--mate` runs `validatePair` and lists each connection with its
  state, sub-links, and unresolved slots.

Exit 0 means no errors. Warnings are listed and must be either fixed or
justified in the file's modelling notes.

## Stage 2: independent evidence audit

A fresh agent with no authoring context:

1. Reads `library/parts/<id>.ts` and `sources.json`.
2. Picks at least **12 facts**, always including the pinout or pad labels,
   supply range, current ratings, mounting pattern, dimensions or mass, and
   any protocol claims (UART numbers, I2C address, DShot support).
3. Re-fetches the cited source for each fact and records
   `{ fact, claimed, found, source, verdict: "confirmed" | "wrong" | "unsupported" }`.
4. Checks for **missing** interfaces: every pad in the source's pinout should
   exist as a leaf, or be explicitly omitted in the modelling notes.
5. Checks that every `assumption` trait really is unstated in the sources and
   is reasonable.

It writes `.research/audit.json` and returns the failures.

## Repair loop

On any error, wrong fact, or unsupported fact:

- send a structured list to `uhd-part-author` in repair mode, containing
  `{ errors[], wrongFacts[], unsupportedFacts[], missing[], preserve[] }`;
- append one line per iteration to `.research/repair-history.jsonl`;
- escalate after 5 iterations. Vocabulary gaps and genuine source conflicts
  are escalated immediately rather than looped.

## Acceptance

On pass, write `.research/acceptance.json`:

```json
{
  "partId": "<id>",
  "accepted": true,
  "iterations": 1,
  "automated": { "errors": 0, "warnings": 2 },
  "audit": { "checked": 14, "confirmed": 14, "wrong": 0, "unsupported": 0 },
  "mates": ["<other-id>: bldc_3phase valid"],
  "gaps": ["vocabulary: video link"],
  "checked_at": "ISO-8601"
}
```

Then report back with the gaps, and the part is ready to register.
