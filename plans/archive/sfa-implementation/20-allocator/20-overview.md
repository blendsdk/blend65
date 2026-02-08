# Phase 2: Frame Allocator Core

> **Document**: 20-allocator/20-overview.md
> **Parent**: [../00-index.md](../00-index.md)
> **Status**: Ready

## Overview

This phase implements the core frame allocation components: frame size calculator, ZP allocator, and the main frame allocator class.

---

## 1. Components to Build

| Component | File | Purpose |
|-----------|------|---------|
| FrameCalculator | `frame-calculator.ts` | Calculate frame sizes from AST |
| ZPPool | `zp-pool.ts` | Manage ZP address pool |
| ZPAllocator | `zp-allocator.ts` | Score and allocate ZP slots |
| FrameAllocator | `frame-allocator.ts` | Main allocator orchestrator |

---

## 2. FrameCalculator

### 2.1 Purpose

Calculates frame size for each function by summing:
- Parameter sizes
- Local variable sizes
- Return value slot (if non-void)

### 2.2 Algorithm

```typescript
class FrameCalculator {
  calculateFrame(func: FunctionDecl, symbolTable: SymbolTable): Frame {
    const slots: FrameSlot[] = [];
    let offset = 0;
    
    // 1. Parameters
    for (const param of func.getParameters()) {
      const size = this.getTypeSize(param.type);
      slots.push({
        name: param.name,
        kind: SlotKind.Parameter,
        size,
        offset,
        directive: this.getDirective(param),
        // ...
      });
      offset += size;
    }
    
    // 2. Locals (from function body)
    for (const local of this.findLocals(func.getBody())) {
      const size = this.getTypeSize(local.type);
      slots.push({
        name: local.name,
        kind: SlotKind.Local,
        size,
        offset,
        directive: this.getDirective(local),
        // ...
      });
      offset += size;
    }
    
    // 3. Return value (if non-void)
    if (func.getReturnType() !== 'void') {
      slots.push({
        name: '$return',
        kind: SlotKind.Return,
        size: this.getTypeSize(func.getReturnType()),
        offset,
        // ...
      });
    }
    
    return { functionName: func.getName(), slots, totalSize: offset, /* ... */ };
  }
}
```

### 2.3 Type Sizes

| Type | Size | Notes |
|------|------|-------|
| `byte` | 1 | |
| `word` | 2 | |
| `bool` | 1 | |
| `pointer` | 2 | |
| `byte[N]` | N | Array size |

---

## 3. ZP Allocator

### 3.1 Purpose

Manages Zero Page allocation with scoring and directive enforcement.

### 3.2 Scoring Formula

```typescript
function calculateZPScore(slot: FrameSlot, accessInfo: AccessInfo): number {
  // Type weight
  let score = TYPE_WEIGHTS[slot.type];
  
  // Access count bonus
  score *= accessInfo.readCount + accessInfo.writeCount;
  
  // Loop bonus (×2 per loop depth)
  score *= Math.pow(2, accessInfo.maxLoopDepth);
  
  // Directive bonus
  if (slot.directive === ZpDirective.Required) {
    score = Number.MAX_SAFE_INTEGER;  // Highest priority
  }
  
  return score;
}

const TYPE_WEIGHTS = {
  pointer: 0x800,  // Highest - enables indirect Y
  byte: 0x100,     // Good benefit
  word: 0x080,     // Less benefit
  array: 0x000,    // No ZP for arrays
};
```

### 3.3 Allocation Algorithm

```typescript
class ZPAllocator {
  allocate(slots: FrameSlot[], config: PlatformConfig): void {
    // 1. Separate by directive
    const required = slots.filter(s => s.directive === ZpDirective.Required);
    const forbidden = slots.filter(s => s.directive === ZpDirective.Forbidden);
    const auto = slots.filter(s => s.directive === ZpDirective.None);
    
    // 2. Allocate required first (error if impossible)
    for (const slot of required) {
      if (!this.zpPool.canAllocate(slot.size)) {
        throw new ZPOverflowError(slot);
      }
      slot.address = this.zpPool.allocate(slot.size);
      slot.location = SlotLocation.ZeroPage;
    }
    
    // 3. Forbidden go to RAM
    for (const slot of forbidden) {
      slot.location = SlotLocation.GeneralRAM;
    }
    
    // 4. Auto-allocate by score
    const sorted = auto.sort((a, b) => b.zpScore - a.zpScore);
    for (const slot of sorted) {
      if (this.zpPool.canAllocate(slot.size)) {
        slot.address = this.zpPool.allocate(slot.size);
        slot.location = SlotLocation.ZeroPage;
      } else {
        slot.location = SlotLocation.FrameRegion;  // Fallback
      }
    }
  }
}
```

---

## 4. Frame Allocator (Main Orchestrator)

### 4.1 Purpose

Orchestrates the entire allocation process.

### 4.2 Algorithm

```typescript
class FrameAllocator {
  allocate(
    program: Program,
    callGraph: CallGraph,
    symbolTable: SymbolTable
  ): FrameAllocationResult {
    const diagnostics: FrameDiagnostic[] = [];
    
    // 1. Check for recursion
    const cycles = callGraph.detectAllCycles();
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        diagnostics.push({
          code: 'RECURSION',
          severity: 'error',
          message: `Recursive call detected: ${cycle.join(' → ')}`,
        });
      }
      return { frameMap: new Map(), stats: {}, diagnostics, success: false };
    }
    
    // 2. Calculate frame sizes
    const frames = new Map<string, Frame>();
    for (const func of this.getAllFunctions(program)) {
      frames.set(func.getName(), this.calculator.calculateFrame(func, symbolTable));
    }
    
    // 3. Build coalesce groups (Phase 3)
    const groups = this.coalescer.buildGroups(callGraph, frames);
    
    // 4. Assign frame region addresses
    let nextAddress = this.config.frameRegion.start;
    for (const group of groups) {
      const groupSize = Math.max(...group.map(f => frames.get(f)!.totalSize));
      for (const funcName of group) {
        frames.get(funcName)!.baseAddress = nextAddress;
        frames.get(funcName)!.coalesceGroup = group.id;
      }
      nextAddress += groupSize;
    }
    
    // 5. Check frame region overflow
    if (nextAddress > this.config.frameRegion.end) {
      diagnostics.push({
        code: 'FRAME_OVERFLOW',
        severity: 'error',
        message: `Frame region overflow: ${nextAddress - this.config.frameRegion.start} > ${this.config.frameRegion.end - this.config.frameRegion.start} bytes`,
      });
      return { frameMap: frames, stats: {}, diagnostics, success: false };
    }
    
    // 6. Allocate ZP
    const allSlots = Array.from(frames.values()).flatMap(f => f.slots);
    this.zpAllocator.allocate(allSlots, this.config);
    
    // 7. Compute stats
    const stats = this.computeStats(frames, groups);
    
    return { frameMap: frames, stats, diagnostics, success: true };
  }
}
```

---

## 5. Integration Tests

```typescript
describe('Frame Allocator Integration', () => {
  it('should allocate simple program', () => {
    const source = INLINE_FIXTURES.simpleLocals;
    const result = allocateFrames(source);
    
    expectNoErrors(result);
    expectFrameAt(result, 'main', 0x0200);
  });

  it('should detect recursion', () => {
    const source = INLINE_FIXTURES.directRecursion;
    const result = allocateFrames(source);
    
    expectError(result, 'RECURSION');
  });

  it('should enforce @zp directive', () => {
    const source = INLINE_FIXTURES.zpRequired;
    const result = allocateFrames(source);
    
    expectSlotInZP(result.frameMap.get('main')!, 'counter');
  });
});
```

---

## 6. Sessions

| Session | Tasks | Est. Time |
|---------|-------|-----------|
| **2.1** | FrameCalculator + tests | 20 min |
| **2.2** | ZPPool + tests | 15 min |
| **2.3** | ZPAllocator (scoring) + tests | 20 min |
| **2.4** | ZPAllocator (allocation) + tests | 20 min |
| **2.5** | FrameAllocator (basic) + tests | 20 min |
| **2.6** | FrameAllocator (integration) + tests | 20 min |

**Total: ~2 hours**

---

## 7. Success Criteria

Phase 2 is complete when:

- [ ] FrameCalculator calculates correct sizes
- [ ] ZPPool manages addresses correctly
- [ ] ZPAllocator scores and allocates correctly
- [ ] FrameAllocator orchestrates correctly
- [ ] Recursion detected and reported
- [ ] ZP overflow detected and reported
- [ ] All integration tests pass

---

**Next Phase**: [../30-coalescing/30-overview.md](../30-coalescing/30-overview.md)