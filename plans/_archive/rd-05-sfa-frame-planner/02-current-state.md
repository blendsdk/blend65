# Current State: RD-05 SFA Frame Planner

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The front-end is built through RD-04 (passthrough). Relevant as-built facts:

- **`@blend65/core`** exports (`packages/core/src/index.ts`): `diagnostics/`, `tokens/`,
  `ast/`, `semantics/`. RD-05 adds a fourth domain barrel: `sfa/`.
- **Diagnostics** (`core/src/diagnostics/`): `createDiagnosticBag()` returns a `DiagnosticBag`
  with `addError`/`addWarning`/`addICE`/`hasErrors`/`getAll`/`getErrors`/`getWarnings`/`count`.
  Diagnostic codes live in `diagnostic-codes.ts`. **Verified present:** `ZpBudgetExceeded`
  `"E10032"`, `RamBudgetExceeded` `"E10033"`, `LargeZpAllocation` `"W10030"`, `RamNearingLimit`
  `"W10033"`, `StackDepthNearLimit` `"W10180"` (D4 satisfied).
- **Semantic types** (`core/src/semantics/type.ts`): `Type = PrimitiveType | ArrayType |
  StructType | EnumType | ErrorType`. `StructType.byteSize: number` and
  `StructType.fields: Map<string,{type,offset}>` exist; `ArrayType.element/size` exist;
  `PrimitiveName = "byte"|"sbyte"|"word"|"sword"|"boolean"|"void"`. RD-05's frame-size table
  consumes these directly. `byteSize(t: Type)` already exists in `type-utils.ts` (RD-04 D13):
  byte/sbyte/boolean→1, word/sword→2, void/error→0, struct→`byteSize`, array→recursive — RD-05
  reuses it for **local** slot sizing.
- **`SemanticModel`** (`core/src/semantics/semantic-model.ts`): empty under the passthrough —
  `callGraph` empty, `mainFunction=null`, all maps empty. `CallGraph` has `functions`/`edges`/
  `findCycles()→[]`. **This is the gap RD-05 designs around (see below).**
- **`PlatformProfile`** (`core/src/semantics/platform-profile.ts`): a 2-field stub
  `{ name, charEncoding }` + `DEFAULT_PROFILE`. RD-05 extends it additively with budget fields.
- **`@blend65/frontend`** exports (`packages/frontend/src/index.ts`): `lexer/`, `parser/`,
  `semantics/`. RD-05 adds `sfa/`. The frontend already (correctly) does **not** import
  `@blend65/codegen` (R15/AR-20), enforced by root ESLint + `test/boundary.spec.test.ts`.
- **Lint convention (RD-04 D15):** root ESLint sets `argsIgnorePattern: "^_"` and
  `tsconfig.base.json` sets `noUnusedParameters: true` + `noUnusedLocals: true`. Any
  intentionally-unused param (e.g. in the deferred adapter) uses a `_`-prefix.

### Relevant Files

| File                                              | Purpose                                  | Changes Needed                              |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| `packages/core/src/index.ts`                      | core barrel                              | Add `export * from "./sfa/index.js"`        |
| `packages/core/src/semantics/platform-profile.ts` | `PlatformProfile` stub                   | **Additive** interim budget fields (D2)     |
| `packages/core/src/semantics/type-utils.ts`       | `byteSize`/`bitWidth` etc.               | Reuse (no change)                           |
| `packages/core/src/diagnostics/diagnostic-codes.ts` | E/W codes                              | Reuse (no change — codes present)           |
| `packages/frontend/src/index.ts`                  | frontend barrel                          | Add `export * from "./sfa/index.js"`        |
| `packages/core/src/sfa/*`                          | (new) `FunctionInfo`, frames, plan       | Create                                      |
| `packages/frontend/src/sfa/*`                     | (new) planner passes + adapter           | Create                                      |

## Gaps Identified

### Gap 1: No live frame inputs (the empty `SemanticModel`)

**Current Behavior:** `analyze()` returns an empty model — no functions, no call edges.
**Required Behavior:** the planner needs ordered params/locals + interrupt/escape/reachability
flags + call edges per function.
**Fix (D3/D5):** the planner consumes an RD-05-owned `FunctionInfo[]` (built by fixtures now).
A thin `modelToFunctionInfo(model)` adapter — the single deferred seam — returns `[]` today and
is filled in unchanged when RD-04b populates the model. No SFA algorithm depends on the adapter.

### Gap 2: `PlatformProfile` lacks budget fields

**Current Behavior:** `{ name, charEncoding }` only.
**Required Behavior:** `ramStart`/`ramEnd`, `zpStart`/`zpEnd`, `stackBudget`,
`zpArgBlockMin`, ZP/RAM/stack warning thresholds, and main/IRQ temp defaults.
**Fix (D2):** add these additively; ship a C64-shaped fixture profile for tests. RD-10 supersedes.

### Gap 3: No SFA module

**Current Behavior:** neither core nor frontend has an `sfa/` module.
**Required Behavior:** core `sfa/` (records) + frontend `sfa/` (passes), wired through barrels.
**Fix (D6):** create both; export additively.

## Dependencies

### Internal Dependencies

- `@blend65/core`: `Type`/`byteSize` (frame sizing), `DiagnosticBag` + codes (budgets),
  `PlatformProfile` (budgets), `SemanticModel`/`CallGraph` (adapter seam only).
- `@blend65/frontend`: depends on `@blend65/core`; must **not** depend on `@blend65/codegen`.

### External Dependencies

- None. Pure TypeScript; Vitest for tests.

## Risks and Concerns

| Risk                                                       | Likelihood | Impact | Mitigation                                                        |
| ---------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------- |
| Interim `PlatformProfile` diverges from future RD-10 shape | Med        | Low    | Keep fields minimal + additive; document RD-10 supersedes (D2)    |
| Coloring nondeterminism breaks golden snapshots            | Low        | High   | Fixed ordering (size desc, name tiebreak); determinism unit tests |
| Frontend accidentally imports codegen                      | Low        | High   | R15 ESLint rule + `test/boundary.spec.test.ts` already enforce    |
| Over-fitting algorithms to fixtures vs real model          | Med        | Med    | Adapter seam isolates wiring; fixtures mirror Ch 11 §3.4 example  |
| Touching frozen `spec/`                                    | Low        | High   | Additive-only; `git status --porcelain spec/` checked each gate   |
