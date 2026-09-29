# Current State: RD-05 CIA Timer and Interrupt Slice

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Compiler Seams

| File | Observed responsibility | Planned use |
|---|---|---|
| `packages/compiler/src/frontend/profile.ts` | `COOPERATIVE_DECLARATIONS` at line 160 declares typed `c64.*` calls; no CIA operation is declared. | Add the AR-P5–AR-P7 calls and constants. |
| `packages/compiler/src/frontend/profile-bindings.ts` | `addProfileBindings` at line 117 publishes selected capability signatures and constants. | Reuse without a new binding path. |
| `packages/compiler/src/semantic/operations.ts` | `PlatformOperation` at line 271 retains capability, arguments, result, source span and volatile effect. | Keep the existing target-neutral operation shape. |
| `packages/compiler/src/semantic/whole-program.ts` | Lines 623–631 run vector ownership before final program selection. | Insert the focused CIA source check before emission; retain route facts. |
| `packages/compiler/src/semantic/interrupt-ownership.ts` | Line 169 recognizes vector stack actions and line 191 emits E10278; it has no CIA source/mask model. | Reuse route facts and diagnostic identity, not the vector-stack data structure. |
| `packages/compiler/src/target/c64-kernal.ts` | `C64MachineFacts` at line 4 owns C64 MMIO addresses; CIA timer/ICR addresses are absent. | Add fixed CIA register facts. |
| `packages/compiler/src/machine/lower-c64.ts` | `lowerC64Operation` at line 325 emits direct volatile platform accesses and has no CIA case. | Add direct CIA lowering, with any scratch requested before SFA closure. |
| `packages/compiler/src/machine/lower-platform.ts` | Line 82 binds direct lowering into selected machine instructions. | Reuse unchanged unless result retention requires a narrow adjustment. |
| `packages/compiler/src/layout/startup.ts` | The returning restore path at line 354 does not preserve CIA1 timer or ICR-mask state. | Do not claim a safe BASIC return after CIA1 takeover in this slice; DEF-14 owns a proved hand-back. |
| `packages/compiler/src/frontend/profile.spec.test.ts` and `profile-constants.spec.test.ts` | Both assert complete selected-profile capability/constant inventories. | Expand the exact arrays when adding CIA names; keep all existing entries. |
| `packages/compiler/src/frontend/profile-constants.impl.test.ts` | Asserts the current total binding count and function/constant boundary. | Update only those stale numeric expectations after CIA declarations are added; preserve the identity and fresh-state checks. |

The selected profiles in `packages/compiler/src/target/profile.ts` define cooperative KERNAL CINV and NMINV routes, but not ownership of each CIA source or an NMI-safe CIA2 ICR handoff. Current negative NMI evidence and DEF-7 remain authoritative for that gap; a profile name alone does not establish a positive route (AR-P3–AR-P4).

## Gap and Risk

`c64.cia1`/`c64.cia2` calls currently do not type-check as platform capabilities. Raw byte access cannot by itself express the approved counter-versus-latch distinction, ICR read-to-clear operation, or ownership proof (RD-05 R5.20, AR-P3–AR-P7). The existing direct C64 lowering path is the narrow integration seam; no copy of a legacy compiler or new runtime is needed.

The most important risk is incorrectly treating the ICR read value as its write-only mask, or treating an exclusive IRQ vector as permission to alter unrelated CIA serial/TOD/port fields. The design and independent ST cases keep these effects separate. A vector restore alone does not restore KERNAL Timer A service after CIA1 takeover, and the existing installer restores the caller's IRQ-enable state before a separate mask-clear call. The corrected plan qualifies an explicit masked handoff and rejects the unproved reverse handoff. A running counter read remains a low-then-high observation, not an atomic snapshot (AR-P5–AR-P6, PF-001–PF-002).

The existing vector check composes mainline effects separately from selected IRQ-handler effects. A handler or helper can therefore change CIA1 device state before mainline restores the vector. The CIA-specific return guard must include that selected-handler effect without treating handler return as return to BASIC (PF-002).

## Dependencies

Internal dependencies are the already-implemented profile binding, vector ownership, SFA closure, direct machine lowering, ACME output, and existing sequential VICE test path. No external package, server, storage migration, or new harness is required. Security/web controls are not applicable to this local compiler/MMIO slice; source inputs still receive ordinary type and ownership diagnostics.
