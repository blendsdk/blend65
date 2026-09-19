# Current State: RD-03 Pipeline Completion

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

- The v4 repository currently has two workspaces: `@blend65/compiler` and `@blend65/cli`.
- RD-02 supplies deterministic project discovery, manifest validation, immutable source snapshots,
  path containment, hashes, positions and structured diagnostics.
- The completed frontend supplies lexing, parsing, reachable modules, binding, admitted type/control/
  aggregate/memory analysis, call edges, effects, initializer order and an internal
  `analyzeProject(snapshot)` result.
- `analyzeProject` deliberately returns incomplete obligations for `embed()` and selected-profile
  forms. No backend consumes its `TypedProgram` yet.
- The compiler root exports project APIs only. The CLI loads a project and truthfully says no
  compilation occurred.
- The root boundary checker already resolves package subpaths and follows transitive imports from
  frontend/editor ownership to forbidden backend ownership.
- ACME 0.97 and VICE 3.10 `x64sc` are installed locally. The VICE binary-monitor joystick path was
  proven during planning (AR-C11).

### Relevant Files

| File / area | Current purpose | Required change |
|---|---|---|
| `packages/compiler/src/frontend/service.ts` | Internal completed frontend service | Resolve profile/raw-asset obligations and expose a backend-free entry (AR-C6, AR-C9) |
| `packages/compiler/src/frontend/semantic-types.ts` | Typed bindings, declarations, calls and effects | Feed a small semantic-operation/CFG builder without backend facts (AR-C3) |
| `packages/compiler/src/index.ts` | Project-load public API | Add direct check/build/run services and result types (AR-C9) |
| `packages/compiler/package.json` | Root-only export | Add `./frontend` export only; retain root backend boundary (AR-C2, AR-C9) |
| `packages/cli/src/{args,main,bin}.ts` | Load-only CLI | Parse and execute `check`, `build`, `run`; preserve safe output/error behavior (AR-C9, AR-C14) |
| `test/import-boundary.ts` | Workspace/subpath import graph guard | Exercise actual frontend subpath and editor workspaces (AR-C2) |
| root `package.json`, `tsconfig.json` | Two-workspace build graph | Add only language-server and VS Code project references/dependencies (AR-C2, AR-C10) |
| `examples/` | No M1 v4 vertical fixture | Add one readable M1 project, raw art, fixed trace, oracle and expert twin (AR-C1, AR-C13) |

## Gaps Identified

### Semantic and Storage Gap

**Current behavior:** The frontend returns typed declarations/effects but no executable operation
order, CFG, whole-program roots, lifetimes or storage homes.

**Required behavior:** Build explicit semantic CFG, close roots/effects/lifetimes, allocate all
function execution storage through SFA and freeze final storage before layout.

**Fix:** Direct builders and immutable records described by
[Semantic pipeline](03-01-semantic-pipeline.md) and [SFA](03-02-sfa-and-abi.md) (AR-C3, AR-C4).

### Target and Artifact Gap

**Current behavior:** There is no selected profile, asset reader, machine representation, layout,
emitter, packager, artifact verifier or publisher.

**Required behavior:** One exact C64 PAL/KERNAL/6581 vertical slice through documented 6510 bytes,
ACME 0.97, PRG and coherent evidence generation.

**Fix:** Direct selected facts and pipeline modules in [Target and layout](03-03-target-assets-lowering-layout.md)
and [Artifacts](03-04-artifacts-and-publication.md) (AR-C5–AR-C8).

### Consumer Gap

**Current behavior:** CLI only loads; no editor workspaces exist.

**Required behavior:** Truthful public check/build/run and a diagnostics-only LSP/VS Code bundle.

**Fix:** Narrow services and products in [Public consumers](03-05-public-consumers.md) (AR-C9,
AR-C10).

### Qualification Gap

**Current behavior:** No M1 source, raw art, independent behavior model, expert twin, or automated
joystick execution exists.

**Required behavior:** One original, readable program with complete independent and machine evidence.

**Fix:** [M1 qualification](03-06-m1-qualification.md) and the fixed tests in
[Testing](07-testing-strategy.md) (AR-C11–AR-C13).

## Dependencies

### Internal

- RD-02 project snapshots and safe path/input services.
- Completed RD-03 frontend typed program, diagnostics and effects.
- Existing root boundary tests and Yarn/Turbo/TypeScript/Vitest conventions.

### External

| Dependency | Use | Boundary |
|---|---|---|
| ACME 0.97 | Terminal assembly and reports | Direct child process; exact version; no shell (AR-C8, AR-C14) |
| VICE 3.10 `x64sc` | Interactive run and one local qualification path | Exact version/model; binary monitor only for qualification (AR-C11, AR-C12) |
| `vscode-languageserver` | Stdio server protocol | Diagnostics only (AR-C10) |
| `vscode-languageserver-textdocument` | Open-document text lifecycle | No project or backend ownership (AR-C10) |
| `vscode-languageclient` | Thin VS Code client | Start/stop and diagnostics transport only (AR-C10) |
| Vite | Bundle the two editor Node entry points | No web UI or plugin framework (AR-C10) |

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Semantic facts are erased before lowering | Medium | High | ST transition packets and discriminated records retain width/order/effects/source (AR-C3) |
| Late lowering invents storage | Medium | High | Bounded feedback plus closure certificate; post-closure constructors reject storage requests (AR-C4) |
| C64 details leak into editor/frontend | Low | High | Real `./frontend` subpath plus transitive import-boundary tests (AR-C2, AR-C9) |
| ACME or failed build leaves stale success | Medium | High | Unique absent staging paths, full byte/report validation, atomic current record (AR-C8, AR-C14) |
| VICE input is flaky or edits state | Low | High | Proven I/O-simulation command at emitted per-frame checkpoint; fixed trace only (AR-C11) |
| Plan grows into frameworks | Medium | High | Complexity baseline rejects every unneeded registry/service/layer; phase reviews re-check AR-C2–AR-C10 |
| Windows evidence unavailable | Certain now | Medium | Named native-only RD-10 deferral; keep implementation portable and claims bounded (AR-C16) |
