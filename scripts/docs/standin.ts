/**
 * Generate stand-in test data for a system from its model:
 *
 *   npx tsx scripts/docs/standin.ts library/systems/quadcopter-5in [--force]
 *
 * Writes <system>/docs/test-data/<test-id>.json with status "standin".
 * A file whose status is "measured" is never touched. Without --force,
 * existing stand-ins are refreshed (they are derived data, so regenerating
 * them from the current model is always safe).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { buildContext } from "./lib/context.js";
import type { TestData } from "./lib/testdata.js";

export async function writeStandins(systemDir: string): Promise<{ written: string[]; kept: string[] }> {
  const ctx = await buildContext(systemDir);
  const recipe = ctx.sys.config.testData?.standins;
  if (!recipe) return { written: [], kept: [] };
  const mod = await import(new URL(`./lib/standins/${recipe}.ts`, import.meta.url).href);
  const sets: TestData[] = mod.standins(ctx);
  const dir = join(ctx.sys.absDir, "docs", "test-data");
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  const kept: string[] = [];
  for (const t of sets) {
    const file = join(dir, `${t.id}.json`);
    if (existsSync(file)) {
      const cur = JSON.parse(readFileSync(file, "utf8"));
      if (cur.status === "measured") {
        kept.push(t.id);
        continue;
      }
    }
    writeFileSync(file, JSON.stringify(t, null, 2) + "\n");
    written.push(t.id);
  }
  return { written, kept };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2];
  if (!dir) throw new Error("usage: npx tsx scripts/docs/standin.ts <system-dir>");
  const r = await writeStandins(dir);
  console.log(`stand-ins written: ${r.written.join(", ") || "none"}; measured kept: ${r.kept.join(", ") || "none"}`);
}
