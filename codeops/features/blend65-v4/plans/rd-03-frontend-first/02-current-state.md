# Current State: RD-03 Frontend First

> **Parent**: [Index](00-index.md)
> **Inspected**: 2026-09-18, branch `feature/v4-rebuild`, starting content `c46aec2`

## Existing Implementation

| Path | Inspected fact | Planned use |
|---|---|---|
| `packages/compiler/src/project/types.ts` | Source records retain BOM/line endings; spans are half-open raw UTF-8 bytes; snapshot has effective entry/target and unread asset roots | Reuse contracts (AR-P4) |
| `packages/compiler/src/project/positions.ts` | Raw UTF-8/UTF-16 boundary mapping already exists | Reuse where needed, never normalize input |
| `packages/compiler/src/index.ts` | Exports project services only; no frontend pipeline | Leave public entry unchanged |
| `packages/compiler/package.json` | Existing compiler workspace builds/typechecks with TypeScript and tests with Vitest | Add colocated feature files |
| `package.json` | Stable TypeScript 7.0.2, Yarn classic, Turbo, Vitest, Prettier; no lint script | Use actual commands, not historical v3 guidance |
| `test/import-boundary.ts:25` | Recognizes internal `frontend/` paths and follows transitive source edges | Existing enforcement covers chosen owner |
| `test/import-boundary.spec.test.ts:182` | Already proves an internal frontend cannot reach target lowering | Reuse qualification; do not duplicate a checker |

No v4 language lexer, parser or analyzer exists. Historical v3 implementation and
tests are not authority and are not copied. RD-02 implementation is complete but
its native Windows proof remains pending; prior Linux tests are not new frontend
evidence. The live roadmap owns that status.

## Dependencies and Risks

| Boundary | Consequence | Control |
|---|---|---|
| Frozen Specification 4 and expert 2.0.0 | No implementation-convenience semantics | Raw chapters/grammar own expectations; lineage in register |
| Missing general syntax code | Requires project exception, not a invented normative number | Approved AR-P3, R3.10 exception |
| Partial frontend | Can falsely report success if checks are omitted | Explicit completion obligations, AR-P4 |
| BOM, astral scalars and CRLF | UTF-16 offsets are not raw byte spans | Existing mapping plus independent span cases |
| Future editor imports | Compiler-root barrel eventually reaches backend | Actual editor consumer must first obtain a backend-free entry or extraction, AR-P2 |
| Assets and selected profile | Snapshot has no asset contents or qualified language declarations | No guessed schema, type or profile-success claim |

No dependency installation, external source lookup, assembler, emulator or Windows
host is required to author or test this target-neutral partial frontend.
