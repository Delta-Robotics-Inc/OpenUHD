"""REV Robotics Through Bore Encoder V1 (REV-11-1271): bind UHD interfaces to vendor CAD.

Manufacturer STEP from the product page ("Through Bore Encoder V1
(REV-11-1271) STEP File", https://www.revrobotics.com/content/cad/REV-11-1271.STEP),
downloaded into library/parts/rev-through-bore-encoder-v1/.research/cad/ and
not committed (REV states no redistribution licence).

The STEP is a labelled assembly (housing REV-11-1271-1, hex hub
REV-11-1271-3_Alt, bearings, JST connector S6B-PH-K-S, screws). No transform:
the bore axis is Z through the origin, the two mounting ears' bottom faces
(the mounting face) are at z = -2 (the 2.0 mm ear offset on the drawing) and
the housing top is at z = 13.83. (A transform is avoided because
vendor_step.find() returns labelled components in their untransformed
position, which would misplace the hex_bore/connector features.)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build123d as bd

from vendor_step import VendorStep, build as build_vendor, find, holes, label, planar


def hex_bore(shape):
    """The six 1/2 in hex flats of the hub (REV-11-1271-3_Alt): planar, parallel to the bore axis."""
    hub = find(shape, "REV-11-1271-3_Alt")
    return [
        f
        for f in hub.faces()
        if f.geom_type == bd.GeomType.PLANE and abs(f.normal_at().Z) < 0.01 and f.area > 40
    ]


STEP = VendorStep(
    part_id="rev-through-bore-encoder-v1",
    step="REV-11-1271.STEP",
    name="REV-11-1271",
    url="https://www.revrobotics.com/content/cad/REV-11-1271.STEP",
    licence="not stated by REV Robotics (not redistributed)",
    features={
        # two slotted #10-clearance ear holes (Φ4.98 slot ends at radius 22.9 and 25.4 mm)
        "mount": holes(4.98, tol=0.05),
        # bottom faces of the two ears (the mounting face, z = -2)
        "mount_face": planar((0, 0, -1)),
        # 1/2 in hex through bore (six flats of the hub)
        "hex_bore": hex_bore,
        # JST-PH 6-pin header (JST S6B-PH-K-S, side entry)
        "connector": label("S6B-PH-K-S"),
    },
    interfaces=["mount", "hex_bore", "connector"],
    notes=[
        "No transform: the ears' bottom faces (mounting face) are at z = -2, bore axis is Z through the origin.",
        "mount: each ear hole is a slot, Φ4.98, from radius 22.9 to 25.4 mm; the outer slot ends are 50.8 mm apart through the bore centre (drawing: Φ50.80 / 2.0 in, Φ4.98 / 0.196 in).",
        "hex_bore: the six flats of hub REV-11-1271-3_Alt, 12.78 mm across flats in the model (1/2 in hex).",
        "connector: JST S6B-PH-K-S (6-pin PH, side entry) at +X.",
    ],
)


def build() -> None:
    build_vendor(STEP)


if __name__ == "__main__":
    build()
