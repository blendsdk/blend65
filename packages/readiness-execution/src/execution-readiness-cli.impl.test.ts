import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runReadinessExecutionCliV1 } from "./execution-readiness-cli.js";

const ARGV = ["--target", "c64", "--seed", "7".repeat(64)] as const;
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("readiness execution CLI failure boundaries", () => {
  it("returns the exact grammar before any repository access", async () => {
    const stderr: string[] = [];
    const exit = await runReadinessExecutionCliV1([], {
      cwd: "/missing",
      writeOut: () => undefined,
      writeErr: (text) => stderr.push(text),
    });
    expect(exit).toBe(2);
    expect(stderr).toEqual([
      "Usage: yarn readiness:execute -- --target c64 --seed <64-lowercase-hex> " +
        "[--report readiness/execution-evidence/rd-04-local-v1.json]\n",
    ]);
  });

  it("classifies missing parent publication authority as trusted I/O failure", async () => {
    const empty = await mkdtemp(join(tmpdir(), "blend65-execution-cli-"));
    roots.push(empty);
    const stderr: string[] = [];
    const exit = await runReadinessExecutionCliV1(ARGV, {
      cwd: empty,
      writeOut: () => undefined,
      writeErr: (text) => stderr.push(text),
    });
    expect(exit).toBe(4);
    expect(stderr.join("")).toMatch(/(?:publication|execution)/u);
  });

  it("bounds unexpected host failures to the machine-neutral I/O category", async () => {
    const stderr: string[] = [];
    const io = {
      get cwd(): string {
        throw new TypeError("host path must not escape");
      },
      writeOut: () => undefined,
      writeErr: (text: string) => stderr.push(text),
    };
    expect(await runReadinessExecutionCliV1(ARGV, io)).toBe(4);
    expect(stderr).toEqual(["execution.io:\n"]);
  });
});
