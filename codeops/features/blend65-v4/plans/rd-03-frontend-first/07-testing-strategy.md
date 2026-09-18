# Testing Strategy: RD-03 Frontend First

> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P4–AR-P7

## Approach

Use existing Vitest, colocated `.spec.test.ts` and later `.impl.test.ts` files.
Specification authors use the raw chapters, approved component contracts and
these cases, without opening frontend implementation. Expectations are immutable.
All listed parameter rows are required; no new percentage gate or runner.
The frozen test-visible fields are in source/syntax §Frozen test-visible contracts
and semantic analysis §Frozen semantic observations. Each author receives the
owning phase's excerpt before writing tests. Phases 4/5 use `analyzeModules` and
its internal `ModuleAnalysisResult`; final acceptance uses `analyzeProject`.
An intermediate result's completion never proves a usable typed program.

Unless a row gives a whole source, wrap declarations in `module Game;` and local
expressions in `function main(): void { ... }`. Valid helper declarations are
supplied when a row uses a call. Inputs are exact UTF-8 `SourceRecord`s; integration
fixtures use the real RD-02 loader, not a fake snapshot service. Assertions check
the smallest proving spans and canonical Chapter 14 message with its concrete
placeholders, not codes alone. Literal mapping/profile checks are not mocked.

## 🚨 Specification Test Cases

### Source and Syntax

| ID | Concrete input/scenario | Expected output | Source |
|---|---|---|---|
| ST-1 | `\uFEFFmodule Game;\r\n/*é🎮*/let x: byte = 1;` | Module token raw span `[3,9)`, line 1 column 4; `let` starts at raw byte 27, line 2 byte column 11; EOF equals raw byteLength. BOM skipped and no comment token. | Ch 01 §§2–3, §11.4; AR-P4 |
| ST-2 | `255 256 $FF 0Xff 0b1111 1_000 007` | NUMBER values `255,256,255,255,15,1000,7`; only `007` produces W10210; spellings/spans remain recoverable. | Ch 01 §6, §12 |
| ST-3 | `for For as until to downto step peek type`; separately `let peek: byte = 1;` and actual `type` syntax use | Phase 1: KW_FOR, seven identifiers, KW_TYPE; no legacy range tokens or semantic declaration errors from lexing. Phase 2: actual `type` syntax use E10224. Phase 4: `peek` declaration E10212. | Ch 01 §§5–7; grammar §9; PF-002 |
| ST-4 | `a<<=1; a&&b; a!=b; a/=2; //é\n/* one /* two */x` | Longest operator tokens SHIFT_LEFT_EQUAL, LOGICAL_AND, BANG_EQUAL, SLASH_EQUAL; comment ends at first `*/`, leaving identifier `x`. | Ch 01 §11 |
| ST-5 | Separate `é`, `/*`, `1__0`, `0x`, `0bytes`, `65536` | Respectively E10210, E10211, E10213, E10214, E10215, E10216 with proving raw spans and canonical messages. No valid replacement literal. | Ch 01 §§2,6,14; Ch 14 |
| ST-6 | `""`, `'A'`, `"£\n\x41"`; separate `"\q"`, `"\x1"`, `''`, `'AB'`, unterminated `'A` | Empty string valid; Unicode scalar, symbolic newline and exact byte 65 retained without target conversion. Errors E10219, E10220, E10221, E10222, E10223 respectively. | Ch 01 §§7–8; Ch 14 |
| ST-7 | `a = b = 1 + 2 * 3; true ? a : false ? b : c; a + b << 1; a & b ^ c \| d && e \|\| f;` | Assignment and conditional right-associate; multiply nests inside add; add inside shift; bitwise AND inside XOR inside OR inside logical AND inside logical OR. | Ch 04 §2; grammar §6 |
| ST-8 | `import { f as g } from Math;` and local `let as: byte = 1; let until: byte = byte(2);` | Alias recognized only inside import; ordinary `as`/`until` bindings; byte cast distinguished from named call. `x as byte` is a syntax error, not a cast. | grammar §§2.3,6.3,9.3 |
| ST-9 | `f(1, g(2,3)).x[4]; let a: byte[3] = [1;0]; let s: S = { x:1 };` | Ordered call/member/index chain; one array fill item, not concatenation; struct literal in expression position. Type/name validity belongs to analysis. | grammar §§6.4–6.7 |
| ST-10 | `for (;;) { break; } for (let i: word = 0; i < 2; i += 1) { continue; } for (a=1,b=2;true;a+=1,b+=1) { return; }` | Three independently optional clauses represented; empty clauses remain absent; declaration initializer and ordered two-element lists use ordinary expression AST; jump nodes preserved. | grammar §5.8; Ch 05 §7 |
| ST-11 | `module Game; function main(): void { let x: byte = 1 }` | `PARSE_SYNTAX_ERROR`, `Expected ';', found '}'`, primary closing-`}` byte span; no valid declaration synthesized. | AR-P3; source/syntax §Approved syntax diagnostic |
| ST-12 | `module Game; function main(): void {` | `PARSE_SYNTAX_ERROR`, `Expected '}', found end of file`, zero-width EOF primary and opening `{` related span/message. No typed program. | AR-P3, AR-P6; source/syntax §Recovery |
| ST-13 | Separate missing `module`; duplicate `module`; module-level `poke(1,2);`; `let x = 1;`; `function f() {}`; `const x: byte;` | E10001, E10002, E10010, E10150, E10170, E10190 respectively. Generic syntax diagnostic never replaces a published class. | Chs 01,03,06,10; Ch 14 |
| ST-14 | Valid `enum E { A }`, `switch (x) { case 1: break; }`, `comptime function f(): byte { return 1; }`, or `let f: fn(byte):void;` in reachable source | Incomplete syntax/implementation obligations with exact regions; no invented language restriction, fake ordinary node or usable typed program. Unchecked source not claimed valid. | RD-03 coverage matrix; AR-P4–AR-P5 |

### Modules, Scalars and Control

| ID | Concrete input/scenario | Expected output | Source |
|---|---|---|---|
| ST-15 | Two differently named files declare `module Game;`, contributing `main` and helper `f`; then add a second `f` | Legal contributions merge independent of filenames; duplicate is E10003 with both declaration spans. | Ch 10 §§2,6; R3.7 |
| ST-16 | Game imports `f as g` from Math; Math exports f and imports an exported Game constant without initializer dependency; then remove f's export | Declaration cycle accepted; alias resolves same function identity; removing export produces E10012. | Ch 10 §4 |
| ST-17 | Game refers to `Math.f()` without an import; Other has valid module header but invalid body for another target; vary file paths/input ordering | Phase 3: Math becomes reachable, Other body is not analyzed; identical semantic names/graph and no path-to-module inference. Phase 6: same name-based initializer schedule, qualified alongside ST-41/ST-42. | Ch 10 §4.4; upstream AR-028/AR-030; PF-002 |
| ST-18 | Separate selected graph with no main, wrong `main(x:byte):void`, two reachable module mains, or helper calling main | E10020, E10022, E10021, E10023 respectively; no typed program. Unreachable alternate-entry main alone is not a collision. | Ch 10 §5; upstream AR-030 |
| ST-19 | Module `let x:word=2;`; `function f(x:word):void { let x:word=1; }`; separate nested block `let x:word=x+1;` | Parameter/local duplicate E10003; child initializer resolves outer binding then child binding takes over; identity differs by declaration span, not spelling. | Ch 03 VAR-5–8; Ch 06 FN-13 |
| ST-20 | Local access after `for (let i:word=0;i<2;i+=1){}`; use `Missing` as a type; use undeclared `x` | Loop binding absent after loop, E10239; unknown type E10241; undeclared x E10239, canonical messages and proving identifier spans. | Chs 03,05; Ch 14 |
| ST-21 | Parameterize typed pairs: byte+byte, byte+word, sbyte+sword, byte+sbyte, Boolean+byte, Boolean<Boolean, `-byteVariable`, `-42` assigned sbyte | Result types byte, word, sword; errors E10081, E10151, E10154, E10083; negative literal remains legal sbyte. | Ch 02 TS-2–8 |
| ST-22 | `const x:byte=200+100; const y:word=200+100;` versus locals `let a:byte=200; let b:byte=100; let r:word=a+b;` | Constant x E10084 for 300; y constant 300; runtime r has byte-wrapped intermediate 44 then widens; W10161, not W10160. | Ch 02 TS-9/18/20 |
| ST-23 | Constant/type facts `byte($1234)`, `sbyte($80)`, `sword(sbyte($80))`, typed signed `-128 >> 1`, `-128 >> 8`, unsigned `128 >> 8`; separate `byte(true)`; plus division/remainder parameter rows below | Values 52, -128, -128, -64, -1, 0; narrowing warning when predicate holds, wide-shift W10174; Boolean cast E10086. Required division/remainder results and diagnostic/runtime distinctions below also pass. | Ch 02 TS-12/19/20; Ch 04 §§3.3,4; PF-003 |
| ST-24 | `a=b=next(); a += delta(); false && flag(); true ? left() : right();` | Typed syntax preserves right association, once-only place/old-read/RHS/store order, computed assignment result and explicit skipped branches. Calls are not duplicated or reordered. No runtime execution claim. | Ch 04 OP-E1/OP-A1; R3.9 |
| ST-25 | `function f(a:byte,b:byte):byte{return a+b;}` and `f(1,f(2,3))`; separate `f(missing)` | Nested call valid, not recursive; wrong-arity E10171 retained alongside independent E10239 for missing; dependent result-type cascade absent. | Ch 06 FN-10; Ch 14 §2.1 |
| ST-26 | `f` directly calls f; separate f→g→f | E10180 or E10181 respectively; complete ordered call-edge path and related locations; no typed program. | Ch 06 FN-6; Ch 14 |
| ST-27 | `if(1){}` versus `if(true){}`; separate byte assignment used as condition | E10100 for integer condition including assignment result; Boolean condition valid. No numeric truthiness. | Ch 05 CF-2 |
| ST-28 | Byte-returning f has only `if(flag){return 1;}`; then add else return; separate void f returns 1 / byte f bare return | E10102 without else, complete return proof with else; E10173 / E10174 respectively. | Ch 06 FN-5; Ch 14 |
| ST-29 | Canonical byte `for(let i:byte=0;i<256;i+=1){}` versus word counter; separate byte loop with an explicit break; `for(;;){}` | E10262 only for proved nonterminating finite-looking byte pattern; word loop, explicit-exit case and intentional infinite loop legal. Structured continue target is update; break/return target is exit, not update. | Ch 05 §7.2–7.5 |

### Aggregates, Effects and Completion

| ID | Concrete input/scenario | Expected output | Source |
|---|---|---|---|
| ST-30 | `struct Enemy { x:word; y:byte; alive:boolean; }`, `Enemy[6]` | Field offsets 0,2,3; size 4 with no padding; array count 6 and size 24. Nominal Enemy identity retained. | Ch 07 SR-2; Ch 02 TS-24 |
| ST-31 | Enemy literals omit alive, list y before x, or add hp | E10096, E10097, E10243 respectively; all fields in declared order is valid. | Ch 07 §4.2; Ch 14 |
| ST-32 | `let a:byte[]=[1,2,3]; let b:byte[5]=[1,2;0]; let c:byte[]=[1;0]; const d:byte[5]=[1,2]; let e:byte[2]=[1,2,3];` | a resolves byte[3]; b complete values 1,2,0,0,0; c E10114; d E10113; e E10112. | Ch 08 §4 |
| ST-33 | `let a:byte[0]=[];` then separate `a[0]` | Zero extent/size valid, no W10141; index 0 E10240 for extent 0. | Ch 08 AR-2 |
| ST-34 | Extents -1, 65535+1 and true; `word[32768]`; `byte[65535]` | First three E10264, object size 65536 E10265, final size 65535 accepted. No byte/host arithmetic truncation. | Ch 02 TS-24; Ch 08 AR-1 |
| ST-35 | Arrays a:byte[500], b:byte[600], local i:byte=255; `a[i+10]`, `b[i<<1]`, `a[i<<1]` | Ordinal facts 265 and 510; first two in extent, final E10240 for 510 against 500. No wrap to 9/254. | Ch 08 AR-4 |
| ST-36 | Same i/a; `a[byte(i+10)]`; store narrow j=i+10 then `a[j]`; call byte-returning g then `a[g()]`; `a[index()] += delta();` | Explicit cast/stored/called results are narrow barriers; first two ordinal 9, not 265. Called result retains byte wrap before index widening. Parentheses alone do not narrow. Indexed compound assignment evaluates index/place once, reads once before delta, stores once and returns the computed written value. | Ch 08 AR-4; Ch 04 §3.5–3.6 |
| ST-37 | Mutable Enemy passed to const Enemy parameter; attempt p.x=1 through const parameter; const array passed to mutable exact-array parameter; scalar const parameter | Read-only binding accepts mutable object; write E10123; const-to-mutable E10122; scalar const E10246. No hidden copy or changed parameter ABI. | Ch 06 FN-3; Ch 08 CP-1–5 |
| ST-38 | Module/local `let a:byte[2];`; local read a[0]; partial `let b:byte[2]=[1];` then b[1]; local scalar read before assignment versus assigned on both branch arms | W10141 at both nonzero uninitialized array declarations; W10190 only local possible unassigned reads; partial array W10140 and local uncovered-element W10190; both assigned arms remove scalar W10190. No invented zero initialization. | Ch 03 VAR-2; Ch 08 §4.8; Ch 14 |
| ST-39 | `poke(addr(),value()); pokew(addr(),wide()); peekw(p);` where addresses return word | Dynamic address legal; ordered single evaluations; volatile write/read widths 1/2/2; word accesses low then high; no literal restriction, assigned pointer scratch or duplicated call. | Ch 12 §3; R3.9 |
| ST-40 | `sizeof(byte[2])`, `length(a)` with `let a:byte[300];`, `offsetof(Enemy,alive)`; separate `a[true]`, `enemy.hp` and `a==a` | Query type always word; values 2,300,3; errors E10263, E10242, E10121. | Ch 02 TS-21–25; Chs 07/08 |
| ST-41 | `let z:word=1; let a:word=z+1;` versus two independent `A.x` and `B.x` initializers, with renamed/reordered files | Dependency schedule z before a; independent schedule A.x before B.x by ASCII name, not filenames or inputs. | Ch 10 §5.4 |
| ST-42 | `let a:word=f(); let b:word=1; function f():word{return b;}`; separate `let a:word=b; let b:word=a;` | Transitive call-read schedules b before a; actual cycle E10194 with initializer/read/call path when applicable; import cycles alone do not error. | Ch 10 §5.4 |
| ST-43 | Valid ordinary main alone; then valid aggregate-return function, embed declaration, character literal or demanded profile module; combine unsupported form with admitted function reading undeclared name | Ordinary admitted program complete with typed program; each outstanding form incomplete with proving obligation/no program; mixed case retains E10239 error alongside incomplete status. Never retired aggregate code or fabricated asset/profile type. | AR-P4–AR-P5; semantic §Service boundary |
| ST-44 | Two sources with independent errors; repeat analysis with same content; one source with 21 independent undeclared-name reads | Stable source/span/code order and identical diagnostics; at most 20 errors, incomplete if checks remain; no program. Error-free completed analysis cannot arise from truncation. | AR-P6; Ch 14 §2 |
| ST-45 | Missing `;` before a following valid declaration plus independently undeclared name; nested balanced expressions and unclosed region | Phase 2: recovery advances or returns to delimiter owner; preserves following declaration/name-expression siblings, syntax diagnostic and explicit poison/unchecked state, without diagnosing unresolved names. Phase 6: analysis retains the independently proved E10239 alongside the syntax error where safely recoverable, never a typed program. No crash or fabricated valid node; unsafe remainder explicitly unchecked. | AR-P4/AR-P6; source/syntax §Recovery; PF-002 |
| ST-46 | Real temporary blend65.json project, two merged source files and Math import; load then analyze; compare snapshot before/after and filesystem inventory | Complete internal analysis for admitted source; exact snapshot/hash/text preserved; no assets read, output directory/file created, source reread or CLI behavior change. | RD-02 contracts; AR-P4; R3.34 |
| ST-47 | Run existing actual-tree and transitive import-boundary cases after frontend addition | Internal frontend reaches no target/lowering/codegen/serialization/packaging/emulator module, including through compiler-root/type-only/reexport edges. Existing durable checker reused. | AR-P2; test/import-boundary.spec.test.ts |
| ST-48 | Inspect completed TypedProgram for admitted direct calls, arrays and dynamic memory intrinsics | Required semantic/source/effect payload present; no opcode/MMIO constant/actual address/SFA home/artifact. Result remains frontend-stage proof only, not expert-parity or full-check success. | R3.11/R3.17; AR-P4 |

## File and Phase Mapping

### ST-23 Required Division and Remainder Rows

These are ordinary phase 4 scalar tests, not backend execution. For nonzero
vectors, use separately declared `const q: sword = <left> / <right>;` and
`const r: sword = <left> % <right>;`, with explicitly cast sword operands.
Assert exact bigint constants and no arithmetic error. True constant contexts
keep full precision before the declared result's range check.

| Left | Right | Quotient | Remainder |
|---|---|---|---|
| `sword(-5)` | `sword(2)` | -2 | -1 |
| `sword(5)` | `sword(-2)` | -2 | 1 |
| `sword(-5)` | `sword(-2)` | 2 | -1 |
| `sword(5)` | `sword(2)` | 2 | 1 |

Separate `const q: byte = 1 / 0;` and `const r: byte = 1 % 0;` each report E10160,
its canonical message and smallest proving span, never a host exception or a
fabricated constant. For `function div(n: byte, d: byte): byte { return n / d; }`
and the analogous `%` function, typed nodes retain the runtime operator, ordered
operands, byte width and `constant: null`; the parameter may be zero. No E10160
is inferred for an unknown parameter and no implicit check/fallback is invented.
Do not assert runtime-zero result bits or a reaching-local-zero classification.

### Owning Phase Files

| Phase | Specification files under `frontend/` | Cases |
|---|---|---|
| 1 | `lexer.spec.test.ts` | ST-1–ST-6 |
| 2 | `expressions.spec.test.ts`, `parser.spec.test.ts` | ST-7–ST-14, ST-45 syntax/recovery, ST-3 reserved `type` use |
| 3 | `modules.spec.test.ts` | ST-15–ST-18 |
| 4 | `scalars.spec.test.ts`, `flow.spec.test.ts` | ST-19–ST-29 (including ST-23 division/remainder rows), ST-3 reserved declaration |
| 5 | `aggregates.spec.test.ts`, `intrinsics.spec.test.ts` | ST-30–ST-40 |
| 6 | `effects.spec.test.ts`, `service.spec.test.ts` | ST-41–ST-44, ST-46, ST-48, ST-17 initializer order, ST-45 independent semantic error |

ST-47 uses existing root tests; no immutable existing `.spec.test.ts` file is
edited. Implementation files are `lexer.impl.test.ts`, `parser.impl.test.ts`,
`modules.impl.test.ts`, `scalars.impl.test.ts`, `aggregates.impl.test.ts`,
`service.impl.test.ts`, covering cursor progress, poison isolation, exact integer
boundaries, conservative alias joins and deep-input completion. Do not add a
generic fuzz runner; focused parameterized ordinary Vitest cases suffice.

E2E: loadProject → analyzeProject is the complete service journey in this plan.
CLI/editor/ACME/VICE E2E is N/A here because those consumers are deliberately
outside the approved partial scope. Do not build a replacement harness.

## Verification Commands

AR-P7 uses the current manifests, not historical lint/readiness commands:

| Check | Command |
|---|---|
| Directed cases, red/green | `yarn workspace @blend65/compiler test src/frontend/<case-file>.spec.test.ts` |
| Phase qualification | `yarn workspace @blend65/compiler build && yarn workspace @blend65/compiler typecheck && yarn workspace @blend65/compiler test && yarn vitest run test/import-boundary.spec.test.ts` |
| Final integration | `yarn build && yarn typecheck && yarn test` |
| Touched formatting | `yarn prettier --check <touched files>` |

Red must fail for the newly specified behavior. Existing pre-implementation passes
are recorded with the exact already-proved contract. Missing entry/import failures
record unavailable behavior, not proof of a particular semantic discriminator;
exercise those discriminators explicitly once the entries exist. Do not commit a broken phase. Compiler/package spec
authors never weaken expectations to make a phase green.

Security qualification directly covers arbitrary untrusted text as data, literal
control characters, no shell/eval/file writes, deep/malformed recovery and pure
snapshot consumption (ST-5, ST-6, ST-45, ST-46). Web auth/CSRF/TLS/rate limiting,
network, encryption and infrastructure are N/A: this is a local pure compiler
service with no endpoints or new storage. No secrets or source-content logs.

Plan acceptance runs every required ST/parameter case, compiler and root checks,
touched formatting, import boundaries and frozen-file preservation. Record the
result and unresolved parent obligations in `08-closeout.md` during execution,
including whether any existing deferral rationale expired. No RD closeout or
silicon/runtime/cost qualification is claimed by this partial service acceptance.
