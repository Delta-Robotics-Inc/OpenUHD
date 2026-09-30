"""Representative geometry for the quadcopter's purchased parts (PB-775).

Dimensions come from library/cad/params.json (generated from the UHD part
definitions). Shapes are simplified to what the interfaces need — mounting
faces, holes, shafts, pads — and each part's generated artifact is recorded
on the part as representative geometry, not manufacturer CAD.
"""
from __future__ import annotations

import math
from pathlib import Path

from build123d import (
    Align,
    Axis,
    Box,
    BuildPart,
    BuildSketch,
    Circle,
    Cylinder,
    Locations,
    Mode,
    PolarLocations,
    Pos,
    RegularPolygon,
    Rot,
    extrude,
    fillet,
)

from common import PARAMS, Artifact, part_dir

HERE = Path(__file__)
MIN = (Align.CENTER, Align.CENTER, Align.MIN)


def motor() -> None:
    m = PARAMS["motor"]
    a = Artifact("meps-neon-2207-v2", part_dir("meps-neon-2207-v2-1950kv"), HERE)
    base_h = 3.0  # representative: base flange thickness is not dimensioned on the drawing
    r_hole = m["base_bolt_circle"] / 2
    with BuildPart() as base:
        Cylinder(m["diameter"] / 2 - 0.65, base_h, align=MIN)
        # M3 tapped holes on the 16 mm bolt circle (tap drill 2.5 mm), at 45° like the drawing
        with PolarLocations(r_hole, int(m["base_holes"]), start_angle=45):
            Cylinder(1.25, base_h, align=MIN, mode=Mode.SUBTRACT)
        Cylinder(3.0, 1.0, align=MIN, mode=Mode.SUBTRACT)  # centre relief for the shaft circlip
    with BuildPart() as bell:
        with Locations(Pos(0, 0, base_h)):
            Cylinder(m["diameter"] / 2, m["body_height"] - base_h, align=MIN)
        # cooling slots on the bell top, for recognisability
        with Locations(Pos(0, 0, m["body_height"] - 1.2)):
            with PolarLocations(9, 6):
                Box(8, 2.2, 1.3, align=MIN, mode=Mode.SUBTRACT)
    with BuildPart() as shaft:
        with Locations(Pos(0, 0, m["body_height"])):
            Cylinder(m["shaft_diameter"] / 2, m["overall_height"] - m["body_height"], align=MIN)
    # The three phase leads leave the base on +X inside a 10 mm heat-shrink
    # sleeve (MEPS size chart: 10 mm heat shrink, 150 mm leads, 3 mm tinned
    # tips). Only the sleeved part is motor geometry: the free leads beyond it
    # are the phase-lead harness (installed length and route). One stub per
    # lead pokes 0.5 mm out of the sleeve so every leaf (phases_a/b/c) has its
    # own exit face.
    x0 = m["diameter"] / 2 - 1
    sleeve_len = 10.0
    lead_r = 0.9  # 20 AWG silicone, representative (MEPS does not state the V2 gauge)
    with BuildPart() as sleeve:
        with Locations(Pos(x0, 0, 1.5) * Rot(0, 90, 0)):
            Box(2.6, 6.2, sleeve_len, align=(Align.CENTER, Align.CENTER, Align.MIN))
    leads = {}
    for letter, dy in (("a", -1.9), ("b", 0.0), ("c", 1.9)):
        with BuildPart() as lead:
            with Locations(Pos(x0 - 1, dy, 1.5) * Rot(0, 90, 0)):
                Cylinder(lead_r, sleeve_len + 1.5, align=MIN)
        leads[letter] = lead.part
    a.body(base.part, "base")
    a.body(bell.part, "bell")
    a.body(shaft.part, "shaft_body")
    a.body(sleeve.part, "heat_shrink")
    for letter, lead in leads.items():
        a.body(lead, f"lead_{letter}")

    a.feature("base_mount", base.part.faces().filter_by(Axis.Z).sort_by(Axis.Z)[:1])
    a.feature("shaft", shaft.part.faces().filter_by(lambda f: f.geom_type.name == "CYLINDER"))
    for letter, lead in leads.items():
        a.feature(f"phases_{letter}", [f for f in lead.faces() if f.geom_type.name == "PLANE" and f.normal_at().X > 0.9])
    a.write()


def propeller() -> None:
    p = PARAMS["prop"]
    a = Artifact("hqprop-ethix-s5", part_dir("hqprop-ethix-s5"), HERE)
    blade_len = p["diameter"] / 2 - p["hub_diameter"] / 2
    with BuildPart() as hub:
        Cylinder(p["hub_diameter"] / 2, p["hub_thickness"], align=MIN)
        Cylinder(p["bore"] / 2, p["hub_thickness"], align=MIN, mode=Mode.SUBTRACT)
    with BuildPart() as blades:
        for k in range(int(p["blades"])):
            ang = k * 360 / p["blades"]
            with Locations(Rot(0, 0, ang) * Pos(p["hub_diameter"] / 2 + blade_len / 2 - 1, 0, p["hub_thickness"] / 2) * Rot(18, 0, 0)):
                Box(blade_len + 2, 12, 1.2)
    a.body(hub.part, "hub")
    a.body(blades.part, "blades")
    a.feature("hub_bore", [f for f in hub.part.faces() if f.geom_type.name == "CYLINDER" and f.radius < p["hub_diameter"] / 2 - 0.1])
    a.write()


PCB = 1.6  # representative board thickness; the stack-up is set by spacers on the PCB, not by components


def board(part_id: str, name: str, spec: dict, extra=None) -> None:
    """A 1.6 mm PCB with the stack holes, plus a component envelope inside the hole square."""
    a = Artifact(name, part_dir(part_id), HERE)
    s = spec["hole_spacing"] / 2
    with BuildPart() as pcb:
        Box(spec["length"], spec["width"], PCB, align=MIN)
        with Locations(*[(x, y) for x in (-s, s) for y in (-s, s)]):
            Cylinder(spec["hole_diameter"] / 2, PCB, align=MIN, mode=Mode.SUBTRACT)
    with BuildPart() as parts_:
        inset = spec["hole_spacing"] - spec["hole_diameter"] - 2
        with Locations(Pos(0, 0, PCB)):
            Box(inset, inset, spec["height"] - PCB, align=MIN)
    # rubber grommets in the stack holes (included with the stack): 4 mm clamp, centred on the PCB
    with BuildPart() as grommets:
        with Locations(*[(x, y, PCB / 2 - 2) for x in (-s, s) for y in (-s, s)]):
            Cylinder(3.5, 4, align=MIN)
            Cylinder(1.6, 4, align=MIN, mode=Mode.SUBTRACT)
    a.body(pcb.part, "pcb")
    a.body(parts_.part, "components")
    a.body(grommets.part, "grommets")
    holes = [f for f in pcb.part.faces() if f.geom_type.name == "CYLINDER"]
    a.feature("stack_mount", holes)
    if extra:
        extra(a, pcb.part)
    a.write()


# ---------------------------------------------------------------------------
# Pads and sockets (PB-805 harness routing). Positions follow the DolphinRC
# F405 V3 manual (p3 product-size photos, p4 wiring diagram): which edge and
# in which order; pitches and pad sizes are representative, not measured.
# Board coordinates: X forward (the SH 8-pin edge), Y left, Z up, PCB 0..1.6.
# ---------------------------------------------------------------------------

def _top_face(part):
    return part.faces().filter_by(Axis.Z).sort_by(Axis.Z)[-1]


def pad(a: Artifact, name: str, x: float, y: float, size: tuple[float, float], z: float = PCB, label: str | None = None):
    """A 0.3 mm copper pad on the top face; its top face is feature `name`."""
    with BuildPart() as p:
        with Locations(Pos(x, y, z)):
            Box(size[0], size[1], 0.3, align=MIN)
    a.body(p.part, label or f"pad_{name}")
    if name:
        a.feature(name, [_top_face(p.part)])
    return p.part


def socket(a: Artifact, name: str, *, edge: str, along: float, pins: int, pitch: float, depth: float, height: float, bottom: bool, spec: dict):
    """A side-entry socket at a board edge, opening outward; its mating face is feature `name`.

    edge: "+x" | "-x" | "+y" | "-y". Width = (pins - 1) * pitch + 3 mm (JST SH/GH housings).
    """
    w = (pins - 1) * pitch + 3.0
    z0 = -height if bottom else PCB
    L, W = spec["length"], spec["width"]
    ax = {"+x": (1, 0), "-x": (-1, 0), "+y": (0, 1), "-y": (0, -1)}[edge]
    edge_c = (L / 2 - 0.3) if ax[0] else (W / 2 - 0.3)
    if ax[0]:
        cx, cy, sx, sy = ax[0] * (edge_c - depth / 2), along, depth, w
    else:
        cx, cy, sx, sy = along, ax[1] * (edge_c - depth / 2), w, depth
    with BuildPart() as b:
        with Locations(Pos(cx, cy, z0)):
            Box(sx, sy, height, align=MIN)
    a.body(b.part, f"socket_{name}")
    faces = [f for f in b.part.faces() if f.geom_type.name == "PLANE" and (f.normal_at().X * ax[0] + f.normal_at().Y * ax[1]) > 0.9]
    a.feature(name, faces)


def esc_pads(a: Artifact, pcb) -> None:
    """Motor pads on the side edges, battery pads on the rear edge, FC socket on the front edge.

    Motor groups keep the Betaflight Quad-X corners (M1 rear-right, M2 front-right,
    M3 rear-left, M4 front-left). Each group is three pads along the side edge,
    a innermost; the group is also one feature (the 3-phase parent).
    """
    e = PARAMS["esc"]
    L, W = e["length"], e["width"]
    corners = {"motor_1": (-1, -1), "motor_2": (1, -1), "motor_3": (-1, 1), "motor_4": (1, 1)}
    for iface, (sx, sy) in corners.items():
        tops = []
        with BuildPart() as pads:
            for k in range(3):
                with Locations(Pos(sx * (6.5 + k * 5.0), sy * (W / 2 - 2.2), PCB)):
                    Box(3.0, 4.0, 0.3, align=MIN)
        a.body(pads.part, f"{iface}_pads")
        tops = pads.part.faces().filter_by(Axis.Z).sort_by(Axis.Z)[-3:]
        a.feature(iface, tops)
        by_x = sorted(tops, key=lambda f: abs(f.center().X))
        for letter, f in zip("abc", by_x):
            a.feature(f"{iface}_{letter}", [f])
    # battery pads on the rear edge: + on the right (-Y), - on the left (+Y), as photographed
    pad(a, "bat_in", -L / 2 + 3.2, -5.5, (5.4, 7.0))
    pad(a, "bat_neg", -L / 2 + 3.2, 5.5, (5.4, 7.0))
    socket(a, "fc_socket", edge="+x", along=0, pins=8, pitch=1.0, depth=4.25, height=2.9, bottom=False, spec=e)


FC_PAD = (1.6, 2.2)


def fc_pads(a: Artifact, pcb) -> None:
    """Edge pads on the top face and the sockets on the underside (manual p3/p4).

    Right edge (-Y), front to rear: CUR RX3 TX3 GND 4.5V RX1 TX1 GND 5V SDA SCL.
    Rear edge (-X), left to right: TX4 RX4 4.5V GND TX2 RX2 TX5 VTX 10V GND.
    Front edge (+X), left to right: C1 C2 5V GND M4 M3 M2 M1 GND VBAT.
    A net with several pads (GND, 5V, 4.5V) is bound to the pad nearest the
    peripherals wired to it; the others are drawn but not bound.
    """
    f = PARAMS["fc"]
    L, W = f["length"], f["width"]
    right = ["CUR", "RX3", "TX3", "GND", "rail_4v5", "uart1_rx", "uart1_tx", "gnd", "bec_5v", "i2c1_sda", "i2c1_scl"]
    for i, n in enumerate(right):
        x = 11.5 - i * 2.3
        pad(a, n if n.islower() else "", x, -(W / 2 - 1.4), (FC_PAD[0], FC_PAD[1]), label=f"pad_r{i}_{n}")
    rear = ["TX4", "RX4", "4V5", "GND", "uart2_tx", "uart2_rx", "TX5", "VTX", "10V", "GND"]
    for i, n in enumerate(rear):
        y = 11.43 - i * 2.54
        pad(a, n if n.islower() else "", -(L / 2 - 1.4), y, (FC_PAD[1], FC_PAD[0]), label=f"pad_b{i}_{n}")
    front = ["C1", "C2", "5V", "GND", "M4", "M3", "M2", "M1", "GND", "VBAT"]
    for i, n in enumerate(front):
        y = 11.43 - i * 2.54
        pad(a, "", L / 2 - 1.4, y, (FC_PAD[1], FC_PAD[0]), label=f"pad_f{i}_{n}")
    # underside sockets (p4): front: RC (right), ESC (centre), CAM (left); rear: VTX (right), DJI (centre), GPS (left)
    socket(a, "esc_socket", edge="+x", along=0, pins=8, pitch=1.0, depth=4.25, height=2.9, bottom=True, spec=f)
    socket(a, "rc_socket", edge="+x", along=-11.0, pins=4, pitch=1.0, depth=4.25, height=2.9, bottom=True, spec=f)
    socket(a, "cam_socket", edge="+x", along=10.5, pins=3, pitch=1.0, depth=4.25, height=2.9, bottom=True, spec=f)
    socket(a, "dji_socket", edge="-x", along=0, pins=6, pitch=1.0, depth=4.25, height=2.9, bottom=True, spec=f)
    socket(a, "vtx_socket", edge="-x", along=-11.0, pins=4, pitch=1.0, depth=4.25, height=2.9, bottom=True, spec=f)
    socket(a, "gps_socket", edge="-x", along=11.0, pins=4, pitch=1.0, depth=4.25, height=2.9, bottom=True, spec=f)
    # USB-C receptacle on the left edge (p3), not bound (no cable in the build)
    with BuildPart() as usb:
        with Locations(Pos(-1.0, W / 2 - 3.6, PCB)):
            Box(8.9, 7.3, 3.2, align=MIN)
    a.body(usb.part, "usb_c")


def o4() -> None:
    o = PARAMS["o4"]
    mod, cam = o["module"], o["camera"]
    a = Artifact("dji-o4-air-unit", part_dir("dji-o4-air-unit"), HERE)
    s = mod["hole_spacing"] / 2
    with BuildPart() as tx:
        Box(mod["length"], mod["width"], mod["height"], align=MIN)
        with Locations(*[(x, y) for x in (-s, s) for y in (-s, s)]):
            Cylinder(mod["hole_diameter"] / 2, mod["height"], align=MIN, mode=Mode.SUBTRACT)
    a.body(tx.part, "transmission_module")
    a.feature("tx_module_mount", [f for f in tx.part.faces() if f.geom_type.name == "CYLINDER"])
    # the 3-in-1 cable socket on the module's front edge, top face (representative
    # position and size: DJI publishes neither)
    with BuildPart() as sock:
        with Locations(Pos(mod["length"] / 2 - 2.0, -7.0, mod["height"])):
            Box(4.0, 7.0, 1.6, align=MIN)
    a.body(sock.part, "cable_socket")
    a.feature("fc_cable_socket", [f for f in sock.part.faces() if f.geom_type.name == "PLANE" and f.normal_at().X > 0.9])
    a.write()

    # the camera is a separate body joined only by a cable: its own artifact and coordinates
    c = Artifact("dji-o4-camera", part_dir("dji-o4-air-unit"), HERE)
    with BuildPart() as camera:
        Box(cam["width"], cam["length"], cam["height"], align=(Align.CENTER, Align.CENTER, Align.CENTER))
        with Locations(Pos(0, cam["length"] / 2, 0) * Rot(90, 0, 0)):
            Cylinder(4.25, 2.5, align=MIN)  # lens, facing +Y
    c.body(camera.part, "camera")
    c.feature("camera_mount", [f for f in camera.part.faces() if f.geom_type.name == "PLANE" and abs(f.normal_at().X) > 0.9])
    c.write()


def battery() -> None:
    """Pack centred on X/Y, bottom at z = 0, length along X. The discharge lead
    leaves the rear end face (-X) and ends in the XT60 (female), straight as
    shipped; the xt60 frame is the connector's mating face (pin 1 = BAT+ on -Y)."""
    b = PARAMS["battery"]
    L, W, H = b["length"], b["width"], b["height"]
    lead, od = b["lead_length"], b["lead_od"]
    xt = PARAMS["xt60"]
    a = Artifact("cnhl-1100-6s", part_dir("cnhl-black-series-1100mah-6s-100c"), HERE)
    with BuildPart() as pack:
        Box(L, W, H, align=MIN)
        fillet(pack.edges().filter_by(Axis.X), radius=3.0)
    a.body(pack.part, "pack")
    zc = H - b["lead_exit_below_top"]
    for label, y in (("lead_pos", -xt["pitch"] / 2), ("lead_neg", xt["pitch"] / 2)):
        with BuildPart() as w:
            with Locations(Pos(-L / 2, y, zc) * Rot(0, -90, 0)):
                Cylinder(od / 2, lead, align=MIN)
        a.body(w.part, label)
    x0 = -L / 2 - lead
    with BuildPart() as plug:
        with Locations(Pos(x0 - xt["length"] / 2, 0, zc)):
            Box(xt["length"], xt["width"], xt["height"])
    a.body(plug.part, "xt60_housing")
    a.feature("xt60", [f for f in plug.part.faces() if f.geom_type.name == "PLANE" and f.normal_at().X < -0.9])
    a.write()


def receiver() -> None:
    """RadioMaster RP1 V2: 13 x 11 mm board, pads RX TX 5V G along one 11 mm
    edge (manual drawing, top view left to right), U.FL at the far end.
    X from the pad edge toward the U.FL; pads face +Z (solder from above)."""
    r = PARAMS["rp1"]
    L, W, H = r["length"], r["width"], r["height"]
    a = Artifact("radiomaster-rp1-v2", part_dir("radiomaster-rp1-v2-elrs-2g4"), HERE)
    t = 1.0  # representative PCB thickness
    with BuildPart() as pcb:
        Box(L, W, t, align=MIN)
    with BuildPart() as comps:
        with Locations(Pos(1.2, 0, t)):
            Box(L - 4.6, W - 1.6, H - t - 0.3, align=MIN)
    with BuildPart() as ufl:
        with Locations(Pos(L / 2 - 1.8, -W / 2 + 2.0, t)):
            Box(2.6, 2.6, 1.25, align=MIN)
    a.body(pcb.part, "pcb")
    a.body(comps.part, "components")
    a.body(ufl.part, "u_fl")
    for i, name in enumerate(["crsf_rx", "crsf_tx", "vcc_5v", "gnd"]):
        pad(a, name, -L / 2 + 1.1, -3.81 + i * 2.54, (1.6, 1.8), z=t)
    a.write()


def fasteners() -> None:
    f = PARAMS["fasteners"]
    a = Artifact("iso-4762-m3x30", part_dir("iso-4762-m3x30-socket-head-cap-screw"), HERE)
    with BuildPart() as screw:
        with Locations(Pos(0, 0, -3)):
            Cylinder(2.75, 3, align=MIN)
        Cylinder(f["screw_diameter"] / 2, f["screw_length"], align=MIN)
    a.body(screw.part, "screw")
    a.feature("thread", [x for x in screw.part.faces() if x.geom_type.name == "CYLINDER" and x.radius < 2])
    a.write()

    n = Artifact("iso-10511-m3-nyloc", part_dir("iso-10511-m3-nyloc-nut"), HERE)
    with BuildPart() as nut:
        with BuildSketch():
            RegularPolygon(f["nut_across_flats"] / math.sqrt(3), 6)
            Circle(1.5, mode=Mode.SUBTRACT)
        extrude(amount=f["nut_height"])
    n.body(nut.part, "nut")
    n.feature("thread", [x for x in nut.part.faces() if x.geom_type.name == "CYLINDER"])
    n.write()

    s = Artifact("ettinger-spacer-6mm", part_dir("ettinger-005-83-060-m3-nylon-spacer-6mm"), HERE)
    with BuildPart() as sp:
        Cylinder(f["spacer_od"] / 2, f["spacer_length"], align=MIN)
        Cylinder(f["spacer_id"] / 2, f["spacer_length"], align=MIN, mode=Mode.SUBTRACT)
    s.body(sp.part, "spacer")
    s.feature("bore", [x for x in sp.part.faces() if x.geom_type.name == "CYLINDER" and x.radius < 2])
    s.write()


def build() -> None:
    print("parts:")
    motor()
    propeller()
    board("dolphinrc-am32-60a-4in1-esc", "dolphinrc-am32-60a", PARAMS["esc"], esc_pads)
    board("dolphinrc-f405-v3-flight-controller", "dolphinrc-f405-v3", PARAMS["fc"], fc_pads)
    o4()
    battery()
    receiver()
    fasteners()


if __name__ == "__main__":
    build()
