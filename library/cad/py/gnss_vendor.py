"""Matek M9N-5883: bind UHD interfaces to *vendor* CAD (PB-775, direction "vendor").

The first vendor-CAD part; since PB-796 it is a thin configuration of
vendor_step.py, the reusable version of this script. It reads the
manufacturer's STEP (downloaded by the part research into .research/cad, not
committed: redistribution terms are not stated), converts it to GLB for the
viewer, and writes a manifest of the vendor's own named components so UHD
interfaces can reference them by name:

  GH6P-1, GH6P-2   the two JST-GH-6P sockets (identical pinout 5V RX TX CL DA G)
  MAG              the QMC5883 compass
  ANTENNA          25 x 25 x 4 mm patch
  mount            the four Φ2.1 mm holes in "Board" (selected by radius)

Converted files go to artifacts/cad/vendor/ (gitignored); the manifest is
committed so bindings can be checked without the vendor file.
"""
from __future__ import annotations

from vendor_step import VendorStep, build as build_vendor, holes, label, planar

STEP = VendorStep(
    part_id="matek-m9n-5883",
    step="M9N-5883.step",
    archive="M9N-5883_step.zip",
    name="M9N-5883",
    url="https://www.mateksys.com/Downloads/other/M9N-5883_step.zip",
    licence="not stated by Matek (not redistributed)",
    features={
        "GH6P-1": label("GH6P-1"),
        "GH6P-2": label("GH6P-2"),
        "MAG": label("MAG"),
        "ANTENNA": label("ANTENNA"),
        "GPS": label("GPS"),
        "mount": holes(2.1, tol=0.1, within="Board"),
        "component_side": planar((0, 0, 1), within="Board", min_area=500),
    },
    interfaces=["GH6P-1", "GH6P-2", "MAG", "mount"],
    notes=[
        "Board is 32 x 32 x 0.62 mm, top face at z = 0, components on +Z.",
        "Mount holes: 4 x Φ2.1 on a 26 x 26 mm square centred on the board (±13, ±13).",
        "The patch antenna is on -Z (z -5.12 … 1.03): the module mounts component side toward the frame, antenna up.",
        "GH6P connectors reach z = 4.35 on the component side: the frame mount needs ≥ 4.5 mm standoffs.",
    ],
)


def build() -> None:
    build_vendor(STEP)


if __name__ == "__main__":
    print("gnss (vendor):")
    build()
