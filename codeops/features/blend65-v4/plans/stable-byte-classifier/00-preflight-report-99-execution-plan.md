# Preflight report — stable byte classifier chain

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 3 majors resolved, 1 residual accepted
> **Mode**: strict; the independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-132-001 | 🟠 MAJOR | Reusing A across a join is unsound when another predecessor supplies a different byte. | Every continuation block must have exactly one predecessor; a merge ends the chain. |
| PF-132-002 | 🟠 MAJOR | `CMP` changes C and N, while `EOR` preserves C; the issue's carry analysis only holds on the dense 0..k prefix. | The transform only starts after `== 0` and only continues through consecutive `== k`; zero tests keep the ordinary load. |
| PF-132-003 | 🟠 MAJOR | A store, call, MMIO read, dynamic index or wider place between the load and the comparison can change the byte. | Only whole stable byte loads with instruction-free pass-through blocks participate; every other shape keeps the reload. |
| PF-132-004 | 🟡 MINOR | A partial dense prefix whose last comparison mismatches can still change the outgoing carry relative to the old EOR form. | Accepted residual: the exact issue chain leaves C=1 on every path; no general outgoing-carry contract is claimed. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was inline against the code and the issue. The assembly oracle pins the exact chain across four
profiles; the 40 native VICE cases cover every typed result endpoint; the cost pins record both
bounds modes.
