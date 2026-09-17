import { describe, expect, it } from "vitest";
import { parseArguments } from "./args.js";

describe("native argument-parser adapter", () => {
  it.each([["-hh"], ["-vv"], ["--help=true"], ["--", "check"], ["--project", "--help"]])(
    "should reject invalid grouped boolean or positional tokens %j",
    (...argv: string[]) => {
      expect(parseArguments(argv, "/fixture")).toBeNull();
    },
  );

  it("should retain explicitly empty values for shared project validation", () => {
    expect(parseArguments(["--project=", "--target=", "--entry="], "/fixture")).toEqual({
      help: false,
      version: false,
      options: { cwd: "/fixture", project: "", target: "", entry: "" },
    });
  });

  it("should keep informational flags separate from project options", () => {
    expect(parseArguments(["--help", "--project=missing"], "/fixture")).toEqual({
      help: true,
      version: false,
      options: { cwd: "/fixture", project: "missing" },
    });
  });
});
