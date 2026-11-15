# Preflight report — constant-index callable recovery

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 1 major resolved, 1 residual accepted
> **Mode**: strict; independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-162-001 | 🟠 MAJOR | The assignment path and target provenance path must not be conflated: the assignment check needs the constant index, while the target selection must stay collapsed for runtime reads. | Two paths: `assignmentPathWith` for must-assignment, `placePath` for target selection. |
| PF-162-002 | 🟠 MAJOR | Returning a source-prefixed path as the unknown marker breaks aggregate-copy selection; a corrupted copy can retain the finite target. | The unknown marker stays value-relative (`leaf.path`); the corrupted aggregate-copy witness is rejected. |
| PF-162-003 | 🟡 MINOR | A constant-index initializer with an omitted sibling still sees the collapsed unknown. | Accepted residual; the issue's witness is a separate complete store. The initializer representation stays conservative. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was performed inline against the code and the issue acceptance. The execution review is
independent; the RED witness was captured against the pre-change compiler (`E10277` at
`table[0]`) and the post-change witness builds.
