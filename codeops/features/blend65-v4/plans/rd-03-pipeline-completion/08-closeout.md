# RD-03 Pipeline Qualification

> **Status**: Linux implementation complete and VICE-verified; native Windows
> DEF-3 qualification in progress
> **CodeOps Artifact Schema**: 1

## Result

The public compiler builds the checked-in M1 game, ACME 0.97 assembles it, and VICE 3.10 passes the
complete 441-input journey. Generated and expert runs match in rendered frames, logical state,
ordered device traffic, restoration and BASIC return. The result is
`VICE-verified / hardware-unverified`.

The strengthened rendered-frame oracle exposed a compiler timing defect, not a VICE defect. The
bounded lowering corrections closed it without changing the language, adding runtime machinery or
building a general optimizer framework. The defect tracked by GitHub issue #80 is resolved by this
evidence; changing the issue's remote state requires separate explicit authorization.

RD-03 is not formally Done because AR-C16/DEF-3 still requires native Node 22-or-newer Windows x64
qualification during RD-10, when the user supplies access. That deferred evidence does not block
RD-04 through RD-09.

## Frozen Qualification Inputs

| Input | SHA-256 |
|---|---|
| Pipeline specification oracle | `9bdb81370f21037c28437e77d142b0bab848434b2162da39be55640f612de0d7` |
| VICE specification oracle | `62b0839357d2bb80d935f4bf711ae0a50964dfde67002b8a2b590940eb1b8c3d` |
| Expert ACME twin | `4580188de595b1968c4e034244b1141a86ca68b1f9817e883338c17de5806317` |
| Expert ledger | `95352a5c4e5cc1db209a330f514eec71931f16737f427cff35f17e753f9747ff` |
| Executed expert runtime evidence | `d0d4627bad03c89e67f252d5737abd569b651dee0f3583f47160c7adfd36bfa9` |
| Raw sprite fixture | `c590c49d0e0aae8a20b39e2f6246c530bb7f52fe8b4c21131ec09a442509f68a` |
| Fixed win trace | `01dba080800f2984d7a424748ecfcb02bf03da9ccce2b515c88d72cb6a02792b` |
| Independent behavior oracle | `7ea949a34ecde626f80ddb373858f09b8be8ebedd9cd544936eacf431789a5e3` |

Expert authority is `blend65-domain-expert` 2.0.0 at content commit
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`.

## Linux Acceptance

Observed on 2026-09-23 using Node 22.23.1, Yarn 1.22.22, ACME 0.97 and VICE 3.10 on Linux x86_64.

| Check | Result |
|---|---|
| Frozen install, repository build and typecheck | PASS |
| Compiler, CLI, language-server and VS Code tests | PASS |
| Root boundary and M1 tests | PASS: 8 files, 68 tests |
| Real M1 ACME build and eight-file publication | PASS |
| Sequential VICE fixed-trace qualification | PASS: generated and expert, 441 inputs |
| Exact rendered-frame comparison | PASS |
| State, eight sprite slots and resident asset | PASS |
| Exact ordered M1 game-loop device traffic | PASS |
| Machine restoration and BASIC return | PASS |
| Touched-file Prettier and whitespace | PASS |
| Frozen `spec/` worktree | Clean |
| Lint | Not configured in the actual checkout; no result is claimed |

Verification ran as:

```text
yarn install --frozen-lockfile
yarn build
yarn typecheck
yarn test
```

The documented lint commands were also checked, but this checkout has no root/package lint script,
Turbo lint task or ESLint executable. This is a configuration/documentation gap, not a compiler or
M1 failure.

## Expert Baseline Ruling

| Dimension | Expert | Generated `none` | Result |
|---|---:|---:|---|
| Behavior, rendering, restoration and return | Required | Complete trace passed | Meets |
| PRG body including placement padding | 6,655 bytes | 6,655 bytes | Meets |
| BASIC stub, startup/restore and function code | 1,268 bytes | 3,551 bytes | Worse by 2,283 bytes |
| Resident non-code data including one sprite payload | 636 bytes | 632 bytes | Better by 4 bytes |
| Zero page | 0 bytes | 4 bytes | Worse by 4 bytes |
| Static mutable general RAM | 106 bytes | 142 bytes | Worse by 36 bytes |
| Program-owned hardware-stack peak | 2 bytes | 6 bytes | Worse by 4 bytes |
| Interrupt entry/save bytes | Not independently measured | 6 bytes | Not comparable |
| Platform stack reserve | Not independently measured | 20 bytes | Not comparable |
| Qualified stack capacity account | Not independently measured | 32 bytes; 224 bytes headroom | Not comparable |
| Runtime asset copying | 0 bytes | 0 bytes | Meets |
| Complete fixed-trace cycles | Pending | Unknown | Not comparable |

The equal PRG body size comes from the required sprite placement at `$2000`; it does not erase the
local code and storage differences. AR-P9 and AR-P10 reduced generated code from 3,961 bytes
including the BASIC stub to 3,551 bytes while fixing observable timing. The remaining output gaps
stay explicit RD-08 inputs under AR-P2.

## Optimization-Readiness Check

The timing correction does not move the compiler away from expert output:

- It recognizes a normal affine array loop, initializes an existing pointer once and advances it by
  the proved element stride.
- It falls back when loop shape, aliasing, effects, wrap safety or aggregate identity is uncertain.
- It adds no M1 identity, public API, runtime helper, new storage class, general framework or
  dependency.
- It preserves structured semantic and machine forms that later peephole and whole-program
  optimization can consume.
- It reduced code by 410 bytes across the final two steps and did not increase zero-page use.

The remaining code, RAM and stack differences are tracked for RD-08 rather than hidden or accepted
as production-quality parity.

## Early C64U Seam Review

| Required seam | Result |
|---|---|
| Target-neutral shared semantics | PASS: symbolic places, effects and capability identities contain no C64 address or opcode fact. |
| Independent target components | PASS: CPU, machine, serializer, packager and execution-storage facts remain separate. |
| Future memory identity | PASS: semantic storage remains symbolic; platform layout owns address spaces and placement. |
| DMA and clock ownership | PASS: these remain target/profile and RD-10 concerns, not shared semantics or SFA. |
| Editor boundary | PASS: frontend and language server do not import backend modules. |
| Product honesty | PASS: no selectable C64U target, copied backend or support claim exists. |

## Deferral-Rationale Walk

**Did this RD's deliverables expire any deferral's stated rationale? No.**

| Reviewed item | Result / continuing owner |
|---|---|
| Complete Specification 4 coverage | Remains RD-04; M1 does not turn missing valid forms into accepted restrictions. |
| Broader C64 workload support | Remains RD-05. |
| Native SpritePad and asset composition | Remain RD-06; no producer access was assumed. |
| Loadable assets and D64 delivery | Remain RD-07. |
| General expert-output optimization | Remains RD-08; Phase 8 only fixed behavior-relevant bounded patterns. |
| Production developer tooling | Remains RD-09. |
| Native Windows qualification | DEF-3 remains owned by RD-10; a Windows host is now available and qualification is in progress. |
| `spec/future-considerations.md` criteria | M1 did not establish demand that expires FUT-006/007, FUT-011/012 or FUT-015–018. |
| Expressiveness restrictions | No deliberate user-facing restriction was accepted; valid Specification 4 forms remain RD-04 obligations. |

No deferral names a future RD-03 slice as its landing place. Every continuing item has an owner.

## Simplicity Check

The final timing work added one focused lowering module for the proved loop shape. It did not add a
pass framework, optimizer mode, emulator abstraction, benchmark framework, asset framework, C64U
scaffold, Windows substitute, game engine or reusable gameplay module. The broader problems remain
with their existing RDs.

## Windows Diagnostic Checkpoint (2026-10-01)

Native Windows x64 with Node 24.18.0, Yarn 1.22.22 and the user-supplied ACME
0.97 now installs, builds and typechecks. Direct `acme.exe` discovery succeeds;
the public M1 pipeline suite passes 3/3, the behavior suite 6/6, and the CLI,
language-server and VS Code suites pass 62/62, 14/14 and 6/6 respectively.
Before Developer Mode, the compiler suite reported 1,552 passing, 43 failing
and nine skipped tests: 23 failures were symlink-fixture `EPERM`, and the rest
concentrated in Unix-script fake tool fixtures and Windows VICE cases. After
Developer Mode, the project suite passes 565/565 and publication passes 18/18.
A complete native Windows compiler repeat with ACME on PATH now reports **1,595
passing and nine host-specific skips** across 108 files. The former 20 fake-tool
failures are resolved by a test-only native PE launcher compiled on Windows;
the original shebang path remains in use on Linux. A checked-in Job object in
that launcher terminates its Node fixture child when the launcher stops. Windows
direct-spawn ACME arguments/output, all four VICE profiles, cancellation,
bounded uncertain cleanup and pin behavior pass. Windows cannot unlink a running
PE image to reproduce the Unix probe-then-vanish interleaving, so that case is
replaced by a direct native vanished-executable start classification. The root
Windows tier runs 56 direct foundation/import-boundary cases; later RD-04/05
root release and VICE monitor cases remain Linux-owned. An isolated WSL Linux
checkout passed all 1,604 compiler cases with one Windows-only skip, plus build,
typecheck and all 56 direct root foundation/boundary cases. This preserves the
Linux fake-tool process-group and release-corpus selection.

The current `.github/workflows/ci.yml` installs checksum-pinned ACME only in
the Ubuntu job, although its Windows job also runs `yarn test`. The locked RD-02
foundation oracle requires the same command on both hosts, so the workflow was
left unchanged. Pinned Windows ACME 0.97 provisioning remains required before a
hosted CI run can be claimed. The official SourceForge Windows archive could not
be retrieved from this host, so no unverified download or checksum was committed.

The publication suites pass 18/18 native cases, including competing builds,
reader pins, current-record replacement, cancellation, malformed symlink pins
and bounded cleanup. The later RD-04 root backend publication suite passes 8/9
when invoked explicitly on Windows; its remaining case uses a Unix-script fake
assembler. That file remains in the Linux-owned root release corpus, outside
the Windows foundation/import-boundary root tier. Real ACME-backed publication
succeeds.

The supplied VICE bundle identifies itself as 3.10 through `NEWS` and
`c1541.exe -version`, but `x64sc.exe` produces no captured `-version` banner.
The user approved AR-P11's exact-bundle exception: direct `x64sc.exe -version`
still runs first, and an empty successful result is accepted only after the
adjacent `c1541.exe -version` reports 3.10 and pinned executable/ROM hashes
match. The built probe returns `true` for the supplied bundle. The full M1 Linux runtime helper also uses
Linux process and socket attestation; the RD-10 host matrix assigns the deep C64
journey to Linux and requires separate Windows tool/process smoke evidence.
Native Windows process smoke now confirms that `launchVice` cancels the real
`x64sc.exe` and leaves no emulator process. A public `runProject` cancellation
after publication leaves `current.json` intact, removes its exact pin and leaves
no `x64sc.exe` process. This proves the direct child path; broader process-tree
fault fixtures remain. The installed VS Code is now 1.140.0, within the extension
manifest's `^1.138.0` range. An isolated native extension-host run loaded the built
`dist/extension.js`, activated the Blend65 extension, recognized `src/game.blend`
as `blend65`, launched its language server, and published the canonical `E10239`
undeclared-name diagnostic from a valid project. VS Code's extension-test host
exited zero. Final evidence review remains; DEF-3 stays open for process-tree
qualification and hosted CI ACME provisioning.

## Remaining Native Windows Evidence

Qualify Windows process-tree cancellation beyond the proven direct VICE child,
provision pinned ACME for the hosted Windows CI job, and complete final independent
evidence review. The native project, compiler suite, publication, ACME/VICE
discovery, direct process cleanup, CLI, language-server and VS Code extension-host
checks above pass. Move RD-03 from Blocked to Done only when the remaining
acceptance evidence passes.
