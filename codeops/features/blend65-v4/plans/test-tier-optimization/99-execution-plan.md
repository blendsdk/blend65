# Test tier and feedback-loop optimization

> **Owner**: v4 developer workflow and release-checkpoint evidence.
> **Scope mode**: strict. Test execution and test-only caching; no compiler behavior, no frozen
> `spec/` change, no oracle weakening.

## Goal

Make the inner edit loop minutes rather than hours without deleting coverage. Keep the complete
corpus as an explicit checkpoint and release gate, and keep VICE serialized.

## Tasks

- [x] T-1 Collapse the saved-query purity proof from 8,194 per-address VICE checkpoints to four
      address-range checkpoints, with a positive control proving both ranges fire during startup.
- [x] T-2 Classify root tests into `fast`, `integration` and `vice` from their imported helpers.
- [x] T-3 Add separate Vitest configs: fast, integration, host (fast + integration) and VICE.
      Fast/integration run in parallel with four workers; VICE stays serialized.
- [x] T-4 Split compiler-package implementation and public-build tests, and enable parallel
      package execution.
- [x] T-5 Add `test:fast`, `test:host`, `test:integration`, `test:vice`, `test:changed`,
      `test:package` and `test:full`. Make `test` the host checkpoint and `test:full` the complete
      checkpoint including VICE.
- [x] T-6 Add a content-addressed test build cache for the shared profile and source-library
      helpers, keyed by the complete project tree, compiler output and assembler identity.
- [x] T-7 Update `AGENTS.md` with the new commands and the checkpoint boundary.
- [x] T-8 Verify the fast, integration, compiler-package and VICE tiers.

## Acceptance

| Tier | Boundary | Evidence |
| --- | --- | --- |
| Fast | Pure host root tests + compiler implementation tests; no ACME/VICE | completes in minutes |
| Integration | Real public builds/ACME, no emulator | parallel, all files pass |
| VICE | Every emulator-driving test | serialized; complete suite remains the release gate |
| Full | Packages + host + VICE | `yarn test:full` |
| Purity outlier | Same proof, range checkpoints | positive control + full query proof |

## Constraints

- No test is deleted or skipped to obtain speed.
- VICE remains sequential; concurrency limits stay bounded.
- Cache entries are invalidated by compiler, stdlib, assembler or project-tree content changes.
- `spec/` remains untouched.
