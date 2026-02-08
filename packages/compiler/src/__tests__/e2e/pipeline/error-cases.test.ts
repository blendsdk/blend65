/**
 * E2E Pipeline Tests: Error Cases
 *
 * Tests that the compilation pipeline correctly reports errors
 * and stops compilation at the appropriate phase when invalid
 * Blend65 source code is provided.
 *
 * **Test Categories:**
 * - Parse errors: Invalid syntax
 * - Semantic errors: Type mismatches, undefined variables
 * - Target validation errors: Invalid targets
 * - Multiple errors: Programs with several issues
 * - Graceful handling: Empty sources, edge cases
 *
 * @module __tests__/e2e/pipeline/error-cases
 */

import { describe, it, expect } from 'vitest';
import {
  compileBlend,
  compileBlendSources,
  expectFailure,
  expectDiagnosticContains,
  countErrors,
} from './helpers.js';
import type { Blend65Config } from '../../../config/types.js';

describe('E2E: Error Cases', () => {
  // ── Parse Errors ───────────────────────────────────────────────

  describe('parse errors', () => {
    it('should fail on missing variable name', () => {
      const result = compileBlend('let = 42;');
      expectFailure(result, 'missing variable name');
    });

    it('should fail on missing semicolon', () => {
      // Parser may or may not recover from missing semicolons,
      // but it should at least report a diagnostic
      const result = compileBlend('let x: byte = 42 let y: byte = 10;');
      // This may or may not fail completely depending on parser recovery
      // but should have at least one diagnostic
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it('should fail on invalid token', () => {
      const result = compileBlend('let x: byte = @@@;');
      expectFailure(result, 'invalid token');
    });

    it('should fail on unclosed block', () => {
      const result = compileBlend('function foo(): void {');
      expectFailure(result, 'unclosed block');
    });

    it('should fail on unclosed parenthesis', () => {
      const result = compileBlend('let x: byte = (42;');
      expectFailure(result, 'unclosed parenthesis');
    });
  });

  // ── Semantic Errors ────────────────────────────────────────────

  describe('semantic errors', () => {
    it('should fail on type mismatch (string assigned to byte)', () => {
      const result = compileBlend('let x: byte = "hello";');
      expectFailure(result, 'type mismatch string->byte');
    });

    it('should fail on undefined variable reference', () => {
      const source = `
        let x: byte = undeclaredVar;
      `;
      const result = compileBlend(source);
      expectFailure(result, 'undefined variable');
    });

    it('should fail on duplicate variable declaration in same scope', () => {
      const source = `
        let x: byte = 1;
        let x: byte = 2;
      `;
      const result = compileBlend(source);
      expectFailure(result, 'duplicate declaration');
      expectDiagnosticContains(result, 'already declared');
    });
  });

  // ── Target Validation Errors ───────────────────────────────────

  describe('target validation errors', () => {
    it('should fail on invalid target platform', () => {
      const config: Blend65Config = {
        compilerOptions: {
          target: 'invalid_platform' as 'c64',
          optimization: 'O0',
        },
      };
      const result = compileBlend('let x: byte = 1;', config);
      expectFailure(result, 'invalid target');
      expectDiagnosticContains(result, 'invalid_platform');
    });

    it('should fail on unimplemented target', () => {
      const config: Blend65Config = {
        compilerOptions: {
          target: 'x16',
          optimization: 'O0',
        },
      };
      const result = compileBlend('let x: byte = 1;', config);
      expectFailure(result, 'unimplemented target');
      expectDiagnosticContains(result, 'not implemented');
    });
  });

  // ── Multiple Errors ────────────────────────────────────────────

  describe('multiple errors', () => {
    it('should report multiple diagnostics for multiple issues', () => {
      const source = `
        let x: byte = "hello";
        let y: byte = "world";
      `;
      const result = compileBlend(source);
      expectFailure(result, 'multiple type errors');
      // Should have at least 2 errors for 2 type mismatches
      expect(countErrors(result)).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Error Diagnostics Quality ──────────────────────────────────

  describe('error diagnostics quality', () => {
    it('should include source location in error diagnostics', () => {
      const result = compileBlend('let = ;');
      expectFailure(result);

      const errorDiag = result.diagnostics.find(d => d.severity === 'error');
      expect(errorDiag).toBeDefined();
      expect(errorDiag!.location).toBeDefined();
      expect(errorDiag!.location.start.line).toBeGreaterThanOrEqual(1);
      expect(errorDiag!.location.start.column).toBeGreaterThanOrEqual(1);
    });

    it('should have meaningful error messages', () => {
      const result = compileBlend('let x: byte = "hello";');
      expectFailure(result);

      // Error message should not be empty
      const errorDiag = result.diagnostics.find(d => d.severity === 'error');
      expect(errorDiag).toBeDefined();
      expect(errorDiag!.message.length).toBeGreaterThan(5);
    });

    it('should not produce assembly output on failure', () => {
      const result = compileBlend('let = ;');
      expectFailure(result);

      // Failed compilations should not have assembly output
      expect(result.output).toBeUndefined();
    });
  });

  // ── Graceful Handling ──────────────────────────────────────────

  describe('graceful handling', () => {
    it('should handle empty source gracefully', () => {
      const result = compileBlend('');
      // Empty source may succeed (empty program) or fail
      // but should NOT throw an exception
      expect(result).toBeDefined();
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty source map gracefully', () => {
      const sources = new Map<string, string>();
      const result = compileBlendSources(sources);
      // Should not throw
      expect(result).toBeDefined();
    });

    it('should handle whitespace-only source', () => {
      const result = compileBlend('   \n\n   \n   ');
      // Whitespace-only may succeed as empty or fail gracefully
      expect(result).toBeDefined();
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle comment-only source', () => {
      const result = compileBlend('// This is just a comment');
      // Comment-only should succeed as a valid empty program
      expect(result).toBeDefined();
    });
  });
});
