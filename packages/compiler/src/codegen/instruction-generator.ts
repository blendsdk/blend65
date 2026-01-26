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
} from '../il/instructions.js';
import { GlobalsGenerator } from './globals-generator.js';

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

      // ====== Address Operations ======
      case ILOpcode.LOAD_ADDRESS:
        this.generateLoadAddress(instr as ILLoadAddressInstruction);
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
   * Loads a constant value into the accumulator.
   *
   * @param instr - Const instruction
   */
  protected generateConst(instr: ILConstInstruction): void {
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
  // MEMORY INTRINSIC INSTRUCTIONS (TIER 3 - PLACEHOLDER)
  // ============================================

  /**
   * Generates placeholder for INTRINSIC_PEEK instruction.
   *
   * STUB: The optimizer should transform PEEK with constant address
   * to HARDWARE_READ before it reaches codegen.
   *
   * @param instr - Peek instruction
   */
  protected generatePeek(instr: ILPeekInstruction): void {
    this.emitComment(`STUB: ${instr.toString()}`);
    this.emitComment('NOTE: Optimizer should transform PEEK to HARDWARE_READ');
    this.emitNop('Placeholder for PEEK');
    this.addWarning(
      `PEEK intrinsic not yet implemented - waiting for optimizer`,
      instr.metadata.location
    );
  }

  /**
   * Generates placeholder for INTRINSIC_POKE instruction.
   *
   * STUB: The optimizer should transform POKE with constant address
   * to HARDWARE_WRITE before it reaches codegen.
   *
   * @param instr - Poke instruction
   */
  protected generatePoke(instr: ILPokeInstruction): void {
    this.emitComment(`STUB: ${instr.toString()}`);
    this.emitComment('NOTE: Optimizer should transform POKE to HARDWARE_WRITE');
    this.emitNop('Placeholder for POKE');
    this.addWarning(
      `POKE intrinsic not yet implemented - waiting for optimizer`,
      instr.metadata.location
    );
  }

  /**
   * Generates placeholder for INTRINSIC_PEEKW instruction.
   *
   * STUB: Waiting for optimizer to handle constant propagation.
   *
   * @param instr - Peekw instruction
   */
  protected generatePeekw(instr: ILPeekwInstruction): void {
    this.emitComment(`STUB: ${instr.toString()}`);
    this.emitComment('NOTE: 16-bit PEEKW waiting for optimizer support');
    this.emitNop('Placeholder for PEEKW');
    this.addWarning(
      `PEEKW intrinsic not yet implemented - waiting for optimizer`,
      instr.metadata.location
    );
  }

  /**
   * Generates placeholder for INTRINSIC_POKEW instruction.
   *
   * STUB: Waiting for optimizer to handle constant propagation.
   *
   * @param instr - Pokew instruction
   */
  protected generatePokew(instr: ILPokewInstruction): void {
    this.emitComment(`STUB: ${instr.toString()}`);
    this.emitComment('NOTE: 16-bit POKEW waiting for optimizer support');
    this.emitNop('Placeholder for POKEW');
    this.addWarning(
      `POKEW intrinsic not yet implemented - waiting for optimizer`,
      instr.metadata.location
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