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
| `packages/language-server/src/server.ts` | Convert bundled spans using returned text and installed URI while retaining user-only overlay ownership |
| `frontend/profile.ts`, `target/c64-kernal.ts` | Approved declarations and named port-1 address in existing selected-profile/device tables |
| `machine/lower-c64.ts` | Extend current direct read/mask selection; preserve volatile effects and existing ABI/SFA closure |
| `machine/lower-register-forwarding.ts` | Only if output proof requires producer admission to the existing guarded forwarding seam; no broader rewrite |

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

LSP related locations use the library SourceId → installed `resolvedPath` URI mapping; never construct
an installed path from user module spelling. Root/user paths and known-overlay allowlists retain
their existing validation. No web/authentication/transport/infrastructure surface exists; those
security categories are N/A. Hostile source names and package faults remain tested inputs.

## Output, storage and optimization seams

AR-P6 owns the independent expert floor and complete accounting. Named reads remain volatile at
their source position. Saved-byte predicates are pure and independent of hardware state after
sampling. No new call, runtime dispatch, scratch ownership, port write or interrupt mask is allowed.
Escaping Boolean values use normal correct materialization; branch-only values remain conditions.
Scalar source constants fold through existing semantics; unused masks create no target initializer,
data or helper. Address-taking, if used by application source, retains ordinary language semantics
and its honestly charged storage rather than a new special restriction.

If direct-use output reveals redundant traffic, prove a correction at the existing selector/seam
with negative liveness/effect guards. Do not introduce an optimizer into this plan. If that is not
sufficient to meet the floor, stop and record the exact needed authority before expanding scope.
Callable migration stays AR-P7/RD-08; preserved source names keep that future migration compatible.

## Documentation and completion

Document exported symbols and non-obvious internal ownership in durable comments, without plan
identifiers in code. Add one small maintained `docs/platform-libraries.md` page at closeout explaining
what is source, what is direct hardware support and the physical limitation; no documentation
framework or new generated site. Qualification results and conditional final-RD/skill follow-ups
belong in this plan's `08-closeout.md` when executed, not in frozen authority now.
