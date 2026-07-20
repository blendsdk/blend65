# Testing Strategy — Placement (RD-03)

Every expectation below is derived from the RD's acceptance criteria or from a measurement taken at
planning time — never from imagined implementation behaviour.

## Tiers

| Tier | Runs | Gate |
|---|---|---|
| **Unit** (`@blend65/core`, `@blend65/codegen`) | CI | vitest |
| **Golden corpus** (`@blend65/test-harness`) | CI | byte-exact vs 14 committed goldens |
| **ACME/build** (`buildBalloon`-pattern, real assembler) | CI | ACME is installed in CI |
| **Emulator** | **local only** — `skipIf(!hasVice()\|\|!hasAcme())` (AR-27) | VICE 3.10 |

## The `Kind` column

A **committed test** is mechanized and fails on regression. A **hand-reviewed artifact** is a human
reading a diff at closeout. The two are never conflated — a closeout may not cite a review as if it
were a test.

---

## Specification test cases

### Directive and model — unit tier

| ST | Given | Expect | Kind |
|---|---|---|---|
| **ST-C1** | `directiveText({kind:"align", boundary:256, fill:0})` | `!align 255, 0, 0` — the mask is `boundary - 1` | committed |
| **ST-C2** | `directiveByteSize` on the align directive | `0` — the size is address-dependent and unknowable pre-assembly | committed |
| **ST-C3** | `isColumnZeroDirective` on the align directive | `true` — renders at column 0 like `* =` | committed |
| **ST-C4** | A stream containing an align directive rendered by `printInstr` | the directive appears at column 0, ahead of the label, on its own line | committed |

> **ST-C1 is not sufficient on its own and must not be treated as if it were.** `!align 256, 0`
> also assembles. Every alignment claim in ST-C11–ST-C13 goes through a **resolved address**.

### The marking rule — unit tier (codegen)

| ST | Given | Expect | Kind |
|---|---|---|---|
| **ST-C5** | A module with `const T: byte[] = [1,2,3]` and a source-level `&T` | the entry for `__data_<M>_T` has `aligned === true` | committed |
| **ST-C6** | The same module where `T` is only passed by reference — `sum(T, 3)` — with **no** `&` | `aligned === false`. *This is the by-ref case that emits the identical IL operand* | committed |
| **ST-C7** | A module with `&onIRQ` (a function) and no const address-of | **no** const-data entry is marked; lowering does not throw | committed |
| **ST-C8** | A module taking `&` of a **mutable** module array | no const-data entry marked (it owns no image) | committed |
| **ST-C9** | A const **struct** whose address is taken | `aligned === true` — the rule is `sym.kind === "constant"`, which admits any const aggregate | committed |
| **ST-C10** | Two const arrays, one `&`-taken and one not | exactly the `&`-taken entry is marked | committed |

### End-to-end alignment — ACME/build tier (CI)

The mixed-alignment fixture: two const arrays in one program, one address-taken, one not; built
through the real `build()` facade and real ACME, committing no generated output.

| ST | Given | Expect | Kind |
|---|---|---|---|
| **ST-C11** | the built program's emitted asm | exactly one alignment directive, immediately preceding the **address-taken** array's label and no other | committed |
| **ST-C12** | the ACME symbol map | the address-taken array's address `% 256 === 0`; the **unaligned** array's address is **not** forced to a boundary and pays no padding relative to the stream before it | committed |
| **ST-C13** | the same symbol map | `hi(addr) * 4 === addr / 64` for the aligned array — the arithmetic identity M2 rests on, asserted on a real resolved address | committed |

> **ST-C12 is the operand-trap oracle.** With `!align 256, 0` the build still succeeds and the
> directive is present, so ST-C11 passes — and ST-C12 fails, because nothing moved to a boundary.

### Balloon — build tier (CI) + emulator tier (local)

| ST | Given | Expect | Kind |
|---|---|---|---|
| **ST-C14** | balloon's emitted asm and binary | no store to `$0340–$037E` anywhere; the 63-byte sprite sequence appears in the binary **exactly once** | committed (CI) |
| **ST-C15** | balloon's symbol map | `__data_Main_BALLOON % 256 === 0` **and** `< $1000` — clear of the VIC char-ROM shadow (AC-1) | committed (CI) |
| **ST-C16** | the 14 committed goldens after the whole change | **byte-identical** to their pre-RD-03 state — `slice7`, `slice7b`, `slice8b` (by-ref const data) and `slice8` (`&onIRQ`) are the named negative controls | committed (CI) |
| **ST-C17** | balloon on VICE, at the 2nd frame-loop-head arrival | the **eight** source-mandated observables pass unchanged: position 174/141, x-MSB 0, enable, colour, y-expand, multicolour, x-expand | committed (local) |
| **ST-C18** | balloon on VICE, same stop point | `peek($07F8) === addr / 64` and the 63 bytes at `addr` equal the committed asset, where `addr` is resolved from the symbol map | committed (local) |

**ST-C18 is the behavioural proof of the whole RD** — it is what demonstrates the VIC is reading
real sprite data at the new address. It runs **only locally**. CI's strongest statement about
balloon is ST-C14 + ST-C15: the copy is gone and the data is aligned and in-bank.

### Unchanged gates that must stay green

| Existing | Why it matters here |
|---|---|
| ST-B39/B40/B43/B44 (`golden-layout.spec.test.ts`) | RD-05's invariants over the 14 goldens. *They cannot observe alignment* (AR #70) — they are a no-regression gate, not evidence for this RD |
| The twin tier (`twins.spec.test.ts`) | Must pass against the **unmodified** twin with the shrunk shared table |
| `test/boundary.spec.test.ts` | R15 / AC-10 |
| `git status --porcelain spec/` | D3 / AC-9 |
| Scoreboard freshness | AC-6 — green, but blind to false prose, which is why AC-8 exists |

## Red-phase expectations

Phase 2's spec tests (ST-C5–ST-C10) must fail before the marking exists, and must fail **for the
right reason** — `aligned` being absent, not a lowering crash. ST-C16 is the inverse: it must be
**green from the first commit of Phase 2 onward** and stay green. A red ST-C16 in Phase 2 means the
marking rule is wrong, and it is the cheapest possible place to learn that.

## What is deliberately not tested

- **Padding visibility** — [#67](https://github.com/blendsdk/blend65/issues/67).
- **Residency beyond balloon** — no test asserts that an arbitrary program's aligned array stays
  below `$1000` or inside the bank; [#68](https://github.com/blendsdk/blend65/issues/68).
- **Cumulative padding across many aligned arrays** — the behaviour is specified in
  [03-01](03-01-directive-and-marking.md) §4 but no fixture exercises it; the corpus has no
  such program and inventing one would test the assembler, not the compiler.
