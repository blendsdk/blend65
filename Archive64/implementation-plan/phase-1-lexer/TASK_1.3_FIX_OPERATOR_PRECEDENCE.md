# Task 1.3: Fix Operator Precedence for Blend64

**Task ID:** 1.3_FIX_OPERATOR_PRECEDENCE
**Phase:** Phase 1 - Lexer Adaptation
**Estimated Time:** 2-3 hours
**Dependencies:** Task 1.1 (Token Types), Task 1.2 (Keywords)
**Context Requirement:** ~15K tokens

---

## Objective

Update operator tokenization in lexer.ts to handle Blend64 operator changes, specifically fixing `^` precedence and removing unsupported operators.

---

## Context

**What you're modifying:**
- `packages/lexer/src/lexer.ts` - Operator tokenization logic

**Why this change is needed:**
- Blend64 `^` is bitwise XOR, not exponentiation (major precedence change)
- Blend64 removes `**` (exponentiation), `??` (null coalescing), `...` (spread)
- Blend64 adds `@` and `$` tokens for placement syntax
- Need to handle word-based logical operators (`and`, `or`, `not`)

**What changes from original Blend:**
- `^` token meaning changes from exponent to bitwise XOR
- Remove multi-character operators: `**`, `??`, `...`
- Add new single-character operators: `@`, `$`
- Word operators handled by keyword system (already in Task 1.2)

---

## Input Files

**Required from blend-lang:**
- `/Users/gevik/workdir/blend-lang/packages/lexer/src/lexer.ts` - Main lexer logic

**Reference documents:**
- `research/blend64-spec.md` - Section 6 (Expressions and Operators)
- `research/blend64-diff-from-blend.md` - Section 10 (Operators)

---

## Task Instructions

### Step 1: Copy the source file
```bash
cp /Users/gevik/workdir/blend-lang/packages/lexer/src/lexer.ts packages/lexer/src/lexer.ts
```

### Step 2: Remove unsupported 3-char operators
In the `lexSymbol()` method, remove these cases from the 3-char operators section:

```typescript
// REMOVE this case:
case '...':
  this.advance();
  this.advance();
  this.advance();
  return this.makeToken(TokenType.DOTDOTDOT, '...', start, this.pos());
```

### Step 3: Remove unsupported 2-char operators
In the `lexSymbol()` method, remove these cases from the 2-char operators section:

```typescript
// REMOVE these cases:
case '??':
  this.advance();
  this.advance();
  return this.makeToken(TokenType.QMARKQMARK, '??', start, this.pos());
case '**':
  this.advance();
  this.advance();
  return this.makeToken(TokenType.STARSTAR, '**', start, this.pos());
```

### Step 4: Add new single-char operators
In the 1-char operators section, add support for `@` and `$`:

```typescript
// Add these cases in the 1-char switch statement:
case '@':
  return this.makeToken(TokenType.AT, '@', start, this.pos());
case '$':
  return this.makeToken(TokenType.DOLLAR, '$', start, this.pos());
```

### Step 5: Update operator comments
Update the comment for the `^` operator to reflect its new meaning:

```typescript
// Bitwise operators
case '&':
  return this.makeToken(TokenType.AMPERSAND, '&', start, this.pos());
case '|':
  return this.makeToken(TokenType.PIPE, '|', start, this.pos());
case '^': // XOR in Blend64 (not exponentiation)
  return this.makeToken(TokenType.CARET, '^', start, this.pos());
case '~':
  return this.makeToken(TokenType.TILDE, '~', start, this.pos());
```

### Step 6: Update file header comment
Add a comment explaining Blend64 operator changes:

```typescript
/**
 * Lexer converts a source string into a stream of tokens.
 *
 * Blend64 changes from Blend:
 * - ^ is bitwise XOR (not exponentiation)
 * - Removed **, ??, ... operators
 * - Added @ and $ for placement syntax
 * - Word operators (and, or, not) handled as keywords
 */
```

---

## Expected Output

**Modified files:**
- `packages/lexer/src/lexer.ts` - Updated operator tokenization

**Success criteria:**
- [ ] `@` and `$` characters tokenize as AT and DOLLAR tokens
- [ ] `^` still tokenizes as CARET (but meaning is XOR, not exponent)
- [ ] `**`, `??`, `...` operators no longer recognized (throw illegal character error)
- [ ] All existing single-char operators still work
- [ ] File compiles without TypeScript errors

---

## Code Examples

### Before:
```typescript
// 3-char operators
case '...':
  // ... tokenize as DOTDOTDOT

// 2-char operators
case '??':
  // ... tokenize as QMARKQMARK
case '**':
  // ... tokenize as STARSTAR

// 1-char operators
case '^':
  return this.makeToken(TokenType.CARET, '^', start, this.pos());
// (no @ or $ handling)
```

### After:
```typescript
// 3-char operators
// (... removed)

// 2-char operators
// (?? and ** removed)

// 1-char operators
case '^': // XOR in Blend64 (not exponentiation)
  return this.makeToken(TokenType.CARET, '^', start, this.pos());
case '@':
  return this.makeToken(TokenType.AT, '@', start, this.pos());
case '$':
  return this.makeToken(TokenType.DOLLAR, '$', start, this.pos());
```

---

## Testing

**Test cases to run:**
```bash
# Navigate to packages/lexer
cd packages/lexer

# Check TypeScript compilation
npx tsc --noEmit

# Test operator tokenization
node -e "
const { createBlendLexer } = require('./src/blend-lexer.js');
const lexer = createBlendLexer();

// Test new operators
const tokens1 = lexer.tokenize('@ \$ ^');
tokens1.filter(t => t.type !== 'NEWLINE' && t.type !== 'EOF').forEach(t => {
  console.log('Token:', t.lexeme, '→', t.type);
});

// Test removed operators cause errors
try {
  const tokens2 = lexer.tokenize('**');
  console.log('ERROR: ** should not tokenize');
} catch (e) {
  console.log('✓ ** correctly rejected');
}

try {
  const tokens3 = lexer.tokenize('??');
  console.log('ERROR: ?? should not tokenize');
} catch (e) {
  console.log('✓ ?? correctly rejected');
}
"
```

**Expected results:**
- `@` → AT token
- `$` → DOLLAR token
- `^` → CARET token
- `**` and `??` cause lexer errors
- No TypeScript compilation errors

---

## Next Task

Continue with: `phase-1-lexer/TASK_1.4_ADD_STORAGE_SYNTAX.md`

---

## Troubleshooting

**Common issues:**
- Problem: New operators not recognized → Solution: Check case statements are in correct switch block
- Problem: Old operators still work → Solution: Verify removal of cases and check for duplicates
- Problem: Lexer crashes on removed operators → Solution: This is expected behavior; they should be illegal characters
