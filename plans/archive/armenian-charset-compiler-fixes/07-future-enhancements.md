# Future Enhancements: Items J, K

> **Document**: 07-future-enhancements.md
> **Parent**: [Index](00-index.md)
> **Scope**: Two research-phase items requiring design work before implementation
> **Priority**: CRITICAL (per user requirement), but implementation follows correctness fixes

## Overview

Items J and K are forward-looking enhancements that require a research phase before implementation. They address systemic inefficiencies (block copy patterns) and platform awareness (C64 memory map constraints). Both items would prevent entire classes of bugs and produce dramatically better code for common C64 programming patterns.

---

## Item J: Block Copy Pattern Recognition

### Problem

The armenian-charset `copyCharset()` function copies 2048 bytes from ROM to RAM using a for-loop with individual `peek()`/`poke()` calls:

```js
// Blend source:
for (i = 0 to 2047) {
  poke(@armenianFont + i, peek(@charRom + i));
}
```

The compiler generates this as 2048 individual iterations of:
```asm
; Per iteration (Tier 3 indirect for both source and destination):
  LDA #<src_base    ; 2 bytes
  LDX #>src_base    ; 2 bytes
  CLC / ADC i_lo    ; 3 bytes
  BCC +2 / INX      ; 4 bytes
  STA $FB / STX $FC ; 4 bytes
  LDY #0 / LDA ($FB),Y  ; 4 bytes
  ; ... similar for destination ...
  STA ($FB),Y       ; 2 bytes
  ; Total: ~30 bytes per iteration body
```

### Canonical 6502 Block Copy

The standard 6502 memory copy for aligned 256-byte pages:

```asm
; Canonical page-aligned block copy (2048 bytes = 8 pages)
  LDA #<src
  STA $FB
  LDA #>src
  STA $FC
  LDA #<dst
  STA $FD
  LDA #>dst
  STA $FE
  LDX #8            ; 8 pages
  LDY #0
.loop:
  LDA ($FB),Y
  STA ($FD),Y
  INY
  BNE .loop
  INC $FC           ; next source page
  INC $FE           ; next dest page
  DEX
  BNE .loop
; Total: ~25 bytes for ANY size copy
```

### Research Phase

Before implementing, research these questions:

1. **Pattern Detection**: How reliably can `for (i = 0 to N) { poke(dst+i, peek(src+i)) }` be recognized?
   - What variations exist? (word vs byte counter, step != 1, non-zero start)
   - Can the pattern be detected at IL level or only at AST level?

2. **Design Choice**: Intrinsic vs pattern-based?
   - **Option A: `memcpy()` intrinsic** — explicit call in Blend source: `memcpy(@dst, @src, 2048)`
   - **Option B: Pattern recognition** — compiler detects for-loop peek/poke pattern automatically
   - **Option C: Both** — intrinsic for explicit use, pattern for automatic optimization

3. **Alignment Requirements**: 6502 page-based copy requires page-aligned source/destination
   - How to handle non-aligned copies?
   - Preamble/postamble for unaligned start/end bytes?

4. **Size vs Speed Trade-offs**:
   - Small copies (<16 bytes): unrolled inline is faster
   - Medium copies (16-255 bytes): single-page loop
   - Large copies (256+ bytes): page-based loop
   - Very large (1K+): page-based with page counter

### Implementation Sketch

```typescript
// AST-level pattern detection (in IL generator or optimizer):
function isBlockCopyPattern(forStmt: ForStatement): BlockCopyInfo | null {
  // Check: body is exactly one statement: poke(dst+i, peek(src+i))
  // Check: start is 0 (or known constant)
  // Check: step is 1
  // Check: dst and src are address-of or constant expressions
  // Return: { srcExpr, dstExpr, count }
}

// If pattern detected, emit BLOCK_COPY IL instruction:
this.builder.emit(ILOpcode.BLOCK_COPY, [srcOperand, dstOperand, countOperand]);

// Codegen translates BLOCK_COPY to canonical 6502 loop
```

### Files Changed (Estimated)

| File | Change |
|------|--------|
| `il/enums.ts` | Add `BLOCK_COPY` IL opcode |
| `il/generator/control-flow.ts` or `expressions.ts` | Pattern detection in for-loop generation |
| `codegen/` | BLOCK_COPY → 6502 page-based copy emission |
| `optimizer/passes/` | Possibly a dedicated block-copy detection pass |

### Dependencies

- Item A (address-of word path) should be fixed first so `@data` addresses compute correctly
- Item D (type propagation) helps detect word-width loop counters

---

## Item K: Memory Map Awareness / ROM Shadow Detection

### Problem

On the Commodore 64, the VIC-II video chip sees a different memory map than the CPU:

| Address Range | CPU Sees | VIC-II Sees |
|--------------|----------|-------------|
| $0000-$0FFF | RAM | RAM |
| $1000-$1FFF | RAM (or ROM) | **Character ROM** |
| $2000-$3FFF | RAM | RAM |
| $4000-$7FFF | Depends on bank | Depends on bank |
| $9000-$9FFF | RAM (or ROM) | **Character ROM** |
| $D000-$DFFF | I/O | **Character ROM** |

If the compiler places charset data at $1000 (which is a common mistake), the CPU can write to it, but the VIC-II reads Character ROM instead — the custom charset is invisible.

### Current State

The Blend65 compiler has no awareness of the C64 memory map. `@data` and `@charset` storage classes place data at linker-determined addresses without checking for VIC-II conflicts.

### Research Phase

1. **Memory Map Model**: Define a compile-time model of VIC-II bank constraints
   - Which bank is selected (0-3)? Default bank 0: $0000-$3FFF
   - Which addresses are ROM shadows within the selected bank?
   - Are there compiler flags to specify the target bank?

2. **Detection Strategy**:
   - **Compile-time**: Check `@data`/`@charset` label addresses against ROM shadow ranges
   - **Link-time**: Check after ACME resolves addresses (harder — compiler doesn't see ACME output)
   - **Both**: Compile-time warning for known addresses, link-time check via ACME guard labels

3. **Warning vs Error**:
   - Should ROM shadow placement be a warning or an error?
   - Some programs intentionally use ROM shadow for mixing ROM characters with custom
   - Recommendation: Warning by default, suppressible with a pragma

4. **Bank Configuration**:
   - Does the Blend language spec define VIC bank configuration?
   - Should there be a compiler directive: `#vic_bank 2` or `@vic_bank(2)`?

### Implementation Sketch

```typescript
// Memory map constraints model:
const VIC_ROM_SHADOWS: Record<number, number[][]> = {
  0: [[0x1000, 0x1FFF], [0x9000, 0x9FFF]],  // Bank 0
  1: [[0x5000, 0x5FFF], [0xD000, 0xDFFF]],  // Bank 1
  2: [[0x9000, 0x9FFF]],                      // Bank 2
  3: [[0xD000, 0xDFFF]],                      // Bank 3
};

// In linker/emitter, after address resolution:
function checkRomShadow(label: string, address: number, vicBank: number): Warning | null {
  for (const [start, end] of VIC_ROM_SHADOWS[vicBank]) {
    if (address >= start && address <= end) {
      return new Warning(
        `@data '${label}' at $${address.toString(16)} is in VIC-II ROM shadow region. ` +
        `VIC will read Character ROM, not RAM. Move data outside $${start.toString(16)}-$${end.toString(16)}.`
      );
    }
  }
  return null;
}
```

### Files Changed (Estimated)

| File | Change |
|------|--------|
| `compiler/memory-map.ts` | **NEW** — C64 memory map model with ROM shadow ranges |
| `compiler/warnings.ts` or `diagnostic/` | ROM shadow warning emission |
| `codegen/emitter.ts` | Check data segment addresses against memory map |
| `docs/language-specification-v2/` | Document memory map awareness if adding directives |

### Dependencies

- No direct dependencies on other items
- Can be implemented independently at any time
- Primarily a diagnostic/warning feature — doesn't change code generation

---

## Implementation Priority

Both items are marked CRITICAL per user requirement, but their implementation order is:

1. **Item J (Block Copy)** — Higher impact on code quality; directly affects armenian-charset performance
2. **Item K (Memory Map)** — Preventive measure; catches a class of bugs before they happen

Both items should have a **research session** before implementation to finalize design decisions.

## Testing Strategy

See [09-testing-strategy.md](09-testing-strategy.md). Key tests:

| Item | Test | Description |
|------|------|-------------|
| J | Detect `for + peek/poke` pattern | Pattern matcher identifies block copy |
| J | Generated copy is semantically identical | Output matches byte-by-byte with original loop |
| J | Non-matching patterns pass through | Regular for-loops with peek/poke that don't match are unchanged |
| K | ROM shadow warning for $1000-$1FFF | Data at $1000 in bank 0 triggers warning |
| K | No warning for valid addresses | Data at $2000 in bank 0 doesn't warn |
| K | Warning suppressible | Pragma or flag disables warning |
