import type { ModuleDef } from "../../src/types/index.js";

export const L298N: ModuleDef = {
  id: "l298n",
  name: "L298N Dual H-Bridge Motor Driver",
  version: "1.0.0",
  tags: ["motor-driver", "h-bridge", "l298n"],
  categories: ["actuator.motor_controller"],

  interfaces: [
    // --- Power ---
    {
      id: "power_in",
      name: "Motor Power Input",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["input"] }],
      parameters: [
        { id: "voltage", unit: "V", range: [5, 35] },
        { id: "max_current", unit: "A", value: 2 },
      ],
    },
    {
      id: "power_5v",
      name: "Logic Power",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["input", "output"] }],
      parameters: [{ id: "voltage", unit: "V", value: 5 }],
    },
    {
      id: "gnd",
      name: "Ground",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["ground"] }],
      capabilities: ["ground"],
    },

    // --- Control Leaf Pins ---
    {
      id: "en_a",
      name: "ENA",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [
        { type: "pwm", roles: ["input"] },
        { type: "digital", roles: ["input"] },
      ],
      capabilities: ["pwm_in", "digital_in"],
    },
    {
      id: "in1",
      name: "IN1",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "digital", roles: ["input"] }],
      capabilities: ["digital_in"],
    },
    {
      id: "in2",
      name: "IN2",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "digital", roles: ["input"] }],
      capabilities: ["digital_in"],
    },
    {
      id: "en_b",
      name: "ENB",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [
        { type: "pwm", roles: ["input"] },
        { type: "digital", roles: ["input"] },
      ],
      capabilities: ["pwm_in", "digital_in"],
    },
    {
      id: "in3",
      name: "IN3",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "digital", roles: ["input"] }],
      capabilities: ["digital_in"],
    },
    {
      id: "in4",
      name: "IN4",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "digital", roles: ["input"] }],
      capabilities: ["digital_in"],
    },

    // --- Motor Output Pins ---
    {
      id: "out1",
      name: "OUT1",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["output"] }],
      capabilities: ["motor_out"],
    },
    {
      id: "out2",
      name: "OUT2",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["output"] }],
      capabilities: ["motor_out"],
    },
    {
      id: "out3",
      name: "OUT3",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["output"] }],
      capabilities: ["motor_out"],
    },
    {
      id: "out4",
      name: "OUT4",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["output"] }],
      capabilities: ["motor_out"],
    },

    // --- Composed: Motor Control (one interface, two profiled channels) ---
    {
      id: "motor_control",
      name: "DC Motor Control",
      domain: "electrical",
      exposed: true,
      default_active: true,
      max_instances: 2,
      protocols: [{ type: "motor_control", roles: ["target"] }],
      slots: [
        { id: "en", required: true, match: { protocol: "pwm", role: "input", capability: "pwm_in" } },
        { id: "in1", required: true, match: { protocol: "digital", role: "input", capability: "digital_in" } },
        { id: "in2", required: true, match: { protocol: "digital", role: "input", capability: "digital_in" } },
      ],
      profiles: [
        {
          id: "channel_a",
          label: "Motor Channel A",
          bindings: { en: "en_a", in1: "in1", in2: "in2" },
          default_active: true,
        },
        {
          id: "channel_b",
          label: "Motor Channel B",
          bindings: { en: "en_b", in1: "in3", in2: "in4" },
          default_active: true,
        },
      ],
    },

    // --- Composed: Motor Output (one interface, two profiled channels) ---
    {
      id: "motor_output",
      name: "Motor Output",
      domain: "electrical",
      exposed: true,
      default_active: true,
      max_instances: 2,
      protocols: [{ type: "power", roles: ["output"] }],
      slots: [
        { id: "phase_a", required: true, match: { capability: "motor_out" } },
        { id: "phase_b", required: true, match: { capability: "motor_out" } },
      ],
      profiles: [
        {
          id: "output_a",
          label: "Motor Output A",
          bindings: { phase_a: "out1", phase_b: "out2" },
          default_active: true,
        },
        {
          id: "output_b",
          label: "Motor Output B",
          bindings: { phase_a: "out3", phase_b: "out4" },
          default_active: true,
        },
      ],
    },
  ],

  traits: [
    { type: "can_bridge", params: { from: ["power_in"], to: ["motor_output"] } },
  ],
};
