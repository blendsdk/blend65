# Current State Analysis

> **Document**: 02-current-state.md
> **Parent**: [00-index.md](00-index.md)
> **Status**: Analysis Complete

## Overview

This document analyzes the current state of the Blend65 compiler-v2 to identify what exists and what needs to be built for SFA implementation.

---

## 1. Existing Infrastructure

### 1.1 Call Graph (✅ Exists)

**Location**: `packages/compiler-v2/src/semantic/call-graph.ts`

The call graph implementation is **complete and robust**:

| Component | Status | Description |
|-----------|--------|-------------|
| `CallGraph` class | ✅ Complete | Tracks function call relationships |
| `CallGraphNode` interface | ✅ Complete | Node with callees/callers |
| `CallSite` interface | ✅ Complete | Tracks call locations |
| `CallGraphBuilder` class | ✅ Complete | Builds graph from AST |
| Recursion detection | ✅ Complete | Direct and indirect detection |
| Cycle finding | ✅ Complete | DFS-based cycle detection |
| Entry point finding | ✅ Complete | Functions with no callers |
| Leaf function finding | ✅ Complete | Functions with no callees |
| Unreachable detection | ✅ Complete | Dead code detection |

**Key Methods Available**:
```typescript
callGraph.addFunction(name, location, symbol?, declaration?)
callGraph.addCall(caller, callee, location)
callGraph.isDirectlyRecursive(name): boolean
callGraph.isRecursive(name): boolean
callGraph.findCycleFrom(name): string[] | null
callGraph.detectDirectRecursion(): string[]
callGraph.detectAllCycles(): string[][]
callGraph.getMaxCallDepth(entryPoint): number
callGraph.findEntryPoints(): string[]
callGraph.findLeafFunctions(): string[]
callGraph.findUnreachableFunctions(entryPoint): Set<string>
```

### 1.2 Recursion Checker (✅ Exists)

**Location**: `packages/compiler-v2/src/semantic/recursion-checker.ts`

Recursion checking functionality is available via CallGraph methods.

### 1.3 Symbol Table (✅ Exists)

**Location**: `packages/compiler-v2/src/semantic/symbol-table.ts`

Full symbol table implementation with:
- Symbol lookup
- Scope management
- Type information

### 1.4 AST Walker (✅ Exists)

**Location**: `packages/compiler-v2/src/ast/walker/`

AST traversal infrastructure:
- Base walker class
- Collector walker
- Transformer walker
- Context management

### 1.5 Frame Module (⬜ Stub Only)

**Location**: `packages/compiler-v2/src/frame/index.ts`

Current state: **Only a stub comment file**

```typescript
// Will be populated in Phase 6: Frame Allocator
// export * from './types.js';
// export * from './call-graph.js';
// export * from './recursion.js';
// export * from './allocator.js';
```

**Needs to be built from scratch**.

### 1.6 IL Generator (⬜ Stub)

**Location**: `packages/compiler-v2/src/il/index.ts`

Current state: Stub file, needs implementation.

### 1.7 Code Generator (⬜ Stub)

**Location**: `packages/compiler-v2/src/codegen/index.ts`

Current state: Stub file, needs implementation.

---

## 2. File Structure (After SFA Implementation)

### 2.1 New Files to Create

```
packages/compiler-v2/src/frame/
├── index.ts                # Module exports
├── types.ts                # Core type definitions
├── enums.ts                # SlotKind, SlotLocation, ZpDirective
├── platform.ts             # Platform configurations (C64, X16)
├── config.ts               # Allocator configuration
├── guards.ts               # Type guards for SFA types
│
├── allocator/
│   ├── index.ts            # Allocator exports
│   ├── base.ts             # BaseAllocator (utilities)
│   ├── frame-calculator.ts # Calculate frame sizes
│   ├── zp-allocator.ts     # Zero page allocation
│   ├── zp-pool.ts          # ZP pool management
│   ├── coalescer.ts        # Frame coalescing
│   └── frame-allocator.ts  # Main FrameAllocator class
│
└── __tests__/
    ├── enums.test.ts
    ├── types.test.ts
    ├── platform.test.ts
    ├── frame-calculator.test.ts
    ├── zp-allocator.test.ts
    ├── coalescer.test.ts
    ├── frame-allocator.test.ts
    └── integration/
        ├── basic-allocation.test.ts
        ├── coalescing.test.ts
        ├── zp-scoring.test.ts
        └── error-cases.test.ts
```

### 2.2 Files to Modify

| File | Modification |
|------|--------------|
| `semantic/analyzer.ts` | Call FrameAllocator after call graph build |
| `semantic/index.ts` | Export frame-related types |
| `il/generator.ts` | Use FrameMap for address resolution |
| `codegen/generator.ts` | Use Frame info for addressing modes |

---

## 3. Dependency Analysis

### 3.1 SFA Dependencies

```
                    ┌──────────────────┐
                    │   AST (exists)   │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │  Symbol    │ │  CallGraph │ │  Type      │
       │  Table     │ │  (exists)  │ │  System    │
       │  (exists)  │ └──────┬─────┘ │  (exists)  │
       └──────┬─────┘        │       └──────┬─────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │      FRAME ALLOCATOR         │
              │         (TO BUILD)           │
              │                              │
              │  ┌────────────────────────┐  │
              │  │ 1. FrameCalculator     │  │
              │  │ 2. ZPAllocator         │  │
              │  │ 3. Coalescer           │  │
              │  │ 4. AddressAssigner     │  │
              │  └────────────────────────┘  │
              └──────────────┬───────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │    FrameMap    │
                    │    (OUTPUT)    │
                    └────────┬───────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │     IL     │ │   Code     │ │  Assembly  │
       │ Generator  │ │ Generator  │ │   Output   │
       │ (TO BUILD) │ │ (TO BUILD) │ │            │
       └────────────┘ └────────────┘ └────────────┘
```

### 3.2 Build Order

1. **Frame Types** - No dependencies, pure TypeScript interfaces
2. **Platform Config** - Depends on Frame Types
3. **Frame Calculator** - Depends on CallGraph, SymbolTable
4. **ZP Allocator** - Depends on Frame Types, Platform Config
5. **Coalescer** - Depends on CallGraph, Frame Calculator
6. **Frame Allocator** - Depends on all above
7. **Semantic Integration** - Depends on Frame Allocator
8. **IL Integration** - Depends on FrameMap
9. **Codegen Integration** - Depends on IL with addresses

---

## 4. Existing Tests Analysis

### 4.1 Call Graph Tests (✅ Exist)

**Location**: `packages/compiler-v2/src/__tests__/semantic/call-graph.test.ts`

Tests exist for:
- Basic call graph construction
- Caller/callee relationships
- Recursion detection
- Cycle detection

### 4.2 Semantic Tests (✅ Exist)

Comprehensive semantic test suite exists covering:
- Symbol table building
- Type resolution
- Type checking
- Control flow analysis
- Multi-module analysis

### 4.3 SFA Tests (⬜ Need to Create)

All SFA tests need to be created:
- Frame type tests
- Allocator tests
- Coalescing tests
- Integration tests
- E2E tests

---

## 5. Gaps to Fill

### 5.1 Type Definitions Gap

| Need | Status |
|------|--------|
| `SlotKind` enum | ⬜ To create |
| `SlotLocation` enum | ⬜ To create |
| `ZpDirective` enum | ⬜ To create |
| `FrameSlot` interface | ⬜ To create |
| `Frame` interface | ⬜ To create |
| `FrameMap` interface | ⬜ To create |
| `FrameAllocationResult` interface | ⬜ To create |
| `PlatformConfig` interface | ⬜ To create |

### 5.2 Allocator Gap

| Need | Status |
|------|--------|
| `BaseAllocator` class | ⬜ To create |
| `FrameCalculator` class | ⬜ To create |
| `ZPAllocator` class | ⬜ To create |
| `ZPPool` class | ⬜ To create |
| `Coalescer` class | ⬜ To create |
| `FrameAllocator` class | ⬜ To create |

### 5.3 Integration Gap

| Need | Status |
|------|--------|
| Semantic → FrameAllocator call | ⬜ To implement |
| FrameMap → IL resolution | ⬜ To implement |
| Frame → Codegen addressing | ⬜ To implement |

### 5.4 Missing Call Graph Features

The existing CallGraph needs extensions for SFA:

| Need | Status |
|------|--------|
| Thread context tracking (main/ISR) | ⬜ To add |
| Callback function identification | ⬜ To add |
| Cross-thread call detection | ⬜ To add |

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CallGraph extensions break existing tests | Medium | Add extensions as new methods, don't modify existing |
| IL/Codegen stubs complicate integration | High | Build minimal IL/Codegen with SFA support first |
| Coalescing algorithm complexity | Medium | Implement simple version first, optimize later |
| Thread context detection edge cases | Medium | Start with simple heuristics, refine with tests |

---

## 7. Summary

### What Exists (✅)

- CallGraph class with recursion detection
- Symbol table infrastructure
- AST walker infrastructure
- Comprehensive semantic analyzer
- Test infrastructure

### What Needs Building (⬜)

- All frame type definitions
- Platform configurations
- Frame allocator and sub-components
- Coalescing algorithm
- ZP allocation with scoring
- Thread context tracking
- IL generator integration
- Code generator integration
- Comprehensive test suite

### Estimated Effort

| Phase | Components | Estimated Sessions |
|-------|------------|-------------------|
| Types | Enums, interfaces, configs | 3-4 |
| Allocator | Calculator, ZP, Coalescer, Main | 6-8 |
| Integration | Semantic, IL, Codegen | 6-8 |
| Testing | Unit, Integration, E2E | 6-8 |
| **Total** | | **21-28 sessions** |

---

**Next Document**: [05-testing/05-overview.md](05-testing/05-overview.md)