# Specification Compliance Rules

## **🚨 ULTRA-CRITICAL RULE: Language Specification is Source of Truth 🚨**

**The language specification in `docs/language-specification/` is the authoritative source of truth for ALL language features.**

**⚠️ REFERENCE THE ULTRA-CRITICAL RULE:** See `.clinerules/agents.md` for the comprehensive "Never Assume" protocol that must be followed before implementing ANY compiler subcomponent.

---

## **Compiler Implementation Never Assume Checklist**

**Before implementing ANY compiler feature, verify these are NOT assumptions:**

### **🔤 Lexer/Tokenization - Never Assume:**

- ✅ **Token Types**: Read specification for exact token definitions
- ✅ **Keywords**: Verify reserved word list in language spec
- ✅ **Operators**: Confirm operator symbols and their meanings
- ✅ **Comments**: Check documented comment syntax (NOT `#` style!)
- ✅ **String Literals**: Verify escape sequences and delimiters
- ✅ **Numbers**: Confirm integer/float parsing rules
- ✅ **Whitespace**: Check space/tab/newline handling rules

### **🌳 Parser/AST - Never Assume:**

- ✅ **Grammar Rules**: Read EBNF grammar definitions
- ✅ **Precedence**: Verify operator precedence tables
- ✅ **Associativity**: Confirm left/right associativity rules
- ✅ **AST Structure**: Check documented node relationships
- ✅ **Statements vs Expressions**: Verify classification rules
- ✅ **Block Syntax**: Confirm scoping and delimiter rules

### **📋 Type System - Never Assume:**

- ✅ **Type Definitions**: Read type system specification
- ✅ **Type Inference**: Verify inference rules and constraints
- ✅ **Conversions**: Check type coercion behavior
- ✅ **Generics**: Verify template/generic mechanisms
- ✅ **Memory Layout**: Confirm size and alignment rules

### **🔧 Code Generation - Never Assume:**

- ✅ **Target Architecture**: Verify 6502-specific requirements
- ✅ **Instruction Selection**: Check documented code patterns
- ✅ **Memory Mapping**: Verify address space layout
- ✅ **Optimization**: Confirm allowed optimization rules
- ✅ **Runtime Conventions**: Check calling convention specs

### **⚠️ Error Handling - Never Assume:**

- ✅ **Error Messages**: Use specification-defined formats
- ✅ **Recovery Strategies**: Follow documented recovery rules
- ✅ **Diagnostic Levels**: Use specified severity classifications
- ✅ **Error Propagation**: Follow documented error flow patterns

---

## **Common Dangerous Assumptions in Compiler Work**

### **❌ DANGEROUS ASSUMPTION EXAMPLES:**

**Lexer Assumptions:**

- ❌ "Obviously `#` starts a comment" → ✅ Check specification first
- ❌ "Numbers work like JavaScript" → ✅ Verify Blend number syntax
- ❌ "String escapes are standard" → ✅ Read documented escape rules

**Parser Assumptions:**

- ❌ "Precedence follows C/JavaScript" → ✅ Check Blend precedence table
- ❌ "Blocks use curly braces" → ✅ Verify Blend block syntax
- ❌ "Semicolons are required" → ✅ Read statement termination rules

**Type System Assumptions:**

- ❌ "Types work like TypeScript" → ✅ Read Blend type system spec
- ❌ "Inference follows ML rules" → ✅ Check Blend inference behavior
- ❌ "Memory is auto-managed" → ✅ Verify 6502 memory requirements

**Code Generation Assumptions:**

- ❌ "Standard register allocation" → ✅ Check 6502 register constraints
- ❌ "Modern calling conventions" → ✅ Verify Blend ABI requirements
- ❌ "Optimization is always safe" → ✅ Check documented restrictions

---

## **Specification Query Protocol for Each Compiler Phase**

### **Phase 1: Before Writing ANY Code**

1. 🛑 **STOP** - Do not proceed with implementation
2. 📖 **READ** - Open `docs/language-specification/README.md`
3. 🎯 **IDENTIFY** - Find relevant specification section(s)
4. 📋 **READ THOROUGHLY** - Understand exact requirements
5. 🔍 **CROSS-CHECK** - Verify with EBNF grammar and examples

### **Phase 2: During Implementation**

1. ❓ **QUESTION** - Challenge every implementation decision
2. 📖 **VERIFY** - Cross-reference with specification continuously
3. 🧪 **TEST** - Use specification examples as test cases
4. 🔄 **ITERATE** - Update implementation to match spec exactly

### **Phase 3: After Implementation**

1. ✅ **VALIDATE** - All behavior matches specification
2. 🧪 **TEST COMPLIANCE** - Every test case follows documented syntax
3. 📋 **DOCUMENT** - Note any specification gaps discovered
4. 🔍 **AUDIT** - Review for undocumented features or assumptions

---

## **Rules for Implementation Changes**

### **Rule 1: Specification-First Development**

**Before implementing ANY language feature:**

1. ✅ **Check the language specification first**
   - Read relevant sections in `docs/language-specification/`
   - Verify the feature is documented and defined
   - Understand the exact syntax and semantics

2. ✅ **If feature is NOT in specification:**
   - ❌ DO NOT implement it
   - ✅ Create a language specification update first
   - ✅ Get approval for the language change
   - ✅ Follow the language specification modification process

3. ✅ **If feature IS in specification:**
   - ✅ Implement according to the documented syntax
   - ✅ Follow the specified behavior exactly
   - ✅ Test against the documented examples

---

### **Rule 2: No Ad-Hoc Language Features**

**Never add language features to fix failing tests without specification approval.**

**What NOT to do:**

- ❌ Add new comment styles (like `#`) to fix lexer errors
- ❌ Add new operators to fix parser tests
- ❌ Change syntax to make tests pass
- ❌ Implement "helpful" features not in the spec

**What TO do:**

- ✅ Fix the tests to match the specification
- ✅ Report specification gaps if found
- ✅ Propose specification changes through proper channels
- ✅ Implement only documented features

---

### **Rule 3: Specification Review Process**

**When modifying language features:**

1. **Read Current Specification**
   - Review `docs/language-specification/README.md` for structure
   - Read relevant section(s) thoroughly
   - Understand existing syntax and semantics

2. **Check for Conflicts**
   - Ensure new features don't conflict with existing ones
   - Verify backward compatibility
   - Check for ambiguities in grammar

3. **Update Specification First**
   - Follow `.clinerules/lang.md` rules for specification changes
   - Update EBNF grammar if needed
   - Add examples and usage patterns
   - Update table of contents

4. **Implement After Approval**
   - Only implement features after specification is updated
   - Test implementation against specification examples
   - Ensure complete compliance

---

### **Rule 4: Testing Compliance**

**All tests must comply with the language specification:**

1. **Test Syntax Validation**
   - Tests should only use syntax documented in the specification
   - Error tests should only use truly invalid syntax
   - Don't test implementation-specific features not in spec

2. **Error Handling Tests**
   - Use parser-level errors for error recovery tests
   - Avoid lexer exceptions that prevent error recovery
   - Test with syntactically valid but semantically invalid code

3. **Example Validation**
   - All test examples should be valid according to the specification
   - Don't use undocumented language features in tests
   - Verify test code against language grammar

---

### **Rule 5: Specification Audit Process**

**Regular audits to prevent drift:**

1. **Monthly Specification Review**
   - Compare implementation with specification
   - Identify any undocumented features
   - Flag specification gaps or inconsistencies

2. **Pre-Release Compliance Check**
   - Verify all implemented features are documented
   - Ensure no ad-hoc features exist
   - Validate all examples in specification work with implementation

3. **Documentation Quality**
   - Keep specifications up-to-date with implementation
   - Ensure examples are tested and valid
   - Maintain consistency in terminology

---

## **What Went Wrong: '#' Comments Case Study**

### **The Mistake**

1. **Problem**: Test failed because lexer encountered `#` character
2. **Wrong Solution**: Added `#` comment support to lexer without checking specification
3. **Result**: Implementation now supports undocumented language feature
4. **Impact**: Language specification and implementation are inconsistent

### **Correct Approach Should Have Been**

1. ✅ **Check specification**: Look for `#` comment documentation
2. ✅ **Find it missing**: Specification only documents `//` and `/* */` comments
3. ✅ **Fix the test**: Change test to expect `#` as unexpected character
4. ✅ **Maintain compliance**: Keep implementation aligned with specification

### **Prevention Measures**

- **Always read specification first** before implementing features
- **Question failing tests** - are they testing documented behavior?
- **Use specification as validation** for all implementation decisions
- **Update specification first** if new features are truly needed

---

## **Emergency Fix Protocol**

**When specification/implementation mismatches are discovered:**

1. **Immediate Assessment**
   - Determine which is correct: specification or implementation
   - Assess impact of fixing the mismatch
   - Document the discrepancy

2. **Choose Correction Path**
   - **If implementation is wrong**: Fix implementation to match spec
   - **If specification is wrong**: Update specification with proper review
   - **If both are wrong**: Follow standard specification change process

3. **Fix and Validate**
   - Make the necessary changes
   - Run full test suite
   - Verify consistency is restored

4. **Prevent Recurrence**
   - Document the mistake in this file
   - Update development processes if needed
   - Add checks to prevent similar issues

---

## **Summary: Never Repeat the '#' Comments Mistake**

**Key Takeaways:**

1. 🔍 **Specification First**: Always check docs before implementing
2. ❌ **No Ad-Hoc Features**: Don't add features to fix tests
3. 📋 **Update Docs First**: Specification changes precede implementation
4. ✅ **Fix Tests Instead**: Make tests comply with specification
5. 🔄 **Regular Audits**: Prevent specification drift

**Remember**: The specification defines the language. The implementation serves the specification, not the other way around.

---

## **Cross-References**

- See **lang.md** for language specification modification procedures
- See **agents.md** for verification and completion criteria
- See **code.md** for testing standards and quality requirements
