"""Shared helpers for the build123d generators (PB-775).

Every generator produces, per module:
  <name>.step / <name>.glb        the body, with each interface feature as a
                                   named sub-shape (direction D1 "feature")
  <name>.manifest.json             feature name -> geometric signature, plus
                                   provenance (tool, version, source digest)
  interfaces/<interface>.glb       one artifact per interface (direction D2)
Direction D3 ("procedural") needs no file: the viewer derives geometry from
the interface parameters and the frame stored in UHD.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import build123d as bd
from build123d import Compound, Face, Shape, export_gltf, export_step

ROOT = Path(__file__).resolve().parents[3]  # uhd repo root
PARAMS = json.loads((ROOT / "library/cad/params.json").read_text())


def part_dir(part_id: str) -> Path:
    return ROOT / "library/parts" / part_id / "artifacts/cad"


def system_dir(system_id: str) -> Path:
    return ROOT / "library/systems" / system_id / "artifacts/cad"


def digest(*paths: Path) -> str:
    h = hashlib.sha256()
    for p in paths:
        h.update(Path(p).read_bytes())
    h.update(json.dumps(PARAMS, sort_keys=True).encode())
    return h.hexdigest()


def signature(faces: list[Face]) -> dict:
    """Area, area-weighted centroid and (if all coplanar-parallel) the shared normal."""
    area = sum(f.area for f in faces)
    cx = sum(f.center(bd.CenterOf.MASS).X * f.area for f in faces) / area
    cy = sum(f.center(bd.CenterOf.MASS).Y * f.area for f in faces) / area
    cz = sum(f.center(bd.CenterOf.MASS).Z * f.area for f in faces) / area
    sig = {"area_mm2": round(area, 3), "centroid": [round(cx, 3) + 0.0, round(cy, 3) + 0.0, round(cz, 3) + 0.0], "faces": len(faces)}
    normals = []
    for f in faces:
        if f.geom_type == bd.GeomType.PLANE:
            n = f.normal_at()
            normals.append((round(n.X, 3) + 0.0, round(n.Y, 3) + 0.0, round(n.Z, 3) + 0.0))
    if normals and len(set(normals)) == 1 and len(normals) == len(faces):
        sig["normal"] = list(normals[0])
    return sig


class Artifact:
    """Collects a module's body plus its named interface features, then writes everything."""

    def __init__(self, name: str, out_dir: Path, generator: Path):
        self.name = name
        self.out = out_dir
        self.generator = generator
        self.parts: list[Shape] = []
        self.features: dict[str, list[Face]] = {}
        self.interface_shapes: dict[str, Shape] = {}

    def body(self, shape: Shape, label: str) -> Shape:
        shape.label = label
        self.parts.append(shape)
        return shape

    def feature(self, name: str, faces: list[Face], pad: float = 0.25) -> None:
        """Name an interface feature: its faces, and a thin named pad over them.

        The pad goes into the body compound (D1: a named sub-shape a viewer can
        highlight) and also into interfaces/<name>.glb (D2).
        """
        if not faces:
            raise ValueError(f"{self.name}: feature {name!r} selected no faces")
        self.features[name] = faces
        solids = []
        for f in faces:
            if f.geom_type == bd.GeomType.PLANE:
                solids.append(bd.Solid.extrude(f, f.normal_at() * pad))
            else:
                solids.append(bd.Solid.thicken(f, pad))
        shape = Compound(label=name, children=solids)
        self.interface_shapes[name] = shape

    def write(self) -> None:
        self.out.mkdir(parents=True, exist_ok=True)
        (self.out / "interfaces").mkdir(exist_ok=True)
        features = [Compound(label=n, children=[s]) for n, s in self.interface_shapes.items()]
        whole = Compound(label=self.name, children=[*self.parts, *features])
        export_step(whole, str(self.out / f"{self.name}.step"))
        export_gltf(whole, str(self.out / f"{self.name}.glb"), binary=True, linear_deflection=0.05, angular_deflection=0.3)
        for n, s in self.interface_shapes.items():
            export_gltf(Compound(label=n, children=[s]), str(self.out / "interfaces" / f"{n}.glb"), binary=True)
        manifest = {
            "artifact": self.name,
            "tool": "build123d",
            "toolVersion": bd.__version__,
            "sourceDigest": digest(self.generator, Path(__file__)),
            "units": "mm",
            "features": {n: signature(f) for n, f in self.features.items()},
        }
        (self.out / f"{self.name}.manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"  {self.out.relative_to(ROOT)}/{self.name}.{{step,glb,manifest.json}} + {len(self.interface_shapes)} interface artifact(s)")
