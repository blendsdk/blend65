/**
 * Instruction Code Generator for Blend65 Compiler
 *
 * Handles IL instruction translation to 6502 assembly:
 * - Tier 1: Fully translated (HARDWARE_WRITE, CONST, RETURN_VOID, JUMP)
 * - Tier 2: Simplified translation (binary ops, branches, calls, load/store)
 * - Tier 3: Placeholder (complex expressions, arrays, phi nodes)
 *
 * Inheritance chain:
 * BaseCodeGenerator → GlobalsGenerator → InstructionGenerator → CodeGenerator
 *
 * **STUB IMPLEMENTATION**
 * This is a minimal implementation that generates basic working code.
 * Full instruction selection and optimization will be added in future phases.
 *
 * @module codegen/instruction-generator
 */

import type { ILFunction } from '../il/function.js';
import type { BasicBlock } from '../il/basic-block.js';
import {
  ILInstruction,
  ILOpcode,
  ILConstInstruction,
  ILHardwareWriteInstruction,
  ILHardwareReadInstruction,
  ILJumpInstruction,
  ILBranchInstruction,
  ILReturnVoidInstruction,
  ILReturnInstruction,
  ILBinaryInstruction,
  ILUnaryInstruction,
  ILLoadVarInstruction,
  ILStoreVarInstruction,
  ILCallInstruction,
  ILCallVoidInstruction,
  ILCpuInstruction,
  ILPeekInstruction,
  ILPokeInstruction,
  ILPeekwInstruction,
  ILPokewInstruction,
} from '../il/instructions.js';
import { GlobalsGenerator, ZP_RESERVED } from './globals-generator.js';
import type { VirtualRegister } from '../il/values.js';

/**
 * Instruction code generator - extends globals generator
 *
 * Handles translation of IL instructions to 6502 assembly.
 * Uses a three-tier approach:
 *
 * **Tier 1: Fully Translated**
 * - CONST → LDA immediate
 * - HARDWARE_WRITE → STA absolute
 * - HARDWARE_READ → LDA absolute
 * - RETURN_VOID → RTS
 * - JUMP → JMP label
 *
 * **Tier 2: Simplified Translation**
 * - Binary ops → Comment + placeholder
 * - Branch → Comment + unconditional JMP (stub)
 * - Call → JSR label
 * - Load/Store → LDA/STA
 *
 * **Tier 3: Placeholder**
 * - Complex expressions → Comment + NOP
 * - Arrays, pointers → Comment + NOP
 * - Phi nodes → Comment + NOP
 *
 * This class is extended by the final CodeGenerator class.
 */
export abstract class InstructionGenerator extends GlobalsGenerator {
  // ============================================
  // CONSTANT VALUE TRACKING
  // ============================================

  /**
   * Map of virtual register names to their known constant values.
   *
   * When a CONST instruction is processed, the constant value is recorded
   * here keyed by the result register's string representation. This allows
   * subsequent instructions (like PEEK/POKE) to look up constant addresses
   * for optimal code generation using absolute addressing.
   *
   * This map is reset for each function to avoid cross-function contamination.
   */
  protected constantMap: Map<string, number> = new Map();

  /**
   * Looks up a known constant value for a virtual register.
   *
   * @param reg - The virtual register to look up
   * @returns The constant value if known, or undefined if not a constant
   */
  protected lookupConstant(reg: VirtualRegister): number | undefined {
    return this.constantMap.get(reg.toString());
  }

  /**
   * Records a constant value for a virtual register.
   *
   * @param reg - The virtual register that holds the constant
   * @param value - The constant value
   */
  protected recordConstant(reg: VirtualRegister, value: number): void {
    this.constantMap.set(reg.toString(), value);
  }

  /**
   * Clears the constant map. Called at the start of each function.
   */
  protected clearConstantMap(): void {
    this.constantMap.clear();
  }

  // ============================================
  // FUNCTION CODE GENERATION
  // ============================================

  /**
   * Generates code for all functions in the module
   */
  protected generateFunctions(): void {
    const functions = this.currentModule.getFunctions();

    if (functions.length === 0) {
      return;
    }

    this.emitSectionComment('Functions');

    for (const func of functions) {
      this.generateFunction(func);
    }
  }

  /**
   * Generates code for a single function
   *
   * @param func - IL function to generate
   */
  protected generateFunction(func: ILFunction): void {
    // Clear constant map at the start of each function
    // This ensures no cross-function contamination of tracked constants
    this.clearConstantMap();

    const label = this.getFunctionLabel(func.name);

    // Track source location if available
    const entryBlock = func.getEntryBlock();
    const firstInstr = entryBlock.getInstructions()[0];
    if (firstInstr?.metadata.location) {
      this.trackLocation(firstInstr.metadata.location, label, `function ${func.name}`);
    }

    // Emit function header
    this.assemblyWriter.emitBlankLine();
    this.emitComment(`function ${func.name}(${this.formatParams(func)}): ${func.returnType.kind}`);
    this.emitLabel(label);

    // Generate code for each basic block
    const blocks = func.getBlocksInReversePostorder();
    for (const block of blocks) {
      this.generateBasicBlock(func, block);
    }

    // Update statistics
    this.incrementFunctionCount();
  }

  /**
   * Formats function parameters for comment
   *
   * @param func - Function to format
   * @returns Parameter string
   */
  protected formatParams(func: ILFunction): string {
    return func.parameters.map((p) => `${p.name}: ${p.type.kind}`).join(', ');
  }

  // ============================================
  // BASIC BLOCK CODE GENERATION
  // ============================================

  /**
   * Generates code for a basic block
   *
   * @param _func - Containing function (unused in stub, will be used for local vars)
   * @param block - Basic block to generate
   */
  protected generateBasicBlock(_func: ILFunction, block: BasicBlock): void {
    // Skip entry block label if it's the first block
    if (block.id !== 0) {
      const blockLabel = this.getBlockLabel(block.label);
      this.emitLabel(blockLabel);
    }

    // Generate code for each instruction
    for (const instr of block.getInstructions()) {
      this.generateInstruction(instr);
    }
  }

  // ============================================
  // INSTRUCTION DISPATCH
  // ============================================

  /**
   * Generates code for a single IL instruction
   *
   * Dispatches to specific handlers based on opcode.
   *
   * @param instr - IL instruction to generate
   */
  protected generateInstruction(instr: ILInstruction): void {
    // Emit source comment if debug mode
    this.emitSourceComment(instr.metadata.location, instr.toString());

    switch (instr.opcode) {
      // ====== Tier 1: Fully Translated ======
      case ILOpcode.CONST:
        this.generateConst(instr as ILConstInstruction);
        break;

      case ILOpcode.HARDWARE_WRITE:
        this.generateHardwareWrite(instr as ILHardwareWriteInstruction);
        break;

      case ILOpcode.HARDWARE_READ:
        this.generateHardwareRead(instr as ILHardwareReadInstruction);
        break;

      case ILOpcode.RETURN_VOID:
        this.generateReturnVoid(instr as ILReturnVoidInstruction);
        break;

      case ILOpcode.RETURN:
        this.generateReturn(instr as ILReturnInstruction);
        break;

      case ILOpcode.JUMP:
        this.generateJump(instr as ILJumpInstruction);
        break;

      // ====== Tier 2: Simplified Translation ======
      case ILOpcode.BRANCH:
        this.generateBranch(instr as ILBranchInstruction);
        break;

      case ILOpcode.LOAD_VAR:
        this.generateLoadVar(instr as ILLoadVarInstruction);
        break;

      case ILOpcode.STORE_VAR:
        this.generateStoreVar(instr as ILStoreVarInstruction);
        break;

      case ILOpcode.CALL:
        this.generateCall(instr as ILCallInstruction);
        break;

      case ILOpcode.CALL_VOID:
        this.generateCallVoid(instr as ILCallVoidInstruction);
        break;

      case ILOpcode.ADD:
      case ILOpcode.SUB:
      case ILOpcode.AND:
      case ILOpcode.OR:
      case ILOpcode.XOR:
      case ILOpcode.CMP_EQ:
      case ILOpcode.CMP_NE:
      case ILOpcode.CMP_LT:
      case ILOpcode.CMP_LE:
      case ILOpcode.CMP_GT:
      case ILOpcode.CMP_GE:
        this.generateBinaryOp(instr as ILBinaryInstruction);
        break;

      case ILOpcode.NEG:
      case ILOpcode.NOT:
      case ILOpcode.LOGICAL_NOT:
        this.generateUnaryOp(instr as ILUnaryInstruction);
        break;

      // ====== CPU Instructions ======
      case ILOpcode.CPU_SEI:
      case ILOpcode.CPU_CLI:
      case ILOpcode.CPU_NOP:
      case ILOpcode.CPU_PHA:
      case ILOpcode.CPU_PLA:
      case ILOpcode.CPU_PHP:
      case ILOpcode.CPU_PLP:
        this.generateCpuInstruction(instr as ILCpuInstruction);
        break;

      // ====== Memory Intrinsics ======
      case ILOpcode.INTRINSIC_PEEK:
        this.generatePeek(instr as ILPeekInstruction);
        break;

      case ILOpcode.INTRINSIC_POKE:
        this.generatePoke(instr as ILPokeInstruction);
        break;

      case ILOpcode.INTRINSIC_PEEKW:
        this.generatePeekw(instr as ILPeekwInstruction);
        break;

      case ILOpcode.INTRINSIC_POKEW:
        this.generatePokew(instr as ILPokewInstruction);
        break;

      // ====== Tier 3: Placeholder ======
      default:
        this.generatePlaceholder(instr);
        break;
    }
  }

  // ============================================
  // TIER 1: FULLY TRANSLATED INSTRUCTIONS
  // ============================================

  /**
   * Generates code for CONST instruction
   *
   * Records the constant value for subsequent instructions to reference.
   * For byte values, loads into accumulator. For address values (used by
   * peek/poke), only records for later lookup without emitting LDA.
   *
   * @param instr - Const instruction
   */
  protected generateConst(instr: ILConstInstruction): void {
    // Record this constant so subsequent instructions (like PEEK/POKE)
    // can look up the actual value instead of using placeholder addresses
    // Only record if there's a result register (which there always should be for CONST)
    if (instr.result) {
      this.recordConstant(instr.result, instr.value);
    }

    // Emit LDA for the value - it will be in A for subsequent use
    this.emitLdaImmediate(instr.value, `${instr.result} = ${instr.value}`);
  }

  /**
   * Generates code for HARDWARE_WRITE instruction
   *
   * Full translation: STA to absolute hardware address.
   *
   * @param instr - Hardware write instruction
   */
  protected generateHardwareWrite(instr: ILHardwareWriteInstruction): void {
    // STUB: Assume value is in accumulator
    // Full implementation would load from register
    this.emitStaAbsolute(instr.address, `Write to ${this.formatHex(instr.address)}`);
  }

  /**
   * Generates code for HARDWARE_READ instruction
   *
   * Full translation: LDA from absolute hardware address.
   *
   * @param instr - Hardware read instruction
   */
  protected generateHardwareRead(instr: ILHardwareReadInstruction): void {
    this.emitLdaAbsolute(instr.address, `Read from ${this.formatHex(instr.address)}`);
  }

  /**
   * Generates code for RETURN_VOID instruction
   *
   * Full translation: RTS
   *
   * @param _instr - Return void instruction
   */
  protected generateReturnVoid(_instr: ILReturnVoidInstruction): void {
    this.emitRts('Return void');
  }

  /**
   * Generates code for RETURN instruction
   *
   * STUB: Return value assumed in accumulator.
   *
   * @param _instr - Return instruction
   */
  protected generateReturn(_instr: ILReturnInstruction): void {
    // STUB: Assume return value is already in A
    this.emitRts('Return with value in A');
  }

  /**
   * Generates code for JUMP instruction
   *
   * Full translation: JMP to target label.
   *
   * @param instr - Jump instruction
   */
  protected generateJump(instr: ILJumpInstruction): void {
    const targetLabel = this.getBlockLabel(instr.target.name);
    this.emitJmp(targetLabel, `Jump to ${instr.target.name}`);
  }

  // ============================================
  // TIER 2: SIMPLIFIED TRANSLATION
  // ============================================

  /**
   * Generates code for BRANCH instruction
   *
   * STUB: Generates unconditional jump to then-block.
   * Full implementation would use conditional branches.
   *
   * @param instr - Branch instruction
   */
  protected generateBranch(instr: ILBranchInstruction): void {
    const thenLabel = this.getBlockLabel(instr.thenTarget.name);
    const elseLabel = this.getBlockLabel(instr.elseTarget.name);

    // STUB: Comment showing intended behavior, then unconditional jump
    this.emitComment(`STUB: Branch on ${instr.condition} ? ${thenLabel} : ${elseLabel}`);

    // For stub, always take the "then" path
    this.emitJmp(thenLabel, 'STUB: Always take then-branch');
  }

  /**
   * Generates code for LOAD_VAR instruction
   *
   * @param instr - Load variable instruction
   */
  protected generateLoadVar(instr: ILLoadVarInstruction): void {
    const addrInfo = this.lookupGlobalAddress(instr.variableName);

    if (addrInfo) {
      if (addrInfo.isZeroPage) {
        this.emitLdaZeroPage(addrInfo.address, `Load ${instr.variableName}`);
      } else {
        this.emitLdaAbsolute(addrInfo.address, `Load ${instr.variableName}`);
      }
    } else {
      // Use label for RAM variables
      const label = this.lookupGlobalLabel(instr.variableName);
      if (label) {
        this.emitInstruction('LDA', label, `Load ${instr.variableName}`, 3);
      } else {
        this.emitComment(`STUB: Unknown variable ${instr.variableName}`);
        this.emitLdaImmediate(0, 'Placeholder');
      }
    }
  }

  /**
   * Generates code for STORE_VAR instruction
   *
   * @param instr - Store variable instruction
   */
  protected generateStoreVar(instr: ILStoreVarInstruction): void {
    const addrInfo = this.lookupGlobalAddress(instr.variableName);

    if (addrInfo) {
      if (addrInfo.isZeroPage) {
        this.emitStaZeroPage(addrInfo.address, `Store ${instr.variableName}`);
      } else {
        this.emitStaAbsolute(addrInfo.address, `Store ${instr.variableName}`);
      }
    } else {
      // Use label for RAM variables
      const label = this.lookupGlobalLabel(instr.variableName);
      if (label) {
        this.emitInstruction('STA', label, `Store ${instr.variableName}`, 3);
      } else {
        this.emitComment(`STUB: Unknown variable ${instr.variableName}`);
      }
    }
  }

  /**
   * Generates code for CALL instruction
   *
   * @param instr - Call instruction
   */
  protected generateCall(instr: ILCallInstruction): void {
    // STUB: No parameter passing ABI yet
    if (instr.args.length > 0) {
      this.emitComment(`STUB: Call with ${instr.args.length} args (ABI not implemented)`);
    }

    const label = `_${instr.functionName}`;
    this.emitJsr(label, `Call ${instr.functionName}`);
  }

  /**
   * Generates code for CALL_VOID instruction
   *
   * @param instr - Call void instruction
   */
  protected generateCallVoid(instr: ILCallVoidInstruction): void {
    // STUB: No parameter passing ABI yet
    if (instr.args.length > 0) {
      this.emitComment(`STUB: Call with ${instr.args.length} args (ABI not implemented)`);
    }

    const label = `_${instr.functionName}`;
    this.emitJsr(label, `Call ${instr.functionName}`);
  }

  /**
   * Generates code for binary operations
   *
   * STUB: Shows intended operation as comment + placeholder.
   *
   * @param instr - Binary instruction
   */
  protected generateBinaryOp(instr: ILBinaryInstruction): void {
    const op = this.getOperatorSymbol(instr.opcode);
    this.emitComment(`STUB: ${instr.result} = ${instr.left} ${op} ${instr.right}`);

    // Minimal stub implementation for ADD
    if (instr.opcode === ILOpcode.ADD) {
      // Assumes left operand in A, right in memory/immediate
      this.emitInstruction('CLC', undefined, 'Clear carry for add', 1);
      this.emitInstruction('ADC', '#$00', 'STUB: Add placeholder', 2);
    } else if (instr.opcode === ILOpcode.SUB) {
      this.emitInstruction('SEC', undefined, 'Set carry for subtract', 1);
      this.emitInstruction('SBC', '#$00', 'STUB: Subtract placeholder', 2);
    } else {
      // Other ops: just NOP as placeholder
      this.emitNop('STUB: Binary op placeholder');
    }
  }

  /**
   * Generates code for unary operations
   *
   * STUB: Shows intended operation as comment + placeholder.
   *
   * @param instr - Unary instruction
   */
  protected generateUnaryOp(instr: ILUnaryInstruction): void {
    const op = this.getUnaryOperatorSymbol(instr.opcode);
    this.emitComment(`STUB: ${instr.result} = ${op}${instr.operand}`);

    if (instr.opcode === ILOpcode.NOT) {
      // Bitwise NOT
      this.emitInstruction('EOR', '#$FF', 'Bitwise NOT', 2);
    } else {
      this.emitNop('STUB: Unary op placeholder');
    }
  }

  /**
   * Generates code for CPU instructions
   *
   * These map directly to 6502 instructions.
   *
   * @param instr - CPU instruction
   */
  protected generateCpuInstruction(instr: ILCpuInstruction): void {
    switch (instr.opcode) {
      case ILOpcode.CPU_SEI:
        this.emitInstruction('SEI', undefined, 'Disable interrupts', 1);
        break;
      case ILOpcode.CPU_CLI:
        this.emitInstruction('CLI', undefined, 'Enable interrupts', 1);
        break;
      case ILOpcode.CPU_NOP:
        this.emitNop('No operation');
        break;
      case ILOpcode.CPU_PHA:
        this.emitInstruction('PHA', undefined, 'Push A to stack', 1);
        break;
      case ILOpcode.CPU_PLA:
        this.emitInstruction('PLA', undefined, 'Pull A from stack', 1);
        break;
      case ILOpcode.CPU_PHP:
        this.emitInstruction('PHP', undefined, 'Push status to stack', 1);
        break;
      case ILOpcode.CPU_PLP:
        this.emitInstruction('PLP', undefined, 'Pull status from stack', 1);
        break;
      default:
        this.emitComment(`Unknown CPU instruction: ${instr.opcode}`);
    }
  }

  // ============================================
  // MEMORY INTRINSIC INSTRUCTIONS
  // ============================================

  /**
   * Generates code for INTRINSIC_PEEK instruction.
   *
   * Reads a byte from the memory address specified by the address register.
   * For constant addresses, uses absolute addressing (LDA $ADDR).
   * For variable addresses, uses indirect Y-indexed addressing through
   * the compiler's reserved zero-page pointer (PTR0).
   *
   * 6502 implementation:
   * - If address is constant: LDA $ADDR (4 cycles)
   * - If address is variable: Use indirect addressing LDA ($PTR0),Y
   *
   * @param instr - Peek instruction containing address register
   */
  protected generatePeek(instr: ILPeekInstruction): void {
    this.emitComment(`peek(${instr.address}) -> ${instr.result}`);

    // Look up the address register to see if it holds a known constant
    const address = this.lookupConstant(instr.address);

    if (address !== undefined) {
      // Address is a known constant - use absolute addressing
      this.emitLdaAbsolute(address, `peek: Load byte from ${this.formatHex(address)}`);
    } else {
      // Address is variable - use indirect addressing via PTR0
      // The 16-bit address should be set up in PTR0 ($02-$03) by prior code
      // In a full implementation, register allocation would track where
      // the address value is and generate code to move it to PTR0
      this.emitComment(`Variable address from ${instr.address} - using indirect via PTR0`);
      this.emitComment('NOTE: Address must be loaded to PTR0/PTR0+1 before this');
      this.emitLdyImmediate(0, 'Y offset = 0');
      this.emitLdaIndirectY(ZP_RESERVED.PTR0, `peek: Load byte via (${this.formatZeroPage(ZP_RESERVED.PTR0)}),Y`);
    }
  }

  /**
   * Generates code for INTRINSIC_POKE instruction.
   *
   * Writes a byte to the memory address specified by the address register.
   * For constant addresses, uses absolute addressing (STA $ADDR).
   * For variable addresses, uses indirect Y-indexed addressing through
   * the compiler's reserved zero-page pointer (PTR0).
   *
   * 6502 implementation:
   * - If address is constant: STA $ADDR (4 cycles)
   * - If address is variable: Use indirect addressing STA ($PTR0),Y
   *
   * Note: Assumes the value to write is already in the accumulator from
   * a preceding instruction. Full implementation would need proper
   * register allocation to load the value first if needed.
   *
   * @param instr - Poke instruction containing address and value registers
   */
  protected generatePoke(instr: ILPokeInstruction): void {
    this.emitComment(`poke(${instr.address}, ${instr.value})`);

    // Look up the address register to see if it holds a known constant
    const address = this.lookupConstant(instr.address);

    if (address !== undefined) {
      // Address is a known constant - use absolute addressing
      // Note: Value is assumed to already be in A from preceding CONST
      this.emitStaAbsolute(address, `poke: Store byte to ${this.formatHex(address)}`);
    } else {
      // Address is variable - use indirect addressing via PTR0
      // The 16-bit address should be set up in PTR0 ($02-$03) by prior code
      // In a full implementation, register allocation would track where
      // the address value is and generate code to move it to PTR0
      this.emitComment(`Variable address from ${instr.address} - using indirect via PTR0`);
      this.emitComment('NOTE: Address must be loaded to PTR0/PTR0+1 before this');
      this.emitComment('NOTE: Value to store must be in A');
      this.emitLdyImmediate(0, 'Y offset = 0');
      this.emitStaIndirectY(ZP_RESERVED.PTR0, `poke: Store byte via (${this.formatZeroPage(ZP_RESERVED.PTR0)}),Y`);
    }
  }

  /**
   * Generates code for INTRINSIC_PEEKW instruction.
   *
   * Reads a 16-bit word from memory in little-endian order.
   * Reads low byte from address, high byte from address+1.
   *
   * 6502 implementation (8+ cycles):
   * - LDA addr   ; Load low byte (4 cycles)
   * - STA temp   ; Store low byte temporarily
   * - LDA addr+1 ; Load high byte (4 cycles)
   * - (result in temp:A or stored appropriately)
   *
   * Note: 16-bit values on 6502 require storing one byte while loading the other.
   * Full implementation would use zero page temporaries to hold the word.
   *
   * @param instr - Peekw instruction containing address register
   */
  protected generatePeekw(instr: ILPeekwInstruction): void {
    this.emitComment(`peekw(${instr.address}) -> ${instr.result}`);

    // Look up the address register to see if it holds a known constant
    const address = this.lookupConstant(instr.address);

    if (address !== undefined) {
      // Address is a known constant - use absolute addressing for both bytes
      // Read low byte, store to temp, then read high byte
      this.emitLdaAbsolute(address, `peekw: Load low byte from ${this.formatHex(address)}`);
      this.emitStaZeroPage(ZP_RESERVED.TMP0, 'Store low byte to temp');
      this.emitLdaAbsolute(address + 1, `peekw: Load high byte from ${this.formatHex(address + 1)}`);
      this.emitStaZeroPage(ZP_RESERVED.TMP0 + 1, 'Store high byte to temp');
      this.emitComment(`Result word in TMP0:TMP0+1 (${this.formatZeroPage(ZP_RESERVED.TMP0)}:${this.formatZeroPage(ZP_RESERVED.TMP0 + 1)})`);
    } else {
      // Address is variable - use indirect addressing via PTR0
      // Read low byte with Y=0, then high byte with Y=1
      this.emitComment(`Variable address from ${instr.address} - using indirect via PTR0`);
      this.emitComment('NOTE: Address must be loaded to PTR0/PTR0+1 before this');
      this.emitLdyImmediate(0, 'Y offset = 0 for low byte');
      this.emitLdaIndirectY(ZP_RESERVED.PTR0, `peekw: Load low byte via (${this.formatZeroPage(ZP_RESERVED.PTR0)}),Y`);
      this.emitStaZeroPage(ZP_RESERVED.TMP0, 'Store low byte to temp');
      this.emitIny('Y = 1 for high byte');
      this.emitLdaIndirectY(ZP_RESERVED.PTR0, `peekw: Load high byte via (${this.formatZeroPage(ZP_RESERVED.PTR0)}),Y`);
      this.emitStaZeroPage(ZP_RESERVED.TMP0 + 1, 'Store high byte to temp');
    }
  }

  /**
   * Generates code for INTRINSIC_POKEW instruction.
   *
   * Writes a 16-bit word to memory in little-endian order.
   * Writes low byte to address, high byte to address+1.
   *
   * 6502 implementation (8+ cycles):
   * - LDA value_lo ; Get low byte
   * - STA addr     ; Store low byte (4 cycles)
   * - LDA value_hi ; Get high byte
   * - STA addr+1   ; Store high byte (4 cycles)
   *
   * Note: 16-bit values require managing both bytes. Full implementation
   * would handle the value register to extract low/high bytes properly.
   *
   * @param instr - Pokew instruction containing address and value registers
   */
  protected generatePokew(instr: ILPokewInstruction): void {
    this.emitComment(`pokew(${instr.address}, ${instr.value})`);

    // Look up the address register to see if it holds a known constant
    const address = this.lookupConstant(instr.address);

    if (address !== undefined) {
      // Address is a known constant - use absolute addressing for both bytes
      // Assume value is in TMP0:TMP0+1 (prepared by prior code)
      this.emitComment('NOTE: Value word should be in TMP0:TMP0+1');
      this.emitLdaZeroPage(ZP_RESERVED.TMP0, 'Load low byte from temp');
      this.emitStaAbsolute(address, `pokew: Store low byte to ${this.formatHex(address)}`);
      this.emitLdaZeroPage(ZP_RESERVED.TMP0 + 1, 'Load high byte from temp');
      this.emitStaAbsolute(address + 1, `pokew: Store high byte to ${this.formatHex(address + 1)}`);
    } else {
      // Address is variable - use indirect addressing via PTR0
      // Store low byte with Y=0, then high byte with Y=1
      this.emitComment(`Variable address from ${instr.address} - using indirect via PTR0`);
      this.emitComment('NOTE: Address must be loaded to PTR0/PTR0+1 before this');
      this.emitComment('NOTE: Value word should be in TMP0:TMP0+1');
      this.emitLdyImmediate(0, 'Y offset = 0 for low byte');
      this.emitLdaZeroPage(ZP_RESERVED.TMP0, 'Load low byte from temp');
      this.emitStaIndirectY(ZP_RESERVED.PTR0, `pokew: Store low byte via (${this.formatZeroPage(ZP_RESERVED.PTR0)}),Y`);
      this.emitIny('Y = 1 for high byte');
      this.emitLdaZeroPage(ZP_RESERVED.TMP0 + 1, 'Load high byte from temp');
      this.emitStaIndirectY(ZP_RESERVED.PTR0, `pokew: Store high byte via (${this.formatZeroPage(ZP_RESERVED.PTR0)}),Y`);
    }
  }

  // ============================================
  // TIER 3: PLACEHOLDER GENERATION
  // ============================================

  /**
   * Generates placeholder code for unsupported instructions
   *
   * @param instr - Unsupported instruction
   */
  protected generatePlaceholder(instr: ILInstruction): void {
    this.emitComment(`STUB: ${instr.toString()}`);
    this.emitNop('Placeholder');
    this.addWarning(`Unsupported IL instruction: ${instr.opcode}`);
  }

  // ============================================
  // OPERATOR FORMATTING HELPERS
  // ============================================

  /**
   * Gets symbol for binary operator
   *
   * @param opcode - IL opcode
   * @returns Operator symbol string
   */
  protected getOperatorSymbol(opcode: ILOpcode): string {
    switch (opcode) {
      case ILOpcode.ADD:
        return '+';
      case ILOpcode.SUB:
        return '-';
      case ILOpcode.MUL:
        return '*';
      case ILOpcode.DIV:
        return '/';
      case ILOpcode.MOD:
        return '%';
      case ILOpcode.AND:
        return '&';
      case ILOpcode.OR:
        return '|';
      case ILOpcode.XOR:
        return '^';
      case ILOpcode.SHL:
        return '<<';
      case ILOpcode.SHR:
        return '>>';
      case ILOpcode.CMP_EQ:
        return '==';
      case ILOpcode.CMP_NE:
        return '!=';
      case ILOpcode.CMP_LT:
        return '<';
      case ILOpcode.CMP_LE:
        return '<=';
      case ILOpcode.CMP_GT:
        return '>';
      case ILOpcode.CMP_GE:
        return '>=';
      default:
        return '?';
    }
  }

  /**
   * Gets symbol for unary operator
   *
   * @param opcode - IL opcode
   * @returns Operator symbol string
   */
  protected getUnaryOperatorSymbol(opcode: ILOpcode): string {
    switch (opcode) {
      case ILOpcode.NEG:
        return '-';
      case ILOpcode.NOT:
        return '~';
      case ILOpcode.LOGICAL_NOT:
        return '!';
      default:
        return '?';
    }
  }
}