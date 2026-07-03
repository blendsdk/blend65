/**
 * Specification tests for `runCli` emit/output flags (ST-27..31, ST-37, ST-38).
 *
 * Derived EXCLUSIVELY from RD-15 R20/R21/R22/R23/R24/R34/R36 and the plan (03-03,
 * §4.4; RD-16 R24). Immutable oracles: `--emit-asm`/`--emit-il`/`--emit-report`
 * artifact writes, `--quiet`/`--report=json` table suppression, `--out-dir`/
 * `--out-name` placement, and config-vs-flag `quiet` precedence.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./index.js";
import { fakeCliBuildDeps, fakeIo, GATE_SRC } from "./test-fixtures.js";

let cwd: string;
let out: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "b65-cli-emit-"));
  out = join(cwd, "out");
  writeFileSync(join(cwd, "main.blend"), GATE_SRC, "utf8");
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("Specification: --emit-asm (ST-27)", () => {
  it("returns 0, writes main.asm, and never invokes ACME (ST-27)", async () => {
    const deps = fakeCliBuildDeps();
    const io = fakeIo({ cwd, buildDeps: deps });
    const code = await runCli(
      ["build", "main.blend", "--platform", "c64", "--emit-asm", "--out-dir", out],
      io,
    );

    expect(code).toBe(0);
    expect(existsSync(join(out, "main.asm"))).toBe(true);
    expect(deps.calls.invoke).toBe(0);
  });
});

describe("Specification: --emit-il (ST-28)", () => {
  it("returns 0 and writes main.il with IL text (ST-28)", async () => {
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    const code = await runCli(
      ["build", "main.blend", "--platform", "c64", "--emit-il", "--out-dir", out],
      io,
    );

    expect(code).toBe(0);
    const il = readFileSync(join(out, "main.il"), "utf8");
    expect(il).toContain("Main.main");
  });
});

describe("Specification: --emit-report (ST-29)", () => {
  it("writes main.report.json parsing to a report with platformName c64 (ST-29)", async () => {
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    const code = await runCli(
      ["build", "main.blend", "--platform", "c64", "--emit-report", "--out-dir", out],
      io,
    );

    expect(code).toBe(0);
    const report = JSON.parse(readFileSync(join(out, "main.report.json"), "utf8")) as {
      platformName: string;
    };
    expect(report.platformName).toBe("c64");
  });
});

describe("Specification: --quiet (ST-30)", () => {
  it("returns 0, suppresses the summary, keeps the warning + trailer on stderr (ST-30)", async () => {
    writeFileSync(join(cwd, "warn.blend"), "module Main;\nfunction main(): void { poke(0xD020, 05); }\n", "utf8");
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    const code = await runCli(
      ["build", "warn.blend", "--platform", "c64", "--quiet", "--out-dir", out],
      io,
    );

    expect(code).toBe(0);
    expect(io.out).not.toContain("Blend65 Build Summary");
    expect(io.err).toContain("warning: 1 warning emitted");
  });
});

describe("Specification: --report=json (ST-31)", () => {
  it("emits exactly the JSON report on stdout, no table (ST-31)", async () => {
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    const code = await runCli(
      ["build", "main.blend", "--platform", "c64", "--report", "json", "--out-dir", out],
      io,
    );

    expect(code).toBe(0);
    expect(io.out).not.toContain("Blend65 Build Summary");
    const report = JSON.parse(io.out) as { targetName: string };
    expect(report.targetName.endsWith(".prg")).toBe(true);
  });
});

describe("Specification: --out-dir / --out-name (ST-37)", () => {
  it("places artifacts under the custom dir with the custom base name (ST-37)", async () => {
    const custom = join(cwd, "custom");
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    const code = await runCli(
      ["build", "main.blend", "--platform", "c64", "--out-dir", custom, "--out-name", "game"],
      io,
    );

    expect(code).toBe(0);
    expect(existsSync(join(custom, "game.prg"))).toBe(true);
    expect(existsSync(join(custom, "game.asm"))).toBe(true);
  });
});

describe("Specification: config quiet vs --no-quiet (ST-38)", () => {
  it("suppresses the table when config sets quiet, and prints it under --no-quiet (ST-38)", async () => {
    writeFileSync(join(cwd, "blend65.json"), JSON.stringify({ platform: "c64", quiet: true }), "utf8");

    // (a) plain → config quiet wins → no table.
    const ioA = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    expect(await runCli(["build", "main.blend", "--platform", "c64", "--out-dir", out], ioA)).toBe(0);
    expect(ioA.out).not.toContain("Blend65 Build Summary");

    // (b) --no-quiet → flag overrides config → table prints.
    const ioB = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    expect(
      await runCli(["build", "main.blend", "--platform", "c64", "--no-quiet", "--out-dir", out], ioB),
    ).toBe(0);
    expect(ioB.out).toContain("=== Blend65 Build Summary ===");
  });
});
