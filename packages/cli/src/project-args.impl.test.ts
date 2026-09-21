import { describe, expect, it } from "vitest";
import { parseArguments } from "./args.js";

describe("native argument parser", () => {
  it.each([[["-hh"]], [["-vv"]], [["--help=true"]], [["--", "check"]]])(
    "should reject malformed informational tokens %j",
    (argv) => {
      expect(parseArguments(argv)).toBeNull();
    },
  );

  it("should retain explicitly empty project values for service validation", () => {
    expect(parseArguments(["check", "--project=", "--target=", "--entry="])).toEqual({
      kind: "check",
      options: { project: "", target: "", entry: "" },
    });
  });

  it("should parse separate and equals forms into the same build selections", () => {
    const expected = {
      kind: "build",
      options: {
        project: "blend65.json",
        optimization: "none",
        boundsCheck: true,
        divisionZeroCheck: false,
      },
    };
    expect(
      parseArguments([
        "build",
        "--project",
        "blend65.json",
        "--optimization",
        "none",
        "--bounds-check",
        "true",
        "--division-zero-check",
        "false",
      ]),
    ).toEqual(expected);
    expect(
      parseArguments([
        "build",
        "--project=blend65.json",
        "--optimization=none",
        "--bounds-check=true",
        "--division-zero-check=false",
      ]),
    ).toEqual(expected);
  });
});
