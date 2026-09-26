/**
 * Fault scenarios for the quadcopter showcase (PB-789): each returns a
 * modified system (and lookup) with one realistic mistake that the system
 * checks should catch. The nominal system is scenario "nominal".
 */
import type { InterfaceLink, ModuleDef } from "../../../src/types/index.js";
import type { ModuleLookup } from "../../../src/system/index.js";
import { BoltPattern } from "../../../src/protocols/index.js";
import { QUADCOPTER_5IN, QUADCOPTER_5IN_FRAME, lookupQuadcopterModule } from "./index.js";

export interface Scenario {
  id: string;
  label: string;
  description: string;
  system: ModuleDef;
  lookup: ModuleLookup;
}

const relink = (system: ModuleDef, id: string, patch: Partial<InterfaceLink>): ModuleDef => ({
  ...system,
  links: (system.links ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)),
});

const withLookup = (overrides: ModuleDef[]): ModuleLookup => {
  const byId = new Map(overrides.map((d) => [d.id, d]));
  return (id) => byId.get(id) ?? lookupQuadcopterModule(id);
};

const frame20mm: ModuleDef = {
  ...QUADCOPTER_5IN_FRAME,
  interfaces: QUADCOPTER_5IN_FRAME.interfaces.map((i) =>
    i.id === "stack_mount"
      ? BoltPattern({ id: "stack_mount", name: "Stack mount (20 x 20)", role: "structure", shape: "square", spacingMm: 20, holeCount: 4, fastener: "M2", fastenerDiameterMm: 2 })
      : i,
  ),
};

export const SCENARIOS: Scenario[] = [
  {
    id: "nominal",
    label: "Nominal build",
    description: "The reference quadcopter as designed.",
    system: QUADCOPTER_5IN,
    lookup: lookupQuadcopterModule,
  },
  {
    id: "o4-on-vbat",
    label: "O4 wired to raw 6S",
    description: "The DJI O4 power lead is soldered to the battery instead of the 10 V BEC.",
    system: relink(QUADCOPTER_5IN, "video_power", { a: { child: "battery", interfaceId: "battery_out" } }),
    lookup: lookupQuadcopterModule,
  },
  {
    id: "frame-20mm-stack",
    label: "20 × 20 frame for a 30.5 stack",
    description: "The frame's stack mount is cut for a 20 × 20 mm M2 stack.",
    system: QUADCOPTER_5IN,
    lookup: withLookup([frame20mm]),
  },
  {
    id: "gps-on-rx-uart",
    label: "GPS on the receiver's UART",
    description: "The GNSS UART is wired to UART2, which the ELRS receiver already uses.",
    system: relink(QUADCOPTER_5IN, "gnss_uart", { a: { child: "stack", interfaceId: "uart2" } }),
    lookup: lookupQuadcopterModule,
  },
  {
    id: "two-compasses",
    label: "Two compasses at 0x0D",
    description: "A second GNSS/compass module is added on the same I2C bus.",
    system: {
      ...QUADCOPTER_5IN,
      children: [...(QUADCOPTER_5IN.children ?? []), { id: "gnss_2", moduleDefId: "matek-m10q-5883", name: "Second GNSS" }],
      links: [
        ...(QUADCOPTER_5IN.links ?? []),
        { id: "gnss2_i2c", name: "Compass 2", a: { child: "stack", interfaceId: "i2c1" }, b: { child: "gnss_2", interfaceId: "i2c_compass" } },
        { id: "gnss2_power", name: "GPS2 power", a: { child: "stack", interfaceId: "rail_4v5" }, b: { child: "gnss_2", interfaceId: "vin_5v" } },
      ],
    },
    lookup: lookupQuadcopterModule,
  },
];
