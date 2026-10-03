/**
 * Protocol role pair compatibility table.
 *
 * Generic pairs apply to any protocol type unless overridden
 * by protocol-specific entries.
 */

const GENERIC_ROLE_PAIRS: Record<string, string[]> = {
  input: ["output"],
  output: ["input"],
  bidirectional: ["input", "output", "bidirectional"],
  master: ["slave"],
  slave: ["master"],
  host: ["device", "peripheral"],
  device: ["host", "controller"],
  peripheral: ["host", "controller"],
  controller: ["device", "peripheral"],
  source: ["sink"],
  sink: ["source"],
  transmitter: ["receiver"],
  receiver: ["transmitter"],
  transceiver: ["transmitter", "receiver", "transceiver"],
  peer: ["peer"],
  primary: ["secondary"],
  secondary: ["primary"],
  target: ["controller", "source", "master", "host"],
};

/**
 * Protocol-specific role pair overrides.
 * Only needed when the generic pairs are wrong or insufficient.
 */
const PROTOCOL_ROLE_PAIRS: Record<string, Record<string, string[]>> = {
  i2c: {
    master: ["slave"],
    slave: ["master"],
    // Sub-roles for slot matching within composed interfaces
    data: ["data"],
    clock: ["clock"],
  },
  spi: {
    master: ["slave"],
    slave: ["master"],
    data_out: ["data_in"],
    data_in: ["data_out"],
    clock: ["clock"],
    select: ["select"],
  },
  uart: {
    host: ["device"],
    device: ["host"],
    transmitter: ["receiver"],
    receiver: ["transmitter"],
    transceiver: ["transmitter", "receiver", "transceiver"],
  },
  power: {
    input: ["output"],
    output: ["input"],
    ground: ["ground"],
  },
  bolt_pattern: {
    structure: ["component"],
    component: ["structure"],
  },
  // a passive terminal joined to another by a conductor (an LED's anode soldered to a
  // board pad): on a board net, terminals still pair with nothing (system/derive.ts)
  passive: {
    terminal: ["terminal"],
  },
  motor_control: {
    controller: ["target"],
    target: ["controller"],
    source: ["target"],
  },
  // Stepper windings (StepperPhases). Older parts used driver/motor; they
  // pair with the output/input roles the builder emits.
  bipolar_stepper_phases: {
    output: ["input", "motor"],
    input: ["output", "driver"],
    driver: ["motor", "input"],
    motor: ["driver", "output"],
  },
  // CAN bus side (CAN): every node on the bus pairs with every other. Older
  // parts declared the bus as "transceiver" or "peer"; they are the same family.
  can: {
    node: ["node", "transceiver", "peer"],
    transceiver: ["node", "transceiver", "peer"],
    peer: ["node", "transceiver", "peer"],
  },
  can_signal: {
    node: ["node"],
  },
  // CAN logic side (CANLogic): a CAN controller's TX/RX to a transceiver's TXD/RXD.
  can_logic: {
    controller: ["transceiver"],
    transceiver: ["controller"],
  },
  // Fluid ports (FluidPort): flow goes from a source to a sink; fittings,
  // tubing and passthrough ports are bidirectional; a gauge or transducer
  // senses pressure where it is plumbed in.
  pneumatic: {
    source: ["sink", "bidirectional", "sensing"],
    sink: ["source", "bidirectional"],
    bidirectional: ["source", "sink", "bidirectional", "sensing"],
    sensing: ["source", "bidirectional"],
  },
  hydraulic: {
    source: ["sink", "bidirectional", "sensing"],
    sink: ["source", "bidirectional"],
    bidirectional: ["source", "sink", "bidirectional", "sensing"],
    sensing: ["source", "bidirectional"],
  },
};

/**
 * Protocols whose role table is complete: the generic pairs do not apply.
 * (Without this, two CAN transceivers' logic sides would pair through the
 * generic transceiver ↔ transceiver entry.)
 */
const NO_GENERIC_FALLBACK = new Set(["can_logic", "pneumatic", "hydraulic"]);

/**
 * Check whether two roles are compatible for a given protocol type.
 * Uses protocol-specific pairs first, falls back to generic pairs.
 */
export function areRolesCompatible(
  protocolType: string,
  roleA: string,
  roleB: string,
): boolean {
  const normalA = roleA.toLowerCase();
  const normalB = roleB.toLowerCase();

  if (normalA === normalB && normalA === "peer") return true;
  if (normalA === normalB && normalA === "bidirectional") return true;

  // Check protocol-specific pairs
  const protocolPairs = PROTOCOL_ROLE_PAIRS[protocolType.toLowerCase()];
  if (protocolPairs) {
    const compatA = protocolPairs[normalA];
    if (compatA?.includes(normalB)) return true;

    const compatB = protocolPairs[normalB];
    if (compatB?.includes(normalA)) return true;
  }

  if (NO_GENERIC_FALLBACK.has(protocolType.toLowerCase())) return false;

  // Fall back to generic pairs
  const genericA = GENERIC_ROLE_PAIRS[normalA];
  if (genericA?.includes(normalB)) return true;

  const genericB = GENERIC_ROLE_PAIRS[normalB];
  if (genericB?.includes(normalA)) return true;

  return false;
}

/**
 * Return all roles compatible with the given role under a protocol type.
 */
export function getCompatibleRoles(
  protocolType: string,
  role: string,
): string[] {
  const normal = role.toLowerCase();
  const result = new Set<string>();

  const protocolPairs = PROTOCOL_ROLE_PAIRS[protocolType.toLowerCase()];
  if (protocolPairs?.[normal]) {
    for (const r of protocolPairs[normal]) result.add(r);
  }

  if (GENERIC_ROLE_PAIRS[normal] && !NO_GENERIC_FALLBACK.has(protocolType.toLowerCase())) {
    for (const r of GENERIC_ROLE_PAIRS[normal]) result.add(r);
  }

  return [...result];
}
