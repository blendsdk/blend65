# Ambiguity Register: RD-08 Peephole Optimizer (passthrough v1)

> **Status**: ✅ GATE PASSED — all 9 items resolved (carried from the RD-08 preflight)
> **Last Updated**: 2026-06-10
> **Source of truth**: `requirements/00-preflight-report.md` (PF-001..PF-009) +
> `requirements/RD-08-peephole-optimizer.md` (frozen-discovery RD; ARs cited inline).

This register is the audit trail for the RD-08 *implementation plan*. RD-08's own discovery
is closed (Zero-Ambiguity Gate PASSED at the spec/RD level); every design decision in this
plan traces either to a frozen `AR-NN` in `requirements/00-ambiguity-register.md` or to a
preflight resolution `PF-NNN` recorded in `requirements/00-preflight-report.md`. The preflight
realigned the (2026-05-31) RD with the back end that shipped afterward (RD-07b/07c).

The keystone is **v1 scope = THIN PASSTHROUGH** (recorded in the preflight): v1 validates
structure and returns the program unchanged; the sliding-window scanner, its iteration limit +
ICE, and rule plumbing are deferred to the rules milestone.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| AR-P1 | Technical (signature) | `optimizeInstr` had two contradictory signatures (RD §4.2 vs §4.7) | A: §4.7 public shape, internal `V1_RULES=[]` / B: §4.2 rules-injected | A — §4.7 shape; `rules` internal | ✅ Resolved (PF-001) |
| AR-P2 | Technical (type) | RD used `'65c02'` + a local `CpuVariant` redefinition | A: import canonical `"nmos6502"\|"wdc65c02"` from core / B: local alias | A — import canonical core type | ✅ Resolved (PF-002) |
| AR-P3 | Architecture (seam) | RD passed a full `PlatformProfile`; back end threads bare `CpuVariant` | A: `optimizeInstr(program, cpuVariant, bag, options?)` / B: keep profile | A — bare `CpuVariant` primitive | ✅ Resolved (PF-003) |
| AR-P4 | Completeness (data) | `InstrProgram.preamble`/`allocationPlan` passthrough unspecified | A: pass verbatim, only `streams[].entries` eligible / B: scan preamble | A — verbatim passthrough | ✅ Resolved (PF-004) |
| AR-P5 | Scope (engine) | Iteration-limit ICE `E9_PEEPHOLE_LIMIT` not in registry | A: add `E90002` now / B: reuse `E90001` / C: defer with the scanner | C — defer; no ICE/limit in v1 | ✅ Resolved (PF-005) |
| AR-P6 | Testability | "well-formed `InstrProgram`" (R6) checks undefined | A: enumerate structural predicates / B: drop, rely on TS types | A — enumerate predicates | ✅ Resolved (PF-006) |
| AR-P7 | Contract (stats) | `PeepholeStats` return channel ambiguous (§4.8) | A: v1 returns only `InstrProgram`, stats = Phase-B seam / B: `{program,stats}` now | A — return `InstrProgram` only | ✅ Resolved (PF-007) |
| AR-P8 | Consistency (docs) | RD header "Phase B" vs roadmap "Phase A" | A: annotate header / B: leave as-is | A — header annotated | ✅ Resolved (PF-008) |
| AR-P9 | Scope (engine) | `maxWindowSize` used but undefined (§4.3) | A: define `max(rule.windowSize)` now / B: defer to rules milestone | Deferred by THIN-PASSTHROUGH scope | ✅ Resolved (PF-009) |

## Resolution Notes

**AR-P1/AR-P3 (the public signature).** The authoritative v1 signature is:
```typescript
export function optimizeInstr(
  program: InstrProgram,
  cpuVariant: CpuVariant,        // bare primitive; a driver passes plugin.profile.cpu
  bag: DiagnosticBag,
  options?: PeepholeOptions,     // { enabled?: boolean } — default enabled
): InstrProgram;
```
This mirrors `generateInstr(ilProgram, cpuVariant, bag)` and `validateStream(stream,
cpuVariant, bag)` exactly (verified in `packages/codegen/src/instr/instr-program.ts:63` and
`.../validate.ts`). `rules` is an internal `const V1_RULES: PeepholeRule[] = []`.

**AR-P4 (verbatim passthrough).** v1 returns the input `InstrProgram` reference unchanged —
`preamble`, `streams`, and `allocationPlan` all carried through identically (byte-identical
golden snapshot). Only `streams[].entries` will ever be eligible for rewriting once rules land.

**AR-P5/AR-P9 (scope deferral).** Under THIN PASSTHROUGH the sliding-window scanner (§4.3) is
not built in v1, so the iteration limit (R18), its ICE, and `maxWindowSize` have no call site.
Adding them now would ship unreachable code (violates `code.md` Rule 4 — No Dead Code). They
arrive with the first real rule.

**AR-P6 (structural predicates).** `validateProgramStructure(program, bag)` asserts: (1)
`program.streams` is a present non-null array; (2) each `StreamEntry` is a valid discriminated
union — exactly one of `isInstr`/`isLabel`/`isDirective` holds; (3) no `null`/`undefined`
entries. Opcode legality stays with `validateStream` (already run in `generateInstr`). Any
violation is an ICE (`E90001`), never a user-band diagnostic (R30).

## Surface-During-Authoring / Runtime

No new ambiguities surfaced while authoring this plan. If implementation surfaces one, STOP,
add it here as the next `AR-PN (runtime)`, resolve with the user, then resume and
back-propagate into the affected plan docs (per `.clinerules/project.md`).
