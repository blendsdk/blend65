# Direct constant nested construction — decisions

> **Status**: ✅ GATE PASSED — all material task decisions resolved
> **Last Updated**: 2026-10-09 16:42 CEST
> **CodeOps Artifact Schema**: 1

## Scope contract

Target: T-12, the bounded prerequisite for RD-05. Context: frozen aggregate/value,
evaluation and SFA contracts; existing construction/address/closure consumers.
Modification set: this standalone plan, keyboard decision status and feature roadmap,
necessary existing lowering consumers and new tests. Frozen spec/expert and every
existing specification test are excluded. Keyboard AR-P10 is not a T-12 decision.

## Authorized resolution

| ID   | Category                          | Resolution                                                                                             | Authority                                                                                                                                                      |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-1 | Technical (complexity escalation) | Exact bounded support correction, safe fallback and exclusions in the upstream packet; no added scope. | User “i approve”, 2026-10-09, to [keyboard AR-P9](../rd-05-keyboard-input/00-ambiguity-register.md#ar-p9--ordinary-nested-constant-construction-prerequisite). |

The upstream eight-field complexity packet remains the approval owner; it is not
duplicated here. This plan does not reopen the accepted API or choose AR-P10 behavior.
Verify commands use the previously user-approved project rule: directed cases during
tasks, install/build/typecheck/full tests at the phase checkpoint, sequential VICE.

Reviewed all twelve ambiguity categories: no additional product decision is needed
for this compiler-only correction. Implementation choices stay inside AR-1. Any
material expansion or inability to reuse the current destination machinery reopens
the gate. No new source restriction, old-oracle exception or output waiver is approved.
