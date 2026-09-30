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
const install = "c64.system.setIRQExclusive(&onIRQ);";
const mutations = [
  { name: "typed", statement: "c64.cia1.writeTimerALatch($1234);" },
  { name: "raw", statement: "poke($DC04, 0);" },
] as const;
const cleanInner = `function cleanInner(): void {
  ${install}
  ${restore};
}`;
const popForms = [
  { name: "direct", declarations: "", call: "releaseA();" },
  {
    name: "transitive",
    declarations: "function releaseVia(): void { releaseA(); }",
    call: "releaseVia();",
  },
  {
    name: "finite indirect",
    declarations: `function releaseB(): void { releaseA(); }
function releaseVia(): void {
  let release: fn(): void = peek($0400) == 0 ? &releaseA : &releaseB;
  release();
}`,
    call: "releaseVia();",
  },
] as const;

/** Save caller status while keeping all ordinary helper calls balanced. */
function program(body: string, declarations = cleanInner, handlerBody = ""): string {
  return `module Game;
interrupt function onIRQ(): void { ${handlerBody} }
${declarations}
function main(): void {
  asm_php(); asm_sei();
  ${body}
  asm_plp();
}`;
}

/** Both public paths must preserve exact release blame and forbid rejected generation. */
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

describe.each(profiles)("CIA1 helper effect preservation on %s", (profile) => {
  // A clean inner route leaves the older exclusive owner's typed configuration intact.
  it.each(["", mutations[0].statement])(
    "should accept repeated clean inner leases with outer work %j",
    async (effect) => {
      const body = `${install} cleanInner(); ${effect}
  cleanInner(); ${restore};`;
      await verify(program(body), profile);
    },
  );

  // A raw outer mutation cannot become a typed stock handback after a clean helper call.
  it.each([false, true])(
    "should reject raw outer handback with clean helper called first %s",
    async (warmFirst) => {
      const body = `${install} ${warmFirst ? "cleanInner();" : ""}
  ${mutations[1].statement} cleanInner(); ${restore};
  asm_plp(); for (;;) { asm_nop(); }`;
      await verify(program(body), profile, 1);
    },
  );

  // Repeated calls see a clean current link but must retain a changed older inner link.
  it.each(mutations)(
    "should reject the exposed older $name route after repeated clean helper calls",
    async ({ statement }) => {
      const body = `${install} ${install} ${install}
  cleanInner(); ${restore};
  ${statement}
  ${install} cleanInner(); ${restore};
  ${restore}; asm_plp(); for (;;) { asm_nop(); }`;
      await verify(program(body), profile, 3);
    },
  );

  // A helper may pop a caller-owned link; its effect must apply to the current caller's prefix.
  for (const form of popForms) {
    it.each(mutations)(
      `should reject an older $name route after repeated ${form.name} caller-owned pops`,
      async ({ statement }) => {
        const declarations = `function releaseA(): void { ${restore}; }
${form.declarations}`;
        const body = `${install} ${install} ${install} ${form.call}
  ${statement}
  ${install} ${form.call}
  ${form.call} asm_plp(); for (;;) { asm_nop(); }`;
        await verify(program(body, declarations), profile, 0);
      },
    );

    // Branch order cannot turn a caller-owned pop into permission to erase older raw work.
    it.each([false, true])(
      `should reject joined caller-owned ${form.name} pops with dirty branch first %s`,
      async (dirtyFirst) => {
        const declarations = `function releaseA(): void { ${restore}; }
${form.declarations}`;
        const dirty = `${mutations[1].statement} ${install} ${form.call}`;
        const clean = `${install} ${form.call}`;
        const body = `${install} ${install}
  if (peek($0400) == 0) { ${dirtyFirst ? dirty : clean} }
  else { ${dirtyFirst ? clean : dirty} }
  ${form.call} asm_plp(); for (;;) { asm_nop(); }`;
        await verify(program(body, declarations), profile, 0);
      },
    );
  }

  // Both visitation orders must retain a possible raw mutation at a shared release.
  it.each([false, true])(
    "should reject the joined raw older route with dirty branch first %s",
    async (dirtyFirst) => {
      const dirty = `${mutations[1].statement} ${install} cleanInner(); ${restore};`;
      const clean = `${install} cleanInner(); ${restore};`;
      const body = `${install} ${install}
  if (peek($0400) == 0) { ${dirtyFirst ? dirty : clean} }
  else { ${dirtyFirst ? clean : dirty} }
  ${restore}; asm_plp(); for (;;) { asm_nop(); }`;
      await verify(program(body), profile, 3);
    },
  );

  // A loop join includes the older mutation even when every helper-owned inner route is clean.
  it.each(mutations)(
    "should reject the older $name route after a bounded-loop join",
    async ({ statement }) => {
      const body = `${install} ${install} ${install}
  cleanInner(); ${restore};
  for (let n: byte = 0; n < 2; n += 1) {
    ${statement} ${install} cleanInner(); ${restore};
  }
  ${restore}; asm_plp(); for (;;) { asm_nop(); }`;
      await verify(program(body), profile, 3);
    },
  );

  // IRQ entry can change an older link while later helper-owned inner links remain clean.
  for (const status of ["asm_cli();", "asm_php(); asm_cli(); asm_plp();"]) {
    it.each(mutations)(
      `should reject handler $name effects exposed after unmasking helper ${status}`,
      async ({ statement }) => {
        const declarations = `${cleanInner}
interrupt function mutatingIRQ(): void { ${statement} }
function allowIRQ(): void { ${status} }`;
        const body = `${install}
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  let pending: byte = c64.cia1.readAndClearPendingSources();
  poke($0401, pending);
  c64.system.setIRQExclusive(&mutatingIRQ);
  ${install} cleanInner(); ${restore};
  allowIRQ(); asm_sei();
  ${install} cleanInner(); ${restore};
  ${restore}; asm_plp(); for (;;) { asm_nop(); }`;
        await verify(program(body, declarations), profile, 3);
      },
    );
  }
});
