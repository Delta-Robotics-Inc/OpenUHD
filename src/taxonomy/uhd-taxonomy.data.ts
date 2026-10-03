// Generated from uhd-taxonomy.json by scripts/build-taxonomy.ts (npm run build:taxonomy). Do not edit.
export const UHD_TAXONOMY_DATA: unknown = {
  "$schema": "./uhd-taxonomy.schema.json",
  "id": "uhd",
  "version": "1.1.0",
  "description": "The UHD category taxonomy: a tree of hardware categories addressed by dotted paths of node ids (sensor.distance, actuator.motor.servo). A ModuleDef lists the paths it belongs to in `categories`, at any depth; consumers derive the ancestor paths for subtree filtering. Libraries extend it with nodes under their own x-<library> root (docs/taxonomy.md).",
  "delimiter": ".",
  "provenance": {
    "derivedFrom": {
      "name": "ProtoPart category taxonomy",
      "version": "2.1.0",
      "publisher": "Delta Robotics, Inc.",
      "nodes": 77
    },
    "notes": [
      "Every node of ProtoPart taxonomy 2.1.0 is kept with the same id, in the same order, and with the same name, description, docs_url, links and agent_notes, byte for byte. A part categorised against ProtoPart 2.1.0 is valid against UHD 1.1.0 unchanged. test/taxonomy.test.ts checks this against a copy of the ProtoPart file in test/fixtures/protopart.",
      "UHD adds 26 nodes for hardware the source did not cover, after the source's own children of each parent: microcontroller.chip, .module, .single_board_computer, .flight_controller; sensor.magnetic, .gnss, .force; actuator.solenoid, .haptic; power.monitor, .distribution; connectivity.wireless.video; robotics.drone; mechanical.hydraulic, .motion, .enclosure, .seal, .fastener.screw, .fastener.nut, .fastener.insert; connector.usb, .rf; component.passive.ferrite_bead, .crystal; component.protection, component.relay. Their names and descriptions follow the source's style.",
      "The kit node kit.freenove_fnk0082 keeps the source's sku and vendor. The source's kit block also has controller_part_id (freenove-esp32-s3-wroom-dev-board) and manifest (kits/freenove-fnk0082.json). Both point into ProtoPart's own parts library and contribution folder, which are not part of UHD, so they are not carried. A library that holds the kit's manifest states it in its own taxonomy extension (docs/taxonomy.md).",
      "The kit and kit.freenove_fnk0082 agent notes are the source's text unchanged. Where they mention a library search parameter (taxonomyPath) or a manifest, read them as: filter by the kit's category path, and use the kit's contents list from the library that publishes it.",
      "aliases maps category paths that ProtoPart 2.1.0 parts used but the ProtoPart taxonomy did not define to the UHD paths that hold the same parts. validateCategories suggests the alias targets for them. One such path, power.distribution, became a UHD node in 1.0.0 and so needs no alias.",
      "1.0.0 had reworded 45 names, descriptions and agent notes on 41 of the source's nodes. 1.1.0 restores the source's text, and rewrites the added nodes in the source's style; no path was added, renamed or removed."
    ]
  },
  "aliases": {
    "actuator.compressor": [
      "mechanical.pneumatic"
    ],
    "actuator.pneumatic_controller": [
      "mechanical.pneumatic"
    ],
    "computer.single_board": [
      "microcontroller.single_board_computer"
    ],
    "discrete.transistor.mosfet": [
      "component.discrete.transistor"
    ],
    "networking": [
      "connectivity.networking"
    ],
    "networking.wireless": [
      "connectivity.wireless"
    ],
    "sensor.imu": [
      "sensor.motion"
    ],
    "sensor.light": [
      "sensor.color"
    ]
  },
  "categories": {
    "microcontroller": {
      "name": "Microcontrollers",
      "description": "Microcontroller development boards and MCU modules",
      "children": {
        "arduino": {
          "name": "Arduino",
          "description": "Arduino-branded and compatible boards",
          "docs_url": "https://docs.arduino.cc/",
          "agent_notes": "5 V logic on classic AVR boards (Uno, Mega, Nano); 3.3 V on R4 Minima/WiFi, Due and Nano 33 families. Check board voltage before pairing with 3.3 V-only sensors."
        },
        "raspberry_pi": {
          "name": "Raspberry Pi",
          "description": "Raspberry Pi single-board computers and Pico",
          "docs_url": "https://www.raspberrypi.com/documentation/",
          "agent_notes": "All Raspberry Pi GPIO is 3.3 V and not 5 V tolerant. Pico exposes 3.3 V GPIO with 3 ADC channels."
        },
        "esp32": {
          "name": "ESP32",
          "description": "Espressif ESP32 and ESP8266 boards",
          "docs_url": "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/",
          "links": [
            {
              "label": "Arduino-ESP32 core",
              "url": "https://docs.espressif.com/projects/arduino-esp32/en/latest/"
            }
          ],
          "agent_notes": "3.3 V logic, not 5 V tolerant. On classic ESP32, GPIO34-39 are input-only with no pull-ups; GPIO0/2/12/15 are strapping pins; ADC2 is unavailable while Wi-Fi is active."
        },
        "teensy": {
          "name": "Teensy",
          "description": "PJRC Teensy development boards",
          "docs_url": "https://www.pjrc.com/teensy/"
        },
        "adafruit_mcu": {
          "name": "Adafruit MCU",
          "description": "Adafruit Feather, Metro, and other MCU boards",
          "docs_url": "https://learn.adafruit.com/"
        },
        "seeed_mcu": {
          "name": "Seeed Studio MCU",
          "description": "Seeed Studio XIAO and other MCU boards",
          "docs_url": "https://wiki.seeedstudio.com/"
        },
        "development_board": {
          "name": "Development Boards",
          "description": "Generic development boards not brand-specific"
        },
        "chip": {
          "name": "MCU Chips",
          "description": "Bare microcontroller and wireless SoC chips"
        },
        "module": {
          "name": "MCU Modules",
          "description": "Shielded MCU and radio modules with castellated or LGA pads (ESP32-WROOM, nRF52 modules, etc.)"
        },
        "single_board_computer": {
          "name": "Single-Board Computers",
          "description": "Single-board computers and compute modules that run Linux or Windows"
        },
        "flight_controller": {
          "name": "Flight Controllers",
          "description": "Drone and aircraft flight controllers (Betaflight, ArduPilot, PX4, INAV)",
          "agent_notes": "Motor outputs, UART assignments and pad voltages are firmware and board-revision specific; take them from the board's own pinout diagram and firmware target, not from a sibling board."
        }
      }
    },
    "sensor": {
      "name": "Sensors",
      "description": "Sensors and sensor modules",
      "children": {
        "environmental": {
          "name": "Environmental",
          "description": "Temperature, humidity, pressure, and air quality sensors"
        },
        "distance": {
          "name": "Distance",
          "description": "Ultrasonic, LiDAR, and time-of-flight distance sensors"
        },
        "motion": {
          "name": "Motion",
          "description": "IMU, accelerometer, gyroscope, and motion detection sensors"
        },
        "gas": {
          "name": "Gas",
          "description": "Gas detection and air quality sensors"
        },
        "biometric": {
          "name": "Biometric",
          "description": "Heart rate, SpO2, and biometric sensors"
        },
        "thermal": {
          "name": "Thermal/IR",
          "description": "Thermal imaging and infrared sensors"
        },
        "touch": {
          "name": "Touch",
          "description": "Touch and capacitive sensors"
        },
        "encoder": {
          "name": "Encoders",
          "description": "Rotary and linear position encoders"
        },
        "color": {
          "name": "Color & Light",
          "description": "Color sensors and ambient light sensors"
        },
        "camera": {
          "name": "Cameras",
          "description": "Camera modules and vision sensors (CSI/DVP/FPC camera modules, smart cameras)"
        },
        "magnetic": {
          "name": "Magnetic",
          "description": "Magnetometers, compasses, and Hall-effect sensors"
        },
        "gnss": {
          "name": "GNSS",
          "description": "GPS and other satellite navigation receivers and modules, often with a compass"
        },
        "force": {
          "name": "Force & Strain",
          "description": "Load cells, force-sensitive resistors, and strain gauges"
        }
      }
    },
    "actuator": {
      "name": "Actuators",
      "description": "Motors, motor controllers, and actuator systems",
      "children": {
        "motor": {
          "name": "Motors",
          "description": "Electric motors of all types",
          "children": {
            "dc_motor": {
              "name": "DC Motors",
              "description": "Brushed DC motors and gearmotors"
            },
            "stepper": {
              "name": "Stepper Motors",
              "description": "Stepper motors and hybrid steppers"
            },
            "servo": {
              "name": "Servo Motors",
              "description": "Servo motors for position control"
            },
            "brushless": {
              "name": "Brushless Motors",
              "description": "Brushless DC motors (BLDC)"
            }
          }
        },
        "motor_controller": {
          "name": "Motor Controllers",
          "description": "Motor drivers and controllers"
        },
        "servo_controller": {
          "name": "Servo Controllers",
          "description": "PWM servo controllers and drivers"
        },
        "linear_actuator": {
          "name": "Linear Actuators",
          "description": "Linear motion actuators"
        },
        "solenoid": {
          "name": "Solenoids",
          "description": "Solenoids and electromagnets"
        },
        "haptic": {
          "name": "Haptics",
          "description": "Vibration motors (ERM, LRA) and haptic drivers"
        }
      }
    },
    "power": {
      "name": "Power",
      "description": "Power supplies, batteries, and power management",
      "children": {
        "battery": {
          "name": "Batteries",
          "description": "Batteries and battery packs"
        },
        "regulator": {
          "name": "Voltage Regulators",
          "description": "Linear and switching voltage regulators"
        },
        "charger": {
          "name": "Battery Chargers",
          "description": "Battery charging circuits and chargers"
        },
        "pmic": {
          "name": "Power Management IC",
          "description": "Power management integrated circuits"
        },
        "power_supply": {
          "name": "Power Supplies",
          "description": "AC-DC and DC power supplies"
        },
        "monitor": {
          "name": "Power Monitors",
          "description": "Battery fuel gauges and current, voltage, and power monitors"
        },
        "distribution": {
          "name": "Power Distribution",
          "description": "Power distribution boards and hubs, breaker panels, and load switches"
        }
      }
    },
    "connectivity": {
      "name": "Connectivity",
      "description": "Communication modules and network equipment",
      "children": {
        "wireless": {
          "name": "Wireless",
          "description": "WiFi, Bluetooth, and RF modules",
          "children": {
            "antenna": {
              "name": "Antennas",
              "description": "RF antennas (WiFi, Bluetooth, video TX, ELRS, GPS, etc.)"
            },
            "video": {
              "name": "Wireless Video",
              "description": "Video transmitters and receivers (analog and digital FPV, camera links)"
            }
          }
        },
        "wired": {
          "name": "Wired",
          "description": "Ethernet, CAN, RS-485 interfaces"
        },
        "networking": {
          "name": "Networking Equipment",
          "description": "Switches, routers, media converters"
        }
      }
    },
    "robotics": {
      "name": "Robotics",
      "description": "Robotics competition and educational platforms",
      "children": {
        "frc": {
          "name": "FRC",
          "description": "FIRST Robotics Competition parts",
          "docs_url": "https://docs.wpilib.org/"
        },
        "ftc": {
          "name": "FTC",
          "description": "FIRST Tech Challenge parts",
          "docs_url": "https://ftc-docs.firstinspires.org/"
        },
        "educational": {
          "name": "Educational",
          "description": "Educational robotics platforms"
        },
        "rc": {
          "name": "RC Hobby",
          "description": "RC hobby servos, receivers, and ESCs"
        },
        "drone": {
          "name": "Drones",
          "description": "Multirotor and fixed-wing drone parts (flight controllers, ESCs, motors, props, FPV video, receivers)",
          "agent_notes": "Check each part's cell-count (S) rating against the pack, and the motor's KV and prop size against each other; motor screw length must clear the windings."
        }
      }
    },
    "mechanical": {
      "name": "Mechanical",
      "description": "Mechanical components and fittings",
      "children": {
        "pneumatic": {
          "name": "Pneumatic",
          "description": "Pneumatic fittings, valves, and tubing"
        },
        "mounting": {
          "name": "Mounting",
          "description": "Brackets, standoffs, and mounting hardware"
        },
        "adapter": {
          "name": "Adapters",
          "description": "Mechanical adapters and couplers"
        },
        "structure": {
          "name": "Structural",
          "description": "Load-bearing structural members and chassis",
          "children": {
            "airframe": {
              "name": "Airframe",
              "description": "Drone / aircraft frames and chassis (Mark4-class FPV frames, etc.)"
            }
          }
        },
        "propeller": {
          "name": "Propellers",
          "description": "Propellers for drones, RC aircraft, and marine applications"
        },
        "fastener": {
          "name": "Fasteners",
          "description": "Screws, nuts, bolts, and fastener assortments",
          "children": {
            "kit": {
              "name": "Fastener Kits",
              "description": "Pre-assorted hardware kits (e.g. M3 nylon kit for drones)"
            },
            "screw": {
              "name": "Screws & Bolts",
              "description": "Machine screws, bolts, and self-tapping screws"
            },
            "nut": {
              "name": "Nuts",
              "description": "Hex, lock, and other nuts"
            },
            "insert": {
              "name": "Threaded Inserts",
              "description": "Heat-set, press-fit, and helical threaded inserts"
            }
          }
        },
        "hydraulic": {
          "name": "Hydraulic",
          "description": "Hydraulic fittings, valves, hoses, and pumps"
        },
        "motion": {
          "name": "Motion Components",
          "description": "Bearings, shafts, gears, belts, and pulleys"
        },
        "enclosure": {
          "name": "Enclosures",
          "description": "Enclosures, cases, housings, and lids"
        },
        "seal": {
          "name": "Seals",
          "description": "O-rings, gaskets, and other seals"
        }
      }
    },
    "connector": {
      "name": "Connectors",
      "description": "Electrical connectors and cables",
      "children": {
        "power_connector": {
          "name": "Power Connectors",
          "description": "Power connectors like XT30, XT60, Anderson"
        },
        "signal_connector": {
          "name": "Signal Connectors",
          "description": "JST, Dupont, and signal connectors"
        },
        "cable": {
          "name": "Cables",
          "description": "Pre-made cables and cable assemblies"
        },
        "usb": {
          "name": "USB Connectors",
          "description": "USB receptacles and plugs (Type-A, Micro-B, Type-C)"
        },
        "rf": {
          "name": "RF Connectors",
          "description": "Coaxial RF connectors (SMA, U.FL/IPEX, MMCX)"
        }
      }
    },
    "expansion": {
      "name": "Expansion Boards",
      "description": "Shields, HATs, and expansion modules",
      "children": {
        "arduino_shield": {
          "name": "Arduino Shields",
          "description": "Arduino-compatible shields",
          "docs_url": "https://docs.arduino.cc/learn/"
        },
        "pi_hat": {
          "name": "Raspberry Pi HATs",
          "description": "Raspberry Pi HATs and add-ons",
          "docs_url": "https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#gpio-and-the-40-pin-header"
        },
        "breakout": {
          "name": "Breakout Boards",
          "description": "IC breakout and adapter boards"
        }
      }
    },
    "component": {
      "name": "Components",
      "description": "Discrete and generic electronic components: passives, LEDs, diodes, transistors, switches, bare ICs, displays and audio transducers",
      "agent_notes": "Generic parts carry class-representative ratings. Pair LEDs with a series resistor; drive relays, motors and buzzers above ~20 mA through a transistor with a flyback diode where inductive.",
      "children": {
        "passive": {
          "name": "Passives",
          "description": "Resistors, capacitors, inductors and potentiometers",
          "children": {
            "resistor": {
              "name": "Resistors",
              "description": "Fixed resistors"
            },
            "capacitor": {
              "name": "Capacitors",
              "description": "Ceramic, electrolytic and film capacitors"
            },
            "inductor": {
              "name": "Inductors",
              "description": "Inductors and chokes"
            },
            "potentiometer": {
              "name": "Potentiometers",
              "description": "Rotary and slide potentiometers and trimmers"
            },
            "ferrite_bead": {
              "name": "Ferrite Beads",
              "description": "Chip and through-hole ferrite beads for EMI suppression"
            },
            "crystal": {
              "name": "Crystals & Oscillators",
              "description": "Quartz crystals, ceramic resonators, and oscillators"
            }
          }
        },
        "led": {
          "name": "LEDs",
          "description": "Single-color and RGB LEDs and addressable LED pixels"
        },
        "discrete": {
          "name": "Discrete Semiconductors",
          "description": "Diodes, transistors, MOSFETs and thyristors",
          "children": {
            "diode": {
              "name": "Diodes",
              "description": "Rectifier, switching, Schottky and Zener diodes"
            },
            "transistor": {
              "name": "Transistors",
              "description": "BJTs and small-signal MOSFETs"
            }
          }
        },
        "switch": {
          "name": "Switches",
          "description": "Tactile buttons, slide and toggle switches, tilt and vibration switches, matrix keypads"
        },
        "ic": {
          "name": "Integrated Circuits",
          "description": "Bare logic, driver and interface ICs (shift registers, H-bridges, port expanders)"
        },
        "display": {
          "name": "Displays",
          "description": "7-segment, LED bar graph, LED matrix and character LCD displays"
        },
        "audio": {
          "name": "Audio",
          "description": "Buzzers, speakers, microphones and audio amplifier modules"
        },
        "protection": {
          "name": "Circuit Protection",
          "description": "ESD and TVS diodes, fuses, and resettable (PTC) fuses"
        },
        "relay": {
          "name": "Relays",
          "description": "Electromechanical and solid-state relays"
        }
      }
    },
    "kit": {
      "name": "Kits",
      "description": "Kits of curated hardware. Select a kit to see the parts included inside it, along with how many of each the kit comes with.",
      "agent_notes": "When a board is restricted to a kit, search the library with taxonomyPath set to the kit path, stay within the manifest quantities, and cite the kit tutorial for the chosen circuit.",
      "children": {
        "freenove_fnk0082": {
          "name": "Freenove Ultimate Starter Kit for ESP32-S3 (FNK0082)",
          "description": "Freenove ESP32-S3-WROOM starter kit with breadboard, GPIO extension board, camera, sensors, displays, motors and discretes. Used in intro electrical engineering design classes.",
          "docs_url": "https://docs.freenove.com/projects/fnk0082/en/latest/",
          "links": [
            {
              "label": "C / Arduino tutorial index",
              "url": "https://docs.freenove.com/projects/fnk0082/en/latest/fnk0082/codes/C.html"
            },
            {
              "label": "GitHub: code, datasheets, part list",
              "url": "https://github.com/Freenove/Freenove_Ultimate_Starter_Kit_for_ESP32_S3"
            },
            {
              "label": "Freenove store",
              "url": "https://store.freenove.com/products/fnk0082"
            }
          ],
          "agent_notes": "This is the Freenove kit to use when a user asks for 'the Freenove kit' / 'Freenove ESP32 kit'. Controller is the Freenove ESP32-S3-WROOM board (ESP32-S3-WROOM-1 N8R8, 3.3 V logic, no DAC; GPIO35-37 are taken by octal PSRAM; the camera connector and microSD slot share some GPIOs), mounted on the GPIO extension board over an 830-point breadboard. Audio output uses PWM or the I2S audio module, not a DAC. The 7-segment displays, LED matrix and RGB LED are common anode. No Wi-Fi/BLE parts are needed beyond the board itself.",
          "kit": {
            "sku": "FNK0082",
            "vendor": "freenove"
          }
        }
      }
    }
  }
};
