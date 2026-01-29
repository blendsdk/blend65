# Test Infrastructure: Phase 0

> **Document**: 03-test-infrastructure.md
> **Parent**: [Index](00-index.md)
> **Phase**: 0 (FIRST - Before any fixes)
> **REQs**: REQ-10 (Testing Infrastructure)

## Overview

**Build the test infrastructure BEFORE making any fixes.** This ensures we can verify that fixes actually work and prevent regressions.

**Why Phase 0?**
- Without test infrastructure, we can't verify fixes are correct
- Current tests only verify "compilation succeeded"
- We need tests that verify "generated code is semantically correct"

---

## Component 1: ASM Sequence Validator

### Purpose

Verify that specific instruction sequences appear in generated assembly.

### Location

```
packages/compiler/src/__tests__/e2e/helpers/
├── asm-validator.ts
└── asm-validator.test.ts
```

### API Design

```typescript
// asm-validator.ts

/**
 * Validates ASM output contains expected instruction sequences.
 */
export interface AsmSequence {
  /** Instructions to match in order */
  instructions: AsmPattern[];
  /** Allow other instructions between matches */
  allowGaps?: boolean;
}

export interface AsmPattern {
  /** Mnemonic (e.g., 'LDA', 'STA') */
  mnemonic: string;
  /** Operand pattern (regex or exact match) */
  operand?: string | RegExp;
  /** Comment must contain this text */
  comment?: string;
}

/**
 * Validates that ASM contains the given instruction sequence.
 * 
 * @param asm - Assembly text to validate
 * @param sequence - Sequence to find
 * @returns true if sequence found
 */
export function expectAsmSequence(asm: string, sequence: AsmSequence): void;

/**
 * Validates that ASM contains no STUB comments.
 * 
 * @param asm - Assembly text to validate
 */
export function expectNoStubs(asm: string): void;

/**
 * Validates that ASM contains no warning comments.
 * 
 * @param asm - Assembly text to validate
 */
export function expectNoWarnings(asm: string): void;

/**
 * Extracts the value tracking for a given IL value from ASM comments.
 * 
 * @param asm - Assembly text
 * @param valueId - IL value ID (e.g., 'v1', 'v3')
 * @returns Tracked location or undefined
 */
export function extractValueLocation(asm: string, valueId: string): string | undefined;
```

### Implementation

```typescript
// asm-validator.ts

import { expect } from 'vitest';

export function expectAsmSequence(asm: string, sequence: AsmSequence): void {
  const lines = asm.split('\n');
  let seqIndex = 0;
  
  for (const line of lines) {
    if (seqIndex >= sequence.instructions.length) break;
    
    const pattern = sequence.instructions[seqIndex];
    if (matchesPattern(line, pattern)) {
      seqIndex++;
    } else if (!sequence.allowGaps) {
      // Strict mode: sequence must be contiguous
      seqIndex = 0;
    }
  }
  
  expect(seqIndex).toBe(sequence.instructions.length, 
    `Expected sequence not found in ASM:\n${JSON.stringify(sequence)}`);
}

function matchesPattern(line: string, pattern: AsmPattern): boolean {
  const trimmed = line.trim();
  
  // Skip comments and empty lines
  if (!trimmed || trimmed.startsWith(';')) return false;
  
  // Parse instruction: MNEMONIC OPERAND ; comment
  const match = trimmed.match(/^(\w+)\s*([^;]*)?(?:;\s*(.*))?$/);
  if (!match) return false;
  
  const [, mnemonic, operand, comment] = match;
  
  // Check mnemonic
  if (mnemonic.toUpperCase() !== pattern.mnemonic.toUpperCase()) {
    return false;
  }
  
  // Check operand if specified
  if (pattern.operand) {
    const trimmedOperand = operand?.trim() ?? '';
    if (pattern.operand instanceof RegExp) {
      if (!pattern.operand.test(trimmedOperand)) return false;
    } else {
      if (trimmedOperand !== pattern.operand) return false;
    }
  }
  
  // Check comment if specified
  if (pattern.comment) {
    if (!comment?.includes(pattern.comment)) return false;
  }
  
  return true;
}

export function expectNoStubs(asm: string): void {
  const stubLines = asm.split('\n')
    .filter(line => line.includes('STUB:'))
    .map(line => line.trim());
  
  expect(stubLines).toHaveLength(0, 
    `Found ${stubLines.length} STUB comments:\n${stubLines.join('\n')}`);
}

export function expectNoWarnings(asm: string): void {
  const warningLines = asm.split('\n')
    .filter(line => line.includes('WARNING:'))
    .map(line => line.trim());
  
  expect(warningLines).toHaveLength(0,
    `Found ${warningLines.length} WARNING comments:\n${warningLines.join('\n')}`);
}
```

### Test Cases

```typescript
// asm-validator.test.ts

describe('ASM Validator', () => {
  describe('expectAsmSequence', () => {
    it('should find simple sequence', () => {
      const asm = `
        LDA #$05
        STA $50
      `;
      expectAsmSequence(asm, {
        instructions: [
          { mnemonic: 'LDA', operand: '#$05' },
          { mnemonic: 'STA', operand: '$50' }
        ]
      });
    });
    
    it('should find sequence with gaps', () => {
      const asm = `
        LDA #$05
        NOP
        STA $50
      `;
      expectAsmSequence(asm, {
        instructions: [
          { mnemonic: 'LDA', operand: '#$05' },
          { mnemonic: 'STA', operand: '$50' }
        ],
        allowGaps: true
      });
    });
    
    it('should match operand with regex', () => {
      const asm = `LDA #$10`;
      expectAsmSequence(asm, {
        instructions: [
          { mnemonic: 'LDA', operand: /^#\$[0-9A-F]{2}$/ }
        ]
      });
    });
  });
  
  describe('expectNoStubs', () => {
    it('should pass when no stubs', () => {
      const asm = `LDA #$05\nSTA $50`;
      expectNoStubs(asm);
    });
    
    it('should fail when stub found', () => {
      const asm = `LDA #$00 ; STUB: Cannot load v1`;
      expect(() => expectNoStubs(asm)).toThrow();
    });
  });
});
```

---

## Component 2: Golden Output Test Framework

### Purpose

Compare generated ASM against known-good "golden" output to detect regressions.

### Location

```
packages/compiler/src/__tests__/e2e/helpers/
├── golden-tests.ts
└── golden-tests.test.ts

packages/compiler/fixtures/06-codegen/golden/
├── simple-add.asm
├── if-else.asm
├── while-loop.asm
└── ... (more golden files)
```

### API Design

```typescript
// golden-tests.ts

/**
 * Compares generated ASM against golden output.
 * 
 * @param testName - Name of the test (matches fixture filename)
 * @param asm - Generated assembly
 * @param options - Comparison options
 */
export function compareGoldenOutput(
  testName: string, 
  asm: string,
  options?: GoldenOptions
): void;

export interface GoldenOptions {
  /** Update golden file if different (for regeneration) */
  update?: boolean;
  /** Ignore whitespace differences */
  ignoreWhitespace?: boolean;
  /** Ignore comment differences */
  ignoreComments?: boolean;
  /** Custom fixture directory */
  fixtureDir?: string;
}

/**
 * Gets the path to a golden fixture file.
 */
export function getGoldenPath(testName: string): string;

/**
 * Saves a new golden output file.
 */
export function saveGolden(testName: string, asm: string): void;
```

### Implementation

```typescript
// golden-tests.ts

import { expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const GOLDEN_DIR = path.join(__dirname, '../../../fixtures/06-codegen/golden');

export function compareGoldenOutput(
  testName: string,
  asm: string,
  options: GoldenOptions = {}
): void {
  const goldenPath = getGoldenPath(testName);
  
  // Normalize the ASM output
  let normalizedAsm = asm;
  if (options.ignoreWhitespace) {
    normalizedAsm = normalizeWhitespace(asm);
  }
  if (options.ignoreComments) {
    normalizedAsm = removeComments(asm);
  }
  
  // Check if golden exists
  if (!fs.existsSync(goldenPath)) {
    if (options.update || process.env.UPDATE_GOLDEN) {
      saveGolden(testName, normalizedAsm);
      console.log(`Created golden output: ${goldenPath}`);
      return;
    }
    throw new Error(`Golden output not found: ${goldenPath}\nRun with UPDATE_GOLDEN=1 to create.`);
  }
  
  // Read and compare
  const golden = fs.readFileSync(goldenPath, 'utf-8');
  let normalizedGolden = golden;
  if (options.ignoreWhitespace) {
    normalizedGolden = normalizeWhitespace(golden);
  }
  if (options.ignoreComments) {
    normalizedGolden = removeComments(golden);
  }
  
  if (normalizedAsm !== normalizedGolden) {
    if (options.update || process.env.UPDATE_GOLDEN) {
      saveGolden(testName, normalizedAsm);
      console.log(`Updated golden output: ${goldenPath}`);
      return;
    }
    
    // Show diff
    expect(normalizedAsm).toBe(normalizedGolden);
  }
}

export function getGoldenPath(testName: string): string {
  const safeName = testName.replace(/[^a-zA-Z0-9-_]/g, '-');
  return path.join(GOLDEN_DIR, `${safeName}.asm`);
}

export function saveGolden(testName: string, asm: string): void {
  const goldenPath = getGoldenPath(testName);
  fs.mkdirSync(path.dirname(goldenPath), { recursive: true });
  fs.writeFileSync(goldenPath, asm, 'utf-8');
}

function normalizeWhitespace(text: string): string {
  return text.split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.length > 0)
    .join('\n');
}

function removeComments(text: string): string {
  return text.split('\n')
    .map(line => line.replace(/;.*$/, '').trimEnd())
    .filter(line => line.length > 0)
    .join('\n');
}
```

### Initial Golden Fixtures

Create these minimal golden outputs:

```asm
; fixtures/06-codegen/golden/simple-add.asm
; Source: let result = 5 + 3;
        LDA #$05
        CLC
        ADC #$03
        STA $50
```

```asm
; fixtures/06-codegen/golden/simple-store.asm
; Source: let x: byte = 10;
        LDA #$0A
        STA $50
```

---

## Component 3: Value Flow Analysis

### Purpose

Track how IL values flow through generated code to verify correctness.

### Location

```
packages/compiler/src/__tests__/e2e/helpers/
├── value-tracking.ts
└── value-tracking.test.ts
```

### API Design

```typescript
// value-tracking.ts

/**
 * Represents where a value ended up in generated code.
 */
export interface ValueFlowEntry {
  /** IL value ID */
  ilValueId: string;
  /** Where it was stored */
  location: 'A' | 'X' | 'Y' | 'zp' | 'abs' | 'unknown';
  /** Address if ZP or absolute */
  address?: number;
  /** The instruction that stored it */
  instruction: string;
  /** Line number in ASM */
  line: number;
}

/**
 * Analyzes ASM to extract value flow information from comments.
 * 
 * Looks for patterns like:
 * - "v1 = 5"
 * - "Load v1"
 * - "Store v1"
 * 
 * @param asm - Assembly text with comments
 * @returns Map of value IDs to their flow entries
 */
export function analyzeValueFlow(asm: string): Map<string, ValueFlowEntry[]>;

/**
 * Verifies that a value was stored to a specific location.
 * 
 * @param flow - Value flow map
 * @param valueId - Value to check
 * @param location - Expected location
 */
export function expectValueStored(
  flow: Map<string, ValueFlowEntry[]>,
  valueId: string,
  location: 'A' | 'X' | 'Y' | 'zp' | 'abs'
): void;

/**
 * Verifies that a value was loaded before being used.
 * 
 * @param flow - Value flow map
 * @param valueId - Value to check
 */
export function expectValueLoaded(
  flow: Map<string, ValueFlowEntry[]>,
  valueId: string
): void;
```

### Implementation

```typescript
// value-tracking.ts

import { expect } from 'vitest';

export function analyzeValueFlow(asm: string): Map<string, ValueFlowEntry[]> {
  const flow = new Map<string, ValueFlowEntry[]>();
  const lines = asm.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Extract value references from comments
    // Pattern: v1, v2, v5:i.0, etc.
    const valueMatches = line.match(/\b(v\d+(?::\w+\.\d+)?)\b/g);
    if (!valueMatches) continue;
    
    // Determine operation type
    const instruction = extractInstruction(line);
    const location = determineLocation(line);
    const address = extractAddress(line);
    
    for (const valueId of valueMatches) {
      const entry: ValueFlowEntry = {
        ilValueId: valueId,
        location,
        address,
        instruction,
        line: lineNum
      };
      
      if (!flow.has(valueId)) {
        flow.set(valueId, []);
      }
      flow.get(valueId)!.push(entry);
    }
  }
  
  return flow;
}

function extractInstruction(line: string): string {
  const match = line.trim().match(/^(\w+(?:\s+[^;]+)?)/);
  return match ? match[1].trim() : '';
}

function determineLocation(line: string): ValueFlowEntry['location'] {
  const trimmed = line.trim().toUpperCase();
  
  if (trimmed.startsWith('STA ')) {
    const operand = trimmed.slice(4).split(';')[0].trim();
    if (operand.startsWith('$') && operand.length <= 3) return 'zp';
    if (operand.startsWith('$')) return 'abs';
    return 'zp'; // Labels typically resolve to ZP
  }
  
  if (trimmed.startsWith('LDA ')) return 'A';
  if (trimmed.startsWith('LDX ')) return 'X';
  if (trimmed.startsWith('LDY ')) return 'Y';
  if (trimmed.startsWith('TAX')) return 'X';
  if (trimmed.startsWith('TAY')) return 'Y';
  if (trimmed.startsWith('TXA')) return 'A';
  if (trimmed.startsWith('TYA')) return 'A';
  
  return 'unknown';
}

function extractAddress(line: string): number | undefined {
  const match = line.match(/\$([0-9A-Fa-f]+)/);
  if (match) {
    return parseInt(match[1], 16);
  }
  return undefined;
}

export function expectValueStored(
  flow: Map<string, ValueFlowEntry[]>,
  valueId: string,
  location: 'A' | 'X' | 'Y' | 'zp' | 'abs'
): void {
  const entries = flow.get(valueId);
  expect(entries).toBeDefined(`Value ${valueId} not found in flow`);
  
  const stored = entries!.some(e => e.location === location);
  expect(stored).toBe(true, 
    `Value ${valueId} not stored to ${location}. Found: ${entries!.map(e => e.location).join(', ')}`);
}

export function expectValueLoaded(
  flow: Map<string, ValueFlowEntry[]>,
  valueId: string
): void {
  const entries = flow.get(valueId);
  expect(entries).toBeDefined(`Value ${valueId} not found in flow`);
  
  const loaded = entries!.some(e => 
    e.location === 'A' || e.location === 'X' || e.location === 'Y'
  );
  expect(loaded).toBe(true,
    `Value ${valueId} never loaded to register`);
}
```

---

## Component 4: Compile Helper

### Purpose

Simplify compilation in tests with sensible defaults.

### Location

```
packages/compiler/src/__tests__/e2e/helpers/
└── compile-helper.ts
```

### API Design

```typescript
// compile-helper.ts

/**
 * Compiles Blend source to ASM with test-friendly defaults.
 */
export function compileToAsm(source: string): string;

/**
 * Compiles and returns full result including warnings.
 */
export function compileWithResult(source: string): {
  success: boolean;
  asm: string;
  warnings: string[];
  errors: string[];
};

/**
 * Compiles a fixture file by name.
 */
export function compileFixture(fixtureName: string): string;
```

---

## Task Breakdown

### Session 0.1: ASM Sequence Validator (2-3 hours)

| Task | Description | Deliverable |
|------|-------------|-------------|
| 0.1.1 | Create `asm-validator.ts` skeleton | File created |
| 0.1.2 | Implement `expectAsmSequence()` | Pattern matching works |
| 0.1.3 | Implement `expectNoStubs()` | STUB detection works |
| 0.1.4 | Implement `expectNoWarnings()` | Warning detection works |
| 0.1.5 | Create `asm-validator.test.ts` | 15+ unit tests |

### Session 0.2: Golden Output Framework (2-3 hours)

| Task | Description | Deliverable |
|------|-------------|-------------|
| 0.2.1 | Create `golden-tests.ts` skeleton | File created |
| 0.2.2 | Implement `compareGoldenOutput()` | Comparison works |
| 0.2.3 | Implement `saveGolden()` | Can create/update golden files |
| 0.2.4 | Create `fixtures/06-codegen/golden/` | Directory structure |
| 0.2.5 | Create 5 initial golden fixtures | Basic test coverage |

### Session 0.3: Value Flow Analysis (2-3 hours)

| Task | Description | Deliverable |
|------|-------------|-------------|
| 0.3.1 | Create `value-tracking.ts` skeleton | File created |
| 0.3.2 | Implement `analyzeValueFlow()` | Flow analysis works |
| 0.3.3 | Implement `expectValueStored()` | Location verification |
| 0.3.4 | Implement `expectValueLoaded()` | Load verification |
| 0.3.5 | Create `value-tracking.test.ts` | 10+ unit tests |

### Session 0.4: Integration & Compile Helper (1-2 hours)

| Task | Description | Deliverable |
|------|-------------|-------------|
| 0.4.1 | Create `compile-helper.ts` | Helper functions |
| 0.4.2 | Create `index.ts` to export all | Clean imports |
| 0.4.3 | Create integration test | End-to-end helper test |
| 0.4.4 | Document usage in README | Developer guide |

---

## Success Criteria

### Phase 0 is complete when:

1. ✅ `expectAsmSequence()` can verify instruction patterns
2. ✅ `expectNoStubs()` detects STUB comments
3. ✅ `compareGoldenOutput()` can compare/update golden files
4. ✅ `analyzeValueFlow()` tracks value locations
5. ✅ All helper tests pass
6. ✅ Can use helpers in real E2E tests

### Verification

```bash
./compiler-test e2e/helpers
```

---

## Usage Examples

### Example 1: Value Preservation Test

```typescript
it('should preserve value in binary add', () => {
  const asm = compileToAsm(`
    function test(): byte {
      let a: byte = 5;
      let b: byte = 3;
      return a + b;
    }
  `);
  
  // Verify no stubs
  expectNoStubs(asm);
  
  // Verify sequence
  expectAsmSequence(asm, {
    instructions: [
      { mnemonic: 'LDA', operand: /^#\$0[0-9A-F]$/ },  // Load first value
      { mnemonic: 'STA', operand: /^\$[0-9A-F]{2}$/ }, // Save to temp
      { mnemonic: 'LDA', operand: /^#\$0[0-9A-F]$/ },  // Load second value
      { mnemonic: 'CLC' },
      { mnemonic: 'ADC' }                              // Add saved value
    ],
    allowGaps: true
  });
});
```

### Example 2: Golden Output Test

```typescript
it('should generate correct code for if-else', () => {
  const asm = compileToAsm(`
    function test(cond: bool): byte {
      if (cond) {
        return 1;
      } else {
        return 2;
      }
    }
  `);
  
  compareGoldenOutput('if-else-return', asm, {
    ignoreComments: true
  });
});
```

### Example 3: Value Flow Test

```typescript
it('should track value through operations', () => {
  const asm = compileToAsm(`
    function test(): byte {
      let x: byte = 10;
      let y: byte = x + 5;
      return y;
    }
  `);
  
  const flow = analyzeValueFlow(asm);
  
  // Verify x was stored
  expectValueStored(flow, 'v1', 'zp');
  
  // Verify x was loaded for addition
  expectValueLoaded(flow, 'v1');
});
```

---

## Related Documents

- [Requirements](01-requirements.md) - REQ-10
- [Correctness Tests](12-correctness-tests.md) - Uses this infrastructure
- [Execution Plan](99-execution-plan.md) - Session details