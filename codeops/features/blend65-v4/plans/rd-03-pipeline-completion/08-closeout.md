# RD-03 Pipeline Qualification

> **Status**: Linux implementation complete and VICE-verified; formal RD-03 closeout waits only on
> DEF-3 native Windows evidence during RD-10
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

RD-03 is not formally Done because AR-C16/DEF-3 still requires native Node 22 Windows x64
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
| Native Windows qualification | DEF-3 remains owned by RD-10 because no Windows host is available. |
| `spec/future-considerations.md` criteria | M1 did not establish demand that expires FUT-006/007, FUT-011/012 or FUT-015–018. |
| Expressiveness restrictions | No deliberate user-facing restriction was accepted; valid Specification 4 forms remain RD-04 obligations. |

No deferral names a future RD-03 slice as its landing place. Every continuing item has an owner.

## Simplicity Check

The final timing work added one focused lowering module for the proved loop shape. It did not add a
pass framework, optimizer mode, emulator abstraction, benchmark framework, asset framework, C64U
scaffold, Windows substitute, game engine or reusable gameplay module. The broader problems remain
with their existing RDs.

## Remaining Native Windows Evidence

During RD-10, with user-supplied Windows x64 access, run portable publication, competing
publication, generation pin/cleanup, ACME/VICE discovery and process cleanup, CLI, language-server
and VS Code bundle smoke checks under Node 22. If they pass, move RD-03 from Blocked to Done. No
earlier Windows access or replacement infrastructure is required.
