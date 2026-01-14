### A.I Agent Instructions / Cline Instructions

## **🚨 ULTRA-CRITICAL RULE: NEVER ASSUME - ALWAYS QUERY LANGUAGE SPECIFICATION 🚨**

**When implementing ANY compiler subcomponent, NEVER make assumptions - ALWAYS query the language specification FIRST.**

### **MANDATORY Pre-Implementation Check:**

**Before writing ANY code for compiler components:**

1. ⚠️ **STOP** - Do not proceed with assumptions
2. 📖 **READ** - Query `docs/language-specification/` sections
3. ✅ **VERIFY** - Confirm exact behavior in specification
4. 🔍 **CROSS-REFERENCE** - Check EBNF grammar and examples
5. 💭 **QUESTION** - Challenge any "obvious" assumptions

### **ALL Compiler Areas - NEVER ASSUME:**

**🔤 Lexer/Tokenization:**

- ❌ Token definitions, keywords, operators
- ❌ Comment styles, string literal formats
- ❌ Numeric literal parsing rules
- ❌ Whitespace and newline handling
- ❌ Character encoding or escape sequences

**🌳 Parser/AST:**

- ❌ Grammar rules, precedence, associativity
- ❌ AST node structures and relationships
- ❌ Statement vs expression classifications
- ❌ Block structure and scoping rules
- ❌ Control flow syntax patterns

**📋 Type System:**

- ❌ Type definitions, inference rules
- ❌ Conversion and coercion behavior
- ❌ Generic/template mechanisms
- ❌ Constraint and validation logic
- ❌ Memory layout assumptions

**🔧 Code Generation:**

- ❌ Instruction selection patterns
- ❌ Register allocation strategies
- ❌ Memory addressing modes
- ❌ Optimization opportunities
- ❌ Runtime calling conventions

**⚠️ Error Handling:**

- ❌ Error message formats
- ❌ Recovery strategies
- ❌ Diagnostic severity levels
- ❌ Error propagation patterns
- ❌ User-facing error presentation

**✅ ALWAYS QUERY SPECIFICATION FOR:**

- Exact syntax rules and grammar patterns
- Semantic behavior and edge cases
- Error conditions and handling requirements
- Examples and documented usage patterns
- Cross-references between language features

### **Emergency Stop Protocol:**

**If you catch yourself making ANY assumption about language behavior:**

1. 🛑 **IMMEDIATE STOP** - Halt current implementation
2. 📖 **SPECIFICATION QUERY** - Read relevant docs sections
3. 🔍 **VERIFY UNDERSTANDING** - Confirm behavior is documented
4. ✅ **PROCEED ONLY AFTER CONFIRMATION** - Implementation matches spec

**This rule supersedes ALL other considerations. When uncertain about ANY language feature, specification consultation is MANDATORY.**

---

## **CRITICAL RULE: Task Granularity & Architecture**

**To prevent AI context window limitations, ALL tasks must be broken down into granular subtasks with proper architecture.**

### Requirements:

- Each subtask must be completable within **50,000 tokens** of context
- Break tasks by logical boundaries: files, features, phases, or components
- Create explicit dependencies between subtasks
- Document clear completion criteria for each subtask
- Apply this rule in **BOTH Plan Mode AND Act Mode**

### How to Split Tasks:

1. **Identify the main goal** - What is the overall objective?
2. **Break into logical phases** - What are the major steps?
3. **Further subdivide each phase** - Can this step be smaller?
4. **Consider architecture** - Will implementation exceed 500 lines?
5. **Plan inheritance chain** - If large, design layer hierarchy
6. **Verify granularity** - Can this be completed in one focused session?

### Examples:

❌ **Too Large (Bad):**

- "Implement authentication system"
- "Build the parser"
- "Add testing infrastructure"

✅ **Properly Granular (Good):**

- "Create user model type definitions"
- "Implement password hashing utility"
- "Build login endpoint handler"
- "Add session token generation"
- "Create authentication middleware"

### **Architecture Strategy for Large Implementations:**

**When Implementation Will Exceed 500 Lines:**

✅ **Use Inheritance Chain Architecture:**

- Design: `BaseClass → Layer1 → Layer2 → ConcreteClass`
- Each layer: 200-500 lines maximum
- Natural dependencies: each layer builds on previous
- Perfect for AI context window limitations

**Example: Parser Implementation**

```
Phase 1: BaseParser (core utilities)
Phase 2: ExpressionParser extends BaseParser
Phase 3: DeclarationParser extends ExpressionParser
Phase 4: ModuleParser extends DeclarationParser
Phase 5: Parser extends ModuleParser
```

**Benefits:**

- Each phase fits in AI context window
- Clean separation of concerns
- Easy to test each layer independently
- Future extensions just add to appropriate layer

---

## **IMPORTANT RULES**

These rules are **mandatory** and must be applied **strictly and consistently**.

---

### **Rule 1: Shell Commands & Package Management**

**CRITICAL:** All shell command execution must follow these strict rules:

**Shell Command Requirements:**

1. **✅ Always prefix shell commands with `clear &&`**
   - Every `execute_command` must start with `clear &&`
   - This ensures a clean terminal for each command
   - Example: `clear && yarn build` NOT `yarn build`

2. **✅ Use YARN exclusively - NEVER use NPM or NPX**
   - ❌ Never use: `npm install`, `npm run`, `npx`
   - ✅ Always use: `yarn install`, `yarn run`, `yarn`
   - ❌ Never use: `npx create-react-app`
   - ✅ Always use: `yarn create react-app`

3. **✅ Standard test command from project root**
   - For building and testing: `clear && yarn clean && yarn build && yarn test`
   - This runs all packages and ensures complete build/test cycle
   - Always run from project root (`/Users/gevik/workdir/blend65`)

**Examples:**

❌ **Wrong:**

```bash
npm test
npx vitest
yarn test
```

✅ **Correct:**

```bash
clear && yarn test
clear && yarn clean && yarn build && yarn test
clear && yarn install
```

**Purpose:** These rules ensure consistent environment, clean terminal output, and proper package management across the entire project.

---

### **Rule 2: Internal Self-Check**

Before providing any response, perform an **internal self-check** by asking yourself:

1. **"Do I fully understand this request?"**
   - Is the goal clear?
   - Are there ambiguous terms?
   - Do I know what success looks like?

2. **"Are there any questions I need to ask the user?"**
   - Is critical information missing?
   - Are there multiple valid interpretations?
   - Could clarification improve the outcome?

**Purpose:** This ensures thorough analysis and prevents wasted effort on misunderstood requirements.

**When to Ask Questions:**

- ✅ When requirements are ambiguous or incomplete
- ✅ When multiple approaches exist and user preference matters
- ✅ When critical details are missing
- ❌ Don't ask about information that can be reasonably inferred from context

---

### **Rule 3: Enhance Requirements**

If you identify issues with the user's request:

**Do:**

- Ask clarifying questions to eliminate ambiguity
- Suggest improvements to requirements if they're unclear or incomplete
- Propose alternative approaches if current approach has issues
- Ensure you understand full scope before creating implementation plans

**Example:**

User says: _"Add error handling"_

❌ **Bad Response:** Proceed without clarification

✅ **Good Response:**

- "What types of errors should be handled?"
- "Should errors be logged, displayed to user, or both?"
- "Are there specific error recovery strategies needed?"

---

### **Rule 4: Verify Previous Task Completion**

Before starting any new task implementation, **verify the previous task was fully completed**:

**Verification Checklist:**

1. ✅ Review the codebase against the previous task's requirements
2. ✅ Confirm all deliverables were implemented
3. ✅ Check that tests pass (if applicable)
4. ✅ Verify no partial implementations or TODOs were left behind
5. ✅ Ensure documentation was updated (if required)

**Purpose:** Prevents cascading failures where incomplete work causes issues in subsequent tasks.

**What to Do if Previous Task is Incomplete:**

- Alert the user immediately
- List what's missing or incomplete
- Ask whether to complete the previous task first or proceed anyway

---

### **Rule 5: Update Task Plan Documents**

Track progress by updating task plan documents throughout implementation:

**How to Update:**

1. **Locate the plan document** - Usually in `plans/` directory
2. **Find the relevant task** - Match by task number or description
3. **Update completion status** - Mark checkboxes as tasks complete
4. **Add notes if needed** - Document any deviations or issues

**Example Update:**

```
- [x] Task 1.1: Create type definitions ✅
- [x] Task 1.2: Implement utility functions ✅
- [ ] Task 1.3: Add integration tests ⏳ (in progress)
```

**If no plan document exists:**

- Maintain progress using the `task_progress` parameter in tool calls
- Update it with each significant milestone

---

### **Rule 6: Final Verification Before Completion**

Before marking any task as complete or calling `attempt_completion`, perform a **comprehensive final check**:

**Final Verification Checklist:**

1. **✅ Requirements Met**
   - Re-read the original user request
   - Verify every requirement is satisfied
   - Check for any overlooked details

2. **✅ Code Quality**
   - Code follows project standards (see code.md)
   - No obvious bugs or issues
   - No debugging code or console.logs left behind

3. **✅ Testing**
   - All relevant tests pass
   - New tests added where appropriate
   - No flaky or failing tests

4. **✅ Edge Cases**
   - Consider boundary conditions
   - Handle error scenarios
   - Account for unexpected inputs

5. **✅ Documentation**
   - Comments explain complex logic
   - JSDoc is complete and accurate
   - README or docs updated if needed

6. **✅ Completeness**
   - No TODO comments for current task
   - No partial implementations
   - No missing functionality

**If ANY item fails verification:**

- ❌ Do NOT call attempt_completion
- ✅ Fix the issue first
- ✅ Re-run the verification checklist

### **Rule 7: NEVER Overcomplicate - Use Existing Infrastructure**

**CRITICAL:** Always use existing infrastructure and avoid unnecessary complexity.

**Mandatory Approach:**

1. **✅ Always use existing tools and infrastructure FIRST**
   - ✅ Use the real Lexer, not custom tokenizers
   - ✅ Use existing test patterns, not custom test frameworks
   - ✅ Use existing utility functions, not reimplementations
   - ✅ Use existing error handling patterns, not new approaches

2. **❌ NEVER create custom solutions when standard ones exist**
   - ❌ Don't write custom tokenizers when Lexer exists
   - ❌ Don't create custom test utilities when existing patterns work
   - ❌ Don't reinvent parsing patterns when Pratt parser exists
   - ❌ Don't create custom error handling when recovery patterns exist

3. **✅ Keep implementations simple and focused**
   - ✅ Follow the principle of least complexity
   - ✅ Use the most straightforward approach that works
   - ✅ Leverage existing architecture and patterns
   - ✅ Question any custom or complex solutions

**Examples:**

❌ **Overcomplicated (Bad):**

```typescript
// Creating custom tokenizer for tests
function tokensFor(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    // ... 100+ lines of custom tokenization
  }
}
```

✅ **Simple (Good):**

```typescript
// Use existing Lexer
function parseExpr(source: string): Expression {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new TestParser(tokens);
  return parser.parseExpression();
}
```

**Purpose:** Prevents wasted AI resources, reduces complexity, improves maintainability, and leverages battle-tested existing code.

---

### **Rule 8: Act Mode VS Code Settings Automation**

**CRITICAL:** In Act Mode ONLY, automatically manage VS Code settings for optimal development workflow:

**Act Mode Requirements:**

1. **✅ Execute `clear && scripts/agent.sh start` as THE VERY FIRST COMMAND of any Act Mode task**
   - This MUST be the first command executed when starting any task in Act Mode
   - Switches VS Code to development mode (settings.json.cline → settings.json)
   - Provides optimal settings for AI-assisted development

2. **✅ Execute `clear && scripts/agent.sh finished` as THE VERY LAST COMMAND of any Act Mode task**
   - This MUST be the last command executed when completing any task in Act Mode
   - Switches VS Code to completion mode (settings.json.auto → settings.json)
   - Enables full linting, formatting, and code cleanup

**Workflow Pattern:**

```bash
# FIRST COMMAND - Start of any Act Mode task
clear && scripts/agent.sh start

# ... perform all task implementation work ...

# LAST COMMAND - End of any Act Mode task
clear && scripts/agent.sh finished
```

**When NOT to Apply:**

- ❌ Do not use in Plan Mode (planning doesn't require setting changes)
- ❌ Do not use if already in the middle of a task (only at start/end boundaries)

**Purpose:** Automatically optimizes VS Code environment for development vs completion phases, ensuring:

- Clean development experience during implementation
- Full code quality enforcement at task completion
- Consistent settings management across all AI sessions

---

### **Rule 9: Compact Conversation After Task Completion**

**CRITICAL:** After successfully completing any task in Act Mode, compact the conversation to optimize context management:

**Post-Completion Requirement:**

1. **✅ Run `/compact` after `attempt_completion` is successful**
   - This MUST be done after the task is fully verified and completed
   - Compacts the conversation history to optimize AI context
   - Ensures efficient context management for future tasks

**Workflow Pattern:**

```bash
# 1. Complete all task work
# 2. Run final verification (Rule 6)
# 3. Execute agent.sh finished (Rule 8)
# 4. Call attempt_completion with results
# 5. After successful completion, run /compact
```

**When to Compact:**

- ✅ After any successfully completed Act Mode task
- ✅ After calling attempt_completion
- ✅ Before starting a new unrelated task

**When NOT to Compact:**

- ❌ In the middle of a multi-part task
- ❌ Before task verification is complete
- ❌ During Plan Mode (no implementation work to compact)

**Purpose:** Optimizes conversation context, reduces token usage, and maintains clean context boundaries between completed tasks.

---

### **Rule 10: ES Module Syntax for Node Debug Commands**

**CRITICAL:** When generating quick debug commands with `node -e` for this repository, ALWAYS use ES module syntax.

**Context:** This monorepo is configured with `"type": "module"` in package.json, making all code ES modules by default. CommonJS (`require`) syntax causes compatibility issues and errors when debugging repository code.

**ES Module Requirements:**

1. **✅ Always use ES module imports in `node -e` commands**
   - ✅ Use: `import { module1 } from './dist/file.js'`
   - ❌ Never use: `const { module1 } = require('./dist/file.js')`

2. **✅ Proper ES module command structure**
   - Use `--input-type=module` flag if needed for Node.js compatibility
   - Include `.js` extensions in import paths
   - Wrap in async context when using top-level await

**Examples:**

❌ **Wrong (CommonJS - causes errors in ES module monorepo):**

```bash
node -e "const { Lexer } = require('./dist/file.js'); console.log(Lexer);"
```

✅ **Correct (ES Module - compatible with monorepo):**

```bash
node --input-type=module -e "import { Lexer } from './dist/file.js'; console.log(Lexer);"
```

**Purpose:** Ensures debugging commands work correctly with the ES module-configured monorepo and prevents CommonJS/ESM compatibility errors.

---

## **Summary: Applying These Rules**

**Every Single Time You Respond:**

1. 🔧 Follow shell command rules (Rule 1 - use `clear &&` and yarn only)
2. 🧠 Perform internal self-check (Rule 2)
3. 💡 Enhance requirements if unclear (Rule 3 - Plan Mode)
4. ✅ Verify previous work is complete (Rule 4 - before new tasks)
5. 📝 Update task progress (Rule 5 - during implementation)
6. 🔍 Final verification before completion (Rule 6 - before finishing)
7. 🚫 **NEVER overcomplicate** - Use existing infrastructure (Rule 7 - simplicity first)
8. ⚙️ **Act Mode ONLY:** Execute agent.sh commands (Rule 8 - start/finish settings)
9. 🗜️ **After task completion:** Run `/compact` to optimize context (Rule 9 - conversation compaction)
10. 📦 **ES modules for debug:** Use import syntax in `node -e` commands (Rule 10 - ES module monorepo)

**Remember:** These rules exist to ensure high-quality, complete implementations. Following them prevents errors, rework, and wasted effort.

---

## **Cross-References**

- See **specification-compliance.md** for detailed compiler implementation compliance rules and "Never Assume" protocols
- See **plans.md** for detailed guidance on creating implementation plans with proper task breakdown
- See **code.md** for coding standards, testing requirements, and quality guidelines
- See **git-commands.md** for git workflow instructions
