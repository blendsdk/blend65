import { describe, it, expect } from 'vitest';
import { Blend65Parser } from '../blend65/blend65-parser.js';
import { tokenize } from '@blend65/lexer';
import { Program, FunctionDeclaration, VariableDeclaration } from '@blend65/ast';

function parseSource(source: string) {
  const tokens = tokenize(source);
  const parser = new Blend65Parser(tokens);
  return parser.parse();
}

describe('v0.1 Compatibility Tests', () => {
  describe('Wild Boa Snake Compatibility', () => {
    it('should parse Wild Boa Snake style module structure', () => {
      const source = `module Game.Main
import setSpritePosition from c64.sprites
import joystickLeft from c64.input

zp var snakeX: byte = 20
zp var snakeY: byte = 12
ram var snakeBody: byte[200]
const var SCREEN_WIDTH: byte = 40
const var SCREEN_HEIGHT: byte = 25

export function main(): void
  var counter: byte = 0

  while true
    if joystickLeft() then
      snakeX = snakeX - 1
    end if

    for i = 0 to snakeLength - 1
      snakeBody[i] = snakeBody[i] + 1
    next i

    setSpritePosition(0, snakeX, snakeY)
  end while
end function

function updateSnake(): void
  // Game logic
end function`;

      const ast = parseSource(source);

      expect(ast.type).toBe('Program');
      const program = ast as Program;

      // Module structure should be preserved
      expect(program.module.name.parts).toEqual(['Game', 'Main']);
      expect(program.imports.length).toBe(2);
      expect(program.exports.length).toBe(1);
      expect(program.body.length).toBe(6); // 4 vars + 2 functions

      // Storage classes should work
      expect((program.body[0] as VariableDeclaration).storageClass).toBe('zp');
      expect((program.body[1] as VariableDeclaration).storageClass).toBe('zp');
      expect((program.body[2] as VariableDeclaration).storageClass).toBe('ram');
      expect((program.body[3] as VariableDeclaration).storageClass).toBe('const');

      // Function should parse correctly
      const mainFunc = program.exports[0].declaration as FunctionDeclaration;
      expect(mainFunc.name).toBe('main');
      expect(mainFunc.exported).toBe(true);
    });

    it('should maintain v0.1 control flow behavior', () => {
      const source = `module Game.Logic
function gameLogic(): void
  if playerHealth <= 0 then
    gameOver = true
  else
    if enemyCount == 0 then
      nextLevel()
    end if
  end if

  while gameRunning
    updatePlayer()
    updateEnemies()
  end while

  for i = 0 to maxBullets - 1
    if bullets[i].active then
      updateBullet(i)
    end if
  next i
end function`;

      const ast = parseSource(source);

      expect(ast.type).toBe('Program');
      const program = ast as Program;
      const funcDecl = program.body[0] as FunctionDeclaration;

      expect(funcDecl.body?.length).toBe(3); // if, while, for
      expect(funcDecl.body?.[0].type).toBe('IfStatement');
      expect(funcDecl.body?.[1].type).toBe('WhileStatement');
      expect(funcDecl.body?.[2].type).toBe('ForStatement');
    });

    it('should preserve v0.1 expression parsing', () => {
      const source = `module Math.Utils
function calculate(): byte
  var result: byte = (x + y) * 2
  var flags: byte = a and b or c
  var shifted: byte = value << 2
  var indexed: byte = buffer[index + offset]

  return result + flags + shifted + indexed
end function`;

      const ast = parseSource(source);

      expect(ast.type).toBe('Program');
      const program = ast as Program;
      const funcDecl = program.body[0] as FunctionDeclaration;

      expect(funcDecl.body?.length).toBe(5); // 4 vars + 1 return
      expect(funcDecl.body?.[4].type).toBe('ReturnStatement');
    });

    it('should maintain v0.1 array and literal parsing', () => {
      const source = `module Data.Constants
data var palette: byte[16] = [$00, $01, $02, $03, $04, $05, $06, $07, $08, $09, $0A, $0B, $0C, $0D, $0E, $0F]

const var MESSAGE: byte[12] = "HELLO WORLD"
var decimal: byte = 123
var hex: byte = $FF
var binary: byte = 0b1010
var flag: boolean = true`;

      const ast = parseSource(source);

      expect(ast.type).toBe('Program');
      const program = ast as Program;
      expect(program.body.length).toBe(6);

      // Array initialization should work
      const paletteVar = program.body[0] as VariableDeclaration;
      expect(paletteVar.storageClass).toBe('data');
      expect(paletteVar.initializer?.type).toBe('ArrayLiteral');

      // String literal should work
      const messageVar = program.body[1] as VariableDeclaration;
      expect(messageVar.storageClass).toBe('const');
      expect(messageVar.initializer?.type).toBe('Literal');
    });
  });

  describe('v0.1 Performance and Memory Validation', () => {
    it('should handle large v0.1 programs efficiently', () => {
      // Generate a large v0.1 program programmatically
      let source = 'module LargeProgram\n';

      // Add many variables
      for (let i = 0; i < 50; i++) {
        source += `var var${i}: byte = ${i}\n`;
      }

      // Add many functions
      for (let i = 0; i < 25; i++) {
        source += `function func${i}(): void\n`;
        source += `  var local${i}: byte = ${i * 2}\n`;
        source += `  if local${i} > 10 then\n`;
        source += `    local${i} = local${i} - 10\n`;
        source += `  end if\n`;
        source += `end function\n\n`;
      }

      // Should parse without performance issues
      const startTime = Date.now();
      const ast = parseSource(source);
      const parseTime = Date.now() - startTime;

      expect(ast.type).toBe('Program');
      expect(parseTime).toBeLessThan(1000); // Should parse in under 1 second

      const program = ast as Program;
      expect(program.body.length).toBe(75); // 50 vars + 25 functions
    });

    it('should maintain v0.1 error messages and locations', () => {
      const invalidV1Code = `module Test
function test(): void
  zp var invalid: byte = 5  // Should error with clear message
end function`;

      try {
        parseSource(invalidV1Code);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain(
          "Storage class 'zp' not allowed inside functions"
        );
        expect((error as Error).message).toContain('line 3');
      }
    });

    it('should preserve v0.1 module system semantics', () => {
      const source = `module Advanced.Graphics.Sprites
import VIC_SPRITE_ENABLE from c64.registers.vic
import setSpriteImage from c64.graphics.sprites
import setMulticolor from c64.graphics.colors

export function initSprites(): void
  VIC_SPRITE_ENABLE = $FF

  for sprite = 0 to 7
    setSpriteImage(sprite, spriteData[sprite])
    setMulticolor(sprite, colors[sprite])
  next sprite
end function`;

      const ast = parseSource(source);

      expect(ast.type).toBe('Program');
      const program = ast as Program;

      // Complex module names should work
      expect(program.module.name.parts).toEqual(['Advanced', 'Graphics', 'Sprites']);

      // Multiple imports from different modules
      expect(program.imports.length).toBe(3);
      expect(program.imports[0].source.parts).toEqual(['c64', 'registers', 'vic']);
      expect(program.imports[1].source.parts).toEqual(['c64', 'graphics', 'sprites']);
      expect(program.imports[2].source.parts).toEqual(['c64', 'graphics', 'colors']);

      // Export should work
      expect(program.exports.length).toBe(1);
      const exportedFunc = program.exports[0].declaration as FunctionDeclaration;
      expect(exportedFunc.name).toBe('initSprites');
    });
  });

  describe('v0.1 vs v0.2 Coexistence', () => {
    it('should allow v0.1 programs to use v0.2 keywords as identifiers in appropriate contexts', () => {
      const source = `module Test
// v0.2 keywords should work as variable names when not in keyword context
var enumCounter: byte = 0
var breakPoint: word = $1000
var continueFlag: boolean = true
var defaultValue: byte = 42

function processData(): void
  var enumValue: byte = enumCounter + 1
  var breakAddress: word = breakPoint + 10
  var continueState: boolean = continueFlag and true
  var defaultResult: byte = defaultValue * 2
end function`;

      const ast = parseSource(source);

      expect(ast.type).toBe('Program');
      const program = ast as Program;
      expect(program.body.length).toBe(5); // 4 vars + 1 function

      // All variables should parse correctly
      const vars = program.body.slice(0, 4) as VariableDeclaration[];
      expect(vars[0].name).toBe('enumCounter');
      expect(vars[1].name).toBe('breakPoint');
      expect(vars[2].name).toBe('continueFlag');
      expect(vars[3].name).toBe('defaultValue');

      // Function should parse correctly
      const funcDecl = program.body[4] as FunctionDeclaration;
      expect(funcDecl.body?.length).toBe(4);
    });

    it('should maintain exact v0.1 syntax compatibility', () => {
      const source = `module Game.Main
import setSpritePosition from c64.sprites
import utils from core.helpers

zp var globalCounter: byte = 0
ram var globalBuffer: byte[256]
io var VIC_REG: byte

export function main(): void
  var counter: byte = 0
  var buffer: byte[256]

  while counter < 10
    globalBuffer[counter] = counter
    counter = counter + 1
  end while

  if counter == 10 then
    VIC_REG = $FF
  end if
end function

function helper(x: byte, y: byte): byte
  return x + y
end function`;

      // This is the exact same test from v0.1 - should still work
      const ast = parseSource(source);

      expect(ast.type).toBe('Program');
      const program = ast as Program;
      expect(program.module.name.parts).toEqual(['Game', 'Main']);
      expect(program.imports.length).toBe(2);
      expect(program.exports.length).toBe(1);
      expect(program.body.length).toBe(4); // 3 global vars + helper function
    });
  });
});
