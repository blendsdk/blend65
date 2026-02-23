# Phase 4: E2E Test Rig

> **Document**: 07-test-rig.md
> **Parent**: [Index](00-index.md)
> **Phase**: 4
> **Sessions**: 1-2
> **Dependencies**: Phase 2 (VICE Integration)

---

## Overview

End-to-end testing framework that compiles Blend65 code and verifies execution in VICE.

---

## Test Helper API

```typescript
// test-utils/vice-test-runner.ts

export interface ViceTestOptions {
  /** Maximum execution time in ms */
  timeout?: number;
  /** Memory assertions to verify */
  memoryChecks?: MemoryAssertion[];
  /** Wait for specific address to be written */
  breakpoint?: number;
}

export interface MemoryAssertion {
  address: number;
  expected: number | number[];
  description?: string;
}

export interface ViceTestResult {
  success: boolean;
  memoryState: Map<number, number>;
  cyclesExecuted: number;
  error?: string;
}

/**
 * Compile and run Blend65 code in VICE, verify results
 */
export async function runViceTest(
  source: string,
  options?: ViceTestOptions
): Promise<ViceTestResult> {
  // 1. Compile source
  const compiler = new Compiler();
  const result = compiler.compileSource(source, defaultConfig);
  
  if (!result.success) {
    return { 
      success: false, 
      error: 'Compilation failed', 
      memoryState: new Map(), 
      cyclesExecuted: 0 
    };
  }
  
  // 2. Write PRG to temp file
  const prgPath = writeTempPrg(result.output!.binary!);
  
  // 3. Run in VICE with monitoring
  const viceResult = await runInVice(prgPath, options);
  
  // 4. Verify memory assertions
  if (options?.memoryChecks) {
    for (const check of options.memoryChecks) {
      const actual = viceResult.memoryState.get(check.address);
      if (actual !== check.expected) {
        return {
          ...viceResult,
          success: false,
          error: `Memory at $${check.address.toString(16)}: expected ${check.expected}, got ${actual}`,
        };
      }
    }
  }
  
  return viceResult;
}
```

---

## Test Examples

### Basic Memory Test

```typescript
describe('Memory operations', () => {
  it('should store value in zero-page', async () => {
    const result = await runViceTest(`
      module Test
      @zp let counter: byte = 0;
      function main(): void {
        counter = 42;
      }
    `, {
      memoryChecks: [
        { address: 0x02, expected: 42, description: 'counter should be 42' },
      ],
    });
    
    expect(result.success).toBe(true);
  });
});
```

### Hardware Register Test

```typescript
describe('Hardware access', () => {
  it('should set border color', async () => {
    const result = await runViceTest(`
      module Test
      @map borderColor at $D020: byte;
      function main(): void {
        borderColor = 1;  // White
      }
    `, {
      memoryChecks: [
        { address: 0xD020, expected: 1 },
      ],
    });
    
    expect(result.success).toBe(true);
  });
});
```

### Loop Test

```typescript
describe('Control flow', () => {
  it('should execute loop correctly', async () => {
    const result = await runViceTest(`
      module Test
      @zp let counter: byte = 0;
      function main(): void {
        for (let i: byte = 0; i < 10; i = i + 1) {
          counter = counter + 1;
        }
      }
    `, {
      memoryChecks: [
        { address: 0x02, expected: 10, description: 'counter should be 10 after loop' },
      ],
    });
    
    expect(result.success).toBe(true);
  });
});
```

---

## VICE Remote Monitor Protocol (Advanced)

For advanced testing, use VICE's binary remote monitor protocol:

```typescript
// Connect to VICE monitor (requires -binarymonitor flag)
const monitor = new ViceMonitor('localhost', 6502);

// Read memory
const value = await monitor.readMemory(0xD020, 1);

// Write memory
await monitor.writeMemory(0xD020, [0x01]);

// Set breakpoint
await monitor.setBreakpoint(0x0810);

// Continue execution
await monitor.continue();
```

**Note**: Binary monitor protocol is an advanced feature for future implementation.

---

## CI Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install VICE
        run: |
          sudo apt-get update
          sudo apt-get install -y vice
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: yarn install
      
      - name: Run E2E tests
        run: yarn test:e2e
        env:
          VICE_HEADLESS: '1'
```

### Headless VICE

VICE can run headless for CI:

```bash
x64sc -console -headless -autostart program.prg
```

---

## Task Breakdown

### Task 4.1: ViceTestRunner Class
**File**: `packages/compiler/src/__tests__/test-utils/vice-test-runner.ts`

- Compile and run in VICE
- Memory state extraction
- Timeout handling

**Acceptance Criteria:**
- [ ] Compiles source code
- [ ] Runs in VICE emulator
- [ ] Returns execution results
- [ ] Handles timeouts

---

### Task 4.2: Memory Assertions
**File**: Extend ViceTestRunner

- Verify memory values
- Clear error messages
- Multiple assertions per test

**Acceptance Criteria:**
- [ ] Single memory assertions work
- [ ] Array memory assertions work
- [ ] Clear error messages on failure
- [ ] Descriptions in assertions

---

### Task 4.3: Test Utilities
**File**: `packages/compiler/src/__tests__/test-utils/`

- Helper functions
- Temp file management
- Result formatting

**Acceptance Criteria:**
- [ ] Temp files created/cleaned
- [ ] Results clearly formatted
- [ ] Utilities are reusable

---

### Task 4.4: Example Tests
**File**: `packages/compiler/src/__tests__/e2e/vice-e2e.test.ts`

- Border color test
- Variable storage test
- Function call test
- Loop execution test

**Acceptance Criteria:**
- [ ] Example tests demonstrate usage
- [ ] Tests are documented
- [ ] Tests can be skipped if VICE unavailable

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 4.1 | ViceTestRunner Class | [ ] |
| 4.2 | Memory Assertions | [ ] |
| 4.3 | Test Utilities | [ ] |
| 4.4 | Example Tests | [ ] |

---

**This document defines the E2E test rig for Blend65.**