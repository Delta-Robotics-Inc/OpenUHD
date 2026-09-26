/**
 * Deterministic value formatting. The verifier re-formats every re-queried
 * value with the same spec and compares strings, so all formatting of
 * model values goes through `formatValue`.
 *
 * Format spec (the `f` string, `|`-separated):
 *   d<n>        exactly n decimals          (d1 -> 22.2)
 *   s<n>        n significant digits max    (s3 -> 171.9 -> 172)
 *   si          scale by SI prefix          (400000 Hz -> 400 kHz)
 *   u=<unit>    unit override               (u=g)
 *   nounit      value only
 *   pct         multiply by 100, unit %
 *   hex         integer as 0x..
 *   x           "×" join for arrays          ([45, 41, 6] -> 45 × 41 × 6)
 *   upper       upper-case a string          (ccw -> CCW)
 */

export const NBSP = " ";

const UNIT_DISPLAY: Record<string, string> = {
  dimensionless: "",
  C: "°C",
  degC: "°C",
  deg: "°",
  ohm: "ohm",
  mohm: "mohm",
  "kbit/s": "kbit/s",
  uF: "\u03bcF",
  uA: "\u03bcA",
};

/** Characters the document fonts lack, mapped to look-alikes they have (µ → Greek mu, Σ → n-ary sum, Φ → Ø, Ω → ohm). */
export function glyphSafe(s: string): string {
  return s
    .replace(/\u00b5/g, "\u03bc")
    .replace(/\u03a3/g, "\u2211")
    .replace(/[\u03a6\u03c6]/g, "\u00d8")
    .replace(/\u03a9/g, " ohm")
    .replace(/\u221d/g, "~")
    .replace(/\u202f|\u2009/g, NBSP);
}

export function unitLabel(unit?: string): string {
  if (!unit) return "";
  return UNIT_DISPLAY[unit] ?? unit;
}

function groupThousands(s: string): string {
  const [int, frac] = s.split(".");
  const neg = int.startsWith("-");
  const digits = neg ? int.slice(1) : int;
  const grouped = digits.length > 4 ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : digits;
  return (neg ? "−" : "") + grouped + (frac ? "." + frac : "");
}

export function formatNumber(v: number, opts: { d?: number; s?: number } = {}): string {
  if (!Number.isFinite(v)) return String(v);
  let s: string;
  if (opts.d !== undefined) s = v.toFixed(opts.d);
  else if (opts.s !== undefined) {
    const p = Number(v.toPrecision(opts.s));
    s = String(p);
    if (s.includes("e")) s = p.toFixed(0);
  } else {
    // default: up to 3 decimals, trailing zeros trimmed
    s = String(Number(v.toFixed(3)));
  }
  return groupThousands(s);
}

const SI: [number, string][] = [
  [1e9, "G"],
  [1e6, "M"],
  [1e3, "k"],
];

export interface FormatOpts {
  d?: number;
  s?: number;
  si?: boolean;
  unit?: string;
  nounit?: boolean;
  pct?: boolean;
  hex?: boolean;
  x?: boolean;
  upper?: boolean;
}

export function parseFormat(f?: string): FormatOpts {
  const o: FormatOpts = {};
  for (const part of (f ?? "").split("|").filter(Boolean)) {
    if (/^d\d+$/.test(part)) o.d = Number(part.slice(1));
    else if (/^s\d+$/.test(part)) o.s = Number(part.slice(1));
    else if (part === "si") o.si = true;
    else if (part === "nounit") o.nounit = true;
    else if (part === "pct") o.pct = true;
    else if (part === "hex") o.hex = true;
    else if (part === "x") o.x = true;
    else if (part === "upper") o.upper = true;
    else if (part.startsWith("u=")) o.unit = part.slice(2);
    else throw new Error(`unknown format token "${part}"`);
  }
  return o;
}

/** Format a model value (number, [min,max] range, string, boolean, array) with its unit. */
export function formatValue(value: unknown, unit?: string, f?: string): string {
  const o = parseFormat(f);
  let u = o.unit ?? unit;
  const num = (n: number): string => {
    let x = n;
    if (o.pct) x = n * 100;
    if (o.hex) return "0x" + Math.round(x).toString(16).toUpperCase().padStart(2, "0");
    return formatNumber(x, o);
  };
  const withUnit = (s: string, unitStr = u) => {
    const label = o.pct ? "%" : unitLabel(unitStr);
    if (o.nounit || !label) return s;
    return label === "°" ? s + label : s + NBSP + label;
  };

  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") return glyphSafe(o.upper ? value.toUpperCase() : value);
  if (typeof value === "number") {
    if (o.si && u && !o.pct) {
      for (const [k, p] of SI) {
        if (Math.abs(value) >= k) return withUnit(formatNumber(value / k, o), p + u);
      }
    }
    return withUnit(num(value));
  }
  if (Array.isArray(value)) {
    if (value.length === 2 && value.every((x) => typeof x === "number") && !o.x) {
      const [a, b] = value as number[];
      if (o.si && u) {
        for (const [k, p] of SI) {
          if (Math.abs(a) >= k) return withUnit(`${formatNumber(a / k, o)}–${formatNumber(b / k, o)}`, p + u);
        }
      }
      return withUnit(`${num(a)}–${num(b)}`);
    }
    if (value.every((x) => typeof x === "number")) return withUnit((value as number[]).map(num).join(" × "));
    return value.map((x) => (typeof x === "number" ? num(x) : String(x))).join(", ");
  }
  return JSON.stringify(value);
}

/** Unit from a metadata key's suffix: weight_g -> g, supply_V -> V, operating_temperature_C -> °C. */
export function unitFromKey(key: string): string | undefined {
  const m = key.match(/_(mAh|Wh|mm|mm2|g|kg|V|A|mA|uA|W|mW|ms|s|min|h|Hz|kHz|MHz|dBm|C|deg|ohm|mohm|uF|in|pct|rpm)$/);
  if (!m) return undefined;
  const map: Record<string, string> = { pct: "%", mm2: "mm²", deg: "deg" };
  return map[m[1]] ?? m[1];
}
