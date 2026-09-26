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
    # three phase leads leaving the base on +X (representative routing), one
    # body each so every leaf interface (phase_a/b/c) has its own lead end
    leads = {}
    for letter, dy in (("a", -2.2), ("b", 0.0), ("c", 2.2)):
        with BuildPart() as lead:
            with Locations(Pos(m["diameter"] / 2 - 1, dy, 1.5) * Rot(0, 90, 0)):
                Cylinder(0.8, 12, align=MIN)
        leads[letter] = lead.part
    a.body(base.part, "base")
    a.body(bell.part, "bell")
    a.body(shaft.part, "shaft_body")
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
    a.body(pcb.part, "pcb")
    a.body(parts_.part, "components")
    holes = [f for f in pcb.part.faces() if f.geom_type.name == "CYLINDER"]
    a.feature("stack_mount", holes)
    if extra:
        extra(a, pcb.part)
    a.write()


def esc_pads(a: Artifact, pcb) -> None:
    """Motor pad groups at the four corners (Betaflight Quad-X: M1 rear-right, M2 front-right, M3 rear-left, M4 front-left)."""
    e = PARAMS["esc"]
    corners = {"motor_1": (-1, -1), "motor_2": (1, -1), "motor_3": (-1, 1), "motor_4": (1, 1)}  # X forward, Y left
    for iface, (sx, sy) in corners.items():
        with BuildPart() as pads:
            for k in range(3):
                with Locations(Pos(sx * (e["length"] / 2 - 2.5), sy * (e["width"] / 2 - 4 - k * 3.2), PCB)):
                    Box(3.5, 2.4, 0.3, align=MIN)
        a.body(pads.part, f"{iface}_pads")
        a.feature(iface, pads.part.faces().filter_by(Axis.Z).sort_by(Axis.Z)[-3:])


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
    b = PARAMS["battery"]
    a = Artifact("cnhl-1100-6s", part_dir("cnhl-black-series-1100mah-6s-100c"), HERE)
    with BuildPart() as pack:
        Box(b["width"], b["length"], b["height"], align=MIN)
    a.body(pack.part, "pack")
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
    board("dolphinrc-f405-v3-flight-controller", "dolphinrc-f405-v3", PARAMS["fc"])
    o4()
    battery()
    fasteners()


if __name__ == "__main__":
    build()
