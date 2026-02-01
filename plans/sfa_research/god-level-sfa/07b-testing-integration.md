# Testing Strategy: Integration Tests

> **Document**: god-level-sfa/07b-testing-integration.md
> **Purpose**: Integration test scenarios for SFA
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

Integration tests verify that multiple SFA components work correctly together. These tests focus on component interactions and data flow through the complete allocation pipeline.

---

## 1. Pipeline Integration Tests

### 1.1 Complete Allocation Pipeline

```typescript
describe('SFA Pipeline Integration', () => {
    describe('complete allocation flow', () => {
        it('should allocate simple program correctly', () => {
            const source = `
                fn main() {
                    let x: byte = 0;
                    helper(x);
                }
                
                fn helper(val: byte) {
                    let y: byte = val + 1;
                }
            `;
            
            const result = compileWithSFA(source, 'c64');
            
            // Verify call graph was built
            expect(result.callGraph.nodes).toHaveLength(2);
            
            // Verify frames were calculated
            expect(result.frames.get('main').totalSize).toBe(1);
            expect(result.frames.get('helper').totalSize).toBe(2); // param + local
            
            // Verify addresses were assigned
            expect(result.allocations.get('main').address).toBeDefined();
            expect(result.allocations.get('helper').address).toBeDefined();
        });

        it('should handle multi-module programs', () => {
            const modules = {
                'main.blend': `
                    import { helper } from "utils";
                    fn main() { helper(5); }
                `,
                'utils.blend': `
                    export fn helper(x: byte) { let y: byte = x; }
                `
            };
            
            const result = compileMultiModule(modules, 'c64');
            
            // Verify cross-module call graph
            const mainNode = result.callGraph.getNode('main');
            expect(mainNode.callees[0].callee.name).toBe('helper');
            
            // Verify addresses across modules
            expect(result.allocations.get('main').address).toBeDefined();
            expect(result.allocations.get('helper').address).toBeDefined();
        });
    });
});
```

### 1.2 Call Graph → Recursion Detection Integration

```typescript
describe('CallGraph → RecursionDetection Integration', () => {
    it('should detect recursion from parsed call graph', () => {
        const source = `
            fn a() { b(); }
            fn b() { c(); }
            fn c() { a(); }
        `;
        
        const ast = parse(source);
        const graph = CallGraph.buildFromAST(ast);
        const recursion = RecursionDetector.analyze(graph);
        
        expect(recursion.mutualRecursive).toHaveLength(1);
        expect(recursion.mutualRecursive[0].cycle).toHaveLength(3);
    });

    it('should correctly handle self-recursion in call graph', () => {
        const source = `
            fn factorial(n: byte): word {
                if (n <= 1) return 1;
                return n * factorial(n - 1);
            }
        `;
        
        const ast = parse(source);
        const graph = CallGraph.buildFromAST(ast);
        const recursion = RecursionDetector.analyze(graph);
        
        expect(recursion.selfRecursive).toHaveLength(1);
        expect(recursion.selfRecursive[0].function.name).toBe('factorial');
    });
});
```

### 1.3 Frame Size → ZP Allocation Integration

```typescript
describe('FrameSize → ZpAllocation Integration', () => {
    it('should allocate hot variables to ZP based on frame analysis', () => {
        const source = `
            fn hotLoop() {
                @zp let counter: byte = 0;
                for i in 0..100 {
                    counter += 1;  // Hot - in loop
                }
            }
            
            fn coldFunc() {
                let rarely_used: byte = 0;
            }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        // Hot variable should be in ZP
        const counterAlloc = findAllocation(result, 'hotLoop', 'counter');
        expect(counterAlloc.region).toBe('zp');
        
        // Cold variable should be in RAM (or ZP if space)
        const coldAlloc = findAllocation(result, 'coldFunc', 'rarely_used');
        // At minimum, counter should have higher ZP priority
        expect(counterAlloc.zpPriority).toBeGreaterThan(coldAlloc.zpPriority);
    });

    it('should respect @zp required directive', () => {
        const source = `
            fn test() {
                @zp required let critical_ptr: *byte;
                let normal_var: byte;
            }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        const ptrAlloc = findAllocation(result, 'test', 'critical_ptr');
        expect(ptrAlloc.region).toBe('zp');
    });
});
```

### 1.4 Coalescing → Address Assignment Integration

```typescript
describe('Coalescing → AddressAssignment Integration', () => {
    it('should assign same address to coalesced siblings', () => {
        const source = `
            fn main() {
                funcA();
                funcB();
            }
            
            fn funcA() {
                let bufferA: byte[32];
            }
            
            fn funcB() {
                let bufferB: byte[32];
            }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        // funcA and funcB are siblings - should coalesce
        const allocA = result.allocations.get('funcA');
        const allocB = result.allocations.get('funcB');
        
        expect(allocA.address).toBe(allocB.address);
    });

    it('should NOT coalesce caller-callee pairs', () => {
        const source = `
            fn caller() {
                let x: byte[16];
                callee();
            }
            
            fn callee() {
                let y: byte[16];
            }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        const allocCaller = result.allocations.get('caller');
        const allocCallee = result.allocations.get('callee');
        
        // Should have non-overlapping addresses
        expect(
            addressesOverlap(allocCaller, allocCallee)
        ).toBe(false);
    });
});
```

---

## 2. Thread Context Integration Tests

### 2.1 ISR Detection Through Pipeline

```typescript
describe('ISR Thread Context Integration', () => {
    it('should propagate ISR context through call chain', () => {
        const source = `
            interrupt fn irq() {
                helper1();
            }
            
            fn helper1() {
                helper2();
            }
            
            fn helper2() {
                // Leaf function
            }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        // All should be ISR context
        expect(result.contexts.get('irq')).toBe(ThreadContext.IsrOnly);
        expect(result.contexts.get('helper1')).toBe(ThreadContext.IsrOnly);
        expect(result.contexts.get('helper2')).toBe(ThreadContext.IsrOnly);
    });

    it('should detect functions called from both contexts', () => {
        const source = `
            fn main() { shared(); }
            interrupt fn irq() { shared(); }
            fn shared() {}
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        expect(result.contexts.get('main')).toBe(ThreadContext.MainOnly);
        expect(result.contexts.get('irq')).toBe(ThreadContext.IsrOnly);
        expect(result.contexts.get('shared')).toBe(ThreadContext.Both);
        
        // Should have warning for shared function
        expect(result.warnings).toContainEqual(
            expect.objectContaining({
                code: 'B6540',
                function: 'shared'
            })
        );
    });

    it('should never coalesce across thread boundaries', () => {
        const source = `
            fn main() { mainHelper(); }
            fn mainHelper() { let x: byte[16]; }
            
            interrupt fn irq() { irqHelper(); }
            fn irqHelper() { let y: byte[16]; }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        const mainHelperAlloc = result.allocations.get('mainHelper');
        const irqHelperAlloc = result.allocations.get('irqHelper');
        
        // Different thread contexts - must not overlap
        expect(
            addressesOverlap(mainHelperAlloc, irqHelperAlloc)
        ).toBe(false);
    });
});
```

---

## 3. Error Handling Integration Tests

### 3.1 Recursion Error Flow

```typescript
describe('Recursion Error Integration', () => {
    it('should produce error with full cycle for indirect recursion', () => {
        const source = `
            fn a() { b(); }
            fn b() { c(); }
            fn c() { a(); }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('B6503');
        expect(result.errors[0].cycle).toEqual(['a', 'b', 'c']);
        expect(result.errors[0].suggestions).toBeDefined();
    });

    it('should allow recursion when all cycle members are marked', () => {
        const source = `
            recursive fn a() { b(); }
            recursive fn b() { a(); }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(0);
        
        // Should use stack allocation for these
        const allocA = result.allocations.get('a');
        const allocB = result.allocations.get('b');
        expect(allocA.allocationType).toBe('stack');
        expect(allocB.allocationType).toBe('stack');
    });

    it('should error on partial recursive marking', () => {
        const source = `
            recursive fn a() { b(); }
            fn b() { a(); }  // NOT marked recursive
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('B6505');
    });
});
```

### 3.2 ZP Exhaustion Error Flow

```typescript
describe('ZP Exhaustion Error Integration', () => {
    it('should error when @zp required exceeds capacity', () => {
        // Generate source with many required ZP allocations
        const vars = Array.from({ length: 200 }, (_, i) => 
            `@zp required let var${i}: byte;`
        ).join('\n');
        
        const source = `fn test() { ${vars} }`;
        
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('B6530');
        expect(result.errors[0].available).toBeDefined();
        expect(result.errors[0].required).toBeDefined();
    });

    it('should warn on @zp spillover', () => {
        // Generate source with many preferred ZP allocations
        const vars = Array.from({ length: 200 }, (_, i) => 
            `@zp let var${i}: byte;`
        ).join('\n');
        
        const source = `fn test() { ${vars} }`;
        
        const result = compileWithSFA(source, 'c64');
        
        // Should succeed but with warnings
        expect(result.errors).toHaveLength(0);
        expect(result.warnings.some(w => w.code === 'B6531')).toBe(true);
    });
});
```

---

## 4. Platform Integration Tests

### 4.1 C64 Platform Specifics

```typescript
describe('C64 Platform Integration', () => {
    it('should use correct ZP region', () => {
        const source = `
            fn test() {
                @zp let ptr: *byte;
            }
        `;
        
        const result = compileWithSFA(source, 'c64');
        const alloc = findAllocation(result, 'test', 'ptr');
        
        // C64 ZP: $90-$FA
        expect(alloc.address).toBeGreaterThanOrEqual(0x90);
        expect(alloc.address).toBeLessThanOrEqual(0xFA);
    });

    it('should use correct RAM region', () => {
        const source = `
            fn test() {
                let buffer: byte[1024];
            }
        `;
        
        const result = compileWithSFA(source, 'c64');
        const alloc = findAllocation(result, 'test', 'buffer');
        
        // C64 RAM: $0800-$9FFF
        expect(alloc.address).toBeGreaterThanOrEqual(0x0800);
        expect(alloc.address).toBeLessThanOrEqual(0x9FFF);
    });

    it('should detect reserved ZP conflicts', () => {
        const source = `
            fn test() {
                @zp at $00 let bad_ptr: *byte;
            }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].code).toBe('B6532');
    });
});
```

### 4.2 X16 Platform Specifics

```typescript
describe('X16 Platform Integration', () => {
    it('should use correct ZP region for X16', () => {
        const source = `
            fn test() {
                @zp let ptr: *byte;
            }
        `;
        
        const result = compileWithSFA(source, 'x16');
        const alloc = findAllocation(result, 'test', 'ptr');
        
        // X16 ZP: $22-$7F
        expect(alloc.address).toBeGreaterThanOrEqual(0x22);
        expect(alloc.address).toBeLessThanOrEqual(0x7F);
    });

    it('should have different ZP capacity than C64', () => {
        const source = `
            fn test() {
                @zp let a: byte;
            }
        `;
        
        const c64Result = compileWithSFA(source, 'c64');
        const x16Result = compileWithSFA(source, 'x16');
        
        // Verify different platform configs used
        expect(c64Result.platformConfig.zpAvailable)
            .not.toBe(x16Result.platformConfig.zpAvailable);
    });
});
```

---

## 5. Code Generation Integration Tests

### 5.1 Assembly Output Verification

```typescript
describe('SFA → CodeGen Integration', () => {
    it('should generate correct labels for static frames', () => {
        const source = `
            fn myFunc() {
                let localVar: byte = 5;
            }
        `;
        
        const asm = compileToAsm(source, 'c64');
        
        // Should have BSS label for frame
        expect(asm).toContain('myFunc_localVar:');
        expect(asm).toMatch(/\.res\s+1/); // 1 byte reservation
    });

    it('should generate direct addressing for static locals', () => {
        const source = `
            fn myFunc() {
                let x: byte = 5;
                x = x + 1;
            }
        `;
        
        const asm = compileToAsm(source, 'c64');
        
        // Should use direct addressing, not indirect
        expect(asm).toContain('lda myFunc_x');
        expect(asm).toContain('sta myFunc_x');
        expect(asm).not.toContain('('); // No indirect addressing
    });

    it('should generate ZP addressing for ZP variables', () => {
        const source = `
            fn myFunc() {
                @zp let ptr: *byte;
            }
        `;
        
        const asm = compileToAsm(source, 'c64');
        
        // ZP variables use short address format
        expect(asm).toMatch(/lda\s+\$[0-9A-Fa-f]{2}[^0-9A-Fa-f]/);
    });

    it('should generate prologue/epilogue for recursive functions', () => {
        const source = `
            recursive fn factorial(n: byte): word {
                if (n <= 1) return 1;
                return n * factorial(n - 1);
            }
        `;
        
        const asm = compileToAsm(source, 'c64');
        
        // Should have stack allocation
        expect(asm).toContain('sec'); // Setup for subtraction
        expect(asm).toContain('sbc'); // Subtract frame size
    });
});
```

### 5.2 Coalesced Frame Verification

```typescript
describe('Coalesced Frame CodeGen', () => {
    it('should generate shared labels for coalesced frames', () => {
        const source = `
            fn main() { a(); b(); }
            fn a() { let x: byte; }
            fn b() { let y: byte; }
        `;
        
        const asm = compileToAsm(source, 'c64');
        
        // a and b coalesce - should share memory
        // Implementation may use shared label or same address
        const aAddr = extractAddress(asm, 'a_x');
        const bAddr = extractAddress(asm, 'b_y');
        
        expect(aAddr).toBe(bAddr);
    });
});
```

---

## 6. Memory Savings Verification

### 6.1 Coalescing Savings Tests

```typescript
describe('Memory Savings Verification', () => {
    it('should achieve expected savings with sibling coalescing', () => {
        const source = `
            fn main() {
                funcA();
                funcB();
                funcC();
            }
            
            fn funcA() { let buf: byte[100]; }
            fn funcB() { let buf: byte[100]; }
            fn funcC() { let buf: byte[100]; }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        // Without coalescing: 300 bytes
        // With coalescing: 100 bytes (all siblings share)
        expect(result.stats.totalFrameMemory).toBe(100);
        expect(result.stats.memorySaved).toBe(200);
        expect(result.stats.savingsPercent).toBeCloseTo(66.7, 1);
    });

    it('should report no savings for non-coalescable code', () => {
        const source = `
            fn a() { let x: byte[10]; b(); }
            fn b() { let y: byte[10]; c(); }
            fn c() { let z: byte[10]; }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        // All functions overlap - no coalescing possible
        expect(result.stats.memorySaved).toBe(0);
        expect(result.stats.totalFrameMemory).toBe(30);
    });
});
```

---

## 7. Test Utilities for Integration Tests

```typescript
// Integration test utilities

interface CompilationResult {
    callGraph: CallGraph;
    frames: Map<string, Frame>;
    allocations: Map<string, Allocation>;
    contexts: Map<string, ThreadContext>;
    errors: CompilerError[];
    warnings: CompilerWarning[];
    stats: AllocationStats;
    platformConfig: PlatformConfig;
}

function compileWithSFA(
    source: string, 
    platform: 'c64' | 'x16'
): CompilationResult {
    const lexer = new Lexer(source);
    const parser = new Parser(lexer.tokenize());
    const ast = parser.parse();
    const semantic = new SemanticAnalyzer(ast);
    const sfa = new StaticFrameAllocator(semantic.analyze(), platform);
    return sfa.allocate();
}

function compileMultiModule(
    modules: Record<string, string>,
    platform: 'c64' | 'x16'
): CompilationResult {
    const compiler = new MultiModuleCompiler(platform);
    for (const [name, source] of Object.entries(modules)) {
        compiler.addModule(name, source);
    }
    return compiler.compile();
}

function compileToAsm(source: string, platform: 'c64' | 'x16'): string {
    const result = compileWithSFA(source, platform);
    const codegen = new CodeGenerator(result);
    return codegen.generate();
}

function findAllocation(
    result: CompilationResult,
    funcName: string,
    varName: string
): SlotAllocation {
    const frame = result.frames.get(funcName);
    const slot = frame.slots.find(s => s.name === varName);
    return result.allocations.get(`${funcName}.${varName}`);
}

function addressesOverlap(a: Allocation, b: Allocation): boolean {
    const aEnd = a.address + a.size;
    const bEnd = b.address + b.size;
    return a.address < bEnd && b.address < aEnd;
}

function extractAddress(asm: string, label: string): number {
    const match = asm.match(new RegExp(`${label}:\\s*=\\s*\\$([0-9A-Fa-f]+)`));
    return match ? parseInt(match[1], 16) : -1;
}
```

---

## 8. Integration Test Coverage Goals

| Integration Path | Target Coverage | Critical Scenarios |
|-----------------|-----------------|-------------------|
| CallGraph → Recursion | 100% | All cycle types detected |
| Frame → ZP Allocation | 95% | Priority ordering, spillover |
| Coalescing → Address | 100% | Overlap prevention verified |
| Thread Context → Coalescing | 100% | Cross-thread never coalesced |
| Error Flow | 100% | All error codes covered |
| Platform Config | 95% | C64, X16 specifics |
| SFA → CodeGen | 90% | Correct addressing modes |

---

**Next Document:** [07c-testing-edge-cases.md](07c-testing-edge-cases.md)