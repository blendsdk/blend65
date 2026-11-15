# Preflight report — SFA staging-home reuse

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 1 major resolved, 1 residual accepted
> **Mode**: strict; independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-146-001 | 🟠 MAJOR | Removing the planned staging request breaks the binder: `requiredStorage` and `closeStorage` still expect the home, producing `COMPILER_INCOMPLETE`. | The request stays; `retainMachineValue` reuses it as the retained home, so it is accessed and no second machine home is created. |
| PF-146-002 | 🟠 MAJOR | The planned request's domain may be `main` rather than `undefined`, so a strict domain check misses it. | Accept `undefined` or `main` for a main-domain context; keep the interrupt-domain fallback. |
| PF-146-003 | 🟡 MINOR | Interrupt-domain staging still uses a machine home. | Accepted residual; separate activation-root matching is future precision work. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was inline against the code and the issue. The reuse test verifies the planned ID is referenced by
the machine program and no `retained-value` home exists for that value.
