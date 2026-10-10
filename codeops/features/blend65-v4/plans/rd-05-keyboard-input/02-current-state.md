# Current state and implementation seams

> **Parent**: [Index](00-index.md)
> **Observed baseline**: `2a2eda75`, 2026-10-10

## Production facts

Paths below are relative to `packages/compiler/` unless stated otherwise.

| Existing owner                                                 | Observed behavior / intended use                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `stdlib/c64/input.blend`                                       | Only six exported mask constants; add ordinary source, not name-dispatched intrinsics                                    |
| `src/frontend/bundled-sources.ts`                              | Fixed installed-source preparation/identity; reuse unchanged                                                             |
| `src/frontend/profile.ts:242–277`                              | Raw joystick reads/predicates and balanced NMI operations already exist; new functions are not profile inventory entries |
| `src/machine/lower-scalar.ts:20–77`                            | Word bitwise results retain both bytes; MC-001/MC-002 consumer                                                           |
| `src/machine/lower-aggregate-index.ts:60–138`                  | Always stages a word ordinal, including unsigned stride-one byte indices                                                 |
| `src/machine/lower-aggregate.ts:304–329,402–440`               | Word pointer additions and retained indirect byte loads; MC-001 consumers                                                |
| `src/machine/lower-register-forwarding.ts:58–140`              | Existing adjacent/single-use window; ordinary binary/call producers are not generally admitted                           |
| `src/machine/lower-call.ts:19–65,151–170`                      | Direct fixed addresses already marshal immediately; captured address/result staging remains                              |
| `src/machine/lower-state.ts`                                   | Lowered values, stable retention and scratch requests before SFA closure                                                 |
| `src/semantic/interrupt-context-facts.ts:68–104`               | Vector/link/I/route facts, not a source-visible CIA1 port-admission result                                               |
| `src/semantic/cia-ownership-facts.ts:61–93`                    | Existing timer/ICR ownership; not a general port/DDR/PBON checker                                                        |
| `test/rd05/bundled-input-library.spec.test.ts:135` (repo root) | Exact six-export inventory; AR-P6 approves only its nine-name extension                                                  |

Current port facts do not establish automatic owner admission. The accepted
compatible-owner precondition is retained, not converted into a new checker or
public success flag. No entry predicate requires `$FE47` at every acquisition.

## Dependencies and bounded evidence

[T-11](../masked-index-containment/08-closeout.md),
[T-12](../constant-nested-construction/08-closeout.md) and
[T-14](../returned-local-destination/08-closeout.md) are qualified. Existing
source reachability keeps unused acquisition state out of a saved-query-only
program. The latest full Linux checkpoint is 6,043 passes/two unrelated skips;
it does not qualify new keyboard code.

[MC-001–MC-003](00-ambiguity-register.md#actual-current-output-defects-not-a-keyboard-cost-waiver)
are actual diagnostic output defects, not accepted performance budgets. That
source is not the production library. Its 1,139-byte PRG and 1,227-byte resident
footprint cannot be reduced by subtracting local estimates to invent a final
package target. The full saved decoder remains unconstructed and uncosted.

Reuse root `test/rd05/profile-fixture.ts` (`analyzeProfileSource`,
`withProfileProject`, `buildProfileSource`, `readProfileArtifacts`) and
`test/m1/vice-runtime.ts` / `vice-monitor.ts` for ordinary builds, actual bytes,
CPU/MMIO inspection and both joystick ports. Existing monitor methods do not
inject arbitrary held keys or RESTORE. Native matrix/RESTORE qualification
therefore reuses the exact already-proved GDB/VICE method in
[T-05](../keyboard-ingress-proof/99-execution-plan.md#identity-and-reproduction),
including `keyboard_event_playback` and `machine_set_restore_key` on the emulator
thread. Do not fake a held-key case by patching CIA pins, saved rows or CPU frames.
No new monitor protocol, qualification framework or production harness is planned.

The scope is four `c64-{pal,ntsc}-prg-kernal-{6581,8580}` profiles. Retained ROM
work, unrestricted NMI nesting, external aggregate stack, completion/deadline and
physical silicon are not proved by a bounded generated route or a plan.
