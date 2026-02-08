# Testing Strategy: Performance Benchmarks

> **Document**: god-level-sfa/07d-testing-benchmarks.md
> **Purpose**: Performance benchmark tests for SFA
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

Performance benchmarks verify that the SFA meets its performance goals for memory efficiency, compilation speed, and generated code quality.

---

## 1. Memory Efficiency Benchmarks

### 1.1 Coalescing Savings Benchmarks

```typescript
describe('Coalescing Memory Savings Benchmarks', () => {
    /**
     * Benchmark: Sibling Functions Coalescing
     * 
     * Scenario: Multiple sibling functions called from same parent
     * Expected: ~50-66% memory savings through coalescing
     */
    it('benchmark: sibling coalescing efficiency', () => {
        const source = `
            fn main() {
                funcA(); funcB(); funcC(); funcD();
            }
            fn funcA() { let buf: byte[64]; }
            fn funcB() { let buf: byte[64]; }
            fn funcC() { let buf: byte[64]; }
            fn funcD() { let buf: byte[64]; }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        // Without coalescing: 4 × 64 = 256 bytes
        // With coalescing: 64 bytes (all siblings share)
        expect(result.stats.totalFrameMemory).toBe(64);
        expect(result.stats.memorySaved).toBe(192);
        expect(result.stats.savingsPercent).toBeGreaterThanOrEqual(75);
    });

    /**
     * Benchmark: Real-world Game Structure
     * 
     * Scenario: Typical game with init, update, render phases
     * Expected: ~40-55% memory savings
     */
    it('benchmark: game structure coalescing', () => {
        const source = `
            fn main() {
                init();
                while (true) {
                    update();
                    render();
                }
            }
            
            fn init() { 
                let initBuffer: byte[128];
                initGraphics();
                initSound();
            }
            fn initGraphics() { let gfxSetup: byte[64]; }
            fn initSound() { let sndSetup: byte[32]; }
            
            fn update() {
                let updateTemp: byte[32];
                updatePlayer();
                updateEnemies();
            }
            fn updatePlayer() { let playerData: byte[16]; }
            fn updateEnemies() { let enemyData: byte[48]; }
            
            fn render() {
                let renderTemp: byte[64];
                renderSprites();
                renderBackground();
            }
            fn renderSprites() { let spriteTemp: byte[32]; }
            fn renderBackground() { let bgTemp: byte[32]; }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        // Expected savings through phase coalescing:
        // - init, update, render are siblings (can share)
        // - within init: initGraphics and initSound are siblings
        // - within update: updatePlayer and updateEnemies are siblings
        // - within render: renderSprites and renderBackground are siblings
        
        // Verify significant savings achieved
        expect(result.stats.savingsPercent).toBeGreaterThanOrEqual(40);
        
        // Log actual results for analysis
        console.log('Game structure benchmark:');
        console.log(`  Total allocated: ${result.stats.totalFrameMemory} bytes`);
        console.log(`  Memory saved: ${result.stats.memorySaved} bytes`);
        console.log(`  Savings: ${result.stats.savingsPercent.toFixed(1)}%`);
    });

    /**
     * Benchmark: Deeply Nested Calls
     * 
     * Scenario: Linear call chain (no coalescing possible)
     * Expected: 0% savings (worst case)
     */
    it('benchmark: worst case (no coalescing)', () => {
        const source = `
            fn a() { let x: byte[32]; b(); }
            fn b() { let y: byte[32]; c(); }
            fn c() { let z: byte[32]; d(); }
            fn d() { let w: byte[32]; }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        // No coalescing possible - all overlap
        expect(result.stats.memorySaved).toBe(0);
        expect(result.stats.totalFrameMemory).toBe(128);
    });
});
```

### 1.2 ZP Utilization Benchmarks

```typescript
describe('Zero Page Utilization Benchmarks', () => {
    /**
     * Benchmark: ZP Fill Rate
     * 
     * Goal: Hot variables should fill available ZP
     */
    it('benchmark: ZP fill rate for hot code', () => {
        // Generate code with many variables in loops
        const vars = Array.from({ length: 20 }, (_, i) => 
            `@zp let ptr${i}: *byte;`
        ).join('\n');
        
        const source = `
            fn hotLoop() {
                ${vars}
                for i in 0..1000 {
                    // Hot loop using pointers
                }
            }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        // All 20 pointers (40 bytes) should be in ZP
        const zpAllocations = countZpAllocations(result, 'hotLoop');
        expect(zpAllocations).toBe(20);
        
        console.log('ZP fill benchmark:');
        console.log(`  ZP used: ${result.stats.zpBytesUsed}/${result.platformConfig.zpAvailable} bytes`);
        console.log(`  ZP utilization: ${(result.stats.zpBytesUsed / result.platformConfig.zpAvailable * 100).toFixed(1)}%`);
    });

    /**
     * Benchmark: ZP Priority Ordering
     * 
     * Goal: Higher priority variables get ZP first
     */
    it('benchmark: ZP priority correctness', () => {
        const source = `
            fn test() {
                // High priority - pointers in loop
                for i in 0..100 {
                    @zp let hotPtr: *byte;
                }
                
                // Low priority - plain bytes outside loop
                @zp let coldByte: byte;
            }
        `;
        
        const result = compileWithSFA(source, 'c64');
        
        const hotAlloc = findAllocation(result, 'test', 'hotPtr');
        const coldAlloc = findAllocation(result, 'test', 'coldByte');
        
        // Hot pointer should have higher priority score
        expect(hotAlloc.zpPriority).toBeGreaterThan(coldAlloc.zpPriority);
        
        // Hot pointer should be in lower ZP address (allocated first)
        if (hotAlloc.region === 'zp' && coldAlloc.region === 'zp') {
            expect(hotAlloc.address).toBeLessThan(coldAlloc.address);
        }
    });
});
```

---

## 2. Compilation Speed Benchmarks

### 2.1 Call Graph Construction Speed

```typescript
describe('Call Graph Construction Speed', () => {
    /**
     * Benchmark: Small program (10 functions)
     */
    it('benchmark: small program call graph', () => {
        const functions = Array.from({ length: 10 }, (_, i) => 
            `fn func${i}() {}`
        ).join('\n');
        
        const startTime = performance.now();
        const result = compileWithSFA(functions, 'c64');
        const endTime = performance.now();
        
        expect(endTime - startTime).toBeLessThan(100); // < 100ms
        
        console.log(`Small program (10 functions): ${(endTime - startTime).toFixed(2)}ms`);
    });

    /**
     * Benchmark: Medium program (100 functions)
     */
    it('benchmark: medium program call graph', () => {
        const functions = Array.from({ length: 100 }, (_, i) => {
            const calls = i > 0 ? `func${i - 1}();` : '';
            return `fn func${i}() { ${calls} }`;
        }).join('\n');
        
        const startTime = performance.now();
        const result = compileWithSFA(functions, 'c64');
        const endTime = performance.now();
        
        expect(endTime - startTime).toBeLessThan(500); // < 500ms
        
        console.log(`Medium program (100 functions): ${(endTime - startTime).toFixed(2)}ms`);
    });

    /**
     * Benchmark: Large program (500 functions)
     */
    it('benchmark: large program call graph', () => {
        const functions = Array.from({ length: 500 }, (_, i) => {
            const calls = i > 0 ? `func${i - 1}();` : '';
            return `fn func${i}() { ${calls} }`;
        }).join('\n');
        
        const startTime = performance.now();
        const result = compileWithSFA(functions, 'c64');
        const endTime = performance.now();
        
        expect(endTime - startTime).toBeLessThan(2000); // < 2s
        
        console.log(`Large program (500 functions): ${(endTime - startTime).toFixed(2)}ms`);
    });
});
```

### 2.2 Coalescing Algorithm Speed

```typescript
describe('Coalescing Algorithm Speed', () => {
    /**
     * Benchmark: Wide call tree (many siblings)
     */
    it('benchmark: wide tree coalescing', () => {
        // 100 sibling functions
        const siblings = Array.from({ length: 100 }, (_, i) => 
            `fn sibling${i}() { let buf: byte[32]; }`
        ).join('\n');
        
        const source = `
            fn main() {
                ${Array.from({ length: 100 }, (_, i) => `sibling${i}();`).join('\n')}
            }
            ${siblings}
        `;
        
        const startTime = performance.now();
        const result = compileWithSFA(source, 'c64');
        const endTime = performance.now();
        
        // Coalescing 100 siblings should be fast
        expect(endTime - startTime).toBeLessThan(1000);
        
        console.log(`Wide tree (100 siblings) coalescing: ${(endTime - startTime).toFixed(2)}ms`);
    });

    /**
     * Benchmark: Deep call tree (many levels)
     */
    it('benchmark: deep tree coalescing', () => {
        // 50-level deep call chain
        const functions = Array.from({ length: 50 }, (_, i) => 
            i < 49 
                ? `fn level${i}() { let buf: byte[8]; level${i + 1}(); }` 
                : `fn level${i}() { let buf: byte[8]; }`
        ).join('\n');
        
        const source = `fn main() { level0(); }\n${functions}`;
        
        const startTime = performance.now();
        const result = compileWithSFA(source, 'c64');
        const endTime = performance.now();
        
        expect(endTime - startTime).toBeLessThan(500);
        
        console.log(`Deep tree (50 levels) coalescing: ${(endTime - startTime).toFixed(2)}ms`);
    });
});
```

---

## 3. Generated Code Quality Benchmarks

### 3.1 Code Size Benchmarks

```typescript
describe('Generated Code Size Benchmarks', () => {
    /**
     * Benchmark: Static vs Stack overhead
     */
    it('benchmark: static allocation code size', () => {
        const staticSource = `
            fn staticFunc() {
                let x: byte = 5;
                let y: byte = x + 1;
            }
        `;
        
        const recursiveSource = `
            recursive fn recursiveFunc() {
                let x: byte = 5;
                let y: byte = x + 1;
            }
        `;
        
        const staticAsm = compileToAsm(staticSource, 'c64');
        const recursiveAsm = compileToAsm(recursiveSource, 'c64');
        
        const staticSize = countAsmInstructions(staticAsm, 'staticFunc');
        const recursiveSize = countAsmInstructions(recursiveAsm, 'recursiveFunc');
        
        // Static should be smaller (no prologue/epilogue)
        expect(staticSize).toBeLessThan(recursiveSize);
        
        console.log('Code size comparison:');
        console.log(`  Static function: ${staticSize} instructions`);
        console.log(`  Recursive function: ${recursiveSize} instructions`);
        console.log(`  Overhead: ${recursiveSize - staticSize} instructions (${((recursiveSize - staticSize) / staticSize * 100).toFixed(1)}%)`);
    });

    /**
     * Benchmark: Direct vs Indirect addressing
     */
    it('benchmark: addressing mode efficiency', () => {
        const source = `
            fn test() {
                let x: byte = 5;
                let y: byte = 10;
                let z: byte = x + y;
            }
        `;
        
        const asm = compileToAsm(source, 'c64');
        
        // Count addressing modes
        const directLoads = (asm.match(/lda\s+\w+/g) || []).length;
        const indirectLoads = (asm.match(/lda\s+\([^)]+\)/g) || []).length;
        
        // Static allocation should use direct addressing
        expect(directLoads).toBeGreaterThan(0);
        expect(indirectLoads).toBe(0);
        
        console.log('Addressing mode benchmark:');
        console.log(`  Direct loads: ${directLoads}`);
        console.log(`  Indirect loads: ${indirectLoads}`);
    });
});
```

### 3.2 Cycle Count Benchmarks

```typescript
describe('Cycle Count Benchmarks', () => {
    /**
     * Benchmark: Function call overhead
     */
    it('benchmark: function call cycles', () => {
        // Static function call
        const staticSource = `
            fn caller() { callee(); }
            fn callee() { let x: byte = 1; }
        `;
        
        // Recursive function call
        const recursiveSource = `
            fn caller() { callee(); }
            recursive fn callee() { let x: byte = 1; }
        `;
        
        const staticAsm = compileToAsm(staticSource, 'c64');
        const recursiveAsm = compileToAsm(recursiveSource, 'c64');
        
        const staticCycles = estimateCycles(staticAsm, 'callee');
        const recursiveCycles = estimateCycles(recursiveAsm, 'callee');
        
        // Static should be significantly faster
        expect(staticCycles).toBeLessThan(recursiveCycles);
        
        console.log('Function call cycles:');
        console.log(`  Static call: ~${staticCycles} cycles`);
        console.log(`  Recursive call: ~${recursiveCycles} cycles`);
        console.log(`  Overhead: ~${recursiveCycles - staticCycles} cycles`);
    });

    /**
     * Benchmark: Loop variable access
     */
    it('benchmark: loop variable access cycles', () => {
        // ZP variable in loop
        const zpSource = `
            fn test() {
                @zp let counter: byte = 0;
                for i in 0..100 {
                    counter += 1;
                }
            }
        `;
        
        // RAM variable in loop
        const ramSource = `
            fn test() {
                @ram let counter: byte = 0;
                for i in 0..100 {
                    counter += 1;
                }
            }
        `;
        
        const zpAsm = compileToAsm(zpSource, 'c64');
        const ramAsm = compileToAsm(ramSource, 'c64');
        
        // Count ZP (2-byte address) vs RAM (3-byte address) accesses
        const zpAccesses = (zpAsm.match(/[ls][td]a\s+\$[0-9A-Fa-f]{2}[^0-9A-Fa-f]/g) || []).length;
        const ramAccesses = (ramAsm.match(/[ls][td]a\s+\$[0-9A-Fa-f]{4}/g) || []).length;
        
        console.log('Loop variable access:');
        console.log(`  ZP accesses: ${zpAccesses} (3 cycles each)`);
        console.log(`  RAM accesses: ${ramAccesses} (4 cycles each)`);
    });
});
```

---

## 4. Platform-Specific Benchmarks

### 4.1 C64 Memory Layout Benchmarks

```typescript
describe('C64 Memory Layout Benchmarks', () => {
    /**
     * Benchmark: Maximum usable memory
     */
    it('benchmark: C64 max program memory', () => {
        // Generate large program
        const functions = Array.from({ length: 100 }, (_, i) => 
            `fn func${i}() { let buf: byte[256]; }`
        ).join('\n');
        
        const source = `fn main() {}\n${functions}`;
        const result = compileWithSFA(source, 'c64');
        
        // Verify allocations fit in C64 RAM
        for (const [name, alloc] of result.allocations) {
            expect(alloc.address).toBeGreaterThanOrEqual(0x0800);
            expect(alloc.address + alloc.size).toBeLessThanOrEqual(0x9FFF);
        }
        
        console.log('C64 memory usage:');
        console.log(`  Frame memory: ${result.stats.totalFrameMemory} bytes`);
        console.log(`  ZP used: ${result.stats.zpBytesUsed} bytes`);
        console.log(`  RAM used: ${result.stats.ramBytesUsed} bytes`);
    });
});
```

### 4.2 X16 Memory Layout Benchmarks

```typescript
describe('X16 Memory Layout Benchmarks', () => {
    /**
     * Benchmark: X16 ZP differences from C64
     */
    it('benchmark: X16 ZP utilization', () => {
        const source = `
            fn test() {
                @zp let ptr1: *byte;
                @zp let ptr2: *byte;
                @zp let ptr3: *byte;
            }
        `;
        
        const c64Result = compileWithSFA(source, 'c64');
        const x16Result = compileWithSFA(source, 'x16');
        
        // X16 has less ZP available ($22-$7F = 93 bytes)
        // C64 has more ZP available ($90-$FA = 106 bytes)
        expect(x16Result.platformConfig.zpAvailable)
            .toBeLessThan(c64Result.platformConfig.zpAvailable);
        
        console.log('Platform ZP comparison:');
        console.log(`  C64 ZP: ${c64Result.platformConfig.zpAvailable} bytes`);
        console.log(`  X16 ZP: ${x16Result.platformConfig.zpAvailable} bytes`);
    });
});
```

---

## 5. Benchmark Utilities

```typescript
// Benchmark utility functions

function countAsmInstructions(asm: string, functionName: string): number {
    // Find function block
    const funcStart = asm.indexOf(`${functionName}:`);
    if (funcStart === -1) return 0;
    
    // Find next function or end
    const funcEnd = asm.indexOf('\n.', funcStart + 1);
    const funcAsm = asm.substring(funcStart, funcEnd > 0 ? funcEnd : undefined);
    
    // Count non-directive lines
    return funcAsm.split('\n').filter(line => 
        line.trim() && 
        !line.includes(':') && 
        !line.startsWith('.')
    ).length;
}

function estimateCycles(asm: string, functionName: string): number {
    const CYCLE_COUNTS: Record<string, number> = {
        'lda': 3,  // Average (ZP=3, Abs=4)
        'sta': 3,
        'ldx': 3,
        'stx': 3,
        'ldy': 3,
        'sty': 3,
        'adc': 3,
        'sbc': 3,
        'and': 3,
        'ora': 3,
        'eor': 3,
        'cmp': 3,
        'cpx': 3,
        'cpy': 3,
        'inc': 5,
        'dec': 5,
        'inx': 2,
        'iny': 2,
        'dex': 2,
        'dey': 2,
        'tax': 2,
        'tay': 2,
        'txa': 2,
        'tya': 2,
        'tsx': 2,
        'txs': 2,
        'pha': 3,
        'pla': 4,
        'php': 3,
        'plp': 4,
        'jsr': 6,
        'rts': 6,
        'jmp': 3,
        'beq': 2,  // Average (not taken)
        'bne': 2,
        'bcc': 2,
        'bcs': 2,
        'bmi': 2,
        'bpl': 2,
        'bvc': 2,
        'bvs': 2,
        'clc': 2,
        'sec': 2,
        'cli': 2,
        'sei': 2,
        'cld': 2,
        'sed': 2,
        'clv': 2,
        'nop': 2,
    };
    
    const funcStart = asm.indexOf(`${functionName}:`);
    if (funcStart === -1) return 0;
    
    const funcEnd = asm.indexOf('\n.', funcStart + 1);
    const funcAsm = asm.substring(funcStart, funcEnd > 0 ? funcEnd : undefined);
    
    let cycles = 0;
    for (const line of funcAsm.split('\n')) {
        const trimmed = line.trim().toLowerCase();
        for (const [opcode, count] of Object.entries(CYCLE_COUNTS)) {
            if (trimmed.startsWith(opcode)) {
                cycles += count;
                break;
            }
        }
    }
    
    return cycles;
}

function countZpAllocations(result: CompilationResult, funcName: string): number {
    const frame = result.frames.get(funcName);
    if (!frame) return 0;
    
    return frame.slots.filter(slot => {
        const alloc = result.allocations.get(`${funcName}.${slot.name}`);
        return alloc && alloc.region === 'zp';
    }).length;
}
```

---

## 6. Benchmark Targets Summary

| Benchmark | Target | Priority |
|-----------|--------|----------|
| **Memory Efficiency** | | |
| Sibling coalescing | ≥75% savings | P0 |
| Game structure | ≥40% savings | P0 |
| ZP fill rate | ≥90% for hot vars | P1 |
| **Compilation Speed** | | |
| Small (10 functions) | <100ms | P1 |
| Medium (100 functions) | <500ms | P1 |
| Large (500 functions) | <2000ms | P2 |
| **Code Quality** | | |
| Static vs recursive overhead | <50% extra code | P0 |
| Direct addressing usage | 100% for static | P0 |
| ZP access in loops | Prioritized | P1 |

---

## 7. Continuous Benchmark Tracking

### Benchmark CI Integration

```typescript
// Add to CI pipeline
describe('CI Benchmark Regression Tests', () => {
    // These tests fail if performance regresses
    
    it('regression: coalescing savings', () => {
        const result = runSiblingBenchmark();
        expect(result.savingsPercent).toBeGreaterThanOrEqual(
            BASELINE.siblingCoalescing
        );
    });

    it('regression: compilation time', () => {
        const time = runMediumProgramBenchmark();
        expect(time).toBeLessThanOrEqual(
            BASELINE.mediumProgramMs * 1.1 // Allow 10% variance
        );
    });
});

const BASELINE = {
    siblingCoalescing: 75,     // percent
    mediumProgramMs: 300,      // milliseconds
    staticCodeSize: 10,        // instructions
};
```

---

## 8. Conclusion

### Benchmark Strategy Summary

1. **Memory Efficiency Tests** - Verify coalescing achieves expected savings
2. **Compilation Speed Tests** - Ensure O(n) or O(n log n) complexity
3. **Code Quality Tests** - Verify static allocation produces optimal code
4. **Platform Tests** - Confirm correct memory layout per platform
5. **Regression Tests** - Prevent performance regressions in CI

### Key Metrics to Track

| Metric | How Measured | Baseline |
|--------|--------------|----------|
| Memory savings | Bytes saved / theoretical | ≥40% |
| ZP utilization | ZP used / ZP available | ≥80% |
| Compile time | Wall clock ms | <500ms/100fn |
| Code overhead | Instructions (recursive - static) | <15 inst |

---

**End of Testing Strategy Documents**

**Document Index:**
- [07a-testing-unit-tests.md](07a-testing-unit-tests.md) - Unit test specifications
- [07b-testing-integration.md](07b-testing-integration.md) - Integration test scenarios
- [07c-testing-edge-cases.md](07c-testing-edge-cases.md) - Edge case tests
- [07d-testing-benchmarks.md](07d-testing-benchmarks.md) - Performance benchmarks (this document)