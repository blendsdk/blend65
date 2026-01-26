# Part 2: Lexer & Parser Tasks

> **Document**: 01-lexer-parser.md
> **Phase Coverage**: Phase 1 (Lexer) + Phase 2 (Parser)
> **Status**: Complete

---

## Phase 1: Lexer Changes

### Context

The lexer must be updated to recognize new tokens and remove obsolete keywords. This is the foundation for all subsequent parser changes.

### Dependencies

- None (first phase)

### Deliverables

- New tokens added: `DOWNTO`, `STEP`, `DO`, `SWITCH`, `QUESTION`
- Verify `LEFT_BRACE`, `RIGHT_BRACE` exist
- Obsolete keywords removed: `END`, `THEN`, `NEXT`, `ELSEIF`
- `MATCH` keyword renamed/replaced with `SWITCH`
- All lexer tests pass

---

### Phase 1 Tasks

#### Task 1.1: Verify Existing Brace Tokens

**Objective**: Confirm `LEFT_BRACE` and `RIGHT_BRACE` tokens exist in the lexer.

**Files to Check**:
- `packages/compiler/src/lexer/types.ts` - Token type definitions
- `packages/compiler/src/lexer/lexer.ts` - Token recognition

**Actions**:
1. Search for existing brace token definitions
2. If missing, add `LEFT_BRACE` and `RIGHT_BRACE` to TokenType enum
3. Add recognition logic to lexer

**Tests**:
- Unit: Tokenize `{` produces LEFT_BRACE
- Unit: Tokenize `}` produces RIGHT_BRACE
- Unit: Tokenize `{ }` produces correct sequence

---

#### Task 1.2: Add New Keywords

**Objective**: Add `DOWNTO`, `STEP`, `DO`, `SWITCH` keywords.

**Files to Modify**:
- `packages/compiler/src/lexer/types.ts` - Add to TokenType enum
- `packages/compiler/src/lexer/lexer.ts` - Add to keyword map

**New Keywords**:
```typescript
DOWNTO = 'downto',
STEP = 'step',
DO = 'do',
SWITCH = 'switch',
```

**Tests**:
- Unit: `downto` tokenizes as DOWNTO
- Unit: `step` tokenizes as STEP
- Unit: `do` tokenizes as DO
- Unit: `switch` tokenizes as SWITCH
- Unit: Keywords are case-sensitive

---

#### Task 1.3: Add Question Mark Token

**Objective**: Add `QUESTION` token for ternary operator.

**Files to Modify**:
- `packages/compiler/src/lexer/types.ts` - Add QUESTION to TokenType
- `packages/compiler/src/lexer/lexer.ts` - Add recognition for `?`

**Tests**:
- Unit: Tokenize `?` produces QUESTION
- Unit: Tokenize `a ? b : c` produces correct sequence

---

#### Task 1.4: Remove Obsolete Keywords

**Objective**: Remove `END`, `THEN`, `NEXT`, `ELSEIF` keywords.

**Files to Modify**:
- `packages/compiler/src/lexer/types.ts` - Remove from TokenType enum
- `packages/compiler/src/lexer/lexer.ts` - Remove from keyword map

**Strategy**:
- Comment out rather than delete initially (for rollback if needed)
- After parser changes complete, fully remove

**Tests**:
- Unit: `end` now tokenizes as IDENTIFIER (not keyword)
- Unit: `then` now tokenizes as IDENTIFIER (not keyword)
- Unit: `next` now tokenizes as IDENTIFIER (not keyword)
- Unit: `elseif` now tokenizes as IDENTIFIER (not keyword)

---

#### Task 1.5: Replace MATCH with SWITCH

**Objective**: Replace `MATCH` keyword with `SWITCH`.

**Files to Modify**:
- `packages/compiler/src/lexer/types.ts` - Rename MATCH to SWITCH
- `packages/compiler/src/lexer/lexer.ts` - Update keyword map

**Tests**:
- Unit: `switch` tokenizes as SWITCH
- Unit: `match` now tokenizes as IDENTIFIER

---

#### Task 1.6: Update Lexer Tests

**Objective**: Update all lexer tests for new token set.

**Files to Modify**:
- `packages/compiler/src/__tests__/lexer/lexer.test.ts`
- `packages/compiler/src/__tests__/lexer/lexer-edge-cases.test.ts`
- All other lexer test files

**Actions**:
1. Add tests for new tokens
2. Update tests that used obsolete keywords
3. Ensure full coverage

**Tests**:
- Complete keyword recognition test suite
- Complete operator recognition test suite
- Edge cases for all new tokens

---

## Phase 2: Parser Changes

### Context

The parser must be rewritten to use curly-brace syntax instead of VB/Pascal-style `end` keywords. This is the largest phase of the refactor.

### Dependencies

- Phase 1 complete (all new tokens available)

### Deliverables

- All control flow statements use `{ }` syntax
- Module declaration requires semicolon
- Import uses curly braces and semicolon
- New `do-while` statement implemented
- Ternary operator implemented
- `else if` works as two keywords
- All parser tests pass

---

### Phase 2 Tasks

#### Task 2.1: Update Module Declaration

**Objective**: Module declaration now requires semicolon.

**File**: `packages/compiler/src/parser/modules.ts`

**Change**:
```
// Before: module Snake.GameState
// After:  module Snake.GameState;
```

**Implementation**:
```typescript
protected parseModuleDecl(): ModuleDecl {
  const startToken = this.expect(TokenType.MODULE, "Expected 'module'");
  const name = this.parseDottedName();
  this.expectSemicolon('Expected semicolon after module declaration');
  // ...
}
```

**Tests**:
- Unit: `module Test;` parses correctly
- Unit: `module A.B.C;` parses correctly
- Error: `module Test` without semicolon reports error

---

#### Task 2.2: Update Import Declaration

**Objective**: Import uses curly braces and semicolon.

**File**: `packages/compiler/src/parser/modules.ts`

**Change**:
```
// Before: import A, B from Module
// After:  import { A, B } from Module;
```

**Implementation**:
```typescript
protected parseImportDecl(): ImportDecl {
  this.expect(TokenType.IMPORT, "Expected 'import'");
  this.expect(TokenType.LEFT_BRACE, "Expected '{' after 'import'");
  const imports = this.parseImportList();
  this.expect(TokenType.RIGHT_BRACE, "Expected '}' after import list");
  this.expect(TokenType.FROM, "Expected 'from'");
  const moduleName = this.parseDottedName();
  this.expectSemicolon('Expected semicolon after import declaration');
  // ...
}
```

**Tests**:
- Unit: `import { A } from B;` parses correctly
- Unit: `import { A, B, C } from D.E;` parses correctly
- Error: Missing `{` reports error
- Error: Missing `;` reports error

---

#### Task 2.3: Update If Statement

**Objective**: If statement uses curly braces, no `then` or `end if`.

**File**: `packages/compiler/src/parser/statements.ts`

**Change**:
```
// Before: if condition then ... end if
// After:  if (condition) { ... }
```

**Implementation**:
```typescript
protected parseIfStatement(): IfStatement {
  const startToken = this.expect(TokenType.IF, "Expected 'if'");
  
  // Require opening parenthesis
  this.expect(TokenType.LEFT_PAREN, "Expected '(' after 'if'");
  const condition = this.parseExpression();
  this.expect(TokenType.RIGHT_PAREN, "Expected ')' after condition");
  
  // Require opening brace
  this.expect(TokenType.LEFT_BRACE, "Expected '{' for if body");
  const thenBranch = this.parseStatementBlock([TokenType.RIGHT_BRACE]);
  this.expect(TokenType.RIGHT_BRACE, "Expected '}' to close if body");
  
  // Parse optional else/else if
  let elseBranch: Statement[] | null = null;
  if (this.match(TokenType.ELSE)) {
    if (this.check(TokenType.IF)) {
      // else if - parse as nested if inside else branch
      elseBranch = [this.parseIfStatement()];
    } else {
      // else - parse block
      this.expect(TokenType.LEFT_BRACE, "Expected '{' for else body");
      elseBranch = this.parseStatementBlock([TokenType.RIGHT_BRACE]);
      this.expect(TokenType.RIGHT_BRACE, "Expected '}' to close else body");
    }
  }
  
  return new IfStatement(condition, thenBranch, elseBranch, location);
}
```

**Tests**:
- Unit: `if (x) { }` parses correctly
- Unit: `if (x) { a(); } else { b(); }` parses correctly
- Unit: `if (x) { } else if (y) { } else { }` parses correctly
- Error: Missing `(` reports error
- Error: Missing `{` reports error

---

#### Task 2.4: Update While Statement

**Objective**: While statement uses curly braces.

**File**: `packages/compiler/src/parser/statements.ts`

**Change**:
```
// Before: while condition ... end while
// After:  while (condition) { ... }
```

**Implementation**:
```typescript
protected parseWhileStatement(): WhileStatement {
  const startToken = this.expect(TokenType.WHILE, "Expected 'while'");
  
  this.expect(TokenType.LEFT_PAREN, "Expected '(' after 'while'");
  const condition = this.parseExpression();
  this.expect(TokenType.RIGHT_PAREN, "Expected ')' after condition");
  
  this.scopeManager.enterLoopScope();
  
  this.expect(TokenType.LEFT_BRACE, "Expected '{' for while body");
  const body = this.parseStatementBlock([TokenType.RIGHT_BRACE]);
  this.expect(TokenType.RIGHT_BRACE, "Expected '}' to close while body");
  
  this.scopeManager.exitLoopScope();
  
  return new WhileStatement(condition, body, location);
}
```

**Tests**:
- Unit: `while (x) { }` parses correctly
- Unit: `while (x > 0) { x = x - 1; }` parses correctly
- Unit: Nested while loops parse correctly
- Error: Missing `(` reports error

---

#### Task 2.5: Implement Do-While Statement

**Objective**: Add new do-while statement.

**File**: `packages/compiler/src/parser/statements.ts`

**Syntax**:
```
do { ... } while (condition);
```

**Implementation**:
```typescript
protected parseDoWhileStatement(): DoWhileStatement {
  const startToken = this.expect(TokenType.DO, "Expected 'do'");
  
  this.scopeManager.enterLoopScope();
  
  this.expect(TokenType.LEFT_BRACE, "Expected '{' for do body");
  const body = this.parseStatementBlock([TokenType.RIGHT_BRACE]);
  this.expect(TokenType.RIGHT_BRACE, "Expected '}' to close do body");
  
  this.expect(TokenType.WHILE, "Expected 'while' after do body");
  this.expect(TokenType.LEFT_PAREN, "Expected '(' after 'while'");
  const condition = this.parseExpression();
  this.expect(TokenType.RIGHT_PAREN, "Expected ')' after condition");
  
  this.expectSemicolon('Expected semicolon after do-while');
  
  this.scopeManager.exitLoopScope();
  
  return new DoWhileStatement(body, condition, location);
}
```

**Tests**:
- Unit: `do { } while (x);` parses correctly
- Unit: `do { x++; } while (x < 10);` parses correctly
- Error: Missing `while` after body reports error
- Error: Missing semicolon reports error

---

#### Task 2.6: Update For Statement

**Objective**: For statement uses curly braces, supports `step` and `downto`.

**File**: `packages/compiler/src/parser/statements.ts`

**Change**:
```
// Before: for i = 0 to 10 ... next i
// After:  for (i = 0 to 10) { ... }
//         for (i = 0 to 10 step 2) { ... }
//         for (i = 10 downto 0) { ... }
//         for (let i: word = 0 to 5000) { ... }
```

**Implementation**:
```typescript
protected parseForStatement(): ForStatement {
  const startToken = this.expect(TokenType.FOR, "Expected 'for'");
  
  this.expect(TokenType.LEFT_PAREN, "Expected '(' after 'for'");
  
  // Optional: let variable: type
  let variableType: string | null = null;
  if (this.match(TokenType.LET)) {
    const nameToken = this.expect(TokenType.IDENTIFIER, "Expected variable name");
    const variable = nameToken.value;
    if (this.match(TokenType.COLON)) {
      variableType = this.parseTypeAnnotation();
    }
  } else {
    const nameToken = this.expect(TokenType.IDENTIFIER, "Expected variable name");
    const variable = nameToken.value;
  }
  
  this.expect(TokenType.ASSIGN, "Expected '=' after variable");
  const start = this.parseExpression();
  
  // Direction: to or downto
  let direction: 'to' | 'downto' = 'to';
  if (this.match(TokenType.TO)) {
    direction = 'to';
  } else if (this.match(TokenType.DOWNTO)) {
    direction = 'downto';
  } else {
    this.reportError("Expected 'to' or 'downto'");
  }
  
  const end = this.parseExpression();
  
  // Optional: step N
  let step: Expression | null = null;
  if (this.match(TokenType.STEP)) {
    step = this.parseExpression();
  }
  
  this.expect(TokenType.RIGHT_PAREN, "Expected ')' after for specification");
  
  this.scopeManager.enterLoopScope();
  
  this.expect(TokenType.LEFT_BRACE, "Expected '{' for for body");
  const body = this.parseStatementBlock([TokenType.RIGHT_BRACE]);
  this.expect(TokenType.RIGHT_BRACE, "Expected '}' to close for body");
  
  this.scopeManager.exitLoopScope();
  
  return new ForStatement(variable, variableType, start, end, direction, step, body, location);
}
```

**Tests**:
- Unit: `for (i = 0 to 10) { }` parses correctly
- Unit: `for (i = 10 downto 0) { }` parses correctly
- Unit: `for (i = 0 to 100 step 5) { }` parses correctly
- Unit: `for (let i: word = 0 to 5000) { }` parses correctly
- Error: Missing `to` or `downto` reports error

---

#### Task 2.7: Rename Match to Switch

**Objective**: Rename `parseMatchStatement` to `parseSwitchStatement`, use curly braces.

**File**: `packages/compiler/src/parser/statements.ts`

**Change**:
```
// Before: match value case 1: ... end match
// After:  switch (value) { case 1: ... }
```

**Implementation**:
```typescript
protected parseSwitchStatement(): SwitchStatement {
  const startToken = this.expect(TokenType.SWITCH, "Expected 'switch'");
  
  this.expect(TokenType.LEFT_PAREN, "Expected '(' after 'switch'");
  const value = this.parseExpression();
  this.expect(TokenType.RIGHT_PAREN, "Expected ')' after switch value");
  
  this.expect(TokenType.LEFT_BRACE, "Expected '{' for switch body");
  
  const cases: CaseClause[] = [];
  let defaultCase: Statement[] | null = null;
  
  while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
    if (this.match(TokenType.CASE)) {
      const caseValue = this.parseExpression();
      this.expect(TokenType.COLON, "Expected ':' after case value");
      const caseBody = this.parseCaseBody();
      cases.push({ value: caseValue, body: caseBody, location });
    } else if (this.match(TokenType.DEFAULT)) {
      this.expect(TokenType.COLON, "Expected ':' after default");
      defaultCase = this.parseCaseBody();
    } else {
      this.reportError("Expected 'case' or 'default' in switch");
      this.advance();
    }
  }
  
  this.expect(TokenType.RIGHT_BRACE, "Expected '}' to close switch");
  
  return new SwitchStatement(value, cases, defaultCase, location);
}

protected parseCaseBody(): Statement[] {
  const statements: Statement[] = [];
  while (!this.check(TokenType.CASE, TokenType.DEFAULT, TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
    statements.push(this.parseStatement());
  }
  return statements;
}
```

**Tests**:
- Unit: `switch (x) { case 1: break; }` parses correctly
- Unit: `switch (x) { case 1: a(); break; case 2: b(); break; default: c(); }` parses correctly
- Unit: Fall-through (case without break) parses correctly

---

#### Task 2.8: Update Function Declaration

**Objective**: Function declaration uses curly braces.

**File**: `packages/compiler/src/parser/modules.ts`

**Change**:
```
// Before: function f(): void ... end function
// After:  function f(): void { ... }
```

**Implementation**:
```typescript
protected parseFunctionDecl(): FunctionDecl {
  // ... parse modifiers, name, params, return type ...
  
  // Check for stub function (semicolon instead of body)
  if (this.match(TokenType.SEMICOLON)) {
    return new FunctionDecl(/* ... stub: true */);
  }
  
  // Regular function with body
  this.expect(TokenType.LEFT_BRACE, "Expected '{' for function body");
  
  this.scopeManager.enterFunctionScope(name, returnType);
  const body = this.parseStatementBlock([TokenType.RIGHT_BRACE]);
  this.scopeManager.exitFunctionScope();
  
  this.expect(TokenType.RIGHT_BRACE, "Expected '}' to close function");
  
  return new FunctionDecl(/* ... body */);
}
```

**Tests**:
- Unit: `function f(): void { }` parses correctly
- Unit: `function f(a: byte): byte { return a; }` parses correctly
- Unit: Stub function `function f(): void;` still works
- Unit: Callback function with body parses correctly

---

#### Task 2.9: Update Enum Declaration

**Objective**: Enum declaration uses curly braces.

**File**: `packages/compiler/src/parser/modules.ts`

**Change**:
```
// Before: enum E ... end enum
// After:  enum E { ... }
```

**Implementation**:
```typescript
protected parseEnumDecl(): EnumDecl {
  const startToken = this.expect(TokenType.ENUM, "Expected 'enum'");
  const nameToken = this.expect(TokenType.IDENTIFIER, "Expected enum name");
  
  this.expect(TokenType.LEFT_BRACE, "Expected '{' for enum body");
  
  const members: EnumMember[] = [];
  while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
    const member = this.parseEnumMember();
    members.push(member);
    if (!this.check(TokenType.RIGHT_BRACE)) {
      this.match(TokenType.COMMA); // Optional comma
    }
  }
  
  this.expect(TokenType.RIGHT_BRACE, "Expected '}' to close enum");
  
  return new EnumDecl(nameToken.value, members, location);
}
```

**Tests**:
- Unit: `enum E { A, B, C }` parses correctly
- Unit: `enum E { A = 0, B = 1 }` parses correctly
- Unit: Trailing comma allowed

---

#### Task 2.10: Update @map Struct Declarations

**Objective**: @map type and layout use curly braces.

**File**: `packages/compiler/src/parser/declarations.ts`

**Change**:
```
// Before: @map x at $A type ... end @map
// After:  @map x at $A type { ... }
```

**Implementation**:
```typescript
protected parseSequentialStructMapDecl(): SequentialStructMapDecl {
  // ... parse @map name at address ...
  
  this.expect(TokenType.TYPE, "Expected 'type'");
  this.expect(TokenType.LEFT_BRACE, "Expected '{' for type fields");
  
  const fields: MapField[] = [];
  while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
    fields.push(this.parseMapField());
    this.match(TokenType.COMMA); // Optional comma
  }
  
  this.expect(TokenType.RIGHT_BRACE, "Expected '}' to close type");
  
  return new SequentialStructMapDecl(/* ... */);
}

protected parseExplicitStructMapDecl(): ExplicitStructMapDecl {
  // ... parse @map name at address ...
  
  this.expect(TokenType.LAYOUT, "Expected 'layout'");
  this.expect(TokenType.LEFT_BRACE, "Expected '{' for layout fields");
  
  const fields: ExplicitMapField[] = [];
  while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
    fields.push(this.parseExplicitMapField());
    this.match(TokenType.COMMA); // Optional comma
  }
  
  this.expect(TokenType.RIGHT_BRACE, "Expected '}' to close layout");
  
  return new ExplicitStructMapDecl(/* ... */);
}
```

**Tests**:
- Unit: `@map x at $D000 type { a: byte, b: byte }` parses correctly
- Unit: `@map x at $D000 layout { a: at $D000: byte }` parses correctly

---

#### Task 2.11: Implement Ternary Operator

**Objective**: Add ternary operator `? :` to expression parsing.

**File**: `packages/compiler/src/parser/expressions.ts`

**Syntax**:
```js
condition ? valueIfTrue : valueIfFalse
```

**Implementation**:
Ternary operator has lower precedence than most binary operators but higher than assignment. Add to Pratt parser:

```typescript
// After parsing equality, check for ternary
protected parseConditional(): Expression {
  let condition = this.parseLogicalOr();
  
  if (this.match(TokenType.QUESTION)) {
    const thenExpr = this.parseExpression();
    this.expect(TokenType.COLON, "Expected ':' in ternary expression");
    const elseExpr = this.parseConditional(); // Right-associative
    return new TernaryExpression(condition, thenExpr, elseExpr, location);
  }
  
  return condition;
}
```

**Tests**:
- Unit: `a ? b : c` parses correctly
- Unit: `(x > y) ? x : y` parses correctly
- Unit: Nested ternary `a ? b : c ? d : e` parses correctly (right-associative)
- Error: Missing `:` reports error

---

#### Task 2.12: Update Statement Dispatcher

**Objective**: Update `parseStatement()` to route to new/renamed methods.

**File**: `packages/compiler/src/parser/statements.ts`

**Implementation**:
```typescript
protected parseStatement(): Statement {
  if (this.check(TokenType.LET, TokenType.CONST)) {
    return this.parseLocalVariableDeclaration();
  }
  
  if (this.check(TokenType.IF)) return this.parseIfStatement();
  if (this.check(TokenType.WHILE)) return this.parseWhileStatement();
  if (this.check(TokenType.DO)) return this.parseDoWhileStatement();  // NEW
  if (this.check(TokenType.FOR)) return this.parseForStatement();
  if (this.check(TokenType.SWITCH)) return this.parseSwitchStatement(); // RENAMED
  if (this.check(TokenType.RETURN)) return this.parseReturnStatement();
  if (this.check(TokenType.BREAK)) return this.parseBreakStatement();
  if (this.check(TokenType.CONTINUE)) return this.parseContinueStatement();
  
  return this.parseExpressionStatement();
}
```

---

#### Task 2.13: Remove parseEndKeyword Helper

**Objective**: Remove the `parseEndKeyword` helper method (no longer needed).

**File**: `packages/compiler/src/parser/statements.ts`

**Action**: Delete or comment out the `parseEndKeyword()` method.

---

#### Task 2.14: Update Parser Tests

**Objective**: Update all parser tests to use new syntax.

**Files to Modify**:
- All files in `packages/compiler/src/__tests__/parser/`

**Strategy**:
1. Update test strings to use curly braces
2. Update test strings to use semicolons where required
3. Add tests for new features (do-while, ternary, step, downto)
4. Remove tests for obsolete syntax

**Test Categories**:
- If statement tests
- While statement tests
- Do-while statement tests (NEW)
- For statement tests (with step, downto)
- Switch statement tests
- Function declaration tests
- Enum declaration tests
- @map declaration tests
- Module/import declaration tests
- Ternary expression tests (NEW)
- Error recovery tests

---

## Task Implementation Checklist

### Phase 1: Lexer

| Task | Description | Dependencies | Status |
|------|-------------|--------------|--------|
| 1.1 | Verify/add brace tokens | None | [ ] |
| 1.2 | Add DOWNTO, STEP, DO, SWITCH keywords | None | [ ] |
| 1.3 | Add QUESTION token | None | [ ] |
| 1.4 | Remove END, THEN, NEXT, ELSEIF keywords | None | [ ] |
| 1.5 | Replace MATCH with SWITCH | None | [ ] |
| 1.6 | Update lexer tests | 1.1-1.5 | [ ] |

### Phase 2: Parser

| Task | Description | Dependencies | Status |
|------|-------------|--------------|--------|
| 2.1 | Update module declaration | Phase 1 | [ ] |
| 2.2 | Update import declaration | Phase 1 | [ ] |
| 2.3 | Update if statement | Phase 1 | [ ] |
| 2.4 | Update while statement | Phase 1 | [ ] |
| 2.5 | Implement do-while statement | Phase 1 | [ ] |
| 2.6 | Update for statement | Phase 1, AST ready | [ ] |
| 2.7 | Rename match to switch | Phase 1 | [ ] |
| 2.8 | Update function declaration | Phase 1 | [ ] |
| 2.9 | Update enum declaration | Phase 1 | [ ] |
| 2.10 | Update @map struct declarations | Phase 1 | [ ] |
| 2.11 | Implement ternary operator | Phase 1, AST ready | [ ] |
| 2.12 | Update statement dispatcher | 2.3-2.7 | [ ] |
| 2.13 | Remove parseEndKeyword helper | 2.3-2.10 | [ ] |
| 2.14 | Update parser tests | 2.1-2.13 | [ ] |

---

## Success Criteria

### Phase 1 Complete When:
- [ ] All new tokens recognized
- [ ] Old keywords removed
- [ ] All lexer tests pass

### Phase 2 Complete When:
- [ ] All statement types parse with new syntax
- [ ] `else if` works as two keywords
- [ ] Do-while statement implemented
- [ ] For loop supports step and downto
- [ ] Ternary operator implemented
- [ ] All parser tests pass

---

## Next Document

Proceed to [02-ast-semantic.md](02-ast-semantic.md) for Phase 3 & 4 tasks (AST & Semantic Analyzer).