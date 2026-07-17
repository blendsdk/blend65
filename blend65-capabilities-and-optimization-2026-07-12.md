# Blend65 — Capabilities, Game Feasibility & the Path to Optimized / Cycle-Exact Codegen

**Date:** 2026-07-12
**Branch:** v3
**Companion to:** `blend65-status-2026-07-12.md` (the RD/slice status snapshot)
**Purpose:** Forward-looking analysis of what the compiler can produce, whether commercial-grade
C64 games are reachable, and how to get toward optimized and cycle-exact codegen. Target read as
**c64** throughout (the C65 is not a Blend65 platform).

---

## 1. What you can build after RD-18 (c64)

Everything today ends in "compute a value and `RTS`." **Slice 8** (the last RD-18 slice) adds the
primitives that turn Blend65 into a language for *real* programs:

| Slice 8 primitive | Enables |
|---|---|
| `interrupt` functions + `pokew($0314, &onIRQ)` | Raster / timer IRQ handlers — demos, music players, smooth games |
| `&` address-of | Install vectors, pass addresses to hardware |
| `zeropage {}` blocks | Hot variables in fast/small ZP |
| strings + `embed()` | Bundle charsets, sprites, SID tunes, level data as binary assets |
| non-terminating `main` | The game / event loop itself |
| `asm_*` CPU-control intrinsics end-to-end | Proper IRQ setup, state save/restore, flag/decimal control |

Combined with `peek`/`poke`/`peekw`/`pokew` on any address (VIC-II `$D000`, SID `$D400`, CIA
joystick/keyboard `$DC00`, screen RAM `$0400`), you get the classic **"bank out ROM, hit the metal"**
C64 model.

### Program classes

| Program class | Feasible? | Relies on |
|---|---|---|
| Raster demos (border/background splits, color bars) | ✅ Yes | `interrupt`, poke VIC-II |
| Sprite toys / simple games (sprites, joystick, collisions, entity structs/arrays) | ✅ Yes | non-terminating `main`, peek CIA, poke VIC-II, aggregates |
| SID music / SFX players | ✅ Yes | `interrupt`, `embed()`, poke SID |
| Charset / bitmap graphics, text UIs | ✅ Yes | `embed()`, poke, arrays |
| Data-driven programs (embed levels/tables/graphics) | ✅ Yes | `embed()`, aggregates, pointers |
| Hardware register tools / experiments | ✅ Yes | peek/poke, `&` |
| Cycle-tight, effect-heavy demos (stable rasters, FLI, heavy per-frame logic) | ⚠️ Maybe | limited by *unoptimized* codegen speed |

---

## 2. Hardware-access model (and the `asm_*` correction)

Blend65 reaches the machine through **three** channels — not inline assembly:

1. **Memory-mapped access** — `peek`/`poke` (byte) and `peekw`/`pokew` (word) on any address (T2,
   `availability: ALL`, lowered inline). This is how you read/write hardware registers.
2. **`interrupt` vectors** — install handlers via `pokew($0314, &onIRQ)` (Slice 8).
3. **Curated CPU-control intrinsics** (`asm_*`) — the chosen alternative to inline asm.

### The `asm_*` CPU-control set (Chapter 12 / F012)

13 parameterless `void` intrinsics (+ `asm_wai` on 65C02), **each one Implied-mode opcode, zero
overhead** — covering "operations the language cannot express":

| Group | Intrinsics | Opcodes |
|---|---|---|
| Interrupt control | `asm_sei` `asm_cli` | SEI / CLI |
| Hardware stack | `asm_pha` `asm_pla` `asm_php` `asm_plp` | PHA / PLA / PHP / PLP |
| Carry flag | `asm_clc` `asm_sec` | CLC / SEC |
| Decimal mode | `asm_cld` `asm_sed` | CLD / SED |
| Overflow flag | `asm_clv` | CLV |
| Timing / debug | `asm_nop` `asm_brk` | NOP / BRK |
| 65C02 only (cx16) | `asm_wai` | WAI |

**Status in repo:** descriptors are in the catalog (`catalog.d.ts` — "22 Ch 12 names + `asm_wai`");
name→opcode mapping is in `translate.ts:121`. The full validated end-to-end path (incl. use inside
interrupt prologues) is owned by **RD-18 Slice 8** (`RD-18 …:135`).

### What is NOT available (REJ-002 — deliberate)

- **No `asm { }` blocks** and **no full ~150-opcode API** (`asm_lda_imm`, `asm_sta_abx`, …). Rejected
  because hand-calculated branch offsets are unworkable and per-opcode intrinsics interfere with the
  compiler's own register codegen (`spec/future-considerations.md:512`).
- **No `sys()` / `call()`** to `JSR` an arbitrary address or KERNAL routine. The `call` token in the
  codebase is only the *internal* lowering strategy for runtime math (e.g. `__rt_mul8`), not a
  user-facing primitive.
- **Integer-only** language (`byte`/`sbyte`/`word`/`sword`; no floats; signed `/`/`%` rejected).

Consequence: no KERNAL-mediated file I/O or print routines — you poke screen RAM directly and drive
hardware via registers, `asm_*`, and interrupt vectors.

---

## 3. Can we build full games? (Frogger / Commando / The Last Ninja)

There is no single "point" — it's a gradient across three gates, and only the first is on the
current roadmap.

### The three gates

| Gate | What it is | On the roadmap? |
|---|---|---|
| **1. Language expressible** | RD-18 Slice 8 (interrupts, `&`, `embed()`, `zeropage`, strings, non-terminating `main`, `asm_*`) | ✅ Yes — the last codegen slice |
| **2. Fast / small enough** | The **Phase-B optimizer** (RD-06 IL passes + RD-08 real peephole catalog) | ❌ No — explicitly deferred to Phase B, *after* the 18 RDs |
| **3. Engine + missing capabilities** | Sprite multiplexer, scroller, music player, depacker, disk loader — written in-language and fast | ❌ Not planned as any RD |

Gate 2 is the crux: RD-18's charter is literally *"100% working **unoptimized** codegen."* Peephole
is passthrough v1; the IL optimizer does nothing.

### Per-game reality

| Game | Difficulty | Feasible when | Blocker |
|---|---|---|---|
| **Frogger** | Modest — single screen, grid movement, few sprites, not cycle-tight | ✅ **After RD-18 Slice 8** (comfortable after Phase B) | The realistic "first real game" tier — the roadmap's end reaches it |
| **Commando** | Hard — smooth hardware scroll + sprite multiplexing (>8 sprites via raster IRQs) + music-under-SFX, all cycle-tight | ⚠️ **RD-18 + Phase-B optimizer + a hand-written engine** | Gate 2 — unoptimized codegen won't hold the raster |
| **The Last Ninja** | Elite — isometric engine, heavy compressed graphics, disk-streamed levels | 🔴 **Far out** — needs Gates 1+2+3 *and* capabilities not planned (fast loaders/depackers ≈ IRQ-driven asm) | Gates 2+3 plus missing capabilities |

### What "finishing the roadmap" buys you

RD-18 + RD-13 + RD-14 done = a **complete, correct, editor-supported but UNOPTIMIZED** compiler for
the whole language. Enough for a **Frogger-class game**. **Commando** needs the step *after* the
roadmap (Phase-B optimizer) plus a substantial engine you write. **The Last Ninja** additionally needs
subsystems that touch capabilities Blend65 deliberately doesn't provide today.

### Two ceilings that don't go away by "finishing"

1. **The optimizer is a separate era** (Phase B) — arguably larger than any single remaining RD.
2. **Cycle-exact code was always assembly.** The tightest paths (stable rasters, VSP/AGSP scroll,
   multiplexer inner loop) were hand-counted opcode-by-opcode. Blend65 has no inline-asm escape hatch
   by design — so even with a great optimizer, the very tightest effects need compiled approximations
   or a timed-block primitive (see §4), not matched hand-assembly.

---

## 4. Toward optimized & cycle-exact codegen

### Split the goal — the two pull in opposite directions

| Goal | Meaning | How you get it |
|---|---|---|
| **Fast / small** | Fewer cycles on average; holds the raster because there's *slack* | Classic optimizer (Phase B) |
| **Cycle-*exact*** | *Deterministic* timing — this block takes exactly N cycles every time (stable rasters) | Cycle-accounting + padding, **not** the optimizer |

Key insight: a general optimizer makes cycle-*exactness* **harder** (it transforms code so you can no
longer reason about a source line's cycle cost). Most games want **fast-with-slack everywhere + a few
hand-timed critical sections**, not exactness everywhere.

### The architecture is already the right shape

- **IL = flat three-address code over basic blocks with numbered temps** (`il/instruction.ts`,
  `il/cfg.ts` — `BasicBlock`, `tempCount`). The textbook machine-independent optimization surface.
- An **`il/optimizer/` pass framework is already scaffolded** (`optimize-il.ts`, `pass.ts`) — waiting
  for passes.
- The **Instr** stream is the target-specific / peephole surface. It tracks **byte size**
  (`instrByteSize`) precisely, but **not cycle counts yet** — cycles live only on intrinsic
  descriptors + prose estimates. That per-opcode cycle table is the missing foundation for the
  cycle-exact track.

So: do machine-independent classics on IL, do 6502-specific opts on the Instr stream / peephole. The
passes just aren't written — that is the whole of Phase B.

### Which "40 years of technique" transfers — reweighted for the 6502

The 6502 has ~3 non-general registers and zero page *is* the register file, so the classic ranking
shifts:

| Technique | ROI on 6502 | Why |
|---|---|---|
| **Peephole / instruction selection** | 🟢 Huge | Naive codegen is wildly redundant (reload-after-store, `CLC/ADC #1` vs `INC`, flag ops before branches). Cheapest, biggest immediate win. RD-08's designated home. |
| **Local value tracking** (keep values in A/X/Y + ZP scratch across statements) | 🟢 Huge | #1 source of unoptimized bloat is round-tripping every subexpression through frame memory. "Register allocation" retargeted to a 3-reg + ZP model. |
| **Strength reduction / induction vars** (`a[i]` → pointer inc; `×const` → shifts/adds) | 🟢 High | No hardware multiply; turning index math into `(zp),Y` increments is enormous. |
| **Const/copy propagation, CSE, DCE, loop-invariant motion** | 🟢 High | Target-independent, operate on the three-address IL directly. |
| **Global graph-coloring register allocation** | 🟡 Lower | Almost nothing to color *into*; the win is memory-traffic reduction, not classic RA. |
| **6502-native: self-modifying code, jump tables, table-driven arithmetic, unrolling** | 🟢 High | Not in the classic canon but where the real 6502 wins live (SMC patches operands vs indirect addressing). |

### Prior art proves it works on this exact CPU

- **llvm-mos** — retargets the full modern LLVM optimization pipeline to 6502, modeling zero page as
  registers; genuinely competitive code (years of target work).
- **KickC** — SSA-based, allocates values into ZP as registers. *Almost exactly the Blend65 problem.*
- **oscar64**, **Millfork**, **cc65** — a spectrum from strongly-optimizing to mature-but-naive.

### The cycle-*exact* path (a separate track, not the optimizer)

1. **Per-opcode cycle table** — well-defined 6502 data; the sibling of the existing byte table.
2. **Cycle-accounting / WCET pass** — loop-free interrupt handlers (raster splits) are *exactly*
   computable; branches give a min/max range; loops need bounds.
3. **A `timed { }` / pad-to-N-cycles primitive** — the compiler inserts `NOP`s / timing loops to hit
   an exact count and warns if the body already exceeds it. Because Blend65 forbids inline asm by
   design, this padding construct is the deliberate HLL substitute for hand-counting.

### Recommended work order (highest ROI, lowest risk first)

1. **Fill the RD-08 peephole catalog** — designated, scaffolded, low-risk; dramatically shrinks/speeds
   today's output on its own (redundant load/store elimination, `INC`/`DEC` substitution,
   branch-combining, dead-store removal).
2. **Add local value / ZP-scratch allocation** on the IL so values stay in A/X/Y across statements
   instead of hitting frame slots. Biggest structural win; higher effort.
3. **Wire standard IL dataflow passes** into `il/optimizer/`: const/copy propagation → CSE → DCE →
   loop-invariant motion → induction-variable strength reduction (the last makes indexed loops fast).
4. **6502-native passes:** jump tables for `switch`, unrolling, table multiply, SMC for indirect access.
5. **Cycle-exact track (separate):** opcode cycle table → WCET pass → `timed{}` / pad primitive.

### Bottom line

Optimization (steps 1–4) turns "correct" into "fast enough to hold the raster with slack" — the path
to Commando-tier. True cycle-exactness (step 5) is a distinct, very achievable feature built on
cycle-accounting + padding, aimed at the few hot handlers where it matters. **All of §4 — plus
Commando/Last Ninja — is Phase-B-and-beyond and NOT on the current 18-RD roadmap.** But the compiler
is already built on the right IR (three-address IL + scaffolded pass framework), and other 6502
compilers have walked this exact road.

---

## 5. Where this sits versus the roadmap

- **Current 18-RD roadmap end** (RD-18 all slices + RD-13 NFR + RD-14 LSP) = a correct, unoptimized,
  editor-supported full-language compiler ≈ **Frogger-tier games**.
- **Phase B** (RD-06 IL optimizer passes + RD-08 real peephole catalog + additional platforms) is a
  *separate* effort, not counted in the 18 RDs → the path to **Commando-tier**.
- **Engine/library ecosystem + loader/streaming capabilities** (multiplexer, scroller, depacker, disk
  loader; some not currently planned) → the path toward **Last Ninja-tier** — a multi-year horizon.

---

## Verified references (grounded this session)

- Intrinsic catalog (user-visible): `peek` `poke` `peekw` `pokew` `lo` `hi` `sizeof` `offsetof`
  `length` — `packages/core/src/intrinsics/catalog.ts`; `call` is only `loweringStrategy: "call"`
  (`catalog.ts:79`), not a user primitive.
- `asm_*` set + opcodes: `packages/codegen/src/instr/translate.ts:121`; catalog note
  `packages/core/dist/intrinsics/catalog.d.ts` ("22 Ch 12 names + `asm_wai`"); spec
  `spec/12-intrinsics.md`, `spec/grammar.ebnf.md:385`.
- Inline-asm rejection: `spec/future-considerations.md:512` (REJ-002).
- IL = three-address / basic blocks / temps: `packages/codegen/src/il/instruction.ts`,
  `packages/codegen/src/il/cfg.ts`; optimizer scaffold `packages/codegen/src/il/optimizer/`.
- Instr byte costs (no cycle table yet): `packages/codegen/src/instr/print-instr.ts:239`
  (`instrByteSize`); `programByteSize` in `instr-program.ts:223`.
- Optimizer deferred to Phase B: roadmap MVP-critical-path section + RD-06 / RD-08 rows in
  `codeops/features/blend65-ri/00-roadmap.md`.
- Slice 8 owns interrupts / `&` / `embed()` / `zeropage` / strings / `asm_*` end-to-end:
  `codeops/features/blend65-ri/requirements/RD-18-codegen-language-completion.md:135,412`.
