import { describe, expect, it } from 'vitest';
import { tokenize } from '../../lexer/index.js';
import { TokenType } from '../../lexer/types.js';

/**
 * Lexer tests for sample Blend65 code - C-style syntax (curly braces)
 *
 * v2: No changes needed - these tests don't involve @map.
 *
 * Note: All code examples use C-style syntax with curly braces,
 * not VB/Pascal-style with end keywords.
 */
describe('Blend65Lexer - Sample Code', () => {
  describe('Module Declarations', () => {
    it('should tokenize a simple Blend65 module declaration', () => {
      // C-style: functions use { } instead of end function
      const source = `module Game.Main
import setSpritePosition from target.sprites
export function main(): void { }`;

      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.MODULE);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('Game');
      expect(tokens[2].type).toBe(TokenType.DOT);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('Main');

      expect(tokens[4].type).toBe(TokenType.IMPORT);
      expect(tokens[5].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[5].value).toBe('setSpritePosition');
      expect(tokens[6].type).toBe(TokenType.FROM);
      expect(tokens[7].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[7].value).toBe('target');
      expect(tokens[8].type).toBe(TokenType.DOT);
      expect(tokens[9].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[9].value).toBe('sprites');

      // Function declaration with curly braces
      expect(tokens[10].type).toBe(TokenType.EXPORT);
      expect(tokens[11].type).toBe(TokenType.FUNCTION);
      expect(tokens[12].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[12].value).toBe('main');
    });
  });

  describe('Storage Declarations', () => {
    it('should tokenize storage declarations', () => {
      const source = `@zp let counter: byte
@ram let buffer: byte[256]
@data const initialized: word = 1000`;

      const tokens = tokenize(source);

      // First line: @zp let counter: byte
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
  });

  describe('v0.2 Break and Continue (C-style)', () => {
    it('should tokenize v0.2 break and continue statements', () => {
      // C-style: for loop uses { } and if uses { }
      const source = `for (i = 0; i < 10; i += 1) {
  if (i == 5) {
    break;
  }
  if (i == 3) {
    continue;
  }
}`;

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
  });

  describe('v0.2 Enum Declarations (C-style)', () => {
    it('should tokenize v0.2 enum declarations', () => {
      // C-style: enum uses { } instead of end enum
      const source = `enum Direction {
  UP = 0,
  DOWN = 1,
  LEFT,
  RIGHT
}`;

      const tokens = tokenize(source);

      // Find enum-related tokens
      expect(tokens[0].type).toBe(TokenType.ENUM);
      expect(tokens[0].value).toBe('enum');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('Direction');
      expect(tokens[2].type).toBe(TokenType.LEFT_BRACE);

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

      // Should end with closing brace
      const lastBraceIndex = tokens.findIndex(
        (t, i) => t.type === TokenType.RIGHT_BRACE && i > 2
      );
      expect(lastBraceIndex).toBeGreaterThan(-1);
    });
  });

  describe('v0.2 Switch Statements (C-style)', () => {
    it('should tokenize v0.2 switch statements with default case', () => {
      // C-style: switch uses { } instead of end switch
      const source = `switch (gameState) {
  case MENU:
    showMenu();
  case PLAYING:
    updateGame();
  default:
    handleError();
}`;

      const tokens = tokenize(source);

      // Find switch-related tokens
      expect(tokens[0].type).toBe(TokenType.SWITCH);
      expect(tokens[0].value).toBe('switch');

      const caseIndices = tokens
        .map((token, index) => (token.type === TokenType.CASE ? index : -1))
        .filter(index => index !== -1);

      expect(caseIndices.length).toBe(2); // Two case statements

      const defaultIndex = tokens.findIndex(t => t.type === TokenType.DEFAULT);
      expect(defaultIndex).toBeGreaterThan(-1);
      expect(tokens[defaultIndex].type).toBe(TokenType.DEFAULT);
      expect(tokens[defaultIndex].value).toBe('default');
    });
  });

  describe('Complete Game State Management (C-style)', () => {
    it('should tokenize complete v0.2 game state management example', () => {
      // C-style: all blocks use { } instead of end keywords
      const source = `enum GameState {
  MENU, PLAYING, PAUSED, GAME_OVER
}

function gameLoop(): void {
  while (true) {
    switch (currentState) {
      case GameState.MENU:
        handleMenu();
      case GameState.PLAYING:
        for (i = 0; i < enemyCount; i += 1) {
          if (enemies[i].health <= 0) {
            continue;
          }
          updateEnemy(i);
          if (playerHealth <= 0) {
            currentState = GameState.GAME_OVER;
            break;
          }
        }
      default:
        currentState = GameState.MENU;
    }
  }
}`;

      const tokens = tokenize(source);

      // Verify all v0.2 tokens are present
      const hasEnum = tokens.some(t => t.type === TokenType.ENUM);
      const hasSwitch = tokens.some(t => t.type === TokenType.SWITCH);
      const hasCase = tokens.some(t => t.type === TokenType.CASE);
      const hasDefault = tokens.some(t => t.type === TokenType.DEFAULT);
      const hasContinue = tokens.some(t => t.type === TokenType.CONTINUE);
      const hasBreak = tokens.some(t => t.type === TokenType.BREAK);

      expect(hasEnum).toBe(true);
      expect(hasSwitch).toBe(true);
      expect(hasCase).toBe(true);
      expect(hasDefault).toBe(true);
      expect(hasContinue).toBe(true);
      expect(hasBreak).toBe(true);

      // Verify C-style braces are present
      const leftBraceCount = tokens.filter(t => t.type === TokenType.LEFT_BRACE).length;
      const rightBraceCount = tokens.filter(t => t.type === TokenType.RIGHT_BRACE).length;
      expect(leftBraceCount).toBeGreaterThan(0);
      expect(leftBraceCount).toBe(rightBraceCount);

      // Ensure proper EOF termination
      expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
    });
  });

  describe('C-style Function Declarations', () => {
    it('should tokenize function with body using curly braces', () => {
      const source = `function add(a: byte, b: byte): byte {
  return a + b;
}`;

      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.FUNCTION);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('add');

      // Find opening and closing braces
      const openBrace = tokens.findIndex(t => t.type === TokenType.LEFT_BRACE);
      const closeBrace = tokens.findIndex(t => t.type === TokenType.RIGHT_BRACE);
      expect(openBrace).toBeGreaterThan(-1);
      expect(closeBrace).toBeGreaterThan(openBrace);
    });

    it('should tokenize function stub with semicolon', () => {
      const source = `function peek(addr: word): byte;`;

      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.FUNCTION);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('peek');

      // Stub ends with semicolon
      const semiIndex = tokens.findIndex(t => t.type === TokenType.SEMICOLON);
      expect(semiIndex).toBeGreaterThan(-1);
    });
  });

  describe('C-style Control Flow', () => {
    it('should tokenize if-else with curly braces', () => {
      const source = `if (x > 0) {
  doSomething();
} else {
  doOther();
}`;

      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.IF);
      expect(tokens[1].type).toBe(TokenType.LEFT_PAREN);

      const elseIndex = tokens.findIndex(t => t.type === TokenType.ELSE);
      expect(elseIndex).toBeGreaterThan(-1);

      // Count braces
      const braces = tokens.filter(
        t => t.type === TokenType.LEFT_BRACE || t.type === TokenType.RIGHT_BRACE
      );
      expect(braces.length).toBe(4); // 2 open, 2 close
    });

    it('should tokenize while loop with curly braces', () => {
      const source = `while (running) {
  tick();
}`;

      const tokens = tokenize(source);

      expect(tokens[0].type).toBe(TokenType.WHILE);
      expect(tokens[1].type).toBe(TokenType.LEFT_PAREN);

      const openBrace = tokens.findIndex(t => t.type === TokenType.LEFT_BRACE);
      const closeBrace = tokens.findIndex(t => t.type === TokenType.RIGHT_BRACE);
      expect(openBrace).toBeGreaterThan(-1);
      expect(closeBrace).toBeGreaterThan(openBrace);
    });
  });
});