# AGENTS.md - Complete Project Context for AI Assistants

**Blend64 Project** - Commodore 64 Game Development Language
**Created:** January 1, 2026
**Purpose:** Ensure complete project context for AI assistants on every new task

---

## 🔴 CRITICAL FIRST STEP - READ THIS ENTIRELY

**Before starting ANY task in this project, you MUST read and understand this entire document.**

This file provides complete context about the Blend64 project, its goals, current status, technical specifications, and implementation approach. Without this context, you cannot successfully contribute to the project.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Current Project Status](#current-project-status)
3. [Essential Documentation](#essential-documentation)
4. [Technical Specifications](#technical-specifications)
5. [Architecture & Implementation Plan](#architecture--implementation-plan)
6. [Task Workflow Instructions](#task-workflow-instructions)
7. [Critical Constraints & Rules](#critical-constraints--rules)
8. [Required Reading Checklist](#required-reading-checklist)
9. [Quick Reference](#quick-reference)

---

## 📖 Project Overview

### What is Blend64?

**Blend64** is an **assembler-plus, ahead-of-time compiled language** designed specifically for **high-performance Commodore 64 game development**.

### Core Design Goals

- **Ahead-of-time compilation** to a single C64 PRG file
- **No implicit runtime** or standard library
- **Reachability-based dead-code elimination** (only used code is included)
- **Static memory only** (no heap, no local variables)
- **Deterministic output** and performance
- **Performance-first lowering** for real C64 hardware
- **Maximum possible FPS** on real hardware

### What Blend64 Is NOT

- Not a VM or bytecode language
- Not an interpreter
- Not a C replacement
- Not a BASIC replacement
- Not a scripting language
- Not portable (C64-specific only)

### Project Genesis

Blend64 is derived from the existing **Blend language** codebase but **deliberately cuts away modern-language abstractions** that don't map cleanly to 6502 hardware. This makes the implementation much faster than starting from scratch.

---

## 🎯 Current Project Status

### Implementation Approach

This project uses a **spec-first, task-driven approach** with:
- **37 detailed tasks** across **6 phases**
- Each task designed for **2-3 hours** of work
- **Self-contained instructions** with validation steps
- **Clear dependencies** and handoff points
- **Incremental testing** throughout

### Phase Status

| Phase | Status | Description | Tasks |
|-------|--------|-------------|-------|
| **Phase 1** | ✅ **Ready** | Lexer Adaptation | 5 tasks complete |
| **Phase 2** | 🟡 **Partial** | AST Modifications | 2/6 tasks ready |
| **Phase 3** | 📋 **Planned** | Parser Updates | Template ready |
| **Phase 4** | 📋 **Planned** | Type System | Template ready |
| **Phase 5** | 📋 **Planned** | Magic Phase | Template ready |
| **Phase 6** | 📋 **Planned** | Code Generation | Template ready |

### Estimated Timeline

- **Total:** 6-8 months with consistent progress
- **Phase 1-3 (Frontend):** 2-3 months
- **Phase 4-6 (Backend):** 4-6 months
- **AI Implementation:** ~185 hours (37 tasks × 5 hours average)

---

## 📚 Essential Documentation

### Core Specifications (MUST READ)

1. **`research/blend64-spec.md`** - Complete language specification
2. **`research/BLEND64_RULES.md`** - Rules and limitations
3. **`research/BLEND64_IL_SPEC.md`** - Intermediate representation spec
4. **`research/BLEND64_PERFORMANCE_RULES.md`** - Performance constraints
5. **`research/BLEND64_PERFORMANCE_ADDENDUM.md`** - Additional performance notes

### Implementation Planning

6. **`implementation-plan/MASTER_PLAN.md`** - Overview and dependencies
7. **`implementation-plan/IMPLEMENTATION_PLAN_SUMMARY.md`** - Status and next steps
8. **`implementation-plan/TASK_TEMPLATE.md`** - Task structure template
9. **`implementation-plan/HARDWARE_API_DESIGN.md`** - C64 hardware interface design

### Project Documentation

10. **`README.md`** - Project introduction and goals
11. **`SHOWCASE.md`** - Example programs and features
12. **`SPRITE_BALL_SHOWCASE.md`** - Sprite animation example

### Research Documents

13. **`research/blend64-diff-from-blend.md`** - Key differences from original Blend
14. **`research/BLEND64_IL_ADDENDUM.md`** - Additional IL details
15. **`research/BLEND64_REMAINING_WORK_ITEMS.md`** - Outstanding work items

---

## 🔧 Technical Specifications

### Compilation Pipeline

```
Source Code (.blend64)
    ↓
Lexer (tokenization)
    ↓
AST (abstract syntax tree)
    ↓
Type Checking
    ↓
Magic Phase (lowering & validation) ⭐ CRITICAL
    ↓
Blend64 IL (intermediate representation)
    ↓
Optimization
    ↓
6502 Code Generation
    ↓
PRG File (Commodore 64 executable)
```

### Type System

| Type | Size | Range | Notes |
|------|------|-------|-------|
| `byte` | 8-bit | 0-255 | Unsigned |
| `word` | 16-bit | 0-65535 | Unsigned |
| `boolean` | 8-bit | 0 or 1 | Simple flag |
| `string(N)` | N bytes | Fixed capacity | No dynamic allocation |

**Forbidden:** `integer`, floating-point, dynamic types

### Storage Classes

| Storage | Location | Purpose | Example |
|---------|----------|---------|---------|
| `zp` | Zero Page ($00-$FF) | Fastest access | `zp var score: byte` |
| `ram` | RAM (uninitialized) | Working variables | `ram var buffer: byte[256]` |
| `data` | RAM/ROM (initialized) | Static data | `data var palette: byte[16] = [...]` |
| `const` | ROM/Read-only | Constants | `const var title: string(20) = "GAME"` |
| `io` | Memory-mapped I/O | Hardware registers | `io var VIC_BORDER: byte @ $D020` |

### Critical Constraints

- **NO local variables** (all variables are static/global)
- **NO heap allocation** (fixed-size arrays only)
- **NO recursion** (direct or indirect)
- **NO returning structs/arrays** (scalars only)
- **NO implicit runtime** (every byte must be explicitly needed)
- **NO dead code** (reachability-based elimination)

---

## 🏗️ Architecture & Implementation Plan

### Project Structure

```
blend64/
├── packages/
│   ├── lexer/           # Token recognition (Phase 1)
│   ├── ast/            # AST definitions (Phase 2)
│   ├── parser/         # Grammar parsing (Phase 3)
│   ├── types/          # Type system (Phase 4)
│   ├── magic-phase/    # Lowering & validation (Phase 5)
│   └── codegen/        # 6502 code generation (Phase 6)
├── research/           # Language specifications
├── implementation-plan/ # Task breakdown
└── [root files]       # Documentation and examples
```

### Source Codebase

The implementation transforms the existing **Blend language** codebase located at:
**`/Users/gevik/workdir/blend-lang/packages/`**

### Reusability Assessment

- **Lexer:** 85% reusable (minor token changes)
- **Parser:** 75% reusable (grammar adaptations)
- **AST:** 70% reusable (remove OOP, add storage classes)
- **Type System:** 40% reusable (major simplifications)
- **Codegen:** 10% reusable (complete rewrite for 6502)

---

## 📋 Task Workflow Instructions

### Before Starting ANY Task

1. **Read this AGENTS.md file completely**
2. **Read the specific task file** (e.g., `TASK_1.1_UPDATE_TOKEN_TYPES.md`)
3. **Read referenced documentation** from the task requirements
4. **Understand the current phase** and dependencies
5. **Set up proper working directory** structure

### Task Execution Steps

1. **Copy required input files** from existing Blend codebase
2. **Apply specific modifications** as documented in task file
3. **Run validation tests** provided in task
4. **Verify success criteria** before proceeding
5. **Document any issues** or deviations

### Context Management Rules

- **Each task is self-contained** (no cross-task dependencies within phases)
- **Required input files are explicitly listed** in each task
- **Expected outputs are precisely specified**
- **Clear handoff points** between phases
- **Validation steps prevent** accumulating errors

### Development Environment

- **Node.js and TypeScript** for compiler development
- **Access to existing Blend codebase** at `/Users/gevik/workdir/blend-lang`
- **C64 emulator** for testing (VICE recommended)
- **6502 assembler** for reference (ACME, ca65)

---

## ⚠️ Critical Constraints & Rules

### Compilation Model

1. Blend64 **MUST** compile ahead-of-time to a C64 **PRG** file
2. **Reachability-based dead code elimination** is mandatory
3. **No monolithic runtime** may be linked by default
4. Only **explicitly needed code** may appear in final PRG

### Memory Model

5. **All variables MUST have static storage** (no locals)
6. **Scoping constructs are namespaces only** (no storage implications)
7. **Memory map must be emitted** showing all data placement
8. **Storage classes must be explicit or inferred**
9. **Pinned memory placements must be respected**

### Type System

10. **Exact type sizes must be defined** (`byte` = 8-bit, etc.)
11. **No abstract integer types** (removed or aliased to `word`)
12. **No floating-point types** (fixed-point via helpers)
13. **Strings are fixed-capacity only** (`string(N)`)

### Functions

14. **Functions MUST NOT have local variables**
15. **No nested functions or closures**
16. **Recursion is a compile-time error**
17. **Return only scalars** (`byte`, `word`, `boolean`, `void`)

### Magic Phase (Critical)

18. **Mandatory lowering/validation phase** after type checking
19. **Must enforce all static memory rules**
20. **Must prove string capacity bounds**
21. **Must build call graph for DCE**
22. **Must select helper routines**
23. **No feature may bypass this phase**

---

## ✅ Required Reading Checklist

**Before working on ANY task, confirm you have read and understood:**

### Core Language Design
- [ ] `README.md` - Project overview and goals
- [ ] `research/blend64-spec.md` - Complete language specification
- [ ] `research/BLEND64_RULES.md` - Rules and limitations

### Implementation Planning
- [ ] `implementation-plan/MASTER_PLAN.md` - Phase breakdown and dependencies
- [ ] `implementation-plan/IMPLEMENTATION_PLAN_SUMMARY.md` - Current status
- [ ] `implementation-plan/TASK_TEMPLATE.md` - Task structure

### Technical Specifications
- [ ] `research/BLEND64_IL_SPEC.md` - Intermediate representation
- [ ] `research/BLEND64_PERFORMANCE_RULES.md` - Performance constraints
- [ ] `research/blend64-diff-from-blend.md` - Key differences

### Current Task
- [ ] The specific task file you're working on (e.g., `TASK_1.1_...`)
- [ ] Any dependencies listed in the task file
- [ ] Referenced validation examples

**Do not proceed without completing this checklist.**

---

## 🚀 Quick Reference

### Key Commands

```bash
# Copy files from existing Blend codebase
cp -r /Users/gevik/workdir/blend-lang/packages/lexer ./packages/

# Run TypeScript compilation
npm run build

# Run validation tests
npm run test

# Run specific phase tests
npm run test:phase1
```

### Important Directories

```bash
/Users/gevik/workdir/blend-lang/    # Source Blend codebase
./research/                         # Blend64 specifications
./implementation-plan/              # Task breakdown
./packages/                         # Implementation work
```

### Phase Start Points

- **Phase 1:** `implementation-plan/phase-1-lexer/TASK_1.1_UPDATE_TOKEN_TYPES.md`
- **Phase 2:** `implementation-plan/phase-2-ast/TASK_2.1_REMOVE_OOP_NODES.md`
- **Phase 3:** Wait for Phase 2 completion
- **Phase 4:** Wait for Phase 3 completion
- **Phase 5:** Wait for Phase 4 completion
- **Phase 6:** Wait for Phase 5 completion

### Success Criteria by Phase

- **Phase 1:** All Blend64 syntax tokenizes correctly
- **Phase 2:** AST supports storage classes, removes OOP
- **Phase 3:** Complete Blend64 programs parse successfully
- **Phase 4:** Type system enforces static memory model
- **Phase 5:** Magic phase generates valid IL
- **Phase 6:** Working C64 PRG files produced

---

## 📞 Getting Help

### If You Need Clarification

1. **Re-read the relevant specification** documents
2. **Check the task file** for additional context
3. **Look for similar examples** in other completed tasks
4. **Document your assumptions** and proceed with best judgment
5. **Ask for clarification** if requirements are ambiguous

### Common Issues

- **Missing context:** Re-read this AGENTS.md file completely
- **Unclear requirements:** Check both task file and referenced specs
- **Failed validation:** Review success criteria and test expectations
- **Scope creep:** Focus only on specified changes in current task

---

## 🎯 Final Notes

### Project Vision

**Blend64 is what experienced C64 developers wish assembly looked like.**

It provides:
- **Predictable memory usage**
- **Deterministic performance**
- **Maximum possible FPS** on real hardware
- **Zero implicit runtime**
- **Full control** over memory layout without writing assembly

### Success Metrics

This project succeeds when:
- **Complete Blend64 programs** compile to working C64 PRG files
- **Performance requirements** are met on real hardware
- **Memory usage** is predictable and optimal
- **Development experience** is significantly better than assembly
- **Code quality** is maintainable and readable

### Your Role

As an AI assistant working on this project:
- **Read and understand** complete context before starting
- **Follow task instructions** precisely
- **Validate your work** at each step
- **Document any deviations** or assumptions
- **Focus on the current task** only (avoid scope creep)
- **Test incrementally** to catch errors early

---

**Remember: This is a serious systems programming project targeting real hardware. Precision and attention to detail are essential.**

**Start with Phase 1, Task 1.1: `implementation-plan/phase-1-lexer/TASK_1.1_UPDATE_TOKEN_TYPES.md`**
