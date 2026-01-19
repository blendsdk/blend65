# IL Generator Implementation Plan - Master Index

> **Status**: Implementation Plan (v2.1 - God-Level)  
> **Date**: January 19, 2026  
> **Priority**: CRITICAL - Next Phase  
> **Estimated Time**: ~115 hours (~7.5 weeks)  
> **Prerequisites**: Semantic Analyzer IL-Readiness (COMPLETE ✅)

---

## Executive Summary

This document series provides a **detailed, granular implementation plan** for the Blend65 IL (Intermediate Language) Generator. The IL is designed to be truly "god-level" - enabling a sophisticated optimizer and code generator for the 6502 processor family.

### Why "God-Level" IL?

The 6502 is a constrained architecture with:
- **Only 3 general-purpose registers** (A, X, Y)
- **256-byte stack limit**
- **256-byte zero page** (precious fast memory)
- **Limited addressing modes**
- **No hardware multiply/divide**

A god-level IL must:
1. **Preserve all semantic analysis metadata** for optimization
2. **Use SSA form** for easy dataflow analysis
3. **Be target-agnostic** while enabling target-specific optimizations
4. **Support virtual registers** (unlimited) for proper register allocation
5. **Track type information** on every value
6. **Enable powerful optimizations** (DCE, CSE, constant folding, etc.)

---

## Document Structure

This plan is split into the following focused documents:

| Document | Description | Tasks | Est. Time |
|----------|-------------|-------|-----------|
| [01-type-system.md](01-type-system.md) | IL Types & Infrastructure | 8 | ~10.5 hr |
| [02-cfg-infrastructure.md](02-cfg-infrastructure.md) | Basic Blocks & CFG | 6 | ~10 hr |
| [03a-generator-base.md](03a-generator-base.md) | Generator Base + Modules | 4 | ~6.5 hr |
| [03b-generator-declarations.md](03b-generator-declarations.md) | Declaration Generation | 3 | ~5 hr |
| [03c-generator-statements.md](03c-generator-statements.md) | Statement Generation | 6 | ~9 hr |
| [04-expressions.md](04-expressions.md) | Expression Translation | 10 | ~14.25 hr |
| [05-intrinsics.md](05-intrinsics.md) | Intrinsics & Special Handling | 12 | ~18.5 hr |
| [05a-intrinsics-library.md](05a-intrinsics-library.md) | Extended Intrinsics Library | 4 | ~4 hr |
| [06-ssa-construction.md](06-ssa-construction.md) | SSA Construction | 6 | ~11.5 hr |
| [07-optimizations.md](07-optimizations.md) | IL Optimization Passes | 14 | ~20 hr |
| [08-testing.md](08-testing.md) | Testing & Integration | 6 | ~12.5 hr |
| **TOTAL** | | **79** | **~115 hr** |

---

## Current State Assessment

### What We Have (COMPLETE)

| Component | Status | Tests |
|-----------|--------|-------|
| Lexer | ✅ Complete | 150+ |
| Parser | ✅ Complete | 400+ |
| AST System | ✅ Complete | 100+ |
| Semantic Analyzer | ✅ Complete | 1,365+ |
| Type Coercion Analysis | ✅ Complete | 40 |
| Addressing Mode Hints | ✅ Complete | 26 |
| Expression Complexity | ✅ Complete | 39 |
| Hardware Analyzers | ✅ Complete | 200+ |
| Target Architecture | ✅ Complete | 50+ |
| **TOTAL** | **✅ Ready for IL** | **2,603** |

### What the IL Generator Will Consume

From semantic analysis, the IL generator receives:
- **Symbol Tables**: All variables, functions, types with resolved types
- **Type Information**: Full type info on every expression
- **Type Coercion Markers**: Where conversions are needed
- **Addressing Mode Hints**: Optimal 6502 addressing for each access
- **Expression Complexity**: Register pressure estimates
- **Constant Values**: Pre-computed constant folding results
- **Liveness Data**: Variable live ranges
- **Control Flow Graphs**: Per-function CFGs
- **6502 Hints**: Register preferences, zero-page priorities

---

## IL Design Philosophy

### Design Principle 1: SSA Form (Static Single Assignment)

Every variable is assigned exactly once. This enables:
- Clean dataflow analysis
- Easy dead code elimination
- Simple constant propagation
- Efficient register allocation

```
// Source
let x = 5;
x = x + 3;
x = x * 2;

// SSA IL
x.0 = 5
x.1 = x.0 + 3
x.2 = x.1 * 2
```

### Design Principle 2: Three-Address Code

Each instruction has at most:
- One destination (result)
- Two sources (operands)

```
// Complex expression: a = (b + c) * (d - e)
t1 = b + c
t2 = d - e
a = t1 * t2
```

### Design Principle 3: Virtual Registers

Unlimited virtual registers, let code generator allocate to A/X/Y:

```
v0 = LOAD_CONST 10
v1 = LOAD_VAR playerX
v2 = ADD v0, v1
STORE_VAR playerX, v2
```

### Design Principle 4: Rich Metadata Preservation

Every IL instruction carries:
- Source location (for debugging)
- Type information
- Semantic analysis metadata (addressing mode, complexity, etc.)

### Design Principle 5: Target-Agnostic Core

IL instructions are generic. Target-specific info is in metadata:

```
// Same IL for C64, C128, X16
v0 = HARDWARE_READ $D020, byte
  metadata: { addressingMode: Absolute, vicTiming: { ... } }
```

### Design Principle 6: Source Maps for Debugging

Every IL instruction maintains a mapping back to source code, enabling:
- Debugging with source-level breakpoints
- Error messages pointing to original source
- Multiple code gen targets with consistent source mapping

### Design Principle 7: Foundation for Future Phases

The IL is designed to support future phases (implemented separately):

```
IL Generator (this plan)
    ↓
IL Output (SSA form, all metadata preserved)
    ↓
God-Level Optimizer (FUTURE PLAN)
    ↓
Optimized IL
    ↓
God-Level Code Generator (FUTURE PLAN)
    ↓
PRG / ACME / KickAssembler output
```

---

## IL Instruction Set Overview

### Category 1: Constants and Values

| Instruction | Description | Example |
|-------------|-------------|---------|
| `CONST` | Load constant | `v0 = CONST 42, byte` |
| `UNDEF` | Undefined value | `v0 = UNDEF byte` |

### Category 2: Memory Operations

| Instruction | Description | Example |
|-------------|-------------|---------|
| `LOAD_VAR` | Load from variable | `v0 = LOAD_VAR x` |
| `STORE_VAR` | Store to variable | `STORE_VAR x, v0` |
| `LOAD_ARRAY` | Load array element | `v0 = LOAD_ARRAY arr, v1` |
| `STORE_ARRAY` | Store array element | `STORE_ARRAY arr, v1, v0` |
| `LOAD_FIELD` | Load struct field | `v0 = LOAD_FIELD obj, .x` |
| `STORE_FIELD` | Store struct field | `STORE_FIELD obj, .x, v0` |

### Category 3: Arithmetic Operations

| Instruction | Description | Example |
|-------------|-------------|---------|
| `ADD` | Addition | `v2 = ADD v0, v1` |
| `SUB` | Subtraction | `v2 = SUB v0, v1` |
| `MUL` | Multiplication | `v2 = MUL v0, v1` |
| `DIV` | Division | `v2 = DIV v0, v1` |
| `MOD` | Modulo | `v2 = MOD v0, v1` |
| `NEG` | Negate | `v1 = NEG v0` |

### Category 4: Bitwise Operations

| Instruction | Description | Example |
|-------------|-------------|---------|
| `AND` | Bitwise AND | `v2 = AND v0, v1` |
| `OR` | Bitwise OR | `v2 = OR v0, v1` |
| `XOR` | Bitwise XOR | `v2 = XOR v0, v1` |
| `NOT` | Bitwise NOT | `v1 = NOT v0` |
| `SHL` | Shift left | `v2 = SHL v0, v1` |
| `SHR` | Shift right | `v2 = SHR v0, v1` |

### Category 5: Comparison Operations

| Instruction | Description | Example |
|-------------|-------------|---------|
| `CMP_EQ` | Equal | `v2 = CMP_EQ v0, v1` |
| `CMP_NE` | Not equal | `v2 = CMP_NE v0, v1` |
| `CMP_LT` | Less than | `v2 = CMP_LT v0, v1` |
| `CMP_LE` | Less or equal | `v2 = CMP_LE v0, v1` |
| `CMP_GT` | Greater than | `v2 = CMP_GT v0, v1` |
| `CMP_GE` | Greater or equal | `v2 = CMP_GE v0, v1` |

### Category 6: Logical Operations

| Instruction | Description | Example |
|-------------|-------------|---------|
| `LOGICAL_AND` | Short-circuit AND | `v2 = LOGICAL_AND v0, v1` |
| `LOGICAL_OR` | Short-circuit OR | `v2 = LOGICAL_OR v0, v1` |
| `LOGICAL_NOT` | Logical NOT | `v1 = LOGICAL_NOT v0` |

### Category 7: Type Conversions

| Instruction | Description | Example |
|-------------|-------------|---------|
| `ZERO_EXTEND` | byte→word | `v1 = ZERO_EXTEND v0, word` |
| `TRUNCATE` | word→byte | `v1 = TRUNCATE v0, byte` |
| `BOOL_TO_BYTE` | bool→byte | `v1 = BOOL_TO_BYTE v0` |
| `BYTE_TO_BOOL` | byte→bool | `v1 = BYTE_TO_BOOL v0` |

### Category 8: Control Flow

| Instruction | Description | Example |
|-------------|-------------|---------|
| `LABEL` | Define label | `LABEL loop_start` |
| `JUMP` | Unconditional jump | `JUMP loop_start` |
| `BRANCH` | Conditional branch | `BRANCH v0, then_label, else_label` |
| `RETURN` | Return from function | `RETURN v0` |
| `RETURN_VOID` | Return void | `RETURN_VOID` |

### Category 9: Function Calls

| Instruction | Description | Example |
|-------------|-------------|---------|
| `CALL` | Call function | `v0 = CALL func, [v1, v2]` |
| `CALL_VOID` | Call void function | `CALL_VOID func, [v1, v2]` |
| `CALL_INDIRECT` | Call via pointer | `v0 = CALL_INDIRECT v1, [v2]` |

### Category 10: Intrinsics

| Instruction | Description | Example |
|-------------|-------------|---------|
| `INTRINSIC_PEEK` | Read memory | `v0 = INTRINSIC_PEEK v1` |
| `INTRINSIC_POKE` | Write memory | `INTRINSIC_POKE v0, v1` |
| `INTRINSIC_PEEKW` | Read word | `v0 = INTRINSIC_PEEKW v1` |
| `INTRINSIC_POKEW` | Write word | `INTRINSIC_POKEW v0, v1` |
| `INTRINSIC_LENGTH` | Array/string length | `v0 = INTRINSIC_LENGTH v1` |

### Category 11: SSA-Specific

| Instruction | Description | Example |
|-------------|-------------|---------|
| `PHI` | Phi function | `v2 = PHI [v0, block1], [v1, block2]` |

### Category 12: Hardware Access (Target-Aware)

| Instruction | Description | Example |
|-------------|-------------|---------|
| `HARDWARE_READ` | Read hardware register | `v0 = HARDWARE_READ $D020, byte` |
| `HARDWARE_WRITE` | Write hardware register | `HARDWARE_WRITE $D020, v0` |

### Category 13: @map Struct Access (NEW - v2.0)

These instructions provide structure-aware access to memory-mapped hardware, enabling better optimization and code generation.

| Instruction | Description | Example |
|-------------|-------------|---------|
| `MAP_LOAD_FIELD` | Load from @map struct field | `v0 = MAP_LOAD_FIELD sidVoice1, frequencyLo` |
| `MAP_STORE_FIELD` | Store to @map struct field | `MAP_STORE_FIELD sidVoice1, waveform, v0` |
| `MAP_LOAD_RANGE` | Load from @map range (indexed) | `v0 = MAP_LOAD_RANGE spritePos, v1` |
| `MAP_STORE_RANGE` | Store to @map range (indexed) | `MAP_STORE_RANGE spritePos, v1, v0` |

### Category 14: Optimization Control (NEW - v2.0)

Critical for C64 hardware timing where instruction order matters.

| Instruction | Description | Example |
|-------------|-------------|---------|
| `OPT_BARRIER` | Prevent instruction reordering | `OPT_BARRIER` |
| `VOLATILE_READ` | Read that cannot be eliminated | `v0 = VOLATILE_READ $D012` |
| `VOLATILE_WRITE` | Write that cannot be eliminated | `VOLATILE_WRITE $D020, v0` |

---

## Enhanced ILMetadata (v2.0)

```typescript
export interface ILMetadata {
  // === Core fields ===
  location?: SourceLocation;
  addressingMode?: string;
  complexity?: number;
  registerPressure?: number;
  coercion?: { kind: string; sourceType: ILType; targetType: ILType };
  m6502Hints?: { preferredRegister?: 'A' | 'X' | 'Y'; zeroPagePriority?: number };
  
  // === v2.0 fields ===
  rasterCritical?: boolean;
  estimatedCycles?: number;
  loopDepth?: number;
  isLoopInvariant?: boolean;
  inlineCandidate?: boolean;
  executionFrequency?: 'hot' | 'cold' | 'normal';
  sourceExpression?: string;
  mapInfo?: {
    structName: string;
    fieldName?: string;
    baseAddress: number;
    fieldOffset?: number;
    isRange?: boolean;
    rangeStart?: number;
    rangeEnd?: number;
  };
}
```

---

## Directory Structure (Final)

```
packages/compiler/src/il/
├── index.ts                    # Exports
├── types.ts                    # IL type definitions
├── values.ts                   # ILValue, VirtualRegister
├── instructions.ts             # All IL instruction types
├── basic-block.ts              # BasicBlock class
├── function.ts                 # ILFunction class
├── module.ts                   # ILModule class
├── builder.ts                  # ILBuilder helper
├── printer.ts                  # IL pretty-printer (debugging)
├── validator.ts                # IL validation
├── generator/
│   ├── index.ts                # Generator exports
│   ├── base.ts                 # ILGeneratorBase
│   ├── modules.ts              # ILModuleGenerator
│   ├── declarations.ts         # ILDeclarationGenerator
│   ├── statements.ts           # ILStatementGenerator
│   ├── expressions.ts          # ILExpressionGenerator
│   └── generator.ts            # ILGenerator (main)
├── intrinsics/
│   ├── index.ts                # Intrinsic exports
│   └── registry.ts             # IntrinsicRegistry
├── ssa/
│   ├── index.ts                # SSA exports
│   ├── dominators.ts           # Dominator tree
│   ├── frontiers.ts            # Dominance frontiers
│   ├── phi.ts                  # Phi placement
│   ├── renaming.ts             # Variable renaming
│   ├── verification.ts         # SSA verification
│   └── constructor.ts          # SSAConstructor
└── optimization/
    ├── index.ts                # Optimization exports
    ├── dce.ts                  # Dead code elimination
    ├── constant-fold.ts        # Constant folding
    ├── constant-prop.ts        # Constant propagation
    ├── copy-prop.ts            # Copy propagation
    ├── cse.ts                  # Common subexpression elimination
    ├── unreachable.ts          # Unreachable block elimination
    └── pipeline.ts             # OptimizationPipeline
```

---

## Global Task Checklist

| Phase | Task | Description | Status |
|-------|------|-------------|--------|
| **1** | 1.1 | Create IL directory structure | [ ] |
| **1** | 1.2 | Define IL type system | [ ] |
| **1** | 1.3 | Define virtual registers & values | [ ] |
| **1** | 1.4 | Define IL opcode enum | [ ] |
| **1** | 1.5 | Define instruction base classes | [ ] |
| **1** | 1.6 | Define arithmetic/logic instructions | [ ] |
| **1** | 1.7 | Define control flow instructions | [ ] |
| **1** | 1.8 | Define memory & call instructions | [ ] |
| **2** | 2.1 | Define BasicBlock class | [ ] |
| **2** | 2.2 | Define ILFunction class | [ ] |
| **2** | 2.3 | Define ILModule class | [ ] |
| **2** | 2.4 | Create ILBuilder helper | [ ] |
| **2** | 2.5 | Create ILPrinter | [ ] |
| **2** | 2.6 | Create ILValidator | [ ] |
| **3a** | 3.1 | IL Generator base class | [ ] |
| **3a** | 3.2 | Module generation layer | [ ] |
| **3b** | 3.3 | Declaration generation layer | [ ] |
| **3b** | 3.4 | Parameter/local generation | [ ] |
| **3c** | 3.5 | Statement generation layer | [ ] |
| **3c** | 3.6 | If statement generation | [ ] |
| **3c** | 3.7 | While statement generation | [ ] |
| **3c** | 3.8 | For statement generation | [ ] |
| **3c** | 3.9 | Return statement generation | [ ] |
| **3c** | 3.10 | Main ILGenerator class + exports | [ ] |
| **4** | 4.1 | Expression generation layer | [ ] |
| **4** | 4.2 | Literal expressions | [ ] |
| **4** | 4.3 | Identifier expressions | [ ] |
| **4** | 4.4 | Binary expressions | [ ] |
| **4** | 4.5 | Unary expressions | [ ] |
| **4** | 4.6 | Call expressions | [ ] |
| **4** | 4.7 | Index expressions | [ ] |
| **4** | 4.8 | Assignment expressions | [ ] |
| **4** | 4.9 | Type coercion insertion | [ ] |
| **4** | 4.10 | Short-circuit operators | [ ] |
| **5** | 5.1 | Intrinsic registry | [ ] |
| **5** | 5.2 | peek/poke intrinsics | [ ] |
| **5** | 5.3 | peekw/pokew intrinsics | [ ] |
| **5** | 5.4 | sizeof intrinsic | [ ] |
| **5** | 5.5 | length intrinsic | [ ] |
| **5** | 5.6 | @map variable access | [ ] |
| **5** | 5.7 | Storage class handling | [ ] |
| **5** | 5.8 | Hardware hints passthrough | [ ] |
| **5** | 5.9 | @map struct IL instructions | [ ] |
| **5** | 5.10 | Optimization barriers | [ ] |
| **5** | 5.11 | CPU instruction intrinsics | [ ] |
| **5** | 5.12 | Utility intrinsics (lo/hi) | [ ] |
| **6** | 6.1 | Dominator tree | [ ] |
| **6** | 6.2 | Dominance frontiers | [ ] |
| **6** | 6.3 | Phi function placement | [ ] |
| **6** | 6.4 | Variable renaming | [ ] |
| **6** | 6.5 | SSA verification | [ ] |
| **6** | 6.6 | SSA construction pass | [ ] |
| **7** | 7.1 | Dead code elimination | [ ] |
| **7** | 7.2 | Constant folding | [ ] |
| **7** | 7.3 | Constant propagation | [ ] |
| **7** | 7.4 | Copy propagation | [ ] |
| **7** | 7.5 | CSE | [ ] |
| **7** | 7.6 | Unreachable block elimination | [ ] |
| **7** | 7.7 | Optimization pipeline | [ ] |
| **7** | 7.8 | Optimization config | [ ] |
| **7** | 7.9 | Loop metadata instructions | [ ] |
| **7** | 7.10 | 6502 strength reduction | [ ] |
| **7** | 7.11 | Zero-page promotion | [ ] |
| **7** | 7.12 | Indexed addressing opt | [ ] |
| **7** | 7.13 | Array bounds elimination | [ ] |
| **7** | 7.14 | Barrier-aware optimization | [ ] |
| **8** | 8.1 | Unit tests | [ ] |
| **8** | 8.2 | Integration tests | [ ] |
| **8** | 8.3 | End-to-end tests | [ ] |
| **8** | 8.4 | Real-world patterns | [ ] |
| **8** | 8.5 | Benchmarks | [ ] |
| **8** | 8.6 | Documentation | [ ] |

---

## Summary

| Phase | Description | Time | Tests |
|-------|-------------|------|-------|
| Phase 1 | IL Type System | ~10.5 hr | 100 |
| Phase 2 | Basic Blocks & CFG | ~10 hr | 125 |
| Phase 3a-c | IL Generator Core | ~16 hr | 165 |
| Phase 4 | Expression Translation | ~14.25 hr | 170 |
| Phase 5 | Intrinsics & Special (+ 5a) | ~22.5 hr | 225 |
| Phase 6 | SSA Construction | ~11.5 hr | 110 |
| Phase 7 | IL Optimization | ~20 hr | 190 |
| Phase 8 | Testing & Integration | ~12.5 hr | 135 |
| **TOTAL** | | **~115 hr** | **~1,220** |

---

**Next Action**: Start with [01-type-system.md](01-type-system.md)