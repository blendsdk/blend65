# Registry & Built-in Profiles: RD-10 Platform Plugin System

> **Document**: 03-03-registry-and-builtin-profiles.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-10 R28–R41; spec Ch 15 §2 + appendix-{c64u,cx16,a800xl,a7800}; decision D4

## Overview

This component wires the five plugins into a static registry with a loader, and provides the
**profile data + `validateProfile`** for the four non-MVP platforms (D4 — they reuse the c64
hook bodies as the shared default; only their `profile` and `getMainTerminationPolicy` differ in
this slice). Lives in `packages/platforms/src/`.

## Registry & Loader (R28–R31)

`packages/platforms/src/registry.ts`:

```typescript
import type { PlatformPlugin } from "@blend65/core/platform";
import { c64Plugin } from "./c64.js";
import { c64uPlugin } from "./c64u.js";
import { cx16Plugin } from "./cx16.js";
import { a800xlPlugin } from "./a800xl.js";
import { a7800Plugin } from "./a7800.js";

/** Static registry of all built-in platform plugins (R28). No dynamic loading in v1. */
export const PLATFORM_REGISTRY: ReadonlyMap<string, PlatformPlugin> = new Map([
  ["c64", c64Plugin],
  ["c64u", c64uPlugin],
  ["cx16", cx16Plugin],
  ["a800xl", a800xlPlugin],
  ["a7800", a7800Plugin],
]);

/** Default platform for MVP (R33). */
export const DEFAULT_PLATFORM = "c64";

/**
 * Load a platform plugin by ID (R29/R30). Throws an actionable error listing the
 * available platforms when the ID is unknown.
 */
export function loadPlatform(id: string): PlatformPlugin {
  const plugin = PLATFORM_REGISTRY.get(id);
  if (plugin === undefined) {
    const available = [...PLATFORM_REGISTRY.keys()].join(", ");
    throw new Error(`Unknown platform '${id}' — available platforms: ${available}`);
  }
  return plugin;
}
```

> `loadPlatform` throws a plain `Error` (R29) — it is not a compiler diagnostic; wiring the
> message into the diagnostics engine is RD-15/16's job. The error text lists the registry keys
> in insertion order (deterministic). Satisfies **AC-10/AC-11**.

`packages/platforms/src/index.ts` (replacing the `VERSION`-only stub surface) re-exports:

```typescript
export { PLATFORM_REGISTRY, DEFAULT_PLATFORM, loadPlatform } from "./registry.js";
export { c64Plugin } from "./c64.js";
export { c64uPlugin } from "./c64u.js";
export { cx16Plugin } from "./cx16.js";
export { a800xlPlugin } from "./a800xl.js";
export { a7800Plugin } from "./a7800.js";
```

## Non-MVP Plugins (D4 — profile + validation now; hooks reuse c64)

Each non-MVP plugin (`c64u.ts`, `cx16.ts`, `a800xl.ts`, `a7800.ts`) is a `PlatformPlugin` whose
codegen hooks (`emitPreamble`/`emitStartupShim`/`getOutputDirective`/`encodeString`/`encodeChar`)
**delegate to the c64 implementations** in this slice (D4), and whose `profile`,
`getMainTerminationPolicy`, and `validateProfile` carry the platform's own data. The shared
delegation is expressed by importing the c64 hook functions (factored out of `c64.ts` into small
reusable functions) — not by duplicating bodies.

> **Profile values** below are the headline values from RD-10 R37–R41. The implementer
> **transcribes the exact field set for each platform from its frozen appendix**
> (`spec/appendix-*.md` §10 profile block); any field whose value is not determinable from the
> appendix is a **new ambiguity** → STOP and raise a `D-N (runtime)` (do not guess).

### `c64u` (R35/R38, appendix-c64u)

Extends the C64 base profile (shares memory map/budgets) with C64-Ultimate adjustments. `cpu:
"nmos6502"`, `outputFormat: "prg"`, `defaultEncoding: "petscii"`, `getMainTerminationPolicy():
{ canReturn: true }`. Additional REU/extended-RAM capability fields come from appendix-c64u; the
REU-specific intrinsics are RD-17 (`intrinsics: []` here). **AC-13.**

### `cx16` (R36/R39, appendix-cx16)

`cpu: "wdc65c02"` (**AC-14** — enables 65C02 opcodes/modes via the shared `CpuVariant`),
`codeStart: 0x0801`, `zp: $02–$21` (32 bytes shared with KERNAL → `maxZp: 32`),
`defaultEncoding`: per appendix (PETSCII/ASCII), `outputFormat: "prg"`,
`getMainTerminationPolicy(): { canReturn: true }`. Banked-RAM specifics are appendix-derived.

### `a800xl` (R40, appendix-a800xl)

`cpu: "nmos6502"`, `codeStart: 0x2000` (after OS workspace), `zp: $80–$FF` (128 bytes →
`maxZp: 128`), `defaultEncoding: "atascii"`, `outputFormat: "xex"`,
`getMainTerminationPolicy(): { canReturn: true }`.

### `a7800` (R41, appendix-a7800)

`cpu: "nmos6502"`, ROM/cart-based (`codeStart` per appendix), `ram: 4KB ($1800–$27FF)`,
`zp: $40–$FF` (192 bytes → `maxZp: 192`), `outputFormat: "a78"`, and crucially
`getMainTerminationPolicy(): { canReturn: false, warningOnReturn: "..." }` (**AC-15** — the game
loop is non-terminating, AR-69). ATASCII/`.a78` cartridge-header specifics are appendix-derived
and the bespoke `emitPreamble` body is deferred (D4) — the slice uses the shared default.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Unknown platform ID | `loadPlatform` throws `Error` listing available IDs | R29 / AC-11 |
| Inconsistent non-MVP profile | that plugin's `validateProfile()` → non-empty `ValidationError[]` | R22 / R31 |
| Appendix field value undeterminable | STOP → `D-N (runtime)` (no guessing) | surface rule |

## Testing Requirements

- `loadPlatform("c64")` returns the c64 plugin; `loadPlatform("nope")` throws an error whose
  message contains all five IDs; `DEFAULT_PLATFORM === "c64"`; registry has exactly five keys.
- For all five platforms: `validateProfile()` returns `[]` (each shipped profile is internally
  consistent — **AC-19**); `cx16.profile.cpu === "wdc65c02"` (**AC-14**);
  `a7800.getMainTerminationPolicy().canReturn === false` (**AC-15**);
  `c64u` profile present (**AC-13**). (See 07-testing-strategy ST-REG*/ST-PROF*.)
