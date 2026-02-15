# Execution Plan: Data Alignment

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2025-02-15 01:58
> **Progress**: 10/18 tasks (56%)

## Overview

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Lexer: New tokens | 1 | 30 min |
| 2 | Parser: Alignment syntax + sugar | 1 | 45 min |
| 3 | AST & Semantic: Alignment field + validation | 1 | 30 min |
| 4 | Frame & Emitter: !align output | 1 | 30 min |
| 5 | Language specification updates | 1 | 20 min |
| 6 | Example programs | 1 | 20 min |
| 7 | Testing: All phases | 1-2 | 60 min |

**Total: 6-8 sessions, ~4-5 hours**

---

## Phase 1: Lexer — New Tokens

### Session 1.1: Add alignment-related tokens

**Objective**: Lexer recognizes `@sprite`, `@charset`, `@screen`, `@bitmap`, `@page`, and `align` keyword.

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Add SPRITE, CHARSET, SCREEN, BITMAP, PAGE token types | `src/lexer/types.ts` |
| 1.1.2 | Add ALIGN keyword token (for `align:` inside parens) | `src/lexer/types.ts` |
| 1.1.3 | Register `@sprite`/`@charset`/`@screen`/`@bitmap`/`@page` in lexer keyword map | `src/lexer/lexer.ts` |
| 1.1.4 | Write lexer tests for all new tokens | `__tests__/lexer/` |

**Verify**: `./compiler-test lexer`

---

## Phase 2: Parser — Alignment Syntax + Sugar

### Session 2.1: Parse @data(align: N) and sugar keywords

**Objective**: Parser produces VariableDeclaration with `alignment` field.

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Add `alignment?: number` to VariableDeclaration AST node | `src/ast/` |
| 2.1.2 | Parse `@data(align: N)` — detect `(` after @data, parse `align:` + number + `)` | `src/parser/declarations.ts` |
| 2.1.3 | Parse `@ram(align: N)` — same pattern | `src/parser/declarations.ts` |
| 2.1.4 | Parse sugar keywords — `@sprite` → storageClass=DATA + alignment=64, etc. | `src/parser/declarations.ts` |
| 2.1.5 | Write parser tests for all syntax variants | `__tests__/parser/` |

**Verify**: `./compiler-test parser`

---

## Phase 3: Semantic — Validation

### Session 3.1: Validate alignment values

**Objective**: Semantic analyzer validates alignment constraints.

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Validate alignment is power-of-2 (use `(n & (n-1)) === 0`) | `src/semantic/` |
| 3.1.2 | Validate alignment range 2–16384 | `src/semantic/` |
| 3.1.3 | Sugar keywords enforce `const` + initializer (same as @data) | `src/semantic/` |
| 3.1.4 | Write semantic tests for validation | `__tests__/semantic/` |

**Verify**: `./compiler-test semantic`

---

## Phase 4: Frame & Emitter — !align Output

### Session 4.1: Propagate alignment and emit ACME directives

**Objective**: Assembly output includes `!align` before aligned data labels.

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Add `alignment?: number` to GlobalSlot and FrameSlot | `src/frame/types.ts` |
| 4.1.2 | Propagate alignment from AST → GlobalAllocator → GlobalSlot | `src/frame/allocator/` |
| 4.1.3 | Emit `!align (N-1), 0` before data label in codegen data segment | `src/pipeline/codegen-phase.ts` or `src/codegen/` |
| 4.1.4 | Write emitter/pipeline tests verifying !align in output | `__tests__/` |

**Verify**: `./compiler-test codegen pipeline`

---

## Phase 5: Language Specification

### Session 5.1: Update language spec

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.1.1 | Update 03-variables.md with @data(align:N) syntax and sugar keywords | `docs/language-specification-v2/03-variables.md` |
| 5.1.2 | Add EBNF grammar for alignment syntax | `docs/language-specification-v2/03-variables.md` |

---

## Phase 6: Example Programs

### Session 6.1: Create example .blend files

**Tasks**:
| # | Task | File |
|---|------|------|
| 6.1.1 | Update balloon-sprite example to use @sprite | `examples/balloon-sprite/main.blend` |
| 6.1.2 | Create space-shooter example (100 sprite frames) | `examples/space-shooter/` |

---

## Phase 7: Comprehensive Testing

### Session 7.1: E2E and integration tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 7.1.1 | E2E tests: compile examples, verify !align in output | `__tests__/e2e/` |
| 7.1.2 | Run full test suite, verify 0 regressions | `./compiler-test` |

---

## Task Checklist (All Phases)

### Phase 1: Lexer
- [x] 1.1.1 Add new token types (SPRITE, CHARSET, SCREEN, BITMAP, PAGE, ALIGN) ✅
- [x] 1.1.2 Register @-prefixed keywords in lexer ✅
- [x] 1.1.3 Write lexer tests ✅

### Phase 2: Parser
- [x] 2.1.1 Add alignment field to VariableDeclaration AST ✅
- [x] 2.1.2 Parse @data(align: N) syntax ✅
- [x] 2.1.3 Parse @ram(align: N) syntax ✅
- [x] 2.1.4 Parse sugar keywords → alignment values ✅
- [x] 2.1.5 Write parser tests ✅

### Phase 3: Semantic
- [x] 3.1.1 Validate power-of-2 alignment ✅
- [x] 3.1.2 Validate alignment range ✅
- [x] 3.1.3 Sugar enforces const + initializer ✅
- [x] 3.1.4 Write semantic tests ✅

### Phase 4: Frame & Emitter
- [ ] 4.1.1 Add alignment to GlobalSlot/FrameSlot
- [ ] 4.1.2 Propagate alignment through allocator
- [ ] 4.1.3 Emit !align directive in assembly
- [ ] 4.1.4 Write emitter tests

### Phase 5: Language Spec
- [ ] 5.1.1 Update 03-variables.md
- [ ] 5.1.2 Add EBNF grammar

### Phase 6: Examples
- [ ] 6.1.1 Update balloon-sprite with @sprite
- [ ] 6.1.2 Create space-shooter example

### Phase 7: Testing
- [ ] 7.1.1 E2E tests
- [ ] 7.1.2 Full regression test

---

## Session Protocol

### Starting a Session
```bash
clear && scripts/agent.sh start
# "Implement Phase X, Session X.X per plans/data-alignment/99-execution-plan.md"
```

### Ending a Session
```bash
# 1. Verify tests pass
./compiler-test

# 2. If tests pass, commit using gitcm protocol (see .clinerules/git-commands.md)
# ⚠️ NEVER use inline git commit -m "..." — use gitcm protocol instead
clear && git add .
# Then follow gitcm: write message to /tmp/git_commit_msg.txt, commit with -F

# 3. End agent settings
clear && scripts/agent.sh finished

# 4. Call attempt_completion
# 5. User runs /compact
```

## Dependencies

```
Phase 1 (Lexer)
    ↓
Phase 2 (Parser)
    ↓
Phase 3 (Semantic)
    ↓
Phase 4 (Frame & Emitter)
    ↓
Phase 5 (Language Spec) + Phase 6 (Examples)
    ↓
Phase 7 (Testing)
```

## Success Criteria

1. ✅ All phases completed
2. ✅ All tests passing (8830+ existing + ~65 new)
3. ✅ No regressions
4. ✅ Language spec updated
5. ✅ Example programs compile correctly
6. ✅ `@sprite` and `@data(align: 64)` produce identical output
