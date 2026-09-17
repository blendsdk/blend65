import { afterEach, describe, expect, it } from "vitest";
import { cleanupFixtures, projectFixture } from "../test/cli-fixtures.js";
import { runCli } from "./main.js";

afterEach(cleanupFixtures);

describe("caller-owned output adapter", () => {
  it.each(["--help", "--version", "check"])(
    "should propagate output-sink failures for %s unchanged",
    async (argument) => {
      const failure = new Error("Caller output sink failed");
      const fail = () => {
        throw failure;
      };
      await expect(runCli([argument], { stdout: fail, stderr: fail })).rejects.toBe(failure);
    },
  );

  it("should render a legal apostrophe-containing name without mutating it", async () => {
    const cwd = await projectFixture("Game's Ω");
    const stdout: string[] = [];
    const stderr: string[] = [];
    expect(
      await runCli(
        [],
        { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
        cwd,
      ),
    ).toBe(0);
    expect(stdout.join("")).toBe(
      "Project 'Game\\'s Ω' loaded (2 source files); no compilation performed\n",
    );
    expect(stderr).toEqual([]);
  });
});
