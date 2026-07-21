# RD-15: Alignment Granularity — Align to What the Hardware Actually Reads

> **Document**: RD-15-alignment-granularity.md
> **Status**: Draft
> **Created**: 2026-07-21
> **Project**: blend65 — Asm-Parity Initiative
> **Issue**: [#69](https://github.com/blendsdk/blend65/issues/69) — in full. #69's *headline
> figures are stale* (filed pre-RD-13); this RD re-measures them and carries the corrected numbers.
> **Depends On**: RD-01 (parity instruments, ✅), RD-02 (twin corpus + scoreboard, ✅),
> RD-03 (address-taken alignment, ✅ — **this RD amends its M2**),
> RD-13 (symbolic address arithmetic, ✅ — **load-bearing**, see *Why this was blocked*)
> **Related, not owned**: [#67](https://github.com/blendsdk/blend65/issues/67) (padding invisible
> in the build report) · [#68](https://github.com/blendsdk/blend65/issues/68) (aligned data can
> land in the char-ROM shadow) — both stay filed (AR #110) ·
> [#74](https://github.com/blendsdk/blend65/issues/74) (non-const fold-shape hazard, filed at
> preflight PF-080)
> **CodeOps Skills Version**: 3.11.0

---

## Feature Overview

A `const` array whose address is taken is emitted at a **256-byte** boundary. A C64 hardware sprite
is dereferenced in **64-byte** blocks. The difference is padding — bytes that exist only so the
label lands on a rounder number than the hardware needs.

A hand-coder writing sprite data writes `!align 63, 0, 0`. They write `!align 255` for a lookup
table read with an indexed load, where a page crossing costs a cycle. They do not write `!align
255` for a sprite, because there is no cycle to save and up to 255 bytes to lose. The compiler
currently writes `!align 255` for both.

**The value of fixing this is not the bytes it recovers today — it is the bytes it stops making
unmeasurable.** Padding to 256 means the pad on any image is a uniform draw from 0–255 that
re-rolls whenever unrelated code changes size. That noise is larger than most optimizations. RD-13
removed 13 real bytes from `balloon`'s sprite-pointer sequence and the binary did not shrink by one
byte: the padding grew 6 → 19 and absorbed all of it, so RD-13's byte-level acceptance criterion is
recorded as **failed on bytes, passed on cycles**. Aligning a 64-demand image to 64 bounds its pad
below 64, which caps that noise at 63 instead of 255 — a measurement-hygiene property every later
code-size RD inherits (AR #101).

### The measurement, re-taken at HEAD

#69 reports 193 B of 584 with "1 B at 64-byte". Both numbers predate RD-13 and neither survives.
All four address-taken programs in the tree were rebuilt and their padding read from `main.report`:

| program | source form | last code byte + 1 | image @256 | pad 256 | image @64 | pad 64 | recovered |
|---|---|---|---|---|---|---|---|
| `examples/balloon` | `lo(&BALLOON / 64)` | `$08ED` | `$0900` | 19 | `$0900` | 19 | **0** |
| `examples/balloon-color` | `lo(&BALLOON / 64)` | `$0944` | `$0A00` | 188 | `$0980` | 60 | **128** |
| `examples/boing-ball` | `lo(&BALL / 64)` | `$0AFF` | `$0B00` | 1 | `$0B00` | 1 | **0** |
| `examples/align-mixed` | bare `&ALIGNED` | `$083E` | `$0900` | 194 | *(stays 256)* | 194 | **0** |

The corrected figure is **188 of 584 B (`.prg` file size; 582 B in the project's budget
convention), and 60 B at 64-byte — not 1**. The "1 B" was a lucky
landing under pre-RD-13 code sizes, which is the volatility this RD exists to bound.

Two of those zeros are also luck, in the other direction: `balloon` lands on `$0900` and
`boing-ball` on `$0B00`, both multiples of 64 *and* 256, so they pad identically either way.
**`balloon` is the only address-taken program carrying a size budget, and it recovers nothing.**
The corpus byte total does not move. This is stated here, at the top, because an acceptance
criterion phrased as "corpus bytes drop" would fail on a correct implementation (AR #108).

### Why this was blocked until now

Page alignment was not merely generous — it was **load-bearing for the only expressible idiom**.
The blessed way to name a sprite block was `hi(&X) * 4`, and the identity `hi(addr) * 4 ===
addr / 64` holds **only when `addr` is page-aligned**: at `$0940`, `hi($0940) * 4` is 36 while the
correct block is 37, and the VIC would read from the wrong place. RD-03 chose 256 for exactly this
reason (`RD-03-placement.md:129`, AR #68).

RD-13 dissolved that constraint. `lo(&X / 64)` now folds to `#<(sym / 64)` — one immediate the
assembler resolves — so a program can name its block correctly at *any* 64-byte boundary. AR #68's
premise no longer holds, which is what re-opens the decision it settled.

### What this is not

- **Not a new language feature.** No `spec/` edit, no attribute syntax, no Language Guard pass. The
  boundary is read from arithmetic the source already writes (AR #102).
- **Not a repeal of `hi(&X) * 4`.** That idiom stays legal and stays correct — see M2, and the
  correction in M5.
- **Not a byte-saving RD.** It recovers 128 B once, in a program with no budget. The deliverable is
  the bound.

---

## Functional Requirements

### Must Have

**M1 — A const image's alignment boundary is derived from how the source names its address.**
(complexity: S)

Each source-level `&X` on a `const` aggregate registers an **alignment demand** for that symbol:

| `&X` appears as | Demand | Reason |
|---|---|---|
| the left operand of the RD-13 fold shape with normalized shift **6** — `lo(&X / 64)` or `lo(&X >> 6)` | **64** | the program is stating that hardware dereferences this address in 64-byte units |
| anything else — bare `&X`, `hi(&X)`, `lo(&X)`, `hi(&X) * 4`, any other divisor or shift count | **256** | unchanged from RD-03 M1 (AR #105) |

The emitted boundary for a symbol is the **coarsest (maximum) of all its demands** (AR #103).

Alignment composes — a multiple of 256 is a multiple of 64, a fact `RD-03-placement.md:83-86`
already relies on — so a coarser boundary can only cost bytes, never change a value. Taking the
maximum is therefore always *safe*, and it is what makes M2 true by construction rather than by
convention.

RD-03's membership rule is unchanged and remains load-bearing: the demand is registered at the
**`&` site**, not over IL operands. An implicit by-reference aggregate argument (`sum(TABLE, len)`)
emits an identical `addrOf` operand and must continue to register **nothing**; scanning operands
would align `slice7b` and `slice8b` (+159 and +276 bytes) and try to align function labels in
`slice8` (`RD-03-placement.md:100-119`).

The same membership rule bounds the demand from the other side: a `&` whose operand does **not**
resolve to a const aggregate — a mutable array, a function — registers no demand regardless of
divisor. The fold's arithmetic stays correct at any address, but variable storage is placed by the
frontend's SFA planner before codegen sees any demand, so no alignment path exists there and the
new shift parameter must be inert outside the const branch (pinned by AC-15). The silent hazard
this leaves — `lo(&buf / 64)` on a RAM sprite buffer aligns nothing and the VIC reads the wrong
block, undiagnosed — is real, pre-dates this RD, and is scoped out in Won't Have, filed as
[#74](https://github.com/blendsdk/blend65/issues/74).

**M2 — `hi(&X) * 4` keeps working, and cannot be broken by this change.** (complexity: S)

`hi(&X)` lowers through a divisor-less address-of site, so it registers the 256 demand; the maximum
rule then keeps the symbol page-aligned and the identity holds. A program mixing both idioms on one
symbol gets 256 and is correct under both.

This is a **structural** guarantee, not a documented caution — the same discipline as AR #87, where
an unreachable trap was preferred to a warned-about one. Its proviso is that **every** const-`&`
lowering path outside the shift-6 fold registers 256; that is pinned jointly by AC-2, AC-4, AC-5
and AC-8, not assumed.

**M3 — The alignment mark carries a value, not a flag.** (complexity: S)

| Today | After | Site |
|---|---|---|
| `addressTakenConsts: Set<string>` | `Map<string, number>` (symbol → coarsest demand), combined with `max` on insert | `lower.ts:199, 227` |
| `pageAligned: boolean` | a boundary number on the const-data entry | `cfg.ts:119`, set at `lower.ts:282` |
| `const PAGE = 256` — the single hardcoded boundary | the entry's own boundary | `instr-program.ts:191, 201-202` |

Keeping the boolean and adding a parallel 64-demand set was rejected: it is two sources of truth for
one property, and the maximum rule has no natural home in it (AR #106).

An entry with no demand carries no boundary: the field is optional (`boundary?: number`), absent
exactly when the demand map has no entry for the symbol, and the directive is emitted iff the field
is present. That names the suppression predicate AC-7 depends on and keeps the 16 reshaped test
sites mechanical — today's `pageAligned: false` cases become absent-field cases (PF-085).

`print-instr.ts:171-179` already derives ACME's bitmask from `boundary` (`!align ${boundary - 1}, 0,
${fill}`) and is expected to need **no change** — which is also why the ACME bitmask trap RD-03
documented there stays covered.

**M4 — The six spec-tier assertions that pin page alignment are re-derived from the new boundary
rule: three change, three are confirmed unchanged as the bare-`&` control.** (complexity: S)

Three of them describe programs this RD moves, and **two of those pass by luck today**:

| Assertion | Program's `&` form | Under this RD | Action |
|---|---|---|---|
| ST-C11 `!align 255, 0, 0` (`align-mixed.spec.test.ts:85-87`) | bare | stays 256 | **keep unmodified** — becomes the pinned negative control for M1's second row |
| ST-C12 `aligned % 256 === 0`, `plain === aligned + 4` (`:99, 104`) | bare | stays 256 | keep unmodified |
| ST-C13 `(a >> 8) * 4 === a / 64` (`:115`) | bare | stays 256 | keep unmodified |
| ST-C15 `addr % 256 === 0` (`balloon.spec.test.ts:191`) | `/ 64` fold | moves to 64 | **re-derive to `% 64` + the directive-text pin.** Passes *by luck* today — `$08ED` rounds to `$0900` under both boundaries |
| ST-13f `addr % 256 === 0` (`balloon-color.spec.test.ts:51`) | `/ 64` fold | moves to 64 | **re-derive to `% 64` + the directive-text pin.** Fails deterministically at `$0980` — the change's built-in tripwire, in the forward direction |
| ST-13j `addr % 256 === 0` (`boing-ball.spec.test.ts:68`) | `/ 64` fold | moves to 64 | **re-derive to `% 64` + the directive-text pin.** Passes *by luck* today — `$0AFF` rounds to `$0B00` under both |

The two by-luck passes are the reason this is an M-level requirement rather than housekeeping. CI
would not flag either; they would sit green until an unrelated ±19-byte code change turned one red,
at which point the failure would read as a regression in whatever caused the size change. That is
the unfailable-oracle class RD-13's preflight caught as PF-054, and it is caught here by audit
because nothing else can catch it (AR #107).

The re-derived `% 64` clause alone would itself be one-directional: `% 256 === 0` implies
`% 64 === 0`, and every current image lands on a multiple of both, so a demand silently regressing
to 256 would leave all three green — the same unfailable class, reversed. Each re-derived oracle
therefore also pins the directive text, `!align 63, 0, 0` immediately preceding its image label, in
ST-C11's style: directive text is the only deterministic 64-vs-256 discriminator (AR #108), and no
golden, budget or pad bound covers these three programs otherwise (PF-081).

Each re-derivation restates the requirement the assertion is testing, in the terms this RD
establishes; none is weakened. The `< 0x1000` char-ROM clauses riding alongside them are unaffected
and stay. The 16 `pageAligned` sites — 12 assertions in `lower-address-of.spec.test.ts`, 3 in
`lower-address-of.impl.test.ts`, and the `ConstDataEntry` literal in `assemble.impl.test.ts` —
reshape mechanically with M3's field.

**M5 — RD-13's contradicted prediction about this RD is corrected.** (complexity: S)

`RD-13-symbolic-address-arithmetic.md:157-159` records, as rationale for declining a
multiply-over-address peephole, that `hi(&X) * 4` is *"an idiom that RD-15's 64-byte alignment will
make **incorrect**"*. Under M1's maximum rule that is **false** — and RD-13 already contradicts it
at `:439`: *"RD-03's page alignment remains correct and unchanged — `hi(&X) * 4` keeps working."*

Left standing, the first sentence reads as pre-authorizing uniform 64-byte alignment to a future
implementer. The correction resolves an internal inconsistency; it does not revise a decision.
RD-13's *conclusion* — no multiply-over-address peephole — is untouched, because it stands on
AR #79's semantic argument about byte-multiply wraparound, not on the prediction (AR #109).

### Should Have

- **The granularity allowlist is sourced from the platform rather than a literal in lowering.**
  Priced honestly, this is a small but cross-package change, not a free one: the demand is decided
  in lowering, and `LowerInput` (`lower.ts:84-96`) carries no platform today, so the granularity
  set must be threaded into `lowerToIL` as an optional field from the call site that has both in
  hand (`emit.ts:105`, in `@blend65/compiler` — which then joins the blast radius; test callers
  are unaffected by an optional field). C64 contributes `{64}`. This is what a later RD would need
  to add charset (2048) or screen (1024) granularities without reopening lowering (AR #104). Not
  required for the RD to be complete.

### Won't Have (Out of Scope)

- **An alignment attribute (`@align(n)`)** — FUT-014; needs attribute syntax v3 deliberately
  removed, so a `spec/` edit forbidden under D3 plus a 23-rule Language Guard pass. Already
  Won't-Have in `RD-03-placement.md:219`. M1 exists precisely to avoid needing it, and does not
  foreclose it: an attribute would later be just another demand source under the same maximum rule
  (AR #102).
- **Uniform 64-byte alignment for every address-taken const.** A one-constant change that silently
  breaks `hi(&X) * 4`, which is still legal and still correct (AR #102).
- **Consumption inference** — deciding the boundary by analysing what the address flows into. It
  re-imports the IL-operand-scan mistake RD-03 rejected for cause: `boing-ball` reaches its four
  pointers through runtime `base + 0..3` arithmetic, so the analysis must chase dataflow through
  frame slots, and `$07F8` is not a stable signature because sprite pointers live at screen-base +
  `$3F8` (AR #102).
- **Treating an arbitrary divisor as a demand.** `lo(&X / 16384)` is a legitimate *read* of which
  VIC bank an address sits in — correct at any address — not a request to 16 KB-align it; honoring
  it would insert up to 16 KB of padding. `/ 128`, `/ 1` and every other non-allowlisted `k` keep
  256. Note that **256 is not a VIC granularity at all**; it is RD-03's default, which is why the
  rule must be an allowlist rather than arithmetic on `k` (AR #104).
- **Aligning — or diagnosing — mutable-aggregate and function operands of the fold shape.**
  `lo(&buf / 64)` on a mutable array compiles and folds correctly today and registers nothing under
  M1; SFA places variable storage before codegen sees a demand, so honoring it would invert the
  pipeline, and `RD-03-placement.md:106` records that a mutable module variable can never carry an
  alignment directive. The resulting silently-wrong-block hazard is undiagnosed and out of this
  RD's reach; it is filed as [#74](https://github.com/blendsdk/blend65/issues/74) (per the #67/#68
  convention) with a fold-site warning as the candidate fix — see the preflight report, PF-080.
- **Granularities other than 64** — charset (2048), screen (1024), bitmap (8192). No source form
  expresses a demand for them today.
- **Dropping alignment for a bare `&X`.** Arguable now that the blessed idiom carries its own
  demand, and rejected on the record: it would break ST-C11/C12/C13, break every stored-pointer
  consumer arbitrarily, and re-litigate AR #65 (AR #105).
- **Extending the parity corpus so `balloon-color`'s 128 B is ratcheted.** Its boundary is asserted
  by ST-13f regardless; adding a golden, twin and budget is its own scope (AR #101).
- **Reporting padding in the build summary** — stays [#67](https://github.com/blendsdk/blend65/issues/67).
  It is why the padding is invisible; it is not fixed here (AR #110).
- **Diagnosing aligned data landing in the char-ROM shadow** — stays
  [#68](https://github.com/blendsdk/blend65/issues/68). This RD *lowers* resolved addresses, so it
  makes the hazard strictly less likely without addressing it. `boing-ball`'s own source requires
  its 1 KB image below `$1000` and today's 1-byte pad is luck (AR #110).

---

## Technical Requirements

### Registering the demand (complexity: S)

The demand is available where the mark is made, with no new analysis. `foldedAddressByte`
(`lower.ts:2557-2586`) matches `&X / 2^k` and `&X >> k`, normalizes both to `shift`
(`lower.ts:2565`), and *then* calls `lowerAddressOf(binary.left, ctx, true)` (`lower.ts:2570`) —
the very function that records the mark (`lower.ts:1864`). Passing the normalized shift into that
call is the whole mechanism.

Deriving from the **normalized shift** rather than the surface operator is required, not
stylistic: RD-13's AC-5 pins `lo(&X / 64)` and `lo(&X >> 6)` as byte-for-byte equal, and a rule
keyed to the operator would make that equality depend on placement.

All other callers of `lowerAddressOf` pass no shift and therefore register 256. That is the entire
content of M2's structural guarantee; AC-2, AC-4, AC-5 and AC-8 jointly test it, and AC-15 pins the
same structure at the non-const edge.

### Combining demands (complexity: S)

Insertion is `map.set(sym, Math.max(existing ?? 0, demand))`. Order-independent by construction,
which matters because the two demand sites for one symbol can appear in either order and in
different functions.

### The emitted directive (complexity: S)

Unchanged in shape from RD-03: one `align` directive immediately ahead of the label, inside the
same stream, so the padding lands before the data and the directive travels with the bytes it
aligns (`instr-program.ts:196-208`). Only the boundary value becomes per-entry.

> **The ACME trap RD-03 documented still applies and is still handled in one place.** `!align`
> takes a **bitmask**, not a modulus: 64-byte alignment is `!align 63, 0, 0`. `!align 64, 0`
> assembles silently and aligns nothing. The derivation stays at `print-instr.ts:179` and nowhere
> else.

---

## Integration Points

### Packages touched

| Package | Change |
|---|---|
| `@blend65/codegen` | `il/lower.ts` (demand map + shift parameter), `il/cfg.ts` (field type), `instr/instr-program.ts` (per-entry boundary) |
| `@blend65/test-harness` | three oracles re-derived, new fixtures + assertions |

R15 holds trivially: nothing in `frontend` or `language-server` is involved, and no new package
edge is created.

### With RD-03 (address-taken alignment, ✅)

**This RD supersedes RD-03's M2**, which states *"Alignment is page (256-byte), not block
(64-byte)"* and justifies it by the `hi(&X) * 4` identity requiring page alignment. RD-13 removed
that requirement. RD-03's **M1** — the syntactic, at-the-`&`-site membership rule — is preserved
verbatim and remains load-bearing; only the *value* recorded at that site changes.

The supersession is stated in RD-03 itself, in place, rather than left to a reader to infer from
this document — the convention this project already applied at AR #24 and AR #31. See the
superseded-boundary note under `RD-03-placement.md` M2 (AR #111).

### With RD-13 (symbolic address arithmetic, ✅)

Load-bearing in both directions. RD-13's fold is what makes a 64-byte boundary usable at all, and
its `foldedAddressByte` is where the demand is read. RD-13's own forward-looking text about this RD
is corrected by M5.

### With #67 and #68

Neither is closed or diminished. #67 is why 188 bytes of `balloon-color` appear nowhere in
`main.report`; that stays true after this RD, on a smaller number. #68 becomes less likely and no
better diagnosed.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| What the RD owns | mechanism only / + corpus extension / + padding visibility / won't-fix | mechanism + oracle re-derivation | The deliverable is the bound (pad < 64), which caps ratchet noise at 63 instead of 255; the 128 B is a closeout measurement | AR #101 |
| How the boundary is decided | divisor inference / uniform 64 / consumption inference / `@align(n)` / status quo | divisor inference | The source already states the granularity, and the divisor is in hand at the marking site; no `spec/` change | AR #102 |
| Conflicting demands on one symbol | coarsest / finest / diagnostic | coarsest (max) | Alignment composes, so max is always safe — and it makes the `hi(&X)*4` hazard unreachable | AR #103 |
| Which shapes demand 64 | allowlist {shift 6} / any `2^k` clamped / any `2^k` | allowlist, off the normalized shift | `lo(&X / 16384)` is a bank *read*, not a placement demand; 256 is not a VIC granularity | AR #104 |
| What a bare `&X` demands | 256 / nothing / 64 | 256, unchanged | Dropping it breaks three oracles and every stored-pointer consumer | AR #105 |
| Shape of the mark | value (Map + number) / boolean + parallel set | value | One source of truth; max has a home | AR #106 |
| The six page-alignment oracles | re-derive the three fold-form / leave by-luck passes / re-derive all six | re-derive three, keep three as control | Two pass by luck and would become time bombs; the bare-`&` three become the negative control | AR #107 |
| What AC may assert | invariants + bound / per-fixture byte delta / corpus total drops | invariants + bound | "Corpus total drops" would fail on a correct implementation — RD-13 AC-8's trap | AR #108 |
| RD-13's contradicted prediction | correct RD-13 + state here / state here only / leave | correct both | Left standing it pre-authorizes uniform 64 | AR #109 |
| #67 / #68 | both stay filed / fold in #67 / fold in #68 | both stay filed | Neither is required for the boundary to be correct | AR #110 |

> **Traceability:** every decision above references the entry that resolved it in
> [`00-ambiguity-register.md`](00-ambiguity-register.md) (items 101–112: the ten design decisions
> above, plus #111 — the in-place RD-03 supersession note — and #112 — the Wave B2 placement —
> which surfaced during authoring and are executed in RD-03 and the README rather than decided in
> this table).

---

## Security Considerations

This RD changes where constant data is placed in a statically-linked 6502 binary at compile time.
There is no runtime, no network surface, no user input at execution time, and no privilege
boundary.

- **Data sensitivity**: none. The bytes are sprite images compiled from program source.
- **Input validation**: the only input is program source already validated by the frontend. The new
  value is a **normalized shift count the compiler itself computed** (`lower.ts:2565`, bounded to
  `[0, 15]` by RD-13's existing guard), not user data reaching the emitter — and the allowlist means
  only one value of it (6) changes behaviour at all. An out-of-allowlist shift falls to 256, which
  is the current behaviour, so the failure direction is the safe one.
- **Injection risks**: the boundary reaches the assembler as a rendered `!align` operand. It is a
  compiler-derived integer from a fixed allowlist, never a source-supplied string, so no assembler
  directive can be injected through it.
- **Authentication & authorization / encryption / rate limiting / infrastructure**: not applicable —
  AOT compilation with no service surface.
- **Correctness hazard, in place of a security one**: the real risk class here is a **silently
  wrong address** — an image aligned differently than a consumer assumes, making the VIC read the
  wrong block with no diagnostic. **For const images** M2 removes it by construction, and AC-4 and
  AC-15 pin it. The same symptom on an SFA-placed mutable buffer is out of this RD's reach and
  remains undiagnosed — scoped out in Won't Have and filed as
  [#74](https://github.com/blendsdk/blend65/issues/74) (PF-080). That, not a
  vulnerability class, is what this section's diligence goes to on this project.

---

## Acceptance Criteria

Every criterion below is **independent of upstream code size**, per AR #108. Absolute addresses and
per-fixture byte counts are deliberately absent **from gates**; they appear only inside recorded
measurements (AC-10, AC-11).

1. [ ] **AC-1 — Directive text, 64 demand.** For a program whose only `&` on symbol `X` is
   `lo(&X / 64)`, the emitted assembly contains exactly **one** `!align` directive for that stream,
   its text is exactly `!align 63, 0, 0`, and the immediately following line is `__data_*_X:`.
   Negative: the text is never `!align 255, 0, 0` and never `!align 64, 0, 0` (the latter assembles
   silently and aligns nothing).
2. [ ] **AC-2 — Resolved boundary.** In the same program, the address `X` resolves to satisfies
   `addr % 64 === 0`. For a bare-`&` program, `addr % 256 === 0`.
3. [ ] **AC-3 — Code-size-independent delta.** A fixture declaring two 4-byte `const` arrays, both
   address-taken as `lo(&A / 64)` and `lo(&B / 64)`, places the second label exactly **64** bytes
   after the first, for any amount of preceding code. Negative cases this discriminates: **256**
   would mean the demand was not applied; **4** would mean alignment was dropped entirely.
4. [ ] **AC-4 — Maximum rule, both directions.** (a) A program with both `lo(&X / 64)` and
   `hi(&X) * 4` on the same `X` emits `!align 255, 0, 0` and resolves `addr % 256 === 0`, in
   **either** source order. (b) A program with only `lo(&X / 64)` emits `!align 63, 0, 0`.
   (c) The assembled sprite-pointer byte in (a) equals `(addr / 64) & 0xff` under **both** idioms —
   i.e. `hi(&X) * 4` is still correct.
5. [ ] **AC-5 — Non-allowlisted shapes keep 256.** Each of `lo(&X / 1)`, `lo(&X / 128)`,
   `lo(&X / 16384)` and `lo(&X / 32768)` emits `!align 255, 0, 0` and resolves
   `addr % 256 === 0` — covering `k = 0` and `k = 15`, the extremes `foldedAddressByte` accepts —
   and so do plain `lo(&X)` and plain `hi(&X)`, the divisor-less rows of M1's table.
   `lo(&X / 65536)` (`k = 16`, rejected by the fold and lowered through the ordinary path) also
   keeps 256.
6. [ ] **AC-6 — `/ 64`, `>> 6` and `/ BLOCK` are indistinguishable.** Three programs identical but
   for the divisor's spelling — `/ 64`, `>> 6`, and `/ BLOCK` with `const BLOCK = 64` (a named
   constant reaches the fold through `constantOperandValue`, which accepts it by design,
   `lower.ts:2530-2537`) — produce the same directive text, the same `addr % 64 === 0`, and the
   same assembled pointer byte — preserving RD-13 AC-5, and pinning that the demand keys on the
   normalized shift, not on a literal `64` token.
7. [ ] **AC-7 — By-reference arguments still register nothing.** A program passing a `const` array
   to a helper by reference (`sum(TABLE, len)`) with no `&` anywhere emits **no** `!align`
   directive, and `slice7b`, `slice8b` and `slice8` goldens are byte-identical to their current
   committed contents. This is RD-03 M1's membership rule, re-pinned because M3 rewrites the data
   structure that implements it.
8. [ ] **AC-8 — Bare `&` is untouched.** `align-mixed.spec.test.ts` ST-C11, ST-C12 and ST-C13 pass
   **unmodified** — no edit to the file, no edit to `examples/align-mixed/main.blend`.
9. [ ] **AC-9 — The three fold-form oracles are re-derived and green.** ST-C15, ST-13f and ST-13j
   assert **both** `addr % 64 === 0` **and** the directive text — `!align 63, 0, 0` immediately
   preceding the image label, in ST-C11's style — each with its restated rationale, and their
   `< 0x1000` clauses are retained unchanged. The directive clause is load-bearing, not
   belt-and-braces: `% 256 === 0` implies `% 64 === 0` and every current image lands on a multiple
   of both, so the `% 64` clause alone cannot fail if the demand regresses to 256; directive text
   is the only deterministic discriminator (AR #108).
10. [ ] **AC-10 — The bound.** For every 64-demand image in `examples/` (`balloon`,
    `balloon-color`, `boing-ball`), the gap between the `!align` directive's address and the
    label's address is **< 64**. Discharged at closeout by measurement, not by a test. The
    recorded measurements: `balloon` 19, `balloon-color` 60, `boing-ball` 1 — and `align-mixed`
    194, which sits outside the bound's scope as the bare-`&` 256-demand control.
11. [ ] **AC-11 — No corpus movement is claimed.** `packages/test-harness/test/golden/budgets.json`
    is **unchanged**, and `balloon` remains 318 B. A closeout that reports a corpus byte improvement
    is wrong. `balloon-color` is measured at **454 B** (down from 582 — both in the budget
    convention, payload excluding the 2-byte load address, the same convention as `balloon`'s 318;
    #69's "584" is the `.prg` file size) and recorded as a measurement, not a budget.
12. [ ] **AC-12 — The ledger contradiction is closed.** `RD-13-symbolic-address-arithmetic.md:157-159`
    no longer predicts that this RD makes `hi(&X) * 4` incorrect, and RD-13's peephole conclusion is
    visibly unchanged.
13. [ ] **AC-13 — Verify is green.** `yarn install --frozen-lockfile && yarn turbo run build &&
    yarn turbo run typecheck && yarn turbo run lint && yarn test`, plus the local VICE tier for
    `balloon` and `boing-ball` (CI has no emulator tier, AR-27). `git status --porcelain spec/` is
    empty (D3). Stated for honesty: those two programs are exactly the two whose image address this
    RD does not move; `balloon-color`, the one image that moves, is build-tier only and its
    hardware correctness rests on ST-13f's assembled-pointer oracle. A one-off manual VICE look at
    `balloon-color` at closeout is recorded, not gated.
14. [ ] **AC-14 — Prime Directive review.** The emitted directive for a sprite image reads
    `!align 63, 0, 0` — the idiom a competent 6502 developer hand-writes for in-place sprite data.
    The committed hand twin (`examples/balloon/balloon.asm`) deliberately contains no `!align` —
    it stages the sprite into the tape buffer with a copy loop — so the review is strategy-level:
    in-place-plus-align judged against staging-copy as that developer would judge the trade, not a
    line-for-line directive comparison.
15. [ ] **AC-15 — Non-const `&` registers nothing, divisor or no divisor.** A program applying
    `lo(&buf / 64)` to a mutable module array and `lo(&fn / 64)` to a function compiles, emits
    **no** `!align` directive for those symbols, and the folded operand still assembles to
    `#<(sym / 64)` — the shift parameter is inert outside the const branch. AC-7's rationale
    applies verbatim: re-pinned because M3 threads a new parameter through the very function whose
    variable and function branches must ignore it.

---

## Spec-Test Inventory

| Test | File | Status |
|---|---|---|
| ST-C11, ST-C12, ST-C13 | `align-mixed.spec.test.ts` | **unmodified** — promoted to the bare-`&` negative control (AC-8) |
| ST-C15 | `balloon.spec.test.ts` | re-derived to `% 64` + directive text (AC-9) |
| ST-13f | `balloon-color.spec.test.ts` | re-derived to `% 64` + directive text (AC-9; fails deterministically until then) |
| ST-13j | `boing-ball.spec.test.ts` | re-derived to `% 64` + directive text (AC-9) |
| new — 64-demand directive + resolved boundary | new fixture | AC-1, AC-2 |
| new — two-array 64-byte delta | new fixture | AC-3 |
| new — mixed demand, both orders | new fixture | AC-4 |
| new — non-allowlisted shapes (`/1`, `/128`, `/16384`, `/32768`, `/65536`, plain `lo`/`hi`) | new fixture | AC-5 |
| new — `/ 64` ≡ `>> 6` ≡ `/ BLOCK` | new fixture | AC-6 |
| new — non-const `&` with divisor: no directive, fold byte unchanged | new fixture | AC-15 |
| by-reference registers nothing | existing — `lower-address-of.spec.test.ts:279` reshape + `slice7b`/`slice8b`/`slice8` goldens, CI | AC-7 |
| the pad bound | — closeout measurement, no test | AC-10 |
| budgets untouched | existing budget tier (`budgets.json` unchanged), CI | AC-11 |
| 16 `pageAligned` sites | `lower-address-of.{spec,impl}.test.ts` + `assemble.impl.test.ts` | reshaped to M3's field (serves M3, verified under AC-13) |

---

## Projected Target

For a sprite image whose program names its block the blessed way:

```asm
    LDA #<(__data_Main_BALLOON / 64)
    STA $07F8
    ...
!align 63, 0, 0
__data_Main_BALLOON:
    !byte $00, $7F, $00, ...
```

Verified against ACME 0.97 as part of #69's filing: with the image at `$0840`, `LDA #(sprite / 64)`
assembles to `a9 21` — block 33 — resolved entirely at assembly time.

The `!align 63` is the only line that changes. That is the measure of this RD: one operand, and the
end of a 255-byte source of noise in every byte measurement the project makes.
