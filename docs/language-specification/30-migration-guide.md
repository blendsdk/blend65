# Migration Guide: Newline-Based to Semicolon-Based Syntax

> **Status**: Lexer-Derived Specification  
> **Last Updated**: January 8, 2026  
> **Related Documents**: [Lexical Structure](01-lexical-structure.md), [Expressions & Statements](06-expressions-statements.md)

## Breaking Change

**Blend65 now requires semicolons** (`;`) to separate statements, replacing the previous newline-based approach.

## Why This Change?

### 1. Familiarity

Semicolons align with C/C++/Java/JavaScript syntax, familiar to most programmers.

### 2. Multi-line Flexibility

Expressions and statements can naturally span multiple lines without special handling:

```js
let result: word =
  calculateBaseAddress() +
  getOffset() +
  getFinalValue();
```

### 3. Simplicity

Removes parser complexity around optional vs. required newlines. The lexer simply skips all whitespace (including newlines), and the parser uses semicolons for statement boundaries.

### 4. Clarity

Explicit statement boundaries are clearer than implicit newline rules.

## Migration Steps

**Simple find-and-replace approach:**

1. **Add `;` after every statement** (variable declarations, assignments, `return`, `break`, `continue`, etc.)
2. **Do NOT add `;` after declarations** (`module`, `import`, `export function`, `enum`, `type`)
3. **Do NOT add `;` after control flow blocks** (`end if`, `end while`, `end for`, `end match`, `end function`, `end enum`)

## Before and After Examples

### Variable Declarations

**Before (newline-based):**
```js
@zp let x: byte = 5
@ram let y: word = 10
const MAX: byte = 255
```

**After (semicolon-based):**
```js
@zp let x: byte = 5;
@ram let y: word = 10;
const MAX: byte = 255;
```

### Statements in Functions

**Before:**
```js
function update(): void
  snakeX = snakeX + 1
  snakeY = snakeY - 1
  if snakeX > 320 then
    snakeX = 0
  end if
end function
```

**After:**
```js
function update(): void
  snakeX = snakeX + 1;
  snakeY = snakeY - 1;
  if snakeX > 320 then
    snakeX = 0;
  end if
end function
```

### Module and Import Declarations (NO SEMICOLONS)

**Before:**
```js
module Game.Main
import clearScreen from c64.graphics
```

**After (unchanged):**
```js
module Game.Main
import clearScreen from c64.graphics
```

### Return Statements

**Before:**
```js
function getScore(): word
  return score
end function
```

**After:**
```js
function getScore(): word
  return score;
end function
```

### Break and Continue

**Before:**
```js
for i = 0 to 10
  if i == 5 then
    break
  end if
  if i == 3 then
    continue
  end if
next i
```

**After:**
```js
for i = 0 to 10
  if i == 5 then
    break;
  end if
  if i == 3 then
    continue;
  end if
next i
```

## What Requires Semicolons

### ✅ Statements (require `;`)

- **Variable declarations**: `let x: byte = 5;`
- **Assignments**: `x = 10;`
- **Function calls**: `clearScreen();`
- **Return statements**: `return value;`
- **Break**: `break;`
- **Continue**: `continue;`

### ❌ Declarations (NO `;`)

- **Module**: `module Game.Main`
- **Import**: `import foo from bar`
- **Export + function**: `export function main(): void`
- **Function**: `function name(): void` ... `end function`
- **Enum**: `enum State` ... `end enum`
- **Type**: `type Alias = byte`

### ❌ Control Flow (NO `;`)

- **If**: `if ... end if`
- **While**: `while ... end while`
- **For**: `for ... next`
- **Match**: `match ... end match`

## Complete Example Migration

### Before (Old Syntax)

```js
module Game.Snake

@zp let playerX: byte = 10
@zp let playerY: byte = 10
let score: word = 0

enum Direction
  UP, DOWN, LEFT, RIGHT
end enum

function updatePlayer(): void
  playerX += 1
  
  if playerX > 40 then
    playerX = 0
  end if
  
  score += 10
end function

export function main(): void
  updatePlayer()
end function
```

### After (New Syntax)

```js
module Game.Snake

@zp let playerX: byte = 10;
@zp let playerY: byte = 10;
let score: word = 0;

enum Direction
  UP, DOWN, LEFT, RIGHT
end enum

function updatePlayer(): void
  playerX += 1;
  
  if playerX > 40 then
    playerX = 0;
  end if
  
  score += 10;
end function

export function main(): void
  updatePlayer();
end function
```

## Error Messages

Missing semicolons will produce clear error messages:

```
Parse error at line 5, column 20: Expected semicolon after statement
```

## Benefits of New Syntax

### 1. Multi-line Expressions Work Naturally

**Old syntax (awkward):**
```js
let result: word = calculateBaseAddress() + getOffset() + getFinalValue()
```

**New syntax (clean):**
```js
let result: word =
  calculateBaseAddress() +
  getOffset() +
  getFinalValue();
```

### 2. No Ambiguity About Statement Boundaries

**New syntax allows multiple statements per line (if needed):**
```js
x = 5; y = 10; z = 15;
```

### 3. Cleaner Separation of Concerns

- **Lexer**: Tokenize everything, skip whitespace (including newlines)
- **Parser**: Use semicolons for statement separation

### 4. Familiar to Most Developers

Developers coming from C, C++, Java, JavaScript, Rust, etc. will find the syntax familiar.

## Common Migration Mistakes

### Mistake 1: Adding Semicolons to Declarations

**❌ WRONG:**
```js
module Game.Main;
import foo from bar;
export function main(): void;
```

**✅ CORRECT:**
```js
module Game.Main
import foo from bar
export function main(): void
```

### Mistake 2: Adding Semicolons After `end` Keywords

**❌ WRONG:**
```js
function update(): void
  x = 10;
end function;
```

**✅ CORRECT:**
```js
function update(): void
  x = 10;
end function
```

### Mistake 3: Forgetting Semicolons on Statements

**❌ WRONG:**
```js
function update(): void
  x = 10
  y = 20
end function
```

**✅ CORRECT:**
```js
function update(): void
  x = 10;
  y = 20;
end function
```

## Automated Migration

### Using Find and Replace

You can use regex find-and-replace in your editor:

**Pattern 1: Variable declarations**
- Find: `^(\s*)(let|const|@\w+\s+let|@\w+\s+const)(.+)$`
- Replace: `$1$2$3;`

**Pattern 2: Simple statements (assignments, function calls)**
- Find: `^(\s+)([a-zA-Z_][a-zA-Z0-9_]*\s*[=\(])(.+)$`
- Replace: `$1$2$3;`

**Note**: Automated replacement may require manual review for edge cases.

## Testing After Migration

1. **Run the lexer** to catch obvious syntax errors
2. **Run the parser** to ensure structure is correct
3. **Review control flow** to ensure `end` keywords don't have semicolons
4. **Check declarations** to ensure module/import/export don't have semicolons

## Quick Reference Card

| Construct | Old | New |
|-----------|-----|-----|
| Variable | `let x: byte = 10` | `let x: byte = 10;` |
| Assignment | `x = 20` | `x = 20;` |
| Function call | `clearScreen()` | `clearScreen();` |
| Return | `return value` | `return value;` |
| Break | `break` | `break;` |
| Continue | `continue` | `continue;` |
| Module | `module Main` | `module Main` |
| Import | `import foo from bar` | `import foo from bar` |
| Function decl | `function f(): void` | `function f(): void` |
| End function | `end function` | `end function` |
| If | `if x then ... end if` | `if x then ... end if` |
| While | `while x ... end while` | `while x ... end while` |
| For | `for i=0 to 10 ... next i` | `for i=0 to 10 ... next i` |

## See Also

- [Lexical Structure](01-lexical-structure.md) - Token definitions and syntax
- [Expressions & Statements](06-expressions-statements.md) - Statement termination rules
- [Program Structure](03-program-structure.md) - Top-level declarations
