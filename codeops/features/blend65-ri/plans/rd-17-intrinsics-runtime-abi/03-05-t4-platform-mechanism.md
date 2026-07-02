# T4 Platform Mechanism: RD-17

> **Document**: 03-05-t4-platform-mechanism.md
> **Parent**: [Index](00-index.md)

## Overview

The contribution path for platform intrinsics: plugins export real
`IntrinsicDescriptor[]`, the registry merges them at construction, the analyzer
enforces the import boundary — proven end-to-end with a **test fixture** plugin
(AR-P2); production plugins keep `intrinsics: []`.

## Architecture

### Current
`PlatformPlugin.intrinsics: readonly IntrinsicDescriptor[]` with the type aliased to
`unknown` (`platform-plugin.ts:81`); all five plugins ship `[]`; no merge logic
(`platforms/src/registry.ts` selects one plugin, nothing combines descriptors).

### Proposed
- `platform-plugin.ts` re-exports the real core type (03-01). Compiles unchanged for
  all five plugins (`[]` satisfies the typed array).
- Merge: `createIntrinsicRegistry(plugin.intrinsics)` — core catalog first, then the
  active plugin's T4 entries; duplicates throw (AR-P9). The plugin's `id` is stamped
  onto each contributed descriptor at merge time (wrapped availability predicate:
  `profile → contributed-by === activePlugin.id && descriptor.availability(profile)`),
  giving V6b its platform-identity check without a new descriptor field.
- T4 `.asm` modules ride the same `RuntimeModule`/embedding path as T3 (03-04), with
  `asmPath` resolved against the **plugin package** root.

### Fixture (test-only, AR-P2)
`platforms/src/__fixtures__/fixture-plugin.ts` (or test-local factory): a copy of the
c64 plugin contributing one T4 descriptor `fix_probe(): void`
(`loweringStrategy: 'call'`, `asmModulePath` pointing at a tiny fixture `.asm`).
Used by frontend/codegen/platform tests to verify AC-05 (E10046 without import),
AC-06 (E10043 on wrong platform), AC-16 (merge), and T4 embedding. Never exported
from the package barrel.

## Implementation Details

- `mergePlatformIntrinsics(registry, plugin)` logic lives inside
  `createIntrinsicRegistry` (single construction point — AC-15: registry fully
  populated before `analyze()` runs; the caller passes `plugin.intrinsics`).
- Import-boundary data flows from 03-02's declaration collection (imports per module)
  — a T4 call is visible only when `import { <name> } from <plugin.id>;` is present
  (AR-97 single-identifier pseudo-module).
- `RESERVED_BUILTINS` is unchanged by T4 (parser-level set is core-only); T4 calls
  parse as ordinary `CallExprNode` and are recognized *semantically* via the registry
  (`isReserved` covers them for shadowing checks R20 once registered).

> Note: because T4 names are not in the parser's `RESERVED_BUILTINS`, a T4 call
> reaches the analyzer as a `CallExprNode`, not an `IntrinsicCallExprNode`. The
> validation pass therefore checks *both* node kinds against the registry — this is
> the descriptor-driven path AC-17 requires (no name special-casing), and RD-14's
> completion (R20) later reads the same registry.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| T4 name collides with core name at merge | `register()` throws (setup bug) | AR-P9 |
| T4 called unimported (right platform) | E10046 | AR-P14, AC-05 |
| T4 from a different platform | E10043 | AR-P14 (R25), AC-06 |
| User declaration shadows a merged T4 name | E10101 | R20, AC-03 |

## Testing Requirements
- Spec: merge populates registry (AC-16); fixture T4 call with import compiles to `JSR` + embedded fixture module; without import → E10046; on `a7800` target → E10043; shadowing a T4 name → E10101.
- Impl: id-stamped availability wrapper, `[]` plugins unaffected, fixture isolation (not in barrel).
