# DRC (Design Rule Check) Specification

## 1. Philosophy

The DRC engine follows a **TypeScript-strict analogy**: any configuration is permitted, but weak semantics produce warnings and invalid semantics produce errors. The system auto-resolves the best interpretation of each harness, then the user or an agent can manually lock in decisions or override them.

**Preference order for validation:**
1. Explicit protocol match with sub-links resolved (auto or manual) — strongest
2. Compositional / inferred match — middle
3. Top-level interface-only (no sub-link detail) — weakest but acceptable
4. Manual-only wiring with no protocol guidance — valid but low confidence
5. No valid interpretation — incompatible

The DRC engine is a **composer** over the existing matching, binding, and parameter modules. It does not reimplement protocol matching, slot binding, or parameter checking — it orchestrates them.

---

## 2. Tier Model

Each harness connection gets a **tier** describing how it was validated:

| Tier | Meaning | Confidence | Example |
|---|---|---|---|
| `protocol` | Both sides declare matching protocol + sub-links resolved | 1.0 | Arduino I2C master ↔ VL53L0X I2C slave |
| `compositional` | One side has composed interface, other side's slots filled via protocol/manual | 0.8 | Arduino pins ↔ L298N motor_control |
| `inferred` | Implied interface from compositional match, no explicit declaration | 0.5 | Arduino gains inferred motor_control |
| `manual` | User-asserted wiring only, no protocol guidance | 0.3 | User manually links conductors |
| `none` | No valid interpretation | 0.0 | Incompatible protocols |

---

## 3. Connection States

Unified state for every harness:

```typescript
type ConnectionState =
  | "VALID"                  // tier >= compositional, all sub-links resolved, params pass
  | "VALID_INFERRED"         // tier = inferred, sub-links resolved, params pass
  | "VALID_MANUAL"           // tier = manual, user-asserted, params pass
  | "CONFIGURATION_NEEDED"   // structure fine, required sub-links unresolved
  | "WARNING"                // matches but parameter concern (voltage near limit, etc.)
  | "INCOMPATIBLE"           // no valid interpretation at any tier
  | "NOT_CONFIGURED";        // harness has no endpoints bound
```

State precedence: errors override warnings override valid.

---

## 4. Harness Model Extension

### Manual Links

Add optional `manualLinks` to `HarnessDef` for user-asserted per-conductor wiring:

```typescript
interface ManualLinkDef {
  id: string;
  label?: string;
  /** Leaf interface on the "from" endpoint's module */
  from: { endpointId: string; interfaceId: string };
  /** Leaf interface on the "to" endpoint's module */
  to:   { endpointId: string; interfaceId: string };
  /** If true, user confirmed this assignment — auto-resolve shouldn't overwrite */
  locked?: boolean;
}

interface HarnessDef {
  id: string;
  name?: string;
  topology: "wire" | "bus" | "split" | "or";
  domain: DomainKind;
  endpoints: HarnessEndpointDef[];
  manualLinks?: ManualLinkDef[];  // NEW
}
```

**Semantics:**
- When no manual links exist, the engine derives sub-links automatically from protocol matching
- When manual links exist, they override derived links for the same slot/conductor
- Manual links without protocol guidance are still valid, tagged as `method: "manual"`
- `locked: true` means the user explicitly confirmed this assignment — it should not be overwritten by auto-resolution even if the engine finds a "better" match

---

## 5. Sub-link Resolution

A **sub-link** is a single conductor in a harness, mapping one leaf interface on one endpoint to one leaf interface on another. Sub-links are the granular wiring level — SDA to SDA, SCL to SCL, etc.

### Two Sources

1. **Auto-derived:** computed at evaluation time from protocol matching. Not persisted at rest. When the engine sees I2C master ↔ I2C slave, it derives SDA↔SDA and SCL↔SCL automatically via slot protocol/role matching.

2. **Manual:** stored in `harness.manualLinks`. Created when the user explicitly locks in a conductor assignment, or when the engine can't auto-derive (compositional match where one side has no profile).

### Resolution Algorithm

Per harness endpoint pair:

1. **Top-level match:** run `matchProtocols()` on the two endpoint interfaces.
   - If compatible: proceed to slot walking.
   - If not: try `findCompositionalMatch()` for compositional tier.
   - If neither: tier = `none` → `INCOMPATIBLE`.

2. **Slot walking:** for each slot on the composed side:
   - Resolve the slot's binding to a leaf interface (via profile bindings or manual bindings on the instance).
   - On the other side: find a matching leaf via `matchProtocols()` on leaves (slot's `match.protocol` + `match.role`).
   - If a match is found → auto-derived sub-link.
   - If a `manualLink` exists for this slot → manual sub-link (overrides auto).
   - If neither → unresolved slot.

3. **Manual-only:** any `manualLinks` not consumed in step 2 are standalone manual links (no protocol backing). They contribute to completeness but at `manual` tier confidence.

4. **Output:** `{ subLinks: SubLinkResult[], unresolvedSlots: UnresolvedSlot[] }`

### Sub-link Result

```typescript
interface SubLinkResult {
  id: string;
  from: { endpointId: string; interfaceId: string };
  to:   { endpointId: string; interfaceId: string };
  method: "protocol" | "manual" | "inferred";
  locked: boolean;
  slotId?: string;       // which slot this resolves, if applicable
  protocolMatch?: {      // populated for method=protocol
    type: string;
    roleFrom: string;
    roleTo: string;
  };
}
```

---

## 6. Evaluation Pipeline

Each harness flows through a staged evaluator:

### Stage 1 — Endpoint Resolution

Both endpoints must reference a valid child module + interface (or the parent module's own interface). If either endpoint is unbound → `NOT_CONFIGURED`.

For `or` topology: only the currently-selected endpoint is evaluated; inactive alternatives are ignored.

### Stage 2 — Tier Determination

Try in order:

1. **Protocol:** both sides declare matching protocol → `matchProtocols()` returns compatible → tier = `protocol`.
2. **Compositional:** one side has composed interface with slots → `findCompositionalMatch()` against the other module → tier = `compositional`. Inferred interface derived for the other side.
3. **Inferred:** neither side explicitly declares the other's protocol, but slot/capability walking establishes a mapping → tier = `inferred`.
4. **Manual:** only user-asserted `manualLinks` exist, no protocol match → tier = `manual`.
5. Otherwise → tier = `none`.

### Stage 3 — Sub-link Resolution

Run the algorithm from §5. Count resolved vs required:

- All required slots resolved → proceed to Stage 4.
- Some required slots unresolved → state = `CONFIGURATION_NEEDED` (but still run Stage 4 on resolved sub-links for partial diagnostics).

### Stage 4 — Parameter Checking

For each resolved sub-link (and the top-level interface pair), run `checkParameterCompatibility()`:

- Range overlap → pass.
- Range mismatch → diagnostic with severity.
- Voltage completely out of range → `error`.
- Voltage near edge → `warning`.
- Missing parameter on one side → `info` (can't validate, no error).

### Stage 5 — State Rollup

Combine tier + sub-link resolution + parameter diagnostics into a single `ConnectionState`:

| Tier | Sub-links | Parameters | → State |
|---|---|---|---|
| protocol | all resolved | all pass | `VALID` |
| protocol | all resolved | warnings | `WARNING` |
| protocol | some unresolved | — | `CONFIGURATION_NEEDED` |
| compositional | all resolved | all pass | `VALID` |
| compositional | all resolved | warnings | `WARNING` |
| inferred | all resolved | all pass | `VALID_INFERRED` |
| manual | — | — | `VALID_MANUAL` |
| none | — | — | `INCOMPATIBLE` |
| any | — | errors | highest severity wins |

---

## 7. Diagnostic Types

```typescript
interface Diagnostic {
  severity: "error" | "warning" | "info";
  code: DiagnosticCode;
  message: string;
  suggestion?: string;
}

type DiagnosticCode =
  | "ENDPOINT_UNBOUND"        // harness endpoint has no module/interface
  | "PROTOCOL_MISMATCH"       // no matching protocol type
  | "ROLE_MISMATCH"           // protocol types match but roles incompatible
  | "DOMAIN_MISMATCH"         // electrical vs mechanical, etc.
  | "UNRESOLVED_SLOT"         // required slot has no sub-link
  | "PARAM_OUT_OF_RANGE"      // parameter range doesn't overlap (error)
  | "PARAM_NEAR_LIMIT"        // parameter near edge of range (warning)
  | "PARAM_MISSING"           // one side lacks parameter, can't validate (info)
  | "MANUAL_OVERRIDE"         // manual link overrides derived link (info)
  | "NO_PROTOCOL_GUIDANCE"    // manual link without protocol match (info)
  | "CLAIM_CONFLICT"          // interface claimed by another interface binding
  | "GROUP_VIOLATION";        // interface group policy violated

interface HarnessDRCResult {
  harnessId: string;
  state: ConnectionState;
  tier: "protocol" | "compositional" | "inferred" | "manual" | "none";
  confidence: number;   // 0.0 - 1.0

  interfaceMatch?: ProtocolMatchResult | CompositionalMatchResult;

  subLinks: SubLinkResult[];
  unresolvedSlots: { endpointId: string; slotId: string; reason: string }[];

  diagnostics: Diagnostic[];
}
```

---

## 8. Board-level DRC

Aggregate across all harnesses in a module:

```typescript
interface ModuleDRCResult {
  moduleId: string;
  harnessResults: Record<string, HarnessDRCResult>;
  groupResults: GroupValidationResult[];      // from binding/groups.ts
  constraintResults: ConstraintDiagnostic[];  // from parameters/constraints.ts
  claimConflicts: string[];                   // from binding/claims.ts
  summary: {
    valid: number;
    warning: number;
    error: number;
    configurationNeeded: number;
  };
}
```

---

## 9. Integration with Existing Engine

The DRC is a composer, not a reimplementation. It calls existing functions:

| DRC stage | Function | File |
|---|---|---|
| Protocol match | `matchProtocols()` | `src/matching/protocol-match.ts` |
| Role compatibility | `areRolesCompatible()` | `src/matching/roles.ts` |
| Compositional match | `findCompositionalMatch()` | `src/matching/composition.ts` |
| Inferred interfaces | `deriveInferredInterface()` | `src/matching/inferred.ts` |
| Compatible pairs | `findCompatiblePairs()` | `src/matching/compatibility.ts` |
| Binding validation | `validateBinding()` | `src/binding/capability-check.ts` |
| Profile validation | `validateProfile()` | `src/binding/profile.ts` |
| Interface claims | `getClaimedInterfaces()`, `findClaimConflicts()` | `src/binding/claims.ts` |
| Group policies | `validateInterfaceGroups()` | `src/binding/groups.ts` |
| Parameter compatibility | `parameterCompatible()`, `checkParameterCompatibility()` | `src/parameters/range.ts` |
| Constraints | `evaluateConstraints()` | `src/parameters/constraints.ts` |

---

## 10. Open Questions

1. **Manual link granularity:** does a manual link reference leaf interface IDs, or can it reference composite interfaces ("SPI bus → SPI bus, don't introspect")?
2. **Auto-lock threshold:** should `protocol` tier matches auto-lock, or do manual locks always require user action?
3. **Warning vs error for parameter mismatches:** voltage range doesn't overlap is error. 3.3V source to 5V-tolerant 3.3V-preferred input — warning or info?
4. **Partial composition:** if composition is incomplete (some slots resolved, some not), is it `CONFIGURATION_NEEDED` or partially `VALID`?
5. **Bus topology sub-links:** for a bus harness with 3+ endpoints, evaluate pairwise or as a full bus (all must agree)?
6. **OR harness behavior:** DRC should validate only the selected branch. Inactive alternatives produce no diagnostics.
