# Blend65 v3 — Future Considerations

> **Created**: May 25, 2026  
> **Purpose**: Living document tracking features explicitly deferred from v3 for potential inclusion in future versions.  
> **Rule**: Items are added here when a design decision consciously defers functionality. Each item records what was deferred, why, and under what conditions it should be reconsidered.

---

## How to Use This Document

- When a feature evaluation defers functionality (e.g., "not in v3 — keep it minimal"), add an entry here.
- Each entry has a **source** (the feature evaluation that created it), a **description**, and **reconsideration criteria**.
- Items are NOT promises — they are candidates for future evaluation against the Language Guard.

---

## Deferred Items

### FUT-001: Address-of on struct fields and array elements

> **Source**: F006 (Address-of Operator), Ambiguity AO-4  
> **Deferred from**: v3
> **Priority**: Medium

**What**: Allow `&myStruct.field` and `&buffer[5]` to return the memory address of a struct field or array element.

**Why deferred**: Keeps the `&` operator minimal in v3 (Language Guard L4). Computing field/element addresses can be done manually with `&variable + offset`, which works in all cases.

**Reconsideration criteria**:
- Real-world Blend65 code frequently needs field/element addresses
- A clean syntax exists that doesn't introduce pointer arithmetic ambiguities
- The codegen cost is predictable and documented

---

### FUT-002: Address-of on function parameters

> **Source**: F006 (Address-of Operator), Ambiguity AO-3  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow `&param` inside a function to get the address of a parameter.

**Why deferred**: In SFA, parameters have static addresses, so this is technically safe. However, it's confusing — the parameter's address is a compiler implementation detail, and exposing it encourages fragile code patterns. Simpler to copy the parameter to a local variable and take `&local`.

**Reconsideration criteria**:
- Compelling use case where copying to a local is insufficient
- Clear semantics that don't confuse beginners

---

### FUT-003: First-class typed function pointers and indirect calls — REFINED

> **Source**: F007 (Interrupt Functions), Ambiguity INT-2
> **Deferred from**: v3
> **Priority**: Medium

**What remains future**: Add first-class function pointer values and source-level indirect calls.
The type system for those values would need to distinguish ordinary `RTS` callees from callback-only
interrupt handlers and their raw or firmware-mediated entry variants.

**What is no longer deferred**: A full function-pointer type system is not required to make known
platform operations safe. The selected platform profile declares recognized sinks. The compiler
preserves a finite set of possible function identities and entry ABIs through direct scalar
declarations, assignments, copies, identity casts, and conditional selection while storage remains
unescaped. An interrupt-handler sink accepts only an `interrupt function` and selects its exact raw
or firmware-mediated entry variant; an IRQ-context callback sink may accept an ordinary `RTS`
helper. Incompatible known provenance is E10244; erased or unknown provenance at a recognized sink
is E10247. Integer transformation, address escape, or an unknown external boundary erases proof.
An exactly visible raw write to a known incompatible firmware vector is E10252; only a genuinely
opaque raw-memory boundary escapes certification.

**Reconsideration criteria**:
- A real program needs to store or select among callable function values
- A minimal function-pointer type system can preserve ABI and execution-domain facts
- The feature passes the full Language Guard evaluation

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

FUT-003 now covers only true first-class callable values and indirect calls.

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

### FUT-009: Address-of on struct fields

> **Source**: F011 (Structs), Ambiguity SR-A5  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: Allow `&player.hp` to return the address of a specific struct field. For module-level structs, the address is compile-time constant. For by-reference parameters, requires runtime address calculation.

**Why deferred**: Overlaps with FUT-001. For by-reference struct parameters, computing `&(param.field)` requires runtime pointer arithmetic. In v3, developers can use `&struct + offset` with `sizeof` for manual calculation.

**Reconsideration criteria**:
- FUT-001 is implemented (address-of on sub-expressions)
- Common enough pattern in real-world code to justify compiler support
- Runtime address calculation cost is documented and acceptable

---

### FUT-010: Struct return values

> **Source**: F011 (Structs), Rule SR-2  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow functions to return struct types: `function createEnemy(): Enemy`. The compiler would copy the struct from the function's frame to the caller's destination.

**Why deferred**: Requires hidden byte copying from callee frame to caller, which has non-transparent cost (violates H2 and A4). The by-reference parameter pattern achieves the same result explicitly.

**Reconsideration criteria**:
- A syntax is designed that makes the copy cost explicit (e.g., `let e: Enemy = createEnemy();` clearly assigns)
- The compiler can optimize out the copy in common cases (return value optimization / RVO)
- Community feedback indicates the by-reference parameter pattern is too verbose

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

**Why deferred**: Requires a linker, a defined binary/object format, a calling convention specification, and external tool dependency. The curated `asm_*()` intrinsics + language features + memory intrinsics cover all game development needs without external assembly. The only use cases that genuinely require hand-written assembly are demo-scene effects (FLD, VSP, AGSP, FLI) — cycle-counted techniques not used in commercial games.

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

### FUT-013: Compile-time table generation

> **Source**: F014 (Arrays), Gap 8  
> **Deferred from**: v3  
> **Priority**: Low

**What**: Allow compile-time expressions to generate const array contents:

```blend65
// Future syntax (TBD):
const SINE: byte[256] = comptime { [byte(128 + 127 * sin(i * 2 * PI / 256)) for i in 0..256] };
```

**Why deferred**: Requires a compile-time expression evaluator with math functions (sin, cos, etc.). In v3, lookup tables are hand-written or generated by an external tool and pasted into source. This is adequate for the initial release.

**Reconsideration criteria**:
- Community demand for programmatically generated lookup tables
- A clean compile-time expression syntax is designed
- The evaluator can be implemented without adding significant compiler complexity
- The feature passes the full Language Guard evaluation

---

### FUT-014: Manual alignment attribute

> **Source**: F015 (Data Inclusion), Deferred Items  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: A language-level attribute to specify memory alignment for any `const` data declaration, not just embedded assets:

```blend65
// Future syntax (TBD):
@align(256)
const SINE_TABLE: byte[256] = [0, 3, 6, 9, ...];

@align(64)
const SPRITE_DATA: byte[192] = [0x00, 0x7E, 0x00, ...];
```

**Why deferred**: In v3, alignment is handled automatically by format handlers for embedded assets (F015). For hand-written data, the linker/platform profile can handle placement. Adding a general alignment attribute requires designing an attribute syntax system (which v3 doesn't have) and defining how it interacts with all declaration types. The `@` symbol was explicitly removed from v3 to resolve the v2 overloading problem, so a new attribute syntax would need careful design.

**Reconsideration criteria**:
- Real-world Blend65 code frequently needs aligned hand-written tables (page-aligned lookup tables for performance)
- An attribute syntax is designed that doesn't reintroduce the v2 `@` ambiguity
- The feature passes the full Language Guard evaluation
- Interaction with `zeropage`, `let`, and `const` is fully specified

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
- The feature can be implemented as a format handler plugin without changing the core compiler

---

### FUT-016: Stack-free calling convention (`--no-stack-calls`)

> **Source**: F018 (Functions), Ambiguity FN-A7, FN-A8  
> **Deferred from**: v3  
> **Priority**: Medium

**What**: An alternative calling convention that eliminates all hardware stack usage for function calls by replacing JSR/RTS with JMP-threaded calls using static return address variables.

**How it works**: Since SFA guarantees no recursion, each function can only be "active" once at a time. The compiler allocates a 2-byte static "return address" variable per function. The caller stores the return point address into this variable and uses `JMP` instead of `JSR`. The callee uses `JMP (return_addr)` or a self-modifying `JMP $0000` to return:

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
| Static RAM per function | 0 bytes | 2 bytes |
| Call overhead | 12 cycles | ~20 cycles |
| Code size per call site | 3 bytes | ~11 bytes |
| JMP indirect bug (NMOS 6502) | N/A | Must avoid page boundary |

**Hybrid strategy**: The compiler could choose per-function:
- Single-caller functions → JMP threading with hardcoded return (zero overhead)
- Tail calls → `JMP` instead of `JSR` (zero additional stack)
- Multi-caller functions → JSR/RTS (simplest, fastest)

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
| FUT-001 | `&` on struct fields / array elements | Medium | — |
| FUT-002 | `&` on function parameters | Low | — |
| FUT-003 | First-class typed function pointers and indirect calls — REFINED | Medium | — |
| ~~FUT-004~~ | ~~Call-graph reentrancy analysis~~ — ✅ RESOLVED (execution-domain SFA) | — | — |
| ~~FUT-005~~ | ~~Type-safe interrupt installation~~ — ✅ RESOLVED (recognized platform sinks and entry variants) | — | — |
| FUT-006 | Labeled `break` for nested loops | Low | — |
| FUT-007 | Range cases in switch statements | Low | — |
| ~~FUT-008~~ | ~~Const struct parameters~~ — ✅ RESOLVED (F014) | — | — |
| FUT-009 | Address-of on struct fields | Medium | FUT-001, F011 |
| FUT-010 | Struct return values | Low | F011 |
| FUT-011 | External assembly linking (`extern function`) | Low | F012 |
| FUT-012 | Array copy intrinsic (`copy()`) | Medium | F014 |
| FUT-013 | Compile-time table generation | Low | F014 |
| FUT-014 | Manual alignment attribute | Medium | F015 |
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
> **Escape hatch**: External assembly linking — see FUT-011

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

**Chosen alternative**: The 13 curated **CPU control intrinsics** in F012 (`asm_sei`, `asm_cli`,
`asm_pha`, `asm_pla`, `asm_php`, `asm_plp`, `asm_clc`, `asm_sec`, `asm_cld`, `asm_sed`, `asm_clv`,
`asm_nop`, `asm_brk`). These cover exactly the operations the language *cannot* express, each
compiling to a single opcode with full cost transparency. Validated against three demanding C64
game architectures (The Last Ninja, Commando, Giana Sisters) — no game technique required
cycle-counted inline assembly.

Packed-decimal source uses the separate `bcd_add()` and `bcd_sub()` semantic operations. They
lower inline while ordinary `+` and `-` remain binary; they do not expand the raw opcode API.

**Escape hatch for the 1%**: The genuinely cycle-counted cases (demo-scene effects such as FLD,
VSP, AGSP, FLI, and self-modifying code) are served by **FUT-011 (external assembly linking via
`extern function`)** — hand-written assembly in a real assembler, linked with the compiler output.
That is the sanctioned path; this rejection is *not* a dead end.

**Reconsideration bar** (high): Only revisit if real-world Blend65 code repeatedly needs
cycle-counted assembly sequences that FUT-011 external linking cannot satisfy, AND a design exists
that resolves the register-ownership and label-scoping problems above without an embedded assembler.
