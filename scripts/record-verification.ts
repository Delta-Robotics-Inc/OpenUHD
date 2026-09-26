/**
 * Write the committed verification summary for a part from its working
 * notes (skills/uhd-part-verify): library/parts/<id>/verification.json.
 *
 *   npx tsx scripts/record-verification.ts <id> [--repairs "<text>"]
 *
 * .research/ is gitignored working memory; this summary is the part's
 * committed evidence record (audit counts, assumptions, open data gaps).
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import type { ModuleDef } from "../src/types/index.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

async function main() {
  const [id] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const repairsIdx = process.argv.indexOf("--repairs");
  const repairs = repairsIdx > 0 ? process.argv[repairsIdx + 1] : undefined;
  if (!id) throw new Error("usage: record-verification.ts <id>");
  const dir = join(ROOT, "library", "parts", id);
  const research = join(dir, ".research");
  const read = (f: string) => (existsSync(join(research, f)) ? JSON.parse(readFileSync(join(research, f), "utf8")) : undefined);

  const audit = read("audit.json");
  const gaps = (read("gaps.json") ?? []) as Array<Record<string, unknown>>;
  const facts = (audit?.facts ?? audit?.checks ?? audit?.results ?? []) as Array<{ verdict?: string }>;
  const count = (v: string) => facts.filter((f) => String(f.verdict ?? "").toLowerCase() === v).length;
  const summary = audit?.summary ?? audit?.counts ?? {};

  const mod = (await import(pathToFileURL(join(ROOT, "library", "parts", `${id}.ts`)).href)) as Record<string, unknown>;
  const def = Object.values(mod).find((v): v is ModuleDef => typeof v === "object" && v !== null && (v as ModuleDef).id === id);
  const traits = def ? [def, ...def.interfaces].flatMap((x) => x.traits ?? []) : [];

  // gap files use several shapes ({field}, {item, reason}, {note}); record a readable line, never raw JSON
  const describeGap = (g: Record<string, unknown>) => {
    const what = g.field ?? g.item ?? g.term ?? g.description ?? g.note;
    if (what === undefined) return JSON.stringify(g);
    return g.reason && g.reason !== what ? `${what} (${g.reason})` : String(what);
  };
  const record = {
    partId: id,
    recorded_at: new Date().toISOString(),
    audit: audit
      ? {
          method: "independent agent re-fetched cited sources (skills/uhd-part-verify stage 2)",
          checked: summary.checked ?? facts.length,
          confirmed: summary.confirmed ?? count("confirmed"),
          wrong: summary.wrong ?? count("wrong"),
          unsupported: summary.unsupported ?? count("unsupported"),
        }
      : null,
    repairs: repairs ?? null,
    assumptions: traits
      .filter((t) => t.type === "assumption")
      .map((t) => (t.params as Record<string, unknown>)?.field ?? (t.params as Record<string, unknown>)?.note ?? "assumption"),
    data_gaps: gaps
      .filter((g) => g.type === "data")
      .map((g) => describeGap(g)),
    vocabulary_gaps: gaps
      .filter((g) => g.type === "vocabulary")
      .map((g) => g.term ?? g.note ?? g.description ?? JSON.stringify(g)),
  };
  writeFileSync(join(dir, "verification.json"), JSON.stringify(record, null, 2) + "\n");
  console.log(`${id}: audit ${record.audit ? `${record.audit.confirmed}/${record.audit.checked}` : "none"}, ${record.assumptions.length} assumption(s), ${record.data_gaps.length} data gap(s)`);
}

main();
