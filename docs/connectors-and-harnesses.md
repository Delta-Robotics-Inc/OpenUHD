# Connectors, link-scoped composition and physical harnesses

Status: implemented (PB-805). Code: `src/protocols/connector.ts`
(`Connector`, `isConnector`), `src/system/connectors.ts` (mating),
`src/system/derive.ts` (`deriveLinks`, `systemLinks`), `src/system/checks.ts`
(`checkSystem` runs on stored + derived links). Tests: `test/connectors.test.ts`.

## Why

One line in a diagram should be one physical thing. A cable that carries
power, ground and a UART is one object: it plugs into one socket at each end.
Before PB-805, UHD could only say "these three logical links are carried by
that harness", so the cable had no pins, the sockets it plugs into did not
exist as interfaces, and nothing checked that the cable was wired correctly.

Two gaps had to close:

1. **A group of pads with no parent interface.** A flight controller's DJI
   socket was only a connector trait stamped on five pads. A cable end could
   not link to "the socket", because the socket was not an interface.
2. **Pads nobody grouped at all.** A GNSS lead soldered to six FC pads has no
   socket on the FC side. The grouping exists only for that link.

## The model

```
 FC                 DJI 3-in-1 cable (harness)                 O4
 dji_socket ──link── end_fc ══ conductors ══ end_o4 ──link── fc_cable_socket
 (connector)         (connector)            (connector)       (connector)
      │                                                            │
      └─ derived: bec_10v↔vcc, gnd↔gnd, gnd↔gnd_signal,            ┘
                  uart5↔uart_osd, sbus↔sbus
```

### Connector composite

A physical connector is one interface: protocol `connector`, one slot per
position (`p1…pN`, labelled with the printed name) and a default profile that
binds each used position to the pad or leaf it carries. Build it with
`Connector()`:

```ts
Connector({
  id: "dji_socket",
  name: "DJI socket (6-pin)",
  connector: "dji_6pin",
  gender: "receptacle",
  pins: [["10V", "bec_10v"], ["G", "gnd"], ["T5", "uart5_tx"], ["R5", "uart5_rx"], ["G", "gnd"], ["Sbus", "sbus"]],
  note: "…source…",
});
```

- A position with no `to` is unused (`"VOID"`).
- Several positions may bind the same pad (two `G` pins), and several
  connectors may bind the same pad (T5 is on the DJI and VTX sockets). Pads
  stay on the module outline; a connector does not hide what it binds.
- The `connector` trait (type, gender, positions, pinout, note) lives on the
  composite, not on the pads.

### Link between connectors

A stored link whose two ends are connectors mates **positions**, not
protocols: `p1↔p1`, `p2↔p2`, … unless `childLinks` say otherwise. It checks:

| Code | When |
|---|---|
| `connector_mismatch` | the two connector types differ and neither lists the other in `mates_with` (`matesWith` in `Connector()`) |
| `connector_gender` | both ends state the same gender (two receptacles) |
| `connector_positions` | different position counts and no stored mapping |
| `compose_unknown_slot` | a composition names a slot the other end does not have |

What the positions carry is checked on the derived links.

### Link-scoped composition

When a module has no interface grouping the pads a cable lands on (solder
pads, flying leads), the link end composes one for this link only:

```ts
{
  id: "gnss_pads",
  a: { child: "gnss_lead", interfaceId: "end_fc" },
  b: {
    child: "stack",
    interfaceId: "gnss_pads",           // a new name, never an existing interface
    compose: { p1: "rail_4v5", p2: "fc:uart1_tx", p3: "fc:uart1_rx", p4: "fc:i2c1_scl", p5: "fc:i2c1_sda", p6: "gnd" },
  },
}
```

- Keys are slot ids of the connector at the other end.
- Values are interfaces on the child's boundary (`"rail_4v5"`, an export) or
  canonical paths below the child (`"fc:uart1_tx"`), so pads inside a
  sub-assembly can be reached without exporting them.
- The composed end behaves like a connector with no type or gender. It is
  drawn as a port named `interfaceId` on the child.

Use a composition only when the part really has no connector there. If the
part has a socket, it declares a connector composite (see the authoring rule)
and the link uses it.

### Harness wiring

A `kind: "harness"` module declares its ends as connector composites and its
conductors as internal links between them (`self` ↔ `self`). Without
`childLinks` the wiring is straight through (`p1→p1`); a crossover or a
re-pinned cable states it:

```ts
links: [{
  id: "wires",
  a: { self: true, interfaceId: "end_fc" },
  b: { self: true, interfaceId: "end_o4" },
  // childLinks: [{ a: "p3", b: "p4" }, { a: "p4", b: "p3" }, …]   // only when not 1:1
}],
```

A bus or splitter harness has more ends and more internal links; conductors
are followed through all of them.

### Derived links

`deriveLinks(def, lookup)` walks the conductors of `def`'s connector links and
harness children from a pad on one part to a pad on another (it stops at part
pads; it never continues through a part). Each pad is then **lifted** to the
functional interface it belongs to:

- the largest non-connector composite on that module (UART, I2C, FC/ESC port)
  whose bound pads **all** travel to the same other module, or
- the pad itself (power, ground, S.Bus, a lone signal).

Pads that lift to the same pair of functional interfaces make one derived
link. It is validated exactly like a stored link (protocols, roles,
parameters), its `children` are the physical conductors (`method: "wired"`),
and it is tagged `derived: { via: [stored link ids], harnesses: [child ids] }`.
Its id is `<via links>~<a interface>~<b interface>`.

Two extra checks run on derived links:

| Code | When |
|---|---|
| `harness_wiring` | a conductor inside a composite lands on a different leaf than the protocol pairs it with (TX wired to TX) |
| `bus_incomplete` | a required pairing of a lifted composite has no conductor inside it: the pad reaches the other module only through some other pad (PB-824) |

`systemLinks(def, lookup)` returns stored plus derived results, and
`checkSystem` runs every system rule on that set, so supply budgets, interface
reuse, unpowered inputs and I2C addresses see through cables. A diagnostic on a
derived link also names the stored links it runs through (`link:<id>`), so a
viewer can colour the cable.

`validateLinks` still returns stored links only.

### Shared pads and exclusivity

Connector bindings never conflict with each other: the same pad may sit on
several connectors and positions. Exclusivity is a property of what is used,
so it is checked on derived links by the existing `interface_reuse` rule (for
example, UART5 used by both the DJI socket and the VTX socket's T5 at once).

### Scope

- Derivation is per module: its stored links and its harness children. A
  harness inside a sub-assembly (the stack's FC/ESC cable) is derived when that
  sub-assembly is checked.
- Parts may be nested below the linking module; derived endpoints use an
  export when the child has one for that interface, else a canonical path
  (`stack/fc:sbus`).
- Logical links that name a carrying harness (`harness: "…"`) are still
  valid, and `harness_connector` still checks them. It now also finds the
  connector composites that bind a link end's pads. Prefer the physical form
  for new work.

## Routed harness geometry

A cable's shape belongs to the cable. A harness can carry its own 3D
artifact (a routed body: conductors, connector housings, solder joints)
when each end interface also carries a **frame in the harness's
coordinates**: the point and direction where that end meets its part.

```ts
Connector({ id: "end_esc", connector: "solder_leads", pins: ["A", "B", "C"] })
// + geometry: { frame: { origin, normal, xAxis } }   (written by the route generator)
```

`assemble` places such a harness from the parts it connects, never the
other way round (`assembly.harnesses`, `HarnessPlacement`):

1. the **anchor** is the first link whose other end lands on a placed part
   with geometry; the harness is mated there (`mateTransform`, as for a
   rigid part);
2. every **other end** is compared with the frame it should meet. More than
   0.5 mm or 5° apart (`HARNESS_END_TOLERANCE`) is a warning: the route was
   generated for another assembly and must be regenerated.

The part side of a link end resolves to world frames with `linkEndFrames`:
a link-scoped composition gives one frame per position (in slot order: the
pad each conductor lands on), a connector or pad its own frame, a parent
port its children's. `combineFrames` makes one frame from several (mean
origin and normal; xAxis from position 1 to N), which is what the harness
end frame is compared with. A generator that writes its end frames as the
combined counterpart frames (normal reversed, same xAxis) and its geometry
in assembly-root coordinates gets the identity placement.

Links with a routed harness end are not listed as `routes` or `unrouted`;
their state is in the harness placement's `ends`
(`anchor | matches | stale | unplaced | no_geometry`).

## Part-authoring rule

> Every physical connector on a part is a connector composite. A connector
> that carries exactly one functional interface (USB-C, an RF jack, a balance
> lead) may keep the `connector` trait on that interface instead.

- Positions follow the printed order; when pin 1 is not marked, record the
  assumption on the composite.
- Pads keep their own `solder_pad` trait; sockets do not go on pads.
- Functional composites (UART, I2C, FC/ESC port) stay as they are: they are
  what conductors lift back to. Do not put connector pinouts on them.
- Geometry for a connector (a feature in the vendor STEP) belongs on the
  connector composite.

## Viewer

- A harness is one line with a region: collapsed, `A ─ [harness] ─ B` is drawn
  from the two connector links. Expanded, the derived links are the lanes
  (see uhd-viewer board 09 and design-direction D12).
- A link-scoped composition is a port on the child named by `interfaceId`.
