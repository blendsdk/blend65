# Execution Plan: RD-18 Slice 3b — Scalar Type Engine

> **Plan**: [Index](00-index.md) · **Implements**: blend65-ri/RD-18 (Slice 3b)
> **CodeOps Skills Version**: 3.2.0
> **Last Updated**: 2026-07-06 (exec_plan — Phase 1 ✅ complete)
> **Progress**: 16/45 tasks (36%) — Phase 1 ✅ (type engine green); Zero-Ambiguity Gate ✅ PASSED (AR-1..AR-13); Preflight ✅ PASSED 2026-07-05 (code-reconciliation applied, see `00-preflight-report.md`). Runtime AR-12/AR-13 added at exec.
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
- [ ] 2.1.1 Module-var collection spec: ST-11 (module-scope `variable` symbol), ST-12 (E10003 duplicate) — `module-variable-collection.spec.test.ts`
- [ ] 2.1.2 `modelToModuleVars` spec: ST-11 projection (module-scope var → `ModuleVarInput`) — `sfa/model-adapter.spec.test.ts` (extend)
- [ ] 2.1.3 **Verify red**

### 2.2 Implementation (green)
- [ ] 2.2.1 Collect top-level `let`/`const` into module scopes (extend `function-collection.ts` or new `module-variable-collection.ts`); E10003 on duplicate; name-resolution reaches module scope
- [ ] 2.2.2 `modelToModuleVars(model)` in `sfa/model-adapter.ts` (AR-9)
- [ ] 2.2.3 Wire `run-frontend.ts:158` — `moduleVars: modelToModuleVars(semanticModel)`
- [ ] 2.2.4 **Verify green** — 2.1.x pass; `__var_*` symbols appear in a built plan

### 2.3 Impl tests & hardening
- [ ] 2.3.1 `*.impl.test.ts` — ordering (module × declaration order), byteSize per scalar, mixed local+module resolution
- [ ] 2.3.2 Full workspace verify green

**Deliverables**: module scalars allocated (`__var_*`), read/written cross-scope; SFA fed real module vars.

---

## Phase 3 — Width-aware lowering + module-var access (codegen)

Thread `typeMap`; width-aware literals/binaries; module-var load/store. Design: [03-03](03-03-width-aware-lowering.md).

### 3.1 Spec tests (red)
- [ ] 3.1.1 Lowering spec: ST-13 (word literal → `IL_WORD`), ST-14 (`word*word` result `IL_WORD` → `__rt_mul16`), ST-15 (`__var_*` load/store) — `codegen/src/il/lower.spec.test.ts` (extend)
- [ ] 3.1.2 **Verify red**

### 3.2 Implementation (green)
- [ ] 3.2.1 Add `typeOf` to `LowerCtx` + the lowering input type; thread the model's `typeOf` from the compiler IL-stage seam (R15-safe: core types only)
- [ ] 3.2.2 Width-aware `lowerNumericLit`/`lowerBinary` + `ilTypeOf` helper (replace `IL_BYTE` hardcode)
- [ ] 3.2.3 `moduleVarSymbol` + module-vs-frame resolution in `lowerIdent`/`lowerAssign`; build the module-var lookup in `lowerToIL`
- [ ] 3.2.4 **Verify green** — 3.1.x pass

### 3.3 Impl tests & hardening
- [ ] 3.3.1 `*.impl.test.ts` — byte path unchanged (regression), word round-trip, poisoned-type fallback to `IL_BYTE`
- [ ] 3.3.2 Full workspace verify green

**Deliverables**: word scalars/literals propagate to `__rt_mul16`; module vars lower to `__var_*`.

---

## Phase 4 — Acceptance (three-part bar)

Design: [03-04](03-04-acceptance-fixtures.md). Fixture + assemble-clean + golden + VICE + E10081 negative.

### 4.1 Fixture + spec tests (red)
- [ ] 4.1.1 `examples/slice3b/main.blend` (AR-6) + `testing/slice3b.ts` (`buildSlice3b`/`emitAsmSlice3b`)
- [ ] 4.1.2 `slice3b.spec.test.ts` (ST-16 assemble-clean + ST-18 VICE) and `golden-slice3b.spec.test.ts` (ST-17)
- [ ] 4.1.3 Mixed-sign negative `…mixed-sign.spec.test.ts` (ST-19, frontend `compile()`)
- [ ] 4.1.4 **Verify red** — golden missing; ST-19 already green once Phase 1 landed
- [ ] 4.2.1 Mint `test/golden/slice3b.asm.golden` (`UPDATE_GOLDEN=1`); confirm `__var_Main_accB/accW`, `__rt_mul8`, `__rt_mul16` present; inspect layout ≤13-byte shadow (AR-1)

### 4.3 Green
- [ ] 4.3.1 CI tiers green (assemble-clean + golden + mixed-sign negative)
- [ ] 4.3.2 VICE (local): ST-18 `$C000==$11`, `$C001==$58`, `$C002==$02` on real VICE 3.10
- [ ] 4.3.3 Re-check gate/slice3a goldens (ST-20) — unchanged, or re-minted only if width-threading re-proves output on VICE (AR-8 discipline)

**Deliverables**: fixture assembles → golden → VICE-verified computed result; E10081 negative green.

---

## Phase 5 — Rollout bookkeeping

- [ ] 5.1.1 Tick RD-04 AC-02/AC-03/AC-06/AC-08 (+ AC-14 scalar subset) and annotate the deferred-ledger rows R7–R16, R30/R31, R36, R44–R49, R54, R61, R63, R66, R80–R81, R114 as advanced by Slice 3b. **PF-004: correct RD-04 AC-04/AC-05 before ticking** — AC-05 says `byte + sbyte` → E10153 (wrong; the arithmetic case is **E10081** per spec TS-5 + Ch 14 + R49); AC-04 word→byte narrowing is **E10154** (already correct). Fix AC-05 (and reconcile ledger R33 vs R49) with a one-line note citing AR-11; do **not** tick AC-05 as-worded.
- [ ] 5.1.2 Tick **RD-18 AC-2** in `RD-18-codegen-language-completion.md`; annotate roadmap RD-04 row
- [ ] 5.1.3 SR-2 resource-report delta (module-var bytes + `__rt_*` sites vs Slice 3a) + **SR-3** the AR-1 `>13-byte` collision ceiling — both in this closeout
- [ ] 5.1.4 Roadmap sync (feature + portfolio cascade) → Slice 3b ✅; `git status --porcelain spec/` empty; final full verify

**Deliverables**: parent ACs advanced; roadmap Done; deferred ceiling documented; `spec/` clean.

---

## Master Progress Checklist

- [x] **Phase 1** — Type engine (1.1.1–1.3.2, 16 tasks; incl. 1.2.1 code-reconciliation) ✅ 2026-07-06
- [ ] **Phase 2** — Module scalars (2.1.1–2.3.2, 9 tasks)
- [ ] **Phase 3** — Width-aware lowering (3.1.1–3.3.2, 8 tasks)
- [ ] **Phase 4** — Acceptance (4.1.1–4.3.3, 8 tasks)
- [ ] **Phase 5** — Bookkeeping (5.1.1–5.1.4, 4 tasks)

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
