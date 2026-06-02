/**
 * Unit tests for the diagnostic code namespace (FR-17).
 *
 * Covers spec cases ST-13 (every DiagCode value is a well-formed Ch 14 code) and
 * ST-14 (the ICE band is disjoint from the user-facing band). See
 * plans/rd-11a-diagnostics-core/07-testing-strategy.md.
 */

import { describe, expect, it } from "vitest";
import { DiagCode, IceCode, isIceCode } from "./diagnostic-codes.js";

describe("DiagCode namespace (ST-13)", () => {
  const entries = Object.entries(DiagCode);

  it("is non-empty", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it("every value matches /^[EW]10\\d{3}$/", () => {
    for (const [name, code] of entries) {
      expect(code, `${name} -> ${code}`).toMatch(/^[EW]10\d{3}$/);
    }
  });

  it("assigns no duplicate code values", () => {
    const codes = entries.map(([, code]) => code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("transcribes representative Ch 14 codes verbatim", () => {
    // Spot-check one code per severity band against Ch 14.
    expect(DiagCode.MissingModuleDecl).toBe("E10001");
    expect(DiagCode.WrongIntrinsicArgCount).toBe("E10041");
    expect(DiagCode.ForEndBoundOutOfRange).toBe("E10064");
    expect(DiagCode.ShiftAmountOutOfRange).toBe("E10083");
    expect(DiagCode.EmbedFormatParseError).toBe("E10204");
    expect(DiagCode.UnusedVariable).toBe("W10191");
    expect(DiagCode.UnreachableCode).toBe("W10130");
  });
});

describe("Lexer diagnostic codes (ST-L2)", () => {
  // Source: plans/rd-02-lexer/03-03-error-recovery.md §1 (Ch 01 §14).
  // RD-02 adds the lexer band to the one registry; these assertions pin each
  // new name to its exact frozen code string and guard the E10212 exclusion.
  it("maps each new lexer code to its exact Ch 01 §14 string", () => {
    expect(DiagCode.UnexpectedCharacter).toBe("E10210");
    expect(DiagCode.UnterminatedBlockComment).toBe("E10211");
    expect(DiagCode.InvalidNumericUnderscore).toBe("E10213");
    expect(DiagCode.InvalidHexLiteral).toBe("E10214");
    expect(DiagCode.InvalidBinaryLiteral).toBe("E10215");
    expect(DiagCode.NumericLiteralOverflow).toBe("E10216");
    expect(DiagCode.NewlineInString).toBe("E10217");
    expect(DiagCode.UnterminatedString).toBe("E10218");
    expect(DiagCode.UnknownEscapeSequence).toBe("E10219");
    expect(DiagCode.IncompleteHexEscape).toBe("E10220");
    expect(DiagCode.EmptyCharLiteral).toBe("E10221");
    expect(DiagCode.MultiCharLiteral).toBe("E10222");
    expect(DiagCode.UnterminatedCharLiteral).toBe("E10223");
    expect(DiagCode.ReservedKeyword).toBe("E10224");
  });

  it("registers the leading-zeros warning in the W band", () => {
    expect(DiagCode.NumericLeadingZeros).toBe("W10210");
  });

  it("does NOT add E10212 — RD-04 owns the reserved-built-in code (AR-L5)", () => {
    // E10212 belongs to the semantic analyzer (redeclare reserved built-in);
    // RD-02 must not introduce it. Assert no registry value claims that code.
    const codes = Object.values(DiagCode);
    expect(codes).not.toContain("E10212");
  });
});

describe("Parser diagnostic codes (ST-P2b)", () => {
  // Source: plans/rd-03-parser-ast/03-03-error-recovery.md (RD-03, spec Ch 14).
  // RD-03 adds the parser band by addition (AR-6). These assertions pin each new
  // name to its exact code string. E10001/E10002/E10224 are reused (already
  // asserted above), not re-added.
  it("maps E10072 (missing default clause)", () => {
    expect(DiagCode.MissingDefaultClause).toBe("E10072");
  });

  it("maps the E10300–E10316 parser band to its exact code strings", () => {
    expect(DiagCode.UnexpectedToken).toBe("E10300");
    expect(DiagCode.ExpectedExpression).toBe("E10301");
    expect(DiagCode.ExpectedStatement).toBe("E10302");
    expect(DiagCode.ExpectedTypeAnnotation).toBe("E10303");
    expect(DiagCode.ExpectedIdentifier).toBe("E10304");
    expect(DiagCode.MissingSemicolon).toBe("E10305");
    expect(DiagCode.MissingCloseBrace).toBe("E10306");
    expect(DiagCode.MissingCloseParen).toBe("E10307");
    expect(DiagCode.MissingCloseBracket).toBe("E10308");
    expect(DiagCode.ExpectedToOrDownto).toBe("E10309");
    expect(DiagCode.InvalidTopLevelDeclaration).toBe("E10310");
    expect(DiagCode.ExportNotAllowed).toBe("E10311");
    expect(DiagCode.ExpectedBlock).toBe("E10312");
    expect(DiagCode.ExpectedColon).toBe("E10313");
    expect(DiagCode.MissingConstInitialiser).toBe("E10314");
    expect(DiagCode.EmptyEnumDeclaration).toBe("E10315");
    expect(DiagCode.EmptyStructDeclaration).toBe("E10316");
  });

  it("keeps the parser empty-struct/enum codes distinct from the semantic ones", () => {
    // Parser E10316/E10315 (declaration syntax) must not collide with the
    // semantic E10163 EmptyStruct / E10140 EmptyEnum (RD-04 band).
    expect(DiagCode.EmptyStructDeclaration).not.toBe(DiagCode.EmptyStruct);
    expect(DiagCode.EmptyEnumDeclaration).not.toBe(DiagCode.EmptyEnum);
  });
});

describe("isIceCode / IceCode band (ST-14)", () => {
  it("classifies an ICE code as in-band", () => {
    expect(isIceCode("E90001")).toBe(true);
    expect(isIceCode(IceCode.Unexpected)).toBe(true);
  });

  it("classifies a user-facing code as out-of-band", () => {
    expect(isIceCode("E10001")).toBe(false);
    expect(isIceCode("W10191")).toBe(false);
  });

  it("rejects malformed or wrong-length codes", () => {
    expect(isIceCode("E9001")).toBe(false); // too few digits
    expect(isIceCode("E900001")).toBe(false); // too many digits
    expect(isIceCode("E9abcd")).toBe(false); // non-digits
    expect(isIceCode("")).toBe(false);
  });

  it("keeps the ICE band disjoint from every DiagCode value", () => {
    for (const [name, code] of Object.entries(DiagCode)) {
      expect(isIceCode(code), `${name} -> ${code}`).toBe(false);
    }
  });

  it("keeps every IceCode value inside the ICE band", () => {
    for (const [name, code] of Object.entries(IceCode)) {
      expect(isIceCode(code), `${name} -> ${code}`).toBe(true);
    }
  });
});
