# Preflight report — return-result forwarding

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 1 major resolved, 1 residual open
> **Mode**: strict; independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-124-001 | 🟠 MAJOR | Skipping retention for a return value is unsound unless the definition is the last operation before the return and the value has no later consumer. | The adjacency fact is built exactly from a block whose last operation defines the returned value; the retention skip applies only to that exact value. |
| PF-124-002 | 🟠 MAJOR | The word return still stages the high byte; the issue's word target is not met. | Recorded as an open residual: the word construction needs the low-scratch/X-high expert sequence in `lower-arithmetic.ts`; the measured delta is 0 for this slice. |
| PF-124-003 | 🟡 MINOR | The helper witness retains argument staging before the call. | That staging is the argument ABI, not the return-result staging; the oracle checks only instructions after the call. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was inline against the code. Before/after probes measured the exact byte and helper PRG reductions;
the word sequence was inspected and its residual recorded rather than claimed fixed.
