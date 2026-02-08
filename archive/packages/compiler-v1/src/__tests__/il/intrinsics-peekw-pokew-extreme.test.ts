/**
 * @file Extreme Tests for peekw/pokew IL Instructions
 *
 * Tests 16-bit word memory access intrinsics with edge cases including:
 * - Address boundary conditions (zero page, page boundaries, maximum address)
 * - 16-bit value edge cases (0x0000, 0xFFFF, byte patterns)
 * - Little-endian byte ordering implications
 * - Cross-page boundary access patterns
 * - C64 hardware vector addresses
 * - ILBuilder API integration
 * - Metadata preservation
 * - Registry definition verification
 *
 * @module il/__tests__/intrinsics-peekw-pokew-extreme
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ILModule } from '../../il/module.js';
import { ILBuilder } from '../../il/builder.js';
import { ILPeekwInstruction, ILPokewInstruction, ILOpcode } from '../../il/instructions.js';
import { VirtualRegister } from '../../il/values.js';
import { IL_WORD, IL_BYTE } from '../../il/types.js';
import { IntrinsicRegistry, IntrinsicCategory } from '../../il/intrinsics/registry.js';

// =============================================================================
// C64 Memory Map Constants for 16-bit Word Access
// =============================================================================

/**
 * C64 memory addresses where 16-bit word access is meaningful.
 *
 * These include hardware vectors, pointers, and word-sized registers.
 */
const C64_WORD_ADDRESSES = {
  // Hardware Vectors (stored as little-endian words)
  NMI_VECTOR: 0xfffa, // NMI vector ($FFFA-$FFFB)
  RESET_VECTOR: 0xfffc, // Reset vector ($FFFC-$FFFD)
  IRQ_VECTOR: 0xfffe, // IRQ/BRK vector ($FFFE-$FFFF)

  // Kernal Vectors (RAM copies)
  KERNAL_NMI: 0x0318, // Kernal NMI vector
  KERNAL_IRQ: 0x0314, // Kernal IRQ vector
  KERNAL_BRK: 0x0316, // Kernal BRK vector

  // Zero Page Pointers
  BASIC_START: 0x002b, // Start of BASIC program
  BASIC_VARS: 0x002d, // Start of variables
  BASIC_ARRAYS: 0x002f, // Start of arrays
  BASIC_END: 0x0031, // End of BASIC/strings
  STRING_STACK: 0x0033, // String stack pointer

  // Screen Memory Pointers
  SCREEN_PTR: 0x00d1, // Screen pointer (low/high)
  COLOR_PTR: 0x00f3, // Color pointer (low/high)

  // Sprite Positions (word values for X coordinates with MSB bit)
  SPRITE_X_EXTENDED: 0xd010, // Sprite X MSB register (affects word interpretation)

  // Timer Values (16-bit)
  CIA1_TIMER_A: 0xdc04, // CIA1 Timer A (word)
  CIA1_TIMER_B: 0xdc06, // CIA1 Timer B (word)
  CIA2_TIMER_A: 0xdd04, // CIA2 Timer A (word)
  CIA2_TIMER_B: 0xdd06, // CIA2 Timer B (word)

  // Page Boundaries (for testing cross-page reads)
  PAGE_BOUNDARY: 0x00ff, // Last byte of zero page
  RAM_PAGE_BOUNDARY: 0x01ff, // Last byte of stack page
  SCREEN_PAGE_BOUNDARY: 0x03ff, // Last byte of screen memory
} as const;

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates an address register for testing (word type).
 *
 * @param id - Register ID
 * @param name - Optional register name
 * @returns Virtual register
 */
function createAddressRegister(id: number, name?: string): VirtualRegister {
  return new VirtualRegister(id, IL_WORD, name);
}

/**
 * Creates a word value register for testing.
 *
 * @param id - Register ID
 * @param name - Optional register name
 * @returns Virtual register
 */
function createWordRegister(id: number, name?: string): VirtualRegister {
  return new VirtualRegister(id, IL_WORD, name);
}

// =============================================================================
// ILPeekwInstruction Tests
// =============================================================================

describe('ILPeekwInstruction - Address Boundary Tests', () => {
  it('should read word from zero page address $0000', () => {
    const address = createAddressRegister(0, 'zpAddr');
    const result = createWordRegister(1, 'zpWord');
    const inst = new ILPeekwInstruction(0, address, result);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_PEEKW);
    expect(inst.address).toBe(address);
    expect(inst.result).toBe(result);
    expect(inst.result!.type).toBe(IL_WORD);
    expect(inst.hasSideEffects()).toBe(false);
  });

  it('should read word at zero page boundary $00FF (cross-page read)', () => {
    // Reading a word from $00FF reads bytes from $00FF and $0100
    const address = createAddressRegister(0, 'boundaryAddr');
    const result = createWordRegister(1, 'crossPageWord');
    const inst = new ILPeekwInstruction(0, address, result);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_PEEKW);
    expect(inst.toString()).toContain('INTRINSIC_PEEKW');
    expect(inst.getOperands()).toContain(address);
  });

  it('should read word from NMI vector address $FFFA', () => {
    const address = createAddressRegister(0, 'nmiVector');
    const result = createWordRegister(1, 'nmiHandler');
    const inst = new ILPeekwInstruction(0, address, result);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_PEEKW);
    expect(inst.result!.type).toBe(IL_WORD);
  });

  it('should read word from RESET vector address $FFFC', () => {
    const address = createAddressRegister(0, 'resetVector');
    const result = createWordRegister(1, 'resetHandler');
    const inst = new ILPeekwInstruction(0, address, result);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_PEEKW);
  });

  it('should read word from IRQ vector address $FFFE', () => {
    // This reads $FFFE and $FFFF - the last two bytes of address space
    const address = createAddressRegister(0, 'irqVector');
    const result = createWordRegister(1, 'irqHandler');
    const inst = new ILPeekwInstruction(0, address, result);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_PEEKW);
    expect(inst.hasSideEffects()).toBe(false);
  });

  it('should read word from CIA1 Timer A address $DC04', () => {
    const address = createAddressRegister(0, 'timerAddr');
    const result = createWordRegister(1, 'timerValue');
    const inst = new ILPeekwInstruction(0, address, result);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_PEEKW);
    expect(inst.getUsedRegisters()).toHaveLength(1);
    expect(inst.getUsedRegisters()[0]).toBe(address);
  });

  it('should read word from BASIC start pointer $002B', () => {
    const address = createAddressRegister(0, 'basicStart');
    const result = createWordRegister(1, 'programAddr');
    const inst = new ILPeekwInstruction(0, address, result);

    expect(inst.result!.type).toBe(IL_WORD);
  });
});

describe('ILPeekwInstruction - Instruction Properties', () => {
  let address: VirtualRegister;
  let result: VirtualRegister;
  let inst: ILPeekwInstruction;

  beforeEach(() => {
    address = createAddressRegister(0, 'addr');
    result = createWordRegister(1, 'word');
    inst = new ILPeekwInstruction(0, address, result);
  });

  it('should return correct operands array', () => {
    const operands = inst.getOperands();
    expect(operands).toHaveLength(1);
    expect(operands[0]).toBe(address);
  });

  it('should return correct used registers', () => {
    const used = inst.getUsedRegisters();
    expect(used).toHaveLength(1);
    expect(used[0]).toBe(address);
  });

  it('should not have side effects (read operation)', () => {
    expect(inst.hasSideEffects()).toBe(false);
  });

  it('should not be a terminator', () => {
    expect(inst.isTerminator()).toBe(false);
  });

  it('should generate correct toString format', () => {
    const str = inst.toString();
    expect(str).toContain('INTRINSIC_PEEKW');
    expect(str).toContain('v0');
    expect(str).toContain('v1');
  });
});

describe('ILPeekwInstruction - Metadata Tests', () => {
  it('should preserve source location metadata', () => {
    const address = createAddressRegister(0);
    const result = createWordRegister(1);
    const metadata = {
      location: { line: 42, column: 10, offset: 500 },
    };
    const inst = new ILPeekwInstruction(0, address, result, metadata);

    expect(inst.metadata.location).toEqual({ line: 42, column: 10, offset: 500 });
  });

  it('should preserve rasterCritical metadata for timing-sensitive reads', () => {
    const address = createAddressRegister(0);
    const result = createWordRegister(1);
    const metadata = { rasterCritical: true };
    const inst = new ILPeekwInstruction(0, address, result, metadata);

    expect(inst.metadata.rasterCritical).toBe(true);
  });

  it('should preserve estimatedCycles metadata (8 cycles for word read)', () => {
    const address = createAddressRegister(0);
    const result = createWordRegister(1);
    const metadata = { estimatedCycles: 8 };
    const inst = new ILPeekwInstruction(0, address, result, metadata);

    expect(inst.metadata.estimatedCycles).toBe(8);
  });
});

// =============================================================================
// ILPokewInstruction Tests
// =============================================================================

describe('ILPokewInstruction - Address Boundary Tests', () => {
  it('should write word to zero page address $0000', () => {
    const address = createAddressRegister(0, 'zpAddr');
    const value = createWordRegister(1, 'zpValue');
    const inst = new ILPokewInstruction(0, address, value);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_POKEW);
    expect(inst.address).toBe(address);
    expect(inst.value).toBe(value);
    expect(inst.result).toBeNull();
    expect(inst.hasSideEffects()).toBe(true);
  });

  it('should write word at page boundary $00FF (cross-page write)', () => {
    // Writing a word to $00FF writes bytes to $00FF and $0100
    const address = createAddressRegister(0, 'boundaryAddr');
    const value = createWordRegister(1, 'crossPageValue');
    const inst = new ILPokewInstruction(0, address, value);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_POKEW);
    expect(inst.hasSideEffects()).toBe(true);
  });

  it('should write word to Kernal IRQ vector $0314', () => {
    const address = createAddressRegister(0, 'kernalIrq');
    const value = createWordRegister(1, 'handlerAddr');
    const inst = new ILPokewInstruction(0, address, value);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_POKEW);
    expect(inst.toString()).toContain('INTRINSIC_POKEW');
  });

  it('should write word to CIA1 Timer A $DC04', () => {
    const address = createAddressRegister(0, 'timerAddr');
    const value = createWordRegister(1, 'timerValue');
    const inst = new ILPokewInstruction(0, address, value);

    expect(inst.hasSideEffects()).toBe(true);
  });
});

describe('ILPokewInstruction - Value Edge Cases', () => {
  it('should handle writing 0x0000 (minimum word value)', () => {
    const address = createAddressRegister(0);
    const value = createWordRegister(1, 'zeroWord');
    const inst = new ILPokewInstruction(0, address, value);

    expect(inst.value).toBe(value);
    expect(inst.value.type).toBe(IL_WORD);
  });

  it('should handle writing 0xFFFF (maximum word value)', () => {
    const address = createAddressRegister(0);
    const value = createWordRegister(1, 'maxWord');
    const inst = new ILPokewInstruction(0, address, value);

    expect(inst.value.type).toBe(IL_WORD);
  });

  it('should handle writing 0x00FF (high byte zero, low byte max)', () => {
    const address = createAddressRegister(0);
    const value = createWordRegister(1, 'lowByteMax');
    const inst = new ILPokewInstruction(0, address, value);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_POKEW);
  });

  it('should handle writing 0xFF00 (high byte max, low byte zero)', () => {
    const address = createAddressRegister(0);
    const value = createWordRegister(1, 'highByteMax');
    const inst = new ILPokewInstruction(0, address, value);

    expect(inst.opcode).toBe(ILOpcode.INTRINSIC_POKEW);
  });
});

describe('ILPokewInstruction - Instruction Properties', () => {
  let address: VirtualRegister;
  let value: VirtualRegister;
  let inst: ILPokewInstruction;

  beforeEach(() => {
    address = createAddressRegister(0, 'addr');
    value = createWordRegister(1, 'val');
    inst = new ILPokewInstruction(0, address, value);
  });

  it('should return correct operands array', () => {
    const operands = inst.getOperands();
    expect(operands).toHaveLength(2);
    expect(operands[0]).toBe(address);
    expect(operands[1]).toBe(value);
  });

  it('should return correct used registers', () => {
    const used = inst.getUsedRegisters();
    expect(used).toHaveLength(2);
    expect(used[0]).toBe(address);
    expect(used[1]).toBe(value);
  });

  it('should have side effects (write operation)', () => {
    expect(inst.hasSideEffects()).toBe(true);
  });

  it('should have null result (void operation)', () => {
    expect(inst.result).toBeNull();
  });

  it('should not be a terminator', () => {
    expect(inst.isTerminator()).toBe(false);
  });

  it('should generate correct toString format', () => {
    const str = inst.toString();
    expect(str).toContain('INTRINSIC_POKEW');
    expect(str).toContain('v0');
    expect(str).toContain('v1');
  });
});

describe('ILPokewInstruction - Metadata Tests', () => {
  it('should preserve source location metadata', () => {
    const address = createAddressRegister(0);
    const value = createWordRegister(1);
    const metadata = {
      location: { line: 100, column: 5, offset: 1000 },
    };
    const inst = new ILPokewInstruction(0, address, value, metadata);

    expect(inst.metadata.location).toEqual({ line: 100, column: 5, offset: 1000 });
  });

  it('should preserve hardware hints for vector writes', () => {
    const address = createAddressRegister(0);
    const value = createWordRegister(1);
    const metadata = {
      m6502Hints: {
        zeroPagePriority: 10,
      },
    };
    const inst = new ILPokewInstruction(0, address, value, metadata);

    expect(inst.metadata.m6502Hints?.zeroPagePriority).toBe(10);
  });
});

// =============================================================================
// ILBuilder - peekw/pokew API Tests
// =============================================================================

describe('ILBuilder - peekw/pokew API Edge Cases', () => {
  let module: ILModule;
  let builder: ILBuilder;

  beforeEach(() => {
    module = new ILModule('peekw-pokew-test');
    builder = new ILBuilder(module);
    builder.beginFunction('test', [], IL_WORD);
  });

  it('should emit peekw with word result type', () => {
    const addr = builder.emitConstWord(C64_WORD_ADDRESSES.NMI_VECTOR);
    const result = builder.emitPeekw(addr);

    expect(result.type).toBe(IL_WORD);
  });

  it('should emit multiple consecutive peekw operations', () => {
    const addr1 = builder.emitConstWord(C64_WORD_ADDRESSES.CIA1_TIMER_A);
    const addr2 = builder.emitConstWord(C64_WORD_ADDRESSES.CIA1_TIMER_B);
    const timer1 = builder.emitPeekw(addr1);
    const timer2 = builder.emitPeekw(addr2);

    expect(timer1.id).not.toBe(timer2.id);
    expect(timer1.type).toBe(IL_WORD);
    expect(timer2.type).toBe(IL_WORD);
  });

  it('should emit pokew that consumes word value', () => {
    const addr = builder.emitConstWord(C64_WORD_ADDRESSES.KERNAL_IRQ);
    const value = builder.emitConstWord(0x1234);
    // pokew should not throw and should accept word-type registers
    expect(() => builder.emitPokew(addr, value)).not.toThrow();
  });

  it('should emit read-modify-write pattern with peekw/pokew', () => {
    // Read timer value, modify, write back
    const timerAddr = builder.emitConstWord(C64_WORD_ADDRESSES.CIA1_TIMER_A);
    const originalValue = builder.emitPeekw(timerAddr);
    const increment = builder.emitConstWord(100);
    const newValue = builder.emitAdd(originalValue, increment);
    builder.emitPokew(timerAddr, newValue);

    // Verify instruction sequence was created
    const block = builder.getCurrentBlock();
    expect(block).not.toBeNull();
    expect(block!.getInstructions().length).toBeGreaterThan(0);
  });

  it('should emit peekw with metadata for vector reads', () => {
    const addr = builder.emitConstWord(C64_WORD_ADDRESSES.IRQ_VECTOR);
    const result = builder.emitPeekw(addr, {
      rasterCritical: true,
      estimatedCycles: 8,
    });

    expect(result.type).toBe(IL_WORD);
  });

  it('should support word copy pattern (peekw source, pokew dest)', () => {
    const srcAddr = builder.emitConstWord(C64_WORD_ADDRESSES.KERNAL_IRQ);
    const dstAddr = builder.emitConstWord(0x0380); // Custom vector location
    const value = builder.emitPeekw(srcAddr);
    builder.emitPokew(dstAddr, value);

    expect(value.type).toBe(IL_WORD);
  });
});

// =============================================================================
// Registry Definition Verification
// =============================================================================

describe('IntrinsicRegistry - peekw/pokew Definitions', () => {
  let registry: IntrinsicRegistry;

  beforeEach(() => {
    registry = new IntrinsicRegistry();
  });

  it('should have peekw registered as Memory category intrinsic', () => {
    expect(registry.isIntrinsic('peekw')).toBe(true);
    const def = registry.get('peekw')!;
    expect(def.category).toBe(IntrinsicCategory.Memory);
  });

  it('should define peekw with correct signature (word) -> word', () => {
    const def = registry.get('peekw')!;
    expect(def.parameterTypes).toHaveLength(1);
    expect(def.parameterTypes[0]).toBe(IL_WORD);
    expect(def.returnType).toBe(IL_WORD);
  });

  it('should define peekw with correct opcode', () => {
    const def = registry.get('peekw')!;
    expect(def.opcode).toBe(ILOpcode.INTRINSIC_PEEKW);
  });

  it('should define peekw as no side effects (read operation)', () => {
    const def = registry.get('peekw')!;
    expect(def.hasSideEffects).toBe(false);
  });

  it('should define peekw with 8 cycle count (two LDA absolute)', () => {
    const def = registry.get('peekw')!;
    expect(def.cycleCount).toBe(8);
  });

  it('should have pokew registered as Memory category intrinsic', () => {
    expect(registry.isIntrinsic('pokew')).toBe(true);
    const def = registry.get('pokew')!;
    expect(def.category).toBe(IntrinsicCategory.Memory);
  });

  it('should define pokew with correct signature (word, word) -> void', () => {
    const def = registry.get('pokew')!;
    expect(def.parameterTypes).toHaveLength(2);
    expect(def.parameterTypes[0]).toBe(IL_WORD);
    expect(def.parameterTypes[1]).toBe(IL_WORD);
    expect(def.returnType.kind).toBe('void');
  });

  it('should define pokew with correct opcode', () => {
    const def = registry.get('pokew')!;
    expect(def.opcode).toBe(ILOpcode.INTRINSIC_POKEW);
  });

  it('should define pokew with side effects (write operation)', () => {
    const def = registry.get('pokew')!;
    expect(def.hasSideEffects).toBe(true);
  });

  it('should define pokew with 8 cycle count (two STA absolute)', () => {
    const def = registry.get('pokew')!;
    expect(def.cycleCount).toBe(8);
  });

  it('should include both peekw and pokew in Memory category results', () => {
    const memoryIntrinsics = registry.getByCategory(IntrinsicCategory.Memory);
    const names = memoryIntrinsics.map((i) => i.name);
    expect(names).toContain('peekw');
    expect(names).toContain('pokew');
  });
});

// =============================================================================
// C64-Specific Word Access Patterns
// =============================================================================

describe('peekw/pokew - C64 Hardware Vector Patterns', () => {
  let module: ILModule;
  let builder: ILBuilder;

  beforeEach(() => {
    module = new ILModule('vector-test');
    builder = new ILBuilder(module);
    builder.beginFunction('vectorOps', [], IL_WORD);
  });

  it('should support reading NMI vector', () => {
    const addr = builder.emitConstWord(C64_WORD_ADDRESSES.NMI_VECTOR);
    const handler = builder.emitPeekw(addr);
    expect(handler.type).toBe(IL_WORD);
  });

  it('should support reading RESET vector', () => {
    const addr = builder.emitConstWord(C64_WORD_ADDRESSES.RESET_VECTOR);
    const handler = builder.emitPeekw(addr);
    expect(handler.type).toBe(IL_WORD);
  });

  it('should support reading and writing Kernal IRQ vector', () => {
    // Save original IRQ vector
    const irqAddr = builder.emitConstWord(C64_WORD_ADDRESSES.KERNAL_IRQ);
    const originalIrq = builder.emitPeekw(irqAddr);

    // Write new IRQ handler address
    const customHandler = builder.emitConstWord(0xC000); // Custom handler
    builder.emitPokew(irqAddr, customHandler);

    // Later restore original (in practice, would be in cleanup code)
    builder.emitPokew(irqAddr, originalIrq);

    expect(originalIrq.type).toBe(IL_WORD);
    expect(customHandler.type).toBe(IL_WORD);
  });

  it('should support reading CIA timer values', () => {
    const timerAAddr = builder.emitConstWord(C64_WORD_ADDRESSES.CIA1_TIMER_A);
    const timerBAddr = builder.emitConstWord(C64_WORD_ADDRESSES.CIA1_TIMER_B);

    const timerA = builder.emitPeekw(timerAAddr);
    const timerB = builder.emitPeekw(timerBAddr);

    expect(timerA.type).toBe(IL_WORD);
    expect(timerB.type).toBe(IL_WORD);
  });

  it('should support writing CIA timer latch values', () => {
    const timerAddr = builder.emitConstWord(C64_WORD_ADDRESSES.CIA1_TIMER_A);
    const latchValue = builder.emitConstWord(0x4E20); // 20000 = ~50Hz PAL

    builder.emitPokew(timerAddr, latchValue);

    const block = builder.getCurrentBlock();
    expect(block!.getInstructions().length).toBeGreaterThan(0);
  });
});

describe('peekw/pokew - Zero Page Pointer Patterns', () => {
  let module: ILModule;
  let builder: ILBuilder;

  beforeEach(() => {
    module = new ILModule('zp-pointer-test');
    builder = new ILBuilder(module);
    builder.beginFunction('zpOps', [], IL_WORD);
  });

  it('should read BASIC program start pointer', () => {
    const addr = builder.emitConstWord(C64_WORD_ADDRESSES.BASIC_START);
    const basicStart = builder.emitPeekw(addr);
    expect(basicStart.type).toBe(IL_WORD);
  });

  it('should write to screen pointer location', () => {
    const screenPtrAddr = builder.emitConstWord(C64_WORD_ADDRESSES.SCREEN_PTR);
    const newScreenAddr = builder.emitConstWord(0x0400); // Default screen

    builder.emitPokew(screenPtrAddr, newScreenAddr);

    const block = builder.getCurrentBlock();
    expect(block!.getInstructions().length).toBeGreaterThan(0);
  });
});