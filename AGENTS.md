# blend65 — the Blend65 compiler & toolchain

## Overview

Blend65 is a statically typed 6502-family language and AOT compiler. This checkout
is the clean v4 rebuild. Specification 4.0 and the qualified expert baseline are
frozen. Current implementation ownership is
`codeops/features/blend65-v4/00-roadmap.md`; inherited v3 roadmaps are historical
reference only. RD-02 supplies project tooling, not a working compiler pipeline.

## Toolchain

- TypeScript 7.0.2: normal stable `typescript` package, ESM/NodeNext/ES2023, strict.
- Node 22; Yarn classic 1.22.22 workspaces; no `workspace:*` protocol.
- `tsc --build` and Turbo; Vitest for tests; Prettier for targeted formatting.
- No bundler, semantic linter, replacement linter, or preview compiler package.
- The working replacement must verify before its first implementation commit.

## Commands

Run from the repository root:

- `yarn install --frozen-lockfile`
- `yarn build` — Turbo invokes real package reference builds.
- `yarn typecheck` — checks use fresh dependency declarations.
- `yarn test` — owned workspace tests and direct root foundation/boundary tests.
- `yarn prettier --check <files>` — targeted touched-file formatting; do not
  reformat unrelated files.

Verification is impact-based. During implementation use directed tests. Before
a phase checkpoint run install, build, typecheck and the complete owned tests.
Markdown/skill-only changes validate formatting, links, source keys and the
relevant qualification cases, not the compiler suite. RD-02 has no assembler,
emulator, game corpus, historical acceptance tier or `lint` task.

## Project structure

- `packages/compiler/` — real `@blend65/compiler` project library.
- `test/` — structural and direct import-boundary tests.
- `spec/` — frozen Specification 4.0, never modified during implementation.
- `.agents/skills/blend65-domain-expert/` — frozen expert authority.
- `codeops/features/blend65-v4/` — active requirements and implementation plan.
- `codeops/features/blend65-expert-skillset/` and `blend65-c64u/` — separate owners.
- Other retained CodeOps features and `research/` — historical reference evidence.

No empty compiler stages or legacy copy are kept. The CLI package appears only
when its real behavior lands. Spec tests are `*.spec.test.ts`; implementation
tests are `*.impl.test.ts`.

### Package and frontend boundaries

The Phase 1 graph is `compiler -> jsonc-parser`. The later CLI uses only the
compiler public export. Node built-ins provide host operations.

Frontend/editor owners must never reach backend lowering, code generation,
serialization, packaging or emulator ownership, directly or transitively.
`test/import-boundary.spec.test.ts` enforces this on actual imports/re-exports
and non-vacuous synthetic graphs. No general linter replaces this direct test.

## Conventions

### Import & module resolution

- **ES Modules** — `import { x } from 'module'` (ESM throughout: `"type": "module"`, NodeNext).
- **Cross-package:** import from package names — `import { x } from '@blend65/compiler'`.
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
- **Aggregate-return direction:** Current v3 E10093/E10120 rejection of fixed struct/array returns
  is expressiveness debt, not a hardware or SFA law. Redesign toward a caller-owned hidden return
  destination closed through SFA, with direct construction/copy elision and complete alias,
  lifetime, nested-call, interrupt-domain, effect-order, and resource proof. Do not add a heap or
  generic runtime, and do not preserve an alien source restriction merely because current lowering
  lacks this ABI.

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

- **Integration branch:** `v3`; current rebuild work stays on `feature/v4-rebuild`.
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
  _floor_, not the goal. The generated code must **never be worse** than what an expert would
  hand-write for a routine (that floor is the scoreboard's 1.0 ratio), and must **beat** the
  expert's _realistic whole-program_ result — the win a compiler alone can take: global allocation,
  exhaustive strength reduction, cross-routine layout, perfect consistency, no fatigue, no
  hand-tuned routine left un-tuned. A capability whose generated code an expert would still beat is
  a defect, regardless of any feasibility snapshot or historical status claim.
- **Beat first; meet only as a last resort, and file the gap (NON-NEGOTIABLE).** The posture is to
  **beat** the expert. Settle for _meeting_ only when there is genuinely no way to beat it right
  now — and when you do, **file a GitHub issue** (the "file it" of the parity clause) that spells
  out exactly what it would take to beat after all: the missing optimization pass, IL form,
  allocation change, or platform-library primitive, with the measured cost delta. A "meet" is never
  a silent settle — it is a **tracked, reopenable debt with a written path to the win** (issue
  creation for this purpose is durably authorised — do not stop to ask; never push). This bar is
  raised deliberately: planning and implementation must be **forward-looking** — design each seam so
  the beat stays reachable, and never settle into a shape that can only ever meet. (Per-routine an
  expert can still hand-tune to the metal, so meeting is the honest _local_ floor; the strict beat
  is realised at program scale and by working those filed issues down.)
- **Data lives where the hardware reads it:** prefer placement, banking, alignment, pointer flips,
  and compile-time transformation over copying. Never copy or duplicate bytes merely for compiler
  convenience. Deliberate compile-time replication is allowed only when hardware visibility or a
  measured timing requirement makes it the best expert result, placement/banking/pointer changes
  cannot meet the same need, and the exact consumer, constraint, byte cost, and timing benefit are
  recorded. Hot paths never copy when compile-time placement or replication can solve the problem.
  Distinguish replicated identical data from buffers that hold different evolving states.
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
   alternatives. Offer an alternative only when it is genuinely viable _and_ materially different,
   kept minimal and clearly subordinate; never strawmen, never a confusing menu. A decision that is
   the compiler's or the plan's to make is simply made on the tagged recommendation, no prompt. A
   genuinely user-owned fork (scope, product intent, an irreversible or outward-facing action) is
   still surfaced — as one tagged recommendation with at most the minimal real alternative —
   because choosing it silently would be deciding on the user's behalf.

### Environment & dependencies

- Node.js 22 (pinned via `.nvmrc` + `engines`).
- Yarn classic (v1) — workspaces, no `workspace:*` protocol.
- Turbo (installed via yarn workspace dev dependency).
- **Selected assembler:** ACME 0.97 is the current terminal assembler for Blend65 output.
- VICE 3.10 and ACME govern later C64 execution qualification. They are not
  dependencies of the RD-02 foundation or its CI checks.
- **Environment variables:** none required for build/test. No `.env` file is used by
  the compiler/CLI.

### Project-specific

- **Compiler product boundary (NON-NEGOTIABLE):** Blend65 is a 6502-family language, AOT compiler,
  toolchain, and narrow target-platform library for games, renderers, tools, and any other software
  its qualified machines can support. Games are its primary workload and qualification case, but
  Blend65 is not a game engine, game framework, or gameplay library. Do not add built-in
  game loops, entity or fixed-pool modules, collision systems, state machines/dispatchers,
  renderers, scene graphs, sprite-multiplexer or scrolling engines, double-buffer managers, audio
  mixers/schedulers, or similar game-policy systems. The compiler must let developers write these
  normally in Blend65, lower them correctly, and optimize proved patterns where legal. The only
  game-oriented convenience owned by the toolchain is compile-time ingestion, validation,
  conversion, typing, and target integration of externally authored assets such as sprites,
  charsets, maps, images, and SID content. Asset handling may expose typed data, metadata, symbols,
  placement constraints, and an exact imported-player ABI; it must not supply a renderer, player
  scheduler, mixer, scene runtime, or gameplay policy. Typed zero-cost hardware operations and
  local timing/ownership contracts are general target-platform support, while low-level loaders
  and artifact packaging are general delivery support. Game examples and expert workloads are
  qualification oracles, not product APIs or support libraries.
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
- `spec/` is the FROZEN Specification 4.0 baseline. Do NOT modify any file under `spec/` during
  compiler implementation (decision D3). `git status --porcelain spec/` must stay empty.
- Honor the Blend65 Language Guard (`.clinerules/language-guard.md`) for any language-
  feature work: no feature enters the spec without passing all 23 rules.
- **Deferral-expiry gate (mandatory at every RD closeout).** Before an RD may close, answer in
  its closeout document: _"did this RD's deliverables expire any deferral's stated rationale?"_
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
  `codeops/features/blend65-v4/00-roadmap.md` (portfolio roll-up `codeops/00-roadmap.md`,
  numerically synchronized at integration). Read it
  at the start of every task; update it at each lifecycle transition (the `roadmap` skill drives this).
- Current CI verifies the owned foundation only; it has no emulator tier.
  Historical emulator results are not v4 qualification. Later local emulator suites
  must run sequentially so concurrent `x64sc` instances do not contend.

<!-- Foundation facts updated during RD-02 execution, 2026-09-17. Frozen product,
workflow and expert directives preserved. No compiler capability claim is made. -->

## CodeOps routing

CodeOps routing is configured in `codeops/codeops.json`, with project-local role definitions in
`.codex/agents/`. Routing may optimize execution and independent review, but it must never bypass
material ambiguity, readiness, verification, or review gates. If a configured role is unavailable,
use a bounded generic-agent packet or run inline while preserving the required gates and reviewer
count.
