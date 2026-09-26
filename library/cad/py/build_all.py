"""Regenerate every build123d artifact (PB-775, PB-796).

  npx tsx library/cad/params.ts            # UHD -> params.json / params.kcl
  .venv-cad/bin/python library/cad/py/build_all.py [part-id ...]

Per-part catalog scripts (library/cad/py/catalog/<id>.py, PB-796) each
define `build()`: vendor-STEP bindings (vendor_step.py; skipped when the
vendor file is not downloaded) or representative geometry (partkit.py).
With part ids, only those catalog scripts run.
"""
import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def catalog(only: list[str]) -> None:
    for script in sorted((HERE / "catalog").glob("*.py")):
        if only and script.stem not in only:
            continue
        spec = importlib.util.spec_from_file_location(f"catalog_{script.stem.replace('-', '_')}", script)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.build()


if __name__ == "__main__":
    only = sys.argv[1:]
    if not only:
        import frame
        import gnss_vendor
        import hardware
        import parts

        parts.build()
        print("frame:")
        frame.build()
        print("hardware:")
        hardware.build()
        print("gnss (vendor):")
        gnss_vendor.build()
    print("catalog:")
    catalog(only)
