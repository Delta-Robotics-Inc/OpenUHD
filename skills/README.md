# skills/

Agent skills shipped with UHD. UHD keeps one: a reference for writing UHD
definitions. Workflows that run tools or keep a part library (part research,
authoring and verification, technical documents) are not part of UHD; tools
built on UHD provide them and can point their agents at this reference.

| Skill | What |
| --- | --- |
| [`uhd-authoring`](uhd-authoring/SKILL.md) | How to express hardware facts as a `ModuleDef` with the `@deltarobotics/uhd` builders: leaves with pin designators, pin tables, composed buses and connectors, canonical parameters and traits, domains and package facts, and geometry frames and refs. References: [vocabulary](uhd-authoring/references/vocabulary.md) (builders, protocol types, canonical parameter ids) and [mapping rules](uhd-authoring/references/mapping-rules.md) (evidence → UHD). |

A skill is a folder with a `SKILL.md` (front matter `name` and
`description`, then the instructions) and optional `references/`. They work
in any agent harness that reads Markdown; nothing in them runs a tool.

## Principles

- **Every value traces to a source.** A value no source states is either
  omitted or marked with an `assumption` trait that says why.
- **Variant lock.** Keep the exact product, revision, and variant end to end.
  Never merge variants.
- **Pin table first.** Model the pinout and pad labels before anything else.
- **No inferred capabilities.** Don't claim a pin can do something the
  source doesn't say.
- **Check every domain.** Electrical, mechanical, thermal, network, and the
  fluid domains are each considered, and a domain is only omitted with a
  reason.
- **Vocabulary is not invented silently.** A missing protocol type or role is
  `custom` plus a trait until UHD's vocabulary gains it.
- **Tool knowledge stays out.** Footprints, land patterns, symbols, layer
  stacks, CAD feature trees and anything named after a tool belong to that
  tool.
