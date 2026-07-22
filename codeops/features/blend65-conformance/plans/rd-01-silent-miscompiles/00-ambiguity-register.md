# Ambiguity Register: RD-01 Silent miscompiles (plan)

> **Status**: ✅ GATE PASSED — all 8 items resolved
> **Last Updated**: 2026-07-22 12:20
> **Scope**: PLAN-level decisions only. The RD (`../../requirements/RD-01-silent-miscompiles.md`)
> owns AR-1…AR-10 (design) and R1…R9 / AC-1…AC-16 (scope + acceptance), each already resolved
> across three preflight iterations. This register numbers only the decisions the **plan**
> introduces, as `AR-P#`, to avoid collision with the RD's `AR-#`.

The RD is exceptionally prescriptive, so the plan-level ambiguity surface is small: two genuine
forks (decided by the user) and six single-viable-path decisions (grounded in the code, surfaced
for veto, none vetoed). No item deferred.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| AR-P1 | Scope | Phase decomposition of the four defect surfaces | (A) 5 phases — one per surface + dedicated closeout; (B) 6 phases — split M-03 sizing/pop-3; (C) 4 phases — fold closeout into forcing phases | **A — 5 phases** (M-01 · M-02 · M-03 · M-04 · closeout), each feature phase spec-tests-first | ✅ Resolved |
| AR-P2 | Technical | Verify cadence filling each Verify line | (A) full root verify at phase close, targeted `yarn workspace` during tasks; (B) full verify everywhere | **A** — targeted during tasks, full root verify at every phase close | ✅ Resolved |
| AR-P3 | Technical | RD AR-1 names a "rematerialisation hazard": the pre-step counter value must survive to the wrap compare, but `current`'s slot is overwritten by `next`. Scratch copy, or reconstruct `next ∓ step`, or reuse an existing live value? | (A) reuse the already-live in-block `current` temp — no new op; (B) scratch copy; (C) reconstruct from `next ∓ step` | **A** — grounded: `incrementCounter` (`lower.ts:864-883`) already holds `current` (`:872`) and `next` (`:873`) as live temps in the incr block, and the block's terminator has not crossed a boundary, so the pre-step value is available with no scratch and no reconstruction. Recommendation accepted (surfaced for veto, not vetoed) | ✅ Resolved |
| AR-P4 | Technical | RD AR-3 requires per-declaration type retention for M-03 pop-3 while allocation stays positional. Mechanism? | (A) per-use type resolution stamped into the model, read at the lowering use site instead of the name-keyed slot; symbol table gains only enough sibling-distinguishing structure to resolve each use — slot allocation untouched; (B) restructure the frame-slot table to scope-qualified slots | **A** — grounded: the frontend symbol table is flat/last-wins (`function-collection.ts` `bodyScope.symbols.set(name, sym)`, locals harvested flat) and lowering reads width name-keyed at `lower.ts:1184` `slotIlType(frame, expr.name)`. Option B re-homes slots — the exact defect class this RD kills (RD AR-3 forbids it). Recommendation accepted | ✅ Resolved |
| AR-P5 | Technical | Where the "provably wrap-safe" emission-gating predicate lives and its shape (PF-050 gating) | (A) frontend const-evaluates the bound (RD AR-2) and stamps a per-loop wrap-safe bit into the model; lowering emits the wrap guard only when the bit is absent; predicate = bound statically known AND `bound ± step` stays within `[typeMin, typeMax]`; (B) decide in lowering | **A** — grounded: RD AR-2 already mandates a frontend-stamped bound (the `evalConst` result at `statement-typing.ts:798` is currently discarded); the wrap-safe bit rides that same stamping. A syntactic-only predicate is what let M-01b past the M-01d guard. Recommendation accepted | ✅ Resolved |
| AR-P6 | Naming / UX | Diagnostic message text for the codes the RD pins (E10154 R4, E10062 R5, W10182 R7) | (A) draft message text in the 03 component docs following existing diagnostic phrasing conventions, user adjusts at review; (B) specify every string now | **A** — codes are fixed by RD AR-4/AR-6/AR-7; message wording is low-stakes and follows the registry's existing phrasing. Drafted in the 03 docs. Recommendation accepted | ✅ Resolved |
| AR-P7 | Naming | Component-document decomposition and spec-test file names | one 03-doc per surface: `03-01-loop-exit`, `03-02-poke-width`, `03-03-frame-slot`, `03-04-irq-warning`; spec-test files co-located per package (see 07) | Single viable structure — mirrors the four independent surfaces and the touched packages (codegen / frontend / frontend+codegen / frontend). Recommendation accepted | ✅ Resolved |
| AR-P8 | Scope | AC-14 requires X-07/X-08 retired "in the same change that fixes them" and slice8b re-goldens when the loop lowering changes — but the project's hard "every phase closes on full CI-equivalent verify" rule forbids landing P1 with a red golden/ledger and deferring the fix to P5 | (A) mechanical re-goldens land in their **forcing** phase (P1 owns slice8b golden + X-07/X-08 retirement + X-08 red-perturbation + control-flow unit pins + the +1 scoreboard row), split into **two green commits** P1-a (behaviour-neutral) → P1-b (atomic); P5 owns the closeout **discharge** (AC-16 deferral-expiry gate, AC-15 per-assertion attestation, final scoreboard/ratchet verification, roadmap sync); (B) a red P5-deferred closeout | **A with the two-commit P1 split** — forced by the roadmap cross-cutting rule ("a plan whose Verify command is weaker than CI has produced a CI-red-by-construction phase") and AC-14's "same change". Refines AR-P1's 5-phase shape without contradicting it (P5 stays a real closeout, now discharge-only). Surfaced during authoring; **user delegated the final call ("you decide the best possible option and proceed")** — decided per the note below | ✅ Resolved |

### Resolution Notes

**AR-P3:** The consequence owned regardless of mechanism is the +1 load/compare per guarded
iteration (RD AR-1 Cost clause + Notes scoreboard row). Option A adds no cost beyond that already-
owned compare; the fused increment-and-branch terminator that would recover it is RD-filed to the
asm-parity lane, out of scope here.

**AR-P4:** Population 2 (store overrun, R6) is a pure slot-**sizing** fix in
`frame-computation.ts`; population 3 (read truncation, AC-9) is the per-use resolution above. Both
live in Phase 3; neither changes where slots land.

**AR-P8:** X-07 (`0 to 255` full page) and X-08 (`9 downto 0` countdown) are both M-01 loop
entries owned by RD-01 (verified in `expressiveness-ledger.json`). X-08's stored `asmSignature`
note still describes a "carry-based wrap exit" from before RD AR-1 was rewritten to the `brcmp`
form — P1 updates that note and perturbs X-08 to watch it go red, because the **retained** bound
compare means a `downto 0` loop may still emit `CMP #$00 / BCC` alongside the new `brcmp`, which
would leave the tightened signature green and void AC-14's forcing function (RD Notes bullet 2).

**The decided structure (user-delegated).** P1 lands as **two green commits**, because Option A is
constraint-forced but a single monolithic commit is avoidable:

- **P1-a — behaviour-neutral.** The frontend stamps `evaluatedBound` + the `wrapSafe` bit into the
  model (AR-2 / AR-P5). No codegen consumes it yet → **byte-identical output**, every golden green,
  the ledger still green (the defect genuinely still lives). Only model-shape *impl* tests may need
  updating. This isolates the AR-2 plumbing on a clean diff and keeps the change bisectable.
- **P1-b — atomic behaviour change.** The gated wrap `brcmp`, slice8b re-golden, X-07/X-08
  retirement, scoreboard/ratchet re-derivation, and the control-flow unit-pin flips land **together
  in one commit** — forced, not stylistic: the moment P1-b fixes M-01, the ledger entries assert a
  falsehood and their gate goes red, so P1-b *cannot* pass CI unless it also retires them (AC-14
  "same change"; roadmap "same commit" for the ratchet/scoreboard).

**Ordering gate inside P1-b:** the X-08 red-perturbation is a *pre-retirement verification*, not a
deliverable — retighten X-08's signature to the wrap form and watch it actually go red against the
fixed output **before** retiring the entry, proving the forcing function fired rather than retiring
on faith. Commit mechanics are owned by exec_plan (`/gitcm`); this register only fixes the two
boundaries and their green-ness. **Confidence:** the placement is High (constraint-forced); the
two-commit split is a lower-confidence preference whose only load-bearing invariant is that P1-b is
atomic.
