# Salvage Analysis: v1 Compiler

> **Document**: 02-salvage-analysis.md  
> **Parent**: [Index](00-index.md)  
> **Status**: Analysis Complete

## Overview

This document analyzes the v1 compiler (`packages/compiler/`) to determine what code can be salvaged for v2. The goal is to minimize rewriting while ensuring a clean SFA architecture.

## v1 Component Inventory

### Source Structure

```
packages/compiler/src/
├── compiler.ts          # Main entry point
├── index.ts             # Public exports
├── lexer/               # ✅ Salvage
│   ├── lexer.ts
│   ├── types.ts
│   └── utils.ts
├── parser/              # ✅ Salvage (with changes)
│   ├── base.ts
│   ├── declarations.ts
│   ├── expressions.ts
│   ├── modules.ts
│   ├── parser.ts
│   ├── statements.ts
│   └── ...
├── ast/                 # ✅ Salvage (with changes)
│   ├── base.ts
│   ├── nodes.ts
│   ├── type-guards.ts
│   └── walker/
├── semantic/            # ⚠️ Partial salvage
│   ├── analyzer.ts
│   ├── type-system.ts
│   ├── symbol-table.ts
│   └── ...
├── il/                  # ❌ Rewrite
│   ├── builder.ts
│   ├── generator/
│   ├── ssa/
│   └── ...
├── codegen/             # ❌ Rewrite
│   └── ...
├── asm-il/              # ✅ Salvage (mostly)
│   ├── types.ts
│   ├── builder/
│   ├── emitters/
│   └── optimizer/
├── optimizer/           # ⚠️ Partial salvage
│   └── ...
├── config/              # ✅ Salvage
├── library/             # ✅ Salvage
├── target/              # ✅ Salvage
└── utils/               # ✅ Salvage
```

---

## Detailed Analysis

### ✅ SALVAGE: Lexer

**Files**: `lexer/lexer.ts`, `lexer/types.ts`, `lexer/utils.ts`

**Reuse**: 95%

**Required Changes**:
- Remove @map-related tokens from `TokenType` enum
- Remove @map tokenization logic from lexer
- Update keyword list (remove `map` if present)

**Changes Summary**:
```typescript
// Remove from types.ts TokenType enum:
// - Any @map related tokens (if separate from @ and map)

// Remove from lexer.ts:
// - @map specific tokenization paths
```

**Tests**: Most lexer tests can be copied directly. Remove @map test cases.

---

### ✅ SALVAGE: Parser

**Files**: `parser/*.ts` (7 files)

**Reuse**: 85%

**Required Changes**:

| File | Changes |
|------|---------|
| `declarations.ts` | Remove `parseMapDeclaration()` method |
| `parser.ts` | Remove @map from declaration dispatch |
| `modules.ts` | No changes expected |
| `expressions.ts` | No changes expected |
| `statements.ts` | No changes expected |
| `base.ts` | No changes expected |

**Inheritance Chain** (maintain this structure):
```
ParserBase          (base.ts)
    ↓
ExpressionParser    (expressions.ts)
    ↓
StatementParser     (statements.ts)
    ↓
DeclarationParser   (declarations.ts)
    ↓
ModuleParser        (modules.ts)
    ↓
Parser              (parser.ts)
```

**Tests**: ~85% of parser tests can be copied. Remove @map parsing tests.

---

### ✅ SALVAGE: AST

**Files**: `ast/base.ts`, `ast/nodes.ts`, `ast/type-guards.ts`, `ast/walker/*`

**Reuse**: 90%

**Required Changes**:

| File | Changes |
|------|---------|
| `nodes.ts` | Remove MapDeclaration node class |
| `type-guards.ts` | Remove `isMapDeclaration()` guard |
| `base.ts` | Remove @map from ASTNodeType enum |

**Key Nodes to Keep**:
- `VariableDeclaration` (with @zp, @ram, @data storage classes)
- `FunctionDeclaration`
- `ModuleDeclaration`
- All expression nodes
- All statement nodes

**Tests**: ~90% of AST tests can be copied.

---

### ⚠️ PARTIAL SALVAGE: Semantic Analyzer

**Files**: `semantic/*.ts` (~15 files)

**Reuse**: 60%

**Salvage As-Is**:
- `type-system.ts` - Type definitions and utilities
- `types.ts` - Type enums and interfaces
- `symbol.ts` - Symbol class definition
- `scope.ts` - Scope class (maybe adapt)

**Salvage With Major Changes**:
- `symbol-table.ts` - Remove SSA preparation
- `analyzer.ts` - Remove SSA prep, add recursion check
- `memory-layout.ts` - Adapt for SFA frames

**Do Not Salvage**:
- Any SSA-specific analysis code
- PHI-related logic
- SSA renaming/versioning

**New Required**:
- `call-graph.ts` - Build function call graph
- `recursion-check.ts` - Detect recursion cycles

---

### ❌ REWRITE: IL Generator

**Files**: `il/*.ts`, `il/generator/*.ts`, `il/ssa/*.ts`

**Reuse**: 10% (concepts only)

**Why Rewrite**:
- Current IL is SSA-based with PHI nodes
- v2 needs simple linear IL with frame references
- Fundamental architecture mismatch

**Keep Concepts From**:
- `il/types.ts` - Some opcode ideas
- `il/builder.ts` - Builder pattern (adapt)

**New IL Design**:
```typescript
// Simple linear IL - no SSA
enum ILOpcode {
  // Memory operations
  LOAD_BYTE,      // Load byte from frame slot
  STORE_BYTE,     // Store byte to frame slot
  LOAD_WORD,      // Load word from frame slot
  STORE_WORD,     // Store word to frame slot
  LOAD_IMM,       // Load immediate value
  
  // Arithmetic
  ADD, SUB, MUL, DIV, MOD,
  AND, OR, XOR, NOT,
  SHL, SHR,
  
  // Comparison
  CMP_EQ, CMP_NE, CMP_LT, CMP_LE, CMP_GT, CMP_GE,
  
  // Control flow
  JUMP,           // Unconditional jump
  JUMP_IF,        // Conditional jump (if true)
  JUMP_IF_NOT,    // Conditional jump (if false)
  LABEL,          // Label definition
  
  // Functions
  CALL,           // Call function
  RETURN,         // Return from function
  
  // Intrinsics
  PEEK, POKE, PEEKW, POKEW,
  HI, LO,
}

interface ILInstruction {
  opcode: ILOpcode;
  operands: ILOperand[];
  location?: SourceLocation;
}

interface ILFunction {
  name: string;
  frame: Frame;
  instructions: ILInstruction[];
}
```

---

### ❌ REWRITE: Code Generator

**Files**: `codegen/*.ts` (~12 files)

**Reuse**: 15%

**Why Rewrite**:
- Current codegen handles SSA/PHI lowering
- Complex value tracking for SSA temporaries
- v2 needs direct memory-to-ASM translation

**Partial Salvage**:
- `assembly-writer.ts` - ASM formatting utilities
- `label-generator.ts` - Label generation
- `basic-stub.ts` - BASIC loader stub
- `types.ts` - Some type definitions

**New Codegen Design**:
```typescript
// Direct IL-to-ASM mapping with frame addresses
class SFACodeGenerator {
  // Each IL instruction maps to 1-3 ASM instructions
  // All variables have static addresses
  // No PHI resolution needed
  
  generateLoadByte(slot: FrameSlot): void {
    // LDA frame_base + slot.offset
    this.emit(`LDA ${slot.address}`);
  }
  
  generateStoreByte(slot: FrameSlot): void {
    // STA frame_base + slot.offset
    this.emit(`STA ${slot.address}`);
  }
}
```

---

### ✅ SALVAGE: ASM-IL

**Files**: `asm-il/*.ts`, `asm-il/builder/*.ts`, `asm-il/emitters/*.ts`

**Reuse**: 85%

**Why Salvage**:
- ASM-IL is the assembly intermediate layer
- Works with any codegen backend
- Already has ACME emitter

**Required Changes**:
- Update to work with new SFA codegen
- Minor interface adjustments

---

### ⚠️ PARTIAL SALVAGE: Optimizer

**Files**: `optimizer/*.ts`

**Reuse**: 40%

**Salvage**:
- `optimizer.ts` - Pass runner infrastructure
- `options.ts` - Optimization levels

**Do Not Salvage**:
- SSA-specific passes
- PHI-related optimizations

**New Optimizer Structure**:
- IL optimizer slot (empty for now)
- ASM peephole optimizer (adapt from asm-il/optimizer)

---

### ✅ SALVAGE: Support Modules

**Config** (`config/*.ts`): 100% reuse
- Compilation options
- Target configurations
- Config merging

**Library** (`library/*.ts`): 100% reuse
- Library loader
- Standard library definitions

**Target** (`target/*.ts`): 100% reuse
- Architecture definitions
- C64/X16 configurations

**Utils** (`utils/*.ts`): 100% reuse
- Source registry
- Utility functions

---

## Salvage Summary Table

| Component | Files | Reuse % | Strategy |
|-----------|-------|---------|----------|
| Lexer | 3 | 95% | Copy, remove @map tokens |
| Parser | 7 | 85% | Copy, remove @map parsing |
| AST | 5 | 90% | Copy, remove @map nodes |
| Semantic | 15 | 60% | Partial copy, add recursion check |
| IL | 10 | 10% | Rewrite for SFA |
| CodeGen | 12 | 15% | Mostly rewrite |
| ASM-IL | 8 | 85% | Copy, minor updates |
| Optimizer | 4 | 40% | Partial, remove SSA passes |
| Config | 7 | 100% | Copy as-is |
| Library | 2 | 100% | Copy as-is |
| Target | 4 | 100% | Copy as-is |
| Utils | 2 | 100% | Copy as-is |

**Overall Code Reuse**: ~55%

---

## Migration Order

Based on dependencies, migrate in this order:

```
1. Utils, Config, Target, Library  (100% copy)
      ↓
2. Lexer  (95% copy)
      ↓
3. AST  (90% copy, remove @map)
      ↓
4. Parser  (85% copy, remove @map)
      ↓
5. Semantic (partial, remove SSA, add recursion)
      ↓
6. Frame Allocator (NEW)
      ↓
7. IL Generator (NEW)
      ↓
8. Code Generator (NEW with some salvage)
      ↓
9. ASM-IL (85% copy)
      ↓
10. Optimizer (restructure)
```

---

## Risk Assessment

### Low Risk (Direct Copy)

- Lexer, AST, Parser (well-tested, minimal changes)
- Config, Library, Target, Utils (no changes)

### Medium Risk (Adaptation)

- Semantic Analyzer (need to carefully remove SSA code)
- ASM-IL (interface changes)

### High Risk (Rewrite)

- IL Generator (new architecture)
- Code Generator (new architecture)

**Mitigation**: Focus on comprehensive testing at each phase.

---

## Lines of Code Estimate

| Component | v1 LOC | v2 Est LOC | Change |
|-----------|--------|------------|--------|
| Lexer | ~600 | ~550 | -50 |
| Parser | ~2000 | ~1800 | -200 |
| AST | ~800 | ~700 | -100 |
| Semantic | ~2500 | ~2000 | -500 |
| Frame Allocator | 0 | ~600 | +600 (NEW) |
| IL Generator | ~2000 | ~1200 | -800 (simpler) |
| Code Generator | ~3000 | ~1500 | -1500 (simpler) |
| ASM-IL | ~1000 | ~1000 | 0 |
| Optimizer | ~800 | ~500 | -300 |
| Config/Lib/Target | ~1000 | ~1000 | 0 |
| **Total** | ~13,700 | ~10,850 | -2,850 |

**v2 is ~21% smaller** due to SFA simplicity.

---

## Related Documents

| Document | Description |
|----------|-------------|
| [01-requirements.md](01-requirements.md) | What we're building |
| [03-package-setup.md](03-package-setup.md) | New package structure |
| [99-execution-plan.md](99-execution-plan.md) | Task breakdown |