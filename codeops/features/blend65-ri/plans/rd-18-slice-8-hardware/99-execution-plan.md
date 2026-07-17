# Execution Plan: RD-18 Slice 8a — Hardware

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-17 12:55
> **Progress**: 0/60 tasks (0%)
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

- [ ] 1.1.1 Write typing spec tests (ST-1..ST-8, ST-10) — `packages/frontend/src/semantics/type-check/address-of.spec.test.ts`
- [ ] 1.1.2 Run them — verify ALL FAIL (red phase; document any pre-passer)

### Step 1.2: Typing implementation

**Reference**: 03-01 §Typing · AR-10, AR-11
**Objective**: real `&` arm + codes + address-taken marking.

- [ ] 1.2.1 Register E10047/E10048/E10049 additively (re-verify slots free) — `packages/core/src/diagnostics/diagnostic-codes.ts`
- [ ] 1.2.2 Implement the `&` operand classification in `typeUnary` + record address-taken FQNs on the model — `packages/frontend/src/semantics/type-check/expression-typing.ts`
- [ ] 1.2.3 Project `isEscaped` from the address-taken set — `packages/frontend/src/sfa/model-adapter.ts`
- [ ] 1.2.4 Run typing spec tests — verify PASS (green phase)

### Step 1.3: Lowering

**Reference**: 03-01 §Lowering · AR-11
**Objective**: `addr`-operand production with the placement discipline.

- [ ] 1.3.1 Write lowering spec tests (ST-9, ST-9b; store-position + ALU-position + temp-homing + `lo`/`hi`-of-`&` shapes) — `packages/codegen/src/il/lower-address-of.spec.test.ts`
- [ ] 1.3.2 Run them — verify FAIL (red phase)
- [ ] 1.3.3 Implement `lowerUnary` `&` → `addrOf(symbol)` per operand table + word-temp homing fallback — `packages/codegen/src/il/lower.ts`
- [ ] 1.3.4 Run lowering spec tests — verify PASS (green phase)
- [ ] 1.3.5 Write impl tests (symbol-table edges, qualified heads) + full verify — `*.impl.test.ts`

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Phase 2: By-ref argument places

### Step 2.1: Spec tests + pin rewrite

**Reference**: 03-01 §AR-29 · AR-29
**Objective**: the two former ICE pins become success oracles.

- [ ] 2.1.1 Rewrite the two ST-40 ICE pins to assert successful marshalling (retired-row protocol) + add ST-10b cases — `packages/codegen/src/il/lower-indirect.spec.test.ts`
- [ ] 2.1.2 Run them — verify the new expectations FAIL (red phase)

### Step 2.2: Implementation

**Reference**: 03-01 §AR-29
**Objective**: caller-side address formation into the callee frame home.

- [ ] 2.2.1 Implement runtime-indexed arg-place formation (scratch-pair sequence → frame-home store) — `packages/codegen/src/il/lower.ts`
- [ ] 2.2.2 Implement pair-relative arg-place formation (pair + const offset) — `packages/codegen/src/il/lower.ts`
- [ ] 2.2.3 Run spec tests — verify PASS (green phase)

### Step 2.3: Hardening

- [ ] 2.3.1 Write impl tests (foldStoreHome adjacency, scale/width edges, scratch conflicts) + full verify — `*.impl.test.ts`

**Verify**: the AR-27 command (as Phase 1)

---

## Phase 3: Interrupt functions

### Step 3.1: Parser spec tests

**Reference**: 03-02 §Parser · AR-12
**Objective**: pin both syntax forms + E10050.

- [ ] 3.1.1 Write parser spec tests (ST-11..ST-13) — `packages/frontend/src/parser/interrupt-syntax.spec.test.ts`
- [ ] 3.1.2 Run them — verify FAIL (red phase)

### Step 3.2: Parser implementation

- [ ] 3.2.1 Register E10050 additively; implement optional `: void` acceptance + non-void rejection — `packages/core/src/diagnostics/diagnostic-codes.ts`, `packages/frontend/src/parser/parse-decl.ts`
- [ ] 3.2.2 Run parser spec tests — verify PASS (green phase)

### Step 3.3: ABI spec tests

**Reference**: 03-02 §Codegen ABI · AR-14
**Objective**: pin the save/RTI byte sequence.

- [ ] 3.3.1 Write ABI spec tests (ST-14, ST-15) — `packages/codegen/src/instr/translate-interrupt.spec.test.ts`
- [ ] 3.3.2 Run them — verify FAIL (red phase)

### Step 3.4: ABI implementation

- [ ] 3.4.1 Emit the prologue in `run()` and the restore+RTI at every interrupt `ret` — `packages/codegen/src/instr/translate.ts`
- [ ] 3.4.2 Run ABI spec tests — verify PASS (green phase)

### Step 3.5: Hardening

- [ ] 3.5.1 Impl tests + E10051/E10311 re-pins (ST-16) + full verify — `*.impl.test.ts`, negatives location per 07-strategy

**Verify**: the AR-27 command

---

## Phase 4: SFA interrupt path

### Step 4.1: Spec tests

**Reference**: 03-03 (whole doc) · AR-15
**Objective**: pin both miscompile fixes + the twin before touching SFA.

- [ ] 4.1.1 Write interference spec tests (ST-17..ST-19, ST-23, ST-24) — `packages/frontend/src/sfa/irq-interference.spec.test.ts`
- [ ] 4.1.2 Write temp-pool/scratch spec tests (ST-20..ST-22) — `packages/codegen/src/instr/irq-temp-pool.spec.test.ts`
- [ ] 4.1.3 Run both — verify FAIL (red phase; ST-23 may pre-pass — document per protocol)

### Step 4.2: Implementation

- [ ] 4.2.1 Implement the irq-reachability classification (interrupt roots → BFS → `isIrqReachable`/`isIrqOnly` projection; mainlineReachable = BFS from `main`, `__init`, escaped NON-interrupt fns; exports via real call edges only — PF-001) — `packages/frontend/src/sfa/model-adapter.ts`
- [ ] 4.2.2 Extend interference Step 2: irq-reachable ⇒ always-live — `packages/frontend/src/sfa/interference.ts`
- [ ] 4.2.3 Thread the irq flag to translate; binder pool selection (`"irq-temp"` for irq-only) — `packages/codegen/src/instr/{translate,register-binding}.ts`
- [ ] 4.2.4 Extend the binder's spill-exhaustion ICE to name the dry pool (main vs irq); the irq pool stays the `irqTempBytes` profile constant — no demand sizing (PF-003) — `packages/codegen/src/instr/register-binding.ts`
- [ ] 4.2.5 Reserve + select `__zp_irq_ptr_scratch` conditionally (predicate mirrors `modelNeedsPointerScratch`, restricted to the irq-ONLY set — PF-002) — `packages/frontend/src/sfa/{model-adapter,plan-allocation}.ts`, formation call-sites in `packages/codegen/src/il/lower.ts`
- [ ] 4.2.6 Run spec tests — verify PASS (green phase)

### Step 4.3: Hardening

- [ ] 4.3.1 Impl tests (BFS cycles, both-path shapes, sizing edges) — `*.impl.test.ts`
- [ ] 4.3.2 Assert all ten prior goldens byte-exact (empty-irq degeneracy) + full verify

**Verify**: the AR-27 command

---

## Phase 5: Zeropage blocks

### Step 5.1: Spec tests

**Reference**: 03-04 (whole doc) · AR-17, AR-18
**Objective**: pin semantics + placement + the 8a/8b string boundary.

- [ ] 5.1.1 Write semantics spec tests (ST-25..ST-30, ST-28b, ST-33, ST-33b, ST-33c) — `packages/frontend/src/semantics/zeropage.spec.test.ts`
- [ ] 5.1.2 Write lowering/addressing spec tests (ST-31, ST-31b, ST-32) — `packages/codegen/src/il/lower-zeropage.spec.test.ts`
- [ ] 5.1.3 Run both — verify FAIL (red phase)

### Step 5.2: Implementation

- [ ] 5.2.1 Switch the zeropage field-initializer context to full expression parsing (`parseExpression(state, 0, true)` — aggregate literals accepted, PF-005) — `packages/frontend/src/parser/parse-decl.ts`
- [ ] 5.2.2 Collect + merge `ZeropageBlock` fields as ZP-storage module vars (E10003 path) — `packages/frontend/src/semantics/module-variable-collection.ts` (+ Pass 1 touchpoints)
- [ ] 5.2.3 Typing/init parity: call-free initializers (var-reading legal, dependency-ordered — PF-004), `__init` participation incl. ZP-storage symbols in the init-order walk, no zero-fill, string-init guard coverage for ZP fields — `packages/frontend/src/semantics/` (5b machinery touchpoints)
- [ ] 5.2.4 `modelToZpUserVars` projection + feed it from the driver — `packages/frontend/src/sfa/model-adapter.ts`, `packages/compiler/src/api/run-frontend.ts`
- [ ] 5.2.5 Symbol naming (`__zp_<Module>_<name>`) + `zeroPage` equate emission + direct-operand lowering — `packages/frontend/src/sfa/plan-allocation.ts`, `packages/codegen/src/il/lower.ts`
- [ ] 5.2.6 Run spec tests — verify PASS (green phase)

### Step 5.3: Hardening

- [ ] 5.3.1 Impl tests (merge ordering determinism, aggregate edges) + full verify — `*.impl.test.ts`

**Verify**: the AR-27 command

---

## Phase 6: Startup termination

### Step 6.1: Spec tests

**Reference**: 03-05 (whole doc) · AR-25
**Objective**: pin shim selection incl. the conservative bias.

- [ ] 6.1.1 Write shim-selection spec tests (ST-34..ST-37) — `packages/codegen/src/instr/shim-selection.spec.test.ts`
- [ ] 6.1.2 Run them — verify FAIL (red phase)

### Step 6.2: Implementation

- [ ] 6.2.1 Implement `mainCanReturn` (const-aware `ret`-reachability over `_main`'s IL CFG; conservative toward terminating) — IL analysis module under `packages/codegen/src/il/`
- [ ] 6.2.2 Consume it in `derivePreambleOptions` with the precedence override > platform `canReturn` > analysis — `packages/codegen/src/instr/instr-program.ts`
- [ ] 6.2.3 Run spec tests — verify PASS (green phase) + ST-38 prior-goldens check

### Step 6.3: Hardening

- [ ] 6.3.1 Impl tests (odd CFGs, no-main paths) + full verify — `*.impl.test.ts`

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
