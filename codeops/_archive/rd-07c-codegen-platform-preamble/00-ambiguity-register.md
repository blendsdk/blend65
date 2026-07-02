# RD-07c Codegen Platform Preamble — Ambiguity Register

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED — 7 items resolved at planning (D1–D7) / 1 added during planning (D8) / 2 added during execution (D9–D10)
> **Last Updated**: 2026-06-10

> **Purpose**: Plan-level Zero-Ambiguity Gate for RD-07c. Every plan decision not already
> fixed by the frozen `spec/`, the authored `requirements/RD-07-codegen-instr.md`, or the
> completed RD-07a/RD-07b/RD-10 plans is recorded here — with its resolution — before any
> document or code depends on it.

## Scope of this register

RD-07 (`requirements/RD-07-codegen-instr.md`) specifies the **whole** 6502 code generator.
RD-07a shipped the stable `Instr` model + CPU validator + serializer. RD-07b shipped the
IL→`Instr` translation for the RD-06 **live op set** + register binding + `generateInstr`,
emitting an **empty** `InstrProgram.preamble` and deferring the genuinely-blocked remainder
to **RD-07c**.

RD-07c is the **platform-preamble slice ("Half A")**: it wires the now-shipped RD-10
`PlatformPlugin` into the program preamble (R46–R49, R55) so codegen output is
**assemblable** for the c64 gate program with a terminating `main`. The remainder of RD-07
("Half B" — the IL ops no live lowering emits, multi-block CFG, calling convention,
interrupt prologue/epilogue, for-loop Pattern A/B, and the fall-through optimization) stays
deferred until RD-06 widens its lowering. This is the same AR-38 walking-skeleton discipline
used for RD-04→RD-04b, RD-11→RD-11a, and RD-07→RD-07a/b.

---

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|----------|-----------------|-------------------|----------|--------|
| D1 | Scope / Strategy | RD-07c's full deferred scope splits into platform hooks (now unblocked by RD-10) and ops blocked on RD-06's still-single-block lowering. How much to build now? | A: **"Half A" only** — wire the RD-10 plugin into `InstrProgram.preamble` (origin/`!to`/startup-shim, R46–R49/R55) so the c64 gate program assembles; defer Half B (deferred IL ops, multi-block CFG, calling convention, interrupt body, for-loops, fall-through) to an RD-06-widening slice · B: build all deferred RD-07 scope now · C: skip RD-07c, do RD-09 first | **A** — Half A only (user-selected; the dependency graph forces it: RD-09 needs a real preamble, which IS Half A) | ✅ Resolved |
| D2 | Dependency / API | `generateInstr(ilProgram, cpuVariant, bag)` returns `preamble: []` today and is already consumed by RD-08/RD-09's contract. How does the RD-10 plugin reach codegen to fill the preamble? | A: change `generateInstr`'s signature to take the plugin · B: add a plugin parameter to `generateInstr` · C: **leave `generateInstr` untouched; add a new `assembleProgram(ilProgram, plugin, bag)` wrapper** that calls `generateInstr(ilProgram, plugin.profile.cpuVariant, bag)` then fills `preamble` via the plugin hooks | **C** — additive wrapper; zero churn to the existing `generateInstr` consumers (user-selected) | ✅ Resolved |
| D3 | Semantics / Shim selection | `PreambleOptions` needs a `shimVariant` + `needsBssZero`/`needsDataInit`. Real `main`-termination CFG analysis is Half B (blocked; lowering is single-block). What drives the options in this slice? | A: real CFG termination analysis now (blocked) · B: **simple rule** — a single-block entry function ending in `ret` ⇒ `"terminating"`; `needsBssZero`/`needsDataInit` derived from the `AllocationPlan`/const-data (both `false` when absent) · C: hardcode `"terminating", false, false` | **B** — simple rule, documented as a seam RD-07c-or-later tightens when CFG lands (user-selected) | ✅ Resolved |
| D4 | Naming / Entry label | The c64 shim calls `JSR _main`, but `translateFunction` labels the stream `Main.main` (fqName), and `.` is illegal in ACME labels (`sanitize()` is an identity stub). How is the entry function labelled, and how are others sanitized? | A: emit a `_main` alias directive equating it to the fqName label · B: **codegen labels the unique entry function (`Module.main`) `_main` directly, and sanitizes every other function label `.`→`_`** (RD-05 name-sanitization: `[A-Za-z0-9_]` only) · C: change the RD-10 shim to JSR the sanitized fqName | **B** — recovered resolved convention (RD-09 R15/R19 + RD-10 §4.5/§4.6, AR-64): entry = `_main`, shim does `JSR _main`, others sanitized. No alias; shim resolves directly | ✅ Resolved |
| D5 | Scope / Hooks | `encodeString`/`encodeChar` are part of the plugin hook surface. Wire them in codegen now or defer? | A: wire now · B: **defer** — no live string/char IL is lowered yet, so wiring them produces untestable code (the AR-38 trap). Defer to the slice that lowers string/char literals | **B** — defer; no live consumer (user-selected) | ✅ Resolved |
| D6 | Naming / Layout | Plan directory slug. | A: `rd-07c-codegen-remainder` · B: **`rd-07c-codegen-platform-preamble`** (names the actual deliverable) · C: other | **B** — `rd-07c-codegen-platform-preamble` (user-selected) | ✅ Resolved |
| D7 | Process | Commit mode for execution. | ask / no-commit / auto-commit | **no-commit** — consistent with RD-01..RD-06/RD-07a/b/RD-10/RD-11a; the user performs all git operations (user-selected) | ✅ Resolved |
| D8 | Semantics / Fall-through (planning) | A resolved historical decision: do **not** emit a wasteful `JSR _main`/`RTS` when the startup code can naturally **fall through** into `_main`. Deciding fall-through needs `main`-termination + block-layout analysis (Half B). Apply it now? | A: **defer the fall-through optimization to Half B / a layout pass**; for RD-07c wire the shim exactly as the RD-10 plugin already emits it (`JSR _main` … `RTS`), recording fall-through as an explicit documented seam. Gate program is correct, one `JSR/RTS` heavier than optimal (acceptable for the slice) · B: implement fall-through now (pulls Half B layout analysis in; touches the RD-10 shim) | **A** — defer fall-through to Half B; wire shim as-is, document the seam (user-selected) | ✅ Resolved |
| D9 | Testing / Regression scope (runtime) | The D4 relabel (`.`→`_`) also changed the RD-07b translator unit tests `translate.spec.test.ts`, whose fixture function is named `M.f` (bare name `f`, non-entry) and which assert the label `M.f:`. The plan's testing-strategy regression note (07-testing-strategy) enumerated only `generate.golden.spec.test.ts`. Is this a new decision? | A: **mechanical consequence of D4 — relabel the 18 `M.f:` oracles to `M_f:`** (bodies unchanged; `M.f` is a non-entry function → `M_f` under the already-approved D4 rule); back-propagate into the regression note · B: treat as a spec change (requires fresh user approval) | **A** — under-enumeration in the plan, not a new decision; the relabel is forced by D4. Applied + back-propagated (found during execution) | ✅ Resolved |
| D10 | Architecture / Package boundary (runtime) | The plan (task 2.1.1) added `@blend65/codegen` → `@blend65/platforms` as a test-only devDependency so the ST-AG1 golden could use the real `c64Plugin`. But `@blend65/platforms` already dev-depends on `@blend65/codegen` (its goldens import `printInstr`), so the two edges form a workspace **dependency cycle** turbo rejects — blocking the entire verify. Where does the real-plugin golden live? | A: **package tests use only that package's own dependency closure; cross-package integration goes in `@blend65/compiler`** — revert the codegen→platforms edge, drive codegen's spec/impl tests with a minimal inline fake `PlatformPlugin` (the type lives in `@blend65/core`), and move the real-`c64Plugin` ST-AG1 golden to `@blend65/compiler` (already depends on both) · B: keep codegen→platforms, remove platforms→codegen by relocating platforms' goldens · C: drop the real plugin from codegen tests, fake only | **A** — user-selected; establishes the durable rule (keeps the package graph a DAG; `@blend65/compiler` is the integration layer + natural home for full-pipeline goldens) | ✅ Resolved |

---

## Resolution Notes

### D1 — Half A is the forced next increment

The MVP gate (AR-43/44) is: compile `poke(0xD020, 5)` on c64 → `.prg` → VICE asserts the
border colour, with a terminating `main`. RD-07b already translates the gate program's live
IL (`load`/`store`/`const`), but `generateInstr` emits an **empty** preamble, so the output
is not yet an assemblable program (no origin, no `!to`, no startup). Half A fills exactly
that gap by wiring the shipped RD-10 plugin. RD-09 (ACME emitter, the roadmap's next item)
**cannot** produce a working binary without this preamble — so Half A is on the critical path
either way. Building Half B now would translate IL no live lowering emits (the v2
"100%-before-a-consumer" mistake AR-38 prevents).

### D2 — Additive `assembleProgram` wrapper

`generateInstr(ilProgram, cpuVariant, bag)` is the function RD-08 (peephole) and RD-09
(emitter) already consume. Changing its signature churns two consumers; an additive
`assembleProgram(ilProgram, plugin, bag)` wrapper churns none. The wrapper calls
`generateInstr(ilProgram, plugin.profile.cpuVariant, bag)` (deriving the CPU variant from the
plugin's profile — the additive path RD-07b's D2 anticipated), then builds `PreambleOptions`
(D3) and calls `plugin.emitPreamble(options)` to populate `InstrProgram.preamble`. The
returned program is otherwise identical.

### D3 — Simple termination rule (a documented seam)

Full `main`-termination analysis is Half B (it needs the multi-block CFG that RD-06 does not
yet lower). The slice rule is correct for every program the live lowering can currently
produce — all single-block: an entry function whose single block ends in a `ret` terminator
is `"terminating"`; `needsBssZero` is `true` only if the plan reserves a BSS region (none in
the gate), `needsDataInit` is `true` only if there is const/initialised data to copy (none in
the gate). Both are `false` for the gate. This is documented in `03-01` as the seam RD-07c's
Half-B successor tightens; it never silently produces wrong code (the `terminating` shim is
always safe — it just may be one `JSR/RTS` heavier than a fall-through, see D8).

### D4 — Entry function label `_main`; sanitize others

Recovered from the binding compiler RDs (newer than the F019 prose): **RD-09 R15** fixes
emission order `__init` → `_main` → others and **R19** shows the c64 preamble doing
`JSR _main`; **RD-10 §4.5/§4.6** (the shipped shim) emits `symbolRef("_main")`. So codegen
must label the unique entry function (`Module.main`, identified by the bare function name
`main`) with the special label **`_main`**, and sanitize every other function's fqName label
`Module.function` → `Module_function` (RD-05 sanitization: replace `.` with `_`,
`[A-Za-z0-9_]` only; the `__` prefix stays reserved for compiler-generated symbols). The
shim's `JSR _main` then resolves directly to the entry stream's label — no alias directive.
`sanitize()` (currently an identity stub in `translate.ts`) becomes real as part of this.

### D5 — Defer string/char encoding hooks

`encodeString`/`encodeChar` have no live consumer: no string or char literal is lowered to IL
yet. Wiring them now would be fixtures-only code with no end-to-end path — the exact AR-38
trap. They are deferred to the slice that lowers string/char literals.

### D6 — Slug names the deliverable

`rd-07c-codegen-platform-preamble` describes what the slice ships (the platform-driven
program preamble) rather than the vague "remainder."

### D7 — Commit mode `--no-commit`

The agent implements, verifies, and updates the execution plan, but performs **no** git
operations. The user handles all commits. Identical to every prior RD plan.

### D8 — Fall-through optimization deferred (the historical nuance)

The one point debated historically was *not emitting an unnecessary `JSR _main`/`RTS` when
the code can naturally fall through into `_main`* (the F019 "linear flow, no JSR" idea).
Realising that requires `main`-termination + block-layout analysis, which is Half B
(multi-block CFG, not yet lowered by RD-06). For this slice the shim is wired exactly as the
shipped RD-10 plugin emits it (`terminating` = `JSR _main` … restore … `RTS`). The gate
program runs correctly; it is at most one `JSR/RTS` heavier than the fall-through optimum.
The fall-through optimization is recorded as an explicit Half-B seam in `03-01`, not silently
dropped. The `bare`/`non-terminating` variants remain available through the plugin for when
the layout pass lands.

### D10 — Package tests use only their own dependency closure

The plan's task 2.1.1 reached "sideways" from `@blend65/codegen` to its sibling
`@blend65/platforms` for a test. Because `@blend65/platforms` already dev-depends on
`@blend65/codegen` (its goldens render via `printInstr`), the two edges closed a workspace
dependency **cycle** that turbo refuses to schedule — a hard verify failure, not a warning.

The durable rule (D10): **a package's tests may only use that package's own dependency
closure.** When a test needs two sibling packages that do not (and must not) depend on each
other, it belongs in the package that already integrates both — here `@blend65/compiler`
(depends on core, frontend, codegen, platforms, config). Concretely:

- `@blend65/codegen` spec/impl tests drive `assembleProgram` with a **minimal inline fake**
  `PlatformPlugin` (the interface lives in `@blend65/core`, so no new package edge). This
  proves the wrapper threads *whatever* `emitPreamble` returns into the preamble.
- The real-`c64Plugin` end-to-end golden (ST-AG1) lives in **`@blend65/compiler`** — the
  integration layer and the natural long-term home for full `.blend → .prg` pipeline goldens.

This keeps the package graph a DAG and prevents this whole class of cycle.

---

## Surface-during-authoring rule

If authoring or implementation surfaces a *new* ambiguity, **STOP**, add it here as the next
`D-N` (tagged `(runtime)` if found during execution), resolve it with the user,
back-propagate into the affected plan documents, then resume. Do not fill gaps by guessing.
