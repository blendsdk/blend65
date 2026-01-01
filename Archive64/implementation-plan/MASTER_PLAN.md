# Blend64 Implementation Plan - Master Overview

**Status:** Ready for execution
**Target:** Complete Blend64 compiler from existing Blend codebase
**Estimated Timeline:** 5-8 months
**Context Window Requirement:** Each task designed for <30K tokens

---

## Overview

This implementation plan transforms the existing Blend language implementation into Blend64, a specialized C64 game development language. The plan is structured as small, self-contained tasks that can be completed by AI assistants with limited context windows.

---

## Project Structure

```
blend64/
├── packages/
│   ├── lexer/           # Token recognition and classification
│   ├── ast/            # Abstract Syntax Tree definitions
│   ├── parser/         # Recursive descent parser
│   ├── types/          # Type system and checking
│   ├── magic-phase/    # AST transformation and validation
│   └── codegen/        # 6502 code generation and IL
├── research/           # Language specifications (existing)
└── implementation-plan/ # This folder with task breakdown
```

---

## Phase Breakdown

### Phase 1: Lexer Adaptation (1-2 weeks)
**Goal:** Modify tokenization for Blend64 syntax
**Input:** `/Users/gevik/workdir/blend-lang/packages/lexer`
**Output:** Blend64-compatible lexer
**Tasks:** 5 small tasks

### Phase 2: AST Modifications (2-3 weeks)
**Goal:** Remove OOP features, add Blend64 constructs
**Input:** `/Users/gevik/workdir/blend-lang/packages/ast`
**Output:** Blend64-compatible AST definitions
**Tasks:** 6 small tasks

### Phase 3: Parser Updates (3-4 weeks)
**Goal:** Parse Blend64 grammar correctly
**Input:** `/Users/gevik/workdir/blend-lang/packages/parser`
**Output:** Working Blend64 parser
**Tasks:** 8 small tasks

### Phase 4: Type System (2-3 weeks)
**Goal:** Implement static-only type system
**Input:** Modified AST
**Output:** Type checker for Blend64
**Tasks:** 4 small tasks

### Phase 5: Magic Phase (6-8 weeks)
**Goal:** AST transformation and validation
**Input:** Parsed Blend64 AST
**Output:** Validated, lowered IR ready for codegen
**Tasks:** 6 small tasks

### Phase 6: Code Generation (8-12 weeks)
**Goal:** 6502 machine code generation
**Input:** Magic phase output
**Output:** Working C64 PRG files
**Tasks:** 8 small tasks

---

## Task Dependencies

```
Phase 1 (Lexer)
├── 1.1 Update Token Types
├── 1.2 Update Keywords
├── 1.3 Fix Operator Precedence
├── 1.4 Add Storage Syntax
└── 1.5 Test & Validate
    ↓
Phase 2 (AST)
├── 2.1 Remove OOP Nodes
├── 2.2 Add Storage Classes
├── 2.3 Add Placement Annotations
├── 2.4 Add Attributes
├── 2.5 Add Hotloop Statement
└── 2.6 Update Type Annotations
    ↓
Phase 3 (Parser)
├── 3.1 Update Expression Parsing
├── 3.2 Add Variable Declaration Parsing
├── 3.3 Add Function Declaration Parsing
├── 3.4 Add Control Flow Parsing
├── 3.5 Add Module/Import Parsing
├── 3.6 Add Match Statement Parsing
├── 3.7 Add Template String Parsing
└── 3.8 Integration Testing
    ↓
Phase 4 (Types)
├── 4.1 Define Blend64 Type System
├── 4.2 Implement Type Checker
├── 4.3 Add Storage Class Validation
└── 4.4 Add Size/Layout Computation
    ↓
Phase 5 (Magic)
├── 5.1 AST Desugaring
├── 5.2 Static Memory Analysis
├── 5.3 Call Graph Construction
├── 5.4 Reachability Analysis
├── 5.5 Helper Selection
└── 5.6 IL Generation
    ↓
Phase 6 (Codegen)
├── 6.1 IL Definition
├── 6.2 Basic 6502 Instructions
├── 6.3 Zero Page Management
├── 6.4 Memory Layout
├── 6.5 PRG Generation
├── 6.6 Performance Analysis
├── 6.7 Optimization Passes
└── 6.8 Final Integration
```

---

## Success Criteria

### Phase 1-3: Frontend Complete
- [ ] Can parse all Blend64 syntax from research/blend64-spec.md
- [ ] Generates correct AST for test programs
- [ ] Error messages are clear and helpful

### Phase 4: Type System
- [ ] Enforces static memory model
- [ ] Validates storage class usage
- [ ] Computes accurate memory layouts

### Phase 5: Magic Phase
- [ ] Correctly transforms high-level constructs
- [ ] Enforces all Blend64 constraints
- [ ] Generates analyzable IL

### Phase 6: Code Generation
- [ ] Produces working C64 PRG files
- [ ] Meets performance requirements
- [ ] Generates required artifacts (.map, .lst, etc.)

---

## Development Workflow

### For Each Task:
1. **Read task specification** (single .md file)
2. **Copy required input files** from existing Blend codebase
3. **Apply specific modifications** as documented
4. **Run validation tests** provided in task
5. **Verify success criteria** before proceeding

### Context Management:
- Each task file is **self-contained**
- Required input files are **explicitly listed**
- Expected outputs are **precisely specified**
- **No cross-task dependencies** within phases
- **Clear handoff** between phases

### Quality Assurance:
- All tasks include **validation steps**
- **Regression tests** prevent breaking existing functionality
- **Integration checkpoints** at phase boundaries
- **Incremental testing** throughout development

---

## Getting Started

1. **Start with Phase 1, Task 1.1**
2. **Copy source files** from blend-lang to blend64
3. **Follow task instructions** precisely
4. **Validate before proceeding** to next task
5. **Document any deviations** or issues

---

## Notes for AI Implementation

- **Read only one task file at a time** to manage context
- **Focus on specified changes only** - avoid scope creep
- **Test incrementally** - don't accumulate errors
- **Document assumptions** when specifications are unclear
- **Ask for clarification** if task requirements are ambiguous

---

Next: Start with `phase-1-lexer/TASK_1.1_UPDATE_TOKEN_TYPES.md`
