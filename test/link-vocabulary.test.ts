/**
 * The link, bus and radio vocabulary: PCIe and
 * M.2, MIPI CSI-2 and DSI, Ethernet with PoE and SFP, I2S / PCM, DVP
 * cameras, Wi-Fi / Bluetooth / IEEE 802.15.4 radios, SD, USB, and the LED,
 * relay and storage traits.
 */
import { describe, expect, it } from "vitest";
import { validatePair } from "../src/drc/index.js";
import { checkSystem } from "../src/system/checks.js";
import { areRolesCompatible } from "../src/matching/roles.js";
import {
  Bluetooth,
  CSI2,
  DSI,
  DVP,
  Ethernet,
  I2S,
  IEEE802154,
  Led,
  LedDrive,
  M2,
  PCIe,
  PCM,
  RelayCoil,
  RelayContacts,
  SDCard,
  SFP,
  USB,
  WiFi,
  Net,
  defineModule,
  ledTrait,
  netLinks,
  relayTrait,
  storageTrait,
} from "../src/protocols/index.js";
import type { InterfaceDef, ModuleDef } from "../src/types/index.js";

const mod = (id: string, interfaces: InterfaceDef[]): ModuleDef => defineModule({ id, name: id, interfaces });
const pair = (a: ModuleDef, b: ModuleDef) => validatePair(a, b);
const connection = (a: ModuleDef, b: ModuleDef, protocol: string) => pair(a, b).connections.find((c) => c.protocol === protocol);
const codes = (a: ModuleDef, b: ModuleDef, protocol: string) => {
  const c = connection(a, b, protocol);
  return (c?.diagnostics ?? []).map((d) => `${d.severity}:${d.code}`);
};
const pin = (p: number | string) => ({ pin: p });

describe("PCIe", () => {
  const root = (lanes = 1, generation = 2) =>
    mod("stub-host", PCIe({ role: "root", lanes, generation, laneSignals: [{ tx: [pin(1), pin(2)], rx: [pin(3), pin(4)] }], refclk: [pin(5), pin(6)], perst: pin(7), clkreq: pin(8) }));
  const ssd = (lanes = 4, generation = 3) =>
    mod("stub-ssd", PCIe({ role: "endpoint", lanes, generation, laneSignals: [{ tx: [pin("A1"), pin("A2")], rx: [pin("A3"), pin("A4")] }], refclk: [pin("A5"), pin("A6")], perst: pin("A7"), clkreq: pin("A8") }));

  it("emits lane, clock and sideband leaves and a composite with lane_count and pcie_generation", () => {
    const ifaces = PCIe({ role: "root", lanes: 1, generation: 2, laneSignals: [{ tx: [pin(1), pin(2)], rx: [pin(3), pin(4)] }], perst: pin(7) });
    expect(ifaces.map((i) => i.id)).toEqual(["pcie_lane0_tx_p", "pcie_lane0_tx_n", "pcie_lane0_rx_p", "pcie_lane0_rx_n", "pcie_perst", "pcie"]);
    const port = ifaces.at(-1)!;
    expect(port.parameters).toEqual([
      { id: "lane_count", unit: "dimensionless", range: [1, 1] },
      { id: "pcie_generation", unit: "dimensionless", range: [1, 2] },
    ]);
    expect(port.slots!.map((s) => s.match.role)).toEqual(["tx_p", "tx_n", "rx_p", "rx_n", "perst_out"]);
    expect(() => PCIe({ role: "root", lanes: 3, generation: 2 })).toThrow(/lanes must be/);
    expect(() => PCIe({ role: "root", lanes: 1, generation: 2, laneSignals: [{ tx: ["a", "b"], rx: ["c", "d"] }, { tx: ["e", "f"], rx: ["g", "h"] }] })).toThrow(/2 lane pin sets/);
  });

  it("a root pairs with an endpoint lane by lane, TX to RX, and the link trains to the narrower, older end", () => {
    const c = connection(root(), ssd(), "pcie")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => `${l.from.slotId}>${l.to.slotId}`)).toEqual([
      "lane0_tx_p>lane0_rx_p", "lane0_tx_n>lane0_rx_n", "lane0_rx_p>lane0_tx_p", "lane0_rx_n>lane0_tx_n",
      "refclk_p>refclk_p", "refclk_n>refclk_n", "perst>perst", "clkreq>clkreq",
    ]);
    expect(c.diagnostics).toEqual([expect.objectContaining({ severity: "info", code: "link_width", message: expect.stringMatching(/x1 Gen 2/) })]);
  });

  it("two roots or two endpoints do not pair", () => {
    expect(areRolesCompatible("pcie", "root", "root")).toBe(false);
    expect(areRolesCompatible("pcie", "endpoint", "endpoint")).toBe(false);
    expect(areRolesCompatible("pcie", "host", "device")).toBe(false);
  });
});

describe("M.2", () => {
  const socket = (over: Partial<Parameters<typeof M2>[0]> = {}) =>
    mod("stub-m2-socket", [M2({ role: "socket", key: "M", sizes: ["2230", "2242", "2280"], carries: ["pcie"], pcie: { lanes: 1, generation: 2 }, ...over })]);
  const nvme = mod("stub-nvme", [M2({ role: "card", key: "M", sizes: ["2280"], carries: ["pcie"], pcie: { lanes: 4, generation: 3 } })]);
  const sata = mod("stub-sata", [M2({ role: "card", key: ["B", "M"], sizes: ["2280"], carries: ["sata"] })]);
  const wifi = mod("stub-wifi-card", [M2({ role: "card", key: ["A", "E"], sizes: ["2230"], carries: ["pcie", "usb2"], pcie: { lanes: 1, generation: 2 } })]);

  it("an M-key NVMe card fits an M-key socket and trains to the socket's lanes", () => {
    const c = connection(socket(), nvme, "m2")!;
    expect(c.state).toBe("valid");
    expect(codes(socket(), nvme, "m2")).toEqual(["info:link_width"]);
  });

  it("refuses a SATA card in a PCIe-only socket, an A+E card in an M socket, and a length with no standoff", () => {
    expect(codes(socket(), sata, "m2")).toEqual(["error:m2_interface"]);
    expect(codes(socket(), wifi, "m2")).toEqual(["error:m2_key"]);
    expect(codes(socket({ sizes: ["2230", "2242"] }), nvme, "m2")).toContain("error:m2_size");
  });

  it("a B+M card fits a B-key socket", () => {
    const b = mod("stub-b-socket", [M2({ role: "socket", key: "B", sizes: ["2280"], carries: ["sata", "usb3"] })]);
    expect(connection(b, sata, "m2")!.state).toBe("valid");
  });

  it("checks its own declaration", () => {
    expect(() => M2({ role: "socket", key: ["B", "M"], sizes: ["2280"], carries: ["sata"] })).toThrow(/exactly one key/);
    expect(() => M2({ role: "card", key: "M", sizes: ["2280"], carries: ["pcie"] })).toThrow(/give `pcie`/);
    expect(() => M2({ role: "card", key: "M", sizes: ["80mm"], carries: ["sata"] })).toThrow(/width and length/);
  });
});

describe("MIPI CSI-2 and DSI", () => {
  const lanes = (n: number, base: number) => Array.from({ length: n }, (_, i) => [pin(base + 2 * i), pin(base + 2 * i + 1)] as [{ pin: number }, { pin: number }]);
  const camera = (laneModes?: number[], rate?: number) =>
    mod("stub-camera", CSI2({ role: "transmitter", lanes: 4, ...(laneModes ? { laneModes } : {}), ...(rate ? { laneRateMbps: rate } : {}), clock: [pin(1), pin(2)], data: lanes(4, 3) }));
  const host = (n: number, rate?: number) => mod("stub-host", CSI2({ role: "receiver", lanes: n, ...(rate ? { laneRateMbps: rate } : {}), clock: [pin(1), pin(2)], data: lanes(n, 3) }));

  it("a camera pairs with a host: clock to clock, data lane to data lane", () => {
    const c = connection(camera(), host(4), "mipi_csi2")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => `${l.from.slotId}>${l.to.slotId}`).slice(0, 4)).toEqual(["clk_p>clk_p", "clk_n>clk_n", "d0_p>d0_p", "d0_n>d0_n"]);
  });

  it("a camera that streams only on 4 lanes does not work on a 2-lane host; one with a 2-lane mode does", () => {
    expect(codes(camera(), host(2), "mipi_csi2")).toContain("error:param_range_disjoint");
    const ok = connection(camera([2, 4]), host(2), "mipi_csi2")!;
    expect(ok.diagnostics.map((d) => d.code)).toEqual(["link_width"]);
  });

  it("a transmitter faster than the receiver is a warning", () => {
    expect(codes(camera(undefined, 2500), host(4, 1500), "mipi_csi2")).toEqual(["warning:lane_rate"]);
  });

  it("CSI-2 does not pair with DSI, and a port can be both over the same leaves", () => {
    const display = mod("stub-display", DSI({ role: "receiver", lanes: 2 }));
    expect(connection(camera(), display, "mipi_dsi")).toBeUndefined();
    const csi = CSI2({ role: "receiver", lanes: 2, clock: [pin(1), pin(2)], data: lanes(2, 3) });
    const leafIds = csi.slice(0, -1).map((i) => i.id);
    const dsi = DSI({ id: "dsi", role: "transmitter", lanes: 2, clock: [leafIds[0]!, leafIds[1]!], data: [[leafIds[2]!, leafIds[3]!], [leafIds[4]!, leafIds[5]!]] });
    expect(dsi.map((i) => i.id)).toEqual(["dsi"]);
    expect(() => mod("stub-pi-mipi", [...csi, ...dsi])).not.toThrow();
  });
});

describe("Ethernet, PoE and SFP", () => {
  const gig = (poe?: Parameters<typeof Ethernet>[0]["poe"]) =>
    mod("stub-switch", Ethernet({ speedsMbps: [10, 100, 1000], pairs: { a: [pin(1), pin(2)], b: [pin(3), pin(6)], c: [pin(4), pin(5)], d: [pin(7), pin(8)] }, ...(poe ? { poe } : {}) }));
  const fast = (poe?: Parameters<typeof Ethernet>[0]["poe"]) => mod("stub-camera", Ethernet({ speedsMbps: [10, 100], pairs: { a: [pin(1), pin(2)], b: [pin(3), pin(6)] }, ...(poe ? { poe } : {}) }));

  it("a gigabit port links to a 10/100 port at 100 Mbit/s over pairs A and B", () => {
    const c = connection(gig(), fast(), "ethernet")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => `${l.from.slotId}>${l.to.slotId}`)).toEqual(["pair_a_p>pair_a_p", "pair_a_n>pair_a_n", "pair_b_p>pair_b_p", "pair_b_n>pair_b_n"]);
    expect(c.diagnostics.map((d) => `${d.code}:${d.message}`)).toEqual(["ethernet_speed:the link runs at 100 Mbit/s"]);
  });

  it("no speed in common is an error, and so is copper against fibre", () => {
    const sfpOnly = mod("stub-1g", Ethernet({ speedsMbps: [1000], medium: "fiber", fiber: { mode: "single_mode", txNm: 1310 } }));
    expect(codes(fast(), sfpOnly, "ethernet")).toEqual(expect.arrayContaining(["error:ethernet_speed", "error:ethernet_medium"]));
  });

  it("fibre ends need the same mode and crossed wavelengths", () => {
    const fib = (mode: "single_mode" | "multi_mode", txNm: number, rxNm?: number) =>
      mod(`stub-${mode}-${txNm}`, Ethernet({ speedsMbps: [1000], medium: "fiber", fiber: { mode, txNm, ...(rxNm ? { rxNm, strands: 1 as const } : {}) } }));
    expect(connection(fib("single_mode", 1310), fib("single_mode", 1310), "ethernet")!.state).toBe("valid");
    expect(codes(fib("single_mode", 1310), fib("multi_mode", 850), "ethernet")).toContain("error:fiber_mismatch");
    expect(connection(fib("single_mode", 1310, 1550), fib("single_mode", 1550, 1310), "ethernet")!.state).toBe("valid");
    expect(codes(fib("single_mode", 1310, 1550), fib("single_mode", 1310, 1550), "ethernet")).toContain("error:fiber_mismatch");
  });

  it("a PoE device that draws more than the PSE gives is refused; one powered only by PoE on a plain port is warned", () => {
    const pse = gig({ role: "pse", standard: "802.3af", powerW: 15.4, voltageV: [44, 57] });
    const pd = (powerW: number) => fast({ role: "pd", standard: "802.3at", powerW, voltageV: [42.5, 57], required: true });
    expect(connection(pse, pd(12.95), "ethernet")!.state).toBe("valid");
    expect(codes(pse, pd(25.5), "ethernet")).toContain("error:poe_power");
    expect(codes(gig(), pd(12.95), "ethernet")).toContain("warning:poe_power");
    const passive = gig({ role: "pse", standard: "passive", voltageV: 24 });
    expect(codes(passive, pd(12.95), "ethernet")).toEqual(expect.arrayContaining(["warning:poe_power", "error:param_range_disjoint"]));
  });

  it("an SFP module fits an SFP+ cage at a speed both run; a QSFP module does not", () => {
    const cage = mod("stub-cage", [SFP({ role: "cage", form: "sfp+", speedsMbps: [1000, 10000] })]);
    const module1g = mod("stub-sfp", [SFP({ role: "module", form: "sfp", speedsMbps: [1000] })]);
    expect(codes(cage, module1g, "sfp")).toEqual(["info:ethernet_speed"]);
    const qsfp = mod("stub-qsfp", [SFP({ role: "module", form: "qsfp+", speedsMbps: [40000] })]);
    expect(codes(cage, qsfp, "sfp")).toEqual(expect.arrayContaining(["error:sfp_form", "error:ethernet_speed"]));
  });

  it("checks its own declaration", () => {
    expect(() => Ethernet({ speedsMbps: [1000], pairs: { a: ["a", "b"], b: ["c", "d"] } })).toThrow(/four pairs/);
    expect(() => Ethernet({ speedsMbps: [1000], medium: "fiber" })).toThrow(/`fiber`/);
    expect(() => Ethernet({ speedsMbps: [100], poe: { role: "pse", standard: "802.3af", required: true } })).toThrow(/powered device/);
  });
});

describe("I2S and PCM", () => {
  const mcu = (direction: "out" | "in" | "duplex" = "out") =>
    mod("stub-mcu", I2S({ clockRole: ["controller", "target"], direction, bclk: pin(1), ws: pin(2), ...(direction !== "in" ? { dout: pin(3) } : {}), ...(direction !== "out" ? { din: pin(4) } : {}), sampleRateHz: [8000, 96000], bitDepth: [16, 32] }));
  const amp = mod("stub-amp", I2S({ clockRole: "target", direction: "in", bclk: pin("BCLK"), ws: pin("LRC"), din: pin("DIN"), sampleRateHz: [8000, 96000], bitDepth: [16, 32] }));
  const mic = mod("stub-mic", I2S({ clockRole: "target", direction: "out", bclk: pin("SCK"), ws: pin("WS"), dout: pin("SD"), sampleRateHz: [16000, 48000], bitDepth: 24 }));

  it("an MCU drives an amplifier: BCLK and WS out to in, data out to data in", () => {
    const c = connection(mcu(), amp, "i2s")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => `${l.from.slotId}>${l.to.slotId}`)).toEqual(["bclk>bclk", "ws>ws", "dout>din"]);
  });

  it("two senders are refused; a duplex port reads a microphone", () => {
    expect(codes(mcu("out"), mic, "i2s")).toContain("error:audio_direction");
    expect(connection(mcu("duplex"), mic, "i2s")!.state).toBe("valid");
  });

  it("two clock targets do not pair, older master/slave ports pair with controller/target, and PCM against I2S is refused", () => {
    expect(connection(amp, mic, "i2s")).toBeUndefined();
    expect(areRolesCompatible("i2s", "master", "target")).toBe(true);
    const pcmModem = mod("stub-modem", PCM({ clockRole: "controller", direction: "duplex" }));
    expect(codes(pcmModem, amp, "i2s")).toContain("error:audio_format");
  });
});

describe("DVP cameras", () => {
  const data = (n: number, base: number) => Array.from({ length: n }, (_, i) => pin(base + i));
  const ov2640 = mod("stub-ov2640", DVP({ role: "camera", dataWidth: 10, data: data(10, 1), pclk: pin(20), vsync: pin(21), href: pin(22), xclk: pin(23), pclkHz: [6e6, 36e6] }));
  const esp = mod("stub-esp32", DVP({ role: "host", dataWidth: 8, data: data(8, 1), pclk: pin(20), vsync: pin(21), href: pin(22), xclk: pin(23), pclkHz: [0, 40e6] }));

  it("a 10-bit camera lands its upper 8 bits on an 8-bit host, with a warning", () => {
    const c = connection(ov2640, esp, "dvp")!;
    expect(c.state).toBe("warning");
    const links = c.subLinks.map((l) => `${l.from.slotId}>${l.to.slotId}`);
    expect(links.slice(0, 8)).toEqual(["d9>d7", "d8>d6", "d7>d5", "d6>d4", "d5>d3", "d4>d2", "d3>d1", "d2>d0"]);
    expect(links.slice(8)).toEqual(["pclk>pclk", "vsync>vsync", "href>href", "xclk>xclk"]);
    expect(c.diagnostics.map((d) => d.code)).toEqual(["dvp_width"]);
  });

  it("two cameras do not pair; a data pin count that is not the width is refused", () => {
    expect(connection(ov2640, ov2640, "dvp")).toBeUndefined();
    expect(() => DVP({ role: "camera", dataWidth: 8, data: data(7, 1) })).toThrow(/7 data pins/);
  });
});

describe("wireless", () => {
  it("802.15.4 radios pair when they share a stack; Zigbee against Thread is refused", () => {
    const c6 = mod("stub-c6", [IEEE802154({ stacks: ["zigbee", "thread"], zigbeeRoles: ["coordinator", "router", "end_device"] })]);
    const thread = mod("stub-thread", [IEEE802154({ stacks: ["thread", "matter"] })]);
    const zigbee = mod("stub-zigbee", [IEEE802154({ stacks: ["zigbee"], zigbeeRoles: ["end_device"] })]);
    expect(connection(c6, thread, "ieee802154")!.state).toBe("valid");
    expect(codes(thread, zigbee, "ieee802154")).toEqual(["error:wireless_stack"]);
    expect(codes(zigbee, zigbee, "ieee802154")).toEqual(["warning:zigbee_roles"]);
    const subGhz = mod("stub-868", [IEEE802154({ stacks: ["zigbee"], bands: ["sub_ghz_868"] })]);
    expect(codes(c6, subGhz, "ieee802154")).toEqual(expect.arrayContaining(["error:wireless_band"]));
    expect(c6.interfaces[0]!.domain).toBe("network");
  });

  it("a Wi-Fi client pairs with an access point in a shared band", () => {
    const client = mod("stub-client", [WiFi({ standards: ["b", "g", "n"], bands: ["2.4GHz"] })]);
    const ap = mod("stub-ap", [WiFi({ standards: ["a", "n", "ac", "ax"], bands: ["2.4GHz", "5GHz"], roles: ["access_point"] })]);
    const ap5 = mod("stub-ap5", [WiFi({ standards: ["a", "ac"], roles: ["access_point"] })]);
    expect(connection(client, ap, "wifi")!.state).toBe("valid");
    expect(codes(client, ap5, "wifi")).toEqual(["error:wireless_band"]);
    expect(connection(client, client, "wifi")).toBeUndefined();
    expect(() => WiFi({ standards: ["n"] })).toThrow(/more than one band/);
  });

  it("Bluetooth Classic against LE-only is refused; a central pairs with a peripheral", () => {
    const le = mod("stub-le", [Bluetooth({ version: "5.0", modes: ["le"], roles: ["peripheral"] })]);
    const classic = mod("stub-classic", [Bluetooth({ version: "2.1", modes: ["classic"] })]);
    const central = mod("stub-central", [Bluetooth({ version: "5.3", modes: ["classic", "le"], roles: ["central"] })]);
    expect(codes(le, classic, "bluetooth")).toEqual(["error:wireless_stack"]);
    expect(connection(central, le, "bluetooth")!.state).toBe("valid");
  });
});

describe("SD and USB", () => {
  const slot = mod("stub-slot", SDCard({ role: "host", form: "microsd", modes: ["spi", "sd_1bit", "sd_4bit"], capacityClasses: ["sdsc", "sdhc"], clk: pin(5), cmd: pin(3), dat: [pin(7), pin(8), pin(1), pin(2)], cd: pin(9) }));
  const card = (cls: "sdhc" | "sdxc", form: "microsd" | "sd" = "microsd") =>
    mod(`stub-${cls}`, SDCard({ role: "card", form, modes: ["spi", "sd_4bit", "uhs_i"], capacityClasses: [cls], clk: pin(5), cmd: pin(3), dat: [pin(7), pin(8), pin(1), pin(2)] }));

  it("a microSDHC card reads in a microSD slot; SDXC in an SDHC slot and a full-size card are refused", () => {
    const c = connection(slot, card("sdhc"), "sd_card")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => `${l.from.slotId}>${l.to.slotId}`)).toEqual(["clk>clk", "cmd>cmd", "dat0>dat0", "dat1>dat1", "dat2>dat2", "dat3>dat3"]);
    expect(codes(slot, card("sdxc"), "sd_card")).toEqual(["error:sd_capacity"]);
    expect(codes(slot, card("sdhc", "sd"), "sd_card")).toEqual(["error:sd_form"]);
  });

  it("USB: a host pairs with a device and falls back to the slower speed; older bidirectional ports still pair", () => {
    const host = mod("stub-usb-host", USB({ role: "host", speeds: ["low", "full", "high"], dp: pin(1), dm: pin(2) }));
    const dev = mod("stub-usb-dev", USB({ role: "device", speeds: ["full"], dp: pin("D+"), dm: pin("D-") }));
    const c = connection(host, dev, "usb")!;
    expect(c.subLinks.map((l) => `${l.from.slotId}>${l.to.slotId}`)).toEqual(["d_p>d_p", "d_n>d_n"]);
    expect(c.diagnostics.map((d) => `${d.severity}:${d.code}`)).toEqual(["info:usb_speed"]);
    expect(areRolesCompatible("usb", "bidirectional", "host")).toBe(true);
    expect(areRolesCompatible("usb", "dual_role", "dual_role")).toBe(true);
    expect(areRolesCompatible("usb", "host", "host")).toBe(false);
  });
});

describe("LEDs, relays and storage", () => {
  const red = Led({
    id: "stub-red-led",
    name: "Red LED",
    emitter: { color: "red", wavelength_nm: 625, wavelength_kind: "dominant", forward_voltage_V: [1.8, 2.4], test_current_mA: 20, max_current_mA: 30 },
    pins: { anode: 2, cathode: 1 },
  });

  it("Led() gives passive terminals, an led_drive composite per terminal, the led trait and component.led", () => {
    expect(red.categories).toEqual(["component.led"]);
    expect(red.interfaces.map((i) => `${i.id}:${i.pin ?? ""}`)).toEqual(["anode:2", "cathode:1", "led_anode:", "led_cathode:"]);
    expect(red.traits?.[0]).toMatchObject({ type: "led", params: { kind: "indicator", emitters: [{ color: "red", anode: "anode", cathode: "cathode" }] } });
  });

  it("a sinking LED driver channel drives the cathode; a driver settable above the LED's maximum is a warning", () => {
    const driver = (currentmA: number | [number, number]) => mod("stub-led-driver", LedDrive({ role: "driver", mode: "sink", output: pin(4), currentmA }));
    const c = connection(driver(20), red, "led_drive")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => `${l.from.slotId}>${l.to.slotId}`)).toEqual(["sink>cathode"]);
    const source = mod("stub-led-source", LedDrive({ role: "driver", mode: "source", output: pin(4), currentmA: 20 }));
    expect(connection(source, red, "led_drive")!.subLinks.map((l) => l.to.interfaceId)).toEqual(["anode"]);
    expect(codes(driver([0, 50]), red, "led_drive")).toEqual(["warning:led_drive_current"]);
    expect(codes(driver(40), red, "led_drive")).toEqual(["error:param_range_disjoint"]);
  });

  it("on a board, an LED and a sinking driver channel on one net derive an led_drive link and no net faults", () => {
    const driver = mod("stub-led-driver", LedDrive({ role: "driver", mode: "sink", output: pin(4), currentmA: [0, 25] }));
    const board = defineModule({
      id: "stub-led-board",
      name: "LED board",
      interfaces: [Net({ id: "led1_k" })],
      children: [
        { id: "d1", moduleDefId: red.id },
        { id: "u1", moduleDefId: driver.id },
      ],
      links: netLinks("led1_k", ["d1:cathode", "u1:led_drive_sink"]),
    });
    const lookup = (id: string) => (id === red.id ? red : id === driver.id ? driver : undefined);
    const r = checkSystem(board, lookup);
    const derived = r.links.filter((l) => l.derived);
    expect(derived.map((l) => l.protocol)).toContain("led_drive");
    expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("ledTrait checks the emitters a kind implies", () => {
    expect(() => ledTrait({ kind: "rgb", emitters: [{ color: "red" }] })).toThrow(/3 emitters/);
  });

  it("relayTrait reads poles and throws from the form; the pins are passive terminals with their functions", () => {
    const t = relayTrait({ kind: "electromechanical", form: "1C", coil: { voltage_V: 5, resistance_ohm: 70 }, contacts: { ratings: [{ voltage_V: 250, current_A: 10, current: "ac", load: "resistive" }, { voltage_V: 30, current_A: 10, current: "dc" }] } });
    expect(t.params).toMatchObject({ poles: 1, throws: 2 });
    expect(() => relayTrait({ kind: "solid_state", form: "1C", coil: { voltage_V: [3, 32] }, contacts: { ratings: [{ voltage_V: 240, current_A: 2, current: "ac" }] } })).toThrow(/form A or B/);
    expect(() => relayTrait({ kind: "reed", form: "SPDT", coil: { voltage_V: 5 }, contacts: { ratings: [{ voltage_V: 100, current_A: 0.5, current: "dc" }] } })).toThrow(/poles then/);
    const pins = [...RelayCoil({ plus: 1, minus: 2 }), ...RelayContacts({ pole: 1, com: 3, no: 4, nc: 5 })];
    expect(pins.map((p) => `${p.id}/${p.capabilities![0]}`)).toEqual(["coil_plus/relay_coil_plus", "coil_minus/relay_coil_minus", "p1_com/relay_com", "p1_no/relay_no", "p1_nc/relay_nc"]);
    expect(pins.every((p) => p.protocols[0]!.type === "passive")).toBe(true);
  });

  it("storageTrait states volatility from the medium and checks capacity", () => {
    expect(storageTrait({ medium: "fram", capacity_bytes: 32768, interfaces: ["i2c"] }).params.volatile).toBe(false);
    expect(storageTrait({ medium: "psram", capacity_bytes: 8 * 2 ** 20, interfaces: ["quad_spi"] }).params.volatile).toBe(true);
    expect(() => storageTrait({ medium: "ssd", capacity_bytes: 0, interfaces: ["nvme"] })).toThrow(/capacity_bytes/);
  });
});
