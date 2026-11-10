# CLI JSON Adapter: RD-09 Developer Tooling

> **Document**: 03-05-cli-json-adapter.md
> **Parent**: [Index](00-index.md)

## Overview

The CLI already owns the authoritative `check`/`build`/`run` execution path and stable exit
statuses. RD-09 adds one machine-readable result mode for the VS Code adapter and one read-only
`evidence` query for validated artifact access. Human output and existing commands stay unchanged.

## Architecture

### Current Architecture

`packages/cli/src/run.ts` parses arguments, calls one compiler service, renders human diagnostics,
and returns a stable exit status (`FAILURE_EXIT` at `run.ts:44-54`). `main.ts` wires the public
compiler services. There is no JSON output, no `evidence` command, and no machine-readable
diagnostic record.

### Proposed Changes

| File | Change |
| ---- | ------ |
| `args.ts` | Add `--json`; add the `evidence` command |
| `run.ts` | Serialize one result envelope; keep human rendering |
| `render.ts` | Add canonical JSON serialization and evidence rendering |
| `evidence.ts` | New read-only current-generation resolver/validator |
| `main.ts` | Wire the evidence service dependency |
| `package.json` | Add the `./bin` export |

## Implementation Details

### JSON Envelope

```ts
/** Stable machine-readable CLI result. */
export interface CliJsonEnvelope {
  readonly kind: "blend65.cli";
  readonly schemaVersion: 1;
  readonly command: "check" | "build" | "run" | "evidence" | "help" | "version";
  readonly outcome:
    | "success"
    | "diagnostics"
    | "failure"
    | "invalid-arguments"
    | "cancelled";
  readonly exitStatus: number;
  readonly profileId?: string;
  readonly diagnostics: readonly CliJsonDiagnostic[];
  readonly generation?: {
    readonly generationId: string;
    readonly directory: string;
    readonly buildJsonSha256: string;
    readonly primaryArtifact: string;
  };
  readonly run?: {
    readonly status: "exited";
    readonly verification: "interactive-unverified";
  };
  readonly failure?: {
    readonly category: FailureCategory;
    readonly message: string;
  };
  readonly evidence?: {
    readonly current: boolean;
    readonly artifacts: readonly {
      readonly role: string;
      readonly path: string;
      readonly sha256: string;
    }[];
  };
}

/** One diagnostic with compiler byte spans. */
export interface CliJsonDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly primarySpan: SourceSpan | null;
  readonly related: readonly { readonly span: SourceSpan; readonly message: string }[];
  readonly help: string | null;
  readonly pointer: string | null;
}
```

- `stdout` receives exactly one JSON object followed by one LF when `--json` is present.
- `stderr` stays empty for a valid JSON invocation, including expected compilation failures.
- Exit statuses remain exactly the existing `FAILURE_EXIT` values.
- `outcome` is `success` for a successful check/build/run, `diagnostics` for a failure with at
  least one diagnostic, `failure` for a category failure without diagnostics, `invalid-arguments`
  for parse/usage failure, and `cancelled` for the cancelled category.
- Unknown absolute host paths are not added beyond the existing generation directory and artifact
  paths the API already returns. Project-relative diagnostic spans are preserved.

### Argument Parsing

- `--json` is a boolean flag accepted by `check`, `build`, `run`, `evidence`, `help`, and
  `--version`.
- `evidence` accepts `--project`, `--json`, and no build/run options.
- Invalid arguments with `--json` still emit a `blend65.cli` envelope with
  `outcome: "invalid-arguments"`, `exitStatus: 2`, and no diagnostics.
- Duplicate `--json` is invalid.
- `--json` never changes discovery, publication, or execution behavior.

### Evidence Command

`blendc evidence --project <manifest> --json`:

1. Loads the project snapshot with `loadProject` (read-only).
2. Reads `<outDir>/current.json`, validates the generation id and `.build.json` hash.
3. Reads and validates the generation's `.build.json` and every artifact hash.
4. Returns the fixed artifact roles and paths, with `current: true`.
5. Returns a typed failure for missing, malformed, escaping, symlinked, mixed, or hash-mismatched
   evidence. It never publishes, repairs, or deletes anything.

The resolver reuses the existing publication validation functions; it does not reimplement hashing
or generation rules. The CLI is allowed to import the compiler root.

### Human Output

Without `--json`, behavior is unchanged. With `--json`, human diagnostics are suppressed from
stdout/stderr; the caller's envelope is the only output. `--help`/`--version` with `--json` return
the envelope with `command: "help"`/`"version"` and no diagnostics.

### Exit Status Map

| Outcome | Exit |
| ------- | ---- |
| check/build/run success | 0 |
| source diagnostics | 3 |
| compiler failure | 4 |
| assembler failure | 5 |
| packaging failure | 6 |
| tool discovery | 7 |
| emulator start | 8 |
| emulator runtime | 9 |
| recovery required | 10 |
| invalid arguments | 2 |
| cancelled | 130 |

## Integration Points

- `packages/vscode/src/cli-client.ts` parses the envelope.
- The compiler's `PublishedGeneration` provides the generation fields.
- Existing `renderDiagnostics` remains the human path.
- No shell, no new process protocol, and no JSON schema registry are added.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `--json` parse failure | Emit invalid-arguments envelope; exit 2 | AR-3 |
| Service failure with diagnostics | `outcome: "diagnostics"`; preserve all records | AR-3 |
| Service failure without diagnostics | `outcome: "failure"`; category + safe message | AR-3 |
| Cancellation | `outcome: "cancelled"`; exit 130 | AR-3 |
| Evidence missing/invalid | Typed failure; no stdout artifact list | AR-13 |
| Evidence path escape | Typed failure; no path disclosure | AR-13 |
| Unexpected exception | Existing `CLI_INTERNAL`; JSON envelope when `--json` | AR-3 |

## Testing Requirements

- Exact envelope shape and field order for check/build/run/evidence success and failure.
- One JSON object, one LF, empty stderr.
- Invalid arguments, duplicate `--json`, help/version.
- Exit status table unchanged.
- Evidence valid generation, current vs historical, missing/malformed/escaping/symlink/hash
  mismatch/mixed.
- Human output snapshot unchanged without `--json`.
- No shell invocation and no new runtime dependency.
