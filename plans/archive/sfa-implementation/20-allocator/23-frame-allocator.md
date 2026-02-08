# Frame Allocator Specification

> **Document**: 20-allocator/23-frame-allocator.md
> **Parent**: [20-overview.md](20-overview.md)

## Purpose

Main orchestrator that coordinates frame calculation, coalescing, and address assignment.

---

## Class Definition

```typescript
export class FrameAllocator {
  private calculator: FrameCalculator;
  private zpAllocator: ZPAllocator;
  private coalescer: Coalescer;

  constructor(private config: PlatformConfig) {
    this.zpAllocator = new ZPAllocator(config);
    this.coalescer = new Coalescer();
  }

  allocate(
    program: Program,
    callGraph: CallGraph,
    symbolTable: SymbolTable
  ): FrameAllocationResult {
    this.calculator = new FrameCalculator(symbolTable);
    const diagnostics: FrameDiagnostic[] = [];
    const frameMap = new FrameMap();

    // 1. Check recursion
    const cycles = callGraph.detectAllCycles();
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        diagnostics.push({
          code: 'RECURSION',
          severity: 'error',
          message: `Recursive call: ${cycle.join(' → ')}`,
        });
      }
      return { frameMap, stats: this.emptyStats(), diagnostics, success: false };
    }

    // 2. Calculate frames
    for (const func of this.getAllFunctions(program)) {
      const frame = this.calculator.calculateFrame(func);
      frameMap.set(func.getName(), frame);
    }

    // 3. Build coalesce groups
    const groups = this.coalescer.buildGroups(callGraph, frameMap);

    // 4. Assign addresses
    let nextAddr = this.config.frameRegion.start;
    for (const group of groups) {
      const size = Math.max(...group.members.map(n => frameMap.get(n)!.totalSize));
      for (const member of group.members) {
        const frame = frameMap.get(member)!;
        frame.baseAddress = nextAddr;
        frame.coalesceGroup = group.id;
        assignSlotAddresses(frame);
      }
      nextAddr += size;
    }

    // 5. Check overflow
    if (nextAddr > this.config.frameRegion.end) {
      diagnostics.push({
        code: 'FRAME_OVERFLOW',
        severity: 'error',
        message: `Frame region overflow`,
      });
      return { frameMap, stats: this.emptyStats(), diagnostics, success: false };
    }

    // 6. ZP allocation
    const allSlots = frameMap.getAllSlots();
    diagnostics.push(...this.zpAllocator.allocate(allSlots));

    // 7. Stats
    const stats = this.computeStats(frameMap, groups);

    return { frameMap, stats, diagnostics, success: diagnostics.filter(d => d.severity === 'error').length === 0 };
  }
}
```

---

## Integration Tests

```typescript
describe('FrameAllocator', () => {
  it('should allocate simple program', () => {
    const result = allocateFrames(FIXTURES.simpleLocals);
    expectNoErrors(result);
    expectFrameAt(result, 'main', 0x0200);
  });

  it('should detect recursion', () => {
    const result = allocateFrames(FIXTURES.directRecursion);
    expectError(result, 'RECURSION');
  });

  it('should apply coalescing', () => {
    const result = allocateFrames(FIXTURES.nonOverlapping);
    expectCoalesced(result, 'funcA', 'funcB');
  });
});
```

---

## Session
Implement in Sessions 2.5-2.6 per [../99-execution-plan.md](../99-execution-plan.md)