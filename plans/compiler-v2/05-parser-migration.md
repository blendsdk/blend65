# Parser Migration: Compiler v2

> **Document**: 05-parser-migration.md  
> **Parent**: [Index](00-index.md)  
> **Status**: Planning Complete

## Overview

The parser converts a token stream into an Abstract Syntax Tree (AST). The v1 parser uses an inheritance chain architecture (Pratt parser for expressions), which we'll preserve in v2 with minimal changes.

## Migration Strategy

**Reuse**: 85%

**Changes Required**:
1. Remove @map declaration parsing
2. Remove @map AST node creation
3. Update tests to remove @map test cases
4. Ensure all v2 syntax is supported

## Inheritance Chain

The parser uses a layered inheritance chain. **Maintain this structure in v2**:

```
ParserBase              (base.ts)
    ↓                   Core utilities: advance, peek, expect, error recovery
ExpressionParser        (expressions.ts)
    ↓                   Pratt parser for expressions
StatementParser         (statements.ts)
    ↓                   if, while, for, return, etc.
DeclarationParser       (declarations.ts)
    ↓                   function, let, const - REMOVE @map HERE
ModuleParser            (modules.ts)
    ↓                   module, import, export
Parser                  (parser.ts)
                        Final concrete class, entry point
```

---

## Source Files

### Files to Copy

| v1 File | v2 File | Changes |
|---------|---------|---------|
| `parser/base.ts` | `parser/base.ts` | No changes |
| `parser/expressions.ts` | `parser/expressions.ts` | No changes |
| `parser/statements.ts` | `parser/statements.ts` | No changes |
| `parser/declarations.ts` | `parser/declarations.ts` | **Remove @map** |
| `parser/modules.ts` | `parser/modules.ts` | No changes |
| `parser/parser.ts` | `parser/parser.ts` | Minor updates |
| `parser/precedence.ts` | `parser/precedence.ts` | No changes |
| `parser/scope-manager.ts` | `parser/scope-manager.ts` | No changes |
| `parser/config.ts` | `parser/config.ts` | No changes |
| `parser/error-messages.ts` | `parser/error-messages.ts` | Update messages |
| `parser/index.ts` | `parser/index.ts` | No changes |

---

## Key Changes

### 1. Remove @map from DeclarationParser

**In declarations.ts**, remove the `parseMapDeclaration()` method:

```typescript
// REMOVE this entire method:
protected parseMapDeclaration(): MapDeclaration {
  // ... @map parsing logic ...
}

// REMOVE from declaration dispatch:
protected parseDeclaration(): Declaration {
  // Remove this case:
  // if (this.check(TokenType.AT_MAP)) {
  //   return this.parseMapDeclaration();
  // }
  
  // Keep these:
  if (this.check(TokenType.FUNCTION) || 
      (this.check(TokenType.EXPORT) && this.checkNext(TokenType.FUNCTION))) {
    return this.parseFunctionDeclaration();
  }
  
  if (this.check(TokenType.LET) || this.check(TokenType.CONST) ||
      this.isStorageClass()) {
    return this.parseVariableDeclaration();
  }
  
  // ...
}
```

### 2. Update AST Node Imports

Remove any imports of MapDeclaration:

```typescript
// Remove:
// import { MapDeclaration } from '../ast/nodes.js';

// Keep all other imports
import { 
  VariableDeclaration, 
  FunctionDeclaration,
  // ... other nodes
} from '../ast/nodes.js';
```

### 3. Update Storage Class Handling

Storage classes remain for variable declarations:

```typescript
protected parseVariableDeclaration(): VariableDeclaration {
  // Check for storage class: @zp, @ram, @data
  let storageClass: StorageClass | undefined;
  
  if (this.check(TokenType.AT_ZP)) {
    storageClass = StorageClass.ZP;
    this.advance();
  } else if (this.check(TokenType.AT_RAM)) {
    storageClass = StorageClass.RAM;
    this.advance();
  } else if (this.check(TokenType.AT_DATA)) {
    storageClass = StorageClass.DATA;
    this.advance();
  }
  
  // Continue with let/const parsing...
  const isConst = this.check(TokenType.CONST);
  this.expect(isConst ? TokenType.CONST : TokenType.LET);
  
  // ... rest of variable parsing
}
```

---

## Grammar Summary (v2)

### Declarations

```ebnf
declaration     = functionDecl | variableDecl ;
functionDecl    = ["export"] "function" IDENTIFIER "(" params? ")" ":" type block ;
variableDecl    = [storageClass] ("let" | "const") IDENTIFIER ":" type ["=" expr] ";" ;
storageClass    = "@zp" | "@ram" | "@data" ;
```

### Statements

```ebnf
statement       = block | ifStmt | whileStmt | forStmt | returnStmt 
                | breakStmt | continueStmt | exprStmt ;
block           = "{" statement* "}" ;
ifStmt          = "if" "(" expr ")" statement ["else" statement] ;
whileStmt       = "while" "(" expr ")" statement ;
forStmt         = "for" "(" varDecl? ";" expr? ";" expr? ")" statement ;
returnStmt      = "return" expr? ";" ;
breakStmt       = "break" ";" ;
continueStmt    = "continue" ";" ;
exprStmt        = expr ";" ;
```

### Expressions (Pratt Parser)

```ebnf
expression      = assignment ;
assignment      = ternary ( "=" | "+=" | "-=" | "*=" | "/=" ) assignment
                | ternary ;
ternary         = logicalOr ( "?" expression ":" ternary )? ;
logicalOr       = logicalAnd ( "||" logicalAnd )* ;
logicalAnd      = bitwiseOr ( "&&" bitwiseOr )* ;
bitwiseOr       = bitwiseXor ( "|" bitwiseXor )* ;
bitwiseXor      = bitwiseAnd ( "^" bitwiseAnd )* ;
bitwiseAnd      = equality ( "&" equality )* ;
equality        = comparison ( ( "==" | "!=" ) comparison )* ;
comparison      = shift ( ( "<" | ">" | "<=" | ">=" ) shift )* ;
shift           = term ( ( "<<" | ">>" ) term )* ;
term            = factor ( ( "+" | "-" ) factor )* ;
factor          = unary ( ( "*" | "/" | "%" ) unary )* ;
unary           = ( "!" | "-" | "~" ) unary | postfix ;
postfix         = primary ( "[" expr "]" | "(" args? ")" | "." IDENTIFIER )* ;
primary         = NUMBER | STRING | "true" | "false" | IDENTIFIER | "(" expr ")" ;
```

---

## AST Migration

### AST Nodes to Keep

```typescript
// All expression nodes
LiteralExpression       // Numbers, strings, booleans
IdentifierExpression    // Variable references
BinaryExpression        // a + b, a && b, etc.
UnaryExpression         // !a, -a, ~a
CallExpression          // func(args)
IndexExpression         // arr[i]
MemberExpression        // obj.field
TernaryExpression       // a ? b : c
AssignmentExpression    // a = b, a += b

// All statement nodes
BlockStatement
IfStatement
WhileStatement
ForStatement
ReturnStatement
BreakStatement
ContinueStatement
ExpressionStatement

// Declaration nodes
VariableDeclaration     // let x: byte = 0
FunctionDeclaration     // function foo(): void { }
ModuleDeclaration       // module Name;
ImportDeclaration       // import { x } from "module"
ExportDeclaration       // Handled via flag on other declarations
```

### AST Nodes to Remove

```typescript
// Remove this node:
MapDeclaration          // @map name at addr: type (v1 only)
```

---

## Migration Tasks

### Session 3.1: Copy Parser Base

| # | Task | File | Description |
|---|------|------|-------------|
| 3.1.1 | Copy base.ts | `parser/base.ts` | Core parser utilities |
| 3.1.2 | Copy expressions.ts | `parser/expressions.ts` | Pratt parser |
| 3.1.3 | Copy statements.ts | `parser/statements.ts` | Statement parsing |
| 3.1.4 | Copy precedence.ts | `parser/precedence.ts` | Operator precedence |

### Session 3.2: Parser Updates

| # | Task | File | Description |
|---|------|------|-------------|
| 3.2.1 | Copy declarations.ts | `parser/declarations.ts` | Declaration parsing |
| 3.2.2 | Remove @map parsing | `parser/declarations.ts` | Delete parseMapDeclaration |
| 3.2.3 | Copy modules.ts | `parser/modules.ts` | Module parsing |
| 3.2.4 | Copy parser.ts | `parser/parser.ts` | Entry point |
| 3.2.5 | Create index.ts | `parser/index.ts` | Exports |
| 3.2.6 | Copy tests | `__tests__/parser/` | All parser tests |
| 3.2.7 | Remove @map tests | `__tests__/parser/` | Delete @map test cases |
| 3.2.8 | Run tests | - | Verify all pass |

---

## Test Categories

### Tests to Keep

- Expression parsing (all operators, precedence)
- Statement parsing (if, while, for, return, etc.)
- Function declarations
- Variable declarations with storage classes
- Module declarations (import, export)
- Error recovery tests
- Edge case tests

### Tests to Remove

- @map declaration parsing tests
- Any tests expecting MapDeclaration AST nodes

---

## Verification Checklist

After migration, verify:

- [ ] All expressions parse correctly
- [ ] Operator precedence is correct
- [ ] All statements parse correctly
- [ ] Function declarations work
- [ ] Variable declarations with @zp/@ram/@data work
- [ ] Module/import/export work
- [ ] @map is NOT recognized (causes parse error)
- [ ] Error recovery works
- [ ] All tests pass

---

## Example Parse Trees

### Valid v2 Code

```js
function add(a: byte, b: byte): byte {
  return a + b;
}
```

**AST**:
```
FunctionDeclaration
├── name: "add"
├── params: [
│   ├── Parameter(name: "a", type: byte)
│   └── Parameter(name: "b", type: byte)
│   ]
├── returnType: byte
└── body: BlockStatement
    └── ReturnStatement
        └── BinaryExpression
            ├── operator: +
            ├── left: IdentifierExpression("a")
            └── right: IdentifierExpression("b")
```

### Valid v2 Variable with Storage Class

```js
@zp let counter: byte = 0;
```

**AST**:
```
VariableDeclaration
├── name: "counter"
├── type: byte
├── storageClass: ZP
├── isConst: false
└── initializer: LiteralExpression(0)
```

---

## Related Documents

| Document | Description |
|----------|-------------|
| [04-lexer-migration.md](04-lexer-migration.md) | Lexer that feeds parser |
| [06-semantic-migration.md](06-semantic-migration.md) | Next: Semantic analysis |
| [99-execution-plan.md](99-execution-plan.md) | Full task list |