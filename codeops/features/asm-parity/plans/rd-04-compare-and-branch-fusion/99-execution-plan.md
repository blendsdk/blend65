# Execution Plan: RD-04 Compare-and-Branch Fusion

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-19 21:14
> **Progress**: 43/43 tasks (100%) — COMPLETE
> **CodeOps Skills Version**: 3.9.0

## Overview

Five phases per plan-AR #1: terminator infrastructure → translator branch-form framings →
`guards` fixture pre-flip baseline → the atomic flip (condition lowering + SFA + corpus
supersession) → closeout. Phases 1–3 diff no existing golden; phase 4 changes all 14 in one
verify-green unit; the req-AR #22 staging fallback is not used. Each phase follows the
specification-first ordering (spec → red → implement → green → impl tests → verify).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | IL terminator & validation infrastructure | 10 |
| 2 | Translator branch-form framings | 9 |
| 3 | `guards` fixture — pre-flip baseline | 7 |
| 4 | The flip: condition lowering + SFA + corpus supersession | 14 |
| 5 | Closeout | 3 |

**Total: 43 tasks across 5 phases** (no fabricated hour estimates — scope is bounded by the
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

> **Routing note (roadmap):** execution is routed to Opus per the feature roadmap's RD-04 row
> ("Fable (design; exec → Opus)").

---

## Phase 1: IL terminator & validation infrastructure

> **Phase ref**: 267a2150f7ee0f5dd1657d684125f9ad74b4a739

### Step 1.1: Specification tests

**Reference**: 07 ST-9a–d, ST-13 · 03-01 · plan-AR #2, #4
**Objective**: Pin the `brcmp` contract before it exists.

- [x] 1.1.1 Write printer + successor + termination spec cases (ST-9a/9b/9c, ST-13) — `packages/codegen/src/il/print-il.spec.test.ts`, `packages/codegen/src/il/termination.spec.test.ts` (new) ✅ (completed: 2026-07-19 17:01)
      ↳ *Mechanical placement correction:* ST-13 landed in `packages/codegen/src/instr/shim-selection.spec.test.ts` instead of `termination.spec.test.ts`. It is an end-to-end shim-selection case, and that file already owns the compile-and-select harness (`selectedShim`, :72-105); the `il/` home would have duplicated ~60 lines of fake-plugin scaffolding to assert the same thing. Oracle content unchanged.
- [x] 1.1.2 Write dangling-target ICE spec cases for all three branching kinds (ST-9d) — `packages/codegen/src/instr/translate.spec.test.ts` ✅ (completed: 2026-07-19 17:01)
- [x] 1.1.3 Red phase: run the two suites; type errors on the not-yet-existing `brcmp` kind count as red for the type-level cases — document any case that passes ✅ (completed: 2026-07-19 17:01)
      ↳ **Red: 10 failed / 40 passed** across `print-il`, `termination`, `translate` spec suites. Cases that pass today, each by design: ST-13 (asserts today's shim choice survives the phase-4 fold — a preservation guard, green now and expected to stay green); "cannot return when neither fused edge reaches a return" and "silent when every terminator target resolves" (negative cases, vacuously green until `brcmp`/the pre-pass exist).

### Step 1.2: Implementation

**Reference**: 03-01 §Implementation Details
**Objective**: The terminator kind + every consumer that must understand it.

- [x] 1.2.1 Add the `brcmp` union member; add `terminatorTargets()` (exhaustive switch closed by the repo's `default:` never-guard); amend `cfg.ts`'s "pure data" module header (records + this one pure helper) — `packages/codegen/src/il/instruction.ts`, `packages/codegen/src/il/cfg.ts` ✅ (completed: 2026-07-19 17:06) — also barrelled from `il/index.ts`
- [x] 1.2.2 Render `brcmp` in the printer — `packages/codegen/src/il/print-il.ts` ✅ (completed: 2026-07-19 17:06)
- [x] 1.2.3 Rebase the termination walk on `terminatorTargets` (keep the constant-`brcond` taken-edge rule; `brcmp` = both edges); update the dangling-label comment — `packages/codegen/src/il/termination.ts` ✅ (completed: 2026-07-19 17:06)
- [x] 1.2.4 Add the `validateTerminatorTargets()` pre-pass beside `prescanAll()` — `packages/codegen/src/instr/translate.ts` ✅ (completed: 2026-07-19 17:06)
- [x] 1.2.5 Green phase: ST-9a–d and ST-13 pass; fix implementation only ✅ (completed: 2026-07-19 17:06) — 50/50 green across the four touched spec suites

### Step 1.3: Implementation tests & hardening

- [x] 1.3.1 Impl tests: helper edge cases (`ret`/`unreachable` empty, order stable), pre-pass on ICE-degraded functions — `packages/codegen/src/il/termination.impl.test.ts`, `packages/codegen/src/instr/translate.impl.test.ts` ✅ (completed: 2026-07-19 17:09)
      ↳ *Behavioral note:* the diagnostic bag dedups on `(code, span)` and translator ICEs are span-less, so a compile surfaces ONE `Unexpected` ICE regardless of how many dangling targets exist — pre-existing, repo-wide (`iceUnsupported` already behaves this way). The pre-pass runs before emission, so a dangling target now wins that key over a later unsupported-op ICE. Both are compiler bugs and both fail the build; the impl tests pin the actual order rather than assuming per-miss reporting.
- [x] 1.3.2 Full verification ✅ (completed: 2026-07-19 17:09) — install/build/typecheck/lint/test all green; goldens unchanged

**Deliverables**:
- [x] `brcmp` exists, printable, terminable, validated; nothing emits it; zero golden diffs
- [x] All verification passing

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

**Post-phase quality review** (phase-reviewer, lenses: correctness/maintainability/standards + api-surface):
1 major, 2 minor. All accepted and fixed in a follow-up commit; re-review clean.
- **RV-001 (major, accepted):** `translateTerminator` had no `brcmp` arm and no never-guard, so a
  well-formed fused terminator would emit no control transfer at all with an empty diagnostic bag.
  Scheduled for 2.2.1, but pulled forward so phase 1 is safe standalone and the never-guard makes
  the phase-2 work compiler-forced. Added a `brcmp` arm raising a new `iceNoTranslation` ICE plus
  the `default:` never-guard.
- **RV-002 (minor, accepted):** `terminatorReads` returned `[]` for `brcmp` through a ternary
  chain — the same private per-consumer enumeration this phase removed elsewhere. Converted to an
  exhaustive never-guarded switch returning `[left, right]`, completing 2.2.1's first clause early.
- **RV-003 (minor, accepted):** a diff-added double blank line in `translate.spec.test.ts`; fixed
  without touching the file's pre-existing formatting drift.

---

## Phase 2: Translator branch-form framings

> **Phase ref**: 2bb0abfc18e70a5bb5a542ec80993c61a20d9424

### Step 2.1: Specification tests

**Reference**: 07 ST-10a–c, ST-6 · 03-02
**Objective**: Byte-exact branch-form expectations per framing × polarity × operand order, both branch senses (inversion guard).

- [x] 2.1.1 Write ST-10a matrix cases (constructed IL with `brcmp` terminators) — `packages/codegen/src/instr/translate-brcmp.spec.test.ts` ✅ (completed: 2026-07-19 18:05)
      ↳ *File placement deviation*: the plan named `translate.spec.test.ts`, which is already 604 lines; the full 40-row matrix would push it past 1 000 and breach the standards' file-size rule. The repo already splits translator spec tests by concern (`translate-expressions`, `translate-indexed`, `translate-indirect`, `translate-call`, `translate-t1`, `translate-interrupt`), so ST-10a–c + ST-6 live in a new sibling `translate-brcmp.spec.test.ts`. No expectation changed — only where it lives.
- [x] 2.1.2 Write ST-10b (signed sequence), ST-10c (deferred-load fold), ST-6 (value form byte-identical) — `packages/codegen/src/instr/translate-brcmp.spec.test.ts` ✅ (completed: 2026-07-19 18:05)
      ↳ ST-6 is authored **beside** each framing's fused twin rather than in `translate-expressions.spec.test.ts`: the oracle's whole purpose is to prove one compare core feeds two tails, and splitting the pair across files would hide exactly the polarity divergence it guards against. The pre-existing loose comparison assertions in `translate-expressions.spec.test.ts` stay as they are.
- [x] 2.1.3 Red phase verified and documented ✅ (completed: 2026-07-19 18:05)
      ↳ **51 fused cases fail, 6 value-form cases pass.** Every fused case fails on `bag.hasErrors()` — the phase-1 `no translation for 'brcmp terminator'` ICE fires before any byte expectation is reached, so the failure is loud rather than a silently empty block. The 6 ST-6 value-form cases pass green from the start, which is the point: they pin today's bytes so the phase-2 refactor cannot move them.

### Step 2.2: Implementation

**Reference**: 03-02 §Implementation Details
**Objective**: Shared flag-producing cores, two tails; `brcmp` dispatch; use-count plumbing.

- [x] 2.2.1 Extend `terminatorReads` with `brcmp` `[left, right]`; add the `translateTerminator` dispatch case and close its switch with the repo's `default:` never-guard (unhandled kind = compile error, not silent no-emission) — `packages/codegen/src/instr/translate.ts` ✅ (completed: 2026-07-19 18:10)
      ↳ *Partly landed in phase 1* (review finding RV-001/RV-002): `terminatorReads` and both never-guards were already done; this task replaced the placeholder `brcmp` ICE arm with the real dispatch. `iceNoTranslation` stays live — the `default:` never-guard is now its only caller.
- [x] 2.2.2 Refactor the 8-bit framings (unsigned/equality inline, `byteSignedOrdered`) into core + value/branch tails — `packages/codegen/src/instr/translate.ts` ✅ (completed: 2026-07-19 18:10)
- [x] 2.2.3 Refactor the three word framings (`wordEquality`, `wordUnsignedOrdered` — internal labels become real targets, `wordSignedOrdered`) into core + tails — `packages/codegen/src/instr/translate.ts` ✅ (completed: 2026-07-19 18:10)
- [x] 2.2.4 Green phase: ST-10a–c, ST-6 pass; fix implementation only ✅ (completed: 2026-07-19 18:10) — 57/57 green on the first run; no spec test touched

**Design as landed** (deviates from 03-02 in naming only, not behavior):
- A `CmpTail` discriminated union (`value` → materialise into `dest`; `branch` → the two block
  edges) is threaded through `translateComparison` and all five framings. 03-02 sketched a separate
  `translateComparisonBranch` entry point; a single dispatcher taking the tail is DRY-er and makes
  "one compare sequence, two consumers" literal rather than a convention two functions must uphold.
- `emitCmpTail(tail, branch, flag)` is the shared consumer for the four single-decision framings.
  Its `flag: "carry" | "zn"` argument is what preserves the existing split between the compact
  carry materialisation and the branch-first Z/N one; the branch tail ignores it entirely.
- `wordUnsignedOrdered` is the one framing whose two tails differ structurally, so its high-then-low
  carry decision is factored into `wordUnsignedDecision(...)` and each tail calls it: the fused path
  passes the real block labels and appends `JMP false`, and the `LDA #$01`/`LDA #$00` tail is gone.
- `clearRegs()` moved from after materialisation to immediately after the compare core in
  `wordEquality`/`wordSignedOrdered`. Equivalent — the materialisation neither reads nor writes the
  residency mirror — and it keeps the "A holds a compare residue, not a result" fact next to the
  code that makes it true.
- Generated-label numbering is unchanged on every value path (verified by the six ST-6 byte-exact
  cases), so no golden can move.

### Step 2.3: Implementation tests & hardening

- [x] 2.3.1 Impl tests: `_cmp` label allocation, residency after fused blocks, one read per polled register, immediate-only totality — `packages/codegen/src/instr/translate.impl.test.ts` ✅ (completed: 2026-07-19 18:14)
      ↳ `gt`/`le` swaps and memory-RHS word framings moved to the spec tier instead: the ST-10a matrix already asserts all four swapped forms and both RHS kinds byte-exactly at every width, so an impl-tier restatement would be duplicate coverage, not extra. The impl tier took the four internals the oracles genuinely cannot see.
- [x] 2.3.2 Full verification + confirm zero golden diffs (nothing emits `brcmp` yet) ✅ (completed: 2026-07-19 18:14) — install/build/typecheck/lint/test green (1 049 tests); `git status` clean of any golden or `spec/` path

**Deliverables**:
- [x] All five framings translate `brcmp` to fused branch form; value form byte-identical
- [x] All verification passing

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

**Post-phase quality review** (phase-reviewer, lenses: correctness/maintainability/standards + api-surface):
0 critical, 0 major, 2 minor. Both accepted and fixed in a follow-up commit; re-review clean
("no findings" — it re-derived the new equality edges by hand, checked the cycle claims against
real 6502 timings, and confirmed the four rewritten oracle rows were derived from semantics
rather than copied from the implementation, with all six ST-6 rows untouched).
The reviewer independently re-derived the 6502 semantics for all five framings in both senses
(including the swapped `gt`/`le` forms) and confirmed polarity, value-form byte identity —
`_cmpN` allocation order AND count — the hoisted `clearRegs()`, the `flag` argument at every
call site, `iceNoTranslation` still reachable, and that no pre-existing spec test was touched.
- **RV-001 (minor, output parity — accepted, fixed):** the fused 16-bit equality framing emitted a
  branch-to-branch on the differing-low-byte path (`BNE _cmp0 … _cmp0: BEQ true / JMP false`) where
  a hand-writing 6502 developer branches straight to the decided edge. Same bytes, one fewer
  generated label, 5 cycles cheaper for `eq` (3 for `ne`) on that path, never slower on any path —
  and low-bytes-differ is the common early-out for 16-bit positions and counters. 03-02 had
  specified the join to stay in both forms, so the design doc and four ST-10a oracle rows were
  corrected together under plan-AR #10; the value form keeps its join (its 0/1 tail reads Z) and
  its ST-6 byte-exact case is unchanged. Fixed now rather than filed because nothing emits `brcmp`
  yet — the last moment the change is golden-invisible — and because phase 3's twin would otherwise
  bake the gap into the parity baseline.
- **RV-002 (minor, maintainability — accepted, fixed):** the fused branch tail left the A-residency
  mirror claiming a temp was in A after `SBC`/`EOR` had destroyed it — inert only because
  `resetBlockState()` clears at the next block. Added `clearRegs()` to `emitCmpTail`'s branch arm,
  which the value form never reaches, so the fix is provably emission-neutral.

---

## Phase 3: `guards` fixture — pre-flip baseline

> **Phase ref**: 56a645fc0464f8a217d4d7736fc461d60252b79b

### Step 3.1: Fixture (spec-first: observables are the spec)

**Reference**: 07 ST-12 · 03-04 §The guards fixture · plan-AR #1, #5
**Objective**: The behavioral witness exists and is VICE-green BEFORE the flip.

- [x] 3.1.1 Write the VICE observables spec + testing module skeleton (assertions from 03-04's four hazard shapes) — `packages/test-harness/src/guards.spec.test.ts`, `packages/test-harness/src/testing/guards.ts` ✅ (completed: 2026-07-19 18:47)
- [x] 3.1.2 Red phase: suite fails (no fixture source yet) ✅ (completed: 2026-07-19 18:47)
      ↳ The skeleton's `GUARDS_MAIN_SRC` is an empty `module Main;` — no `main`, so no binary is produced and `setupEmulator` fails loudly rather than the suite silently passing on an unbuilt program.
- [x] 3.1.3 Author the fixture source (four hazard shapes, deterministic observables) + inline verbatim; observables green on local VICE — `examples/guards/main.blend`, `packages/test-harness/src/testing/guards.ts` ✅ (completed: 2026-07-19 18:49)
      ↳ **Determinism of the `peek($DC00)` guard (authoring decision).** 03-04 pins the port read at `$DC00`, but the KERNAL's keyboard scan rewrites CIA-1 port A every jiffy, so a stock machine makes that read non-deterministic and neither the observable nor the twin could pin it. The fixture therefore opens the way a frame-locked C64 game opens: silence CIA-1 (`$DC0D` ← `$7F`), drive port A (`$DC02` ← `$FF`), park it (`$DC00` ← `$7F`). The guard then reads back exactly 127 on every frame and on the twin. Verified on VICE 3.10, and verified to be a real assertion: flipping the `$0402` expectation fails with `Expected memory at $402 to be [0x04], but it was [0x03]`.
      ↳ **Observables chosen to discriminate, not merely to pass.** `$0402` is the signed velocity verdict — read as unsigned bytes, `dx` (-3) would be 253 and the cell would hold 4 instead of 3, so a framing regression is a red test rather than a silent one. `$0400` counts window hits across eight probes, which exercises both edges of the compound guard AND its short-circuit (probe 0 never reaches the upper bound) in a single frame.
      ↳ Short-circuit *suppression* is not given a behavioral witness here: `peek` has no observable side effect, so a suppressed clause cannot be seen from memory. The corpus already proves suppression behaviorally in `slice6` (the `bump()` witness); the guards fixture proves it structurally in the golden.
- [x] 3.1.4 Add the golden suite; generate + hand-review the PRE-FUSION baseline golden (it documents today's defect — reviewed as such) — `packages/test-harness/src/golden-guards.spec.test.ts`, `packages/test-harness/test/golden/guards.asm.golden` ✅ (completed: 2026-07-19 18:50)
      ↳ **Hand review of the baseline (203 lines).** It records today's defect exactly as expected: all six comparisons materialise 0/1 and re-test it (`_cmp0`…`_cmp11`, 24 references); both short-circuits round-trip through synthetic frame slots (`0sc0`/`0sc1`, 8 references) — the traffic AC-3 forbids; `!active` emits the `CMP #$00` residue AC-4 calls out; the signed compare builds the correct `SEC · SBC · BVC · EOR #$80` core and then throws the flags away to materialise (AC-5); `while (true)` emits `LDA #$01 · BNE · JMP` rather than a bare jump (AC-2); the poll block is 9 instructions / 25 static cycles (AC-1's "was").
      ↳ The suite's landmark assertions were written to hold in BOTH worlds — one `LDA $DC00`, ordered after the `armed` test (ST-7); one `LDA $D012`; both window bounds in source order; the N⊕V correction present; the four verdict cells written. The fused-idiom assertions (ST-3/4/5) belong to the flip and are authored in phase 4, where they can be true.

### Step 3.2: Twin + corpus registration

**Reference**: 03-04 §Registration · plan-AR #1
**Objective**: The pair is a full corpus citizen with a measured "before" row.

- [x] 3.2.1 Author the hand-written twin (blind to fused output — the parity bar) + twin tier green via the shared observables — `packages/test-harness/test/golden/guards.twin.asm` ✅ (completed: 2026-07-19 18:56)
      ↳ 128 bytes / 151 static cycles against the generated 347 / 404. It walks the probe down in A and counts hits in Y (never a store), holds all five state bytes in zero page, and decides each guard with one compare and one branch — including the `SEC · SBC · BVC · EOR #$80` correction, where it branches on `BPL` instead of building a boolean. Landed the identical observable set on VICE 3.10 first run.
      ↳ Authored against the source's semantics, not against generated output: the fused form does not exist yet, and the pre-fusion golden was deliberately not consulted while writing it.
- [x] 3.2.2 Register: `twins.json` pair + routed divergence groups; `budgets.json` bytes + compound-guard window (current values, ratchet); regenerate `SCOREBOARD.md` — `packages/test-harness/test/golden/twins.json`, `budgets.json`, `SCOREBOARD.md` ✅ (completed: 2026-07-19 18:57)
      ↳ Two computed divergence groups, all routed: **instruction selection** → #50 (every guard materialises and re-tests), #51 (JMP 29 vs 1), #53 (probe/count in frame memory vs A/Y), #52 (counter bump vs `INC`), #59 (unreachable `RTS` past a non-returning frame loop), #49 (state staged through the absolute frame vs zero page); **layout** → #51.
      ↳ Budgets are the exact current figures, not headroom: **347 bytes** and a `compoundGuard` window of **43 static cycles** — both established by probing one below and reading the ratchet's own failure. The window carries a hand-derivation comment beside `EXPECTED_POLL_ITERATION_MAX_CYCLES` and its own equality test, so the figure is derived rather than transcribed; 16 of those 43 cycles exist only to build a 0/1 the join reads straight back.
- [x] 3.2.3 Full verification + local VICE fixture & twin tiers + examples-sync green ✅ (completed: 2026-07-19 18:58)
      ↳ install/build/typecheck/lint/test green — 1 051 tests (cli 47, compiler 113, codegen 616, test-harness 295, root boundary 33), including the local VICE fixture tier, the 18-case twin tier, examples-sync (19), and the scoreboard freshness gate. Thirteen pre-existing goldens byte-identical; `git status --porcelain spec/` empty. Prettier: the three new files and both JSON assets are clean; the drift `--check` reports in `budgets.spec.test.ts` and `twins.spec.test.ts` is pre-existing and outside the touched ranges, so it was left alone.

**Deliverables**:
- [x] `guards` pair committed with pre-fusion golden, twin, budgets, scoreboard row
- [x] All verification passing

**Measured "before"** (the baseline the flip ratchets against, from the committed scoreboard):
`guards` 347 bytes generated vs 128 hand-written (2.71×), 404 static cycles vs 151 (2.68×);
`compoundGuard` window 43 static cycles.

**Post-phase quality review** (phase-reviewer, lenses: correctness/maintainability/standards + api-surface):
1 critical (protocol flag, discharged), 0 major, 2 minor — both minor accepted and fixed in a
follow-up commit. The reviewer hand-executed the twin against all five observables, re-assembled
both sides through ACME to confirm 347/130 bytes, re-derived the 43-cycle window and the
"16 of those 43" claim, re-ran `twin-diff` to confirm every computed divergence group is routed,
and checked that each golden-suite landmark survives the fused shape phase 4 will produce.
- **RV-001 (critical by protocol — discharged):** three `*.spec.test.ts` files appear in the phase
  diff, which the reviewer's protocol flags automatically. Verified against the diff: all three are
  purely additive registrations of the new pair (an import plus a builder/pair/module row, one new
  `it()`, and a "13 → 14" count comment). No existing assertion, expectation, or oracle value is
  altered anywhere in the diff, and registering a corpus pair cannot be done without touching those
  registries — they are named deliverables of task 3.2.2.
- **RV-002 (minor, output parity — accepted, fixed):** the twin's BASIC stub carried `$0c,$08` as the
  next-line link where the correct address is `$080B` — the compiler's own stub emits `!word $080B`.
  Inert under `RUN` (the `SYS` never returns) but `LIST` would walk into the code. Fixed in the
  guards twin; the same off-by-one is present in all fourteen pre-existing hand twins and is left
  for a separate change, since correcting them is byte-neutral but touches the whole corpus on the
  eve of the flip.
- **RV-003 (minor, output parity — accepted, fixed):** the twin's probe walk kept the counter in X,
  paying `TXA`/`TAX` on every iteration to step it — but the probe indexes nothing, so it never
  needs to leave A. Rewritten to walk in A: 2 bytes and 4 static cycles leaner, identical
  observables. This matters more than its size: the twin IS the bar the compiler is measured
  against, so a loose twin flatters the ratios the flip is supposed to move. The scoreboard,
  `twins.json` notes and the measured "before" above were regenerated from the tighter twin.
- **RV-004 (minor, output parity — raised on the fix diff, accepted, fixed):** the re-review
  confirmed both fixes correct and fully propagated, and found one residue: the probe walk still
  ascended and therefore still paid an explicit `CMP #64` to bound itself, where the count is
  order-independent and the canonical 6502 idiom walks DOWN and falls out on the borrow. Adopted —
  2 more bytes and 2 more static cycles, taking the pair to 128 / 151, identical observables on
  VICE. The corpus already establishes descending walks as twin practice (the balloon twin's copy
  loop counts `LDX #62 … DEX / BPL`). Side effect: the hand side now issues two `SBC`s, so the
  mnemonic counts differ before the tool drills into addressing modes — the `addressing modes`
  divergence group disappeared, and its zero-page placement note moved onto the instruction
  selection group so the observation is not lost with the group.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (+ local VICE tiers)

---

## Phase 4: The flip — condition lowering + SFA + corpus supersession (atomic)

> **Phase ref**: a0065443c030f42baeb7ab99879fe854e18b9249

### Step 4.1: Specification tests

**Reference**: 07 ST-8a–g, ST-14, ST-15 · 03-03
**Objective**: The condition-position contract pinned on both packages before the flip.

- [x] 4.1.1 Write lowering spec cases ST-8a–g + ST-14 — `packages/codegen/src/il/control-flow-lowering.spec.test.ts`, `packages/codegen/src/il/switch-lowering.spec.test.ts`
- [x] 4.1.2 Write SFA adapter spec cases ST-14/ST-15 (position-dependent counts, structural definition) — `packages/frontend/src/sfa/model-adapter.spec.test.ts`
- [x] 4.1.3 Red phase: verify the new cases fail against today's materializing lowering

**Step 4.1 notes** (authored implementation-blind by two spec-test authors, one per package;
both appended only — no pre-existing test edited, since the superseded oracles are 4.3.1's job):

- 12 cases in `control-flow-lowering.spec.test.ts` + 1 in `switch-lowering.spec.test.ts`
  (ST-8a, ST-8b × 4 statement kinds, ST-8c, ST-8d, ST-8e, ST-8f × 2, ST-8g, ST-14) and 2 in
  `model-adapter.spec.test.ts` (ST-14, ST-15).
- **Red**: 10 codegen + 1 frontend (ST-15: today's adapter claims `0sc0` for the
  condition-position `&&`, pushing the `?:` to `0sc1`). All 618 pre-existing codegen and 890
  pre-existing frontend tests still pass.
- **Green by design, not weakened**: ST-8g and codegen ST-14 pin the boundary of the change —
  value position must keep today's compare-plus-store and its slot — so they pass now and turn
  red only if fusion leaks out of condition position. Frontend ST-14 is the same guard on the
  adapter side. Both assert the FULL synthetic-slot list, so an extra or missing slot fails.
- Deviation: the frontend author placed its new imports mid-file next to the appended block;
  moved to the file's top import group (imports-at-top standard) and re-wrapped to the
  configured 100-column width.

### Step 4.2: Implementation (lowering + adapter, in step)

**Reference**: 03-03 §Implementation Details · req-AR #22 · plan-AR #3
**Objective**: Every condition statement lowers through `lowerCondition`; slots agree.

- [x] 4.2.1 Implement `lowerCondition` + the shared comparison-operand/promotion helper factored from `lowerExpr` — `packages/codegen/src/il/lower.ts`
- [x] 4.2.2 Rewire `lowerIf`/`lowerWhile`/`lowerDoWhile`/`lowerFor` predicate/`lowerSwitch` dispatch onto it — `packages/codegen/src/il/lower.ts`
- [x] 4.2.3 Make the adapter's slot predicate position-dependent per the structural definition (no codegen import — R15) — `packages/frontend/src/sfa/model-adapter.ts`
- [x] 4.2.4 Green phase on unit tiers: ST-8a–g, ST-14, ST-15 pass; fix implementation only

**Step 4.2 notes**:

- `lowerCondition` handles literal / `!` / comparison / `&&` / `||` and falls back to
  `lowerExpr` + `brcond` for everything else; the fallback is byte-identical to today's
  condition handling, so non-comparison conditions do not move.
- `COMPARISON_OP_TO_IL` is now the single source of truth for which operators are
  comparisons: `BINARY_OP_TO_IL` spreads it and `COMPARISON_RESULT_OPS` derives from its
  values, and its value type is the fused terminator's own op union — so the value form and
  the branch form cannot disagree about the comparison set, and no cast is needed to build
  the terminator.
- `lowerComparisonOperands` is the shared operand/promotion helper; the value form now routes
  through it, which is what keeps the promoted `type` (and left-first order) identical
  between the two forms.
- Deviation from 03-03: `compareCounter` was not kept alongside a new emitter — it became
  `branchOnCounter` (loads the counter, terminates `brcmp`). Its only caller was the for-loop
  predicate, so keeping the value form would have left dead code.
- `lowerIf` now reserves its labels BEFORE lowering the condition (the recursion needs the
  targets). For a comparison condition the label numbering is unchanged; for a `&&`/`||`
  condition it shifts, since the short-circuit's blocks are minted after the arms' labels
  rather than before.
- Adapter: the kind-blind Proxy walk became a recursion threading an `inCondition` flag,
  with `if`/`while`/`do-while`/`!`/`&&`/`||` enumerating their own children in the same order
  the generic walker uses and everything else delegating to `walkChildren` at value position.
  `@blend65/core` remains its only import (R15 intact).

### Step 4.3: Corpus supersession (same change — req-AR #24)

**Reference**: 03-04 §Corpus supersession · req-AR #12, #17, #24
**Objective**: Every tier asserts the fused idiom; every committed number is current.

- [x] 4.3.1 Rewrite pre-existing tests asserting the superseded materialize idiom (grep-enumerate per 03-04 §1; sanctioned oracle supersession) — codegen + frontend test files listed there
- [x] 4.3.2 Regenerate all 14 goldens (`UPDATE_GOLDEN=1`; the balloon pair is twin-only); hand-review each diff with its twin beside it (ST-1/2/3/4/5/7 shapes; Prime Directive read) — `packages/test-harness/test/golden/*.asm.golden`
- [x] 4.3.3 Tighten `budgets.json` to the new exact values (incl. locally re-measured phase-stable measured windows — balloon frameUpdate, req-AR #15 addendum); re-run `twin-diff` and update `twins.json` routing blocks for the changed divergence-group set (req-AR #18 — unrouted-group gate must pass); regenerate `SCOREBOARD.md`; CI freshness green — `packages/test-harness/test/golden/budgets.json`, `twins.json`, `SCOREBOARD.md`
- [x] 4.3.4 Local VICE fixture + twin tiers green; assert ST-12 (`guards` observables identical to phase 3) — local run record
- [x] 4.3.5 Full verification (includes ST-11 boundary tier)

**Step 4.3 notes**:

- **Supersession surface was 5 files, not the 9 anticipated** — the enumerated list came from
  running the tiers rather than from grep, so only oracles that actually asserted the old shape
  moved: `il/control-flow-lowering.spec.test.ts` (5 cases), `il/switch-lowering.spec.test.ts`
  (2), `il/control-flow-lowering.impl.test.ts` (2), `il/switch-lowering.impl.test.ts` (1),
  `instr/switch-translate.spec.test.ts` (1). Each rewrite changed only the assertion naming the
  terminator kind; every surrounding block-shape assertion was left untouched.
  `instr/translate.spec.test.ts`, `instr/translate-expressions.spec.test.ts`,
  `instr/generate.golden.spec.test.ts`, `instr/multiblock-translate.impl.test.ts`,
  `il/print-il.golden.spec.test.ts` and the frontend SFA tests needed NO change — they pin the
  value form, which is unmoved.
- **8 of 14 goldens changed**; 6 are byte-identical. `slice6` is the load-bearing one: it is
  entirely value-position comparisons and short-circuits (`let cond: boolean = (a < base) && (s < 0)`,
  `?:`), and its golden not moving by one byte is the corpus-level evidence that fusion did not
  leak out of condition position.
- **Residual `_cmp` labels: 2, both in `guards`** — the signed compare's overflow-correction
  label, which the hand-written twin carries too (`sign:`). Every other `_cmp` label in the
  corpus is gone.
- **Budget window semantics**: the guards `compoundGuard` window had to move its `toLabel`
  (`Main_main_L10` → `Main_main_L9`). Block layout renumbered, and the old label pair would have
  silently measured a DIFFERENT region (both clauses **plus** the then-body, 39 cycles) — a
  meaningless before/after. The new pair spans the same thing the phase-3 window did: both
  clause blocks, lower-bound test to the block the guard admits to.
- **`test/gen-parity-scoreboard.spec.test.ts`**: two assertions hard-coded balloon's measured
  `162`, so re-measuring failed a test whose stated intent is "measured columns come from
  committed data". Both now READ the committed manifests and assert the scoreboard carries those
  values — the wiring contract, which still fails if the generator stops sourcing either file.
  Also added `guards` to `CORPUS_PAIRS`, a phase-3 omission that left the committed scoreboard's
  guards row unchecked.
- **ST-12 holds**: `packages/test-harness/src/testing/` and `examples/` are untouched in this
  phase's diff, so the `guards` observable table is byte-identical to phase 3, and the VICE
  fixture suite passes against it. All 15 twin pairs green, both VICE fixture suites green.

### Step 4.4: Implementation tests & hardening

- [x] 4.4.1 Impl tests: lowering nests (`!!`, mixed `&&`/`||`, `else if`, `downto`, poisoned types), adapter deep nesting — `packages/codegen/src/il/control-flow-lowering.impl.test.ts`, `packages/frontend/src/sfa/model-adapter.impl.test.ts`
- [x] 4.4.2 Full verification

**Step 4.4 notes**: 6 lowering cases (`!!b` lowering byte-identical to `b`; `&&` under `||` and
`||` under `&&`; an undeclared-name condition that must not throw; a word-discriminant switch
stamped `i16u`; and the cross-package agreement case below) + 4 adapter cases (nested
`&&`/`||` in one condition; a `while` condition vs its body; a `&&` under a condition's
comparison; a short-circuit in the module-initializer stream, which has no enclosing statement).
The agreement case is the important one: `if ((a && b) == true)` puts a short-circuit one edge
BELOW a condition, where both the planner and the lowering must still claim — if either side
disagreed the claim would land on a slot the frame does not have, so the end-to-end
zero-ICE assertion is a real drift detector, not a smoke test.

**Deliverables**:
- [x] The corpus compiles, asserts, and measures the fused idiom end to end; no `0sc` claims in condition position; verify-green
- [x] All verification passing

**Measured "after"** (phase-3 baseline → phase-4, from the regenerated `SCOREBOARD.md`):

| Pair | Bytes gen | Cycles gen | Bytes ratio | Cycles ratio |
| ---- | --------- | ---------- | ----------- | ------------ |
| guards | 347 → **263** | 404 → **305** | 2.71× → **2.05×** | 2.68× → **2.02×** |
| rasterpoll | 88 → **75** | 102 → **87** | 2.44× → **2.08×** | 3.09× → **2.64×** |
| balloon | 772 → **729** | 892 → **843** | 3.08× → **2.90×** | 3.60× → **3.40×** |
| **corpus total** | 4172 → **3896** | 5340 → **5023** | 4.53× → **4.23×** | 5.87× → **5.53×** |

Windows: `guards` compoundGuard 43 → **24** static cycles (‑44%, same region);
`rasterpoll` pollIter 25 → **15**, of which the walked polling path is **12** — RD AC-1's
≤12 bound met exactly; `slice8b` copyLoop 67 → **60**; `balloon` frameUpdate static 269 → **235**,
measured 162 → **133** (‑18%).

Routing: the #50 structural rows are GONE from all three pairs that carried them —
`rasterpoll`'s `BNE` divergence disappeared from the computed group set entirely (was 3 vs 1),
`guards` fell from BNE 10 vs 2 to 3 vs 2, `balloon` from 11 vs 3 to 5 vs 3. That disappearance
is the evidenced fix. The residual branch-polarity spread (guards BMI 1 vs 0 / BPL 0 vs 1;
balloon BEQ 0 vs 2 / BPL 0 vs 1) was folded into each pair's existing #51 note — the hand
version picks the polarity that falls through, which is block layout, not fusion.

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` (+ local VICE tiers)

### Post-phase quality review

Reviewer on the phase diff (`a006544..HEAD`), lenses: correctness · maintainability · standards ·
api-surface. **2 findings, both 🟡 MINOR** — no CRITICAL/MAJOR, so no execution pause.

| ID | Lens | Verdict | Disposition |
| -- | ---- | ------- | ----------- |
| RV-001 | maintainability | stale `lowerFor` doc comment still said the continue predicate branched via `brcond` | **accepted + fixed** — reworded to the fused form, matching the sibling docs updated in 4.2.2 |
| RV-002 | correctness | a `switch` on a slot-claiming discriminant (a `?:`) ICEs: the planner counts the site once, the dispatch chain re-lowers it per case value and claims once per test | **accepted → filed as [#66](https://github.com/blendsdk/blend65/issues/66)** |

RV-002 notes: reproduced independently (`switch (a ? 1 : 2)` → `E90001 … slot '0sc1' missing
from the frame`, with a clean analysis bag), then reproduced AGAIN in a throwaway worktree at
`a006544` to confirm it is long-standing rather than a regression from this phase. Not fixed
here because the fix — lowering the discriminant once and letting the chain re-read it — is a
switch-lowering change with its own golden consequences, and folding it into the flip would
blur what this phase's corpus diff means. It fails loudly rather than mis-addressing, which is
the drift design working as intended.

Reviewer also noted the phase range contains a third commit, `46a1809 docs(matrix)` — confirmed
as the user's own unrelated docs-data work committed mid-session, not part of this phase.

Explicitly cleared by the review: the two-sided slot rule (the adapter's hand-rolled child
enumeration matches the core walker's field order, including do-while's body-before-condition);
short-circuit semantics in every nesting, incl. the `guards` CIA read executing only when
`armed` holds; 6502 branch polarity across all fused goldens; spec-test integrity (every touched
oracle additive or a sanctioned supersession); R15; and api-surface (nothing exported changed —
all three new functions are module-private).

---

## Phase 5: Closeout

### Step 5.1: Delta record, AC walk, sync

**Reference**: RD AC-1…AC-10 · 03-04 §Closeout delta record · plan-AR #7
**Objective**: Evidence recorded where the initiative tracks it.

- [x] 5.1.1 Produce the delta record (phase-3 vs phase-4 scoreboard diff + `rasterpoll`/`guards` windows) and post the area report on issue #50 (tick its checklist) — GitHub #50
- [x] 5.1.2 Walk RD-04 AC-1…AC-10 against the landed state; record the walk in the RD's checkboxes — `codeops/features/asm-parity/requirements/RD-04-compare-and-branch-fusion.md`
- [x] 5.1.3 Roadmap sync (RD-04 row → Done per lifecycle) + final full verification — `codeops/features/asm-parity/00-roadmap.md`

**Step 5.1 notes**:

- Area report posted as [issue #50 comment](https://github.com/blendsdk/blend65/issues/50#issuecomment-5017028398):
  the per-fixture before/after table, all five measured windows, the twin-diff group
  disappearance, and an explicit account of what is still divergent and which issue owns it
  (#51 layout — the dominant remainder — plus #52, #53, #49).
- Deviation: the task says "tick its checklist", but #50's Acceptance section is plain
  bullets, not checkboxes — there was nothing to tick in place. The four acceptance items are
  instead answered as a ticked list inside the posted comment.
- **#50 closed as completed** on the user's instruction, after the area report was posted, with
  a closing note pointing at the landing commits and handing the residual divergence to #51
  (dominant), #52, #53 and #49.
- The AC walk (RD §Acceptance walk) cites committed artifacts per criterion — golden regions,
  byte/cycle arithmetic, spec-test homes — rather than asserting compliance. All 10 ticked.
- The known limitation (#66) is recorded in the RD alongside the walk so it travels with the
  requirement rather than living only in this plan.

**Deliverables**:
- [x] Area report posted; ACs walked; roadmap current
- [x] All verification passing

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## Dependencies

```
Phase 1 (brcmp exists + validated)
    ↓
Phase 2 (translator understands brcmp)      — needs the type
    ↓
Phase 3 (guards baseline)                   — needs a working compiler, pre-flip
    ↓
Phase 4 (the flip + supersession, atomic)   — needs 1+2 (emitting brcmp must translate) and 3 (behavioral witness)
    ↓
Phase 5 (closeout)                          — needs the measured before/after
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All verification passing (plan-AR #6 command; local VICE tiers for phases 3–5)
3. ✅ No warnings/errors
4. ✅ No dead code — the value-form tails remain reachable (value contexts); nothing else unused
5. ✅ Security posture per the RD: dangling-target ICE live; malformed terminators unrepresentable; framing × polarity inversion guard in place
6. ✅ Documentation updated (JSDoc on new exported symbols; RD AC boxes walked)
7. ✅ RD-04 AC-1…AC-10 all pass
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
