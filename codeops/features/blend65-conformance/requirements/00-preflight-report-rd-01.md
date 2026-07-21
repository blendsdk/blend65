# Preflight report — RD-01 Silent miscompiles

> **Artifact**: `requirements/RD-01-silent-miscompiles.md`
> **Iteration**: 1 · **Date**: 2026-07-21
> **Verdict**: ❌ **BLOCKED** — 2 critical, 10 major unresolved
> ⚠️ **SAME-SESSION REVIEW** — the RD was authored by the same model, in the same session, that
> ran this preflight. Mitigated by fanning the 13 dimensions out to five independent auditors on
> a **different model family**, and by re-verifying every critical/major finding with my own
> probes before recording it. Consider a fresh session for iteration 2.

## Method

Five clustered `preflight-auditor` dispatches (① document soundness · ② grounding · ③ delivery ·
④ risk · ⑤ fit), each grounding independently against the tree and compiling its own probes.
~48 raw findings merged, deduped and renumbered here. **Convergence was high**: PF-001 and
PF-002 were each raised independently by four of the five clusters, which is the strongest
signal available that they are real and not artefacts of one auditor's reading.

## What the auditors verified as CORRECT

Recorded so iteration 2 knows what is trustworthy. Every code citation in the RD checks out —
`lower.ts:717-726` (literal-only Pattern-B guard), `:841-859` (`branchOnCounter`), `:2782`
(name-keyed frame slots), `expression-typing.ts:1608-1620`, `intrinsic-validation.ts:178-188`,
`function-collection.ts:186-194`, `model-adapter.ts` `computeIrqClassification`,
`diagnostic-codes.ts` registrations (E10003/E10101/E10154 present, E10062 absent). Every spec
citation is line-exact. All three headline miscompiles reproduce. R15 is clean — no fix needs
`frontend`→`codegen`. Triage↔RD scope is bijective. AR-7's golden claim holds (no `downto` and
no word-poke anywhere in `examples/`). Slice-4a AR-6 is real. X-07/X-08 are the only
RD-01-owned ledger entries.

**The RD's facts are sound. Its defects are all in scope and oracles** — which is the same shape
this repo's last four preflights found, and worth noting as a pattern.

---

## 🔴 CRITICAL

### PF-001 — The defect class is wider than the five probes: `step` loops hang silently, and AR-1's chosen idiom would *create* a new silent hang

*Raised independently by clusters ①③④⑤. Re-verified at triage.*

```blend65
for (let i: byte = 9 downto 1 step 2) { poke($C000, i); }
```
```asm
    CMP #$01
    BCC exit          ; exit needs i == 0; counter is 9,7,5,3,1,$FF,$FD … never 0
```
**Zero diagnostics. Infinite loop.** The ascending twin (`0 to 254 step 2`) is identical.

`step` is normative frozen spec (`spec/05` §7.3) and is implemented (`lower.ts:738,863-880`).
It appears nowhere in RD-01, nowhere in RD-04's scope row, and nowhere in the triage — **unowned
across the entire conformance sequence.**

Worse, it makes AR-1 actively dangerous. The spec's `INX`/`BNE` idiom detects wrap via the Z
flag. With `step 3` the counter goes 252 → 255 → **2**, never zero, so `BNE` loops forever. A
faithful implementation of R3 therefore converts today's **loud ICE** into a **silent hang** —
manufacturing the exact defect class this RD exists to kill, while AC-1…AC-3 stay green.

**Recommendation**: make the exit **carry-based**, not zero-based. The increment already emits
`CLC / ADC #step`, so `BCS`/`BCC` is free and correct for any step; keep `INC`/`BNE` as the
step-1 shape. Reword R1 ("visits the bound exactly once **when the step lands on it**") and add
a non-dividing-step spelling to AC-2/AC-3.

### PF-002 — Sibling same-name declarations of different widths corrupt the neighbouring variable, and R5's diagnostics cannot legally touch it

*Raised independently by clusters ①②③⑤; cluster ⑤ probed it; re-verified at triage.*

```blend65
if (…) { let t: word = 300; … } else { let t: byte = 7; … }
let after: byte = 9;
```
```asm
__frame_Main_main_t     = $2000     ; ONE byte-sized slot — last-wins
__frame_Main_main_after = $2001
    STA __frame_Main_main_t
    STX __frame_Main_main_t+1       ; ← $2001 — destroys `after`
```
**Zero diagnostics. Silent memory corruption.**

Two compounding errors in the RD:

1. **M-03's description says "sibling" where the triage says "nested".** Sibling reuse is
   **spec-legal** — `spec/05:270` restricts E10062 to *nested* reuse, VAR-7 is nested-scope, VAR-8
   is same-scope. An executor implementing M-03 as written would mint a diagnostic rejecting
   legal, universal, idiomatic code — itself a Prime Directive clause-4 violation.
2. **The genuinely broken sibling case is invisible to R5 entirely.** Because sibling reuse is
   legal, no diagnostic may fire — yet the slot is sized to the last declaration and the wider
   store runs off the end. R5 closes M-03 while a shape named in M-03's own defect statement
   still silently corrupts memory, and **every AC-5 leg passes**.

**Recommendation**: (a) restore "nested" in M-03; (b) add a requirement that a name-collapsed
slot is sized to the **widest** colliding declaration and each use lowered at its own declared
width — max-wins, not last-wins. This makes sibling aliasing benign without touching the
positional slot counter that AR-3 and issue #73 protect; (c) add a **negative** AC: sibling
loops reusing a counter compile clean with no diagnostic. Silence is the only wrong option.

---

## 🟠 MAJOR

| # | Finding | Cluster(s) |
|---|---------|-----------|
| PF-003 | **Word-width boundary loops hang today** — `for (i: word = 500 downto 0)` and `to $FFFF` both probe-confirmed silent infinite loops. R1/R2 cover them by wording; AC-1/2/3 are **byte-only**, so a byte-only fix passes every criterion while word stays broken. The 16-bit wrap shape differs from the spec's INX/BNE | ③④⑤ |
| PF-004 | **Signed boundary loops hang today, and the deferral rests on a false premise.** `sbyte downto -128` compiles clean and never exits. Won't-have exports "signed loop counters" to RD-04 as if unfinished — but signed counters *work* everywhere except the boundary, so what is being deferred is a live P0 silent hang, unlabelled | ③④ |
| PF-005 | **AR-1's `INX`/`BNE` is not reachable from the current seam.** Every counter is SFA frame-homed memory (`lower.ts:700-706`); no register-resident counters exist, and codegen clobbers X freely. Building them is register allocation, not a guard fix. Achievable idiom: `INC <slot> / BNE`. AR-1 grounds the register form in the Prime Directive, which a plan author would design from | ①②④ |
| PF-006 | **R2's trigger is spelling-based.** `for (i: byte = 0 to 254 + 1)` const-evaluates to 255 and still hangs. After the fix as worded, `0 to MAX` works and `0 to MAX - 0` does not — recreating M-01b's "one spelling works, its neighbour doesn't" one notch out. `evalConst` already runs on every bound at `statement-typing.ts:798` | ④ |
| PF-007 | **A runtime bound equal to the type max hangs, and the RD never mentions it.** `let limit: byte = 255; for (i = 0 to limit)` — no static check can catch it; only the chosen idiom can. AR-1 asks "how does a boundary loop terminate" and answers for static bounds only | ②④ |
| PF-008 | **AC-4 pins one spelling.** `poke($D020, w + 1)` and `poke($D020, peekw($A000))` also emit two-byte writes. A fix keyed on a declared variable type passes AC-4 while expressions keep clobbering `$D021`. AC-2 already gets this right ("literal and named-const alike"); AC-4 does not | ⑤ |
| PF-009 | **R4's accepted-type set is unpinned, and the obvious implementation breaks legal code.** AR-2 points at the `checkAssignable` family, which rejects same-width `sbyte` (E10153) and `boolean` (E10152). Probe: `poke($D020, Color.White)` — the idiomatic MMIO write — compiles correctly today. A naive fix turns a fixed miscompile into a broken build. The `lo`/`hi` precedent deliberately accepts same-width cross-sign | ④ |
| PF-010 | **R5 understates VAR-7, and the missing half breaks currently-correct programs.** VAR-7's headline case is a local shadowing a **module-level** variable (`spec/03:138-144`), which R5's "parameter or another in-scope local" excludes. Probe: that case compiles today with *distinct, correct* storage — so fixing it is conformance, not miscompile-prevention, and the RD's severity story should say so | ②④ |
| PF-011 | **AC-2's oracle cannot observe its own criterion, and the natural fix is unfailable.** "Terminate after 256 iterations" against an oracle of "spec tests" — which see shape, not counts. Worse, a byte visited-counter is 256 ≡ 0 (mod 256), so "counter == 0" is equally green for 256 visits, 0 visits and 512. Exactly the both-sides-from-one-number class this repo has shipped before | ①③⑤ |
| PF-012 | **R6 has no false-positive story.** `irqReachable` is rooted at *every* `interrupt` function, installed or not — a handler whose address is never taken can never run, yet its callees warn. A shared zero-frame leaf has no state to corrupt and warns anyway. AR-5's entire case for warning-over-error is developer trust; safe classes firing is how a warning gets ignored. (Any zero-frame exemption must count shared runtime scratch as frame state) | ④ |

---

## 🟡 MINOR

| # | Finding |
|---|---------|
| PF-013 | AR-5 resolves to "new `W101xx`" — a band, not a code, in a range the spec partially assigns. W10100/W10110/W10111 are spec-reserved-but-unregistered; picking one manufactures fresh drift in the feature that exists to close that class. AR-2 and AR-4 both pin exact codes; AR-5 must too, and record it in the errata log |
| PF-014 | AC-10 names slice-4a AR-6 but omits **FUT-004**, which R6 discharges verbatim (`spec/06-functions.md:591`), and the `function-collection.ts:192` code-comment deferral that M-03 kills |
| PF-015 | **X-08's ledger signature is the bare substring `"BCC"`.** A carry-based wrap exit (PF-001's recommended fix) legitimately contains `BCC` — so the entry stays green after the fix and AC-8's forcing function is silently void. Tighten to the adjacent `CMP #$00` + `BCC` pair **before** the fix lands |
| PF-016 | AC-9 ("every new assertion perturbed and watched to fail") is an attestation with no failure mode. The repo's stronger pattern exists: enumerate the new-assertion set in the plan, and record per-assertion the mutation applied and the failure observed |
| PF-017 | AC-7 cannot detect a broken boundary fix (the corpus has no boundary loops), and **no golden pins the new wrap idiom** — after RD-01 the flagship new shape exists only in unit assertions, with no twin ever measuring its parity. "Scoreboard unmoved" is derived from the same bytes and adds nothing independent |
| PF-018 | AC-3's asm-shape oracle is **layout-sensitive** — branch inversion and relaxation are always-on (asm-parity RD-04/RD-05), so a pinned shape can be wrong on a correct compiler. Also: the wrap exit must be a normal conditional terminator so relaxation can rewrite it when a >127-byte body puts the back-edge out of range |
| PF-019 | R7's exposure audit covered the 18 examples but **not the committed test fixtures** — ~53 `for (let i` fixtures, plus the SFA suites that deliberately construct the IRQ∩mainline shape R6 warns on. Unverified blast radius, presented as settled |
| PF-020 | AC-4 spans two tiers in one oracle — E10154 is a frontend fact, "no `STX` to the neighbour" is a codegen fact, and R15 forbids frontend importing codegen. The working pattern is `emitAsm` from the test-harness tier |
| PF-021 | Citation ranges off by N: `control-flow-lowering.impl.test.ts:72-75` → the flipping assertions are at 76-77 (block spans 72-78); `model-adapter.ts:443-481` → function runs to 488 |
| PF-022 | "deferred **for years** as FUT-004" — the FUT file was created 2026-05-25, eight weeks before this RD. Rhetorical inflation in a document whose authority rests on verification discipline |
| PF-023 | "These five defects" / "all five are probe-verified" heads a list of six IDs; M-01c is the loud rider, and it is *also* probe-verified, so the sentence both confuses the count and under-claims |
| PF-024 | R2/R3's wording admits non-unit steps and word counters that AR-1's idiom and every AC exclude — the scoping is left to the reader |

## 🔵 Out-of-artifact (defects in neighbouring documents, found here)

| # | Finding |
|---|---------|
| PF-025 | **The conformance roadmap's P1 parenthetical is false** — it claims `slice7/main.blend` and `slice7b/game.blend` "carry multiple `let i:` declarations". Each carries exactly one; no example file contains two `for (let i` at all. A planner reading both documents inherits a phantom migration task |
| PF-026 | The roadmap's P1 table still marks M-04 "❓ — scope set by C-01" while its own resume block and the RD both record it probe-verified |
| PF-027 | Ledger entry X-07's note says the named-const spelling "silently hangs (see X-08)" — X-08 is the `downto` entry. The named-const ascending case has **no ledger entry at all** |

---

## The structural reading

Four clusters converged on one sentence: **every loop requirement in this RD is written for
step-1, unsigned, byte, statically-bounded loops, while the language's legal surface is wider on
all four axes** — and the acceptance criteria as drafted stay green across every gap.

The real defect class is not "five probed miscompiles". It is **wrap defeats the exit test**,
across `step` × sign × width × bound-spelling. The RD equated the class with the probes that
found it. That is the same error the triage documents elsewhere as its central lesson — an
instrument that can only see what it was pointed at.

PF-002 is the sharpest instance: the RD named a shape in its own defect statement, cured it with
diagnostics that cannot legally touch it, and would have closed claiming the class fixed.

## Verdict

❌ **BLOCKED.** PF-001 and PF-002 must be resolved in the RD before planning. PF-003…PF-012
should be resolved with them — they are the same widening, and re-opening the RD once is cheaper
than ten times. PF-013…PF-024 are wording and oracle corrections that can ride along.
PF-025…PF-027 are one-line fixes in neighbouring documents.
