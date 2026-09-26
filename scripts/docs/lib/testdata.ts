/**
 * Test data for documents: `<system>/docs/test-data/<test-id>.json`.
 *
 * One file per test id. `status` is "standin" (generated from the model by
 * a stand-in recipe, drawn with a STAND-IN watermark) or "measured" (real
 * results). The stand-in generator never overwrites a measured file, so
 * dropping a measured file in place of a stand-in swaps it into every
 * document on the next build. Schema: skills/uhd-tech-docs/templates/test-data.schema.json.
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

export interface TestColumn {
  id: string;
  label: string;
  unit: string;
}

export interface TestData {
  $schema?: string;
  id: string;
  title: string;
  status: "standin" | "measured";
  subject: { system: string; modules?: string[] };
  /** Test conditions, each with a unit ("" for none). */
  conditions: { name: string; value: number | string; unit: string }[];
  provenance: {
    method: string;
    /** Model queries the stand-in was derived from (values.ts syntax). */
    derivedFrom?: string[];
    assumptions?: string[];
    generator?: string;
    generatedAt?: string;
    /** Measured data: who, when, with what. */
    operator?: string;
    date?: string;
    instruments?: string[];
    rawFiles?: string[];
  };
  columns: TestColumn[];
  rows: (number | string)[][];
  summary: { id: string; label: string; value: number | string; unit: string }[];
  /** Repo-relative path, set when loaded. */
  file?: string;
}

export function validateTestData(t: any, file: string): string[] {
  const errs: string[] = [];
  const need = (cond: boolean, msg: string) => cond || errs.push(`${file}: ${msg}`);
  need(typeof t.id === "string" && t.id.length > 0, "id missing");
  need(file.endsWith(`${t.id}.json`), `id "${t.id}" does not match the file name`);
  need(t.status === "standin" || t.status === "measured", `status must be "standin" or "measured"`);
  need(typeof t.title === "string", "title missing");
  need(t.subject && typeof t.subject.system === "string", "subject.system missing");
  need(Array.isArray(t.conditions) && t.conditions.every((c: any) => c.name && "value" in c && typeof c.unit === "string"), "conditions[] need name, value, unit");
  need(t.provenance && typeof t.provenance.method === "string", "provenance.method missing");
  if (t.status === "measured") need(Boolean(t.provenance?.date && (t.provenance?.operator || t.provenance?.instruments?.length)), "measured data needs provenance.date and operator or instruments");
  need(Array.isArray(t.columns) && t.columns.every((c: any) => c.id && c.label && typeof c.unit === "string"), "columns[] need id, label, unit");
  need(Array.isArray(t.rows) && t.rows.every((r: any) => Array.isArray(r) && r.length === t.columns?.length), "every row needs one value per column");
  need(Array.isArray(t.summary) && t.summary.every((s: any) => s.id && "value" in s && typeof s.unit === "string"), "summary[] need id, value, unit");
  for (const r of t.rows ?? []) for (const v of r) if (typeof v === "number" && !Number.isFinite(v)) errs.push(`${file}: non-finite value in rows`);
  return errs;
}

export function loadTestData(absDir: string, repoDir: string): { tests: Map<string, TestData>; errors: string[] } {
  const dir = join(absDir, "docs", "test-data");
  const tests = new Map<string, TestData>();
  const errors: string[] = [];
  if (!existsSync(dir)) return { tests, errors };
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const t = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const errs = validateTestData(t, f);
    errors.push(...errs);
    if (!errs.length) tests.set(t.id, { ...t, file: `${repoDir}/docs/test-data/${f}` });
  }
  return { tests, errors };
}

/** Column values by id. */
export function column(t: TestData, id: string): number[] {
  const i = t.columns.findIndex((c) => c.id === id);
  if (i < 0) throw new Error(`${t.id}: no column ${id}`);
  return t.rows.map((r) => Number(r[i]));
}
