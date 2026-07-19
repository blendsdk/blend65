# Ambiguity Register — RD-05 Block Layout (plan)

> **Status**: ✅ GATE PASSED — all 30 items resolved (6 at the plan gate, 18 at preflight, 6 at execution)
> **Feature**: asm-parity · **Implements**: asm-parity/RD-05
> **Created**: 2026-07-19 · **Extended**: 2026-07-20 (preflight)
> **CodeOps Skills Version**: 3.10.0

This register covers ambiguities surfaced while **planning** RD-05. The design-level
decisions (AR #26–#33) were resolved during requirements authoring and live in
`../../requirements/00-ambiguity-register.md`; they are not re-litigated here. Numbering
continues that sequence so a single `AR #n` is unambiguous across the feature.

Two of the six items below are **RD gaps found by codebase sweep, not by reading the RD** —
artifacts the requirement's "label-anchored artifacts" and "affected spec oracles" lists did
not enumerate. Both would have surfaced at red-test time or, worse, only on a local emulator
run.

## Register

| # | Category | Ambiguity | Options | Decision | Status |
|---|----------|-----------|---------|----------|--------|
| 34 | Delivery / Phase structure | Each of the four transforms changes emitted assembly the moment it is wired, so the byte-exact golden suites go red — yet the RD's Must-Have says all four "land as ONE change" with golden regeneration happening once. Every CodeOps phase must end with the project verify command green before it may be committed. The two constraints appear to collide | (a) **build unwired, then wire** — relaxation wired first (a provable corpus no-op), threading/removal/branch-tail built with full spec suites but unregistered, then one phase wires everything and regenerates the corpus / (b) feature-flag all transforms off-by-default, flip and regenerate, then delete the flag / (c) wire each transform as it lands, regenerating goldens 4–5 times / (d) one monolithic phase | ✅ Resolved — User accepted recommendation: **(a)**, in the challenger-refined form: `relaxBranches` is wired in Phase 1 *because* it changes nothing (see note) | ✅ Resolved |
| 35 | Testing / Data | `packages/test-harness/src/run/label-arrivals.spec.test.ts:54-69` derives the frame-loop head by reading `_main`'s first three bytes and asserting `bytes[0] === 0x4C` (`JMP`). RD-05 elides exactly that jump. This is a **fourth** label-anchored artifact the RD's list (three `LOOP_HEAD_LABEL` constants + `budgets.json`) did not name, and it sits on the local VICE tier — so CI stays green while it rots | (a) drop `resolveLoopHead` + the `JMP_ABSOLUTE` constant and anchor on the frame-body label directly, as the other three suites will / (b) generalize the derivation to handle a missing `JMP` by taking the next label in address order / (c) derive the loop head by parsing the regenerated golden text instead of live memory | ✅ Resolved — User accepted recommendation: **(a)** anchor on the frame-body label; the suite's subject is the same-address re-arrival semantics of `runUntilLabelArrivals`, not label derivation | ✅ Resolved |
| 36 | Testing / Data | `packages/codegen/src/instr/translate.impl.test.ts` builds three `_entry`/`_L1`/`_L2` fixtures in which `_L1` is both the true target and the next block, so inversion fires. Two assertions break: `:454` (full-text `toBe` carrying `BCC M_f_L1` / `JMP M_f_L2`) and `:526` (`toContain` of the same branch). The RD's per-file disposition list names only `translate-brcmp.spec.test.ts` and `switch-translate.spec.test.ts` | (a) interpose the same non-target filler block AR #31 prescribes for the framing matrix / (b) rewrite the expectations to the inverted post-layout shape / (c) delete the affected assertions and re-pin the behavior in the new layout suite | ✅ Resolved — User accepted recommendation: **(a)** filler block; these fixtures exist to test block-boundary register reset and translator totality, not layout, and (b) would silently convert them into layout tests. **Corrected at preflight (PF-007):** the original wording claimed both assertions stay byte-identical. That is true of the `:526` `toContain` and of the `:454-455` branch-pair lines, but *not* of the `:449-463` assertion as a whole — it is a full-text `toBe` inlining the entire rendered function, so the filler's label and `RTS` land inside its expected array, which grows by two lines. `translate-brcmp` escapes this only because its scaffold is centralized in `expectFused` | ✅ Resolved |
| 37 | Behavioral / Scope | After threading, a conditional terminator could end up with both edges pointing at the same block, whose emitted form would be a pointless `B<c> M` followed by `JMP M` | (a) do not implement a collapse; file an issue if the regenerated corpus produces one / (b) implement the collapse now (emit `JMP M` alone, **keeping** the compare — its operands can be volatile MMIO reads such as `LDA $D012`, so the compare itself may never be dropped) | ✅ Resolved — User accepted recommendation: **(a)**; a corpus trace found no case that produces it, and implementing now ships a branch no input reaches (No Dead Code) | ✅ Resolved |
| 38 | Naming (batch) | Test-surface names not fixed by AR #33: the per-pass IL suites and the permanent corpus-invariant scan | `il/optimizer/thread-jumps.spec.test.ts` · `il/optimizer/remove-unreachable-blocks.spec.test.ts` · `instr/branch-tail.spec.test.ts` · `instr/block-layout.spec.test.ts` (the integrated translation-level layout oracle named in AR #33) · `packages/test-harness/src/golden-layout.spec.test.ts` (the permanent corpus scan) · **added at preflight (PF-024):** `codegen/src/instr/relax-branches.spec.test.ts` · `test-harness/src/range-branches.spec.test.ts` · `test-harness/src/testing/range-branches.ts` (the range sources) · `compiler/src/api/emit.spec.test.ts` (extended, not new) | ✅ Resolved — accepted with the batch; co-locating a spec suite beside each new module follows the repo's existing test placement and does not displace AR #33's named layout suite. The batch is now the exhaustive naming authority for this plan | ✅ Resolved |
| 39 | Technical (detected, not chosen) | The verify command every task's Verify line refers to | Read from the project `CLAUDE.md`: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` | ✅ Resolved — confirmed from source, no alternative exists in the repo | ✅ Resolved |

## Preflight resolutions (AR #40–#57)

Raised by the post-creation audit on 2026-07-20 and resolved with the user in one batch. Each
traces to a numbered finding in [00-preflight-report.md](00-preflight-report.md).

| # | Category | Decision | PF |
|---|----------|----------|----|
| 40 | Testing / Invariants | The permanent corpus scan gains a **third** invariant (ST-B43): zero `B<c> L` · `JMP x` · `L:` trigrams where `L` is the next emitted label — the missed-**inversion** shape, which the two original invariants could not see. **Carve-out: `_rlx<N>` labels are exempt**, because that trigram *is* relaxation's own emitted form and banning it would forbid legitimate relaxed code from the corpus. Extends AC-13, so it is recorded against the RD | PF-006 |
| 41 | Testing / Package edges | ST-B27 moves from `codegen/src/instr/block-layout.spec.test.ts` to `test-harness/src/range-branches.spec.test.ts`, because `@blend65/codegen` cannot import `@blend65/compiler`, where the `--optimize` gate lives. Its assertions are enumerated as ST-B27a/b/c rather than left as "the layout properties", and the shared scan predicates are authored there in Phase 4 and imported by the Phase 5 scan | PF-001 |
| 42 | Ordering | `branch-tail.ts` lands in two parts: `invertBranch` + the polarity table with ST-B20/ST-B21 in **Phase 1** (relaxation consumes them and Phase 1 wires relaxation into production), `planBranchTail` + ST-B16…ST-B19 in Phase 3. Rejected: a Phase-1-local inversion table, which would create the two-table drift that *is* the invisible failure mode | PF-002 |
| 43 | Testing / Placement | AC-11's printed-IL assertion becomes ST-B45 in `compiler/src/api/emit.spec.test.ts` (extended, not new). CI-runnable | PF-010 |
| 44 | Behavioral | A cyclic trampoline chain leaves the original target **unchanged**, rather than "returning the label where the cycle was detected" — which had three readings and would let two conforming implementations emit different bytes under byte-exact goldens | PF-011 |
| 45 | Scope of a check | Minted-label uniqueness is checked against the stream + preamble label set. Runtime-section labels are outside `InstrProgram.streams` and outside the check; a collision there is a loud ACME duplicate-symbol error. ST-B33 is worded to promise only what the mechanism checks | PF-025 |
| 46 | Testing / Correctness of rationale | AC-12 is discharged by the re-anchored suites' **existing body-written checks**, which already discriminate poll-anchored from frame-anchored. The plan's and the RD's "every observable assertion still passes" hazard is **false** for these three fixtures and is corrected. Standing property recorded: every re-anchored fixture's check set must include at least one frame-body-written value | PF-009 |
| 47 | Testing / Tiering | No `*.impl.test.ts` is added for the IL passes — ST-B8/B9/B14/B15 pin the same behaviors at spec tier, and a parallel impl suite would be a second oracle with no separate subject | PF-021 |
| 48 | Testing / Data | The two range sources live as inlined `*_SRC` constants in `test-harness/src/testing/range-branches.ts`, with **no** `examples/` counterparts and **not** in `examples-sync`'s `INLINED_MODULES` — they are unit-tier range probes, not corpus fixtures | PF-020 |
| 49 | Technical / Mechanism | `wordUnsignedOrdered`'s branch arm passes an **optional final-branch descriptor** into `wordUnsignedDecision`, defaulted so the value-tail caller is textually unchanged; the arm still decides its own trailing `JMP`, and the helper's now-false docstring is rewritten. Rejected: hoisting the `:1299` emission into both callers, which duplicates the polarity mapping in the framing least able to afford drift | PF-003 |
| 50 | Convention | `relaxBranches`'s CPU parameter is `_cpu`. It is unused today, `no-unused-vars` is an error with `argsIgnorePattern: "^_"`, and lint is inside the verify command — so an unprefixed name would stop Phase 1 going green. The seam is real: an out-of-range 65C02 `BRA` relaxes to a single `JMP` | PF-008 |
| 51 | Safety | `relaxBranches` raises an internal compiler error on a directive inside a code-segment stream, enforcing the offset walk's standing assumption rather than assuming it | PF-027 |
| 52 | Edge cases | Both IL passes are the identity on a zero-block function and on an empty `initCode`, pinned by ST-B41/ST-B42 — a bare `blocks[0].label` root read would crash every error-tolerant compile | PF-016 |
| 53 | Documentation | Registering the passes falsifies three doc comments (`pass.ts`, `optimize-il.ts`, `emit.ts:107`); all three are updated in the registration task | PF-012 |
| 54 | Artifact sweep | Two JSDoc usage examples (`testing/observables.ts:115`, `run/strategies.ts:115`) hard-code the deleted `Main_main_L0` and are refreshed with the re-anchoring | PF-019 |
| 55 | Testing / Oracle authoring | The switch oracle's post-layout shape is **pre-stated** in `03-04` §3 (elision, not inversion — the golden shows the false edge is the fall-through), so the supersession is derived from semantics rather than from output on screen | PF-018 |
| 56 | Budgets | Every program's `bytes` ratchet is re-derived, not only the four cycle windows. Ten programs shrink and would otherwise leave their ratchets permanently slack with no red test; `balloon` has no golden, so its ratchet is its only size gate. The five branch-free programs must re-derive to their current values exactly | PF-005 |
| 57 | Process | Phase 4 records a fault-attribution procedure: the four transforms are separably wired, so unregistering a pass or skipping one consult site bisects them in the working tree | PF-026 |

Two further preflight corrections needed no decision and were applied directly: the ST-B32 cascade
rewording (PF-004 — the case as written was unconstructible and a correct implementation would have
failed it) and the citation/count fixes in `02-current-state.md` and `03-04` (PF-013, PF-014,
PF-023). Presentational clarifications: the ST-B39/ST-B40 segmentation convention plus a
non-vacuity check (PF-017, PF-022), and the Kind column in `07`'s AC table separating committed
tests from hand-reviewed artifacts.

## Execution-time resolutions (AR #58–)

Raised while executing the plan. Tagged `(runtime)`.

| # | Category | Decision | Task |
|---|----------|----------|------|
| 58 | Testing / Oracle granularity *(runtime)* | ST-B38's "no blanket branch-over-jump" is asserted **per program on the `switch` probe and corpus-wide across both probes**, not per program on both. The `do…while` probe's *entire* program contains exactly one conditional branch — the out-of-range back edge itself — so a per-program strict inequality there would demand its sole branch stay short, contradicting ST-B36. `03-03`'s wording is "in-range branches are untouched"; that fixture has none, so the clause is vacuous for it by the spec's own terms. The corpus-wide inequality is what actually rules out a wrap-everything implementation (it scores 4/4 wrapped and fails), so the load-bearing property is fully preserved | 1.4 |
| 59 | Testing / Non-vacuity *(runtime)* | ST-B38 also asserts the **positive**: each probe must still contain at least one branch-over-jump, i.e. at least one branch that genuinely cannot be encoded short. Without it, trimming a fixture body until its span fits back inside the relative reach would leave ST-B36/ST-B37 green while they proved nothing — the same vacuity hazard ST-B44 addresses for the corpus scan. The probes also gained `$C0xx` settle sentinels and an arm tag so the VICE execution leg has a deterministic stopping point and can name *which* arm the dispatch reached | 1.4, 1.10 |
| 60 | Testing / Coverage gap *(runtime)* | `03-01`'s dangling-target tolerance ("a target naming no block is skipped rather than crashing") was stated as behaviour but assigned no `ST-B` id, so it had no oracle. Added as **ST-B46**: on a function whose reachable region branches to a label no block defines, `removeUnreachableBlocks` does not throw, keeps the reachable blocks, and *still* drops an unreferenced one — so tolerating the dangling edge did not quietly disable the pass — and `threadJumps` does not throw and leaves the target alone. Without it, a crash here would destroy the translator's own diagnostic on exactly the malformed input that diagnostic exists for | 2.2 |
| 63 | Technical / Types *(runtime)* | `planBranchTail` takes a narrowed `ConditionalBranch`, not a general `Opcode`. `03-02` specifies a three-variant `TailPlan` *and* says an `undefined` inverse must raise an internal compiler error — but a pure decision function holds no diagnostic bag, so those two statements together left the failure with nowhere to live. Narrowing the parameter removes the state instead of representing it: `TailPlan` stays exactly the three variants planned, the inverse lookup is total, and the caller — which does hold the bag — is forced by the type to narrow first, which is where `03-02` says the error belongs. Rejected: a fourth `uninvertible` variant (represents an impossible state rather than eliminating it) and a silent `both` fallback (that *is* the invisible missed inversion this change exists to eliminate). Pinned by **ST-B48** (a converging branch is decided, not undefined) | 3.3 |
| 62 | Behavioral *(runtime)* | A trampoline chain that runs off into a label **no block defines** abandons the rewrite too, exactly as a cyclic chain does — pinned by **ST-B47**. Found by the Phase 2 review: the first implementation followed such a chain and rewrote a valid target to the dangling one, so one broken edge became two and removal then dropped the block that carried the mistake, moving the translator's eventual error off its cause. Distinct from ST-B46, whose branch names a missing block on the first step | 2.5 |
| 61 | Technical / Placement *(runtime)* | The shared successor walk factored out of `il/termination.ts` lives in a new `il/reachability.ts` rather than in `il/cfg.ts`, whose header states it holds records plus one pure successor helper and no other behaviour. `reachableBlocks(blocks, successors?)` returns survivors **in input order**, so order preservation is a property of the shared walk rather than something each caller must remember. The constant-`brcond` refinement stays private to `termination.ts` as `takenEdges` — deliberately not inherited | 2.4 |

**AR-58.** Rejected: adding an in-range conditional (an `if`) to the `do…while` source so the
per-program inequality binds there too. It is strictly stronger, but it muddies a probe whose value
is being a single unambiguous out-of-range back edge, and the extra block would also become an input
to Phase 4's elision — turning a range probe into a second layout fixture. The planning-time premise
that "both fixtures contain many in-range branches" was simply wrong on the `do…while` side; that is
a measurement correction, not a design change.

## Resolution Notes

**AR-34 (challenger-hardened).** An independent challenger ran blind on the four options and
converged on (a), but corrected the phase ordering: it argued `relaxBranches` should be wired
**first**, not last. The reasoning is that no fixture in the repo has ever carried a branch
beyond the −128..+127 relative reach, so registering relaxation changes **zero** goldens.
Wiring it in Phase 1 therefore costs nothing and buys two things the original ordering did not:
a corpus-wide proof that relaxation is the identity on in-range code (if any golden moves a
byte, relaxation is wrong), and the guarantee that the sole range authority is already live
before inversion can hand it an out-of-reach branch — even transiently, inside the wiring phase.

The challenger also named the residual weakness honestly, and it is recorded here rather than
buried: the adjacency computation inside the translator's block loop gets **no live evidence**
until the wiring phase, and its failure mode is a *silently missed* elision rather than a red
test. That is what the Phase 5 corpus-invariant scan is for — it catches a missed elision
structurally, across every golden, instead of relying on the hand review.

Option (b), the feature flag, was rejected on two grounds: it is code written to be deleted
(plumbing through `assembleProgram` and the translator options, plus a deletion phase
re-touching every site), and an off-path contradicts AR #30's "layout is unconditional" posture
— a leaked flag would be exactly the two-geometries hazard AC-7 exists to forbid. Its one real
advantage, full-pipeline evidence before the corpus moves, largely evaporates because the IL
passes are `ILProgram → ILProgram` and can be invoked explicitly by a spec test against a real
lowered fixture without being registered anywhere.

**AR-35.** Beyond the elided `JMP`, re-anchoring here removes a hazard the RD did not
anticipate: once the entry block's jump is elided, `_main` and the poll-head block label sit at
the **same address**, so the suite's reverse address→name lookup (`if (address === target &&
name !== "_main")`) becomes genuinely ambiguous. Option (b) would have preserved that lookup.
The suite's docstring ("its entry jumps straight to the frame loop head") also becomes false and
is rewritten, not patched.

**AR-36.** The filler block works here for the same structural reason it works for the framing
matrix: these fixtures call `translateFunction` directly, so the IL passes never run and an
unreachable filler block survives translation and renders in the trailing scaffold. The two
affected assertions then stay byte-identical; only the rendered scaffold grows by one label and
one `RTS`.

**AR-37.** The corpus trace covered the three fixtures where threading is most aggressive
(`rasterpoll`, `guards`, `slice4b`) and found no terminator whose two edges converge. The
carve-out worth recording is the one in option (b)'s own wording: even if the collapse were
implemented, only the *branch tail* could ever be collapsed. Dropping the comparison would
change MMIO behavior, because a comparison's operands may be volatile hardware reads.

**AR-39.** Not a choice — a fact read from `CLAUDE.md` and recorded so every Verify line in the
plan traces to a single source. The per-package tier runs first, then the repo-root boundary
tier.
