# Blend65 Compiler — Project Status

> **Last Updated**: August 2, 2026
> **Architecture**: Static Frame Allocation (SFA)
> **Package**: `packages/compiler/`
> **Language Spec**: `docs/language-specification-v2/`
> **Test Status**: 7,858 tests — 7,835 passing, 0 failed, 23 skipped (compiler) + 10 CLI tests

---

## What is Blend65?

Blend65 is a modern programming language and compiler targeting the **Commodore 64** and other 6502-based systems. It compiles high-level, type-safe code to 6502 assembly via the ACME assembler.

**Design Philosophy:** Explicit over implicit • Zero-cost abstractions • Hardware-first • Readable assembly alternative

**Compiler Pipeline:**

```
Source → Lexer → Parser → Semantic Analyzer → Frame Allocator
→ IL Generator → IL Optimizer → Code Generator → ASM-IL Optimizer → ASM-IL Emitter → .asm
```

---

## Component Status

| Component | Status | Tests | Notes |
|-----------|--------|-------|-------|
| **Lexer** | ✅ Complete | ~150+ | Full tokenization |
| **Parser** | ✅ Complete | ~400+ | Pratt expression parser, 6-layer architecture |
| **AST** | ✅ Complete | ~180+ | Walkers, collectors, transformers, type guards |
| **Semantic Analyzer** | ✅ Complete | ~3,500+ | Multi-pass, multi-module, recursion detection |
| **Frame Allocator** | ✅ Complete | ~500+ | Static memory allocation per function (SFA) |
| **IL Generator** | ✅ Complete | ~200+ | Linear IL, ~25 opcodes + ASM_RAW |
| **IL Optimizer** | ✅ Complete | ~200+ | 5 passes: DCE, const-fold, const-prop, copy-prop, peephole |
| **Code Generator** | ✅ Complete | ~300+ | 8-layer inheritance chain + CPU strategy pattern |
| **ASM-IL Emitter** | ✅ Complete | ~70+ | Full ACME assembler text output |
| **65C02 Support** | ✅ Complete | ~170+ | CPU strategy: 6502 + 65C02 instruction sets |
| **ASM-IL Optimizer** | ✅ Complete | ~100+ | Level-based optimizer (O0-O2) |
| **Pipeline & Compiler** | ✅ Complete | ~60+ | 8-phase pipeline, Compiler class, public API |
| **Library System** | ✅ Complete | ~40+ | Auto-loading: system.blend, asm.blend, hardware.blend |
| **ASM Functions** | ✅ Complete | ~80+ | All 151 asm_* functions (56 opcodes × addressing modes) |
| **CLI** | ✅ Complete | 10 | `blend65 build`, `blend65 check` commands |

---

## Test Summary

```
Compiler: 7,858 tests (7,835 passing, 0 failed, 23 skipped)
CLI:      10 tests (10 passing, 0 failed)
Total:    7,868 tests — 7,845 passing (99.7%)
```

---

## Completed Milestones

### Compiler v2 — All 10 Phases Complete ✅

| Phase | Title | Status |
|-------|-------|--------|
| 1 | Lexer Migration | ✅ Complete |
| 2 | Parser Migration | ✅ Complete |
| 3 | Semantic Migration | ✅ Complete |
| 4 | Frame Allocator | ✅ Complete |
| 5 | IL Generator | ✅ Complete |
| 6 | Code Generator | ✅ Complete |
| 7 | IL Optimizer | ✅ Complete |
| 8 | 65C02 Support | ✅ Complete |
| 9 | ASM-IL Optimizer | ✅ Complete |
| 10 | Integration, Pipeline & v1 Removal | ✅ Complete |

**Phase 10 Highlights:**
- Infrastructure migration (config, target, library loader)
- Library files: `system.blend` (10 intrinsics), `asm.blend` (151 stubs), `hardware.blend`
- ASM_RAW IL opcode + code generation for all 12 addressing modes
- 8-phase pipeline with `Compiler` class
- Full E2E test suite (simple programs, intrinsics, asm functions, multi-module, C64 patterns)
- CLI updated to use v2 compiler
- V1 archived to `archive/packages/compiler-v1/`
- V2 renamed to `packages/compiler/` (primary package)

---

## Known Issues

- **Library auto-loading duplicate declarations**: When library modules (system.blend) are auto-loaded alongside user imports of the same module, the semantic analyzer reports duplicate declaration errors. This is a semantic analyzer improvement for a future release.
- **Example programs**: The `examples/` directory needs updating for v2 syntax (auto-loaded intrinsics mean explicit `import` from system causes conflicts).

---

## What's Remaining

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
| **Hardware Access** | `peek()`/`poke()` intrinsics + `asm_*` for direct 6502 instructions |
| **Code Generation** | Inheritance chain: Base → Memory → Arithmetic → Bitwise → Comparison → Control → Functions → Intrinsics → Generator |
| **CPU Targets** | Strategy pattern: `CpuInstructionSet` with 6502 and 65C02 implementations |
| **Assembly Output** | ASM-IL → ACME assembler format via `AsmILEmitter` |
| **ASM Functions** | 151 `asm_*()` functions → `ASM_RAW` IL opcode → direct 6502 instructions |

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
| **Compiler v2 (main)** | `plans/compiler-v2/99-execution-plan.md` | ✅ All 10 Phases Complete |
| **Phase 10 Detail** | `plans/compiler-v2/phase-10/99-execution-plan.md` | ✅ 75/75 tasks (100%) |
| **Codegen** | `plans/compiler-v2/codegen/99-execution-plan.md` | ✅ 100% Complete |
| **IL Optimizer** | `plans/compiler-v2/il-optimizer/99-execution-plan.md` | ✅ 100% Complete |
| **65C02 Support** | `plans/compiler-v2/65c02-support/99-execution-plan.md` | ✅ 100% Complete |
| **ASM-IL Optimizer** | `plans/compiler-v2/asm-il-optimizer/99-execution-plan.md` | ✅ 100% Complete |
| **DX Features** | `plans/dx-features/99-execution-plan.md` | 📋 Planned |

---

## Language Features (All Working)

- **Types:** `byte`, `word`, `bool`, `void`, arrays (`byte[N]`, `word[256]`)
- **Variables:** `let`, `const`, storage classes (`@zp`, `@ram`, `@data`)
- **Functions:** Parameters, return values, `export`, no recursion
- **Control Flow:** `if`/`else if`/`else`, `while`, `for`, `break`, `continue`
- **Expressions:** Arithmetic, bitwise, comparison, logical, ternary (`? :`), address-of (`@`)
- **Intrinsics:** `peek()`, `poke()`, `peekw()`, `pokew()`, `length()`, `hi()`, `lo()`, `barrier()`, `volatile_read()`, `volatile_write()`
- **ASM Functions:** 151 `asm_*()` functions for direct 6502 instruction access
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

# Compile a program
node packages/cli/bin/blend65.js build examples/simple/main.blend
```

---

## Archived Documents

The following documents have been archived to `archive/`:
- `archive/docs/` — Superseded documentation
- `archive/packages/compiler-v1/` — Original v1 compiler (replaced by v2)
- `archive/plans/` — Completed and superseded plans

---

**This is the single source of truth for project status.**
**For detailed task tracking, see `plans/compiler-v2/99-execution-plan.md`.**
