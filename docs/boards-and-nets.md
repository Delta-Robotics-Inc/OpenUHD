# Boards, nets and package facts

Status: implemented (PB-824). Code: `src/protocols/net.ts` (`Net`,
`netLinks`, `isNet`), `src/protocols/passive.ts` (`Passive`),
`src/protocols/package.ts` (`pinTable`, `partPackage`,
`pinDesignatorIssues`), `src/system/nets.ts` (membership links and the net
rules), `src/system/derive.ts` (functional links over nets). Tests:
`test/boards.test.ts`, `test/packages.test.ts`; example board:
`test/fixtures/imu-board.ts`.

## Why

A custom PCB is hardware like any other module: it has components, the
conductors between them, and an edge that other hardware plugs into. A tool
that lays out the PCB needs to know which pins are joined and what each
component physically is. Everything else it decides for itself.

UHD already had pairwise links. A board has nets: GND joins fifteen pins, a
3.3 V rail joins a regulator and every load. A net is not a set of pairwise
links (two loads on a rail are not linked to each other), so UHD needed a way
to say "these pins are one conductor" and still check the board.

## What UHD holds, and what it does not

UHD holds facts that are true of the hardware whatever tool is used:

- the board as a module: its components (children), its nets, its edge
  (exports);
- pin designators (`pin`, such as `42` or `"EP"`) on every leaf pin of a
  component;
- the component package as the manufacturer states it: name, pin count,
  pitch, exposed pad, overall size;
- passive values (resistance, capacitance, inductance);
- requirements the board must meet before it is designed: the largest
  outline, regions to keep clear;
- the artifacts a tool produces, as references (format, role, provenance).

UHD never holds tool knowledge:

- footprint or land-pattern names, symbol or library references;
- layer stacks, copper rules, routing, placement;
- CAD feature trees, sketches, document or element ids;
- any field named after a particular tool.

That knowledge belongs to the tool that needs it and lives in that tool's own
files. Which footprint fits a "QFN-56, 0.4 mm pitch" package is the tool's
table, not a field on the part. The test: *could someone with only the UHD
file and its artifact files use this, without running any tool?*

## A board is a module

```
 fixture-imu-board (module)
 ├─ children   u1 RP2040 · u2 BMI270 · u3 TPS63020 · l1 · r1 r2 (FB divider) · r3 r4 (I2C pull-ups)
 ├─ nets       VIN · 3V3 · 1V1 · GND · FB · SW1 · SW2 · SDA · SCL · IMU_INT1   (Net interfaces, not exposed)
 ├─ links      one membership link per pin on a net:  u2:pin_8 ──▶ :v3v3
 └─ exports    power_in (u3 VIN pad) · power_gnd (u3 GND) · swd (u1 SWD)       (the board edge)
```

- **Components are children**, the same `ChildModuleRef`s any assembly uses.
- **A net is a `Net` interface on the board itself** (protocol `net`,
  `exposed: false`). It may state its design voltage.
- **Each pin on a net is joined by a membership link** from the pin
  (`child`) to the net (`self`). `netLinks` writes them:

```ts
import { Net, defineModule, netLinks } from "@deltarobotics/uhd";

export const IMU_BOARD = defineModule({
  id: "fixture-imu-board",
  name: "IMU board",
  interfaces: [
    Net({ id: "v3v3", name: "3V3", voltageV: 3.3 }),
    Net({ id: "gnd", name: "GND" }),
    Net({ id: "sda", name: "SDA" }),
    Net({ id: "scl", name: "SCL" }),
    // …
  ],
  children: [
    { id: "u1", moduleDefId: "rp2040" },
    { id: "u2", moduleDefId: "bosch-bmi270" },
    { id: "u3", moduleDefId: "ti-tps63020dsjr" },
    { id: "r3", moduleDefId: "r-4k7-0402" },
    // …
  ],
  links: [
    ...netLinks("v3v3", ["u3:pin_4", "u3:pin_5", "u1:pin_1", "u2:pin_8", "u2:pin_5", "u2:pin_12", "r3:pin_1"]),
    ...netLinks("gnd", ["u3:pin_2", "u3:pgnd", "u1:pad_gnd", "u2:pin_6", "u2:pin_7", "u2:pin_1"]),
    ...netLinks("sda", ["u1:pin_2", "u2:pin_14", "r3:pin_2"]),
    ...netLinks("scl", ["u1:pin_3", "u2:pin_13", "r4:pin_2"]),
  ],
  exports: [{ id: "power_in", from: { child: "u3", interfaceId: "pin_10" } }],
});
```

Membership link ids are `<net>.<child>.<interface>` (`v3v3.u2.pin_8`).
Members are leaf pins: a membership link to a composite (`u2:i2c`) is
invalid (`net_member_composite`), and so are a net joined to another net
(`net_to_net`) and a link to a child's own net (`net_not_own`).

### The board edge is exports

What plugs into the board from outside is an export of a component's
interface: the VIN pad, a connector composite, a debug port. Export ids share
the board's namespace with its nets, so an export cannot reuse a net's id
(`defineModule` rejects it).

A system that contains the board links to its exports like any other
module's. The board's nets stay inside it: derivation is per module, so check
the board itself with `checkSystem(board, lookup)`, and the system with
`checkSystem(system, lookup)`.

### Passives

Resistors, capacitors, inductors and ferrite beads are modules with two
`passive` terminals (`pin_1`, `pin_2`) and a `passive` trait holding the
value. `Passive()` builds one:

```ts
Passive({ id: "r-4k7-0402", name: "4.7 kΩ 1 % 0402", kind: "resistor", value: 4.7e3, unit: "Ω", tolerance: 0.01,
          package: { name: "0402", code: "1005 metric", pin_count: 2, exposed_pad: false } });
```

Terminals pair with nothing, so a passive on a net never makes a functional
link. Checks that care about passives read the trait (`bus_pullup`).

### Design requirements

A `design_envelope` trait on the board states what the design must fit,
before any layout exists:

```ts
traits: [{ type: "design_envelope", params: {
  max_mm: { length: 30, width: 20, height: 5 },
  keep_outs: [{ name: "antenna", region: { min: [24, 0, -1], max: [30, 20, 5] }, reason: "no copper under the antenna" }],
  reason: "fits the 30 × 20 mm bay in the enclosure",
} }]
```

A design tool honours it. The `design_envelope` check compares it with the
board's stated size (`dimensions_mm`, written back once a design exists).
Layout itself is never UHD.

## Functional links over nets

`deriveLinks` treats each net as a node in the same walk it uses for cable
conductors (see [connectors and harnesses](connectors-and-harnesses.md)):
every pin on a net reaches every other pin on it. Each pair of pads is then
lifted to the functional interfaces they belong to, and becomes a derived
link only when those interfaces pair by protocol:

| Pads on one net | Result |
| --- | --- |
| Regulator VOUT and a load's VDD | power link, output ↔ input |
| MCU SDA/SCL and an IMU's SDx/SCx on the SDA and SCL nets | one I2C link, MCU `i2c_0` ↔ IMU `i2c` (lifted, conductors as children) |
| Two loads' VDD pins | no link: they share the rail |
| Two I2C targets | no link: they share the bus |
| A strap (CSB tied to 3V3, SDO tied to GND) | no link: a tie to a rail |
| A passive terminal and anything | no link |
| A part's own regulator output and its own core supply (RP2040 VREG_VOUT → DVDD) | power link within the part |

Lifting pairs composites with composites and pads with pads, choosing the
largest pair that matches. A derived link over nets is tagged
`derived: { via, harnesses, nets }`; `via` names the membership links, so a
diagnostic on it points at the pins.

Because derived links are ordinary link results, the system rules run over
boards unchanged:

- `link_state` validates each derived pair (parameters included);
- `supply_budget` totals the loads on a regulator's output port (a part's
  doubled VOUT pins are one port) at the **net's design voltage** when the net
  states one, each load counted once;
- `bus_address` finds two targets at one address on one controller;
- `interface_reuse` counts a pin on a net as one connection, however many
  pins share the net;
- `unpowered` reports power inputs that no supply reaches. Inputs fed through
  the board edge (an exported pin, or any pin on a net with one) are not
  reported when the board is checked alone;
- `harness_wiring` catches SDA wired to SCL.

## Board rules

| Rule | Severity | When |
| --- | --- | --- |
| `net` | warning | a net joins fewer than two pins |
| `net` | error | a pin is on two nets (it joins them) |
| `net` | error | power outputs of more than one module drive the net |
| `net` | error | the net joins ground pins to supply pins |
| `net` | error | a pin's `voltage` range does not include the net's design voltage |
| `bus_pullup` | warning | an I2C link over nets with no resistor from the net to a supply net |
| `design_envelope` | error | the stated size exceeds the envelope |

The net voltage check is what catches a wrong rail: an adjustable regulator
(1.2–5.5 V) set to 3.3 V says nothing by itself, but `Net({ voltageV: 3.3 })`
does, and every pin on the net is checked against it.

## Package facts and pin designators

A component's package goes on its mechanical domain, next to its size:

```ts
domains: [{
  domain: "mechanical",
  dimensions_mm: { length: 4.0, width: 3.0, height: 0.9 },   // overall, leads included
  package: {
    name: "VSON-14",
    code: "DSJ (R-PVSON-N14)",
    pin_count: 14,
    pitch_mm: 0.5,
    exposed_pad: true,
    exposed_pad_pin: "EP",
    exposed_pad_mm: [2.85, 1.58],
    source: "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5; p.32)",
  },
}]
```

`partPackage(def)` reads it with the size. `pin_count` counts numbered
terminals; an exposed pad is stated separately, with the designator of its
leaf (the manufacturer's number, such as `57` on the RP2040, else a label
such as `"EP"`).

Every leaf pin of a component with a package carries `pin`. `pinTable`
declares a chip's pins from its datasheet table in one place, and refuses a
repeated designator:

```ts
const pins = pinTable([
  [1, "SDO", "io", "Serial data output in SPI 4W; I2C address bit 0 select"],
  { pin: 5, name: "VDDIO", type: "power_in", voltageV: [1.2, 3.6], nominalV: 1.8 },
  [6, "GNDIO", "ground"],
  { pin: 13, name: "SCx", type: "input", capabilities: ["i2c_scl", "spi_sck"] },
  { pin: 14, name: "SDx", type: "io", capabilities: ["i2c_sda", "spi_mosi"] },
], { source: `${SRC.datasheet} (Table 22)`, logicV: [1.2, 3.6] });
```

Pin types are `power_in`, `power_out`, `ground`, `io`, `input`, `output`,
`analog_in`, `analog_out`, `passive` and `nc`. Buses are composed over the
returned ids with the bus builders, as before.

`pinDesignatorIssues(def)` (run by `scripts/verify-part.ts` as `[pins]`
warnings) reports, for parts with a package: electrical leaves without `pin`,
a designator on more than one leaf, numbered pins no leaf carries, and
designators outside the package. A peripheral function that is not a pin (a
PWM block muxable onto any GPIO) is marked `geometry: { logical: true }`.

## Limits

- Derivation does not cross a module boundary: a parent system does not see
  through a child board's nets. Export the functional interfaces the edge
  carries.
- A strap that changes a part's behaviour (SDO high selects I2C address 0x69)
  is not modelled: the part's interface states its default. A board with a
  strapped address needs an instance override, which UHD does not have yet.
- Internal pull-ups are not modelled, so `bus_pullup` is a warning.
- Push-pull outputs sharing a net are not reported (open-drain wired-OR is
  legitimate and the vocabulary does not yet tell them apart).
