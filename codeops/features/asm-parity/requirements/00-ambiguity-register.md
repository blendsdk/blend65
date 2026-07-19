# Ambiguity Register: asm-parity requirements

> **Status**: ✅ GATE PASSED — all 25 items resolved (RD-01 items 1–14: 2026-07-17 · RD-02 items 15–19: 2026-07-18 · RD-04 items 20–25: 2026-07-19)
> **Last Updated**: 2026-07-19 09:50
> **Scope**: Items 1–14: RD-01 ([#64](https://github.com/blendsdk/blend65/issues/64)) · Items 15–19: RD-02 ([#61](https://github.com/blendsdk/blend65/issues/61)) · Items 20–25: RD-04 ([#50](https://github.com/blendsdk/blend65/issues/50))
> **CodeOps Skills Version**: 3.9.0

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
