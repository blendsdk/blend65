/**
 * Integration Test Helpers for Code Generator
 *
 * Provides utilities for building complete IL programs and inspecting
 * the generated ASM-IL output. Unlike unit tests that test individual
 * generator layers, integration tests use the real CodeGenerator class
 * with real IL programs containing multi-instruction sequences.
 *
 * @module __tests__/codegen/integration/_helpers
 */

import { ILOpcode } from '../../../il/enums.js';
import { ILInstruction } from '../../../il/instruction.js';
import {
  ILOperand,
  SlotOperand,
  ImmediateOperand,
  LabelOperand,
  FunctionOperand,
  AddressOperand,
} from '../../../il/operands.js';
import { AddressingModeHint } from '../../../il/enums.js';
import { ILFunction, ILProgram } from '../../../il/structures.js';
import { createFrameSlot, FrameSlot } from '../../../frame/types.js';
import { SlotKind, SlotLocation } from '../../../frame/enums.js';
import { BUILTIN_TYPES } from '../../../semantic/types.js';
import { createFrame } from '../../../frame/allocator/frame-calculator.js';
import { CodeGenerator } from '../../../codegen/generator/generator.js';
import {
  AsmILProgram,
  AsmILElement,
  AsmILSection,
  isInstructionElement,
  isLabelElement,
  isCommentElement,
} from '../../../codegen/asm-il/types.js';

// ============================================================================
// Frame Slot Factories
// ============================================================================

/**
 * Creates a zero page byte slot for testing.
 *
 * @param name - Slot name
 * @param address - ZP address (0x00-0xFF)
 * @returns FrameSlot configured for zero page
 */
export function zpSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE, {
    location: SlotLocation.ZeroPage,
    address,
  });
}

/**
 * Creates an absolute byte slot for testing.
 *
 * @param name - Slot name
 * @param address - Absolute address (typically 0x0200+)
 * @returns FrameSlot configured for frame region
 */
export function absSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.BYTE, {
    location: SlotLocation.FrameRegion,
    address,
  });
}

/**
 * Creates a zero page word slot for testing.
 *
 * @param name - Slot name
 * @param address - ZP address
 * @returns FrameSlot configured for word in zero page
 */
export function zpWordSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.WORD, {
    location: SlotLocation.ZeroPage,
    address,
  });
}

/**
 * Creates an absolute word slot for testing.
 *
 * @param name - Slot name
 * @param address - Absolute address
 * @returns FrameSlot configured for word in frame region
 */
export function absWordSlot(name: string, address: number): FrameSlot {
  return createFrameSlot(name, SlotKind.Local, BUILTIN_TYPES.WORD, {
    location: SlotLocation.FrameRegion,
    address,
  });
}

/**
 * Creates a parameter byte slot for testing.
 *
 * @param name - Parameter name
 * @param address - Address
 * @param zeroPage - Whether in zero page
 * @returns FrameSlot configured as parameter
 */
export function paramSlot(name: string, address: number, zeroPage: boolean = false): FrameSlot {
  return createFrameSlot(name, SlotKind.Parameter, BUILTIN_TYPES.BYTE, {
    location: zeroPage ? SlotLocation.ZeroPage : SlotLocation.FrameRegion,
    address,
  });
}

// ============================================================================
// Operand Factories
// ============================================================================

/**
 * Creates a slot operand from a FrameSlot.
 *
 * @param slot - Frame slot to reference
 * @returns SlotOperand with auto-computed addressing hint
 */
export function slotOp(slot: FrameSlot): SlotOperand {
  return {
    kind: 'slot',
    slot,
    addressingHint:
      slot.location === SlotLocation.ZeroPage
        ? AddressingModeHint.ZeroPage
        : AddressingModeHint.Absolute,
  };
}

/**
 * Creates an immediate byte operand.
 *
 * @param value - Immediate value (0-255)
 * @returns ImmediateOperand
 */
export function immOp(value: number): ImmediateOperand {
  return { kind: 'immediate', value, isWord: false };
}

/**
 * Creates an immediate word operand.
 *
 * @param value - Immediate word value (0-65535)
 * @returns ImmediateOperand
 */
export function immWordOp(value: number): ImmediateOperand {
  return { kind: 'immediate', value, isWord: true };
}

/**
 * Creates a label operand.
 *
 * @param name - Label name
 * @returns LabelOperand
 */
export function labelOp(name: string): LabelOperand {
  return { kind: 'label', name };
}

/**
 * Creates a function operand.
 *
 * @param name - Function name
 * @returns FunctionOperand
 */
export function funcOp(name: string): FunctionOperand {
  return { kind: 'function', name, isCallback: false, coalesceGroup: -1 };
}

/**
 * Creates an address operand with auto ZP detection.
 *
 * @param address - Memory address
 * @returns AddressOperand
 */
export function addrOp(address: number): AddressOperand {
  return { kind: 'address', address, isZeroPage: address < 0x100 };
}

// ============================================================================
// IL Instruction Factory
// ============================================================================

/**
 * Creates an IL instruction with the given opcode and operands.
 *
 * @param opcode - IL opcode
 * @param operands - Instruction operands
 * @param comment - Optional instruction comment
 * @returns ILInstruction
 */
export function instr(
  opcode: ILOpcode,
  operands: ILOperand[] = [],
  comment?: string
): ILInstruction {
  return { opcode, operands, comment };
}

// ============================================================================
// IL Program Builder
// ============================================================================

/**
 * Builds a minimal IL program with one function for integration testing.
 *
 * Creates a well-formed ILProgram with a single function containing
 * the provided instructions and frame slots.
 *
 * @param funcName - Function name (default: 'main')
 * @param instructions - IL instructions for the function
 * @param slots - Frame slots for the function
 * @param options - Additional program options
 * @returns Complete ILProgram ready for code generation
 */
export function buildProgram(
  funcName: string,
  instructions: ILInstruction[],
  slots: FrameSlot[],
  options?: {
    moduleName?: string;
    isExported?: boolean;
    globalInit?: ILInstruction[];
  }
): ILProgram {
  const frame = createFrame(funcName, {
    slots,
    totalSize: slots.reduce((sum, s) => sum + s.size, 0),
    isExported: options?.isExported ?? false,
    isCallback: false,
  });

  const func: ILFunction = {
    name: funcName,
    frame,
    instructions,
    isExported: options?.isExported ?? false,
    isCallback: false,
    loops: [],
    maxLoopDepth: 0,
  };

  return {
    moduleName: options?.moduleName ?? 'test',
    functions: [func],
    globalInit: options?.globalInit ?? [],
    entryPoint: funcName,
    instructionCount: instructions.length,
    totalEstimatedCycles: 0,
  };
}

/**
 * Builds an IL program with multiple functions.
 *
 * @param funcs - Array of function definitions
 * @param options - Program-level options
 * @returns Complete ILProgram
 */
export function buildMultiFuncProgram(
  funcs: Array<{
    name: string;
    instructions: ILInstruction[];
    slots: FrameSlot[];
    isExported?: boolean;
  }>,
  options?: {
    moduleName?: string;
    globalInit?: ILInstruction[];
  }
): ILProgram {
  const functions: ILFunction[] = funcs.map((f) => {
    const frame = createFrame(f.name, {
      slots: f.slots,
      totalSize: f.slots.reduce((sum, s) => sum + s.size, 0),
      isExported: f.isExported ?? false,
      isCallback: false,
    });

    return {
      name: f.name,
      frame,
      instructions: f.instructions,
      isExported: f.isExported ?? false,
      isCallback: false,
      loops: [],
      maxLoopDepth: 0,
    };
  });

  const totalInstructions = funcs.reduce((sum, f) => sum + f.instructions.length, 0);

  return {
    moduleName: options?.moduleName ?? 'test',
    functions,
    globalInit: options?.globalInit ?? [],
    entryPoint: funcs[0]?.name ?? 'main',
    instructionCount: totalInstructions,
    totalEstimatedCycles: 0,
  };
}

// ============================================================================
// Code Generation Helper
// ============================================================================

/**
 * Generates ASM-IL from an IL program using the real CodeGenerator.
 *
 * @param program - IL program to generate from
 * @returns Generated AsmILProgram
 */
export function generate(program: ILProgram): AsmILProgram {
  const generator = new CodeGenerator();
  return generator.generate(program);
}

// ============================================================================
// Output Inspection Helpers
// ============================================================================

/**
 * Flattens all elements from all sections into one array.
 *
 * @param program - Generated ASM-IL program
 * @returns All elements from all sections
 */
export function allElements(program: AsmILProgram): AsmILElement[] {
  return program.sections.flatMap((s: AsmILSection) => s.elements);
}

/**
 * Gets only instruction elements from generated output.
 *
 * @param program - Generated ASM-IL program
 * @returns Only instruction elements
 */
export function allInstructions(program: AsmILProgram): AsmILElement[] {
  return allElements(program).filter(isInstructionElement);
}

/**
 * Gets instruction mnemonics as a simple string array.
 * Useful for pattern matching in assertions.
 *
 * @param program - Generated ASM-IL program
 * @returns Array of mnemonic strings (e.g., ['LDA', 'CLC', 'ADC', 'STA'])
 */
export function mnemonics(program: AsmILProgram): string[] {
  return allInstructions(program).map((e) => {
    if (isInstructionElement(e)) {
      return e.instruction.mnemonic;
    }
    return '';
  });
}

/**
 * Gets label names from generated output.
 *
 * @param program - Generated ASM-IL program
 * @returns Array of label names
 */
export function labelNames(program: AsmILProgram): string[] {
  return allElements(program)
    .filter(isLabelElement)
    .map((e) => {
      if (isLabelElement(e)) {
        return e.label.name;
      }
      return '';
    });
}

/**
 * Finds all instruction elements with a specific mnemonic.
 *
 * @param program - Generated ASM-IL program
 * @param mnemonic - Mnemonic to search for (e.g., 'LDA', 'STA')
 * @returns Matching instruction elements
 */
export function findMnemonic(program: AsmILProgram, mnemonic: string): AsmILElement[] {
  return allInstructions(program).filter(
    (e) => isInstructionElement(e) && e.instruction.mnemonic === mnemonic
  );
}

/**
 * Counts occurrences of a specific mnemonic.
 *
 * @param program - Generated ASM-IL program
 * @param mnemonic - Mnemonic to count
 * @returns Count of matching instructions
 */
export function countMnemonic(program: AsmILProgram, mnemonic: string): number {
  return findMnemonic(program, mnemonic).length;
}

/**
 * Gets the Nth instruction element (0-indexed).
 *
 * @param program - Generated ASM-IL program
 * @param index - Zero-based instruction index
 * @returns The instruction element, or undefined
 */
export function nthInstruction(program: AsmILProgram, index: number): AsmILElement | undefined {
  return allInstructions(program)[index];
}

/**
 * Checks if the output contains a label with the given name.
 *
 * @param program - Generated ASM-IL program
 * @param name - Label name to search for
 * @returns true if label exists
 */
export function hasLabel(program: AsmILProgram, name: string): boolean {
  const names = labelNames(program);
  // Labels from LABEL instructions are prefixed with '.' by the code generator
  // (via localLabel). Function labels are not prefixed. Check both forms.
  return names.includes(name) || names.includes(`.${name}`);
}

/**
 * Checks if the output contains a comment with specific text.
 *
 * @param program - Generated ASM-IL program
 * @param text - Text to search for (substring match)
 * @returns true if matching comment exists
 */
export function hasComment(program: AsmILProgram, text: string): boolean {
  return allElements(program).some((e) => {
    if (isCommentElement(e)) {
      return e.comment.text.includes(text);
    }
    if (isInstructionElement(e) && e.instruction.comment) {
      return e.instruction.comment.includes(text);
    }
    return false;
  });
}

/**
 * Gets all sections from the program.
 *
 * @param program - Generated ASM-IL program
 * @returns Array of section objects
 */
export function getSections(program: AsmILProgram): AsmILSection[] {
  return program.sections;
}

/**
 * Gets a section by name.
 *
 * @param program - Generated ASM-IL program
 * @param name - Section name
 * @returns The section, or undefined
 */
export function getSection(program: AsmILProgram, name: string): AsmILSection | undefined {
  return program.sections.find((s: AsmILSection) => s.name === name);
}
