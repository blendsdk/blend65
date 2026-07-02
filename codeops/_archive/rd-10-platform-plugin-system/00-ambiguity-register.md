# RD-10 Platform Plugin System — Ambiguity Register

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED — D1–D5 resolved at planning (2026-06-09) / D6–D7 resolved during authoring (2026-06-09) / D8 resolved during execution (2026-06-09)
> **Last Updated**: 2026-06-09


> **Purpose**: Plan-level Zero-Ambiguity Gate. Every RD-10 plan decision that is *not*
> already fixed by the frozen `spec/` (Ch 15 + the 5 platform appendices), by the
> (authored, non-frozen) `requirements/RD-10-platform-plugin-system.md`, or by an
> already-shipped RD (RD-07a's `CpuVariant`), is recorded here — with its resolution —
> before any document or code depends on it.

## Scope of this register

RD-10 (`requirements/RD-10-platform-plugin-system.md`) specifies the **whole** platform
plugin system: the `PlatformPlugin` interface + `PlatformProfile` data type (in
`@blend65/core`), the codegen hooks (preamble/shim/encoding/format), the static registry +
loader, and five built-in platform plugins (`c64`, `c64u`, `cx16`, `a800xl`, `a7800`).

RD-10's only hard dependency is **RD-01 (project scaffolding)**, which is complete. Unlike
the RD-07c remainder (blocked on RD-10 itself + RD-06 widening), RD-10 is **end-to-end
verifiable today**: its codegen hooks emit `StreamEntry[]`, and the RD-07a canonical
serializer `printInstr` already turns those into deterministic ACME text — so
`emitPreamble`, the startup-shim variants, `getOutputDirective`, and `encodeString` are
**golden-testable now**, without RD-09 (emitter) or any widened lowering.

Two pieces of the full RD-10 surface are genuinely coupled to RDs that do **not** exist yet
and are therefore **deferred** (slice discipline, D1): the **T4 intrinsic descriptor
contributions** (R23–R25 — `IntrinsicDescriptor` is owned by RD-17) and the **hand-written
`.asm` runtime-routine bodies** (R26–R27 — also RD-17/AR-30). The plugins still declare the
*data* shape for both (`intrinsics: []`, `runtimeModules: RuntimeModule[]` metadata) so the
seam exists and nothing is reworked when RD-17 lands.

Items D1–D5 were resolved on 2026-06-09 during plan authoring, before any plan document
depended on them, and confirmed by the user (who switched to Act mode accepting the
recommended resolution of each). The gate is **PASSED**.

---

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|----------|-----------------|-------------------|----------|--------|
| D1 | Scope / Strategy | RD-10 specifies intrinsic contributions (R23–R25) and `.asm` routine bodies (R26–R27) whose owning type/ABI (`IntrinsicDescriptor`, AR-30) is RD-17's domain and does not exist. How much of R1–R41 to build now? | A: **slice** — build the profile/interface types, the full `c64` plugin (golden-tested), the registry + loader, and profile data + validation for all 5 platforms; defer the RD-17-coupled intrinsic descriptors (ship `intrinsics: []`) and `.asm` bodies (declare `runtimeModules` metadata only) to RD-17; defer CLI/config/emitter wiring to RD-15/16/09 · B: build everything including fabricated intrinsic types now · C: build RD-17 first | **A** — slice; defer only the RD-17/RD-15/16/09-coupled parts | ✅ Resolved (user-selected) |
| D2 | Type / Conflict | RD-07a (shipped) defines `CpuVariant = "nmos6502" \| "wdc65c02"` in `packages/codegen/src/instr/stream.ts`; RD-10 spec writes `cpu: 'nmos6502' \| '65c02'`. The 65C02 spelling disagrees (`"wdc65c02"` vs `"65c02"`). One canonical type must serve both codegen validation and profiles. | A: **define canonical `CpuVariant` in `@blend65/core` keeping the shipped value `"wdc65c02"`**; codegen re-exports from core; RD-10 profiles use it · B: adopt spec spelling `"65c02"`, churn RD-07a codegen + tests · C: two separate types with a mapping | **A** — canonical `CpuVariant` in core, value `"wdc65c02"`; codegen re-exports; no codegen churn | ✅ Resolved (user-selected) |
| D3 | Behavior / Encoding | `encodeString`/`encodeChar` (R19/R20) must encode PETSCII for C64. Full PETSCII table, or the MVP subset the RD-10 §4.5 sketch shows? | A: **MVP subset** — A–Z (`$41–$5A`), a–z (`+$60` → `$C1–$DA`), 0–9 (`$30–$39`), space (`$20`), `\n`→CR (`$0D`), pass-through otherwise; exactly satisfies AC-06; full table is a later extension · B: full PETSCII table now | **A** — MVP subset per §4.5 sketch | ✅ Resolved (user-selected) |
| D4 | Scope / Depth | The 4 non-MVP platforms (`c64u`/`cx16`/`a800xl`/`a7800`): full plugins with bespoke hook bodies, or profile data + validation + registry now? | A: **data + validation + registry now** — correct profile values (R37–R41), `validateProfile`, registry entries, correct CPU variant (`cx16` = `"wdc65c02"`), `a7800` `canReturn:false`; reuse the c64 hook implementations as the shared default; bespoke per-platform hook bodies arrive when each platform is exercised · B: full bespoke plugins for all 5 now | **A** — profiles + validation + registry now; bespoke hooks later | ✅ Resolved (user-selected) |
| D5 | Process | Commit mode for execution. | ask / no-commit / auto-commit | **no-commit** (consistent with RD-01..RD-07b/RD-11a) | ✅ Resolved (user-selected) |
| D6 | Type / Migration (runtime) | The interim `PlatformProfile` (in `core/src/semantics/platform-profile.ts`, RD-04 D4 + RD-05 D2) carries **planner-tuning fields RD-10's Ch 15 profile does not have** (`mainTempBytes`, `irqTempBytes`, `zpWarnThreshold`/`ramWarnThreshold`/`stackWarnThreshold`, `zpArgBlockMin`) and naming differences (`name`/`charEncoding`/`zpArgBlockMin` vs `id`/`defaultEncoding`/`zpArgBlockSize`). It is consumed by shipped, tested RD-04 (`analyze.ts`) and RD-05 (`frontend/src/sfa/*`) code. How does RD-10 introduce the canonical profile without reworking RD-05? **+ naming:** the interim already owns the root-barrel export name `PlatformProfile`. | A: **new canonical type in `core/src/platform/`, leave the interim stub untouched**; reconcile/migrate when RD-05 consumption is wired · B: superset both field sets, replace stub, repath RD-05 imports · C: Ch15-only canonical replaces stub + move RD-05 fields to a separate `SfaBudgets` companion, update all consumers+tests now. **Naming:** A) canonical named `PlatformProfile` but exported only from subpath barrel `@blend65/core/platform`; interim keeps root barrel · B) distinct name (`PlatformProfileV2`) · C) rename interim to `InterimPlatformProfile` | **A + naming-A** — new canonical `PlatformProfile` under `core/src/platform/`, exported from a **`@blend65/core/platform` subpath barrel only**; interim stub + its root-barrel `PlatformProfile` left untouched; plugins import from the subpath; migration deferred | ✅ Resolved (runtime, user-selected) |
| D7 | Architecture / Type location (runtime) | The plugin hooks (`emitPreamble`/`emitStartupShim`/`getOutputDirective`) return `StreamEntry[]`/`AcmeDirective`, defined in `@blend65/codegen` (`instr/stream.ts`). But `PlatformPlugin` must live in `@blend65/core` (R2/AR-20), and **core must not depend on codegen**. Where does the shared Instr/stream model live? | A: **promote the pure-data stream model** (`StreamEntry`, `AcmeDirective`, `InstrStream`, `Opcode`, `AddressingMode`, `InstrOperand`, `CpuVariant`) to `@blend65/core`; `@blend65/codegen` re-exports them (symmetric with the D2 `CpuVariant` move) · B: move only the directive/stream subset (not viable — `StreamEntry` embeds opcode/mode/operand) · C: a parallel structural mirror type in core, kept in sync · D: other | **A** — promote the pure-data Instr/stream model to `@blend65/core` (`platform/` or `core/instr-model/`); codegen re-exports; no value change to shipped codegen | ✅ Resolved (runtime, user-selected) |
| D8 | Architecture / File location (runtime) | D7 fixed *that* the pure-data Instr/stream model moves to core, but left the destination **directory** open: "(`platform/` or `core/instr-model/`)". The 03-01 sketch imports from `./instr-model.js`. Which directory, and which subpath barrel exports it? | A: dedicated `core/src/instr-model/` dir with its **own new** `@blend65/core/instr-model` subpath (a 2nd subpath beyond D6) · B: **dedicated `core/src/instr-model/` dir, exported *through* the single `@blend65/core/platform` subpath barrel** (no 2nd subpath; honors D6's single-subpath commitment) · C: fold the model into `core/src/platform/` (one dir, mixes CPU/stream model with profile types) | **B** — dedicated `core/src/instr-model/` directory mirroring codegen's file split; re-exported through the single `@blend65/core/platform` subpath barrel; no second subpath added | ✅ Resolved (runtime, user-selected) |


---

## Resolution Notes

### D1 — Slice; defer the RD-17/RD-15/16/09-coupled parts (the no-rework path, user-selected)

RD-10's in-scope-today surface is everything that is verifiable end-to-end without a
not-yet-built consumer: the data types, the interface, the `c64` plugin's full hook
behavior (golden-tested through RD-07a's `printInstr`), the registry + loader, and the
profile data for all five platforms. The two deferred pieces are genuinely owned elsewhere:

- **T4 intrinsic descriptors (R23–R25)** — `IntrinsicDescriptor` is RD-17's type (AR-29).
  Fabricating it here is the rework trap. Plugins ship `intrinsics: []`; RD-17 populates
  them additively. The interface field exists so no plugin signature changes later.
- **Runtime `.asm` bodies (R26–R27)** — the hand-written ACME modules are RD-17/AR-30.
  Plugins declare `runtimeModules: RuntimeModule[]` *metadata* (name/asmPath/exports) so the
  dead-strip/link seam (RD-09) is described, but the `.asm` files themselves are not written
  here.

Likewise the **consumption surfaces** — `--platform` CLI flag (RD-15), `blend65.json`
`"platform"` (RD-16), ACME serialization of the preamble + binary check (RD-09), emulator
config (RD-12) — are *consumers* of RD-10's output and live in their own RDs. RD-10 produces
the plugin + profile; it does not wire them into the driver. This matches the AR-38
walking-skeleton discipline used for every prior slice (RD-04→04b, RD-07→07a/07b, RD-11→11a).

### D2 — Canonical `CpuVariant` in `@blend65/core`, keep the shipped `"wdc65c02"` value

RD-07a shipped `type CpuVariant = "nmos6502" | "wdc65c02"` in
`packages/codegen/src/instr/stream.ts`, and the RD-07a CPU validation tables
(`NMOS_6502_TABLE`/`W65C02_TABLE` via `cpuTableFor`), RD-07b translator, and all their
passing tests key off those exact string values. RD-10's spec text writes the 65C02 variant
as `"65c02"`. Renaming the shipped value (Option B) would churn fully-tested, committed
codegen for a cosmetic difference — exactly the rework the user has repeatedly ruled out.

**Resolution (Option A):** the canonical `CpuVariant` type lives in `@blend65/core`
(`platform/cpu-variant.ts` or the platform-profile module), with the **shipped values
`"nmos6502" | "wdc65c02"`**. `@blend65/codegen` re-exports `CpuVariant` from core (replacing
its local definition) so there is exactly one type and zero value change to the validation
tables. RD-10 `PlatformProfile.cpu` uses this canonical type; `cx16` sets `cpu: "wdc65c02"`.
The RD-07 split banner already established that core codegen's only real profile need is the
CPU variant (RD-07a D2) — D2 here simply promotes that primitive to its canonical home in
core, where R2 says the profile types belong (so frontend and codegen share it without a
circular dependency).

> **Spec-spelling note:** the frozen spec writes `65c02`. The canonical *internal* value is
> `"wdc65c02"`; if a human-facing rendering (diagnostics, profile display) ever needs the
> spec spelling, that is a presentation concern handled at the display boundary — it does not
> change the internal discriminant. Recorded so the divergence from spec prose is intentional
> and traceable, not an accident.

### D3 — PETSCII MVP subset (per the RD-10 §4.5 sketch)

`encodeChar` implements exactly the table the requirement's own C64 sketch shows: upper-case
A–Z map to `$41–$5A`; lower-case a–z map to `code + 0x60` (`$C1–$DA`); digits 0–9 and space
map to their ASCII value; `\n` maps to CR (`$0D`); any other character passes through
unchanged. `encodeString` maps each character through `encodeChar`. This satisfies AC-06
verbatim. A complete PETSCII table (graphics characters, reverse video, control codes) is a
non-breaking later extension — the function signature does not change.

### D4 — Non-MVP platforms: profile data + validation + registry now; bespoke hooks later

The four non-MVP platforms get correct, validated profile data (R37–R41), a `validateProfile`
self-check, and registry entries, with the right CPU variant and termination policy
(`cx16` → `cpu: "wdc65c02"`; `a7800` → `getMainTerminationPolicy().canReturn === false`,
`output_format: "a78"`). Their codegen hooks reuse the `c64` implementations as the shared
default behavior in this slice. Bespoke per-platform preamble/shim/encoding (e.g. ATASCII
for the Ataris, the `.a78` cartridge header for the 7800, the CX16 banked-RAM startup) is
added when each platform is first exercised end-to-end — kept out now because there is no
consumer to verify those bespoke behaviors against yet, and the appendices' finer details
(Open Questions 1–2 in RD-10) are explicitly community-dependent.

### D5 — Commit mode: `--no-commit`

The agent implements, verifies, and updates the execution plan, but performs **no** git
operations. The user handles all commits. Identical to every prior RD plan.

### D6 — New canonical `PlatformProfile` under `core/src/platform/`; interim stub untouched (runtime, user-selected)

Surfaced while authoring 03-01: the interim `PlatformProfile`
(`packages/core/src/semantics/platform-profile.ts`, RD-04 D4 + RD-05 D2) is **not** a subset
of RD-10's Ch 15 profile. It carries planner-tuning fields the canonical profile has no
business owning — `mainTempBytes`, `irqTempBytes`, `zpWarnThreshold`/`ramWarnThreshold`/
`stackWarnThreshold`, `zpArgBlockMin` — and uses different field names (`name`/`charEncoding`/
`zpArgBlockMin` vs the spec's `id`/`defaultEncoding`/`zpArgBlockSize`). It is imported and
relied on by shipped, **passing** RD-04 (`frontend/src/semantics/analyze.ts`) and RD-05
(`frontend/src/sfa/{zp-allocator,stack-analysis,budgets,plan-allocation,test-fixtures}.ts`)
code and their spec tests (`core/src/semantics/platform-profile.spec.test.ts`,
`core/src/sfa/records.spec.test.ts`). Replacing it wholesale would break RD-05 — the exact
rework the user rules out.

**Resolution (Option A + naming-A):**
- The canonical RD-10 `PlatformProfile` (Ch 15 §3 fields) is a **new** type under
  `packages/core/src/platform/` — a new directory, distinct from `semantics/`.
- It is exported from a **new core subpath barrel `@blend65/core/platform`** (added to
  `packages/core/package.json` `exports` as `"./platform"`, with a matching
  `src/platform/index.ts`). The **root** barrel (`@blend65/core`) continues to export the
  **interim** `PlatformProfile` unchanged, so every shipped RD-04/RD-05 import and test keeps
  compiling and passing untouched.
- `@blend65/platforms` plugins import the canonical types from `@blend65/core/platform`.
  `@blend65/codegen` re-exports the canonical `CpuVariant` (D2) from `@blend65/core/platform`.
- **Migration is explicitly deferred:** when RD-05's profile consumption is actually wired
  (post-RD-10, with the driver), a later step reconciles the two — folding the SFA tuning
  fields into a companion (e.g. `SfaBudgets`) and switching the root barrel to the canonical
  profile. That migration is out of RD-10's scope; RD-10 only adds, never breaks.

This keeps two profiles coexisting cleanly behind separate barrels — additive, no churn to
shipped code, and honestly labelled (the interim is not silently shadowed). It is the same
"don't break the working slice" discipline D2 applied to `CpuVariant`.

### D7 — Promote the pure-data Instr/stream model to `@blend65/core`; codegen re-exports (runtime, user-selected)

Surfaced while authoring 03-01's `PlatformPlugin` interface: the hooks `emitPreamble`,
`emitStartupShim`, and `getOutputDirective` return `StreamEntry[]` / `AcmeDirective`, which are
defined in `@blend65/codegen` (`instr/stream.ts`). But `PlatformPlugin` must live in
`@blend65/core` (R2 — so frontend can see it; AR-20), and `@blend65/core` is the root of the
dependency graph: it **cannot** import `@blend65/codegen`. A hook signature returning a
codegen type from a core interface is therefore impossible as-is.

**Resolution (Option A):** the **pure-data Instr/stream model** is promoted to `@blend65/core`
and `@blend65/codegen` re-exports it — exactly the shape of the D2 `CpuVariant` move, applied to
the whole model cluster:

- The types moved to core (a `core/src/platform/` sibling, e.g. `core/src/instr-model/`, or
  folded into `platform/`): `Opcode`, `AddressingMode`, `InstrOperand` (+ its constructors/
  guards), `AcmeDirective`, `StreamEntry`, `InstrStream` (+ `instr`/`label`/`directive`
  constructors and `isInstr`/`isLabel`/`isDirective` guards), and `CpuVariant` (D2 already
  required this one). These are **pure data + trivial constructors** — no compiler logic — so
  they belong in core (they are shared by codegen, the emitter RD-09, and now platform plugins).
- `@blend65/codegen` keeps the **logic** (`cpu-table`, `validate`, `print-instr`, the
  translator/binder/program from RD-07a/07b) and **re-exports** the moved model types from its
  existing `instr/` barrel, so every RD-07a/07b import path (`./stream.js`, the `instr/index.ts`
  barrel) and all shipped tests keep resolving and passing **by value** — only the *definition
  site* moves; the re-export surface is byte-identical.
- `PlatformPlugin` (in core) now references the core-resident `StreamEntry`/`AcmeDirective`
  directly, with no codegen dependency. The AR-20 boundary is preserved (core depends on
  nothing; codegen depends on core, as it already does).
- `printInstr` itself stays in codegen (it is the serializer — logic). The plugin goldens
  import `printInstr` from `@blend65/codegen` (the test packages may depend on codegen; only
  `frontend`/`language-server` may not — R15).

**Execution impact:** Phase 1 gains a "relocate the RD-07a pure-data model into core + codegen
re-export shim" step, performed test-first by confirming the existing codegen `instr` spec/impl
tests stay green after the move (they assert on values/strings, not definition locations). This
is a mechanical, no-value-change relocation; if it proves larger than a tidy Phase-1 task during
execution, it will be re-scoped with the user rather than expanded silently.

### D8 — Dedicated `core/src/instr-model/` directory, re-exported through `@blend65/core/platform` (runtime, user-selected)

D7 resolved *that* the pure-data Instr/stream model moves into `@blend65/core`, but left the
exact destination directory open ("`platform/` or `core/instr-model/`"), and 03-01's interface
sketch already imports from `./instr-model.js`. At the start of execution (task 1.1.1) this
became load-bearing: it fixes every import path in tasks 1.1.2 / 1.2.x and the plugin hooks.

**Resolution (Option B):**
- The moved types live in a **dedicated `packages/core/src/instr-model/` directory**, mirroring
  codegen's existing file split — `opcode.ts`, `addressing-mode.ts`, `operand.ts`, `stream.ts`
  (`StreamEntry`/`AcmeDirective`/`InstrStream` + constructors/guards), `instr-program.ts`
  (where applicable), plus `cpu-variant.ts` (the D2 `CpuVariant`) and an `index.ts` barrel —
  so the relocation is a mechanical, value-preserving 1:1 move (lowest risk per D7).
- The model is **re-exported through the single `@blend65/core/platform` subpath barrel** — the
  one new subpath D6 commits to. **No second subpath** (`@blend65/core/instr-model`) is added;
  `core/src/platform/index.ts` re-exports the `instr-model` barrel so `@blend65/core/platform`
  surfaces both the profile/plugin types and the model types `PlatformPlugin` references.
- `@blend65/codegen`'s `instr/` barrel re-exports the moved model from core (D7), keeping all
  shipped RD-07a/07b import paths and tests resolving by value, unchanged.

**Rationale:** keeps the model as its own clean module (distinct from platform-profile concerns,
matching the 03-01 `./instr-model.js` sketch) while honoring D6's single-subpath commitment;
mild semantic oddity of a CPU model surfaced via the "platform" barrel is outweighed by adding
zero new package-export surface and minimizing churn.

---

## Surface-during-authoring rule


If authoring or implementation surfaces a *new* ambiguity, **STOP**, add it here as the next
`D-N` (tagged `(runtime)` if found during execution), resolve it with the user,
back-propagate the resolution into the affected plan documents, then resume. Do not fill gaps
by guessing.
