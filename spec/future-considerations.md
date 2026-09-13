# Blend65 — Future Considerations

> **Created**: May 25, 2026  
> **Purpose**: Living document tracking deferred, resolved, and rejected language ideas.
> **Rule**: Items are added here when a design decision consciously defers functionality. Each item records what was deferred, why, and under what conditions it should be reconsidered.

---

## How to Use This Document

- When a feature evaluation defers functionality, add an entry here.
- Each entry has a **source** (the feature evaluation that created it), a **description**, and **reconsideration criteria**.
- Items are NOT promises — they are candidates for future evaluation against the Language Guard.

## Non-Normative Future-Target Constraints

The machines in this section are not Specification 4 targets. Their names are not accepted profile
IDs, and these notes provide no language, library, artifact, emulator, or hardware conformance
claim. They exist only to prevent the C64 implementation from erasing target-neutral seams.

| Future target | Constraints that a later qualification must own |
|---|---|
| C64 Ultimate | REU/DMA address spaces and visibility, turbo CPU clocks, firmware and storage APIs, physical/UltiSID topology, interrupt continuity, coordinated packaging, and Ultimate-specific evidence. Running a base-C64 artifact on compatible Ultimate hardware is not a `c64u` compiler target. This is the owned next target family. |
| Commander X16 | 65C02 instruction legality, banked RAM, VERA video/audio, KERNAL/firmware identity, startup/exit, artifact packaging, emulator configuration, and hardware evidence. |
| Atari 800XL | 6502/OS identity, ANTIC/GTIA/POKEY, banked memory and display-list ownership, IRQ/NMI routes, XEX packaging, emulator configuration, and hardware evidence. |
| Atari 7800 | 6502C bus timing, 4 KiB base RAM plus cartridge memory, MARIA DMA, TIA/RIOT slow accesses, cartridge layout/A78 packaging, startup/vectors, emulator configuration, and hardware evidence. |

A future target becomes active only with a normative appendix, a real CPU/machine/emitter/packager
path, complete core-language requalification, emulator evidence, required physical QA, and atomic
authority activation. Until then its constraints are portability review inputs only.

---

## Deferred Items

### ~~FUT-001: Address-of on struct fields and array elements~~ — ✅ RESOLVED

> **Source**: F006 (Address-of Operator), Ambiguity AO-4  
> **Resolved in**: Specification 4

**How it was resolved**: `&` accepts every real addressable storage place, including nested struct
fields and indexed array elements. Each place component is evaluated once. The result preserves
the origin's lifetime and read-only provenance, and E10260 rejects an escaping local-origin address.

---

### ~~FUT-002: Address-of on function parameters~~ — ✅ RESOLVED

> **Source**: F006 (Address-of Operator), Ambiguity AO-3  
> **Resolved in**: Specification 4

**How it was resolved**: Parameters are borrowed storage places, so `&param` returns their address
without forcing a copy. Mutability and lifetime follow the parameter contract; a caller-local
origin remains subject to E10260 on any retaining or otherwise unproven path.

---

### ~~FUT-003: First-class typed function values and indirect calls~~ — ✅ RESOLVED

> **Source**: F007 (Interrupt Functions), Ambiguity INT-2
> **Resolved in**: Specification 4

**How it was resolved**: Typed `fn(...)` values support assignment, storage, parameters, returns,
conditional selection, and indirect calls while the compiler retains a finite set of possible
source targets. E10277 rejects a call after that proof is lost. Interrupt handlers remain a
distinct, non-callable type; recognized installation sinks enforce handler ABI and LIFO ownership.

---

### ~~FUT-004: Compile-time call-graph analysis for interrupt reentrancy~~ — ✅ RESOLVED

> **Source**: F007 (Interrupt Functions), Ambiguity INT-1  
> **Deferred from**: v3  
> **Priority**: High

**What was deferred**: Analyze the call graph when a function is reachable from mainline and an
interrupt handler, instead of merely documenting possible SFA corruption.

**How it was resolved**: v3 models entry ABI and execution domain separately. It follows every
compiler-visible mainline, IRQ, NMI, bounded nested-interrupt, and callback root through its complete
helper closure. Overlapping activations receive disjoint invocation-private SFA homes. Shared
globals, assets, and MMIO remain shared; visible lost-update and torn multi-byte hazards receive
warnings. A storage-bearing path whose overlap cannot be statically bounded is rejected rather than
left to corrupt memory.

No runtime selector, dynamic stack, frame copy, hidden interrupt mask, or silent state duplication is
introduced.

---

### ~~FUT-005: Platform library type-safety for interrupt installation~~ — ✅ RESOLVED

> **Source**: F007 (Interrupt Functions), Ambiguity INT-2  
> **Deferred from**: v3
> **Priority**: Medium

**What was deferred**: Require a platform operation such as `setIRQ(&handler)` to reject an
ordinary `RTS` function where hardware will return with `RTI`.

**How it was resolved**: Compiler-recognized platform sinks preserve source-handler identity and
select the exact raw or firmware entry variant without introducing first-class function-pointer
types. Passing an ordinary function is a compile-time error. A visible raw entry written to a known
incompatible firmware vector is also rejected; a genuinely opaque address remains an unsafe proof
boundary.

Typed callable values are now resolved by FUT-003; this entry records the separate interrupt-sink
part of that completed design.

---

### FUT-006: Labeled `break` for nested loops

> **Source**: F008 (For Loop), Ambiguity FOR-16  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow `break label;` to exit multiple nested loops at once, where a label is attached to an outer loop:

```blend65
outer: for (let y: byte = 0; y < 25; y += 1) {
    for (let x: byte = 0; x < 40; x += 1) {
        if (condition) {
            break outer;    // exits both loops
        }
    }
}
```

**Why deferred**: In v3, multi-level exit is handled with a flag variable (`let found: boolean = false; ... if (found) { break; }`). This is explicit, works everywhere, and doesn't require new syntax. Labeled `break` is a convenience feature — it saves a few lines but adds grammar complexity (label declarations, label scoping rules).

**Reconsideration criteria**:
- Real-world Blend65 code frequently uses deeply nested loops with multi-level exit
- A clean label syntax is designed that doesn't conflict with other language features
- The codegen cost is minimal (labeled break compiles to a single JMP, same as regular break)

---

### FUT-007: Range cases in switch statements

> **Source**: F009 (Switch Statement), Ambiguity SW-10  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow range expressions in switch case values:

```blend65
switch (score) {
    case 0..9:
        showRankF();
    case 10..49:
        showRankC();
    case 50..89:
        showRankB();
    case 90..100:
        showRankA();
}
```

**Why deferred**: Adds grammar complexity (`..` range operator in case context), requires the compiler to expand ranges into value sets or generate range-check code (CMP + BCS/BCC patterns). The same functionality can be achieved with `if/else if` chains or multiple comma-separated values. Keeping switch minimal in v3 (Language Guard L4).

**Reconsideration criteria**:
- Real-world Blend65 code frequently switches on value ranges (score tiers, ASCII character classes, etc.)
- A clean `..` range syntax is designed that doesn't conflict with other language features
- The codegen can efficiently generate range checks (CMP low / BCC skip / CMP high+1 / BCS skip — 8 bytes per range)
- Interaction with `fallthrough` is clearly defined

---

### ~~FUT-008: Const struct parameters~~ — ✅ RESOLVED

> **Source**: F011 (Structs), Rule SR-3  
> **Resolved in**: F014 (Arrays, Strings, and Const Parameters), Part 5  
> **Resolution date**: May 26, 2026

**What was deferred**: `const` qualifier on struct/array parameters for read-only by-reference access.

**How it was resolved**: The `const` parameter modifier was implemented as part of F014 (rules CP-1 through CP-5). It applies to both arrays and structs. F011's SR-3 has been retroactively updated to support `const` parameters instead of requiring mutable copies. Error codes E10122 (const-to-mutable) and E10123 (modify const param) are defined in F014.

---

### ~~FUT-009: Address-of on struct fields~~ — ✅ RESOLVED

> **Source**: F011 (Structs), Ambiguity SR-A5  
> **Resolved in**: Specification 4

**How it was resolved**: This duplicate of FUT-001 is resolved by the same storage-place rule.
`&player.hp` and a parameter-field address are ordinary address expressions with one evaluation of
their base and with the base's provenance preserved.

---

### ~~FUT-010: Aggregate return values~~ — ✅ RESOLVED

> **Source**: F011 (Structs), Rule SR-2; F014 (Arrays), array-return rule
> **Resolved in**: Specification 4

**How it was resolved**: Fixed structs and fixed arrays are ordinary exact-shape return values.
The caller supplies a hidden destination closed through SFA, and the callee constructs directly
there when legal. Alias-safe value semantics, nested calls, lifetime, interrupt overlap, and
resource reporting are defined without a heap or generic runtime. E10093 and E10120 are retired.

---

### FUT-011: External assembly linking (`extern function`)

> **Source**: F012 (CPU Control Intrinsics), Ambiguity CC-A9  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow declaring functions implemented in external assembly files, enabling Blend65 programs to call hand-written assembly routines:

```blend65
extern function fastClear(addr: word, count: byte): void;
extern function rasterEffect(): void;
```

The assembly is written in a real assembler (KickAssembler, ca65, DASM) and linked with the Blend65 compiler output.

**Why deferred**: This needs a defined ABI and object/link contract, symbol and placement rules,
tool integration, and qualification of register, flag, stack, and memory effects. Specification 4
does not silently add that support surface.

**Reconsideration criteria**:
- Real-world Blend65 users need cycle-counted assembly sequences (demo scene, advanced raster effects)
- A simple object format and calling convention can be defined
- A linker can be implemented without excessive complexity
- The feature passes the full Language Guard evaluation

---

### FUT-012: Array copy intrinsic

> **Source**: F014 (Arrays), Gap 7  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: A built-in `copy(dst, src, count)` intrinsic for bulk memory copying between arrays:

```blend65
copy(screenBuffer, backBuffer, 1000);  // Copy 1000 bytes
```

**Why deferred**: Developers can use an explicit for loop to copy array elements. The loop approach is transparent (H2) and works for all cases. A `copy()` intrinsic would be an optimization — the compiler could use an optimized unrolled loop or page-aligned strategy. Not essential for v3's minimum viable language.

**Reconsideration criteria**:
- Real-world Blend65 code frequently copies arrays (sprite data, screen buffers, level maps)
- The compiler can recognize the copy-loop pattern and optimize it automatically
- A clean intrinsic design exists that handles overlapping source/destination correctly

---

### ~~FUT-013: Compile-time table generation~~ — ✅ RESOLVED

> **Source**: F014 (Arrays), Gap 8  
> **Resolved in**: Specification 4

**How it was resolved**: Typed `comptime function` declarations generate ordinary constant
aggregates with deterministic evaluation, exact integer trigonometry, and the fixed
`comptime-budget-v1` step, live-memory, and call-depth limits. Successful evaluation emits only
the retained constant data; failure emits no artifact.

---

### ~~FUT-014: Manual alignment attribute~~ — ✅ RESOLVED

> **Source**: F015 (Data Inclusion), Deferred Items  
> **Resolved in**: Specification 4

**How it was resolved**: The closed `place(...)` modifier supplies `at`, `align`, `noCross`, and
`region` constraints for module-level stored data and emitted functions. Automatic placement
remains the default. This solves manual alignment without introducing a general annotation system.

---

### FUT-015: Common image format conversion

> **Source**: F015 (Data Inclusion), Deferred Items  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Automatic conversion of modern image formats (PNG, BMP) to platform-native graphics data via format handlers:

```blend65
// Future: compiler converts PNG to C64 multicolor bitmap
const BITMAP: byte[8000] = embed("picture.png", "bitmap");
const SCREEN: byte[1000] = embed("picture.png", "screen");
```

**Why deferred**: Image conversion is complex (color quantization, dithering, palette mapping) and
error-prone. Retro developers already use specialized tools that produce optimized native output.
Adding modern-image conversion to the compiler would duplicate functionality that dedicated tools
do better. This deferral does not cover parsing an already-native, fixed-layout format: for example,
the C64 Koala handler validates and decomposes classic Koala bytes without quantization, dithering,
palette selection, or pixel conversion. The format handler system (F015) supports such qualified
native formats directly.

**Reconsideration criteria**:
- Community demand for a streamlined "modern art → retro platform" pipeline
- Well-defined, deterministic conversion algorithms exist for each platform's graphics modes
- The conversion quality is acceptable (no surprising artifacts)
- The feature can be implemented through a separately qualified handler without changing core syntax

---

### FUT-016: Stack-free calling convention (`--no-stack-calls`)

> **Source**: F018 (Functions), Ambiguity FN-A7, FN-A8  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: An alternative calling convention that eliminates all hardware stack usage for function calls by replacing JSR/RTS with JMP-threaded calls using static return address variables.

**How it works**: SFA can allocate a page-safe 2-byte return-address pair for each statically
selectable simultaneous activation of a function and emit the matching fixed entry/return
variant. Mainline, IRQ, NMI, callback, and other bounded overlap domains may therefore require
multiple pairs and variants for one source function. If the compiler cannot prove a finite
selection, it must retain `JSR`/`RTS` or reject an explicitly required stack-free mode. The caller
stores the return point address into its selected pair and uses `JMP`; the matching callee variant
returns through that same pair:

```asm
; Standard JSR/RTS (current v3):
  JSR _foo          ; 6 cycles, 2 bytes on hardware stack
  ; ...
_foo:
  ; ... body ...
  RTS               ; 6 cycles, pops 2 bytes from stack

; Stack-free JMP-threaded (FUT-016):
  LDA #<(.ret)      ; 2 cycles
  STA foo_ret_lo    ; 4 cycles
  LDA #>(.ret)      ; 2 cycles
  STA foo_ret_hi    ; 4 cycles
  JMP _foo          ; 3 cycles — total: 15 cycles, 0 stack bytes
.ret:
_foo:
  ; ... body ...
  JMP (foo_ret)     ; 5 cycles — total: 20 cycles, 0 stack bytes
```

**Tradeoffs**:

| Aspect | JSR/RTS (v3 default) | JMP-threaded (FUT-016) |
|--------|---------------------|------------------------|
| Stack usage per call | 2 bytes | 0 bytes |
| Static RAM per allocated activation variant | 0 bytes | 2 bytes |
| Call overhead | 12 cycles | ~20 cycles |
| Code size per call site | 3 bytes | ~11 bytes |
| JMP indirect bug (NMOS 6502) | N/A | Must avoid page boundary |

**Hybrid strategy**: The compiler could choose per-function:
- Single-caller functions → JMP threading with hardcoded return (zero overhead)
- Tail calls → `JMP` instead of `JSR` (zero additional stack)
- Multi-caller functions → JSR/RTS (simplest, fastest)

Every cost is reported per allocated activation/entry variant. ROM and static RAM multiply when
the same source function needs several simultaneous homes; “no recursion” alone never proves that
one source function can be active only once.

**Why deferred**: JSR/RTS is faster, smaller, and the standard approach. Typical game code uses 10-30 bytes of the 256-byte hardware stack — well within budget. The stack-free approach is only valuable for extreme cases (very deep call chains, interrupt-heavy code on Atari 7800 with 4KB RAM).

**Reconsideration criteria**:
- Real-world Blend65 programs encounter stack overflow issues
- Profiling shows that stack-free calling improves performance for specific game patterns
- The JMP indirect page-boundary bug can be reliably worked around in codegen
- A clean `--no-stack-calls` compiler flag can be implemented without changing language semantics

---

### FUT-017: Optimization barrier intrinsic (`barrier()`)

> **Source**: F020 (Memory Intrinsics), Ambiguity MI-A2  
> **Deferred from**: v3  
> **Priority**: Low

**What**: A `barrier()` intrinsic that prevents the optimizer from reordering regular variable operations across the barrier point. Unlike peek/poke (which are always side-effectful by MI-1), variable access is optimizable — `barrier()` would be the mechanism to selectively prevent this.

```blend65
score = score + 10;
barrier();           // Optimizer must not move operations across this point
lives = lives - 1;
```

**Why deferred**: In v3, peek/poke ordering is guaranteed by MI-1, and asm_*() calls act as implicit barriers (F012 CC-3). Barrier for regular variable reordering is only needed when the optimizer performs cross-statement reordering — a feature that doesn't exist yet. The stub optimizer does nothing, so barrier() would be a no-op.

**Reconsideration criteria**:
- The optimizer implements cross-statement reordering or instruction scheduling
- Real-world code needs to enforce variable operation ordering for correctness
- Can be added as a simple parameterless void function following the F012 pattern (zero grammar changes)

---

### FUT-018: Separate volatile memory intrinsics

> **Source**: F020 (Memory Intrinsics), Ambiguity MI-A1  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Separate `volatile_read(addr)` and `volatile_write(addr, val)` functions that are guaranteed side-effectful, alongside potentially optimizable `peek()`/`poke()` variants.

**Why deferred**: In v3, ALL peek/poke are side-effectful by design (MI-1). On 6502, the compiler cannot distinguish RAM from I/O hardware registers — any address could be either. Making all peek/poke volatile is the safe, simple default. Separate volatile variants would only be useful if a future optimizer could prove certain peek/poke addresses are pure RAM, allowing elimination of redundant reads. This requires sophisticated address analysis that doesn't exist.

**Reconsideration criteria**:
- The optimizer can prove address ranges are pure RAM (e.g., via platform profile memory maps)
- Profiling shows peek/poke volatility prevents meaningful optimizations
- A clean `volatile` qualifier or attribute syntax exists without adding API surface

---

### ~~FUT-019: Exclusive-descending range keyword for `for` loops~~ — ✅ RESOLVED

> **Source**: F013/F008 (Statements & Control Flow), Ch 05 §7.2  
> **Resolution**: Three-clause `for` loop replaces range keywords

**What was deferred**: Add a fourth range keyword that descends while excluding its end bound.

**How it was resolved**: Blend65 removed the range-only loop syntax and adopted
`for (initializer; condition; update)`. Descending inclusion or exclusion is written directly in
the Boolean condition, so a separate range keyword would duplicate the same behavior and recreate
a second loop grammar.

---

## Summary Table

| ID | Description | Priority | Depends On |
|----|-------------|----------|------------|
| ~~FUT-001~~ | ~~`&` on struct fields / array elements~~ — ✅ RESOLVED | — | — |
| ~~FUT-002~~ | ~~`&` on function parameters~~ — ✅ RESOLVED | — | — |
| ~~FUT-003~~ | ~~Typed function values and indirect calls~~ — ✅ RESOLVED | — | — |
| ~~FUT-004~~ | ~~Call-graph reentrancy analysis~~ — ✅ RESOLVED (execution-domain SFA) | — | — |
| ~~FUT-005~~ | ~~Type-safe interrupt installation~~ — ✅ RESOLVED (recognized platform sinks and entry variants) | — | — |
| FUT-006 | Labeled `break` for nested loops | Low | — |
| FUT-007 | Range cases in switch statements | Low | — |
| ~~FUT-008~~ | ~~Const struct parameters~~ — ✅ RESOLVED (F014) | — | — |
| ~~FUT-009~~ | ~~Address-of on struct fields~~ — ✅ RESOLVED | — | — |
| ~~FUT-010~~ | ~~Aggregate return values~~ — ✅ RESOLVED | — | — |
| FUT-011 | External assembly linking (`extern function`) | Low | F012 |
| FUT-012 | Array copy intrinsic (`copy()`) | Medium | F014 |
| ~~FUT-013~~ | ~~Compile-time table generation~~ — ✅ RESOLVED | — | — |
| ~~FUT-014~~ | ~~Manual alignment attribute~~ — ✅ RESOLVED | — | — |
| FUT-015 | Common image format conversion | Low | F015 |
| FUT-016 | Stack-free calling convention (`--no-stack-calls`) | Medium | F018 |
| FUT-017 | Optimization barrier intrinsic (`barrier()`) | Low | F020 |
| FUT-018 | Separate volatile memory intrinsics | Low | F020 |
| ~~FUT-019~~ | ~~Exclusive-descending range keyword for `for` loops~~ — ✅ RESOLVED (three-clause for) | — | — |

---

## Rejected Features

> Items in this section were evaluated and **consciously rejected** — they are NOT pending or deferred.
> A rejected feature has a permanent decision record. It will only be revisited if its explicit
> reconsideration bar is met. Rejected feature IDs are **retired** and never reused.

### REJ-001: Type aliases (`type Name = ExistingType;`)

> **Status**: ❌ REJECTED  
> **Source**: F023 evaluation (never formalized into a feature file)  
> **Rejected from**: v3  
> **Retired feature ID**: F023

**What it was**: A declaration that gives an existing type a second name, e.g.
`type SpriteId = byte;` or `type ScreenBuffer = byte[1000];`. The alias would be
**transparent** — `SpriteId` and `byte` would be fully interchangeable, with the alias
erased to its underlying type during semantic analysis (as sketched in F016 TS-A6 and v2 §2).

**Why rejected**:
1. **No type safety.** Transparent aliases enforce nothing — a raw `byte`, a literal, or any
   other alias of `byte` is accepted anywhere a `SpriteId` is expected. It looks like a type
   but provides zero checking.
2. **Conflicts with the nominal-typing stance.** F022 enums were deliberately made *nominal*
   (a distinct type requiring an explicit cast). A transparent alias is the opposite philosophy
   and would sit awkwardly beside enums.
3. **Obscures cost on constrained platforms.** The most-wanted case, `type Buffer = byte[1000]`,
   hides a large allocation behind a friendly name — working against F016's "the type IS the
   design decision" thesis and the Language Guard's cost-transparency rules (H2, H4). On a 4KB
   Atari 7800 this is actively harmful.
4. **Redundant with good naming.** A well-named declaration (`spriteIndex: byte`) communicates
   the same intent without adding a language feature, a declaration form, and new error codes.
5. **Audience.** Blend65 targets close-to-the-hardware developers on deliberately constrained
   platforms. They name things precisely and do not need synonym sugar (Language Guard L4, L5).

**Status of the `type` keyword**: The `type` keyword **remains reserved** (F021 LS-9). It is
retained to protect future type-related syntax. Using `type` as an identifier is a syntax error.

**Reconsideration bar** (high): Only revisit if v3 later gains complex composite types — for
example function-pointer types or fixed-string types — where aliasing earns real ergonomic value.
Even then, prefer a **nominal newtype** (a distinct type, like enums) over a transparent alias.

---

### REJ-002: Inline assembly (`asm { }` blocks and the full 6502 `asm_*()` opcode API)

> **Status**: ❌ REJECTED  
> **Source**: F012 (CPU Control Intrinsics), Ambiguities CC-A1 and CC-A2  
> **Rejected from**: v3  
> **Related future item**: External assembly linking — see FUT-011

**What it was**: Two related ways of exposing raw 6502 assembly to Blend65 programmers,
both inherited from / sketched in v2:

1. **`asm { }` blocks** — an embedded-assembly construct allowing arbitrary 6502 source
   inside a Blend65 function body (as in v2's "ASM Functions" concept taken to its block form).
2. **The full `asm_*()` opcode API** — the v2 approach of exposing all ~150 opcode/addressing-mode
   combinations as individual intrinsic functions (`asm_lda_imm`, `asm_sta_abx`, `asm_beq_rel`, …).

**Why rejected**:

1. **`asm { }` blocks demand an embedded assembler.** They require a lexer mode switch (assembly
   uses `#` for immediates, `:` for labels, `;` for comments), a separate parser, a symbol-table
   bridge so assembly can reference Blend65 variables, register-ownership negotiation (clobber lists,
   save/restore contracts), and label-scoping rules. This is enormous compiler complexity with
   treacherous design interactions (Language Guard C1, C2, L8).
2. **The full opcode API can't actually write tight assembly.** Branch intrinsics like
   `asm_beq_rel(offset)` need the developer to hand-calculate byte offsets, which is impossible
   without knowing assembled code sizes — so the one thing raw assembly is *for* (cycle-counted
   loops) still doesn't work.
3. **Register interference.** `asm_lda_imm(42)` loads A, but the compiler's codegen for the next
   Blend65 statement may clobber A immediately. There is no register-ownership contract between
   `asm_*()` calls and compiled code.
4. **The language already covers 95%+ of it.** Load/store → variables + peek/poke. Arithmetic →
   `+ - & | ^ << >>`. Comparisons → `== != < >`. Control flow → `if`/`while`/`for`/`switch`.
   Increment/decrement → `+= 1` / `-= 1`. A 150-function API is a huge API + test surface for
   incomplete coverage of things the language expresses better (Language Guard L4, L5).

**Chosen alternative**: The exact five parameterless **CPU control intrinsics** in F012 are
`asm_sei`, `asm_cli`, `asm_php`, `asm_plp`, and `asm_nop`. They expose only stable machine effects
that ordinary typed source cannot express. Packed-decimal arithmetic is separate and compiler-owned.

Packed-decimal source uses the separate `bcd_add()` and `bcd_sub()` semantic operations. They
lower inline while ordinary `+` and `-` remain binary; they do not expand the raw opcode API.

External assembly remains the deferred FUT-011 proposal. It is not a current language form or a
sanctioned escape path in Specification 4.

**Reconsideration bar** (high): Only revisit if real-world Blend65 code repeatedly needs
cycle-counted assembly sequences that FUT-011 external linking cannot satisfy, AND a design exists
that resolves the register-ownership and label-scoping problems above without an embedded assembler.
