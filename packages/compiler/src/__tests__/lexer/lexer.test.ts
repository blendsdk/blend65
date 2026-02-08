import { describe, expect, it } from 'vitest';
import { tokenize } from '../../lexer/index.js';
import { TokenType } from '../../lexer/types.js';

/**
 * Blend65 v2 Lexer Tests
 *
 * Comprehensive tests for the v2 lexer covering all token types.
 * NOTE: v2 removes @map syntax - memory-mapped I/O uses peek/poke intrinsics instead.
 */

describe('Blend65 v2 Lexer', () => {
  // ============================================================================
  // NUMBERS
  // ============================================================================
  describe('Numbers', () => {
    describe('Decimal Numbers', () => {
      it('should parse decimal numbers', () => {
        const tokens = tokenize('123 0 255 65535');
        expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '123' });
        expect(tokens[1]).toMatchObject({ type: TokenType.NUMBER, value: '0' });
        expect(tokens[2]).toMatchObject({ type: TokenType.NUMBER, value: '255' });
        expect(tokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '65535' });
      });
    });

    describe('Hexadecimal Numbers', () => {
      it('should parse hex numbers with $ prefix (6502 style)', () => {
        const tokens = tokenize('$D000 $FF $00 $FFFE');
        expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '$D000' });
        expect(tokens[1]).toMatchObject({ type: TokenType.NUMBER, value: '$FF' });
        expect(tokens[2]).toMatchObject({ type: TokenType.NUMBER, value: '$00' });
        expect(tokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '$FFFE' });
      });

      it('should parse hex numbers with 0x prefix (C style)', () => {
        const tokens = tokenize('0xD000 0xFF 0x00 0xFFFE');
        expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '0xD000' });
        expect(tokens[1]).toMatchObject({ type: TokenType.NUMBER, value: '0xFF' });
        expect(tokens[2]).toMatchObject({ type: TokenType.NUMBER, value: '0x00' });
        expect(tokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '0xFFFE' });
      });
    });

    describe('Binary Numbers', () => {
      it('should parse binary numbers with 0b prefix', () => {
        const tokens = tokenize('0b1010 0b0001 0b11111111');
        expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '0b1010' });
        expect(tokens[1]).toMatchObject({ type: TokenType.NUMBER, value: '0b0001' });
        expect(tokens[2]).toMatchObject({ type: TokenType.NUMBER, value: '0b11111111' });
      });
    });
  });

  // ============================================================================
  // STRINGS
  // ============================================================================
  describe('Strings', () => {
    it('should parse double-quoted strings', () => {
      const tokens = tokenize('"hello world"');
      expect(tokens[0]).toMatchObject({ type: TokenType.STRING_LITERAL, value: 'hello world' });
    });

    it('should parse single-quoted strings', () => {
      const tokens = tokenize("'hello'");
      expect(tokens[0]).toMatchObject({ type: TokenType.STRING_LITERAL, value: 'hello' });
    });

    it('should handle escape sequences', () => {
      const tokens = tokenize('"line1\\nline2\\ttab"');
      expect(tokens[0]).toMatchObject({ type: TokenType.STRING_LITERAL, value: 'line1\nline2\ttab' });
    });

    it('should handle escaped quotes', () => {
      const tokens = tokenize('"say \\"hello\\""');
      expect(tokens[0]).toMatchObject({ type: TokenType.STRING_LITERAL, value: 'say "hello"' });
    });
  });

  // ============================================================================
  // BOOLEANS
  // ============================================================================
  describe('Booleans', () => {
    it('should parse boolean literals', () => {
      const tokens = tokenize('true false');
      expect(tokens[0]).toMatchObject({ type: TokenType.BOOLEAN_LITERAL, value: 'true' });
      expect(tokens[1]).toMatchObject({ type: TokenType.BOOLEAN_LITERAL, value: 'false' });
    });
  });

  // ============================================================================
  // KEYWORDS
  // ============================================================================
  describe('Keywords', () => {
    describe('Module System Keywords', () => {
      it('should recognize module keywords', () => {
        const tokens = tokenize('module import export from');
        expect(tokens[0]).toMatchObject({ type: TokenType.MODULE, value: 'module' });
        expect(tokens[1]).toMatchObject({ type: TokenType.IMPORT, value: 'import' });
        expect(tokens[2]).toMatchObject({ type: TokenType.EXPORT, value: 'export' });
        expect(tokens[3]).toMatchObject({ type: TokenType.FROM, value: 'from' });
      });
    });

    describe('Function Keywords', () => {
      it('should recognize function keywords', () => {
        const tokens = tokenize('function return');
        expect(tokens[0]).toMatchObject({ type: TokenType.FUNCTION, value: 'function' });
        expect(tokens[1]).toMatchObject({ type: TokenType.RETURN, value: 'return' });
      });
    });

    describe('Control Flow Keywords', () => {
      it('should recognize control flow keywords', () => {
        const tokens = tokenize('if else while for switch case break continue default');
        expect(tokens[0]).toMatchObject({ type: TokenType.IF, value: 'if' });
        expect(tokens[1]).toMatchObject({ type: TokenType.ELSE, value: 'else' });
        expect(tokens[2]).toMatchObject({ type: TokenType.WHILE, value: 'while' });
        expect(tokens[3]).toMatchObject({ type: TokenType.FOR, value: 'for' });
        expect(tokens[4]).toMatchObject({ type: TokenType.SWITCH, value: 'switch' });
        expect(tokens[5]).toMatchObject({ type: TokenType.CASE, value: 'case' });
        expect(tokens[6]).toMatchObject({ type: TokenType.BREAK, value: 'break' });
        expect(tokens[7]).toMatchObject({ type: TokenType.CONTINUE, value: 'continue' });
        expect(tokens[8]).toMatchObject({ type: TokenType.DEFAULT, value: 'default' });
      });

      it('should recognize loop control keywords', () => {
        const tokens = tokenize('to downto step do');
        expect(tokens[0]).toMatchObject({ type: TokenType.TO, value: 'to' });
        expect(tokens[1]).toMatchObject({ type: TokenType.DOWNTO, value: 'downto' });
        expect(tokens[2]).toMatchObject({ type: TokenType.STEP, value: 'step' });
        expect(tokens[3]).toMatchObject({ type: TokenType.DO, value: 'do' });
      });
    });

    describe('Declaration Keywords', () => {
      it('should recognize declaration keywords', () => {
        const tokens = tokenize('let const type enum');
        expect(tokens[0]).toMatchObject({ type: TokenType.LET, value: 'let' });
        expect(tokens[1]).toMatchObject({ type: TokenType.CONST, value: 'const' });
        expect(tokens[2]).toMatchObject({ type: TokenType.TYPE, value: 'type' });
        expect(tokens[3]).toMatchObject({ type: TokenType.ENUM, value: 'enum' });
      });
    });

    describe('Type Keywords', () => {
      it('should recognize primitive type keywords', () => {
        const tokens = tokenize('byte word void');
        expect(tokens[0]).toMatchObject({ type: TokenType.BYTE, value: 'byte' });
        expect(tokens[1]).toMatchObject({ type: TokenType.WORD, value: 'word' });
        expect(tokens[2]).toMatchObject({ type: TokenType.VOID, value: 'void' });
      });
    });
  });

  // ============================================================================
  // STORAGE CLASSES (v2: NO @map!)
  // ============================================================================
  describe('Storage Classes', () => {
    it('should recognize v2 storage classes (@zp, @ram, @data)', () => {
      const tokens = tokenize('@zp @ram @data');
      expect(tokens[0]).toMatchObject({ type: TokenType.ZP, value: '@zp' });
      expect(tokens[1]).toMatchObject({ type: TokenType.RAM, value: '@ram' });
      expect(tokens[2]).toMatchObject({ type: TokenType.DATA, value: '@data' });
    });

    it('should recognize @address type', () => {
      const tokens = tokenize('@address');
      expect(tokens[0]).toMatchObject({ type: TokenType.ADDRESS, value: '@address' });
    });

    it('should NOT recognize @map as a storage class in v2', () => {
      // In v2, @map is tokenized as AT + IDENTIFIER "map"
      const tokens = tokenize('@map');
      expect(tokens[0]).toMatchObject({ type: TokenType.AT, value: '@' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'map' });
    });

    it('should treat unknown @ keywords as AT + IDENTIFIER', () => {
      const tokens = tokenize('@buffer @unknown');
      expect(tokens[0]).toMatchObject({ type: TokenType.AT, value: '@' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'buffer' });
      expect(tokens[2]).toMatchObject({ type: TokenType.AT, value: '@' });
      expect(tokens[3]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'unknown' });
    });
  });

  // ============================================================================
  // OPERATORS
  // ============================================================================
  describe('Operators', () => {
    describe('Arithmetic Operators', () => {
      it('should recognize arithmetic operators', () => {
        const tokens = tokenize('+ - * / %');
        expect(tokens[0]).toMatchObject({ type: TokenType.PLUS, value: '+' });
        expect(tokens[1]).toMatchObject({ type: TokenType.MINUS, value: '-' });
        expect(tokens[2]).toMatchObject({ type: TokenType.MULTIPLY, value: '*' });
        expect(tokens[3]).toMatchObject({ type: TokenType.DIVIDE, value: '/' });
        expect(tokens[4]).toMatchObject({ type: TokenType.MODULO, value: '%' });
      });
    });

    describe('Comparison Operators', () => {
      it('should recognize comparison operators', () => {
        const tokens = tokenize('== != < <= > >=');
        expect(tokens[0]).toMatchObject({ type: TokenType.EQUAL, value: '==' });
        expect(tokens[1]).toMatchObject({ type: TokenType.NOT_EQUAL, value: '!=' });
        expect(tokens[2]).toMatchObject({ type: TokenType.LESS_THAN, value: '<' });
        expect(tokens[3]).toMatchObject({ type: TokenType.LESS_EQUAL, value: '<=' });
        expect(tokens[4]).toMatchObject({ type: TokenType.GREATER_THAN, value: '>' });
        expect(tokens[5]).toMatchObject({ type: TokenType.GREATER_EQUAL, value: '>=' });
      });
    });

    describe('Logical Operators', () => {
      it('should recognize logical operators', () => {
        const tokens = tokenize('&& || !');
        expect(tokens[0]).toMatchObject({ type: TokenType.AND, value: '&&' });
        expect(tokens[1]).toMatchObject({ type: TokenType.OR, value: '||' });
        expect(tokens[2]).toMatchObject({ type: TokenType.NOT, value: '!' });
      });
    });

    describe('Bitwise Operators', () => {
      it('should recognize bitwise operators', () => {
        const tokens = tokenize('& | ^ ~ << >>');
        expect(tokens[0]).toMatchObject({ type: TokenType.BITWISE_AND, value: '&' });
        expect(tokens[1]).toMatchObject({ type: TokenType.BITWISE_OR, value: '|' });
        expect(tokens[2]).toMatchObject({ type: TokenType.BITWISE_XOR, value: '^' });
        expect(tokens[3]).toMatchObject({ type: TokenType.BITWISE_NOT, value: '~' });
        expect(tokens[4]).toMatchObject({ type: TokenType.LEFT_SHIFT, value: '<<' });
        expect(tokens[5]).toMatchObject({ type: TokenType.RIGHT_SHIFT, value: '>>' });
      });
    });

    describe('Assignment Operators', () => {
      it('should recognize simple assignment', () => {
        const tokens = tokenize('=');
        expect(tokens[0]).toMatchObject({ type: TokenType.ASSIGN, value: '=' });
      });

      it('should recognize compound assignment operators', () => {
        const tokens = tokenize('+= -= *= /= %=');
        expect(tokens[0]).toMatchObject({ type: TokenType.PLUS_ASSIGN, value: '+=' });
        expect(tokens[1]).toMatchObject({ type: TokenType.MINUS_ASSIGN, value: '-=' });
        expect(tokens[2]).toMatchObject({ type: TokenType.MULTIPLY_ASSIGN, value: '*=' });
        expect(tokens[3]).toMatchObject({ type: TokenType.DIVIDE_ASSIGN, value: '/=' });
        expect(tokens[4]).toMatchObject({ type: TokenType.MODULO_ASSIGN, value: '%=' });
      });

      it('should recognize bitwise assignment operators', () => {
        const tokens = tokenize('&= |= ^= <<= >>=');
        expect(tokens[0]).toMatchObject({ type: TokenType.BITWISE_AND_ASSIGN, value: '&=' });
        expect(tokens[1]).toMatchObject({ type: TokenType.BITWISE_OR_ASSIGN, value: '|=' });
        expect(tokens[2]).toMatchObject({ type: TokenType.BITWISE_XOR_ASSIGN, value: '^=' });
        expect(tokens[3]).toMatchObject({ type: TokenType.LEFT_SHIFT_ASSIGN, value: '<<=' });
        expect(tokens[4]).toMatchObject({ type: TokenType.RIGHT_SHIFT_ASSIGN, value: '>>=' });
      });
    });
  });

  // ============================================================================
  // PUNCTUATION
  // ============================================================================
  describe('Punctuation', () => {
    it('should recognize parentheses', () => {
      const tokens = tokenize('()');
      expect(tokens[0]).toMatchObject({ type: TokenType.LEFT_PAREN, value: '(' });
      expect(tokens[1]).toMatchObject({ type: TokenType.RIGHT_PAREN, value: ')' });
    });

    it('should recognize brackets', () => {
      const tokens = tokenize('[]');
      expect(tokens[0]).toMatchObject({ type: TokenType.LEFT_BRACKET, value: '[' });
      expect(tokens[1]).toMatchObject({ type: TokenType.RIGHT_BRACKET, value: ']' });
    });

    it('should recognize braces', () => {
      const tokens = tokenize('{}');
      expect(tokens[0]).toMatchObject({ type: TokenType.LEFT_BRACE, value: '{' });
      expect(tokens[1]).toMatchObject({ type: TokenType.RIGHT_BRACE, value: '}' });
    });

    it('should recognize other punctuation', () => {
      const tokens = tokenize(', ; : . ?');
      expect(tokens[0]).toMatchObject({ type: TokenType.COMMA, value: ',' });
      expect(tokens[1]).toMatchObject({ type: TokenType.SEMICOLON, value: ';' });
      expect(tokens[2]).toMatchObject({ type: TokenType.COLON, value: ':' });
      expect(tokens[3]).toMatchObject({ type: TokenType.DOT, value: '.' });
      expect(tokens[4]).toMatchObject({ type: TokenType.QUESTION, value: '?' });
    });
  });

  // ============================================================================
  // COMMENTS
  // ============================================================================
  describe('Comments', () => {
    it('should skip line comments by default', () => {
      const tokens = tokenize('let x // comment\nlet y');
      expect(tokens[0]).toMatchObject({ type: TokenType.LET, value: 'let' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'x' });
      expect(tokens[2]).toMatchObject({ type: TokenType.LET, value: 'let' });
      expect(tokens[3]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'y' });
    });

    it('should skip block comments by default', () => {
      const tokens = tokenize('let x /* block comment */ let y');
      expect(tokens[0]).toMatchObject({ type: TokenType.LET, value: 'let' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'x' });
      expect(tokens[2]).toMatchObject({ type: TokenType.LET, value: 'let' });
      expect(tokens[3]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'y' });
    });

    it('should include comments when skipComments is false', () => {
      const tokens = tokenize('let x // comment', { skipComments: false });
      expect(tokens[0]).toMatchObject({ type: TokenType.LET, value: 'let' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'x' });
      expect(tokens[2]).toMatchObject({ type: TokenType.LINE_COMMENT });
    });
  });

  // ============================================================================
  // IDENTIFIERS
  // ============================================================================
  describe('Identifiers', () => {
    it('should recognize identifiers', () => {
      const tokens = tokenize('myVar _private name123 CamelCase');
      expect(tokens[0]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'myVar' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: '_private' });
      expect(tokens[2]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'name123' });
      expect(tokens[3]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'CamelCase' });
    });

    it('should distinguish keywords from similar identifiers', () => {
      const tokens = tokenize('let letVar ifElse');
      expect(tokens[0]).toMatchObject({ type: TokenType.LET, value: 'let' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'letVar' });
      expect(tokens[2]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'ifElse' });
    });
  });

  // ============================================================================
  // ADDRESS-OF OPERATOR
  // ============================================================================
  describe('Address-of Operator (@variable)', () => {
    it('should tokenize @variable as AT + IDENTIFIER', () => {
      const tokens = tokenize('@buffer');
      expect(tokens[0]).toMatchObject({ type: TokenType.AT, value: '@' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'buffer' });
    });

    it('should handle address-of in expressions', () => {
      const tokens = tokenize('@buffer + 1');
      expect(tokens[0]).toMatchObject({ type: TokenType.AT, value: '@' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'buffer' });
      expect(tokens[2]).toMatchObject({ type: TokenType.PLUS, value: '+' });
      expect(tokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '1' });
    });

    it('should handle @address type vs @variable address-of', () => {
      const tokens = tokenize('@address @myVar');
      // @address is a type keyword
      expect(tokens[0]).toMatchObject({ type: TokenType.ADDRESS, value: '@address' });
      // @myVar is address-of operator
      expect(tokens[1]).toMatchObject({ type: TokenType.AT, value: '@' });
      expect(tokens[2]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'myVar' });
    });
  });

  // ============================================================================
  // POSITION TRACKING
  // ============================================================================
  describe('Position Tracking', () => {
    it('should track line and column positions', () => {
      const tokens = tokenize('let x\nlet y');
      expect(tokens[0].start).toMatchObject({ line: 1, column: 1 });
      expect(tokens[1].start).toMatchObject({ line: 1, column: 5 });
      expect(tokens[2].start).toMatchObject({ line: 2, column: 1 });
      expect(tokens[3].start).toMatchObject({ line: 2, column: 5 });
    });
  });

  // ============================================================================
  // EOF
  // ============================================================================
  describe('End of File', () => {
    it('should produce EOF token at end', () => {
      const tokens = tokenize('');
      expect(tokens.length).toBe(1);
      expect(tokens[0].type).toBe(TokenType.EOF);
    });

    it('should produce EOF after tokens', () => {
      const tokens = tokenize('let');
      expect(tokens.length).toBe(2);
      expect(tokens[0].type).toBe(TokenType.LET);
      expect(tokens[1].type).toBe(TokenType.EOF);
    });
  });

  // ============================================================================
  // REAL-WORLD EXAMPLES
  // ============================================================================
  describe('Real-world Examples', () => {
    it('should tokenize variable declaration', () => {
      const tokens = tokenize('let x: byte = 10;');
      expect(tokens[0]).toMatchObject({ type: TokenType.LET, value: 'let' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'x' });
      expect(tokens[2]).toMatchObject({ type: TokenType.COLON, value: ':' });
      expect(tokens[3]).toMatchObject({ type: TokenType.BYTE, value: 'byte' });
      expect(tokens[4]).toMatchObject({ type: TokenType.ASSIGN, value: '=' });
      expect(tokens[5]).toMatchObject({ type: TokenType.NUMBER, value: '10' });
      expect(tokens[6]).toMatchObject({ type: TokenType.SEMICOLON, value: ';' });
    });

    it('should tokenize function declaration', () => {
      const tokens = tokenize('function main(): void {}');
      expect(tokens[0]).toMatchObject({ type: TokenType.FUNCTION, value: 'function' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'main' });
      expect(tokens[2]).toMatchObject({ type: TokenType.LEFT_PAREN, value: '(' });
      expect(tokens[3]).toMatchObject({ type: TokenType.RIGHT_PAREN, value: ')' });
      expect(tokens[4]).toMatchObject({ type: TokenType.COLON, value: ':' });
      expect(tokens[5]).toMatchObject({ type: TokenType.VOID, value: 'void' });
      expect(tokens[6]).toMatchObject({ type: TokenType.LEFT_BRACE, value: '{' });
      expect(tokens[7]).toMatchObject({ type: TokenType.RIGHT_BRACE, value: '}' });
    });

    it('should tokenize storage class with variable', () => {
      const tokens = tokenize('@zp let counter: byte = 0;');
      expect(tokens[0]).toMatchObject({ type: TokenType.ZP, value: '@zp' });
      expect(tokens[1]).toMatchObject({ type: TokenType.LET, value: 'let' });
      expect(tokens[2]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'counter' });
    });

    it('should tokenize v2 peek/poke pattern (replacement for @map)', () => {
      // v2 uses peek/poke intrinsics instead of @map
      const tokens = tokenize('poke($D020, 0);');
      expect(tokens[0]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'poke' });
      expect(tokens[1]).toMatchObject({ type: TokenType.LEFT_PAREN, value: '(' });
      expect(tokens[2]).toMatchObject({ type: TokenType.NUMBER, value: '$D020' });
      expect(tokens[3]).toMatchObject({ type: TokenType.COMMA, value: ',' });
      expect(tokens[4]).toMatchObject({ type: TokenType.NUMBER, value: '0' });
      expect(tokens[5]).toMatchObject({ type: TokenType.RIGHT_PAREN, value: ')' });
      expect(tokens[6]).toMatchObject({ type: TokenType.SEMICOLON, value: ';' });
    });
  });
});