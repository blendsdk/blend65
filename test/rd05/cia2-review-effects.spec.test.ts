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
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  profileSpan,
  withProfileProject,
} from "./profile-fixture.js";

/** Return the exact instruction lines of one named routine in generated assembly. */
function routineInstructions(assembly: string, name: string): string[] {
  const start = assembly.indexOf(`; routine "${name}"`);
  expect(start).toBeGreaterThanOrEqual(0);
  const lines = assembly.slice(start).split("\n").slice(1);
  const body: string[] = [];
  for (const line of lines) {
    if (line.startsWith("* =") || line.startsWith("; routine ")) break;
    if (line.startsWith("  ")) body.push(line.trim());
  }
  return body;
}

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

  // The fixed scalar borrow reads its certified home directly, keeps the volatile
  // read in A, and spends no pointer home on an address the binder already knows.
  it("should read a fixed parameter borrow directly without a pointer copy", async () => {
    const artifacts = await buildProfileSource(
      cia2Lease(
        "disable($1F); enableInterruptSources($01);",
        "",
        `function disable(mask: byte): void {
          peek(&mask);
          disableInterruptSources(mask);
        }`,
      ),
      target,
    );
    const body = routineInstructions(artifacts.assembly, "Game.disable");
    expect(body).toHaveLength(4);
    expect(body[0]).toMatch(/^lda \$(?:[0-9a-f]{2}|[0-9a-f]{4})$/u);
    expect(body.slice(1)).toEqual(["and #$1f", "sta $dd0d", "rts"]);
    const totals = profileRecord(artifacts.costs.totals);
    const zeroPage = profileRecords(totals.resources).find(
      (row) => row.kind === "standard" && row.id === "zeroPage",
    );
    expect(zeroPage?.value).toBe(0);
  }, 60_000);

  // A forwarded borrow is only safe for equality and bitwise consumers. Signed
  // ordering writes A from the right operand first, so the left home must be
  // loaded normally instead.
  it("should not forward a fixed borrow into a signed ordering comparison", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
function negative(mask: sbyte): boolean {
  peek(&mask);
  return mask < 0;
}
function main(): void { poke($D020, negative(5) ? 1 : 0); }`,
      target,
    );
    const body = routineInstructions(artifacts.assembly, "Game.negative");
    expect(body.filter((line) => line.startsWith("lda $")).length).toBeGreaterThanOrEqual(2);
    const signedPrologue = body.findIndex((line) => line === "eor #$80");
    expect(signedPrologue).toBeGreaterThan(0);
    expect(body.slice(0, signedPrologue).some((line) => line.startsWith("lda $"))).toBe(true);
  }, 60_000);

  // A forwarded raw read must not stay live in A across a call. The borrowed
  // value is staged before the callee and reloaded from that home afterwards.
  it("should stage a fixed borrow across a call instead of keeping it in A", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
function h(): byte { return 9; }
function sink(a: byte, b: byte): void { poke($D020, a); poke($D021, b); }
function consume(mask: byte): void {
  peek(&mask);
  sink(mask, h());
}
function main(): void { consume($1F); }`,
      target,
    );
    const body = routineInstructions(artifacts.assembly, "Game.consume");
    const call = body.findIndex((line) => line.startsWith("jsr"));
    expect(call).toBeGreaterThan(0);
    expect(body.slice(0, call).some((line) => line.startsWith("sta "))).toBe(true);
    expect(body.slice(call).some((line) => line.startsWith("lda "))).toBe(true);
  }, 60_000);

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
