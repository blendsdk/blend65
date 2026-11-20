import { buildProject, checkProject } from "@blend65/compiler";
import type { BuildResult, OptimizationGoal } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";

/**
 * One complete program under judgment. Each case differs from the others by a
 * single structural detail, so a failure identifies which detail the compiler
 * mishandles rather than merely reporting that some program was refused.
 */
interface DispatchProgram {
  /** Short name of the one structural difference this program carries. */
  label: string;
  /** Complete legal source text, written to a real temporary project. */
  source: string;
}

/** Supporting declarations a program needs beside its own main body. */
interface ProgramParts {
  /** Module-scope declarations placed before the callable candidates. */
  moduleScope?: string;
  /** The two functions the dispatch may select between. */
  candidates?: readonly string[];
  /** Extra functions main may call. */
  helpers?: readonly string[];
}

const target = "c64-pal-prg-kernal-6581";

/** Optional optimization must never decide whether a legal program compiles. */
const modes: readonly OptimizationGoal[] = ["none", "balanced", "speed", "size"];

/** The ordinary pair of selectable functions: no parameters, distinct results. */
const candidates: readonly string[] = [
  "function chosen(): byte { return 37; }",
  "function other(): byte { return 11; }",
];

/** Assemble one legal program from optional supporting text and a main body. */
function program(body: readonly string[], parts: ProgramParts = {}): string {
  return [
    "module Game;",
    ...(parts.moduleScope === undefined ? [] : [parts.moduleScope]),
    ...(parts.candidates ?? candidates),
    ...(parts.helpers ?? []),
    "function main(): void {",
    ...body.map((line) => `  ${line}`),
    "}",
    "",
  ].join("\n");
}

/**
 * The shape the requirement is about: a callable chosen at run time, a call
 * through it, and then whatever statements follow that call. The statements
 * after the call are the only thing the main axis varies.
 */
function afterIndirectCall(label: string, ...trailing: readonly string[]): DispatchProgram {
  return {
    label,
    source: program([
      "let hook: fn(): byte = &chosen;",
      "if (peek($C000) == 1) { hook = &other; }",
      "let i: byte = 0;",
      "poke($C100, hook());",
      ...trailing,
      "poke($C101, i);",
    ]),
  };
}

/** Holding a function in a variable and adding afterwards is ordinary code. */
const addition = afterIndirectCall("addition", "i = i + 1;");

/** Subtraction is the same requirement; the operator must not decide the outcome. */
const subtraction = afterIndirectCall("subtraction", "i = i - 1;");

/** Explain a refusal inside the assertion message so a failure names its own cause. */
function refusal(result: BuildResult): string {
  if (result.kind !== "failure") return "";
  return `Refused (${result.category}): ${JSON.stringify(result.diagnostics)}`;
}

/** Build one program in one mode and require a published result. */
async function expectPublished(dispatch: DispatchProgram, optimization: OptimizationGoal) {
  await withProfileProject(dispatch.source, target, async (project) => {
    const built = await buildProject({ project, optimization });
    expect(built.kind, refusal(built)).toBe("success");
  });
}

describe.each(modes)("arithmetic after a call through a function variable in mode %s", (mode) => {
  it.each([
    [addition.label, addition],
    [subtraction.label, subtraction],
  ] as const)(
    "should compile a program whose %s follows the indirect call",
    async (_name, dispatch) => {
      await expectPublished(dispatch, mode);
    },
    60_000,
  );
});

describe("checking a program whose arithmetic follows a call through a function variable", () => {
  it.each([
    [addition.label, addition],
    [subtraction.label, subtraction],
  ] as const)(
    "should report success for a program whose %s follows the indirect call",
    async (_name, dispatch) => {
      await withProfileProject(dispatch.source, target, async (project) => {
        const checked = await checkProject({ project });
        expect(
          checked.kind,
          `Checking must agree that the program is legal: ${JSON.stringify(checked.diagnostics)}`,
        ).toBe("success");
      });
    },
    60_000,
  );
});

/**
 * Neighbouring programs that already compile. They surround the case above on
 * every axis the requirement distinguishes — whether arithmetic follows the
 * call at all, which operator it uses, whether it precedes the call, how many
 * functions the variable may hold, whether the call takes an argument, where
 * the callable is stored, and which function performs the arithmetic. A
 * repair that fixes the refused program by refusing one of these instead has
 * not met the requirement.
 */
const routes: readonly DispatchProgram[] = [
  afterIndirectCall("no arithmetic after the call"),
  afterIndirectCall("a shift after the call", "i = i << 1;"),
  {
    label: "addition before the call",
    source: program([
      "let hook: fn(): byte = &chosen;",
      "if (peek($C000) == 1) { hook = &other; }",
      "let i: byte = 0;",
      "i = i + 1;",
      "poke($C100, hook());",
      "poke($C101, i);",
    ]),
  },
  {
    label: "one possible target",
    source: program([
      "let hook: fn(): byte = &chosen;",
      "let i: byte = 0;",
      "poke($C100, hook());",
      "i = i + 1;",
      "poke($C101, i);",
    ]),
  },
  {
    label: "a callable taking an argument",
    source: program(
      [
        "let hook: fn(byte): byte = &chosen;",
        "if (peek($C000) == 1) { hook = &other; }",
        "let i: byte = 0;",
        "poke($C100, hook(5));",
        "i = i + 1;",
        "poke($C101, i);",
      ],
      {
        candidates: [
          "function chosen(value: byte): byte { return 37; }",
          "function other(value: byte): byte { return 11; }",
        ],
      },
    ),
  },
  {
    label: "a callable in a local struct field",
    source: program(
      [
        "let held: Holder = { callback: &chosen };",
        "if (peek($C000) == 1) { held.callback = &other; }",
        "let i: byte = 0;",
        "poke($C100, held.callback());",
        "i = i + 1;",
        "poke($C101, i);",
      ],
      { moduleScope: "struct Holder { callback: fn(): byte; }" },
    ),
  },
  {
    label: "a callable in a module variable",
    source: program(
      [
        "if (peek($C000) == 1) { hook = &other; }",
        "let i: byte = 0;",
        "poke($C100, hook());",
        "i = i + 1;",
        "poke($C101, i);",
      ],
      { moduleScope: "let hook: fn(): byte = &chosen;" },
    ),
  },
  {
    label: "arithmetic performed by another function",
    source: program(
      [
        "let hook: fn(): byte = &chosen;",
        "if (peek($C000) == 1) { hook = &other; }",
        "poke($C100, hook());",
        "poke($C101, tally(0));",
      ],
      {
        helpers: [
          "function tally(seed: byte): byte {",
          "  let i: byte = seed;",
          "  i = i + 1;",
          "  return i;",
          "}",
        ],
      },
    ),
  },
];

describe.each(modes)("neighbouring dispatch routes in mode %s", (mode) => {
  it.each(routes.map((route) => [route.label, route] as const))(
    "should keep compiling a program with %s",
    async (_name, route) => {
      await expectPublished(route, mode);
    },
    60_000,
  );
});

describe.each(modes)("repeated builds in mode %s", (mode) => {
  /**
   * Two builds of one unchanged source must agree byte for byte. A repair that
   * reaches a published result by consulting something unstable would show up
   * here as two different programs from the same text.
   */
  it("should produce identical bytes for the program whose addition follows the indirect call", async () => {
    await withProfileProject(addition.source, target, async (project) => {
      const first = await buildProject({ project, optimization: mode });
      expect(first.kind, refusal(first)).toBe("success");
      if (first.kind !== "success") throw new Error("The first build reached no publication");
      const reference = await readProfileArtifacts(first);

      const second = await buildProject({ project, optimization: mode });
      expect(second.kind, refusal(second)).toBe("success");
      if (second.kind !== "success") throw new Error("The repeated build reached no publication");
      const repeated = await readProfileArtifacts(second);

      expect(repeated.prg).toEqual(reference.prg);
    });
  }, 120_000);
});
