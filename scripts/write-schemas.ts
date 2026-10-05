/**
 * Write the published JSON Schemas from their TypeScript source:
 * `schemas/uhd-library-v1.schema.json` from `src/library/schema.ts`.
 * test/library-protocol.test.ts fails when the file is out of date.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LIBRARY_SCHEMA } from "../src/library/schema.js";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "schemas", "uhd-library-v1.schema.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(LIBRARY_SCHEMA, null, 2) + "\n");
console.log(`wrote ${out}`);
