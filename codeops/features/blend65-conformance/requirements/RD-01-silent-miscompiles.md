# RD-01 — Silent miscompiles

> **Feature**: blend65-conformance · **Phase**: P1 · **Status**: Revised after preflight iteration 1
> **Created**: 2026-07-21 · **Revised**: 2026-07-22
> **Findings**: [`codeops/00-conformance-triage.md`](../../../00-conformance-triage.md) P0
> **Preflight**: [`00-preflight-report-rd-01.md`](00-preflight-report-rd-01.md) — iteration 1
> **BLOCKED**, 2 critical + 10 major, all addressed below
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
check never fires and the loop runs forever. It occurs across four axes, which multiply:

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

Six probe-verified silent miscompiles, plus one loud rider (M-01d) included because it is the
same mechanism.

### M-01 — wrap defeats the exit test

Five confirmed instances of the one class. All compile clean with **zero diagnostics** except
M-01d.

| Id | Program | Emitted exit | Outcome |
|----|---------|--------------|---------|
| M-01a | `for (i: byte = 9 downto 0)` | `CMP #$00 / BCC` | carry always set — never taken. Wraps `0 → $FF`, forever |
| M-01b | `const MAX: byte = 255; for (i: byte = 0 to MAX)` | `LDA #$FF / CMP i / BCC` | carry clears only if `$FF < i` — impossible. Forever |
| M-01c | `for (i: byte = 9 downto 1 step 2)` | `CMP #$01 / BCC` | exit needs `i == 0`; counter is 9,7,5,3,1,`$FF`,`$FD`… never 0 |
| M-01d | `for (i: byte = 0 to 255)` — literal | — | **ICE (loud).** Included: same mechanism, and the guard at `lower.ts:717-726` inspects only `NumericLitExpr`, which is exactly why M-01b slips past it |
| M-01e | `for (i: word = 500 downto 0)`; `const M: word = $FFFF; for (i: word = 0 to M)` | word-width compare | same defect at 16 bits; the wrap shape differs |
| M-01f | `for (i: sbyte = 5 downto -128)` | `SBC #$80 / BVC / EOR #$80 / BMI` | nothing is below the type minimum. Forever |

Two further instances have no static trigger and are handled by requirement, not by guard:

- **Const-expression bound**: `for (i: byte = 0 to 254 + 1)` — evaluates to 255, hangs. A
  spelling-keyed fix leaves this broken one notch beyond the spelling it fixes.
- **Runtime bound**: `let limit: byte = 255; for (i: byte = 0 to limit)` — hangs whenever the
  value is the type maximum. No static check can see it; only the emitted idiom can survive it.

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

Two distinct populations here, and conflating them was the first draft's critical error:

1. **Nested reuse and shadowing** — a local shadowing a parameter, a local shadowing a
   module-level variable, a duplicate in one scope, a nested loop reusing its enclosing counter.
   These are **spec violations** and are cured by diagnostics.
2. **Sibling reuse** — two disjoint scopes declaring the same name. This is **spec-legal**
   (`spec/05:270` restricts E10062 to *nested* reuse; VAR-7 is nested-scope; VAR-8 is same-scope),
   and sharing one slot is the byte-frugal layout a hand-coder wants. **No diagnostic may fire on
   it.** The miscompile is not the sharing — it is that the shared slot is sized to the *last*
   declaration rather than the *widest*, so a wider store overruns into the next variable.

Population 2 is cured by slot sizing, never by a diagnostic. A fix that mints a diagnostic here
would reject universal idiomatic code — itself a Prime Directive clause-4 defect.

### M-04 — a function on both the mainline and an interrupt path shares one frame

`shared()` gets one static frame at `$2001–$2004` while called from both `main`'s loop and a
raster handler. An interrupt arriving mid-call overwrites the caller's locals; on return the
mainline continues with corrupted state. **Zero diagnostics.** Verified with a real, non-zero
frame.

`computeIrqClassification` (`packages/frontend/src/sfa/model-adapter.ts:443-488`) already
computes `irqReachable` and `irqOnly`; `mainlineReachable` is derivable as their difference.

## Requirements

### Must have

| # | Requirement |
|---|-------------|
| **R1** | A loop terminates for **every** legal combination of direction, counter width (`byte`/`word`), signedness, and step — including when the bound is the counter type's extreme. The bound is visited exactly once **when the step lands on it** |
| **R2** | R1 holds for every **bound spelling**: literal, named constant, constant expression, and a **runtime value that happens to equal the type extreme**. The trigger is *the evaluated bound*, never the syntactic node kind |
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
- `until`, signed `/` and `%`, `arr[i] += 1`, `hi()` of a computed word — RD-04.
- **A handler∩handler hazard** (a helper shared by an NMI and an IRQ handler, never reached from
  the mainline). Real on hardware — NMI preempts IRQ — but the classification models one
  preemption domain. Named here so it is owned, not silently absent; filed for RD-04.
- Any change to `spec/`. D3 holds.

## Ambiguity register

| # | Question | Resolution |
|---|----------|------------|
| **AR-1** | How does a loop terminate at a boundary? | **A wrap-detecting exit on the memory-resident counter.** The counter is SFA frame-homed (`lower.ts:700-706`); no register-resident counters exist and codegen clobbers X freely, so the spec's literal `INX`/`BNE` phrasing describes the *wrap-exit family*, not an X-register mandate — recorded as errata **E-08**. The deliverable shape is `INC`/`DEC` on the slot plus a branch on wrap, and for step > 1 a **carry-based** exit: the increment already emits `CLC / ADC #step`, so `BCS` is free and correct for **any** step, where a Z-flag test is not (with step 3 the counter goes 252 → 255 → 2, never zero) |
| **AR-2** | R2's trigger? | **The const-evaluated bound**, decided in the frontend where `evalConst` already runs on every bound (`statement-typing.ts:798`) and stamped into the model for lowering to consume. A syntactic trigger is what let M-01b past the M-01d guard; repeating it would leave `0 to MAX - 0` hanging |
| **AR-3** | R5 — diagnostics, or real block scope? | **Diagnostics, and this is a trap worth naming in bold.** `spec/03-variables.md:131-153` makes shadowing and duplication *errors*; the spec does not ask for scoped allocation. Implementing scope-qualified slots would touch the positional slot counter issue #73 documents as fragile — "retiring it on one side alone would shift every later slot index and silently mis-home an unrelated value" — i.e. it risks manufacturing the very defect class this RD exists to kill. **R6's slot sizing is a width rule, not a scoping rule**, and must not be implemented as one |
| **AR-4** | Which code for R4? | **`E10154 WidthNarrowingNoCast`** — registered, matches `spec/14-diagnostics.md:92`. Note the spec assigns `E10154` twice (errata **E-07**); the Ch 14 meaning is the one in use |
| **AR-5** | R4's **accepted** set? | Accept `byte`, `sbyte` (same-width reinterpret, matching the deliberate `lo`/`hi` precedent at `expression-typing.ts:1543-1546`), an **enum** (byte backing — `poke($D020, Color.White)` is *the* idiomatic MMIO write and compiles correctly today), and in-range literals. Reject `word`/`sword` with `E10154`. Reject `boolean`. **Do not reuse `checkAssignable` unmodified** — it rejects same-width `sbyte` (E10153) and would turn a fixed miscompile into a broken build |
| **AR-6** | R5 needs `E10062`; it is **not registered** | **Register it.** `spec/05:270` assigns it distinctly, scoped to *nested* reuse only |
| **AR-7** | R7 — error or warning, and which code? | **Warning `W10182`** — verified free in both the registry and `spec/`; the W10180 band is the call-graph/frame family. Recorded in the errata log as a compiler-minted code. A warning because a shared helper can be deliberate and the developer may guarantee non-reentrancy by construction; an error would break working programs |
| **AR-8** | R7's false-positive filter? | Root the interrupt BFS at **address-taken** handlers only — a handler whose address is never taken can never fire (`model-adapter.ts:450-457` establishes handlers are installed only via `&`) — and exclude functions with **no frame state at all**, where "frame state" counts locals, params, spill slots and shared runtime scratch (`__rt_*` staging, formation scratch). Warn **once per shared function**, naming an interrupt entry point and a mainline reacher |
| **AR-9** | R5's module-shadowing half breaks currently-correct programs | Accepted, and stated plainly: a local shadowing a module variable compiles today with *distinct, correct* storage. That half of R5 is **conformance**, not miscompile-prevention, and the severity story says so rather than implying every R5 case is a live bug |
| **AR-10** | Do the goldens move? | **Expected byte-identical, as a criterion to prove.** No example uses `downto`, `step`, a word or signed counter at a boundary, or a word-valued poke (C-01 audit). Two committed unit pins **do** change: `control-flow-lowering.impl.test.ts:62-70` gains a boundary case; `:72-78` flips from ICE-expected (the flipping assertions are at `:76-77`) |

## Acceptance criteria

Every criterion names its tier: `[CI]` runs everywhere; `[local]` is the VICE tier, which CI
skips (AR-27).

| # | Criterion | Oracle |
|---|-----------|--------|
| AC-1 | Termination across the class: for **each** of {`to`,`downto`} × {`byte`,`word`} × {unsigned,signed} × {step 1, a step that does not divide the range}, a boundary loop terminates having visited the bound exactly once when the step lands on it | `[CI]` spec tests on emitted asm · `[local]` VICE runs for a representative subset |
| AC-2 | Iteration counts are exact — 256 for `0 to 255`, 10 for `9 downto 0` | `[local]` VICE, counter held in a **word** so 256 is distinguishable from 0 (a byte counter is 256 ≡ 0 and would pass on 0, 256 or 512 visits alike) |
| AC-3 | All four bound spellings terminate: literal, named const, const expression (`254 + 1`), and a runtime value equal to the type maximum | `[CI]` spec tests, one per spelling |
| AC-4 | The emitted exit is a wrap test, not a compare against an unreachable bound | `[CI]` IL-level assertion **plus** one end-to-end asm case with a small body. Not a bare asm-shape pin: branch inversion and relaxation are always-on, so a pinned shape can be wrong on a correct compiler |
| AC-5 | The wrap exit is a normal conditional terminator — a body >127 bytes relaxes it rather than emitting an out-of-range branch | `[CI]` spec test with an oversized body |
| AC-6 | `poke($D020, x)` reports `E10154` and emits no second store, for `x` a `word` variable, a word-valued expression, and a `peekw` result | `[CI]` diagnostic assertion in the frontend tier **plus** an `emitAsm` assertion in the test-harness tier — R15 forbids the frontend seeing emitted asm |
| AC-7 | `poke($D020, x)` still compiles for `x` a `byte`, an `sbyte`, an enum member, and an in-range literal | `[CI]` one spec test per accepted type — the negative control for AR-5 |
| AC-8 | Shadowing a module variable, a parameter, or an in-scope local reports `E10101`; a same-scope duplicate reports `E10003`; a **nested** counter reuse reports `E10062` | `[CI]` five spec tests |
| AC-9 | **Sibling** same-name declarations compile with **no diagnostic**, and their shared slot is sized to the widest declaration — the word/byte probe writes no byte outside its own slot | `[CI]` spec test asserting no diagnostic, plus a resolved-address assertion that the neighbouring variable is untouched |
| AC-10 | A function reachable from both paths warns once with `W10182`, naming both reachers | `[CI]` spec test on the P0-core probe |
| AC-11 | The warning does **not** fire on a never-address-taken handler's callees, nor on a shared function with no frame state | `[CI]` two negative spec tests |
| AC-12 | All 14 corpus goldens byte-identical; scoreboard unmoved; **all 18 examples compile clean** under the new diagnostics; the committed test fixtures likewise | `[CI]` golden suite + full example build |
| AC-13 | The new wrap idiom is pinned by a committed artifact, not only by unit assertions | `[CI]` a boundary-loop example with a golden — or an explicit assignment of that pin to a named later RD, recorded in the closeout |
| AC-14 | Ledger X-07 and X-08 retired in the same change that fixes them | The ledger gate goes red until they are |
| AC-15 | The plan enumerates every new assertion up front; the closeout records, **per assertion**, the mutation applied and the failure text observed | Closeout document — omission becomes visible rather than invisible |
| AC-16 | The deferral-expiry gate is answered at closeout. This RD discharges **slice-4a AR-6**, **FUT-004**, and the `function-collection.ts:192` code-comment deferral | Closeout document |

## Notes for the plan

- **Sequence the loop work first.** M-01's instances are one mechanism. M-02, M-03 and M-04 are
  three independent surfaces and can follow in any order.
- **X-08's ledger signature must be tightened before the fix lands.** It is currently the bare
  substring `"BCC"`, and a carry-based wrap exit legitimately emits `BCC` — so the entry would
  stay green after the fix and AC-14's forcing function would be silently void.
- **M-04's analysis exists, but its witnesses do not.** `computeIrqClassification` returns
  membership sets only; the BFS discards which handler and which mainline root reach a shared
  function, and the adapter seam takes no `DiagnosticBag`. AR-8's naming requires provenance
  threading plus an emission seam. Still the cheapest of the four surfaces — but not "one
  diagnostic".
- **AC-15 is not boilerplate.** Several assertions here are green before the fix for the wrong
  reason — a loop that terminates only because the harness bounds it, a golden byte-identical
  because it never exercised the shape. Perturb each one.
