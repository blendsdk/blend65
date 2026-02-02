# Testing Strategy: Edge Case Tests

> **Document**: god-level-sfa/07c-testing-edge-cases.md
> **Purpose**: Edge case test scenarios for SFA
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

Edge case tests verify that the SFA handles unusual, boundary, and error conditions correctly. These tests are derived from the edge case catalog in [06-edge-cases.md](06-edge-cases.md).

---

## 1. Frame Size Edge Case Tests

### 1.1 Empty Function Tests

```typescript
describe('Empty Function Edge Cases', () => {
    it('should handle function with no locals or params', () => {
        const source = `fn empty() {}`;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.frames.get('empty').totalSize).toBe(0);
        expect(result.errors).toHaveLength(0);
    });

    it('should generate simple RTS for empty function', () => {
        const source = `fn empty() {}`;
        const asm = compileToAsm(source, 'c64');
        
        expect(asm).toContain('empty:');
        expect(asm).toContain('rts');
        // Should NOT have frame allocation
        expect(asm).not.toContain('empty_frame');
    });

    it('should include empty functions in coalescing analysis', () => {
        const source = `
            fn main() { a(); b(); }
            fn a() {}
            fn b() { let x: byte; }
        `;
        const result = compileWithSFA(source, 'c64');
        
        // a (empty) and b should still be analyzed for overlap
        expect(result.callGraph.getNode('a')).toBeDefined();
        expect(result.callGraph.getNode('b')).toBeDefined();
    });
});
```

### 1.2 Large Frame Tests

```typescript
describe('Large Frame Edge Cases', () => {
    it('should handle frame > 256 bytes', () => {
        const source = `
            fn bigFunc() {
                let buffer1: byte[128];
                let buffer2: byte[128];
                let buffer3: byte[128];
            }
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.frames.get('bigFunc').totalSize).toBe(384);
        expect(result.errors).toHaveLength(0);
    });

    it('should generate direct addressing for large frame', () => {
        const source = `
            fn bigFunc() {
                let buffer: byte[300];
                buffer[0] = 1;
                buffer[299] = 2;
            }
        `;
        const asm = compileToAsm(source, 'c64');
        
        // Should use direct addressing with computed offsets
        expect(asm).toContain('bigFunc_buffer');
        expect(asm).not.toContain('('); // No indirect addressing
    });

    it('should warn for extremely large frame (>10% RAM)', () => {
        const source = `
            fn hugeFunc() {
                let megaBuffer: byte[8192];
            }
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.warnings.some(w => w.code === 'B6510')).toBe(true);
    });
});
```

---

## 2. Call Depth Edge Case Tests

### 2.1 Deep Call Chain Tests

```typescript
describe('Deep Call Chain Edge Cases', () => {
    it('should warn at depth > 64', () => {
        // Generate 70-level call chain
        const functions = Array.from({ length: 70 }, (_, i) => 
            i < 69 
                ? `fn f${i}() { f${i + 1}(); }` 
                : `fn f${i}() {}`
        ).join('\n');
        const source = `fn main() { f0(); }\n${functions}`;
        
        const result = compileWithSFA(source, 'c64');
        
        expect(result.warnings.some(w => w.code === 'B6520')).toBe(true);
    });

    it('should error at depth > 100', () => {
        // Generate 105-level call chain
        const functions = Array.from({ length: 105 }, (_, i) => 
            i < 104 
                ? `fn f${i}() { f${i + 1}(); }` 
                : `fn f${i}() {}`
        ).join('\n');
        const source = `fn main() { f0(); }\n${functions}`;
        
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors.some(e => e.code === 'B6521')).toBe(true);
    });

    it('should calculate correct max depth', () => {
        const source = `
            fn main() { a(); x(); }
            fn a() { b(); }
            fn b() { c(); }
            fn c() {}
            fn x() {}
        `;
        const result = compileWithSFA(source, 'c64');
        
        // main → a → b → c = depth 4
        expect(result.stats.maxCallDepth).toBe(4);
    });
});
```

### 2.2 Diamond Pattern Tests

```typescript
describe('Diamond Pattern Edge Cases', () => {
    it('should correctly handle diamond call pattern', () => {
        const source = `
            fn main() { a(); b(); }
            fn a() { shared(); }
            fn b() { shared(); }
            fn shared() { let x: byte[32]; }
        `;
        const result = compileWithSFA(source, 'c64');
        
        // shared cannot coalesce with main, a, or b
        // But a and b can coalesce with each other
        const allocA = result.allocations.get('a');
        const allocB = result.allocations.get('b');
        const allocShared = result.allocations.get('shared');
        
        // a and b might share (both siblings of main)
        // shared must not overlap with any
        expect(addressesOverlap(allocA, allocShared)).toBe(false);
        expect(addressesOverlap(allocB, allocShared)).toBe(false);
    });

    it('should handle complex diamond with multiple shared', () => {
        const source = `
            fn main() { a(); b(); c(); }
            fn a() { x(); y(); }
            fn b() { x(); z(); }
            fn c() { y(); z(); }
            fn x() {}
            fn y() {}
            fn z() {}
        `;
        const result = compileWithSFA(source, 'c64');
        
        // No errors - correct coalescing analysis
        expect(result.errors).toHaveLength(0);
    });
});
```

---

## 3. Zero Page Edge Case Tests

### 3.1 ZP Exhaustion Tests

```typescript
describe('ZP Exhaustion Edge Cases', () => {
    it('should error when @zp required exceeds capacity', () => {
        // C64 has ~106 bytes ZP available
        const vars = Array.from({ length: 120 }, (_, i) => 
            `@zp required let ptr${i}: byte;`
        ).join('\n');
        const source = `fn test() { ${vars} }`;
        
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('B6530');
    });

    it('should include helpful info in ZP exhaustion error', () => {
        const vars = Array.from({ length: 120 }, (_, i) => 
            `@zp required let ptr${i}: byte;`
        ).join('\n');
        const source = `fn test() { ${vars} }`;
        
        const result = compileWithSFA(source, 'c64');
        const error = result.errors[0];
        
        expect(error.available).toBeDefined();
        expect(error.required).toBeDefined();
        expect(error.overflow).toBeDefined();
        expect(error.suggestions).toBeDefined();
    });
});
```

### 3.2 ZP Spillover Tests

```typescript
describe('ZP Spillover Edge Cases', () => {
    it('should spill low-priority @zp to RAM when full', () => {
        // Create mix of high and low priority
        const highPriority = Array.from({ length: 50 }, (_, i) => 
            `@zp let hot${i}: *byte;`  // Pointers = high priority
        ).join('\n');
        const lowPriority = Array.from({ length: 100 }, (_, i) => 
            `@zp let cold${i}: byte;`  // Plain bytes = lower priority
        ).join('\n');
        
        const source = `fn test() { ${highPriority} ${lowPriority} }`;
        const result = compileWithSFA(source, 'c64');
        
        // All high priority should be in ZP
        for (let i = 0; i < 50; i++) {
            const alloc = findAllocation(result, 'test', `hot${i}`);
            expect(alloc.region).toBe('zp');
        }
        
        // Some low priority should spill to RAM
        const ramAllocations = Array.from({ length: 100 }, (_, i) => 
            findAllocation(result, 'test', `cold${i}`)
        ).filter(a => a.region === 'ram');
        
        expect(ramAllocations.length).toBeGreaterThan(0);
    });

    it('should warn on spillover', () => {
        const vars = Array.from({ length: 150 }, (_, i) => 
            `@zp let var${i}: byte;`
        ).join('\n');
        const source = `fn test() { ${vars} }`;
        
        const result = compileWithSFA(source, 'c64');
        
        expect(result.warnings.some(w => w.code === 'B6531')).toBe(true);
    });
});
```

### 3.3 Reserved ZP Conflict Tests

```typescript
describe('Reserved ZP Conflict Edge Cases', () => {
    it('should error on $00-$01 conflict (CPU indirect)', () => {
        const source = `
            fn test() {
                @zp at $00 let bad: *byte;
            }
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('B6532');
        expect(result.errors[0].message).toContain('CPU indirect');
    });

    it('should error on BASIC/KERNAL workspace conflict', () => {
        const source = `
            fn test() {
                @zp at $50 let conflict: byte;  // In BASIC workspace
            }
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('B6532');
    });

    it('should allow valid ZP addresses', () => {
        const source = `
            fn test() {
                @zp at $90 let valid: byte;  // Valid C64 ZP
            }
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(0);
        const alloc = findAllocation(result, 'test', 'valid');
        expect(alloc.address).toBe(0x90);
    });
});
```

---

## 4. Interrupt Safety Edge Case Tests

### 4.1 Main+ISR Shared Function Tests

```typescript
describe('Main+ISR Shared Function Edge Cases', () => {
    it('should warn when function called from both contexts', () => {
        const source = `
            fn main() { shared(); }
            interrupt fn irq() { shared(); }
            fn shared() { let x: byte; }
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.warnings.some(w => w.code === 'B6540')).toBe(true);
    });

    it('should include both call paths in warning', () => {
        const source = `
            fn main() { shared(); }
            interrupt fn irq() { shared(); }
            fn shared() {}
        `;
        const result = compileWithSFA(source, 'c64');
        
        const warning = result.warnings.find(w => w.code === 'B6540');
        expect(warning.mainPath).toBeDefined();
        expect(warning.isrPath).toBeDefined();
    });

    it('should not coalesce shared function with main-only', () => {
        const source = `
            fn main() { mainOnly(); shared(); }
            fn mainOnly() { let x: byte[32]; }
            interrupt fn irq() { shared(); }
            fn shared() { let y: byte[32]; }
        `;
        const result = compileWithSFA(source, 'c64');
        
        const mainOnlyAlloc = result.allocations.get('mainOnly');
        const sharedAlloc = result.allocations.get('shared');
        
        // Cannot coalesce - different thread context safety
        expect(addressesOverlap(mainOnlyAlloc, sharedAlloc)).toBe(false);
    });
});
```

### 4.2 Nested Interrupt Tests

```typescript
describe('Nested Interrupt Edge Cases', () => {
    it('should treat NMI and IRQ as separate contexts', () => {
        const source = `
            interrupt fn irq() { irqHelper(); }
            fn irqHelper() { let x: byte[16]; }
            
            interrupt fn nmi() { nmiHelper(); }
            fn nmiHelper() { let y: byte[16]; }
        `;
        const result = compileWithSFA(source, 'c64');
        
        const irqHelperAlloc = result.allocations.get('irqHelper');
        const nmiHelperAlloc = result.allocations.get('nmiHelper');
        
        // Different ISR contexts - must not overlap
        expect(addressesOverlap(irqHelperAlloc, nmiHelperAlloc)).toBe(false);
    });

    it('should warn when function callable from both IRQ and NMI', () => {
        const source = `
            interrupt fn irq() { shared(); }
            interrupt fn nmi() { shared(); }
            fn shared() {}
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.warnings.some(w => w.code === 'B6541')).toBe(true);
    });
});
```

---

## 5. Recursion Edge Case Tests

### 5.1 Self-Recursion Tests

```typescript
describe('Self-Recursion Edge Cases', () => {
    it('should error on unmarked self-recursion', () => {
        const source = `
            fn factorial(n: byte): word {
                if (n <= 1) return 1;
                return n * factorial(n - 1);
            }
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('B6502');
    });

    it('should include call site in self-recursion error', () => {
        const source = `
            fn factorial(n: byte): word {
                return factorial(n - 1);
            }
        `;
        const result = compileWithSFA(source, 'c64');
        
        const error = result.errors[0];
        expect(error.callSites).toBeDefined();
        expect(error.callSites.length).toBeGreaterThan(0);
    });

    it('should allow marked self-recursion', () => {
        const source = `
            recursive fn factorial(n: byte): word {
                if (n <= 1) return 1;
                return n * factorial(n - 1);
            }
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(0);
    });
});
```

### 5.2 Mutual Recursion Tests

```typescript
describe('Mutual Recursion Edge Cases', () => {
    it('should detect 2-function mutual recursion', () => {
        const source = `
            fn even(n: byte): bool { return n == 0 || odd(n - 1); }
            fn odd(n: byte): bool { return n != 0 && even(n - 1); }
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('B6503');
        expect(result.errors[0].cycle).toContain('even');
        expect(result.errors[0].cycle).toContain('odd');
    });

    it('should detect 3+ function mutual recursion', () => {
        const source = `
            fn a() { b(); }
            fn b() { c(); }
            fn c() { a(); }
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors[0].cycle).toHaveLength(3);
    });

    it('should require ALL cycle members to be marked', () => {
        const source = `
            recursive fn a() { b(); }
            fn b() { a(); }  // NOT marked
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('B6505');
    });
});
```

### 5.3 Cross-Module Recursion Tests

```typescript
describe('Cross-Module Recursion Edge Cases', () => {
    it('should detect cross-module recursion', () => {
        const modules = {
            'a.blend': `
                import { bFunc } from "b";
                export fn aFunc() { bFunc(); }
            `,
            'b.blend': `
                import { aFunc } from "a";
                export fn bFunc() { aFunc(); }
            `
        };
        
        const result = compileMultiModule(modules, 'c64');
        
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('B6504');
    });

    it('should include module paths in cross-module error', () => {
        const modules = {
            'ui/renderer.blend': `
                import { layoutChildren } from "ui/layout";
                export fn renderWidget() { layoutChildren(); }
            `,
            'ui/layout.blend': `
                import { renderWidget } from "ui/renderer";
                export fn layoutChildren() { renderWidget(); }
            `
        };
        
        const result = compileMultiModule(modules, 'c64');
        
        const error = result.errors[0];
        expect(error.message).toContain('ui/renderer');
        expect(error.message).toContain('ui/layout');
    });
});
```

---

## 6. Parameter Edge Case Tests

### 6.1 Many Parameters Tests

```typescript
describe('Many Parameters Edge Cases', () => {
    it('should handle 8+ parameters', () => {
        const source = `
            fn manyParams(
                a: byte, b: byte, c: byte, d: byte,
                e: byte, f: byte, g: byte, h: byte
            ) {}
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(0);
        expect(result.frames.get('manyParams').totalSize).toBe(8);
    });

    it('should emit info for 8+ parameters', () => {
        const source = `
            fn manyParams(
                a: byte, b: byte, c: byte, d: byte,
                e: byte, f: byte, g: byte, h: byte
            ) {}
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.infos.some(i => i.code === 'B6550')).toBe(true);
    });

    it('should pass first params in registers', () => {
        const source = `
            fn twoParams(a: byte, b: byte) {
                let x: byte = a + b;
            }
        `;
        const asm = compileToAsm(source, 'c64');
        
        // First params typically passed in A, Y
        // Verify no static storage for first params
        expect(asm).not.toContain('twoParams_a:');
        expect(asm).not.toContain('twoParams_b:');
    });
});
```

### 6.2 Large Struct Parameter Tests

```typescript
describe('Large Struct Parameter Edge Cases', () => {
    it('should handle struct by value', () => {
        const source = `
            struct Point { x: byte, y: byte }
            fn movePoint(p: Point) {}
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(0);
        expect(result.frames.get('movePoint').totalSize).toBe(2);
    });

    it('should emit info suggesting reference for large struct', () => {
        const source = `
            struct BigStruct {
                a: byte, b: byte, c: byte, d: byte,
                e: word, f: word
            }
            fn processStruct(s: BigStruct) {}
        `;
        const result = compileWithSFA(source, 'c64');
        
        expect(result.infos.some(i => i.code === 'B6551')).toBe(true);
    });
});
```

---

## 7. Volatile Memory Edge Case Tests

```typescript
describe('Volatile Memory Edge Cases', () => {
    it('should never optimize @map memory access', () => {
        const source = `
            @map screenColor at $D020: byte;
            fn blink() {
                screenColor = 0;
                screenColor = 1;
            }
        `;
        const asm = compileToAsm(source, 'c64');
        
        // Both stores MUST be present
        const storeCount = (asm.match(/sta\s+\$D020/g) || []).length;
        expect(storeCount).toBe(2);
    });

    it('should not coalesce @map with regular variables', () => {
        const source = `
            @map vic_ctrl at $D011: byte;
            fn test() {
                let regular: byte = 0;
                vic_ctrl = regular;
            }
        `;
        const result = compileWithSFA(source, 'c64');
        
        // regular must not share address with vic_ctrl
        // (vic_ctrl is at fixed address anyway)
        const regularAlloc = findAllocation(result, 'test', 'regular');
        expect(regularAlloc.address).not.toBe(0xD011);
    });
});
```

---

## 8. Edge Case Test Coverage Summary

| Category | Test Count | Critical Cases |
|----------|------------|----------------|
| Frame Size | 8 | Empty, >256, >10% RAM |
| Call Depth | 5 | >64 warn, >100 error, diamond |
| Zero Page | 9 | Exhaustion, spillover, reserved |
| Interrupt | 6 | Main+ISR, nested, cross-thread |
| Recursion | 8 | Self, mutual, cross-module, partial |
| Parameters | 5 | Many params, large struct |
| Volatile | 2 | @map access, no coalesce |

**Total Edge Case Tests: ~43 test cases**

---

**Next Document:** [07d-testing-benchmarks.md](07d-testing-benchmarks.md)