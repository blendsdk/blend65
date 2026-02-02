# Testing Strategy: Unit Tests

> **Document**: god-level-sfa/07a-testing-unit-tests.md
> **Purpose**: Unit test categories and specifications for SFA
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

This document defines unit tests for each SFA component. Unit tests verify individual functions and classes work correctly in isolation.

---

## 1. Call Graph Unit Tests

### 1.1 CallGraphNode Tests

```typescript
describe('CallGraphNode', () => {
    describe('construction', () => {
        it('should create node with function symbol', () => {
            const fn = createMockFunction('myFunc');
            const node = new CallGraphNode(fn);
            expect(node.function).toBe(fn);
            expect(node.callees).toEqual([]);
            expect(node.callers).toEqual([]);
        });
    });

    describe('addCallee', () => {
        it('should add callee with call site location', () => {
            const caller = new CallGraphNode(createMockFunction('caller'));
            const callee = createMockFunction('callee');
            const location = createMockLocation(10, 5);
            
            caller.addCallee(callee, location);
            
            expect(caller.callees).toHaveLength(1);
            expect(caller.callees[0].callee).toBe(callee);
            expect(caller.callees[0].callSites).toContain(location);
        });

        it('should aggregate multiple call sites to same callee', () => {
            const caller = new CallGraphNode(createMockFunction('caller'));
            const callee = createMockFunction('callee');
            
            caller.addCallee(callee, createMockLocation(10, 5));
            caller.addCallee(callee, createMockLocation(20, 5));
            
            expect(caller.callees).toHaveLength(1);
            expect(caller.callees[0].callSites).toHaveLength(2);
        });
    });
});
```

### 1.2 CallGraph Construction Tests

```typescript
describe('CallGraph', () => {
    describe('buildFromAST', () => {
        it('should create node for each function', () => {
            const ast = parseProgram(`
                fn a() {}
                fn b() {}
                fn c() {}
            `);
            
            const graph = CallGraph.buildFromAST(ast);
            
            expect(graph.nodes).toHaveLength(3);
            expect(graph.getNode('a')).toBeDefined();
            expect(graph.getNode('b')).toBeDefined();
            expect(graph.getNode('c')).toBeDefined();
        });

        it('should detect direct calls', () => {
            const ast = parseProgram(`
                fn caller() { callee(); }
                fn callee() {}
            `);
            
            const graph = CallGraph.buildFromAST(ast);
            const callerNode = graph.getNode('caller');
            
            expect(callerNode.callees).toHaveLength(1);
            expect(callerNode.callees[0].callee.name).toBe('callee');
        });

        it('should handle nested calls', () => {
            const ast = parseProgram(`
                fn a() { b(); }
                fn b() { c(); }
                fn c() {}
            `);
            
            const graph = CallGraph.buildFromAST(ast);
            
            expect(graph.getNode('a').callees[0].callee.name).toBe('b');
            expect(graph.getNode('b').callees[0].callee.name).toBe('c');
            expect(graph.getNode('c').callees).toHaveLength(0);
        });

        it('should track caller relationships', () => {
            const ast = parseProgram(`
                fn a() { c(); }
                fn b() { c(); }
                fn c() {}
            `);
            
            const graph = CallGraph.buildFromAST(ast);
            const cNode = graph.getNode('c');
            
            expect(cNode.callers).toHaveLength(2);
        });
    });
});
```

---

## 2. Recursion Detection Unit Tests

### 2.1 Self-Recursion Tests

```typescript
describe('RecursionDetector', () => {
    describe('detectSelfRecursion', () => {
        it('should detect direct self-recursion', () => {
            const graph = buildCallGraph(`
                fn factorial(n: byte): word {
                    return n * factorial(n - 1);
                }
            `);
            
            const result = RecursionDetector.detectSelfRecursion(graph);
            
            expect(result).toHaveLength(1);
            expect(result[0].function.name).toBe('factorial');
        });

        it('should return empty array for non-recursive functions', () => {
            const graph = buildCallGraph(`
                fn add(a: byte, b: byte): byte {
                    return a + b;
                }
            `);
            
            const result = RecursionDetector.detectSelfRecursion(graph);
            
            expect(result).toHaveLength(0);
        });

        it('should capture all self-call locations', () => {
            const graph = buildCallGraph(`
                fn complex(n: byte): byte {
                    if (n < 5) return complex(n + 1);
                    if (n > 10) return complex(n - 1);
                    return n;
                }
            `);
            
            const result = RecursionDetector.detectSelfRecursion(graph);
            
            expect(result[0].callSites).toHaveLength(2);
        });
    });
});
```

### 2.2 Mutual Recursion Tests (Tarjan's SCC)

```typescript
describe('RecursionDetector', () => {
    describe('findMutualRecursion', () => {
        it('should detect 2-function cycle', () => {
            const graph = buildCallGraph(`
                fn a() { b(); }
                fn b() { a(); }
            `);
            
            const result = RecursionDetector.findMutualRecursion(graph);
            
            expect(result).toHaveLength(1);
            expect(result[0].cycle).toHaveLength(2);
        });

        it('should detect 3-function cycle', () => {
            const graph = buildCallGraph(`
                fn a() { b(); }
                fn b() { c(); }
                fn c() { a(); }
            `);
            
            const result = RecursionDetector.findMutualRecursion(graph);
            
            expect(result).toHaveLength(1);
            expect(result[0].cycle).toHaveLength(3);
        });

        it('should not detect non-cyclical chains', () => {
            const graph = buildCallGraph(`
                fn a() { b(); }
                fn b() { c(); }
                fn c() {}
            `);
            
            const result = RecursionDetector.findMutualRecursion(graph);
            
            expect(result).toHaveLength(0);
        });

        it('should detect multiple independent cycles', () => {
            const graph = buildCallGraph(`
                fn a() { b(); }
                fn b() { a(); }
                fn x() { y(); }
                fn y() { x(); }
            `);
            
            const result = RecursionDetector.findMutualRecursion(graph);
            
            expect(result).toHaveLength(2);
        });
    });
});
```

---

## 3. Frame Size Calculation Unit Tests

### 3.1 Basic Frame Size Tests

```typescript
describe('FrameSizeCalculator', () => {
    describe('calculateFrameSize', () => {
        it('should calculate size for single byte local', () => {
            const fn = parseFunctionDecl(`
                fn test() {
                    let x: byte;
                }
            `);
            
            const size = FrameSizeCalculator.calculate(fn);
            
            expect(size).toBe(1);
        });

        it('should calculate size for multiple locals', () => {
            const fn = parseFunctionDecl(`
                fn test() {
                    let a: byte;
                    let b: word;
                    let c: byte;
                }
            `);
            
            const size = FrameSizeCalculator.calculate(fn);
            
            expect(size).toBe(4); // 1 + 2 + 1
        });

        it('should include parameter sizes', () => {
            const fn = parseFunctionDecl(`
                fn test(x: byte, y: word) {
                    let z: byte;
                }
            `);
            
            const size = FrameSizeCalculator.calculate(fn);
            
            expect(size).toBe(4); // params: 1+2, locals: 1
        });

        it('should handle arrays', () => {
            const fn = parseFunctionDecl(`
                fn test() {
                    let buffer: byte[32];
                }
            `);
            
            const size = FrameSizeCalculator.calculate(fn);
            
            expect(size).toBe(32);
        });

        it('should return 0 for empty functions', () => {
            const fn = parseFunctionDecl(`fn empty() {}`);
            
            const size = FrameSizeCalculator.calculate(fn);
            
            expect(size).toBe(0);
        });
    });
});
```

### 3.2 Alignment Tests

```typescript
describe('FrameSizeCalculator', () => {
    describe('alignment', () => {
        it('should align word variables to even addresses', () => {
            const slots = calculateSlotLayout(`
                fn test() {
                    let a: byte;   // offset 0
                    let b: word;   // offset 2 (aligned)
                }
            `);
            
            expect(slots[0].offset).toBe(0);
            expect(slots[1].offset).toBe(2);
        });

        it('should pack bytes without padding when possible', () => {
            const slots = calculateSlotLayout(`
                fn test() {
                    let a: byte;
                    let b: byte;
                    let c: word;
                }
            `);
            
            expect(slots[0].offset).toBe(0);
            expect(slots[1].offset).toBe(1);
            expect(slots[2].offset).toBe(2);
        });
    });
});
```

---

## 4. ZP Allocation Unit Tests

### 4.1 Hotness Score Tests

```typescript
describe('ZpAllocator', () => {
    describe('calculateHotnessScore', () => {
        it('should give highest score to pointers', () => {
            const ptrSlot = createSlot('ptr', 'pointer', 2);
            const byteSlot = createSlot('val', 'byte', 1);
            
            const ptrScore = ZpAllocator.calculateHotnessScore(ptrSlot);
            const byteScore = ZpAllocator.calculateHotnessScore(byteSlot);
            
            expect(ptrScore).toBeGreaterThan(byteScore);
        });

        it('should increase score with loop depth', () => {
            const slot0 = createSlot('a', 'byte', 1, { loopDepth: 0 });
            const slot1 = createSlot('b', 'byte', 1, { loopDepth: 1 });
            const slot2 = createSlot('c', 'byte', 1, { loopDepth: 2 });
            
            const score0 = ZpAllocator.calculateHotnessScore(slot0);
            const score1 = ZpAllocator.calculateHotnessScore(slot1);
            const score2 = ZpAllocator.calculateHotnessScore(slot2);
            
            expect(score2).toBeGreaterThan(score1);
            expect(score1).toBeGreaterThan(score0);
        });

        it('should give maximum score to @zp required', () => {
            const required = createSlot('ptr', 'byte', 1, { 
                directive: 'required' 
            });
            
            const score = ZpAllocator.calculateHotnessScore(required);
            
            expect(score).toBe(Infinity);
        });

        it('should give minimum score to @ram', () => {
            const ram = createSlot('buf', 'byte[256]', 256, { 
                directive: 'ram' 
            });
            
            const score = ZpAllocator.calculateHotnessScore(ram);
            
            expect(score).toBe(-Infinity);
        });
    });
});
```

### 4.2 ZP Allocation Tests

```typescript
describe('ZpAllocator', () => {
    describe('allocate', () => {
        it('should allocate highest priority first', () => {
            const slots = [
                createSlot('low', 'byte', 1, { loopDepth: 0 }),
                createSlot('high', 'pointer', 2, { loopDepth: 2 }),
                createSlot('mid', 'byte', 1, { loopDepth: 1 })
            ];
            
            const result = ZpAllocator.allocate(slots, mockC64Platform);
            
            // High priority should be at lowest ZP address
            expect(result.zpAllocations[0].slot.name).toBe('high');
        });

        it('should spill to RAM when ZP full', () => {
            // Create more slots than ZP can hold
            const slots = Array.from({ length: 200 }, (_, i) => 
                createSlot(`var${i}`, 'byte', 1, { directive: 'preferred' })
            );
            
            const result = ZpAllocator.allocate(slots, mockC64Platform);
            
            expect(result.zpAllocations.length).toBeLessThan(200);
            expect(result.ramAllocations.length).toBeGreaterThan(0);
        });

        it('should error when @zp required cannot fit', () => {
            const slots = [
                createSlot('huge', 'byte[500]', 500, { directive: 'required' })
            ];
            
            expect(() => ZpAllocator.allocate(slots, mockC64Platform))
                .toThrow('Zero page exhausted');
        });
    });
});
```

---

## 5. Coalescing Unit Tests

### 5.1 Overlap Detection Tests

```typescript
describe('CoalescingAnalyzer', () => {
    describe('canOverlap', () => {
        it('should return true for caller-callee pairs', () => {
            const graph = buildCallGraph(`
                fn caller() { callee(); }
                fn callee() {}
            `);
            
            const canOverlap = CoalescingAnalyzer.canOverlap(
                graph, 'caller', 'callee'
            );
            
            expect(canOverlap).toBe(true);
        });

        it('should return false for sibling functions', () => {
            const graph = buildCallGraph(`
                fn main() { a(); b(); }
                fn a() {}
                fn b() {}
            `);
            
            const canOverlap = CoalescingAnalyzer.canOverlap(
                graph, 'a', 'b'
            );
            
            expect(canOverlap).toBe(false);
        });

        it('should return true for indirect caller chain', () => {
            const graph = buildCallGraph(`
                fn a() { b(); }
                fn b() { c(); }
                fn c() {}
            `);
            
            // a is indirect caller of c
            const canOverlap = CoalescingAnalyzer.canOverlap(
                graph, 'a', 'c'
            );
            
            expect(canOverlap).toBe(true);
        });
    });
});
```

### 5.2 Group Building Tests

```typescript
describe('CoalescingAnalyzer', () => {
    describe('buildGroups', () => {
        it('should group non-overlapping siblings', () => {
            const graph = buildCallGraph(`
                fn main() { a(); b(); c(); }
                fn a() {}
                fn b() {}
                fn c() {}
            `);
            
            const groups = CoalescingAnalyzer.buildGroups(graph);
            
            // a, b, c should be in same group
            const group = groups.find(g => 
                g.functions.some(f => f.name === 'a')
            );
            expect(group.functions).toHaveLength(3);
        });

        it('should separate overlapping functions', () => {
            const graph = buildCallGraph(`
                fn main() { a(); }
                fn a() { b(); }
                fn b() {}
            `);
            
            const groups = CoalescingAnalyzer.buildGroups(graph);
            
            // Each function in separate group (all overlap)
            expect(groups).toHaveLength(3);
        });

        it('should never coalesce across thread contexts', () => {
            const graph = buildCallGraph(`
                fn main() { helper(); }
                interrupt fn irq() { helper(); }
                fn helper() {}
            `);
            
            const groups = CoalescingAnalyzer.buildGroups(graph);
            
            // main and irq should never share (different threads)
            const mainGroup = groups.find(g => 
                g.functions.some(f => f.name === 'main')
            );
            const irqGroup = groups.find(g => 
                g.functions.some(f => f.name === 'irq')
            );
            expect(mainGroup).not.toBe(irqGroup);
        });
    });
});
```

---

## 6. Thread Context Unit Tests

```typescript
describe('ThreadContextAnalyzer', () => {
    describe('determineContext', () => {
        it('should mark main as MainOnly', () => {
            const graph = buildCallGraph(`fn main() {}`);
            
            const context = ThreadContextAnalyzer.determine(graph, 'main');
            
            expect(context).toBe(ThreadContext.MainOnly);
        });

        it('should mark interrupt handlers as IsrOnly', () => {
            const graph = buildCallGraph(`
                interrupt fn irq() {}
                interrupt fn nmi() {}
            `);
            
            expect(ThreadContextAnalyzer.determine(graph, 'irq'))
                .toBe(ThreadContext.IsrOnly);
            expect(ThreadContextAnalyzer.determine(graph, 'nmi'))
                .toBe(ThreadContext.IsrOnly);
        });

        it('should propagate ISR context to callees', () => {
            const graph = buildCallGraph(`
                interrupt fn irq() { helper(); }
                fn helper() {}
            `);
            
            const context = ThreadContextAnalyzer.determine(graph, 'helper');
            
            expect(context).toBe(ThreadContext.IsrOnly);
        });

        it('should mark functions reachable from both as Both', () => {
            const graph = buildCallGraph(`
                fn main() { shared(); }
                interrupt fn irq() { shared(); }
                fn shared() {}
            `);
            
            const context = ThreadContextAnalyzer.determine(graph, 'shared');
            
            expect(context).toBe(ThreadContext.Both);
        });
    });
});
```

---

## 7. Address Assignment Unit Tests

```typescript
describe('AddressAssigner', () => {
    describe('assignAddresses', () => {
        it('should assign non-overlapping addresses', () => {
            const frames = [
                createFrame('a', 10),
                createFrame('b', 20),
                createFrame('c', 15)
            ];
            
            const result = AddressAssigner.assign(frames, mockPlatform);
            
            // Verify no overlap
            for (let i = 0; i < result.length; i++) {
                for (let j = i + 1; j < result.length; j++) {
                    const a = result[i];
                    const b = result[j];
                    if (!canCoalesce(a.frame, b.frame)) {
                        expect(rangesOverlap(a, b)).toBe(false);
                    }
                }
            }
        });

        it('should assign same address to coalesced frames', () => {
            const frames = [
                createFrame('sibling1', 10),
                createFrame('sibling2', 15)
            ];
            // Mark as coalesced
            frames[0].coalesceGroup = 1;
            frames[1].coalesceGroup = 1;
            
            const result = AddressAssigner.assign(frames, mockPlatform);
            
            expect(result[0].address).toBe(result[1].address);
        });

        it('should start ZP allocations at platform ZP start', () => {
            const frames = [createFrame('zpFunc', 5, { zp: true })];
            
            const result = AddressAssigner.assign(frames, mockC64Platform);
            
            expect(result[0].address).toBe(0x90); // C64 ZP start
        });
    });
});
```

---

## 8. Test Utilities

### Helper Functions for Testing

```typescript
// Test helpers used across all test files

function buildCallGraph(source: string): CallGraph {
    const lexer = new Lexer(source);
    const parser = new Parser(lexer.tokenize());
    const ast = parser.parse();
    return CallGraph.buildFromAST(ast);
}

function parseFunctionDecl(source: string): FunctionDecl {
    const lexer = new Lexer(source);
    const parser = new Parser(lexer.tokenize());
    const ast = parser.parse();
    return ast.declarations[0] as FunctionDecl;
}

function createSlot(
    name: string,
    type: string,
    size: number,
    options: {
        loopDepth?: number;
        accessCount?: number;
        directive?: 'required' | 'preferred' | 'auto' | 'ram';
    } = {}
): FrameSlot {
    return {
        name,
        type,
        size,
        loopDepth: options.loopDepth ?? 0,
        accessCount: options.accessCount ?? 1,
        directive: options.directive ?? 'auto'
    };
}

function createFrame(
    name: string,
    size: number,
    options: { zp?: boolean; coalesceGroup?: number } = {}
): Frame {
    return {
        function: createMockFunction(name),
        totalSize: size,
        zpPreferred: options.zp ?? false,
        coalesceGroup: options.coalesceGroup ?? -1,
        slots: []
    };
}

const mockC64Platform: PlatformConfig = {
    name: 'c64',
    zpStart: 0x90,
    zpEnd: 0xFA,
    zpAvailable: 106,
    ramStart: 0x0800,
    ramEnd: 0x9FFF,
    availableRAM: 38911
};
```

---

## 9. Test Coverage Goals

| Component | Target Coverage | Critical Paths |
|-----------|----------------|----------------|
| CallGraph | 95% | Construction, edge detection |
| RecursionDetector | 100% | All cycle detection paths |
| FrameSizeCalculator | 95% | Size calculation, alignment |
| ZpAllocator | 95% | Priority sorting, spillover |
| CoalescingAnalyzer | 100% | Overlap detection, group building |
| ThreadContextAnalyzer | 100% | Context propagation |
| AddressAssigner | 95% | Non-overlap verification |

---

**Next Document:** [07b-testing-integration.md](07b-testing-integration.md)