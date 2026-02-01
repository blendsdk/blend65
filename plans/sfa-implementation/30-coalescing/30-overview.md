# Phase 3: Frame Coalescing

> **Document**: 30-coalescing/30-overview.md
> **Parent**: [../00-index.md](../00-index.md)
> **Status**: Ready

## Overview

This phase implements frame coalescing - the algorithm that allows non-overlapping functions to share memory, achieving 30-60% memory savings.

---

## 1. Coalescing Concept

Functions that **never execute simultaneously** can share the same memory:

```
main() calls:
  - update()    ─┐
  - draw()      ─┴─ These never overlap → CAN coalesce

update() calls:
  - inner()     ─── inner overlaps with update → CANNOT coalesce
```

---

## 2. Algorithm

### 2.1 Build Non-Overlap Graph

```typescript
class Coalescer {
  buildCoalesceGroups(callGraph: CallGraph, frames: Map<string, Frame>): CoalesceGroup[] {
    const functions = Array.from(frames.keys());
    
    // 1. Build "can coalesce" edges
    const canCoalesce = new Map<string, Set<string>>();
    for (const f1 of functions) {
      canCoalesce.set(f1, new Set());
      for (const f2 of functions) {
        if (f1 !== f2 && !this.overlaps(f1, f2, callGraph)) {
          canCoalesce.get(f1)!.add(f2);
        }
      }
    }
    
    // 2. Respect thread boundaries
    for (const f1 of functions) {
      const t1 = frames.get(f1)!.threadContext;
      for (const f2 of canCoalesce.get(f1)!) {
        const t2 = frames.get(f2)!.threadContext;
        if (t1 !== t2 || t1 === ThreadContext.Shared) {
          canCoalesce.get(f1)!.delete(f2);
        }
      }
    }
    
    // 3. Find maximal cliques (greedy approximation)
    return this.findGroups(canCoalesce, frames);
  }
  
  private overlaps(f1: string, f2: string, callGraph: CallGraph): boolean {
    // f1 and f2 overlap if:
    // - f1 calls f2 (directly or indirectly)
    // - f2 calls f1
    // - They share a common ancestor that calls both while active
    return callGraph.isReachable(f1, f2) || callGraph.isReachable(f2, f1);
  }
}
```

### 2.2 Thread Context Detection

```typescript
function determineThreadContext(func: string, callGraph: CallGraph): ThreadContext {
  const isCallback = func.startsWith('callback_');  // Or check AST node type
  const reachableFromMain = callGraph.isReachable('main', func);
  const reachableFromISR = this.isReachableFromAnyCallback(func, callGraph);
  
  if (reachableFromMain && reachableFromISR) {
    return ThreadContext.Shared;  // Warning: cannot coalesce with single-thread
  }
  if (reachableFromISR || isCallback) {
    return ThreadContext.ISR;
  }
  return ThreadContext.Main;
}
```

---

## 3. Group Assignment

```typescript
interface CoalesceGroup {
  id: number;
  members: string[];  // Function names
  size: number;       // Max of member frame sizes
  baseAddress: number;
}

function assignAddresses(groups: CoalesceGroup[], config: PlatformConfig): void {
  let address = config.frameRegion.start;
  for (const group of groups) {
    group.baseAddress = address;
    for (const member of group.members) {
      // All members share same base address
    }
    address += group.size;
  }
}
```

---

## 4. Memory Savings Calculation

```typescript
function calculateSavings(groups: CoalesceGroup[], frames: Map<string, Frame>): number {
  const withoutCoalescing = Array.from(frames.values())
    .reduce((sum, f) => sum + f.totalSize, 0);
  
  const withCoalescing = groups
    .reduce((sum, g) => sum + g.size, 0);
  
  return (withoutCoalescing - withCoalescing) / withoutCoalescing;
}
```

---

## 5. Tests

```typescript
describe('Coalescer', () => {
  it('should coalesce non-overlapping siblings', () => {
    const source = INLINE_FIXTURES.nonOverlapping;
    const result = allocateFrames(source);
    
    expectCoalesced(result, 'funcA', 'funcB');
  });

  it('should NOT coalesce caller-callee', () => {
    const source = INLINE_FIXTURES.nestedCalls;
    const result = allocateFrames(source);
    
    expectNotCoalesced(result, 'outer', 'inner');
  });

  it('should NOT coalesce across threads', () => {
    const source = INLINE_FIXTURES.callbackIsolation;
    const result = allocateFrames(source);
    
    expectNotCoalesced(result, 'mainFunc', 'irqHandler');
  });

  it('should achieve significant savings', () => {
    const source = loadFixture('02-coalescing', 'max-coalescing');
    const result = allocateFrames(source);
    
    expectCoalescingSavings(result, 0.6);  // 60% savings
  });
});
```

---

## 6. Sessions

| Session | Tasks | Est. Time |
|---------|-------|-----------|
| **3.1** | Overlap detection + tests | 20 min |
| **3.2** | Thread context detection + tests | 20 min |
| **3.3** | Group building algorithm + tests | 20 min |
| **3.4** | Address assignment + integration | 20 min |

**Total: ~1.5 hours**

---

## 7. Success Criteria

- [ ] Non-overlapping functions coalesce
- [ ] Caller-callee never coalesce
- [ ] Thread boundaries respected
- [ ] Memory savings 30-60% achieved
- [ ] All coalescing tests pass

---

**Next Phase**: [../40-integration/40-overview.md](../40-integration/40-overview.md)