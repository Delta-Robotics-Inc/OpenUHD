/**
 * RS-485, RS-232, SWD, PPM, infrared remotes, AC mains input and
 * switched inductive loads.
 */
import { describe, expect, it } from "vitest";
import { validatePair } from "../src/drc/index.js";
import {
  AcPower,
  InductiveDrive,
  InductiveLoad,
  InfraredRemote,
  PPM,
  PowerOut,
  RS232,
  RS485,
  SWD,
  UART,
  defineModule,
} from "../src/protocols/index.js";
import type { InterfaceDef, ModuleDef } from "../src/types/index.js";

const mod = (id: string, interfaces: InterfaceDef[]): ModuleDef => defineModule({ id, name: id, interfaces });
const connection = (a: ModuleDef, b: ModuleDef, protocol: string) => validatePair(a, b).connections.find((c) => c.protocol === protocol);
const diags = (a: ModuleDef, b: ModuleDef, protocol: string) => connection(a, b, protocol)?.diagnostics ?? [];
const codes = (a: ModuleDef, b: ModuleDef, protocol: string) => diags(a, b, protocol).map((d) => `${d.severity}:${d.code}`);
const links = (a: ModuleDef, b: ModuleDef, protocol: string) => connection(a, b, protocol)!.subLinks.map((l) => `${l.from.interfaceId}->${l.to.interfaceId}`);

describe("RS-485", () => {
  const half = (id: string) => mod(id, RS485({ a: { pin: 1, name: "A" }, b: { pin: 2, name: "B" }, bitRateBps: [9600, 1_000_000], termination: "switchable", carries: "Modbus RTU" }));
  const full = (id: string) => mod(id, RS485({ duplex: "full", y: { pin: 1 }, z: { pin: 2 }, a: { pin: 3 }, b: { pin: 4 } }));

  it("a half-duplex port pairs A to A and B to B", () => {
    const c = connection(half("x"), half("y"), "rs485")!;
    expect(c.state).toBe("valid");
    expect(links(half("x"), half("y"), "rs485")).toEqual(["rs485_a->rs485_a", "rs485_b->rs485_b"]);
    expect(half("x").interfaces.at(-1)!.traits![0].params).toMatchObject({ duplex: "half", termination: "switchable", carries: "Modbus RTU" });
  });

  it("two full-duplex ports cross their pairs: Y/Z to A/B", () => {
    expect(links(full("x"), full("y"), "rs485")).toEqual(["rs485_tx_p->rs485_rx_p", "rs485_tx_n->rs485_rx_n", "rs485_rx_p->rs485_tx_p", "rs485_rx_n->rs485_tx_n"]);
  });

  it("half against full duplex is an error; a logical port pairs as a whole", () => {
    expect(codes(half("x"), full("y"), "rs485")).toContain("error:rs485_duplex");
    expect(connection(mod("a", RS485({ id: "rs485" })), mod("b", RS485({})), "rs485")!.state).toBe("valid");
    expect(() => RS485({ y: { pin: 1 }, z: { pin: 2 } })).toThrow(/full-duplex/);
  });
});

describe("RS-232", () => {
  const port = (id: string, role: "dte" | "dce") => mod(id, RS232({ role, txd: { pin: 3 }, rxd: { pin: 2 }, rts: { pin: 7 }, cts: { pin: 8 }, ground: "gnd" }).concat([{ id: "gnd", domain: "electrical", exposed: true, protocols: [{ type: "power", roles: ["ground"] }] }]));

  it("a DTE and a DCE pair straight through", () => {
    expect(connection(port("pc", "dte"), port("modem", "dce"), "rs232")!.state).toBe("valid");
    expect(links(port("pc", "dte"), port("modem", "dce"), "rs232")).toEqual(["rs232_txd->rs232_txd", "rs232_rxd->rs232_rxd", "rs232_rts->rs232_rts", "rs232_cts->rs232_cts", "gnd->gnd"]);
  });

  it("two DTEs pair crossed and the check asks for a null modem", () => {
    expect(links(port("a", "dte"), port("b", "dte"), "rs232").slice(0, 4)).toEqual(["rs232_txd->rs232_rxd", "rs232_rxd->rs232_txd", "rs232_rts->rs232_cts", "rs232_cts->rs232_rts"]);
    expect(codes(port("a", "dte"), port("b", "dte"), "rs232")).toEqual(["warning:rs232_null_modem"]);
  });

  it("does not pair with a logic-level UART", () => {
    const uart = mod("uart", UART({ rx: { pin: 1 }, tx: { pin: 2 } }));
    expect(validatePair(port("pc", "dte"), uart).connections.filter((c) => c.protocol === "rs232" || c.protocol === "uart")).toEqual([]);
  });
});

describe("SWD", () => {
  it("a probe pairs with a target signal by signal, and the levels are compared", () => {
    const target = mod("mcu", SWD({ role: "target", swdio: { pin: 24 }, swclk: { pin: 25 }, nreset: { pin: 26 }, voltageV: 3.3 }));
    const probe = mod("probe", SWD({ role: "probe", swdio: { pin: 2 }, swclk: { pin: 4 }, swo: { pin: 6 }, nreset: { pin: 10 }, voltageV: [1.2, 5] }));
    const c = connection(target, probe, "swd")!;
    expect(c.state).toBe("valid");
    expect(links(target, probe, "swd")).toEqual(["swd_swdio->swd_swdio", "swd_swclk->swd_swclk", "swd_nreset->swd_nreset"]);
    const fiveV = mod("old", SWD({ role: "target", swdio: { pin: 1 }, swclk: { pin: 2 }, voltageV: 5 }));
    expect(codes(fiveV, mod("p18", SWD({ role: "probe", swdio: { pin: 1 }, swclk: { pin: 2 }, voltageV: [1.2, 3.6] })), "swd")).toContain("error:param_range_disjoint");
    expect(validatePair(mod("t1", SWD({ role: "target" })), mod("t2", SWD({ role: "target" }))).connections.filter((x) => x.protocol === "swd")).toEqual([]);
  });
});

describe("PPM", () => {
  const rx = (channels: number, polarity: "positive" | "negative" = "positive") => mod(`rx${channels}${polarity}`, PPM({ role: "output", signal: { pin: 1 }, channels, polarity }));
  const fc = mod("fc", PPM({ role: "input", signal: { pin: 5 }, channels: [1, 12], polarity: "either" }));

  it("an output pairs with an input; more channels than it decodes is a warning", () => {
    expect(connection(rx(8), fc, "ppm")!.state).toBe("valid");
    expect(diags(rx(16), fc, "ppm").map((d) => d.message)).toEqual(["the output sends 16 channels; the input decodes 12, so the last 4 are lost"]);
  });

  it("opposite polarities do not work", () => {
    const pos = mod("pos", PPM({ role: "input", channels: [1, 8], polarity: "positive" }));
    expect(codes(rx(8, "negative"), pos, "ppm")).toEqual(["error:ppm_polarity"]);
  });
});

describe("infrared remotes", () => {
  const remote = (carrier: number, protocols?: string[]) => mod(`remote${carrier}`, [InfraredRemote({ role: "transmitter", carrierKHz: carrier, protocols, wavelengthNm: 940 })]);
  const receiver = mod("vs1838b", [InfraredRemote({ role: "receiver", carrierKHz: 38, wavelengthNm: [850, 1050] })]);

  it("a 38 kHz remote reaches a 38 kHz receiver, in the network domain", () => {
    expect(receiver.interfaces[0].domain).toBe("network");
    expect(connection(remote(38, ["NEC"]), receiver, "ir_remote")!.state).toBe("valid");
  });

  it("a carrier a little off shortens the range; far off it does not work", () => {
    expect(codes(remote(40), receiver, "ir_remote")).toEqual(["warning:ir_link"]);
    expect(codes(remote(56), receiver, "ir_remote")).toEqual(["error:ir_link"]);
  });

  it("compares coding protocols and wavelengths when both state them", () => {
    const rc5 = mod("rc5", [InfraredRemote({ role: "receiver", carrierKHz: [36, 38], protocols: ["RC5"] })]);
    expect(codes(remote(38, ["NEC"]), rc5, "ir_remote")).toEqual(["error:ir_link"]);
    const vis = mod("vis", [InfraredRemote({ role: "transmitter", carrierKHz: 38, wavelengthNm: 650 })]);
    expect(codes(vis, receiver, "ir_remote")).toEqual(["warning:ir_link"]);
  });
});

describe("AC mains", () => {
  const supply = mod("psu", AcPower({ role: "input", voltageV: [100, 240], frequencyHz: [50, 60], maxCurrentA: 1.5, powerW: 120, plug: "IEC 60320 C14", earth: true }));
  const cord = (plug: string, earth = true) => mod(`cord-${plug}`, AcPower({ role: "output", voltageV: 120, frequencyHz: 60, maxCurrentA: 10, plug, earth }));

  it("an inlet takes the mains it is rated for through a matching plug", () => {
    expect(connection(supply, cord("IEC C13"), "ac_power")!.state).toBe("valid");
  });

  it("another plug, missing earth or voltage out of range is refused; DC never pairs", () => {
    expect(codes(supply, cord("C5"), "ac_power")).toEqual(["error:ac_power"]);
    expect(diags(supply, cord("C13", false), "ac_power").map((d) => d.message)).toEqual(["the input needs protective earth; the outlet has none"]);
    expect(codes(supply, mod("eu", AcPower({ role: "output", voltageV: 400, frequencyHz: 50 })), "ac_power")).toContain("error:param_range_disjoint");
    expect(validatePair(supply, mod("dc", [PowerOut({ id: "out", voltageV: 120, maxCurrentA: 10 })])).connections).toEqual([]);
  });
});

describe("switched inductive loads", () => {
  const valve = (current: number, extra: Partial<Parameters<typeof InductiveLoad>[0]> = {}) =>
    mod(`valve${current}`, InductiveLoad({ kind: "valve", plus: { pin: 1 }, minus: { pin: 2 }, ratedVoltageV: 12, coilCurrentA: current, suppression: "none", ...extra }));
  const hub = (extra: Partial<Parameters<typeof InductiveDrive>[0]> = {}) =>
    mod("hub", InductiveDrive({ id: "solenoid_0", switching: "low_side", toPlus: { pin: 10 }, toMinus: { pin: 11 }, voltageV: 12, maxCurrentA: 0.5, flyback: "internal", ...extra }));

  it("a channel drives a coil it is rated for, terminal to terminal", () => {
    const c = connection(hub(), valve(0.4), "inductive_load")!;
    expect(c.state).toBe("valid");
    expect(links(hub(), valve(0.4), "inductive_load")).toEqual(["solenoid_0_to_plus->coil_coil_plus", "solenoid_0_to_minus->coil_coil_minus"]);
  });

  it("derives the current from the resistance; too much current is an error", () => {
    const c = valve(0, { coilCurrentA: undefined, coilResistanceOhm: 12 });
    expect(c.interfaces.at(-1)!.parameters!.find((p) => p.id === "coil_current")!.value).toBe(1);
    expect(diags(hub(), c, "inductive_load")[0].message).toBe("the coil draws 1 A; the channel is rated for 0.5 A");
  });

  it("takes leads with no designator", () => {
    const leads = InductiveLoad({ kind: "solenoid", plus: { id: "lead_red", name: "Red lead" }, minus: { id: "lead_black" }, ratedVoltageV: 12, suppression: "built_in" });
    expect(leads.map((i) => [i.id, i.pin, i.protocols[0].type])).toEqual([["lead_red", undefined, "inductive_terminal"], ["lead_black", undefined, "inductive_terminal"], ["coil", undefined, "inductive_load"]]);
    expect(connection(hub(), mod("leads", leads), "inductive_load")!.state).toBe("valid");
  });

  it("warns when nothing clamps the spike, and when an H-bridge drives a polarised coil", () => {
    expect(codes(hub({ flyback: "none" }), valve(0.4), "inductive_load")).toEqual(["warning:inductive_load"]);
    expect(codes(hub({ switching: "h_bridge" }), valve(0.4, { suppression: "diode", polarized: true }), "inductive_load")).toEqual(["warning:inductive_load"]);
    expect(codes(hub(), valve(0.4, { ratedVoltageV: 24 }), "inductive_load")).toContain("error:param_range_disjoint");
  });
});
