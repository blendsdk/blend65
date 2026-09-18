# Ambiguity Register: Blend65 v4 Requirements

> **Status**: ✅ GATE PASSED — all 50 items resolved
> **Last Updated**: 2026-09-13
> **CodeOps Artifact Schema**: 1

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| AR-001 | Naming | Which nested CodeOps feature owns the v4 requirements? | Reuse `blend65-ri` / create `blend65-v4` | Create `blend65-v4`. | ✅ Resolved |
| AR-002 | Scope | What must be true before v4 is called production-complete? | Complete active language and C64 expert-output bar / smaller partial compiler | Qualified development milestones are allowed, but production completion requires the complete active language for C64 with correct behavior and expert-quality output. | ✅ Resolved |
| AR-003 | Stakeholders | Who is the primary product audience? | Modern C64 game developer / assembly-first expert | The modern C64 game developer is primary; advanced 6502 developers, contributors, and VS Code users remain supported secondary stakeholders. | ✅ Resolved |
| AR-004 | Scope | Must v4 preserve any v3 compatibility? | Preserve active-spec source compatibility / preserve broader v3 behavior / preserve none | No v3 compatibility of any kind. The active language specification is a conformance authority, not a compatibility promise. | ✅ Resolved |
| AR-005 | Technical | Where and how is v4 developed? | Same checkout / independent repository / sibling worktree in the same repository | Use `/home/gevik/workdir/github/blend65.ri/v4` as a sibling worktree on `feature/v4-rebuild`; keep the present checkout as parked v3 evidence. | ✅ Resolved |
| AR-006 | Technical (complexity escalation) | What curated low-level instruction surface exists beyond the thirteen CPU-control intrinsics? | Current thirteen only / evidence-qualified subset of additional instruction intrinsics / narrow ACME external routines | Use exactly `asm_sei`, `asm_cli`, `asm_php`, `asm_plp`, and `asm_nop` in the initial v4 source language. Every v4 source intrinsic must satisfy the approved finite admission rule. Do not provide inline assembly blocks, external assembly functions, parameterized opcode calls, or the other eight v3 CPU-control names. Full selected-CPU instruction coverage remains internal to the backend. | ✅ Resolved |
| AR-007 | Feature gaps | Does v4 provide automatic placement and explicit low-level placement control? | Automatic only / automatic with expert overrides | Include automatic placement plus explicit expert overrides where hardware or measured constraints require them. | ✅ Resolved |
| AR-008 | UX & presentation | Which inspectable compiler outputs are required? | Final binary only / assembly plus complete resource and placement evidence | Include ASM, labels, versioned asset/memory/cost/build evidence, exact post-ACME reconciliation, occupied/free intervals and compatible holes, cycles, bytes, ZP, stack, SFA, raw-memory proof limits, and hard pre-publication resource failures. Add no percentage threshold or readiness score. | ✅ Resolved |
| AR-009 | Integration points | Is one-command VICE execution part of the developer workflow? | Manual emulator launch / CLI and VS Code build-and-run | Include one-command build and VICE run from the CLI and VS Code. | ✅ Resolved |
| AR-010 | Technical (complexity escalation) | Must v4 build and own a complete source debugger? | VICE monitor only / preserve debug metadata and test existing adapters first / build an owned DAP now | Preserve and emit compiler debug information; do not commit now to a complete Blend65-owned debug adapter. | ✅ Resolved |
| AR-011 | Non-functional gaps | Is an incremental compiler or persistent compilation cache required initially? | Build now / require measured need | Skip initially. Full re-analysis is accepted until measured editor/compiler performance proves the need. | ✅ Resolved |
| AR-012 | Technical | Is a public third-party target/asset plugin framework required? | Public dynamic plugin framework / explicit built-in modular components | Skip the public plugin framework. Build explicit qualified C64 components and extract shared internal seams only from multiple real consumers. | ✅ Resolved |
| AR-013 | Technical | Which C64 execution, video, ROM, startup, and interrupt profile is the first production baseline? | Cooperative PAL KERNAL-loaded PRG / raw-takeover-first / NTSC-first | Implement `c64-pal-prg-kernal-6581` first with the documented cooperative KERNAL contract and normal restoration/return. Recognized interrupt helper ownership is a compile-time per-sink LIFO stack; raw vector writes remain legal but invalidate helper restore proof. Model later PAL takeover and NTSC behavior as separate qualified profiles, not unsafe flag combinations. AR-024 makes the SID model explicit. | ✅ Resolved |
| AR-014 | Scope / authority | Which specification identity governs v4 after accepted language changes diverged from frozen spec v3.0? | One active Specification 4.0 in `spec/` / parallel v3 and v4 specification trees / v3 plus implementation overrides | Create one Blend65 Language Specification 4.0 in `spec/`. Resolve all v4 language decisions first, including ordinary nested lexical shadowing, apply them in one controlled specification phase, pass the Language Guard, update/version/qualify the expert skill once, then freeze both identities before semantic compiler implementation. Git and the parked v3 worktree preserve Specification 3.0; do not maintain parallel active specification trees or implementation-only overrides. | ✅ Resolved |
| AR-015 | Feature gaps / language | Does v4 support taking addresses of fields, array elements, and function parameters? | Keep v3 name-only restrictions / complete addressable-place support | Support `&` on every real addressable storage place, including parameters, nested struct fields, and indexed array elements. The result remains `word`; add no pointer, reference, view, or slice type. Evaluate place/index expressions once, retain hidden lifetime and read-only provenance through derivation, apply the ordinary constant/checked/unchecked array-index contract, reject implicit one-past addresses, and reject literals, temporaries, and inlined scalar constants. Add no runtime checker, descriptor, copy, heap, or helper. | ✅ Resolved |
| AR-016 | Feature gaps / language | What aggregate value model does v4 provide for struct/array returns, copies, assignments, and parameter passing? | Keep v3 restrictions / normal value semantics with zero-copy parameters and copy-eliding returns | Fixed arrays and structs have value semantics for assignment and return. Require exact compatible type and extent; forbid returning unsized `T[]`. Keep aggregate parameters as mutable or `const` zero-copy borrows. Use caller-owned return storage, direct construction, and copy elision. Explicit requested copies preserve source-value semantics and report their cost. Add no mandatory runtime, heap, dynamic frame, or copy intrinsic. | ✅ Resolved |
| AR-017 | Feature gaps / language | Does v4 support nested fixed arrays as true multidimensional storage? | Flatten manually / fixed rectangular arrays with an optional outer-unsized parameter extent / fully unsized or jagged arrays | Support contiguous row-major nested fixed arrays. Every stored extent is fixed. A borrowed parameter may omit only its outermost extent, such as `const byte[][4]`; the inner extents remain fixed. Reject `byte[][]`, `byte[25][]`, dynamic extents, jagged arrays, slices, and views. | ✅ Resolved |
| AR-018 | Feature gaps / language | Does v4 support typed function pointers and statically bounded indirect calls beyond recognized platform callbacks? | Keep recognized sinks only / typed finite-target function values / unrestricted raw-address calls | Support typed `fn(...)` values for named ordinary functions. Track precise targets through storage and control flow; when precision is lost in a closed program, use every address-taken signature-compatible source function as a finite conservative set. Reject only when no finite source set is provable. Interrupt-handler values remain distinct and sink-only. Add no raw callable address, closure, runtime registry, universal dispatcher, or runtime library. | ✅ Resolved |
| AR-019 | Feature gaps / game development | Does v4 provide deterministic compile-time table generation for game data such as sine and lookup tables? | External generation only / separate comprehension DSL / restricted `comptime function` declarations | Add bounded deterministic `comptime function` declarations that reuse normal Blend65 expressions, control flow, fixed values, and aggregate returns. They emit no target code or storage beyond returned constants. Forbid runtime effects and nondeterministic host inputs. Include byte-exact integer-phase `sin8`, `cos8`, `sin16`, and `cos16` compile-time functions. `comptime-budget-v1` fixes one compilation-wide 16,777,216-step, 16-MiB-live-logical-memory, and 512-active-call boundary with exact pre-operation failure and no configuration surface. | ✅ Resolved |
| AR-020 | UX / language | How are the approved expert placement and alignment overrides expressed without creating a general attribute framework? | Project configuration only / general annotations / one closed `place(...)` declaration modifier | Add one expert-only `place(...)` modifier with exactly `at`, `align`, `noCross`, and typed profile `region` constraints. Automatic placement remains the default and platform/asset constraints are applied automatically. Explicit constraints may strengthen but never weaken them. Add no general annotation or extension mechanism. | ✅ Resolved |
| AR-021 | UX / integration | Which LSP and VS Code capabilities are required for the first production release? | Syntax/diagnostics only / focused production language tooling / full IDE and owned debugger | Deliver live frontend/profile/asset diagnostics, completion, hover, signature help, definition, references, safe rename, symbols, semantic tokens, bounded code actions, and one canonical full-document formatter. The thin VS Code extension adds language configuration, project/profile status, explicit build/VICE commands, cancellation, diagnostics/output, and generated-artifact access. It adds no owned debugger, visual designer, package manager, formatting framework, or general refactoring engine. | ✅ Resolved |
| AR-022 | Integration / data | How does a Blend65 project declare source files, target profile, assets, build outputs, and options? | Broad file-glob/override configuration / one manifest and entry-derived graph / scriptable build system | Use one upward-discovered JSONC manifest and entry-derived graph. Preserve exact host input filenames. Validate the separate literal artifact basename against one small Linux/Windows lexical safety floor, preserve accepted spelling, materialize and natively validate the complete profile-owned output set, and keep project data out of ACME source. Exclude `outDir` output state from inputs and publish one uniquely named immutable generation through an atomic current record. Four exact direct non-debug sidecar schemas plus one first-producer debug version-1 contract and explicit input/output hashes describe the result. Add no scripts, hooks, plugins, package manager, globs, filename rewriting, schema framework, content-addressed cache, or second production model. | ✅ Resolved |
| AR-023 | Behavioral / UX | Which optimizer modes are user-visible, and which mode is the production default? | Boolean optimization switch / pass-level switches / four goal-oriented modes | Support exactly `none`, `balanced`, `speed`, and `size`; default production `build` and `run` to `balanced`. `none` is correct deterministic direct lowering with no optional search. The other three exhaust the same finite frontier: balanced accepts no-regression dominance, speed orders cycles/resources/program bytes, and size orders program bytes/resources/cycles. Hard constraints always win; no `max`, weights, hotness, or D64-size objective exists. | ✅ Resolved |
| AR-024 | Scope / platform | Which additional C64 profiles must be qualified before v4 is production-complete: PAL takeover, NTSC, and/or 8580, and what C64U enablement must exist at that boundary? | Baseline only / eight exact base-C64 identities plus mandatory C64U readiness / implement C64U before base-C64 completion | Qualify the PAL/NTSC × KERNAL/takeover × 6581/8580 matrix as eight exact base-C64 profile identities. Before that production gate closes, pass a mandatory C64U-readiness architecture gate and create an owned C64U successor feature. Implement C64U next, but do not block base-C64 production on Ultimate-specific feature implementation. | ✅ Resolved |
| AR-025 | Scope / migration | What happens to v3 compiler, readiness, tests, and false target packages on the v4 branch after salvage inventory? | Retain v3 topology / duplicate under `legacy/` / Git-preserved inventory-led clean branch | Preserve v3 in Git and the parked worktree. Port only independently proven units cheaper and safer than replacement, then remove rejected v3 surfaces before the smallest real C64 graph. Only raw file/path/hash/embed mechanics are plausible asset salvage; native codecs and current-producer fixtures are new v4 work. | ✅ Resolved |
| AR-026 | Non-functional | How does v4 observe host compiler and editor responsiveness, and what evidence reopens incremental compilation? | Hard wall-clock acceptance thresholds / no measurement / observational milestone trends | Record phase-separated check/build, ACME, LSP-request, and peak-memory measurements with project, asset, host, compiler, and configuration identity at relevant milestones. Trend them without wall-clock test, CI, or release failure. Reconsider incremental compilation only when real projects show noticeable delay, profiling attributes it substantially to repeated unchanged analysis, and smaller focused repairs cannot solve it. | ✅ Resolved |
| AR-027 | Scope / delivery | What is the first independently useful, qualified v4 milestone before production completion? | Compiler skeleton / complete unoptimized language / playable complete-pipeline vertical slice | Make M1 a playable PAL/KERNAL/6581 vertical slice built with `optimization: none`. It uses a real project, shared frontend/LSP, qualified SpritePad input, joystick/fire interaction, normal BASIC return, complete semantic/SFA/lowering/ACME/PRG/VICE path, independent behavior and assembly/cost expectations, full resource/debug evidence, and an early C64U-readiness review. AR-037 fixes the exact product as a bounded Invaders-style microgame. Later features remain real vertical slices, not placeholders. | ✅ Resolved |
| AR-028 | Integration / module discovery | How does an entry module's named import locate `.blend` files when filenames have no language meaning and several files may contribute to one module? | One contained source-root module index / path-based imports / explicit source-file inventory | Add one required `sourceRoot` resolved relative to `blend65.json`, independent of the process working directory. Recursively index contained `.blend` files, then compile the entry module's reachable graph. | ✅ Resolved |
| AR-029 | Scope / assets and packaging | Does C64 production include compiler-owned delivery of assets that cannot remain resident in the initial PRG, and what artifact/loader boundary owns it? | Resident PRG only / coordinated disk image and explicit load units / external packaging and loader tools | Include compiler-owned, opt-in disk delivery before C64 production completion. Keep `embed()` resident by default; package explicit nonresident load units with the startup PRG, link only used loader/decompressor code, qualify the disk profile separately, and expose all transport/lifetime/IRQ/audio/resource costs. | ✅ Resolved |
| AR-030 | Scope / portability | How does one codebase vary declarations and behavior across exact C64 profiles and later machines without contaminating target-neutral semantics? | Separate profile-specific entry modules plus compile-time profile constants / add a dedicated conditional-compilation language surface | Use shared modules plus selectable entry modules and immutable compile-time profile constants. Permit recorded `--target` and `--entry` overrides of the manifest defaults. Do not add a preprocessor or conditional-declaration language feature until a real later target demonstrates unavoidable duplication. | ✅ Resolved |
| AR-031 | Language / asset lifetime | What source contract distinguishes resident `embed()` values from packaged load units that are not readable until explicitly loaded? | Reuse ordinary `const byte[]` unsafely / manifest-only asset inventory / explicit typed `loadable const` declaration and destination | Add the narrow `loadable const` declaration modifier. It retains an exact fixed logical type and compile-time metadata but is not CPU-readable storage. It loads explicitly into any mutable lifetime-valid exact-typed place whose interval, visibility, alignment, overlap, alias, and publication proof closes; evaluate and capture the physical range once. Success initializes only that range; failure invalidates only that range; unselected candidates preserve their state. Use compiler-only flow and alias facts, never target validity state. | ✅ Resolved |
| AR-032 | Integration / artifact identity | What is the primary output and `run` behavior for the approved disk-delivery profile, given AR-022 currently hardcodes `<name>.prg`? | Always publish a standalone PRG plus optional D64 / make the qualified profile own one primary deployable artifact | Each profile owns one primary deployable artifact: PRG profiles publish `<name>.prg`; the first disk profile publishes `<name>.d64` with its boot PRG and reachable load units. Primary output and evidence form one immutable generation selected atomically; `run` pins and launches only that fresh generation. | ✅ Resolved |
| AR-033 | Scope / document structure | How should the confirmed v4 scope be decomposed into requirements without driving another horizontal, framework-first implementation? | Ten vertically ordered capability RDs / one RD per compiler pass / a few monolithic RDs | Use ten vertically ordered capability RDs, with M1 in RD-03 and the complete correct `optimization: none` compiler before optional optimizer work. | ✅ Resolved |
| AR-034 | Naming / authority versioning | Which semantic-version category identifies the expert-skill release whose governing language authority changes from Specification 3 to Specification 4? | Major `2.0.0` / minor `1.1.0` / patch `1.0.1` | Publish the Specification 4 expert baseline as `2.0.0`. | ✅ Resolved |
| AR-035 | Scope / specification authority | Which target appendices and platform claims are normative in Specification 4 while v4 implements and qualifies only C64? | Only qualified C64 targets normative / all five existing appendices normative / retain four non-normative provisional appendices inside the active spec | Make only qualified C64 profiles normative; remove the four unqualified target appendices from the active specification and retain future-target constraints as explicit non-support material. | ✅ Resolved |
| AR-036 | Technical (complexity escalation) | Does the clean v4 foundation retain Turborepo and pre-emptive Vite configuration, or use the toolchain's direct build/test graph until a real consumer proves more machinery is needed? | Yarn workspaces + TypeScript project references + Vitest only / retain Turborepo and current Vite placeholders | Retain the useful v3 monorepo setup: Yarn classic workspaces, Turborepo, stable TypeScript 7, and Vitest, with no ESLint or replacement linter. Do not carry unused Vite placeholders; add Vite or another bundler only for a real packaging consumer. | ✅ Resolved |
| AR-037 | Scope / M1 product and asset provenance | Does M1 remain a single-sprite interaction or become a bounded Invaders-style game, and when must the authentic SpritePad 3.80 input exist? | Keep the single-sprite loop / bounded original-art Invaders-style microgame / faithful full game recreation | Use the bounded original-art eight-sprite Invaders-style M1 with no multiplexer, audio, loader, IRQ callback, or optimizer. Before SpritePad-dependent RD-03 planning, the user supplies the current SpritePad 3.80 native project, M1-relevant exports/settings, hashes, provenance, retention status, and distinguishable expected records for the exact consumed SPD v5 surface. Asset-independent frontend planning may proceed first under the 2026-09-18 approved exception. | ✅ Resolved |
| AR-038 | Scope / product boundary | Since games are Blend65's primary use case, does v4 ship reusable game-engine/gameplay systems or qualify a general language/compiler that lets developers write them? | Ship reusable game systems / general compiler plus narrow asset and platform integration, with game workloads as qualification / separate optional engine product | Blend65 remains a general 6502-family language, AOT compiler, toolchain, and narrow target-platform library for games and other software—not a game engine, framework, or gameplay library. Its only game-oriented convenience is compile-time ingestion, validation, conversion, typing, and target integration of external assets such as sprites, charsets, maps, images, and SID content. Typed hardware access and low-level delivery are general platform services. Game loops, entities/pools, collision, state dispatch, renderers, scene graphs, sprite-multiplexing, scrolling, buffering, audio scheduling/mixing, and every other application algorithm remain user-authored. Asset adapters may expose data, metadata, symbols, placement constraints, and an exact player ABI, never runtime game policy. The compiler must express, lower, diagnose, and optimize those workloads correctly. Examples and Q-P workloads are qualification oracles only, never public game modules. | ✅ Resolved |
| AR-039 | Data / native asset compatibility | How does the Koala handler treat nonzero unused high bits in the 1,000 Color RAM source bytes? | Preserve and accept exact source bytes while documenting low-nibble hardware meaning / reject any nonzero high nibble / silently normalize every byte to its low nibble | Accept and preserve all eight source bits, expose the low nibble as the hardware color meaning, and never reject or silently normalize an otherwise exact classic Koala file solely because unused high bits are nonzero. | ✅ Resolved |
| AR-040 | Scope / native asset baseline | Which external asset identities and adapters form the initial qualified C64 production baseline? | Current pinned producer/interchange identities only / broad backward-compatible generations / raw files only | Use built-in handlers for SpritePad 3.80/SPD v5, CharPad 3.88/CTM v9, the self-contained PSID v1–v4 subset, classic Koala, and raw unregistered files. GoatTracker 2.77 is the first adapter RD-06 must qualify; it does not become active until its exact hash-bound evidence and ABI contract pass that gate. Each full current-producer handler plan requires its complete fixture matrix, expected values, provenance, hashes, and retention/redistribution decision. Missing evidence pauses only that format or adapter; never guess, shrink scope silently, or add a plugin framework. | ✅ Resolved |
| AR-041 | Data / native asset compatibility | Does AR-039's exact-byte preservation also apply to the classic Koala file's final one-byte background color? | Preserve the complete source byte while documenting low-nibble hardware meaning / reject a nonzero high nibble / silently normalize to the low nibble | Apply the same rule as Color RAM: accept and preserve the complete background source byte, expose `value & $0f` as its VIC-II color meaning, and neither reject nor silently normalize solely because an unused high bit is nonzero. | ✅ Resolved |
| AR-042 | Platform / initial disk transport | Which concrete loader and compression contract is the first qualified implementation for `c64-pal-d64-kernal-6581`? | KERNAL sequential load with uncompressed load units / a specific fastloader and compressor from the first slice / a generic loader-plugin system | Qualify one built-in KERNAL sequential loader with uncompressed, directly placed load units; link it only when reachable. Keep strategy identity and complete resource/cost evidence in the internal boundary, but add no fastloader, compressor, or public plugin framework until a separately measured game workload justifies and qualifies one. | ✅ Resolved |
| AR-043 | Runtime ownership / loading concurrency | What does the first KERNAL loader do when user-installed IRQ/NMI callbacks, player/audio ticks, or another selected-profile asynchronous observer/writer may be active? | Require explicit quiescence and prove it / silently suspend and reconstruct user activity / permit continued activity under a new continuity contract | Require the user program to explicitly stop/restore its own callback and audio routes and prove every other selected-profile asynchronous observer/writer absent or quiescent before `load()`, while the required stock KERNAL service route remains active. Reuse recognized ownership state to reject any unproved call. Do not silently stop/restart application behavior or claim timing continuity. C64U DMA is unqualified here; a later loader may qualify an explicit continuity contract. | ✅ Resolved |
| AR-044 | Safety / corrupted runtime disk data | The stock KERNAL relocating `LOAD` accepts a destination address but no maximum length. What guarantee does the first loader make if a packaged load-unit file is later corrupted or replaced with a valid longer file? | Trust the compiler-produced D64 and diagnose only observable KERNAL/end-address failure / add a custom bounded and checksummed transport now / stage and validate before copying | Define the exact compiler-produced D64 as the trusted deployable unit. The baseline wrapper reports KERNAL failure and rejects a returned end address unequal to `destination + sizeof(unit)`, but it cannot promise containment after a longer altered file has already been transferred. Add no checksum, staging copy, or custom bounded transport to the KERNAL-first slice; record this as an explicit hardware/toolchain limitation and require a later qualified loader for hostile or independently mutable media. | ✅ Resolved |
| AR-045 | Behavioral (complex) / optimizer goal selection | When correct 6502 candidates trade cycles against bytes or scarce resources, how do `balanced`, `speed`, and `size` choose deterministically without guessing workload frequency? | Complete-cost Pareto/lexicographic policy / one profile-owned weighted scalar / user-configurable weights and hotness | Filter hard constraints first. Let `B` be target-loadable compiler program/data bytes, `R` the stable target-resource vector, and `T` comparable semantic-path cycles. Balanced accepts only no-regression dominance; speed orders `T → R → B`; size orders `B → R → T`. Fixed D64/container/evidence bytes never enter selection. Use no weights, hotness annotations, policy DSL, PGO, guessed frequency, or `max` mode. | ✅ Resolved |
| AR-046 | Behavioral (complex) / optimizer frontier and search completion | What belongs in the qualified optimization frontier, and what proves that an optimized mode has searched it deeply enough: combined modern and 6502-specific techniques exhausted to proved closure, only traditional 6502 tricks, a broad imported modern optimizer framework, globally exhaustive assembly search, or a heuristic pass budget? | Finite combined modern-plus-6502 frontier exhausted to proved closure, with structured peepholes and bounded exact search / 6502 tricks only / broad imported optimizer framework or catalog / globally exhaustive search across all equivalent programs / heuristic fixed-pass or first-good completion | Freeze a deep, sourced modern-plus-6502 optimization knowledge inventory into expert baseline `2.0.0`, then use the same finite evidence-qualified candidate frontier for `balanced`, `speed`, and `size`. Admit concrete techniques by Blend65 semantics, current consumer, complete rule packet, exact 6502/full-program costs, two independent oracles, and expert parity—not by historical or modern provenance. Exhaust that frontier at the smallest complete owning scope, repeat affected groups to a proved deterministic fixed point, and run structured contextual peephole optimization. Permit exact enumeration only for explicitly small finite regions with an independent equivalence oracle. Import algorithms and proof ideas, never another compiler's architecture or target assumptions. Never stop at the first improvement or certify success through an iteration cap. Claim frontier-optimality, not universal mathematical optimality; a newly discovered winning expert candidate reopens the frontier as parity debt. | ✅ Resolved |
| AR-047 | UX / VS Code execution commands | How do `Run in VICE` and `Build and Run` differ when every run must successfully build a fresh artifact in the same invocation, and how are unsaved build inputs handled? | Keep only `Build` and fresh `Run in VICE`, saving relevant dirty build inputs first / retain a separate existing-artifact rerun path with strict currentness proof plus `Build and Run` | Expose only `Blend65: Build` and `Blend65: Run in VICE`; remove redundant `Build and Run`. Before either command, save dirty open project inputs consumed by that operation; abort with an actionable message if saving is declined or fails. `Run in VICE` performs a fresh build and launches only that invocation's artifact. The LSP continues to analyze unsaved snapshots independently. | ✅ Resolved |
| AR-048 | Scope (complex) / production host matrix | Which host operating-system and architecture combinations receive the complete production compiler, editor, ACME, and VICE workflow, and how are machine-local tools selected? | Linux x64 plus Windows x64 production, with other Node 22 hosts best-effort / Linux x64 only / Linux, Windows, and macOS across x64 and ARM64 | Qualify `linux/x64` and `win32/x64` on Node 22 first; other Node 22 hosts are best-effort. The compiler library is tool-free. Tool-requiring CLI/editor commands read optional machine-local `tools.jsonc` schema 1, using valid explicit absolute paths first and otherwise one ordered process-`PATH` scan for `acme`/`x64sc` on Linux or `acme.exe`/`x64sc.exe` on Windows. Do not consult `PATHEXT`, a shell, registry, or install-location list. Validate with ACME `--version` and VICE `-version`; invalid explicit paths or the first PATH match with an incompatible identity do not fall back. Projects cannot supply tools and nothing auto-installs them. | ✅ Resolved |
| AR-049 | Technical / authority verification | How much process is required to freeze Specification 4 and requalify expert `2.0.0`? | **Recommended after complexity reassessment:** one central normative inventory plus deterministic corpus digest and raw final hashes; one concise `prior path / disposition / governing decision / destination` crosswalk; exact direct checks with durable evidence; impact-based qualification of changed and transitively dependent expert cases plus one unchanged control per casebook and all-case structural checks; one final independent evidence/domain review; candidate bytes remain outside the live skill until explicit approval. Remove per-file identity stamps, passive Markdown test files, the complete 107-case blind rerun, hunk-level ledgers, arbitrary file/row batching, and duplicate reviews. | User authorized the simplification reset on 2026-09-13 and confirmed proceeding after reviewing its prevention contract. | ✅ Resolved |
| AR-050 | Language semantics | What exact observable integer rule governs `sin8`, `cos8`, `sin16`, and `cos16`? | **Recommended after independent challenge:** for width `k`, unsigned phase `p` denotes `p / 2^k` turns; amplitude is `2^(k-1)-1`; sine is the nearest integer to `amplitude × sin(2πp / 2^k)` with exact halves rounded away from zero; cosine is sine at a wrapped quarter-turn offset. This yields symmetric ranges `-127..127` and `-32767..32767`, exact half-turn negation, safe negation without signed-minimum overflow, and no prescribed compiler algorithm. Freeze independently reproduced exhaustive sine-stream fingerprints and representative vectors; derive cosine through the quarter-turn relation. | User accepted the recommendation on 2026-09-13. | ✅ Resolved |

## Resolution Notes

### AR-004 — No v3 compatibility

No one uses or has previously used Blend65 v3. V4 therefore carries no source, configuration, CLI,
API, package, diagnostic, generated-assembly, binary, artifact, or migration obligation for v3.
V3 remains available only as Git history, audit evidence, and component-level salvage input.

### AR-010 — Approved simplified debugging complexity

- **Original goal:** Later full source-level debugging for modern Blend65 users in VS Code.
- **Extra system or support code:** A versioned compiler debug-information artifact and later
  emulator-adapter integration.
- **Why it may be needed:** VICE exposes machine state but does not know Blend65 source spans,
  types, optimized liveness, SFA homes, or bank-qualified object identity.
- **Evidence:** VICE 3.10 documents breakpoints, watchpoints, registers, memory, labels, and a stable
  binary-monitor interface. V3 contains source-provenance, SFA-home, VICE-control, and ACME-label
  evidence, but no source debugger.
- **Smallest solution that still works:** ACME/VICE labels plus direct VICE-monitor use. This does
  not satisfy the accepted modern source-debugging outcome.
- **Extra cost:** One host-side schema/serializer, source and live-location preservation, bank-aware
  mapping, focused qualification, and a later interoperability probe. There is no PRG, RAM, ZP,
  hardware-stack, or runtime-cycle cost.
- **Independent verdict:** `Simplify` — preserve the information and user outcome without selecting
  or building an owned DAP now.
- **Direct user decision:** “Preserve and emit the compiler debug information, but do not commit now
  to building a complete Blend65-owned debug adapter.”

The compiler must preserve enough information from its first relevant representations to emit:

- machine-address ranges mapped to source spans;
- function and call context;
- SFA variable homes, types, and live ranges;
- symbols and bank identities; and
- the facts needed for source breakpoints, stepping, and variable inspection.

Before choosing an adapter implementation, a focused interoperability test must determine whether
an existing VICE-capable adapter can consume the compiler information correctly. A Blend65-owned
DAP is not authorized unless that probe demonstrates a semantic or integration gap and a new
complexity decision approves the larger subsystem.

### AR-006 — Approved curated instruction surface

- **Original goal:** Give advanced developers a safe, predictable escape for low-level C64 needs
  without restoring an unstructured `asm { ... }` block.
- **Extra system or support code:** External ACME function declarations and modules, plus manifest
  mappings, an external-call ABI, effect and clobber declarations, stack/SFA integration, symbol
  validation, path controls, and dedicated qualification.
- **Why it may be needed:** An external routine could express a machine operation or third-party
  assembly routine that ordinary Blend65 and its platform library cannot express.
- **Evidence:** V3 can concatenate referenced ACME text, but its analysis does not prove the full
  callee, interference, effect, and stack contract required for a safe external call. The finite
  NMOS 6502 audit also showed that almost every useful opcode belongs in normal source semantics,
  a target API, or backend instruction selection instead of a source opcode call.
- **Smallest solution that still works:** Keep ordinary Blend65 operations and zero-cost platform
  APIs as the main surface and admit only source instructions with stable, complete semantics. The
  initial set is the five controls below; a missing modern-language or platform operation is fixed
  at its real semantic level.
- **Extra cost:** At least one language surface, project configuration, trusted ABI/effect model,
  call-graph and SFA participation, ACME symbol/range validation, and permanent safety and cost
  qualification for arbitrary project-owned assembly.
- **Independent verdict:** `Simplify` — a narrow, trusted ACME extern boundary was viable if an
  external-call capability remained required, but an object format, linker, dialect system, or
  plugin layer was not. The user's later clarification removed the extern requirement entirely,
  and the finite instruction audit produced the smaller source surface.
- **Direct user decision:** Approve exactly `asm_sei`, `asm_cli`, `asm_php`, `asm_plp`, and
  `asm_nop`; do not add external assembly functions, inline assembly blocks, or other opcode-shaped
  source calls.

An `asm_*` source intrinsic is admitted only when it solves a demonstrated low-level need that
ordinary Blend65 or a zero-cost platform API cannot express, has complete typed inputs/results and
machine effects, needs no persistent hidden A/X/Y/flag state between calls, exposes no assembler
labels or compiler-owned storage, is legal for the selected CPU, and has exact optimization, SFA,
byte, cycle, stack, memory, and bus contracts. An intrinsic whose name promises one instruction
must emit that instruction exactly; a larger semantic operation uses a semantic or platform API
name instead.

The finite NMOS 6502 family audit is recorded in
`_draft/instruction-intrinsic-audit.md`. The approved initial source set is exactly
`asm_sei`, `asm_cli`, `asm_php`, `asm_plp`, and `asm_nop`.

### AR-013 — First C64 production profile

The first implemented production profile is `c64-pal-prg-kernal-6581`:

- stock unexpanded PAL C64 using the NMOS 6510 and PAL VIC-II timing;
- one SID at `$D400`, initially qualified for 6581 behavior;
- KERNAL-loaded PRG with a BASIC `SYS` autostart at `$0801`;
- BASIC ROM banked out while KERNAL ROM and I/O remain visible;
- cooperative KERNAL CINV IRQ chaining by default; and
- a normal return that restores compiler-owned startup state and returns to BASIC, while an
  unreleased exclusive resource makes normal return invalid.

The architecture represents execution profiles from day one, but raw takeover and NTSC behavior
are separately qualified profiles. They are not independent switches that may be combined without
a complete memory, startup, interrupt, loader, audio, timing, and verification contract.

For each recognized interrupt sink, compiler-proved helper installation forms a LIFO ownership
stack. Restore must match the exact active top at every control-flow join. Repeated or nested
installation is legal when the maximum depth is finite and proven; SFA/resource closure allocates
all predecessor words. A raw vector write remains expressible but invalidates helper ownership for
that sink, so a later helper restore is diagnosed. No runtime token, flag, registry, or scheduler is
introduced.

### AR-014 — Single Specification 4.0 authority

V4 is governed by one active Blend65 Language Specification 4.0. Language decisions are collected
before changing `spec/`; they are then applied as one controlled baseline update, checked against
the complete Language Guard, reconciled into one newly versioned and qualified expert skill, and
frozen before semantic compiler implementation begins. The requirements register preserves every
decision feeding that update. Git history and the parked v3 worktree preserve Specification 3.0,
so a duplicate live specification tree would add drift without preserving anything new.

Specification 4 replaces v3's compiler-convenience ban on lexical shadowing with ordinary nested
lexical scope. A declaration may shadow an ordinary declaration in a parent module, function, loop,
or block scope; sibling scopes may independently reuse a name; and lookup selects the nearest
visible declaration. A function's parameters and outermost body declarations share one duplicate
domain. A `for` initializer owns a scope covering its condition, update, and body; its body is a
child scope and may shadow the header declaration. A new declaration becomes visible only after its
initializer completes, so a shadowing initializer can read the previously visible outer binding.
Leaving a child scope restores the outer binding. Same-scope collisions remain E10003. Keywords,
reserved intrinsic names, and the special `main` contract remain unavailable for shadowing under
their dedicated rules. E10101 is retired and reserved; legal shadowing has no default warning.

Every declaration receives a stable symbol identity independent of spelling. Name resolution,
definite assignment, effects, SFA liveness/interference/homes, optimization, LSP navigation and
rename, and debug evidence operate on that identity rather than a name-keyed map. Two live bindings
with the same spelling cost exactly what two differently named bindings would cost; the language
change adds no target runtime, ROM, RAM, ZP, stack, or cycle overhead.

### AR-015 — Complete addressable-place support

The v3 name-only restriction was compiler convenience rather than a 6502 constraint. Specification
4.0 therefore permits `&` on any real storage place: variables, parameters, nested fields, indexed
elements, and their compositions. The result stays `word`; no pointer/reference/view/slice type is
introduced. Index/place expressions evaluate once. Constant, checked, and unchecked indexing keep
their normal behavior, and one-past addressing requires explicit arithmetic rather than implicit
array permission.

Derived addresses retain the base object's hidden lifetime and read-only provenance. Local and
scalar-parameter homes cannot escape their active invocation; aggregate-parameter addresses inherit
their caller origin; known writes through const-derived addresses are rejected. Literals,
temporaries, and inlined scalar constants remain non-addressable. The proof is compile-time only and
adds no runtime checker, descriptor, copy, heap, or helper.

### AR-016 — Aggregate value semantics without a runtime

Fixed arrays and structs are ordinary values for assignment and return. Source and destination
types, including every fixed-array extent, must match exactly. An unsized aggregate parameter such
as `T[]` is a borrowed parameter form and cannot be a return type.

Aggregate parameters retain the zero-copy model: `name: T` is a mutable borrow and
`name: const T` is a read-only borrow. Aggregate returns use caller-owned hidden destinations,
direct construction, and copy elision, so returning a value does not imply a dynamic stack frame or
an avoidable temporary. When source code explicitly requests a value copy, aliasing must preserve
source-value semantics and the compiler must report its measured byte and cycle cost. The backend
may select expert inline code or a specialized shared sequence according to measured whole-program
cost, but any helper scratch closes before SFA. V4 adds no generic runtime library, heap, dynamic
frame, or separate `copy()` intrinsic.

### AR-017 — Fixed rectangular multidimensional arrays

Specification 4.0 supports nested fixed arrays as true contiguous row-major storage. Dimensions are
written and indexed from outermost to innermost: `byte[25][40]` is 25 rows of 40 bytes and is
accessed as `map[row][column]`. Every stored extent is a compile-time constant. Nested initializers
must conform to the declared rectangular shape, and assignment and return follow AR-016's exact
type-and-shape rule.

A borrowed parameter may omit only its outermost extent. For example, `const byte[][4]` accepts any
fixed row count whose rows contain exactly four bytes. The call supplies the base address and outer
count without copying; the inner extent gives the compiler a static row stride. `length(map)` is
the supplied outer count and `length(map[row])` is the fixed inner extent. Forms such as
`byte[][]` and `byte[25][]` are invalid because their element stride is unknown. V4 adds no dynamic
extent, jagged-array, slice, view, heap, or runtime descriptor model.

Each subscript follows the ordinary constant, checked, or unchecked ordinal rules independently.
Address-of applies to rows and elements under AR-015. Lowering uses the complete inner object size
for each stride and must strength-reduce or hoist address work where expert 6502 code would do so.

### AR-018 — Typed finite-target function values

Specification 4.0 adds `fn(parameter-types): return-type` as the callable type of named ordinary
functions. `&ordinaryFunction` produces a signature-exact function value. Function values may be
assigned, stored in fixed arrays or structs, passed, returned, selected, and called. V4 adds no
lambdas, closures, captured environments, dynamic code loading, or callable raw addresses.

An ordinary function value denotes an `RTS` target. An `interrupt function` produces a distinct,
non-callable handler value whose entry ABI is selected only by a compatible recognized platform
sink. Explicit conversion of either value to `word` is an expert proof-erasing operation; a raw
`word` can never be converted back into a callable or handler value.

Every indirect call requires a finite compiler-proven set of signature-compatible source targets.
Points-to provenance follows assignments, aggregate storage, parameters, returns, and conditional
merges. When a value is imprecise in a closed program, its conservative set is every address-taken,
signature-compatible source function; call-graph, effect, recursion, hardware-stack,
bank-visibility, interrupt-overlap, and SFA analysis consume that complete set. Reject the call only
when no finite source target set can be proved. Raw callable addresses, runtime target registries,
and universal dispatchers remain forbidden.

The backend devirtualizes singleton targets and chooses the measured expert form for larger sets:
direct comparisons, a decision tree, a jump table, specialization, or an indirect trampoline. If
the same source target needs different SFA machine variants by execution domain, a context-specific
finite dispatch maps the stored target identity to the correct variant; it may not call an unsafe
shared home. All ROM, RAM, ZP, stack, byte, and cycle costs are reported. No universal dispatcher,
runtime registry, dynamic frame, or runtime library is introduced.

### AR-019 — Deterministic compile-time functions

Specification 4.0 adds `comptime function` declarations for programmatic constant-data generation.
They reuse normal Blend65 local variables, fixed arrays and structs, expressions, conditions,
loops, direct calls to other compile-time functions, and AR-016 aggregate returns. Arguments and
every externally read value must be compile-time constants. Returned values may initialize scalar,
struct, or fixed-array constants and then participate normally in placement, alignment,
deduplication, memory maps, and debug provenance.

A compile-time function may read constant data, including an already validated `embed()` result. It
may not access MMIO; use `PEEK`, `POKE`, or `asm_*`; modify runtime state; make indirect calls; read
files directly; observe time, randomness, environment, or network state; or call runtime-only
functions. Recursion remains forbidden. Deterministic execution-step and logical-memory limits prevent
non-terminating or hostile evaluation and produce source diagnostics rather than a compiler hang.
Ordinary Blend65 typing, overflow, conversion, division, and bounds rules govern evaluation.

`comptime-budget-v1` applies one shared counter set to every compile-time root in one `check` or
`build`, consumed in deterministic semantic evaluation order. It permits exactly 16,777,216 steps,
16,777,216 bytes of peak live logical evaluator-owned value storage, and 512 active compile-time
function invocations. The root invocation is depth 1. The operation requiring step 16,777,217, an
allocation that would make live logical storage exceed 16,777,216 bytes, or a call that would enter
depth 513 fails before that operation, mutation, argument evaluation, or function body executes.
The failed evaluation is poisoned and no target artifact is emitted.

One step is charged before evaluating each selected expression node, executing each statement node,
starting each loop iteration, entering each compile-time function, and initializing, copying, or
materializing each logical aggregate byte. Short-circuited expressions and unselected branches cost
nothing. Caching or memoization may reduce host work but must charge the same abstract steps as an
uncached evaluation.

Live logical memory uses Blend65 language widths: scalars use their defined byte width and arrays
and structs use normative `sizeof`. Parameters, locals, expression temporaries, in-progress
aggregates, return values, and retained generated constants count while live. Aliases do not add a
second charge; an existing immutable constant or validated embedded asset read without copying is
not charged again. Storage is released at its defined full-expression, block, call, or evaluation-
phase lifetime boundary. Host object overhead, allocator behavior, and process memory do not affect
source acceptance. A real host allocation/OOM failure is a separate bounded compiler failure, never
a language-budget diagnostic, and publishes no artifact when the process can report or clean up.

The v1 limits are fixed, not configurable through source, manifest, environment, or CLI. A changed
accounting unit or lower limit is a breaking language change; a raised limit expands accepted source
but still requires a new budget/specification version. The exact diagnostics are:

- E10269: `Compile-time evaluation step budget exceeded — 'comptime-budget-v1' allows 16777216 steps; attempted step 16777217 while evaluating root '<root>'`.
- E10270: `Compile-time evaluation memory budget exceeded — 'comptime-budget-v1' allows 16777216 live logical bytes; allocating <requested> bytes would require <attempted> while evaluating root '<root>'`.
- E10271: `Compile-time call-depth budget exceeded — 'comptime-budget-v1' allows 512 active calls; call to '<callee>' would enter depth 513 while evaluating root '<root>'`.

The primary span is the failing expression, statement, allocation-producing operation, or call. A
related span identifies the root invocation.

The initial compile-time math surface includes `sin8(byte): sbyte`, `cos8(byte): sbyte`,
`sin16(word): sword`, and `cos16(word): sword`. Their phase covers one complete turn and their
integer results, extrema, symmetry, and rounding are normative and byte-exact; implementation may
not delegate observable results to a host-dependent floating-point library. A compile-time
function emits no 6502 instructions, SFA home, hardware-stack use, helper, or runtime library. Only
the returned constant data consumes target storage.

### AR-020 — Closed expert placement modifier

Specification 4.0 adds one closed `place(...)` declaration modifier. Its initial named constraint
set is exactly:

- `at: address` — require one exact target address;
- `align: size` — require the starting address to be a multiple of the size;
- `noCross: size` — require the complete emitted object to remain within one naturally aligned
  window of that size; and
- `region: symbol` — require a typed placement region exported by the selected target profile.

Addresses and sizes are compile-time integer values. Alignment and no-cross sizes are positive
powers of two in the target's representable placement domain. A profile-region value is a typed
compiler symbol, not a magic string. One clause may combine compatible constraints. The modifier
immediately precedes a module-level stored-data or function declaration; after `export` it is
written `export place(...) ...`. It may refine an item inside a `zeropage` block, including an exact
profile-available zero-page address. A placed scalar `const` is deliberately materialized and
becomes addressable rather than inlined. Locals, parameters, fields, types, and compiler-owned SFA
homes cannot be source-placed.

Automatic placement is authoritative for normal code. Platform APIs, asset handlers, instruction
selection, and timing contracts add their required constraints without user syntax. An explicit
`place(...)` clause can strengthen those facts but cannot waive visibility, banking, alignment,
ownership, reserved-memory, or target-legality rules. Constraints on aliases of one canonical
embedded object are combined; conflict is a diagnostic, never silent replication. Unsatisfiable or
conflicting constraints report the object, every contributing requirement, and occupied ranges.
The modifier adds no runtime action, copying, hidden reservation framework, or general annotation
extension point.

### AR-021 — Focused production language tooling

The production language server shares the compiler's lexer, parser, typed semantic model,
diagnostics, source spans, project graph, target-profile metadata, and asset-handler metadata. It
analyzes versioned unsaved document snapshots, supports cancellation, and discards stale results.
Normal editor requests never import or execute target lowering, code generation, assembly,
packaging, or VICE.

Its required protocol surface is live lexical, syntax, semantic, import, target-profile, asset, and
placement diagnostics; context-aware completion including `embed()` paths/selectors and typed
placement regions; hover; signature help; definition; references; safe project-wide rename;
document/workspace symbols; semantic tokens; bounded compiler-provided code actions; and one
deterministic full-document formatter with no option framework. Generated, platform-owned,
ambiguous, or unsafe rename/fix requests are rejected rather than guessed.

The VS Code extension is a thin client. It supplies syntax highlighting, comments, bracket and
indentation rules, automatic language-server startup, project/profile status, explicit `Build` and
fresh-build `Run in VICE` commands, cancellation, Problems/Output integration, change refresh, and
commands to open emitted assembly, labels, memory/asset maps, and cost reports. AR-047 removed the
redundant `Build and Run` command and requires save-or-abort handling for dirty consumed inputs.
Opening an untrusted workspace may analyze text but cannot launch tools or VICE; execution requires
trust and an explicit user command.

The initial production surface does not include a Blend65-owned debug adapter, visual asset or
memory editors, a package manager, a plugin marketplace, a configurable formatting framework,
general automated refactoring, or mandatory incremental compiler/cache infrastructure. AR-010's
debug-information artifact remains required for later adapter interoperability.

### AR-022 — One deterministic project and build model

One JSONC `blend65.json` manifest defines a production project. It has comments and trailing commas,
a required configuration schema version, project/output name, one entry source module, one exact
qualified target profile, project-contained asset search paths, project-contained output directory,
the AR-023 optimization mode, and independent `boundsCheck` and `divisionZeroCheck` options. The
nearest manifest found by walking upward defines the project root. Unknown keys, duplicate keys,
invalid values, and unsupported schema versions are errors.

The entry module's imports define the complete source graph; there are no include/exclude globs or
second source inventory. Literal `embed()` declarations define the asset graph, with search first
relative to the declaring source and then through manifest asset paths. Paths are resolved and
contained by the project root while preserving the exact spelling, case, spaces, and Unicode
exposed by the host filesystem; Blend65 performs no Unicode normalization, case folding, filename
rewriting, or cross-host case-collision policy. Internal deterministic ordering uses `/` only as a
separator representation. These input rules impose no cross-host filename policy. The manifest
`name` is a separate nonempty, well-formed Unicode scalar sequence used literally as the primary
artifact basename on both production hosts. Reject `/`, `\`, NUL, U+0001 through U+001F,
`<`, `>`, `:`, `"`, `|`, `?`, `*`, `.` and `..`, a final ASCII space or period, and these Windows
device stems with ASCII case-insensitive comparison of the substring before the first period:
`CON`, `PRN`, `AUX`, `NUL`, `COM1` through `COM9`, `LPT1` through `LPT9`, and `COM`/`LPT` ending in
superscript `¹`, `²`, or `³`. Preserve every accepted code point, including casing,
Unicode, internal spaces, and internal periods. Never normalize, fold, slug, truncate, or rewrite
the name, and do not guess a universal filename-length limit. This predicate never applies to
source or asset filenames.
`outDir` is a relative contained output-state path that may be created and is excluded before every
source/asset discovery walk and build-identity hash. Reject absolute or escaping output paths,
symlink escape, a required directory occupied by a file, or an explicitly declared source/asset
inside `outDir`; prior valid generations inside it are expected. One invocation builds one target
profile. Host-specific ACME and VICE executable discovery belongs to machine-local CLI state, not
the shared project file. The manifest cannot run shell commands, scripts, hooks, plugins, or
arbitrary host tools.

The CLI surface is `blendc check`, `blendc build`, and `blendc run`, each accepting an optional
explicit `--project` manifest path and otherwise using upward discovery. `check` stops before target
lowering/ACME; `build` emits the binary and all required evidence; `run` launches VICE only after
that same invocation builds successfully. Production compilation requires a manifest rather than
a parallel single-file configuration model. Explicit command-line diagnostic, safety, or
optimization overrides are recorded in build evidence.

A successful build first materializes its complete final component plan: the literal-name primary
deployable artifact plus fixed `.asm`, `.labels`, `.memory.json`, `.assets.json`, `.costs.json`,
`.debug.json`, and `.build.json`. Before invoking a tool it checks component uniqueness and native
aliases; exclusive creation inside the new uniquely owned generation under `outDir` decides actual
filesystem limits and ordinary-file ownership without a guessed maximum or stat-then-write race. It
never follows or replaces a symlink/device/directory, overwrites or merges a file, or authorizes a
later overwrite inside the immutable generation. Compiler-written
generation files use exclusive creation. The only deliberate replacement is fixed
`<outDir>/current.json`; the generation directory is the canonical UUID v4 already specified, so
neither publication-control name derives from project data. ACME receives
output format/name/report/symbol paths only as separate direct arguments;
the generated assembly contains no `!to`, manifest name, or output path. The build completes and
reconciles that generation, then
atomically replaces one small current-generation record under a short publication lock. Failure
removes only its unique incomplete staging area, cannot expose a mixed generation, and preserves
the prior current record. Before releasing that lock, `run` exclusively creates its own empty
ordinary pin at `<outDir>/.pins/<generationId>/<pinId>.pin`, then retains the pin until every owned
VICE/monitor reader stops. Every compiler-owned reader that keeps a generation beyond the lock does
the same with a distinct UUID-v4 `pinId`. Cleanup holds the lock through deletion and keeps the
current generation, its immediate predecessor in lock-serialized publication order, and every
pinned generation. It deletes only other provably unpinned generations. Normal released-pin
retention is bounded to current plus one predecessor. A crash-left, malformed, unreadable, or
otherwise uncertain pin fails closed and is diagnosed for deliberate recovery after all project
operations stop; PID, process existence, age, and clocks never authorize deletion. The build record
binds portable semantic inputs and output digests without hashing itself. AR-032 defines PRG and D64
primary outputs. V3's JSONC parsing and upward discovery are
salvage evidence only; its broad configuration and compatibility behavior are not inherited. V3
raw file reading, path handling, hashing, and literal `embed(path)` mechanics are candidates only.
V3 contains no qualified native SpritePad, CharPad, SID, or Koala codec or current-producer fixture
to port as authority; those are new v4 work grounded in the evidence gates below.

Every successful artifact-producing invocation assigns one unique opaque `generationId`: the
lowercase canonical UUID v4 returned by Node `crypto.randomUUID()`. It names only the immutable
publication directory and is used by the current-generation record and run pins; an existing target
directory fails publication rather than being overwritten or reused. The ID is not a cache key,
does not identify program semantics, and never enters deterministic sidecars.
`.build.json` records that `generationId`, canonical semantic inputs, portable tool identities,
host provenance, and digests for every other generated artifact without hashing itself. The atomic
current-generation record contains the `generationId` and the SHA-256 of its `.build.json`.
Reproducibility compares the recorded semantic inputs, portable tool identities, and deterministic
output hashes. Absolute host paths, executable hashes, duration, peak host memory, and
`generationId` are invocation provenance excluded from that comparison. Equivalent builds create
distinct generations but retain identical deterministic outputs. No generation is reused as a
content-addressed cache entry.
The public `.assets.json`, `.memory.json`, `.costs.json`, and `.build.json` files each have their own
complete direct version-1 contract frozen by RD-03 before its first producer tests: exact closed
roots and tagged unions, required/forbidden fields, stable record identities and array ordering,
digest derivations, local and cross-artifact invariants, and canonical encoding. E10267 diagnoses a
malformed envelope or supported-version value; E10268 diagnoses only a correct kind with an
unsupported positive integer schema version. The build evidence hashes each artifact directly and
does not persist a redundant aggregate artifact hash. These are direct schemas, not a registry,
service, database, generator, or shared runtime schema framework.

The complete `.debug.json` version-1 envelope, record unions, index relationships, canonical order,
encoding, and rejection behavior are frozen by RD-03 before its first specification tests or
producer implementation. RD-03 emits only the applicable M1 facts. RD-04 through RD-08 populate
the already-admitted language, platform, asset, loader, and optimizer record families as those
producers become real. RD-09 consumes and validates that same contract and runs a bounded adapter
interoperability probe. This debug evidence adds no target runtime, instrumentation, DAP service,
schema registry, or shared schema framework; any later representational change requires explicit
schema evolution rather than a silent version-1 extension.

### AR-023 — Four goal-oriented optimizer modes

The manifest's `optimization` value is exactly `none`, `balanced`, `speed`, or `size`.
`balanced` is the default for production `build` and `run`; `check` performs no target code
generation. An explicit CLI override is allowed only when the effective value is recorded in build
evidence. Bounds and division checks are independent options and never implied by an optimizer
mode.

`none` is a 100% working, correct, legal, runnable baseline, not an invalid or deliberately poor
compiler path. It performs language-required compile-time work, typed lowering, deterministic
competent instruction selection, complete SFA and resource allocation, ABI and flag preservation,
branch-range repair, platform placement, assembly, and packaging. It does not enumerate optional
candidates or perform optional propagation, elimination, strength reduction, inlining, outlining,
specialization, loop transformation, or machine peepholes. Its direct lowering is still judged for
correctness and competent 6502 form, but exhaustive expert optimization belongs to the three
optimized modes. This provides a stable full pipeline and a supporting differential-execution path.

`balanced`, `speed`, and `size` run both the machine-independent whole-program optimizer and the
target-machine optimizer over the same finite qualified candidate frontier and to the same proved
fixed-point depth. Correctness, observable timing, memory fit, MMIO order, banking, placement,
stack, SFA, target legality, and ABI obligations are hard filters in every mode. After those
filters, `balanced` accepts only no-regression dominance, `speed` orders the comparable cycle vector
then the resource vector then target-loadable program/data bytes, and `size` orders those bytes
then the resource vector then the cycle vector. Static loop counts and declared timing contracts
are evidence; guessed execution frequencies, hotness annotations, PGO, weights, and a separate
`max` mode do not exist.

There are no public per-pass switches. A transformation without a complete proof is not applied;
the resulting missed expert optimization remains visible parity debt rather than a semantic risk.
Every mode preserves accurate debug provenance and reports optimizer identities plus ROM, RAM, ZP,
SFA, stack, data, byte, cycle, page, and layout effects. Independent semantic oracles remain
authoritative; optimized-versus-`none` differential execution is supporting evidence only. Expert
comparison uses the same goal and hard constraints as the selected mode.

### AR-024 — Base C64 production matrix and C64U successor

C64U is a required named successor, not an unspecified future possibility. The base C64 production
gate does not need to implement REU, turbo, Ultimate storage, or expanded SID topology, but it may
not close around assumptions that would force another compiler rewrite to add them.

Before that gate can close, the architecture must preserve target-neutral frontend and semantic IR;
symbolic address-space and placement identities; a distinction among directly CPU-addressable,
banked, and transfer-only storage; platform-owned wider physical addresses without widening core
Blend65 `word`; explicit transfer/DMA effects and costs; independent CPU/video/audio clock facts;
device and firmware-qualified profiles; multiple coordinated packaging artifacts; and emulator
plus real-hardware evidence levels. Assets and globals remain outside SFA regardless of their
address space. These are semantic seams and closeout checks, not permission to build an empty
plugin framework or speculative C64U packages before a real C64U consumer is implemented.

Base-C64 production requires these exact qualified identities:

- `c64-pal-prg-kernal-6581`;
- `c64-pal-prg-kernal-8580`;
- `c64-pal-prg-takeover-6581`;
- `c64-pal-prg-takeover-8580`;
- `c64-ntsc-prg-kernal-6581`;
- `c64-ntsc-prg-kernal-8580`;
- `c64-ntsc-prg-takeover-6581`; and
- `c64-ntsc-prg-takeover-8580`.

The original AR-013 baseline ID is refined to `c64-pal-prg-kernal-6581`, making its already-selected
SID model explicit. Qualification is factored by shared language/CPU semantics, video standard,
execution ownership, and SID model rather than multiplying every compiler test eightfold. Each
concrete identity still receives a bounded end-to-end build and VICE smoke test, with targeted
real-hardware QA for timing- and SID-sensitive claims.

C64U is the first target-family expansion after base C64. During requirements structuring it
receives an owned follow-on feature covering REU, turbo, storage, firmware, SID topology, packaging,
and target-specific verification. Base-C64 production is not blocked on those implementations, but
it is blocked on the architecture-readiness facts above and on assigning that successor ownership.

### AR-025 — Git-preserved, inventory-led clean v4 branch

Before RD-01 begins, a minimal Phase 0 records the exact final v3 source commit and creates the
sibling `/home/gevik/workdir/github/blend65.ri/v4` worktree on `feature/v4-rebuild` from that exact
commit. The current checkout remains the parked v3 evidence worktree. RD-01 performs the
Specification 4 and expert-authority transition in the prepared v4 worktree; RD-02 later consumes
and verifies the same worktree rather than creating it. If any branch, path, or worktree identity
conflicts, execution stops without modifying that state. Git history and the parked v3 worktree are
the complete archive; v4 does not duplicate them under `legacy/`, retain an old source subtree, or
promise compatibility with package names or behavior.

Before removal, a component-level salvage inventory classifies every candidate as port unchanged,
adapt, rewrite, discard, or reference-only and cites its v4 requirement and proof. A port requires
Specification 4.0 compatibility, a focused independent contract test, no dependency on discarded
v3 architecture, and demonstrably less risk/work than a clean implementation. Likely candidates
include isolated source-span/diagnostic rendering, JSONC discovery, ACME/VICE process adapters, and
raw file/path/hash/embed mechanics. Native asset codecs and current-producer fixtures are new v4
work. Lexer and Pratt-parser mechanics require Spec 4 audits. Semantic
analysis, IL, SFA implementation, lowering, code generation, optimization, compiler orchestration,
CLI behavior, and editor tooling default to redesign/rewrite.

V3 tests are evidence, not executable authority. New immutable specification tests derive from v4
requirements; old cases are recreated only when their behavior remains authoritative. The v4
branch removes `readiness`, `readiness-execution`, their gate/scoreboard workflow, unselected tests,
and false/unimplemented target packages. Minimal ACME/VICE runners and authoritative fixtures may
survive as ordinary test utilities. Directed tests run during work and complete relevant
qualification runs only at major boundaries.

After inventory, v4 creates only packages required by a real implemented C64 compiler path. It adds
no empty Atari, X16, C64U, debugger, readiness, or plugin packages. Exact package boundaries remain
an architecture-plan decision constrained by the approved responsibility seams, not by the twelve
v3 package names.

### AR-026 — Observational host compiler and editor responsiveness

Host-tool responsiveness is measured, recorded, and trended but is not a wall-clock acceptance
gate. Measurements separate cold/warm `blendc check`, compiler phases, ACME, complete `build`, LSP
diagnostics/completion/hover/definition/references/rename requests, and peak host memory. Every
record binds the real qualified example or project size, asset input sizes, compiler/configuration,
host CPU/RAM/OS/filesystem, Node, and ACME identities so comparisons remain honest.

No duration threshold fails a unit test, normal verification, shared CI job, milestone, or release.
Measurements run only when a performance-sensitive path changes, at a major compiler/editor
milestone, and at release qualification. Existing qualified examples are used as they grow; v4 does
not create a synthetic 10,000-line game or a parallel readiness product solely to satisfy this
observation.

AR-011's incremental-compilation deferral expires only when real projects exhibit a noticeable
developer-facing editor or build delay, profiling attributes a substantial part to re-analysis of
unchanged input, and smaller algorithmic or focused in-memory repairs cannot restore acceptable
responsiveness. Asset conversion, ACME, filesystem, or isolated phase costs are repaired at their
source rather than answered with an unrelated general cache. Generated-C64 speed, bytes, memory,
timing, and expert parity retain their separate mandatory qualification gates.

### AR-027 — M1 playable complete-pipeline vertical slice

The first independently useful milestone is a small interactive program for
`c64-pal-prg-kernal-6581`, built with `optimization: none`. A developer opens its real
`blend65.json` project in VS Code, receives shared-frontend lexical/syntax/semantic diagnostics,
checks and builds it, imports a qualified current SpritePad representation, launches the resulting
PRG through `blendc run`, interacts through joystick/fire, reaches visible game state, and exits
through the profile's normal return-to-BASIC contract. AR-037 later refined this product journey to
the bounded original-art Invaders-style microgame without changing the complete-pipeline decision.

M1 implements only the coherent language slice the program needs: modules/imports, `const`/`let`,
required scalar types and conversions, expressions and assignment, `if`/`while`/standard `for`,
ordinary functions and nested calls, basic structs/fixed arrays and correct ordinal promotion,
variable-address `PEEK`/`POKE`, `embed()`, and named joystick/VIC/screen/exit platform APIs. Typed
function values, nested arrays, compile-time functions, IRQ callbacks, audio, advanced loaders, and
optional optimizers remain later vertical slices. Their approved semantics constrain the
architecture, but M1 creates no fake implementation or empty package for them.

M1 must exercise project loading, source graph, lexer, parser, semantic analysis, typed semantic
IR, whole-program/SFA analysis, target-neutral lowering, C64/6502 lowering, instruction selection,
placement, ACME serialization, PRG packaging, VICE execution, and source/debug/resource evidence.
No stage may pass unresolved or untyped material through solely to make the demo work.

Qualification injects deterministic joystick/fire input in VICE and checks entity state, visible
state, asset bytes/placement, and normal exit. Each implemented semantic path has an independent
behavior oracle and an assembly/cost expectation; SpritePad bytes are placed once, correctly
aligned and VIC-visible without runtime copying; local generated code meets the expert floor; all
SFA/memory/ZP/stack/asset/cycle/debug reports are complete; LSP and CLI share the frontend; and one
relevant boundary qualification follows directed tests. M1 does not use the v3 readiness suite and
must pass an early C64U-readiness architecture review. It is a real microgame but is not
production-complete Blend65.

### AR-028 — Deterministic module-to-file discovery

AR-022 currently leaves a broken link in the project journey. Blend65 imports a qualified module
identity rather than a file path, filenames have no language meaning, and multiple `.blend` files
may merge into one module. Starting from one entry module therefore cannot locate the files that
declare its imports unless the project first creates a bounded module index.

The recommended correction is one required, project-contained source root. The compiler
recursively indexes only `.blend` files below that root in deterministic exact-spelling order after
representing separators as `/`, reads their module headers, and then analyzes only the entry
module's reachable import graph. This preserves the
language's module/file separation without restoring include/exclude globs or an explicit source-file
inventory. Profile-provided platform modules resolve outside this project source root. Path-based
imports were rejected because they would make filesystem layout part of language identity; an
explicit file list was rejected because it recreates the duplicate source inventory removed by
AR-022. Exact merged-module declaration collisions, host-preserved filename spelling,
symlink-containment, unreadable-file, and changing-input rules remain part of the project contract.

The user approved `sourceRoot` as a required manifest path resolved from the directory containing
`blend65.json`, never from the process working directory. It is one relative, canonical,
project-contained directory; absolute paths and escapes are rejected. `blendc check`, `build`, and
`run`, explicit `--project` use, upward manifest discovery, and the language server therefore see
the same source set regardless of the caller's current directory.

### AR-029 — Large-asset delivery and loader ownership

The resident PRG path proves asset import and placement but cannot represent a game whose complete
assets do not fit simultaneously in RAM or the initial load image. The accepted game-engineering
direction already requires loader windows, overlays, SID/IRQ continuity, and Integrator-style
composition to influence architecture. The product boundary to resolve was whether C64 production
itself must create a coordinated disk artifact and explicit load units, or whether that would remain
an external/later responsibility. Any accepted loader path must be opt-in game functionality rather
than a hidden compiler runtime and must expose transport, destination, liveness, scratch, timing,
interrupt/audio, publication, and restoration costs.

The user approved compiler-owned, opt-in disk delivery as part of C64 production. Resident PRG
builds and ordinary `embed()` remain valid and do not acquire loader code. A separately qualified
disk profile packages the startup PRG and explicit load units; it links only the selected
loader/decompressor implementation and never installs a universal runtime. Static analysis and
build evidence own destination/overlay liveness, banking, scratch, worst-case output, transfer
timing, IRQ/audio policy, publication, restoration, and complete artifact/residency costs. The
first M1 milestone remains resident and PRG-only.

### AR-030 — Target-dependent source selection

The project has exact PAL/NTSC, execution-ownership, and SID profiles and a mandatory C64U successor,
but it has not decided whether v4 adds conditional-compilation syntax. The smallest current model is
separate profile-specific entry modules/manifests over shared target-neutral modules, plus immutable
compile-time profile constants for ordinary value/timing choices. A dedicated conditional language
surface would reduce some entry wiring but would add grammar, name-resolution, diagnostics, LSP,
and conformance obligations before a non-C64 consumer demonstrates which distinctions are actually
needed.

The user approved the smaller model without separate manifests. `blend65.json` supplies one default
entry module and exact target profile; `blendc --entry` and `--target` may select another entry and
qualified profile for one invocation, and the effective values and input/artifact hashes are
recorded in build evidence. Shared target-neutral modules are imported normally. Profile-provided
modules expose immutable compile-time facts such as video standard and frame rate. A branch whose
condition is a profile constant is resolved and removed as mandatory compile-time evaluation even
under `optimization: none`, so it has no target bytes or cycles. Fundamentally different hardware
wiring uses separate reachable entry/platform modules within the same `sourceRoot`; target-specific
modules outside the selected reachable graph receive only the header indexing needed for module
discovery and are not semantically checked against the wrong profile.

V4 adds no textual preprocessor, `#if`, conditional declaration system, or build-variant framework.
The C64U follow-on must record whether its real implementation demonstrates substantial unavoidable
duplication. Only that evidence may reopen a dedicated conditional-compilation proposal.

### AR-031 — Explicit loadable-value contract

An ordinary embedded fixed array or struct is a resident value: source may index it, take its
address, and pass it according to normal aggregate rules. Giving the same type behavior to bytes
that exist only on disk would be unsound because generated code could read the destination before a
successful load.

The recommended source model is a narrow `loadable const` declaration. Its initializer is a
compile-time fixed scalar, array, struct, or explicitly composed asset value, but the declaration
denotes an immutable packaged load unit rather than CPU-readable storage. Source may use its
compile-time type/size/provenance and pass it only to a compatible selected-profile loader
operation; ordinary reads, indexing, address-of, mutation, and ordinary parameter passing are
errors. Loading targets any mutable, lifetime-valid, exactly typed addressable place for which the
compiler closes the complete interval, alignment, visibility, overlap, and publication proof. That
includes variables, fields, indexed elements, their compositions, and aggregate parameters when
caller-origin and alias facts close. The destination expression evaluates once. Constants,
temporaries, MMIO, expired storage, type mismatches, and unproved destinations are rejected. On
successful return, source reads the destination normally. A composite struct loadable is one
coordinated load unit, so maps, charset, colors, masks, and tables can travel together without a
second manifest inventory. The packager may store a compressed representation, but the declared
logical type and reported worst-case destination size remain exact. No staging copy, runtime
descriptor, heap, hidden copy, or persistent asset handle is introduced.

The user approved this model. `c64.loader.load(loadable, destination)` returns `boolean`: `true`
publishes the complete logical value only in the once-evaluated physical destination range; `false`
leaves only that captured range indeterminate after a possible partial transfer. Must-not-alias
candidates preserve their incoming state. The compiler correlates the call's boolean result with a
fresh captured range/provenance identity through branches, stored results, joins, loops, and aliases.
A later read is legal when its complete range is initialized on every reaching path; relying on the
newly loaded logical value requires must-alias proof with the successful capture. Each repeated call
uses a fresh identity, an overlapping later call kills prior facts for the overlap, and a covering
loop proves only the bytes it actually covers. These are sparse compiler flow facts, not a target
token, descriptor, validity byte, bitmap, or read check. The call is explicit and is the only runtime
transfer; a project with no reachable load call links no loader. A loadable declaration can group a
whole level or scene as a fixed struct, allowing one reusable fixed destination to hold mutually
exclusive maps, charsets, colors, collision data, music, masks, or generated tables.

### AR-032 — Profile-owned primary artifact

AR-022's fixed `<name>.prg` output is correct for the eight approved resident PRG profiles but
contradicts AR-029 when the startup program and load units form one deployable disk image. Publishing
a standalone bootstrap PRG beside the D64 as if both were complete primary products is misleading:
the PRG cannot satisfy its declared load operations without the packaged units.

The recommended correction makes each qualified profile own exactly one primary deployable
artifact. Existing `*-prg-*` profiles publish `<name>.prg`. The first disk profile is
`c64-pal-d64-kernal-6581`; it publishes `<name>.d64`, containing the boot PRG and every reachable
load unit under deterministic compiler-owned directory identities. `blendc run` for that profile
attaches the newly built D64 to VICE and starts its boot entry; it cannot run a standalone or stale
PRG. The primary artifact and common `.asm`, `.labels`, `.memory.json`, `.assets.json`,
`.costs.json`, `.debug.json`, and `.build.json` evidence form one immutable generation selected by
the atomic current-generation record. The build record additionally binds the disk directory,
contained file/load-unit ranges, compression/loader identities, and hashes. Internal bootstrap or
load-unit files may exist inside that generation but are not separately advertised as complete
deliverables.

Only `c64-pal-d64-kernal-6581` is required for the initial C64 production disk-delivery slice. Other
video/ownership/SID disk combinations require their own qualified identities when demanded; the
existing eight PRG profiles remain the base resident-production matrix.

The user approved this profile-owned artifact model. The D64 is the only published primary binary
for `c64-pal-d64-kernal-6581`; its bootstrap PRG and load-unit files remain contained components,
not separately advertised complete programs. `blendc run` mounts that exact newly built D64 and
starts its boot entry. All component identities, directory entries, ranges, compression/loader
identities, and hashes remain available through the atomic evidence set.

### AR-033 — Minimum vertical RD decomposition

The proposed structure uses ten requirement documents ordered by useful capability and production
dependency rather than one document per compiler pass. RD-03 owns M1 as a complete playable path;
RD-04 then completes the language and correct `optimization: none` compiler before optional
optimizer work begins. Platform, asset, loader, optimizer, and tooling documents extend real
working paths. Cross-cutting internal responsibilities remain acceptance contracts inside their
owning vertical capability instead of becoming empty packages or independent framework projects.

One RD per lexer/parser/analyzer/IL/SFA/codegen pass was rejected because it would recreate the
horizontal development failure the v4 direction is correcting. A few monolithic RDs were rejected
because language conformance, assets/loading, platform behavior, optimizer proof, and editor
tooling have distinct acceptance authorities and would become too large to review or qualify
independently.

The user approved the proposed ten-RD structure, dependency graph, delivery phases, glossary, and
integration map. The detailed structure is recorded in `_draft/discovery-notes.md` and becomes the
authoring boundary for Phase 3.

### AR-034 — Expert baseline version for Specification 4

RD-01 must publish one exact expert-skill version and content identity so every later audit can
bind to it. The existing baseline is `1.0.0` and its governing language identity is Specification
3. Replacing that authority with Specification 4 changes language semantics, qualification
oracles, and the decisions the skill gives to later compiler work.

The recommended version is `2.0.0`. This is a breaking authority replacement, not a compatible
knowledge correction, so a major bump communicates the real scope and prevents Spec-3-dependent
audits from treating the new baseline as interchangeable. `1.1.0` would understate that break;
`1.0.1` is reserved for compatible corrections and is not credible here. Only one version remains
active after atomic qualification and activation, regardless of the number chosen.

The user approved `2.0.0`. Specification 3 expert baseline `1.0.0` remains only in Git history
after the newly qualified Specification 4 baseline activates atomically.

### AR-035 — Normative target set in Specification 4

The current specification calls all five platform appendices draft and provisional, but its
feature axiom, introduction, platform-profile chapter, and Language Guard still require every
feature to compile and run across C64, C64U, X16, Atari 800XL, and Atari 7800. V4 explicitly
implements and qualifies only C64, and the recovery audit found the non-C64 implementation paths
to be false scaffolds or incompatible C64 reuse. Keeping all five normative would make
Specification 4 impossible to satisfy honestly.

**Recommended:** make only qualified C64 profile identities normative in the first Specification
4 release. Rewrite universality and emulator clauses to cover every qualified active target, plus
a mandatory portability review against recorded future-target constraints. Remove the C64U, X16,
Atari 800XL, and Atari 7800 appendices from the active normative specification; Git preserves
their drafts, while concise future considerations retain only non-support constraints. Unknown or
planned target IDs are rejected. A later target activates only after it gains pinned expert
evidence, a normative appendix, a real target-native CPU/machine/serializer/packager path, complete
core-language requalification, emulator evidence, necessary hardware QA, and atomic activation.
C64U remains the explicitly owned next feature; running a C64 artifact in compatibility mode is
not the same claim as supporting a `c64u` target profile.

**Independent verdict:** Choose the recommendation. Retaining provisional appendices inside the
active specification is theoretically workable, but readers and tools can still mistake them for
authority and the drafts add synchronization cost. Removing them risks losing cross-target design
pressure; the explicit future-target constraint register, target-neutral responsibility rules,
and C64U-readiness gates preserve that pressure without making a false support claim.

**Confidence:** High. The challenger would reconsider the in-tree non-normative option only if a
mechanically enforced normative-document manifest made those appendices impossible to cite as
authority; none exists.

The user approved the recommendation. Specification 4 therefore has one normative active target
family: its qualified C64 profiles. C64U remains the owned next feature, but C64 compatibility mode
does not constitute a `c64u` compiler target. X16 and Atari target authority will be created only by
their later evidence-qualified feature work.

### AR-036 — Minimum v4 build orchestration

- **Original goal:** Establish the smallest maintainable TypeScript 7/Yarn foundation that builds
  the public compiler library, CLI, shared frontend/LSP, and later VS Code client in dependency
  order with focused verification.
- **Extra system or support code:** Turborepo's second task graph/cache configuration and Vite
  configurations before any package has a demonstrated bundling requirement.
- **Why it may be needed:** A larger multi-package build can benefit from affected-package
  filtering, parallel non-TypeScript tasks, and reusable local or remote caching.
- **Evidence:** TypeScript project references already provide dependency-aware, incremental
  TypeScript compilation in the correct order, while Yarn workspaces provide installation,
  linking, workspace relationships, and script coordination. Turbo is broader rather than
  identical: it can coordinate TypeScript and non-TypeScript tasks with parallel execution,
  task-level caching, affected-package filtering, and remote caching. The first v4 foundation has
  not yet demonstrated a task graph or build cost that needs those capabilities. The current CLI
  and VS Code Vite configurations explicitly reserve future bundling, but no package build invokes
  them. CI has Yarn dependency caching but no demonstrated persistent or remote Turbo cache.
  Removing the v3 readiness subsystem also removes the main source of its oversized task graph.
- **Smallest solution that still works:** Use Yarn classic workspaces, stable TypeScript 7 project
  references and root `tsc -b --stopOnBuildErrors`, plus Vitest. Preserve package boundaries with
  a small direct import-graph test. Add a bundler only when the VS Code or another concrete
  packaging consumer needs one; reconsider a task runner only after measured build/test cost or
  several non-TypeScript tasks demonstrate the need.
- **Extra cost:** Another dependency and configuration graph, duplicated task ordering and cache
  invalidation concepts, additional CI behavior, and placeholder bundler files that must be
  maintained without producing a current artifact.
- **Independent verdict:** `Unnecessary for the initial foundation` — choose the direct
  Yarn/TypeScript/Vitest foundation. TypeScript project references cover compilation ordering, but
  not Turbo's broader orchestration features. Turbo has a credible later use after real task
  volume, affected-package workflows, or profiling establishes its value.
- **Direct user decision:** Retain the v3-style monorepo setup with Turbo, then explicitly confirm
  Yarn classic workspaces, Turborepo, stable TypeScript 7, Vitest, no ESLint or replacement linter,
  and Vite only when a concrete package needs bundling.

**Decision outcome:** The user chose the broader Turbo-enabled monorepo foundation. RD-02 includes
Turbo as the single cross-workspace task orchestrator from the start while TypeScript project
references continue to own TypeScript compilation dependencies. Vite remains excluded until a
real packaging consumer requires it. This approval does not authorize the twelve-package v3
topology, readiness workflows, duplicated task graphs, remote-cache infrastructure, or placeholder
bundler configurations.

**Strongest counterargument:** The initial foundation does not yet demonstrate enough task volume
to justify Turbo, so retaining it adds configuration and cache semantics before their benefit is
measured. The approved boundary contains that cost: Turbo owns only the real root task graph, no
remote-cache service or duplicate dependency graph is added, and unused Vite configuration remains
excluded.

**Confidence:** High that the approved boundary is internally coherent. Turbo's distinct
orchestration and caching capability is retained without treating it as equivalent to TypeScript
project references or Yarn workspace management.

### AR-037 — Bounded Invaders-style M1 and authentic SpritePad handoff

The user approved replacing the one-sprite M1 interaction with a deliberately small, original-art
Invaders-style game. A faithful recreation was rejected for M1 because its formation scale,
barriers, scoring, lives, enemy projectiles, audio, and rendering strategy would pull the broader
platform, workload-qualification, and asset work of RD-05 and RD-06 into the first compiler slice.

M1 instead uses exactly eight simultaneous hardware sprites: one player, six invaders, and one
slot shared by the active projectile or its short explosion. It requires no sprite multiplexer,
application IRQ handler, scrolling, loader, audio system, or optimizer. The game deliberately
exercises fixed aggregate state, a standard `for` loop, ordinary and nested calls, exact-width
arithmetic, source-level collision, multiple SpritePad records, joystick input, frame updates,
terminal win/loss state, restoration, and normal BASIC return. The art and project identity are
original and do not copy another game's distributed assets.

The user will purchase SpritePad C64 Pro 3.80 and later provide a producer-generated M1 template,
native `.spd` file, every M1-relevant export and setting, provenance, hashes, retention status, and
distinguishable expected decoded records. Distinct nonblank placeholder records make byte order,
offsets, colors, and record boundaries observable. Final art will be reduced to exact C64 sprite
grids and imported through the official producer before its output becomes the qualification
fixture. SpritePad remains an authoring/qualification producer; the compiler, Linux build, and CI
never invoke it. This evidence is not needed to author these requirements, but the exact
M1-consumed SPD v5 surface is a hard prerequisite before SpritePad-dependent RD-03 planning or decoder work. Missing
evidence pauses only that format-dependent boundary; it does not permit guessed parsing or reduced
scope.

**Direct user decision:** The user approved the bounded Invaders-style M1 and confirmed that the
SpritePad project may be supplied later, before the format-dependent work begins.

**Planning-order amendment, 2026-09-18:** The user answered "i approve" to the
explicit proposal to plan source reading, parsing and semantic analysis first,
leaving SpritePad integration for later. This permits only asset-independent
frontend planning before the handoff; it does not authorize guessed decoding,
remove the native-format gate, close RD-02 without Windows testing, or satisfy
the complete RD-03 milestone. See
[frontend planning decisions](../plans/rd-03-frontend-first/00-ambiguity-register.md).

### AR-038 — Compiler with game workloads, not a game engine

The user corrected a material scope error during RD-05 review: Blend65 is a 6502 programming
language and compiler whose strongest use case is game development; game development is not a
second product layer. Requirements that said Blend65 would provide reusable fixed-pool, collision,
state-dispatch, multiplexing, scrolling, or buffer systems could therefore authorize the wrong
product even when they also prohibited a hidden mandatory runtime.

The accepted boundary separates three responsibilities. The compiler owns a general programming
language for games, renderers, tools, and any other software the selected 6502 machine can support:
normal expressiveness, correct and expert-quality lowering, diagnostics, layout, optimization, and
evidence. The narrow C64 platform library owns general typed hardware access plus local timing,
ownership, delivery, and packaging contracts. The toolchain's only game-oriented convenience is
compile-time ingestion, validation, conversion, typing, and target integration of externally
authored sprites, charsets, maps, images, SID content, and similar assets. Those handlers may
produce typed data, metadata, symbols, placement constraints, and exact player-call information;
they do not own runtime behavior.

The application owns its game loop, entities and pools, collision policy, state model, renderer,
sprite scheduling algorithm, scrolling strategy, buffer lifecycle, audio tick placement, cue
policy, mixing/scheduling, and every other application algorithm. The compiler may recognize and
improve a user-authored pattern only when its semantics and cost are proved; recognition never
injects a gameplay subsystem or changes application policy.

Q-P13, Q-P16, the M1 microgame, and later scrolling, buffering, and audio slices remain valuable
because they prove that ordinary Blend65 can express real game workloads and that the generated
machine code meets the expert bar. They are test programs and evidence fixtures, not installed
modules, templates that define architecture, or public engine APIs. Compile-time asset composition
builds typed bytes, metadata, symbols, and placement/package facts; it does not create a runtime
scene graph, renderer, player scheduler, mixer, or game architecture.

The active expert `1.0.0` knowledge remains frozen until RD-01's already-approved `2.0.0`
transition. RD-01 must correct ambiguous phrases such as “game-system recommendation,” “engine
structures,” and fixed-pool or multiplexer APIs while retaining the underlying technique knowledge
and Q-P evidence. This is an explicit product-authority correction in the controlled versioned
transition, not a silent mid-journey skill edit.

**Direct user decision:** The user explicitly required the requirements to be corrected to the
maximum extent possible because treating Blend65 as a game system or engine would create a
different product. The user then clarified that Blend65 must be a great general compiler with which
developers can write games, renderers, and any other C64 software. Only asset-format ingestion and
conversion into Blend65's typed target domain is deliberately game-oriented; building the game or
engine remains the user's responsibility.

### AR-039 — Koala Color RAM source-byte preservation

The classic Koala payload contains 1,000 Color RAM bytes, but C64 Color RAM observes only the low
nibble. Existing external files may carry nonzero values in the unused high nibble. RD-06 cannot
claim exact format handling without deciding whether those source bits are accepted and preserved.

The recommended contract accepts and preserves each complete source byte in the selected typed
data and provenance. Hardware-facing metadata states that only `value & $0f` affects Color RAM.
The compiler does not reject a structurally exact file solely because an unused high bit is set,
and it does not silently normalize the imported bytes. This retains source fidelity, accepts wider
historic producer output, keeps hashes and deduplication honest, and lets user-authored code choose
explicit normalization if it wants it.

**Direct user decision:** The user approved the recommended preserve-and-accept contract.

### AR-040 — Exact initial native-asset baseline

During the expert-skill requirements work, the user explicitly approved direct support for the
current SpritePad and CharPad project formats, PSID music/player integration, Koala images, and raw
assets. The user chose the most recent pinned producer versions as the starting point rather than
spending the initial implementation on old application generations. The same work selected
GoatTracker 2.77 as the first exact music-plus-SFX adapter for RD-06 to qualify and kept other
players dependent on their own complete evidence. That ordering decision does not make an adapter
active before its hash-bound player/export evidence and complete ABI contract pass the RD-06 gate;
the initial Specification 4 profiles therefore keep `audio_player_contracts` empty rather than
guessing those facts.

The v4 baseline therefore contains explicit built-in C64 handlers, not a general plugin framework:

- SpritePad C64 Pro 3.80 with observable SPD v5 identity;
- CharPad C64 Pro 3.88 with observable CTM v9 identity;
- the exact self-contained directly callable PSID v1–v4 subset;
- classic 10,003-byte Koala files; and
- raw byte inclusion only for extensions without a registered handler.

Producer release names are provenance, not bytes encoded inside SPD/CTM files. Before RD-06 plans a
complete SpritePad 3.80 or CharPad 3.88 handler, it must hold a complete current-producer fixture
matrix for that handler's accepted surface, exact expected decoded values, provenance, hashes,
retention status, and redistribution status. Each handler remains unqualified until that evidence
proves its complete accepted surface. Missing evidence pauses only that format; it never licenses
guessed parsing, a quiet scope reduction, or a public handler/plugin framework. A different format
generation or player family is a later explicit qualification, not a compatibility guess.

**Direct user decision:** This records the user's prior explicit acceptance of the individual
formats, latest-pinned-version policy, and GoatTracker-first adapter choice.

### AR-041 — Koala background-byte preservation

AR-039 explicitly resolved the 1,000 Color RAM bytes, but a classic Koala file also ends with one
background-color byte whose VIC-II meaning is limited to the low nibble. Extending AR-039 to that
separate component without confirmation would silently make a new format-policy decision.

The recommended contract is consistent across both color-bearing components: accept and preserve
the exact source byte and its hash/provenance, document `value & $0f` as the hardware meaning, and
never reject or silently normalize an otherwise exact Koala file solely because the unused high
nibble is nonzero.

**Direct user decision:** The user approved the consistent preserve-and-accept contract.

### AR-042 — First qualified disk loader and compression baseline

AR-029 approved compiler-owned opt-in disk delivery, and AR-032 fixed the first D64 profile and
primary artifact. Neither decision chose the concrete transport implementation. That choice changes
linked code, disk layout, loading time, scratch/ZP/stack use, interrupt and audio behavior, failure
handling, real-drive evidence, and whether a new external tool or runtime subsystem enters v4.

The recommended first slice is one built-in sequential loader using the selected C64 KERNAL load
contract and uncompressed load units placed directly at their declared destinations. It is linked
only when a reachable `c64.loader.load(...)` call exists. The design records an internal strategy
identity plus complete costs so a later qualified fastloader or compressor can replace the
transport without changing `loadable const`, but it exposes no speculative public loader-plugin
system. This is the smallest implementation that proves the complete D64/load/publication path;
fastloader and compression support should follow only with a measured workload, exact external
identity, complete resource contract, VICE proof, and targeted real-drive QA.

**Direct user decision:** The user approved the KERNAL-first, uncompressed implementation order.

### AR-043 — KERNAL loading with IRQ, NMI, and audio activity

The stock KERNAL loader requires its own machine-service environment, while a game may also have a
raster callback, music tick, or NMI route running. Allowing those paths to continue without an exact
contract can expose a partly loaded destination, collide with KERNAL work areas or loader code, and
produce unbounded raster/audio timing. Silently stopping and later reconstructing arbitrary
application state would add hidden behavior and requires a general registry or player-specific
resume semantics that the product has explicitly rejected.

The recommended first-profile rule is explicit quiescence. `c64.loader.load(...)` remains a
mainline operation and preserves the stock KERNAL service route it needs, but user-installed
callbacks and player ticks must be explicitly stopped or restored before the call. Every other
asynchronous observer or writer declared by the selected profile must likewise be proved absent or
quiescent; unknown/external activity and unqualified DMA are rejected. C64U DMA remains outside the
base-C64 contract. The compiler reuses finite recognized ownership state; if it cannot prove the
required routes and agents inactive at the call, it emits a targeted compile-time diagnostic. The
loader does not silently pause, resume, or promise uninterrupted music/raster timing. A future
qualified fastloader may add a distinct, measured continuity contract without changing
`loadable const`.

**Direct user decision:** The user approved explicit application-controlled quiescence as the best
first-loader contract.

### AR-044 — Runtime integrity boundary of stock KERNAL `LOAD`

The approved KERNAL path can perform a relocating load at the destination selected by the program,
but its API has no maximum-length argument. The compiler can prove the exact file bytes and length
inside the D64 it creates, and the wrapper can inspect the KERNAL carry/error result plus the
returned end address. It cannot stop a different but readable longer file from overwriting beyond
the destination before that postcondition is checked. A staging buffer would duplicate scarce RAM
and add a copy; a truly bounded/checksummed transport would be a different custom loader rather than
the approved minimal KERNAL implementation.

The recommended contract treats the atomic compiler-produced D64 as the trusted deployable unit
and records the exception as `HLE-010` in Specification 4 and expert baseline `2.0.0`.
The wrapper returns `false` on KERNAL failure or an unexpected final address and never publishes a
successful logical value in those cases, but the documentation states that a replaced or corrupted
yet readable longer component is outside the baseline containment guarantee. No checksum, staging
copy, or custom transport is silently added. A later qualified loader may provide stronger media
integrity with its exact code, memory, timing, and drive compatibility costs.

**Direct user decision:** The user approved the trusted compiler-produced D64 boundary and its
explicit containment limitation.

### AR-045 — Deterministic optimizer goal selection

The four optimizer modes are approved, but a complete target cost model does not by itself decide
whether a larger/faster or smaller/slower candidate wins. A hidden scalar weight would encode an
imaginary workload when no execution frequencies exist. User-configurable weights or hotness would
turn compiler competence into a tuning language and multiply qualification states.

The recommended policy filters correctness, observable timing, MMIO/effect order, ABI, target
legality, user placement/banking, memory fit, and final SFA closure as hard constraints. It compares
the complete cost at the smallest owning scope: local only when helper/table inclusion, ZP/SFA
interference, branch distance, layout, padding, banking, loading, or shared setup cannot change the
result; otherwise after the relevant function or whole-program facts close.

The cost model has three domains. `B` is every compiler-generated target-loadable program/data byte,
including code, initialized data, embedded payloads, helpers, tables, loader code, required padding,
and branch repair. For a D64 it counts logical compiler-generated payloads only; fixed image
structure, BAM/directory/link/tail/fill overhead, host evidence, and archive compression never enter
optimizer selection. `R` is the selected profile's stable resource vector: zero-page peak,
resident RAM/SFA peak, hardware-stack peak, compiler/helper scratch, then additional profile-owned
capacities. `T` is the frequency-free ordered vector of comparable semantic-path cycle bounds,
including call, helper, page, bank, load, and setup effects. `balanced` applies only strict
no-regression Pareto wins. `speed` orders `T`, then `R`, then `B`; `size` orders `B`, then `R`, then
`T`. Static loop counts and timing contracts inform `T`; guessed workload frequencies do not. The
expert parity floor applies to candidate creation and each optimized mode's equivalent-work
objective; the selector cannot excuse a poor baseline.

**Independent challenge:** Converged on the recommendation and strengthened it from local
byte/cycle comparison to complete closed-program cost with deferred adjudication when downstream
costs can still change. Strongest counterargument: conservative `balanced` deliberately declines a
real `+2 bytes / -40 cycles` win, but `speed` and `size` express those honest preferences without
inventing knowledge in the default mode.

Capacity and legality remain hard constraints, so the cost orders never license a candidate that
does not fit. Neither D64 size nor host filesystem or evidence-file size is a proxy for target
program size.

**Direct user decision:** The user approved the complete-cost Pareto/lexicographic policy.

### AR-046 — Optimization search completion and peephole depth

The approved mode-selection policy says how to choose among closed candidates, but it does not yet
say when candidate discovery and repeated optimization are complete. A fixed pass count or greedy
first improvement can miss an already-known expert form merely because of pass order. At the other
extreme, searching every equivalent 6502 program is not a bounded compiler obligation and cannot
support an honest general optimality claim.

The recommended policy gives all three optimized modes the same optimization depth; only AR-045's
cost ordering differs. At each smallest complete owning scope, start from the correct `none`
baseline and enumerate every applicable candidate in the compiler version's finite,
evidence-qualified expert rule inventory. Retain combinations whose helper, reachability, SFA/ZP,
layout, branch, loader, or packaging interaction can change the final result. Do not stop at the
first improvement or after a configured number of rounds. Prune only candidates proved infeasible
or proved unable to win by closed costs or admissible dominance bounds; retain open and
incomparable alternatives until their decisive scope closes.

This frontier and its search-completion obligations apply only to `balanced`, `speed`, and `size`.
`none` supplies the correct deterministic starting program and performs no optional candidate
enumeration, fixed-point optimization, or peephole search.

Repeat affected fact propagation, transformation, reachability, helper/table selection, resource
binding, SFA closure, layout, branch repair, and packaging feedback until facts, candidates, costs,
feasibility, and resources reach a proved deterministic fixed point. Every repeated group needs a
finite state space, finite lattice, or monotonic well-founded measure. An iteration cap may detect
and diagnose nonconvergence but cannot certify success; nonconvergence fails atomically.

Every optimized mode includes structured contextual peephole cleanup. It operates on symbolic
machine instructions only after required flag, register, liveness, effect, alias, and layout facts
exist. It includes the unchanged baseline and every applicable qualified substitution and chooses
by cost rather than greedy first match. It cannot reconstruct erased semantic facts, rewrite ACME
text, change MMIO or bus behavior, or invent storage after SFA closure.

Exact enumeration or superoptimization is permitted only for explicitly small finite regions with
fixed CPU legality, live-in/live-out state, effects, memory and interrupt assumptions, a sequence
bound, complete costs, and an independent decidable equivalence oracle. The honest result is
**frontier-optimal**: the best proven candidate in the active compiler's complete qualified finite
frontier after whole-program closure. A newly discovered expert candidate that wins is a parity
defect that reopens the frontier; it does not prove that the previous compiler had searched every
possible program.

The frontier deliberately combines two knowledge families. Modern target-neutral and whole-program
techniques include exact constant/range/known-bit propagation, CFG simplification, unreachable and
dead-work removal, alias/effect-qualified value reuse and memory forwarding, interprocedural effect
and reachability analysis, finite-target devirtualization, specialization, inlining/outlining,
tail calls, aggregate scalarization, copy elision, direct construction, canonical induction,
loop-invariant motion, address/arithmetic strength reduction, measured unrolling, and
liveness/interference analysis. These feed rather than replace NMOS 6510 instruction selection,
register/flag/carry reuse, addressing-mode selection, ZP allocation, helper/table/inline choices,
branch and page layout, banking, SFA re-closure, and structured peepholes.

Technique provenance never grants admission. Modern algorithms must use Blend65 width, signedness,
wrap, evaluation-order, short-circuit, volatile/MMIO, alias, lifetime, interrupt-domain, placement,
and storage semantics. They may not assume undefined signed overflow, freely reorderable memory,
abundant registers, cheap spills, stack-framed locals, flat memory, caches, uniform instruction
cost, or instruction count as a performance proxy. A choice that later 6510 flags/registers,
SFA/ZP, helpers/tables, layout, banking, loading, or packaging can reverse remains open until those
costs close.

RD-01 must freeze this combined knowledge before expert baseline `2.0.0` activates. The skill
records a deep sourced inventory with applicability, semantic preconditions, 6502/C64 interaction,
counterexample, costs, and qualification expectations. It imports algorithms and proof ideas, not
another compiler's implementation or architecture. It does not create a broad SSA/pass framework,
LLVM dependency, e-graph, registry, rule DSL, or complete textbook suite in anticipation of future
use. A representation or shared mechanism is added only when a concrete admitted transformation
needs facts the existing smallest structure cannot safely carry and it passes the anti-
overengineering gate. RD-08 implements and qualifies the admitted transformations; the frozen
skill remains authority rather than being edited opportunistically during implementation.

**Independent challenge:** Converged on the finite combined-frontier policy. It strengthened the
proposal by requiring identical search depth in every optimized mode, cost-selected rather than
greedy peepholes, explicit frontier-optimal terminology, and admission by proof and target fit
rather than technique origin. Strongest counterargument: combining semantic-to-layout feedback can
make the frontier and implementation substantially harder. The bounded answer is current consumers,
complete rule packets, the smallest required representations, proved decomposition, canonical
deduplication, dominance bounds, and small exact domains—not a prebuilt general framework or silent
heuristic cutoff.

**Direct user decision:** The user approved the combined modern-plus-6502 frontier, expert `2.0.0`
knowledge freeze, proved fixed-point completion, structured cost-selected peepholes, and bounded exact
search policy.

### AR-047 — VS Code run command identity and unsaved inputs

AR-021 names three explicit VS Code commands: `Build`, `Run in VICE`, and `Build and Run`.
AR-022 separately requires every `run` invocation to build successfully and to launch only the
fresh artifact produced by that same invocation. Those decisions make `Run in VICE` and
`Build and Run` behaviorally identical unless one is given a second, weaker artifact-currentness
contract. RD-09 must not publish duplicate commands or silently weaken the fresh-artifact rule.

**Recommended — one fresh-run path:** expose `Blend65: Build` and `Blend65: Run in VICE`. Remove
the redundant `Build and Run` command. Before either command, save the dirty open project inputs
that the operation will consume. If the user declines a save or any save fails, abort before
building or launching and report the affected input. `Run in VICE` performs the complete fresh
build required by AR-022 and launches only that invocation's profile-owned primary artifact. Live
LSP analysis remains independent and continues to use versioned unsaved editor snapshots.

The other viable option is to retain `Run in VICE` as a no-build rerun command and keep
`Build and Run` as the fresh path. The no-build command would have to prove that the existing
artifact's recorded source, asset, manifest, profile, option, and tool identities still match the
current saved project and reject dirty relevant editor inputs. This is safe in principle, but it
creates a second launch contract, artifact-currentness logic, and more user-visible failure states
before measured build latency demonstrates a need.

**Second-guessing:** The strongest argument for a distinct no-build rerun is faster repetition of
an unchanged binary. The current product has no measured build delay that justifies the extra
surface, while one-command fresh run is already approved and deterministic. If milestone timing
later proves that rebuilding unchanged inputs causes a material delay, a separately approved,
hash-proven rerun command can be added without weakening the normal fresh-run path.

Cancellation has one deterministic publication boundary. Before the current-generation record is
committed, cancellation publishes nothing. After that commit, the complete valid build remains
published and cancellation stops only VICE or monitoring; the command reports build success and
run cancellation. Cancellation can never attempt to undo a published generation.

**Confidence:** High. **Hardening:** Standard in-context challenge; no independent challenger was
required for this bounded editor-command decision.

**Direct user decision:** The user approved the recommended one-fresh-run-path contract.

### AR-048 — Production host support matrix

RD-02 and RD-09 require deterministic behavior on every supported host and path model, while RD-10
must make the production claim. The requirements do not yet identify those hosts. Node, VS Code,
VICE, and ACME availability alone cannot qualify Blend65's complete workflow: the compiler, CLI,
LSP, packaged VS Code extension, ACME invocation, fresh VICE launch, cancellation, path handling,
and atomic artifact publication must all work together on every production host.

**Recommended — two concrete production hosts:** define the initial host contract as follows.

| Support class | Host identities | Contract |
|---|---|---|
| Production | `linux/x64`, `win32/x64`, both on Node 22 | Qualify the complete advertised workflow on clean hosts, including compiler library, CLI `check`/`build`/`run`, LSP, packaged VS Code extension, ACME, VICE, cancellation/process cleanup, paths, and artifacts. |
| Best-effort | `darwin/x64`, `darwin/arm64`, `linux/arm64`, and other Node 22 hosts | Do not deliberately block them, but make no release or defect-response promise until each receives the same qualification. |
| Unsupported | Hosts outside the declared Node 22 range and 32-bit or unknown architectures | Diagnose the unsupported host where practical; make no compatibility claim. |

Linux x64 matches the present development and CI environment. Windows x64 is a real product path
because the C64 asset-authoring ecosystem includes Windows-only or Windows-first tools, and RD-02
already requires Windows drive, UNC, separator, and case-insensitive path behavior. Windows also
exercises process-tree cancellation and executable discovery that Linux cannot prove. Production
qualification therefore needs a real clean Windows host or CI runner; a Linux simulation of Windows
paths is supporting evidence only.

Machine-local tool selection remains deliberately small. The compiler library never discovers or
requires tools. The CLI reads an optional machine-local `tools.jsonc`; a present file requires
integer `schemaVersion: 1` and optional absolute string `acmePath` and `x64scPath` keys, with
duplicate, unknown, malformed, or unsupported values diagnosed. A valid explicit path is used as
written; an invalid explicit path fails without fallback. An absent file or omitted key falls back
to the process's ordinary `PATH`, including relative or project-contained entries already trusted
by that host environment. Project manifests, source, and assets cannot supply commands or paths.
`check` and the language server do not load this file; `build` needs ACME only when producing a
binary, and `run` additionally needs VICE. Processes are spawned directly with argument arrays,
never through a shell. Paths and versions are normal build evidence; executable hashes are
qualification provenance, not a runtime trust system.

The PATH algorithm is exact. Split the inherited `PATH` using Node's host `path.delimiter`, skip
empty entries, resolve relative entries against the operation working directory, and inspect entries
in order. Linux queries only the literal filenames `acme` and `x64sc`; Windows queries only
`acme.exe` and `x64sc.exe`. Canonicalize each candidate and require its target to be an ordinary
regular file; Linux also requires executable permission, while Windows requires successful direct
`.exe` process creation. The first qualifying file is authoritative. Blend65 does not expand
`PATHEXT`, invoke `where.exe`, consult Windows App Paths/the registry or fixed installation
directories, try extensionless Windows aliases, or invoke a shell. A configured absolute path may
have any filename, but it must pass the same canonical-file, direct-execution, and version-identity
checks. A wrong version or failed probe on the configured path or first PATH match is a diagnostic,
not permission to search for a later binary.

The version probes are direct bounded child-process invocations with empty project-controlled
arguments. ACME receives exactly `--version`; successful normalized stdout/stderr must contain a
line beginning `This is ACME, release 0.97` with a version-token boundary. VICE receives exactly
`-version`; successful normalized output must contain one line matching
`x64sc(?:\.exe)? \(VICE 3\.10(?:\.0)?(?: SVN r[0-9]+)?\)`. Either probe requires exit status zero.
CRLF versus LF and the selected output stream do not change identity. The complete matched line,
canonical path, parsed portable version, and qualification-only executable hash are recorded under
their existing evidence ownership.

The viable smaller option is Linux x64 production only. It reduces release work but leaves a known
asset-authoring host and its distinct path/process semantics outside the supported workflow. The
viable broader option is Linux, Windows, and macOS across x64 and ARM64. Node, VS Code, and VICE
reach those systems, but that does not prove the Blend65/ACME/VICE integration, and no current
Blend65 consumer justifies multiplying the initial release matrix.

**Second-guessing:** Windows process-tree cleanup, binary discovery, and actual ACME/VICE 3.10
distribution identities may require focused host code. The bounded answer is exactly two explicit
host paths behind the process/filesystem seams already required by real consumers, plus clean-host
acceptance. Do not build a generalized host-adapter or plugin framework. If the exact pinned Windows
toolchain cannot be installed or controlled reliably during implementation, reopen this decision
rather than silently weakening the production claim.

**Evidence limitation:** the current repository CI is Ubuntu-only, and v3 process-control behavior
is audit evidence rather than v4 authority. The official ACME 0.97 Windows distribution supplies
`acme.exe`; the official VICE interface names `x64sc`, whose Windows distribution supplies
`x64sc.exe`; ACME documents `--version`, and VICE documents `-version`. Exact install locations are
deliberately irrelevant because only configuration and PATH are supported. Monitor behavior and
process cleanup still require the normal clean-Windows production qualification; official support
statements establish the executable contract, not a passing Blend65 result.

**Independent challenge:** The challenger changed the initial broad-platform instinct to the bounded
Linux x64 plus Windows x64 matrix. Its strongest counterargument was that Windows integration could
distract from compiler delivery. The recommended boundary contains that risk without pretending
Linux proves the Windows workflow and without creating a host framework.

**Confidence:** High. **Hardening:** Independent challenger completed; the recommendation changed in
response to the challenge.

**Tool discovery refinement:** `blend65.json` remains portable and cannot contain executable paths.
CLI and VS Code share one optional machine-local JSONC file containing only `schemaVersion`,
`acmePath`, and `x64scPath`. Its production locations are
`${XDG_CONFIG_HOME:-$HOME/.config}/blend65/tools.jsonc` on Linux and
`%APPDATA%\blend65\tools.jsonc` on Windows. A configured absolute path wins and must resolve to a
regular executable with the pinned compatible identity; if it is invalid, the operation fails
rather than silently choosing another binary. A present file requires integer `schemaVersion: 1`;
its only optional path keys are absolute strings, and missing/unsupported versions, unknown or
duplicate keys, and wrong types are diagnostics. For an omitted key or absent file, discovery uses
only the process's normal `PATH` order. PATH is the host's execution authority; Blend65 adds no
fixed install-location list or path-origin rejection. The selected path and version are normal
build evidence, while an executable hash is qualification provenance rather than a trust layer.
Discovery never downloads, installs, modifies, or executes project-provided commands, arguments, or
paths. `check` and ordinary LSP analysis do not load or validate this file. Assembly emission needs
no tool; a binary `build` requires ACME and `run` additionally requires `x64sc`, with actionable
diagnostics only when the requested operation needs the missing capability. Processes use direct
argument arrays and never a shell. Linux PATH discovery queries `acme` and `x64sc`; Windows queries
`acme.exe` and `x64sc.exe`. Ordered scanning ignores `PATHEXT`, registry/App Paths, fixed install
locations, and extensionless Windows aliases. ACME identity is probed with exactly `--version` and
VICE identity with exactly `-version`; the first qualifying PATH file is authoritative and an
incompatible identity fails without searching later entries.

**Direct user decision:** The user selected Linux and Windows first, kept macOS outside the initial
production claim, and required automatic ACME/VICE discovery with a machine-local configuration
fallback or override. The bounded contract above keeps tool paths outside portable projects.

## Gate Notes

The systematic 12-category scan and the end-to-end journey/edge-case composition re-scan have run.
The latter found AR-028 through AR-030; resolving AR-029 exposed the narrower source-contract
decision AR-031, and the final consistency scan exposed AR-032's PRG/D64 artifact contradiction.
AR-001 through AR-044 are resolved, and the user approved RD-07. The user selected AR-042's
KERNAL-first, uncompressed loader baseline and AR-043's explicit-quiescence rule. Continuing the
RD-07 boundary scan exposed AR-044 because stock KERNAL `LOAD` cannot enforce a destination length
before transfer; the user approved the trusted-D64 boundary and explicit limitation. The gate
passes again. RD-06 authoring had exposed AR-041's equivalent
policy for the distinct Koala background byte; the user approved the same exact-byte preservation
rule. Earlier RD-06 work exposed AR-039's Koala Color RAM source-byte policy;
the user approved exact byte preservation with separate low-nibble hardware meaning, so the gate
passes again. Before that discovery, the user confirmed the consolidated scope and explicitly
approved AR-033's Phase 2 decomposition. The final 12-category, journey, edge-case, dependency,
integration, terminology, authority, deferral, and complexity-evidence review found no unresolved
material choice. AR-024's already-decided C64U ownership timing was retained, and the proposed
RD-10 wording was corrected to hand off to the already-owned successor rather than create it late.
The Phase 2B gate passed. Phase 3 authoring surfaced and resolved AR-034 and AR-035 before RD-01;
RD-01 was then approved and committed. RD-02 authoring surfaced AR-036 before the document was
written. RD-03 authoring surfaced AR-037's product and producer-fixture boundary; the user resolved
both, and the gate passes again. RD-05 review then exposed and resolved AR-038's compiler-versus-
engine product boundary; the gate passes with the corrected scope.
RD-08 authoring then exposed AR-045 because the approved mode names and broad priorities did not
define how to resolve non-dominating complete-cost candidates. The user approved the complete-cost
Pareto/lexicographic policy. RD-08 review then exposed AR-046 because the selected costs did not
define which modern and 6502-specific techniques belong in the frontier or how deeply candidate
discovery, repetition, and peephole optimization must run. The user approved the combined finite
frontier, expert `2.0.0` knowledge freeze, and proved-closure policy, so the gate passes with all 46
items resolved. RD-09 authoring then exposed AR-047: its approved command list contained two names
for the same fresh-build-and-run behavior, and unsaved build-input handling was unspecified. The
user approved the single fresh-run command and save-or-abort input contract, so the gate passes
again with all 47 items resolved.
RD-10 authoring then exposed AR-048: the approved requirements require all supported host/path
models to work but did not define the production host matrix. The user selected Node 22 on Linux
x64 and Windows x64 first, best-effort macOS/other Node 22 hosts, and deterministic machine-local
tool configuration plus automatic discovery. The gate passes again with all 48 items resolved.

RD-01 planning later exposed disproportionate authority-verification machinery: 108 tasks, passive
Markdown test artifacts, per-file self-referential identity stamps, a complete blind 107-case
rerun, and repeated administrative batching. After a dedicated complexity reassessment and an
independent challenge, the user authorized AR-049's direct impact-based replacement. The reset
then isolated AR-050 as the sole remaining product decision: exact observable integer trigonometry.

### AR-050 — Exact integer trigonometry

For `k = 8` or `16`, let `N = 2^k`, `A = 2^(k-1)-1`, and let unsigned phase `p` denote exactly
`p/N` turns. The recommended observable rule is:

- `sin_k(p) = roundNearestAwayFromZero(A × sin(2πp/N))`;
- `cos_k(p) = sin_k((p + N/4) mod N)`.

Representative cardinal and diagonal results are `sin8(0)=0`, `cos8(0)=127`,
`sin8(32)=90`, `sin8(64)=127`, `sin8(128)=0`, `sin8(192)=-127`,
`sin16(8192)=23170`, `sin16(16384)=32767`, `sin16(32768)=0`, and
`sin16(49152)=-32767`. Independent high-precision generation reproduced these canonical sine
streams:

- `sin8`, phases `0..255`, one two's-complement byte per result:
  `sha256:fec3247a063767c499a18d6efdb1e5f86f96f859e2e98a859d621e93af013259`;
- `sin16`, phases `0..65535`, little-endian two's-complement words:
  `sha256:e0313f89310605acaa740fa67cf9fb157e363c9bd4af10fea66d8846735c5a50`.

Scaling to the signed minimum was rejected because it breaks exact half-turn negation and makes the
negative extreme overflow when negated. Truncation was rejected because it biases magnitudes.
Normative full tables were rejected because the mathematical rule and fingerprints are smaller and
do not prescribe the implementation.

The user accepted this rule on 2026-09-13. The requirements Zero-Ambiguity Gate passes with all 50
items resolved.
