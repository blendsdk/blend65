/**
 * Specification tests for embedded-data lowering: an embed-initialised
 * const array flows into the lowered program's const-data stream as an
 * entry tagged with embed provenance, carrying the file bytes verbatim
 * under the standard data label. The labeled byte rows themselves are the
 * emitter's job, pinned by the acceptance golden.
 *
 * Oracles derive from the frozen spec Ch 13 and the recorded decisions;
 * exercised through the REAL frontend with a scripted asset reader. Never
 * derived from the implementation.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { AssetReader, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import type { ILProgram } from "./cfg.js";
import { lowerToIL } from "./lower.js";

const TABLE_BYTES = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];

/** A scripted reader serving the standard 8-byte table fixture. */
const READER: AssetReader = {
  readAsset: (_sourceId, relPath) =>
    relPath === "table.bin"
      ? {
          kind: "ok",
          bytes: Uint8Array.from(TABLE_BYTES),
          resolvedPath: "/proj/table.bin",
        }
      : { kind: "not-found" },
};

/** Lowers one source end-to-end through the real frontend + reader. */
function lowerEmbed(source: string): { il: ILProgram; hasErrors: boolean } {
  const bag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const { ast } = parse({ tokens, source, sourceId: 1, bag });
  const programs: ProgramNode[] = [ast];
  const model = analyze({
    programs,
    bag,
    profile: DEFAULT_PROFILE,
    assetReader: READER,
  });
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: bag.hasErrors(),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: programs, model, plan }, bag);
  return { il, hasErrors: bag.hasErrors() };
}

describe("Specification: embed lowering to the const-data stream", () => {
  it("produces an embed-tagged const-data entry with the file bytes verbatim", () => {
    const { il, hasErrors } = lowerEmbed(
      'module Main;\nconst D: byte[] = embed("table.bin");\n' +
        "function main(): void { poke($C000, D[0]); }\n",
    );
    expect(hasErrors).toBe(false);
    const entry = il.constData.find((e) => e.symbol === "__data_Main_D");
    expect(entry, "expected the embed const-data entry").toBeDefined();
    expect(entry?.type).toBe("embed");
    expect(Array.from(entry?.data ?? [])).toEqual(TABLE_BYTES);
  });

  it("keeps plain const arrays tagged as arrays (provenance is embed-specific)", () => {
    const { il, hasErrors } = lowerEmbed(
      "module Main;\nconst A: byte[2] = [1, 2];\n" +
        "function main(): void { poke($C000, A[0]); }\n",
    );
    expect(hasErrors).toBe(false);
    const entry = il.constData.find((e) => e.symbol === "__data_Main_A");
    expect(entry?.type).toBe("array");
  });
});
