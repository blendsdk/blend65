# Preflight report — symbolic block-index immediate fold

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 3 majors resolved, 1 residual accepted
> **Mode**: strict; independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-160-001 | 🟠 MAJOR | The binder rejected a label operand with `addressTransform` in immediate mode (`invalid-storage`). | `validOperand` accepts the layout-owned `addressTransform` in immediate mode. |
| PF-160-002 | 🟠 MAJOR | Folding the divide but materializing the `lo` in A added a scratch store/reload (`sta/lda $0a7c`). | The `lo` passes the symbolic block byte through; the consumer emits one immediate load. |
| PF-160-003 | 🟠 MAJOR | Folding an explicit, zero-page or misaligned address could reject a previously legal program. | Explicit and zero-page globals and non-64 field offsets keep the runtime path; the layout check is a fail-closed safety net. |
| PF-160-004 | 🟡 MINOR | Non-`lo` block consumers are not folded. | Accepted residual; this slice is the measured `lo` consumer. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was inline against the code and the issue. The assembly oracle checks the exact `Game.main` body for
the folded form and for each non-fold control across four profiles; the cost pin records the exact
artifact.
