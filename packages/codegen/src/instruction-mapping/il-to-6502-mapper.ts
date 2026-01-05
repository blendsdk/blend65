/**
 * IL to 6502 instruction mapping system
 * Converts Blend65 IL instructions to 6502 assembly sequences
 */

import {
  ILInstruction,
  ILOperand,
  ILInstructionType,
  ILInstructionMetadata
} from '@blend65/il';
import { CommodorePlatform } from '../platform/commodore-platform.js';

export interface CodeGenContext {
  /** Current platform for code generation */
  platform: CommodorePlatform;
  /** Available 6502 registers */
  registers: {
    a: boolean;  // Accumulator available
    x: boolean;  // X register available
    y: boolean;  // Y register available
  };
  /** Current stack depth */
  stackDepth: number;
  /** Label counter for unique labels */
  labelCounter: number;
  /** Current function context */
  currentFunction?: string;
}

export interface MappingResult {
  /** Generated 6502 assembly */
  assembly: string[];
  /** Modified register state */
  registersUsed: ('a' | 'x' | 'y')[];
  /** Stack depth change */
  stackChange: number;
  /** Generated labels */
  labels: string[];
}

/**
 * Maps IL instructions to 6502 assembly sequences
 * Handles register allocation, addressing modes, and platform-specific optimizations
 */
export class ILTo6502Mapper {
  constructor(private context: CodeGenContext) {}

  /**
   * Map single IL instruction to 6502 assembly
   */
  mapInstruction(instruction: ILInstruction): MappingResult {
    const result: MappingResult = {
      assembly: [],
      registersUsed: [],
      stackChange: 0,
      labels: []
    };

    // Add source mapping comment if available
    if (instruction.sourceLocation) {
      const { line, column } = instruction.sourceLocation;
      result.assembly.push(`; Line ${line}:${column}`);
    }

    // Map by instruction type
    switch (instruction.type) {
      case ILInstructionType.LOAD_IMMEDIATE:
        return this.mapLoadImmediate(instruction, result);

      case ILInstructionType.LOAD_MEMORY:
        return this.mapLoadMemory(instruction, result);

      case ILInstructionType.STORE_MEMORY:
        return this.mapStoreMemory(instruction, result);

      case ILInstructionType.COPY:
        return this.mapCopy(instruction, result);

      case ILInstructionType.ADD:
        return this.mapAdd(instruction, result);

      case ILInstructionType.SUB:
        return this.mapSubtract(instruction, result);

      case ILInstructionType.MUL:
        return this.mapMultiply(instruction, result);

      case ILInstructionType.DIV:
        return this.mapDivide(instruction, result);

      case ILInstructionType.COMPARE_EQ:
      case ILInstructionType.COMPARE_NE:
      case ILInstructionType.COMPARE_LT:
      case ILInstructionType.COMPARE_LE:
      case ILInstructionType.COMPARE_GT:
      case ILInstructionType.COMPARE_GE:
        return this.mapCompare(instruction, result);

      case ILInstructionType.BRANCH:
        return this.mapBranch(instruction, result);

      case ILInstructionType.BRANCH_IF_TRUE:
      case ILInstructionType.BRANCH_IF_FALSE:
      case ILInstructionType.BRANCH_IF_ZERO:
      case ILInstructionType.BRANCH_IF_NOT_ZERO:
        return this.mapConditionalBranch(instruction, result);

      case ILInstructionType.CALL:
        return this.mapCall(instruction, result);

      case ILInstructionType.RETURN:
        return this.mapReturn(instruction, result);

      case ILInstructionType.LABEL:
        return this.mapLabel(instruction, result);

      case ILInstructionType.NOP:
        return this.mapNop(instruction, result);

      default:
        throw new Error(`Unsupported IL instruction type: ${instruction.type}`);
    }
  }

  /**
   * Map LOAD_IMMEDIATE instruction: Load immediate value into register/memory
   */
  private mapLoadImmediate(instruction: ILInstruction, result: MappingResult): MappingResult {
    const value = instruction.operands[0];
    const dest = instruction.result;

    if (!value || !('valueType' in value)) {
      throw new Error('LOAD_IMMEDIATE instruction requires immediate value operand');
    }

    if (value.valueType === 'constant') {
      result.assembly.push(`LDA #${value.value}    ; Load immediate ${value.value}`);
    } else {
      throw new Error('LOAD_IMMEDIATE requires constant operand');
    }

    // Store to destination if specified
    if (dest && 'valueType' in dest) {
      if (dest.valueType === 'variable') {
        result.assembly.push(`STA ${dest.name}     ; Store to variable ${dest.name}`);
      } else if (dest.valueType === 'memory') {
        const addr = 'address' in dest ? dest.address : null;
        if (addr && 'valueType' in addr && addr.valueType === 'constant') {
          result.assembly.push(`STA $${(addr.value as number).toString(16).toUpperCase()}  ; Store to memory`);
        }
      }
    }

    result.registersUsed.push('a');
    return result;
  }

  /**
   * Map LOAD_MEMORY instruction: Load from memory location
   */
  private mapLoadMemory(instruction: ILInstruction, result: MappingResult): MappingResult {
    const source = instruction.operands[0];

    if (!source || !('valueType' in source)) {
      throw new Error('LOAD_MEMORY instruction requires memory operand');
    }

    if (source.valueType === 'variable') {
      result.assembly.push(`LDA ${source.name}     ; Load variable ${source.name}`);
    } else if (source.valueType === 'memory') {
      const addr = 'address' in source ? source.address : null;
      if (addr && 'valueType' in addr && addr.valueType === 'constant') {
        result.assembly.push(`LDA $${(addr.value as number).toString(16).toUpperCase()}  ; Load from memory`);
      }
    } else if (source.valueType === 'constant') {
      // Direct address
      result.assembly.push(`LDA $${(source.value as number).toString(16).toUpperCase()}  ; Load from address`);
    } else {
      throw new Error(`Unsupported LOAD_MEMORY operand type: ${source.valueType}`);
    }

    result.registersUsed.push('a');
    return result;
  }

  /**
   * Map STORE_MEMORY instruction: Store to memory location
   */
  private mapStoreMemory(instruction: ILInstruction, result: MappingResult): MappingResult {
    const dest = instruction.operands[0];
    const source = instruction.operands[1];

    if (!dest || !('valueType' in dest)) {
      throw new Error('STORE_MEMORY instruction requires destination operand');
    }

    // Load source value if needed
    if (source && 'valueType' in source) {
      if (source.valueType === 'constant') {
        result.assembly.push(`LDA #${source.value}    ; Load value to store`);
      } else if (source.valueType === 'variable') {
        result.assembly.push(`LDA ${source.name}     ; Load variable to store`);
      }
    }

    // Store to destination
    if (dest.valueType === 'variable') {
      result.assembly.push(`STA ${dest.name}     ; Store to variable ${dest.name}`);
    } else if (dest.valueType === 'memory') {
      const addr = 'address' in dest ? dest.address : null;
      if (addr && 'valueType' in addr && addr.valueType === 'constant') {
        result.assembly.push(`STA $${(addr.value as number).toString(16).toUpperCase()}  ; Store to memory`);
      }
    } else if (dest.valueType === 'constant') {
      // Direct address
      result.assembly.push(`STA $${(dest.value as number).toString(16).toUpperCase()}  ; Store to address`);
    } else {
      throw new Error(`Unsupported STORE_MEMORY destination type: ${dest.valueType}`);
    }

    result.registersUsed.push('a');
    return result;
  }

  /**
   * Map COPY instruction: Copy value from source to destination
   */
  private mapCopy(instruction: ILInstruction, result: MappingResult): MappingResult {
    const source = instruction.operands[0];
    const dest = instruction.result;

    if (!source || !('valueType' in source)) {
      throw new Error('COPY instruction requires source operand');
    }

    // Load source value
    if (source.valueType === 'constant') {
      result.assembly.push(`LDA #${source.value}    ; Load constant ${source.value}`);
    } else if (source.valueType === 'variable') {
      result.assembly.push(`LDA ${source.name}     ; Load variable ${source.name}`);
    } else {
      throw new Error(`Unsupported COPY source type: ${source.valueType}`);
    }

    // Store to destination
    if (dest && 'valueType' in dest) {
      if (dest.valueType === 'variable') {
        result.assembly.push(`STA ${dest.name}     ; Store to variable ${dest.name}`);
      }
    }

    result.registersUsed.push('a');
    return result;
  }

  /**
   * Map ADD instruction: Add operands
   */
  private mapAdd(instruction: ILInstruction, result: MappingResult): MappingResult {
    const left = instruction.operands[0];
    const right = instruction.operands[1];

    if (!left || !('valueType' in left)) {
      throw new Error('ADD instruction requires left operand');
    }

    // Load first operand into accumulator
    if (left.valueType === 'constant') {
      result.assembly.push(`LDA #${left.value}    ; Load left operand`);
    } else if (left.valueType === 'variable') {
      result.assembly.push(`LDA ${left.name}     ; Load left operand`);
    }

    result.assembly.push('CLC              ; Clear carry for addition');

    // Add second operand
    if (right && 'valueType' in right) {
      if (right.valueType === 'constant') {
        result.assembly.push(`ADC #${right.value}    ; Add right operand`);
      } else if (right.valueType === 'variable') {
        result.assembly.push(`ADC ${right.name}     ; Add right operand`);
      }
    }

    result.registersUsed.push('a');
    return result;
  }

  /**
   * Map SUB instruction: Subtract operands
   */
  private mapSubtract(instruction: ILInstruction, result: MappingResult): MappingResult {
    const left = instruction.operands[0];
    const right = instruction.operands[1];

    if (!left || !('valueType' in left)) {
      throw new Error('SUB instruction requires left operand');
    }

    // Load first operand into accumulator
    if (left.valueType === 'constant') {
      result.assembly.push(`LDA #${left.value}    ; Load left operand`);
    } else if (left.valueType === 'variable') {
      result.assembly.push(`LDA ${left.name}     ; Load left operand`);
    }

    result.assembly.push('SEC              ; Set carry for subtraction');

    // Subtract second operand
    if (right && 'valueType' in right) {
      if (right.valueType === 'constant') {
        result.assembly.push(`SBC #${right.value}    ; Subtract right operand`);
      } else if (right.valueType === 'variable') {
        result.assembly.push(`SBC ${right.name}     ; Subtract right operand`);
      }
    }

    result.registersUsed.push('a');
    return result;
  }

  /**
   * Map MUL instruction: 8-bit multiplication
   */
  private mapMultiply(instruction: ILInstruction, result: MappingResult): MappingResult {
    const left = instruction.operands[0];
    const right = instruction.operands[1];

    if (!left || !('valueType' in left)) {
      throw new Error('MUL instruction requires operands');
    }

    // Load first operand into accumulator
    if (left.valueType === 'constant') {
      result.assembly.push(`LDA #${left.value}    ; Load multiplicand`);
    } else if (left.valueType === 'variable') {
      result.assembly.push(`LDA ${left.name}     ; Load multiplicand`);
    }

    // Generate label for multiplication routine
    const mulLabel = `mul_${this.context.labelCounter++}`;
    result.labels.push(mulLabel);

    result.assembly.push('; 8-bit multiplication routine');
    result.assembly.push('LDY #8           ; 8 bits to process');
    result.assembly.push('LDX #0           ; Clear result high byte');
    result.assembly.push(`${mulLabel}:`);
    result.assembly.push('LSR A            ; Shift multiplier right');
    result.assembly.push('BCC +            ; Skip if bit is 0');
    result.assembly.push('TXA              ; Get result high byte');

    // Add multiplier based on operand type
    if (right && 'valueType' in right) {
      if (right.valueType === 'constant') {
        result.assembly.push(`ADC #${right.value}    ; Add multiplier`);
      } else if (right.valueType === 'variable') {
        result.assembly.push(`ADC ${right.name}     ; Add multiplier`);
      }
    }

    result.assembly.push('TAX              ; Store result high byte');
    result.assembly.push('+ ROR A          ; Rotate result');
    result.assembly.push('ROR              ; Rotate accumulator');
    result.assembly.push('DEY              ; Decrement bit counter');
    result.assembly.push(`BNE ${mulLabel}  ; Continue if not done`);

    result.registersUsed.push('a', 'x', 'y');
    return result;
  }

  /**
   * Map DIV instruction: 8-bit division
   */
  private mapDivide(instruction: ILInstruction, result: MappingResult): MappingResult {
    const left = instruction.operands[0];
    const right = instruction.operands[1];

    if (!left || !('valueType' in left)) {
      throw new Error('DIV instruction requires operands');
    }

    // Load dividend into accumulator
    if (left.valueType === 'constant') {
      result.assembly.push(`LDA #${left.value}    ; Load dividend`);
    } else if (left.valueType === 'variable') {
      result.assembly.push(`LDA ${left.name}     ; Load dividend`);
    }

    // Generate label for division routine
    const divLabel = `div_${this.context.labelCounter++}`;
    result.labels.push(divLabel);

    result.assembly.push('; 8-bit division routine');
    result.assembly.push('LDY #8           ; 8 bits to process');
    result.assembly.push('LDX #0           ; Clear remainder');
    result.assembly.push(`${divLabel}:`);
    result.assembly.push('ASL A            ; Shift dividend left');
    result.assembly.push('ROL X            ; Rotate remainder left');
    result.assembly.push('TXA              ; Get remainder');
    result.assembly.push('SEC              ; Set carry for subtraction');

    // Subtract divisor based on operand type
    if (right && 'valueType' in right) {
      if (right.valueType === 'constant') {
        result.assembly.push(`SBC #${right.value}    ; Subtract divisor`);
      } else if (right.valueType === 'variable') {
        result.assembly.push(`SBC ${right.name}     ; Subtract divisor`);
      }
    }

    result.assembly.push('BCC +            ; Skip if underflow');
    result.assembly.push('TAX              ; Store new remainder');
    result.assembly.push('INC A            ; Set quotient bit');
    result.assembly.push('+ DEY            ; Decrement bit counter');
    result.assembly.push(`BNE ${divLabel}  ; Continue if not done`);

    result.registersUsed.push('a', 'x', 'y');
    return result;
  }

  /**
   * Map compare instructions
   */
  private mapCompare(instruction: ILInstruction, result: MappingResult): MappingResult {
    const left = instruction.operands[0];
    const right = instruction.operands[1];

    if (!left || !('valueType' in left)) {
      throw new Error('Compare instruction requires left operand');
    }

    // Load first operand into accumulator
    if (left.valueType === 'constant') {
      result.assembly.push(`LDA #${left.value}    ; Load left operand`);
    } else if (left.valueType === 'variable') {
      result.assembly.push(`LDA ${left.name}     ; Load left operand`);
    }

    // Compare with second operand
    if (right && 'valueType' in right) {
      if (right.valueType === 'constant') {
        result.assembly.push(`CMP #${right.value}    ; Compare with right operand`);
      } else if (right.valueType === 'variable') {
        result.assembly.push(`CMP ${right.name}     ; Compare with right operand`);
      }
    }

    result.registersUsed.push('a');
    return result;
  }

  /**
   * Map BRANCH instruction: Unconditional branch
   */
  private mapBranch(instruction: ILInstruction, result: MappingResult): MappingResult {
    const target = instruction.operands[0];

    if (!target || !('valueType' in target) || target.valueType !== 'label') {
      throw new Error('BRANCH instruction requires label operand');
    }

    result.assembly.push(`JMP ${target.name}      ; Unconditional branch`);
    return result;
  }

  /**
   * Map conditional branch instructions
   */
  private mapConditionalBranch(instruction: ILInstruction, result: MappingResult): MappingResult {
    const condition = instruction.operands[0];
    const target = instruction.operands[1];

    if (!target || !('valueType' in target) || target.valueType !== 'label') {
      throw new Error('Conditional branch instruction requires label operand');
    }

    // Map instruction type to 6502 branch instruction
    switch (instruction.type) {
      case ILInstructionType.BRANCH_IF_TRUE:
        // Assume condition is already in flags (from previous compare)
        result.assembly.push(`BNE ${target.name}      ; Branch if true (not zero)`);
        break;

      case ILInstructionType.BRANCH_IF_FALSE:
        result.assembly.push(`BEQ ${target.name}      ; Branch if false (zero)`);
        break;

      case ILInstructionType.BRANCH_IF_ZERO:
        result.assembly.push(`BEQ ${target.name}      ; Branch if zero`);
        break;

      case ILInstructionType.BRANCH_IF_NOT_ZERO:
        result.assembly.push(`BNE ${target.name}      ; Branch if not zero`);
        break;

      default:
        throw new Error(`Unsupported conditional branch: ${instruction.type}`);
    }

    return result;
  }

  /**
   * Map CALL instruction: Function call
   */
  private mapCall(instruction: ILInstruction, result: MappingResult): MappingResult {
    const target = instruction.operands[0];

    if (!target || !('valueType' in target)) {
      throw new Error('CALL instruction requires function operand');
    }

    if (target.valueType === 'label') {
      result.assembly.push(`JSR ${target.name}      ; Call function`);
    } else if (target.valueType === 'variable') {
      result.assembly.push(`JSR ${target.name}      ; Call function`);
    } else {
      throw new Error('CALL instruction requires label or function name');
    }

    result.stackChange = 2; // JSR pushes 2 bytes on stack
    return result;
  }

  /**
   * Map RETURN instruction: Function return
   */
  private mapReturn(instruction: ILInstruction, result: MappingResult): MappingResult {
    const returnValue = instruction.operands[0];

    // Load return value if specified
    if (returnValue && 'valueType' in returnValue) {
      if (returnValue.valueType === 'constant') {
        result.assembly.push(`LDA #${returnValue.value}    ; Load return value`);
      } else if (returnValue.valueType === 'variable') {
        result.assembly.push(`LDA ${returnValue.name}     ; Load return value`);
      }
    }

    result.assembly.push('RTS              ; Return from subroutine');
    result.stackChange = -2; // RTS pops 2 bytes from stack
    return result;
  }

  /**
   * Map LABEL instruction: Code label
   */
  private mapLabel(instruction: ILInstruction, result: MappingResult): MappingResult {
    const label = instruction.operands[0];

    if (!label || !('valueType' in label) || label.valueType !== 'label') {
      throw new Error('LABEL instruction requires label operand');
    }

    result.assembly.push(`${label.name}:           ; Label`);
    result.labels.push(label.name);
    return result;
  }

  /**
   * Map NOP instruction: No operation
   */
  private mapNop(instruction: ILInstruction, result: MappingResult): MappingResult {
    result.assembly.push('NOP           ; No operation');
    return result;
  }

  /**
   * Resolve variable address based on storage class
   */
  private resolveVariableAddress(variableName: string): number {
    // This would typically consult the symbol table
    // For now, assume zero page allocation
    return this.context.platform.allocateZeroPage(variableName);
  }

  /**
   * Generate unique label
   */
  private generateLabel(prefix: string = 'L'): string {
    return `${prefix}${this.context.labelCounter++}`;
  }
}
