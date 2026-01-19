### A.I Agent Instructions for Creating Implementation Plans

## **IMPORTANT**

These rules are **mandatory** and must be applied **strictly and consistently** when creating implementation plans.

---

## **Rules for Implementation Plans**

### **Rule 1: Split Plans into Logical Phases**

When asked to create implementation plans, always split the plan into **logical phases** that can be implemented sequentially.

**What Makes a Good Phase:**

- ✅ Represents a complete, cohesive unit of work
- ✅ Has clear start and end points
- ✅ Can be implemented and tested independently
- ✅ Builds upon previous phases
- ✅ Typically takes 2-5 tasks to complete

**Examples:**

❌ **Bad Phase Breakdown:**

- Phase 1: "Build everything"
- Phase 2: "Test and deploy"

✅ **Good Phase Breakdown:**

- Phase 1: Core Type System
- Phase 2: Basic Parser Implementation
- Phase 3: Advanced Parser Features
- Phase 4: Code Generation
- Phase 5: Testing Infrastructure

---

### **Rule 2: Define Phase Dependencies**

For each phase, explicitly define dependencies from the previous phase.

**How to Document Dependencies:**

```markdown
## Phase 2: Basic Parser Implementation

**Dependencies:**

- Phase 1 must be complete (type definitions available)
- Token types from Phase 1.2 must be tested
- AST base classes from Phase 1.3 must be documented

**What This Phase Provides for Next Phase:**

- Complete parser infrastructure
- Expression parsing capabilities
- Error recovery mechanisms
```

---

### **Rule 3: Provide Context and Reasoning**

Provide detailed context and reasoning for each phase.

**What to Include:**

- **Why this phase is needed** - Business/technical justification
- **What problem it solves** - Specific issues being addressed
- **Key decisions made** - Architecture choices and rationale
- **Potential challenges** - Known risks or complexities
- **Success criteria** - How to verify phase completion

**Example:**

```markdown
## Phase 1: Core Type System

**Context:**
The type system is the foundation for all parsing and code generation.
We need strong type definitions to ensure type safety throughout the compiler.

**Reasoning:**
Starting with types allows us to:

1. Define clear contracts for all components
2. Enable better IDE support during development
3. Catch errors at compile-time rather than runtime

**Key Decision:**
Use TypeScript discriminated unions for AST nodes to enable exhaustive
type checking in the visitor pattern.
```

---

### **Rule 4: Define Clear Deliverables**

Each phase must have **clear, measurable deliverables**.

**Examples:**

❌ **Vague Deliverables:**

- "Parser improvements"
- "Better error handling"
- "Code cleanup"

✅ **Clear Deliverables:**

- Complete TypeScript type definitions for all AST nodes
- Parser that handles binary expressions with correct precedence
- Error recovery that allows parsing to continue after syntax errors
- 95%+ test coverage for expression parsing

---

### **Rule 5: Create Granular Tasks**

**IMPORTANT:** Create small, **granular**, and manageable tasks. More tasks are better than a few large tasks.

**Task Granularity Guidelines:**

- Each task should be completable within **2-4 hours** of work
- Each task should touch **5-15 files maximum**
- Each task should have **one clear objective**
- Each task should produce **testable output**

**Examples:**

❌ **Too Large (Bad):**

- "Implement the parser" (too broad)
- "Add error handling system" (too vague)
- "Build type checker with inference" (too complex)

✅ **Properly Granular (Good):**

- "Create AST node base class with position tracking"
- "Implement binary expression parsing for arithmetic operators"
- "Add error recovery for missing semicolons"
- "Create precedence table for operator parsing"
- "Write unit tests for literal expression parsing"

---

### **Rule 6: Task Numbering Convention**

Tasks **must** have a sequence number in the format: `Task [Phase].[Number]`

**Format:**

```
Task 1.1, Task 1.2, Task 1.3  (Phase 1, tasks 1-3)
Task 2.1, Task 2.2, Task 2.3  (Phase 2, tasks 1-3)
```

**Example:**

```markdown
### Phase 1: Core Type System

- Task 1.1: Create base AST node types
- Task 1.2: Define expression node types
- Task 1.3: Define statement node types
- Task 1.4: Add position tracking to all nodes

### Phase 2: Lexer Implementation

- Task 2.1: Implement token scanner
- Task 2.2: Add keyword recognition
- Task 2.3: Handle string literals
```

---

### **Rule 7: Task Presentation Format**

**IMPORTANT:** Place all tasks in a **table format** at the end of each plan with completion checkboxes.

**Required Format:**

```markdown
## Task Implementation Checklist

| Task | Description                  | Dependencies     | Status |
| ---- | ---------------------------- | ---------------- | ------ |
| 1.1  | Create base AST node types   | None             | [ ]    |
| 1.2  | Define expression node types | 1.1              | [ ]    |
| 1.3  | Define statement node types  | 1.1              | [ ]    |
| 1.4  | Add position tracking        | 1.1, 1.2, 1.3    | [ ]    |
| 2.1  | Implement token scanner      | Phase 1 complete | [ ]    |
| 2.2  | Add keyword recognition      | 2.1              | [ ]    |

**Legend:**

- [ ] Not started
- [x] Complete
```

**Why This Format:**

- ✅ Clear visual overview of all tasks
- ✅ Easy to track progress
- ✅ Dependencies are explicit
- ✅ Can be updated incrementally

---

### **Rule 8: Granular Testing Requirements**

**IMPORTANT:** It is critical to have **granular tests and testing** for each task.

**Testing Guidelines:**

1. **Each task must specify its testing requirements**

   ```markdown
   Task 1.1: Create base AST node types
   Tests: Unit tests for node creation, property access, type guards
   Coverage: 100% for public APIs
   ```

2. **Test types per task:**
   - **Unit tests** - Test individual functions/classes
   - **Integration tests** - Test component interactions
   - **End-to-end tests** - Test complete workflows

3. **Test granularity:**
   - Each task should add 5-20 test cases
   - Tests should be specific to that task's functionality
   - Tests should be automated and reproducible

**Example Task with Testing:**

```markdown
Task 2.3: Implement binary expression parsing

**Implementation:**

- Parse left and right operands
- Handle operator precedence
- Build AST nodes correctly

**Tests:**

- Unit: Parse "1 + 2" creates correct AST
- Unit: Parse "1 + 2 \* 3" respects precedence
- Integration: Binary expressions in larger programs
- Edge: Missing operands, invalid operators
- Coverage target: 95%+
```

---

### **Rule 9: Pre-Implementation Re-evaluation**

**IMPORTANT:** Always re-evaluate the implementation plan before implementing, to be absolutely sure nothing was missed and to identify inconsistencies.

**Re-evaluation Checklist:**

1. **✅ Completeness**
   - Are all requirements from original request covered?
   - Are there any missing features or edge cases?
   - Is each phase fully specified?

2. **✅ Task Granularity**
   - Are tasks small enough (2-4 hours each)?
   - Can each task be tested independently?
   - Are there any tasks that should be split further?

3. **✅ Dependencies**
   - Are all task dependencies documented?
   - Is the dependency order logical?
   - Are there any circular dependencies?

4. **✅ Testing Coverage**
   - Does every task have testing requirements?
   - Are test types appropriate for each task?
   - Is coverage realistic and measurable?

5. **✅ Consistency**
   - Do task numbers follow the convention?
   - Are naming patterns consistent?
   - Is the table format correct?

6. **✅ Feasibility**
   - Can this plan actually be implemented?
   - Are time estimates reasonable?
   - Are there any blocking technical issues?

7. **✅ Architecture Assessment**
   - Will any implementation exceed 500 lines?
   - Is inheritance chain architecture planned?
   - Are layer dependencies clearly defined?

**When to Re-evaluate:**

- ✅ Before starting Phase 1
- ✅ After completing each phase (before starting next)
- ✅ When requirements change
- ✅ When discovering new technical constraints

---

### **Rule 10: Inheritance Chain Planning**

**IMPORTANT:** When planning large implementations (>500 lines), design inheritance chain architecture.

**Inheritance Chain Planning Process:**

1. **Identify Logical Layers**
   - What are the natural functional dependencies?
   - Which components build on others?
   - What's the core foundation vs specialized features?

2. **Design Layer Hierarchy**
   - Base class: Core utilities and infrastructure
   - Layer classes: Specialized functionality that builds up
   - Concrete class: Final implementation with orchestration

3. **Plan Layer Implementation**
   - Each layer = separate phase with dedicated tasks
   - Layer size target: 200-500 lines each
   - Test each layer independently

4. **File Structure Planning**
   - `base.ts` - Foundation class
   - `[feature].ts` - Each logical layer
   - `[main].ts` - Final concrete implementation
   - `index.ts` - Public exports

**Example: Compiler Implementation Plan**

```markdown
Phase 1: BaseCompiler (utilities, error handling)
Phase 2: TypeChecker extends BaseCompiler
Phase 3: CodeGenerator extends TypeChecker
Phase 4: Optimizer extends CodeGenerator
Phase 5: Compiler extends Optimizer

Files:

- base.ts (BaseCompiler)
- type-checker.ts (TypeChecker)
- code-generator.ts (CodeGenerator)
- optimizer.ts (Optimizer)
- compiler.ts (Compiler)
- index.ts (exports)
```

**When to Apply:**

- ✅ Any implementation approaching 500+ lines
- ✅ Complex systems with multiple concerns
- ✅ Systems that will grow over time
- ✅ Components with natural layer dependencies

---

## **Complete Example: Implementation Plan**

### **Project: Expression Parser**

---

### **Phase 1: Type Definitions**

**Context:** Need strong type definitions for parser components.

**Reasoning:** Type-first approach enables better tooling and catches errors early.

**Dependencies:** None

**Deliverables:**

- Complete TypeScript types for tokens
- Complete TypeScript types for AST nodes
- 100% type coverage

**Tasks:**

| Task | Description                   | Dependencies  | Status |
| ---- | ----------------------------- | ------------- | ------ |
| 1.1  | Create token type definitions | None          | [ ]    |
| 1.2  | Create AST node base classes  | None          | [ ]    |
| 1.3  | Define expression node types  | 1.2           | [ ]    |
| 1.4  | Add unit tests for types      | 1.1, 1.2, 1.3 | [ ]    |

---

### **Phase 2: Lexer Implementation**

**Context:** Need to tokenize source code for parsing.

**Reasoning:** Lexer provides clean token stream for parser, separating concerns.

**Dependencies:** Phase 1 complete (token types defined)

**Deliverables:**

- Working lexer that tokenizes source code
- Handles all token types from Phase 1
- 95%+ test coverage

**Tasks:**

| Task | Description                      | Dependencies  | Status |
| ---- | -------------------------------- | ------------- | ------ |
| 2.1  | Implement basic scanner          | Phase 1       | [ ]    |
| 2.2  | Add keyword recognition          | 2.1           | [ ]    |
| 2.3  | Handle operators and punctuation | 2.1           | [ ]    |
| 2.4  | Add comprehensive lexer tests    | 2.1, 2.2, 2.3 | [ ]    |

---

## **Summary: Creating Effective Plans**

**Every implementation plan must include:**

1. 📋 **Logical phases** - Sequential, buildable units of work
2. 🔗 **Dependencies** - Clear phase and task dependencies
3. 💡 **Context & reasoning** - Why this approach, key decisions
4. ✅ **Clear deliverables** - Measurable outcomes for each phase
5. 🔨 **Granular tasks** - Small, focused, testable tasks (2-4 hours each)
6. 🔢 **Numbered tasks** - Format: Task [Phase].[Number]
7. 📊 **Table format** - All tasks in a table with checkboxes
8. 🧪 **Testing requirements** - Specific tests for each task
9. 🔍 **Pre-implementation review** - Verify completeness and consistency

**Remember:** A good plan prevents wasted effort, reduces rework, and ensures nothing is forgotten. Take time to plan thoroughly before implementing.

---

## **Cross-References**

- See **agents.md** for task granularity requirements and verification rules
- See **code.md** for testing standards and quality guidelines that inform task planning
- See **code.md Rules 17-20** for inheritance chain architecture requirements
- Note: Inheritance chain planning in this file (Rule 10) works with architectural standards in code.md
