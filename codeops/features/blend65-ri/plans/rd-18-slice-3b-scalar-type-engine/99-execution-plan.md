# Execution Plan: RD-18 Slice 3b — Scalar Type Engine

> **Plan**: [Index](00-index.md) · **Implements**: blend65-ri/RD-18 (Slice 3b)
> **CodeOps Skills Version**: 3.2.0
> **Last Updated**: 2026-07-06 (exec_plan — **Slice 3b COMPLETE, 45/45**)
> **Progress**: **45/45 tasks (100%) ✅** — Phases 1–5 all complete (type engine + module scalars + width-aware lowering + 3-part acceptance bar green on real VICE + rollout bookkeeping); Zero-Ambiguity Gate ✅ PASSED (AR-1..AR-13); Preflight ✅ PASSED 2026-07-05. Runtime AR-12/AR-13 added at exec.
>
> **Exec ordering note:** task **1.2.1** (register `E10084`/`E10022` constants) is done **before** the
> 1.1.x spec tests — it is pure additive vocabulary already decided in AR-11, and the spec tests must
> reference `DiagCode.ValueOutOfRange`/`DiagCode.InvalidMainSignature` to compile. No type-engine
> *behavior* lands before its spec tests; spec-first ordering is preserved.

**Verify command** (every Verify line): `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

> **Specification-first ordering (non-negotiable), per phase:** spec tests → verify **red** →
> implement → verify **green** → impl tests → full verify. Never edit a spec test to match code.
> **Commit mode** is chosen at exec_plan time (`/exec_plan rd-18-slice-3b-scalar-type-engine [--auto-commit]`). No raw git in this doc — use `/gitcm` / `/gitcmp`.

---

## Phase 1 — The scalar type engine (frontend semantics)

Build Pass 3 (expression/literal typing, name resolution, same-type/signedness enforcement, poison)
+ Pass 4 (`main()` validity) + minimal const-eval; replace the `isAssignableTo`/`commonType` stubs;
populate `typeMap`/`symbolMap`. Design: [03-01](03-01-type-engine.md).

### 1.1 Spec tests (write first, expect red)
- [x] 1.1.1 `type-utils` spec: real `isAssignableTo`/`commonType` same-type behavior (ST-3/ST-8 basis) — `packages/core/src/semantics/type-utils.spec.test.ts` (replaced the DEFERRED-stub block ST-S10/S11 with the Slice-3b same-type/poison rules)
- [x] 1.1.2 Expression-typing spec: ST-1 (literal typing), ST-3 (same-type arith), ST-4 (E10081), ST-5 (**E10080** boolean-operand), ST-6 (E10100), ST-9 (poison one-diagnostic) — `type-check/expression-typing.spec.test.ts`
- [x] 1.1.3 Statement-typing spec: ST-2 (E10084), **ST-7 reframed (AR-13: parser-owned E10313/E10303, not analyzer E10150)**, ST-8 (**E10154** narrowing / **E10153** cross-sign) — `type-check/statement-typing.spec.test.ts`
- [x] 1.1.4 Pass-4 spec: ST-10 (E10020/E10021) + `main` signature (**E10022**) — `post-check.spec.test.ts`
- [x] 1.1.5 **Verify red** — 2026-07-05: core 3/3 same-type asserts red; frontend 12 red / 2 green-guards (ST-7 parser + valid-main). Documented red. AR-12/AR-13 recorded.

### 1.2 Implementation (make green)
- [x] 1.2.1 **Code reconciliation (AR-11 / PF-001..004)** — registered **E10084** (`ValueOutOfRange`) + **E10022** (`InvalidMainSignature`) in `diagnostic-codes.ts` (additive; canonical spec names/text; AR-11 table re-verified; registry uniqueness green).
- [x] 1.2.2 `type-utils.ts` — real same-type `isAssignableTo`/`commonType` (AR-3; poison-safe; `kind === "primitive"` guard). Verified green (core type-utils spec/impl 28/28).
- [x] 1.2.3 `type-check/name-resolution.ts` — innermost-first `resolveName` (body→module→global).
- [x] 1.2.4 `type-check/expression-typing.ts` — `typeOfExpr` (literals+adaptation, ident+E10100, same-type binary, assign, intrinsic call), `checkAssignable`, `checkConstRange`; emits E10081/**E10080**/E10084/E10100/E10152/E10153/E10154/E10191.
- [x] 1.2.5 `type-check/statement-typing.ts` — `typeCheckPrograms` driver + `let`/`=`/`return` typing (E10173 void-return); ST-7 parser-owned (AR-13). Shared `type-check/{context,type-resolution}.ts`.
- [x] 1.2.6 `const-eval.ts` — minimal evaluator (literals, unary±, int arith, `lo`/`hi`; div-by-zero→structured result). Wired via `checkConstRange` (E10084/E10082).
- [x] 1.2.7 `post-check.ts` + wired `passes.ts postCheck` — `main()` E10020/E10021 + **E10022**; AR-12 gate (≥1 function).
- [x] 1.2.8 `analyze.ts` — invoke Pass-3 typer + Pass-4; real `typeMap`/`symbolMap`/`typeOf`/`symbolOf`; `hasErrors` spans all analyzer passes. ST-S21 updated (AR-12).
- [x] 1.2.9 **Verify green** — 2026-07-06: frontend semantics 64/64, core 240/240.

### 1.3 Impl tests & hardening
- [x] 1.3.1 `const-eval.impl.test.ts` (8) + `type-check/expression-typing.impl.test.ts` (6) — literal adaptation, poison cascade (no operand cascade), assign-compat branches (E10152/E10084/E10082), never-throw on malformed input.
- [x] 1.3.2 **Full workspace verify green** — 2026-07-06: build+typecheck+lint clean; all package tests + root R15 boundary tier green; golden-gate/slice3a unchanged.

**Deliverables**: E10084 + E10022 registered (AR-11); `typeMap`/`symbolMap` populated;
E10081/E10080/E10150/E10084/E10152/E10154/E10153/E10100/E10020/E10021/E10022 emitted (canonical
registry codes per AR-11); never throws; existing frontend suites green.

---

## Phase 2 — Module-level scalars (Pass 1 collection + SFA seam)

Collect top-level `let` into module scopes; project + feed SFA. Design: [03-02](03-02-module-scalars.md).

### 2.1 Spec tests (red)
- [x] 2.1.1 Module-var collection spec: ST-11 (module-scope `variable` symbol + body resolves), ST-12 (E10003 duplicate) — `module-variable-collection.spec.test.ts`
- [x] 2.1.2 `modelToModuleVars` spec: ST-11/11b/11c/11d projection — `sfa/model-adapter.spec.test.ts` (extended `buildModel` with module vars)
- [x] 2.1.3 **Verify red** — 2026-07-06: collection spec 2/2 red

### 2.2 Implementation (green)
- [x] 2.2.1 New `module-variable-collection.ts` (sibling, AR-10) — collects top-level `let`→`variable`/`const`→`constant` into the module scope `collectFunctions` built (matched by `ModuleDeclNode`); E10003 on duplicate; wired into `analyze.ts` before typing (so refs resolve, E10003 counted in `hasErrors`).
- [x] 2.2.2 `modelToModuleVars(model)` in `sfa/model-adapter.ts` (AR-9; walks module scopes, `kind:"variable"` only, `byteSize`); barrel-exported from `sfa/index.ts`.
- [x] 2.2.3 Wired `run-frontend.ts` — `moduleVars: modelToModuleVars(semanticModel)` (was `[]`).
- [x] 2.2.4 **Verify green** — 2026-07-06: frontend semantics+adapter 87/87; compiler 82/82; goldens unchanged.

### 2.3 Impl tests & hardening
- [x] 2.3.1 `module-variable-collection.impl.test.ts` (4) — declaration-order + per-scalar byteSize via full `analyze`→`modelToModuleVars`, mixed local+module resolution, module-`const` assignment **E10191** (now reachable), const excluded from RAM projection.
- [x] 2.3.2 **Full workspace verify green** — 2026-07-06: build+typecheck+lint clean; all package tests + R15 boundary; golden-gate/slice3a unchanged.

**Deliverables**: module scalars allocated (`__var_*`), read/written cross-scope; SFA fed real module vars.

---

## Phase 3 — Width-aware lowering + module-var access (codegen)

Thread `typeMap`; width-aware literals/binaries; module-var load/store. Design: [03-03](03-03-width-aware-lowering.md).

### 3.1 Spec tests (red)
- [x] 3.1.1 Lowering spec: ST-13 (word literal → `i16u`), ST-14 (`word*word` result `i16u`), ST-15 (`__var_*` load/store) — `codegen/src/il/lower.spec.test.ts` (extended; real-frontend `lowerRealSource` helper — codegen depends on frontend).
- [x] 3.1.2 **Verify red** — 2026-07-06: ST-13/ST-15 red (ST-14 green-guard: operand-driven i16u already worked).

### 3.2 Implementation (green)
- [x] 3.2.1 **No new plumbing (PF-008)** — `LowerCtx`/`LowerInput` already carry `model`; consume `ctx.model.typeOf(expr)`.
- [x] 3.2.2 Width-aware `lowerNumericLit` (`ilTypeOfType(ctx.model.typeOf(expr))`, IL_BYTE fallback) + `lowerBinary` result type from the model; **reuse existing `ilTypeOfType`** (PF-007), no new helper.
- [x] 3.2.3 `moduleVarSymbol` (exact `sanitize` match to SFA) + `moduleVarOf` (via `model.symbolOf` → `scope.kind==="module"`) branching in `lowerIdent`/`lowerAssign`. No plan-lookup needed (symbolMap-driven).
- [x] 3.2.4 **Verify green** — 2026-07-06: codegen lower spec 13/13.

### 3.3 Impl tests & hardening
- [x] 3.3.1 `lower.impl.test.ts` (+3) — byte path i8u (regression), word round-trip i16u, poisoned-binary → i8u fallback without throwing.
- [x] 3.3.2 **Full workspace verify green** — 2026-07-06: build+typecheck+lint clean; all package tests + R15 boundary; **gate/slice3a goldens unchanged** (byte path preserved).

**Deliverables**: word scalars/literals propagate to `__rt_mul16`; module vars lower to `__var_*`.

---

## Phase 4 — Acceptance (three-part bar)

Design: [03-04](03-04-acceptance-fixtures.md). Fixture + assemble-clean + golden + VICE + E10081 negative.

### 4.1 Fixture + spec tests (red)
- [x] 4.1.1 `examples/slice3b/main.blend` (AR-6) + `testing/slice3b.ts` (`buildSlice3b`/`emitAsmSlice3b`, mirror slice3a).
- [x] 4.1.2 `slice3b.spec.test.ts` (ST-16 assemble-clean + ST-18 VICE) + `golden-slice3b.spec.test.ts` (ST-17).
- [x] 4.1.3 `slice3b-mixed-sign.spec.test.ts` (ST-19) — `compile()` frontend-only: E10081 + `hasErrors` + no binary + no throw.
- [x] 4.1.4 **Verify red / green split** — 2026-07-06: assemble-clean + VICE + mixed-sign green immediately (Phases 1–3 landed); golden minted next.
- [x] 4.2.1 Minted `packages/test-harness/test/golden/slice3b.asm.golden` (`UPDATE_GOLDEN=1`) — contains `__var_Main_accB=$0800`/`accW=$0801`, `__rt_mul8`, `__rt_mul16`. Layout $0800–$0809 (10 bytes) ≤ 13-byte shadow; `__startup` clears it (AR-1 ✓).

### 4.3 Green
- [x] 4.3.1 CI tiers green — assemble-clean (real ACME) + golden (byte-exact) + mixed-sign negative.
- [x] 4.3.2 **VICE (local, real 3.10)** — ST-18 `$C000==$11`, `$C001==$58`, `$C002==$02` ✅ on real VICE (x64sc).
- [x] 4.3.3 ST-20 — gate/slice3a goldens **unchanged** (width-threading left the byte-only fixtures byte-exact; no re-mint).

**Deliverables**: fixture assembles → golden → VICE-verified computed result; E10081 negative green.

---

## Phase 5 — Rollout bookkeeping

- [x] 5.1.1 Ticked RD-04 AC-02/AC-03/**AC-04**/AC-06/AC-08/**AC-13**/AC-14 (scalar subset) in the deferred ledger + added a Slice-3b advancement banner (R7/R8, R14–R16/R61, R30–R34/R36, R44–R49, R54, R63, R66, R80/R81, R114). **PF-004 applied: AC-05 corrected** — `byte + sbyte` arithmetic = **E10081** (R49), *not* E10153 (which is the assignment cross-sign case, R33); not ticked as-worded, corrected with an AR-11 note.
- [x] 5.1.2 Ticked **RD-18 AC-2** (Slice 3b) in `RD-18-codegen-language-completion.md` with VICE evidence; roadmap RD-04 row annotation cascaded (below).
- [x] 5.1.3 SR-2 / SR-3 closeout recorded (below).
- [x] 5.1.4 Roadmap sync (feature + portfolio cascade) → Slice 3b ✅; `git status --porcelain spec/` empty; final full verify green.

**Deliverables**: parent ACs advanced; roadmap Done; deferred ceiling documented; `spec/` clean.

---

## Closeout — SR-2 resource delta / SR-3 collision ceiling

**SR-2 (resource-report delta vs Slice 3a).** From the committed `slice3b.asm.golden`:
- **RAM (vars):** module scalars `__var_Main_accB` = `$0800` (1B) + `__var_Main_accW` = `$0801` (2B) = **3B**
  at `$0800–$0802`; frame region `$0803–$0809` (`a,b,c:byte` + `x,y:word`) = **7B**. Total var footprint
  **10 bytes** (`$0800–$0809`). Slice 3a was 1 frame byte, 0 module vars.
- **Code:** two runtime routines now embedded — **`__rt_mul8`** (byte `a*b`) + **`__rt_mul16`** (word `x*y`);
  Slice 3a embedded none. ZP: 0 (unchanged).

**SR-3 (AR-1 collision ceiling — documented deferred limitation).** SFA emits `__var_*`/`__frame_*` as
leading absolute equates from `ramStart = $0800`; the c64 PRG loads code at `$0801` with `__startup` at
`$080D` (after the 12-byte BASIC stub `$0801–$080C`). So `$0800–$080C` (**13 bytes**) is a dead-stub shadow
a variable region may safely occupy — `__startup` overwrites it after the SYS hand-off. Slice 3b's fixture
uses **10 bytes** (`$0800–$0809`), within the shadow — VICE-verified correct. **Ceiling: a fixture whose
total variable footprint exceeds 13 bytes would collide with live code at `$080D+`.** The general fix
(relocate the var region / post-code serializer emission) is **deferred** to a future memory-layout slice
(RD-13 candidate); no profile or serializer change is made in Slice 3b (AR-1).

---

## Master Progress Checklist

- [x] **Phase 1** — Type engine (1.1.1–1.3.2, 16 tasks; incl. 1.2.1 code-reconciliation) ✅ 2026-07-06
- [x] **Phase 2** — Module scalars (2.1.1–2.3.2, 9 tasks) ✅ 2026-07-06
- [x] **Phase 3** — Width-aware lowering (3.1.1–3.3.2, 8 tasks) ✅ 2026-07-06
- [x] **Phase 4** — Acceptance (4.1.1–4.3.3, 8 tasks) ✅ 2026-07-06 (3-part bar green on real VICE)
- [x] **Phase 5** — Bookkeeping (5.1.1–5.1.4, 4 tasks) ✅ 2026-07-06 (parent ACs advanced, PF-004 AC-05 corrected, SR-2/SR-3 closeout)

> Task count: **45** granular steps across 5 phases; the counter is updated live during exec_plan.

## Success Criteria

1. All phases complete; full workspace verify green (build + typecheck + lint + all tests, incl. R15 boundary).
2. The three-part bar passes: CI assemble-clean + CI golden + local VICE (`$C000==$11`, `$C001==$58`, `$C002==$02`).
3. `byte + sbyte` → **exactly E10081**, never throws, no binary (AC-4).
4. No ICE on any user-input path; every new check emits a diagnostic (FR-9).
5. No dead code — the type engine is reusable by Slices 4–8 (not throwaway).
6. `git status --porcelain spec/` empty (D3); parent ACs ticked; roadmap synced.
7. AR-1 collision ceiling + SR-2 delta recorded in the closeout.
8. Post-completion project re-analysis (handled by exec_plan).

## Dependencies & sequencing

Phase 1 → 2 → 3 are ordered (typing feeds module-var typing feeds width-aware lowering). Phase 4
needs 1–3. Phase 5 after 4. No dependency cycles. The RAM-collision fix and `initCode` are **not**
dependencies (deferred by AR-1/AR-2).
