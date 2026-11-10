import { describe, expect, it } from "vitest";
import { checkProject } from "@blend65/compiler";
import { withProject } from "../rd06/project-fixture.js";

const HEADER = [
  "module Game;",
  "",
  "loadable const DATA: byte[4] = [1, 2, 3, 4];",
  "let target: byte[4];",
  "interrupt function handler(): void {}",
  "",
].join("\n");

/** Check one D64-profile source and return its error codes. */
async function errors(body: string): Promise<readonly string[]> {
  return withProject(
    `${HEADER}${body}\n`,
    [],
    async (project) => {
      const checked = await checkProject({ project });
      return checked.kind === "success"
        ? []
        : checked.diagnostics
            .filter(({ severity }) => severity === "error")
            .map(({ code }) => code);
    },
    "c64-pal-d64-kernal-6581",
  );
}

describe("load quiescence", () => {
  // An active user IRQ route rejects the call.
  it("should reject a load while a user IRQ is active", async () => {
    expect(
      await errors(
        "function main(): void { c64.system.setIRQ(&handler); c64.loader.load(DATA, target); }",
      ),
    ).toEqual(["E10275"]);
  });

  // A restored IRQ route permits the call.
  it("should allow a load after the user IRQ is restored", async () => {
    expect(
      await errors(
        "function main(): void { c64.system.setIRQ(&handler); c64.system.restoreIRQ(); c64.loader.load(DATA, target); }",
      ),
    ).toEqual([]);
  });

  // An active user NMI route rejects the call.
  it("should reject a load while a user NMI is active", async () => {
    expect(
      await errors(
        "function main(): void { c64.system.setNMI(&handler); c64.loader.load(DATA, target); }",
      ),
    ).toEqual(["E10275"]);
  });

  // A restored NMI route permits the call.
  it("should allow a load after the user NMI is restored", async () => {
    expect(
      await errors(
        "function main(): void { c64.system.setNMI(&handler); c64.system.restoreNMI(); c64.loader.load(DATA, target); }",
      ),
    ).toEqual([]);
  });

  // A mainline audio tick cannot run during the blocking call; no player contract is qualified
  // in this slice, so there is no installable audio route to exercise here.
});
