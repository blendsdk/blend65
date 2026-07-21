# RD-01 — Silent miscompiles

> **Feature**: blend65-conformance · **Phase**: P1 · **Status**: Authored, pre-preflight
> **Created**: 2026-07-21
> **Findings**: [`codeops/00-conformance-triage.md`](../../../00-conformance-triage.md) P0
> **Ships**: first and alone. Nothing else in the feature runs until this is green.

## Why this RD exists

Every other gap in this feature announces itself. A developer who writes `poke($0400 + i, x)`
gets an error, swears at the compiler, and works around it. These five defects announce nothing:
the program compiles, the assembler is happy, and the machine does the wrong thing. On a C64
there is no debugger to catch it, and the shapes involved are not exotic — they are the first
loop and the first hardware write anyone writes.

This is also why the RD ships alone. Byte-tuning, strength reduction and expressiveness work all
rest on the assumption that generated code means what the source says. While that is false, every
measurement downstream is being taken on an instrument that lies.

## The defects

All five are probe-verified; M-01a, M-01b and M-02 were verified twice, independently.

### M-01a — `downto` to the type minimum never exits

```blend65
for (let i: byte = 9 downto 0) { poke($D020, i); }
```
```asm
    LDA i
    CMP #$00
    BCC exit        ; carry is ALWAYS set after CMP #$00 — never taken
```

The counter runs 9…0, wraps `0 → $FF`, and loops forever. The exit test is an unsigned
`ge` compare (`branchOnCounter`, `packages/codegen/src/il/lower.ts:841-859`), which cannot
express "below the minimum" because nothing is.

`spec/05-statements-control-flow.md:236` states `9 downto 0` visits 0.

### M-01b — ascending to a named-const type maximum never exits

```blend65
const MAX: byte = 255;
for (let i: byte = 0 to MAX) { poke($D020, i); }
```
```asm
    LDA #$FF
    CMP i
    BCC exit        ; carry clears only if $FF < i — impossible for a byte
```

The guard at `lower.ts:717` inspects only `NumericLitExpr`, so the literal spelling reaches the
Pattern-B ICE and the named-const spelling sails past it into a silent hang. **The more readable
spelling is the dangerous one**, which is the wrong way round for a compiler.

### M-01c — `for (i = 0 to 255)` with a literal ICEs

Loud, so not itself a silent miscompile — but the same defect. It is in scope because M-01a/b
cannot be fixed without deciding how a full-range loop terminates, and once that machinery
exists the literal case is nearly free. Leaving it out would ship an incoherent boundary where
`0 to MAX` compiles and `0 to 255` does not.

`spec/05-statements-control-flow.md:253` explicitly promises this compiles, "uses INX/BNE-wrap
codegen".

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
`intrinsic-validation.ts:177-188` inspects only numeric literals. Any MMIO register with a live
neighbour is exposed, which on the C64 is most of them.

### M-03 — same-named locals share one frame slot

A local shadowing a parameter, or two sibling `for` loops both using `i`, compile silently and
collapse onto one name-keyed frame address (`function-collection.ts:186-194`, slots keyed by
name at `lower.ts:2782`).

### M-04 — a function on both the mainline and an interrupt path shares one frame

```blend65
function shared(v: byte): byte { let a: byte = v + 1; ... }   // frame $2001-$2004
interrupt function onRaster(): void { flag = shared(9); }
function main(): void { pokew($0314, &onRaster); while (true) { flag = shared(1); } }
```

Static frame allocation gives `shared` one frame. An interrupt arriving while the mainline is
inside it overwrites the caller's locals; on return the mainline continues with corrupted state.
**Zero diagnostics.** Verified with a real, non-zero frame.

`computeIrqClassification` (`packages/frontend/src/sfa/model-adapter.ts:443-481`) already
computes `irqReachable` and `mainlineReachable`. The hazard set is their intersection.

## Requirements

### Must have

| # | Requirement |
|---|-------------|
| R1 | A `downto` loop whose bound is the type minimum terminates, visiting the bound exactly once |
| R2 | An ascending loop whose bound is the type maximum terminates, visiting the bound exactly once, whether the bound is a literal or a named constant |
| R3 | The full-range ascending loop compiles rather than ICEs, in the idiom the spec names |
| R4 | A `poke`/`pokew` value operand wider than the intrinsic's declared parameter is a **diagnostic**, not a silent two-byte write |
| R5 | A local that shadows a parameter or another in-scope local is a diagnostic |
| R6 | A function reachable from both an interrupt handler and the mainline produces a diagnostic naming the hazard |
| R7 | No existing example's source requires editing to satisfy R4–R6 *(pre-verified: the P0-core exposure audit found no example affected)* |
| R8 | Every fix is accompanied by an expressiveness-ledger retirement where one applies (X-07, X-08) |

### Won't have

- **Block-scoped frame allocation.** R5 is discharged by *diagnostics*, not by scope-qualified
  slots — see AR-3, which is load-bearing.
- Signed loop counters, `until`, and the remaining loop surface — those are RD-04.
- Any change to `spec/`. D3 holds.

## Ambiguity register

| # | Question | Options | Resolution |
|---|----------|---------|------------|
| **AR-1** | How does a boundary loop terminate? | (a) widen the counter compare; (b) post-body wrap test; (c) the spec's `INX`/`BNE`-wrap form | **(c)** — `spec/05:253` names it, it is what a hand-coder writes, and Prime Directive clause 1 makes the named idiom the target. The exit becomes "did the counter wrap", not "is it past the bound" |
| **AR-2** | Which code for R4? | (a) new code; (b) reuse `E10154 WidthNarrowingNoCast` | **(b)** — registered, matches `spec/14-diagnostics.md:92`, and this *is* an implicit narrowing. Note the spec assigns `E10154` twice (errata **E-07**); the Ch 14 meaning is the one in use |
| **AR-3** | R5 — diagnostics, or real block scope? | (a) diagnostics per VAR-7/VAR-8; (b) scope-qualified frame slots | **(a), and this is a trap worth naming in bold.** `spec/03-variables.md:131-153` makes shadowing and duplication *errors*; the spec does not ask for scoped allocation. Implementing (b) would touch the positional slot counter that issue #73 documents as fragile — "retiring it on one side alone would shift every later slot index and silently mis-home an unrelated value" — i.e. it risks manufacturing the very defect class this RD exists to kill |
| **AR-4** | R5 needs `E10062` (for-counter reuse); it is **not registered** | register it / fold into `E10101` | **Register `E10062`.** `spec/05:270` assigns it distinctly. Registering it also exercises the RD-08 registry-agreement instrument before that RD exists |
| **AR-5** | R6 — error or warning? | (a) error; (b) warning | **(b) warning, new `W101xx`.** A shared helper is legal and sometimes deliberate (the developer may guarantee no reentrancy by construction). An error would break working programs; a warning names a hazard the developer cannot otherwise see. Revisit if the false-positive rate proves low |
| **AR-6** | Does R6 warn per function, or per call site? | — | **Per shared function, once**, naming both an interrupt entry point and a mainline reacher. A per-call-site warning would spam a loop |
| **AR-7** | Do the goldens move? | — | **Expected byte-identical**, and that is an *acceptance criterion to prove, not an assumption*: no example uses `downto`, no golden can contain a runtime or word-valued poke, and the exposure audit is clean. Two committed unit pins **do** change (`control-flow-lowering.impl.test.ts:62-70` gains the `downto 0` case; `:72-75` flips from ICE-expected) |

## Acceptance criteria

| # | Criterion | Oracle |
|---|-----------|--------|
| AC-1 | `9 downto 0` terminates after 10 iterations | Spec test on emitted asm + a VICE run asserting the visited count |
| AC-2 | `0 to 255` and `0 to MAX` both terminate after 256 iterations, literal and named-const alike | Spec tests, both spellings |
| AC-3 | The full-range loop emits the wrap idiom, not a compare against an unreachable bound | Emitted-asm assertion naming the instruction shape |
| AC-4 | `poke($D020, <word>)` reports `E10154` and emits nothing | Spec test: diagnostic present, no `STX` to the neighbour |
| AC-5 | A shadowing local reports `E10101`; a duplicate reports `E10003`; a reused for-counter reports `E10062` | Three spec tests |
| AC-6 | A function reachable from both paths warns once, naming both reachers | Spec test on the probe from P0-core |
| AC-7 | All 14 corpus goldens byte-identical; scoreboard unmoved | Existing golden suite |
| AC-8 | Ledger entries X-07 and X-08 are retired in the same change that fixes them | The ledger gate goes red until they are |
| AC-9 | Every new assertion is perturbed once and watched to fail before being trusted | Recorded in the closeout |
| AC-10 | The deferral-expiry gate is answered at closeout — slice-4a AR-6 is discharged here | Closeout document |

## Notes for the plan

- **Sequence the loop work first.** M-01a/b/c are one mechanism; M-02, M-03, M-04 are three
  independent surfaces and can follow in any order.
- **M-04's analysis already exists** — this is a consumer of `computeIrqClassification`, plus one
  diagnostic. It is the cheapest of the five, and was deferred for years as FUT-004 on the stated
  grounds that the call graph did not exist. It does.
- **AC-9 is not boilerplate here.** Several of these assertions are green before the fix for the
  wrong reason — a loop that terminates because the test harness bounds it, a golden that is
  byte-identical because it never exercised the shape. Perturb each one.
