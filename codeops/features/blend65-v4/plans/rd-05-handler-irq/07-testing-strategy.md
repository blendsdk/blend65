# Testing Strategy: Handler-Side IRQ Updates

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P1–AR-P10; [design](03-handler-irq.md); frozen Specification 4

## Test Boundary

Specification tests are written independently before implementation. The author receives the
cases below, their governing contracts, public compiler/type signatures and existing fixture
interfaces—not the lowering/ownership implementation. In-code comments state durable behavior,
not plan identifiers. Existing specification files stay immutable except the exact AR-P3/P6 edits.

Use `withProfileProject`, `readProfileArtifacts`, the public `checkProject`/`buildProject`, existing
direct SFA interfaces and the current sequential VICE monitor. No new harness, runner, dependency
or coverage-percentage gate is introduced. Coverage means every ST case, each admitted source
form, each failure class and each introduced concurrency boundary has independent evidence.

All new source examples use existing grammar and imports. A/B/C below denote distinct
`interrupt function ...(): void` declarations; helpers are ordinary functions. Unless a row says
otherwise, main installs A, contains `asm_cli(); asm_nop();` while A is installed, then masks,
restores and returns. Handler bodies begin masked by their selected ABI. Empty secondary handlers
remain masked. `setIRQ` and `setIRQExclusive` use existing imports from `c64.system`.

All successful build assertions inspect the returned generation, not a stale output directory.
All rejected build assertions require no generation and no newly published artifact. Cases that
already pass before implementation are recorded as supporting regressions, never as red proof.

## Specification Test Cases

### Source Ownership and Finite Construction

| ID | Concrete input / scenario | Expected result | Source |
|---|---|---|---|
| ST-1 | A executes `setIRQ(&B); restoreIRQ();`; repeat using `setIRQExclusive(&B)` | Check/build succeed on all four existing cooperative profiles; no error diagnostics | Chapter 6 §7.8; R5.16; AR-P2 |
| ST-2 | Ordinary `install()` installs B and returns without restoring; A calls `install(); restoreIRQ();` | Success; ownership transfers from helper to A, and A returns with its incoming prefix unchanged | Chapter 6 §7.8; design §2 |
| ST-3 | A branches on `peek($0400)`: each branch installs its selected B or C, then restores before the join | Both runtime choices compile; no leftover owner at the join | Chapter 6 §7.8; AR-P2 |
| ST-4 | A loops over a runtime byte count, installing B and restoring once in each iteration; exercise counts 0, 1 and 3 | Finite storage/context set independent of iteration count; success | Chapter 6 §7.8; design §3 |
| ST-5 | A performs `setIRQ(&B); setIRQExclusive(&C); restoreIRQ(); restoreIRQ();` while masked | Success; two distinct simultaneously live temporary predecessor pairs; restore order is C→B→A's entry vector | R5.16; design §2 |
| ST-6 | A masked-installs B and restores; B masked-installs A and restores | Build terminates successfully with a finite entry/context set; no arbitrary recursion/depth rejection | Chapter 6 §7.8; design §3 |
| ST-7 | A masked-installs A and restores before returning | Success; repeated source identity alone is not E10245 | Chapter 6 §7.8; design §3 |
| ST-8 | A calls only `restoreIRQ()`; main also restores after its interruption opportunity | E10278, no artifact; preserve the complete old ledger fixture verbatim when applying AR-P3 | Chapter 6 §7.8; AR-P3 |
| ST-9 | A conditionally leaves B installed on only one branch; separately, A installs B, writes either CINV byte with raw `poke`, then restores | Each fails E10278, no artifact; neighboring non-vector raw writes remain legal | Chapter 6 §7.8; R5.16 |
| ST-10 | Existing unbalanced A self-install source in `diagnostics-resource-boundaries.spec.test.ts`, including its exact source spans | Existing E10245 record, message shape and related installation span remain unchanged | Chapter 14 E10245; AR-P2; existing immutable oracle |

### Recognition, Nesting and Private Storage

| ID | Concrete input / scenario | Expected result | Source |
|---|---|---|---|
| ST-11 | A installs exclusive B, executes `asm_cli(); asm_nop(); asm_sei(); asm_nop(); restoreIRQ();`; B stays masked | Success with finite A/B overlap; sequential repeated B events do not increase nesting depth | Chapter 6 §7.5; design §4 |
| ST-12 | Change ST-11's B installation to chained `setIRQ(&B)`, so its predecessor chain reaches suspended A | E10245, no artifact; failure is the unproved overlap cycle, not a context-expansion hang | R5.17; design §4 |
| ST-13 | A temporarily enables exclusive B; B temporarily enables exclusive C in the same balanced form; C stays masked | Success with three finite IRQ roots; every concurrently live private home is distinct, without a fixed nesting cap | Chapter 6 §7.5–§7.6; design §4–§5 |
| ST-14 | Existing final-CLI chain/exclusive handlers and existing CLI→erased-expression/PLP versus CLI→NOP/PLP cases | Retain exact existing E10245 and 236-byte success / 237-byte E10238 outcomes; wrapper completion and erased expressions do not hide recognition | Existing mask-boundary/return oracles; design §4–§5 |
| ST-15 | Main installs A twice. Each sequential A body temporarily installs/restores B while masked | Both A chain entries run once per event and retain different original predecessors; A's temporary slot can be reused after each body completes | Chapter 6 §7.8; design §2 |
| ST-16 | Main and finite nested A/B call the same storage-bearing ordinary helper with inputs 77, 17 and 33. The helper preserves its input through an observable multi-instruction computation, then returns input+1. Inject nesting while the earlier helper's local is live | Results 78, 18 and 34 respectively; private parameters/results/locals/staging/scratch do not overwrite one another; global result cells remain single shared addresses | Chapter 6 §7.5–§7.6; R5.18 |
| ST-17 | A calls ordinary `installChoice()` that performs one conditional exclusive B/C install and returns; A then enables IRQ. B stays masked, calls the same helper, restores its temporary install, then returns; A masks and restores its own install | Distinct live predecessor words for the same helper installation site under A and B. No saved-link overwrite; ownership returns to the original vector | R5.16; design §2/§5 |
| ST-18 | Direct SFA fixtures: simultaneously live two-byte links; a free pair starting at `$20FE`; a pair starting at `$20FF`; and two proved non-overlapping private roots in a RAM window fitting only one of their equal-size homes | Live links never overlap. `$20FE` is accepted; `$20FF` relocates if another legal pair exists, otherwise resource failure. Non-overlapping roots fit by overlay, without permanently-live convenience allocation | Chapter 6 §7.8; design §5 |

### Emission, Shared State and Resource Evidence

| ID | Concrete input / scenario | Expected result | Source |
|---|---|---|---|
| ST-19 | A temporarily installs B or C selected by `peek($0400)`, then restores; ordinary helpers include a finite function-pointer call and a source equality check against the original function address | Selected entry/call variant uses the correct root and slot; source function equality is unchanged; no generic runtime context selector. The existing VICE tier observes both equality-marker outcomes because static assembly cannot prove which branch executes | Chapter 6 §7.4–§7.6; design §3/§6 |
| ST-20 | In ST-11, A and B both update a shared byte with RMW and access a shared word with at least one write; contrast a single-byte plain publication | W10211 and W10212 with related conflicting access/path evidence for the hazards; no cloned globals or hidden mask. Plain byte publication does not gain a tearing warning | R5.18 / AC-15; design §7 |
| ST-21 | Small chain and exclusive entries plus temporary setter/restore in a handler, compared with hand-derived sequences under the same P/A preservation contract | Direct link/entry operands and required ABI. Context identity adds zero instructions. Generic full-preservation setter ceiling 27 bytes/44 cycles, restore 17/32; chain wrapper excluding body 6/14, exclusive wrapper 4/5 plus existing ROM tail. A shorter proved equivalent sequence is allowed | Primary CPU/firmware contracts; design §6/§8; cost derivation below |
| ST-22 | Direct selected IRQ fixture: startup=0, no ordinary calls, main retains 10 source PHP bytes, chained A retains 3 PHP bytes while enabling exclusive B, B peaks at 5 PHP bytes. All pushes and local installs balance; compare usable capacities 31 and 30 | Exact peak is `10 + 7 + 3 + 6 + 5 = 31` bytes. Capacity 31 succeeds; 30 fails E10238 with used=31/available=30. Installer's two transient bytes do not exceed that peak. No extra frame is charged for chaining | Chapter 6 §7.9; design §4–§5 |
| ST-23 | Same selected symbolic fixture rebound into different legal RAM homes, including shared-RAM closure and an existing long-branch relaxation case | Final code preserves recognition sites, mask/stack/vector effects and context-bound calls; all operands refer to the final certificate. Exact duplicate helper sharing retains physical scratch assumptions | Design §5; AR-P2 |

### Sequential VICE and Regression Qualification

| ID | Concrete input / scenario | Expected result | Source |
|---|---|---|---|
| ST-24 | Main installs B above A; B chains to A. A records CINV, temporarily installs C, restores, then chains. Observe one controlled event and finish main's restores | At A entry/after temporary restore the vector is B; A's eventual predecessor is still the original pre-A vector. Visit B, A, original predecessor once each, then recover the original vector and stack | R5.16 / AC-13; design §2/§6 |
| ST-25 | VICE execution of ST-11/ST-16: stop inside the A helper with its local live, deliver a qualified CIA IRQ to exclusive B, resume and finish | Nested B result 34, resumed A result 18, main result 78; exact entry/exit order, no scratch corruption, no repeated suspended-A entry | R5.17–R5.18; design §4–§6 |
| ST-26 | VICE execution of ST-15 and ST-17 with distinct byte markers at each body and saved-vector observation | Sequential repeated A entries and overlapping helper-owned installations retain every exact predecessor; counts/order and final vector match the stated source lifecycle | Chapter 6 §7.8; R5.16 |
| ST-27 | Controlled IRQ entry with known A/X/Y/SP and D=0 or D=1; run chain and exclusive temporary-install variants; test both initially enabled and masked mainline opportunities | Actual entry is binary-mode; required registers, SP and complete interrupted status return correctly. No handler runs during the masked interval; pending IRQ runs only at a legal recognition boundary | Chapter 6 §7.4/§7.9; selected CINV ABI; design §6 |
| ST-28 | Run one balanced temporary-install runtime fixture sequentially under each of the four existing video/SID profile IDs | Exact selected profile/resources, same ownership/return result and clean emulator shutdown; report only VICE-verified / hardware-unverified | AR-P1/P5; R5.16 |
| ST-29 | Negative raw-vector/unequal-ownership/unbounded-reentry inputs, checked and built through the public service; known NMI negatives remain included unchanged | Correct source failure, no artifact publication, no timeout/hang, no weakening of the NMI restriction | AR-P2/P4/P6; R5.17 |
| ST-30 | Existing ordinary/mainline-only IRQ and no-interrupt fixtures before/after this change, plus the new selected routes' complete cost ledger | No added runtime work for context bookkeeping; existing correct output does not regress. Report all generated/ROM/storage/stack/path terms, independent behavior evidence, and actionable measured parity gaps | AGENTS.md parity directive; R5.17; design §8 |

## Cost Derivation and Runtime Observation

ST-21's generic transaction reference is `PHP; PHA; SEI`, two absolute load/store pairs, then
`PLA; PLP`; install additionally has two immediate-load/absolute-store pairs. NMOS costs give
restore 17 bytes/32 cycles and install 27/44, both with two transient stack bytes. A saved pair
occupies two RAM bytes. Chain wrapper `PHP; CLD; ...; PLP; JMP (link)` is 6 bytes/14 cycles excluding
body and predecessor execution. Exclusive wrapper `CLD; ...; JMP $EA81` is 4/5; its existing
six-byte ROM restore/RTI tail is 22 cycles and zero output bytes. These are explicit comparison
contracts, not measured new compiler results or an instruction-preservation requirement. Remove
unnecessary work when its equivalence is proved; never force it to match the reference.

VICE fixtures reuse the existing KERNAL/cooperative setup and monitor checkpoints. For a nested
exclusive handler, source code acknowledges its deliberately configured CIA source; the outer
source opportunity and the controlled nested event are observed separately. At the monitored
boundaries, record actual CINV words, source pending/acknowledgement state, entry order, A/X/Y/P/SP
and output bytes. No sleep duration stands in for interrupt delivery. Use bounded existing monitor
waits and deterministic checkpoints; every child/checkpoint is cleaned in `finally` paths.
Hardware addresses in test setup are explained by their device/register names. No production
game framework, interrupt scheduler or reusable runtime is created for the fixtures.

## Files and Independent Authoring

| New test file | Cases |
|---|---|
| `test/rd05/handler-irq-ownership.spec.test.ts` | ST-1–ST-10 |
| `test/rd05/handler-irq-nesting.spec.test.ts` | ST-11–ST-17, ST-20, ST-29 |
| `packages/compiler/src/storage/handler-irq.spec.test.ts` | ST-18, ST-22–ST-23 |
| `test/rd05/handler-irq-output.spec.test.ts` | ST-19, ST-21, ST-30 |
| `test/rd05/handler-irq-vice.spec.test.ts` | ST-19 equality-marker observation; ST-24, ST-26, ST-28 |
| `test/rd05/handler-irq-nesting-vice.spec.test.ts` | ST-25, ST-27 |

Authoring packets include complete rows plus the shared setup/cost contracts. Public behavior
authors may read the public compiler exports, `test/rd05/profile-fixture.ts`, and the existing
VICE helper interfaces. Direct SFA authors receive type/signature excerpts for existing closure
inputs and the direct internal interface contract in design §5, not implementation bodies. They
may build typed `WholeProgram`/`StorageInventory`/`MachineProgram` fixtures using the existing
object shapes and inspect `simultaneousIRQStackPeak`, `buildInterference`, `closeStorage`,
`bindMachineProgram`, and `closeSharedStorage` results. For ST-18, supply explicit overlap tuples
to the planned third `buildInterference` argument, then allocate in the named windows. For ST-22,
use the selected main/A/B operations and 31/30-byte profile values from design §5; the direct
closure oracle is `hardwareStackPeak` or `reason: "stack"` with `measured`/`available`, while
E10238 is the established public diagnostic mapping. For ST-23, rebind one unchanged symbolic
program against distinct final certificates and include the existing shared-RAM and long-branch
paths. A test must compile now and fail on missing behavior, not on a not-yet-declared import or
type name. For a planned optional trailing argument not yet declared in TypeScript, a test-local
structural call signature may accept that argument without an unsafe cast; use local structural
tuple types rather than importing a not-yet-created type. All compiler implementation files and `*.impl.test.ts` are forbidden during
independent specification authoring. A packet may
include the existing immutable specification regressions to retain, but never derive new behavior
from current failures. Ordinary test-local helper functions are allowed; no new harness is needed.

The output specification proves the selected address/call and comparison shape. The planned
VICE file also runs both equality choices and observes the separate marker, so source-address
equality is not inferred from assembly appearance alone. Reuse the existing monitor and project
fixture; this adds no runner or support module.

After green specifications, internal hardening covers finite context counts, memoization keys,
request/hash determinism, pending continuations, all private-storage classes (including aggregate
destinations, pointer pairs, multiply/divide scratch), nonreturning paths, certificate consistency,
and late rebinding. Use focused `*.impl.test.ts` files alongside their existing owners. Preserve
the existing equivalent-branch linear-analysis bound rather than introducing timing benchmarks.

## Verification

AR-P5 governs the commands. Run from the repository root:

| Tier | Command / rule |
|---|---|
| New source/output specs | `yarn vitest run test/rd05/handler-irq-ownership.spec.test.ts test/rd05/handler-irq-nesting.spec.test.ts test/rd05/handler-irq-output.spec.test.ts --testTimeout 30000` |
| New direct storage specs | `yarn workspace @blend65/compiler test src/storage/handler-irq.spec.test.ts` |
| Runtime specs | Run each new VICE file separately with `yarn vitest run <file> --testTimeout 30000`; no concurrent x64sc suites |
| Directed regressions | Existing ownership, profile-interrupts, ledger, stack-mask/overlap/nonreturn/equivalent-context, SFA, indirect-call, import-boundary and artifact validation tests |
| Full phase checkpoint | `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, then `yarn test` |
| Approved loaded-host fallback | If only unchanged root tests hit the known timeout, use `yarn turbo run test` plus `yarn vitest run --testTimeout 30000`, record both results and the reason; never permanently change timeouts or omit tests |
| Formatting / authority | `yarn prettier --check <touched files>`; unchanged frozen spec/expert files; only the exact AR-P3/P6 old-test diff |

Tests must fail for the missing behavior before implementation, not for missing tools/imports.
Record red per case, then green per case. Stop and correct implementation for failed new or
unapproved old oracles. Host/tool unavailability is Unknown, never a silent runtime pass.

Security is bounded compiler validation: invalid ownership, unknown/unbounded route, exhausted
resources, final-certificate mismatch and no erroneous publication. Authentication, network
security, infrastructure and schema migration are not applicable because this slice adds none.
