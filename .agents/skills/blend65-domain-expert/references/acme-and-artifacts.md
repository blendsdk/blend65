# ACME and Artifact Engineering

> **Baseline version**: `1.0.0`
> **Status**: Source-backed decision knowledge. Commands and expected observations below are exact
> future proof specifications unless a recorded result explicitly says they were executed.

## Scope and Authority

Blend65 currently serializes selected 6502-family machine operations as ACME source and packages
the result for a selected machine. ACME is a terminal dialect, not a language semantic and not an
optimizer. Never encode a lost type, effect, volatile ordering rule, branch-repair decision, or
placement requirement as a clever assembler expression and then call the compiler correct.

The accepted tool baseline is ACME 0.97 “Zem”, official SourceForge revision 266. The automated C64
runtime baseline is VICE 3.10 `x64sc`, tag `3.10.0`, commit
`4d283a2e7dd59b7e378524878e81ecc7826b700c`. A different binary or configured machine model is a
different evidence identity until reconciled. `[ACME-097-R266, src/version.h; VICE-310-SOURCE,
tag 3.10.0]`

### Selective loading

For a narrow ACME 0.97 syntax, directive, expression, label, addressing, branch, or output-format
question, load only this file and `source-manifest.md`. The first contains the distilled rule and
future probe; the second establishes the exact ACME version, primary location, scope and known
source conflicts. Do not load compiler architecture, portability, CPU, C64, game, parity or
recovery modules unless the question actually expands into one of those domains. This is the
minimum Q-R12 route, not permission to infer a target result from assembler syntax.

## Five Separate Boundaries

| Boundary | Owns | Proof required | Does not prove |
|---|---|---|---|
| Machine representation | Opcodes, operands, labels, data and placement intent | Exact symbolic operation, effects, flags, clobbers and cost | ACME spelling or encoded bytes |
| ACME serializer | Deterministic source syntax and directives | Source/golden inspection | Resolution, encoding or container correctness |
| ACME assembler | Symbol resolution, addressing selection, diagnostics and bytes | Exit status, report, symbols and byte inspection | Loader/startup or machine behavior |
| Artifact packager | Header/container, load origin and startup contract | Container bytes plus body/origin agreement | CPU/device-visible behavior |
| Execution oracle | Behavior under one fixed machine model | Exact observation from VICE or hardware | Universal silicon, analogue or revision behavior |

An emitted `.asm` file is therefore not a compiled program. A PRG is not correct merely because
ACME accepted it. Preserve these boundaries in audits and diagnostics.

## Deterministic ACME Invocation

For later proofs, capture `acme --version` and require release `0.97`. Use explicit switches rather
than ambient configuration:

```text
acme --cpu 6510 --strict-segments --format plain --outfile out.bin \
  --report out.report --symbollist out.sym --vicelabels out.vs source.a
```

Change `--format plain` to `--format cbm` only for a Commodore load-address container. Command-line
output defaults to `plain`, while `!to` without a format warns and defaults to `cbm`; generated
source must never depend on that difference. `--strict-segments` is mandatory because otherwise
segment overlap is only a warning. `[ACME-097-R266, docs/QuickRef.txt “Command line arguments”;
docs/AllPOs.txt !to; src/output.c::Output_save_file]`

Use one owner for output name, format and origin. The preferred generated form keeps these in the
driver command and emits an explicit `* = origin` in source. Do not combine a source `!to` with a
conflicting command-line `--outfile` or `--format`.

## CPU Selection

ACME defaults to `6502`; Blend65 must always select the intended CPU explicitly. The relevant keys
are:

| Selected model | ACME key | Boundary |
|---|---|---|
| Documented original instruction set | `6502` | Reject undocumented opcodes |
| NMOS set including undocumented opcodes | `nmos6502` | Opt-in only |
| 6510 alias | `6510` | Alias of `nmos6502`; this is broader than a documented-only C64 policy |
| Common CMOS additions | `65c02` | Includes documented BRA/PHX/PHY/PLX/PLY/STZ/TRB/TSB subset |
| Rockwell CMOS additions | `r65c02` | Adds BBR/BBS/RMB/SMB families |
| WDC CMOS additions | `w65c02` | Adds STP/WAI to the Rockwell set |

ACME rejects an instruction unsupported by the selected key. CPU legality is still decided by the
compiler's selected CPU model before serialization. In particular, choosing `6510` in ACME does
not authorize undocumented opcodes in Blend65. Use `6502` when the compiled program is restricted
to the documented NMOS set; use a broader key only when the target profile and CPU policy approve
every emitted form. `[ACME-097-R266, docs/AllPOs.txt !cpu]`

## Expressions and Literal Rules

ACME 0.97 evaluates signed integers at no less than 32 bits and also supports C `double` values.
It accepts decimal, `$`/`0x` hexadecimal, `&` octal, and `%`/`0b` binary literals. Single quotes
produce one converted character; double quotes produce a string object. Generated compiler source
should prefer explicit hexadecimal for addresses/bytes and never depend on a mutable conversion
table for machine data. `[ACME-097-R266, docs/QuickRef.txt “The expression parser”]`

The precedence that matters most to a compiler serializer is:

| Higher first | Operators |
|---|---|
| Unary/composition | functions, indexing, complement, power, negation |
| Arithmetic | `*`, `/`, `DIV`, `MOD`, then `+`, `-` |
| Shifts | `<<`, `>>`, `>>>` |
| Byte extraction | unary `<` low, unary `>` high, unary `^` bank |
| Comparison/equality | relational, `!=`/`<>`/`><`, `=` |
| Bitwise | `&`/`AND`, `XOR`, `|`/`OR` |

Higher-numbered precedence binds first; power is right-associative. ACME also chooses the longest
possible operator token, so `v<>w` is not-equal while `v< >w` is “less than high byte of `w`”. The
serializer must parenthesize generated arithmetic and every byte extraction even where the current
table would give the intended answer:

```text
!byte <(symbol + 1), >(symbol + 1)
```

Never use assembler precedence as the semantic oracle. The compiler supplies an already decided
constant value; ACME only serializes and independently cross-checks it. `[ACME-097-R266,
docs/QuickRef.txt operator table; src/alu.c operator/evaluation definitions]`

## Symbols and Scopes

| Form | Visibility/meaning | Serializer rule |
|---|---|---|
| `name` or `_name` | Global; visible throughout the assembly | Generate stable collision-free names |
| `.name` | Local to the current macro or `!zone` | Use only inside an explicitly owned zone |
| `@name` | Cheap local bounded by adjacent global labels | Safe for short generated basic blocks with fixed global boundaries |
| `+`, `++`, `-`, `--` | Anonymous next/previous definitions | Use only for tiny, non-reordered templates |

Anonymous labels cannot be assigned explicitly. Every macro call has its own local-symbol scope.
ACME is multi-pass, but a forward reference can affect addressing width as described below; “it
resolves later” does not guarantee the smallest encoding. Generated source should use stable named
labels at compiler CFG boundaries and reserve anonymous/cheap locals for fixed templates whose
layout cannot be confused by insertion or reordering. `[ACME-097-R266, docs/QuickRef.txt “Summary
about symbols”; docs/AllPOs.txt !zone]`

`name = value` defines an ordinary symbol and a conflicting second definition is an error.
`!set name = value` deliberately changes an existing symbol and exists mainly for assembly-time
loop counters; generated compiler output should not use it for program facts. `!address`/`!addr`
can mark a symbol as an address for ACME's optional type-mismatch warnings, but that tag cannot
replace Blend65's resolved pointer/place type. `[ACME-097-R266, docs/AllPOs.txt !set and !address]`

## Addressing Selection and Force Width

When an operand value is known on the first pass, ACME selects the smallest legal addressing mode
that fits. An `$00fa` operand may therefore assemble as zero page while `$0100` requires absolute.
Leading zeroes normally force the represented width: `$00fc` can force a 16-bit absolute operand.
`--ignore-zeroes` disables that mechanism and is forbidden for the pinned Blend65 invocation.
`[ACME-097-R266, docs/AddrModes.txt automatic selection and leading-zero rules]`

For explicit generated intent, ACME 0.97 supports mnemonic postfixes `+1`, `+2`, and `+3` for
8-, 16-, and 24-bit argument size where that instruction/CPU has such a mode. The priority is:

1. mnemonic postfix;
2. force bits carried by the argument or symbol;
3. the value known on the first pass.

Low/high/bank extraction sets a one-byte result and clears wider force information. Never force an
operand to a width that cannot represent its value. The compiler should emit an explicit supported
width when instruction selection already decided one; otherwise it must verify the assembler's
actual choice in the report and bytes. `[ACME-097-R266, docs/AddrModes.txt “Forcing a specific
addressing mode” and selection algorithm]`

A first-pass-unknown forward symbol normally reserves a 16-bit mode. If it later resolves into zero
page, ACME retains the wide form and warns that an oversized addressing mode was used. This stable
multi-pass behavior is not an optimizer. Arrange or type generated symbols so critical operand
width is known, or force the selected width explicitly; never assume ACME will relax a forward
reference. `[ACME-097-R266, docs/AddrModes.txt first-pass unknown behavior]`

## Relative Branches and Repair Ownership

NMOS/CMOS short branches encode a signed displacement from the address after the branch. ACME's
near-branch implementation accepts `-128..127`. For a target outside that range, it reports:

```text
Target out of range (<offset>; <distance> too far).
```

For example, displacement `128` is `Target out of range (128; 1 too far).`. ACME writes a dummy
offset while collecting the error and produces no valid output file when errors remain.
`[ACME-097-R266, src/mnemo.c::near_branch; docs/QuickRef.txt output-on-success rule]`

Compute page-cross cost from the post-operand PC and the taken target, never from displacement
magnitude. In the A04 boundary probe, a branch at `$1000` has post-operand PC `$1002`; 127 fill
bytes put the target at `$1081`. Both addresses are in page `$10xx`, so the taken branch costs 3
cycles, not 4. The displacement-128 target at `$1082` is still in that page but is illegal for a
different reason: signed-relative range. A complete review reports the exact accepted bytes
`F0 7F`, the exact rejected diagnostic `Target out of range (128; 1 too far).`, output-artifact
suppression, register/flag preservation, and both original and repaired path costs.

Branch repair belongs to machine CFG layout/optimization before serialization. The compiler may
invert a condition around an absolute jump, choose a legal long-branch instruction on a selected
CPU, or relayout blocks, but must preserve condition, flags, effects, cycles where observable, and
fall-through. Do not hide a missing repair behind an ACME macro without reflecting its bytes,
clobbers and path costs in the machine representation.

## Placement, Alignment, and Segments

`* = address` sets the program counter. `!fill amount,value` emits bytes. `!skip amount` advances
within the current output buffer without opening a new segment. `!align mask,equal,fill` emits the
fill value until `(PC & mask) == equal`; the default fill is `$EA`, but generated source must state
the fill byte because padding is part of the artifact and cost. `[ACME-097-R266, docs/AllPOs.txt
!fill, !skip, !align]`

Every change of PC is a placement decision. Require `--strict-segments`, inspect the report's
segment ranges, and reject wrap or overlap. ACME's output buffer and PC indexing are 16-bit for
these targets; a target packager—not accidental PC wrap—owns banked or multi-record artifacts.
`[ACME-097-R266, docs/QuickRef.txt --strict-segments; src/output.c]`

`!pseudopc` assembles code as if it executes at a different address from where its bytes are
stored. That implies a loader/relocation/copy contract and is not a normal way to place data at an
address. Use it only when the selected platform design explicitly owns both storage and execution
addresses and accounts for the copy/relocation. `[ACME-097-R266, docs/AllPOs.txt !pseudopc]`

## Data, Text, and Includes

- `!byte` emits low eight-bit values.
- `!word`/`!16` emits 16-bit little-endian values for the accepted CPUs.
- `!text` uses the active conversion table; generated machine-format text must select the exact
  table or, preferably, emit already converted bytes.
- `!source "file"` parses another source file. Quoted paths use the current directory; angle
  brackets use library search paths.
- `!binary "file", size, skip` includes bytes. `size` must resolve on the first pass; excess input
  is truncated, short input is padded, and `skip` is the file offset. Skipping two bytes is useful
  only when an explicitly identified Commodore load header is being removed.

The compiler must validate and canonicalize source/include paths before generating ACME input,
reject traversal outside the build root, and bind embedded asset identity earlier in compilation.
ACME inclusion is serialization, not an asset-format parser or placement policy.
`[ACME-097-R266, docs/AllPOs.txt data, !source and !binary sections]`

## Reports, Labels, and Actual Bytes

A future artifact proof collects all of the following:

| Evidence | Required use |
|---|---|
| ACME process status/diagnostics | Establish successful assembly or the exact rejection |
| `--report` listing | Link source line, memory address and emitted byte sequence |
| `--symbollist` | Check global symbol values and declared origin/entry/end |
| `--vicelabels` | Debugging aid only; not a replacement for the normal symbol record |
| Output bytes | Establish actual opcode width, endianness, padding and header |
| Verbose segment summary | Cross-check start/end/size; remember CBM header is excluded from reported payload size |

Source appearance never establishes an encoding. A report without the file bytes does not prove
the container. Labels without runtime observation do not prove execution. Any ACME error means no
compiler artifact may be published, even if a stale output file exists from an earlier run.
`[ACME-097-R266, docs/QuickRef.txt -r/-l/--vicelabels/-v and output rule]`

## C64 PRG Contract

ACME `cbm` output writes the lowest used address as a two-byte little-endian load header, followed
by the memory image. `plain` writes only the memory image. A C64 PRG proof therefore checks these
independently:

1. bytes 0–1 equal the selected load address, little-endian;
2. body byte 0 corresponds to that address in the report;
3. every segment, symbol and padding byte fits the declared C64 memory/layout profile;
4. the startup form is explicit: BASIC `RUN` stub, machine-code entry, cartridge entry, or another
   selected contract;
5. the entry reached by the loader matches the symbol/report, not merely the PRG load address.

A two-byte header does not cause execution. Conversely, a raw file containing code at offset zero
is not a PRG. `[ACME-097-R266, docs/AllPOs.txt !to; src/output.c OUTPUT_FORMAT_CBM;
CBM-C64-PRG-1982, BASIC program storage/startup and machine-language appendices]`

## Future ACME Proof Specifications

These are deliberately small one-off probes. During later compiler implementation, create each in
an isolated temporary directory, run the pinned command, record source/file hashes and tool output,
then delete it. Do not add a generic probe runner.

### A01/A03 — value, symbol, and forced addressing width

```text
!cpu 6502
* = $1000
zp = $00fa
high = $0100
lda zp
lda high
lda+2 zp
lda+1 $00fa
```

Future command: `acme --cpu 6502 --strict-segments -f plain -o width.bin -r width.report -l width.sym width.a`.
Expected bytes: `a5 fa ad 00 01 ad fa 00 a5 fa`. The report and symbols must show `zp=$00fa`,
`high=$0100`, and the four exact instruction widths. A separate first-pass-forward probe must
expect an absolute encoding plus the pinned oversized-mode warning when a later symbol resolves to
zero page. `[ACME-097-R266, docs/AddrModes.txt; src/mnemo.c::calc_arg_size]`

### A02 — precedence and low/high extraction

```text
!cpu 6502
base = $12ff
* = $2000
!byte <(base + 1), >(base + 1)
```

Future command: `acme --cpu 6502 --strict-segments -f plain -o expression.bin -r expression.report -l expression.sym expression.a`.
Expected bytes: `00 13`; `base` remains `$12ff`. Also inspect the emitted Blend65 source and
require the parentheses shown. `[ACME-097-R266, docs/QuickRef.txt operator table; src/alu.c]`

### A-symbol — forward, cheap-local, and anonymous labels

```text
!cpu 6502
* = $1000
entry:
beq +
nop
+
@again:
bne @again
done:
rts
```

Future command: `acme --cpu 6502 --strict-segments -f plain -o labels.bin -r labels.report -l labels.sym labels.a`.
Expected bytes: `f0 01 ea d0 fe 60`; global symbols are `$1000` and `$1005`. Add two bounded
`!zone` blocks that reuse the same `.local` name and require no duplicate-symbol error.
`[ACME-097-R266, docs/QuickRef.txt symbols; docs/AllPOs.txt !zone]`

### A04 — branch endpoints and one-byte overflow

For the in-range source, place `beq target` at `$1000`, emit `!fill 127,$ea`, then define `target`.
Expected prefix is `f0 7f` and assembly succeeds. Change the fill to 128 for the out-of-range
source. Future command is the same pinned plain/report/symbol command; it must fail with
`Target out of range (128; 1 too far).` and no accepted output artifact. Also inspect the compiler
case that repairs the same CFG and require its actual bytes and both path costs.
`[ACME-097-R266, src/mnemo.c::near_branch]`

### A-placement — origin and page alignment

```text
!cpu 6502
* = $20fd
!byte $aa
!align 255, 0, $ee
!byte $bb
```

Future command: `acme --cpu 6502 --strict-segments -f plain -o placement.bin -r placement.report -l placement.sym placement.a`.
Expected bytes: `aa ee ee bb`; report range `$20fd..$2100`. The two padding bytes count in the
artifact budget. `[ACME-097-R266, docs/AllPOs.txt !align]`

### A-data — endian, raw text, and binary slice

Create `asset.bin` with exact bytes `11 22 33 44` and record its SHA-256. Assemble:

```text
!cpu 6502
* = $3000
!byte $12
!word $3456
!convtab raw
!text "AZ"
!binary "asset.bin", 2, 1
```

Expected bytes are `12 56 34 41 5a 22 33`. A missing, wrong-sized, or wrong-hash input fails the
compiler-owned asset step rather than being silently padded or truncated by ACME.
`[ACME-097-R266, docs/AllPOs.txt data, !convtab and !binary]`

### A05 — complete PRG bytes and startup

```text
!cpu 6502
* = $0801
!word basic_end
!word 10
!byte $9e
!text "2064"
!byte 0
basic_end:
!word 0
!fill $0810 - *, 0
entry:
lda #0
sta $d7ff
```

Future command: `acme --cpu 6502 --strict-segments -f cbm -o q-a05.prg -r q-a05.report -l q-a05.sym --vicelabels q-a05.vs q-a05.a`.
Expected complete file bytes are
`01 08 0b 08 0a 00 9e 32 30 36 34 00 00 00 00 00 00 a9 00 8d ff d7`.
The symbol report must put `basic_end=$080b` and `entry=$0810`; the first two file bytes are the
header and are not part of the memory body. This is a test-only BASIC `SYS 2064` program; its
`$d7ff` write is meaningful only with VICE's debug cartridge enabled.
`[ACME-097-R266, src/output.c; CBM-C64-PRG-1982; VICE-310-SOURCE,
vice/src/c64/cart/debugcart.c]`

## VICE Proof Contract

For the later A05 execution proof, record the exact VICE binary hash and require version 3.10.
Run the already byte-verified PRG with:

```text
x64sc -default -model c64 -console +sound +warp -debugcart \
  -limitcycles 4000000 -autostart q-a05.prg
```

`-default` resets resources before the following fixed options. `-model c64` selects the documented
PAL breadbox model bundle. `+sound` and `+warp` disable sound and initial warp for this proof.
`-debugcart` enables the test-only `$d7ff` exit device; writing zero must print a
`DBGCART: exit(0)` record and exit successfully. `-limitcycles` prevents a missing startup from
hanging indefinitely. `[VICE-310-MANUAL, command-line initialization, C64 model, debug settings;
VICE-310-SOURCE, vice/src/c64/cart/debugcart.c::debugcart_store]`

The pass predicate requires all of: exact PRG bytes already passed; VICE reports the pinned version
and selected model/configuration; the debug-cart success record exists; process status is zero; and
the cycle limit did not cause exit. A missing emulator or deliberate skip is `Unknown` runtime
status, never pass or `Verified partial`. A non-zero debug-cart value is a behavior failure. A
process/configuration error is tool failure and does not establish program behavior.

This one smoke proof establishes only load/startup/execution for the fixed model. Timing, CIA edge
behavior, SID analogue output, undocumented opcodes, unusual banking, cartridges and other
silicon-sensitive behavior require their own exact VICE observations and later targeted hardware
QA. Until that QA, report `VICE-verified / hardware-unverified`.

## Audit and Emitter Checklist

- Is CPU legality decided before ACME, with an explicit matching `!cpu`/`--cpu` key?
- Are all generated expressions parenthesized from compiler-owned values?
- Is addressing width deliberate and confirmed in actual bytes?
- Are far branches repaired before serialization and costed on every relevant path?
- Are every origin, segment, alignment byte and include identity explicit?
- Are assembler, packager and runtime results reported separately?
- Does a C64 PRG check header, body origin, symbols and startup?
- Is any skipped/missing ACME or VICE observation kept `Unknown`?
- Is VICE evidence bounded to its exact version/model/settings and physical QA boundary?

## Sources

See [Source Manifest](source-manifest.md): `ACME-097-R266`, `VICE-310-SOURCE`,
`VICE-310-MANUAL`, `VICE-TEST-EF8E8EFE`, `CBM-C64-PRG-1982`, and the reconciled project evidence
policy.
