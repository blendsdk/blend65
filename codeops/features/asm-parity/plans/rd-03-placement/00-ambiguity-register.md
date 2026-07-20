# Ambiguity Register: RD-03 Placement (plan stage)

> **Status**: ✅ GATE PASSED — all 7 items resolved (69–75), 2026-07-20
> **Scope**: plan-stage decisions for [RD-03](../../requirements/RD-03-placement.md)
> ([#49](https://github.com/blendsdk/blend65/issues/49))
> **CodeOps Skills Version**: 3.11.0

Numbering continues the feature-wide sequence (RD-stage items 64–68 live in
[`requirements/00-ambiguity-register.md`](../../requirements/00-ambiguity-register.md)) so a single
`AR #n` is unambiguous across asm-parity.

**Imported pre-resolved** from the RD stage and its preflight, not re-confirmed here: the placement
slice's identity (AR #64), the address-taken rule (AR #65), the no-regression gate (AR #66), the
`hi(&X)*4` routing to #58/#60 (AR #67), page-vs-block granularity (AR #68), and the 29 preflight
resolutions recorded in [`00-preflight-report-rd-03.md`](../../requirements/00-preflight-report-rd-03.md).

| # | Category | Ambiguity | Options | Decision | Status |
|---|----------|-----------|---------|----------|--------|
| 69 | Scope / Measurement | Does the hand-written twin (`examples/balloon/balloon.asm`) get updated to read its sprite in place too? It is the parity **reference** — the 251-byte denominator behind every "N× vs hand-written" figure in the initiative — and it currently copies 63 bytes into `$0340` at startup, which is the act RD-03 removes from the compiled program | (a) leave it unchanged / (b) update it to read in place, re-baselining 251 | ✅ Resolved — User accepted recommendation: **(a)**. The premise behind (b) is false: the twin copies to `$0340`, **below the PRG load base**, which RD-03's own Won't-Have names as legitimate and unreachable by placement. Staging into the tape buffer to buy sub-`$0800` RAM is one expert idiom; in-place alignment is the other. A parity scoreboard comparing two valid idioms is doing its job. (b) also moves the denominator mid-initiative, making every RD-01…RD-05 ratio incomparable and conflating two changes in one RD | ✅ Resolved |
| 70 | Testing / Scope | What artifact proves the alignment emission? `balloon` deliberately has no golden and AC-2 freezes the three data-bearing goldens byte-identical, so without something new nothing in the corpus contains the `!align` directive | (a) CI-tier mixed-alignment program built in-test through real `build()` + real ACME, no golden / (b) committed golden + the hand-written twin `twins.spec.test.ts` forces / (c) both | ✅ Resolved — User accepted recommendation: **(a)**. A golden is the *weaker* instrument for this specific emission: one containing the silently-wrong `!align 256, 0` looks plausible and passes, so only a **resolved-address** assertion catches the operand trap. (b) additionally forces a hand-written twin for a synthetic two-array program that has no idiom to be a twin of, polluting the corpus ratio and `SCOREBOARD.md` with permanent VICE maintenance. Precedent exists: `testing/balloon.ts:44-58` already builds a committed source through the real facade and commits no generated output | ✅ Resolved |
| 71 | Technical | Where is the alignment directive inserted — with the stream it aligns, or at serialization? | (a) prepended to the const-data stream's own entries in `constDataStream` / (b) emitted by `serialize-acme.ts` ahead of aligned streams (what the RD originally described) | ✅ Resolved — User accepted recommendation: **(a)**. The directive travels with the stream it aligns and cannot drift from it; `serialize-acme.ts` needs **no change at all**, because it already renders stream entries through `printInstr`. (b) would additionally require a new field on `InstrStream` and split the knowledge across two files. **Back-propagated** into the RD's Emission section | ✅ Resolved |
| 72 | Technical | How does the address-taken mark reach the data entry? | (a) an `aligned` flag on `ConstDataEntry`, fed by a symbol set accumulated during lowering / (b) a separate side table on `ILProgram` | ✅ Resolved — User accepted recommendation: **(a)**. Verified ordering makes it free and needs no extra pass: functions lower at `lower.ts:213-220`, `constData` is built afterward at `:237-249`, so the set is already complete when entries are constructed. R15 is untouched — everything stays inside `@blend65/codegen`. (b) forces every consumer to join two structures | ✅ Resolved |
| 73 | Process / Sequencing | How is the work phased? Adding the mechanism is a **provable corpus no-op** until balloon is rewritten, because no fixture takes a const array's address today | (a) mechanism first as a proven no-op, then the balloon rewrite / (b) build everything unwired, wire once at the end (RD-05's shape) | ✅ Resolved — User accepted recommendation: **(a)**. With the address-taken rule the mechanism is *already* inert on code that does not opt in, so "unwired" would add ceremony without buying the isolation it bought RD-05. Landing it first turns the 14 byte-identical goldens into a **free proof that the rule excludes by-ref arguments** — the exact CRITICAL the preflight caught (PF-001). The corpus then regenerates exactly once, at the balloon rewrite | ✅ Resolved |
| 74 | Testing | How are balloon's two migrated observable checks expressed once they leave the shared twin table (`Check` has no symbol-relative form)? | (a) raw symbol-resolved reads in `balloon.spec.test.ts` / (b) extend `Check` with a `{ symbol, offset }` form | ✅ Resolved — User accepted recommendation: **(a)**. It matches `testing/observables.ts:5-12` verbatim — implementation-coupled assertions live in the fixture suite by construction — and needs no type change. (b) weakens the "source-mandated only" invariant the shared table exists to enforce, and the twin's symbol names differ from the compiled program's, so it would need per-consumer aliasing on top | ✅ Resolved |
| 75 | Process | The verify command every Verify line references | (a) the full command from `CLAUDE.md` / (b) the same without the frozen-lockfile install | ✅ Resolved — User accepted recommendation: **(a)** — `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`, exactly as the project prescribes for every commit | ✅ Resolved |

## Resolution notes

**AR-69 (the correction that decided it).** The first framing of this question asserted that the
twin "does something the project now classifies as a defect". It does not, and the RD says so:
`$0340` is below the PRG load base, and *"a single-load PRG cannot place below its own load
address; that is what the twin's copy exists for, and it is not what this RD replaces"*. The
Prime Directive's "never duplicate bytes in RAM" governs what the compiler **forces on the user**
— a hand-coder freely choosing the staging idiom is not that.

A second correction sharpened the cost side: an expert re-writing the twin in place would not
mirror the compiler. They are not constrained to `hi()`, so they would use **64-byte** alignment
(`!align 63, 0`, padding ≤63 rather than ≤255) and an assembly-time literal pointer
(`lda #balloon/64` — two instructions, not four). The honestly re-baselined twin is therefore
~250±30, the ratio barely moves, and the cost is losing a stable denominator mid-initiative.

**AR-69 (what (a) obliges).** Leaving the twin alone puts the honesty burden on AC-8's routing
re-audit. It is not enough to drop `sourceForced: true`; the prose must state that the twin's copy
is the *file-size* idiom and the compiler's placement the *runtime* idiom, and decompose the
residual 318−251 into the padding accident (0–255, today 6), the `hi(&X)*4` materialization routed
to #58/#60, and load/store elimination routed to #52. That prose is what makes 1.27× a true
statement rather than a flattering one.

**AR-70 (a claim retired, not just answered).** M7's supporting rationale — that without a new
golden "the scan cannot observe a byte this RD produces" — is true but **immaterial**, and the
plan should not repeat it as motivation. ST-B39/B40/B43/B44 scan *jump shapes inside function
sections* (`golden-layout.spec.test.ts:63-92`); an `!align` sits ahead of a const-data stream and
its padding is inserted by ACME at assembly time. No golden, new or existing, contains a byte those
invariants can judge. The fixture's justification is per-symbol discrimination and the
resolved-address assertion — not invariant coverage.

**AR-73 (why the free proof matters).** PF-001 was the preflight's most dangerous finding: `&X`
and a by-reference array argument emit the *same* IL `addrOf` operand, so an implementation that
scanned IL would align `slice7b`/`slice8b` (+435 bytes) and try to page-align `slice8`'s function
labels. Phasing the mechanism in ahead of the balloon rewrite means that if the rule is wrong, the
goldens move **in the phase whose entire acceptance is that they do not** — the defect surfaces
against a byte-exact oracle rather than tangled up in balloon's own 359-byte delta.

## Hardening disclosure

**Confidence High** on AR #69 and AR #70 — both were put to an independent challenger that
received the options without the lead's preference, and both of the lead's framings were corrected
by it before reaching the user (the `$0340`-below-load-base premise, and the empty invariant-
coverage rationale). **Confidence High** on AR #71–#73, which rest on verified code ordering and
file-level facts rather than judgement. **Confidence Medium** on AR #74: the split follows
`observables.ts`'s stated doctrine, but the twin tier's behaviour after the shared table shrinks is
proven only on the local VICE tier, which CI never runs.
