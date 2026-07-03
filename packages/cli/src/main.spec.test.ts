/**
 * Specification tests for `runCli` — commands & exit codes (ST-22..26, ST-34..36,
 * ST-43).
 *
 * Derived EXCLUSIVELY from RD-15 R17/R18/R32/R33/R38/R41–R44/R48/R50 and the plan
 * (03-03, AR-V13/V14/V15; PF-003). Immutable oracles: the R50 exit-code ladder
 * (0/1/2/3), the default-command aliasing, and help/version routing through CliIo.
 * ACME is faked (AR-V4); artifacts land under an absolute `--out-dir` temp path.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiagCode } from "@blend65/core";
import { runCli, VERSION } from "./index.js";
import { fakeCliBuildDeps, fakeIo, GATE_SRC } from "./test-fixtures.js";

let cwd: string;
let out: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "b65-cli-main-"));
  out = join(cwd, "out");
  writeFileSync(join(cwd, "main.blend"), GATE_SRC, "utf8");
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("Specification: build success (ST-22)", () => {
  it("returns 0, writes the .prg, and prints the summary to stdout only (ST-22)", async () => {
    const deps = fakeCliBuildDeps();
    const io = fakeIo({ cwd, buildDeps: deps });
    const code = await runCli(["build", "main.blend", "--platform", "c64", "--out-dir", out], io);

    expect(code).toBe(0);
    expect(existsSync(join(out, "main.prg"))).toBe(true);
    expect(io.out).toContain("=== Blend65 Build Summary ===");
    expect(io.err).toBe("");
  });
});

describe("Specification: check command (ST-23)", () => {
  it("returns 0 with no artifacts and no summary (ST-23)", async () => {
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    const code = await runCli(["check", "main.blend", "--platform", "c64", "--out-dir", out], io);

    expect(code).toBe(0);
    expect(existsSync(join(out, "main.prg"))).toBe(false);
    expect(existsSync(join(out, "main.asm"))).toBe(false);
    expect(io.out).not.toContain("Blend65 Build Summary");
  });
});

describe("Specification: compile errors → exit 1 + trailer (ST-24)", () => {
  it("returns 1 with both diagnostics and the count trailer on stderr, stdout empty (ST-24)", async () => {
    // Two errors (two stray '@') + one warning (leading-zero literal).
    writeFileSync(join(cwd, "bad.blend"), "module Main;\nfunction main(): void {\n@\n@\npoke(0xD020, 05);\n}\n", "utf8");
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    const code = await runCli(["build", "bad.blend", "--platform", "c64", "--out-dir", out], io);

    expect(code).toBe(1);
    expect(io.err).toContain("error: 2 errors, 1 warning emitted");
    expect(io.out).toBe("");
  });
});

describe("Specification: missing explicit file → exit 2 (ST-25)", () => {
  it("returns 2 and reports E10250 on stderr (ST-25)", async () => {
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    const code = await runCli(["build", "x.blend", "--platform", "c64", "--out-dir", out], io);

    expect(code).toBe(2);
    expect(io.err).toContain(DiagCode.DriverSourceFileNotFound);
  });
});

describe("Specification: ACME ICE → exit 3 (ST-26)", () => {
  it("returns 3, retains the .asm, and writes no .prg on an ACME ICE (ST-26)", async () => {
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps({ acmeSuccess: false }) });
    const code = await runCli(["build", "main.blend", "--platform", "c64", "--out-dir", out], io);

    expect(code).toBe(3);
    expect(existsSync(join(out, "main.asm"))).toBe(true);
    expect(existsSync(join(out, "main.prg"))).toBe(false);
  });
});

describe("Specification: unknown flag → exit 2 (ST-34)", () => {
  it("returns 2 with a usage/failure message on stderr (ST-34)", async () => {
    const io = fakeIo({ cwd });
    const code = await runCli(["build", "--bogus-flag"], io);

    expect(code).toBe(2);
    expect(io.err.length).toBeGreaterThan(0);
  });
});

describe("Specification: version and help (ST-35)", () => {
  it("prints VERSION for --version and lists commands for --help (both exit 0) (ST-35)", async () => {
    const vio = fakeIo({ cwd });
    expect(await runCli(["--version"], vio)).toBe(0);
    expect(vio.out).toContain(VERSION);

    const hio = fakeIo({ cwd });
    expect(await runCli(["--help"], hio)).toBe(0);
    expect(hio.out).toContain("build");
    expect(hio.out).toContain("check");
  });
});

describe("Specification: default command is build (ST-36)", () => {
  it("treats a bare file argument as build (ST-36)", async () => {
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    const code = await runCli(["main.blend", "--platform", "c64", "--out-dir", out], io);

    expect(code).toBe(0);
    expect(existsSync(join(out, "main.prg"))).toBe(true);
    expect(io.out).toContain("=== Blend65 Build Summary ===");
  });
});

describe("Specification: ACME-not-found (E10035) → exit 1, not 3 (ST-43, PF-003)", () => {
  it("returns 1 (normal error, not ICE), retains the .asm, shows E10035 (ST-43)", async () => {
    const io = fakeIo({
      cwd,
      buildDeps: fakeCliBuildDeps({ acmeSuccess: false, failureCode: DiagCode.AcmeNotFound }),
    });
    const code = await runCli(["build", "main.blend", "--platform", "c64", "--out-dir", out], io);

    expect(code).toBe(1);
    expect(existsSync(join(out, "main.asm"))).toBe(true);
    expect(io.err).toContain(DiagCode.AcmeNotFound);
  });
});
