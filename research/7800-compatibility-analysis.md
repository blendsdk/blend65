# Blend65 Compatibility with Atari 7800 — Research Analysis

> **Date**: May 25, 2026  
> **Context**: If we set aside the Atari 2600, would what we're building with Blend65 be usable for the Atari 7800?

---

## Short Answer

**Yes, ~95% of Blend65 is directly usable for the 7800.** The 7800 is a fundamentally different machine from the 2600 and slots in naturally as a Blend65 platform target.

---

## Why the 7800 Is a Different Story from the 2600

The reason the 2600 was flagged as "drop from scope or do separately" is because of its **extreme constraints**:
- **128 bytes of RAM** — SFA frames can't work, meaningful variables can't exist
- **Cycle-counted beam racing** — every scanline is hand-timed; a high-level language can't realistically manage this
- **6507 CPU** — a crippled 6502 with a 13-bit address bus and no IRQ pin

The 7800 is a fundamentally different machine:

| Aspect | Atari 2600 | Atari 7800 | Why It Matters for Blend65 |
|--------|-----------|-----------|---------------------------|
| **CPU** | 6507 (crippled 6502) | **6502C** (standard 6502) | Blend65 targets standard 6502 — direct fit |
| **RAM** | 128 bytes | **4KB** (+ cart RAM possible) | SFA frames can work; real variables and arrays |
| **Display** | Beam racing (CPU draws every scanline) | **MARIA DMA** (hardware draws the display) | CPU is free to run game logic — perfect for a compiled language |
| **Programming model** | Cycle-counting per scanline | **Set up display lists, run game logic** | Much closer to C64/CX16 general-purpose model |
| **Address bus** | 13-bit (8KB) | **Full 16-bit** (64KB address space) | Normal 6502 memory map |

---

## What Transfers Directly from Blend65 to 7800

### ✅ Everything in the Core Language (100% reusable)
- Types (byte, word, sbyte, sword, boolean, arrays, structs, enums)
- Control flow (if/while/for/switch)
- Functions with SFA
- Module system (import/export)
- Expressions and operators
- All 6502 ASM functions (the 6502C is instruction-compatible)

### ✅ The Compilation Pipeline (100% reusable)
- Lexer, Parser, AST
- Semantic analysis
- SFA frame allocation — works fine with 4KB RAM (just constrain frame region size)
- IL generation
- 6502 code generation (same CPU)
- Optimizer passes

### ✅ The Platform Profile Architecture
This is exactly what the profile system was designed for:
```
platform "a7800" {
  cpu: 6502              // Standard 6502C
  ram: $1800-$27FF       // 4KB RAM region
  zp_user: $40-$FF       // Zero page available range
  frame_region: $1800-$1FFF  // SFA frames
  entry_point: ...
  output_format: "a78"   // Atari 7800 cartridge format
}
```

---

## What Would Be 7800-Specific (Platform Profile Only)

### 🔧 MARIA Display Lists
The 7800's graphics chip (MARIA) uses **Display List Lists (DLLs)** — you set up a data structure in RAM describing what to draw, and MARIA reads it via DMA. This is conceptually similar to how ANTIC works on the Atari 800XL (display lists), and very different from the C64's VIC-II or the 2600's beam racing.

For Blend65, this means:
- A platform library: `import { setupDisplayList, addSprite } from a7800.maria;`
- Structs/arrays for display list entries (a great use case for Blend65 structs!)
- Memory placement of display data in specific regions (`@data` annotations)

### 🔧 TIA Sound (Legacy from 2600)
The 7800 uses the 2600's TIA chip for sound (unless a POKEY is present on the cart). Platform library handles this.

### 🔧 Cartridge Format & Banking
7800 cartridges use specific header formats and potentially bank switching. The linker/output stage handles this — same as generating `.prg` for C64 vs `.xex` for Atari 8-bit.

---

## The Key Insight

The 2600's problem was that its **programming model** is fundamentally incompatible with any high-level language — you're literally counting cycles per scanline, and a compiler can't reliably do that.

The 7800's programming model is: **"Set up display data structures, then run your game logic while MARIA handles the screen."** That's a general-purpose programming model — exactly what Blend65 is designed for. The CPU is free to run compiled code without beam-racing constraints.

---

## 7800 RAM Constraints — Manageable, Not Fatal

The only thing that makes 7800 harder than C64/CX16/Atari 8-bit is the **tighter RAM constraint** (4KB vs 64KB). But this is a resource management challenge, not a fundamental incompatibility:

- SFA frames still work — you just have a smaller frame region
- The compiler needs to warn about frame region overflow earlier
- Games need to be more memory-conscious
- Cart RAM can extend available memory
- Display data (MARIA DLLs) competes with game data for the 4KB — careful layout matters

For comparison:
| Platform | Available RAM | SFA Viability |
|----------|--------------|---------------|
| C64 | ~38KB usable | Very comfortable |
| Commander X16 | 512KB+ banked | Unlimited |
| Atari 800XL | ~48KB usable | Very comfortable |
| **Atari 7800** | **4KB** | **Tight but workable** |
| Atari 2600 | 128 bytes | **Not viable** |

---

## Position in the Platform Roadmap

The 7800 was already listed as the 4th platform target in the feasibility assessment:

1. **C64** — Start here (largest community, best tooling, most RAM)
2. **Commander X16** — 65C02 superset, tests platform abstraction
3. **Atari 800XL** — Different I/O architecture, proves platform-agnostic design
4. **Atari 7800** — Tighter constraints, DMA display, tests memory-pressure handling

This ordering remains correct. The 7800 benefits from all the platform-abstraction work done for platforms 1-3.

---

## Conclusion

**~95% of Blend65 (language, compiler, codegen) is directly usable for the 7800.** Only the platform library (MARIA display lists, TIA sound, cartridge format) needs to be 7800-specific — and that's exactly what the platform profile architecture is designed to handle. The 7800 is a legitimate Blend65 target in a way the 2600 never could be.
