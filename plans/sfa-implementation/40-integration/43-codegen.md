# Code Generator Integration

> **Document**: 40-integration/43-codegen.md
> **Parent**: [40-overview.md](40-overview.md)

## Changes Required

```typescript
// codegen/generator.ts
class CodeGenerator {
  
  private emitLoad(value: ILValue): void {
    if (value.location === SlotLocation.ZeroPage) {
      // ZP: 3 cycles, 2 bytes
      this.emit(`lda $${value.address!.toString(16).padStart(2, '0')}`);
    } else {
      // Absolute: 4 cycles, 3 bytes
      this.emit(`lda $${value.address!.toString(16).padStart(4, '0')}`);
    }
  }
  
  private emitStore(value: ILValue): void {
    if (value.location === SlotLocation.ZeroPage) {
      this.emit(`sta $${value.address!.toString(16).padStart(2, '0')}`);
    } else {
      this.emit(`sta $${value.address!.toString(16).padStart(4, '0')}`);
    }
  }
  
  private emitIndirectY(ptr: ILValue, indexReg: 'Y'): void {
    if (ptr.location !== SlotLocation.ZeroPage) {
      throw new Error('Indirect Y requires ZP pointer');
    }
    // ($ZZ),Y - only works with ZP
    this.emit(`lda ($${ptr.address!.toString(16).padStart(2, '0')}),y`);
  }
}
```

---

## Addressing Mode Selection

| Location | LDA/STA | Bytes | Cycles | Indirect,Y |
|----------|---------|-------|--------|------------|
| ZeroPage | `lda $ZZ` | 2 | 3 | ✅ `lda ($ZZ),y` |
| Absolute | `lda $NNNN` | 3 | 4 | ❌ Not available |

---

## Session
Implement in Sessions 4.3-4.4 per [../99-execution-plan.md](../99-execution-plan.md)