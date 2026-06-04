# AllocationPlan, Public API & ACME Symbols: RD-05 SFA Frame Planner

> **Document**: 03-05-allocation-plan-and-api.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-05 R47–R59, §4.1/§4.10/§4.11/§4.12; spec Ch 11 §3.5, AR-66

## Overview

Defines the planner's output record (`AllocationPlan` + sub-records), the ACME symbol-definition
generator, the orchestrating `planAllocation()` entry point (the 9-step pipeline), and the single
deferred wiring seam `modelToFunctionInfo()`.

## Architecture

### `AllocationPlan` and sub-records (core `sfa/allocation-plan.ts`)

```typescript
import type { Type } from "../semantics/type.js";
import type { FunctionFrame } from "./frame.js";
// + ModuleVariableAllocation, ZpAllocation (03-03), StackAnalysis (03-04)

export interface FrameAllocation {
  readonly functionName: string;
  readonly frame: FunctionFrame;
  readonly offset: number;            // within frame region
  readonly absoluteAddress: number;   // frameRegionBase + offset
}

export interface SymbolDefinition {
  readonly name: string;              // ACME symbol, e.g. "__frame_Game_update"
  readonly value: number;             // address
}

export interface SfaResourceData {
  readonly frameRegionBytes: number;
  readonly frameRegionPeak: number;   // = frameRegionBytes (AR-92)
  readonly frameSharingSaved: number; // Σ frame sizes − region size (R56)
  readonly zpUsed: number;
  readonly zpBudget: number;
  readonly ramUsed: number;           // moduleVariablesSize + frameRegionSize
  readonly ramBudget: number;
  readonly stackWorstCase: number;
  readonly stackBudget: number;
}

export interface AllocationPlan {
  readonly frames: ReadonlyMap<string, FrameAllocation>;
  readonly frameRegionBase: number;
  readonly frameRegionSize: number;
  readonly peakSimultaneous: number;  // = frameRegionSize (AR-92)
  readonly sharingSaved: number;
  readonly zpAllocations: readonly ZpAllocation[];
  readonly zpUsed: number;
  readonly zpBudget: number;
  readonly moduleVariables: readonly ModuleVariableAllocation[];
  readonly moduleVariablesSize: number;
  readonly stackAnalysis: StackAnalysis;
  readonly symbolDefinitions: readonly SymbolDefinition[];
  readonly resourceData: SfaResourceData;
  readonly hasErrors: boolean;        // true if E10032 or E10033 emitted (R51/R59)
}
```

The plan is **immutable** (R59): all `readonly`, returned frozen; downstream phases only read.

### ACME symbol naming (R47, §4.11) — `symbols.ts`

| Category               | Pattern                            | Example                  |
| ---------------------- | ---------------------------------- | ------------------------ |
| Function frame base    | `__frame_<Module>_<function>`      | `__frame_Game_update`    |
| Frame slot             | `__frame_<Module>_<function>_<slot>` | `__frame_Game_update_dx` |
| Module-level variable  | `__var_<Module>_<name>`            | `__var_Game_score`       |
| ZP user variable       | `__zp_<Module>_<name>`             | `__zp_Irq_rasterLine`    |
| ZP pointer             | `__zp_ptr_<N>`                     | `__zp_ptr_0`             |
| ZP main temp           | `__zp_tmp_<N>`                     | `__zp_tmp_0`             |
| ZP IRQ temp            | `__zp_irq_tmp_<N>`                 | `__zp_irq_tmp_0`         |

```typescript
// symbols.ts
export function generateSymbolDefinitions(plan: {
  frames: ReadonlyMap<string, FrameAllocation>;
  moduleVariables: readonly ModuleVariableAllocation[];
  zpAllocations: readonly ZpAllocation[];
}): SymbolDefinition[];
```

**Name sanitization (R47/R33-symbols):** the fully-qualified `Module.function` → replace `.` with
`_`; only `[A-Za-z0-9_]` allowed; `__` prefix guarantees no collision with user labels. Frame-base
symbol = `absoluteAddress`; slot symbol = `absoluteAddress + slot.offset`; module var = its
`address`; ZP symbols = their ZP `address`. Order is deterministic (frames by name, then module
vars in layout order, then ZP allocations in allocation order) so the emitted `.asm` header is
stable for goldens (R50/AR-66).

### `planAllocation()` — the 9-step pipeline (R51–R59, §4.1/§4.12) — `plan-allocation.ts`

```typescript
import type { FunctionInfo, AllocationPlan, PlatformProfile } from "@blend65/core";
import type { DiagnosticBag } from "@blend65/core";

export interface ModuleVarInput {
  readonly moduleName: string; readonly variableName: string;
  readonly type: Type; readonly size: number;
}

export interface PlanInput {
  readonly functions: readonly FunctionInfo[];
  readonly moduleVars: readonly ModuleVarInput[];
  readonly zpUserVars: readonly { name: string; size: number }[];
  readonly upstreamErrors: boolean;
}

export function planAllocation(
  input: PlanInput, profile: PlatformProfile, bag: DiagnosticBag,
): AllocationPlan;
```

> **API shape decision — resolved as D9 (consistency with RD-03/RD-04):** like `parse(ParseInput)`
> and `analyze(AnalyzeInput)`, `planAllocation` takes a single **input object** + `profile` + `bag`.
> RD-05 §4.12 illustrates `planAllocation(model, profile, bag)`; we substitute the `PlanInput`
> object (carrying the `FunctionInfo[]` and the module/ZP-var lists) for the deferred `model`,
> consistent with D3/D5. This is a signature **refinement** (no semantic change) formally recorded
> in `00-ambiguity-register.md` as **D9** — it mirrors the established object-input convention and
> is future-proof (F1). AC-01 (see `01-requirements.md`) is annotated to track the `PlanInput` form.

Pipeline (§4.1):
```
1. frames        = computeFrames(input.functions)                 // 03-01
2. graph         = buildInterferenceGraph(input.functions)        // 03-02
3. coloring      = colorFrames(frames, graph)                     // 03-02 → offsets, regionSize
4. moduleLayout  = layoutModuleVariables(input.moduleVars)        // 03-03
5. frameRegionBase = profile.ramStart + moduleLayout.totalSize    // 03-03 §4.6
   frameAllocs   = build FrameAllocation per reachable function (offset, absoluteAddress)
6. peakPointers  = computePeakPointers(input.functions, graph)    // 03-03
   zp            = allocateZeroPage({userVars, peakPointers, mainTemps, irqTemps, argBlockMin}, profile, bag)
7. stack         = analyzeStack(input.functions, profile)         // 03-04
8. ramUsed = moduleLayout.totalSize + coloring.frameRegionSize
   checkBudgets({zpUsed: zp.used, zpBudget, ramUsed, ramBudget, zpOverflowed: zp.overflowed,
                 stack, upstreamErrors: input.upstreamErrors}, profile, bag)   // 03-04
9. symbols       = generateSymbolDefinitions({frames: frameAllocs, moduleVariables, zpAllocations})
   assemble immutable AllocationPlan (hasErrors = zp.overflowed || ramUsed > ramBudget)
```

`zpBudget = profile.zpEnd − profile.zpStart + 1`; `ramBudget = profile.ramEnd − profile.ramStart`.

### Deferred wiring seam — `model-adapter.ts` (R: RD-04 interaction, D1/D3/D5)

```typescript
import type { SemanticModel } from "@blend65/core";
import type { FunctionInfo } from "@blend65/core";

/**
 * Extract FunctionInfo[] from a populated SemanticModel.
 *
 * DEFERRED(RD-05-wiring): the RD-04 analyzer is a passthrough (empty model), so
 * there are no functions to extract yet. Returns [] today. When the RD-04b
 * checker populates callGraph/symbolMap/typeMap, this adapter is filled in
 * WITHOUT changing any SFA pass. See plans/rd-05-sfa-frame-planner/00-index.md.
 */
export function modelToFunctionInfo(_model: SemanticModel): FunctionInfo[] {
  return []; // DEFERRED(RD-05-wiring)
}
```

The `_model` parameter uses the `_`-prefix convention (RD-04 D15) to satisfy both
`tsc --noUnusedParameters` and ESLint `argsIgnorePattern: "^_"`.

## Code Examples

### Minimal end-to-end (gate-like)

```typescript
const bag = createDiagnosticBag();
const plan = planAllocation(
  { functions: [mainFn], moduleVars: [], zpUserVars: [], upstreamErrors: false },
  C64_FIXTURE_PROFILE, bag,
);
// main with no params/locals → frameRegionSize 0; zp has arg-block+temps; no diagnostics.
// plan.symbolDefinitions includes __frame_main = <frameRegionBase>.
```

## Error Handling

| Error Case                          | Handling Strategy                                  | AR Ref |
| ----------------------------------- | -------------------------------------------------- | ------ |
| Empty `functions`                   | Region size 0, empty frames map, valid plan        | R60    |
| `upstreamErrors=true`               | Budgets suppressed; plan still assembled           | R62    |
| Name with non-ASCII (shouldn't occur)| Sanitized to `[A-Za-z0-9_]`                        | R47    |
| E10032/E10033 emitted               | `plan.hasErrors=true`                              | R51    |

> **Traceability:** maps to RD-05 §4.1/§4.10/§4.11/§4.12 and Ch 11 §3.5, AR-66.

## Testing Requirements

- Unit: `generateSymbolDefinitions` names + values for each category; deterministic order.
- Unit: `planAllocation` wires the 9 steps; `resourceData`/`hasErrors` correct.
- Spec/golden: full `AllocationPlan` snapshot for the Ch 11 §3.4 program (AC-07/AC-21).
- Unit: `modelToFunctionInfo` returns `[]` under passthrough (AC-22).
- See `07-testing-strategy.md` ST-A1..ST-A6, ST-P1..ST-P6.
