# RD-05: Block Layout — Fall-Through Elision + Jump Threading

> **Document**: RD-05-block-layout.md
> **Status**: Draft
> **Created**: 2026-07-19
> **Project**: blend65 — Asm-Parity Initiative
> **Issue**: [#51](https://github.com/blendsdk/blend65/issues/51) (Prime Directive audit finding #2);
> also closes [#65](https://github.com/blendsdk/blend65/issues/65) (branch relative-range defect)
> **Depends On**: RD-01 (parity instruments, ✅), RD-02 (twin corpus + scoreboard, ✅),
> RD-04 (compare-and-branch fusion, ✅ — supplies the fused terminator this RD threads)
> **CodeOps Skills Version**: 3.10.0

---

## Feature Overview

Every basic block the compiler emits ends with an explicit jump, even when its target is the
very next line, and blocks exist whose entire body is a single `JMP`. Across the 14-golden
corpus that is **105 `JMP`s, of which 47 target the immediately-following label and 13 blocks
consist of nothing but a jump**. The `guards` fixture emits 23 `JMP`s where its hand-written
twin emits 1. An assembly developer lays blocks out so the common path falls through, threads
a jump that lands on another jump straight to the destination, and picks the branch polarity
that avoids the jump entirely — none of which the emitter does today, because it walks
`ILFunction.blocks` in lowering order and emits each terminator verbatim
(`packages/codegen/src/instr/translate.ts:264-284`).

This RD makes emission layout-aware: suppress a jump to the next block, thread branches
through trampoline blocks, drop what that orphans, and invert a conditional branch when its
true target is the fall-through. It also discharges two obligations inherited in writing.
From RD-04 (AR #20): the raster-poll golden must reach the **twin-byte-comparable
3-instruction idiom** — fusion took it from 9 instructions to 4, and the remaining gap is
exactly this RD's two transforms. From RD-04's Won't-Have (AR #25): the pre-existing
**relative-branch range defect** ([#65](https://github.com/blendsdk/blend65/issues/65)), whose
fix was routed here because relaxation is a function of final block geometry — which this RD
is what settles.

The transforms are pure control-flow rewrites with no language-surface change, and they reach
every fixture in the corpus that contains a branch.

## Functional Requirements

### Must Have

- [ ] **Fall-through elision.** An unconditional jump whose target is the block emitted
  immediately after it is not emitted at all. Applies to every terminator that emits a
  trailing `JMP`: the `br` terminator, the `brcond` false edge, and the fused comparison's
  false edge across all five framings. Cross-function fall-through is never exploited —
  adjacency is only meaningful inside one function's block list.
- [ ] **Branch inversion.** Fall-through elision and inversion are **one decision**, not two
  transforms: given a conditional branch to `T` followed by `JMP F`, with `N` the next emitted
  block — if `F === N`, drop the `JMP`; if `T === N`, emit the inverted branch to `F` alone;
  otherwise emit both. Comparison-framing-internal branches (the signed-overflow correction,
  the word early-outs) are not block tails and are never inverted. *(AR #26)*
- [ ] **Jump threading.** Any branch or jump whose target block consists solely of an
  unconditional jump to `M` is retargeted to `M` directly. Threading chain-follows trampolines
  through a visited set, so a chain of jump-only blocks resolves in one pass and a cyclic
  trampoline terminates instead of looping. *(AR #26)*
- [ ] **Unreachable-block removal.** A reachability walk from the function entry drops every
  block no longer reachable — both blocks orphaned by threading and blocks already orphaned
  upstream. This ships as an independently schedulable pass because it has a second client:
  the wave's const-fold pass orphans blocks the same way and must be able to re-run it after
  folding. **Carve-out:** a self-referential jump-only block (`L: JMP L` — the emitted form of
  `while (true) {}`) is reachable and semantically load-bearing; it survives. *(AR #29)*
- [ ] **Layout is unconditional.** These transforms run regardless of the `--optimize` flag.
  Emitting a jump to the next instruction is a defect under the Prime Directive, not a
  withheld optimization; and branch relaxation below is a *correctness* transform whose
  distances must be measured over the geometry that is actually emitted — so layout and
  relaxation cannot be gated differently. *(AR #30)*
- [ ] **Branch relaxation ([#65](https://github.com/blendsdk/blend65/issues/65)).** A
  conditional branch whose target lies outside the 6502's −128..+127 relative reach is emitted
  as an inverted short branch over an absolute jump (`B<inv> *+5` / `JMP far`). Relaxation is
  applied **only** where the target is genuinely out of reach — no blanket pessimization — and
  iterates to a fixpoint, because relaxing one branch inserts three bytes and can push another
  out of range. It must cover branches that exist only after translation (the shift loops, the
  comparison-framing tails, the word-equality early-outs), which have no IL-level
  representation. *(AR #28)*
- [ ] **The twin-byte-comparable raster idiom.** The inherited acceptance criterion from
  RD-04: the raster-poll condition block reaches the hand-written form — a load, a compare,
  and a conditional branch back to itself — with the trailing jump elided and the trampoline
  threaded away. *(AR #20)*
- [ ] **Printed IL stays honest.** Because threading and unreachable-block removal run as IL
  passes, `--emit-il` shows exactly the edges and blocks that reach the emitter — it must not
  display trampolines and dead blocks that are then silently discarded downstream. *(AR #26)*
- [ ] **Corpus supersession, same change.** All goldens regenerated and hand-reviewed;
  `budgets.json` tightened to the new exact values, including the hand-derived poll-iteration
  and compound-guard cycle constants, which both change; `SCOREBOARD.md` regenerated and its
  freshness gate green. *(AR #12, AR #17, AR #24, AR #31)*
- [ ] **The framing matrix survives intact.** The fused-comparison framing × polarity oracle
  is preserved by changing the *block order* of its hand-built fixtures so that no target is
  adjacent — every expected instruction sequence stays byte-identical. Layout gets its own
  dedicated suite instead. That oracle exists because a fused branch "would still look
  plausible in isolation; only the pair pins it", and branch inversion is precisely a polarity
  flip — folding it into the polarity oracle would blunt the guard RD-04 landed. *(AR #31)*

### Should Have

- [ ] Closeout delta record: per-fixture before/after bytes and straight-line cycles, quoted
  in the area report on the issue.
- [ ] Divergence re-routing: the `guards` scoreboard row currently attributed to
  [#59](https://github.com/blendsdk/blend65/issues/59) as "unreachable epilogue — main never
  returns, yet an RTS is still emitted past the frame loop" is fixed by this RD's
  unreachable-block removal, and its routing moves to #51. *(AR #29)*

### Won't Have (Out of Scope)

- **Block reordering / trace scheduling** — moving cold arms out of line so the hot path falls
  through. This RD exploits the existing lowering order only, per issue #51's own framing
  ("after block order is fixed"). Reordering changes branch distances and so interacts with
  relaxation; it is a separate item, filed if the scoreboard shows residual cost. *(AR #27)*
- **Peephole pattern rewrites** — redundant load/store elimination, `INC`/`DEC` selection, and
  the rest of the seed catalog belong to RD-06 ([#52](https://github.com/blendsdk/blend65/issues/52)),
  whose home is the instruction peephole. This RD adds no rule to that catalog. *(AR #26)*
- **Constant-driven unreachability** — folding a computed-constant condition and discarding
  the arm it kills belongs to the wave's const-fold pass, which reuses this RD's removal pass
  rather than duplicating it. *(AR #21, AR #29)*
- **A new corpus fixture for the range cases** — a >127-byte filler loop has no hand-written
  idiom to be compared against, so a twin would be mechanical filler that dilutes the parity
  corpus. Range is proven at the unit tier. *(AR #32)*
- **Register allocation, ABI, and startup ceremony** — RD-07 (#53) and RD-10 (#59).

## Technical Requirements

The four transforms do not share a seam, because the information each needs exists in a
different place. Three seams are already wired and empty; the allocation below follows where
the facts live. *(AR #26)*

### Jump threading + unreachable-block removal (complexity: M)

Two `ILPass`es in `packages/codegen/src/il/optimizer/`, registered in the pipeline that
already runs unconditionally (`packages/compiler/src/api/emit.ts:108`, today
`optimizeIL(il, [], bag)`). At this level blocks and terminator edges are first-class
(`packages/codegen/src/il/cfg.ts`), so threading is a record rewrite over terminator targets
and removal is a reachability walk from the entry block plus the module initializer. Two
passes rather than one: removal must be independently schedulable for the const-fold pass, and
each is testable in isolation as `ILProgram → ILProgram` against the existing runner's test
pattern. The pass names surface in `--emit-il` stage labels, so they carry honest individual
names.

### Fall-through elision + branch inversion (complexity: M)

Translation time is the only place block adjacency exists — the IL deliberately cannot
represent fall-through ("control leaves a block only via its terminator",
`packages/codegen/src/il/cfg.ts:24-26`), and once translation completes the output is a flat
entry array in which block identity is gone
(`packages/core/src/instr-model/stream.ts:54-76`). The block loop at
`packages/codegen/src/instr/translate.ts:264-284` gains the next block's label and threads it
into the terminator sites that emit a trailing jump. The decision itself — including the
polarity-inversion table — is extracted into its own small module rather than grown inside
`translate.ts`, which is already 2250 lines against the project's 500-line guideline.

Two hazards to handle explicitly. The "is this block a trampoline" predicate must decide
whether a body carrying only source-provenance entries counts as empty — requiring strictly
empty silently under-fires, while skipping provenance entries drops source mapping. And the
next-label comparison must account for the entry block, whose emitted label is the sanitized
function name rather than a generated block label; a mismatch there is either a dangling-label
assembler error or a silently missed elision that only the budget ratchet would catch.

### Branch relaxation (complexity: M)

A new stage over the assembled program, run unconditionally in the emit pipeline after the
optional peephole (so it measures post-peephole sizes). It is **not** a peephole rule: that
contract windows consecutive instruction entries with a bounded replacement
(`packages/codegen/src/instr/peephole.ts:47-60`), whereas relaxation must see labels, may grow
a two-byte branch to five, and must run even when the peephole is disabled. Distances come
from the existing per-instruction size function
(`packages/codegen/src/instr/print-instr.ts:239-252`). The algorithm is the standard monotone
fixpoint — once a branch is relaxed it stays relaxed, iterate until no branch changes — which
terminates and never shrinks a previously-relaxed branch back into a stale distance.

### Test surfaces (complexity: S)

A dedicated layout suite pins elision, inversion, threading, removal, and the self-loop
carve-out. The range cases (a do-while body and a switch dispatch each exceeding the relative
reach) are proven at the unit tier: an assembler-backed spec test that runs in CI proves they
assemble and that in-range branches are untouched, and a local emulator case proves they run
correctly. *(AR #32)*

## Integration Points

### With RD-04 (compare-and-branch fusion)
Consumes its output. The fused terminator threads exactly like `brcond`, and its false edge is
one of the trailing jumps elision removes. RD-04 left the raster golden at 4 instructions
against the twin's 3; closing that gap is this RD's headline criterion.

### With RD-01 (parity instruments) / RD-02 (twin corpus + scoreboard)
The budget tier asserts the tightened values; the scoreboard regenerates against unchanged
twins. Three pairs carry #51 routing rows today (`guards`, `rasterpoll`, `balloon`) and are
expected to lose them.

### With the wave's const-fold pass (split from #58)
Shares the unreachable-block-removal pass, scheduled after folding. The composition is
`[constFold, threadJumps, removeUnreachable]` in the already-wired runner.

### With RD-06 / #52 (peephole seed catalog)
Disjoint by construction: RD-06 owns the instruction peephole's rule catalog; this RD adds no
rule to it and leaves its contract untouched. Relaxation runs after the peephole so it
measures final sizes.

### With blend65-ri R15 / AR-20 boundary
All changes live in `@blend65/codegen` and `@blend65/compiler`; nothing touches the frontend.
The boundary tier must stay green.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Transform placement | split by nature / all at translation / all at the instruction peephole | Threading + removal as IL passes; elision + inversion as one tail decision at translation; relaxation as a new unconditional stage | Each transform sits where its facts exist; the peephole option is non-viable (its contract excludes labels from windows) | AR #26 |
| Block reordering | out of scope / include a heuristic | Out of scope | Issue #51 scopes itself to a fixed block order; reordering perturbs branch distances and so entangles with relaxation | AR #27 |
| #65 relaxation | inside RD-05 / follow-up RD | Inside | Shares the prerequisite (settled geometry) and the unconditional siting; deferring ships a known-reachable build failure | AR #28 |
| Unreachable-block removal | RD-05 owns the mechanism / each client ships its own | RD-05 owns it as a reusable pass | Two clients (threading, const-fold); duplication would put the same logic in two places | AR #29 |
| Gating | unconditional / behind `--optimize` | Unconditional | Relaxation is correctness and must measure emitted geometry; differing gates would mean two geometries | AR #30 |
| Oracle supersession | supersede what the seam reaches / blanket supersede / preserve the framing matrix | Preserve it via a fixture block-order change; layout gets its own suite | Every expectation stays byte-identical; inversion is a polarity flip and must not be folded into the polarity oracle | AR #31 |
| Range-case test tier | unit tier / new corpus fixture + twin | Unit tier | Range is a correctness property; a filler loop has no idiom to compare against | AR #32 |

## Security Considerations

- **Data sensitivity**: none — compiler-internal control-flow transformation; no PII,
  credentials, or runtime data surfaces.
- **Input validation**: no new input surface; programs pass the existing lexer/parser/analyzer
  validation before reaching lowering.
- **Correctness as the security property**: the hazard is miscompiled control flow. A wrongly
  elided jump falls into the wrong block; a wrongly inverted branch is a logic inversion; a
  mis-threaded target silently reroutes execution. Mitigations: a dedicated layout suite
  asserting each transform in isolation, the preserved framing × polarity matrix, byte-exact
  goldens across the whole corpus, and the emulator fixture and twin tiers, which execute the
  transformed programs and assert observable behavior.
- **Termination**: both fixpoints must be provably terminating — threading via a visited set
  over trampoline chains (a cyclic trampoline is a legal program), relaxation via monotonicity
  (a relaxed branch never un-relaxes). A non-terminating pass is a compiler hang, and both are
  asserted directly.
- **Failure mode of the defect being fixed**: #65's current failure is a loud assembler range
  error, never a silent miscompile. The fix must not trade that for silence — a branch that
  cannot be relaxed is a compiler error, not a truncated offset.
- **Injection / rate limiting / encryption**: N/A (no runtime or product surface; governance
  per the requirements README).

## Acceptance Criteria

1. [ ] **No fall-through jumps remain**: no golden in the corpus contains an unconditional
   jump whose target label is the immediately-following line. Baseline: 47 across 9 of the 14
   goldens.
2. [ ] **No trampoline blocks remain**: no golden contains a block whose entire body is a
   single unconditional jump, except a self-referential one. Baseline: 13.
3. [ ] **Raster idiom reached** *(inherited, AR #20)*: the raster-poll golden's condition
   block is exactly a load of the raster register, an immediate compare, and a conditional
   branch back to itself — 3 instructions, 7 bytes, 9 cycles on the polling path — matching
   its hand-written twin instruction for instruction. Was 4 instructions / 10 bytes / 12
   cycles after RD-04.
4. [ ] **Dead blocks removed**: no golden defines a label that no branch or jump references
   (entry and startup symbols excepted). Specifically, the unreachable `RTS` epilogue present
   today in both the raster-poll and `guards` goldens is gone, and the `guards` scoreboard row
   attributing it to #59 has moved to #51.
5. [ ] **Branch inversion fires**: in the regenerated `guards` golden, the guard chain's
   `branch-to-true / jump-to-false / true-label-follows` sequence has become a single inverted
   branch to the false target, and the corresponding hand-derived compound-guard cycle
   constant is re-derived downward in `budgets.json`.
6. [ ] **Out-of-range branches assemble and run** *(closes #65)*: a do-while whose body
   exceeds the relative reach, and a switch whose dispatch-to-body distance exceeds it, both
   assemble under ACME and execute correctly on the emulator. In-range branches are untouched
   — no blanket short-branch-over-jump appears in any golden.
7. [ ] **Gating is uniform**: the emitted layout is identical with and without `--optimize`,
   and the out-of-range fixtures assemble under both.
8. [ ] **The framing matrix is intact**: every expected instruction sequence in the fused
   comparison framing × polarity oracle is byte-identical to its pre-RD-05 form; the only
   change to that file is the block order of its fixtures. Layout behavior is asserted in its
   own suite.
9. [ ] **Corpus health**: all goldens regenerated and hand-reviewed against their twins;
   `budgets.json` tightened to the new exact values in the same change; `SCOREBOARD.md`
   regenerated with the freshness gate green; local emulator fixture and twin tiers green;
   corpus bytes and static cycles both strictly decrease, with per-fixture deltas recorded.
10. [ ] **Boundary and safety verified**: the cross-package boundary tier is green; threading
    terminates on a cyclic trampoline and relaxation terminates on a chain of mutually
    displacing branches, both asserted directly; a terminator target resolving to no block
    still raises the internal compiler error RD-04 introduced, and a branch that cannot be
    relaxed raises one rather than emitting a truncated offset.
