# Blend65 Callback Function Implementation Plan

**Purpose:** Step-by-step implementation plan for adding callback function support to Blend65
**Date:** 03/01/2026
**Status:** Ready for Implementation
**Based On:** Unified callback system design for interrupts + function pointers

---

## Table of Contents

1. [Implementation Overview](#implementation-overview)
2. [Phase 1: Language Specification Updates](#phase-1-language-specification-updates)
3. [Phase 2: Lexer Implementation](#phase-2-lexer-implementation)
4. [Phase 3: AST Extensions](#phase-3-ast-extensions)
5. [Phase 4: Parser Implementation](#phase-4-parser-implementation)
6. [Phase 5: Testing and Validation](#phase-5-testing-and-validation)
7. [Phase 6: Documentation and Examples](#phase-6-documentation-and-examples)
8. [Success Criteria](#success-criteria)

---

## Implementation Overview

### Goal
Add unified `callback` function system to Blend65 that solves both hardware interrupts and function pointer needs with a single language feature.

### Scope
- **Language Feature**: `callback` keyword modifier + `callback` primitive type
- **Frontend Only**: Lexer, Parser, AST changes (no backend/codegen yet)
- **Unified Solution**: Single feature handles interrupts, AI, menus, state machines
- **Compatibility**: Maintains 100% compatibility with existing v0.1/v0.2 code

### Key Principles
1. **Unified Design**: Single solution for hardware interrupts + function pointers
2. **Simple Syntax**: `callback function` + `callback` type
3. **Flexible Semantics**: Callbacks can have params, return values, be exported
4. **Future-Ready**: Foundation for signature validation and optimization

---

## Phase 1: Language Specification Updates

### Task 1.1: Update Grammar Specification ✅ COMPLETED

**File:** `docs/BLEND65_LANGUAGE_SPECIFICATION.md`

**Changes Completed:**
- [x] Added `callback` to keywords list
- [x] Updated function declaration grammar with `["callback"]` modifier
- [x] Added `callback` to primitive types
- [x] Updated semantic rules for callback functions
- [x] Updated reserved words reference

**Grammar Changes:**
```ebnf
function_declaration = ["callback"] "function" identifier "(" parameter_list ")" [ ":" type_annotation ] ...
primitive_type = "byte" | "word" | "boolean" | "void" | "callback" ;
```

**Semantic Rules:**
- `callback` functions can have any parameters and return types
- `callback` functions can be exported and used as function pointers
- `callback` modifier enables functions to be used in callback variables
- Both `callback` and regular functions can be called directly

**Success Criteria:**
- [x] Grammar updated with callback syntax
- [x] Semantic rules clearly documented
- [x] `callback` added as primitive type
- [x] Keywords list includes `callback`

---

## Phase 2: Lexer Implementation

### Task 2.1: Add CALLBACK Token Type

**File:** `packages/lexer/src/types.ts`

**Changes Required:**
```typescript
// Add to TokenType enum
export enum TokenType {
  // ... existing tokens
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',
  ENUM = 'ENUM',
  DEFAULT = 'DEFAULT',
  CALLBACK = 'CALLBACK',        // NEW: Callback keyword token

  // ... other tokens
}
```

**Update Keywords Set:**
```typescript
export const KEYWORDS = new Set([
  // ... existing keywords
  'break',
  'continue',
  'enum',
  'default',
  'callback',                    // NEW: Add callback keyword
]);

export const CONTROL_FLOW_KEYWORDS = new Set([
  // ... existing keywords
  'callback',                    // NEW: Add to control flow keywords
]);
```

### Task 2.2: Test Lexer Changes

**File:** `packages/lexer/src/__tests__/blend65-lexer.test.ts`

**New Tests:**
```typescript
describe('Callback Keyword Lexing', () => {
  it('should tokenize callback keyword', () => {
    const source = 'callback function';
    const tokens = lexer.tokenize(source);

    expect(tokens[0].type).toBe(TokenType.CALLBACK);
    expect(tokens[0].value).toBe('callback');
  });

  it('should recognize callback in function declaration context', () => {
    const source = 'callback function handler(): void';
    const tokens = lexer.tokenize(source);

    expect(tokens[0].type).toBe(TokenType.CALLBACK);
    expect(tokens[1].type).toBe(TokenType.FUNCTION);
  });

  it('should tokenize callback as type', () => {
    const source = 'var handler: callback = myFunction';
    const tokens = lexer.tokenize(source);

    expect(tokens[3].type).toBe(TokenType.CALLBACK);
    expect(tokens[3].value).toBe('callback');
  });

  it('should handle callback as identifier when not a keyword', () => {
    const source = 'var callbackCount: byte = 0';
    const tokens = lexer.tokenize(source);

    // callbackCount should be IDENTIFIER, not CALLBACK + IDENTIFIER
    expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[1].value).toBe('callbackCount');
  });

  it('should handle case sensitivity', () => {
    const source = 'CALLBACK Callback CallBack';
    const tokens = lexer.tokenize(source);

    // All should be identifiers, not callback keyword
    expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
  });
});
```

**Success Criteria:**
- [ ] CALLBACK token type added
- [ ] Keywords set updated
- [ ] All lexer tests pass
- [ ] Case sensitivity handled correctly
- [ ] Integration with existing lexer functionality

---

## Phase 3: AST Extensions

### Task 3.1: Extend FunctionDeclaration AST Node

**File:** `packages/ast/src/ast-types/core.ts`

**Changes Required:**
```typescript
/**
 * Function declaration with optional callback modifier
 * Enhanced to support callback functions for interrupts and function pointers
 */
export interface FunctionDeclaration extends Blend65ASTNode {
  type: 'FunctionDeclaration';
  name: string;
  parameters: Parameter[];
  returnType: TypeAnnotation | null;
  body: Statement[];
  exported: boolean;
  callback: boolean;              // NEW: Callback function flag
}
```

### Task 3.2: Add Callback Primitive Type

**File:** `packages/ast/src/ast-types/core.ts`

**Changes Required:**
```typescript
/**
 * Primitive type annotation - add callback type
 */
export interface PrimitiveType extends TypeAnnotation {
  type: 'PrimitiveType';
  name: 'byte' | 'word' | 'boolean' | 'void' | 'callback';  // Add 'callback'
}
```

### Task 3.3: Update AST Factory

**File:** `packages/ast/src/ast-factory.ts`

**Changes Required:**
```typescript
/**
 * Create function declaration with callback support
 */
createFunctionDeclaration(
  name: string,
  parameters: Parameter[],
  returnType: TypeAnnotation | null,
  body: Statement[],
  exported: boolean = false,
  callback: boolean = false,      // NEW: Callback flag parameter
  metadata?: SourceMetadata
): FunctionDeclaration {
  return {
    type: 'FunctionDeclaration',
    name,
    parameters,
    returnType,
    body,
    exported,
    callback,                     // NEW: Include callback flag
    metadata: metadata || { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }
  };
}

/**
 * Create primitive type with callback support
 */
createPrimitiveType(name: 'byte' | 'word' | 'boolean' | 'void' | 'callback'): PrimitiveType {
  return {
    type: 'PrimitiveType',
    name
  };
}
```

### Task 3.4: Test AST Extensions

**File:** `packages/ast/src/__tests__/ast-factory.test.ts`

**New Tests:**
```typescript
describe('Callback Function AST', () => {
  it('should create callback function declaration', () => {
    const func = factory.createFunctionDeclaration(
      'handler',
      [],
      factory.createPrimitiveType('void'),
      [],
      false,    // not exported
      true      // callback function
    );

    expect(func.type).toBe('FunctionDeclaration');
    expect(func.name).toBe('handler');
    expect(func.callback).toBe(true);
    expect(func.exported).toBe(false);
  });

  it('should create callback function with parameters', () => {
    const param = factory.createParameter('x', factory.createPrimitiveType('byte'));
    const func = factory.createFunctionDeclaration(
      'aiHandler',
      [param],
      factory.createPrimitiveType('void'),
      [],
      false,
      true
    );

    expect(func.callback).toBe(true);
    expect(func.parameters).toHaveLength(1);
  });

  it('should create callback function with return type', () => {
    const func = factory.createFunctionDeclaration(
      'getter',
      [],
      factory.createPrimitiveType('byte'),
      [],
      false,
      true
    );

    expect(func.callback).toBe(true);
    expect(func.returnType?.type).toBe('PrimitiveType');
    expect((func.returnType as PrimitiveType).name).toBe('byte');
  });

  it('should create exported callback function', () => {
    const func = factory.createFunctionDeclaration(
      'publicHandler',
      [],
      factory.createPrimitiveType('void'),
      [],
      true,     // exported
      true      // callback
    );

    expect(func.callback).toBe(true);
    expect(func.exported).toBe(true);
  });

  it('should create regular function with callback flag false', () => {
    const func = factory.createFunctionDeclaration(
      'regularFunc',
      [],
      factory.createPrimitiveType('void'),
      []
    );

    expect(func.callback).toBe(false);  // Default value
  });
});

describe('Callback Primitive Type', () => {
  it('should create callback primitive type', () => {
    const callbackType = factory.createPrimitiveType('callback');

    expect(callbackType.type).toBe('PrimitiveType');
    expect(callbackType.name).toBe('callback');
  });

  it('should support callback type in variables', () => {
    const variable = factory.createVariableDeclaration(
      'handler',
      factory.createPrimitiveType('callback'),
      null,
      false
    );

    expect(variable.variableType.type).toBe('PrimitiveType');
    expect((variable.variableType as PrimitiveType).name).toBe('callback');
  });

  it('should support callback arrays', () => {
    const arrayType = factory.createArrayType(
      factory.createPrimitiveType('callback'),
      factory.createLiteral(4, '4')
    );

    expect(arrayType.elementType.type).toBe('PrimitiveType');
    expect((arrayType.elementType as PrimitiveType).name).toBe('callback');
  });
});
```

**Success Criteria:**
- [ ] FunctionDeclaration interface updated with callback flag
- [ ] PrimitiveType supports 'callback' name
- [ ] Factory methods handle callback functions and types
- [ ] All AST factory tests pass
- [ ] Type safety maintained

---

## Phase 4: Parser Implementation

### Task 4.1: Update Declaration Parsing

**File:** `packages/parser/src/blend65/blend65-parser.ts`

**Changes Required:**

**Update parseDeclaration method:**
```typescript
private parseDeclaration(): Declaration | null {
  // Skip any newlines or empty lines
  this.skipNewlines();

  if (this.isAtEnd()) {
    return null;
  }

  // Handle 'export' keyword
  const exported = this.match(TokenType.EXPORT);

  // NEW: Handle 'callback' keyword
  const callback = this.match(TokenType.CALLBACK);

  if (this.match(TokenType.FUNCTION)) {
    return this.parseFunctionDeclaration(exported, callback);
  } else if (this.checkLexeme('var')) {
    if (callback) {
      throw new Error("'callback' modifier can only be used with functions");
    }
    return this.parseVariableDeclaration(exported);
  } else if (this.checkLexeme('type')) {
    if (callback) {
      throw new Error("'callback' modifier can only be used with functions");
    }
    return this.parseTypeDeclaration(exported);
  } else if (this.checkLexeme('enum')) {
    if (callback) {
      throw new Error("'callback' modifier can only be used with functions");
    }
    return this.parseEnumDeclaration(exported);
  }

  if (callback) {
    throw new Error("Expected 'function' after 'callback'");
  }

  if (exported) {
    throw new Error("Expected declaration after 'export'");
  }

  return null;
}
```

**Update parseFunctionDeclaration method:**
```typescript
private parseFunctionDeclaration(exported: boolean, callback: boolean = false): FunctionDeclaration {
  const functionToken = this.previous(); // Should be FUNCTION token
  const name = this.consume(TokenType.IDENTIFIER, "Expected function name").value;

  this.consume(TokenType.LEFT_PAREN, "Expected '(' after function name");
  const parameters = this.parseParameterList();
  this.consume(TokenType.RIGHT_PAREN, "Expected ')' after parameters");

  let returnType: TypeAnnotation | null = null;
  if (this.match(TokenType.COLON)) {
    returnType = this.parseTypeAnnotation();
  }

  this.consumeStatementTerminator();

  // Parse function body
  const body = this.parseStatementBlock('function');

  this.consume(TokenType.END, "Expected 'end' after function body");
  this.consumeLexeme('function', "Expected 'function' after 'end'");
  this.consumeStatementTerminator();

  return this.factory.createFunctionDeclaration(
    name,
    parameters,
    returnType,
    body,
    exported,
    callback    // NEW: Pass callback flag
  );
}
```

### Task 4.2: Add Callback Type Parsing

**File:** `packages/parser/src/blend65/blend65-parser.ts`

**Update parseTypeAnnotation method:**
```typescript
private parseTypeAnnotation(): TypeAnnotation {
  if (this.check(TokenType.IDENTIFIER)) {
    // Handle named types
    return this.parseNamedType();
  }

  // Handle primitive types including callback
  if (this.checkLexeme('byte') || this.checkLexeme('word') ||
      this.checkLexeme('boolean') || this.checkLexeme('void') ||
      this.checkLexeme('callback')) {
    return this.parsePrimitiveType();
  }

  // Handle array types
  if (this.checkPrimitiveTypeFollowedByBracket()) {
    return this.parseArrayType();
  }

  throw new Error(`Expected type annotation, got ${this.peek().value}`);
}

private parsePrimitiveType(): PrimitiveType {
  const typeToken = this.advance();
  const typeName = typeToken.value as 'byte' | 'word' | 'boolean' | 'void' | 'callback';

  return this.factory.createPrimitiveType(typeName);
}
```

### Task 4.3: Test Parser Changes

**File:** `packages/parser/src/__tests__/blend65-parser.test.ts`

**New Test Suite:**
```typescript
describe('Callback Function Parsing', () => {
  it('should parse simple callback function', () => {
    const source = `
      module Test.Callbacks

      callback function rasterHandler(): void
        updateSprites()
        setBackgroundColor(RED)
      end function
    `;

    const ast = parser.parse(source);
    expect(ast.exports).toHaveLength(1);

    const decl = ast.exports[0];
    expect(decl.declaration.type).toBe('FunctionDeclaration');

    const func = decl.declaration as FunctionDeclaration;
    expect(func.name).toBe('rasterHandler');
    expect(func.callback).toBe(true);
    expect(func.exported).toBe(false);
  });

  it('should parse callback function with parameters', () => {
    const source = `
      callback function aiHandler(shipType: byte, target: byte): void
        processAI(shipType, target)
      end function
    `;

    const ast = parser.parse(source);
    const func = ast.exports[0].declaration as FunctionDeclaration;

    expect(func.callback).toBe(true);
    expect(func.parameters).toHaveLength(2);
    expect(func.parameters[0].name).toBe('shipType');
    expect(func.parameters[1].name).toBe('target');
  });

  it('should parse callback function with return type', () => {
    const source = `
      callback function getPlayerX(): byte
        return playerX
      end function
    `;

    const ast = parser.parse(source);
    const func = ast.exports[0].declaration as FunctionDeclaration;

    expect(func.callback).toBe(true);
    expect(func.returnType?.type).toBe('PrimitiveType');
    expect((func.returnType as PrimitiveType)?.name).toBe('byte');
  });

  it('should parse exported callback function', () => {
    const source = `
      export callback function publicHandler(): void
        // Public callback function
      end function
    `;

    const ast = parser.parse(source);
    const func = ast.exports[0].declaration as FunctionDeclaration;

    expect(func.callback).toBe(true);
    expect(func.exported).toBe(true);
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

    const ast = parser.parse(source);
    expect(ast.exports).toHaveLength(2);

    const func1 = ast.exports[0].declaration as FunctionDeclaration;
    const func2 = ast.exports[1].declaration as FunctionDeclaration;

    expect(func1.callback).toBe(true);
    expect(func2.callback).toBe(true);
    expect(func1.parameters).toHaveLength(0);
    expect(func2.parameters).toHaveLength(1);
  });

  it('should reject callback modifier on non-function', () => {
    const source = `
      callback var counter: byte = 0
    `;

    expect(() => parser.parse(source)).toThrow("'callback' modifier can only be used with functions");
  });
});

describe('Callback Type Parsing', () => {
  it('should parse callback type annotation', () => {
    const source = `
      var handler: callback = myCallbackFunction
    `;

    const ast = parser.parse(source);
    const varDecl = ast.exports[0].declaration as VariableDeclaration;

    expect(varDecl.variableType.type).toBe('PrimitiveType');
    expect((varDecl.variableType as PrimitiveType).name).toBe('callback');
  });

  it('should parse callback array type', () => {
    const source = `
      var handlers: callback[4] = [ai1, ai2, ai3, ai4]
    `;

    const ast = parser.parse(source);
    const varDecl = ast.exports[0].declaration as VariableDeclaration;

    expect(varDecl.variableType.type).toBe('ArrayType');
    const arrayType = varDecl.variableType as ArrayType;
    expect(arrayType.elementType.type).toBe('PrimitiveType');
    expect((arrayType.elementType as PrimitiveType).name).toBe('callback');
  });

  it('should parse function parameter with callback type', () => {
    const source = `
      function setInterrupt(line: byte, handler: callback): byte
        return setupInterrupt(line, handler)
      end function
    `;

    const ast = parser.parse(source);
    const func = ast.exports[0].declaration as FunctionDeclaration;

    expect(func.parameters).toHaveLength(2);
    expect(func.parameters[1].name).toBe('handler');
    expect(func.parameters[1].parameterType.type).toBe('PrimitiveType');
    expect((func.parameters[1].parameterType as PrimitiveType).name).toBe('callback');
  });
});
```

### Task 4.4: Integration Testing

**File:** `packages/parser/src/__tests__/callback-integration.test.ts`

**Complete Integration Tests:**
```typescript
describe('Callback Function Integration', () => {
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

    const ast = parser.parse(source);

    // Should have multiple declarations
    expect(ast.exports.length).toBeGreaterThan(5);

    // Check callback functions
    const gameLoopDecl = ast.exports.find(exp =>
      exp.declaration.type === 'FunctionDeclaration' &&
      (exp.declaration as FunctionDeclaration).name === 'gameLoop'
    );
    const enemyAIDecl = ast.exports.find(exp =>
      exp.declaration.type === 'FunctionDeclaration' &&
      (exp.declaration as FunctionDeclaration).name === 'enemyAI'
    );
    const startGameDecl = ast.exports.find(exp =>
      exp.declaration.type === 'FunctionDeclaration' &&
      (exp.declaration as FunctionDeclaration).name === 'startGame'
    );

    expect((gameLoopDecl?.declaration as FunctionDeclaration)?.callback).toBe(true);
    expect((enemyAIDecl?.declaration as FunctionDeclaration)?.callback).toBe(true);
    expect((startGameDecl?.declaration as FunctionDeclaration)?.callback).toBe(true);

    // Check regular functions are not marked as callback
    const mainDecl = ast.exports.find(exp =>
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

    const ast = parser.parse(source);

    // Find callback variable declarations
    const currentHandlerDecl = ast.exports.find(exp =>
      exp.declaration.type === 'VariableDeclaration' &&
      (exp.declaration as VariableDeclaration).name === 'currentHandler'
    );
    const handlersDecl = ast.exports.find(exp =>
      exp.declaration.type === 'VariableDeclaration' &&
      (exp.declaration as VariableDeclaration).name === 'handlers'
    );

    // Check callback type
    const currentHandlerType = (currentHandlerDecl?.declaration as VariableDeclaration)?.variableType as PrimitiveType;
    expect(currentHandlerType.name).toBe('callback');

    // Check callback array type
    const handlersType = (handlersDecl?.declaration as VariableDeclaration)?.variableType as ArrayType;
    const elementType = handlersType.elementType as PrimitiveType;
    expect(elementType.name).toBe('callback');
  });
});
```

**Success Criteria:**
- [ ] Parser correctly handles callback keyword
- [ ] Function declarations with callback modifier parse correctly
- [ ] Callback type annotations parse correctly
- [ ] Callback arrays and variables supported
- [ ] Integration with existing parser functionality
- [ ] Complex callback function bodies supported

---

## Phase 5: Testing and Validation

### Task 5.1: Comprehensive Test Coverage

**Coverage Requirements:**
- **Lexer**: 100% coverage for callback keyword tokenization
- **Parser**: 100% coverage for callback function and type parsing
- **AST**: 100% coverage for callback function and type creation
- **Integration**: Full callback usage patterns tested

### Task 5.2: Edge Cases Testing

**Edge Cases to Test:**
```typescript
// Empty callback function
callback function empty(): void
end function

// Callback function with complex parameters
callback function complexHandler(a: byte, b: word, c: boolean): byte
  return a + b + (c ? 1 : 0)
end function

// Multiple callback functions in same module
callback function handler1(): void
end function
callback function handler2(): byte
  return 42
end function

// Callback function calling other functions
callback function caller(): void
  helperFunction()
  anotherHelper(5)
end function

// Mixed callback and regular functions
function regularFunc(): void
end function

callback function callbackFunc(): void
end function

// Callback variables and arrays
var singleHandler: callback = callbackFunc
var multipleHandlers: callback[3] = [callbackFunc, handler1, handler2]
```

### Task 5.3: Compatibility Testing

**v0.1 Compatibility:**
```typescript
// Existing v0.1 code should continue to work unchanged
const v01Source = `
  module Game.Original

  function main(): void
    var counter: byte = 0
    while counter < 10
      counter += 1
    end while
  end function
`;

// Should parse successfully with callback support added
expect(() => parser.parse(v01Source)).not.toThrow();
```

**v0.2 Compatibility:**
```typescript
// v0.2 features should work with callback functions
const v02WithCallbacks = `
  module Game.Enhanced

  enum GameState
    MENU, PLAYING, PAUSED
  end enum

  var state: GameState = GameState.MENU

  callback function gameUpdate(): void
    match state
      case GameState.PLAYING:
        updateGameplay()
      case GameState.PAUSED:
        // Do nothing
      default:
        returnToMenu()
    end match
  end function
`;

expect(() => parser.parse(v02WithCallbacks)).not.toThrow();
```

### Task 5.4: Performance Testing

**Performance Requirements:**
- **Parsing Speed**: No significant regression in parsing time
- **Memory Usage**: AST memory usage increase < 10%
- **Large Files**: Test with 1000+ line files including callback functions

**Success Criteria:**
- [ ] All test suites pass (lexer, parser, AST)
- [ ] 100% code coverage for new functionality
- [ ] No regressions in existing functionality
- [ ] Performance within acceptable limits

---

## Phase 6: Documentation and Examples

### Task 6.1: Create Comprehensive Examples

**File:** `examples/v03-callback-functions.blend`
```js
module Game.CallbackExample
import setRasterInterrupt, setTimerInterrupt, enableInterrupts from c64.interrupts
import setSpritePosition, setBackgroundColor from c64.vic

// Game state variables
var playerX: byte = 100
var playerY: byte = 100
var frameCounter: byte = 0
var currentAI: callback

// Hardware interrupt callbacks - called by VIC-II/CIA chips
callback function frameUpdate(): void
    frameCounter += 1
    setSpritePosition(0, playerX, playerY)

    // Color cycling effect
    if frameCounter > 50 then
        setBackgroundColor(RED)
    elsif frameCounter > 25 then
        setBackgroundColor(GREEN)
    else
        setBackgroundColor(BLUE)
    end if

    if frameCounter >= 60 then
        frameCounter = 0
    end if
end function

callback function musicDriver(): void
    playNextMusicFrame()
    updateSIDRegisters()
end function

// AI behavior callbacks - called by game logic
callback function aggressiveAI(): void
    attackPlayer()
    moveTowardPlayer()
end function

callback function defensiveAI(): void
    evadePlayer()
    findCover()
end function

callback function patrolAI(): void
    followPatrolRoute()
    scanForPlayer()
end function

// Menu action callbacks - called by UI system
callback function startNewGame(): void
    resetPlayer()
    resetEnemies()
    currentState = PLAYING
end function

callback function loadSavedGame(): void
    loadPlayerData()
    loadWorldState()
    currentState = PLAYING
end function

export function main(): void
    initializeCallbacks()
    runGameLoop()
end function

function initializeCallbacks(): void
    // Setup hardware callbacks
    setRasterInterrupt(250, frameUpdate)    // Graphics at 60 FPS
    setTimerInterrupt(1000, musicDriver)    // Music at 1kHz

    // Setup AI callbacks
    var aiTypes: callback[3] = [aggressiveAI, defensiveAI, patrolAI]
    for i = 0 to enemyCount - 1
        var aiType: byte = random(3)
        setEnemyAI(i, aiTypes[aiType])      // Random AI assignment
    next i

    // Setup menu callbacks
    var menuActions: callback[2] = [startNewGame, loadSavedGame]
    setMenuActions(menuActions)

    enableInterrupts()
end function

function runGameLoop(): void
    while gameRunning
        // Main game logic runs independently
        handlePlayerInput()
        updateGameState()
        checkWinConditions()

        // Graphics and music handled by interrupt callbacks
        // AI and UI handled by assigned callbacks
    end while
end function

function handlePlayerInput(): void
    if joystickLeft() then
        if playerX > 24 then
            playerX -= 2
        end if
    end if

    if joystickRight() then
        if playerX < 320 then
            playerX += 2
        end if
    end if
end function

function updateGameState(): void
    // Game logic independent of graphics timing
    updateEnemies()
    checkCollisions()
    updateScore()
end function
```

**File:** `examples/v03-callback-patterns.blend`
```js
module Demos.CallbackPatterns

// Pattern 1: Simple callback for interrupts
callback function simpleRaster(): void
    setBackgroundColor(RED)
end function

// Pattern 2: Callback with parameters for AI
callback function aiWithParams(aggression: byte): void
    if aggression > 5 then
        attackPlayer()
    else
        avoidPlayer()
    end if
end function

// Pattern 3: Callback with return value for getters
callback function getRandomValue(): byte
    return random(255)
end function

// Pattern 4: Callback calling multiple functions
callback function complexHandler(): void
    updatePlayerSprite()
    updateEnemySprites()
    updateBackgroundAnimation()
    checkHardwareCollisions()
end function

// Pattern 5: Callback with loop processing
callback function batchProcessor(): void
    for i = 0 to activeEnemyCount - 1
        if enemies[i].active then
            updateEnemySprite(i)
        end if
    next i
end function

export function demonstratePatterns(): void
    // Hardware interrupt usage
    setRasterInterrupt(100, simpleRaster)

    // AI system usage
    var aiHandlers: callback[1] = [aiWithParams]
    setEnemyAI(0, aiHandlers[0])

    // Menu system usage
    setMenuAction(0, complexHandler)

    // Custom callback execution
    var getter: callback = getRandomValue
    var randomValue: byte = getter()

    // Complex patterns
    setupBatchProcessor()
end function
```

### Task 6.2: Update Project Documentation

**Update README.md:**
- Add callback functions to feature list
- Include simple example showing interrupt + AI usage
- Link to complete specification

**Update package documentation:**
- Document callback system in main project README
- Add callback examples to getting started guide

### Task 6.3: Create Callback Tutorial

**File:** `docs/tutorials/CALLBACK_FUNCTIONS_GUIDE.md`
```markdown
# Blend65 Callback Functions Guide

## What are Callback Functions?

Callback functions in Blend65 are special functions that can be stored in variables and called indirectly. They solve two major needs in 6502 game development:

1. **Hardware Interrupts**: Functions called automatically by VIC-II/CIA chips
2. **Function Pointers**: Dynamic function dispatch for AI, menus, state machines

## Basic Syntax

```js
// Declare a callback function
callback function myHandler(): void
    // Function body
end function

// Use callback as function pointer
var handler: callback = myHandler
handler()  // Call through variable

// Pass callback to library function
setRasterInterrupt(250, myHandler)
```

## Real Game Examples

[Include detailed examples for interrupts, AI, menus, etc.]
```

**Success Criteria:**
- [ ] Language specification reflects callback design
- [ ] Example files demonstrate all callback patterns
- [ ] Tutorial explains callback usage clearly
- [ ] Documentation updated throughout project

---

## Success Criteria

### Phase Completion Checklist

**Phase 1: Language Specification**
- [x] Grammar updated with callback syntax
- [x] Semantic rules documented
- [x] `callback` added as primitive type
- [x] Keywords list updated

**Phase 2: Lexer Implementation**
- [ ] CALLBACK token type added
- [ ] Keywords set updated
- [ ] Lexer tests pass
- [ ] Case sensitivity handled

**Phase 3: AST Extensions**
- [ ] FunctionDeclaration interface updated
- [ ] PrimitiveType supports callback
- [ ] Factory methods enhanced
- [ ] AST tests pass

**Phase 4: Parser Implementation**
- [ ] Declaration parsing updated
- [ ] Function parsing enhanced
- [ ] Type parsing supports callback
- [ ] Parser tests pass

**Phase 5: Testing and Validation**
- [ ] Comprehensive test coverage
- [ ] Edge cases covered
- [ ] Compatibility maintained
- [ ] Performance acceptable

**Phase 6: Documentation**
- [ ] Specification complete
- [ ] Examples created
- [ ] Tutorial written
- [ ] Documentation updated

### Overall Success Criteria

**Functional Requirements:**
- [ ] Callback functions parse correctly with any parameters/returns
- [ ] Callback variables can store callback function references
- [ ] Callback type checking works in variable declarations
- [ ] All tests pass (217+ total tests)

**Game Pattern Support:**
- [ ] Hardware interrupts: `setRasterInterrupt(line, callback)`
- [ ] AI systems: `callback[4]` arrays for behavior dispatch
- [ ] Menu systems: Dynamic action selection with callbacks
- [ ] State machines: State handler dispatch with callbacks
- [ ] Mixed usage: Same callback functions for multiple purposes

**Quality Requirements:**
- [ ] No regressions in existing functionality
- [ ] Code coverage > 95% for new code
- [ ] Type safety maintained
- [ ] Performance impact < 5%

### Implementation Validation

**Test with Real Game Patterns:**
```js
// Bubble Escape pattern with callbacks
callback function bubbleGameLoop(): void
    updateBubblePosition()
    checkWallCollisions()
    updateEnemyPositions()
    checkEnemyCollisions()
    updateScore()
end function

// Elite AI pattern with callbacks
callback function traderAI(): void
    findNearestStation()
    calculateTradeProfits()
    executeTrade()
end function

// Astroblast pattern with callbacks
callback function frameSync(): void
    frameCounter += 1
    readHardwareCollisions()
    updateExplosionAnimations()
end function

// These should parse correctly and generate proper AST
```

**Compiler Pipeline Ready:**
When this implementation is complete:
- Lexer produces correct tokens for callback functions and types
- Parser generates accurate AST with callback information
- AST provides foundation for semantic analysis
- Ready for backend implementation (function address resolution, etc.)

---

## Timeline Estimate

**Phase 1**: ✅ COMPLETED (Language Specification)
**Phase 2**: 3-4 hours (Lexer Implementation)
**Phase 3**: 4-6 hours (AST Extensions)
**Phase 4**: 8-12 hours (Parser Implementation)
**Phase 5**: 6-8 hours (Testing and Validation)
**Phase 6**: 4-6 hours (Documentation)

**Total Estimated Time**: 25-36 hours (1-1.5 weeks of focused work)

**Dependencies**: None (can proceed immediately)
**Blockers**: None identified
**Risk Level**: LOW (well-defined, incremental changes)

---

## Post-Implementation Next Steps

After callback language support is complete:

1. **Semantic Analysis**: Add validation for callback function usage and assignment
2. **IL Generation**: Design callback function IL representation with address resolution
3. **Code Generation**: Implement 6502 function address generation and indirect calls
4. **Library Implementation**: Create `c64.interrupts` module with callback parameters
5. **Hardware Testing**: Validate callback-based interrupts on real 6502 systems

This implementation provides the foundation for all future callback-related work in Blend65, enabling:
- Hardware-intensive games (Bubble Escape, Astroblast)
- AI-driven games (Elite-style simulations)
- Menu-driven games (adventure games, RPGs)
- State machine games (complex interactive systems)

The callback system unifies all these patterns with a single, simple language feature.
