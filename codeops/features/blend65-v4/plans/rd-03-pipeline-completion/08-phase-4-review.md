# Phase 4 Review: Machine Lowering and C64 Layout

> **Status**: ✅ Complete
> **Phase baseline tree**: `c5c117a4bb72c4ab1be4aaff4d55ea11c0ad8342`
> **Scope mode**: strict
> **Reviewed**: 2026-09-20
> **Expert baseline**: `blend65-domain-expert` 2.0.0 at
> `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`

## Immutable Oracles

| Specification oracle | SHA-256 |
|---|---|
| `packages/compiler/src/machine/lowering.spec.test.ts` | `f10ec0db94825c7b5252b20d42f4661f0e55cb63aaa3cd89728fab121706d018` |
| `packages/compiler/src/storage/closure-integration.spec.test.ts` | `d369a176c80a7f8aa9f227f324075f91f3a51ad2697472a7df38a90e2ed03197` |
| `packages/compiler/src/target/profile.spec.test.ts` | `5439c26dff38d584752bb7cf70b8488055b68c19110f9cc6b7854052cbff271c` |
| `packages/compiler/src/layout/c64-layout.spec.test.ts` | `ad15651d2b50278644cd8057e770a6d6fd817987d446e5d5a8a576af015f6caa` |

## Independent Review

The first independent 6502-semantics and expert-output review classified the implementation as
Incorrect. The user accepted AR-C23 and AR-C24, authorizing every direct correction.

| ID | Finding | Resolution |
|---|---|---|
| RV-001 | Physical branch fallthrough did not match semantic CFG order. | Lay out and repair exact physical blocks. |
| RV-002 | Calls did not implement the complete argument/result ABI. | Marshal arguments and results through certified homes. |
| RV-003 | Values used after calls or aliasing writes were not retained. | Capture them in finite SFA staging homes. |
| RV-004 | Word indirect memory had incorrect byte/order behavior. | Lower explicit low/high accesses with correct ordering. |
| RV-005 | Machine-created requests lacked truthful lifetimes. | Inventory their real overlap and call retention. |
| RV-006 | Layout ignored certified SFA overlays. | Place the certificate's physical homes, not logical requests. |
| RV-007 | Signed byte indices were extended incorrectly. | Emit sign extension before scaled addressing. |
| RV-008 | Sprite blocks were fixed before final placement. | Keep a symbolic placement-derived block fact. |
| RV-009 | Dynamic sprite indices could address outside eight hardware slots. | Apply the accepted modulo-eight mask; reject invalid constants. |
| RV-010 | Startup and hardware-stack evidence disagreed. | Use cooperative startup and account for every stack operation. |
| RV-011 | Branch repair did not use exact final instruction sizes. | Repair from exact structured block layout. |
| RV-012 | Instruction facts and validation were not form-sensitive. | Validate exact opcode/addressing-mode effects and cost. |
| RV-013 | Binding could invalidate the storage certificate. | Require exact certificate identity and reject new requests. |
| RV-014 | Lowering was a 2,155-line monolith. | Split it into focused direct modules without new architecture. |

## Fix-Only Re-review

The single permitted fix-only re-review confirmed the original corrections and found five remaining
critical counterexamples. The user accepted AR-C25. Each received the smallest direct correction.

| ID | Finding | Resolution |
|---|---|---|
| RV-FIX-001 | Aggregate parameters were marshalled as scalar bytes. | Marshal their certified two-byte addresses, including forwarded parameters. |
| RV-FIX-002 | A scalar load could be re-read after a call or same-place write. | Capture the value immediately in its existing argument-stage home. |
| RV-FIX-003 | A symbolic sprite block lost immediate form and cost after layout. | Resolve the provisional immediate after placement, then revalidate the final program. |
| RV-FIX-004 | Startup wrote DDRs before restoring their data latches. | Write and restore CPU/CIA2 data latches before their DDRs. |
| RV-FIX-005 | Word PEEK used unaccounted `PHA`/`PLA`. | Use one inventoried SFA low-byte temporary and return A-low/X-high. |

No further review cycle is permitted. Final acceptance rests on the exact regressions and full
repository verification below.

## Simplicity Check

The result remains one structured machine-record set with direct lowering, binding, branch repair,
startup and layout functions. No class hierarchy, registry, pass manager, optimizer framework,
second IR, heap, software stack, runtime service or game framework was added. Every changed
production and test file stays below 700 lines.

## Final Verification

| Check | Result |
|---|---|
| Five final counterexample regressions | PASS |
| Focused Phase 4 suites | PASS — 30 tests |
| Full compiler suite | PASS — 58 files, 931 tests |
| `yarn install --frozen-lockfile` | PASS |
| `yarn build` | PASS |
| `yarn typecheck` | PASS |
| `yarn test` | PASS — 1,044 tests |
| Immutable oracle hashes | PASS — unchanged |
| Prettier and whitespace | PASS |
| Frozen `spec/` | Clean |

All accepted findings are resolved. Phase 4 closes with legal NMOS lowering, certificate-bound
storage, exact branch layout, cooperative C64 startup and deterministic VIC-aware placement.
