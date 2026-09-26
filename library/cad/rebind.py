"""Re-bind feature signatures explicitly (PB-775).

  python library/cad/rebind.py <module.ts> <manifest.json> [feature ...]

Geometry bindings store the signature the feature had when it was bound, so
a regenerated artifact whose faces moved or changed is reported as stale by
checkGeometryBindings instead of being silently accepted. After reviewing a
change, run this to copy the manifest's current signatures into the
`feature("<name>", { ... }, …)` literals of a module file (all features, or
only the ones named). It prints every change it makes.
"""
import json
import re
import sys


def fmt(v: dict) -> str:
    s = "{ area_mm2: %s, centroid: [%s]" % (v["area_mm2"], ", ".join(str(x) for x in v["centroid"]))
    if "normal" in v:
        s += ", normal: [%s]" % ", ".join(str(x) for x in v["normal"])
    return s + " }"


def main() -> None:
    ts, manifest, *only = sys.argv[1:]
    features = json.load(open(manifest))["features"]
    src = open(ts).read()

    def repl(m: re.Match) -> str:
        fn, name, old = m.group(1), m.group(2), m.group(3)
        if name not in features or (only and name not in only):
            return m.group(0)
        new = fmt(features[name])
        if new != old:
            print(f"  {name}: {old} -> {new}")
        return f'{fn}("{name}", {new}'

    # feature(...) for generated CAD, vendorFeature(...) for vendor CAD (PB-796)
    out = re.sub(r'\b(feature|vendorFeature)\("([^"]+)", (\{ area_mm2: [^}]*\})', repl, src)
    open(ts, "w").write(out)


if __name__ == "__main__":
    main()
