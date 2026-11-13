# Test tier and feedback-loop optimization — closeout

> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Status**: implemented and verified locally; no push.

## What changed

| Change | Effect |
| --- | --- |
| Range access checkpoints in `test/m1/vice-monitor.ts` | The saved-query purity test uses four range records instead of 8,194 per-address records. A positive control proves both ranges fire during startup. |
| `test/test-tiers.ts` and tier configs | Root tests are classified from imported helpers into `fast`, `integration` and `vice`; host files run in parallel, VICE stays serialized. |
| Compiler package configs | `*.impl` and `*.spec` tiers run separately; the complete package suite now runs four workers. |
| `test/build-cache.ts` | Shared profile/source-library helpers reuse identical successful builds. The key covers the complete project tree, compiler output, stdlib and ACME identity. |
| `scripts/test-changed.mjs` | Runs the fast tier, only the changed compiler areas, and changed root test files. `--host`/`--vice`/`--full` add the complete tiers. |
| `yarn test` / `yarn test:full` | `test` is the host checkpoint; `test:full` adds the serialized VICE tier. |

## Measured results

| Run | Before | After |
| --- | ---: | ---: |
| `test/rd05/input-saved-query-purity.spec.test.ts` | 28.1 min | 13.7 s (17 s process) |
| Root fast tier | — | 45 files / 1,282 tests, ~37 s |
| Compiler package fast tier | — | 160 files / 2,613 passed / 2 skipped, ~2m35 |
| Root integration tier | — | 175 files / 3,400 tests, 12m03 with 4 workers |
| Compiler package full suite | ~10m30 | 226 files / 3,808 passed / 2 skipped, 4m54 |
| Repeated cached test build | normal build | cache hit; runtime-switch test 2.8 s → 0.32 s of test work |
| VICE tier | — | serialized checkpoint; complete run in progress |

## Notes

- No test was deleted or skipped. The complete VICE tier remains the release gate.
- The fast classification is conservative: a file that imports a build helper is integration, and
  a file that imports a VICE helper is VICE.
- The cache only stores successful builds and is invalidated by compiler/stdlib/ACME/project
  content changes. It never caches a failure.
- `spec/` is untouched.
