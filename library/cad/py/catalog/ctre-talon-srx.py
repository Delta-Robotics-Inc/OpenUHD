"""CTR Electronics Talon SRX (P/N 14-838288): bind UHD interfaces to the vendor STEP (PB-796).

Source: TalonSRX_CAD.zip from the CTRE product page
(https://ctre.download/cad/TalonSRX_CAD.zip), which holds Talon_SRX_14-838288.zip
(the STEP) and the VEXpro drawing 217-8080 (2015-01-20). No licence is stated
with the download, so the STEP stays in .research/cad/ (not redistributed).

The STEP is one unnamed assembly of 20 solids (case halves, leads, screws,
data-port hardware), so features are selected by geometry:

  mount         the two #8 clearance holes, (0, ±25.4) = 50.80 mm apart (drawing).
                They are drafted (conical), so vendor_step.holes() (cylinders
                only) does not see them: `_hole_faces` selects cones and
                cylinders on the two axes and `_patch_axes` adds the hole
                centres/diameter to the manifest afterwards.
  mount_face    the flat case face the part is mounted on (z = 0 after the transform).
  input_leads   the two 12 AWG 5.5 in power input leads (V+ red, GND black).
  output_leads  the two 12 AWG 5.5 in motor output leads (M+ white, M- green).
  signal_wires  the four 22 AWG 12 in CAN/PWM signal wires (2x yellow, 2x green).
  data_port     the 2x5 0.05 in Data Port header and its retention hardware.

Transform: the STEP has the Data Port face on -Z and the leads along Y. It is
rotated 180 deg about X and raised 16.55 mm so the plain case face (opposite
the #8 nut pockets and the Data Port) is at z = 0 facing -Z, body on +Z. The
#8 nut pockets are then on the top (+Z) side, and the screw comes up from the
frame through the case into the nut.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build123d as bd  # noqa: E402
from build123d import Location  # noqa: E402

from vendor_step import VendorStep, build as build_vendor, manifest_path, planar  # noqa: E402

PART = "ctre-talon-srx"
HOLES = [(0.0, -25.4), (0.0, 25.4)]  # after the transform
_picked: dict[str, list] = {}


def _radial(v, cx, cy) -> float:
    return ((v.X - cx) ** 2 + (v.Y - cy) ** 2) ** 0.5


def _hole_faces(name: str, centres, rmax: float = 3.0):
    """Cylindrical or conical faces on a Z axis through one of `centres`, radius < rmax."""

    def sel(shape):
        out = []
        for f in shape.faces():
            if f.geom_type not in (bd.GeomType.CYLINDER, bd.GeomType.CONE):
                continue
            ax = f.axis_of_rotation
            if abs(abs(ax.direction.Z) - 1) > 0.02:
                continue
            for cx, cy in centres:
                if abs(ax.position.X - cx) < 0.2 and abs(ax.position.Y - cy) < 0.2:
                    if max(_radial(v, cx, cy) for v in f.vertices()) < rmax:
                        out.append(f)
                    break
        _picked[name] = [(f, c) for f in out for c in centres
                         if abs(f.axis_of_rotation.position.X - c[0]) < 0.2 and abs(f.axis_of_rotation.position.Y - c[1]) < 0.2]
        return out

    return sel


def _solids_in(lo, hi, min_len_y: float = 0.0):
    """All faces of the solids whose bounding box lies inside lo..hi (and is at least min_len_y long in Y)."""

    def sel(shape):
        out = []
        for so in shape.solids():
            bb = so.bounding_box()
            if bb.max.Y - bb.min.Y >= min_len_y and all(lo[i] <= (bb.min.X, bb.min.Y, bb.min.Z)[i] and (bb.max.X, bb.max.Y, bb.max.Z)[i] <= hi[i] for i in range(3)):
                out.extend(so.faces())
        return out

    return sel


def _patch_axes(name: str) -> None:
    """Record hole centres (x, y, mean z) and the smallest hole diameter for a feature."""
    groups: dict[tuple, list] = {}
    for f, c in _picked[name]:
        groups.setdefault(c, []).append(f)
    centres, dmin = [], None
    for (cx, cy), faces in sorted(groups.items()):
        z = sum(f.center(bd.CenterOf.MASS).Z for f in faces) / len(faces)
        centres.append([round(cx, 3) + 0.0, round(cy, 3) + 0.0, round(z, 3) + 0.0])
        r = min(_radial(v, cx, cy) for f in faces for v in f.vertices())
        dmin = 2 * r if dmin is None else min(dmin, 2 * r)
    path = manifest_path(PART)
    m = json.loads(path.read_text())
    m["features"][name].update({"centres": centres, "diameter_mm": round(dmin, 3)})
    path.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n")


STEP = VendorStep(
    part_id=PART,
    step="Talon_SRX_14-838288.STEP",
    archive="TalonSRX_CAD.zip",
    name="Talon_SRX_14-838288",
    url="https://ctre.download/cad/TalonSRX_CAD.zip",
    licence="not stated by CTR Electronics (not redistributed)",
    transform=Location((0, 0, 16.5501), (180, 0, 0)),
    features={
        "mount": _hole_faces("mount", HOLES),
        "mount_face": planar((0, 0, -1), min_area=50),
        "input_leads": _solids_in((-13, -176, 0), (13, -15, 30), min_len_y=100),
        "output_leads": _solids_in((-13, 15, 0), (13, 176, 30), min_len_y=100),
        "signal_wires": _solids_in((-14, -318, 0), (14, -5, 30), min_len_y=250),
        "data_port": _solids_in((-13, -17, 18), (13, -9, 30.1)),
    },
    interfaces=["mount"],
    notes=[
        "Transform: rotated 180 deg about X and raised 16.55 mm; the plain case face is z = 0 (normal -Z), body on +Z.",
        "mount: 2 x #8 clearance holes (drafted, min Ø4.44 in the model; drawing Ø4.50) at (0, ±25.4) = 50.80 mm apart, "
        "centres added by catalog/ctre-talon-srx.py because vendor_step.holes() only selects cylinders.",
        "Case 69.9 x 30.5 x 25.2 mm (drawing 69.85 x 30 x 25.20 plus nut-pocket height 22.65).",
        "Input leads (V+, GND) and the four signal wires leave the -Y end; the motor output leads (M+, M-) leave the +Y end.",
        "Data Port (2x5, 0.05 in) on the +Z side at y = -13.05, between two 4-40 threaded holes 19.05 mm apart.",
    ],
)


def build() -> None:
    if build_vendor(STEP):
        _patch_axes("mount")


if __name__ == "__main__":
    build()
