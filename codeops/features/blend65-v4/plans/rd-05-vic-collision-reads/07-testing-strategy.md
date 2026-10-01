# Testing strategy: VIC-II collision reads

> **Parent**: [Index](00-index.md)

## Coverage and oracles

Cover both operations, all four cooperative profiles and every approved consuming-effect
obligation (AR-P2/AR-P4). Behavior comes from primary hardware semantics and the approved API;
assembly/cost expectations are independent. Differential execution is supporting evidence only.
Use real compiler/ACME/VICE paths, not a mock collision implementation or a new harness.

## 🚨 Specification Test Cases

| ID | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-1 | Either approved zero-argument call on each cooperative profile | Accepted unsigned byte result and consuming `volatile-read` effect; exact signatures | AR-P2 |
| ST-2 | Extra argument, misspelled operation, or unsupported target | Rejected through the existing profile/name/arity diagnostics; no added diagnostic identity | AR-P2; 03 source contract |
| ST-3 | One retained call, separately for each operation | Exactly one read of its AR-P2 register; sampled value retained without rereading; no device write or helper call | R5.27; AR-P2 |
| ST-4 | Discarded call followed by two repeated calls | Three separate reads in source order, not zero reads or a commoned result | R5.27; AR-P2 |
| ST-5 | Sprite/sprite call followed by sprite/background call and reversed sequence | Register reads follow that exact order; neither becomes a `$D019` access | R5.27; AR-P2 |
| ST-6 | No collisions; then overlap sprites 0 and 7 away from foreground, with only those sprites enabled | First masks zero; generated sprite/sprite sample returns `$81`, background sample zero; high bit preserved | AR-P2; VIC-II sprites hardware reference |
| ST-7 | Only sprite 7 overlaps a known foreground pixel region | Generated background sample returns `$80`, sprite/sprite sample zero | AR-P2; VIC-II sprites hardware reference |
| ST-8 | Cause both latch types; read one; then read the other | Each returns its own latched mask; consuming one does not clear the other | AR-P2; VIC-II sprites hardware reference |
| ST-9 | Consume an established collision after disabling sprites and waiting beyond active sprite DMA, then read again | Initial stored mask preserved; second read zero with no new collision event; `$D019` collision pending status is not acknowledged by either read | AR-P2; volatile/RMW hardware reference |
| ST-10 | Assemble minimal retained/discarded cases with identical live-value obligations | Direct device-load sequence meets expert local floor; no wrapper, runtime address calculation, redundant transfer or hidden storage; measured complete cost | AR-P4; 03 output quality |

## Test ownership and order

| Planned file | Cases |
|---|---|
| `test/rd05/vic-collision-api.spec.test.ts` | ST-1–ST-2 |
| `test/rd05/vic-collision-output.spec.test.ts` | ST-3–ST-5, ST-10 |
| `test/rd05/vic-collision-vice.spec.test.ts` | ST-6–ST-9 |
| `packages/compiler/src/machine/vic-collision.impl.test.ts` | Result-retention and instruction-selection internals after green |

Specification authors receive contract/interface excerpts and existing test utilities only;
they do not inspect new implementation logic. Record RED before implementation, explaining
any pre-existing passing validation case. Preserve these new expectations thereafter.
Apply AR-P3's inventory updates separately and preserve all old rows and assertions.
AR-P5 authorizes only removal of the new API test's misplaced binding-type comparison;
call-level signature, unsigned-byte, arity, name/profile and effect checks remain intact.

## Runtime observation

Use the existing bounded sequential VICE test pattern. Generate collision events with actual
sprite patterns and screen/charset foreground, not writes to read-only collision registers.
The fixture owns any setup MMIO and records it separately from the operations under test.
Inspect generated samples copied to ordinary RAM, never consume a latch from the monitor.
Explicitly establish I/O visibility, video model, ROM/options and collision IRQ masking.
The application fixture prevents competing consumers; the API adds no synchronization.

Run the four profile configurations sequentially and record tool versions, fixture/source,
binary hash, machine/chip/ROM identities, initial state, stop condition and observations.
Use known foreground pixels and masks, not a screenshot-only success claim. Second-zero
checks require proof that fresh display collisions cannot occur between reads. Do not infer
universal silicon correctness from VICE: report VICE-verified / hardware-unverified.

## Verification

AR-P4 supplies the directed and full checkpoint commands. Full checkpoint requires install,
build, typecheck, all owned tests, targeted formatting, local links and frozen-authority checks.
Independent phase review must clear major/critical findings before closeout. No new runner,
benchmark system, coverage threshold infrastructure or emulator parallelism is introduced.
