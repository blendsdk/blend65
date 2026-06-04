# Requirements: RD-04 Semantic Analysis (Skeleton)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-04](../../requirements/RD-04-semantic-analysis.md)

## Feature Overview

This plan delivers the **public surface** of RD-04 semantic analysis with a **passthrough**
implementation. The deliverable is: every type, interface, and contract RD-04 specifies for
the `SemanticModel` and the `analyze()` entry point, plus a no-op `analyze()` that accepts the
parsed AST, never throws, and returns a structurally-valid empty `SemanticModel`. The semantic
**checker** (all type/scope/control-flow/const/intrinsic validation) is **deferred** to a
future RD per the project strategy (research: working compiler first). See
[00-ambiguity-register](00-ambiguity-register.md) D1.

> **Why a skeleton?** Downstream phases (RD-05 SFA, RD-06 IL, RD-07 codegen, RD-14 LSP) need a
> stable `SemanticModel` *shape* to compile against. They do **not** need the checker to exist
> in order to be built against unchecked-but-well-formed programs. Shipping the contract now,
> the behavior later, is the incremental "walking skeleton" path (RD-04 §1, AR-38).

## Functional Requirements

> Requirement IDs (FR-S*) are this plan's own; each maps to the RD-04 requirement (Rxx) and/or
> acceptance criterion it satisfies. The full RD-04 Rxx/ACxx coverage map (including everything
> **deferred**) is the [Deferred Semantics Ledger](08-deferred-semantics-ledger.md).

### Must Have (in scope — interfaces + passthrough)

- [x] **FR-S1** — Define the `Type` discriminated union in `@blend65/core` with variants
  `PrimitiveType`, `ArrayType`, `StructType`, `EnumType`, `ErrorType` (RD-04 R24–R29, §4.4).
- [x] **FR-S2** — `PrimitiveType.name` uses the six-name union `"byte" | "sbyte" | "word" |
  "sword" | "boolean" | "void"` matching the frozen AST (D5; RD-04 R25 superseded spelling).
- [x] **FR-S3** — Implement the **pure structural** type utilities: `isInteger`, `isSigned`,
  `isUnsigned`, `bitWidth`, `byteSize`, `isError`, `typeName` (RD-04 §4.4; D10).
- [x] **FR-S4** — Provide **stubbed** `isAssignableTo` and `commonType` with documented
  placeholder behavior + `// DEFERRED(RD-04-checker)` markers (RD-04 R31/R36, §4.6; D10).
- [x] **FR-S5** — Define `ScopeKind` and the `Scope` interface (tree: kind, parent, children,
  symbols map, owning node) in `@blend65/core` (RD-04 R7–R8, §4.2).
- [x] **FR-S6** — Define `SymbolKind` and the `Symbol` interface (name, kind, type, decl, scope,
  exported, mutable, optional `constValue`, `byRef`) in `@blend65/core` (RD-04 §4.3).
- [x] **FR-S7** — Define the `CallGraph` interface (functions set, edges map, `findCycles()`)
  in `@blend65/core` (RD-04 R84–R86, §4.8). `findCycles()` has a passthrough body returning
  `[]` (no edges in the empty model), `// DEFERRED` marked.
- [x] **FR-S8** — Define `ConstValue` (`{ type, value }`) in `@blend65/core` (RD-04 R94, §4.7).
- [x] **FR-S9** — Define a minimal `PlatformProfile` **stub** interface in `@blend65/core`
  (placeholder fields for char encoding / intrinsic availability / resource limits; RD-10
  supersedes) so `analyze()` carries its R118 signature (RD-04 R120; D4).
- [x] **FR-S10** — Define the `SemanticModel` interface in `@blend65/core` exactly per RD-04
  §4.10 (globalScope, typeMap, symbolMap, callGraph, initOrder, constValues, structTypes,
  enumTypes, mainFunction, hasErrors + query helpers `typeOf`/`symbolOf`/`scopeOf`) (RD-04
  R121, §4.10).
- [x] **FR-S11** — Define `AnalyzeInput = { programs, bag, profile }` and the
  `analyze(input: AnalyzeInput): SemanticModel` signature in `@blend65/frontend` (RD-04
  R118–R119; D6).
- [x] **FR-S12** — Implement `analyze()` as a **passthrough**: construct one root `global`
  `Scope`, return a `SemanticModel` with `hasErrors === false`, `mainFunction === null`, and
  all maps/collections empty; perform **no** AST traversal; add **nothing** to the bag (D2/D3).
- [x] **FR-S13** — `SemanticModel` query helpers return defined safe values in the passthrough:
  `typeOf` → `ErrorType`, `symbolOf` → `null`, `scopeOf` → the global scope (D2).
- [x] **FR-S14** — Provide four **stubbed** pass functions (`collectDeclarations`,
  `resolveTypes`, `checkBodies`, `postCheck`) as no-ops with `// DEFERRED(RD-04-checker)`
  markers, so the four-pass architecture (RD-04 R1–R6, §4.1) has named, traceable seams for
  the future checker.
- [x] **FR-S15** — `analyze()` **never throws** for any input, including programs containing
  parser error-sentinels (`ErrorExpr`/`ErrorStmt`/`ErrorType`) (RD-04 AC-01; AR-15).
- [x] **FR-S16** — Wire `semantics/` barrels into `@blend65/core` and `@blend65/frontend`
  `index.ts` (additive).


### Must Have (documentation of deferral — D8)

- [x] **FR-S17** — Author [08-deferred-semantics-ledger.md](08-deferred-semantics-ledger.md):
  every RD-04 requirement R1–R121 and AC-01..AC-20 mapped to status + diagnostic code(s) +
  parked §7 open questions.
- [x] **FR-S18** — Every stub site carries an in-code `// DEFERRED(RD-04-checker): Rxx — <what>`
  marker referencing the ledger.
- [x] **FR-S19** — Annotate `requirements/RD-04-semantic-analysis.md` with a `SEMANTICS-DEFERRED`
  banner marking R30–R117 + AC-02..AC-20 as deferred (D9). No requirement text deleted.

### Should Have

- [x] **FR-S20** — `SemanticModel` and `analyze()` JSDoc explicitly state the passthrough
  contract and point at the ledger (D8 layer 3).


### Won't Have (Out of Scope — DEFERRED to the future semantic-checker RD)

- Type checking & promotion (RD-04 R30–R43): E10150–E10155, E10080–E10083.
- Expression typing behavior (R44–R62): population of `typeMap` with real types.
- Declaration validation (R63–R70): E10003/E10020/E10021/E10140–E10143/E10163/E10175, etc.
- Statement validation (R71–R83): E10064/E10080/E10130–E10133, return checking E10172/E10173.
- Name & module resolution behavior (R14–R23): E10100/E10101/E10012/E10194.
- Call-graph construction & recursion detection behavior (R84–R87): E10174.
- Const evaluation behavior (R88–R94): E10082/E10193, etc.
- Intrinsic validation behavior (R95–R100): E10040/E10041.
- Array & data-inclusion validation (R101–R108): E10110–E10115/E10200–E10204.
- Warning generation (R109–R112): W10130/W10190/W10191.
- Error-tolerance *behavior* — poison propagation, cascade suppression, max-errors, golden
  determinism (R113–R117). (The *interfaces* that enable it — `ErrorType`, `hasErrors` — are
  in scope; the *behavior* is deferred.)
- SFA / IL / codegen / profile-loading / diagnostic rendering (RD-05/06/07/10/11) — owned
  elsewhere regardless.

> The authoritative, line-by-line deferral map is the
> [Deferred Semantics Ledger](08-deferred-semantics-ledger.md).

## Technical Requirements

### Performance

- `analyze()` is O(1) in the passthrough (no AST walk); trivially within any budget.

### Compatibility

- **Additive only:** the frozen AST (`packages/core/src/ast/`) and the diagnostics core are
  **extended, never refactored**. No existing exported shape changes.
- **R15 / AR-20 (load-bearing):** `@blend65/frontend` imports `@blend65/core` only — never
  `@blend65/codegen`. Enforced by ESLint `no-restricted-imports` + the root boundary tier.
- **D3 freeze:** `spec/` is read-only; `git status --porcelain spec/` must stay empty.
- ESM throughout; NodeNext `.js` relative imports; kebab-case filenames; no `private` (use
  `protected`); 2-space indent; split files approaching 500 lines (code.md).

### Security

- N/A — offline compiler component; no user-input/auth/network/secret surface.

## Scope Decisions

| Decision   | Options Considered | Chosen | Rationale | AR Ref |
| ---------- | ------------------ | ------ | --------- | ------ |
| Build full analyzer vs skeleton | full checker / passthrough | passthrough | Working compiler first (research strategy) | D1 |
| Empty model vs Pass-1 populate | empty / Pass-1 | empty | True passthrough; smallest honest surface | D2 |
| Passthrough diagnostics | none / sentinels | none | `hasErrors=false` always | D3 |
| `PlatformProfile` | core stub / optional | core stub | Honest R118 signature now | D4 |
| Primitive name | `"boolean"` / `'bool'` | `"boolean"` | Match frozen AST, no churn | D5 |
| `analyze()` signature | object / positional | object | Future-proof (mirrors RD-03 AR-8) | D6 |
| Type homes | core / frontend | core (data) + frontend (`analyze`) | Data-vs-logic split | D7 |
| Type utils | implement / stub | pure impl + policy stub | Pure facts safe; policy = checker | D10 |

> **Traceability:** Each row references the [Ambiguity Register](00-ambiguity-register.md).

## Acceptance Criteria

> Only **AC-01** of RD-04 is in scope as a *behavioral* criterion; the remainder are
> deferred (ledgered). The criteria below are this plan's gate.

1. [x] **AC-S1 (= RD-04 AC-01):** `analyze()` accepts a `ProgramNode[]` produced by `parse()`
   and returns a `SemanticModel` **without throwing**, including for programs that contain
   parser error-sentinels. The returned model has `hasErrors === false`, `mainFunction === null`,
   a non-null global `Scope`, and empty maps/collections. *(ST-S21..S26 green)*
2. [x] **AC-S2:** Every RD-04 §4 interface (`Type` + variants, `Scope`, `Symbol`, `CallGraph`,
   `ConstValue`, `PlatformProfile`, `SemanticModel`, `AnalyzeInput`) exists, is exported, and
   is constructible in a test. *(ST-S1, S13–S15, S25 green)*
3. [x] **AC-S3:** The pure structural type utilities return correct values for representative
   inputs (e.g. `isInteger(byte)===true`, `bitWidth(word)===16`, `byteSize(byte)===1`,
   `isError(ErrorType)===true`, `typeName(...)` human-readable). *(ST-S3..S9 + impl tests green)*
4. [x] **AC-S4:** `isAssignableTo`/`commonType` exist with documented placeholder behavior and
   `// DEFERRED` markers (no checker semantics asserted). *(ST-S10/S11 green)*
5. [x] **AC-S5:** The [Deferred Semantics Ledger](08-deferred-semantics-ledger.md) exists and
   covers **every** RD-04 requirement R1–R121 and AC-01..AC-20 with a status.
6. [x] **AC-S6:** `requirements/RD-04-semantic-analysis.md` carries the `SEMANTICS-DEFERRED`
   banner (D9).
7. [x] **AC-S7:** All verification passes (`yarn install --frozen-lockfile && yarn turbo run
   build typecheck lint && yarn test`); R15 boundary green; `git status --porcelain spec/` empty.
8. [x] **AC-S8:** No dead code — stub functions/params are either used or carry the documented
   `// DEFERRED` rationale (code.md rule 4 exception for planned seams).

