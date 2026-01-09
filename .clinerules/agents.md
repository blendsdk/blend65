### A.I Agent Instructions / Cline Instructions

## **CRITICAL RULE: Task Granularity**

**To prevent AI context window limitations, ALL tasks must be broken down into granular subtasks.**

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
4. **Verify granularity** - Can this be completed in one focused session?

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

---

## **IMPORTANT RULES**

These rules are **mandatory** and must be applied **strictly and consistently**.

---

### **Rule 1: Internal Self-Check**

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

### **Rule 2: Enhance Requirements**

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

### **Rule 3: Verify Previous Task Completion**

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

### **Rule 4: Update Task Plan Documents**

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

### **Rule 5: Final Verification Before Completion**

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

---

## **Summary: Applying These Rules**

**Every Single Time You Respond:**

1. 🧠 Perform internal self-check (Rule 1)
2. ❓ Ask questions if anything is unclear (Rule 2 - Plan Mode)
3. ✅ Verify previous work is complete (Rule 3 - before new tasks)
4. 📝 Update task progress (Rule 4 - during implementation)
5. 🔍 Final verification before completion (Rule 5 - before finishing)

**Remember:** These rules exist to ensure high-quality, complete implementations. Following them prevents errors, rework, and wasted effort.

---

## **Cross-References**

- See **plans.md** for detailed guidance on creating implementation plans with proper task breakdown
- See **code.md** for coding standards, testing requirements, and quality guidelines
- See **git-commands.md** for git workflow instructions
