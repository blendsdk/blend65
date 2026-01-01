# Task 1.2: Update Keywords for Blend64

**Task ID:** 1.2_UPDATE_KEYWORDS
**Phase:** Phase 1 - Lexer Adaptation
**Estimated Time:** 1-2 hours
**Dependencies:** Task 1.1 (Token Types)
**Context Requirement:** ~12K tokens

---

## Objective

Update the keyword set in blend-lexer.ts to recognize Blend64 keywords and remove unused Blend keywords.

---

## Context

**What you're modifying:**
- `packages/lexer/src/blend-lexer.ts` - Keyword definitions

**Why this change is needed:**
- Blend64 has different syntax than Blend (no classes, different control flow)
- New storage classes need keyword recognition
- Blend64 uses different statement terminators (`end function` vs `}`)

**What changes from original Blend:**
- Remove OOP keywords (`class`, `new`, `this`, `extends`, etc.)
- Remove exception keywords (`try`, `catch`, `throw`)
- Add storage class keywords (`zp`, `ram`, `data`, `io`)
- Add Blend64 control keywords (`hotloop`, `then`, `end`)

---

## Input Files

**Required from blend-lang:**
- `/Users/gevik/workdir/blend-lang/packages/lexer/src/blend-lexer.ts` - Keyword definitions

**Reference documents:**
- `research/blend64-spec.md` - Section 2.2 (Imports), Section 7 (Statements)
- `research/blend64-diff-from-blend.md` - Section 7 (Classes), Section 9 (Control flow)

---

## Task Instructions

### Step 1: Copy the source file
```bash
cp /Users/gevik/workdir/blend-lang/packages/lexer/src/blend-lexer.ts packages/lexer/src/blend-lexer.ts
```

### Step 2: Update the keyword set
Find the keyword set definition and replace it with the Blend64 keyword set:

```typescript
/**
 * Blend64 reserved keywords
 * These words cannot be used as identifiers
 */
const BLEND64_KEYWORDS = new Set([
  // Module system
  'module', 'import', 'export', 'from',

  // Functions and declarations
  'function', 'end', 'return',

  // Variables and storage
  'var', 'const',
  'zp', 'ram', 'data', 'io',

  // Control flow
  'if', 'then', 'else', 'while', 'for', 'to', 'step', 'next',
  'match', 'case', 'break', 'continue',
  'hotloop',

  // Types
  'byte', 'word', 'boolean', 'void', 'string', 'type',

  // Logical operators
  'and', 'or', 'not',

  // Literals
  'true', 'false', 'nothing'
]);
```

### Step 3: Update the factory function
Modify the `createBlendLexer` function to use the new keyword set:

```typescript
export function createBlendLexer(options: LexerOptions = {}): Lexer {
  return new Lexer('', BLEND64_KEYWORDS, {
    emitNewlines: true,
    emitComments: true,
    allowTabs: true,
    singleLineComment: '//',
    allowSingleQuoteStrings: false, // Blend64 uses double quotes only
    ...options,
  });
}
```

### Step 4: Update comments and exports
Update the file header to reflect Blend64:

```typescript
/**
 * Blend64-specific lexer factory and configuration.
 *
 * This module provides a pre-configured lexer for the Blend64 language
 * with the correct keyword set and default options.
 */
```

---

## Expected Output

**Modified files:**
- `packages/lexer/src/blend-lexer.ts` - Updated with Blend64 keywords

**Success criteria:**
- [ ] Keyword set contains exactly 28 Blend64 keywords
- [ ] No OOP keywords remain (`class`, `new`, `this`, `extends`)
- [ ] No exception keywords remain (`try`, `catch`, `throw`)
- [ ] All storage class keywords present (`zp`, `ram`, `data`, `io`)
- [ ] Control flow keywords updated (`then`, `end`, `hotloop`)
- [ ] Function compiles and exports correctly

---

## Code Examples

### Before:
```typescript
const BLEND_KEYWORDS = new Set([
  // ... existing Blend keywords including:
  'class', 'extends', 'new', 'this', 'super',
  'try', 'catch', 'throw', 'finally',
  'let', 'null', 'undefined',
  // ...
]);
```

### After:
```typescript
const BLEND64_KEYWORDS = new Set([
  // Module system
  'module', 'import', 'export', 'from',

  // Functions and declarations
  'function', 'end', 'return',

  // Variables and storage
  'var', 'const',
  'zp', 'ram', 'data', 'io',

  // Control flow
  'if', 'then', 'else', 'while', 'for', 'to', 'step', 'next',
  'match', 'case', 'break', 'continue',
  'hotloop',

  // Types
  'byte', 'word', 'boolean', 'void', 'string', 'type',

  // Logical operators
  'and', 'or', 'not',

  // Literals
  'true', 'false', 'nothing'
]);
```

---

## Testing

**Test cases to run:**
```bash
# Navigate to packages/lexer
cd packages/lexer

# Check TypeScript compilation
npx tsc --noEmit

# Test keyword recognition
node -e "
const { createBlendLexer } = require('./src/blend-lexer.js');
const lexer = createBlendLexer();

// Test Blend64 keywords
const tokens = lexer.tokenize('zp var hotloop function end');
tokens.forEach(t => {
  if (t.type === 'KEYWORD') console.log('Keyword:', t.lexeme);
});

// Test removed keywords don't get recognized as keywords
const tokens2 = lexer.tokenize('class try null');
tokens2.forEach(t => {
  if (t.type === 'IDENTIFIER') console.log('Identifier (not keyword):', t.lexeme);
});
"
```

**Expected results:**
- `zp`, `hotloop`, `function`, `end` should be recognized as keywords
- `class`, `try`, `null` should be recognized as identifiers (not keywords)
- No TypeScript compilation errors

---

## Next Task

Continue with: `phase-1-lexer/TASK_1.3_FIX_OPERATOR_PRECEDENCE.md`

---

## Troubleshooting

**Common issues:**
- Problem: Keywords not recognized → Solution: Check keyword set is properly exported and used
- Problem: Wrong tokens classified as keywords → Solution: Verify keyword set only contains Blend64 words
- Problem: Factory function errors → Solution: Check function signature and default options are correct
