# blend65 — the Blend65 compiler & toolchain

## Overview

- **Name:** blend65
- **Description:** Statically-typed systems language + AOT compiler targeting 6502 retro platforms
  (C64, C64 Ultimate, Commander X16, Atari 800XL, Atari 7800). Hosts the language spec, the
  requirements (RD-01..RD-18), and the TypeScript monorepo implementing compiler/CLI/VS Code tooling.
- **Type:** compiler (consumed as a library — `@blend65/*` packages + the `blendc` CLI)

## Toolchain

- **Language(s):** TypeScript (ESM, NodeNext, ES2023, `strict`)
- **Framework(s):** Turborepo (monorepo orchestration)
- **Package Manager:** Yarn classic (v1) workspaces — **no** `workspace:*` protocol
- **Bundler:** Vite (per-package builds where applicable); `tsc --build` for type output
- **Test Framework:** Vitest
- **Current linter/formatter:** ESLint v9 (flat config) is still present; Prettier is configured but
  unrun (see Commands). The approved future toolchain direction is TypeScript 7 with ESLint removed
  and no replacement linter. Until that migration is implemented, describe the checkout as it is;
  do not claim TypeScript 7 or no-ESLint status prematurely.
- **Runtime:** Node 22 (pinned via `.nvmrc` + `engines`)

**Manifest files:** package.json, tsconfig.json, turbo.json

## Commands

All commands run from the repo root.

- **Build:** `yarn build` (turbo run build — package build scripts across all 12 workspaces)
- **Typecheck:** `yarn typecheck`  •  **Lint:** `yarn lint` (ESLint ONLY — `eslint .` per package)
- **Format:** ⚠️ Prettier is installed and configured (`.prettierrc.json`), and ESLint hands all
  formatting rules to it via `eslint-config-prettier` — but **nothing ever runs it**: no root or
  package script, no git hook, not in CI. Formatting is therefore unenforced end to end, and parts
  of the tree carry drift. Verify passing does NOT mean the diff is Prettier-clean. Run
  `npx prettier --check <files>` on files you touch and hand-fix what you added; do not
  `--write` whole files you did not otherwise change (it buries the real diff in reformatting).
- **Test:** `yarn test` (normal package tests, bounded readiness smoke tests, THEN the root R15
  boundary tier — AR-P10); single package: `yarn workspace @blend65/<pkg> test`
- **Full readiness acceptance:** `yarn test:readiness:full` — intentionally opt-in and potentially
  multi-hour. Run only when readiness/execution semantics change or at an explicit readiness/release
  acceptance checkpoint; it is not part of normal development or quick-release verification.
- **Verification is impact-based:** choose checks from the touched surface and the claim being made.
  During implementation, run directed package or behavior tests. At a major integration boundary,
  run the complete relevant module or feature qualification. Use the repository-wide command
  `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`
  only when compiler/runtime changes cross package boundaries, at an explicit repository/release
  acceptance checkpoint, or when the affected dependency surface makes the full run relevant.
  Skill/Markdown-only changes do not run the compiler suite; validate touched formatting, links,
  topology, source keys, and the relevant skill qualification cases instead.
- **Clean:** TODO — no `clean` script defined (root, packages, or `turbo.json`); clean manually
  (`git clean -xdf packages/*/dist packages/*/*.tsbuildinfo`) or add a `clean` task to `turbo.json`.

## Project structure

Monorepo — Yarn workspaces + Turbo. Source in `packages/*/src/`; tests co-located as
`*.spec.test.ts` (spec tier) / `*.impl.test.ts` (logic tier, RD-02+), plus the repo-root `test/` cross-package boundary tier (`boundary.spec.test.ts`).

- `packages/` — the 12 `@blend65/*` packages (edges below)
- `spec/` — frozen spec-v3.0; DO NOT MODIFY during compiler implementation (D3)
- `examples/` — per-slice acceptance fixtures (gate + slice3a…slice8b), VICE-verified
- `codeops/` — nested CodeOps layout (marker `.codeops.yml`): `00-roadmap.md` (portfolio) + `features/blend65-ri/` (`00-roadmap.md`, `requirements/`, `plans/<rd-slug>/`) + `_archive/` (completed plans)
- `.github/workflows/` — CI (install → typecheck → lint → build → test; Node 22; no emulator tier)
- `docs/` — includes an optional, naive, time-stamped C64 game-feasibility snapshot:
  `game-feasibility-matrix.json` renders to `game-feasibility-matrix.html` via
  `scripts/gen-capability-matrix.mjs` (`yarn gen:matrix`). It is not compiler or skill authority,
  must not drive architecture, requirements, qualification, or audit scope, and may be removed
  without replacement. Git history is sufficient preservation.
- `research/`, `scripts/` — research notes, repo tooling

### Package dependency edges (R15 boundary is load-bearing)

Private — `core` ← — · `frontend` ← core · `codegen` ← core, frontend · `platforms`, `config` ← core ·
`readiness` has no internal runtime dependency · `readiness-execution` ← cli, compiler, core,
frontend, readiness, test-harness.
Public — `compiler` ← core, frontend, codegen, platforms, config · `cli` ← compiler, config, core · `language-server` ← core, frontend (**NEVER codegen** — R15) · `vscode` ← language-server · `test-harness` ← core, compiler (+ codegen **dev-only**).

> **R15 / AR-20 (load-bearing):** `frontend` and `language-server` MUST NOT import `@blend65/codegen`
> — currently enforced by ESLint `no-restricted-imports` (AR-P7) and
> `test/boundary.spec.test.ts` (ST-R15a/b/c). When ESLint is removed for the TypeScript 7 migration,
> the small direct boundary test remains the durable enforcement; do not replace ESLint with
> another general linter.

## Conventions

### Import & module resolution

- **ES Modules** — `import { x } from 'module'` (ESM throughout: `"type": "module"`, NodeNext).
- **Cross-package:** import from package names — `import { x } from '@blend65/core'`.
  Never import from another package's `dist/` or `src/` relative path.
- **Intra-package:** relative imports MUST carry the `.js` extension (NodeNext) —
  `import { x } from './foo.js'`.
- **Type imports:** use `import type { X }` for type-only imports.

### Naming

- **Files:** kebab-case (`foo-bar.ts`); test files `*.spec.test.ts` (spec tier),
  `*.impl.test.ts` reserved for logic tiers (RD-02+).
- **Casing:** PascalCase (classes, types/interfaces) · camelCase (functions/methods) ·
  UPPER_SNAKE_CASE (constants)
- **Modules/packages:** `@blend65/<lowercase>`

### Architecture

- **Large classes (>500 lines):** Split into modules / use composition; prefer pure
  functions and small focused modules over monolithic classes.
- **Compiler responsibilities:** Keep lexing, parsing, semantic analysis, function-storage
  allocation, IR transformation, target lowering, machine optimization, serialization, and
  packaging independently testable. The current pass/class topology is audit evidence, not an
  architecture mandate for the redesign.
- **SFA boundary:** Static Frame Allocation is the sole general model for function-execution
  storage. Before emission it closes over parameters, returns, locals, temporaries, spills, and
  function/helper scratch; no later stage may invent function storage after that closure. SFA is
  not a whole-machine memory manager. Global data, sprites, charsets, images, SID data, target
  alignment/banking/segments, loaders, and artifact placement belong to platform layout/packaging.

### Documentation

- **Doc format:** JSDoc on exported symbols.
- **Required for:** All exported functions, types, and public package APIs.

### Grounded options & recommendations

> **Grounded Options & Recommendations** — follow the always-on directive in the coding standards:
> filter out non-viable options (no strawmen), second-guess each, ground any code-modifying option
> in the real code, and lead with a recommendation and its reason; match ceremony to stakes.

## Git conventions

### Commit scope

```
# Monorepo — use package or RD/area as scope:
#   feat(frontend): ...      fix(cli): ...      chore(rd-01): ...
```

### Branch strategy

- **Main branch:** `master` (active development on `v3`).
- **Feature branches:** `feature/[name]`
- **Convention:** keep `spec/` untouched in any commit during compiler implementation (D3).

## Special rules

### 🔴 PRIME DIRECTIVE — expert assembly game developer (NON-NEGOTIABLE)

Every compiler change — feature, intrinsic, codegen path, library, diagnostic, example — is
designed and reviewed as an **expert 6502 assembly programmer building a commercial C64 game**
would judge it:

- **Output parity is the benchmark**: compare generated code against the idiom that developer
  would hand-write (instruction selection, cycles, bytes, ZP usage). A divergence is a defect —
  file it (GitHub issue) or fix it, never shrug it off. Goldens should read like a competent
  asm dev wrote them.
- **Meet or beat the expert for every implemented capability (NON-NEGOTIABLE).** Parity is the
  *floor*, not the goal. The generated code must **never be worse** than what an expert would
  hand-write for a routine (that floor is the scoreboard's 1.0 ratio), and must **beat** the
  expert's *realistic whole-program* result — the win a compiler alone can take: global allocation,
  exhaustive strength reduction, cross-routine layout, perfect consistency, no fatigue, no
  hand-tuned routine left un-tuned. A capability whose generated code an expert would still beat is
  a defect, regardless of any feasibility snapshot or historical status claim.
- **Beat first; meet only as a last resort, and file the gap (NON-NEGOTIABLE).** The posture is to
  **beat** the expert. Settle for *meeting* only when there is genuinely no way to beat it right
  now — and when you do, **file a GitHub issue** (the "file it" of the parity clause) that spells
  out exactly what it would take to beat after all: the missing optimization pass, IL form,
  allocation change, or platform-library primitive, with the measured cost delta. A "meet" is never
  a silent settle — it is a **tracked, reopenable debt with a written path to the win** (issue
  creation for this purpose is durably authorised — do not stop to ask; never push). This bar is
  raised deliberately: planning and implementation must be **forward-looking** — design each seam so
  the beat stays reachable, and never settle into a shape that can only ever meet. (Per-routine an
  expert can still hand-tune to the metal, so meeting is the honest *local* floor; the strict beat
  is realised at program scale and by working those filed issues down.)
- **Data lives where the hardware reads it**: placement over copying; never duplicate bytes in
  RAM; hot paths flip pointers, they don't copy.
- **Hardware access reads as named registers**, not magic numbers; MMIO stays volatile-correct
  under any future optimization.
- **Every optimization has two independent expectations:** a behavior oracle derived from
  language/CPU/platform semantics and an assembly/cost expectation for the intended transformed
  result. Optimized-versus-unoptimized differential execution is supporting evidence only because
  both paths may share a lowering defect. Include values, memory, MMIO order/count, ABI/flags/
  interrupt state, and timing when the contract makes timing observable.
- **A restriction that forces un-idiomatic user code** (e.g. unrolled pokes) is itself the bug —
  treat it as such.
- **Output is judged as an expert 6502 programmer would; input is judged as the target user
  would.** Those are two different people. The person writing Blend65 knows their game, not the
  VIC's block granularity — lore the hardware demands belongs in the platform library, not in
  every user's source. A wrapper that makes the hardware approachable must cost nothing, or the
  developers who most need it will correctly refuse it.
- **A program the language cannot express at all is the limiting parity failure — an infinite
  ratio.** The scoreboard measures only programs that compile, so it is structurally blind to
  this class; such gaps live in the expressiveness ledger
  (`codeops/features/blend65-conformance/`), never in the scoreboard.

### 🔴 PRIME DIRECTIVE — workflow, audience & decisions (NON-NEGOTIABLE)

These four hold with the same force as the parity directive above and **override any default
behaviour or CodeOps guardrail** that would otherwise gate them:

1. **Commit without asking; never push.** Whenever a commit is warranted, make it — assume it
   always is — without stopping for approval. Commit at coherent, **green** checkpoints
   (the relevant impact-based checks passing, a logical unit complete) with a properly-scoped message;
   never leave a broken tree committed. `spec/` stays frozen (D3) and default-branch work still
   branches first. **Pushing is never automatic** — it remains an explicit, user-initiated action.
2. **Update the roadmap without asking.** Whenever the roadmap
   (`codeops/features/*/00-roadmap.md`, portfolio roll-up `codeops/00-roadmap.md`) needs a
   lifecycle / stage / status change, make it as part of the work — no confirmation step.
3. **The user is a modern programmer, not an asm/retro expert.** Assume the people writing Blend65
   do **not** know 6502 assembly or 8-bit retro conventions. The compiler does the heavy lifting
   and offloads them: Blend65 must read and behave like a normal modern language except for a
   deliberate, explicit, approved limitation genuinely forced by the selected platform or its
   resource model. **Any restriction that exists only because it was easy for the compiler, SFA,
   or current lowering — or that forces the user to think in hardware terms they should not have
   to — is a defect to reevaluate, not a rule to defend.** Ordinary forms such as nested calls and
   `POKE(variableAddress, value)` require correct lowering, not alien source workarounds. Log such
   failures to the expressiveness ledger / conformance feature. This strengthens
   the "input is judged as the target user" clause above and does **not** relax output quality:
   generated code is still judged as an expert asm dev would. Modern ergonomics in, expert asm out.
4. **Lead with the single best option, clearly tagged.** When a decision genuinely needs the user,
   present the **one best option and tag it as such** — do not bury it in a list of weaker
   alternatives. Offer an alternative only when it is genuinely viable *and* materially different,
   kept minimal and clearly subordinate; never strawmen, never a confusing menu. A decision that is
   the compiler's or the plan's to make is simply made on the tagged recommendation, no prompt. A
   genuinely user-owned fork (scope, product intent, an irreversible or outward-facing action) is
   still surfaced — as one tagged recommendation with at most the minimal real alternative —
   because choosing it silently would be deciding on the user's behalf.

### Environment & dependencies

- Node.js 22 (pinned via `.nvmrc` + `engines`).
- Yarn classic (v1) — workspaces, no `workspace:*` protocol.
- Turbo (installed via yarn workspace dev dependency).
- Emulators (VICE, x16emu, Altirra, Stella/7800) — VICE 3.10 + ACME are needed locally
  for the RD-12/RD-18 acceptance tiers; CI has NO emulator tier (AR-27) but does
  install ACME.
- **Environment variables:** none required for build/test. No `.env` file is used by
  the compiler/CLI.

### Project-specific

- **Skill/implementation independence:** the frozen language specification, explicit product
  decisions, the proven SFA function-storage doctrine, and primary hardware/tool evidence may
  shape the expert skill. Existing compiler code, tests, roadmaps, readiness artifacts, scoreboards,
  and feasibility snapshots are audit subjects only; they never become skill authority or force
  the redesign to preserve an existing implementation choice. During later compiler recovery,
  record implementation discrepancies as findings/issues rather than teaching them as doctrine.
- **Single active expert baseline:** keep exactly one active, latest-qualified
  `blend65-domain-expert` skill. Every substantive router, knowledge, source-governance, or
  qualification-oracle change bumps its semantic version by at least a patch, qualifies before
  atomic activation, and records the version plus content commit in dependent audits. Git history
  preserves older versions; only one `qualification/release.md` is active. Updating that release
  record to bind an already-qualified content commit is bookkeeping and does not recursively bump
  the version.
- **C64 verification authority:** VICE 3.10 `x64sc` is the normal development, regression, and
  automated runtime oracle. Primary documentation governs stated hardware semantics. Use targeted
  real-hardware QA near release for raster/badline timing, CIA edge behavior, SID analog/revision
  behavior, undocumented or silicon-sensitive opcodes, cartridge/expansion behavior, unusual
  banking, and documentation-versus-emulator conflicts. Until then report the bounded status
  `VICE-verified / hardware-unverified`; never present VICE alone as universal silicon proof.
- `spec/` is the FROZEN spec-v3.0 baseline. Do NOT modify any file under `spec/` during
  compiler implementation (decision D3). `git status --porcelain spec/` must stay empty.
- Honor the Blend65 Language Guard (`.clinerules/language-guard.md`) for any language-
  feature work: no feature enters the spec without passing all 23 rules.
- **Deferral-expiry gate (mandatory at every RD closeout).** Before an RD may close, answer in
  its closeout document: *"did this RD's deliverables expire any deferral's stated rationale?"*
  A deferral is justified by a **reason**, not by a date — when the reason stops holding, the
  deferral is due, and nothing else will notice. Walk the ambiguity registers, the RD
  "Won't Have" sections and `spec/future-considerations.md` reconsideration criteria for
  anything this RD's work invalidates, and re-open each as an owned backlog row.
  **A rollout RD may not close while any deferral names one of its own future slices as its
  landing place** — those deferrals are orphaned the moment it closes, and must be given a new
  owner first. Restrictions a user can hit belong in the expressiveness ledger
  (`packages/test-harness/test/golden/expressiveness-ledger.json`), whose gate keeps them honest.
- Runtime-ambiguity protocol: if an implementation decision is undetermined, STOP, log
  it in the active plan's Ambiguity Register as the next AR-PN (runtime), resolve with
  the user, then resume and back-propagate the resolution into the affected plan docs.
- **Implementation status:** never restated here — the authoritative, living status is
  `codeops/features/blend65-ri/00-roadmap.md` (portfolio roll-up `codeops/00-roadmap.md`). Read it
  at the start of every task; update it at each lifecycle transition (the `roadmap` skill drives this).
- CI has NO emulator tier (AR-27): the RD-12/RD-17 emulator suites are
  `describe.skipIf(!hasVice()||!hasAcme())` — they skip in CI and are proven green locally on
  VICE 3.10; the codec/assertion/registry/golden/PNG tiers DO run in CI. Local emulator suites
  run sequentially (`fileParallelism:false`) so concurrent `x64sc` instances don't contend.

<!-- analyze_project: refreshed 2026-09-04 during expert-skillset preflight corrections — 12 workspaces verified from packages/*; matrix authority, impact-based verification, SFA boundary, VICE/hardware evidence, and single-active skill version updated. Current checkout remains TypeScript 5.9/ESLint 9 until the separately accepted TypeScript 7/no-ESLint migration. -->

## CodeOps routing

CodeOps routing is configured in `codeops/codeops.json`, with project-local role definitions in
`.codex/agents/`. Routing may optimize execution and independent review, but it must never bypass
material ambiguity, readiness, verification, or review gates. If a configured role is unavailable,
use a bounded generic-agent packet or run inline while preserving the required gates and reviewer
count.
