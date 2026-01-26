# Implementation Plan Creation Prompt

## **TRIGGER KEYWORD: `make_plan`**

When the user types "make_plan", execute this comprehensive workflow to create a detailed, multi-document implementation plan for any software development feature or task.

---

## **Overview**

This prompt guides the AI through a structured process to:

1. **Gather requirements** through clarifying questions
2. **Analyze current state** of the codebase
3. **Create detailed technical specifications** for each component/layer
4. **Build a multi-session execution plan** with granular tasks

The output is a folder of well-organized documents that can guide implementation across multiple AI sessions.

---

## **Phase 1: Information Gathering (MANDATORY)**

**Before creating ANY plan documents, you MUST:**

### **1.1 Ask Clarifying Questions**

Always ask the user about:

1. **Feature Scope**
   - What is the feature/task to be implemented?
   - What should it do? What should it NOT do?
   - Are there any explicit scope boundaries?

2. **Technical Context**
   - Which parts of the codebase are affected?
   - Are there existing implementations to reference?
   - Are there any architectural constraints?

3. **Dependencies**
   - Does this depend on other features?
   - Are there external dependencies?
   - What must be completed before starting?

4. **Success Criteria**
   - How do we know when it's done?
   - What tests are required?
   - What documentation is needed?

### **1.2 Analyze Current Implementation**

Before planning:

1. **✅ Read relevant source files** - Understand existing code
2. **✅ Identify affected components** - Map impacted areas
3. **✅ Check for similar patterns** - Find reference implementations
4. **✅ Note any technical debt** - Document existing issues
5. **✅ Review project documentation** - Check specs, READMEs, etc.

### **1.3 Confirm Scope with User**

Present findings and confirm:

```markdown
## Scope Confirmation

**Feature:** [Name]

**What's IN scope:**

- Item 1
- Item 2

**What's OUT of scope:**

- Item 1
- Item 2

**Key Decisions Needed:**

- Decision 1: [Options A, B, C]
- Decision 2: [Options X, Y]

Please confirm or adjust before I create the plan.
```

---

## **Phase 2: Create Plan Documents**

### **2.1 Folder Structure**

Create plans in: `plans/[feature-name]/`

```
plans/
└── [feature-name]/
    ├── 00-index.md           # Overview and navigation
    ├── 01-requirements.md    # Requirements and scope
    ├── 02-current-state.md   # Current implementation analysis
    ├── 03-[component-1].md   # Technical spec for component 1
    ├── 04-[component-2].md   # Technical spec for component 2
    ├── ...                   # Additional component docs as needed
    ├── 07-testing-strategy.md # Test cases and verification
    └── 99-execution-plan.md  # Phases, sessions, task checklist
```

### **2.2 Document Templates**

---

#### **00-index.md** - Index and Overview

```markdown
# [Feature Name] Implementation Plan

> **Feature**: [Brief description]
> **Status**: Planning Complete
> **Created**: [Date]

## Overview

[2-3 paragraph description of what this feature does and why it's needed]

## Document Index

| #   | Document                                   | Description                             |
| --- | ------------------------------------------ | --------------------------------------- |
| 00  | [Index](00-index.md)                       | This document - overview and navigation |
| 01  | [Requirements](01-requirements.md)         | Feature requirements and scope          |
| 02  | [Current State](02-current-state.md)       | Analysis of current implementation      |
| 03  | [Component Name](03-component.md)          | Technical specification                 |
| ... | ...                                        | ...                                     |
| 07  | [Testing Strategy](07-testing-strategy.md) | Test cases and verification             |
| 99  | [Execution Plan](99-execution-plan.md)     | Phases, sessions, and task checklist    |

## Quick Reference

### Usage Examples

[Code examples showing the feature in use]

### Key Decisions

| Decision     | Outcome   |
| ------------ | --------- |
| [Decision 1] | [Outcome] |
| [Decision 2] | [Outcome] |

## Related Files

[List of key files that will be modified]
```

---

#### **01-requirements.md** - Requirements and Scope

```markdown
# Requirements: [Feature Name]

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

[Detailed description of the feature]

## Functional Requirements

### Must Have

- [ ] Requirement 1
- [ ] Requirement 2

### Should Have

- [ ] Requirement 1

### Won't Have (Out of Scope)

- Exclusion 1
- Exclusion 2

## Technical Requirements

### Performance

- [Performance requirements]

### Compatibility

- [Compatibility requirements]

### Security

- [Security requirements]

## Scope Decisions

| Decision   | Options Considered | Chosen | Rationale |
| ---------- | ------------------ | ------ | --------- |
| [Decision] | A, B, C            | B      | [Why]     |

## Acceptance Criteria

1. [ ] Criterion 1
2. [ ] Criterion 2
3. [ ] All tests pass
4. [ ] Documentation updated
```

---

#### **02-current-state.md** - Current State Analysis

```markdown
# Current State: [Feature Name]

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

[Description of current relevant code]

### Relevant Files

| File              | Purpose   | Changes Needed |
| ----------------- | --------- | -------------- |
| `path/to/file.ts` | [Purpose] | [Changes]      |

### Code Analysis

[Key code snippets and analysis]

## Gaps Identified

### Gap 1: [Name]

**Current Behavior:** [What happens now]
**Required Behavior:** [What should happen]
**Fix Required:** [What needs to change]

### Gap 2: [Name]

...

## Dependencies

### Internal Dependencies

- [List internal dependencies]

### External Dependencies

- [List external dependencies]

## Risks and Concerns

| Risk   | Likelihood   | Impact       | Mitigation |
| ------ | ------------ | ------------ | ---------- |
| [Risk] | High/Med/Low | High/Med/Low | [Strategy] |
```

---

#### **03-XX-[component].md** - Component Technical Specification

````markdown
# [Component Name]: [Feature Name]

> **Document**: 03-[component].md
> **Parent**: [Index](00-index.md)

## Overview

[What this component does and why]

## Architecture

### Current Architecture

[Describe current state]

### Proposed Changes

[Describe what changes]

## Implementation Details

### New Types/Interfaces

```typescript
// Type definitions
```
````

### New Functions/Methods

```typescript
// Function signatures with JSDoc
```

### Integration Points

[How this connects to other components]

## Code Examples

### Example 1: [Name]

```typescript
// Code example
```

### Example 2: [Name]

```typescript
// Code example
```

## Error Handling

| Error Case | Handling Strategy |
| ---------- | ----------------- |
| [Error]    | [Strategy]        |

## Testing Requirements

- Unit tests for [specific functionality]
- Integration tests for [interactions]

````

---

#### **07-testing-strategy.md** - Testing Strategy

```markdown
# Testing Strategy: [Feature Name]

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests: [X]% coverage
- Integration tests: Key workflows covered
- E2E tests: Complete feature verification

## Test Categories

### Unit Tests

| Test | Description | Priority |
|------|-------------|----------|
| [Test name] | [What it tests] | High/Med/Low |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| [Test name] | [Components] | [Description] |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| [Scenario] | [Steps] | [Result] |

## Test Data

### Fixtures Needed

[List test fixtures]

### Mock Requirements

[List any mocks needed - prefer real objects when possible]

## Verification Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No regressions in existing tests
- [ ] Test coverage meets goals
````

---

#### **99-execution-plan.md** - Execution Plan

````markdown
# Execution Plan: [Feature Name]

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementation.

## Implementation Phases

| Phase | Title          | Sessions | Est. Time |
| ----- | -------------- | -------- | --------- |
| 1     | [Phase 1 Name] | 1        | XX min    |
| 2     | [Phase 2 Name] | 1-2      | XX min    |
| ...   | ...            | ...      | ...       |

**Total: X sessions, ~X-X hours**

---

## Phase 1: [Phase Name]

### Session 1.1: [Session Objective]

**Reference**: [Link to technical doc]

**Objective**: [What this session achieves]

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | [Task description] | `path/to/file.ts` |
| 1.1.2 | [Task description] | `path/to/file.ts` |

**Deliverables**:

- [ ] Deliverable 1
- [ ] Deliverable 2
- [ ] All tests passing

**Verify**: `[test command]`

---

## Phase 2: [Phase Name]

### Session 2.1: [Session Objective]

...

---

## Task Checklist (All Phases)

### Phase 1: [Phase Name]

- [ ] 1.1.1 [Task]
- [ ] 1.1.2 [Task]

### Phase 2: [Phase Name]

- [ ] 2.1.1 [Task]
- [ ] 2.1.2 [Task]

...

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings (if agent.sh exists)
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/[feature-name]/99-execution-plan.md"
```
````

### Ending a Session

```bash
# 1. Verify tests pass
[project test command]

# 2. End agent settings (if agent.sh exists)
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

### Between Sessions

1. Review completed tasks in this checklist
2. Mark completed items with [x]
3. Start new conversation for next session
4. Reference next session's tasks

---

## Dependencies

```
Phase 1
    ↓
Phase 2
    ↓
Phase 3
    ↓
...
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ All phases completed
2. ✅ All tests passing
3. ✅ No warnings/errors
4. ✅ Documentation updated
5. ✅ Code reviewed (if applicable)

````

---

## **Phase 3: Quality Checklist**

### **Before Finalizing Plan Documents**

Run this checklist:

**✅ Completeness**
- [ ] All requirements captured
- [ ] All affected components identified
- [ ] All scope decisions documented
- [ ] All dependencies mapped

**✅ Granularity**
- [ ] Tasks are 2-4 hours max each
- [ ] Sessions are 30 minutes max each
- [ ] Each task has clear deliverables
- [ ] Each task is independently testable

**✅ Dependencies**
- [ ] Phase dependencies documented
- [ ] Task dependencies documented
- [ ] No circular dependencies
- [ ] Dependency order is logical

**✅ Testing**
- [ ] Every component has test requirements
- [ ] E2E tests planned
- [ ] Test coverage goals defined

**✅ Format**
- [ ] All documents follow templates
- [ ] Tables are properly formatted
- [ ] Task numbers follow convention (Phase.Session.Task)
- [ ] Checkboxes included for tracking

---

## **Execution Protocol**

### **When "make_plan" is triggered:**

1. **🔍 GATHER** - Ask clarifying questions
2. **📖 ANALYZE** - Read and analyze current codebase
3. **✅ CONFIRM** - Present scope for user confirmation
4. **📁 CREATE** - Create `plans/[feature-name]/` folder
5. **📝 WRITE** - Write all plan documents following templates
6. **🔍 REVIEW** - Run quality checklist
7. **📋 PRESENT** - Summarize plan and next steps

### **Output Format**

After creating the plan, present:

```markdown
## Plan Created: [Feature Name]

**Location:** `plans/[feature-name]/`

**Documents Created:**
- 00-index.md ✅
- 01-requirements.md ✅
- 02-current-state.md ✅
- [additional docs] ✅
- 07-testing-strategy.md ✅
- 99-execution-plan.md ✅

**Summary:**
- Total Phases: X
- Total Sessions: X
- Estimated Time: X-X hours

**To Begin Implementation:**
1. Review 99-execution-plan.md
2. Start new chat session
3. Reference: "Implement Phase 1, Session 1.1 per plans/[feature-name]/99-execution-plan.md"
````

---

## **Adapting to Project Type**

The AI should adapt document structure based on project type:

| Project Type      | Typical Components                           |
| ----------------- | -------------------------------------------- |
| **Web App**       | Frontend, Backend, API, Database, Auth       |
| **API**           | Endpoints, Services, Data Models, Validation |
| **Library**       | Core, Utils, Types, Public API               |
| **CLI Tool**      | Commands, Arguments, Output, Config          |
| **Mobile App**    | UI, State, Services, Navigation              |
| **Compiler**      | Lexer, Parser, Analyzer, Generator           |
| **Microservices** | Services, Events, Data, Integration          |

Based on an educated guess regarding the size of each major component do one of the following:

- Option 1: Create one `03-XX-[component].md` document for each major component affected.
- Option 2: Create multiple 03-XX-[component]-[sub-component].md document for each sub component affected

---

## **Integration with Other Rules**

When executing "make_plan":

- Follow **plans.md** rules for task granularity and format
- Follow **agents.md** rules for multi-session execution
- Follow **code.md** rules for testing requirements
- If project-specific rules exist, incorporate them
- **CRITICAL**: Update the execution plan up on each completed phase or session

---

## **Summary**

The `make_plan` trigger ensures:

✅ **Consistent planning methodology** across all features
✅ **Thorough requirements gathering** before implementation
✅ **Multi-document organization** for complex features
✅ **Multi-session execution plans** for AI context management
✅ **Granular, trackable tasks** with clear deliverables
✅ **Comprehensive testing strategy** from the start

**This prompt is project-agnostic and works for any software development task.**

---

## **TRIGGER KEYWORD: `exec_plan [feature-name]`**

When the user types "exec_plan [feature-name]", execute the implementation plan for the specified feature.

**Example:** `exec_plan authentication` → executes `plans/authentication/99-execution-plan.md`

---

## **Overview**

This trigger allows the AI to:

1. **Load and understand** an existing execution plan
2. **Implement multiple phases** in a single session
3. **Track progress** by updating checkboxes in the execution plan
4. **Manage context window** by stopping at ~80% capacity
5. **Enable continuation** in subsequent sessions

---

## **Execution Protocol**

### **Phase 1: Load and Understand the Plan**

**When triggered, IMMEDIATELY:**

1. **✅ Read the execution plan**: `plans/[feature-name]/99-execution-plan.md`
2. **✅ Identify current progress**: Find incomplete tasks (unchecked `[ ]` items)
3. **✅ Read supporting documents**: Review relevant technical specs in `plans/[feature-name]/`
4. **✅ Determine starting point**: First incomplete phase/session/task

**If the execution plan doesn't exist:**
- ❌ STOP and inform the user
- Suggest running `make_plan [feature-name]` first

---

### **Phase 2: Execute Tasks**

**For each task in order:**

1. **Implement the task** following the technical specifications
2. **Run verification** (tests, builds) as specified in the plan
3. **Update the execution plan** - mark task complete with `[x]`
4. **Continue to next task** until:
   - All tasks complete, OR
   - Context window reaches ~80% capacity

**Task Completion Format:**
After completing each task, update `99-execution-plan.md`:

```markdown
### Phase 1: [Phase Name]
- [x] 1.1.1 Task description ✅
- [x] 1.1.2 Task description ✅
- [ ] 1.1.3 Next task (pending)
```

---

### **Phase 3: Session Wrap-Up**

**When stopping (either completion or context limit):**

1. **✅ Ensure clean stopping point** - Complete current task before stopping
2. **✅ Update execution plan** - All completed tasks marked with `[x]`
3. **✅ Run final verification** - Execute project's test command(s)
4. **✅ Report session summary** - What was completed, what remains

**Session Summary Format:**

```markdown
## Session Complete

**Feature:** [feature-name]
**Execution Plan:** `plans/[feature-name]/99-execution-plan.md`

**Completed This Session:**
- [x] Phase X, Task X.X.X: [description]
- [x] Phase X, Task X.X.X: [description]

**Remaining Work:**
- [ ] Phase X, Task X.X.X: [description]
- [ ] Phase Y: [phase description]

**Tests:** [Status]
**Context Used:** ~XX%

**To Continue:**
Run `exec_plan [feature-name]` in a new session after `/compact`
```

---

## **Context Window Management**

### **80% Threshold Protocol**

**Monitor context usage and stop when approaching 80%:**

1. **At ~70%** - Finish current task, assess if next task can fit
2. **At ~80%** - Complete current task and wrap up session
3. **Never exceed ~85%** - Risk of context overflow and lost work

**Signs you're approaching the limit:**
- Long conversations with many tool calls
- Large files being read/written
- Complex multi-file changes
- Feeling like the conversation has been going on for a while

**When stopping:**
- ✅ Always complete the current task
- ✅ Never stop mid-implementation
- ✅ Update execution plan before ending
- ✅ Provide clear continuation instructions

---

## **Error Handling**

### **If Tests Fail:**
1. Fix the failing tests
2. Verify all tests pass
3. Only then mark task complete

### **If Implementation Deviates from Plan:**
1. Note the deviation in the execution plan
2. Update task descriptions if needed
3. Continue with corrected approach

### **If Context Limit Reached Mid-Task:**
1. ⚠️ Save progress so far
2. Add clear notes about partial completion
3. Mark task as `[~]` (partial) with explanation

---

## **Integration with Project Rules**

**When executing plans:**

- ✅ Follow any `.clinerules/` files in the project
- ✅ Use project-specific test/build commands
- ✅ Respect project coding standards
- ✅ Update execution plan on EVERY completed task

---

## **Quick Reference**

| Command | Action |
|---------|--------|
| `exec_plan [feature]` | Execute `plans/[feature]/99-execution-plan.md` |
| `/compact` | Compact context after session ends |

**Session Flow:**
```
exec_plan [feature] → implement tasks → update plan → wrap up → /compact → exec_plan [feature]
```