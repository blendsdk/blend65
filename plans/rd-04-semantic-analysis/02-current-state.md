# Current State: RD-04 Semantic Analysis (Skeleton)

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The front-end pipeline is built through RD-03. The semantic analyzer consumes the parser's
output, so its inputs already exist and are frozen-by-completion:

- **`@blend65/core` — AST vocabulary** (`packages/core/src/ast/`): 50 node kinds, the
  `ProgramNode` root, the four group unions (`TopLevelItem`, `StmtNode`, `ExprNode`,
  `TypeNode`), `AstVisitor<R>`, `walkNode`/`walkChildren`, and `RESERVED_BUILTINS` (22 names).
  Every node carries a core `SourceSpan` as `node.span`. `PrimitiveTypeName` is
  `"byte" | "sbyte" | "word" | "sword" | "boolean" | "void"` — note **`"boolean"`** (D5).
- **`@blend65/core` — diagnostics** (`packages/core/src/diagnostics/`): `DiagnosticBag`,
  `Diagnostic`, `SourceSpan` (`{ sourceId, start, end }`), `SourceId`, `LineMap`, and the full
  `DiagCode` registry. **All ~60 semantic diagnostic codes RD-04 would emit already exist** in
  the registry (E10003, E10010, E10012, E10020/21/23, E10080–E10083, E10100/E10101,
  E10110–E10115, E10140–E10143, E10150–E10155, E10160–E10163, E10170–E10175, E10191–E10194,
  E10200–E10204, E10040/E10041, E10064, E10130–E10133, W10130/W10190/W10191) — added during
  RD-03/RD-11a. **This plan adds no new codes** (the checker that *uses* them is deferred).
- **`@blend65/frontend` — lexer + parser** (`packages/frontend/src/`): `parse(input:
  ParseInput): ParseResult` producing a `ProgramNode`; `ParseInput = { tokens, source,
  sourceId, bag }`.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/core/src/ast/nodes.ts` | AST node interfaces (incl. `PrimitiveTypeName`, `StructDeclNode`, `EnumDeclNode`, `ProgramNode`) | **Read-only reference** — the semantic `Type` references `StructDeclNode`/`EnumDeclNode`. No change. |
| `packages/core/src/diagnostics/diagnostic-codes.ts` | Diagnostic registry | **No change** — all codes already present. |
| `packages/core/src/diagnostics/diagnostic-bag.ts` | `DiagnosticBag` | **Read-only** — `analyze()` accepts a bag, adds nothing (D3). |
| `packages/core/src/index.ts` | Core barrel | **Add** `export * from "./semantics/index.js";` |
| `packages/frontend/src/index.ts` | Frontend barrel | **Add** `export * from "./semantics/index.js";` |
| `packages/platforms/src/index.ts` | Platforms package | **No change** — `VERSION` stub only; `PlatformProfile` stub lives in **core** (D4/D7), not here. |
| `requirements/RD-04-semantic-analysis.md` | RD-04 requirements (not frozen) | **Annotate** with `SEMANTICS-DEFERRED` banner (D9). |

### Code Analysis

The core barrel currently re-exports `diagnostics`, `tokens`, `ast`:

```typescript
// packages/core/src/index.ts (as-built)
export const VERSION = "0.1.0";
export * from "./diagnostics/index.js";
export * from "./tokens/index.js";
export * from "./ast/index.js";
```

The new `semantics/` module appends one line — additive, mirroring how `ast/` was added in
RD-03. The frontend barrel similarly appends `export * from "./semantics/index.js";` next to
the existing `lexer`/`parser` exports.

The semantic `Type` union references AST declaration nodes (`StructType.decl: StructDeclNode`,
`EnumType.decl: EnumDeclNode`), which already exist in `ast/nodes.ts` and are re-exported from
the core barrel — so `semantics/` imports them via relative `../ast/...` paths within core.

## Gaps Identified

### Gap 1: No semantic type representation

**Current Behavior:** The compiler has AST `TypeNode`s (syntactic: `PrimitiveTypeNode`,
`NamedTypeNode`, `ArrayTypeNode`, `ErrorTypeNode`) but **no resolved semantic `Type`** (the
discriminated union with computed struct sizes, enum member maps, poison type).
**Required Behavior:** A `Type` union in `@blend65/core` per RD-04 §4.4.
**Fix Required:** Add `semantics/type.ts` + `semantics/type-utils.ts` (FR-S1–S4).

### Gap 2: No scope / symbol / model vocabulary

**Current Behavior:** No `Scope`, `Symbol`, `CallGraph`, `ConstValue`, or `SemanticModel`.
**Required Behavior:** These interfaces per RD-04 §4.2/§4.3/§4.7/§4.8/§4.10.
**Fix Required:** Add `semantics/scope.ts`, `symbol.ts`, `call-graph.ts`, `const-value.ts`,
`semantic-model.ts` (FR-S5–S10).

### Gap 3: No `analyze()` entry point

**Current Behavior:** The pipeline stops at `parse()`. Downstream phases have nothing to
consume.
**Required Behavior:** `analyze(input: AnalyzeInput): SemanticModel` in `@blend65/frontend`,
passthrough (FR-S11–S15).
**Fix Required:** Add `semantics/analyze.ts` + `semantics/passes.ts` (stubbed) + barrel.

### Gap 4: No `PlatformProfile` (RD-10 not built)

**Current Behavior:** `@blend65/platforms` is an empty `VERSION` stub.
**Required Behavior:** `analyze()` needs a `PlatformProfile` parameter (R118/R120).
**Fix Required:** Minimal stub interface in `@blend65/core` (D4); RD-10 supersedes.

### Gap 5: Deferral is undocumented

**Current Behavior:** Nothing records what semantic checking is intentionally absent.
**Required Behavior:** A traceable map for the future checker.
**Fix Required:** `08-deferred-semantics-ledger.md` + in-code markers + requirements banner
(FR-S17–S19).

## Dependencies

### Internal Dependencies

- **RD-03 (parser & AST)** — DONE. Provides `ProgramNode[]` and all referenced declaration
  nodes. `analyze()` consumes `parse()` output.
- **RD-11a (diagnostics core)** — DONE. Provides `DiagnosticBag` (accepted, unused by
  passthrough) and the code registry.

### External Dependencies

- None. Offline TypeScript compiler component.

### Deferred / Forward Dependencies (not blockers for the skeleton)

- **RD-10 (platform profiles)** — will supersede the `PlatformProfile` stub.
- **RD-17 (intrinsic descriptors)** — will supply the descriptors the future checker uses.
- **RD-05/06/07** — will *consume* `SemanticModel`; this plan gives them its shape.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Skeleton interfaces drift from the real checker's needs later | Med | Med | Interfaces copied verbatim from RD-04 §4 (the same doc the checker will implement); ledger keeps the mapping live |
| `// DEFERRED` stubs read as dead code / fail lint (`noUnusedParameters`) | Med | Low | Prefix intentionally-unused params with `_` or reference them in a documented no-op; keep stubs minimal; code.md rule-4 exception for planned seams |
| `PlatformProfile` stub conflicts with RD-10's eventual shape | Low | Low | Stub is minimal + marked superseded-by-RD-10; `analyze()` ignores it, so only the type name is load-bearing |
| Future reader misses what's unimplemented | Low | High | Three-layer deferral doc (ledger + markers + banner) is the core deliverable (D8) |
| Accidental `@blend65/codegen` import from frontend | Low | High | R15 boundary tier + ESLint `no-restricted-imports` already guard every build |
