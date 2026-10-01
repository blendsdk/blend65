import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileSpan, withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const restore = "c64.system.restoreIRQ()";
const install = "c64.system.setIRQExclusive(&quietIRQ);";
const mutations = [
  { name: "typed latch", statement: "c64.cia1.writeTimerALatch($1234);" },
  { name: "raw latch", statement: "poke($DC04, 0);" },
] as const;
const enabledForms = [
  { name: "enabled main entry", entry: "asm_cli();", declarations: "", call: "" },
  {
    name: "transitive CLI",
    entry: "asm_sei();",
    declarations: `function allowLeaf(): void { asm_cli(); }
function allowIRQ(): void { allowLeaf(); }`,
    call: "allowIRQ();",
  },
  {
    name: "transitive PLP",
    entry: "asm_cli();",
    declarations: `function allowLeaf(): void { asm_php(); asm_sei(); asm_plp(); }
function allowIRQ(): void { allowLeaf(); }`,
    call: "allowIRQ();",
  },
] as const;
const cleanInner = `function cleanInner(): void {
  ${install}
  ${restore};
}`;

/** Preserve caller status and use only callback installs for interrupt handlers. */
function program(body: string, declarations = "", entry = "asm_cli();"): string {
  return `module Game;
interrupt function quietIRQ(): void {}
${cleanInner}
${declarations}
function main(): void {
  asm_php(); ${entry}
  ${body}
  asm_sei(); asm_plp();
}`;
}

/** Require the same exact source ownership decision from checking and building. */
async function verify(source: string, profile: string, rejectedRestore?: number) {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    const built = await buildProject({ project, optimization: "none" });
    for (const result of [checked, built]) {
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect
        .soft(result.kind, JSON.stringify(result.diagnostics))
        .toBe(rejectedRestore === undefined ? "success" : "failure");
      if (rejectedRestore === undefined) expect.soft(errors).toEqual([]);
      else {
        expect.soft(errors).toHaveLength(1);
        expect.soft(errors[0]).toMatchObject({
          code: "E10278",
          severity: "error",
          primarySpan: profileSpan(source, restore, rejectedRestore),
        });
      }
    }
    if (rejectedRestore === undefined) expect.soft(built).toHaveProperty("generation");
    else expect.soft(built).not.toHaveProperty("generation");
  });
}

describe.each(profiles)("CIA1 effects with enabled IRQs on %s", (profile) => {
  for (const form of enabledForms) {
    it.each(["", mutations[0].statement])(
      `accepts final stock handback after repeated clean helpers with ${form.name} and outer work %j`,
      async (effect) => {
        const body = `${install} ${form.call}
  cleanInner(); ${effect} cleanInner(); ${restore};`;
        await verify(program(body, form.declarations, form.entry), profile);
      },
    );

    it.each(mutations)(
      `preserves an older $name inner-owner error after repeated clean helpers with ${form.name}`,
      async ({ statement }) => {
        const body = `${install} ${install} ${form.call}
  cleanInner(); ${statement} cleanInner();
  asm_sei(); ${restore}; asm_plp(); for (;;) { asm_nop(); }`;
        await verify(program(body, form.declarations, form.entry), profile, 1);
      },
    );

    it(`rejects raw final stock handback after repeated clean helpers with ${form.name}`, async () => {
      const body = `${install} ${form.call}
  cleanInner(); ${mutations[1].statement} cleanInner();
  asm_sei(); ${restore}; asm_plp(); for (;;) { asm_nop(); }`;
      await verify(program(body, form.declarations, form.entry), profile, 1);
    });
  }

  for (const form of ["direct", "transitive", "finite indirect"] as const) {
    it.each(mutations)(
      `retains ${form} handler $name effects across repeated clean helpers`,
      async ({ statement }) => {
        const effects =
          form === "direct"
            ? { declarations: "", call: statement }
            : form === "transitive"
              ? {
                  declarations: `function effectLeaf(): void { ${statement} }
function effectVia(): void { effectLeaf(); }`,
                  call: "effectVia();",
                }
              : {
                  declarations: `function effectA(): void { ${statement} }
function effectB(): void { ${statement} }
function effectVia(): void {
  let effect: fn(): void = peek($0400) == 0 ? &effectA : &effectB;
  effect();
}`,
                  call: "effectVia();",
                };
        const declarations = `${effects.declarations}
interrupt function mutatingIRQ(): void { ${effects.call} }`;
        const body = `${install}
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  let pending: byte = c64.cia1.readAndClearPendingSources();
  poke($0401, pending);
  c64.system.setIRQExclusive(&mutatingIRQ);
  cleanInner(); cleanInner(); asm_sei();
  ${restore}; asm_plp(); for (;;) { asm_nop(); }`;
        await verify(program(body, declarations), profile, 1);
      },
    );
  }

  it.each([
    { name: "raw timer control", statement: "poke($DC0E, 0);" },
    { name: "raw interrupt mask", statement: "poke($DC0D, $7F);" },
  ])("retains handler $name effects", async ({ statement }) => {
    const body = `${install} c64.system.setIRQExclusive(&mutatingIRQ);
  cleanInner(); cleanInner(); asm_sei();
  ${restore}; asm_plp(); for (;;) { asm_nop(); }`;
    await verify(
      program(body, `interrupt function mutatingIRQ(): void { ${statement} }`),
      profile,
      1,
    );
  });

  it.each([false, true])(
    "preserves exact older raw-owner blame with dirty branch first %s",
    async (dirtyFirst) => {
      const dirty = `cleanInner(); ${mutations[1].statement} cleanInner();`;
      const clean = "cleanInner(); cleanInner();";
      const body = `${install} ${install}
  if (peek($0400) == 0) { ${dirtyFirst ? dirty : clean} }
  else { ${dirtyFirst ? clean : dirty} }
  asm_sei(); ${restore}; asm_plp(); for (;;) { asm_nop(); }`;
      await verify(program(body), profile, 1);
    },
  );

  it.each(["", ...mutations.map(({ statement }) => statement)])(
    "checks handler-side temporary links with inner mutation %j",
    async (effect) => {
      const declarations = `interrupt function onIRQ(): void {
  ${install} cleanInner(); ${effect} cleanInner(); ${restore};
}`;
      const exit = effect === "" ? `${restore};` : "asm_plp(); for (;;) { asm_nop(); }";
      const body = `c64.system.setIRQExclusive(&onIRQ);
  cleanInner(); cleanInner(); asm_sei(); ${exit}`;
      await verify(program(body, declarations), profile, effect === "" ? undefined : 1);
    },
  );
});
