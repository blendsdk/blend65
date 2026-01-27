# Task 8.10c: Pattern DSL Parser Implementation

> **Task**: 8.10c of 12 (Peephole Phase)  
> **Time**: ~3 hours  
> **Tests**: ~50 tests  
> **Prerequisites**: Tasks 8.10a-b (DSL Grammar & Examples)

---

## Overview

Implement the recursive descent parser for the Pattern DSL. Transforms token stream into an Abstract Syntax Tree (AST) representing pattern definitions.

---

## AST Node Types

### File: `dsl/ast.ts`

```typescript
/**
 * Base AST node
 */
export interface ASTNode {
  readonly kind: ASTNodeKind;
  readonly location: SourceLocation;
}

/**
 * AST node kinds
 */
export enum ASTNodeKind {
  // Top level
  PatternFile = 'PatternFile',
  PatternDef = 'PatternDef',
  
  // Clauses
  MatchClause = 'MatchClause',
  ReplaceClause = 'ReplaceClause',
  WhereClause = 'WhereClause',
  SavesClause = 'SavesClause',
  CategoryClause = 'CategoryClause',
  LevelClause = 'LevelClause',
  
  // Instructions
  Instruction = 'Instruction',
  InstructionSeq = 'InstructionSeq',
  
  // Operands
  ImmediateOperand = 'ImmediateOperand',
  AbsoluteOperand = 'AbsoluteOperand',
  ZeroPageOperand = 'ZeroPageOperand',
  IndexedOperand = 'IndexedOperand',
  IndirectOperand = 'IndirectOperand',
  IndirectXOperand = 'IndirectXOperand',
  IndirectYOperand = 'IndirectYOperand',
  CaptureOperand = 'CaptureOperand',
  LabelOperand = 'LabelOperand',
  
  // Conditions
  Condition = 'Condition',
  ConditionList = 'ConditionList',
  
  // Values
  NumberLiteral = 'NumberLiteral',
  Identifier = 'Identifier',
  Label = 'Label',
}

/**
 * Source location
 */
export interface SourceLocation {
  readonly line: number;
  readonly column: number;
  readonly length: number;
}

/**
 * Pattern file (root)
 */
export interface PatternFileNode extends ASTNode {
  readonly kind: ASTNodeKind.PatternFile;
  readonly patterns: PatternDefNode[];
}

/**
 * Pattern definition
 */
export interface PatternDefNode extends ASTNode {
  readonly kind: ASTNodeKind.PatternDef;
  readonly name: string;
  readonly match: MatchClauseNode;
  readonly replace: ReplaceClauseNode;
  readonly where?: WhereClauseNode;
  readonly saves?: SavesClauseNode;
  readonly category?: CategoryClauseNode;
  readonly level?: LevelClauseNode;
}

/**
 * Match clause
 */
export interface MatchClauseNode extends ASTNode {
  readonly kind: ASTNodeKind.MatchClause;
  readonly instructions: InstructionNode[];
}

/**
 * Replace clause
 */
export interface ReplaceClauseNode extends ASTNode {
  readonly kind: ASTNodeKind.ReplaceClause;
  readonly instructions: InstructionNode[];
  readonly isEmpty: boolean;  // // empty comment
}

/**
 * Instruction node
 */
export interface InstructionNode extends ASTNode {
  readonly kind: ASTNodeKind.Instruction;
  readonly mnemonic: string;
  readonly operand?: OperandNode;
}

/**
 * Operand types
 */
export type OperandNode =
  | ImmediateOperandNode
  | AbsoluteOperandNode
  | ZeroPageOperandNode
  | IndexedOperandNode
  | IndirectOperandNode
  | IndirectXOperandNode
  | IndirectYOperandNode
  | CaptureOperandNode
  | LabelOperandNode;

/**
 * Immediate operand: #$FF or #$name
 */
export interface ImmediateOperandNode extends ASTNode {
  readonly kind: ASTNodeKind.ImmediateOperand;
  readonly value: NumberLiteralNode | CaptureNode;
}

/**
 * Absolute operand: $1234 or $name
 */
export interface AbsoluteOperandNode extends ASTNode {
  readonly kind: ASTNodeKind.AbsoluteOperand;
  readonly value: NumberLiteralNode | CaptureNode;
}

/**
 * Zero page operand: $zp (< 256)
 */
export interface ZeroPageOperandNode extends ASTNode {
  readonly kind: ASTNodeKind.ZeroPageOperand;
  readonly value: NumberLiteralNode | CaptureNode;
}

/**
 * Indexed operand: $addr,X or $addr,Y
 */
export interface IndexedOperandNode extends ASTNode {
  readonly kind: ASTNodeKind.IndexedOperand;
  readonly base: NumberLiteralNode | CaptureNode;
  readonly index: 'X' | 'Y';
}

/**
 * Indirect operand: ($addr)
 */
export interface IndirectOperandNode extends ASTNode {
  readonly kind: ASTNodeKind.IndirectOperand;
  readonly address: NumberLiteralNode | CaptureNode;
}

/**
 * Indirect X operand: ($addr,X)
 */
export interface IndirectXOperandNode extends ASTNode {
  readonly kind: ASTNodeKind.IndirectXOperand;
  readonly address: NumberLiteralNode | CaptureNode;
}

/**
 * Indirect Y operand: ($addr),Y
 */
export interface IndirectYOperandNode extends ASTNode {
  readonly kind: ASTNodeKind.IndirectYOperand;
  readonly address: NumberLiteralNode | CaptureNode;
}

/**
 * Capture operand: $name
 */
export interface CaptureOperandNode extends ASTNode {
  readonly kind: ASTNodeKind.CaptureOperand;
  readonly name: string;
}

/**
 * Label operand: @label
 */
export interface LabelOperandNode extends ASTNode {
  readonly kind: ASTNodeKind.LabelOperand;
  readonly name: string;
}

/**
 * Capture variable
 */
export interface CaptureNode extends ASTNode {
  readonly kind: ASTNodeKind.CaptureOperand;
  readonly name: string;
}

/**
 * Number literal
 */
export interface NumberLiteralNode extends ASTNode {
  readonly kind: ASTNodeKind.NumberLiteral;
  readonly value: number;
  readonly format: 'decimal' | 'hex' | 'binary';
}

/**
 * Where clause
 */
export interface WhereClauseNode extends ASTNode {
  readonly kind: ASTNodeKind.WhereClause;
  readonly conditions: ConditionNode[];
}

/**
 * Condition
 */
export interface ConditionNode extends ASTNode {
  readonly kind: ASTNodeKind.Condition;
  readonly left: CaptureNode | string;
  readonly operator: '=' | '!=' | '<' | '>';
  readonly right: CaptureNode | NumberLiteralNode;
}

/**
 * Saves clause
 */
export interface SavesClauseNode extends ASTNode {
  readonly kind: ASTNodeKind.SavesClause;
  readonly cycles: number;
  readonly bytes: number;
}

/**
 * Category clause
 */
export interface CategoryClauseNode extends ASTNode {
  readonly kind: ASTNodeKind.CategoryClause;
  readonly category: string;
}

/**
 * Level clause
 */
export interface LevelClauseNode extends ASTNode {
  readonly kind: ASTNodeKind.LevelClause;
  readonly levels: OptimizationLevel[];
}

/**
 * Optimization levels
 */
export enum OptimizationLevel {
  O1 = 'O1',
  O2 = 'O2',
  O3 = 'O3',
  Os = 'Os',
  Oz = 'Oz',
}
```

---

## Parser Implementation

### File: `dsl/parser.ts`

```typescript
import { DSLToken, DSLTokenType } from './tokens.js';
import {
  ASTNode, ASTNodeKind, PatternFileNode, PatternDefNode,
  MatchClauseNode, ReplaceClauseNode, InstructionNode,
  OperandNode, WhereClauseNode, SavesClauseNode,
  CategoryClauseNode, LevelClauseNode, ConditionNode,
  NumberLiteralNode, CaptureNode, SourceLocation,
  OptimizationLevel,
} from './ast.js';

/**
 * Parser error
 */
export class DSLParseError extends Error {
  constructor(
    message: string,
    public readonly token: DSLToken,
    public readonly expected?: string
  ) {
    super(`${message} at line ${token.line}, column ${token.column}`);
    this.name = 'DSLParseError';
  }
}

/**
 * Pattern DSL Parser
 */
export class DSLParser {
  protected tokens: DSLToken[];
  protected current: number = 0;
  protected errors: DSLParseError[] = [];

  constructor(tokens: DSLToken[]) {
    this.tokens = tokens.filter(t => 
      t.type !== DSLTokenType.Newline && 
      t.type !== DSLTokenType.Comment
    );
  }

  /**
   * Parse entire file
   */
  parse(): PatternFileNode {
    const patterns: PatternDefNode[] = [];
    
    while (!this.isAtEnd()) {
      try {
        patterns.push(this.parsePattern());
      } catch (error) {
        if (error instanceof DSLParseError) {
          this.errors.push(error);
          this.synchronize();
        } else {
          throw error;
        }
      }
    }
    
    return {
      kind: ASTNodeKind.PatternFile,
      location: this.locationFrom(patterns[0]?.location ?? { line: 1, column: 1, length: 0 }),
      patterns,
    };
  }

  /**
   * Get parse errors
   */
  getErrors(): DSLParseError[] {
    return this.errors;
  }

  /**
   * Parse pattern definition
   */
  protected parsePattern(): PatternDefNode {
    const start = this.current;
    
    // pattern keyword
    this.expect(DSLTokenType.Pattern, 'pattern');
    
    // pattern name
    const nameToken = this.expect(DSLTokenType.Identifier, 'pattern name');
    
    // opening brace
    this.expect(DSLTokenType.LeftBrace, '{');
    
    // parse clauses
    let match: MatchClauseNode | undefined;
    let replace: ReplaceClauseNode | undefined;
    let where: WhereClauseNode | undefined;
    let saves: SavesClauseNode | undefined;
    let category: CategoryClauseNode | undefined;
    let level: LevelClauseNode | undefined;
    
    while (!this.check(DSLTokenType.RightBrace) && !this.isAtEnd()) {
      if (this.check(DSLTokenType.Match)) {
        match = this.parseMatchClause();
      } else if (this.check(DSLTokenType.Replace)) {
        replace = this.parseReplaceClause();
      } else if (this.check(DSLTokenType.Where)) {
        where = this.parseWhereClause();
      } else if (this.check(DSLTokenType.Saves)) {
        saves = this.parseSavesClause();
      } else if (this.check(DSLTokenType.Category)) {
        category = this.parseCategoryClause();
      } else if (this.check(DSLTokenType.Level)) {
        level = this.parseLevelClause();
      } else {
        throw new DSLParseError(
          `Unexpected token: ${this.peek().value}`,
          this.peek(),
          'clause keyword'
        );
      }
    }
    
    // closing brace
    this.expect(DSLTokenType.RightBrace, '}');
    
    // validate required clauses
    if (!match) {
      throw new DSLParseError('Pattern missing match clause', this.tokens[start]);
    }
    if (!replace) {
      throw new DSLParseError('Pattern missing replace clause', this.tokens[start]);
    }
    
    return {
      kind: ASTNodeKind.PatternDef,
      location: this.tokenLocation(this.tokens[start]),
      name: nameToken.value,
      match,
      replace,
      where,
      saves,
      category,
      level,
    };
  }

  /**
   * Parse match clause
   */
  protected parseMatchClause(): MatchClauseNode {
    const token = this.advance(); // match
    this.expect(DSLTokenType.Colon, ':');
    
    const instructions = this.parseInstructionSequence();
    
    return {
      kind: ASTNodeKind.MatchClause,
      location: this.tokenLocation(token),
      instructions,
    };
  }

  /**
   * Parse replace clause
   */
  protected parseReplaceClause(): ReplaceClauseNode {
    const token = this.advance(); // replace
    this.expect(DSLTokenType.Colon, ':');
    
    // Check for empty replacement (comment only)
    const isEmpty = this.checkComment();
    const instructions = isEmpty ? [] : this.parseInstructionSequence();
    
    return {
      kind: ASTNodeKind.ReplaceClause,
      location: this.tokenLocation(token),
      instructions,
      isEmpty,
    };
  }

  /**
   * Parse instruction sequence
   */
  protected parseInstructionSequence(): InstructionNode[] {
    const instructions: InstructionNode[] = [];
    
    // First instruction
    if (this.check(DSLTokenType.Mnemonic) || this.check(DSLTokenType.At)) {
      instructions.push(this.parseInstruction());
    }
    
    // Additional instructions separated by semicolon
    while (this.check(DSLTokenType.Semicolon)) {
      this.advance(); // consume semicolon
      if (this.check(DSLTokenType.Mnemonic) || this.check(DSLTokenType.At)) {
        instructions.push(this.parseInstruction());
      }
    }
    
    return instructions;
  }

  /**
   * Parse single instruction
   */
  protected parseInstruction(): InstructionNode {
    // Handle labels (@skip:)
    if (this.check(DSLTokenType.At)) {
      return this.parseLabel();
    }
    
    const token = this.expect(DSLTokenType.Mnemonic, 'mnemonic');
    const mnemonic = token.value;
    
    // Parse operand if present
    let operand: OperandNode | undefined;
    if (this.hasOperand()) {
      operand = this.parseOperand();
    }
    
    return {
      kind: ASTNodeKind.Instruction,
      location: this.tokenLocation(token),
      mnemonic,
      operand,
    };
  }

  /**
   * Check if instruction has operand
   */
  protected hasOperand(): boolean {
    const next = this.peek();
    return (
      next.type === DSLTokenType.Hash ||
      next.type === DSLTokenType.Number ||
      next.type === DSLTokenType.Capture ||
      next.type === DSLTokenType.LeftParen ||
      next.type === DSLTokenType.At ||
      next.type === DSLTokenType.Register
    );
  }

  /**
   * Parse operand
   */
  protected parseOperand(): OperandNode {
    // Immediate: #value
    if (this.check(DSLTokenType.Hash)) {
      return this.parseImmediate();
    }
    
    // Indirect: (addr) or (addr,X) or (addr),Y
    if (this.check(DSLTokenType.LeftParen)) {
      return this.parseIndirect();
    }
    
    // Label: @label
    if (this.check(DSLTokenType.At)) {
      return this.parseLabelOperand();
    }
    
    // Absolute/ZeroPage/Indexed: addr or addr,X or addr,Y
    return this.parseAddressOperand();
  }

  /**
   * Parse immediate operand: #$FF or #$name
   */
  protected parseImmediate(): OperandNode {
    const hash = this.advance(); // #
    const value = this.parseValue();
    
    return {
      kind: ASTNodeKind.ImmediateOperand,
      location: this.tokenLocation(hash),
      value,
    };
  }

  /**
   * Parse indirect operand
   */
  protected parseIndirect(): OperandNode {
    const start = this.advance(); // (
    const address = this.parseValue();
    
    // Check for indexed indirect: ($addr,X)
    if (this.check(DSLTokenType.Comma)) {
      this.advance(); // ,
      const reg = this.expect(DSLTokenType.Register, 'X');
      if (reg.value !== 'X') {
        throw new DSLParseError('Indexed indirect requires X', reg);
      }
      this.expect(DSLTokenType.RightParen, ')');
      return {
        kind: ASTNodeKind.IndirectXOperand,
        location: this.tokenLocation(start),
        address,
      };
    }
    
    this.expect(DSLTokenType.RightParen, ')');
    
    // Check for indirect indexed: ($addr),Y
    if (this.check(DSLTokenType.Comma)) {
      this.advance(); // ,
      const reg = this.expect(DSLTokenType.Register, 'Y');
      if (reg.value !== 'Y') {
        throw new DSLParseError('Indirect indexed requires Y', reg);
      }
      return {
        kind: ASTNodeKind.IndirectYOperand,
        location: this.tokenLocation(start),
        address,
      };
    }
    
    // Plain indirect: ($addr)
    return {
      kind: ASTNodeKind.IndirectOperand,
      location: this.tokenLocation(start),
      address,
    };
  }

  /**
   * Parse address operand (absolute, zero page, or indexed)
   */
  protected parseAddressOperand(): OperandNode {
    const value = this.parseValue();
    const location = this.tokenLocation(this.previous());
    
    // Check for indexed: addr,X or addr,Y
    if (this.check(DSLTokenType.Comma)) {
      this.advance(); // ,
      const reg = this.expect(DSLTokenType.Register, 'X or Y');
      return {
        kind: ASTNodeKind.IndexedOperand,
        location,
        base: value,
        index: reg.value as 'X' | 'Y',
      };
    }
    
    // Determine if zero page or absolute based on value
    if (value.kind === ASTNodeKind.NumberLiteral && value.value < 256) {
      return {
        kind: ASTNodeKind.ZeroPageOperand,
        location,
        value,
      };
    }
    
    return {
      kind: ASTNodeKind.AbsoluteOperand,
      location,
      value,
    };
  }

  /**
   * Parse value (number or capture)
   */
  protected parseValue(): NumberLiteralNode | CaptureNode {
    if (this.check(DSLTokenType.Number)) {
      return this.parseNumber();
    }
    
    if (this.check(DSLTokenType.Capture)) {
      return this.parseCapture();
    }
    
    throw new DSLParseError(
      `Expected number or capture, got ${this.peek().value}`,
      this.peek()
    );
  }

  /**
   * Parse number literal
   */
  protected parseNumber(): NumberLiteralNode {
    const token = this.advance();
    const { value, format } = this.parseNumberValue(token.value);
    
    return {
      kind: ASTNodeKind.NumberLiteral,
      location: this.tokenLocation(token),
      value,
      format,
    };
  }

  /**
   * Parse number value from string
   */
  protected parseNumberValue(str: string): { value: number; format: 'decimal' | 'hex' | 'binary' } {
    if (str.startsWith('$')) {
      return { value: parseInt(str.slice(1), 16), format: 'hex' };
    }
    if (str.startsWith('%')) {
      return { value: parseInt(str.slice(1), 2), format: 'binary' };
    }
    return { value: parseInt(str, 10), format: 'decimal' };
  }

  /**
   * Parse capture variable
   */
  protected parseCapture(): CaptureNode {
    const token = this.advance();
    return {
      kind: ASTNodeKind.CaptureOperand,
      location: this.tokenLocation(token),
      name: token.value.slice(1), // Remove $ prefix
    };
  }

  /**
   * Parse label (as instruction)
   */
  protected parseLabel(): InstructionNode {
    const at = this.advance(); // @
    const name = this.expect(DSLTokenType.Identifier, 'label name');
    this.expect(DSLTokenType.Colon, ':');
    
    return {
      kind: ASTNodeKind.Instruction,
      location: this.tokenLocation(at),
      mnemonic: '@' + name.value,
      operand: undefined,
    };
  }

  /**
   * Parse label operand
   */
  protected parseLabelOperand(): OperandNode {
    const at = this.advance(); // @
    const name = this.expect(DSLTokenType.Identifier, 'label name');
    
    return {
      kind: ASTNodeKind.LabelOperand,
      location: this.tokenLocation(at),
      name: name.value,
    };
  }

  /**
   * Parse where clause
   */
  protected parseWhereClause(): WhereClauseNode {
    const token = this.advance(); // where
    this.expect(DSLTokenType.Colon, ':');
    
    const conditions = this.parseConditions();
    
    return {
      kind: ASTNodeKind.WhereClause,
      location: this.tokenLocation(token),
      conditions,
    };
  }

  /**
   * Parse condition list
   */
  protected parseConditions(): ConditionNode[] {
    const conditions: ConditionNode[] = [];
    
    conditions.push(this.parseCondition());
    
    while (this.check(DSLTokenType.Comma)) {
      this.advance(); // ,
      conditions.push(this.parseCondition());
    }
    
    return conditions;
  }

  /**
   * Parse single condition
   */
  protected parseCondition(): ConditionNode {
    // Left side: capture or identifier
    let left: CaptureNode | string;
    const leftToken = this.peek();
    
    if (this.check(DSLTokenType.Capture)) {
      left = this.parseCapture();
    } else if (this.check(DSLTokenType.Identifier)) {
      left = this.advance().value;
    } else {
      throw new DSLParseError('Expected condition left side', this.peek());
    }
    
    // Operator
    const opToken = this.peek();
    let operator: '=' | '!=' | '<' | '>';
    
    if (this.check(DSLTokenType.Equal)) {
      operator = '=';
      this.advance();
    } else if (this.check(DSLTokenType.NotEqual)) {
      operator = '!=';
      this.advance();
    } else if (this.check(DSLTokenType.Less)) {
      operator = '<';
      this.advance();
    } else if (this.check(DSLTokenType.Greater)) {
      operator = '>';
      this.advance();
    } else {
      throw new DSLParseError('Expected comparison operator', this.peek());
    }
    
    // Right side
    const right = this.parseValue();
    
    return {
      kind: ASTNodeKind.Condition,
      location: this.tokenLocation(leftToken),
      left,
      operator,
      right,
    };
  }

  /**
   * Parse saves clause
   */
  protected parseSavesClause(): SavesClauseNode {
    const token = this.advance(); // saves
    this.expect(DSLTokenType.Colon, ':');
    
    let cycles = 0;
    let bytes = 0;
    
    // First value
    const num1 = this.parseNumber();
    if (this.check(DSLTokenType.Cycles)) {
      cycles = num1.value;
      this.advance();
    } else if (this.check(DSLTokenType.Bytes)) {
      bytes = num1.value;
      this.advance();
    }
    
    // Optional second value
    if (this.check(DSLTokenType.Comma)) {
      this.advance();
      const num2 = this.parseNumber();
      if (this.check(DSLTokenType.Cycles)) {
        cycles = num2.value;
        this.advance();
      } else if (this.check(DSLTokenType.Bytes)) {
        bytes = num2.value;
        this.advance();
      }
    }
    
    return {
      kind: ASTNodeKind.SavesClause,
      location: this.tokenLocation(token),
      cycles,
      bytes,
    };
  }

  /**
   * Parse category clause
   */
  protected parseCategoryClause(): CategoryClauseNode {
    const token = this.advance(); // category
    this.expect(DSLTokenType.Colon, ':');
    const name = this.expect(DSLTokenType.Identifier, 'category name');
    
    return {
      kind: ASTNodeKind.CategoryClause,
      location: this.tokenLocation(token),
      category: name.value,
    };
  }

  /**
   * Parse level clause
   */
  protected parseLevelClause(): LevelClauseNode {
    const token = this.advance(); // level
    this.expect(DSLTokenType.Colon, ':');
    
    const levels: OptimizationLevel[] = [];
    
    // First level
    levels.push(this.parseLevel());
    
    // Additional levels
    while (this.check(DSLTokenType.Comma)) {
      this.advance();
      levels.push(this.parseLevel());
    }
    
    return {
      kind: ASTNodeKind.LevelClause,
      location: this.tokenLocation(token),
      levels,
    };
  }

  /**
   * Parse single optimization level
   */
  protected parseLevel(): OptimizationLevel {
    const token = this.expect(DSLTokenType.Identifier, 'optimization level');
    const level = token.value.toUpperCase();
    
    if (!Object.values(OptimizationLevel).includes(level as OptimizationLevel)) {
      throw new DSLParseError(`Invalid optimization level: ${level}`, token);
    }
    
    return level as OptimizationLevel;
  }

  // Helper methods
  
  protected isAtEnd(): boolean {
    return this.peek().type === DSLTokenType.EOF;
  }
  
  protected peek(): DSLToken {
    return this.tokens[this.current];
  }
  
  protected previous(): DSLToken {
    return this.tokens[this.current - 1];
  }
  
  protected advance(): DSLToken {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  
  protected check(type: DSLTokenType): boolean {
    return !this.isAtEnd() && this.peek().type === type;
  }
  
  protected checkComment(): boolean {
    // Look ahead for // empty style comment
    return this.peek().value.startsWith('//');
  }
  
  protected expect(type: DSLTokenType, expected: string): DSLToken {
    if (this.check(type)) return this.advance();
    throw new DSLParseError(
      `Expected ${expected}, got ${this.peek().value}`,
      this.peek(),
      expected
    );
  }
  
  protected tokenLocation(token: DSLToken): SourceLocation {
    return {
      line: token.line,
      column: token.column,
      length: token.length,
    };
  }
  
  protected locationFrom(loc: SourceLocation): SourceLocation {
    return { ...loc };
  }
  
  protected synchronize(): void {
    this.advance();
    while (!this.isAtEnd()) {
      if (this.check(DSLTokenType.Pattern)) return;
      if (this.check(DSLTokenType.RightBrace)) {
        this.advance();
        return;
      }
      this.advance();
    }
  }
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| Parse empty file | Handle empty input |
| Parse single pattern | Basic pattern structure |
| Parse multiple patterns | Multiple patterns in file |
| Parse match clause | Instruction sequence |
| Parse replace clause | Including empty replacement |
| Parse where clause | Conditions |
| Parse saves clause | Cycles and bytes |
| Parse category clause | Category identifier |
| Parse level clause | Multiple levels |
| Parse immediate | #$FF, #42, #$name |
| Parse absolute | $1234, $name |
| Parse zero page | $FF (auto-detected) |
| Parse indexed X | $addr,X |
| Parse indexed Y | $addr,Y |
| Parse indirect | ($addr) |
| Parse indirect X | ($addr,X) |
| Parse indirect Y | ($addr),Y |
| Parse labels | @skip: |
| Parse conditions | =, !=, <, > |
| Error recovery | Continue after errors |
| Error messages | Line/column reporting |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `dsl/ast.ts` | [ ] |
| Create `dsl/parser.ts` | [ ] |
| Implement pattern parsing | [ ] |
| Implement clause parsing | [ ] |
| Implement operand parsing | [ ] |
| Implement error recovery | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 8.10d → `08-10d-dsl-generator.md`