# Ambiguity Register: RD-16 — Compiler Configuration (`blend65.json`)

> **Status**: ✅ GATE PASSED — all 9 items resolved (AR-P1..P8 at gate time; AR-P9 added
> via plan-preflight finding PF-022 — user accepted all recommendations 2026-07-02)
> **Last Updated**: 2026-07-02 (plan preflight PF-015..PF-022 applied)
>
> **Context**: RD-16 was requirements-preflighted the same day (14 findings PF-001..PF-014
> resolved and applied — see `requirements/00-preflight-report.md`), so all *contract-level*
> decisions are already settled in the RD. The items below are the plan-level decisions the
> RD deliberately left open ("claimed at implementation time", "may depend on a JSONC parser
> (or bundle one)") plus gaps surfaced by grounding the plan in the shipped code.
>
> **Hardening**: items AR-P1..AR-P4 (tagged *complex*) were stress-tested by one independent
> challenger agent, blind to the primary picks, per `_shared/recommendation-hardening.md`.
> The challenger vetoed the primary's original E10230 band proposal (collision with frozen
> enum codes, `spec/09-enums.md:281-287`) and flipped the parse-error recommendation from
> discard-to-defaults to best-effort recovery (RD-14 LSP argument); both reconciliations
> were adopted before presenting.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| AR-P1 | Technical unknowns | JSONC parsing approach — RD-16 R27 permits "a JSONC parser dep (or bundle one)"; no package in the workspace has ANY external runtime dependency today, so this would be the first | A: add `jsonc-parser` (Microsoft, zero transitive deps) / B: hand-roll or vendor a tolerant JSONC scanner | **A** — add `jsonc-parser` as `@blend65/config`'s (and the workspace's first) external runtime dependency (accepted recommendation, 2026-07-02) | ✅ Resolved |
| AR-P2 | Integration points | Diagnostic location strategy — `DiagnosticBag` dedups on `(code, sourceId, start)`; null spans map to `(-1,-1)`, so two same-code null-span diagnostics collapse (2nd+ unknown key silently dropped). The SourceMap that assigns real `sourceId`s is deferred to RD-11b | A: synthetic `SourceSpan`s with real byte offsets + exported sentinel `sourceId` constant + optional `LoadConfigOptions.sourceId` override / B: null spans, `file:line:col` in message text only | **A** — synthetic spans, exported `CONFIG_SOURCE_ID` sentinel, optional caller-supplied `sourceId` (accepted recommendation, 2026-07-02) | ✅ Resolved |
| AR-P3 | Naming & terminology | Concrete diagnostic code claims — RD-16 §4.3 defers codes to implementation time. Needed: 7 error classes + 2 warning classes. E10230–E10236 are already enum codes in the frozen spec; only 4 tooling slots (E10036–39) remain before the intrinsics band | A: claim the unclaimed E10240–E10249 decade — E10240–E10246 (one code per failure class) + W10240/W10241 / B: compress into E10036–E10039 with coarse parameterized codes | **A** — E10240–E10246 + W10240/W10241, one code per failure class, names per Resolution Notes (accepted recommendation, 2026-07-02) | ✅ Resolved |
| AR-P4 | Behavioral gaps | Behavior after a JSONC parse error — the parser can return a recovered partial tree; RD-16 §4.3 step 2 emits the error but does not say whether steps 3–6 see the file's content | A: report ALL parse errors, continue validating the recovered tree (best-effort) / B: report error(s), discard file content, continue with defaults + overrides | **A** — report all parse errors, validate the recovered tree best-effort (accepted recommendation, 2026-07-02) | ✅ Resolved |
| AR-P5 | Edge cases | R29 root-escape detection mechanics — glob patterns contain `**`/`*`, so `path.resolve`-based checking is unsound (`**/../x` resolves inside root but can match outside when `**` matches zero dirs) | A: purely syntactic — reject if absolute (POSIX or win32 form) OR any `/`-separated segment equals `..` (normalize `\` to `/` first); false-positives like `src/../src` are rejected deliberately / (resolve-based checking dropped as unsound) | **A** — purely syntactic rejection rule (accepted recommendation, 2026-07-02) | ✅ Resolved |
| AR-P6 | Naming & terminology | `@blend65/config` module layout — the package is greenfield (stub today); coding standards want foundation-first small modules with a single `index.ts` entry | A: `types.ts`, `defaults.ts`, `discovery.ts`, `parse.ts`, `validate.ts`, `merge.ts`, `load-config.ts`, `index.ts` / B: fewer, larger files (risks the 500-line split rule) | **A** — seven focused modules + `index.ts` public entry (accepted recommendation, 2026-07-02) | ✅ Resolved |
| AR-P7 | Technical unknowns | Test strategy for fs-touching paths — repo precedent is real temp dirs (`mkdtempSync`, e.g. `packages/compiler/src/runtime-asm.spec.test.ts:37`), no fs mocking | A: real temp-dir fixtures for `loadConfig()`/discovery integration; pure helpers (walk-up, validation, merge) unit-tested directly / B: inject an fs-adapter abstraction (hermetic but new, deviates from precedent) | **A** — real temp dirs for integration; pure helpers (walk-up takes an `existsSync`-like predicate) unit-tested hermetically (accepted recommendation, 2026-07-02) | ✅ Resolved |
| AR-P8 | Scope ambiguities | Plan target & slug confirmation — nested layout, feature `blend65-ri`, plan dir `codeops/features/blend65-ri/plans/rd-16-compiler-configuration/`; scope exactly RD-16 §2 (loader only — no glob expansion, no CLI flags, no severity-policy application) | A: confirm as stated / B: adjust (user specifies) | **A** — confirmed as stated (accepted recommendation, 2026-07-02) | ✅ Resolved |
| AR-P9 | Behavioral gaps | Post-error field values in the always-populated `BlendConfig` (plan-preflight PF-022) — what `platform` holds after E10245; whether an out-of-range `maxErrors` or an E10246-offending pattern survives into the returned config | A: values stay **as-merged** (no post-hoc mutation), `platform` = `""` when still unset, consumers gate on `hasErrors` / B: per-key fallback to the §4.1 default on semantic failure | **A** — as-merged + `platform: ""`; errored configs are populated but untrusted (accepted recommendation via preflight PF-022, 2026-07-02) | ✅ Resolved |

### Resolution Notes

**AR-P1 (Resolved: A, confidence high):** `jsonc-parser`'s `parseTree()`/`visit()` gives
per-node offsets (UTF-16 code-unit string indices — converted to the UTF-8 byte offsets
`SourceSpan` requires, per plan-preflight PF-017) and `ParseError[]` *with a recovered
tree* — the exact inputs AR-P2's spans and AR-P4's recovery need. A naive strip-comments+`JSON.parse` hand-roll loses all
positions and forces the broken null-span path. Challenger independently chose A; noted
implementation checkpoint: verify the package's ESM entry resolves under NodeNext (a
namespace-import fallback is documented in `03-01-config-loader.md`). Vendoring remains the
fallback if the dependency misbehaves. **The A picks of AR-P1/P2/P4 form one coherent
chain — B on AR-P1 would have foreclosed A on P2/P4.**

**AR-P2 (Resolved: A, confidence high):** Option B is functionally broken, not merely
lossy — `diagnostic-bag.ts:89-93` builds the dedup key from `(code, sourceId, start)`, so
R19/R20's per-key reporting cannot survive dedup on null spans. The sentinel is
`CONFIG_SOURCE_ID = -2` (`-1` is the bag's null-span marker); it sorts config diagnostics
before all source files in `getAll()` — the right rendering order anyway. The RD-11b
renderer will need to special-case the sentinel (documented as a known cost).
*Extension within this decision's rationale:* diagnostics for values that have no file
position (override-sourced, or missing-platform) use synthetic spans with a stable per-key
ordinal offset so same-code diagnostics for different keys also survive dedup — see
`03-01-config-loader.md` §Span strategy.

**AR-P3 (Resolved: A, confidence high):** Challenger fact-check: the primary's original
E10230 proposal collides with frozen enum codes (`spec/09-enums.md:281-287`,
E10230 non-constant member … E10236 cross-enum comparison). E10240–E10249 is verified
unclaimed in both `spec/` and `packages/core/src/diagnostics/diagnostic-codes.ts`.
Claimed names: `ConfigFileNotFound` E10240, `ConfigParseError` E10241,
`ConfigNotAnObject` E10242, `ConfigInvalidValue` E10243 (parameterized: wrong type /
`maxErrors` range / bad enum literal / bad W-code format), `ConfigUnknownPlatform` E10244,
`ConfigMissingPlatform` E10245, `ConfigPatternEscapesRoot` E10246; `ConfigUnknownKey`
W10240, `ConfigPromoteSuppressOverlap` W10241.

**AR-P4 (Resolved: A, confidence medium-high):** RD-16 §4.3 reads as fall-through (step 2
emits, step 3 validates — never says discard), AC-11 demands an always-populated
`BlendConfig`, and the decisive consumer is the RD-14 LSP, which will call `loadConfig()`
mid-edit — discarding would flip it to defaults on every keystroke inside a comment.
All parse errors are reported (distinct offsets dedup correctly; the bag cap bounds
volume). Counter-argument (cascade noise from a mangled tree) accepted as the lesser cost;
the build exits 2 either way. Challenger flipped the primary's original discard pick.

**AR-P5 (Resolved: A — single sound option):** resolve-based checking was dropped as
*unsound*, not merely awkward: `path.resolve(root, "**/../x")` lands inside the root, but
at match time `**` can match zero directories, making the pattern escape. The syntactic
rule is sound (no `..` segment + no absolute prefix ⇒ every expansion stays under root),
matches R29's own wording ("Absolute paths or patterns escaping the root (`..`)"), and its
false-positives (`src/../src/*.blend`) are pathological patterns better rejected clearly.

**AR-P6 (Resolved: A):** estimated package size ~600–900 lines; seven focused modules keep
every file well under the 500-line split threshold and mirror the pipeline-stage pattern
used across the repo. `index.ts` re-exports the public API only (`loadConfig`, types,
`CONFIG_SOURCE_ID`, `CONFIG_DEFAULTS`).

**AR-P7 (Resolved: A):** matches the shipped precedent
(`packages/compiler/src/runtime-asm.spec.test.ts:37` et al.). The discovery walk-up is
implemented as a pure helper taking an `existsSync`-like predicate so its unit tests are
hermetic; `loadConfig()` integration tests use `mkdtempSync` temp trees.

**AR-P8 (Resolved: A):** slug follows the existing convention
(`rd-17-intrinsics-runtime-abi`, `rd-09-acme-emitter`); feature `blend65-ri` is the only
feature in the repo and owns RD-16.

**AR-P9 (Resolved: A):** deterministic and mutation-free; B would add per-key mutation
rules and collide with AC-10's "verbatim" carry for patterns. RD-15 exits 2 on
`hasErrors` before any consumer reads the config, so an as-merged errored config is
never acted on. Asserted by the loader impl tier (see `07-testing-strategy.md`).
