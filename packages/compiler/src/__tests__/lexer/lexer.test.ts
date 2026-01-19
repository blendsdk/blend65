import { describe, expect, it } from 'vitest';
import { tokenize } from '../../lexer/index.js';
import { TokenType } from '../../lexer/types.js';

describe('Blend65Lexer', () => {
  describe('Keywords', () => {
    it('should recognize module system keywords', () => {
      const source = 'module import export from';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.MODULE);
      expect(tokens[1].type).toBe(TokenType.IMPORT);
      expect(tokens[2].type).toBe(TokenType.EXPORT);
      expect(tokens[3].type).toBe(TokenType.FROM);
    });

    it('should recognize function and control flow keywords', () => {
      const source = 'function end if then else while for to next match case';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.FUNCTION);
      expect(tokens[1].type).toBe(TokenType.END);
      expect(tokens[2].type).toBe(TokenType.IF);
      expect(tokens[3].type).toBe(TokenType.THEN);
      expect(tokens[4].type).toBe(TokenType.ELSE);
      expect(tokens[5].type).toBe(TokenType.WHILE);
      expect(tokens[6].type).toBe(TokenType.FOR);
      expect(tokens[7].type).toBe(TokenType.TO);
      expect(tokens[8].type).toBe(TokenType.NEXT);
      expect(tokens[9].type).toBe(TokenType.MATCH);
      expect(tokens[10].type).toBe(TokenType.CASE);
    });

    it('should recognize storage class keywords', () => {
      const source = '@zp @ram @data const';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.ZP);
      expect(tokens[1].type).toBe(TokenType.RAM);
      expect(tokens[2].type).toBe(TokenType.DATA);
      expect(tokens[3].type).toBe(TokenType.CONST);
    });

    it('should recognize primitive type keywords', () => {
      const source = 'byte word void';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.BYTE);
      expect(tokens[1].type).toBe(TokenType.WORD);
      expect(tokens[2].type).toBe(TokenType.VOID);
    });

    it('should recognize logical operators as keywords', () => {
      const source = '&& || !';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.AND);
      expect(tokens[1].type).toBe(TokenType.OR);
      expect(tokens[2].type).toBe(TokenType.NOT);
    });

    // v0.2 Keywords Tests
    it('should recognize v0.2 control flow keywords', () => {
      const source = 'break continue default enum';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.BREAK);
      expect(tokens[0].value).toBe('break');
      expect(tokens[1].type).toBe(TokenType.CONTINUE);
      expect(tokens[1].value).toBe('continue');
      expect(tokens[2].type).toBe(TokenType.DEFAULT);
      expect(tokens[2].value).toBe('default');
      expect(tokens[3].type).toBe(TokenType.ENUM);
      expect(tokens[3].value).toBe('enum');
      expect(tokens[4].type).toBe(TokenType.EOF);
    });

    it('should distinguish v0.2 keywords from identifiers', () => {
      const source = 'break breakable continue continuous default defaultValue enum enumeration';
      const tokens = tokenize(source);

      // Keywords should be recognized as such
      expect(tokens[0].type).toBe(TokenType.BREAK);
      expect(tokens[0].value).toBe('break');
      expect(tokens[2].type).toBe(TokenType.CONTINUE);
      expect(tokens[2].value).toBe('continue');
      expect(tokens[4].type).toBe(TokenType.DEFAULT);
      expect(tokens[4].value).toBe('default');
      expect(tokens[6].type).toBe(TokenType.ENUM);
      expect(tokens[6].value).toBe('enum');

      // Similar words should be identifiers
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('breakable');
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('continuous');
      expect(tokens[5].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[5].value).toBe('defaultValue');
      expect(tokens[7].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[7].value).toBe('enumeration');
    });

    it('should handle v0.2 keywords in string literals', () => {
      const source = '"break continue default enum" \'loop break continue\'';
      const tokens = tokenize(source);

      // Keywords inside strings should remain as string content
      expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[0].value).toBe('break continue default enum');
      expect(tokens[1].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[1].value).toBe('loop break continue');
      expect(tokens[2].type).toBe(TokenType.EOF);
    });

    it('should handle v0.2 keywords with different casing', () => {
      const source =
        'BREAK Break bReAk CONTINUE Continue cOnTiNuE DEFAULT Default dEfAuLt ENUM Enum eNuM';
      const tokens = tokenize(source);

      // All variations should be treated as identifiers (case-sensitive keywords)
      for (let i = 0; i < 12; i++) {
        expect(tokens[i].type).toBe(TokenType.IDENTIFIER);
      }
      expect(tokens[12].type).toBe(TokenType.EOF);
    });
  });

  describe('Numbers', () => {
    it('should parse decimal numbers', () => {
      const source = '123 0 255';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('123');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('0');
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].value).toBe('255');
    });

    it('should parse hex numbers with $ prefix', () => {
      const source = '$D000 $FF $00';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('$D000');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('$FF');
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].value).toBe('$00');
    });

    it('should parse hex numbers with 0x prefix', () => {
      const source = '0xD000 0xFF 0x00';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('0xD000');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('0xFF');
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].value).toBe('0x00');
    });

    it('should parse binary numbers', () => {
      const source = '0b1010 0b0001 0b1111';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('0b1010');
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].value).toBe('0b0001');
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].value).toBe('0b1111');
    });
  });

  describe('Strings', () => {
    it('should parse double-quoted strings', () => {
      const source = '"Hello, World!"';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[0].value).toBe('Hello, World!');
    });

    it('should parse single-quoted strings', () => {
      const source = "'Hello, World!'";
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[0].value).toBe('Hello, World!');
    });

    it('should handle escape sequences', () => {
      const source = '"Hello\\nWorld\\t!"';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
      expect(tokens[0].value).toBe('Hello\nWorld\t!');
    });
  });

  describe('Booleans', () => {
    it('should recognize boolean literals', () => {
      const source = 'true false';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.BOOLEAN_LITERAL);
      expect(tokens[0].value).toBe('true');
      expect(tokens[1].type).toBe(TokenType.BOOLEAN_LITERAL);
      expect(tokens[1].value).toBe('false');
    });
  });

  describe('Operators', () => {
    it('should parse arithmetic operators', () => {
      const source = '+ - * / %';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.PLUS);
      expect(tokens[1].type).toBe(TokenType.MINUS);
      expect(tokens[2].type).toBe(TokenType.MULTIPLY);
      expect(tokens[3].type).toBe(TokenType.DIVIDE);
      expect(tokens[4].type).toBe(TokenType.MODULO);
    });

    it('should parse comparison operators', () => {
      const source = '== != < <= > >=';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.EQUAL);
      expect(tokens[1].type).toBe(TokenType.NOT_EQUAL);
      expect(tokens[2].type).toBe(TokenType.LESS_THAN);
      expect(tokens[3].type).toBe(TokenType.LESS_EQUAL);
      expect(tokens[4].type).toBe(TokenType.GREATER_THAN);
      expect(tokens[5].type).toBe(TokenType.GREATER_EQUAL);
    });

    it('should parse bitwise operators', () => {
      const source = '& | ^ ~ << >>';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.BITWISE_AND);
      expect(tokens[1].type).toBe(TokenType.BITWISE_OR);
      expect(tokens[2].type).toBe(TokenType.BITWISE_XOR);
      expect(tokens[3].type).toBe(TokenType.BITWISE_NOT);
      expect(tokens[4].type).toBe(TokenType.LEFT_SHIFT);
      expect(tokens[5].type).toBe(TokenType.RIGHT_SHIFT);
    });

    it('should parse assignment operators', () => {
      const source = '= += -= *= /= %= &= |= ^= <<= >>=';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.ASSIGN);
      expect(tokens[1].type).toBe(TokenType.PLUS_ASSIGN);
      expect(tokens[2].type).toBe(TokenType.MINUS_ASSIGN);
      expect(tokens[3].type).toBe(TokenType.MULTIPLY_ASSIGN);
      expect(tokens[4].type).toBe(TokenType.DIVIDE_ASSIGN);
      expect(tokens[5].type).toBe(TokenType.MODULO_ASSIGN);
      expect(tokens[6].type).toBe(TokenType.BITWISE_AND_ASSIGN);
      expect(tokens[7].type).toBe(TokenType.BITWISE_OR_ASSIGN);
      expect(tokens[8].type).toBe(TokenType.BITWISE_XOR_ASSIGN);
      expect(tokens[9].type).toBe(TokenType.LEFT_SHIFT_ASSIGN);
      expect(tokens[10].type).toBe(TokenType.RIGHT_SHIFT_ASSIGN);
    });
  });

  describe('Address Type and Address-of Operator (@address and @variable)', () => {
    describe('@address type alias', () => {
      it('should tokenize @address as single ADDRESS token', () => {
        const source = '@address';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.ADDRESS);
        expect(tokens[0].value).toBe('@address');
        expect(tokens[1].type).toBe(TokenType.EOF);
      });

      it('should handle @address in function parameters', () => {
        const source = 'function copy(src: @address, dst: @address): void';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.FUNCTION);
        expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1].value).toBe('copy');
        expect(tokens[2].type).toBe(TokenType.LEFT_PAREN);
        expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[3].value).toBe('src');
        expect(tokens[4].type).toBe(TokenType.COLON);
        expect(tokens[5].type).toBe(TokenType.ADDRESS);
        expect(tokens[5].value).toBe('@address');
        expect(tokens[6].type).toBe(TokenType.COMMA);
        expect(tokens[7].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[7].value).toBe('dst');
        expect(tokens[8].type).toBe(TokenType.COLON);
        expect(tokens[9].type).toBe(TokenType.ADDRESS);
        expect(tokens[9].value).toBe('@address');
        expect(tokens[10].type).toBe(TokenType.RIGHT_PAREN);
        expect(tokens[11].type).toBe(TokenType.COLON);
        expect(tokens[12].type).toBe(TokenType.VOID);
      });

      it('should handle @address in variable declarations', () => {
        const source = 'let addr: @address = 0x1000;';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.LET);
        expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1].value).toBe('addr');
        expect(tokens[2].type).toBe(TokenType.COLON);
        expect(tokens[3].type).toBe(TokenType.ADDRESS);
        expect(tokens[3].value).toBe('@address');
        expect(tokens[4].type).toBe(TokenType.ASSIGN);
        expect(tokens[5].type).toBe(TokenType.NUMBER);
        expect(tokens[5].value).toBe('0x1000');
        expect(tokens[6].type).toBe(TokenType.SEMICOLON);
      });
    });

    describe('Address-of operator (@variable)', () => {
      it('should tokenize @variable as AT + IDENTIFIER tokens', () => {
        const source = '@buffer';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.AT);
        expect(tokens[0].value).toBe('@');
        expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1].value).toBe('buffer');
        expect(tokens[2].type).toBe(TokenType.EOF);
      });

      it('should handle various identifier names', () => {
        const source = '@myVar @sprite_data @buffer123 @_internal';
        const tokens = tokenize(source);

        // @myVar
        expect(tokens[0].type).toBe(TokenType.AT);
        expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1].value).toBe('myVar');

        // @sprite_data
        expect(tokens[2].type).toBe(TokenType.AT);
        expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[3].value).toBe('sprite_data');

        // @buffer123
        expect(tokens[4].type).toBe(TokenType.AT);
        expect(tokens[5].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[5].value).toBe('buffer123');

        // @_internal
        expect(tokens[6].type).toBe(TokenType.AT);
        expect(tokens[7].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[7].value).toBe('_internal');
      });

      it('should handle address-of in arithmetic expressions', () => {
        const source = '@buffer + 1';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.AT);
        expect(tokens[0].value).toBe('@');
        expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1].value).toBe('buffer');
        expect(tokens[2].type).toBe(TokenType.PLUS);
        expect(tokens[3].type).toBe(TokenType.NUMBER);
        expect(tokens[3].value).toBe('1');
      });

      it('should handle parenthesized address-of expressions', () => {
        const source = '(@array) * 2 + 5';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.LEFT_PAREN);
        expect(tokens[1].type).toBe(TokenType.AT);
        expect(tokens[1].value).toBe('@');
        expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[2].value).toBe('array');
        expect(tokens[3].type).toBe(TokenType.RIGHT_PAREN);
        expect(tokens[4].type).toBe(TokenType.MULTIPLY);
        expect(tokens[5].type).toBe(TokenType.NUMBER);
        expect(tokens[5].value).toBe('2');
        expect(tokens[6].type).toBe(TokenType.PLUS);
        expect(tokens[7].type).toBe(TokenType.NUMBER);
        expect(tokens[7].value).toBe('5');
      });
    });

    describe('Mixed usage patterns', () => {
      it('should handle complete address assignment', () => {
        const source = 'let addr: @address = @buffer;';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.LET);
        expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1].value).toBe('addr');
        expect(tokens[2].type).toBe(TokenType.COLON);
        expect(tokens[3].type).toBe(TokenType.ADDRESS);
        expect(tokens[3].value).toBe('@address');
        expect(tokens[4].type).toBe(TokenType.ASSIGN);
        expect(tokens[5].type).toBe(TokenType.AT);
        expect(tokens[5].value).toBe('@');
        expect(tokens[6].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[6].value).toBe('buffer');
        expect(tokens[7].type).toBe(TokenType.SEMICOLON);
      });

      it('should handle function calls with address-of arguments', () => {
        const source = 'copyMemory(@source, @dest, 256);';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[0].value).toBe('copyMemory');
        expect(tokens[1].type).toBe(TokenType.LEFT_PAREN);
        expect(tokens[2].type).toBe(TokenType.AT);
        expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[3].value).toBe('source');
        expect(tokens[4].type).toBe(TokenType.COMMA);
        expect(tokens[5].type).toBe(TokenType.AT);
        expect(tokens[6].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[6].value).toBe('dest');
        expect(tokens[7].type).toBe(TokenType.COMMA);
        expect(tokens[8].type).toBe(TokenType.NUMBER);
        expect(tokens[8].value).toBe('256');
        expect(tokens[9].type).toBe(TokenType.RIGHT_PAREN);
        expect(tokens[10].type).toBe(TokenType.SEMICOLON);
      });

      it('should handle complex arithmetic with address-of', () => {
        const source = 'let addr: @address = @buffer + offset * 2;';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.LET);
        expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1].value).toBe('addr');
        expect(tokens[2].type).toBe(TokenType.COLON);
        expect(tokens[3].type).toBe(TokenType.ADDRESS);
        expect(tokens[4].type).toBe(TokenType.ASSIGN);
        expect(tokens[5].type).toBe(TokenType.AT);
        expect(tokens[6].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[6].value).toBe('buffer');
        expect(tokens[7].type).toBe(TokenType.PLUS);
        expect(tokens[8].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[8].value).toBe('offset');
        expect(tokens[9].type).toBe(TokenType.MULTIPLY);
        expect(tokens[10].type).toBe(TokenType.NUMBER);
        expect(tokens[10].value).toBe('2');
        expect(tokens[11].type).toBe(TokenType.SEMICOLON);
      });

      it('should handle address-of with storage class declarations', () => {
        const source = '@zp let buffer: byte[10]; let addr = @buffer;';
        const tokens = tokenize(source);

        // First part: @zp let buffer: byte[10];
        expect(tokens[0].type).toBe(TokenType.ZP);
        expect(tokens[1].type).toBe(TokenType.LET);
        expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[2].value).toBe('buffer');
        expect(tokens[3].type).toBe(TokenType.COLON);
        expect(tokens[4].type).toBe(TokenType.BYTE);
        expect(tokens[5].type).toBe(TokenType.LEFT_BRACKET);
        expect(tokens[6].type).toBe(TokenType.NUMBER);
        expect(tokens[6].value).toBe('10');
        expect(tokens[7].type).toBe(TokenType.RIGHT_BRACKET);
        expect(tokens[8].type).toBe(TokenType.SEMICOLON);

        // Second part: let addr = @buffer;
        expect(tokens[9].type).toBe(TokenType.LET);
        expect(tokens[10].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[10].value).toBe('addr');
        expect(tokens[11].type).toBe(TokenType.ASSIGN);
        expect(tokens[12].type).toBe(TokenType.AT);
        expect(tokens[13].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[13].value).toBe('buffer');
        expect(tokens[14].type).toBe(TokenType.SEMICOLON);
      });
    });

    describe('Edge cases and boundary conditions', () => {
      it('should handle standalone @ symbol as AT token', () => {
        const source = '@ identifier';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.AT);
        expect(tokens[0].value).toBe('@');
        expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1].value).toBe('identifier');
      });

      it('should handle @ followed by numbers (invalid identifier)', () => {
        const source = '@123';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.AT);
        expect(tokens[0].value).toBe('@');
        expect(tokens[1].type).toBe(TokenType.NUMBER);
        expect(tokens[1].value).toBe('123');
      });

      it('should handle @ followed by keywords', () => {
        const source = '@let @function @if';
        const tokens = tokenize(source);

        // @let
        expect(tokens[0].type).toBe(TokenType.AT);
        expect(tokens[1].type).toBe(TokenType.LET);

        // @function
        expect(tokens[2].type).toBe(TokenType.AT);
        expect(tokens[3].type).toBe(TokenType.FUNCTION);

        // @if
        expect(tokens[4].type).toBe(TokenType.AT);
        expect(tokens[5].type).toBe(TokenType.IF);
      });

      it('should handle @ in strings (should remain as string content)', () => {
        const source = '"@address and @buffer are different"';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
        expect(tokens[0].value).toBe('@address and @buffer are different');
        expect(tokens[1].type).toBe(TokenType.EOF);
      });

      it('should handle multiple @ symbols in sequence', () => {
        const source = '@ @ @buffer';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.AT);
        expect(tokens[1].type).toBe(TokenType.AT);
        expect(tokens[2].type).toBe(TokenType.AT);
        expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[3].value).toBe('buffer');
      });
    });

    describe('Integration with existing storage classes', () => {
      it('should continue to recognize all existing storage classes', () => {
        const source = '@zp @ram @data @map @address';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.ZP);
        expect(tokens[0].value).toBe('@zp');
        expect(tokens[1].type).toBe(TokenType.RAM);
        expect(tokens[1].value).toBe('@ram');
        expect(tokens[2].type).toBe(TokenType.DATA);
        expect(tokens[2].value).toBe('@data');
        expect(tokens[3].type).toBe(TokenType.MAP);
        expect(tokens[3].value).toBe('@map');
        expect(tokens[4].type).toBe(TokenType.ADDRESS);
        expect(tokens[4].value).toBe('@address');
      });

      it('should distinguish @address from similar patterns', () => {
        const source = '@address @addresses @addressing @addr';
        const tokens = tokenize(source);

        // @address (single ADDRESS token)
        expect(tokens[0].type).toBe(TokenType.ADDRESS);
        expect(tokens[0].value).toBe('@address');

        // @addresses (AT + IDENTIFIER)
        expect(tokens[1].type).toBe(TokenType.AT);
        expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[2].value).toBe('addresses');

        // @addressing (AT + IDENTIFIER)
        expect(tokens[3].type).toBe(TokenType.AT);
        expect(tokens[4].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[4].value).toBe('addressing');

        // @addr (AT + IDENTIFIER)
        expect(tokens[5].type).toBe(TokenType.AT);
        expect(tokens[6].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[6].value).toBe('addr');
      });
    });

    describe('Real-world usage examples', () => {
      it('should tokenize memory utility function declaration', () => {
        const source = 'function copyMemory(src: @address, dst: @address, len: byte): void';
        const tokens = tokenize(source);

        expect(tokens[0].type).toBe(TokenType.FUNCTION);
        expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1].value).toBe('copyMemory');
        expect(tokens[5].type).toBe(TokenType.ADDRESS);
        expect(tokens[9].type).toBe(TokenType.ADDRESS);
        expect(tokens[11].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[11].value).toBe('len');
        expect(tokens[12].type).toBe(TokenType.COLON);
        expect(tokens[13].type).toBe(TokenType.BYTE);
      });

      it('should tokenize sprite data address example', () => {
        const source = '@data const spriteData: byte[63] = [...]; let addr = @spriteData + 21;';
        const tokens = tokenize(source);

        // @data const spriteData: byte[63] = [...];
        expect(tokens[0].type).toBe(TokenType.DATA);
        expect(tokens[1].type).toBe(TokenType.CONST);
        expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[2].value).toBe('spriteData');

        // Find the address-of operation: @spriteData + 21
        const atIndex = tokens.findIndex(
          (token, i) =>
            token.type === TokenType.AT &&
            i + 1 < tokens.length &&
            tokens[i + 1].value === 'spriteData'
        );

        expect(atIndex).toBeGreaterThan(-1);
        expect(tokens[atIndex].type).toBe(TokenType.AT);
        expect(tokens[atIndex + 1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[atIndex + 1].value).toBe('spriteData');
        expect(tokens[atIndex + 2].type).toBe(TokenType.PLUS);
        expect(tokens[atIndex + 3].type).toBe(TokenType.NUMBER);
        expect(tokens[atIndex + 3].value).toBe('21');
      });
    });
  });

  describe('Special tokens', () => {
    it('should parse punctuation', () => {
      const source = '( ) [ ] { } , ; : .';
      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.LEFT_PAREN);
      expect(tokens[1].type).toBe(TokenType.RIGHT_PAREN);
      expect(tokens[2].type).toBe(TokenType.LEFT_BRACKET);
      expect(tokens[3].type).toBe(TokenType.RIGHT_BRACKET);
      expect(tokens[4].type).toBe(TokenType.LEFT_BRACE);
      expect(tokens[5].type).toBe(TokenType.RIGHT_BRACE);
      expect(tokens[6].type).toBe(TokenType.COMMA);
      expect(tokens[7].type).toBe(TokenType.SEMICOLON);
      expect(tokens[8].type).toBe(TokenType.COLON);
      expect(tokens[9].type).toBe(TokenType.DOT);
    });
  });

  describe('Comments', () => {
    it('should skip line comments by default', () => {
      const source = 'let x // This is a comment\nlet y';
      const tokens = tokenize(source);

      // Should only have let, x, let, y, EOF (newlines are now skipped)
      expect(tokens.length).toBe(5);
      expect(tokens[0].type).toBe(TokenType.LET);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.LET);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[4].type).toBe(TokenType.EOF);
    });

    it('should skip block comments by default', () => {
      const source = 'let x /* This is a block comment */ let y';
      const tokens = tokenize(source);

      // Should only have let, x, let, y, EOF
      expect(tokens.length).toBe(5);
      expect(tokens[0].type).toBe(TokenType.LET);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.LET);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[4].type).toBe(TokenType.EOF);
    });
  });

  describe('Sample Blend65 code', () => {
    it('should tokenize a simple Blend65 module declaration', () => {
      const source = `module Game.Main
import setSpritePosition from target.sprites
export function main(): void
end function`;

      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.MODULE);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('Game');
      expect(tokens[2].type).toBe(TokenType.DOT);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('Main');
      // Newlines are now skipped as trivial whitespace

      expect(tokens[4].type).toBe(TokenType.IMPORT);
      expect(tokens[5].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[5].value).toBe('setSpritePosition');
      expect(tokens[6].type).toBe(TokenType.FROM);
      expect(tokens[7].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[7].value).toBe('target');
      expect(tokens[8].type).toBe(TokenType.DOT);
      expect(tokens[9].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[9].value).toBe('sprites');
    });

    it('should tokenize storage declarations', () => {
      const source = `@zp let counter: byte
@ram let buffer: byte[256]
@data const initialized: word = 1000`;

      const tokens = tokenize(source);

      // First line: @zp let counter: byte (newlines are now skipped)
      expect(tokens[0].type).toBe(TokenType.ZP);
      expect(tokens[1].type).toBe(TokenType.LET);
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('counter');
      expect(tokens[3].type).toBe(TokenType.COLON);
      expect(tokens[4].type).toBe(TokenType.BYTE);

      // Second line: @ram let buffer: byte[256]
      expect(tokens[5].type).toBe(TokenType.RAM);
      expect(tokens[6].type).toBe(TokenType.LET);
      expect(tokens[7].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[7].value).toBe('buffer');
      expect(tokens[8].type).toBe(TokenType.COLON);
      expect(tokens[9].type).toBe(TokenType.BYTE);
      expect(tokens[10].type).toBe(TokenType.LEFT_BRACKET);
      expect(tokens[11].type).toBe(TokenType.NUMBER);
      expect(tokens[11].value).toBe('256');
      expect(tokens[12].type).toBe(TokenType.RIGHT_BRACKET);

      // Third line: @data const initialized: word = 1000
      expect(tokens[13].type).toBe(TokenType.DATA);
      expect(tokens[14].type).toBe(TokenType.CONST);
      expect(tokens[15].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[15].value).toBe('initialized');
      expect(tokens[16].type).toBe(TokenType.COLON);
      expect(tokens[17].type).toBe(TokenType.WORD);
      expect(tokens[18].type).toBe(TokenType.ASSIGN);
      expect(tokens[19].type).toBe(TokenType.NUMBER);
      expect(tokens[19].value).toBe('1000');
      expect(tokens[20].type).toBe(TokenType.EOF);
    });

    // v0.2 Sample Code Tests
    it('should tokenize v0.2 break and continue statements', () => {
      const source = `for i = 0 to 10
  if i == 5 then
    break
  end if
  if i == 3 then
    continue
  end if
next i`;

      const tokens = tokenize(source);

      // Find break and continue tokens
      const breakTokenIndex = tokens.findIndex(t => t.type === TokenType.BREAK);
      const continueTokenIndex = tokens.findIndex(t => t.type === TokenType.CONTINUE);

      expect(breakTokenIndex).toBeGreaterThan(-1);
      expect(tokens[breakTokenIndex].type).toBe(TokenType.BREAK);
      expect(tokens[breakTokenIndex].value).toBe('break');

      expect(continueTokenIndex).toBeGreaterThan(-1);
      expect(tokens[continueTokenIndex].type).toBe(TokenType.CONTINUE);
      expect(tokens[continueTokenIndex].value).toBe('continue');
    });

    it('should tokenize v0.2 enum declarations', () => {
      const source = `enum Direction
  UP = 0,
  DOWN = 1,
  LEFT,
  RIGHT
end enum`;

      const tokens = tokenize(source);

      // Find enum-related tokens
      expect(tokens[0].type).toBe(TokenType.ENUM);
      expect(tokens[0].value).toBe('enum');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('Direction');

      // Find identifiers for enum members
      const upIndex = tokens.findIndex(t => t.value === 'UP');
      const downIndex = tokens.findIndex(t => t.value === 'DOWN');
      const leftIndex = tokens.findIndex(t => t.value === 'LEFT');
      const rightIndex = tokens.findIndex(t => t.value === 'RIGHT');

      expect(upIndex).toBeGreaterThan(-1);
      expect(tokens[upIndex].type).toBe(TokenType.IDENTIFIER);
      expect(downIndex).toBeGreaterThan(-1);
      expect(tokens[downIndex].type).toBe(TokenType.IDENTIFIER);
      expect(leftIndex).toBeGreaterThan(-1);
      expect(tokens[leftIndex].type).toBe(TokenType.IDENTIFIER);
      expect(rightIndex).toBeGreaterThan(-1);
      expect(tokens[rightIndex].type).toBe(TokenType.IDENTIFIER);
    });

    it('should tokenize v0.2 match statements with default case', () => {
      const source = `match gameState
  case MENU:
    showMenu()
  case PLAYING:
    updateGame()
  default:
    handleError()
end match`;

      const tokens = tokenize(source);

      // Find match-related tokens
      expect(tokens[0].type).toBe(TokenType.MATCH);
      expect(tokens[0].value).toBe('match');

      const caseIndices = tokens
        .map((token, index) => (token.type === TokenType.CASE ? index : -1))
        .filter(index => index !== -1);

      expect(caseIndices.length).toBe(2); // Two case statements

      const defaultIndex = tokens.findIndex(t => t.type === TokenType.DEFAULT);
      expect(defaultIndex).toBeGreaterThan(-1);
      expect(tokens[defaultIndex].type).toBe(TokenType.DEFAULT);
      expect(tokens[defaultIndex].value).toBe('default');
    });

    it('should tokenize complete v0.2 game state management example', () => {
      const source = `enum GameState
  MENU, PLAYING, PAUSED, GAME_OVER
end enum

function gameLoop(): void
  while true
    match currentState
      case GameState.MENU:
        handleMenu()
      case GameState.PLAYING:
        for i = 0 to enemyCount - 1
          if enemies[i].health <= 0 then
            continue
          end if
          updateEnemy(i)
          if playerHealth <= 0 then
            currentState = GameState.GAME_OVER
            break
          end if
        next i
      default:
        currentState = GameState.MENU
    end match
  end while
end function`;

      const tokens = tokenize(source);

      // Verify all v0.2 tokens are present
      const hasEnum = tokens.some(t => t.type === TokenType.ENUM);
      const hasMatch = tokens.some(t => t.type === TokenType.MATCH);
      const hasCase = tokens.some(t => t.type === TokenType.CASE);
      const hasDefault = tokens.some(t => t.type === TokenType.DEFAULT);
      const hasContinue = tokens.some(t => t.type === TokenType.CONTINUE);
      const hasBreak = tokens.some(t => t.type === TokenType.BREAK);

      expect(hasEnum).toBe(true);
      expect(hasMatch).toBe(true);
      expect(hasCase).toBe(true);
      expect(hasDefault).toBe(true);
      expect(hasContinue).toBe(true);
      expect(hasBreak).toBe(true);

      // Ensure proper EOF termination
      expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
    });
  });
});
