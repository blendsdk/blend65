/**
 * IL Builder Tests
 *
 * Tests for ILBuilder class which provides a fluent API for constructing IL instructions.
 *
 * Test Categories:
 * - Module/Function Management: begin/end functions
 * - Block Management: creating and switching blocks
 * - Register Management: creating registers
 * - Constant Instructions: emitConst variants
 * - Arithmetic Instructions: emitAdd, emitSub, etc.
 * - Bitwise Instructions: emitAnd, emitOr, etc.
 * - Comparison Instructions: emitCmpEq, emitCmpLt, etc.
 * - Control Flow: emitJump, emitBranch, emitReturn
 * - Memory Instructions: emitLoad/Store
 * - Call Instructions: emitCall variants
 *
 * @module il/builder.test
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { ILBuilder } from '../../il/builder.js';
import { ILModule } from '../../il/module.js';
import { IL_BYTE, IL_WORD, IL_BOOL, IL_VOID, ILTypeKind } from '../../il/types.js';
import { ILOpcode } from '../../il/instructions.js';

// =============================================================================
// Test Setup
// =============================================================================

describe('ILBuilder', () => {
  let module: ILModule;
  let builder: ILBuilder;

  beforeEach(() => {
    module = new ILModule('test');
    builder = new ILBuilder(module);
  });

  // ===========================================================================
  // Module Access Tests
  // ===========================================================================

  describe('module access', () => {
    it('should return the module', () => {
      expect(builder.getModule()).toBe(module);
    });
  });

  // ===========================================================================
  // Function Management Tests
  // ===========================================================================

  describe('function management - beginFunction()', () => {
    it('should create function in module', () => {
      builder.beginFunction('test', [], IL_VOID);

      expect(module.hasFunction('test')).toBe(true);
    });

    it('should set current function', () => {
      builder.beginFunction('myFunc', [], IL_VOID);

      expect(builder.getCurrentFunction()?.name).toBe('myFunc');
    });

    it('should create function with parameters', () => {
      const func = builder.beginFunction(
        'add',
        [
          { name: 'a', type: IL_BYTE },
          { name: 'b', type: IL_BYTE },
        ],
        IL_BYTE,
      );

      expect(func.parameters).toHaveLength(2);
    });

    it('should set current block to entry', () => {
      builder.beginFunction('test', [], IL_VOID);

      expect(builder.getCurrentBlock()?.label).toBe('entry');
    });

    it('should throw when function already being built', () => {
      builder.beginFunction('first', [], IL_VOID);

      expect(() => {
        builder.beginFunction('second', [], IL_VOID);
      }).toThrow();
    });
  });

  describe('function management - endFunction()', () => {
    it('should return completed function', () => {
      builder.beginFunction('test', [], IL_VOID);

      const func = builder.endFunction();

      expect(func.name).toBe('test');
    });

    it('should clear current function', () => {
      builder.beginFunction('test', [], IL_VOID);
      builder.endFunction();

      expect(builder.getCurrentFunction()).toBeNull();
    });

    it('should clear current block', () => {
      builder.beginFunction('test', [], IL_VOID);
      builder.endFunction();

      expect(builder.getCurrentBlock()).toBeNull();
    });

    it('should throw when no function being built', () => {
      expect(() => {
        builder.endFunction();
      }).toThrow();
    });
  });

  // ===========================================================================
  // Block Management Tests
  // ===========================================================================

  describe('block management', () => {
    it('should create new block', () => {
      builder.beginFunction('test', [], IL_VOID);

      const block = builder.createBlock('loop');

      expect(block.label).toBe('loop');
    });

    it('should set current block', () => {
      builder.beginFunction('test', [], IL_VOID);
      const block = builder.createBlock('other');

      builder.setCurrentBlock(block);

      expect(builder.getCurrentBlock()).toBe(block);
    });

    it('should append block and set as current', () => {
      builder.beginFunction('test', [], IL_VOID);

      const block = builder.appendBlock('newBlock');

      expect(builder.getCurrentBlock()).toBe(block);
    });
  });

  // ===========================================================================
  // Register Management Tests
  // ===========================================================================

  describe('register management', () => {
    it('should create register with type', () => {
      builder.beginFunction('test', [], IL_VOID);

      const reg = builder.createRegister(IL_BYTE);

      expect(reg.type).toBe(IL_BYTE);
    });

    it('should create register with name', () => {
      builder.beginFunction('test', [], IL_VOID);

      const reg = builder.createRegister(IL_WORD, 'address');

      expect(reg.name).toBe('address');
    });

    it('should get parameter register by index', () => {
      builder.beginFunction('test', [{ name: 'x', type: IL_BYTE }], IL_VOID);

      const param = builder.getParameterRegister(0);

      expect(param?.type).toBe(IL_BYTE);
    });

    it('should get parameter register by name', () => {
      builder.beginFunction('test', [{ name: 'value', type: IL_WORD }], IL_VOID);

      const param = builder.getParameterRegisterByName('value');

      expect(param?.type).toBe(IL_WORD);
    });
  });

  // ===========================================================================
  // Constant Instructions Tests
  // ===========================================================================

  describe('constant instructions - emitConstByte()', () => {
    it('should emit byte constant', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitConstByte(42);

      expect(result.type).toBe(IL_BYTE);
    });

    it('should add instruction to current block', () => {
      builder.beginFunction('test', [], IL_VOID);
      builder.emitConstByte(42);

      expect(builder.getCurrentBlock()?.getInstructionCount()).toBe(1);
    });

    it('should emit max byte value', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitConstByte(255);

      expect(result.type.kind).toBe(ILTypeKind.Byte);
    });

    it('should emit zero', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitConstByte(0);

      expect(result).toBeDefined();
    });
  });

  describe('constant instructions - emitConstWord()', () => {
    it('should emit word constant', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitConstWord(1000);

      expect(result.type).toBe(IL_WORD);
    });

    it('should emit max word value', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitConstWord(65535);

      expect(result.type.kind).toBe(ILTypeKind.Word);
    });
  });

  describe('constant instructions - emitConstBool()', () => {
    it('should emit true', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitConstBool(true);

      expect(result.type).toBe(IL_BOOL);
    });

    it('should emit false', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitConstBool(false);

      expect(result.type).toBe(IL_BOOL);
    });
  });

  describe('constant instructions - emitUndef()', () => {
    it('should emit undefined byte', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitUndef(IL_BYTE);

      expect(result.type).toBe(IL_BYTE);
    });

    it('should emit undefined word', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitUndef(IL_WORD);

      expect(result.type).toBe(IL_WORD);
    });
  });

  // ===========================================================================
  // Arithmetic Instructions Tests
  // ===========================================================================

  describe('arithmetic instructions - emitAdd()', () => {
    it('should emit add instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(10);
      const b = builder.emitConstByte(20);

      const result = builder.emitAdd(a, b);

      expect(result.type).toBe(IL_BYTE);
    });

    it('should add instruction to block', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(10);
      const b = builder.emitConstByte(20);
      builder.emitAdd(a, b);

      // 2 consts + 1 add = 3
      expect(builder.getCurrentBlock()?.getInstructionCount()).toBe(3);
    });
  });

  describe('arithmetic instructions - emitSub()', () => {
    it('should emit sub instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(30);
      const b = builder.emitConstByte(10);

      const result = builder.emitSub(a, b);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('arithmetic instructions - emitMul()', () => {
    it('should emit mul instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(5);
      const b = builder.emitConstByte(4);

      const result = builder.emitMul(a, b);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('arithmetic instructions - emitDiv()', () => {
    it('should emit div instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(20);
      const b = builder.emitConstByte(5);

      const result = builder.emitDiv(a, b);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('arithmetic instructions - emitMod()', () => {
    it('should emit mod instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(17);
      const b = builder.emitConstByte(5);

      const result = builder.emitMod(a, b);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('arithmetic instructions - emitNeg()', () => {
    it('should emit neg instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const v = builder.emitConstByte(42);

      const result = builder.emitNeg(v);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  // ===========================================================================
  // Bitwise Instructions Tests
  // ===========================================================================

  describe('bitwise instructions - emitAnd()', () => {
    it('should emit and instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(0x0F);
      const b = builder.emitConstByte(0xFF);

      const result = builder.emitAnd(a, b);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('bitwise instructions - emitOr()', () => {
    it('should emit or instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(0x0F);
      const b = builder.emitConstByte(0xF0);

      const result = builder.emitOr(a, b);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('bitwise instructions - emitXor()', () => {
    it('should emit xor instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(0xFF);
      const b = builder.emitConstByte(0x0F);

      const result = builder.emitXor(a, b);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('bitwise instructions - emitNot()', () => {
    it('should emit not instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const v = builder.emitConstByte(0x0F);

      const result = builder.emitNot(v);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('bitwise instructions - emitShl()', () => {
    it('should emit shl instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const v = builder.emitConstByte(1);
      const s = builder.emitConstByte(4);

      const result = builder.emitShl(v, s);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('bitwise instructions - emitShr()', () => {
    it('should emit shr instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const v = builder.emitConstByte(16);
      const s = builder.emitConstByte(2);

      const result = builder.emitShr(v, s);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  // ===========================================================================
  // Comparison Instructions Tests
  // ===========================================================================

  describe('comparison instructions - emitCmpEq()', () => {
    it('should emit cmp_eq instruction with bool result', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(10);
      const b = builder.emitConstByte(10);

      const result = builder.emitCmpEq(a, b);

      expect(result.type).toBe(IL_BOOL);
    });
  });

  describe('comparison instructions - emitCmpNe()', () => {
    it('should emit cmp_ne instruction with bool result', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(10);
      const b = builder.emitConstByte(20);

      const result = builder.emitCmpNe(a, b);

      expect(result.type).toBe(IL_BOOL);
    });
  });

  describe('comparison instructions - emitCmpLt()', () => {
    it('should emit cmp_lt instruction with bool result', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(5);
      const b = builder.emitConstByte(10);

      const result = builder.emitCmpLt(a, b);

      expect(result.type).toBe(IL_BOOL);
    });
  });

  describe('comparison instructions - emitCmpLe()', () => {
    it('should emit cmp_le instruction with bool result', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(10);
      const b = builder.emitConstByte(10);

      const result = builder.emitCmpLe(a, b);

      expect(result.type).toBe(IL_BOOL);
    });
  });

  describe('comparison instructions - emitCmpGt()', () => {
    it('should emit cmp_gt instruction with bool result', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(20);
      const b = builder.emitConstByte(10);

      const result = builder.emitCmpGt(a, b);

      expect(result.type).toBe(IL_BOOL);
    });
  });

  describe('comparison instructions - emitCmpGe()', () => {
    it('should emit cmp_ge instruction with bool result', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(10);
      const b = builder.emitConstByte(10);

      const result = builder.emitCmpGe(a, b);

      expect(result.type).toBe(IL_BOOL);
    });
  });

  // ===========================================================================
  // Logical Instructions Tests
  // ===========================================================================

  describe('logical instructions - emitLogicalNot()', () => {
    it('should emit logical_not instruction with bool result', () => {
      builder.beginFunction('test', [], IL_VOID);
      const v = builder.emitConstBool(true);

      const result = builder.emitLogicalNot(v);

      expect(result.type).toBe(IL_BOOL);
    });
  });

  // ===========================================================================
  // Type Conversion Tests
  // ===========================================================================

  describe('type conversion - emitZeroExtend()', () => {
    it('should zero extend byte to word', () => {
      builder.beginFunction('test', [], IL_VOID);
      const b = builder.emitConstByte(255);

      const result = builder.emitZeroExtend(b);

      expect(result.type).toBe(IL_WORD);
    });
  });

  describe('type conversion - emitTruncate()', () => {
    it('should truncate word to byte', () => {
      builder.beginFunction('test', [], IL_VOID);
      const w = builder.emitConstWord(0x1234);

      const result = builder.emitTruncate(w);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  // ===========================================================================
  // Control Flow Tests
  // ===========================================================================

  describe('control flow - emitJump()', () => {
    it('should emit jump instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const target = builder.createBlock('target');

      builder.emitJump(target);

      expect(builder.getCurrentBlock()?.hasTerminator()).toBe(true);
    });

    it('should link blocks', () => {
      builder.beginFunction('test', [], IL_VOID);
      const entry = builder.getCurrentBlock()!;
      const target = builder.createBlock('target');

      builder.emitJump(target);

      expect(entry.getSuccessors()).toContain(target);
    });
  });

  describe('control flow - emitBranch()', () => {
    it('should emit branch instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const cond = builder.emitConstBool(true);
      const thenBlock = builder.createBlock('then');
      const elseBlock = builder.createBlock('else');

      builder.emitBranch(cond, thenBlock, elseBlock);

      expect(builder.getCurrentBlock()?.hasTerminator()).toBe(true);
    });

    it('should link to both targets', () => {
      builder.beginFunction('test', [], IL_VOID);
      const entry = builder.getCurrentBlock()!;
      const cond = builder.emitConstBool(true);
      const thenBlock = builder.createBlock('then');
      const elseBlock = builder.createBlock('else');

      builder.emitBranch(cond, thenBlock, elseBlock);

      expect(entry.getSuccessors()).toContain(thenBlock);
      expect(entry.getSuccessors()).toContain(elseBlock);
    });
  });

  describe('control flow - emitReturn()', () => {
    it('should emit return instruction', () => {
      builder.beginFunction('test', [], IL_BYTE);
      const v = builder.emitConstByte(42);

      builder.emitReturn(v);

      expect(builder.getCurrentBlock()?.hasTerminator()).toBe(true);
    });
  });

  describe('control flow - emitReturnVoid()', () => {
    it('should emit return_void instruction', () => {
      builder.beginFunction('test', [], IL_VOID);

      builder.emitReturnVoid();

      expect(builder.getCurrentBlock()?.hasTerminator()).toBe(true);
    });
  });

  // ===========================================================================
  // Memory Instructions Tests
  // ===========================================================================

  describe('memory instructions - emitLoadVar()', () => {
    it('should emit load_var instruction', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitLoadVar('counter', IL_BYTE);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('memory instructions - emitStoreVar()', () => {
    it('should emit store_var instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const v = builder.emitConstByte(42);

      builder.emitStoreVar('counter', v);

      expect(builder.getCurrentBlock()?.getInstructionCount()).toBe(2);
    });
  });

  describe('memory instructions - emitLoadArray()', () => {
    it('should emit load_array instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const idx = builder.emitConstByte(0);

      const result = builder.emitLoadArray('buffer', idx, IL_BYTE);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('memory instructions - emitStoreArray()', () => {
    it('should emit store_array instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const idx = builder.emitConstByte(0);
      const val = builder.emitConstByte(65);

      builder.emitStoreArray('buffer', idx, val);

      expect(builder.getCurrentBlock()?.getInstructionCount()).toBe(3);
    });
  });

  // ===========================================================================
  // Call Instructions Tests
  // ===========================================================================

  describe('call instructions - emitCall()', () => {
    it('should emit call instruction with return value', () => {
      builder.beginFunction('test', [], IL_VOID);
      const arg = builder.emitConstByte(10);

      const result = builder.emitCall('getValue', [arg], IL_BYTE);

      expect(result.type).toBe(IL_BYTE);
    });

    it('should emit call with multiple arguments', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(10);
      const b = builder.emitConstByte(20);

      const result = builder.emitCall('add', [a, b], IL_BYTE);

      expect(result.type).toBe(IL_BYTE);
    });

    it('should emit call with no arguments', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitCall('getTime', [], IL_WORD);

      expect(result.type).toBe(IL_WORD);
    });
  });

  describe('call instructions - emitCallVoid()', () => {
    it('should emit call_void instruction', () => {
      builder.beginFunction('test', [], IL_VOID);

      builder.emitCallVoid('init', []);

      expect(builder.getCurrentBlock()?.getInstructionCount()).toBe(1);
    });

    it('should emit call_void with arguments', () => {
      builder.beginFunction('test', [], IL_VOID);
      const v = builder.emitConstByte(42);

      builder.emitCallVoid('setValue', [v]);

      expect(builder.getCurrentBlock()?.getInstructionCount()).toBe(2);
    });
  });

  // ===========================================================================
  // SSA Instructions Tests
  // ===========================================================================

  describe('SSA instructions - emitPhi()', () => {
    it('should emit phi instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const entry = builder.getCurrentBlock()!;
      const thenBlock = builder.createBlock('then');
      const elseBlock = builder.createBlock('else');
      const mergeBlock = builder.createBlock('merge');

      // Create values in each branch
      builder.setCurrentBlock(thenBlock);
      const thenVal = builder.emitConstByte(1);
      thenBlock.linkTo(mergeBlock);

      builder.setCurrentBlock(elseBlock);
      const elseVal = builder.emitConstByte(2);
      elseBlock.linkTo(mergeBlock);

      // Create phi in merge block
      builder.setCurrentBlock(mergeBlock);
      const result = builder.emitPhi(
        [
          { value: thenVal, blockId: thenBlock.id },
          { value: elseVal, blockId: elseBlock.id },
        ],
        IL_BYTE,
      );

      expect(result.type).toBe(IL_BYTE);
    });
  });

  // ===========================================================================
  // Intrinsic Instructions Tests
  // ===========================================================================

  describe('intrinsic instructions - emitPeek()', () => {
    it('should emit peek instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const addr = builder.emitConstWord(0xD020);

      const result = builder.emitPeek(addr);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('intrinsic instructions - emitPoke()', () => {
    it('should emit poke instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const addr = builder.emitConstWord(0xD020);
      const val = builder.emitConstByte(0);

      builder.emitPoke(addr, val);

      expect(builder.getCurrentBlock()?.getInstructionCount()).toBe(3);
    });
  });

  // ===========================================================================
  // Hardware Instructions Tests
  // ===========================================================================

  describe('hardware instructions - emitHardwareRead()', () => {
    it('should emit hardware_read instruction', () => {
      builder.beginFunction('test', [], IL_VOID);

      const result = builder.emitHardwareRead(0xD020);

      expect(result.type).toBe(IL_BYTE);
    });
  });

  describe('hardware instructions - emitHardwareWrite()', () => {
    it('should emit hardware_write instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const val = builder.emitConstByte(0);

      builder.emitHardwareWrite(0xD020, val);

      expect(builder.getCurrentBlock()?.getInstructionCount()).toBe(2);
    });
  });

  // ===========================================================================
  // Optimization Control Tests
  // ===========================================================================

  describe('optimization control - emitOptBarrier()', () => {
    it('should emit opt_barrier instruction', () => {
      builder.beginFunction('test', [], IL_VOID);

      builder.emitOptBarrier();

      expect(builder.getCurrentBlock()?.getInstructionCount()).toBe(1);
    });
  });

  // ===========================================================================
  // Metadata Tests
  // ===========================================================================

  describe('metadata', () => {
    it('should pass metadata to constant instruction', () => {
      builder.beginFunction('test', [], IL_VOID);

      builder.emitConstByte(42, { sourceLocation: { line: 1, column: 1 } });

      const block = builder.getCurrentBlock()!;
      const inst = block.getInstructions()[0];
      expect(inst.metadata?.sourceLocation).toBeDefined();
    });

    it('should pass metadata to binary instruction', () => {
      builder.beginFunction('test', [], IL_VOID);
      const a = builder.emitConstByte(10);
      const b = builder.emitConstByte(20);

      builder.emitAdd(a, b, { comment: 'addition' });

      const block = builder.getCurrentBlock()!;
      const addInst = block.getInstructions()[2];
      expect(addInst.metadata?.comment).toBe('addition');
    });
  });

  // ===========================================================================
  // Integration Tests
  // ===========================================================================

  describe('integration - complete function building', () => {
    it('should build complete add function', () => {
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
      const result = builder.emitAdd(a, b);
      builder.emitReturn(result);

      const func = builder.endFunction();

      expect(func.name).toBe('add');
      expect(func.getInstructionCount()).toBe(2); // add + return
    });

    it('should build function with conditional', () => {
      builder.beginFunction('abs', [{ name: 'x', type: IL_BYTE }], IL_BYTE);

      const x = builder.getParameterRegister(0)!;
      const zero = builder.emitConstByte(0);
      const isNegative = builder.emitCmpLt(x, zero);

      const thenBlock = builder.createBlock('negative');
      const elseBlock = builder.createBlock('positive');
      const mergeBlock = builder.createBlock('merge');

      builder.emitBranch(isNegative, thenBlock, elseBlock);

      builder.setCurrentBlock(thenBlock);
      const negated = builder.emitNeg(x);
      builder.emitJump(mergeBlock);

      builder.setCurrentBlock(elseBlock);
      builder.emitJump(mergeBlock);

      builder.setCurrentBlock(mergeBlock);
      const result = builder.emitPhi(
        [
          { value: negated, blockId: thenBlock.id },
          { value: x, blockId: elseBlock.id },
        ],
        IL_BYTE,
      );
      builder.emitReturn(result);

      const func = builder.endFunction();

      expect(func.getBlockCount()).toBe(4);
    });
  });
});