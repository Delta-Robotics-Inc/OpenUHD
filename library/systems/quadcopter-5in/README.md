# 5-inch 6S quadcopter (reference system)

The first ProtoBoard Stack reference project (PB-763). Purchased modules plus
one custom frame, with existing flight-control firmware (Betaflight). No
custom PCB or flight-control code.

## Component selection

| Role | Part (library id) | Key facts |
| --- | --- | --- |
| Flight controller | `dolphinrc-f405-v3-flight-controller` | STM32F405, ICM-42688-P, 2–6S, 5 V 3 A + 10–12 V 2.5 A BECs, 6 UARTs, 8 DShot outputs, Betaflight MATEKF405TE |
| 4-in-1 ESC | `dolphinrc-am32-60a-4in1-esc` | AM32, 2–6S, 60 A continuous / 65 A burst per channel, 8-pin SH1.0 FC cable |
| Motors ×4 | `meps-neon-2207-v2-1950kv` | 1950KV, 6S, 16 mm bolt circle M3, Ø5 mm shaft with M5 thread |
| Propellers ×4 | `hqprop-ethix-s5` | 5×4×3, polycarbonate, 5 mm bore, 2 CW + 2 CCW per pack |
| Battery | `cnhl-black-series-1100mah-6s-100c` | 6S 1100 mAh, 100C (110 A continuous), XT60, 211 g |
| Receiver | `radiomaster-rp1-v2-elrs-2g4` | ExpressLRS 2.4 GHz, CRSF over UART at 420 000 baud, 5 V |
| Digital video | `dji-o4-air-unit` | 3.7–13.2 V input (not direct 6S), 25.5 mm M2 module mount, 14 mm camera |
| GNSS + compass | `matek-m9n-5883` | u-blox NEO-M9N + QMC5883P (I2C 0x2C; needs Betaflight ≥ 2025.12.1), 4–5.5 V, 26 mm M2 mount. Replaces the EOL `matek-m10q-5883` (same interface ids; scenario `legacy-m10q`) |
| Battery strap | `hglrc-kevlar-battery-strap-20x250mm` | 20 × 250 mm aramid, fits the pack + a 3 mm top plate with 95 mm spare |
| Stack hardware | `iso-4762-m3x30-socket-head-cap-screw` ×4, `ettinger-005-83-060-m3-nylon-spacer-6mm` ×8, `iso-10511-m3-nyloc-nut` ×4 | Frame → spacer → ESC → spacer → FC → nut (stack-up in the part notes) |
| Frame | `quadcopter-5in-frame` (custom) | Interfaces mirror the parts above; CAD pending (PB-774) |

## Harnesses (`harnesses.ts`)

| Harness | Carries | Topology |
| --- | --- | --- |
| `dolphinrc-xt60-battery-lead` (12 AWG, 12 cm) | VBAT, battery GND | wire |
| `dji-o4-3in1-cable` | O4 10 V, GND, MSP DisplayPort | wire |
| `dolphinrc-sh8-fc-esc-cable` (inside the stack) | FC ↔ ESC 8-pin | wire |
| `quadcopter-5in-stack-hardware` | ESC and FC onto the frame | bus |

## Generated outputs

`npx tsx library/systems/quadcopter-5in/generate.ts` rebuilds `generated/`:
- `bom.md` / `bom.json`: the bill of materials;
- `wiring.md`: the pad-to-pad wiring and assembly checklist;
- `betaflight-cli.txt`: the Betaflight configuration, verified against `betaflight-reference.md`.

## Wiring (stored links in `index.ts`)

- The battery XT60 goes to the ESC battery pads, which also pass VBAT to the FC over the 8-pin cable.
- ESC motor channels M1–M4 go to the arms, using Betaflight Quad-X order: M1 rear-right, M2 front-right, M3 rear-left, M4 front-left.
- The receiver uses CRSF on UART2 and runs from the 5 V BEC.
- The DJI O4 runs from the 10 V BEC and carries MSP DisplayPort on UART5 over the DJI socket.
- GNSS uses UART1, with the compass on I2C1, and runs from the 4.5 V GPS rail. It mounts on the frame's 26 mm GPS pad.

All links validate as configured with `validateLinks` (see `test/system-links.test.ts`).

## Open questions from part research

- The FC's high-voltage BEC output is 10 V or 12 V depending on the source; the board silkscreen says 10V.
- Pin 1 isn't marked on the FC/ESC 8-pin connector; both parts assume the BAT end.
- DShot rates and bidirectional DShot are supported only by DolphinRC's review blog, not the manual.
- Matek names no successor to the EOL M10Q-5883. The M9N-5883 is its only current UART + I2C module. Units built from January 2026 carry a QMC5883P compass (0x2C), which needs Betaflight 2025.12.1 or later.
- The DJI O4 standard is marketed for small frames. Its cooling requirement (airflow, limited ground standby) needs to be covered in the frame design.
