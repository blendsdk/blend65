/**
 * Specification tests for `runCli` diagnostics output — formats, trailer, color.
 *
 * Immutable oracles: diagnostics + trailer route to stderr (terminal format);
 * `--diagnostics-format=json` emits a JSON array with NO trailer; the color
 * precedence table (explicit flag > NO_COLOR > isTTY).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./index.js";
import { fakeCliBuildDeps, fakeIo } from "./test-fixtures.js";

let cwd: string;
let out: string;

/** A source with two errors (stray '@') and one warning (leading-zero literal). */
const TWO_ERR_ONE_WARN =
  "module Main;\nfunction main(): void {\n@\n@\npoke(0xD020, 05);\n}\n";
/** A source with a single syntax error. */
const ONE_ERR = "module Main;\nfunction main(): void {\n@\n}\n";

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "b65-cli-diag-"));
  out = join(cwd, "out");
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("Specification: diagnostics + trailer on stderr (ST-24)", () => {
  it("renders the diagnostics AND the count trailer on stderr, stdout empty (ST-24)", async () => {
    writeFileSync(join(cwd, "bad.blend"), TWO_ERR_ONE_WARN, "utf8");
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    const code = await runCli(["build", "bad.blend", "--platform", "c64", "--out-dir", out], io);

    expect(code).toBe(1);
    expect(io.err).toContain("error["); // at least one rendered diagnostic block
    expect(io.err).toContain("error: 2 errors, 1 warning emitted"); // the trailer
    expect(io.out).toBe("");
  });
});

describe("Specification: --diagnostics-format=json (ST-32)", () => {
  it("emits a JSON array on stderr with no trailer, exit 1 (ST-32)", async () => {
    writeFileSync(join(cwd, "bad.blend"), ONE_ERR, "utf8");
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps() });
    const code = await runCli(
      ["build", "bad.blend", "--platform", "c64", "--diagnostics-format", "json", "--out-dir", out],
      io,
    );

    expect(code).toBe(1);
    const parsed = JSON.parse(io.err) as unknown;
    expect(Array.isArray(parsed)).toBe(true);
    expect(io.err).not.toContain("error: 1 error emitted"); // no trailer in JSON mode
  });
});

describe("Specification: color precedence (ST-33)", () => {
  const SGR = /\x1b\[/;

  function runColor(argv: string[], ioOverrides: Parameters<typeof fakeIo>[0]) {
    writeFileSync(join(cwd, "bad.blend"), ONE_ERR, "utf8");
    const io = fakeIo({ cwd, buildDeps: fakeCliBuildDeps(), ...ioOverrides });
    return runCli(["build", "bad.blend", "--platform", "c64", "--out-dir", out, ...argv], io).then(
      () => io,
    );
  }

  it("(a) non-TTY → no color", async () => {
    const io = await runColor([], { isTTY: false });
    expect(SGR.test(io.err)).toBe(false);
  });

  it("(b) --color → color", async () => {
    const io = await runColor(["--color"], { isTTY: false });
    expect(SGR.test(io.err)).toBe(true);
  });

  it("(c) NO_COLOR env → no color", async () => {
    const io = await runColor([], { isTTY: true, env: { NO_COLOR: "1" } });
    expect(SGR.test(io.err)).toBe(false);
  });

  it("(d) --no-color with a TTY → no color", async () => {
    const io = await runColor(["--no-color"], { isTTY: true });
    expect(SGR.test(io.err)).toBe(false);
  });
});
