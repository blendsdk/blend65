# Passthrough Analyzer: RD-04 Semantic Analysis (Skeleton)

> **Document**: 03-03-passthrough-analyzer.md
> **Parent**: [Index](00-index.md)
> **Package**: `@blend65/frontend` (new `semantics/` module)
> **Implements**: RD-04 §3.17 (R118–R121), §4.1 (pass seams), AC-01

## Overview

This component defines the **public entry point** `analyze(input: AnalyzeInput): SemanticModel`
and the **four named pass-function seams** (R1–R6 / §4.1). In this skeleton, `analyze()` is a
**passthrough**: it builds and returns the empty model from `createEmptyModel()` (D2), emits
no diagnostics (D3), and never throws (AC-01). The four pass functions exist as documented
no-op stubs so the future checker has named, traceable insertion points.

## Architecture

### Current Architecture

The front-end pipeline ends at `parse()`. There is no `analyze()`.

### Proposed Changes

Add `packages/frontend/src/semantics/analyze.ts`, `semantics/passes.ts`, and
`semantics/index.ts`; wire the barrel into `packages/frontend/src/index.ts`. Additive; imports
`@blend65/core` only (R15/AR-20).

## Implementation Details

### `semantics/analyze.ts` — `AnalyzeInput` + `analyze()` (R118–R119, D6)

```typescript
import type { ProgramNode } from "@blend65/core";
import type { DiagnosticBag, PlatformProfile, SemanticModel } from "@blend65/core";
import { createEmptyModel } from "@blend65/core";
import { collectDeclarations, resolveTypes, checkBodies, postCheck } from "./passes.js";

/**
 * Input to the semantic analyzer (RD-04 R118–R119, D6).
 *
 * Object-shaped (mirrors RD-03 `ParseInput`) so the future checker can add OPTIONAL fields
 * (options, cancellation) without a breaking signature change (F1-Extensible).
 */
export interface AnalyzeInput {
  /** Parsed ASTs from all source files (one ProgramNode per file). */
  readonly programs: readonly ProgramNode[];
  /** Shared diagnostic bag. PASSTHROUGH: nothing is added (D3). */
  readonly bag: DiagnosticBag;
  /** Platform profile (RD-04 R120). PASSTHROUGH: accepted but not read (D4). */
  readonly profile: PlatformProfile;
}

/**
 * Semantic analysis entry point (RD-04 R118).
 *
 * 🚧 PASSTHROUGH (RD-04 plan, D1/D2/D3): this implementation performs NO semantic checking.
 * It returns a structurally-valid empty SemanticModel (hasErrors === false), emits no
 * diagnostics, and never throws (AC-01). The real four-pass type/scope/control-flow analyzer
 * is DEFERRED — see plans/rd-04-semantic-analysis/08-deferred-semantics-ledger.md for the full
 * map of what is not yet implemented and which diagnostic codes each deferred check emits.
 */
export function analyze(input: AnalyzeInput): SemanticModel {
  const model = createEmptyModel();

  // The four-pass architecture (RD-04 R1–R6) is represented by named seams. In the passthrough
  // these are no-ops; the future checker fills them in order. Called for traceability only.
  collectDeclarations(input, model); // Pass 1 — DEFERRED(RD-04-checker): R2
  resolveTypes(input, model);        // Pass 2 — DEFERRED(RD-04-checker): R3
  checkBodies(input, model);         // Pass 3 — DEFERRED(RD-04-checker): R4
  postCheck(input, model);           // Pass 4 — DEFERRED(RD-04-checker): R5

  return model;
}
```

### `semantics/passes.ts` — four stubbed pass functions (R1–R6 / §4.1)

```typescript
import type { SemanticModel } from "@blend65/core";
import type { AnalyzeInput } from "./analyze.js";

/* eslint-disable @typescript-eslint/no-unused-vars -- DEFERRED seams: params document the
   future checker's inputs; intentionally unused in the passthrough (code.md rule-4 exception). */

/**
 * Pass 1 — Declaration Collection (RD-04 R2, §4.1).
 * DEFERRED(RD-04-checker): register modules + top-level decls + struct fields + enum members
 * + export visibility + intrinsic symbols. Emits E10003 on duplicates.
 */
export function collectDeclarations(_input: AnalyzeInput, _model: SemanticModel): void {
  // no-op (passthrough)
}

/**
 * Pass 2 — Type Resolution (RD-04 R3, §4.1).
 * DEFERRED(RD-04-checker): resolve named types, validate struct fields (no recursion),
 * compute struct sizeof, validate enum backing values. Emits E10151/E10142/E10143/E10163.
 */
export function resolveTypes(_input: AnalyzeInput, _model: SemanticModel): void {
  // no-op (passthrough)
}

/**
 * Pass 3 — Body Checking (RD-04 R4, §4.1).
 * DEFERRED(RD-04-checker): type-check expressions, validate statements, const-eval, intrinsic
 * validation, build call graph, resolve identifiers. Emits the bulk of E10xxx.
 */
export function checkBodies(_input: AnalyzeInput, _model: SemanticModel): void {
  // no-op (passthrough)
}

/**
 * Pass 4 — Post-Check Validation (RD-04 R5, §4.1).
 * DEFERRED(RD-04-checker): verify main() signature, detect recursion, module init order,
 * unused variables, unreachable code. Emits E10020/E10021/E10174/W10130/W10191/E10194.
 */
export function postCheck(_input: AnalyzeInput, _model: SemanticModel): void {
  // no-op (passthrough)
}
```

> **Lint approach for the unused params:** the four pass functions take `AnalyzeInput`/
> `SemanticModel` to document the checker's eventual signature, but the passthrough uses
> neither. We satisfy `noUnusedParameters`/ESLint via `_`-prefixed names plus a scoped
> `eslint-disable` with a rationale comment (code.md rule-4 exception for planned seams). The
> execution phase will pick whichever of (`_`-prefix) / (scoped disable) the as-built ESLint
> config accepts cleanly — this is a lint-mechanics detail, not a behavioral choice. If the
> config rejects both, the fallback is to drop the params from the stubs and re-add them with
> the checker (the seams stay named either way). No new ambiguity: the *contract* (four named
> no-op seams) is fixed.

### `semantics/index.ts` (barrel)

```typescript
export { analyze } from "./analyze.js";
export type { AnalyzeInput } from "./analyze.js";
```

### Frontend barrel wiring (`packages/frontend/src/index.ts`)

Append one additive line next to the existing exports:

```typescript
export * from "./semantics/index.js";
```

## Integration Points

- **Input:** `analyze()` consumes `ProgramNode[]` from `parse()` (RD-03). A test composes
  `parse()` → `analyze()` end-to-end (AC-S1).
- **Output:** the returned `SemanticModel` is the contract for RD-05/06/07/14.
- **Boundary:** imports `@blend65/core` only — never `@blend65/codegen` (R15/AR-20).

## Code Examples

### Example 1: End-to-end passthrough (AC-01)

```typescript
const bag = new DiagnosticBag();
const { ast } = parse({ tokens, source, sourceId, bag });
const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });

model.hasErrors;       // false (passthrough — D3)
model.mainFunction;    // null (D2)
model.globalScope.kind // "global"
model.typeMap.size;    // 0
```

### Example 2: Never throws on error-laden input (AC-01)

```typescript
// A program that parsed with error-sentinels still analyzes without throwing.
const model = analyze({ programs: [astWithErrorNodes], bag, profile: DEFAULT_PROFILE });
model.hasErrors;       // false (passthrough does not inspect sentinels — D3)
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Any semantic error (the entire E10xxx/W10xxx surface) | **DEFERRED** — passthrough emits nothing | D1/D3 |
| Malformed / error-sentinel AST input | Accepted; `analyze()` returns the empty model without throwing | D2/AC-01 |
| Empty `programs` array | Returns the empty model (valid) | D2 |

> **Traceability:** [Ambiguity Register](00-ambiguity-register.md) D1, D2, D3, D6, D7, D14(FR-S14).
> Deferred map: [08-deferred-semantics-ledger.md](08-deferred-semantics-ledger.md).

## Testing Requirements

- **Spec tests** (`analyze.spec.test.ts`): AC-01 — `parse()`→`analyze()` on a valid program
  returns `hasErrors===false` + empty model; on an error-laden program returns without throwing;
  `analyze({ programs: [], … })` returns a valid empty model; `AnalyzeInput` is constructible.
- **Impl tests**: the four pass functions are exported and callable as no-ops (seam existence).
