# Blend65 Feasibility Assessment & Strategic Decisions

> **Date**: May 25, 2026  
> **Context**: Answers to key project viability questions before starting v3

---

## Question 1: Is this feasible? What's the probability of success?

### A compiler that generates working code for ONE platform: **75-85% success probability**

This is achievable if you:
- Nail the spec before writing code (which is what we're doing now)
- Start with a small language subset (not the full spec at once)
- Target one platform first
- Accept that "working" means "generates correct code" not "generates optimal code"
- Build incrementally: literal expressions → variables → arithmetic → control flow → functions → modules

The 15-25% failure risk comes from:
- **Scope creep** — This killed v1 and it's the #1 killer of AI-assisted compiler projects. You MUST resist adding features before the core works.
- **The optimization trap** — v1 failed at the optimizer. Optimization is where 80% of compiler complexity lives. The correct strategy is: **ship with NO optimizer first**. Correct unoptimized code beats broken optimized code every time.
- **AI agent context drift** — Long conversations cause the AI to lose coherence. You need short, focused tasks with clear acceptance criteria. "Implement the lexer that passes these 50 test cases" — not "build the compiler."

### A compiler that works across ALL target platforms: **30-40% success probability**

Supporting C64, Commander X16, Atari 2600, Atari 7800, and Atari 800XL from a single language is **extremely ambitious**. The Atari 2600 in particular is a near-disqualifying outlier:

| Platform | CPU | RAM | Programming Model |
|----------|-----|-----|-------------------|
| C64 | 6502 @ 1MHz | 64KB | General-purpose |
| C64 Ultimate | 6502 + extras | 64KB+ | General-purpose + extras |
| Commander X16 | 65C02 @ 8MHz | 512KB+ banked | General-purpose, modern |
| Atari 800XL | 6502 @ 1.79MHz | 64KB | General-purpose |
| Atari 7800 | 6502C @ 1.19MHz | 4KB + cart ROM | Constrained, DMA display |
| **Atari 2600** | **6507 @ 1.19MHz** | **128 bytes** | **Cycle-counted racing the beam** |

The Atari 2600 has **128 bytes of RAM**. You can't have SFA frames. You can't have meaningful variables. You race the beam — you literally count CPU cycles per scanline. Batari BASIC exists for 2600, but it's a completely different paradigm from what you're designing. Trying to fit the 2600 into the same language as C64/CX16 will either (a) cripple the language for the capable platforms, or (b) produce unusable code for the 2600.

### A compiler that generates GAME-QUALITY code: **20-30% success probability**

Game-quality means tight loops, efficient sprite handling, raster timing. This requires the optimizer that killed v1. Getting here takes years for professional compiler teams. cc65 has been in development since the 1990s and its code quality is still considered mediocre for games — most serious C64 game developers write assembly.

### Recommendation on probability:

**Target 85% by being ruthlessly realistic about scope:**
1. One platform first (C64)
2. Small language subset first (no structs, no inline asm, no optimizer — just the basics)
3. "Correct before fast" — unoptimized but correct code
4. Add features and platforms incrementally, one at a time

---

## Question 2: Which platform first, second, and later?

### 1st: **Commodore 64** (start here)

**Why:**
- Largest retro development community — more testers, more feedback, more motivation
- Best tooling ecosystem (VICE emulator, ACME assembler, C64 Debugger)
- Well-documented hardware — every register, every cycle is documented
- 64KB RAM gives breathing room for SFA and unoptimized code
- Existing domain knowledge from v1
- cc65, KickC, Prog8, Oscar64 all target C64 — tons of reference material
- Standard 6502 (no quirks like the 6507's limited address bus)

### 2nd: **Commander X16**

**Why:**
- 65C02 is a strict superset of 6502 — C64 codegen works immediately, plus new instructions
- 512KB+ RAM means you never worry about memory during development
- Modern design (no legacy KERNAL quirks)
- Active community (David Murray / 8-Bit Guy)
- Tests the platform-profile abstraction: if the code handles C64→CX16, the architecture works

### 3rd: **Atari 800XL / 600XL**

**Why:**
- Same 6502 CPU, similar RAM (64KB)
- Very different I/O and graphics architecture (ANTIC/GTIA vs VIC-II) — the REAL test of platform abstraction
- Decent community and tooling (Altirra emulator)
- If the compiler handles C64 + Atari 8-bit, the platform-agnostic design is proven

### 4th: **Atari 7800**

**Why:**
- 6502C variant, but only 4KB RAM + cartridge ROM
- DMA-driven display (MARIA chip) is very different from scanline-based
- Much more constrained — tests whether the language works under memory pressure
- Smaller community but growing interest

### 5th (or NEVER): **Atari 2600**

**Why last or never:**
- 128 bytes of RAM makes SFA nearly impossible
- Cycle-counted "racing the beam" programming is fundamentally incompatible with a high-level language's abstractions
- The 6507 is a crippled 6502 (13-bit address bus, no IRQ pin)
- Batari BASIC barely works for simple games — and it's purpose-built for 2600
- Would need an entirely different compilation model — not "a plugin" but a different compiler
- **Recommendation: Drop the 2600 from scope.** It doesn't fit the vision. If 2600 support is wanted later, it should be a separate project that reuses only the lexer and parser.

### C64 Ultimate:

This isn't really a separate platform — it's a C64 with hardware extensions (REU, ethernet, etc.). The C64 platform profile handles it. Optional extensions (REU support, etc.) can be added as platform profile variants. Don't treat it as a separate target.

---

## Question 3: Can one language specification service all target platforms?

**Yes, but ONLY if designed as a layered system from day one.**

### Architecture that works:

```
┌─────────────────────────────────────────────┐
│           Blend65 Core Language              │
│  (types, syntax, control flow, functions,   │
│   modules, SFA — platform-agnostic)         │
├─────────────────────────────────────────────┤
│           Platform Abstraction Layer         │
│  (memory regions, ZP ranges, entry point,   │
│   output format, character encoding)         │
├──────────┬──────────┬───────────┬───────────┤
│  C64     │  CX16    │ Atari 8   │ Atari 7800│
│ Profile  │ Profile  │ Profile   │ Profile   │
│          │          │           │           │
│ VIC-II   │ VERA     │ ANTIC     │ MARIA     │
│ SID      │ YM2151   │ POKEY     │ TIA       │
│ CIA      │ VIA      │ PIA       │           │
│ PETSCII  │ ASCII    │ ATASCII   │           │
└──────────┴──────────┴───────────┴───────────┘
```

### What goes in the CORE spec (platform-agnostic):
- All types (byte, word, sbyte, sword, boolean, void, string, arrays, structs, enums)
- All syntax (expressions, statements, functions, modules)
- SFA architecture
- Generic intrinsics (peek, poke, hi, lo, length, sizeof, barrier, volatile_read/write)
- ASM functions for base 6502 instruction set

### What goes in PLATFORM PROFILES:
- Memory map (where ZP is, where RAM is, where frames go)
- Hardware-specific intrinsics/libraries (VIC-II sprite functions, SID sound, ANTIC display lists)
- Character encoding (PETSCII, ATASCII, ASCII)
- Output format (.prg, .xex, .a78, .bin)
- Startup/init code
- Available ZP bytes, frame region size
- CPU variant (6502, 65C02, 6507) — 65C02 adds ~30 new instructions

### Practical meaning:
- The core language spec is ONE document that never mentions C64 or Atari
- Each platform has its own appendix document
- The compiler has a `--platform=c64` flag that loads the right profile
- Platform libraries (`import { clearScreen } from c64.graphics`) are separate from the core language

**This is 100% feasible** — cc65 does exactly this (supports C64, Atari 8-bit, Apple II, NES, etc. from one C dialect + platform headers). The key insight is: the language is the same everywhere, the libraries and memory layout differ.

---

## Question 4: Would existing compiler source code be helpful?

**Yes, ENORMOUSLY — but selectively. Not all are equally valuable.**

### 🟢 HIGH VALUE — Study these closely

| Compiler | Why |
|----------|-----|
| **Prog8** | Closest competitor/inspiration. Modern high-level language targeting 6502 (C64, CX16, Atari 8-bit). Written in Kotlin. Studies the exact same problems: SFA-like allocation, no recursion, platform profiles. **Study its platform abstraction architecture.** |
| **KickC** | C-like language targeting C64/6502. Written in Java. Uses similar intermediate representation. Good reference for how C-style syntax compiles to 6502. |
| **Oscar64** | Modern C compiler for C64. Has excellent optimization passes for 6502. Study its optimizer if/when that stage is reached. |
| **cc65** | The gold standard for 6502 C compilation. Supports many platforms. **Study its platform/target abstraction** — how it handles C64 vs Atari vs Apple II from one compiler. Its linker configuration system is a mature solution to the platform-profile problem. |

### 🟡 MODERATE VALUE — Reference only

| Compiler | Why |
|----------|-----|
| **Batari BASIC** | Only useful if Atari 2600 is pursued (recommended against). Completely different programming model. |
| **GCC** | Way too complex and not relevant. Targets modern architectures — nothing transfers to 6502. |
| **Free Pascal** | Same issue — modern architecture focus. FPC is not relevant to 6502 compilation. |

### 🔴 LOW VALUE — Skip

| Compiler | Why |
|----------|-----|
| Any modern compiler (LLVM, Rust, Go) | Architecture is for machines with 32+ registers, GB of RAM, virtual memory. None of their techniques apply to 6502. |

### How to USE the source code effectively:

**Don't try to read entire codebases.** Instead, study specific subsystems:

1. From **Prog8**: Study its `CompilationTarget` interface — how it abstracts C64 vs CX16 vs Atari. This directly maps to the platform-profile need.
2. From **cc65**: Study its `.cfg` linker configuration files — how it defines memory regions per platform. This is a mature solution to "where do variables go."
3. From **KickC**: Study its intermediate representation and how it maps to 6502 instructions.
4. From **Oscar64**: Study its peephole optimizer patterns — these are the patterns eventually needed.

**Provide source code when ready to design specific subsystems**, not all at once:
- When designing platform profiles → Prog8 and cc65 platform abstraction code
- When designing the IL → KickC's IR
- When designing the optimizer → Oscar64's peephole pass

---

## Summary Table

| Question | Answer |
|----------|--------|
| Feasible? | Yes for one platform. Risky for all. Drop Atari 2600. |
| Success % | 75-85% for C64 alone; 30-40% for all platforms |
| Platform order | C64 → CX16 → Atari 8-bit → Atari 7800 (no 2600) |
| One spec for all? | Yes, with core + platform profiles architecture |
| Existing compilers? | Yes, especially Prog8, KickC, Oscar64, cc65 — selectively |
