/**
 * Automated verification for one UHD library part (skills/uhd-part-verify).
 *
 *   npx tsx scripts/verify-part.ts <id> [--mate <other-id>]... [--json]
 *
 * Imports library/parts/<id>.ts (so defineModule runs), then checks metadata,
 * citations, structure, parameters, vocabulary, and hygiene. Each --mate runs
 * validatePair against another part and lists the resulting connections.
 * Exits 1 when any error is found.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

import type { InterfaceDef, ModuleDef } from "../src/types/index.js";
import { validatePair } from "../src/drc/index.js";
import { isConnector } from "../src/protocols/connector.js";
import * as library from "../library/parts/index.js";
import { checkCad } from "../library/cad/checks.js";
import { manifestLookup } from "../library/cad/manifests.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PARTS = join(ROOT, "library", "parts");

/** Protocol types emitted by src/protocols builders. */
const BUILDER_PROTOCOLS = [
  "digital", "pwm", "interrupt", "analog", "power", "i2c", "spi", "uart",
  "bldc_phase", "bldc_3phase", "dshot", "oneshot125", "oneshot42", "multishot",
  "pwm_esc", "fc_esc_connector", "connector", "crsf", "sbus", "bolt_pattern", "shaft", "custom",
];

/** Trait types new parts should use (skills/uhd-part-author). */
const CANONICAL_TRAITS = new Set([
  "pin_functions", "connector", "operating_conditions", "absolute_maximum",
  "performance", "assumption", "source_discrepancy", "data_gap", "usage_note",
  // PB-797: typed relations (src/types/trait.ts)
  "supplied_from", "handedness",
  // emitted by builders
  "phase_order", "esc_signal_protocols", "serial_rx_protocol", "bolt_pattern", "shaft",
]);

const ARTIFACT_TYPES = new Set([
  "datasheet", "schematic", "pcb", "3d_model", "firmware", "simulation",
  "documentation", "cad", "custom",
]);

interface Finding {
  level: "error" | "warning";
  check: string;
  message: string;
}

function knownProtocols(exclude: string): Set<string> {
  const known = new Set(BUILDER_PROTOCOLS);
  for (const def of Object.values(library) as ModuleDef[]) {
    if (def.id === exclude) continue;
    for (const iface of def.interfaces) for (const p of iface.protocols) known.add(p.type);
  }
  return known;
}

async function loadPart(id: string): Promise<ModuleDef> {
  const file = join(PARTS, `${id}.ts`);
  if (!existsSync(file)) throw new Error(`No part file at library/parts/${id}.ts`);
  const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
  const defs = Object.values(mod).filter(
    (v): v is ModuleDef => typeof v === "object" && v !== null && "interfaces" in v && "id" in v,
  );
  const def = defs.find((d) => d.id === id);
  if (!def) {
    throw new Error(
      `library/parts/${id}.ts exports no ModuleDef with id "${id}" (found: ${defs.map((d) => d.id).join(", ") || "none"})`,
    );
  }
  return def;
}

function readGaps(id: string): string[] {
  const file = join(PARTS, id, ".research", "gaps.json");
  if (!existsSync(file)) return [];
  try {
    const gaps = JSON.parse(readFileSync(file, "utf8")) as Array<Record<string, unknown>>;
    return gaps.map((g) => JSON.stringify(g));
  } catch {
    return [];
  }
}

function check(def: ModuleDef, id: string): Finding[] {
  const out: Finding[] = [];
  const err = (checkName: string, message: string) => out.push({ level: "error", check: checkName, message });
  const warn = (checkName: string, message: string) => out.push({ level: "warning", check: checkName, message });

  // Identity / metadata
  for (const field of ["name", "version", "manufacturer", "part_number", "description"] as const) {
    if (!def[field]) err("metadata", `missing ${field}`);
  }
  if (!def.tags?.length && !def.categories?.length) warn("metadata", "no tags or categories");

  // Citation
  const source = readFileSync(join(PARTS, `${id}.ts`), "utf8");
  const header = source.slice(0, source.indexOf("*/") + 2);
  if (!/https?:\/\//.test(header) && !/sources\.json/.test(header)) {
    err("citation", "file header cites no sources");
  }
  if (/\b(TODO|TBD|FIXME)\b/.test(source)) err("hygiene", "file contains TODO/TBD/FIXME");

  const sourcesFile = join(PARTS, id, "sources.json");
  let sourceUrls = new Set<string>();
  let sourceRows: Array<Record<string, unknown>> = [];
  if (!existsSync(sourcesFile)) {
    err("citation", `missing library/parts/${id}/sources.json`);
  } else {
    try {
      const rows = JSON.parse(readFileSync(sourcesFile, "utf8")) as Array<Record<string, unknown>>;
      if (!Array.isArray(rows) || rows.length === 0) err("citation", "sources.json is empty");
      rows.forEach((row, i) => {
        for (const field of ["id", "title", "url", "type", "authority", "supports"]) {
          if (row[field] === undefined) err("citation", `sources.json[${i}] missing ${field}`);
        }
        if (typeof row.type === "string" && !ARTIFACT_TYPES.has(row.type)) {
          err("citation", `sources.json[${i}] type "${row.type}" is not an ArtifactType`);
        }
      });
      const standardPart = def.tags?.includes("standard-part");
      if (!rows.some((r) => r.authority === "manufacturer")) {
        // standard parts (ISO/DIN fasteners) are defined by the standard; a supplier drawing suffices
        (standardPart ? warn : err)("citation", "no manufacturer-authority source in sources.json" + (standardPart ? " (standard part: supplier drawing of the cited standard accepted)" : ""));
      }
      sourceUrls = new Set(rows.map((r) => String(r.url)));
      sourceRows = rows;
    } catch (e) {
      err("citation", `sources.json is not valid JSON: ${(e as Error).message}`);
    }
  }
  if (!def.artifacts?.length) err("citation", "no artifacts[] on the module");
  for (const artifact of def.artifacts ?? []) {
    if (artifact.url && !sourceUrls.has(artifact.url)) {
      warn("citation", `artifact ${artifact.id} url is not listed in sources.json`);
    }
  }

  // Structure
  const byId = new Map(def.interfaces.map((i) => [i.id, i]));
  const known = knownProtocols(id);
  const gaps = readGaps(id).join("\n");
  const traitTypes = new Set<string>();
  const collectTraits = (traits?: { type: string }[]) => traits?.forEach((t) => traitTypes.add(t.type));
  collectTraits(def.traits);

  for (const iface of def.interfaces) {
    const where = `interface ${iface.id}`;
    if (!/^[a-z0-9]+(_[a-z0-9]+)*$/.test(iface.id)) warn("structure", `${where}: id is not snake_case`);
    if (!iface.domain) err("structure", `${where}: missing domain`);
    if (!iface.protocols?.length) err("structure", `${where}: no protocols`);
    for (const p of iface.protocols ?? []) {
      if (!p.roles?.length) err("structure", `${where}: protocol ${p.type} has no roles`);
      if (!known.has(p.type)) {
        (gaps.includes(p.type) ? warn : err)(
          "vocabulary",
          `${where}: protocol type "${p.type}" is not in the vocabulary${gaps.includes(p.type) ? " (recorded in gaps.json)" : " — record it in .research/gaps.json or use an existing type"}`,
        );
      }
    }
    if (isConnector(iface)) {
      // PB-805: positions mate by position, so slots carry no protocol match
      const params = iface.traits?.find((t) => t.type === "connector")?.params as { positions?: number } | undefined;
      if (!params) err("connectors", `${where}: connector composite has no connector trait`);
      if (params?.positions !== undefined && params.positions !== iface.slots?.length) {
        err("connectors", `${where}: connector trait says ${params.positions} positions but it has ${iface.slots?.length ?? 0} slots`);
      }
      for (const [slot, leaf] of Object.entries(iface.profiles?.[0]?.bindings ?? {})) {
        for (const id of Array.isArray(leaf) ? leaf : [leaf]) {
          if (!byId.has(id)) err("connectors", `${where}: position ${slot} binds unknown interface ${id}`);
          else if (isConnector(byId.get(id)!)) err("connectors", `${where}: position ${slot} binds another connector (${id})`);
        }
      }
    } else if (iface.slots?.length) {
      if (!iface.profiles?.length) err("structure", `${where}: composed interface has slots but no profile`);
      for (const slot of iface.slots) {
        if (!slot.match.protocol) {
          warn("structure", `${where}: slot ${slot.id} has no match.protocol, so it will not pair in DRC`);
        }
      }
    }
    for (const param of iface.parameters ?? []) {
      if (!param.unit) err("parameters", `${where}: parameter ${param.id} has no unit`);
      if (param.value === undefined && param.range === undefined) {
        err("parameters", `${where}: parameter ${param.id} has neither value nor range`);
      }
      if (param.range && param.range[0] > param.range[1]) {
        err("parameters", `${where}: parameter ${param.id} range is reversed`);
      }
    }
    for (const target of iface.bridgesTo ?? []) {
      if (!byId.has(target)) err("structure", `${where}: bridgesTo unknown interface ${target}`);
    }
    if (!isConnector(iface)) {
      for (const t of iface.traits ?? []) {
        const c = t.params as { connector_type?: string; positions?: number } | undefined;
        if (t.type === "connector" && (c?.positions ?? 0) > 1 && iface.pin !== undefined) {
          warn("connectors", `${where}: carries a ${c?.positions}-position ${c?.connector_type} trait; declare the connector as a Connector() composite and keep only the pad's own trait here (docs/connectors-and-harnesses.md)`);
        }
      }
    }
    collectTraits(iface.traits);
  }

  if (!def.interfaces.some((i) => i.exposed)) err("structure", "no exposed interfaces");

  const nonCanonical = [...traitTypes].filter((t) => !CANONICAL_TRAITS.has(t));
  if (nonCanonical.length) {
    warn("traits", `non-canonical trait types: ${nonCanonical.join(", ")} (see skills/uhd-part-author)`);
  }

  const domains = new Set(def.interfaces.map((i: InterfaceDef) => i.domain));
  if (!(def.domains ?? []).some((d) => d.domain === "thermal") && !traitTypes.has("operating_conditions")) {
    warn("coverage", "no thermal domain or operating_conditions trait — confirm the sources give no operating temperature");
  }
  if (!domains.has("mechanical")) warn("coverage", "no mechanical interfaces (mounting, shaft) — confirm this is intended");

  // CAD (PB-796): a body, bindings, frames, frame plausibility, vendor licence
  for (const issue of checkCad(def, manifestLookup(def))) {
    (issue.severity === "error" ? err : warn)("cad", `${issue.interfaceId ? `interface ${issue.interfaceId}: ` : ""}${issue.message}`);
  }
  const vendorCad = (def.artifacts ?? []).filter((a) => a.type === "3d_model" && a.role === "source" && a.url);
  for (const a of vendorCad) {
    const row = sourceRows.find((r) => r.url === a.url);
    if (!row) err("cad", `vendor CAD ${a.id} (${a.url}) is not in sources.json`);
    else {
      if (row.type !== "cad") err("cad", `sources.json row for ${a.url} should have type "cad"`);
      if (!row.sha256) err("cad", `sources.json row for ${a.url} has no sha256`);
      if (!row.licence) err("cad", `sources.json row for ${a.url} records no licence/terms ("licence")`);
    }
  }
  const hasBody = (def.artifacts ?? []).some((a) => a.role === "body");
  const cadGap = (def.traits ?? []).some((t) => t.type === "data_gap" && /manufacturer CAD/i.test(JSON.stringify(t.params ?? {})));
  if (hasBody && !vendorCad.length && !cadGap) {
    warn("cad", 'generated geometry without a data_gap trait for "manufacturer CAD" (say where you looked)');
  }

  return out;
}

function summarizeMate(def: ModuleDef, mate: ModuleDef): string[] {
  const result = validatePair(def, mate);
  const lines = [`mate ${mate.id}: verdict ${result.verdict.state}, ${result.connections.length} connection(s)`];
  for (const c of result.connections) {
    const unresolved = c.unresolvedSlots.map((u) => `${u.moduleId}:${u.slotId}`).join(", ");
    lines.push(
      `  ${c.protocol.padEnd(18)} ${c.state.padEnd(22)} ${c.subLinks.length} sub-link(s)` +
        (unresolved ? `  unresolved: ${unresolved}` : "") +
        (c.diagnostics.length ? `  diagnostics: ${c.diagnostics.map((d) => d.message).join("; ")}` : ""),
    );
  }
  return lines;
}

async function main() {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--mate");
  if (!id) {
    console.error("usage: npx tsx scripts/verify-part.ts <id> [--mate <other-id>]... [--json]");
    process.exit(2);
  }
  const mates = args.flatMap((a, i) => (a === "--mate" && args[i + 1] ? [args[i + 1]] : []));

  let def: ModuleDef;
  try {
    def = await loadPart(id);
  } catch (e) {
    console.error(`error [load] ${(e as Error).message}`);
    process.exit(1);
  }

  const findings = check(def, id);
  const mateLines: string[] = [];
  for (const mateId of mates) {
    try {
      mateLines.push(...summarizeMate(def, await loadPart(mateId)));
    } catch (e) {
      findings.push({ level: "error", check: "mate", message: (e as Error).message });
    }
  }

  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warning");
  const assumptions = [def, ...def.interfaces].flatMap((x) => x.traits ?? []).filter((t) => t.type === "assumption");

  if (args.includes("--json")) {
    console.log(JSON.stringify({ partId: id, errors, warnings, assumptions: assumptions.length, mates: mateLines }, null, 2));
  } else {
    console.log(`${id}: ${def.interfaces.length} interfaces, ${assumptions.length} assumption(s)`);
    for (const f of findings) console.log(`${f.level.padEnd(7)} [${f.check}] ${f.message}`);
    for (const line of mateLines) console.log(line);
    console.log(errors.length ? `FAIL: ${errors.length} error(s), ${warnings.length} warning(s)` : `PASS: 0 errors, ${warnings.length} warning(s)`);
  }
  process.exit(errors.length ? 1 : 0);
}

main();
