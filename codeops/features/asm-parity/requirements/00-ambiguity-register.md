# Ambiguity Register: asm-parity requirements

> **Status**: ✅ GATE PASSED — all 48 items resolved (RD-01 items 1–14: 2026-07-17 · RD-02 items 15–19: 2026-07-18 · RD-04 items 20–25: 2026-07-19 · RD-05 items 26–33: 2026-07-19 · RD-03 items 64–68: 2026-07-20 · RD-13 items 78–82 + preflight runtime items 83–87: 2026-07-20 — numbering continues past the plan-stage registers so a single `AR #n` is unambiguous across the feature)
> **Last Updated**: 2026-07-20
> **Scope**: see the per-RD sections below — each carries its own item range and gate status, so this header never needs to enumerate them again.
> **CodeOps Skills Version**: 3.10.0

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Technical | VICE cycle-count source is unverified — the driver's binary-monitor `CMD` table has no cycle counter; VICE exposes raster-position registers (LIN/CYC), not a confirmed cumulative counter | (a) Defer mechanism to make_plan protocol spike (RD requires cycle-exact, deterministic measurement; plan picks the mechanism) / (b) mandate raster-position + frame arithmetic now / (c) mandate single-step counting now | ⏸ Deferred — the VICE cycle-measurement mechanism (counter command vs. raster arithmetic vs. single-step) · owner: user at RD-01 make_plan · revisit: protocol spike against VICE 3.10 at plan time. RD pins the requirement: cycle-exact, deterministic. | ⏸ Deferred |
| 2 | Behavioral | `measureCycles` contract undefined | Measured value = all CPU cycles between arrival at from-label and arrival at to-label, including any IRQ cycles in the window; deterministic across runs of the same binary; per-frame loop measurement is expressed via label placement (no separate API) | ✅ Resolved — User accepted recommendation: contract as stated (all CPU cycles between label arrivals, IRQs included, deterministic; no separate per-frame API) | ✅ Resolved |
| 3 | Data | Where cycle/byte budgets live | (a) Single `packages/test-harness/test/golden/budgets.json` (all fixtures, bytes + cycles sections) / (b) per-fixture sidecar `<fixture>.budget.json` / (c) inline constants in test files | ✅ Resolved — User accepted recommendation: (a) single `budgets.json` beside the goldens | ✅ Resolved |
| 4 | Behavioral | CI behavior when a golden's binary grows without a budget update | (a) Hard-fail the job (ratchet gate; deliberate budget update in the same PR unblocks) / (b) informational PR comment only / (c) hybrid: comment always, fail above a threshold % | ✅ Resolved — User accepted recommendation: (a) hard-fail (ratchet gate) | ✅ Resolved |
| 5 | Scope | Enforcement split across CI (no VICE, has ACME) and local tiers | Static-estimate budget assertions run in CI; measured-cycle assertions run in the local `skipIf(!hasVice())` tier; both first-class (as stated in issue #64) | ✅ Resolved — User accepted recommendation: split as stated (static asserts in CI, measured asserts local, both first-class) | ✅ Resolved |
| 6 | Technical | Home of the per-instruction 6502 timing table (base cycles, page-cross/branch penalties, byte sizes) — needed by annotator, resource report, and budget tier | (a) New `timing` module in `@blend65/core` (already imported by every consumer; R15-safe) / (b) test-harness-local / (c) embedded in the script | ✅ Resolved — User accepted recommendation: (a) `@blend65/core` `timing/` module | ✅ Resolved |
| 7 | Data / UX | Semantics of "per-function cycle estimates" in the resource report (functions contain loops/branches — a single number is ill-defined) | (a) Straight-line min–max per function (each instruction counted once; branch-taken/page-cross span the range; loops NOT multiplied; labeled as such) / (b) keep the report as-is, per-function costs live only in the annotator output | ✅ Resolved — User accepted recommendation: (a) straight-line min–max per function, labeled | ✅ Resolved |
| 8 | Data | Static annotator input format | (a) ACME report file (final addresses → exact page-cross detection; works for twins using macros/`!fill`) with a convenience flag that runs ACME first / (b) parse raw `.asm` and compute addresses | ✅ Resolved — User accepted recommendation: (a) ACME report file input + convenience assemble flag | ✅ Resolved |
| 9 | Data / UX | Parity-ratio definition + divergence taxonomy for the twin-diff tool | Ratio = generated ÷ hand-written for bytes and static cycles (1.00 = parity, higher = worse); divergences categorized per issue #56: instruction selection, layout, data placement, addressing modes, register usage | ✅ Resolved — User accepted recommendation: ratios and five-category taxonomy as stated | ✅ Resolved |
| 10 | Naming | Twin file convention (only `examples/balloon/balloon.asm` exists today; RD-02 authors the rest) | (a) New twins as `<fixture>.twin.asm` beside goldens in `packages/test-harness/test/golden/`; balloon stays at `examples/balloon/balloon.asm`, registered in a golden↔twin pair manifest / (b) move balloon into the golden dir under twin naming | ✅ Resolved — User accepted recommendation: (a) `<fixture>.twin.asm` beside goldens; balloon stays in `examples/`, registered via pair manifest | ✅ Resolved |
| 11 | Scope / UX | Twin-diff / scoreboard output form | Script prints a markdown scoreboard to stdout + optional JSON output file; CI runs it as an informational step; committing a scoreboard document is RD-02's deliverable, not RD-01's | ✅ Resolved — User accepted recommendation: output form as stated; committed scoreboard deferred to RD-02 | ✅ Resolved |
| 12 | Scope | Initial budget values policy | (a) Exact ratchet — budgets set to current measured/static values (any regression fails; improvements tighten deliberately) / (b) +5% slack to absorb noise | ✅ Resolved — User accepted recommendation: (a) exact ratchet | ✅ Resolved |
| 13 | Naming | New surface names (batch) | `measureCycles(driver, fromLabel, toLabel)` in `@blend65/test-harness`; budget tier `budgets.spec.test.ts` (test-harness); `scripts/twin-diff.mjs` + `scripts/annotate-cycles.mjs`; root aliases `yarn twin:diff` / `yarn annotate:cycles`; core module `@blend65/core` → `timing/` | ✅ Resolved — User accepted recommendation: names as listed | ✅ Resolved |
| 14 | Scope | `ResourceReport.startupCycles` exists but is never populated — wire it via the timing table in this RD? | (a) Include as Should Have (cheap once the table exists; terminal renderer already prints the line) / (b) exclude — leave to a later RD | ✅ Resolved — User accepted recommendation: (a) include as Should Have | ✅ Resolved |

### Resolution Notes

**AR-1:** Issue #64 asserts "the binary monitor exposes the cycle counter", but the codebase survey found no such command in the implemented protocol, and VICE's LIN/CYC registers report raster position (line + cycle-in-line), not a cumulative count. The requirement (cycle-exact, deterministic, repeatable measurement between two program points) stands regardless; what's genuinely open is the mechanism, which needs a protocol spike against VICE 3.10. Deferred in named form to the RD-01 make_plan phase; the plan may not silently implement a mechanism without resolving this deferral with the user.

**AR-3:** Single-file favors atomic review (one diff shows every budget change, and the CI size gate reads one file); per-fixture sidecars reduce merge conflicts but scatter 12+ tiny files. 12 fixtures is small enough that the single file wins.

**AR-4:** The Prime Directive frames regressions as defects; a hard-fail ratchet makes budget increases deliberate, reviewable acts. Issue #64 left "comments/fails" open — user chose fail. Consequence: no PR-comment step is needed, so CI needs no new token permissions.

**AR-6:** `@blend65/core` is already a dependency of codegen, compiler, and test-harness (and importable by language-server without violating R15), so a `timing/` module there serves all consumers without duplication. Test-harness-local would force the compiler's resource report to reach into a private test package; script-embedded would duplicate the table in JS.

**AR-7:** Loop-aware totals would require iteration counts the compiler cannot know statically; straight-line min–max (documented as "each instruction counted once") is the honest static metric and matches what the annotator's per-block sums provide.

**AR-10:** `balloon.asm` is a user-facing example (the example directory is its natural home); a pair manifest in the diff tool avoids moving it while letting the scoreboard include it.

**AR-12 (addendum — preflight PF-003):** exact ratchet stands unchanged; preflight surfaced new information for one window class: a busy-wait's *measured* total is deterministic per binary but phase-sensitive (any upstream change shifts raster arrival phase, swinging the count by up to a frame). Resolution: poll loops budget statically per-iteration; measured ratchets attach only to phase-stable windows (e.g. the balloon frame-update body).

**AR-13 (addendum — preflight PF-004):** `measureCycles` signature amended to `measureCycles(driver, symbols, fromLabel, toLabel)` — labels resolve through the explicit symbols map exactly as `runUntilLabel` does (`strategies.ts:61`); drivers do not carry symbols.

---

## RD-02 — Golden-corpus twin audit + scoreboard ([#61](https://github.com/blendsdk/blend65/issues/61))

Imported pre-resolved (RD-01 gate + RD-01 scope text; per shared-gate rule 3, not re-confirmed):
twin file convention `<fixture>.twin.asm` beside goldens, balloon stays at
`examples/balloon/balloon.asm` (AR #10 — supersedes issue #61's older `test/golden/twins/`
sub-directory wording); parity ratios + the five mechanical divergence categories (AR #9);
tool output form, committed scoreboard document deferred to RD-02 (AR #11); the corpus includes
the raster-poll fixture's twin (RD-01 Won't-Have: "including the new raster-poll fixture's —
RD-02") → **14 golden↔twin pairs, 13 new twins to author** (balloon's twin exists).

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 15 | Scope / Data | Scoreboard cycle metric — issue #61 predates RD-01's finding that measured windows are only meaningful when phase-stable (AR #12 addendum; slice8b's measured budget was waived on badline-latch physics), so "upgrade to measured" cannot be blanket | (a) Static ratios (bytes + straight-line cycles) for all 14 pairs, plus measured generated-vs-twin columns only where a phase-stable window exists (today: balloon frameUpdate; the twin gets a matching labeled window) / (b) static-only scoreboard; measured stays budget-tier-only | ✅ Resolved — User accepted recommendation: (a) static ratios for all pairs + measured columns where phase-stable, values sourced from committed data so CI regenerates without VICE | ✅ Resolved |
| 16 | Integration / Behavioral | Twin verification permanence — the balloon twin is currently verified by history only (no test executes `examples/balloon/balloon.asm`); issue #61 requires each twin to "earn equivalence" via the golden's harness assertions but doesn't say whether that verification is permanent | (a) Permanent local `skipIf(!hasVice())` twin tier: every twin assembles and passes the same observable assertions as its fixture, balloon's twin retrofitted / (b) one-time audit verification recorded in the scoreboard, no permanent suite | ✅ Resolved — User accepted recommendation: (a) permanent local VICE twin tier; balloon's twin retrofitted | ✅ Resolved |
| 17 | Data / UX | Committed scoreboard document — location and freshness policy | (a) Beside goldens (`packages/test-harness/test/golden/SCOREBOARD.md`), CI-checked freshness (regenerate + diff, stale fails) / (b) beside goldens, manual regeneration / (c) `docs/parity-scoreboard.md`, CI-checked freshness / (d) `docs/parity-scoreboard.md`, manual regeneration | ✅ Resolved — User accepted recommendation: (a) `packages/test-harness/test/golden/SCOREBOARD.md`, CI-checked freshness (stale scoreboard fails, golden-style) | ✅ Resolved |
| 18 | Data | Divergence routing — issue #61's five categories (structural, peephole, data/placement, ceremony, parity) are *routing* dispositions (which issue to file to), while the shipped twin-diff taxonomy (AR #9) is *mechanical* (instruction selection, layout, data placement, addressing modes, register usage) | (a) Two layers: keep AR #9's mechanical categories in the tool; the audit adds a routing disposition per divergence group (structural→#50/#51/#53, peephole→#52, data/placement→#49, ceremony→#59, parity→none) recorded in the scoreboard and filed on GitHub / (b) rework twin-diff to issue #61's taxonomy (discards shipped AR #9 granularity; conflates mechanism with disposition) | ✅ Resolved — User accepted recommendation: (a) two-layer: mechanical taxonomy in the tool, routing disposition in the audit/scoreboard | ✅ Resolved |
| 19 | Naming | New surface names (batch) | Scoreboard regenerator `scripts/gen-parity-scoreboard.mjs` + alias `yarn gen:scoreboard` (matches `gen:matrix`); twin-verification tier file `packages/test-harness/src/twins.spec.test.ts`; scoreboard file name per AR #17's choice | ✅ Resolved — User accepted recommendation: names as proposed (with `SCOREBOARD.md` per AR #17) | ✅ Resolved |

### Resolution Notes (RD-02)

**AR-15:** CI regenerability is preserved by sourcing measured values from committed data
(the generated side from `budgets.json`'s measured ratchets; the twin side from a measured
reference recorded in the pair manifest, refreshed locally when re-measured) — CI never needs
VICE to check freshness.

**AR-16:** (a) makes twins a live regression baseline (issue #61 calls them "test assets, not
documentation"); a bit-rotted twin can never silently corrupt the scoreboard. Assertion logic
is shared between fixture and twin runs — the plan decides the refactoring shape.

**AR-17:** Issue #61 says "committed alongside" the twins; freshness-checking treats the
scoreboard like a golden — it changes exactly when goldens change, keeping the committed
number honest.

**AR-18:** (a) is the grounded path: AR #9's taxonomy shipped in RD-01
(`scripts/twin-diff.mjs`); the two vocabularies answer different questions (what diverged
mechanically vs. where the fix is tracked).

**AR-19:** Accepted as part of the batch with AR #18.

**AR-15 (addendum — preflight PF-012):** committed measured values stay honest via local
equality assertions: the budget tier's measured case asserts the fresh measurement equals
`budgets.json`'s value exactly (not merely ≤), and the twin tier asserts equality with the
manifest's twin reference — an untightened improvement fails locally instead of the
scoreboard publishing a stale ceiling as a measurement.

**AR-16 (addendum — preflight PF-009/PF-011):** the recorded gap was wider than known:
neither side of the balloon pair — and neither side of rasterpoll — has a VICE observable
suite today (`buildRasterpoll`/`buildBalloon` are consumed only by the budget tier, which
asserts no memory observables). F2 authors those two assertion sets in the shared helpers and
adds fixture-side VICE spec cases, so single-source/two-consumers holds for all 14 pairs.
Boundary rule: shared sets are memory observables only; implementation-coupled fixture
assertions (symbol-relative opcode probes, PC-at-label checks) stay fixture-suite-local.

**AR-18 (addendum — preflight PF-010):** routing dispositions live in a committed `routing`
block per pair in `twins.json` (a divergence group = pair × mechanical category; detail
strings are display-only, never keys; a group may carry several dispositions, each non-parity
one linking an issue). The scoreboard generator exits non-zero naming any unrouted group,
before writing output — AC-5's "zero unclassified" is thereby a permanently enforced
mechanism via the CI freshness step, not an audit-day state.

---

## RD-04 — Compare-and-branch fusion ([#50](https://github.com/blendsdk/blend65/issues/50))

Imported pre-resolved (RD-01/RD-02 gates; per shared-gate rule 3, not re-confirmed): exact-ratchet
budget policy — optimizations tighten `budgets.json` in the same change (AR #12); committed
scoreboard with CI freshness regeneration (AR #17); divergence-routing dispositions live in
`twins.json` (AR #18).

Grounding for the items below: comparisons always materialize a 0/1 byte via four
width×signedness framings (`packages/codegen/src/instr/translate.ts:1022-1193`); `brcond`
reloads and retests that byte (`translate.ts:555-558`); single-use loads are already deferred
and folded at their consumer (`translate.ts:587-589`); `&&`/`||` lower as value-producing
frame-slot diamonds with SFA-precounted synthetic slots and a loud name/size verification
(`packages/codegen/src/il/lower.ts:1261-1285`, `lower.ts:1230-1248`); no constant folding
exists anywhere (`optimize-il.ts` identity passthrough, `peephole.ts` zero rules).

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 20 | Scope | Issue #50's acceptance ("raster-poll golden emits the 3-instruction idiom, byte-comparable to the twin") is unreachable by fusion alone — fusion yields a 4-instruction condition block (`LDA $D012 · CMP #$FB · BNE body · JMP end`, ≈12 cyc/iter vs hand 9); the 3-instruction idiom additionally needs RD-05's jump threading + fall-through elision | (a) RD-04 acceptance = the exact fused branch-over-jump form; the twin-byte-comparable criterion moves to RD-05 (#51), which B1 ships anyway / (b) RD-04 additionally special-cases empty-body loops (thread `BNE body; body: JMP cond` → `BNE cond`) to hit the 3-instruction idiom now | ✅ Resolved — User accepted recommendation: (a) RD-04 acceptance = the exact fused branch-over-jump form; the twin-byte-comparable criterion moves to RD-05 (#51) in writing | ✅ Resolved |
| 21 | Behavioral / Scope | Constant conditions (`while (true)`, `if (false)`) — no folding exists; `while (true)` re-evaluates `LDA #$01` every iteration. Who owns the fix? | (a) RD-04 folds boolean-*literal* conditions at lowering (`brcond` on a literal → `br`; no condition code emitted); computed-constant conditions + unreachable-block elimination stay with the B1 conservative const-fold pass and RD-05 / (b) no lowering change — route all constant-condition folding to the B1 const-fold pass (adds an intra-B1 ordering dependency; `while (true)` stays degenerate until that pass lands) | ✅ Resolved — User accepted recommendation: (a) fold boolean-literal conditions at lowering (`brcond` on a literal → `br`); computed constants + unreachable-block removal stay with the const-fold pass / RD-05 | ✅ Resolved |
| 22 | Technical / Scope (complex) | Compound/negated conditions in condition position: `&&`/`||` currently claim an SFA-precounted synthetic frame slot and join through memory even when the result only feeds a branch; `!` materializes | (a) full condition-position branch lowering — comparisons, boolean reads, `!` (target swap), `&&`/`||` (recursive short-circuit into CFG edges); no synthetic-slot claim in condition position, SFA slot-preorder updated in step (drift is a loud ICE, `lower.ts:1230-1248`) / (b) fuse only simple comparisons, boolean reads, and `!`; `&&`/`||` keep the slot diamond, deferred to a follow-up item | ✅ Resolved — User accepted recommendation: (a) full condition-position branch lowering incl. `&&`/`||`/`!`; no slot claim in condition position, SFA preorder updated in step (counter-advancing claims recorded as the staging fallback) | ✅ Resolved |
| 23 | Technical (complex) | Fusion mechanism — where the compare-branch fusion lives (golden-output-neutral either way) | (a) translator-local: defer a single-use comparison whose sole consumer is the same block's `brcond` (mirrors the deferred-load fold, `translate.ts:587-589`); framing emitters branch to the real targets instead of materializing / (b) IL vocabulary change: a fused compare-and-branch terminator emitted by lowering, translated per framing / (c) named deferral of the mechanism to make_plan | ✅ Resolved — User accepted recommendation: (b) fused compare-and-branch IL terminator emitted by lowering (challenger-reconciled pick; see note) | ✅ Resolved |
| 24 | Data / Testing | Existing spec tests and all goldens assert the materialized `_cmp` byte pattern this RD removes (`translate.spec.test.ts:415-420`, `generate.golden.spec.test.ts:76-81`) — requirements change supersedes them | Single viable path: rewrite the affected spec-test expectations to the fused idiom, regenerate + hand-review all goldens, tighten `budgets.json` in the same change (AR #12), regenerate the scoreboard (AR #17). Rejected: keeping the old byte-pattern assertions — they assert the defect this RD removes | ✅ Resolved — User confirmed supersession: affected spec tests rewritten to the fused idiom, goldens regenerated + hand-reviewed, budgets tightened same-change, scoreboard regenerated | ✅ Resolved |
| 25 | Scope | Pre-existing relative-branch range exposure — `brcond` emits `BNE <block label>` to arbitrary targets (`translate.ts:557`); a do-while backedge or switch dispatch spanning >127 bytes fails at ACME assembly today. Fusion is range-neutral (same branch geometry) | (a) out of scope for RD-04 — file it as a defect issue routed to #51 (RD-05 owns branch geometry/layout) / (b) include branch relaxation (`B?? *+5 · JMP far`) in RD-04 | ✅ Resolved — User accepted recommendation: (a) out of scope; defect issue filed before RD-04 merges, routed to #51; RD-04's Won't-Have records the widened exposure | ✅ Resolved |

### Resolution Notes (RD-04)

**AR-20:** The gap between the fused form and the twin idiom is exactly the two transforms
RD-05 (#51) already owns (jump threading + fall-through elision); duplicating them as an
empty-body special case inside RD-04 would be dead logic one item later. VICE-observable
behavior is identical (both forms sample `$D012` several times per raster line) — only
bytes/cycles differ. Condition of the handoff: RD-05's acceptance gains the
twin-byte-comparable criterion in writing (recorded in its issue/roadmap row until its RD is
authored).

**AR-21:** The fold is a few lines at the `brcond` terminate sites (`lower.ts:502/533/563`)
and satisfies issue #50's own `while (true)` acceptance without depending on the unlanded
const-fold pass. The overlap is harmless — the pass still needs brcond-on-const folding for
*propagated* constants; lowering handles the syntactic-literal case eagerly.

**AR-22:** Compound guards are the *worst* divergence today (`lowerShortCircuit` joins
through a frame slot and the outer `brcond` re-tests the reloaded byte), and short-circuit
branching is a stated issue #50 case — deferring it would be partial implementation, not
scoping. Making condition-position sites slot-free turns the deliberately
position-independent SFA predicate (`packages/frontend/src/sfa/model-adapter.ts:107-139`)
position-dependent; both walks must derive "condition position" identically (drift ICEs
loudly via the name/size verification). Staging fallback recorded: condition-position sites
keep claiming (and discarding) their slot to advance the counter, deferring the adapter
change.

**AR-23:** Challenger diverged from the initial translator-local lean and its case was
adopted: with AR #22(a), lowering already holds the comparison node in condition position —
materializing a temp only for the translator to re-discover fusion via a use-count heuristic
discards that knowledge, and the heuristic can silently stop firing under future lowering
changes (goldens/budgets as the only guard). A fused terminator makes fusion true by
construction, keeps printed IL honest, and composes with the B1 const-fold pass (folds to
`br` on constant operands) and RD-05's threading (threads like `brcond`). Named blast
radius: `instruction.ts`, `termination.ts`, `print-il.ts`, `lower.ts`, `translate.ts` +
IL-text tests. Hardening disclosure: Confidence Med→High on convergence of items 20/21/22/25;
Challenger: diverged on 23, reconciled as recorded.

**AR-24:** The testing standard's spec-test immutability yields to a requirements change —
the old expectations assert the exact byte pattern this RD is chartered to remove. Value-
context materialization tests remain valid and untouched.

**AR-25:** Relaxation is a function of final block geometry, which RD-05 is about to change
(threading + fall-through elision move blocks and shorten distances) — relaxing first means
measuring distances that are about to be wrong. The failure mode is a loud ACME range error,
never silent corruption. Conditional resolution honored: the defect is filed before RD-04
merges, and fusion's widening of the surface (framing-internal branches now target real
block labels) is named in the issue and in RD-04's Won't-Have.

---

## RD-05 — Block layout: fall-through elision + jump threading ([#51](https://github.com/blendsdk/blend65/issues/51))

> **Status**: ✅ GATE PASSED — all 8 items resolved (26–33)
> **Opened**: 2026-07-19 21:52 · **Passed**: 2026-07-19 22:05 (bulk acceptance)
> **Inherited obligations**: AR #20 (twin-byte-comparable raster idiom transfers here in writing)
> and AR #25 ([#65](https://github.com/blendsdk/blend65/issues/65) branch-range relaxation routed here).
>
> **Measured baseline** (committed goldens, 2026-07-19): 105 `JMP`s across the 14-golden corpus,
> of which **47 target the immediately-following label** and **13 blocks consist solely of a `JMP`**.
> Corpus parity 3896 B / 4.23× and 5023 static cycles / 5.53×.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 26 | Technical (complex) | Where the four layout transforms live. Three wired seams exist: **A** the IL pass pipeline (`optimizeIL(il, [], bag)`, `packages/compiler/src/api/emit.ts:108`; `ILPass` contract at `il/optimizer/pass.ts`, zero passes shipped) — CFG-level, blocks and terminators first-class; **B** translation time (`instr/translate.ts:264`, `for (const block of this.fn.blocks)`) — the only place block *adjacency* exists, but `translate.ts` is already 2250 lines; **C** the instruction peephole (`optimizeInstr`, `instr/peephole.ts`, `V1_RULES = []`) — flat post-translation stream, block identity destroyed (`core/src/instr-model/stream.ts:54-76`), and the declared home of [#52](https://github.com/blendsdk/blend65/issues/52) | (a) **split by nature** — jump threading + unreachable-block removal as two `ILPass`es in **A**; fall-through elision + branch inversion as ONE tail-emission decision in **B** (given `B<c> T / JMP F` and next label `N`: `F===N` → drop the `JMP`; `T===N` → emit `B<!c> F` alone; else both); relaxation as a **new unconditional post-translation stage**, not a peephole rule / (b) all four in **B** as a layout pre-pass over `this.fn.blocks` / ~~(c) all four in **C**~~ — **rejected as non-viable**: the `PeepholeRule` contract windows consecutive instruction entries only ("labels/directives pass through verbatim", `instr/peephole.ts:33-35`, window/replace constraint `:47-60`), so `JMP L` + label `L` is unmatchable without redesigning the contract [#52](https://github.com/blendsdk/blend65/issues/52) is about to build on; block labels and translator-minted `_cmpN`/`_shN` labels (`translate.ts:804-811`, `:1219`) are distinguishable only by naming convention | ✅ Resolved — User accepted recommendation: (a) split by nature — threading + unreachable-removal as two `ILPass`es at seam A; fall-through elision + branch inversion as one tail-emission decision at seam B; relaxation as a new unconditional post-translation stage (challenger-reconciled; see note) | ✅ Resolved |
| 27 | Scope | Does RD-05 **reorder** blocks (trace scheduling / moving cold arms out of line), or only exploit the existing lowering order? Issue #51 frames its transforms as running "after block order is fixed", but `guards` shows 9 fall-through `JMP`s and if/else arms that both jump to the join, where reordering could pay further | (a) reordering out of scope — exploit the existing `openBlock` order only; file a follow-up if residual cost shows in the scoreboard / (b) include a block-reordering heuristic in RD-05 | ✅ Resolved — User accepted recommendation: (a) reordering out of scope; exploit the existing `openBlock` order only, follow-up filed if the scoreboard shows residual cost | ✅ Resolved |
| 28 | Scope | Is [#65](https://github.com/blendsdk/blend65/issues/65) branch relaxation (`B<inv> *+5 / JMP far`) delivered **inside** RD-05 or as its immediate follow-up? Issue #65 says "in #51 or as its immediate follow-up"; AR #25 routed it here because relaxation is a function of final block geometry | (a) inside RD-05, as the last stage after layout settles / (b) separate follow-up RD after RD-05 lands | ✅ Resolved — User accepted recommendation: (a) #65 relaxation delivered inside RD-05, as the last stage over the settled geometry | ✅ Resolved |
| 29 | Scope | Unreachable-block removal is jointly assigned by AR #21 ("stay with the const-fold pass / RD-05"). Which owns the mechanism? Concrete case: `rasterpoll.asm.golden` carries a dead `Main_main_L2: RTS`, orphaned by RD-04's `while (true)` literal fold. Sub-question: a self-referential jump-only block (`L: JMP L`, i.e. `while (true) {}`) must survive as a deliberate carve-out from "no jump-only blocks survive" | (a) RD-05 owns the mechanism — a reachability-based dead-block-removal `ILPass`; the const-fold pass later reuses it by scheduling it after folding / (b) RD-05 removes only blocks its own threading orphans; the const-fold pass ships its own removal | ✅ Resolved — User accepted recommendation: (a) RD-05 owns the mechanism as a reusable reachability-based `ILPass`; the const-fold pass reuses it by scheduling. Self-referential jump-only block (`L: JMP L`) survives as a deliberate carve-out | ✅ Resolved |
| 30 | Technical / Behavioral | Is block layout **unconditional**, or gated behind `--optimize` like the peephole? `optimizeIL` always runs (`emit.ts:108`) whereas `optimizeInstr` runs only under `run.config.optimize` (`emit.ts:139-141`; default `true`, `packages/config/src/defaults.ts:38`). Consequence: #65 relaxation is a **correctness** requirement — a program that assembles under `--optimize` but fails under `--no-optimize` would be a trap — and relaxation must measure the same geometry that is emitted | (a) unconditional — layout and relaxation always run, independent of `--optimize` / (b) gated behind `--optimize`, keeping `--no-optimize` a naive 1:1 IL→asm mapping for codegen debugging | ✅ Resolved — User accepted recommendation: (a) unconditional — layout and relaxation run independent of `--optimize` | ✅ Resolved |
| 31 | Data / Testing | Existing spec-test oracles assert the exact `JMP` shapes this RD removes. Largest: `instr/translate-brcmp.spec.test.ts` — 47 `JMP` assertions across all five framings × both polarities, landed by RD-04 as immutable oracles. It calls `translateFunction` **directly** on hand-built `ILFunction`s, so its exposure depends entirely on AR #26's answer. Also affected: `switch-translate.spec.test.ts` (3), the golden suites, and `budgets.spec.test.ts`'s hand-derived cycle constants (poll iteration 15, compound guard 24 — both change) | (a) supersede only what the chosen seam actually reaches, stated per-file before rewriting / (b) blanket-supersede every `JMP`-shaped oracle in the corpus / (c) **preserve the framing matrix**: give those hand-built fixtures a block order in which neither target is adjacent, so `JMP falseTarget` legitimately survives and all 47 *expectations* stay byte-identical (a fixture change, not an expectation change); pin elision/inversion in a new dedicated layout suite instead. Rationale: the matrix's stated purpose is that a fused branch "would still look plausible in isolation; only the pair pins it" — branch inversion IS a polarity flip, so entangling it with the polarity oracle weakens RD-04's AC-10 guard. Goldens/budgets/scoreboard churn per AR #12/#17/#24 regardless | ✅ Resolved — User accepted recommendation: (c) preserve the framing matrix via a fixture block-order change (every expectation stays byte-identical); elision/inversion pinned in a new dedicated layout suite | ✅ Resolved |
| 32 | Testing | Test tier for the #65 range cases (a do-while body >127 bytes; a switch dispatch-to-body distance >127 bytes). A hand-written twin for a 130-byte filler loop carries no idiom to compare against | (a) unit tier only — an ACME-assembling spec test (`skipIf(!hasAcme())`, runs in CI) proving it assembles and that in-range branches are untouched, plus a local VICE case proving it runs correctly; no new golden-corpus twin pair / (b) a new corpus fixture + hand-written twin + scoreboard row, following RD-04's `guards` precedent | ✅ Resolved — User accepted recommendation: (a) unit tier only — ACME-assembling spec test in CI plus a local VICE correctness case; no new golden-corpus twin pair | ✅ Resolved |
| 33 | Naming | New surface names (batch), assuming AR #26(a) | `il/optimizer/thread-jumps.ts` → `threadJumps: ILPass` (`name: "thread-jumps"`) · `il/optimizer/remove-unreachable-blocks.ts` → `removeUnreachableBlocks: ILPass` (`name: "remove-unreachable-blocks"`) · `instr/branch-tail.ts` → the tail-emission decision + polarity-inversion table, extracted rather than grown inside the already-2250-line `translate.ts` · `instr/relax-branches.ts` → `relaxBranches(program, cpu, bag)` · new suite `instr/block-layout.spec.test.ts` | ✅ Resolved — User accepted recommendation: names as listed | ✅ Resolved |

### Resolution Notes (RD-05)

**AR-26:** The challenger ran blind on the three allocations and converged on the split, but
corrected the initial framing twice, and both corrections were adopted. First, **relaxation
cannot be a peephole rule**: the `PeepholeRule` contract windows consecutive instruction
entries and caps the replacement at the window size (`instr/peephole.ts:47-60`), while
relaxation must see labels and grows a 2-byte branch into 5 bytes; it must also cover
*translator-internal* branches — shift loops (`translate.ts:806-811`), `_cmp` tails
(`:1156`, `:1171`), word-equality early-outs (`:1219`) — which have no IL-level existence.
It therefore becomes its own stage, not a rule inside a gated one. Second, **branch inversion
is not a separate transform**: it is the third arm of a single tail decision the translator
already holds the facts for (branch opcode and polarity are computed at `translate.ts:1122`,
`:1141-1150`), and siting it there keeps framing-internal early-out branches — which must
never be inverted (`:1290-1295`) — naturally out of reach.

Threading and unreachable-removal are the genuinely *free* placements (a translator-local
pre-pass would also be correct); they go to the IL seam on two grounds: the const-fold pass
orphans blocks the same way and needs to re-sequence the same removal (AR #21), and
`--emit-il` prints post-optimizer IL (`emit.ts:63-64`, `:107-108`), so IL-level threading
keeps the printed IL an honest picture of what gets emitted — the same argument that decided
AR #23. Threading chain-follows trampolines with a visited set, which both handles the
`L: br L` carve-out of AR #29 and avoids needing pipeline-level iteration.

Two implementation hazards named for the plan, not the RD: the "is this block a trampoline"
predicate must decide whether `source_span`-provenance-only bodies count as empty
(`translate.ts:393-394`) — requiring strictly-empty silently under-fires, skipping spans
drops provenance; and the seam-B next-label comparison must account for the entry block,
whose emitted label is `sanitize(fn.name)`/`ENTRY_LABEL` (`translate.ts:247`, `:2209-2214`)
rather than `blockLabel("_entry")` (`:381-383`) — a mismatch there is either a dangling-label
ACME error or a silently missed elision that only the budget ratchet would catch.

**Sequencing consequence (binding on the plan):** threading and elision must land as ONE
change. Threading alone still emits the `JMP`; elision alone still routes through the
trampoline. Split across phases, the goldens and `budgets.json` churn twice for one result.

**AR-28:** Relaxation is a correctness transform sharing RD-05's prerequisite (settled block
geometry) and its unconditional siting (AR #30) — splitting it into a follow-up would mean
measuring distances twice and shipping a known-reachable build failure in between.

**AR-29:** One mechanism, two clients. `rasterpoll` and `guards` both already carry a dead
`Main_main_L2: RTS`, orphaned by RD-04's `while (true)` literal fold — so the pass has work
to do on day one, independent of what threading orphans. Consequence to carry into the
scoreboard: the `guards` divergence row currently routed to [#59](https://github.com/blendsdk/blend65/issues/59)
as "unreachable epilogue: main never returns, yet an RTS is still emitted past the frame
loop" is fixed here, and its routing moves to #51.

**AR-30:** The two halves cannot be gated differently — relaxation must measure the geometry
that is actually emitted, so if layout were optional there would be two geometries. Since
relaxation must always run (a `>127`-byte loop failing to assemble only under `--no-optimize`
is a trap), layout must always run too. Gating would additionally require threading a flag
into `translateFunction`, which has no such parameter today (`translate.ts:118-127`).

**AR-31 (corrected at preflight, PF-021):** the decision stands; the *mechanism* recorded here
was wrong. A block **reorder** cannot work — the fixture builds exactly three blocks and
`blocks[0]` is pinned as the entry (`il/cfg.ts:88`, `instr/translate.ts:247`), so one of the two
targets is always adjacent and elision or inversion always fires. Preservation is achieved by
**interposing a non-target filler block**. The honest claim is also narrower than first written:
every per-row `expected` instruction array stays byte-identical, but `expectFused`'s full-text
`toBe` scaffold and the fixture doc comment do change. Additionally,
`instr/switch-translate.spec.test.ts` — named in this row as affected — was left without a
disposition; it is now superseded in writing per AR #24. Original (superseded) wording: option (c)
is a fixture change, not an expectation change; only the surrounding block order moves. This preserves what that matrix exists for — its own
header records that a fused branch "would still look plausible in isolation; only the pair
pins it" — and branch inversion is precisely a polarity flip, so folding it into the polarity
oracle would blunt RD-04's AC-10 guard one item after it landed. Layout gets its own suite.
Goldens, `budgets.json` (including the hand-derived poll-iteration and compound-guard cycle
constants) and `SCOREBOARD.md` still churn under AR #12/#17/#24.

**AR-32:** Branch range is a correctness property, not a parity property — a 130-byte filler
loop has no hand-written idiom to be compared against, so a twin would be mechanical filler
that dilutes the corpus. The ACME-only tier already exists and runs in CI
(`skipIf(!hasAcme())`, e.g. `compiler/src/api/build-report.spec.test.ts`); VICE stays local
per AR-27.

**AR-26 (grounds corrected at preflight, PF-034 — the decision is unchanged):** two of the
rationales recorded above are factually wrong, and the corrected versions are what the RD now
carries. (1) Elision does **not** sit at translation because "block identity is destroyed"
post-translation — label entries survive in the flat stream (`core/src/instr-model/stream.ts:62`),
which is exactly why relaxation can run there. The real reason is that **branch-tail identity** is
lost: after translation a block tail is indistinguishable from a comparison-framing-internal
branch by anything but naming convention, and inversion must never touch the latter. (2) The
peephole was rejected primarily on its window contract, but that contract has **no implementation
behind it** (`instr/peephole.ts:13-15,75` — `V1_RULES = []`, the scanner explicitly deferred), so
RD-06 could still define labels into it. The load-bearing rejection is the `--optimize` gating: the
peephole is skipped under `--no-optimize` while relaxation is correctness and must always run.
**AR-28 (form corrected at preflight, PF-020 — the placement decision is unchanged):** this row's
ambiguity text names the relaxed form as `B<inv> *+5 / JMP far`. That form is **not representable**
in the instruction model — `InstrOperand` is `none | immediate | symbolRef | labelRef | zpSlot`
with no PC-relative variant (`core/src/instr-model/operand.ts:30-39`), and `Relative` mode renders
bare operand text (`instr/print-instr.ts:111-116`). Relaxation therefore mints a synthetic local
label: `B<inv> _rlxN / JMP far / _rlxN:`, with uniqueness from the program-shared counter pattern
already used for `_cmpN` (`instr/translate.ts:91-97`). The alternative — extending the operand
union in `@blend65/core` — was rejected to keep that package out of RD-05's scope. The "inside
RD-05, not a follow-up" resolution above stands unchanged.

**Hardening disclosure:** Confidence High. Challenger: run blind on AR #26; converged on the
seam split, diverged on relaxation's home and on inversion's status as a separate transform.
Both divergences investigated against the code and adopted. Preflight subsequently corrected two
of the supporting rationales without disturbing the decision (see above).

---

## RD-03 — Placement: align const data and read it in place ([#49](https://github.com/blendsdk/blend65/issues/49))

> **Status**: ✅ GATE PASSED — all 5 items resolved (64–68), 2026-07-20
> **Amended 2026-07-20 after the RD preflight** — the *decisions* below all stand; three of their
> supporting figures were refuted by measurement and are corrected in the addenda following the
> table. See [`00-preflight-report-rd-03.md`](00-preflight-report-rd-03.md).

| # | Category | Ambiguity | Options | Decision | Status |
|---|----------|-----------|---------|----------|--------|
| 64 | Scope / Document identity | RD-03 (#49) is an umbrella epic — placement, `copy()`, and hardware access — with a roadmap row but no document. Which of those does this RD own? | (a) RD-03 **is** the placement slice; `copy()` and the wider hardware-access work are named out of scope and stay gated / (b) a new RD id for placement, leaving RD-03 as an unwritten umbrella | ✅ Resolved — User accepted recommendation: (a). The roadmap row already declares the split ("placement → B1/B2 (grammar-free); copy() gated"), so RD-03 documents the half that is actionable. #49 remains the linked issue | ✅ Resolved |
| 65 | Technical / Behavioral | Which const arrays get aligned? Measured first: aligning **every** const array costs **+795 bytes** of padding corpus-wide against balloon's −365 — the corpus *grows* by 430 and `slice7` (+207), `slice7b` (+159) and `slice8b` (+276) each regress while gaining nothing, contradicting AR #66 | (a) every const array unconditionally / (b) only arrays a platform profile marks hardware-read / (c) **a const array is aligned iff its address is taken** | ✅ Resolved — User accepted recommendation: (c). Grammar-free (`&` already exists in v3); costs **zero** on today's corpus because no fixture takes an address, and −212 net once balloon is rewritten. The rule carries meaning rather than convenience: taking a const array's address is the program declaring that something other than the compiler's own indexing will read those bytes — hardware, or a pointer — which is exactly when placement matters. (a) was chosen first and **overturned by measurement**; (b) needs selection machinery that does not exist (format handlers are unimplemented — no `FormatHandler` type in `core/platform` or `packages/platforms`, `E10203` absent from the frontend) | ✅ Resolved |
| 66 | Quality gate | Padding costs bytes, and this project treats a byte regression as a defect (AR #4, #12) | (a) corpus total must still strictly decrease and **no fixture may regress** — a fixture that grows is a stop, not a budget bump; all ratchets re-derived / (b) align only when the compiler judges padding cheaper than the copy it saves | ✅ Resolved — User accepted recommendation: (a), the same rule RD-05 followed. (b) was rejected because it makes a program's memory layout depend on a compiler judgement rather than on its own source | ✅ Resolved |
| 67 | Scope | `poke($07F8, hi(&BALLOON) * 4)` compiles **today**, but emits ~~9~~ **8** instructions (*corrected by measurement — see the AR #67 addendum below*) where a hand-coder writes 4: the full 16-bit address is materialized into a ~~scratch pair~~ **word frame slot** before `hi()` takes its high byte. Prime-Directive divergence — whose? | (a) out of scope; recorded and routed to the constant-materialization lever (#58/#60) / (b) in scope — this RD must emit `LDA #>sym` directly | ✅ Resolved — User accepted recommendation: (a). It is a constant-materialization defect, not a placement one, and #58/#60 is already the named lever for that class. Keeps this slice small | ✅ Resolved |
| 68 | Technical | Alignment granularity: sprites need 64-byte blocks, so why page-align (256)? | (a) 64-byte — the hardware's actual granularity, tighter padding / (b) 256-byte (page) | ✅ Resolved — surfaced during authoring, decided on the language surface: (b). A sprite pointer is `address / 64`, and v3 offers **no way to name that** — there is no "address / 64" idiom. It *does* offer `hi()`, which is `address / 256` and is specified to fold at compile time (`spec/12-intrinsics.md:174`), so `hi(&X) * 4` equals `address / 64` **only when the address is a multiple of 256**. Page alignment is therefore what makes this slice expressible without touching `spec/`; 64-byte alignment would require new syntax and re-gate the whole RD behind the Language Guard | ✅ Resolved |

**AR-65 (the measurement that overturned the first answer).** Per-array padding was computed from
each fixture's real `__data_*` symbol addresses rather than estimated: `slice7` `$0931` (+207),
`slice7b` `$0961` (+159), `slice8b` `$0972`/`$097A` (+142/+134), `balloon` `$0A67` (+153). The
decisive fact is that none of those three programs would *use* the alignment — their tables are
read by compiler-generated indexed access, never by hardware — so they were paying for nothing.
The address-taken rule separates the two cases using something already in the language.

**AR-65 (disclosed cost).** The rule couples a layout decision to an expression that may appear
anywhere in the program: adding `&X` changes X's address and pads the binary. That is real action
at a distance. It is accepted because the effect is deterministic, reported in the build summary,
and gated by the no-regression ratchet — and because the alternative that avoids it entirely
(an explicit alignment attribute, FUT-014) requires attribute syntax that v3 deliberately removed.

**Hardening disclosure:** Confidence High on AR #65 and #68 — both rest on measurements taken
against the current compiler (`+795` padding) rather than on reasoning. Confidence Medium on
AR #67: the routing to #58/#60 is judgement, and the sequence is a live divergence until that
lever lands.

> **Corrected 2026-07-20 (preflight PF-016).** This disclosure originally cited `hi(&X)*4` as
> "verified to emit `LDA #>__data_Main_BALLOON` / `ASL` / `ASL`" — the *ideal* three-instruction
> form, which is precisely what the compiler does **not** emit. The measured emission is the
> 8-instruction sequence in AR #67's addendum below. The confidence rating is unaffected (AR #68's
> decision rests on the arithmetic identity, not on the instruction count), but the sentence was
> doing evidentiary work it could not support.

---

### Preflight addenda (2026-07-20) — measured corrections to the supporting figures

The RD preflight re-measured every figure in this section against the current tree. **No decision
changes**; three supporting facts do.

**AR #65 addendum — the `+153` / `−212` figures are superseded.** The per-fixture padding table
above was computed from each fixture's `__data_*` address in its **pre-rewrite** build. For
`balloon` that address is `$0A67`, giving +153 bytes of padding and a −212 net. But the rewrite
that removes the 63 staging pokes shrinks the program first, moving the symbol to `$08FA` — where
page padding costs **6 bytes**, not 153. Measured end to end:

| Build | Bytes | `__data_Main_BALLOON` |
|---|---|---|
| today | 677 | `$0A67` |
| pokes removed, pointer computed | 312 | `$08FA` |
| **+ page alignment (`!align 255, 0, 0`)** | **318** | **`$0900`** (block 36) |

So balloon's real net is **−359** (677 → 318), not −212, and the corpus figure improves
accordingly. The decision (c) — align iff the address is taken — is untouched; it gets *better*,
not worse. The +795/-corpus-grows measurement that **overturned option (a)** was taken across all
fixtures and remains valid, because those fixtures are not rewritten.

**AR #65 addendum 2 — padding is not a stable quantity.** The 6 bytes above is an artifact of
where balloon's code happens to end. Any future change to its code size re-rolls the padding
anywhere in 0–255. The disclosed "action at a distance" cost is therefore larger than first
recorded: adding `&X` changes X's address *and* the binary's size by an amount that is not
predictable from the source. This is accepted for the same reasons as before (deterministic per
build, gated by the no-regression ratchet), with one added discipline: M4's ratchets are re-derived
from the **aligned** build, never from an unaligned measurement.

**AR #67 addendum — the count is 8, not 9.** The measured emission is:

```asm
LDA #<__data_Main_BALLOON      ; 1
STA __frame_Main_main_0sc0     ; 2
LDA #>__data_Main_BALLOON      ; 3
STA __frame_Main_main_0sc0+1   ; 4
LDA __frame_Main_main_0sc0+1   ; 5
ASL                            ; 6
ASL                            ; 7
STA $7F8                       ; 8
```

Eight instructions against a hand-coder's four — **four** extra, not five. Two further details
that affect how #58/#60 should price this: the staging pair is a synthetic **word frame slot**
(`__frame_Main_main_0sc0`, absolute `$2000`), not zero page; and the line additionally emits
`warning[W10172]: multiply by 4 generates a shift-and-add sequence`, even though the compiler
emits two `ASL`s and incurs no shift-and-add cost.

**AR #68 addendum — the rationale was wrong, the decision stands.** The entry justified page
alignment on `hi()` being "specified to fold at compile time (`spec/12-intrinsics.md:174`)". That
spec line guarantees folding only *"when applied to compile-time constants"*, and `&X` is a
**link-time** symbol the assembler resolves — the compiler does not fold it, as AR #67's sequence
shows. The correct justification is arithmetic and does not depend on folding: for an address that
is a multiple of 256 the low byte is zero, so `hi(&X) * 4 == address / 64` exactly. Page alignment
remains what makes the sprite block expressible without new syntax; only the stated reason changes.

---

## RD-13 — Symbolic address arithmetic ([#58](https://github.com/blendsdk/blend65/issues/58), symbolic slice)

> **Status**: ✅ GATE PASSED — all 5 items resolved (78–82), 2026-07-20
> **Continuity**: AR #67 routed the 8-instruction `hi(&X) * 4` divergence *out* of RD-03 and onto
> the constant-materialization lever. **This RD is that lever.** The routing is now discharged.

| # | Category | Ambiguity | Options | Decision | Status |
|---|----------|-----------|---------|----------|--------|
| 78 | Scope / Document identity | #58 is an *audit sweep* over `packages/frontend` (deliverable: conformance tables + filed findings). Which part does RD-13 own? | (a) byte-select only (`hi`/`lo` of `&X`) / (b) (a) + the `W10172` conformance fix / (c) (b) + a link-time expression operand so `&X / 2^k` and `&X >> k` fold / (d) (c) + `const` declarations naming link-time addresses | ✅ Resolved — **(c)**, endorsed by an independent challenger on a different model family. (a) and (b) leave two *live* Prime-Directive defects standing in the RD's own feature area — `lo(&X / 64)` runtime-divides a link-time constant and `&X >> 6` is rejected outright — so docs would have to keep teaching `hi(&X) * 4`, which RD-15's 64-byte alignment silently breaks. (c)'s new operand is **not** speculative: it has two producers inside this RD plus RD-15 downstream. #58 stays open for its audit halves | ✅ Resolved |
| 79 | Technical / Semantics | Should `hi(&X) * 4` fold all the way to one immediate, or stop at `LDA #>sym` / `ASL` / `ASL`? | (a) full fold to a single immediate / (b) stop at the 4-instruction hand form and bless `lo(&X / 64)` as the sprite-block idiom going forward | ✅ Resolved — **(b)**, on semantics rather than economics. `hi(&X) * 4` is a **byte** multiply that wraps mod 256, and the wrap is meaningful: for a page-aligned `X` it yields `(X & $3FFF) / 64`, the block number *within the VIC bank*. A fold must either reproduce that truncation or change the program's meaning. `lo(&X / 64)` needs no such care — `lo()` **is** the truncation, so `#<(sym / 64)` is wrap-faithful, always in immediate range, and character-for-character the hand idiom. Building a multiply-over-address peephole for an idiom RD-15 will make *incorrect* is machinery with a shelf life | ✅ Resolved |
| 80 | Quality gate / Conformance | `W10172` fires **only** on power-of-two multiplies (`translate.ts:1582-1592`); `spec/evaluations/F017-operators.md:442` says verbatim it *"does NOT trigger for power-of-2 constants"*. Two **spec-tier** tests assert the non-conformant behaviour (ST-51a, ST-T16) | (a) leave it — spec tests are immutable oracles / (b) remove the power-of-two emission and re-derive both tests from the normative spec text / (c) (b) + implement OP-5's positive case (non-power-of-two strength reduction) so the diagnostic keeps a producer | ✅ Resolved — **(b)**. The immutable-oracle rule protects tests from *implementation-convenience* edits; these two are defective **transcriptions** of a higher, frozen authority, so correcting them is the discipline working as designed — re-derived, never weakened. (c) is real scope creep: OP-5's positive case has **no implementation at all** (a non-power-of-two multiply falls through to `JSR __rt_mul8/16` + `W10170`, `translate.ts:1596-1604`), so it means *building* strength reduction. Accepted consequence, stated in the RD: `W10172` is left temporarily **producer-less** | ✅ Resolved |
| 81 | Scope / Ledger accuracy | 17 of the corpus's 53 routed divergence rows name #58. Exactly **one** is a symbolic-address defect; the other 16 carry *"constant-foldable program: full runtime machinery emitted…"* and are local constant-propagation / dead-store gaps in codegen dataflow (`slice3a` stores `5` to a frame slot then reloads it) | (a) fix them here / (b) re-route them to their real owner without fixing them / (c) leave the routing alone | ✅ Resolved — **(b)**. They are not #58's (nothing to do with `packages/frontend` semantics or link-time symbols) and they are not RD-13's, but they drive the corpus's worst ratios (`slice6` 8.70×, `slice3b` 8.32×), so mis-attributing them hides the largest remaining parity gap behind a sweep that would never close it. (c) rejected on the RD-03 M4 precedent: the change that invalidates a routing row re-authors it | ✅ Resolved |
| 82 | Technical / Architecture | A byte-selected address must flow into an ALU left operand, but `il/operand.ts:23-28` declares an `addr` operand legal in *"exactly two positions"* and `leftIntoA` ICEs on it (`translate.ts:921-924`) | (a) extend the `addr` variant with a byte `select` / (b) a distinct IL operand kind | ✅ Resolved — **deferred to the plan**, with a binding constraint rather than a chosen shape: whichever is picked, the **documented position contract gains a third legal shape and must be amended in the same change**, and the choice must be explicit about all 7 `isAddr` guards (`translate.ts:698, 921, 954, 978, 1035, 1760, 2044`). That loud-rejection rule is what makes drift fail visibly instead of silently misreading a word address as a byte; leaving it describing a contract the code no longer honours would disarm it | ✅ Resolved |

**AR-78/79/80 (hardening).** An independent challenger (different model family) was dispatched on
the scope question with the four options and **without** this author's preference. It endorsed (c)
and returned three corrections that were adopted: AR #79's semantic argument against full-folding
(which this author had not considered), AR #80's "producer-less diagnostic" consequence, and the
observation that **AR #78's (a) is not independently shippable** — after the byte-select fix the
`* 4` still lands in the power-of-two branch, so (a) alone would leave a spurious `W10172` on the
very sprite-pointer line it just fixed. M1 and M3 are coupled.

One challenger citation was **checked and corrected before adoption**: it cited `E10191` as the
normative "const initializer must be a compile-time constant expression" code. `spec/00-feature-index.md:172`
does say that, but `spec/14-diagnostics.md:139` assigns `E10191` to *assignment to const* and puts
the initializer rule on `E10193` — which is what the implementation follows
(`diagnostic-codes.ts:262`). **The frozen spec numbers this family inconsistently.** Both documents
state the same *rule*, so the conclusion (option (d) is spec-blocked under D3, not merely
expensive) is unaffected; the discrepancy is pre-existing and out of scope.

**Hardening disclosure:** Confidence **High** on AR #78, #80 and #81 — each rests on live
measurement against the current tree (the 8- and 11-instruction emissions, the `E90001` and
`E10193` probes, the `W10172` build warning, the 17-of-53 row count) plus verbatim frozen-spec
text, not on reasoning. Confidence **Medium** on AR #79: the semantic argument is sound but the
bank-relative-block claim holds *only* under page alignment, which is today's invariant and
RD-15's open question. Confidence **Medium** on AR #82: deferring the shape to the plan is
deliberate, but it means the plan inherits the RD's riskiest decision.

### RD-13 preflight addenda (2026-07-20) — AR #83–#87 (runtime)

Raised by the 5-cluster preflight fan-out ([`00-preflight-report-rd-13.md`](00-preflight-report-rd-13.md),
PF-053…PF-079). **No AR #78–#82 decision changes**; these are five *new* decisions the scan forced.

| # | Category | Ambiguity | Options | Decision | Status |
|---|----------|-----------|---------|----------|--------|
| 83 | Scope / Testability | M1 says `hi(&X)`/`lo(&X)` become one instruction but never says what `X` ranges over. This decides whether **ST-9b** (`lower-address-of.spec.test.ts:157-174`, which uses `&helper` — a *function*) must be re-derived | (a) const aggregates only — ST-9b survives untouched / (b) all three address-of kinds: const aggregate, function/interrupt, mutable module variable | ✅ Resolved — User accepted recommendation: **(b)**. All three lower to a link-time symbol the assembler resolves, so the byte-select is equally valid for each and (a) would ship a fix that works for one operand kind and not two identical ones. ST-9b and its module header are re-derived, which is *why* the RD's spec-test inventory had to grow from two entries to five | ✅ Resolved |
| 84 | Ledger / Routing | M5 (was S1) re-routes 16 divergence rows off #58, but no destination was named — and `twins.json` rows carry a numeric `issue:` field, so the plan could not execute without inventing one | (a) #60 (Sweep D) / (b) #52 (peephole catalog) / (c) file a dedicated issue | ✅ Resolved — User delegated the choice; **(c)**. Verified against every open issue: **#60 is itself an audit sweep**, so (a) repeats the exact failure M5 exists to correct; **#52** covers redundant loads but cannot fold across a frame slot into a runtime multiply, which is what `slice3b` needs. Filed [#70](https://github.com/blendsdk/blend65/issues/70) — local constant propagation & dead-store elimination — carrying the measured evidence and the 8.70×/8.32×/7.40×/7.12× ratios | ✅ Resolved |
| 85 | Completeness | M3 described OP-5's positive case as "spun off", but nothing was filed, leaving a **registered diagnostic with no producer** and a **frozen-spec rule with no implementation** ownerless | (a) leave it in prose / (b) file it / (c) implement strength reduction inside RD-13 | ✅ Resolved — User delegated the choice; **(b)**. (c) is scope creep the RD already rejected; (a) breaks house style, where every RD-03 deferral carried a filed issue. Filed [#71](https://github.com/blendsdk/blend65/issues/71). AR #80's "temporarily producer-less" now has a defined end | ✅ Resolved |
| 86 | Coverage | `examples/balloon-color` is the **second** site of `hi(&BALLOON) * 4`, was named nowhere in the RD, is deliberately outside the parity corpus, and is referenced by nothing in `packages/`, `test/`, `scripts/` or `.github/` — so a migration typo would ship with zero signal. It is also the fixture RD-15's 193 B / 33 % measurement comes from | (a) migrate + add a CI check / (b) migrate, review-only / (c) leave it on `hi(&X)*4` and hand it to RD-15 | ✅ Resolved — User accepted recommendation: **(a)**. Its array is address-taken, so AC-2/AC-4's machinery applies unchanged and the check is nearly free; (c) would leave a shipped teaching example demonstrating an idiom RD-15 makes incorrect | ✅ Resolved |
| 87 | Technical / Correctness | The new `InstrOperand` variant was specified with "a symbol, an optional offset and a power-of-two shift count, serialized parenthesized **so ACME's precedence cannot reinterpret it**" | (a) keep the offset and require a self-parenthesized dividend `#<((sym+off) / 2^k)` / (b) drop the offset field | ✅ Resolved — **(b)**, on measurement. The claim was false: on ACME 0.97 with `sprite` at `$0900` (correct block `$24`), `#<(sprite+3 / 64)` yields **`0x00`** — ACME binds `/` tighter than `+`, so it computes `sprite + (3/64)` = `sprite + 0` — and `#<(sprite + 128/64)` yields `0x02`, silently a different address. **Both assemble cleanly**, the same trap class as RD-03's `!align 256, 0`. No requirement consumes an offset and the Won't-Have excludes `&X + n`, so the field is omitted and the trap is unreachable by construction. (a) is recorded for a later RD that needs it | ✅ Resolved |

**Hardening disclosure:** Confidence **High** on AR #84, #85, #87 — each rests on a check the lead
performed independently (every open issue enumerated; the absent issue confirmed by search; the
ACME precedence behaviour reproduced on ACME 0.97 with four spellings). Confidence **High** on
AR #83 and #86 — both follow from artifacts read directly (ST-9b's assertions;
`examples/balloon-color/main.blend:21` and its zero inbound references).

> **The two most serious preflight findings were raised by two clusters independently** that could
> not see each other's output: the understated spec-test blast radius (PF-053) and AC-3's
> unfailable oracle (PF-054). Same-session authorship was mitigated by model diversity — all five
> clusters ran on a different family than the author — not by the author's own re-reading.
