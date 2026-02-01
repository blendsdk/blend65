# Blend Integration: Allocator Implementation Index

> **Document**: blend-integration/02-allocator-impl.md
> **Parent**: [00-overview.md](00-overview.md)
> **Status**: Design Complete
> **Target Directory**: `packages/compiler-v2/src/frame/allocator/`

## Overview

This document serves as the index for all allocator implementation design documents. The FrameAllocator is the core component of Static Frame Allocation (SFA) for Blend65 v2.

---

## Document Index

| # | Document | Target File | Description |
|---|----------|-------------|-------------|
| 02a | [Allocator Class](02a-allocator-class.md) | `allocator/*.ts` | Class hierarchy and structure |
| 02b | [Allocation Method](02b-allocation-method.md) | `frame-calculator.ts`, `frame-allocator.ts` | Frame size calculation, coalescing, address assignment |
| 02c | [ZP Scoring](02c-zp-scoring.md) | `zp-allocator.ts` | Zero page scoring and allocation |
| 02d | [Call Graph Analysis](02d-call-graph-analysis.md) | `call-graph-builder.ts` | Call graph construction, recursion detection |

---

## Implementation File Structure

```
packages/compiler-v2/src/frame/
├── index.ts                      # Module exports
├── types.ts                      # Type definitions (from 01b-01d)
├── enums.ts                      # Enums (from 01a)
├── call-graph.ts                 # CallGraph types (from 01e)
├── platform.ts                   # Platform configs (from 01f)
├── config.ts                     # Allocator config (from 01g)
├── guards.ts                     # Type guards
└── allocator/
    ├── index.ts                  # Allocator exports
    ├── base.ts                   # BaseAllocator
    ├── call-graph-builder.ts     # CallGraphBuilder
    ├── frame-calculator.ts       # FrameSizeCalculator
    ├── zp-allocator.ts           # ZpAllocator
    ├── frame-allocator.ts        # FrameAllocator (final)
    └── zp-pool.ts                # ZpPool utility class
```

---

## Class Hierarchy

```
BaseAllocator (base.ts)
    │
    │   - Diagnostic collection
    │   - Error handling utilities
    │   - Configuration management
    │   - Type size calculation
    │
    ↓
CallGraphBuilder (call-graph-builder.ts)
    │
    │   - Build call graph from AST
    │   - Detect recursion
    │   - Thread context propagation
    │   - Recursive caller computation
    │
    ↓
FrameSizeCalculator (frame-calculator.ts)
    │
    │   - Calculate frame sizes
    │   - Collect parameter slots
    │   - Collect local variable slots
    │   - Extract ZP directives
    │
    ↓
ZpAllocator (zp-allocator.ts)
    │
    │   - ZP scoring algorithm
    │   - ZP pool management
    │   - Multi-phase allocation
    │   - Directive handling (@zp, @ram)
    │
    ↓
FrameAllocator (frame-allocator.ts)
    
        - Main entry point
        - Coalesce group building
        - Address assignment
        - Final frame construction
```

---

## Allocation Pipeline

```
Input: Program AST + Access Analysis
                │
                ▼
┌───────────────────────────────────┐
│    1. Build Call Graph            │  ← 02d-call-graph-analysis.md
│       - Create nodes              │
│       - Find call relationships   │
│       - Detect recursion (ERROR)  │
│       - Compute thread contexts   │
│       - Compute recursive callers │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│    2. Calculate Frame Sizes       │  ← 02b-allocation-method.md
│       - Collect parameter slots   │
│       - Collect local slots       │
│       - Extract ZP directives     │
│       - Calculate total sizes     │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│    3. Build Coalesce Groups       │  ← 02b-allocation-method.md
│       - Group non-overlapping     │
│       - Same thread context       │
│       - No recursion              │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│    4. Assign Frame Addresses      │  ← 02b-allocation-method.md
│       - Sort groups by size       │
│       - Assign contiguous memory  │
│       - Apply alignment           │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│    5. Allocate Zero Page          │  ← 02c-zp-scoring.md
│       - Calculate scores          │
│       - Sort by priority          │
│       - Allocate @zp required     │
│       - Allocate @zp preferred    │
│       - Allocate automatic        │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│    6. Build Final Frames          │  ← 02b-allocation-method.md
│       - Create Frame objects      │
│       - Assign slot addresses     │
│       - Calculate statistics      │
└───────────────┬───────────────────┘
                │
                ▼
Output: FrameMap + Diagnostics
```

---

## Key Algorithms Summary

### Call Graph (02d)

| Algorithm | Purpose | Complexity |
|-----------|---------|------------|
| DFS with coloring | Recursion detection | O(V + E) |
| BFS context propagation | Thread context analysis | O(V + E) |
| Transitive closure | Recursive callers | O(V²) |
| BFS depth calculation | Call depth analysis | O(V + E) |

### Allocation (02b)

| Algorithm | Purpose | Complexity |
|-----------|---------|------------|
| AST walk | Frame size calculation | O(n) |
| Greedy bin packing | Coalescing | O(V²) |
| Linear scan | Address assignment | O(V) |

### ZP Scoring (02c)

| Algorithm | Purpose | Complexity |
|-----------|---------|------------|
| Multi-factor scoring | Prioritization | O(S) |
| Priority queue | Allocation order | O(S log S) |
| First-fit contiguous | Pool allocation | O(P × S) |

Where V = functions, E = call edges, S = slots, P = ZP pool size, n = AST nodes

---

## Usage Example

```typescript
import { FrameAllocator, AllocatorConfigBuilder } from './frame/index.js';

// Configure allocator
const config = new AllocatorConfigBuilder()
  .forPlatform('c64')
  .enableCoalescing(true)
  .setZpWeight('pointer', 4096)
  .build();

// Create allocator
const allocator = new FrameAllocator(config);

// Run allocation
const result = allocator.allocate(program, accessAnalysis);

// Handle result
if (result.hasErrors) {
  for (const diag of result.diagnostics) {
    console.error(`${diag.code}: ${diag.message}`);
  }
  throw new Error('Frame allocation failed');
}

// Use frame map
const frameMap = result.frameMap;
console.log(`Total functions: ${frameMap.stats.totalFunctions}`);
console.log(`Frame region used: ${frameMap.stats.frameRegionUsed} bytes`);
console.log(`ZP used: ${frameMap.stats.zpUsed} bytes`);
console.log(`Coalescing saved: ${frameMap.stats.coalesceBytesSaved} bytes`);

// Access individual frames
for (const [funcName, frame] of frameMap.frames) {
  console.log(`\n${funcName}:`);
  console.log(`  Base address: $${frame.frameBaseAddress.toString(16)}`);
  console.log(`  Total size: ${frame.totalFrameSize} bytes`);
  console.log(`  ZP size: ${frame.totalZpSize} bytes`);
  
  for (const slot of frame.slots) {
    const loc = slot.location === SlotLocation.ZeroPage ? 'ZP' : 'RAM';
    console.log(`    ${slot.name}: $${slot.address.toString(16)} (${loc})`);
  }
}
```

---

## Memory Savings Example

```
Program with 10 functions:
  main, game_loop, update, draw, move_player
  draw_player, draw_enemies, check_collision
  update_timer, play_sound

Without coalescing:
  Total frame bytes: 156 bytes

With coalescing:
  - update & draw can share (don't call each other)
  - move_player, draw_player, draw_enemies can share
  - check_collision can join the above group
  - update_timer & play_sound can share (ISR context)
  
  Total frame bytes: 98 bytes
  Saved: 58 bytes (37.2% reduction)

With ZP allocation:
  - Hot loop variables → ZP
  - Pointers → ZP
  - Score counters → RAM
  
  ZP used: 24 bytes (for hot variables)
  Performance: ~20-30% faster for inner loops
```

---

## Session 7.2 Completion Status

All allocator implementation documents are complete:

- [x] 02a - Allocator Class Structure ✅
- [x] 02b - Allocation Method ✅
- [x] 02c - ZP Scoring Method ✅
- [x] 02d - Call Graph Analysis ✅
- [x] 02 - Index Document (this file) ✅

---

## Next Steps

**Session 7.3: Compiler Integration**
- Plan semantic analyzer integration
- Plan IL generator integration
- Plan code generator integration
- Document integration points

**Documents to create:**
- `03-semantic-integration.md`
- `04-il-integration.md`
- `05-codegen-integration.md`

---

## Related Documents

| Document | Content |
|----------|---------|
| [01-frame-types.md](01-frame-types.md) | Type definitions (Session 7.1) |
| [00-overview.md](00-overview.md) | Integration overview |
| [../god-level-sfa/](../god-level-sfa/) | Original SFA research |