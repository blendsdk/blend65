# Blend65 Compiler Capabilities Analysis Prompt

## **TRIGGER KEYWORD: `cap65`**

When the user types "cap65", execute this comprehensive analysis to create a detailed capabilities document for the Blend65 compiler.

---

## **CRITICAL INSTRUCTION: NEVER ASSUME - ALWAYS ANALYZE**

**SPLIT AND BREAKDOWN THIS TASK INTO MANY SMALL AND GRANULAR STEPS TO PREVENT A.I. CONTEXT LIMITATIONS**

**📖 See `specification-compliance.md` for the complete "Never Assume" protocol.**

**Before implementing ANY analysis component, ALWAYS query the actual source code FIRST:**

1. ⚠️ **STOP** - Do not proceed with assumptions
2. 📖 **READ** - Query actual lexer/parser source code
3. ✅ **VERIFY** - Confirm exact capabilities through code examination
4. 🔍 **CROSS-REFERENCE** - Check test files for working examples
5. 💭 **VALIDATE** - Test findings against language specification

---

## **ANALYSIS FRAMEWORK**

### **Phase 1: Source Code Analysis (MANDATORY)**

**1.1 Lexer Implementation Analysis**

- Read: `packages/compiler/src/lexer/lexer.ts`
- Read: `packages/compiler/src/lexer/types.ts`
- Analyze: All token types, operators, keywords, literals
- Document: Number formats, string handling, comment processing
- Examine: Storage class tokenization (@zp, @ram, @data, @map)

**1.2 Parser Architecture Analysis**

- Read: `packages/compiler/src/parser/parser.ts` (final concrete class)
- Read: `packages/compiler/src/parser/base.ts` (foundation)
- Read: `packages/compiler/src/parser/expressions.ts` (expression parsing)
- Read: `packages/compiler/src/parser/declarations.ts` (declaration parsing)
- Read: `packages/compiler/src/parser/modules.ts` (module parsing)
- Read: `packages/compiler/src/parser/statements.ts` (statement parsing)
- Analyze: Complete inheritance chain architecture
- Document: Pratt parser implementation and precedence

**1.3 Test File Examination**

- Search: `packages/compiler/src/__tests__/` for all test files
- Analyze: Working examples from lexer tests
- Analyze: Working examples from parser tests
- Extract: Real-world usage patterns
- Identify: Edge cases and error scenarios

**1.4 Language Specification Cross-Reference**

- Read: `docs/language-specification/README.md`
- Read: `docs/language-specification/06-expressions-statements.md`
- Cross-reference: Implementation vs specification
- Identify: Specification compliance gaps
- Document: Intended vs implemented features

---

## **DOCUMENT STRUCTURE REQUIREMENTS**

### **Document Format: `Blend65-Compiler-Capabilities-Analysis.md`**

**Required Sections:**

```markdown
# Blend65 Compiler Capabilities Analysis

> **Status**: Comprehensive Analysis
> **Date**: [Current Date]
> **Analysis Scope**: Lexer + Parser Implementation
> **Source**: `/packages/compiler/src/lexer/` + `/packages/compiler/src/parser/`

## Executive Summary

[Capability highlights and major limitations]

# What Blend65 CAN Tokenize and Parse

[Detailed capabilities with extensive examples]

# What Blend65 CANNOT Parse

[Current limitations and missing features]

# Conclusion

[Development readiness assessment]
```

---

## **CONTENT REQUIREMENTS**

### **Code Example Standards (CRITICAL)**

**✅ REQUIRED: Wrap ALL Blend source code in ```js blocks**

````markdown
```js
// Blend code example here
let counter: byte = 0;
@map borderColor at $D020: byte;
```
````

```

**✅ REQUIRED: Provide 100+ working code examples covering:**
- All number formats (decimal, $hex, 0xhex, 0binary)
- All operators (arithmetic, comparison, logical, bitwise, assignment)
- All keywords and storage classes
- All expression types (unary, binary, function calls, member access)
- All declaration types (variables, @map, functions)
- Real-world C64 programming patterns

### **Analysis Depth Requirements**

**1. Lexical Analysis Coverage:**
- Complete tokenization capabilities
- Number literal parsing (all formats)
- String literal handling (escape sequences)
- Comment processing (line and block)
- Operator tokenization (all categories)
- Keyword recognition (all categories)
- Storage class tokenization
- Error handling and recovery

**2. Parser Analysis Coverage:**
- Program structure parsing (modules, declarations)
- Variable declaration parsing (all storage classes, export modifiers)
- Memory-mapped declaration parsing (all 4 @map forms)
- Expression parsing (complete Pratt parser analysis)
- Function declaration parsing (parameters, modifiers)
- Error recovery and diagnostics
- Inheritance chain architecture analysis

**3. Integration Analysis:**
- Real-world C64 hardware access patterns
- Complex expression compositions
- Module-level organization
- Error handling strategies

### **Limitation Documentation Requirements**

**✅ REQUIRED: Document what CANNOT be parsed:**
- Statement implementation gaps
- Missing language features
- Unsupported syntax patterns
- Implementation phase limitations
- Specification compliance gaps

---

## **ANALYSIS METHODOLOGY**

### **Step-by-Step Process**

**Step 1: Comprehensive Source Reading**
```

- Read ALL lexer source files completely
- Read ALL parser source files completely
- Read inheritance chain in dependency order
- Document exact capabilities found in code

```

**Step 2: Test File Analysis**
```

- Search all test files for working examples
- Extract proven syntax patterns
- Identify edge cases and error handling
- Document real-world usage examples

```

**Step 3: Specification Cross-Reference**
```

- Compare implementation to language specification
- Identify compliance gaps and deviations
- Document intended vs actual behavior
- Note specification-compliant restrictions

```

**Step 4: Integration Pattern Analysis**
```

- Analyze complex expression compositions
- Document C64-specific patterns
- Examine real-world programming examples
- Test boundary conditions and edge cases

```

**Step 5: Limitation Assessment**
```

- Identify parser phase limitations
- Document missing language features
- Analyze architectural constraints
- Assess development readiness

````

---

## **QUALITY STANDARDS**

### **Analysis Quality Requirements**

**✅ Production-Quality Analysis:**
- Deep granular examination of ALL compiler components
- Extensive code examples demonstrating every capability
- Clear architectural understanding (inheritance chain analysis)
- Comprehensive error handling and recovery documentation
- Real-world integration patterns and use cases

**✅ Specification Compliance Focus:**
- Always reference language specification
- Document compliance enforcement mechanisms
- Identify non-compliant syntax rejection
- Cross-reference implementation decisions

**✅ Development Assessment:**
- Clear identification of current capabilities
- Honest assessment of limitations
- Development phase awareness
- Roadmap implications

### **Example Quality Standards**

**✅ GOOD Example Section:**
```markdown
### 5.3 Unary Expressions

All unary operators are supported with proper precedence:

```js
// Logical NOT
let opposite = !gameRunning;
let doubleNot = !!value;  // Convert to boolean

// Bitwise NOT
let inverted = ~mask;
let flipped = ~$FF;

// Address-of operator
let bufferAddr = @buffer;
let counterAddr = @counter;

// Nested unary operators
let complex = ~-value;
let chained = !!flag;
````

The parser implements right-associative parsing for unary operators...
[Technical explanation of implementation]

````

**❌ INSUFFICIENT Example:**
```markdown
### Expressions
The parser can handle expressions.
````

---

## **DOCUMENT DELIVERY REQUIREMENTS**

### **File Creation and Management**

**✅ Prepare:** Remove `Blend65-Compiler-Capabilities-Analysis.md` if already exists! DO NOT UPDATE THE DOCUMENT
**✅ Create:** `Blend65-Compiler-Capabilities-Analysis.md` at project root
**✅ Include:** Executive summary with capability highlights
**✅ Provide:** 1000+ lines of comprehensive analysis
**✅ Demonstrate:** 100+ working Blend65 code examples
**✅ Document:** Both capabilities AND limitations thoroughly

### **Success Criteria**

**The analysis is successful when:**

1. ✅ Document contains 1000+ lines of detailed analysis
2. ✅ 100+ working Blend65 code examples included
3. ✅ All compiler components analyzed (lexer, parser, AST)
4. ✅ Both capabilities and limitations clearly documented
5. ✅ Real-world C64 programming patterns demonstrated
6. ✅ Inheritance chain architecture fully explained
7. ✅ Development readiness clearly assessed
8. ✅ All code examples wrapped in ```js blocks
9. ✅ Executive summary provides clear overview
10. ✅ Conclusion offers actionable development insights

---

## **EXECUTION PROTOCOL**

### **When "cap65" is triggered:**

1. **IMMEDIATELY begin with source code analysis** - NO assumptions
2. **Read lexer implementation completely** - Document exact capabilities
3. **Read parser inheritance chain systematically** - Understand architecture
4. **Examine test files for working examples** - Extract proven patterns
5. **Cross-reference language specification** - Ensure compliance awareness
6. **Create comprehensive analysis document** - Follow all requirements above
7. **Verify all quality standards met** - 100+ examples, 1000+ lines
8. **Provide development readiness assessment** - Honest capability evaluation

### **Critical Success Factors**

**🚨 NEVER assume capabilities - ALWAYS verify through code analysis**
**🚨 ALWAYS provide extensive working code examples**
**🚨 ALWAYS wrap Blend code in ```js blocks**
**🚨 ALWAYS document both capabilities AND limitations**
**🚨 ALWAYS assess development readiness honestly**

---

## **INTEGRATION WITH EXISTING RULES**

This capability analysis integrates with:

- **specification-compliance.md** - Never assume, always verify
- **agents.md** - Task granularity and verification procedures
- **code.md** - Quality standards and testing requirements

When executing "cap65", apply ALL relevant .clinerules standards while focusing on comprehensive capability analysis.

---

## **MAINTENANCE INSTRUCTIONS**

**This prompt should be updated when:**

- New compiler phases are implemented
- Language specification changes significantly
- Parser architecture evolves
- New testing patterns emerge
- Additional analysis depth is required

**The "cap65" trigger ensures:**

- Consistent analysis methodology
- Comprehensive coverage every time
- Quality standard compliance
- Repeatable results
- Up-to-date capability assessment