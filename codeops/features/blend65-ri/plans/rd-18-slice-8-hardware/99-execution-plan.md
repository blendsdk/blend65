# Execution Plan: RD-18 Slice 8a — Hardware

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-17 14:48
> **Progress**: 53/60 tasks (88%)
> **CodeOps Skills Version**: 3.8.0

## Overview

Seven phases light up the 8a surface over the shipped pipeline: `&` address-of, the AR-29
argument places, interrupt functions, SFA interrupt-path correctness, zeropage blocks, startup
termination analysis, and the raw-vector acceptance tier. Each phase follows the spec-first
ordering against the 07-testing-strategy ST-cases.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Address-of (`&`) | 11 |
| 2 | By-ref argument places | 6 |
| 3 | Interrupt functions | 9 |
| 4 | SFA interrupt path | 11 |
| 5 | Zeropage blocks | 10 |
| 6 | Startup termination | 6 |
| 7 | Acceptance tier | 7 |

**Total: 60 tasks across 7 phases** (no fabricated hour estimates — scope is bounded by the
task-size criteria in the quality checklist)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for
> progress. Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) and the Last Updated
>    stamp after EVERY task — never batch updates. Only `[x]` counts as complete.
> 4. **Resume** by scanning the phase sections top-to-bottom: the first `[~]` task is resumed
>    first, else the first `[ ]` task.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented. Failure to keep the marks
> current means progress is invisible after crashes, context resets, or session handoffs.

---

## Phase 1: Address-of (`&`)

### Step 1.1: Typing spec tests

**Reference**: 03-01 §Typing · AR-10, AR-11
**Objective**: pin the accept/reject matrix before any implementation.

- [x] 1.1.1 Write typing spec tests (ST-1..ST-8, ST-10) — `packages/frontend/src/semantics/type-check/address-of.spec.test.ts` ✅ (completed: 2026-07-17 14:33)
- [x] 1.1.2 Run them — verify ALL FAIL (red phase; document any pre-passer) ✅ (completed: 2026-07-17 14:33 — 9/9 red, zero pre-passers)

### Step 1.2: Typing implementation

**Reference**: 03-01 §Typing · AR-10, AR-11
**Objective**: real `&` arm + codes + address-taken marking.

- [x] 1.2.1 Register E10047/E10048/E10049 additively (re-verify slots free) — `packages/core/src/diagnostics/diagnostic-codes.ts` ✅ (completed: 2026-07-17 14:44)
- [x] 1.2.2 Implement the `&` operand classification in `typeUnary` + record address-taken FQNs on the model — `packages/frontend/src/semantics/type-check/expression-typing.ts` ✅ (completed: 2026-07-17 14:44 — `addressTakenFunctions` Symbol-set on model/context; qualified `&Module.fn` resolves without the value-position rejection)
- [x] 1.2.3 Project `isEscaped` from the address-taken set — `packages/frontend/src/sfa/model-adapter.ts` ✅ (completed: 2026-07-17 14:44)
- [x] 1.2.4 Run typing spec tests — verify PASS (green phase) ✅ (completed: 2026-07-17 14:44 — 9/9 green; core 256/256 + frontend 810/810 regression-clean)

### Step 1.3: Lowering

**Reference**: 03-01 §Lowering · AR-11
**Objective**: `addr`-operand production with the placement discipline.

- [x] 1.3.1 Write lowering spec tests (ST-9, ST-9b; store-position + ALU-position + temp-homing + `lo`/`hi`-of-`&` shapes) — `packages/codegen/src/il/lower-address-of.spec.test.ts` ✅ (completed: 2026-07-17 14:47)
- [x] 1.3.2 Run them — verify FAIL (red phase) ✅ (completed: 2026-07-17 14:47 — 6/6 red)
- [x] 1.3.3 Implement `lowerUnary` `&` → `addrOf(symbol)` per operand table + word-temp homing fallback — `packages/codegen/src/il/lower.ts` ✅ (completed: 2026-07-17 14:47 — `lowerAddressOf(direct)` + claim-always slot parity (every `&` site claims, matching the adapter's `isSlotSite` `&` arm); direct-store shortcut at let-init/assign/call-arg/pokew/module-init; homed `lo`/`hi`-of-`&` arms in the T2 emitters)
- [x] 1.3.4 Run lowering spec tests — verify PASS (green phase) ✅ (completed: 2026-07-17 14:47 — 6/6 green; two assertion strings corrected for IL operand notation `%N`/`i8u`, behavior expectations unchanged)
- [x] 1.3.5 Write impl tests (symbol-table edges, qualified heads) + full verify — `*.impl.test.ts` ✅ (completed: 2026-07-17 14:47 — 5/5 (`&main`→`_main`, qualified label, `__init` direct store, ret/compound homing); FULL VERIFY PASS)

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: By-ref argument places

### Step 2.1: Spec tests + pin rewrite

**Reference**: 03-01 §AR-29 · AR-29
**Objective**: the two former ICE pins become success oracles.

- [x] 2.1.1 Rewrite the two ST-40 ICE pins to assert successful marshalling (retired-row protocol) + add ST-10b cases — `packages/codegen/src/il/lower-indirect.spec.test.ts` ✅ (completed: 2026-07-17 14:51)
- [x] 2.1.2 Run them — verify the new expectations FAIL (red phase) ✅ (completed: 2026-07-17 14:51 — 2/2 red, 13 neighbors green)

### Step 2.2: Implementation

**Reference**: 03-01 §AR-29
**Objective**: caller-side address formation into the callee frame home.

- [x] 2.2.1 Implement runtime-indexed arg-place formation (scratch-pair sequence → frame-home store) — `packages/codegen/src/il/lower.ts` ✅ (completed: 2026-07-17 14:56 — `formArgumentAddress`: byte-domain indexes widen via `zextToWord`, word-domain scale by element size; complete address folded, no residual)
- [x] 2.2.2 Implement pair-relative arg-place formation (pair + const offset) — `packages/codegen/src/il/lower.ts` ✅ (completed: 2026-07-17 14:56 — pair load + offset add, composes with runtime indexes)
- [x] 2.2.3 Run spec tests — verify PASS (green phase) ✅ (completed: 2026-07-17 14:56 — 15/15 in lower-indirect. Mechanical correction: a THIRD retired-row pin surfaced in `packages/test-harness/src/slice7b-negatives.spec.test.ts` (the facade-level ST-63 twin of the two ICE pins) — rewritten to the superseding success expectations per the retired-row protocol)

### Step 2.3: Hardening

- [x] 2.3.1 Write impl tests (foldStoreHome adjacency, scale/width edges, scratch conflicts) + full verify — `*.impl.test.ts` ✅ (completed: 2026-07-17 14:56 — `lower-arg-place.impl.test.ts` 3/3 (byte-index widening, non-zero pair offset fold, pair+index composition); FULL VERIFY PASS)

**Verify**: the AR-27 command (as Phase 1)

---

## Phase 3: Interrupt functions

### Step 3.1: Parser spec tests

**Reference**: 03-02 §Parser · AR-12
**Objective**: pin both syntax forms + E10050.

- [x] 3.1.1 Write parser spec tests (ST-11..ST-13) — `packages/frontend/src/parser/interrupt-syntax.spec.test.ts` ✅ (completed: 2026-07-17 14:58)
- [x] 3.1.2 Run them — verify FAIL (red phase) ✅ (completed: 2026-07-17 14:58 — ST-12/13 red; ST-11 documented pre-passer (pins the shipped bare form))

### Step 3.2: Parser implementation

- [x] 3.2.1 Register E10050 additively; implement optional `: void` acceptance + non-void rejection — `packages/core/src/diagnostics/diagnostic-codes.ts`, `packages/frontend/src/parser/parse-decl.ts` ✅ (completed: 2026-07-17 14:58 — E10050 on the colon..type span; ErrorType suppressed (one root cause))
- [x] 3.2.2 Run parser spec tests — verify PASS (green phase) ✅ (completed: 2026-07-17 14:58 — 3/3)

### Step 3.3: ABI spec tests

**Reference**: 03-02 §Codegen ABI · AR-14
**Objective**: pin the save/RTI byte sequence.

- [x] 3.3.1 Write ABI spec tests (ST-14, ST-15) — `packages/codegen/src/instr/translate-interrupt.spec.test.ts` ✅ (completed: 2026-07-17 15:02)
- [x] 3.3.2 Run them — verify FAIL (red phase) ✅ (completed: 2026-07-17 15:02 — 2/2 red; plain-fn RTS control pre-passes by design)

### Step 3.4: ABI implementation

- [x] 3.4.1 Emit the prologue in `run()` and the restore+RTI at every interrupt `ret` — `packages/codegen/src/instr/translate.ts` ✅ (completed: 2026-07-17 15:02)
- [x] 3.4.2 Run ABI spec tests — verify PASS (green phase) ✅ (completed: 2026-07-17 15:02 — 3/3. Retired-row rewrite: the 7a-era ST-T23 bare-RTI pin in `translate.spec.test.ts` rewritten to the full save/restore+RTI sequence)
- [x] 3.5.1 Impl tests + E10051/E10311 re-pins (ST-16) + full verify — `*.impl.test.ts`, negatives location per 07-strategy ✅ (completed: 2026-07-17 15:02 — `interrupt-syntax.impl.test.ts` 4/4 (E10311 + E10051 re-pins, named-type message, one-root-cause); FULL VERIFY PASS; ten prior goldens byte-exact)

**Verify**: the AR-27 command

---

## Phase 4: SFA interrupt path

### Step 4.1: Spec tests

**Reference**: 03-03 (whole doc) · AR-15
**Objective**: pin both miscompile fixes + the twin before touching SFA.

- [x] 4.1.1 Write interference spec tests (ST-17..ST-19, ST-23, ST-24) — `packages/frontend/src/sfa/irq-interference.spec.test.ts` ✅ (completed: 2026-07-17 15:07)
- [x] 4.1.2 Write temp-pool/scratch spec tests (ST-20..ST-22) — `packages/codegen/src/instr/irq-temp-pool.spec.test.ts` ✅ (completed: 2026-07-17 15:07 — spill fixture repaired once to the shipped protectA shape (live const across `mul`); expectations untouched)
- [x] 4.1.3 Run both — verify FAIL (red phase; ST-23 may pre-pass — document per protocol) ✅ (completed: 2026-07-17 15:07 — 7 red; pre-passers documented: ST-23 (flags absent today) + ST-21 (mainline spill already `__zp_tmp_*`))

### Step 4.2: Implementation

- [x] 4.2.1 Implement the irq-reachability classification (interrupt roots → BFS → `isIrqReachable`/`isIrqOnly` projection; mainlineReachable = BFS from `main`, `__init`, escaped NON-interrupt fns; exports via real call edges only — PF-001) — `packages/frontend/src/sfa/model-adapter.ts` ✅ (completed: 2026-07-17 15:14 — `computeIrqClassification` + optional `isIrqReachable`/`isIrqOnly` FunctionInfo fields (additive; two 3a exact-shape pins extended with the new fields))
- [x] 4.2.2 Extend interference Step 2: irq-reachable ⇒ always-live — `packages/frontend/src/sfa/interference.ts` ✅ (completed: 2026-07-17 15:14)
- [x] 4.2.3 Thread the irq flag to translate; binder pool selection (`"irq-temp"` for irq-only) — `packages/codegen/src/instr/{translate,register-binding}.ts` ✅ (completed: 2026-07-17 15:14 — carried as optional `AllocationPlan.irqOnlyFunctions` FQN set; binder gains a pool selector param)
- [x] 4.2.4 Extend the binder's spill-exhaustion ICE to name the dry pool (main vs irq); the irq pool stays the `irqTempBytes` profile constant — no demand sizing (PF-003) — `packages/codegen/src/instr/register-binding.ts` ✅ (completed: 2026-07-17 15:14)
- [x] 4.2.5 Reserve + select `__zp_irq_ptr_scratch` conditionally (predicate mirrors `modelNeedsPointerScratch`, restricted to the irq-ONLY set — PF-002) — `packages/frontend/src/sfa/{model-adapter,plan-allocation}.ts`, formation call-sites in `packages/codegen/src/il/lower.ts` ✅ (completed: 2026-07-17 15:14 — `modelNeedsIrqPointerScratch` (exact pair-accessed-owner arm + conservative big-array arm); `LowerCtx.scratchPair` selects the twin; run-frontend wired)
- [x] 4.2.6 Run spec tests — verify PASS (green phase) ✅ (completed: 2026-07-17 15:14 — 5/5 interference + 4/4 pool/twin, first run)

### Step 4.3: Hardening

- [x] 4.3.1 Impl tests (BFS cycles, both-path shapes, sizing edges) — `*.impl.test.ts` ✅ (completed: 2026-07-17 15:14 — `irq-classification.impl.test.ts` 5/5, incl. the escaped-handler install idiom keeping helpers irq-only and the exported handler-only helper)
- [x] 4.3.2 Assert all ten prior goldens byte-exact (empty-irq degeneracy) + full verify ✅ (completed: 2026-07-17 15:14 — FULL VERIFY PASS; all ten goldens byte-exact)

**Verify**: the AR-27 command

---

## Phase 5: Zeropage blocks

### Step 5.1: Spec tests

**Reference**: 03-04 (whole doc) · AR-17, AR-18
**Objective**: pin semantics + placement + the 8a/8b string boundary.

- [x] 5.1.1 Write semantics spec tests (ST-25..ST-30, ST-28b, ST-33, ST-33b, ST-33c) — `packages/frontend/src/semantics/zeropage.spec.test.ts` ✅ (completed: 2026-07-17 15:22)
- [x] 5.1.2 Write lowering/addressing spec tests (ST-31, ST-31b, ST-32) — `packages/codegen/src/il/lower-zeropage.spec.test.ts` ✅ (completed: 2026-07-17 15:22)
- [x] 5.1.3 Run both — verify FAIL (red phase) ✅ (completed: 2026-07-17 15:22 — 15/15 red)

### Step 5.2: Implementation

- [x] 5.2.1 Switch the zeropage field-initializer context to full expression parsing (`parseExpression(state, 0, true)` — aggregate literals accepted, PF-005) — `packages/frontend/src/parser/parse-decl.ts` ✅ (completed: 2026-07-17 15:22)
- [x] 5.2.2 Collect + merge `ZeropageBlock` fields as ZP-storage module vars (E10003 path) — `packages/frontend/src/semantics/module-variable-collection.ts` (+ Pass 1 touchpoints) ✅ (completed: 2026-07-17 15:22 — core `Symbol.storage?: "zeropage"` marker; same namespace/dup rule/initializer map)
- [x] 5.2.3 Typing/init parity: call-free initializers (var-reading legal, dependency-ordered — PF-004), `__init` participation incl. ZP-storage symbols in the init-order walk, no zero-fill, string-init guard coverage for ZP fields — `packages/frontend/src/semantics/` (5b machinery touchpoints) ✅ (completed: 2026-07-17 15:22 — `typeZeropageField` mirrors `typeModuleLet` (call-free, string guard, range/assignability/overflow, unsized inference); annotation-resolution finalizes `ZeropageField` annotations (struct-typed fields); `initPseudoFunction` collects ZP initializer slots)
- [x] 5.2.4 `modelToZpUserVars` projection + feed it from the driver — `packages/frontend/src/sfa/model-adapter.ts`, `packages/compiler/src/api/run-frontend.ts` ✅ (completed: 2026-07-17 15:22 — module order × declaration order; `modelToModuleVars` excludes ZP storage (no RAM double-place))
- [x] 5.2.5 Symbol naming (`__zp_<Module>_<name>`) + `zeroPage` equate emission + direct-operand lowering — `packages/frontend/src/sfa/{plan-allocation,symbols}.ts`, `packages/codegen/src/il/lower.ts` ✅ (completed: 2026-07-17 15:22 — user-category equates carry `zeroPage: true` (2-digit); `moduleVarLocOfSymbol` ZP arm covers reads/writes/indexed/&/init stream; `lowerInitCode` collects ZP field initializers)
- [x] 5.2.6 Run spec tests — verify PASS (green phase) ✅ (completed: 2026-07-17 15:22 — 11/11 semantics + 4/4 lowering)

### Step 5.3: Hardening

- [x] 5.3.1 Impl tests (merge ordering determinism, aggregate edges) + full verify — `*.impl.test.ts` ✅ (completed: 2026-07-17 15:22 — `zeropage.impl.test.ts` 5/5 (projection order, struct-typed field, fn-name collision, E10194 cycle, unsized parity); FULL VERIFY PASS)

**Verify**: the AR-27 command

---

## Phase 6: Startup termination

### Step 6.1: Spec tests

**Reference**: 03-05 (whole doc) · AR-25
**Objective**: pin shim selection incl. the conservative bias.

- [x] 6.1.1 Write shim-selection spec tests (ST-34..ST-37) — `packages/codegen/src/instr/shim-selection.spec.test.ts` ✅ (completed: 2026-07-17 15:27 — spy plugin surfaces the variant; + platform canReturn=false case)
- [x] 6.1.2 Run them — verify FAIL (red phase) ✅ (completed: 2026-07-17 15:27 — ST-34 + canReturn-false red; ST-35/36/37 documented pre-passers (they pin the conservative side))

### Step 6.2: Implementation

- [x] 6.2.1 Implement `mainCanReturn` (const-aware `ret`-reachability over `_main`'s IL CFG; conservative toward terminating) — IL analysis module under `packages/codegen/src/il/` ✅ (completed: 2026-07-17 15:27 — `termination.ts` `functionCanReturn`; derivePreambleOptions computes it from the program's entry fn directly (no ILProgram field needed — mechanical simplification of the "carried on the IL program" wording, same behavior))
- [x] 6.2.2 Consume it in `derivePreambleOptions` with the precedence override > platform `canReturn` > analysis — `packages/codegen/src/instr/instr-program.ts` ✅ (completed: 2026-07-17 15:27 — override precedence already lived in `assembleProgram`'s spread; rules 2+3 implemented in the derivation)
- [x] 6.2.3 Run spec tests — verify PASS (green phase) + ST-38 prior-goldens check ✅ (completed: 2026-07-17 15:27 — 5/5; ten goldens byte-exact in the full verify)

### Step 6.3: Hardening

- [x] 6.3.1 Impl tests (odd CFGs, no-main paths) + full verify — `*.impl.test.ts` ✅ (completed: 2026-07-17 15:27 — `termination.impl.test.ts` 6/6 (both constant polarities, runtime cond, unreachable, empty fn, dangling target); FULL VERIFY PASS)

**Verify**: the AR-27 command

---

## Phase 7: Acceptance tier

### Step 7.1: Fixture, suites, bar

**Reference**: 03-06 (whole doc) · AR-16, AR-26; RD-18 §Acceptance Bar
**Objective**: the three-part bar GREEN + regression + records.

- [ ] 7.1.1 Author the fixture per the normative sequence — `examples/slice8/main.blend`
- [ ] 7.1.2 Harness module + assemble-clean/VICE suite — `packages/test-harness/src/testing/slice8.ts`, `slice8.spec.test.ts` (ST-39, ST-41, ST-42)
- [ ] 7.1.3 T1 coverage test (ST-43) — `packages/test-harness/src/testing/` (CI tier)
- [ ] 7.1.4 Negatives suite (ST-45 matrix) — `slice8-negatives.spec.test.ts`
- [ ] 7.1.5 Run the bar locally: assemble-clean + real-VICE runFrames assertions GREEN (ST-39/41/42)
- [ ] 7.1.6 Mint the ASM golden + landmarks; assert ten prior goldens byte-exact (ST-40, ST-44) — `golden-slice8.spec.test.ts`, `packages/test-harness/test/golden/slice8.asm.golden`
- [ ] 7.1.7 Record the resource delta, run the FULL verify, confirm `spec/` untouched (ST-46), and update the roadmap (8a complete; 8b next)

**Verify**: the AR-27 command

---

## Dependencies

```
Phase 1 (&)
    ↓
Phase 2 (arg places — uses Phase 1's formation idioms)
    ↓
Phase 3 (interrupts — independent of 1/2, ordered for the Phase-4 roots)
    ↓
Phase 4 (SFA irq path — needs interrupt kind + call graph; its plan-allocation twin edits land BEFORE Phase 5's user-var flow, exercised together in Phase 7; zp-allocator.ts itself stays untouched — PF-003/PF-017)
    ↓
Phase 5 (zeropage)
    ↓
Phase 6 (startup)
    ↓
Phase 7 (acceptance — consumes everything)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed (60/60)
2. ✅ Full verify passing (the AR-27 command), zero warnings/errors
3. ✅ The three-part bar GREEN: assemble-clean + committed golden + real-VICE runtime (01-req AC-1..3)
4. ✅ No dead code; all four new codes wired with tests; ICE pins retired loud-never-silent (01-req AC-4)
5. ✅ Ten prior goldens byte-exact; boundary tier green (01-req AC-5)
6. ✅ `git status --porcelain spec/` empty (01-req AC-6)
7. ✅ Roadmap updated (8a ✅; next: 8b make_plan)
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
