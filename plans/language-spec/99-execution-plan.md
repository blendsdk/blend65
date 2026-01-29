# Execution Plan: Blend65 Language Specification

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for completing the Blend65 language specification.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Update Existing Documents | 2 | 2 hours |
| 2 | Core Language (Copy & Modify) | 3 | 3 hours |
| 3 | Expressions & Statements | 2 | 2 hours |
| 4 | Functions & Modules | 2 | 2 hours |
| 5 | ASM Functions (New) | 1-2 | 1-2 hours |
| 6 | Cleanup & Archive | 1 | 1 hour |

**Total: 8-12 sessions, ~8-12 hours**

---

## Phase 1: Update Existing Documents

### Session 1.1: Update README.md

**Objective**: Clean up the main README to remove version references

**Tasks**:

| # | Task | Description |
|---|------|-------------|
| 1.1.1 | Remove version mentions | Remove "v2", version numbers from title/status |
| 1.1.2 | Update document index | Ensure all 11 documents listed correctly |
| 1.1.3 | Update quick reference | Verify types, storage classes, intrinsics |
| 1.1.4 | Remove @map from examples | Update example program |
| 1.1.5 | Verify restrictions section | No recursion, no @map |

**Source**: `docs/language-specification-v2/README.md`

**Deliverables**:
- [ ] README.md updated
- [ ] No version references
- [ ] Example program uses peek/poke instead of @map

---

### Session 1.2: Update 08-intrinsics.md and 10-compiler.md

**Objective**: Verify and update existing documents

**Tasks**:

| # | Task | Description |
|---|------|-------------|
| 1.2.1 | Review 08-intrinsics.md | Verify 10 core intrinsics documented |
| 1.2.2 | Remove version mentions | Clean any v1/v2 references |
| 1.2.3 | Review 10-compiler.md | Verify SFA architecture documented |
| 1.2.4 | Update cross-references | Fix any broken links |

**Source**: Existing files in `docs/language-specification-v2/`

**Deliverables**:
- [ ] 08-intrinsics.md verified/updated
- [ ] 10-compiler.md verified/updated
- [ ] No version references

---

## Phase 2: Core Language Documents

### Session 2.1: Create 00-overview.md

**Objective**: Copy and update overview document

**Tasks**:

| # | Task | Description |
|---|------|-------------|
| 2.1.1 | Copy from v1 | Copy `docs/language-specification/00-overview.md` |
| 2.1.2 | Remove @map mentions | Remove all memory-mapped references |
| 2.1.3 | Add SFA mention | Note Static Frame Allocation architecture |
| 2.1.4 | Add no-recursion note | Document recursion restriction |
| 2.1.5 | Update document links | Fix cross-references |

**Source**: `docs/language-specification/00-overview.md`
**Target**: `docs/language-specification-v2/00-overview.md`

**Deliverables**:
- [ ] 00-overview.md created
- [ ] No @map references
- [ ] Recursion restriction mentioned

---

### Session 2.2: Create 01-lexical-structure.md

**Objective**: Copy and update lexical structure

**Tasks**:

| # | Task | Description |
|---|------|-------------|
| 2.2.1 | Copy from v1 | Copy `docs/language-specification/01-lexical-structure.md` |
| 2.2.2 | Remove @map tokens | Remove @map-related tokens from keyword list |
| 2.2.3 | Verify keywords | @zp, @ram, @data remain |
| 2.2.4 | Update examples | Remove any @map examples |

**Source**: `docs/language-specification/01-lexical-structure.md`
**Target**: `docs/language-specification-v2/01-lexical-structure.md`

**Deliverables**:
- [ ] 01-lexical-structure.md created
- [ ] No @map tokens

---

### Session 2.3: Create 02-types.md

**Objective**: Copy type system documentation

**Tasks**:

| # | Task | Description |
|---|------|-------------|
| 2.3.1 | Copy from v1 | Copy `docs/language-specification/05-type-system.md` |
| 2.3.2 | Rename to 02-types.md | Rename for new structure |
| 2.3.3 | Minor updates | Verify types match (byte, word, boolean, arrays, string, callback) |
| 2.3.4 | Add @address type | Document pointer semantic alias |

**Source**: `docs/language-specification/05-type-system.md`
**Target**: `docs/language-specification-v2/02-types.md`

**Deliverables**:
- [ ] 02-types.md created
- [ ] All types documented

---

## Phase 3: Expressions & Statements

### Session 3.1: Create 04-expressions.md

**Objective**: Extract and document expressions

**Tasks**:

| # | Task | Description |
|---|------|-------------|
| 3.1.1 | Extract from v1 | Extract expression content from `06-expressions-statements.md` |
| 3.1.2 | Document operators | Arithmetic, comparison, logical, bitwise, assignment |
| 3.1.3 | Precedence table | Include operator precedence table |
| 3.1.4 | Expression examples | All expression types with examples |

**Source**: `docs/language-specification/06-expressions-statements.md`
**Target**: `docs/language-specification-v2/04-expressions.md`

**Deliverables**:
- [ ] 04-expressions.md created
- [ ] Operator precedence table included

---

### Session 3.2: Create 05-statements.md

**Objective**: Extract and document statements

**Tasks**:

| # | Task | Description |
|---|------|-------------|
| 3.2.1 | Extract from v1 | Extract statement content from `06-expressions-statements.md` |
| 3.2.2 | Document control flow | if/else, while, do-while, for, switch |
| 3.2.3 | Document other statements | return, break, continue |
| 3.2.4 | Statement examples | All statement types with examples |

**Source**: `docs/language-specification/06-expressions-statements.md`
**Target**: `docs/language-specification-v2/05-statements.md`

**Deliverables**:
- [ ] 05-statements.md created
- [ ] All control flow documented

---

## Phase 4: Functions & Modules

### Session 4.1: Create 03-variables.md and 06-functions.md

**Objective**: Copy and update variable and function documentation

**Tasks**:

| # | Task | Description |
|---|------|-------------|
| 4.1.1 | Copy variables from v1 | Copy `docs/language-specification/10-variables.md` |
| 4.1.2 | Remove @map references | Remove all @map mentions from variables |
| 4.1.3 | Rename to 03-variables.md | Rename for new structure |
| 4.1.4 | Copy functions from v1 | Copy `docs/language-specification/11-functions.md` |
| 4.1.5 | Add recursion prohibition | Add section on no recursion allowed |
| 4.1.6 | Rename to 06-functions.md | Rename for new structure |

**Source**: `docs/language-specification/10-variables.md`, `docs/language-specification/11-functions.md`
**Target**: `docs/language-specification-v2/03-variables.md`, `docs/language-specification-v2/06-functions.md`

**Deliverables**:
- [ ] 03-variables.md created (no @map)
- [ ] 06-functions.md created (recursion prohibited)

---

### Session 4.2: Create 07-modules.md

**Objective**: Copy and update module documentation

**Tasks**:

| # | Task | Description |
|---|------|-------------|
| 4.2.1 | Copy from v1 | Copy `docs/language-specification/04-module-system.md` |
| 4.2.2 | Rename to 07-modules.md | Rename for new structure |
| 4.2.3 | Minor updates | Verify import/export syntax |
| 4.2.4 | Remove @map exports | Remove any @map export examples |

**Source**: `docs/language-specification/04-module-system.md`
**Target**: `docs/language-specification-v2/07-modules.md`

**Deliverables**:
- [ ] 07-modules.md created

---

## Phase 5: ASM Functions

### Session 5.1: Create 09-asm-functions.md

**Objective**: Document all 56 6502 asm_*() functions

**Tasks**:

| # | Task | Description |
|---|------|-------------|
| 5.1.1 | Create document structure | Overview, categories, function list |
| 5.1.2 | Document load/store | asm_lda_*, asm_ldx_*, asm_ldy_*, asm_sta_*, etc. |
| 5.1.3 | Document transfer | asm_tax, asm_tay, asm_txa, asm_tya, etc. |
| 5.1.4 | Document stack | asm_pha, asm_pla, asm_php, asm_plp, asm_tsx, asm_txs |
| 5.1.5 | Document arithmetic | asm_adc_*, asm_sbc_*, etc. |
| 5.1.6 | Document logic | asm_and_*, asm_ora_*, asm_eor_* |
| 5.1.7 | Document shifts | asm_asl_*, asm_lsr_*, asm_rol_*, asm_ror_* |
| 5.1.8 | Document compare | asm_cmp_*, asm_cpx_*, asm_cpy_* |
| 5.1.9 | Document inc/dec | asm_inc_*, asm_dec_*, asm_inx, asm_iny, etc. |
| 5.1.10 | Document branches | asm_bcc, asm_bcs, asm_beq, asm_bmi, etc. |
| 5.1.11 | Document jumps | asm_jmp_*, asm_jsr, asm_rts, asm_rti |
| 5.1.12 | Document flags | asm_clc, asm_sec, asm_cli, asm_sei, asm_clv, asm_cld, asm_sed |
| 5.1.13 | Document misc | asm_nop, asm_brk, asm_bit_* |

**Target**: `docs/language-specification-v2/09-asm-functions.md`

**Deliverables**:
- [ ] 09-asm-functions.md created
- [ ] All 56 6502 instructions documented as asm_*() functions

---

## Phase 6: Cleanup & Archive

### Session 6.1: Final Cleanup

**Objective**: Final review and archive old spec

**Tasks**:

| # | Task | Description |
|---|------|-------------|
| 6.1.1 | Review all documents | Verify no version references |
| 6.1.2 | Verify cross-references | All document links work |
| 6.1.3 | Archive old spec | Move `docs/language-specification/` to `archive/docs/` |
| 6.1.4 | Rename new spec | Rename `docs/language-specification-v2/` to `docs/language-specification/` |
| 6.1.5 | Update README links | Update any root README references |

**Deliverables**:
- [ ] All documents reviewed
- [ ] Old spec archived
- [ ] New spec in place as `docs/language-specification/`

---

## Task Checklist (All Phases)

### Phase 1: Update Existing
- [ ] 1.1.1 Remove version mentions from README
- [ ] 1.1.2 Update document index in README
- [ ] 1.1.3 Update quick reference in README
- [ ] 1.1.4 Remove @map from examples in README
- [ ] 1.1.5 Verify restrictions section in README
- [ ] 1.2.1 Review 08-intrinsics.md
- [ ] 1.2.2 Remove version mentions from intrinsics
- [ ] 1.2.3 Review 10-compiler.md
- [ ] 1.2.4 Update cross-references

### Phase 2: Core Language
- [ ] 2.1.1 Copy 00-overview from v1
- [ ] 2.1.2 Remove @map mentions from overview
- [ ] 2.1.3 Add SFA mention to overview
- [ ] 2.1.4 Add no-recursion note to overview
- [ ] 2.1.5 Update document links in overview
- [ ] 2.2.1 Copy 01-lexical-structure from v1
- [ ] 2.2.2 Remove @map tokens from lexical
- [ ] 2.2.3 Verify keywords in lexical
- [ ] 2.2.4 Update examples in lexical
- [ ] 2.3.1 Copy 05-type-system from v1
- [ ] 2.3.2 Rename to 02-types.md
- [ ] 2.3.3 Verify types in 02-types
- [ ] 2.3.4 Add @address type

### Phase 3: Expressions & Statements
- [ ] 3.1.1 Extract expressions from v1
- [ ] 3.1.2 Document operators
- [ ] 3.1.3 Include precedence table
- [ ] 3.1.4 Add expression examples
- [ ] 3.2.1 Extract statements from v1
- [ ] 3.2.2 Document control flow
- [ ] 3.2.3 Document other statements
- [ ] 3.2.4 Add statement examples

### Phase 4: Functions & Modules
- [ ] 4.1.1 Copy 10-variables from v1
- [ ] 4.1.2 Remove @map references from variables
- [ ] 4.1.3 Rename to 03-variables.md
- [ ] 4.1.4 Copy 11-functions from v1
- [ ] 4.1.5 Add recursion prohibition
- [ ] 4.1.6 Rename to 06-functions.md
- [ ] 4.2.1 Copy 04-module-system from v1
- [ ] 4.2.2 Rename to 07-modules.md
- [ ] 4.2.3 Verify import/export syntax
- [ ] 4.2.4 Remove @map exports

### Phase 5: ASM Functions
- [ ] 5.1.1 Create 09-asm-functions document structure
- [ ] 5.1.2 Document load/store instructions
- [ ] 5.1.3 Document transfer instructions
- [ ] 5.1.4 Document stack instructions
- [ ] 5.1.5 Document arithmetic instructions
- [ ] 5.1.6 Document logic instructions
- [ ] 5.1.7 Document shift instructions
- [ ] 5.1.8 Document compare instructions
- [ ] 5.1.9 Document inc/dec instructions
- [ ] 5.1.10 Document branch instructions
- [ ] 5.1.11 Document jump instructions
- [ ] 5.1.12 Document flag instructions
- [ ] 5.1.13 Document misc instructions

### Phase 6: Cleanup
- [ ] 6.1.1 Review all documents
- [ ] 6.1.2 Verify cross-references
- [ ] 6.1.3 Archive old spec
- [ ] 6.1.4 Rename new spec
- [ ] 6.1.5 Update README links

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/language-spec/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. End agent settings
clear && scripts/agent.sh finished

# 2. Compact conversation
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
Phase 1 (Update Existing)
    ↓
Phase 2 (Core Language)
    ↓
Phase 3 (Expressions & Statements)
    ↓
Phase 4 (Functions & Modules)
    ↓
Phase 5 (ASM Functions)
    ↓
Phase 6 (Cleanup)
```

---

## Success Criteria

**Language Specification is complete when**:

1. ✅ All 11 documents created
2. ✅ No version references (v1/v2)
3. ✅ No @map syntax documented
4. ✅ Recursion prohibition documented
5. ✅ All 56 asm_*() functions documented
6. ✅ All cross-references work
7. ✅ Old spec archived
8. ✅ New spec in place as `docs/language-specification/`