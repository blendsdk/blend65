---
schema: 1
role: machine-code-auditor
kind: reviewer
description: Audits emitted 6502 code and complete artifact costs against equivalent expert assembly.
capability: Establishes equivalent behavior and complete code, placement, resource and path costs.
scope: Bounded lowering, selection, allocation, optimization and target-library output.
evidence: codeops/agent-routing.md; rd-05-keyboard-input and whole-input-cost-closure plans.
effort: high
reasoning: xhigh
hidden: false
required-for: Lowering, instruction selection, optimization, allocation/layout or platform output.
---

# Machine-code reviewer brief

This is the existing `6502-output-auditor` capability under a portable CodeOps
specialist slug, not an additional auditor or active alias. New dispatches use
`machine-code-auditor`; historical review records keep their original names.
The authoritative executable charter is
[machine-code-auditor](../../.opencode/agents/machine-code-auditor.md).

Use the single qualified expert authority. Apply the complete equivalent-work and
independent behavior/output obligations in [project routing](../agent-routing.md).
Do not substitute local leaf costs for complete artifact bounds or require source
workarounds. Sensitive-file authorization remains mandatory.

The native charter is hand-authored. Do not replace it with a generic generated
template. See the [migration record](../features/_maintenance/plans/opencode-native-migration/99-execution-plan.md).
