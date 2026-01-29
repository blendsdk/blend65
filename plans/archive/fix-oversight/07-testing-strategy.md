# Testing Strategy: Fix All Critical Oversights

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

The current test suite has a fundamental gap: **tests verify compilation succeeds but not that generated code works**. This document outlines the testing strategy for the oversight fixes.

### Coverage Goals

| Category | Goal |
|----------|------|
| Unit tests | 90%+ coverage for new code |
| Integration tests | All IL→ASM paths covered |
| E2E tests | Example programs produce working PRGs |
| Regression tests | All 7,059 existing tests pass |

## Current Testing Gap

### What Tests Currently Check

```typescript
// Current smoke test pattern
const result = compile('let x: byte = 10;');
expect(result.success).toBe(true);  // ✅ Passes but...
expect(result.assembly!.length).toBeGreaterThan(0);  // ✅ Has output but...
// ❌ Doesn't verify the output is CORRECT
```

### What Tests Should Check

```typescript
// Better pattern - verify specific assembly patterns
const asm = compileToAsm(`
  function add(a: byte, b: byte): byte {
    return a + b;
  }
`);

// Verify correct instructions generated (not STUB placeholders)
expectAsmNotContains(asm, 'ADC #$00');  // ❌ Should NOT have placeholder
expectAsmNotContains(asm, 'STUB:');      // ❌ Should NOT have STUB comments
expectAsmContains(asm, /ADC \$[0-9A-F]{2}/);  // ✅ Should have actual address
```

## Test Categories

### 1. Unit Tests for Value Tracking

**File**: `packages/compiler/src/__tests__/codegen/value-tracking.test.ts`

```typescript
describe('Value Tracking', () => {
  it('tracks CONST values as IMMEDIATE', () => {
    // Test that CONST instruction tracks value location
  });
  
  it('tracks STORE_VAR values as ZERO_PAGE', () => {
    // Test that stored values are tracked at their ZP address
  });
  
  it('tracks binary op results in ACCUMULATOR', () => {
    // Test that ADD result is tracked in A
  });
});
```

### 2. Unit Tests for Binary Operations

**File**: `packages/compiler/src/__tests__/codegen/binary-ops.test.ts`

```typescript
describe('Binary Operations CodeGen', () => {
  it('generates ADC with actual operand for ADD', () => {
    const asm = compileToAsm('let a: byte = 5; let b: byte = 3; let c = a + b;');
    expectAsmNotContains(asm, 'ADC #$00');
    expectAsmContains(asm, /ADC/);  // Has ADC instruction
  });
  
  it('generates SBC with actual operand for SUB', () => {
    const asm = compileToAsm('let a: byte = 10; let b: byte = 3; let c = a - b;');
    expectAsmNotContains(asm, 'SBC #$00');
  });
  
  it('generates CMP with actual operand for comparison', () => {
    const asm = compileToAsm(`
      function test(): void {
        let x: byte = 5;
        if (x > 3) { }
      }
    `);
    expectAsmNotContains(asm, 'CMP #$00');
  });
});
```

### 3. Unit Tests for Missing Operations

**File**: `packages/compiler/src/__tests__/codegen/missing-ops.test.ts`

```typescript
describe('PHI Node Lowering', () => {
  it('generates moves for PHI at if/else merge', () => {
    const asm = compileToAsm(`
      function test(): byte {
        let x: byte = 0;
        if (true) { x = 1; } else { x = 2; }
        return x;
      }
    `);
    expectAsmNotContains(asm, 'STUB: PHI');
    expectAsmNotContains(asm, /NOP.*Placeholder/);
  });
});

describe('MUL Operation', () => {
  it('generates multiply code (not NOP)', () => {
    const asm = compileToAsm(`
      function test(): byte {
        let a: byte = 5;
        let b: byte = 3;
        return a * b;
      }
    `);
    expectAsmNotContains(asm, 'STUB: MUL');
    // Either inline ASL or JSR _mul8
    expect(asm.includes('ASL') || asm.includes('_mul8')).toBe(true);
  });
});

describe('Shift Operations', () => {
  it('generates ASL for left shift', () => {
    const asm = compileToAsm('let x: byte = 1 << 3;');
    expectAsmContains(asm, 'ASL');
  });
  
  it('generates LSR for right shift', () => {
    const asm = compileToAsm('let x: byte = 8 >> 2;');
    expectAsmContains(asm, 'LSR');
  });
});

describe('Array Operations', () => {
  it('generates indexed LDA for array read', () => {
    const asm = compileToAsm(`
      let arr: byte[3] = [1, 2, 3];
      let x = arr[1];
    `);
    expectAsmContains(asm, /LDA.*,Y/);  // Indexed addressing
  });
  
  it('generates indexed STA for array write', () => {
    const asm = compileToAsm(`
      let arr: byte[3] = [0, 0, 0];
      arr[1] = 42;
    `);
    expectAsmContains(asm, /STA.*,Y/);
  });
});
```

### 4. Integration Tests for Label Generation

**File**: `packages/compiler/src/__tests__/codegen/labels.test.ts`

```typescript
describe('Label Generation', () => {
  it('emits function labels before body', () => {
    const asm = compileToAsm('function main(): void { }');
    expectAsmContains(asm, '_main:');  // Label must exist
  });
  
  it('emits data labels for initialized variables', () => {
    const asm = compileToAsm('let data: byte[3] = [1, 2, 3];');
    expectAsmContains(asm, '_data:');
  });
  
  it('uses single-dot for block labels', () => {
    const asm = compileToAsm(`
      function test(): void {
        if (true) { }
      }
    `);
    expectAsmNotContains(asm, /\.\./);  // No double dots
    expectAsmContains(asm, /\.[a-z_]+/);  // Has single-dot labels
  });
});
```

### 5. E2E Tests for Example Programs

**File**: `packages/compiler/src/__tests__/e2e/examples.test.ts`

```typescript
describe('Example Programs', () => {
  it('compiles print-demo.blend without STUB warnings', () => {
    const result = compileFile('./examples/simple/print-demo.blend');
    expect(result.success).toBe(true);
    
    // Check no STUB comments in output
    const stubCount = countAsmOccurrences(result.assembly!, /STUB:/g);
    expect(stubCount).toBe(0);
    
    // Check no placeholder NOPs
    expectAsmNotContains(result.assembly!, /NOP.*Placeholder/);
  });
  
  it('compiles main.blend without undefined label errors', () => {
    const result = compileFile('./examples/simple/main.blend');
    expect(result.success).toBe(true);
    
    // Check warnings for undefined labels
    const undefinedErrors = result.warnings?.filter(w => 
      w.message.includes('not defined')
    );
    expect(undefinedErrors).toHaveLength(0);
  });
  
  it('compiles snake-game/hardware.blend without semantic errors', () => {
    const result = compileFile('./examples/snake-game/hardware.blend');
    expect(result.success).toBe(true);
    
    // No "type unknown" errors
    const typeErrors = result.errors?.filter(e =>
      e.message.includes('type unknown')
    );
    expect(typeErrors).toHaveLength(0);
  });
});
```

### 6. Semantic Tests for Member Access

**File**: `packages/compiler/src/__tests__/semantic/member-access.test.ts`

```typescript
describe('Member Access Resolution', () => {
  it('resolves module member types', () => {
    const result = compile(`
      import { vic } from "@blend65/c64/hardware";
      vic.borderColor = 0;
    `);
    expect(result.success).toBe(true);
    expect(result.errors.filter(e => e.message.includes('unknown'))).toHaveLength(0);
  });
  
  it('resolves @map member access', () => {
    // Test that @map declarations in modules resolve correctly
  });
});
```

## Verification Checklist

### Before Each Phase Completion:

- [ ] Run `./compiler-test` - all tests pass
- [ ] No new STUB comments in generated assembly
- [ ] Example programs compile without errors

### Final Verification:

- [ ] `./compiler-test` passes (7,059+ tests)
- [ ] `print-demo.blend` produces working PRG
- [ ] `main.blend` produces working PRG
- [ ] `hardware.blend` compiles without semantic errors
- [ ] No regression in existing functionality

## Test Data / Fixtures

### Fixtures Needed

| Fixture | Purpose |
|---------|---------|
| `binary-ops.blend` | Test ADD, SUB, AND, OR, XOR |
| `comparisons.blend` | Test all CMP_* operations |
| `phi-merge.blend` | Test PHI at control flow merge |
| `multiply.blend` | Test MUL operations |
| `arrays.blend` | Test LOAD_ARRAY, STORE_ARRAY |

### Location

`packages/compiler/fixtures/06-codegen/`