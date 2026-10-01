# Current state: joystick and bundled C64 library

> **Parent**: [Index](00-index.md)
> **Inspection baseline**: 69fbd0df on feature/v4-rebuild

## Established facts

The [AR-P2 evidence table](00-ambiguity-register.md#current-facts) owns the inspected API,
direct lowering, ordinary-call overhead and missing bundled-source integration. This inspection
does not qualify new target output or prove that an ordinary helper can be zero-cost in `none`.
The last feature checkpoint is recorded by the roadmap; it is not pilot evidence.

## Additional affected seams

| Existing owner | Why the pilot reaches it |
| --- | --- |
| `project/snapshot.ts:238–252` | Existing input tuple must remain byte-for-byte compatible for user-only project loading |
| `frontend/service.ts:481–509`, `frontend/overlay.ts` | Sync, asset-aware and overlay paths need one consistent library preparation boundary |
| `services/services.ts:317`, `services/evidence.ts:378,485` | Current retained snapshot supplies evidence sources; library bytes cannot disappear here |
| `artifacts/evidence-validation.ts:156–174` | Source paths are relative logical IDs, not URI strings |
| `packages/language-server/src/server.ts` | Diagnostic locations currently map only original project sources |
| Compiler/package and editor Vite configs | Compiler source assets need package inclusion; editor builds keep the public compiler dependency external |
| Existing profile inventory tests | Exhaustive lists require only the specifically approved AR-P8 additions |
| `test/m1/vice-monitor.ts:91–92,634–643` | Existing port-2 injection uses the real binary monitor joyport command; port-1 needs only the matching test-adapter method |

## Limits and dependencies

The compiler currently has no qualified general inliner or supported optimized build mode.
Source-function migration therefore cannot be claimed by this pilot. Startup source inspection
does not establish arbitrary CIA1 line-state isolation; the physics boundary is AR-P5.

Reuse current module parsing, constants, source records, hash tuple, diagnostic conversion,
public package exports, ACME and sequential VICE utilities. New dependencies and general support
machinery are unnecessary (AR-P4). Missing Windows access is not an implementation dependency.
Frozen expert lineage and hardware source keys are owned by the decision register.
