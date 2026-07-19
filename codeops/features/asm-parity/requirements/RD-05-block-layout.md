# RD-05: Block Layout — Fall-Through Elision + Jump Threading

> **Document**: RD-05-block-layout.md
> **Status**: Draft (preflighted — 30 findings applied, see `00-preflight-report.md`;
> **3 further amendments 2026-07-20** from the plan preflight — AC-10, AC-13 and the
> label-re-anchoring hazard text)
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
corpus that is **105 `JMP`s, of which 47 target the immediately-following label within the same
function and 13 blocks consist of nothing but a jump**. The `guards` fixture emits 23 `JMP`s
where its hand-written twin emits 1. An assembly developer lays blocks out so the common path
falls through, threads a jump that lands on another jump straight to the destination, and picks
the branch polarity that avoids the jump entirely — none of which the emitter does today,
because it walks `ILFunction.blocks` in lowering order and emits each terminator verbatim
(`packages/codegen/src/instr/translate.ts:264-284`).

This RD makes emission layout-aware: suppress a jump to the next block, thread branches through
trampoline blocks, drop what that orphans, and invert a conditional branch when its true target
is the fall-through. It also discharges two obligations inherited in writing. From RD-04
(AR #20): the raster-poll golden must reach the **twin-byte-comparable 3-instruction idiom** —
fusion took it from 9 instructions to 4, and closing the rest takes three of this RD's
transforms working in sequence (threading retargets the back-edge, removal drops the orphaned
trampoline, and only then is the exit block adjacent enough to elide). From RD-04's Won't-Have
(AR #25): the pre-existing **relative-branch range defect**
([#65](https://github.com/blendsdk/blend65/issues/65)), whose fix was routed here because
relaxation is a function of final block geometry — which this RD is what settles.

The transforms are pure control-flow rewrites with no language-surface change, and they reach
every fixture in the corpus that contains a branch.

## Functional Requirements

### Must Have

- [ ] **Fall-through elision.** An unconditional jump whose target is the block emitted
  immediately after it *within the same function* is not emitted at all. Applies to every
  terminator that emits a trailing `JMP`: the `br` terminator, the `brcond` false edge, and the
  fused comparison's false edge across all five framings. Cross-function fall-through is never
  exploited — the startup shim's `JMP _main` (emitted outside the touched packages, at
  `packages/platforms/src/shared-hooks.ts:154`) is deliberately left in place, which is why the
  baseline is 47 and not 48.
- [ ] **Branch inversion.** Fall-through elision and inversion are **one decision**, not two
  transforms: given a conditional branch to `T` followed by `JMP F`, with `N` the next emitted
  block — if `F === N`, drop the `JMP`; if `T === N`, emit the inverted branch to `F` alone;
  otherwise emit both. Comparison-framing-internal branches (the signed-overflow correction, the
  word early-outs) are not block tails and are never inverted. The decision is deliberately
  **range-blind** — it is taken before any instruction address exists — so inversion may hand
  relaxation a branch that is out of reach; see the relaxation requirement, which is the sole
  range authority. *(AR #26)*
- [ ] **Jump threading.** Any branch or jump whose target block consists solely of an
  unconditional jump to `M` is retargeted to `M` directly. Threading chain-follows trampolines
  through a visited set, so a chain of jump-only blocks resolves in one pass and a cyclic
  trampoline terminates instead of looping. "Consists solely of" means an empty `instructions`
  list; this is exact today, because the only zero-effect IL instruction is `source_span`
  (`packages/codegen/src/il/instruction.ts:146`) and no producer for it exists in the codegen
  package. Should one appear, the predicate must treat a provenance-only body as empty and
  re-attach or drop the span rather than silently under-firing. *(AR #26)*
- [ ] **Unreachable-block removal.** A reachability walk drops every block no longer reachable —
  both blocks orphaned by threading and blocks already orphaned upstream. Roots, stated once: each
  function's own entry block, plus an equivalent walk over the module-initializer block list
  (`packages/codegen/src/il/cfg.ts:114-125`), which is not a function. The walk is the one
  `packages/codegen/src/il/termination.ts:30-66` already performs for a different purpose (its
  `seen` set *is* the reachable set); this pass factors out the shared successor walk but
  deliberately does **not** inherit that function's constant-`brcond` edge refinement — folding
  constant conditions belongs to the const-fold pass (AR #21), and a conservative walk here keeps
  the two from disagreeing about reachability. This ships as an independently schedulable pass
  because it has a second client: the const-fold pass orphans blocks the same way and must be
  able to re-run it after folding. **Carve-out:** a self-referential jump-only block (`L: JMP L`
  — the emitted form of `while (true) {}`) is reachable and semantically load-bearing; it
  survives. *(AR #29)*
- [ ] **Layout is unconditional.** These transforms run regardless of the `--optimize` flag.
  Emitting a jump to the next instruction is a defect under the Prime Directive, not a withheld
  optimization; and branch relaxation below is a *correctness* transform whose distances must be
  measured over the geometry that is actually emitted — so layout and relaxation cannot be gated
  differently. *(AR #30)*
- [ ] **Branch relaxation ([#65](https://github.com/blendsdk/blend65/issues/65)).** A conditional
  branch whose target lies outside the 6502's −128..+127 relative reach is emitted as an inverted
  short branch over an absolute jump. The emitted form mints a synthetic local label —
  `B<inv> _rlxN` / `JMP far` / `_rlxN:` — because the instruction model has no PC-relative operand
  (`InstrOperand` is `none | immediate | symbolRef | labelRef | zpSlot`,
  `packages/core/src/instr-model/operand.ts:30-39`), and `*+5` is therefore not representable.
  Label uniqueness uses the program-shared counter pattern already established for `_cmpN`
  (`packages/codegen/src/instr/translate.ts:91-97`). Relaxation is applied **only** where the
  target is genuinely out of reach — no blanket pessimization — and iterates to a fixpoint,
  because relaxing one branch inserts bytes and can push another out of range. It is the **sole
  range authority**: it covers branches that exist only after translation (the shift loops, the
  comparison-framing tails, the word-equality early-outs) *and* branches newly created by
  inversion. Where inversion produced an out-of-reach branch, relaxation reconstitutes the
  branch-over-jump form: since inversion fires only when the true target is the next block, the
  reconstituted shape places the same two instructions at the same offsets as the pre-RD-05 form,
  so it is byte- **and** cycle-identical to what was emitted before this RD. It is one cycle worse
  only than the short inverted branch that would have been emitted had the target been in reach —
  a forgone improvement, not a regression. The stage returns a new `InstrProgram` that
  becomes both the serialized text **and** `AssembledAsm.program`, so the compile report's cost
  summary (`packages/compiler/src/api/build.ts:92`) does not under-report relaxed branches.
  *(AR #28)*
- [ ] **The twin-byte-comparable raster idiom.** The inherited acceptance criterion from RD-04:
  the raster-poll condition block reaches the hand-written form — a load, a compare, and a
  conditional branch back to itself — via threading, then removal of the orphaned trampoline,
  then elision of the now-adjacent exit jump. *(AR #20)*
- [ ] **Printed IL stays honest.** Because threading and unreachable-block removal run as IL
  passes, `--emit-il` shows exactly the edges and blocks that reach the emitter — it must not
  display trampolines and dead blocks that are then silently discarded downstream. (Note that
  `ILPass.name` is currently unsurfaced: no stage-label output exists, despite the forward-looking
  JSDoc at `packages/codegen/src/il/optimizer/pass.ts:22`. This requirement is about the printed
  program, not stage labels.) *(AR #26)*
- [ ] **Threading, removal, elision and inversion land as ONE change.** Threading alone still
  emits the `JMP`; elision alone still routes through the trampoline. Split across phases, the
  goldens and every budget artifact churn twice for one result. Golden regeneration happens once,
  after all four transforms and relaxation are in. *(AR #26)*
- [ ] **Label-anchored artifacts are re-anchored in the same change.** `Main_main_L0` is a pure
  trampoline in the `rasterpoll`, `guards` and `balloon` fixtures and is deleted by this RD, yet
  it is hard-coded as `LOOP_HEAD_LABEL` in `packages/test-harness/src/rasterpoll.spec.test.ts:21`,
  `guards.spec.test.ts:27` and `balloon.spec.test.ts:24`, and as `frameUpdate.toLabel` in
  `packages/test-harness/test/golden/budgets.json:56`. Re-anchoring must **re-derive the arrival
  semantics, not textually substitute the label**: after threading, the frame back-edge and the
  poll back-edge both land on the poll block, so that block is reached once per poll *iteration*,
  not once per frame — an `arrivals`-based landmark re-anchored there would stop inside the first
  frame with no body updates run. The correct anchor is the post-poll frame-body block, the only
  surviving once-per-frame program point.
  **Corrected at plan preflight (PF-009).** This clause previously said such a re-anchor would
  *silently* invalidate the observable assertions. It would not, for these three fixtures: all
  three check sets assert frame-body-written state (`rasterpoll` `$0400 == 1`, "frame counter after
  one body"; `guards`' four verdicts at `$0400-$0403`; `balloon`'s sprite x/y at `174/141` after
  one `+2` step), so a poll-anchored landmark reads pre-body state and fails **loudly**. The
  re-anchoring requirement is unchanged — anchoring on the poll block breaks the suites either way
  — but AC-12 is discharged by those existing checks rather than by a new assertion. The property
  that defeats the hazard is now stated so it is preserved deliberately: **every re-anchored
  fixture's check set must include at least one value written by the frame body.** A fixture whose
  observables were entirely init-state would make the originally-feared silent green real.
- [ ] **Corpus supersession, same change.** All goldens regenerated and hand-reviewed. Budgets
  tightened to the new exact values across **all four** windows — `rasterpoll.pollIter` (15),
  `guards.compoundGuard` (24), `slice8b.copyLoop` (60, whose slice contains both an inversion and
  an elision site), and `balloon.frameUpdate` (static 235, measured 133). The measured balloon
  figure is VICE-derived and can only be re-measured on the local emulator tier (AR-27), so that
  step cannot be completed in CI and must be scheduled locally. The two hand-derived constants
  live in TypeScript with their derivations in comments
  (`packages/test-harness/src/budgets.spec.test.ts`), not only in `budgets.json`; both files
  change and the derivation comments are re-transcribed from the regenerated goldens.
  `SCOREBOARD.md` regenerated and its freshness gate green. *(AR #12, AR #17, AR #24, AR #31)*
- [ ] **Divergence routing updated at its source.** Routing lives in
  `packages/test-harness/test/golden/twins.json`, not in the generated `SCOREBOARD.md`. The three
  `#51` entries (`guards`, `rasterpoll`, `balloon` — two rows each) are deleted or retargeted to
  the residual divergence, and the `guards` `#59` "unreachable epilogue" entry moves to `#51`,
  which this RD's removal pass is what fixes. The free-text notes ("JMP 23 vs 1", "JMP 21 vs 3",
  "JMP 7 vs 1") are **not** validated by the freshness gate
  (`scripts/gen-parity-scoreboard.mjs:97-107` checks routing categories only), so refreshing them
  is a hand-review item that CI cannot catch. *(AR #29)*
- [ ] **Affected spec oracles have a stated disposition, per file.** Two are affected and each
  gets an explicit decision rather than a discovery at red-test time:
  - `packages/codegen/src/instr/translate-brcmp.spec.test.ts` — **preserved**. The fixture builds
    exactly three blocks with the entry pinned at index 0 (`packages/codegen/src/il/cfg.ts:88`),
    so no *ordering* of three blocks can keep a target non-adjacent; preservation is achieved by
    **interposing a non-target filler block**. Every per-row `expected` instruction array stays
    byte-identical; the only other change is `expectFused`'s rendered trailing scaffold and the
    fixture's doc comment. That matrix exists because a fused branch "would still look plausible
    in isolation; only the pair pins it", and branch inversion is precisely a polarity flip — so
    it must not be folded into the polarity oracle.
  - `packages/codegen/src/instr/switch-translate.spec.test.ts:63-64` — **superseded in writing**
    (AR #24 procedure). It runs the real pipeline and asserts `CMP / BEQ / JMP`, a shape elision
    rewrites; the assertions move to the post-layout form.
  `packages/codegen/src/instr/multiblock-translate.spec.test.ts` was checked and is **not**
  affected — its assertions are loose enough to survive. *(AR #31)*
- [ ] **The structural invariants are permanently enforced, not inspected once.** A committed
  corpus-invariant test asserts, across every golden, zero intra-function fall-through jumps and
  zero non-self-referential trampoline blocks — so a future fixture cannot reintroduce either.
  Hand review at acceptance is a one-time act; the gate must outlive it (the AR #18 precedent
  that an audit-day state becomes a permanently enforced mechanism).
- [ ] **Closeout delta record.** Per-fixture before/after bytes and straight-line cycles, quoted
  in the area report on the issue.

### Should Have

- [ ] Where the per-fixture delta record shows a pair whose residual divergence is now dominated
  by a different cause, note the re-attribution in the area report so the next wave item inherits
  an accurate picture.

### Won't Have (Out of Scope)

- **Block reordering / trace scheduling** — moving cold arms out of line so the hot path falls
  through. This RD exploits the existing lowering order only, per issue #51's own framing ("after
  block order is fixed"). Reordering changes branch distances and so interacts with relaxation; it
  is a separate item, filed if the scoreboard shows residual cost. *(AR #27)*
- **Peephole pattern rewrites** — redundant load/store elimination, `INC`/`DEC` selection, and the
  rest of the seed catalog belong to RD-06
  ([#52](https://github.com/blendsdk/blend65/issues/52)). This RD adds no rule to that catalog.
  *(AR #26)*
- **Constant-driven unreachability** — folding a computed-constant condition and discarding the arm
  it kills belongs to the const-fold pass, which reuses this RD's removal pass rather than
  duplicating it. *(AR #21, AR #29)*
- **A new corpus fixture for the range cases** — a >127-byte filler loop has no hand-written idiom
  to be compared against, so a twin would be mechanical filler that dilutes the parity corpus.
  Range is proven at the unit tier. *(AR #32)*
- **Register allocation, ABI, and startup ceremony** — RD-07 (#53) and RD-10 (#59).

## Technical Requirements

The four transforms do not share a seam, because the information each needs exists in a different
place. Three seams are already wired and empty; the allocation below follows where the facts live.
*(AR #26)*

### Jump threading + unreachable-block removal (complexity: M)

Two `ILPass`es — `packages/codegen/src/il/optimizer/thread-jumps.ts` exporting
`threadJumps` (`name: "thread-jumps"`) and `remove-unreachable-blocks.ts` exporting
`removeUnreachableBlocks` — registered in the pipeline that already runs unconditionally
(`packages/compiler/src/api/emit.ts:108`, today `optimizeIL(il, [], bag)`). At this level blocks
and terminator edges are first-class (`packages/codegen/src/il/cfg.ts`), so threading is a record
rewrite over terminator targets and removal is the reachability walk described above. Two passes
rather than one: removal must be independently schedulable for the const-fold pass, and each is
testable in isolation as `ILProgram → ILProgram` against the existing runner's test pattern.

RD-05 registers `[threadJumps, removeUnreachableBlocks]`. Whichever of RD-05 and the const-fold
pass lands second inserts `constFold` ahead of them; RD-05 has no dependency on that pass, the
dependency runs the other way. *(AR #33)*

### Fall-through elision + branch inversion (complexity: M)

Translation time is the only place block adjacency exists — the IL deliberately cannot represent
fall-through ("control leaves a block only via its terminator",
`packages/codegen/src/il/cfg.ts:24-26`). The reason this cannot instead be a post-translation
stage is **not** that block identity disappears — label entries do survive in the flat stream
(`packages/core/src/instr-model/stream.ts:62`), which is precisely why relaxation can run there.
It is that **branch-tail identity** disappears: after translation a block-tail conditional is
indistinguishable from a comparison-framing-internal branch by anything but naming convention, and
inversion must never touch the latter. Elision rides along because the two are one decision.

The block loop at `packages/codegen/src/instr/translate.ts:264-284` gains the next block's label
and threads it into the terminator sites that emit a trailing jump. The decision itself —
including the polarity-inversion table — lives in `packages/codegen/src/instr/branch-tail.ts`
rather than growing `translate.ts`, which is already 2250 lines against the project's 500-line
guideline. *(AR #33)*

Two details to handle explicitly. The next-label comparison must account for the entry block, whose
emitted label is the sanitized function name (`translate.ts:247`) rather than a generated block
label (`:381-383`) — and the two schemes genuinely differ (`_main` vs `Main_main_L0`); a mismatch
is either a dangling-label assembler error or a silently missed elision that only the budget
ratchet would catch. And an `unreachable`-terminated block emits nothing
(`translate.ts:611-612`), so it needs no adjacency handling — it already physically falls into
whatever follows, harmlessly, since control provably cannot arrive.

### Branch relaxation (complexity: M)

A new stage, `packages/codegen/src/instr/relax-branches.ts` exporting
`relaxBranches(program, cpu, bag)`, run unconditionally in the emit pipeline after the optional
peephole so it measures post-peephole sizes. It is **not** a peephole rule: the peephole is gated
on `--optimize` (`packages/compiler/src/api/emit.ts:139-141`) while relaxation is correctness and
must always run — and secondarily, expressing it there would require redesigning the rule contract
(`packages/codegen/src/instr/peephole.ts:47-60`) that RD-06 is about to build on. Distances come
from the existing per-instruction size function
(`packages/codegen/src/instr/print-instr.ts:239-252`). The algorithm is the standard monotone
fixpoint — once a branch is relaxed it stays relaxed, iterate until no branch changes — which
terminates over a finite branch set. *(AR #33)*

### Test surfaces (complexity: S)

A dedicated suite, `packages/codegen/src/instr/block-layout.spec.test.ts`, pins elision, inversion,
threading, removal, and the self-loop carve-out. A committed corpus-invariant scan enforces the
structural properties across every golden. The range cases (a do-while body and a switch dispatch
each exceeding the relative reach) are proven at the unit tier: an assembler-backed spec test that
runs in CI proves they assemble and that in-range branches are untouched, and a local emulator case
proves they run correctly. *(AR #32, AR #33)*

## Integration Points

### Packages touched
`@blend65/codegen` and `@blend65/compiler` (production), plus `@blend65/test-harness` (goldens,
budgets, the routing manifest, the layout suite and the corpus-invariant scan).
`@blend65/frontend` and `@blend65/language-server` are untouched — the R15 / AR-20 boundary holds
and its tier must stay green.

### With RD-04 (compare-and-branch fusion)
Consumes its output. The fused terminator threads exactly like `brcond`, and its false edge is one
of the trailing jumps elision removes. RD-04 left the raster golden at 4 instructions against the
twin's 3; closing that gap is this RD's headline criterion.

### With RD-01 (parity instruments) / RD-02 (twin corpus + scoreboard)
The budget tier asserts the tightened values across all four windows; the scoreboard regenerates
against unchanged twins. Three pairs carry #51 routing rows today (`guards`, `rasterpoll`,
`balloon`) and are expected to lose them.

### With the const-fold pass (split from #58)
The const-fold pass **depends on** this RD: it orphans blocks by folding and needs
`removeUnreachableBlocks` to clean up, which AR #29 assigned here precisely to avoid two
implementations. The dependency is one-way. Wave B1's ordering must therefore place RD-05 (or at
least its removal pass) before the const-fold pass.

### With RD-06 / #52 (peephole seed catalog)
Disjoint by construction: RD-06 owns the instruction peephole's rule catalog; this RD adds no rule
to it and leaves its contract untouched. Relaxation runs after the peephole so it measures final
sizes.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Transform placement | split by seam / all at translation / all at the instruction peephole | Threading + removal as IL passes; elision + inversion as one tail decision at translation; relaxation as a new unconditional stage | Each transform sits where its facts exist. Inversion needs branch-tail identity, which only exists during translation. The peephole is ruled out first by its `--optimize` gating (relaxation must always run) and second because expressing it there would require redesigning a contract RD-06 is about to build on | AR #26 |
| Relaxation form | `B<inv> *+5` / minted local label / extend the core operand model | Minted local label (`B<inv> _rlxN / JMP far / _rlxN:`) | `*+5` is not representable — `InstrOperand` has no PC-relative variant; minting keeps `@blend65/core` out of scope and reuses the established program-shared label counter | AR #28 (form corrected at preflight, PF-020) |
| Block reordering | out of scope / include a heuristic | Out of scope | Issue #51 scopes itself to a fixed block order; reordering perturbs branch distances and so entangles with relaxation | AR #27 |
| #65 relaxation | inside RD-05 / follow-up RD | Inside | Shares the prerequisite (settled geometry) and the unconditional siting; deferring ships a known-reachable build failure | AR #28 |
| Unreachable-block removal | RD-05 owns the mechanism / each client ships its own | RD-05 owns it as a reusable pass | Two clients (threading, const-fold); duplication would put the same logic in two places | AR #29 |
| Gating | unconditional / behind `--optimize` | Unconditional | Relaxation is correctness and must measure emitted geometry; differing gates would mean two geometries | AR #30 |
| Oracle supersession | supersede what the seam reaches / blanket supersede / preserve the framing matrix | Preserve the framing matrix via an interposed filler block; supersede the switch oracle in writing | Every per-row expectation stays byte-identical; inversion is a polarity flip and must not be folded into the polarity oracle | AR #31 |
| Range-case test tier | unit tier / new corpus fixture + twin | Unit tier | Range is a correctness property; a filler loop has no idiom to compare against | AR #32 |

## Security Considerations

- **Data sensitivity**: none — compiler-internal control-flow transformation; no PII, credentials,
  or runtime data surfaces.
- **Input validation**: no new input surface; programs pass the existing lexer/parser/analyzer
  validation before reaching lowering.
- **Correctness as the security property**: the hazard is miscompiled control flow. A wrongly
  elided jump falls into the wrong block; a wrongly inverted branch is a logic inversion; a
  mis-threaded target silently reroutes execution. Mitigations: a dedicated layout suite asserting
  each transform in isolation, the preserved framing × polarity matrix, byte-exact goldens across
  the whole corpus, and the emulator fixture and twin tiers, which execute the transformed programs
  and assert observable behavior.
- **Silent test invalidation is a first-class hazard here.** Several assertions are anchored to
  generated block labels that this RD deletes. The failure mode of a careless re-anchor is not a
  red test but a green one asserting nothing meaningful — which is why re-anchoring is specified as
  a semantic re-derivation with its own acceptance criterion.
- **Termination**: both fixpoints must be provably terminating — threading via a visited set over
  trampoline chains (a cyclic trampoline is a legal program), relaxation via monotonicity (a
  relaxed branch never un-relaxes). A non-terminating pass is a compiler hang, and both are
  asserted directly.
- **Assumption to be proven, not assumed**: #65's current failure is believed to be a loud
  assembler range error rather than a silent miscompile, but **no fixture in the repo has ever
  exercised a >127-byte branch**, so this is an untested prediction about ACME's behavior. This
  RD's own range fixtures are what establish it; until they exist the claim carries no weight, and
  if the observed behavior turns out to be a silent truncation, that raises #65's severity and must
  be reported rather than absorbed.
- **Injection / rate limiting / encryption**: N/A (no runtime or product surface; governance per
  the requirements README).

## Acceptance Criteria

1. [ ] **No intra-function fall-through jumps remain**: no golden contains an unconditional jump
   whose target label is the next emitted label within the same function. The startup shim's
   cross-function `JMP _main` is excepted by design. Baseline: 47 across 9 of the 14 goldens.
2. [ ] **No trampoline blocks remain**: no golden contains a block whose entire body is a single
   unconditional jump, except a self-referential one or a function entry block. Baseline: 13.
3. [ ] **Raster idiom reached** *(inherited, AR #20)*: the raster-poll golden's condition block is
   exactly a load of the raster register, an immediate compare, and a conditional branch back to
   itself — 3 instructions, 7 bytes, and **9 cycles on the executed polling path** (the metric AC-3
   uses throughout; note the committed `pollIter` budget constant measures a different quantity,
   the whole static slice, and reads 15 today) — matching its hand-written twin instruction for
   instruction.
4. [ ] **Unreachable blocks removed, labels preserved**: no golden emits a block that is
   unreachable from its function's entry — specifically the dead `RTS` epilogue present today in
   both the raster-poll and `guards` goldens is gone. Every *surviving* block keeps its emitted
   label, including labels that survive only as fall-through anchors; budget windows and emulator
   landmarks depend on those labels resolving.
5. [ ] **Branch inversion fires**: in the regenerated `guards` golden, the guard chain's
   branch-to-true / jump-to-false / true-label-follows sequence has become a single inverted branch
   to the false target, and the corresponding hand-derived compound-guard constant is re-derived
   downward in both `budgets.json` and `packages/test-harness/src/budgets.spec.test.ts`.
6. [ ] **Out-of-range branches assemble and run** *(closes #65)*: a do-while whose body exceeds the
   relative reach, and a switch whose dispatch-to-body distance exceeds it, both assemble under
   ACME (CI tier) and execute correctly on the **local** VICE tier (skipped in CI per AR-27). The
   relaxed form is the minted-label shape; in-range branches are untouched — no blanket
   branch-over-jump appears in any golden.
7. [ ] **Gating is uniform**: with and without `--optimize`, both outputs satisfy AC-1, AC-2 and
   AC-4, and both out-of-range fixtures assemble. (Stated as layout properties rather than byte
   identity, so the criterion survives RD-06 landing peephole rules in the same wave.)
8. [ ] **Affected oracles resolved as specified**: in `translate-brcmp.spec.test.ts` every per-row
   `expected` instruction array is byte-identical to its pre-RD-05 form, with the fixture gaining a
   filler block and `expectFused`'s trailing scaffold updated; `switch-translate.spec.test.ts` is
   superseded to the post-layout shape with the decision recorded.
9. [ ] **Corpus health**: all goldens regenerated and hand-reviewed against their twins; all four
   budget windows tightened to exact values in the same change, with `balloon.frameUpdate`'s
   measured figure re-derived on the local emulator tier; `twins.json` routing updated at source
   with its free-text counts refreshed; `SCOREBOARD.md` regenerated with the freshness gate green;
   local emulator fixture and twin tiers green. Corpus-**total** bytes and static cycles both
   strictly decrease and no individual fixture regresses on either metric (the 5 branch-free
   goldens are expected to be unchanged, not improved); per-fixture deltas recorded, including
   `balloon`, which has no golden and is measured from its live compile.
10. [ ] **Boundary and safety verified**: the cross-package boundary tier is green; threading
    terminates on a cyclic trampoline and relaxation terminates on a **displacement cascade** — a
    branch whose relaxation inserts bytes inside another branch's span and pushes that one out of
    range — both asserted directly; a terminator target resolving to no block still raises the
    internal compiler error RD-04 introduced; and no relaxed branch is ever emitted with a
    truncated offset.
    *(Phrasing corrected at plan preflight, PF-004: this clause previously said "a chain of
    mutually displacing branches". True mutual displacement cannot exist — a relaxed branch becomes
    an absolute `JMP` and leaves the candidate set, which is exactly what makes the fixpoint
    monotone. The cascade is the real shape, and the earlier wording had produced a spec test case
    that a correct implementation would fail.)*
11. [ ] **Printed IL is honest**: `--emit-il` on the raster-poll fixture shows no trampoline block
    and no unreachable block, and its block set equals the set emitted into the assembly.
12. [ ] **Label-anchored artifacts re-anchored correctly**: the three `LOOP_HEAD_LABEL` constants
    and `budgets.json`'s balloon `frameUpdate.toLabel` point at surviving labels, and the
    re-anchored landmark is asserted to be reached **once per frame** — not once per poll
    iteration — so the observable assertions still measure what they claim to.
13. [ ] **The structural invariants are self-enforcing**: a committed corpus-invariant test fails
    if any golden acquires an intra-function fall-through jump, a non-self-referential trampoline
    block, **or a conditional branch over an unconditional jump to the next emitted label**, so
    AC-1 and AC-2 hold for fixtures added after this RD. The scan also self-checks for
    non-vacuity — at least one function section parsed per golden — so a marker-format drift
    cannot make it pass by finding nothing.
    *(Third shape added at plan preflight, PF-006.* The first two invariants see only a missed
    **elision**. A missed **inversion** leaves `B<c> T` · `JMP F` · `T:` — the jump targets a
    non-adjacent label and no jump-only block exists — so both original invariants pass. Since this
    RD declares elision and inversion one decision, the same adjacency mistake is scan-visible in
    one polarity and invisible in the other. **Carve-out:** labels matching the minted `_rlx<N>`
    pattern are exempt, because that trigram is precisely the emitted form of branch relaxation
    required above; without the exemption this invariant would forbid legitimate relaxed code from
    ever entering the corpus.*)
