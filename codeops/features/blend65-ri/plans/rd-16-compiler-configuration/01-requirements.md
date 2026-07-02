# Requirements: RD-16 Compiler Configuration (`blend65.json`)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-16](../../requirements/RD-16-compiler-configuration.md)

## Feature Overview

Implement the `@blend65/config` package: a synchronous, never-throwing `loadConfig()`
that turns `blend65.json` (JSONC) plus invocation overrides into a fully populated,
validated `BlendConfig`, reporting every problem into the caller-supplied
`DiagnosticBag`. The RD (preflighted 2026-07-02, PF-001..PF-014 applied) is the
authoritative contract; this document maps its R1–R31 onto the implementation and marks
scope boundaries. Plan-level decisions carry `AR-P#` references to
[00-ambiguity-register.md](00-ambiguity-register.md).

## Functional Requirements

### Must Have

- [ ] **F1 — Discovery** (RD-16 R1, R3, R4): find `blend65.json` by walking up from
  `cwd`; first hit wins; explicit `configPath` bypasses discovery; a discovery miss is
  NOT an error (all defaults); an explicit path that is missing IS an error (E10240).
- [ ] **F2 — JSONC parsing** (R2, R5): `//` and `/* */` comments and trailing commas
  tolerated; the file is data, never `require()`d/`import()`ed; parse errors are
  reported (E10241, all of them) and validation continues on the recovered tree
  (AR-P4); a non-object top level is E10242.
- [ ] **F3 — Schema validation** (R19, R20): unknown keys → W10240 warning per key;
  wrong-typed values for known keys → E10243 naming the key, expected type, and actual
  value.
- [ ] **F4 — Semantic validation, post-merge** (R21, R29, R30, R31, §4.3 edge table):
  missing `platform` → E10245; unknown platform (only when `knownPlatforms` provided) →
  E10244 listing available platforms; `maxErrors` must be an integer ≥ 1 → E10243;
  `include`/`exclude` entries must be relative, non-root-escaping patterns → E10246
  (syntactic rule, AR-P5); `warnAsError`/`suppressWarnings` entries must match the
  warning-code pattern → E10243; a code in both lists → W10241.
- [ ] **F5 — Defaults & merge** (R23, R24, R25, §4.1): three layers
  `defaults ← blend65.json ← overrides`; only explicitly set (non-`undefined`) override
  values apply; arrays replace, never concatenate; the §4.1 default table is the single
  source of default values.
- [ ] **F6 — API contract** (R26, R28, PF-002): synchronous
  `loadConfig(options: LoadConfigOptions): LoadConfigResult` returning
  `{ config, hasErrors }`; all diagnostics appended to `options.bag`; never throws on
  invalid input; `config` is always fully populated (AC-11).
- [ ] **F7 — Diagnostic codes & spans**: claim E10240–E10246 + W10240/W10241 in
  `@blend65/core`'s `DiagCode` registry (AR-P3); file-anchored diagnostics carry
  synthetic `SourceSpan`s with byte offsets and `CONFIG_SOURCE_ID` (AR-P2).
- [ ] **F8 — Carried-verbatim pattern contract** (AC-10): validated `include`/`exclude`
  arrays land in `BlendConfig` unchanged for the RD-15/RD-14 discovery tier to expand.

### Should Have

- [ ] **F9 — Location-bearing messages**: file-anchored diagnostics embed
  `<path>:<line>:<col>` in the message text until the RD-11b renderer can resolve
  `CONFIG_SOURCE_ID` itself (AR-P2 resolution note).

### Won't Have (Out of Scope — RD-16 §2)

- CLI flag definitions/parsing and `outName` derivation → RD-15
- Glob **expansion** / file discovery → RD-15 (CLI) / RD-14 (LSP `CompilerHost`)
- Severity-policy application (promote/suppress precedence — suppression wins) → RD-11 R50
- ACME discovery beyond carrying `acmePath` → RD-09
- Platform plugin data → RD-10; the `language-server → config` edge → RD-14 (PF-014)
- `startup` → `ShimVariant` mapping and the AR-69 `"auto"` CFG analysis → downstream
  compiler pipeline (config carries the literal string; RD-16 R18 mapping note)

## Technical Requirements

### Performance

- Config files are small; a single synchronous read + parse per invocation (R28). No
  caching layer — one `loadConfig()` call per build/LSP request is the usage model.

### Compatibility

- TypeScript ESM/NodeNext, ES2023, `strict` — matches the workspace toolchain.
- `jsonc-parser` (AR-P1) must resolve under NodeNext; namespace-import fallback
  documented in [03-01-config-loader.md](03-01-config-loader.md).
- Package dependency surface: `@blend65/core` + `jsonc-parser` only (R27) — never
  `frontend`, `codegen`, or `platforms` (AR-20; `knownPlatforms` is injected, R21).

### Security

- **Input validation**: every key allowlisted against the schema; unknown keys warned
  (R19); every value type/range/format-checked (R20, §4.3 step 6).
- **Path traversal**: `include`/`exclude` must be relative and contain no `..` segment
  (R29, AR-P5) — upholds RD-13 R37 scoped file-system access.
- **No code execution**: the file is parsed as data only (R5, AC-13); `acmePath` is
  documented trusted input per R11's trust-model note (same model as
  `tsconfig.json`/npm scripts, RD-13 R35).
- **Minimal error leakage**: messages name keys/values/paths from the user's own config
  only — no internals.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| JSONC parsing | external dep / hand-roll | `jsonc-parser` | offsets + recovery needed by AR-P2/P4; R27 blesses it | AR-P1 |
| Diagnostic locations | synthetic spans / null spans | synthetic spans + `CONFIG_SOURCE_ID` | null spans collapse same-code diagnostics under bag dedup | AR-P2 |
| Code band | E10240 decade / E10036–39 slots | E10240–E10246 + W10240/41 | E10230s frozen for enums; 4 tooling slots < 7 classes | AR-P3 |
| Parse-error behavior | best-effort / discard | best-effort recovered tree, all errors reported | §4.3 fall-through reading; RD-14 LSP mid-edit use | AR-P4 |
| R29 mechanics | syntactic / resolve-based | syntactic (absolute ∨ `..` segment) | resolve-based is unsound for globs | AR-P5 |
| Module layout | 7 modules / fewer files | 7 modules + `index.ts` | 500-line rule; repo pipeline-stage pattern | AR-P6 |
| Test strategy | real temp dirs / fs adapter | real temp dirs + pure helpers | repo precedent (`runtime-asm.spec.test.ts:37`) | AR-P7 |
| Target & slug | confirm / adjust | `plans/rd-16-compiler-configuration/`, feature `blend65-ri` | existing slug convention | AR-P8 |

> **Traceability:** contract decisions trace to RD-16 R1–R31/AC-01..14 (themselves
> AR-NN/spec/Design-sourced per the RD's §2 rule); plan-level decisions trace to the
> AR-P# entries above. See `00-ambiguity-register.md`.

## Acceptance Criteria

Mirrors RD-16 §6 (AC-01..AC-14), concretized by this plan:

1. [ ] AC-01: JSONC comments + trailing commas parse (ST-6)
2. [ ] AC-02: discovery walks up and finds the nearest file (ST-1, ST-5)
3. [ ] AC-03: missing config file → defaults, no error (ST-2)
4. [ ] AC-04: all schema properties typed and validated at load time (ST-10..ST-17)
5. [ ] AC-05: unknown keys warn (W10240), never error (ST-10, ST-11)
6. [ ] AC-06: invalid value types → E10243 with expected type (ST-12)
7. [ ] AC-07: unknown platform errors (E10244) only when `knownPlatforms` provided (ST-18, ST-19)
8. [ ] AC-08: invocation overrides beat config file values (ST-25..ST-27)
9. [ ] AC-09: missing platform (E10245), root-escape (E10246), `maxErrors` range, overlap warning all behave per the §4.3 edge table (ST-13, ST-20, ST-21, ST-24)
10. [ ] AC-10: `include`/`exclude` validated and carried verbatim (ST-21, ST-22)
11. [ ] AC-11: `{ config, hasErrors }` with fully populated config; all diagnostics in the supplied bag; never throws (ST-28..ST-31)
12. [ ] AC-12: minimal `{ "platform": "c64" }` works end-to-end (ST-28)
13. [ ] AC-13: config is never executed — no `require`/dynamic `import` in the package (audit task 4.3.2 + impl-tier data-only assertion, 07 §Security)
14. [ ] AC-14: every decision traces to AR-NN / spec / `Design` / AR-P# (plan audit task)
15. [ ] All tests pass; full verify green (`yarn install --frozen-lockfile && yarn turbo run build typecheck lint && yarn test`)
16. [ ] Roadmap updated (plan → executed transitions per the roadmap skill)
