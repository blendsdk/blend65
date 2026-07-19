# Execution Plan — Block Layout (RD-05)

> **Implements**: asm-parity/RD-05 · [#51](https://github.com/blendsdk/blend65/issues/51), [#65](https://github.com/blendsdk/blend65/issues/65)
> **Progress**: 25/58 tasks (43%) — Phases 1–3 complete
> **Last Updated**: 2026-07-20
> **CodeOps Skills Version**: 3.10.0

**Verify** (every phase, before every commit):

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

Phase order is the resolution of AR #34: build unwired, wire once. Phase 1 is wired first
*because* it changes nothing — a golden that moves a byte there means relaxation is wrong.

Task numbering was re-flowed at preflight (AR #40–#47); the phase shape is unchanged.

---

## Phase 1 — Branch relaxation, wired (closes #65) · tag: complex

Spec → red → implement → green → impl/hardening. Ends with **all 14 goldens byte-unchanged** —
that is the phase's real assertion, and it is mechanized: `assertGolden` is byte-exact and all 14
golden suites run in CI with no `skipIf`.

- [x] 1.1 Compile an out-of-range branch on today's compiler and **record ACME's actual
      behavior**. The claim that #65 fails loudly rather than truncating silently is an untested
      prediction; if it truncates, that raises #65's severity and is reported, not absorbed
      — *done 2026-07-20: it fails **loudly**. `do…while` back-edge → `Target out of range
      (-219; 91 too far)`; `switch` dispatch → `(219; 92 too far)` + `(412; 285 too far)`. Both
      surface as `E90001`, exit 3, with no `.prg` written. Severity unchanged; recorded in
      [03-03](03-03-relax-branches.md)*
- [x] 1.2 Write `codegen/src/instr/branch-tail.spec.test.ts` — **ST-B20, ST-B21 only** (the
      polarity table). Phase 1 wires `invertBranch` into production through relaxation, so its
      oracle is authored here, not in Phase 3; the tail-decision cases extend this same file at 3.1
      — *done 2026-07-20 (implementation-blind author)*
- [x] 1.3 Write `codegen/src/instr/relax-branches.spec.test.ts` — ST-B28…ST-B35. ST-B32 is the
      **cascade** construction: the second branch must sit at exactly +127 *and* span the first
      branch's rewrite site, so the +3 bytes push it to +130 — *done 2026-07-20; the fixture
      self-asserts both cascade properties before the pass runs*
- [x] 1.4 Write `test-harness/src/range-branches.spec.test.ts` — ST-B36…ST-B38, ACME tier,
      `skipIf(!hasAcme())`, runs in CI. The two range sources are inlined `*_SRC` constants in
      `test-harness/src/testing/range-branches.ts` with **no** `examples/` counterparts and **not**
      added to `examples-sync`'s `INLINED_MODULES` — they are unit-tier range probes, not corpus
      fixtures (AR #32, AR #48) — *done 2026-07-20; ST-B38's granularity resolved as AR #58*
- [x] 1.5 Verify **red** — *done 2026-07-20. Codegen: 2 files fail to resolve `./branch-tail.js`
      and `./relax-branches.js`, 73 passed / 634 tests green. Harness: ST-B36 fails with
      `Target out of range (-219; 91 too far)`, ST-B37 with `(219; 92 too far)` + `(412; 285 too
      far)` — the real defect, not a scaffolding error*
- [x] 1.6 Implement `invertBranch` + the polarity table in `codegen/src/instr/branch-tail.ts`
      (relaxation needs it first; the tail decision joins it in Phase 3 — one table, one place)
      — *done 2026-07-20*
- [x] 1.7 Implement `codegen/src/instr/relax-branches.ts` — offset walk, out-of-range rewrite,
      monotone fixpoint, minted-label uniqueness against the stream + preamble label set, internal
      compiler error on an unresolvable target, and an internal error if a directive is ever
      encountered inside a code-segment stream (the offset walk's standing assumption). The CPU
      parameter is `_cpu` — unused today and marked with the repo's canonical `_` prefix
      — *done 2026-07-20. One guard added beyond the spec: an out-of-reach branch with no
      inverse is reported and left alone, and the fixpoint breaks on no-progress rather than
      spinning on a candidate it cannot rewrite*
- [x] 1.8 Wire into `compiler/src/api/emit.ts` after `optimizeInstr`; the relaxed program becomes
      **both** the serialized text and `AssembledAsm.program`, preserving `preamble`,
      `allocationPlan` and `preambleOptions` — *done 2026-07-20*
- [x] 1.9 Verify **green**, and assert every golden is byte-identical to its committed form
      — *done 2026-07-20. All 16 golden suites / 31 tests pass and `git status --porcelain`
      shows **zero** drift under `*.asm.golden` and `test/golden/` — the corpus-wide proof that
      relaxation is the identity on in-range code*
- [x] 1.10 Local VICE execution case for both range fixtures — *done 2026-07-20. Both probes
      gained a `$C0xx` settle sentinel (and the switch an arm tag) so the run has a deterministic
      stopping point; the `do…while` counter reads exactly 3 and the switch tag names case 2.
      Both green on VICE 3.10 (AR #59)*
- [x] 1.11 Full verify + `npx prettier --check` on touched files — *done 2026-07-20. Verify
      exit 0: 2452 tests across 10 packages plus the root boundary tier (33/8). `spec/` clean.
      All eight touched files Prettier-clean*

**Post-phase review.** Independent reviewer on a different model family, over the phase diff, on
the always-on lenses plus `api-surface`. No critical or major findings. Two minor, both applied:
the termination comment miscounted the rewrite's growth (one entry becomes three — *two* net
entries, three bytes), and ST-B38 sat behind an ACME gate although it only reads emitted text, so
the load-bearing negative would silently skip on a machine without ACME; it now has its own
ungated suite. The reviewer independently confirmed the fixpoint terminates (a rewritten branch
sits at +3 forever and can never re-enter the candidate set), the boundary arithmetic at ±127/−128,
the same-reference contract on a mixed program, and that `programByteSize` has no live caller that
could bypass relaxation.

---

## Phase 2 — IL passes, unwired · tag: complex

Driven directly by their spec suites: `optimizeIL(il, [threadJumps, removeUnreachableBlocks], bag)`
against real lowered fixtures. Nothing is **registered**, so the corpus cannot move through the
emit path. The one production touch is 2.4's refactor of `il/termination.ts`, which is guarded
explicitly below.

- [x] 2.1 Write `codegen/src/il/optimizer/thread-jumps.spec.test.ts` — ST-B1…ST-B9
      — *done 2026-07-20 (implementation-blind author)*
- [x] 2.2 Write `codegen/src/il/optimizer/remove-unreachable-blocks.spec.test.ts` —
      ST-B10…ST-B15, ST-B41, ST-B42 — *done 2026-07-20. The author flagged that `03-01`'s
      dangling-target tolerance had no `ST-B` id and correctly declined to invent one; it is now
      **ST-B46** (AR #60)*
- [x] 2.3 Verify **red** — *done 2026-07-20: both suites fail to resolve `./thread-jumps.js` and
      `./remove-unreachable-blocks.js`; 75 files / 644 tests still green*
- [x] 2.4 Factor the shared successor walk out of `il/termination.ts:30-66` so the two walks
      cannot drift; the constant-`brcond` edge refinement stays with termination and is
      deliberately **not** inherited. **This is production code** — `functionCanReturn` selects the
      startup shim variant via `instr-program.ts:224-226`. Guard: `termination.spec.test.ts` and
      `termination.impl.test.ts` stay green and all 14 goldens stay byte-identical
      — *done 2026-07-20. New `il/reachability.ts` (AR #61) — `cfg.ts`'s own header rules out
      putting behaviour there. Survivors come back in input order, so order preservation is a
      property of the shared walk. The refinement stays private to `termination.ts` as
      `takenEdges`. Guard held: 18/18 termination tests green, zero golden drift*
- [x] 2.5 Implement `thread-jumps.ts` — trampoline predicate, cycle-safe chain-following (a cyclic
      chain leaves the original target **unchanged**), all terminator kinds via the shared edge
      enumeration, `initCode` too — *done 2026-07-20*
- [x] 2.6 Implement `remove-unreachable-blocks.ts` — roots, order-preserving, dangling-target
      tolerant, self-loop carve-out falling out of reachability, total on a zero-block function and
      an empty `initCode` — *done 2026-07-20*
- [x] 2.7 Verify **green** — *done 2026-07-20: 662 codegen tests, the 18 new ones included*
- [x] 2.8 Confirm the 2.4 guard held: termination suites green, corpus byte-identical. No
      `*.impl.test.ts` is added — ST-B8/B9/B14/B15 already pin idempotence, `initCode` rooting and
      order at spec tier (AR #47) — *done 2026-07-20. Neither pass is on the package barrel yet:
      exporting them is part of 4.7's registration, so nothing outside their spec suites can reach
      them and the corpus provably cannot move*
- [x] 2.9 Full verify + prettier check — *done 2026-07-20. Verify exit 0; `spec/` clean; goldens
      byte-identical; all six touched files Prettier-clean*

**Post-phase review.** No critical or major findings. One minor **correctness** defect found and
fixed: a trampoline chain dead-ending in a missing label was *followed*, rewriting a valid target
to the dangling one — one broken edge became two, and removal then dropped the block that carried
the mistake, moving the translator's eventual error off its cause. Now abandoned like a cyclic
chain, pinned by **ST-B47** (AR #62), authored by the same blind author and green on the first run.
The reviewer separately confirmed the `functionCanReturn` refactor is behaviour-preserving on
every input — including the `entry === undefined` guard whose loss would have selected the
crashing startup shim — and that order preservation in `reachableBlocks` is guaranteed by
construction rather than by traversal order. The second minor (a now-stale "no v1 pass exists"
claim in `pass.ts`) is already assigned to task 4.7.

---

## Phase 3 — The branch-tail decision, unwired · tag: standard

A pure decision table with no translator state. Small by design — the risk here is not
complexity, it is that a wrong table is invisible in output. The polarity half landed in Phase 1;
this phase adds the tail decision on top of it.

- [x] 3.1 **Extend** `codegen/src/instr/branch-tail.spec.test.ts` — ST-B16…ST-B19
      — *done 2026-07-20, plus **ST-B48** for the converging-edges input the table's row order
      decides (AR #63), and a sweep asserting the tail decision inverts through the same polarity
      table relaxation uses. Written directly rather than dispatched: the oracle is a four-row
      truth table supplied in advance, which leaves no room for an implementation-shaped
      expectation*
- [x] 3.2 Verify **red** (the new cases only; ST-B20/B21 are already green from Phase 1)
      — *done 2026-07-20: 6 new cases fail with `planBranchTail is not a function`; ST-B20/B21
      stay green*
- [x] 3.3 Implement `TailPlan` + `planBranchTail` alongside the polarity table from 1.6
      — *done 2026-07-20. `planBranchTail` takes a narrowed `ConditionalBranch` so the
      no-inverse state is unrepresentable rather than represented; `TailPlan` stays the three
      variants planned (AR #63)*
- [x] 3.4 Verify **green** — *done 2026-07-20: 669 codegen tests*
- [x] 3.5 Full verify + prettier check — *done 2026-07-20. Verify exit 0; goldens byte-identical;
      `spec/` clean; both touched files Prettier-clean*

---

## Phase 4 — Wire everything, re-anchor, regenerate · tag: sensitive

The single corpus commit. Large by construction — but its *code* diff is small; the bulk is
mechanical artifacts. Order matters: wire, then re-anchor, then regenerate. Re-anchoring after
regeneration would mean re-anchoring by reading a diff.

**Fault attribution.** If the hand review at 4.16 rejects a shape, pin it to one transform before
changing anything: the four transforms are separably wired, so unregistering a pass at
`emit.ts:108` or skipping a single consult site bisects them in the working tree, and the
per-transform spec suites from Phases 1–3 say which decision procedure is at fault. Rollback itself
is not a concern — the review precedes the commit.

- [ ] 4.1 Write `codegen/src/instr/block-layout.spec.test.ts` — ST-B22…ST-B26
- [ ] 4.2 Author the shared golden-scan predicate helper (ST-B39/ST-B40/ST-B43 shapes + the
      ST-B44 non-vacuity check) and **extend** `range-branches.spec.test.ts` with ST-B27a/b/c.
      The helper is consumed here and again by the Phase 5 corpus scan
- [ ] 4.3 Verify **red**
- [ ] 4.4 Thread the next block's **IL** label through the block loop (`translate.ts:264-284`);
      consult the plan at `br` (`:602-603`) and `brcond` (`:605-608`)
- [ ] 4.5 Consult at `emitCmpTail`'s branch arm (`:1141-1149`) — covers four of the five framings
- [ ] 4.6 Consult at `wordUnsignedOrdered`'s branch arm (`:1250-1256`). The final `BCC`/`BCS` is
      emitted **inside** `wordUnsignedDecision` at `:1299`, a helper shared with the value tail at
      `:1262` — so pass an optional final-branch descriptor into the helper, **defaulted** so the
      value-tail call site is textually unchanged. Rewrite the helper's docstring, whose "falls
      through only when the answer is 'no'" becomes false under an inverted final branch. The two
      hi-byte decisions at `:1290-1294` are framing-internal and keep their polarity
- [ ] 4.7 Register `[threadJumps, removeUnreachableBlocks]` at `emit.ts:108`, **and update the
      three doc comments the registration falsifies**: `il/optimizer/pass.ts` ("v1 ships no
      passes"), `optimize-il.ts` ("v1 callers pass `[]`"), and `emit.ts:107`
- [ ] 4.8 Verify `block-layout.spec.test.ts` and the ST-B27 cases **green**
- [ ] 4.9 Re-anchor `rasterpoll/guards/balloon.spec.test.ts` `LOOP_HEAD_LABEL` and
      `budgets.json` balloon `frameUpdate.toLabel` (`:56`) by **re-deriving arrival semantics** —
      the once-per-frame point is the post-poll frame-body block, not the poll block
- [ ] 4.10 Re-anchor `test-harness/src/run/label-arrivals.spec.test.ts`: delete `resolveLoopHead`
      and `JMP_ABSOLUTE`, anchor on the frame-body label, rewrite the now-false docstring
- [ ] 4.11 Update the two JSDoc usage examples that hard-code the deleted label —
      `test-harness/src/testing/observables.ts:115` and `src/run/strategies.ts:115`
- [ ] 4.12 `translate-brcmp.spec.test.ts`: interpose the filler block; every per-row `expected`
      stays byte-identical; update `expectFused`'s scaffold and the fixture doc comment
- [ ] 4.13 `translate.impl.test.ts`: filler block at both affected fixtures (`:449-463`,
      `:499-527`). The `:454-455` branch-pair lines stay byte-identical; the `:449` **full-text**
      expected array grows by the filler's label and `RTS` — that growth is the recorded scaffold
      change, not a drifted expectation (AR #36, corrected)
- [ ] 4.14 `switch-translate.spec.test.ts`: supersede in writing to the post-layout shape
      **pre-stated in `03-04` §3** — do not derive it from the output on screen
- [ ] 4.15 Re-verify `multiblock-translate.spec.test.ts` is genuinely unaffected
- [ ] 4.16 Regenerate all 14 goldens; **hand-review each against its twin** as an assembly
      developer would — the five branch-free goldens must be byte-unchanged
- [ ] 4.17 Re-derive the four budget windows in `budgets.json` from the regenerated goldens
- [ ] 4.18 Re-derive the two hand-derived constants **and their derivation comments** in
      `budgets.spec.test.ts:73,86`
- [ ] 4.19 Re-derive **every program's `bytes` ratchet** in `budgets.json` from the regenerated
      binaries — all 15, not only the windowed four. The five branch-free programs must re-derive
      to their **current** values exactly; a byte moving there is a stop, not a budget bump.
      `balloon` has no golden, so its ratchet is the only size gate it has
- [ ] 4.20 Confirm balloon's back-edge `frameUpdate` window resolves to the intended slice —
      `windowSlice` stops at the *first* transfer to `toLabel`
- [ ] 4.21 Update `twins.json` routing at source: the six #51 rows, the `guards` #59
      "unreachable epilogue" row moving to #51, and the free-text counts CI cannot validate
- [ ] 4.22 Regenerate `SCOREBOARD.md`; freshness gate green
- [ ] 4.23 Extend `compiler/src/api/emit.spec.test.ts` with ST-B45 — `emitIl` on the raster-poll
      source shows no trampoline and no unreachable block, and its block set equals the set
      emitted into the assembly
- [ ] 4.24 Local tier: emulator fixture + twin suites green; balloon `frameUpdate` **measured**
      re-measurement on VICE 3.10 (cannot run in CI)
- [ ] 4.25 Full verify + prettier check

---

## Phase 5 — Permanent invariants and closeout · tag: standard

- [ ] 5.1 Write `test-harness/src/golden-layout.spec.test.ts` — ST-B39, ST-B40, ST-B43, ST-B44,
      importing the scan predicates authored at 4.2. ST-B43 carries the `_rlx<N>` carve-out
- [ ] 5.2 Prove the scan bites: seed a violation of **each of the three shapes** locally, watch
      each fail, revert. Confirm the ST-B44 non-vacuity check fails if the function markers are
      mangled
- [ ] 5.3 Walk AC-1…AC-13 against committed artifacts, quoting evidence for each, and respecting
      the Kind column in `07` — a hand-reviewed artifact may not be cited as a committed test
- [ ] 5.4 Per-fixture before/after bytes and straight-line cycles; corpus totals must both
      strictly decrease with no individual regression
- [ ] 5.5 Note any pair whose residual divergence is now dominated by a different cause, so the
      next wave item inherits an accurate picture *(Should-Have)*
- [ ] 5.6 Area report on #51; close #65 with its range evidence
- [ ] 5.7 Roadmap sync — feature row to `Done`, then cascade the portfolio row
- [ ] 5.8 Full verify

---

## Standing rules for this plan

- **Zero-ambiguity during execution.** Anything not covered here or in
  `00-ambiguity-register.md` stops work: present options, get an explicit decision, record it as
  the next `AR #n` tagged `(runtime)`, back-propagate into the affected plan docs, then resume.
- **Spec tests are immutable oracles.** A failing `*.spec.test.ts` means the implementation is
  wrong. The two spec files this plan *does* change are changed by explicit, recorded decision
  (AR #31, AR #36) and their per-row expectations stay byte-identical. The one **impl**-tier file
  it changes (`translate.impl.test.ts`) keeps its branch-pair lines byte-identical while its
  full-text array grows by the filler's rendered scaffold — recorded, not drifted.
- **`spec/` stays frozen** — `git status --porcelain spec/` must remain empty in every commit.
- **No plan/requirement identifiers in code or doc comments.** Restate the reasoning in plain
  language. `ST-*` ids in test titles are the established exception.
- **Never `prettier --write` a whole file** this change did not otherwise rewrite.
