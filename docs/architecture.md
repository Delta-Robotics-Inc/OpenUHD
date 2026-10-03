# UHD Architecture — Design Thoughts

## Context

Overhauling the ProtoPart definition system from its current 6-concept model (Part, Domain, Resource, Function, Interface, Harness) into a unified 4-concept model (Module, Interface, Harness, Artifact) inspired by Verilog HDL. The core insight: **Interface is the universal primitive** — a GPIO pin, an I2C bus, a pneumatic port, and a motor control protocol are all the same type at different composition levels.

> **Terminology note.** This system is intentionally domain-agnostic. We use **interface** as the universal term for a connection point. **Leaf interface** means the lowest-level (no slots, no profiles) interface. Words like *pin*, *port*, *terminal*, *joint*, *fitting* appear only as domain-specific examples — pins for electrical, ports/fittings for fluid/pneumatic, joints for mechanical. Data structures and APIs always say "interface."

**Key architectural shift:** There is no "board" concept. A board is just a module. Everything is modules-of-modules, from a rocket ship down to individual ICs. Each module contains its sub-modules, harnesses connecting them, and artifacts referencing external design files.

---

## 1. The Four Primitives

### Module
The universal container. Replaces Part AND Board. Modules contain interfaces, sub-modules, harnesses connecting those sub-modules, and artifacts. A rocket ship, a PCB, and a chip are all modules at different scales. The "board" is simply the root module the user is editing.

### Interface  
The universal connection primitive. Replaces Resource, Function, Interface, and FunctionRequirement. Recursive — interfaces compose from other interfaces. Distinguished by `exposed` (connectable externally) vs `internal` (wiring only).

### Harness
Links interfaces between sibling sub-modules within a parent module. Types: single wire, bus, split, OR (selector between alternative device interfaces, e.g. a removable USB cable). Per your diagram note: "do not define wire types" — the harness cares about topology, not medium.

### Artifact
The bridge to external design data. Attaches to modules to carry richer detail that lives outside UHD's structural model — schematics, PCB files, CAD/3D models, firmware repos, datasheets, simulations, documentation. UHD does not absorb these formats; it points to them with a typed reference (`pcb`, `schematic`, `3d_model`, `firmware`, `datasheet`, `simulation`, `documentation`, `cad`, `custom`) so downstream tooling can resolve, render, or act on them. Per-instance `artifactOverrides` let a placement add or replace artifacts without modifying the underlying module definition.

---

## 2. Core Data Types

### 2.1 The Protocol + Capability Duality

Every interface has two facets:

- **Protocols** face **outward** — used for matching between modules ("can these two devices talk?"). Protocol type + role pair compatibility drives the matching engine at every level, from leaf-to-leaf wires to composed I2C connections.
- **Capabilities** face **inward** — used for binding leaf interfaces to slots within the same module ("which leaf interfaces can form this I2C bus?"). Capabilities are hardware-level tags describing what the underlying hardware can physically do (e.g., a GPIO pin that supports PWM, a pneumatic port rated for high pressure).

| Facet | Question | Used By | Example |
|---|---|---|---|
| **Protocol** | "What does this interface speak?" | Inter-module matching, compositional matching | `{ type: "pwm", roles: ["output"] }` |
| **Capability** | "What can this leaf interface physically do?" | Intra-module slot binding, profile validation | `["digital_io", "pwm_out", "i2c_sda"]` |

A leaf interface has both: protocols describe how it connects to other devices, capabilities describe how it participates in composed interfaces on its own module.

### 2.2 Interface — The Universal Primitive

```typescript
interface InterfaceDef {
  id: string;
  name?: string;
  domain: DomainKind;

  // === Visibility ===
  exposed: boolean;           // true = connectable externally, false = internal only

  // === Protocols (outward-facing) ===
  // What this interface speaks. Used for ALL inter-module matching.
  // A leaf interface can support multiple protocols (multiplexing — e.g., GPIO pin-muxing).
  // A composed interface typically has one protocol.
  protocols: ProtocolDef[];

  // === Capabilities (inward-facing) ===
  // What this interface can physically do. Used for intra-module slot binding.
  // Only meaningful on leaf interfaces (e.g., a GPIO pin, a pneumatic port).
  // Capabilities describe hardware peripheral abilities, not protocol contracts.
  capabilities?: string[];    // e.g., ["digital_io", "pwm_out", "i2c_sda", "analog_in"]

  // === Composition ===
  // When this interface is BUILT FROM other interfaces on the same module.
  slots?: SlotDef[];
  profiles?: InterfaceProfile[];

  // === Parameters ===
  // Typed values with units, ranges, and tolerances (adopted from faebryk).
  // Replaces the old untyped `constraints?: Record<string, any>`.
  parameters?: Parameter[];

  // === Activation ===
  default_active?: boolean;   // Is this interface on by default?
  max_instances?: number;

  // === Traits ===
  // Structured behaviors (adopted from faebryk).
  traits?: TraitDef[];        // e.g., can_bridge, timing characteristics
}

interface ProtocolDef {
  type: string;               // "digital", "pwm", "i2c", "spi", "uart", "power", "motor_control"
  roles: string[];            // ["input", "output", "bidirectional", "master", "slave"]
  version?: string;
}
```

### 2.3 Slots — How Composed Interfaces Declare Their Needs

Slots declare what a composed interface needs, using protocol matching for cross-module composition and capability matching for intra-module binding (binding a leaf interface to a slot).

```typescript
interface SlotDef {
  id: string;                 // "sda", "scl", "en", "in1", "mosi"
  label?: string;             // Human-readable name
  required: boolean;          // vs optional (e.g., UART flow control, SPI SS)
  count?: number;             // Default 1

  match: SlotMatch;
}

interface SlotMatch {
  // === For inter-module compositional matching ===
  // "What protocol does the OTHER device need to speak to fill this slot?"
  protocol?: string;          // Protocol type to match
  role?: string;              // Role within that protocol (optional, narrows match)

  // === For intra-module slot binding ===
  // "What capability does a leaf interface on THIS module need to fill this slot?"
  capability?: string;        // Capability tag to match against leaf interface capabilities
}
```

**How the two match fields work together:**

When connecting two modules compositionally (Arduino ↔ L298N motor controller):
- The slot's `protocol` + `role` fields are used to find compatible interfaces on the other module
- e.g., slot `{ protocol: "pwm", role: "input" }` matches Arduino D3 which has `protocol: { type: "pwm", roles: ["output"] }` via role pair compatibility

When binding a leaf interface within a module (L298N's `en_a` leaf fills the motor_ch_a "en" slot):
- The slot's `capability` field validates that the leaf has the right hardware ability
- e.g., slot `{ capability: "pwm_in" }` matches leaf interface `en_a` which has `capabilities: ["pwm_in", "digital_in"]`

### 2.4 Profiles — Constrained Leaf Interface Groups

When a composed interface can only use specific leaf interface combinations (hardware-routed buses, fixed connector wiring), profiles constrain which bindings are valid. Without profiles, any leaf interface matching the slot's capability works. With profiles, the user picks a profile and all slots bind as a group.

```typescript
interface InterfaceProfile {
  id: string;                 // "spi_0", "channel_a", "i2c_0"
  label?: string;             // "SPI Bus 0 (D10-D13)", "Motor Channel A"

  // Maps slot IDs to specific interface IDs on this module
  bindings: Record<string, string | string[]>;
  // e.g., { "mosi": "d11", "miso": "d12", "sck": "d13", "ss": "d10" }

  // Is this profile/channel active by default?
  // If omitted, inherits from the parent InterfaceDef.default_active.
  // This allows per-channel activation control:
  //   - L298N: both channels default_active: true → placed fully configured
  //   - ESP32 SPI: bus 0 default_active: true, bus 1 omitted → one active, one optional
  default_active?: boolean;
}
```

**Profiles are instances.** Each active profile is a separate instantiation of its parent interface, with its own bindings, role selection, and connections. A single `motor_control` interface with two profiles produces two independently-connectable motor channels. This avoids duplicating the entire interface definition for each channel.

Users can also create **custom profiles** at the instance level — manually binding each slot to any leaf interface with the right capability. The validation is the same: check each binding against the slot's capability requirement, check for binding-claim conflicts.

**Authoring spectrum — when to use profiles:**

| Scenario | Profiles on Def | User Experience |
|---|---|---|
| Fixed multi-channel (L298N) | 2+ predefined, all `default_active: true` | Place it, both channels ready. No config. |
| Fixed single-channel (Arduino I2C) | 1 predefined | Activate → auto-binds the only option |
| Multi-bus with options (ESP32 SPI) | 2-3 suggested presets | Pick a preset, or create custom bindings |
| Fully flexible (generic breakout) | None | User binds every slot manually (custom profile) |

**Instantiation rules:**
```
For each interface on the ModuleDef:
  if no profiles and no slots:
    → Leaf interface. Active per interface.default_active. No bindings needed.
  if no profiles but has slots:
    → Slots are unbound. User creates a custom profile by binding each slot freely.
  if profiles exist:
    → Each profile is a potential instance of this interface.
    → Each profile's activation: profile.default_active ?? interface.default_active
    → Single-profile + active: auto-select and auto-bind on instantiation.
    → Multi-profile: each activates independently per its default_active.
    → max_instances caps how many profiles can be active simultaneously.
    → User can always create additional custom profiles (up to max_instances).
```

### 2.5 Concrete Examples

**Arduino D3 — a multi-protocol leaf interface (electrical pin):**
```typescript
{
  id: "d3",
  name: "D3",
  domain: "electrical",
  exposed: true,
  default_active: true,
  // Outward: how other devices see this leaf interface
  protocols: [
    { type: "digital", roles: ["input", "output", "bidirectional"] },
    { type: "pwm", roles: ["output"] },
    { type: "interrupt", roles: ["input"] },
  ],
  // Inward: what this leaf interface can do for composed interfaces on this module
  capabilities: ["digital_io", "pwm_out", "interrupt"],
  parameters: [
    { id: "voltage", unit: "V", value: 5 },
    { id: "drive_current", unit: "mA", value: 40 },
  ],
}
```

**Arduino A4 — a multi-role leaf interface (analog/digital/I2C pin):**
```typescript
{
  id: "a4",
  name: "A4/SDA",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [
    { type: "analog", roles: ["input"] },
    { type: "digital", roles: ["input", "output", "bidirectional"] },
  ],
  // i2c_sda is a CAPABILITY (hardware routing), not a protocol the leaf interface speaks
  capabilities: ["analog_in", "digital_io", "i2c_sda"],
}
```

**L298N ENA — a leaf interface (control pin) accepting PWM or digital input:**
```typescript
{
  id: "en_a",
  name: "ENA",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [
    { type: "pwm", roles: ["input"] },
    { type: "digital", roles: ["input"] },
  ],
  capabilities: ["pwm_in", "digital_in"],
}
```

**Arduino I2C — composed from leaf interfaces, with a single profile:**
```typescript
{
  id: "i2c",
  name: "I2C",
  domain: "electrical",
  exposed: true,
  default_active: false,
  protocols: [
    { type: "i2c", roles: ["master", "slave"] },
  ],
  parameters: [
    { id: "clock_freq", unit: "Hz", value: 400000 },
    { id: "voltage", unit: "V", value: 5 },
  ],
  slots: [
    { id: "sda", required: true, match: { protocol: "i2c", role: "data", capability: "i2c_sda" } },
    { id: "scl", required: true, match: { protocol: "i2c", role: "clock", capability: "i2c_scl" } },
  ],
  // Only one valid leaf-interface pair on the Nano (A4/A5)
  profiles: [
    { id: "i2c_0", label: "I2C (A4/A5)", bindings: { sda: "a4", scl: "a5" } },
  ],
}
```

**Arduino SPI — composed with a hardware-fixed profile:**
```typescript
{
  id: "spi",
  name: "SPI",
  domain: "electrical",
  exposed: true,
  default_active: false,
  protocols: [
    { type: "spi", roles: ["master", "slave"] },
  ],
  parameters: [
    { id: "clock_freq", unit: "Hz", range: [125000, 8000000] },
  ],
  slots: [
    { id: "mosi", required: true, match: { protocol: "spi", role: "data_out", capability: "spi_mosi" } },
    { id: "miso", required: true, match: { protocol: "spi", role: "data_in", capability: "spi_miso" } },
    { id: "sck",  required: true, match: { protocol: "spi", role: "clock", capability: "spi_sck" } },
    { id: "ss",   required: false, match: { protocol: "spi", role: "select", capability: "spi_ss" } },
  ],
  profiles: [
    { id: "spi_0", label: "SPI Bus 0 (D10-D13)", bindings: { mosi: "d11", miso: "d12", sck: "d13", ss: "d10" } },
  ],
}
```

**L298N motor control — one interface, two profiled channels:**
```typescript
{
  id: "motor_control",
  name: "DC Motor Control",
  domain: "electrical",
  exposed: true,
  default_active: true,
  max_instances: 2,              // Supports up to 2 motor channels
  protocols: [
    { type: "motor_control", roles: ["target"] },
  ],
  slots: [
    { id: "en",  required: true, match: { protocol: "pwm", role: "input", capability: "pwm_in" } },
    { id: "in1", required: true, match: { protocol: "digital", role: "input", capability: "digital_in" } },
    { id: "in2", required: true, match: { protocol: "digital", role: "input", capability: "digital_in" } },
  ],
  // Two channels = two profiles, both active by default
  profiles: [
    { id: "channel_a", label: "Motor Channel A",
      bindings: { en: "en_a", in1: "in1", in2: "in2" },
      default_active: true },
    { id: "channel_b", label: "Motor Channel B",
      bindings: { en: "en_b", in1: "in3", in2: "in4" },
      default_active: true },
  ],
  // Result: place L298N on board → both channels ready, all leaf interfaces bound.
  // Each channel is independently connectable to different harnesses.
}
```

**Display module — slot that needs a full sub-interface, not just a leaf interface:**
```typescript
{
  id: "data",
  name: "Display Data",
  protocols: [{ type: "display_control", roles: ["target"] }],
  slots: [
    { id: "bus", required: true, match: { protocol: "i2c" } },    // Needs a full I2C interface
    { id: "reset", required: true, match: { protocol: "digital", role: "input", capability: "digital_in" } },
  ],
}
```

### 2.2 Module — The Universal Container (replaces Part AND Board)

```typescript
interface ModuleDef {
  id: string;
  name: string;
  description?: string;
  version?: string;          // Semantic version for library modules

  // Metadata
  manufacturer?: string;
  part_number?: string;
  tags?: string[];           // free-form keywords
  categories?: string[];     // taxonomy paths, e.g. "sensor.distance" (docs/taxonomy.md)

  // === The module's own interfaces ===
  // These are the module's "ports" — what it exposes to its parent module
  interfaces: InterfaceDef[];

  // === Internal structure ===
  // A module contains sub-modules and harnesses connecting them.
  // This is the same data that "BoardState" currently holds,
  // collapsed into the module itself. A "board" is just the root module.
  children?: ChildModuleRef[];
  harnesses?: HarnessDef[];

  // === Artifacts — external files, links, integrations ===
  artifacts?: ArtifactDef[];

  // === Interface groups — activation policies ===
  interfaceGroups?: InterfaceGroup[];

  // === Requirements — what this module needs from its environment ===
  requirements?: RequirementDef[];

  // === Domain metadata ===
  domains?: DomainMetadata[];  // Power domains, mechanical envelope, thermal ratings

  // === Constraints (future: scripted validation functions) ===
  // constraints?: ConstraintFn[];

  // === Geometry (for visual representation) ===
  geometry?: NodeGeometry;
}

// Reference to a child module within a parent.
// This is definition-level: "an Arduino Nano PCB module contains a 328P chip module"
// At the instance level, ChildModuleRef becomes a ModuleInstance with overrides.
interface ChildModuleRef {
  id: string;              // Instance name within parent ("mcu", "motor_driver")
  moduleDefId: string;     // Reference to a ModuleDef

  // Which of the child's interfaces are re-exposed at the parent level
  exposedInterfaces?: string[];

  // Definition-level overrides (e.g., fixed config for this child in this context)
  overrides?: Record<string, any>;
}

// === Artifacts ===
// External files, links, or integrations that further define the module.
// e.g., KiCad PCB file, firmware repo, 3D model, datasheet
interface ArtifactDef {
  id: string;
  name: string;
  type: ArtifactType;

  // Where the artifact lives
  url?: string;            // External link (datasheet URL, git repo)
  filePath?: string;       // Relative path within project
  storageRef?: string;     // Cloud storage reference

  // Metadata
  description?: string;
  mimeType?: string;       // "application/x-kicad-pcb", "model/step", etc.
  tags?: string[];
}

type ArtifactType =
  | "pcb"              // KiCad, Altium, Eagle PCB files
  | "schematic"        // Circuit schematics
  | "3d_model"         // STEP, STL for mechanical
  | "firmware"         // Source code, binary
  | "datasheet"        // PDF datasheets
  | "simulation"       // SPICE, FEA models
  | "documentation"    // Manuals, guides
  | "cad"              // Mechanical CAD (Fusion360, SolidWorks)
  | "custom";          // Escape hatch

interface RequirementDef {
  type: "capability" | "interface" | "power";
  description: string;
  capability?: string;
  interface_protocol?: string;
  voltage_V?: number | [number, number];
  current_mA?: number;
}
```

### 2.3 Harness — The Linker (lives INSIDE a module, connects its children)

Harnesses live inside the parent module and connect interfaces between sibling child modules. This replaces the current BoardState's `harnessesById`.

```typescript
interface HarnessDef {
  id: string;
  name?: string;

  // Topology type — from your diagram
  topology: "wire" | "bus" | "split" | "or";
  // "or" = selector between alternative interfaces on different modules
  //        e.g., a removable USB cable that connects to device A OR device B

  // Domain
  domain: DomainKind;

  // Endpoints — references to child module interfaces
  endpoints: HarnessEndpointDef[];
}

interface HarnessEndpointDef {
  id: string;
  label: string;
  // Which child module and interface this endpoint attaches to
  childModuleId?: string;          // ID of ChildModuleRef
  interfaceId?: string;            // ID of interface on that child
  profileInstanceId?: string;      // Which profile/channel instance (e.g., "channel_a")
  // Constraints on what can attach (for unbound endpoints)
  match?: SlotMatch;
}
```

### 2.4 The Fractal Module Hierarchy

Because a module contains children + harnesses, the entire system is fractal:

```
RocketShip (ModuleDef)
├── interfaces: [power_in, data_link, ...]
├── children:
│   ├── avionics_bay (ModuleDef)
│   │   ├── children:
│   │   │   ├── flight_computer (ModuleDef)
│   │   │   │   ├── children:
│   │   │   │   │   ├── main_mcu (ModuleDef — e.g., STM32)
│   │   │   │   │   ├── imu_sensor (ModuleDef — e.g., MPU6050)
│   │   │   │   │   └── ...
│   │   │   │   ├── harnesses: [i2c_bus, spi_flash, power_rail, ...]
│   │   │   │   └── artifacts: [pcb.kicad, firmware.git, bom.csv]
│   │   │   └── telemetry_radio (ModuleDef)
│   │   └── harnesses: [data_bus, power_dist, ...]
│   ├── propulsion (ModuleDef)
│   │   ├── children: [motor_controller, igniter, ...]
│   │   └── harnesses: [motor_power, ignition_signal, ...]
│   └── recovery (ModuleDef)
├── harnesses: [main_power, avionics_data, ...]
└── artifacts: [system_diagram.pdf, test_plan.doc]
```

The user can "zoom into" any module and it looks exactly like a board — sub-modules + harnesses. The current "BoardState" is simply the instance data for whatever module the user has open.

---

## 3. Composition Model — How Interfaces Build Up

The hierarchy:

```
Module      (contains interfaces + sub-modules)
  |
Interface   (protocol contract, composable)
  |
Interface   (lower-level interface or leaf)
  |
Interface   (leaf: protocols for outward matching, capabilities for inward binding)
```

### Matching Algorithm — "Match at highest level possible"

All matching uses **protocol type + role pair compatibility**. The same engine handles leaf-to-leaf wires, composed interface connections, and compositional inference.

When connecting Module A to Module B:

```
1. EXPLICIT PROTOCOL MATCH (confidence 1.0)
   Both modules declare matching protocol interfaces with compatible roles.
   This is the hot path — protocol type equality + role pair lookup.
   e.g., A has i2c.master, B has i2c.slave → role pair match ✓

2. COMPOSITIONAL MATCH (confidence ~0.8)
   A declares a composite interface with slots. B doesn't declare that protocol,
   but B's exposed interfaces can fill all of A's slots via protocol matching.
   Each slot specifies { protocol, role } — matched against B's interfaces.
   e.g., A has motor_control.target { en: pwm.input, in1: digital.input, in2: digital.input }
         B has D3 (pwm.output), D4 (digital.output), D5 (digital.output)
         → pwm.output ↔ pwm.input ✓, digital.output ↔ digital.input ✓ → composed match

3. INFERRED COMPOSITION (confidence ~0.5)
   When A connects to B with a compositional match, B gains an "inferred interface"
   that mirrors A's protocol. The Arduino doesn't define motor_control, but through
   the connection the system infers it is acting as a motor controller source.
   This is a runtime-derived concept, not stored on the definition.
```

**Note:** The old "CAPABILITY MATCH" tier (confidence ~0.6) is eliminated. Capabilities are intra-module only. Cross-module matching always uses protocols. This simplifies the matching engine to a single mechanism.

### Inferred Interfaces

Runtime-derived, never stored on definitions:

```typescript
interface InferredInterface {
  // The protocol this module is implicitly satisfying
  protocol: { type: string; role: string };
  // Which of this module's interfaces are being composed to satisfy it
  composedFrom: { slotId: string; interfaceId: string }[];
  // The connection that caused this inference
  sourceHarnessId: string;
  // Confidence score
  confidence: number;
}
```

### Intra-Module Binding Flow

When a composite interface is activated on a module:

1. If **profiles exist**: user picks a profile → all slots auto-bind per the profile's bindings → bindings validated against leaf interface capabilities
2. If **no profiles**: user manually binds each slot → each binding validated against the slot's `capability` match
3. Bound leaf interfaces are **claimed** — their other capabilities become unavailable (derived from actual bindings, no explicit `claims` field needed)
4. Activation engine derives leaf interface consumption from bindings, handles mutual exclusion

---

## 4. Class/Instance — Prefab/Overrides Model

The open question for `module.ts` is: "prefab→overrides or class→instances?" Recommendation: **both, as two layers**.

### Layer 1: Definition (the "Class" / "Prefab")

`ModuleDef` is the class. It's the canonical description of an Arduino Nano, authored once, shared via library. This is what lives in the part library and gets versioned.

```typescript
// The "class" — immutable, shared, versioned
interface ModuleDef {
  id: string;           // "arduino-nano"
  version: string;      // "1.2.0"
  interfaces: InterfaceDef[];
  // ... everything above
}
```

### Layer 2: Instance (the "Instance" / "Override")

`ModuleInstance` is the runtime state for a module placed in a parent module. It references a definition but carries only **deltas** — which interfaces are active, slot bindings, child instance overrides, position, nickname.

Because modules contain children and harnesses, a ModuleInstance also contains child ModuleInstances and harness runtime state. This is the fractal: what was "BoardState" is now just the ModuleInstance of the root module.

```typescript
// The "instance" — mutable, per-placement, lightweight (stores only deltas)
interface ModuleInstance {
  id: ModuleInstanceId;
  defId: string;          // Points to ModuleDef.id
  defVersion?: string;    // Pin to specific version (optional)

  nickname?: string;
  position: { x: number; y: number };

  // === Interface state ===
  // Tracks which profiles/instances are active and how they're bound.
  // Only stores DEVIATIONS from definition defaults.
  // For a fully-fixed module (L298N), this may be empty — all defaults apply.
  interfaceStates: Record<string, InterfaceInstanceState>;

  // === Child module instances ===
  // Each ChildModuleRef in the definition becomes a ModuleInstance here.
  // Only stores overrides — if a child has no user changes, it may be omitted.
  childInstances: Record<string, ModuleInstance>;

  // === Harness runtime state ===
  // Harness definitions live on ModuleDef; instance state lives here.
  harnessStates: Record<string, HarnessInstanceState>;

  // === Artifact overrides (user can add project-specific artifacts) ===
  artifactOverrides?: ArtifactDef[];

  // === Custom field overrides ===
  customOverrides?: Record<string, any>;

  // === Bookkeeping ===
  lastModified: number;
  stateVersion: number;
}

// Tracks the active instances (profiles) of a single InterfaceDef.
// Each entry in `instances` is either a predefined profile or a custom user binding.
interface InterfaceInstanceState {
  interfaceDefId: string;

  // Each active instance of this interface, keyed by unique instance ID.
  // For predefined profiles, the key matches the profile ID (e.g., "channel_a").
  // For custom bindings, the key is a generated ID.
  instances: Record<string, InterfaceInstanceBinding>;
}

interface InterfaceInstanceBinding {
  // If based on a predefined profile from the definition, reference it.
  // If absent, this is a custom user-created binding.
  profileId?: string;

  // The actual slot bindings (always present — either from profile or manual).
  bindings: Record<string, string | string[]>;

  // Runtime config
  implementedRole?: string;       // Which protocol role this instance is using
  active: boolean;
  customOverrides?: Record<string, any>;
}

interface HarnessInstanceState {
  harnessDefId: string;
  // Which endpoints are actually bound (user may not have connected all).
  // Now includes profileInstanceId to target a specific channel/profile.
  endpointBindings: Record<string, {
    childModuleId: string;
    interfaceId: string;
    profileInstanceId?: string;   // Which profile instance (e.g., "channel_a")
  }>;
  // For "or" topology: which alternative is currently selected
  selectedEndpointId?: string;
}
```

**How instances are populated on placement:**

For a **fully-fixed module** (L298N): all predefined profiles with `default_active: true` are automatically instantiated with their predefined bindings. The `interfaceStates` record is populated but contains no user deviations — it mirrors the definition exactly. In practice, this could even be omitted (derived from def) and only written when the user overrides something.

For a **configurable module** (Arduino Nano): leaf interfaces are active (no instance state needed). Composed interfaces with `default_active: false` have no entries in `interfaceStates` until the user activates them. When the user activates I2C and picks profile `i2c_0`, an entry is written:

```typescript
interfaceStates: {
  "i2c": {
    interfaceDefId: "i2c",
    instances: {
      "i2c_0": {
        profileId: "i2c_0",            // Based on predefined profile
        bindings: { sda: "a4", scl: "a5" },  // From profile definition
        implementedRole: "master",
        active: true,
      }
    }
  }
}
```

For a **custom binding** (ESP32 with user-chosen SPI pins):

```typescript
interfaceStates: {
  "spi": {
    interfaceDefId: "spi",
    instances: {
      "custom_spi_1": {
        // No profileId — this is a user-created binding
        bindings: { mosi: "gpio7", miso: "gpio8", sck: "gpio9", ss: "gpio6" },
        implementedRole: "master",
        active: true,
      }
    }
  }
}
```

### Why Prefab/Overrides is the right framing

The key insight from game engine prefab systems: **the instance stores only deltas from the definition**. This means:

1. **Storage efficiency** — instances are tiny (just overrides from their def)
2. **Definition updates propagate** — update the Arduino Nano def, all instances get the new interfaces/capabilities unless explicitly overridden
3. **Clear authoring boundary** — library authors write `ModuleDef`, system designers create `ModuleInstance` with overrides
4. **Diff-friendly** — you can see exactly what the user changed vs. the stock definition
5. **Fractal composition** — a PCB module's instance contains chip instances, which contain sub-block instances. Each level stores only its own overrides.

The override resolution:
```
Final state = ModuleDef defaults ← ModuleInstance overrides
```

For custom fields, the definition declares the schema (`CustomPropertyDef[]`), the instance stores only values that differ from defaults. Current system already does this partially — the new system makes it the universal pattern.

---

## 5. Protocols and Capabilities — The Full Picture

### Protocols (outward, inter-module)

Protocols define what an interface speaks and how it connects to other modules. The protocol spec defines:
- Allowed protocol types (`digital`, `pwm`, `analog`, `i2c`, `spi`, `uart`, `power`, `motor_control`, ...)
- Role pair compatibility matrix (`master ↔ slave`, `input ↔ output`, `transmitter ↔ receiver`, ...)
- Per-protocol role aliases and defaults

Every interface — leaf or composed — declares its protocols. This is the ONLY mechanism for cross-module matching.

### Capabilities (inward, intra-module)

Capabilities describe what a leaf interface's hardware can physically do (e.g., a GPIO pin that supports PWM, a connector terminal rated for high current). They exist only on leaf interfaces and are used only for:
1. **Slot binding validation** — "does this leaf interface have `i2c_sda` capability?"
2. **Profile validation** — "does the leaf interface bound in this profile actually support the required capability?"

Capabilities are NOT used for cross-module matching. They are hardware routing tags, not protocol contracts.

### Tags (informal, search/filter)

`tags` on ModuleDef are informal strings for search and filtering. Not used by the matching or validation engines. Human-facing only.

```typescript
tags: ["mcu", "arduino", "5v", "breadboard"]  // For search/discovery
```

---

## 6. What the Verilog-Inspired Syntax Maps To

Your `part ArduinoNano { res D0; ... output interface I2C { ... } }` maps cleanly:

| Verilog-like syntax | Maps to |
|---|---|
| `part ArduinoNano` | `ModuleDef { id: "arduino-nano" }` |
| `res D0` | `InterfaceDef { id: "d0", protocols: [...], capabilities: [...] }` — leaf interface (electrical pin in this example) |
| `output interface I2C` | `InterfaceDef { id: "i2c", protocols: [{ type: "i2c", ... }], slots: [...] }` |
| `requires: { SDA: { oneof: { D2, A3 } } }` | `SlotDef { id: "sda", match: { capability: "i2c_sda" } }` + a profile with bindings |
| `oneof` | Profile bindings — the profile defines which specific leaf interfaces are valid for each slot |

The `oneof` concept maps to profiles: if SDA can be bound to D2 or A3, define two profiles (or one profile with the preferred default). The user picks a profile, all slots bind as a group.

---

## 7. Activation Model

Interfaces can be active or inactive, with two mechanisms for managing exclusion and dependencies.

### Interface Groups — Named Alternatives and Dependencies

For symmetric relationships between interfaces (choosing between power sources, requiring co-activation):

```typescript
interface InterfaceGroup {
  id: string;
  label?: string;             // "Power Source", "Network Connectivity"
  members: string[];          // Interface IDs on this module
  policy: "one_of" | "any_of" | "all_of";
  // one_of:  exactly one must be active (USB xor barrel jack power)
  // any_of:  at least one must be active (WiFi and/or Ethernet for connectivity)
  // all_of:  all must be active together (motor enable + direction pins)
}
```

### Derived Claims — Multiplexing from Bindings

For multiplexing (e.g., activating I2C on an Arduino claims the A4/A5 pins; activating a hydraulic line claims a multi-port manifold fitting), there is no explicit `claims` or `exclusive_with` field. Instead, claims are **derived from active profile bindings**:

1. User activates `i2c` interface → picks profile `i2c_0` → binds SDA=A4, SCL=A5
2. System sees A4 and A5 are now bound as I2C slots in an active profile instance
3. Those leaf interfaces' other protocols (analog, digital GPIO) become unavailable
4. If user tries to also use A4 as analog input, binding validation rejects it

This is cleaner than explicit mutual exclusion because:
- No redundancy between `exclusive_with` and slot bindings
- Works automatically for any composed interface, not just pre-declared exclusions
- The source of truth is always the actual bindings, not a separate exclusion list
- Works identically for predefined profiles and custom user bindings

### Default Activation — Three Tiers of Module Configurability

Modules fall on a spectrum from fully-fixed to fully-configurable. The system handles all tiers with the same mechanisms — `default_active` on interfaces and profiles, plus auto-binding of single profiles:

| Tier | Example | Behavior on Placement |
|---|---|---|
| **Fully fixed** | L298N, most sensors, passives | All interfaces active, all profiles default_active, all bindings auto-applied. Zero config needed. |
| **Partially configurable** | Some dev boards, multi-mode ICs | Some interfaces always-on, others dormant. Some profiles default, others optional. |
| **Highly configurable** | Arduino, ESP32, STM32 | Leaf interfaces active, composed protocol interfaces dormant until user decides. Config driven by what gets connected. |

Whether a module is "fully fixed" is **derivable** — no flag needed. A module is fully fixed when every interface has `default_active: true` and every profile has `default_active: true` (or inherits it). The UI can detect this and skip the configuration step.

### Combined Example

```typescript
const arduinoNano: ModuleDef = {
  // ...
  interfaceGroups: [
    // Symmetric alternative: USB or barrel jack power
    { id: "power_source", label: "Power Source",
      members: ["power_usb", "power_vin"], policy: "one_of" },
  ],
  // Multiplexing: handled automatically by binding derivation.
  // When i2c profile i2c_0 activates and binds A4/A5, those leaf interfaces are claimed.
  // No explicit exclusive_with needed.
};
```

---

## 8. Recommended Repo Structure

```
proto-core/                    # New standalone TypeScript package
├── src/
│   ├── types/
│   │   ├── module.ts          # ModuleDef, ModuleInstance, ChildModuleRef
│   │   ├── interface.ts       # InterfaceDef, SlotDef, SlotMatch
│   │   ├── harness.ts         # HarnessDef, HarnessInstanceState
│   │   ├── artifact.ts        # ArtifactDef, ArtifactType
│   │   ├── domain.ts          # DomainKind, DomainMetadata, constraints
│   │   ├── trait.ts           # TraitDef, CanBridgeTrait, etc.
│   │   └── ids.ts             # Branded ID types
│   ├── matching/
│   │   ├── compatibility.ts   # Interface matching algorithm
│   │   ├── composition.ts     # Compositional/inferred matching
│   │   ├── confidence.ts      # Confidence scoring
│   │   └── roles.ts           # Protocol role compatibility
│   ├── binding/
│   │   ├── resolver.ts        # Slot binding resolution
│   │   └── validation.ts      # Binding constraint validation
│   ├── instance/
│   │   ├── instantiate.ts     # ModuleDef → ModuleInstance
│   │   ├── override.ts        # Override resolution (def + instance → final state)
│   │   └── activation.ts      # Interface activation/deactivation logic
│   ├── drc/
│   │   ├── evaluate.ts        # Design rule checking
│   │   └── types.ts
│   ├── spec/
│   │   └── protocol-spec.ts   # Protocol definitions + role pairs (TS-first)
│   └── index.ts
├── library/                   # Common interface + module definitions (reusable)
│   ├── protocols/             # Canonical interface defs for standard protocols
│   │   ├── i2c.ts
│   │   ├── spi.ts
│   │   ├── uart.ts
│   │   ├── power.ts
│   │   └── digital.ts
│   ├── modules/               # Base module templates (spread into specific parts)
│   │   ├── mcu-base.ts        # Common MCU interfaces
│   │   └── sensor-base.ts
│   └── parts/                 # Concrete part definitions (migrated from JSON)
│       ├── arduino-nano.ts
│       ├── esp32.ts
│       ├── l298n.ts
│       └── ...
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

> This was the original layout. UHD keeps no part library: `src/protocols` holds
> the interface builders, and parts live in a library served over the open
> library protocol ([library-protocol.md](library-protocol.md)).

TypeScript-first authoring enables:
- **Inheritance/composition** — `mcu-base.ts` exports base interfaces, specific MCUs spread + extend
- **Constraint functions** — future scripted validation per module (TypeScript functions, not JSON)
- **IDE support** — autocomplete, type-checking, refactoring across definitions
- **Library imports** — `import { I2C_MASTER } from 'proto-core/library/protocols/i2c'`

---

## 9. Migration Path from Current System

The key mappings for converting existing 160+ JSON parts:

| Current | New |
|---|---|
| `ProtoResourceDef` | `InterfaceDef { exposed: true, protocols: [...], capabilities: [fn.name for fn in functions] }` — leaf interface |
| `ProtoFunctionDef.name` | Entry in `capabilities[]` on a leaf InterfaceDef, AND a corresponding protocol entry |
| `ProtoInterfaceDef` | `InterfaceDef { protocols: [{ type, roles }], slots: [from requires] }` — composed interface |
| `ProtoFunctionRequirementDef` | `SlotDef { match: { protocol, role, capability } }` |
| `ProtoResourceAllocation` | `SlotBinding { interfaceInstanceId, slotId, filledBy }` |
| `ProtoDomainDef` | Interfaces + `DomainMetadata` (power domains, constraints) |
| `ProtoInterfaceDef.constraints` | `InterfaceDef.parameters[]` — typed values with units |

Migration note: each old `function` name maps to BOTH a capability tag AND a protocol entry on the leaf interface. e.g., `{ name: "i2c_sda" }` becomes `capabilities: ["i2c_sda"]` (for binding) AND `protocols: [{ type: "i2c", roles: ["sda"] }]` if the leaf interface should be directly connectable via I2C. For functions that are purely intra-module (like `ground` or `mounting_hole`), only the capability is needed.

---

## 10. Concepts Adopted from faebryk/atopile

After studying the [atopile/faebryk](https://github.com/atopile/atopile) architecture — a graph-based hardware description system with a domain-agnostic core — several concepts are worth adopting into UHD. faebryk's core (Node/Field/Edge/Trait) is genuinely domain-agnostic, but everything built on top (exporters, picking, layout) assumes PCB→KiCad. Rather than building on faebryk directly, we adopt the best ideas into our TypeScript-first unified system.

### 10.1 Trait System — Composable Behaviors

faebryk uses traits as composable behaviors attached to nodes (`can_bridge`, `is_pickable`, `can_attach_to_footprint`). This is more flexible than flat `capabilities: string[]` — traits carry logic and relationships, not just labels.

**Adoption:** Add a `traits` system to `ModuleDef`. Traits are structured behaviors that the matching and validation engines can reason about. (Note: we eliminated standalone `capabilities` on modules — `tags` handles search/filtering, traits handle structured behaviors.)

```typescript
// Traits are structured, typed behaviors — not just string tags
interface TraitDef {
  type: string;           // "can_bridge", "provides_power", "is_pickable"
  params?: Record<string, any>;
}

// === can_bridge ===
// Declares how signals flow THROUGH a module.
// A resistor bridges from pin 0 to pin 1.
// A voltage regulator bridges from power_in to power_out.
// Enables automatic routing suggestions and compositional matching.
interface CanBridgeTrait extends TraitDef {
  type: "can_bridge";
  params: {
    from: string[];       // Interface IDs that serve as input
    to: string[];         // Interface IDs that serve as output
  };
}

// === provides_power ===
// Declares that this module can supply power to other modules.
interface ProvidesPowerTrait extends TraitDef {
  type: "provides_power";
  params: {
    interfaceId: string;  // Which interface provides it
    voltage: Parameter;   // What voltage (with tolerance)
    maxCurrent: Parameter;
  };
}

// === is_pickable ===
// Declares that this module can be automatically selected from a parts database
// based on parameter constraints (resistance, capacitance, etc.)
interface IsPickableTrait extends TraitDef {
  type: "is_pickable";
  params: {
    category: string;     // "resistor", "capacitor", "mcu", etc.
    matchParams: string[]; // Which parameters to match against (IDs)
  };
}

// On ModuleDef:
interface ModuleDef {
  // ...existing fields...
  tags?: string[];           // Informal, for search/filtering (human-facing)
  traits?: TraitDef[];       // Structured composable behaviors (machine-facing)
}
```

**Why traits, not capabilities on modules?** Capabilities as flat strings were redundant with traits. `tags` covers informal search/discovery. Traits carry structured data the engine can reason about — `can_bridge` doesn't just say "I'm a bridge," it says "signals enter here and exit there."

### 10.2 Typed Parameters with Units — Replacing Untyped Constraints

faebryk's parameter system carries values with SI units, tolerances, and ranges. Their constraint solver does dimensional analysis automatically. Our current `constraints?: Record<string, any>` is an untyped bag — no validation, no unit checking, no range operations.

**Adoption:** Introduce a `Parameter` type that carries value, unit, and tolerance. Use it everywhere constraints currently use raw numbers.

```typescript
// === Parameter — a value with unit and tolerance ===
interface Parameter {
  id: string;
  name?: string;
  value?: number;                    // Nominal value (undefined = unconstrained)
  unit: Unit;                        // SI unit or derived
  range?: [number, number];          // Acceptable range [min, max]
  tolerance?: number | {             // ±absolute or ±percentage
    type: "absolute" | "percent";
    value: number;
  };
}

// SI and derived units
type Unit =
  // Electrical
  | "V" | "A" | "Ω" | "F" | "H" | "W" | "Hz"
  // Mechanical
  | "m" | "mm" | "kg" | "N" | "Nm" | "rad/s" | "rpm"
  // Thermal
  | "°C" | "K" | "W/mK"
  // Fluid/Pneumatic
  | "Pa" | "bar" | "L/min" | "m³/s"
  // General
  | "s" | "ms" | "dimensionless"
  | string;  // Escape hatch for custom units

// === Where Parameters replace raw numbers ===

// BEFORE (current system):
interface ProtoInterfaceDef {
  constraints?: Record<string, any>;  // { voltage_V: 3.3, max_current_mA: 500 }
}

// AFTER:
interface InterfaceDef {
  // ...existing fields...
  parameters?: Parameter[];           // Typed, validated, unit-aware
}

// Example: an I2C interface with typed electrical parameters
const i2cMaster: InterfaceDef = {
  id: "i2c_0",
  domain: "electrical",
  exposed: true,
  protocols: [{ type: "i2c", roles: ["master"] }],
  slots: [
    { id: "sda", required: true, match: { protocol: "i2c", role: "data", capability: "i2c_sda" } },
    { id: "scl", required: true, match: { protocol: "i2c", role: "clock", capability: "i2c_scl" } },
  ],
  parameters: [
    { id: "voltage", unit: "V", range: [3.0, 3.6] },
    { id: "clock_freq", unit: "Hz", value: 400000, tolerance: { type: "percent", value: 5 } },
    { id: "pull_up_resistance", unit: "Ω", range: [2200, 10000] },
  ],
};
```

**Validation gains:** When two interfaces connect, the system can check that parameter ranges overlap (voltage levels compatible, clock frequencies within spec). This replaces the current `checkInterfaceCompatibility` weighted scoring with actual parametric validation.

### 10.3 Constraint Expressions — Parameter Relationships

faebryk's killer feature: declaring relationships between parameters as equations. `assert v_out is v_in * ratio` isn't just documentation — the constraint solver uses it to derive missing values and validate the design.

**Adoption:** Add a `ConstraintExpr` type for declaring relationships between parameters. This is the "future constraint functions" placeholder made concrete. Initially evaluate these as validation rules; later, extend to a solver that can derive missing values.

```typescript
// === Constraint Expressions ===
// Declare relationships between parameters on a module and its children.
// Phase 1: validation (check that relationships hold)
// Phase 2: solver (derive missing values from constraints)

type ConstraintExpr =
  | ParameterEquality       // A is B
  | ParameterComparison     // A < B, A >= B
  | ParameterArithmetic     // A is B * C, A is B + C
  | ParameterRange          // A within [min, max]
  | CustomConstraint;       // Escape hatch: TypeScript function

interface ParameterEquality {
  type: "equals";
  left: ParameterRef;       // e.g., "feedback_divider.v_in"
  right: ParameterRef;      // e.g., "power_out.voltage"
}

interface ParameterComparison {
  type: "lt" | "lte" | "gt" | "gte";
  left: ParameterRef;
  right: ParameterRef;
}

interface ParameterArithmetic {
  type: "equals";
  left: ParameterRef;
  right: {
    op: "add" | "subtract" | "multiply" | "divide";
    operands: ParameterRef[];
  };
}

interface ParameterRange {
  type: "within";
  param: ParameterRef;
  min: number;
  max: number;
  unit: Unit;
}

interface CustomConstraint {
  type: "custom";
  // TypeScript function that receives resolved parameter values
  // and returns validation diagnostics
  validate: (params: ResolvedParams) => ConstraintDiagnostic[];
}

// Reference to a parameter, possibly on a child module
// Uses dot-path notation: "child.grandchild.parameter_id"
type ParameterRef = string;

interface ConstraintDiagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  parameterRefs?: ParameterRef[];
}

// On ModuleDef:
interface ModuleDef {
  // ...existing fields...
  constraints?: ConstraintExpr[];   // Parameter relationships and validation rules
}
```

**Example: Voltage regulator with constraints**
```typescript
const adjustableRegulator: ModuleDef = {
  id: "adjustable-regulator",
  name: "Adjustable Voltage Regulator",
  interfaces: [
    { id: "power_in", /* ... */ parameters: [{ id: "voltage", unit: "V" }] },
    { id: "power_out", /* ... */ parameters: [{ id: "voltage", unit: "V" }] },
  ],
  children: [
    { id: "feedback_divider", moduleDefId: "resistor-voltage-divider" },
  ],
  constraints: [
    // Output voltage equals divider's derived voltage
    { type: "equals", left: "power_out.voltage", right: "feedback_divider.v_out" },
    // Input must exceed output by dropout voltage
    { type: "gt", left: "power_in.voltage", right: "power_out.voltage" },
    // Input voltage within absolute maximum rating
    { type: "within", param: "power_in.voltage", min: 3, max: 40, unit: "V" },
  ],
};
```

### 10.4 `can_bridge` on Interfaces — Signal Flow Declaration

faebryk's `can_bridge` trait declares how signals flow through a component. A resistor bridges from terminal 0 to terminal 1. A regulator bridges from power_in to power_out. This enables the matching engine to compose signal paths: "can I get power from module A to module C through module B?"

**Adoption:** Add `bridgesTo` on `InterfaceDef` to declare signal flow direction through a module.

```typescript
interface InterfaceDef {
  // ...existing fields...

  // Declares that this interface can bridge signals to another interface
  // on the same module. Enables automatic path-finding in the matching engine.
  bridgesTo?: string[];    // IDs of other interfaces on the same module
                           // e.g., a resistor's pin_0 bridgesTo: ["pin_1"]
                           // e.g., a regulator's power_in bridgesTo: ["power_out"]
}
```

This integrates with the matching algorithm: when checking if Module B can serve as an intermediary between Module A and Module C, the system can trace `bridgesTo` paths through B's interfaces.

### 10.5 What We Deliberately Did Not Adopt

| faebryk Concept | Why Not |
|---|---|
| **Dual type-graph / instance-graph** | Our prefab/override model is simpler and sufficient. Two separate graph engines is overengineered for browser-based design. |
| **Zig-backed graph engine** | Premature optimization. Our system needs to run in the browser, not on a build server. |
| **ANTLR compilation pipeline / .ato DSL** | We chose TypeScript-first authoring. The Verilog-inspired syntax serves the same purpose with better IDE support. |
| **Python runtime** | Our entire stack is TypeScript/Next.js. A Python backend service adds deployment complexity. |
| **is_pickable trait** | Useful for automated BOM, but tightly coupled to their component database. We handle sourcing separately. |

### 10.6 Potential Future: .ato Importer

Rather than building on faebryk, a `.ato` importer would let users pull existing atopile designs into UHD as modules. This gives access to atopile's growing library without coupling our architecture to theirs. This is a future consideration.

---

## 11. Resolved & Remaining Open Questions

### Resolved
- **OR harness** = selector between alternative device interfaces (e.g., removable USB cable). Modeled via `selectedEndpointId` on HarnessInstanceState.
- **Domain metadata** = stays in `ModuleDef.domains[]` as metadata blobs.
- **Authoring format** = TypeScript-first. Required for constraint functions and library inheritance.
- **Board concept** = eliminated. Board is just a module. Module contains children + harnesses.
- **Constraint functions** = Typed `ConstraintExpr` system with parameter relationships (adopted from faebryk). Phase 1: validation. Phase 2: constraint solver. `CustomConstraint` escape hatch for TypeScript functions.
- **Build on faebryk?** = No. Adopt best ideas (traits, parameters, constraints, can_bridge) into our TypeScript system. Potential .ato importer for v3+.
- **Capability vs Protocol** = Both needed, different jobs. Protocols face outward (inter-module matching via type + role pairs). Capabilities face inward (intra-module slot binding validation, mapping a leaf interface to a slot). Every interface has `protocols[]`. Only leaf interfaces have `capabilities[]`.
- **Capabilities vs Traits on modules** = Collapsed. Module-level `capabilities` eliminated. `tags` for informal search/filtering. `traits` for structured behaviors the engine reasons about.
- **Multiplexing / either-or activation** = Two mechanisms: `interfaceGroups` with `one_of`/`any_of`/`all_of` policies for symmetric alternatives (power source selection). Derived claims from slot bindings for multiplexing (e.g., activating I2C claims A4/A5 automatically). No explicit `exclusive_with` or `claims` fields needed.
- **Slot binding: profiles vs generic** = Profiles for hardware-constrained leaf interface groups (SPI bus must use D10-D13 together; a hydraulic manifold must use a specific port set). No profiles = any matching leaf interface works. Profiles replace the old `bindableFrom` concept.
- **Profiles as instances** = Each active profile is an independent instance of its interface, with its own bindings and connections. One `motor_control` interface + two profiles = two connectable channels. Profiles have per-profile `default_active`. Users can also create custom profiles at the instance level for flexible binding (ESP32-style). Predefined profiles live on `InterfaceDef`, custom profiles live on `InterfaceInstanceState`.
- **Default activation** = Three tiers (fixed / partial / configurable) handled by `default_active` on interfaces and profiles + auto-binding of single profiles. Whether a module is "fully fixed" is derivable — no flag needed.

### Remaining
1. **Multi-module satisfaction** — multiple devices collectively satisfying an interface. Ensure SlotBinding doesn't preclude it, but park for v3.
2. **Artifact integrations** — should artifacts be passive (just links/files) or active (e.g., a KiCad artifact that contributes interface data back to the module)?
3. **Trait registry** — should traits be a fixed set of known types (`can_bridge`, `provides_power`, `is_pickable`) or extensible via a registry? Leaning toward a known core set with a `custom` escape hatch.
4. **Parameter solver scope** — how much constraint solving do we attempt in v2? Validation-only (check that declared values satisfy constraints) is straightforward. Derivation (infer missing values from constraints) requires a real solver engine.
5. **Protocol spec expansion** — the role pair compatibility table needs entries for leaf-level protocols (`digital`, `pwm`, `analog`) alongside the existing composed-level ones (`i2c`, `spi`, `uart`). How granular should roles be for leaf protocols?

---

## 12. Validation Plan

### 12.1 Test Parts (Minimum Viable Set)

| Module | Key Concepts Exercised |
|---|---|
| **Arduino Nano** | Multi-protocol leaf interfaces (electrical pins), capabilities, profiles (I2C/SPI with fixed leaf groups), interface groups (power source one_of), parameters, derived interface claiming |
| **L298N Motor Driver** | Composed `motor_control` interface with profiles (channel A leaves vs channel B leaves), `can_bridge` trait (power_in → motor_out), power interfaces |
| **VL53L0X ToF Sensor** | Simple I2C slave (explicit protocol match), power input with voltage constraint (2.6–3.5V vs Arduino's 5V — tests parameter mismatch) |
| **DC Motor** | Simplest possible module — two-terminal power interface. Tests leaf-to-leaf protocol matching |
| **Robot Car** | Module-of-modules containing all four above + harnesses. Tests fractal composition, harness topologies, prefab/override instances |

### 12.2 Test Scenarios

**Scenario 1: EXPLICIT PROTOCOL MATCH**
```
Arduino i2c.master ↔ VL53L0X i2c.slave
Expected: confidence 1.0, roles compatible via role pair table
Validates: protocol matching engine, role pair lookup
```

**Scenario 2: COMPOSITIONAL MATCH + INFERRED INTERFACE**
```
Arduino (no motor_control protocol) ↔ L298N motor_control (profile: channel_a)
L298N motor_control slots: { en: pwm.input, in1: digital.input, in2: digital.input }
Arduino has: D3 (pwm.output), D4 (digital.output), D5 (digital.output)
Expected: confidence 0.8, each slot matched via protocol role pairs
  pwm.output ↔ pwm.input ✓
  digital.output ↔ digital.input ✓ (×2)
Arduino gains inferred motor_control interface
Validates: compositional matching, slot protocol matching, inferred interfaces,
           connecting to a specific profile instance on the L298N
```

**Scenario 3: PARAMETER VALIDATION (voltage mismatch)**
```
Arduino 5V power_out ↔ VL53L0X power_in (range: 2.6–3.5V)
Expected: parameter range [4.8, 5.2] does NOT overlap [2.6, 3.5] → error
Arduino 3.3V power_out ↔ VL53L0X power_in → passes (3.1–3.5 overlaps 2.6–3.5)
Validates: parameter range overlap checking, unit-aware comparison
```

**Scenario 4: PROFILE SELECTION + DERIVED INTERFACE CLAIMING**
```
Activate i2c on Arduino → pick profile i2c_0
Expected: SDA auto-binds to A4, SCL auto-binds to A5
  Bindings validated: A4 has capability "i2c_sda" ✓, A5 has "i2c_scl" ✓
Then attempt to use A4 as analog input → rejected (interface claimed by i2c binding)
Then deactivate i2c → A4/A5 released, available again
Validates: profiles, capability-based binding validation, derived claims, interface release
```

**Scenario 5: INTERFACE GROUPS (one_of policy)**
```
Arduino power_source group (one_of): [power_usb, power_vin]
Activate power_usb → power_vin becomes inactive
Switch to power_vin → power_usb becomes inactive
Attempt to activate both → rejected by one_of policy
Validates: interface group policies, symmetric alternative enforcement
```

**Scenario 6: GENERIC SLOT BINDING (no profiles, cross-module)**
```
Arduino compositionally satisfies L298N motor_control (profile: channel_a).
Slot "en" needs { protocol: "pwm", role: "output" } from Arduino.
Arduino has 6 PWM-capable leaf interfaces: D3, D5, D6, D9, D10, D11.
User picks D3 → binding validated against capability "pwm_out" ✓
User could have picked D5, D6, D9, D10, D11 — all valid, no profile constrains the choice.
Then D3 is claimed → unavailable for other bindings.
Validates: free-choice capability binding on the provider side, no profile required
```

**Scenario 7: L298N PROFILED CHANNELS (profiles-as-instances)**
```
L298N has one motor_control interface with two profiles:
  profile "channel_a": { en: "en_a", in1: "in1", in2: "in2" }
  profile "channel_b": { en: "en_b", in1: "in3", in2: "in4" }
Both default_active: true → on placement, both channels auto-bind.
  channel_a claims en_a, in1, in2
  channel_b claims en_b, in3, in4
No leaf-interface overlap → both valid simultaneously.
Harness connects to channel_a specifically via profileInstanceId: "channel_a"
A second harness connects to channel_b independently.
Validates: profiles as independent instances, per-profile claiming,
           harness targeting a specific profile instance,
           single interface def producing multiple connectable channels
```

**Scenario 7b: CUSTOM PROFILE BINDING (ESP32-style flexible mapping)**
```
ESP32 has spi interface with 2 suggested profiles and max_instances: 2.
User ignores predefined profiles and creates a custom binding:
  { mosi: "gpio7", miso: "gpio8", sck: "gpio9", ss: "gpio6" }
System validates each binding against slot capability requirements ✓
Custom profile becomes an active instance alongside (or instead of) predefined ones.
Validates: user-created custom profiles, same validation path as predefined
```

**Scenario 8: MODULE-OF-MODULES + HARNESS TOPOLOGIES**
```
Robot Car module:
  children: [arduino, l298n, vl53l0x, motor_left, motor_right]
  harnesses:
    - { id: "sensor_bus", topology: "bus",
        endpoints: [arduino.i2c.i2c_0 ↔ vl53l0x.i2c] }
    - { id: "motor_ctrl_a", topology: "wire",
        endpoints: [arduino → l298n.motor_control.channel_a] }  // compositional, targets profile
    - { id: "motor_ctrl_b", topology: "wire",
        endpoints: [arduino → l298n.motor_control.channel_b] }  // second channel
    - { id: "motor_a_power", topology: "wire",
        endpoints: [l298n.motor_out_a ↔ motor_left.power] }
    - { id: "motor_b_power", topology: "wire",
        endpoints: [l298n.motor_out_b ↔ motor_right.power] }
    - { id: "power_select", topology: "or",
        endpoints: [usb_connector, battery_pack] }  // selector
Validates: fractal composition, bus/wire/or topologies,
           harness targeting specific profile instances,
           child interface exposure, harness endpoint binding
```

**Scenario 9: PREFAB/OVERRIDE INSTANCES**
```
Place two Arduino Nanos in Robot Car.
Instance 1: activate I2C, profile i2c_0, nickname "sensor_mcu"
Instance 2: activate SPI, profile spi_0, nickname "motor_mcu"
Both reference same ModuleDef.
Expected: independent interface overrides, independent interface claims,
          different active interfaces, same underlying definition.
Validates: prefab/override model, multiple instances, override independence
```

### 12.3 Build Phases

Each phase produces runnable vitest tests.

**Phase 1: Types + Leaf Protocol Matching**
- Define core types: `InterfaceDef`, `ModuleDef`, `ProtocolDef`, `SlotDef`, `Parameter`
- Define protocol role pair table (digital, pwm, analog, i2c, spi, uart, power)
- Build protocol matching engine (type equality + role pair lookup)
- **Test:** Arduino D3 `pwm.output` ↔ L298N EN_A `pwm.input` → match ✓

**Phase 2: Composed Interfaces + Compositional Matching**
- Build slot matching (protocol-based cross-module)
- Build compositional match algorithm (walk slots, find fillers on other module)
- Build inferred interface derivation
- **Test:** Scenarios 1, 2 — explicit I2C match, compositional motor_control match

**Phase 3: Binding + Profiles + Claiming**
- Build capability-based intra-module slot binding
- Build profile system (auto-bind from profile, validate against capabilities)
- Build derived claims (binding → leaf interface consumption → availability tracking)
- **Test:** Scenarios 4, 6, 7 — profile selection, generic binding, claim conflicts

**Phase 4: Parameters + Constraints**
- Build Parameter type with unit and range
- Build range overlap checking for parameter validation
- Build constraint expression evaluator (validation-only, no solver)
- **Test:** Scenario 3 — voltage mismatch between Arduino 5V and VL53L0X 3.3V

**Phase 5: Modules-of-Modules + Harnesses + Instances**
- Build ModuleInstance (prefab/override resolution)
- Build harness system with topology types
- Build interface groups with policies
- **Test:** Scenarios 5, 8, 9 — interface groups, Robot Car assembly, multiple instances
