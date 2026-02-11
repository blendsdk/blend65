# Execution Plan: DX Features

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

---

## Overview

This document defines the execution phases and AI chat sessions for implementing DX features.

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time | Priority |
|-------|-------|----------|-----------|----------|
| 1 | Source Maps & Debug Support | 2 | 2-3 hours | MEDIUM |
| 2 | VICE Integration | 1-2 | 1-2 hours | MEDIUM |
| 3 | CLI Commands & Templates | 2 | 2-3 hours | MEDIUM |
| 4 | E2E Test Rig | 1-2 | 1-2 hours | LOW |

**Total: 6-8 sessions, ~6-10 hours**

---

## Phase 1: Source Maps & Debug Support

### Session 1.1: Source Mapper Types & Implementation

**Reference**: [03-source-maps.md](03-source-maps.md)

**Objective**: Implement SourceMapper class for tracking source-to-assembly mapping.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Create source map types | `packages/compiler/src/codegen/source-map-types.ts` |
| 1.1.2 | Implement SourceMapper class | `packages/compiler/src/codegen/source-mapper.ts` |
| 1.1.3 | Add unit tests for SourceMapper | `packages/compiler/src/__tests__/codegen/source-mapper.test.ts` |
| 1.1.4 | Export from codegen index | `packages/compiler/src/codegen/index.ts` |

**Deliverables**:
- [ ] SourceMapEntry, DebugMode types defined
- [ ] SourceMapper class with address tracking
- [ ] Label registration working
- [ ] Unit tests passing

**Verify**: `./compiler-test codegen`

---

### Session 1.2: Debug Output Integration

**Reference**: [03-source-maps.md](03-source-maps.md)

**Objective**: Integrate source maps with code generator and CLI.

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.2.1 | Add VICE label generation | `packages/compiler/src/codegen/source-mapper.ts` |
| 1.2.2 | Add inline comment generation | `packages/compiler/src/codegen/source-mapper.ts` |
| 1.2.3 | Add debug config option | `packages/compiler/src/config/` |
| 1.2.4 | Add `-d` CLI flag | `packages/cli/src/commands/build.ts` |
| 1.2.5 | Integration tests | `packages/compiler/src/__tests__/codegen/` |

**Deliverables**:
- [ ] VICE labels file generated with `-d vice`
- [ ] Inline comments with `-d inline`
- [ ] Config and CLI integration working
- [ ] Integration tests passing

**Verify**: `./compiler-test codegen cli`

---

## Phase 2: VICE Integration

### Session 2.1: ViceRunner & Emulator Detection

**Reference**: [04-vice-integration.md](04-vice-integration.md)

**Objective**: Implement emulator detection and launch functionality.

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Create runners directory structure | `packages/cli/src/runners/` |
| 2.1.2 | Implement emulator detection | `packages/cli/src/runners/vice.ts` |
| 2.1.3 | Implement ViceRunner class | `packages/cli/src/runners/vice.ts` |
| 2.1.4 | Add emulator config options | `packages/compiler/src/config/` |
| 2.1.5 | Unit tests (mocked) | `packages/cli/src/__tests__/runners/vice.test.ts` |

**Deliverables**:
- [ ] Emulator detection finds VICE in PATH
- [ ] Config path override works
- [ ] ViceRunner launches VICE with PRG
- [ ] Unit tests passing

**Verify**: `./compiler-test cli`

---

## Phase 3: CLI Commands & Templates

### Session 3.1: init Command & Templates

**Reference**: [05-cli-commands.md](05-cli-commands.md), [06-templates.md](06-templates.md)

**Objective**: Implement `blend65 init` command with project templates.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Create templates directory | `packages/cli/templates/` |
| 3.1.2 | Create basic template | `packages/cli/templates/basic/` |
| 3.1.3 | Create game template | `packages/cli/templates/game/` |
| 3.1.4 | Create demo template | `packages/cli/templates/demo/` |
| 3.1.5 | Implement init command | `packages/cli/src/commands/init.ts` |
| 3.1.6 | Register init command | `packages/cli/src/cli.ts` |
| 3.1.7 | Unit tests | `packages/cli/src/__tests__/commands/init.test.ts` |

**Deliverables**:
- [ ] All three templates created
- [ ] `blend65 init` creates project
- [ ] `--template` flag works
- [ ] Unit tests passing

**Verify**: `./compiler-test cli`

---

### Session 3.2: run & watch Commands

**Reference**: [05-cli-commands.md](05-cli-commands.md)

**Objective**: Implement `blend65 run` and `blend65 watch` commands.

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.2.1 | Implement run command | `packages/cli/src/commands/run.ts` |
| 3.2.2 | Register run command | `packages/cli/src/cli.ts` |
| 3.2.3 | Add chokidar dependency | `packages/cli/package.json` |
| 3.2.4 | Implement watch command | `packages/cli/src/commands/watch.ts` |
| 3.2.5 | Register watch command | `packages/cli/src/cli.ts` |
| 3.2.6 | Unit tests | `packages/cli/src/__tests__/commands/` |

**Deliverables**:
- [ ] `blend65 run` builds and launches VICE
- [ ] `blend65 watch` detects file changes
- [ ] `--run` flag relaunches emulator
- [ ] Unit tests passing

**Verify**: `./compiler-test cli`

---

## Phase 4: E2E Test Rig

### Session 4.1: ViceTestRunner

**Reference**: [07-test-rig.md](07-test-rig.md)

**Objective**: Implement test helper for emulator-based testing.

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Create test-utils directory | `packages/compiler/src/__tests__/test-utils/` |
| 4.1.2 | Implement ViceTestRunner | `packages/compiler/src/__tests__/test-utils/vice-test-runner.ts` |
| 4.1.3 | Implement memory assertions | `packages/compiler/src/__tests__/test-utils/vice-test-runner.ts` |
| 4.1.4 | Create example E2E tests | `packages/compiler/src/__tests__/e2e/vice-e2e.test.ts` |
| 4.1.5 | Document usage | README in test-utils |

**Deliverables**:
- [ ] ViceTestRunner compiles and runs code
- [ ] Memory assertions work
- [ ] Example tests demonstrate usage
- [ ] Tests skip if VICE unavailable

**Verify**: `./compiler-test e2e`

---

## Task Checklist (All Phases)

### Phase 1: Source Maps & Debug Support

- [ ] 1.1.1 Create source map types
- [ ] 1.1.2 Implement SourceMapper class
- [ ] 1.1.3 Add unit tests for SourceMapper
- [ ] 1.1.4 Export from codegen index
- [ ] 1.2.1 Add VICE label generation
- [ ] 1.2.2 Add inline comment generation
- [ ] 1.2.3 Add debug config option
- [ ] 1.2.4 Add `-d` CLI flag
- [ ] 1.2.5 Integration tests

### Phase 2: VICE Integration

- [ ] 2.1.1 Create runners directory structure
- [ ] 2.1.2 Implement emulator detection
- [ ] 2.1.3 Implement ViceRunner class
- [ ] 2.1.4 Add emulator config options
- [ ] 2.1.5 Unit tests (mocked)

### Phase 3: CLI Commands & Templates

- [ ] 3.1.1 Create templates directory
- [ ] 3.1.2 Create basic template
- [ ] 3.1.3 Create game template
- [ ] 3.1.4 Create demo template
- [ ] 3.1.5 Implement init command
- [ ] 3.1.6 Register init command
- [ ] 3.1.7 Unit tests for init
- [ ] 3.2.1 Implement run command
- [ ] 3.2.2 Register run command
- [ ] 3.2.3 Add chokidar dependency
- [ ] 3.2.4 Implement watch command
- [ ] 3.2.5 Register watch command
- [ ] 3.2.6 Unit tests for run/watch

### Phase 4: E2E Test Rig

- [ ] 4.1.1 Create test-utils directory
- [ ] 4.1.2 Implement ViceTestRunner
- [ ] 4.1.3 Implement memory assertions
- [ ] 4.1.4 Create example E2E tests
- [ ] 4.1.5 Document usage

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/dx-features/99-execution-plan.md"
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
Phase 1: Source Maps
    ↓
Phase 2: VICE Integration
    ↓
Phase 3: CLI Commands & Templates
    ↓
Phase 4: E2E Test Rig
```

---

## Success Criteria

**DX Features are complete when**:

1. ✅ All phases completed
2. ✅ All tests passing (`./compiler-test`)
3. ✅ `blend65 build -d vice` produces `.labels` file
4. ✅ `blend65 run` launches VICE with compiled program
5. ✅ `blend65 watch` auto-rebuilds on file changes
6. ✅ `blend65 init` creates project from template
7. ✅ E2E test helper documented and working

---

**This document is the execution plan for Blend65 DX features.**