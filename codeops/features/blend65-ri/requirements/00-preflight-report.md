# Preflight Report: RD-08 — Peephole Optimizer

> **Status**: ✅ PASS — all 9 findings resolved (iteration 2)
> **Iteration**: 2 (decisions recorded 2026-06-10)
> **Artifact**: Requirement document at `requirements/RD-08-peephole-optimizer.md`
> **Codebase Grounded**: ✅ 11 source files examined, ~14 references verified
> **Last Updated**: 2026-06-10

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), Yarn workspaces + Turborepo, Vitest.
**Architecture:** AOT compiler pipeline; the RD-08 stage sits between codegen
(`generateInstr`/`assembleProgram`, RD-07b/c) and the ACME emitter (RD-09), all in
`@blend65/codegen`. The `Instr` model lives in `@blend65/core` (`instr-model/`) and is
re-exported by codegen.

**Key Files Examined:**
- `packages/core/src/instr-model/stream.ts` — `StreamEntry`, `InstrStream`, `AcmeDirective`,
  `instr/label/directive` ctors, `isInstr/isLabel/isDirective` guards.
- `packages/core/src/instr-model/cpu-variant.ts` — canonical `CpuVariant = "nmos6502" | "wdc65c02"`.
- `packages/codegen/src/instr/instr-program.ts` — `InstrProgram` (has `preamble`, `streams`,
  `allocationPlan`), `generateInstr(ilProgram, cpuVariant, bag)`, `assembleProgram(ilProgram, plugin, bag)`, `programByteSize`.
- `packages/codegen/src/instr/validate.ts` — `validateStream(stream, cpuVariant, bag)`, `isLegalMode`.
- `packages/codegen/src/instr/print-instr.ts` — `instrByteSize(entry)`.
- `packages/core/src/platform/platform-profile.ts` — `PlatformProfile` (`cpu: CpuVariant`).
- `packages/core/src/diagnostics/diagnostic-bag.ts` — `DiagnosticBag.addICE(code, span, message)`.
- `packages/core/src/diagnostics/diagnostic-codes.ts` — `IceCode = { Unexpected: "E90001" }`, `isIceCode`.
- `packages/codegen/src/index.ts` — public barrel (re-exports `instr/`).

**Reference Verification:** 14 references mapped to code — 9 verified accurate, 5 misaligned
(see findings).

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 4 | ✅ 4 resolved |
| 🟡 MINOR | 3 | ✅ 3 resolved |
| 🔵 OBSERVATION | 2 | ✅ 2 resolved |

---

### Keystone decision — v1 scope: THIN PASSTHROUGH

> **Decision (2026-06-10):** v1 `optimizeInstr` returns the program structurally
> unchanged (preamble + streams + allocationPlan) after a structural well-formedness
> check. **No** sliding-window scanner, iteration limit, ICE path, or rule plumbing is
> built in v1 — that machinery lands with the first real rule (rules milestone). This
> honors the roadmap's "near-trivial no-op / passthrough v1" intent and the No-Dead-Code
> rule (no unreachable engine code in v1). This decision is the keystone that resolves
> PF-005 and PF-009 by deferral.

---

### PF-001: `optimizeInstr` signature contradicts itself 🟠 MAJOR

**Dimension:** 3 (Logical Contradictions)
**Location:** `RD-08-peephole-optimizer.md` §4.2 vs §4.7
**The Problem:** §4.2 declares `optimizeInstr(program, profile, rules, options, bag)`
(5 params, rules explicit) while §4.7 "Public API" declares
`optimizeInstr(program, profile, bag, options?)` (4 params, no `rules`, `bag` before `options`).
These are two incompatible signatures for the same exported function.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Adopt §4.7 as the public signature; `rules` is an internal module constant (`V1_RULES = []`) | Matches v1 "empty rule set" reality; small surface | §4.2 must be edited to match |
| B | Adopt §4.2 (rules injected) | Easier rule testing | Exposes internal taxonomy publicly; over-broad for v1 |

**🎯 Recommendation:** Option A.

**User Decision:** ✅ Resolved — Option A. Public signature is §4.7 shape (corrected per
PF-003); `rules` is an internal constant `V1_RULES = []`. §4.2 edited to match.

---

### PF-002: `CpuVariant` literal `'65c02'` and local redefinition are wrong 🟠 MAJOR

**Dimension:** 13 (Codebase Alignment — Stale Assumption / Redundancy)
**Location:** `RD-08-peephole-optimizer.md` §4.1 (`type CpuVariant = 'nmos6502' | '65c02'`)
**Codebase Evidence:** `packages/core/src/instr-model/cpu-variant.ts:25` —
`export type CpuVariant = "nmos6502" | "wdc65c02";` (the 65C02 value is **`"wdc65c02"`**, a
deliberate decision, D2). `PlatformProfile.cpu` uses this exact type.
**The Problem:** The RD both (a) **redefines** `CpuVariant` locally instead of importing the
canonical core type, and (b) uses the literal `'65c02'`, which is not a member of the shipped
union. Rule `cpuCompat` filtering compares against `profile.cpu` (`"wdc65c02"`), so the RD's
`'65c02'` literal would never match and wouldn't typecheck.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Import the canonical `CpuVariant` from `@blend65/core`; drop the local type; use `"wdc65c02"` | One source of truth; matches shipped code | RD edit |
| B | Keep a local alias but fix the literal to `"wdc65c02"` | Minimal edit | Still a redundant duplicate type (drift risk) |

**🎯 Recommendation:** Option A.

**User Decision:** ✅ Resolved — Option A. Import canonical `CpuVariant` from `@blend65/core`;
delete the local redefinition; the 65C02 spelling is `"wdc65c02"`.

---

### PF-003: Passing a full `PlatformProfile` breaks the established codegen seam 🟠 MAJOR

**Dimension:** 13 (Architecture Mismatch) / 2 (Implicit Assumptions)
**Location:** `RD-08-peephole-optimizer.md` §4.2/§4.3/§4.7 (`profile: PlatformProfile`, reads `profile.cpu`)
**Codebase Evidence:** `packages/codegen/src/instr/instr-program.ts:63` —
`generateInstr(ilProgram, cpuVariant: CpuVariant, bag)` takes the **bare `CpuVariant`
primitive**, with the JSDoc explicitly stating "no `PlatformProfile` is fabricated" (RD-07b D2).
The only place the full plugin/profile is handled is `assembleProgram(ilProgram, plugin, bag)`.
**The Problem:** RD-08 is the only field consumed from the profile is `cpu`. Taking a whole
`PlatformProfile` contradicts the deliberate RD-07b decision to thread only `CpuVariant`
through the back end, and forces the RD-09 driver to fabricate/forward a profile the rest of
the back end avoids.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | `optimizeInstr(program, cpuVariant: CpuVariant, bag, options?)` | Matches `generateInstr`/`validateStream` exactly; minimal coupling | RD edit; future rules needing more profile data would re-plumb |
| B | Keep `PlatformProfile` | Future rules get richer platform data for free | Breaks the CpuVariant-only seam; over-couples v1 |

**🎯 Recommendation:** Option A.

**User Decision:** ✅ Resolved — Option A. Signature is
`optimizeInstr(program, cpuVariant: CpuVariant, bag, options?)`, mirroring `generateInstr`
and `validateStream`. A driver holding a plugin passes `plugin.profile.cpu`.

---

### PF-004: `InstrProgram.preamble` passthrough is unspecified 🟠 MAJOR

**Dimension:** 4 (Completeness Gaps) / 13 (Codebase Alignment)
**Location:** `RD-08-peephole-optimizer.md` §3.5 R25, §4.4
**Codebase Evidence:** `packages/codegen/src/instr/instr-program.ts:38-45` — `InstrProgram` has
three fields: `preamble: readonly StreamEntry[]`, `streams`, `allocationPlan`. The `preamble`
field was added by RD-07c, **after** RD-08 was authored (2026-05-31). The preamble is filled
by `plugin.emitPreamble(options)` — platform startup scaffolding (origin/`!to`/symbol defs).
**The Problem:** RD-08 only talks about `streams[].entries` (R25: "never changes the number of
`InstrStream` entries") and never mentions `preamble` or `allocationPlan`. The §4.4 v1 sketch
`{ ...program, streams: ... }` would carry `preamble` through by virtue of the spread, but the
spec is silent on whether the preamble's instruction entries (e.g. a startup shim) are
optimization candidates or must pass through verbatim.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Specify: `preamble` and `allocationPlan` pass through **verbatim**; only `streams[].entries` are eligible | Safe; preamble is platform-emitted ACME scaffolding (P3) | RD edit |
| B | Allow the optimizer to also scan `preamble` instr entries | Could shave shim bytes later | Risk of rewriting platform-critical startup code; against AR-64/65 spirit |

**🎯 Recommendation:** Option A.

**User Decision:** ✅ Resolved — Option A. `preamble` and `allocationPlan` pass through
**verbatim**; only `streams[].entries` are ever eligible for rewriting. New requirement + AC
added to the RD.

---

### PF-005: ICE code `E9_PEEPHOLE_LIMIT` does not exist in the registry 🟡 MINOR

**Dimension:** 13 (Phantom Reference) / 4 (Completeness)
**Location:** `RD-08-peephole-optimizer.md` §4.3 (`bag.addICE(E9_PEEPHOLE_LIMIT, …)`), R18/R31
**Codebase Evidence:** `packages/core/src/diagnostics/diagnostic-codes.ts:178-181` — the only
ICE constant is `IceCode.Unexpected = "E90001"`. There is no `E9_PEEPHOLE_LIMIT`.
**The Problem:** R18 requires an ICE on hitting the iteration limit, but the named code is not
registered. (The `addICE(code, span, message)` call shape itself is correct.)

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a new `IceCode.PeepholeLimit = "E90002"` to the registry during implementation | Distinct, greppable; matches one-registry rule | Tiny registry edit |
| B | Reuse `IceCode.Unexpected` ("E90001") with a descriptive message | No registry change | Less specific; harder to assert in tests |
| C | Do NOT add the iteration limit or its ICE in v1 — both arrive with the first real rule | No unreachable code path, no unused constant in v1; YAGNI-honest; honors No-Dead-Code | Engine machinery deferred to rules milestone |

**🎯 Recommendation:** Option C (given the THIN PASSTHROUGH keystone decision).

**User Decision:** ✅ Resolved — Option C. The iteration limit (R18) and its ICE are part of
the sliding-window scanner, which is **not built in v1** (thin passthrough). Both land with the
first real rule. No `E90002` constant is added now, avoiding an unreachable v1 code path.

---

### PF-006: `validateStreamStructure` ("well-formed") is undefined 🟡 MINOR

**Dimension:** 7 (Testability) / 4 (Completeness)
**Location:** `RD-08-peephole-optimizer.md` R6, §4.4 (`validateStreamStructure(stream, bag)`)
**The Problem:** R6 says v1 "verifies the input is a well-formed `InstrProgram` (non-null
streams, valid structure)" but never enumerates the concrete checks, making the AC untestable
as written. Note the back end already runs `validateStream` (CPU legality) inside
`generateInstr`, so structural re-validation must define what *additional* property it asserts.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Enumerate the exact invariants (streams array present, each entry a valid discriminated union, no `null` entries) and drop CPU re-check to R22 | Testable; no overlap with `validateStream` | RD edit |
| B | Drop structural validation in v1 (rely on TS types) | Simplest | Loses the "catch integration bugs early" intent of R6 |

**🎯 Recommendation:** Option A.

**User Decision:** ✅ Resolved — Option A. R6 enumerates the precise structural predicates:
(1) `streams` is an array (present, non-null); (2) each `StreamEntry` is a valid discriminated
union (`isInstr`/`isLabel`/`isDirective` matches exactly one); (3) no `null`/`undefined`
entries. Opcode legality remains the responsibility of the existing `validateStream`.

---

### PF-007: `PeepholeStats` return channel is ambiguous 🟡 MINOR

**Dimension:** 1 (Ambiguities)
**Location:** `RD-08-peephole-optimizer.md` §4.8 ("returned alongside the `InstrProgram` (or as
a side-channel attached to the program)")
**The Problem:** The stats delivery mechanism is left as an either/or. §4.7's public signature
returns only `InstrProgram`, so there is no defined channel for `PeepholeStats`. v1 emits no
stats (R7), so this is deferrable — but the shape should be pinned so RD-11 (resource report)
has a stable contract.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | v1 returns only `InstrProgram`; defer the stats channel to the rules milestone, note it as a documented seam | Keeps v1 minimal; honest about scope | RD-11 wiring deferred |
| B | Define a `{ program, stats }` result object now | Stable contract up front | Adds unused surface in v1 |

**🎯 Recommendation:** Option A.

**User Decision:** ✅ Resolved — Option A. v1 returns only `InstrProgram`. The `PeepholeStats`
channel is recorded as an explicit Phase-B seam (RD-11 resource-report contract) so it is not
silently forgotten.

---

### PF-008: RD header "MVP Phase: B" vs roadmap "Phase A" 🔵 OBSERVATION

**Dimension:** 12 (Consistency)
**Location:** `RD-08-peephole-optimizer.md` header (`MVP Phase: B`) vs `plans/ROADMAP.md`
(RD-08 passthrough at Phase A / order 1)
**The Problem:** The roadmap intentionally pulls the **passthrough stage** into Phase A as a
pipeline prerequisite while leaving the rule catalog in Phase B. The RD header still reads
"Phase B" flatly. Not a defect (the roadmap note already explains the split), but a reader
comparing the two will see a mismatch.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Annotate the RD header: "Phase B (passthrough seam pulled into Phase A per roadmap)" | Self-consistent docs | Tiny RD edit |
| B | Leave as-is; rely on the roadmap note | Zero edit | Mild cross-doc confusion |

**🎯 Recommendation:** Option A.

**User Decision:** ✅ Resolved — Option A. RD header annotated:
"Phase B (passthrough seam pulled into Phase A per roadmap)".

---

### PF-009: `maxWindowSize` used but never defined 🔵 OBSERVATION

**Dimension:** 1 (Ambiguities)
**Location:** `RD-08-peephole-optimizer.md` §4.3 (`i = max(0, i - maxWindowSize + 1)`)
**The Problem:** The cascade back-up uses `maxWindowSize`, which is never defined (presumably
the max `windowSize` over the active rules). Irrelevant to v1 (no rules), but the algorithm
description is incomplete for the rules milestone.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Define `maxWindowSize = max(rule.windowSize)` (or 0 when no rules) near the algorithm | Complete description | Tiny RD edit |
| B | Leave for the rules milestone | Zero edit now | Algorithm reads incomplete |

**🎯 Recommendation:** Option A (one sentence makes the pseudocode self-contained), but under
the THIN PASSTHROUGH keystone the scanner itself is deferred.

**User Decision:** ✅ Resolved — Deferred by scope. The sliding-window scanner (including
`maxWindowSize`) is **not built in v1**; it lands with the first real rule. The RD's §4.3
pseudocode is annotated as rules-milestone (Phase-B) material, with `maxWindowSize` defined as
`max(rule.windowSize)` (0 when no rules) at that time. Moot for thin-passthrough v1.

---

## Verdict

**✅ PREFLIGHT PASS (iteration 2).** All 9 findings resolved. The 4 🟠 MAJOR findings
(PF-001..PF-004) are resolved via Option A — aligning RD-08's API with the shipped back-end
seam (one canonical `CpuVariant`, bare-primitive threading mirroring `generateInstr`/
`validateStream`, and verbatim `preamble`/`allocationPlan` passthrough). The keystone v1-scope
decision (THIN PASSTHROUGH) resolves PF-005 and PF-009 by deferring the sliding-window scanner
(and its iteration limit + ICE) to the rules milestone, keeping v1 free of unreachable code.
PF-006/007/008 resolved via Option A. RD-08's core design (passthrough-first, label/directive
barriers, size/CPU invariants) is sound and well-aligned with the shipped `Instr` model.

**`make_plan` is unblocked.**
