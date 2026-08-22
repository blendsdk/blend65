import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CompilerDiagnosticEvidenceV1 } from "@blend65/compiler";
import { runCli } from "./main.js";
import { fakeIo } from "./test-fixtures.js";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "blend65-cli-evidence-"));
  writeFileSync(
    join(cwd, "warn.blend"),
    "module Main;\nfunction main(): void { poke(0xD020, 05); }\n",
    "utf8",
  );
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("CLI evidence injection", () => {
  it("reports same-invocation evidence without changing output or exit status", async () => {
    const ordinaryIo = fakeIo({ cwd });
    const observedIo = fakeIo({ cwd });
    let evidence: CompilerDiagnosticEvidenceV1 | undefined;
    const argv = ["check", "warn.blend", "--platform", "c64", "--warn-as-error"];

    const ordinaryExit = await runCli(argv, ordinaryIo);
    const observedExit = await runCli(argv, observedIo, {
      evidenceObserver: {
        onDiagnosticEvidence(value): void {
          evidence = value;
        },
      },
    });

    expect(observedExit).toBe(ordinaryExit);
    expect(observedIo.out).toBe(ordinaryIo.out);
    expect(observedIo.err).toBe(ordinaryIo.err);
    expect(evidence?.entries).toEqual([
      expect.objectContaining({ phase: "lexer", finalSeverity: "error" }),
    ]);
  });

  it("does not let an observer failure alter ordinary CLI behavior", async () => {
    const io = fakeIo({ cwd });
    await expect(
      runCli(["check", "warn.blend", "--platform", "c64"], io, {
        evidenceObserver: {
          onDiagnosticEvidence(): void {
            throw new Error("observer failure");
          },
        },
      }),
    ).resolves.toBe(0);
    expect(io.err).toContain("warning");
  });
});
