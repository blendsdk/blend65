# Phase 7: Blend Integration

> **Document**: 99g-phase7-blend-integration.md
> **Parent**: [Execution Plan](99-execution-plan.md)
> **Last Updated**: 2025-02-01 02:40
> **Progress**: 17/17 tasks (100%)

## Phase Overview

**Objective**: Plan the integration of the God-Level SFA design into the Blend65 compiler v2.

**Prerequisites**: Phases 1-6 must be complete before starting integration planning.

**Target**: `packages/compiler-v2/src/frame/`

## Sessions Summary

| Session | Objective | Est. Time |
|---------|-----------|-----------|
| 7.1 | Type Definitions | 1-2 hours |
| 7.2 | Allocator Implementation | 1-2 hours |
| 7.3 | Compiler Integration | 1-2 hours |

---

## Session 7.1: Type Definitions

**Objective**: Define TypeScript type definitions for Blend's SFA implementation.

### Input Documents

| Document | Content |
|----------|---------|
| `god-level-sfa/01-data-structures.md` | Core data structures |
| `plans/compiler-v2/07-frame-allocator.md` | Existing Blend design |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 7.1.1 | Review existing Blend types | Notes | [ ] |
| 7.1.2 | Design FrameSlot interface | Notes | [ ] |
| 7.1.3 | Design Frame interface | Notes | [ ] |
| 7.1.4 | Design CallGraph types | Notes | [ ] |
| 7.1.5 | Document frame types | `blend-integration/01-frame-types.md` | [ ] |

### Deliverables

- [ ] `blend-integration/01-frame-types.md` complete with:
  - FrameSlot interface
  - Frame interface
  - FrameMap type
  - CallGraphNode interface
  - PlatformFrameConfig interface
  - Full TypeScript definitions ready for implementation

### Type Definitions Preview

```typescript
// From god-level-sfa design, adapted for Blend

/** Represents a single slot in a function's frame */
interface FrameSlot {
  name: string;
  type: BlendType;
  size: number;
  offset: number;          // Offset within frame
  region: 'zp' | 'ram';    // Where allocated
  zpScore: number;         // Priority score for ZP
  loopDepth: number;       // Max loop nesting depth
  accessCount: number;     // Number of accesses
  hasZpAnnotation: boolean; // Explicit @zp
}

/** Represents a function's complete frame */
interface Frame {
  functionName: string;
  slots: FrameSlot[];
  totalSize: number;
  zpSize: number;          // Portion in ZP
  ramSize: number;         // Portion in RAM
  baseAddress: number;     // Starting address
  zpBaseAddress: number;   // ZP starting address
}

/** Call graph node for frame reuse analysis */
interface CallGraphNode {
  functionName: string;
  callees: string[];
  callers: string[];
  maxCallDepth: number;
  frameCanOverlap: string[]; // Functions with reusable frames
}
```

---

## Session 7.2: Allocator Implementation

**Objective**: Plan the FrameAllocator class implementation.

### Input Documents

| Document | Content |
|----------|---------|
| `god-level-sfa/02-allocation-algorithm.md` | Allocation algorithm |
| `god-level-sfa/03-zeropage-strategy.md` | ZP strategy |
| `god-level-sfa/04-call-graph-reuse.md` | Frame reuse |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 7.2.1 | Design FrameAllocator class structure | Notes | [ ] |
| 7.2.2 | Plan allocation method | Notes | [ ] |
| 7.2.3 | Plan ZP scoring method | Notes | [ ] |
| 7.2.4 | Plan call graph analysis | Notes | [ ] |
| 7.2.5 | Document allocator implementation | `blend-integration/02-allocator-impl.md` | [ ] |

### Deliverables

- [ ] `blend-integration/02-allocator-impl.md` complete with:
  - FrameAllocator class design
  - Method signatures
  - Algorithm pseudocode
  - Error handling approach
  - Unit test plan

### FrameAllocator Class Preview

```typescript
/**
 * Static Frame Allocator for Blend65 compiler
 * Implements god-level SFA design from research
 */
class FrameAllocator {
  private callGraph: Map<string, CallGraphNode>;
  private frames: Map<string, Frame>;
  private platformConfig: PlatformFrameConfig;
  
  constructor(config: PlatformFrameConfig);
  
  /** Build call graph from AST */
  buildCallGraph(program: Program): void;
  
  /** Detect and reject recursion */
  detectRecursion(): RecursionError | null;
  
  /** Calculate frame for a function */
  calculateFrame(func: FunctionDecl): Frame;
  
  /** Calculate ZP priority score for a slot */
  calculateZpScore(slot: FrameSlot): number;
  
  /** Allocate all frames with reuse optimization */
  allocateFrames(): FrameMap;
  
  /** Get allocated frame for a function */
  getFrame(functionName: string): Frame | undefined;
}
```

---

## Session 7.3: Compiler Integration

**Objective**: Plan integration with semantic analyzer, IL generator, and code generator.

### Input Documents

| Document | Content |
|----------|---------|
| `blend-integration/02-allocator-impl.md` | Allocator design |
| `plans/compiler-v2/06-semantic-migration.md` | Semantic analyzer |
| `plans/compiler-v2/08-il-generator.md` | IL generator |
| `plans/compiler-v2/09-code-generator.md` | Code generator |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 7.3.1 | Plan semantic analyzer integration | Notes | [ ] |
| 7.3.2 | Plan IL generator integration | Notes | [ ] |
| 7.3.3 | Plan code generator integration | Notes | [ ] |
| 7.3.4 | Document integration overview | `blend-integration/00-overview.md` | [ ] |
| 7.3.5 | Document semantic integration | `blend-integration/03-semantic-integration.md` | [ ] |
| 7.3.6 | Document IL integration | `blend-integration/04-il-integration.md` | [ ] |
| 7.3.7 | Document codegen integration | `blend-integration/05-codegen-integration.md` | [ ] |

### Deliverables

- [x] `blend-integration/00-overview.md` complete with:
  - Integration strategy overview ✅
  - Phase ordering ✅
  - Data flow between components ✅

- [x] `blend-integration/03-semantic-integration.md` complete with:
  - When to call FrameAllocator ✅
  - Symbol table integration ✅
  - Recursion detection timing ✅

- [x] `blend-integration/04-il-integration.md` complete with:
  - Frame info in IL instructions ✅
  - Variable access translation ✅
  - Address resolution ✅

- [x] `blend-integration/05-codegen-integration.md` complete with:
  - Frame setup code generation ✅
  - Variable access code patterns ✅
  - Platform-specific code ✅

### Integration Points

```
┌─────────────┐
│   Parser    │
└──────┬──────┘
       │ AST
       ▼
┌─────────────┐
│  Semantic   │◄─── FrameAllocator.buildCallGraph()
│  Analyzer   │◄─── FrameAllocator.detectRecursion()
└──────┬──────┘◄─── FrameAllocator.allocateFrames()
       │ Annotated AST + FrameMap
       ▼
┌─────────────┐
│     IL      │◄─── Use Frame info for local access
│  Generator  │
└──────┬──────┘
       │ IL with frame addresses
       ▼
┌─────────────┐
│   Code      │◄─── Generate frame setup/teardown
│  Generator  │◄─── Generate variable access code
└─────────────┘
```

---

## Task Checklist (Phase 7 Only)

### Session 7.1: Type Definitions ✅ COMPLETE
- [x] 7.1.1 Review existing Blend types ✅ (2025-02-01 01:35)
- [x] 7.1.2 Design FrameSlot interface ✅ (2025-02-01 01:43)
- [x] 7.1.3 Design Frame interface ✅ (2025-02-01 01:45)
- [x] 7.1.4 Design CallGraph types ✅ (2025-02-01 01:46)
- [x] 7.1.5 Document frame types ✅ (2025-02-01 01:49)

### Session 7.2: Allocator Implementation ✅ COMPLETE
- [x] 7.2.1 Design FrameAllocator class ✅ (2025-02-01 02:23)
- [x] 7.2.2 Plan allocation method ✅ (2025-02-01 02:25)
- [x] 7.2.3 Plan ZP scoring method ✅ (2025-02-01 02:27)
- [x] 7.2.4 Plan call graph analysis ✅ (2025-02-01 02:28)
- [x] 7.2.5 Document allocator implementation ✅ (2025-02-01 02:30)

### Session 7.3: Compiler Integration ✅ COMPLETE
- [x] 7.3.1 Plan semantic integration ✅ (2025-02-01 02:35)
- [x] 7.3.2 Plan IL integration ✅ (2025-02-01 02:37)
- [x] 7.3.3 Plan codegen integration ✅ (2025-02-01 02:39)
- [x] 7.3.4 Document integration overview ✅ (2025-02-01 02:34)
- [x] 7.3.5 Document semantic integration ✅ (2025-02-01 02:36)
- [x] 7.3.6 Document IL integration ✅ (2025-02-01 02:38)
- [x] 7.3.7 Document codegen integration ✅ (2025-02-01 02:40)

---

## Session Protocol

**See [99-execution-plan.md](99-execution-plan.md) for the continuous execution workflow.**

### Quick Reference

- **Continue research**: `continue sfa research per plans/sfa_research/99-execution-plan.md`
- **During session**: Mark tasks `[x]` as completed, update progress counter
- **At ~85% context**: Wrap up, `agent.sh finished`, `attempt_completion`, then `/compact`
- **Final phase**: When Phase 7 is done, research is COMPLETE!

---

## Post-Research: Implementation

After Phase 7 is complete, the SFA research is finished. The next step is to implement the FrameAllocator in the Blend compiler v2.

**Implementation Location**: `packages/compiler-v2/src/frame/`

**Implementation Order**:
1. Create type definitions (`types.ts`)
2. Implement FrameAllocator class (`allocator.ts`)
3. Integrate with semantic analyzer
4. Integrate with IL generator
5. Integrate with code generator
6. Add comprehensive tests

**Reference Documents**:
- `blend-integration/01-frame-types.md` → `frame/types.ts`
- `blend-integration/02-allocator-impl.md` → `frame/allocator.ts`
- `blend-integration/03-semantic-integration.md` → Integration guide
- `blend-integration/04-il-integration.md` → IL changes
- `blend-integration/05-codegen-integration.md` → Codegen changes

---

**Previous Phase**: [99f-phase6-god-level-sfa.md](99f-phase6-god-level-sfa.md)
**Research Complete**: Return to [99-execution-plan.md](99-execution-plan.md)