"""Mounting hardware for the quadcopter's fastener harnesses (PB-775).

Screws, nuts, spacers and standoffs from library/systems/quadcopter-5in/
hardware.ts (via params.json "hardware"). Each part's origin is where its
fastenerStack position is measured: a screw's is under its head, thread
along +Z; the others sit on z = 0 and extend along +Z.
"""
from __future__ import annotations

import math
from pathlib import Path

from build123d import Align, BuildPart, BuildSketch, Circle, Cylinder, Locations, Mode, Pos, RegularPolygon, extrude

from common import PARAMS, Artifact, system_dir

HERE = Path(__file__)
MIN = (Align.CENTER, Align.CENTER, Align.MIN)


def build() -> None:
    out = system_dir("quadcopter-5in") / "hardware"
    for hw in PARAMS["hardware"]:
        a = Artifact(hw["id"], out, HERE)
        d, length = hw["diameter"], hw["length"]
        with BuildPart() as part:
            if hw["kind"] == "screw":
                with Locations(Pos(0, 0, -hw["head_height"])):
                    Cylinder(hw["head_diameter"] / 2, hw["head_height"], align=MIN)
                    with BuildSketch():
                        RegularPolygon(d * 0.45, 6)
                    extrude(amount=hw["head_height"] * 0.6, mode=Mode.SUBTRACT)
                Cylinder(d / 2 * 0.95, length, align=MIN)
            elif hw["kind"] == "nut":
                with BuildSketch():
                    RegularPolygon(hw["outer"] / math.sqrt(3), 6)
                    Circle(d / 2, mode=Mode.SUBTRACT)
                extrude(amount=length)
            elif hw["kind"] == "standoff":
                with BuildSketch():
                    RegularPolygon(hw["outer"] / math.sqrt(3), 6)
                    Circle(d / 2 * 0.85, mode=Mode.SUBTRACT)
                extrude(amount=length)
            else:
                Cylinder(hw["outer"] / 2, length, align=MIN)
                Cylinder(d / 2 + 0.2, length, align=MIN, mode=Mode.SUBTRACT)
        a.body(part.part, hw["kind"])
        a.write()


if __name__ == "__main__":
    print("hardware:")
    build()
