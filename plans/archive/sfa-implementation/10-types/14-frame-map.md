# FrameMap and Allocation Result

> **Document**: 10-types/14-frame-map.md
> **Parent**: [10-overview.md](10-overview.md)

## FrameMap Interface

```typescript
/**
 * Map of function name → Frame.
 * Implements Map interface for familiarity.
 */
export class FrameMap {
  private frames: Map<string, Frame> = new Map();

  get(functionName: string): Frame | undefined {
    return this.frames.get(functionName);
  }

  set(functionName: string, frame: Frame): void {
    this.frames.set(functionName, frame);
  }

  has(functionName: string): boolean {
    return this.frames.has(functionName);
  }

  keys(): IterableIterator<string> {
    return this.frames.keys();
  }

  values(): IterableIterator<Frame> {
    return this.frames.values();
  }

  get size(): number {
    return this.frames.size;
  }

  /** Get all slots across all frames */
  getAllSlots(): FrameSlot[] {
    return Array.from(this.frames.values()).flatMap(f => f.slots);
  }
}
```

---

## FrameAllocationResult

```typescript
/**
 * Result of frame allocation process.
 */
export interface FrameAllocationResult {
  /** Map of function name to frame */
  frameMap: FrameMap;

  /** Allocation statistics */
  stats: FrameAllocationStats;

  /** Diagnostics (errors, warnings) */
  diagnostics: FrameDiagnostic[];

  /** Did allocation succeed? */
  success: boolean;
}

/**
 * Statistics from allocation.
 */
export interface FrameAllocationStats {
  totalFunctions: number;
  coalesceGroups: number;
  frameRegionBytesUsed: number;
  frameRegionBytesTotal: number;
  zpBytesUsed: number;
  zpBytesTotal: number;
  coalescingBytesSaved: number;
  coalescingSavingsPercent: number;
}

/**
 * Diagnostic from allocation.
 */
export interface FrameDiagnostic {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: SourceLocation;
}
```

---

## Diagnostic Codes

| Code | Severity | Description |
|------|----------|-------------|
| `RECURSION` | error | Recursive call detected |
| `ZP_OVERFLOW` | error | @zp variables exceed ZP capacity |
| `FRAME_OVERFLOW` | error | Total frames exceed frame region |
| `SHARED_THREAD` | warning | Function called from multiple threads |
| `ZP_FULL` | info | ZP full, some variables in RAM |

---

## Unit Tests

```typescript
describe('FrameMap', () => {
  it('should store and retrieve frames', () => {
    const map = new FrameMap();
    const frame = createFrame('main', ThreadContext.Main, mockLocation);
    
    map.set('main', frame);
    
    expect(map.has('main')).toBe(true);
    expect(map.get('main')).toBe(frame);
    expect(map.size).toBe(1);
  });
});
```

---

## Session
Implement in Session 1.2 per [../99-execution-plan.md](../99-execution-plan.md)