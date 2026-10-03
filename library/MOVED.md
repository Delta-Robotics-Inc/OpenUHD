# The part library has moved

This `library/` is no longer maintained here. UHD is the open protocol: it
keeps the schema, the pure helpers (`src/`) and the test fixtures
(`test/fixtures/`). The part library is Delta Robotics' proprietary data and
now lives in the ProtoBoard Cloud repository (`protoboard-cloud`, private),
under `library/`, with the same layout path for path. It is distributed only
through the ProtoBoard Cloud parts service.

- **Parts** (`library/parts/`), their evidence and CAD, the part-body CAD
  generators (`library/cad/py`, except the two below), `params.ts`,
  `rebind.py`, the motor's KCL and `build-library`: in the cloud repository's
  `library/` and `scripts/build-library.ts`. Seeding the parts service from
  either copy gives the same revisions.
- **Tools that ran on it** moved out of UHD into ProtoBoard: the quadcopter
  frame and mounting-hardware generators (`library/cad/py/frame.py`,
  `hardware.py`), the technical-documents generator (`scripts/docs`) and its
  skills, the part research, authoring and verification skills and
  `scripts/verify-part.ts` / `record-verification.ts`. UHD keeps the
  [`uhd-authoring`](../skills/uhd-authoring/SKILL.md) reference skill.
- **The quadcopter** (`library/systems/quadcopter-5in`) is maintained as the
  ProtoBoard quadcopter project.

This copy stays only until the ProtoBoard CLI vendors parts from the parts
service; then it is removed. Until then UHD's tests still use it, so do not
edit it here: change the cloud library.
