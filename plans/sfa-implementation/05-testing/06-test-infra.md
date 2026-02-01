# Test Infrastructure

> **Document**: 05-testing/06-test-infra.md
> **Parent**: [05-overview.md](05-overview.md)
> **Status**: Ready

## Overview

This document defines the test infrastructure code to be created before SFA implementation begins.

---

## 1. Test Helper Module

### 1.1 File Location

```
packages/compiler-v2/src/__tests__/frame/helpers/
├── index.ts           # Module exports
├── builders.ts        # AST/CallGraph builders
├── assertions.ts      # Custom assertions
├── fixtures.ts        # Fixture loaders
└── mocks.ts           # Mock objects
```

### 1.2 Builders (builders.ts)

```typescript
/**
 * Test helpers for building compiler artifacts from source
 * @module __tests__/frame/helpers/builders
 */

import { Lexer } from '../../../lexer/index.js';
import { Parser } from '../../../parser/index.js';
import { CallGraph, CallGraphBuilder } from '../../../semantic/call-graph.js';
import { SymbolTableBuilder } from '../../../semantic/visitors/symbol-table-builder.js';
import type { Program } from '../../../ast/index.js';
import type { SymbolTable } from '../../../semantic/symbol-table.js';

/**
 * Parse source code into AST
 */
export function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Build symbol table from source
 */
export function buildSymbolTable(source: string): { program: Program; symbolTable: SymbolTable } {
  const program = parseSource(source);
  const builder = new SymbolTableBuilder();
  const symbolTable = builder.build(program);
  return { program, symbolTable };
}

/**
 * Build call graph from source
 */
export function buildCallGraph(source: string): {
  program: Program;
  symbolTable: SymbolTable;
  callGraph: CallGraph;
} {
  const { program, symbolTable } = buildSymbolTable(source);
  const builder = new CallGraphBuilder(symbolTable);
  const callGraph = builder.build(program);
  return { program, symbolTable, callGraph };
}

/**
 * Create a minimal module wrapper for test code
 */
export function wrapInModule(code: string, moduleName = 'Test.Module'): string {
  return `module ${moduleName};\n\n${code}`;
}

/**
 * Create a minimal function wrapper
 */
export function wrapInFunction(code: string, funcName = 'test'): string {
  return `function ${funcName}(): void {\n  ${code}\n}`;
}
```

### 1.3 Assertions (assertions.ts)

```typescript
/**
 * Custom test assertions for SFA testing
 * @module __tests__/frame/helpers/assertions
 */

import { expect } from 'vitest';
import type { FrameAllocationResult, Frame, FrameSlot } from '../../../frame/index.js';
import { SlotLocation } from '../../../frame/enums.js';

/**
 * Assert that a function has a frame at the specified address
 */
export function expectFrameAt(
  result: FrameAllocationResult,
  funcName: string,
  expectedAddress: number
): void {
  const frame = result.frameMap.get(funcName);
  expect(frame, `Frame for '${funcName}' should exist`).toBeDefined();
  expect(frame!.baseAddress, `Frame for '${funcName}' should be at $${expectedAddress.toString(16)}`).toBe(expectedAddress);
}

/**
 * Assert that a slot is allocated to Zero Page
 */
export function expectSlotInZP(frame: Frame, slotName: string): void {
  const slot = frame.slots.find(s => s.name === slotName);
  expect(slot, `Slot '${slotName}' should exist`).toBeDefined();
  expect(slot!.location, `Slot '${slotName}' should be in Zero Page`).toBe(SlotLocation.ZeroPage);
}

/**
 * Assert that a slot is allocated to RAM (not ZP)
 */
export function expectSlotInRAM(frame: Frame, slotName: string): void {
  const slot = frame.slots.find(s => s.name === slotName);
  expect(slot, `Slot '${slotName}' should exist`).toBeDefined();
  expect(slot!.location, `Slot '${slotName}' should be in RAM`).toBe(SlotLocation.FrameRegion);
}

/**
 * Assert that two functions are coalesced (share memory)
 */
export function expectCoalesced(
  result: FrameAllocationResult,
  func1: string,
  func2: string
): void {
  const frame1 = result.frameMap.get(func1);
  const frame2 = result.frameMap.get(func2);
  expect(frame1, `Frame for '${func1}' should exist`).toBeDefined();
  expect(frame2, `Frame for '${func2}' should exist`).toBeDefined();
  expect(frame1!.coalesceGroup, `'${func1}' and '${func2}' should be in the same coalesce group`).toBe(frame2!.coalesceGroup);
}

/**
 * Assert that two functions are NOT coalesced
 */
export function expectNotCoalesced(
  result: FrameAllocationResult,
  func1: string,
  func2: string
): void {
  const frame1 = result.frameMap.get(func1);
  const frame2 = result.frameMap.get(func2);
  expect(frame1, `Frame for '${func1}' should exist`).toBeDefined();
  expect(frame2, `Frame for '${func2}' should exist`).toBeDefined();
  expect(frame1!.coalesceGroup, `'${func1}' and '${func2}' should NOT be in the same coalesce group`).not.toBe(frame2!.coalesceGroup);
}

/**
 * Assert that allocation succeeded without errors
 */
export function expectNoErrors(result: FrameAllocationResult): void {
  const errors = result.diagnostics.filter(d => d.severity === 'error');
  expect(errors, 'Allocation should have no errors').toHaveLength(0);
}

/**
 * Assert that allocation produced a specific error
 */
export function expectError(
  result: FrameAllocationResult,
  errorCode: string
): void {
  const errors = result.diagnostics.filter(d => d.severity === 'error');
  const hasError = errors.some(e => e.code === errorCode);
  expect(hasError, `Should have error with code '${errorCode}'`).toBe(true);
}

/**
 * Assert memory savings from coalescing
 */
export function expectCoalescingSavings(
  result: FrameAllocationResult,
  minSavings: number
): void {
  expect(
    result.stats.coalescingSavingsPercent,
    `Coalescing should save at least ${minSavings * 100}%`
  ).toBeGreaterThanOrEqual(minSavings);
}

/**
 * Assert ZP usage
 */
export function expectZPUsage(
  result: FrameAllocationResult,
  minBytes: number,
  maxBytes: number
): void {
  expect(result.stats.zpBytesUsed, 'ZP usage should be within range')
    .toBeGreaterThanOrEqual(minBytes);
  expect(result.stats.zpBytesUsed, 'ZP usage should be within range')
    .toBeLessThanOrEqual(maxBytes);
}
```

### 1.4 Fixtures (fixtures.ts)

```typescript
/**
 * Test fixture loading utilities
 * @module __tests__/frame/helpers/fixtures
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES_ROOT = join(__dirname, '../../../../fixtures/sfa');

/**
 * Load a fixture file by category and name
 */
export function loadFixture(category: string, name: string): string {
  const path = join(FIXTURES_ROOT, category, `${name}.blend`);
  return readFileSync(path, 'utf-8');
}

/**
 * Load all fixtures from a category
 */
export function loadFixtureCategory(category: string): Map<string, string> {
  // Implementation: read all .blend files from category directory
  const fixtures = new Map<string, string>();
  // ... implementation
  return fixtures;
}

/**
 * Common test programs as inline strings (for quick tests)
 */
export const INLINE_FIXTURES = {
  // Single function with no locals
  emptyFunction: `
    module Test;
    function main(): void {}
  `,

  // Single function with locals
  simpleLocals: `
    module Test;
    function main(): void {
      let x: byte = 0;
      let y: byte = 0;
    }
  `,

  // Two non-overlapping functions
  nonOverlapping: `
    module Test;
    function main(): void {
      funcA();
      funcB();
    }
    function funcA(): void {
      let a: byte = 0;
    }
    function funcB(): void {
      let b: byte = 0;
    }
  `,

  // Nested calls
  nestedCalls: `
    module Test;
    function main(): void {
      outer();
    }
    function outer(): void {
      inner();
    }
    function inner(): void {
      let x: byte = 0;
    }
  `,

  // Direct recursion (should error)
  directRecursion: `
    module Test;
    function factorial(n: byte): byte {
      if n <= 1 { return 1; }
      return n * factorial(n - 1);
    }
  `,

  // Indirect recursion (should error)
  indirectRecursion: `
    module Test;
    function funcA(): void {
      funcB();
    }
    function funcB(): void {
      funcA();
    }
  `,

  // ZP required
  zpRequired: `
    module Test;
    @zp let counter: byte = 0;
    function main(): void {
      counter += 1;
    }
  `,

  // Callback isolation
  callbackIsolation: `
    module Test;
    function main(): void {
      let mainLocal: byte = 0;
    }
    callback irq(): void {
      let irqLocal: byte = 0;
    }
  `,
};
```

### 1.5 Mocks (mocks.ts)

```typescript
/**
 * Mock objects for isolated testing
 * @module __tests__/frame/helpers/mocks
 */

import type { PlatformConfig } from '../../../frame/platform.js';

/**
 * Mock C64 platform configuration for testing
 */
export const MOCK_C64_CONFIG: PlatformConfig = {
  name: 'c64-test',
  zeroPage: {
    start: 0x02,
    end: 0x8f,
    reserved: [0x00, 0x01],
    scratchStart: 0xfb,
    scratchEnd: 0xfe,
  },
  frameRegion: {
    start: 0x0200,
    end: 0x0400,
  },
  generalRam: {
    start: 0x0800,
    end: 0xcfff,
  },
};

/**
 * Mock platform config with very limited ZP (for overflow testing)
 */
export const MOCK_LIMITED_ZP_CONFIG: PlatformConfig = {
  name: 'limited-zp-test',
  zeroPage: {
    start: 0x02,
    end: 0x10,  // Only 14 bytes!
    reserved: [],
    scratchStart: 0x0e,
    scratchEnd: 0x10,
  },
  frameRegion: {
    start: 0x0200,
    end: 0x0400,
  },
  generalRam: {
    start: 0x0800,
    end: 0xcfff,
  },
};

/**
 * Mock platform config with very limited frame region
 */
export const MOCK_LIMITED_FRAME_CONFIG: PlatformConfig = {
  name: 'limited-frame-test',
  zeroPage: {
    start: 0x02,
    end: 0x8f,
    reserved: [],
    scratchStart: 0xfb,
    scratchEnd: 0xfe,
  },
  frameRegion: {
    start: 0x0200,
    end: 0x0220,  // Only 32 bytes!
  },
  generalRam: {
    start: 0x0800,
    end: 0xcfff,
  },
};
```

---

## 2. Test Setup

### 2.1 Vitest Setup

Add to `vitest.config.ts` or create `vitest.setup.ts`:

```typescript
// Custom matchers for SFA testing
expect.extend({
  toHaveFrame(result: FrameAllocationResult, funcName: string) {
    const frame = result.frameMap.get(funcName);
    return {
      pass: frame !== undefined,
      message: () => `Expected frame map to ${this.isNot ? 'not ' : ''}have frame for '${funcName}'`,
    };
  },

  toHaveErrorCode(result: FrameAllocationResult, code: string) {
    const hasError = result.diagnostics.some(d => d.code === code);
    return {
      pass: hasError,
      message: () => `Expected diagnostics to ${this.isNot ? 'not ' : ''}contain error '${code}'`,
    };
  },
});
```

### 2.2 Type Declarations

```typescript
// types/vitest.d.ts
declare module 'vitest' {
  interface Assertion<T> {
    toHaveFrame(funcName: string): T;
    toHaveErrorCode(code: string): T;
  }
}
```

---

## 3. Implementation Order

### 3.1 Create Test Infrastructure First

| Order | Task | Session |
|-------|------|---------|
| 1 | Create `helpers/` directory structure | 0.1 |
| 2 | Implement `builders.ts` | 0.1 |
| 3 | Implement `fixtures.ts` | 0.1 |
| 4 | Create inline fixture constants | 0.2 |
| 5 | Implement `assertions.ts` (basic) | 0.2 |
| 6 | Implement `mocks.ts` | 0.2 |
| 7 | Add custom vitest matchers | 0.3 |

### 3.2 Before Each Phase

Before implementing any SFA component:
1. ✅ Ensure test helpers exist
2. ✅ Create test file skeleton
3. ✅ Add placeholder tests with expected behavior
4. ✅ Implement component
5. ✅ Enable and verify tests

---

## 4. Usage Examples

### 4.1 Unit Test Example

```typescript
// frame-calculator.test.ts
import { describe, it, expect } from 'vitest';
import { buildCallGraph } from './helpers/index.js';
import { FrameCalculator } from '../../frame/allocator/frame-calculator.js';
import { INLINE_FIXTURES } from './helpers/fixtures.js';

describe('FrameCalculator', () => {
  describe('calculateFrameSize', () => {
    it('should calculate size for function with two byte locals', () => {
      const { callGraph, symbolTable } = buildCallGraph(INLINE_FIXTURES.simpleLocals);
      const calculator = new FrameCalculator(symbolTable);
      
      const frame = calculator.calculateFrame('main', callGraph.getFunction('main')!);
      
      expect(frame.totalSize).toBe(2); // Two bytes
    });
  });
});
```

### 4.2 Integration Test Example

```typescript
// basic-allocation.test.ts
import { describe, it, expect } from 'vitest';
import { buildCallGraph } from '../helpers/index.js';
import { FrameAllocator } from '../../../frame/allocator/frame-allocator.js';
import { MOCK_C64_CONFIG } from '../helpers/mocks.js';
import { expectFrameAt, expectNoErrors } from '../helpers/assertions.js';
import { INLINE_FIXTURES } from '../helpers/fixtures.js';

describe('Basic Frame Allocation', () => {
  it('should allocate frames for simple program', () => {
    const { callGraph, symbolTable, program } = buildCallGraph(INLINE_FIXTURES.simpleLocals);
    const allocator = new FrameAllocator(MOCK_C64_CONFIG);
    
    const result = allocator.allocate(program, callGraph, symbolTable);
    
    expectNoErrors(result);
    expectFrameAt(result, 'main', 0x0200);
  });
});
```

### 4.3 E2E Test Example

```typescript
// simple-programs.test.ts
import { describe, it, expect } from 'vitest';
import { loadFixture } from '../helpers/fixtures.js';
import { compileWithSFA } from '../helpers/builders.js';
import { expectNoErrors, expectFrameAt } from '../helpers/assertions.js';

describe('E2E: Simple Programs', () => {
  it('should compile single-function program', () => {
    const source = loadFixture('01-basic', 'single-function');
    const result = compileWithSFA(source);
    
    expectNoErrors(result);
    expectFrameAt(result, 'main', 0x0200);
  });
});
```

---

**Next Document**: [07-fixtures.md](07-fixtures.md)