# Testing Strategy: Sprite-Test Fixes

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Test Categories

### Unit Tests — IL Generator Constants

| Test | Description |
|------|-------------|
| Byte const in expression | `const X: byte = 42; let y: byte = X;` → LOAD_IMM 42, not LOAD_BYTE slot |
| Word const in expression | `const SCREEN: word = $0400; let p: word = SCREEN;` → LOAD_IMM_WORD $0400 |
| Const in binary expr | `const W: byte = 40; let z: byte = y * W;` → MUL_IMM 40 |
| Const chain resolution | `const A: byte = 5; const B: byte = A + 3; let c: byte = B;` → LOAD_IMM 8 |
| Const in poke value | `poke($D020, SPACE_CHAR)` → value loads as LDA #$20 |

### Unit Tests — Array Store

| Test | Description |
|------|-------------|
| Static index store | `arr[0] = 5;` → STORE_BYTE to arr+0 |
| Dynamic index store | `arr[i] = value;` → TAY, STORE_BYTE with indexedByY |
| Array store in loop | `for (let i = 0 to 9) { arr[i] = i; }` → indexed store each iteration |
| Array read-back | `arr[0] = 42; let x = arr[0];` → store then load from same address |

### Unit Tests — Barrier Intrinsic

| Test | Description |
|------|-------------|
| Barrier emits IL | `barrier()` → BARRIER opcode in IL output |
| Barrier in loop | `for (let i = 0 to 9) { barrier(); }` → BARRIER preserved in each iteration |
| Barrier codegen | BARRIER → comment/NOP in assembly (no crash) |

### Integration Tests

| Test | Description |
|------|-------------|
| Const + poke | `const V: byte = 32; poke($0400, V);` → full pipeline, LDA #$20 / STA $0400 |
| Array + loop | Array init + read pattern → correct indexed addressing in assembly |

### E2E Tests

| Test | Description |
|------|-------------|
| sprite-test O0 | Compile sprite-test.blend at O0, verify no ACME errors |
| sprite-test O3 | Compile sprite-test.blend at O3, verify no ACME errors |
| Assembly inspection | Verify constants as immediates, array stores present in .asm output |

## Verification

```bash
# Targeted tests during development
./compiler-test il

# Full suite before completion
./compiler-test
```
