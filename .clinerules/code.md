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

## 3. Documentation & Comments

6. **Mandatory Code Comments**
   - Comment _why_ something is done, not just _what_ is done.
   - Complex logic, edge cases, and non-obvious decisions must always be explained.

7. **Assume a Junior Developer as the Reader**
   - Write comments so that a junior developer can understand:
     - The intent of the code
     - The workflow
     - Any assumptions or constraints

8. **JSDoc Is Required**
   - Every public and protected class, method, function, and component must have JSDoc.
   - JSDoc must describe:
     - Purpose
     - Parameters
     - Return values
     - Side effects (if any)

## 4. Object-Oriented Rules

9. **No Private Class Members**
   - Do **not** use `private` methods or properties.
   - Methods and properties must be either:
     - `public`, or
     - `protected` (used instead of `private`)

10. **Encapsulation Through Convention**
    - `protected` members are considered internal and must not be accessed outside subclasses.
    - Document protected members clearly in JSDoc.

## 5. Maintainability First

11. **Code Must Be Easy to Maintain and Extend**
    - Optimize for long-term maintainability, not short-term speed.
    - Future changes should be easy and safe to implement.

12. **Consistency Is Non-Negotiable**
    - Follow existing patterns, naming conventions, and architecture.
    - Do not introduce new styles or patterns without a strong reason.

## 6. Final Rule

13. **If in Doubt, Be Explicit**
    - Prefer more readable code, more comments, and clearer structure over fewer lines of code.
