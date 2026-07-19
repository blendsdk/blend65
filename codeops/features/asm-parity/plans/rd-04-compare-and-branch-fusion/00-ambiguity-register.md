# Ambiguity Register: RD-04 Compare-and-Branch Fusion (plan)

> **Status**: ✅ GATE PASSED — all 9 items resolved (7 planning + 2 runtime)
> **Last Updated**: 2026-07-19 16:31
> **Scope**: Implementation plan for asm-parity/RD-04 (`../../requirements/RD-04-compare-and-branch-fusion.md`)
> **CodeOps Skills Version**: 3.9.0
>
> Requirement-level decisions live in the feature register
> (`../../requirements/00-ambiguity-register.md`) and are cited as **req-AR #N**; they import as
> pre-resolved context and are NOT re-confirmed here: fused-form acceptance bar + twin-idiom
> transfer to #51 (req-AR #20), boolean-literal fold at lowering (req-AR #21), full
> condition-position lowering + SFA structural definition + claim-and-discard staging fallback
> (req-AR #22), fused IL terminator mechanism (req-AR #23), corpus supersession + same-change
> budget tightening (req-AR #24, #12), branch-range out of scope → #65/#51 (req-AR #25),
> scoreboard freshness (req-AR #17). Preflight fixes PF-014…PF-017 (dangling-target ICE
> requirement, named unit-tier homes + one new corpus fixture, golden-grounded numbers) are
> likewise imported as RD content.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Sequencing | Phase structure: when do the lowering flip, SFA adapter edit, and corpus supersession land relative to the terminator/translator groundwork and the new fixture? | A: bottom-up, fixture after the flip · B: same skeleton, fixture authored BEFORE the flip | B — fixture before the flip (challenger-diverged pick adopted) | ✅ Resolved |
| 2 | Technical | Dangling-target ICE: where does the check live, and what does it say? | A: function-level pre-pass at translation start + shared `terminatorTargets()` successor helper · B: inline checks at each branch-emission site | A — pre-pass + shared helper | ✅ Resolved |
| 3 | Technical | Where does the branch-context recursion live? `lower.ts` is already 2 591 lines (standards say split >700) | A: in place in `lower.ts`; debt note names the real split seams · B: new `lower-condition.ts` module | A — in `lower.ts` | ✅ Resolved |
| 4 | Naming | Final IL terminator name (RD delegates: working name `brcmp`) | A: `brcmp` · B: `cmpbr` · C: `brcond_cmp` | A — `brcmp` | ✅ Resolved |
| 5 | Naming | New acceptance fixture name (RD delegates; content: compound guard + `!` + signed compare + `peek`-in-right-clause) | A: `guards` · B: `clip` · C: `steer` | A — `guards` | ✅ Resolved |
| 6 | Technical | Verify command for every plan Verify line | Detected from project CLAUDE.md (+ local VICE tiers where a phase touches emulator-verified assets) | Confirmed: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test` | ✅ Resolved |
| 7 | Scope | RD Should-Haves in this plan? (word-framing simplification; closeout delta record) | A: both in scope · B: Must-Haves only | A — both in scope | ✅ Resolved |
| 8 | Technical (runtime) | `brcmp` printer type tag: ST-9a/ST-8a pin the literal word `byte`, but the comparison-instruction rendering 03-01 says to reuse emits `i8u` | A: `i8u` — match the printer · B: `byte` — honor the ST literal | A — `i8u`; the ST rows are corrected | ✅ Resolved |
| 9 | Technical (runtime) | Dangling-target ICE emission: 03-01 names `iceUnsupported`, but that helper wraps its argument in an "unsupported op … deferred to RD-07c" sentence the case does not fit | A: sibling `iceDanglingTarget` helper on the same bag convention, exact 03-01 text + function name · B: reuse `iceUnsupported` verbatim | A — sibling helper | ✅ Resolved |

### Resolution Notes

**plan-AR #1 (phase structure — fixture before the flip):** Shared skeleton either way: (1) IL
terminator infrastructure, (2) translator branch-form framings, (3) the atomic flip —
condition-position lowering + SFA adapter + full corpus supersession in ONE phase (the SFA
preorder contract is one contract; partial flips and feature flags were considered and rejected —
a flag would have to synchronize `model-adapter.ts` and `lower.ts` across the R15 boundary, and
the drift safety it buys already exists as the loud slot ICE). The user chose to author the
`guards` fixture BEFORE the flip: the hand-written twin is then produced blind to fused output —
an honest parity bar rather than a transcription of the new golden — and the fixture's VICE
observables are green before the riskiest phase, so the flip is checked against unchanged runtime
behavior, not only IL specs and golden diffs. Its pre-fusion golden/budget rows are knowingly
superseded one phase later; that double-touch IS the measured before/after delta the closeout
quotes. The req-AR #22 claim-and-discard staging fallback is NOT used — lowering and adapter land
together. *Hardening: Layer-4 challenger ran (blind, one spawn for the plan batch).
Confidence: High. Challenger: diverged — it recommended fixture-before-flip against my initial
after-flip lean; its twin-independence argument (Prime Directive: the twin must be the bar, not a
copy) was decisive and I adopted it before presenting.*

**plan-AR #2 (dangling-target ICE — pre-pass + shared helper):** A function-level validation pass
at translation start (precedent: `prescanAll`, `translate.ts:284`) collects the block-label set
and checks every terminator target — `br`, `brcond`, `brcmp` — uniformly; a miss records an ICE
naming the function, block, terminator kind, and missing label through the existing
never-throw diagnostic-bag convention. Companion change: a shared successor-enumeration helper
(`terminatorTargets`) in the IL package used by the validator AND the termination analysis —
which must learn `brcmp` in the same change, because a terminator kind contributing zero
successors would under-approximate reachability and misclassify toward the non-terminating
startup shim, the documented crash direction (`termination.ts:6-11`). The defensive `continue` at
`termination.ts:56` stays (the analysis remains total); its comment now points at the enforced
invariant. *Challenger: converged (the helper extraction is its refinement, adopted).*

**plan-AR #3 (recursion home — `lower.ts`):** The branch-context recursion is bidirectionally
entangled with module-private internals: statement lowerers call into it, and its fallback path
and nested value-position subexpressions (e.g. `if (f(a && b))` — the inner `&&` is
value-position and must claim its slot through the shared `scCounter`) call back into
`lowerExpr`/`materialise`/`claimResultSlot` — all private (`lower.ts` exports only `LowerInput`
and `lowerToIL`). A separate module is a genuine import cycle, not a clean split. The ~700-line
standard is acknowledged as pre-existing debt; the future split's low-coupling seams are the
intrinsics block and the place/indirect machinery, not the newest most-coupled code.
*Challenger: converged.*

**plan-AR #4 (`brcmp`):** Stays in the `br*` terminator-kind family (`br`, `brcond`, `brcmp`)
that the printer, termination analysis, and translator switch enumerate. `cmpbr` (execution
order) and `brcond_cmp` (verbose two-word kind) rejected.

**plan-AR #5 (`guards`):** Names what the program is made of — guard conditions in every hazard
shape (compound window check, negated flag, signed compare, MMIO read in the right clause);
matches the short thematic style of `gate`/`rasterpoll`/`balloon`. `clip`/`steer` name only one
shape each.

**plan-AR #6 (verify command):** As detected in project CLAUDE.md. Phases touching
emulator-verified assets additionally run the local VICE fixture/twin tiers
(`describe.skipIf` in CI per AR-27).

**plan-AR #8 (printer tag — `i8u`, runtime):** Surfaced while authoring the ST-9a oracle. The
printer declares `ilTypeTag` "the **single** place this mapping lives" (`print-il.ts:20-30`) and
every typed IL line in the corpus renders `i8u`/`i8s`/`i16u`/`i16s` (`print-il.spec.test.ts:88-92`,
`:110-111`); `byte` exists nowhere in the IL text surface. 03-01 §Printer independently says to
render "exactly as the comparison instruction renders", which resolves to `i8u`. The literal
`byte` in the ST-9a/ST-8a rows is therefore prose that leaked into a pinned string, not a decision
to give `brcmp` its own type vocabulary (option B would also have left the signed/word spellings
undefined — the rows only ever show `byte`). Both ST rows are corrected to `i8u` as part of this
resolution; the corrected text is the immutable oracle.

**plan-AR #9 (dangling-target ICE — sibling helper, runtime):** 03-01 §Dangling-target ICE cites
"the existing `iceUnsupported` diagnostic-bag convention", but that helper is not a passthrough —
it wraps its argument into `IL→Instr: unsupported op '<what>' (deferred to RD-07c)`
(`translate.ts:1897-1903`). A dangling target is neither an unsupported op nor deferred work, so
reusing it verbatim would ship a false attribution on every occurrence. The cited *convention* is
the record-and-continue bag pattern (`bag.addICE(IceCode.Unexpected, null, msg)`, never throw),
which a sibling `iceDanglingTarget()` follows exactly. The message carries 03-01's text plus the
function name plan-AR #2's resolution note asks for and 03-01's template omits.

**plan-AR #7 (Should-Haves in scope):** Word-framing simplification is not separate work — the
fused framings' internal true/false labels becoming real block targets IS the simplification
(their `LDA #$01/#$00` tails disappear). The closeout delta record is one cheap task, and
plan-AR #1 makes its numbers measured rather than reconstructed.
