import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileSpan, withProfileProject } from "./profile-fixture.js";

const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
const IMPORTS =
  "module Game; import { setNMI, restoreNMI, setIRQ, setIRQExclusive, restoreIRQ } from c64.system;";
const MASK = "asm_php(); asm_sei(); asm_nop();";
const CLI_BODY = "asm_cli(); asm_nop(); asm_sei(); asm_nop();";
const CAPTURE_BODY = "setIRQExclusive(&A); restoreIRQ();";
type Proof = { text: string; occurrence?: number };

/** Require real public semantic acceptance and assembled publication, not a route-only claim. */
async function expectSuccess(source: string, profile: string) {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    expect(checked.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    expect(built.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    if (built.kind !== "success") throw new Error("Expected complete publication");
    await expect(
      access(join(built.generation.directory, built.generation.primaryArtifact)),
    ).resolves.toBeUndefined();
  });
}

/** Attribute the exact rejected source operation in both services while retaining witness locations. */
async function expectFailure(
  source: string,
  profile: string,
  code: "E10245" | "E10278",
  primary: Proof,
  related: readonly Proof[] = [],
) {
  await withProfileProject(source, profile, async (project, root) => {
    const span = profileSpan(source, primary.text, primary.occurrence ?? 0);
    for (const result of [
      await checkProject({ project }),
      await buildProject({ project, optimization: "none" }),
    ]) {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      const diagnostic = errors.find(
        (entry) =>
          entry.code === code &&
          entry.primarySpan?.sourceId === span.sourceId &&
          entry.primarySpan.start === span.start &&
          entry.primarySpan.end === span.end,
      );
      expect(diagnostic, JSON.stringify(errors)).toBeDefined();
      expect(diagnostic!.severity).toBe("error");
      expect(diagnostic!.primarySpan).toEqual(span);
      expect(diagnostic!.message).toMatch(
        code === "E10245"
          ? /^Execution path '[^']+' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy$/u
          : /^Interrupt ownership for sink '[^']+' is invalid at '[^']+' — .+$/u,
      );
      expect(Array.isArray(diagnostic!.related)).toBe(true);
      for (const proof of related)
        expect(diagnostic!.related.map((entry) => entry.span)).toContainEqual(
          profileSpan(source, proof.text, proof.occurrence ?? 0),
        );
      expect(result).not.toHaveProperty("generation");
    }
    await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });
}

/** Isolate one changing main CINV transition, or an equal-entry/no-transition control. */
function cinvSource(
  body: string,
  operation: "install" | "removal" | "control" | "same",
  installer: "setIRQ" | "setIRQExclusive",
) {
  const before =
    operation === "removal" ? `${installer}(&B); ${installer}(&A);` : `${installer}(&A);`;
  const during =
    operation === "install"
      ? `${installer}(&B);`
      : operation === "removal"
        ? "restoreIRQ();"
        : operation === "same"
          ? `${installer}(&A);`
          : "asm_nop();";
  const after =
    operation === "install" || operation === "same"
      ? "restoreIRQ(); restoreIRQ();"
      : "restoreIRQ();";
  return `${IMPORTS}
place(at: $2040) interrupt function A(): void {}
place(at: $2150) interrupt function B(): void {}
interrupt function onNMI(): void { ${body} }
function main(): void { ${MASK} ${before} setNMI(&onNMI); ${during} restoreNMI(); ${after} asm_plp(); }`;
}

describe("cooperative NMI proof boundaries", () => {
  // Handler-visible mutable bindings cannot retain stale mainline constants across an arrival.
  for (const helper of [false, true]) {
    it.each(PROFILES)(
      `should reject a stale global address when NMI mutates it ${helper ? "through a helper" : "directly"} on %s`,
      async (profile) => {
        const declaration = helper ? "function changeAddress(): void { ADDRESS = $0318; }" : "";
        const body = helper ? "changeAddress();" : "ADDRESS = $0318;";
        const source = `${IMPORTS} let ADDRESS: word; ${declaration}
interrupt function onNMI(): void { ${body} }
function main(): void { ADDRESS = $d020; setNMI(&onNMI); poke(ADDRESS, 7); restoreNMI(); }`;
        await expectFailure(source, profile, "E10278", { text: "poke(ADDRESS, 7)" });
      },
      60_000,
    );
  }

  const addressControls = [
    [
      "a different global changes",
      "let OTHER: word;",
      "OTHER = $0318;",
      "ADDRESS = $d020; setNMI(&onNMI); poke(ADDRESS, 7); restoreNMI();",
    ],
    [
      "the local address was evaluated before installation",
      "function changeAddress(): void { ADDRESS = $0318; }",
      "changeAddress();",
      "ADDRESS = $d020; let evaluated: word = ADDRESS; setNMI(&onNMI); poke(evaluated, 7); restoreNMI();",
    ],
  ];
  for (const [name, declarations, body, main] of addressControls) {
    it.each(PROFILES)(
      `should preserve a proved disjoint poke when ${name} on %s`,
      async (profile) => {
        const source = `${IMPORTS} let ADDRESS: word; ${declarations} interrupt function onNMI(): void { ${body} } function main(): void { ${main} }`;
        // A scalar copy is its own value; globals remain shared, and warnings stay warnings.
        await expectSuccess(source, profile);
      },
      60_000,
    );
  }

  for (const selfInstall of [false, true]) {
    it.each(PROFILES)(
      `should accept a nonreturning main when its NMI ${selfInstall ? "installs itself and is nonreturning" : "returns without changing ownership"} on %s`,
      async (profile) => {
        const body = selfInstall ? "setNMI(&onNMI); while (true) {}" : "";
        const source = `${IMPORTS} interrupt function onNMI(): void { ${body} } function main(): void { setNMI(&onNMI); while (true) {} }`;
        // No ordinary recursion, activation-private storage, restore or reachable chain tail
        // is introduced by the nonreturning self-install path. Checking must still terminate.
        await expectSuccess(source, profile);
      },
      60_000,
    );
  }

  // SEI cannot block NMI. A CLI followed by NOP makes the torn CINV observable to IRQ.
  for (const operation of ["install", "removal"] as const) {
    it.each(PROFILES)(
      `should reject the changing main CINV ${operation} when NMI enables IRQ on %s`,
      async (profile) => {
        const source = cinvSource(CLI_BODY, operation, "setIRQ");
        const primary = operation === "install" ? "setIRQ(&B)" : "restoreIRQ()";
        await expectFailure(source, profile, "E10245", { text: primary }, [
          { text: "setNMI(&onNMI)" },
          { text: "asm_cli()" },
        ]);
      },
      60_000,
    );
  }

  // Exclusive A has no predecessor-chain tail. Equal A captures can therefore share a word;
  // changing main to/from B breaks that equality, including at the low/high store boundary.
  it.each(PROFILES)(
    "should accept equal captured CINV bytes when NMI temporarily reinstalls exclusive A on %s",
    async (profile) => {
      await expectSuccess(cinvSource(CAPTURE_BODY, "control", "setIRQExclusive"), profile);
    },
    60_000,
  );
  for (const operation of ["install", "removal"] as const) {
    it.each(PROFILES)(
      `should reject the changing main CINV ${operation} when NMI captures exclusive A on %s`,
      async (profile) => {
        const source = cinvSource(CAPTURE_BODY, operation, "setIRQExclusive");
        const primary =
          operation === "install"
            ? { text: "setIRQExclusive(&B)" }
            : { text: "restoreIRQ()", occurrence: 1 };
        await expectFailure(source, profile, "E10245", primary, [
          { text: "setNMI(&onNMI)" },
          { text: "setIRQExclusive(&A)" },
        ]);
      },
      60_000,
    );
  }

  it.each(PROFILES)(
    "should accept ordinary main IRQ updates when live NMI neither unmasks IRQ nor touches CINV on %s",
    async (profile) => {
      const source = `${IMPORTS} interrupt function onIRQ(): void {} interrupt function onNMI(): void { poke($d020, 1); } function main(): void { ${MASK} setNMI(&onNMI); setIRQ(&onIRQ); restoreIRQ(); restoreNMI(); asm_plp(); }`;
      await expectSuccess(source, profile);
    },
    60_000,
  );

  for (const before of [true, false]) {
    it.each(PROFILES)(
      `should accept changing CINV when the IRQ update is ${before ? "before NMI installation" : "after the final NMI pop"} on %s`,
      async (profile) => {
        const irq = "setIRQ(&onIRQ); restoreIRQ();";
        const nmi = "setNMI(&onNMI); asm_nop(); restoreNMI();";
        const main = before ? `${irq} ${nmi}` : `${nmi} ${irq}`;
        const source = `${IMPORTS} interrupt function onIRQ(): void {} interrupt function onNMI(): void { ${CLI_BODY} } function main(): void { ${MASK} ${main} asm_plp(); }`;
        await expectSuccess(source, profile);
      },
      60_000,
    );
  }

  it.each(PROFILES)(
    "should accept identical exclusive CINV reinstall when NMI can enable IRQ on %s",
    async (profile) => {
      // Both stores leave A's exact exclusive entry bytes unchanged. Finish NMI lifetime
      // before either pop, especially the final stock CIA1/vector handback.
      await expectSuccess(cinvSource(CLI_BODY, "same", "setIRQExclusive"), profile);
    },
    60_000,
  );
});
