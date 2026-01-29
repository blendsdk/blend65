# Blend65 Compiler - Master Implementation Plan

> **Status**: Transitioning to v2 | **Architecture**: Static Frame Allocation (SFA)  
> **Last Updated**: January 29, 2026  
> **Version**: 2.0.0-planning  
> **Language Spec**: `docs/language-specification-v2/`

---

## Executive Summary

The Blend65 compiler is transitioning from v1 (SSA-based) to **v2 (SFA-based)** architecture. The v2 compiler uses **Static Frame Allocation (SFA)** instead of SSA, which is a better fit for the 6502's limited registers and stack.

### **v2 Compiler Architecture**

```
Source Code → Lexer → Parser → Semantic Analyzer → Frame Allocator → IL Generator → Code Generator → Optimizer → Assembly
```

### **Key v2 Changes**

| Feature | v1 | v2 |
|---------|----|----|
| **IR Architecture** | SSA with PHI nodes | Static Frame Allocation (SFA) |
| **Memory Mapping** | @map syntax | peek/poke intrinsics |
| **Recursion** | Attempted support | Prohibited (compile error) |
| **Hardware Access** | @map declarations | Intrinsic functions |

---

## v2 Architecture Overview

### Static Frame Allocation (SFA)

Unlike SSA which uses virtual registers and PHI nodes, SFA allocates a **static memory frame** for each function at compile time:

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

### Why SFA Over SSA?

| Aspect | SSA | SFA |
|--------|-----|-----|
| Complexity | High (PHI nodes, interference graphs) | Low (direct memory allocation) |
| 6502 Fit | Poor (3 registers, no stack frames) | Excellent (matches hardware model) |
| Code Generation | Complex lowering required | Direct memory access |
| Recursion | Requires runtime stack | Not supported (by design) |
| Performance | Requires sophisticated optimizer | Naturally efficient |

---

## Current Status

### v1 Components (Salvageable)

| Component | Status | v2 Reuse |
|-----------|--------|----------|
| Lexer | ✅ Complete | ✅ Copy with minor changes |
| Parser | ✅ Complete | ✅ Copy, remove @map syntax |
| AST Types | ✅ Complete | ✅ Copy, remove @map nodes |
| Type System | ✅ Complete | ✅ Copy as-is |
| Symbol Tables | ✅ Complete | ⚠️ Adapt for SFA |
| Semantic Analyzer | ✅ Complete | ⚠️ Major adaptation needed |
| IL Generator | ✅ Complete | ❌ Rewrite for SFA |
| Code Generator | ✅ Complete | ❌ Rewrite for SFA |

### v2 Components (New)

| Component | Status | Description |
|-----------|--------|-------------|
| Frame Allocator | 🔜 Planning | Static memory allocation per function |
| SFA IL Generator | 🔜 Planning | Linear IL without SSA |
| SFA Code Generator | 🔜 Planning | Direct memory access codegen |
| Recursion Checker | 🔜 Planning | Call graph analysis to prohibit recursion |

---

## Implementation Phases

### Phase 1: Package Setup & Migration
**Status**: Not Started | **Estimate**: 2-3 sessions

1. Create `packages/compiler-v2/` package
2. Copy salvageable components from v1
3. Set up build and test infrastructure
4. Update imports and references

### Phase 2: Lexer & Parser Adaptation
**Status**: Not Started | **Estimate**: 2-3 sessions

1. Copy lexer with minimal changes
2. Remove @map tokens from keyword list
3. Copy parser, remove @map parsing
4. Update AST types to remove @map nodes
5. Add tests for v2 syntax

### Phase 3: Semantic Analyzer Adaptation
**Status**: Not Started | **Estimate**: 4-6 sessions

1. Copy type system and symbol tables
2. Add recursion detection (call graph analysis)
3. Remove @map validation
4. Add intrinsic function validation
5. Adapt for SFA memory model

### Phase 4: Frame Allocator (NEW)
**Status**: Not Started | **Estimate**: 4-6 sessions

1. Design frame structure
2. Implement frame builder
3. Global memory layout
4. Zero-page allocation
5. Frame collision detection

### Phase 5: SFA IL Generator (NEW)
**Status**: Not Started | **Estimate**: 6-8 sessions

1. Design linear IL (no SSA)
2. Implement expression translation
3. Implement statement translation
4. Implement function handling
5. Integrate with frame allocator

### Phase 6: SFA Code Generator (NEW)
**Status**: Not Started | **Estimate**: 6-8 sessions

1. Design direct memory codegen
2. Implement expression codegen
3. Implement statement codegen
4. Implement function calls
5. Implement intrinsics

### Phase 7: Integration & Testing
**Status**: Not Started | **Estimate**: 4-6 sessions

1. End-to-end pipeline integration
2. Comprehensive test suite
3. Example program compilation
4. VICE testing validation

---

## Timeline Estimate

| Phase | Sessions | Estimate |
|-------|----------|----------|
| Package Setup | 2-3 | 1-2 days |
| Lexer/Parser | 2-3 | 1-2 days |
| Semantic Analyzer | 4-6 | 2-3 days |
| Frame Allocator | 4-6 | 2-3 days |
| IL Generator | 6-8 | 3-4 days |
| Code Generator | 6-8 | 3-4 days |
| Integration | 4-6 | 2-3 days |
| **Total** | **28-40** | **15-21 days** |

---

## Related Plans

### Active Plans

| Plan | Description |
|------|-------------|
| `plans/compiler-v2/` | Detailed v2 compiler implementation |
| `plans/optimizer-series/` | Optimizer roadmap (7 phases) |
| `plans/dx-features/` | Developer experience features |
| `plans/features/` | Feature research docs |
| `plans/native-assembler/` | Native assembler planning |

### References

| Document | Description |
|----------|-------------|
| `docs/language-specification-v2/` | Complete v2 language specification |
| `docs/language-specification-v2/10-compiler.md` | SFA architecture details |

---

## Success Criteria

### v2 Compiler Complete When:

1. ✅ All v2 language features supported
2. ✅ Recursion properly prohibited
3. ✅ No @map syntax (peek/poke instead)
4. ✅ SFA generates correct code
5. ✅ Example programs compile and run
6. ✅ All tests passing
7. ✅ Code runs correctly in VICE

### Quality Requirements

- 5,000+ tests for v2
- Zero critical bugs
- Clear error messages
- Documentation complete

---

## Next Steps

1. **Review** `plans/compiler-v2/00-index.md`
2. **Fill out** detailed v2 implementation documents
3. **Begin** Phase 1: Package Setup

---

**Last Updated**: January 29, 2026  
**Maintained By**: Blend65 Development Team  
**Status**: v2 Planning