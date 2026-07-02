/**
 * The single source of truth for every Blend65 diagnostic code.
 *
 * Codes are transcribed verbatim from Chapter 14 (the canonical registry) and
 * grouped by area. User-facing errors occupy the `E10xxx` band and warnings the
 * `W10xxx` band; internal compiler errors (ICEs) live in the separate `E9xxxx`
 * band (RD-11 R1–R3). Call sites reference codes by name — `DiagCode.MissingModuleDecl`
 * — so the numeric value lives in exactly one place and never drifts.
 *
 * Covers RD-11 §3.1 (FR-17) · Ch 14.
 */

/**
 * Canonical diagnostic codes (Ch 14).
 *
 * Each constant maps a descriptive name to its frozen Ch 14 code string. When a
 * future requirement (e.g. RD-02's lexer) needs a code, it is added here — the
 * one registry — rather than scattered across producers.
 */
export const DiagCode = {
  // Reserved sentinels (not assigned to a producer in Ch 14)
  /**
   * Emitted once by {@link DiagnosticBag} when the `--max-errors` cap is
   * exceeded (MD-1). Ch 14 leaves the truncation message code-less; Blend65
   * reserves `E10000` for it so the message carries a stable, greppable code.
   */
  TooManyErrors: "E10000",
  // Module & program structure (Ch 14 §2 E100xx → Ch 10)
  MissingModuleDecl: "E10001",
  ModuleDeclNotFirst: "E10002",
  DuplicateDecl: "E10003",
  ExecAtModuleLevel: "E10010",
  ImportNonExported: "E10012",
  NoMainFunction: "E10020",
  MultipleMainFunctions: "E10021",
  CallingMainDirectly: "E10023",
  // Resource limits
  ZpBudgetExceeded: "E10032",
  RamBudgetExceeded: "E10033",
  BinaryTooLarge: "E10034",
  // Tooling (RD-09, AR-62): ACME assembler not discoverable. Ch 14 leaves the
  // resource/tooling band open after E10034; RD-09 claims the next free code
  // E10035 for the actionable "ACME not found" build error (the single additive
  // core change RD-09 introduces; 03-02-acme-process-layer.md Gap 4).
  AcmeNotFound: "E10035",
  // Intrinsics
  ArgsToParameterlessIntrinsic: "E10040",
  WrongIntrinsicArgCount: "E10041",
  AddressOfElementDeferred: "E10042",
  // RD-17 (AR-P8/P11/P14): availability, ZP arg-block overflow, non-constant T2
  // address (replaces the shipped `lower.ts` ICE), and the T4 import boundary.
  IntrinsicUnavailable: "E10043",
  ZpArgBlockExceeded: "E10044",
  NonConstantIntrinsicAddress: "E10045",
  IntrinsicNotImported: "E10046",
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
  // Type system
  MissingTypeAnnotation: "E10150",
  UnknownType: "E10151",
  TypeMismatchAssignment: "E10152",
  SignedUnsignedMismatch: "E10153",
  WidthNarrowingNoCast: "E10154",
  InvalidCast: "E10155",
  // Structs
  UnknownField: "E10160",
  MissingFieldInInit: "E10161",
  ExtraFieldInInit: "E10162",
  EmptyStruct: "E10163",
  // Functions
  WrongArgCount: "E10170",
  ArgTypeMismatch: "E10171",
  MissingReturnValue: "E10172",
  VoidFunctionReturnsValue: "E10173",
  RecursionDetected: "E10174",
  TooManyParameters: "E10175",
  // Control flow
  // E10072 (MissingDefaultClause) is emitted by the parser (RD-03); it lives in
  // this band per Ch 14 but is raised during parsing, not semantic analysis.
  MissingDefaultClause: "E10072",
  ForEndBoundOutOfRange: "E10064",
  BreakOutsideLoopSwitch: "E10130",
  ContinueOutsideLoop: "E10131",
  DuplicateCaseValue: "E10132",
  NonExhaustiveSwitch: "E10133",

  // Enums
  EmptyEnum: "E10140",
  TooManyEnumMembers: "E10141",
  DuplicateEnumValue: "E10142",
  EnumBackingOutOfRange: "E10143",
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
  ShiftAmountOutOfRange: "E10083",

  // Lexer (RD-02, spec Ch 01 §14)
  // RD-17 R21: the provisional E10212 reservation is retired — reserved-name
  // shadowing of an intrinsic is reported as E10101 (NameShadows), not a distinct
  // "redeclare reserved built-in" code.
  // E10224 (ReservedKeyword) is emitted by the parser (RD-03); it lives here so
  // the one-registry rule holds — the lexer itself never raises it.
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

  // Parser (RD-03, spec Ch 14)
  // Added by addition (AR-6). E10001/E10002/E10224 are reused from the bands
  // above; E10072 (MissingDefaultClause) sits in the control-flow group above.
  // The E10300–E10316 band below is the parser's own syntactic-error range and
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

  // Warnings (Ch 14 §3)
  // Lexer warning (RD-02, spec Ch 01 §14): decimal literal with leading zeros.

  NumericLeadingZeros: "W10210",
  // Codegen cost warnings (RD-07 R60/AC-16, spec Ch 14 §3 / 00-feature-index F017).
  // Emitted during instruction selection (RD-07b) for expensive arithmetic.
  RuntimeMultiply: "W10170",
  RuntimeDivide: "W10171",
  ShiftAndAddMultiply: "W10172",
  LargeZpAllocation: "W10030",

  RamNearingLimit: "W10033",
  DecimalModeWithoutCld: "W10120",
  BrkInRelease: "W10121",
  StackDepthNearLimit: "W10180",
  UseBeforeInit: "W10190",
  UnusedVariable: "W10191",
  UnreachableCode: "W10130",
} as const;

/** The union of all canonical {@link DiagCode} string values. */
export type DiagCodeValue = (typeof DiagCode)[keyof typeof DiagCode];

/**
 * Internal compiler errors — the `E9xxxx` band (RD-11 R2).
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
