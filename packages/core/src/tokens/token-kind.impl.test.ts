/**
 * Unit tests for the {@link TokenKind} vocabulary (RD-02 FR-1, FR-2).
 *
 * Covers spec case ST-L1 from plans/rd-02-lexer/07-testing-strategy.md: the
 * enumerated member set is pinned (exactly 79 members), every value equals its
 * key (the string-valued convention, AR-L6), and a representative member from
 * each §12 category is spot-checked so a rename is caught immediately.
 */

import { describe, expect, it } from "vitest";
import { TokenKind } from "./token-kind.js";

describe("TokenKind vocabulary (ST-L1)", () => {
  const entries = Object.entries(TokenKind);

  it("enumerates exactly 79 members", () => {
    // Pins the canonical Ch 01 §12 set so the count cannot silently drift
    // (FR-2): 3 literals + 1 identifier + 32 keywords + 32 operators +
    // 10 punctuation + 1 special = 79. NB: the spec §12 prose header labels
    // the operator block "(29)", but the enumerated names beneath it list 32
    // (PLUS…QUESTION). The enumerated names are authoritative; the header
    // count is a known spec arithmetic slip (spec is frozen — D3 — so it is
    // not edited). This enum mirrors the enumerated names exactly.
    expect(entries.length).toBe(79);
  });

  it("uses each member's key as its string value (AR-L6)", () => {
    for (const [name, value] of entries) {
      expect(value, `${name} -> ${value}`).toBe(name);
    }
  });

  it("assigns no duplicate string values", () => {
    const values = entries.map(([, value]) => value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("spot-checks one member per §12 category", () => {
    expect(TokenKind.Number).toBe("Number"); // literal
    expect(TokenKind.Identifier).toBe("Identifier"); // identifier
    expect(TokenKind.KwModule).toBe("KwModule"); // keyword
    expect(TokenKind.ShiftLeftEqual).toBe("ShiftLeftEqual"); // 3-char operator
    expect(TokenKind.Question).toBe("Question"); // operator (§9.6)
    expect(TokenKind.Colon).toBe("Colon"); // punctuation (§10)
    expect(TokenKind.Eof).toBe("Eof"); // special
  });

  it("includes all 32 reserved keywords", () => {
    const keywordMembers = entries.filter(([name]) => name.startsWith("Kw"));
    expect(keywordMembers.length).toBe(32);
  });

  it("carries the full §12 operator block (32 names, PLUS…QUESTION)", () => {
    // Guards the operator count specifically, since the spec header miscounts
    // it as 29 while enumerating 32. Pin the exact 32 here.
    const operatorNames = [
      "Plus", "Minus", "Star", "Slash", "Percent",
      "Ampersand", "Pipe", "Caret", "Tilde", "ShiftLeft", "ShiftRight",
      "LogicalAnd", "LogicalOr", "Bang",
      "EqualEqual", "BangEqual", "Less", "LessEqual", "Greater", "GreaterEqual",
      "Equal",
      "PlusEqual", "MinusEqual", "StarEqual", "SlashEqual", "PercentEqual",
      "AmpersandEqual", "PipeEqual", "CaretEqual",
      "ShiftLeftEqual", "ShiftRightEqual",
      "Question",
    ];
    expect(operatorNames.length).toBe(32);
    for (const name of operatorNames) {
      expect(TokenKind[name as keyof typeof TokenKind]).toBe(name);
    }
  });
});
