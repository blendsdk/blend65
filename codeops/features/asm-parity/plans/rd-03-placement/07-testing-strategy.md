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

> **A CI-tier test must not be written inside a VICE guard.** `balloon.spec.test.ts:29` wraps its
> entire file in `describe.skipIf(!(hasVice("c64") && hasAcme()))`; a test placed there **skips**
> in CI rather than fails, and a skip raises no alarm. Every `[CI]` claim in this plan therefore
> names its `describe.skipIf(!hasAcme())` home explicitly — the dual-block shape four sibling
> suites already use (`slice3a`, `slice3b`, `slice7b`, `slice8b`).

## The `Kind` column

A **committed test** is mechanized and fails on regression. A **hand-reviewed artifact** is a human
reading a diff at closeout. The two are never conflated — a closeout may not cite a review as if it
were a test.

---

## Specification test cases

### Directive and model — unit tier

Asserted through the module's **public** surface. `print-instr.ts` exports only `hex16` (`:46`),
`printInstr` (`:222`) and `instrByteSize` (`:239`); `directiveText` (`:148`),
`isColumnZeroDirective` (`:178`) and `directiveByteSize` (`:295`) are module-private and stay that
way — exporting internals to make a test writable is an unsanctioned api-surface change. The
existing spec file already carries the right idiom: `textOf(directive({…}))` through `printInstr`
(`print-instr.spec.test.ts:110-131`).

| ST | Given | Expect | Kind |
|---|---|---|---|
| **ST-C1** | an align directive rendered through `printInstr` | the line reads `!align 255, 0, 0` — the mask is `boundary - 1` | committed |
| **ST-C2** | `instrByteSize` on the align directive | `0` — the size is address-dependent and unknowable pre-assembly | committed |
| **ST-C3** | the rendered align line's indentation | column 0, like `* =` — **not** instruction indent. `isColumnZeroDirective` carries no `_exhaustive: never` arm and returns `false` for an unhandled variant, so this is the only thing that catches the omission | committed |
| **ST-C4** | a stream containing an align directive rendered by `printInstr` | the directive occupies its own line at column 0 | committed |

> **ST-C4 covers only what the renderer owns.** An earlier form also asserted the directive appears
> "ahead of the label" — at unit tier that is self-fulfilling: the test constructs the stream
> `[align, label]` and rendering preserves entry order, so it asserts its own input. Ordering is
> established by `constDataStream` in Phase 3 and proven discriminatingly by ST-C11.

> **ST-C1 is not sufficient on its own and must not be treated as if it were.** `!align 256, 0`
> also assembles. Every alignment claim in ST-C11–ST-C13 goes through a **resolved address**.

### The marking rule — unit tier (codegen)

Home: `packages/codegen/src/il/lower-address-of.spec.test.ts`.

| ST | Given | Expect | Kind |
|---|---|---|---|
| **ST-C5** | A module with `const T: byte[] = [1,2,3]` and a source-level `&T` | the entry for `__data_<M>_T` has `aligned === true` | committed |
| **ST-C6** | The same module where `T` is only passed by reference — `sum(T, 3)` — with **no** `&` | `aligned === false`. *This is the by-ref case that emits the identical IL operand* | committed |
| **ST-C7** | A module with `&onIRQ` (a function) and no const address-of | **no** const-data entry is marked; lowering does not throw | committed |
| **ST-C8** | A module taking `&` of a **mutable** module array | no const-data entry marked (it owns no image) | committed |
| **ST-C9** | A const **struct** whose address is taken | `aligned === true` — the rule is `sym.kind === "constant"`, which admits any const aggregate | committed |
| **ST-C10** | Two const arrays, one `&`-taken and one not | exactly the `&`-taken entry is marked | committed |
| **ST-C19** | Two const arrays, **both** `&`-taken | **both** entries are marked. ST-C10 is satisfied by an implementation that stores a single symbol slot instead of a set; a two-sprite program — the canonical C64 game shape this feature exists for — would then emit one directive. This is a marking-unit case and needs no assembler | committed |
| **ST-C19b** | A const array whose address is taken **only at module scope** — `let ptr: word = &T;` outside any function | `aligned === true`. Module initializers lower through a **second** `LowerCtx` (`lower.ts:294`, `fqName: "__init"`), reaching `lowerAddressOf` at `:336`. Every other row above puts `&` inside a function body, so without this one an implementation that gives the init context its own set passes the entire suite | committed |

### End-to-end alignment — ACME/build tier (CI)

The mixed-alignment fixture: `examples/align-mixed/main.blend`, two const arrays in one program,
the **address-taken one declared first**, built through the real `build()` facade and real ACME by
`packages/test-harness/src/align-mixed.spec.test.ts` under `describe.skipIf(!hasAcme())`,
committing no generated output.

| ST | Given | Expect | Kind |
|---|---|---|---|
| **ST-C11** | the built program's emitted asm | exactly one alignment directive, immediately preceding the **address-taken** array's label and no other — **and** its rendered text is `!align 255, 0, 0`. The text clause is what discriminates page from block: at balloon the next 64-byte and next 256-byte boundaries above `$08FA` are **both `$0900`**, so no address assertion there can tell them apart | committed |
| **ST-C12** | the ACME symbol map | the address-taken array's address `% 256 === 0`; the **unaligned** array pays no padding — asserted as `unaligned.addr === aligned.addr + aligned.data.length`, which is why the fixture declares the aligned array first. Do **not** fall back to `unaligned.addr % 256 !== 0`: that flakes whenever the second array lands on a boundary by accident after an unrelated codegen size change | committed |
| **ST-C13** | the same symbol map | `hi(addr) * 4 === addr / 64` for the aligned array — the arithmetic identity M2 rests on, asserted on a real resolved address | committed |

> **ST-C12 is the operand-trap oracle.** With `!align 256, 0` the build still succeeds and the
> directive is present, so ST-C11's placement clause passes — and ST-C12 fails, because nothing
> moved to a boundary.

> **ST-C13 cannot fail on its own.** Both sides are computed in TypeScript from the same symbol-map
> number, and `(addr >> 8) * 4 === addr >> 6` holds arithmetically whenever `addr % 256 === 0` —
> i.e. whenever ST-C12 already passed. It is a documented restatement of M2's identity, not an
> independent oracle, and AC-3's *emitted*-pointer-store clause is discharged by ST-C14, not here.

### Balloon — build tier (CI) + emulator tier (local)

ST-C14/ST-C15 live in a second `describe.skipIf(!hasAcme())` block in `balloon.spec.test.ts`;
ST-C17/ST-C18 live in the existing VICE block.

| ST | Given | Expect | Kind |
|---|---|---|---|
| **ST-C14** | balloon's emitted asm and binary | no store to `$0340–$037E` anywhere; the 63-byte sprite sequence appears in the binary **exactly once**; and the pointer store appears as an ordered subsequence — `LDA #>__data_Main_BALLOON` … `ASL` … `ASL` … `STA $7F8` (AC-3's equivalence clause, derived from the 8-instruction sequence measured at planning time). A **subsequence, not an exact match**, commented so that #58/#60 revising the shape updates its own test | committed (CI) |
| **ST-C15** | balloon's symbol map | `__data_Main_BALLOON % 256 === 0` **and** `< $1000` — clear of the VIC char-ROM shadow (AC-1) | committed (CI) |
| **ST-C16** | the 14 committed goldens after the whole change | **byte-identical** to their pre-RD-03 state — `slice7b`, `slice8b` (by-ref const data) and `slice8` (`&onIRQ`) are the named negative controls | existing tier + closeout review |
| **ST-C20** | balloon's `twins.json` routing entries after task 4.11 | no `sourceForced` field, and no note matching `/copy\(\) language gap/` — the mechanizable half of AC-8. Verified safe: `twin-manifest.spec.test.ts:78` asserts `sourceForced` only against a synthetic staged manifest, and the loader keeps the field optional (`twin-manifest.ts:48`) | committed (CI) |
| **ST-C17** | balloon on VICE, at the 2nd frame-loop-head arrival | the **eight** source-mandated observables pass unchanged: position 174/141, x-MSB 0, enable, colour, y-expand, multicolour, x-expand | committed (local) |
| **ST-C18** | balloon on VICE, same stop point | `peek($07F8) === addr / 64` and the 63 bytes at `addr` equal the committed asset, where `addr` is resolved from the symbol map | committed (local) |

> **ST-C16 is not a test anyone writes.** It is the pre-existing golden tier, whose oracle is
> *whatever is committed* and which carries a sanctioned `UPDATE_GOLDEN` bypass
> (`golden.ts:57-63`). "Byte-identical to their pre-RD-03 state" is guarded by the tier **plus** a
> closeout `git diff` over `test/golden/*.asm.golden` across the RD's commit range (task 5.5).
> **No `UPDATE_GOLDEN` run is permitted anywhere in this RD.**
>
> `slice7` is **not** among the by-ref controls: it reads `__data_Gfx_TABLE,X` directly indexed
> (`slice7.asm.golden:138`) and materializes no address. Only `slice7b` (2 sites) and `slice8b` (4)
> contain a `LDA #</#>__data` pair — consistent with the +159/+276 = +435 figure, which carries no
> slice7 term.

**ST-C18 is the behavioural proof of the whole RD** — it is what demonstrates the VIC is reading
real sprite data at the new address. It runs **only locally**. CI's strongest statement about
balloon is ST-C14 + ST-C15: the copy is gone, the pointer store is right, and the data is aligned
and in-bank.

### Unchanged gates that must stay green

| Existing | Why it matters here |
|---|---|
| ST-B39/B40/B43/B44 (`golden-layout.spec.test.ts`) | RD-05's invariants over the 14 goldens. *They cannot observe alignment* (AR #70) — they are a no-regression gate, not evidence for this RD |
| The twin tier (`twins.spec.test.ts`) | Must pass against the **unmodified** twin with the shrunk shared table. **Local tier only** — CI never runs it, so a break here is invisible until someone runs it by hand (task 4.8) |
| `test/boundary.spec.test.ts` | R15 / AC-10 |
| `git status --porcelain spec/` | D3 / AC-9 — a **working-tree** check, not a gate. CI has no `spec/` freeze step and no test guards `spec/`, so a *committed* spec edit passes it clean; AC-9 is discharged by a closeout walk of the RD's commit range (task 5.4) |
| Scoreboard freshness | AC-6 — a **hard-fail** CI step (`ci.yml:60-61`) that rebuilds every pair from `examples/` source, and blind to false prose, which is why AC-8 and ST-C20 exist |

## Red-phase expectations

Phase 2's spec tests (ST-C5–ST-C10, ST-C19, ST-C19b) must fail before the marking exists, and must
fail **for the right reason** — `pageAligned` being absent, not a lowering crash. ST-C16 is the
inverse: it must be **green from the first commit of Phase 2 onward** and stay green. A red ST-C16
in Phase 2 means the marking rule is wrong, and it is the cheapest possible place to learn that.

## What is deliberately not tested

- **Padding visibility** — [#67](https://github.com/blendsdk/blend65/issues/67).
- **Residency beyond balloon** — no test asserts that an arbitrary program's aligned array stays
  below `$1000` or inside the bank; [#68](https://github.com/blendsdk/blend65/issues/68).
- **Cumulative padding across many aligned arrays**, end to end — the behaviour is specified in
  [03-01](03-01-directive-and-marking.md) §4 but no built fixture exercises it; the corpus has no
  such program and inventing one would test the assembler, not the compiler. This exclusion covers
  the **e2e** case only. The *marking* case — two arrays, both address-taken, both marked — needs
  no assembler and is ST-C19.
