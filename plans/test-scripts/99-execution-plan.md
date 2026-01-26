# Execution Plan: Test Scripts Enhancement

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and tasks for implementing the enhanced test scripts system.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Create compiler-test Script | 1 | 10 min |
| 2 | Create testing.md Rules | 1 | 15 min |
| 3 | Update Existing Clinerules | 1 | 15 min |
| 4 | Verification | 1 | 5 min |

**Total: 1 session, ~45 minutes**

---

## Phase 1: Create compiler-test Script

### Session 1.1: Implement Script

**Reference**: [Test Script Spec](03-test-script.md)

**Objective**: Create the `compiler-test` bash script

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Create compiler-test script | `compiler-test` |
| 1.1.2 | Make script executable | `chmod +x compiler-test` |

**Deliverables**:
- [ ] `compiler-test` script exists at project root
- [ ] Script is executable

---

## Phase 2: Create testing.md Rules

### Session 2.1: Create Testing Rules

**Reference**: [Testing Rules Spec](04-testing-rules.md)

**Objective**: Create `.clinerules/testing.md`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Create testing.md | `.clinerules/testing.md` |

**Deliverables**:
- [ ] `.clinerules/testing.md` exists with complete rules

---

## Phase 3: Update Existing Clinerules

### Session 3.1: Update All References

**Reference**: [Clinerules Updates Spec](05-clinerules-updates.md)

**Objective**: Update agents.md, project.md, code.md to reference testing.md

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Update agents.md | `.clinerules/agents.md` |
| 3.1.2 | Update project.md | `.clinerules/project.md` |
| 3.1.3 | Update code.md | `.clinerules/code.md` |

**Deliverables**:
- [ ] `agents.md` references `testing.md`
- [ ] `project.md` references `testing.md`
- [ ] `code.md` references `testing.md`

---

## Phase 4: Verification

### Session 4.1: Test and Verify

**Objective**: Verify everything works correctly

**Tasks**:
| # | Task | Command |
|---|------|---------|
| 4.1.1 | Test all tests run | `./compiler-test` |
| 4.1.2 | Test targeted tests | `./compiler-test parser` |
| 4.1.3 | Test multiple targets | `./compiler-test lexer il` |

**Deliverables**:
- [ ] All test commands work correctly
- [ ] All tests pass

---

## Task Checklist (All Phases)

### Phase 1: Create compiler-test Script
- [ ] 1.1.1 Create compiler-test script
- [ ] 1.1.2 Make script executable

### Phase 2: Create testing.md Rules
- [ ] 2.1.1 Create .clinerules/testing.md

### Phase 3: Update Existing Clinerules
- [ ] 3.1.1 Update agents.md to reference testing.md
- [ ] 3.1.2 Update project.md to reference testing.md
- [ ] 3.1.3 Update code.md to reference testing.md

### Phase 4: Verification
- [ ] 4.1.1 Verify ./compiler-test runs all tests
- [ ] 4.1.2 Verify ./compiler-test parser runs parser tests
- [ ] 4.1.3 Verify ./compiler-test lexer il runs both

---

## Session Protocol

### Starting Implementation

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Follow this execution plan
```

### Ending Implementation

```bash
# 1. Verify all tests pass
./compiler-test

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ `compiler-test` script created and executable
2. ✅ `.clinerules/testing.md` created with complete rules
3. ✅ `agents.md` references `testing.md`
4. ✅ `project.md` references `testing.md`
5. ✅ `code.md` references `testing.md`
6. ✅ `./compiler-test` runs all tests successfully
7. ✅ `./compiler-test parser` runs only parser tests
8. ✅ `./compiler-test lexer il` runs lexer and il tests