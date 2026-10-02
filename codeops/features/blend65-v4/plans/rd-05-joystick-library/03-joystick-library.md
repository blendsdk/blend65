# Component design: joystick and bundled C64 library

> **Parent**: [Index](00-index.md)

## Source and hardware contracts

[AR-P3](00-ambiguity-register.md#ar-p3--exact-source-api) owns the exact signatures, module and
source constants. [AR-P5](00-ambiguity-register.md#ar-p5--physical-sample-and-preservation-boundary)
owns physical reads, sharing, state preservation and snapshot semantics. Do not duplicate the masks
as compiler profile constants or dispatch source functions by their names.

Modern source can retain a sample and test it repeatedly without knowing a register address:

```blend65
module Game;
import { readJoystick1, joystickUp } from c64.input;

function main(): void {
    let sample: byte = readJoystick1();
    if (joystickUp(sample)) {
        // Application behavior belongs here, not in the platform library.
    }
}
```

## Analysis inputs

AR-P4 owns preparation order, target admission, logical identity, hash tuple, limits and packaging.
The additive public result contract is:

```ts
// Every complete, error or incomplete analysis result also carries:
readonly inputs: {
  readonly sources: readonly SourceRecord[];
  readonly inputSha256: string;
};
```

This is actual consumed input metadata, not a second mutable project model. Keep existing result
discriminators, diagnostics, program/obligation fields and public function signatures unchanged:
`analyzeProject(snapshot): AnalysisResult`,
`analyzeProjectOverlay(snapshot, overlays): Promise<AnalysisResult>` and the existing asset-aware
internal service. The caller's user snapshot remains unchanged.

The internal helper is one fixed-file operation:

```ts
prepareAnalysisInputs(snapshot: ProjectSnapshot):
  | { readonly kind: "complete"; readonly snapshot: ProjectSnapshot }
  | { readonly kind: "error"; readonly diagnostics: readonly ProjectDiagnostic[] };
```

Its returned snapshot is an internal analysis view, never a replacement `loadProject` result.
Read the exact admitted bytes once and reuse their immutable records throughout that request.
Public entry points call internal already-prepared analysis paths rather than recursively preparing
the same view. Asset discovery sees the same view as typechecking. Apply user overlays before
preparation; do not permit a library overlay. Return admitted input metadata even on an error.

## Implementation ownership

| File / seam | Responsibility |
| --- | --- |
| `project/input-identity.ts` (new), `project/snapshot.ts` | Factor the existing hash tuple into a pure helper; preserve root-loader behavior and tests |
| `stdlib/c64/input.blend`, compiler `package.json` | Real documented source declarations and existing package allowlist inclusion |
| `frontend/bundled-sources.ts` (new) | Fixed trusted installed read, immutable SourceRecord and derived analysis inventory |
| `frontend/service.ts`, `project/types.ts` | Share preparation, attach result inputs and clarify logical source versus user-file identity documentation |
| `services/services.ts` | Retain frontend input inventory/hash for existing build/debug/evidence owners; no artifact schema redesign |
| `packages/language-server/src/server.ts` | Map bundled spans and publish installed-primary errors through related open user locations or the triggering-document fallback; retain user-only overlay ownership |
| `frontend/profile.ts`, `target/c64-kernal.ts` | Approved declarations and named port-1 address in existing selected-profile/device tables |
| `machine/lower-c64.ts` | Extend current direct read/mask selection and remove the redundant port-2 transfer; preserve volatile effects and existing ABI/SFA closure |
| `machine/lower-register-forwarding.ts`, `machine/vic-collision.impl.test.ts` | Admit both joystick reads through existing sole-use, adjacent same-block byte/fixed-store guards; adapt only the obsolete port-2 implementation assertion, preserving CIA exclusions and negative guards |
| `test/m1/vice-monitor.ts`, `test/m1/vice-runtime.ts` | Matching port-1 injection and opt-in simulation device activation in the existing fixture; preserve port-2 behavior and startup defaults |

The pure hash helper may have an internal signature equivalent to
`projectInputSha256(manifestSource, sources, overrides): string`, reusing existing types and exact
encoding. No new input-identity version or configurable resolver is necessary. Source records are
sorted before hashing; absolute host paths and installed-file locations are not hash inputs.

## Diagnostics and safety

Use AR-P4's existing host diagnostic codes for installed-file failures. The message identifies the
bundled logical input, not a private host exception. Decode UTF-8 exactly; reject invalid bytes and
bound the read before allocation. Do not expose a caller-supplied library path or TypeScript fallback.
Parser/type/name/arity and module-duplicate diagnostics remain ordinary compiler diagnostics.
Normal errors in user source must retain their exact source spans.

LSP primary/related locations use the library SourceId → installed `resolvedPath` URI mapping;
never construct an installed path from user module spelling. For an installed-primary diagnostic,
use the first related open user location in compiler order, or the triggering open user document's
project-level fallback if none exists. If the trigger has closed, use the first remaining admitted
open user document in the existing map order; with none open, publish nothing. Preserve and label
the exact installed primary and all
original related locations; do not change compiler diagnostic ordering, codes, messages or spans.
Aggregate each document's errors before publication so the fallback cannot overwrite its normal
diagnostics. ST-9 covers both source-ID orders, standalone installed parse/type errors,
close-triggered fallback and clearing.
Root/user paths and known-overlay allowlists retain their existing validation. No
web/authentication/transport/infrastructure surface exists; those security categories are N/A.
Hostile source names and package faults remain tested inputs.

## Output, storage and optimization seams

AR-P6, as narrowly amended by approved AR-P12, owns expert comparison and complete accounting. Named reads remain volatile at
their source position. Saved-byte predicates are pure and independent of hardware state after
sampling. No new call, runtime dispatch, scratch ownership, port write or interrupt mask is allowed.
Escaping Boolean values use normal correct materialization. Direct predicate selection exposes a
zero condition; generic local retention, negation and control-flow layout remain canonical `none`
and their measured costs are explicit RD-08 inputs, not expert-grade claims.
Scalar source constants fold through existing semantics; unused masks create no target initializer,
data or helper. Address-taking, if used by application source, retains ordinary language semantics
and its honestly charged storage rather than a new special restriction.

Remove the existing port-2 redundant transfer and admit both read producers to the existing guarded
forwarding seam for their sole adjacent same-block byte store to a fixed address. Preserve negative
liveness/effect guards and necessary storage for other uses; do not remove, repeat or reorder a
hardware read. Adapt the obsolete port-2 implementation assertion only; CIA exclusions stay intact.
Do not introduce an optimizer or production cycle-report subsystem into this plan. AR-P12 approves
only the named test/acceptance correction for this unoptimized pilot; direct discarded/fixed-store
operation floors and all semantic/effect/accounting gates remain. Record general local/condition/
layout deltas and equal-contract expert targets with RD-08 ownership. Main's restoration transfer
is common contract work, not an ordinary one-byte RTS to be removed for a test.
Callable migration stays AR-P7/RD-08; preserved source names keep that future migration compatible.

## Documentation and completion

Document exported symbols and non-obvious internal ownership in durable comments, without plan
identifiers in code. Add one small maintained `docs/platform-libraries.md` page at closeout explaining
what is source, what is direct hardware support and the physical limitation; no documentation
framework or new generated site. Qualification results and conditional final-RD/skill follow-ups
belong in this plan's `08-closeout.md` when executed, not in frozen authority now.
