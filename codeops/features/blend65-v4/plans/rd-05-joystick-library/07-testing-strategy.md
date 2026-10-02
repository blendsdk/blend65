# Testing strategy: joystick and bundled C64 library

> **Parent**: [Index](00-index.md)

## Coverage and independent oracles

Contract expectations come from the frozen module/type semantics, RD-05 and approved AR decisions,
not new loading/lowering code. Assembly bytes/resources are a separate oracle from behavior.
Reuse real temporary projects, public compiler/frontend exports, ACME and existing sequential VICE
utilities. Differential execution supports but does not replace those independent expectations.

## 🚨 Specification Test Cases

| ID | Concrete input | Expected output | Authority |
| --- | --- | --- | --- |
| ST-1 | Import each AR-P3 mask from `c64.input`, or use its qualified name, on each of the four selected profiles | Complete analysis; exact exported `byte` values 1,2,4,8,16,31; declarations' source spans identify parsed installed Blend65 text, not synthetic profile constants | AR-P3; Spec Ch10 §§2.2/4, Ch02 TS-18 |
| ST-2 | Same project through sync analysis, asset-aware compilation and overlay analysis; overlay changes a use from up mask to fire mask | Same library inventory and masks; changed expression is 16 only in overlay; original snapshot, user records and host files remain unchanged | AR-P4; existing overlay contract |
| ST-3 | User file declares `module c64.input; export const joystickUpMask: byte = 7;`; separately user adds a differently named export in that module | First case E10003 with both user and actual library spans; second case normal successful module merging; no namespace sealing | AR-P4; Spec Ch10 §2.2/§7 |
| ST-4 | User source IDs include both `@blend65/stdlib/c64/input.blend` and `@@blend65/stdlib/c64/input.blend`; reverse supplied source order | Preserve both user IDs; unique library ID is `@@@blend65/stdlib/c64/input.blend`; deterministic UTF-8 ordered metadata/hash in both analyses | AR-P4 |
| ST-5 | Analyze a target-neutral source without a qualified profile; separately request an unknown C64 profile | No C64 library admitted to target-neutral input; unsupported selected target retains E10279 and no falsely successful C64 binding | AR-P3/AR-P4; R5.3 |
| ST-6 | Build a mask-using project, then byte-identical sources relocated to another project/install root; separately alter one installed source byte in a detached package | Build/debug source records include exact library byte length/SHA; relocated equal logical inputs have equal compiler input digest; changed library byte changes it; original user-loader hash remains unchanged | AR-P4 |
| ST-7 | In a detached installed compiler package: remove the library, provide invalid UTF-8, then provide a file larger than the existing source-byte ceiling | Error results use PROJECT_READ_FAILED, PROJECT_INVALID_UTF8, PROJECT_HOST_LIMIT respectively; no program/fallback, private native path, stack or unbounded allocation | AR-P4 |
| ST-8 | Pack the built compiler, inspect/extract its actual tarball outside the repository; run a named-mask project using installed public exports without checkout files | Exact `.blend` asset included; installed analysis and build succeed; source/hash evidence matches actual package bytes; no source-tree fallback or new package fetch | AR-P4 |
| ST-9 | LSP analyzes ST-3 duplicates with user IDs before and after the library ID (`0/override.blend`, `z/override.blend`) and a valid import; in a detached package separately introduce installed parse/type errors with no related open user location and a normal user error; close the trigger with another user file open, then close all files; correct the overlay/library bytes | Duplicate error is visible at the exact user range in both orders; installed primary/related URI and exact ranges are preserved and clearly labeled; standalone installed errors reach the open trigger or first remaining admitted open user document without overwriting normal errors; none open means no fallback publication; valid import resolves; corrections clear errors; user editable-source inventory is unchanged | AR-P4; frontend/editor boundary |
| ST-10 | Each zero-argument port read and each byte-argument predicate on all four profiles; extra read argument, missing predicate argument, boolean predicate argument, unknown export | Correct unsigned byte/pure boolean signatures; invalid cases use existing E10171/E10172/E10012 as applicable, not missing-capability substitutes | AR-P3; Spec Ch06/Ch14 argument and name diagnostics |
| ST-11 | For each port and each byte `s=(upper<<5)|low`, `upper=0..7`, `low=0..31`, apply all five predicates to a saved sample | Exact sample `s`; each result true iff `(low & mask)==0`; upper bits do not affect results; opposing directions and simultaneous fire remain independent, no normalization | AR-P3/AR-P5; MOS-6526-1981; CBM-C64-PRG-1982 |
| ST-12 | Read port 1 then port 2 and reverse; discard one read; repeat two reads; test a saved byte after another hardware sample; include short-circuit expressions | Exact per-source read count/order and conditional path; predicates do not reread hardware; saved value survives; neither unused-result removal nor commoning occurs | AR-P5; volatile/evaluation-order semantics |
| ST-13 | Controlled released-line fixture injects all 32 joystick switch combinations per port; store both raw samples and five predicates in RAM on each profile | Independently calculated active-low values and truth bits match ST-11; actual input/pin stimulus, not writes pretending a port register is a joystick latch | R5.24/AC-19; AR-P5 |
| ST-14 | Fixture sets distinct CIA1 DDR/latch state and unrelated upper bits, then calls reads; separately drive a shared line low while joystick switches are released | Operation trace has only the selected port read; DDR/latch/unrelated state preserved; interfering low bit is faithfully returned/tested, never claimed joystick-only | AR-P5; CIA actual-pin semantics |
| ST-15 | Invoke reads during mainline and an existing safe IRQ route; fixture owns competing port writes and uses known before/after samples | Each sample reflects its real read point; no added masking, port writes, CIA2/ICR reads or invented two-port atomicity; no new concurrency mechanism | AR-P5; existing IRQ ownership |
| ST-16 | For both ports, assemble minimal discarded, directly stored and retained read cases under the same expert live-value contract | One LDA absolute at the named port; sole adjacent byte store to a fixed address has no redundant transfer or temporary save/reload; retained samples preserve both destination writes and honest canonical storage. Keep the 9-byte/12-cycle, zero-SFA body as an RD-08 target; measure assembled bytes/resources independently | AR-P6/AR-P12; MOS-PGM-1976; expert lowering casebook |
| ST-17 | Assemble each saved-byte predicate in branch-only and escaping-Boolean contexts; vary branch direction/page placement in bounded cases | Correct immediate mask and zero condition; no JSR/helper dispatch; value case materializes canonical 0/1. Measure actual paths/page costs and storage. Zero Boolean homes and compact expert layout remain RD-08 targets, not canonical `none` acceptance limits | AR-P6/AR-P12; Spec Ch02 Boolean semantics; CPU/casebook |
| ST-18 | Compile the same no-input main with and without an unused mask import; separately use one scalar mask as an immediate | Equal target payload/storage/startup for unused import; immediate use folds to the named value with no library runtime/data/helper; complete report deltas match assembled artifacts | AR-P3/AR-P6; Ch10 §5.4 constants; R5.50 |

## File and phase ownership

| File | Cases |
| --- | --- |
| `test/rd05/bundled-input-library.spec.test.ts` | ST-1–ST-5 |
| `test/rd05/bundled-input-evidence.spec.test.ts` | ST-6–ST-8 |
| `packages/language-server/src/bundled-input-library.spec.test.ts` | ST-9 |
| `test/rd05/joystick-api-output.spec.test.ts` | ST-10–ST-12, ST-16–ST-18 |
| `test/rd05/joystick-vice.spec.test.ts` | ST-13–ST-15 |
| `packages/compiler/src/frontend/bundled-sources.impl.test.ts` | Host-read internals, repeated logical-ID collision handling and immutable prepared inputs, after phase-1 green |
| `packages/language-server/src/bundled-input-library.impl.test.ts` | Installed-URI mapping and user-only overlays, after phase-1 green |
| `packages/compiler/src/machine/joystick.impl.test.ts` | Mask selection, live-result retention, effects and forwarding negative guards, after phase-2 green |
| `packages/compiler/src/machine/vic-collision.impl.test.ts` | Adapt only obsolete port-2 forwarding exclusion; keep CIA exclusion and existing negative guards |
| `test/m1/vice-monitor.ts`, `test/m1/vice-runtime.ts` | Port-1 stimulus method and opt-in simulation device activation; existing callers and port-2 behavior unchanged |

## Test integrity and runtime fixtures

Specification authors receive these contracts/interfaces and existing fixture utilities only;
they must not inspect implementation logic. Record RED for each phase before implementation.
Explain already-green validation/regression cases; missing tools or setup/timeouts are not valid RED.
AR-P8 allows the exact two old inventory additions. AR-P10/AR-P11/AR-P12 allow only their named
new-oracle corrections; AR-P12 changes the two output-cost groups and bounded cycle helper only.
Preserve all other existing spec tests;
if a real incompatibility appears, stop for its exact authority rather than weakening an oracle.

Use an isolated copied/packed compiler for changed, missing or corrupt library cases; never mutate
the checkout's installed source while other tests use it. No mocks of parsing, semantic behavior,
generated machine code or hardware input. A fake LSP transport remains an allowed true external.

For VICE, use existing bounded utilities and document exact machine/video/SID/ROM, released-line
conditions, keyboard state, input stimulus, fixture setup writes, stop marker and PRG/tool identities.
Extend the existing monitor utility with `setJoystick1(value)` as specified by AR-P6, using port
index 0 and values 0–31. Add opt-in `-controlport1device 37` activation to the same `startVice`
fixture, preserving existing callers' defaults and `setJoystick2`. Validate active device selection
and both actual port identities/polarity through compiled samples. The
[official binary-monitor joyport command](https://vice-emu.sourceforge.io/vice_13.html)
and the [pinned VICE 3.10 implementation](https://github.com/VICE-Team/svn-mirror/blob/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/monitor/monitor_binary.c#L1269)
are tool-interface authority, not universal silicon proof. Do not build another transport.
Sample through compiled code into RAM; avoid monitor reads being mistaken for compiler reads.
All 32 cases are runtime-switch test coverage, including states a physical stick may not assert.
Upper-bit exhaustive behavior uses an independent byte oracle; runtime upper states cover controlled
representative devices/lines rather than claiming arbitrary physical stimuli. Shared-line interference
is a separate expected-raw-value test, not a false isolation test. Trace operation windows separately
from startup, fixture writes and KERNAL scans. Do not read a port to infer its output latch; use
known fixture writes or emulator latch observation when proving preservation.

E2E is the existing public build → ACME → bounded sequential VICE path and outside-checkout package
use. Do not add a new runner, benchmark system or VSIX test host. Run all four profiles sequentially;
report VICE-verified / hardware-unverified. Physical/native user-host release tests remain RD-10.

## Verification and closeout

Use AR-P6's directed/full checkpoint rules and configured independent phase review. Measure every
changed instruction path's bytes, nominal cycles, flags, ZP/SFA/stack, data, startup and payload.
Separate CPU cycles from VIC stalls and whole-program claims. AR-P12 permits canonical `none`
for this pilot only: direct named-operation floors still gate, while general local/condition/layout
deltas remain explicit RD-08-owned targets. The closed forward-only assembled cost check covers
only these small fixtures; it is not a CPU interpreter or production cost reporter. A direct
local meet requires its measured RD-08 path-to-beat issue under AGENTS.md.
Closeout answers deferral expiry, source-function prerequisite ownership, remaining R5.24/AC-19
coexistence evidence and whether this pilot justifies the final analysis RD/qualified skill update.
