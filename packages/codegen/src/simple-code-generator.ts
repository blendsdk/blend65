/**
 * Simplified 6502 code generator for Blend65
 * Basic implementation to enable first compiled programs
 */

import { ILProgram, ILFunction, ILInstruction, ILInstructionType, isILConstant, isILVariable, isILLabel } from '@blend65/il';

export interface SimpleCodeGenOptions {
  /** Target platform (c64, vic20, c128, etc.) */
  target: string;

  /** Include debug information */
  debug: boolean;

  /** Generate auto-run BASIC stub */
  autoRun: boolean;
}

export interface SimpleCodeGenResult {
  /** Generated assembly code */
  assembly: string;

  /** Compilation statistics */
  stats: {
    instructionCount: number;
    codeSize: number;
    compilationTime: number;
  };
}

/**
 * Platform specifications for Commodore systems
 */
const PLATFORM_SPECS = {
  c64: {
    name: 'c64',
    displayName: 'Commodore 64',
    basicStart: 0x0801,
    mlStart: 0x0810,
    processor: '6510'
  },
  vic20: {
    name: 'vic20',
    displayName: 'Commodore VIC-20',
    basicStart: 0x1001,
    mlStart: 0x1010,
    processor: '6502'
  },
  c128: {
    name: 'c128',
    displayName: 'Commodore 128 (C64 mode)',
    basicStart: 0x0801,
    mlStart: 0x0810,
    processor: '8502'
  }
};

/**
 * Simple 6502 code generator
 * Generates basic ACME assembly from Blend65 IL
 */
export class SimpleCodeGenerator {
  private options: SimpleCodeGenOptions;
  private platform: any;

  constructor(options: SimpleCodeGenOptions) {
    this.options = options;
    this.platform = PLATFORM_SPECS[options.target as keyof typeof PLATFORM_SPECS];
    if (!this.platform) {
      throw new Error(`Unsupported platform: ${options.target}`);
    }
  }

  /**
   * Generate 6502 assembly from IL program
   */
  async generate(program: ILProgram): Promise<SimpleCodeGenResult> {
    const startTime = Date.now();
    const lines: string[] = [];

    // Generate header
    lines.push('; ============================================================================');
    lines.push(`; Blend65 Generated Assembly - ${program.name}`);
    lines.push(`; Target Platform: ${this.platform.displayName}`);
    lines.push(`; Generated: ${new Date().toISOString()}`);
    lines.push('; ============================================================================');
    lines.push('');
    lines.push('!cpu 6502        ; Specify processor type');
    lines.push(`!to "${program.name.toLowerCase()}.prg",cbm  ; Output format`);
    lines.push('');

    // Generate BASIC stub if requested
    if (this.options.autoRun) {
      lines.push(...this.generateBasicStub());
      lines.push('');
    }

    // Generate global data section
    if (program.globalData.length > 0) {
      lines.push('; Global Data Section');
      for (const data of program.globalData) {
        const name = data.qualifiedName.join('_') + '_' + data.name;
        if (data.storageClass === 'const' && data.initialValue) {
          lines.push(`${name} = ${data.initialValue.value}  ; Constant`);
        } else if (data.initialValue) {
          lines.push(`${name}: !byte ${data.initialValue.value}  ; Variable`);
        } else {
          lines.push(`${name}: !byte 0  ; Uninitialized variable`);
        }
      }
      lines.push('');
    }

    // Generate code sections
    let instructionCount = 0;
    for (const module of program.modules) {
      lines.push(`; Module: ${module.qualifiedName.join('.')}`);
      lines.push('');

      for (const func of module.functions) {
        const functionLines = this.generateFunction(func);
        lines.push(...functionLines);
        instructionCount += func.instructions.length;
      }
    }

    // Generate cleanup
    lines.push('; Program cleanup');
    lines.push('RTS              ; Return to BASIC');
    lines.push('');

    const assembly = lines.join('\n');

    return {
      assembly,
      stats: {
        instructionCount,
        codeSize: this.estimateCodeSize(assembly),
        compilationTime: Date.now() - startTime
      }
    };
  }

  /**
   * Generate BASIC stub for auto-run
   */
  private generateBasicStub(): string[] {
    const entryPoint = this.platform.mlStart;
    const basicStart = this.platform.basicStart;

    // Calculate next line address (basic start + stub size)
    const nextLineAddr = basicStart + 12; // Approximate BASIC stub size

    return [
      `; BASIC Stub: 10 SYS${entryPoint}`,
      `* = $${basicStart.toString(16).toUpperCase().padStart(4, '0')}`,
      `        !word $${nextLineAddr.toString(16).toUpperCase().padStart(4, '0')}  ; Next line pointer`,
      '        !word 10        ; Line number',
      '        !byte $9E       ; SYS token',
      `        !text "${entryPoint}"`,
      '        !byte $00       ; End of line',
      '        !word $0000     ; End of program',
      '',
      '; Machine code starts here',
      `* = $${entryPoint.toString(16).toUpperCase().padStart(4, '0')}`
    ];
  }

  /**
   * Generate assembly for a function
   */
  private generateFunction(func: ILFunction): string[] {
    const lines: string[] = [];

    // Function header
    lines.push(`; Function: ${func.name}`);
    lines.push(`; Parameters: ${func.parameters.length}`);
    lines.push('');

    // Function label
    const functionLabel = func.qualifiedName.join('_');
    lines.push(`${functionLabel}:`);

    // Generate instructions
    for (const instruction of func.instructions) {
      const asmLines = this.mapInstruction(instruction);
      lines.push(...asmLines.map(line => `    ${line}`));
    }

    lines.push('');
    return lines;
  }

  /**
   * Helper to check if operand is an IL value (not parameter/return reference)
   */
  private isILValue(operand: any): operand is { valueType: string } {
    return operand && typeof operand === 'object' && 'valueType' in operand;
  }

  /**
   * Map IL instruction to 6502 assembly
   */
  private mapInstruction(instruction: ILInstruction): string[] {
    const lines: string[] = [];

    // Add source location comment if available
    if (instruction.sourceLocation) {
      lines.push(`; Line ${instruction.sourceLocation.line}:${instruction.sourceLocation.column}`);
    }

    switch (instruction.type) {
      case ILInstructionType.LOAD_IMMEDIATE: {
        const value = instruction.operands[0];
        if (this.isILValue(value) && isILConstant(value)) {
          lines.push(`LDA #${value.value}    ; Load immediate ${value.value}`);
        }
        break;
      }

      case ILInstructionType.LOAD_MEMORY: {
        const source = instruction.operands[0];
        if (this.isILValue(source)) {
          if (isILVariable(source)) {
            lines.push(`LDA ${source.name}     ; Load variable ${source.name}`);
          } else if (isILConstant(source)) {
            lines.push(`LDA $${(source.value as number).toString(16).toUpperCase()}  ; Load from address`);
          }
        }
        break;
      }

      case ILInstructionType.STORE_MEMORY: {
        const dest = instruction.operands[0];
        if (this.isILValue(dest)) {
          if (isILVariable(dest)) {
            lines.push(`STA ${dest.name}     ; Store to variable ${dest.name}`);
          } else if (isILConstant(dest)) {
            lines.push(`STA $${(dest.value as number).toString(16).toUpperCase()}  ; Store to address`);
          }
        }
        break;
      }

      case ILInstructionType.ADD: {
        const left = instruction.operands[0];
        const right = instruction.operands[1];

        // Load first operand
        if (this.isILValue(left)) {
          if (isILConstant(left)) {
            lines.push(`LDA #${left.value}    ; Load left operand`);
          } else if (isILVariable(left)) {
            lines.push(`LDA ${left.name}     ; Load left operand`);
          }
        }

        lines.push('CLC              ; Clear carry for addition');

        // Add second operand
        if (right && this.isILValue(right)) {
          if (isILConstant(right)) {
            lines.push(`ADC #${right.value}    ; Add right operand`);
          } else if (isILVariable(right)) {
            lines.push(`ADC ${right.name}     ; Add right operand`);
          }
        }
        break;
      }

      case ILInstructionType.SUB: {
        const left = instruction.operands[0];
        const right = instruction.operands[1];

        // Load first operand
        if (this.isILValue(left)) {
          if (isILConstant(left)) {
            lines.push(`LDA #${left.value}    ; Load left operand`);
          } else if (isILVariable(left)) {
            lines.push(`LDA ${left.name}     ; Load left operand`);
          }
        }

        lines.push('SEC              ; Set carry for subtraction');

        // Subtract second operand
        if (right && this.isILValue(right)) {
          if (isILConstant(right)) {
            lines.push(`SBC #${right.value}    ; Subtract right operand`);
          } else if (isILVariable(right)) {
            lines.push(`SBC ${right.name}     ; Subtract right operand`);
          }
        }
        break;
      }

      case ILInstructionType.COMPARE_EQ:
      case ILInstructionType.COMPARE_NE:
      case ILInstructionType.COMPARE_LT:
      case ILInstructionType.COMPARE_LE:
      case ILInstructionType.COMPARE_GT:
      case ILInstructionType.COMPARE_GE: {
        const left = instruction.operands[0];
        const right = instruction.operands[1];

        // Load first operand
        if (this.isILValue(left)) {
          if (isILConstant(left)) {
            lines.push(`LDA #${left.value}    ; Load left operand`);
          } else if (isILVariable(left)) {
            lines.push(`LDA ${left.name}     ; Load left operand`);
          }
        }

        // Compare with second operand
        if (right && this.isILValue(right)) {
          if (isILConstant(right)) {
            lines.push(`CMP #${right.value}    ; Compare with right operand`);
          } else if (isILVariable(right)) {
            lines.push(`CMP ${right.name}     ; Compare with right operand`);
          }
        }
        break;
      }

      case ILInstructionType.BRANCH: {
        const target = instruction.operands[0];
        if (this.isILValue(target) && isILLabel(target)) {
          lines.push(`JMP ${target.name}      ; Unconditional branch`);
        }
        break;
      }

      case ILInstructionType.BRANCH_IF_TRUE: {
        const target = instruction.operands[1] || instruction.operands[0];
        if (this.isILValue(target) && isILLabel(target)) {
          lines.push(`BNE ${target.name}      ; Branch if true (not zero)`);
        }
        break;
      }

      case ILInstructionType.BRANCH_IF_FALSE: {
        const target = instruction.operands[1] || instruction.operands[0];
        if (this.isILValue(target) && isILLabel(target)) {
          lines.push(`BEQ ${target.name}      ; Branch if false (zero)`);
        }
        break;
      }

      case ILInstructionType.CALL: {
        const target = instruction.operands[0];
        if (this.isILValue(target)) {
          if (isILLabel(target)) {
            lines.push(`JSR ${target.name}      ; Call function`);
          } else if (isILVariable(target)) {
            lines.push(`JSR ${target.name}      ; Call function`);
          }
        }
        break;
      }

      case ILInstructionType.RETURN: {
        const returnValue = instruction.operands[0];
        if (returnValue && this.isILValue(returnValue)) {
          if (isILConstant(returnValue)) {
            lines.push(`LDA #${returnValue.value}    ; Load return value`);
          } else if (isILVariable(returnValue)) {
            lines.push(`LDA ${returnValue.name}     ; Load return value`);
          }
        }
        lines.push('RTS              ; Return from subroutine');
        break;
      }

      case ILInstructionType.LABEL: {
        const label = instruction.operands[0];
        if (this.isILValue(label) && isILLabel(label)) {
          lines.push(`${label.name}:           ; Label`);
        }
        break;
      }

      case ILInstructionType.NOP:
        lines.push('NOP              ; No operation');
        break;

      default:
        lines.push(`; TODO: Implement ${instruction.type}`);
        break;
    }

    return lines;
  }

  /**
   * Estimate code size from assembly
   */
  private estimateCodeSize(assembly: string): number {
    const lines = assembly.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith(';') && !trimmed.endsWith(':');
    });

    return lines.length * 2; // Rough estimate: 2 bytes per instruction
  }
}
