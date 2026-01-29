# Correctness Tests: Phase 9

> **Document**: 12-correctness-tests.md
> **Parent**: [Index](00-index.md)
> **Phase**: 9 (Final - After all fixes)
> **REQ**: REQ-10 (Testing Infrastructure)

## Overview

After implementing all fixes, comprehensive tests verify the code generator produces **semantically correct** 6502 assembly.

---

## Test Categories

### 1. Value Preservation Tests

Verify values aren't lost during operations:

```typescript
describe('Value Preservation', () => {
  it('should preserve value across binary operation', () => {
    const asm = compileToAsm(`
      function test(): byte {
        let a: byte = 5;
        let b: byte = 3;
        return a + b;  // Must be 8, not 0
      }
    `);
    expectNoStubs(asm);
    expectAsmSequence(asm, {
      instructions: [
        { mnemonic: 'LDA' },
        { mnemonic: 'CLC' },
        { mnemonic: 'ADC' }
      ],
      allowGaps: true
    });
  });
  
  it('should preserve value used multiple times', () => {
    const asm = compileToAsm(`
      function test(): byte {
        let x: byte = 10;
        return x + x;  // Both uses of x must work
      }
    `);
    expectNoStubs(asm);
  });
});
```

### 2. Control Flow Tests

Verify if/else, while, for loops work:

```typescript
describe('Control Flow', () => {
  it('should handle if-else correctly', () => {
    const asm = compileToAsm(`
      function max(a: byte, b: byte): byte {
        if (a > b) {
          return a;
        } else {
          return b;
        }
      }
    `);
    expectNoStubs(asm);
    expectAsmSequence(asm, {
      instructions: [
        { mnemonic: 'CMP' },
        { mnemonic: /^B/ }  // Some branch instruction
      ],
      allowGaps: true
    });
  });
  
  it('should handle while loop', () => {
    const asm = compileToAsm(`
      function countTo(n: byte): byte {
        let i: byte = 0;
        while (i < n) {
          i = i + 1;
        }
        return i;
      }
    `);
    expectNoStubs(asm);
  });
  
  it('should handle for loop', () => {
    const asm = compileToAsm(`
      function sum10(): byte {
        let total: byte = 0;
        for (let i: byte = 0; i < 10; i = i + 1) {
          total = total + i;
        }
        return total;
      }
    `);
    expectNoStubs(asm);
  });
});
```

### 3. Function Calling Tests

Verify parameters and return values:

```typescript
describe('Function Calling', () => {
  it('should pass byte parameter', () => {
    const asm = compileToAsm(`
      function double(x: byte): byte {
        return x + x;
      }
      function test(): byte {
        return double(5);  // Must be 10
      }
    `);
    expectNoStubs(asm);
  });
  
  it('should pass multiple parameters', () => {
    const asm = compileToAsm(`
      function add3(a: byte, b: byte, c: byte): byte {
        return a + b + c;
      }
      function test(): byte {
        return add3(1, 2, 3);  // Must be 6
      }
    `);
    expectNoStubs(asm);
  });
});
```

### 4. Memory Access Tests

Verify hardware access and arrays:

```typescript
describe('Memory Access', () => {
  it('should write to hardware address', () => {
    const asm = compileToAsm(`
      @map borderColor at $D020: byte;
      function test(): void {
        borderColor = 5;
      }
    `);
    expectAsmSequence(asm, {
      instructions: [
        { mnemonic: 'LDA', operand: '#$05' },
        { mnemonic: 'STA', operand: '$D020' }
      ]
    });
  });
  
  it('should access array element', () => {
    const asm = compileToAsm(`
      let arr: byte[10];
      function get(i: byte): byte {
        return arr[i];
      }
    `);
    expectNoStubs(asm);
  });
});
```

### 5. Type Conversion Tests

Verify byte/word conversions:

```typescript
describe('Type Conversions', () => {
  it('should zero-extend byte to word', () => {
    const asm = compileToAsm(`
      function test(): word {
        let b: byte = 255;
        let w: word = b;  // Must be 255, not 65535
        return w;
      }
    `);
    expectNoStubs(asm);
  });
  
  it('should truncate word to byte', () => {
    const asm = compileToAsm(`
      function test(): byte {
        let w: word = 0x1234;
        let b: byte = w;  // Must be 0x34 (low byte)
        return b;
      }
    `);
    expectNoStubs(asm);
  });
});
```

### 6. 16-bit Word Tests

Verify word arithmetic:

```typescript
describe('Word Operations', () => {
  it('should add words with carry', () => {
    const asm = compileToAsm(`
      function test(): word {
        let a: word = 0x00FF;
        let b: word = 0x0001;
        return a + b;  // Must be 0x0100
      }
    `);
    expectNoStubs(asm);
  });
  
  it('should compare words correctly', () => {
    const asm = compileToAsm(`
      function bigger(a: word, b: word): bool {
        return a > b;
      }
    `);
    expectNoStubs(asm);
  });
});
```

---

## Test Counts by Phase

| Phase | Test Count | Focus |
|-------|------------|-------|
| Phase 0 | 50 | Test infrastructure helpers |
| Phase 1 | 20 | Value tracking/spill |
| Phase 2 | 40 | Missing opcodes |
| Phase 3 | 25 | PHI node lowering |
| Phase 4 | 20 | Calling convention |
| Phase 5 | 15 | String literals |
| Phase 6 | 20 | Word operations |
| Phase 7 | 20 | Register allocation |
| Phase 8 | 15 | Module system |
| Phase 9 | 75 | Final correctness |
| **Total** | **300** | |

---

## Task Breakdown

### Session 9.1: Value/Control Tests (3-4 hours)

| Task | Description |
|------|-------------|
| 9.1.1 | Create value preservation tests |
| 9.1.2 | Create control flow tests |
| 9.1.3 | Create nested control tests |

### Session 9.2: Calling/Memory Tests (3-4 hours)

| Task | Description |
|------|-------------|
| 9.2.1 | Create function calling tests |
| 9.2.2 | Create memory access tests |
| 9.2.3 | Create array tests |

### Session 9.3: Type/Word Tests (3-4 hours)

| Task | Description |
|------|-------------|
| 9.3.1 | Create type conversion tests |
| 9.3.2 | Create word operation tests |
| 9.3.3 | Create mixed-type tests |

### Session 9.4: Integration Tests (3-4 hours)

| Task | Description |
|------|-------------|
| 9.4.1 | Create end-to-end tests |
| 9.4.2 | Test real programs (snake game) |
| 9.4.3 | Verify no regressions |

---

## Success Criteria

### Phase 9 is complete when:

1. ✅ All 300 tests pass
2. ✅ No STUB comments in generated code
3. ✅ No WARNING comments in generated code
4. ✅ Real programs compile correctly
5. ✅ Golden output tests match
6. ✅ E2E tests verify correctness

### Final Verification

```bash
./compiler-test
# All 300+ tests should pass
```

---

## Related Documents

- [Test Infrastructure](03-test-infrastructure.md) - Test helpers
- [Execution Plan](99-execution-plan.md) - Full timeline