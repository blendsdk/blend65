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
- **Linter/Formatter:** ESLint v9 (flat config) — enforced; Prettier — configured but unrun (see Commands)
- **Runtime:** Node 22 (pinned via `.nvmrc` + `engines`)

**Manifest files:** package.json, tsconfig.json, turbo.json

## Commands

All commands run from the repo root.

- **Build:** `yarn build` (turbo run build — `tsc --build` across all 10 packages)
- **Typecheck:** `yarn typecheck`  •  **Lint:** `yarn lint` (ESLint ONLY — `eslint .` per package)
- **Format:** ⚠️ Prettier is installed and configured (`.prettierrc.json`), and ESLint hands all
  formatting rules to it via `eslint-config-prettier` — but **nothing ever runs it**: no root or
  package script, no git hook, not in CI. Formatting is therefore unenforced end to end, and parts
  of the tree carry drift. Verify passing does NOT mean the diff is Prettier-clean. Run
  `npx prettier --check <files>` on files you touch and hand-fix what you added; do not
  `--write` whole files you did not otherwise change (it buries the real diff in reformatting).
- **Test:** `yarn test` (per-package unit tier, THEN the root R15 boundary tier — AR-P10);
  single package: `yarn workspace @blend65/<pkg> test`
- **Verify (run before every commit):**
  `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`
- **Clean:** TODO — no `clean` script defined (root, packages, or `turbo.json`); clean manually
  (`git clean -xdf packages/*/dist packages/*/*.tsbuildinfo`) or add a `clean` task to `turbo.json`.

## Project structure

Monorepo — Yarn workspaces + Turbo. Source in `packages/*/src/`; tests co-located as
`*.spec.test.ts` (spec tier) / `*.impl.test.ts` (logic tier, RD-02+), plus the repo-root `test/` cross-package boundary tier (`boundary.spec.test.ts`).

- `packages/` — the 10 `@blend65/*` packages (edges below)
- `spec/` — frozen spec-v3.0; DO NOT MODIFY during compiler implementation (D3)
- `examples/` — per-slice acceptance fixtures (gate + slice3a…slice8b), VICE-verified
- `codeops/` — nested CodeOps layout (marker `.codeops.yml`): `00-roadmap.md` (portfolio) + `features/blend65-ri/` (`00-roadmap.md`, `requirements/`, `plans/<rd-slug>/`) + `_archive/` (completed plans)
- `.github/workflows/` — CI (install → typecheck → lint → build → test; Node 22; no emulator tier)
- `docs/` — incl. the C64 game-feasibility matrix: `game-feasibility-matrix.json` (source of truth) rendered to an interactive `game-feasibility-matrix.html` by `scripts/gen-capability-matrix.mjs` (`yarn gen:matrix`); manual refresh via the `update_capability` skill
- `research/`, `scripts/` — research notes, repo tooling

### Package dependency edges (R15 boundary is load-bearing)

Private — `core` ← — · `frontend` ← core · `codegen` ← core, frontend · `platforms`, `config` ← core.
Public — `compiler` ← core, frontend, codegen, platforms, config · `cli` ← compiler, config, core · `language-server` ← core, frontend (**NEVER codegen** — R15) · `vscode` ← language-server · `test-harness` ← core, compiler (+ codegen **dev-only**).

> **R15 / AR-20 (load-bearing):** `frontend` and `language-server` MUST NOT import `@blend65/codegen`
> — enforced by ESLint `no-restricted-imports` (AR-P7) + `test/boundary.spec.test.ts` (ST-R15a/b/c).

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
- **Component pattern:** Compiler pipeline stages (Lexer → Parser → Analyzer → SFA →
  IL/Optimizer → Codegen → Emitter), each independently testable.
- **State management:** N/A (AOT compiler; no UI runtime state). SFA = static frame
  allocation, all allocation decided at compile time.

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
- **Meet or beat the expert — across the whole capability matrix (NON-NEGOTIABLE).** Parity is the
  *floor*, not the goal. The generated code must **never be worse** than what an expert would
  hand-write for a routine (that floor is the scoreboard's 1.0 ratio), and must **beat** the
  expert's *realistic whole-program* result — the win a compiler alone can take: global allocation,
  exhaustive strength reduction, cross-routine layout, perfect consistency, no fatigue, no
  hand-tuned routine left un-tuned. Steer every implementation decision so the programs and games
  the capability matrix (`docs/game-feasibility-matrix.json` → `.html`) tracks are **(a)**
  expressible in a modern way (audience directive #3) and **(b)** ship with output at or beyond
  that bar. A capability the matrix marks feasible but whose generated code an expert would still
  beat is a **defect, not a completed row** — reopen it.
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
   (build/typecheck/lint/test passing, a logical unit complete) with a properly-scoped message;
   never leave a broken tree committed. `spec/` stays frozen (D3) and default-branch work still
   branches first. **Pushing is never automatic** — it remains an explicit, user-initiated action.
2. **Update the roadmap without asking.** Whenever the roadmap
   (`codeops/features/*/00-roadmap.md`, portfolio roll-up `codeops/00-roadmap.md`) needs a
   lifecycle / stage / status change, make it as part of the work — no confirmation step.
3. **The user is a modern programmer, not an asm/retro expert.** Assume the people writing Blend65
   do **not** know 6502 assembly or 8-bit retro conventions. The compiler does the heavy lifting
   and offloads them: Blend65 must read and behave like a modern language as far as the hardware
   allows. **Any restriction that exists only because it was easy for the compiler — or that forces
   the user to think in hardware terms they should not have to — is a defect to reevaluate, not a
   rule to defend**; log it to the expressiveness ledger / conformance feature. This strengthens
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

<!-- analyze_project: refreshed 2026-07-17 (post-RD-18-closure) — Project structure: examples now gate+slice3a…slice8b; docs line names the game-feasibility matrix + update_capability skill. Toolchain/Commands re-verified unchanged against package.json (10 packages, yarn@1.22.22, scripts build/typecheck/lint/test), .nvmrc (22), turbo.json; no clean script — TODO still applies. -->

<!-- CODEOPS-ROUTING:START -->
## Model & effort routing (Opus-dominant)
- Tag each task trivial|standard|complex|sensitive (default complex) in make_plan — tags signal review depth, not model choice.
- Build lane → Opus @ xhigh. exec_plan runs phases inline on Opus; dispatch plan-task-executor-opus when a phase warrants its own context. Both executors are pinned to Opus, so no tag can route work to a weaker model.
- Critique lane → Fable @ xhigh: phase-reviewer, preflight-auditor, perf-auditor, security-auditor, design-challenger, spec-test-author. A different model family reviewing Opus's output is the point — don't collapse the two lanes onto one model.
- Agents run xhigh except codebase-scout (opus @ low — facts-only retrieval) and spec-test-author (fable @ high — it transcribes an already-enumerated case list, where extra reasoning mostly risks inventing expectations the spec never stated). Executors at xhigh deliberately overrides the CodeOps default cap of high: a 6502 compiler earns the extra thinking.
- Interactive skills: make_plan and exec_plan on Opus; grill_me and preflight on Fable. Sonnet is not used on this project. /compact after each phase; /clear on project switch.
<!-- CODEOPS-ROUTING:END -->

## Quality profile (CodeOps)
<!-- CODEOPS-QUALITY:START -->
lenses: [api-surface]
security_profile: []
perf_critical: false
review_hook: on
telemetry: on
agent_models: {phase-reviewer: fable, preflight-auditor: fable, perf-auditor: fable, security-auditor: fable, design-challenger: fable, spec-test-author: fable, codebase-scout: opus}
<!-- CODEOPS-QUALITY:END -->

<!-- Agent pins: .claude/agents/ holds project copies of all 9 CodeOps agents, forked from plugin
     3.10.0 with ONLY the `model:`/`effort:` frontmatter lines changed (effort can be set nowhere
     else — agent_models carries model alone). Bodies are byte-identical, so on a plugin upgrade
     re-sync with:
       for f in .claude/agents/*.md; do diff "$PLUGIN/agents/$(basename $f)" "$f"; done
     Anything beyond the two pin lines means the plugin's agent prompt moved and the fork is stale.

     Project and plugin agents COEXIST rather than shadow — both `phase-reviewer` and
     `codeops:phase-reviewer` resolve. The forks win because every dispatch reference in the
     CodeOps skills uses the bare name; dispatching a `codeops:`-prefixed name instead would get
     the plugin's own pins and silently bypass the effort settings here. Always dispatch bare.
     agent_models above is kept as a cheap net: it re-applies the model (never the effort) even
     on a prefixed dispatch. -->

<!-- Verified 2026-07-19 against plugin 3.10.0: a fable+xhigh agent dispatches without error, and
     all 35 agent references in the plugin's skills are bare. Note /agents no longer exists — to
     inspect pins, read .claude/agents/*.md directly. -->
