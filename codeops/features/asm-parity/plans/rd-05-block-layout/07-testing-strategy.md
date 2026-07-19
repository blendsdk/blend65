# 07 — Testing Strategy

Specification tests derive from RD-05 and 6502 semantics **only** — never from running the
implementation. A failing spec test means the implementation is wrong.

`ST-B*` is a fresh prefix; no `ST-B` id exists in the tree, so nothing collides. Ids run
ST-B1…ST-B47; ST-B41…ST-B45 were added at preflight (AR #40–#47), and ST-B46/ST-B47 at
execution (AR #60, AR #62).

## Suites

| Suite | Tier | Runs in CI |
|---|---|---|
| `codegen/src/il/optimizer/thread-jumps.spec.test.ts` | unit | yes |
| `codegen/src/il/optimizer/remove-unreachable-blocks.spec.test.ts` | unit | yes |
| `codegen/src/instr/branch-tail.spec.test.ts` | unit — **authored in two parts**: the polarity cases in Phase 1, the tail-decision cases in Phase 3 | yes |
| `codegen/src/instr/block-layout.spec.test.ts` | translation-level, the integrated layout oracle (AR #33) | yes |
| `codegen/src/instr/relax-branches.spec.test.ts` | unit | yes |
| `test-harness/src/range-branches.spec.test.ts` | ACME-backed + a local VICE case; also owns the both-gatings cases (AR #41) | assembly yes, execution no |
| `test-harness/src/golden-layout.spec.test.ts` | permanent corpus invariant scan | yes |
| `compiler/src/api/emit.spec.test.ts` (extended, not new) | printed-IL honesty (AR #43) | yes |

**Why `block-layout.spec.test.ts` does not own the gating case.** `@blend65/codegen` depends only
on `@blend65/core` and `@blend65/frontend`; the `--optimize` flag is read in `@blend65/compiler`
(`emit.ts:139-141`), which codegen cannot import — the dependency runs the other way. A
codegen-resident gating test could only re-assemble the pipeline by hand and would prove nothing
about the production wiring. `@blend65/test-harness` depends on `@blend65/compiler` and has ACME in
CI, so it is the one place the whole of AC-7 can be proven through the real pipeline (AR #41).

## Specification test cases

### Jump threading

| ID | Input | Expected |
|---|---|---|
| **ST-B1** | `A: br T`, `T: br M` (T empty) | `A`'s terminator targets `M` |
| **ST-B2** | chain `A → T1 → T2 → T3 → M`, all trampolines | one pass resolves `A` to `M` |
| **ST-B3** | `A: brcmp … T/F` where both `T` and `F` are trampolines | **both** edges retarget |
| **ST-B4** | cyclic trampoline ring `T1: br T2`, `T2: br T1`, entered from `A` | the pass **terminates**, and `A`'s target is left **unchanged** — when a chain is cyclic, resolution abandons the rewrite rather than picking a member of the ring (AR #44) |
| **ST-B5** | self-loop `L: br L`, entered from `A` | `A` still reaches `L`; `L` is unchanged |
| **ST-B6** | a block with one instruction and `br M` | **not** a trampoline; no retarget |
| **ST-B7** | the entry block is itself a trampoline | it is not removed and keeps index 0 |
| **ST-B8** | run the pass twice | idempotent — second run returns an equal program |
| **ST-B9** | `initCode` block list containing a trampoline | threaded identically to a function |
| **ST-B47** | a trampoline chain that dead-ends in a label no block defines (AR #62) | the rewrite is abandoned — the incoming branch still targets the trampoline, which is not repaired either. Following the chain would copy one broken edge onto every branch that reached it, and removal would then drop the block that carried the mistake. Distinct from ST-B46, where the branch's *own* target is missing |

### Unreachable-block removal

| ID | Input | Expected |
|---|---|---|
| **ST-B10** | a block no terminator targets | dropped |
| **ST-B11** | the dead `RTS` epilogue shape from the raster-poll fixture | dropped |
| **ST-B12** | `L: br L` reachable from entry | **survives** (the carve-out) |
| **ST-B13** | a `brcond` on a literal-`0` condition | **both** arms stay reachable — this pass deliberately does not fold constant conditions |
| **ST-B14** | surviving blocks | keep their relative order |
| **ST-B15** | `initCode` with an unreachable block | dropped, rooted at `initCode[0]` |
| **ST-B41** | a function with `blocks.length === 0` | both passes are the identity and neither crashes — a zero-block function is a tolerated shape (`instr-program.ts:110-114` skips it), so a bare `blocks[0].label` root read would be a compiler crash on every error-tolerant compile |
| **ST-B42** | an **empty** `initCode` block list (the normal case) | both passes are the identity and neither crashes |
| **ST-B46** | a terminator targeting a label no block defines (AR #60) | both passes are total: removal does not throw, keeps the reachable blocks and *still* drops an unreferenced one; threading does not throw and leaves the target alone. The translator's `validateTerminatorTargets` stays the authority that reports the malformed function — crashing here would destroy that diagnostic |

### Branch tail (pure decision)

ST-B20 and ST-B21 cover `invertBranch`, which Phase 1 implements and wires into production through
relaxation. They are therefore authored in **Phase 1**, red before the implementation, and the rest
of this table is authored in Phase 3 as an extension of the same file (AR #42). The Phase 1 corpus
proof exercises the polarity table zero times — relaxation is a corpus no-op precisely because no
golden carries an out-of-range branch — so without these two cases a wrong `BVC`/`BVS` or
`BMI`/`BPL` entry would sit live in production for two phases with nothing looking at it.

| ID | Input `(branch, T, F, next)` | Expected |
|---|---|---|
| **ST-B16** | `(BEQ, "a", "b", "b")` | `elide` |
| **ST-B17** | `(BEQ, "a", "b", "a")` | `invert` with `BNE` |
| **ST-B18** | `(BEQ, "a", "b", "c")` | `both` |
| **ST-B19** | `(BEQ, "a", "b", undefined)` | `both` |
| **ST-B20** | every one of `BEQ BNE BCC BCS BMI BPL BVC BVS` | inverts to its partner, and inverting twice is the identity |
| **ST-B21** | any non-conditional opcode | `invertBranch` returns `undefined` (the caller raises an internal compiler error) |

### Layout at translation (integrated)

| ID | Input | Expected |
|---|---|---|
| **ST-B22** | `br` whose target is the next block | no `JMP` emitted; the target's label still emitted |
| **ST-B23** | each of the five comparison framings with true-target = next block | the framing's **final** branch inverts; every framing-internal branch keeps its polarity |
| **ST-B24** | 16-bit unsigned ordered with true-target = next block | only the last `BCC`/`BCS` participates; the two decisions inside `wordUnsignedDecision` are untouched |
| **ST-B25** | the raster-poll fixture, lowered → threaded → removed → translated | exactly `LDA` · `CMP` · conditional branch to its own label — 3 instructions, 7 bytes, 9 cycles on the taken path |
| **ST-B26** | an `unreachable`-terminated block followed by another block | nothing emitted for it; the following block is unaffected |

### Uniform gating (AC-7) — `test-harness/src/range-branches.spec.test.ts`

ST-B27 lives here, not in the layout suite, for the package-edge reason given above (AR #41). Its
assertions are enumerated rather than left as "the layout properties", so the case is writable
without reading the implementation.

| ID | Input | Expected |
|---|---|---|
| **ST-B27a** | one corpus source compiled through `emitAsm` with `optimize: true` and `optimize: false` | **both** outputs satisfy the ST-B39, ST-B40 and ST-B43 text predicates (AC-1, AC-2), applied to emitted text rather than to a committed golden |
| **ST-B27b** | the same two outputs | the **surviving block-label set is identical** between them — the AC-4 proxy at the emitted-text level, and specifically the dead `RTS` epilogue is absent from both |
| **ST-B27c** | both out-of-range range fixtures, each compiled under both gatings | all four assemble under ACME |

The scan predicates ST-B39/ST-B40/ST-B43 are shared helpers. They are consumed here in Phase 4 and
by the permanent corpus scan in Phase 5, so the helper module is authored with ST-B27 and the
Phase 5 suite imports it — not the other way round (AR #41).

### Relaxation

| ID | Input | Expected |
|---|---|---|
| **ST-B28** | a program with every branch in range | the **input reference** is returned; no entry changes |
| **ST-B29** | one branch at displacement +128 | rewritten to inverted-branch · `JMP` · minted label |
| **ST-B30** | one branch at displacement −129 | same |
| **ST-B31** | branches at exactly +127 and −128 | untouched (boundary) |
| **ST-B32** | a **cascade**: branch `X` out of range by a small margin, and branch `Y` sitting at displacement +127 (exactly in range) whose span **contains** `X`'s rewrite site. Relaxing `X` inserts 3 bytes inside `Y`'s span, pushing `Y` to +130 | the fixpoint relaxes `X` on the first iteration and `Y` on the second, then **terminates**. Constructing this needs `Y` at the boundary *and* spanning `X` — state both when authoring |
| **ST-B33** | a program whose **stream label set** already contains a symbol named like a minted label | the minted names do not collide with any stream or preamble label. Labels inside the appended runtime section are outside `InstrProgram.streams` and therefore outside what this check can see; a collision there is a loud ACME duplicate-symbol error, not a silent one (AR #45) |
| **ST-B34** | a `Relative` branch whose target label is absent from its stream | an internal compiler error, not a silent skip |
| **ST-B35** | a relaxed program | `preamble`, `allocationPlan` and `preambleOptions` pass through unchanged |

### Range fixtures (AC-6, closes #65)

| ID | Input | Expected |
|---|---|---|
| **ST-B36** | a `do…while` whose body exceeds the relative reach | assembles under ACME (CI); on local VICE the surviving loop counter reads exactly 3 — the observable a mis-encoded back edge would change |
| **ST-B37** | a `switch` whose dispatch-to-body distance exceeds it | assembles under ACME (CI); on local VICE the arm tag names the arm the dispatch reached, and that arm's body writes are present |
| **ST-B38** | both fixtures' output | in-range branches untouched — no blanket branch-over-jump. Asserted **per program on the `switch` probe and corpus-wide across both** (AR #58): the `do…while` probe's only conditional branch *is* the out-of-range back edge, so a per-program inequality there would contradict ST-B36. The corpus-wide form is what rules out a wrap-everything implementation. Also asserts the **positive** (AR #59): each probe still contains at least one branch that cannot be encoded short, so trimming a fixture body back inside the reach fails here instead of quietly making ST-B36/ST-B37 vacuous |

### Permanent corpus invariants (AC-13)

**Segmentation convention**, stated so two authors cannot write two different scans. A golden is
partitioned into function sections by the emitted `; --- function: <name>` marker lines; text before
the first marker (the preamble and `__startup:`) belongs to no function. Within a section, a
*label* is a line whose first non-space character starts at column 0 and ends in `:`; the *next
emitted label* after an instruction is the first such line following it inside the same section. A
*block body* is the instruction run between two consecutive labels.

| ID | Scope | Expected |
|---|---|---|
| **ST-B39** | every `*.asm.golden` | zero unconditional jumps whose target label is the next emitted label within the same function; `__startup`'s cross-function `JMP _main` is outside every function section and so is excepted structurally, not by a special case |
| **ST-B40** | every `*.asm.golden` | zero blocks whose whole body is one unconditional jump, except a self-referential one or a function entry block |
| **ST-B43** | every `*.asm.golden` | zero occurrences of the trigram `B<c> L` · `JMP x` · `L:` — a conditional branch over an unconditional jump, where `L` is the next emitted label. **Carve-out: labels matching the minted `_rlx<N>` pattern are exempt**, because that trigram *is* relaxation's own emitted form (`B<inv> _rlxN` · `JMP far` · `_rlxN:`) and banning it would forbid legitimate relaxed code from ever entering the corpus |
| **ST-B44** | the scan itself, run over the committed corpus | **non-vacuity**: at least one function section is parsed in every golden, and at least one unconditional jump is found corpus-wide. A marker-format drift that parsed zero sections would otherwise make all three invariants pass by finding nothing |

These four are the mechanism that outlives the hand review: a fixture added after this change
cannot reintroduce any of the three shapes.

**Why ST-B43 exists.** ST-B39 and ST-B40 between them see only the *elision* half of the tail
decision. A missed **inversion** leaves `B<c> T` · `JMP F` · `T:` — the jump targets a non-adjacent
label, and no jump-only block exists — so both original invariants pass. Since elision and inversion
are declared one decision, the same adjacency mistake is scan-visible in one polarity and
scan-invisible in the other; half-covering one decision is a hole, not a scoping choice. This
extends AC-13's enumerated list and is recorded against the RD (AR #40).

### Printed IL honesty (AC-11)

| ID | Suite | Expected |
|---|---|---|
| **ST-B45** | `compiler/src/api/emit.spec.test.ts` (extended) | `emitIl` on the raster-poll source shows no trampoline block and no unreachable block, and its block set equals the set emitted into the assembly by `emitAsm` on the same source. CI-runnable — no ACME, no VICE (AR #43) |

## Acceptance-criteria coverage

The **Kind** column distinguishes a committed test that runs on every future change from a one-shot
acceptance artifact, so the closeout walk cannot silently substitute one for the other.

| AC | Proven by | Kind |
|---|---|---|
| 1 — no fall-through jumps | ST-B39 + the regenerated corpus | committed test |
| 2 — no trampoline blocks | ST-B40 + the regenerated corpus | committed test |
| 3 — raster idiom | ST-B25 + the regenerated `rasterpoll` golden + its twin diff | committed test + hand review |
| 4 — unreachable removed, labels preserved | ST-B10, ST-B11, ST-B14, ST-B41, ST-B42; label survival proven by the budget tier resolving every window | committed test |
| 5 — inversion fires in `guards` | the regenerated golden + the re-derived `compoundGuard` constant in both files | **hand review + ratchet**; the independent check is the direction constraint (↓) and the prediction 24 → 18 recorded in `02-current-state.md` before regeneration |
| 6 — out-of-range assembles and runs | ST-B36, ST-B37, ST-B38 | committed test (execution leg local-only) |
| 7 — gating uniform | ST-B27a, ST-B27b, ST-B27c | committed test |
| 8 — oracles resolved as specified | `translate-brcmp` per-row arrays byte-identical; `switch-translate` superseded in writing; `translate.impl` **branch-pair lines** byte-identical (its full-text array grows by the filler's label and `RTS` — see `03-04` §3) | committed test |
| 9 — corpus health | golden suites, budget tier (**including every program's `bytes` ratchet**), scoreboard freshness gate, local emulator tiers, the delta record | committed test for per-fixture bytes and windows; **hand-computed** for the corpus totals and the per-fixture cycle deltas |
| 10 — boundary and safety | root boundary tier; ST-B4 (threading terminates), ST-B32 (relaxation terminates), the existing dangling-target internal error, ST-B34; the "no truncated offset" clause is carried by ST-B29…ST-B31 plus the ACME assembly tier, which is what would reject a bad displacement | committed test |
| 11 — printed IL honest | ST-B45 | committed test |
| 12 — landmarks re-anchored correctly | the re-anchored fixture suites' **existing body-written checks** at `arrivals = 2` — `rasterpoll` `$0400 == 1` ("frame counter after one body"), `guards` `$0400-$0403`, `balloon` sprite x/y `174/141` after one `+2` step. Anchored on the poll block those read pre-body state and fail; anchored on the frame-body block they pass. The check set **is** the once-per-frame witness (AR #46) | committed test (local tier) |
| 13 — invariants self-enforcing | ST-B39, ST-B40, ST-B43, ST-B44 committed | committed test |

**A standing property AC-12 depends on.** The re-anchoring hazard is defeated only because all
three fixtures' check sets assert *first-body-written* state. That is a property to preserve
deliberately, not a happy accident — `balloon`'s table also carries init-only checks (`$07f8`,
`$d015`, `$d027`), and a future fixture whose observables were *entirely* init-state would make a
poll-anchored landmark pass against a meaningless state. **Every re-anchored fixture's check set
must include at least one value written by the frame body.** Recorded as AR #46.

## Impl-tier tests

No `*.impl.test.ts` file is added for the IL passes. Idempotence under repeated scheduling,
`initCode` rooting and surviving-block order are pinned at spec tier by ST-B8, ST-B9, ST-B14 and
ST-B15; a parallel impl suite would be a second oracle for the same behavior with no separate
subject (AR #47).

## Verification ladder

Per task: `yarn workspace @blend65/<pkg> test`. Per phase and before every commit:

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

Local-only (VICE 3.10 + ACME 0.97 present on this machine; CI has no emulator tier per AR-27):
the fixture and twin suites, the range-fixture execution case, and balloon's measured
`frameUpdate` re-measurement. Local emulator suites run sequentially
(`fileParallelism: false`) so concurrent `x64sc` instances do not contend.

Prettier is configured but never run by any script or hook, so `npx prettier --check` is run on
each touched file and only the lines this change adds are hand-fixed.
