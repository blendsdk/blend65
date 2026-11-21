import { buildProject, checkProject } from "@blend65/compiler";
import type { BuildResult, CheckResult, OptimizationGoal } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";

/**
 * A function whose body loops forever never reaches its own end, so every
 * statement written after a call to it is unreachable. Unreachable code is not
 * an error in this language: the program is legal, and an author expects it to
 * compile with the code after the call simply never running.
 *
 * What this oracle pins is that the way the callee is reached cannot decide the
 * answer. Calling it by name, through a variable that can only hold it, and
 * through a variable that may hold either of two such functions are three ways
 * of writing one program, so all three must be accepted together. The kind of
 * work that follows the call must not decide it either — arithmetic reads
 * processor state that a plain store does not, which is incidental detail of
 * the generated code rather than anything the program says.
 *
 * Acceptance only. Neither the instruction sequence a call lowers to nor the
 * placement of the unreachable code is pinned here; those belong to their own
 * units, where repeating them would make a correct change look like a
 * regression.
 */

const target = "c64-pal-prg-kernal-6581";

/** Optional optimization must never decide whether a legal program compiles. */
const modes: readonly OptimizationGoal[] = ["none", "balanced", "speed", "size"];

/** How the program names the function it calls. */
type Route = "a direct call" | "a pointer to one function" | "a pointer to either of two";

/** Whether the called function reaches its own end or loops forever instead. */
type Callee = "returns" | "loops forever";

/** The work written after the call, which the call route must not interact with. */
type Suffix = "arithmetic on a read byte" | "a plain store";

/** The structural knobs of one complete program under judgment. */
interface ProgramShape {
  readonly route: Route;
  readonly callee: Callee;
  readonly suffix: Suffix;
}

/** One legal program, written to a real temporary project and compiled for real. */
interface CallProgram {
  /** The exact combination of structural detail this program carries. */
  readonly label: string;
  /** Complete legal source text. */
  readonly source: string;
}

/** A body that loops forever needs no return, because its end is never reached. */
const loopsForever = "while (true) { }";

/** Declare one callable with the requested body, leaving a mark when it does end. */
function declaration(name: string, callee: Callee, mark: number): string {
  return `function ${name}(): void { ${callee === "returns" ? `poke($C200, ${mark});` : loopsForever} }`;
}

/**
 * Statements that reach the callee by the requested route.
 *
 * The two-function route needs a condition only known at run time, so that
 * neither candidate can be ruled out before the call is generated.
 */
function callStatements(route: Route): readonly string[] {
  if (route === "a direct call") return ["  first();"];
  if (route === "a pointer to one function")
    return ["  let hook: fn(): void = &first;", "  hook();"];
  return [
    "  let hook: fn(): void = &first;",
    "  if (peek($C000) == 1) { hook = &second; }",
    "  hook();",
  ];
}

/**
 * Work written after the call.
 *
 * The arithmetic form is the one that distinguishes the routes in practice: an
 * addition consumes processor state that the generated code has to account for,
 * where a store of a literal consumes none.
 */
function suffixStatements(suffix: Suffix): readonly string[] {
  if (suffix === "a plain store") return ["  poke($C101, 11);"];
  return ["  let i: byte = peek($C002);", "  i = i + peek($C003);", "  poke($C101, i);"];
}

/** Build the program the requirement is about: one call, then ordinary work. */
function callProgram(shape: ProgramShape): CallProgram {
  const { route, callee, suffix } = shape;
  const declarations = [declaration("first", callee, 1)];
  if (route === "a pointer to either of two") declarations.push(declaration("second", callee, 2));
  return {
    label: `${route} to a function that ${callee}, followed by ${suffix}`,
    source: [
      "module Game;",
      ...declarations,
      "function main(): void {",
      ...callStatements(route),
      ...suffixStatements(suffix),
      "}",
      "",
    ].join("\n"),
  };
}

const routes: readonly Route[] = [
  "a direct call",
  "a pointer to one function",
  "a pointer to either of two",
];

const suffixes: readonly Suffix[] = ["arithmetic on a read byte", "a plain store"];

const programs: readonly CallProgram[] = routes.flatMap((route) =>
  suffixes.flatMap((suffix) => [
    // The shape the requirement is about: nothing after the call can ever run.
    callProgram({ route, callee: "loops forever", suffix }),
    // The ordinary program that surrounds it, which no repair of that shape may
    // break: here the same suffix really does run.
    callProgram({ route, callee: "returns", suffix }),
  ]),
);

/** Name the whole judgment in the failure message so a red case explains itself. */
function judgment(result: BuildResult | CheckResult): string {
  return `${result.kind}: ${JSON.stringify(result.diagnostics)}`;
}

/**
 * A legal program must be accepted outright. Warnings are allowed — writing
 * code that cannot be reached is worth remarking on — but no error may be
 * reported and no service may stop short of a result.
 */
function expectAccepted(result: BuildResult | CheckResult, service: string): void {
  expect(result.kind, `${service} refused a legal program — ${judgment(result)}`).toBe("success");
  expect(
    result.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    `${service} reported errors for a legal program`,
  ).toEqual([]);
}

const cases = programs.map((program) => [program.label, program] as const);

describe.each(modes)("building a call to a non-returning function in mode %s", (mode) => {
  it.each(cases)(
    "should compile a program with %s",
    async (_label, program) => {
      await withProfileProject(program.source, target, async (project) => {
        expectAccepted(await buildProject({ project, optimization: mode }), "The build");
      });
    },
    60_000,
  );
});

describe("checking a call to a non-returning function", () => {
  // Checking and building must agree on whether a program is legal; a program
  // an author is told is fine must not be refused once they build it.
  it.each(cases)(
    "should report success for a program with %s",
    async (_label, program) => {
      await withProfileProject(program.source, target, async (project) => {
        expectAccepted(await checkProject({ project }), "The check");
      });
    },
    60_000,
  );
});
