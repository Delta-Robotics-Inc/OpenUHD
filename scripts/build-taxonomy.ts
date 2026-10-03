/**
 * Writes src/taxonomy/uhd-taxonomy.data.ts from src/taxonomy/uhd-taxonomy.json.
 *
 * The JSON file is the taxonomy; the TypeScript copy lets the package load it
 * without JSON-module support in every consumer (browsers, bundlers, tsc
 * settings). test/taxonomy.test.ts fails when the two differ.
 *
 * Run: npm run build:taxonomy   (npx tsx scripts/build-taxonomy.ts)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const json = fileURLToPath(new URL("../src/taxonomy/uhd-taxonomy.json", import.meta.url));
const out = fileURLToPath(new URL("../src/taxonomy/uhd-taxonomy.data.ts", import.meta.url));

export function renderTaxonomyData(text: string): string {
  const data = JSON.parse(text);
  return (
    "// Generated from uhd-taxonomy.json by scripts/build-taxonomy.ts (npm run build:taxonomy). Do not edit.\n" +
    `export const UHD_TAXONOMY_DATA: unknown = ${JSON.stringify(data, null, 2)};\n`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(out, renderTaxonomyData(readFileSync(json, "utf8")));
  console.log(`wrote ${out}`);
}
