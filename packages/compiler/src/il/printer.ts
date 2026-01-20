/**
 * IL Printer - pretty-prints IL for debugging and analysis
 *
 * Generates human-readable text representation of IL modules,
 * functions, basic blocks, and instructions.
 *
 * @module il/printer
 */

import { BasicBlock } from './basic-block.js';
import { ILFunction, ILStorageClass } from './function.js';
import { ILModule, type ILGlobalVariable, type ILImport, type ILExport } from './module.js';
import { typeToString, type ILType } from './types.js';
import { type VirtualRegister } from './values.js';
import { ILInstruction } from './instructions.js';

/**
 * Options for controlling IL printer output.
 */
export interface ILPrinterOptions {
  /** Whether to include instruction IDs */
  showInstructionIds?: boolean;

  /** Whether to include metadata */
  showMetadata?: boolean;

  /** Whether to show CFG edges as comments */
  showCFGEdges?: boolean;

  /** Indentation string (default: '  ') */
  indent?: string;

  /** Whether to show source locations */
  showSourceLocations?: boolean;

  /** Whether to show register types */
  showRegisterTypes?: boolean;

  /** Whether to show block labels */
  showBlockLabels?: boolean;
}

/**
 * Default printer options.
 */
const DEFAULT_OPTIONS: Required<ILPrinterOptions> = {
  showInstructionIds: false,
  showMetadata: false,
  showCFGEdges: true,
  indent: '  ',
  showSourceLocations: false,
  showRegisterTypes: false,
  showBlockLabels: true,
};

/**
 * Pretty-printer for IL structures.
 *
 * Generates human-readable text output for debugging, logging, and analysis.
 *
 * @example
 * ```typescript
 * const printer = new ILPrinter();
 *
 * // Print a module
 * console.log(printer.printModule(module));
 *
 * // Print with custom options
 * const verbosePrinter = new ILPrinter({
 *   showInstructionIds: true,
 *   showMetadata: true,
 *   showSourceLocations: true,
 * });
 * console.log(verbosePrinter.printFunction(func));
 * ```
 */
export class ILPrinter {
  /** Printer options */
  protected readonly options: Required<ILPrinterOptions>;

  /**
   * Creates a new IL printer.
   *
   * @param options - Printer options
   */
  constructor(options: ILPrinterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ===========================================================================
  // Module Printing
  // ===========================================================================

  /**
   * Prints an entire IL module.
   *
   * @param module - Module to print
   * @returns Multi-line string representation
   */
  printModule(module: ILModule): string {
    const lines: string[] = [];

    // Module header
    lines.push(`; ======================================================`);
    lines.push(`; Module: ${module.name}`);
    lines.push(`; ======================================================`);
    lines.push('');

    // Imports
    const imports = module.getImports();
    if (imports.length > 0) {
      lines.push('; Imports');
      lines.push('; -------');
      for (const imp of imports) {
        lines.push(this.printImport(imp));
      }
      lines.push('');
    }

    // Globals
    const globals = module.getGlobals();
    if (globals.length > 0) {
      lines.push('; Globals');
      lines.push('; -------');
      for (const global of globals) {
        lines.push(this.printGlobal(global));
      }
      lines.push('');
    }

    // Functions
    const functions = module.getFunctions();
    for (const func of functions) {
      lines.push(this.printFunction(func));
      lines.push('');
    }

    // Exports
    const exports = module.getExports();
    if (exports.length > 0) {
      lines.push('; Exports');
      lines.push('; -------');
      for (const exp of exports) {
        lines.push(this.printExport(exp));
      }
    }

    // Entry point
    if (module.hasEntryPoint()) {
      lines.push('');
      lines.push(`; Entry point: ${module.getEntryPointName()}`);
    }

    return lines.join('\n');
  }

  /**
   * Prints an import declaration.
   *
   * @param imp - Import to print
   * @returns Single-line string
   */
  printImport(imp: ILImport): string {
    const alias = imp.localName !== imp.originalName ? ` as ${imp.localName}` : '';
    const typeOnly = imp.isTypeOnly ? 'type ' : '';
    return `import ${typeOnly}${imp.originalName}${alias} from "${imp.modulePath}"`;
  }

  /**
   * Prints a global variable declaration.
   *
   * @param global - Global to print
   * @returns Single-line string
   */
  printGlobal(global: ILGlobalVariable): string {
    const parts: string[] = [];

    // Modifiers
    if (global.isExported) {
      parts.push('export');
    }
    if (global.isConstant) {
      parts.push('const');
    }

    // Name and type
    parts.push(`${global.name}: ${typeToString(global.type)}`);

    // Storage class
    parts.push(`[${this.formatStorageClass(global.storageClass)}]`);

    // Address (for @map)
    if (global.address !== undefined) {
      parts.push(`@ $${global.address.toString(16).toUpperCase().padStart(4, '0')}`);
    }

    // Initial value
    if (global.initialValue !== undefined) {
      parts.push(`= ${this.formatInitialValue(global.initialValue)}`);
    }

    return parts.join(' ');
  }

  /**
   * Prints an export declaration.
   *
   * @param exp - Export to print
   * @returns Single-line string
   */
  printExport(exp: ILExport): string {
    const alias = exp.exportedName !== exp.localName ? ` as ${exp.exportedName}` : '';
    return `export ${exp.localName}${alias} (${exp.kind})`;
  }

  // ===========================================================================
  // Function Printing
  // ===========================================================================

  /**
   * Prints an IL function.
   *
   * @param func - Function to print
   * @returns Multi-line string representation
   */
  printFunction(func: ILFunction): string {
    const lines: string[] = [];

    // Function signature
    lines.push(this.printFunctionSignature(func));

    // Function attributes
    if (func.getExported()) {
      lines.push(`${this.options.indent}; exported`);
    }
    if (func.getInterrupt()) {
      lines.push(`${this.options.indent}; interrupt`);
    }

    lines.push('{');

    // Basic blocks in reverse postorder
    const blocks = func.getBlocksInReversePostorder();
    for (let i = 0; i < blocks.length; i++) {
      if (i > 0) {
        lines.push(''); // Blank line between blocks
      }
      lines.push(this.printBasicBlock(blocks[i]));
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Prints a function signature.
   *
   * @param func - Function to get signature from
   * @returns Function signature line
   */
  printFunctionSignature(func: ILFunction): string {
    const params = func.parameters.map((p, i) => {
      const reg = func.getParameterRegister(i);
      const regStr = reg ? this.formatRegister(reg) : p.name;
      return `${regStr}: ${typeToString(p.type)}`;
    });

    return `function ${func.name}(${params.join(', ')}) -> ${typeToString(func.returnType)}`;
  }

  // ===========================================================================
  // Basic Block Printing
  // ===========================================================================

  /**
   * Prints a basic block.
   *
   * @param block - Block to print
   * @returns Multi-line string representation
   */
  printBasicBlock(block: BasicBlock): string {
    const lines: string[] = [];
    const indent = this.options.indent;

    // Block label
    if (this.options.showBlockLabels) {
      lines.push(`${block.label}:`);
    }

    // Predecessors (as comment)
    if (this.options.showCFGEdges) {
      const preds = block.getPredecessors();
      if (preds.length > 0) {
        const predLabels = preds.map((p) => p.label).join(', ');
        lines.push(`${indent}; predecessors: ${predLabels}`);
      }
    }

    // Instructions
    for (const inst of block.getInstructions()) {
      lines.push(`${indent}${this.printInstruction(inst)}`);
    }

    // Successors (as comment)
    if (this.options.showCFGEdges) {
      const succs = block.getSuccessors();
      if (succs.length > 0) {
        const succLabels = succs.map((s) => s.label).join(', ');
        lines.push(`${indent}; successors: ${succLabels}`);
      }
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // Instruction Printing
  // ===========================================================================

  /**
   * Prints an instruction.
   *
   * @param inst - Instruction to print
   * @returns Single-line string representation
   */
  printInstruction(inst: ILInstruction): string {
    const parts: string[] = [];

    // Instruction ID (optional)
    if (this.options.showInstructionIds) {
      parts.push(`[${inst.id.toString().padStart(3, '0')}]`);
    }

    // Instruction string (from the instruction's toString method)
    parts.push(inst.toString());

    // Metadata (optional)
    if (this.options.showMetadata && Object.keys(inst.metadata).length > 0) {
      parts.push(`; ${this.formatMetadata(inst.metadata)}`);
    }

    // Source location (optional)
    if (this.options.showSourceLocations && inst.metadata.location) {
      const loc = inst.metadata.location;
      parts.push(`; @${loc.start.line}:${loc.start.column}`);
    }

    return parts.join(' ');
  }

  // ===========================================================================
  // Formatting Helpers
  // ===========================================================================

  /**
   * Formats a virtual register for output.
   *
   * @param reg - Register to format
   * @returns Formatted register string
   */
  formatRegister(reg: VirtualRegister): string {
    let result = reg.toString();
    if (this.options.showRegisterTypes) {
      result += `:${typeToString(reg.type)}`;
    }
    return result;
  }

  /**
   * Formats a storage class.
   *
   * @param storage - Storage class to format
   * @returns Formatted storage class string
   */
  formatStorageClass(storage: ILStorageClass): string {
    switch (storage) {
      case ILStorageClass.ZeroPage:
        return 'zp';
      case ILStorageClass.Ram:
        return 'ram';
      case ILStorageClass.Data:
        return 'data';
      case ILStorageClass.Map:
        return 'map';
      default:
        return storage;
    }
  }

  /**
   * Formats an initial value for display.
   *
   * @param value - Initial value (number or array)
   * @returns Formatted value string
   */
  formatInitialValue(value: number | number[]): string {
    if (Array.isArray(value)) {
      if (value.length <= 8) {
        return `[${value.map((v) => this.formatNumber(v)).join(', ')}]`;
      }
      return `[${value.slice(0, 4).map((v) => this.formatNumber(v)).join(', ')}, ... (${value.length} elements)]`;
    }
    return this.formatNumber(value);
  }

  /**
   * Formats a number for display (hex for addresses, decimal otherwise).
   *
   * @param value - Number to format
   * @returns Formatted number string
   */
  formatNumber(value: number): string {
    if (value >= 256) {
      return `$${value.toString(16).toUpperCase().padStart(4, '0')}`;
    }
    return value.toString();
  }

  /**
   * Formats instruction metadata for display.
   *
   * @param metadata - Metadata object
   * @returns Compact metadata string
   */
  formatMetadata(metadata: Record<string, unknown>): string {
    const parts: string[] = [];

    // Show selected metadata fields
    if (metadata.addressingMode) {
      parts.push(`mode=${metadata.addressingMode}`);
    }
    if (metadata.complexity !== undefined) {
      parts.push(`complexity=${metadata.complexity}`);
    }
    if (typeof metadata.loopDepth === 'number' && metadata.loopDepth > 0) {
      parts.push(`loop=${metadata.loopDepth}`);
    }
    if (metadata.rasterCritical) {
      parts.push('raster-critical');
    }
    if (metadata.estimatedCycles !== undefined) {
      parts.push(`cycles=${metadata.estimatedCycles}`);
    }
    if (metadata.m6502Hints) {
      const hints = metadata.m6502Hints as { preferredRegister?: string; zeroPagePriority?: number };
      if (hints.preferredRegister) {
        parts.push(`prefer=${hints.preferredRegister}`);
      }
      if (hints.zeroPagePriority !== undefined) {
        parts.push(`zp-priority=${hints.zeroPagePriority}`);
      }
    }

    return parts.join(', ');
  }

  // ===========================================================================
  // Type Printing
  // ===========================================================================

  /**
   * Prints an IL type.
   *
   * @param type - Type to print
   * @returns Type string
   */
  printType(type: ILType): string {
    return typeToString(type);
  }
}

// ===========================================================================
// Convenience Functions
// ===========================================================================

/**
 * Prints an IL module with default options.
 *
 * @param module - Module to print
 * @returns Multi-line string representation
 */
export function printModule(module: ILModule): string {
  return new ILPrinter().printModule(module);
}

/**
 * Prints an IL function with default options.
 *
 * @param func - Function to print
 * @returns Multi-line string representation
 */
export function printFunction(func: ILFunction): string {
  return new ILPrinter().printFunction(func);
}

/**
 * Prints a basic block with default options.
 *
 * @param block - Block to print
 * @returns Multi-line string representation
 */
export function printBlock(block: BasicBlock): string {
  return new ILPrinter().printBasicBlock(block);
}

/**
 * Prints an instruction with default options.
 *
 * @param inst - Instruction to print
 * @returns Single-line string representation
 */
export function printInstruction(inst: ILInstruction): string {
  return new ILPrinter().printInstruction(inst);
}