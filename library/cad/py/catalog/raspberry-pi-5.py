"""Raspberry Pi 5: manufacturer STEP binding (PB-796).

Vendor model: RaspberryPi5-step.zip from datasheets.raspberrypi.com
(rpi-5b_no_graphics.step, 77.6 MB; MIT licence per the LICENSE.txt in the
archive). Too large to commit (> 5 MB), so it stays in .research/cad/.

The STEP is used as placed (no transform): mm, Z up, PCB 0..85 x 0..56 with
its bottom at z ~ 0.03, the 40-pin header along y ~ 52.5, the USB-C and
micro-HDMI connectors on the y = 0 edge, the USB/Ethernet stacks on the
x = 85 edge. Component labels are generic ("OBJ3735"), so every feature is
selected by geometry.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build123d as bd  # noqa: E402

from vendor_step import VendorStep, build as build_vendor, holes, within_box  # noqa: E402

LICENCE = "MIT (LICENSE.txt in RaspberryPi5-step.zip, Copyright (c) 2026 Raspberry Pi Ltd); not committed: 77.6 MB STEP exceeds the 5 MB limit."


def front(normal, lo, hi):
    """Planar faces facing `normal` whose centre lies in lo..hi, keeping only the outermost ones."""

    def sel(shape):
        n = bd.Vector(*normal).normalized()
        fs = []
        for f in shape.faces():
            if f.geom_type != bd.GeomType.PLANE or f.normal_at().dot(n) < 0.99:
                continue
            c = f.center(bd.CenterOf.BOUNDING_BOX)
            if all(lo[i] <= (c.X, c.Y, c.Z)[i] <= hi[i] for i in range(3)):
                fs.append(f)
        if not fs:
            return fs
        best = max(f.center(bd.CenterOf.MASS).dot(n) for f in fs)
        return [f for f in fs if abs(f.center(bd.CenterOf.MASS).dot(n) - best) < 0.3]

    return sel


def build() -> None:
    build_vendor(
        VendorStep(
            part_id="raspberry-pi-5",
            step="rpi-5b_no_graphics.step",
            archive="RaspberryPi5-step.zip",
            name="raspberry-pi-5",
            features={
                # 4 x Ø2.7 mounting holes on 58 x 49 (the Ø2.7 group near x 75-79 is the Ethernet jack's pegs)
                "mount": within_box(holes(2.7, tol=0.05), (0, 0, -5), (65, 56, 5)),
                # top face of the 2x20 GPIO header (vendor component OBJ3735)
                "gpio_header": front((0, 0, 1), (6, 49, 7), (59, 56, 10)),
                # connector mating faces
                "usb_c": front((0, -1, 0), (5, -3, 0), (17, 3, 6)),
                "hdmi0": front((0, -1, 0), (21, -3, 0), (31, 3, 6)),
                "hdmi1": front((0, -1, 0), (34, -3, 0), (45, 3, 6)),
                "ethernet": front((1, 0, 0), (80, 0, 0), (90, 20, 20)),
                "usb_stack_a": front((1, 0, 0), (80, 21, 0), (90, 37, 20)),
                "usb_stack_b": front((1, 0, 0), (80, 38, 0), (90, 56, 20)),
            },
            interfaces=["mount", "gpio_header", "usb_c"],
            url="https://datasheets.raspberrypi.com/rpi5/RaspberryPi5-step.zip",
            licence=LICENCE,
            notes=[
                "No transform: STEP coordinates as published (PCB bottom z ~ 0.03, Z up).",
                "Features selected by geometry; vendor labels are generic OBJ numbers.",
                "Which USB stack (usb_stack_a at y ~29, usb_stack_b at y ~47) carries the USB 3.0 ports is not established from the STEP.",
            ],
        )
    )


if __name__ == "__main__":
    build()
