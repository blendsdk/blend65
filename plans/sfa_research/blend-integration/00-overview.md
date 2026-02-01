# Blend Integration: Complete Overview

> **Document**: blend-integration/00-overview.md
> **Parent**: [Index](../00-index.md)
> **Status**: Design Complete
> **Last Updated**: 2025-02-01

## Overview

This document provides a complete overview of how the god-level Static Frame Allocation (SFA) design integrates into Blend65's compiler-v2 architecture. The frame allocator is a core new component that enables efficient memory management for the 6502 target.

---

## Integration Architecture

### High-Level Pipeline

```
┌────────────────────────────────────────────────────────────────────┐
│                      Blend65 Compiler v2                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Source Code                                                       │
│       │                                                            │
│       ▼                                                            │
│  ┌─────────┐                                                       │
│  │  Lexer  │                                                       │
│  └────┬────┘                                                       │
│       │ Tokens                                                     │
│       ▼                                                            │
│  ┌─────────┐                                                       │
│  │ Parser  │                                                       │
│  └────┬────┘                                                       │
│       │ AST                                                        │
│       ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SEMANTIC ANALYZER                         │   │
│  │  ┌─────────────────────────────────────────────────────────┐│   │
│  │  │ Pass 1: Symbol Table Builder                            ││   │
│  │  │ Pass 2: Type Resolution                                 ││   │
│  │  │ Pass 3: Type Checking                                   ││   │
│  │  │ Pass 5: Control Flow Analysis                           ││   │
│  │  │ Pass 6: Call Graph & Recursion Detection                ││   │
│  │  │                                                         ││   │
│  │  │  ┌────────────────────────────────────────────────────┐ ││   │
│  │  │  │           ★ FRAME ALLOCATOR (NEW) ★                │ ││   │
│  │  │  │                                                    │ ││   │
│  │  │  │  • Receives: AST + CallGraph + SymbolTable         │ ││   │
│  │  │  │  • Builds: CallGraph with coalesce groups          │ ││   │
│  │  │  │  • Detects: Recursion (compile error)              │ ││   │
│  │  │  │  • Calculates: Frame sizes per function            │ ││   │
│  │  │  │  • Allocates: ZP slots (scored priority)           │ ││   │
│  │  │  │  • Outputs: FrameMap with absolute addresses       │ ││   │
│  │  │  └────────────────────────────────────────────────────┘ ││   │
│  │  │                                                         ││   │
│  │  │ Pass 7: Advanced Analysis (uses frame info)             ││   │
│  │  └─────────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────┬──────────────────────────┘   │
│                                     │                              │
│                                     │ Typed AST + SymbolTable      │
│                                     │ + CallGraph + FrameMap       │
│                                     ▼                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      IL GENERATOR                            │   │
│  │                                                              │   │
│  │  • Receives: FrameMap with absolute addresses                │   │
│  │  • Resolves: Variable references → frame slot addresses      │   │
│  │  • Generates: IL with LOAD_BYTE $addr, STORE_BYTE $addr      │   │
│  │  • Outputs: ILProgram with ILFunctions (each has Frame ref)  │   │
│  └──────────────────────────────────┬───────────────────────────┘   │
│                                     │                              │
│                                     │ ILProgram                    │
│                                     ▼                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     CODE GENERATOR                           │   │
│  │                                                              │   │
│  │  • Receives: ILProgram (addresses already resolved)          │   │
│  │  • Generates: 6502 assembly with LDA $addr, STA $addr        │   │
│  │  • Optimizes: ZP addressing modes for @zp slots              │   │
│  │  • Outputs: ACME-compatible assembly                         │   │
│  └──────────────────────────────────┬───────────────────────────┘   │
│                                     │                              │
│                                     ▼                              │
│                              Assembly Output                       │
└────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
                    ┌──────────────┐
                    │   Program    │
                    │     AST      │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │  Symbol    │ │  CallGraph │ │  Access    │
     │  Table     │ │  Builder   │ │  Analysis  │
     └──────┬─────┘ └──────┬─────┘ └──────┬─────┘
            │              │              │
            │         ┌────┴────┐         │
            │         │ Check   │         │
            │         │Recursion│         │
            │         └────┬────┘         │
            │              │              │
            │       ┌──────┴───────┐      │
            │       │ ERROR if     │      │
            │       │ recursive    │      │
            │       └──────┬───────┘      │
            │              │ (no recursion)
            └──────────────┼──────────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │    Frame Allocator    │
               │                       │
               │ ┌───────────────────┐ │
               │ │ 1. Calculate      │ │
               │ │    Frame Sizes    │ │
               │ └─────────┬─────────┘ │
               │           │           │
               │ ┌─────────▼─────────┐ │
               │ │ 2. Build Coalesce │ │
               │ │    Groups         │ │
               │ └─────────┬─────────┘ │
               │           │           │
               │ ┌─────────▼─────────┐ │
               │ │ 3. Assign Frame   │ │
               │ │    Addresses      │ │
               │ └─────────┬─────────┘ │
               │           │           │
               │ ┌─────────▼─────────┐ │
               │ │ 4. Allocate ZP    │ │
               │ │    Slots          │ │
               │ └─────────┬─────────┘ │
               │           │           │
               │ ┌─────────▼─────────┐ │
               │ │ 5. Build Final    │ │
               │ │    Frame Map      │ │
               │ └─────────┬─────────┘ │
               └───────────┼───────────┘
                           │
                           ▼
                    ┌────────────┐
                    │  FrameMap  │
                    │            │
                    │ • frames   │
                    │ • stats    │
                    │ • diagnostics│
                    └──────┬─────┘
                           │
                           ▼
                    ┌────────────┐
                    │    IL      │
                    │ Generator  │
                    └──────┬─────┘
                           │
                           ▼
                    ┌────────────┐
                    │   Code     │
                    │ Generator  │
                    └──────┬─────┘
                           │
                           ▼
                      Assembly
```

---

## Integration Points Summary

| Phase    | Component        | Integration                                                       | Document                                                 |
| -------- | ---------------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| Semantic | SemanticAnalyzer | Primary integration point - calls FrameAllocator after call graph | [03-semantic-integration.md](03-semantic-integration.md) |
| IL       | ILGenerator      | Uses FrameMap for address resolution                              | [04-il-integration.md](04-il-integration.md)             |
| Codegen  | CodeGenerator    | Uses Frame info for addressing modes                              | [05-codegen-integration.md](05-codegen-integration.md)   |

---

## Key Integration Interfaces

### 1. FrameAllocator Input

```typescript
interface FrameAllocatorInput {
  /** The parsed AST (with type-resolved symbols) */
  program: Program;

  /** Symbol table with all declarations */
  symbolTable: SymbolTable;

  /** Call graph from semantic analysis */
  callGraph: CallGraph;

  /** Optional: Access analysis for ZP scoring */
  accessAnalysis?: AccessAnalysis;
}
```

### 2. FrameAllocator Output

```typescript
interface FrameAllocatorOutput {
  /** Map of function name → Frame */
  frameMap: FrameMap;

  /** Allocation statistics */
  stats: FrameAllocationStats;

  /** Diagnostics (errors, warnings) */
  diagnostics: Diagnostic[];

  /** Did allocation succeed? */
  success: boolean;
}
```

### 3. ILGenerator Input

```typescript
interface ILGeneratorInput {
  /** The AST module to generate IL for */
  module: ModuleDeclaration;

  /** Frame map with all addresses resolved */
  frameMap: FrameMap;

  /** Symbol table for type information */
  symbolTable: SymbolTable;
}
```

### 4. CodeGenerator Input

```typescript
interface CodeGeneratorInput {
  /** IL program with frame-relative addresses */
  ilProgram: ILProgram;

  /** Platform configuration (C64, X16, etc.) */
  platform: PlatformConfig;
}
```

---

## Phase Ordering

The frame allocator must run at a specific point in the compilation pipeline:

```
1. Lexer                          ✓ (no change)
2. Parser                         ✓ (no change)
3. Semantic Pass 1: Symbols       ✓ (no change)
4. Semantic Pass 2: Types         ✓ (no change)
5. Semantic Pass 3: Type Check    ✓ (no change)
6. Semantic Pass 5: Control Flow  ✓ (no change)
7. Semantic Pass 6: Call Graph    ✓ (provides input)
   │
   ├─── 6a. Recursion Detection   ★ (MUST run before allocation)
   │         └─── ERROR if recursive
   │
   └─── 6b. Frame Allocation      ★ NEW INTEGRATION POINT
             │
             ├─── Build coalesce groups
             ├─── Calculate frame sizes
             ├─── Assign addresses
             └─── Allocate ZP slots

8. Semantic Pass 7: Advanced      Uses frame info for hints
9. IL Generation                  Uses FrameMap for addresses
10. Code Generation               Uses IL with resolved addresses
```

---

## Documents in This Section

| #   | Document                                                 | Description                          | Status      |
| --- | -------------------------------------------------------- | ------------------------------------ | ----------- |
| 00  | [00-overview.md](00-overview.md)                         | This document - integration overview | ✅ Complete |
| 01  | [01-frame-types.md](01-frame-types.md)                   | TypeScript type definitions          | ✅ Complete |
| 02  | [02-allocator-impl.md](02-allocator-impl.md)             | Allocator implementation             | ✅ Complete |
| 03  | [03-semantic-integration.md](03-semantic-integration.md) | Semantic phase integration           | ✅ Complete |
| 04  | [04-il-integration.md](04-il-integration.md)             | IL generator integration             | ✅ Complete |
| 05  | [05-codegen-integration.md](05-codegen-integration.md)   | Code generator integration           | ✅ Complete |

---

## File Structure After Integration

```
packages/compiler-v2/src/
├── semantic/
│   ├── analyzer.ts              # Modified: calls FrameAllocator
│   ├── call-graph.ts            # Existing: provides call graph
│   ├── recursion-checker.ts     # Existing: validates no recursion
│   └── ...
│
├── frame/                       # NEW: SFA implementation
│   ├── index.ts                 # Module exports
│   ├── types.ts                 # Type definitions
│   ├── enums.ts                 # Enums (SlotLocation, etc.)
│   ├── call-graph.ts            # CallGraph types
│   ├── platform.ts              # Platform configs
│   ├── config.ts                # Allocator config
│   ├── guards.ts                # Type guards
│   └── allocator/
│       ├── index.ts
│       ├── base.ts              # BaseAllocator
│       ├── call-graph-builder.ts
│       ├── frame-calculator.ts
│       ├── zp-allocator.ts
│       ├── frame-allocator.ts   # Main entry point
│       └── zp-pool.ts
│
├── il/
│   ├── generator.ts             # Modified: uses FrameMap
│   ├── types.ts                 # ILFunction includes Frame ref
│   └── ...
│
└── codegen/
    ├── generator.ts             # Uses IL with addresses
    └── ...
```

---

## Implementation Priority

1. **Phase 1**: Type definitions (`frame/types.ts`, `frame/enums.ts`) - Session 7.1 ✅
2. **Phase 2**: Allocator implementation (`frame/allocator/`) - Session 7.2 ✅
3. **Phase 3**: Semantic integration - Session 7.3 ✅
4. **Phase 4**: IL integration - Future implementation
5. **Phase 5**: Codegen integration - Future implementation
6. **Phase 6**: Comprehensive testing

---

## Success Criteria

The integration is successful when:

1. ✅ Frame allocator types defined
2. ✅ Allocator implementation designed
3. ✅ Semantic integration planned
4. ✅ IL integration planned
5. ✅ Codegen integration planned
6. ⬜ All tests pass
7. ⬜ Sample programs compile correctly
8. ⬜ Memory usage is optimal (coalescing works)
9. ⬜ ZP allocation improves performance

---

## Related Documents

| Document                 | Location                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| God-Level SFA Design     | [../god-level-sfa/](../god-level-sfa/)                                                   |
| Frame Types Design       | [01-frame-types.md](01-frame-types.md)                                                   |
| Allocator Implementation | [02-allocator-impl.md](02-allocator-impl.md)                                             |
| Compiler v2 Semantic     | [../../compiler-v2/06-semantic-migration.md](../../compiler-v2/06-semantic-migration.md) |
| Compiler v2 IL           | [../../compiler-v2/08-il-generator.md](../../compiler-v2/08-il-generator.md)             |
| Compiler v2 Codegen      | [../../compiler-v2/09-code-generator.md](../../compiler-v2/09-code-generator.md)         |
