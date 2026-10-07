import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  CIA2_PROFILES,
  cia2Lease,
  expectCia2Accepted,
  expectCia2Rejected,
} from "./cia2-fixture.js";
import { profileSpan, withProfileProject } from "./profile-fixture.js";

describe.each(CIA2_PROFILES)("CIA2 parameter effects on %s", (target) => {
  it("preserves a full disable mask after reading its parameter home", async () => {
    const source = cia2Lease(
      "disable($1F); enableInterruptSources($01);",
      "",
      `function disable(mask: byte): void {
        let observed: byte = peek(&mask);
        disableInterruptSources(mask);
      }`,
    );
    await expectCia2Accepted(source, target);
  });

  it("preserves a full disable mask across a transitive read-only borrow", async () => {
    const source = cia2Lease(
      "disable($1F); enableInterruptSources($01);",
      "",
      `function readHome(address: word): byte { return peek(address); }
      function forwardRead(address: word): byte { return readHome(address); }
      function disable(mask: byte): void {
        let observed: byte = forwardRead(&mask);
        disableInterruptSources(mask);
      }`,
    );
    await expectCia2Accepted(source, target);
  });

  it("rejects an enable after a borrow changes the disable mask to a partial clear", async () => {
    const source = cia2Lease(
      "disable($1F); enableInterruptSources($01);",
      "",
      `function disable(mask: byte): void {
        poke(&mask, $01);
        disableInterruptSources(mask);
      }`,
    );
    await expectCia2Rejected(source, target, "E10278");
  });

  it("accepts a full disable mask established by an ordinary parameter reassignment", async () => {
    const source = cia2Lease(
      "disable($01); enableInterruptSources($01);",
      "",
      `function disable(mask: byte): void {
        mask = $1F;
        disableInterruptSources(mask);
      }`,
    );
    await expectCia2Accepted(source, target);
  });

  it("rejects an enable after an unknown disable mask", async () => {
    const source = cia2Lease(
      "disable(peek($0400)); enableInterruptSources($01);",
      "",
      "function disable(mask: byte): void { disableInterruptSources(mask); }",
    );
    await expectCia2Rejected(source, target, "E10278");
  });

  it("accepts supported timer flags supplied through an ordinary helper", async () => {
    const source = cia2Lease(
      "configure($19);",
      "",
      "function configure(flags: byte): void { configureTimerA(flags); }",
    );
    await expectCia2Accepted(source, target);
  });

  it("relates unsupported timer flags to the actual invalid caller and rejected value", async () => {
    const source = cia2Lease(
      "configure($19); configure($80);",
      "",
      "function configure(flags: byte): void { configureTimerA(flags); }",
    );
    await withProfileProject(source, target, async (project, root) => {
      for (const result of [await checkProject({ project }), await buildProject({ project })]) {
        expect(result.kind).toBe("failure");
        const errors = result.diagnostics.filter(({ severity }) => severity === "error");
        expect(errors.map(({ code }) => code)).toEqual(["E10278"]);
        const diagnostic = errors[0]!;
        expect(diagnostic.primarySpan).toEqual(profileSpan(source, "configureTimerA(flags)"));
        expect(diagnostic.related).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              span: profileSpan(source, "configure($80)"),
              message: expect.stringMatching(/(?:\$80\b|\b128\b|0x80\b)/),
            }),
          ]),
        );
        expect(
          diagnostic.related.some(
            ({ span }) =>
              span.start === profileSpan(source, "configure($19)").start &&
              span.end === profileSpan(source, "configure($19)").end,
          ),
        ).toBe(false);
      }
      await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  });
});
