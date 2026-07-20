# RD-03: Placement — Align Const Data and Read It In Place

> **Document**: RD-03-placement.md
> **Status**: Draft
> **Created**: 2026-07-20
> **Project**: blend65 — Asm-Parity Initiative
> **Issue**: [#49](https://github.com/blendsdk/blend65/issues/49) (placement slice; the `copy()`
> slice and the wider hardware-access work stay out of scope — AR #64)
> **Depends On**: RD-01 (parity instruments, ✅), RD-02 (twin corpus + scoreboard, ✅)
> **CodeOps Skills Version**: 3.10.0

---

## Feature Overview

The corpus's single largest divergence is `balloon`: **677 bytes against its twin's 251**, and
the whole gap is one mistake repeated 63 times.

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
There is no runtime cost."* Measured, that data lands at `$0830`, comfortably inside VIC bank 0
(`$0000–$3FFF`) — the bank the chip already reads from. It is copied for one reason only: a
sprite pointer addresses 64-byte **blocks**, and `$0830` is not on a block boundary.

So `$0340` was never a requirement. Block 13 is simply what the hand-written twin chose. Any
aligned address inside the bank works, and the data section already qualifies but for the
alignment.

This RD makes the compiler place such data where the hardware can read it, and lets the program
name it. It is **grammar-free**: no new syntax, no change to `spec/`, no Language Guard
evaluation — every language surface it uses (`embed`, `&`, `hi`, `poke`) is already in frozen
v3.0.

### What this is not

It is **not** `copy()`. FUT-012 (`spec/future-considerations.md:231`) defers an array-copy
intrinsic from v3, and adding one means editing `spec/` — forbidden by decision D3 during
compiler implementation — plus a full 23-rule Guard evaluation. That gate is real and this RD
does not touch it. It also makes it *less* urgent: with placement, `copy()` becomes a genuine
optimization rather than the only way to express the program (AR #64).

---

## Functional Requirements

### Must Have

**M1 — A const array whose address is taken is page-aligned.**
When a program takes the address of a `const` array (via `&`), the compiler emits that array at a
256-byte boundary. An array whose address is never taken is **not** aligned and pays no padding.

The rule is source-observable and carries meaning rather than convenience: taking a const array's
address is the program declaring that something other than the compiler's own indexed access will
read those bytes — hardware, or a pointer — which is exactly when placement matters (AR #65).

**M2 — Alignment is page (256-byte), not block (64-byte).**
A sprite pointer is `address / 64`, and v3 offers no way to name that quantity. It does offer
`hi()`, which is `address / 256` and is specified to fold at compile time
(`spec/12-intrinsics.md:174`), so `hi(&X) * 4` equals `address / 64` **only when the address is a
multiple of 256**. Page alignment is what makes this expressible without new syntax (AR #68).

**M3 — Alignment is emitted, not assumed.**
The compiler emits an explicit assembler alignment directive ahead of the aligned stream rather
than computing an absolute address. Absolute addresses are not known at serialization time; the
assembler resolves them.

**M4 — No fixture regresses.**
Corpus total bytes must strictly decrease and **no individual fixture may grow**. A fixture that
grows is a stop, not a budget bump. Every affected `bytes` ratchet is re-derived in the same
change (AR #66, and the discipline of AR #4/#12).

**M5 — `balloon` reads its sprite in place.**
`examples/balloon/main.blend` loses all 63 staging pokes and sets its sprite pointer from the
embedded array's own address. The program copies **nothing** at runtime.

**M6 — The emitted geometry is reported.**
Padding is visible in the build summary, so a developer can see what alignment cost them. Silent
padding would make M4's ratchet the only signal that anything happened.

**M7 — The corpus invariants still hold.**
The permanent layout scan (RD-05's ST-B39/B40/B43/B44) stays green: padding must not introduce a
shape those invariants forbid, and the goldens regenerate cleanly.

### Should Have

**S1 — Any other fixture that stages hardware-read data in place.** If a corpus program can drop
a copy the same way, it does, in the same change.

### Won't Have (Out of Scope)

- **`copy(dst, src, count)`** — FUT-012, deferred from v3; needs a `spec/` edit (D3) and a Guard
  evaluation (AR #64).
- **An alignment attribute (`@align(n)`)** — FUT-014; needs attribute syntax that v3 deliberately
  removed. M1's address-taken rule exists precisely to avoid needing it.
- **Arbitrary placement at a chosen absolute address** (e.g. forcing data below the PRG load
  base). A single-load PRG cannot place below its own load address; that is what the twin's copy
  exists for, and it is not what this RD replaces.
- **Format handlers / `embed(...).selector`** — specified (EMB-5) but **entirely unimplemented**:
  no `FormatHandler` type in `core/platform` or `packages/platforms`, `E10203` absent from the
  frontend. Building them is its own RD.
- **Improving `hi(&X)`'s codegen** — routed to #58/#60 (AR #67); see Known Divergence below.
- **Runtime-address `poke`** — `E10045` restricts `poke` to a literal address, though the frozen
  spec specifies the runtime case (`spec/12-intrinsics.md:159`). That is a real unimplemented-spec
  gap, but placement removes the need for it *here*; it belongs with #49's wider slice.

---

## Technical Requirements

### The alignment directive (complexity: S)

`AcmeDirective` (`packages/core/src/instr-model/stream.ts:37-44`) has `origin`, `symbolDef`,
`byte`, `word`, `text`, `fill`, `outputFile` — **no alignment variant**. One must be added.

This is an additive change to `@blend65/core`'s instruction model. It is **not** a change to
`spec/`, which is the *language* specification — D3 is unaffected and `git status --porcelain
spec/` stays empty.

`origin` and `fill` are not substitutes: both need an absolute address or a byte count that is
only known once the assembler has laid the program out. ACME's native `!align` was verified to
assemble.

### Deciding which arrays are aligned (complexity: S)

The address-taken set must be computed before serialization. `&` on a const array already lowers
correctly — verified: it emits `LDA #<__data_Main_BALLOON` / `LDA #>__data_Main_BALLOON`.

### Emission (complexity: S)

`serialize-acme.ts` currently concatenates const-data streams after the code with a comment
header per stream (`:125-129`). The aligned ones gain a directive ahead of them.

---

## Integration Points

### Packages touched

`@blend65/core` (the new directive), `@blend65/codegen` (marking + emission),
`@blend65/test-harness` (goldens, budgets, scoreboard), `examples/balloon`.

R15 holds: neither `@blend65/frontend` nor `@blend65/language-server` gains a codegen import.

### With RD-05 (block layout, ✅)

RD-05's permanent corpus scan is the guard for M7. Its budget-ratchet discipline — every
program's `bytes` re-derived, not just the windowed ones (AR #56) — is the mechanism M4 relies on.

### With #58/#60 (constant materialization)

`hi(&X) * 4` works but materializes the whole address first (see Known Divergence). Closing that
is #58/#60's, not this RD's (AR #67).

---

## Known Divergence, stated up front

`poke($07F8, hi(&BALLOON) * 4)` compiles today and emits:

```asm
LDA #<__data_Main_BALLOON
STA scratch
LDA #>__data_Main_BALLOON
STA scratch+1
LDA scratch+1
ASL
ASL
STA $7F8
```

A hand-coder writes four instructions: `LDA #>balloon` · `ASL` · `ASL` · `STA $07f8`. The extra
five come from materializing the full 16-bit address into a scratch pair before `hi()` reads its
high byte. This RD **does not** close that — it is a constant-materialization defect and is
routed to #58/#60 (AR #67) — but it is recorded here so the residual is attributed rather than
discovered later.

---

## Security Considerations

No new runtime surface, no I/O, no user input. The one safety-relevant property: alignment must
never *overlap* two data streams or place data outside the target's writable region. The
assembler's own layout resolves addresses, and the existing resource report's budget check
(`programByteSize`) bounds total size.

---

## Acceptance Criteria

1. [ ] **A const array whose address is taken is page-aligned**: its emitted address is a
   multiple of 256, verified through the symbol map, and the alignment is emitted as an
   assembler directive rather than a computed absolute address.
2. [ ] **A const array whose address is never taken is not aligned** and costs zero padding.
   Proven on the current corpus, where no fixture takes an address: `slice7`, `slice7b` and
   `slice8b` must be **byte-identical** to their pre-RD-03 goldens.
3. [ ] **`hi(&X) * 4` names the sprite block correctly**: for a page-aligned `X`, the value
   written equals `address / 64`, asserted against the symbol map rather than against a
   hard-coded block number.
4. [ ] **`balloon` copies nothing**: no staging pokes remain, its emitted assembly contains no
   copy of the sprite bytes, and the sprite data appears in the binary exactly once.
5. [ ] **`balloon` renders correctly on VICE 3.10**: its existing observable set — sprite at
   (174, 141) after one frame body, image block byte-identical to the committed asset, every
   sprite register at its source-mandated value — passes unchanged. The observables are the
   proof that the VIC is reading real sprite data at the new address.
6. [ ] **No fixture regresses**: corpus total bytes strictly decrease; no individual program
   grows; every `bytes` ratchet re-derived in the same change; the four budget windows and the
   scoreboard regenerated with the freshness gate green.
7. [ ] **The corpus invariants hold**: RD-05's ST-B39/ST-B40/ST-B43/ST-B44 scan stays green over
   the regenerated goldens.
8. [ ] **`spec/` untouched**: `git status --porcelain spec/` empty (D3), and no new language
   syntax is introduced — the change uses only `embed`, `&`, `hi` and `poke` as frozen v3.0
   already defines them.
9. [ ] **Padding is visible**: the build summary reports alignment padding, so its cost is
   legible without diffing a binary.
10. [ ] **Boundary holds**: the repo-root boundary tier green (R15 / AR-20).

### Measured target

`balloon` **677 → ~312 bytes** against its twin's 251 — **2.70× → ~1.24×**, and the runtime copy
gone entirely, where the hand-written twin still copies 63 bytes at startup. This is one of the
few places the compiler is expected to **beat** the hand-written reference.

*(The 312 figure was measured by building balloon with the pokes removed and the pointer
computed, with the data unaligned — so the byte count is real but the sprite would not yet
render. Alignment is the missing piece, and AC-5 is what proves it.)*
