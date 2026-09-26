"""Regenerate every build123d artifact (PB-775).

  npx tsx library/cad/params.ts            # UHD -> params.json / params.kcl
  .venv-cad/bin/python library/cad/py/build_all.py
"""
import frame
import gnss_vendor
import hardware
import parts

if __name__ == "__main__":
    parts.build()
    print("frame:")
    frame.build()
    print("hardware:")
    hardware.build()
    print("gnss (vendor):")
    gnss_vendor.build()
