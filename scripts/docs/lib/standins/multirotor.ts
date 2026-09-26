/**
 * Stand-in test data for a multirotor, derived from the model so documents
 * have plausible curves before anything is measured. Every file is written
 * with status "standin", lists the model queries it was derived from, and
 * states each assumption the model could not supply. The build never
 * overwrites a file whose status is "measured".
 *
 * Model inputs: the motor maker's full thrust table (performance.thrust_tests,
 * interpolated row to row by src/system/propulsion.ts), motor idle current, battery voltage / capacity / cell count, part
 * masses, avionics supply figures (O4 min supply power, GNSS supply current).
 */
import type { ModuleDef } from "../../../../src/types/index.js";
import { category } from "../model.js";
import { massBreakdown } from "../derived.js";
import { fullThrottle, thrustAtThrottle, thrustAtThrust, thrustTests } from "../../../../src/system/propulsion.js";
import type { DocContext } from "../values.js";
import type { TestData } from "../testdata.js";

const GEN = "scripts/docs/lib/standins/multirotor.ts";
const r = (x: number, d = 2) => Number(x.toFixed(d));

function first(ctx: DocContext, cat: string): ModuleDef | undefined {
  return ctx.scene.assembly.instances.find((i) => i.kind === "module" && category(i.def) === cat)?.def;
}

export function standins(ctx: DocContext): TestData[] {
  const system = ctx.sys.system.id;
  const motor = first(ctx, "motor");
  const battery = first(ctx, "battery");
  if (!motor || !battery) return [];
  const motorCount = ctx.scene.assembly.instances.filter((i) => i.kind === "module" && category(i.def) === "motor").length;
  const test = thrustTests(motor)[0];
  if (!test) return [];
  const bOut = battery.interfaces.find((i) => i.parameters?.some((p) => p.id === "capacity"))!;
  const bp = (id: string) => bOut.parameters!.find((p) => p.id === id)!.value as number;
  const V = bp("voltage");
  const cap = bp("capacity");
  const cells = bp("cell_count");
  const bq = (id: string) => `def:${battery.id}:interfaces[id=${bOut.id}].parameters[id=${id}].value`;
  const tq = (k: string) => `def:${motor.id}:traits[type=performance].params.thrust_tests[0].${k}`;

  // everything propulsive comes from the maker's rows, interpolated linearly between them
  const top = fullThrottle(test);
  const Tfull = top.thrust_g;
  const Ifull = top.current_A;
  const at = (throttlePct: number) => thrustAtThrottle(test, throttlePct);
  /** Pack current for all motors producing `thrustG` each: table power at that thrust over the pack's nominal voltage. */
  const packCurrentFor = (thrustG: number) => {
    const row = thrustAtThrust(test, thrustG);
    return row ? (motorCount * row.power_W) / V : undefined;
  };
  const currentAt = (t: number) => at(t * 100).current_A;

  // avionics: O4 minimum supply power from the model; GNSS supply current; FC + RX assumed
  const o4 = first(ctx, "video");
  const o4W = (o4?.interfaces.find((i) => i.id === "vcc")?.parameters?.find((p) => p.id === "min_supply_power")?.value as number) ?? 0;
  const gnss = first(ctx, "gnss");
  const gnssmA = (gnss?.domains?.find((d) => d.domain === "electrical")?.metadata as any)?.supply_current_mA ?? 0;
  const FC_RX_W = 2.5; // assumption: FC + receiver draw, not in the model
  const BEC_EFF = 0.85; // assumption
  const avionicsW = (o4W + (gnssmA / 1000) * 5 + FC_RX_W) / BEC_EFF;
  const avionicsA = avionicsW / V;

  // mass: stated masses plus an assumed allowance for parts without one
  const mb = massBreakdown(ctx);
  const known = mb.filter((g) => g.weight !== undefined).reduce((s, g) => s + g.count * g.weight!, 0);
  const missing = mb.filter((g) => g.weight === undefined);
  const FRAME_ALLOWANCE_G = 125; // assumption: frame, top plate, hardware, wiring
  const auw = known + FRAME_ALLOWANCE_G;

  // hover: the table's electrical power at thrust = AUW / motors (interpolated between rows)
  const hoverT = auw / motorCount;
  const hoverIprop = packCurrentFor(hoverT) ?? motorCount * Ifull;
  const hoverI = hoverIprop + avionicsA;
  const USABLE = 0.8; // assumption: usable fraction of rated capacity
  const minutes = (I: number) => ((cap / 1000) * USABLE * 60) / I;

  const base = {
    $schema: "uhd-test-data/1",
    status: "standin" as const,
    subject: { system, modules: [motor.id, battery.id] },
  };
  const derivedFrom = [tq("rows"), tq("propeller"), tq("supply_V"), bq("voltage"), bq("capacity")];
  const assumptions = [
    `motor figures interpolate linearly between the ${test.rows.length} rows of the maker's table (0 at 0 % throttle); pack current = table electrical power ÷ ${V} V nominal`,
    `maker's table used the ${test.propeller} prop at ${test.supply_V} V, not the fitted propeller`,
    `avionics: DJI O4 minimum supply power ${o4W} W, GNSS ${gnssmA} mA at 5 V, FC + receiver ${FC_RX_W} W (assumed), BEC efficiency ${BEC_EFF * 100} % (assumed)`,
    `all-up weight = ${r(known, 1)} g of stated masses + ${FRAME_ALLOWANCE_G} g assumed for the ${missing.reduce((s, g) => s + g.count, 0)} parts without a mass (frame, top plate, hardware; see derived:mass.missing_count)`,
  ];
  const generatedAt = new Date().toISOString().slice(0, 10);

  // 1 throttle sweep (static)
  const sweep: TestData = {
    ...base,
    id: "throttle-sweep",
    title: "Static thrust and current vs throttle (whole vehicle)",
    conditions: [
      { name: "Supply", value: test.supply_V, unit: "V" },
      { name: "Propeller (maker's test)", value: test.propeller, unit: "" },
      { name: "Motors", value: motorCount, unit: "" },
    ],
    provenance: { method: "Stand-in: the motor maker's thrust table row by row, scaled to all motors, plus avionics draw.", derivedFrom, assumptions, generator: GEN, generatedAt },
    columns: [
      { id: "throttle", label: "Throttle", unit: "%" },
      { id: "thrust_motor", label: "Thrust per motor", unit: "g" },
      { id: "current_motor", label: "Current per motor", unit: "A" },
      { id: "thrust_total", label: "Total thrust", unit: "g" },
      { id: "current_total", label: "Total current", unit: "A" },
      { id: "power_total", label: "Electrical power", unit: "W" },
    ],
    rows: Array.from({ length: 11 }, (_, i) => {
      const t = i / 10;
      const Tm = at(t * 100).thrust_g;
      const Im = currentAt(t);
      const It = motorCount * Im + avionicsA;
      return [i * 10, r(Tm, 0), r(Im, 2), r(motorCount * Tm, 0), r(It, 1), r(It * test.supply_V, 0)];
    }),
    summary: [
      { id: "thrust_total_full", label: "Total static thrust at 100 %", value: r(motorCount * Tfull, 0), unit: "g" },
      { id: "current_total_full", label: "Total current at 100 %", value: r(motorCount * Ifull + avionicsA, 1), unit: "A" },
    ],
  };

  // 2 hover current
  const hover: TestData = {
    ...base,
    id: "hover-current",
    title: "Hover current and all-up-weight sensitivity",
    conditions: [
      { name: "Battery nominal", value: V, unit: "V" },
      { name: "All-up weight (estimate)", value: r(auw, 0), unit: "g" },
    ],
    provenance: { method: "Stand-in: hover thrust = AUW / motors; motor power interpolated from the maker's thrust table at that thrust; plus avionics.", derivedFrom: [...derivedFrom, "derived:mass.known_total"], assumptions, generator: GEN, generatedAt },
    columns: [
      { id: "auw", label: "All-up weight", unit: "g" },
      { id: "thrust_motor", label: "Hover thrust per motor", unit: "g" },
      { id: "current_total", label: "Hover current", unit: "A" },
      { id: "power_total", label: "Hover power", unit: "W" },
    ],
    rows: [-100, -50, 0, 50, 100, 150].map((d) => {
      const w = auw + d;
      const I = (packCurrentFor(w / motorCount) ?? motorCount * Ifull) + avionicsA;
      return [r(w, 0), r(w / motorCount, 0), r(I, 2), r(I * V, 0)];
    }),
    summary: [
      { id: "auw_g", label: "All-up weight (estimate)", value: r(auw, 0), unit: "g" },
      { id: "hover_current_A", label: "Hover current", value: r(hoverI, 1), unit: "A" },
      { id: "hover_power_W", label: "Hover power", value: r(hoverI * V, 0), unit: "W" },
      { id: "avionics_current_A", label: "Avionics current", value: r(avionicsA, 2), unit: "A" },
    ],
  };

  // 3 flight time
  const regimes: [string, number][] = [
    ["Hover", hoverI],
    ["Cruise (1.5 × hover thrust)", (packCurrentFor(1.5 * hoverT) ?? motorCount * Ifull) + avionicsA],
    ["Freestyle mix", 0],
    ["Full throttle", motorCount * Ifull + avionicsA],
  ];
  const mix = 0.75 * regimes[1][1] + 0.2 * (motorCount * at(50).current_A + avionicsA) + 0.05 * regimes[3][1];
  regimes[2][1] = mix;
  const flight: TestData = {
    ...base,
    id: "flight-time",
    title: "Flight-time estimate by regime",
    conditions: [
      { name: "Capacity", value: cap, unit: "mAh" },
      { name: "Usable fraction (assumed)", value: USABLE * 100, unit: "%" },
      { name: "Freestyle mix", value: "75 % cruise, 20 % half throttle, 5 % full", unit: "" },
    ],
    provenance: { method: "Stand-in: time = capacity × usable fraction ÷ average current. Static-thrust currents: pessimistic for forward flight.", derivedFrom: [...derivedFrom, "test:hover-current:summary[id=hover_current_A].value"], assumptions: [...assumptions, `usable capacity ${USABLE * 100} % of rated`], generator: GEN, generatedAt },
    columns: [
      { id: "regime", label: "Regime", unit: "" },
      { id: "current", label: "Average current", unit: "A" },
      { id: "minutes", label: "Flight time", unit: "min" },
    ],
    rows: regimes.map(([n, I]) => [n, r(I, 1), r(minutes(I), 1)]),
    summary: [
      { id: "hover_min", label: "Hover", value: r(minutes(hoverI), 1), unit: "min" },
      { id: "mix_min", label: "Freestyle mix", value: r(minutes(mix), 1), unit: "min" },
    ],
  };

  // 4 thrust-to-weight
  const volts = [cells * 4.2, V, cells * 3.5];
  const twr: TestData = {
    ...base,
    id: "thrust-to-weight",
    title: "Thrust-to-weight ratio vs pack voltage",
    conditions: [
      { name: "All-up weight (estimate)", value: r(auw, 0), unit: "g" },
      { name: "Reference supply (maker's test)", value: test.supply_V, unit: "V" },
    ],
    provenance: { method: "Stand-in: static thrust scaled with (V / test V)² (thrust ~ rpm², rpm ~ V), divided by the AUW estimate.", derivedFrom: [...derivedFrom, "derived:mass.known_total"], assumptions, generator: GEN, generatedAt },
    columns: [
      { id: "voltage", label: "Pack voltage", unit: "V" },
      { id: "thrust_total", label: "Total static thrust", unit: "g" },
      { id: "twr", label: "Thrust-to-weight", unit: "" },
    ],
    rows: volts.map((v) => {
      const T = motorCount * Tfull * (v / test.supply_V) ** 2;
      return [r(v, 1), r(T, 0), r(T / auw, 1)];
    }),
    summary: [{ id: "twr_nominal", label: "Thrust-to-weight at nominal voltage", value: r((motorCount * Tfull * (V / test.supply_V) ** 2) / auw, 1), unit: "" }],
  };

  // 5 ESC temperature over a punch-out
  const AMB = 25, RTH = 2.0, CTH = 20, RLOSS = 0.004, SW = 1.5; // assumptions
  const esc = first(ctx, "esc");
  const temps: (number | string)[][] = [];
  let T = AMB + 8;
  const thrOf = (s: number) => (s >= 2 && s < 6 ? 1 : 0.35);
  for (let s = 0; s <= 30; s += 0.5) {
    const th = thrOf(s);
    const Ich = currentAt(th);
    const P = motorCount * (Ich ** 2 * RLOSS + SW * th);
    if (s > 0) T += ((P - (T - AMB) / RTH) / CTH) * 0.5;
    temps.push([s, th * 100, r(Ich, 1), r(T, 1)]);
  }
  const peak = Math.max(...temps.map((x) => Number(x[3])));
  const escTemp: TestData = {
    ...base,
    id: "esc-temp-punchout",
    title: "ESC board temperature over a 4 s punch-out",
    subject: { system, modules: [esc?.id ?? "esc", motor.id] },
    conditions: [
      { name: "Ambient", value: AMB, unit: "°C" },
      { name: "Punch-out", value: "100 % from 2 s to 6 s, 35 % otherwise", unit: "" },
    ],
    provenance: {
      method: "Stand-in: lumped thermal model C·dT/dt = P − (T − ambient)/R with conduction and switching losses per channel.",
      derivedFrom: [tq("rows"), ...(esc ? [`def:${esc.id}:interfaces[id=motor_1].parameters[id=max_current].value`] : [])],
      assumptions: [
        `thermal resistance ${RTH} K/W and capacity ${CTH} J/K (board in prop wash) — not in the model`,
        `effective conduction resistance ${RLOSS * 1000} mΩ per channel and ${SW} W switching loss per channel at full throttle — not in the model`,
        "starting 8 °C above ambient after the previous flight segment",
      ],
      generator: GEN,
      generatedAt,
    },
    columns: [
      { id: "time", label: "Time", unit: "s" },
      { id: "throttle", label: "Throttle", unit: "%" },
      { id: "current_channel", label: "Current per channel", unit: "A" },
      { id: "temperature", label: "ESC temperature", unit: "°C" },
    ],
    rows: temps,
    summary: [{ id: "peak_C", label: "Peak temperature", value: r(peak, 1), unit: "°C" }],
  };

  // 6 battery discharge
  const OCV = [4.2, 4.08, 3.98, 3.9, 3.84, 3.8, 3.77, 3.74, 3.7, 3.62, 3.45]; // generic LiPo curve (assumption)
  const RCELL = 0.004; // assumption
  const dis: TestData = {
    ...base,
    id: "battery-discharge",
    title: "Pack voltage vs capacity used",
    subject: { system, modules: [battery.id] },
    conditions: [
      { name: "Cells", value: cells, unit: "" },
      { name: "Hover current (stand-in)", value: r(hoverI, 1), unit: "A" },
      { name: "Freestyle average (stand-in)", value: r(mix, 1), unit: "A" },
    ],
    provenance: {
      method: "Stand-in: generic LiPo open-circuit curve per cell minus I·R sag, scaled to the pack.",
      derivedFrom: [bq("cell_count"), bq("capacity"), "test:hover-current:summary[id=hover_current_A].value"],
      assumptions: ["generic LiPo open-circuit voltage curve", `internal resistance ${RCELL * 1000} mΩ per cell — not in the model`],
      generator: GEN,
      generatedAt,
    },
    columns: [
      { id: "used", label: "Capacity used", unit: "mAh" },
      { id: "v_rest", label: "Open circuit", unit: "V" },
      { id: "v_hover", label: "At hover current", unit: "V" },
      { id: "v_mix", label: "At freestyle average", unit: "V" },
    ],
    rows: OCV.map((v, i) => [r((cap * i) / 10, 0), r(v * cells, 2), r((v - hoverI * RCELL) * cells, 2), r((v - mix * RCELL) * cells, 2)]),
    summary: [{ id: "sag_mix_V", label: "Sag at freestyle average", value: r(mix * RCELL * cells, 2), unit: "V" }],
  };

  return [sweep, hover, flight, twr, escTemp, dis];
}
