# Geometry artifacts: tying CAD to modules and interfaces (PB-775)

UHD keeps geometry **in CAD artifacts** and records **references** into them.
A module lists its CAD files as artifacts; an interface says *where it is*
(a mating frame) and *which geometry is it* (one or more refs). Assemblies are
then built from links alone.

```
ModuleDef.artifacts[]            ArtifactDef { format, units, role: body|interface|source, interfaceId?, provenance }
InterfaceDef.geometry            { frame?, refs?, logical? }
  frame                          { artifact?, origin, normal, xAxis?, symmetryDeg? }   (mm, module coordinates)
  refs[]                         feature | artifact | procedural
InterfaceLink.mate               { gapMm?, rotationDeg? }
```

Types: `src/types/geometry.ts`. Resolution, mating, checks and assembly:
`src/system/geometry.ts`. Tests: `test/geometry.test.ts`.

## The three binding directions

The same interface can carry several refs. The viewer can show each direction
separately (uhd-viewer 3D view, "D1 / D2 / D3").

| | D1 feature | D2 artifact | D3 procedural |
|---|---|---|---|
| Ref | `{ kind: "feature", artifact, name, signature }` | `{ kind: "artifact", artifact }` | `{ kind: "procedural", generator }` |
| Where the geometry lives | named sub-shape of the body (STEP/GLB name, KCL tag, vendor component name) | its own file, `interfaces/<id>.glb` | nowhere: derived from interface parameters at the frame |
| Stale detection | signature (area, centroid, normal) vs the generator manifest | file exists; optional signature | n/a |
| Survives a CAD rename | no: reported as `"x" not found` | yes (the file is the binding) | yes |
| Works with vendor CAD | yes, by the vendor's own names (Matek: `GH6P-1`, `MAG`) | only by converting/extracting | yes |
| What it can't say | nothing beyond the CAD | nothing beyond the CAD | anything that isn't a UHD parameter: circle-pattern phase, shaft length, pad pitch |

Recommendation: frames are required for anything physical; **D1 with a
signature** is the primary ref (it keeps geometry in the one file engineers
edit); D2 is a derived export for viewers and for interfaces whose geometry
doesn't exist as faces; D3 is the fallback for parts with no CAD and a
cross-check (D3 vs D1 disagreeing means parameters and CAD diverged).

## Frames and mating

`mateTransform(a, b, rotationDeg, gapMm)` places B so its frame meets A's:
origins coincide (offset by `gapMm` along A's normal), normals oppose, x-axes
align (rotated by `rotationDeg`). `symmetryDeg` states the allowed rotations;
`assemble` reports a rotation outside it as an error ("the holes will not
line up").

`assemble(system, lookup, { root })` walks every link at every level:

- **mechanical** links with frames on both ends are rigid **mates**; placement
  propagates from the root, and a mate whose ends are both already placed is
  checked (over-constrained / inconsistent gap → error);
- **other** links never move anything: with geometry on both ends (own or the
  children's) they are **routes** (the viewer draws wires), otherwise
  **unrouted**;
- modules no mate reaches are reported, not guessed (battery, receiver,
  strap, capacitor). `fixed` places them explicitly (the viewer uses the
  frame's battery-pad hint).

The fixture quadcopter (`test/fixtures/drone.ts`) assembles from its links
alone: frame → 4 motors (motor face on arm pad) → 4 props (hub on shaft), ESC
and FC on the stack pattern with the spacer gaps, the video unit and its camera
(a second body), GNSS.

## Mounting hardware as harnesses (fastener stacks)

A mechanical joint is carried by a harness module whose
children are the real hardware: screws, spacers, standoffs and nuts. A
harness declares where each part sits with `fastenerStack`
(`src/types/geometry.ts`):

```ts
// GPS: from the top plate's top face — nut under the 2 mm plate, spacer, board, screw from above
fastenerStack: [
  { child: "nuts", atMm: -2, direction: -1 },
  { child: "spacers", atMm: 0 },
  { child: "screws", atMm: 5.62, direction: -1 },
]
```

Positions are measured along the normal of the joint's structure-side frame
and repeated at every hole of its bolt pattern (`boltPatternHoles`; a
circle's first hole is on the frame's xAxis; a row lies along x, centred;
a slot has no fixed holes, so a stack on a slot gives its `positions`). `assemble` returns every
placed part (`assembly.hardware`) and checks:

- that each item's count matches the harness quantity; and
- that each nut sits on thread. For example, M2 × 10 on the GPS would stop
  0.8 mm inside the nut, so the model uses M2 × 12. A nut may also sit on a
  threaded shaft: when the joint's structure side is a shaft whose `shaft`
  trait states a `thread` (a motor's M5 prop shaft), the shaft is the
  screw, from its frame outward, so a prop nut needs no screw in the stack
  (`fastenerStack: [{ child: "nut", atMm: 6, positions: [[0, 0]] }]` over a
  6 mm hub).

Motor mounts rotate each motor by a multiple of the 90° pattern so that its
phase leads, which exit between two holes, point down the arm.

## Artifacts per module

Which files a CAD generator writes is the generator's convention, not part
of UHD. The layout UHD's helpers and the viewer expect when a module has
generated CAD:

```
<name>.step              body + one named sub-shape per interface feature (D1)
<name>.glb               the same for viewers (glTF: metres, Y-up)
<name>.manifest.json     feature -> { area_mm2, centroid, normal, faces } + tool, version, sourceDigest,
                         volume_mm3 (+ per-body volumes)
interfaces/<id>.glb      one artifact per interface (D2)
```

`volume_mm3` is the solid volume of the body, without the feature pads.
`systemMass` (`src/system/mass.ts`) takes a `CadVolume` function from the
caller, which reads it from the manifest (UHD does no file I/O), and
multiplies it by the module's declared
`domains[mechanical].material.density_g_cm3` whenever the module states no
`weight_g`. Custom plates get their mass this way, and so does standard
hardware with no supplier weight; nominal geometry makes its material an
`assumption`.

`feature`, `own`, `procedural` and `withGeometry` (`src/authoring/cad.ts`)
attach them; `withGeometry` throws on an unknown interface id so a renamed
interface can't silently lose its geometry. Which artifacts a generator
writes is the generator's knowledge, so a helper that lists them lives with
the generator, not in UHD. UHD has no part library and no generators: the
library lives in ProtoBoard's parts service.

## Notes from generator work

- Named features survive STEP and GLB export as node names, so D1 works
  end-to-end in a browser.
- Vendor CAD binds by the vendor's own component names. One interface can
  have several physical places (a GNSS module with two sockets carrying the
  same signals binds `uart_gnss` to `GH6P-1` **or** `GH6P-2`). A library that
  keeps vendor files serves them with their terms, which say who may receive
  them ([library protocol](library-protocol.md) § 4.5).
- Hole selection is by geometry (radius), not by name: a mount may be
  manifest-only in D1 (no GLB node); the viewer marks its centroid.
- KCL tags are the most natural D1 names (they are in the source), but they
  don't survive STEP/GLB export, so a viewer can't resolve them from exported
  files: D1 in KCL needs engine execution or a manifest produced by running
  the KCL, and until then KCL refs report "binding not checked". D2 in KCL
  (one file per interface) exports cleanly.

## Checks

`checkGeometryBindings(def, manifestFor)`:

- artifact not on the module → error
- feature not in the manifest → error ("renamed or removed in the CAD?")
- signature changed → error ("… area 301.6 → 80.4 mm², centroid moved 2.2 mm;
  re-bind explicitly")
- no manifest (KCL, not exported) → warning, "binding not checked"

Re-binding is explicit: a re-bind step copies the reviewed signatures into
the `feature(...)` refs and prints every change; nothing re-binds silently.
Remodelling a part (a board as a 1.6 mm PCB plus a component envelope, say)
makes every feature stale until it is re-bound.

## Findings and open questions

1. **Mid-plane mates.** A camera clamped between side plates must mate on the
   clamp's mid-plane; a face-to-face mate pushes it against one plate.
2. **Electrical geometry is not a mate.** Pads and lead ends have frames, but
   linking them must not move modules: the rule is "mechanical domain on
   either end → mate", everything else → route.
3. **Leaf vs parent geometry.** Motor phases are bound per lead (leaves); ESC
   motor pads as one group (parent). `interfaceGeometry` resolves a parent
   without geometry to its children, so both route.
4. **Symmetry ≠ freedom.** The GNSS hole square repeats every 90°, but the
   compass doesn't: its frame has no `symmetryDeg` (rotation changes the
   compass alignment the flight firmware is configured with).
5. **Unlinked modules** (strapped battery, receiver) have no mechanical
   interface, so no link can place them. Options: a placement hint (used
   here), or modelling the strap as a harness with frames.
6. **Harness geometry.** Stack hardware is placed procedurally from the
   frame's stack pattern and the mate gaps; the viewer checks the stack-up
   (M3×30 reaches the nut, 5.8 mm proud). A harness-level geometry rule in
   UHD would make this a system check.
7. **D3 limits.** Parameters don't carry pattern phase, shaft length or pad
   pitch; adding them would make D3 a complete fallback.
8. **Units.** GLB is metres/Y-up; UHD geometry is mm/Z-up. `ArtifactDef.units`
   records it; the viewer converts.
