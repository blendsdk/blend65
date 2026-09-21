# Phase 5 Independent Review: ACME Artifacts and Publication

> **Status**: ✅ Accepted corrections implemented; single fix-only re-review completed
> **Baseline tree**: `5693703d9dd2c7eaff74e821d384a8173c860d7b`
> **Reviewed**: 2026-09-21
> **Lenses**: correctness, maintainability, standards, security, concurrency, artifact integrity,
> simplicity

## Verification Before Review

- `@blend65/compiler` build and typecheck passed.
- All 63 compiler suites and 950 tests passed, including real ACME 0.97.
- Prettier and `git diff --check` passed; `spec/` remained untouched.
- The authorized `access()` to `lstat()` specification-helper correction preserved the dangling
  symlink expectation; its frozen hash is recorded in the execution plan.

## Findings

| ID | Severity | Lens | Evidence | Required direct correction |
|---|---|---|---|---|
| RV-001 | Critical | Correctness / artifact integrity | `packages/compiler/src/artifacts/evidence.ts:102` | Validate every nested version-1 record and union exactly, including ordering, ranges, references and consistency; keep five direct entry points and add no schema framework. |
| RV-002 | Critical | Correctness / artifact integrity | `packages/compiler/src/publication/current-record.ts:111` | Validate all four JSON sidecars, exact filenames and unique roles, project-snapshot binding, primary artifact and cross-sidecar facts before a generation can become or remain current. |
| RV-003 | Critical | Concurrency / artifact integrity | `packages/compiler/src/publication/publication.ts:309` | Retain and immediately recheck staging/file and current-candidate identities, bytes, containment and ancestors before each rename; validate the committed generation before replacing current. |
| RV-004 | Critical | Concurrency / artifact integrity | `packages/compiler/src/publication/cleanup.ts:127`; `pins.ts:135` | Recheck exact directory/pin identities and protection state after checkpoints and immediately before deletion or unlink. |
| RV-005 | Major | Correctness | `packages/compiler/src/publication/publication.ts:292` | Recheck cancellation immediately before current replacement; preserve an already-renamed orphan generation while leaving prior current unchanged. |
| RV-006 | Major | Correctness / artifact integrity | `packages/compiler/src/artifacts/acme-output.ts:167` | Compare PRG bytes with an independent expected NMOS opcode/address/operand encoding, including branches and terminators. |
| RV-007 | Major | Correctness | `packages/compiler/src/tools/discovery.ts:111` | Accept only the exact 0.97 version, track timeout as failure and close the abort-listener race. |

## Simplicity Challenge

The independent reviewer reported no overengineering. A separate design challenge confirmed that
directly correcting all seven findings is the only completion path. The fixes group into four
narrow responsibilities: exact evidence validation, mutation-local filesystem identity checks,
publication cancellation, and independent ACME/discovery correctness. No new framework, service,
registry, dependency, injected filesystem or generalized transaction layer is justified.

## Ruling

The user accepted RV-001 through RV-007 on 2026-09-21. Implement only the direct corrections
listed above, add focused regressions, rerun Phase 5 qualification, then perform the single
permitted fix-only re-review. No larger machinery was approved or requested.

## Correction Result

All seven accepted findings were corrected with focused modules and no added dependency or generic
framework. Exact sidecar validation now includes canonical nested records, ordering, references,
cross-sidecar memory/asset/cost/debug agreement and a required semantic `byteWidth` for every debug
symbol. Publication, cleanup, pins and lock release retain and recheck the exact native identities
and bytes they are authorized to mutate. Cancellation is checked immediately before current
replacement. ACME discovery accepts only release 0.97, and artifact verification independently
encodes the admitted NMOS forms.

The single permitted fix-only re-review confirmed RV-003 through RV-007 resolved and reported two
remaining critical gaps within RV-001/RV-002 plus one stale oracle-hash record. Those final gaps
were corrected directly: canonical type spellings and all represented widths are now exact, and
debug memory pieces must match their symbol/asset or function/helper SFA ownership domain. The
authorized publication oracle hash was refreshed. No third review cycle was run.

## Final Verification

- `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test` passed.
- Compiler: 64 suites, 966 tests; CLI: 5 suites, 61 tests; root: 5 suites, 52 tests.
- Real ACME 0.97, process bounds, filesystem races, pins, cleanup and cancellation passed.
- Prettier and `git diff --check` passed; `spec/` remained untouched.
- Simplicity result: direct validators and focused responsibility splits only; no new package,
  dependency, service, framework, registry, transaction or injected-filesystem layer.
