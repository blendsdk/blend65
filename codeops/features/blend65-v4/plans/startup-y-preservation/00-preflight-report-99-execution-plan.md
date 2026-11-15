# Preflight report — startup Y-preservation

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 2 majors resolved, 1 residual accepted
> **Mode**: strict; independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-139-001 | 🟠 MAJOR | The fact must cover all reachable code, not just main, and must not infer a universal ABI. | The machine program's functions and startup are scanned; any Y-changing instruction keeps the save. |
| PF-139-002 | 🟠 MAJOR | Removing the Y byte shifts the status and port offsets; stale offsets would corrupt the restore. | A dedicated six-byte layout is used end to end, including the status load and platform transactions. |
| PF-139-003 | 🟡 MINOR | A handler's balanced `tay`/`tya` save-restore is conservatively rejected. | Accepted residual; false non-win only. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was inline against the code. The construction test pins the 80-byte / 127-cycle / six-byte target;
the fact test covers a Y-changing negative; the 16 native VICE cases verify behavior.
