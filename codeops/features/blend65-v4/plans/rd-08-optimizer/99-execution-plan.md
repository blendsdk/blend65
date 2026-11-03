# Execution Plan: Full RD-08 Optimizer

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-03
> **Progress**: 16/41 tasks (39%)
> **CodeOps Artifact Schema**: 1

## Overview

Build the shared optimizer foundation, qualify `size` on saved and acquisition,
then add balanced/speed and complete qualification. Every phase has a measured
gate. A failed saved/acquisition gate stops the plan for a user scope decision;
it is never repaired by weakening limits or adding a benchmark-specific rule.

**Update this document after each completed task.**

---

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---|
| 1 | Shared foundation | 14 |
| 2 | Saved 725 | 9 |
| 3 | Acquisition 963 | 9 |
| 4 | Balanced and speed | 5 |
| 5 | Qualification and closeout | 4 |

**Total: 41 tasks across 5 phases**

> The task checkboxes below are the single source of truth. Use `[~]` while
> implementing, `[x]` only after verification, and `[!]` with a named blocker.

---

## Phase 1: Shared foundation

> **Reasoning**: high — new internal optimizer layer crossing provenance, SFA and evidence.

### Step 1.1: Specification and invariant tests

**Reference**: [07](07-testing-strategy.md) ST-1–ST-7; [03-01](03-01-facts-and-pipeline.md) §Architecture; AR-003/007/008.

- [x] 1.1.1 [spec-author] Write the foundation specification tests for facts identity, per-rule obligations, provenance and B/R/T — `packages/compiler/src/machine/optimization-*.spec.test.ts` ✅ (completed: 2026-11-01 23:55; three independent spec files, 39 cases total, import the planned missing modules; no production code)
- [x] 1.1.2 [spec-author] Verify the foundation specification tests fail for the expected missing facts/rules; no implementation is present ✅ (completed: 2026-11-01 23:55; 3/3 files RED for missing optimization-facts/rules/cost modules, no tests collected)

### Step 1.2: Shared facts bundle

**Reference**: [03-01](03-01-facts-and-pipeline.md) §New Types; AR-009.

- [x] 1.2.1 Implement `OptimizationFacts` and deterministic derivation from existing pure queries — `packages/compiler/src/machine/optimization-facts.ts` ✅ (completed: 2026-11-01 23:58; immutable facts from existing liveness/object/loop/domain/effect queries)
- [x] 1.2.2 Verify facts identity, source/profile ownership and deterministic ordering — focused facts tests ✅ (completed: 2026-11-01 23:58; 6/6 facts cases pass)

### Step 1.3: Ordered rule runner and obligations

**Reference**: [03-01](03-01-facts-and-pipeline.md) §Rule Order; [03-02](03-02-rules-and-obligations.md) §Rule Execution Contract; AR-007/008.

- [x] 1.3.1 Implement the explicit ordered rule runner, stable rule IDs and closed obligation result — `packages/compiler/src/machine/optimization-rules.ts` ✅ (completed: 2026-11-01 23:58; foundation catalogue and validation; no benchmark-specific match)
- [x] 1.3.2 Implement the foundation rules only: copy/dead cleanup and declaration/fallback checks; no benchmark-specific rule — `packages/compiler/src/machine/optimization-rules.ts` ✅ (completed: 2026-11-02 01:15; copy-forward, dead-instruction and empty-block rules prove request origin/domain, producer flags, observed-access exclusion, overwritten state and label references in `optimization-cleanup.ts`; 9/9 focused impl cases pass)
- [x] 1.3.3 Verify declared-site containment, rejected-rule fallback and obligation closure — focused rules tests ✅ (completed: 2026-11-01 23:58; 9/9 rules cases pass)

### Step 1.4: Complete cost vector

**Reference**: [03-03](03-03-cost-modes-and-evidence.md) §Cost Vector; AR-010.

- [x] 1.4.1 Implement exact/range/symbolic/unknown T and B/R/T comparison helpers — `packages/compiler/src/machine/optimization-cost.ts` ✅ (completed: 2026-11-01 23:58; complete B/R/T ordering, unknown/incomparable and stable selection)
- [x] 1.4.2 Verify unknown/incomparable handling, exact ties and mode ordering — focused cost tests ✅ (completed: 2026-11-01 23:58; 24/24 cost cases pass)

### Step 1.5: Lowering and provenance integration

**Reference**: [03-01](03-01-facts-and-pipeline.md) §Integration Points; AR-008.

- [x] 1.5.1 Integrate facts/rule runner inside `lowerMachineProgramBody` before storage projection; keep `none` inert — `packages/compiler/src/machine/lower.ts` ✅ (completed: 2026-11-02 01:15; optional `optimizationFacts` runs the ordered rules on the pre-projection draft; direct/no-facts lowering keeps the exact canonical path)
- [x] 1.5.2 Preserve producer provenance and re-close storage/layout after rule changes — `machine/lowering-provenance.ts`, `services/shared-storage.ts` ✅ (completed: 2026-11-02 01:15; rules run inside the sealed producer before projection; storage demand, shared layout and final observers re-close on the transformed functions; 27/27 frontier passes)
- [x] 1.5.3 Propagate internal mode/facts through size candidate construction — `services/size-selection.ts`, `services/services.ts` ✅ (completed: 2026-11-02 01:15; one facts bundle is derived per size build and passed to every candidate; direct reference lowering stays fact-free)

### Step 1.6: Foundation evidence

**Reference**: [03-03](03-03-cost-modes-and-evidence.md) §Evidence; ST-6/ST-13.

- [x] 1.6.1 Emit complete size decisions and selected totals without changing `none` — `services/evidence.ts`, `artifacts/costs-evidence-validator.ts` ✅ (completed: 2026-11-02 01:15; existing size decisions/totals validate on all 27 frontier cases; saved remains 1623/725 and acquisition 2442/963, both unchanged)
- [x] 1.6.2 Verify 27/27 frontier, none artifact identity, build, typecheck and owned suites — complete foundation gate ✅ (completed: 2026-11-02 01:20; frontier 27/27, none PRG identity `0417b7da…` against parent `7395d181`, 48 focus cases, compiler build and root typecheck pass; saved 1623/725 and acquisition 2442/963 unchanged)

**Phase 1 gate:** all foundation tests pass; no benchmark-specific rule is active;
none output is unchanged; if the rule runner cannot preserve provenance, stop.

---

## Phase 2: Saved 725

> **Reasoning**: high — synchronous aggregate/loop/ABI rules with real 725-byte gate.

### Step 2.1: Saved specification tests

- [x] 2.1.1 [spec-author] Write saved behavior, output, resource and native specification cases — `test/rd08/optimizer-saved-output.spec.test.ts` ✅ (completed: 2026-11-02 01:45; 17 independent cases on four profiles plus one bounded PAL/6581 native case; behavior/resource/accounting and native guards pass)
- [x] 2.1.2 [spec-author] Verify the saved specification cases fail for the expected missing rule/limit; no saved implementation is present ✅ (completed: 2026-11-02 01:45; 8 RED: payload1623>725, general1726>745, combined1732>759 and no register-served fixed-eight copy loop on four profiles; 9 pass as behavior/resource/native guards; no limit changed)

### Step 2.2: Saved rules

**Reference**: [03-02](03-02-rules-and-obligations.md) §Rule Catalogue; RD-08 R8.14–R8.23.

- [x] 2.2.1 Implement selected-loop X/Y/FlatEight and LowByte/complement composition with per-rule obligations — `machine/optimization-rules.ts` ✅ (completed: 2026-11-03 18:40; the `mixed` policy now selects `closed:mixed:compact-looped` at **739 bytes** after the per-loop body-region, continuation and bottom-tested layout proofs. The proof maps the selected body inside a larger function, accounts for the canonical negative bounds expansion as unreachable, proves the held counter register dead at the normal exit, and keeps the canonical five-role proof for straight loops. `none` identity is unchanged)
- [~] 2.2.2 Implement typed store, loop residual, register/flag/word forwarding and address-form rules — `machine/optimization-rules.ts` ⏳ (implemented: 2026-11-03 18:40; size mode prefers byte local, parameter and low-read homes plus non-entry fixed counters in zero page. A proved `constantBase + unsignedByteIndex` raw read consumed only by its next read lowers to `ldx index; lda base,x` with no address temporary, and a held counter serves that read without reloading. The `mixed` plan promotes loop-body byte retained values to zero-page-preferred homes and now bottom-tests the proved register loop: preheader, body, update, header, exit; the update falls through, the header uses `bne`, and the redundant `clv` disappears. The exact `Game.main` copy loop is the expert 13-byte form `ldx #0; lda $C110,x; sta saved,x; inx; cpx #8; bne`, taking the selected saved candidate 803→**790** (Game.main 88, zeroPage 12, general 834). An unsigned byte/word/enum guard refinement is limited to observer-evidence size lowering, so `none` output is unchanged. Declared-word and call-staging homes stay in RAM. Dead private temporary stores are removed from the canonical reference and every admitted tuple through one shared dead-home set)
- [ ] 2.2.3 Implement caller-owned aggregate/global return and copy-elision rules for the saved fixture — `storage/selection.ts`, `machine/optimization-rules.ts`
- [x] 2.2.4 Integrate saved rule obligations with final observers; preserve canonical fallback — `services/size-observers.ts`, `services/size-observer-*` ✅ (completed: 2026-11-03 18:40; the mixed candidate passes the complete observer path. The field/byte-window correspondence accepts the reference-only negative bounds expansion, the held-counter read proves C/V continuations while the loop exit proves Y dead, the composition accounts for parent-derived initialization and the removed word-update scratch, and it accepts the bottom-tested preheader redirect, the C→Z test swap and the direct `bne` header only after proving the five exact edges and that the header is reachable only from the update. The same five-role and canonical fallback remain for every unproved tuple. The saved behavior, resource, accounting, no-copy and native cases plus all four register-served copy-loop cases pass; only the payload/RAM ceilings remain RED)

#### Measured frontier (2026-11-03)

The selected saved candidate is `closed:mixed:compact-looped` at **739 bytes**
with zeroPage 13 (general 784, combined 797). Because general counts code plus
the required 24 BSS bytes, the binding code target is **721** (18 bytes below
739): 721 + 24 = 745 general and 721 + 24 + 13 = 758 combined. The payload
ceiling 725 is looser than this code target.

| Owner | Ours | Expert | Gap |
|---|---:|---:|---:|
| `c64.input.keyState` | 241 | 221 | +20 |
| `c64.input.snapshotCompatible` | 153 | 142 | +11 |
| `Game.main` | 88 | 78 | +10 |
| `c64.input.soleGroundSource` | 36 | 32 | +4 |
| `c64.input.joystickState` | 118 | 138 | −20 |
| startup | 91 | 102 | −11 |

Landed and measured this session:

| Lever | Measured effect | Disposition |
|---|---|---|
| Mixed per-loop register/byte policy | 863 → **827**; then the body-region/continuation proof selects it | Selected. Nested bodies, counter-as-index loads, the unreachable canonical bounds expansion, parent-derived initialization and the held-register exit are proved. |
| Held-counter raw indexed read | 821 → **803** (`Game.main` 110 → 92) | Selected. The raw observer accepts the one-instruction `lda base,x` only when the symbolic counter certificate proves the read is inside that loop body and the address consumes the certified counter load. |
| Bottom-tested register loop | 803 → **790** (`Game.main` 88); exact 13-byte copy form | Selected. Preheader→body, update falls through, `cpx #8; bne`; `clv` removed and V proved dead through the calls. The copy-loop case passes on all four profiles. |
| Unsigned guard refinement | Part of 803→790, limited to observer-evidence size lowering | Selected. `ordinal < 64` now bounds the later `>> 3`, so the shift saturation path disappears. `none` keeps its old proofs and output. |
| Read-only call keeps local bounds | 790 → **781** (`keyState` 278 → 269) | Selected. A direct callee with no raw write, platform access, indirect call, escaping address or path store cannot observe a private caller local, so the `column < 8` bound survives the `snapshotCompatible` call and the second shift saturation path disappears. |
| Direct scalar argument delivery | 781 → **757** (`keyState` 269 → 257, `joystickState` 130 → 118) | Selected. A single-read byte stage is retargeted into the callee parameter home and the delivery pair disappears. The retargeted store carries the call span, so the preserved-guard proof keeps the caller's local bounds. Main stays excluded until the typed-pointer caller window accepts the same shape. |
| Residual local reload | 757 → **750** (`keyState` 257 → 250) | Selected in the mixed plan only. A private local stored by the previous instruction and reloaded as the block's last item before its branch keeps only the store. The reference keeps the reload for the byte-window producer proof; `unchanged` skips it only when the selected actually omits it. |
| Parameter-copy propagation | 750 → **746** (`keyState` 250 → 246) | Selected in the mixed plan only. A local initialized from a never-written parameter redirects its direct byte reads to the parameter and removes the copy pair. The observer proves the single local store, the absent parameter store, the copy omission and each redirected read at the same source span. |
| Forwarded byte-window producer | 746 → **740** (`keyState` 246 → 242, `snapshotCompatible` 155 → 153) | Selected. A local reload feeding an adjacent `cmp`/`cpx`/`cpy`/`eor` is removed when the store's producer defines A and N/Z. The byte-window proof accepts the copy-free producer window: the store address equals the compared home and the preceding producer supplies the byte. |
| Row-register fold | 740 → **739** (`keyState` 242 → 241; low-byte 821 → 817) | Selected. A later `ldx local` becomes `tax` at the store, with no call/X clobber between and dead reload N/Z. The correspondence proves the fold and `unchanged` skips the inserted `tax` with the removed reload; every size layout folds consistently. |
| Unused stage reclamation | 0 bytes | Not selected. The unreferenced `argument-stage`/`retained-value` requests carry `payloadBytes 0`; removing them changes neither general nor combined RAM. The general gate is code-driven, not padding-driven. |
| `main` scalar delivery | 0 bytes (not landed) | The blocker is now localized in `incomingPointer`. The keyState snapshot call passes all delivery checks (`at=2`, contiguous, formal stores, jsr label); the joystickState snapshot call fails with `at=-1` because the retargeted port/control stores now occupy the call-span item list before the pointer materialization, and the snapshot pointer goes through the stage/materialization branch rather than the literal-copy branch. The snapshotCompatible trace at `8686` passes the delivery check but fails the deeper stage/materialization check. The fix is to filter the call-span items to the pointer chain (ignore retargeted scalar stores) and extend the stage branch; the composed suffix still needs the moved-store exclusion. |
| Direct raw argument delivery ([#135](https://github.com/blendsdk/blend65/issues/135)) | 863 → 857 at the pre-mixed frontier | Not landed. The remaining `keyState`/`joystickState` argument stores still duplicate a private temporary and the ABI slot. |
| Branch inversion over an empty jump trampoline | One safe site, 3 bytes | Too small for a new CFG rule. |

The next bounded unit is the **resource closure of unused argument stages**:
the delivery rule retargets stores but the predeclared request still consumes
its zero-page/general home, and the general gate is now tighter than the payload
gate. `keyState` entry/row/column materialization (+29) and
`snapshotCompatible` (+13) follow. Extending delivery to `main` is worth about
10 payload bytes but needs the typed-pointer caller window. No limit, oracle,
or source rule changes.

### Step 2.3: Saved measurement and gate

- [ ] 2.3.1 Measure saved 725 on four profiles, complete accounting, behavior and native cases — four-profile VICE
- [ ] 2.3.2 Run the complete owned/root suites and independent output/SFA/platform reviews
- [ ] 2.3.3 Record the saved result in evidence and roadmap; if 725 is not approached, stop for a scope decision

**Phase 2 gate:** saved payload ≤725 and preserved behavior/resources. Failure
stops the plan; no limit rewrite and no benchmark-specific special case.

---

## Phase 3: Acquisition 963

> **Reasoning**: max — asynchronous, raw/MMIO and global-return proof boundaries.

### Step 3.1: Acquisition specification tests

- [ ] 3.1.1 [spec-author] Write acquisition/library behavior, NMI/raw/MMIO, output and native cases — `test/rd08/optimizer-acquisition-output.spec.test.ts`
- [ ] 3.1.2 [spec-author] Verify the acquisition specification cases fail for the expected missing async/raw/return rules; no acquisition implementation is present

### Step 3.2: Asynchronous and raw obligations

**Reference**: [03-02](03-02-rules-and-obligations.md) §Rule Catalogue; RD-08 R8.27–R8.38.

- [ ] 3.2.1 Implement asynchronous borrow/observation obligations using existing route/context facts — `machine/optimization-rules.ts`
- [ ] 3.2.2 Implement raw, MMIO/platform and callback sequence obligations with exact final layouts — `machine/optimization-rules.ts`

### Step 3.3: Aggregate and composed rules

- [ ] 3.3.1 Implement global aggregate return and caller-owned destination proof — `storage/selection.ts`, `machine/optimization-rules.ts`
- [ ] 3.3.2 Compose LowByte/loop/byte-window/capture rules with interrupt-domain obligations — `machine/optimization-rules.ts`, `services/size-observers.ts`

### Step 3.4: Acquisition measurement and gate

- [ ] 3.4.1 Measure acquisition 963 on four profiles with complete B/R/T and behavior — four-profile VICE
- [ ] 3.4.2 Run full compiler/root suites and independent output/SFA/platform reviews
- [ ] 3.4.3 Record the acquisition result and if 963 is not approached, stop for a scope decision

**Phase 3 gate:** acquisition payload ≤963 and all behavior/resource/NMI/MMIO
obligations pass. Failure stops the plan; no source restriction or benchmark-name
rule is introduced.

---

## Phase 4: Balanced and speed

> **Reasoning**: high — mode semantics, cost ordering and public surface.

### Step 4.1: Mode specification tests

- [ ] 4.1.1 [spec-author] Write balanced/speed selection, tie and incomparable-component cases — `test/rd08/optimizer-selection.spec.test.ts`
- [ ] 4.1.2 [spec-author] Verify the balanced/speed specification cases fail for the expected missing mode behavior; no mode implementation is present

### Step 4.2: Mode implementation

- [ ] 4.2.1 Implement balanced no-regression Pareto and speed T→R→B on the same candidate pipeline — `machine/optimization-cost.ts`, `services/size-selection.ts`
- [ ] 4.2.2 Wire manifest/build/CLI acceptance for all four modes only after size stability — `project/manifest.ts`, `services/types.ts`, `packages/cli/src/args.ts`, `packages/cli/src/render.ts`
- [ ] 4.2.3 Verify mode-specific evidence, deterministic selection and none no-decision behavior — selection/evidence tests

---

## Phase 5: Qualification and closeout

> **Reasoning**: high — full evidence, native qualification and independent review.

- [ ] 5.1 Populate debug optimization/rematerialization records for actual applied rules — `services/evidence-records.ts`, `artifacts/debug-evidence-records.ts`
- [ ] 5.2 Complete reproducibility, ACME reconciliation and last-good publication tests — evidence/publication suites
- [ ] 5.3 Run complete install/build/typecheck/test, targeted specs, four-profile VICE and host performance/RSS checks — verification gate
- [ ] 5.4 Obtain independent correctness, semantics/DX, SFA/ABI, platform, machine-code and performance reviews; resolve findings and close the plan

**Final gate:** all acceptance criteria pass; 963/725 are met or the plan is
stopped with a recorded scope decision. Report VICE-verified /
hardware-unverified; no silicon claim.

---

## Rollback and stop rules

- A failed foundation provenance/closure gate stops Phase 1.
- A failed saved 725 gate stops before acquisition and returns to the user.
- A failed acquisition 963 gate stops before balanced/speed release.
- Any need to delete/weaken an oracle, change a frozen file, add a dependency,
  create a new rule module beyond the bounded surface, or increase a line cap
  requires a new Ambiguity Register ruling.
- The last-good generation and published artifacts remain untouched on failure.
