/**
 * The single source of truth for every Blend65 diagnostic code.
 *
 * Codes are transcribed verbatim from the language specification's canonical
 * diagnostic registry and grouped by area. User-facing errors occupy the
 * `E10xxx` band and warnings the `W10xxx` band; internal compiler errors
 * (ICEs) live in the separate `E9xxxx` band. Call sites reference codes by
 * name — `DiagCode.MissingModuleDecl` — so the numeric value lives in exactly
 * one place and never drifts.
 */

/**
 * Canonical diagnostic codes.
 *
 * Each constant maps a descriptive name to its frozen code string from the
 * language specification. When a new compiler stage needs a code, it is
 * added here — the one registry — rather than scattered across producers.
 */
export const DiagCode = {
  // Reserved sentinels (not assigned to a producer in the spec)
  /**
   * Emitted once by {@link DiagnosticBag} when the `--max-errors` cap is
   * exceeded. The specification leaves the truncation message code-less;
   * Blend65 reserves `E10000` for it so the message carries a stable,
   * greppable code.
   */
  TooManyErrors: "E10000",
  // Module & program structure
  MissingModuleDecl: "E10001",
  ModuleDeclNotFirst: "E10002",
  DuplicateDecl: "E10003",
  ExecAtModuleLevel: "E10010",
  ImportNonExported: "E10012",
  NoMainFunction: "E10020",
  MultipleMainFunctions: "E10021",
  // The `main` entry point must have signature `function main(): void`.
  // E10022 is spec-designated but was absent from this registry and from the
  // spec's own diagnostics table; registered additively (Language-Guard
  // approved). `spec/` stays frozen — a future post-freeze spec reconciliation
  // closes this drift.
  InvalidMainSignature: "E10022",
  CallingMainDirectly: "E10023",
  // Resource limits
  ZpBudgetExceeded: "E10032",
  RamBudgetExceeded: "E10033",
  BinaryTooLarge: "E10034",
  // Tooling: ACME assembler not discoverable. The spec leaves the
  // resource/tooling band open after E10034, so the next free code E10035 is
  // claimed for the actionable "ACME not found" build error.
  AcmeNotFound: "E10035",
  // Intrinsics
  ArgsToParameterlessIntrinsic: "E10040",
  WrongIntrinsicArgCount: "E10041",
  AddressOfElementDeferred: "E10042",
  // Availability, ZP arg-block overflow, non-constant intrinsic-address
  // argument (replaces the shipped `lower.ts` ICE), and the import boundary.
  IntrinsicUnavailable: "E10043",
  ZpArgBlockExceeded: "E10044",
  NonConstantIntrinsicAddress: "E10045",
  IntrinsicNotImported: "E10046",
  // Calling an `interrupt function` directly. A miscompile guard: interrupt
  // bodies end in RTI, so a user JSR corrupts the hardware stack (JSR pushes
  // 2 bytes, RTI pops 3) and jumps wild. E10051 is the spec-designated code
  // for this rule (Ch 06 §7.3); registered additively, `spec/` stays frozen.
  CallToInterruptFunction: "E10051",
  // Scoping & names
  UndeclaredIdentifier: "E10100",
  NameShadows: "E10101",
  // Arrays
  ArraySizeNotConst: "E10110",
  ArraySizeZero: "E10111",
  ArraySizeExceedsMax: "E10112",
  ConstArrayNotFullyInit: "E10113",
  ArrayIndexTypeMismatch: "E10114",
  StaticIndexOutOfBounds: "E10115",
  // Array-surface codes registered additively (`spec/` stays frozen):
  // - E10117/E10118 carry the array chapter's own numbers for the strict
  //   index-width tier rules: a `word` index on an array a `byte` index fully
  //   covers (≤256 bytes) is rejected — the high byte would be silently
  //   dropped — and a `byte` index on a larger array is rejected because it
  //   cannot reach every element. E10118's emission becomes reachable when
  //   >256-byte arrays land with the pointer-indexing surface; the rule is
  //   pinned now so both tiers share one registry entry.
  // - E10119/E10120/E10121 carry the chapter's numbers for whole-array
  //   assignment, array return types, and array comparison — arrays are
  //   memory regions, not values, so all three are permanently rejected.
  // - E10126: the `[values; fill]` initialiser form needs an explicit
  //   declared size to know how many slots the fill covers; an unsized
  //   `byte[]` annotation cannot take a fill. Minted on the next free number
  //   in the array band (the chapter's own number for this rule is already
  //   taken by `ArrayIndexTypeMismatch` above).
  WordIndexOnSmallArray: "E10117",
  ByteIndexOnLargeArray: "E10118",
  ArrayAssignmentNotAllowed: "E10119",
  ArrayReturnNotAllowed: "E10120",
  ArrayComparisonNotAllowed: "E10121",
  // Const-parameter enforcement (the array chapter's own numbers, registered
  // additively — `spec/` stays frozen):
  // - E10122: a const value (a module constant, or a const parameter being
  //   forwarded) passed to a MUTABLE by-reference parameter. Load-bearing for
  //   image integrity: const aggregates live in the read-only data stream, so
  //   letting a callee write through them would corrupt baked data.
  // - E10123: a write through a const parameter — direct, nested member
  //   chains, indexed elements, and compound assignment all reject via the
  //   same root-symbol predicate.
  ConstToMutableParam: "E10122",
  ModifyConstParam: "E10123",
  FillRequiresExplicitSize: "E10126",
  // Type system
  MissingTypeAnnotation: "E10150",
  UnknownType: "E10151",
  TypeMismatchAssignment: "E10152",
  SignedUnsignedMismatch: "E10153",
  WidthNarrowingNoCast: "E10154",
  InvalidCast: "E10155",
  // Type-position codes registered additively (`spec/` stays frozen):
  // - E10156: `void` used where a value type is required (variable, struct
  //   field, or array element). The chapters state the rule without a number;
  //   the next free code in the type-system band is claimed.
  // - E10157: an expression statement that is not a call. The grammar's
  //   expression-statement rule admits only function/intrinsic calls; wired
  //   first for aggregate literals in statement position (`Point { … };`,
  //   `[1, 2];`) so they can never fall through to code generation — full
  //   enforcement for other expression forms follows separately.
  VoidTypeNotAllowed: "E10156",
  ExpressionStatementNotACall: "E10157",
  // Structs
  UnknownField: "E10160",
  MissingFieldInInit: "E10161",
  ExtraFieldInInit: "E10162",
  EmptyStruct: "E10163",
  // Struct-surface codes registered additively (`spec/` stays frozen):
  // - E10093/E10097 carry the struct chapter's own numbers — free in this
  //   registry, reused to reduce drift (the same precedent as E10102/E10051):
  //   struct return types are permanently illegal (structs return by memory,
  //   which the ABI does not define), and struct-literal fields must appear
  //   in declaration order.
  // - E10165: a recursive struct layout — a struct that contains itself
  //   directly or through a chain of field types, making its size undefined.
  //   ONE unified code for self-reference and longer cycles (a self-reference
  //   is a one-element cycle), carrying the full cycle path in the message,
  //   mirroring the unified recursion code E10174. Minted on the next free
  //   number in the struct band.
  StructReturnNotAllowed: "E10093",
  StructInitFieldOrder: "E10097",
  RecursiveStructLayout: "E10165",
  // Functions
  WrongArgCount: "E10170",
  ArgTypeMismatch: "E10171",
  MissingReturnValue: "E10172",
  VoidFunctionReturnsValue: "E10173",
  RecursionDetected: "E10174",
  // Calling something that is not a function (e.g. `x()` on a variable). The
  // Ch 06 diagnostics table assigns E10175 exactly this meaning; the name it
  // previously carried here ("too many parameters") described a limit the
  // language does not have — parameter counts are unlimited — so the constant
  // was renamed with its number unchanged (it had no emit sites). The
  // canonical Ch 14 registry still lists the parameter-limit wording; that
  // divergence is spec-side drift awaiting an errata pass.
  NotCallable: "E10175",
  // A non-void function that does not return a value on every control-flow
  // path. E10102 is the spec's own number for this check; it was free in
  // this registry and carries no collision, so it is reused here to reduce
  // drift between the registry and the spec. Distinct from E10172 (`return`
  // present but value missing) and E10173 (void returns a value).
  NotAllPathsReturn: "E10102",
  // Control flow
  // E10072 (MissingDefaultClause) is emitted by the parser; it lives in this
  // band per the spec's grouping but is raised during parsing, not semantic
  // analysis.
  MissingDefaultClause: "E10072",
  ForEndBoundOutOfRange: "E10064",
  BreakOutsideLoopSwitch: "E10130",
  ContinueOutsideLoop: "E10131",
  DuplicateCaseValue: "E10132",
  NonExhaustiveSwitch: "E10133",
  // Control-flow codes registered additively:
  // - E10134: a non-boolean `if`/`else if`/`while`/`do-while` condition. The
  //   spec's own condition code E10100 is already taken by
  //   `UndeclaredIdentifier`, so the boolean-condition check uses the next
  //   free control-flow code, adjacent to the loop-context codes.
  // - E10061: a for-loop `step` that is not a positive compile-time constant
  //   (zero / negative / non-const). Free in this registry.
  // - E10065: a for-loop counter whose type is missing or non-integer
  //   (`integerRange(counterType) === null`). The counter annotation is
  //   optional in the parser (`parse-stmt.ts`), so a null/boolean/void
  //   counter type is guarded loudly rather than degenerating to a silent
  //   `ERROR_TYPE` codegen. Free in registry/spec/code; adjacent to the
  //   for-loop code E10064; the spec leaves this range open, delegating the
  //   "must be an integer type" rule to the type system.
  // `spec/` stays frozen.
  StepValueNotPositive: "E10061",
  ForCounterTypeNotInteger: "E10065",
  NonBooleanCondition: "E10134",
  // The `switch` sub-machine's semantic validators. Five codes registered
  // additively (`spec/` frozen). Four carry their spec-assigned numbers
  // (E10071/E10073/E10074/E10075 — all free in this registry and absent from
  // the spec's own diagnostics table, so reused to reduce drift), and one is
  // a new mint:
  // - E10077 (CaseValueTypeMismatch): the spec assigns this check E10072, but
  //   E10072 is taken by the parser's `MissingDefaultClause`, so a dedicated
  //   code is minted in the free switch band (E10070–E10079). In the
  //   integer-only surface its emission is rarely reachable (case literals
  //   adapt to the discriminant; out-of-range constants → E10084) — it
  //   becomes live once other primitive/enum constants are supported.
  // - E10076 (duplicate `default`) is deliberately NOT registered: the parser
  //   keeps `defaultClause` in a single slot and silently overwrites a
  //   duplicate (last-wins), so a semantics-side check is unreachable —
  //   deferred as parser-owned.
  // `E10132` (DuplicateCaseValue) already exists above (wired, not minted here).
  CaseValueNotConstant: "E10071",
  FallthroughNoEffect: "E10073", // WARNING severity
  FallthroughNotLast: "E10074",
  InvalidSwitchOperandType: "E10075",
  CaseValueTypeMismatch: "E10077",

  // Enums
  EmptyEnum: "E10140",
  TooManyEnumMembers: "E10141",
  DuplicateEnumValue: "E10142",
  EnumBackingOutOfRange: "E10143",
  // An enum member's explicit value must be a compile-time constant. E10230
  // is the enum chapter's own frozen number for this rule (the config-band
  // comment below already notes E10230–E10236 as the frozen enum codes);
  // registered additively, `spec/` stays frozen.
  EnumValueNotConst: "E10230",
  // Variables
  AssignToConst: "E10191",
  ConstWithoutInit: "E10192",
  NonConstInit: "E10193",
  CircularInit: "E10194",
  // Data inclusion
  EmbedNonConst: "E10200",
  EmbedFileNotFound: "E10201",
  EmbedSizeMismatch: "E10202",
  EmbedUnknownSelector: "E10203",
  EmbedFormatParseError: "E10204",
  // Operators & expressions
  InvalidOperandType: "E10080",
  MixedSignedUnsignedOperands: "E10081",
  ConstDivisionByZero: "E10082",
  // A signed shift amount (`x << sbyteAmt`). The constant previously carried
  // the name "ShiftAmountOutOfRange" but had no emit sites; it was renamed
  // (number unchanged) to match its first real use — the Ch 04 rule that a
  // shift amount must be an unsigned integer. Out-of-range constant amounts
  // are a warning (W10174), not this error.
  ShiftAmountNotUnsigned: "E10083",
  // A literal / constant value that does not fit its target integer type.
  // E10084 is spec-designated but was absent from both this registry and the
  // spec's own diagnostics table; registered additively (Language-Guard
  // approved). `spec/` stays frozen.
  ValueOutOfRange: "E10084",
  // Cast diagnostics. E10086 carries the spec's own Ch 02 number for the
  // boolean↔integer cast rejection (boolean is not convertible to or from
  // integer types). NegateUnsigned and TernaryArmMismatch are additive
  // mints: the numbers the spec sketches for them (E10083/E10162) are
  // already taken by other registry meanings, so the next free codes in the
  // expression band are claimed. `spec/` stays frozen.
  BooleanIntegerCast: "E10086",
  NegateUnsigned: "E10087",
  TernaryArmMismatch: "E10088",

  // Lexer
  // The provisional E10212 reservation is retired — reserved-name shadowing
  // of an intrinsic is reported as E10101 (NameShadows), not a distinct
  // "redeclare reserved built-in" code.
  // E10224 (ReservedKeyword) is emitted by the parser; it lives here so the
  // one-registry rule holds — the lexer itself never raises it.
  UnexpectedCharacter: "E10210",
  UnterminatedBlockComment: "E10211",
  InvalidNumericUnderscore: "E10213",
  InvalidHexLiteral: "E10214",
  InvalidBinaryLiteral: "E10215",
  NumericLiteralOverflow: "E10216",
  NewlineInString: "E10217",
  UnterminatedString: "E10218",
  UnknownEscapeSequence: "E10219",
  IncompleteHexEscape: "E10220",
  EmptyCharLiteral: "E10221",
  MultiCharLiteral: "E10222",
  UnterminatedCharLiteral: "E10223",
  ReservedKeyword: "E10224",

  // Parser
  // E10001/E10002/E10224 are reused from the bands above; E10072
  // (MissingDefaultClause) sits in the control-flow group above. The
  // E10300–E10316 band below is the parser's own syntactic-error range and
  // is distinct from the semantic E10163/E10140 empty-struct/enum codes.
  UnexpectedToken: "E10300",
  ExpectedExpression: "E10301",
  ExpectedStatement: "E10302",
  ExpectedTypeAnnotation: "E10303",
  ExpectedIdentifier: "E10304",
  MissingSemicolon: "E10305",
  MissingCloseBrace: "E10306",
  MissingCloseParen: "E10307",
  MissingCloseBracket: "E10308",
  ExpectedToOrDownto: "E10309",
  InvalidTopLevelDeclaration: "E10310",
  ExportNotAllowed: "E10311",
  ExpectedBlock: "E10312",
  ExpectedColon: "E10313",
  MissingConstInitialiser: "E10314",
  EmptyEnumDeclaration: "E10315",
  EmptyStructDeclaration: "E10316",

  // Configuration: blend65.json loading. The spec leaves the E10240 decade
  // unclaimed (E10230–E10236 are the frozen enum codes), so E10240–E10246
  // are claimed here — one code per config failure class — following the
  // same additive precedent as E10035. The matching W10240/W10241 warnings
  // sit in the warnings band below.
  ConfigFileNotFound: "E10240",
  ConfigParseError: "E10241",
  ConfigNotAnObject: "E10242",
  ConfigInvalidValue: "E10243",
  ConfigUnknownPlatform: "E10244",
  ConfigMissingPlatform: "E10245",
  ConfigPatternEscapesRoot: "E10246",

  // Driver / file discovery: the compiler driver's own errors, raised before
  // lexing when the source-file set cannot be established. The spec leaves
  // E10250+ open after the config band (E10240–E10246); E10250/E10251 are
  // claimed here (same additive precedent as E10035). Both emit with a
  // `null` span (no source to point into → header-only rendering) and
  // classify exit-2.
  DriverSourceFileNotFound: "E10250", // explicit file missing
  DriverNoSourceFiles: "E10251", // discovery yielded zero files

  // Warnings
  // Lexer warning: decimal literal with leading zeros.

  NumericLeadingZeros: "W10210",
  // Codegen cost warnings, emitted during instruction selection for
  // expensive arithmetic.
  RuntimeMultiply: "W10170",
  RuntimeDivide: "W10171",
  ShiftAndAddMultiply: "W10172",
  // Array-initialisation advisories (the array chapter's own numbers): a
  // `let` array initialised with fewer elements than its size and no fill
  // leaves the remainder undefined (W10140); a `let` array with no
  // initialiser at all is entirely undefined until written (W10141). Both
  // compile — the chapter makes them warnings, not errors.
  PartialArrayInit: "W10140",
  UninitializedArray: "W10141",
  // Pointer-surface advisories (chapter-assigned numbers, registered
  // additively — `spec/` stays frozen):
  // - W10112: the same variable feeds two by-reference arguments of one call,
  //   so the callee's writes through one alias are visible through the other
  //   (the struct chapter's "obvious case" — deeper overlap analysis is out
  //   of scope by design).
  // - W10142: a declared array exceeds the 256-byte direct-addressing tier,
  //   so every runtime access pays the pointer-formation overhead. Keyed on
  //   the FIXED tier boundary, not a platform-tunable threshold.
  // - W10143: a single declared array consumes ≥25% of the target platform's
  //   usable RAM budget; emitted only when a target profile is supplied.
  PossibleAliasing: "W10112",
  Tier2Overhead: "W10142",
  LargeArrayOnPlatform: "W10143",
  LargeZpAllocation: "W10030",

  RamNearingLimit: "W10033",
  DecimalModeWithoutCld: "W10120",
  BrkInRelease: "W10121",
  StackDepthNearLimit: "W10180",
  UseBeforeInit: "W10190",
  UnusedVariable: "W10191",
  UnreachableCode: "W10130",
  // Expression-level advisories (all spec-assigned numbers):
  // - W10101: a narrowing cast of a compile-time constant loses bits
  //   (`<byte>(300)` → 44).
  // - W10160: narrow (8-bit) arithmetic feeds a 16-bit target, so an
  //   intermediate overflow may wrap before the widening; suggests casting
  //   the operands up front.
  // - W10161: the constant form of the same hazard — the folded value
  //   provably wraps at the narrow width before widening.
  // - W10174: a constant shift amount ≥ the operand's bit width (the result
  //   is always 0; well-defined, so a warning rather than an error).
  NarrowingCastTruncates: "W10101",
  IntermediateOverflow: "W10160",
  ConstOverflowBeforeWidening: "W10161",
  ShiftCountExceedsWidth: "W10174",
  // Configuration warnings: an unknown blend65.json key, and a warning code
  // both promoted (warnAsError) and suppressed at the same time.
  ConfigUnknownKey: "W10240",
  ConfigPromoteSuppressOverlap: "W10241",
} as const;

/** The union of all canonical {@link DiagCode} string values. */
export type DiagCodeValue = (typeof DiagCode)[keyof typeof DiagCode];

/**
 * Internal compiler errors — the `E9xxxx` band.
 *
 * ICEs report compiler bugs rather than user mistakes. They are kept in a band
 * disjoint from {@link DiagCode} so they can never collide with a user-facing
 * code. This table is extended as specific ICEs are introduced.
 */
export const IceCode = {
  /** Generic catch-all ICE; specific ICEs get their own `E9xxxx` as they appear. */
  Unexpected: "E90001",
} as const;

/** The union of all {@link IceCode} string values. */
export type IceCodeValue = (typeof IceCode)[keyof typeof IceCode];

/**
 * Returns `true` when `code` belongs to the ICE band (`E9xxxx`).
 *
 * Used by the diagnostics core to tell internal compiler errors apart from
 * user-facing diagnostics (e.g. to exempt them from the `--max-errors` cap).
 *
 * @param code The diagnostic code string to classify.
 * @returns `true` if `code` matches `E9` followed by exactly four digits.
 */
export function isIceCode(code: string): boolean {
  return /^E9\d{4}$/.test(code);
}
