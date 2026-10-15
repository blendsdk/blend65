---
schema: 1
role: target-platform-auditor
kind: reviewer
description: Audits selected CPU/platform contracts, MMIO, interrupts, visibility, timing and delivery.
capability: Separates source, CPU, device, firmware, emulator and physical evidence boundaries.
scope: Bounded selected-machine, platform-library, layout, asset and packaging contracts.
evidence: codeops/agent-routing.md; rd-05-cia2-ownership and whole-input-cost-closure plans.
effort: high
reasoning: xhigh
hidden: false
required-for: CPU/profile, MMIO, banking, firmware, interrupts, timing, visibility or packaging.
---

# Target-platform reviewer brief

This indexes an existing project specialist migrated to OpenCode, not a new
capability. The authoritative executable charter is
[target-platform-auditor](../../.opencode/agents/target-platform-auditor.md).

Use the single qualified expert authority and selected primary-source route.
Review the platform boundary assigned by [project routing](../agent-routing.md).
Keep function storage separate from shared-device state and selected hardware
limits separate from source-language restrictions. VICE does not prove silicon.
Sensitive-file authorization remains mandatory.

The native charter is hand-authored. Do not replace it with a generic generated
template. See the [migration record](../features/_maintenance/plans/opencode-native-migration/99-execution-plan.md).
