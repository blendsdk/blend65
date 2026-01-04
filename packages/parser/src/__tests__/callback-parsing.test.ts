import { describe, it, expect } from 'vitest';
import { Blend65Parser } from '../blend65/blend65-parser.js';
import { Blend65Lexer } from '@blend65/lexer';
import { FunctionDeclaration, VariableDeclaration, PrimitiveType, ArrayType } from '@blend65/ast';

describe('Callback Function Parsing', () => {
  const createParser = (source: string) => {
    const lexer = new Blend65Lexer(source);
    const tokens = lexer.tokenize();
    return new Blend65Parser(tokens);
  };

  it('should parse simple callback function', () => {
    const source = `
      module Test.Callbacks

      callback function rasterHandler(): void
        updateSprites()
        setBackgroundColor(RED)
      end function
    `;

    const ast = createParser(source).parse();
    expect(ast.body).toHaveLength(1);

    const decl = ast.body[0];
    expect(decl.type).toBe('FunctionDeclaration');

    const func = decl as FunctionDeclaration;
    expect(func.name).toBe('rasterHandler');
    expect(func.callback).toBe(true);
    expect(func.exported).toBe(false);
    expect(func.params).toHaveLength(0);
    expect(func.returnType.type).toBe('PrimitiveType');
    expect((func.returnType as PrimitiveType).name).toBe('void');
  });

  it('should parse callback function with parameters', () => {
    const source = `
      module Test.Callbacks

      callback function aiHandler(shipType: byte, target: byte): void
        processAI(shipType, target)
      end function
    `;

    const ast = createParser(source).parse();
    const func = ast.body[0] as FunctionDeclaration;

    expect(func.callback).toBe(true);
    expect(func.params).toHaveLength(2);
    expect(func.params[0].name).toBe('shipType');
    expect(func.params[1].name).toBe('target');
    expect((func.params[0].paramType as PrimitiveType).name).toBe('byte');
    expect((func.params[1].paramType as PrimitiveType).name).toBe('byte');
  });

  it('should parse callback function with return type', () => {
    const source = `
      module Test.Callbacks

      callback function getPlayerX(): byte
        return playerX
      end function
    `;

    const ast = createParser(source).parse();
    const func = ast.body[0] as FunctionDeclaration;

    expect(func.callback).toBe(true);
    expect(func.returnType.type).toBe('PrimitiveType');
    expect((func.returnType as PrimitiveType).name).toBe('byte');
  });

  it('should parse exported callback function', () => {
    const source = `
      module Test.Callbacks

      export callback function publicHandler(): void
        // Public callback function
      end function
    `;

    const ast = createParser(source).parse();
    expect(ast.exports).toHaveLength(1);

    const func = ast.exports[0].declaration as FunctionDeclaration;
    expect(func.callback).toBe(true);
    expect(func.exported).toBe(true);
    expect(func.name).toBe('publicHandler');
  });

  it('should parse multiple callback functions', () => {
    const source = `
      module Test.MultipleCallbacks

      callback function handler1(): void
        updateGraphics()
      end function

      callback function handler2(param: byte): byte
        return param * 2
      end function
    `;

    const ast = createParser(source).parse();
    expect(ast.body).toHaveLength(2);

    const func1 = ast.body[0] as FunctionDeclaration;
    const func2 = ast.body[1] as FunctionDeclaration;

    expect(func1.callback).toBe(true);
    expect(func2.callback).toBe(true);
    expect(func1.params).toHaveLength(0);
    expect(func2.params).toHaveLength(1);
  });

  it('should reject callback modifier on non-function', () => {
    const source = `
      module Test.Invalid

      callback var counter: byte = 0
    `;

    expect(() => createParser(source).parse()).toThrow("Expected 'function' after 'callback'");
  });

  it('should parse regular function without callback flag', () => {
    const source = `
      module Test.Regular

      function normalFunc(): void
        // Regular function
      end function
    `;

    const ast = createParser(source).parse();
    const func = ast.body[0] as FunctionDeclaration;

    expect(func.callback).toBe(false);
    expect(func.name).toBe('normalFunc');
  });
});

describe('Callback Type Parsing', () => {
  const createParser = (source: string) => {
    const lexer = new Blend65Lexer(source);
    const tokens = lexer.tokenize();
    return new Blend65Parser(tokens);
  };

  it('should parse callback type annotation', () => {
    const source = `
      module Test.CallbackType

      var handler: callback = myCallbackFunction
    `;

    const ast = createParser(source).parse();
    const varDecl = ast.body[0] as VariableDeclaration;

    expect(varDecl.varType.type).toBe('PrimitiveType');
    expect((varDecl.varType as PrimitiveType).name).toBe('callback');
  });

  it('should parse callback array type', () => {
    const source = `
      module Test.CallbackArray

      var handlers: callback[4] = [ai1, ai2, ai3, ai4]
    `;

    const ast = createParser(source).parse();
    const varDecl = ast.body[0] as VariableDeclaration;

    expect(varDecl.varType.type).toBe('ArrayType');
    const arrayType = varDecl.varType as ArrayType;
    expect(arrayType.elementType.type).toBe('PrimitiveType');
    expect((arrayType.elementType as PrimitiveType).name).toBe('callback');
  });

  it('should parse function parameter with callback type', () => {
    const source = `
      module Test.CallbackParam

      function setInterrupt(line: byte, handler: callback): byte
        return setupInterrupt(line, handler)
      end function
    `;

    const ast = createParser(source).parse();
    const func = ast.body[0] as FunctionDeclaration;

    expect(func.params).toHaveLength(2);
    expect(func.params[1].name).toBe('handler');
    expect(func.params[1].paramType.type).toBe('PrimitiveType');
    expect((func.params[1].paramType as PrimitiveType).name).toBe('callback');
  });
});

describe('Callback Function Integration', () => {
  const createParser = (source: string) => {
    const lexer = new Blend65Lexer(source);
    const tokens = lexer.tokenize();
    return new Blend65Parser(tokens);
  };

  it('should parse complete callback-driven game structure', () => {
    const source = `
      module Game.CallbackDemo
      import setRasterInterrupt, enableInterrupts from c64.interrupts
      import setSpritePosition from c64.sprites

      var playerX: byte = 100
      var frameCounter: byte = 0

      // Hardware interrupt callback
      callback function gameLoop(): void
        frameCounter += 1
        setSpritePosition(0, playerX, 100)
        checkCollisions()
      end function

      // AI behavior callback
      callback function enemyAI(): void
        moveTowardPlayer()
        fireWeapons()
      end function

      // Menu action callback
      callback function startGame(): void
        initPlayer()
        switchToGameplay()
      end function

      // Regular functions
      export function main(): void
        setupCallbacks()
        gameMainLoop()
      end function

      function setupCallbacks(): void
        setRasterInterrupt(250, gameLoop)
        setEnemyAI(0, enemyAI)
        setMenuAction(0, startGame)
        enableInterrupts()
      end function

      function gameMainLoop(): void
        while true
          handleInput()
          updateGameLogic()
        end while
      end function
    `;

    const ast = createParser(source).parse();

    // Should have multiple declarations
    expect(ast.body.length + ast.exports.length).toBeGreaterThan(5);

    // Check callback functions
    const gameLoopDecl = ast.body.find(
      decl =>
        decl.type === 'FunctionDeclaration' && (decl as FunctionDeclaration).name === 'gameLoop'
    );
    const enemyAIDecl = ast.body.find(
      decl =>
        decl.type === 'FunctionDeclaration' && (decl as FunctionDeclaration).name === 'enemyAI'
    );
    const startGameDecl = ast.body.find(
      decl =>
        decl.type === 'FunctionDeclaration' && (decl as FunctionDeclaration).name === 'startGame'
    );

    expect((gameLoopDecl as FunctionDeclaration)?.callback).toBe(true);
    expect((enemyAIDecl as FunctionDeclaration)?.callback).toBe(true);
    expect((startGameDecl as FunctionDeclaration)?.callback).toBe(true);

    // Check regular functions are not marked as callback
    const mainDecl = ast.exports.find(
      exp =>
        exp.declaration.type === 'FunctionDeclaration' &&
        (exp.declaration as FunctionDeclaration).name === 'main'
    );

    expect((mainDecl?.declaration as FunctionDeclaration)?.callback).toBe(false);
  });

  it('should parse callback variables and assignments', () => {
    const source = `
      module Test.CallbackVariables

      callback function handler1(): void
      end function

      callback function handler2(): void
      end function

      var currentHandler: callback = handler1
      var handlers: callback[2] = [handler1, handler2]
    `;

    const ast = createParser(source).parse();

    // Find callback variable declarations
    const currentHandlerDecl = ast.body.find(
      decl =>
        decl.type === 'VariableDeclaration' &&
        (decl as VariableDeclaration).name === 'currentHandler'
    );
    const handlersDecl = ast.body.find(
      decl =>
        decl.type === 'VariableDeclaration' && (decl as VariableDeclaration).name === 'handlers'
    );

    // Check callback type
    const currentHandlerType = (currentHandlerDecl as VariableDeclaration)
      ?.varType as PrimitiveType;
    expect(currentHandlerType.name).toBe('callback');

    // Check callback array type
    const handlersType = (handlersDecl as VariableDeclaration)?.varType as ArrayType;
    const elementType = handlersType.elementType as PrimitiveType;
    expect(elementType.name).toBe('callback');
  });

  it('should handle mixed callback and regular functions', () => {
    const source = `
      module Test.Mixed

      function regularFunc(): void
        normalOperation()
      end function

      callback function callbackFunc(): void
        interruptOperation()
      end function

      callback function anotherCallback(x: byte): byte
        return x * 2
      end function
    `;

    const ast = createParser(source).parse();
    expect(ast.body).toHaveLength(3);

    const regularFunc = ast.body[0] as FunctionDeclaration;
    const callbackFunc = ast.body[1] as FunctionDeclaration;
    const anotherCallback = ast.body[2] as FunctionDeclaration;

    expect(regularFunc.callback).toBe(false);
    expect(callbackFunc.callback).toBe(true);
    expect(anotherCallback.callback).toBe(true);

    expect(regularFunc.name).toBe('regularFunc');
    expect(callbackFunc.name).toBe('callbackFunc');
    expect(anotherCallback.name).toBe('anotherCallback');
  });
});
