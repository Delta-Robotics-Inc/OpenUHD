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
/** MIPI CSI-2 / DSI sub-roles: transmitter → receiver, clock and data lanes. */
function MIPI_ROLES(): Record<string, string[]> {
  return {
    transmitter: ["receiver"],
    receiver: ["transmitter"],
    clock_tx_p: ["clock_rx_p"],
    clock_tx_n: ["clock_rx_n"],
    clock_rx_p: ["clock_tx_p"],
    clock_rx_n: ["clock_tx_n"],
    data_tx_p: ["data_rx_p"],
    data_tx_n: ["data_rx_n"],
    data_rx_p: ["data_tx_p"],
    data_rx_n: ["data_tx_n"],
  };
}

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
  },  // ---- Links (PB-866). Each composite's slots carry a sub-role per conductor,
  // so ports pair conductor by conductor and nothing else.
  // PCIe: a root (root port, switch downstream port, host side of a slot) with
  // an endpoint (card, SSD, switch upstream port). Lanes TX→RX, clock, sideband.
  pcie: {
    root: ["endpoint"],
    endpoint: ["root"],
    tx_p: ["rx_p"],
    tx_n: ["rx_n"],
    rx_p: ["tx_p"],
    rx_n: ["tx_n"],
    refclk_out_p: ["refclk_in_p"],
    refclk_out_n: ["refclk_in_n"],
    refclk_in_p: ["refclk_out_p"],
    refclk_in_n: ["refclk_out_n"],
    perst_out: ["perst_in"],
    perst_in: ["perst_out"],
    clkreq_out: ["clkreq_in"],
    clkreq_in: ["clkreq_out"],
    wake_out: ["wake_in"],
    wake_in: ["wake_out"],
  },
  pcie_lane: {
    transmitter: ["receiver"],
    receiver: ["transmitter"],
  },
  // M.2: a socket takes a card.
  m2: {
    socket: ["card"],
    card: ["socket"],
  },
  // MIPI CSI-2 and DSI: transmitter → receiver, clock to clock, data lane to data lane.
  mipi_csi2: MIPI_ROLES(),
  mipi_dsi: MIPI_ROLES(),
  mipi_dphy: {
    transmitter: ["receiver"],
    receiver: ["transmitter"],
  },
  // Ethernet: any two ports link (auto MDI-X or the cable crosses the pairs).
  ethernet: {
    port: ["port"],
    mdi_p: ["mdi_p"],
    mdi_n: ["mdi_n"],
  },
  ethernet_mdi: {
    bidirectional: ["bidirectional"],
  },
  sfp: {
    cage: ["module"],
    module: ["cage"],
  },
  // I2S / PCM: the clock controller with a clock target (older parts said
  // master / slave); BCLK and WS out to in (or a port that can be either);
  // data out to data in; MCLK out to in.
  i2s: {
    controller: ["target", "slave"],
    target: ["controller", "master"],
    master: ["slave", "target"],
    slave: ["master", "controller"],
    bclk_out: ["bclk_in", "bclk_io"],
    bclk_in: ["bclk_out", "bclk_io"],
    bclk_io: ["bclk_out", "bclk_in", "bclk_io"],
    ws_out: ["ws_in", "ws_io"],
    ws_in: ["ws_out", "ws_io"],
    ws_io: ["ws_out", "ws_in", "ws_io"],
    dout_out: ["din_in"],
    din_in: ["dout_out"],
    mclk_out: ["mclk_in"],
    mclk_in: ["mclk_out"],
  },
  // DVP parallel camera bus: the camera drives data, PCLK, VSYNC and HREF; the host may drive XCLK.
  dvp: {
    camera: ["host"],
    host: ["camera"],
    data_out: ["data_in"],
    data_in: ["data_out"],
    pclk_out: ["pclk_in"],
    pclk_in: ["pclk_out"],
    vsync_out: ["vsync_in"],
    vsync_in: ["vsync_out"],
    href_out: ["href_in"],
    href_in: ["href_out"],
    xclk_out: ["xclk_in"],
    xclk_in: ["xclk_out"],
  },
  // SD: the host (slot, SDMMC peripheral) clocks the card.
  sd_card: {
    host: ["card"],
    card: ["host"],
    clk_out: ["clk_in"],
    clk_in: ["clk_out"],
    cmd: ["cmd"],
    dat: ["dat"],
  },
  // LED drive: a sinking driver channel to an LED's cathode, a sourcing one to its anode.
  led_drive: {
    sink: ["cathode"],
    cathode: ["sink"],
    source: ["anode"],
    anode: ["source"],
  },
  // USB: host with device; a dual-role port with either. Older parts used
  // "bidirectional" for a port that can be either.
  usb: {
    host: ["device", "dual_role", "bidirectional"],
    device: ["host", "dual_role", "bidirectional"],
    dual_role: ["host", "device", "dual_role", "bidirectional"],
    bidirectional: ["host", "device", "dual_role", "bidirectional"],
    d_p: ["d_p"],
    d_n: ["d_n"],
    sstx_p: ["ssrx_p"],
    sstx_n: ["ssrx_n"],
    ssrx_p: ["sstx_p"],
    ssrx_n: ["sstx_n"],
    cc: ["cc"],
  },
  usb_signal: {
    transmitter: ["receiver"],
    receiver: ["transmitter"],
    bidirectional: ["bidirectional"],
  },
  // Wireless (network domain).
  wifi: {
    client: ["access_point"],
    access_point: ["client"],
    peer: ["peer"],
  },
  bluetooth: {
    central: ["peripheral", "peer"],
    peripheral: ["central", "peer"],
    peer: ["peer", "central", "peripheral"],
    broadcaster: ["observer"],
    observer: ["broadcaster"],
  },
  ieee802154: {
    node: ["node"],
  },
};

/**
 * Protocols whose role table is complete: the generic pairs do not apply.
 * (Without this, two CAN transceivers' logic sides would pair through the
 * generic transceiver ↔ transceiver entry.)
 */
const NO_GENERIC_FALLBACK = new Set([
  "can_logic",
  "pneumatic",
  "hydraulic",
  "pcie",
  "pcie_lane",
  "m2",
  "mipi_csi2",
  "mipi_dsi",
  "mipi_dphy",
  "ethernet",
  "ethernet_mdi",
  "sfp",
  "i2s",
  "dvp",
  "sd_card",
  "led_drive",
  "wifi",
  "bluetooth",
  "ieee802154",
]);

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
