# RD-03: Placement — Align Const Data and Read It In Place

> **Document**: RD-03-placement.md
> **Status**: Draft (revised after preflight — see [`00-preflight-report-rd-03.md`](00-preflight-report-rd-03.md))
> **Created**: 2026-07-20
> **Project**: blend65 — Asm-Parity Initiative
> **Issue**: [#49](https://github.com/blendsdk/blend65/issues/49) (placement slice; the `copy()`
> slice and the wider hardware-access work stay out of scope — AR #64)
> **Depends On**: RD-01 (parity instruments, ✅), RD-02 (twin corpus + scoreboard, ✅),
> RD-05 (block layout + corpus invariants, ✅)
> **CodeOps Skills Version**: 3.11.0

---

## Terminology

Three words that quantify this RD's gates name **different** populations, so they are fixed here
and used consistently below:

| Term | Meaning |
|---|---|
| **golden** | One of the 14 committed `*.asm.golden` files (`GOLDEN_PROGRAMS`, `golden-layout.spec.test.ts:36-51`). `balloon` is **not** among them — its generated output is deliberately never committed |
| **fixture** | A corpus program with a `budgets.json` row — the 14 goldens **plus** `balloon` |
| **corpus total** | The summed `bytes` of all fixtures, as rendered in `SCOREBOARD.md` |

---

## Feature Overview

The corpus's single largest divergence is `balloon`: **677 bytes against its twin's 251**. The
largest single component of that gap is one mistake repeated 63 times.

```blend65
// examples/balloon/main.blend:8-11
// Stage the sprite image in block 13 ($0340) — inside the VIC's 16K bank
// and 64-byte aligned, so the sprite pointer can reference it directly.
// poke/peek addresses must be compile-time constants, hence the unrolled copy.
poke($0340, BALLOON[0]);
poke($0341, BALLOON[1]);
… 61 more …
```

The sprite is embedded into the binary by `embed()`, and then copied — byte by byte, unrolled,
because `poke` takes only a literal address — to `$0340`, where the VIC can find it. The bytes
exist **twice**: once in the data section, once at `$0340`.

That is exactly what the Prime Directive forbids: *"Data lives where the hardware reads it:
placement over copying; never duplicate bytes in RAM."*

**The sprite never needed to move.** `spec/13-data-inclusion.md:109` already guarantees the
important half — *"`embed()` data is placed directly in the data/ROM section of the binary …
There is no runtime cost."* Measured on the current tree, that data lands at **`$0A67`** in
today's 677-byte build and at **`$08FA`** once the staging pokes are gone — both inside VIC bank 0
(`$0000–$3FFF`), the bank the chip already reads from. It is copied for one reason only: a sprite
pointer addresses 64-byte **blocks**, and neither address is on a block boundary.

So `$0340` was never a requirement. Block 13 is simply what the hand-written twin chose. A
64-byte-aligned address inside the bank works, and the data section already qualifies but for the
alignment.

> **Bank residency is a size-dependent accident, not a property.** Two hardware constraints bound
> where the data may land, and **this RD enforces neither in general** (see Won't Have):
> in VIC banks 0 and 2 the chip reads the **character generator ROM** at bank offset
> `$1000–$1FFF` regardless of CPU `$01` banking, so sprite data placed there is invisible; and
> above `$3FFF` the array leaves the bank entirely. `balloon` lands at `$0900`, safely below both.

This RD makes the compiler place such data where the hardware can read it, and lets the program
name it. It is **grammar-free**: no new syntax, no change to `spec/`, no Language Guard
evaluation — every language surface it uses (`embed`, `&`, `hi`, `poke`) is already in frozen v3.0.

### What this is not

It is **not** `copy()`. FUT-012 (`spec/future-considerations.md:231`) defers an array-copy
intrinsic from v3, and adding one means editing `spec/` — forbidden by decision D3 during
compiler implementation — plus a full 23-rule Guard evaluation. That gate is real and this RD
does not touch it. It also makes it *less* urgent: with placement, `copy()` becomes a genuine
optimization rather than the only way to express the program (AR #64).

**It is also not the mechanism v3 nominates.** FUT-014 (`spec/future-considerations.md:292`) says
*"In v3, alignment is handled automatically by format handlers for embedded assets (F015). For
hand-written data, the linker/platform profile can handle placement."* Format handlers are
entirely unimplemented (below), so nothing today delivers that. The address-taken rule is a
**compiler placement policy**, not a competing specification: it aligns a stream, and a future
format handler that wants a different granularity for a typed asset can still impose it on top,
because alignment composes — a 256-byte-aligned address is also 64-byte-aligned. The open question
a format-handler RD must answer, and this one deliberately does not, is which side owns the
padding *report* when both apply. `spec/13-data-inclusion.md` (EMB-5) states no alignment
guarantee, so nothing here contradicts normative spec text.

---

## Functional Requirements

### Must Have

**M1 — A const array whose address is taken **syntactically** is page-aligned.**
When a program applies the unary `&` operator to a `const` array, the compiler emits that array at
a 256-byte boundary. An array whose address is never taken is **not** aligned and pays no padding.

The rule is **syntactic and narrow**, and its exact membership is load-bearing:

| Included | Excluded |
|---|---|
| A source-level `&X` whose operand resolves to a const aggregate — i.e. `sym.kind === "constant"` | An **implicit by-reference array/struct argument** (`sum(TABLE, len)`), even though it materializes the same IL operand |
| — | `&` on a **function or interrupt handler** (`&onIRQ`) — no data image to align |
| — | `&` on a **mutable module variable** — it lives in the SFA RAM region, is never emitted into the image, and can never carry an alignment directive |

This distinction is not cosmetic: at IL level the included and excluded cases are
**indistinguishable**. `packages/codegen/src/il/lower.ts:1022-1029` emits the same `addrOf`
constructor for a by-ref aggregate argument that `lowerAddressOf` (`:1807`) emits for `&X`, and
`slice7b.asm.golden:89,91` already contains `LDA #<__data_Game_TABLE` / `LDA #>__data_Game_TABLE`
produced by a plain `sum(TABLE, …)` call. An implementation that scans IL `addrOf` operands would
align `slice7b` and `slice8b` (+159 and +276 bytes) and try to align function labels in `slice8`.

**The rule is therefore implemented at the `&` site, not over IL operands.** `lowerAddressOf` is
reached only from real `&` expressions — `lower.ts:1042` guards the call with `isAddressOfExpr`,
and the by-ref argument path never calls it — so marking the symbol inside `lowerAddressOf` when
`sym.kind === "constant"` implements the syntactic rule exactly, with no separate AST pass and no
frontend involvement (R15 holds).

The rule carries meaning rather than convenience: applying `&` to a const array is the program
declaring that something other than the compiler's own indexed access will read those bytes —
hardware, or a pointer — which is exactly when placement matters (AR #65).

**M2 — Alignment is page (256-byte), not block (64-byte).**
A sprite pointer is `address / 64`, and v3 offers no way to name that quantity. It does offer
`hi()`, which is `address / 256`. For an address that is a multiple of 256,
`hi(&X) * 4 == address / 64` **as arithmetic** — the low byte is zero, so nothing is lost in the
narrowing. Page alignment is what makes the sprite block expressible without new syntax (AR #68).

> The identity is arithmetic, **not** constant folding. `spec/12-intrinsics.md:174` guarantees
> folding only "when applied to compile-time constants"; `&X` is a **link-time** symbol the
> assembler resolves, and the compiler demonstrably does not fold it — it emits a runtime
> `ASL`/`ASL` (see Known Divergence). The correctness of the identity does not depend on folding;
> only its cost does.

**M3 — Alignment is emitted, not assumed.**
The compiler emits an explicit assembler alignment directive ahead of the aligned stream rather
than computing an absolute address. Absolute addresses are not known at serialization time; the
assembler resolves them.

**M4 — No fixture regresses, and the ledgers that describe the corpus stay true.**
Corpus total bytes must strictly decrease and **no individual fixture may grow**. A fixture that
grows is a stop, not a budget bump. Every affected `bytes` ratchet is re-derived **from the
aligned build** in the same change (AR #66, and the discipline of AR #4/#12).

The same change re-audits the **hand-written prose** in `twins.json`, not just the numbers.
balloon's routing entries currently attribute its divergence to "63 unrolled pokes forced by the
`copy()` language gap" and carry `sourceForced: true` — statements this RD makes false, rendered
verbatim into the committed `SCOREBOARD.md`. The scoreboard's freshness gate checks only
*structural* staleness (a routing category with no computed rows), so it stays green on false
prose; RD-05 set the precedent of re-routing rows as part of the change that invalidates them.

**M5 — `balloon` reads its sprite in place.**
`examples/balloon/main.blend` loses all 63 staging pokes and sets its sprite pointer from the
embedded array's own address. The program copies **nothing** at runtime.

**M6 — Balloon's shared observable contract is split, deliberately.**
`BALLOON_OBSERVABLES` (`packages/test-harness/src/testing/balloon.ts`) is consumed by **two**
tiers: balloon's own fixture suite and the twin tier (`twins.spec.test.ts:87`), which runs it
against the unchanged hand-written twin. Two of its ten checks name the old staging site —
`{ address: 0x07f8, value: 13 }` and `{ address: 0x0340, bytesFile: … }` — and after M5 the
compiled program and the twin no longer agree on either: the twin still stages at `$0340` with
pointer 13, while the compiled program reads block 36 at `$0900`.

The shared table therefore **shrinks to what both programs' sources still mandate** — position,
enable, colour, hires and expand flags — and the two divergent checks move into balloon's own
fixture suite, resolved from the symbol map. This follows the contract the module already states
(`testing/observables.ts:5-12`): *"implementation-coupled assertions — allocator-chosen addresses
— stay in the fixture suites by construction; equivalence between a program and its twin is judged
only on what the program's SOURCE mandates."* After this RD the sprite's address **becomes**
allocator-chosen, so those rows stop qualifying for the shared set by the contract's own rule.

**M7 — The corpus invariants still hold, and the new emission gains an artifact.**
The permanent layout scan (RD-05's ST-B39/B40/B43/B44) stays green: padding must not introduce a
shape those invariants forbid, and the goldens regenerate cleanly. Because `balloon` has no golden
and the three data-bearing goldens are frozen byte-identical by AC-2, that scan alone cannot
observe a single byte this RD produces — so a **new mixed-alignment fixture** carries the
discriminating proof (see AC-7). That fixture is **CI-tier and committed as a test, not as a
golden** — the reasoning is recorded under AC-7 (AR #70).

### Should Have

**S1 — Any other fixture that stages hardware-read data in place.** If a corpus program can drop a
copy the same way, it does, in the same change. **On the current corpus this is expected to be a
no-op**, and deliberately so: the only other const→copy path is `slice8b`, whose destinations
(`$0400` screen RAM, `$C000`) are below the PRG load base and therefore excluded by this RD's own
Won't-Have. S1 exists for future fixtures, not present ones.

### Won't Have (Out of Scope)

- **`copy(dst, src, count)`** — FUT-012, deferred from v3; needs a `spec/` edit (D3) and a Guard
  evaluation (AR #64).
- **An alignment attribute (`@align(n)`)** — FUT-014; needs attribute syntax that v3 deliberately
  removed. M1's address-taken rule exists precisely to avoid needing it.
- **Arbitrary placement at a chosen absolute address** (e.g. forcing data below the PRG load
  base). A single-load PRG cannot place below its own load address; that is what the twin's copy
  exists for, and it is not what this RD replaces.
- **Format handlers / `embed(...).selector`** — specified (EMB-5) but **entirely unimplemented**:
  no `FormatHandler` type anywhere, and `PlatformProfile.embedFormats`
  (`packages/core/src/platform/platform-profile.ts:107`) is declared but never populated or read.
  (`E10203` *is* registered at `diagnostic-codes.ts:268`, but is referenced nowhere.) Building
  them is its own RD.
- **Improving `hi(&X)`'s codegen** — routed to #58/#60 (AR #67); see Known Divergence below.
- **Runtime-address `poke`** — `E10045` restricts `poke` to a literal address, though the frozen
  spec specifies the runtime case (`spec/12-intrinsics.md:159`). That is a real unimplemented-spec
  gap, but placement removes the need for it *here*; it belongs with #49's wider slice.
- **Reporting padding in the build summary.** Split out to
  [#67](https://github.com/blendsdk/blend65/issues/67) — see *Deferred: padding visibility* below.
- **Any general guarantee of VIC-bank residency.** This RD aligns; it does not constrain *where*.
  A program whose code grows can push an aligned array into the char-ROM shadow (`$1000–$1FFF`) or
  out of the bank (`> $3FFF`), and **nothing diagnoses either**. `hi(&X) * 4` also wraps silently
  above `$3FFF` — `hi()` returns a `byte` and the two `ASL`s discard the top bits with no carry
  check, so `$4000` yields pointer 0 and the VIC reads zero page. AC-3 is bounded accordingly, and
  AC-1 pins balloon specifically. The general diagnostic is
  [#68](https://github.com/blendsdk/blend65/issues/68).

### Deferred: padding visibility

An earlier draft required padding to appear in the build summary. That is **removed from this RD**
because it is a substantially larger, differently-shaped change than the placement work:

- The summary's segment reporting is **entirely unwired** — `packages/compiler/src/api/build.ts:103`
  threads only `binarySize`; `dataSize`/`dataRange` are never populated
  (`resource-report.ts:63`), so every build today prints `Data segment: 0 bytes ($0000–$0000)`.
- Padding is only knowable **post-assembly**, which M3 says the emitting stage cannot compute —
  so a read-back path is needed that does not exist.
- The summary's layout is transcribed **verbatim from frozen `spec/11-memory-model.md:201-229`**,
  pinned by a golden whose header states it is derived from requirements and not from the
  implementation, and the renderer's own rule is *"the layout never changes, only the numbers"*.
  Adding a line is a deliberate divergence that deserves its own decision.
- It reaches `@blend65/compiler` and `@blend65/cli`, neither of which this RD otherwise touches.

Recorded for whoever picks it up: the cheap derivation is to **emit a synthetic label immediately
before the alignment directive**, making padding `__data_X − pre_align_label` straight from the
symbol map — no ACME report parsing required. Until then, padding is legible through M4's
re-derived ratchets and the scoreboard.

---

## Technical Requirements

### The alignment directive (complexity: S)

`AcmeDirective` (`packages/core/src/instr-model/stream.ts:37-44`) has `origin`, `symbolDef`,
`byte`, `word`, `text`, `fill`, `outputFile` — **no alignment variant**. One must be added:

```ts
| { readonly kind: "align"; readonly boundary: number; readonly fill: number }
```

serialized as `!align boundary-1, 0, fill`. M2 fixes `boundary = 256` as the only value this RD
produces; `fill` is `$00`.

> **The operand form is a correctness trap, verified against ACME 0.97.** ACME's directive is
> `!align andValue, equalValue [, fill]` — a **bitmask**, not a modulus. `!align 255, 0` page-aligns
> correctly. `!align 256, 0` **assembles silently and aligns nothing**. `!align 256` is a syntax
> error. "It assembles" is therefore *not* a sufficient verification, which is why AC-1 asserts the
> resolved address through the symbol map rather than the directive's presence. The third operand
> matters too: ACME's default fill is `$EA` (NOP), so omitting it puts `EA` runs into committed
> goldens.

This is an additive change to `@blend65/core`'s instruction model. It is **not** a change to
`spec/`, which is the *language* specification — D3 is unaffected and `git status --porcelain
spec/` stays empty.

`origin` and `fill` are not substitutes: both take literal numbers and need an absolute address or
a byte count that is only known once the assembler has laid the program out.

**The new union member forces three exhaustive switches** in
`packages/codegen/src/instr/print-instr.ts`, each carrying a `const _exhaustive: never` arm that
fails to compile until handled:

| Site | Decision required |
|---|---|
| `directiveText` (`:165-166`) | render as `!align 255, 0, 0` |
| `directiveByteSize` (`:295-315`) | returns **0** — the size is address-dependent and unknowable statically. Consequence: `programByteSize` becomes a documented **lower bound** |
| `isColumnZeroDirective` (`:178-180`) | **true** — `!align` is conventionally column-0 like `* =`; otherwise it renders at instruction indent in every golden |

`@blend65/platforms` needs **no** change (its plugins only construct `outputFile` directives and
never switch over the union), and branch relaxation and per-function costs are unaffected (both
iterate `segment: "code"` streams only).

### Deciding which arrays are aligned (complexity: S)

Marked at the `&` site in `lowerAddressOf` (`packages/codegen/src/il/lower.ts:1807`), gated on
`sym.kind === "constant"` (`:1817-1818`) — see M1 for why this, and not an IL-operand scan, is the
correct hook. `&` on a const array already lowers correctly: it emits
`LDA #<__data_Main_BALLOON` / `LDA #>__data_Main_BALLOON`. **That instruction pair is not a
distinguishing signature** — a by-ref argument emits the identical pair — so it verifies the
lowering, not the membership rule.

### Emission (complexity: S)

The directive is prepended to the const-data stream's **own entries**, ahead of its label, in
`constDataStream` (`packages/codegen/src/instr/instr-program.ts:191-198`) — so it travels with the
stream it aligns and cannot drift from it. `serialize-acme.ts:125-131`, which concatenates
const-data streams after the code, needs **no change**: it already renders stream entries through
`printInstr` (AR #71).

The `aligned` flag reaches that function as a new field on `ConstDataEntry`
(`packages/codegen/src/il/cfg.ts`), populated from a set of address-taken symbols accumulated
during function lowering. The ordering makes this free and needs no extra pass: functions are
lowered at `lower.ts:213-220` and `constData` is built afterward at `:237-249`, so the set is
already complete when the entries are constructed (AR #72).

**Multiple aligned arrays**: padding is per aligned stream and accumulates (worst case ~255 bytes
each). The emission order is `program.streams` order, unchanged by this RD — no reordering pass is
introduced, so an implementation must not assume aligned streams are grouped. A zero-length const
array whose address is taken is aligned like any other and may pay up to 255 bytes for a zero-byte
payload; no diagnostic rejects this, and none is added here.

---

## Integration Points

### Packages touched

`@blend65/core` (the new directive), `@blend65/codegen` (marking + emission + `print-instr`),
`@blend65/test-harness` (observable split, new fixture, goldens, budgets, scoreboard, twins
routing), `examples/balloon`, plus the new fixture's `examples/` directory.

`@blend65/compiler` and `@blend65/cli` are **not** touched — that was true only of the deferred
padding-visibility work.

R15 holds: the address-taken set is computed entirely inside `packages/codegen/src/il/lower.ts`;
neither `@blend65/frontend` nor `@blend65/language-server` gains a codegen import.

### Test-harness surfaces this RD changes

`src/testing/balloon.ts` (observable split, M6) · `src/balloon.spec.test.ts` (the migrated
symbol-resolved checks) · `src/twins.spec.test.ts` (shrunk shared set; the new fixture's pair
registration) · `test/golden/{budgets,twins}.json` + `SCOREBOARD.md`.

Adding a golden is **not** free: `twins.spec.test.ts:93-99` asserts the pair set equals the
goldens plus balloon, so a new fixture drags in a hand-written twin, a `twins.json` pair, an
observables table, a `budgets.json` entry, a `GOLDEN_PROGRAMS` row, an `examples/<fixture>/`
directory and an `INLINED_MODULES` row.

### With RD-05 (block layout, ✅)

RD-05's permanent corpus scan is the guard for M7. Its budget-ratchet discipline — every
program's `bytes` re-derived, not just the windowed ones (AR #56) — is the mechanism M4 relies on.
Verified: deleting the 63 pokes does **not** renumber balloon's label anchors — `Main_main_L5` and
`Main_main_L3` are present and identical before and after — so the budget window survives.

### With #58/#60 (constant materialization)

`hi(&X) * 4` works but materializes the whole address first (see Known Divergence). Closing that
is #58/#60's, not this RD's (AR #67).

---

## Known Divergence, stated up front

`poke($07F8, hi(&BALLOON) * 4)` compiles today and emits **8 instructions**:

```asm
LDA #<__data_Main_BALLOON
STA __frame_Main_main_0sc0
LDA #>__data_Main_BALLOON
STA __frame_Main_main_0sc0+1
LDA __frame_Main_main_0sc0+1
ASL
ASL
STA $7F8
```

A hand-coder writes four: `LDA #>balloon` · `ASL` · `ASL` · `STA $07f8`. The extra **four** come
from materializing the full 16-bit address before `hi()` reads its high byte. Two details worth
recording, because both affect how #58/#60 should price this:

- The staging pair is a **synthetic word frame slot** (`__frame_Main_main_0sc0`, absolute `$2000`),
  not zero page — so the sequence is more expensive than "scratch" suggests.
- The line also emits `warning[W10172]: multiply by 4 generates a shift-and-add sequence`
  (`ShiftAndAddMultiply`, `diagnostic-codes.ts:374`). The compiler in fact emits two `ASL`s, so the
  blessed idiom warns the developer about a cost it does not incur. A folded `hi(&X) * 4` would
  drop both the extra instructions and the warning.

This RD **does not** close that — it is a constant-materialization defect routed to #58/#60
(AR #67) — but it is recorded here so the residual is attributed rather than discovered later.

---

## Security Considerations

No new runtime surface, no I/O, no user input. Three placement-safety notes:

- **Stream overlap is not reachable.** ACME lays streams sequentially and `!align` only inserts
  padding ahead of a stream.
- **The guard that actually bounds a padded binary** is `checkBinaryBudget` on the post-ACME
  `binarySize` (`packages/compiler/src/api/build.ts:103-112`, E10034) — which includes padding.
  The *binding* constraint in practice is tighter: `checkDataOverlap` / E10033
  (`build-resource-report.ts:151`) against `dataBase` = `$2000` under `DEFAULT_PROFILE`, roughly
  6.1 KB. Padding that pushes a program over will surface as *"Emitted code … overlaps the RAM
  data region"*, which reads like a RAM bug rather than an alignment cost — worth knowing when
  triaging.
- `programByteSize` (`packages/codegen/src/instr/instr-program.ts:246`) is **not** a guard: it has
  no production caller, and with `directiveByteSize` returning 0 for `align` it is a lower bound.

---

## Acceptance Criteria

Each criterion names the tier that owns it. **CI** = runs on every push (ACME available, no
emulator — AR-27). **Local** = `skipIf(!hasVice())`, proven locally, never in CI.

1. [ ] **[CI]** **A const array whose address is taken is page-aligned**: `__data_Main_BALLOON`
   resolves to a multiple of 256 **and below `$1000`** (clear of the char-ROM shadow), asserted
   through the symbol map, with the alignment emitted as an assembler directive rather than a
   computed absolute address.
2. [ ] **[CI]** **The exclusions in M1 hold, proven on named negative controls**: `slice7` and
   `slice7b` (const data reached by by-ref argument), `slice8b` (same) and `slice8` (`&onIRQ` /
   `&onNMI` — function address-of) are **byte-identical** to their pre-RD-03 goldens. These are
   the cases an IL-operand scan would wrongly align, so they are the criterion's whole point.
3. [ ] **[CI]** **`hi(&X) * 4` names the sprite block correctly**: for a page-aligned `X` **below
   `$4000`**, the emitted pointer store is equivalent to `LDA #>sym` / `ASL` / `ASL` / `STA $07F8`
   and the symbol-map address satisfies `address / 64 == hi(address) * 4`. Behaviour at or above
   `$4000` is undiagnosed (Won't Have).
4. [ ] **[CI]** **`balloon` copies nothing**: its emitted assembly contains no staging stores, and
   the sprite byte sequence appears in the binary exactly once.
5. [ ] **[Local]** **`balloon` renders correctly on VICE 3.10**: the **source-mandated** shared
   observables (position 174/141, enable, colour, hires, expand flags) pass unchanged, and the two
   migrated checks — sprite pointer and image block — pass in balloon's own fixture suite against
   symbol-resolved addresses. The twin tier passes unchanged against the unmodified twin. Together
   these are the proof that the VIC reads real sprite data at the new address.
6. [ ] **[CI + review]** **No fixture regresses**: no individual fixture grows; every `bytes`
   ratchet re-derived **from the aligned build**; the four budget windows and the scoreboard
   regenerated with the freshness gate green. balloon's `frameUpdate` measured window
   (`measuredMaxCycles`) is re-derived **[Local]** on VICE. The "corpus total strictly decreases"
   clause is a **review gate, not a test** — the budget tier only fails on `actual > budget` and
   will pass a growth accompanied by a raised ratchet, so it is verified against the committed
   `SCOREBOARD.md` diff at closeout.
7. [ ] **[CI]** **The new emission has a discriminating artifact**: a mixed-alignment program — two
   const arrays in one program, one address-taken and one not — is built **in-test through the real
   `build()` facade and real ACME** (the `buildBalloon` pattern, `testing/balloon.ts:44-58`;
   committing no generated output) and asserts that the alignment directive precedes exactly the
   address-taken stream, that its **resolved** address is a multiple of 256, and that the unaligned
   stream pays zero padding. RD-05's ST-B39/B40/B43/B44 scan stays green over the 14 goldens.

   > **No committed golden, and deliberately so** (AR #70). A golden is the *weaker* instrument
   > here: one containing the silently-wrong `!align 256, 0` looks entirely plausible and passes,
   > so only a resolved-address assertion catches the operand trap. And a golden would force a
   > hand-written twin (`twins.spec.test.ts:93-99`) for a synthetic two-array program that has no
   > idiom to be a twin *of*, entering the corpus ratio and `SCOREBOARD.md` as noise plus a
   > permanent VICE maintenance obligation.
   >
   > Recorded so it is not re-litigated: the RD-05 invariants could never have covered this
   > anyway. They scan **jump shapes inside function sections**
   > (`golden-layout.spec.test.ts:63-92`); an `!align` sits ahead of a const-data stream and its
   > padding is inserted by ACME at assembly time, so no golden — new or existing — contains a byte
   > those invariants are capable of judging.
8. [ ] **[CI]** **balloon's routing ledger is re-audited**: its `twins.json` entries no longer
   attribute the divergence to "63 unrolled pokes forced by the `copy()` language gap",
   `sourceForced` is dropped, and the byte prose is re-derived. *(The freshness gate checks only
   structural staleness and will stay green on false prose — RD-05 set the precedent for fixing
   this in-change.)*
9. [ ] **[CI]** **`spec/` untouched**: `git status --porcelain spec/` empty (D3), and no new
   language syntax is introduced — the change uses only `embed`, `&`, `hi` and `poke` as frozen
   v3.0 already defines them.
10. [ ] **[CI]** **Boundary holds**: the repo-root boundary tier green (R15 / AR-20).

### Measured target

Measured end to end on the current tree, not estimated:

| Build | Bytes | `__data_Main_BALLOON` |
|---|---|---|
| today | 677 | `$0A67` |
| pokes removed, pointer computed | 312 | `$08FA` |
| **+ page alignment** | **318** | **`$0900`** (block 36) |

`balloon` **677 → 318 bytes** against its twin's 251 — **2.70× → 1.27×** — with the runtime copy
gone entirely, where the hand-written twin still copies 63 bytes at startup.

Two honest qualifications:

- **On bytes the compiler does not beat the twin**; at 1.27× it remains behind. It beats the twin
  at **runtime**, by not performing a 63-byte startup copy at all.
- **The 6 bytes of padding are an accident of where the code happens to end.** Any future change
  to balloon's code size moves `$08FA` and re-rolls the padding anywhere in 0–255. M4's ratchet
  must therefore be re-derived from the aligned build at implementation time and never assumed
  from the 318 figure recorded here.
