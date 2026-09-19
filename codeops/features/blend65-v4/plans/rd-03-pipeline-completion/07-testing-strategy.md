# Testing Strategy: RD-03 Pipeline Completion

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Test Policy

The completed frontend plan owns ST-1–ST-48. This plan continues at ST-49. New
`*.spec.test.ts` files are immutable requirements-derived oracles: author them first, record RED,
then implement and reach GREEN. `*.impl.test.ts` files cover internal algorithms and host seams.
Tests use real values, files and child processes; mocks are limited to tool failures that cannot be
produced safely with real ACME/VICE (AR-C13–AR-C15).

## 🚨 Specification Test Cases

### Semantic Pipeline and Whole Program

| ID | Concrete input/scenario | Expected output/behavior | Source |
|---|---|---|---|
| ST-49 | `x = next();`, nested calls, short circuit and `a[i()] += d()` | Exact once-only left-to-right operations, places and branch-only effects | R3.9, R3.11; [semantic representation](03-01-semantic-pipeline.md#semantic-representation) |
| ST-50 | Ordinary `for` with `continue`, `break` and early `return` | Explicit init/condition/body/update/end CFG; only `continue` reaches update | R3.12; [CFG rules](03-01-semantic-pipeline.md#cfg-rules) |
| ST-51 | Constant-false arm plus live sibling | Proved-unreachable arm excluded; surviving source/effects retained | R3.12, R3.20 |
| ST-52 | Startup, two initializers, main and direct helpers | Stable complete roots/call/effect closure in semantic identity order | R3.13; [whole-program result](03-01-semantic-pipeline.md#whole-program-result) |
| ST-53 | Direct and mutual recursion | Complete deterministic cycle diagnostic; no downstream program | R3.13 |
| ST-54 | Unknown, poisoned or incomplete call target | No omitted edge or successful whole-program result | R3.10, R3.13 |
| ST-55 | Selected-profile declaration environment and every M1 named call | Exact typed capabilities/effects; no address/opcode/ACME/layout fact upstream | R3.17–R3.18; AR-C17 |
| ST-56 | Dynamic byte/word PEEK/POKE with effectful operands | Correct widths, modulo address semantics and volatile count/order | R3.9, R3.19 |

### SFA and ABI

| ID | Concrete input/scenario | Expected output/behavior | Source |
|---|---|---|---|
| ST-57 | Parameters, scalar return, locals and temporaries | Every result has one ABI location; every value that requires storage has one request, lifetime and deterministic home; A/A-X returns have no duplicate RAM home | R3.14; [direct storage records](03-02-sfa-and-abi.md#direct-records) |
| ST-58 | `f(1, g())` and `f(1, f(2, 3))` | Outer staging survives nested call; no false recursion | R3.14 |
| ST-59 | Disjoint sibling lifetimes and caller/callee-live values | Legal overlay occurs; interfering values never overlap | R3.14–R3.15 |
| ST-60 | Dynamic pointer pair at candidate `$fe` and `$ff` | `$fe/$ff` pair succeeds; `$ff` start relocates/fails without wrap | R3.14–R3.15 |
| ST-61 | Legalizer adds one spill, then stabilizes | One monotonic re-close freezes a certificate containing the spill | R3.15; AR-C4 |
| ST-62 | Deliberately nonconverging request sequence | Fixed bound fails deterministically; no partial certificate/assembly | R3.15; AR-C4 |
| ST-63 | Globals, raw asset and fixed enemy state | Remain outside SFA and occur once in platform layout | R3.14, R3.22–R3.23 |
| ST-64 | Ordinary calls with cooperative KERNAL IRQ enabled | Stack proof includes return nesting and selected IRQ margin | R3.16, R3.24 |

### Target, Assets, Machine Lowering and Layout

| ID | Concrete input/scenario | Expected output/behavior | Source |
|---|---|---|---|
| ST-65 | Select valid profile, then an unknown ID | Exact four-fact composition; unknown ID is terminal | R3.17; AR-C5 |
| ST-66 | Raw asset search precedence and exact valid file | First canonical root wins; immutable `const byte[512]` and stable hash | R3.21–R3.22; AR-C6 |
| ST-67 | Missing, empty, short, long or changed raw asset | Exact diagnostic; no typed value or output | R3.21 |
| ST-68 | Absolute, traversing, symlink, alias or non-regular asset | Containment/identity failure without reading outside snapshot | R3.21; AR-C14 |
| ST-69 | Byte/word add/subtract and signed/unsigned compares | Correct carry/borrow/overflow values at boundary vectors | R3.20; [canonical lowering](03-03-target-assets-lowering-layout.md#canonical-optimization-none-lowering) |
| ST-70 | Branch-only comparison and short circuit | Direct legal branches; no needless Boolean or reordered effect | R3.9, R3.20 |
| ST-71 | Dynamic byte/word PEEK/POKE at `$ffff` | Once-only low/high accesses, modulo wrap and SFA pointer ownership | R3.19 |
| ST-72 | Every M1 platform operation | Exact documented volatile count/order; no helper dispatch/duplicate read | R3.18; AR-C17 |
| ST-73 | Invalid opcode/mode, undocumented opcode and stale flag | Candidate rejected before accepted machine program | R3.20 |
| ST-74 | Conditional branch just in/out of range | Short form at boundary; deterministic inverse-branch-over-JMP beyond | R3.20 |
| ST-75 | Startup and returning main | Exact `$0801..$080d`, init order, saved/restored state and BASIC return | R3.24 |
| ST-76 | M1 code/data/SFA/screen/raw asset placement | Non-overlap, alignment, VIC visibility, derived blocks and one asset copy | R3.23–R3.24 |

### ACME, Evidence and Publication

| ID | Concrete input/scenario | Expected output/behavior | Source |
|---|---|---|---|
| ST-77 | Same final machine/layout input twice | Byte-identical `.asm`, labels, PRG and portable sidecars; `.build.json` differs only in `generationId` and declared host provenance, while its canonical portable projection is byte-identical; legal NMOS forms only | R3.25 |
| ST-78 | Real ACME 0.97 invocation | Exact arguments, report/symbol/PRG agreement and removed staging report | R3.26; AR-C8 |
| ST-79 | Wrong/missing ACME or nonzero/error output | Correct failure category; no current generation | R3.3, R3.26 |
| ST-80 | Symlink, device, alias, stale or unexpected tool output | Fail closed before publication | R3.26; AR-C14 |
| ST-81 | Each of five sidecar encoders round-trips | Exact schema/order/ranges, canonical JSON and unknown-field rejection | R3.27 |
| ST-82 | Successful build publication | Exactly eight immutable files and valid current record/cross-hashes | R3.27 |
| ST-83 | Failure/cancellation before commit | Prior current unchanged; only owned staging removed | R3.27–R3.28 |
| ST-84 | Two competing publications | Serialized coherent commits, predecessor retained, no mixed siblings | R3.27; AR-C18 |
| ST-85 | Two pins, release and cleanup | Separate ownership; retain until last release, then bounded cleanup | R3.27–R3.28 |
| ST-86 | Crash-left/malformed/unreadable pin or lock | No automatic reclamation; manual-recovery diagnostic | R3.27–R3.28; AR-C18 |
| ST-87 | Cancellation after current commit during run | Generation retained; owned children stop; pin releases last | R3.28 |

### Public Consumers and Editor

| ID | Concrete input/scenario | Expected output/behavior | Source |
|---|---|---|---|
| ST-88 | Library check/build/run on M1 | Check writes nothing; build fresh; run pins/launches its own build | R3.3; AR-C9 |
| ST-89 | Each public failure category and cancellation | Stable typed result/CLI exit; no stale run or shell | R3.3; AR-C9, AR-C14 |
| ST-90 | CLI valid/invalid options and unsafe-looking values | Exact allowlist; values remain data and cannot escape validation | R3.3; AR-C14 |
| ST-91 | Frontend-subpath actual and transitive imports | No target/SFA/lowering/layout/emitter/publication/VICE reachability | R3.4, R3.17; AR-C2 |
| ST-92 | LSP open/change/save/close with sibling overlays | Diagnostics use current overlays, then disk content after close | R3.4; [language server](03-05-public-consumers.md#language-server) |
| ST-93 | Non-ASCII and EOF diagnostic spans | Exact raw-byte to zero-based UTF-16 ranges and related locations | R3.4, R3.10 |
| ST-94 | Rapid changes, overlay limits/invalid Unicode and malformed/non-file/out-of-project URI | Only newest result publishes; invalid or excessive input cannot escape/crash/exhaust the server | R3.4; AR-C14 |
| ST-95 | Built server/extension bundles | Real stdio initialize/open/diagnostics and exact minimal manifest | R3.4; AR-C10 |

### M1 Qualification

| ID | Concrete input/scenario | Expected output/behavior | Source |
|---|---|---|---|
| ST-96 | Sprite recipe and checked-in raw file | Exact 512 bytes/order, nonblank distinct records, provenance and hash | R3.21; AR-C1 |
| ST-97 | Pure complete fixed win trace | Every behavior-table state/effect/frame including six kills and exit | R3.2, R3.29, R3.32 |
| ST-98 | Pure loss and focused edge vectors | Exact loss, held fire, opposing direction, hit priority and explosion | R3.2, R3.32 |
| ST-99 | Full public build of checked-in M1 | Valid eight-file generation, exact PRG/layout/assets, no runtime copy | R3.1, R3.22–R3.27 |
| ST-100 | Generated output versus expert twin | Same behavior and complete cost ledger; passes governing expert floor | R3.33; AR-C13 |
| ST-101 | Real VICE fixed win trace | Real CIA input, all oracle states/images, resident bytes and return | R3.28–R3.29, R3.32 |
| ST-102 | C64U seam review and host observations | Ownership seams pass; no speculative C64U code; metrics non-gating | R3.35, R3.37 |

## Test Categories and File Mapping

| Area | Specification files | Cases |
|---|---|---|
| Semantic/whole program | `compiler/src/semantic/{operations,cfg,whole-program}.spec.test.ts` | ST-49–ST-56 |
| SFA/ABI | `compiler/src/storage/{sfa,closure}.spec.test.ts` | ST-57–ST-60, ST-62 and the SFA-only half of ST-63 |
| Target/assets/machine/layout | `compiler/src/{target,assets,machine,layout}/*.spec.test.ts` | ST-61, layout half of ST-63, ST-64–ST-76 |
| Artifacts/publication | `compiler/src/{artifacts,publication}/*.spec.test.ts` | ST-77–ST-87 |
| Public services/CLI | `compiler/src/services/*.spec.test.ts`, `cli/src/*.spec.test.ts` | ST-88–ST-90 |
| Editor | Root boundary plus new package specification files | ST-91–ST-95 |
| M1 | `test/m1/*.spec.test.ts` and checked-in qualification inputs | ST-96–ST-102 |

Implementation tests use matching `*.impl.test.ts` files after GREEN. Integration is the real
compiler-service/CLI/LSP journey. End-to-end is ST-99/ST-101; no second harness is added. Existing
immutable specification tests are not edited to accommodate implementation. The sole pre-authorized
oracle transition replaces RD-02's now-superseded two-workspace/no-Vite foundation assertion with
RD-03's exact four-workspace/editor-only Vite rule before editor implementation; it may not weaken
any other foundation expectation.

## Verification Commands

| Checkpoint | Command |
|---|---|
| Directed compiler | `yarn workspace @blend65/compiler test <spec-or-impl-file>` |
| Directed CLI/editor | `yarn workspace @blend65/<package> test` |
| Boundary | `yarn vitest run test/import-boundary.spec.test.ts` plus the new RD-03 boundary file |
| Real ACME | M1 artifact test with discovered, version-probed ACME 0.97 |
| Real VICE | Sequential local M1 VICE 3.10 qualification only |
| Every phase checkpoint | `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test` plus the phase's directed/boundary/tool cases |
| Final Linux acceptance | `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test` plus real ACME and VICE |
| Artifact hygiene | `yarn prettier --check <touched files>` plus the repository whitespace check |
| Frozen authority | Read-only status proof that `spec/` is unchanged |

The actual v4 manifests have no lint command. Native Windows execution remains `Unknown` under
AR-C16 until RD-10. Security coverage is local: untrusted source/path/manifest/tool output,
canonical containment, symlink/ordinary-file identity, no shell/eval, bounded children,
cancellation and fail-closed publication. Authentication, authorization, network encryption,
CSRF, rate limiting, containers and secret infrastructure are N/A because RD-03 creates no network
service or infrastructure.
