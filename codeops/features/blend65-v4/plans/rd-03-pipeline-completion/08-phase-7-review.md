# Phase 7 Independent Review

> **Phase baseline**: `a510cbc74055e642cd40cd02b01f213114d04dcf`
> **Status**: Complete — no open critical or major finding
> **Scope**: Diagnostics-only editor bundle

## Verification Before Review

- Frozen install, repository build and typecheck passed.
- Compiler: 67 suites, 983 tests passed.
- CLI: 7 suites, 60 tests passed.
- Language server: 2 suites, 11 tests passed.
- VS Code: 2 suites, 6 tests passed.
- Root: 6 suites, 64 tests passed.
- All four immutable Phase 7 oracle hashes matched.
- Touched Prettier, `git diff --check` and the frozen `spec/` check passed.

## Findings

| ID | Severity | Lens | Evidence | Finding | Recommended correction | Status |
|---|---|---|---|---|---|---|
| RV-001 | 🟠 Major | Correctness / bounded resources | `packages/compiler/src/project/snapshot.ts:162`; `packages/language-server/src/server.ts:131` | Superseded analysis can continue complete directory inventory and open-document canonicalization loops without observing cancellation, delaying newer diagnostics. | Thread the existing signal through inventory/path traversal and check it around each awaited boundary plus each open-document lookup. Add no scheduler or cancellation framework. | ✅ Accepted 2026-09-21 |
| RV-002 | 🟠 Major | Correctness / stale state | `packages/language-server/src/server.ts:134`; `packages/language-server/src/server.ts:144`; `packages/language-server/src/server.ts:183` | A newest-request load failure or source omission can leave previously published diagnostics and document-to-project mappings visible. | Under the existing generation guard, clear omitted documents and stale mappings and publish only a safe current project failure when one exists. Add no diagnostic cache. | ✅ Accepted 2026-09-21 |
| RV-003 | 🟠 Major | Compatibility / simplicity | `package.json:8`; `packages/language-server/package.json:25`; `packages/vscode/package.json:43` | Vite 8.3.0 requires Node 22.12 or newer while the repository admits the full Node 22 line, so a declared host can fail installation or build. | Pin both editor workspaces to the already-supported Vite 5 line; do not tighten the frozen Node engine or add another bundler. | ✅ Accepted 2026-09-21 |

No separate security finding was reported beyond RV-001's bounded-resource impact. The reviewer was
read-only and made no file, commit or remote change.

## Accepted Corrections

| Finding | Correction evidence |
|---|---|
| RV-001 | The existing `AbortSignal` now reaches discovery, path validation, directory inventory, source reads and each open-document canonicalization. Focused path/inventory cancellation regressions pass. |
| RV-002 | Only the newest generation may clear omitted or failed project diagnostics and mappings. A real stdio regression proves an omitted source clears its old error and a later empty-project load replaces prior diagnostics with `PROJECT_EMPTY_SOURCES`. |
| RV-003 | Both editor workspaces now pin Vite `5.4.21`, which is already compatible with the repository's Node 22 range. Both Node bundles build and their package tests pass. |

Post-correction directed verification: compiler project-limit tests 12/12, language-server tests
12/12, VS Code tests 6/6 and Phase 7 root/foundation tests 22/22 passed. Repository build passed
with Vite 5.4.21 for both editor bundles.

## Fix-Only Re-Review

The permitted fix-only re-review found no surviving critical or major issue. It confirmed that the
accepted corrections cover cancellation, current-generation diagnostic cleanup and the compatible
Vite pin without adding a scheduler, cache, framework or architecture layer. The final cancellation
cleanup also preserves abort errors through host-error handlers and closes an opened directory on
every path.

## Final Qualification

- `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test` passed.
- Compiler: 67 suites, 985 tests passed.
- CLI: 7 suites, 60 tests passed.
- Language server: 2 suites, 12 tests passed.
- VS Code: 2 suites, 6 tests passed.
- Root: 6 suites, 64 tests passed.
- All four immutable Phase 7 oracle hashes matched.
- Touched-file Prettier, whitespace and frozen `spec/` checks passed.
