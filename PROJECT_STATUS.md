# Blend65 Compiler — Project Status

> **Last Updated**: July 2, 2026
> **Architecture**: Static Frame Allocation (SFA)
> **Package**: `packages/compiler-v2/`
> **Language Spec**: `docs/language-specification-v2/`
> **Test Status**: 6,534 tests — 6,524 passing, 0 failed, 10 skipped

---

## What is Blend65?

Blend65 is a modern programming language and compiler targeting the **Commodore 64** and other 6502-based systems. It compiles high-level, type-safe code to 6502 assembly via the ACME assembler.

**Design Philosophy:** Explicit over implicit • Zero-cost abstractions • Hardware-first • Readable assembly alternative

**Compiler Pipeline:**

```
Source → Lexer → Parser → Semantic Analyzer → Frame Allocator
→ IL Generator → IL Optimizer → Code Generator → ASM-IL Emitter → .asm
```

---

## Component Status

| Component | Status | Tests | Notes |
|-----------|--------|-------|-------|
| **Lexer** | ✅ Complete | ~150+ | Full tokenization, no @map tokens |
| **Parser** | ✅ Complete | ~400+ | Pratt expression parser, 6-layer architecture |
| **AST** | ✅ Complete | ~180+ | Walkers, collectors, transformers, type guards |
| **Semantic Analyzer** | ✅ Complete | ~3,500+ | Multi-pass, multi-module, recursion detection |
| **Frame Allocator** | ✅ Complete | ~500+ | Static memory allocation per function (SFA) |
| **IL Generator** | ✅ Complete | ~200+ | Linear IL, ~25 opcodes |
| **IL Optimizer** | ✅ Complete | ~200+ | 5 passes: DCE, const-fold, const-prop, copy-prop, peephole |
| **Code Generator** | ✅ Complete | ~300+ | 8-layer inheritance chain + CPU strategy pattern |
| **ASM-IL Emitter** | ✅ Complete | ~70+ | Full ACME assembler text output |
| **65C02 Support** | ✅ Complete | ~170+ | CPU strategy: 6502 + 65C02 instruction sets |
| **ASM-IL Optimizer** | ❌ Not Started | 0 | 32 tasks planned across 7 phases |
| **Compiler Entry Point** | ❌ Not Started | 0 | Pipeline wiring, optimization levels, public API |

---

## Test Summary

```
Total:    6,534 tests
Passing:  6,524 (99.85%)
Failed:   0
Skipped:  10 (documented — known edge cases and parser limitations)
```

---

## What's Remaining

### Phase 9: ASM-IL Optimizer (NOT STARTED)

**Plan:** `plans/compiler-v2/asm-il-optimizer/99-execution-plan.md`
**Scope:** 32 tasks across 7 phases, ~13-20 hours

8 optimization passes for 6502-specific assembly optimization:
- **O1:** Flag patterns, store-load elimination
- **O2:** Branch optimization, transfer patterns
- **O3:** ZP promotion, 6502 strength reduction, stack optimization
- **Os/Oz:** Size optimization, tail calls, sequence factoring

### Phase 10: Integration & Testing (NOT STARTED)

**Plan:** `plans/compiler-v2/99-execution-plan.md` (Phase 10)
**Scope:** 3 sessions, ~2-3 hours

- Compiler entry point class (`src/compiler.ts`)
- Wire up full pipeline with optimization levels
- Export public API
- E2E test fixtures
- Example program compilation
- VICE emulator validation
- CLI update to use v2

### Future Work

| Plan | Description | Status |
|------|-------------|--------|
| `plans/dx-features/` | CLI improvements, VICE integration, source maps | 📋 Planned |
| `plans/native-assembler/` | Direct .prg generation without ACME | 📋 Planning |
| `plans/features/` | Inline assembly, interrupts, sprites | 📖 Research |

---

## Architecture

### v2 Key Decisions

| Decision | Outcome |
|----------|---------|
| **IR Architecture** | Static Frame Allocation (SFA) — no SSA, no PHI nodes |
| **Recursion** | Forbidden (compile-time error via call graph analysis) |
| **Hardware Access** | `peek()`/`poke()` intrinsics (no @map syntax) |
| **Code Generation** | Inheritance chain: Base → Memory → Arithmetic → Bitwise → Comparison → Control → Functions → Intrinsics → Generator |
| **CPU Targets** | Strategy pattern: `CpuInstructionSet` with 6502 and 65C02 implementations |
| **Assembly Output** | ASM-IL → ACME assembler format via `AsmILEmitter` |

### Memory Model (SFA)

```
┌─────────────────────────────────────────┐
│ Global Memory Layout                     │
├─────────────────────────────────────────┤
│ @zp Variables        ($02-$FF)          │
│ @ram Variables       ($0800+)           │
│ @data Variables      (ROM-able)         │
├─────────────────────────────────────────┤
│ Function Frames (static allocation)     │
│ ├── main_frame       (params + locals)  │
│ ├── func1_frame      (params + locals)  │
│ └── func2_frame      (params + locals)  │
└─────────────────────────────────────────┘
```

---

## Active Plans

| Plan | Location | Status |
|------|----------|--------|
| **Compiler v2 (main)** | `plans/compiler-v2/99-execution-plan.md` | Phases 1-8 ✅, Phase 9-10 pending |
| **Codegen** | `plans/compiler-v2/codegen/99-execution-plan.md` | ✅ 100% Complete |
| **IL Optimizer** | `plans/compiler-v2/il-optimizer/99-execution-plan.md` | ✅ 100% Complete |
| **65C02 Support** | `plans/compiler-v2/65c02-support/99-execution-plan.md` | ✅ 100% Complete |
| **ASM-IL Optimizer** | `plans/compiler-v2/asm-il-optimizer/99-execution-plan.md` | ⬜ 0% — Not Started |
| **DX Features** | `plans/dx-features/99-execution-plan.md` | 📋 Planned |

---

## Language Features (All Working)

- **Types:** `byte`, `word`, `bool`, `void`, arrays (`byte[N]`, `word[256]`)
- **Variables:** `let`, `const`, storage classes (`@zp`, `@ram`, `@data`)
- **Functions:** Parameters, return values, `export`, no recursion
- **Control Flow:** `if`/`else if`/`else`, `while`, `for`, `break`, `continue`
- **Expressions:** Arithmetic, bitwise, comparison, logical, ternary (`? :`), address-of (`@`)
- **Intrinsics:** `peek()`, `poke()`, `peekw()`, `pokew()`, `length()`, `sizeof()`, `hi()`, `lo()`
- **Modules:** `module`, `import`, `export`

---

## Getting Started

```bash
# Install dependencies
yarn install

# Build
yarn build

# Run all tests
./compiler-test

# Run targeted tests
./compiler-test parser
./compiler-test semantic
./compiler-test codegen
```

---

## Archived Documents

The following documents have been archived to `archive/docs/`:
- `COMPILER-MASTER-PLAN.md` — Superseded by `plans/compiler-v2/`
- `WHATS-LEFT.md` — Merged into this document
- `GAP-REPORT.md` — Merged into this document
- `CODEGEN-ISSUES-ANALYSIS.md` — v1 analysis, no longer relevant
- `SFA-IMPLEMENTATION-SUMMARY.md` — Historical reference

---

**This is the single source of truth for project status.**
**For detailed task tracking, see `plans/compiler-v2/99-execution-plan.md`.**
