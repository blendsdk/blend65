# Coalescing Algorithm Specification

> **Document**: 30-coalescing/31-algorithm.md
> **Parent**: [30-overview.md](30-overview.md)

## Core Algorithm

```typescript
export class Coalescer {
  /**
   * Build groups of functions that can share memory.
   */
  buildGroups(callGraph: CallGraph, frameMap: FrameMap): CoalesceGroup[] {
    const functions = Array.from(frameMap.keys());
    
    // Build "can coalesce" adjacency
    const canCoalesce = new Map<string, Set<string>>();
    for (const f1 of functions) {
      canCoalesce.set(f1, new Set());
      for (const f2 of functions) {
        if (f1 !== f2 && this.canFunctionsCoalesce(f1, f2, callGraph, frameMap)) {
          canCoalesce.get(f1)!.add(f2);
        }
      }
    }
    
    // Greedy grouping
    return this.greedyGroup(canCoalesce, frameMap);
  }

  /**
   * Check if two functions can coalesce.
   */
  private canFunctionsCoalesce(
    f1: string, f2: string,
    callGraph: CallGraph, frameMap: FrameMap
  ): boolean {
    // Rule 1: No caller-callee relationship
    if (callGraph.isReachable(f1, f2) || callGraph.isReachable(f2, f1)) {
      return false;
    }
    
    // Rule 2: Same thread context
    const ctx1 = frameMap.get(f1)!.threadContext;
    const ctx2 = frameMap.get(f2)!.threadContext;
    if (ctx1 !== ctx2) return false;
    if (ctx1 === ThreadContext.Shared) return false;
    
    return true;
  }

  /**
   * Greedy clique grouping.
   */
  private greedyGroup(
    canCoalesce: Map<string, Set<string>>,
    frameMap: FrameMap
  ): CoalesceGroup[] {
    const groups: CoalesceGroup[] = [];
    const assigned = new Set<string>();
    
    // Sort by frame size (largest first - better savings)
    const sorted = Array.from(canCoalesce.keys())
      .sort((a, b) => frameMap.get(b)!.totalSize - frameMap.get(a)!.totalSize);
    
    for (const func of sorted) {
      if (assigned.has(func)) continue;
      
      const group: CoalesceGroup = {
        id: groups.length,
        members: [func],
        size: frameMap.get(func)!.totalSize,
        baseAddress: 0,
      };
      assigned.add(func);
      
      // Add compatible functions
      for (const other of canCoalesce.get(func)!) {
        if (assigned.has(other)) continue;
        
        // Must be compatible with ALL group members
        const compatibleWithAll = group.members.every(
          m => canCoalesce.get(m)!.has(other)
        );
        
        if (compatibleWithAll) {
          group.members.push(other);
          group.size = Math.max(group.size, frameMap.get(other)!.totalSize);
          assigned.add(other);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }
}
```

---

## Thread Context Detection

```typescript
function determineThreadContext(func: string, callGraph: CallGraph): ThreadContext {
  const isCallback = func.startsWith('on_') || func.endsWith('_isr');
  const fromMain = callGraph.isReachable('main', func);
  const fromCallback = this.isReachableFromAnyCallback(func, callGraph);
  
  if (fromMain && fromCallback) return ThreadContext.Shared;
  if (fromCallback || isCallback) return ThreadContext.ISR;
  return ThreadContext.Main;
}
```

---

## Session
Implement in Sessions 3.1-3.4 per [../99-execution-plan.md](../99-execution-plan.md)