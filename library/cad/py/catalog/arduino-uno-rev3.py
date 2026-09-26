"""Arduino UNO R3 (A000066): representative geometry (PB-796).

Arduino publishes no STEP for the UNO R3; its CAD download
(A000066-cad-files.zip, CC BY-SA 4.0) is the Eagle board UNO-TH_Rev3e.brd,
which gives the exact outline, holes and component placement. The board is
generated from it (sources.json src_cad; drawing cross-check src_datasheet
section 5.4):

  outline 68.58 x 53.34 mm (layer 20); 4 x Ø3.2 holes at (13.97, 2.54),
  (15.24, 50.8), (66.04, 7.62), (66.04, 35.56); female headers "H8.5"
  (8.5 mm): IOL 1x08 centred x 54.61 and IOH 1x10 centred x 30.226 at
  y 50.8, POWER 1x08 centred x 36.83 and AD 1x06 centred x 57.15 at y 2.54;
  USB-B X2 at (3.81, 38.1), DC jack X1 at (5.334, 8.382).

Coordinates: .brd coordinates shifted so the board centre is the origin
(x' = x - 34.29, y' = y - 26.67); PCB bottom at z = 0, components up (+Z);
USB-B and the DC jack face -X.
Assumptions (also `assumption` traits on the part):
  - 1.6 mm PCB; the 1 mm corner radii of the outline are chamfered;
  - USB-B body 16 x 12 x 10.9 mm from x = -6.35 (brd) and DC jack body
    14.2 x 9 x 11 mm from x = -1.8: sizes not dimensioned by Arduino.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import BuildLine, BuildPart, BuildSketch, Cylinder, Locations, Mode, Polyline, Pos, extrude, make_face  # noqa: E402

from partkit import MIN, GeneratedPart, block  # noqa: E402

PART_ID = "arduino-uno-rev3"
CX, CY = 68.58 / 2, 53.34 / 2
PCB = 1.6  # assumption
HOLE_D = 3.2  # brd drill, datasheet 4 x Ø3.20
OUTLINE = [(0, 1), (1, 0), (65.04, 0), (66.04, 1), (66.04, 2.54), (68.58, 5.08), (68.58, 37.846), (66.04, 40.386), (66.04, 51.816), (64.516, 53.34), (1, 53.34), (0, 52.34)]
HOLES = {"h1": (13.97, 2.54), "h2": (15.24, 50.8), "h3": (66.04, 7.62), "h4": (66.04, 35.56)}
HEADERS = {  # name: (centre x, y, pins)
    "iol": (54.61, 50.8, 8),
    "ioh": (30.226, 50.8, 10),
    "power": (36.83, 2.54, 8),
    "ad": (57.15, 2.54, 6),
}
HDR_H = 8.5  # "8x1F-H8.5"


def c(x: float, y: float) -> tuple[float, float]:
    return (x - CX, y - CY)


def hole_walls(centres, d: float, z0: float, h: float):
    """Untrimmed cylinder walls at the hole positions (boolean-cut walls can lose Face.radius)."""
    out = []
    for x, y in centres:
        s = Pos(x, y, z0) * Cylinder(d / 2, h, align=MIN)
        out += [f for f in s.faces() if f.geom_type.name == "CYLINDER"]
    return out


def build() -> None:
    a = GeneratedPart(PART_ID, "arduino-uno-r3", __file__)
    holes = {k: c(*v) for k, v in HOLES.items()}
    with BuildPart() as pcb:
        with BuildSketch():
            with BuildLine():
                Polyline(*[c(x, y) for x, y in OUTLINE], close=True)
            make_face()
        extrude(amount=PCB)
        with Locations(*holes.values()):
            Cylinder(HOLE_D / 2, PCB, align=MIN, mode=Mode.SUBTRACT)

    headers = {n: block(*c(x, y), PCB, n_pins * 2.54, 2.54, HDR_H) for n, (x, y, n_pins) in HEADERS.items()}
    usb = block(-6.35 + 8.0 - CX, 38.1 - CY, PCB, 16.0, 12.0, 10.9)
    jack = block(-1.8 + 7.1 - CX, 8.382 - CY, PCB, 14.2, 9.0, 11.0)

    a.body(pcb.part, "pcb")
    for n, h in headers.items():
        a.body(h, f"header_{n}")
    a.body(usb, "usb_b")
    a.body(jack, "dc_jack")

    # BoltPattern `mount`: the UNO R3 shield diagonal pair (h1, h4), 61.657 mm apart
    a.feature("mount", hole_walls([holes["h1"], holes["h4"]], HOLE_D, 0, PCB), axis=(0, 0, 1))
    a.feature("mount_all", hole_walls(list(holes.values()), HOLE_D, 0, PCB), axis=(0, 0, 1))
    for n, h in headers.items():
        a.feature(f"header_{n}", [f for f in h.faces() if f.geom_type.name == "PLANE" and f.normal_at().Z > 0.9])
    a.feature("usb", [f for f in usb.faces() if f.geom_type.name == "PLANE" and f.normal_at().X < -0.9])
    a.feature("dc_jack", [f for f in jack.faces() if f.geom_type.name == "PLANE" and f.normal_at().X < -0.9])
    a.write()


if __name__ == "__main__":
    build()
