# Part 1: Overview & Architecture

> **Document**: 00-overview.md
> **Phase Coverage**: All phases overview
> **Status**: Complete

## Executive Summary

This plan covers the comprehensive refactor of Blend65's syntax from VB/Pascal-style to C/TypeScript-style. The refactor is divided into **6 major phases** across **multiple implementation sessions**.

## Confirmed Design Decisions

| Feature | Decision | Rationale |
|---------|----------|-----------|
| Block delimiters | `{ }` curly braces | Modern, familiar, IDE-friendly |
| Condition parentheses | Required: `if (cond)` | Clear, unambiguous, C-family standard |
| Single-line statements | Braces always required | Prevents bugs, consistent |
| For loops | `for (i = start to end)` with optional `step`/`downto` | Simple, 6502-efficient |
| For loop types | Auto-infer byte/word, explicit `let i: type` supported | Automatic optimization |
| Else-if | `else if` (two keywords) | C-family standard |
| Switch/Match | Use `switch` keyword | Honest naming (not pattern matching) |
| Ternary operator | Yes: `cond ? a : b` | Useful, standard |
| Do-while loop | Yes: `do { } while (cond);` | Common pattern in 6502 |
| Module declaration | `module Name;` (with semicolon) | Consistent statement termination |
| Imports | `import { A, B } from Module;` | TypeScript-style, clear grouping |
| Function bodies | `function f() { }` | C-family standard |
| Stub functions | `function f();` (unchanged) | Already correct |
| Enums | `enum E { }` | C-family standard |
| @map struct | `@map x type { }` and `layout { }` | Consistent with blocks |
| 16-bit loop counters | Auto-infer when range > 255 | Critical for 6502 |
| Overflow detection | Semantic analyzer checks bounds | Catch bugs at compile time |

---

## Complete Syntax Specification

### Module & Imports

```js
// Module declaration (with semicolon)
module Snake.GameState;

// Imports with curly braces and semicolon
import { SpriteData, Color } from Hardware;
import { Input } from System;
```

### Variable Declarations

```js
// Standard variables
let counter: byte = 0;
const MAX: byte = 255;

// Storage class variables
@zp let fastCounter: byte = 0;
@ram let buffer: byte[256];
@data let message: string = "Hello";

// Exported variables
export let score: word = 0;
```

### Type Aliases

```js
type SpriteId = byte;
type Color = byte;
```

### Enums

```js
enum GameState {
  INIT = 0,
  PLAYING = 1,
  GAME_OVER = 2
}

enum Direction {
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3
}
```

### Memory-Mapped Variables

```js
// Simple @map
@map borderColor at $D020: byte;
@map backgroundColor at $D021: byte;

// Range @map
@map spritePointers from $07F8 to $07FF: byte;

// @map with type (sequential struct)
@map sid at $D400 type {
  freqLo: byte,
  freqHi: byte,
  pwLo: byte,
  pwHi: byte,
  control: byte
}

// @map with layout (explicit addresses)
@map vic at $D000 layout {
  sprite0X: at $D000: byte,
  sprite0Y: at $D001: byte,
  borderColor: at $D020: byte
}
```

### Functions

```js
// Regular function
function add(a: byte, b: byte): byte {
  return a + b;
}

// Exported function
export function main(): void {
  init();
  gameLoop();
}

// Callback function (for interrupts)
callback function rasterIRQ(): void {
  frameCounter += 1;
}

// Stub function (intrinsic)
function peek(address: word): byte;
function poke(address: word, value: byte): void;
```

### Control Flow: If Statement

```js
// Simple if
if (x > 0) {
  doSomething();
}

// If-else
if (gameState == GameState.PLAYING) {
  updateGame();
} else {
  showMenu();
}

// If-else if-else chain (else if = two keywords)
if (direction == Direction.UP) {
  y = y - 1;
} else if (direction == Direction.DOWN) {
  y = y + 1;
} else if (direction == Direction.LEFT) {
  x = x - 1;
} else {
  x = x + 1;
}
```

### Control Flow: Loops

```js
// While loop
while (running) {
  update();
}

// Do-while loop (NEW)
do {
  processFrame();
} while (!gameOver);

// For-to loop (count up)
for (i = 0 to 255) {
  buffer[i] = 0;
}

// For-downto loop (count down - efficient on 6502)
for (i = 255 downto 0) {
  buffer[i] = 0;
}

// For loop with step
for (i = 0 to 254 step 2) {
  processEven(i);
}

// For loop with explicit type (16-bit)
for (let i: word = 0 to 5000) {
  largeBuffer[i] = 0;
}
```

### Control Flow: Switch

```js
switch (direction) {
  case Direction.UP:
    moveUp();
    break;
  case Direction.DOWN:
    moveDown();
    break;
  case Direction.LEFT:
  case Direction.RIGHT:   // Fall-through
    handleHorizontal();
    break;
  default:
    // nothing
}
```

### Expressions

```js
// Ternary operator (NEW)
let max = (a > b) ? a : b;
let abs = (x < 0) ? -x : x;

// Standard expressions (unchanged)
let sum = a + b * c;
let result = getValue() + 10;
let isValid = (x > 0) && (y > 0);
```

---

## Phase Architecture

### Phase 1: Lexer Changes
**Estimated Sessions**: 1-2

**New Tokens:**
- `LEFT_BRACE` `{` (verify exists)
- `RIGHT_BRACE` `}` (verify exists)
- `DOWNTO` keyword
- `STEP` keyword
- `DO` keyword
- `SWITCH` keyword
- `QUESTION` `?` (for ternary)

**Tokens to Remove:**
- `END` keyword
- `THEN` keyword
- `NEXT` keyword
- `MATCH` keyword (replace with SWITCH)
- `ELSEIF` keyword

### Phase 2: Parser Changes
**Estimated Sessions**: 3-6

**Methods to Rewrite:**
- `parseIfStatement()` - Remove `then`, `end if`, use `{ }`
- `parseWhileStatement()` - Remove `end while`, use `{ }`
- `parseForStatement()` - Remove `next i`, add `step`/`downto`, use `{ }`
- `parseMatchStatement()` → `parseSwitchStatement()` - Use `{ }`
- `parseFunctionDecl()` - Remove `end function`, use `{ }`
- `parseEnumDecl()` - Remove `end enum`, use `{ }`
- `parseSequentialStructMapDecl()` - Remove `end @map`, use `{ }`
- `parseExplicitStructMapDecl()` - Remove `end @map`, use `{ }`
- `parseModuleDecl()` - Add semicolon
- `parseImportDecl()` - Add curly braces, semicolon

**New Methods:**
- `parseDoWhileStatement()` - New statement type
- `parseTernaryExpression()` - Ternary operator

### Phase 3: AST Changes
**Estimated Sessions**: 1

**ForStatement updates:**
```typescript
class ForStatement {
  variable: string;
  variableType: TypeAnnotation | null;  // For explicit `let i: word`
  start: Expression;
  end: Expression;
  direction: 'to' | 'downto';           // NEW
  step: Expression | null;               // NEW
  body: Statement[];
}
```

**New nodes:**
- `DoWhileStatement`
- `TernaryExpression`

### Phase 4: Semantic Analyzer Changes
**Estimated Sessions**: 2

**Loop Analysis:**
- Detect loop bounds overflow
- Infer counter type (byte vs word)
- Generate warnings for 16-bit loops

**Type Checking:**
- Ternary expression type checking
- Do-while condition checking

### Phase 5: Code Generation Changes
**Estimated Sessions**: 2

**For Loop Updates:**
- 8-bit counter code generation
- 16-bit counter code generation
- Step value handling
- Downto direction handling

**New Patterns:**
- Do-while loop code generation
- Ternary expression code generation

### Phase 6: Documentation & Tests
**Estimated Sessions**: 3-4

**Language Specification:**
- Update all 13 spec documents
- Rewrite EBNF grammar sections
- Update all code examples

**Tests:**
- Update ~130 test files
- Add new tests for new features
- End-to-end testing

**Examples:**
- Convert 13 .blend files

---

## Implementation Order

1. **Phase 1** (Lexer) must be complete before Phase 2 can start
2. **Phase 2** (Parser) must be complete before Phase 3 can start
3. **Phase 3** (AST) can partially overlap with Phase 2
4. **Phase 4** (Semantic) depends on Phase 3 completion
5. **Phase 5** (CodeGen) depends on Phase 4 completion
6. **Phase 6** (Docs) can start once Phase 2 is stable

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing tests | High | High | Phase tests methodically, fix incrementally |
| Parser complexity | Medium | Medium | Follow existing inheritance chain pattern |
| 16-bit loop codegen | Medium | High | Design carefully before implementing |
| Spec/code mismatch | Low | Medium | Update spec alongside implementation |

---

## Success Criteria (Overall)

- [ ] All syntax changes implemented
- [ ] All tests pass
- [ ] Language specification updated
- [ ] All example files converted
- [ ] 16-bit loop support working
- [ ] Overflow detection working
- [ ] End-to-end tests pass

---

## Next Document

Proceed to [01-lexer-parser.md](01-lexer-parser.md) for detailed Phase 1 & 2 tasks.