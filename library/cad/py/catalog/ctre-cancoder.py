"""CTR Electronics CANcoder (Standard, P/N 19-676768): bind UHD interfaces to the vendor STEP (PB-796).

Source: Cancoder_CAD.zip from the CTRE product page
(https://ctre.download/cad/Cancoder_CAD.zip). It holds two unassembled STEP
files, Housing.STEP and "PCB Assembly.STEP", in unrelated coordinates. No
licence is stated, so nothing is redistributed.

Only Housing.STEP is bound: it is the outer body the user mounts (its
21.748 x 26.908 mm outline and hole pattern match the user's guide "Bottom
View"), and the PCB sits inside it. The PCB STEP is recorded in sources.json
as evidence (six 100 mil through-holes GND, CANL x2, CANH x2, V+ per the
user's guide), not bound.

Many of the housing's cylindrical faces report no radius through build123d
(`Face.radius` is None), so vendor_step.holes() cannot be used on this file
(it would raise). `_cyl` reads the radius from the OCC surface instead and
`_patch_axes` adds the hole centres/diameter to the manifest afterwards.

  mount          the two Ø2.642 holes for the kit's 3-48 mounting screws,
                 14.884 mm apart, symmetric about the magnet axis (drawing).
  mount_face     the housing bottom (z = 0 after the transform), facing -Z.
  magnet_detent  the Ø6.731 recess in the bottom face on the sensing axis;
                 the magnet sits 0.75-1.5 mm from this detent (user's guide 2.1).
  wire_exit      the two lead-exit bosses at the housing tab (-Y end).

Transform: translated (0, +2.6735, -5.7419) so the sensing axis is the Z
axis and the housing bottom (the face against the mechanism) is z = 0; the
housing extends to +Z.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build123d as bd  # noqa: E402
from build123d import Location  # noqa: E402
from OCP.BRepAdaptor import BRepAdaptor_Surface  # noqa: E402
from OCP.GeomAbs import GeomAbs_Cylinder  # noqa: E402

from vendor_step import VendorStep, build as build_vendor, manifest_path, planar, within_box  # noqa: E402

PART = "ctre-cancoder"
_picked: dict[str, list] = {}


def _occ_radius(f):
    ad = BRepAdaptor_Surface(f.wrapped)
    return ad.Cylinder().Radius() if ad.GetType() == GeomAbs_Cylinder else None


def _cyl(name: str, diameter: float, tol: float = 0.02):
    """Z-axis cylindrical faces of the given diameter, radius read from the OCC surface."""

    def sel(shape):
        out = []
        for f in shape.faces():
            r = _occ_radius(f)
            if r is None or abs(2 * r - diameter) > tol:
                continue
            if abs(abs(f.axis_of_rotation.direction.Z) - 1) > 0.02:
                continue
            out.append(f)
        _picked[name] = out
        return out

    return sel


def _patch_axes(name: str) -> None:
    groups: dict[tuple, list] = {}
    for f in _picked[name]:
        p = f.axis_of_rotation.position
        groups.setdefault((round(p.X, 2), round(p.Y, 2)), []).append(f)
    centres = []
    for faces in groups.values():
        p = faces[0].axis_of_rotation.position
        z = sum(f.center(bd.CenterOf.MASS).Z for f in faces) / len(faces)
        centres.append([round(p.X, 3) + 0.0, round(p.Y, 3) + 0.0, round(z, 3) + 0.0])
    centres.sort()
    d = 2 * sum(_occ_radius(f) for f in _picked[name]) / len(_picked[name])
    path = manifest_path(PART)
    m = json.loads(path.read_text())
    m["features"][name].update({"centres": centres, "diameter_mm": round(d, 3)})
    path.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n")


def _all_faces(shape):
    return list(shape.faces())


STEP = VendorStep(
    part_id=PART,
    step="Housing.STEP",
    archive="Cancoder_CAD.zip",
    name="CANcoder_Housing",
    url="https://ctre.download/cad/Cancoder_CAD.zip",
    licence="not stated by CTR Electronics (not redistributed)",
    transform=Location((0, 2.67351, -5.74186)),
    features={
        "mount": _cyl("mount", 2.6416),
        "mount_face": planar((0, 0, -1), min_area=100),
        "magnet_detent": _cyl("magnet_detent", 6.731),
        "wire_exit": within_box(_all_faces, (-9, -17.6, 3.5), (9, -12, 12)),
    },
    interfaces=[],
    notes=[
        "Housing.STEP only (the zip's PCB Assembly.STEP is in separate, unassembled coordinates).",
        "Transform: translated (0, +2.6735, -5.7419): sensing (magnet) axis = Z axis, housing bottom at z = 0, body on +Z.",
        "mount: 2 x Ø2.642 holes (3-48 screws, kit) 14.884 mm apart through the magnet axis, counterbored Ø6.096 from inside the housing.",
        "Outline 21.75 x 26.91 mm (drawing 21.748 x 26.908); the magnet axis is 16.637 mm from the tab end (drawing).",
        "Several housing cylinders report no radius through build123d; catalog/ctre-cancoder.py reads it from the OCC surface.",
    ],
)


def build() -> None:
    if build_vendor(STEP):
        _patch_axes("mount")
        _patch_axes("magnet_detent")


if __name__ == "__main__":
    build()
