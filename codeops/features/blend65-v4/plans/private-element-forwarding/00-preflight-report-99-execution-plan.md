# Preflight report — private element forwarding

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ✅ PASSED WITH NOTES — 2 majors resolved, 1 residual open
> **Mode**: strict; independent preflight dispatch was unavailable (see boundary)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-154-001 | 🟠 MAJOR | The aggregate leaves only its **last** supplied element in A; forwarding any other element would be wrong. | The fact records only the last supplied constant element and pairs it with the exact constant-index load. |
| PF-154-002 | 🟠 MAJOR | A global/parameter element, a dynamic index or a dynamic raw destination can be observed or clobber A; forwarding them would be unsound. | Private roots, constant indices, a constant-address single-use consumer and the exact place signature are required; barriers keep the reload. |
| PF-154-003 | 🟠 MAJOR | `placeSignature` serialized a BigInt index and crashed on direct element stores. | Indices are stringified; the resource/indexed-alias suites pass. |
| PF-154-004 | 🟡 MINOR | Word elements are not forwarded. | Accepted residual; the word construction leaves the high byte in A. |

## Boundary

The independent preflight dispatch was blocked by the reviewer's protected-path contract. The scan
was inline against the code. The oracle checks the byte expert form and each barrier across four
profiles; the cost pin records the exact artifact.
