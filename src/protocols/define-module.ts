import type { ModuleDef } from "../types/module.js";
import { validateProfile } from "../binding/profile.js";
import { isNet } from "./net.js";

/**
 * Validating constructor for part definitions.
 *
 * Wrap every part file's ModuleDef in this call. TypeScript checks the
 * shape at compile time; this adds the referential checks the type system
 * cannot express:
 *   - interface IDs are unique
 *   - every declared profile passes validateProfile (bindings exist,
 *     required slots are bound, bound pins carry the slot's capability)
 *   - interfaceGroups members reference existing interfaces
 *   - export ids are unique and do not repeat an interface id (a net port
 *     may take its net's id)
 *   - a net port (`from: { self: true, interfaceId }`) exports a `Net` of
 *     the module, and each net has at most one
 *
 * Throws an Error listing every problem found, so a bad part fails at
 * import time rather than after it reaches the database.
 */
export function defineModule(def: ModuleDef): ModuleDef {
  const problems: string[] = [];
  const interfaceIds = new Set<string>();

  for (const iface of def.interfaces) {
    if (interfaceIds.has(iface.id)) {
      problems.push(`duplicate interface id "${iface.id}"`);
    }
    interfaceIds.add(iface.id);
  }

  for (const iface of def.interfaces) {
    for (const profile of iface.profiles ?? []) {
      const result = validateProfile(def, iface.id, profile);
      for (const error of result.errors) {
        problems.push(`interface "${iface.id}" profile "${profile.id}": ${error}`);
      }
    }
  }

  // an export shares the boundary namespace with the module's own interfaces
  // (a board's internal nets included), which would shadow it. A net port
  // may take the id of the net it exports: the two are one conductor.
  const exportIds = new Set<string>();
  const portedNets = new Set<string>();
  for (const ex of def.exports ?? []) {
    const netPort = "self" in ex.from;
    if (netPort) {
      const netId = ex.from.interfaceId;
      const net = def.interfaces.find((i) => i.id === netId);
      if (!net || !isNet(net)) problems.push(`net port "${ex.id}" exports "${netId}", which is not a net of the module`);
      else if (portedNets.has(netId)) problems.push(`net "${netId}" is exported by more than one net port`);
      portedNets.add(netId);
    }
    if (interfaceIds.has(ex.id) && !(netPort && ex.id === ex.from.interfaceId)) problems.push(`export "${ex.id}" has the id of an interface on the module`);
    if (exportIds.has(ex.id)) problems.push(`duplicate export id "${ex.id}"`);
    exportIds.add(ex.id);
  }

  for (const group of def.interfaceGroups ?? []) {
    for (const member of group.members) {
      if (!interfaceIds.has(member)) {
        problems.push(`interface group "${group.id}" references missing interface "${member}"`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid module "${def.id}":\n  - ${problems.join("\n  - ")}`);
  }

  return def;
}
