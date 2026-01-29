# Verification Tests: Gap Amendment

> **Document**: 16-verification-tests.md
> **Parent**: [Index](00-index.md)
> **Type**: Gap Amendment
> **Addresses**: Gap #8 (Storage Classes), Gap #9 (2D Arrays)

## Overview

This amendment adds **verification tests** for features that are likely working but need explicit testing:

1. **Storage Class Testing** - Verify @zp, @ram, @data variable placement
2. **Multi-Dimensional Array Testing** - Verify 2D array offset calculation

---

## Amendment 1: Storage Class Testing

### Problem

The language defines three storage classes:
- `@zp` - Zero Page ($00-$FF)
- `@ram` - General RAM (default)
- `@data` - ROM-able data section

**No explicit tests verify variables are placed in correct memory regions.**

### Expected Behavior

```js
// Source
@zp let fastCounter: byte = 0;
@ram let buffer: byte[100];
@data const table: byte[16] = [0, 1, 2, 3, ...];

// Generated ASM should show:
; fastCounter in zero page ($00-$FF range)
; buffer in RAM section
; table in data section (read-only)
```

### Solution

Add storage class tests to Phase 9 (Correctness Tests).

### Test Cases

```typescript
describe('Storage Class Verification', () => {
  describe('@zp - Zero Page', () => {
    it('should place @zp variable in zero page range', () => {
      const asm = compileToAsm(`
        @zp let counter: byte = 0;
        function test(): void {
          counter = 5;
        }
      `);
      
      // Should use zero page addressing (2-byte instruction)
      // STA $XX (not STA $XXXX)
      expectAsmSequence(asm, {
        instructions: [
          { mnemonic: 'LDA', operand: '#$05' },
          { mnemonic: 'STA', operand: /^\$[0-9A-F]{2}$/ }  // Zero page: 2 hex digits
        ]
      });
    });
    
    it('should generate faster ZP code', () => {
      const asm = compileToAsm(`
        @zp let zpVar: byte;
        @ram let ramVar: byte;
        
        function test(): void {
          zpVar = 1;
          ramVar = 1;
        }
      `);
      
      // ZP access should be 2 bytes, RAM access should be 3 bytes
      // This is reflected in instruction format
      const lines = asm.split('\n');
      const zpStore = lines.find(l => l.includes('STA') && l.includes('zpVar'));
      const ramStore = lines.find(l => l.includes('STA') && l.includes('ramVar'));
      
      // ZP: STA $XX (operand is 2 hex chars)
      // RAM: STA $XXXX (operand is 4 hex chars)
      expect(zpStore).toMatch(/STA\s+\$[0-9A-F]{2}[^0-9A-F]/);
      expect(ramStore).toMatch(/STA\s+\$[0-9A-F]{4}/);
    });
  });
  
  describe('@ram - General RAM', () => {
    it('should place @ram variable outside zero page', () => {
      const asm = compileToAsm(`
        @ram let buffer: byte[256];
        function test(): byte {
          return buffer[0];
        }
      `);
      
      // Should use absolute addressing
      expectAsmSequence(asm, {
        instructions: [
          { mnemonic: 'LDA', operand: /^\$[0-9A-F]{4}/ }  // Absolute: 4 hex digits
        ],
        allowGaps: true
      });
    });
    
    it('should use absolute addressing for default storage', () => {
      const asm = compileToAsm(`
        let defaultVar: byte = 10;  // No @zp, defaults to @ram
        function test(): byte {
          return defaultVar;
        }
      `);
      
      expectAsmSequence(asm, {
        instructions: [
          { mnemonic: 'LDA', operand: /^\$[0-9A-F]{4}/ }
        ],
        allowGaps: true
      });
    });
  });
  
  describe('@data - Initialized Data Section', () => {
    it('should place @data in data section', () => {
      const asm = compileToAsm(`
        @data const lookup: byte[4] = [10, 20, 30, 40];
        function test(i: byte): byte {
          return lookup[i];
        }
      `);
      
      // Data should appear in a !byte directive
      expectAsmContains(asm, '!byte $0A, $14, $1E, $28');
    });
    
    it('should treat @data as read-only', () => {
      // This should generate a compile-time error or warning
      // when trying to write to @data
      expect(() => {
        compileToAsm(`
          @data const table: byte[4] = [1, 2, 3, 4];
          function test(): void {
            table[0] = 99;  // ERROR: Writing to @data const!
          }
        `);
      }).toThrow();  // Or check for error in result
    });
  });
});
```

### VICE Verification Tests

```typescript
describe('Storage Class VICE Tests', () => {
  it('should access @zp variable correctly at runtime', async () => {
    const result = await compileAndRunInVice(`
      @zp let zpCounter: byte = 42;
      
      function main(): void {
        poke($C000, zpCounter);  // Copy ZP value to test location
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 1 }] });
    
    expect(result.memory![0]).toBe(42);
  });
  
  it('should initialize @data array correctly', async () => {
    const result = await compileAndRunInVice(`
      @data const values: byte[5] = [1, 2, 3, 4, 5];
      
      function main(): void {
        // Sum the data array
        let sum: byte = 0;
        for (i = 0 to 4) {
          sum += values[i];
        }
        poke($C000, sum);  // Should be 15
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 1 }] });
    
    expect(result.memory![0]).toBe(15);  // 1+2+3+4+5
  });
});
```

### Task Breakdown

**Add to Phase 9 (Correctness Tests):**

| Task | Description | File |
|------|-------------|------|
| 9.7.1 | Test @zp variables in zero page | tests |
| 9.7.2 | Test @zp uses ZP addressing mode | tests |
| 9.7.3 | Test @ram variables in RAM | tests |
| 9.7.4 | Test default storage is @ram | tests |
| 9.7.5 | Test @data in data section | tests |
| 9.7.6 | Test @data const is read-only | tests |
| 9.7.7 | VICE test for @zp access | tests (VICE) |
| 9.7.8 | VICE test for @data initialization | tests (VICE) |

---

## Amendment 2: Multi-Dimensional Array Testing

### Problem

The language spec shows 2D arrays:
```js
let screen: byte[25][40];
screen[row][col] = 160;  // Needs: row * 40 + col
```

**This requires multiplication for variable indices.** The plan doesn't explicitly verify this works.

### Expected Behavior

```js
// Source
let matrix: byte[5][10];
matrix[y][x] = 42;

// Should generate offset calculation:
// offset = y * 10 + x
// Then access matrix[offset]
```

### Solution

Add 2D array tests to Phase 2F (Array Operations).

### Test Cases

```typescript
describe('Multi-Dimensional Arrays', () => {
  describe('Offset Calculation', () => {
    it('should calculate 2D offset with constant indices', () => {
      const asm = compileToAsm(`
        let grid: byte[4][5];
        function test(): void {
          grid[2][3] = 99;  // offset = 2*5 + 3 = 13
        }
      `);
      
      // With constant indices, offset should be computed at compile time
      // Should see direct access to grid + 13
      expectNoStubs(asm);
    });
    
    it('should calculate 2D offset with variable row', () => {
      const asm = compileToAsm(`
        let grid: byte[4][5];
        function test(row: byte): void {
          grid[row][0] = 99;  // offset = row * 5
        }
      `);
      
      // Should generate multiply by 5
      expectNoStubs(asm);
    });
    
    it('should calculate 2D offset with both variable indices', () => {
      const asm = compileToAsm(`
        let grid: byte[4][5];
        function test(row: byte, col: byte): void {
          grid[row][col] = 99;  // offset = row * 5 + col
        }
      `);
      
      expectNoStubs(asm);
      // Should have multiplication and addition
    });
    
    it('should handle C64 screen layout (25x40)', () => {
      const asm = compileToAsm(`
        @map screenRam at $0400: byte[1000];
        
        function putChar(row: byte, col: byte, char: byte): void {
          // offset = row * 40 + col
          let offset: word = row * 40 + col;
          screenRam[offset] = char;
        }
      `);
      
      expectNoStubs(asm);
    });
  });
  
  describe('3D Arrays', () => {
    it('should calculate 3D offset', () => {
      const asm = compileToAsm(`
        let cube: byte[2][3][4];
        function test(x: byte, y: byte, z: byte): void {
          // offset = x * (3*4) + y * 4 + z
          cube[x][y][z] = 42;
        }
      `);
      
      expectNoStubs(asm);
    });
  });
});
```

### VICE Verification Tests

```typescript
describe('Multi-Dimensional Array VICE Tests', () => {
  it('should write to correct 2D location', async () => {
    const result = await compileAndRunInVice(`
      let grid: byte[4][5];  // 20 bytes total
      
      function main(): void {
        // Clear grid
        for (i = 0 to 19) {
          poke(@grid + i, 0);
        }
        
        // Write to grid[2][3] = offset 13
        grid[2][3] = 42;
        
        // Read back from offset 13
        let value: byte = peek(@grid + 13);
        poke($C000, value);
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 1 }] });
    
    expect(result.memory![0]).toBe(42);
  });
  
  it('should iterate 2D array correctly', async () => {
    const result = await compileAndRunInVice(`
      let matrix: byte[3][3];
      
      function main(): void {
        // Fill with pattern: row*10 + col
        for (row = 0 to 2) {
          for (col = 0 to 2) {
            matrix[row][col] = row * 10 + col;
          }
        }
        
        // Check corner values
        poke($C000, matrix[0][0]);  // 0
        poke($C001, matrix[0][2]);  // 2
        poke($C002, matrix[2][0]);  // 20
        poke($C003, matrix[2][2]);  // 22
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 4 }] });
    
    expect(result.memory![0]).toBe(0);   // [0][0]
    expect(result.memory![1]).toBe(2);   // [0][2]
    expect(result.memory![2]).toBe(20);  // [2][0]
    expect(result.memory![3]).toBe(22);  // [2][2]
  });
  
  it('should handle C64 screen correctly', async () => {
    const result = await compileAndRunInVice(`
      @map screenRam at $0400: byte[1000];
      
      function main(): void {
        // Write character at row 12, col 20 (center of screen)
        let offset: word = 12 * 40 + 20;  // = 500
        screenRam[offset] = 1;  // "A" in PETSCII
        
        // Verify by reading back
        poke($C000, peek($0400 + 500));
        brk();
      }
    `, { readMemory: [{ address: 0xC000, length: 1 }] });
    
    expect(result.memory![0]).toBe(1);
  });
});
```

### Task Breakdown

**Add to Phase 2F (Array Operations):**

| Task | Description | File |
|------|-------------|------|
| 2F.3.1 | Test 2D constant index offset | tests |
| 2F.3.2 | Test 2D variable row offset | tests |
| 2F.3.3 | Test 2D both variable offset | tests |
| 2F.3.4 | Test 3D array offset | tests |
| 2F.3.5 | VICE test 2D write/read | tests (VICE) |
| 2F.3.6 | VICE test 2D iteration | tests (VICE) |
| 2F.3.7 | VICE test C64 screen pattern | tests (VICE) |

---

## Summary: New Tasks Added

### Phase 9 Additions (Storage Classes)

| Task | Description |
|------|-------------|
| 9.7.1 | Test @zp in zero page |
| 9.7.2 | Test @zp addressing mode |
| 9.7.3 | Test @ram in RAM |
| 9.7.4 | Test default storage |
| 9.7.5 | Test @data section |
| 9.7.6 | Test @data read-only |
| 9.7.7 | VICE: @zp access |
| 9.7.8 | VICE: @data init |

### Phase 2F Additions (2D Arrays)

| Task | Description |
|------|-------------|
| 2F.3.1 | Test 2D constant offset |
| 2F.3.2 | Test 2D variable row |
| 2F.3.3 | Test 2D both variable |
| 2F.3.4 | Test 3D offset |
| 2F.3.5 | VICE: 2D write/read |
| 2F.3.6 | VICE: 2D iteration |
| 2F.3.7 | VICE: C64 screen |

---

## Success Criteria

### This amendment is complete when:

1. ✅ @zp variables placed in zero page
2. ✅ @zp uses zero page addressing mode
3. ✅ @ram variables in general RAM
4. ✅ Default storage is @ram
5. ✅ @data in data section
6. ✅ @data const enforcement works
7. ✅ 2D constant index computes at compile time
8. ✅ 2D variable index generates multiply+add
9. ✅ 3D arrays work with proper offsets
10. ✅ C64 screen pattern (25×40) works

---

## Related Documents

- [Array Operations](05-missing-opcodes.md) - Phase 2F base
- [Correctness Tests](12-correctness-tests.md) - Phase 9 base
- [VICE Test Rig](13-vice-test-rig.md) - VICE integration
- [Language Spec: Variables](../../docs/language-specification/10-variables.md) - Storage classes reference