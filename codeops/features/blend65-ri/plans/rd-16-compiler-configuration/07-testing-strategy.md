# Testing Strategy: RD-16 Compiler Configuration

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests: every module (`discovery`, `parse`, `validate`, `merge`, `load-config`) —
  happy path, boundaries, error paths
- Integration tests: `loadConfig()` over real temp-dir trees (AR-P7)
- E2E: minimal config `{ "platform": "c64" }` end-to-end (AC-12)

**Assertion granularity** (applies to every ST below): spec tests assert diagnostic
**code + severity + salient message substrings** (key/value/platform names), and span
`sourceId`/offset distinctness where the ST says so — never full message sentences
(the RD fixes codes and semantics, not prose). "defaults" means the RD §4.1 table.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from RD-16 (R1–R31, AC-01..14, §4.1–§4.3) and the Ambiguity
> Register (AR-P1..P8). **IMMUTABLE ORACLE RULE:** if the implementation disagrees with
> an ST case, the implementation is wrong. Every ST carries its source.

### Discovery (`discovery.spec.test.ts`, `load-config.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|----------------------------|----------------------------------------|-------------------|
| ST-1 | Temp tree `a/blend65.json` (`{"platform":"c64"}`); `loadConfig({cwd: a/b/c})` | `config.configPath` = abs path of `a/blend65.json`; `config.projectRoot` = `a`; nearest file wins when `a/b/blend65.json` also exists | R4 / AC-02 |
| ST-2 | Temp tree with NO `blend65.json`; `loadConfig({cwd: temp, overrides: {platform:'c64'}})` | `hasErrors: false`; `configPath: null`; `projectRoot` = resolved `cwd`; all other fields = defaults | R3 / AC-03 |
| ST-3 | `configPath: '<temp>/nope.json'` (does not exist) | one `E10240` (error) containing the path; returns populated defaults; `hasErrors: true`; does NOT throw | §4.3 edge table / AC-11 |
| ST-4 | Valid file at `<temp>/other/cfg.json`; `configPath` points at it; a different `blend65.json` sits in `cwd` | the explicit file is used; discovery skipped; `projectRoot` = `<temp>/other` | R4 (`--config` overrides) |
| ST-5 | `findConfigUpwards('/x/y/z', exists)` where predicate is true only for `/x/blend65.json` (pure-fn test, no fs) | returns `/x/blend65.json`; returns `null` when predicate is always false (checks up to and including the root) | R4 / AR-P7 |

### JSONC parsing (`parse.spec.test.ts` + `load-config.spec.test.ts`)

> **Two-level split (PF-015):** each ST below has a **parse-level** expectation
> (observable from `parseJsoncFile` alone — asserted in `parse.spec.test.ts`, Phase 2)
> and a **loader-level** expectation (diagnostic emission — requires `loadConfig`,
> asserted in `load-config.spec.test.ts`, Phase 4). Phase 2's green gate covers only
> the parse-level column; E10241/E10242/span/dedup assertions are loader-level.

| # | Input / Scenario | Parse-level (`parseJsoncFile`) | Loader-level (`loadConfig`) | Source |
|------|------------------------|--------------------------------|------------------------------|-------------------|
| ST-6 | File with `//` line comment, `/* */` block comment, and a trailing comma; `{"platform":"c64",}` | `parseErrors.length === 0`; recovered `value.platform === 'c64'` | parses cleanly; zero diagnostics; `platform === 'c64'` | R2 / AC-01 |
| ST-7 | Malformed file `{"platform": }` | recovered `value` returned; ≥1 `parseErrors` entry with a byte offset inside the file | ≥1 `E10241` with a span whose `sourceId === CONFIG_SOURCE_ID` and offset inside the file; loader still returns a populated config; recovered keys (if any) validated | AR-P4 / AC-11 |
| ST-8 | Two distinct syntax errors in one file | two `parseErrors` entries with distinct offsets | two `E10241` diagnostics (distinct offsets — both survive dedup) | AR-P4 / AR-P2 |
| ST-9 | Top-level `[]`; top-level `"x"` | recovered `value` is an array / a string (E10242 classification is the loader's) | `E10242`; file contributes no values (all defaults + overrides); `hasErrors: true` | §4.3 edge table |

### Schema validation (`validate.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|----------------------------|----------------------------------------|-------------------|
| ST-10 | `{"platform":"c64", "platfrom":"c64"}` | one `W10240` (warning, NOT error) whose message contains `platfrom`; `hasErrors: false` | R19 / AC-05 |
| ST-11 | Two unknown keys `"foo"`, `"bar"` | TWO `W10240` warnings with distinct span offsets | R19 + AR-P2 (dedup survival) |
| ST-12 | `{"maxErrors": "twenty"}` | `E10243` (error) mentioning `maxErrors` and the expected type; config falls back to `maxErrors: 20` | R20 / AC-06 |
| ST-13 | `maxErrors: 0`, `-5`, `2.5` (three cases) | `E10243` each (integer ≥ 1 rule) | §4.3 edge table / AC-09 |
| ST-14 | `{"diagnosticsFormat": "xml"}` | `E10243` naming the valid literals | R15 |
| ST-15 | `{"startup": "fast"}` | `E10243`; valid literals are auto/terminating/minimal/bare | R18 |
| ST-16 | `warnAsError: true` and `warnAsError: ["W10130"]` (two cases) | accepted, carried into config verbatim | R13 |
| ST-17 | `warnAsError: ["E10001"]`; `suppressWarnings: ["banana"]` | `E10243` each (W-code pattern) | §4.3 step 6 |

### Semantic validation (`validate.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|----------------------------|----------------------------------------|-------------------|
| ST-18 | `platform: "c65"`, `knownPlatforms: ['c64','cx16']` | `E10244` containing `c65`, `c64`, `cx16`; `hasErrors: true` | R21 / AC-07 |
| ST-19 | `platform: "c65"`, `knownPlatforms` omitted | NO platform diagnostic (check skipped) | R21 / AC-07 |
| ST-20 | No `platform` in file, none in overrides | `E10245`; `hasErrors: true` | R31 / AC-09 |
| ST-21 | `include: ["/etc/**"]`, `include: ["../other/**"]`, `exclude: ["a/../../b"]` (three cases) | `E10246` each, message contains the offending pattern | R29 / AR-P5 / AC-09 |
| ST-22 | `include: ["src/**/*.blend"]`, `exclude: ["src/test/**"]` | no diagnostic; arrays land in `BlendConfig` **verbatim** | AC-10 |
| ST-23 | `include: []` | accepted, no diagnostic (emptiness is RD-15's) | §4.3 edge table |
| ST-24 | `warnAsError: ["W10130"]` + `suppressWarnings: ["W10130"]` | one `W10241` (warning) containing `W10130`; `hasErrors: false` | R30 / AC-09 |

### Merge (`merge.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|----------------------------|----------------------------------------|-------------------|
| ST-25 | File `{"platform":"c64","maxErrors":50}` + `overrides: {platform:'cx16'}` | `platform === 'cx16'` (override wins), `maxErrors === 50` (file kept) | R23/R24 / AC-08 |
| ST-26 | `overrides: {platform:'c64', outDir: undefined}` over file `{"outDir":"./dist/"}` | `outDir === './dist/'` — explicit `undefined` does NOT override | R25 |
| ST-27 | File `{"include":["a/**"]}` + `overrides: {include:['b/**']}` | `include` deep-equals `['b/**']` — arrays replace, never concatenate | R25 |

### `loadConfig()` API & E2E (`load-config.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|----------------------------|----------------------------------------|-------------------|
| ST-28 | Temp dir with `{ "platform": "c64" }`; `loadConfig({bag, cwd, knownPlatforms:['c64']})` | `hasErrors: false`; EVERY `BlendConfig` field populated with the §4.1 default (spot-check all 15 fields) | AC-11 / AC-12 |
| ST-29 | Any error scenario (reuse ST-3 input) with a bag PRE-populated with one unrelated error | `hasErrors` reflects only THIS call's errors → still `true` for ST-3 input; conversely a clean load over a dirty bag → `false` | AC-11 (`hasErrors` semantics, §4.2) |
| ST-30 | Return value of `loadConfig(...)` | is a plain object, NOT a `Promise` (synchronous, R28); call wrapped in `expect(...).not.toThrow()` for garbled input | R28 / R26 |
| ST-31 | All diagnostics from one load | appear in the caller-supplied bag (`bag.getAll()`), none anywhere else; file-anchored ones carry `sourceId === CONFIG_SOURCE_ID` by default, or the caller's `sourceId` when supplied | R26 / AR-P2 |

### Core diagnostic codes (`packages/core/src/diagnostics/config-codes.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|----------------------------|----------------------------------------|-------------------|
| ST-32 | `DiagCode` members | `ConfigFileNotFound==='E10240'`, `ConfigParseError==='E10241'`, `ConfigNotAnObject==='E10242'`, `ConfigInvalidValue==='E10243'`, `ConfigUnknownPlatform==='E10244'`, `ConfigMissingPlatform==='E10245'`, `ConfigPatternEscapesRoot==='E10246'`, `ConfigUnknownKey==='W10240'`, `ConfigPromoteSuppressOverlap==='W10241'` | AR-P3 |

> **⚠️ AUTHORING RULE:** expectations above come from RD-16 and the register only. If an
> expected output cannot be determined from them, STOP and take it to the register.

## Test Categories

### Specification Tests (from ST-cases above)
> Written BEFORE implementation. Red phase verified per execution-plan phase.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `packages/core/src/diagnostics/config-codes.spec.test.ts` | ST-32 | DiagCode registry |
| `packages/config/src/discovery.spec.test.ts` | ST-5 | discovery (pure) |
| `packages/config/src/parse.spec.test.ts` | ST-6..ST-9 (parse-level column only) | parse |
| `packages/config/src/validate.spec.test.ts` | ST-10..ST-24 | validate |
| `packages/config/src/merge.spec.test.ts` | ST-25..ST-27 | merge |
| `packages/config/src/load-config.spec.test.ts` | ST-1..ST-4, ST-7..ST-9 (loader-level column), ST-28..ST-31 | loadConfig integration/E2E |
| `packages/config/src/index.spec.test.ts` | public API surface exports (replaces stub smoke test) | index |

### Implementation Tests (edge cases, internals)
> Written AFTER implementation. `*.impl.test.ts`.

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/config/src/discovery.impl.test.ts` | root-dir boundary, deep nesting, symlinked cwd, trailing separators | High |
| `packages/config/src/parse.impl.test.ts` | UTF-8 BOM, empty file, huge comment blocks, code-unit→byte offset conversion on non-ASCII content (e.g. `// café ☕` comment before a syntax error → span start is the BYTE offset — PF-017), F9 message-format smoke (line/col via core `LineMap` — PF-018) | High |
| `packages/config/src/validate.impl.test.ts` | synthetic-span scheme stability (negative ordinal space, per-entry stride — PF-019), `\`-normalization, win32 absolute forms (`C:\`, UNC), boolean-vs-array `warnAsError` narrowing | High |
| `packages/config/src/load-config.impl.test.ts` | pre-populated-bag `hasErrors` matrix incl. bag already at `maxErrors` cap with truncation emitted (PF-020), unreadable-file I/O error path, override-sourced E10243 synthetic spans, AR-P9 post-error values (`platform === ""` after E10245; as-merged values after semantic failures) | Med |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| temp-tree loads | discovery+parse+validate+merge | ST-1..ST-4 exercise the full chain over `mkdtempSync` trees (AR-P7) |

### End-to-End Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| Minimal C64 project (AC-12) | write `{ "platform": "c64" }` to temp dir → `loadConfig` → assert | `hasErrors: false`, fully-populated `BlendConfig` (ST-28) |
| Full config (RD §4.4 "Full project" example) | write the RD's full example verbatim → load | zero diagnostics; every value carried through |

## Test Data

### Fixtures Needed
- Inline JSONC strings written to `mkdtempSync` trees per test (repo precedent —
  `runtime-asm.spec.test.ts:37`); `rmSync` cleanup in `afterAll`.
- The RD §4.4 example configs (minimal / full / cx16) transcribed verbatim.

### Mock Requirements
- None. Real fs via temp dirs (AR-P7); `findConfigUpwards` takes an injected
  `fileExists` predicate — a plain function, not a mock framework.

## Security test cases (mandatory)

- ST-21 (path traversal: absolute POSIX + `..` escapes) plus impl-tier win32
  absolute/UNC forms.
- Data-only guarantee (AC-13): impl-tier assertion that the package source contains no
  `require(`/`import(` of config content (audit task in the execution plan; ESLint
  `no-eval`-class rules already active repo-wide).
- Input validation: ST-10..ST-17 are the allowlist/type/range/format suite.

## Verification Checklist
- [ ] All ST cases (ST-1..ST-32) have concrete input/output pairs — ✔ above
- [ ] Every ST traces to an RD-16 requirement/AC or AR-P entry — ✔ Source column
- [ ] Spec tests written BEFORE implementation (execution-plan ordering)
- [ ] Red phase verified and documented per phase
- [ ] Green phase: all spec tests pass post-implementation
- [ ] Impl tests written after implementation
- [ ] Full verify green: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`
- [ ] No regressions in the existing suite (incl. `test/boundary.spec.test.ts`)
