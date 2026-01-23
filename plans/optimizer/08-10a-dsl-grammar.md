# Task 8.10a: Pattern DSL Grammar & Tokens

> **Task**: 8.10a of 12 (Peephole Phase)  
> **Time**: ~2 hours  
> **Tests**: ~40 tests  
> **Prerequisites**: Tasks 8.1-8.9 (Pattern Framework & Patterns)

---

## Overview

Define the grammar and token types for a domain-specific language (DSL) that enables declarative pattern definition. This replaces verbose TypeScript pattern classes with concise, readable pattern specifications.

**Goals**:
- Human-readable pattern syntax
- Easy pattern maintenance
- Compile-time validation
- IDE support potential

---

## DSL Design Philosophy

### Why a DSL?

Current TypeScript patterns require:
```typescript
// ~50 lines per pattern
export class RedundantLoadAfterStore extends BasePattern {
  readonly id = 'redundant-load-after-store';
  readonly description = 'Remove load after store to same location';
  readonly category = PatternCategory.LoadStore;
  // ... 40+ more lines
}
```

With DSL:
```
pattern redundant-load-after-store {
  match: STA $addr; LDA $addr
  replace: STA $addr
  saves: 3 cycles, 2 bytes
}
```

---

## Token Types

### File: `dsl/tokens.ts`

```typescript
/**
 * DSL token types
 */
export enum DSLTokenType {
  // Keywords
  Pattern = 'PATTERN',
  Match = 'MATCH',
  Replace = 'REPLACE',
  Where = 'WHERE',
  Saves = 'SAVES',
  Category = 'CATEGORY',
  Level = 'LEVEL',
  
  // Literals
  Identifier = 'IDENTIFIER',      // pattern-name, label
  Mnemonic = 'MNEMONIC',          // LDA, STA, etc.
  Register = 'REGISTER',          // A, X, Y
  Number = 'NUMBER',              // 42, $FF, %1010
  Capture = 'CAPTURE',            // $name
  
  // Delimiters
  LeftBrace = 'LBRACE',           // {
  RightBrace = 'RBRACE',          // }
  LeftParen = 'LPAREN',           // (
  RightParen = 'RPAREN',          // )
  LeftBracket = 'LBRACKET',       // [
  RightBracket = 'RBRACKET',      // ]
  Semicolon = 'SEMICOLON',        // ;
  Colon = 'COLON',                // :
  Comma = 'COMMA',                // ,
  
  // Operators
  Arrow = 'ARROW',                // =>
  Hash = 'HASH',                  // #
  At = 'AT',                      // @
  Star = 'STAR',                  // *
  Plus = 'PLUS',                  // +
  Minus = 'MINUS',                // -
  Equal = 'EQUAL',                // =
  NotEqual = 'NOTEQUAL',          // !=
  Less = 'LESS',                  // <
  Greater = 'GREATER',            // >
  
  // Addressing modes
  Immediate = 'IMMEDIATE',        // #$value
  ZeroPage = 'ZEROPAGE',          // $zp
  Absolute = 'ABSOLUTE',          // $addr
  IndexedX = 'INDEXED_X',         // ,X
  IndexedY = 'INDEXED_Y',         // ,Y
  Indirect = 'INDIRECT',          // ($addr)
  IndirectX = 'INDIRECT_X',       // ($addr,X)
  IndirectY = 'INDIRECT_Y',       // ($addr),Y
  
  // Units
  Cycles = 'CYCLES',
  Bytes = 'BYTES',
  
  // Special
  Wildcard = 'WILDCARD',          // _
  Optional = 'OPTIONAL',          // ?
  OneOrMore = 'ONEORMORE',        // +
  ZeroOrMore = 'ZEROORMORE',      // *
  
  // Whitespace/Comments
  Newline = 'NEWLINE',
  Comment = 'COMMENT',            // // or /* */
  
  // End
  EOF = 'EOF',
  Invalid = 'INVALID',
}

/**
 * DSL token with position info
 */
export interface DSLToken {
  readonly type: DSLTokenType;
  readonly value: string;
  readonly line: number;
  readonly column: number;
  readonly length: number;
}

/**
 * Create a token
 */
export function createToken(
  type: DSLTokenType,
  value: string,
  line: number,
  column: number
): DSLToken {
  return {
    type,
    value,
    line,
    column,
    length: value.length,
  };
}
```

---

## Lexer Implementation

### File: `dsl/lexer.ts`

```typescript
import { DSLToken, DSLTokenType, createToken } from './tokens.js';

/**
 * DSL keywords mapped to token types
 */
const KEYWORDS: Map<string, DSLTokenType> = new Map([
  ['pattern', DSLTokenType.Pattern],
  ['match', DSLTokenType.Match],
  ['replace', DSLTokenType.Replace],
  ['where', DSLTokenType.Where],
  ['saves', DSLTokenType.Saves],
  ['category', DSLTokenType.Category],
  ['level', DSLTokenType.Level],
  ['cycles', DSLTokenType.Cycles],
  ['bytes', DSLTokenType.Bytes],
]);

/**
 * 6502 mnemonics
 */
const MNEMONICS = new Set([
  // Load/Store
  'LDA', 'LDX', 'LDY', 'STA', 'STX', 'STY',
  // Transfer
  'TAX', 'TAY', 'TXA', 'TYA', 'TXS', 'TSX',
  // Stack
  'PHA', 'PLA', 'PHP', 'PLP',
  // Arithmetic
  'ADC', 'SBC', 'INC', 'DEC', 'INX', 'INY', 'DEX', 'DEY',
  // Logical
  'AND', 'ORA', 'EOR',
  // Shift
  'ASL', 'LSR', 'ROL', 'ROR',
  // Compare
  'CMP', 'CPX', 'CPY', 'BIT',
  // Branch
  'BCC', 'BCS', 'BEQ', 'BNE', 'BMI', 'BPL', 'BVC', 'BVS',
  // Jump
  'JMP', 'JSR', 'RTS', 'RTI', 'BRK',
  // Flags
  'CLC', 'SEC', 'CLI', 'SEI', 'CLV', 'CLD', 'SED',
  // No-op
  'NOP',
]);

/**
 * DSL Lexer
 */
export class DSLLexer {
  protected source: string;
  protected position: number = 0;
  protected line: number = 1;
  protected column: number = 1;
  protected tokens: DSLToken[] = [];

  constructor(source: string) {
    this.source = source;
  }

  /**
   * Tokenize the entire source
   */
  tokenize(): DSLToken[] {
    while (!this.isAtEnd()) {
      this.scanToken();
    }
    this.tokens.push(createToken(DSLTokenType.EOF, '', this.line, this.column));
    return this.tokens;
  }

  /**
   * Scan a single token
   */
  protected scanToken(): void {
    this.skipWhitespace();
    if (this.isAtEnd()) return;

    const startLine = this.line;
    const startColumn = this.column;
    const char = this.advance();

    switch (char) {
      // Single-character tokens
      case '{': this.addToken(DSLTokenType.LeftBrace, char, startLine, startColumn); break;
      case '}': this.addToken(DSLTokenType.RightBrace, char, startLine, startColumn); break;
      case '(': this.addToken(DSLTokenType.LeftParen, char, startLine, startColumn); break;
      case ')': this.addToken(DSLTokenType.RightParen, char, startLine, startColumn); break;
      case '[': this.addToken(DSLTokenType.LeftBracket, char, startLine, startColumn); break;
      case ']': this.addToken(DSLTokenType.RightBracket, char, startLine, startColumn); break;
      case ';': this.addToken(DSLTokenType.Semicolon, char, startLine, startColumn); break;
      case ':': this.addToken(DSLTokenType.Colon, char, startLine, startColumn); break;
      case ',': this.addToken(DSLTokenType.Comma, char, startLine, startColumn); break;
      case '#': this.addToken(DSLTokenType.Hash, char, startLine, startColumn); break;
      case '@': this.addToken(DSLTokenType.At, char, startLine, startColumn); break;
      case '*': this.addToken(DSLTokenType.Star, char, startLine, startColumn); break;
      case '+': this.addToken(DSLTokenType.Plus, char, startLine, startColumn); break;
      case '_': this.addToken(DSLTokenType.Wildcard, char, startLine, startColumn); break;
      case '?': this.addToken(DSLTokenType.Optional, char, startLine, startColumn); break;
      
      // Two-character tokens
      case '-':
        if (this.peek() === '>') {
          this.advance();
          this.addToken(DSLTokenType.Arrow, '->', startLine, startColumn);
        } else {
          this.addToken(DSLTokenType.Minus, char, startLine, startColumn);
        }
        break;
        
      case '=':
        if (this.peek() === '>') {
          this.advance();
          this.addToken(DSLTokenType.Arrow, '=>', startLine, startColumn);
        } else {
          this.addToken(DSLTokenType.Equal, char, startLine, startColumn);
        }
        break;
        
      case '!':
        if (this.peek() === '=') {
          this.advance();
          this.addToken(DSLTokenType.NotEqual, '!=', startLine, startColumn);
        } else {
          this.addToken(DSLTokenType.Invalid, char, startLine, startColumn);
        }
        break;
        
      case '<': this.addToken(DSLTokenType.Less, char, startLine, startColumn); break;
      case '>': this.addToken(DSLTokenType.Greater, char, startLine, startColumn); break;
      
      // Comments
      case '/':
        if (this.peek() === '/') {
          this.lineComment();
        } else if (this.peek() === '*') {
          this.blockComment();
        } else {
          this.addToken(DSLTokenType.Invalid, char, startLine, startColumn);
        }
        break;
        
      // Newlines
      case '\n':
        this.addToken(DSLTokenType.Newline, char, startLine, startColumn);
        this.line++;
        this.column = 1;
        break;
        
      // Dollar sign - hex number or capture
      case '$':
        this.dollarToken(startLine, startColumn);
        break;
        
      // Percent - binary number
      case '%':
        this.binaryNumber(startLine, startColumn);
        break;
        
      default:
        if (this.isDigit(char)) {
          this.number(char, startLine, startColumn);
        } else if (this.isAlpha(char)) {
          this.identifier(char, startLine, startColumn);
        } else {
          this.addToken(DSLTokenType.Invalid, char, startLine, startColumn);
        }
    }
  }

  /**
   * Handle $ prefix (hex number or capture variable)
   */
  protected dollarToken(startLine: number, startColumn: number): void {
    if (this.isHexDigit(this.peek())) {
      // Hex number: $FF, $1234
      let value = '$';
      while (this.isHexDigit(this.peek())) {
        value += this.advance();
      }
      this.addToken(DSLTokenType.Number, value, startLine, startColumn);
    } else if (this.isAlpha(this.peek())) {
      // Capture variable: $addr, $val
      let value = '$';
      while (this.isAlphaNumeric(this.peek())) {
        value += this.advance();
      }
      this.addToken(DSLTokenType.Capture, value, startLine, startColumn);
    } else {
      this.addToken(DSLTokenType.Invalid, '$', startLine, startColumn);
    }
  }

  /**
   * Handle binary number %1010
   */
  protected binaryNumber(startLine: number, startColumn: number): void {
    let value = '%';
    while (this.peek() === '0' || this.peek() === '1') {
      value += this.advance();
    }
    if (value.length > 1) {
      this.addToken(DSLTokenType.Number, value, startLine, startColumn);
    } else {
      this.addToken(DSLTokenType.Invalid, value, startLine, startColumn);
    }
  }

  /**
   * Handle decimal number
   */
  protected number(first: string, startLine: number, startColumn: number): void {
    let value = first;
    while (this.isDigit(this.peek())) {
      value += this.advance();
    }
    this.addToken(DSLTokenType.Number, value, startLine, startColumn);
  }

  /**
   * Handle identifier or keyword
   */
  protected identifier(first: string, startLine: number, startColumn: number): void {
    let value = first;
    while (this.isAlphaNumeric(this.peek()) || this.peek() === '-') {
      value += this.advance();
    }
    
    // Check for keyword
    const keyword = KEYWORDS.get(value.toLowerCase());
    if (keyword) {
      this.addToken(keyword, value, startLine, startColumn);
      return;
    }
    
    // Check for mnemonic
    if (MNEMONICS.has(value.toUpperCase())) {
      this.addToken(DSLTokenType.Mnemonic, value.toUpperCase(), startLine, startColumn);
      return;
    }
    
    // Check for register
    if (['A', 'X', 'Y'].includes(value.toUpperCase())) {
      this.addToken(DSLTokenType.Register, value.toUpperCase(), startLine, startColumn);
      return;
    }
    
    // Generic identifier
    this.addToken(DSLTokenType.Identifier, value, startLine, startColumn);
  }

  /**
   * Skip whitespace (except newlines)
   */
  protected skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else {
        break;
      }
    }
  }

  /**
   * Skip line comment
   */
  protected lineComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  /**
   * Skip block comment
   */
  protected blockComment(): void {
    this.advance(); // skip *
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance(); // skip *
        this.advance(); // skip /
        return;
      }
      if (this.peek() === '\n') {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }
  }

  // Helper methods
  protected isAtEnd(): boolean { return this.position >= this.source.length; }
  protected peek(): string { return this.isAtEnd() ? '\0' : this.source[this.position]; }
  protected peekNext(): string { return this.position + 1 >= this.source.length ? '\0' : this.source[this.position + 1]; }
  protected advance(): string { this.column++; return this.source[this.position++]; }
  protected isDigit(char: string): boolean { return char >= '0' && char <= '9'; }
  protected isHexDigit(char: string): boolean { return this.isDigit(char) || (char >= 'A' && char <= 'F') || (char >= 'a' && char <= 'f'); }
  protected isAlpha(char: string): boolean { return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_'; }
  protected isAlphaNumeric(char: string): boolean { return this.isAlpha(char) || this.isDigit(char); }
  
  protected addToken(type: DSLTokenType, value: string, line: number, column: number): void {
    this.tokens.push(createToken(type, value, line, column));
  }
}
```

---

## Grammar EBNF

```ebnf
(* DSL Grammar for Peephole Patterns *)

pattern_file     = { pattern_def } ;

pattern_def      = "pattern" identifier "{" 
                   pattern_body
                   "}" ;

pattern_body     = match_clause
                   replace_clause
                   [ where_clause ]
                   [ saves_clause ]
                   [ category_clause ]
                   [ level_clause ] ;

match_clause     = "match" ":" instruction_seq ;
replace_clause   = "replace" ":" instruction_seq ;
where_clause     = "where" ":" condition_list ;
saves_clause     = "saves" ":" cost_spec ;
category_clause  = "category" ":" identifier ;
level_clause     = "level" ":" level_list ;

instruction_seq  = instruction { ";" instruction } ;

instruction      = mnemonic [ operand ] ;

operand          = immediate
                 | absolute
                 | zeropage
                 | indexed
                 | indirect
                 | capture ;

immediate        = "#" ( number | capture ) ;
absolute         = ( number | capture ) ;
zeropage         = ( number | capture ) ;
indexed          = operand "," ( "X" | "Y" ) ;
indirect         = "(" operand ")" [ "," ( "X" | "Y" ) ] ;
capture          = "$" identifier ;

condition_list   = condition { "," condition } ;
condition        = capture comparison ( capture | number ) ;
comparison       = "=" | "!=" | "<" | ">" ;

cost_spec        = number "cycles" [ "," number "bytes" ]
                 | number "bytes" [ "," number "cycles" ] ;

level_list       = level { "," level } ;
level            = "O1" | "O2" | "O3" | "Os" | "Oz" ;

number           = decimal | hex | binary ;
decimal          = digit { digit } ;
hex              = "$" hex_digit { hex_digit } ;
binary           = "%" ( "0" | "1" ) { "0" | "1" } ;
```

---

## Tests Required

| Test | Description |
|------|-------------|
| Token types | All DSLTokenType values |
| Keywords | pattern, match, replace, where, saves |
| Mnemonics | All 56 6502 mnemonics |
| Registers | A, X, Y recognition |
| Hex numbers | $FF, $1234 |
| Binary numbers | %1010, %11111111 |
| Decimal numbers | 0, 42, 255 |
| Captures | $addr, $val, $zp |
| Operators | =>, !=, <, > |
| Comments | // line, /* block */ |
| Delimiters | {}, (), [], ;, : |
| Whitespace | Space, tab handling |
| Newlines | Line/column tracking |
| Invalid tokens | Error reporting |

---

## Example Pattern (Preview)

```
// Simple redundant load elimination
pattern redundant-load-after-store {
  match: STA $addr; LDA $addr
  replace: STA $addr
  saves: 3 cycles, 2 bytes
  category: load-store
  level: O1, O2, O3
}

// Transfer chain optimization
pattern tax-txa-elimination {
  match: TAX; TXA
  replace: // empty - just keep A
  saves: 4 cycles, 2 bytes
  category: transfer
}
```

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `dsl/tokens.ts` | [ ] |
| Create `dsl/lexer.ts` | [ ] |
| Define EBNF grammar | [ ] |
| Write lexer unit tests | [ ] |
| Test all token types | [ ] |
| Test error cases | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 8.10b → `08-10b-dsl-examples.md`