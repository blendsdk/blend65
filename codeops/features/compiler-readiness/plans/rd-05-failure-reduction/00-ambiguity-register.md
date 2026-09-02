# Ambiguity Register: RD-05 Failure Reduction

> **Status**: ✅ GATE PASSED — all 92 items resolved; 78 added during execution
> **Last Updated**: 2026-09-02 03:02
> **Planning Target**: compiler-readiness/RD-05
> **Context Artifacts**: RD-05 and its passing preflight report; RD-02/RD-04 requirements and plans;
> current `@blend65/readiness` and `@blend65/readiness-execution` source, tests, manifests, and
> project policy
> **Modification Set**: this new RD-05 plan folder and the existing compiler-readiness feature
> roadmap; requirements, source, tests, `spec/`, and portfolio roadmap are read-only during planning
> **Mode**: strict scope · auto-design
> **Root Invocation ID**: `make-plan-rd05-20260826-0856`
> **Auto-Design Policy**: 1

| # | Category | Ambiguity / Gap | Options Presented | Decision | Status |
|---|---|---|---|---|---|
| AR-P1 | Technical unknowns | Which package owns each RD-05 responsibility without reversing package dependencies? | Existing two-package split; new package; execution monolith | Existing two-package split | ✅ Resolved |
| AR-P2 | Data & state | How are predicate, promotion, envelope, policy, and disposition values split into closed versioned modules? | Cohesive per-domain modules; one aggregate schema; extend RD-04 contracts | Cohesive `failure-*` domain modules; leave RD-04 contracts unchanged | ✅ Resolved |
| AR-P3 | Integration points | How does raw malformed source enter replay and diagnostic execution without weakening typed-case authority? | Separate opaque malformed authority arm; widen typed cases; unauthenticated raw source | Separate opaque `MalformedDiagnosticCaseV1` and `MalformedReplayEnvelopeV1` arm | ✅ Resolved |
| AR-P4 | Behavioral gaps | Which deterministic algorithm and file seam implement catalog-wide one-minimal reduction? | Ordered restart-to-fixed-point reducer; worklist reducer; global search | Ordered first-preserving edit with restart and final complete catalog pass | ✅ Resolved |
| AR-P5 | Integration points | How does a reduced candidate traverse the original RD-04 route contract with a new identity? | Dedicated candidate request arm; mutate/reuse case identity; direct compiler call | Dedicated authenticated candidate request arm through published handlers | ✅ Resolved |
| AR-P6 | Security & compliance | Where do immutable cores/events/activations publish, and which secure filesystem boundary owns writes? | Execution-owned secure publisher using generalized primitives; readiness-owned Node writer; mutable merged record | Readiness schemas/encodings plus execution-owned generalized secure publisher | ✅ Resolved |
| AR-P7 | Behavioral gaps | How are fresh confirmation and stateful-sequence reproduction scheduled? | Dedicated bounded fresh-worker coordinator; reuse campaign pool; always persist source alone | Fresh worker per standalone confirmation and per complete sequence attempt; ordered cases share only their attempt worker | ✅ Resolved |
| AR-P8 | Integration points | How are inactive candidates activated into immutable specification tests while commits stay green? | Repository activation manifest plus implementation-blind spec runner; generated test files; expected-failure tests | Fail-closed repository activation manifests consumed by one implementation-blind spec runner | ✅ Resolved |
| AR-P9 | Integration points | How does RD-05 consume RD-04 results without changing the selected RD-04 authority-report format? | Join a genuine report to live authorities/campaign in a new orchestrator; extend report wire format; scrape report-only evidence | Join genuine live authority and immediately materialize a separate complete failure envelope | ✅ Resolved |
| AR-P10 | Non-functional gaps | What coverage and verification thresholds govern the new security/identity core? | Exact verify plus ≥90% branch coverage for new cores; exact verify only; whole-package threshold increase | Exact verify plus checked per-file ≥90% branch coverage for every RD-05-owned core | ✅ Resolved |
| AR-P11 | Naming & terminology | What stable file/API names and plan component boundaries will execution use? | Five focused components with `failure-*`/`reduction-*` names; fewer large modules; many micro-modules | Five component specifications and focused kebab-case modules below 500 lines where practical | ✅ Resolved |
| AR-P12 | Technical unknowns | What command is authoritative for every plan verification checkpoint? | Exact AGENTS.md verify command; package-only checks; CI workflow approximation | Exact AGENTS.md install/build/typecheck/lint/test command | ✅ Resolved |
| AR-P13 | Integration points | How does RD-05 handle invalidation of the content-bound selected RD-04 execution-handler publication when route bytes change? | Extend then regenerate/review/rerun/reselect; bypass published authority; leave selected authority stale | Extend genuine handlers, then regenerate, run real acceptance, independently review, prepare, and atomically reselect | ✅ Resolved |
| AR-P14 | Data & state | How can an immutable activation record name a green verification commit when it is itself introduced by a commit? | Reference an already-green fix commit from a later activation commit; self-hash placeholder; mutable post-commit rewrite | Two-checkpoint activation referencing an already-green ancestor commit | ✅ Resolved |
| AR-P15 | Runtime — API surface | Which exact Phase 1 identity and campaign-budget operations let immutable specifications exercise the approved contracts without inventing implementation details? | Closed validating constructors plus free operations over opaque state; method-bearing authority; generic counter-by-name mutation | Closed identity constructors and a closed operation union over a WeakMap-backed budget authority | ✅ Resolved |
| AR-P16 | Runtime — invalid classification shape | How can ST-02 return `unsupported` for hostile/open tuples without retaining or fabricating an `ExecutionResultV1`? | Discriminated unsupported-input arm without `result`; retain unsafe input; fabricate a safe result | Discriminated unsupported-input arm omits `result`; valid tuples retain a normalized result | ✅ Resolved |
| AR-P17 | Runtime — compatibility fixture authority | How can ST-12 prove RD-04 V1 bytes stay unchanged after readiness source truthfully invalidates the old source-bound parent? | Frozen preimplementation report vector; weaken parent freshness; refresh/select publication in Phase 1 | Frozen exact preimplementation report bytes/digest plus unchanged execution-production guard | ✅ Resolved |
| AR-P18 | Runtime — inherited historical parent fixture | How can existing RD-04 catalog/orchestration specs keep exercising the exact parent they name after RD-05 changes current readiness authority bytes? | Exact test-owned parent-authority overlay; weaken resolver freshness; refresh/select current publications every phase | Overlay only the named historical parent's changed authority files inside its temporary fixture | ✅ Resolved |
| AR-P19 | Runtime — Phase 2 callable contract | Which exact closed API lets an implementation-blind specification prove malformed ingress, historical resolution, family invariants, catalog behavior, candidate tokens and reduction without test-only hooks or caller callbacks? | Layered free-function protocol behind the existing internal subpath; session-only public API; test-only fixture hooks | Layered free-function protocol: root exports genuine authority/session/projection operations; `failure-reduction-internals` exports the closed invariant/catalog mechanics | ✅ Resolved |
| AR-P20 | Runtime — published invalid-case restart seam | How does a restart consumer mint typed-invalid authority when the selected context hides its exact generator/boundary/renderer capabilities? | Narrow diagnostic-from-intent factory; expose a general prepared campaign; accept semantically equivalent caller campaigns | Narrow `createPublishedDiagnosticCaseFromIntentV1` factory over exact semantic intent and one shared private preparation path | ✅ Resolved |
| AR-P21 | Runtime — Phase 2 candidate-authority boundary and review remediation | Which authority belongs in Phase 2, and which review blockers must close before the phase completes? | Candidate/token core now and route/control/sequence in Phase 3; claim all execution authority now; defer review blockers | Keep reusable candidate/token authority in Phase 2, retain route/control/sequence authority in Phase 3, and fix every fail-closed/boundedness blocker now | ✅ Resolved |
| AR-P22 | Runtime — current parent publication lifecycle | How do Phase 2 tests use current five-binding oracle authority when the selected RD-04 nine-binding release is source-stale and real reselection belongs to Phase 6? | Materialize a current five-over-four test parent; reselect production now; forge the old release as current | Materialize and pin the deterministic current test parent over the immutable four-binding base; leave real review/selection to Phase 6 | ✅ Resolved |
| AR-P23 | Runtime — Phase 2 re-review integrity and boundedness | How must the reducer close surviving authority, identity, handoff and cost-model defects without widening Phase 3 scope? | Repair all Phase 2 invariants and expose only terminal candidate authority; defer them; move confirmation into Phase 2 | Repair all Phase 2 invariants, meter descriptor preparation, bound inspection, and expose a terminal-only authority handoff while retaining execution/confirmation in Phase 3 | ✅ Resolved |
| AR-P24 | Runtime — Phase 3 callable authority protocol | Which exact callable interfaces let the immutable Phase 3 specification exercise genuine isolation lifecycles, report-sidecar association, ordered sequence positions, controls and worker observations without exposing caller-selected handlers or inventing test hooks? | Package-private protocol session; exported internal subpath; high-level public coordinator; widened public mechanism APIs | Package-private `failure-execution-internals.ts` protocol session with opaque WeakMap authorities and authenticated observation projections | ✅ Resolved |
| AR-P25 | Runtime — Phase 3 fixture observation authority | How should the frozen Phase 3 fixture correct a predicate observation digest that does not match its supplied observation bytes, after the initial RED stopped before fixture construction? | Align fixture bytes to the named observation; replace the predicate with the empty-byte digest; weaken production validation | Preserve the authored named observation, supply its exact UTF-8 bytes, and freeze the complete four-file oracle bundle | ✅ Resolved |
| AR-P26 | Runtime — Phase 3 fixture module graph | How should the oracle ensure its APIs and genuine WeakMap-backed fixture authorities come from one module graph after controlled adapter installation? | Construct each fixture before importing its APIs; redesign fixture/API loading; accept cross-registry authorities | Construct each fixture first, then load APIs inside that same reset epoch; keep production authority registries strict | ✅ Resolved |
| AR-P27 | Runtime — Phase 3 raw fixture authority | How should raw-malformed oracle cases satisfy the approved invalid-diagnostic predicate, exact route-plan digest and strict UTF-8 ingress while retaining zero/nonzero raw coverage? | Derive a genuine raw predicate/digest and use valid malformed-language UTF-8; weaken production validation; admit invalid UTF-8 | Explicitly derive the raw predicate and exact byte digests; use `@` as valid UTF-8 malformed-language input | ✅ Resolved |
| AR-P28 | Runtime — Phase 3 external fixture entrypoints | How should true Worker/subprocess fixtures resolve executable JavaScript when Vitest imports their TypeScript controller from `src/`? | Bind to prebuilt `dist/test-fixtures` entries; add a runtime TypeScript loader; treat module-load crashes as scenario outcomes | Resolve both true-external adapters from the package's build-before-test `dist/test-fixtures` output | ✅ Resolved |
| AR-P29 | Runtime — Phase 3 sequence oracle time bound | How should the ten-independent-fixture sequence matrix fit a truthful bounded test when measured fixture setup already exceeds the global 240-second timeout? | Set a case-local measured timeout; raise the package/global timeout; reduce fixture independence or matrix coverage | Apply a measured 900-second timeout only to the complete ten-fixture sequence test | ✅ Resolved |
| AR-P30 | Runtime — ordinary report-sidecar ownership | How do all ordinary report results receive stable authenticated predicate ingredients before hashing when pass/unavailable routes have no complete failure predicate? | Discriminated executed/non-executed evidence union with exact-result association; fabricate full predicates; defer orchestration binding | Three-arm exact-result evidence union; handlers register executed results, orchestration alone mints non-executed arms and binds report order | ✅ Resolved |
| AR-P31 | Runtime — non-executed pass substitution evidence | How does the closed non-executed sidecar represent an authenticated injected PASS substitution when failure-predicate ingredients necessarily exclude pass? | Reuse the closed pass-or-failure basis union; fabricate failure ingredients; omit the non-executed sidecar | Retain the non-executed disposition and use the same explicit pass-or-failure-ingredients basis as ordinary evidence | ✅ Resolved |
| AR-P32 | Runtime — stable confirmation control contradiction | How should the stable confirmation fixture behave when its compiler-ICE predicate reproduces for both candidate and known-good control despite the requirement that the control pass? | Correct the fixture control identity outcome; accept equal control failure as confirmation; weaken the frozen expectation | Keep production's pass-only control gate and make the genuine distinct fixture control pass while candidate failures remain exact | ✅ Resolved |
| AR-P33 | Runtime — candidate content and authority identity | How can repeated identical reductions retain deterministic candidate identity while distinct authorities execute under non-aliased identities? | Deterministic content digest plus distinct execution identity; make the content digest authority-specific; add a third content field | Keep `candidateDigest` deterministic and move the authority ordinal exclusively into `candidateExecutionIdentity`; correct the conflicting Phase 3 oracle assertion | ✅ Resolved |
| AR-P34 | Runtime — deterministic result versus terminal authority | Should a byte-deterministic reduction result expose the terminal authority instance's non-deterministic execution identity? | Content-only result plus separate full terminal authority; retain full projection and weaken equality; make execution identity optional | Type `result.best` as deterministic content projection without execution identity; retain the full identity only behind the genuine terminal authority getter | ✅ Resolved |
| AR-P35 | Runtime — sequence coverage watchdog | How should ten independent sequence epochs remain bounded when V8 coverage makes the monolithic matrix exceed its 900-second watchdog? | Sequential per-position tests; larger monolithic timeout; coverage-specific timeout or exclusion | Split positions 2–9 and 64 plus pre-launch 65 into ten sequential cases with independent 300-second watchdogs | ✅ Resolved |
| AR-P36 | Runtime — Phase 3 quality-review authority closure | How must confirmation, controls, ordered sequences, predicate evidence, historical joins, report authority, VICE isolation and shutdown close the critical/major review counterexamples without weakening the frozen behavior? | Subject-bound opaque confirmation context; widen loose protocol inputs; derive lazily from global registries; defer findings | Mint one subject-bound context only from a complete report and exact private provenance, then fix every accepted review counterexample before re-review | ✅ Resolved |
| AR-P37 | Runtime — exact observation and aggregate shutdown evidence | What private representation proves byte-equal normalized observations, and what stable issue represents one or more settled shutdown failures? | Retain bounded canonical bytes; define digest equality as byte equality; reconstruct later | Retain private bounded canonical bytes and compare directly; aggregate shutdown uses stable `execution.io` count-only evidence after all settlements | ✅ Resolved |
| AR-P38 | Runtime — corrected oracle composite authority | How should the full-report fixture obtain the genuine composite projection after the missing context API had masked its use of a parent-only snapshot? | Resolve the fixture's exact published child and composite; weaken the composite API; fabricate a projection | Resolve the catalog fixture's genuine published child, join it to the exact parent, and use that same live context for orchestration | ✅ Resolved |
| AR-P39 | Runtime — corrected oracle cleanup policy | How should the full-report fixture satisfy the published execution-policy cleanup grace after prior gates masked its noncanonical value? | Use the schema-required 3000 ms; weaken policy validation; introduce a fixture exception | Set the fixture's cleanup grace to the existing canonical 3000 ms with no production or expectation change | ✅ Resolved |
| AR-P40 | Runtime — corrected oracle terminal failure injection | How should the full-report fixture fail the exact selected route occurrence when published terminal tiers differ from worker prerequisite tiers? | Bind exact case/position and exact terminal boundary; coerce non-VICE to frontend; accept any same-case stage | Inject only at the selected occurrence's genuine terminal worker/process tier and let prerequisites pass | ✅ Resolved |
| AR-P41 | Runtime — corrected oracle route-occurrence counter | Which controlled boundary advances the fixture's exact report/sequence occurrence when genuine execution emits one effective worker request per route rather than every prerequisite? | Count every worker start; count only frontend; infer from repeated case identity | Advance once on every controlled worker start, then bind exact occurrence/case/tier and arm process terminals from emit | ✅ Resolved |
| AR-P42 | Runtime — envelope materialization from private report provenance | How do the fixture and Phase 5 obtain a genuine envelope for one report position without exporting canonical observation bytes or loose authorization fields? | Narrow opaque position-to-envelope bridge; raw-byte accessor; caller reconstruction | Add a two-argument package-private bridge that derives complete provenance internally and returns only opaque envelope authority | ✅ Resolved |
| AR-P43 | Runtime — valid foreign mismatch envelopes | How should the corrected oracle create valid foreign predicate/observation/cleanup/route/tool authorities after private report bytes make loose genuine-predicate reconstruction invalid? | Self-consistent readiness-authorized foreign envelopes; extra controlled genuine reports; reuse pass/structural positions | Build closed self-consistent foreign envelopes from fixture-owned canary bytes, exact plan/tool facts and matching predicates; retain exact per-branch implementation tests | ✅ Resolved |
| AR-P44 | Runtime — foreign tool identity contract | Which exact planned shape and equality rule lets the implementation-blind fixture construct a valid nonempty foreign tool tuple without reading production? | Closed digest-matched identity set; opaque live VICE envelope; fixture guess | Specify the closed four-field identity and exact sorted digest-set equality already required by the envelope contract | ✅ Resolved |
| AR-P45 | Runtime — genuine foreign tool-route authority | How should the oracle obtain a valid tool-mismatched envelope after the exact foreign tuple still conflicts with its selected genuine route authority? | One opt-in same-epoch tool-bearing report; extra report in every fixture; weaken/omit tool case | Build one controlled VICE non-pass report only for the tool-mismatch case and authorize its position through AR-P42 | ✅ Resolved |
| AR-P46 | Runtime — raw-envelope tool completeness | How should the empty raw-malformed candidate fixture satisfy a copied route contract whose tool digest set is nonempty? | Reuse the complete public tool identities named by that contract; erase tool digests; leave an incomplete tuple | Supply the exact complete tool identities from the primary opaque envelope projection | ✅ Resolved |
| AR-P47 | Runtime — typed-family frontend coverage | How should the named typed-valid/typed-invalid published-chain oracle bind the frontend tier and actually exercise both families? | Closed family+tier fixture selection; tier-only correction; weaken title/assertion | Initial joint selector was unsatisfiable for the current campaign; superseded by AR-P48 | ✅ Resolved |
| AR-P48 | Runtime — parent-bound frontend family campaign | Which genuine campaign can prove both typed-valid and typed-invalid candidates traverse the published frontend handler? | Parent-bound frontend-only campaign; infer frontend from compiler-api prerequisite; weaken to terminal preservation | Complete-parent capacity makes frontend-only planning impossible; superseded by AR-P53 | ✅ Resolved |
| AR-P49 | Runtime — frontend campaign semantic intent | Which exact published intent gives the implementation-blind fixture the reviewed frontend population without guessing generation inputs? | Reuse the reviewed frontend semantic intent; copy mixed intent; invent a smaller population | Use the existing 72-case/24-invalid five-rule frontend intent with seed `sha256:666…666` and fixed budgets | ✅ Resolved |
| AR-P50 | Runtime — exact report-position request authority | How can the fixture consume scalar-1/scalar-2/direct-MMIO source authority without reconstructing private occurrence semantics? | Return exact retained request reference; passive projection/reconstruction; duplicate handler derivation | Add one package-private opaque-position accessor returning the exact frozen retained request authority | ✅ Resolved |
| AR-P51 | Runtime — original sequence replay identity | Which identity belongs on preceding original sequence worker requests after the report occurrence is already authority-bound? | Preserve original request case identity; overwrite with execution identity; reuse candidate identity | Preserve `occurrence.request.route.caseIdentity`; only the terminal reduced candidate uses candidate execution identity | ✅ Resolved |
| AR-P52 | Runtime — VICE fresh-confirm control selection | How should the VICE isolation oracle obtain the distinct genuine same-route passing control required before execution? | Select a matched VICE report pair; weaken control join; use current/global fallback | Select one exact VICE route-configuration pair, fail only one occurrence, and verify the other is a distinct pass | ✅ Resolved |
| AR-P53 | Runtime — authentic typed-family handler dispatch | What strongest truthful cross-family handler assertion remains after complete-parent planning rejects frontend-only campaigns? | Exact authentic terminal dispatch per family; fabricate scoped parent; mix frontend/runtime generators | Execute each family on its genuine complete-plan route and assert exact candidate-phase handler tier/result/activity | ✅ Resolved |
| AR-P54 | Runtime — sequence-65 prelaunch subject | Which genuine context should the hard-limit test use when report position 64 is an unmatched VICE fresh-confirm occurrence? | Position-2 genuine context with 64 hostile inputs; force a VICE control; weaken limit | Use the genuine position-2 context while retaining 64 preceding inputs and requested position/case-limit 65 | ✅ Resolved |
| AR-P55 | Runtime — typed-invalid intrinsic replacement validation | How should candidate validation preserve a genuine invalid replacement expression whose scalar type is not `word`? | Preserve exact validated scalar type; coerce all constants to word; weaken IR validation | Read the exact own scalar `type` and validate the synthetic expression under that type | ✅ Resolved |
| AR-P56 | Runtime — fixed VICE control campaign population | Which smallest genuine parent-bound two-spelling runtime population yields a matched VICE subject/control pair within the 64-position limit? | Freeze first viable searched population; use oversized runtime intent; weaken control | Freeze `caseCount:26`, `maxInvalidCases:0`; use positions 11/12 of the 62-item plan | ✅ Resolved |
| AR-P57 | Runtime — cross-family oracle watchdog | What truthful bound covers two independent genuine family campaigns and candidate executions without raising the package timeout? | One 600-second case-local watchdog; global timeout increase; merge/reuse authority epochs | Apply 600 seconds only to the cross-family published-handler case | ✅ Resolved |
| AR-P58 | Runtime — controlled typed-invalid diagnostic outcomes | How should mixed sequence/report fixtures make genuine typed-invalid originals pass and the selected original/candidate reproduce one direct-shrink mismatch? | Published diagnostic tuple map; filter valid-only routes; accept crash/predicate drift | Emit exact published diagnostic tuples for passes and one deterministic code-only mismatch for the selected typed-invalid subject | ✅ Resolved |
| AR-P59 | Runtime — authentic typed-valid sequence campaign | Which genuine campaign exercises every required sequence position with distinct same-route controls? | Fixed all-valid campaign; mix direct-shrink invalids; fabricate order | Use the fixed 68-position all-valid campaign and exact controls 2→3 through 9→10 plus 64→65 | ✅ Resolved |
| AR-P60 | Runtime — local authentic VICE isolation oracle | How should the local oracle prove candidate-relative VICE isolation end to end? | Real toolchain with launcher-only fault; fake artifacts; lower-tier composition | Exercise real emit, ACME and VICE through the attempt-owned worker and fail only the exact launcher boundary | ✅ Resolved |
| AR-P61 | Runtime — defect-first VICE campaign admission | How should a candidate/control VICE pair be admitted without selecting around real defects? | Health gate then bounded search; immediate search; composed proof | Repair cleanup first and require real preparation, execution and report admission; seed-7 defect classification superseded by AR-P63 | ✅ Resolved |
| AR-P62 | Runtime — static-graph local VICE specification split | How should the VICE case avoid module-registry authority splits? | Dedicated top-level mock graph; further reset patching; production injection API | Dedicated specification split retained, but all module mocking is superseded by AR-P63 after the static mock graph reproduced the same split | ✅ Resolved |
| AR-P63 | Runtime — executable-boundary VICE fault | How can the local oracle inject one authentic launcher failure without splitting execution authority or adding production hooks? | PATH-selected executable shim; module mocks; production injection seam | Use a canonical executable shim with atomic one-shot arming, real execve pass-through and no module mocks | ✅ Resolved |
| AR-P64 | Runtime — stale local VICE lease admission | Why do both healthy fixed routes fail before launch in an unarmed baseline report? | Authenticated exact-generation recovery; choose another pair; delete lease files | Inspect and clear only the positively absent exact lease generation through the production recovery API | ✅ Resolved |
| AR-P65 | Runtime — shim pass-through environment parity | Why does a generation-zero unarmed shim route leave cleanup-blocked state? | Preserve launcher allowlist; inject parent environment; abandon executable boundary | Forward exactly the launcher's existing LANG/LC_ALL/TZ/optional DISPLAY environment to real VICE | ✅ Resolved |
| AR-P66 | Runtime — real VICE predicate-sidecar canonicalization | Why does a passing real VICE report reject its first VICE predicate sidecar and return nested failure? | Canonicalize before sidecar minting and propagate rejection; relax digest equality; fixture workaround | Bind sidecars to the canonical report result and propagate report-authorizer failures as operation failures | ✅ Resolved |
| AR-P67 | Runtime — VICE version-probe injection ordering | Why does the armed one-shot marker leave the selected route passing? | Always pass through `--version`; count probe as injection; bypass discovery | Check and exec the real `--version` probe before consulting the one-shot marker | ✅ Resolved |
| AR-P68 | Runtime — early-exit child retirement | How does an exit-127 child retain a child-recorded lease after authentic launch? | Bounded identity-pinned reconciliation; automatic broad reclaim; fixture cleanup | Preserve private post-start lifetime authority and retire exact absent child/artifact/lease after bounded reconciliation | ✅ Resolved |
| AR-P69 | Runtime — retry-aware VICE occurrence injection | Why does one exact launcher exit leave the selected route passing? | Arm every bounded launch attempt; reduce policy attempts; accept one-attempt evidence | Fail both reviewed launch attempts while counting one semantic occurrence injection | ✅ Resolved |
| AR-P70 | Runtime — complete-campaign VICE attribution | Which route owns a final process-wide lease after the selected pair passes? | Project every VICE record; attribute to positions 11/12; poll globally | Retain selected pair semantics but diagnose every VICE occurrence before attributing final lease state | ✅ Resolved |
| AR-P71 | Runtime — private VICE failure observation provenance | How can a genuine non-pass VICE position supply exact canonical bytes without exposing build evidence? | Exact-result private byte association; public raw bytes; digest-only equality | Retain bounded bytes behind exact-result authority and expose only a defensive package-private copy | ✅ Resolved |
| AR-P72 | Runtime — reproducible pre-observation VICE evidence | Why does a fresh identical launcher failure classify as flaky after provenance is complete? | Stable terminal-reason bytes; build-specific bytes; weaken exact comparison | Encode only closed terminal facts for pre-observation failures and keep build evidence separate | ✅ Resolved |
| AR-P73 | Runtime — bounded evidence and payload ownership | How can report provenance remain authoritative without retaining route-sized payload and observation copies for every occurrence? | Lazy selected-occurrence derivation with one private byte owner; eager per-route copies; public raw evidence | Retain opaque source authority, derive/cache only the selected payload, and keep one exact observation-byte owner | ✅ Resolved |
| AR-P74 | Runtime — total observation authority | Where is the observed/not-reached distinction fixed without inferring it from terminal stage or cleanup? | Explicit boundary-minted authority; stage inference; optional observation | Mint an explicit private observation arm at the actual observation or terminal boundary and normalize only stable facts | ✅ Resolved |
| AR-P75 | Runtime — confirmation and isolation proof | What evidence is required before direct-shrink, standalone, or sequence execution can receive a terminal classification? | Two fresh runs plus authenticated checkpoints; disposition-only digests; exempt direct-shrink | Require two fresh candidate runs for every minimized failure and checkpoint-bound isolation/order invariants before classification | ✅ Resolved |
| AR-P76 | Runtime — complete semantic provenance | Which authenticated claims and route/tool facts must survive report-position authorization and control matching? | Complete source claims and route contract with actual report tools; primary-only claims; selected-field comparison | Preserve every required claim, compare the complete semantic route contract, and retain actual report tool versions separately from handler revisions | ✅ Resolved |
| AR-P77 | Runtime — fresh tool-version revalidation | How does confirmation prove the historical Node/ACME/VICE versions still name the tools about to execute? | Shared bounded fresh probe before each isolated launch; trust the historical report; duplicate CLI-only probes | Reuse one package-private discovery seam and fail closed before launch on any required version drift or probe failure | ✅ Resolved |
| AR-P78 | Runtime — review-driven test decomposition and watchdog | How should the enlarged immutable oracle and implementation tests stay maintainable while two genuine fixture constructions exceed the default watchdog? | Concern-based modules plus one measured case timeout; global timeout increase; reduce genuine fixture independence | Split every oversized test/fixture below 700 lines and apply a measured 600-second timeout only to the two-fixture observation case | ✅ Resolved |
| AR-P79 | Runtime — exact external control occurrence | How can an injected real VICE report provide a distinct passing control when its neighboring route differs in fixture identity? | Same-route occurrence from a separately authenticated baseline report; accept the neighboring route; omit control | Use the baseline report's passing execution of the exact subject route, joined to the same parent, plan and tools | ✅ Resolved |
| AR-P80 | Runtime — dedicated executor capacity | What executor capacity proves standalone and sequence isolation without inheriting ordinary pool behavior? | Exact semantic capacity; fixed maximum; ordinary campaign pool | Use one case for standalone and the authenticated terminal position for each sequence attempt | ✅ Resolved |
| AR-P81 | Runtime — complete pre-allocation tool revalidation | When should all tools potentially reached by subject, control and preceding sequence routes be revalidated? | Validate the complete context before isolation allocation; probe per position after allocation; trust report values | Validate every potentially executed tool once before any root, worker, isolate or process allocation | ✅ Resolved |
| AR-P82 | Runtime — report-bound VICE cleanup visibility | How does a campaign prevent report authority from preceding the final durable child-retirement observation? | Bounded read-only absent-namespace barrier; accept eventual cleanup; mutate recovery state automatically | Before authorizing a VICE-bearing report, require generation-zero clear/child-absent state within the selected cleanup grace | ✅ Resolved |
| AR-P83 | Runtime — final V8 fixture watchdogs | How should genuine report-bound cases that now measure 210–366 seconds under the final closure avoid the 240-second package default without weakening assertions? | Measured 600-second case-local watchdogs; raise the global timeout; simplify/reuse fixtures | Apply 600 seconds only to the four newly measured fixture-backed cases; retain every assertion and the global default | ✅ Resolved |
| AR-P89 | Runtime — cancelled pending-launch cleanup ownership | Which layer may spend cleanup authority after a launcher process start is cancelled at the work deadline? | Coordinator-owned reserved cleanup; control-host private cleanup followed by coordinator cleanup; extend the route | Return exact cleanup ownership to the coordinator when pending start is cancelled; preserve local cleanup for non-cancelled start failures | ✅ Resolved |
| AR-P90 | Runtime — final VICE artifact/lease retirement transaction | How should positively absent final child cleanup avoid exhausting the fixed grace across two durable namespace transactions? | One validated artifact-plus-lease transaction; retain two lock/fsync transactions; extend cleanup | Strengthen exact lease removal to validate and retire its retained artifact in the same lock and durability transaction; retain separate retirement only between retries | ✅ Resolved |
| AR-P91 | Runtime — orchestration implementation watchdog | How should the genuine unavailable-tools orchestration case remain bounded after full-load execution reached its explicit 240-second timeout? | Existing measured 600-second case-local watchdog; package/global increase; weaken the fixture | Raise only this case's explicit watchdog to 600 seconds and preserve every assertion and production budget | ✅ Resolved |
| AR-P92 | Runtime — confirmation tail watchdogs | How should three unchanged confirmation cases that newly reached the default timeout under heavier final coverage remain bounded? | Existing 600-second case-local watchdog on those cases; global increase; weaken fixture semantics | Apply 600 seconds only to owned-shutdown, flaky and infrastructure-control cases; preserve all behavior and assertions | ✅ Resolved |

## Resolution Notes

### AR-P1 — Package ownership

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal architecture inside approved package and behavior boundaries.
**Objective:** Preserve dependency direction and keep domain authority independent of host I/O.
**Decision:** `@blend65/readiness` owns closed models, identity, replay, reduction, evidence schemas,
and lifecycle; `@blend65/readiness-execution` owns route execution, workers, orchestration, and
filesystem publication.
**Evidence:** `readiness` has no toolchain dependency; `readiness-execution` already depends on it
and the compiler/toolchain.
**Rejected alternatives:** A new package adds forwarding/authority ambiguity; an execution monolith
couples domain semantics to Node processes.
**Strongest counterargument:** Cross-package protocols add integration surface.
**Confidence:** High — change only if implementation proves a dependency cycle or independent
multi-package consumption.
**Hardening:** Challenger converged.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** A real cycle appears or a third consumer needs the whole reduction application.

### AR-P2 — Closed domain modules

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal file/module decomposition.
**Objective:** Keep versioned identities and parsers reviewable without enlarging RD-04 wire types.
**Decision:** Add focused modules for contracts/policy, identity, envelopes, malformed authority,
catalog/reducer, candidate authority, evidence, and regression lifecycle; export only reviewed public
seams.
**Evidence:** Existing contract and orchestration files are already 700+ lines and RD-04 report
serialization is closed/content-bound.
**Rejected alternatives:** One aggregate schema becomes monolithic; extending RD-04 contracts
breaks authority compatibility.
**Strongest counterargument:** More files increase navigation cost.
**Confidence:** High — reopen only if a module cannot retain a single responsibility.
**Hardening:** Forced decomposition review retained cohesive domain modules.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Any proposed module remains under roughly 100 lines and has no independent API.

### AR-P3 — Raw malformed ingress

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal authority/interface mechanism required by approved malformed behavior.
**Objective:** Admit exact, including empty, UTF-8 bytes without weakening typed case invariants.
**Decision:** Introduce separately branded `MalformedDiagnosticCaseV1` and
`MalformedReplayEnvelopeV1`, constructed only from bounded source, reviewed rule/obligation,
selected diagnostic-oracle authority, and canonical token/text provenance.
**Evidence:** Current generated cases are typed valid/invalid projections and existing diagnostic
authority regenerates only campaign ordinals.
**Rejected alternatives:** Widening typed cases destroys typed invariants; unauthenticated bytes
bypass oracle/route authority.
**Strongest counterargument:** A second replay arm increases parser and test surface.
**Confidence:** High — the existing union has no viable raw arm.
**Hardening:** In-context adversarial review found no narrower compliant seam.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** A pre-existing genuine raw-source authority is introduced before execution.

### AR-P4 — Reduction algorithm

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Algorithm and data-structure choice.
**Objective:** Produce deterministic one-minimal results within selected budgets.
**Decision:** Enumerate the closed catalog in canonical order, accept the first strictly smaller
predicate-preserving candidate, restart at the first transformation, and finish only after one
complete catalog pass accepts nothing.
**Evidence:** Strict size tuples prove termination; the RD explicitly rejects global minimality.
**Rejected alternatives:** A worklist adds ordering/state complexity; global search is infeasible
under bounded execution.
**Strongest counterargument:** Restarting can repeat catalog scans.
**Confidence:** High — bounded attempts cap the cost and identity binds the policy.
**Hardening:** 10×-budget reframing still favored determinism over global search.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Measured catalog rescans exceed selected limits on known-reducible fixtures.

### AR-P5 — Candidate execution authority

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Complex internal protocol design inside approved authority policy.
**Objective:** Execute transformed bytes through unchanged obligation/tier/policy/fixture/oracle.
**Decision:** Add a dedicated discriminated candidate request arm derived from genuine
`ReductionCandidateAuthorityV1`; published tier handlers accept it only after original route-contract
and new candidate identity validation. A closed family-specific payload and purpose-limited
candidate runtime authority adapt transformed source/semantics to route, live-handler, ACME, VICE,
and runtime-evaluation consumers without forging `ExecutionCaseV1` or reusing original expected
runtime bytes.
**Evidence:** Current handlers already consume a closed request union and are the only reviewed path
through workers, ACME, VICE, and oracle evaluation.
**Rejected alternatives:** Reusing identity falsifies provenance; direct invocation bypasses route
and publication authority.
**Strongest counterargument:** Candidate branches can duplicate validations and drift.
**Confidence:** High — shared route-contract validators and cross-arm conformance tests contain it.
**Hardening:** Challenger converged; it allowed future generalization only if brands stay distinct.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** A smaller generalized authenticated payload union proves equivalent fail-closed behavior.

### AR-P6 — Secure immutable publication

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Sensitive persistence mechanism inside the approved immutable/no-follow policy.
**Objective:** Publish canonical records durably without duplication, lost updates, or authority drift.
**Decision:** Readiness authorizes canonical bytes and digests; execution generalizes its pinned,
no-follow, synced, no-clobber filesystem primitives and accepts only branded authorized records.
**Evidence:** Existing execution primitives already prove inode identity, exclusive temporary
writes, byte revalidation, and directory durability.
**Rejected alternatives:** A readiness writer duplicates sensitive code; mutable merging reopens
lost-update and crash hazards.
**Strongest counterargument:** Split schema/write ownership needs an unforgeable byte handoff.
**Confidence:** High — opaque authorized-record capabilities close that seam.
**Hardening:** Challenger converged.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Another independent package requires the same publisher, justifying a lower-level package.

### AR-P7 — Confirmation coordination

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Concurrency and recovery mechanism.
**Objective:** Distinguish standalone, sequence-dependent, and flaky failures.
**Decision:** A bounded coordinator acquires a fresh worker-thread/V8 isolate/root for each of two
standalone confirmations and for each complete sequence attempt; ordered cases reuse their dedicated
attempt worker through the selected maximum of 64 so cross-case state can reproduce while ordinary
per-case workspaces still clean up. Independent attempts never share state, the coordinator bypasses
the campaign pool's eight-case retirement, and external tool subprocesses remain route-isolated.
**Evidence:** The current executor intentionally reuses workers for up to eight cases.
**Rejected alternatives:** Pool reuse preserves contamination; source-only persistence misclassifies
stateful defects.
**Strongest counterargument:** Fresh isolates and external subprocesses are expensive.
**Confidence:** High — the cost applies only to final confirmation/sequence reproduction.
**Hardening:** Performance reframing retained isolation at the final boundary.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** The worker gains a formally verified complete reset primitive.

### AR-P8 — Regression activation

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Complex test architecture inside approved inactive/active behavior.
**Objective:** Make active regressions immutable and green without manufacturing mutable tests.
**Decision:** Store inactive cores under tracked readiness evidence; activation adds one immutable
marker. A co-located readiness-execution spec runner traverses from activation roots, validates the
complete reachable activation/core graph, and registers one stable test per active key;
malformed, duplicate, missing, or forged reachable authority fails the suite. Valid unreferenced
events remain inactive reconciliation evidence and emit only a diagnostic.
**Evidence:** The repo tracks readiness authorities and uses implementation-blind co-located spec
tests; execution owns compiler/tool routes.
**Rejected alternatives:** Generated tests drift and duplicate harnesses; expected-failure tests
approve defects.
**Strongest counterargument:** Dynamic discovery can conceal omissions.
**Confidence:** High — explicit zero/malformed/duplicate/missing-graph tests make discovery closed.
**Hardening:** Challenger converged and added fail-closed graph loading.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Vitest cannot expose stable per-key cases or implementation blindness forbids enumeration.

### AR-P9 — RD-04 join and envelope materialization

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Complex compatibility/integration mechanism.
**Objective:** Obtain complete shrink authority without changing `ExecutionAuthorityReportV1`.
**Decision:** A new orchestrator validates an existing report against genuine parent, execution,
oracle, campaign, route, and result authority. Report authorization privately binds an ordered
handler-minted predicate-sidecar map without changing V1 bytes. The orchestrator creates a complete
`FailureEnvelopeV1` only when all authority is resolvable; otherwise it creates a closed durable
unavailable-source run without pretending an envelope exists.
**Evidence:** The report retains digests/results but not source, IR, route bytes, or replay envelope;
its V1 serializer is exact and content-bound.
**Rejected alternatives:** Extending V1 breaks compatibility; report-only processing cannot replay
or authenticate candidate bytes.
**Strongest counterargument:** Old reports cannot reduce without resolvable live authority.
**Confidence:** High — unavailable authority already has a closed RD outcome.
**Hardening:** Challenger converged and required immediate sidecar materialization.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Reduction must begin in a disconnected process; add a separate bundle, never mutate V1.

### AR-P10 — Quality thresholds

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Testing and verification strategy.
**Objective:** Hold new identity/security cores to the established readiness quality floor.
**Decision:** Require checked exact RD-05 source lists and Vitest `perFile` branch coverage of at
least 90% in both packages. A Git-baseline freshness command independently derives every changed
production participant, classifies new cores versus legacy hosts/generated/barrels, and prevents a
self-declared allowlist from omitting a touched file. The exact repository verification command
remains mandatory.
**Evidence:** RD-04 used focused 90% branch floors; package scripts already expose coverage.
**Rejected alternatives:** Exact verify alone has no branch floor; raising whole-package floors
would expand unrelated remediation.
**Strongest counterargument:** Focused thresholds require maintained include lists.
**Confidence:** High — component-owned lists are stable plan deliverables.
**Hardening:** Scope check rejected unrelated whole-package cleanup.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Vitest cannot measure the selected modules independently.

### AR-P11 — Names and components

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal naming and file layout.
**Objective:** Keep a large feature navigable and below the project's file-size ceiling.
**Decision:** Use five owning component specs—contracts/history, reduction engine,
candidate execution, evidence/regressions, orchestration/closeout—and focused kebab-case
`failure-*`/`reduction-*` source modules, normally below 500 lines and never above 700.
**Evidence:** Several predecessor files already exceed 700 lines; project conventions require splits.
**Rejected alternatives:** Fewer components grow monoliths; premature micro-modules obscure flow.
**Strongest counterargument:** Five specs create more cross-references.
**Confidence:** High — reference-don't-restate keeps them compact.
**Hardening:** Contrarian simplification retained five cohesive ownership boundaries.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Authoring reveals a component with multiple independent state machines.

### AR-P12 — Verification command

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Detectable project verification mechanism.
**Objective:** Use the repository's declared green checkpoint.
**Decision:** Every phase uses
`yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`.
**Evidence:** Root `AGENTS.md` names this exact command as mandatory before every commit.
**Rejected alternatives:** Package-only checks miss boundaries; approximating CI diverges from policy.
**Strongest counterargument:** The full suite is expensive.
**Confidence:** High — package-focused checks may precede it, never replace it.
**Hardening:** No change.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Project guidance changes the authoritative command.

### AR-P13 — Content-bound handler refresh

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Complex compatibility/recovery sequencing required by current authority design.
**Objective:** Keep the selected execution child truthful after handler bytes change.
**Decision:** Regenerate/check handler closures after every phase's final participating-byte change
before verification/commit. After final code review, rerun genuine ACME/VICE acceptance,
independently review exact bytes/evidence, prepare a new immutable child, atomically select it, and
run only non-mutating post-selection checks. Earlier phases never prepare or select a child.
**Evidence:** `execution-route-adapters` participates in all six generated handler closures and the
selected pointer names one exact immutable child.
**Rejected alternatives:** A bypass violates route authority; stale selection claims obsolete bytes.
**Strongest counterargument:** This is an expensive local-emulator closeout gate.
**Confidence:** High — it is the only viable path if adapter bytes change.
**Hardening:** Challenger converged; no omitted option was stronger.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Final dependency-closure proof shows no selected handler byte changed.

### AR-P14 — Green activation commit identity

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal lifecycle and immutable-record mechanism within approved green activation.
**Objective:** Record a truthful immutable commit identity without circular self-reference.
**Decision:** The compiler fix or already-passing proof lands and verifies first. A later activation
commit adds the immutable marker containing that exact lowercase 40-hex commit ID, proves with fixed
argv-only Git probes that current `HEAD` descends from it, reruns the unchanged candidate, and
remains green. CI fetches full history so the proof is available for detached pull-request heads.
**Evidence:** A Git commit cannot contain its own final hash; activation may not mutate candidate or
marker bytes after publication.
**Rejected alternatives:** A placeholder is not authority; a post-commit rewrite violates
immutability and changes the commit again.
**Strongest counterargument:** Activation requires a second commit/checkpoint.
**Confidence:** High — two immutable commits are the only non-circular Git representation.
**Hardening:** Forced self-reference analysis eliminated single-commit encodings.
**Policy version:** 1 · **Root invocation ID:** `make-plan-rd05-20260826-0856`
**Reopen trigger:** Activation authority moves to an external append-only store with its own commit identity.

### AR-P15 — Phase 1 identity and budget operations (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal API and data-structure design inside approved disposition, identity, and
resource-policy behavior; it changes no product scope or acceptance criterion.
**Objective:** Give implementation-blind specifications a complete closed interface without
exposing mutable state or allowing callers to bypass coupled resource charges.
**Decision:** Add validating `deriveFailurePredicateIdentityV1`, `derivePromotedFailureKeyV1`, and
`deriveFailureReductionRunIdentityV1` constructors using the existing optional
`IdentityCollisionRegistry`. Add `createFailureCampaignBudgetAuthorityV1`,
`chargeFailureCampaignBudgetV1`, and `getFailureCampaignBudgetSnapshotV1` as free operations over
one opaque WeakMap-backed authority. Charges use a closed purpose union—transformation, route by
reduction/confirmation/control purpose, oracle evaluation, diagnostic capture, provenance read or
write, sequence case, core write, terminal envelope/run write, and terminal summary write—so every
operation atomically increments campaign plus applicable category/byte counters. Construction
accepts only non-pass/resolvable cardinalities and rejects an insufficient terminal reserve.
Core and run byte limits apply per complete record, with the accounting snapshot retaining the
largest observed record size rather than an invalid campaign-total sum.
**Evidence:** Existing readiness identities use validating free constructors plus the bounded
`IdentityCollisionRegistry`; execution capabilities use module-private state and closed passive
results. The resource contract couples campaign, category, byte, and terminal-reserve charges, so a
generic counter mutation could undercharge a real operation.
**Rejected alternatives:** A method-bearing branded value exposes more operational surface and is
easier to proxy incorrectly. A generic `charge(key, amount)` lets callers omit a coupled counter or
consume terminal capacity as discretionary work. Separate authority per counter recreates the
unbounded multiplication the shared campaign budget prevents.
**Strongest counterargument:** A closed operation union must grow if a later approved operation has
new accounting semantics.
**Confidence:** High — the union already covers every operation named by the approved plan; a new
accounting class is an objective reopen trigger.
**Hardening:** Forced 10×-load and hostile-caller reframing retained atomic closed operations and
rejected caller-selected counters.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260826-1642`
**Reopen trigger:** A required Phase 2–5 operation cannot be represented without either undercharge
or a semantically false existing purpose.

### AR-P16 — Unsupported hostile classification input (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal closed-result representation inside the already approved fail-closed
`unsupported` behavior; it changes no product scope or acceptance criterion.
**Objective:** Satisfy ST-02 without allowing malformed, accessor-bearing, copied, extended, or
future-version execution input to become trusted evidence.
**Decision:** Make `ClassifiedFailureV1` a discriminated union. A structurally valid execution
result—including `pass` or a known but route-disallowed tuple—is defensively normalized and retained
in a classification whose disposition may be `unsupported`. If either input has an invalid/open
shape, classification still succeeds as the required fail-closed `unsupported` arm, sets cleanup
to `cleanup-clear`, and omits `result` entirely. Downstream reduction can therefore persist an
unsupported outcome without reading, retaining, or fabricating execution evidence.
**Evidence:** Frozen ST-02 requires a successful `unsupported` classification for unknown code,
stage, tier, extra keys, and route mismatch. The declared `ExecutionResultV1` cannot truthfully
represent unknown/open input, while retaining it would export unvalidated caller state and
fabricating a replacement would create false historical evidence.
**Rejected alternatives:** Retaining the caller value violates the hostile-input boundary;
fabricating a valid result violates evidence truth; returning an operation failure contradicts the
frozen specification's closed unsupported outcome.
**Strongest counterargument:** Consumers must handle an unsupported arm without a result projection.
**Confidence:** High — the union makes that obligation explicit and prevents unsafe evidence use.
**Hardening:** Hostile-input, authority-truth, and downstream-persistence reframing eliminated both
retention and fabrication.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260826-1642`
**Reopen trigger:** A durable unsupported record requires a bounded canonical projection of the
rejected shape; add a separate diagnostic projection, never widen `ExecutionResultV1`.

### AR-P17 — Historical report compatibility fixture authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Test-fixture representation for an already approved byte-compatibility assertion;
it changes no report schema, production authority, publication lifecycle, or acceptance criterion.
**Objective:** Keep ST-12 executable after the intended readiness source additions without
weakening content-bound publication freshness or selecting an unreviewed child.
**Decision:** Freeze the exact canonical RD-04 V1 report bytes and digest obtained at the recorded
preimplementation commit, then assert those historical bytes remain byte-identical while the new
RD-05 public surface is observed. Pair that vector with the Phase 1 source-ownership/freshness gate,
which rejects any report serializer/orchestration production change while allowing the required
review-only generated binding refresh. Do not reconstruct a new report from the current source
during this historical-compatibility case. Genuine current-authority campaign
execution remains in the later integration and publication phases after the reviewed authority is
refreshed.
**Evidence:** The ST-12 baseline was GREEN before production. Adding the required readiness root
exports changes bytes bound by the committed readiness parent; the genuine fixture then correctly
fails `execution.stale-authority /parentDigest`. Refreshing/selecting publication in Phase 1 would
contradict the reviewed Phase 6 lifecycle, while weakening freshness would make the authority lie.
**Rejected alternatives:** Ignoring parent staleness violates content-bound authority; refreshing
or selecting early bypasses final review/real acceptance; dropping ST-12 loses the compatibility
gate.
**Strongest counterargument:** A frozen byte vector does not alone exercise the serializer after
the source change.
**Confidence:** High — existing serializer implementation tests still exercise authorization and
canonical serialization, while the independent source guard proves Phase 1 does not alter that
report production path.
**Hardening:** Authority-truth and lifecycle-order reframing ruled out both bypass and early
publication.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260826-1642`
**Reopen trigger:** The execution report serializer or report schema becomes an authorized RD-05
production participant; then a new versioned report compatibility vector and publication review
are required.

### AR-P18 — Inherited historical-parent fixture authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Test-fixture reconstruction of an already immutable published parent; it changes no
resolver, publication, selection, or product behavior.
**Objective:** Keep inherited RD-04 catalog and orchestration specifications truthful while RD-05
intentionally changes current readiness authority bytes before final publication refresh.
**Decision:** The temporary RD-04 catalog fixture continues to name parent
`sha256:e5796e6f2abab401100f93547b4044c57a762b9ec7703e6183fda2c07afcd3e5` and overlays only
the exact test-owned preimplementation bytes for authority files changed by RD-05. All other
authority and publication bytes still come from the repository and retain the existing bounded,
no-symlink copy checks. The production resolver remains strict. Current-source publication refresh,
review, real acceptance, and selection remain Phase 6 work.
**Evidence:** The inherited fixture currently copies the current `packages/readiness` authority
tree, then asks the resolver to validate the old named parent. RD-05 changes the readiness package
manifest, root barrel, and canonical identity domain, so the resolver correctly returns
`execution.stale-authority /parentDigest`. The exact old bytes exist at the recorded Phase 1
ancestor and are the authority that the immutable parent review actually accepted.
**Rejected alternatives:** Weakening the resolver would make stale authority live; refreshing and
selecting on every intermediate phase would bypass the reviewed final lifecycle and make historical
tests stop testing their named parent; skipping inherited tests violates the full verification gate.
**Strongest counterargument:** Test-owned source snapshots duplicate a small amount of historical
authority.
**Confidence:** High — the overlay is bounded to exact changed files and is hash-reviewed as part of
the inherited fixture; it reconstructs rather than substitutes authority.
**Hardening:** Historical-identity and source-archive portability checks rejected a Git-history
runtime dependency and a resolver bypass.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260826-1642`
**Reopen trigger:** Another current-source change touches a dependency in the named parent's exact
authority closure; add its preimplementation bytes to the same bounded fixture overlay.

### AR-P19 — Complete Phase 2 callable contract (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal API, data-shape and testability design inside the approved Phase 2
behavior and existing package boundary; it changes no product behavior, acceptance criterion,
security policy or scope.
**Objective:** Give the implementation-blind specification author a complete non-guessing packet
while keeping every executable authority opaque and preventing test-only production seams.
**Decision:** Use the layered free-function protocol now specified completely in
`03-02-reduction-engine.md`. Root exports accept only genuine existing typed-valid,
typed-invalid or malformed authorities, expose opaque historical resolvers/candidates/sessions and
defensive passive projections, and return closed operation results. The existing purpose-limited
`@blend65/readiness/failure-reduction-internals` subpath alone exposes family drafts,
validate/enumerate/apply/normalize operations and single-use invocation consumption needed by the
specification and the later execution package. Historical parsing consumes a WeakMap-backed
resolver built from digest-verified canonical authority records and discriminates `resolved` from
`historical-authority-unavailable`; the unavailable arm contains no envelope. Catalog edits and
normalization are distinct proposal kinds, so changed executable bytes must be evaluated before
adoption. The specification may construct a genuine published-oracle context only through the
existing historical publication fixture, resolver and `createPublishedOracleContext`; no forged
test context is added.
**Evidence:** The first specification-author dispatch stopped without editing because the plan
omitted seven required schema/signature groups. Existing `ExecutionCaseV1`,
`PublishedDiagnosticCaseV1` and `FailureCampaignBudgetAuthorityV1` already use the selected opaque
brand plus module-private WeakMap/free-operation pattern. Direct invariant and catalog operations
are necessary to make the authorized negative cases observable without implementation-specific
injection hooks.
**Rejected alternatives:** A session-only API cannot independently exercise invalid candidate
tuples, illegal non-decreasing edits, normalization cycles or direct token substitution; adding
test-only hooks would couple the immutable oracle to implementation and create a production bypass.
**Strongest counterargument:** The internal subpath freezes more mechanical shapes and makes catalog
evolution deliberately versioned.
**Confidence:** High — reopen only if the immutable cases are explicitly re-scoped away from direct
contract verification or a smaller protocol proves the same negative cases without injection.
**Hardening:** Independent challenger selected the same layered protocol and required genuine source
authorities, an opaque record resolver, runtime-opaque validated candidates/tokens, and distinct
catalog-versus-normalization proposals.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260829-resume`
**Reopen trigger:** A required specification case cannot be expressed from the completed packet, or
an operation can mint executable authority from passive caller data alone.

### AR-P20 — Published invalid-case restart seam (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Purpose-limited API completion required to exercise the already approved genuine
typed-invalid authority after restart; it changes no result semantics, route, publication policy or
scope.
**Objective:** Let a consumer holding only a genuine selected `PublishedOracleContext` mint the
existing `PublishedDiagnosticCaseV1` without exposing or accepting executable campaign
dependencies.
**Decision:** Add `createPublishedDiagnosticCaseFromIntentV1(context, intent)` to the existing
published-oracle subpath. Its exact hostile input contains only schema version, rule ID, seed,
configuration and ordinal. A shared source-private helper authenticates the context, selects the
historical generator, boundary transform, renderer and modeled suite from WeakMap state, prepares
the campaign, and regenerates the ordinal. The new factory then uses the existing diagnostic join
and returns only its opaque capability. `PreparedCampaign` remains private.
**Evidence:** The first corrected Phase 2 fixture could resolve the selected nine-binding context
and mint typed-valid `ExecutionCaseV1`, but every typed-invalid ordinal failed at `/campaign`: no
published API could reconstruct the hidden exact campaign capabilities required by the existing
diagnostic constructor after restart.
**Rejected alternatives:** Returning a general `PreparedCampaign` grants generation and valid-case
execution authority beyond the blocked diagnostic join and duplicates the existing general
campaign factory. Accepting a caller campaign by semantic output equivalence executes unselected
implementations before provenance validation and breaks exact historical authority.
**Strongest counterargument:** A future restart consumer might need the whole prepared campaign;
no independent approved consumer currently does.
**Confidence:** High — the narrow factory is sufficient for the established invalid-case join and
does not widen executable authority.
**Hardening:** Independent challenger selected the same diagnostic-from-intent seam, rejected both
general campaign exposure and semantic-equivalence fallback, and required one shared private
preparation helper.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260829-resume`
**Reopen trigger:** A separately approved restart workflow proves it needs the full prepared
campaign rather than a diagnostic authority.

### AR-P21 — Phase 2 candidate-authority boundary and review remediation (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal phase ownership and fail-closed repair inside the already approved RD-05
candidate/reducer design; it changes no product scope, acceptance criterion, public workflow, or
publication lifecycle.
**Objective:** Reconcile the overlapping Phase 2 candidate-authority task with the explicit Phase 3
execution/control/sequence tasks while closing the Phase 2 review's correctness, semantic, and
performance blockers without silently declaring absent behavior complete.
**Decision:** Phase 2 owns the reusable validated candidate authority, its passive candidate-source,
original-route/predicate/policy identity, reduction/confirmation invocation tokens, and a
session-owned monotonic proposal sequence. Phase 3 owns the family-specific execution payload and
candidate-relative runtime authority because only its execution join can derive the required fresh
semantic/fixture/oracle bytes without fabricating them; it also owns route consumption,
known-good-control authority, sequence-position authority and terminal-position enforcement, worker
isolation, and fresh confirmation. Task 2.2.6 is narrowed to that Phase 2 boundary; tasks 3.2.1 and
3.2.6 remain open and authoritative for execution payload/runtime and control/sequence behavior.
The review's historical reconstruction, witness/binding, catalog ordering and
applicability, budget binding, normalization accounting, token-consumption, boundedness, and module
structure findings are mandatory in-scope fixes before Phase 2 may close.
**Evidence:** The Phase 2 design defines candidate payload and reusable candidate-token authority,
while Phase 3 tasks 3.2.1–3.2.6 explicitly introduce route adapters, controls, sequence attempts,
terminal placement, and isolation. The original task text incorrectly claimed both sets at Phase 2
completion. Independent correctness, semantics, and performance reviews also proved the current
implementation can mint unrelated historical authority, accept unresolved candidate paths, choose
the wrong deterministic reducer path, bypass policy/token sequencing, and exhaust memory before
budget charging.
**Rejected alternatives:** Marking absent Phase 3 execution behavior complete would make the plan
false; implementing the entire execution/confirmation layer in Phase 2 would violate dependency
ordering and the immutable Phase 3 specification-first gate; deferring fail-closed and boundedness
repairs would leave Phase 2's delivered reducer unsafe.
**Strongest counterargument:** Defining execution, control, and sequence data types in Phase 2 could
make the later package easier to implement. The current envelope retains digests, not the canonical
fixture and fresh semantic/oracle bytes needed to populate those types truthfully; defining an
unconstructable authority earlier would invite fabrication rather than reduce Phase 3 risk.
**Confidence:** High — the boundary follows the named Phase 3 tasks and preserves every approved
RD-05 behavior.
**Hardening:** Two independent semantic/correctness reviews and a performance audit converged on
the same missing authority boundary and fail-closed defects; the ruling chooses the smallest phase
correction that leaves no claimed behavior unowned.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-resume`
**Reopen trigger:** A Phase 3 specification proves that route/control/sequence authority cannot be
implemented without changing the Phase 2 candidate payload or its authenticated identity.

### AR-P22 — Current parent publication lifecycle (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Test-fixture authority and lifecycle sequencing inside the already approved
content-bound publication design; no production publication is selected or pushed.
**Objective:** Keep Phase 2 historical and current publication tests truthful after readiness source
changes invalidate the selected RD-04 release, without performing Phase 6 review and selection early.
**Decision:** Isolated tests retain the immutable four-binding historical base and deterministically
prepare the five current oracle bindings into parent
`sha256:e65b95cdc817a6b2608d6965855ca1013f36b7893424d31d2f04fd18fa0845a5`.
The selected RD-04 nine-binding release remains historical evidence and is not treated as executable
under current source. Real child review, acceptance, and atomic selection remain owned by Phase 6.
The regenerated execution catalog and local VICE goldens bind the current source identities while
preserving binary bytes, layout, cycles, and target-visible results.
**Evidence:** Current source-derived oracle revisions are fresh, generated execution bindings pass
their freshness check, the isolated parent reproduces byte-for-byte, and real ACME/VICE acceptance
is green. Selecting a production release now would bypass the plan's later semantic review and
two-checkpoint lifecycle.
**Rejected alternatives:** Early production reselection violates phase ordering; weakening freshness
or presenting the stale nine-binding release as current falsifies authority; fabricating a current
release from old bytes defeats the content-derived identity contract.
**Strongest counterargument:** A test-only parent differs from the eventual nine-binding production
child. The fixture intentionally proves current five-binding oracle authority only; Phase 6 remains
responsible for the complete reviewed child and therefore cannot inherit this parent as selection
evidence.
**Confidence:** High — the separation matches the existing publication lifecycle and keeps every
authority claim content-derived.
**Hardening:** Exact generated-binding freshness, deterministic isolated publication, and real local
ACME/VICE acceptance converged on the same lifecycle boundary.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-resume`
**Reopen trigger:** Phase 3 requires a currently selected execution parent before Phase 6, in which
case the plan must explicitly move review and selection forward rather than weakening freshness.

### AR-P23 — Phase 2 re-review integrity and boundedness (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correctness, semantic and performance repair inside the approved malformed-ingress,
candidate-authority and deterministic-reducer boundary; no user-visible language or publication
scope changes.
**Objective:** Close the final independent re-review findings while keeping Phase 3 able to consume
the terminal reduction result without rebuilding or fabricating authority.
**Decision:** Raw required claims must equal the source rule exactly; both observation union arms
must digest-bind their retained bytes; malformed replay text must be well-formed Unicode at ingress,
history and direct identity derivation; and every supplied trace entry must match its private
predecessor chain. A completed session exposes one terminal-only candidate-authority operation bound
to its final trace, while Phase 3 still owns route execution, controls, isolation and confirmation.
Catalog descriptor preparation consumes the authenticated transformation budget before applying or
validating a candidate, typed descriptor discovery is capped by that budget, compatibility
inspection APIs are bounded by descriptor and aggregate source-byte work, and reducer-private
identity/trace checks use retained state instead of cloning complete source payloads.
**Evidence:** Correctness re-review reproduced raw-claim and trace-prefix substitution; semantic
re-review additionally reproduced lone-surrogate digest aliasing, not-reached evidence substitution
and the absent terminal authority handoff; performance re-review measured unbounded total catalog
materialization, eager typed allocation, duplicate proposal preparation and multi-gigabyte private
clone costs at allowed limits. Focused hostile tests now cover each counterexample and the frozen
specification oracle remains byte-identical.
**Rejected alternatives:** Deferring the findings leaves minted-but-unusable envelopes and permits
authority substitution; moving confirmation into Phase 2 violates the specification-first phase
order; rejecting all large candidate inputs would turn an implementation convenience into a user-
visible failure instead of returning deterministic campaign exhaustion.
**Strongest counterargument:** A terminal authority in Phase 2 anticipates a Phase 3 consumer. It is
the already-approved reusable candidate authority over the reducer's final genuine state, not a new
execution or confirmation authority, and prevents Phase 3 from reconstructing an opaque capability
from passive bytes.
**Confidence:** High — every change is the smallest closed repair for a reproduced counterexample
and preserves the existing phase boundary.
**Hardening:** Independent correctness, semantics and performance re-reviews converged on the same
authority and boundedness seams; all critical/major findings are resolved in scope.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-resume`
**Reopen trigger:** Phase 3 cannot consume the terminal authority without changing its candidate or
trace identity, or an allowed candidate can perform unmetered work above the inspection/campaign
bounds.

### AR-P24 — Phase 3 callable authority protocol (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal capability, lifecycle and implementation-blind test interfaces inside the
approved candidate execution, isolation and confirmation behavior; no product, retention, public
compatibility or scope decision changes.
**Objective:** Make every Phase 3 oracle executable through genuine authority while keeping handler,
worker, path and isolation selection outside caller control.
**Decision:** Add one co-located production module, `failure-execution-internals.ts`, that opens an
opaque protocol session only from a genuine selected parent, execution context, ordinary route and
failure envelope. Session-bound WeakMap operations mint the three fixed isolation modes, genuine
known-good control authority, attempt/position authority and authenticated path-free execution
observations; they own shutdown and reject copied, foreign, replayed, stale or cross-mode values.
The sequence state machine issues its own next position and rejects case 65 before recording any
launch checkpoint. A package-private report-sidecar accessor returns only the exact ordered
handler-minted collection retained beside a genuine report. The module is not exported by the root
barrel or package manifest. A second opaque session/step pair is the sole binder between genuine
standalone, control and sequence evaluations and the final confirmation disposition; the public
`confirmReducedFailureV1` drives that same state machine internally, while the co-located oracle can
step it without injecting execution behavior. Fixed co-located scenario fixtures replace only true
worker/process adapter modules in a fresh test module graph before genuine context resolution; they
run independent worker threads/subprocesses and never replace the fixed handler chain or enter a
caller-facing API.
**Evidence:** Candidate invocation creation/consumption already uses purpose-bound WeakMap authority;
live execution contexts already retain fixed handler tables behind genuine review/published
contexts; authority reports already separate private WeakMap authenticity from unchanged serialized
bytes; and all Phase 3 specifications are co-located in the execution package. The first independent
spec-author dispatch proved that the earlier prose-only mint/lifecycle descriptions were
insufficient to stage success and hostile cases without guessing.
**Rejected alternatives:** Exporting an internal package subpath is viable but lets every workspace
consumer import mechanism APIs; a second public coordinator duplicates the existing orchestration
state machine and makes hostile capability substitution less direct; widening the root API exposes
lifecycle machinery solely for test convenience.
**Strongest counterargument:** Package-private operations cannot support an immutable specification
owned by another package. Phase 3's oracle is intentionally co-located, while later public workflow
tests use the root create/execute/confirm APIs and do not need the mechanics.
**Confidence:** High — the selected seam matches current authority patterns and is the narrowest
interface that makes every approved Phase 3 behavior independently observable.
**Hardening:** An independent challenger rejected all three initial candidates as stated and
strengthened the internal-subpath option into a non-exported module-private protocol session; the
ruling adopts that tighter boundary with closed result types and path-free observations.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A required Phase 3 oracle must execute from outside the package, the genuine
fixed handlers cannot report root/worker/isolate checkpoints without exposing a caller-selected
execution dependency, or the shared confirmation machine cannot classify every approved outcome
from handler-authenticated evaluations alone.

### AR-P25 — Phase 3 fixture observation authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting contradictory specification-fixture evidence inside the already approved
Phase 3 oracle; production validation, product behavior and scope remain unchanged.
**Objective:** Restore a truthful join between the fixture's named observation predicate and the
observation bytes authenticated by the failure envelope after the initial RED stopped before fixture
construction and therefore failed to exercise that join.
**Decision:** Retain the authored `failure-observation` meaning and derive both its predicate digest
and envelope bytes from one shared label. The envelope receives the exact 19 UTF-8 bytes for that
label. The specification file stays byte-identical; the corrected fixture and the other two support
fixtures join it in a newly frozen four-file oracle-bundle hash.
**Evidence:** Envelope authorization correctly requires the predicate observation digest to equal
the SHA-256 digest of the supplied bytes. UTF-8 encoding of the ASCII label produces the same digest
preimage as the fixture helper and was verified directly. The previous empty byte array contradicted
the predicate and was rejected before any Phase 3 production operation ran.
**Rejected alternatives:** Replacing the named observation with the empty-byte digest discards
authored semantic evidence to accommodate an accidental placeholder; weakening envelope validation
would admit false historical authority and violate the approved security boundary.
**Strongest counterargument:** Confirmation currently classifies reproduction from status, code,
tier and stage, so empty observation bytes would not change that result. That does not make an
authenticated predicate/byte contradiction truthful and would optimize the oracle around an
implementation detail.
**Confidence:** High — the correction is a single-source derivation of the fixture author's existing
meaning and leaves production authority checks untouched.
**Hardening:** Independent design challenge selected the same correction, required a complete
transitive-oracle bundle freeze, and rejected both semantic erasure and production weakening.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The corrected fixture cannot construct genuine envelope authority, or future
predicate evaluation requires different observation bytes for this scenario.

### AR-P26 — Phase 3 fixture module graph (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting test setup order so approved opaque authority semantics are exercised in
one module registry; production behavior, expectations and scope remain unchanged.
**Objective:** Ensure every fixture authority is consumed only by APIs loaded in the same module
epoch after controlled worker/process adapter installation resets the Vitest module graph.
**Decision:** In every scenario and every sequence-loop iteration, construct the fixture first and
then load the API set immediately afterward. No intervening fixture creation or reset may occur.
Keep all 14 expectations unchanged and retain strict WeakMap-backed production authority checks.
**Evidence:** The fixture installs controlled true-external adapters with `vi.resetModules()` before
constructing its genuine parent, execution, origin and candidate. APIs loaded before that reset
necessarily reference a different private registry and correctly reject the fresh candidate.
**Rejected alternatives:** Accepting cross-registry authorities defeats the capability boundary; a
combined fixture/API loader is viable but expands support interfaces and changes every call shape
when a mechanical ordering correction restores the intended single-epoch semantics.
**Strongest counterargument:** Repeated temporal ordering can regress. A durable invariant comment
now sits beside the fixture wrapper, each loop reloads APIs inside its fixture epoch, and the complete
bundle hash detects later drift.
**Confidence:** High — the correction follows the existing adapter-install lifecycle and preserves
the exact security behavior the hostile oracle is meant to prove.
**Hardening:** Independent design challenge selected the same per-epoch ordering, explicitly rejected
production weakening, and required a new complete-bundle freeze because the specification bytes
changed.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any scenario creates or resets a fixture between API loading and authority use,
or same-epoch genuine authorities remain unavailable.

### AR-P27 — Phase 3 raw fixture authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting raw specification inputs to the already approved raw-malformed,
invalid-diagnostic and strict UTF-8 contracts; production behavior and test expectations remain
unchanged.
**Objective:** Make the empty raw envelope and nonempty raw projection cases exercise genuine raw
authority instead of contradicting Phase 1/2 validation.
**Decision:** The empty case explicitly derives an `invalid-diagnostic` predicate with
`diagnostic.malformed-source` as its primary and sole required claim, hashes its exact empty
observation bytes, and hashes its exact JSON route-plan bytes. The projection-only nonempty case uses
UTF-8 `@`, retaining an exact unknown-token byte span and malformed-language meaning without
introducing invalid encoding.
**Evidence:** Envelope authorization requires source family and original route kind to agree, rule
claims to match, observation digest to bind exact bytes, and route-plan digest to bind exact bytes.
Malformed ingress separately requires complete strict UTF-8, an invariant already verified and
accepted in Phase 2. Both prior inputs failed before Phase 3 routing.
**Rejected alternatives:** Reusing the typed-valid predicate fabricates route authority; a hardcoded
route digest does not bind its bytes; weakening strict UTF-8 reopens an explicitly closed Phase 2
contract; moving this single semantic construction into shared fixture support hides the normative
raw differences.
**Strongest counterargument:** The projection-only case originally used visibly invalid bytes. Its
asserted purpose is raw zero/nonzero separation without typed IR, not encoding rejection; `@` keeps
that exact purpose while respecting the separately tested ingress boundary.
**Confidence:** High — every corrected field derives from the exact authority bytes it claims.
**Hardening:** Independent design challenge required an allowlisted predicate construction, exact
observation/route hashing, valid malformed-language UTF-8, unchanged production validation, and a
superseding complete-bundle freeze.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Either corrected raw case still fails before its intended assertion, or raw
execution requires a route contract not represented by the approved invalid-diagnostic arm.

### AR-P28 — Phase 3 external fixture entrypoints (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting true-external test runtime paths inside the approved fixture architecture;
production worker/process behavior, crash classification and package API remain unchanged.
**Objective:** Execute the fixture's intentional pass/crash outcomes in real Node workers and
subprocesses instead of accidentally treating missing source-relative JavaScript as a scenario crash.
**Decision:** Resolve both entrypoints from `../../dist/test-fixtures/`, whose JavaScript is produced
by the package's mandatory build-before-test scripts. Keep TypeScript sources authoritative and add
no loader, source-side JavaScript duplicate, conditional fallback or package export.
**Evidence:** The source tree contains only `.ts` entries, both compiled `.js` files exist under
`dist/test-fixtures`, and exact tracing proved ordinal two selected `pass` before its Worker failed to
load the absent source-relative path. Standalone crash scenarios had masked the same defect.
**Rejected alternatives:** A TypeScript runtime loader diverges from production execution and adds
configuration; committed JavaScript wrappers duplicate generated code; package subpaths widen API
solely for tests; treating module-load failure as an intentional crash falsifies scenario evidence.
**Strongest counterargument:** Direct `vitest` without a build can now fail. The package's `test` and
coverage paths already run `tsc --build`, making compiled entry availability an explicit enforced
contract rather than an implicit fallback.
**Confidence:** High — both source and compiled import locations resolve the same package-local dist
entries, and no production byte or decision changes.
**Hardening:** Independent design challenge selected the dist path, rejected loader/duplicate/export
alternatives, required both worker and subprocess correction, and required a new bundle freeze.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A build-before-test run cannot load either compiled entry, intentional pass
ordinal still crashes before response, or subprocess activity cannot be observed through the entry.

### AR-P29 — Phase 3 sequence oracle time bound (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting one specification-test watchdog from measured genuine-fixture cost;
production behavior, fixture independence, cases, expectations and package-wide timeouts remain
unchanged.
**Objective:** Let the complete positions 2–9, 64 and pre-launch 65 matrix reach semantic assertions
without allowing unrelated package tests to hide behind a larger hang threshold.
**Decision:** Set only this test's timeout to 900,000 ms. Ten independent fixtures at the measured
60-second upper setup cost require about 600 seconds; a bounded 1.5 multiplier covers scheduling,
process launch and teardown variance while retaining a finite watchdog.
**Evidence:** The unchanged test stopped at the global 240,000 ms boundary before an assertion, which
can cover only about four measured fixtures. Named genuine fixture cases consistently take 53–60
seconds, and this test intentionally owns ten distinct publication/module epochs.
**Rejected alternatives:** A global timeout increase weakens hang detection across the package;
sharing fixtures or dropping positions violates authority independence and boundary coverage;
fixture-performance redesign is broader than the correctness gate and could change what is tested.
**Strongest counterargument:** A genuine deadlock now takes up to 15 minutes to report. The exception
is case-local, the healthy measured ceiling is about ten minutes, and approaching 15 minutes is an
explicit investigation trigger rather than permission to raise it again.
**Confidence:** High — the bound follows directly from measured fixture count and cost.
**Hardening:** Independent design challenge derived the same 900-second case-local limit, rejected
global/coverage changes, and required a superseding complete-bundle freeze.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A healthy named run approaches 900 seconds, times out again, or any fixture or
sequence expectation is removed to reduce runtime.

### AR-P30 — Ordinary report-sidecar ownership (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Completing the already approved private report-sidecar integration and clarifying
data ownership; RD-04 wire bytes, product behavior and package dependency direction remain unchanged.
**Objective:** Capture stable authenticated predicate inputs for every ordinary report result before
unchanged aggregation loses provenance, without fabricating a failure predicate for pass or
non-executed routes.
**Decision:** Use a private three-arm evidence union: candidate results retain the complete historical
predicate; executed ordinary results retain only validated stable route/outcome/predicate-basis
facts, with an explicit pass basis; non-executed tier-unavailable, injected-substitution and caught-
compiler-ICE results use a closed orchestration-only arm. Exact result objects key the WeakMap.
Handlers register final executed results after cleanup; orchestration consumes that association or
alone mints a non-executed arm, preserves exact report order, and supplies the complete collection to
the authorizer before cloning. Readiness owns the data-only predicate-ingredients validator used by
the later Phase 5 envelope derivation.
**Evidence:** Ordinary reports contain passes and bypass branches that cannot possess a
`FailurePredicateV1`; the unchanged report bytes do not retain enough fixture/oracle/claim/result
provenance to reconstruct authority later. Existing exact-result sidecar state already rejects
equal-content substitution without a digest cache.
**Rejected alternatives:** Fabricating pass predicates is semantically false; deferral loses
unserialized authority and violates task 3.2.4; adding fields to RD-04 reports breaks compatibility;
digest-keyed caches permit aliasing/replay; deriving everything in orchestration bypasses the
required handler-origin evidence for executed routes.
**Strongest counterargument:** The ordinary evidence resembles route/result structures. Its schema
is restricted to predicate derivation inputs, excludes usage/timing/retained sizes/messages, and
centralizes validation in readiness to prevent an open-ended shadow report.
**Confidence:** High — the union matches every report branch without inventing failure semantics.
**Hardening:** Independent design challenge specified the three arms, exact stable fields, handler
and orchestration ownership, pass/non-executed treatment, fail-closed consumption, and ruled that no
Phase 3 integration point is deferrable.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any report position lacks one exact sidecar, an executed result reaches
orchestration without handler registration, or Phase 5 cannot derive a full predicate from retained
ordinary/non-executed ingredients plus its genuine join authorities.

### AR-P31 — Non-executed pass substitution evidence (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Closing one discriminator edge inside the approved private sidecar union; report
bytes, execution results and failure-predicate semantics remain unchanged.
**Objective:** Authenticate injected PASS substitutions as non-executed results without fabricating
non-pass predicate ingredients or dropping their provenance.
**Decision:** The `closed-non-executed` arm retains its closed disposition and carries the same
explicit predicate-basis union as ordinary evidence: either `pass` or validated
`failure-ingredients`. PASS substitutions use only the pass basis; failing substitutions and caught
failures carry the non-pass ingredients required for later derivation.
**Evidence:** Existing orchestration conformance deliberately injects PASS results for most routes,
while `FailurePredicateV1` and its data-only ingredients exclude pass by contract. The sidecar must
still distinguish that result from handler execution and preserve exact report order.
**Rejected alternatives:** Fabricating a failure predicate contradicts the result; omitting the
sidecar breaks the one-to-one association and loses non-execution provenance; widening failure
ingredients to pass weakens the closed failure identity throughout readiness.
**Strongest counterargument:** Two sidecar arms now share one small basis union. Reuse is intentional:
the arm discriminator records whether a handler executed, while the basis records whether the exact
result passed or supplied derivable failure evidence.
**Confidence:** High — the two orthogonal discriminators represent every existing orchestration
branch without changing public or serialized data.
**Hardening:** The demanding executor exposed the contradiction before implementation; the ruling
preserves the independently challenged three-arm design and the existing non-pass predicate
contract.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any PASS non-executed result requires fabricated failure ingredients, lacks an
exact sidecar, or becomes indistinguishable from a genuinely executed handler result.

### AR-P32 — Stable confirmation control contradiction (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting controlled fixture behavior to satisfy the already approved confirmation
contract; the frozen expectation and production classification remain unchanged.
**Objective:** Prove two stable source-bound reproductions plus a genuinely passing same-route
known-good control without treating a control-wide compiler crash as source confirmation.
**Decision:** Keep the production decision table unchanged. Correct `standalone-stable` so both
fresh candidate identities reproduce the same authenticated compiler-ICE predicate and the distinct
genuine control identity passes, using the fixture's existing candidate-versus-control identity
distinction. Exact candidate reproduction plus a passing control confirms; any same or different
control failure remains flaky and campaign-only.
**Evidence:** RD-05 and the Phase 3 design explicitly require the known-good control to pass for
compiler-ICE and infrastructure-like failures. The frozen oracle expects confirmation, but the
fixture returned `crash` for every route, contradicting that prerequisite. Production already
implements the required pass-only gate.
**Rejected alternatives:** Accepting the same control failure cannot isolate the source from shared
infrastructure; changing the frozen expectation would weaken an approved requirement; adding a
hidden production marker would classify identical authenticated observations differently.
**Strongest counterargument:** The corrected stable fixture resembles the explicit
infrastructure-with-passing-control scenario. That equivalence is required because their
authenticated candidate/control outcomes are equivalent; their tests retain distinct isolation and
control-branch obligations.
**Confidence:** High — requirements, design, testing strategy and current production all agree on
the pass-only control rule.
**Hardening:** An independent challenger reviewed the frozen oracle, fixture, requirements, design
and implementation and selected fixture correction with no production semantic change.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A source failure confirms when its genuine control fails, the corrected fixture
cannot distinguish candidate and control through authenticated identities, or hostile control
substitution reaches classification.

### AR-P33 — Candidate content and authority identity (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Restoring the deterministic candidate identity already required by Phase 2 while
retaining Phase 3's separately declared execution identity; no public field or authority mechanism
is added.
**Objective:** Let equal envelope/content/trace reductions compare byte-identically and still route
distinct authority instances under non-aliased subject identities.
**Decision:** `candidateDigest` hashes only stable semantic candidate inputs and is equal for equal
envelope, content and trace. `candidateExecutionIdentity` additionally hashes the authority ordinal
under its own domain and is distinct per authority instance. Correct the Phase 3 oracle to compare
the execution identities rather than demanding unequal content digests.
**Evidence:** The frozen Phase 2 reducer requires a retained terminal authority to match
`completed.best.candidateDigest` and repeated reductions to remain deterministic. Phase 3 already
declares and uses `candidateExecutionIdentity` at every candidate route and VICE subject seam.
Including the ordinal in both identities duplicated roles and broke deterministic reduction.
**Rejected alternatives:** Keeping a unique content digest corrupts equality and terminal handoff;
adding a third content field renames the established Phase 2 meaning and duplicates the existing
execution identity; weakening Phase 2 would make deterministic replay impossible.
**Strongest counterargument:** Authority-specific candidate digests simplify logs and caches. Those
consumers should use the explicit execution identity, or the pair of content and execution
identities, instead of changing semantic content identity.
**Confidence:** High — the split aligns existing fields with their names, current route usage and
both phases' intended invariants.
**Hardening:** An independent challenger reviewed both frozen oracles, derivation and route uses and
selected deterministic content plus instance-specific execution identity. WeakMap/session binding
and single-use tokens remain the bearer authority; neither digest grants authority.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Equal semantic candidates produce unequal content digests, distinct authorities
alias one execution identity, or a copied digest alone authorizes execution.

### AR-P34 — Deterministic result versus terminal authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting the result projection boundary exposed by AR-P33 while preserving the
existing terminal-authority API and frozen deterministic-result contract.
**Objective:** Keep complete reduction results byte-deterministic without leaking per-authority
execution identity into passive result data.
**Decision:** Introduce a deterministic content projection containing every stable candidate field
except `candidateExecutionIdentity`. `FailureReductionResultV1.best` uses that content projection.
The full candidate projection retains a required execution identity and is available only through
the genuine terminal authority and its existing getter.
**Evidence:** Phase 2 compares complete repeated reduction results byte-for-byte. Phase 3 never
routes from `result.best`; it retrieves and consumes the separate terminal authority. The current
full projection in `best` therefore exports non-deterministic instance state that no valid execution
caller needs.
**Rejected alternatives:** Weakening deterministic equality breaks replay; making execution identity
optional hides which semantic object a caller holds; normalizing it to the content digest aliases
distinct authority instances and defeats AR-P33.
**Strongest counterargument:** Returning the full projection is convenient for immediate routing.
That convenience encourages callers to mistake a string for authority; the already planned terminal
getter is the safe and genuine handoff.
**Confidence:** High — the type split matches current consumers and preserves both deterministic
data and instance-specific execution.
**Hardening:** An independent challenger reviewed the result type, terminal getter, Phase 2 oracle,
Phase 3 routing and plan and selected the content-only result boundary. No wire or current Phase 3
caller consumes the removed result property.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Passive result equality depends on authority-instance order, a caller needs to
execute from `result.best`, or the terminal getter loses its required execution identity.

### AR-P35 — Sequence coverage watchdog (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Restructuring one frozen timing container while preserving every sequence position,
expectation, fixture authority and production behavior.
**Objective:** Keep each independent sequence epoch bounded and diagnosable under both ordinary and
required V8 coverage execution.
**Decision:** Replace the ten-epoch monolithic test with a sequential parameterized matrix for
positions 2–9 and 64 plus a separate pre-launch 65 case. Each case owns its genuine fixture/module
epoch and a 300-second watchdog. Coverage configuration and global timeouts remain unchanged.
**Evidence:** Ordinary execution passed the full matrix, while V8 coverage made the monolith reach
its 900-second watchdog. Instrumented individual fixture cases measured 100–146 seconds; 300 seconds
is more than twice the slowest observation and reports the exact hung position.
**Rejected alternatives:** A 30-minute monolithic timeout delays localization; a coverage-only branch
makes oracle behavior environment-dependent; raising global timeout weakens unrelated tests;
coverage exclusion removes the required semantic and branch exercise.
**Strongest counterargument:** Splitting changes scheduling around module resets. An explicit
sequential suite preserves non-concurrency, and per-test cleanup improves isolation over ten resets
inside one callback.
**Confidence:** High — all semantic statements are retained one-for-one with stronger boundedness.
**Hardening:** An independent challenger reviewed the matrix, coverage configuration, measured
timings and alternatives and selected ten independently bounded sequential cases.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any semantic position is dropped, split cases run concurrently, a healthy
instrumented case approaches 300 seconds, or coverage requires a special oracle branch.

### AR-P36 — Phase 3 quality-review authority closure (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal authority, validation, concurrency, cleanup, compatibility and testing
mechanisms inside the approved Phase 3 behavior and modification set. The ruling changes no product
scope, retention policy, report bytes, compiler behavior, CLI/API promise or external system.
**Objective:** Close RV-001–RV-004, SR-001–SR-009 and PE-001–PE-002 without waiving any risk, while
preserving exact historical authority, bounded execution and the unchanged serialized report.
**Decision:** Introduce one opaque, subject-bound confirmation-context authority minted only after a
complete normally authorized report and its exact ordered private provenance are joined. The context
binds the exact report occurrence, historical envelope, candidate authority, complete route contract,
route-plan identity, handler/tool authority, selected budget, ordered preceding genuine requests and,
only for `fresh-confirm` result classes, a distinct genuine same-route known-good control. Protocol
opening consumes this context rather than loose or first-match inputs. Exact reproduction compares the
complete authenticated predicate projection and byte-equal normalized observation; direct-shrink
classes do not enter confirmation, while every fresh-confirm class requires a passing control.
Sequence discovery runs for every failed two-run confirmation, replays each exact originating
occurrence, charges both `sequence-case` and route execution before each launch, respects the selected
limit capped at 64, and consumes an opaque evaluation bound to its exact context, attempt, position and
subject. Each position stores only its own checkpoints. Predicate/report projections are deeply
immutable or defensively copied, sidecar-only assembly never gains serialization authority, and only
the complete RD-04 report enters the serializer registry. Candidate VICE preparation receives the
isolation-owned worker. Shutdown attempts every owned executor, closes authority regardless of an
individual rejection, and returns deterministic aggregate cleanup failure after all attempts settle.
Restore all missing public JSDoc and remove the unused session input type.
**Evidence:** Correctness and semantics reviewers reproduced confirmation of a different observation,
use of the historical failing case as its own control, incomplete route/tool/candidate joins,
foreign authenticated sequence-result acceptance, stale shared position checkpoints, nested sidecar
mutation and partial-report serialization. Performance review proved candidate VICE bypassed its
dedicated worker and one rejected shutdown leaked later pools. The current global source-route registry
selects the first tier/obligation match and cannot prove report occurrence or ordering.
**Rejected alternatives:** Widening the loose protocol input with independent arrays and requests is
technically viable but multiplies invalid combinations and repeats joins across confirmation and Phase
5. Lazy global derivation cannot disambiguate duplicate genuine routes, module resets or stale
registries. Deferral or waiver is forbidden because every finding violates an existing Phase 3
requirement and would contaminate Phase 4 promotion authority.
**Strongest counterargument:** A context joining report, candidate, control, routes, tools and budget can
become an oversized capability. Keep it opaque and subject-specific, retain only validated references or
deeply immutable projections, and expose narrow confirmation/sequence operations rather than a general
inspector.
**Confidence:** High — the design validates the cross-domain join once, matches the existing Phase 5
orchestration seam, and gives hostile tests one exact substitution boundary. Reopen if a complete report
cannot supply ordered route occurrences or genuine same-route control authority without adding public
surface.
**Hardening:** Independent challenger selected the subject-bound context variant, rejected loose and
global derivation, and required an AR-recorded oracle correction for the missing counterexamples.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any confirmation accepts a partial predicate, original-as-control, ambiguous/current
fallback, foreign position result, uncharged sequence case, mutable sidecar, partial serializable report,
global VICE worker, or shutdown path that leaves later owned executors unattempted.

### AR-P37 — Exact observation and aggregate shutdown evidence (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Private evidence representation, resource bounding and deterministic internal error
reporting inside the already approved exact-confirmation and cleanup behavior.
**Objective:** Prove literal normalized-observation byte equality without changing report bytes or
extending sensitive-data lifetime beyond the confirmation protocol, and make multi-executor shutdown
failure stable after every cleanup attempt settles.
**Decision:** Handler-minted private predicate evidence retains a defensive copy of the canonical
normalized observation bytes. Capture rejects bytes above the exact route policy's `evidenceBytes`
limit or the execution hard maximum, validates that their SHA-256 equals the authenticated observation
identity, never serializes or logs them, and releases references when the subject protocol closes.
Confirmation compares length and every byte against the historical envelope and between both fresh
runs; digest equality alone is insufficient. If one or more owned executor shutdowns reject, the
coordinator still settles every attempt and closes all protocol authority, then returns one stable
`execution.io` issue at `/isolation/shutdown` whose message contains only the failed-settlement count
and no underlying error text.
**Evidence:** The predicate currently stores only a digest while the envelope retains canonical
observation bytes; therefore direct byte equality is otherwise unprovable. Execution policy already
bounds evidence at 16 MiB maximum. Existing execution issue taxonomy includes `execution.io`, while
raw worker errors may be host-specific and unsafe to expose.
**Rejected alternatives:** Treating SHA-256 equality as byte equality changes the approved predicate
despite negligible collision probability. Re-running or reverse-resolving evidence is nondeterministic,
TOCTOU-prone or impossible. Returning the first shutdown error leaks host text and leaves later cleanup
unattempted; inventing a new public issue code is unnecessary.
**Strongest counterargument:** Retaining canonical observation bytes increases memory and sensitive-data
lifetime. Route-budget admission, defensive copies, private non-serialized ownership and protocol-close
release bound that cost and lifetime.
**Confidence:** High — no collision-free proof for arbitrary bounded byte strings avoids retaining an
injective representation, and the existing bytes are already present in the historical envelope.
**Hardening:** Independent challenger selected bounded private canonical bytes, rejected digest-defined
equality and reconstruction, and required copy/mutation, mismatch, length, bound and unchanged-report
tests.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Equality can pass with different canonical bytes, bytes exceed the route evidence
limit, private bytes enter reports/logs, shutdown returns before all owners settle, or host error text
escapes the stable aggregate issue.

### AR-P38 — Corrected oracle composite authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Fixture-only authority construction needed to exercise the already approved complete
report/context contract; production validation and behavior remain unchanged.
**Objective:** Let the corrected implementation-blind oracle build a genuine composite readiness
projection and report without accepting a parent-only snapshot at a child-authority boundary.
**Decision:** Resolve the catalog fixture's genuine published execution child, join that exact child to
the exact published parent through `resolveCompositeReadinessSnapshot`, derive the planner projection
from the composite, and use the corresponding genuine live execution context for campaign
orchestration. Preserve the full-report and report-position expectations unchanged.
**Evidence:** The fixture called `getCompositeReadinessProjectionV1(parent)` with a plain
`PublishedSnapshot`; production correctly rejects it. The catalog fixture already owns the exact child
release and digest. The earlier 28/28 missing-API RED stopped before this construction and therefore
masked the independent fixture defect.
**Rejected alternatives:** Weakening production would erase the load-bearing parent-child join;
fabricating a structural projection would bypass opaque authority; keeping review-candidate execution
while separately inventing a composite would split planner and executor authority.
**Strongest counterargument:** Published-context resolution adds fixture setup work. The fixture already
creates the child release, so reusing it is deterministic and avoids any new publication or selection.
**Confidence:** High — the exact parent and child are present in the fixture and the existing public
resolvers define the intended join.
**Hardening:** Only one viable authority-preserving path remains; the production rejection is direct
evidence and no new product decision is involved.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The fixture uses a parent-only projection, planner and executor derive from different
children, or any structural/caller-fabricated composite enters the corrected oracle.

### AR-P39 — Corrected oracle cleanup policy (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Fixture-only conformance to an existing closed execution-policy schema; no timeout,
product behavior or production validation changes.
**Objective:** Let the genuine full-report fixture reach its semantic assertions with the same canonical
cleanup budget accepted by every published execution route.
**Decision:** Change only the fixture's `cleanupGraceMs` from 1000 to the schema-required 3000. Preserve
all 28 oracle expectations, global/case watchdogs, route timeout and production policy validation.
**Evidence:** The genuine planner rejects the fixture at `/policy/budget/cleanupGraceMs`; the published
policy contract requires exactly 3000 and the earlier absent/stale authority gates masked this defect.
**Rejected alternatives:** Weakening production would admit noncanonical policies and alter route
identity; a fixture exception would stop exercising the genuine planner; changing test watchdogs is
unrelated.
**Strongest counterargument:** The fixture may run longer during cleanup. The value is only the canonical
cleanup ceiling and does not alter its explicit test watchdogs.
**Confidence:** High — this is a direct schema correction with one valid value.
**Hardening:** No independent challenge required; only one authority-preserving value satisfies the
existing closed schema.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The fixture needs a noncanonical cleanup grace, production policy is weakened, or an
oracle watchdog changes as part of this correction.

### AR-P40 — Corrected oracle terminal failure injection (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Fixture-only alignment of controlled external failure injection with the already
selected genuine route occurrence and terminal boundary; no production or expectation change.
**Objective:** Make each positions 2–9, 64 and explicit VICE fixture fail the exact published report
occurrence it names without turning a prerequisite stage into the terminal failure.
**Decision:** Retain the selected route's exact terminal tier. For frontend/compiler-api/cli/emit,
inject only when the worker request has the exact selected case identity, exact terminal tier and
intended occurrence. For ACME/VICE, let worker and earlier process prerequisites pass, carry the armed
exact occurrence into the matching terminal process adapter, and inject there. Never coerce a
non-VICE terminal to frontend and never accept an arbitrary same-case authenticated result.
**Evidence:** Public projection proves position 2 is a compiler-api terminal route with frontend as a
prerequisite; positions 2–9 use the same terminal shape. The fixture coerced all non-VICE routes to
frontend, so it crashed a prerequisite and the selected report occurrence remained pass. The test
matrix also names position 64 and an explicit VICE route, requiring one tier-complete mechanism.
**Rejected alternatives:** Frontend coercion changes the failure predicate and misses the selected
terminal occurrence; case-only matching can fail a prerequisite; weakening the report invariant would
accept evidence for the wrong route; separate position-specific hacks would not cover the fixed matrix.
**Strongest counterargument:** Process-terminal injection adds controlled fixture state. Binding that
state to exact case, occurrence and terminal tool keeps it narrower than the prior tier coercion.
**Confidence:** High — route projection identifies the exact terminal and prerequisites, and the
worker/process adapters are the fixture's only allowed external substitutions.
**Hardening:** Read-only diagnosis verified position 2 and the positions 2–9 vector through public
projections; the correction generalizes to the required position 64 and VICE cases without changing
production.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A prerequisite is classified as the terminal failure, selected occurrence passes,
different position/case fails, or ACME/VICE injection bypasses its genuine terminal adapter.

### AR-P41 — Corrected oracle route-occurrence counter (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Fixture-only correction to the occurrence counter used by the already authorized exact
terminal injection; no oracle expectation or production change.
**Objective:** Align the controlled fixture's one-based report/sequence position with the genuine live
handler's actual external-boundary schedule, including duplicate case identities.
**Decision:** Advance the controlled route occurrence exactly once on every worker-executor `start`,
because genuine orchestration emits one effective worker request per route occurrence. Match worker
terminal failure by occurrence, exact case identity and exact worker tier. For ACME/VICE routes, the
emit worker start advances/arms the occurrence and the controlled process ordinal selects ACME first or
VICE second. Never infer position from frontend-only requests or case-identity changes.
**Evidence:** Transient diagnostics, reverted after capture, show report position 2 passed at
compiler-api while the controlled mock received the exact position-2 case and compiler-api request.
Positions 1–11 emitted compiler-api requests and no frontend requests, so the frontend-only counter
never advanced. The report emitted one worker request per route and 24 process starts.
**Rejected alternatives:** Frontend-only counting assumes prerequisite execution the live handler does
not perform; repeated-case detection aliases distinct positions; changing expected position would stop
testing the authenticated report order.
**Strongest counterargument:** A future handler may emit multiple worker starts per route. The fixture is
bound to the current published handler contract; such a change invalidates the one-request evidence and
must reopen this ruling rather than silently shifting positions.
**Confidence:** High — the controlled boundary trace directly identifies the schedule and exact subject.
**Hardening:** Diagnostic evidence distinguished adapter injection from occurrence accounting without
retaining any instrumentation or changing the frozen oracle.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A route emits zero or multiple worker starts, process ordering changes, occurrence
count diverges from report positions, or duplicate case identities alias one position.

### AR-P42 — Envelope materialization from private report provenance (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Package-private authority plumbing inside the approved report-position, envelope and
future orchestration boundary; no public API, retention policy, report bytes or product behavior change.
**Objective:** Break the report→envelope→candidate→confirmation-context bootstrap cycle while keeping
canonical observation bytes and every loose envelope field hidden from callers.
**Decision:** Add `authorizeFailureEnvelopeFromReportPositionV1(position, policy)` only to the existing
`failure-execution-internals.ts` seam. It resolves a genuine WeakMap-backed non-pass position, derives
source authority, exact report-wide route-plan bytes/digest, complete predicate, private bounded
canonical observation bytes and complete tool identities internally, calls readiness's existing
`authorizeFailureEnvelopeV1`, and returns only opaque `AuthorizedFailureEnvelopeV1`. Store report-wide
route-plan bytes and tool identities once in private provenance and reference them from positions.
Forged/copied/foreign/pass positions, missing private bytes, incomplete route/tool provenance or invalid
policy fail closed. No DTO or raw-byte accessor is exposed.
**Evidence:** Context construction needs both an origin envelope and a candidate derived from it, so
envelope authorization must precede context and depend only on report position plus policy. The
readiness envelope constructor already owns exact source, digest, predicate, observation, policy and
tool validation. Execution already depends on readiness; reversing the dependency is forbidden.
**Rejected alternatives:** A raw-byte accessor splits authority and lets callers recombine bytes with
the wrong source/predicate/route/tools while extending sensitive-data lifetime. Fixture reconstruction
cannot prove handler-origin evidence and digest equality was rejected by AR-P37. Moving envelope minting
into readiness would require a reverse dependency on execution-private provenance.
**Strongest counterargument:** The bridge couples execution-private provenance to the readiness envelope
schema. Keep it focused, two-argument and package-private; share report-wide facts and leave all
canonical validation in readiness.
**Confidence:** High — the opaque position is the earliest complete authority and the returned envelope
is the exact existing authority needed by the candidate reducer.
**Hardening:** Independent challenger selected the narrow position-to-envelope bridge, rejected raw-byte
and reconstruction paths, and required fail-closed provenance tests with no observation-byte exposure.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Phase 5 must authorize outside readiness-execution, callers receive raw observation
bytes/loose inputs, report-wide provenance is copied per position without bounds, or a pass/foreign
position mints an envelope.

### AR-P43 — Valid foreign mismatch envelopes (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Fixture-only construction of already-required negative authorities plus focused
implementation coverage; no public API, production behavior, frozen expectation or byte-retention
change.
**Objective:** Let confirmation-context tests receive valid opaque foreign authorities for every named
mismatch without exposing or reconstructing the selected report position's canonical observation
bytes.
**Decision:** Keep the primary origin on AR-P42's report-position bridge. Build each negative origin
through readiness's existing envelope authorizer from one closed, self-consistent foreign tuple:
fixture-owned bounded canary observation bytes and their exact digest, exact route-plan bytes and
digest, a predicate whose complete route contract matches the supplied plan/tool facts, and one
complete tool identity for every contract digest. Assert through public projections that authorization
succeeded and the intended semantic axis differs before using the authority. Derive the foreign
candidate from one such valid foreign origin. The specification's 28 expectations remain unchanged;
focused implementation tests retain exact individual comparison-branch coverage where a private
selected-report byte prevents a single-field fixture mutation.
**Evidence:** The current report contains only one non-pass position, so its other positions cannot
mint envelopes. Extra live reports would add several 100–146 second executions to nearly every
fixture epoch and fixed catalog tool identities cannot reliably create an isolated live tool variant.
The envelope constructor already validates exact observation, route-plan and tool self-consistency,
so a successfully authorized canary tuple is a genuine opaque readiness authority even though it is
foreign to the selected report.
**Rejected alternatives:** Existing pass positions fail closed at AR-P42 and cannot supply foreign
origins. Multiple controlled reports add prohibitive oracle runtime and still cannot isolate every
fixed-catalog field. A raw-byte accessor or test-only opaque-envelope mutation backdoor would weaken
the production authority boundary solely for tests.
**Strongest counterargument:** Several fields can co-vary, so the specification alone cannot prove
which private comparison caused the common `historical-authority-unavailable` result. Public
projection assertions must prove every intended mismatch, comments must not claim single-field causal
attribution, and implementation tests must exercise each individual comparison branch.
**Confidence:** High — this preserves the negative boundary, byte privacy and bounded test runtime;
the independent challenger selected this option after rejecting pass positions and extra reports.
**Hardening:** Independent challenge verified the readiness constructor's exact byte/plan/tool joins
and required successful authorization plus explicit semantic mismatch checks before context rejection.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A requirement demands every negative authority originate in a live execution
report, public projections cannot establish its named semantic mismatch, or implementation tests do
not retain isolated coverage of every private comparison branch.

### AR-P44 — Foreign tool identity contract (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Completes an omitted planned type signature and normalization rule for an existing
closed envelope field; no production behavior, public surface or frozen expectation change.
**Objective:** Give the implementation-blind oracle enough specified information to construct and
diagnose a valid nonempty foreign tool tuple without inspecting production code.
**Decision:** Define `FailureToolIdentityV1` as the exact enumerable four-field record `{ kind, name,
version, digest }`, where `kind` is `compiler | assembler | emulator`, `name` and `version` are bounded
stable execution identifiers, and `digest` is the complete tool-contract SHA-256. Tool identities are
duplicate-free and normalized by their complete identity. Envelope authorization compares the sorted
list of identity `digest` values for exact equality with the predicate route contract's already sorted,
duplicate-free `toolContractDigests`; there must be exactly one supplied identity per required digest
and no extra digest. The digest is the named contract identity, not recomputed from name/version.
**Evidence:** The plans already require complete tool authority and a closed tool list but referenced
`FailureToolIdentityV1` without declaring its shape. The canary envelope's other four mismatch tuples
authorize; only the nonempty tool tuple remains blocked at the exact digest-set join.
**Rejected alternatives:** A separate live VICE report adds another long fixture epoch and still does
not document the missing contract. Guessing violates implementation-blind spec authorship. An opaque
tool constructor adds production API solely for a fixture even though the closed data contract is
already part of the approved envelope model.
**Strongest counterargument:** Exposing the data shape might invite callers to treat it as authority.
It remains data-only: envelope authorization validates the complete exact set before minting any opaque
authority, and the primary report origin still uses AR-P42's private bridge.
**Confidence:** High — this is the minimal completion of an existing planned interface and exact-set
invariant, not a new semantic choice.
**Hardening:** The AR-P43 independent challenge already required one complete valid identity for every
route-contract digest and no private report-byte access.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Tool digests become derivable from name/version, multiple identities per contract
are required, ordering becomes semantically meaningful, or the fixture still cannot diagnose its tuple
through the declared public predicate/envelope projections.

### AR-P45 — Genuine foreign tool-route authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Bounded implementation-blind fixture setup for an existing negative specification;
no production behavior, public API or assertion change.
**Objective:** Supply a valid opaque foreign tool-bearing envelope whose route and tool authority are
internally genuine while keeping the selected report's private provenance inaccessible.
**Decision:** Add an opt-in fixture setup used only by the existing wrong-tool context test. In the
same module-reset epoch and controlled adapter/catalog authority as the primary fixture, orchestrate
one additional report with an exact VICE terminal non-pass, resolve its genuine position, and authorize
its envelope only through `authorizeFailureEnvelopeFromReportPositionV1`. Use that opaque envelope as
the foreign tool authority. Do not construct the extra report for the other 27 cases; represent the
tool mismatch as optional fixture data and require it in the one test before the unchanged rejection
assertion.
**Evidence:** The primary report has only one non-pass position and every other position must fail the
AR-P42 bridge, so no valid same-report tool mismatch exists. A synthetic foreign tool tuple can be
self-consistent only by co-varying route-contract facts, which does not prove rejection of a genuine
tool-bearing route occurrence. One same-epoch second report preserves WeakMap authority and isolates
that semantic boundary, unlike calling the reset-based fixture twice. A focused rerun also proved the
other canary envelopes authorize once they reuse the complete primary tool identities; this extra
report is therefore limited to tool-route provenance, not a workaround for incomplete canary input.
**Rejected alternatives:** Building another report for every fixture epoch adds prohibitive runtime.
Using a pass/structural position violates AR-P42. Removing the tool case or accepting an envelope that
fails before context construction weakens the oracle. A raw-byte or route-authority accessor weakens
the production boundary solely for tests.
**Strongest counterargument:** Even one extra genuine report is expensive. It is limited to the single
tool mismatch test, reuses the already controlled execution boundary, and is the only option that
preserves both full authority validity and the existing semantic check.
**Confidence:** High — the observed failure isolates the missing route/tool provenance join and the
same-epoch report is the narrow genuine source.
**Hardening:** AR-P43's independent challenge identified a live report as mandatory if a synthetic
authority could not preserve route/tool validity; AR-P44 public-projection diagnostics confirmed that
condition.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The opt-in report invalidates primary authorities, cannot produce a tool-bearing
non-pass, changes any assertion, or materially affects runtime outside the one tool-mismatch case.

### AR-P46 — Raw-envelope tool completeness (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Fixture-only completion of an existing valid raw-envelope tuple; no production
behavior, public API or expectation change.
**Objective:** Preserve the empty raw-malformed payload check while satisfying the exact tool set of
the route contract that the fixture intentionally reuses.
**Decision:** When the raw predicate copies the primary route contract's `toolContractDigests`, pass
the exact complete `toolVersions` array from the primary opaque envelope's public projection into raw
envelope authorization. Keep raw observation and source bytes empty. Do not erase tool digests, invent
identities or access private observation bytes.
**Evidence:** The full oracle's second case stopped in fixture construction before its assertions. Its
raw predicate copies every route-contract field, including a now-nonempty tool digest set, but its
authorization input still supplies `toolVersions: []`. AR-P44 requires exact digest-set equality and
the public primary envelope projection already supplies the matching complete identities.
**Rejected alternatives:** Clearing the predicate's tool digests changes the route contract under test.
Leaving the tuple incomplete tests constructor rejection rather than raw-empty execution. Inventing a
new tool tuple repeats the AR-P44 mismatch risk.
**Strongest counterargument:** The raw diagnostic route may eventually select a different tool chain.
This fixture explicitly derives its raw route contract from the primary projection; if it stops doing
so, the tool source must be reconsidered with the route contract.
**Confidence:** High — the contradictory fields are directly visible in the immutable oracle input.
**Hardening:** Reuses the exact AR-P44 set rule and only a passive public projection; private canonical
observation bytes remain inaccessible.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The raw route contract no longer derives from the primary route, its public tool
projection is incomplete, or the focused case still fails after exact tool completion.

### AR-P47 — Typed-family frontend coverage (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Implementation-blind fixture selection that makes an existing specification exercise
both families named by its unchanged expectation; no production behavior or public API change.
**Objective:** Preserve the frontend-chain assertion while proving both typed-valid and typed-invalid
candidates traverse the published route.
**Decision:** Add a closed fixture option `candidateFamily: typed-valid | typed-invalid`, defaulting to
typed-valid. Select a genuine route/report occurrence whose source family exactly matches that option
and whose terminal tier matches the already closed `subjectTier` option. In the named test, create and
execute one independent fixture for each family with `subjectTier: frontend`, asserting the unchanged
frontend result and genuine worker/isolate activity for both.
**Evidence:** The default fixture selects report position 2, whose exact terminal tier is
`compiler-api`; the preceding route-preservation assertion correctly passes, so hardcoding frontend
without selection is contradictory. The test currently executes only one origin created from
`source.kind: typed-valid`, leaving its named typed-invalid behavior unexercised.
**Rejected alternatives:** Adding only `subjectTier: frontend` fixes the observed value but leaves half
the requirement uncovered. Changing the expected tier duplicates the preceding general route-tier
test and abandons the intended frontend seam. Manually forging a typed-invalid candidate cannot satisfy
the subject-bound report-position context.
**Strongest counterargument:** Two fixtures roughly double this one case's runtime. The added campaign
is confined to the single cross-family test and is required for genuine independent report authority;
no other case pays the cost.
**Confidence:** High — the owned oracle and fixture directly show both the tier contradiction and the
missing family execution.
**Hardening:** The correction selects only genuine report positions and opaque AR-P42 origins; it adds
coverage rather than weakening or relabeling an assertion.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Campaign projections cannot distinguish the two closed source families, either
family lacks a frontend route, or the corrected case does not observe a genuine worker/isolate for each.

**Supersession:** The current mixed campaign has no typed-valid route whose terminal tier is frontend,
so the joint selector is unsatisfiable. AR-P48 retains the objective with a genuine frontend campaign.

### AR-P48 — Parent-bound frontend family campaign (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Implementation-blind fixture campaign selection for an existing cross-family
specification; no production behavior or public API change.
**Objective:** Prove both typed-valid and typed-invalid candidates genuinely dispatch through the
published frontend handler without coercing a tier or inferring activity from another route.
**Decision:** For the named cross-family test only, mint the smallest constructor-valid frontend-only
campaign through `createPublishedExecutionCampaignV1` using the same resolved parent publication.
Select one genuine terminal-frontend report position per family, authorize each origin through AR-P42,
and execute/assert each independently. Snapshot activity immediately before candidate execution and
require a new frontend worker request plus exact terminal frontend result for each family.
**Evidence:** The current mixed campaign's genuine typed-valid selection terminates at compiler-api and
has no typed-valid terminal-frontend position. The published frontend campaign contains both valid and
invalid scalar cases and binds its inventory/generator/renderer authority to the same resolved parent.
One terminal worker request is emitted per route, so compiler-api prerequisite metadata cannot serve as
evidence of frontend dispatch.
**Rejected alternatives:** Inferring frontend traversal from a compiler-api route can be satisfied by
unrelated setup activity and contradicts the one-request execution contract. Changing the expectation
to the genuine terminal duplicates the immediately preceding route-preservation test. An unbound local
frontend campaign fails parent/publication authority.
**Strongest counterargument:** A second 72-route campaign raises this one test's runtime. Use the
smallest configuration accepted by the genuine published constructor, confine it to this case, and
retain authenticity rather than substituting a cheaper false signal.
**Confidence:** High — independent challenge grounded the published constructor, campaign contents and
worker dispatch path and found the frontend-only campaign feasible.
**Hardening:** Independent challenger selected this campaign and rejected both prerequisite inference
and terminal-only weakening.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The published frontend constructor cannot bind both families to the selected parent,
either family lacks a terminal-frontend route, or activity cannot be isolated to the candidate phase.

**Supersession:** The constructor accepts the frontend intent, but complete-parent route planning must
also cover mandatory runtime/VICE rules and rejects the frontend-only population. No authentic scoped
parent exists. AR-P53 retains ST-28's normative cross-family published-handler requirement.

### AR-P49 — Frontend campaign semantic intent (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Declares exact already-reviewed fixture inputs required by AR-P48; no production
behavior, expectation or public API change.
**Objective:** Let the implementation-blind fixture mint the genuine parent-bound frontend campaign
without guessing population, rules, spellings, seed or limits.
**Decision:** Call `createPublishedExecutionCampaignV1(parent, intent)` with `schemaVersion: 1`, target
`c64`, seed `sha256:` followed by 64 `6` characters, and configuration: `caseCount: 72`,
`maxInvalidCases: 24`; sorted enabled rules `rule.ch02.2-primitive-types.boolean.range.true`,
`rule.ch02.2-primitive-types.byte.range.0-255`,
`rule.ch02.2-primitive-types.sbyte.range.128-127`,
`rule.ch02.2-primitive-types.sword.range.32768-32767`, and
`rule.ch02.2-primitive-types.word.range.0-65535`; spellings `const`, `literal`, `local`, `parameter`;
budget `{ maxModules: 4, maxDeclarations: 128, maxIrNodes: 512, maxStatements: 256,
maxExpressionDepth: 16, maxLoopWork: 1n, maxSourceBytes: 65536, maxAttempts: 128 }`.
**Evidence:** This is the exact reviewed frontend intent already used by the genuine campaign fixture;
only its current helper path creates an unbound local campaign. Supplying the same semantic intent to
the published constructor binds it to the selected parent as AR-P48 requires.
**Rejected alternatives:** Reusing the orchestration intent produces runtime routes and caused the
unsatisfiable selection. Inventing a smaller population may omit one family or change deterministic
case ordering. Importing the unbound helper result violates parent authority.
**Strongest counterargument:** Duplicating intent values can drift. Keep this declaration aligned with
the named reviewed frontend fixture; any fixture intent revision reopens this ruling and its oracle
hash.
**Confidence:** High — the values are copied from the repository's reviewed genuine frontend intent,
not inferred from production outcomes.
**Hardening:** AR-P48's independent challenger required the published constructor and smallest genuine
reviewed frontend configuration; this ruling supplies its exact closed input.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The reviewed frontend intent changes, the published constructor rejects it under the
selected parent, or either typed family is absent from its 72 cases.

### AR-P50 — Exact report-position request authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Package-private read-only access to an already-retained genuine request; no public API,
wire format or observation-byte exposure.
**Objective:** Eliminate fixture reconstruction of scalar-1, scalar-2 and direct-MMIO execution cases
while preserving exact report-position authority.
**Decision:** Add `getExecutionReportPositionRequestV1(position)` only to
`failure-execution-internals.ts`. It accepts one genuine WeakMap-backed position and returns the exact
frozen `occurrence.request` reference, not a clone or structural projection. Forged/copied/foreign
values fail `unbound-capability`. It exposes no normalized observation bytes, occurrence state,
report/route-plan/tool provenance or loose source fields. The fixture uses this request for passive
original-route checks and exact source/observation authority instead of reconstructing an execution
case.
**Evidence:** Orchestration already retains the genuine validated request and binds it to the opaque
position. The request constructor has validated case identity, tier graph, oracle and policy; sequence
admission already relies on exact request-reference equality. The six observed failures came from a
second fixture implementation hardcoding scalar byte length one.
**Rejected alternatives:** A passive projection cannot retain authority and forces loose
reconstruction. Mirroring handler-catalog observation derivation duplicates production and caused the
current drift. A broader execute-for-fixture operation duplicates the existing confirmation
coordinator and does not serve the fixture's passive request checks.
**Strongest counterargument:** The request is replay-capable and contains genuine source/oracle
authority. Keep the accessor package-private, exact-position-only and exact-reference; downstream
context/attempt joins still reject cross-position mixing, and any public export reopens this ruling.
**Confidence:** High — independent challenge selected exact-reference retrieval as the smallest seam
that preserves all three observation forms without extending sensitive byte lifetime.
**Hardening:** Independent challenger rejected projection, reconstruction and duplicate derivation and
required cross-position replay/mixing tests.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The accessor becomes public, returns a clone/projection, exposes normalized bytes or
loose provenance, or a foreign position request satisfies another context/attempt join.

### AR-P51 — Original sequence replay identity (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal correction to already-authorized sequence replay identity; no public API or
result-format change.
**Objective:** Preserve exact ordered original report case identities while retaining a distinct
terminal reduced-candidate execution identity.
**Decision:** `executeFailureOriginalRouteV1` passes the retained
`occurrence.request.route.caseIdentity` into original-route execution. It must not substitute the
report record's execution identity. Only the terminal reduced candidate request uses
`candidateExecutionIdentity`. Exact occurrence/attempt/position authority remains enforced by retained
request identity and WeakMap-bound sequence capabilities.
**Evidence:** The failing sequence worker requests carried report execution digests because the adapter
passed `routeRecords[index].executionIdentity`, which the candidate-route constructor wrote over
`route.caseIdentity`. Positions 2/4/6/7 then differed from the authenticated originating-case order.
**Rejected alternatives:** Keeping execution identity loses source-case order. Using candidate identity
for originals aliases historical and reduced subjects. Widening expected identities weakens the exact
sequence requirement.
**Strongest counterargument:** Reusing case identity alone could alias repeated cases. It is not the
authority boundary: exact retained request, report occurrence, attempt and position capabilities remain
referentially bound; the case identity is the truthful worker-visible source identity.
**Confidence:** High — the overwrite chain and expected/actual split are direct and the authority
binding is independent of this display/routing field.
**Hardening:** Add mixed-sequence implementation assertions that every preceding request retains its
original case identity and only the terminal candidate changes identity.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Repeated original cases become ambiguous without occurrence authority, a preceding
request receives candidate identity, or the terminal candidate loses its distinct execution identity.

### AR-P52 — VICE fresh-confirm control selection (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Implementation-blind fixture selection inside the existing genuine report; no
production validation, handler or expectation change.
**Objective:** Reach the VICE candidate attempt only after satisfying the mandatory distinct passing
same-route historical control join.
**Decision:** For the VICE isolation case, select a pair of distinct genuine report routes with the
same request kind, rule, obligation, VICE terminal tier, prerequisites, policy, oracle contract and
handler/tool completion. Inject the historical failure into only one occurrence and require the other
report position to remain pass before context construction. Use neither current authority nor a global
registry fallback.
**Evidence:** The immutable test failed in context creation before VICE preparation. The fixture chose
the first VICE route without ensuring a matched control, while `fresh-confirm` explicitly requires a
distinct pass under the complete same-route configuration. Production already threads the
attempt-owned executor through the candidate VICE preparation path.
**Rejected alternatives:** Weakening control equality reintroduces reviewer finding SR-002. Current or
first-match fallback violates historical authority. Treating setup rejection as VICE isolation never
executes the path under test.
**Strongest counterargument:** The campaign may lack a matched pair. The fixture must prove the pair
from public plan/report facts or use a genuine parent-bound campaign that contains one; it must not
coerce unmatched routes.
**Confidence:** High — the failure path and complete control predicate are explicit.
**Hardening:** Verify the selected control's complete route configuration and pass sidecar before
returning the fixture, then retain the existing dedicated-worker/process assertions.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** No matched VICE pair exists, the control is not distinct/pass, any route field
differs, or candidate preparation still does not reach the attempt-owned executor.

### AR-P53 — Authentic typed-family handler dispatch (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Corrects an over-specific oracle assertion to the exact normative RD-05/ST-28 route
property after authentic planning proved the stronger fixture objective impossible; no production API
or behavior change.
**Objective:** Prove both typed-valid and typed-invalid candidates traverse their existing published
handler chain under unchanged original obligation and terminal tier.
**Decision:** Use the complete genuine orchestration campaign and select one genuine report position
for each closed typed family. For each independent fixture, snapshot candidate-phase worker/isolate
activity, execute the opaque candidate, and require exactly one new worker request whose tier equals
the selected original route's terminal tier; require the result to preserve that exact tier and a fresh
worker/isolate. Replace frontend-specific wording with published-handler wording. The preceding generic
test remains distinct because it covers only the default family and predicate/route preservation, not
both family dispatches.
**Evidence:** Complete-parent planning intentionally considers every modeled rule and has no scoping
authority; it rejects a frontend-only campaign missing mandatory VICE candidates. Scalar frontend and
runtime rules require different published generators, so one mixed campaign intent is also invalid.
RD-05 requires unchanged obligation/tier and ST-28 requires both families through the existing
published handler chain, not specifically terminal frontend.
**Rejected alternatives:** A sliced passive parent projection is not authority and bypasses the
completeness gate. A new parent would require its own matching execution publication and stop testing
the selected release. Adding runtime rules to the frontend intent violates single-generator authority.
**Strongest counterargument:** This no longer proves a typed-valid terminal frontend route. That is not
an RD-05 requirement and the selected complete authority has no such route; making it one requires a
separate authenticated scoped-planning feature, not a fixture workaround.
**Confidence:** High — independent challenge traced the capacity gate, lack of scoped authority,
generator split and normative ST-28 wording.
**Hardening:** Independent challenger selected exact authentic terminal dispatch per family and rejected
both fabricated scope and mixed-generator construction.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** ST-28 or RD-05 is revised to require typed-valid terminal frontend specifically, an
authenticated scoped parent is added, or candidate-phase activity cannot isolate the selected handler.

### AR-P54 — Sequence-65 prelaunch subject (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Fixture-only choice of a valid context for an unchanged hard-limit assertion; no
production behavior, public API or limit change.
**Objective:** Test rejection of requested position 65 before launch without making the unrelated
historical subject depend on an unavailable VICE control.
**Decision:** Build the limit-test fixture from the genuine position-2 subject with selected sequence
lifetime 64. Keep the hostile attempt input at 64 preceding original requests, `failingPosition: 65`
and `caseLimit: 65`, and retain the unchanged no-worker-launch assertion. Matched VICE control selection
remains confined to the explicit VICE isolation case.
**Evidence:** Position 64 in the current plan is VICE and has no distinct exact same-route passing
control, so context construction correctly fails before the limit operation. The limit API must reject
65 from the declared attempt shape before inspecting or executing a terminal route; its historical
subject position is not part of the boundary being tested.
**Rejected alternatives:** Forcing a non-existent VICE control weakens historical authority. Changing
the 64/65 values weakens the hard limit. Treating setup rejection as limit evidence never invokes the
limit operation.
**Strongest counterargument:** The 64 preceding requests repeat one genuine request. That is intentional
hostile input: rejection must occur on the closed case-limit bound before sequence-content admission or
worker launch.
**Confidence:** High — the specification's observable is prelaunch bound enforcement, independent of
which valid context owns the protocol.
**Hardening:** Preserve exact before/after worker activity and add implementation coverage that the
over-limit branch charges no budget and allocates no attempt authority.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The limit operation begins inspecting/executing inputs before rejecting 65, charges
budget, allocates attempt authority, or the position-2 context becomes invalid.

### AR-P55 — Typed-invalid intrinsic replacement validation (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal validator-scaffold correction preserving already-authorized typed-invalid
semantics; no language, public API or family-invariant change.
**Objective:** Allow genuine boolean/byte/sbyte/sword intrinsic replacement expressions to retain their
declared scalar type while keeping complete IR validation fail closed.
**Decision:** In `normalizeArgumentExpression`, read the expression's own enumerable data `type`
descriptor under exception containment, require the existing closed `isScalarType` predicate, and use
that exact scalar type for the temporary constant passed through complete `validateGeneratorIr`.
Reject arrays, exotic prototypes, inherited/accessor/missing/non-scalar types, declared type/value
mismatch and malformed/extra expression shapes. Do not coerce values or relax downstream exact source,
baseline, binding, claim, witness or intentional-violation checks.
**Evidence:** Genuine modeled memory wrong-type cases use boolean intrinsic replacements. Envelope
authorization retains them correctly, but initial-candidate revalidation hardcodes the temporary
constant as `word`; the IR validator then truthfully rejects boolean value/type mismatch and surfaces a
false family-invariant failure. Word replacements alone succeed. Raw-malformed validation does not use
this scaffold and remains unaffected.
**Rejected alternatives:** Coercing all replacements to word destroys genuine invalid-case semantics.
Skipping IR validation admits hostile shapes. Special-casing boolean repeats the defect for every other
scalar type.
**Strongest counterargument:** Reading an untrusted `type` property can invoke accessors or inherit
hostile values. Require an own enumerable data descriptor on a plain exact expression record under
try/catch before using the existing scalar allowlist.
**Confidence:** High — the failure is reproduced at the hardcoded temporary type and the proposed fix
uses an already-imported closed validator.
**Hardening:** Add genuine published typed-invalid memory regression, hostile descriptor/type/value
boundaries, raw-family non-regression and per-file branch coverage.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any scalar replacement still fails its own genuine type, a hostile descriptor
reaches validation, raw behavior changes, or the validator falls below the coverage gate.

### AR-P56 — Fixed VICE control campaign population (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Deterministic implementation-blind fixture population for the existing VICE isolation
specification; no production behavior, validation or expectation change.
**Objective:** Provide a genuine distinct passing same-route VICE control within the 64-position
sequence bound at the smallest measured runtime cost.
**Decision:** For the explicit VICE case only, mint a parent-bound published runtime campaign with seed
`sha256:` followed by 64 `7` characters; `caseCount: 26`, `maxInvalidCases: 0`; the four sorted memory
rules `peek`, `peekw`, `poke`, `pokew` using their full existing rule IDs; spellings `literal` and
`parameter`; enabled rules
`rule.ch12.3-1-memory-access.peek-addr.signature.word`,
`rule.ch12.3-1-memory-access.peekw-addr.signature.word`,
`rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte`, and
`rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word`, sorted; and the existing eight
generation-budget fields from AR-P49. Plan it with the unchanged
execution policy. Its deterministic 62-item plan supplies the matched valid `peek` VICE pair at
zero-based indices 10/11 (report positions 11/12, campaign ordinals 1/25). Inject failure only at index
10 and require index 11 to remain pass; then verify every AR-P52 route/policy/oracle/tool join from the
complete report before context construction.
**Evidence:** A source-context lexicographic search over `caseCount >= 24` and
`maxInvalidCases = 0..caseCount-24` found 26/0 as the first viable authentic configuration. Both pair
members have rule `peek`, obligation/terminal tier VICE, prerequisites frontend→compiler-api→emit→ACME,
and boundary family `boundary.memory.peek`; only their genuine case/spelling identities differ. The
plan has 62 positions, keeping the subject below the hard sequence limit.
**Rejected alternatives:** The 120-case four-spelling runtime intent exceeds the 16-stratum expensive
tier cap. The ordinary 40-case campaign contains no matched passing pair. Altering disposition or
control equality weakens the requirement.
**Strongest counterargument:** `maxInvalidCases: 0` omits invalid cases. This fixture exists solely to
prove a valid VICE same-route subject/control isolation property; typed-invalid execution is covered by
the complete orchestration campaign and AR-P53. Adding invalid slots increases runtime without changing
this pair.
**Confidence:** High — the exact published constructor, complete-parent planner and pair projection
were executed successfully in source-context Vitest.
**Hardening:** Independent challenge required a fixed opt-in two-spelling campaign; empirical search
proved the first viable population and exact pair before freezing it.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The fixed plan no longer has 62 items, pair indices/facts change, either report
result is not failure/pass as selected, context rejects the complete control join, or runtime exceeds
the existing 300-second watchdog.

### AR-P57 — Cross-family oracle watchdog (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Case-local test watchdog for two required independent authority epochs; no production
behavior, expectation or package-wide timeout change.
**Objective:** Let the typed-valid/typed-invalid published-handler test complete both genuine fixtures
without conflating a Vitest watchdog with semantic failure.
**Decision:** Set a 600-second watchdog only on the one cross-family case. Keep both independent genuine
fixtures, candidate-phase activity snapshots and every handler/result/isolation assertion unchanged.
**Evidence:** The corrected case completed the typed-valid fixture/execution and entered typed-invalid
setup but hit the default 240-second watchdog at 241.30 seconds before any closed issue or assertion.
Comparable individual fixture epochs take roughly 100–120 seconds, and the case intentionally performs
two plus candidate executions.
**Rejected alternatives:** Raising the package/global timeout hides unrelated hangs. Reusing one
module-reset epoch aliases WeakMap authority. Dropping a family or activity assertion weakens ST-28.
**Strongest counterargument:** 600 seconds can delay detection of a true hang. It is isolated to one
measured two-epoch case and remains below the 900-second bound previously required for a ten-epoch
sequence matrix.
**Confidence:** High — the timeout occurred only after one complete family path and matches measured
fixture costs.
**Hardening:** Retain verbose per-family progress in focused diagnostics and reopen if normal runtime
approaches the bound.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The case exceeds 600 seconds, either family no longer uses an independent authority
epoch, or the timeout is copied to other tests/global configuration.

### AR-P58 — Controlled typed-invalid diagnostic outcomes (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Implementation-blind controlled worker-fixture behavior derived from published
diagnostic projections; no production classifier, predicate or expectation change.
**Objective:** Preserve mixed report order while giving nonselected typed-invalid routes their genuine
passing diagnostic and reproducing the selected route as the same direct-shrink diagnostic mismatch in
historical and candidate execution.
**Decision:** Before report execution, build a fixture-local bounded map from each genuine published
typed-invalid `sourceCaseDigest` to only its observable expected diagnostic `{ code, phase, severity }`.
Extend the worker instruction to the exact tagged outcomes success, crash, or diagnostic-entry. A
nonselected mapped original emits exactly one diagnostic with the published code/phase/severity. The
selected typed-invalid report occurrence and selected typed-invalid candidate emit the same tuple with
only `code` replaced by deterministic valid alternate `E00000` (or `E00001` when expected is E00000),
keeping phase/severity exact. Use a fixed protocol-valid accepted entry ID. Typed-valid behavior is
unchanged. Gate originals by exact map membership and candidates by the retained authenticated selected
family/tuple; never infer raw-malformed from the shared invalid-diagnostic worker kind. Clear the map on
cleanup and never serialize it or retain source bytes/text/authorities.
**Evidence:** Worker crashes classify as compiler-ice/fresh-confirm and require a same-route control,
which mixed typed-invalid positions lack. Ordinary invalid-route classification passes only one exact
published code/phase/severity tuple and classifies a one-field difference as diagnostic-mismatch/direct-
shrink. Candidate execution changes case identity, so its selected tuple must be retained separately
rather than looked up by the original digest.
**Rejected alternatives:** Filtering or reordering to valid-only routes hides the required mixed report
order. Weakening predicate/control equality admits false reproduction. Real compiler execution belongs
to the separate integration tier and is too slow/coupled for this controlled orchestration oracle.
**Strongest counterargument:** The fixture consumes the same published diagnostic truth as production
classification, so it is not an independent compiler-diagnostic oracle. Its responsibility is
orchestration/reproduction; real-worker diagnostic correctness remains covered by the integration tier.
**Confidence:** High — independent challenge traced the public diagnostic contract and exact classifier
fields and selected this closed outcome map.
**Hardening:** Keep the map fixture-local/cardinality-bounded, test exact pass and one-field mismatch,
prove raw behavior unchanged, and retain literal observation-byte equality. If candidate-varying
identity still changes normalized observation, fix normalization separately rather than weakening it.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A mapped nonselected invalid route does not pass, selected historical/candidate codes
do not match each other, raw routes consume this path, private data enters the map, or exact observation
comparison still differs after semantically equal diagnostics.

### AR-P59 — Authentic typed-valid sequence campaign (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Deterministic implementation-blind fixture population for the existing stateful-sequence
specification; no production behavior, confirmation disposition, control equality or expectation change.
**Objective:** Exercise every required failing position through the genuine fresh-confirm and passing-control
path without treating a direct-shrink typed-invalid mismatch as a sequence failure.
**Decision:** For `sequence-only` fixtures, mint a parent-bound all-typed-valid campaign with seed `sha256:`
followed by 64 `8` characters; `caseCount: 56`; `maxInvalidCases: 0`; the four sorted memory rules `peek`,
`peekw`, `poke`, and `pokew` using their complete existing rule IDs; the single `literal` spelling; those
same four sorted enabled rule IDs; and the existing eight generation-budget fields from AR-P49. Plan it
with the unchanged execution policy. Require its authentic 68-position plan and retain the exact original
order. Positions 2–9 use the next position as a distinct genuine passing same-route control; all are
`peek`/`compiler-api` routes with prerequisite `frontend`. Position 64 uses position 65 as its distinct
passing same-route `pokew`/`compiler-api` control. Inject `compiler-ice` only into the selected historical
occurrence and the terminal reduced candidate inside the dedicated sequence attempt; both standalone fresh
candidate runs pass, which discovers the original position and enters ordered replay. Typed-invalid
direct-shrink coverage remains owned by AR-P58 and the cross-family published-handler case.
**Evidence:** A planner-only source-context search, with no worker or report execution, scanned
`caseCount: 1..64` for this fixed seed, four-rule set, one-spelling set and `maxInvalidCases: 0`. The first
population satisfying all positions 2–9 and 64 plus distinct later same-route controls was 56 cases. The
result has 68 routes and exact control pairs 2→3, 3→4, 4→5, 5→6, 6→7, 7→8, 8→9, 9→10, and 64→65.
**Rejected alternatives:** Letting direct-shrink mismatches enter confirmation contradicts the closed
disposition table. Deferring the control lookup until after fresh execution weakens the requirement that
every fresh-confirm class enter with genuine known-good authority. Filtering or fabricating report order
would stop proving authenticated original replay.
**Strongest counterargument:** This campaign omits invalid routes from the sequence prefix. Mixed-family
candidate execution remains independently covered by AR-P58 and ST-28; sequence ordering here must first
prove the fresh-confirm/control contract it actually exercises.
**Confidence:** High — the planner produced every exact route/control pair and 56 was minimal within the
fixed searched configuration; no claim is made across arbitrary seeds or rule subsets.
**Hardening:** Freeze the complete campaign intent, route count and every control pair before running the
expensive report, then retain exact position identities and the literal sequence observation assertions.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The plan no longer has 68 positions, any fixed route/control pair changes, any selected
subject is not typed-valid, a control is not a distinct genuine pass, or any sequence position is reordered.

### AR-P60 — Local authentic VICE isolation oracle (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** True-external boundary behavior for the existing VICE attempt-worker specification; no
production handler, artifact validation, emulator protocol or publication-selection change.
**Objective:** Prove candidate VICE preparation uses its attempt-owned worker while subject failure and
same-route control traverse genuine emit, ACME and VICE artifacts.
**Decision:** Gate only the VICE isolation case on Linux, `process.execve`, ACME and C64 VICE availability.
Inside that case, wrap and observe the real worker executors and process runtime, preserving all start,
release, terminate and shutdown behavior. Delegate real emit and ACME operations unchanged. Arm failure
only from the exact selected emit occurrence, then consume it only for the production VICE launcher request:
`request.executable === process.execPath`, exactly two arguments, compiled
`execution-vice-launcher-entry.js` first and its launch-token path second. Return one controlled process-start
failure, require exact injection count/no pending arm, require the selected result to be
`emulator-launch-failure` at `vice-launch`, and require the distinct same-route control to pass. Use the
existing reviewed local VICE execution policy: 60-second operations, 15-second launch attempts, 120-second
routes, 1 MiB output, 16 MiB evidence, 65,535 instructions, 100,000,000 cycles and two launch attempts.
Missing platform/tools skips this case; present but wrong ACME 0.97 or VICE 3.10 fails. Retain a small
CI-safe dedicated-executor handoff assertion, but never treat it as the end-to-end substitute.
**Evidence:** The controlled emit stub has neither `layoutBasis` nor executable assembly, and its process
stub creates no PRG, labels or ACME report. Production therefore correctly fails artifact preparation before
VICE and leaves the old injected failure armed into the control. Real emit supplies assembly/layout and the
existing local VICE policy supplies adequate production bounds. The launcher request shape is uniquely
owned by the real control-host boundary, so ACME cannot consume the fault.
**Rejected alternatives:** Reproducing canonical emit, ACME and binary-monitor artifacts in the fixture
would create a parallel untrusted compiler/emulator implementation. A lower-level handoff assertion plus the
ordinary local VICE suite leaves the candidate-relative composition unproved.
**Strongest counterargument:** The end-to-end candidate-specific case becomes slower and absent from CI.
The project already makes real VICE a mandatory local tier, while the retained CI handoff assertion keeps
the dedicated-worker seam continuously checked.
**Confidence:** High — independent challenge converged on real-tool delegation and identified the exact
launcher discriminator and policy mismatch.
**Hardening:** The challenger added the local VICE policy correction, exact launcher matching, unconsumed-arm
failure, version behavior and CI handoff requirement.
**Challenger:** converged.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A fake artifact enters the end-to-end path, ACME consumes the injected fault, any selected
or control route uses the global worker, the control does not pass, or the case skips with present wrong tools.

### AR-P61 — Defect-first VICE campaign admission (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Selection and empirical admission of a true-external fixture campaign plus necessary
corrections in the already-authorized VICE cleanup path; no weakening of report, control, candidate,
artifact, lease, emulator or confirmation authority.
**Objective:** Preserve AR-P60's end-to-end candidate-relative VICE proof without selecting around a real
compiler/generator or lease-cleanup defect.
**Decision:** Reject AR-P56's positions 11/12 as the final authentic pair: with real boundaries the subject
fails at emit, never reaches the launcher, and its armed fault is not consumed. Before any replacement
search, make the existing seed-4 ACME 0.97/VICE 3.10 acceptance suite green. Correct the owned-attempt
cleanup defect that leaves an `attempt-recorded` lease and launch artifact after the exact launcher
process-start failure; cleanup must remove only its authenticated owned record and must not reclaim a
foreign or ambiguous lease. Diagnose the seed-7 subject's genuine `emission-failure` and fix any compiler,
generator or candidate-rendering defect rather than hiding it. Then run a finite planner-first scan against
the exact selected parent: hexadecimal repeated-byte seeds `0..f`; `caseCount: 24..64`;
`maxInvalidCases: 0`; all six sorted two-spelling subsets of `const`, `literal`, `local`, `parameter`; the
four mandatory memory rules; and the existing generation budget. Retain only distinct typed-valid
same-route VICE pairs whose subject and control positions are both at most 64; rank by route-plan length,
case count, seed, spelling pair and positions. Admit candidates in that order only after both routes pass
real preparation/ACME/VICE twice without injection, a complete un-injected campaign report records both
passes, and lease retirement is clear. Freeze the first admitted campaign/pair in a later runtime ruling,
then apply AR-P60's exact subject-only launcher injection and full confirmation oracle. If the bounded scan
is exhausted, reopen the immutable oracle explicitly; do not silently replace it with a composed lower-tier
proof.
**Evidence:** The real seed-7 run produced subject `{emission-failure, vice, emit}`, control
`{emulator-lease-recovery-blocked, vice, vice-launch}`, zero injections and one unconsumed arm. The known
seed-4 acceptance health gate then failed on a durable `attempt-recorded` lease whose owner PID is absent and
whose child is null. Existing ordinary and candidate VICE preparation are separate production arms, so a
CI handoff assertion plus ordinary acceptance does not prove their composition. Planner capacity is 4,096
routes while the selected confirmation prefix remains capped at 64.
**Rejected alternatives:** Searching immediately would cherry-pick around prime-directive defects. A
composed CI handoff plus ordinary VICE acceptance omits the candidate-relative end-to-end path. Duplicating
one known execution case as two report occurrences is not constructible under the current campaign planner,
which rejects duplicate case identities and regenerates report requests from the exact campaign.
**Strongest counterargument:** The defect-first gate and 3,936-input pure planner scan add local time and
may still find no admissible pair. This cost is bounded and is preferable to freezing false evidence or
weakening the only full candidate-to-emulator composition proof.
**Confidence:** Medium-high — independent challenge converged on the semantic direction; feasibility of a
replacement pair remains conditional on real-tool admission.
**Hardening:** Added the seed-4 health gate, deterministic finite search/ranking, two-pass route admission,
complete un-injected report proof, explicit defect triage and an exhaustion fallback that reopens rather
than weakens the oracle.
**Challenger:** converged.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Seed-4 acceptance remains unhealthy, an owned launch failure leaves lease state, the
seed-7 emit failure is untriaged, the bounded scan has no admitted pair, or selected identities change.

### AR-P62 — Static-graph local VICE specification split (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Specification-file and true-external fixture organization inside Phase 3's existing test
scope; no production API, handler, result, authority, control or emulator behavior change.
**Objective:** Eliminate nondeterministic report/provenance registry splits caused by resetting and
dynamically mocking the same execution graph that mints and later reads opaque report authority.
**Decision:** Move only the locally gated candidate-relative VICE case from the 28-case controlled oracle
file into a dedicated `failure-candidate-vice-local.spec.test.ts`. Establish its worker-executor and process-
runtime mocks at file top level before any execution package import, using a fixed support controller and
explicit minimal facades; never call `vi.resetModules`, `vi.doMock` or `vi.importActual` during that test.
The file and its fixture import one normal active module graph for catalog, campaign, index, report and
internals authority. Move the authentic wrapper/controller mechanics into one dedicated test-support module
so the ordinary controlled fixture path contains no authentic-leaf reset branch. The new test remains
implementation-blind, locally skips only when the exact Linux/execve/ACME/VICE boundary is absent, fails on
wrong present versions, and retains every existing dedicated-worker/process/injection/control/cleanup
expectation. The ordinary specification file retains the other 27 cases and its fixed controlled adapter
fixtures. Freeze a superseding ordered oracle manifest including the new specification/support files.
**Evidence:** Ordinary controlled report authority is stable across two independent 153-second processes.
The authentic-leaf branch still intermittently returns a report minted in a different WeakMap registry after
pre-reset namespace spread, post-reset bypass imports, returned API bundles and finally explicit minimal
facades were each eliminated. The remaining shared cause is the reset/dynamic-mock architecture itself. A
hoisted per-file mock graph is Vitest's stable interception model and cannot contaminate the controlled cases
when isolated in its own file.
**Rejected alternatives:** Further dynamic-reset patching has failed the explicit stop condition and is no
longer viable. Applying top-level real-boundary mocks to the whole 28-case file would replace the controlled
worker/process semantics of unrelated cases. Adding a production runtime-injection API would widen the
compiler's authority surface solely for a test harness.
**Strongest counterargument:** Splitting one immutable case expands the oracle bundle and duplicates some
test bootstrap. A focused support controller keeps that duplication small, while the split gives the true-
external case the stable graph its authority model requires.
**Confidence:** Medium-high — the architecture follows Vitest's stable top-level mock model, but acceptance
requires two independent genuine-report runs before semantic evidence is trusted.
**Hardening:** Replaced all reset/import variations with a different graph architecture; require zero reset/
dynamic-mock calls, explicit facade exports, two fresh-process provenance proofs and unchanged semantic
assertions.
**Challenger:** budget exhausted.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Either fresh-process proof rejects report authority, mocks load after an execution import,
the ordinary 27 cases change behavior, or the local VICE expectations are weakened.

### AR-P63 — Executable-boundary VICE fault without module substitution (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** True-external test-fixture mechanics for the already-authorized local VICE oracle; no
production API, worker, process, launcher, artifact, result, authority, control or confirmation behavior
change.
**Objective:** Preserve one active execution module graph while proving an authentic operating-system
launcher failure, a distinct genuine VICE control pass, fresh confirmation and exact cleanup.
**Decision:** Supersede AR-P62's top-level module mocks and the false mocked-failure diagnosis in AR-P61.
Retain the dedicated local specification file, but use no `vi.mock`, `vi.resetModules`, `vi.doMock` or
`vi.importActual`. Before constructing report authority, prepend a private `0700` directory to `PATH`
containing an executable JavaScript shim named `x64sc` with an absolute `process.execPath` shebang. The
production resolver must canonicalize this executable through its ordinary path. In pass mode and for
`--version`, the shim must `process.execve` the canonical real VICE executable with only the existing
allowlisted environment, preserving the process identity and genuine emulator path. In armed mode it must
atomically consume one fixed `0600` marker, append one bounded audit record and exit 127. Arm once before
the report so the first VICE occurrence at position 11 fails while the next same-route control at position
12 passes; leave the marker consumed for both fresh confirmation runs; arm once more immediately before
the exact terminal sequence-candidate VICE launch. Assert two consumed injections, authenticated
same-attempt worker observations, real process activity, exact subject/control outcomes and clear lease and
artifact state. Before trusting injected evidence, require both fixed routes to prepare successfully, pass
real ACME/VICE execution, and appear as passes in one complete un-injected report. Search the wider bounded
campaign space only if this real admission fails.
**Evidence:** A no-launch planner diagnostic found positions 11 and 12 are the only VICE routes through
position 12, respectively the first and next VICE routes, with case identities
`sha256:18d60ca522d6a48ab99a27e4d1194d4b84c3642d748a6d757659c4a71112c6c6` and
`sha256:fb2d4b0614ea85b228bc5d3c56e483599299cddac301332312b3fde1f50dbcbf`; both independent genuine
preparations return `ok: true`. Direct no-mock preparation therefore disproves AR-P61's mocked
`emission-failure` classification. Both dynamic and top-level static module substitution reproduced invalid
report authority, so AR-P62's reopen trigger fired. The control host already resolves `x64sc` from `PATH`
to a canonical executable before its launcher uses `execve`, making the operating-system executable the
narrow true-external boundary.
**Rejected alternatives:** Any execution-module mock creates a second opaque-authority registry and has now
failed both supported Vitest architectures. A production fault-injection seam would widen privileged runtime
surface solely for a test. Manual lease or artifact mutation would bypass the behavior under test.
**Strongest counterargument:** The shim is still test-owned behavior and could mask a VICE defect. Its pass
mode replaces its own process with the canonical real executable, while independent un-injected admission
must first prove both exact routes and the complete report; the shim controls only the one-shot executable
start failure that the oracle requires.
**Confidence:** Medium-high — route ordering and preparation are measured, the production executable seam
is grounded, and acceptance remains conditional on real VICE admission plus the full injected oracle.
**Hardening:** Use an absolute Node shebang because the launcher's minimal environment has no `PATH`; keep
the directory and marker owner-only; embed only canonical fixed paths; consume the marker atomically; bound
the audit to exactly two records; restore `PATH` and remove only the fixture-owned directory after exact
lease/artifact cleanup.
**Challenger:** budget exhausted under AR-P62; this ruling responds to its explicit reopen trigger without
widening semantics.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Either fixed route fails real admission, the shim does not exec real VICE in pass mode,
module substitution re-enters the case, injection is consumed outside the two exact candidate launches,
the control/fresh runs do not pass, or any lease/artifact remains owned after shutdown.

### AR-P64 — Authenticated stale local VICE lease recovery (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Exact recovery of process-wide local VICE state through the already-published authenticated
inspection and clearing API; no source, oracle, execution policy, result or cleanup-contract change.
**Objective:** Distinguish a campaign defect from stale host state and restore the mandatory clean admission
precondition without deleting or guessing lease files.
**Decision:** Preserve the fixed position-11/12 campaign and the strict baseline pass gate. Inspect the
singleton lease through `inspectViceLeaseV1`; clear a generation only when it is positively `clear`, its
child is absent, and both generation and nonce still exactly match the inspected evidence. Reinspect before
rerunning the unchanged oracle. Keep the bounded public result projection in the baseline failure message
so any later recurrence identifies its exact position and closed result tuple.
**Evidence:** With no shim marker armed, both independently prepared routes returned the identical public
failure `{code: "emulator-lease-recovery-blocked", tier: "vice", stage: "vice-launch",
cleanupBlocker: null}`. Production inspection then returned `{state: "clear", generation: 1,
nonce: "62bda87ca10c1473b261e45d056408f00488f0d5afa26ee3a1ee731cf90f7c19",
childAbsent: true}`. Clearing that exact generation and nonce succeeded; immediate reinspection returned
`{state: "clear", generation: 0, nonce: "", childAbsent: true}`. No lease or artifact file was
manually removed.
**Rejected alternatives:** Selecting another pair would hide process-wide state that blocks every VICE
route. Manual file deletion bypasses the authenticated absence and generation checks. Weakening the baseline
would admit false evidence before the injected path.
**Strongest counterargument:** Recovery mutates shared host state outside the test process. The production
API permits it only after positive child absence and exact generation/nonce matching, and the immediate
empty-state reinspection proves the mutation was narrow.
**Confidence:** High — both route results and the authenticated lease evidence converge on one host-state
cause, and the exact recovery API completed successfully.
**Hardening:** Retain the unarmed two-route baseline, exact cleanup inspections after baseline and injection,
and the bounded diagnostic projection; never add automatic broad cleanup to the fixture.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The same blocker returns from generation zero, inspection is active or ambiguous, the
child is not positively absent, exact clearing rejects, or a later run leaves a nonzero generation.

### AR-P65 — Exact launcher-environment preservation through the VICE shim (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Test-only pass-through behavior at the true-external executable boundary; no production
execution policy, launcher, environment allowlist or result semantics change.
**Objective:** Make an unarmed shim observationally equivalent to the production launcher's direct VICE
`execve`, including process lifetime and authenticated cleanup.
**Decision:** The shim must pass real VICE only the values present in its own launcher-provided environment:
`LANG`, `LC_ALL`, `TZ`, and optional `DISPLAY`. It must not reconstruct values from the parent test process
or add `HOME`, `PATH` or `TMPDIR`. Preserve the same PID through both `execve` calls and leave the marker
branch unchanged.
**Evidence:** From an empty generation-zero namespace, the parent-derived shim environment made the first
unarmed route return a cleanup-blocked `emulator-lease-recovery-blocked` result and left one positively
absent generation. The shim had dropped production `TZ`/`DISPLAY` and injected three variables absent from
the launcher allowlist. After exact authenticated recovery and environment correction, the next complete
baseline passed the prior route-result and cleanup gate and left inspection at generation zero; it advanced
to report authorization instead.
**Rejected alternatives:** Increasing cleanup time would conceal a process launched under different inputs.
Passing the full parent environment would violate the launcher's deliberate allowlist. Abandoning the
executable boundary would return to the already-failed module-substitution architecture.
**Strongest counterargument:** Environment parity is inferred from movement of the failure boundary rather
than a direct child-environment dump. The shim source now constructs exactly the production launcher's
documented allowlist, and authenticated cleanup plus the real route result provide the relevant behavioral
proof without exposing host environment data.
**Confidence:** High — the before/after runs started from authenticated generation zero and differed only in
the pass-through environment.
**Hardening:** Keep the shim environment literal and bounded, assert clean lease state after every complete
report, and retain a second independent green oracle run before freezing the bundle.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** An unarmed route again blocks cleanup, any parent environment field enters the shim, the
real executable does not retain launcher PID identity, or final inspection is nonempty.

### AR-P66 — Canonical real-result sidecar association and fail-closed propagation (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correction of authenticated report construction for a result shape already admitted by the
execution-result contract; no digest-equivalence weakening, predicate change, report-field change or VICE
fixture exception.
**Objective:** Authorize genuine real VICE route sidecars against the exact canonical report result and
prevent an authorization rejection from masquerading as successful campaign execution.
**Decision:** Canonicalize every handled route result through the orchestration snapshot before creating its
route record or predicate sidecar. Associate and derive sidecar outcome/predicate evidence from that exact
canonical object. At final report construction, distinguish a genuine authorized report from the
authorizer's closed `{ok:false}` result and propagate rejection as the outer operation failure rather than
wrapping it in `success`. Retain literal digest equality after canonicalization; do not normalize inside the
comparison or fixture.
**Evidence:** The unarmed real baseline returned outer success containing exactly `{ok:false,
issues:[{code:"invalid-evidence-input",path:"/predicateSidecars"}]}`. Focused diagnosis proved the first
authentic VICE sidecar passed exact-result WeakMap association but failed outcome equality: the handler result
used a valid bare 64-hex evidence digest while report snapshotting canonicalized it to `sha256:<hex>` after
the sidecar was minted. Focused raw-digest and nested-rejection regressions now pass, as do adjacent authority
and conformance suites; build, typecheck, lint, formatting and generated-binding freshness are green.
**Rejected alternatives:** Treating bare and prefixed strings as equal inside authentication weakens literal
canonical evidence. Rewriting only the sidecar digest creates two independently transformed objects.
Handling nested failure in the fixture would certify a rejected report as genuine.
**Strongest counterargument:** Moving canonicalization earlier could affect non-VICE results. The existing
orchestration snapshot is already the report's required representation; focused predicate evidence and
adjacent report/conformance tests prove the association remains exact across the shared route path.
**Confidence:** High — the failing comparison was identified exactly and both semantic defects have focused
regressions plus adjacent green coverage.
**Hardening:** Require the complete no-mock VICE oracle, ordinary controlled oracle, report-authority tests
and full repository verification before phase closure.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any authentic route sidecar fails after canonicalization, sidecar/result object identity
diverges, report rejection is nested again, or literal digest equality is weakened.

### AR-P67 — Version-probe pass-through precedes one-shot VICE injection (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Test-only ordering correction implementing AR-P63's already-declared unconditional version
pass-through; no production discovery, route or failure semantics change.
**Objective:** Ensure the one-shot marker represents an actual emulator launch failure rather than a tool
capability probe failure.
**Decision:** In the executable shim, detect exact `--version` invocation first and immediately `execve` the
canonical real VICE executable. Consult and atomically consume the marker only for non-version invocations.
Retain the same environment allowlist and audit bounds.
**Evidence:** The first version-safe injected attempt passed baseline and control setup but the selected
position remained a pass. The only `x64sc` invocation before position 11 was production's canonical
`--version` probe; the shim had checked the marker first, so the audit recorded an injection that never
reached route launch. Reordering implements the explicit AR-P63 contract and the next run consumed the marker
on the selected real VICE launch, producing the intended selected failure and passing control before the
later cleanup gate.
**Rejected alternatives:** Counting a version failure as the required launcher failure falsifies route
evidence. Bypassing version discovery weakens the present-but-wrong-version guard. Arming after discovery
would require a new production-visible synchronization seam.
**Strongest counterargument:** Argument-based probe recognition belongs in a test shim and could become stale.
The production invocation is exact and bounded to one argument; any changed shape fails the oracle rather
than consuming the marker silently.
**Confidence:** High — the audit and selected result moved to the required boundary after the single ordering
change.
**Hardening:** Assert two audit records only after the selected report and terminal candidate each fail, and
keep capability/version checks green before arming.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A version probe consumes a marker, a route injection occurs without an audit record, or
the selected occurrence remains pass after one audited non-version consumption.

### AR-P68 — Exact early-exit VICE child reconciliation and retirement (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correction of owned child cleanup after an authenticated launcher starts and exits before
monitor readiness; no foreign-process reclaim, lease-authority weakening or timeout increase.
**Objective:** Retain process-control authority after start and retire the exact child-recorded lease when an
owned launcher exits 127 before readiness.
**Decision:** Use cancellation only while process start is pending; after successful start, retain a private
process-lifetime authority independent of the route attempt signal. When owned-child close returns
`vice.closed`, perform a bounded reconciliation against the exact retained boot/PID/start/group/token
identity. Only positive absence permits exact launch-artifact retirement and compare-remove of the exact
lease generation. Identity drift, timeout, missing authority or ambiguous presence remains cleanup-blocked.
**Evidence:** Correctly targeted exit-127 injection produced the intended selected failure/control semantics
but immediate post-report cleanup failed. Later authenticated inspection showed generation 1, state clear,
child absent, proving natural exit after the report had retained the child-recorded lease. Production tracing
showed the attempt signal rejected the anchor completion/control channel after successful start; `vice.closed`
then unconditionally disabled final cleanup. The fix is green in focused lifecycle 3/3, VICE logic 134/134,
host 9/9 and real production 2/2; immediate inspection is generation zero and child absent.
**Rejected alternatives:** Automatic broad reclaim could signal an unrelated reused PID. Waiting in the
fixture would accept a leaked lease and hide cleanup latency. Manual lease deletion bypasses artifact and
identity proof.
**Strongest counterargument:** Extending cleanup after `vice.closed` risks acting after authority is stale.
The reconciliation is bounded and requires the exact retained process and lease identities at every step;
all mismatch paths remain fail-closed.
**Confidence:** High — the exact lifecycle branch was reproduced, a delayed-exit regression covers it, and a
real process gate proves prompt generation-zero retirement.
**Hardening:** A pre-fix real cancellation reproduction left one active test orphan. Its checksummed lease,
boot ID, PID 815953, start ticks 50889537, process group 815942 and launch token path were independently
matched through the production observer before terminating only that test-owned process group with SIGTERM.
Production inspection then proved child absence; exact generation/nonce clearing succeeded and returned the
namespace to generation zero. No lease or artifact was manually deleted.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** An early-exit owned child leaves a nonzero generation, process authority is cancelled after
successful start, reconciliation acts on changed identity, or any foreign/ambiguous lease is removed.

### AR-P69 — Retry-aware VICE occurrence injection (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Test-only execution of the existing two-attempt VICE policy; no policy, route, result,
confirmation or semantic-expectation change.
**Objective:** Make one semantic subject injection survive every launch attempt permitted for that exact
route while keeping audit evidence occurrence-based.
**Decision:** Each semantic arm creates two ordered owner-only marker files, matching the reviewed
`launchAttempts: 2` policy. Only an exact ten-argument VICE monitor launch may atomically consume one marker
and exit 127; exact version probes always pass through and invalid argument shapes consume none. Two fixed
attempt audit records form one complete semantic injection. Synchronization rejects partial pairs and maps
two attempts to occurrence 1 and four attempts to occurrence 2, preserving activity evidence `[1, 2]` and
one `armed`/`consumed` transition per semantic occurrence.
**Evidence:** With a one-shot marker, position 11 reported pass with `usage.launchAttempts: 2`, position 12
reported pass with one attempt, and exactly one route-launch audit consumption. The first subject attempt
therefore failed as intended and the reviewed retry passed. With the paired arm, both subject attempts fail,
the distinct control passes, and the report advances through sidecar and predicate authorization.
**Rejected alternatives:** Reducing the route policy to one attempt would stop testing the production policy.
Treating the first failed attempt as the route result would contradict production retry semantics. Counting
each attempt as a separate confirmation occurrence would falsify the state machine's unit of execution.
**Strongest counterargument:** Two marker files encode the current attempt bound. The local oracle is pinned
to the reviewed policy and validates that exact bound; any future policy change must reopen and update this
fixture explicitly rather than silently weakening coverage.
**Confidence:** High — public usage proved the retry and paired consumption produced the required terminal
route result.
**Hardening:** Require exact ordered marker permissions, exact argv validation, complete audit pairs, clean
lease state and two independent full-oracle runs.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The policy attempt bound changes, a non-route invocation consumes a marker, a partial
pair is accepted, or a selected occurrence passes after a complete pair.

### AR-P70 — Attribute process-wide cleanup across every VICE report occurrence (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Bounded diagnostic projection and fixture admission over the existing complete 62-route
report; no report order, route selection, cleanup or pass/fail behavior change.
**Objective:** Avoid attributing final process-wide lease state to positions 11/12 when later VICE routes
also execute in the same complete campaign.
**Decision:** Keep positions 11/12 as the exact first matched subject/control pair, but when a baseline or
injected lease guard fails, project every route whose declared terminal tier is VICE. Each bounded entry may
contain only position, case identity and public status/code/tier/stage/cleanup/launch-attempt fields. Attribute
the final lease only after examining that complete VICE subset. Never poll or clear inside the fixture.
**Evidence:** The fixed plan has 62 routes ordered by rule and tier; positions 11/12 are only the first VICE
pair. Runs alternated between clear baseline and a final generation-1 lease, while the selected pair remained
pass. The all-VICE diagnostic corrected the false selected-pair ownership assumption. Subsequent production
completion-race fixes and exact recovery returned the full campaign to prompt clear state.
**Rejected alternatives:** Blaming position 12 from final lease state ignores later routes. Polling would hide
publication-before-cleanup defects. Projecting all report fields would exceed the minimum diagnostic need.
**Strongest counterargument:** The diagnostic expands fixture code for a failure-only path. It remains bounded
to declared VICE routes and closed public fields, and directly prevents incorrect production remediation.
**Confidence:** High — route-plan ordering and sequential orchestration are explicit and the bounded
projection covers every possible VICE lease owner in this campaign.
**Hardening:** Keep the normal oracle assertions focused on the selected pair while retaining all-VICE detail
only in failing cleanup diagnostics.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The campaign cardinality/order changes, a non-VICE route can own the lease, or diagnostics
omit a declared VICE occurrence.

### AR-P71 — Private exact-result VICE observation bytes (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Private evidence authority needed by the existing report-position envelope bridge; no public
prepared-route, report, projection or serialized byte field.
**Objective:** Give a genuine non-pass VICE position canonical bytes whose digest exactly matches its final
result so envelope provenance can be authorized without exposing raw build evidence.
**Decision:** Retain bounded supervisor evidence bytes only behind the immutable sealed baseline, propagate
that private association across the sealed clone, and associate bytes only with the exact finalized VICE
result after digest, retained-length and budget validation. A package-private getter returns a defensive copy
for handled predicate-sidecar registration. Foreign results, mismatched digests, oversized bytes and replay
remain unavailable.
**Evidence:** The correctly injected report passed sidecar and predicate derivation but
`authorizeFailureEnvelopeFromReportPositionV1` rejected `/position`: the generic live-handler byte candidates
could not match the final sealed VICE evidence digest. After the private association, authority, forgery,
bounds, provenance and genuine report-position bridge suites are green and the oracle advances into
confirmation.
**Rejected alternatives:** Public raw bytes widen the authority surface and leak build evidence. Digest-only
comparison violates the exact-byte requirement. Fixture reconstruction would create untrusted parallel
evidence.
**Strongest counterargument:** Retaining supervisor bytes increases private memory. Existing evidence budgets
cap the byte count, copies are defensive and short-lived with WeakMap authorities, and no serialized surface
grows.
**Confidence:** High — the exact absent component was identified and the genuine bridge now authorizes.
**Hardening:** Enforce object identity, digest/length/budget equality, defensive copies and coverage ownership;
keep the public API unchanged.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Bytes become publicly reachable, a structural result copy resolves them, bounds are not
enforced, or a genuine non-pass position again lacks observation provenance.

### AR-P72 — Deterministic terminal-reason evidence for pre-observation VICE failures (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correction of not-reached observation identity for failures before authenticated monitor
observation; observed/pass evaluation evidence and separately retained build evidence remain unchanged.
**Objective:** Let two semantically identical launcher failures from distinct fresh builds reproduce the same
predicate by literal canonical-byte equality.
**Decision:** For pre-observation VICE failures, encode bounded canonical terminal bytes from only closed
reproducible facts: stage, code, optional adapter subcode and cleanup clear/blocked state. Exclude source,
candidate, build, evaluation and execution identities and the unstable cleanup-blocker digest. Set final
evidence digest and retained/evidence byte counts from those exact bytes, then associate them only with the
exact finalized result. Preserve build evidence separately in `PreparedViceBuildEvidenceV1`; leave all
observed/pass evaluation evidence untouched.
**Evidence:** After AR-P71, the full oracle authorized the historical origin and drove confirmation but
returned `flaky-failure`: historical and terminal sequence launcher failures carried different sealed-build
bytes. Confirmation comparison correctly requires literal equality. The deterministic terminal encoding is
green across terminal equality/mismatch tests, runtime adjacency 89/89, confirmation 5/5 and bridge 2/2; the
local oracle then reaches the expected `stateful-sequence-failure` with ordered observations and clean lease.
**Rejected alternatives:** Weakening comparison to digest or result-code equality violates the frozen exact-
byte contract. Including build identities preserves the false flaky classification. Reusing empty bytes for
every terminal discards useful closed reason evidence.
**Strongest counterargument:** Changing failure evidence identity can affect consumers of historical failure
digests. Those digests were build-specific and could not satisfy the confirmation contract; the new encoding
is version-one canonical terminal evidence, while pass/observed and accepted build evidence stay unchanged.
**Confidence:** High — the mismatch was reproduced end to end and the corrected stateful disposition is green
in the full real-tool oracle.
**Hardening:** Test equal facts across distinct builds, each changed terminal axis, byte-count consistency,
forgery resistance, full confirmation and the genuine report-position bridge.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Fresh identical terminal failures differ, changed terminal facts collide, build identity
re-enters terminal bytes, observed/pass evidence changes, or confirmation regresses to flaky.

### AR-P73 — Lazy payload derivation and single-owner observation evidence (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Private ownership and lifetime correction under existing public report, position, candidate and
predicate contracts; no serialized report field or reduction limit changes.
**Objective:** Keep Phase 3 memory bounded when a maximum campaign contains route-sized sources and evidence.
**Decision:** Report occurrences retain opaque source authority, never eager payload copies. Derive and cache the
canonical payload only for the genuine selected occurrence, remove it when its authority is consumed, and copy or
transfer bytes only at the worker boundary. Predicate evidence is the single private owner of normalized
observation bytes; provenance receives only that authority and returns a defensive copy for the selected
occurrence. Candidate projections and route state share one canonical retained payload rather than cloning it.
Standalone confirmation uses a dedicated one-case executor and retires it immediately after the terminal
checkpoint.
**Evidence:** Final performance review found that eager per-route payloads, duplicated observation bytes, repeated
candidate clones and protocol-lived standalone workers could retain or churn tens of GiB at selected hard maxima.
The corrected readiness and readiness-execution builds are green; focused boundedness and full verification remain
the phase-close gate.
**Rejected alternatives:** Lowering hard limits changes selected policy. Retaining duplicate trusted copies keeps
the same worst-case memory defect. Exposing raw bytes publicly widens authority and serialization surfaces.
**Strongest counterargument:** Lazy derivation can move validation cost into selection. Selection happens once per
genuine occurrence, is cached behind exact authority and remains bounded by the existing source limit.
**Confidence:** High — the ownership graph now has one payload and one observation-byte authority per selected
execution instead of per report occurrence.
**Hardening:** Cover maximum shallow inputs, repeated accessor calls, consumed authority retirement, worker
transfer and standalone shutdown; retain all public report bytes unchanged.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any complete report eagerly retains execution payloads, one observation has multiple private
byte owners, candidate projection clones source bytes, or a completed standalone worker remains live.

### AR-P74 — Explicit total observation authority (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correction of the already-required closed observation union; no new public result code, stage or
cleanup disposition.
**Objective:** Ensure every failure predicate has exactly one source-independent observed or not-reached identity.
**Decision:** Mint a private `FailureObservationEvidenceAuthorityV1` at the actual runtime observation boundary or
at the terminal boundary that proves observation was not reached. Its closed projection exposes only arm, digest
and byte length. Observed bytes encode oracle facts; not-reached bytes encode stable terminal facts. Both exclude
source, candidate, execution, route, build, timing, workspace and host-path identity. Cleanup remains a separate
predicate axis and cannot change the observation arm.
**Evidence:** Semantic review proved stage inference misclassified compare-stage evidence exhaustion and observed
VICE runs followed by cleanup failure, while several byte encodings included candidate/build identity. The
implementation-blind oracle now asserts equal semantic observations across irrelevant identity changes and
cleanup independence.
**Rejected alternatives:** Inferring from stage is not total. Optional bytes permit missing identities. Folding
cleanup into observation conflates two independently required predicate axes.
**Strongest counterargument:** A private authority adds one registry hop. It removes multiple ad hoc inference
sites and makes the security boundary auditable without changing report serialization.
**Confidence:** High — every constructor names the arm explicitly and exact bytes remain behind one opaque owner.
**Hardening:** Test observed and not-reached constructors, changed terminal axes, cleanup independence, exact byte
digest/length equality, foreign authority rejection and report-position authorization.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any path infers an arm from stage, emits an optional/missing observation, includes execution
identity in normalized bytes, or cleanup changes observation identity.

### AR-P75 — Fresh confirmation and checkpoint-bound classification (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Required confirmation semantics and durable evidence correction; no promotion of a new failure
class and no increase to sequence limits.
**Objective:** Prevent unexecuted direct-shrink candidates or unproven worker/order claims from being classified as
confirmed or stateful.
**Decision:** Every minimized failure, including `direct-shrink`, executes twice through distinct fresh standalone
roots, workers and isolates. Direct-shrink needs no known-good control; existing fresh-confirm classes still do.
Each evaluation binds an authenticated checkpoint digest, exact report position, attempt ordinal and sequence
position. Classification requires two launched distinct standalone identities, or one invariant sequence
worker/isolate with ordered report occurrences and distinct per-case roots. Final confirmation and sequence
evidence retain checkpoint references ordered with evaluation digests. Missing, rotated or prelaunch evidence
cannot classify.
**Evidence:** Correctness and semantics review found direct-shrink returned confirmed with zero runs and final
classification discarded the lifecycle evidence held privately by evaluations. The immutable oracle now requires
two direct-shrink runs/no control and exact standalone/sequence checkpoint ordering.
**Rejected alternatives:** Exempting direct-shrink contradicts RD-05 AC-10. Digest-only classification cannot prove
isolation or order. Exposing mutable lifecycle objects would weaken final evidence.
**Strongest counterargument:** Checkpoint references add terminal data. They are fixed-size digests and ordinals,
not paths or process handles, and are required to prove the classification already claimed.
**Confidence:** High — the retained evidence directly represents every reviewed isolation invariant.
**Hardening:** Test direct-shrink, rotated/missing/prelaunch checkpoints, repeated roots/workers/isolates, reordered
sequence positions, foreign evaluations and exact cleanup/shutdown.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any minimized candidate classifies without two fresh runs, checkpoint order diverges from
evaluation order, standalone identities repeat, or a sequence changes worker/isolate mid-attempt.

### AR-P76 — Complete claims, route contract and report tool provenance (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Fail-closed preservation of authenticated facts already required by the failure predicate; no
caller-selected route or tool authority.
**Objective:** Stop partial semantic matches from authorizing a predicate, known-good control or historical tool.
**Decision:** Derive the complete immutable required-rule subset from authenticated source authority and require
primary-rule membership. Match control subjects by the complete route-contract semantics: route kind, terminal
tier/obligation/prerequisites, policy, fixture, oracle, tools and diagnostic semantics, while excluding only
source/campaign identities. Report provenance binds actual authenticated Node/ACME/VICE version values; handler
implementation revisions remain separate digests and never substitute for external tool versions.
**Evidence:** Final correctness review found primary-only claim construction and handler contract version `1.0.0`
standing in for actual tools. Correctness and semantics review also found fixture identity missing from control
matching. Implementation-blind multi-claim, fixture-mismatch and real-tool-version cases now cover the complete
join.
**Rejected alternatives:** Primary-only claims lose an authenticated predicate axis. Hand-selected control fields
repeat the omission risk. Treating handler revision as tool version conflates code and host binaries.
**Strongest counterargument:** Complete semantic comparison is stricter than legacy fixtures. A control is evidence
only when it proves the same route contract; fixtures with partial identities must be corrected, not admitted.
**Confidence:** High — every retained field comes from existing authenticated source, predicate or report data.
**Hardening:** Test multi-claim ordering/membership, every route-contract axis, source/campaign independence, actual
tool versions, handler-version separation and foreign report positions.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Claims collapse to the primary rule, control matching omits a semantic axis, or a handler
contract value appears as an external tool version.

### AR-P77 — Fresh bounded tool-version discovery before isolated execution (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Reuse of the existing CLI discovery policy before the exact execution it authorizes; no executable
fallback, path search widening or tool policy change.
**Objective:** Prove historical Node/ACME/VICE identities still name the tools about to execute.
**Decision:** Extract the CLI's allowlisted, bounded `--version` discovery into one package-private seam used by
both CLI and confirmation. Immediately before every standalone candidate/control launch and each sequence position,
compare current `process.version` and freshly probe only required ACME/VICE tools. Require literal equality with
the authenticated report versions. Unavailability, timeout, excess output, invocation failure or version drift
fails closed before root, worker or subprocess launch as unavailable historical authority. Handler implementation
digests are validated separately.
**Evidence:** Review showed corrected report binding alone did not establish that the same external binary would
run during later confirmation. The shared seam avoids a second discovery policy, and the immutable ACME drift case
asserts rejection with no launch activity.
**Rejected alternatives:** Trusting historical values admits post-report replacement. Reimplementing probes in
confirmation creates policy drift. Hashing arbitrary host executables would require a new filesystem authority and
platform policy not present in RD-04.
**Strongest counterargument:** A version probe has process-launch cost and a narrow time-of-check gap. It is the
existing reviewed identity protocol, is bounded, and runs only for required tools immediately before isolated work.
**Confidence:** High — the same discovery code now creates and revalidates the compared values.
**Hardening:** Test exact match, Node drift, ACME/VICE drift, absence, timeout, excess output, invalid output and
zero root/worker/process activity on rejection.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** CLI and confirmation discovery diverge, a required version is not freshly checked, mismatch
launches any isolation resource, or current tools silently replace historical authority.

### AR-P78 — Concern-based oracle decomposition and measured observation watchdog (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Test structure and case-local timing only; no behavioral expectation, fixture independence,
production limit or global test timeout changes.
**Objective:** Restore the project file-size standard and let the new two-fixture observation oracle finish under
a truthful bounded watchdog.
**Decision:** Split the candidate oracle, its genuine fixture and confirmation implementation tests by concern so
every module stays below 700 lines. Preserve every expectation and implementation-blind boundary. The explicit
observation case keeps two independent genuine fixtures and receives a 600-second case-local timeout after its
first production-complete run reached the unchanged 240-second default before assertions. Leave all other case and
global timeouts unchanged.
**Evidence:** Final correctness review measured 1,051-, 1,743- and 957-line test modules. After decomposition the
main candidate spec is 422 lines, the local VICE spec 221 and the core fixture 592. The observation case timed out
at 241.59 seconds while constructing both genuine fixtures, with no assertion failure.
**Rejected alternatives:** Raising the global timeout hides unrelated stalls. Reusing one fixture weakens the
identity-independence proof. Removing assertions weakens the immutable oracle.
**Strongest counterargument:** A ten-minute watchdog can delay feedback. It is local to one integration-heavy case;
focused unit and implementation tests retain short bounds and the complete phase still has an outer verification
gate.
**Confidence:** High — the timeout is grounded in a measured genuine run and file decomposition is mechanical.
**Hardening:** Keep each module below 700 lines, preserve hashes after the final split, record the selected-case
duration and reject any global timeout increase.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any owned test exceeds 700 lines, fixture independence is reduced, the case exceeds 600 seconds,
or a global timeout is raised.

### AR-P79 — Exact external control occurrence (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Correcting genuine control provenance inside the approved fresh-confirm contract; no
classification, route or tool policy changes.
**Objective:** Prove a passing real VICE control under the exact same fixture and semantic route when the
subject report deliberately injects the failure into that route.
**Decision:** Let the confirmation context accept an optional opaque control position from a separately
authenticated report. Require both reports to bind the same historical parent, route-plan digest and exact tool
versions, and require the supplied position to pass the complete same-control-route comparison. The local fixture
uses the baseline report's passing occurrence of the exact selected position-11 route and the injected report's
position-11 occurrence as the subject. The two opaque occurrences are distinct even though their semantic route
is identical.
**Evidence:** The former positions 11/12 pair shared tier metadata but differed in fixture identity, which AR-P76
correctly made part of control matching. The separate un-injected baseline already executes the exact subject
route and provides the truthful passing comparison.
**Rejected alternatives:** Accepting position 12 would weaken complete semantic matching. Omitting the control
would violate fresh-confirm requirements. Reconstructing a pass from loose route fields would bypass report
authority.
**Strongest counterargument:** A second report enlarges fixture setup. The local acceptance path already creates
that baseline to prove healthy external execution, and production retains only the selected opaque occurrence.
**Confidence:** High — the full locally gated VICE oracle passes with a distinct exact-route control.
**Hardening:** Reject foreign parents, route plans, tools, non-pass controls and every route semantic mismatch;
retain no raw control fields.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A control passes comparison with different fixture semantics, a copied position authorizes,
or the exact-route baseline occurrence cannot be joined without loose reconstruction.

### AR-P80 — Dedicated executor capacity follows semantic lifetime (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Private worker lifecycle correction inside approved standalone and sequence isolation modes.
**Objective:** Make executor retirement prove the requested isolation boundary without retaining excess worker
capacity or relying on ordinary campaign-pool behavior.
**Decision:** Construct standalone confirmation and control executors with capacity one. Construct each sequence
executor with capacity equal to its authenticated terminal failing position, after validating that the case limit
equals that position and is at most 64. Retire every executor immediately after its semantic lifetime.
**Evidence:** Performance review found standalone confirmation used the sequence maximum despite executing one
case, while a fixed 64-case sequence executor weakened the claim that the authenticated attempt length owns its
lifetime. The dedicated fixture now observes the exact capacities.
**Rejected alternatives:** A universal capacity of 64 retains unnecessary state. The ordinary campaign pool has
an unrelated eight-case retirement policy and cannot prove fresh isolation. Caller-selected capacity is not
authenticated.
**Strongest counterargument:** Executor capacity is an implementation detail. It controls retained worker and
root lifetime, so matching it to the authenticated semantic boundary is part of the isolation proof.
**Confidence:** High — the capacity follows already validated values and introduces no new limit.
**Hardening:** Assert one-case standalone retirement, exact sequence capacity, case-65 prelaunch rejection and no
worker reuse across attempts.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A standalone executor accepts a second case, a sequence executor outlives its terminal
position, or ordinary pool retirement participates in confirmation.

### AR-P81 — Complete pre-allocation tool revalidation (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Ordering correction for the approved historical-tool check; executable discovery rules and
reported identities remain unchanged.
**Objective:** Ensure drift in any tool that confirmation may execute fails before the first isolation resource
exists.
**Decision:** Before opening the failure-execution protocol or allocating a root, worker, isolate or controlled
process, collect the union of external tools required by the subject, every preceding sequence occurrence and the
control. Reuse the shared bounded discovery seam once for that complete set and compare literal versions with
each authenticated report value. Reject drift or probe failure as historical authority unavailable.
**Evidence:** Per-step validation could allocate earlier standalone or sequence resources before discovering ACME
or VICE drift on a later occurrence. The corrected authenticated ACME drift oracle proves zero root, worker and
controlled-process allocation.
**Rejected alternatives:** Probing after each allocation leaves partial state. Trusting report values admits
binary replacement. Probing every route independently repeats bounded subprocess cost without strengthening the
version comparison.
**Strongest counterargument:** A whole-context preflight probes a tool that a later classification branch may not
reach. Confirmation owns that complete possible route set, and the bounded probe cost buys an atomic no-resource
failure boundary.
**Confidence:** High — the required-tool union is private authenticated data and the existing discovery policy is
reused unchanged.
**Hardening:** Cover Node, ACME and VICE drift, probe failure, mixed sequence/control requirements and zero
allocation on every rejection.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any required tool is probed only after allocation, route-local checks diverge from shared
discovery, or drift leaves a root, worker, isolate or process checkpoint.

### AR-P82 — Report-bound VICE cleanup visibility (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Fail-closed ordering at the existing campaign/report boundary; no lease mutation, timeout
increase, report field or route-result change.
**Objective:** Prevent a canonical campaign report from claiming completed cleanup while an early-exit VICE
child or recoverable lease generation remains observable.
**Decision:** When the authenticated route plan can execute VICE, delay report authorization behind a bounded,
read-only singleton-lease barrier using the selected cleanup grace. Success requires the absent namespace shape:
state `clear`, generation zero, empty nonce and `childAbsent: true`. An active child, retained generation
tombstone, inspection failure or timeout returns `emulator-lease-recovery-blocked` at `/vice/cleanup`. The barrier
never clears a generation or signals a process.
**Evidence:** The complete Phase 3 V8 gate reproduced an injected exit-127 report whose position result had no
cleanup blocker while an immediate production inspection still observed generation 1 active and its child
present. The same exact generation became child-absent moments later, proving a report/retirement ordering gap.
After exact API recovery to generation zero, the focused genuine VICE coverage oracle passed with the barrier and
finished at generation zero clear.
**Rejected alternatives:** Polling only in the fixture would approve false production authority. Accepting a
child-absent generation tombstone leaves the namespace occupied for the next campaign. Automatically clearing it
would turn report construction into an unrequested recovery mutation.
**Strongest counterargument:** A campaign-level barrier duplicates route cleanup observation. The route result is
already immutable when the delayed durable state becomes visible; the report boundary is the last place that can
still refuse false aggregate authority without changing RD-04 bytes.
**Confidence:** High — the defect reproduced only under slower V8 timing, the exact state transition was observed
through production APIs, and the focused true-external oracle passed from a verified empty namespace.
**Hardening:** Require generation zero rather than merely child absence, retain the existing cleanup-grace bound,
exercise the injected early-exit path under coverage and verify post-run generation-zero state.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A VICE-bearing report returns before generation-zero clear state, a barrier mutates recovery
authority, or a healthy campaign exceeds the selected cleanup grace.

### AR-P83 — Final V8 fixture watchdogs (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Case-local test timing grounded in measured final-closure execution; no behavior, assertion,
fixture independence, production limit or package/global timeout change.
**Objective:** Let genuine report-bound authority cases finish under V8 instrumentation without treating the
240-second package default as a semantic failure.
**Decision:** Apply a 600-second watchdog to the first complete predicate/observation/cleanup mismatch oracle and
the three candidate-execution implementation cases. Preserve their independent fixture construction and every
expectation. Leave the package default, all unrelated cases and production time budgets unchanged.
**Evidence:** The final closure measured the oracle at 241.8 seconds before assertions, while its adjacent genuine
cases completed at 261–366 seconds under existing local watchdogs. Candidate implementation measured 210 seconds
for the first case and timed out the remaining two at 240 seconds; the same cases had previously completed in
198–243 seconds under V8, proving load-sensitive setup rather than an assertion failure.
**Rejected alternatives:** Raising the package default hides unrelated stalls. Reusing fixtures weakens authority
independence. Removing genuine setup or assertions changes the proof. Treating the timeouts as production defects
confuses the test harness watchdog with the separately bounded execution policies under test.
**Strongest counterargument:** Ten-minute local bounds delay a true hang. They are limited to four known expensive
cases, remain below the existing 15-minute local VICE bound and are more than the measured maximum without being
open-ended.
**Confidence:** High — timings came from two complete V8 attempts and no semantic assertion failed.
**Hardening:** Keep the timeout as the final `it` argument, retain fixture independence, preserve hashes after the
spec timing-only change and reject any global timeout increase.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A case exceeds 600 seconds, loses an assertion or independent fixture, or an unrelated timeout
is raised to accommodate these cases.

### AR-P84 — Generated catalog owner lookup (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal module-boundary correction exposed by the exact repository verification; no public
package export, catalog schema, revision algorithm or authority rule changes.
**Objective:** Let predicate evidence bind exact current handler revisions without allowing a non-owner module to
import generated catalog bytes directly.
**Decision:** Keep the generated catalog import in `execution-publication-catalog.ts`, one of the three existing
owner modules, and export narrow tier-to-implementation-revision and revision-to-tier lookups from that owner.
Predicate contracts and report provenance consume only those scalar values and retain their existing digest,
uniqueness, route-tier and tool-identity checks.
**Evidence:** Exact verification failed only the existing catalog ownership specification, naming
`execution-predicate-contracts.ts`; the focused rerun then exposed the same pre-existing direct import in
`execution-report-provenance.ts`. A complete literal scan confirmed those were the only two non-owner imports.
The orchestration closure already depends on the catalog owner, so this adds no new package or authority boundary.
**Rejected alternatives:** Adding the predicate module to the owner allowlist would distribute generated-byte
authority. Weakening the literal scan would hide future escapes. Duplicating revision values would become stale
and sever the generated closure proof.
**Strongest counterargument:** A lookup adds an internal exported function. Its return is deliberately narrower
than the generated row, exposes no catalog object or mutable bytes and keeps ownership centralized.
**Confidence:** High — the failing specification identifies the exact path and the existing owner module already
owns both the generated rows and live publication validation.
**Hardening:** Rerun the catalog ownership specification, regenerate/check all execution bindings because the
participating closure changed, rerun Phase 3 coverage and the exact repository command.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any non-owner imports the generated catalog, the lookup exposes a complete row/catalog, or
predicate evidence can accept a missing, malformed or duplicate revision.

### AR-P85 — Load-bounded fixture completion (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Case-local test scheduling and fixture synchronization grounded in two complete V8 runs; no
production behavior, semantic expectation, production limit or package/global timeout change.
**Objective:** Distinguish a genuinely incomplete external VICE audit or stuck authenticated fixture from normal
completion variance under repeated full-tree instrumentation.
**Decision:** Await the two mirrored external VICE audit records behind a 15-second fixture-only deadline before
projecting each injection, rejecting extra, stale, non-route or still-incomplete records exactly as before. Apply
a 600-second case-local watchdog to the confirmation-context join, typed-invalid direct-shrink and candidate-route
boundary tests. Preserve every expectation, independent fixture, production budget and global timeout.
**Evidence:** The first authoritative V8 gate passed all four cases at 195–263 seconds and the local VICE oracle at
235 seconds. After the AR-P84 participating-byte regeneration, a second full gate under sustained load measured
the same genuine fixtures at 248–300 seconds and observed the VICE audit before its second mirrored record arrived;
all frozen candidate and confirmation semantics had already passed unchanged.
**Rejected alternatives:** Raising the global timeout hides unrelated stalls. Reading the audit once preserves a
filesystem/process race. Accepting one mirrored record weakens the launcher proof. Reducing genuine fixture setup
or sharing authorities weakens the isolation and historical-join contracts.
**Strongest counterargument:** Longer local watchdogs make a true hang slower to report. They are limited to three
measured fixtures, remain below the existing 15-minute local VICE bound and keep the external audit deadline at
15 seconds.
**Confidence:** High — both failures are bounded timing observations, the exact semantic oracles remained green,
and the lease ended generation-zero clear with no child.
**Hardening:** Rerun the four affected files together, freeze the changed local VICE oracle/support hashes, rerun
the complete RD-05 coverage gate and exact repository verification, and confirm the post-run VICE lease is empty.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The audit exceeds 15 seconds, records an extra/non-route launch, any affected case exceeds 600
seconds, or a semantic expectation changes to accommodate timing.

### AR-P86 — Historical-authority case-local watchdogs (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Case-local test scheduling grounded in three complete V8 runs; no production behavior, semantic
expectation, production limit or package/global timeout change.
**Objective:** Preserve the historical-tool and missing-authority oracles while distinguishing genuine fixture
failure from completion variance on a memory-pressured host.
**Decision:** Apply the existing 600-second case-local watchdog to the authenticated ACME-version-drift and
missing-historical-authority cases. Preserve their setup, isolation, assertions, production budgets and the
package/global timeout.
**Evidence:** Both cases passed unchanged in the first two complete coverage gates at 199–207 seconds. During the
third sustained-load gate, with 16 GiB of 17 GiB swap occupied, they reached the 240-second default without an
assertion mismatch while the preceding unchanged confirmation cases took up to 314 seconds.
**Rejected alternatives:** Raising the global timeout would hide unrelated stalls. Weakening the historical
authority fixtures or assertions would change the oracle. Terminating unrelated user processes would exceed task
scope and would not make verification portable under legitimate host pressure.
**Strongest counterargument:** A longer watchdog delays reporting a true hang. The change is limited to the two
measured genuine fixtures, matches the already-authorized case-local bound and remains below the 15-minute real
VICE bound.
**Confidence:** High — repeated green semantics and direct host-pressure evidence isolate the failure to the
watchdog rather than production behavior.
**Hardening:** Freeze the superseding confirmation-oracle and bundle hashes, rerun the affected cases, then rerun
the complete RD-05 coverage gate and exact repository verification.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Either case exceeds 600 seconds, produces a semantic mismatch, or needs a broader timeout.

### AR-P87 — Non-reproducible full-load VICE launch failure (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Verification retry after a single external emulator launch failure; no production, test-oracle,
budget or timeout change.
**Objective:** Distinguish a deterministic launcher regression from a transient external VICE start failure at
the end of the full Turbo package tier.
**Decision:** Preserve the one-attempt production contract and exact test expectation. Confirm the global lease is
generation-zero clear with no child, rerun the complete production VICE test in isolation, and rerun the full
repository test tier without modifying code.
**Evidence:** The exact gate passed 540 of 541 `readiness-execution` tests, then one production VICE case returned
`emulator-launch-failure` with one launch attempt and zero instructions. The companion cancellation/cleanup case
passed, the post-run lease was clear, and an immediate isolated rerun passed both production cases in 845 ms.
The authoritative RD-05 real-VICE coverage case had also passed at 248 seconds with a clear post-run lease.
**Rejected alternatives:** Retrying inside production would violate the selected one-attempt budget. Weakening or
skipping the real-emulator expectation would hide a parity boundary. Changing code from a non-reproducible launch
failure would be ungrounded.
**Strongest counterargument:** A full-tier-only failure can expose cross-package contention. The clean lease and
immediate isolated pass do not prove its external cause, so a second complete test tier is required before commit.
**Confidence:** Medium-high — cleanup and isolated production evidence are strong, but only a green full rerun closes
the gate.
**Hardening:** Rerun `yarn test`; reopen and diagnose launcher audit/evidence if the same failure recurs.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any repeated `emulator-launch-failure`, dirty lease, orphan child or changed semantic result.

### AR-P88 — Full-load owned launch-failure tombstone (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Exact-generation recovery and one bounded full-tier reproduction after an intermittent external
launcher cleanup failure; no policy, production or oracle change unless the tombstone repeats.
**Objective:** Determine whether the authentic injected launcher failure exposes a reproducible owned-cleanup
defect under the fixed 120-second route and 3-second reserved cleanup policy.
**Decision:** Treat the full-load generation-1, child-absent lease as a reopening of the owned-launch-failure
cleanup ruling. Clear only that exact positively absent generation through the production recovery API, prove
generation-zero state, rerun the local VICE oracle in isolation, then run one final complete repository test tier.
If the tombstone repeats, fix production cleanup rather than retrying or weakening the fixed policy/oracle.
**Evidence:** The second full tier classified the local VICE confirmation as flaky, then five later fixtures and
both production VICE cases failed behind the retained generation. Inspection proved state `clear`, generation 1,
the exact 64-hex nonce and `childAbsent: true`; exact recovery succeeded. The focused authentic oracle then passed
in 135 seconds and left generation zero, empty nonce and no child.
**Rejected alternatives:** Raising the fixed route or cleanup policy contradicts AR-P60/RD-04. Automatically
clearing at the report barrier contradicts AR-P82. Repeated unbounded retries would conceal a production defect.
**Strongest counterargument:** One more two-hour tier is costly. It is the only remaining way to separate a rare
external scheduling failure from a repeatable cleanup-path defect without changing accepted semantics.
**Confidence:** Medium — isolated evidence is green, but the full-load condition must be reproduced once.
**Hardening:** Run the complete `yarn test` tier from verified generation-zero state and inspect the lease after it.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any retained generation, local VICE semantic mismatch or production VICE failure in the final
full-tier reproduction.

### AR-P89 — Cancelled pending-launch cleanup ownership (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal cleanup ownership inside the accepted exact-attempt and exact-lease boundaries; no route,
work, cleanup, retry, oracle or recovery-policy increase.
**Objective:** Ensure a launcher start cancelled at the work deadline cannot consume the coordinator's reserved
cleanup interval before exact artifact and lease retirement.
**Decision:** While process start is pending, continue binding it to the attempt signal. If that start settles as a
failure after the attempt signal is cancelled, the recorded control host must return `vice.closed` without opening
its separate two-second artifact-cleanup window. The coordinator then uses its existing all-outcomes cleanup path to
prove child absence, retire the exact attempt artifact and compare-remove the exact lease. A non-cancelled process-
start failure retains the control host's immediate exact-artifact cleanup and `vice.spawn` classification.
**Evidence:** The final full-load reproduction repeated the generation-1, child-absent tombstone at the authentic
launcher injection, firing AR-P88's production-fix trigger. The recorded control host currently cancels pending
start from the attempt signal but then calls `#retireArtifact` with a fresh two-second timeout; the coordinator can
only begin its mandatory artifact/lease cleanup after that private interval. RD-04 reserves the final 3,000 ms
exclusively for cleanup under the original hard deadline, and the coordinator already owns the exact retained lease
reference needed to finish both mutations.
**Rejected alternatives:** Reserving an invented sub-slice for lease removal does not address the earlier private
two-second cleanup and cannot guarantee progress if it begins after cancellation. Extending the hard deadline or
cleanup grace violates the fixed policy. Retrying the full tier again would conceal the reproduced defect.
**Strongest counterargument:** Deferring artifact retirement after cancellation briefly retains a prepared artifact.
It remains bound to the exact authenticated lease and is retired immediately by the coordinator's finally path;
foreign, changed or ambiguous authority remains cleanup-blocked.
**Confidence:** High — the duplicated cleanup ownership and budget inversion are directly visible in the production
call graph and occur on the exact repeated failure boundary.
**Hardening:** Add a low-level regression that cancelled pending start performs no private cleanup, plus a coordinator
regression proving the exact artifact and lease retire under its reserved authority; then rerun focused real VICE,
the full RD-05 coverage gate and exact repository verification from generation-zero state. The two focused files
passed 56/56, production VICE passed 2/2, the authentic local oracle passed in isolation and again under sustained
V8 coverage, and the complete coverage gate passed 63/63 at 94.10% aggregate branches in 8,340.84 seconds. Final
inspection proved generation zero, empty nonce and child absence; exact repository verification remains pending.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** A cancelled pending start performs control-host cleanup, coordinator cleanup retains an owned
child-absent generation, or the change alters a non-cancelled process-start failure.

### AR-P90 — Final VICE artifact/lease retirement transaction (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Internal consolidation of two existing exact-identity filesystem mutations inside the fixed cleanup
grace; no deadline, retry, recovery, foreign-process or oracle-policy change.
**Objective:** Retire an already-proven-absent final child's authenticated launch artifact and exact lease without
spending the fixed cleanup grace on two mutation-lock acquisitions and two directory durability barriers.
**Decision:** Strengthen production `compareRemoveLease` so that, while holding its existing pinned-namespace
mutation lock, it validates any retained canonical launch artifact against the lease record, positively rechecks a
recorded child's absence, then removes artifact and lease before one directory sync. Final coordinator cleanup uses
this single exact transaction. Separate `compareRemoveLaunchArtifact` remains mandatory between launch retries,
where the lease must stay live before the next attempt.
**Evidence:** After AR-P89, the complete 23-file V8 coverage gate passed 63/63 including the 268-second authentic
VICE case, but exact repository verification reproduced the same generation-1, child-absent tombstone after 123.9
seconds and cascaded to six later files. Production inspection showed no launcher or VICE process. The final runtime
path currently calls `compareRemoveLaunchArtifact` and `compareRemoveLease` consecutively; both acquire the same
cooperative mutation lock and each performs a directory sync, while `compareRemoveLease` already attempts to unlink
the retained token path. The duplicated final durability path—not child termination—is therefore the remaining
bounded-progress defect.
**Rejected alternatives:** Another watchdog increase cannot retire state. Extending the fixed route or cleanup
budget violates RD-04. Automatically clearing at the report barrier violates AR-P82. Removing the artifact without
validating its exact lease/process identity weakens the existing fail-closed boundary.
**Strongest counterargument:** Strengthening lease removal makes that host operation more complex. It replaces an
already duplicated final mutation and closes the race between artifact retirement and lease removal; retry cleanup
keeps the smaller artifact-only operation.
**Confidence:** High — both repeated failures retain the exact state produced by the two-transaction final path,
and the host implementation exposes the duplicate lock/sync sequence directly.
**Hardening:** Production-host atomic-retirement and runtime cleanup regressions passed 65/65; real production VICE
passed 2/2; the sustained-load local VICE oracle passed; RD-05 coverage passed 63/63; exact repository tiers passed
with readiness 1,506/1,506, readiness-execution 543/543 and root boundary 33/33. Final lease inspection proved
generation zero, empty nonce and child absence.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Final cleanup performs two durability transactions, removes a changed/live artifact or process,
or leaves any positively absent owned generation under sustained load.

### AR-P91 — Orchestration implementation watchdog (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Case-local implementation-test scheduling grounded in measured focused and full-load runs; no
production behavior, assertion, execution policy or package/global timeout change.
**Objective:** Keep the complete unavailable-tools orchestration fixture bounded without confusing host-load
variance with a semantic failure.
**Decision:** Change only the existing explicit timeout on `aggregates every selected route when local tools are
unavailable` from 240 to the already-established 600 seconds. Preserve the genuine fixture, all route and authority
assertions, and every production budget.
**Evidence:** Exact repository verification reached the explicit 240-second watchdog at 244.6 seconds without an
assertion mismatch. The unchanged case then passed alone in 169.0 seconds. Its genuine publication, campaign and
route construction matches the other fixture-backed cases already bounded at 600 seconds under AR-P83/AR-P86.
**Rejected alternatives:** Raising the package/global timeout hides unrelated stalls. Reducing the campaign or
assertions weakens coverage. Changing production for a case that passes unchanged in isolation is ungrounded.
**Strongest counterargument:** A longer watchdog delays a true hang. It remains local to one measured test and
retains a finite bound below the existing 15-minute real-VICE test ceiling.
**Confidence:** High — focused success and a full-load timeout only 4.6 seconds beyond the old bound isolate
scheduling variance.
**Hardening:** The focused case passed unchanged, then exact repository verification passed under sustained load;
the full readiness-execution tier completed 543/543.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** The case exceeds 600 seconds, changes semantic output, or another ordinary implementation case
requires a broader timeout.

### AR-P92 — Confirmation tail watchdogs (runtime)

**Authority:** AI — delegated by `--auto-design`
**Eligibility:** Case-local specification scheduling grounded in repeated unchanged executions; no production,
semantic expectation, production limit or package/global timeout change.
**Objective:** Preserve the owned-shutdown, flaky and infrastructure-control oracles under legitimate sustained
host pressure without weakening their independent fixtures.
**Decision:** Apply the established 600-second case-local watchdog to exactly those three cases. Preserve every
fixture, assertion, isolation boundary and production budget.
**Evidence:** The immediately preceding complete coverage gate passed the unchanged cases at 225.8, 230.8 and
233.4 seconds; exact verification passed them at 125.7, 124.0 and 126.6 seconds. The final coverage attempt then
reached exactly the 240-second default in all three with no assertion mismatch, while neighboring unchanged cases
also slowed. This is the same measured load profile already governed by AR-P83/AR-P85/AR-P86.
**Rejected alternatives:** Raising the global timeout hides unrelated stalls. Reducing isolation or assertions
weakens the immutable oracle. Changing production for repeated semantically green cases is ungrounded.
**Strongest counterargument:** Three more longer watchdogs delay genuine hangs. Each remains individually bounded,
and the change is limited to cases already measured within 14 seconds of the former ceiling before this run.
**Confidence:** High — two green runs and exact default-bound failures isolate scheduling variance.
**Hardening:** The complete confirmation oracle passed under coverage; RD-05 coverage passed 63/63 and exact
repository verification passed with readiness-execution 543/543 from generation-zero state. Final lease
inspection proved empty nonce and child absence.
**Policy version:** 1 · **Root invocation ID:** `exec-plan-rd05-20260830-1137`
**Reopen trigger:** Any case exceeds 600 seconds, changes semantic output, or needs a global timeout change.
