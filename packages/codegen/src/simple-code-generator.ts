/**
 * Simplified 6502 code generator for Blend65
 * Basic implementation to enable first compiled programs
 */

import {
  ILProgram,
  ILFunction,
  ILInstruction,
  ILInstructionType,
  isILConstant,
  isILVariable,
  isILLabel,
} from '@blend65/il';

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
    processor: '6510',
  },
  vic20: {
    name: 'vic20',
    displayName: 'Commodore VIC-20',
    basicStart: 0x1001,
    mlStart: 0x1010,
    processor: '6502',
  },
  c128: {
    name: 'c128',
    displayName: 'Commodore 128 (C64 mode)',
    basicStart: 0x0801,
    mlStart: 0x0810,
    processor: '8502',
  },
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
        compilationTime: Date.now() - startTime,
      },
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
      `* = $${entryPoint.toString(16).toUpperCase().padStart(4, '0')}`,
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
            lines.push(
              `LDA $${(source.value as number).toString(16).toUpperCase()}  ; Load from address`
            );
          }
        }
        break;
      }

      case ILInstructionType.STORE_MEMORY: {
        const dest = instruction.operands[0];
        const value = instruction.operands[1];

        // Load the value first
        if (value && this.isILValue(value)) {
          if (isILConstant(value)) {
            lines.push(`LDA #${value.value}    ; Load value to store`);
          } else if (isILVariable(value)) {
            lines.push(`LDA ${value.name}     ; Load variable to store`);
          }
        }

        // Store to destination
        if (this.isILValue(dest)) {
          if (isILVariable(dest)) {
            lines.push(`STA ${dest.name}     ; Store to variable ${dest.name}`);
          } else if (isILConstant(dest)) {
            lines.push(
              `STA $${(dest.value as number).toString(16).toUpperCase()}  ; Store to address`
            );
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
          } else if (isILConstant(target)) {
            lines.push(
              `JSR $${(target.value as number).toString(16).toUpperCase()}      ; Call routine`
            );
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

      // ============================================================================
      // 6502-SPECIFIC BUILTIN FUNCTION OPERATIONS
      // ============================================================================

      case ILInstructionType.PEEK: {
        const address = instruction.operands[1]; // address is operands[1]

        if (address && this.isILValue(address)) {
          if (isILConstant(address)) {
            const addr = address.value as number;
            if (addr <= 0xff) {
              lines.push(
                `LDA $${addr.toString(16).toUpperCase().padStart(2, '0')}      ; PEEK from zero page $${addr.toString(16).toUpperCase()}`
              );
            } else {
              lines.push(
                `LDA $${addr.toString(16).toUpperCase().padStart(4, '0')}    ; PEEK from $${addr.toString(16).toUpperCase()}`
              );
            }
          } else if (isILVariable(address)) {
            lines.push(`LDA ${address.name}     ; PEEK from address in ${address.name}`);
          }
        }
        break;
      }

      case ILInstructionType.POKE: {
        const address = instruction.operands[0];
        const value = instruction.operands[1];

        // Load the value into accumulator first
        if (value && this.isILValue(value)) {
          if (isILConstant(value)) {
            lines.push(`LDA #${value.value}    ; Load value to poke`);
          } else if (isILVariable(value)) {
            lines.push(`LDA ${value.name}     ; Load value to poke`);
          }
        }

        // Store to the address
        if (address && this.isILValue(address)) {
          if (isILConstant(address)) {
            const addr = address.value as number;
            if (addr <= 0xff) {
              lines.push(
                `STA $${addr.toString(16).toUpperCase().padStart(2, '0')}      ; POKE to zero page $${addr.toString(16).toUpperCase()}`
              );
            } else {
              lines.push(
                `STA $${addr.toString(16).toUpperCase().padStart(4, '0')}    ; POKE to $${addr.toString(16).toUpperCase()}`
              );
            }
          } else if (isILVariable(address)) {
            lines.push(`STA ${address.name}     ; POKE to address in ${address.name}`);
          }
        }
        break;
      }

      case ILInstructionType.PEEKW: {
        const address = instruction.operands[1]; // address is operands[1]

        if (address && this.isILValue(address)) {
          if (isILConstant(address)) {
            const addr = address.value as number;
            if (addr <= 0xfe) {
              // Zero page 16-bit read
              lines.push(
                `LDA $${addr.toString(16).toUpperCase().padStart(2, '0')}      ; PEEKW low byte from zero page $${addr.toString(16).toUpperCase()}`
              );
              lines.push(`TAX              ; Store low byte in X`);
              lines.push(
                `LDA $${(addr + 1).toString(16).toUpperCase().padStart(2, '0')}      ; PEEKW high byte from zero page $${(addr + 1).toString(16).toUpperCase()}`
              );
              lines.push(`TAY              ; Store high byte in Y`);
              lines.push(`TXA              ; Restore low byte to A`);
            } else {
              // Absolute 16-bit read
              lines.push(
                `LDA $${addr.toString(16).toUpperCase().padStart(4, '0')}    ; PEEKW low byte from $${addr.toString(16).toUpperCase()}`
              );
              lines.push(`TAX              ; Store low byte in X`);
              lines.push(
                `LDA $${(addr + 1).toString(16).toUpperCase().padStart(4, '0')}    ; PEEKW high byte from $${(addr + 1).toString(16).toUpperCase()}`
              );
              lines.push(`TAY              ; Store high byte in Y`);
              lines.push(`TXA              ; Restore low byte to A`);
            }
          } else if (isILVariable(address)) {
            lines.push(`; PEEKW from address in ${address.name} (16-bit read)`);
            lines.push(`LDX ${address.name}     ; Load address low`);
            lines.push(`LDY ${address.name}+1   ; Load address high`);
            lines.push(`STX $FB          ; Store pointer low`);
            lines.push(`STY $FC          ; Store pointer high`);
            lines.push(`LDY #0           ; Index 0`);
            lines.push(`LDA ($FB),Y      ; Load low byte`);
            lines.push(`TAX              ; Store low byte in X`);
            lines.push(`INY              ; Index 1`);
            lines.push(`LDA ($FB),Y      ; Load high byte`);
            lines.push(`TAY              ; Store high byte in Y`);
            lines.push(`TXA              ; Restore low byte to A`);
          }
        }
        break;
      }

      case ILInstructionType.POKEW: {
        const address = instruction.operands[0];
        const value = instruction.operands[1];

        // For 16-bit POKEW, we need to handle both low and high bytes
        // Assuming value is a 16-bit word with low byte in A, high byte in X
        if (value && this.isILValue(value)) {
          if (isILConstant(value)) {
            const val = value.value as number;
            const lowByte = val & 0xff;
            const highByte = (val >> 8) & 0xff;
            lines.push(`LDA #${lowByte}      ; Load low byte of 16-bit value`);
            lines.push(`LDX #${highByte}      ; Load high byte of 16-bit value`);
          } else if (isILVariable(value)) {
            lines.push(`LDA ${value.name}     ; Load low byte from ${value.name}`);
            lines.push(`LDX ${value.name}+1   ; Load high byte from ${value.name}+1`);
          }
        }

        // Store to the address
        if (address && this.isILValue(address)) {
          if (isILConstant(address)) {
            const addr = address.value as number;
            if (addr <= 0xfe) {
              // Zero page 16-bit write
              lines.push(
                `STA $${addr.toString(16).toUpperCase().padStart(2, '0')}      ; POKEW low byte to zero page $${addr.toString(16).toUpperCase()}`
              );
              lines.push(`TXA              ; Move high byte to A`);
              lines.push(
                `STA $${(addr + 1).toString(16).toUpperCase().padStart(2, '0')}      ; POKEW high byte to zero page $${(addr + 1).toString(16).toUpperCase()}`
              );
            } else {
              // Absolute 16-bit write
              lines.push(
                `STA $${addr.toString(16).toUpperCase().padStart(4, '0')}    ; POKEW low byte to $${addr.toString(16).toUpperCase()}`
              );
              lines.push(`TXA              ; Move high byte to A`);
              lines.push(
                `STA $${(addr + 1).toString(16).toUpperCase().padStart(4, '0')}    ; POKEW high byte to $${(addr + 1).toString(16).toUpperCase()}`
              );
            }
          } else if (isILVariable(address)) {
            lines.push(`; POKEW to address in ${address.name} (16-bit write)`);
            lines.push(`PHA              ; Save low byte on stack`);
            lines.push(`TXA              ; Move high byte to A`);
            lines.push(`PHA              ; Save high byte on stack`);
            lines.push(`LDX ${address.name}     ; Load address low`);
            lines.push(`LDY ${address.name}+1   ; Load address high`);
            lines.push(`STX $FB          ; Store pointer low`);
            lines.push(`STY $FC          ; Store pointer high`);
            lines.push(`PLA              ; Restore high byte`);
            lines.push(`LDY #1           ; Index 1`);
            lines.push(`STA ($FB),Y      ; Store high byte`);
            lines.push(`PLA              ; Restore low byte`);
            lines.push(`LDY #0           ; Index 0`);
            lines.push(`STA ($FB),Y      ; Store low byte`);
          }
        }
        break;
      }

      case ILInstructionType.SYS: {
        const address = instruction.operands[0];

        if (address && this.isILValue(address)) {
          if (isILConstant(address)) {
            const addr = address.value as number;
            lines.push(
              `JSR $${addr.toString(16).toUpperCase().padStart(4, '0')}    ; SYS call to $${addr.toString(16).toUpperCase()}`
            );
          } else if (isILVariable(address)) {
            lines.push(`; SYS call to address in ${address.name}`);
            lines.push(`LDX ${address.name}     ; Load address low`);
            lines.push(`LDY ${address.name}+1   ; Load address high`);
            lines.push(`STX $FB          ; Store call address low`);
            lines.push(`STY $FC          ; Store call address high`);
            lines.push(`JSR ($FB)        ; Indirect JSR (note: not available on basic 6502)`);
            lines.push(`; Note: Above requires 65C02 or emulation`);
          }
        }
        break;
      }

      default:
        lines.push(`; TODO: Implement ${instruction.type} - DEBUG INFO:`);
        lines.push(`; Type: ${instruction.type} (${typeof instruction.type})`);
        lines.push(`; Operands: ${instruction.operands.length}`);
        lines.push(`; ID: ${instruction.id}`);
        if (instruction.operands.length > 0) {
          lines.push(`; First operand: ${JSON.stringify(instruction.operands[0])}`);
        }
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
