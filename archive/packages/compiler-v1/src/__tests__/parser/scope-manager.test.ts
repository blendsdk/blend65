/**
 * Unit tests for ScopeManager
 *
 * Tests all scope management functionality:
 * - Function scope lifecycle (enter/exit)
 * - Loop scope lifecycle (enter/exit)
 * - Variable tracking and lookup
 * - Scope nesting and context queries
 * - Error reporting for invalid operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScopeManager, ScopeType, ErrorReporter } from '../../parser/scope-manager.js';
import { DiagnosticCode, Parameter, SourceLocation } from '../../ast/index.js';

describe('ScopeManager', () => {
  let scopeManager: ScopeManager;
  let errorReporter: ErrorReporter;
  let errors: Array<{ code: DiagnosticCode; message: string; location?: SourceLocation }>;

  // Helper to create mock source location
  function createMockLocation(): SourceLocation {
    return {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 10, offset: 10 },
    };
  }

  // Helper to create mock parameter
  function createMockParameter(name: string, type: string): Parameter {
    return {
      name,
      typeAnnotation: type,
      location: createMockLocation(),
    };
  }

  beforeEach(() => {
    errors = [];
    errorReporter = vi.fn((code, message, location) => {
      errors.push({ code, message, location });
    });
    scopeManager = new ScopeManager(errorReporter);
  });

  // ============================================
  // FUNCTION SCOPE TESTS
  // ============================================

  describe('Function Scope Management', () => {
    it('should start with no scopes', () => {
      expect(scopeManager.getScopeDepth()).toBe(0);
      expect(scopeManager.isInFunction()).toBe(false);
    });

    it('should enter function scope with no parameters', () => {
      scopeManager.enterFunctionScope([], 'void');

      expect(scopeManager.getScopeDepth()).toBe(1);
      expect(scopeManager.isInFunction()).toBe(true);
      expect(scopeManager.getCurrentFunctionReturnType()).toBe('void');
    });

    it('should enter function scope with parameters', () => {
      const params = [createMockParameter('x', 'byte'), createMockParameter('y', 'word')];

      scopeManager.enterFunctionScope(params, 'byte');

      expect(scopeManager.isInFunction()).toBe(true);
      expect(scopeManager.getCurrentFunctionReturnType()).toBe('byte');
      expect(scopeManager.lookupVariable('x')).toBe('byte');
      expect(scopeManager.lookupVariable('y')).toBe('word');
    });

    it('should detect duplicate parameters', () => {
      const params = [createMockParameter('x', 'byte'), createMockParameter('x', 'word')];

      scopeManager.enterFunctionScope(params, 'void');

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(DiagnosticCode.DUPLICATE_DECLARATION);
      expect(errors[0].message).toContain("Duplicate parameter 'x'");
    });

    it('should exit function scope', () => {
      scopeManager.enterFunctionScope([], 'void');
      expect(scopeManager.isInFunction()).toBe(true);

      scopeManager.exitFunctionScope();

      expect(scopeManager.isInFunction()).toBe(false);
      expect(scopeManager.getScopeDepth()).toBe(0);
    });

    it('should report error when exiting function scope without entering', () => {
      scopeManager.exitFunctionScope();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(DiagnosticCode.UNEXPECTED_TOKEN);
      expect(errors[0].message).toContain('not in function');
    });

    it('should handle nested function scopes', () => {
      scopeManager.enterFunctionScope([], 'void');
      scopeManager.enterFunctionScope([], 'byte');

      expect(scopeManager.getScopeDepth()).toBe(2);
      expect(scopeManager.getCurrentFunctionReturnType()).toBe('byte');

      scopeManager.exitFunctionScope();

      expect(scopeManager.getScopeDepth()).toBe(1);
      expect(scopeManager.getCurrentFunctionReturnType()).toBe('void');
    });

    it('should return null for return type when not in function', () => {
      expect(scopeManager.getCurrentFunctionReturnType()).toBeNull();
    });

    it('should handle null return type (void function)', () => {
      scopeManager.enterFunctionScope([], null);

      expect(scopeManager.getCurrentFunctionReturnType()).toBeNull();
    });
  });

  // ============================================
  // VARIABLE MANAGEMENT TESTS
  // ============================================

  describe('Variable Management', () => {
    it('should add local variable to function scope', () => {
      scopeManager.enterFunctionScope([], 'void');
      scopeManager.addLocalVariable('temp', 'byte', createMockLocation());

      expect(scopeManager.lookupVariable('temp')).toBe('byte');
    });

    it('should detect duplicate variables in same scope', () => {
      scopeManager.enterFunctionScope([], 'void');
      const location = createMockLocation();

      scopeManager.addLocalVariable('temp', 'byte', location);
      scopeManager.addLocalVariable('temp', 'word', location);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(DiagnosticCode.DUPLICATE_DECLARATION);
      expect(errors[0].message).toContain("Variable 'temp' already declared");
    });

    it('should not add variable when not in function scope', () => {
      // Should silently do nothing (module-level variables handled elsewhere)
      scopeManager.addLocalVariable('temp', 'byte', createMockLocation());

      expect(scopeManager.lookupVariable('temp')).toBeNull();
      expect(errors).toHaveLength(0);
    });

    it('should look up variables in scope chain', () => {
      scopeManager.enterFunctionScope([], 'void');
      scopeManager.addLocalVariable('outer', 'byte', createMockLocation());

      scopeManager.enterFunctionScope([], 'byte');
      scopeManager.addLocalVariable('inner', 'word', createMockLocation());

      expect(scopeManager.lookupVariable('inner')).toBe('word');
      expect(scopeManager.lookupVariable('outer')).toBe('byte');
    });

    it('should return null for unknown variables', () => {
      scopeManager.enterFunctionScope([], 'void');

      expect(scopeManager.lookupVariable('unknown')).toBeNull();
    });

    it('should shadow variables in inner scopes', () => {
      scopeManager.enterFunctionScope([], 'void');
      scopeManager.addLocalVariable('x', 'byte', createMockLocation());

      scopeManager.enterFunctionScope([], 'byte');
      scopeManager.addLocalVariable('x', 'word', createMockLocation());

      expect(scopeManager.lookupVariable('x')).toBe('word');

      scopeManager.exitFunctionScope();

      expect(scopeManager.lookupVariable('x')).toBe('byte');
    });

    it('should handle parameters and local variables together', () => {
      const params = [createMockParameter('param', 'byte')];

      scopeManager.enterFunctionScope(params, 'void');
      scopeManager.addLocalVariable('local', 'word', createMockLocation());

      expect(scopeManager.lookupVariable('param')).toBe('byte');
      expect(scopeManager.lookupVariable('local')).toBe('word');
    });
  });

  // ============================================
  // LOOP SCOPE TESTS
  // ============================================

  describe('Loop Scope Management', () => {
    it('should enter loop scope', () => {
      scopeManager.enterLoopScope();

      expect(scopeManager.getScopeDepth()).toBe(1);
      expect(scopeManager.isInLoop()).toBe(true);
      expect(scopeManager.getLoopNestingLevel()).toBe(1);
    });

    it('should exit loop scope', () => {
      scopeManager.enterLoopScope();
      expect(scopeManager.isInLoop()).toBe(true);

      scopeManager.exitLoopScope();

      expect(scopeManager.isInLoop()).toBe(false);
      expect(scopeManager.getLoopNestingLevel()).toBe(0);
    });

    it('should report error when exiting loop scope without entering', () => {
      scopeManager.exitLoopScope();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(DiagnosticCode.UNEXPECTED_TOKEN);
      expect(errors[0].message).toContain('not in loop');
    });

    it('should handle nested loop scopes', () => {
      scopeManager.enterLoopScope();
      scopeManager.enterLoopScope();
      scopeManager.enterLoopScope();

      expect(scopeManager.getLoopNestingLevel()).toBe(3);
      expect(scopeManager.isInLoop()).toBe(true);

      scopeManager.exitLoopScope();

      expect(scopeManager.getLoopNestingLevel()).toBe(2);
      expect(scopeManager.isInLoop()).toBe(true);
    });

    it('should start with no loop context', () => {
      expect(scopeManager.isInLoop()).toBe(false);
      expect(scopeManager.getLoopNestingLevel()).toBe(0);
    });
  });

  // ============================================
  // MIXED SCOPE TESTS
  // ============================================

  describe('Mixed Function and Loop Scopes', () => {
    it('should handle loop inside function', () => {
      scopeManager.enterFunctionScope([], 'void');
      scopeManager.enterLoopScope();

      expect(scopeManager.isInFunction()).toBe(true);
      expect(scopeManager.isInLoop()).toBe(true);
      expect(scopeManager.getScopeDepth()).toBe(2);
    });

    it('should handle function inside loop (edge case)', () => {
      scopeManager.enterLoopScope();
      scopeManager.enterFunctionScope([], 'void');

      expect(scopeManager.isInLoop()).toBe(true);
      expect(scopeManager.isInFunction()).toBe(true);
    });

    it('should exit innermost scope correctly when mixed', () => {
      scopeManager.enterFunctionScope([], 'void');
      scopeManager.enterLoopScope();
      scopeManager.enterLoopScope();

      expect(scopeManager.getScopeDepth()).toBe(3);

      scopeManager.exitLoopScope();

      expect(scopeManager.getScopeDepth()).toBe(2);
      expect(scopeManager.isInLoop()).toBe(true);
      expect(scopeManager.isInFunction()).toBe(true);
    });

    it('should exit function scope even with loops inside', () => {
      scopeManager.enterFunctionScope([], 'void');
      scopeManager.enterLoopScope();

      scopeManager.exitFunctionScope();

      expect(scopeManager.isInFunction()).toBe(false);
      expect(scopeManager.isInLoop()).toBe(true);
      expect(scopeManager.getScopeDepth()).toBe(1);
    });

    it('should handle complex nesting scenario', () => {
      // Outer function
      scopeManager.enterFunctionScope([], 'void');
      scopeManager.addLocalVariable('outerVar', 'byte', createMockLocation());

      // Loop inside outer function
      scopeManager.enterLoopScope();

      // Inner function (nested function or callback)
      scopeManager.enterFunctionScope([], 'byte');
      scopeManager.addLocalVariable('innerVar', 'word', createMockLocation());

      // Loop inside inner function
      scopeManager.enterLoopScope();

      // Verify state
      expect(scopeManager.getScopeDepth()).toBe(4);
      expect(scopeManager.getLoopNestingLevel()).toBe(2);
      expect(scopeManager.getCurrentFunctionReturnType()).toBe('byte');
      expect(scopeManager.lookupVariable('innerVar')).toBe('word');
      expect(scopeManager.lookupVariable('outerVar')).toBe('byte');
    });
  });

  // ============================================
  // SCOPE STACK TESTS
  // ============================================

  describe('Scope Stack Management', () => {
    it('should return empty scope stack initially', () => {
      expect(scopeManager.getScopeStack()).toEqual([]);
    });

    it('should track scope stack correctly', () => {
      scopeManager.enterFunctionScope([], 'void');
      scopeManager.enterLoopScope();
      scopeManager.enterFunctionScope([], 'byte');

      const stack = scopeManager.getScopeStack();

      expect(stack).toEqual([ScopeType.FUNCTION, ScopeType.LOOP, ScopeType.FUNCTION]);
    });

    it('should reset all scopes', () => {
      scopeManager.enterFunctionScope([], 'void');
      scopeManager.enterLoopScope();
      scopeManager.addLocalVariable('temp', 'byte', createMockLocation());

      scopeManager.reset();

      expect(scopeManager.getScopeDepth()).toBe(0);
      expect(scopeManager.isInFunction()).toBe(false);
      expect(scopeManager.isInLoop()).toBe(false);
      expect(scopeManager.lookupVariable('temp')).toBeNull();
    });
  });

  // ============================================
  // EDGE CASE TESTS
  // ============================================

  describe('Edge Cases', () => {
    it('should handle empty parameter list', () => {
      scopeManager.enterFunctionScope([], 'void');

      expect(scopeManager.isInFunction()).toBe(true);
      expect(scopeManager.getCurrentFunctionReturnType()).toBe('void');
    });

    it('should handle many nested scopes', () => {
      for (let i = 0; i < 10; i++) {
        scopeManager.enterLoopScope();
      }

      expect(scopeManager.getLoopNestingLevel()).toBe(10);

      for (let i = 0; i < 10; i++) {
        scopeManager.exitLoopScope();
      }

      expect(scopeManager.getLoopNestingLevel()).toBe(0);
    });

    it('should handle variable lookup with no scopes', () => {
      expect(scopeManager.lookupVariable('anything')).toBeNull();
    });

    it('should handle variable lookup in loop-only scope', () => {
      scopeManager.enterLoopScope();

      expect(scopeManager.lookupVariable('anything')).toBeNull();
    });

    it('should preserve function return type after entering/exiting loops', () => {
      scopeManager.enterFunctionScope([], 'word');
      scopeManager.enterLoopScope();
      scopeManager.exitLoopScope();

      expect(scopeManager.getCurrentFunctionReturnType()).toBe('word');
    });

    it('should allow same variable name in different function scopes', () => {
      scopeManager.enterFunctionScope([], 'void');
      scopeManager.addLocalVariable('x', 'byte', createMockLocation());
      scopeManager.exitFunctionScope();

      scopeManager.enterFunctionScope([], 'void');
      scopeManager.addLocalVariable('x', 'word', createMockLocation());

      expect(errors).toHaveLength(0);
      expect(scopeManager.lookupVariable('x')).toBe('word');
    });
  });

  // ============================================
  // ERROR REPORTER TESTS
  // ============================================

  describe('Error Reporting', () => {
    it('should call error reporter for duplicate parameters', () => {
      const params = [createMockParameter('x', 'byte'), createMockParameter('x', 'word')];

      scopeManager.enterFunctionScope(params, 'void');

      expect(errorReporter).toHaveBeenCalledTimes(1);
      expect(errorReporter).toHaveBeenCalledWith(
        DiagnosticCode.DUPLICATE_DECLARATION,
        expect.stringContaining('Duplicate parameter'),
        expect.any(Object)
      );
    });

    it('should call error reporter for duplicate variables', () => {
      scopeManager.enterFunctionScope([], 'void');
      const location = createMockLocation();

      scopeManager.addLocalVariable('temp', 'byte', location);
      scopeManager.addLocalVariable('temp', 'word', location);

      expect(errorReporter).toHaveBeenCalledTimes(1);
    });

    it('should call error reporter for invalid scope exits', () => {
      scopeManager.exitFunctionScope();

      expect(errorReporter).toHaveBeenCalledTimes(1);

      scopeManager.exitLoopScope();

      expect(errorReporter).toHaveBeenCalledTimes(2);
    });
  });
});
