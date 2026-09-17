# CLI and Foundation Qualification

> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P1, AR-P5–AR-P7

## CLI Shell

Add the real CLI package in Phase 3, not as a placeholder in Phase 1. Node 22's
built-in argument parser is sufficient. `bin.ts` is a thin executable; `main.ts`
exports a testable entry with injected stdout/stderr functions, not a DI framework.

```typescript
interface CliOutput {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}
function runCli(
  argv: readonly string[], output: CliOutput, cwd?: string,
): Promise<0 | 1 | 2>;
```

| Invocation | Behavior |
|---|---|
| `blendc --help` / `-h` | Show project-load usage and explicitly state that compilation is not implemented; exit 0 without loading a project |
| `blendc --version` / `-v` | Show package version, matching build metadata; exit 0 without loading a project |
| `blendc [--project PATH] [--target PROFILE] [--entry MODULE]` | Call public `loadProject` with explicit options; no command means load, never compile |
| Successful load | Stdout: `Project '<escaped-name>' loaded (<N> source files); no compilation performed`; exit 0 |
| Invalid project | Render shared structured diagnostics to stderr; exit 1, no success line |
| Unknown/repeated option, missing value, positional command/file, or simultaneous help/version | `CLI_INVALID_ARGUMENT` plus concise usage to stderr; exit 2, no project read |

Support standard `--key=value` as well as separate string values. Reject `check`,
`build`, and `run` as unsupported positional commands; do not implement fake
successful commands. No raw-source-file mode, tool settings, color framework,
JSON-output flag, subprocess invocation, or asset command is added here.

`CLI_INVALID_ARGUMENT` uses the explicit user-approved PF-001 host-result boundary
in `03-02`; it does not allocate or reinterpret a Chapter 14 language code.

Render a stable header `error[<code>]: <message>`, the smallest available relative
source/span or option/key location, related locations, and concrete help when
known. UTF-8 byte spans remain the service contract; consumer conversion is
explicit. Escape names/control sequences, do not show absolute roots or stacks,
and do not print source contents outside a bounded necessary diagnostic excerpt.
The shell reuses service diagnostics instead of inventing a second manifest
validator. See ST-32–ST-35.

## Example

Replace rejected compiler examples only after inventory. Add
`examples/foundation/blend65.json` and `examples/foundation/src/main.blend`.
Use name `foundation`, sourceRoot `src`, entry `Foundation`, target
`c64-pal-prg-kernal-6581`, outDir `out`, and optimization `none`. The manifest
may demonstrate a comment and trailing comma. The single source uses legal
Specification 4 module/function syntax. It is input evidence only: neither the
README nor tests claim it compiles or runs in RD-02. No empty output directory
needs checking in; the declaration is sufficient.

## Verification

At green foundation checkpoints:

```text
yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test
```

These command names are detected from existing manifests, with the new task
ownership specified in `03-01`. No `lint` command remains. Also run targeted
Prettier checks and Markdown link checks for touched documentation. During
implementation use directed package tests/build/typecheck; do not invoke unrelated
v3 suites. Pure Markdown planning changes run Markdown checks only.

Adapt the existing CI job rather than creating a CI system. Native Node 22
`ubuntu-latest` x64 and `windows-latest` x64 jobs run the same foundation commands.
Reuse existing checkout/setup-node/Corepack roles, remove ACME/VICE/scoreboard/lint
steps and inherited readiness/cache products. Add no remote Turbo cache, new
credential, generalized workflow generator, or CI benchmarking service.

Production-qualified combinations are Node 22 `linux/x64` and `win32/x64`.
Other supported 64-bit Node 22 hosts are best-effort with a success observation; 32-bit,
unknown architectures, and non-Node-22 runtime are unsupported as RD-02 requires.
Keep platform-specific path tests native. Windows junction/symlink/permissions
tests must exercise their real semantics; inability to create required fixtures
is a qualification limitation, not a silently skipped PASS. Linux permission
tests must run under an effective account for which the fixture is unreadable,
not rely on root respecting mode bits.

If a native Windows runner is unavailable, implementation can proceed, but RD-02
cannot be declared Done. Report the missing evidence and request the existing
authorized host/CI execution; never push, create credentials, or broaden
infrastructure authority merely to get a run. See ST-36–ST-38.

## Observations, Not Gates

Record real example identity, host/tool versions, input count/bytes, and separate
discovery, JSONC, inventory/snapshot, TypeScript build, test, and peak-memory
observations in `08-closeout.md`. Use existing process timing and Node memory
observations, or a small implementation-test measurement of internal phases.
Do not build a benchmark harness or public metrics API. No duration/memory value
controls PASS, CI, closeout, or release. Do not generate a large synthetic project.

## Closeout

Per approved PF-002, native-run results, observations, and the deferral walk are
direct evidence inspections. The foundation command runs first and supplies
results to record; it does not require an already-completed record of itself.
Task 3.2.5 gates runnable behavior/configuration suites, not these later records.
Tasks 3.3.1/3.3.2 produce and inspect ST-36/ST-39/ST-40 evidence before final review,
green commit, or Done. No skipped proof, self-verifying metadata test, or new
evidence framework is permitted.

`08-closeout.md` records accepted authority identities, green foundation content
checkpoints, inventory proof links, complete directed qualification results on
both production hosts, example identity, observations, independent review, and
the no-artifact/no-spec-change checks. A summary counter is not a substitute for
individual required proof. See ST-01–ST-04 and ST-36–ST-40.

Answer verbatim: **Did this RD's deliverables expire any deferral's stated
rationale?** Walk v4 requirement/plan registers, RD-02 Won't Have,
`spec/future-considerations.md`, and expert release/qualification deferrals.
Reopen expired items with their existing owner or an explicit owned backlog row;
do not implement them during this closeout. No deferral may retain RD-02 itself
as a future landing place. Do not recreate a discarded v3 expressiveness ledger;
user-hit language restrictions belong to the v4 owning requirement/conformance
record, but this RD introduces no language restriction.

Update the feature roadmap after actual completion and stage root guidance from
the implemented checkout. The portfolio rollup stays deferred on the feature
branch. Frozen `spec/` and active expert content must remain unchanged throughout.
