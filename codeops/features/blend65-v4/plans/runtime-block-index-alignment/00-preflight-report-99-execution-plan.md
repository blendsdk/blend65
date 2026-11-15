# Preflight report — runtime element block-index alignment

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 1 major resolved, 1 residual blocked
> **Mode**: strict; independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-159-001 | 🟠 MAJOR | A runtime index cannot be aligned by root alignment alone; admitting every index would falsely align a byte-stride array. | The proof admits a runtime index only when the element stride is a multiple of the demand and the static prefix/suffix remains aligned. |
| PF-159-002 | 🟠 MAJOR | The #74 oracle and implementation test encode the old "runtime element untouched" contract for a 64-byte-stride array. | The #74 oracle's runtime control now uses a byte-stride array; the new four-profile oracle covers the 64-byte-stride positive. |
| PF-159-003 | 🟠 MAJOR | VIC-bank/character-ROM visibility is part of the issue acceptance and needs a diagnostic contract. | **Blocked on #158**; the alignment slice does not invent a code. #159 stays open. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was inline against the code and the issue. The oracle checks the root's public alignment and address
across four profiles; the byte-stride control proves the absence of a false positive.
