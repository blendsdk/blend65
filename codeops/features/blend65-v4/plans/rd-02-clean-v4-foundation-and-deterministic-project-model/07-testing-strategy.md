# Testing Strategy: RD-02 Foundation

> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P3–AR-P7

## Independent Oracles

Specification tests are authored from RD-02, frozen RD-01 authorities, the public
signatures, and the concrete cases below, without reading production code.
Write and demonstrate red before implementation, then green, then internal tests.
Existing v3 tests are not oracle inputs. New spec expectations never change to
make implementation pass. Parameterize related vectors rather than create a
task/file per input. Traceability identifiers stay in this document, not source
comments.

Coverage goal: direct proof of every accepted predicate, negative branch and
critical native-host interleaving, not an added percentage gate. Auth/rate-limit,
network/encryption, game execution, ACME and VICE tests are N/A: this local host
foundation owns none of those behaviors.

## 🚨 Specification Test Cases

### Transition and Pure Contracts — Phase 1

| ID | Input / scenario | Expected output | Source |
|---|---|---|---|
| ST-01 | Compare recorded v4 branch/base/parked v3 identity and frozen RD-01 inventory/release against current state; introduce a mismatching fixture | Valid identities pass; each mismatch fails without resetting/modifying worktrees or selecting a different authority | R2.1, R2.28; `03-01` Inventory |
| ST-02 | Enumerate inherited package/unit/test/example/script/workflow/fixture/codec/doc/CodeOps families and inventory decisions | All families have the RD-owned fields and one disposition; every retained dependency and port/adaptation has an owner and focused proof, no discarded dependency | R2.3, R2.4, R2.29 |
| ST-03 | Final tracked/configured tree contains readiness, unselected old tests, future-target/optimizer placeholder, ESLint/Vite/lint task, generated output or a legacy copy in a synthetic fixture | Structural proof rejects each operational surface; real final tree has none; historical prose/evidence labels are not mistaken for runtime dependencies | R2.5–R2.11; `03-01` Rejected Surface Removal |
| ST-04 | Load real workspace manifests/build outputs and execute the directed suites from a clean lockfile install | Actual owned packages have public behavior/exports, TypeScript major 7 stable `tsc`, Node 22/Yarn classic, strict declaration/map build, no empty-pass package; first foundation checkpoint is green | R2.2, R2.7–R2.12; `03-01` Root Toolchain |
| ST-05 | Synthetic frontend imports allowed project module; another directly imports backend lowering/codegen/serializer/packager/emulator | Allowed fixture passes; each forbidden edge fails; real frontend/editor owners are automatically scanned when they exist without an empty package | R2.13 |
| ST-06 | Frontend -> shared re-export -> backend; forbidden type-only and literal dynamic imports; nonliteral dynamic import | All forbidden transitive/type/dynamic edges fail; comments/non-import strings containing the same text do not fail | R2.13; `03-01` Direct Boundary Test |
| ST-07 | CLI imports compiler through package export versus another package's `src`/`dist` relative/private subpath; cyclic manifest fixture | Public export passes; private/undeclared cross-package edge and cycle each fail | R2.12; `03-01` Direct Boundary Test |
| ST-08 | Two baseline task runs, including fresh typecheck with deliberately stale dependency declarations | Task ownership builds fresh referenced dependencies; stale declarations cannot produce a false typecheck success; no manually ordered package runner or lint task | R2.8, R2.9; `03-01` Root Toolchain |
| ST-09 | Valid object with all ten keys, comments, trailing comma; another omits assetPaths/optimization/safety keys | Exact values load; defaults are `[]`, `balanced`, `false`, `false`; name spelling remains literal | R2.14, R2.15 |
| ST-10 | Each required key omitted; duplicate/unknown key; scalar/array root; wrong type; schemaVersion 0/2; invalid optimization; scripts/hooks/tools/globs/extensions | Failure diagnostics, no usable manifest; duplicate points to second key and relates first; malformed root/syntax suppresses dependent checks | R2.14, R2.21; `03-02` Manifest |
| ST-11 | Name vectors: empty, unpaired surrogate, forbidden separators/control/punctuation, dot names, trailing space/period, `NuL`, `NUL.txt`, `COM¹.map`; near misses `CONSOLE`, `COM0`, `COM10`, `LPT0`, `.temp`, `Game Ω 1.2` | Invalid vectors give their exact reason and escaped point at `/name`; all legal near misses and spelling pass unchanged, with no guessed length cap | R2.15, AC-13 |
| ST-12 | JSONC with BOM, ASCII/é/astral text preceding a bad field; duplicate fields; invalid UTF-8 input; valid byte positions over LF/CRLF/CR | Raw byte spans preserve BOM offset; astral text never shifts next span; coordinate conversion gives correct zero-based UTF-16 position; malformed encoding fails; invalid/mid-scalar conversion offset throws RangeError | R2.23, AC-22; `03-02` Public Signatures/Manifest |
| ST-13 | All nine normative target IDs, `c64u`, `cx16`, `a800xl`, `a7800`, `c64-pal`, unqualified combinations; entry `Foundation`, `Game.Render`, `src/main.blend`, empty/invalid identifier | Exact profiles and legal module identities pass; invalid profile is normative E10279; invalid entry is a field error, never interpreted as a filepath | R2.19, R2.20; `03-02` Manifest |

### Contained Project Service — Phase 2

| ID | Input / scenario | Expected output | Source |
|---|---|---|---|
| ST-14 | Caller at project root/nested directory/unrelated directory; explicit relative and absolute manifest; invalid nearer/explicit manifest with valid parent project | Nearest or explicit manifest wins; manifest directory is root; unrelated discovery fails; no fallback from invalid explicit/nearer input | R2.16 |
| ST-15 | Manifest content absolute path, lexical `../outside`, canonical symlink escape, root-prefix sibling; contained internal `..` path | Escapes/absolute input fail; component-based containment admits the contained path; explicit absolute project selection remains allowed | R2.17; `03-02` Discovery and Containment |
| ST-16 | Missing contained outDir, occupied parent/component file, explicit sourceRoot/assetPath inside logical/canonical outDir | Missing output validates but creates nothing; file/type/explicit output-input conflict fails; no output/staging publication operation is invoked | R2.17, R2.25; corrected AC-15 |
| ST-17 | sourceRoot `.` with valid source and nested outDir containing prior generations and unreadable content; canonical alias to output | Output subtree is excluded before traversal/read; prior generations cannot change source hashes/IDs or trigger input errors | R2.18, R2.22 |
| ST-18 | Fixture files created in different order: `.blend`, `.BLEND`, `.txt`, names with case/spaces/Unicode; POSIX-admitted `NUL.blend`/`a:b.blend` | Only exact `.blend` regular sources are collected; stable UTF-8 relative-name ordering and original spelling; output basename rules never reject admitted source names | R2.18, AC-13, AC-16 |
| ST-19 | Contained source symlink, outside symlink, recursive directory cycle, two logical source names for same resolved file or hardlink identity | Valid single contained source passes; outside/cycle/alias each fails the whole load with related input locations, no partial result | R2.17, R2.18; `03-02` Discovery and Containment |
| ST-20 | Wrong-type/special file, unreadable source/directory, disappearing source; effective native permission fixture | Structured root failure, no stack/absolute-path leak or partial snapshot; native permission behavior is actually exercised, not masked by root or skipped | R2.17, R2.18, R2.24; `03-03` Verification |
| ST-21 | SourceRoot has no `.blend` input | `PROJECT_EMPTY_SOURCES`, failure arm, no snapshot or output | AC-16; `03-02` Inventory and Bounds |
| ST-22 | Rename a source without changing its bytes; two sources contain identical bytes but different admitted names | Content hash unchanged; path/source IDs and combined input identity reflect exact names; no fabricated module-name/header interpretation | R2.19, R2.23 |
| ST-23 | Two byte-identical project copies at different roots/cwd and different creation/enumeration order | Identical ordered IDs, per-file hashes, inputSha256, and diagnostic fields; host-only resolved paths/root differ but never enter identity | R2.22, R2.23; `03-02` Snapshot and Identity |
| ST-24 | Known raw manifest/source UTF-8 bytes, including BOM; successful returned record/array mutation attempts | Exact lowercase SHA-256; input hash reproduces the fixed versioned array encoding; BOM/text preserved; nested public objects/arrays are frozen and no mutable bytes are exposed | R2.22, R2.24; `03-02` Snapshot and Identity |
| ST-25 | Replace/change/remove a source or manifest between inventory/read/revalidation; add source during collection | Entire attempt is discarded; complete stable retry succeeds or bounded failure occurs; no old manifest/new source or missing added-file mixed snapshot | R2.22, AC-20; `03-02` Snapshot and Identity |
| ST-26 | Swap source/path/symlink identity between resolution/open/read/revalidation | Containment/handle identity guard rejects unsafe observation, discards entire attempt and closes handles; no accepted outside-root data or absolute-path diagnostic leak | R2.17, R2.22; `03-02` Discovery and Containment |
| ST-27 | Internally lowered limits at exact maximum and maximum+1 for manifest/source/total bytes, source count, visited entries, depth; growth during bounded read | Boundary passes; each excess returns named maximum/observed diagnostic before unbounded allocation/traversal; no partial snapshot | AC-25; `03-02` Inventory and Bounds |
| ST-28 | Controlled input changes invalidate each of three complete attempts | `PROJECT_CHANGED` once, failure/no snapshot; attempt four never begins; invalid schema/type/escape does not retry | R2.22; `03-02` Snapshot and Identity |
| ST-29 | Invocation target/entry override with valid and invalid manifest/override values | Manifest remains unchanged; successful snapshot records overrides and effective values; input identity binds overrides; invalid manifest is not repaired by override | R2.20; `03-02` Manifest/Snapshot |
| ST-30 | Several independent manifest errors and a root syntax/path failure across repeated runs | Independent errors retain deterministic ordering; root failures suppress only causal downstream errors, no nondeterministic stack or partial result | R2.24; `03-02` Project Diagnostics |
| ST-31 | Invalid source encoding, read error, unexpected output contents; observe all attempted writes | Expected failures are typed values; outDir remains untouched for every success/failure; no asm/binary/report or host temporary data appears there | R2.25, AC-23 |

### CLI and Qualification — Phase 3

| ID | Input / scenario | Expected output | Source |
|---|---|---|---|
| ST-32 | Public installed/bin `blendc --help`, `-h`, `--version`, `-v` outside a project | Exit 0, truthful help/version matching metadata, no project read and no semantic/build/run claim | R2.24; `03-03` CLI Shell |
| ST-33 | Public bin invoked with minimal example, nested cwd, and explicit manifest/overrides | Shared service result; exit 0, specified project-loaded/no-compilation line; recorded effective invocation does not mutate manifest | R2.12, R2.16, R2.20, R2.30; `03-03` CLI Shell |
| ST-34 | Public bin with invalid manifest/path, missing project, and names containing terminal controls in diagnostics | Exit 1; ordered shared diagnostics on stderr, no success line/source upload/stack/absolute root/control-sequence leak; output remains untouched | R2.24, R2.25; `03-03` CLI Shell |
| ST-35 | `check`, `build`, `run`, raw source positional; unknown/repeated/missing-value option; help+version | Exit 2, `CLI_INVALID_ARGUMENT` and usage; no loader/tool/output call; standard separate/equal string options remain accepted | R2.24; `03-03` CLI Shell |
| ST-36 | Run complete foundation commands on actual Node 22 Linux x64 and Windows x64 | Both native results recorded, required paths/aliases/permissions/races covered; Linux simulation and skipped fixture cannot stand in for Windows proof | AR-048, AC-15, AC-26; `03-03` Verification |
| ST-37 | Runtime/platform fixtures Node 22 production hosts, other supported 64-bit host, 32-bit/unknown arch, Node 20/24 | Declared production combinations succeed without warning; best-effort has observation; unsupported combinations fail with PROJECT_HOST_UNSUPPORTED | AR-048; `03-03` Verification |
| ST-38 | Final existing CI configuration and new root suites | Only foundation install/build/typecheck/test on both native hosts; no lint, ACME, VICE, readiness, scoreboard, remote-cache product or new service | R2.27; `03-03` Verification |
| ST-39 | Record real example discovery/JSONC/inventory/snapshot/build/test/memory observations, including an intentionally large duration observation | Separate host/input/tool identities and phase values recorded; no value changes qualification PASS/FAIL; no synthetic scale suite/benchmark framework | R2.28; `03-03` Observations |
| ST-40 | Compare final spec/expert hashes with RD-01; walk deferral rationales and active ownership; provide an expired-rationale closeout fixture | Frozen identities unchanged; exactly active owned work is clear; expired rationale is reopened with owner before closeout, never silently implemented; no orphan RD-02 landing deferral | R2.6, AC-28, AC-29; `03-03` Closeout |

## Test Ownership

| Files / phase | Cases |
|---|---|
| `test/foundation.spec.test.ts`, `test/import-boundary.spec.test.ts` / 1 | ST-01–ST-08 |
| `compiler/src/project/manifest.spec.test.ts`, `basename.spec.test.ts`, `positions.spec.test.ts` / 1 | ST-09–ST-13 |
| `compiler/src/project/discovery.spec.test.ts`, `paths.spec.test.ts`, `inventory.spec.test.ts` / 2 | ST-14–ST-22, ST-26–ST-27 |
| `compiler/src/project/snapshot.spec.test.ts`, `diagnostics.spec.test.ts` / 2 | ST-23–ST-31 |
| `cli/src/main.spec.test.ts`, `bin.spec.test.ts`; extend root foundation spec before Phase 3 implementation / 3 | ST-32–ST-40 |

Package paths above are relative to `packages/`. Root structural cases that
already pass before implementation record why; others must fail on an actual
contract violation, not merely an unrelated import failure. Bind content-commit
proof after the first green checkpoint without making prospective hash values a
red-test tautology. Phase 3 additions to root spec are authored before Phase 3
implementation and do not weaken Phase 1 oracles.

Implementation tests, written afterwards, cover internal JSONC-tree walking,
offset/BOM conversion, diagnostic ties, handle cleanup, bounded traversal and
retry seams, import-reader syntax, and CLI adapter errors in focused `*.impl.test.ts`
files. Native temporary trees are real. Inject only filesystem race/read failures
that real deterministic interleavings cannot express, through a small internal
function parameter; do not mock the whole project service or add a public host.

CLI E2E uses Node `execFile` against the built bin and a real minimal project.
Use no shell command strings, emulator, custom E2E runner, or benchmark harness.

## Validation of the Plan Itself

Before committing this plan, validate touched Markdown formatting/local links,
schema/RD mapping, task parsing/uniqueness, register closure and specification-first
ordering. Those documentation checks are not implementation PASS or preflight
evidence. Execution records actual red/green/native-host results as tasks complete.
