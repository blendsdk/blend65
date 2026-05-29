# Chapter 00 — Introduction & Design Axioms

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable

---

## 1. What Is Blend65?

Blend65 is a statically typed, compiled programming language for the MOS 6502 CPU family. It targets retro computing platforms where every byte of RAM, every CPU cycle, and every page of ROM matters. The language provides a modern, C-like development experience while generating machine code that meets the hard real-time and memory constraints of 8-bit hardware.

Blend65 is not a general-purpose language. It is purpose-built for a class of machines that have:

- A single CPU running at 1–8 MHz
- Between 4 KB and 512 KB of RAM (often banked)
- No operating system, no virtual memory, no memory protection
- Display hardware that demands cycle-counted code on specific scanlines
- A 256-byte hardware stack shared between the program and the CPU

The language exists so that developers can write games, demos, tools, and system software for these machines in a structured, type-safe language — without sacrificing the control and efficiency that assembly language provides.

---

## 2. Target Platforms

Blend65 targets five platforms. The language specification is platform-independent; all platform-specific details live in **platform profiles** (→ Ch 15) and **platform appendixes**.

| Platform | CPU | Clock | RAM | Notes |
|----------|-----|-------|-----|-------|
| Commodore 64 | 6502 | 1 MHz | 64 KB | Primary target, largest community |
| C64 Ultimate | 6502 + extensions | 1 MHz | 64 KB+ | C64 variant with hardware extensions (REU, etc.) |
| Commander X16 | 65C02 | 8 MHz | 512 KB+ banked | Modern 6502 design, generous resources |
| Atari 800XL | 6502 | 1.79 MHz | 64 KB | Different I/O architecture (ANTIC/GTIA/POKEY) |
| Atari 7800 | 6502C | 1.19 MHz | 4 KB (+cart RAM) | Tightest constraints, DMA display (MARIA) |

The compiler accepts a `--platform` flag that selects the target. The platform profile defines resource limits, memory maps, character encoding, and binary output format. All five platforms must be supported by every language feature in the core specification.

---

## 3. Design Axioms

These five axioms are **foundational decisions**, not features. They are givens that every language feature must respect. The Language Guard (§4) enforces them.

### A1 — C-Like Syntax

Blend65 uses curly braces for blocks, semicolons as statement terminators, `name: type` for type annotations, and C-style operators. A developer fluent in C, TypeScript, or JavaScript should be able to read Blend65 code without consulting the specification.

```blend65
function movePlayer(dx: sbyte, dy: sbyte): void {
    let newX: sword = sword(playerX) + sword(dx);
    if (newX >= 0 && newX < 320) {
        playerX = word(newX);
    }
}
```

### A2 — Static Frame Allocation (SFA)

All memory allocation is determined at compile time. There is no heap, no `malloc`, no garbage collector, and no recursion. Every function has exactly one statically allocated frame. The call graph is fully known at compile time, and the compiler reuses frame memory for functions whose lifetimes do not overlap.

**Why:** The 6502 has a 256-byte hardware stack, no frame pointer register, and no memory protection. Dynamic allocation on this hardware is fragile, non-deterministic, and wastes precious cycles. SFA guarantees that memory usage is predictable, bounded, and verifiable at build time.

→ Full SFA specification: Ch 11 (Memory Model & SFA)

### A3 — No Undefined Behavior

Every possible input to the compiler produces either:

1. A well-defined result (documented), or
2. A compile-time error with a specific error code and actionable message.

There is no "undefined behavior" in Blend65. Integer overflow wraps deterministically (two's complement). Every operator, every type combination, and every edge case has a specified outcome.

**Why:** On a machine with no OS, no exception handler, and no debugger, undefined behavior means a hard crash, an infinite loop, or silent memory corruption — with zero diagnostic information. The cost of defining all behavior is far less than the cost of debugging undefined behavior on bare metal.

### A4 — Explicit Over Implicit

Blend65 requires explicit type annotations on every declaration. There is no type inference. Cross-signedness conversions require explicit casts. Narrowing conversions require explicit casts. The developer states their intent; the compiler enforces it.

**Why:** On the 6502, the difference between `byte` and `word` is the difference between 1-byte and 2-byte storage, between 4-cycle and 12-cycle arithmetic, between direct and indirect addressing. This is a design decision, not a detail to be inferred. Making it explicit documents the developer's intent for every reader of the code.

### A5 — Multi-Platform

Every core language feature must compile to correct machine code on all five target platforms. Features that are inherently platform-specific (VIC-II sprites, MARIA display lists, SID music) are not part of the core language — they belong in platform libraries, accessed via the module system.

The core specification never references specific hardware addresses, chip names, character encodings, or platform names. All such details are defined in platform profiles (→ Ch 15).

---

## 4. The Language Guard

The Language Guard is a 23-rule quality gate organized into five categories. Every language feature must pass all 23 rules (or invoke an explicit escape hatch) before entering the specification.

| Category | Rules | Focus |
|----------|-------|-------|
| **P** — Platform Universality | P1–P4 | Works on all targets; useful on all targets; no platform assumptions; resource-scalable |
| **H** — Hardware / 6502 Feasibility | H1–H5 | Compiles to 6502; cost is transparent; SFA compatible; memory footprint known; fully deterministic |
| **L** — Language Design Quality | L1–L9 | Unambiguous; consistent; beginner-friendly; minimal; non-redundant; error messages defined; compile-time failures preferred; interactions documented; documentable with examples |
| **C** — Compiler Implementability | C1–C5 | Lexable/parseable; semantic analysis defined; codegen strategy exists; unit-testable; runtime-verifiable in emulators |
| **F** — Future-Proofing | F1–F4 | Extensible; platform-profile ready; optimizer-friendly; stability-classified |

When a feature cannot pass all rules, one of five **escape hatch tiers** applies:

| Tier | Name | When Used |
|------|------|-----------|
| 1 | Platform Subset | Feature works but is constrained on some platforms → compiler warning |
| 2 | Platform Library | Feature is inherently platform-specific → not in core, provided as a library |
| 3 | Conditional Compilation | Behavior genuinely differs per platform → minimal `#if platform` directive |
| 4 | Feature Flag | Feature is too expensive for constrained platforms → opt-in via compiler flag |
| 5 | Reject / Defer | Feature fundamentally cannot work → removed or deferred to a future version |

The complete Language Guard with all 23 rules, escape hatch definitions, and the feature evaluation template is maintained as a separate operational document (`.clinerules/language-guard.md`). The guard is not part of the language specification — it is the process by which the specification is validated.

---

## 5. Stability Classifications

Every language feature carries a stability classification that sets expectations for users:

| Classification | Meaning | Contract |
|----------------|---------|----------|
| **stable** | Fully designed, will not change | Breaking changes require a major version bump |
| **provisional** | Designed but may be refined | Minor syntax/semantic adjustments possible in the next version |
| **experimental** | Exploratory, may be removed | No stability guarantee; may disappear entirely. Compiler warns on use |

All features in the Blend65 v3 specification are classified **stable** unless explicitly noted otherwise.

---

## 6. Specification Structure

This specification is organized into 16 chapters:

| Ch | Title | Scope |
|----|-------|-------|
| 00 | Introduction & Design Axioms | This chapter |
| 01 | Lexical Structure | Tokens, keywords, literals, comments |
| 02 | Type System | Types, promotion, casting, mixing rules |
| 03 | Variables & Constants | `let`, `const`, initialization, zero-page placement |
| 04 | Expressions & Operators | Operators, precedence, address-of, intrinsics |
| 05 | Statements & Control Flow | Blocks, `if`/`else`, `while`, `do-while`, `for`, `switch` |
| 06 | Functions | Declaration, calling, SFA frames, recursion prohibition, interrupts |
| 07 | Structs | Struct types, fields, literals, restrictions |
| 08 | Arrays & Strings | Array types, string literals, char literals, fill syntax |
| 09 | Enums | Byte-backed nominal types, asymmetric conversion |
| 10 | Modules & Multi-File | Module declarations, imports/exports, entry point |
| 11 | Memory Model & SFA | Static frame allocation, zero-page budget, address model |
| 12 | CPU Control & Intrinsics | The 13 curated CPU-control intrinsics |
| 13 | Data Inclusion & Asset Embedding | `embed()`, format selectors, const-only placement |
| 14 | Diagnostics: Error & Warning Registry | Complete E1xxxx / W1xxxx tables |
| 15 | Conformance & Platform Profile Contract | What a platform profile must define |

**Notation conventions:**

- `→ Ch NN` — cross-reference to another chapter.
- Rule IDs (e.g., TS-4, ST-1) reference the canonical rule in its owning chapter.
- Error codes use the format `E1xxxx` (errors) and `W1xxxx` (warnings), 5 digits starting at 10000.
- EBNF grammar fragments appear inline where relevant; the complete grammar is a separate document.
- Code examples use the `.blend65` language tag.

---

## 7. Conventions in Code Examples

All code examples in this specification are valid Blend65 v3 programs or program fragments unless marked otherwise. Invalid examples are annotated with the specific error code they produce:

```blend65
let x: byte = 200;          // ✅ Valid
let y = 200;                 // ❌ E10150: type annotation required
```

Platform-specific examples (e.g., specific memory addresses) are illustrative and use Commodore 64 addresses by convention. They are not normative — the language specification is platform-independent.

---

## 8. Document History

| Date | Change |
|------|--------|
| May 2026 | v3 specification created from 23 accepted feature evaluations (F001–F024, F023 retired) |

---

## 9. Related Documents

| Document | Purpose |
|----------|---------|
| Feature evaluations (`evaluations/F001–F024`) | The *why* behind each language feature — rationale, alternatives considered, Language Guard evaluation |
| Future considerations (`future-considerations.md`) | Deferred features (FUT-001–FUT-018) and rejected features (REJ-001, REJ-002) |
| Language Guard (`.clinerules/language-guard.md`) | The 23-rule quality gate and evaluation template |
| Build plan (`build-plan.md`) | The sequenced plan for producing this specification |
