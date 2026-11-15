# Preflight report — variable shift zero-count reuse

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 2 majors resolved, 1 residual accepted
> **Mode**: strict; the independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-131-001 | 🟠 MAJOR | A count bound from a same-block store is unsound if a call, escaping raw write, aggregate/pointer store or reassignment can change the local. | The straight-line proof clears on every `mayAliasLocals` operation and deletes the bound on reassignment; barriers keep both saturation tests. |
| PF-131-002 | 🟠 MAJOR | `TAX` for a live count register would clobber A after the immediate load. | The fresh-zero order requires an addressable count (`LDX`); a register count keeps the conservative `TAX` order. |
| PF-131-003 | 🟡 MINOR | The proposed seven-byte countdown is not implemented. | Accepted residual: the fresh-flags six-byte `BEQ`/shift kernel is already smaller for this witness, and the issue explicitly does not assert a defect against it. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was inline against the code. The assembly oracle pins the order and the absence/presence of both
saturation tests across four profiles; 36 native cases cover zero, one, seven, eight and the word
path.
