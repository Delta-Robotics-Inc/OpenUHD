/**
 * Schedule 40 PVC Pipe, 1/2 in nominal, plain end (generic) - source-honest
 * part definition.
 *
 * This part is NOT derived from a ProtoPart definition (hence no
 * `protopart_provenance` trait). It is authored directly from public
 * manufacturer technical data:
 *
 * Primary source: Spears Manufacturing, "Schedule 40 PVC Pipe Dimensions &
 *   Pressure Ratings" (sourcebook p. 75)
 *   https://parts.spearsmfg.com/sourcebook/SCH40TECH_40WHTPIPE-1_T_PVC40_T.pdf
 *   - 1/2 in row: O.D. 0.840 in, average I.D. 0.602 in, min. wall 0.109 in,
 *     maximum working pressure 600 psi (water, non-shock, at 73 F / 23 C)
 *   - "Maximum PVC Service Temperature 140 F"
 *   - PVC pressure de-rating table (multiply the 73 F rating by):
 *     73 F 1.00, 80 F 0.88, 90 F 0.75, 100 F 0.62, 110 F 0.51,
 *     120 F 0.40, 130 F 0.31, 140 F 0.22
 *   - "Spears does not recommend threading Schedule 40 Pipe."
 * Secondary source: Charlotte Pipe, "PVC Schedule 80 / Schedule 40 Pipe and
 *   Fittings" technical manual (DC-PR)
 *   https://www.charlottepipe.com/uploads/documents/technical/DC-PR.pdf
 *   - PVC Schedule 40 (white), plain end, PVC 1120, ASTM D 1785:
 *     1/2 in x 10 ft and 1/2 in x 20 ft, 0.840 OD, 0.109 wall, 600 PSI
 *   - Schedule 40 pressure fittings: ASTM D 2466
 * Joining source: Charlotte Pipe, "Solvent Welding: How to Join Plastic Pipe
 *   and Fittings Like a Pro"
 *   https://www.charlottepipe.com/articles/solvent-welding-how-to-join-plastic-pipe-and-fittings-like-a-pro
 *   - solvent cement to ASTM D2564 for Schedule 40 and Schedule 80 systems;
 *     primer recommended for Schedule 40 PVC.
 * Cross-check for de-rating: Westlake Pipe & Fittings technical FAQ, citing
 *   the PVC Pipe Association Handbook of PVC Pipe Design and Construction
 *   (5th ed.): 90 F 0.75, 100 F 0.62, 110 F 0.50
 *   https://www.westlakepipe.com/technical-faqs/what-maximum-allowable-operating-temperature-pvc-piping-systems
 *   Note the one disagreement: Spears gives 0.51 at 110 F, the PPA handbook
 *   (via Westlake) gives 0.50. This file uses the Spears table verbatim.
 *
 * Unit conversions (exact inch/psi factors, rounded to 2 / 1 decimals):
 *   0.840 in = 21.34 mm, 0.109 in = 2.77 mm, 600 psi = 41.4 bar,
 *   140 F = 60 C, 73 F = 23 C.
 *
 * Architecture notes honoured by this file:
 *   - This part ESTABLISHES the `hydraulic` protocol vocabulary in the
 *     library (the `hydraulic` DomainKind existed, no part used it). Protocol
 *     type is `hydraulic`; water is carried as the working medium in domain
 *     metadata, not as a separate protocol.
 *   - Port-honest like a plumbing diagram: the two physical pipe ends are the
 *     only interfaces (`end-a`, `end-b`), both exposed leaves. A plain pipe
 *     has no composed interfaces, so there are no slots or profiles.
 *   - Flow is bidirectional, so each end declares BOTH `source` and `sink`
 *     roles (the same way a bidirectional GPIO is declared). That lets an
 *     end mate with a valve inlet (sink), a pump outlet (source), or another
 *     pipe end, via the generic source <-> sink role pair.
 *   - The two ends form an `any_of` interface group: a pipe segment may be
 *     plumbed at one end (e.g. a capped stub) or both.
 *   - No fabrication: length, colour, UV rating, cell class, NSF potable
 *     water listing, and threaded ends are NOT modelled; see the
 *     `generic_part` trait.
 *
 * Known engine gaps surfaced by this part (tracked as GitHub issues, also
 * recorded in the `validator_gaps` trait so they travel with the data):
 *   - #2  Matching ignores the connector trait, so two male spigots pair
 *         directly; in reality a plain end needs a socket fitting.
 *   - #3  Rating parameters (pressure_rating here, max_pressure on the
 *         piston) are compared as overlap, not as a one-sided limit.
 *   - #4  No hydraulic/pneumatic protocol helper or role-table entries;
 *         both rely on the generic source/sink pair.
 *   - #5  validatePair's manualLinks option is ignored, so an intended
 *         end-a to end-b connection cannot be pinned.
 *   - #6  Working medium and temperature compatibility are not checked;
 *         they live only in metadata and requirement text.
 */

import type { InterfaceDef, ModuleDef } from "../../src/types/index.js";
import { defineModule } from "../../src/protocols/index.js";

// ---------------------------------------------------------------------------
// Hydraulic constants - Spears Sch 40 table, cross-checked to Charlotte DC-PR
// ---------------------------------------------------------------------------

const SPEARS_URL =
  "https://parts.spearsmfg.com/sourcebook/SCH40TECH_40WHTPIPE-1_T_PVC40_T.pdf";
const CHARLOTTE_DC_PR_URL =
  "https://www.charlottepipe.com/uploads/documents/technical/DC-PR.pdf";
const CHARLOTTE_SOLVENT_WELD_URL =
  "https://www.charlottepipe.com/articles/solvent-welding-how-to-join-plastic-pipe-and-fittings-like-a-pro";
const WESTLAKE_DERATING_URL =
  "https://www.westlakepipe.com/technical-faqs/what-maximum-allowable-operating-temperature-pvc-piping-systems";

const SOURCE = `Spears Sch 40 PVC pipe table (${SPEARS_URL}); Charlotte Pipe DC-PR (${CHARLOTTE_DC_PR_URL})`;

/** Nominal pipe size, in (Spears / Charlotte: 1/2 in). */
const NOMINAL_SIZE_IN = 0.5;
/** Outer diameter: 0.840 in (Spears, Charlotte) = 21.34 mm. */
const OUTER_DIAMETER_MM = 21.34;
/** Minimum wall: 0.109 in (Spears, Charlotte) = 2.77 mm. */
const MIN_WALL_MM = 2.77;
/** Max working pressure: 600 psi at 73 F / 23 C, water, non-shock (Spears, Charlotte) = 41.4 bar. */
const PRESSURE_RATING_BAR_23C = 41.4;
/** Maximum PVC service temperature: 140 F (Spears) = 60 C. */
const MAX_TEMPERATURE_C = 60;

// ---------------------------------------------------------------------------
// Pipe ends - two plain-end spigots, port-honest
// ---------------------------------------------------------------------------

interface PipeEndSpec {
  id: string;
  name: string;
}

/** Build one plain pipe end (spigot) interface. */
function pipeEnd(spec: PipeEndSpec): InterfaceDef {
  return {
    id: spec.id,
    name: spec.name,
    domain: "hydraulic",
    exposed: true,
    default_active: true,
    // Bidirectional flow: an end can feed (source) or be fed (sink).
    protocols: [{ type: "hydraulic", roles: ["source", "sink"] }],
    capabilities: ["plain_end", "solvent_weld"],
    parameters: [
      { id: "nominal_size", name: "Nominal pipe size", unit: "in", value: NOMINAL_SIZE_IN },
      { id: "outer_diameter", name: "Outer diameter", unit: "mm", value: OUTER_DIAMETER_MM },
      { id: "wall_thickness", name: "Minimum wall thickness", unit: "mm", value: MIN_WALL_MM },
      {
        id: "pressure_rating",
        name: "Max working pressure (water, non-shock, 23 °C)",
        unit: "bar",
        value: PRESSURE_RATING_BAR_23C,
      },
      { id: "max_temperature", name: "Max service temperature", unit: "°C", value: MAX_TEMPERATURE_C },
    ],
    traits: [
      {
        type: "connector",
        params: {
          connector_type: "spigot",
          joint: "solvent_weld",
          gender: "male",
          nominal_size_in: NOMINAL_SIZE_IN,
          standard: "ASTM D1785 / ASTM D2466 socket",
          source: SOURCE,
        },
      },
    ],
  };
}

const endA = pipeEnd({ id: "end-a", name: "End A" });
const endB = pipeEnd({ id: "end-b", name: "End B" });

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export const PVC_SCH40_PIPE_0_5IN: ModuleDef = defineModule({
  id: "pvc-sch40-pipe-0-5in",
  name: "Schedule 40 PVC Pipe, 1/2 in",
  version: "0.1.0",
  manufacturer: "Various (Charlotte Pipe, JM Eagle, NIBCO)",
  part_number: "Sch 40 PVC 1/2 in (ASTM D1785)",
  description:
    "Generic Schedule 40 PVC pressure pipe, 1/2 in nominal, plain-end segment, ASTM D1785, PVC 1120. Rated 600 psi (41.4 bar) for water at 23 °C; max service temperature 60 °C.",
  tags: ["pvc", "pipe", "plumbing", "civil", "hydraulic", "schedule-40", "astm-d1785"],
  categories: ["plumbing.pipe", "civil.water"],

  interfaces: [endA, endB],

  interfaceGroups: [
    {
      // A segment can be plumbed at one end (capped stub) or both.
      id: "pipe_ends",
      label: "Pipe Ends (plain end, solvent weld)",
      members: ["end-a", "end-b"],
      policy: "any_of",
    },
  ],

  requirements: [
    {
      type: "interface",
      description:
        "Each plain end must be joined to an ASTM D2466 Schedule 40 PVC socket fitting with solvent cement to ASTM D2564 (primer recommended for Sch 40), or to a transition fitting (e.g. a Sch 40 male or female adapter; Spears does not recommend threading Sch 40 pipe). The 41.4 bar (600 psi) rating is for water, non-shock, at 23 °C (73 F) and must be de-rated with temperature: multiply by 0.75 at 32 °C (90 F), 0.51 at 43 °C (110 F; the PVC Pipe Association handbook gives 0.50), and 0.22 at 60 °C (140 F), per the Spears PVC de-rating table. Do not exceed 60 °C.",
      interface_protocol: "hydraulic",
    },
  ],

  domains: [
    {
      domain: "hydraulic",
      metadata: {
        working_medium: "water",
        material: "PVC 1120", // Charlotte DC-PR, Sch 40 plain end table header
        schedule: 40,
        standard: "ASTM D1785",
        fitting_standard: "ASTM D2466",
        solvent_cement_standard: "ASTM D2564",
        pressure_rating_bar_23C: PRESSURE_RATING_BAR_23C,
        pressure_rating_psi_73F: 600,
        max_temperature_C: MAX_TEMPERATURE_C,
        pressure_derating_factors: {
          // Spears PVC de-rating table, keyed by operating temperature in °C
          // (converted from the source's °F rows; 73 F = 23 C baseline).
          "23": 1.0,
          "27": 0.88,
          "32": 0.75,
          "38": 0.62,
          "43": 0.51,
          "49": 0.4,
          "54": 0.31,
          "60": 0.22,
        },
        source: SOURCE,
      },
    },
  ],

  traits: [
    {
      // Honest-gap record: what this generic entry does NOT specify.
      type: "generic_part",
      params: {
        note: "Generic catalogue entry (no brand). Not modelled: segment length (sold in 10 ft and 20 ft sticks and cut to length), colour, UV rating, ASTM D1784 cell class, NSF potable-water listing, and threaded ends (Spears does not recommend threading Sch 40). Average I.D. (0.602 in per Spears) is recorded here only, since no flow model consumes it yet.",
        average_inner_diameter_in: 0.602,
        source: SOURCE,
      },
    },
    {
      // Engine gaps this part exposes; see the header and the linked issues.
      type: "validator_gaps",
      params: {
        repository: "https://github.com/Delta-Robotics-Inc/OpenUHD",
        issues: [
          { number: 2, summary: "Matching ignores connector trait; male spigot pairs with male spigot" },
          { number: 3, summary: "pressure_rating compared as overlap instead of a one-sided limit" },
          { number: 4, summary: "No hydraulic protocol helper or role-table entry" },
          { number: 5, summary: "validatePair manualLinks ignored; end-a to end-b cannot be pinned" },
          { number: 6, summary: "Working medium and temperature compatibility not checked" },
        ],
      },
    },
    {
      type: "preview_artifact",
      params: { artifactId: "art_thumbnail" },
    },
  ],

  artifacts: [
    {
      id: "art_spears_sch40_table",
      name: "Spears Schedule 40 PVC Pipe Dimensions & Pressure Ratings",
      type: "documentation",
      url: SPEARS_URL,
    },
    {
      id: "art_charlotte_dc_pr",
      name: "Charlotte Pipe PVC Schedule 40 / 80 Pipe and Fittings Technical Manual",
      type: "documentation",
      url: CHARLOTTE_DC_PR_URL,
    },
    {
      id: "art_charlotte_solvent_weld",
      name: "Charlotte Pipe Solvent Welding Guide",
      type: "documentation",
      url: CHARLOTTE_SOLVENT_WELD_URL,
    },
    {
      id: "art_westlake_derating",
      name: "Westlake PVC Maximum Operating Temperature and De-rating FAQ",
      type: "documentation",
      url: WESTLAKE_DERATING_URL,
    },
    {
      id: "art_thumbnail",
      name: "Thumbnail",
      type: "custom",
      filePath: "./library/parts/pvc-sch40-pipe-0-5in/artifacts/thumbnail.png",
      mimeType: "image/png",
      tags: ["image", "thumbnail"],
    },
  ],

  geometry: {
    xScale: 2.5,
    yScale: 0.35,
    outline: { preset: "rounded_rectangle" },
  },
});
