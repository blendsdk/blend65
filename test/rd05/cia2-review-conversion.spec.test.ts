import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { CIA2_PROFILES, cia2Lease, expectCia2Accepted } from "./cia2-fixture.js";
import { profileSpan, withProfileProject } from "./profile-fixture.js";

describe.each(CIA2_PROFILES)("CIA2 narrowing conversion on %s", (target) => {
  it("accepts supported low-byte timer flags after narrowing a word parameter", async () => {
    const source = cia2Lease(
      "configure($019); configure($119);",
      "",
      "function configure(flags: word): void { configureTimerA(byte(flags)); }",
    );
    await expectCia2Accepted(source, target);
  });

  it.each([
    ["check", checkProject],
    ["build", buildProject],
  ] as const)(
    "relates rejected narrowed timer flags to the actual reaching caller in %s",
    async (_service, run) => {
      const source = cia2Lease(
        "configure($019); configure($180);",
        "",
        "function configure(flags: word): void { configureTimerA(byte(flags)); }",
      );
      await withProfileProject(source, target, async (project, root) => {
        const result = await run({ project });
        expect(result.kind).toBe("failure");
        const errors = result.diagnostics.filter(({ severity }) => severity === "error");
        expect(errors.map(({ code }) => code)).toEqual(["E10278"]);
        const diagnostic = errors[0]!;
        expect
          .soft(diagnostic.primarySpan)
          .toEqual(profileSpan(source, "configureTimerA(byte(flags))"));
        expect.soft(diagnostic.related).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              span: profileSpan(source, "configure($180)"),
              message: expect.stringMatching(/\S/),
            }),
          ]),
        );
        const acceptedCaller = profileSpan(source, "configure($019)");
        expect
          .soft(
            diagnostic.related.some(
              ({ span }) =>
                span.sourceId === acceptedCaller.sourceId &&
                span.start === acceptedCaller.start &&
                span.end === acceptedCaller.end,
            ),
          )
          .toBe(false);
        expect
          .soft(
            [diagnostic.message, ...diagnostic.related.map(({ message }) => message)].join("\n"),
          )
          .toMatch(/(?:\$80\b|\b128\b|0x80\b)/);
        expect.soft(result).not.toHaveProperty("generation");
        await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
      });
    },
  );
});
