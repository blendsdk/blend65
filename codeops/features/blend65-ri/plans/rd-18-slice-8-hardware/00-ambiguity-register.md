# Ambiguity Register: RD-18 Slice 8a — Hardware (`rd-18-slice-8-hardware`)

> **Status**: ✅ GATE PASSED — all 29 items resolved (22 decided, 7 named deferrals to the 8b gate)
> **Last Updated**: 2026-07-17 12:41
> **Artifact**: implementation plan `codeops/features/blend65-ri/plans/rd-18-slice-8-hardware/`
> **Source RD**: `../../requirements/RD-18-codegen-language-completion.md` (Slice 8 row + acceptance items 7–9; Parked Q2 routed here → deferred to 8b per AR-1/AR-23)
>
> Register compiled from: the RD-18 Slice 8 charter; a full deferral sweep of the prior
> slice plans + the RD-04 deferred-semantics ledger; a spec sweep of Ch 01/03/04/05/06/08/10/11/12/13
> + F004/F005/F006/F007/F015 + `grammar.ebnf.md` + `14-diagnostics.md`; a current-state code map
> (parser/analyzer/SFA/lowering/translate/platforms); and one independent challenger review of the
> three high-stakes rows (AR-1/AR-15/AR-16 — verdicts in the Resolution Notes). `spec/` is frozen
> (D3) — every spec-internal conflict below is resolved in the plan + `diagnostic-codes.ts` only,
> with the deviation recorded (AR-115 precedent).
>
> **Outcome per AR-1**: Slice 8 is SPLIT. This register gates the **8a hardware plan**
> (`&` address-of, interrupt functions, zeropage blocks, non-terminating `main`, T1 E2E).
> Rows AR-19..24 + AR-28 are named deferrals to the **8b** gate (`rd-18-slice-8b-strings-embed`).

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Scope | **Split Slice 8?** Surface = `&` + interrupts + zeropage + non-terminating `main` + T1 intrinsics E2E + strings/encoding + `embed()` — a single plan would be the largest of the rollout (~70+ tasks). Slice 7 precedent: split at the gate (7a/7b). | (a) Split: 8a hardware + 8b data, 8a first (closure rides the last plan; 8a's `isEscaped` flip perturbs SFA layout/goldens and settles before 8b's golden) — RECOMMENDED (challenger-affirmed; const-data path already shipped, `cfg.ts:64-72` pre-types an `"embed"` arm); (b) single plan | **Split 8a/8b** (accepted recommendation) | ✅ Resolved |
| 2 | Naming | Plan dir + fixture names. | (a) This plan `rd-18-slice-8-hardware`, fixture `examples/slice8/`; 8b later: `rd-18-slice-8b-strings-embed` + `examples/slice8b/` (mirrors slice-7 naming) — RECOMMENDED; (b) other | **(a)** — user accepted recommendation (bulk) | ✅ Resolved |
| 3 | Scope | RD-18 acceptance items 8–9 (rollout closure) — which plan owns the closure phase? | (a) The LAST slice-8 plan (= 8b after the split) — RECOMMENDED; (b) separate mini-task after | **(a) closure rides 8b** — user accepted recommendation (bulk) | ✅ Resolved |
| 4 | Scope | Unassigned deferral: **indexed compound-assign through a runtime index / pair** (loud ICE `lower.ts:1405/:1411`) | (a) OUT — ICE stays loud; cleanup slice / Phase B — RECOMMENDED; (b) into Slice 8 | **OUT** (accepted recommendation) | ✅ Resolved |
| 5 | Scope | Unassigned deferral: **runtime `--bounds-check` flag** (7a AR-8) | (a) OUT — RD-13/Phase-B backlog — RECOMMENDED; (b) in | **OUT** (accepted recommendation) | ✅ Resolved |
| 6 | Scope | Unassigned deferral: **W10181 unused-function** ("Slice 8+" liveness) | (a) OUT — cleanup slice once `&` liveness exists — RECOMMENDED; (b) in | **OUT** (accepted recommendation) | ✅ Resolved |
| 7 | Scope | Unassigned deferral: **Pattern-B full-range `for … to <type-max>`** (loud ICE `lower.ts:572`) | (a) OUT — cleanup/Phase B — RECOMMENDED; (b) in | **OUT** (accepted recommendation) | ✅ Resolved |
| 8 | Scope | Unassigned deferrals: **caller-frame-scratch ICEs** + **`import {X as Y}` aliasing** (5a) | (a) OUT — cleanup slice — RECOMMENDED; (b) in | **OUT** (accepted recommendation) | ✅ Resolved |
| 9 | Scope | Unassigned deferral: **block-scope lifetime/shadowing R11** (E10101/E10062) | (a) OUT — cleanup slice — RECOMMENDED; (b) in | **OUT** (accepted recommendation) | ✅ Resolved |
| 10 | Behavioral | **`&` operand surface + rejection codes.** Ch04/F006's E10040/E10041/E10043 are SPENT on intrinsic errors in the shipped registry; only E10042 (`AddressOfElementDeferred`) is reserved. Valid operands (Ch04 §8): module/local/zeropage vars, functions (incl. interrupt), const aggregates. Invalid: const scalar, parameter, field/element (FUT-001), literal/expression. | (a) Mint additively (AR-115 precedent): **E10047** AddressOfConstScalar, **E10048** AddressOfParameter, **E10049** AddressOfNonAddressable; wire **E10042** for `&a[i]`/`&s.f` (numbers verified free) — RECOMMENDED; (b) blanket code | **(a)** — user accepted recommendation (bulk) | ✅ Resolved |
| 11 | Behavioral | **`&fn` semantics**: result `word`; fn marked address-taken (`model-adapter.ts:68` `isEscaped`→true); indirect calls stay the FN-A9 documented limitation; qualified `&Module.fn` works (retires 5b AR-13 ICE); `&interruptFn` allowed (install path). | (a) Spec-verbatim as stated — RECOMMENDED (no viable alternative) | **(a)** — user accepted recommendation (bulk) | ✅ Resolved |
| 12 | Naming/Syntax | **Interrupt declaration syntax fork**: shipped parser = bare `interrupt function name()` (rejects `: void`); Ch06/F007 = `(): void`; spec examples unparseable today. | (a) Extend parser: optional `: void` (non-void annotation → E10050) — RECOMMENDED; (b) bare-only + deviation | **Accept optional `: void`** (accepted recommendation) | ✅ Resolved |
| 13 | Behavioral | **`export interrupt`**: parser rejects (E10311, FR-23); Ch06 grammar allows `[export]`. | (a) Keep the rejection; deviation recorded; lift later if needed — RECOMMENDED; (b) allow now | **Keep rejection** (accepted recommendation) | ✅ Resolved |
| 14 | Behavioral | **Interrupt ABI**: prologue `PHA/TXA/PHA/TYA/PHA`, epilogue `PLA/TAY/PLA/TAX/PLA/RTI`, spec-verbatim (Ch06 §7.3), unconditional (Phase A — no clobber analysis); locals allowed; calls from body allowed; mint+wire **E10050** (wrong signature). | (a) Spec-verbatim — RECOMMENDED (spec-mandated) | **(a)** — user accepted recommendation (bulk) | ✅ Resolved |
| 15 | Technical | **SFA correctness for the interrupt path** (miscompile-class). Challenger-corrected: handler frames are ALREADY always-live (`interference.ts:104-112`, ST-I3); the holes are (i) irq-only-reachable HELPERS can legally overlap mainline frames (confirmed); (ii) spilled mainline temps — the `__zp_irq_tmp_N` category has ZERO consumers (`register-binding.ts:133-135` draws from `"temp"` only), violating Ch06 §7.6. | (a) ONE irq-reachability classification, three consumers: (1) every fn reachable from an interrupt root joins the Step-2 always-live set in `buildInterferenceGraph` (frames + pointer-pairs inherit via `graph.edges`; handler-vs-handler NMI/IRQ subtrees mutually covered); (2) spill-temp POOL keyed on irq-path membership (flag threaded through `translateFunction`); (3) conditional `__zp_irq_ptr_scratch` twin (mirrors `modelNeedsPointerScratch`). Both-path fns: always-live for placement, MAIN temp pool; residual self-reentrancy = the spec's documented-unenforced hazard (Ch06 §7.4/§7.5, FUT-004). "Mainline" = complement-of-irq-only (covers `__init`) — RECOMMENDED (challenger-amended); (b) alternative | **Adopt the rule** (accepted recommendation) | ✅ Resolved |
| 16 | Integration | **Acceptance-fixture ABI defect** (challenger-VERIFIED): `pokew($0314, &onIRQ)` + the spec RTI epilogue crashes — KERNAL's $FF48 pushes A/X/Y before `JMP ($0314)`; $0314 routines must exit `JMP $EA31/$EA81`. The broken example is in the frozen spec (Ch06 §7.7) — recorded spec-internal inconsistency (D3). Shipped shim keeps KERNAL banked in ($01=$36). | (a) Hardened raw-vector fixture: `SEI`; mask CIA-1 (`poke($DC0D,$7F)`); flush latched IRQ (`peek($DC0D)`); `pokew($FFFE,&onIRQ)` + `pokew($FFFA,&onNMI)` (empty NMI hardening); bank `poke($01,$35)` (fetch needs it; writes hit RAM regardless); VIC raster `poke($D01A,$01)`, `poke($D012,line)`, RMW `$D011` (`& $7F`); pre-ack `poke($D019,$FF)`; `CLI`; `while(true)`. Handler: ack `$D019`, `INC $D020`, SATURATING ZP counter (equality-poll trap). Assert: counter primary (`runFrames` + `>=`), `$D020 & $0F` secondary — RECOMMENDED; (b) $0314 + `JMP $EA31` exit codegen — named, NOT spec-conformant | **Raw-vector fixture** (accepted recommendation) | ✅ Resolved |
| 17 | Behavioral | **Multiple `zeropage {}` blocks per module**: F005 ≤1 (E10030) vs 5b cross-file module merging (one module spans files). | (a) Allow multiple + merge (dup names reject via existing E10003 path; F005 one-block rule = superseded deviation; E10030 unminted) — RECOMMENDED; (b) enforce one (mint E10030) | **Allow multiple + merge** (accepted recommendation) | ✅ Resolved |
| 18 | Data & state | **Zeropage semantics**: fields = module vars with ZP storage — 5b typing/init parity (const-only, call-free initializers), explicit initializers join `__init`, NO zero-fill (spec ZP-4), always mutable, module-level only; placement via dormant `ZpInput.userVars` priority-1 category (`zp-allocator.ts:193`); aggregates allowed via EXISTING framings (ZP addrs are valid absolute operands; ACME auto-selects zp mode, 2-digit-equate discipline); E10032/W10030 wired. Boundary pin: `zeropage { msg: byte[6] = "HELLO"; }` stays the 7a loud string-init rejection in 8a (negative test). | (a) Full surface as stated — RECOMMENDED; (b) scalars-only | **Full surface** (accepted recommendation) | ✅ Resolved |
| 19 | Behavioral | *(8b)* String quoting + escape set fork (shipped lexer/Ch01 vs Ch08 STR-5 vs grammar single-quotes). | (a) Shipped lexer (Ch01) canonical — RECOMMENDED; (b) STR-5 set | ⏸ Deferred — string quoting + escape-set canon · owner: user · revisit: the 8b make_plan gate (`rd-18-slice-8b-strings-embed`) | ⏸ Deferred |
| 20 | Behavioral | *(8b)* Default string/char encoding fork (shipped profiles/appendices `petscii`/`atascii`/`ascii` vs Ch08 table `screen_codes`/`internal_codes`/`raw`). | (a) Platform profiles win — RECOMMENDED; (b) Ch08 table | ⏸ Deferred — default-encoding source of truth · owner: user · revisit: the 8b make_plan gate | ⏸ Deferred |
| 21 | Scope | *(8b)* Encoding-intrinsic scope (`encode()` + Ch08's four named intrinsics have no lexical/grammar status; E10125 unminted). | (a) Minimal: platform-default encoding only; intrinsics deferred — RECOMMENDED; (b) Ch08 family now | ⏸ Deferred — encoding-intrinsic scope · owner: user · revisit: the 8b make_plan gate | ⏸ Deferred |
| 22 | Data & state | *(8b)* String-initializer diagnostics (retire 7a `E90001` ICE; reuse array-init machinery; E10124/E10125/E10116 reserved). | (a) Reuse + mint-on-gap — RECOMMENDED; (b) mint band up front | ⏸ Deferred — string-init diagnostic mapping · owner: user · revisit: the 8b make_plan gate | ⏸ Deferred |
| 23 | Security | *(8b)* **Parked Q2** — `embed()` path resolution + traversal safety (source-file-relative, canonicalize, reject outside project root → E10201; no `--asset-path`). | (a) As stated — RECOMMENDED; (b) + project-root fallback; (c) + `--asset-path` | ⏸ Deferred — embed path-resolution policy (Parked Q2) · owner: user · revisit: the 8b make_plan gate | ⏸ Deferred |
| 24 | Scope | *(8b)* `embed()` scope (raw-binary only; `format` arg loud-unsupported; wire E10200/E10201/E10202; stat-before-read budget bound). | (a) Raw-only — RECOMMENDED; (b) format/selectors now | ⏸ Deferred — embed scope (raw vs format-aware) · owner: user · revisit: the 8b make_plan gate | ⏸ Deferred |
| 25 | Technical | **Non-terminating `main`**: `startup:"auto"` hardcodes the terminating shim (`instr-program.ts:208`, SEAM comment). | (a) Auto termination analysis: main's IL CFG exit unreachable ⇒ `"non-terminating"` shim (`JMP _main`, shipped); fold platform `canReturn` (a7800 halt); manual overrides stay — RECOMMENDED; (b) leave manual-only | **Implement auto analysis** (accepted recommendation) | ✅ Resolved |
| 26 | Integration | **T1 intrinsics end-to-end**: 13 `asm_*` already registered + `T1_OPCODES` wired; E2E = fixture exercises `asm_sei`/`asm_cli` + per-opcode coverage test (gaps become tasks). | (a) As stated — RECOMMENDED | **(a)** — user accepted recommendation (bulk) | ✅ Resolved |
| 27 | Process | **Verify command** (from CLAUDE.md): `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`. | (a) Confirm as detected — RECOMMENDED; (b) other | **(a)** — user accepted recommendation (bulk) | ✅ Resolved |
| 28 | Technical | *(8b)* **Encoding architecture seam** (challenger-surfaced): const-eval runs in `@blend65/frontend` (core-only dependency, R15) but encoders live in `@blend65/platforms` — needs a core-defined encoder interface injected into analysis. | (a) Core-defined seam (design at the 8b gate) — RECOMMENDED shape; (b) alternative | ⏸ Deferred — the frontend↔platform encoding seam design · owner: user · revisit: the 8b make_plan gate | ⏸ Deferred |

| 29 | Scope | **7b by-ref argument-place ICEs** (surfaced during authoring): `f(enemies[i])` / `f(p.field)` to a by-ref param ICE at lowering ("needs address-of", `lower.ts:904-908`; 7b AR-3 said "revisit at Slice 8 `&`"). Internal address materialization, independent of user-facing `&` (element `&` stays E10042/FUT-001). Must land before RD-18 closes. | (a) IN 8a — sits directly on 8a's `&`/addr machinery (7b formation + scratch pair; compute the place address at the call site, store into the callee frame home); ICE pins retired per the loud-never-silent retired-row protocol — RECOMMENDED; (b) defer to 8b | **In 8a** (accepted recommendation) | ✅ Resolved |

### Resolution Notes

**AR-29** was surfaced under the surface-during-authoring rule after the initial 28-row gate
confirmation and resolved before any plan document was written.

**Decisions recorded 2026-07-17** across three batched confirmations (batch 1: AR-1/AR-16/AR-4..9/
AR-19..24+28 handling; batch 2: AR-12/AR-13/AR-25/AR-17; batch 3: AR-18/AR-15 + bulk acceptance of
AR-2/3/10/11/14/26/27). Bulk acceptance rows record the recommendation as spelled out in their
Options cell, per the gate's bulk-acceptance rule.

**Deferral consequences (stated at deferral):** because AR-19..24 + AR-28 are deferred, 8a
implements NO string/encoding/embed semantics — every existing loud rejection stays in place
(`statement-typing.ts:830` string-init ICE, silent-poison paths for `StringLitExpr`/`CharLitExpr`/
`EmbedExpr` remain until 8b), and AR-18's boundary pin adds a zeropage-field negative test.

**Challenger review (recommendation-hardening):** one independent challenger reviewed AR-1, AR-15,
AR-16 — all AGREE-WITH-AMENDMENTS; amendments incorporated: const-data path already shipped (AR-1);
handler frames already always-live, holes = irq-only helpers + consumer-less `__zp_irq_tmp` pool
(AR-15); $0314 crash hardware-verified, fixture gained CIA mask/flush, NMI hardening, RMW `$D011`,
pre-ack, `$D020 & $0F` masking, saturating counter (AR-16).

**AR-10:** E10047/E10048/E10049/E10050 verified free in `diagnostic-codes.ts` at register time
(E10040–E10046 all spent; E10042 reserved for the element case).

**AR-25:** `toShimVariant` (`emit.ts:38-51`) already maps `minimal`→`"non-terminating"`; the harness
fit is confirmed (`runFrames`, `strategies.ts:89-100`; slice suites assert via direct memory reads).

**Preflight amendments (2026-07-17, iteration 1 — see `00-preflight-report.md`):** all 15 findings
resolved per recommendation; the row text above is preserved as decided, and these amendments
govern where they differ. **AR-15** — mainlineReachable is enumerated as BFS from `main`,
`__init`, and escaped NON-interrupt functions; exports contribute only via real mainline call
edges in program builds (PF-001 — the earlier "complement of irq-only / exports as roots" gloss
emptied `irqOnly` in every real program once `&handler` install marks the handler escaped); the
scratch-twin consumer keys on irq-ONLY, the same key as the spill pool (PF-002); the irq temp
pool stays a profile constant, with the binder's exhaustion ICE extended to name the dry pool —
E10032 is ZP-fit overflow only (PF-003). **AR-18** — the 5b parity discipline is CALL-FREE, not
const-only (var-reading initializers are legal and dependency-ordered, PF-004); aggregate
initializers gain the one-line field-initializer parser-context fix (PF-005); W10030 fires at
`zpWarnThreshold` (80% default, PF-007); F005 ZP-5 export + E10031/E10033 recorded as deviations
(PF-008). **AR-14** — the ABI's normative text is Ch 06 §7.4 (PF-009). **AR-16** — the fixture's
border flip is gated under the saturation guard so the final border is deterministic (PF-011).
**AR-25** — the F004/Ch 10 §5.3 fall-through-entry deviation is recorded; ST-34/35 pin the
shipped shim contract (PF-010).
