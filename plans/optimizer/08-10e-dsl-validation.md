# Task 8.10e: DSL Validation & Error Reporting

> **Task**: 8.10e of 12 (Peephole Phase)  
> **Time**: ~2 hours  
> **Tests**: ~40 tests  
> **Prerequisites**: Tasks 8.10a-d (DSL Grammar, Parser, Generator)

---

## Overview

Implement comprehensive validation and error reporting for the Pattern DSL. This ensures patterns are semantically correct beyond just syntax, providing helpful diagnostics for pattern authors.

---

## Validation Categories

### 1. Structural Validation
- Required clauses present
- Clause ordering
- Nesting correctness

### 2. Semantic Validation
- Valid mnemonic usage
- Operand compatibility
- Capture variable consistency

### 3. 6502 Validation
- Addressing mode validity
- Register constraints
- Instruction operand rules

### 4. Pattern Logic Validation
- Match/replace consistency
- Capture variable usage
- Condition feasibility

---

## Diagnostic Types

### File: `dsl/diagnostics.ts`

```typescript
/**
 * Diagnostic severity levels
 */
export enum DiagnosticSeverity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Hint = 'hint',
}

/**
 * Diagnostic codes for categorization
 */
export enum DiagnosticCode {
  // Structural errors (1xxx)
  MissingMatchClause = 1001,
  MissingReplaceClause = 1002,
  DuplicateClause = 1003,
  InvalidClauseOrder = 1004,
  EmptyPatternBody = 1005,
  
  // Semantic errors (2xxx)
  UnknownMnemonic = 2001,
  InvalidOperandType = 2002,
  UndefinedCapture = 2003,
  UnusedCapture = 2004,
  CaptureTypeMismatch = 2005,
  DuplicateCapture = 2006,
  
  // 6502 errors (3xxx)
  InvalidAddressingMode = 3001,
  InvalidRegisterForMode = 3002,
  OperandOutOfRange = 3003,
  ImpliedModeWithOperand = 3004,
  AccumulatorModeInvalid = 3005,
  BranchTargetOutOfRange = 3006,
  
  // Pattern logic errors (4xxx)
  MatchReplaceInconsistent = 4001,
  UnreachableCondition = 4002,
  ContradictoryConditions = 4003,
  CycleSavingsNegative = 4004,
  ByteSavingsNegative = 4005,
  
  // Warnings (5xxx)
  NoOptimization = 5001,
  PossibleSideEffect = 5002,
  FlagClobber = 5003,
  UntestedPattern = 5004,
  DeprecatedSyntax = 5005,
  
  // Hints (6xxx)
  SimplerAlternative = 6001,
  MissingCategory = 6002,
  MissingLevel = 6003,
  MissingSaves = 6004,
}

/**
 * Diagnostic message
 */
export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly location: DiagnosticLocation;
  readonly source?: string;
  readonly relatedInfo?: RelatedInformation[];
}

/**
 * Diagnostic location
 */
export interface DiagnosticLocation {
  readonly line: number;
  readonly column: number;
  readonly length: number;
  readonly patternName?: string;
}

/**
 * Related information for complex diagnostics
 */
export interface RelatedInformation {
  readonly message: string;
  readonly location: DiagnosticLocation;
}

/**
 * Validation result
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly diagnostics: Diagnostic[];
  readonly errorCount: number;
  readonly warningCount: number;
}

/**
 * Create a diagnostic
 */
export function createDiagnostic(
  code: DiagnosticCode,
  severity: DiagnosticSeverity,
  message: string,
  location: DiagnosticLocation,
  relatedInfo?: RelatedInformation[]
): Diagnostic {
  return {
    code,
    severity,
    message,
    location,
    source: 'pattern-dsl',
    relatedInfo,
  };
}
```

---

## Validator Implementation

### File: `dsl/validator.ts`

```typescript
import {
  PatternFileNode, PatternDefNode, MatchClauseNode,
  ReplaceClauseNode, InstructionNode, OperandNode,
  WhereClauseNode, ConditionNode, ASTNodeKind,
  NumberLiteralNode, CaptureNode,
} from './ast.js';
import {
  Diagnostic, DiagnosticCode, DiagnosticSeverity,
  DiagnosticLocation, ValidationResult, createDiagnostic,
} from './diagnostics.js';

/**
 * 6502 instruction info for validation
 */
interface InstructionInfo {
  readonly mnemonic: string;
  readonly validModes: AddressingMode[];
  readonly affectsFlags: string[];
}

/**
 * Addressing modes
 */
enum AddressingMode {
  Implied = 'implied',
  Accumulator = 'accumulator',
  Immediate = 'immediate',
  ZeroPage = 'zero-page',
  ZeroPageX = 'zero-page-x',
  ZeroPageY = 'zero-page-y',
  Absolute = 'absolute',
  AbsoluteX = 'absolute-x',
  AbsoluteY = 'absolute-y',
  Indirect = 'indirect',
  IndirectX = 'indirect-x',
  IndirectY = 'indirect-y',
  Relative = 'relative',
}

/**
 * Pattern DSL Validator
 */
export class DSLValidator {
  protected diagnostics: Diagnostic[] = [];
  protected currentPattern: string = '';
  protected captureDefinitions: Map<string, DiagnosticLocation> = new Map();
  protected captureUsages: Map<string, DiagnosticLocation[]> = new Map();
  
  /**
   * Validate entire pattern file
   */
  validate(ast: PatternFileNode): ValidationResult {
    this.diagnostics = [];
    
    // Check for empty file
    if (ast.patterns.length === 0) {
      this.addHint(
        DiagnosticCode.EmptyPatternBody,
        'Pattern file is empty',
        { line: 1, column: 1, length: 0 }
      );
    }
    
    // Validate each pattern
    ast.patterns.forEach(pattern => {
      this.validatePattern(pattern);
    });
    
    return this.createResult();
  }

  /**
   * Validate single pattern
   */
  protected validatePattern(node: PatternDefNode): void {
    this.currentPattern = node.name;
    this.captureDefinitions.clear();
    this.captureUsages.clear();
    
    // Structural validation
    this.validateStructure(node);
    
    // Semantic validation
    this.validateSemantics(node);
    
    // 6502 validation
    this.validate6502(node);
    
    // Pattern logic validation
    this.validateLogic(node);
    
    // Capture variable validation
    this.validateCaptures();
    
    // Optional clause hints
    this.validateOptionalClauses(node);
  }

  /**
   * Validate pattern structure
   */
  protected validateStructure(node: PatternDefNode): void {
    const location = this.nodeLocation(node);
    
    // Required clauses (already checked in parser, but double-check)
    if (!node.match) {
      this.addError(
        DiagnosticCode.MissingMatchClause,
        `Pattern '${node.name}' missing required 'match' clause`,
        location
      );
    }
    
    if (!node.replace) {
      this.addError(
        DiagnosticCode.MissingReplaceClause,
        `Pattern '${node.name}' missing required 'replace' clause`,
        location
      );
    }
  }

  /**
   * Validate semantic correctness
   */
  protected validateSemantics(node: PatternDefNode): void {
    // Validate match instructions
    if (node.match) {
      node.match.instructions.forEach(inst => {
        this.validateInstruction(inst, 'match');
      });
    }
    
    // Validate replace instructions
    if (node.replace && !node.replace.isEmpty) {
      node.replace.instructions.forEach(inst => {
        this.validateInstruction(inst, 'replace');
      });
    }
    
    // Validate conditions
    if (node.where) {
      node.where.conditions.forEach(cond => {
        this.validateCondition(cond);
      });
    }
  }

  /**
   * Validate single instruction
   */
  protected validateInstruction(inst: InstructionNode, context: 'match' | 'replace'): void {
    const location = this.nodeLocation(inst);
    
    // Skip labels
    if (inst.mnemonic.startsWith('@')) return;
    
    // Check mnemonic is valid
    if (!this.isValidMnemonic(inst.mnemonic)) {
      this.addError(
        DiagnosticCode.UnknownMnemonic,
        `Unknown mnemonic '${inst.mnemonic}'`,
        location
      );
      return;
    }
    
    // Validate operand
    if (inst.operand) {
      this.validateOperand(inst.operand, inst.mnemonic, context);
    }
  }

  /**
   * Validate operand
   */
  protected validateOperand(
    operand: OperandNode,
    mnemonic: string,
    context: 'match' | 'replace'
  ): void {
    const location = this.nodeLocation(operand);
    
    // Extract capture for tracking
    this.extractCaptureFromOperand(operand, context);
    
    // Check addressing mode validity
    const mode = this.getAddressingMode(operand);
    if (!this.isValidAddressingMode(mnemonic, mode)) {
      this.addError(
        DiagnosticCode.InvalidAddressingMode,
        `Invalid addressing mode '${mode}' for instruction '${mnemonic}'`,
        location
      );
    }
    
    // Check range for numeric values
    this.validateOperandRange(operand, mode, location);
  }

  /**
   * Extract and track capture variables
   */
  protected extractCaptureFromOperand(
    operand: OperandNode,
    context: 'match' | 'replace'
  ): void {
    const location = this.nodeLocation(operand);
    
    const processValue = (value: NumberLiteralNode | CaptureNode | undefined) => {
      if (!value) return;
      if (value.kind === ASTNodeKind.CaptureOperand) {
        const capture = value as CaptureNode;
        if (context === 'match') {
          // Define capture
          if (this.captureDefinitions.has(capture.name)) {
            this.addWarning(
              DiagnosticCode.DuplicateCapture,
              `Capture variable '$${capture.name}' defined multiple times`,
              location
            );
          } else {
            this.captureDefinitions.set(capture.name, location);
          }
        } else {
          // Use capture
          const usages = this.captureUsages.get(capture.name) || [];
          usages.push(location);
          this.captureUsages.set(capture.name, usages);
        }
      }
    };
    
    switch (operand.kind) {
      case ASTNodeKind.ImmediateOperand:
      case ASTNodeKind.AbsoluteOperand:
      case ASTNodeKind.ZeroPageOperand:
        processValue('value' in operand ? operand.value : undefined);
        break;
      case ASTNodeKind.IndexedOperand:
        processValue('base' in operand ? operand.base : undefined);
        break;
      case ASTNodeKind.IndirectOperand:
      case ASTNodeKind.IndirectXOperand:
      case ASTNodeKind.IndirectYOperand:
        processValue('address' in operand ? operand.address : undefined);
        break;
      case ASTNodeKind.CaptureOperand:
        if (context === 'match') {
          this.captureDefinitions.set(operand.name, location);
        } else {
          const usages = this.captureUsages.get(operand.name) || [];
          usages.push(location);
          this.captureUsages.set(operand.name, usages);
        }
        break;
    }
  }

  /**
   * Validate capture variable usage
   */
  protected validateCaptures(): void {
    // Check for undefined captures used in replace
    for (const [name, usages] of this.captureUsages) {
      if (!this.captureDefinitions.has(name)) {
        usages.forEach(location => {
          this.addError(
            DiagnosticCode.UndefinedCapture,
            `Capture variable '$${name}' used in replace but not defined in match`,
            location
          );
        });
      }
    }
    
    // Check for unused captures (warning)
    for (const [name, location] of this.captureDefinitions) {
      if (!this.captureUsages.has(name)) {
        this.addWarning(
          DiagnosticCode.UnusedCapture,
          `Capture variable '$${name}' defined but never used`,
          location
        );
      }
    }
  }

  /**
   * Validate condition
   */
  protected validateCondition(cond: ConditionNode): void {
    const location = this.nodeLocation(cond);
    
    // Check left side capture is defined
    if (typeof cond.left !== 'string') {
      const capture = cond.left as CaptureNode;
      if (!this.captureDefinitions.has(capture.name)) {
        this.addError(
          DiagnosticCode.UndefinedCapture,
          `Capture variable '$${capture.name}' used in condition but not defined`,
          location
        );
      }
    }
    
    // Check right side capture if present
    if (cond.right.kind === ASTNodeKind.CaptureOperand) {
      const capture = cond.right as CaptureNode;
      if (!this.captureDefinitions.has(capture.name)) {
        this.addError(
          DiagnosticCode.UndefinedCapture,
          `Capture variable '$${capture.name}' used in condition but not defined`,
          location
        );
      }
    }
  }

  /**
   * Validate 6502-specific rules
   */
  protected validate6502(node: PatternDefNode): void {
    // Check for implied mode instructions with operands
    if (node.match) {
      node.match.instructions.forEach(inst => {
        if (this.isImpliedModeOnly(inst.mnemonic) && inst.operand) {
          this.addError(
            DiagnosticCode.ImpliedModeWithOperand,
            `Instruction '${inst.mnemonic}' uses implied addressing and cannot have an operand`,
            this.nodeLocation(inst)
          );
        }
      });
    }
  }

  /**
   * Validate pattern logic
   */
  protected validateLogic(node: PatternDefNode): void {
    // Check if saves make sense
    if (node.saves) {
      if (node.saves.cycles < 0) {
        this.addWarning(
          DiagnosticCode.CycleSavingsNegative,
          `Pattern claims to save ${node.saves.cycles} cycles (negative)`,
          this.nodeLocation(node.saves)
        );
      }
      if (node.saves.bytes < 0) {
        this.addWarning(
          DiagnosticCode.ByteSavingsNegative,
          `Pattern claims to save ${node.saves.bytes} bytes (negative)`,
          this.nodeLocation(node.saves)
        );
      }
    }
    
    // Check if pattern actually optimizes anything
    if (node.replace && !node.replace.isEmpty) {
      const matchCount = node.match?.instructions.filter(i => !i.mnemonic.startsWith('@')).length ?? 0;
      const replaceCount = node.replace.instructions.filter(i => !i.mnemonic.startsWith('@')).length;
      
      if (matchCount <= replaceCount && (!node.saves || (node.saves.cycles <= 0 && node.saves.bytes <= 0))) {
        this.addWarning(
          DiagnosticCode.NoOptimization,
          `Pattern does not appear to provide any optimization`,
          this.nodeLocation(node)
        );
      }
    }
  }

  /**
   * Validate optional clauses and provide hints
   */
  protected validateOptionalClauses(node: PatternDefNode): void {
    const location = this.nodeLocation(node);
    
    if (!node.category) {
      this.addHint(
        DiagnosticCode.MissingCategory,
        `Pattern '${node.name}' has no category specified`,
        location
      );
    }
    
    if (!node.level) {
      this.addHint(
        DiagnosticCode.MissingLevel,
        `Pattern '${node.name}' has no optimization level specified`,
        location
      );
    }
    
    if (!node.saves) {
      this.addHint(
        DiagnosticCode.MissingSaves,
        `Pattern '${node.name}' has no saves clause - consider documenting cycle/byte savings`,
        location
      );
    }
  }

  /**
   * Validate operand numeric range
   */
  protected validateOperandRange(
    operand: OperandNode,
    mode: AddressingMode,
    location: DiagnosticLocation
  ): void {
    const value = this.getOperandNumericValue(operand);
    if (value === null) return; // Capture variable, can't check range
    
    switch (mode) {
      case AddressingMode.Immediate:
        if (value < 0 || value > 255) {
          this.addError(
            DiagnosticCode.OperandOutOfRange,
            `Immediate value ${value} out of range (0-255)`,
            location
          );
        }
        break;
        
      case AddressingMode.ZeroPage:
      case AddressingMode.ZeroPageX:
      case AddressingMode.ZeroPageY:
        if (value < 0 || value > 255) {
          this.addError(
            DiagnosticCode.OperandOutOfRange,
            `Zero page address ${value} out of range (0-255)`,
            location
          );
        }
        break;
        
      case AddressingMode.Absolute:
      case AddressingMode.AbsoluteX:
      case AddressingMode.AbsoluteY:
        if (value < 0 || value > 65535) {
          this.addError(
            DiagnosticCode.OperandOutOfRange,
            `Absolute address ${value} out of range (0-65535)`,
            location
          );
        }
        break;
        
      case AddressingMode.Relative:
        if (value < -128 || value > 127) {
          this.addWarning(
            DiagnosticCode.BranchTargetOutOfRange,
            `Branch offset ${value} may be out of range (-128 to +127)`,
            location
          );
        }
        break;
    }
  }

  // Helper methods
  
  protected addError(code: DiagnosticCode, message: string, location: DiagnosticLocation): void {
    this.diagnostics.push(createDiagnostic(code, DiagnosticSeverity.Error, message, { ...location, patternName: this.currentPattern }));
  }
  
  protected addWarning(code: DiagnosticCode, message: string, location: DiagnosticLocation): void {
    this.diagnostics.push(createDiagnostic(code, DiagnosticSeverity.Warning, message, { ...location, patternName: this.currentPattern }));
  }
  
  protected addHint(code: DiagnosticCode, message: string, location: DiagnosticLocation): void {
    this.diagnostics.push(createDiagnostic(code, DiagnosticSeverity.Hint, message, { ...location, patternName: this.currentPattern }));
  }
  
  protected nodeLocation(node: { location?: { line: number; column: number; length: number } }): DiagnosticLocation {
    return node.location ?? { line: 1, column: 1, length: 0 };
  }
  
  protected createResult(): ValidationResult {
    const errorCount = this.diagnostics.filter(d => d.severity === DiagnosticSeverity.Error).length;
    const warningCount = this.diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning).length;
    
    return {
      valid: errorCount === 0,
      diagnostics: this.diagnostics,
      errorCount,
      warningCount,
    };
  }
  
  protected isValidMnemonic(mnemonic: string): boolean {
    const valid = new Set([
      'LDA', 'LDX', 'LDY', 'STA', 'STX', 'STY',
      'TAX', 'TAY', 'TXA', 'TYA', 'TXS', 'TSX',
      'PHA', 'PLA', 'PHP', 'PLP',
      'ADC', 'SBC', 'INC', 'DEC', 'INX', 'INY', 'DEX', 'DEY',
      'AND', 'ORA', 'EOR',
      'ASL', 'LSR', 'ROL', 'ROR',
      'CMP', 'CPX', 'CPY', 'BIT',
      'BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS',
      'JMP', 'JSR', 'RTS', 'RTI', 'BRK',
      'CLC', 'SEC', 'CLI', 'SEI', 'CLV', 'CLD', 'SED',
      'NOP',
    ]);
    return valid.has(mnemonic.toUpperCase());
  }
  
  protected isImpliedModeOnly(mnemonic: string): boolean {
    const implied = new Set([
      'TAX', 'TAY', 'TXA', 'TYA', 'TXS', 'TSX',
      'PHA', 'PLA', 'PHP', 'PLP',
      'INX', 'INY', 'DEX', 'DEY',
      'RTS', 'RTI', 'BRK',
      'CLC', 'SEC', 'CLI', 'SEI', 'CLV', 'CLD', 'SED',
      'NOP',
    ]);
    return implied.has(mnemonic.toUpperCase());
  }
  
  protected getAddressingMode(operand: OperandNode): AddressingMode {
    switch (operand.kind) {
      case ASTNodeKind.ImmediateOperand: return AddressingMode.Immediate;
      case ASTNodeKind.ZeroPageOperand: return AddressingMode.ZeroPage;
      case ASTNodeKind.AbsoluteOperand: return AddressingMode.Absolute;
      case ASTNodeKind.IndexedOperand:
        return operand.index === 'X' ? AddressingMode.AbsoluteX : AddressingMode.AbsoluteY;
      case ASTNodeKind.IndirectOperand: return AddressingMode.Indirect;
      case ASTNodeKind.IndirectXOperand: return AddressingMode.IndirectX;
      case ASTNodeKind.IndirectYOperand: return AddressingMode.IndirectY;
      case ASTNodeKind.LabelOperand: return AddressingMode.Relative;
      default: return AddressingMode.Absolute;
    }
  }
  
  protected isValidAddressingMode(mnemonic: string, mode: AddressingMode): boolean {
    // Simplified - in reality would have full table
    return true; // Placeholder
  }
  
  protected getOperandNumericValue(operand: OperandNode): number | null {
    if ('value' in operand && operand.value.kind === ASTNodeKind.NumberLiteral) {
      return (operand.value as NumberLiteralNode).value;
    }
    return null;
  }
}
```

---

## Error Message Formatting

### File: `dsl/formatter.ts`

```typescript
import { Diagnostic, DiagnosticSeverity, ValidationResult } from './diagnostics.js';

/**
 * Format diagnostics for console output
 */
export function formatDiagnostics(result: ValidationResult): string {
  const lines: string[] = [];
  
  // Group by pattern
  const byPattern = new Map<string, Diagnostic[]>();
  result.diagnostics.forEach(d => {
    const pattern = d.location.patternName ?? '(file)';
    const list = byPattern.get(pattern) || [];
    list.push(d);
    byPattern.set(pattern, list);
  });
  
  for (const [pattern, diagnostics] of byPattern) {
    lines.push(`\nPattern: ${pattern}`);
    diagnostics.forEach(d => {
      lines.push(formatDiagnostic(d));
    });
  }
  
  lines.push('');
  lines.push(`${result.errorCount} error(s), ${result.warningCount} warning(s)`);
  
  return lines.join('\n');
}

/**
 * Format single diagnostic
 */
function formatDiagnostic(d: Diagnostic): string {
  const severity = getSeverityIcon(d.severity);
  const location = `${d.location.line}:${d.location.column}`;
  return `  ${severity} [${d.code}] ${location}: ${d.message}`;
}

/**
 * Get severity icon
 */
function getSeverityIcon(severity: DiagnosticSeverity): string {
  switch (severity) {
    case DiagnosticSeverity.Error: return '❌';
    case DiagnosticSeverity.Warning: return '⚠️';
    case DiagnosticSeverity.Info: return 'ℹ️';
    case DiagnosticSeverity.Hint: return '💡';
  }
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| Missing match clause | Error for missing match |
| Missing replace clause | Error for missing replace |
| Unknown mnemonic | Error for invalid instruction |
| Invalid addressing mode | Error for mode/instruction mismatch |
| Undefined capture | Error for using undefined variable |
| Unused capture | Warning for defined but unused |
| Duplicate capture | Warning for multiple definitions |
| Implied with operand | Error for NOP $00 etc |
| Out of range immediate | Error for #$100 |
| Out of range zero page | Error for $100 as ZP |
| Negative cycle savings | Warning for saves: -2 cycles |
| No optimization | Warning for ineffective pattern |
| Missing category | Hint for no category |
| Missing level | Hint for no opt level |
| Missing saves | Hint for no savings |
| Condition undefined | Error for undefined in where |
| Multiple patterns | Validate all patterns |
| Empty file | Handle gracefully |
| Format output | Correct formatting |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `dsl/diagnostics.ts` | [ ] |
| Create `dsl/validator.ts` | [ ] |
| Create `dsl/formatter.ts` | [ ] |
| Implement structural validation | [ ] |
| Implement semantic validation | [ ] |
| Implement 6502 validation | [ ] |
| Implement logic validation | [ ] |
| Implement capture tracking | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

## Complete DSL Pipeline Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Pattern DSL Pipeline                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  pattern.dsl ──► Lexer ──► Parser ──► Validator ──► Generator │
│     (8.10a)      (8.10a)   (8.10c)    (8.10e)      (8.10d)   │
│                                                             │
│  Examples: 8.10b                                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Output: TypeScript pattern classes + registration code     │
└─────────────────────────────────────────────────────────────┘
```

---

**Next Task**: 8.11a → `08-11a-cost-basic.md`