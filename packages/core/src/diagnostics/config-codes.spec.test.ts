/**
 * Specification test for the RD-16 config diagnostic band (ST-32).
 *
 * Traceability: RD-16 §4.3 diagnostic codes, resolved by AR-P3 (plan
 * `rd-16-compiler-configuration`, 00-ambiguity-register.md) — the config
 * loader claims the unclaimed E10240–E10246 decade plus W10240/W10241, one
 * code per failure class. Expectations are transcribed from
 * 07-testing-strategy.md ST-32 verbatim; they are NOT derived from the
 * implementation (immutable-oracle rule).
 */

import { describe, expect, it } from "vitest";
import { DiagCode } from "./diagnostic-codes.js";

describe("RD-16 config diagnostic band (ST-32 / AR-P3)", () => {
  it("registers the seven config error codes E10240–E10246", () => {
    expect(DiagCode.ConfigFileNotFound).toBe("E10240");
    expect(DiagCode.ConfigParseError).toBe("E10241");
    expect(DiagCode.ConfigNotAnObject).toBe("E10242");
    expect(DiagCode.ConfigInvalidValue).toBe("E10243");
    expect(DiagCode.ConfigUnknownPlatform).toBe("E10244");
    expect(DiagCode.ConfigMissingPlatform).toBe("E10245");
    expect(DiagCode.ConfigPatternEscapesRoot).toBe("E10246");
  });

  it("registers the two config warning codes W10240/W10241", () => {
    expect(DiagCode.ConfigUnknownKey).toBe("W10240");
    expect(DiagCode.ConfigPromoteSuppressOverlap).toBe("W10241");
  });
});
