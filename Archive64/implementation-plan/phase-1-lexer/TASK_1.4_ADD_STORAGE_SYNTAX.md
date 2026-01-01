# Task 1.4: Add Storage Syntax Recognition

**Task ID:** 1.4_ADD_STORAGE_SYNTAX **Phase:** Phase 1 - Lexer Adaptation **Estimated Time:** 1-2 hours
**Dependencies:** Tasks 1.1-1.3 (All previous lexer tasks) **Context Requirement:** ~10K tokens

---

## Objective

Ensure lexer correctly handles Blend64 storage class and placement syntax patterns.

---

## Context

**What you're modifying:**

-   Testing and validation of existing lexer changes
-   No additional code changes (syntax support added in previous tasks)

**Why this validation is needed:**

-   Storage classes (`zp var`, `data var`) must tokenize correctly
-   Placement syntax (`@ $D020`) must parse as separate tokens
-   Hex literals (`$D020`) need proper recognition

**What should work:**

-   Storage class keywords followed by `var`/`const`
-   `@` symbol followed by `$` and hex digits
-   All combinations without lexer errors

---

## Input Files

**No new files needed** - uses output from Tasks 1.1-1.3

**Reference documents:**

-   `research/blend64-spec.md` - Section 4.1 (Declarations)

---

## Task Instructions

### Step 1: Test storage class syntax

Create test cases to verify storage classes tokenize correctly:

```bash
# Create test file
cat > test-storage.blend64 << 'EOF'
zp var frame: byte
ram var bullets: byte[8]
data var palette: byte[4] = [0x00, 0x06, 0x0E, 0x0B]
const var message: string(16) = "HELLO"
io var VIC_BORDER: byte @ $D020
EOF
```

### Step 2: Test placement syntax

Test that placement syntax tokenizes as separate tokens:

```bash
# Test placement patterns
cat > test-placement.blend64 << 'EOF'
@ $D020
@ $D021
@ 53280
EOF
```

### Step 3: Run comprehensive tokenization test

```bash
cd packages/lexer

node -e "
const { createBlendLexer } = require('./src/blend-lexer.js');
const fs = require('fs');
const lexer = createBlendLexer();

// Test storage syntax
console.log('=== Testing Storage Syntax ===');
const storageCode = fs.readFileSync('../../test-storage.blend64', 'utf8');
const storageTokens = lexer.tokenize(storageCode);

storageTokens.forEach(token => {
  if (['ZP', 'BSS', 'DATA', 'CONST', 'IO', 'AT', 'DOLLAR'].includes(token.type)) {
    console.log(\`✓ \${token.lexeme} → \${token.type}\`);
  }
});

// Test hex literals are recognized
console.log('\\n=== Testing Hex Literals ===');
const hexTokens = lexer.tokenize('\$D020 \$D021');
hexTokens.forEach(token => {
  if (token.type === 'INTEGER') {
    console.log(\`✓ \${token.lexeme} → \${token.type} (value: \${token.value})\`);
  }
});
"
```

### Step 4: Verify error handling

Test that invalid syntax still produces helpful errors:

```bash
node -e "
const { createBlendLexer } = require('./src/blend-lexer.js');
const lexer = createBlendLexer();

// Test that invalid storage combinations fail appropriately
try {
  lexer.tokenize('**invalid');
  console.log('ERROR: Should have failed');
} catch (e) {
  console.log('✓ Invalid syntax correctly rejected');
}
"
```

---

## Expected Output

**No new files created** - this is validation only

**Success criteria:**

-   [ ] `zp`, `ram`, `data`, `const`, `io` recognized as KEYWORD tokens
-   [ ] `@` recognized as AT token
-   [ ] `$` recognized as DOLLAR token
-   [ ] Hex literals like `$D020` properly parsed as INTEGER tokens
-   [ ] Storage class + var combinations tokenize without errors
-   [ ] Invalid syntax still produces clear error messages

---

## Code Examples

### Test Input:

```
zp var x: byte @ $02
data var msg: string(8) = "HELLO"
```

### Expected Tokens:

```
ZP → KEYWORD
var → KEYWORD
x → IDENTIFIER
: → COLON
byte → KEYWORD
@ → AT
$02 → INTEGER (value: 2)
data → KEYWORD
var → KEYWORD
msg → IDENTIFIER
...
```

---

## Testing

**Test cases to run:**

```bash
# Navigate to packages/lexer
cd packages/lexer

# Run the comprehensive test from Step 3
# Verify all expected tokens appear
# Check hex literal values are correct
```

**Expected results:**

-   All storage keywords recognized
-   Placement syntax tokenizes correctly
-   Hex literals parse with correct values
-   No unexpected lexer errors

---

## Next Task

Continue with: `phase-1-lexer/TASK_1.5_TEST_AND_VALIDATE.md`

---

## Troubleshooting

**Common issues:**

-   Problem: Storage keywords not recognized → Solution: Check Task 1.2 was completed correctly
-   Problem: @ or $ not tokenizing → Solution: Check Task 1.3 operator additions
-   Problem: Hex literals not parsing → Solution: Verify existing hex literal support in lexer

```

```
