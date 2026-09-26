"""REV Robotics Power Distribution Hub (REV-11-1850): bind UHD interfaces to vendor CAD.

Manufacturer STEP (https://www.revrobotics.com/content/cad/REV-11-1850.STEP,
69.5 MB; the product page links only an Onshape document, this file is the
matching REV "content/cad" download) kept in
library/parts/rev-power-distribution-hub/.research/cad/ and not committed:
REV states no redistribution licence, and it is far over the 5 MB limit.

The STEP ("REV-11-1850_PUBLIC_CAD") is one flat compound of 403 unlabelled
solids, so every feature is selected by position. Vendor frame: bottom face
at y = 0, height along +Y (39.7 mm), length along Z with the battery / CAN /
USB end at +Z. `transform` = Rot(90, 0, 0): (x, y, z) -> (x, -z, y), so the
bottom (mounting) face is z = 0, the top faces +Z and the battery end is at
-Y. Coordinates below are after the transform.

Layout (drawing REV-11-1850-DR, top view, battery end at the bottom):
  - 20 high-current WAGO 2606 channel pairs: +X column = channels 0-9
    (channel 0 nearest the battery end), -X column = channels 10-19
    (channel 19 nearest the battery end);
  - low-current WAGO block (channels 20-22 and switchable 23) at -X near the
    battery end; CAN WAGO block (4 poles) and USB-C beside it; battery
    input WAGO 2616 pair (+, -) at +X on the battery end.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build123d as bd
from build123d import Rot

from vendor_step import VendorStep, build as build_vendor, planar


def solids_in(lo, hi):
    """Faces of every solid whose bounding box lies inside lo..hi (mm)."""

    def sel(shape):
        out = []
        for s in shape.solids():
            b = s.bounding_box()
            if all(lo[i] <= (b.min.X, b.min.Y, b.min.Z)[i] and (b.max.X, b.max.Y, b.max.Z)[i] <= hi[i] for i in range(3)):
                out.extend(s.faces())
        return out

    return sel


def mount_holes(shape):
    """The four Φ5.0 corner through-holes at (±50.8, ±107.95) (vertical axis)."""
    out = []
    for f in shape.faces():
        if f.geom_type != bd.GeomType.CYLINDER or abs(2 * f.radius - 5.0) > 0.03:
            continue
        a = f.axis_of_rotation
        if abs(abs(a.direction.Z) - 1) > 0.01:
            continue
        if abs(abs(a.position.X) - 50.8) < 0.5 and abs(abs(a.position.Y) - 107.95) < 0.5:
            out.append(f)
    return out


mount_holes.kind = "holes"  # type: ignore[attr-defined]
mount_holes.axis = (0, 0, 1)  # type: ignore[attr-defined]


STEP = VendorStep(
    part_id="rev-power-distribution-hub",
    step="REV-11-1850.STEP",
    name="REV-11-1850",
    url="https://www.revrobotics.com/content/cad/REV-11-1850.STEP",
    licence="not stated by REV Robotics (not redistributed)",
    transform=Rot(90, 0, 0),
    features={
        "mount": mount_holes,
        "bottom": planar((0, 0, -1), min_area=5000),
        # high-current WAGO 2606 terminals: +X column channels 0-9, -X column channels 10-19
        "hc_terminals_0_9": solids_in((32.0, -57.0, 2.0), (56.5, 101.0, 31.0)),
        "hc_terminals_10_19": solids_in((-56.5, -56.0, 2.0), (-32.0, 102.0, 31.0)),
        # low-current WAGO block (channels 20-22 + switchable 23, 8 poles)
        "lc_terminals": solids_in((-53.2, -87.0, 2.5), (-41.0, -57.0, 20.0)),
        # CAN WAGO block (CANH/CANL in and out, 4 poles + end plate)
        "can_terminals": solids_in((-30.2, -107.8, 7.5), (-14.3, -95.5, 25.0)),
        # USB-C receptacle (vertical, left of the CAN block)
        "usb_c": solids_in((-40.6, -106.2, 10.0), (-35.9, -97.2, 18.2)),
        # battery input WAGO 2616 pair (+ at x 12-24, - at x 27-39) with levers
        "battery_terminals": solids_in((12.0, -114.5, 2.4), (40.1, -82.3, 39.8)),
    },
    # only the holes get their own GLB: faces of the WAGO terminal solids do not all thicken (vendor_step exports interface GLBs by thickening)
    interfaces=["mount"],
    notes=[
        "Vendor STEP is one flat compound of 403 unlabelled solids; features are whole solids selected by position after the transform.",
        "transform: Rot(90, 0, 0): vendor (x, y, z) -> (x, -z, y). Bottom (mounting) face z = 0, top at z = 39.72; battery/CAN/USB end at -Y.",
        "mount: 4 x Φ5.0 through holes at (±50.8, ±107.95): a 101.6 x 215.9 mm rectangle (drawing 4.00 x 8.50 in).",
        "Body 111.1 x 225.4 mm (drawing); the bbox Y range (-114.4 .. 112.7) includes the battery WAGO levers.",
        "Channel-to-terminal order is from the drawing's silkscreen (0 and 1 at the battery end of the +X column, 19 and 18 at the battery end of the -X column); the STEP carries no channel labels.",
    ],
)


def build() -> None:
    build_vendor(STEP)


if __name__ == "__main__":
    build()
