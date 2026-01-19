/**
 * Lexer tests for @map memory-mapped variable declarations
 *
 * Tests tokenization of all four @map forms:
 * 1. Simple: @map x at $D020: byte;
 * 2. Range: @map x from $D000 to $D02E: byte;
 * 3. Sequential struct: @map x at $D000 type ... end @map
 * 4. Explicit struct: @map x at $D000 layout ... end @map
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer';
import { TokenType } from '../../lexer/types';

describe('Lexer - @map Memory-Mapped Declarations', () => {
  /**
   * Helper function to tokenize source code and return tokens
   * Filters out NEWLINE and EOF tokens for cleaner test assertions
   */
  function tokenize(source: string, skipNewlines = true) {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    if (skipNewlines) {
      return tokens.filter(t => t.type !== TokenType.NEWLINE && t.type !== TokenType.EOF);
    }
    return tokens;
  }

  describe('New Keywords and Storage Class', () => {
    it('should tokenize "at" as AT keyword', () => {
      const tokens = tokenize('at');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[0].value).toBe('at');
    });

    it('should tokenize "layout" as LAYOUT keyword', () => {
      const tokens = tokenize('layout');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.LAYOUT);
      expect(tokens[0].value).toBe('layout');
    });

    it('should tokenize "@map" as MAP storage class', () => {
      const tokens = tokenize('@map');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe(TokenType.MAP);
      expect(tokens[0].value).toBe('@map');
    });

    it('should distinguish "at" keyword from identifier "atom"', () => {
      const tokens = tokenize('at atom');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe(TokenType.AT);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
    });
  });

  describe('Form 1: Simple @map Declaration', () => {
    it('should tokenize simple @map with hex address', () => {
      const source = '@map vicBorderColor at $D020: byte;';
      const tokens = tokenize(source);

      expect(tokens).toHaveLength(7);
      expect(tokens[0]).toMatchObject({ type: TokenType.MAP, value: '@map' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'vicBorderColor' });
      expect(tokens[2]).toMatchObject({ type: TokenType.AT, value: 'at' });
      expect(tokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '$D020' });
      expect(tokens[4]).toMatchObject({ type: TokenType.COLON, value: ':' });
      expect(tokens[5]).toMatchObject({ type: TokenType.BYTE, value: 'byte' });
      expect(tokens[6]).toMatchObject({ type: TokenType.SEMICOLON, value: ';' });
    });

    it('should tokenize simple @map with word type', () => {
      const source = '@map irqVector at $FFFE: word;';
      const tokens = tokenize(source);

      expect(tokens).toHaveLength(7);
      expect(tokens[0].type).toBe(TokenType.MAP);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].type).toBe(TokenType.AT);
      expect(tokens[3].type).toBe(TokenType.NUMBER);
      expect(tokens[4].type).toBe(TokenType.COLON);
      expect(tokens[5].type).toBe(TokenType.WORD);
      expect(tokens[6].type).toBe(TokenType.SEMICOLON);
    });

    it('should tokenize simple @map with decimal address', () => {
      const source = '@map port at 53280: byte;';
      const tokens = tokenize(source);

      expect(tokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '53280' });
    });

    it('should tokenize simple @map with 0x hex prefix', () => {
      const source = '@map color at 0xD020: byte;';
      const tokens = tokenize(source);

      expect(tokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '0xD020' });
    });
  });

  describe('Form 2: Range @map Declaration', () => {
    it('should tokenize range @map declaration', () => {
      const source = '@map spriteRegisters from $D000 to $D02E: byte;';
      const tokens = tokenize(source);

      expect(tokens).toHaveLength(9);
      expect(tokens[0]).toMatchObject({ type: TokenType.MAP, value: '@map' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'spriteRegisters' });
      expect(tokens[2]).toMatchObject({ type: TokenType.FROM, value: 'from' });
      expect(tokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '$D000' });
      expect(tokens[4]).toMatchObject({ type: TokenType.TO, value: 'to' });
      expect(tokens[5]).toMatchObject({ type: TokenType.NUMBER, value: '$D02E' });
      expect(tokens[6]).toMatchObject({ type: TokenType.COLON, value: ':' });
      expect(tokens[7]).toMatchObject({ type: TokenType.BYTE, value: 'byte' });
      expect(tokens[8]).toMatchObject({ type: TokenType.SEMICOLON, value: ';' });
    });

    it('should tokenize range @map with large memory range', () => {
      const source = '@map colorRAM from $D800 to $DBE7: byte;';
      const tokens = tokenize(source);

      expect(tokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '$D800' });
      expect(tokens[5]).toMatchObject({ type: TokenType.NUMBER, value: '$DBE7' });
    });

    it('should tokenize range @map with word type', () => {
      const source = '@map wordArray from $C000 to $C0FF: word;';
      const tokens = tokenize(source);

      expect(tokens[7]).toMatchObject({ type: TokenType.WORD, value: 'word' });
    });
  });

  describe('Form 3: Sequential Struct @map Declaration', () => {
    it('should tokenize sequential struct @map with single field', () => {
      const source = `@map sid at $D400 type
  frequency: byte
end @map`;
      const tokens = tokenize(source);

      expect(tokens[0]).toMatchObject({ type: TokenType.MAP, value: '@map' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'sid' });
      expect(tokens[2]).toMatchObject({ type: TokenType.AT, value: 'at' });
      expect(tokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '$D400' });
      expect(tokens[4]).toMatchObject({ type: TokenType.TYPE, value: 'type' });
      expect(tokens[5]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'frequency' });
      expect(tokens[6]).toMatchObject({ type: TokenType.COLON, value: ':' });
      expect(tokens[7]).toMatchObject({ type: TokenType.BYTE, value: 'byte' });
      expect(tokens[8]).toMatchObject({ type: TokenType.END, value: 'end' });
      expect(tokens[9]).toMatchObject({ type: TokenType.MAP, value: '@map' });
    });

    it('should tokenize sequential struct @map with multiple fields', () => {
      const source = `@map vic at $D000 type
  sprites: byte[16],
  spriteXMSB: byte,
  control1: byte,
  raster: byte
end @map`;
      const tokens = tokenize(source);

      // Verify key tokens (skip newlines for clarity)
      const keyTokens = tokens.filter(
        t => t.type !== TokenType.NEWLINE && t.type !== TokenType.COMMA
      );

      expect(keyTokens[0]).toMatchObject({ type: TokenType.MAP });
      expect(keyTokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'vic' });
      expect(keyTokens[2]).toMatchObject({ type: TokenType.AT });
      expect(keyTokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '$D000' });
      expect(keyTokens[4]).toMatchObject({ type: TokenType.TYPE });

      // Field: sprites: byte[16]
      expect(keyTokens[5]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'sprites' });
      expect(keyTokens[6]).toMatchObject({ type: TokenType.COLON });
      expect(keyTokens[7]).toMatchObject({ type: TokenType.BYTE });
      expect(keyTokens[8]).toMatchObject({ type: TokenType.LEFT_BRACKET });
      expect(keyTokens[9]).toMatchObject({ type: TokenType.NUMBER, value: '16' });
      expect(keyTokens[10]).toMatchObject({ type: TokenType.RIGHT_BRACKET });

      // Field: spriteXMSB: byte
      expect(keyTokens[11]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'spriteXMSB' });
      expect(keyTokens[12]).toMatchObject({ type: TokenType.COLON });
      expect(keyTokens[13]).toMatchObject({ type: TokenType.BYTE });

      // Closing
      expect(keyTokens[keyTokens.length - 2]).toMatchObject({ type: TokenType.END });
      expect(keyTokens[keyTokens.length - 1]).toMatchObject({ type: TokenType.MAP });
    });

    it('should tokenize sequential struct @map with array fields', () => {
      const source = `@map colors at $D021 type
  background: byte[4],
  sprite: byte[8]
end @map`;
      const tokens = tokenize(source);

      // Find tokens related to field names and array syntax only (exclude the $D021 address)
      const backgroundIndex = tokens.findIndex(t => t.value === 'background');
      const spriteIndex = tokens.findIndex(t => t.value === 'sprite');

      // background: byte[4]
      expect(tokens[backgroundIndex]).toMatchObject({
        type: TokenType.IDENTIFIER,
        value: 'background',
      });
      expect(tokens[backgroundIndex + 1]).toMatchObject({ type: TokenType.COLON });
      expect(tokens[backgroundIndex + 2]).toMatchObject({ type: TokenType.BYTE });
      expect(tokens[backgroundIndex + 3]).toMatchObject({ type: TokenType.LEFT_BRACKET });
      expect(tokens[backgroundIndex + 4]).toMatchObject({ type: TokenType.NUMBER, value: '4' });
      expect(tokens[backgroundIndex + 5]).toMatchObject({ type: TokenType.RIGHT_BRACKET });

      // sprite: byte[8]
      expect(tokens[spriteIndex]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'sprite' });
      expect(tokens[spriteIndex + 1]).toMatchObject({ type: TokenType.COLON });
      expect(tokens[spriteIndex + 2]).toMatchObject({ type: TokenType.BYTE });
      expect(tokens[spriteIndex + 3]).toMatchObject({ type: TokenType.LEFT_BRACKET });
      expect(tokens[spriteIndex + 4]).toMatchObject({ type: TokenType.NUMBER, value: '8' });
      expect(tokens[spriteIndex + 5]).toMatchObject({ type: TokenType.RIGHT_BRACKET });
    });
  });

  describe('Form 4: Explicit Struct @map Declaration', () => {
    it('should tokenize explicit struct @map with single field', () => {
      const source = `@map vic at $D000 layout
  borderColor: at $D020: byte
end @map`;
      const tokens = tokenize(source);

      expect(tokens[0]).toMatchObject({ type: TokenType.MAP });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'vic' });
      expect(tokens[2]).toMatchObject({ type: TokenType.AT });
      expect(tokens[3]).toMatchObject({ type: TokenType.NUMBER, value: '$D000' });
      expect(tokens[4]).toMatchObject({ type: TokenType.LAYOUT, value: 'layout' });

      // Field: borderColor: at $D020: byte
      expect(tokens[5]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'borderColor' });
      expect(tokens[6]).toMatchObject({ type: TokenType.COLON });
      expect(tokens[7]).toMatchObject({ type: TokenType.AT });
      expect(tokens[8]).toMatchObject({ type: TokenType.NUMBER, value: '$D020' });
      expect(tokens[9]).toMatchObject({ type: TokenType.COLON });
      expect(tokens[10]).toMatchObject({ type: TokenType.BYTE });

      expect(tokens[11]).toMatchObject({ type: TokenType.END });
      expect(tokens[12]).toMatchObject({ type: TokenType.MAP });
    });

    it('should tokenize explicit struct @map with range fields', () => {
      const source = `@map vic at $D000 layout
  sprites: from $D000 to $D00F: byte,
  raster: at $D012: byte
end @map`;
      const tokens = tokenize(source);

      const keyTokens = tokens.filter(
        t => t.type !== TokenType.NEWLINE && t.type !== TokenType.COMMA
      );

      // Field: sprites: from $D000 to $D00F: byte
      const spritesIndex = keyTokens.findIndex(t => t.value === 'sprites');
      expect(keyTokens[spritesIndex]).toMatchObject({
        type: TokenType.IDENTIFIER,
        value: 'sprites',
      });
      expect(keyTokens[spritesIndex + 1]).toMatchObject({ type: TokenType.COLON });
      expect(keyTokens[spritesIndex + 2]).toMatchObject({ type: TokenType.FROM });
      expect(keyTokens[spritesIndex + 3]).toMatchObject({ type: TokenType.NUMBER, value: '$D000' });
      expect(keyTokens[spritesIndex + 4]).toMatchObject({ type: TokenType.TO });
      expect(keyTokens[spritesIndex + 5]).toMatchObject({ type: TokenType.NUMBER, value: '$D00F' });
      expect(keyTokens[spritesIndex + 6]).toMatchObject({ type: TokenType.COLON });
      expect(keyTokens[spritesIndex + 7]).toMatchObject({ type: TokenType.BYTE });

      // Field: raster: at $D012: byte
      const rasterIndex = keyTokens.findIndex(t => t.value === 'raster');
      expect(keyTokens[rasterIndex]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'raster' });
      expect(keyTokens[rasterIndex + 1]).toMatchObject({ type: TokenType.COLON });
      expect(keyTokens[rasterIndex + 2]).toMatchObject({ type: TokenType.AT });
      expect(keyTokens[rasterIndex + 3]).toMatchObject({ type: TokenType.NUMBER, value: '$D012' });
      expect(keyTokens[rasterIndex + 4]).toMatchObject({ type: TokenType.COLON });
      expect(keyTokens[rasterIndex + 5]).toMatchObject({ type: TokenType.BYTE });
    });

    it('should tokenize explicit struct @map with mixed fields', () => {
      const source = `@map hardware at $D000 layout
  spriteXY: from $D000 to $D00F: byte,
  spriteXMSB: at $D010: byte,
  control1: at $D011: byte,
  raster: at $D012: byte,
  borderColor: at $D020: byte,
  spriteColors: from $D027 to $D02E: byte
end @map`;
      const tokens = tokenize(source);

      const layoutIndex = tokens.findIndex(t => t.type === TokenType.LAYOUT);
      expect(layoutIndex).toBeGreaterThan(-1);
      expect(tokens[layoutIndex]).toMatchObject({ type: TokenType.LAYOUT, value: 'layout' });

      // Verify we have multiple from...to ranges
      const fromTokens = tokens.filter(t => t.type === TokenType.FROM);
      expect(fromTokens).toHaveLength(2);

      // Verify we have multiple at addresses
      const atTokens = tokens.filter(t => t.type === TokenType.AT);
      expect(atTokens.length).toBeGreaterThan(4); // Initial 'at', plus field 'at's
    });
  });

  describe('Real-World Examples', () => {
    it('should tokenize complete VIC-II register mapping', () => {
      const source = `@map vic at $D000 layout
  sprites: from $D000 to $D00F: byte,
  spriteXMSB: at $D010: byte,
  control1: at $D011: byte,
  raster: at $D012: byte,
  spriteEnable: at $D015: byte,
  control2: at $D016: byte,
  interruptStatus: at $D019: byte,
  interruptEnable: at $D01A: byte,
  borderColor: at $D020: byte,
  backgroundColor0: at $D021: byte,
  backgroundColor1: at $D022: byte,
  backgroundColor2: at $D023: byte,
  backgroundColor3: at $D024: byte,
  spriteColors: from $D027 to $D02E: byte
end @map`;

      const tokens = tokenize(source);

      // Should have MAP, LAYOUT, multiple field declarations, and END MAP
      expect(tokens[0].type).toBe(TokenType.MAP);
      expect(tokens.find(t => t.type === TokenType.LAYOUT)).toBeDefined();
      expect(tokens[tokens.length - 2].type).toBe(TokenType.END);
      expect(tokens[tokens.length - 1].type).toBe(TokenType.MAP);

      // Count identifiers (should have field names)
      const identifiers = tokens.filter(t => t.type === TokenType.IDENTIFIER);
      expect(identifiers.length).toBeGreaterThan(10);
    });

    it('should tokenize SID chip register mapping', () => {
      const source = `@map sid at $D400 type
  voice1: byte[7],
  voice2: byte[7],
  voice3: byte[7],
  filterCutoffLo: byte,
  filterCutoffHi: byte,
  filterResonance: byte,
  filterMode: byte,
  volume: byte
end @map`;

      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.MAP);
      expect(tokens.find(t => t.type === TokenType.TYPE)).toBeDefined();

      // Verify array syntax
      const arrays = tokens.filter(
        (t, i) =>
          t.type === TokenType.LEFT_BRACKET &&
          tokens[i + 1]?.type === TokenType.NUMBER &&
          tokens[i + 2]?.type === TokenType.RIGHT_BRACKET
      );
      expect(arrays).toHaveLength(3); // Three voice arrays
    });

    it('should tokenize color RAM mapping', () => {
      const source = '@map colorRAM from $D800 to $DBE7: byte;';
      const tokens = tokenize(source);

      expect(tokens).toHaveLength(9);
      expect(tokens[0].type).toBe(TokenType.MAP);
      expect(tokens[2].type).toBe(TokenType.FROM);
      expect(tokens[4].type).toBe(TokenType.TO);
      expect(tokens[3].value).toBe('$D800');
      expect(tokens[5].value).toBe('$DBE7');
    });

    it('should tokenize multiple simple @map declarations', () => {
      const source = `@map borderColor at $D020: byte;
@map backgroundColor at $D021: byte;
@map soundVolume at $D418: byte;`;

      const tokens = tokenize(source);

      const mapTokens = tokens.filter(t => t.type === TokenType.MAP);
      expect(mapTokens).toHaveLength(3);

      const semicolons = tokens.filter(t => t.type === TokenType.SEMICOLON);
      expect(semicolons).toHaveLength(3);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should tokenize @map without semicolon for struct forms', () => {
      const source = `@map vic at $D000 type
  field: byte
end @map`;

      const tokens = tokenize(source);
      const semicolons = tokens.filter(t => t.type === TokenType.SEMICOLON);
      expect(semicolons).toHaveLength(0); // No semicolon after end @map
    });

    it('should handle @map with comments', () => {
      const source = `// VIC-II border color register
@map vicBorderColor at $D020: byte; // $D020 = 53280`;

      const tokens = tokenize(source);

      // Comments should be skipped by default
      expect(tokens.find(t => t.type === TokenType.LINE_COMMENT)).toBeUndefined();
      expect(tokens[0].type).toBe(TokenType.MAP);
    });

    it('should tokenize @map with whitespace variations', () => {
      const sources = [
        '@map   x   at   $D020:   byte;',
        '@map\tx\tat\t$D020:\tbyte;',
        '@map x at $D020: byte;',
      ];

      sources.forEach(source => {
        const tokens = tokenize(source);
        expect(tokens).toHaveLength(7);
        expect(tokens[0].type).toBe(TokenType.MAP);
        expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
        expect(tokens[2].type).toBe(TokenType.AT);
      });
    });

    it('should distinguish "at" from "attack" identifier', () => {
      const source = 'at attack atom';
      const tokens = tokenize(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ type: TokenType.AT, value: 'at' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'attack' });
      expect(tokens[2]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'atom' });
    });

    it('should distinguish "layout" from "layouts" identifier', () => {
      const source = 'layout layouts';
      const tokens = tokenize(source);

      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ type: TokenType.LAYOUT, value: 'layout' });
      expect(tokens[1]).toMatchObject({ type: TokenType.IDENTIFIER, value: 'layouts' });
    });
  });
});
