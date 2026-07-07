# Deferred Semantics Ledger: RD-04 Semantic Analysis

> **Document**: 08-deferred-semantics-ledger.md
> **Parent**: [Index](00-index.md)
> **Status**: AUTHORITATIVE — the single map of what the passthrough skeleton does NOT implement
> **Last Updated**: 2026-07-07 (RD-18 Slice 4b advancement annotated)

> **🟢 RD-18 Slice 4b (2026-07-07) advanced the `switch` subset of this ledger.** The
> `switch`/`case`/`default`/`fallthrough` sub-machine now ships end-to-end — see
> `codeops/features/blend65-ri/plans/rd-18-slice-4b-switch/` (26/26; closes RD-18 AC-3). **Rows
> advanced:** switch expression + case values R75 (**E10075** operand-type, **E10071** non-const case,
> **E10084** case-const range, **E10132** duplicate — `E10077` case-type-match registered + wired, emission
> deferred-reachable to Slice 7; AR-4/PF-002); `fallthrough` context R79 (**E10074** position, **E10073**
> no-effect warning; AR-3). **Still deferred:** exhaustive enum switch R76 (**E10133** → Slice 7 with enum
> types, AR-2); duplicate-`default` E10076 (unreachable at semantics — parser silently overwrites;
> deferred parser-owned, PF-001); out-of-switch `fallthrough` rejection (PF-003); jump-table dispatch
> (Phase B, AR-1); block-scope lifetime/shadowing R11 (E10101/E10062, a later cleanup slice, AR-14);
> `until` (AR-3); calls/recursion (Slice 5); mixed-width/casts (Slice 6); aggregates (Slice 7).

> **🟢 RD-18 Slice 4a (2026-07-07) advanced the conditional/loop subset of this ledger.** Control-flow
> semantics now ship for `if`/`else`/`while`/`do-while`/`for`(to/downto/step) — see
> `codeops/features/blend65-ri/plans/rd-18-slice-4a-conditionals-loops/`. **Rows advanced:** condition
> typing R71/R72/R73 (**E10134** `NonBooleanCondition`, AR-7 — supersedes the ledger's tentative
> E10080/AC-17); for-loop counter + bounds R74 (**E10064** end-bound range, **E10061** step positivity,
> **E10065** counter-type-integer, AR-8/AR-15); `break`/`continue` context R77/R78 (**E10130/E10131**,
> AC-12); all-paths-return (the R80 all-paths sub-clause, **E10102** `NotAllPathsReturn`, AR-4); body
> typing by recursion R82-in-control-flow; for-counter + nested-`let` locals collected flat into the
> function scope (R11 — real block-scope lifetime/shadowing E10101/E10062 still deferred to 4b, AR-2/AR-5/AR-9).
> **Still deferred:** `switch`/`fallthrough` + its validators (Slice 4b, AR-1); `until` (AR-3); calls/
> recursion R84-87/R86 (Slice 5); mixed-width promotion + casts (Slice 6); aggregates (Slice 7).

> **🟢 RD-18 Slice 3b (2026-07-06) advanced the scalar subset of this ledger.** The real Pass 3
> (expression/literal typing, name resolution, same-type/signedness enforcement, poison) + Pass 4
> (`main()` validity) now ship — see `codeops/features/blend65-ri/plans/rd-18-slice-3b-scalar-type-engine/`.
> **Rows advanced (scalar scope):** name resolution R14–R16/R61 (E10100); expression/assignment typing
> R30/R31→same-type, R32/R33→E10154/E10153 (assignment), R34→E10080, R36, R44–R49 (R49 mixed-sign
> arithmetic = **E10081**), R54 (literal range E10084); scope construction R7/R8 (module + function +
> body scopes, extended from Slice 3a); Pass 4 R66 (E10020/E10021 + `main` signature E10022); poison
> R114 (single-diagnostic cascade suppression); const-eval R63 (minimal — `lo`/`hi`, literal fold,
> div-by-zero E10082); void-return R80/R81 (E10173, minimal). **Still deferred:** control flow (Slice 4),
> calls/recursion R66-calls/R174 (Slice 5), mixed-width promotion + casts (Slice 6), aggregates R-struct/
> array/enum (Slice 7). Diagnostic codes reconciled to the canonical registry per **AR-11** (the earlier
> ledger codes E10082-for-narrowing etc. came from the stale frozen-spec §5.3 — see the plan's AR-11 table).
> The AC-coverage table below is updated; per-row status text is left as-was except where corrected.

## Purpose

This plan ships RD-04 as a **passthrough skeleton** ([AR D1](00-ambiguity-register.md)): all
interfaces and contracts exist, but `analyze()` performs **no** semantic checking. When the
team returns to build the **real semantic checker**, this ledger is the precise, traceable map
of *what is not yet implemented*, *which diagnostic code each deferred check emits*, and *which
RD-04 requirement and acceptance criterion it satisfies*.

**How to use this ledger to resume the checker:**
1. Each row is a unit of deferred work, keyed to RD-04 requirement(s) `Rxx`.
2. The "Pass" column says which of the four passes (§4.1) owns it — implement pass-by-pass.
3. The "Diagnostic code(s)" column lists the (already-registered) codes the check must emit.
4. In-code `// DEFERRED(RD-04-checker): Rxx` markers at the four pass seams
   (`packages/frontend/src/semantics/passes.ts`) and the two type-policy stubs
   (`packages/core/src/semantics/type-utils.ts`) point back here.

> **No new diagnostic codes are needed for most deferred work** — the entire E10xxx/W10xxx
> surface already exists in `packages/core/src/diagnostics/diagnostic-codes.ts` (added in
> RD-03/RD-11a). The one exception is the parked `fallthrough`-in-`default` question (see
> "Parked Open Questions"), which will likely need a brand-new code.

---

## Status legend

| Status | Meaning |
|--------|---------|
| ✅ IMPLEMENTED (interface) | The type/interface ships in this plan; no behavior. |
| ✅ IMPLEMENTED (passthrough) | A function ships and runs, but as a documented no-op / placeholder. |
| ✅ IMPLEMENTED (full) | Fully implemented in this plan (pure structural utilities only). |
| ⛔ DEFERRED (no behavior) | Not implemented; the future checker must build it. |

---

## 1. Architecture & passes (RD-04 §3.1)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R1 | Four-pass architecture | ✅ IMPLEMENTED (interface) — four named seam functions exist | — | — |
| R2 | Pass 1 — Declaration Collection | ⛔ DEFERRED | 1 | E10003 |
| R3 | Pass 2 — Type Resolution | ⛔ DEFERRED | 2 | E10151, E10142, E10143, E10163 |
| R4 | Pass 3 — Body Checking | ⛔ DEFERRED | 3 | (bulk — see §6–§14 below) |
| R5 | Pass 4 — Post-Check Validation | ⛔ DEFERRED | 4 | E10020, E10021, E10174, E10194, W10130, W10191 |
| R6 | Each pass completes for all files before next | ⛔ DEFERRED | all | — |

## 2. Scope model & symbol table (RD-04 §3.2)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R7 | Four-level scope tree | ✅ IMPLEMENTED (interface) — `ScopeKind`, `Scope`; **real per-module + function scope construction begun by RD-18 Slice 3a** (2026-07-05, `frontend/semantics/function-collection.ts`) — global→module→function levels; block scopes remain Slice 3b | 1 (build) | — |
| R8 | Each scope owns `Map<string,Symbol>` | ✅ IMPLEMENTED (interface); **module/function scopes now populated** with function + local-variable symbols by RD-18 Slice 3a | 1 | — |
| R9 | Duplicate decl in scope | ⛔ DEFERRED | 1 | E10003 |
| R10 | No shadowing | ⛔ DEFERRED | 1/3 | E10101 |
| R11 | For-loop counter block scope | 🟡 **RD-18 Slice 4a/4b** — counter + nested-`let` locals (incl. switch case/default bodies, 4b AR-12) collected FLAT into the function scope (AR-9); real block-scope lifetime/shadowing (E10101/E10062) deferred to a later cleanup slice (AR-14) | 3 | — |
| R12 | Module-level decls; no exec stmts | ⛔ DEFERRED | 1 | E10010 |
| R13 | Export visibility | ⛔ DEFERRED | 1 | — |

## 3. Name resolution (RD-04 §3.3)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R14 | Unified name resolver | ⛔ DEFERRED | 3 | — |
| R15 | Lookup order (innermost-first) | ⛔ DEFERRED | 3 | — |
| R16 | Undeclared identifier | ⛔ DEFERRED | 3 | E10100 |
| R17 | Qualified access `Module.name` | ⛔ DEFERRED | 3 | — |
| R18 | Enum member access `Enum.Member` | ⛔ DEFERRED | 3 | — |
| R19 | Intrinsic names reserved (shadowing) | ⛔ DEFERRED | 1/3 | E10101 |

## 4. Module resolution (RD-04 §3.4)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R20 | Module merging | ⛔ DEFERRED | 1 | E10003 |
| R21 | Circular imports allowed | ⛔ DEFERRED | 1 | — |
| R22 | Import validation (must be exported) | ⛔ DEFERRED | 1/3 | E10012 |
| R23 | Module initialization order | ⛔ DEFERRED | 4 | E10194 |

## 5. Type representation (RD-04 §3.5)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R24 | `Type` discriminated union | ✅ IMPLEMENTED (interface) | — | — |
| R25 | `PrimitiveType.name` | ✅ IMPLEMENTED (interface) — uses `"boolean"` (D5) | — | — |
| R26 | `ArrayType` | ✅ IMPLEMENTED (interface) | — | — |
| R27 | `StructType` (+ byteSize) | ✅ IMPLEMENTED (interface) — *byteSize is computed by the deferred Pass 2* | 2 (fill) | — |
| R28 | `EnumType` | ✅ IMPLEMENTED (interface) | 2 (fill) | — |
| R29 | `ErrorType` poison type | ✅ IMPLEMENTED (interface) — *propagation behavior deferred (R114)* | 3 | — |

## 6. Type checking rules (RD-04 §3.6)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R30 | No type inference (annotation required) | ⛔ DEFERRED | 3 | E10150 |
| R31 | Widening promotion (byte→word, sbyte→sword) | ⛔ DEFERRED — `commonType` stub | 3 | — |
| R32 | No implicit narrowing | ⛔ DEFERRED | 3 | E10154 |
| R33 | Mixed signedness error | ⛔ DEFERRED | 3 | E10153 |
| R34 | Bool not numeric | ⛔ DEFERRED | 3 | E10080 |
| R35 | Void is return-type only | ⛔ DEFERRED | 2/3 | E10151 / type error |
| R36 | Assignment compatibility | ⛔ DEFERRED — `isAssignableTo` stub | 3 | E10152 |
| R37 | Struct assignment (same type) | ⛔ DEFERRED | 3 | E10152 |
| R38 | No struct equality | ⛔ DEFERRED | 3 | E10080 |
| R39 | Enum↔byte cast required | ⛔ DEFERRED | 3 | E10152 |

## 7. Explicit cast rules (RD-04 §3.7)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R40 | `as` is the only explicit conversion | ⛔ DEFERRED | 3 | — |
| R41 | Allowed-cast list | ⛔ DEFERRED | 3 | — |
| R42 | Cast not in list | ⛔ DEFERRED | 3 | E10155 |
| R43 | void/struct/enum/array casts invalid | ⛔ DEFERRED | 3 | E10155 |

## 8. Expression typing (RD-04 §3.8)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R44 | Every expr node assigned a `Type` (`typeMap`) | ⛔ DEFERRED — `typeOf` returns `ERROR_TYPE` | 3 | — |
| R45 | Numeric literal typing | ⛔ DEFERRED | 3 | E10080 |
| R46 | Boolean literal → bool | ⛔ DEFERRED | 3 | — |
| R47 | Char literal → byte (encoding) | ⛔ DEFERRED — needs profile (D4/RD-10) | 3 | — |
| R48 | String literal → const byte[] | ⛔ DEFERRED | 3 | — |
| R49 | Arithmetic operators | ⛔ DEFERRED | 3 | E10080, E10081 |
| R50 | Comparison operators | ⛔ DEFERRED | 3 | E10080, E10081 |
| R51 | Logical operators | ⛔ DEFERRED | 3 | E10080 |
| R52 | Bitwise operators | ⛔ DEFERRED | 3 | E10081 |
| R53 | Shift operators | ⛔ DEFERRED | 3 | E10083 |
| R54 | Assignment operators (l-value, const) | ⛔ DEFERRED | 3 | E10191 |
| R55 | Conditional expression | ⛔ DEFERRED | 3 | E10080 |
| R56 | Field access | ⛔ DEFERRED | 3 | E10160 |
| R57 | Index expression | ⛔ DEFERRED | 3 | E10114, E10115 |
| R58 | Function call | ⛔ DEFERRED | 3 | E10170, E10171 |
| R59 | Intrinsic call | ⛔ DEFERRED — needs RD-17 descriptors | 3 | E10040, E10041 |
| R60 | `sizeof(T)` | ⛔ DEFERRED | 3 | — |
| R61 | Identifier expression | ⛔ DEFERRED | 3 | E10100 |
| R62 | Struct literal | ⛔ DEFERRED | 3 | E10161, E10162, E10152 |

## 9. Declaration validation (RD-04 §3.9)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R63 | `let` variable | ⛔ DEFERRED | 3 | E10150, E10152 |
| R64 | `const` constant | ⛔ DEFERRED | 3 | E10150, E10192, E10193, E10191 |
| R65 | Function declaration | ⛔ DEFERRED | 1/3 | E10003, E10175 |
| R66 | `main()` function | ⛔ DEFERRED | 4 | E10020, E10021, E10023 |
| R67 | Interrupt function | ⛔ DEFERRED | 3 | — |
| R68 | Struct declaration (+ no recursion) | ⛔ DEFERRED | 2 | E10003, E10163 |
| R69 | Enum declaration | ⛔ DEFERRED | 2 | E10003, E10140, E10141, E10142, E10143 |
| R70 | Struct passing by reference | ⛔ DEFERRED — `Symbol.byRef` exists, unset | 3 | — |

## 10. Statement validation (RD-04 §3.10)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R71 | If condition bool | ✅ **RD-18 Slice 4a** — `E10134` (AR-7; not E10080) | 3 | E10134 |
| R72 | While condition bool | ✅ **RD-18 Slice 4a** — `E10134` | 3 | E10134 |
| R73 | Do-while condition bool | ✅ **RD-18 Slice 4a** — `E10134` | 3 | E10134 |
| R74 | For-loop counter/bounds | ✅ **RD-18 Slice 4a** — end-bound `E10064`, step `E10061`, counter-type `E10065` (AR-8/AR-15) | 3 | E10064/E10061/E10065 |
| R75 | Switch expr + case values | ✅ **RD-18 Slice 4b** — operand-type `E10075`, non-const case `E10071`, case-const range `E10084`, duplicate `E10132`; `E10077` (case-type-match) registered/wired, emission deferred to Slice 7 (AR-4/PF-002) | 3 | E10075/E10071/E10084/E10132 (+E10077) |
| R76 | Exhaustive enum switch | ⛔ DEFERRED → Slice 7 (enum types, AR-2) | 3 | E10133 |
| R77 | `break` context | ✅ **RD-18 Slice 4a** — E10130 (loop-depth tracking); switch-transparent (RD-18 Slice 4b, AR-6) | 3 | E10130 |
| R78 | `continue` context | ✅ **RD-18 Slice 4a** — E10131 | 3 | E10131 |
| R79 | `fallthrough` context | ✅ **RD-18 Slice 4b** — position `E10074`, no-effect warning `E10073` (AR-3/AR-7; Parked-Q4 dissolved) | 3 | E10074/E10073 |
| R80 | return in non-void (+ all paths) | 🟡 **RD-18 Slice 4a** — all-paths-return `E10102` (AR-4, structural `definitelyReturns`); the value-type/missing-value sub-clauses (E10152/E10172) remain Slice 5/6 | 3 | E10102, E10152, E10172 |
| R81 | return in void | ⛔ DEFERRED | 3 | E10173 |
| R82 | Expression statement | ⛔ DEFERRED | 3 | — |
| R83 | `asm` block context | ⛔ DEFERRED — N/A (no asm in v3, RD-03 AR-1) | — | — |

## 11. Call-graph & recursion (RD-04 §3.11)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R84 | Record call edges | ⛔ DEFERRED — `CallGraph` interface exists | 3 | — |
| R85 | Call graph complete | ⛔ DEFERRED | 3 | — |
| R86 | Cycle detection | ⛔ DEFERRED — `findCycles()` returns `[]` | 4 | E10174 |
| R87 | Intrinsics not edges | ⛔ DEFERRED | 3 | — |

## 12. Const evaluator (RD-04 §3.12)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R88 | Const evaluator exists | ⛔ DEFERRED | 3 | — |
| R89 | Const-required contexts | ⛔ DEFERRED | 3 | E10110, E10193 |
| R90 | Const-evaluable grammar | ⛔ DEFERRED | 3 | — |
| R91 | Non-const in const context | ⛔ DEFERRED | 3 | E10193 |
| R92 | Division by zero (const) | ⛔ DEFERRED | 3 | E10082 |
| R93 | Integer overflow wrapping | ⛔ DEFERRED | 3 | — (defined behavior) |
| R94 | `ConstValue` result | ✅ IMPLEMENTED (interface) | 3 (fill) | — |

## 13. Intrinsic validation (RD-04 §3.13)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R95 | Core intrinsics ambient | ⛔ DEFERRED — needs RD-17 | 1/3 | — |
| R96 | Platform intrinsics need import | ⛔ DEFERRED — needs RD-10/RD-17 | 3 | — |
| R97 | Typed descriptors | ⛔ DEFERRED — RD-17 owns descriptors | 3 | — |
| R98 | Arg count mismatch | ⛔ DEFERRED | 3 | E10040, E10041 |
| R99 | Unavailable intrinsic | ⛔ DEFERRED — code defined in RD-17 | 3 | (RD-17) |
| R100 | Intrinsic name not user-declarable | ⛔ DEFERRED | 1 | E10101 |

## 14. Array & data-inclusion validation (RD-04 §3.14)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R101 | Array size const ≥ 1 | ⛔ DEFERRED | 3 | E10110, E10111, E10112 |
| R102 | Array initializer match | ⛔ DEFERRED | 3 | — |
| R103 | Const array fully initialized | ⛔ DEFERRED | 3 | E10113 |
| R104 | Array index type | ⛔ DEFERRED | 3 | E10114 |
| R105 | Static bounds checking | ⛔ DEFERRED | 3 | E10115 |
| R106 | `embed()` const context | ⛔ DEFERRED | 3 | E10200 |
| R107 | `embed()` file resolution | ⛔ DEFERRED — see Parked Q2 | 3 | E10201 |
| R108 | `embed()` size | ⛔ DEFERRED | 3 | E10202 |

## 15. Warnings (RD-04 §3.15)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R109 | Unused variable | ⛔ DEFERRED | 4 | W10191 |
| R110 | Unreachable code | ⛔ DEFERRED | 4 | W10130 |
| R111 | Use before initialization | ⛔ DEFERRED | 4 | W10190 |
| R112 | Warnings via severity policy | ⛔ DEFERRED — RD-11 severity layer | 4 | — |

## 16. Error tolerance (RD-04 §3.16)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R113 | Never throws | ✅ IMPLEMENTED (passthrough) — trivially true (no-op) | all | — |
| R114 | Poison-type propagation | ⛔ DEFERRED — `ErrorType` exists; propagation deferred | 3 | — |
| R115 | Error symbols | ⛔ DEFERRED | 3 | E10100 |
| R116 | Deterministic output | ⛔ DEFERRED — trivially true now (no output); golden-locked with checker | all | — |
| R117 | Max-errors threshold | ⛔ DEFERRED — `DiagnosticBag` supports it; analyzer never emits | all | — |

## 17. Public API (RD-04 §3.17)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R118 | `analyze()` entry point | ✅ IMPLEMENTED (passthrough) — object signature (D6) | — | — |
| R119 | `ProgramNode[]` input | ✅ IMPLEMENTED (passthrough) | — | — |
| R120 | `PlatformProfile` param | ✅ IMPLEMENTED (interface) — stub (D4); accepted, unused | — | — |
| R121 | `SemanticModel` output | ✅ IMPLEMENTED (passthrough) — empty model (D2) | — | — |

---

## Acceptance-criteria coverage (RD-04 §6)

| AC | Criterion (abbrev.) | Status |
|----|---------------------|--------|
| AC-01 | `analyze()` accepts AST, returns model, never throws | ✅ IMPLEMENTED (this plan, AC-S1) |
| AC-02 | gate program → `hasErrors=false` + resolved `main` + poke typing | ✅ **RD-18 Slice 3b** (scalar) — `main` resolved + `typeMap` populated; gate/slice3a clean |
| AC-03 | undeclared identifier → E10100 | ✅ **RD-18 Slice 3b** (ST-6) |
| AC-04 | word→byte without cast → E10154 | ✅ **RD-18 Slice 3b** (ST-8 narrowing; code correct) |
| AC-05 | ~~byte + sbyte → E10153~~ **CORRECTED (PF-004/AR-11):** mixed-sign **arithmetic operands** `byte + sbyte` → **E10081** (ledger R49; the fixture/AC-4 headline); **E10153** is the *assignment* cross-sign case (R33). | ✅ **RD-18 Slice 3b** (arithmetic E10081 = ST-4; assignment E10153 = ST-8). *Original "byte + sbyte → E10153" wording was wrong — not ticked as-worded.* |
| AC-06 | `let x: bool = 5` → E10152 | ✅ **RD-18 Slice 3b** (boolean↔integer assignment; impl-tested) |
| AC-07 | indirect recursion → E10174 (both) | ⛔ DEFERRED (calls → Slice 5) |
| AC-08 | no/two `main()` → E10020/E10021 | ✅ **RD-18 Slice 3b** (ST-10; Pass 4 `post-check.ts`) |
| AC-09 | non-const const initializer → E10193 | ⛔ DEFERRED |
| AC-10 | struct literal missing/extra field → E10161/E10162 | ⛔ DEFERRED |
| AC-11 | enum dup/over-256 → E10142/E10141 | ⛔ DEFERRED |
| AC-12 | break/continue context → E10130/E10131 | ✅ **RD-18 Slice 4a** (loop-depth tracking; ST-4) |
| AC-13 | poison-type cascade suppression (one diagnostic) | ✅ **RD-18 Slice 3b** (ST-9; R114) |
| AC-14 | `typeMap` correctness | ✅ **RD-18 Slice 3b** (scalar subset: literals/idents/same-type binary — ST-1/ST-3; aggregates → Slice 7) |
| AC-15 | `callGraph` + `findCycles()` correctness | ⛔ DEFERRED |
| AC-16 | module-init cycle → E10194 | ⛔ DEFERRED |
| AC-17 | non-bool if condition → ~~E10080~~ **E10134** (AR-7) | ✅ **RD-18 Slice 4a** (ST-1/2/3; the boolean-condition check uses the new control-flow code E10134, not E10080) |
| AC-18 | golden-snapshot determinism | ⛔ DEFERRED |
| AC-19 | `sizeof(StructType)` value | ⛔ DEFERRED |
| AC-20 | array size 0 / non-const → E10111/E10110 | ⛔ DEFERRED |

---

## Parked Open Questions (RD-04 §7 — resolve with the user when the checker is planned)

> These are **checker** behaviors. None affect the passthrough skeleton. They must be resolved
> (Zero-Ambiguity Gate) at the start of the future semantic-checker plan.

1. **Recursive-struct detection depth** — detect indirect recursion (A→B→A) to arbitrary depth
   via cycle detection on the struct-field type graph (Pass 2)? RD-04 recommends *arbitrary
   depth*. **Parked.**
2. **`embed()` path resolution** — source-file-relative only, or source-file-relative **then**
   project-root fallback? RD-04 recommends the fallback. **Parked.** (Emits E10201 on failure.)
3. **For-loop counter shadowing** — a counter sharing a module-var name is an error per R10. Is
   that the desired developer experience? RD-04 flags it as possibly surprising. **Parked.**
4. **`fallthrough` in a `default` clause** — R79 makes it valid only in non-default cases. A
   `fallthrough` in `default` should be an error, but **no diagnostic code exists in Ch 14** for
   it. A **new code** (e.g. `E10134`) will be needed — added to the registry **at that time**,
   honoring the Language Guard + one-registry rule. **Parked.**

---

## Resuming the checker — suggested order

1. **Plan** a new RD (e.g. `RD-04b-semantic-checker`) via `make_plan`; resolve the four parked
   questions first.
2. Implement **Pass 1** (R2/R7–R13/R20–R22/R65/R100): scope tree + symbol table + module
   merging + duplicate/shadow detection. Unlocks E10003/E10010/E10101.
3. Implement **Pass 2** (R3/R27–R28/R68–R69): type resolution, struct sizing, enum values,
   recursive-struct detection. Unlocks E10142/E10143/E10151/E10163 + fills `structTypes`/`enumTypes`.
4. Implement **Pass 3** (R4 + §3.6–§3.14): the type checker, const evaluator, intrinsic
   validation (needs RD-17), call-graph construction, name resolution. The bulk of the codes.
5. Implement **Pass 4** (R5/R23/R66/R86/R109–R111): `main()` validation, recursion detection,
   module-init order, warnings.
6. Replace the type-policy stubs (`isAssignableTo`, `commonType`) with the real R31/R36 logic.
7. Flip the passthrough query helpers (`typeOf`/`symbolOf`/`scopeOf`) to read real maps.
8. Add golden-snapshot determinism tests (R116/AC-18) and re-tick AC-02..AC-20 here.
