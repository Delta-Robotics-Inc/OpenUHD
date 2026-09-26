# Value queries

Implementation: `scripts/docs/lib/values.ts` (resolver), `format.ts` (formatting),
`derived.ts` (derivations). The same resolver runs at build and verify time.

## Forms

```
def:<moduleId>:<path>        field of a module definition (lookup(moduleId))
inst:<instance path>:<path>  same, by instance path (stack/fc, arm_fl/motor, gnss)
sys:<path>                   system results
                               system            the root ModuleDef (links, description…)
                               checks            checkSystem(SYSTEM): links[], diagnostics[]
                               bom               generated/bom.json rows (as published)
                               wiring            wiringChecklist incl. sub-assemblies
                               scenarios         [{id,label,description,diagnostics}] from scenarios.ts
                               assembly          {mates, placements, hardware (counts), issues}
derived:<name>               named derivation
derived:<fn>(a,b)            parameterised derivation
ver:<partId>:<path>          library/parts/<id>/verification.json
test:<test-id>:<path>        <system>/docs/test-data/<test-id>.json
```

Paths: `.key`, `[n]`, `[key=value]` (first element whose key equals value), `.length`.

```
def:dolphinrc-f405-v3-flight-controller:interfaces[id=bec_5v].parameters[id=max_current].value
def:dji-o4-air-unit:traits[type=operating_conditions].params.operating_temperature_C
def:meps-neon-2207-v2-1950kv:traits[type=performance].params.thrust_tests[0].rows[throttle_pct=100].thrust_g
sys:checks.diagnostics[id=supply_budget:stack:bec_10v].details.loadW
sys:system.links[id=stack_mount].mate.gapMm
test:throttle-sweep:rows[3][4]          (unit = columns[4].unit)
```

A parameter stated as a `range` resolves `…value` to the range (`[6, 30]` → `6.0–30.0 V`).

## Units

- `parameters[…].value` takes the parameter's `unit`;
- metadata keys carry units by suffix: `_mm _g _V _A _mA _W _Wh _mAh _ms _s _C _Hz _deg _in _rpm`
  (`weight_g` → g, `operating_temperature_C` → °C);
- otherwise pass `u=<unit>` in the format.

## Status

| Status | When | Marker |
| --- | --- | --- |
| `source` | a library part with `sources.json` / `verification.json` | none |
| `model` | a custom module's design value, a UHD check result, a BOM row | none |
| `assumption` | the module has an `assumption` trait whose `field` names the value | A |
| `derived` | `derived:` queries (formula + input queries recorded) | D |
| `standin` | `test:` query on a stand-in file, or a derivation with a stand-in input | S |
| `measured` | `test:` query on a measured file | M |
| `gap` | the path resolves to nothing: rendered "—" | — |

## Adding a derivation

```ts
// scripts/docs/lib/derived.ts
"power.hover_margin": {
  label: "…", unit: "%", formula: "human-readable formula",
  compute: (ctx) => ({ value, inputs: ["def:…", "sys:…"], note: "…" }),
},
```

Find modules by what they are (`category(def)`), not by id, so the derivation works for other
systems. Never compute a shown value inside a builder: put it here so the verifier recomputes it.
