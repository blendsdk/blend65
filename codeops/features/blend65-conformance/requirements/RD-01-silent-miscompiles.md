# RD-01 — Silent miscompiles

> **Feature**: blend65-conformance · **Phase**: P1 · **Status**: Revised after preflight iteration 2
> **Created**: 2026-07-21 · **Revised**: 2026-07-22
> **Findings**: [`codeops/00-conformance-triage.md`](../../../00-conformance-triage.md) P0
> **Preflight**: [`00-preflight-report-rd-01.md`](00-preflight-report-rd-01.md) — iteration 1
> (2 critical + 10 major) and iteration 2 (6 critical + 6 major), all addressed below
> **Ships**: first and alone. Nothing else in the feature runs until this is green.

## Why this RD exists

Every other gap in this feature announces itself. A developer who writes `poke($0400 + i, x)`
gets an error, swears at the compiler, and works around it. The defects here announce nothing:
the program compiles, the assembler is happy, and the machine does the wrong thing. On a C64
there is no debugger to catch it, and the shapes involved are not exotic — they are the first
loop and the first hardware write anyone writes.

This is also why the RD ships alone. Byte-tuning, strength reduction and expressiveness work all
rest on the assumption that generated code means what the source says. While that is false, every
measurement downstream is being taken on an instrument that lies.

## The defect class — read this before the defect list

The first draft of this RD listed five probed defects and wrote requirements around them.
Preflight found that **the class is wider than the probes on four independent axes**, and that
requirements shaped to the probes would leave live silent hangs while every acceptance criterion
stayed green. One recommended fix would have *created* a new one.

The class is: **an exit test that wraparound defeats.** A loop's termination check compares the
counter against a bound; when the counter can wrap past the bound instead of reaching it, the
check never fires and the loop runs forever. It occurs across five axes, which multiply:

| Axis | Values | Probed hangs |
|------|--------|--------------|
| Direction | `to`, `downto` | both |
| Width | `byte`, `word` | both |
| Sign | unsigned, signed | both |
| Bound spelling | literal, named const, const expression, runtime value | all four |
| Step | 1, >1 | both |

**Every requirement below is written against the class, not against a probe.** A fix that
handles `byte`/unsigned/step-1/literal and nothing else satisfies no requirement here.

The second lesson was narrower but sharper: a defect can be named correctly and cured by a
mechanism that cannot legally touch it — see M-03.

## The defects

The defects below span four surfaces — one loop-exit class (M-01) and three independent codegen
surfaces (M-02, M-03, M-04) — all probe-verified silent miscompiles except the loud rider M-01d,
included because it is the same mechanism as M-01b.

### M-01 — wrap defeats the exit test

Six confirmed instances of the one class (M-01a–M-01f). All compile clean with **zero
diagnostics** except M-01d, which ICEs.

| Id | Program | Emitted exit | Outcome |
|----|---------|--------------|---------|
| M-01a | `for (i: byte = 9 downto 0)` | `CMP #$00 / BCC` | carry always set — never taken. Wraps `0 → $FF`, forever |
| M-01b | `const MAX: byte = 255; for (i: byte = 0 to MAX)` | `LDA #$FF / CMP i / BCC` | carry clears only if `$FF < i` — impossible. Forever |
| M-01c | `for (i: byte = 9 downto 1 step 2)` | `CMP #$01 / BCC` | exit needs `i == 0`; counter is 9,7,5,3,1,`$FF`,`$FD`… never 0 |
| M-01d | `for (i: byte = 0 to 255)` — literal | — | **ICE (loud).** Included: same mechanism, and the guard at `lower.ts:717-726` inspects only `NumericLitExpr`, which is exactly why M-01b slips past it |
| M-01e | `for (i: word = 500 downto 0)`; `const M: word = $FFFF; for (i: word = 0 to M)` | word-width compare | same defect at 16 bits; the wrap shape differs |
| M-01f | `for (i: sbyte = 5 downto -128)` | `SBC #$80 / BVC / EOR #$80 / BMI` | nothing is below the type minimum. Forever |

Three further instances have no static trigger and are handled by requirement, not by guard:

- **Const-expression bound**: `for (i: byte = 0 to 254 + 1)` — evaluates to 255, hangs. A
  spelling-keyed fix leaves this broken one notch beyond the spelling it fixes.
- **Runtime bound**: `let limit: byte = 255; for (i: byte = 0 to limit)` — hangs whenever the
  value is the type maximum. No static check can see it; only the emitted idiom can survive it.
- **Interior bound with step > 1**: `for (i: byte = 0 to 254 step 2)` and
  `for (i: sbyte = 0 to 126 step 3)` — the bound is **inside** the type range, yet the counter
  steps *past* it by wrapping (`254 + 2 = 0`) and never lands on or below it. Both compile clean
  (exit 0, zero diagnostics) and hang. This is why the trigger is **not** "bound at the type
  extreme": it is that the counter can pass the bound by wrapping rather than by reaching it —
  i.e. `bound ± step` escaping the type range, whatever the bound's value.

`spec/05-statements-control-flow.md:236` states `9 downto 0` visits 0; `:253` promises
`0 to 255` compiles; §7.3 makes `step` legal with any positive constant; §7.4 permits all four
integer types.

### M-02 — `poke(addr, <word>)` writes two bytes

```blend65
let w: word = 300;
poke($D020, w);        // spec signature is (word, byte)
```
```asm
    STA $D020
    STX $D020+1        ; ← clobbers $D021, the background colour
```

The value operand's width is never checked
(`packages/frontend/src/semantics/type-check/expression-typing.ts:1608-1620`); the range check at
`intrinsic-validation.ts:178-188` inspects only numeric literals. Also confirmed for a
word-valued **expression** (`poke($D020, w + 1)`) and a `peekw` result — so the defect is not
tied to a variable spelling. Any MMIO register with a live neighbour is exposed, which on the
C64 is most of them.

### M-03 — a name-collapsed frame slot is sized last-wins, and the wider store runs off the end

```blend65
if (…) { let t: word = 300; … } else { let t: byte = 7; … }
let after: byte = 9;
```
```asm
__frame_Main_main_t     = $2000     ; ONE byte-sized slot
__frame_Main_main_after = $2001
    STA __frame_Main_main_t
    STX __frame_Main_main_t+1       ; ← $2001 — destroys `after`
```

Three distinct populations here, and conflating the first two was the first draft's critical
error; the third was missed entirely until preflight iteration 2:

1. **Nested reuse and shadowing** — a local shadowing a parameter, a local shadowing a
   module-level variable, a duplicate in one scope, a nested loop reusing its enclosing counter.
   These are **spec violations** and are cured by diagnostics.
2. **Sibling reuse, write overrun** — two disjoint scopes declaring the same name. This is
   **spec-legal** (`spec/05:270` restricts E10062 to *nested* reuse; VAR-7 is nested-scope; VAR-8
   is same-scope), and sharing one slot is the byte-frugal layout a hand-coder wants. **No
   diagnostic may fire on it.** The miscompile is not the sharing — it is that the shared slot is
   sized to the *last* declaration rather than the *widest*, so a wider **store** overruns into
   the next variable (the assembly above).
3. **Sibling reuse, read truncation** — the same last-wins collapse means a *read* of the wider
   declaration resolves through the narrower sibling's type, so the load is emitted at the wrong
   width and the high byte silently vanishes:
   ```blend65
   if (…) { let t: word = 300; pokew($D000, t); } else { let t: byte = 7; … }
   ```
   emits `LDA t / STA $D000` — a one-byte store where distinct names emit the correct
   `LDA t / LDX t+1 / STA $D000 / STX $D000+1`. Sizing the slot to the widest declaration (R6)
   fixes population 2 but **not** this: the read still uses the narrower type. Curing it requires
   the symbol table to retain **per-declaration types** so each use lowers at its own declared
   width — `function-collection.ts:326` keeps one `Symbol` per name with no scope tree today.

Populations 2 and 3 are cured by slot **sizing** plus **per-declaration type retention**, never
by a diagnostic. A fix that mints a diagnostic here would reject universal idiomatic code — itself
a Prime Directive clause-4 defect. Allocation stays positional — see AR-3.

### M-04 — a function on both the mainline and an interrupt path shares one frame

`shared()` gets one static frame at `$2001–$2004` while called from both `main`'s loop and a
raster handler. An interrupt arriving mid-call overwrites the caller's locals; on return the
mainline continues with corrupted state. **Zero diagnostics.** Verified with a real, non-zero
frame.

`computeIrqClassification` (`packages/frontend/src/sfa/model-adapter.ts:443-488`) already
computes `irqReachable` and `irqOnly`; the **shared** set R7 needs is their difference
`irqReachable ∖ irqOnly`. The full mainline closure — and every witness of *which* mainline root
reaches a shared function — is computed at `model-adapter.ts:473-481` and then discarded, so the
diagnostic's provenance naming (AR-8) is not free from the membership sets alone.

## Requirements

### Must have

| # | Requirement |
|---|-------------|
| **R1** | A loop terminates for **every** legal combination of direction, counter width (`byte`/`word`), signedness, and step — including whenever the counter can pass the bound by **wrapping** rather than by reaching it (the bound is the type extreme, *or* `bound ± step` escapes the type range for an interior bound). The bound is visited exactly once **when the step lands on it**. Two invariants the exit must also hold: the body never executes with the counter **outside the range's visit set** (no interior overshoot), and a loop whose init is **already past its bound** executes **zero** iterations |
| **R2** | R1 holds for every **bound spelling**: literal, named constant, constant expression, and a **runtime value not provably below the wrap point**. The trigger is *the evaluated bound* — or, for a runtime bound, the **absence of a static proof that it cannot wrap** (*not provably non-extreme*, never *provably extreme*) — and never the syntactic node kind |
| **R3** | The full-range loop compiles rather than ICEs |
| **R4** | A `poke`/`pokew` value operand wider than the intrinsic's declared parameter is a **diagnostic**, for every value spelling — variable, expression, intrinsic result, or constant |
| **R5** | Every VAR-7 / VAR-8 / E10062 violation is diagnosed: a local shadowing a **module-level variable**, a **parameter**, or another **in-scope local**; a **duplicate in one scope**; a **nested** loop reusing its enclosing counter |
| **R6** | Spec-legal **sibling** reuse continues to compile with **no diagnostic**, and its shared slot is sized to the **widest** colliding declaration, each use lowered at its own declared width |
| **R7** | A function reachable from both an interrupt handler and the mainline produces a diagnostic naming the hazard, and does **not** fire on provably-safe shapes |
| **R8** | No existing example source requires editing. The committed **test fixtures** are audited for the same exposure before the diagnostics are wired |
| **R9** | Ledger entries X-07 and X-08 are retired in the change that fixes them |

### Won't have

- **Block-scoped frame allocation.** R5 is discharged by *diagnostics* and R6 by *slot sizing* —
  see AR-3, which is load-bearing.
- **Register-resident loop counters.** AR-1 targets the memory-resident wrap idiom; promoting a
  counter to X is register allocation, and belongs to the asm-parity lane.
- `until`, signed `/` and `%`, `arr[i] += 1`, `hi()` of a computed word — RD-04. **`until`
  carries a wrap-class obligation**: once the syntax exists, `for (i: byte = 0 until 255 step 2)`
  is the same class — the counter wraps past an *exclusive* bound. RD-04 owns both the syntax and
  its class membership, recorded on that roadmap row so it is not orphaned here.
- **Non-literal `step` constant folding.** `constStep` folds only `NumericLitExpr` and ICEs on a
  named-const or const-expression step, while `spec/05` §7.3 allows any positive constant — the
  same `NumericLitExpr`-only disease as M-01b/M-01d on the step axis. It is **loud** (an ICE), so
  it is outside the silent class this RD kills; owned on the conformance roadmap's RD-04 row.
- **A handler∩handler hazard** (a helper shared by an NMI and an IRQ handler, never reached from
  the mainline). Real on hardware — NMI preempts IRQ — but the classification models one
  preemption domain. Named here so it is owned, not silently absent; **owned as a scope item on
  the conformance roadmap's RD-04 row** (not merely "filed", which iteration 2 found named no
  actual owner).
- Any change to `spec/`. D3 holds.

## Ambiguity register

| # | Question | Resolution |
|---|----------|------------|
| **AR-1** | How does a loop terminate at a boundary? | **A value-level wrap check on the memory-resident counter, expressed with the existing `brcmp` terminator, *supplementing* the ordinary bound compare — never a carry/flag branch.** The counter is SFA frame-homed (`lower.ts:700-706`); no register-resident counters exist and codegen clobbers X freely, so the spec's literal `INX`/`BNE` phrasing describes the *wrap-exit family*, not an X-register mandate — recorded as errata **E-08**. **A carry-based exit was proposed and rejected at preflight iteration 2** for three independent reasons: (i) carry is the *unsigned* wrap flag — signed wrap is V and `sword` wrap is the *high* byte's carry, so `BCS` is wrong for every signed and word cell; (ii) it is **inexpressible at the named seam** — `ILTerminator` (`instruction.ts:160-185`) is `br \| brcond \| brcmp \| ret \| unreachable` with no flag branch, `translate.ts:374-380` makes "nothing carries across a basic-block boundary" a stated correctness invariant, and no `INC`/`DEC` emission site exists (`DEC` sets only N/Z regardless); (iii) a wrap-only exit **overshoots interior bounds** with step > 1 (`0 to 253 step 2` runs the body at 254) — a regression of code correct today. **Deliverable shape**: the `incr` block computes `next = current ± step`, stores it, and terminates via `brcmp` comparing the post-step counter to the pre-step counter — `lt(next, current)` ascending, `gt(next, current)` descending. Because `brcmp` is **type-dispatched on width and sign**, this one form detects wrap correctly for `byte`/`word`/`sbyte`/`sword` with no per-case flag logic — the signed dispatch (else M-01f) and the 16-bit high-byte shape (M-01e) fall out for free. The ordinary Pattern-A bound compare is **retained**; it handles interior bounds and the zero-trip case, while the wrap check catches only the extreme/escape corner where the compare alone never fires. **Emission is gated, not universal — this is load-bearing for AC-12**: the wrap guard is emitted **only** when the bound is not provably wrap-safe (AR-2's analysis). A provably-interior loop — `slice4a`'s `1 to 10`, `slice7`'s `0 to 4`, every corpus loop but `slice8b` — emits **today's exact code, no added guard**. A planner who emits the guard unconditionally would satisfy R1/AC-1/AC-4 while regenerating slice4a and slice7 and failing AC-12's byte-identical claim; that is why *only* `slice8b` (runtime bound, not provably safe) moves. **Cost**: one extra load+compare per guarded iteration (a Prime-Directive scoreboard row to own at closeout — see Notes). **Rematerialisation hazard the plan must name**: `current`'s slot is already overwritten by `next` at terminator time, so the pre-step value must be preserved (a scratch copy or a compare reconstructed from `next ∓ step`). A fused increment-and-branch-on-wrap terminator that would recover the extra load — mirroring `brcmp`'s fused design — is a **future optimization filed to the asm-parity lane**, not RD-01 |
| **AR-2** | R2's trigger? | **The const-evaluated bound** (and, for a runtime bound, *not provably below the wrap point* — never *provably extreme*), decided in the frontend and stamped into the model for lowering to consume. **Not a free reuse**: `evalConst` does run at `type-check/statement-typing.ts:798`, but only for the `E10064` range check — its result is **discarded**, nothing is stamped, and lowering re-derives the AST (probe: `0 to 254 + 1` emits `LDA #$FE / CLC / ADC #$01` *inside* the loop, unfolded, every iteration). Stamping the evaluated bound into the model is new work, not an existing hook. A syntactic trigger is what let M-01b past the M-01d guard; repeating it would leave `0 to MAX - 0` hanging |
| **AR-3** | R5 — diagnostics, or real block scope? | **Diagnostics, and this is a trap worth naming in bold.** `spec/03-variables.md:131-153` makes shadowing and duplication *errors*; the spec does not ask for scoped allocation. Implementing scope-qualified slots would touch the positional slot counter issue #73 documents as fragile — "retiring it on one side alone would shift every later slot index and silently mis-home an unrelated value" — i.e. it risks manufacturing the very defect class this RD exists to kill. **R6's slot sizing is a width rule, not a scoping rule**, and must not be implemented as one. **But allocation-stays-positional is not information-stays-absent**: population 3's read truncation and R5's nested-vs-sibling distinction both need per-declaration **types** and enough scope structure to tell disjoint siblings apart. So a scope-aware *walk* (read the right declaration's type at each use) is unavoidable even though scope-qualified *allocation* is forbidden — `function-collection.ts:326` keeps one `Symbol` per name today and must retain each declaration's type without changing where slots land |
| **AR-4** | Which code for R4? | **`E10154 WidthNarrowingNoCast`** — registered, matches `spec/14-diagnostics.md:92`. Note the spec assigns `E10154` twice (errata **E-07**); the Ch 14 meaning is the one in use |
| **AR-5** | R4's **accepted** set? | Accept `byte`, `sbyte` (same-width reinterpret, matching the deliberate `lo`/`hi` precedent at `expression-typing.ts:1543-1546`), an **enum** (byte backing — `poke($D020, Color.White)` is *the* idiomatic MMIO write and compiles correctly today), and in-range literals. Reject `word`/`sword` with `E10154`. Reject `boolean`. **Do not reuse `checkAssignable` unmodified** — it rejects same-width `sbyte` (E10153) and would turn a fixed miscompile into a broken build |
| **AR-6** | R5 needs `E10062`; it is **not registered** | **Register it.** `spec/05:270` assigns it distinctly, scoped to *nested* reuse only |
| **AR-7** | R7 — error or warning, and which code? | **Warning `W10182`** — verified free in both the registry and `spec/`; the W10180 band is the call-graph/frame family. Recorded in the errata log as a compiler-minted code. A warning because a shared helper can be deliberate and the developer may guarantee non-reentrancy by construction; an error would break working programs |
| **AR-8** | R7's false-positive filter? | Root the interrupt BFS at **address-taken** handlers only — a handler whose address is never taken can never fire (`model-adapter.ts:450-457` establishes handlers are installed only via `&`) — and exclude functions with **no frame state at all**, where "frame state" counts locals, params, spill slots and shared runtime scratch (`__rt_*` staging, formation scratch). Warn **once per shared function**, naming an interrupt entry point and a mainline reacher. **Trap worth naming in bold**: this filter applies to the **warning's** root set only — *not* to `computeIrqClassification`'s own BFS, which roots at **every** handler and drives **frame placement**. That rooting is pinned by `irq-interference.spec.test.ts:71-118` (ST-17/18/19) and `irq-classification.impl.test.ts` for never-address-taken handlers; narrowing it at the classification seam would re-home frames — the exact defect class this RD exists to kill. Add a *separate* address-taken predicate over the classification's output for the warning root set; leave the classification BFS untouched |
| **AR-9** | R5's module-shadowing half breaks currently-correct programs | Accepted, and stated plainly: a local shadowing a module variable compiles today with *distinct, correct* storage. That half of R5 is **conformance**, not miscompile-prevention, and the severity story says so rather than implying every R5 case is a live bug |
| **AR-10** | Do the goldens move? | **Byte-identical except `slice8b`, as a criterion to prove.** No example uses `downto`, `step`, a word or signed counter at a boundary, or a word-valued poke (C-01 audit) — **but the C-01 audit never asked about the runtime-bound spelling** (row 4 of the class table). `examples/slice8b/main.blend:10-11` — `let last: byte = len - 1; for (let i: byte = 0 to last)`, with `last` computed by `SEC / SBC #$01`, so `len = 0` yields `last = 255` — is a live latent instance sitting in the corpus. Its golden (`slice8b.asm.golden:79-82`) pins the compare-only exit `LDA last / CMP i / BCC exit`, exactly the shape that hangs; the compiler cannot statically prove `last ≠ 255`. So `slice8b`'s `copyBytes` exit **moves** to the wrap-safe runtime-bound idiom and is re-goldened, with the byte delta and scoreboard shift explained at closeout. **Blast radius verified = exactly one golden** (`slice8b` is the only source-level runtime-bound for-loop in `examples/`). This re-goldened exit **discharges AC-13 for free** — it becomes the committed pin of the new wrap idiom, so no new boundary example is needed. Two committed unit pins also change: `control-flow-lowering.impl.test.ts:62-70` gains a boundary case; `:72-78` flips from ICE-expected (the flipping assertions are at `:76-77`) |

## Acceptance criteria

Every criterion names its tier: `[CI]` runs everywhere; `[local]` is the VICE tier, which CI
skips (AR-27).

| # | Criterion | Oracle |
|---|-----------|--------|
| AC-1 | Termination across the class: for **each** of {`to`,`downto`} × {`byte`,`word`} × {unsigned,signed} × {step 1, a step that does not divide the range}, a boundary loop terminates having visited the bound exactly once when the step lands on it. **Plus three non-boundary cells the supplement must not regress**: an ordinary **interior** loop (`0 to 9`) runs its bodies and stops; an interior loop whose non-dividing step escapes the range (`0 to 254 step 2`, `9 downto 2 step 2`) stops without overshoot; a **zero-trip** loop whose init is already past its bound (`9 to 0` ascending) runs the body **zero** times | `[CI]` asserts the emitted exit **matches the wrap-safe idiom** — a shape check, not a termination proof (a shape test cannot observe non-termination, and is worthless if the idiom itself is wrong) · `[local]` **VICE actually observes termination and visit-count** for a subset pinned to cover every axis: at minimum one `to` and one `downto` at each of `byte`/`word`/`sbyte`/`sword`, one non-dividing step each direction, one interior and one zero-trip |
| AC-2 | Iteration counts are exact — 256 for `0 to 255`, 10 for `9 downto 0` — **and pinned across the axes near a boundary**, so a word/signed/step/interior loop that is off by one is caught (it terminates, so AC-1 stays green, and it has a wrap-shaped exit, so AC-4 stays green — only a count oracle sees it). Minimum cells, each kept small and word-representable: `$FFF0 to $FFFF` = 16, `-120 downto -128` = 9, `$FFF0 to $FFFF step 3` = 6, interior `0 to 9` = 10, zero-trip `9 to 0` = 0 | `[local]` VICE, counter held in a **word** so 256 is distinguishable from 0 (a byte counter is 256 ≡ 0 and would pass on 0, 256 or 512 visits alike; note 65536 ≡ 0 recreates the same trap one width up, so word-count cells stay near a boundary) |
| AC-3 | All four bound spellings terminate: literal, named const, const expression (`254 + 1`), and a runtime value equal to the type maximum — **plus the interior-bound-escapes-by-step case** the "bound at the extreme" framing misses: `0 to 254 step 2` and `sbyte 0 to 126 step 3`, whose bounds are inside range yet `bound + step` wraps past them (both compile clean and hang today) | `[CI]` spec tests, one per spelling and one per interior-escape probe |
| AC-4 | The emitted exit carries a **value-level wrap check** (`brcmp` of the post-step counter against the pre-step counter) **in addition to** the bound compare — not a compare alone against an unreachable bound. The wrap check is what makes the extreme/escape case terminate; the retained compare is what keeps interior and zero-trip loops correct. **The two are complementary; neither replaces the other** | `[CI]` IL-level assertion for the `brcmp` wrap form **plus** one end-to-end asm case with a small body. Not a bare asm-shape pin: branch inversion and relaxation are always-on, so a pinned shape can be wrong on a correct compiler |
| AC-5 | The wrap exit is a normal conditional terminator — a body >127 bytes relaxes it rather than emitting an out-of-range branch | `[CI]` spec test with an oversized body |
| AC-6 | `poke($D020, x)` reports `E10154` and emits no second store, for `x` a `word` variable, a word-valued expression, a `peekw` result, **and a named `word` constant** (`const W: word = 300; poke($D020, W)` — R4's fourth spelling; probed to emit `STA $D020 / STX $D020+1` with zero diagnostics today, the same named-const-slips-a-literal-guard lesson as M-01b) | `[CI]` diagnostic assertion in the frontend tier **plus** an `emitAsm` assertion in the test-harness tier — R15 forbids the frontend seeing emitted asm |
| AC-7 | `poke($D020, x)` still compiles for `x` a `byte`, an `sbyte`, an enum member, and an in-range literal | `[CI]` one spec test per accepted type — the negative control for AR-5 |
| AC-8 | Shadowing a module variable, a parameter, or an in-scope local reports `E10101`; a same-scope duplicate reports `E10003`; a **nested** counter reuse reports `E10062` | `[CI]` five spec tests |
| AC-9 | **Sibling** same-name declarations compile with **no diagnostic**, and their shared slot is sized to the widest declaration — the word/byte probe writes no byte outside its own slot (population 2), **and a read of the wider sibling emits both bytes** (population 3): `pokew($D000, t)` in the `word` arm emits `LDA t / LDX t+1 / STA $D000 / STX $D000+1`, not the truncated single-byte load | `[CI]` spec test asserting no diagnostic, plus a resolved-address assertion that the neighbouring variable is untouched **and a value assertion that the wide read lowers at full width** — an address-only oracle passes the truncation case while it is still wrong |
| AC-10 | A function reachable from both paths warns once with `W10182`, naming both reachers | `[CI]` spec test on the P0-core probe |
| AC-11 | The warning does **not** fire on a never-address-taken handler's callees, nor on a shared function with no frame state | `[CI]` two negative spec tests |
| AC-12 | All 14 corpus goldens byte-identical **except `slice8b`** (re-goldened per AR-10, with the delta and scoreboard shift explained at closeout); scoreboard moves only by that one documented delta; **all 18 examples compile clean** under the new diagnostics; the committed test fixtures likewise. The byte-identity rests on gated emission (AR-1): the two provably-interior corpus loops — `slice4a`'s `1 to 10` and `slice7`'s `0 to 4` — must emit **no added wrap guard**, and that their goldens are unchanged is the positive proof that emission is gated, not universal. **"Clean" = zero errors** — the SFA suites deliberately construct the IRQ∩mainline shape R7 warns on, so `W10182` will fire there by design; a no-*warnings* reading is unsatisfiable without gutting the fixtures whose shape is their point | `[CI]` golden suite + full example build. R8's fixture audit **enumerates the fixtures expected to fire `W10182`** and asserts that expectation in their own suites (doubling as real-world probes for AC-11), so the warning is pinned where it is intended and absent everywhere else |
| AC-13 | The new wrap idiom is pinned by a committed artifact, not only by unit assertions — **discharged by `slice8b`'s re-goldened `copyBytes` exit** (AR-10), which becomes that committed pin | `[CI]` the `slice8b` golden — fully mechanical, no attestation branch. (The earlier "assign the pin to a later RD" escape is moot: AR-10 supplies a real corpus pin in this RD) |
| AC-14 | Ledger X-07 and X-08 retired in the same change that fixes them | The ledger gate goes red until they are |
| AC-15 | The plan enumerates every new assertion up front; the closeout records, **per assertion**, the mutation applied and the failure text observed | Closeout document — omission becomes visible rather than invisible |
| AC-16 | The deferral-expiry gate is answered at closeout. This RD discharges **slice-4a AR-6**, **FUT-004**, and the `function-collection.ts:192` code-comment deferral | Closeout document |

## Notes for the plan

- **Sequence the loop work first.** M-01's instances are one mechanism. M-02, M-03 and M-04 are
  three independent surfaces and can follow in any order.
- **X-08's ledger signature is already tightened** (done in `709b9ee` to the adjacent
  `CMP #$00` + `BCC` pair — do not re-do it). The live risk is downstream: because the fix
  **retains** the bound compare (AR-1), a `downto 0` loop may *still* emit `CMP #$00` + `BCC`
  alongside the new `brcmp` wrap check — leaving X-08 green after the fix and AC-14's forcing
  function silently void again. The plan must **perturb X-08 against the chosen idiom and watch it
  actually go red**, retightening the signature to the wrap form if the compare survives.
- **Weigh the wrap guard's per-iteration cost against the Prime Directive.** The hand idiom
  detects wrap for free (`ADC / STA / BCS out`); AR-1's expressible `brcmp` form adds a
  load+compare to every guarded loop — which per AR-10 includes every runtime-bound loop, i.e.
  `copyBytes`-shaped hot paths. Boundary loops hang today, so any terminating cost is a strict
  win; but this creates a scoreboard row that belongs in the plan and the closeout, not
  discovered later. The fused increment-and-branch terminator (AR-1's filed asm-parity option)
  is where that cost is later recovered.
- **M-04's analysis exists, but its witnesses do not.** `computeIrqClassification` returns
  membership sets only; the BFS discards which handler and which mainline root reach a shared
  function, and the adapter seam takes no `DiagnosticBag`. AR-8's naming requires provenance
  threading plus an emission seam. Still the cheapest of the four surfaces — but not "one
  diagnostic".
- **AC-15 is not boilerplate.** Several assertions here are green before the fix for the wrong
  reason — a loop that terminates only because the harness bounds it, a golden byte-identical
  because it never exercised the shape. Perturb each one.
