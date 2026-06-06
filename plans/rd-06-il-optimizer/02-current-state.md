# Current State: RD-06 IL & IL Optimizer

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

RD-01..RD-05 + RD-11a are implemented (uncommitted but green). The relevant surface RD-06
builds **on top of**:

- **`@blend65/codegen`** — currently an **empty stub**: `packages/codegen/src/index.ts`
  contains only `export const VERSION = "0.1.0";` and a trivial `index.spec.test.ts`. RD-06
  is the **first real back-end code** in this package. Its package edges already allow
  depending on `core`, `frontend`, and `platforms`.
- **`@blend65/core`** provides everything the IL model and lowering consume:
  - **Diagnostics** — `Diagnostic`, `DiagnosticBag` (`addICE`, `addError`, `addWarning`,
    `hasErrors`), `DiagCode` (incl. `UnreachableCode = "W10130"`), and `IceCode.Unexpected
    = "E90001"` with `isIceCode`. *(verified in `diagnostics/diagnostic-codes.ts`)*
  - **AST** — `NODE_KINDS` / `NodeKind` (a closed set of **50** kinds), the `AstNode`
    records, and `walkNode`. *(verified in `ast/node-kind.ts`)*
  - **Semantics** — `SemanticModel`, `Type` (discriminated union: `PrimitiveType`,
    `ArrayType`, `StructType` (+byteSize), `EnumType`, `ErrorType`), `Scope`/`Symbol`,
    `PlatformProfile` (+ RD-05 interim budget fields).
  - **SFA** — `AllocationPlan` and its sub-records (`FunctionFrame`/`FrameSlot`,
    `ZpAllocation`, `ModuleVariableAllocation`, `StackAnalysis`, `SymbolDefinition`,
    `SfaResourceData`), `FunctionInfo`. The symbolic location names the IL `Location`
    operand references (`__frame_*`, `__var_*`, `__zp_*`) are produced by RD-05's
    `generateSymbolDefinitions` (`sfa/symbols.ts`).
- **`@blend65/frontend`** exposes `parse`/`ParseInput`, `analyze`/`AnalyzeInput`, and
  `planAllocation`/`PlanInput`. Its barrel re-exports lexer/parser/semantics/sfa.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/codegen/src/index.ts` | codegen barrel (stub) | Export new `il/` + `il/optimizer/` modules |
| `packages/codegen/package.json` | already depends on core+frontend+platforms | none expected |
| `packages/core/src/diagnostics/*` | `DiagnosticBag`, `IceCode`, `DiagCode` | **consume only** (no change) |
| `packages/core/src/ast/*` | `NodeKind`, `AstNode`, `walkNode` | **consume only** |
| `packages/core/src/semantics/*` | `SemanticModel`, `Type` | **consume only** |
| `packages/core/src/sfa/*` | `AllocationPlan`, symbol names | **consume only** |
| `test/boundary.spec.test.ts` | R15/AR-20 frontend↛codegen boundary | must stay green (codegen MAY import frontend) |

### Code Analysis

- The codegen package being empty means RD-06 starts clean — no refactor risk, no dead code
  to remove. The IL model is new vocabulary with no prior art to reconcile.
- `DiagnosticBag.addICE` + `IceCode.Unexpected` already exist and are tested
  (`diagnostic-bag.impl.test.ts`), so the lowering-visitor default arm (R69, D6) needs **no
  new diagnostic infrastructure** — it calls `bag.addICE(IceCode.Unexpected, span, msg)`.
- The AST `NodeKind` set is the closed discriminant the lowering visitor switches over; its
  50 kinds (RD-06 §2 says "51" — see Gap 3) give a finite, enumerable default-arm surface.

## Gaps Identified

### Gap 1: No IL representation exists

**Current Behavior:** there is no IL — codegen is empty.
**Required Behavior:** a complete, typed, deterministic IL model (types/operands/
instructions/terminators/CFG/`ILProgram`) + textual printer + optimizer seam.
**Fix Required:** build `il/` (model + printer + lowering) and `il/optimizer/` (pipeline)
per `03-01`/`03-02`/`03-03`. (D1: model+printer+optimizer full; lowering = gate/slice-2.)

### Gap 2: The `SemanticModel` is an empty passthrough (the deferred seam)

**Current Behavior:** `analyze()` returns an empty `SemanticModel` (RD-04 passthrough);
`typeMap`/`callGraph`/symbols are all deferred to a future RD-04b. RD-05's
`modelToFunctionInfo` likewise returns `[]`.
**Required Behavior:** RD-06's lowering needs a *typed* AST to lower correctly (promotion
insertion, location resolution).
**Fix Required (D5):** build + fixture-test the gate/slice-2 lowering against **hand-built**
AST+`SemanticModel`+`AllocationPlan` fixtures (no dependence on the empty live model). The
**only** deferred wiring is the compiler-façade thread `analyze()`→`planAllocation()`→
`lowerToIL()`; an end-to-end call today yields an empty `ILProgram`, by design.

### Gap 3: RD-06 cites "51 AST node kinds"; the codebase has 50

**Current Behavior:** `NODE_KINDS` has **50** entries (AR-1 removed v2's `AsmBlock`).
**Required Behavior:** the lowering visitor switches over the real `NodeKind` set.
**Fix Required:** none in code — the visitor dispatches over the actual 50-kind set; the
"51" in RD-06 §2/§3.1 is a stale count. Recorded here (not a blocker; no spec change — `spec/`
is frozen and this is an RD count, not a spec count). The plan uses the live `NodeKind`.

## Deferred Acceptance-Criteria Ledger (RD-06 §6)

The lowering surface beyond gate/slice-2 is deferred per slice (D1). This ledger keeps the
trace so a future slice knows what to light up.

| AC | Criterion (abbrev.) | Status in this plan | Owning R / future slice |
|----|---------------------|---------------------|--------------------------|
| AC-01 | `lowerToIL` returns `ILProgram` | ✅ this plan (`LowerInput`, D4) | §4.12 |
| AC-02 | every runtime node kind has a lowering | ⛔ DEFERRED — gate/slice-2 only; visitor ICE-default for the rest | R17/R69 per slice |
| AC-03 | all IL carries `ILType` | ✅ this plan (model-level) | R3 |
| AC-04 | promotions → `zext`/`sext` | ⛔ DEFERRED (needs RD-04b typed model) | R4 |
| AC-05 | casts → conversion instr | ⛔ DEFERRED | R52 |
| AC-06 | `&&`/`||` short-circuit branches | ⛔ DEFERRED | R34 |
| AC-07 | `?:` selected-arm branch | ⛔ DEFERRED | R35 |
| AC-08 | `for` loop structure | ⛔ DEFERRED | R39 |
| AC-09 | `switch` cascade | ⛔ DEFERRED | R40 |
| AC-10 | compile-time intrinsics fold to `Immediate` | ⛔ DEFERRED (needs RD-17 descriptors) | R48 |
| AC-11 | `peek`/`poke`/`peekw`/`pokew` → load/store | ✅ (poke/peek subset) this plan; peekw/pokew deferred | R46/R47 |
| AC-12 | CPU intrinsics → `intrinsic` barriers | ⛔ DEFERRED (needs RD-17) | R50/R63 |
| AC-13 | `printIL` deterministic | ✅ this plan | R53 |
| AC-14 | `optimizeIL` runs passes (v1 passthrough) | ✅ this plan | R56/R57 |
| AC-15 | error functions skipped | ✅ this plan | R68 |
| AC-16 | `ILProgram` carries `AllocationPlan` | ✅ this plan | R66 |
| AC-17 | unit tests per construct | ✅ (gate/slice-2 subset) this plan | — |
| AC-18 | golden snapshots | ✅ this plan | R55 |
| AC-19 | decisions trace to AR/spec | ✅ this plan | — |

## Dependencies

### Internal Dependencies

- `@blend65/core` (diagnostics, AST, semantics, SFA records) — consumed.
- `@blend65/frontend` (AST node types, `SemanticModel`/`AllocationPlan` producers) —
  consumed by codegen. **codegen→frontend is a legal edge**; frontend→codegen is forbidden
  (R15/AR-20).

### External Dependencies

- None new. Vitest + tsc + ESLint as configured.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Over-building lowering (v2 "100%" trap) | Med | High | D1 caps lowering at gate/slice-2; visitor ICE-default makes the boundary explicit and testable |
| IL model churns when RD-07/RD-04b land | Low | Med | Model follows RD-06 §4 verbatim + AR-45..52 (already frozen decisions); only lowering breadth grows |
| Golden-snapshot drift | Low | Low | `printIL` is deterministic (R53); snapshots are the intended regression surface (R55) |
| Accidentally importing codegen from frontend | Low | High | `test/boundary.spec.test.ts` (ST-R15a/b/c) already guards this; codegen→frontend is the legal direction |
| `spec/` accidentally modified | Low | High | Plan touches no `spec/` file; final check asserts `git status --porcelain spec/` empty |
