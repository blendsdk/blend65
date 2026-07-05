# Ambiguity Register: RD-18 Slice 3b — Scalar Type Engine

> **Document**: 00-ambiguity-register.md
> **Plan**: [Index](00-index.md)
> **Implements**: blend65-ri/RD-18 (Slice 3b)
> **Gate status**: ✅ GATE PASSED (2026-07-05 — all AR-1..AR-13 resolved & user-confirmed; AR-11 added post-preflight; AR-12/AR-13 added at exec_plan, runtime)
> **CodeOps Skills Version**: 3.2.0

The Zero-Ambiguity Gate register for Slice 3b. Every semantically-weighty decision is
enumerated and resolved with the user's explicit decision before any other plan document is
written. Slice 3b is the RD-18 "tent-pole" (~20 RD-04 requirements across Passes 1/3/4);
the four major decisions (AR-1..AR-4) were taken interactively; AR-5..AR-10 follow from
them plus the frozen spec and are recorded here for confirmation.

## Traceability

Surfaces trace to `spec/` (frozen) chapters + RD-04 requirement IDs + the RD-04
`08-deferred-semantics-ledger.md` rows. RD-18 restates no rule; this register records only
*rollout/implementation* decisions for the scalar slice. Codes verified against
`packages/core/src/diagnostics/diagnostic-codes.ts`.

---

## Major decisions (user-selected, interactive)

| # | Question | Options considered | **Resolution** | Rationale / grounding |
|---|----------|--------------------|----------------|-----------------------|
| **AR-1** | RAM variable placement — SFA emits `__frame_*`/`__var_*` as leading absolute equates at `ramStart=$0800`, but c64 code loads at `$0801`; past ~13 bytes (the dead BASIC-stub shadow `$0800–$080C`) variables collide with **live** machine code at `$080D+`. | (A) Stay in safe shadow, defer fix; (B) relocate region now (e.g. `$C000`); (C) serializer post-code emission (RD-09 change) | **(A) Stay in the safe shadow.** Design the fixture so total variable footprint ≤13 bytes; VICE-verifies correctly today. Log the collision ceiling as a **known limitation + deferred memory-layout fix** (future slice / RD-13). No profile or serializer change in 3b. | Keeps the slice thin (vertical-slice method — don't rebuild memory layout mid-slice). Slice 3a proved `$0800`; Slice 3a golden shows `__startup` at `$080D`, so `$0800–$080C` (13 bytes) is the dead-stub shadow. Fixture footprint ≈10 bytes (§AR-6). Ceiling documented loudly. |
| **AR-2** | Module-level scalar initialization — RAM at `$0800+` is not pre-filled; where does `let acc: byte = 5;` init run? | (A) Defer initializers; declare + assign in body; (B) support const initializers via startup `initCode` | **(A) Defer initializers.** Module scalars are allocated (`__var_*`) and read/written from function bodies; the fixture sets them via assignment in `main`. Module-level `let` with an initializer is out-of-surface for 3b (deferred to the `initCode` slice). | Spec **VAR-2** (`03-variables.md:83`): `let` init is optional; uninitialized `let x: byte;` generates **no startup code** (`:214`). `LetDecl.initialiser: ExprNode\|null`. So initializer-less module `let` is spec-legal — no deferred-initializer tension. Avoids building `initCode` lower+translate+`__startup` wiring (real scope) in 3b. |
| **AR-3** | Type-engine surface width | (A) Same-type only; widening/casts → Slice 6; (B) include implicit widening now | **(A) Same-type only.** Check same-width **and** same-signedness for arithmetic operands and assignment. Implicit widening (byte→word), expression auto-promotion, and `as` casts move to Slice 6. | Slice 6 owns "mixed-width promotion" + casts (RD-18 Slice Map). Widening/casts need `zext`/`sext`/`trunc` IL ops, which `translate.ts:258` **ICEs** on today. Same-type keeps 3b lowerable end-to-end. |
| **AR-4** | Acceptance fixture (immutable-oracle program) | (A) Byte + word, exact poke to plain RAM; (B) byte only, border register | **(A) Byte + word to plain RAM.** A byte `(a*b+c) mod 256` into a module byte var **and** a word `*` into a module word var, poked to plain RAM (`$C000`) for **exact** VICE assertions; plus a separate mixed-sign negative test asserting **E10081**. | Exercises the full 3b surface (word-literal width fix + `__rt_mul16`); plain RAM gives exact assertions (avoids the VIC-II nibble mask). Detail in §AR-6. |

---

## Secondary decisions (follow from AR-1..4 + frozen spec — recorded for confirmation)

| # | Decision point | **Resolution** | Rationale / grounding |
|---|----------------|----------------|-----------------------|
| **AR-5** | Signed `*`/`/`/`%` (`sbyte`/`sword`) | **Out of 3b surface.** Signed `+`/`-` are supported (6502 `ADC`/`SBC` are sign-agnostic). Signed `*`/`/`/`%` correctness (needs signed runtime routines, deferred by RD-17 AR-P16/PF-022) is a **future signed-arithmetic slice**. 3b does **not** special-reject it (no canonical code; no new codes until Slice 4). Fixture is unsigned. Documented as accepted deferred risk (a signed `*` would route to the unsigned `__rt_*` — a **pre-existing** codegen gap, not introduced by 3b). | RD-18 Won't-Have: "Signed `*`/`/`/`%` runtime routines deferred… Slice 3b covers unsigned byte/word operand arithmetic only." |
| **AR-6** | Fixture concrete form + addresses | Module: `let accB: byte;` `let accW: word;` (no init, AR-2). `main`: locals `a,b,c: byte`, `x,y: word`. `accB = a*b + c;` (`5*3+2 = 17 = $11` → `poke($C000, accB)`); `accW = x*y;` (`300*2 = 600 = $0258` → `pokew($C001, accW)` ⇒ `$C001=$58`, `$C002=$02`). VICE asserts `$C000==$11`, `$C001==$58`, `$C002==$02`. Negative: `let s: sbyte = -1; let r: byte = a + s;` ⇒ **E10081**. Total vars ≈10 bytes < 13 (AR-1 shadow). | `$C000–$CFFF` is always-free c64 RAM (readable by VICE). `mod 256` is implicit byte wrapping (spec TS-20). Values chosen no-overflow at their widths. |
| **AR-7** | `main()` Pass-4 validation set | Implement **E10020** (no `main`), **E10021** (multiple `main`), and `main` signature validity (must be `(): void`, no params — exact code verified against spec Ch 06 during authoring). **E10023** (calling `main` directly) → Slice 5 (needs call support). | Ledger R66 (E10020/E10021/E10023, Pass 4). Calls don't exist until Slice 5. |
| **AR-8** | `typeMap`→lowering seam | Thread the `SemanticModel` (its `typeMap`) into the codegen `LowerCtx`; `lowerNumericLit`/`lowerBinary` read `model.typeOf(expr)` for real width, replacing the `IL_BYTE` hardcode (`lower.ts:262`). | Recon: literals are byte-hardcoded; binary result type = left-operand IL type. Word scalars only propagate once lowering consumes real types. |
| **AR-9** | Module-var projection seam | Add `modelToModuleVars(model): ModuleVarInput[]` (walks `globalScope.children` module scopes, `kind:"variable"` symbols, `byteSize(sym.type)`) in `sfa/model-adapter.ts`; feed `run-frontend.ts:158` (`moduleVars: []` today). Discriminator local-vs-module = owning scope kind. | Recon: `ModuleVariableAllocation`/`ModuleVarInput`/`layoutModuleVariables`/`__var_*` all exist + unit-tested; the only gap is the projection + the empty `run-frontend` feed. **No core-type change.** |
| **AR-10** | File/module structure (No-Dead-Code / <500-line split) | Pass 1 (module-var collection) extends the existing collectors; Pass 3 typing (expression/literal typing + real `isAssignableTo`/`commonType` in core `type-utils.ts`) + poison propagation in new focused module(s); Pass 4 `main()` validation populates the `passes.ts postCheck` seam; minimal const-eval (`lo`/`hi`, literal range) in its own module. `typeMap`/`symbolMap` populated (Slice 3a left them empty). Exact decomposition in the 03-* component docs. | Coding standards: split by concern, ≤500 lines; the type engine is multiple concerns. `isAssignableTo`/`commonType` are the documented DEFERRED stubs to replace. |
| **AR-11** | **Diagnostic-code reconciliation** (added by preflight 2026-07-05, `00-preflight-report.md` PF-001..005). The original register asserted "all codes already exist / no new codes"; that was **false** — some codes were transcribed from the **stale frozen spec Ch 02 §5.3**, whose numbers collide with the authoritative registry. | (A) Register the two spec-designated-but-unregistered codes + realign the rest to the canonical Ch 14 / `diagnostic-codes.ts` registry; (B) scope the affected checks out of 3b | **(A) Register + realign.** (1) **Register two codes** absent from *both* `spec/14-diagnostics.md` and `diagnostic-codes.ts` but used by spec Ch 02 / Ch 06 text: **E10084** (out-of-range literal) and **E10022** (`main` signature must be `(): void`). Additive-only to `@blend65/core` `diagnostic-codes.ts`, **Language-Guard-approved** per RD-18 AR-115, recorded as an accepted Ch-14 drift (a **future** post-freeze spec reconciliation closes it; `spec/` stays frozen, D3). (2) **Realign** the codes the plan had taken from stale §5.3 to their canonical registry meanings (table below). (3) **Drop E10086** — boolean↔integer *casts* are Slice 6; boolean↔integer *assignment* uses the existing **E10152** (per RD-04 AC-06). | Authoritative source is `diagnostic-codes.ts` + canonical `spec/14-diagnostics.md`, which agree with the RD-04 `08-deferred-semantics-ledger.md`. Frozen spec Ch 02 §5.3 is the lone stale source (it also self-conflicts — reuses E10154 for boolean comparison, E10153 for struct/array casts). |

---

| **AR-12** *(runtime, 2026-07-05, exec_plan)* | **Slice-3a-era spec assertion ST-S21 (`analyze.spec.test.ts:59-60`) asserts `typeMap.size===0`/`symbolMap.size===0`** — a passthrough scaffold (D5) that Slice 3b's Pass-3 population supersedes. How to reconcile? | (A) Type all expressions (incl. intrinsic-call args) + update the two obsolete assertions with a traceability note; gate Pass-4 so junk/empty inputs stay silent; (B) narrow typing to `let`/`=`/`return` subexprs to keep ST-S21 untouched (leaves poke/peek arg literals untyped) | **(A) Type all exprs; update ST-S21.** User-confirmed 2026-07-05. Pass-3 types every expression in walked bodies → maps genuinely populated as the frozen spec (Ch 02) requires. Update `analyze.spec.test.ts:59-60` to assert population, traceability note "Slice 3b supersedes the 3a empty-maps passthrough (D5→populated), parallel to the 3a mainFunction edit at line 56". Keep ST-S22/S23/S24 **and** ST-4 (function-free module) green by gating Pass-4 `main`-existence (E10020) to fire **only when ≥1 function was collected, no `main` exists, and there are no upstream parse errors** (so empty / unparseable / function-free inputs stay silent — preserves AC-01). E10021 (multiple `main`) fires whenever ≥2 `main` decls are collected. | The "empty maps" assertion was always a temporary skeleton placeholder (already partially superseded in 3a for `mainFunction`); populating the maps moves the oracle **toward** the spec, not away — not "weakening a test to match broken code". Narrowing the engine (B) would shape implementation around a stale scaffold and leave intrinsic-arg literals untyped. |

| **AR-13** *(runtime, 2026-07-05, exec_plan)* | **E10150 (MissingTypeAnnotation) is unreachable from source.** Spec 02 (TS-1) wants `let x = 5` → E10150 (analyzer), but the shipped RD-03 parser (`parseLetDecl`, `parse-decl.ts:309-310`) hard-requires the colon, so annotation-less `let`/`const` is rejected syntactically (**E10313 ExpectedColon + E10303 ExpectedTypeAnnotation**) and `declaredType` is never `null` from source. A Dimension-13 gap the preflight missed (ST-7 assumed E10150 was analyzer-reachable). | (A) Keep missing-annotation parser-owned; reframe ST-7 to assert the actual rejection; add no dead `null` check; (B) change frozen RD-03 grammar to optional-colon + analyzer E10150 | **(A) Parser-owned; reframe ST-7.** User-confirmed 2026-07-05. Missing-annotation stays parser-reported (frozen RD-03: E10313/E10303) — the spec AC "annotation-less `let` is a compile error" is satisfied. ST-7 asserts `let x = 5` → `hasErrors`, no throw, parser code(s). The analyzer adds **no** `declaredType===null` E10150 check (dead code — the parser never yields `null`). E10150 stays a registered code; a future parser-layer reconciliation could move it. FR-2 + 02-current-state annotated. | Editing frozen, already-tested RD-03 grammar (B) is out of Slice 3b's thin scope and risks flipping existing parser tests for E10313/E10303. RD-18 restates no rules; the parser (RD-03) owns syntactic colon enforcement. |

## Diagnostic-code reconciliation (AR-11) — the authoritative table

Codes 3b emits, each verified against `packages/core/src/diagnostics/diagnostic-codes.ts` **and**
canonical `spec/14-diagnostics.md` (the source of truth; frozen Ch 02 §5.3 is stale where it differs):

| Condition (3b surface) | **Code (canonical)** | Registry name / Ch 14 | Status |
|------------------------|----------------------|-----------------------|--------|
| Out-of-range literal in typed context (TS-2) | **E10084** | *(spec Ch 02 only)* | ⚠️ **REGISTER** (Language-Guard, AR-115) |
| `main` signature not `(): void` (Ch 06) | **E10022** | *(spec 00-feature-index / F004)* | ⚠️ **REGISTER** (Language-Guard, AR-115) |
| Mixed-signedness **arithmetic operands** (TS-5) — *AC-2/AC-4 headline* | **E10081** | MixedSignedUnsignedOperands | ✅ exists (ledger R49) |
| **Boolean operand** in arithmetic (TS-6) | **E10080** | InvalidOperandType | ✅ exists (ledger R34) — *was mis-set to E10151* |
| **Narrowing** assignment word→byte (§5.3) | **E10154** | WidthNarrowingNoCast | ✅ exists (ledger R32) — *was mis-set to E10082* |
| **Cross-sign** assignment byte↔sbyte (§5.3) | **E10153** | SignedUnsignedMismatch | ✅ exists (ledger R33) — *was mis-set to E10080* |
| Boolean↔integer **assignment** | **E10152** | TypeMismatchAssignment | ✅ exists (RD-04 AC-06) — *replaces the dropped E10086* |
| Missing type annotation (TS-1) | **E10150** | MissingTypeAnnotation | ✅ exists |
| Undeclared identifier | **E10100** | UndeclaredIdentifier | ✅ exists |
| No `main` / multiple `main` (R66) | **E10020 / E10021** | No/Multiple main | ✅ exists |
| Duplicate top-level decl (R9/R20) | **E10003** | DuplicateDecl | ✅ exists |
| Assign to `const` (R191) | **E10191** | AssignToConst | ✅ exists |
| `return expr` in void `main` | **E10173** | VoidFunctionReturnsValue | ✅ exists |
| Const div-by-zero (const-eval) | **E10082** | ConstDivisionByZero | ✅ exists — *note: E10082 is div-by-zero, NOT narrowing* |

**Net:** two additive registrations (**E10084**, **E10022**); four realignments (boolean-arith
**E10080**, narrowing **E10154**, cross-sign **E10153**, boolean-assign **E10152**); one drop
(**E10086**, casts are Slice 6). `git status --porcelain spec/` stays empty (D3) — the two new codes
land in `diagnostic-codes.ts` only.

## Parked-question routing (RD-18)

None of the four RD-04 parked questions belong to 3b (they route to Slices 4/7/8). No parked
questions are opened here.

---

## Gate closure checklist

- [x] All semantically-weighty items enumerated (AR-1..AR-11)
- [x] Every item has an explicit resolution
- [x] Zero items deferred within the register (AR-1/AR-2/AR-5 record *scope* deferrals to later slices — a resolved decision, not an open question)
- [x] **User has confirmed the complete register** (2026-07-05; AR-11 code-reconciliation confirmed 2026-07-05 post-preflight)
- [x] Header flipped to `✅ GATE PASSED`

> **AR-11 (2026-07-05, post-preflight):** the register's original "all codes exist / no new codes"
> claim was falsified by preflight (`00-preflight-report.md`). The diagnostic-code table above is now
> the authoritative source; two codes (E10084, E10022) are registered additively per RD-18 AR-115.
