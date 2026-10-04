# Pneumatic and hydraulic ports

Status: implemented. Code: `src/protocols/fluid.ts` (`FluidPort`),
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
   | `thread` | `standard` (NPT, NPTF, BSPP, BSPT, metric, UNF, SAE_ORB), `size` as printed ("1/4", "G1/4", "M5"), `gender` | A thread of the same standard and size and the other gender. NPT and NPTF count as one standard. A BSP size matches with or without its "G" or "R" prefix. |
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

## Mapping from other part libraries

Part libraries name these things in many ways. When porting a port from
another library, map it by what the port does, not by the name it used.

- **Roles.** A generic name such as `supply`, `input` or `output` does not
  say which way air or fluid flows through that port. Decide per port: an
  outlet that delivers pressure is a `source`, an inlet or a cylinder port is
  a `sink`, a fitting end, tee branch or tube end is `bidirectional`, and a
  gauge or transducer port is `sensing`. A valve's exhaust port is a
  `source`, because it delivers air at about atmospheric pressure to a
  silencer or the open air. A pilot or control port is a `sink`.
- **Threads.** Write the standard as `NPT`, `NPTF`, `BSPP`, `BSPT`,
  `metric`, `UNF` or `SAE_ORB`. A thread written as "BSP" with a "G" size is
  `BSPP`, and one with an "R", "Rc" or "Rp" size is `BSPT`. The size may keep
  its "G" or "R" prefix: the pair check ignores it for BSP threads. Take the
  gender from the source, including its description when only that says
  ("male 1/8-27 NPT").
- **Push-in fittings and tubes.** A "quick connect" fitting that takes
  tubing is `push_to_connect`, including a cylinder port that takes tubing
  directly; a length of tubing is `tube`. Tube sizes go in millimetres
  (1/4 in = 6.35 mm, 5/32 in = 3.97 mm).
- **Pressure.** A rated port's working range is its `pressure` range
  (`[minimum or 0, working pressure]`); a source states what it delivers.
  A maximum above the working value and the burst pressure go in the
  `fluid` trait, with the rated fluids, fluid temperature and seal type.
- **Constraints on the other side.** A rule in the source that says what the
  other side must be (its gender, its pressure rating, its port size) is not
  copied: the pair check derives the same from both ports' joints and
  pressure ranges.
- **Part-level facts.** Response time and control method describe the part,
  not the port; they go in a `performance` or `usage_note` trait on the
  module.
- **Empty domains.** A source part that declares a pneumatic or hydraulic
  domain with no ports (brackets, nuts) has no fluid ports; drop the empty
  domain rather than map it.

### What is not covered

- **Flow capacity** (`flow_rate`, `max_flow`, Cv) is a capacity parameter,
  like current: it is summed over a system, not compared pair by pair.
- **Valve function** (3/2, 5/2, normally closed) and which ports a valve
  connects in each state are part behaviour. Record them in a trait on the
  module, naming the ports.
- **Tubing as a harness**: a length of tube with a fitting at each end is a
  harness module with two `tube` ends, the same way a cable is (see
  [connectors and harnesses](connectors-and-harnesses.md)).
