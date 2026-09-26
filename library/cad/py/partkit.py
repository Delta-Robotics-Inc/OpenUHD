"""Representative geometry for parts with no manufacturer CAD (PB-796).

A catalog script (library/cad/py/catalog/<id>.py) that finds no usable
vendor STEP models the part from datasheet dimensions with build123d and
writes it through `GeneratedPart`, which is common.Artifact plus hole/shaft
axes in the manifest:

    a = GeneratedPart("<id>", "<name>", __file__)
    a.body(pcb, "pcb")
    a.feature("mount", holes_of(pcb, 3.2), axis=(0, 0, 1))
    a.write()

Output (committed; representative geometry is ours to redistribute):
  library/parts/<id>/artifacts/cad/<name>.{step,glb,manifest.json}
  library/parts/<id>/artifacts/cad/interfaces/<feature>.glb

Model only what the interfaces need (outline, mounting holes, shaft,
connector bodies) and take every dimension from a cited source. Record
assumed dimensions as comments here and as `assumption` traits on the part.
"""
from __future__ import annotations

import json
from pathlib import Path

import build123d as bd
from build123d import Align, Box, BuildPart, Cylinder, Face, Locations, Mode, Pos, Shape

from common import Artifact, part_dir
from vendor_step import hole_axes, radius_of

MIN = (Align.CENTER, Align.CENTER, Align.MIN)


class GeneratedPart(Artifact):
    """common.Artifact that also records hole/shaft axes for features given an `axis`."""

    def __init__(self, part_id: str, name: str, generator: str | Path):
        super().__init__(name, part_dir(part_id), Path(generator))
        self.axes: dict[str, dict] = {}

    def feature(self, name: str, faces: list[Face], pad: float = 0.25, axis=None) -> None:  # type: ignore[override]
        super().feature(name, faces, pad)
        if axis is not None:
            self.axes[name] = hole_axes(faces, axis)

    def write(self) -> None:
        super().write()
        path = self.out / f"{self.name}.manifest.json"
        manifest = json.loads(path.read_text())
        manifest["tool"] = "build123d (representative geometry from datasheet dimensions, library/cad/py/partkit.py)"
        for n, extra in self.axes.items():
            manifest["features"][n].update(extra)
        path.write_text(json.dumps(manifest, indent=2) + "\n")


# ---------------------------------------------------------------------------
# Shape helpers
# ---------------------------------------------------------------------------


def cylinders(shape: Shape, diameter: float, tol: float = 0.05) -> list[Face]:
    """Cylindrical faces of `shape` with the given diameter (holes or shafts)."""
    return [
        f
        for f in shape.faces()
        if f.geom_type == bd.GeomType.CYLINDER and (r := radius_of(f)) is not None and abs(2 * r - diameter) <= tol
    ]


def extreme_face(shape: Shape, normal=(0, 0, 1)) -> list[Face]:
    """The planar face(s) of `shape` furthest along `normal` (e.g. a board's top)."""
    n = bd.Vector(*normal).normalized()
    fs = [f for f in shape.faces() if f.geom_type == bd.GeomType.PLANE and f.normal_at().dot(n) > 0.99]
    best = max(f.center(bd.CenterOf.MASS).dot(n) for f in fs)
    return [f for f in fs if abs(f.center(bd.CenterOf.MASS).dot(n) - best) < 0.05]


def board(length: float, width: float, thickness: float, holes: list[tuple[float, float]], hole_d: float, corner_r: float = 0.0):
    """A PCB outline centred on the origin, bottom face at z = 0, with through holes at (x, y)."""
    with BuildPart() as pcb:
        Box(length, width, thickness, align=MIN)
        if corner_r > 0:
            bd.fillet(pcb.edges().filter_by(bd.Axis.Z), corner_r)
        if holes:
            with Locations(*holes):
                Cylinder(hole_d / 2, thickness, align=MIN, mode=Mode.SUBTRACT)
    return pcb.part


def block(x: float, y: float, z0: float, lx: float, ly: float, lz: float):
    """An axis-aligned box whose bottom face is centred at (x, y, z0): components, connectors, housings."""
    with BuildPart() as b:
        with Locations(Pos(x, y, z0)):
            Box(lx, ly, lz, align=MIN)
    return b.part
