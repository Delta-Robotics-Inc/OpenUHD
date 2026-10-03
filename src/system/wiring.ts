/**
 * Wiring / assembly checklist from a system's stored links.
 *
 * One step per link, grouped by the harness that carries it. Composed links
 * expand into their child links, so the checklist reads pad-to-pad
 * (e.g. "stack:uart1 TX1 → gnss:uart_gnss RX"). Crossovers — a child link
 * whose two ends fill differently named slots, such as TX→RX — are flagged.
 */
import type { ModuleDef } from "../types/module.js";
import type { LinkResult, ModuleLookup } from "./index.js";
import { validateLinks } from "./index.js";

export interface WiringConnection {
  from: string;
  to: string;
  crossover: boolean;
}

export interface WiringStep {
  linkId: string;
  name: string;
  domain: string;
  protocol: string;
  harness?: string;
  state: LinkResult["state"];
  a: string;
  b: string;
  connections: WiringConnection[];
}

type End = { slotId?: string; leafId: string; pin?: string };

/** Pad label, plus the slot when several child links share one pad label (e.g. motor phase pads). */
function labeller(ends: End[]) {
  const counts = new Map<string, number>();
  for (const e of ends) if (e.pin) counts.set(e.pin, (counts.get(e.pin) ?? 0) + 1);
  return (e: End) => {
    const slot = (e.slotId ?? e.leafId).toUpperCase();
    if (!e.pin) return slot;
    return (counts.get(e.pin) ?? 0) > 1 ? `${e.pin} ${slot}` : e.pin;
  };
}

export function wiringChecklist(def: ModuleDef, lookup: ModuleLookup): WiringStep[] {
  return validateLinks(def, lookup).map((r) => {
    const la = labeller(r.children.map((c) => c.a));
    const lb = labeller(r.children.map((c) => c.b));
    return {
      linkId: r.link.id,
      name: r.link.name ?? r.link.id,
      domain: r.a.iface.domain,
      protocol: r.protocol,
      ...(r.link.harness ? { harness: r.link.harness } : {}),
      state: r.state,
      a: r.a.path,
      b: r.b.path,
      connections: r.children.map((c) => ({
        from: `${r.a.path} ${la(c.a)}`,
        to: `${r.b.path} ${lb(c.b)}`,
        crossover: c.a.slotId !== undefined && c.b.slotId !== undefined && c.a.slotId !== c.b.slotId,
      })),
    };
  });
}

/** Render the checklist as Markdown, electrical steps first, grouped by harness. */
export function wiringMarkdown(title: string, steps: WiringStep[]): string {
  const groups = new Map<string, WiringStep[]>();
  const sorted = [...steps].sort((a, b) => Number(a.domain !== "electrical") - Number(b.domain !== "electrical"));
  for (const step of sorted) {
    const key = step.harness ?? (step.domain === "electrical" ? "direct wiring" : `${step.domain} assembly`);
    groups.set(key, [...(groups.get(key) ?? []), step]);
  }
  const out = [`# Wiring and assembly checklist — ${title}`, ""];
  for (const [group, items] of groups) {
    out.push(`## ${group}`, "");
    for (const s of items) {
      const flag = s.state === "configured" ? "" : ` **(${s.state})**`;
      out.push(`- [ ] **${s.name}** — \`${s.a}\` ↔ \`${s.b}\` (${s.protocol})${flag}`);
      for (const c of s.connections) {
        out.push(`  - [ ] \`${c.from}\` → \`${c.to}\`${c.crossover ? " — crossover" : ""}`);
      }
    }
    out.push("");
  }
  return out.join("\n");
}
