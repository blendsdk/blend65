# Preflight report — straight-line ordinal write

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 2 majors resolved, 2 residuals accepted
> **Mode**: strict; the independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-140-001 | 🟠 MAJOR | The raw write's own alias barrier erased the index bound before it was used. | The bound is snapshotted before the barrier; later accesses still see the cleared map. |
| PF-140-002 | 🟠 MAJOR | The base literal's numeric bound won the ordinal loop and hid the real index. | The literal side is skipped when recording the ordinal. |
| PF-140-003 | 🟡 MINOR | The A-held index was rejected even though `TAX` preserves A. | Removed the stale rejection; the existing memory lowering emits `TAX` and no value reload is lost. |
| PF-140-004 | 🟡 MINOR | None-mode and device-window bases remain indirect. | Accepted residuals; the canonical baseline is unchanged and the ordinary-RAM proof excludes the device window. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was inline against the code. The four-profile assembly oracle pins the indexed form and the
non-selected controls; 16 native cases verify the store/read on all four profiles.
