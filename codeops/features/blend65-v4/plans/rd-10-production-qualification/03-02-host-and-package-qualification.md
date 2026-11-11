# Host and Package Qualification: RD-10

> **Document**: 03-02-host-and-package-qualification.md
> **Parent**: [Index](00-index.md)

## Overview

RD-10 proves the public path on native hosts and produces installable local packages. A host is
claimed only after native end-to-end evidence. No host is synthesized from another operating system,
a container, or path fixtures. Local packaging is not publication.

## Host matrix

| Host | Required work | Current qualification path |
| ---- | ------------- | -------------------------- |
| `linux/x64` | Install, build, package, full tests, CLI check/build/run, LSP, VS Code bundle, ACME/VICE discovery and cancellation | Local qualification host |
| `win32/x64` | Same native boundary, Windows process-tree cancellation, ACME.exe/x64sc.exe discovery | Native Windows host only; otherwise `Unknown` |
| `darwin/arm64` | Same native boundary, process-group cancellation, macOS discovery | Native Apple-silicon host only; otherwise `Unknown` |
| `darwin/x64` | Same native boundary | Native Intel-macOS host only; otherwise `Unknown` |

The support statement names only rows with native evidence. Linux ARM64, Windows ARM64, and other
Node 22+ hosts remain best-effort. Hosts below Node 22, 32-bit hosts, and unknown architectures are
unsupported.

## Public path

On each claimed host:

1. `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`.
2. Pack public packages and install them into a clean temporary prefix.
3. Run `blendc check`, `build`, and fresh `run` through the installed CLI.
4. Start the installed language server and complete initialize/diagnostics/completion.
5. Install and activate the local VSIX; run Build, Run in VICE, and Open Build Evidence.
6. Prove ACME/VICE discovery precedence, exact versions, missing-tool failure, and owned-process
   cancellation.
7. Validate unique staging, immutable generation/current record, reader pins, and bounded retention.

A source-tree-only helper cannot satisfy a public path that is missing or differently wired in the
package.

## Local packaging

| Product | Artifact | Check |
| ------- | -------- | ----- |
| Compiler | `npm pack` tarball | Public root and `frontend` exports only; no backend leak through the frontend |
| CLI | `npm pack` tarball | `blendc` bin entry and JSON envelope work from the installed prefix |
| Language server | `npm pack` tarball | Stdio server starts from the installed package |
| VS Code | Local `.vsix` | Manifest, commands, trust, bundled language server, externalized CLI |

No NPM publication, Marketplace publication, tag, signing, notarization, or announcement occurs.

## Tool discovery

- Machine-local `tools.jsonc` schema 1 wins over `PATH`.
- Linux/macOS probe `acme` and `x64sc`; Windows probes `acme.exe` and `x64sc.exe`.
- No `PATHEXT`, registry, install-location probing, shell, or download.
- `check` and ordinary LSP work without external tools.
- Missing ACME blocks binary production; missing ACME or VICE blocks `run`; never launch a stale
  artifact.

## Cross-host identity

When more than one native host is available, compare normalized assembly, labels, maps, diagnostics,
debug evidence, PRG/D64 bytes, and semantic query results. Only `generationId` and declared
host/tool-path/hash/timing/memory provenance fields may differ. With one qualified host, the record
states that cross-host identity is `Unknown`.

## Error handling

| Case | Handling |
| ---- | -------- |
| Host unavailable | `Unknown`; omit from support statement |
| Install/build failure | Block that host |
| Package missing public entry | Block the public-path claim |
| Tool version mismatch | Block affected build/run |
| Child cancellation leaves a process | Block host cancellation claim |
| VSIX activation failure | Block extension claim |
| No second host | Record cross-host identity `Unknown` |
