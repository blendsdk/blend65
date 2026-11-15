# Preflight report — callable-field helper transfer

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 3 major resolved for the delivered scope, 1 residual accepted with an owner
> **Mode**: strict; independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-157-001 | 🟠 MAJOR | An argument load of an uninitialized borrowed aggregate poisons the parameter with `UNKNOWN_TARGET`, so a helper that initializes the field is still rejected. | A definite field write excludes that path from the argument-to-parameter transfer; the uninitialized borrowed witness now builds. |
| PF-157-002 | 🟠 MAJOR | Translating a parameter key to every possible origin of a merged or indexed argument claims a must-write for objects that were not written. | `applyCallWrite` accepts only a single definite origin with no index path. Merged, indexed and unresolved origins stay conservative. |
| PF-157-003 | 🟠 MAJOR | Restoration discovery covered only whole bare callables; a caller kill followed by a helper field store stayed rejected. | `definiteRestorations` records field byte intervals and translates parameter ranges to the actual origin. Direct caller-kill restores pass. |
| PF-157-004 | 🟡 MINOR | Transitive restoration through a chain of helpers (including ordered startup) remains conservative. | Accepted residual; false rejection only, no unsafe acceptance. Owned by #165. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The
primary performed the scan inline against the real code and the issue acceptance; the execution
phase carries two independent reviewers. Static review does not prove runtime behavior; the VICE
case and the cost pin provide the behavioral and assembly evidence.
