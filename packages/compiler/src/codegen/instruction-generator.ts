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
  ILLoadAddressInstruction,
  ILLoInstruction,
  ILHiInstruction,
  ILVolatileReadInstruction,
  ILVolatileWriteInstruction,
} from '../il/instructions.js';
import { GlobalsGenerator } from './globals-generator.js';

/**
 * Tracks local variable allocation within a function.
 */
interface LocalVariableAllocation {
  /** Variable name */
  name: string;
  /** Allocated zero-page address */
  zpAddress: number;
  /** Size in bytes */
  size: number;
  /** Type kind for word handling */
  typeKind: string;
}

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
  // LOCAL VARIABLE ALLOCATION
  // ============================================

  /**
   * Tracks local variable allocation within a function.
   * Reset when generating a new function.
   */
  protected localAllocations: Map<string, LocalVariableAllocation> = new Map();

  /**
   * Next available zero-page address for locals.
   * Starts after global ZP allocations at $50.
   */
  protected nextLocalZpAddress: number = 0x50;

  /**
   * Start address for function-local zero-page allocation.
   */
  protected static readonly LOCAL_ZP_START = 0x50;

  /**
   * End address for function-local zero-page allocation (exclusive).
   * 48 bytes available: $50-$7F
   */
  protected static readonly LOCAL_ZP_END = 0x80;

  /**
   * Current function's parameter names for lookup.
   */
  protected currentFunctionParams: Set<string> = new Set();

  /**
   * Resets local variable tracking for a new function.
   */
  protected resetLocalAllocations(): void {
    this.localAllocations.clear();
    this.nextLocalZpAddress = InstructionGenerator.LOCAL_ZP_START;
    this.currentFunctionParams.clear();
  }

  /**
   * Allocates zero-page space for a local variable.
   *
   * @param name - Variable name
   * @param typeKind - Type kind (byte, word, bool)
   * @returns Allocated address or undefined if out of space
   */
  protected allocateLocalVariable(name: string, typeKind: string): number | undefined {
    // Check if already allocated
    const existing = this.localAllocations.get(name);
    if (existing) {
      return existing.zpAddress;
    }

    const size = typeKind === 'word' || typeKind === 'pointer' ? 2 : 1;

    if (this.nextLocalZpAddress + size > InstructionGenerator.LOCAL_ZP_END) {
      this.addWarning(`Local variable ZP overflow: cannot allocate '${name}'`);
      return undefined;
    }

    const address = this.nextLocalZpAddress;
    this.nextLocalZpAddress += size;

    this.localAllocations.set(name, {
      name,
      zpAddress: address,
      size,
      typeKind,
    });

    return address;
  }

  /**
   * Looks up a local variable's allocation.
   *
   * @param name - Variable name
   * @returns Allocation info or undefined if not found
   */
  protected lookupLocalVariable(name: string): LocalVariableAllocation | undefined {
    return this.localAllocations.get(name);
  }

  /**
   * Checks if a variable is a parameter of the current function.
   *
   * @param name - Variable name
   * @returns true if it's a parameter
   */
  protected isCurrentFunctionParam(name: string): boolean {
    return this.currentFunctionParams.has(name);
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
    const label = this.getFunctionLabel(func.name);

    // Reset local variable allocations for this function
    this.resetLocalAllocations();

    // Setup parameter tracking for this function
    for (const param of func.parameters) {
      this.currentFunctionParams.add(param.name);
      // Pre-allocate parameters in local allocations
      this.allocateLocalVariable(param.name, param.type.kind);
    }

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
      case ILOpcode.CPU_BRK:
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

      // ====== Address Operations ======
      case ILOpcode.LOAD_ADDRESS:
        this.generateLoadAddress(instr as ILLoadAddressInstruction);
        break;

      // ====== Optimization Control ======
      case ILOpcode.OPT_BARRIER:
        // Optimization barrier - no code generated, just a marker for optimizer
        this.emitComment('=== OPTIMIZATION BARRIER ===');
        break;

      // ====== Byte Extraction Intrinsics ======
      case ILOpcode.INTRINSIC_LO:
        this.generateLo(instr as ILLoInstruction);
        break;

      case ILOpcode.INTRINSIC_HI:
        this.generateHi(instr as ILHiInstruction);
        break;

      // ====== Volatile Memory Operations ======
      case ILOpcode.VOLATILE_READ:
        this.generateVolatileRead(instr as ILVolatileReadInstruction);
        break;

      case ILOpcode.VOLATILE_WRITE:
        this.generateVolatileWrite(instr as ILVolatileWriteInstruction);
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
   * Tracks the last constant value loaded for potential optimization.
   * Used by hi()/lo() to fold constant extractions.
   */
  protected lastConstValue: number | null = null;
  protected lastConstResult: string | null = null;

  /**
   * Tracks the last comparison opcode for branch instruction selection.
   * When a CMP_* instruction is generated, this is set so the subsequent
   * BRANCH instruction can select the appropriate 6502 branch instruction.
   */
  protected lastComparisonOpcode: ILOpcode | null = null;

  /**
   * Generates code for CONST instruction
   *
   * Loads a constant value into the accumulator.
   * For word (16-bit) values, stores low byte in A and high byte in X.
   *
   * @param instr - Const instruction
   */
  protected generateConst(instr: ILConstInstruction): void {
    const value = instr.value;
    
    // Track this constant for potential hi()/lo() folding
    this.lastConstValue = value;
    this.lastConstResult = instr.result?.toString() ?? null;
    
    // For word values (> 255), we need to load both bytes
    // A = low byte, X = high byte (for use by hi()/lo())
    if (value > 255) {
      const lowByte = value & 0xFF;
      const highByte = (value >> 8) & 0xFF;
      // Load low byte into A
      this.emitLdaImmediate(lowByte, `${instr.result} = ${value} (low byte)`);
      // Load high byte into X for potential hi() use - use byte-sized hex format
      const highHex = '$' + highByte.toString(16).toUpperCase().padStart(2, '0');
      this.emitInstruction('LDX', `#${highHex}`, `${instr.result} high byte`, 2);
    } else {
      // Single byte value - just load into A
      this.emitLdaImmediate(value, `${instr.result} = ${value}`);
    }
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
   * Uses the tracked comparison opcode (from preceding CMP_* instruction)
   * to select the appropriate 6502 conditional branch instruction.
   *
   * Branch logic:
   * - CMP_EQ (==): Use BNE to skip to else if not equal
   * - CMP_NE (!=): Use BEQ to skip to else if equal
   * - CMP_LT (<): Use BCS to skip to else if >= (carry set)
   * - CMP_GE (>=): Use BCC to skip to else if < (carry clear)
   * - CMP_GT (>): Use BCC/BEQ to skip to else if <= 
   * - CMP_LE (<=): Complex - requires BCS or (BCC + BNE sequence)
   *
   * @param instr - Branch instruction
   */
  protected generateBranch(instr: ILBranchInstruction): void {
    const thenLabel = this.getBlockLabel(instr.thenTarget.name);
    const elseLabel = this.getBlockLabel(instr.elseTarget.name);

    // Use tracked comparison opcode to select appropriate branch
    if (this.lastComparisonOpcode !== null) {
      this.emitComment(`Branch on ${instr.condition} ? ${thenLabel} : ${elseLabel}`);
      
      switch (this.lastComparisonOpcode) {
        case ILOpcode.CMP_EQ:
          // Equal: Z flag set if equal, use BNE to skip to else
          this.emitInstruction('BNE', elseLabel, 'Skip to else if not equal', 2);
          break;
          
        case ILOpcode.CMP_NE:
          // Not equal: Z flag set if equal, use BEQ to skip to else
          this.emitInstruction('BEQ', elseLabel, 'Skip to else if equal', 2);
          break;
          
        case ILOpcode.CMP_LT:
          // Less than: C flag clear if A < operand, use BCS to skip to else if >=
          this.emitInstruction('BCS', elseLabel, 'Skip to else if >= (carry set)', 2);
          break;
          
        case ILOpcode.CMP_GE:
          // Greater or equal: C flag set if A >= operand, use BCC to skip to else if <
          this.emitInstruction('BCC', elseLabel, 'Skip to else if < (carry clear)', 2);
          break;
          
        case ILOpcode.CMP_GT:
          // Greater than: C set AND Z clear means A > operand
          // Skip to else if not greater: BCC (if <) or BEQ (if ==)
          this.emitInstruction('BCC', elseLabel, 'Skip to else if <', 2);
          this.emitInstruction('BEQ', elseLabel, 'Skip to else if ==', 2);
          break;
          
        case ILOpcode.CMP_LE:
          // Less than or equal: C clear OR Z set means A <= operand
          // Skip to else if greater: C set AND Z clear
          // This is complex - simplify by using BEQ to catch equal case first
          this.emitInstruction('BEQ', thenLabel, 'Take then if equal', 2);
          this.emitInstruction('BCS', elseLabel, 'Skip to else if > (carry set, not equal)', 2);
          break;
          
        default:
          // Unknown comparison - fall back to unconditional jump
          this.emitComment(`Unknown comparison type: ${this.lastComparisonOpcode}`);
          this.emitJmp(thenLabel, 'Fallback: unconditional jump');
      }
      
      // Reset comparison tracking after use
      this.lastComparisonOpcode = null;
      
      // Fall through to then block (except for CMP_LE which is handled above)
      // Note: The jump to thenLabel is implicit - we fall through after the conditional branch
      // Only emit JMP to then if the else branch was taken
      return;
    }

    // No tracked comparison - use STUB behavior with unconditional jump
    this.emitComment(`STUB: Branch on ${instr.condition} ? ${thenLabel} : ${elseLabel}`);
    this.emitJmp(thenLabel, 'STUB: Always take then-branch');
  }

  /**
   * Generates code for LOAD_VAR instruction
   *
   * Checks local variables first, then global variables and labels.
   *
   * @param instr - Load variable instruction
   */
  protected generateLoadVar(instr: ILLoadVarInstruction): void {
    // Check local variables FIRST (including function parameters)
    const local = this.lookupLocalVariable(instr.variableName);
    if (local) {
      if (local.typeKind === 'word' || local.typeKind === 'pointer') {
        // Word load: low byte to A, high byte to X
        this.emitLdaZeroPage(local.zpAddress, `Load ${instr.variableName} (low)`);
        this.emitInstruction('LDX', this.formatZeroPage(local.zpAddress + 1), `Load ${instr.variableName} (high)`, 2);
      } else {
        this.emitLdaZeroPage(local.zpAddress, `Load ${instr.variableName}`);
      }
      return;
    }

    // Check global memory-mapped addresses
    const addrInfo = this.lookupGlobalAddress(instr.variableName);
    if (addrInfo) {
      if (addrInfo.isZeroPage) {
        this.emitLdaZeroPage(addrInfo.address, `Load ${instr.variableName}`);
      } else {
        this.emitLdaAbsolute(addrInfo.address, `Load ${instr.variableName}`);
      }
      return;
    }

    // Check global label-based variables
    const label = this.lookupGlobalLabel(instr.variableName);
    if (label) {
      this.emitInstruction('LDA', label, `Load ${instr.variableName}`, 3);
      return;
    }

    // Unknown variable - try to allocate as local (lazy allocation)
    // Default to byte type for unknown variables
    const zpAddr = this.allocateLocalVariable(instr.variableName, 'byte');
    if (zpAddr !== undefined) {
      this.emitLdaZeroPage(zpAddr, `Load ${instr.variableName} (auto-allocated local)`);
    } else {
      this.emitComment(`STUB: Unknown variable ${instr.variableName}`);
      this.emitLdaImmediate(0, 'Placeholder');
    }
  }

  /**
   * Generates code for STORE_VAR instruction
   *
   * Checks local variables first, then global variables and labels.
   *
   * @param instr - Store variable instruction
   */
  protected generateStoreVar(instr: ILStoreVarInstruction): void {
    // Check local variables FIRST (including function parameters)
    const local = this.lookupLocalVariable(instr.variableName);
    if (local) {
      if (local.typeKind === 'word' || local.typeKind === 'pointer') {
        // Word store: A has low byte, X has high byte
        this.emitStaZeroPage(local.zpAddress, `Store ${instr.variableName} (low)`);
        this.emitInstruction('STX', this.formatZeroPage(local.zpAddress + 1), `Store ${instr.variableName} (high)`, 2);
      } else {
        this.emitStaZeroPage(local.zpAddress, `Store ${instr.variableName}`);
      }
      return;
    }

    // Check global memory-mapped addresses
    const addrInfo = this.lookupGlobalAddress(instr.variableName);
    if (addrInfo) {
      if (addrInfo.isZeroPage) {
        this.emitStaZeroPage(addrInfo.address, `Store ${instr.variableName}`);
      } else {
        this.emitStaAbsolute(addrInfo.address, `Store ${instr.variableName}`);
      }
      return;
    }

    // Check global label-based variables
    const label = this.lookupGlobalLabel(instr.variableName);
    if (label) {
      this.emitInstruction('STA', label, `Store ${instr.variableName}`, 3);
      return;
    }

    // Unknown variable - try to allocate as local (lazy allocation)
    // Default to byte type for unknown variables
    const zpAddr = this.allocateLocalVariable(instr.variableName, 'byte');
    if (zpAddr !== undefined) {
      this.emitStaZeroPage(zpAddr, `Store ${instr.variableName} (auto-allocated local)`);
    } else {
      this.emitComment(`STUB: Unknown variable ${instr.variableName}`);
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

    // Use the same label format as function definition
    const label = this.getFunctionLabel(instr.functionName);
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

    // Use the same label format as function definition
    const label = this.getFunctionLabel(instr.functionName);
    this.emitJsr(label, `Call ${instr.functionName}`);
  }

  /**
   * Generates code for binary operations
   *
   * Handles arithmetic, bitwise, and comparison operations.
   * Assumes left operand is already loaded in accumulator (A),
   * and right operand is available as immediate or in memory.
   *
   * @param instr - Binary instruction
   */
  protected generateBinaryOp(instr: ILBinaryInstruction): void {
    const op = this.getOperatorSymbol(instr.opcode);
    this.emitComment(`${instr.result} = ${instr.left} ${op} ${instr.right}`);

    switch (instr.opcode) {
      // ====== Arithmetic Operations ======
      case ILOpcode.ADD:
        // Proper 6502 addition: CLC then ADC
        this.emitInstruction('CLC', undefined, 'Clear carry for add', 1);
        this.emitInstruction('ADC', '#$00', 'STUB: Add placeholder', 2);
        break;

      case ILOpcode.SUB:
        // Proper 6502 subtraction: SEC then SBC
        this.emitInstruction('SEC', undefined, 'Set carry for subtract', 1);
        this.emitInstruction('SBC', '#$00', 'STUB: Subtract placeholder', 2);
        break;

      // ====== Bitwise Operations ======
      case ILOpcode.AND:
        // 6502 AND instruction: A = A & operand
        this.emitInstruction('AND', '#$00', 'STUB: AND placeholder', 2);
        break;

      case ILOpcode.OR:
        // 6502 ORA instruction: A = A | operand
        this.emitInstruction('ORA', '#$00', 'STUB: ORA placeholder', 2);
        break;

      case ILOpcode.XOR:
        // 6502 EOR (exclusive OR) instruction: A = A ^ operand
        this.emitInstruction('EOR', '#$00', 'STUB: EOR placeholder', 2);
        break;

      // ====== Comparison Operations ======
      // All comparisons use CMP instruction which sets flags:
      // - Z flag: set if A == operand
      // - C flag: set if A >= operand (unsigned)
      // - N flag: set if result bit 7 is set
      // Track the comparison opcode for subsequent BRANCH instruction to select
      // the appropriate 6502 branch instruction.
      case ILOpcode.CMP_EQ:
        // Equal: Z flag set after CMP
        this.emitInstruction('CMP', '#$00', 'STUB: Compare for equality', 2);
        this.lastComparisonOpcode = ILOpcode.CMP_EQ;
        break;

      case ILOpcode.CMP_NE:
        // Not equal: Z flag clear after CMP
        this.emitInstruction('CMP', '#$00', 'STUB: Compare for inequality', 2);
        this.lastComparisonOpcode = ILOpcode.CMP_NE;
        break;

      case ILOpcode.CMP_LT:
        // Less than (unsigned): C flag clear after CMP
        this.emitInstruction('CMP', '#$00', 'STUB: Compare for less than', 2);
        this.lastComparisonOpcode = ILOpcode.CMP_LT;
        break;

      case ILOpcode.CMP_LE:
        // Less than or equal (unsigned): C clear OR Z set
        this.emitInstruction('CMP', '#$00', 'STUB: Compare for less than or equal', 2);
        this.lastComparisonOpcode = ILOpcode.CMP_LE;
        break;

      case ILOpcode.CMP_GT:
        // Greater than (unsigned): C set AND Z clear
        this.emitInstruction('CMP', '#$00', 'STUB: Compare for greater than', 2);
        this.lastComparisonOpcode = ILOpcode.CMP_GT;
        break;

      case ILOpcode.CMP_GE:
        // Greater than or equal (unsigned): C flag set after CMP
        this.emitInstruction('CMP', '#$00', 'STUB: Compare for greater than or equal', 2);
        this.lastComparisonOpcode = ILOpcode.CMP_GE;
        break;

      default:
        // Other binary ops - placeholder for future implementation
        this.emitComment(`TODO: Binary op ${instr.opcode} not yet implemented`);
        this.emitNop('Placeholder');
        break;
    }
  }

  /**
   * Generates code for unary operations
   *
   * Implements:
   * - NEG (unary minus): Two's complement negation via EOR #$FF + CLC + ADC #$01
   * - NOT (bitwise NOT): EOR #$FF
   * - LOGICAL_NOT: Compare with 0 and invert
   *
   * @param instr - Unary instruction
   */
  protected generateUnaryOp(instr: ILUnaryInstruction): void {
    const op = this.getUnaryOperatorSymbol(instr.opcode);
    this.emitComment(`${instr.result} = ${op}${instr.operand}`);

    switch (instr.opcode) {
      case ILOpcode.NOT:
        // Bitwise NOT: A = ~A (flip all bits)
        this.emitInstruction('EOR', '#$FF', 'Bitwise NOT', 2);
        break;

      case ILOpcode.NEG:
        // Two's complement negation: -A = ~A + 1 = EOR #$FF, CLC, ADC #$01
        // This converts a value to its negative: 5 -> -5 (0xFB)
        this.emitInstruction('EOR', '#$FF', 'Negate: flip all bits', 2);
        this.emitInstruction('CLC', undefined, 'Clear carry for add', 1);
        this.emitInstruction('ADC', '#$01', 'Add 1 to complete two\'s complement', 2);
        break;

      case ILOpcode.LOGICAL_NOT:
        // Logical NOT: true -> false, false -> true
        // If A == 0, result = 1; else result = 0
        // CMP #$00; BEQ +3; LDA #$00; BEQ +2; LDA #$01
        // Simplified: EOR #$FF converts 0 to $FF (truthy) and non-zero to potentially 0
        // Better approach: use CMP and branch
        this.emitInstruction('CMP', '#$00', 'Compare with 0', 2);
        this.emitComment('STUB: Logical NOT needs branch (simplified)');
        this.emitInstruction('BEQ', '+$04', 'If zero, skip to set 1', 2);
        this.emitInstruction('LDA', '#$00', 'Was non-zero, result = false', 2);
        this.emitInstruction('BNE', '+$02', 'Skip over next instruction', 2);
        this.emitInstruction('LDA', '#$01', 'Was zero, result = true', 2);
        break;

      default:
        this.emitComment(`Unknown unary op: ${instr.opcode}`);
        this.emitNop('STUB: Unknown unary op');
        break;
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
      case ILOpcode.CPU_BRK:
        this.emitInstruction('BRK', undefined, 'Software interrupt', 1);
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
  // ADDRESS OPERATIONS (TIER 1 - FULLY TRANSLATED)
  // ============================================

  /**
   * Generates code for LOAD_ADDRESS instruction
   *
   * Loads the 16-bit address of a variable or function into memory.
   * Uses ACME's `<label` (low byte) and `>label` (high byte) syntax.
   *
   * For variables: loads the address where the variable is stored.
   * For functions: loads the entry point address of the function.
   *
   * Generated pattern (for storing to a word variable):
   *   LDA #<label    ; Load low byte of address
   *   STA target     ; Store low byte
   *   LDA #>label    ; Load high byte of address
   *   STA target+1   ; Store high byte
   *
   * For now, this generates a simplified pattern that leaves
   * the address in a temporary location. The full implementation
   * would integrate with register allocation.
   *
   * @param instr - Load address instruction
   */
  protected generateLoadAddress(instr: ILLoadAddressInstruction): void {
    const symbolName = instr.getSymbolName();
    const symbolKind = instr.getSymbolKind();

    // Resolve the label for this symbol
    const label = this.resolveSymbolLabel(symbolName, symbolKind);

    // Emit comment explaining what we're doing
    this.emitComment(`${instr.result} = @${symbolName} (${symbolKind} address)`);

    // Generate code to load the address
    // For now, we load low byte into A (which is the common case for 8-bit ops)
    // Full 16-bit handling would store both bytes somewhere
    this.emitInstruction('LDA', `#<${label}`, `Low byte of ${symbolName} address`, 2);

    // For word operations, we'd also need the high byte
    // This is a simplified stub - full implementation would handle
    // 16-bit register allocation and storage
    this.emitComment(`NOTE: High byte available via #>${label}`);
  }

  /**
   * Resolves a symbol name to its assembly label.
   *
   * Variables use their storage label, functions use their entry point label.
   *
   * @param symbolName - The symbol name from IL
   * @param symbolKind - Whether this is a 'variable' or 'function'
   * @returns The assembly label to use
   */
  protected resolveSymbolLabel(
    symbolName: string,
    symbolKind: 'variable' | 'function',
  ): string {
    if (symbolKind === 'function') {
      // Functions use _name convention
      return `_${symbolName}`;
    }

    // For variables, check if we have a known label
    const varLabel = this.lookupGlobalLabel(symbolName);
    if (varLabel) {
      return varLabel;
    }

    // Check for mapped address
    const addrInfo = this.lookupGlobalAddress(symbolName);
    if (addrInfo) {
      // Return the hex address for hardware-mapped variables
      return this.formatHex(addrInfo.address);
    }

    // Default: use underscore-prefixed name as label
    return `_${symbolName}`;
  }

  // ============================================
  // MEMORY INTRINSIC INSTRUCTIONS
  // ============================================

  /**
   * Zero-page pointer used for indirect addressing.
   *
   * $FB/$FC are the standard C64 "FNADR" (filename address) locations
   * which are safe to use as a temporary pointer in user programs.
   */
  protected static readonly ZP_PTR = 0xfb;
  protected static readonly ZP_PTR_HI = 0xfc;

  /**
   * Generates code for INTRINSIC_PEEK instruction.
   *
   * Loads a byte from the address specified in the address operand.
   * Uses indirect addressing via zero-page pointer for non-constant addresses.
   *
   * If the optimizer transformed this to HARDWARE_READ, it wouldn't reach here.
   * This handles the case where the address is a runtime expression.
   *
   * Generated code pattern:
   *   ; Address assumed in (addr_lo, addr_hi) - setup from previous instructions
   *   LDY #$00           ; Y = 0 for indirect indexed addressing
   *   LDA ($FB),Y        ; Load byte from address in $FB/$FC
   *
   * @param instr - Peek instruction
   */
  protected generatePeek(instr: ILPeekInstruction): void {
    this.emitComment(`peek(${instr.address}) -> ${instr.result}`);

    // For non-constant addresses, we use indirect addressing through ZP pointer.
    // The address value should have been set up by previous instructions.
    // In a complete implementation, we'd track where the address value is stored.

    // For now, we assume the address computation left the result somewhere accessible.
    // The most common case is that the address was computed via ADD and is in A (low) 
    // and needs proper 16-bit handling.

    // Simplified implementation: use ZP indirect addressing
    // Previous instructions should have stored address to $FB/$FC
    this.emitInstruction('LDY', '#$00', 'Y = 0 for indirect indexed', 2);
    this.emitInstruction('LDA', `(${this.formatZeroPage(InstructionGenerator.ZP_PTR)}),Y`, `Load from address in ${this.formatZeroPage(InstructionGenerator.ZP_PTR)}`, 2);

    // Note: Full implementation requires register allocation to know where address value is
    this.addWarning(
      `PEEK with non-constant address uses simplified indirect addressing`,
      instr.metadata.location
    );
  }

  /**
   * Generates code for INTRINSIC_POKE instruction.
   *
   * Stores a byte to the address specified in the address operand.
   * Uses indirect addressing via zero-page pointer for non-constant addresses.
   *
   * If the optimizer transformed this to HARDWARE_WRITE, it wouldn't reach here.
   * This handles the case where the address is a runtime expression.
   *
   * Generated code pattern:
   *   ; Address assumed in $FB/$FC from previous setup
   *   ; Value assumed in A from previous instruction
   *   LDY #$00           ; Y = 0 for indirect indexed addressing
   *   STA ($FB),Y        ; Store byte to address in $FB/$FC
   *
   * @param instr - Poke instruction
   */
  protected generatePoke(instr: ILPokeInstruction): void {
    this.emitComment(`poke(${instr.address}, ${instr.value})`);

    // For non-constant addresses, we use indirect addressing through ZP pointer.
    // The address value should have been computed and stored to $FB/$FC.
    // The value to store should be in A.

    // Simplified implementation: use ZP indirect addressing
    // Assumes:
    // 1. Address is in $FB (low) / $FC (high)
    // 2. Value to store is in A

    this.emitInstruction('LDY', '#$00', 'Y = 0 for indirect indexed', 2);
    this.emitInstruction('STA', `(${this.formatZeroPage(InstructionGenerator.ZP_PTR)}),Y`, `Store to address in ${this.formatZeroPage(InstructionGenerator.ZP_PTR)}`, 2);

    // Note: Full implementation requires register allocation to know where address/value are
    this.addWarning(
      `POKE with non-constant address uses simplified indirect addressing`,
      instr.metadata.location
    );
  }

  /**
   * Generates code for INTRINSIC_PEEKW instruction.
   *
   * Reads a 16-bit word (little-endian) from the specified address.
   * Uses indirect addressing for non-constant addresses.
   *
   * Generated code pattern:
   *   LDY #$00           ; Y = 0
   *   LDA ($FB),Y        ; Load low byte
   *   TAX                ; Save low byte in X
   *   INY                ; Y = 1
   *   LDA ($FB),Y        ; Load high byte (now in A)
   *   ; Result: low byte in X, high byte in A
   *
   * @param instr - Peekw instruction
   */
  protected generatePeekw(instr: ILPeekwInstruction): void {
    this.emitComment(`peekw(${instr.address}) -> ${instr.result}`);

    // Read 16-bit word using indirect addressing
    this.emitInstruction('LDY', '#$00', 'Y = 0 for low byte', 2);
    this.emitInstruction('LDA', `(${this.formatZeroPage(InstructionGenerator.ZP_PTR)}),Y`, 'Load low byte', 2);
    this.emitInstruction('TAX', undefined, 'Save low byte in X', 1);
    this.emitInstruction('INY', undefined, 'Y = 1 for high byte', 1);
    this.emitInstruction('LDA', `(${this.formatZeroPage(InstructionGenerator.ZP_PTR)}),Y`, 'Load high byte', 2);
    // Result: low byte in X, high byte in A

    this.addWarning(
      `PEEKW with non-constant address uses simplified indirect addressing`,
      instr.metadata.location
    );
  }

  /**
   * Generates code for INTRINSIC_POKEW instruction.
   *
   * Writes a 16-bit word (little-endian) to the specified address.
   * Uses indirect addressing for non-constant addresses.
   *
   * Assumes: low byte in X, high byte in A (or similar setup from prior instructions).
   *
   * Generated code pattern:
   *   ; Assumes value: low byte computed first, high byte in A
   *   PHA                ; Save high byte
   *   TXA                ; Get low byte from X
   *   LDY #$00           ; Y = 0
   *   STA ($FB),Y        ; Store low byte
   *   INY                ; Y = 1
   *   PLA                ; Restore high byte
   *   STA ($FB),Y        ; Store high byte
   *
   * @param instr - Pokew instruction
   */
  protected generatePokew(instr: ILPokewInstruction): void {
    this.emitComment(`pokew(${instr.address}, ${instr.value})`);

    // Write 16-bit word using indirect addressing
    // This is a simplified pattern - full implementation needs register allocation
    this.emitInstruction('PHA', undefined, 'Save high byte', 1);
    this.emitInstruction('TXA', undefined, 'Get low byte from X', 1);
    this.emitInstruction('LDY', '#$00', 'Y = 0 for low byte', 2);
    this.emitInstruction('STA', `(${this.formatZeroPage(InstructionGenerator.ZP_PTR)}),Y`, 'Store low byte', 2);
    this.emitInstruction('INY', undefined, 'Y = 1 for high byte', 1);
    this.emitInstruction('PLA', undefined, 'Restore high byte', 1);
    this.emitInstruction('STA', `(${this.formatZeroPage(InstructionGenerator.ZP_PTR)}),Y`, 'Store high byte', 2);

    this.addWarning(
      `POKEW with non-constant address uses simplified indirect addressing`,
      instr.metadata.location
    );
  }

  // ============================================
  // BYTE EXTRACTION INTRINSICS
  // ============================================

  /**
   * Generates code for INTRINSIC_LO instruction.
   *
   * Extracts the low byte of a 16-bit word value.
   * For little-endian storage, the low byte is at the base address.
   *
   * In most cases, the low byte is already in the accumulator from
   * previous 16-bit operations. This method handles the case where
   * the value is in a zero-page location.
   *
   * @param instr - Lo instruction
   */
  protected generateLo(instr: ILLoInstruction): void {
    this.emitComment(`lo(${instr.source}) -> ${instr.result}`);

    // For runtime values, we assume the 16-bit value computation left
    // the result in a known location. The low byte is the first byte.
    // In the current stub architecture, we assume the value is accessible.

    // For zero-page stored values, load the low byte directly
    // For register values, the low byte is already in A (from 16-bit ops)

    // Simplified stub: assume value computed and low byte in A
    // Full implementation would track value locations
    this.emitComment('Low byte extraction (value assumed in A)');
  }

  /**
   * Generates code for INTRINSIC_HI instruction.
   *
   * Extracts the high byte of a 16-bit word value.
   * For little-endian storage, the high byte is at address+1.
   *
   * For runtime values stored in zero page, this loads from zp+1.
   * For values in A/X register pair, this uses X (high byte).
   *
   * @param instr - Hi instruction
   */
  protected generateHi(instr: ILHiInstruction): void {
    this.emitComment(`hi(${instr.source}) -> ${instr.result}`);

    // For runtime values, we need to access the high byte
    // If the 16-bit value is in zero page at $FB/$FC:
    //   LDA $FC loads the high byte
    // If the value is in A(lo)/X(hi) register pair:
    //   TXA transfers high byte to A

    // Simplified stub: assume high byte in X, transfer to A
    this.emitInstruction('TXA', undefined, 'High byte to A', 1);
  }

  // ============================================
  // VOLATILE MEMORY INTRINSICS
  // ============================================

  /**
   * Generates code for VOLATILE_READ instruction.
   *
   * Performs a memory read that cannot be optimized away.
   * Functionally identical to peek(), but marked as volatile
   * so the optimizer will not eliminate or reorder this read.
   *
   * Essential for reading hardware registers where the read
   * itself has side effects (e.g., clearing interrupt flags).
   *
   * @param instr - Volatile read instruction
   */
  protected generateVolatileRead(instr: ILVolatileReadInstruction): void {
    this.emitComment(`volatile_read(${instr.address}) -> ${instr.result} [VOLATILE]`);

    // Same as peek but with volatile marker for optimizer
    // Uses indirect addressing through ZP pointer
    this.emitInstruction('LDY', '#$00', 'Y = 0 for indirect indexed', 2);
    this.emitInstruction(
      'LDA',
      `(${this.formatZeroPage(InstructionGenerator.ZP_PTR)}),Y`,
      'Volatile load from address',
      2
    );
  }

  /**
   * Generates code for VOLATILE_WRITE instruction.
   *
   * Performs a memory write that cannot be optimized away.
   * Functionally identical to poke(), but marked as volatile
   * so the optimizer will not eliminate or reorder this write.
   *
   * Essential for writing to hardware registers where the write
   * must actually occur (even if the value appears unchanged).
   *
   * @param instr - Volatile write instruction
   */
  protected generateVolatileWrite(instr: ILVolatileWriteInstruction): void {
    this.emitComment(`volatile_write(${instr.address}, ${instr.value}) [VOLATILE]`);

    // Same as poke but with volatile marker for optimizer
    // Uses indirect addressing through ZP pointer
    this.emitInstruction('LDY', '#$00', 'Y = 0 for indirect indexed', 2);
    this.emitInstruction(
      'STA',
      `(${this.formatZeroPage(InstructionGenerator.ZP_PTR)}),Y`,
      'Volatile store to address',
      2
    );
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