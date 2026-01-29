# Word Operations: Phase 6

> **Document**: 09-word-operations.md
> **Parent**: [Index](00-index.md)
> **Phase**: 6 (After String Literals)
> **REQ**: REQ-06 (16-bit Word Operations)

## Overview

The 6502 is an 8-bit CPU, so 16-bit (word) operations require multiple instructions. Currently word values are only partially tracked (A/X split) but operations don't handle both bytes.

---

## Word Value Convention

| Byte | Location | Purpose |
|------|----------|---------|
| Low | A register | Primary byte for operations |
| High | X register | Secondary byte |
| ZP | $addr (low), $addr+1 (high) | Memory storage |

---

## 16-bit Addition

```asm
; word_result = word_a + word_b
; word_a in $50/$51, word_b in $52/$53

        CLC             ; Clear carry
        LDA $50         ; Load A low byte
        ADC $52         ; Add B low byte
        STA $54         ; Store result low byte
        
        LDA $51         ; Load A high byte
        ADC $53         ; Add B high byte (with carry!)
        STA $55         ; Store result high byte
```

## 16-bit Subtraction

```asm
; word_result = word_a - word_b
        SEC             ; Set carry (no borrow)
        LDA $50         ; A low byte
        SBC $52         ; Subtract B low byte
        STA $54         ; Result low byte
        
        LDA $51         ; A high byte
        SBC $53         ; Subtract B high byte (with borrow)
        STA $55         ; Result high byte
```

## 16-bit Comparison

```asm
; Compare word_a with word_b
        LDA $51         ; Compare high bytes first
        CMP $53
        BNE .done       ; If not equal, flags are set
        LDA $50         ; High bytes equal, compare low
        CMP $52
.done:
        ; Z, C, N flags now reflect full 16-bit comparison
```

---

## Implementation

```typescript
protected generateWordAdd(instr: ILBinaryInstruction): void {
  const leftId = instr.left?.toString() ?? '';
  const rightId = instr.right?.toString() ?? '';
  const resultId = instr.result?.toString() ?? '';
  
  // Ensure both operands are in ZP
  const leftAddr = this.ensureWordInZP(leftId);
  const rightAddr = this.ensureWordInZP(rightId);
  const resultAddr = this.allocateSpillSlot(resultId);  // 2 bytes
  
  // 16-bit add
  this.emitInstruction('CLC', undefined, 'Clear carry', 1);
  this.emitLdaZeroPage(leftAddr, 'Load left low');
  this.emitInstruction('ADC', this.formatZeroPage(rightAddr), 'Add right low', 2);
  this.emitStaZeroPage(resultAddr, 'Store result low');
  
  this.emitLdaZeroPage(leftAddr + 1, 'Load left high');
  this.emitInstruction('ADC', this.formatZeroPage(rightAddr + 1), 'Add right high (with carry)', 2);
  this.emitStaZeroPage(resultAddr + 1, 'Store result high');
  
  this.trackValue(resultId, {
    location: ValueLocation.ZERO_PAGE,
    address: resultAddr,
    isWord: true
  });
}

protected ensureWordInZP(valueId: string): number {
  const loc = this.getValueLocation(valueId);
  
  if (loc?.location === ValueLocation.ZERO_PAGE && loc.isWord) {
    return loc.address ?? 0;
  }
  
  // Need to spill word value to ZP
  const addr = this.allocateSpillSlot(valueId);  // Gets 2-byte slot
  
  if (loc?.location === ValueLocation.ACCUMULATOR) {
    this.emitStaZeroPage(addr, 'Spill word low');
    this.emitInstruction('STX', this.formatZeroPage(addr + 1), 'Spill word high', 2);
  } else if (loc?.location === ValueLocation.IMMEDIATE) {
    const low = (loc.value ?? 0) & 0xFF;
    const high = ((loc.value ?? 0) >> 8) & 0xFF;
    this.emitLdaImmediate(low, 'Load word low');
    this.emitStaZeroPage(addr, 'Store word low');
    this.emitLdaImmediate(high, 'Load word high');
    this.emitStaZeroPage(addr + 1, 'Store word high');
  }
  
  return addr;
}
```

---

## Task Breakdown

### Session 6.1: Word Tracking (2-3 hours)

| Task | Description |
|------|-------------|
| 6.1.1 | Add `isWord` flag to TrackedValue |
| 6.1.2 | Implement `ensureWordInZP()` |
| 6.1.3 | Track A/X pair as word |

### Session 6.2: Word Arithmetic (3-4 hours)

| Task | Description |
|------|-------------|
| 6.2.1 | Implement `generateWordAdd()` |
| 6.2.2 | Implement `generateWordSub()` |
| 6.2.3 | Detect word operations in binary ops |

### Session 6.3: Word Comparisons (2-3 hours)

| Task | Description |
|------|-------------|
| 6.3.1 | Implement 16-bit comparison |
| 6.3.2 | Fix CMP_* for words |
| 6.3.3 | Test word comparisons |

### Session 6.4: Word Tests (2-3 hours)

| Task | Description |
|------|-------------|
| 6.4.1 | Test word addition |
| 6.4.2 | Test word subtraction |
| 6.4.3 | Test word comparisons |
| 6.4.4 | Test word with carry |

---

## Success Criteria

1. ✅ Word values tracked properly (A/X or ZP pair)
2. ✅ 16-bit addition handles carry
3. ✅ 16-bit subtraction handles borrow
4. ✅ 16-bit comparisons work
5. ✅ 20+ word operation tests pass