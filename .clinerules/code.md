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

## 6. Final Rule

16. **If in Doubt, Be Explicit**
    - Prefer more readable code, more comments, and clearer structure over fewer lines of code.

---

## **Cross-References**

- See **plans.md** for task-level testing breakdowns and implementation planning
- See **agents.md** for verification procedures and task completion criteria
- Note: Testing rules in this file (Rules 4-8) are the single source of truth for all testing standards
