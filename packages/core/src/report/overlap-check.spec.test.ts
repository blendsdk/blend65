/**
 * Specification tests for the post-ACME code/data overlap check.
 *
 * The RAM data region (module variables + function frames) begins at the
 * allocation plan's data base; emitted code loads below it and must end at or
 * before that base. Code reaching into the data region would be silently
 * corrupted the moment a variable or frame slot is written, so the check
 * fails the build with the RAM-placement error E10033. The boundary is
 * half-open: a binary whose end address equals the data base is accepted.
 */

import { describe, expect, it } from "vitest";
import { checkDataOverlap } from "./build-resource-report.js";
import { createDiagnosticBag } from "../diagnostics/index.js";

describe("checkDataOverlap", () => {
  it("should accept a binary whose code ends exactly at the data base", () => {
    const bag = createDiagnosticBag();

    // Load $0801, size $17FF: end address $2000 == data base — no overlap.
    checkDataOverlap({ loadAddress: 0x0801, binarySize: 0x17ff, dataBase: 0x2000 }, bag);

    expect(bag.count()).toBe(0);
  });

  it("should emit the E10033 RAM-placement error when code extends past the data base", () => {
    const bag = createDiagnosticBag();

    // Load $0801, size $1800: the last code byte lands ON the data base.
    checkDataOverlap({ loadAddress: 0x0801, binarySize: 0x1800, dataBase: 0x2000 }, bag);

    const all = bag.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].code).toBe("E10033");
    expect(all[0].severity).toBe("error");
    expect(all[0].primarySpan).toBeNull();
    expect(all[0].message).toBe(
      "Emitted code ($0801–$2000) overlaps the RAM data region starting at $2000 " +
        "(module variables and function frames)",
    );
  });
});
