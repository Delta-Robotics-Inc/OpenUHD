import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  UHD_TAXONOMY,
  UHD_TAXONOMY_DOCUMENT,
  TaxonomyError,
  buildTaxonomy,
  categoryAncestors,
  categoryMatches,
  categoryParent,
  compareTaxonomyVersions,
  countCategories,
  isCategoryPath,
  taxonomyTree,
  validateCategories,
  validateTaxonomyDocument,
  validateTaxonomyExtension,
  migrateCategories,
  resolveCategoryAlias,
  type TaxonomyDocument,
  type TaxonomyExtension,
  type TaxonomyNodeData,
} from "../src/taxonomy/index.js";
import { checkSystem, unknownCategoryRule } from "../src/system/checks.js";
import { Passive } from "../src/protocols/passive.js";
import type { ModuleDef } from "../src/types/index.js";
import { RobotCar } from "./fixtures/robot-car.js";
import { ArduinoNano } from "./fixtures/arduino-nano.js";
import { L298N } from "./fixtures/l298n.js";
import { VL53L0X } from "./fixtures/vl53l0x.js";
import { DCMotor } from "./fixtures/dc-motor.js";
import { BatteryPack12V, DCMotor12V, SixAxisArm } from "./fixtures/six-axis-arm.js";
import { ESP32D0WDQ6 } from "./fixtures/esp32-d0wdq6.js";
import { IMU_BOARD, lookupBoardModule } from "./fixtures/imu-board.js";
import { renderTaxonomyData } from "../scripts/build-taxonomy.js";

/**
 * ProtoPart category taxonomy 2.1.0, the source of the UHD taxonomy, vendored
 * unchanged as a fixture (test/fixtures/protopart/README.md).
 */
const PROTOPART_DOC = JSON.parse(readFileSync(new URL("./fixtures/protopart/category-taxonomy-2.1.0.json", import.meta.url), "utf8")) as {
  version: string;
  categories: Record<string, TaxonomyNodeData>;
};

/** Every node of a category tree by path, depth first, in declaration order. */
function nodesByPath(categories: Record<string, TaxonomyNodeData>, prefix = ""): [string, TaxonomyNodeData][] {
  return Object.entries(categories).flatMap(([id, n]) => [[prefix + id, n] as [string, TaxonomyNodeData], ...nodesByPath(n.children ?? {}, `${prefix}${id}.`)]);
}

/** A node's own text, without its children, serialised in a fixed key order. */
const NODE_TEXT_KEYS = ["name", "description", "docs_url", "links", "agent_notes"] as const;
const nodeText = (n: TaxonomyNodeData): string => JSON.stringify(NODE_TEXT_KEYS.map((k) => [k, n[k] ?? null]));

/** Every path of ProtoPart category taxonomy 2.1.0, the source of UHD 1.0.0 (77 nodes). */
const PROTOPART_2_1_0 = [
  "microcontroller", "microcontroller.arduino", "microcontroller.raspberry_pi", "microcontroller.esp32", "microcontroller.teensy",
  "microcontroller.adafruit_mcu", "microcontroller.seeed_mcu", "microcontroller.development_board",
  "sensor", "sensor.environmental", "sensor.distance", "sensor.motion", "sensor.gas", "sensor.biometric", "sensor.thermal",
  "sensor.touch", "sensor.encoder", "sensor.color", "sensor.camera",
  "actuator", "actuator.motor", "actuator.motor.dc_motor", "actuator.motor.stepper", "actuator.motor.servo", "actuator.motor.brushless",
  "actuator.motor_controller", "actuator.servo_controller", "actuator.linear_actuator",
  "power", "power.battery", "power.regulator", "power.charger", "power.pmic", "power.power_supply",
  "connectivity", "connectivity.wireless", "connectivity.wireless.antenna", "connectivity.wired", "connectivity.networking",
  "robotics", "robotics.frc", "robotics.ftc", "robotics.educational", "robotics.rc",
  "mechanical", "mechanical.pneumatic", "mechanical.mounting", "mechanical.adapter", "mechanical.structure", "mechanical.structure.airframe",
  "mechanical.propeller", "mechanical.fastener", "mechanical.fastener.kit",
  "connector", "connector.power_connector", "connector.signal_connector", "connector.cable",
  "expansion", "expansion.arduino_shield", "expansion.pi_hat", "expansion.breakout",
  "component", "component.passive", "component.passive.resistor", "component.passive.capacitor", "component.passive.inductor",
  "component.passive.potentiometer", "component.led", "component.discrete", "component.discrete.diode", "component.discrete.transistor",
  "component.switch", "component.ic", "component.display", "component.audio",
  "kit", "kit.freenove_fnk0082",
];

/** Nodes UHD adds to the source (since 1.0.0), as its provenance lists them. */
const ADDED_IN_1_0_0 = [
  "microcontroller.chip", "microcontroller.module", "microcontroller.single_board_computer", "microcontroller.flight_controller",
  "sensor.gnss", "sensor.magnetic", "sensor.force", "actuator.haptic", "actuator.solenoid", "power.monitor", "power.distribution",
  "connectivity.wireless.video", "robotics.drone", "mechanical.seal", "mechanical.enclosure", "mechanical.motion", "mechanical.hydraulic",
  "mechanical.fastener.screw", "mechanical.fastener.nut", "mechanical.fastener.insert", "connector.usb", "connector.rf",
  "component.passive.ferrite_bead", "component.passive.crystal", "component.protection", "component.relay",
];

const ACME: TaxonomyExtension = {
  library: "acme",
  taxonomy: { id: "uhd", version: "1.0.0" },
  categories: {
    "x-acme": {
      name: "Acme lab",
      children: {
        fixtures: { name: "Test fixtures", description: "Bed-of-nails and pogo fixtures" },
        starter: { name: "Acme starter kit", kit: { sku: "ACME-1", vendor: "acme", manifest: "kits/acme-1.json" } },
      },
    },
  },
};

describe("the UHD taxonomy file", () => {
  it("is a valid taxonomy document, version 1.1.0, with 103 nodes under 11 roots", () => {
    expect(validateTaxonomyDocument(UHD_TAXONOMY_DOCUMENT)).toEqual([]);
    expect(UHD_TAXONOMY.id).toBe("uhd");
    expect(UHD_TAXONOMY.version).toBe("1.1.0");
    expect(UHD_TAXONOMY.roots.map((r) => r.id)).toEqual([
      "microcontroller", "sensor", "actuator", "power", "connectivity", "robotics", "mechanical", "connector", "expansion", "component", "kit",
    ]);
    expect(UHD_TAXONOMY.nodes()).toHaveLength(103);
  });

  it("keeps every ProtoPart 2.1.0 path, and adds exactly the nodes its provenance lists", () => {
    const paths = UHD_TAXONOMY.nodes().map((n) => n.path);
    expect(PROTOPART_2_1_0).toHaveLength(77);
    for (const p of PROTOPART_2_1_0) expect(UHD_TAXONOMY.has(p), p).toBe(true);
    expect(paths.filter((p) => !PROTOPART_2_1_0.includes(p)).sort()).toEqual([...ADDED_IN_1_0_0].sort());
    const provenance = UHD_TAXONOMY_DOCUMENT.provenance as { derivedFrom: { name: string; version: string; nodes: number } };
    expect(provenance.derivedFrom).toMatchObject({ name: "ProtoPart category taxonomy", version: "2.1.0", nodes: 77 });
  });

  it("matches the 77 ProtoPart 2.1.0 nodes byte for byte: id, order, name, description, docs_url, links and agent_notes", () => {
    expect(PROTOPART_DOC.version).toBe("2.1.0");
    const source = nodesByPath(PROTOPART_DOC.categories);
    expect(source.map(([p]) => p)).toEqual(PROTOPART_2_1_0);
    const uhd = new Map(nodesByPath(UHD_TAXONOMY_DOCUMENT.categories));
    for (const [path, node] of source) {
      expect(uhd.has(path), path).toBe(true);
      expect(nodeText(uhd.get(path)!), path).toBe(nodeText(node));
      for (const k of Object.keys(node)) expect([...NODE_TEXT_KEYS, "children", "kit"], `${path}.${k}`).toContain(k);
      // the source's children come first, in the source's order; UHD's additions follow
      const kids = Object.keys(node.children ?? {});
      expect(Object.keys(uhd.get(path)!.children ?? {}).slice(0, kids.length), path).toEqual(kids);
    }
  });

  it("carries the source's kit sku and vendor; its library-internal kit fields stay out, as the provenance records", () => {
    const source = new Map(nodesByPath(PROTOPART_DOC.categories));
    const kits = nodesByPath(UHD_TAXONOMY_DOCUMENT.categories).filter(([, n]) => n.kit);
    expect(kits.map(([p]) => p)).toEqual(["kit.freenove_fnk0082"]);
    for (const [path, n] of kits) {
      const src = source.get(path)!.kit!;
      expect(n.kit).toEqual({ sku: src.sku, vendor: src.vendor });
      expect(src).toHaveProperty("controller_part_id");
      expect(src).toHaveProperty("manifest");
    }
    const notes = (UHD_TAXONOMY_DOCUMENT.provenance as { notes: string[] }).notes.join(" ");
    expect(notes).toMatch(/controller_part_id/);
    expect(notes).toMatch(/manifest/);
  });

  it("the added nodes name no application, part library or library-internal field", () => {
    const added = nodesByPath(UHD_TAXONOMY_DOCUMENT.categories).filter(([p]) => ADDED_IN_1_0_0.includes(p));
    expect(added).toHaveLength(ADDED_IN_1_0_0.length);
    for (const [path, n] of added) expect(nodeText(n), path).not.toMatch(/protopart|protoboard|taxonomyPath|contribution\//i);
  });

  it("every node has a name and a description; agent notes stay short", () => {
    for (const n of UHD_TAXONOMY.nodes()) {
      expect(n.name.trim(), n.path).not.toBe("");
      expect(n.description?.trim(), n.path).toBeTruthy();
      expect((n.agentNotes ?? "").length, n.path).toBeLessThanOrEqual(600);
    }
  });

  it("the generated TypeScript copy matches the JSON file (npm run build:taxonomy)", () => {
    const json = readFileSync(new URL("../src/taxonomy/uhd-taxonomy.json", import.meta.url), "utf8");
    expect(readFileSync(new URL("../src/taxonomy/uhd-taxonomy.data.ts", import.meta.url), "utf8")).toBe(renderTaxonomyData(json));
    expect(UHD_TAXONOMY_DOCUMENT).toEqual(JSON.parse(json));
  });

  it("the JSON schemas allow exactly the fields the validator allows", () => {
    const schema = JSON.parse(readFileSync(new URL("../src/taxonomy/uhd-taxonomy.schema.json", import.meta.url), "utf8"));
    expect(Object.keys(schema.properties).sort()).toEqual(["$schema", "aliases", "categories", "delimiter", "description", "id", "provenance", "version"]);
    expect(Object.keys(schema.definitions.node.properties).sort()).toEqual(["agent_notes", "children", "description", "docs_url", "kit", "links", "name"]);
    const ext = JSON.parse(readFileSync(new URL("../src/taxonomy/taxonomy-extension.schema.json", import.meta.url), "utf8"));
    expect(Object.keys(ext.properties).sort()).toEqual(["$schema", "categories", "description", "library", "taxonomy"]);
    expect(UHD_TAXONOMY_DOCUMENT.$schema).toBe("./uhd-taxonomy.schema.json");
  });
});

describe("taxonomy helpers", () => {
  it("looks nodes up by path, lists children and builds breadcrumbs", () => {
    const servo = UHD_TAXONOMY.node("actuator.motor.servo")!;
    expect(servo).toMatchObject({ id: "servo", name: "Servo Motors", depth: 2, parent: "actuator.motor", source: "uhd" });
    expect(UHD_TAXONOMY.children(null).map((n) => n.id)).toContain("kit");
    expect(UHD_TAXONOMY.children("actuator.motor").map((n) => n.path)).toEqual([
      "actuator.motor.dc_motor", "actuator.motor.stepper", "actuator.motor.servo", "actuator.motor.brushless",
    ]);
    expect(UHD_TAXONOMY.children("no.such.path")).toEqual([]);
    expect(UHD_TAXONOMY.breadcrumbs("actuator.motor.servo").map((n) => n.name)).toEqual(["Actuators", "Motors", "Servo Motors"]);
    expect(UHD_TAXONOMY.breadcrumbs("actuator.bogus.servo").map((n) => n.path)).toEqual(["actuator"]);
    expect(UHD_TAXONOMY.breadcrumbs(null)).toEqual([]);
    const esp = UHD_TAXONOMY.node("microcontroller.esp32")!;
    expect(esp.docsUrl).toMatch(/^https:/);
    expect(esp.links[0].label).toBe("Arduino-ESP32 core");
    expect(UHD_TAXONOMY.node("kit.freenove_fnk0082")!.kit).toEqual({ sku: "FNK0082", vendor: "freenove" });
  });

  it("expands categories into sorted, de-duplicated ancestors for subtree filtering", () => {
    expect(categoryAncestors(["actuator.motor.servo", "actuator.motor_controller", "robotics.rc"])).toEqual([
      "actuator", "actuator.motor", "actuator.motor.servo", "actuator.motor_controller", "robotics", "robotics.rc",
    ]);
    expect(categoryAncestors(["sensor..distance.", ""])).toEqual(["sensor", "sensor.distance"]);
    expect(categoryAncestors(undefined)).toEqual([]);
  });

  it("matches a subtree by prefix of whole ids, not of characters", () => {
    expect(categoryMatches(["actuator.motor.servo"], "actuator")).toBe(true);
    expect(categoryMatches(["actuator.motor.servo"], "actuator.motor")).toBe(true);
    expect(categoryMatches(["actuator.motor_controller"], "actuator.motor")).toBe(false);
    expect(categoryMatches(["sensor.distance"], "sensor.motion")).toBe(false);
    expect(categoryMatches(undefined, null)).toBe(true);
    expect(categoryMatches([], "sensor")).toBe(false);
  });

  it("counts items per path, each item once per path", () => {
    const items = [
      { categories: ["sensor.distance", "sensor.motion"] },
      { categories: ["sensor.distance", "expansion.breakout"] },
      { categories: ["power.battery"] },
      {},
    ];
    const all = countCategories(items);
    expect(all.get("sensor")).toBe(2);
    expect(all.get("sensor.distance")).toBe(2);
    expect(all.get("sensor.motion")).toBe(1);
    expect(all.get("power")).toBe(1);
    const level = countCategories(items, UHD_TAXONOMY.children("sensor").map((n) => n.path));
    expect(level.get("sensor.gnss")).toBe(0);
    expect(level.has("power")).toBe(false);
    expect([...level.keys()]).toHaveLength(UHD_TAXONOMY.children("sensor").length);
  });

  it("checks path syntax and parents", () => {
    expect(isCategoryPath("component.passive.ferrite_bead")).toBe(true);
    expect(isCategoryPath("x-acme.fixtures")).toBe(true);
    expect(isCategoryPath("sensor.x-acme")).toBe(false);
    expect(isCategoryPath("flight-controller")).toBe(false);
    expect(isCategoryPath("Sensor")).toBe(false);
    expect(isCategoryPath("sensor.")).toBe(false);
    expect(categoryParent("actuator.motor.servo")).toBe("actuator.motor");
    expect(categoryParent("actuator")).toBeUndefined();
  });

  it("renders a JSON tree with counts", () => {
    const tree = taxonomyTree(UHD_TAXONOMY, countCategories([{ categories: ["actuator.motor.servo"] }]));
    const actuator = tree.find((n) => n.id === "actuator")!;
    expect(actuator.count).toBe(1);
    expect(actuator.children.find((n) => n.id === "motor")!.children.find((n) => n.id === "servo")!.count).toBe(1);
    expect(tree.find((n) => n.id === "sensor")!.count).toBe(0);
    expect(taxonomyTree(UHD_TAXONOMY)[0]).not.toHaveProperty("count");
    expect(JSON.parse(JSON.stringify(tree))).toEqual(tree);
  });
});

describe("validating a module's categories", () => {
  it("accepts known paths at any depth and reports unknown and malformed ones with suggestions", () => {
    expect(validateCategories(["sensor", "sensor.distance", "kit.freenove_fnk0082"])).toEqual([]);
    const issues = validateCategories(["passive.capacitor", "motor", "hardware", "flight-controller", "sensor.distance"]);
    expect(issues.map((i) => [i.path, i.code, i.suggestions])).toEqual([
      ["passive.capacitor", "unknown", ["component.passive.capacitor"]],
      ["motor", "unknown", ["actuator.motor"]],
      ["hardware", "unknown", []],
      ["flight-controller", "syntax", []],
    ]);
    expect(issues[0].message).toMatch(/not in the uhd taxonomy 1\.1\.0; did you mean component\.passive\.capacitor\?/);
  });

  it("maps every off-taxonomy path ProtoPart 2.1.0 parts used, through the published legacy aliases", () => {
    const legacy = ["actuator.compressor", "actuator.pneumatic_controller", "computer.single_board", "discrete.transistor.mosfet", "networking", "networking.wireless", "power.distribution", "sensor.imu", "sensor.light"];
    for (const p of legacy) expect(UHD_TAXONOMY.has(p) || UHD_TAXONOMY.aliases.has(p), p).toBe(true);
    expect(UHD_TAXONOMY.has("power.distribution")).toBe(true);
    expect([...UHD_TAXONOMY.aliases.keys()].sort()).toEqual(legacy.filter((p) => p !== "power.distribution").sort());
    for (const p of legacy) expect(validateCategories(migrateCategories([p])), p).toEqual([]);
    expect(resolveCategoryAlias("sensor.imu")).toEqual(["sensor.motion"]);
    expect(resolveCategoryAlias("sensor.motion")).toBeUndefined();
    const [issue] = validateCategories(["computer.single_board"]);
    expect(issue).toMatchObject({ code: "unknown", alias: true, suggestions: ["microcontroller.single_board_computer"] });
    expect(issue.message).toMatch(/legacy category path.*use microcontroller\.single_board_computer/);
    expect(migrateCategories(["microcontroller.arduino", "computer.single_board", "networking", "connectivity.networking", "bogus"])).toEqual([
      "microcontroller.arduino", "microcontroller.single_board_computer", "connectivity.networking", "bogus",
    ]);
  });

  it("refuses aliases that are nodes, malformed, or point at paths that are not nodes", () => {
    const doc = (aliases: unknown): TaxonomyDocument => ({ ...UHD_TAXONOMY_DOCUMENT, aliases } as TaxonomyDocument);
    expect(validateTaxonomyDocument(doc({ "sensor.motion": ["sensor.distance"] })).map((p) => p.message).join()).toMatch(/is a node/);
    expect(validateTaxonomyDocument(doc({ "Bad Path": ["sensor.distance"] })).map((p) => p.code)).toEqual(["ALIAS_INVALID"]);
    expect(validateTaxonomyDocument(doc({ "sensor.old": ["sensor.nope"] })).map((p) => p.message).join()).toMatch(/not a node/);
    expect(validateTaxonomyDocument(doc({ "sensor.old": [] })).map((p) => p.code)).toEqual(["ALIAS_INVALID"]);
    expect(validateTaxonomyDocument(doc([])).map((p) => p.at)).toEqual(["aliases"]);
  });

  it("an extension path is unknown until the extension is loaded", () => {
    expect(validateCategories(["x-acme.fixtures"])[0].message).toMatch(/the x-acme extension is not loaded/);
    const withAcme = buildTaxonomy(UHD_TAXONOMY_DOCUMENT, [ACME]);
    expect(validateCategories(["x-acme.fixtures", "sensor.distance"], withAcme)).toEqual([]);
    expect(validateCategories(["x-acme.nothing"], withAcme)[0].code).toBe("unknown");
  });

  it("the test fixtures and every Passive() kind use known paths", () => {
    for (const def of [RobotCar, ArduinoNano, L298N, VL53L0X, DCMotor, BatteryPack12V, DCMotor12V, SixAxisArm, ESP32D0WDQ6, IMU_BOARD]) {
      expect(validateCategories(def.categories), def.id).toEqual([]);
    }
    for (const [kind, unit] of [["resistor", "Ω"], ["capacitor", "F"], ["inductor", "H"], ["ferrite_bead", "Ω"]] as const) {
      const def = Passive({ id: `p-${kind}`, name: kind, kind, value: 1, unit });
      expect(def.categories).toEqual([`component.passive.${kind}`]);
      expect(validateCategories(def.categories)).toEqual([]);
    }
  });
});

describe("library extensions", () => {
  it("adds the library's nodes under x-<library>, after the core roots", () => {
    const t = buildTaxonomy(UHD_TAXONOMY_DOCUMENT, [ACME]);
    expect(t.roots.at(-1)!.id).toBe("x-acme");
    expect(t.extensions).toEqual([{ library: "acme", root: "x-acme", taxonomyVersion: "1.0.0" }]);
    expect(t.node("x-acme.fixtures")).toMatchObject({ source: "acme", depth: 1, parent: "x-acme" });
    expect(t.node("x-acme.starter")!.kit).toEqual({ sku: "ACME-1", vendor: "acme", manifest: "kits/acme-1.json" });
    expect(t.nodes()).toHaveLength(106);
    // the built-in taxonomy is not changed by building another
    expect(UHD_TAXONOMY.has("x-acme")).toBe(false);
  });

  it("a declaration without nodes only states the version", () => {
    const decl: TaxonomyExtension = { library: "plain", taxonomy: { id: "uhd", version: "1.0.0" } };
    expect(validateTaxonomyExtension(decl, UHD_TAXONOMY)).toEqual([]);
    expect(buildTaxonomy(UHD_TAXONOMY_DOCUMENT, [decl]).nodes()).toHaveLength(103);
  });

  it("refuses nodes outside the library's namespace, malformed nodes and duplicate libraries", () => {
    const outside = { ...ACME, categories: { sensor: { name: "Sensors again" } } };
    expect(validateTaxonomyExtension(outside).map((p) => p.code)).toContain("EXTENSION_NAMESPACE");
    const other = { ...ACME, categories: { "x-other": { name: "Other" } } };
    expect(validateTaxonomyExtension(other).map((p) => p.message).join()).toMatch(/under x-acme only/);
    const bad = { ...ACME, categories: { "x-acme": { name: "", children: { "Bad Id": { name: "x" } } } } };
    expect(validateTaxonomyExtension(bad).map((p) => p.at)).toEqual(expect.arrayContaining(["categories.x-acme", "categories.x-acme.children"]));
    expect(() => buildTaxonomy(UHD_TAXONOMY_DOCUMENT, [ACME, ACME])).toThrow(TaxonomyError);
    expect(() => buildTaxonomy(UHD_TAXONOMY_DOCUMENT, [outside as TaxonomyExtension])).toThrow(/x-acme only/);
  });

  it("checks the declared taxonomy version: same major builds, another major does not", () => {
    expect(compareTaxonomyVersions("1.0.0", "1.0.0")).toBe("same");
    expect(compareTaxonomyVersions("1.0.0", "1.3.0")).toBe("compatible");
    expect(compareTaxonomyVersions("1.4.0", "1.3.9")).toBe("newer");
    expect(compareTaxonomyVersions("2.0.0", "1.3.0")).toBe("incompatible");
    const newer = { ...ACME, taxonomy: { id: "uhd", version: "1.2.0" } };
    expect(validateTaxonomyExtension(newer, UHD_TAXONOMY).map((p) => p.code)).toEqual(["TAXONOMY_VERSION_NEWER"]);
    expect(() => buildTaxonomy(UHD_TAXONOMY_DOCUMENT, [newer])).not.toThrow();
    const major = { ...ACME, taxonomy: { id: "uhd", version: "2.0.0" } };
    expect(() => buildTaxonomy(UHD_TAXONOMY_DOCUMENT, [major])).toThrow(/another major version/);
    const foreign = { ...ACME, taxonomy: { id: "other", version: "1.0.0" } };
    expect(validateTaxonomyExtension(foreign, UHD_TAXONOMY).map((p) => p.code)).toEqual(["TAXONOMY_MISMATCH"]);
  });

  it("a document with an x- root is refused: those belong in an extension", () => {
    const doc = { ...UHD_TAXONOMY_DOCUMENT, categories: { ...UHD_TAXONOMY_DOCUMENT.categories, "x-acme": { name: "Acme" } } };
    expect(validateTaxonomyDocument(doc).map((p) => p.message).join()).toMatch(/x- roots belong in an extension/);
    expect(validateTaxonomyDocument({ ...UHD_TAXONOMY_DOCUMENT, version: "1.0" }).map((p) => p.at)).toEqual(["version"]);
  });
});

describe("unknown_category system rule", () => {
  const lookup = (id: string): ModuleDef | undefined => [ArduinoNano, L298N, VL53L0X, DCMotor].find((d) => d.id === id);

  it("is quiet when every definition's categories are known", () => {
    expect(checkSystem(RobotCar, lookup).diagnostics.filter((d) => d.rule === "unknown_category")).toEqual([]);
    expect(checkSystem(IMU_BOARD, lookupBoardModule).diagnostics.filter((d) => d.rule === "unknown_category")).toEqual([]);
  });

  it("warns once per definition and path, naming every instance that uses it", () => {
    const motor = { ...DCMotor, categories: ["motor", "x-acme.fixtures"] };
    const d = unknownCategoryRule(RobotCar, (id) => (id === "dc-motor" ? motor : lookup(id)));
    expect(d.map((x) => [x.id, x.severity, x.refs])).toEqual([
      ["unknown_category:dc-motor:motor", "warning", ["motor_left", "motor_right"]],
      ["unknown_category:dc-motor:x-acme.fixtures", "warning", ["motor_left", "motor_right"]],
    ]);
    expect(d[0].details).toMatchObject({ definition: "dc-motor", category: "motor", suggestions: ["actuator.motor"] });
    // with the library's extension loaded, its paths are known
    const withAcme = checkSystem(RobotCar, (id) => (id === "dc-motor" ? motor : lookup(id)), { taxonomy: buildTaxonomy(UHD_TAXONOMY_DOCUMENT, [ACME]) });
    expect(withAcme.diagnostics.filter((x) => x.rule === "unknown_category").map((x) => x.id)).toEqual(["unknown_category:dc-motor:motor"]);
  });

  it("checks the root definition too", () => {
    const d = unknownCategoryRule({ ...RobotCar, categories: ["project.robotics"] }, lookup);
    expect(d.map((x) => [x.id, x.refs])).toEqual([["unknown_category:robot-car:project.robotics", []]]);
  });
});
