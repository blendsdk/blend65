# Phase 1: CC65 Analysis

> **Document**: 99a-phase1-cc65.md
> **Parent**: [Execution Plan](99-execution-plan.md)
> **Last Updated**: 2025-01-31 23:27
> **Progress**: 16/16 tasks (100%)  COMPLETE

## Phase Overview

**Objective**: Deep analysis of cc65's stack frame and variable allocation implementation.

**Why CC65 First**: CC65 is the industry-standard C compiler for 6502 with decades of battle-tested code. Understanding its approach provides a solid foundation.

**Repository**: `/sfa_learning/cc65/src/cc65/`

## Sessions Summary

| Session | Objective | Est. Time |
|---------|-----------|-----------|
| 1.1 | Stack Model Deep Dive | 1 hour |
| 1.2 | Locals and Variables | 1 hour |
| 1.3 | Functions and Parameters | 1 hour |
| 1.4 | Code Generation Patterns | 1-2 hours |

---

## Session 1.1: Stack Model Deep Dive

**Objective**: Understand cc65's fundamental stack model and pointer management.

### Files to Analyze

| File | Purpose |
|------|---------|
| `stackptr.c` | Software stack pointer implementation |
| `stackptr.h` | Stack pointer interface |
| `expr.c` | Expression stack handling |
| `datatype.c` | Type sizing for stack allocation |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 1.1.1 | Read stackptr.h - understand interface | Notes | [ ] |
| 1.1.2 | Analyze stackptr.c - implementation details | Notes | [ ] |
| 1.1.3 | Trace stack operations through expr.c | Notes | [ ] |
| 1.1.4 | Document stack model in detail | `cc65/01-stack-model.md` | [ ] |

### Deliverables

- [ ] `cc65/01-stack-model.md` complete with:
  - Software stack architecture
  - Stack pointer management
  - Push/pop patterns
  - Integration with 6502 hardware stack

### Questions to Answer

1. Does cc65 use a software stack? Where is it located?
2. How is the stack pointer managed (ZP? RAM?)?
3. What's the maximum stack depth?
4. How does it interact with the hardware stack?

---

## Session 1.2: Locals and Variables

**Objective**: Understand how cc65 allocates and accesses local variables.

### Files to Analyze

| File | Purpose |
|------|---------|
| `locals.c` | Local variable allocation |
| `locals.h` | Local variable interface |
| `symtab.c` | Symbol table for variable tracking |
| `symentry.h` | Symbol entry structure |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 1.2.1 | Read locals.h - understand interface | Notes | [ ] |
| 1.2.2 | Analyze locals.c - allocation algorithm | Notes | [ ] |
| 1.2.3 | Study symtab.c for variable tracking | Notes | [ ] |
| 1.2.4 | Document local variable handling | `cc65/02-locals-handling.md` | [ ] |

### Deliverables

- [ ] `cc65/02-locals-handling.md` complete with:
  - Local variable allocation strategy
  - Stack frame layout
  - Symbol table integration
  - Scope handling

### Questions to Answer

1. How are locals laid out in the stack frame?
2. Is there frame pointer simulation?
3. How are nested scopes handled?
4. What about variable-length arrays?

---

## Session 1.3: Functions and Parameters

**Objective**: Understand cc65's function call convention and parameter passing.

### Files to Analyze

| File | Purpose |
|------|---------|
| `function.c` | Function prologue/epilogue |
| `function.h` | Function interface |
| `funcdesc.c` | Function descriptor handling |
| `declare.c` | Function declaration parsing |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 1.3.1 | Analyze function.c prologue/epilogue | Notes | [ ] |
| 1.3.2 | Study parameter passing in funcdesc.c | Notes | [ ] |
| 1.3.3 | Understand return value handling | Notes | [ ] |
| 1.3.4 | Document parameter passing | `cc65/03-parameter-passing.md` | [ ] |

### Deliverables

- [ ] `cc65/03-parameter-passing.md` complete with:
  - Calling convention details
  - Parameter passing mechanism
  - Return value handling
  - Register usage patterns

### Questions to Answer

1. How are parameters passed (stack? registers?)?
2. What's the function prologue/epilogue pattern?
3. How are return values handled?
4. What about variadic functions?

---

## Session 1.4: Code Generation Patterns

**Objective**: Understand how cc65 generates 6502 code for frame operations.

### Files to Analyze

| File | Purpose |
|------|---------|
| `codegen.c` | Main code generation |
| `codegen.h` | Code generation interface |
| `codeent.c` | Code entry handling |
| `codeopt.c` | Code optimization |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 1.4.1 | Study codegen.c frame-related patterns | Notes | [ ] |
| 1.4.2 | Analyze generated code for frame access | Notes | [ ] |
| 1.4.3 | Document strengths of cc65 approach | `cc65/05-strengths.md` | [ ] |
| 1.4.4 | Document weaknesses and limitations | `cc65/06-weaknesses.md` | [ ] |
| 1.4.5 | Complete cc65 overview document | `cc65/00-overview.md` | [ ] |
| 1.4.6 | Document code generation patterns | `cc65/04-code-generation.md` | [ ] |

### Deliverables

- [ ] `cc65/04-code-generation.md` complete
- [ ] `cc65/05-strengths.md` complete
- [ ] `cc65/06-weaknesses.md` complete
- [ ] `cc65/00-overview.md` finalized

### Questions to Answer

1. What 6502 patterns does cc65 use for frame access?
2. How efficient is the generated code?
3. What optimizations are applied?
4. What are the main limitations?

---

## Task Checklist (Phase 1 Only)

### Session 1.1: Stack Model
- [x] 1.1.1 Read stackptr.h  (2025-01-31 23:10)
- [x] 1.1.2 Analyze stackptr.c  (2025-01-31 23:10)
- [x] 1.1.3 Trace stack ops in expr.c  (2025-01-31 23:11)
- [x] 1.1.4 Document stack model  (2025-01-31 23:13)

### Session 1.2: Locals
- [x] 1.2.1 Read locals.h  (2025-01-31 23:14)
- [x] 1.2.2 Analyze locals.c  (2025-01-31 23:14)
- [x] 1.2.3 Study symtab.c  (2025-01-31 23:15)
- [x] 1.2.4 Document local handling  (2025-01-31 23:16)

### Session 1.3: Functions
- [x] 1.3.1 Analyze function.c  (2025-01-31 23:17)
- [x] 1.3.2 Study funcdesc.c  (2025-01-31 23:17)
- [x] 1.3.3 Return value handling  (2025-01-31 23:17)
- [x] 1.3.4 Document parameter passing  (2025-01-31 23:18)

### Session 1.4: Code Generation
- [x] 1.4.1 Study codegen.c patterns  (2025-01-31 23:21)
- [x] 1.4.2 Analyze generated frame code  (2025-01-31 23:23)
- [x] 1.4.3 Document strengths  (2025-01-31 23:25)
- [x] 1.4.4 Document weaknesses  (2025-01-31 23:26)
- [x] 1.4.5 Complete overview  (2025-01-31 23:27)
- [x] 1.4.6 Document code generation  (2025-01-31 23:24)

---

## Session Protocol

**See [99-execution-plan.md](99-execution-plan.md) for the continuous execution workflow.**

### Quick Reference

- **Continue research**: `continue sfa research per plans/sfa_research/99-execution-plan.md`
- **During session**: Mark tasks `[x]` as completed, update progress counter
- **At ~85% context**: Wrap up, `agent.sh finished`, `attempt_completion`, then `/compact`
- **Cross-phase**: When Phase 1 is done, continue to Phase 2 in same session if context allows

---

**Next Phase**: [99b-phase2-kickc.md](99b-phase2-kickc.md)