# Phase 1 Review: Frozen Inputs, Profile and Raw Asset

> **Baseline tree**: `6a78205f495e68394f9647a165cbaf69ebd49600`
> **Reviewed**: 2026-09-20
> **Result**: PASS

## Outcome

Phase 1 provides one selected frontend profile, one exact 512-byte raw sprite asset path, and one
independent pure M1 behavior oracle. The final independent correctness and security re-reviews
reported no findings.

## Verification

| Check | Result |
|---|---|
| `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test` | PASS |
| Compiler package | 38 files, 837 tests passed |
| CLI package | 5 files, 61 tests passed |
| Root boundary/M1 tier | 5 files, 52 tests passed |
| Frozen `spec/` status | Clean |
| Diff whitespace | Clean |

## Independent Review Corrections

| Finding | Correction | Final status |
|---|---|---|
| Concurrent hard-link aliases could race admission | Rechecked cache identity atomically before publication and added a racing-alias test | Resolved |
| M1 oracle hid individual sprite writes | Recorded enable, position, pointer/art and color operations in exact order | Resolved |
| Profile effects were not transitive | Retained ordered/volatile effects on profile bindings and propagated them through callers | Resolved |
| Unsupported qualified profiles could fall back silently | Schema-valid unimplemented profiles now return `E10279` | Resolved |
| Async asset discovery used recursive host traversal | Replaced it with an iterative work stack | Resolved |
| Asset paths could inject terminal control characters into diagnostics | Escaped all displayed raw-asset paths | Resolved |
| Frontend service grew past the file-size limit | Extracted focused source discovery; `service.ts` is 587 lines | Resolved |

## Simplicity Check

- No registry, plugin system, generalized asset framework, target machine layer or new dependency.
- Exactly one profile, one raw asset representation and one pure oracle were added.
- SpritePad remains deferred to RD-06. Windows qualification remains deferred to RD-10.
- Backend lowering, layout, packaging, ACME and VICE work remain in their planned later phases.

## Integrity

| Artifact | SHA-256 |
|---|---|
| `packages/compiler/src/frontend/profile.spec.test.ts` | `84b5e70c37f725b62877f024bbc37d62ab595002e93f40532d57b963366a4b8e` |
| `packages/compiler/src/assets/raw-asset.spec.test.ts` | `c8e2ea5240706b464bd4f53f2b8445ed103f91c177702bc494c6286b7e33d053` |
| `test/m1/behavior.spec.test.ts` | `942a83d5bf0bf278549e36f1a2defe9d0ea275f985bcb47fa279b8a9efd43062` |
| `examples/m1/assets/sprites.bin` | `c590c49d0e0aae8a20b39e2f6246c530bb7f52fe8b4c21131ec09a442509f68a` |
| `examples/m1/qualification/oracle.ts` | `7ea949a34ecde626f80ddb373858f09b8be8ebedd9cd544936eacf431789a5e3` |
| `examples/m1/qualification/win-trace.json` | `01dba080800f2984d7a424748ecfcb02bf03da9ccce2b515c88d72cb6a02792b` |
