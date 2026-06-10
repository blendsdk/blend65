# Execution Plan: RD-08 Peephole Optimizer (passthrough v1)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-06-10 13:10
> **Progress**: 8/8 tasks (100%)
> **CodeOps Version**: see repo `package.json`

## Overview

Implement the RD-08 peephole optimizer as a **thin passthrough** in `@blend65/codegen`:
the `PeepholeRule`/`PeepholeOptions` contract, the `optimizeInstr(program, cpuVariant, bag,
options?)` entry point, and `validateProgramStructure`. Spec-tests-first per `testing.md`
Rule 10. The sliding-window scanner, iteration limit, ICE code, and concrete rules are
explicitly OUT of scope (deferred to the rules milestone per PF-005/PF-009).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
| ----- | ----- | -------- | --------- |
| 1 | Peephole passthrough (spec → impl → harden) | 1 | ~60–90 min |

**Total: 1 session, ~1–1.5 hours**

This is a small feature; per `make_plan.md` "Adaptation for Small Features" it is compressed
into one session, but the mandatory ordering (spec tests → red → implement → green → impl
tests → verify) is preserved.

---

## Phase 1: Peephole Passthrough

### Session 1.1: Spec-first implementation

**Reference**: [03-01-peephole-passthrough.md](03-01-peephole-passthrough.md),
[07-testing-strategy.md](07-testing-strategy.md)
**Objective**: Ship `optimizeInstr` + `validateProgramStructure` + the rule contract, fully
tested, with the barrel export wired and the full verify passing.

**Tasks**:

| # | Task | File |
| - | ---- | ---- |
| 1.1.1 | Write specification tests for ST-1..ST-12 (do NOT read any impl logic) | `packages/codegen/src/instr/peephole.spec.test.ts` |
| 1.1.2 | Run spec tests; verify they FAIL (red phase — module does not exist yet) | — |
| 1.1.3 | Implement `peephole.ts`: `InstrEntry`, `PeepholeRule`, `PeepholeOptions`, `V1_RULES`, `validateProgramStructure`, `optimizeInstr` | `packages/codegen/src/instr/peephole.ts` |
| 1.1.4 | Wire barrel re-exports (types + `optimizeInstr`, `validateProgramStructure`, `V1_RULES`) | `packages/codegen/src/instr/index.ts` |
| 1.1.5 | Run spec tests; verify they PASS (green phase). If any fail → fix impl, NOT the test | — |
| 1.1.6 | Write implementation/edge-case tests | `packages/codegen/src/instr/peephole.impl.test.ts` |
| 1.1.7 | Full verification (build + typecheck + lint + test) | — |
| 1.1.8 | Update `plans/ROADMAP.md` (RD-08 → Done; Current Position → next up RD-09) | `plans/ROADMAP.md` |

**Deliverables**:
- [ ] `optimizeInstr` exported from `@blend65/codegen` with the authoritative signature
- [ ] `validateProgramStructure` enforces the three PF-006 predicates (ICE `E90001` on violation)
- [ ] `PeepholeRule`/`PeepholeOptions`/`V1_RULES` defined and exported
- [ ] All ST-1..ST-12 spec tests pass; impl tests pass
- [ ] All verification passing; no R15 boundary regression

**Verify**: `clear && sleep 3 && yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> 1. After completing each task: mark it `[x]` with a timestamp.
> 2. After completing the phase: confirm every completed task is marked `[x]`.
> 3. Update the Progress header (`> **Progress**: X/Y tasks (Z%)`) after every update.
> 4. This checklist MUST exist — reconstruct from the phase details if missing.
> 5. Never batch updates — update immediately after each task.

### Phase 1: Peephole Passthrough
- [x] 1.1.1 Write spec tests ST-1..ST-12 (`peephole.spec.test.ts`) ✅ (completed: 2026-06-10 13:06)
- [x] 1.1.2 Run spec tests — verify FAIL (red phase) ✅ (completed: 2026-06-10 13:06)
- [x] 1.1.3 Implement `peephole.ts` (types + `optimizeInstr` + `validateProgramStructure` + `V1_RULES`) ✅ (completed: 2026-06-10 13:08)
- [x] 1.1.4 Wire barrel re-exports (`instr/index.ts`) ✅ (completed: 2026-06-10 13:08)
- [x] 1.1.5 Run spec tests — verify PASS (green phase) ✅ (completed: 2026-06-10 13:08)
- [x] 1.1.6 Write impl/edge-case tests (`peephole.impl.test.ts`) ✅ (completed: 2026-06-10 13:09)
- [x] 1.1.7 Full verification (build + typecheck + lint + test) ✅ (completed: 2026-06-10 13:10)
- [x] 1.1.8 Update `plans/ROADMAP.md` (RD-08 → Done; next up RD-09) ✅ (completed: 2026-06-10 13:11)

---

## Session Protocol

### Starting a Session
Reference: "Implement Phase 1, Session 1.1 per `plans/rd-08-peephole-optimizer/99-execution-plan.md`".

### Ending a Session
1. Run the project's full verify command.
2. Handle commit per the active commit mode.
3. `/compact`.

---

## Dependencies

```
1.1.1 spec tests → 1.1.2 red → 1.1.3 impl → 1.1.4 barrel → 1.1.5 green → 1.1.6 impl tests → 1.1.7 verify → 1.1.8 roadmap
```

Upstream: RD-07 (✅ shipped). Downstream consumer: RD-09 (unblocked by this).

---

## Success Criteria

**Feature is complete when:**

1. ✅ Phase 1 completed
2. ✅ All verification passing (build + typecheck + lint + test)
3. ✅ No warnings/errors
4. ✅ No dead code — no unused params/functions/exports (`_cpuVariant` per convention; `V1_RULES` exported)
5. ✅ Security — N/A (in-memory compiler stage; structural validation covers input robustness)
6. ✅ Documentation — JSDoc on all exported symbols
7. ✅ `plans/ROADMAP.md` updated (RD-08 → Done; Current Position → RD-09)
8. ✅ **Post-completion:** offer to re-analyze the project to refresh `.clinerules/project.md`
