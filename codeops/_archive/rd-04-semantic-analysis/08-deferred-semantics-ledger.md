# Deferred Semantics Ledger: RD-04 Semantic Analysis

> **Document**: 08-deferred-semantics-ledger.md
> **Parent**: [Index](00-index.md)
> **Status**: AUTHORITATIVE — the single map of what the passthrough skeleton does NOT implement
> **Last Updated**: 2026-07-11 (RD-18 Slice 6 advancement annotated)

> **🟢 RD-18 Slice 6 (2026-07-11) advanced the expression-system subset of this ledger.** The
> full operator matrix, TS-4 mixed-width promotion, casts, the conditional operator, compound
> assignment, and the short-circuit guarantee now ship end-to-end (typing → width-aware
> const-eval → synthetic-slot CFG lowering → all four comparison framings in codegen →
> VICE-verified) — see `codeops/features/blend65-ri/plans/rd-18-slice-6-expressions/` (closes
> RD-18 AC-5). **Rows advanced:** R31 widening promotion (ONE `isAssignableTo`/`commonType`
> rule — byte→word / sbyte→sword implicit everywhere assignment compatibility applies,
> arguments/returns included, superseding 5a's strict-arg interim); R32 narrowing → **E10154**
> and R33 cross-sign → **E10153** under the real (non-interim) rule; R41/R42/R43 casts (the
> shipped surface is the prefix `<type>(expr)` form — integer↔integer allowed incl. same-width
> reinterpretation, boolean↔integer → **E10086**, void/struct/array → **E10155**; enum casts
> stay deferred to Slice 7; R40's `as`-form is recorded spec drift — `as` is not in the frozen
> keyword table); R49 completed beyond the 3b same-type subset (promotion in; boolean → E10080,
> mixed-sign → E10081); R50 comparisons (boolean result, promotion, `boolean` equality-only —
> ordered boolean → **E10080**; byte/word × unsigned/signed framings in codegen, fixing the
> latent word-compare low-bytes-only defect); R51 logical `&&`/`||` (boolean operands →
> **E10080**; the short-circuit GUARANTEE lowered as CFG diamonds over synthetic SFA slots —
> VICE-witnessed suppression); R52 bitwise (integer operands; width-aware const folds); R53
> shifts (result = left type; signed amount → **E10083**; const amount ≥ width → **W10174**;
> word + variable-count codegen); R54 completed with TS-17 compound assignment (expanded-form
> class semantics, write-back narrowing → E10154, const target → E10191); R55 the conditional
> operator (**E10134** non-boolean condition, **E10088** arm mismatch, context-typed arms,
> selected-arm-only evaluation via the diamond CFG). New advisories: **W10160/W10161**
> (intermediate overflow, TS-9) at init/assign/arg/return sites and **W10101** (narrowing cast
> truncates a constant). Unary `- ! ~` live (negate-unsigned → **E10087**); signed `/`/`%` is a
> loud lowering rejection (unsigned runtime routines only); `&` address-of stays deferred
> (Slice 8).
>
> **🟢 RD-18 Slice 5b (2026-07-11) advanced the module-system subset of this ledger.** Module
> merging, qualified access, call-free module-variable initializers with per-variable init order,
> and scalar const completion now ship end-to-end — see
> `codeops/features/blend65-ri/plans/rd-18-slice-5b-module-system/` (closes RD-18 AC-4). **Rows
> advanced:** qualified access R17 (value-first `resolveQualified` ladder — unknown head
> **E10100**, missing/non-exported member **E10012** even from inside the module; qualified
> calls/reads/writes feed the SAME call-graph/SFA machinery as bare names; a function member in
> value/write position → explicit unsupported ICE until Slice 8 `&fn`); module merging R20
> (name-keyed shared scopes — one scope per module name, the first file's ModuleDecl is the
> representative node; cross-file duplicate top-level name → **E10003**, including duplicate
> FUNCTIONS — a guard that did not previously exist; the 5a dup-module ICE removed); circular
> imports R21 (legal — cycle-tolerant module ordering); module init order R23 (ONE global
> per-variable graph — imports alias the same `Symbol` so cross-module/qualified reads land
> automatically; consts fold and initializer-less vars are non-edges; two-level order =
> import-edge Kahn with discovery tiebreak, then stable per-variable topo by (module order,
> declaring-scope ordinal); ONE **E10194** per dependency cycle with the spec message + full
> path; `SemanticModel.initOrder` populated and lowered to a generated `__init` stream the
> startup shim calls after banking, before `_main`); R64 scalar-const subset (module consts
> evaluated at compile time, declaration-order independent per VAR-6; non-const initializer →
> **E10193**; const-const definition cycle → ONE **E10194**; values inlined at use sites — a
> module const owns NO storage symbol; **E10192 recorded parser-owned** — `ConstDeclNode.
> initialiser` is non-null by AST shape, no semantic emission site); module-`let` initializers
> typed with local-`let` parity (**E10152/E10153/E10154** + **E10084/E10082**); R13 export
> visibility extended to variables/consts through the import + qualified surfaces.
>
> **Deviations & named deferrals recorded by 5b:** (1) the **E10194 message appends the full
> cycle path** (`— cycle: a → b → a`) beyond the spec's single-name message — the E10174
> precedent; ONE error per cycle anchored at the first-declared member (RD-04 §4.9's
> per-symbol-in-cycle emission is superseded by that precedent). (2) **Intra-import-cycle module
> order falls back to discovery order** — circular imports are legal (R21) and frozen Ch 10 §5.4
> defines no order inside an import cycle; recorded as the slice's one genuine spec gap. (3) The
> startup deviation recorded by 5a stands, with the spec letter pinned: **Ch 10 §5.3 prescribes
> fall-through into `main`**, the shipped shim uses `JSR _main` (scoped deviation; fall-through
> arrives with the non-terminating work) — `JSR __init` was added to that same shim, after
> banking so initializers run in `main`'s memory configuration. (4) **Named deferrals:**
> call-bearing module initializers → loud unsupported ICE (calls hide reads from the dependency
> analysis; revisit when a slice needs them); qualified function references (`Math.fn` as a
> value or write target) → loud unsupported ICE (Slice 8, `&fn`); `--startup bare` never calls
> `__init` — the user owns the entire entry sequence (documented in the shim + build API; no
> diagnostic); **W10190** use-before-initialization stays unregistered (initializer-less
> variables are legal non-edges, R111).
> **Still deferred:** mixed-width promotion + casts (Slice 6); aggregates (Slice 7).

> **🟢 RD-18 Slice 5a (2026-07-10) advanced the function-call subset of this ledger.** User
> functions, parameters, calls, returns, recursion rejection, and minimal cross-module imports now
> ship end-to-end — see `codeops/features/blend65-ri/plans/rd-18-slice-5a-functions-calls/` (46/46;
> RD-18 AC-4 partial — closes at 5b). **Rows advanced:** call typing R58 (**E10170** count,
> **E10171** strict same-type args, callee ladder **E10100→E10051→E10023→E10175**); function
> declaration R65 (partial — parameter collection, duplicate param **E10003**; **NO parameter-count
> limit** — R65's "max 8 (E10175)" is **spec-refuted by FN-11**, see the deviation note below);
> `main()` R66 completed (**E10023** calling-main wired at the call site); return completion R80
> (**E10172** bare-return-in-non-void; mismatch via the assignment family **E10152/E10153/E10154**
> with return-context wording — promotion at return remains Slice 6) + R81 (✅ — E10173 + bare
> `return;` early exit); call graph R84/R85 (Pass-3 edge recording, enclosing function derived from
> the scope chain), cycle detection R86 (iterative Tarjan `findCallCycles`, **ONE E10174 per cycle**
> anchored at the first-declared member with the full path — pre-SFA poison: the driver gates
> `planAllocation` on `hasErrors`), intrinsics-not-edges R87 (`IntrinsicCallExpr` structurally
> excluded; platform T4 names left to the import boundary); shadowing R10 (partial — FN-13
> param-vs-module-level **E10101**; general shadowing stays deferred); export visibility R13 +
> import validation R22 (function subset — **E10012** missing/non-exported, imports alias the same
> `Symbol` so FQNs survive).
>
> **Deviations & named deferrals recorded by 5a:** (1) registry **E10175 renamed
> `TooManyParameters`→`NotCallable`** — the frozen Ch 06 §10 table assigns E10175 exactly the
> not-callable meaning and FN-11 says parameter counts are unlimited; the constant had zero emit
> sites. NOTE the spec is *internally inconsistent* here: the canonical Ch 14 registry (which Ch 06
> §10 itself declares canonical) still lists E10175 = TooManyParameters (max 8), a row FN-11
> refutes — the code registry follows Ch 06 §10 and diverges from Ch 14 until a spec-errata pass.
> (2) The Ch 06 §10 **E1017x chapter-table numbering drift** (chapter: E10171=count, E10172=arg
> type, E10174=missing return; registry: E10170=count, E10171=arg type, E10172=missing return,
> E10174=recursion) — registry names are authoritative, recorded once here. (3) **Startup shim stays
> `JSR _main`** for the terminating variant (scoped deviation — the spec's fall-through rationale
> targets a never-returning `main`; fall-through is Slice 8's non-terminating variant). (4) **Named
> deferrals:** same-callee-in-later-argument shapes → explicit lowering ICE (caller-frame scratch
> slots are the general fix, a later slice); a value live across a user call in one expression
> (`f() + g()`) → explicit translate ICE (same fix); import aliasing `import { X as Y }` (not
> lexed; revisit when a fixture needs a cross-module rename); W10181 unused-function stays
> unregistered (needs export/address-taken liveness, Slice 8+); duplicate module name across files →
> explicit unsupported ICE until 5b module merging (R20) lands — never a wrong E10012.
> **Still deferred:** module merging R20 / qualified access R17 / init order R23+E10194 (Slice 5b);
> mixed-width promotion + casts (Slice 6); aggregates (Slice 7).

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
| R10 | No shadowing | 🟡 **RD-18 Slice 5a** — FN-13 parameter-vs-module-level shadowing → `E10101` (`checkParameterShadowing`, runs after module vars + imports exist); general shadowing (locals, block scopes) still deferred | 1/3 | E10101 |
| R11 | For-loop counter block scope | 🟡 **RD-18 Slice 4a/4b** — counter + nested-`let` locals (incl. switch case/default bodies, 4b AR-12) collected FLAT into the function scope (AR-9); real block-scope lifetime/shadowing (E10101/E10062) deferred to a later cleanup slice (AR-14) | 3 | — |
| R12 | Module-level decls; no exec stmts | ⛔ DEFERRED | 1 | E10010 |
| R13 | Export visibility | 🟡 **RD-18 Slice 5a + 5b** — function AND variable/const `exported` flags honored by import resolution and qualified access (exported-only, even self-module); type visibility across modules with aggregates | 1 | — |

## 3. Name resolution (RD-04 §3.3)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R14 | Unified name resolver | ⛔ DEFERRED | 3 | — |
| R15 | Lookup order (innermost-first) | ⛔ DEFERRED | 3 | — |
| R16 | Undeclared identifier | ⛔ DEFERRED | 3 | E10100 |
| R17 | Qualified access `Module.name` | ✅ **RD-18 Slice 5b** — value-first `resolveQualified` (a value symbol shadowing the head wins); unknown head → E10100, missing/non-exported member → E10012; calls/reads/writes share the bare-name ladder + call-graph/SFA machinery; function member as value → unsupported ICE (Slice 8 `&fn`) | 3 | E10100, E10012 |
| R18 | Enum member access `Enum.Member` | ✅ **RD-18 Slice 7a** — enum-type heads classify in the field-access ladder; members fold to their backing byte (E10160 unknown member); qualified `Mod.Enum.Member` chains resolve | 3 | E10160 |
| R19 | Intrinsic names reserved (shadowing) | ⛔ DEFERRED | 1/3 | E10101 |

## 4. Module resolution (RD-04 §3.4)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R20 | Module merging | ✅ **RD-18 Slice 5b** — name-keyed shared module scopes (one scope per module name); cross-file duplicate top-level names → E10003 (incl. a NEW duplicate-function guard); the 5a dup-module ICE removed | 1 | E10003 |
| R21 | Circular imports allowed | ✅ **RD-18 Slice 5b** — legal; init-order module sequencing is cycle-tolerant (discovery-order fallback inside a cycle — recorded spec gap) | 1 | — |
| R22 | Import validation (must be exported) | ✅ **RD-18 Slice 5a** (function subset) — missing or non-exported name → `E10012`; a resolved import aliases the SAME `Symbol` (FQN preserved); duplicate import → `E10003` | 1/3 | E10012 |
| R23 | Module initialization order | ✅ **RD-18 Slice 5b** — per-variable dependency order (imported modules first, then declaration order; initializer reads = edges); ONE E10194 per cycle with the full path; lowered to the `__init` stream run before `main` | 4 | E10194 |

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
| R31 | Widening promotion (byte→word, sbyte→sword) | ✅ **RD-18 Slice 6** — TS-4 promotion in `commonType` + implicit same-sign widening in `isAssignableTo` (ONE rule: assignments/initialisers/arguments/returns) | 3 | — |
| R32 | No implicit narrowing | ✅ **RD-18 Slice 6** — narrowing rejected under the real widening rule (explicit cast required) | 3 | E10154 |
| R33 | Mixed signedness error | ✅ **RD-18 Slice 6** — cross-sign assignment E10153; cross-sign operands E10081 (live since 3b, kept under the widening rule) | 3 | E10153 |
| R34 | Bool not numeric | ⛔ DEFERRED | 3 | E10080 |
| R35 | Void is return-type only | ✅ **RD-18 Slice 7a** — `void` rejected in variable/field/element positions (E10156, additive mint) | 2/3 | E10156 |
| R36 | Assignment compatibility | ⛔ DEFERRED — `isAssignableTo` stub | 3 | E10152 |
| R37 | Struct assignment (same type) | ✅ **RD-18 Slice 7a** — nominal same-struct assignment is an unrolled per-byte COPY (literals initialise per field); different struct → E10152 | 3 | E10152 |
| R38 | No struct equality | ✅ **RD-18 Slice 7a** — struct comparison rejected E10080 | 3 | E10080 |
| R39 | Enum↔byte cast required | ⛔ DEFERRED | 3 | E10152 |

## 7. Explicit cast rules (RD-04 §3.7)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R40 | `as` is the only explicit conversion | ⚠️ **SPEC DRIFT (RD-18 Slice 6)** — the shipped cast surface is the parser's prefix `<type>(expr)` form; `as` is not in the frozen keyword table (errata-pass item) | 3 | — |
| R41 | Allowed-cast list | ✅ **RD-18 Slice 6** — integer↔integer (all pairs incl. same-width reinterpret); enum casts deferred to Slice 7 | 3 | — |
| R42 | Cast not in list | ✅ **RD-18 Slice 6** — boolean↔integer → E10086; void/struct/array → E10155 | 3 | E10086, E10155 |
| R43 | void/struct/enum/array casts invalid | ✅ **RD-18 Slice 6** — void/struct/array → E10155 (enum cast legality is the Slice-7 exception) | 3 | E10155 |

## 8. Expression typing (RD-04 §3.8)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R44 | Every expr node assigned a `Type` (`typeMap`) | ⛔ DEFERRED — `typeOf` returns `ERROR_TYPE` | 3 | — |
| R45 | Numeric literal typing | ⛔ DEFERRED | 3 | E10080 |
| R46 | Boolean literal → bool | ⛔ DEFERRED | 3 | — |
| R47 | Char literal → byte (encoding) | ⛔ DEFERRED — needs profile (D4/RD-10) | 3 | — |
| R48 | String literal → const byte[] | ⛔ DEFERRED | 3 | — |
| R49 | Arithmetic operators | ✅ **RD-18 Slice 6** — completed beyond the 3b same-type subset: TS-4 promotion in; boolean → E10080; mixed-sign → E10081; signed `/`/`%` = loud lowering rejection | 3 | E10080, E10081 |
| R50 | Comparison operators | ✅ **RD-18 Slice 6** — boolean result (TS-7), promotion, boolean equality-only (ordered boolean → E10080); all four byte/word × unsigned/signed codegen framings | 3 | E10080, E10081 |
| R51 | Logical operators | ✅ **RD-18 Slice 6** — boolean operands; the short-circuit GUARANTEE lowered as CFG diamonds over synthetic frame slots (VICE-witnessed) | 3 | E10080 |
| R52 | Bitwise operators | ✅ **RD-18 Slice 6** — integer operands (boolean → E10080); width-aware const folds | 3 | E10080, E10081 |
| R53 | Shift operators | ✅ **RD-18 Slice 6** — result = left type; unsigned amount required (E10083); const amount ≥ width → W10174; word + variable-count + arithmetic-shr codegen | 3 | E10083 |
| R54 | Assignment operators (l-value, const) | ✅ **RD-18 Slice 6** — completed with TS-17 compound assignment (expanded-form class semantics; write-back narrowing → E10154; const target → E10191) | 3 | E10191 |
| R55 | Conditional expression | ✅ **RD-18 Slice 6** — E10134 non-boolean condition; E10088 arm mismatch; context-typed arms; selected-arm-only via the diamond CFG | 3 | E10088, E10134 |
| R56 | Field access | ✅ **RD-18 Slice 7a** — struct-field typing/lowering (offset locations), nested chains, typeMap-complete | 3 | E10160 |
| R57 | Index expression | ✅ **RD-18 Slice 7a+7b (complete)** — direct tier: const indexes fold to static offsets, runtime byte indexes ride `abs,X`; pointer tier (7b): >256-byte arrays take word indexes through `(zp),Y` runtime pointer formation, unsized params take both widths; E10114 signed/boolean, E10117 word-on-tier-1, E10118 byte-on-tier-2 (now emittable), E10115 static bounds (sized forms) | 3 | E10114, E10115, E10117, E10118 |
| R58 | Function call | ✅ **RD-18 Slice 5a** — `typeCall` ladder `E10100`→`E10051`(interrupt)→`E10023`(main)→`E10175`(not callable); count `E10170` (suppresses per-arg checks); strict same-type args `E10171` + const range `E10084`; result = declared return type | 3 | E10170, E10171 |
| R59 | Intrinsic call | ⛔ DEFERRED — needs RD-17 descriptors | 3 | E10040, E10041 |
| R60 | `sizeof(T)` | ✅ **RD-18 Slice 7a** — `sizeof`/`offsetof`/`length` fold through the const/type engine (value-dependent result typing: ≤255 byte, ≥256 word); legal in const/size positions | 3 | — |
| R61 | Identifier expression | ⛔ DEFERRED | 3 | E10100 |
| R62 | Struct literal | ✅ **RD-18 Slice 7a** — all fields present (E10161), no extras (E10162), declaration order (E10097 — the chapter's own number), field values assignable (E10152); nested literals recurse | 3 | E10161, E10162, E10097, E10152 |

## 9. Declaration validation (RD-04 §3.9)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R63 | `let` variable | ⛔ DEFERRED | 3 | E10150, E10152 |
| R64 | `const` constant | ✅ **RD-18 Slice 5b (scalars) + 7a (aggregates)** — scalars evaluate + inline (VAR-6, E10193/E10191; E10192 parser-owned); aggregate consts fold into little-endian memory IMAGES baked in-image under `__data_<Module>_<name>` labels (E10113 coverage, E10084 element range); element/field writes through a const root are E10191 | 3 | E10150, E10192, E10193, E10191, E10113 |
| R65 | Function declaration | 🟡 **RD-18 Slice 5a** — parameters collected as `parameter` symbols (params before locals), duplicate → `E10003`; **no parameter-count limit** (R65's "max 8 → E10175" is spec-refuted by FN-11; E10175 renamed `NotCallable`, see the 5a banner); nested-function rejection stays parser-owned | 1/3 | E10003 |
| R66 | `main()` function | ✅ **RD-18 Slice 3b + 5a** — validity `E10020`/`E10021`/`E10022` (3b, Pass 4); calling `main` directly → `E10023` at the call site (5a) | 4 | E10020, E10021, E10023 |
| R67 | Interrupt function | ⛔ DEFERRED | 3 | — |
| R68 | Struct declaration (+ no recursion) | ✅ **RD-18 Slice 7a** — module-keyed FQN tables (the bare-name collision defect fixed), duplicate fields E10003, recursive layouts ONE path-carrying E10165 per cycle (the silent zero-size placeholder removed) | 2 | E10003, E10165 |
| R69 | Enum declaration | ✅ **RD-18 Slice 7a** — member values via the engine (consts legal), E10230 non-const, E10143 range/auto-overflow, duplicate names E10003; duplicate VALUES legal per EN-5 (E10142/E10141 stay registered-unwired, chapters-beat-registry) | 2 | E10003, E10143, E10230 |
| R70 | Struct passing by reference | ✅ **RD-18 Slice 7b** — FN-3 end-to-end: `Symbol.byRef` set at finalization; caller stores the address into the callee's 2-byte frame home; SFA colors per-param `__zp_ptr_*` pairs; one-time prologue frame→pair copy; accesses `(pair),Y`; dead/pass-through params skip the pair; const params CP-1..5 (E10122/E10123); W10112 aliasing advisory | 3 | E10122, E10123, W10112 |

## 10. Statement validation (RD-04 §3.10)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R71 | If condition bool | ✅ **RD-18 Slice 4a** — `E10134` (AR-7; not E10080) | 3 | E10134 |
| R72 | While condition bool | ✅ **RD-18 Slice 4a** — `E10134` | 3 | E10134 |
| R73 | Do-while condition bool | ✅ **RD-18 Slice 4a** — `E10134` | 3 | E10134 |
| R74 | For-loop counter/bounds | ✅ **RD-18 Slice 4a** — end-bound `E10064`, step `E10061`, counter-type `E10065` (AR-8/AR-15) | 3 | E10064/E10061/E10065 |
| R75 | Switch expr + case values | ✅ **RD-18 Slice 4b** — operand-type `E10075`, non-const case `E10071`, case-const range `E10084`, duplicate `E10132`; `E10077` (case-type-match) registered/wired, emission deferred to Slice 7 (AR-4/PF-002) | 3 | E10075/E10071/E10084/E10132 (+E10077) |
| R76 | Exhaustive enum switch | ✅ **RD-18 Slice 7a (resolved: NO enforcement)** — Ch 09 §8 mandates no exhaustiveness; enum discriminants dispatch, case values must be members of THAT enum (E10077 first live emission); E10133 stays registered-unwired | 3 | E10077 (E10133 unwired) |
| R77 | `break` context | ✅ **RD-18 Slice 4a** — E10130 (loop-depth tracking); switch-transparent (RD-18 Slice 4b, AR-6) | 3 | E10130 |
| R78 | `continue` context | ✅ **RD-18 Slice 4a** — E10131 | 3 | E10131 |
| R79 | `fallthrough` context | ✅ **RD-18 Slice 4b** — position `E10074`, no-effect warning `E10073` (AR-3/AR-7; Parked-Q4 dissolved) | 3 | E10074/E10073 |
| R80 | return in non-void (+ all paths) | ✅ **RD-18 Slice 4a + 5a** — all-paths `E10102` (4a); bare `return;` → `E10172` and value mismatch via the assignment family `E10152/E10153/E10154` with return-context wording (5a); promotion at return arrives with Slice 6 | 3 | E10102, E10152, E10172 |
| R81 | return in void | ✅ **RD-18 Slice 5a** — `return expr;` in void → `E10173`; bare `return;` is a valid early exit | 3 | E10173 |
| R82 | Expression statement | ⛔ DEFERRED | 3 | — |
| R83 | `asm` block context | ⛔ DEFERRED — N/A (no asm in v3, RD-03 AR-1) | — | — |

## 11. Call-graph & recursion (RD-04 §3.11)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R84 | Record call edges | ✅ **RD-18 Slice 5a** — Pass-3 edge recording at every resolved user call (caller derived from the scope chain; first call-site span kept per edge) | 3 | — |
| R85 | Call graph complete | ✅ **RD-18 Slice 5a** — complete over user calls incl. cross-module imported callees; projected to SFA `callees` (sorted FQNs) | 3 | — |
| R86 | Cycle detection | ✅ **RD-18 Slice 5a** — iterative Tarjan `findCallCycles` (core `call-graph.ts`); ONE `E10174` per cycle, anchored first-declared, message carries the full path (`ping → pong → ping`); poisons before `planAllocation` (driver gate) | 4 | E10174 |
| R87 | Intrinsics not edges | ✅ **RD-18 Slice 5a** — `IntrinsicCallExpr` never reaches `typeCall` (structural); platform T4 names are registry-recognized and left to the import boundary | 3 | — |

## 12. Const evaluator (RD-04 §3.12)

| RD-04 | Requirement | Status | Pass | Diagnostic code(s) |
|-------|-------------|--------|------|--------------------|
| R88 | Const evaluator exists | ✅ **RD-18 Slice 7a** — the unified lazy memoised const/type engine (constants ⇄ struct layouts ⇄ enum values), linear work, ONE path-carrying diagnostic per cycle | 3 | — |
| R89 | Const-required contexts | ✅ **RD-18 Slice 7a** — array sizes, const initialisers, enum member values, case labels all evaluate through the engine | 3 | E10110, E10193 |
| R90 | Const-evaluable grammar | ✅ **RD-18 Slice 7a** — arithmetic/bitwise/shift/compare/ternary/casts (Slice 6) + refs, enum members, and the query intrinsics (engine folder seam) | 3 | — |
| R91 | Non-const in const context | ✅ **RD-18 Slice 7a** — E10193 at the offending element/initialiser; poisoned refs stay silent (one root cause) | 3 | E10193 |
| R92 | Division by zero (const) | ✅ **RD-18 Slice 5b/7a** — E10082 through the shared range/div-zero check | 3 | E10082 |
| R93 | Integer overflow wrapping | ✅ **RD-18 Slice 6/7a** — two's-complement width-aware folds (`toBits`/`fromBits`); images encode wrapped little-endian bytes | 3 | — (defined behavior) |
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
| R101 | Array size const ≥ 1 | ✅ **RD-18 Slice 7a+7b (complete)** — const-expression sizes via the engine; E10110 non-const, E10111 zero; 7b retired the >256-byte rejection (tier-2 legal, W10142/W10143 advisories) and added the narrowed unsized-declaration inference (element-list literals; E10126 otherwise); E10112 remains unwired (count>size stays on the E10152 reuse) | 3 | E10110, E10111, E10126, W10142, W10143 |
| R102 | Array initializer match | ✅ **RD-18 Slice 7a** — contextual literal typing: element/fill assignability, count>size mismatch, W10140 partial, E10113 const coverage, E10126 fill-needs-size, unsized-size inference | 3 | E10113, E10126, W10140 |
| R103 | Const array fully initialized | ✅ **RD-18 Slice 7a** — image builder enforces full coverage (elements + fill); images bake into `__data_*` `!byte` blocks | 3 | E10113 |
| R104 | Array index type | ✅ **RD-18 Slice 7a+7b (complete)** — unsigned integer indexes only; the tier rules key on the known total (E10117 word-on-tier-1, E10118 byte-on-tier-2 — emittable since 7b; unsized params accept both widths) | 3 | E10114, E10117, E10118 |
| R105 | Static bounds checking | ✅ **RD-18 Slice 7a** — const indexes fold and bounds-check 0..size-1 (E10115); the runtime `--bounds-check` flag remains deferred (no trap ABI) | 3 | E10115 |
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
| AC-07 | indirect recursion → E10174 (both) | ✅ **RD-18 Slice 5a** — direct `f → f` and indirect `ping → pong → ping`, one diagnostic per cycle with the full path |
| AC-08 | no/two `main()` → E10020/E10021 | ✅ **RD-18 Slice 3b** (ST-10; Pass 4 `post-check.ts`) |
| AC-09 | non-const const initializer → E10193 | ✅ **RD-18 Slice 5b** (scalar) |
| AC-10 | struct literal missing/extra field → E10161/E10162 | ⛔ DEFERRED |
| AC-11 | enum dup/over-256 → E10142/E10141 | ⛔ DEFERRED |
| AC-12 | break/continue context → E10130/E10131 | ✅ **RD-18 Slice 4a** (loop-depth tracking; ST-4) |
| AC-13 | poison-type cascade suppression (one diagnostic) | ✅ **RD-18 Slice 3b** (ST-9; R114) |
| AC-14 | `typeMap` correctness | ✅ **RD-18 Slice 3b** (scalar subset: literals/idents/same-type binary — ST-1/ST-3; aggregates → Slice 7) |
| AC-15 | `callGraph` + `findCycles()` correctness | ✅ **RD-18 Slice 5a** — real edges + Tarjan cycles; determinism (anchor ordering, diamonds, dense SCCs, termination on cyclic input) impl-tested |
| AC-16 | module-init cycle → E10194 | ✅ **RD-18 Slice 5b** |
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
