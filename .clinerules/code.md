# Coding Standards

## IMPORTANT

These rules are **mandatory** and must be applied **strictly and consistently** across the entire codebase.

## 1. Code Quality & Structure

1. **DRY Principle (Don’t Repeat Yourself)**
   - Eliminate duplicated logic, constants, and patterns.
   - Extract reusable logic into functions, classes, hooks, or utilities.
   - If code looks similar in more than one place, refactor it.

2. **Clarity Over Cleverness**
   - Write code that is easy to read and reason about.
   - Prefer explicit, understandable logic over short or “smart” solutions.

3. **Single Responsibility**
   - Each function, method, or class must have **one clear responsibility**.
   - Avoid large functions that perform multiple unrelated tasks.

## 2. Testing Requirements

4. **All Tests Must Pass**
   - No code may be merged or delivered if **any test fails**.
   - If existing behavior changes, tests must be updated accordingly.

5. **Tests Are Part of the Code**
   - Tests must be readable, meaningful, and maintained with the same care as production code.
   - Avoid flaky or unclear tests.

6. **Maximum Test Coverage**
   - Always create the maximum amount of possible tests.
   - Sophisticated and granular tests are essential.
   - Each function, method, and component should have multiple test cases covering:
     - Normal/happy path scenarios
     - Edge cases and boundary conditions
     - Error conditions and invalid inputs
     - Integration with other components

7. **End-to-End Testing**
   - Always create end-to-end tests where possible.
   - Test complete workflows from start to finish (e.g., source → lexer → parser → code generation).
   - Ensure the entire system works together correctly.
   - End-to-end tests validate real-world usage scenarios.

8. **Test Granularity**
   - Write granular, focused tests that test one thing at a time.
   - Each test should have a clear purpose and failure message.
   - Small, specific tests are easier to debug when they fail.
   - See also: plans.md Rule 8 for task-level testing requirements.

## 3. Documentation & Comments

9. **Mandatory Code Comments**
   - Comment _why_ something is done, not just _what_ is done.
   - Complex logic, edge cases, and non-obvious decisions must always be explained.

10. **Assume a Junior Developer as the Reader**
    - Write comments so that a junior developer can understand:
      - The intent of the code
      - The workflow
      - Any assumptions or constraints

11. **JSDoc Is Required**
    - Every public and protected class, method, function, and component must have JSDoc.
    - JSDoc must describe:
      - Purpose
      - Parameters
      - Return values
      - Side effects (if any)

## 4. Object-Oriented Rules

12. **No Private Class Members**

- Do **not** use `private` methods or properties.
- Methods and properties must be either:
  - `public`, or
  - `protected` (used instead of `private`)

13. **Encapsulation Through Convention**
    - `protected` members are considered internal and must not be accessed outside subclasses.
    - Document protected members clearly in JSDoc.

## 5. Maintainability First

14. **Code Must Be Easy to Maintain and Extend**
    - Optimize for long-term maintainability, not short-term speed.
    - Future changes should be easy and safe to implement.

15. **Consistency Is Non-Negotiable**
    - Follow existing patterns, naming conventions, and architecture.
    - Do not introduce new styles or patterns without a strong reason.

16. **Imports**
    - Never do dynamic imports like `var module = require('....)` or `{......} = require('.....')`

## 6. Inheritance Chain Architecture

17. **MUST Use Inheritance Chains WHEN Implementation Exceeds 500 Lines**
    - When any implementation WILL exceed **500 lines** OR has multiple logical concerns
    - Break into inheritance chain: `Base → Layer1 → Layer2 → ... → Concrete`
    - Each layer: **200-500 lines maximum**
    - Natural dependency flow (each layer builds on previous)
    - Perfect for AI context window limitations

18. **Inheritance Chain Design Principles**
    - **Foundation First**: Base class contains core utilities and infrastructure
    - **Logical Layers**: Each layer adds one primary concern (expressions, statements, etc.)
    - **Clean Dependencies**: Upper layers can use everything below them
    - **Protected Methods**: Use `protected` for inheritance, not composition
    - **Single Concrete**: Only the final class in chain should be concrete

19. **File Naming Conventions for Inheritance Chains**
    - `base.ts` - Foundation class with core utilities
    - `[feature].ts` - Specialized layers (expressions.ts, declarations.ts, etc.)
    - `[main].ts` - Final concrete class (parser.ts, compiler.ts, etc.)
    - `index.ts` - Exports all layers for external use
    - **Example**: `base.ts → expressions.ts → declarations.ts → modules.ts → parser.ts`

20. **When to Use Inheritance Chains**
    - ✅ Parsers, compilers, code generators, analyzers
    - ✅ Complex systems with natural layer dependencies
    - ✅ Any class approaching 500+ lines
    - ✅ Systems that will grow significantly over time
    - ❌ Simple utilities or data structures
    - ❌ Classes with single, focused responsibilities

## 7. TypeScript Type Checking Best Practices

22. **No Inline Dynamic Imports for Types**
    - Do **not** use inline import expressions for type references
    - Always add proper import statements at the top of the file
    
    ❌ **Wrong:**
    ```typescript
    function example(expr: import('../ast/base.js').Expression): void
    ```
    
    ✅ **Correct:**
    ```typescript
    import type { Expression } from '../ast/base.js';
    function example(expr: Expression): void
    ```

23. **No constructor.name Comparisons**
    - Do **not** use `constructor.name` for type checking
    - Always use `instanceof` operator or type guard functions
    
    ❌ **Wrong:**
    ```typescript
    if (node.constructor.name === 'VariableDecl') { ... }
    ```
    
    ✅ **Correct:**
    ```typescript
    import { isVariableDecl } from '../ast/type-guards.js';
    if (isVariableDecl(node)) { ... }
    // OR
    if (node instanceof VariableDecl) { ... }
    ```

24. **No Hardcoded String Type Comparisons**
    - Do **not** use hardcoded string literals for AST node type checks
    - Always use `ASTNodeType` enum or type guard functions
    
    ❌ **Wrong:**
    ```typescript
    if (stmt.getNodeType() === 'VariableDecl') { ... }
    ```
    
    ✅ **Correct:**
    ```typescript
    import { ASTNodeType } from '../ast/base.js';
    if (stmt.getNodeType() === ASTNodeType.VARIABLE_DECL) { ... }
    // OR (preferred - enables type narrowing)
    import { isVariableDecl } from '../ast/type-guards.js';
    if (isVariableDecl(stmt)) { ... }
    ```

## 8. Testing Integrity Rules

25. **MUST NOT Mock Real Objects That Exist**
    - Do **not** mock objects in tests when the real object exists and has been developed
    - Use real implementations instead of fake mock objects
    - Helper functions that create simple data structures (e.g., `createMockLocation()` for `SourceLocation`) are acceptable
    
    ❌ **Wrong (mocking a real class):**
    ```typescript
    // GlobalSymbolTable exists as a real class!
    const mockSymbolTable = { lookup: () => undefined } as any;
    const analyzer = new M6502HintAnalyzer(mockSymbolTable, new Map());
    ```
    
    ✅ **Correct (use real class):**
    ```typescript
    import { GlobalSymbolTable } from '../semantic/global-symbol-table.js';
    const symbolTable = new GlobalSymbolTable();
    const analyzer = new M6502HintAnalyzer(symbolTable, new Map());
    ```
    
    **Acceptable patterns:**
    - Helper functions for simple data structures: `createTestLocation()`, `createTestParameter()`
    - Test fixtures that create valid instances of simple types
    - Stub implementations only when the real implementation doesn't exist yet

26. **MUST Avoid `as any` Type Bypassing in Production Code**
    - Do **not** use `as any` to bypass TypeScript type checking
    - Use proper type guards, assertions, or fix the underlying type issue
    - Test files may use `as any` sparingly for test setup, but prefer proper typing

27. **🚨 NON-NEGOTIABLE: MUST Use Complete Interface Compliance When Creating Objects**
    - When creating ANY object that implements an interface or type, you MUST provide ALL required fields with proper types
    - This applies to BOTH production code AND test code
    
    **1. Use proper enums - NEVER hardcoded strings:**
    
    ❌ **Wrong:**
    ```typescript
    kind: 'variable' as const,
    kind: 'byte',
    ```
    
    ✅ **Correct:**
    ```typescript
    kind: SymbolKind.Variable,
    kind: TypeKind.Byte,
    ```
    
    **2. Provide ALL required interface fields - NO shortcuts:**
    
    ❌ **Wrong (missing fields!):**
    ```typescript
    type: { name: 'byte', size: 1 }
    ```
    
    ✅ **Correct (all fields provided):**
    ```typescript
    type: { kind: TypeKind.Byte, name: 'byte', size: 1, isSigned: false, isAssignable: true }
    ```
    
    **3. Use proper type guards - NEVER optional chaining hacks:**
    
    ❌ **Wrong (hoping method exists):**
    ```typescript
    const name = decl.getName?.();
    if (name) { ... }
    ```
    
    ✅ **Correct (type narrowed properly):**
    ```typescript
    if (isVariableDecl(decl)) {
      const name = decl.getName(); // TypeScript knows this exists
    }
    ```
    
    **4. Use proper references - NEVER hardcoded string placeholders:**
    
    ❌ **Wrong:**
    ```typescript
    scope: 'global',
    ```
    
    ✅ **Correct:**
    ```typescript
    scope: symbolTable.getCurrentScope(),
    ```
    
    **Why This Rule Exists:**
    - Incomplete objects cause runtime failures that TypeScript should prevent
    - String literals break silently when enums are refactored
    - Optional chaining hides real type errors
    - TypeScript's type system is designed to catch these problems - USE IT!
    - Test code with shortcuts creates false confidence (tests pass but production breaks)

## 9. Final Rule

28. **If in Doubt, Be Explicit**
    - Prefer more readable code, more comments, and clearer structure over fewer lines of code.

---

## **Cross-References**

- See **plans.md** for task-level testing breakdowns and implementation planning
- See **agents.md** for verification procedures and task completion criteria
- See **plans.md Rule 10** for inheritance chain planning guidelines
- Note: Testing rules in this file (Rules 4-8) are the single source of truth for all testing standards
- Note: Inheritance chain rules in this file (Rules 17-20) are the single source of truth for architectural standards