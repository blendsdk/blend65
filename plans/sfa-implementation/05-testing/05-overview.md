# Testing Strategy Overview

> **Document**: 05-testing/05-overview.md
> **Parent**: [../00-index.md](../00-index.md)
> **Status**: Ready

## Overview

This document defines the test-first strategy for SFA implementation. Testing infrastructure and fixtures are created **before** implementation to enable true test-driven development.

---

## 1. Testing Philosophy

### 1.1 Test-First Approach

```
1. Define test fixtures (Blend programs) → FIRST
2. Define expected allocations → SECOND
3. Implement feature → THIRD
4. Verify tests pass → FOURTH
```

### 1.2 Testing Pyramid for SFA

```
                    ┌─────────────┐
                    │    E2E      │  ← Full compilation tests
                    │   Tests     │     (5-10 tests)
                    ├─────────────┤
                    │ Integration │  ← Component interaction tests
                    │   Tests     │     (20-30 tests)
                    ├─────────────┤
                    │   Unit      │  ← Individual function tests
                    │   Tests     │     (100+ tests)
                    └─────────────┘
```

### 1.3 Key Principles

| Principle | Description |
|-----------|-------------|
| **Predictable** | Every test has deterministic, known-in-advance results |
| **Isolated** | Tests don't depend on each other |
| **Fast** | Unit tests run in milliseconds |
| **Comprehensive** | Cover all allocation scenarios |
| **Real-world** | Test fixtures resemble actual C64 programs |

---

## 2. Test Categories

### 2.1 Unit Tests

Test individual functions and classes in isolation:

| Component | Test Focus | Count |
|-----------|------------|-------|
| Enums | Enum values and guards | 10-15 |
| FrameSlot | Slot creation and properties | 15-20 |
| Frame | Frame building and queries | 15-20 |
| FrameMap | Map operations | 10-15 |
| PlatformConfig | Config validation | 10-15 |
| ZPPool | Pool allocation/deallocation | 15-20 |
| FrameCalculator | Size calculations | 20-30 |
| ZPAllocator | ZP scoring and allocation | 20-30 |
| Coalescer | Group building | 20-30 |

### 2.2 Integration Tests

Test component interactions:

| Test Suite | Components | Count |
|------------|------------|-------|
| Basic Allocation | CallGraph + FrameAllocator | 10-15 |
| Coalescing | CallGraph + Coalescer + FrameAllocator | 10-15 |
| ZP Scoring | AccessAnalysis + ZPAllocator | 10-15 |
| Thread Safety | CallGraph + Coalescer (callback) | 5-10 |
| Error Cases | All components | 10-15 |

### 2.3 End-to-End Tests

Test full compilation pipeline:

| Scenario | Description | Expected |
|----------|-------------|----------|
| Simple function | Single function with locals | Correct frame address |
| Game loop | main → update → draw | Coalescing applied |
| Sprite handler | Multiple similar functions | Memory sharing |
| ISR timer | Callback + main thread | Thread isolation |
| ZP pressure | Many @zp variables | Correct priority |
| Memory stress | Large program | No overflow |

---

## 3. Test File Organization

### 3.1 Directory Structure

```
packages/compiler-v2/src/__tests__/
├── frame/                        # SFA unit tests
│   ├── enums.test.ts
│   ├── frame-slot.test.ts
│   ├── frame.test.ts
│   ├── frame-map.test.ts
│   ├── platform-config.test.ts
│   ├── zp-pool.test.ts
│   ├── frame-calculator.test.ts
│   ├── zp-allocator.test.ts
│   ├── coalescer.test.ts
│   └── frame-allocator.test.ts
│
├── frame/integration/            # Integration tests
│   ├── basic-allocation.test.ts
│   ├── coalescing.test.ts
│   ├── zp-scoring.test.ts
│   ├── thread-safety.test.ts
│   └── error-cases.test.ts
│
└── frame/e2e/                    # End-to-end tests
    ├── simple-programs.test.ts
    ├── game-patterns.test.ts
    ├── memory-limits.test.ts
    └── real-world.test.ts
```

### 3.2 Test Fixture Directory

```
packages/compiler-v2/fixtures/
└── sfa/                          # SFA test programs
    ├── 01-basic/
    │   ├── single-function.blend
    │   ├── two-functions.blend
    │   └── nested-calls.blend
    │
    ├── 02-coalescing/
    │   ├── non-overlapping.blend
    │   ├── overlapping.blend
    │   └── deep-calls.blend
    │
    ├── 03-zp/
    │   ├── zp-required.blend
    │   ├── zp-scoring.blend
    │   └── zp-overflow.blend
    │
    ├── 04-threads/
    │   ├── callback-isolation.blend
    │   ├── shared-function.blend
    │   └── multi-callback.blend
    │
    └── 05-stress/
        ├── many-functions.blend
        ├── large-frames.blend
        └── deep-nesting.blend
```

---

## 4. Test Infrastructure

### 4.1 Test Helpers

Create helper functions for common test operations:

```typescript
// Test helper: Parse and build call graph
function buildCallGraph(source: string): CallGraph {
  const lexer = new Lexer(source);
  const parser = new Parser(lexer.tokenize());
  const program = parser.parse();
  const symbolTable = new SymbolTableBuilder().build(program);
  return new CallGraphBuilder(symbolTable).build(program);
}

// Test helper: Run frame allocation
function allocateFrames(source: string): FrameAllocationResult {
  const callGraph = buildCallGraph(source);
  const allocator = new FrameAllocator(C64_CONFIG);
  return allocator.allocate(callGraph);
}

// Test helper: Assert frame address
function expectFrameAt(result: FrameAllocationResult, funcName: string, address: number): void {
  const frame = result.frameMap.get(funcName);
  expect(frame).toBeDefined();
  expect(frame!.baseAddress).toBe(address);
}

// Test helper: Assert ZP allocation
function expectInZeroPage(result: FrameAllocationResult, slotName: string): void {
  // ... implementation
}

// Test helper: Assert coalescing
function expectCoalesced(result: FrameAllocationResult, func1: string, func2: string): void {
  const frame1 = result.frameMap.get(func1);
  const frame2 = result.frameMap.get(func2);
  expect(frame1?.coalesceGroup).toBe(frame2?.coalesceGroup);
}
```

### 4.2 Test Assertions

Custom assertions for SFA testing:

```typescript
// Assert no recursion error
expect(result.diagnostics).not.toContainError('RECURSION');

// Assert ZP overflow error
expect(result.diagnostics).toContainError('ZP_OVERFLOW');

// Assert frame region overflow
expect(result.diagnostics).toContainError('FRAME_OVERFLOW');

// Assert memory savings
expect(result.stats.coalescingSavings).toBeGreaterThan(0.3);
```

---

## 5. Test Execution Strategy

### 5.1 Running Tests

```bash
# Run all SFA tests
./compiler-test frame

# Run specific category
./compiler-test frame/integration

# Run single test file
./compiler-test frame/coalescer
```

### 5.2 Test During Development

Each implementation session should:

1. **Start**: Verify existing tests pass
2. **Implement**: Write code with tests
3. **End**: Verify all tests pass

### 5.3 CI Integration

All SFA tests must pass before merge:
- Unit tests: Required
- Integration tests: Required
- E2E tests: Required

---

## 6. Coverage Requirements

### 6.1 Coverage Targets

| Component | Target |
|-----------|--------|
| Frame types | 100% |
| Frame allocator | >95% |
| Coalescer | >95% |
| ZP allocator | >95% |
| Integration points | >90% |

### 6.2 Coverage Gaps Allowed

- Error message formatting (visual only)
- Debug logging
- Edge cases with complex platform configs

---

## 7. Documents in This Section

| # | Document | Description |
|---|----------|-------------|
| 05 | [05-overview.md](05-overview.md) | This document |
| 06 | [06-test-infra.md](06-test-infra.md) | Test infrastructure code |
| 07 | [07-fixtures.md](07-fixtures.md) | Test fixture programs |
| 08 | [08-e2e-scenarios.md](08-e2e-scenarios.md) | E2E test scenarios |

---

**Next Document**: [06-test-infra.md](06-test-infra.md)