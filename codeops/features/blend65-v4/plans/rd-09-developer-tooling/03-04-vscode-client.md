# VS Code Client: RD-09 Developer Tooling

> **Document**: 03-04-vscode-client.md
> **Parent**: [Index](00-index.md)

## Overview

The VS Code extension is a thin client. It owns language registration, language-server startup,
status, Problems/Output presentation, explicit Build/Run commands, trust, save-or-abort, and
validated artifact access. It contains no lexer, parser, type checker, asset decoder, compiler,
optimizer, packager, or VICE protocol implementation.

## Architecture

### Current Architecture

`packages/vscode/src/extension.ts` is 26 lines. It resolves `@blend65/language-server`, starts one
`LanguageClient` over stdio, and stops it on deactivate. The manifest contributes only the
`blend65` language (`packages/vscode/package.json:19-31`). Tests assert the minimal surface and the
absence of commands, configuration, and webviews.

### Proposed Changes

Split the extension into focused modules:

| Module | Responsibility |
| ------ | -------------- |
| `extension.ts` | Activation, client lifecycle, command registration |
| `host.ts` | Narrow `CommandHost` interface over VS Code APIs |
| `commands.ts` | Build/Run/Open Evidence command logic, pure over the host |
| `cli-client.ts` | Spawn packaged `blendc`, parse JSON, stream output, cancel process group |
| `status.ts` | Status bar state from `blend65/projectStatus` and command results |
| `diagnostics.ts` | Build/run diagnostics collection and byte→range mapping |
| `artifacts.ts` | Validate a generation and open/reveal contained evidence |
| `security.ts` | Trust, containment, hash, and URI checks |

`extension.ts` wires the real host; tests use a fake host and the real built CLI.

## Implementation Details

### Manifest

Contribute:

```json
{
  "commands": [
    { "command": "blend65.build", "title": "Blend65: Build" },
    { "command": "blend65.run", "title": "Blend65: Run in VICE" },
    { "command": "blend65.openEvidence", "title": "Blend65: Open Build Evidence" }
  ],
  "menus": {
    "commandPalette": [
      { "command": "blend65.build", "when": "editorLangId == blend65" },
      { "command": "blend65.run", "when": "editorLangId == blend65" },
      { "command": "blend65.openEvidence", "when": "editorLangId == blend65" }
    ],
    "editor/title": [
      { "command": "blend65.build", "when": "editorLangId == blend65" },
      { "command": "blend65.run", "when": "editorLangId == blend65" }
    ]
  }
}
```

Activation events add `onCommand:blend65.build`, `onCommand:blend65.run`, and
`onCommand:blend65.openEvidence`. `capabilities.untrustedWorkspaces` is `limited` with a description
that language features work and execution is denied.

No `Build and Run`, no no-build rerun, no auto-run, no configuration section, no webview, no tree
view, and no task provider are added.

### Command Flow

Both execution commands follow the same order:

1. Check `workspace.isTrusted`. If false, show an actionable error and stop before any save, spawn,
   tool discovery, or monitor creation.
2. Resolve the active document and the nearest containing `blend65.json`. If none, show
   `No Blend65 project` and stop.
3. Identify every dirty open document under the project root that is a consumed input: `.blend`
   sources and declared assets. If any is dirty, save it. If a save returns false or throws, abort
   and name the unsaved input. Unrelated dirty files do not block.
4. Run `blendc build --project <manifest> --json` or `blendc run --project <manifest> --json` with
   `process.execPath` and an argument array. No shell.
5. Show one cancellable progress operation with project, profile, phase, and cancel. Cancellation
   terminates the owned child process group and releases all owned work.
6. Parse exactly one JSON envelope from stdout. Protocol/JSON failure is a bounded command failure,
   never a success.
7. Publish structured diagnostics to a dedicated `Blend65 Build` collection, show a bounded
   summary in the `Blend65` output channel, and update status.
8. On success, remember the generation `{ generationId, directory, buildJsonSha256, primaryArtifact }`
   and enable artifact access. On failure, publish the failure category and no new generation.

Run uses the same fresh-build `run` contract as the CLI. It never launches a prior artifact.

### Status

Status bar states: `No project`, `Invalid project`, `Analyzing`, `Ready`, `Error`, `Cancelled`.
When known, show the project name and effective profile. The state comes from
`blend65/projectStatus` and the latest command result. A stale or failed analysis is never shown as
`Ready`.

### Output

The dedicated `Blend65` channel receives:

- command start: project-relative manifest, command, effective profile;
- phase summaries: check, build, assemble, package, publish, run;
- failure category and safe message;
- final generation id and primary artifact path (project-relative when possible).

It never receives complete source/asset contents, raw VICE monitor data, stack traces for expected
failures, or unnecessary absolute paths.

### Diagnostics Mapping

Build/run JSON diagnostics carry UTF-8 byte spans. The extension maps them to VS Code ranges using
the open document text when available, or reads the file only after canonical containment and size
checks. Diagnostics from the live LSP remain in Problems; the build collection is separate and is
cleared at the start of each command.

### Artifact Access

`Blend65: Open Build Evidence`:

1. Runs `blendc evidence --project <manifest> --json` to resolve and validate the current
   generation.
2. Rejects a malformed, missing, escaping, symlinked, hash-mismatched, or mixed generation.
3. Shows a quick pick of evidence roles: assembly, labels, memory, assets, costs, debug, build
   record, primary artifact.
4. Opens text evidence with `showTextDocument`.
5. Reveals the primary artifact with `revealFileInOS` only when the workspace is trusted; it never
   executes the artifact.
6. Labels the generation id and whether it is current. Historical evidence is identified by its
   generation, not called current.

### Refresh

The extension watches `**/blend65.json`, `**/*.blend`, and declared asset roots with
`createFileSystemWatcher`. Created/changed/deleted events send `workspace/didChangeWatchedFiles` to
the language server. The server invalidates only affected project contexts. The watcher is disposed
on deactivate. No persistent cache or daemon is created.

### CLI Resolution

The extension declares `@blend65/cli` as a runtime dependency. `packages/cli/package.json` adds a
`./bin` export mapping to `dist/bin.js`. `cli-client.ts` resolves that export with `createRequire`
and starts it with `process.execPath` and an argument array. A missing CLI is an actionable command
error; there is no PATH or setting fallback. The extension bundle externalizes `@blend65/cli`.

### Testability

`CommandHost` exposes only what the command logic needs:

```ts
interface CommandHost {
  readonly isTrusted: boolean;
  readonly workspaceRoot: string | null;
  activeDocument(): { uri: string; languageId: string; isDirty: boolean } | null;
  documentsUnder(root: string): readonly { uri: string; isDirty: boolean; save(): Promise<boolean> }[];
  findManifest(documentUri: string): Promise<string | null>;
  withProgress<T>(title: string, task: (signal: AbortSignal) => Promise<T>): Promise<T>;
  showError(message: string): void;
  showInformation(message: string): void;
  output: { appendLine(line: string): void };
  diagnostics: { set(uri: string, diagnostics: unknown[]): void; clear(): void };
  showQuickPick(items: readonly string[]): Promise<string | undefined>;
  openText(path: string): Promise<void>;
  reveal(path: string): Promise<void>;
}
```

The real host implements it with VS Code APIs; tests implement a fake host and a real CLI process.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Untrusted workspace | Deny before save/spawn; language features remain | AR-13 |
| No project | Show `No Blend65 project`; no spawn | AR-2 |
| Dirty save declined/failed | Abort and name the input | AR-2 |
| CLI missing | Actionable error; no fallback | AR-20 |
| CLI JSON malformed | Command failure; no success claim | AR-3 |
| Child cancellation | Terminate owned process group; report cancelled | AR-2 |
| Artifact path escape/hash mismatch | Reject; execute/reveal nothing | AR-13 |
| Missing/stale current record | Report invalid/stale; no artifact access | AR-13 |

## Testing Requirements

- Manifest tests: exact commands, activation, trust capability, no forbidden command/configuration.
- Pure command tests with a fake host: trust denial, no project, save-or-abort, cancellation,
  malformed JSON, success, failure, status transitions.
- Real CLI integration: build and run argv, JSON parsing, process-group cancellation, evidence
  command.
- Artifact tests: valid generation, missing/malformed/escaping/symlink/hash mismatch/mixed.
- Bundle test: extension bundle contains no compiler backend path and externalizes `@blend65/cli`.
- Activation test against a packaged extension host boundary where feasible; otherwise record the
  concrete reason and use the fake host plus real client library.
