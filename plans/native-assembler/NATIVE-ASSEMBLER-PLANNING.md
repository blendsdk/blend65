# Native 6502 Assembler - Planning Reference

> **Created**: January 23, 2026  
> **Status**: Planning Reference (Future Implementation)  
> **Priority**: After Optimizer Completion  
> **Estimated Effort**: ~1500 LOC

---

## Overview

This document captures the key decisions and requirements for the Blend65 Native Assembler target. This is a **future implementation** that will produce direct `.prg` binary output without requiring external assemblers.

---

## Architecture Decision Context

**Decision Date**: January 23, 2026

Blend65 uses a **Two-Target Architecture**:

```
Blend65 Source → Lexer → Parser → AST → IL Generator
                                          ↓
                            🔥 IL OPTIMIZATION PIPELINE 🔥
                                          ↓
                    ┌─────────────────────┴─────────────────────┐
                    ↓                                           ↓
          ACME Target (.asm)                       Native Target (.prg)
          ~500 LOC                                 ~1500 LOC
          For: libraries, integration             For: production builds
```

**Why Native Target Exists**:
- Direct binary output without external tool dependency
- Address-aware optimizations not possible with text assembly
- Branch relaxation (BEQ → JMP when out of range)
- Page boundary placement optimizations
- Single-file distribution (no assembler installation needed)

---

## Key Features

### 1. Two-Pass Assembly
- **Pass 1**: Collect labels, calculate addresses
- **Pass 2**: Emit binary with resolved addresses

### 2. 6502 Instruction Set
- All 56 documented opcodes
- All 13 addressing modes
- Cycle-accurate timing data for optimization decisions

### 3. Branch Relaxation
```
; If BEQ target > 127 bytes away:
BEQ target    →    BNE skip
                   JMP target
              skip:
```

### 4. PRG Output Format
- 2-byte load address header ($0801 typical for C64)
- Raw machine code bytes
- Optional BASIC loader stub

---

## Directory Structure (Proposed)

```
packages/compiler/src/target/
├── base-emitter.ts         # Shared interface
├── acme/
│   ├── acme-emitter.ts     # IL → ACME text (~500 LOC)
│   └── acme-syntax.ts
└── native/
    ├── assembler.ts        # 6502 assembler core
    ├── opcodes.ts          # 56 opcodes × 13 modes
    ├── address-resolver.ts # Symbol table, label resolution
    ├── binary-emitter.ts   # Byte emission
    └── prg-writer.ts       # .prg file format
```

---

## Implementation Phases (Future)

| Phase | Description | Est. LOC |
|-------|-------------|----------|
| 1 | Opcode table & encoding | ~400 |
| 2 | Address resolver & symbols | ~300 |
| 3 | Two-pass assembler core | ~400 |
| 4 | Branch relaxation | ~150 |
| 5 | PRG writer & loader | ~150 |
| 6 | Tests & validation | ~100 |
| **Total** | | **~1500** |

---

## Key Decisions Made

1. ✅ **No Pattern DSL needed** - Peephole patterns hardcoded (~20 essential patterns)
2. ✅ **IL-level optimization** - All heavy optimization before code emission
3. ✅ **Simple emitters** - Target emitters are translators, not optimizers
4. ✅ **ACME for integration** - Use ACME target for library distribution, debugging
5. ✅ **Native for production** - Use Native target for final builds

---

## Optimization Opportunities (Native-Only)

These optimizations are only possible in the Native assembler (not ACME):

| Optimization | Description |
|--------------|-------------|
| **Branch relaxation** | Auto-convert BEQ/BNE/etc to JMP when needed |
| **Page boundary** | Align critical loops to avoid page-cross penalties |
| **Address-aware** | Know exact addresses, not just labels |
| **Code placement** | Optimize memory layout for performance |

---

## Dependencies

```
IL Generator (COMPLETE ✅)
    ↓
Optimizer (IN PROGRESS - 57%)
    ↓
Code Generator (NOT STARTED)
    ↓
Target Emitters:
├── ACME Emitter (NOT STARTED)
└── Native Assembler (THIS DOCUMENT)
```

---

## Reference Documents

- `plans/optimizer/00-index.md` - Target Architecture Decision section
- `plans/optimizer/SESSION-TRACKING.md` - Architecture decision context
- `docs/language-specification/13-6502-features.md` - 6502 instruction reference

---

## Notes for Implementation

1. **Start with ACME target first** - Easier to debug, can verify IL→assembly correctness
2. **Native assembler second** - After ACME target proves IL generation is correct
3. **Share interfaces** - Both targets implement same `TargetEmitter` interface
4. **Test against ACME** - Native output should match ACME-assembled binary

---

**This document is a reference for future implementation. Do not start implementation until optimizer is complete.**