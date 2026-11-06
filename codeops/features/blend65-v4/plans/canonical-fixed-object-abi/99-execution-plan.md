# Execution plan: Canonical fixed-object ABI

> **CodeOps Artifact Schema**: 1
> **Implements**: blend65-v4/RD-05
> **Progress**: 0/9 tasks (0%)
> **Last Updated**: 2026-11-06
> **Reasoning**: high — calling convention, interference and final physical closure
> **Scope**: strict; AR-P6/9 approved; preflight passed; Phase 1 independent authoring next

## Phase 1 — Independent contract tests

**Reasoning:** high — separate behavior and output obligations.

- [ ] 1.1 Independently author new ST-1–ST-8 cases from `07-testing-strategy.md` and public interfaces; never read implementation or edit old oracles.
- [ ] 1.2 Establish meaningful representation/resource RED and baseline behavior controls; complete independent oracle review before implementation.
- [ ] 1.3 Verify the directed existing/new inventory and preserve the exact oracle set for the implementation owner.

## Phase 2 — Existing-owner integration

**Reasoning:** high — one tightly coupled ABI/storage owner.

- [ ] 2.1 Derive/authenticate the restricted complete recipe set in existing fact/selection owners (`03-01` §§1–2, IT-1/2/5).
- [ ] 2.2 Carry object-only facts through call/place/result lowering and actual projection/closure without optimizer activation; first qualify authentic metadata-only generic/restricted lowering and invariance through the existing caller/transform guards (`03-01` §§2–3, IT-3/5/7).
- [ ] 2.3 After IT-7 passes, qualify the canonical attempt against its real generic reference at existing service/final owners, including AR-P9 residual byte-loop/MMIO unchanged-control correspondence; retain fallback and exact failure categories (`03-01` §4, IT-4/6/8).

## Phase 3 — Hardening and qualification

**Reasoning:** high — independent final proof and complete artifact obligations.

- [ ] 3.1 Complete IT-1–IT-8 regressions and independent correctness, semantics, SFA/ABI, platform, emitted-code and host-cost reviews. Semantics reports preservation and modern-source DX separately. Resolve findings through authority gates.
- [ ] 3.2 Run four-profile unchanged output/resource/native gates, startup/borrow/provenance guards and exact saved/acquisition/none identities; record bounded costs/hardware limits.
- [ ] 3.3 Run complete verification, synchronize DEF-17/root progress without advancing siblings and make the green local checkpoint through the git-commit skill; never push automatically.

## Verify and continuation

Use directed `yarn vitest run <files>` during work. Before checkpoint run
`yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, complete owned
tests and complete `yarn test`. Capture logs in session temp; VICE is sequential.
Check touched formatting and frozen authority/old tests. This checklist owns
only DEF-17; the root-remediation checklist still owns root green and return to
RD-05. RD-06 remains untouched.
