# Preflight report — bounded local callable index

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 1 major resolved, 1 residual accepted
> **Mode**: strict; independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-163-001 | 🟠 MAJOR | A bound from a store must not be reused after a wider store, a later store, or a merge with a wider incoming value. | The map is updated on every store (unknown clears), the read is processed in source order, and `indexUpperBound` unions merges with the maximum or null. |
| PF-163-002 | 🟠 MAJOR | A same-block-only proof could be mistaken for full dominance. | The plan and closeout state the per-block boundary; cross-block propagation is a named residual. |
| PF-163-003 | 🟡 MINOR | The bound key collapses index paths to `*`. | The key is used for the local index value; the index place path is empty. Array-element bound keys are conservative. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was inline against the code. The oracle checks the bounded, unbounded, inline and later-store cases
across four profiles; all builds use bounds checks disabled.
