# ACME Process Layer: discovery, invocation, artifacts

> **Document**: 03-02-acme-process-layer.md
> **Parent**: [Index](00-index.md)
> **Package**: `@blend65/compiler` · **Dir**: `packages/compiler/src/acme/`

## Overview

The process layer takes the `serializeToAcme` output and produces the platform binary by
driving the external ACME assembler. It covers: write the `.asm`, discover ACME, invoke it,
capture artifacts, parse the label file, and run the post-ACME binary-size budget check. It
lives in `@blend65/compiler` (the only package that already depends on both `codegen` and
`platforms`, and the natural home for filesystem/process I/O — R15/AR-20 keeps this out of
`codegen`/`frontend`).

## Modules

| File | Responsibility | Reqs |
| ---- | -------------- | ---- |
| `discover-acme.ts` | 3-tier ACME executable discovery | R28, R29 |
| `invoke-acme.ts` | Spawn ACME, capture exit/stdout/stderr, artifacts | R30–R33, R35–R38 |
| `label-file.ts` | Parse VICE label file → `Map<string,number>` | R45–R47 |
| `emit-binary.ts` | Orchestrate: write `.asm` → (emit-asm? stop : invoke) → budget → `BuildResult` | R34, R39–R44 |

## Implementation Details

### `discover-acme.ts` (R28/R29)

```typescript
export interface AcmeDiscovery {
  /** Explicit path from --acme-path / blend65.json acmePath (highest priority). */
  acmePath?: string;
}

/**
 * Resolve the ACME executable: explicit path → PATH probe → hard error.
 * Returns the resolved path, or null after adding E_ACME_NOT_FOUND to the bag.
 */
export function discoverAcme(d: AcmeDiscovery, bag: DiagnosticBag): string | null;
```

- Tier 1: if `acmePath` set and executable → return it; if set but not executable → add
  `E_ACME_NOT_FOUND` with the path-specific message, return null.
- Tier 2: probe `PATH` for `acme` (cross-platform: `acme` / `acme.exe`).
- Tier 3: no resolution → add `E_ACME_NOT_FOUND` (R29 actionable message), return null.

> **New diagnostic code:** `DiagCode.AcmeNotFound` is added to `@blend65/core`
> `diagnostic-codes.ts` (next free code in the resource/tooling band; uniqueness asserted by
> the existing diagnostic-codes spec test). This is the single additive core change.

### `invoke-acme.ts` (R30–R33, R35–R38)

```typescript
export interface AcmeInvocation {
  acmeExe: string;       // resolved by discoverAcme
  asmPath: string;       // the written .asm
  binaryPath: string;    // desired output binary path
  labelPath: string;     // desired VICE label file path
  reportPath: string;    // ACME --report file
  cwd: string;           // build output directory
}

export interface AcmeResult {
  success: boolean;
  binaryPath?: string;
  labelFilePath?: string;
  stderr?: string;
  binarySize?: number;   // bytes, excluding 2-byte PRG load header (R44)
}

export function invokeAcme(inv: AcmeInvocation, bag: DiagnosticBag): Promise<AcmeResult>;
```

- Spawn via `node:child_process` with an **explicit argv array** (no shell) — security
  (injection-safe) and determinism. Flags include label-file output (`-l <labelPath>`) and
  `--report <reportPath>` (R31/R32).
- Exit 0 → success; read binary size. Non-zero → **ICE** `IceCode.Unexpected` (E90001) with
  ACME stderr embedded (R35/R37); `.asm` is retained on disk (R36).
- R38 is a design invariant, not code: all user errors are caught upstream; reaching an ACME
  failure means a compiler bug, hence ICE not user-error.

### `label-file.ts` (R45–R47)

```typescript
/** Parse VICE label lines `al C:xxxx .name` into a symbol→address map. */
export function parseLabelFile(content: string): Map<string, number>;
```

- Regex `^al\s+C:([0-9a-fA-F]{4})\s+\.(.+)$`; address parsed base-16; name trimmed.
- Non-matching lines are skipped (R47) — non-fatal (a warning may be added by the caller, but
  the build is not failed).

### `emit-binary.ts` (R34, R39–R44)

```typescript
export interface EmitOptions {
  outDir: string;        // default ./build (R42); created if missing
  projectName: string;   // binary/asm/label base name (R40)
  emitAsmOnly: boolean;  // --emit-asm (R34)
  acmePath?: string;     // discovery tier 1
  maxBinarySize?: number;// platform budget (R43); from profile via caller
}

export interface BuildResult {
  success: boolean;
  diagnostics: Diagnostic[];
  binaryPath?: string;
  asmPath?: string;            // always set once .asm written (even on failure, R36)
  symbols?: Map<string, number>;
  binarySize?: number;
}

export function emitBinary(
  asmText: string,
  opts: EmitOptions,
  bag: DiagnosticBag,
): Promise<BuildResult>;
```

Orchestration:
1. Ensure `outDir` exists; write `<projectName>.asm` (R39/R42). Record `asmPath`.
2. If `emitAsmOnly` → return `{ success:true, asmPath }` (R34) — no ACME.
3. `discoverAcme`; if null → `{ success:false }` (diagnostic already added).
4. `invokeAcme`; on failure → `{ success:false, asmPath }` (ICE already added, `.asm` kept).
5. Parse label file → `symbols`.
6. Budget: if `binarySize > maxBinarySize` → add `DiagCode.BinaryTooLarge` (E10034) (R43).
7. Return `{ success, binaryPath, asmPath, symbols, binarySize }`.

## Error Handling

| Error Case | Handling | Code | AR |
| ---------- | -------- | ---- | -- |
| ACME not found (any tier) | user error, return null/false | `AcmeNotFound` (new) | AR-62 |
| ACME exit ≠ 0 | ICE with stderr; retain `.asm` | `E90001` | AR-68 |
| Binary exceeds budget | user error after ACME | `E10034` | AR-81 |
| Unparseable label line | skip (non-fatal) | — (optional warning) | R47 |

## Testing Requirements

- `discover-acme`: 3-tier behavior with a fake fs/PATH (spec ST-D1..D3).
- `invoke-acme`: **mocked** `child_process` — success path, non-zero exit → ICE, stderr
  capture (spec ST-I1..I3). No real ACME (AR-27).
- `label-file`: well-formed, mixed/garbage lines, empty (spec ST-L1..L3).
- `emit-binary`: emit-asm-only stop, full orchestration with mocked invoke, budget `E10034`
  (spec ST-E1..E3).

> **CI note:** every process-layer test mocks `child_process`/fs. No test requires an ACME
> binary; the real-ACME tier arrives with RD-12.
