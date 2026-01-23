# Task 8.10d: Pattern Code Generator

> **Task**: 8.10d of 12 (Peephole Phase)  
> **Time**: ~3 hours  
> **Tests**: ~45 tests  
> **Prerequisites**: Task 8.10c (DSL Parser)

---

## Overview

Implement the code generator that transforms DSL AST into executable TypeScript pattern classes. This enables patterns written in DSL to integrate with the existing peephole optimizer infrastructure.

---

## Generation Strategy

### From DSL to TypeScript

```
DSL Pattern Definition
         ↓
    Parse to AST
         ↓
    Validate AST
         ↓
 Generate TypeScript Class
         ↓
 Register with PatternRegistry
```

### Output Structure

Each DSL pattern generates:
1. A TypeScript class extending `BasePattern`
2. A `match()` method with pattern matching logic
3. A `replace()` method with replacement generation
4. Automatic registration with the pattern registry

---

## Code Generator Implementation

### File: `dsl/generator.ts`

```typescript
import {
  PatternFileNode, PatternDefNode, MatchClauseNode,
  ReplaceClauseNode, InstructionNode, OperandNode,
  WhereClauseNode, SavesClauseNode, CategoryClauseNode,
  LevelClauseNode, ASTNodeKind, NumberLiteralNode,
  CaptureNode, ConditionNode, OptimizationLevel,
} from './ast.js';

/**
 * Code generation options
 */
export interface GeneratorOptions {
  /** Module path for imports */
  modulePath?: string;
  /** Include comments in output */
  includeComments?: boolean;
  /** Generate registration code */
  generateRegistration?: boolean;
  /** Output format */
  format?: 'class' | 'object';
}

/**
 * Generated pattern output
 */
export interface GeneratedPattern {
  /** Pattern ID */
  readonly id: string;
  /** Generated TypeScript code */
  readonly code: string;
  /** Imports required */
  readonly imports: string[];
  /** Capture variables used */
  readonly captures: string[];
}

/**
 * Generated file output
 */
export interface GeneratedFile {
  /** All imports */
  readonly imports: string;
  /** All pattern classes */
  readonly patterns: GeneratedPattern[];
  /** Registration code */
  readonly registration: string;
  /** Complete file content */
  readonly content: string;
}

/**
 * Pattern DSL Code Generator
 */
export class DSLGenerator {
  protected options: Required<GeneratorOptions>;
  
  constructor(options: GeneratorOptions = {}) {
    this.options = {
      modulePath: '../',
      includeComments: true,
      generateRegistration: true,
      format: 'class',
      ...options,
    };
  }

  /**
   * Generate code for entire file
   */
  generate(ast: PatternFileNode): GeneratedFile {
    const patterns = ast.patterns.map(p => this.generatePattern(p));
    const allImports = this.generateImports(patterns);
    const registration = this.generateRegistration(patterns);
    
    const content = [
      allImports,
      '',
      ...patterns.map(p => p.code),
      '',
      registration,
    ].join('\n');
    
    return {
      imports: allImports,
      patterns,
      registration,
      content,
    };
  }

  /**
   * Generate single pattern
   */
  protected generatePattern(node: PatternDefNode): GeneratedPattern {
    const id = node.name;
    const className = this.toClassName(id);
    const captures = this.extractCaptures(node);
    
    const code = this.options.format === 'class'
      ? this.generateClass(node, className, captures)
      : this.generateObject(node, captures);
    
    return {
      id,
      code,
      imports: this.getPatternImports(node),
      captures,
    };
  }

  /**
   * Generate class-based pattern
   */
  protected generateClass(
    node: PatternDefNode,
    className: string,
    captures: string[]
  ): string {
    const lines: string[] = [];
    
    // Class comment
    if (this.options.includeComments) {
      lines.push(`/**`);
      lines.push(` * Pattern: ${node.name}`);
      lines.push(` * Generated from DSL`);
      lines.push(` */`);
    }
    
    // Class declaration
    lines.push(`export class ${className} extends BasePattern {`);
    
    // Properties
    lines.push(`  readonly id = '${node.name}';`);
    lines.push(`  readonly description = '${this.generateDescription(node)}';`);
    lines.push(`  readonly category = PatternCategory.${this.mapCategory(node.category?.category)};`);
    lines.push(`  readonly levels = [${this.mapLevels(node.level?.levels)}];`);
    lines.push(`  readonly windowSize = ${node.match.instructions.length};`);
    lines.push('');
    
    // Match method
    lines.push(this.generateMatchMethod(node.match, node.where, captures));
    lines.push('');
    
    // Replace method
    lines.push(this.generateReplaceMethod(node.replace, node.saves, captures));
    
    lines.push('}');
    
    return lines.join('\n');
  }

  /**
   * Generate object-based pattern (alternative format)
   */
  protected generateObject(node: PatternDefNode, captures: string[]): string {
    const lines: string[] = [];
    
    lines.push(`export const ${this.toVariableName(node.name)}: PeepholePattern = {`);
    lines.push(`  id: '${node.name}',`);
    lines.push(`  description: '${this.generateDescription(node)}',`);
    lines.push(`  category: PatternCategory.${this.mapCategory(node.category?.category)},`);
    lines.push(`  levels: [${this.mapLevels(node.level?.levels)}],`);
    lines.push(`  windowSize: ${node.match.instructions.length},`);
    lines.push('');
    lines.push(`  match(instructions: ILInstruction[]): PatternMatch | null {`);
    lines.push(this.generateMatchBody(node.match, node.where, captures, '    '));
    lines.push(`  },`);
    lines.push('');
    lines.push(`  replace(match: PatternMatch): PatternReplacement {`);
    lines.push(this.generateReplaceBody(node.replace, node.saves, captures, '    '));
    lines.push(`  },`);
    lines.push(`};`);
    
    return lines.join('\n');
  }

  /**
   * Generate match method
   */
  protected generateMatchMethod(
    match: MatchClauseNode,
    where: WhereClauseNode | undefined,
    captures: string[]
  ): string {
    const lines: string[] = [];
    
    lines.push(`  match(instructions: ILInstruction[]): PatternMatch | null {`);
    lines.push(this.generateMatchBody(match, where, captures, '    '));
    lines.push(`  }`);
    
    return lines.join('\n');
  }

  /**
   * Generate match method body
   */
  protected generateMatchBody(
    match: MatchClauseNode,
    where: WhereClauseNode | undefined,
    captures: string[],
    indent: string
  ): string {
    const lines: string[] = [];
    
    // Window size check
    lines.push(`${indent}if (instructions.length < ${match.instructions.length}) return null;`);
    lines.push('');
    
    // Capture variables
    if (captures.length > 0) {
      lines.push(`${indent}const captures = new Map<string, ILValue>();`);
      lines.push('');
    }
    
    // Match each instruction
    match.instructions.forEach((inst, i) => {
      lines.push(this.generateInstructionMatch(inst, i, indent));
    });
    
    // Where conditions
    if (where) {
      lines.push('');
      lines.push(`${indent}// Condition checks`);
      where.conditions.forEach(cond => {
        lines.push(this.generateConditionCheck(cond, indent));
      });
    }
    
    // Return match result
    lines.push('');
    lines.push(`${indent}return {`);
    lines.push(`${indent}  matched: instructions.slice(0, ${match.instructions.length}),`);
    lines.push(`${indent}  captures${captures.length > 0 ? '' : ': new Map()'},`);
    lines.push(`${indent}  confidence: 1.0,`);
    lines.push(`${indent}};`);
    
    return lines.join('\n');
  }

  /**
   * Generate instruction matching code
   */
  protected generateInstructionMatch(
    inst: InstructionNode,
    index: number,
    indent: string
  ): string {
    const lines: string[] = [];
    const varName = `inst${index}`;
    
    lines.push(`${indent}const ${varName} = instructions[${index}];`);
    
    // Skip label pseudo-instructions
    if (inst.mnemonic.startsWith('@')) {
      lines.push(`${indent}// Label: ${inst.mnemonic}`);
      return lines.join('\n');
    }
    
    // Check mnemonic (opcode)
    lines.push(`${indent}if (!this.matchOpcode(${varName}, ILOpcode.${this.mapMnemonic(inst.mnemonic)})) return null;`);
    
    // Check operand if present
    if (inst.operand) {
      lines.push(this.generateOperandMatch(inst.operand, varName, indent));
    }
    
    return lines.join('\n');
  }

  /**
   * Generate operand matching code
   */
  protected generateOperandMatch(
    operand: OperandNode,
    varName: string,
    indent: string
  ): string {
    const lines: string[] = [];
    
    switch (operand.kind) {
      case ASTNodeKind.ImmediateOperand:
        if (this.isCapture(operand.value)) {
          lines.push(`${indent}captures.set('${(operand.value as CaptureNode).name}', ${varName}.operand);`);
        } else {
          const num = operand.value as NumberLiteralNode;
          lines.push(`${indent}if (!this.matchImmediate(${varName}, ${num.value})) return null;`);
        }
        break;
        
      case ASTNodeKind.AbsoluteOperand:
      case ASTNodeKind.ZeroPageOperand:
        if (this.isCapture(operand.value)) {
          lines.push(`${indent}captures.set('${(operand.value as CaptureNode).name}', ${varName}.operand);`);
        } else {
          const num = operand.value as NumberLiteralNode;
          lines.push(`${indent}if (!this.matchAddress(${varName}, ${num.value})) return null;`);
        }
        break;
        
      case ASTNodeKind.IndexedOperand:
        if (this.isCapture(operand.base)) {
          lines.push(`${indent}captures.set('${(operand.base as CaptureNode).name}', ${varName}.operand);`);
        }
        lines.push(`${indent}if (!this.matchIndexed(${varName}, '${operand.index}')) return null;`);
        break;
        
      case ASTNodeKind.IndirectOperand:
        if (this.isCapture(operand.address)) {
          lines.push(`${indent}captures.set('${(operand.address as CaptureNode).name}', ${varName}.operand);`);
        }
        lines.push(`${indent}if (!this.matchIndirect(${varName})) return null;`);
        break;
        
      case ASTNodeKind.IndirectXOperand:
        if (this.isCapture(operand.address)) {
          lines.push(`${indent}captures.set('${(operand.address as CaptureNode).name}', ${varName}.operand);`);
        }
        lines.push(`${indent}if (!this.matchIndirectX(${varName})) return null;`);
        break;
        
      case ASTNodeKind.IndirectYOperand:
        if (this.isCapture(operand.address)) {
          lines.push(`${indent}captures.set('${(operand.address as CaptureNode).name}', ${varName}.operand);`);
        }
        lines.push(`${indent}if (!this.matchIndirectY(${varName})) return null;`);
        break;
        
      case ASTNodeKind.CaptureOperand:
        lines.push(`${indent}captures.set('${operand.name}', ${varName}.operand);`);
        break;
        
      case ASTNodeKind.LabelOperand:
        lines.push(`${indent}// Label reference: @${operand.name}`);
        break;
    }
    
    return lines.join('\n');
  }

  /**
   * Generate condition check code
   */
  protected generateConditionCheck(
    cond: ConditionNode,
    indent: string
  ): string {
    const left = typeof cond.left === 'string'
      ? `'${cond.left}'`
      : `captures.get('${cond.left.name}')`;
    
    const right = cond.right.kind === ASTNodeKind.NumberLiteral
      ? (cond.right as NumberLiteralNode).value.toString()
      : `captures.get('${(cond.right as CaptureNode).name}')`;
    
    const op = this.mapOperator(cond.operator);
    
    return `${indent}if (!(${left} ${op} ${right})) return null;`;
  }

  /**
   * Generate replace method
   */
  protected generateReplaceMethod(
    replace: ReplaceClauseNode,
    saves: SavesClauseNode | undefined,
    captures: string[]
  ): string {
    const lines: string[] = [];
    
    lines.push(`  replace(match: PatternMatch): PatternReplacement {`);
    lines.push(this.generateReplaceBody(replace, saves, captures, '    '));
    lines.push(`  }`);
    
    return lines.join('\n');
  }

  /**
   * Generate replace method body
   */
  protected generateReplaceBody(
    replace: ReplaceClauseNode,
    saves: SavesClauseNode | undefined,
    captures: string[],
    indent: string
  ): string {
    const lines: string[] = [];
    
    if (replace.isEmpty || replace.instructions.length === 0) {
      // Empty replacement
      lines.push(`${indent}return {`);
      lines.push(`${indent}  instructions: [],`);
      lines.push(`${indent}  cyclesSaved: ${saves?.cycles ?? 0},`);
      lines.push(`${indent}  bytesSaved: ${saves?.bytes ?? 0},`);
      lines.push(`${indent}};`);
    } else {
      // Generate replacement instructions
      lines.push(`${indent}const instructions: ILInstruction[] = [];`);
      lines.push('');
      
      replace.instructions.forEach((inst, i) => {
        if (!inst.mnemonic.startsWith('@')) {
          lines.push(this.generateReplacementInstruction(inst, captures, indent));
        }
      });
      
      lines.push('');
      lines.push(`${indent}return {`);
      lines.push(`${indent}  instructions,`);
      lines.push(`${indent}  cyclesSaved: ${saves?.cycles ?? 0},`);
      lines.push(`${indent}  bytesSaved: ${saves?.bytes ?? 0},`);
      lines.push(`${indent}};`);
    }
    
    return lines.join('\n');
  }

  /**
   * Generate replacement instruction creation
   */
  protected generateReplacementInstruction(
    inst: InstructionNode,
    captures: string[],
    indent: string
  ): string {
    const lines: string[] = [];
    
    const opcode = `ILOpcode.${this.mapMnemonic(inst.mnemonic)}`;
    
    if (!inst.operand) {
      lines.push(`${indent}instructions.push(this.createInstruction(${opcode}));`);
    } else {
      const operandCode = this.generateOperandCreation(inst.operand);
      lines.push(`${indent}instructions.push(this.createInstruction(${opcode}, ${operandCode}));`);
    }
    
    return lines.join('\n');
  }

  /**
   * Generate operand creation code
   */
  protected generateOperandCreation(operand: OperandNode): string {
    switch (operand.kind) {
      case ASTNodeKind.ImmediateOperand:
        if (this.isCapture(operand.value)) {
          return `match.captures.get('${(operand.value as CaptureNode).name}')`;
        }
        return `this.immediate(${(operand.value as NumberLiteralNode).value})`;
        
      case ASTNodeKind.AbsoluteOperand:
      case ASTNodeKind.ZeroPageOperand:
        if (this.isCapture(operand.value)) {
          return `match.captures.get('${(operand.value as CaptureNode).name}')`;
        }
        return `this.address(${(operand.value as NumberLiteralNode).value})`;
        
      case ASTNodeKind.CaptureOperand:
        return `match.captures.get('${operand.name}')`;
        
      default:
        return 'undefined';
    }
  }

  /**
   * Generate imports
   */
  protected generateImports(patterns: GeneratedPattern[]): string {
    const lines: string[] = [];
    
    lines.push(`import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '${this.options.modulePath}pattern.js';`);
    lines.push(`import { ILInstruction, ILOpcode, ILValue } from '${this.options.modulePath}../il/types.js';`);
    lines.push(`import { OptimizationLevel } from '${this.options.modulePath}types.js';`);
    
    if (this.options.generateRegistration) {
      lines.push(`import { patternRegistry } from '${this.options.modulePath}registry.js';`);
    }
    
    return lines.join('\n');
  }

  /**
   * Generate registration code
   */
  protected generateRegistration(patterns: GeneratedPattern[]): string {
    if (!this.options.generateRegistration) return '';
    
    const lines: string[] = [];
    
    lines.push('// Register all patterns');
    patterns.forEach(p => {
      const className = this.toClassName(p.id);
      lines.push(`patternRegistry.register(new ${className}());`);
    });
    
    return lines.join('\n');
  }

  // Helper methods

  protected extractCaptures(node: PatternDefNode): string[] {
    const captures = new Set<string>();
    
    const extractFromOperand = (op: OperandNode | undefined) => {
      if (!op) return;
      
      if (op.kind === ASTNodeKind.CaptureOperand) {
        captures.add(op.name);
      } else if ('value' in op && this.isCapture(op.value)) {
        captures.add((op.value as CaptureNode).name);
      } else if ('base' in op && this.isCapture(op.base)) {
        captures.add((op.base as CaptureNode).name);
      } else if ('address' in op && this.isCapture(op.address)) {
        captures.add((op.address as CaptureNode).name);
      }
    };
    
    node.match.instructions.forEach(inst => extractFromOperand(inst.operand));
    node.replace.instructions.forEach(inst => extractFromOperand(inst.operand));
    
    return [...captures];
  }

  protected isCapture(value: NumberLiteralNode | CaptureNode): boolean {
    return value.kind === ASTNodeKind.CaptureOperand;
  }

  protected toClassName(id: string): string {
    return id
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join('') + 'Pattern';
  }

  protected toVariableName(id: string): string {
    return id.replace(/-/g, '_') + 'Pattern';
  }

  protected generateDescription(node: PatternDefNode): string {
    // Generate description from pattern structure
    const matchOps = node.match.instructions.map(i => i.mnemonic).join(' → ');
    const replaceOps = node.replace.isEmpty 
      ? '(removed)' 
      : node.replace.instructions.map(i => i.mnemonic).join(' → ');
    return `${matchOps} ⇒ ${replaceOps}`;
  }

  protected mapCategory(category: string | undefined): string {
    const mapping: Record<string, string> = {
      'load-store': 'LoadStore',
      'arithmetic': 'Arithmetic',
      'branch': 'Branch',
      'transfer': 'Transfer',
      'flag': 'Flag',
      'general': 'General',
    };
    return mapping[category ?? 'general'] ?? 'General';
  }

  protected mapLevels(levels: OptimizationLevel[] | undefined): string {
    if (!levels || levels.length === 0) {
      return 'OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3';
    }
    return levels.map(l => `OptimizationLevel.${l}`).join(', ');
  }

  protected mapMnemonic(mnemonic: string): string {
    // Map 6502 mnemonic to IL opcode
    const mapping: Record<string, string> = {
      'LDA': 'Load', 'LDX': 'LoadX', 'LDY': 'LoadY',
      'STA': 'Store', 'STX': 'StoreX', 'STY': 'StoreY',
      'TAX': 'TransferAX', 'TAY': 'TransferAY',
      'TXA': 'TransferXA', 'TYA': 'TransferYA',
      'TXS': 'TransferXS', 'TSX': 'TransferSX',
      'PHA': 'PushA', 'PLA': 'PullA',
      'PHP': 'PushP', 'PLP': 'PullP',
      'ADC': 'Add', 'SBC': 'Subtract',
      'INC': 'Increment', 'DEC': 'Decrement',
      'INX': 'IncrementX', 'INY': 'IncrementY',
      'DEX': 'DecrementX', 'DEY': 'DecrementY',
      'AND': 'And', 'ORA': 'Or', 'EOR': 'Xor',
      'ASL': 'ShiftLeft', 'LSR': 'ShiftRight',
      'ROL': 'RotateLeft', 'ROR': 'RotateRight',
      'CMP': 'Compare', 'CPX': 'CompareX', 'CPY': 'CompareY',
      'BIT': 'BitTest',
      'BCC': 'BranchCarryClear', 'BCS': 'BranchCarrySet',
      'BEQ': 'BranchEqual', 'BNE': 'BranchNotEqual',
      'BMI': 'BranchMinus', 'BPL': 'BranchPlus',
      'BVC': 'BranchOverflowClear', 'BVS': 'BranchOverflowSet',
      'JMP': 'Jump', 'JSR': 'JumpSubroutine',
      'RTS': 'Return', 'RTI': 'ReturnInterrupt', 'BRK': 'Break',
      'CLC': 'ClearCarry', 'SEC': 'SetCarry',
      'CLI': 'ClearInterrupt', 'SEI': 'SetInterrupt',
      'CLV': 'ClearOverflow', 'CLD': 'ClearDecimal', 'SED': 'SetDecimal',
      'NOP': 'NoOp',
    };
    return mapping[mnemonic] ?? mnemonic;
  }

  protected mapOperator(op: string): string {
    const mapping: Record<string, string> = {
      '=': '===',
      '!=': '!==',
      '<': '<',
      '>': '>',
    };
    return mapping[op] ?? op;
  }

  protected getPatternImports(node: PatternDefNode): string[] {
    return []; // Base imports cover all needs
  }
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| Generate empty file | Handle no patterns |
| Generate single class | Basic pattern class |
| Generate multiple classes | Multiple patterns |
| Generate match method | Instruction matching |
| Generate replace method | Replacement generation |
| Generate captures | Capture variable handling |
| Generate conditions | Where clause conditions |
| Generate saves | Cycles/bytes metadata |
| Generate category | Category mapping |
| Generate levels | Optimization level mapping |
| Generate imports | Required imports |
| Generate registration | Registry code |
| Mnemonic mapping | All 6502 instructions |
| Operand types | All addressing modes |
| Class naming | Identifier conversion |
| Object format | Alternative output |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `dsl/generator.ts` | [ ] |
| Implement class generation | [ ] |
| Implement match generation | [ ] |
| Implement replace generation | [ ] |
| Implement operand generation | [ ] |
| Implement condition generation | [ ] |
| Implement import generation | [ ] |
| Implement registration | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 8.10e → `08-10e-dsl-validation.md`