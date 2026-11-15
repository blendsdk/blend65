# Preflight report — impossible masked comparison fold

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 2 majors resolved, 1 residual accepted
> **Mode**: strict; the independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-151-001 | 🟠 MAJOR | Dropping the mask must not drop the operand's volatile read. | The operand is already lowered and in A; the fold only appends the constant Boolean, and the assembly oracle pins exactly one `lda $dd0d`. |
| PF-151-002 | 🟠 MAJOR | Returning `[...prefix, lda #const]` duplicated the whole read prefix in the caller. | The fold returns only the new immediate; the prefix stays in the current block. The cost pin and assembly oracle caught the duplicate. |
| PF-151-003 | 🟡 MINOR | Word-mask impossibility is not folded. | Accepted residual; the issue witness and acceptance are byte-mask forms. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was inline against the code. The assembly oracle checks the exact read count and the absence of the
mask/`EOR` for `==` and `!=`; eight native cases verify the stored branch value on four profiles.
