// Generated from uhd-taxonomy.json by scripts/build-taxonomy.ts (npm run build:taxonomy). Do not edit.
export const UHD_TAXONOMY_DATA: unknown = {
  "$schema": "./uhd-taxonomy.schema.json",
  "id": "uhd",
  "version": "1.0.0",
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
      "Every path of ProtoPart taxonomy 2.1.0 exists here with the same id, so a part categorised against 2.1.0 is valid against 1.0.0 unchanged.",
      "Names and descriptions were reviewed for hardware in general rather than one parts library: roots and nodes that read as one catalogue's sections were widened (microcontroller covers chips, modules and single-board computers; component.display covers OLED and TFT modules; actuator.motor_controller names ESCs).",
      "Nodes added for hardware the source did not cover: microcontroller.chip, .module, .single_board_computer, .flight_controller; sensor.gnss, .magnetic, .force; actuator.haptic, .solenoid; power.monitor, .distribution; connectivity.wireless.video; robotics.drone; mechanical.seal, .enclosure, .motion, .hydraulic, .fastener.screw, .fastener.nut, .fastener.insert; connector.usb, .rf; component.passive.ferrite_bead, .crystal; component.protection, component.relay.",
      "The kit node keeps its SKU and vendor. The source's controller_part_id and manifest fields pointed into ProtoPart's own library and contribution folder, so they are not carried; a library that holds a kit's manifest states it in its own extension (docs/taxonomy.md).",
      "Agent notes that named one application's tools were reworded to be tool-neutral."
    ]
  },
  "categories": {
    "microcontroller": {
      "name": "Microcontrollers and Computers",
      "description": "Microcontroller chips, modules and development boards, flight controllers and single-board computers",
      "children": {
        "chip": {
          "name": "Microcontroller Chips",
          "description": "Bare microcontroller and wireless SoC chips, placed on a board with their supporting parts"
        },
        "module": {
          "name": "MCU and Radio Modules",
          "description": "Shielded, often certified modules (chip, flash, crystal, antenna) soldered onto a carrier board by castellations or LGA pads"
        },
        "development_board": {
          "name": "Development Boards",
          "description": "Development boards from other makers, or not tied to one board family"
        },
        "single_board_computer": {
          "name": "Single-Board Computers",
          "description": "Boards and compute modules that run a general-purpose operating system (Linux, Windows)"
        },
        "flight_controller": {
          "name": "Flight Controllers",
          "description": "Controller boards for drones and aircraft: MCU, IMU and barometer with ports for ESCs, receivers, video and GNSS, running flight firmware (Betaflight, ArduPilot, PX4, INAV)",
          "agent_notes": "Motor outputs, UART assignments and pad voltages are firmware and board-revision specific; take them from the board's own pinout diagram and firmware target, not from a sibling board."
        },
        "arduino": {
          "name": "Arduino",
          "description": "Arduino boards and compatible boards in Arduino form factors",
          "docs_url": "https://docs.arduino.cc/",
          "agent_notes": "5 V logic on classic AVR boards (Uno, Mega, Nano); 3.3 V on R4 Minima/WiFi, Due and Nano 33 families. Check board voltage before pairing with 3.3 V-only sensors."
        },
        "raspberry_pi": {
          "name": "Raspberry Pi",
          "description": "Raspberry Pi single-board computers, Pico boards and RP-series chips",
          "docs_url": "https://www.raspberrypi.com/documentation/",
          "agent_notes": "All Raspberry Pi GPIO is 3.3 V and not 5 V tolerant. Pico exposes 3.3 V GPIO with 3 ADC channels."
        },
        "esp32": {
          "name": "ESP32",
          "description": "Espressif ESP32 and ESP8266 chips, modules and boards",
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
          "description": "Adafruit Feather, Metro, QT Py and other MCU boards",
          "docs_url": "https://learn.adafruit.com/"
        },
        "seeed_mcu": {
          "name": "Seeed Studio MCU",
          "description": "Seeed Studio XIAO and other MCU boards",
          "docs_url": "https://wiki.seeedstudio.com/"
        }
      }
    },
    "sensor": {
      "name": "Sensors",
      "description": "Sensor chips and sensor modules",
      "children": {
        "environmental": {
          "name": "Environmental",
          "description": "Temperature, humidity, pressure and air quality sensors"
        },
        "distance": {
          "name": "Distance",
          "description": "Ultrasonic, LiDAR, time-of-flight and other distance and proximity sensors"
        },
        "motion": {
          "name": "Motion",
          "description": "IMUs, accelerometers, gyroscopes and motion detection sensors"
        },
        "magnetic": {
          "name": "Magnetic",
          "description": "Magnetometers, compasses and Hall-effect sensors"
        },
        "gnss": {
          "name": "GNSS",
          "description": "Satellite navigation receivers and modules (GPS, Galileo, GLONASS, BeiDou), often combined with a compass"
        },
        "gas": {
          "name": "Gas",
          "description": "Gas detection and air quality sensors"
        },
        "biometric": {
          "name": "Biometric",
          "description": "Heart rate, SpO2 and other biometric sensors"
        },
        "thermal": {
          "name": "Thermal/IR",
          "description": "Thermal imaging and infrared sensors"
        },
        "touch": {
          "name": "Touch",
          "description": "Touch and capacitive sensors"
        },
        "force": {
          "name": "Force and Strain",
          "description": "Load cells, force-sensitive resistors and strain gauges"
        },
        "encoder": {
          "name": "Encoders",
          "description": "Rotary and linear position encoders"
        },
        "color": {
          "name": "Color and Light",
          "description": "Color sensors and ambient light sensors"
        },
        "camera": {
          "name": "Cameras",
          "description": "Camera modules and vision sensors (CSI, DVP and FPC camera modules, smart cameras)"
        }
      }
    },
    "actuator": {
      "name": "Actuators",
      "description": "Motors, motor controllers and other actuators",
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
              "description": "Brushless DC motors (BLDC), inrunners and outrunners"
            }
          }
        },
        "motor_controller": {
          "name": "Motor Controllers",
          "description": "Motor drivers and controllers: H-bridges, stepper drives, ESCs and smart motor controllers"
        },
        "servo_controller": {
          "name": "Servo Controllers",
          "description": "PWM servo controllers and drivers"
        },
        "linear_actuator": {
          "name": "Linear Actuators",
          "description": "Linear motion actuators: electric, pneumatic and hydraulic cylinders"
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
      "description": "Power supplies, batteries and power management",
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
        "monitor": {
          "name": "Power Monitors",
          "description": "Battery fuel gauges and current, voltage and power monitors"
        },
        "pmic": {
          "name": "Power Management IC",
          "description": "Power management integrated circuits"
        },
        "distribution": {
          "name": "Power Distribution",
          "description": "Power distribution boards and hubs, breaker panels and load switches"
        },
        "power_supply": {
          "name": "Power Supplies",
          "description": "AC-DC and DC power supplies"
        }
      }
    },
    "connectivity": {
      "name": "Connectivity",
      "description": "Communication modules and network equipment",
      "children": {
        "wireless": {
          "name": "Wireless",
          "description": "Wi-Fi, Bluetooth, sub-GHz and other RF modules",
          "children": {
            "antenna": {
              "name": "Antennas",
              "description": "RF antennas (Wi-Fi, Bluetooth, video, control links, GNSS)"
            },
            "video": {
              "name": "Wireless Video",
              "description": "Video transmitters and receivers (analog and digital FPV and camera links)"
            }
          }
        },
        "wired": {
          "name": "Wired",
          "description": "Ethernet, CAN and RS-485 interfaces"
        },
        "networking": {
          "name": "Networking Equipment",
          "description": "Switches, routers and media converters"
        }
      }
    },
    "robotics": {
      "name": "Robotics and Vehicles",
      "description": "Parts belonging to a robotics or vehicle platform: competitions, education, RC hobby and drones",
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
          "description": "RC hobby servos, receivers and ESCs"
        },
        "drone": {
          "name": "Drones",
          "description": "Multirotor and fixed-wing drone parts: flight controllers, ESCs, motors, propellers, FPV video, receivers and packs",
          "agent_notes": "Check each part's cell-count (S) rating against the pack, and the motor's KV and prop size against each other; motor screw length must clear the windings."
        }
      }
    },
    "mechanical": {
      "name": "Mechanical",
      "description": "Mechanical components, hardware and fittings",
      "children": {
        "pneumatic": {
          "name": "Pneumatic",
          "description": "Pneumatic fittings, valves and tubing"
        },
        "hydraulic": {
          "name": "Hydraulic",
          "description": "Hydraulic fittings, valves, hoses and pumps"
        },
        "mounting": {
          "name": "Mounting",
          "description": "Brackets, standoffs, spacers, straps and mounting hardware"
        },
        "adapter": {
          "name": "Adapters",
          "description": "Mechanical adapters and couplers"
        },
        "motion": {
          "name": "Motion Components",
          "description": "Bearings, shafts, gears, belts and pulleys"
        },
        "structure": {
          "name": "Structural",
          "description": "Load-bearing structural members and chassis",
          "children": {
            "airframe": {
              "name": "Airframe",
              "description": "Drone and aircraft frames and chassis"
            }
          }
        },
        "enclosure": {
          "name": "Enclosures",
          "description": "Enclosures, cases, housings and lids"
        },
        "seal": {
          "name": "Seals",
          "description": "O-rings, gaskets and other seals"
        },
        "propeller": {
          "name": "Propellers",
          "description": "Propellers for drones, RC aircraft and marine use"
        },
        "fastener": {
          "name": "Fasteners",
          "description": "Screws, nuts, bolts, inserts and fastener assortments",
          "children": {
            "screw": {
              "name": "Screws and Bolts",
              "description": "Machine screws, bolts and self-tapping screws"
            },
            "nut": {
              "name": "Nuts",
              "description": "Hex, lock and other nuts"
            },
            "insert": {
              "name": "Threaded Inserts",
              "description": "Heat-set, press-fit and helical threaded inserts"
            },
            "kit": {
              "name": "Fastener Kits",
              "description": "Pre-assorted hardware kits"
            }
          }
        }
      }
    },
    "connector": {
      "name": "Connectors",
      "description": "Electrical connectors and cables",
      "children": {
        "power_connector": {
          "name": "Power Connectors",
          "description": "Power connectors such as XT30, XT60, Anderson and barrel jacks"
        },
        "signal_connector": {
          "name": "Signal Connectors",
          "description": "Wire-to-board and board-to-board signal connectors: JST, Dupont, headers, FPC"
        },
        "usb": {
          "name": "USB Connectors",
          "description": "USB receptacles and plugs (Type-A, Micro-B, Type-C)"
        },
        "rf": {
          "name": "RF Connectors",
          "description": "Coaxial RF connectors (SMA, U.FL/IPEX, MMCX)"
        },
        "cable": {
          "name": "Cables",
          "description": "Pre-made cables and cable assemblies"
        }
      }
    },
    "expansion": {
      "name": "Expansion Boards",
      "description": "Shields, HATs, breakouts and other boards that extend a host board",
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
      "description": "Discrete and generic electronic components: passives, LEDs, discrete semiconductors, protection, switches, relays, bare ICs, displays and audio transducers",
      "agent_notes": "Generic parts carry class-representative ratings. Pair LEDs with a series resistor; drive relays, motors and buzzers above ~20 mA through a transistor with a flyback diode where inductive.",
      "children": {
        "passive": {
          "name": "Passives",
          "description": "Resistors, capacitors, inductors, ferrite beads, crystals and potentiometers",
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
            "ferrite_bead": {
              "name": "Ferrite Beads",
              "description": "Chip and through-hole ferrite beads for EMI suppression"
            },
            "crystal": {
              "name": "Crystals and Oscillators",
              "description": "Quartz crystals, ceramic resonators and oscillators"
            },
            "potentiometer": {
              "name": "Potentiometers",
              "description": "Rotary and slide potentiometers and trimmers"
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
              "description": "BJTs and MOSFETs"
            }
          }
        },
        "protection": {
          "name": "Circuit Protection",
          "description": "ESD and TVS protection, fuses and resettable (PTC) fuses"
        },
        "switch": {
          "name": "Switches",
          "description": "Tactile buttons, slide and toggle switches, tilt and vibration switches, matrix keypads"
        },
        "relay": {
          "name": "Relays",
          "description": "Electromechanical and solid-state relays"
        },
        "ic": {
          "name": "Integrated Circuits",
          "description": "Bare logic, driver and interface ICs (shift registers, H-bridges, LED drivers, port expanders)"
        },
        "display": {
          "name": "Displays",
          "description": "Displays and display modules: 7-segment, LED bar graph, LED matrix, character LCD, OLED and TFT"
        },
        "audio": {
          "name": "Audio",
          "description": "Buzzers, speakers, microphones and audio amplifier modules"
        }
      }
    },
    "kit": {
      "name": "Kits",
      "description": "Kits of curated hardware. A part in a kit lists the kit's path among its categories.",
      "agent_notes": "When a design is restricted to a kit, choose parts whose categories include the kit path, stay within the kit's quantities, and cite the kit's tutorial for the chosen circuit.",
      "children": {
        "freenove_fnk0082": {
          "name": "Freenove Ultimate Starter Kit for ESP32-S3 (FNK0082)",
          "description": "Freenove ESP32-S3-WROOM starter kit with breadboard, GPIO extension board, camera, sensors, displays, motors and discretes. Used in introductory electrical engineering design classes.",
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
          "agent_notes": "The controller is the Freenove ESP32-S3-WROOM board (ESP32-S3-WROOM-1 N8R8, 3.3 V logic, no DAC; GPIO35-37 are taken by octal PSRAM; the camera connector and microSD slot share some GPIOs), mounted on the GPIO extension board over an 830-point breadboard. Audio output uses PWM or the I2S audio module, not a DAC. The 7-segment displays, LED matrix and RGB LED are common anode. No Wi-Fi/BLE parts are needed beyond the board itself.",
          "kit": {
            "sku": "FNK0082",
            "vendor": "freenove"
          }
        }
      }
    }
  }
};
