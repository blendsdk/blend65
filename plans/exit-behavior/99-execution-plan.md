# Execution Plan: Exit Behavior

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementing the `exitBehavior` compiler option.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Type Definitions | 1 | 15 min |
| 2 | Code Generator | 1 | 20 min |
| 3 | CLI Integration | 1 | 15 min |
| 4 | Testing | 1 | 20 min |

**Total: 1-2 sessions, ~70 minutes**

---

## Phase 1: Type Definitions

### Session 1.1: Add ExitBehavior Type

**Reference**: [Config Types](03-config-types.md)

**Objective**: Define the `ExitBehavior` type and add to configuration interfaces

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Add `ExitBehavior` type | `packages/compiler/src/config/types.ts` |
| 1.1.2 | Add `exitBehavior` to `CompilerOptions` | `packages/compiler/src/config/types.ts` |
| 1.1.3 | Export `ExitBehavior` type | `packages/compiler/src/config/index.ts` |
| 1.1.4 | Add exit constants | `packages/compiler/src/codegen/types.ts` |
| 1.1.5 | Add `exitBehavior` to `CodegenOptions` | `packages/compiler/src/codegen/types.ts` |

**Deliverables**:
- [ ] `ExitBehavior` type defined and exported
- [ ] `CompilerOptions.exitBehavior` property added
- [ ] `CodegenOptions.exitBehavior` property added
- [ ] Exit address constants added
- [ ] Types compile without errors

**Verify**: `./compiler-test config`

---

## Phase 2: Code Generator

### Session 2.1: Implement Exit Code Generation

**Reference**: [Code Generator](05-code-generator.md)

**Objective**: Implement `generateExitCode()` method and update `generateEntryPoint()`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Add `generateExitCode()` method | `packages/compiler/src/codegen/code-generator.ts` |
| 2.1.2 | Update `generateEntryPoint()` to use `exitBehavior` | `packages/compiler/src/codegen/code-generator.ts` |
| 2.1.3 | Import `ExitBehavior` type | `packages/compiler/src/codegen/code-generator.ts` |

**Deliverables**:
- [ ] `generateExitCode()` method implemented
- [ ] `generateEntryPoint()` uses configurable exit
- [ ] 'loop' behavior matches current output
- [ ] 'basic' generates JMP $A474
- [ ] 'reset' generates JMP $FCE2

**Verify**: `./compiler-test codegen`

---

## Phase 3: CLI Integration

### Session 3.1: Add CLI Option

**Reference**: [CLI Integration](04-cli-integration.md)

**Objective**: Add `--exit-behavior` flag to build command

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Add `exitBehavior` to `BuildOptions` | `packages/cli/src/commands/build.ts` |
| 3.1.2 | Add yargs option definition | `packages/cli/src/commands/build.ts` |
| 3.1.3 | Update `buildConfig()` to include `exitBehavior` | `packages/cli/src/commands/build.ts` |
| 3.1.4 | Add usage example | `packages/cli/src/commands/build.ts` |

**Deliverables**:
- [ ] `--exit-behavior` flag works
- [ ] `-e` alias works
- [ ] All three values accepted
- [ ] Invalid values rejected with error
- [ ] Help text shows option

**Verify**: Manual test with `./packages/cli/bin/blend65.js build --help`

---

## Phase 4: Testing

### Session 4.1: Add Tests

**Reference**: [Testing Strategy](06-testing-strategy.md)

**Objective**: Add unit tests for exit behavior

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Add exit behavior unit tests | `packages/compiler/src/__tests__/codegen/code-generator.test.ts` |
| 4.1.2 | Test 'loop' exit behavior | code-generator.test.ts |
| 4.1.3 | Test 'basic' exit behavior | code-generator.test.ts |
| 4.1.4 | Test 'reset' exit behavior | code-generator.test.ts |
| 4.1.5 | Test default behavior | code-generator.test.ts |

**Deliverables**:
- [ ] 5+ new tests added
- [ ] All tests pass
- [ ] No regressions

**Verify**: `./compiler-test codegen`

---

## Task Checklist (All Phases)

### Phase 1: Type Definitions
- [ ] 1.1.1 Add `ExitBehavior` type to config/types.ts
- [ ] 1.1.2 Add `exitBehavior` to `CompilerOptions` interface
- [ ] 1.1.3 Export `ExitBehavior` from config/index.ts
- [ ] 1.1.4 Add C64_BASIC_WARM_START and C64_RESET_VECTOR constants
- [ ] 1.1.5 Add `exitBehavior` to `CodegenOptions` interface

### Phase 2: Code Generator
- [ ] 2.1.1 Implement `generateExitCode()` method
- [ ] 2.1.2 Update `generateEntryPoint()` to use `exitBehavior`
- [ ] 2.1.3 Import types and constants

### Phase 3: CLI Integration
- [ ] 3.1.1 Add `exitBehavior` to `BuildOptions`
- [ ] 3.1.2 Add `--exit-behavior` yargs option
- [ ] 3.1.3 Update `buildConfig()` function
- [ ] 3.1.4 Add usage example

### Phase 4: Testing
- [ ] 4.1.1 Add test describe block for exit behavior
- [ ] 4.1.2 Test 'loop' generates infinite loop
- [ ] 4.1.3 Test 'basic' generates JMP $A474
- [ ] 4.1.4 Test 'reset' generates JMP $FCE2
- [ ] 4.1.5 Test default is 'loop'

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/exit-behavior/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. End agent settings
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
Phase 1: Type Definitions
    ↓
Phase 2: Code Generator (needs types)
    ↓
Phase 3: CLI Integration (needs types)
    ↓
Phase 4: Testing (needs implementation)
```

---

## Success Criteria

**Feature is complete when**:
1. ✅ All phases completed
2. ✅ All tests passing (`./compiler-test`)
3. ✅ No TypeScript errors
4. ✅ CLI help shows new option
5. ✅ Example compiles with `--exit-behavior=basic`

---

## Quick Implementation (Single Session)

Since this is a small feature, it can be implemented in a single session:

```bash
# Start
clear && scripts/agent.sh start

# Implement all phases in order:
# 1. Type definitions
# 2. Code generator changes  
# 3. CLI integration
# 4. Tests

# Verify all tests pass
./compiler-test

# End
clear && scripts/agent.sh finished
```

**Estimated single session time: ~60-90 minutes**