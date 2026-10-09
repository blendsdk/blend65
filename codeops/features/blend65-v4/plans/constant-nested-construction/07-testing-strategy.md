# Testing strategy — direct constant nested construction

> **Parent**: [Index](00-index.md)

## 🚨 Specification Test Cases

Independent author receives this contract and frozen normative excerpts only, never
implementation logic. All old oracles are immutable; no old-test exception exists.

| ID    | Input / scenario                                                                                                                   | Independent expected output                                                                                                                                                                              | Source                                |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| ST-1  | Local `Saved{rows:byte[8],raw1:byte,raw2:byte,quality:byte}` initialized to eight zeros, 0, 0, 2                                   | Packed bytes `[0,0,0,0,0,0,0,0,0,0,2]`; only the declared final 11-byte object, no nested temporary/pointer/snapshot.                                                                                    | R1/R2/R4; AR-1                        |
| ST-2  | ST-1 eight-zero row initializer                                                                                                    | Real emitted component no worse than `LDA #0;` eight absolute `STA` stores: 26 bytes / 34 nominal NMOS cycles; no copy loop. Any contractual flag/register setup is separately attributed, never hidden. | R2/R6; AR-1                           |
| ST-3  | Nested structs and arrays with distinct byte/word/sbyte/sword/Boolean/enum constants and casts                                     | Exact declaration-order bytes, little-endian words, signed bit patterns and nominal enum values; no child temporary/pointer for eligible explicit constant literals.                                     | R1/R2; frozen struct/array/type rules |
| ST-4  | Explicit nested-array members with nonzero offsets, including a final member after offset 255                                      | Every byte lands in its declared final interval; no truncation/page-wrap; fresh child homes add no redundant storage.                                                                                    | R1/R4; frozen packed layout           |
| ST-5  | Nested byte-array scalar fills `[;0]` and `[1,2;7]`                                                                                | Complete repeated rows `[0,…]` or `[1,2,7,…]`; fill value semantics unchanged; existing fill-loop selection is permitted.                                                                                | R1/R3; frozen fill rules              |
| ST-6  | A later member calls a function that changes an earlier aggregate source                                                           | Earlier evaluated aggregate remains its pre-call value; later side effect occurs once in source order.                                                                                                   | R3; frozen evaluation/copy rules      |
| ST-7  | Ordinary assignments, overlapping members and borrowed aggregate writes                                                            | Existing complete-value copy/snapshot semantics remain; no fresh-destination assumption.                                                                                                                 | R3; frozen §7.4.4 and borrow rules    |
| ST-8  | A literal contains a volatile read or nested effectful call                                                                        | Each real effect occurs exactly once and in source order; constant-looking siblings do not advance observable writes.                                                                                    | R3; frozen volatile/evaluation rules  |
| ST-9  | Read/mutate a constructed local through an ordinary synchronous non-retaining function, then return a nested value                 | Correct bytes and caller-owned value survive the calls; no alias/lifetime relaxation or hidden storage.                                                                                                  | R1/R3/R4; frozen function/SFA rules   |
| ST-10 | Public build on PAL/NTSC × 6581/8580, optimization `none`, safety off; D/I entry variations around representative initialization   | Build and sequential VICE values agree with independent bytes; D/I/calling/stack restoration remains the selected contract. Report VICE-verified/hardware-unverified, not silicon or deadline proof.     | R3/R6                                 |
| ST-11 | Repeated build and minimal ordinary-source saved-row query with cold candidate-function/control modules, not a public keyboard API | Public debug/resource identity remains valid; no unrelated cold-code/state retention or resource growth.                                                                                                 | R4/R5                                 |
| ST-12 | Ineligible globals, caller destinations, aggregate fill reuse and unknown/effectful paths                                          | Accepted source still builds/runs with its safe current behavior; no new source restriction.                                                                                                             | R3/R5; AR-1 fallback                  |

## Test files and verification

New files only: `test/rd05/nested-constant-output.spec.test.ts`,
`nested-constant-behavior.spec.test.ts`, `nested-constant-safety.spec.test.ts`.
Reuse `source-library-fixture.ts`, `profile-fixture.ts` and `test/m1/vice-runtime.ts`;
no fixture framework or production API additions. Keep each file focused and near
200–300 lines. Combine runtime observations in one small program per profile where
practical; VICE cases run sequentially. Exact costs are a separate oracle from values.
Use no mocks for the compiler/assembler/emulator. Changed logic receives focused
internal tests, aiming at the existing 90% core behavior target, not invented tooling.

RED: directed new files must fail at the missing output/storage expectation; old
behavior cases may already pass and are recorded as pre-passing controls. GREEN:
all new files plus affected existing aggregate/ABI/copy/closure tests.
Phase checkpoint: `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`,
`yarn test`, targeted formatting, local links and frozen/oracle guards. Full logs stay
in Git-private task evidence. Runtime is VICE 3.10/ACME 0.97, NMOS 6510; physical QA
stays RD-10. No browser, authentication or host-input security path changes.
