# Blend65 Editor and Debug Evidence

RD-09 gives Blend65 a normal editor workflow and portable build evidence. It does not add a
debugger, a game framework, or an editor-side compiler.

## Editor

The VS Code extension registers one language (`blend65`, `.blend`) and starts the matching language
server. Open any `.blend` file in a project with an upward `blend65.json`; the status bar shows
`No project`, `Invalid project`, `Analyzing`, `Ready`, `Error`, or `Cancelled`.

Live analysis works on unsaved buffers. Diagnostics, completion, hover, signature help, definition,
references, rename, symbols, semantic tokens, and formatting all come from the same frontend
semantic model as `blendc check`. The language server never runs lowering, codegen, ACME, packaging,
or VICE.

| Action | How |
| ------ | --- |
| Build | `Blend65: Build` |
| Run in VICE | `Blend65: Run in VICE` |
| Open evidence | `Blend65: Open Build Evidence` |

The extension saves every dirty Blend65 input under the project before a command. If a save is
declined or fails, the command stops and names the input. Build and run require a trusted
workspace. Run always performs a fresh build and launches only that generation's primary artifact.

## CLI

```text
blendc check --project game/blend65.json --json
blendc build --project game/blend65.json --json
blendc run   --project game/blend65.json --json
blendc evidence --project game/blend65.json --json
```

`--json` emits exactly one `blend65.cli` schema-version 1 object on stdout. The human output and
exit statuses are unchanged without the flag. `blendc evidence` resolves and validates the current
immutable generation and returns the eight artifact roles; it never publishes, repairs, or deletes
anything.

## Tool discovery

`blendc build` needs ACME 0.97, and `blendc run` also needs VICE 3.10 `x64sc`. An optional machine-local
JSONC file selects explicit executables:

```jsonc
// Linux/macOS: ${XDG_CONFIG_HOME:-$HOME/.config}/blend65/tools.jsonc
// Windows:    %APPDATA%\blend65\tools.jsonc
{
  "schemaVersion": 1,
  "acmePath": "/usr/bin/acme",
  "x64scPath": "/home/user/.local/bin/x64sc"
}
```

Both paths are optional and must be absolute. A configured path wins and never falls back to
`PATH`; an invalid configured path fails the operation. When a path is omitted or the file is
absent, the CLI scans `PATH` in order for `acme`/`x64sc` on Linux and macOS, or
`acme.exe`/`x64sc.exe` on Windows. `blendc check` and the language server never read this file.

## Debug evidence

Every successful build emits `.debug.json` beside the primary artifact. It records:

- portable project-relative source paths, byte lengths, and hashes;
- final functions, entry variants, and call/inlining contexts;
- symbols, exact types, SFA homes, live intervals, and availability states;
- post-layout source-to-machine ranges with bank/load-unit identity;
- D64 load-unit publication and residence intervals;
- compiler, specification, expert-skill, profile, CPU, mode, safety, and artifact identities.

The evidence is host-side only. It adds no bytes, RAM, startup work, or cycles to the target.
`optimizedAway`, `constant`, `rematerializable`, and `unavailable` values are reported as such; a
consumer must not display a stale home or a guessed value. A later debugger adapter can translate
the evidence; Blend65 does not ship a debugger or a DAP implementation. See
[RD-09 VICE Debug Adapter Probe](rd09-debug-adapter-probe.md) for the bounded interoperability
result.

## Boundaries

No game engine, renderer, runtime, mixer, scheduler, asset plugin framework, or content-authoring
suite is part of this surface. Assets remain compile-time inputs; gameplay stays in your source.
