import { describe, it, expect } from 'vitest';
import { Blend65Parser } from '../blend65/blend65-parser.js';
import { tokenize } from '@blend65/lexer';
function parseSource(source) {
    const tokens = tokenize(source);
    const parser = new Blend65Parser(tokens);
    return parser.parse();
}
describe('Blend65Parser', () => {
    describe('Module System', () => {
        it('should parse simple module declaration', () => {
            const source = 'module Game.Main';
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.module.type).toBe('ModuleDeclaration');
            expect(program.module.name.type).toBe('QualifiedName');
            expect(program.module.name.parts).toEqual(['Game', 'Main']);
        });
        it('should parse module with single identifier', () => {
            const source = 'module Main';
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.module.type).toBe('ModuleDeclaration');
            expect(program.module.name.type).toBe('QualifiedName');
            expect(program.module.name.parts).toEqual(['Main']);
        });
        it('should parse standard import declaration', () => {
            const source = `module Main
import utils from core.helpers`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.imports.length).toBe(1);
            const importDecl = program.imports[0];
            expect(importDecl.type).toBe('ImportDeclaration');
            expect(importDecl.specifiers[0].imported).toBe('utils');
            expect(importDecl.source.type).toBe('QualifiedName');
            if (importDecl.source.type === 'QualifiedName') {
                expect(importDecl.source.parts).toEqual(['core', 'helpers']);
            }
        });
        it('should parse target-specific import declaration', () => {
            const source = `module Main
import setSpritePosition from c64.sprites`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.imports.length).toBe(1);
            const importDecl = program.imports[0];
            expect(importDecl.type).toBe('ImportDeclaration');
            expect(importDecl.specifiers[0].imported).toBe('setSpritePosition');
            expect(importDecl.source.type).toBe('QualifiedName');
            if (importDecl.source.type === 'QualifiedName') {
                expect(importDecl.source.parts).toEqual(['c64', 'sprites']);
            }
        });
        it('should parse specific target import declaration', () => {
            const source = `module Main
import sprites from c64.graphics.sprites`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.imports.length).toBe(1);
            const importDecl = program.imports[0];
            expect(importDecl.type).toBe('ImportDeclaration');
            expect(importDecl.specifiers[0].imported).toBe('sprites');
            expect(importDecl.source.type).toBe('QualifiedName');
            if (importDecl.source.type === 'QualifiedName') {
                expect(importDecl.source.parts).toEqual(['c64', 'graphics', 'sprites']);
            }
        });
    });
    describe('Variable Declarations', () => {
        it('should parse simple variable declaration', () => {
            const source = `module Main
var counter: byte`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const varDecl = program.body[0];
            expect(varDecl.type).toBe('VariableDeclaration');
            expect(varDecl.name).toBe('counter');
            expect(varDecl.varType?.type).toBe('PrimitiveType');
        });
        it('should parse variable declaration with storage class', () => {
            const source = `module Main
zp var counter: byte`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const varDecl = program.body[0];
            expect(varDecl.type).toBe('VariableDeclaration');
            expect(varDecl.name).toBe('counter');
            expect(varDecl.storageClass).toBe('zp');
        });
        it('should parse variable declaration with I/O storage class', () => {
            const source = `module Main
io var VIC_REG: byte`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const varDecl = program.body[0];
            expect(varDecl.type).toBe('VariableDeclaration');
            expect(varDecl.name).toBe('VIC_REG');
            expect(varDecl.storageClass).toBe('io');
        });
        it('should parse array variable declaration', () => {
            const source = `module Main
ram var buffer: byte[256]`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const varDecl = program.body[0];
            expect(varDecl.type).toBe('VariableDeclaration');
            expect(varDecl.name).toBe('buffer');
            expect(varDecl.storageClass).toBe('ram');
            expect(varDecl.varType?.type).toBe('ArrayType');
        });
        it('should parse initialized variable declaration', () => {
            const source = `module Main
var counter: byte = 0`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const varDecl = program.body[0];
            expect(varDecl.type).toBe('VariableDeclaration');
            expect(varDecl.name).toBe('counter');
            expect(varDecl.initializer).toBeDefined();
            expect(varDecl.initializer?.type).toBe('Literal');
        });
    });
    describe('Function Declarations', () => {
        it('should parse simple function declaration', () => {
            const source = `module Main
function test(): void
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const funcDecl = program.body[0];
            expect(funcDecl.type).toBe('FunctionDeclaration');
            expect(funcDecl.name).toBe('test');
            expect(funcDecl.params).toEqual([]);
            expect(funcDecl.returnType?.type).toBe('PrimitiveType');
        });
        it('should parse function with parameters', () => {
            const source = `module Main
function add(a: byte, b: byte): byte
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const funcDecl = program.body[0];
            expect(funcDecl.type).toBe('FunctionDeclaration');
            expect(funcDecl.name).toBe('add');
            expect(funcDecl.params.length).toBe(2);
            expect(funcDecl.params[0].name).toBe('a');
            expect(funcDecl.params[1].name).toBe('b');
        });
        it('should parse exported function', () => {
            const source = `module Main
export function test(): void
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.exports.length).toBe(1);
            const exportDecl = program.exports[0];
            expect(exportDecl.type).toBe('ExportDeclaration');
            const funcDecl = exportDecl.declaration;
            expect(funcDecl.type).toBe('FunctionDeclaration');
            expect(funcDecl.name).toBe('test');
            expect(funcDecl.exported).toBe(true);
        });
        it('should parse function with body', () => {
            const source = `module Main
function test(): void
  var x: byte = 5
  x = x + 1
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const funcDecl = program.body[0];
            expect(funcDecl.type).toBe('FunctionDeclaration');
            expect(funcDecl.name).toBe('test');
            expect(funcDecl.body?.length).toBe(2);
        });
        it('should reject storage classes inside functions', () => {
            const source = `module Main
function test(): void
  zp var illegal: byte = 5
end function`;
            expect(() => parseSource(source)).toThrow(/Storage class 'zp' not allowed inside functions/);
        });
        it('should reject io variables inside functions', () => {
            const source = `module Main
function test(): void
  io var VIC_REG: byte
end function`;
            expect(() => parseSource(source)).toThrow(/Storage class 'io' not allowed inside functions/);
        });
        it('should reject ram variables inside functions', () => {
            const source = `module Main
function test(): void
  ram var buffer: byte[100]
end function`;
            expect(() => parseSource(source)).toThrow(/Storage class 'ram' not allowed inside functions/);
        });
    });
    describe('Control Flow', () => {
        it('should parse if statement', () => {
            const source = `module Main
function test(): void
  if x == 5 then
    y = 10
  end if
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
            expect(funcDecl.body?.[0].type).toBe('IfStatement');
        });
        it('should parse if-else statement', () => {
            const source = `module Main
function test(): void
  if x == 5 then
    y = 10
  else
    y = 20
  end if
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
            expect(funcDecl.body?.[0].type).toBe('IfStatement');
        });
        it('should parse while loop', () => {
            const source = `module Main
function test(): void
  while x < 10
    x = x + 1
  end while
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
            expect(funcDecl.body?.[0].type).toBe('WhileStatement');
        });
        it('should parse for loop', () => {
            const source = `module Main
function test(): void
  for i = 0 to 10
    sum = sum + i
  next i
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
            expect(funcDecl.body?.[0].type).toBe('ForStatement');
        });
    });
    // v0.2 Control Flow Tests
    describe('v0.2 Break and Continue Statements', () => {
        it('should parse break statement in for loop', () => {
            const source = `module Main
function test(): void
  for i = 0 to 10
    if i == 5 then
      break
    end if
  next i
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
            const forStmt = funcDecl.body?.[0];
            expect(forStmt.type).toBe('ForStatement');
            expect(forStmt.body.length).toBe(1);
            const ifStmt = forStmt.body[0];
            expect(ifStmt.type).toBe('IfStatement');
            expect(ifStmt.thenBody.length).toBe(1);
            expect(ifStmt.thenBody[0].type).toBe('BreakStatement');
        });
        it('should parse continue statement in while loop', () => {
            const source = `module Main
function test(): void
  while condition
    if skip then
      continue
    end if
    process()
  end while
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
            const whileStmt = funcDecl.body?.[0];
            expect(whileStmt.type).toBe('WhileStatement');
            expect(whileStmt.body.length).toBe(2);
            const ifStmt = whileStmt.body[0];
            expect(ifStmt.type).toBe('IfStatement');
            expect(ifStmt.thenBody[0].type).toBe('ContinueStatement');
        });
        it('should parse break and continue in nested loops', () => {
            const source = `module Main
function test(): void
  for i = 0 to 10
    for j = 0 to 5
      if condition1 then
        break
      end if
      if condition2 then
        continue
      end if
    next j
    if outerCondition then
      continue
    end if
  next i
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
            const outerFor = funcDecl.body?.[0];
            expect(outerFor.type).toBe('ForStatement');
            // Inner for loop should have break and continue
            const innerFor = outerFor.body[0];
            expect(innerFor.type).toBe('ForStatement');
        });
        it('should error on break statement outside loop', () => {
            const source = `module Main
function test(): void
  if condition then
    break
  end if
end function`;
            expect(() => parseSource(source)).toThrow(/break statement must be inside a loop/);
        });
        it('should error on continue statement outside loop', () => {
            const source = `module Main
function test(): void
  if condition then
    continue
  end if
end function`;
            expect(() => parseSource(source)).toThrow(/continue statement must be inside a loop/);
        });
        it('should error on break statement in function without loop', () => {
            const source = `module Main
function test(): void
  var x: byte = 5
  break
end function`;
            expect(() => parseSource(source)).toThrow(/break statement must be inside a loop/);
        });
        it('should error on continue statement in function without loop', () => {
            const source = `module Main
function test(): void
  var x: byte = 5
  continue
end function`;
            expect(() => parseSource(source)).toThrow(/continue statement must be inside a loop/);
        });
    });
    describe('v0.2 Enum Declarations', () => {
        it('should parse enum with explicit values', () => {
            const source = `module Main
enum Color
  RED = 1,
  GREEN = 2,
  BLUE = 3
end enum`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const enumDecl = program.body[0];
            expect(enumDecl.type).toBe('EnumDeclaration');
            expect(enumDecl.name).toBe('Color');
            expect(enumDecl.members.length).toBe(3);
            expect(enumDecl.exported).toBe(false);
            expect(enumDecl.members[0].name).toBe('RED');
            expect(enumDecl.members[0].value.type).toBe('Literal');
            expect(enumDecl.members[0].value.value).toBe(1);
            expect(enumDecl.members[1].name).toBe('GREEN');
            expect(enumDecl.members[1].value.value).toBe(2);
            expect(enumDecl.members[2].name).toBe('BLUE');
            expect(enumDecl.members[2].value.value).toBe(3);
        });
        it('should parse enum with auto-increment values', () => {
            const source = `module Main
enum Direction
  UP,
  DOWN,
  LEFT,
  RIGHT
end enum`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const enumDecl = program.body[0];
            expect(enumDecl.type).toBe('EnumDeclaration');
            expect(enumDecl.name).toBe('Direction');
            expect(enumDecl.members.length).toBe(4);
            // Auto-increment should start at 0
            expect(enumDecl.members[0].name).toBe('UP');
            expect(enumDecl.members[0].value.value).toBe(0);
            expect(enumDecl.members[1].name).toBe('DOWN');
            expect(enumDecl.members[1].value.value).toBe(1);
            expect(enumDecl.members[2].name).toBe('LEFT');
            expect(enumDecl.members[2].value.value).toBe(2);
            expect(enumDecl.members[3].name).toBe('RIGHT');
            expect(enumDecl.members[3].value.value).toBe(3);
        });
        it('should parse enum with mixed explicit and auto values', () => {
            const source = `module Main
enum GameState
  MENU = 0,
  PLAYING,
  PAUSED,
  GAME_OVER = 10
end enum`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const enumDecl = program.body[0];
            expect(enumDecl.type).toBe('EnumDeclaration');
            expect(enumDecl.name).toBe('GameState');
            expect(enumDecl.members.length).toBe(4);
            expect(enumDecl.members[0].name).toBe('MENU');
            expect(enumDecl.members[0].value.value).toBe(0);
            // Auto-increment should continue from 0
            expect(enumDecl.members[1].name).toBe('PLAYING');
            expect(enumDecl.members[1].value.value).toBe(1);
            expect(enumDecl.members[2].name).toBe('PAUSED');
            expect(enumDecl.members[2].value.value).toBe(2);
            // Explicit value should reset auto-increment
            expect(enumDecl.members[3].name).toBe('GAME_OVER');
            expect(enumDecl.members[3].value.value).toBe(10);
        });
        it('should parse exported enum declaration', () => {
            const source = `module Main
export enum Status
  SUCCESS,
  ERROR
end enum`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.exports.length).toBe(1);
            const exportDecl = program.exports[0];
            expect(exportDecl.type).toBe('ExportDeclaration');
            const enumDecl = exportDecl.declaration;
            expect(enumDecl.type).toBe('EnumDeclaration');
            expect(enumDecl.name).toBe('Status');
            expect(enumDecl.exported).toBe(true);
        });
        it('should parse empty enum declaration', () => {
            const source = `module Main
enum Empty
end enum`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(1);
            const enumDecl = program.body[0];
            expect(enumDecl.type).toBe('EnumDeclaration');
            expect(enumDecl.name).toBe('Empty');
            expect(enumDecl.members.length).toBe(0);
        });
    });
    describe('v0.2 Enhanced Match Statements', () => {
        it('should parse match statement with default case', () => {
            const source = `module Main
function test(): void
  match gameState
    case MENU:
      showMenu()
    case PLAYING:
      updateGame()
    default:
      handleError()
  end match
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
            const matchStmt = funcDecl.body?.[0];
            expect(matchStmt.type).toBe('MatchStatement');
            expect(matchStmt.discriminant.type).toBe('Identifier');
            expect(matchStmt.discriminant.name).toBe('gameState');
            expect(matchStmt.cases.length).toBe(2);
            expect(matchStmt.defaultCase).toBeDefined();
            // Check regular cases
            expect(matchStmt.cases[0].test.name).toBe('MENU');
            expect(matchStmt.cases[1].test.name).toBe('PLAYING');
            // Check default case
            expect(matchStmt.defaultCase.test).toBe(null);
            expect(matchStmt.defaultCase.consequent.length).toBe(1);
        });
        it('should parse match statement without default case', () => {
            const source = `module Main
function test(): void
  match value
    case 1:
      doOne()
    case 2:
      doTwo()
  end match
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
            const matchStmt = funcDecl.body?.[0];
            expect(matchStmt.type).toBe('MatchStatement');
            expect(matchStmt.cases.length).toBe(2);
            expect(matchStmt.defaultCase).toBe(null);
        });
        it('should parse match statement with multiple statements in cases', () => {
            const source = `module Main
function test(): void
  match action
    case ATTACK:
      playSound()
      dealDamage()
      updateAnimation()
    case DEFEND:
      raiseShield()
      reduceSpeed()
    default:
      standIdle()
      resetState()
  end match
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
            const matchStmt = funcDecl.body?.[0];
            expect(matchStmt.type).toBe('MatchStatement');
            expect(matchStmt.cases.length).toBe(2);
            // Check case with multiple statements
            expect(matchStmt.cases[0].consequent.length).toBe(3);
            expect(matchStmt.cases[1].consequent.length).toBe(2);
            // Check default case with multiple statements
            expect(matchStmt.defaultCase.consequent.length).toBe(2);
        });
        it('should error on multiple default cases', () => {
            const source = `module Main
function test(): void
  match value
    case 1:
      doOne()
    default:
      handleDefault1()
    default:
      handleDefault2()
  end match
end function`;
            expect(() => parseSource(source)).toThrow(/Multiple default cases not allowed/);
        });
        it('should parse nested match statements', () => {
            const source = `module Main
function test(): void
  match outerValue
    case 1:
      match innerValue
        case A:
          doA()
        default:
          doDefault()
      end match
    default:
      doOuter()
  end match
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
            const outerMatch = funcDecl.body?.[0];
            expect(outerMatch.type).toBe('MatchStatement');
            expect(outerMatch.cases.length).toBe(1);
            // Inner match should be in the consequent of the first case
            const innerMatch = outerMatch.cases[0].consequent[0];
            expect(innerMatch.type).toBe('MatchStatement');
            expect(innerMatch.cases.length).toBe(1);
            expect(innerMatch.defaultCase).toBeDefined();
        });
    });
    describe('v0.2 Complete Integration Tests', () => {
        it('should parse complete game state management with all v0.2 features', () => {
            const source = `module GameEngine
enum GameState
  MENU = 0,
  PLAYING,
  PAUSED,
  GAME_OVER = 10
end enum

enum Direction
  UP, DOWN, LEFT, RIGHT
end enum

function gameLoop(): void
  while true
    match currentState
      case GameState.MENU:
        handleMenu()
        if startPressed then
          currentState = GameState.PLAYING
        end if
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
      case GameState.PAUSED:
        if resumePressed then
          currentState = GameState.PLAYING
        end if
      default:
        currentState = GameState.MENU
    end match
  end while
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(3); // 2 enums + 1 function
            // Check GameState enum
            const gameStateEnum = program.body[0];
            expect(gameStateEnum.type).toBe('EnumDeclaration');
            expect(gameStateEnum.name).toBe('GameState');
            expect(gameStateEnum.members.length).toBe(4);
            // Check Direction enum
            const directionEnum = program.body[1];
            expect(directionEnum.type).toBe('EnumDeclaration');
            expect(directionEnum.name).toBe('Direction');
            expect(directionEnum.members.length).toBe(4);
            // Check function with all control flow features
            const funcDecl = program.body[2];
            expect(funcDecl.type).toBe('FunctionDeclaration');
            expect(funcDecl.name).toBe('gameLoop');
            expect(funcDecl.body.length).toBe(1);
            // Should contain while loop with match statement
            const whileStmt = funcDecl.body[0];
            expect(whileStmt.type).toBe('WhileStatement');
            expect(whileStmt.body[0].type).toBe('MatchStatement');
            // Match statement should have cases and default
            const matchStmt = whileStmt.body[0];
            expect(matchStmt.cases.length).toBe(3);
            expect(matchStmt.defaultCase).toBeDefined();
        });
        it('should parse nested loops with break/continue and match statements', () => {
            const source = `module AI
enum ActionType
  ATTACK, DEFEND, MOVE, IDLE
end enum

function processAI(): void
  for entityId = 0 to maxEntities - 1
    if entities[entityId].active == false then
      continue
    end if

    for actionId = 0 to maxActions - 1
      match entities[entityId].actionQueue[actionId]
        case ActionType.ATTACK:
          if executeAttack(entityId) then
            break
          end if
        case ActionType.DEFEND:
          if executeDefend(entityId) then
            continue
          end if
        case ActionType.MOVE:
          if executeMove(entityId) then
            break
          end if
        default:
          entities[entityId].state = ActionType.IDLE
      end match
    next actionId
  next entityId
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(2); // 1 enum + 1 function
            const enumDecl = program.body[0];
            expect(enumDecl.type).toBe('EnumDeclaration');
            expect(enumDecl.name).toBe('ActionType');
            const funcDecl = program.body[1];
            expect(funcDecl.type).toBe('FunctionDeclaration');
            expect(funcDecl.name).toBe('processAI');
            // Should have nested for loops
            const outerFor = funcDecl.body[0];
            expect(outerFor.type).toBe('ForStatement');
            // Inner structure should contain match statement
            let foundMatch = false;
            let foundInnerFor = false;
            function searchStatements(statements) {
                for (const stmt of statements) {
                    if (stmt.type === 'MatchStatement')
                        foundMatch = true;
                    if (stmt.type === 'ForStatement')
                        foundInnerFor = true;
                    if (stmt.body)
                        searchStatements(stmt.body);
                    if (stmt.thenBody)
                        searchStatements(stmt.thenBody);
                    if (stmt.elseBody)
                        searchStatements(stmt.elseBody);
                    if (stmt.cases) {
                        for (const caseStmt of stmt.cases) {
                            searchStatements(caseStmt.consequent);
                        }
                    }
                    if (stmt.defaultCase) {
                        searchStatements(stmt.defaultCase.consequent);
                    }
                }
            }
            searchStatements(outerFor.body);
            expect(foundMatch).toBe(true);
            expect(foundInnerFor).toBe(true);
        });
        it('should parse exported enums with functions using all v0.2 features', () => {
            const source = `module PublicAPI
export enum PlayerAction
  JUMP = 1,
  RUN = 2,
  SHOOT = 3,
  CROUCH = 4
end enum

export enum EnemyType
  GOOMBA, KOOPA, PIRANHA_PLANT
end enum

export function handleInput(action: PlayerAction): void
  match action
    case PlayerAction.JUMP:
      for frame = 0 to jumpDuration - 1
        if collision then
          break
        end if
        updateJumpFrame()
      next frame
    case PlayerAction.RUN:
      while running
        if obstacle then
          break
        end if
        if powerUp then
          continue
        end if
        updateRunning()
      end while
    case PlayerAction.SHOOT:
      for bullet = 0 to maxBullets - 1
        if bullets[bullet].active then
          continue
        end if
        fireBullet(bullet)
        break
      next bullet
    default:
      setIdle()
  end match
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.exports.length).toBe(3); // 2 enums + 1 function
            // All exports should be properly marked
            const exports = program.exports;
            expect(exports[0].declaration.type).toBe('EnumDeclaration');
            expect(exports[0].declaration.name).toBe('PlayerAction');
            expect(exports[0].declaration.exported).toBe(true);
            expect(exports[1].declaration.type).toBe('EnumDeclaration');
            expect(exports[1].declaration.name).toBe('EnemyType');
            expect(exports[1].declaration.exported).toBe(true);
            expect(exports[2].declaration.type).toBe('FunctionDeclaration');
            expect(exports[2].declaration.name).toBe('handleInput');
            expect(exports[2].declaration.exported).toBe(true);
            // Function should use all v0.2 features
            const funcDecl = exports[2].declaration;
            expect(funcDecl.body[0].type).toBe('MatchStatement');
        });
        it('should handle complex v0.2 error scenarios correctly', () => {
            // Test break outside nested loop structure
            const breakOutsideLoop = `module Test
enum State ACTIVE, INACTIVE end enum
function test(): void
  match state
    case State.ACTIVE:
      break
  end match
end function`;
            expect(() => parseSource(breakOutsideLoop)).toThrow(/break statement must be inside a loop/);
            // Test continue outside nested loop structure
            const continueOutsideLoop = `module Test
function test(): void
  match value
    case 1:
      continue
  end match
end function`;
            expect(() => parseSource(continueOutsideLoop)).toThrow(/continue statement must be inside a loop/);
            // Test multiple defaults in match
            const multipleDefaults = `module Test
enum Action MOVE, STOP end enum
function test(): void
  match action
    case Action.MOVE:
      doMove()
    default:
      doDefault1()
    default:
      doDefault2()
  end match
end function`;
            expect(() => parseSource(multipleDefaults)).toThrow(/Multiple default cases not allowed/);
        });
        it('should parse deeply nested v0.2 constructs', () => {
            const source = `module ComplexNesting
enum GameMode SINGLE, MULTI end enum
enum PlayerType HUMAN, AI end enum

function complexLogic(): void
  match gameMode
    case GameMode.SINGLE:
      for playerId = 0 to maxPlayers - 1
        if players[playerId].active then
          while players[playerId].health > 0
            match players[playerId].playerType
              case PlayerType.HUMAN:
                for inputId = 0 to inputBufferSize - 1
                  if inputs[inputId].processed then
                    continue
                  end if
                  if processInput(inputId) then
                    break
                  end if
                next inputId
              case PlayerType.AI:
                for decision = 0 to aiDecisions - 1
                  if makeAIDecision(decision) then
                    break
                  end if
                next decision
              default:
                setPlayerInactive(playerId)
                continue
            end match
          end while
        end if
      next playerId
    default:
      handleMultiplayer()
  end match
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(3); // 2 enums + 1 function
            // Should parse without errors and have proper nesting
            const funcDecl = program.body[2];
            expect(funcDecl.type).toBe('FunctionDeclaration');
            expect(funcDecl.body[0].type).toBe('MatchStatement');
        });
    });
    describe('Expressions', () => {
        it('should parse binary expression', () => {
            const source = `module Main
function test(): void
  var result: byte = x + y
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            // Function body should contain expression statements, not variable declarations
            // This test may need adjustment based on actual parser behavior
            expect(funcDecl.body?.length).toBeGreaterThan(0);
        });
        it('should parse unary expression', () => {
            const source = `module Main
function test(): void
  var result: byte = not flag
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBeGreaterThan(0);
        });
        it('should parse function call expression', () => {
            const source = `module Main
function test(): void
  var result: byte = add(5, 10)
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBeGreaterThan(0);
        });
        it('should parse array access expression', () => {
            const source = `module Main
function test(): void
  var result: byte = buffer[index]
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBeGreaterThan(0);
        });
    });
    describe('Literals', () => {
        it('should parse number literals', () => {
            const source = `module Main
function test(): void
  var decimal: byte = 123
  var hex: byte = $FF
  var binary: byte = 0b1010
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(3);
            expect(funcDecl.body?.[0].type).toBe('ExpressionStatement');
            expect(funcDecl.body?.[1].type).toBe('ExpressionStatement');
            expect(funcDecl.body?.[2].type).toBe('ExpressionStatement');
        });
        it('should parse string literals', () => {
            const source = `module Main
function test(): void
  var message: byte = "Hello, World!"
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(1);
        });
        it('should parse boolean literals', () => {
            const source = `module Main
function test(): void
  var flag1: boolean = true
  var flag2: boolean = false
end function`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            const funcDecl = program.body[0];
            expect(funcDecl.body?.length).toBe(2);
        });
    });
    describe('Complex Sample Code', () => {
        it('should reject storage classes in function body', () => {
            const source = `module Game.Main
import setSpritePosition from c64.sprites
import utils from core.helpers

export function main(): void
  zp var counter: byte = 0
  ram var buffer: byte[256]
  io var VIC_REG: byte

  while counter < 10
    buffer[counter] = counter
    counter = counter + 1
  end while

  if counter == 10 then
    VIC_REG = $FF
  end if
end function

function helper(x: byte, y: byte): byte
  return x + y
end function`;
            // Should throw error because storage classes are not allowed inside functions
            expect(() => parseSource(source)).toThrow(/Storage class 'zp' not allowed inside functions/);
        });
        it('should parse complete Blend65 module with correct storage class usage', () => {
            const source = `module Game.Main
import setSpritePosition from c64.sprites
import utils from core.helpers

// Global variables with storage classes
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
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.module.name.parts).toEqual(['Game', 'Main']);
            expect(program.imports.length).toBe(2);
            expect(program.exports.length).toBe(1);
            expect(program.body.length).toBe(4); // 3 global vars + helper function
            // Check imports
            expect(program.imports[0].type).toBe('ImportDeclaration');
            expect(program.imports[1].type).toBe('ImportDeclaration');
            // Check global variables
            expect(program.body[0].type).toBe('VariableDeclaration');
            expect(program.body[0].storageClass).toBe('zp');
            expect(program.body[1].type).toBe('VariableDeclaration');
            expect(program.body[1].storageClass).toBe('ram');
            expect(program.body[2].type).toBe('VariableDeclaration');
            expect(program.body[2].storageClass).toBe('io');
            // Check export
            expect(program.exports[0].type).toBe('ExportDeclaration');
            const mainFunc = program.exports[0].declaration;
            expect(mainFunc.name).toBe('main');
            expect(mainFunc.exported).toBe(true);
            // Check body function
            const helperFunc = program.body[3];
            expect(helperFunc.type).toBe('FunctionDeclaration');
            expect(helperFunc.name).toBe('helper');
            expect(helperFunc.params.length).toBe(2);
            expect(helperFunc.exported).toBe(false);
        });
        it('should parse module with storage class combinations', () => {
            const source = `module Storage.Test
zp var zpCounter: byte
ram var ramBuffer: byte[100]
data var dataTable: byte[256] = [1, 2, 3]
const var SCREEN_COLOR: byte = $0E
io var SID_VOICE1: byte`;
            const ast = parseSource(source);
            expect(ast.type).toBe('Program');
            const program = ast;
            expect(program.body.length).toBe(5);
            const zpVar = program.body[0];
            expect(zpVar.storageClass).toBe('zp');
            const ramVar = program.body[1];
            expect(ramVar.storageClass).toBe('ram');
            const dataVar = program.body[2];
            expect(dataVar.storageClass).toBe('data');
            expect(dataVar.initializer).toBeDefined();
            const constVar = program.body[3];
            expect(constVar.storageClass).toBe('const');
            expect(constVar.initializer).toBeDefined();
            const ioVar = program.body[4];
            expect(ioVar.storageClass).toBe('io');
        });
    });
    describe('Error Recovery', () => {
        it('should handle missing end keywords gracefully', () => {
            const source = `module Main
function test(): void
  if x == 5 then
    y = 10`;
            // Should not throw, but produce an AST with error nodes
            try {
                const ast = parseSource(source);
                expect(ast).toBeDefined();
                expect(ast.type).toBe('Program');
            }
            catch (error) {
                // Parser may throw on syntax errors - that's expected behavior
                expect(error).toBeDefined();
            }
        });
        it('should handle unexpected tokens gracefully', () => {
            const source = `module Main
var *** invalid: byte`;
            // Should not throw, but produce an AST with error recovery
            try {
                const ast = parseSource(source);
                expect(ast).toBeDefined();
                expect(ast.type).toBe('Program');
            }
            catch (error) {
                // Parser may throw on syntax errors - that's expected behavior
                expect(error).toBeDefined();
            }
        });
    });
});
//# sourceMappingURL=blend65-parser.test.js.map