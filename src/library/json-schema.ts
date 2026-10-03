/**
 * A small JSON Schema checker for the keywords the library schema uses:
 * `type`, `const`, `enum`, `properties`, `required`, `additionalProperties`,
 * `items`, `minItems`, `minLength`, `minimum`, `pattern`, `anyOf` and local
 * `$ref`s (`#/$defs/<name>`). No dependencies, so the conformance kit runs
 * anywhere UHD does. Other keywords are ignored, never guessed at.
 */
import { LIBRARY_SCHEMA, type LibrarySchemaDef } from "./schema.js";

export interface ShapeProblem {
  /** JSON pointer-like location, e.g. `/parts/0/partId`. */
  at: string;
  message: string;
}

type Schema = Record<string, unknown>;

const typeOf = (v: unknown): string => (v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v);
const isType = (v: unknown, t: string) => (t === "number" ? typeof v === "number" && Number.isFinite(v) : t === "integer" ? Number.isInteger(v) : typeOf(v) === t);

function check(value: unknown, schema: Schema, root: Schema, at: string, out: ShapeProblem[]): void {
  const fail = (message: string): void => void out.push({ at: at || "/", message });
  if (typeof schema.$ref === "string") {
    const m = /^#\/\$defs\/(.+)$/.exec(schema.$ref);
    const target = m ? ((root.$defs as Record<string, Schema>)[m[1]] as Schema | undefined) : undefined;
    if (!target) return fail(`unresolvable $ref ${schema.$ref}`);
    check(value, target, root, at, out);
  }
  if (Array.isArray(schema.anyOf)) {
    const branches = (schema.anyOf as Schema[]).map((s) => {
      const p: ShapeProblem[] = [];
      check(value, s, root, at, p);
      return p;
    });
    if (!branches.some((p) => p.length === 0)) {
      // report the branch that got furthest (fewest problems)
      const best = branches.reduce((a, b) => (b.length < a.length ? b : a));
      out.push(...best);
    }
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
    if (!types.some((t) => isType(value, t))) return fail(`expected ${types.join(" or ")}, got ${typeOf(value)}`);
  }
  if ("const" in schema && value !== schema.const) fail(`expected ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.includes(value as never)) fail(`expected one of ${(schema.enum as unknown[]).map((e) => JSON.stringify(e)).join(", ")}`);
  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) fail(`shorter than ${schema.minLength}`);
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) fail(`${JSON.stringify(value)} does not match ${schema.pattern}`);
  }
  if (typeof value === "number" && typeof schema.minimum === "number" && value < schema.minimum) fail(`less than ${schema.minimum}`);
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) fail(`fewer than ${schema.minItems} item(s)`);
    if (schema.items && typeof schema.items === "object") value.forEach((v, i) => check(v, schema.items as Schema, root, `${at}/${i}`, out));
  }
  if (typeOf(value) === "object") {
    const obj = value as Record<string, unknown>;
    const props = (schema.properties ?? {}) as Record<string, Schema>;
    for (const k of (schema.required ?? []) as string[]) if (!(k in obj) || obj[k] === undefined) fail(`missing required member ${k}`);
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      if (props[k]) check(v, props[k], root, `${at}/${k}`, out);
      else if (schema.additionalProperties === false) out.push({ at: `${at}/${k}`, message: `${k} is not allowed here` });
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") check(v, schema.additionalProperties as Schema, root, `${at}/${k}`, out);
    }
  }
}

/** Problems with `value` against a schema (default: the library schema's root, which has no constraints of its own). */
export function validateAgainst(value: unknown, schema: Schema, root: Schema = schema): ShapeProblem[] {
  const out: ShapeProblem[] = [];
  check(value, schema, root, "", out);
  return out;
}

/** Problems with `value` as one of the library protocol's shapes (`discovery`, `searchResponse`, `envelope`, …). */
export function validateShape(def: LibrarySchemaDef, value: unknown): ShapeProblem[] {
  const root = LIBRARY_SCHEMA as unknown as Schema;
  return validateAgainst(value, { $ref: `#/$defs/${def}` }, root);
}
