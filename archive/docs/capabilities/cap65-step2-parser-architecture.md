# Step 2: Parser Architecture Analysis

**Status**: In Progress
**Part of**: cap65 Comprehensive Analysis
**Date**: December 1, 2026

## What This Step Covers

Focus ONLY on parser architecture - the inheritance chain design and how parsing layers work together.

## Inheritance Chain Architecture

The Blend65 parser uses a sophisticated **inheritance chain architecture** to manage complexity and enable AI-friendly development:

```
BaseParser
    ↓ extends
ExpressionParser
    ↓ extends
DeclarationParser
    ↓ extends
ModuleParser
    ↓ extends
StatementParser
    ↓ extends
Parser (final concrete class)
```

### Why This Architecture?

1. **AI Context Window Management**: Each layer fits within AI context limits (200-500 lines)
2. **Clean Separation of Concerns**: Each layer handles one primary responsibility
3. **Natural Dependencies**: Upper layers can use everything below them
4. **Easy Extension**: New features add to appropriate layer without touching others

## Layer-by-Layer Breakdown

### Layer 1: BaseParser (Foundation)

**File**: `packages/compiler/src/parser/base.ts`
**Responsibility**: Core parsing infrastructure

```js
// Token stream management
getCurrentToken() -> Token
peek(offset) -> Token
advance() -> Token
isAtEnd() -> boolean

// Token checking & consuming
check(...types) -> boolean
match(...types) -> boolean
expect(type, message) -> Token

// Error handling & recovery
reportError(code, message)
reportWarning(code, message)
synchronize()

// Module scope validation
validateModuleDeclaration()
validateModuleScopeItem(token)
enterFunctionScope()
exitFunctionScope()

// Utility helpers
createLocation(start, end) -> SourceLocation
mergeLocations(start, end) -> SourceLocation
expectSemicolon(message)
parseStorageClass() -> TokenType
parseExportModifier() -> boolean
```

**Key Features**:

- Token stream navigation with safe EOF handling
- Comprehensive error collection (not just first error)
- Module scope enforcement (only declarations at top level)
- Parser configuration support (continueOnError, maxErrors, etc.)

### Layer 2: ExpressionParser (Pratt Parser)

**File**: `packages/compiler/src/parser/expressions.ts`
**Responsibility**: All expression parsing using Pratt algorithm

```js
// Main expression parsing
parseExpression(minPrecedence) -> Expression

// Pratt parser infrastructure
getCurrentPrecedence() -> number
isBinaryOp() -> boolean
isRightAssoc(tokenType) -> boolean

// Expression type parsing
parseUnaryExpression() -> Expression
parsePostfixExpression() -> Expression
parseAtomicExpression() -> Expression

// Postfix operations (SPECIFICATION COMPLIANT)
parseCallExpression(callee) -> CallExpression
parseMemberExpression(object) -> MemberExpression
parseIndexExpression(array) -> IndexExpression

// Validation helpers
isValidLValue(expr) -> boolean
isAssignmentOperator(tokenType) -> boolean
```

**Key Features**:

- **Complete Pratt Parser**: Handles ALL operator precedence automatically
- **Specification Compliance**: Only allows documented Blend65 patterns
- **Error Recovery**: Never crashes, always returns valid AST with diagnostics
- **Comprehensive Operators**: 13 precedence levels, right/left associativity

**Expression Types Supported**:

```js
// Literals
42, $D000, 0xFF, 0b1010, "hello", true

// Identifiers
counter, playerX, gameState

// Unary expressions (right-to-left)
!flag, ~mask, -value, +number, @variable

// Binary expressions (all operators with correct precedence)
x + y * z    // Parses as: x + (y * z)
a = b = c    // Parses as: a = (b = c) [right-associative]

// Postfix expressions (highest precedence)
func()              // Function calls
array[index]        // Array indexing
vic.borderColor     // @map member access (ONLY)

// Assignment expressions (lowest precedence)
x = value, x += 1, x <<= 2
```

### Layer 3: DeclarationParser (Declarations)

**File**: `packages/compiler/src/parser/declarations.ts`
**Responsibility**: Variable and @map declarations

```js
// Variable declarations
parseVariableDecl() -> VariableDecl

// @map declaration dispatcher
parseMapDeclaration() -> Declaration

// @map forms (all 4 supported)
parseSimpleMapDecl(startToken, name, address) -> SimpleMapDecl
parseRangeMapDecl(startToken, name) -> RangeMapDecl
parseSequentialStructMapDecl(startToken, name, baseAddress) -> SequentialStructMapDecl
parseExplicitStructMapDecl(startToken, name, baseAddress) -> ExplicitStructMapDecl
```

**Declaration Examples**:

```js
// Variable declarations with all features
export @zp let counter: byte = 0;
@ram const buffer: byte[256] = [0, 1, 2];
let gameState: word;

// Simple @map (single register)
@map borderColor at $D020: byte;
@map irqVector at $FFFE: word;

// Range @map (memory block)
@map sprites from $D000 to $D02E: byte;
@map colorRAM from $D800 to $DBE7: byte;

// Sequential struct @map (automatic layout)
@map sid at $D400 type
  voice1Freq: word,
  voice1Control: byte,
  voice1Attack: byte
end @map

// Explicit struct @map (manual layout)
@map vic at $D000 layout
  sprites: from $D000 to $D00F: byte,
  borderColor: at $D020: byte,
  backgroundColor: at $D021: byte
end @map
```

### Layer 4: ModuleParser (Module System)

**File**: `packages/compiler/src/parser/modules.ts`
**Responsibility**: Module, import, export declarations

```js
// Module declarations
parseModuleDecl() -> ModuleDecl
createImplicitGlobalModule() -> ModuleDecl

// Import/export system
parseImportDecl() -> ImportDecl
parseExportDecl() -> Declaration

// Export context management
setExportContext(inExport)
getExportContext() -> boolean
```

**Module System Examples**:

```js
// Explicit module declaration
module Game.Snake.Player

// Implicit global module (when no module declared)
// Automatically creates "module global"

// Import declarations
import clearScreen from c64.graphics;
import setPixel, drawLine from c64.graphics.primitives;

// Export declarations (sets flag on wrapped declaration)
export function main(): void
export const MAX_SPRITES: byte = 8;
export @zp let frameCounter: byte = 0;
```

### Layer 5: StatementParser (Statements)

**File**: `packages/compiler/src/parser/statements.ts`
**Responsibility**: All statement types and control flow

```js
// Statement dispatcher
parseStatement() -> Statement

// Block statements
parseBlockStatement() -> BlockStatement

// Expression statements
parseExpressionStatement() -> ExpressionStatement

// Control flow statements
parseIfStatement() -> IfStatement
parseWhileStatement() -> WhileStatement
parseForStatement() -> ForStatement
parseMatchStatement() -> MatchStatement
parseReturnStatement() -> ReturnStatement
parseBreakStatement() -> BreakStatement
parseContinueStatement() -> ContinueStatement

// Function-local variable declarations (NEW - Phase 4)
parseLocalVariableDeclaration() -> Statement

// Loop context tracking (for break/continue validation)
loopNestingLevel: number
```

**Control Flow Examples**:

```js
// If statements (specification-compliant)
if playerX > screenWidth then
  playerX = 0;
  wrapSound();
else
  movePlayer();
end if

// While loops
while gameRunning
  handleInput();
  updateGame();
  renderFrame();
end while

// For loops (C64-style counting)
for i = 0 to 7
  sprites[i] = spriteData[i];
next i

// Match statements (pattern matching)
match gameState
  case 0: initializeGame();
  case 1: runGameLoop();
  case 2: showGameOver();
  default: resetGame();
end match

// Block statements
{
  let temp: byte = x;
  x = y;
  y = temp;
}

// Expression statements
clearScreen();
vic.borderColor = randomColor();
buffer[offset] = value;
```

### Layer 6: Parser (Final Concrete)

**File**: `packages/compiler/src/parser/parser.ts`
**Responsibility**: Main entry point and function declarations

```js
// Main entry point
parse() -> Program

// Function declarations (Phase 4)
parseFunctionDecl() -> Declaration
parseParameterList() -> Parameter[]
parseFunctionBody() -> Statement[]

// Function scope management
enterFunctionScopeWithParams(parameters, returnType)
exitFunctionScopeWithCleanup()
addLocalVariable(name, type, location)
lookupVariable(name) -> string | null

// Statement validation in function context
isVariableDeclarationStatement(statement) -> boolean
handleLocalVariableDeclaration(statement)
validateReturnStatement(statement)
validateBreakContinueInContext(statement)
```

**Complete Function Examples**:

```js
// Simple function
function clearScreen(): void
  fillMemory($0400, 32, 1000);
end function

// Function with parameters
function setPixel(x: byte, y: byte, color: byte): void
  let offset: word = y * 40 + x;
  screen[offset] = color;
end function

// Callback function (interrupt handler)
callback function rasterIRQ(): void
  vic.borderColor = frameCounter;
  frameCounter += 1;
end function

// Main function (auto-exported)
function main(): void
  initializeGraphics();
  setupInterrupts();

  while true
    waitForFrame();
    updateGame();
  end while
end function
```

## Architecture Benefits

### 1. AI-Friendly Development

- **Each layer fits in AI context window** (200-500 lines)
- **Clear separation** makes modifications safe
- **Natural dependencies** prevent circular imports
- **Incremental complexity** builds from simple to complex

### 2. Specification Compliance

- **BaseParser** enforces module ordering rules
- **ExpressionParser** implements ONLY documented operators/precedence
- **DeclarationParser** supports all 4 @map forms exactly as specified
- **Parser** validates function signatures and scope rules

### 3. Error Recovery

- **Never crashes** - always returns valid AST with diagnostics
- **Comprehensive error collection** (not just first error)
- **Synchronization points** for panic-mode recovery
- **Context-aware messages** (different errors at module vs function scope)

### 4. Real-World C64 Usage

```js
// Complete working C64 program structure
module Game.Snake

@zp let snakeX: byte[32] = [120, 119, 118];
@zp let snakeY: byte[32] = [120, 120, 120];
@ram let gameScore: word = 0;

@map vic at $D000 layout
  sprites: from $D000 to $D00F: byte,
  borderColor: at $D020: byte
end @map

function main(): void
  initializeGame();

  while !gameOver()
    handleInput();
    moveSnake();
    checkCollisions();
    renderFrame();
  end while

  showFinalScore();
end function
```

## What This Architecture CANNOT Do Yet

- ❌ **Type checking**: Syntax only, no semantic analysis
- ❌ **Code generation**: No 6502 assembly output
- ❌ **Optimization**: No dead code elimination or constant folding
- ❌ **Linking**: No multi-file compilation
- ❌ **Macros**: No preprocessor or macro expansion

## Next Steps

This completes Step 2. The parser architecture provides a solid foundation that can parse ALL documented Blend65 syntax with excellent error recovery and specification compliance.

**Ready for**: Step 3 - Expression Parsing Analysis
