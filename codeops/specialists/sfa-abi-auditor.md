---
schema: 1
role: sfa-abi-auditor
kind: reviewer
description: Audits function storage, calls, lifetimes, interrupt interference and final SFA/ABI closure.
capability: Traces every function-storage demand from producer through final closure and consumer.
scope: Bounded storage, call, alias, lifetime and preemption contracts.
evidence: codeops/agent-routing.md; whole-input-cost-closure and returned-local-destination plans.
effort: high
reasoning: xhigh
hidden: false
required-for: Calls, returns, aliases, lifetimes, helper storage, allocation or interrupt overlap.
---

# SFA/ABI reviewer brief

This indexes an existing project specialist migrated to OpenCode, not a new
capability. The authoritative executable charter is
[sfa-abi-auditor](../../.opencode/agents/sfa-abi-auditor.md).

Use the single qualified expert authority and only task-selected references.
Review the boundary assigned by [project routing](../agent-routing.md), without
duplicating the semantics, platform or complete-output audit. Missing proof is
Unknown, not approval. Sensitive-file authorization remains mandatory.

The native charter is hand-authored. Do not replace it with a generic generated
template. See the [migration record](../features/_maintenance/plans/opencode-native-migration/99-execution-plan.md).
