/**
 * FIXTURE: a frozen copy of a part definition (TPS6302x datasheet SLVS916) for UHD's own tests:
 * interfaces, pin table, package and the traits the checks read. Evidence,
 * CAD and notes are left out. It is not maintained as a part: change it only
 * when a test needs it.
 */
import type { ModuleDef } from "../../../src/types/index.js";

export const TI_TPS63020DSJR: ModuleDef = {
  "id": "ti-tps63020dsjr",
  "name": "TI TPS63020DSJR buck-boost converter",
  "version": "1.1.0",
  "manufacturer": "Texas Instruments",
  "part_number": "TPS63020DSJR",
  "description": "Single-inductor buck-boost converter with 4 A switches: VIN 1.8-5.5 V, adjustable VOUT 1.2-5.5 V (500 mV feedback), 2 A at VOUT 3.3 V for VIN > 2.5 V, 2.4 MHz, 25 uA quiescent, power-good output, VSON-14 (DSJ) 4 x 3 mm with exposed pad.",
  "tags": [
    "tps63020",
    "ti",
    "buck-boost",
    "dc-dc",
    "regulator",
    "adjustable",
    "vson-14",
    "li-ion"
  ],
  "categories": [
    "power",
    "power.regulator"
  ],
  "interfaces": [
    {
      "id": "pin_1",
      "name": "VINA",
      "pin": 1,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            5.5
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "VINA — supply voltage for control stage.",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_2",
      "name": "GND",
      "pin": 2,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "ground"
          ]
        }
      ],
      "capabilities": [
        "ground"
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "GND — control / logic ground.",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_3",
      "name": "FB",
      "pin": 3,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "analog",
          "roles": [
            "input"
          ]
        }
      ],
      "capabilities": [
        "analog_in"
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "FB — voltage feedback of adjustable versions, must be connected to VOUT on fixed output voltage versions.",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_4",
      "name": "VOUT",
      "pin": 4,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "output"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            5.5
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "VOUT — buck-boost converter output (pins 4, 5).",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_5",
      "name": "VOUT",
      "pin": 5,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "output"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            5.5
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "VOUT — buck-boost converter output (pins 4, 5).",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_6",
      "name": "L2",
      "pin": 6,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "custom",
          "roles": [
            "peer"
          ]
        }
      ],
      "capabilities": [
        "inductor_l2"
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "L2 — connection for inductor (pins 6, 7).",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_7",
      "name": "L2",
      "pin": 7,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "custom",
          "roles": [
            "peer"
          ]
        }
      ],
      "capabilities": [
        "inductor_l2"
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "L2 — connection for inductor (pins 6, 7).",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_8",
      "name": "L1",
      "pin": 8,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "custom",
          "roles": [
            "peer"
          ]
        }
      ],
      "capabilities": [
        "inductor_l1"
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "L1 — connection for inductor (pins 8, 9).",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_9",
      "name": "L1",
      "pin": 9,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "custom",
          "roles": [
            "peer"
          ]
        }
      ],
      "capabilities": [
        "inductor_l1"
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "L1 — connection for inductor (pins 8, 9).",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_10",
      "name": "VIN",
      "pin": 10,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            5.5
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "VIN — supply voltage for power stage (pins 10, 11).",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_11",
      "name": "VIN",
      "pin": 11,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            5.5
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "VIN — supply voltage for power stage (pins 10, 11).",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_12",
      "name": "EN",
      "pin": 12,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "enable"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            0,
            5.5
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "EN — enable input (1 enabled, 0 disabled), must not be left open. VIL <= 0.4 V, VIH >= 1.2 V.",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_13",
      "name": "PS/SYNC",
      "pin": 13,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "clock_in"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            0,
            5.5
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "PS/SYNC — enable / disable power save mode (1 disabled, 0 enabled, clock signal for synchronization), must not be left open. Sync range 2200-2600 kHz.",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pin_14",
      "name": "PG",
      "pin": 14,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "open_drain",
        "power_good"
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "PG — output power good (1 good, 0 failure; open-drain), can be left open. VOL 0.04 V typ / 0.4 V max at 10 uA.",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "pgnd",
      "name": "PGND (exposed thermal pad)",
      "pin": "EP",
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "ground"
          ]
        }
      ],
      "capabilities": [
        "ground"
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "PGND — power ground. The exposed thermal pad is connected to PGND.",
            "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5 Pin Functions)"
          }
        }
      ]
    },
    {
      "id": "vin",
      "name": "Input supply (VIN + VINA)",
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 3.6,
          "range": [
            1.8,
            5.5
          ]
        }
      ],
      "slots": [
        {
          "id": "vin_a",
          "required": true,
          "match": {
            "protocol": "power",
            "role": "input"
          }
        },
        {
          "id": "vin_b",
          "required": true,
          "match": {
            "protocol": "power",
            "role": "input"
          }
        },
        {
          "id": "vina",
          "required": true,
          "match": {
            "protocol": "power",
            "role": "input"
          }
        },
        {
          "id": "gnd",
          "required": true,
          "match": {
            "protocol": "power",
            "role": "ground",
            "capability": "ground"
          }
        }
      ],
      "profiles": [
        {
          "id": "vin_pins",
          "label": "VIN 10/11, VINA 1, PGND",
          "default_active": true,
          "bindings": {
            "vin_a": "pin_10",
            "vin_b": "pin_11",
            "vina": "pin_1",
            "gnd": "pgnd"
          }
        }
      ]
    },
    {
      "id": "vout",
      "name": "Regulated output (VOUT)",
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "output"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            5.5
          ]
        },
        {
          "id": "max_current",
          "unit": "A",
          "value": 2
        }
      ],
      "slots": [
        {
          "id": "vout_a",
          "required": true,
          "match": {
            "protocol": "power",
            "role": "output"
          }
        },
        {
          "id": "vout_b",
          "required": true,
          "match": {
            "protocol": "power",
            "role": "output"
          }
        },
        {
          "id": "gnd",
          "required": true,
          "match": {
            "protocol": "power",
            "role": "ground",
            "capability": "ground"
          }
        }
      ],
      "profiles": [
        {
          "id": "vout_pins",
          "label": "VOUT 4/5, PGND",
          "default_active": true,
          "bindings": {
            "vout_a": "pin_4",
            "vout_b": "pin_5",
            "gnd": "pgnd"
          }
        }
      ]
    },
    {
      "id": "pcb_mount",
      "name": "VSON-14 (DSJ) leads (SMD)",
      "domain": "mechanical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "mechanical_connection",
          "roles": [
            "mounting_point"
          ]
        }
      ],
      "capabilities": [
        "surface_mount",
        "vson14_dsj_4x3_0p5mm"
      ],
      "traits": [
        {
          "type": "connector",
          "params": {
            "connector_type": "vson_14_dsj",
            "note": "14 leads, pitch 0.50 mm, lead width 0.18-0.30, length 0.30-0.50; body 3.85-4.15 x 2.85-3.15 x 0.80-1.00 mm; exposed pad 2.85 x 1.58 mm. MSL Level-1-260C-UNLIM, NIPDAU finish.",
            "source": [
              "https://www.ti.com/lit/pdf/MPSS014A",
              "https://www.ti.com/lit/ds/symlink/tps63020.pdf (p.27 package option addendum, pp.31-32)"
            ]
          }
        }
      ]
    },
    {
      "id": "thermal_pad",
      "name": "Exposed thermal pad (heat path to PCB)",
      "domain": "thermal",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "thermal_connection",
          "roles": [
            "thermal_source"
          ]
        }
      ],
      "capabilities": [
        "exposed_pad"
      ]
    }
  ],
  "interfaceGroups": [
    {
      "id": "vin_pair",
      "label": "VIN pins 10 and 11 (both must be connected)",
      "members": [
        "pin_10",
        "pin_11"
      ],
      "policy": "all_of"
    },
    {
      "id": "vout_pair",
      "label": "VOUT pins 4 and 5 (both must be connected)",
      "members": [
        "pin_4",
        "pin_5"
      ],
      "policy": "all_of"
    },
    {
      "id": "inductor_pads",
      "label": "Inductor pads L1 (8, 9) and L2 (6, 7)",
      "members": [
        "pin_6",
        "pin_7",
        "pin_8",
        "pin_9"
      ],
      "policy": "all_of"
    }
  ],
  "artifacts": [
    {
      "id": "datasheet",
      "name": "TPS6302x datasheet SLVS916I",
      "type": "datasheet",
      "url": "https://www.ti.com/lit/ds/symlink/tps63020.pdf"
    }
  ],
  "domains": [
    {
      "domain": "electrical",
      "power_domains": [
        {
          "id": "vin",
          "name": "Input (VIN/VINA)",
          "nominal_voltage_V": 3.6,
          "voltage_range_V": [
            1.8,
            5.5
          ]
        },
        {
          "id": "vout",
          "name": "Output (VOUT, adjustable)",
          "voltage_range_V": [
            1.2,
            5.5
          ],
          "max_current_mA": 2000,
          "regulation_type": "regulated"
        }
      ]
    },
    {
      "domain": "mechanical",
      "dimensions_mm": {
        "length": 4,
        "width": 3,
        "height": 0.9
      },
      "package": {
        "name": "VSON-14",
        "code": "DSJ (R-PVSON-N14)",
        "pin_count": 14,
        "pitch_mm": 0.5,
        "exposed_pad": true,
        "exposed_pad_pin": "EP",
        "exposed_pad_mm": [
          2.85,
          1.58
        ],
        "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§5: \"DSJ Package, 14-Pin VSON with Exposed Thermal Pad\"; p.32 exposed pad 2.85 x 1.58 mm); https://www.ti.com/lit/pdf/MPSS014A (body 3.85-4.15 x 2.85-3.15 x 0.80-1.00 mm, pitch 0.50)",
        "assumption": "TI numbers no exposed pad; \"EP\" is this part's label for it. Height 0.9 mm is the midpoint of 0.80-1.00 mm (see the assumption trait)."
      }
    },
    {
      "domain": "thermal",
      "operating_temperature_C": [
        -40,
        85
      ]
    }
  ],
  "traits": [
    {
      "type": "operating_conditions",
      "params": {
        "vin_V": [
          1.8,
          5.5
        ],
        "ambient_C": [
          -40,
          85
        ],
        "junction_C": [
          -40,
          125
        ],
        "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§6.3)"
      }
    },
    {
      "type": "absolute_maximum",
      "params": {
        "vin_vina_vout_ps_en_fb_pg_V": [
          -0.3,
          7
        ],
        "l1_l2_dc_V": [
          -0.3,
          7
        ],
        "l1_l2_ac_10ns_V": [
          -3,
          10
        ],
        "junction_C": [
          -40,
          150
        ],
        "storage_C": [
          -65,
          150
        ],
        "esd": "HBM ±500 V (VIN, VINA, L1), ±2000 V other pins; CDM ±1500 V",
        "source": "https://www.ti.com/lit/ds/symlink/tps63020.pdf (§6.1-6.2)"
      }
    }
  ]
};
