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

---

# Preflight report — RD-01 Silent miscompiles · **iteration 2**

> **Artifact**: `requirements/RD-01-silent-miscompiles.md` @ `709b9ee` (tree clean at scan start)
> **Iteration**: 2 · **Date**: 2026-07-22
> **Verdict**: ❌ **BLOCKED** — 6 critical, 6 major
> ✅ **Fresh session, no authoring bias** — this iteration was run in a session that did not
> author or revise the RD, discharging iteration 1's own warning. Five clustered
> `preflight-auditor` dispatches on a different model family, plus an independent probe pass by
> the lead. Every critical below was re-verified by the lead against a compiled probe at HEAD.

## What iteration 2 verified as FIXED

The revision genuinely absorbed iteration 1. Of PF-001…PF-027, **21 are fixed cleanly** and were
re-verified, not taken on trust:

| Group | Status |
|---|---|
| PF-002 (sibling vs nested) | **Fixed** — M-03's two-population split, R5 diagnostics / R6 widest-sizing, AC-8's five tests + AC-9's negative are mutually coherent and match `spec/03:131-153` + `spec/05:270`. **Directly answering the brief: the width rule does NOT mint a diagnostic on spec-legal sibling reuse.** But it does not fully fix M-03 either — see PF-033 |
| PF-003/004/006/007 (class widening) | **Fixed** — M-01e/M-01f, both no-static-trigger bullets, R1/R2's matrix, AC-1/AC-3's spellings all present |
| PF-005 (INX/BNE unreachable) | **Fixed in wording** — memory-resident, errata E-08, register counters now Won't-have. But the replacement mechanism is unreachable in a new way — PF-034 |
| PF-009/010/012 (R4 accepted set, VAR-7, FP filter) | **Fixed** — AR-5's `checkAssignable` trap, AR-9's conformance-not-miscompile honesty, AR-8's address-taken + scratch-counting filter |
| PF-011/016/017/018/020 (oracles) | **Fixed** — AC-2's word counter with the 256≡0 rationale inline, AC-15's per-assertion mutation record, AC-13's artifact pin, AC-4's IL+e2e split, AC-6's two-tier R15-legal split |
| PF-015 (X-08 signature) | **Fixed in the tree** — ledger now pins the adjacent `CMP #$00` + `BCC` pair; verified matching at HEAD (`x08.asm:35-36`) |
| PF-019/014 (fixtures, deferrals) | **Fixed** — R8 sequences the audit before wiring; AC-16 names all three discharges |
| PF-021/022/025/026/027 | **Fixed** — citations corrected, rhetoric removed, neighbouring docs amended |

**All code and spec citations re-verified line-exact**, including `lower.ts:700-706/717-726/841-859/2782`,
`expression-typing.ts:1608-1620/1543-1546`, `intrinsic-validation.ts:178-188`,
`model-adapter.ts:443-488`, `statement-typing.ts:798`, `control-flow-lowering.impl.test.ts:62-70/72-78`,
issue #73's fragility quote, and every `spec/` line. Registry facts hold: E10062 absent, W10182 free,
E10154 registered. Counts exact: 18 examples, 14 goldens. **All nine probed defects reproduce at HEAD.**

**One auditor claim was refuted and is NOT reported**: a cluster reported the CLI exits 0 on a failed
build. It does not — exit 3 on the ICE path, exit 1 on a semantic error. AC-12's oracle is safe.

## The structural reading

Iteration 1's lesson was *the class is wider than the probes*. The revision widened the **defect
inventory** correctly and completely. It did not widen **AR-1**, the resolution everything leans on.
AR-1 still answers the boundary question for one corner — unsigned, byte, ascending, extreme bound —
and five of the six criticals below are that gap seen from a different angle.

The sharpest instance: **the revision's mandated idiom would regress loops that are correct today.**
`for (i: byte = 0 to 253 step 2)` and `for (i: sbyte = -5 to 5)` compile and run correctly at HEAD;
under a carry-based exit they silently overshoot or exit early. Iteration 1 blocked because the
proposed fix would convert a loud ICE into a silent hang; iteration 2 blocks because the proposed fix
would convert **working code** into silent wrong code. Same species, one axis over.

---

## 🔴 CRITICAL

### PF-028 — AR-1's carry-based exit is wrong for every signed cell
*Clusters ①④ + lead probe.* RD:164 claims `BCS` is "correct for **any** step"; R1 (RD:138) and AC-1
(RD:182) both mandate signedness. **The carry is the unsigned wrap flag; signed wrap is V.**
`$7F + 1 = $80` leaves C=0, V=1 — so `sbyte to 127` hangs under the mandated idiom. Descending, the
borrow fires at the 0→−1 crossing, not at −128: `5 downto -128` terminates early skipping the whole
negative half; `-5 downto -128` hangs. Used as a supplement it **breaks interior signed loops that
work today** (`-5 to 5` exits before visiting 0). The RD's own M-01f row displays the N-xor-V framing,
so the signed machinery is known — it never reaches the fix.
**Resolution**: sign-dispatch the wrap flag in AR-1 (C for unsigned, V for signed, high byte for
`sword`), or adopt the value-level form in PF-034 which type-dispatches for free. Name the signed
cells in AC-1's VICE subset.

### PF-029 — Replace-vs-supplement is unstated; AC-4 reads "replace"; R1 has no in-range or zero-trip invariant
*Cluster ④ + lead probe.* AR-1's "deliverable shape is `INC`/`DEC` on the slot **plus a branch on
wrap**" never says the Pattern-A compare is retained, and AC-4 (RD:185) says the exit "**is** a wrap
test, **not a compare**". Read literally, every interior loop miscompiles: `0 to 9` runs 256
iterations; `0 to 9 step 20` runs the body at 20..240; the zero-trip `9 to 0` runs 247 bodies instead
of 0 — **verified correct today** (probe: `LDA #$00 / CMP j / BCC exit` exits immediately). A counter
indexing an array then corrupts 200+ bytes — strictly worse than the hang class this RD kills.
Nothing forbids it: R1 pins only termination and bound-visited-once.
**Resolution**: state that the wrap branch **supplements** the compare; add to R1 *"the body never
executes with the counter outside the range's visit set, and a loop whose init is already past its
bound executes zero iterations"*; add interior, zero-trip and single-iteration cells to AC-1.

### PF-030 — A carry-only exit overshoots interior bounds with step > 1 — a regression, invisible to every criterion
*Cluster ③.* Carry/borrow-only is exact only at type-extreme bounds. `0 to 253 step 2` runs the body
at **254** (254+2 carries only afterwards); `9 downto 2 step 2` runs it at **1**. Both exit correctly
today via the compare. The RD's own probe M-01c (`9 downto 1 step 2`) is the lucky neighbour where
borrow-only happens to be exact — so even a dedicated M-01c criterion cannot catch this. **No corpus
golden contains a `step` loop** (verified), so AC-12 stays byte-identical while the regression ships.
**Resolution**: as PF-029, plus AC legs for interior non-dividing steps in both directions with count
oracles (`0 to 253 step 2` = 127 visits; `9 downto 2 step 2` = 4).

### PF-031 — The trigger is not "bound at the type extreme"
*Lead.* R1 says "including when the bound is the counter type's **extreme**"; AC-1 tests "a
**boundary** loop"; AC-3 tests "a runtime value equal to the type **maximum**". But
`for (i: byte = 0 to 254 step 2)` and `for (i: sbyte = 0 to 126 step 3)` both **compile clean
(exit 0, zero diagnostics) and hang** — their bounds are *inside* range; it is `bound + step` that
escapes it. A fix keyed on "bound == extreme" leaves these hanging with every criterion green. This
is PF-006's spelling-keyed failure one level up: *extreme*-keyed instead of *spelling*-keyed.
**Resolution**: restate the trigger as *"the counter can pass the bound by wrapping rather than by
reaching it"* — i.e. keyed on `bound ± step` escaping the type range, not on the bound's value. Add
both probes above to AC-1/AC-3.

### PF-032 — R2/AC-3 and AR-10/AC-12 are mutually unsatisfiable: `slice8b`'s golden pins a runtime-bound loop
*Clusters ①④ + lead verification.* `examples/slice8b/main.blend:10-11` —
`let last: byte = len - 1; for (let i: byte = 0 to last)` — with `last` computed by `SEC / SBC #$01`,
so `len = 0` yields `last = 255`. `slice8b.asm.golden:79-82` pins the compare-only exit
`LDA last / CMP i / BCC exit`, exactly the shape RD:70-71 declares hangs. R2/AC-3 force it to change;
AR-10/AC-12 forbid the change. The compiler cannot statically prove `last ≠ 255`. **A live latent
silent miscompile sits inside the acceptance corpus the RD declares byte-identical.** The failure
pressure points the wrong way: AC-12 is a loud CI gate, so the path of least resistance is to exempt
runtime bounds — re-opening the headline class. Root cause: AR-10's C-01 audit checked for `downto`,
`step`, word/signed counters and word pokes, and never asked about the **runtime-bound spelling —
row 4 of the RD's own class table**.
**Blast radius verified = exactly one golden**: `slice8b` is the only source-level runtime-bound
for-loop in `examples/`.
**Resolution**: amend AR-10/AC-12 to "byte-identical **except `slice8b`**, whose `copyBytes` exit
moves to the wrap-safe runtime-bound idiom, re-goldened with the delta and scoreboard shift explained
at closeout". This **discharges AC-13 for free** — slice8b's golden becomes the committed pin of the
new wrap idiom, and no new example is needed. Also state in R2/AR-2 that the trigger is *"not provably
non-extreme"*, not *"provably extreme"*.

### PF-033 — M-03 has a third population the RD does not name: sibling collision **truncates reads** of the wider declaration
*Lead.* R6 cures the *overrun*; it does not cure the *truncation*. Probe:

```blend65
if (…) { let t: word = 300; pokew($D000, t); } else { let t: byte = 7; … }
```
emits `LDA t / STA $D000` — **a one-byte store; the high byte silently vanishes.** The control probe
with distinct names emits the correct `LDA t / LDX t+1 / STA $D000 / STX $D000+1`. Zero diagnostics.
Root cause `function-collection.ts:326` — `bodyScope.symbols.set(name, sym)`: one Symbol per name,
last-wins, and **no scope tree**, so a read of the earlier declaration resolves to the later
declaration's type. AC-9's oracle is *"the neighbouring variable is untouched"* — which this case
passes while still being wrong.
Two consequences the RD must absorb: (a) R6's clause "each use lowered at its own declared width"
is not a sizing change — it requires the symbol table to retain per-declaration types; (b) the same
missing scope information is what R5 needs to distinguish spec-illegal **nested** reuse from
spec-legal **sibling** reuse. AR-3 correctly forbids scope-qualified *allocation*, but a scope-aware
*walk* is unavoidable, and the RD nowhere says so.
**Resolution**: add the truncation shape to M-03 as population 3; extend AC-9 with a value assertion
(the wide read emits both bytes), not only an address assertion; state in AR-3 that resolution needs
per-declaration types while **allocation** stays positional.

---

## 🟠 MAJOR

| # | Finding |
|---|---------|
| **PF-034** | **AR-1's mechanism is inexpressible at the seam it names** — the same species as PF-005, one layer deeper. `ILTerminator` (`instruction.ts:160-185`) is `br \| brcond \| brcmp \| ret \| unreachable` — **no flag branch**; `translate.ts:374-380` makes it a stated correctness invariant that *"nothing may carry across a basic-block boundary"*, yet the wrap is produced in the `incr` block and the exit sits in `cond`, which also has a **no-add predecessor** (loop entry), where a carry test is meaningless. Worse, **no `INC`/`DEC` emission site exists anywhere** outside the opcode table (verified), and `DEC` sets only N/Z — so AR-1's stated shape cannot emit the RD's *headline* defect M-01a at all. Options: (a) a fused increment-and-branch-on-wrap terminator mirroring `brcmp`'s fused design — new IL surface, relaxation must learn it for AC-5; (b) expressible today — terminate the `incr` block with `brcmp lt(next, current)`, whose unsigned/signed framing gives PF-028's sign dispatch for free, at one extra load+compare per iteration. **Recommend (b) for RD-01, (a) filed to the asm-parity lane.** Name the rematerialisation hazard: `current`'s slot is already overwritten by `next` at terminator time |
| **PF-035** | **The count-exact oracle covers only the byte/unsigned/step-1 corner.** AC-2 pins counts for exactly two cells; AC-1's behavioural leg is an unpinned *"representative subset"* asserting only termination. A word, signed, step or interior loop that is off by one **terminates** (AC-1 green), has a wrap-shaped exit (AC-4 green) and is count-checked nowhere. Fix: pin AC-1's VICE subset to minimum axis coverage, and add near-boundary count cells so counts stay small and word-representable — `$FFF0 to $FFFF` = 16, `-120 downto -128` = 9, `$FFF0 to $FFFF step 3` = 6, plus an interior `0 to 9` = 10 and a zero-trip = 0. Note 65536 ≡ 0 in a word counter recreates AC-2's own 256≡0 trap one width up |
| **PF-036** | **AC-1/AC-3's `[CI]` "terminates" oracle is circular.** A shape test cannot observe termination — it observes that the emitted shape matches the idiom *asserted* correct, which is worthless whenever the idiom itself is wrong, as PF-028 shows it currently is for signed. The only real termination oracle is the `[local]` VICE leg, which CI skips (AR-27) and whose subset is unspecified |
| **PF-037** | **The handler∩handler hazard's "filed for RD-04" is filed nowhere.** RD:154-157 says "Named here so it is owned, not silently absent; filed for RD-04". Verified: the conformance roadmap's RD-04 row lists only `until`, signed `/`/`%`, `arr[i] += 1`, `hi()`; no issue exists. The only record is the exporting RD's own Won't-have bullet — **the exact orphaned-deferral mechanism this feature exists to end**, and a violation of the roadmap's own rollout-RD rule. File it or add the roadmap row in this revision |
| **PF-038** | **AR-8 does not say which BFS the address-taken filter applies to.** `computeIrqClassification` (`model-adapter.ts:449,462-470`) roots at **every** interrupt handler and drives **frame placement**; `irq-interference.spec.test.ts:71-118` (ST-17/18/19) and `irq-classification.impl.test.ts` pin that rooting for never-address-taken handlers. Applied at the classification seam, AR-8 flips those assertions and moves frames; applied to the warning root set only, it touches nothing. An executor "fixing" the fixtures to match would be re-homing frames — the defect class this RD exists to kill. State the scoping in AR-3's bold-trap style |
| **PF-039** | **AC-12's "compile clean" is undefined against W10182**, exactly where it will be contested. The SFA suites deliberately construct the IRQ∩mainline shape R7 warns on. Under a no-diagnostics reading AC-12 is unsatisfiable without editing the fixtures whose shape is their point; under a no-errors reading it is silently vacuous about warnings. Define clean = zero **errors**; have R8's audit enumerate fixtures expected to fire W10182 and assert that expectation in their own suites — which doubles as extra real-world probes for AC-11 |

---

## 🟡 MINOR

| # | Finding |
|---|---------|
| PF-040 | **The X-08 note describes a state its own commit already changed.** RD:203-205 says the signature "**is currently** the bare substring `BCC`" and "must be tightened **before** the fix lands" — it was tightened to the adjacent pair in `709b9ee`, the same commit. A planner inherits a completed task. **Second-order risk worth keeping**: if the fix retains the bound compare (as PF-029 requires), `downto 0` may **still** emit `CMP #$00` + `BCC`, leaving the entry green and AC-14's forcing function void again. Reword to a done-state, and require the plan to re-verify the signature actually goes red against the chosen idiom |
| PF-041 | **AR-2 understates its own work.** `evalConst(stmt.bound)` does run at `type-check/statement-typing.ts:798` — but the result is used for the E10064 range check and then **discarded**; nothing is stamped into the model. Probe confirms lowering re-derives the AST (`0 to 254 + 1` emits `LDA #$FE / CLC / ADC #$01` **inside the loop**, unfolded, every iteration). "Where `evalConst` already runs" reads as available. Also the cited path omits the `type-check/` segment |
| PF-042 | **AC-6 omits R4's fourth value spelling — the named constant.** R4 requires the diagnostic for "variable, expression, intrinsic result, **or constant**"; AC-6 tests only the first three. Probed: `const W: word = 300; poke($D020, W)` emits `STA $D020 / STX $D020+1`, zero diagnostics, exit 0 — and the named-const spelling slipping a literal-keyed guard is the RD's own central M-01b lesson |
| PF-043 | **"`mainlineReachable` is derivable as their difference" is false.** From `{irqReachable, irqOnly}` the only derivable set is `irqReachable ∖ irqOnly` = the **shared** set. The full mainline closure is computed at `model-adapter.ts:473-481` and discarded, along with every witness. The shared set happens to be what R7 needs, so the design survives — but AR-8's "naming a mainline reacher" does not follow from it |
| PF-044 | **Two counting slips.** RD:49 "**Six** probe-verified silent miscompiles" heads a list no counting rule reproduces as six (5 M-01 IDs / 8 with M-02..04 / 9 / 11 are all defensible); RD:53 says "**Five**". And RD:31 "across **four** axes" heads a **five**-row table |
| PF-045 | **Step spellings are unpinned where bound spellings are pinned.** R2 pins the bound trigger to const-evaluation; nothing pins the step. `constStep` folds only `NumericLitExpr` and ICEs otherwise, while `spec/05` §7.3 allows any positive constant — the same `NumericLitExpr`-only disease as M-01d, on the step axis. Loud, so outside the silent class, but R1's "every legal combination … and step" sweeps it in while no AC contains a non-literal step |
| PF-046 | **The word/sword wrap shape is named "different" (M-01e) and never resolved.** The 16-bit wrap flag is the **high** byte's carry-out, several instructions after the `CLC / ADC #step` AR-1 points at; a step-1 word bump peepholed to `INC lo / BNE / INC hi` produces no carry at all. Largely subsumed by PF-034 option (b) |
| PF-047 | **The per-iteration cost of the wrap guard is never weighed against the Prime Directive.** The hand idiom detects wrap free (`ADC / STA / BCS out`); PF-034's expressible form adds a load+compare to every guarded loop, which per PF-032 includes every runtime-bound loop — `copyBytes`-shaped hot-path code. Boundary loops hang today so any terminating cost is a win, but the scoreboard row this creates belongs in the RD, not discovered at closeout |
| PF-048 | **`until` is handed to RD-04 with no wrap-class constraint.** Once the syntax exists, `for (i: byte = 0 until 255 step 2)` is the same class — the counter wraps past an exclusive bound. RD-04 owns the syntax; nothing assigns it class membership. One line in Won't-have |
| PF-049 | **AC-13's deferral branch is tagged `[CI]` but is an attestation.** Only the golden branch is mechanical. PF-032's resolution makes this moot if adopted — slice8b becomes the pin |

---

## Verdict

❌ **BLOCKED** — 6 critical, 6 major, 10 minor (PF-028…PF-049).

**The RD's inventory, grounding and the M-02/M-03/M-04 halves are sound and materially better than
iteration 1.** Every remaining critical is downstream of one paragraph: **AR-1**. It resolves the
boundary question for unsigned/byte/ascending/extreme and is wrong, unstated, or unbuildable
everywhere else — and because the RD's requirements lean on it, four criteria are green across the
gaps and two are mutually unsatisfiable.

Iteration 3 does not need re-triage or another fan-out. It needs **one revision pass concentrated on
AR-1, R1, AC-1/AC-2/AC-4/AC-12**, plus PF-033's third M-03 population. That is a bounded edit to a
document whose facts have now been verified twice.

---

# Preflight report — RD-01 Silent miscompiles · **iteration 3**

> **Artifact**: `requirements/RD-01-silent-miscompiles.md` (revised for iteration 3, same session)
> **Iteration**: 3 · **Date**: 2026-07-22
> **Verdict**: ✅ **PASSED** — all iteration-2 findings resolved; one new major (PF-050) found and fixed
> ⚠️ **Same-session review** — iteration 3 verified a revision applied in this session. The
> mechanism claim was therefore grounded against the **actual IL**, not reasoned from the document:
> `brcmp`, `COMPARISON_OPS`, `branchOnCounter`, `incrementCounter`, `constStep`, and the full
> example-loop inventory were all re-read at HEAD before ruling.

## Scope

Iteration 3 was a bounded **verification** pass, not a re-triage or re-fan-out (the RD's facts were
verified twice in iterations 1–2). It confirmed (a) the six iteration-2 criticals are genuinely
closed in the revised document, (b) the one new artifact — AR-1's rewritten mechanism — is buildable
at the seam it names, and (c) the 21 already-fixed findings did not regress.

## What iteration 3 verified

| Check | Result |
|---|---|
| **PF-028/034/046 — AR-1 mechanism** | ✅ Grounded live. `ILTerminator` carries `brcmp` with `{op, left, right, type, trueTarget, falseTarget}`; `COMPARISON_OPS` includes `lt`/`gt`; `instruction.ts:170-174` states `type` "selects the width/signedness framing the translator emits". So `brcmp lt/gt(next, current)` is type-dispatched exactly as AR-1 claims — signed (M-01f) and word (M-01e) fall out with no per-case flag logic. `branchOnCounter` (`lower.ts:842-859`) shows the retained Pattern-A compare is *already* a type-stamped `brcmp`, so "retain the compare, add the wrap check" composes two forms the IL already has |
| **PF-029/030/031 — supplement + trigger** | ✅ R1 now carries the no-overshoot and zero-trip invariants; the trigger is reframed to "counter passes the bound by wrapping" with the interior `bound ± step` probes in the defect list and AC-1/AC-3; AC-4 states the wrap check supplements rather than replaces |
| **PF-032 — slice8b** | ✅ AR-10/AC-12 except slice8b; AC-13 discharged by its re-golden. Blast radius re-confirmed = 1 (only 3 example loops exist; see below) |
| **PF-033 — M-03 population 3** | ✅ Added as a distinct population; AR-3 states resolution needs per-declaration types while allocation stays positional; AC-9 gains the value assertion. `constStep` re-read confirms the population-3 root (one Symbol per name) is orthogonal to the step axis |
| **PF-035/036/039 — oracles** | ✅ AC-2 near-boundary count cells across axes; AC-1 oracle no longer claims a shape test observes termination; AC-12 defines clean = zero errors and enumerates the W10182 fixtures |
| **PF-037/045/048 — hand-offs** | ✅ RD-04 roadmap row now owns the handler∩handler hazard, `until`'s wrap-class, and non-literal `step` folding. `constStep` (`lower.ts`) confirms the ICE-on-non-literal-step claim exactly |
| **PF-038/041/042/043/044/047 — remainder** | ✅ AR-8 scopes the filter to the warning root set; AR-2 is honest that `evalConst`'s result is discarded; AC-6 adds the named-const spelling; M-04 corrects the derivable-set claim; counts reconciled; the per-iteration cost is an owned scoreboard row |
| **21 prior fixes — regression sweep** | ✅ No regression. The M-03 sibling/nested split (PF-002) kept "no diagnostic on sibling reuse" intact while adding population 3; the oracle edits only widen coverage; the X-08 note now reads done-state and matches the tree |

## 🟠 NEW — PF-050 (found and fixed in this iteration)

**AR-1 specified *when the guard fires*, never *when it is emitted* — and AC-12 silently depended on
the latter.** The example corpus has exactly three for-loops: `slice4a` `1 to 10` and `slice7` `0 to 4`
(both provably interior) and `slice8b` `0 to last` (the runtime bound AR-10 already excepts). A planner
reading AR-1's "the incr block terminates via `brcmp`" literally could emit the guard on *every* loop —
satisfying R1/AC-1/AC-4 — while adding a `load + brcmp` to slice4a and slice7, regenerating them, and
**failing AC-12's "byte-identical except slice8b."** AR-2 established that the provably-safe *analysis*
exists, but nothing tied the guard's *emission* to it. This is PF-032's slice8b exception generalized
to the two loops that must **not** change.

**Fixed**: AR-1 now states emission is gated — a provably-interior loop emits today's exact code, no
added guard — and AC-12 pins slice4a's and slice7's byte-identity as the positive proof that emission
is gated, not universal.

## 🔵 Observation (no action)

AR-1's rematerialisation caveat ("the pre-step value must be preserved") is **conservative**:
`incrementCounter` (`lower.ts:861-882`) already holds `current` (pre-step) and `next` as live temps in
the incr block, so a `brcmp` terminating that same block can consume both without a scratch copy or a
`next ∓ step` reconstruction. The RD being cautious here is safe — the plan will simply find the
cheaper path available. No change needed.

## Verdict

✅ **PASSED** — all iteration-2 findings (PF-028…PF-049) resolved and independently re-verified; one
new major (PF-050) found during the buildability check and fixed; one observation requiring no action.
The mechanism the whole RD leans on is now grounded against the real IL and is buildable at its named
seam. **Next: `make_plan`.**
