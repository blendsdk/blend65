/**
 * ASM Validation Helpers for E2E Tests
 *
 * Provides utilities for validating generated assembly code
 * in E2E tests. These helpers make it easy to check for
 * expected patterns, instructions, and data in the output.
 *
 * @module e2e/helpers/asm-validator
 */

import { expect } from 'vitest';

/**
 * Asserts that assembly contains a pattern (string or regex)
 *
 * @param asm - Assembly code to check
 * @param pattern - String or regex pattern to find
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * expectAsmContains(asm, 'LDA #$0A');
 * expectAsmContains(asm, /LDA\s+\#\$[0-9A-F]{2}/);
 * ```
 */
export function expectAsmContains(asm: string, pattern: string | RegExp, message?: string): void {
  if (typeof pattern === 'string') {
    const found = asm.includes(pattern);
    if (!found) {
      const preview = asm.length > 500 ? asm.slice(0, 500) + '...' : asm;
      const msg = message || `Expected assembly to contain "${pattern}"`;
      expect.fail(`${msg}\n\nAssembly output:\n${preview}`);
    }
  } else {
    const found = pattern.test(asm);
    if (!found) {
      const preview = asm.length > 500 ? asm.slice(0, 500) + '...' : asm;
      const msg = message || `Expected assembly to match pattern ${pattern}`;
      expect.fail(`${msg}\n\nAssembly output:\n${preview}`);
    }
  }
}

/**
 * Asserts that assembly does NOT contain a pattern
 *
 * @param asm - Assembly code to check
 * @param pattern - String or regex pattern that should NOT be present
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * expectAsmNotContains(asm, 'STUB:');
 * expectAsmNotContains(asm, /Unknown variable/);
 * ```
 */
export function expectAsmNotContains(asm: string, pattern: string | RegExp, message?: string): void {
  if (typeof pattern === 'string') {
    const found = asm.includes(pattern);
    if (found) {
      const msg = message || `Expected assembly to NOT contain "${pattern}"`;
      expect.fail(msg);
    }
  } else {
    const found = pattern.test(asm);
    if (found) {
      const msg = message || `Expected assembly to NOT match pattern ${pattern}`;
      expect.fail(msg);
    }
  }
}

/**
 * Asserts that assembly contains a specific 6502 instruction
 *
 * This is more lenient than exact string matching - it looks for
 * the instruction mnemonic at a word boundary.
 *
 * @param asm - Assembly code to check
 * @param instruction - Instruction mnemonic (e.g., 'LDA', 'STA', 'JMP')
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * expectAsmInstruction(asm, 'LDA');
 * expectAsmInstruction(asm, 'JSR');
 * ```
 */
export function expectAsmInstruction(asm: string, instruction: string, message?: string): void {
  // Match instruction at word boundary (case-insensitive)
  const pattern = new RegExp(`\\b${instruction}\\b`, 'i');
  const found = pattern.test(asm);

  if (!found) {
    const msg = message || `Expected assembly to contain instruction "${instruction}"`;
    expect.fail(msg);
  }
}

/**
 * Asserts that assembly does NOT contain a specific 6502 instruction
 *
 * @param asm - Assembly code to check
 * @param instruction - Instruction mnemonic that should NOT be present
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * expectAsmNoInstruction(asm, 'BRK');  // No crashes
 * ```
 */
export function expectAsmNoInstruction(asm: string, instruction: string, message?: string): void {
  const pattern = new RegExp(`\\b${instruction}\\b`, 'i');
  const found = pattern.test(asm);

  if (found) {
    const msg = message || `Expected assembly to NOT contain instruction "${instruction}"`;
    expect.fail(msg);
  }
}

/**
 * Counts occurrences of a pattern in assembly
 *
 * @param asm - Assembly code to check
 * @param pattern - String or regex pattern to count
 * @returns Number of occurrences
 *
 * @example
 * ```typescript
 * const ldaCount = countAsmOccurrences(asm, /\bLDA\b/gi);
 * expect(ldaCount).toBeGreaterThan(0);
 * ```
 */
export function countAsmOccurrences(asm: string, pattern: string | RegExp): number {
  if (typeof pattern === 'string') {
    let count = 0;
    let pos = 0;
    while ((pos = asm.indexOf(pattern, pos)) !== -1) {
      count++;
      pos += pattern.length;
    }
    return count;
  } else {
    // Ensure global flag is set
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    const matches = asm.match(globalPattern);
    return matches ? matches.length : 0;
  }
}

/**
 * Asserts that assembly contains byte data directive with specific values
 *
 * ACME assembler uses `!byte` for byte data.
 *
 * @param asm - Assembly code to check
 * @param values - Array of expected byte values (as numbers)
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * // Check for: !byte $01, $02, $03
 * expectAsmByteData(asm, [0x01, 0x02, 0x03]);
 * ```
 */
export function expectAsmByteData(asm: string, values: number[], message?: string): void {
  // Build expected pattern: !byte $XX, $YY, $ZZ
  const hexValues = values.map((v) => `\\$${v.toString(16).toUpperCase().padStart(2, '0')}`).join(',\\s*');
  const pattern = new RegExp(`!byte\\s+${hexValues}`, 'i');

  const found = pattern.test(asm);
  if (!found) {
    const expected = values.map((v) => `$${v.toString(16).toUpperCase().padStart(2, '0')}`).join(', ');
    const msg = message || `Expected assembly to contain byte data: !byte ${expected}`;
    expect.fail(msg);
  }
}

/**
 * Asserts that assembly contains a label definition
 *
 * @param asm - Assembly code to check
 * @param label - Label name to find
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * expectAsmLabel(asm, 'main');
 * expectAsmLabel(asm, '_myFunction');
 * ```
 */
export function expectAsmLabel(asm: string, label: string, message?: string): void {
  // Labels are defined as: labelName: or labelName (at start of line)
  // Or in ACME format: label = value or just label: at line start
  const pattern = new RegExp(`^\\s*${label}[:\\s=]|\\b${label}:`, 'm');
  const found = pattern.test(asm);

  if (!found) {
    const msg = message || `Expected assembly to contain label "${label}"`;
    expect.fail(msg);
  }
}

/**
 * Asserts that assembly contains a JSR (subroutine call) to a label
 *
 * @param asm - Assembly code to check
 * @param label - Label being called (without underscore prefix - it will be added automatically)
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * expectAsmCall(asm, 'myFunction');  // Matches JSR _myFunction
 * ```
 */
export function expectAsmCall(asm: string, label: string, message?: string): void {
  // Function labels use underscore prefix
  const prefixedLabel = label.startsWith('_') ? label : `_${label}`;
  const pattern = new RegExp(`\\bJSR\\s+${prefixedLabel}\\b`, 'i');
  const found = pattern.test(asm);

  if (!found) {
    const msg = message || `Expected assembly to contain call: JSR ${prefixedLabel}`;
    expect.fail(msg);
  }
}

/**
 * Asserts that assembly contains a load instruction with immediate value
 *
 * @param asm - Assembly code to check
 * @param value - Immediate value (number)
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * expectAsmLoadImmediate(asm, 10);  // LDA #$0A
 * ```
 */
export function expectAsmLoadImmediate(asm: string, value: number, message?: string): void {
  const hex = value.toString(16).toUpperCase().padStart(2, '0');
  const pattern = new RegExp(`\\bLDA\\s+#\\$${hex}\\b`, 'i');
  const found = pattern.test(asm);

  if (!found) {
    const msg = message || `Expected assembly to contain: LDA #$${hex}`;
    expect.fail(msg);
  }
}

/**
 * Asserts that assembly contains a store to a specific address
 *
 * @param asm - Assembly code to check
 * @param address - Address (number) - will be formatted as hex
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * expectAsmStoreAddress(asm, 0xD020);  // STA $D020
 * ```
 */
export function expectAsmStoreAddress(asm: string, address: number, message?: string): void {
  const hex = address.toString(16).toUpperCase().padStart(4, '0');
  const pattern = new RegExp(`\\bSTA\\s+\\$${hex}\\b`, 'i');
  const found = pattern.test(asm);

  if (!found) {
    const msg = message || `Expected assembly to contain: STA $${hex}`;
    expect.fail(msg);
  }
}

/**
 * Asserts that assembly contains a load from a specific address
 *
 * @param asm - Assembly code to check
 * @param address - Address (number) - will be formatted as hex
 * @param message - Optional custom error message
 *
 * @example
 * ```typescript
 * expectAsmLoadAddress(asm, 0xD020);  // LDA $D020
 * ```
 */
export function expectAsmLoadAddress(asm: string, address: number, message?: string): void {
  const hex = address.toString(16).toUpperCase().padStart(4, '0');
  const pattern = new RegExp(`\\bLDA\\s+\\$${hex}\\b`, 'i');
  const found = pattern.test(asm);

  if (!found) {
    const msg = message || `Expected assembly to contain: LDA $${hex}`;
    expect.fail(msg);
  }
}

/**
 * Extracts a specific section from assembly (between labels or comments)
 *
 * Useful for checking code within a specific function or section.
 *
 * @param asm - Assembly code
 * @param startPattern - Pattern marking section start
 * @param endPattern - Pattern marking section end (optional)
 * @returns Extracted section or null if not found
 *
 * @example
 * ```typescript
 * const mainSection = extractAsmSection(asm, /^main:/m, /^[a-z_]+:/m);
 * expect(mainSection).toContain('RTS');
 * ```
 */
export function extractAsmSection(asm: string, startPattern: RegExp, endPattern?: RegExp): string | null {
  const startMatch = asm.match(startPattern);
  if (!startMatch || startMatch.index === undefined) {
    return null;
  }

  const startIndex = startMatch.index;
  let endIndex = asm.length;

  if (endPattern) {
    // Search for end pattern after start
    const afterStart = asm.slice(startIndex + startMatch[0].length);
    const endMatch = afterStart.match(endPattern);
    if (endMatch && endMatch.index !== undefined) {
      endIndex = startIndex + startMatch[0].length + endMatch.index;
    }
  }

  return asm.slice(startIndex, endIndex);
}

/**
 * Validates that assembly has no obvious error markers
 *
 * Checks for common indicators of incomplete code generation.
 *
 * @param asm - Assembly code to check
 *
 * @example
 * ```typescript
 * expectAsmNoErrors(asm);
 * ```
 */
export function expectAsmNoErrors(asm: string): void {
  // Check for common error markers
  const errorPatterns = [
    { pattern: /STUB:/i, description: 'STUB marker found' },
    { pattern: /Unknown variable/i, description: 'Unknown variable error' },
    { pattern: /TODO:/i, description: 'TODO marker found' },
    { pattern: /FIXME:/i, description: 'FIXME marker found' },
    { pattern: /NOT_IMPLEMENTED/i, description: 'NOT_IMPLEMENTED marker found' },
  ];

  for (const { pattern, description } of errorPatterns) {
    if (pattern.test(asm)) {
      // Find the line containing the error for context
      const lines = asm.split('\n');
      const errorLine = lines.find((line) => pattern.test(line));
      expect.fail(`${description} in assembly:\n  ${errorLine}`);
    }
  }
}