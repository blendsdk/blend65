# Task 1.1: Update Token Types for Blend64

**Task ID:** 1.1_UPDATE_TOKEN_TYPES **Phase:** Phase 1 - Lexer Adaptation **Estimated Time:** 2-3 hours
**Dependencies:** None (first task) **Context Requirement:** ~15K tokens

---

## Objective

Modify the TokenType enum in the Blend lexer to support Blend64 syntax requirements.

---

## Context

**What you're modifying:**

-   `packages/lexer/src/types.ts` - Token type definitions

**Why this change is needed:**

-   Blend64 introduces storage classes (`zp`, `ram`, `data`, `const`, `io`)
-   New placement syntax (`@$D020`) requires `AT` and `DOLLAR` tokens
-   New control construct `hotloop` needs recognition
-   Some Blend operators are removed (null coalescing, optional chaining)

**What changes from original Blend:**

-   Add 6 new token types for Blend64 features
-   Remove 3 token types not used in Blend64
-   Keep all existing core tokens (identifiers, literals, operators)

---

## Input Files

**Required from blend-lang:**

-   `/Users/gevik/workdir/blend-lang/packages/lexer/src/types.ts` - Token definitions

**Reference documents:**

-   `research/blend64-spec.md` - Section 4 (Storage Classes)
-   `research/blend64-diff-from-blend.md` - Section 2 (Types), Section 10 (Operators)

---

## Task Instructions

### Step 1: Copy the source file

```bash
cp /Users/gevik/workdir/blend-lang/packages/lexer/src/types.ts packages/lexer/src/types.ts
```

### Step 2: Add new TokenType enum values

Add these new tokens to the TokenType enum (in alphabetical order within logical groups):

```typescript
// Add after existing keywords section:
ZP = 'ZP',                    // storage class
RAM = 'RAM',                  // storage class
DATA = 'DATA',                // storage class
IO = 'IO',                    // storage class
HOTLOOP = 'HOTLOOP',          // control construct

// Add after DOT in punctuation section:
AT = 'AT',                    // @ for placement
DOLLAR = 'DOLLAR',            // $ for hex addresses
```

### Step 3: Remove unused tokens

Remove these TokenType enum values (Blend64 doesn't use them):

```typescript
// REMOVE these lines:
QMARKQMARK = 'QMARKQMARK', // ?? (null coalescing)
DOTDOTDOT = 'DOTDOTDOT',   // ... (spread/rest)
NULL = 'NULL',             // null literal
```

### Step 4: Update comments

Update the file header comment to reflect Blend64:

```typescript
/**
 * TokenType enumerates all token categories produced by the Blend64 lexer.
 * Keeping operators and punctuation explicit simplifies downstream parsing.
 *
 * Changes from Blend:
 * - Added storage class tokens (ZP, RAM, DATA, IO)
 * - Added placement tokens (AT, DOLLAR)
 * - Added HOTLOOP control construct
 * - Removed null coalescing and spread operators
 */
```

---

## Expected Output

**Modified files:**

-   `packages/lexer/src/types.ts` - Updated TokenType enum with Blend64 tokens

**Success criteria:**

-   [ ] 6 new tokens added: ZP, RAM, DATA, IO, HOTLOOP, AT, DOLLAR
-   [ ] 3 tokens removed: QMARKQMARK, DOTDOTDOT, NULL
-   [ ] All existing core tokens preserved
-   [ ] File compiles without TypeScript errors
-   [ ] Enum values follow consistent naming convention

---

## Code Examples

### Before:

```typescript
export enum TokenType {
    // ... existing tokens ...

    // Special operators
    ARROW = "ARROW", // =>
    QMARK = "QMARK", // ?
    QMARKQMARK = "QMARKQMARK", // ??
    DOTDOTDOT = "DOTDOTDOT", // ... (spread/rest)

    // Literals
    INTEGER = "INTEGER",
    FLOAT = "FLOAT",
    STRING = "STRING",
    TEMPLATE_STRING = "TEMPLATE_STRING",
    BOOLEAN = "BOOLEAN", // true/false
    NULL = "NULL" // null
}
```

### After:

```typescript
export enum TokenType {
    // ... existing tokens ...

    // Storage classes (Blend64)
    ZP = "ZP",
    RAM = "RAM",
    DATA = "DATA",
    IO = "IO",

    // Control constructs (Blend64)
    HOTLOOP = "HOTLOOP",

    // Placement syntax (Blend64)
    AT = "AT", // @
    DOLLAR = "DOLLAR", // $

    // Special operators
    ARROW = "ARROW", // =>
    QMARK = "QMARK", // ?
    // REMOVED: QMARKQMARK, DOTDOTDOT

    // Literals
    INTEGER = "INTEGER",
    FLOAT = "FLOAT",
    STRING = "STRING",
    TEMPLATE_STRING = "TEMPLATE_STRING",
    BOOLEAN = "BOOLEAN" // true/false
    // REMOVED: NULL
}
```

---

## Testing

**Test cases to run:**

```bash
# Navigate to packages/lexer
cd packages/lexer

# Check TypeScript compilation
npx tsc --noEmit

# Verify enum values exist
node -e "
const { TokenType } = require('./src/types.js');
console.log('ZP exists:', !!TokenType.ZP);
console.log('RAM exists:', !!TokenType.RAM);
console.log('HOTLOOP exists:', !!TokenType.HOTLOOP);
console.log('AT exists:', !!TokenType.AT);
console.log('DOLLAR exists:', !!TokenType.DOLLAR);
console.log('QMARKQMARK removed:', !TokenType.QMARKQMARK);
"
```

**Expected results:**

-   TypeScript compiles without errors
-   All new tokens report `true`
-   Removed tokens report `true` (meaning they don't exist)

---

## Next Task

Continue with: `phase-1-lexer/TASK_1.2_UPDATE_KEYWORDS.md`

---

## Troubleshooting

**Common issues:**

-   Problem: TypeScript compilation errors → Solution: Check enum syntax and trailing commas
-   Problem: Enum values not found → Solution: Verify export is working and values are spelled correctly
-   Problem: Old tokens still exist → Solution: Double-check removal of QMARKQMARK, DOTDOTDOT, NULL

```

```
