"""Bind UHD interfaces to *vendor* CAD (PB-796; generalised from gnss_vendor.py).

Nothing is modelled here. A part's catalog script (library/cad/py/catalog/<id>.py)
names the manufacturer STEP (downloaded by the part research into
library/parts/<id>/.research/cad/, gitignored) and a selector per feature,
then calls `build(...)`, which:

  - converts the STEP to GLB for viewers:
      library/parts/<id>/artifacts/cad/vendor/<name>.glb              (gitignored)
      library/parts/<id>/artifacts/cad/vendor/interfaces/<feature>.glb (gitignored)
  - writes the committed manifest of named features:
      library/parts/<id>/artifacts/cad/<id>-vendor.manifest.json
    with each feature's signature (area, centroid, normal), and for hole or
    shaft selectors the axis positions and diameter, so UHD frames can be
    checked against the CAD without the vendor file (library/cad/checks.ts).

Selectors pick faces either by the vendor's own component names (`label`)
or by geometry (`holes`, `planar`, `within_box`), because vendor names are
often generic ("Body1", "SOLID") or absent.

Coordinates: features and frames are in the STEP's own coordinates (mm),
optionally after `transform` (a build123d Location applied to the whole
shape first) when the vendor model is placed awkwardly. Record the
transform in the manifest notes.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterable

import build123d as bd
from build123d import Compound, Face, Location, Shape, export_gltf, import_step

from common import ROOT, part_dir, signature

Selector = Callable[[Shape], list[Face]]

#: transform of the build in progress (VendorStep.transform), applied to components found by label
_TRANSFORM: Location | None = None


# ---------------------------------------------------------------------------
# Selectors
# ---------------------------------------------------------------------------


def _walk(shape: Shape) -> Iterable[Shape]:
    yield shape
    for c in getattr(shape, "children", ()) or ():
        yield from _walk(c)


def labels(shape: Shape) -> list[str]:
    """Every component label in the assembly tree (empty and purely numeric ids skipped)."""
    return sorted({s.label for s in _walk(shape) if s.label and not s.label.isdigit()})


def find(shape: Shape, name: str) -> Shape:
    """First sub-shape whose label equals `name` (raises with the known labels otherwise)."""
    for s in _walk(shape):
        if s.label == name:
            # a moved Compound keeps its children at their original placement,
            # so apply the build's transform to the found component explicitly
            return s.moved(_TRANSFORM) if _TRANSFORM is not None and s is not shape else s
    raise KeyError(f"no component labelled {name!r}; labels: {labels(shape)[:40]}")


def label(name: str) -> Selector:
    """All faces of the vendor component labelled `name`."""
    return lambda shape: list(find(shape, name).faces())


def _scope(shape: Shape, within: str | None) -> Shape:
    return find(shape, within) if within else shape


def _parallel(a: bd.Vector, b: tuple[float, float, float], tol: float = 0.02) -> bool:
    v = bd.Vector(*b).normalized()
    return abs(abs(a.normalized().dot(v)) - 1) < tol


def holes(diameter: float, tol: float = 0.08, within: str | None = None, axis=(0, 0, 1)) -> Selector:
    """Cylindrical faces of the given diameter (±tol) whose axis is parallel to `axis`.

    Used for mounting holes (inner faces) and shafts (outer faces) alike:
    the manifest records each distinct axis position as a hole centre.
    """

    def sel(shape: Shape) -> list[Face]:
        out = []
        for f in _scope(shape, within).faces():
            if f.geom_type != bd.GeomType.CYLINDER:
                continue
            r = radius_of(f)
            if r is None or abs(2 * r - diameter) > tol:
                continue
            if not _parallel(f.axis_of_rotation.direction, axis):
                continue
            out.append(f)
        return out

    sel.kind = "holes"  # type: ignore[attr-defined]
    sel.axis = axis  # type: ignore[attr-defined]
    return sel


def planar(normal=(0, 0, 1), within: str | None = None, min_area: float = 0.0, extreme: str | None = "max") -> Selector:
    """Planar faces facing `normal`; with extreme="max"/"min", only those furthest along/against it."""

    def sel(shape: Shape) -> list[Face]:
        n = bd.Vector(*normal).normalized()
        fs = [
            f
            for f in _scope(shape, within).faces()
            if f.geom_type == bd.GeomType.PLANE and f.normal_at().dot(n) > 0.99 and f.area >= min_area
        ]
        if not fs or extreme is None:
            return fs
        pos = [f.center(bd.CenterOf.MASS).dot(n) for f in fs]
        best = max(pos) if extreme == "max" else min(pos)
        return [f for f, p in zip(fs, pos) if abs(p - best) < 0.05]

    return sel


def within_box(sel: Selector, lo, hi) -> Selector:
    """Keep the faces of `sel` whose centre lies inside the box lo..hi (mm)."""

    def inner(shape: Shape) -> list[Face]:
        out = []
        for f in sel(shape):
            c = f.center(bd.CenterOf.BOUNDING_BOX)
            if all(lo[i] <= (c.X, c.Y, c.Z)[i] <= hi[i] for i in range(3)):
                out.append(f)
        return out

    for k in ("kind", "axis"):
        if hasattr(sel, k):
            setattr(inner, k, getattr(sel, k))
    return inner


def union(*sels: Selector) -> Selector:
    return lambda shape: [f for s in sels for f in s(shape)]


# ---------------------------------------------------------------------------
# Hole / shaft axes
# ---------------------------------------------------------------------------


def radius_of(f: Face) -> float | None:
    """Cylinder radius, or None when build123d can't give one (some trimmed/boolean-cut faces)."""
    try:
        r = f.radius
    except Exception:
        return None
    return r if r else None


def hole_axes(faces: list[Face], axis=(0, 0, 1)) -> dict:
    """Distinct axis positions of cylindrical faces, projected on the plane normal to `axis`.

    Returns {"centres": [[x, y, z], ...], "diameter_mm": d}. z is the mean
    position along the axis of the faces sharing that centre.
    """
    groups: dict[tuple[float, float, float], list[tuple[bd.Vector, float]]] = {}
    n = bd.Vector(*axis).normalized()
    for f in faces:
        if f.geom_type != bd.GeomType.CYLINDER:
            continue
        p = f.axis_of_rotation.position
        c = f.center(bd.CenterOf.MASS)
        along = c.dot(n)
        # project the axis point onto the plane through the origin, then key by it
        q = p - n * p.dot(n)
        key = (round(q.X, 1), round(q.Y, 1), round(q.Z, 1))
        groups.setdefault(key, []).append((q, along))
    centres = []
    for items in groups.values():
        q = items[0][0]
        along = sum(a for _, a in items) / len(items)
        pt = q + n * along
        centres.append([round(pt.X, 3) + 0.0, round(pt.Y, 3) + 0.0, round(pt.Z, 3) + 0.0])
    centres.sort()
    radii = [r for f in faces if f.geom_type == bd.GeomType.CYLINDER and (r := radius_of(f))]
    return {"centres": centres, "diameter_mm": round(2 * sum(radii) / len(radii), 3) if radii else None}


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------


@dataclass
class VendorStep:
    part_id: str
    #: STEP file name inside library/parts/<id>/.research/cad/
    step: str
    #: base name of the converted GLB
    name: str
    #: feature name -> selector (feature names are what UHD refs use)
    features: dict[str, Selector]
    #: features also exported as their own GLB (D2 refs)
    interfaces: list[str] = field(default_factory=list)
    #: file whose bytes the manifest's sourceDigest records (the downloaded archive); default the STEP
    archive: str | None = None
    #: applied to the whole shape before selection (vendor model placed awkwardly)
    transform: Location | None = None
    notes: list[str] = field(default_factory=list)
    #: licence / terms, copied into the manifest for the record
    licence: str | None = None
    #: vendor URL of the download
    url: str | None = None


def research_cad(part_id: str) -> Path:
    return ROOT / "library/parts" / part_id / ".research/cad"


def manifest_path(part_id: str) -> Path:
    return part_dir(part_id) / f"{part_id}-vendor.manifest.json"


def build(v: VendorStep) -> bool:
    src = research_cad(v.part_id) / v.step
    if not src.exists():
        print(f"  {v.part_id}: skipped, {src.relative_to(ROOT)} not present (download it: see sources.json type \"cad\")")
        return False
    global _TRANSFORM
    shape = import_step(str(src))
    _TRANSFORM = v.transform
    if v.transform is not None:
        shape = shape.moved(v.transform)
    out = part_dir(v.part_id) / "vendor"
    (out / "interfaces").mkdir(parents=True, exist_ok=True)

    features: dict[str, dict] = {}
    for name, sel in v.features.items():
        faces = sel(shape)
        if not faces:
            raise ValueError(f"{v.part_id}: feature {name!r} selected no faces")
        sig = signature(faces)
        if getattr(sel, "kind", None) == "holes":
            sig.update(hole_axes(faces, getattr(sel, "axis", (0, 0, 1))))
        features[name] = sig
        if name in v.interfaces:
            pads = [bd.Solid.thicken(f, 0.25) for f in faces]
            export_gltf(Compound(label=name, children=pads), str(out / "interfaces" / f"{name}.glb"), binary=True)

    export_gltf(shape, str(out / f"{v.name}.glb"), binary=True, linear_deflection=0.05, angular_deflection=0.3)
    bb = shape.bounding_box()
    archive = research_cad(v.part_id) / (v.archive or v.step)
    manifest = {
        "artifact": f"{v.part_id}-vendor",
        "tool": "manufacturer STEP, converted with build123d (library/cad/py/vendor_step.py)",
        "toolVersion": bd.__version__,
        "sourceDigest": hashlib.sha256(archive.read_bytes()).hexdigest() if archive.exists() else None,
        "source": {"file": v.archive or v.step, "url": v.url, "licence": v.licence},
        "units": "mm",
        "bbox": {
            "min": [round(bb.min.X, 3), round(bb.min.Y, 3), round(bb.min.Z, 3)],
            "max": [round(bb.max.X, 3), round(bb.max.Y, 3), round(bb.max.Z, 3)],
        },
        "features": features,
        "vendorComponents": labels(shape)[:200],
        "notes": v.notes,
    }
    manifest_path(v.part_id).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"  {v.part_id}: {out.relative_to(ROOT)}/{v.name}.glb (gitignored) + manifest ({len(features)} features)")
    return True


def inspect(part_id: str, step: str, depth: int = 3) -> None:
    """Print a STEP's component tree, bounding box and cylinder radii: a starting point for selectors.

      .venv-cad/bin/python library/cad/py/vendor_step.py <part-id> <file.step>
    """
    shape = import_step(str(research_cad(part_id) / step))
    print("bbox:", shape.bounding_box())

    def show(s: Shape, d: int) -> None:
        if d > depth:
            return
        bb = s.bounding_box()
        print("  " * d + f"{s.label or '<unnamed>'}  [{bb.min.X:.1f},{bb.min.Y:.1f},{bb.min.Z:.1f}]..[{bb.max.X:.1f},{bb.max.Y:.1f},{bb.max.Z:.1f}]")
        for c in getattr(s, "children", ()) or ():
            show(c, d + 1)

    show(shape, 0)
    radii: dict[float, int] = {}
    for f in shape.faces():
        if f.geom_type == bd.GeomType.CYLINDER:
            r = round(2 * f.radius, 2)
            radii[r] = radii.get(r, 0) + 1
    print("cylinder diameters (mm: faces):", dict(sorted(radii.items())))


if __name__ == "__main__":
    import sys

    inspect(sys.argv[1], sys.argv[2])
