import type { InterfaceDef } from "../types/interface.js";
import type { StorageTrait } from "../types/trait.js";
import { DIGITAL_IN, DIGITAL_IO, DIGITAL_OUT, linkSlots, type LinkSignal } from "./link.js";
import type { SignalRef } from "./signal.js";

/**
 * Storage: the `storage` trait for memory chips, eMMC, memory cards
 * and SSDs, and `SDCard` for SD and microSD slots, card edges and SDIO hosts.
 * Categories: `component.storage.memory`, `.memory_card`, `.ssd`.
 */

const VOLATILE = new Set<StorageTrait["params"]["medium"]>(["sram", "psram", "dram"]);

/**
 * The `storage` trait of a part, checked: a positive whole capacity in
 * bytes and at least one interface. `volatile` defaults from the medium
 * (SRAM, PSRAM and DRAM are volatile).
 */
export function storageTrait(params: Omit<StorageTrait["params"], "volatile"> & { volatile?: boolean }): StorageTrait {
  if (!Number.isInteger(params.capacity_bytes) || params.capacity_bytes <= 0) throw new Error(`storage: capacity_bytes must be a positive whole number of bytes (got ${params.capacity_bytes})`);
  if (!params.interfaces.length) throw new Error("storage: name the interfaces it is reached over");
  return { type: "storage", params: { ...params, volatile: params.volatile ?? VOLATILE.has(params.medium) } };
}

export type SDForm = "sd" | "minisd" | "microsd";
export type SDBusMode = "spi" | "sd_1bit" | "sd_4bit" | "uhs_i" | "uhs_ii" | "sd_express";
export type SDCapacityClass = "sdsc" | "sdhc" | "sdxc" | "sduc";

export interface SDCardConfig {
  /** Interface id. Defaults to "sd". */
  id?: string;
  name?: string;
  /**
   * "host" = the side that clocks the card: a card slot on a board, an
   * MCU's SDMMC/SDIO peripheral; "card" = a memory card's contacts or an
   * SDIO device (a Wi-Fi chip on SDIO).
   */
  role: "host" | "card";
  /** Physical form of the slot or card. Leave out on a host peripheral with no slot. */
  form?: SDForm;
  /** Bus modes it supports. */
  modes: SDBusMode[];
  /** Capacity classes: a card's one, or those a host reads. */
  capacityClasses?: SDCapacityClass[];
  clk?: SignalRef;
  cmd?: SignalRef;
  /** DAT0..DAT3 (DAT0 alone in 1-bit mode). In SPI mode DAT0 is MISO, CMD is MOSI, DAT3 is CS. */
  dat?: SignalRef[];
  /** Card-detect switch of a slot. */
  cd?: SignalRef;
  voltageV?: number | [number, number];
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * An SD bus end: protocol `sd_card`, role `host` or `card`, with an
 * `sd_card` trait (`form`, `modes`, `capacity_classes`). The pair check
 * refuses a card of another form (`sd_form`), ends with no bus mode in
 * common (`sd_mode`) and a card whose capacity class the host does not
 * read (`sd_capacity`: an SDXC card in an SDHC-only slot). Slots pair CLK
 * from the host, CMD and DAT0..3 both ways, in order.
 */
export function SDCard(config: SDCardConfig): InterfaceDef[] {
  const id = config.id ?? "sd";
  if (!config.modes.length) throw new Error(`SDCard ${id}: give the bus modes it supports`);
  const dat = config.dat ?? [];
  if (dat.length > 4) throw new Error(`SDCard ${id}: DAT0..DAT3 at most`);
  if (config.role === "card" && config.capacityClasses && config.capacityClasses.length !== 1) throw new Error(`SDCard ${id}: a card has one capacity class`);
  if (config.cd !== undefined && config.role !== "host") throw new Error(`SDCard ${id}: card detect is a slot's switch`);
  const host = config.role === "host";
  const signals: LinkSignal[] = [];
  if (config.clk !== undefined) signals.push({ slot: "clk", label: "CLK", ref: config.clk, leaf: host ? DIGITAL_OUT : DIGITAL_IN, capability: "sd_clk", role: host ? "clk_out" : "clk_in", required: true });
  if (config.cmd !== undefined) signals.push({ slot: "cmd", label: "CMD", ref: config.cmd, leaf: DIGITAL_IO, capability: "sd_cmd", role: "cmd", required: true });
  dat.forEach((ref, i) => signals.push({ slot: `dat${i}`, label: `DAT${i}`, ref, leaf: DIGITAL_IO, capability: `sd_dat${i}`, role: "dat", required: i === 0 }));
  if (config.cd !== undefined) signals.push({ slot: "cd", label: "CD", ref: config.cd, leaf: DIGITAL_OUT, capability: "sd_cd", role: "cd", required: false });

  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "sd_card", signals, generated, config.voltageV);
  return [
    ...generated,
    {
      id,
      name: config.name ?? `${config.form === "microsd" ? "microSD" : config.form === "minisd" ? "miniSD" : "SD"} ${config.role}`,
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "sd_card", roles: [config.role] }],
      capabilities: ["sd_card", ...config.modes.map((m) => `sd_${m.replace(/^sd_/, "")}`)],
      traits: [{ type: "sd_card", params: { ...(config.form ? { form: config.form } : {}), modes: config.modes, ...(config.capacityClasses ? { capacity_classes: config.capacityClasses } : {}) } }],
      ...(slots.length ? { slots, profiles: [{ id: `${id}_default`, label: `SD ${dat.length > 1 ? "4-bit" : "1-bit"}`, default_active: true, bindings }] } : {}),
    },
  ];
}
