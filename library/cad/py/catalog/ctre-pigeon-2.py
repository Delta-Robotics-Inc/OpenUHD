"""CTR Electronics Pigeon 2.0 IMU (P/N 21-737785): bind UHD interfaces to the vendor STEP (PB-796).

Source: "Pigeon 2.zip" from CTRE's Device-CADs GitHub repository
(https://github.com/CrossTheRoadElec/Device-CADs/raw/master/PIGEON_2_CAD/Pigeon%202.zip),
linked from the CTRE product page. The repository has no licence file and the
ReadMe states no terms, so the STEP stays in .research/cad/ (not redistributed).

Vendor components: Pigeon_2 (PCB + two LEDs), Bot_Housing, Top_Housing,
Overlay1/2. Features:

  mount        the two diagonal Ø3.26 through holes with Ø4.83 counterbores on
               top: (-14.478, 14.478) and (14.478, -14.478), i.e. two corners
               of the 28.96 mm square in the user's guide drawing. The other two
               corners hold the housing screws (counterbored from the bottom,
               not through) and are excluded.
  mount_face   the bottom face of the housing (z = 0 after the transform).
  lead_exit    the boss on +Y where the power and CAN leads leave the housing.

No feature is selected by vendor label: with a `transform`, label() returns the
child component's faces in the untransformed coordinates (vendor_step.py
moves the top-level compound only), so every feature here is geometric.

Transform: raised 5.9814 mm so the housing bottom is z = 0 (Z up, matching
the XYZ logo / default mount orientation: +X forward, +Y left, +Z up).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Location  # noqa: E402

from vendor_step import VendorStep, build as build_vendor, holes, planar, within_box  # noqa: E402

THROUGH = [(-14.478, 14.478), (14.478, -14.478)]


def _through_holes():
    base = holes(3.26, tol=0.05)

    def sel(shape):
        out = []
        for f in base(shape):
            p = f.axis_of_rotation.position
            if any(abs(p.X - x) < 0.1 and abs(p.Y - y) < 0.1 for x, y in THROUGH):
                out.append(f)
        return out

    sel.kind = "holes"  # type: ignore[attr-defined]
    sel.axis = (0, 0, 1)  # type: ignore[attr-defined]
    return sel


def _all_faces(shape):
    return list(shape.faces())


STEP = VendorStep(
    part_id="ctre-pigeon-2",
    step="Pigeon 2.STEP",
    archive="Pigeon 2.zip",
    name="Pigeon_2",
    url="https://github.com/CrossTheRoadElec/Device-CADs/raw/master/PIGEON_2_CAD/Pigeon%202.zip",
    licence="not stated by CTR Electronics (repository has no licence file; not redistributed)",
    transform=Location((0, 0, 5.9814)),
    features={
        "mount": _through_holes(),
        "mount_face": planar((0, 0, -1), min_area=100),
        "lead_exit": within_box(_all_faces, (-23, 22.6, -1), (23, 25, 14)),
    },
    interfaces=["mount"],
    notes=[
        "Transform: raised 5.9814 mm; housing bottom at z = 0, Z up.",
        "Housing 44.96 x 44.96 x 12.95 mm (user's guide drawing); the model adds the lead boss to y = +24.38 (lead exit at +Y).",
        "mount: 2 x Ø3.26 through holes, Ø4.83 counterbore on top, at (-14.478, 14.478) and (14.478, -14.478): "
        "diagonal corners of a 28.96 x 28.96 mm square (drawing). The other two corners are housing screws.",
    ],
)


def build() -> None:
    build_vendor(STEP)


if __name__ == "__main__":
    build()
