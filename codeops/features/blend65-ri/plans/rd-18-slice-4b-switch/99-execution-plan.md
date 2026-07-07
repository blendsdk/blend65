# RD-18 Slice 4b — Execution Plan

> **Plan**: rd-18-slice-4b-switch · **Implements**: blend65-ri/RD-18 (Slice 4b; closes AC-3)
> **Gate**: `00-ambiguity-register.md` ✅ PASSED (AR-1…AR-14)
> **CodeOps Skills Version**: 3.2.0
> **Last Updated**: 2026-07-07 (exec_plan — Phase 2 complete)
> **Progress**: 17/26 tasks (65%)

Specification-first ordering per phase: **spec tests → verify red → implement → verify green → impl
tests → full verify**. Marks are two-stage: `[~]` implemented (timestamp), `[x]` only after its
verify passes. Commit mode selected at exec time (recommend commit + push per phase, as 4a).

---

## Phase 1 — Switch semantics (`03-01`)

### 1.1 Spec tests (red)
- [x] 1.1.1 `type-check/switch-typing.spec.test.ts` — ST-1 (E10075 boolean), ST-2 (valid byte switch typed), ST-3 (E10071 non-const), ST-4a (E10084 range for `case 300`), ST-4b (E10077 — deferred `.todo`, PF-002), ST-5a/5b (E10132 dup), ST-11 (two defaults → **no error**, last-wins; PF-001). Derived from `07` / spec §8. **Verify red.**
- [x] 1.1.2 `type-check/switch-fallthrough.spec.test.ts` — ST-6 (E10074 not-last), ST-7 (E10074 nested), ST-8 (E10073 warning in default). **Verify red.**
- [x] 1.1.3 `function-collection`/typing spec — ST-9 (case-body local collected), ST-10 (`break` in switch-in-loop accepted, transparency). **Verify red.**

### 1.2 Implement
- [x] 1.2.1 `@blend65/core` — mint `CaseValueTypeMismatch: "E10077"` (AR-4) + provenance comment, **and** register the four absent spec-numbered codes E10071/E10073/E10074/E10075 additively (**five** total; **not** E10076 — deferred parser-owned, PF-001); presence test in `diagnostic-codes.impl.test.ts`.
- [x] 1.2.2 `statement-typing.ts` — `case "SwitchStmt"` (AR-11): discriminant operand-type (E10075) → poison; per-value check precedence **E10071 → E10084 (range) → E10077 (bespoke, rarely reachable)** (PF-002); duplicate detection (E10132); **no** E10076 (parser-owned, PF-001); `fallthrough` position/no-effect (E10074/E10073); recurse clause bodies; single-cascade discipline (03-01 §2).
- [x] 1.2.3 `function-collection.ts` — `SwitchStmt` arm in `collectStmtLocals` recursing `cases[].body` + `defaultClause.body` (AR-12, 03-01 §3).

### 1.3 Green + impl tests
- [x] 1.3.1 Verify ST-1…ST-11 green (rebuild frontend; run frontend suite).
- [x] 1.3.2 `switch-typing.impl.test.ts` — internals/edges: multi-value list with mixed valid values, `word` discriminant + `byte`-fitting values (no spurious E10077), poison suppresses cascade, empty-body cases.
- [x] 1.3.3 Phase-1 full verify (build + typecheck + lint + frontend/core tests).

## Phase 2 — Switch IL lowering (`03-02`)

### 2.1 Spec tests (red)
- [x] 2.1.1 `il/switch-lowering.spec.test.ts` — ST-12 (multi-block CFG + brcond dispatch), ST-13 (multi-value shared body), ST-14 (fallthrough → br next body), ST-15 (auto-break → br join), ST-16 (default = unconditional tail). **Verify red** (currently ICE).
- [x] 2.1.2 `instr/switch-translate.spec.test.ts` — ST-17 (translate consumes switch IL, no new terminator; eq uses DEF-1 form). **Verify red.**
- [x] 2.1.3 ST-18 — confirm the **unchanged** `unsupportedFixture` (bare `fallthrough`) still ICEs one E90001 post-4b (RD-06 ST-L5 expectation **unchanged**); PF-003.

### 2.2 Implement
- [x] 2.2.1 `lower.ts` — `lowerSwitch` + `case "SwitchStmt"` in `lowerStmt` (AR-1/AR-8/AR-9, 03-02 §2): lower discriminant once; reserve per-clause body + join labels; emit per-value `eq`+`brcond` dispatch chain; default = final unconditional `br`; bodies terminate `br(join)` or `br(next body)` on `fallthrough`; guard `isTerminated()`; `break`/`continue` resolve to enclosing `LoopContext` (switch pushes nothing).
- [x] 2.2.2 `lower.spec.test.ts` — **keep** `unsupportedFixture` on `fallthrough` (still unsupported post-4b, PF-003); **only** sync the stale `// ... (IfStmt) ...` comment at `:105` to name `fallthrough` (PF-006). No fixture repoint, no expectation change.

### 2.3 Green + impl tests
- [x] 2.3.1 Verify ST-12…ST-18 green (rebuild codegen; run codegen suite).
- [x] 2.3.2 `il/switch-lowering.impl.test.ts` — edges: empty default body, single-case switch, `fallthrough` into default, a case body ending in `break`/`return` (no double-terminate).
- [x] 2.3.3 Phase-2 full verify (codegen + downstream builds).

## Phase 3 — Acceptance (3-part bar, `03-03`)

### 3.1 Fixture + spec tests (red)
- [ ] 3.1.1 `examples/slice4b/main.blend` (AR-13) + `testing/slice4b.ts` (`SLICE4B_SRC`/`buildSlice4b`/`emitAsmSlice4b`).
- [ ] 3.1.2 `slice4b.spec.test.ts` (ST-19 assemble-clean + ST-21 VICE) + `golden-slice4b.spec.test.ts` (ST-20).
- [ ] 3.1.3 `slice4b-negatives.spec.test.ts` (ST-22 E10071 / ST-23 E10132 / ST-24 E10075 via `compile()`). **Verify red/green split** (negatives green once Phase 1 lands; golden/VICE pending Phase 2 + mint).

### 3.2 Green
- [ ] 3.2.1 Mint `test/golden/slice4b.asm.golden` (`UPDATE_GOLDEN=1`); inspect the dispatch chain (per-case `eq`+`brcond`, multi-value shared body, `fallthrough` `br`, default tail) + `__var_Main_out1/out2`.
- [ ] 3.2.2 CI tiers green: assemble-clean (ST-19) + golden (ST-20) + negatives (ST-22/23/24) + regression (ST-25, gate/slice3a/slice3b/slice4a byte-exact).
- [ ] 3.2.3 **VICE (local, real 3.10)** — ST-21 `$C000==$19` (25), `$C001==$07` (7) on x64sc.

## Phase 4 — Rollout bookkeeping (`01-requirements` §4)

- [ ] 4.1.1 **Close RD-18 AC-3** `[~]`→`[x]` (Slice 4 complete: 4a + 4b) in the RD-18 requirements doc; annotate the switch surface shipped (AR-14).
- [ ] 4.1.2 RD-04 deferred ledger — advance **R75** (switch expr + case values → E10075/E10084/E10132; E10077 registered, emission deferred) + **R79** (`fallthrough` context → E10073/E10074); leave **R76** (exhaustive enum switch → E10133) deferred to Slice 7 (AR-2); Slice-4b advancement banner.
- [ ] 4.1.3 SR-2 (compare-chain code-size delta; no new ZP/runtime) + the **five-code** Ch-14 additive-deviation entry (E10077+E10071/E10073/E10074/E10075; **not** E10076 — PF-004) + SR-3 deferral closeout (enum/exhaustiveness, jump-table, parser-reconciliation, **E10076 duplicate-default** PF-001, **out-of-switch `fallthrough`** PF-003) in this plan.
- [ ] 4.1.4 Roadmap sync (feature + portfolio cascade) → Slice 4b ✅, RD-18 AC-3 closed; `git status --porcelain spec/` empty; final full workspace verify green.

---

## Master Progress Checklist

- [x] **Phase 1** — Switch semantics (1.1.1–1.3.3, 9 tasks) ✅ 2026-07-07
- [x] **Phase 2** — Switch IL lowering (2.1.1–2.3.3, 8 tasks) ✅ 2026-07-07
- [ ] **Phase 3** — Acceptance / 3-part bar (3.1.1–3.2.3, 6 tasks)
- [ ] **Phase 4** — Rollout bookkeeping (4.1.1–4.1.4, 4 tasks)

Total: **26 tasks** across 4 phases (includes 1.2.1 code mint).

## Dependencies

Phase 1 (semantics) is independent. Phase 2 (lowering) needs Phase 1 (valid typed switches +
collected locals). Phase 3 needs 1+2 (the fixture compiles). Phase 4 after 3. No cycles. The
compare-chain dispatch depends on the **already-shipped** 4a DEF-1 `eq` fix (AR-13) — a cross-slice
runtime dependency, not a task. No jump-table / no new IL terminator / no translate change (AR-1).

## Acceptance bar (3-part, per RD-18)

1. **Assemble-clean (CI)** — the fixture assembles through real ACME to a loadable PRG.
2. **Golden (CI)** — committed `--emit-asm` golden via `assertGolden`.
3. **VICE (local)** — real VICE 3.10 asserts the observable poked result.

Closes RD-18 AC-3 (the full Slice-4 control-flow surface).
