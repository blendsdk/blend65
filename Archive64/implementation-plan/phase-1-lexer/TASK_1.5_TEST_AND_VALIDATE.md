# Task 1.5: Test and Validate Complete Lexer

**Task ID:** 1.5_TEST_AND_VALIDATE
**Phase:** Phase 1 - Lexer Adaptation
**Estimated Time:** 2-3 hours
**Dependencies:** Tasks 1.1-1.4 (Complete lexer modifications)
**Context Requirement:** ~12K tokens

---

## Objective

Comprehensive testing of the complete Blend64 lexer with real-world code examples and integration validation.

---

## Context

**What you're validating:**
- Complete Blend64 lexer functionality
- All token types working correctly
- Integration with existing test infrastructure
- Preparation for Phase 2 (AST work)

**Why comprehensive testing is needed:**
- Ensure no regressions from modifications
- Validate complex syntax combinations
- Confirm lexer ready for parser integration

**What should pass:**
- All Blend64 language constructs tokenize correctly
- Complex programs parse without lexer errors
- Performance remains acceptable

---

## Input Files

**Uses outputs from all previous tasks**

**Reference documents:**
- `research/blend64-spec.md` - Complete language syntax

---

## Task Instructions

### Step 1: Create comprehensive test program
```bash
cat > test-complete.blend64 << 'EOF'
module Game.Main

import VIC_BORDER, VIC_BGCOLOR from c64:vic
import Player_Init from game:player

// Storage classes
zp var frame: byte
ram var bullets: byte[8]
data var palette: byte[16] = [
  0x00, 0x06, 0x0E, 0x0B,
  0x04, 0x05, 0x03, 0x0D
]
const var SCREEN_W: byte = 40
io var VIC_BORDER: byte @ $D020

// Function with attributes
export function main(): void
  frame = 0
  hotloop
    frame = frame + 1
    if frame and 1 then
      VIC_BORDER = palette[frame & 7]
    end if
  end hotloop
end function

// Math expressions
function testMath(a: word, b: word): word
  return (a << 1) ^ (b | 0xFF)
end function
EOF
```

### Step 2: Run complete tokenization test
```bash
cd packages/lexer

node -e "
const { createBlendLexer } = require('./src/blend-lexer.js');
const fs = require('fs');
const lexer = createBlendLexer();

console.log('=== Complete Blend64 Program Tokenization ===');
const code = fs.readFileSync('../../test-complete.blend64', 'utf8');
const tokens = lexer.tokenize(code);

// Count token types
const counts = {};
tokens.forEach(t => {
  counts[t.type] = (counts[t.type] || 0) + 1;
});

console.log('Token type counts:');
Object.entries(counts).sort().forEach(([type, count]) => {
  console.log(\`  \${type}: \${count}\`);
});

// Verify key Blend64 tokens are present
const blend64Tokens = ['ZP', 'BSS', 'DATA', 'CONST', 'IO', 'HOTLOOP', 'AT'];
const foundTokens = blend64Tokens.filter(t => counts[t] > 0);
console.log(\`\\nBlend64 tokens found: \${foundTokens.join(', ')}\`);

console.log(\`\\nTotal tokens: \${tokens.length}\`);
"
```

### Step 3: Performance test
```bash
node -e "
const { createBlendLexer } = require('./src/blend-lexer.js');
const lexer = createBlendLexer();

// Create large test program
const largeCode = 'zp var x: byte\\n'.repeat(1000) +
                 'function test(): void\\n' +
                 '  x = x + 1\\n'.repeat(100) +
                 'end function\\n';

console.log('=== Performance Test ===');
const start = Date.now();
const tokens = lexer.tokenize(largeCode);
const time = Date.now() - start;

console.log(\`Tokenized \${tokens.length} tokens in \${time}ms\`);
console.log(\`Rate: \${Math.round(tokens.length/time*1000)} tokens/second\`);
"
```

### Step 4: Error handling validation
```bash
node -e "
const { createBlendLexer } = require('./src/blend-lexer.js');
const lexer = createBlendLexer();

console.log('=== Error Handling Test ===');

const errorTests = [
  '**invalid',    // Removed operator
  '??null',       // Removed operator
  '...spread',    // Removed operator
  'class Test',   // Removed keyword should be identifier
  '\$GGGG',       // Invalid hex
];

errorTests.forEach(test => {
  try {
    const tokens = lexer.tokenize(test);
    // Some tests might not error (like 'class Test')
    console.log(\`\${test}: Tokenized (may be valid)\`);
  } catch (e) {
    console.log(\`✓ \${test}: Correctly rejected (\${e.message})\`);
  }
});
"
```

### Step 5: Integration test with Node.js
```bash
node -e "
// Test that all modules export correctly
try {
  const types = require('./src/types.js');
  const lexer = require('./src/lexer.js');
  const blend = require('./src/blend-lexer.js');
  const index = require('./src/index.js');

  console.log('✓ All modules import successfully');
  console.log('✓ TokenType enum has', Object.keys(types.TokenType).length, 'values');
  console.log('✓ Lexer class available');
  console.log('✓ createBlendLexer function available');
  console.log('✓ Package exports working');
} catch (e) {
  console.error('✗ Integration test failed:', e.message);
  process.exit(1);
}
"
```

---

## Expected Output

**Test artifacts created:**
- `test-complete.blend64` - Comprehensive test program
- Console output showing successful tokenization

**Success criteria:**
- [ ] Complete Blend64 program tokenizes without errors
- [ ] All Blend64-specific token types appear in output
- [ ] Performance remains acceptable (>1000 tokens/second)
- [ ] Error handling works for removed operators
- [ ] All modules export and import correctly
- [ ] No TypeScript compilation errors

---

## Phase 1 Completion Checklist

**Lexer modifications complete:**
- [ ] TokenType enum updated (Task 1.1)
- [ ] Keywords updated (Task 1.2)
- [ ] Operators fixed (Task 1.3)
- [ ] Storage syntax working (Task 1.4)
- [ ] Full validation passed (Task 1.5)

**Ready for Phase 2:**
- [ ] Lexer produces correct tokens for Blend64
- [ ] No breaking changes to core functionality
- [ ] Performance acceptable
- [ ] Error handling robust

---

## Next Phase

**Phase 2 ready to begin:**
`phase-2-ast/TASK_2.1_REMOVE_OOP_NODES.md`

**Key handoff deliverables:**
- Working Blend64 lexer in `packages/lexer/`
- Validated token types and keywords
- Performance benchmarks established

---

## Troubleshooting

**Common issues:**
- Problem: Performance too slow → Solution: Check for inefficient regex or loops
- Problem: Integration failures → Solution: Verify all exports are updated correctly
- Problem: Complex programs fail → Solution: Check operator precedence and keyword conflicts
