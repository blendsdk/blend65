# Testing Strategy

> **Document**: 07-testing-strategy.md  
> **Parent**: [Index](00-index.md)

## Overview

This document defines the comprehensive testing strategy for the address-of operator and callback implementation.

## Test Categories

| Category | Purpose | Location |
|----------|---------|----------|
| Unit Tests | Test individual components | `packages/compiler/src/__tests__/` |
| Integration Tests | Test component interactions | `packages/compiler/src/__tests__/integration/` |
| End-to-End Tests | Test full compilation | `packages/compiler/src/__tests__/e2e/` |

## Phase 1: IL Infrastructure Tests

### LoadAddressInstruction Tests

**File**: `packages/compiler/src/__tests__/il/load-address-instruction.test.ts`

```typescript
describe('LoadAddressInstruction', () => {
  describe('construction', () => {
    it('should create instruction with variable symbol kind', () => {
      const reg = new ILRegister('r1');
      const instr = new LoadAddressInstruction('counter', 'variable', reg);
      
      expect(instr.getOpcode()).toBe(ILOpcode.LOAD_ADDRESS);
      expect(instr.getSymbolName()).toBe('counter');
      expect(instr.getSymbolKind()).toBe('variable');
      expect(instr.getResult()).toBe(reg);
    });
    
    it('should create instruction with function symbol kind', () => {
      const reg = new ILRegister('r2');
      const instr = new LoadAddressInstruction('myFunc', 'function', reg);
      
      expect(instr.getSymbolKind()).toBe('function');
    });
  });
  
  describe('toString', () => {
    it('should format variable address correctly', () => {
      const instr = new LoadAddressInstruction('x', 'variable', new ILRegister('r1'));
      expect(instr.toString()).toBe('LOAD_ADDRESS "x", "variable" -> r1');
    });
    
    it('should format function address correctly', () => {
      const instr = new LoadAddressInstruction('fn', 'function', new ILRegister('r2'));
      expect(instr.toString()).toBe('LOAD_ADDRESS "fn", "function" -> r2');
    });
  });
  
  describe('withResult', () => {
    it('should clone instruction with new result register', () => {
      const original = new LoadAddressInstruction('sym', 'variable', new ILRegister('r1'));
      const cloned = original.withResult(new ILRegister('r5'));
      
      expect(cloned.getSymbolName()).toBe('sym');
      expect(cloned.getResult().getName()).toBe('r5');
    });
  });
});
```

### Type Guard Tests

```typescript
describe('isLoadAddressInstruction', () => {
  it('should return true for LoadAddressInstruction', () => {
    const instr = new LoadAddressInstruction('x', 'variable', new ILRegister('r1'));
    expect(isLoadAddressInstruction(instr)).toBe(true);
  });
  
  it('should return false for other instructions', () => {
    const instr = new ConstInstruction(42, new ILRegister('r1'));
    expect(isLoadAddressInstruction(instr)).toBe(false);
  });
});
```

## Phase 2: IL Builder Tests

**File**: `packages/compiler/src/__tests__/il/builder-load-address.test.ts`

```typescript
describe('ILBuilder.emitLoadAddress', () => {
  let builder: ILBuilder;
  
  beforeEach(() => {
    builder = new ILBuilder();
  });
  
  it('should emit LOAD_ADDRESS for variable', () => {
    const reg = builder.emitLoadAddress('myVar', 'variable');
    
    const instructions = builder.getInstructions();
    expect(instructions).toHaveLength(1);
    
    const instr = instructions[0] as LoadAddressInstruction;
    expect(instr.getSymbolName()).toBe('myVar');
    expect(instr.getSymbolKind()).toBe('variable');
  });
  
  it('should emit LOAD_ADDRESS for function', () => {
    const reg = builder.emitLoadAddress('myFunc', 'function');
    
    const instructions = builder.getInstructions();
    const instr = instructions[0] as LoadAddressInstruction;
    expect(instr.getSymbolKind()).toBe('function');
  });
  
  it('should return unique register for each call', () => {
    const reg1 = builder.emitLoadAddress('a', 'variable');
    const reg2 = builder.emitLoadAddress('b', 'function');
    
    expect(reg1.getName()).not.toBe(reg2.getName());
  });
});
```

## Phase 3: IL Generator Tests

**File**: `packages/compiler/src/__tests__/il/generator-address-of.test.ts`

```typescript
describe('IL Generator - Address-of Operator', () => {
  describe('@variable', () => {
    it('should generate LOAD_ADDRESS for local variable', () => {
      const source = `
        function test(): void {
          let x: byte = 0;
          let addr: word = @x;
        }
      `;
      const il = compileToIL(source);
      
      expectILContains(il, 'LOAD_ADDRESS "x", "variable"');
    });
    
    it('should generate LOAD_ADDRESS for global variable', () => {
      const source = `
        let counter: byte = 0;
        function test(): void {
          let addr: word = @counter;
        }
      `;
      const il = compileToIL(source);
      
      expectILContains(il, 'LOAD_ADDRESS "counter", "variable"');
    });
    
    it('should generate LOAD_ADDRESS for parameter', () => {
      const source = `
        function test(x: byte): word {
          return @x;
        }
      `;
      const il = compileToIL(source);
      
      expectILContains(il, 'LOAD_ADDRESS "x", "variable"');
    });
  });
  
  describe('@function', () => {
    it('should generate LOAD_ADDRESS for function', () => {
      const source = `
        function myFunc(): void { }
        function test(): void {
          let addr: word = @myFunc;
        }
      `;
      const il = compileToIL(source);
      
      expectILContains(il, 'LOAD_ADDRESS "myFunc", "function"');
    });
    
    it('should generate LOAD_ADDRESS for callback function', () => {
      const source = `
        callback function irqHandler(): void { }
        function test(): void {
          let addr: word = @irqHandler;
        }
      `;
      const il = compileToIL(source);
      
      expectILContains(il, 'LOAD_ADDRESS "irqHandler", "function"');
    });
  });
  
  describe('error cases', () => {
    it('should error on @(expression)', () => {
      const source = `
        function test(): void {
          let addr: word = @(1 + 2);
        }
      `;
      
      expect(() => compileToIL(source)).toThrow('Address-of operator requires an identifier');
    });
    
    it('should error on @unknownSymbol', () => {
      const source = `
        function test(): void {
          let addr: word = @unknownVar;
        }
      `;
      
      expect(() => compileToIL(source)).toThrow("Unknown symbol 'unknownVar'");
    });
  });
});
```

## Phase 4: Callback Parameter Tests

**File**: `packages/compiler/src/__tests__/il/generator-callback.test.ts`

```typescript
describe('IL Generator - Callback Parameters', () => {
  it('should generate LOAD_ADDRESS when passing function to callback param', () => {
    const source = `
      function setHandler(h: callback): void { }
      callback function myHandler(): void { }
      
      function test(): void {
        setHandler(myHandler);
      }
    `;
    const il = compileToIL(source);
    
    // Should load function address when passing to callback parameter
    expectILContains(il, 'LOAD_ADDRESS "myHandler", "function"');
    expectILContains(il, 'CALL "setHandler"');
  });
  
  it('should work with non-callback functions passed to callback', () => {
    const source = `
      function setHandler(h: callback): void { }
      function regularFunc(): void { }
      
      function test(): void {
        setHandler(regularFunc);
      }
    `;
    const il = compileToIL(source);
    
    // Regular functions can also be passed as callbacks
    expectILContains(il, 'LOAD_ADDRESS "regularFunc", "function"');
  });
});
```

## Phase 5: ASM-IL Tests

**File**: `packages/compiler/src/__tests__/asm-il/load-address-emitter.test.ts`

```typescript
describe('ASM-IL - LOAD_ADDRESS emission', () => {
  it('should emit low/high byte loads for variable', () => {
    const il = [
      new LoadAddressInstruction('counter', 'variable', new ILRegister('r1'))
    ];
    
    const asmIl = convertToAsmIL(il);
    
    expect(asmIl).toContainInstruction('r1_lo = #<_var_counter');
    expect(asmIl).toContainInstruction('r1_hi = #>_var_counter');
  });
  
  it('should emit correct label for function', () => {
    const il = [
      new LoadAddressInstruction('myFunc', 'function', new ILRegister('r1'))
    ];
    
    const asmIl = convertToAsmIL(il);
    
    expect(asmIl).toContainInstruction('r1_lo = #<_fn_myFunc');
    expect(asmIl).toContainInstruction('r1_hi = #>_fn_myFunc');
  });
});
```

## Phase 6: CodeGen Tests

**File**: `packages/compiler/src/__tests__/codegen/address-generation.test.ts`

```typescript
describe('CodeGen - Address Loading', () => {
  it('should generate LDA #< and LDA #> for variable address', () => {
    const source = `
      let counter: byte = 0;
      let addr: word = @counter;
    `;
    const asm = compileToAsm(source);
    
    expect(asm).toContain('LDA #<_var_counter');
    expect(asm).toContain('LDA #>_var_counter');
  });
  
  it('should generate correct 6502 for function address', () => {
    const source = `
      callback function irq(): void { }
      let addr: word = @irq;
    `;
    const asm = compileToAsm(source);
    
    expect(asm).toContain('LDA #<_fn_irq');
    expect(asm).toContain('LDA #>_fn_irq');
  });
  
  it('should store 16-bit address to word variable', () => {
    const source = `
      let x: byte = 0;
      let addr: word = @x;
    `;
    const asm = compileToAsm(source);
    
    // Should store low byte then high byte
    expect(asm).toMatch(/LDA #<.*\n.*STA.*\n.*LDA #>.*\n.*STA/);
  });
});
```

## Phase 7: End-to-End Tests

**File**: `packages/compiler/src/__tests__/e2e/address-operator.test.ts`

```typescript
describe('E2E - Address-of Operator', () => {
  it('should compile complete address-of usage', () => {
    const source = `
      @map borderColor at $D020: byte;
      
      let counter: byte = 0;
      let counterAddr: word = @counter;
      
      callback function rasterIRQ(): void {
        borderColor = borderColor + 1;
      }
      
      function main(): void {
        let irqAddr: word = @rasterIRQ;
      }
    `;
    
    const result = compile(source);
    
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.assembly).toContain('LDA #<');
    expect(result.assembly).toContain('LDA #>');
  });
  
  it('should compile callback parameter passing', () => {
    const source = `
      function setHandler(line: byte, handler: callback): void {
        // Would store to IRQ vector
      }
      
      callback function myIRQ(): void { }
      
      function main(): void {
        setHandler(100, myIRQ);
      }
    `;
    
    const result = compile(source);
    
    expect(result.success).toBe(true);
    expect(result.assembly).toContain('_fn_myIRQ');
  });
});
```

## Test Utilities

### Helper Functions

```typescript
/**
 * Compiles source to IL and returns IL string representation.
 */
function compileToIL(source: string): string {
  const compiler = new Compiler();
  const result = compiler.compileToIL(source);
  return result.toString();
}

/**
 * Asserts that IL output contains expected instruction pattern.
 */
function expectILContains(il: string, pattern: string): void {
  expect(il).toContain(pattern);
}

/**
 * Compiles source to 6502 assembly.
 */
function compileToAsm(source: string): string {
  const compiler = new Compiler();
  return compiler.compile(source).assembly;
}
```

## Coverage Requirements

| Component | Target Coverage |
|-----------|----------------|
| LoadAddressInstruction | 100% |
| ILBuilder.emitLoadAddress | 100% |
| IL Generator address-of | 95%+ |
| ASM-IL emitter | 95%+ |
| CodeGen | 95%+ |
| E2E scenarios | All documented use cases |