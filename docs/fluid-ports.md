# Pneumatic and hydraulic ports

Status: implemented (PB-864). Code: `src/protocols/fluid.ts` (`FluidPort`),
`src/drc/joint-check.ts` (`fluid_joint_mismatch`), role table in
`src/matching/roles.ts`. Tests: `test/vocabulary.test.ts`.

## The model

A fluid port is one leaf interface in the `pneumatic` or `hydraulic`
domain. It states three things.

1. **Flow role**, as the protocol `pneumatic` or `hydraulic`:

   | Role | Use for |
   | --- | --- |
   | `source` | Ports that deliver pressure: compressor and pump outlets, regulator outlets, valve outlets, exhaust ports |
   | `sink` | Ports that consume it: cylinder ports, valve inlets and pilot ports |
   | `bidirectional` | Ports that pass flow either way: fittings, tubing, tees, adapters, manifolds |
   | `sensing` | Ports that measure pressure where they are plumbed in: gauges, transducers, pressure switches |

   A source pairs with a sink, a fitting or a sensor. A sink pairs with a
   source or a fitting. A sensor pairs with a source or a fitting, not with a
   sink port directly. Two sources or two sinks do not pair. The generic
   pairs (input ↔ output) do not apply to these protocols.

2. **Joint**, as the `fluid_joint` trait: how the port physically connects.

   | Kind | Fields | Mates with |
   | --- | --- | --- |
   | `thread` | `standard` (NPT, NPTF, BSPP, BSPT, metric, UNF, SAE_ORB), `size` as printed ("1/4", "G1/4", "M5"), `gender` | A thread of the same standard and size and the other gender. NPT and NPTF count as one standard. |
   | `push_to_connect` | `tubeOdMm` | A tube of that outside diameter |
   | `tube` | `tubeOdMm`, optional `tubeIdMm` | A push-to-connect fitting, or a hose barb when the inside diameter is given |
   | `barb` | `tubeIdMm` | A tube of that inside diameter |
   | `quick_coupler` | `style`, `gender` | A coupler of the same style and the other gender |

   The pair check reports `fluid_joint_mismatch` for anything else, such as
   a 1/8 NPT thread into a 1/4 NPT port, a BSPP thread into an NPT port, two
   male threads, or two push-to-connect fittings with no tube between them.

3. **Pressure**, as the `pressure` parameter in bar. A source states what it
   delivers (a value or a range); every other port states the working range
   it is rated for. The two must overlap, so a 62 bar tank outlet on a
   fitting rated to 10 bar is a conflict. Tube diameters are the `tube_od`
   and `tube_id` parameters in mm and must also agree. Burst pressure,
   rated fluids, fluid temperature and seal type go in the `fluid` trait.

```ts
FluidPort({
  id: "port_1",
  name: "Port 1 (inlet)",
  medium: "pneumatic",
  role: "sink",
  joint: { kind: "thread", standard: "NPT", size: "1/4", gender: "female" },
  pressureBar: [1.5, 8],
  fluids: ["compressed_air"],
  fluidTemperatureC: [0, 60],
  seal: "thread_sealant",
});
```

A part with several ports declares one `FluidPort` per physical port, with
the source's port label as its name. A fitting with two ends (a push-to-connect
fitting with an NPT thread) has two ports, one per end, both
`bidirectional`.

## Review against the ProtoPart library

Thirty ProtoPart definitions declare a pneumatic or hydraulic domain. Ten of
them (REV brackets, a shaft collar, nyloc nuts and the SPARK Flex) declare
empty pneumatic and hydraulic domains with no ports; a port of those parts
should drop the empty domains rather than map them. The other twenty are
cylinders, valves, a compressor, a regulator, pressure sensors and fittings,
with 38 physical ports. This is how their vocabulary maps.

### Flow roles

ProtoPart used ten role names on the protocol `pneumatic`, and
`liquid_supply` once for a liquid pressure sensor.

| ProtoPart role (count) | UHD role | Notes |
| --- | --- | --- |
| `supply` (11) | `source` or `bidirectional` | Used for compressor and regulator outlets, but also for regulator inlets and adapter ends. Decide per port: an outlet is a `source`, an inlet is a `sink`, a fitting end is `bidirectional`. |
| `input` (5) | `sink` | Valve inlets and fitting ends that receive air. A fitting end is `bidirectional`. |
| `output` (5) | `source` | Valve outlets. A fitting end is `bidirectional`. |
| `sink` (2) | `sink` | Cylinder ports. |
| `exhaust` (2) | `source` | A valve's exhaust port delivers air at about atmospheric pressure to a silencer or the open air. |
| `sensing` (2) | `sensing` | Pressure transducers. |
| `splitter` (2) | `bidirectional` | Tees and wyes: one port per branch. |
| `connection` (2) | `bidirectional` | Tube ends. |
| `control` (1) | `sink` | A pilot or control port. |
| `liquid_supply` / `sensing` (1) | `hydraulic` / `sensing` | The liquid pressure sensor is a hydraulic port. |

### Joints

ProtoPart resources name the connector as `quick_connect` (16) or
`threaded_port` (22), with the thread standard written five ways (`NPT`,
`BSP`, `BSPP (G)`, `metric`, `Metric (M)`), the size in `port_size` or
`thread_size`, the gender in `thread_gender` (9 ports) or only in the
description, and the tube size in inches (`tube_od_inch`).

- `threaded_port` maps to a `thread` joint. Write the standard as `NPT`,
  `BSPP`, `BSPT` or `metric`; ProtoPart's `BSP` with a `G` size is `BSPP`.
  Take the gender from `thread_gender`, or from the description where only
  it says ("male 1/8-27 NPT").
- `quick_connect` on a fitting maps to `push_to_connect`; on a cylinder or
  piston port that takes tubing directly it is also `push_to_connect`; on a
  length of tubing it is `tube`. Convert `tube_od_inch` to millimetres
  (1/4 in = 6.35 mm, 5/32 in = 3.97 mm).

### Parameters and constraints

- `working_pressure_bar`, `min_pressure_bar` and `max_pressure_bar` become
  the `pressure` range: `[min or 0, working]` for a rated port, or the
  delivered value for a source. `max_pressure_bar` above the working value
  and `burst_pressure_bar` go in the `fluid` trait.
- `compatible_fluids`, `fluid_temperature_C` and `seal_type` go in the
  `fluid` trait.
- ProtoPart's interface `constraints` (`thread_gender: female`,
  `max_pressure_bar: ">=10"`, `requires_port_size`) described what the other
  side must be. In UHD the pair check derives the same from both ports'
  joints and pressure ranges, so they are not copied.
- `response_time_ms` and `control_method` describe the part, not the port;
  they go in a `performance` or `usage_note` trait on the module.

### What is not covered

- **Flow capacity** (`flow_rate`, `max_flow`, Cv) is a capacity parameter,
  like current: it is summed over a system, not compared pair by pair. No
  ProtoPart port states one.
- **Valve function** (3/2, 5/2, normally closed) and which ports a valve
  connects in each state are part behaviour. Record them in a trait on the
  module, naming the ports.
- **Tubing as a harness**: a length of tube with a fitting at each end is a
  harness module with two `tube` ends, the same way a cable is (see
  [connectors and harnesses](connectors-and-harnesses.md)).
