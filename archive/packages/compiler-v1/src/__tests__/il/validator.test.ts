/**
 * IL Validator Tests
 *
 * Tests for ILValidator class which validates IL for correctness before code generation.
 *
 * Test Categories:
 * - Valid IL Detection: Correctly identifies valid IL structures
 * - Terminator Validation: Detects missing/multiple terminators
 * - Type Checking: Validates type correctness in instructions
 * - CFG Validation: Detects CFG inconsistencies
 * - SSA Validation: Detects SSA violations
 * - Phi Validation: Validates phi instructions
 * - Reachability: Detects unreachable code
 *
 * @module il/validator.test
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  ILValidator,
  validateModule,
  validateFunction,
  formatValidationErrors,
  type ValidationResult,
} from '../../il/validator.js';
import { ILModule } from '../../il/module.js';
import { ILFunction, ILStorageClass } from '../../il/function.js';
import { ILBuilder } from '../../il/builder.js';
import { IL_BYTE, IL_WORD, IL_BOOL, IL_VOID, ILTypeKind } from '../../il/types.js';
import {
  ILConstInstruction,
  ILBinaryInstruction,
  ILReturnInstruction,
  ILReturnVoidInstruction,
  ILJumpInstruction,
  ILBranchInstruction,
  ILPhiInstruction,
  ILOpcode,
} from '../../il/instructions.js';
import { VirtualRegister, type ILLabel } from '../../il/values.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestRegister(id: number, type = IL_BYTE, name?: string): VirtualRegister {
  return new VirtualRegister(id, type, name);
}

function createTestLabel(name: string, blockId: number): ILLabel {
  return Object.freeze({ kind: 'label' as const, name, blockId });
}

// =============================================================================
// ILValidator Tests
// =============================================================================

describe('ILValidator', () => {
  describe('construction', () => {
    it('should create validator with default options', () => {
      const validator = new ILValidator();
      expect(validator).toBeDefined();
    });

    it('should create validator with custom options', () => {
      const validator = new ILValidator({
        checkTerminators: false,
        checkSSA: false,
      });
      expect(validator).toBeDefined();
    });
  });

  // ===========================================================================
  // Valid IL Detection Tests
  // ===========================================================================

  describe('valid IL detection', () => {
    it('should validate simple valid function', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      entry.addInstruction(new ILReturnVoidInstruction(0));

      const result = validateFunction(func);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate function with arithmetic', () => {
      const module = new ILModule('test');
      const builder = new ILBuilder(module);

      builder.beginFunction(
        'add',
        [
          { name: 'a', type: IL_BYTE },
          { name: 'b', type: IL_BYTE },
        ],
        IL_BYTE,
      );
      const a = builder.getParameterRegister(0)!;
      const b = builder.getParameterRegister(1)!;
      const sum = builder.emitAdd(a, b);
      builder.emitReturn(sum);
      builder.endFunction();

      const result = validateModule(module);

      expect(result.valid).toBe(true);
    });

    it('should validate function with control flow', () => {
      const module = new ILModule('test');
      const builder = new ILBuilder(module);

      builder.beginFunction('test', [{ name: 'x', type: IL_BYTE }], IL_BYTE);
      const x = builder.getParameterRegister(0)!;
      const zero = builder.emitConstByte(0);
      const cond = builder.emitCmpEq(x, zero);

      const thenBlock = builder.createBlock('then');
      const elseBlock = builder.createBlock('else');

      builder.emitBranch(cond, thenBlock, elseBlock);

      builder.setCurrentBlock(thenBlock);
      const one = builder.emitConstByte(1);
      builder.emitReturn(one);

      builder.setCurrentBlock(elseBlock);
      builder.emitReturn(x);

      builder.endFunction();

      const result = validateModule(module);

      expect(result.valid).toBe(true);
    });

    it('should validate empty module', () => {
      const module = new ILModule('empty');

      const result = validateModule(module);

      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // Terminator Validation Tests
  // ===========================================================================

  describe('terminator validation', () => {
    it('should detect missing terminator or empty block', () => {
      const func = new ILFunction('test', [], IL_VOID);
      // Entry block has no instructions (implies no terminator)

      const result = validateFunction(func);

      expect(result.valid).toBe(false);
      // Validator reports either "no instructions" or "terminator" depending on block state
      expect(
        result.errors.some(
          (e) => e.message.includes('no instructions') || e.message.includes('terminator'),
        ),
      ).toBe(true);
    });

    it('should detect missing terminator in non-entry block', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const other = func.createBlock('other');

      const target = createTestLabel('other', other.id);
      entry.addInstruction(new ILJumpInstruction(0, target));
      entry.linkTo(other);
      // 'other' block has no terminator

      const result = validateFunction(func);

      expect(result.valid).toBe(false);
    });

    it('should allow RETURN as terminator', () => {
      const func = new ILFunction('test', [], IL_BYTE);
      const entry = func.getEntryBlock();
      const value = createTestRegister(0, IL_BYTE);
      entry.addInstruction(new ILConstInstruction(0, 42, IL_BYTE, value));
      entry.addInstruction(new ILReturnInstruction(1, value));

      const result = validateFunction(func);

      expect(result.valid).toBe(true);
    });

    it('should allow RETURN_VOID as terminator', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      entry.addInstruction(new ILReturnVoidInstruction(0));

      const result = validateFunction(func);

      expect(result.valid).toBe(true);
    });

    it('should allow JUMP as terminator', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const exit = func.createBlock('exit');

      const target = createTestLabel('exit', exit.id);
      entry.addInstruction(new ILJumpInstruction(0, target));
      entry.linkTo(exit);
      exit.addInstruction(new ILReturnVoidInstruction(1));

      const result = validateFunction(func);

      expect(result.valid).toBe(true);
    });

    it('should allow BRANCH as terminator', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const thenBlock = func.createBlock('then');
      const elseBlock = func.createBlock('else');

      const cond = createTestRegister(0, IL_BOOL);
      entry.addInstruction(new ILConstInstruction(0, 1, IL_BOOL, cond));
      const thenLabel = createTestLabel('then', thenBlock.id);
      const elseLabel = createTestLabel('else', elseBlock.id);
      entry.addInstruction(new ILBranchInstruction(1, cond, thenLabel, elseLabel));
      entry.linkTo(thenBlock);
      entry.linkTo(elseBlock);

      thenBlock.addInstruction(new ILReturnVoidInstruction(2));
      elseBlock.addInstruction(new ILReturnVoidInstruction(3));

      const result = validateFunction(func);

      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // Type Checking Tests
  // ===========================================================================

  describe('type checking', () => {
    it('should detect type mismatch in binary operation', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();

      const byteReg = createTestRegister(0, IL_BYTE);
      const wordReg = createTestRegister(1, IL_WORD);
      const result = createTestRegister(2, IL_BYTE);

      entry.addInstruction(new ILConstInstruction(0, 10, IL_BYTE, byteReg));
      entry.addInstruction(new ILConstInstruction(1, 1000, IL_WORD, wordReg));
      // Type mismatch: byte + word
      entry.addInstruction(new ILBinaryInstruction(2, ILOpcode.ADD, byteReg, wordReg, result));
      entry.addInstruction(new ILReturnVoidInstruction(3));

      const result2 = validateFunction(func);

      expect(result2.valid).toBe(false);
      expect(result2.errors.some((e) => e.message.includes('mismatch'))).toBe(true);
    });

    it('should detect comparison result not bool', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();

      const a = createTestRegister(0, IL_BYTE);
      const b = createTestRegister(1, IL_BYTE);
      // Result should be bool but using byte
      const result = createTestRegister(2, IL_BYTE);

      entry.addInstruction(new ILConstInstruction(0, 10, IL_BYTE, a));
      entry.addInstruction(new ILConstInstruction(1, 20, IL_BYTE, b));
      entry.addInstruction(new ILBinaryInstruction(2, ILOpcode.CMP_EQ, a, b, result));
      entry.addInstruction(new ILReturnVoidInstruction(3));

      const result2 = validateFunction(func);

      expect(result2.valid).toBe(false);
      expect(result2.errors.some((e) => e.message.includes('bool'))).toBe(true);
    });

    it('should accept valid typed binary operation', () => {
      const func = new ILFunction('test', [], IL_BYTE);
      const entry = func.getEntryBlock();

      const a = createTestRegister(0, IL_BYTE);
      const b = createTestRegister(1, IL_BYTE);
      const result = createTestRegister(2, IL_BYTE);

      entry.addInstruction(new ILConstInstruction(0, 10, IL_BYTE, a));
      entry.addInstruction(new ILConstInstruction(1, 20, IL_BYTE, b));
      entry.addInstruction(new ILBinaryInstruction(2, ILOpcode.ADD, a, b, result));
      entry.addInstruction(new ILReturnInstruction(3, result));

      const result2 = validateFunction(func);

      expect(result2.valid).toBe(true);
    });
  });

  // ===========================================================================
  // CFG Validation Tests
  // ===========================================================================

  describe('CFG validation', () => {
    it('should detect CFG inconsistency - missing predecessor', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const next = func.createBlock('next');

      // Link only one direction (successor without predecessor)
      (entry as unknown as { successors: Set<unknown> }).successors = new Set([next]);
      // Don't add predecessor

      const target = createTestLabel('next', next.id);
      entry.addInstruction(new ILJumpInstruction(0, target));
      next.addInstruction(new ILReturnVoidInstruction(1));

      const result = validateFunction(func);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('inconsistency'))).toBe(true);
    });
  });

  // ===========================================================================
  // SSA Validation Tests
  // ===========================================================================

  describe('SSA validation', () => {
    it('should warn about duplicate register definition', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();

      // Same register defined twice
      const reg = createTestRegister(0, IL_BYTE);

      entry.addInstruction(new ILConstInstruction(0, 10, IL_BYTE, reg));
      entry.addInstruction(new ILConstInstruction(1, 20, IL_BYTE, reg)); // Same reg!
      entry.addInstruction(new ILReturnVoidInstruction(2));

      const result = validateFunction(func);

      // SSA violation is a warning, not error
      expect(result.warnings.some((w) => w.message.includes('SSA'))).toBe(true);
    });
  });

  // ===========================================================================
  // Use-Before-Definition Tests
  // ===========================================================================

  describe('use before definition', () => {
    it('should detect use of undefined register', () => {
      const func = new ILFunction('test', [], IL_BYTE);
      const entry = func.getEntryBlock();

      // Use register without defining it
      const undefinedReg = createTestRegister(99, IL_BYTE);

      entry.addInstruction(new ILReturnInstruction(0, undefinedReg));

      const result = validateFunction(func);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('before definition'))).toBe(true);
    });

    it('should accept use of parameter registers', () => {
      const func = new ILFunction('test', [{ name: 'x', type: IL_BYTE }], IL_BYTE);
      const entry = func.getEntryBlock();

      const param = func.getParameterRegister(0)!;
      entry.addInstruction(new ILReturnInstruction(0, param));

      const result = validateFunction(func);

      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // Reachability Tests
  // ===========================================================================

  describe('reachability', () => {
    it('should warn about unreachable block', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      func.createBlock('unreachable'); // Not linked

      entry.addInstruction(new ILReturnVoidInstruction(0));

      const result = validateFunction(func);

      expect(result.warnings.some((w) => w.message.includes('unreachable'))).toBe(true);
    });

    it('should not warn when all blocks reachable', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      const next = func.createBlock('next');

      const target = createTestLabel('next', next.id);
      entry.addInstruction(new ILJumpInstruction(0, target));
      entry.linkTo(next);
      next.addInstruction(new ILReturnVoidInstruction(1));

      const result = validateFunction(func);

      expect(result.warnings.filter((w) => w.message.includes('unreachable'))).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Phi Validation Tests
  // ===========================================================================

  describe('phi validation', () => {
    it('should validate correct phi instruction', () => {
      const func = new ILFunction('test', [], IL_BYTE);
      const entry = func.getEntryBlock();
      const thenBlock = func.createBlock('then');
      const elseBlock = func.createBlock('else');
      const mergeBlock = func.createBlock('merge');

      // Entry branches
      const cond = createTestRegister(0, IL_BOOL);
      entry.addInstruction(new ILConstInstruction(0, 1, IL_BOOL, cond));
      const thenLabel = createTestLabel('then', thenBlock.id);
      const elseLabel = createTestLabel('else', elseBlock.id);
      entry.addInstruction(new ILBranchInstruction(1, cond, thenLabel, elseLabel));
      entry.linkTo(thenBlock);
      entry.linkTo(elseBlock);

      // Then block
      const thenVal = createTestRegister(1, IL_BYTE);
      thenBlock.addInstruction(new ILConstInstruction(2, 1, IL_BYTE, thenVal));
      const mergeLabel = createTestLabel('merge', mergeBlock.id);
      thenBlock.addInstruction(new ILJumpInstruction(3, mergeLabel));
      thenBlock.linkTo(mergeBlock);

      // Else block
      const elseVal = createTestRegister(2, IL_BYTE);
      elseBlock.addInstruction(new ILConstInstruction(4, 2, IL_BYTE, elseVal));
      elseBlock.addInstruction(new ILJumpInstruction(5, mergeLabel));
      elseBlock.linkTo(mergeBlock);

      // Merge block with phi
      const phiResult = createTestRegister(3, IL_BYTE);
      mergeBlock.addInstruction(
        new ILPhiInstruction(
          6,
          [
            { value: thenVal, blockId: thenBlock.id },
            { value: elseVal, blockId: elseBlock.id },
          ],
          phiResult,
        ),
      );
      mergeBlock.addInstruction(new ILReturnInstruction(7, phiResult));

      const result = validateFunction(func);

      expect(result.valid).toBe(true);
    });

    it('should detect phi missing predecessor entry', () => {
      const func = new ILFunction('test', [], IL_BYTE);
      const entry = func.getEntryBlock();
      const thenBlock = func.createBlock('then');
      const elseBlock = func.createBlock('else');
      const mergeBlock = func.createBlock('merge');

      // Setup branches
      const cond = createTestRegister(0, IL_BOOL);
      entry.addInstruction(new ILConstInstruction(0, 1, IL_BOOL, cond));
      const thenLabel = createTestLabel('then', thenBlock.id);
      const elseLabel = createTestLabel('else', elseBlock.id);
      entry.addInstruction(new ILBranchInstruction(1, cond, thenLabel, elseLabel));
      entry.linkTo(thenBlock);
      entry.linkTo(elseBlock);

      const thenVal = createTestRegister(1, IL_BYTE);
      thenBlock.addInstruction(new ILConstInstruction(2, 1, IL_BYTE, thenVal));
      const mergeLabel = createTestLabel('merge', mergeBlock.id);
      thenBlock.addInstruction(new ILJumpInstruction(3, mergeLabel));
      thenBlock.linkTo(mergeBlock);

      elseBlock.addInstruction(new ILJumpInstruction(4, mergeLabel));
      elseBlock.linkTo(mergeBlock);

      // Phi missing entry for elseBlock
      const phiResult = createTestRegister(2, IL_BYTE);
      mergeBlock.addInstruction(
        new ILPhiInstruction(5, [{ value: thenVal, blockId: thenBlock.id }], phiResult),
      );
      mergeBlock.addInstruction(new ILReturnInstruction(6, phiResult));

      const result = validateFunction(func);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('missing entry'))).toBe(true);
    });

    it('should detect phi after non-phi instruction', () => {
      const func = new ILFunction('test', [], IL_BYTE);
      const entry = func.getEntryBlock();
      const thenBlock = func.createBlock('then');
      const mergeBlock = func.createBlock('merge');

      const target = createTestLabel('then', thenBlock.id);
      entry.addInstruction(new ILJumpInstruction(0, target));
      entry.linkTo(thenBlock);

      const thenVal = createTestRegister(0, IL_BYTE);
      thenBlock.addInstruction(new ILConstInstruction(1, 1, IL_BYTE, thenVal));
      const mergeLabel = createTestLabel('merge', mergeBlock.id);
      thenBlock.addInstruction(new ILJumpInstruction(2, mergeLabel));
      thenBlock.linkTo(mergeBlock);

      // Phi after non-phi (CONST is added first)
      const constVal = createTestRegister(1, IL_BYTE);
      mergeBlock.addInstruction(new ILConstInstruction(3, 42, IL_BYTE, constVal)); // Non-phi first

      const phiResult = createTestRegister(2, IL_BYTE);
      mergeBlock.addInstruction(
        new ILPhiInstruction(4, [{ value: thenVal, blockId: thenBlock.id }], phiResult),
      );
      mergeBlock.addInstruction(new ILReturnInstruction(5, phiResult));

      const result = validateFunction(func);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('after non-phi'))).toBe(true);
    });
  });

  // ===========================================================================
  // Module Validation Tests
  // ===========================================================================

  describe('module validation', () => {
    it('should validate module with multiple functions', () => {
      const module = new ILModule('test');
      const builder = new ILBuilder(module);

      builder.beginFunction('f1', [], IL_VOID);
      builder.emitReturnVoid();
      builder.endFunction();

      builder.beginFunction('f2', [], IL_VOID);
      builder.emitReturnVoid();
      builder.endFunction();

      const result = validateModule(module);

      expect(result.valid).toBe(true);
    });

    it('should detect missing entry point function', () => {
      const module = new ILModule('test');
      // Force set entry point to non-existent function
      (module as unknown as { entryPointName: string }).entryPointName = 'missing';

      const result = validateModule(module);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('missing'))).toBe(true);
    });

    it('should detect invalid function export', () => {
      const module = new ILModule('test');
      module.createExport('bad', 'nonexistent', 'function');

      const result = validateModule(module);

      expect(result.valid).toBe(false);
    });

    it('should detect invalid variable export', () => {
      const module = new ILModule('test');
      module.createExport('bad', 'nonexistent', 'variable');

      const result = validateModule(module);

      expect(result.valid).toBe(false);
    });
  });

  // ===========================================================================
  // Convenience Function Tests
  // ===========================================================================

  describe('convenience functions', () => {
    it('validateModule should work', () => {
      const module = new ILModule('test');

      const result = validateModule(module);

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('validateFunction should work', () => {
      const func = new ILFunction('test', [], IL_VOID);
      func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const result = validateFunction(func);

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // Error Formatting Tests
  // ===========================================================================

  describe('formatValidationErrors()', () => {
    it('should format errors with location info', () => {
      const func = new ILFunction('test', [], IL_VOID);
      // Missing terminator will create error

      const result = validateFunction(func);
      const formatted = formatValidationErrors(result);

      expect(formatted).toContain('ERROR');
      expect(formatted).toContain('test');
    });

    it('should format warnings', () => {
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();
      func.createBlock('unreachable'); // Creates warning
      entry.addInstruction(new ILReturnVoidInstruction(0));

      const result = validateFunction(func);
      const formatted = formatValidationErrors(result);

      expect(formatted).toContain('WARNING');
    });

    it('should return empty string for valid IL', () => {
      const func = new ILFunction('test', [], IL_VOID);
      func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));

      const result = validateFunction(func);
      const formatted = formatValidationErrors(result);

      expect(formatted).toBe('');
    });
  });

  // ===========================================================================
  // Validator Options Tests
  // ===========================================================================

  describe('validator options', () => {
    it('should skip terminator check when disabled', () => {
      const validator = new ILValidator({ checkTerminators: false });
      const func = new ILFunction('test', [], IL_VOID);
      // No terminator

      const result = validator.validateFunction(func);

      // Should not report terminator error when check is disabled
      expect(result.errors.filter((e) => e.message.includes('terminator'))).toHaveLength(0);
    });

    it('should skip reachability check when disabled', () => {
      const validator = new ILValidator({ checkReachability: false });
      const func = new ILFunction('test', [], IL_VOID);
      func.getEntryBlock().addInstruction(new ILReturnVoidInstruction(0));
      func.createBlock('unreachable');

      const result = validator.validateFunction(func);

      expect(result.warnings.filter((w) => w.message.includes('unreachable'))).toHaveLength(0);
    });

    it('should skip type check when disabled', () => {
      const validator = new ILValidator({ checkTypes: false });
      const func = new ILFunction('test', [], IL_VOID);
      const entry = func.getEntryBlock();

      // Type mismatch that would normally fail
      const byteReg = createTestRegister(0, IL_BYTE);
      const wordReg = createTestRegister(1, IL_WORD);
      const result = createTestRegister(2, IL_BYTE);

      entry.addInstruction(new ILConstInstruction(0, 10, IL_BYTE, byteReg));
      entry.addInstruction(new ILConstInstruction(1, 1000, IL_WORD, wordReg));
      entry.addInstruction(new ILBinaryInstruction(2, ILOpcode.ADD, byteReg, wordReg, result));
      entry.addInstruction(new ILReturnVoidInstruction(3));

      const result2 = validator.validateFunction(func);

      expect(result2.errors.filter((e) => e.message.includes('mismatch'))).toHaveLength(0);
    });
  });
});