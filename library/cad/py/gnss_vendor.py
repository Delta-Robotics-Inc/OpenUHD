"""Matek M9N-5883: bind UHD interfaces to *vendor* CAD (PB-775, direction "vendor").

Unlike the other generators this one does not model anything. It reads the
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

import hashlib
import json
from pathlib import Path

import build123d as bd
from build123d import CenterOf, Compound, export_gltf, import_step

from common import ROOT, part_dir, signature

PART = "matek-m9n-5883"
SOURCE = ROOT / "library/parts" / PART / ".research/cad/M9N-5883.step"
ZIP = SOURCE.with_name("M9N-5883_step.zip")
OUT = part_dir(PART) / "vendor"
NAMED = ["GH6P-1", "GH6P-2", "MAG", "ANTENNA", "GPS"]


def build() -> None:
    if not SOURCE.exists():
        print(f"  skipped: {SOURCE.relative_to(ROOT)} not present (download M9N-5883_step.zip from mateksys.com)")
        return
    shape = import_step(str(SOURCE))
    by_label = {c.label: c for c in shape.children}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "interfaces").mkdir(exist_ok=True)

    features: dict[str, dict] = {}
    for name in NAMED:
        c = by_label[name]
        features[name] = signature(list(c.faces()))
    board = by_label["Board"]
    holes = [f for f in board.faces() if f.geom_type == bd.GeomType.CYLINDER and abs(f.radius - 1.05) < 0.05]
    features["mount"] = signature(holes)
    top = [f for f in board.faces() if f.geom_type == bd.GeomType.PLANE and f.normal_at().Z > 0.9 and f.area > 500]
    features["component_side"] = signature(top)

    export_gltf(shape, str(OUT / "M9N-5883.glb"), binary=True, linear_deflection=0.02, angular_deflection=0.3)
    for name in ["GH6P-1", "GH6P-2", "MAG"]:
        export_gltf(Compound(label=name, children=[by_label[name]]), str(OUT / "interfaces" / f"{name}.glb"), binary=True)
    export_gltf(
        Compound(label="mount", children=[bd.Solid.thicken(f, 0.25) for f in holes]),
        str(OUT / "interfaces" / "mount.glb"),
        binary=True,
    )

    manifest = {
        "artifact": "matek-m9n-5883-vendor",
        "tool": "manufacturer STEP (Matek), converted with build123d",
        "toolVersion": bd.__version__,
        "sourceDigest": hashlib.sha256(ZIP.read_bytes()).hexdigest() if ZIP.exists() else None,
        "units": "mm",
        "features": features,
        "vendorComponents": sorted(by_label),
        "notes": [
            "Board is 32 x 32 x 0.62 mm, top face at z = 0, components on +Z.",
            "Mount holes: 4 x Φ2.1 on a 26 x 26 mm square centred on the board (±13, ±13).",
            "The patch antenna is on -Z (z -5.12 … 1.03): the module mounts component side toward the frame, antenna up.",
            "GH6P connectors reach z = 4.35 on the component side: the frame mount needs ≥ 4.5 mm standoffs.",
        ],
    }
    (part_dir(PART) / "matek-m9n-5883-vendor.manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"  {OUT.relative_to(ROOT)}/M9N-5883.glb (gitignored) + manifest ({len(features)} features)")


if __name__ == "__main__":
    print("gnss (vendor):")
    build()
