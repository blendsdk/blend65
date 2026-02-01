# ZP Allocator Specification

> **Document**: 20-allocator/22-zp-allocator.md
> **Parent**: [20-overview.md](20-overview.md)

## Purpose

Manages Zero Page allocation with scoring for auto-promotion and directive enforcement.

---

## ZP Pool Class

```typescript
export class ZPPool {
  private allocated: Set<number> = new Set();

  constructor(private config: ZeroPageConfig) {
    // Pre-mark reserved addresses
    for (const addr of config.reserved) {
      this.allocated.add(addr);
    }
  }

  canAllocate(size: number): boolean {
    return this.findContiguous(size) !== null;
  }

  allocate(size: number): number {
    const addr = this.findContiguous(size);
    if (addr === null) throw new Error('ZP overflow');
    for (let i = 0; i < size; i++) {
      this.allocated.add(addr + i);
    }
    return addr;
  }

  private findContiguous(size: number): number | null {
    for (let addr = this.config.start; addr <= this.config.end - size; addr++) {
      let found = true;
      for (let i = 0; i < size; i++) {
        if (this.allocated.has(addr + i)) { found = false; break; }
      }
      if (found) return addr;
    }
    return null;
  }

  get bytesUsed(): number { return this.allocated.size; }
  get bytesAvailable(): number { return this.config.end - this.config.start - this.allocated.size; }
}
```

---

## ZP Scoring

```typescript
const TYPE_WEIGHTS = {
  pointer: 0x800,  // Highest - indirect Y
  byte: 0x100,
  word: 0x080,
  array: 0x000,    // Arrays too big
};

export function calculateZPScore(slot: FrameSlot, accessInfo?: AccessInfo): number {
  if (slot.directive === ZpDirective.Required) return Number.MAX_SAFE_INTEGER;
  if (slot.directive === ZpDirective.Forbidden) return 0;
  if (slot.size > 4) return 0;  // Too big for ZP

  let score = TYPE_WEIGHTS[slot.typeName] || TYPE_WEIGHTS.byte;
  if (accessInfo) {
    score *= (accessInfo.readCount + accessInfo.writeCount);
    score *= Math.pow(2, accessInfo.maxLoopDepth);
  }
  return score;
}
```

---

## ZP Allocator Class

```typescript
export class ZPAllocator {
  private pool: ZPPool;

  constructor(config: PlatformConfig) {
    this.pool = new ZPPool(config.zeroPage);
  }

  allocate(slots: FrameSlot[]): FrameDiagnostic[] {
    const diagnostics: FrameDiagnostic[] = [];

    // 1. Sort by directive, then score
    const required = slots.filter(s => s.directive === ZpDirective.Required);
    const auto = slots.filter(s => s.directive === ZpDirective.None);
    const forbidden = slots.filter(s => s.directive === ZpDirective.Forbidden);

    // 2. Allocate required (@zp) first
    for (const slot of required) {
      if (!this.pool.canAllocate(slot.size)) {
        diagnostics.push({
          code: 'ZP_OVERFLOW',
          severity: 'error',
          message: `Cannot allocate @zp variable '${slot.name}' (${slot.size} bytes)`,
          location: slot.sourceLocation,
        });
        continue;
      }
      slot.address = this.pool.allocate(slot.size);
      slot.location = SlotLocation.ZeroPage;
    }

    // 3. Forbidden go to frame region
    for (const slot of forbidden) {
      slot.location = SlotLocation.FrameRegion;
    }

    // 4. Auto by score
    const sorted = auto.sort((a, b) => b.zpScore - a.zpScore);
    for (const slot of sorted) {
      if (this.pool.canAllocate(slot.size)) {
        slot.address = this.pool.allocate(slot.size);
        slot.location = SlotLocation.ZeroPage;
      } else {
        slot.location = SlotLocation.FrameRegion;
      }
    }

    return diagnostics;
  }

  get stats() {
    return { used: this.pool.bytesUsed, available: this.pool.bytesAvailable };
  }
}
```

---

## Unit Tests

```typescript
describe('ZPAllocator', () => {
  it('should allocate @zp variables first', () => {
    const slots = [
      createSlot('normal', 1, ZpDirective.None),
      createSlot('required', 1, ZpDirective.Required),
    ];
    const alloc = new ZPAllocator(C64_PLATFORM);
    alloc.allocate(slots);
    
    expect(slots[1].location).toBe(SlotLocation.ZeroPage);
  });

  it('should error on ZP overflow', () => {
    const slots = [createSlot('huge', 200, ZpDirective.Required)];
    const alloc = new ZPAllocator(C64_PLATFORM);
    const diag = alloc.allocate(slots);
    
    expect(diag.some(d => d.code === 'ZP_OVERFLOW')).toBe(true);
  });

  it('should allocate high-score slots first', () => {
    const slots = [
      { ...createSlot('low', 1), zpScore: 100 },
      { ...createSlot('high', 1), zpScore: 1000 },
    ];
    // Fill ZP until only 1 byte left
    // high-score should get it
  });
});
```

---

## Session
Implement in Sessions 2.2-2.4 per [../99-execution-plan.md](../99-execution-plan.md)