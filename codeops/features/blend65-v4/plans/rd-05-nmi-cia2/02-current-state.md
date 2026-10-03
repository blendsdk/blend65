# Current state: cooperative NMI qualification

> **Parent**: [Index](00-index.md)
> **Inspected baseline**: `0380d69a`, Linux, `feature/v4-rebuild`

## Grounded seams

Paths below are repository-relative; line numbers describe this inspected baseline.

| Existing owner                                                                          | Observed fact / affected seam                                                                                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `semantic/whole-program.ts:348`                                                         | Blanket unbounded-sink E10245 runs before route materialization                                                                                              |
| `semantic/interrupt-ownership.ts:300–378`                                               | LIFO/raw-write facts use known literal addresses; an unknown writer is not proof of non-aliasing                                                             |
| `semantic/interrupt-contexts.ts:147–170`                                                | IRQ has root/entry-slot ownership; NMI retains numeric depth only                                                                                            |
| `machine/lower-platform.ts:99–118`, `machine/lower.ts:304–323`                          | NMI installation and chain links bind to depth-only words                                                                                                    |
| `storage/inventory.ts:480–570`                                                          | Page-safe persistent depth links and IRQ root links are allocated before closure                                                                             |
| `storage/closure.ts:389–443`                                                            | IRQ-only exact overlap exists; fallback independent route maxima are not a complete mixed IRQ/NMI proof                                                      |
| `machine/lower-c64-interrupt.ts:48–145,231–296`                                         | Wrappers preserve status/registers; transactions still write both vector bytes; placement is inherited only if the selected body carries it                  |
| `machine/lower-function.ts:635–639`, `machine/lower.ts:315–337`                         | Selected body omits semantic placement; only the ordinary-function branch attaches it. Propagate it onto complete interrupt wrappers before entry adaptation |
| `layout/c64-layout.ts:147–218`                                                          | Final placement/branch repair and a placement-required startup JMP already exist; no NMI low-byte condition                                                  |
| `services/services.ts:156–310`                                                          | Check and build share instruction selection, helper discovery and final SFA closure before binding                                                           |
| `services/evidence.ts:227–283,334–346`                                                  | Reserve is added to usage; runtime safety/qualified headroom is incorrectly unconditional                                                                    |
| `artifacts/evidence-types.ts:110–130`, `artifacts/memory-evidence-validator.ts:210–240` | Existing unproven status and source-attributed machine-state records suffice                                                                                 |

All package paths in this table are under `packages/compiler/src/`.
The [register's bounded result](00-ambiguity-register.md#ar-p12--bounded-publication-and-saved-link-result)
owns the counterexamples and analytical evidence, not current admission claims.

## Existing oracles and compatibility

AR-P11 names the exact old fixtures to change. Generic hand-authored evidence
validator fixtures still describe their own bounded contracts and need no edit.
Existing stack warnings assert the frozen canonical message; retain them.
`test/rd05/joystick-api-output.spec.test.ts:203` requires numeric hardware-stack
cost to equal the largest numeric stack-domain peak; retain that relationship
with correctly scoped records, not a reserve-inflated total.

Evidence schema major remains 1. Fresh builds produce corrected values using
existing fields; existing parsers still accept old records without silently
upgrading their claims. No rewriting of prior generations or cache migration.
Source/options identities do not fingerprint compiler implementation revisions.
Qualification records the fresh generation ID and exact artifact/sidecar digests
with the inspected compiler commit; no new identity field or schema is needed.
Rollback is local code/history recovery, not mutation of published artifacts.

## Dependencies and risks

Expert 2.0.3 and T-08 binding are complete. ACME 0.97 and VICE 3.10 supply later
encoding/runtime endpoints. Ordinary both-port joystick support is already
qualified; keyboard certainty and CIA2 exclusive source ownership are not.

Highest risks: confusing external recursion with generated growth, ignoring a
post-pop observer, accepting selected helper scratch, losing exact IRQ overlap
when NMI is present, or treating source placement as a blanket rejection. The
component and test specifications address these separately. Do not introduce
late storage, a blanket syntax ban, guessed firmware guarantees or support code
to conceal an incomplete proof.
