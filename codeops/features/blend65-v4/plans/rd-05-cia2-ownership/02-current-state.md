# Current state: CIA2 ownership

> **Parent**: [Index](00-index.md)
> **Snapshot**: `cc57fe6b`, before CIA2 production changes

| Existing owner                                                               | Observed boundary                                                                                                                             |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/profile.ts`, `target/profile.ts`                                   | Both CIA instances and the exclusive NMI sink already exist. Named timer/source constants remain under `c64.cia1`; no API addition is needed. |
| `semantic/interrupt-routes.ts:45`                                            | Stock-chained cooperative NMI is the only admitted unbounded-source exception.                                                                |
| `semantic/interrupt-ownership.ts:248`                                        | CIA1 device checking precedes vector ownership. The CIA checker also blanket-rejects CIA2 mutations/consuming reads.                          |
| `semantic/interrupt-context-proof.ts` and `interrupt-context-facts.ts`       | Existing ordered context worklist proves actual vector/capture/observer relations and returning paths. It has no CIA2 device facts yet.       |
| `machine/nmi-entry.ts`, `lower-c64-interrupt.ts:114`                         | Transitive machine clobbers already select NMI wrapper saves, but the selected placement/stack path is chain-specific.                        |
| `machine/lower-c64-cia.ts:271`                                               | CIA2 counter reads exist; mutation/read-clear lowering is intentionally guarded.                                                              |
| `machine/lower-register-forwarding.ts`                                       | Existing adjacent fixed-store forwarding covers joystick/collision reads, not CIA read-clear results.                                         |
| `machine/lower-platform.ts:154`, `lower-c64.ts`                              | Existing proved CIA1 handback flag demonstrates direct proof-to-lowering transport.                                                           |
| `storage/nmi-private-storage.ts`, `storage/closure.ts`                       | Final selected private-home gate already covers all NMI routes and helper scratch.                                                            |
| `layout/c64-layout.ts:196`                                                   | Matching-low NMI placement and source-constrained entry adaptation already exist.                                                             |
| `test/rd05/profile-fixture.ts`, `test/m1/vice-runtime.ts`, `vice-monitor.ts` | Public check/build, actual artifacts and sequential pinned VICE fixtures exist.                                                               |

The unchanged CIA API/NMI admission/profile interrupt suites passed 76/76 before
this slice. That is guard-boundary evidence, not positive exclusive support.
The exact two obsolete fixtures and ledger exception are owned by AR-P3.

No current test, implementation shape or old qualification verdict is language
authority. Primary KERNAL/MOS evidence and the frozen specification determine
the approved machine contract. Public sidecar schemas and package import
boundaries remain unchanged.
