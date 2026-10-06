# Execution plan: CIA2 ownership

> **Status**: Ready for execution — preflight passed
> **Implements**: blend65-v4/RD-05
> **Created**: 2026-10-06 20:06 CEST
> **Progress**: 0/20 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Implementation Phases

The checkbox lists below are the only task-progress owner. Mark `[~]` immediately
after implementation and `[x]` only after verification; update the header at the
same time. Resume the first incomplete task. Record blockers at their task and
in the ambiguity register, not a second state store. Current batch effort is
xhigh, explicitly confirmed for the full CIA2 batch; state advice without
repeating effort-confirmation pauses. Commit only coherent GREEN checkpoints
through the git-commit skill. Never push automatically.

| Phase | Sessions | Tasks | Boundary                                                               |
| ----- | -------- | ----- | ---------------------------------------------------------------------- |
| 1     | 1.1–1.3  | 20    | Existing exclusive CIA2 proof, direct output and bounded qualification |

## Phase 1 — CIA2 ownership

**Risk:** critical device/concurrency/SFA boundary; strict authorized scope.
**Baseline/modification set:** snapshot before first task under exec-plan. Targets
below include direct consumers and focused tests, plus this plan/roadmap and a
small public CIA2 ownership note. Spec/expert and all unauthorized old oracles
are excluded. No generic pass, runtime manager, schema or harness.

### 1.1 — Independent specification tests

- [ ] 1.1.1 [spec-author] Write public admission/ownership cases in `test/rd05/cia2-ownership.spec.test.ts` and the two exact AR-P3 fixture changes; ST-1/ST-3/ST-5–ST-9.
- [ ] 1.1.2 [spec-author] Write independent actual-byte/output cases in `test/rd05/cia2-output.spec.test.ts`; ST-2/ST-4/ST-10/ST-13.
- [ ] 1.1.3 [spec-author] Write sequential CIA2 timer cases in `test/rd05/cia2-vice.spec.test.ts` using the current binary fixture. Define independent RESTORE/STOP and instruction-boundary cases before production for the existing GDB/text-monitor qualification in 1.3.3; ST-11/ST-12. No new monitor API or harness.
- [ ] 1.1.4 Verify expected RED and document unchanged/pre-existing passes; directed new tests and existing CIA/NMI source controls. No production before RED.

### 1.2 — Existing-owner implementation

- [ ] 1.2.1 Extend route admission and transfer the CIA2 guard to the proved owner in `semantic/interrupt-routes.ts` and `semantic/cia-ownership.ts`; 03 §Source ownership and finite facts.
- [ ] 1.2.2 Add focused device fact types/equality/classification in `semantic/cia2-ownership-facts.ts`; 03 §Source ownership and finite facts.
- [ ] 1.2.3 Implement focused source device transitions and release classification in `semantic/cia2-ownership.ts`; 03 §Source ownership and finite facts. Split before 500–700 lines; no second solver.
- [ ] 1.2.4 Wire those facts into existing ordered contexts/state equality in `semantic/interrupt-context-proof.ts` and `interrupt-context-facts.ts`, plus existing `interrupt-contexts.ts`/`interrupt-context-walk.ts` only for the proved finite release-variant identity; 03 §Producer-to-consumer transport. Extract a current focused helper only if needed for the file ceiling; no second solver.
- [ ] 1.2.5 Enable proved direct CIA2 lowering and adjacent result forwarding in `machine/lower-c64-cia.ts` and `lower-register-forwarding.ts`; 03 §Direct output.
- [ ] 1.2.6 Extend selected exclusive NMI wrapper/placement/stack metadata in `machine/lower-c64-interrupt.ts` and existing `nmi-entry.ts` only where required; 03 §Direct output.
- [ ] 1.2.7 Transport proved handback by existing emitted source/context plus finite release-variant identity through `machine/lower-platform.ts` and `lower-c64.ts`; extend current `machine/interrupt-specialize.ts` and `lower.ts` selection only where needed. Preserve nested, same-depth and transitive ordinary release-helper calls, per-operation policies and final storage closure.
- [ ] 1.2.8 Emit the direct preserving shutdown in `machine/lower-c64-interrupt.ts`; 03 §Final CIA2 shutdown. No scratch or lowerer-invented proof.
- [ ] 1.2.9 Verify public directed GREEN, exact old negatives, final storage/private gate and unchanged artifact/publication controls; ST-1–ST-10/ST-13.

### 1.3 — Hardening and closeout

- [ ] 1.3.1 Add focused device/context implementation tests in `semantic/cia2-ownership.impl.test.ts`; actual caller/handler facts, mirrors, joins, mixed restore contexts and convergence.
- [ ] 1.3.2 Add lowering/forwarding implementation tests in `machine/cia2.impl.test.ts` and existing register-forwarding implementation concern; exact volatile effects, controls, no late scratch and counterexamples.
- [ ] 1.3.3 Run sequential actual-artifact/native interleaving and resource qualification; binary-fixture CIA2 timers and the existing pinned GDB/text-monitor RESTORE/STOP/boundary mechanism. Bind fresh scripts/input-success checks/instruction boundaries and artifact/tool/model identities in `08-closeout.md`; ST-11/ST-12. Unknown/skipped native cases do not close this task.
- [ ] 1.3.4 After positive qualification, apply only AR-P3's exact ledger retirement and verify its gate; `test/rd04/expressiveness-ledger.json`; ST-14.
- [ ] 1.3.5 Full checkpoint: frozen install, build, typecheck, all owned tests, targeted formatting, links, frozen authority and authorized-oracle diff checks.
- [ ] 1.3.6 Complete required independent reviews and any bounded authorized fix/re-review; record `09-phase-review.md`. Correctness, semantics/DX, SFA/ABI, platform, output and host performance responsibilities remain separate.
- [ ] 1.3.7 Finish `08-closeout.md`, public `docs/c64-cia2.md` note, deferral-expiry check and derived roadmap pointer; RD-05/DEF-7 remain open. Reverify any review/document changes, then green local checkpoint; no push.

**Verify:** `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`,
`yarn test`; directed Vitest during tasks; sequential VICE; forced touched-file
Prettier and Markdown links. Exact assertions and emitted/native costs are owned
by [the testing strategy](07-testing-strategy.md), not this checklist.
