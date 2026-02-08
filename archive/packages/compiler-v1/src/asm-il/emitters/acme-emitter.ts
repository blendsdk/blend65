/**
 * ACME Assembler Emitter
 *
 * Serializes AsmModule to ACME-compatible assembly text.
 *
 * @module asm-il/emitters/acme-emitter
 */

import type { AsmModule, AsmItem, AsmInstruction, AsmLabel, AsmData, AsmComment, AsmOrigin, AsmRaw } from '../types.js';
import { AddressingMode, DataType, LabelType, isAsmInstruction, isAsmLabel, isAsmData, isAsmComment, isAsmOrigin, isAsmBlankLine, isAsmRaw } from '../types.js';
import type { AcmeEmitterConfig, EmitterResult } from './types.js';
import { BaseEmitter } from './base-emitter.js';

/**
 * ACME assembler emitter.
 * Serializes AsmModule to ACME-compatible assembly text.
 */
export class AcmeEmitter extends BaseEmitter {
  /** Emit the module to ACME assembly text. */
  emit(module: AsmModule): EmitterResult {
    this.reset();
    this.emitHeader(module);
    for (const item of module.items) {
      this.emitItem(item);
    }
    return this.buildResult();
  }

  protected emitHeader(module: AsmModule): void {
    if (module.outputFile) {
      this.addLine(`!to "${module.outputFile}", cbm`);
    }
    this.addLine(`*= ${this.formatHex(module.origin, 4)}`);
    this.addBlankLine();
  }

  protected emitItem(item: AsmItem): void {
    if (isAsmInstruction(item)) {
      this.emitInstruction(item);
    } else if (isAsmLabel(item)) {
      this.emitLabel(item);
    } else if (isAsmData(item)) {
      this.emitData(item);
    } else if (isAsmComment(item)) {
      this.emitComment(item);
    } else if (isAsmOrigin(item)) {
      this.emitOrigin(item);
    } else if (isAsmBlankLine(item)) {
      this.addBlankLine();
    } else if (isAsmRaw(item)) {
      this.emitRaw(item);
    }
  }

  protected emitInstruction(instr: AsmInstruction): void {
    const mnemonic = this.config.uppercaseMnemonics ? instr.mnemonic : instr.mnemonic.toLowerCase();
    const operand = this.formatOperand(instr);
    let line = operand ? `${this.indent()}${mnemonic} ${operand}` : `${this.indent()}${mnemonic}`;
    
    if (this.config.includeCycleCounts && instr.cycles) {
      line = line.padEnd(32) + `; ${instr.bytes}b ${instr.cycles}c`;
    } else if (instr.comment && this.config.includeComments) {
      line = line.padEnd(32) + `; ${instr.comment}`;
    }
    
    this.addLine(line, instr.sourceLocation);
    this.totalBytes += instr.bytes;
  }

  protected formatOperand(instr: AsmInstruction): string {
    const { mode, operand } = instr;
    if (operand === undefined) return '';
    
    const isLabel = typeof operand === 'string';
    const formatAddr = (w: number) => isLabel ? operand as string : this.formatHex(operand as number, w);
    
    switch (mode) {
      case AddressingMode.Implied:
      case AddressingMode.Accumulator: return '';
      case AddressingMode.Immediate: return `#${formatAddr(2)}`;
      case AddressingMode.ZeroPage: return formatAddr(2);
      case AddressingMode.ZeroPageX: return `${formatAddr(2)},X`;
      case AddressingMode.ZeroPageY: return `${formatAddr(2)},Y`;
      case AddressingMode.Absolute: return formatAddr(4);
      case AddressingMode.AbsoluteX: return `${formatAddr(4)},X`;
      case AddressingMode.AbsoluteY: return `${formatAddr(4)},Y`;
      case AddressingMode.Indirect: return `(${formatAddr(4)})`;
      case AddressingMode.IndirectX: return `(${formatAddr(2)},X)`;
      case AddressingMode.IndirectY: return `(${formatAddr(2)}),Y`;
      case AddressingMode.Relative: return isLabel ? operand as string : formatAddr(2);
      default: return String(operand);
    }
  }

  protected emitLabel(label: AsmLabel): void {
    // Determine prefix based on label type
    // - Exported labels get '+' prefix for ACME visibility
    // - Block/temp labels get '.' prefix for local scope
    // - But skip prefix if label.name already starts with '.' to avoid double-dot
    let prefix = '';
    if (label.exported) {
      prefix = '+';
    } else if (label.type === LabelType.Block || label.type === LabelType.Temp) {
      // Only add '.' prefix if name doesn't already start with '.'
      if (!label.name.startsWith('.')) {
        prefix = '.';
      }
    }
    // ACME labels need colon suffix (e.g., '_counter:' or '.loop:')
    const labelText = `${prefix}${label.name}:`;
    const line = label.comment && this.config.includeComments 
      ? labelText.padEnd(24) + `; ${label.comment}`
      : labelText;
    this.addLine(line, label.sourceLocation);
  }

  protected emitData(data: AsmData): void {
    let line: string;
    if (data.type === DataType.Byte) {
      const vals = (data.values as number[]).map(v => this.formatHex(v)).join(', ');
      line = `${this.indent()}!byte ${vals}`;
      this.totalBytes += (data.values as number[]).length;
    } else if (data.type === DataType.Word) {
      const vals = (data.values as number[]).map(v => this.formatHex(v, 4)).join(', ');
      line = `${this.indent()}!word ${vals}`;
      this.totalBytes += (data.values as number[]).length * 2;
    } else if (data.type === DataType.Text) {
      line = `${this.indent()}!text "${data.values as string}"`;
      this.totalBytes += (data.values as string).length;
    } else if (data.type === DataType.Fill) {
      const fill = data.values as { count: number; value: number };
      line = `${this.indent()}!fill ${fill.count}, ${this.formatHex(fill.value)}`;
      this.totalBytes += fill.count;
    } else {
      line = `${this.indent()}; unknown data type`;
    }
    
    if (data.comment && this.config.includeComments) {
      line = line.padEnd(32) + `; ${data.comment}`;
    }
    this.addLine(line, data.sourceLocation);
  }

  protected emitComment(comment: AsmComment): void {
    if (!this.config.includeComments) return;
    if (comment.style === 'section') {
      this.addLine(`; ${comment.text}`);
    } else {
      this.addLine(`; ${comment.text}`);
    }
  }

  protected emitOrigin(origin: AsmOrigin): void {
    const line = origin.comment && this.config.includeComments
      ? `*= ${this.formatHex(origin.address, 4)}`.padEnd(24) + `; ${origin.comment}`
      : `*= ${this.formatHex(origin.address, 4)}`;
    this.addLine(line);
  }

  protected emitRaw(raw: AsmRaw): void {
    this.addLine(raw.text);
  }
}

/** Factory function to create an ACME emitter. */
export function createAcmeEmitter(config?: Partial<AcmeEmitterConfig>): AcmeEmitter {
  return new AcmeEmitter(config);
}